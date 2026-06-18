package com.securityguard

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.telephony.TelephonyManager

object CallForwardingManager {

    data class ForwardingResult(
        val code: String,
        val description: String,
        val response: String?,
        val isActive: Boolean,
        val error: Boolean = false
    )

    val USSD_CODES = listOf(
        "*#21#"  to "Todas las llamadas",
        "*#67#"  to "Cuando ocupado",
        "*#61#"  to "Sin respuesta",
        "*#62#"  to "Fuera de cobertura"
    )

    val DISABLE_CODES = listOf(
        "##21#"  to "Cancelar desvío total",
        "##67#"  to "Cancelar desvío ocupado",
        "##61#"  to "Cancelar sin respuesta",
        "##62#"  to "Cancelar sin cobertura",
        "##002#" to "Cancelar TODOS los desvíos"
    )

    fun checkForwarding(
        context: Context,
        ussdCode: String,
        onResult: (ForwardingResult) -> Unit
    ) {
        val description = (USSD_CODES + DISABLE_CODES).firstOrNull { it.first == ussdCode }?.second ?: ussdCode
        try {
            val tm = context.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
            tm.sendUssdRequest(ussdCode, object : TelephonyManager.UssdResponseCallback() {
                override fun onReceiveUssdResponse(
                    telephonyManager: TelephonyManager,
                    request: String,
                    response: CharSequence
                ) {
                    val resp = response.toString()
                    val active = resp.contains("activo", ignoreCase = true) ||
                                 resp.contains("active", ignoreCase = true) ||
                                 resp.contains("activado", ignoreCase = true) ||
                                 resp.contains("forward", ignoreCase = true) ||
                                 resp.contains("desvío", ignoreCase = true) ||
                                 (resp.contains("+") && resp.any { it.isDigit() })
                    onResult(ForwardingResult(ussdCode, description, resp, active))
                }

                override fun onReceiveUssdResponseFailed(
                    telephonyManager: TelephonyManager,
                    request: String,
                    failureCode: Int
                ) {
                    onResult(ForwardingResult(ussdCode, description, null, false, error = true))
                }
            }, Handler(Looper.getMainLooper()))
        } catch (e: SecurityException) {
            onResult(ForwardingResult(ussdCode, description, "Sin permiso CALL_PHONE", false, error = true))
        } catch (e: Exception) {
            onResult(ForwardingResult(ussdCode, description, e.message, false, error = true))
        }
    }

    fun disableAllForwarding(context: Context, onResult: (String) -> Unit) {
        checkForwarding(context, "##002#") { result ->
            onResult(result.response ?: if (result.error) "Error al cancelar" else "OK")
        }
    }
}
