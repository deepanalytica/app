// ============================================================
// useResearch — Vue Composable for Research System State
// ============================================================

import { ref, reactive, computed } from 'vue'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001'

export function useResearch() {
  // ─── State ──────────────────────────────────────────────
  const sessionId = ref(null)
  const isConnected = ref(false)
  const isResearching = ref(false)
  const isComplete = ref(false)
  const error = ref(null)
  const ws = ref(null)

  const currentPhase = ref('idle')
  const progress = ref(0)
  const progressMessage = ref('')

  const agents = reactive({
    research_director: { name: 'Research Director', status: 'idle', currentTask: '', metrics: {} },
    literature_reviewer: { name: 'Literature Reviewer', status: 'idle', currentTask: '', metrics: {} },
    hypothesis_generator: { name: 'Hypothesis Generator', status: 'idle', currentTask: '', metrics: {} },
    methodology_expert: { name: 'Methodology Expert', status: 'idle', currentTask: '', metrics: {} },
    data_analyst: { name: 'Data Analyst', status: 'idle', currentTask: '', metrics: {} },
    critical_reviewer: { name: 'Critical Reviewer', status: 'idle', currentTask: '', metrics: {} },
    synthesis_specialist: { name: 'Synthesis Specialist', status: 'idle', currentTask: '', metrics: {} },
    scientific_writer: { name: 'Scientific Writer', status: 'idle', currentTask: '', metrics: {} },
    citation_manager: { name: 'Citation Manager', status: 'idle', currentTask: '', metrics: {} },
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

  const activeAgents = computed(() =>
    Object.entries(agents)
      .filter(([, a]) => a.status !== 'idle')
      .map(([role, a]) => ({ role, ...a }))
  )

  const completedAgents = computed(() =>
    Object.values(agents).filter((a) => a.status === 'completed').length
  )

  // ─── WebSocket Setup ────────────────────────────────────
  function connectWebSocket(sid) {
    if (ws.value) {
      ws.value.close()
    }

    const socket = new WebSocket(WS_URL)
    ws.value = socket

    socket.onopen = () => {
      isConnected.value = true
      socket.send(JSON.stringify({ type: 'subscribe', sessionId: sid }))
    }

    socket.onclose = () => {
      isConnected.value = false
    }

    socket.onerror = (e) => {
      console.error('[WS] Error:', e)
      error.value = 'WebSocket connection error'
    }

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        handleStreamEvent(msg)
      } catch (e) {
        console.error('[WS] Parse error:', e)
      }
    }
  }

  function handleStreamEvent(event) {
    switch (event.type) {
      case 'agent_update':
        handleAgentUpdate(event)
        break
      case 'finding':
        handleFinding(event)
        break
      case 'phase_change':
        handlePhaseChange(event)
        break
      case 'thinking':
        handleThinking(event)
        break
      case 'text_delta':
        handleTextDelta(event)
        break
      case 'progress':
        handleProgress(event)
        break
      case 'paper_ready':
        handlePaperReady(event)
        break
      case 'session_complete':
        handleSessionComplete(event)
        break
      case 'error':
        handleError(event)
        break
    }
  }

  function handleAgentUpdate(event) {
    const { status, currentTask, name, metrics: agentMetrics } = event.data
    const role = event.agentRole

    if (role && agents[role]) {
      agents[role].status = status
      if (currentTask) agents[role].currentTask = currentTask
      if (agentMetrics) agents[role].metrics = agentMetrics
    }

    addToLog(event.agentRole, 'status', `${name}: ${status}`)
  }

  function handleFinding(event) {
    const { finding } = event.data
    if (finding) {
      findings.value.push(finding)
    }
  }

  function handlePhaseChange(event) {
    currentPhase.value = event.data.phase
    addToLog('system', 'phase', event.data.message || `Phase: ${event.data.phase}`)
  }

  function handleThinking(event) {
    const role = event.agentRole
    if (!thinkingByAgent[role]) {
      thinkingByAgent[role] = ''
    }
    thinkingByAgent[role] += event.data.chunk || ''
  }

  function handleTextDelta(event) {
    addToLog(event.agentRole, 'text', event.data.chunk || '')
  }

  function handleProgress(event) {
    progress.value = event.data.percentage
    progressMessage.value = event.data.message
    addToLog('system', 'progress', event.data.message)
  }

  function handlePaperReady(event) {
    paper.value = event.data.paper
    paperText.value = event.data.paperText
    bibliography.value = event.data.bibliography
    addToLog('scientific_writer', 'paper', 'Research paper generated!')
  }

  function handleSessionComplete(event) {
    isResearching.value = false
    isComplete.value = true
    metrics.value = event.data.metrics || metrics.value
    currentPhase.value = 'completed'
    addToLog('system', 'complete', 'Research session completed successfully!')
  }

  function handleError(event) {
    error.value = event.data.error
    isResearching.value = false
    addToLog('system', 'error', event.data.error)
  }

  function addToLog(agent, type, message) {
    const truncatedMessage = typeof message === 'string'
      ? message.substring(0, 200)
      : String(message).substring(0, 200)

    streamLog.value.push({
      id: Date.now() + Math.random(),
      agent,
      type,
      message: truncatedMessage,
      timestamp: new Date().toISOString(),
    })

    // Keep log manageable
    if (streamLog.value.length > 500) {
      streamLog.value = streamLog.value.slice(-400)
    }
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
    progressMessage.value = 'Starting research...'
    currentPhase.value = 'initialization'

    // Reset agents
    Object.keys(agents).forEach((role) => {
      agents[role].status = 'idle'
      agents[role].currentTask = ''
    })

    try {
      const response = await fetch(`${API_URL}/api/research/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to start research')
      }

      const data = await response.json()
      sessionId.value = data.sessionId

      // Connect WebSocket for real-time updates
      connectWebSocket(data.sessionId)
    } catch (err) {
      isResearching.value = false
      error.value = err.message
      throw err
    }
  }

  function disconnect() {
    if (ws.value) {
      ws.value.close()
      ws.value = null
    }
    isConnected.value = false
  }

  function reset() {
    disconnect()
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
    Object.keys(agents).forEach((role) => {
      agents[role].status = 'idle'
      agents[role].currentTask = ''
    })
  }

  return {
    // State
    sessionId,
    isConnected,
    isResearching,
    isComplete,
    error,
    currentPhase,
    progress,
    progressMessage,
    agents,
    findings,
    paper,
    paperText,
    bibliography,
    metrics,
    streamLog,
    thinkingByAgent,

    // Computed
    phaseLabel,
    activeAgents,
    completedAgents,

    // Actions
    startResearch,
    disconnect,
    reset,
  }
}
