#!/usr/bin/env node
// ============================================================
// NOTION SYNC — Multi-Agent Research System
// Crea una página completa de progreso del proyecto en Notion
// Uso: NOTION_TOKEN=ntn_xxx node scripts/notion-sync.mjs
// ============================================================

const TOKEN = process.env.NOTION_TOKEN || 'ntn_u42899712937FRfWc5cuhZtYVM9wEtktPBYVqUgQ3vV3ox';
const NOTION_VERSION = '2022-06-28';

const headers = {
  'Authorization': `Bearer ${TOKEN}`,
  'Notion-Version': NOTION_VERSION,
  'Content-Type': 'application/json',
};

async function notion(method, path, body) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) {
    console.error('Notion API error:', JSON.stringify(json, null, 2));
    throw new Error(`Notion API ${res.status}: ${json.message}`);
  }
  return json;
}

function t(text) {
  return [{ type: 'text', text: { content: text } }];
}

function heading1(text) {
  return { object: 'block', type: 'heading_1', heading_1: { rich_text: t(text) } };
}

function heading2(text) {
  return { object: 'block', type: 'heading_2', heading_2: { rich_text: t(text) } };
}

function heading3(text) {
  return { object: 'block', type: 'heading_3', heading_3: { rich_text: t(text) } };
}

function para(text) {
  return { object: 'block', type: 'paragraph', paragraph: { rich_text: t(text) } };
}

function bullet(text) {
  return { object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: t(text) } };
}

function todo(text, checked = false) {
  return { object: 'block', type: 'to_do', to_do: { rich_text: t(text), checked } };
}

function divider() {
  return { object: 'block', type: 'divider', divider: {} };
}

function callout(text, emoji = '💡') {
  return {
    object: 'block', type: 'callout',
    callout: { rich_text: t(text), icon: { type: 'emoji', emoji } }
  };
}

function code(text, language = 'bash') {
  return {
    object: 'block', type: 'code',
    code: { rich_text: t(text), language }
  };
}

async function main() {
  console.log('🔍 Buscando workspace en Notion...');

  // Buscar páginas disponibles
  const search = await notion('POST', '/search', { page_size: 10 });
  console.log(`✅ Conectado. Páginas encontradas: ${search.results.length}`);

  if (search.results.length === 0) {
    console.error('❌ No hay páginas disponibles. Asegúrate de compartir al menos una página con la integración.');
    process.exit(1);
  }

  // Usar la primera página disponible como padre
  const parent = search.results[0];
  console.log(`📄 Usando como padre: "${parent.properties?.title?.title?.[0]?.plain_text || parent.id}"`);

  // ── Crear página principal del proyecto ─────────────────
  const page = await notion('POST', '/pages', {
    parent: { page_id: parent.id },
    icon: { type: 'emoji', emoji: '🧠' },
    properties: {
      title: {
        title: [{ type: 'text', text: { content: '🧠 Multi-Agent Research System — Estado del Proyecto' } }]
      }
    },
    children: [
      callout('Sistema elite de investigación científica con múltiples agentes de IA, análisis de código, memoria persistente y auto-mejora.', '🚀'),
      para(''),
      heading1('📊 Estado General'),
      divider(),

      heading2('✅ Completado'),
      todo('Arquitectura base multi-agente con MessageBus', true),
      todo('ResearchPipeline con 9 agentes especializados', true),
      todo('CodeAnalysisPipeline con 4 agentes de código', true),
      todo('Sistema de memoria persistente (MemoryStore + KnowledgeSkillEngine)', true),
      todo('SelfImprovementAgent con propuestas de mejora', true),
      todo('Backend Express + WebSocket para streaming en tiempo real', true),
      todo('Frontend Vue 3 + Vite con interfaz completa', true),
      todo('Exportación de papers (LaTeX, Markdown, HTML, JSON)', true),
      todo('AcademicSearchTool (Semantic Scholar + arXiv)', true),
      todo('GitHubFetcher para análisis de repos remotos', true),
      todo('Control interactivo (pausa/reanuda pipeline)', true),
      todo('Deploy en Vercel (frontend) + Vercel Functions (API)', true),
      todo('CI/CD con GitHub Actions + auto-merge a main', true),
      todo('Sistema de citaciones verificadas (CrossRef/Semantic Scholar)', true),
      para(''),

      heading2('🔄 En Progreso'),
      todo('Pruebas end-to-end del pipeline completo', false),
      todo('Optimización de costos de tokens por sesión', false),
      todo('Persistencia real en base de datos (actualmente en memoria)', false),
      para(''),

      heading2('⏳ Pendiente'),
      todo('Autenticación de usuarios (sin auth actualmente)', false),
      todo('Base de datos real (PostgreSQL/Supabase para reemplazar in-memory store)', false),
      todo('Rate limiting y manejo de cuotas de API', false),
      todo('Tests unitarios y de integración', false),
      todo('Panel de administración y métricas', false),
      todo('Soporte multi-idioma en agentes (actualmente en inglés)', false),
      todo('Integración con más fuentes académicas (PubMed, IEEE, ACM)', false),
      todo('Modo colaborativo (múltiples usuarios en misma sesión)', false),
      todo('Exportación a PDF nativo', false),
      todo('Webhooks para notificaciones de sesiones completadas', false),
      para(''),

      divider(),
      heading1('🏗️ Arquitectura'),
      divider(),

      heading2('Backend (engine/)'),
      bullet('server.ts — Express + WebSocket server, puerto 3001'),
      bullet('coordination/ResearchPipeline.ts — Orquestador principal de investigación'),
      bullet('coordination/CodeAnalysisPipeline.ts — Pipeline de análisis de código'),
      bullet('coordination/MessageBus.ts — Bus de mensajes entre agentes'),
      para(''),

      heading2('Agentes de Investigación (9 agentes)'),
      bullet('ResearchDirector — Coordina el equipo y define objetivos'),
      bullet('LiteratureReviewAgent — Revisión de literatura científica'),
      bullet('HypothesisAgent — Generación y validación de hipótesis'),
      bullet('MethodologyAgent — Diseño de metodología'),
      bullet('DataAnalysisAgent — Análisis de datos y estadísticas'),
      bullet('CriticalReviewAgent — Revisión crítica y validación'),
      bullet('SynthesisAgent — Síntesis de hallazgos'),
      bullet('ScientificWriterAgent — Redacción del paper científico'),
      bullet('CitationManagerAgent — Gestión y verificación de citas'),
      para(''),

      heading2('Agentes de Código (4 agentes)'),
      bullet('CodeReviewAgent — Revisión de calidad y buenas prácticas'),
      bullet('ArchitectureAgent — Análisis de arquitectura y patrones'),
      bullet('SecurityAuditAgent — Auditoría de seguridad'),
      bullet('DocumentationAgent — Generación de documentación'),
      para(''),

      heading2('Sistema de Memoria'),
      bullet('MemoryStore — Almacén persistente de sesiones, skills y propuestas'),
      bullet('KnowledgeSkillEngine — Motor de extracción y reutilización de conocimiento'),
      bullet('SelfImprovementAgent — Análisis de rendimiento y propuestas de mejora'),
      para(''),

      heading2('Frontend (src/)'),
      bullet('App.vue — Componente raíz con routing'),
      bullet('ResearchForm.vue — Formulario de configuración de investigación'),
      bullet('AgentCard.vue — Tarjeta de estado de agente en tiempo real'),
      bullet('FindingsPanel.vue — Panel de hallazgos de investigación'),
      bullet('PaperViewer.vue — Visualizador del paper generado'),
      bullet('MemoryBrowser.vue — Explorador de memoria y skills'),
      bullet('SelfImprovementPanel.vue — Panel de propuestas de mejora'),
      bullet('SessionHistory.vue — Historial de sesiones'),
      para(''),

      divider(),
      heading1('🛠️ Stack Tecnológico'),
      divider(),

      heading2('Core'),
      bullet('Runtime: Node.js + TypeScript'),
      bullet('AI: Anthropic Claude claude-opus-4-6 / claude-sonnet-4-6 (con extended thinking)'),
      bullet('SDK: @anthropic-ai/sdk ^0.54.0'),
      bullet('Comunicación: WebSocket (ws) para streaming en tiempo real'),
      bullet('API REST: Express.js'),
      para(''),

      heading2('Frontend'),
      bullet('Framework: Vue 3 + Composition API'),
      bullet('Build: Vite 2.x'),
      bullet('Estilo: CSS nativo (sin framework UI)'),
      para(''),

      heading2('Deploy'),
      bullet('Frontend: Vercel (static deploy)'),
      bullet('Backend API: Vercel Functions (serverless)'),
      bullet('CI/CD: GitHub Actions → auto-merge a main → deploy automático'),
      para(''),

      heading2('APIs Externas'),
      bullet('Semantic Scholar API — búsqueda académica'),
      bullet('arXiv API — preprints científicos'),
      bullet('CrossRef API — verificación de DOIs y citaciones'),
      bullet('GitHub API — fetching de repositorios para análisis'),
      para(''),

      divider(),
      heading1('📁 Estructura de Archivos'),
      divider(),

      code(`multi-agent-research-system/
├── engine/
│   ├── agents/
│   │   ├── BaseAgent.ts           # Clase base para todos los agentes
│   │   ├── ResearchDirector.ts    # Director de investigación
│   │   ├── LiteratureReviewAgent.ts
│   │   ├── HypothesisAgent.ts
│   │   ├── MethodologyAgent.ts
│   │   ├── DataAnalysisAgent.ts
│   │   ├── CriticalReviewAgent.ts
│   │   ├── SynthesisAgent.ts
│   │   ├── ScientificWriterAgent.ts
│   │   ├── CitationManagerAgent.ts
│   │   └── code/
│   │       ├── ArchitectureAgent.ts
│   │       ├── CodeReviewAgent.ts
│   │       ├── SecurityAuditAgent.ts
│   │       └── DocumentationAgent.ts
│   ├── coordination/
│   │   ├── MessageBus.ts
│   │   ├── ResearchPipeline.ts
│   │   └── CodeAnalysisPipeline.ts
│   ├── memory/
│   │   ├── MemoryStore.ts
│   │   └── KnowledgeSkillEngine.ts
│   ├── self_improvement/
│   │   └── SelfImprovementAgent.ts
│   ├── tools/
│   │   ├── AcademicSearchTool.ts
│   │   └── GitHubFetcher.ts
│   ├── export/
│   │   └── PaperExporter.ts
│   ├── models/
│   │   └── types.ts               # Todos los tipos TypeScript
│   └── server.ts                  # Punto de entrada del servidor
├── src/
│   ├── App.vue
│   └── components/
│       ├── AgentCard.vue
│       ├── FindingsPanel.vue
│       ├── MemoryBrowser.vue
│       ├── PaperViewer.vue
│       ├── ResearchForm.vue
│       ├── SelfImprovementPanel.vue
│       └── SessionHistory.vue
├── .github/workflows/
│   ├── deploy.yml
│   └── auto-merge-to-main.yml
├── .env.example
├── package.json
└── vercel.json`, 'plain text'),

      divider(),
      heading1('🚀 Variables de Entorno'),
      divider(),

      code(`# Requeridas
ANTHROPIC_API_KEY=sk-ant-...

# Opcionales
PORT=3001                              # Puerto del backend (default: 3001)
VITE_API_URL=http://localhost:3001     # URL del backend para el frontend
VITE_WS_URL=ws://localhost:3001       # URL WebSocket para streaming`, 'bash'),

      para(''),
      divider(),
      heading1('⚡ Comandos'),
      divider(),

      code(`npm run dev          # Inicia backend + frontend en paralelo (desarrollo)
npm run client:dev   # Solo frontend Vite
npm run server:dev   # Solo backend con hot-reload (tsx watch)
npm run build        # Build de producción (frontend + engine)
npm start            # Inicia servidor de producción`, 'bash'),

      para(''),
      divider(),
      heading1('🔀 Flujo de Git'),
      divider(),

      bullet('Rama de desarrollo: claude/multi-agent-research-system-dAt71'),
      bullet('Rama principal: main'),
      bullet('Auto-merge: GitHub Actions fusiona automáticamente PRs aprobados a main'),
      bullet('Deploy automático: cada push a main dispara deploy en Vercel'),
      para(''),
      para('Commits recientes:'),
      bullet('fix: update auto-merge workflow with robust PR creation and direct merge fallback'),
      bullet('fix: remove base from Vite config — fixes blank screen on Vercel'),
      bullet('fix: use req.query for path params in Vercel dynamic route handlers'),
      bullet('fix: add missing Vercel API routes for memory & improvement endpoints'),
      bullet('feat: add persistent memory, knowledge skills & self-improvement system'),
      bullet('feat: add real-time interactive control, code analysis suite, and export system'),
      bullet('feat: make system fully deployable on Vercel Pro'),
      para(''),

      divider(),
      heading1('🎯 Próximos Pasos Prioritarios'),
      divider(),

      callout('Prioridad ALTA: Persistencia real de datos con Supabase/PostgreSQL para reemplazar el almacén en memoria.', '🔴'),
      para(''),
      callout('Prioridad MEDIA: Autenticación de usuarios para poder tener sesiones privadas y datos por usuario.', '🟡'),
      para(''),
      callout('Prioridad BAJA: Tests automatizados, más fuentes académicas, exportación PDF nativa.', '🟢'),
      para(''),

      divider(),
      para(`📅 Última actualización: ${new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`),
    ]
  });

  console.log('\n✅ ¡Página creada exitosamente en Notion!');
  console.log(`🔗 URL: ${page.url}`);
  console.log(`📄 ID: ${page.id}`);
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
