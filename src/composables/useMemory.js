// ============================================================
// useMemory — Vue composable for Memory Library & Self-Improvement
// Talks to /api/memory/* and /api/improvement/* endpoints
// ============================================================

import { ref, reactive, computed } from 'vue'

const API_BASE = import.meta.env.VITE_API_URL || ''

export function useMemory() {
  // ── State ──────────────────────────────────────────────────
  const skills = ref([])
  const sessions = ref([])
  const proposals = ref([])
  const systemStats = ref(null)
  const performanceData = ref([])
  const selectedSkill = ref(null)
  const selectedSession = ref(null)

  const isLoadingSkills = ref(false)
  const isLoadingSessions = ref(false)
  const isLoadingProposals = ref(false)
  const isAnalyzing = ref(false)
  const error = ref(null)

  // ── Computed ───────────────────────────────────────────────
  const pendingProposals = computed(() =>
    proposals.value.filter(p => p.status === 'pending')
  )

  const approvedProposals = computed(() =>
    proposals.value.filter(p => p.status === 'approved')
  )

  const avgQualityTrend = computed(() => {
    const snaps = performanceData.value.slice(0, 10)
    if (snaps.length < 2) return null
    const recent = snaps.slice(0, 3).reduce((s, p) => s + p.overallQuality, 0) / Math.min(3, snaps.length)
    const older = snaps.slice(3).reduce((s, p) => s + p.overallQuality, 0) / Math.max(1, snaps.length - 3)
    return { recent: Math.round(recent), older: Math.round(older), delta: Math.round(recent - older) }
  })

  // ── API Calls ─────────────────────────────────────────────

  async function loadSkills({ domain, query, tags } = {}) {
    isLoadingSkills.value = true
    error.value = null
    try {
      const params = new URLSearchParams()
      if (domain) params.set('domain', domain)
      if (query) params.set('q', query)
      if (tags?.length) params.set('tags', tags.join(','))

      const res = await fetch(`${API_BASE}/api/memory/skills?${params}`)
      const data = await res.json()
      skills.value = data.skills || []
    } catch (e) {
      error.value = e.message
    } finally {
      isLoadingSkills.value = false
    }
  }

  async function loadSkillDetail(skillId) {
    try {
      const res = await fetch(`${API_BASE}/api/memory/skills/${skillId}`)
      const data = await res.json()
      selectedSkill.value = { skill: data.skill, related: data.related }
      return data
    } catch (e) {
      error.value = e.message
      return null
    }
  }

  async function loadSessions({ domain, limit = 20, offset = 0 } = {}) {
    isLoadingSessions.value = true
    error.value = null
    try {
      const params = new URLSearchParams({ limit, offset })
      if (domain) params.set('domain', domain)

      const res = await fetch(`${API_BASE}/api/memory/sessions?${params}`)
      const data = await res.json()
      sessions.value = data.sessions || []
    } catch (e) {
      error.value = e.message
    } finally {
      isLoadingSessions.value = false
    }
  }

  async function loadSessionDetail(sessionId) {
    try {
      const res = await fetch(`${API_BASE}/api/memory/sessions/${sessionId}`)
      const data = await res.json()
      selectedSession.value = data
      return data
    } catch (e) {
      error.value = e.message
      return null
    }
  }

  async function loadSystemStats() {
    try {
      const [statsRes, perfRes] = await Promise.all([
        fetch(`${API_BASE}/api/memory/stats`),
        fetch(`${API_BASE}/api/memory/performance?limit=30`),
      ])
      systemStats.value = await statsRes.json()
      const perfData = await perfRes.json()
      performanceData.value = perfData.snapshots || []
    } catch (e) {
      error.value = e.message
    }
  }

  async function loadProposals(status) {
    isLoadingProposals.value = true
    error.value = null
    try {
      const params = status ? `?status=${status}` : ''
      const res = await fetch(`${API_BASE}/api/improvement/proposals${params}`)
      const data = await res.json()
      proposals.value = data.proposals || []
    } catch (e) {
      error.value = e.message
    } finally {
      isLoadingProposals.value = false
    }
  }

  async function approveProposal(proposalId) {
    try {
      const res = await fetch(`${API_BASE}/api/improvement/proposals/${proposalId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      // Update in local list
      const idx = proposals.value.findIndex(p => p.id === proposalId)
      if (idx >= 0) proposals.value[idx] = data.proposal
      return data.proposal
    } catch (e) {
      error.value = e.message
      return null
    }
  }

  async function rejectProposal(proposalId, reason = '') {
    try {
      const res = await fetch(`${API_BASE}/api/improvement/proposals/${proposalId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      const data = await res.json()
      const idx = proposals.value.findIndex(p => p.id === proposalId)
      if (idx >= 0) proposals.value[idx] = data.proposal
      return data.proposal
    } catch (e) {
      error.value = e.message
      return null
    }
  }

  async function triggerSystemAnalysis() {
    isAnalyzing.value = true
    error.value = null
    try {
      const res = await fetch(`${API_BASE}/api/improvement/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      // Reload proposals
      await loadProposals()
      return data
    } catch (e) {
      error.value = e.message
      return null
    } finally {
      isAnalyzing.value = false
    }
  }

  // ── Formatting helpers ─────────────────────────────────────

  function formatDate(isoString) {
    if (!isoString) return '—'
    return new Date(isoString).toLocaleDateString('es-ES', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  }

  function formatTokens(n) {
    if (!n) return '0'
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
    return String(n)
  }

  function priorityColor(priority) {
    const map = { critical: '#fc814a', high: '#fbbf24', medium: '#667eea', low: '#48bb78' }
    return map[priority] || '#64748b'
  }

  function categoryIcon(category) {
    const map = {
      prompt_improvement: '📝',
      pipeline_modification: '⚙️',
      tool_enhancement: '🔧',
      knowledge_gap: '📚',
      quality_process: '✅',
    }
    return map[category] || '💡'
  }

  return {
    // State
    skills, sessions, proposals, systemStats, performanceData,
    selectedSkill, selectedSession,
    isLoadingSkills, isLoadingSessions, isLoadingProposals, isAnalyzing,
    error,
    // Computed
    pendingProposals, approvedProposals, avgQualityTrend,
    // Actions
    loadSkills, loadSkillDetail, loadSessions, loadSessionDetail,
    loadSystemStats, loadProposals, approveProposal, rejectProposal,
    triggerSystemAnalysis,
    // Helpers
    formatDate, formatTokens, priorityColor, categoryIcon,
  }
}
