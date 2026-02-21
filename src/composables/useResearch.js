// ============================================================
// useResearch — Vue Composable for Research System State
// Uses Server-Sent Events (SSE) — works on Vercel Pro
// ============================================================

import { ref, reactive, computed } from 'vue'

// In production (Vercel), API_URL is empty (same-origin requests)
// In dev, points to the local backend server
const API_URL = import.meta.env.VITE_API_URL || ''

export function useResearch() {
  // ─── State ──────────────────────────────────────────────
  const sessionId = ref(null)
  const isConnected = ref(false)
  const isResearching = ref(false)
  const isComplete = ref(false)
  const error = ref(null)
  let eventSource = null

  const currentPhase = ref('idle')
  const progress = ref(0)
  const progressMessage = ref('')

  const agents = reactive({
    research_director:    { name: 'Research Director',    status: 'idle', currentTask: '', metrics: {} },
    literature_reviewer:  { name: 'Literature Reviewer',  status: 'idle', currentTask: '', metrics: {} },
    hypothesis_generator: { name: 'Hypothesis Generator', status: 'idle', currentTask: '', metrics: {} },
    methodology_expert:   { name: 'Methodology Expert',   status: 'idle', currentTask: '', metrics: {} },
    data_analyst:         { name: 'Data Analyst',          status: 'idle', currentTask: '', metrics: {} },
    critical_reviewer:    { name: 'Critical Reviewer',    status: 'idle', currentTask: '', metrics: {} },
    synthesis_specialist: { name: 'Synthesis Specialist', status: 'idle', currentTask: '', metrics: {} },
    scientific_writer:    { name: 'Scientific Writer',    status: 'idle', currentTask: '', metrics: {} },
    citation_manager:     { name: 'Citation Manager',     status: 'idle', currentTask: '', metrics: {} },
  })

  const findings = ref([])
  const paper = ref(null)
  const paperText = ref('')
  const bibliography = ref('')
  const metrics = ref({ totalTokens: 0, estimatedCost: 0, qualityScore: 0 })
  const streamLog = ref([])
  const thinkingByAgent = reactive({})

  // ─── Computed ──────────────────────────────────────────
  const phaseLabel = computed(() => {
    const labels = {
      idle: 'Idle',
      initialization: 'Initializing Strategy',
      literature_review: 'Literature Review',
      hypothesis_formation: 'Hypothesis Generation',
      methodology_design: 'Methodology Design',
      data_analysis: 'Data Analysis',
      critical_review: 'Critical Review',
      synthesis: 'Knowledge Synthesis',
      writing: 'Paper Writing',
      citation_management: 'Citation Management',
      final_review: 'Final Assembly',
      completed: 'Research Complete',
    }
    return labels[currentPhase.value] || currentPhase.value
  })

  const completedAgents = computed(() =>
    Object.values(agents).filter((a) => a.status === 'completed').length
  )

  // ─── SSE Connection ──────────────────────────────────────
  function connectSSE(sid) {
    if (eventSource) { eventSource.close(); eventSource = null }

    const url = `${API_URL}/api/research/stream?sessionId=${sid}`
    eventSource = new EventSource(url)

    eventSource.onopen = () => { isConnected.value = true }

    eventSource.onmessage = (e) => {
      try { handleEvent(JSON.parse(e.data)) }
      catch (err) { console.error('[SSE] parse error:', err) }
    }

    eventSource.onerror = () => {
      if (!isResearching.value) return
      // EventSource auto-retries; only log if still researching
      console.warn('[SSE] connection interrupted, retrying...')
    }
  }

  // ─── Event Handlers ─────────────────────────────────────
  function handleEvent(event) {
    switch (event.type) {
      case 'agent_update':     handleAgentUpdate(event); break
      case 'finding':          handleFinding(event); break
      case 'phase_change':     handlePhaseChange(event); break
      case 'thinking':         handleThinking(event); break
      case 'text_delta':       handleTextDelta(event); break
      case 'progress':         handleProgress(event); break
      case 'paper_ready':      handlePaperReady(event); break
      case 'session_complete': handleSessionComplete(event); break
      case 'error':            handleError(event); break
    }
  }

  function handleAgentUpdate({ agentRole, data }) {
    if (agentRole && agents[agentRole]) {
      agents[agentRole].status = data.status
      if (data.currentTask) agents[agentRole].currentTask = data.currentTask
      if (data.metrics) agents[agentRole].metrics = data.metrics
    }
    addLog(agentRole, 'status', `${data.name || agentRole}: ${data.status}`)
  }

  function handleFinding({ data }) {
    if (data.finding) findings.value.push(data.finding)
  }

  function handlePhaseChange({ data }) {
    currentPhase.value = data.phase
    addLog('system', 'phase', data.message || `Phase: ${data.phase}`)
  }

  function handleThinking({ agentRole, data }) {
    if (!thinkingByAgent[agentRole]) thinkingByAgent[agentRole] = ''
    thinkingByAgent[agentRole] += data.chunk || ''
  }

  function handleTextDelta({ agentRole, data }) {
    addLog(agentRole, 'text', data.chunk || '')
  }

  function handleProgress({ data }) {
    progress.value = data.percentage
    progressMessage.value = data.message
    addLog('system', 'progress', data.message)
  }

  function handlePaperReady({ data }) {
    paper.value = data.paper
    paperText.value = data.paperText
    bibliography.value = data.bibliography
    addLog('scientific_writer', 'paper', '✓ Research paper generated!')
  }

  function handleSessionComplete({ data }) {
    isResearching.value = false
    isComplete.value = true
    metrics.value = data.metrics || metrics.value
    currentPhase.value = 'completed'
    isConnected.value = false
    eventSource?.close()
    const dur = data.duration ? `${Math.round(data.duration / 60)}m ${data.duration % 60}s` : '—'
    addLog('system', 'complete', `✓ Research complete in ${dur}`)
  }

  function handleError({ data }) {
    error.value = data.error
    isResearching.value = false
    isConnected.value = false
    eventSource?.close()
    addLog('system', 'error', data.error)
  }

  function addLog(agent, type, message) {
    const msg = String(message || '').substring(0, 200)
    streamLog.value.push({ id: Date.now() + Math.random(), agent, type, message: msg, timestamp: new Date().toISOString() })
    if (streamLog.value.length > 500) streamLog.value = streamLog.value.slice(-400)
  }

  // ─── Actions ────────────────────────────────────────────
  async function startResearch(config) {
    error.value = null
    isResearching.value = true
    isComplete.value = false
    findings.value = []
    paper.value = null
    paperText.value = ''
    bibliography.value = ''
    streamLog.value = []
    progress.value = 0
    progressMessage.value = 'Connecting to research agents...'
    currentPhase.value = 'initialization'
    Object.keys(agents).forEach((r) => { agents[r].status = 'idle'; agents[r].currentTask = '' })

    try {
      const res = await fetch(`${API_URL}/api/research/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })

      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || `Server error ${res.status}`)
      }

      const { sessionId: sid } = await res.json()
      sessionId.value = sid
      connectSSE(sid)
    } catch (err) {
      isResearching.value = false
      error.value = err.message
      throw err
    }
  }

  function reset() {
    eventSource?.close()
    eventSource = null
    sessionId.value = null
    isResearching.value = false
    isComplete.value = false
    isConnected.value = false
    error.value = null
    currentPhase.value = 'idle'
    progress.value = 0
    progressMessage.value = ''
    findings.value = []
    paper.value = null
    paperText.value = ''
    bibliography.value = ''
    streamLog.value = []
    metrics.value = { totalTokens: 0, estimatedCost: 0, qualityScore: 0 }
    Object.keys(agents).forEach((r) => { agents[r].status = 'idle'; agents[r].currentTask = '' })
  }

  return {
    sessionId, isConnected, isResearching, isComplete, error,
    currentPhase, progress, progressMessage, agents,
    findings, paper, paperText, bibliography, metrics, streamLog, thinkingByAgent,
    phaseLabel, completedAgents,
    startResearch, reset,
  }
}
