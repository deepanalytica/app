// ============================================================
// usePraxio — estado del Artifact Workbench.
// Mantiene historial de ejecuciones, ejecución activa y export.
// ============================================================

import { ref, computed, reactive } from 'vue'
import { DOMAINS } from './engine/domains'
import { runPipeline } from './engine/praxioEngine'
import type { ExecutionRecord } from './engine/types'
import { PIPELINE_STAGES } from './engine/types'
import { toJSON, toMarkdown, toHTML, downloadFile } from './engine/exportEngine'

export function usePraxio() {
  const domains = DOMAINS
  const selectedDomain = ref(DOMAINS[1].key) // Ebook Revenue: primer producto vendible
  const intent = ref('')
  const audience = ref('')
  const goal = ref('')

  const history = reactive<ExecutionRecord[]>([])
  const current = ref<ExecutionRecord | null>(null)
  const running = ref(false)
  const activeStage = ref(-1)

  const domain = computed(() => domains.find((d) => d.key === selectedDomain.value)!)

  const SAMPLE_INTENTS: Record<string, string> = {
    'deep-geo': 'Inundación reportada en el sector ribereño tras lluvias intensas; evaluar riesgo y responsables.',
    'ebook-revenue': 'Convertir mi experiencia en automatización con IA en un ebook con oferta y landing.',
    'sci-viz': 'Lámina educativa de la célula eucariota con orgánulos etiquetados para secundaria.',
    'biz-ops': 'Priorizar las 12 oportunidades del trimestre y cerrar el ciclo hacia venta.',
  }

  function loadSample() {
    intent.value = SAMPLE_INTENTS[selectedDomain.value] ?? ''
  }

  async function run() {
    if (!intent.value.trim()) return
    running.value = true
    current.value = null
    activeStage.value = 0

    // animación determinística del pipeline rail
    for (let i = 0; i < PIPELINE_STAGES.length; i++) {
      activeStage.value = i
      // eslint-disable-next-line no-await-in-loop
      await delay(70)
    }

    const rec = runPipeline({
      domainKey: selectedDomain.value,
      intent: intent.value,
      audience: audience.value,
      goal: goal.value,
    })
    current.value = rec
    history.unshift(rec)
    activeStage.value = PIPELINE_STAGES.length - 1
    running.value = false
  }

  function selectExecution(id: string) {
    const rec = history.find((r) => r.id === id)
    if (rec) current.value = rec
  }

  function exportAs(format: 'json' | 'md' | 'html') {
    if (!current.value) return
    const rec = current.value
    const safe = rec.artifact.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'artifact'
    if (format === 'json') downloadFile(`${safe}.json`, toJSON(rec), 'application/json')
    if (format === 'md') downloadFile(`${safe}.md`, toMarkdown(rec), 'text/markdown')
    if (format === 'html') downloadFile(`${safe}.html`, toHTML(rec), 'text/html')
  }

  return {
    domains,
    selectedDomain,
    domain,
    intent,
    audience,
    goal,
    history,
    current,
    running,
    activeStage,
    stages: PIPELINE_STAGES,
    loadSample,
    run,
    selectExecution,
    exportAs,
  }
}

function delay(ms: number) {
  return new Promise((res) => setTimeout(res, ms))
}
