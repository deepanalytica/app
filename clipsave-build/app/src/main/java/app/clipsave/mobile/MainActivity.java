package app.clipsave.mobile;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.widget.*;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class MainActivity extends Activity {
    private static final Pattern URL_PATTERN = Pattern.compile("https?://\\\\S+", Pattern.CASE_INSENSITIVE);
    private EditText urlInput, apiInput;
    private TextView status, resultTitle;
    private LinearLayout itemsBox;
    private CheckBox consent;
    private SharedPreferences prefs;
    private final Handler main = new Handler(Looper.getMainLooper());

    @Override public void onCreate(Bundle b) {
        super.onCreate(b);
        prefs = getSharedPreferences("clipsave", MODE_PRIVATE);
        buildUi();
        acceptIntent(getIntent());
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        acceptIntent(intent);
    }

    private void buildUi() {
        ScrollView scroll = new ScrollView(this);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(20), dp(24), dp(20), dp(40));
        root.setBackgroundColor(Color.rgb(247,247,244));
        scroll.addView(root, new ScrollView.LayoutParams(-1,-1));

        TextView title = text("ClipSave", 32, true); root.addView(title);
        TextView sub = text("Comparte. Elige. Descarga.", 16, false); sub.setTextColor(Color.DKGRAY); root.addView(sub, lpTop(4));

        urlInput = new EditText(this);
        urlInput.setHint("Instagram, Facebook o YouTube");
        urlInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        root.addView(urlInput, lpTop(22));

        LinearLayout row = new LinearLayout(this); row.setOrientation(LinearLayout.HORIZONTAL);
        Button paste = new Button(this); paste.setText("Pegar");
        paste.setOnClickListener(v -> pasteUrl()); row.addView(paste, new LinearLayout.LayoutParams(0, dp(52), 1));
        Button analyze = new Button(this); analyze.setText("Analizar");
        analyze.setOnClickListener(v -> resolve());
        LinearLayout.LayoutParams bp = new LinearLayout.LayoutParams(0, dp(52), 1); bp.setMargins(dp(8),0,0,0); row.addView(analyze,bp);
        root.addView(row, lpTop(10));

        consent = new CheckBox(this);
        consent.setText("Confirmo que el contenido es mío, tengo autorización o su descarga está permitida.");
        root.addView(consent, lpTop(14));

        status = text("Comparte una publicación con ClipSave o pega un enlace.", 14, false); status.setTextColor(Color.DKGRAY);
        root.addView(status, lpTop(12));
        resultTitle = text("", 20, true); root.addView(resultTitle, lpTop(16));
        itemsBox = new LinearLayout(this); itemsBox.setOrientation(LinearLayout.VERTICAL); root.addView(itemsBox);

        TextView server = text("Servidor", 17, true); root.addView(server, lpTop(28));
        TextView help = text("URL del resolver ClipSave. Se guarda solo en tu teléfono.", 13, false); help.setTextColor(Color.DKGRAY); root.addView(help, lpTop(4));
        apiInput = new EditText(this);
        apiInput.setHint("https://tu-backend.example.com");
        apiInput.setText(prefs.getString("api", ""));
        apiInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        root.addView(apiInput, lpTop(8));
        Button save = new Button(this); save.setText("Guardar servidor");
        save.setOnClickListener(v -> { prefs.edit().putString("api", apiInput.getText().toString().trim()).apply(); toast("Servidor guardado"); });
        root.addView(save, lpTop(8));
        setContentView(scroll);
    }

    private void acceptIntent(Intent intent) {
        if (intent != null && Intent.ACTION_SEND.equals(intent.getAction()) && "text/plain".equals(intent.getType())) {
            String raw = intent.getStringExtra(Intent.EXTRA_TEXT);
            String u = extractUrl(raw);
            if (u != null) {
                urlInput.setText(u);
                status.setText("Enlace recibido desde Compartir. Pulsa Analizar.");
            }
        }
    }

    private void pasteUrl() {
        ClipboardManager cb = (ClipboardManager)getSystemService(CLIPBOARD_SERVICE);
        if (cb.hasPrimaryClip() && cb.getPrimaryClip().getItemCount() > 0) {
            String raw = cb.getPrimaryClip().getItemAt(0).coerceToText(this).toString();
            String u = extractUrl(raw);
            if (u != null) urlInput.setText(u); else toast("No encontré un enlace");
        }
    }

    private String extractUrl(String raw) {
        if (raw == null) return null;
        Matcher m = URL_PATTERN.matcher(raw);
        return m.find() ? m.group() : null;
    }

    private void resolve() {
        String api = apiInput.getText().toString().trim().replaceAll("/+$", "");
        String media = urlInput.getText().toString().trim();
        if (api.isEmpty()) { status.setText("Configura primero la URL del servidor ClipSave."); return; }
        if (!media.startsWith("http")) { status.setText("Pega o comparte un enlace válido."); return; }
        prefs.edit().putString("api", api).apply();
        status.setText("Analizando publicación…"); resultTitle.setText(""); itemsBox.removeAllViews();
        Executors.newSingleThreadExecutor().execute(() -> {
            HttpURLConnection c = null;
            try {
                c = (HttpURLConnection)new URL(api + "/resolve").openConnection();
                c.setRequestMethod("POST"); c.setConnectTimeout(15000); c.setReadTimeout(60000); c.setDoOutput(true);
                c.setRequestProperty("Content-Type", "application/json");
                byte[] body = new JSONObject().put("url", media).toString().getBytes(StandardCharsets.UTF_8);
                c.getOutputStream().write(body);
                int code = c.getResponseCode();
                InputStream is = code >= 200 && code < 300 ? c.getInputStream() : c.getErrorStream();
                String raw = readAll(is);
                if (code < 200 || code >= 300) throw new IOException("Servidor " + code + ": " + raw);
                JSONObject json = new JSONObject(raw);
                main.post(() -> showResult(json));
            } catch (Exception e) {
                main.post(() -> status.setText("No se pudo analizar: " + e.getMessage()));
            } finally { if (c != null) c.disconnect(); }
        });
    }

    private void showResult(JSONObject json) {
        try {
            String platform = json.optString("platform", "");
            String title = json.optString("title", "Contenido detectado");
            JSONArray arr = json.getJSONArray("items");
            resultTitle.setText(platform.toUpperCase() + " · " + title);
            status.setText(arr.length() + " elemento(s) encontrados.");
            itemsBox.removeAllViews();
            if (arr.length() > 1) {
                Button all = new Button(this); all.setText("Descargar todo (" + arr.length() + ")");
                all.setOnClickListener(v -> {
                    if (!consent.isChecked()) { toast("Confirma que tienes permiso para descargar"); return; }
                    for (int i=0;i<arr.length();i++) try { enqueue(arr.getJSONObject(i)); } catch(Exception ignored) {}
                    toast("Carrusel enviado a Descargas/ClipSave");
                });
                itemsBox.addView(all, lpTop(10));
            }
            for (int i=0;i<arr.length();i++) {
                JSONObject item = arr.getJSONObject(i);
                Button b = new Button(this);
                b.setAllCaps(false);
                b.setText(item.optString("label", "Elemento " + (i+1)) + " · " + item.optString("type", "archivo") + "\nDescargar");
                b.setOnClickListener(v -> {
                    if (!consent.isChecked()) { toast("Confirma que tienes permiso para descargar"); return; }
                    try { enqueue(item); } catch(Exception e) { toast(e.getMessage()); }
                });
                itemsBox.addView(b, lpTop(8));
            }
        } catch(Exception e) { status.setText("Respuesta inválida del servidor: " + e.getMessage()); }
    }

    private void enqueue(JSONObject item) throws Exception {
        String u = item.getString("download_url");
        String filename = sanitize(item.optString("filename", "clipsave_media"));
        DownloadManager.Request req = new DownloadManager.Request(Uri.parse(u));
        req.setTitle(filename); req.setDescription("Descargando con ClipSave");
        req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
        req.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "ClipSave/" + filename);
        ((DownloadManager)getSystemService(DOWNLOAD_SERVICE)).enqueue(req);
        toast("Descarga iniciada: " + filename);
    }

    private static String readAll(InputStream is) throws IOException {
        if (is == null) return "";
        ByteArrayOutputStream out = new ByteArrayOutputStream(); byte[] buf = new byte[8192]; int n;
        while ((n = is.read(buf)) >= 0) out.write(buf,0,n);
        return out.toString("UTF-8");
    }
    private String sanitize(String s) { String x=s.replaceAll("[^A-Za-z0-9._-]", "_"); return x.substring(0, Math.min(100, x.length())); }
    private TextView text(String s,int sp,boolean bold){ TextView v=new TextView(this);v.setText(s);v.setTextSize(sp);v.setTextColor(Color.rgb(17,17,17));if(bold)v.setTypeface(null,1);return v; }
    private LinearLayout.LayoutParams lpTop(int top){ LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.setMargins(0,dp(top),0,0);return p; }
    private int dp(int x){ return (int)(x*getResources().getDisplayMetrics().density+0.5f); }
    private void toast(String s){ Toast.makeText(this,s,Toast.LENGTH_SHORT).show(); }
}
