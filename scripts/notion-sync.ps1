# ============================================================
# NOTION SYNC — Multi-Agent Research System (PowerShell)
# Ejecutar: .\notion-sync.ps1
# ============================================================

$TOKEN = "ntn_u42899712937FRfWc5cuhZtYVM9wEtktPBYVqUgQ3vV3ox"
$PARENT_PAGE_ID = "329ca9bff797808a9f29cbca605fac92"

$headers = @{
    "Authorization"  = "Bearer $TOKEN"
    "Notion-Version" = "2022-06-28"
    "Content-Type"   = "application/json"
}

function t($text) {
    return @(@{ type = "text"; text = @{ content = $text } })
}

function heading1($text) {
    return @{ object = "block"; type = "heading_1"; heading_1 = @{ rich_text = (t $text) } }
}

function heading2($text) {
    return @{ object = "block"; type = "heading_2"; heading_2 = @{ rich_text = (t $text) } }
}

function para($text) {
    return @{ object = "block"; type = "paragraph"; paragraph = @{ rich_text = (t $text) } }
}

function bullet($text) {
    return @{ object = "block"; type = "bulleted_list_item"; bulleted_list_item = @{ rich_text = (t $text) } }
}

function todo($text, $checked = $false) {
    return @{ object = "block"; type = "to_do"; to_do = @{ rich_text = (t $text); checked = $checked } }
}

function divider() {
    return @{ object = "block"; type = "divider"; divider = @{} }
}

function callout($text, $emoji = "💡") {
    return @{
        object  = "block"; type = "callout"
        callout = @{ rich_text = (t $text); icon = @{ type = "emoji"; emoji = $emoji } }
    }
}

function codeblock($text) {
    return @{ object = "block"; type = "code"; code = @{ rich_text = (t $text); language = "bash" } }
}

$fecha = Get-Date -Format "dd 'de' MMMM 'de' yyyy, HH:mm"

$body = @{
    parent     = @{ page_id = $PARENT_PAGE_ID }
    icon       = @{ type = "emoji"; emoji = "🧠" }
    properties = @{
        title = @{
            title = @(@{ type = "text"; text = @{ content = "🧠 Multi-Agent Research System — Estado del Proyecto" } })
        }
    }
    children   = @(
        (callout "Sistema elite de investigacion cientifica con multiples agentes de IA, analisis de codigo, memoria persistente y auto-mejora. Stack: Vue 3 + TypeScript + Claude API + Express + WebSocket. Deploy: Vercel." "🚀"),
        (para ""),
        (heading1 "📊 Estado General"),
        (divider),

        (heading2 "✅ Completado"),
        (todo "Arquitectura base multi-agente con MessageBus" $true),
        (todo "ResearchPipeline con 9 agentes especializados" $true),
        (todo "CodeAnalysisPipeline con 4 agentes de codigo" $true),
        (todo "Sistema de memoria persistente (MemoryStore + KnowledgeSkillEngine)" $true),
        (todo "SelfImprovementAgent con propuestas de mejora automaticas" $true),
        (todo "Backend Express + WebSocket para streaming en tiempo real" $true),
        (todo "Frontend Vue 3 + Vite con interfaz completa" $true),
        (todo "Exportacion de papers (LaTeX, Markdown, HTML, JSON)" $true),
        (todo "AcademicSearchTool (Semantic Scholar + arXiv + CrossRef)" $true),
        (todo "GitHubFetcher para analisis de repositorios remotos" $true),
        (todo "Control interactivo (pausa/reanuda pipeline en tiempo real)" $true),
        (todo "Deploy en Vercel (frontend + Vercel Functions para API)" $true),
        (todo "CI/CD con GitHub Actions + auto-merge a main" $true),
        (todo "Sistema de citaciones verificadas" $true),
        (para ""),

        (heading2 "🔄 En Progreso"),
        (todo "Pruebas end-to-end del pipeline completo" $false),
        (todo "Optimizacion de costos de tokens por sesion" $false),
        (todo "Persistencia real en base de datos (actualmente en memoria)" $false),
        (para ""),

        (heading2 "⏳ Pendiente"),
        (todo "Autenticacion de usuarios" $false),
        (todo "Base de datos real (PostgreSQL/Supabase)" $false),
        (todo "Rate limiting y manejo de cuotas de API" $false),
        (todo "Tests unitarios y de integracion" $false),
        (todo "Exportacion a PDF nativo" $false),
        (todo "Soporte multi-idioma en agentes" $false),
        (todo "Integracion con PubMed, IEEE, ACM" $false),
        (todo "Modo colaborativo multi-usuario" $false),
        (todo "Webhooks para notificaciones de sesiones completadas" $false),
        (para ""),

        (divider),
        (heading1 "🏗️ Arquitectura"),
        (heading2 "Agentes de Investigacion (9)"),
        (bullet "ResearchDirector — Coordina el equipo y define objetivos"),
        (bullet "LiteratureReviewAgent — Revision de literatura cientifica"),
        (bullet "HypothesisAgent — Generacion y validacion de hipotesis"),
        (bullet "MethodologyAgent — Diseno de metodologia"),
        (bullet "DataAnalysisAgent — Analisis de datos y estadisticas"),
        (bullet "CriticalReviewAgent — Revision critica y validacion"),
        (bullet "SynthesisAgent — Sintesis de hallazgos"),
        (bullet "ScientificWriterAgent — Redaccion del paper cientifico"),
        (bullet "CitationManagerAgent — Gestion y verificacion de citas"),
        (para ""),

        (heading2 "Agentes de Codigo (4)"),
        (bullet "CodeReviewAgent — Calidad y buenas practicas"),
        (bullet "ArchitectureAgent — Analisis de arquitectura y patrones"),
        (bullet "SecurityAuditAgent — Auditoria de seguridad"),
        (bullet "DocumentationAgent — Generacion de documentacion"),
        (para ""),

        (heading2 "Sistema de Memoria"),
        (bullet "MemoryStore — Almacen persistente de sesiones, skills y propuestas"),
        (bullet "KnowledgeSkillEngine — Motor de extraccion y reutilizacion de conocimiento"),
        (bullet "SelfImprovementAgent — Analisis de rendimiento y propuestas de mejora"),
        (para ""),

        (divider),
        (heading1 "🛠️ Stack Tecnologico"),
        (bullet "AI: Claude claude-opus-4-6 con extended thinking"),
        (bullet "Backend: Node.js + TypeScript + Express + WebSocket (ws)"),
        (bullet "Frontend: Vue 3 + Vite"),
        (bullet "Deploy: Vercel (static frontend + serverless functions)"),
        (bullet "CI/CD: GitHub Actions → auto-merge a main → deploy automatico"),
        (bullet "APIs externas: Semantic Scholar, arXiv, CrossRef, GitHub"),
        (para ""),

        (divider),
        (heading1 "⚡ Comandos"),
        (codeblock "npm run dev          # backend + frontend en paralelo`nnpm run server:dev   # solo backend con hot-reload`nnpm run build        # build de produccion`nnpm start            # servidor de produccion"),
        (para ""),

        (divider),
        (heading1 "🔀 Git"),
        (bullet "Rama activa: claude/multi-agent-research-system-dAt71"),
        (bullet "Rama principal: main"),
        (bullet "Auto-merge: GitHub Actions fusiona PRs aprobados a main"),
        (bullet "Deploy automatico en cada push a main"),
        (para ""),

        (divider),
        (heading1 "🎯 Proximos Pasos"),
        (callout "ALTA: Supabase/PostgreSQL para reemplazar almacen en memoria" "🔴"),
        (callout "MEDIA: Autenticacion de usuarios (actualmente sin auth)" "🟡"),
        (callout "BAJA: Tests automatizados, mas fuentes academicas, PDF nativo" "🟢"),
        (para ""),
        (para "Ultima actualizacion: $fecha")
    )
} | ConvertTo-Json -Depth 20

Write-Host "📤 Creando pagina en Notion..." -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri "https://api.notion.com/v1/pages" -Method POST -Headers $headers -Body $body
    Write-Host ""
    Write-Host "✅ Pagina creada exitosamente!" -ForegroundColor Green
    Write-Host "🔗 URL: $($response.url)" -ForegroundColor Yellow
    Write-Host "📄 ID:  $($response.id)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
}
