<template>
  <div class="session-history">
    <!-- Header -->
    <div class="sh-header">
      <div class="sh-title-row">
        <h2>Session History</h2>
        <div class="sh-count" v-if="sessions.length > 0">
          {{ sessions.length }} session{{ sessions.length !== 1 ? 's' : '' }}
        </div>
      </div>
      <div class="sh-filters">
        <select v-model="domainFilter" @change="onFilter" class="domain-select">
          <option value="">All domains</option>
          <option v-for="domain in availableDomains" :key="domain" :value="domain">{{ domain }}</option>
        </select>
        <select v-model="sortBy" class="sort-select">
          <option value="date">Sort: Latest First</option>
          <option value="quality">Sort: Best Quality</option>
          <option value="tokens">Sort: Most Tokens</option>
        </select>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoadingSessions" class="sh-loading">
      <div class="spinner"></div>
      <span>Loading session history...</span>
    </div>

    <!-- Empty state -->
    <div v-else-if="sessions.length === 0" class="sh-empty">
      <div class="empty-icon">📋</div>
      <div class="empty-title">No sessions recorded yet</div>
      <div class="empty-desc">Complete a research session to build your history. All sessions are automatically saved with full findings and paper.</div>
    </div>

    <!-- Sessions list -->
    <div v-else class="sessions-container">
      <!-- Summary cards -->
      <div class="sessions-list">
        <div
          v-for="session in sortedSessions"
          :key="session.id"
          class="session-card"
          :class="{ selected: selectedSession?.id === session.id, 'has-paper': session.hasPaper }"
          @click="openSession(session.id)"
        >
          <div class="session-card-top">
            <div class="session-domain">{{ session.domain }}</div>
            <div class="session-status-row">
              <div class="session-quality" :class="qualityClass(session.qualityScore)">
                {{ session.qualityScore }}<span class="quality-unit">/100</span>
              </div>
              <div class="session-paper-badge" v-if="session.hasPaper">Paper ✓</div>
              <div class="session-skill-badge" v-if="session.skillExtracted">Skill ✓</div>
            </div>
          </div>

          <div class="session-topic">{{ session.topic }}</div>
          <div class="session-question">{{ session.researchQuestion }}</div>

          <div class="session-meta">
            <span class="meta-item">{{ formatDate(session.startTime) }}</span>
            <span class="meta-sep">·</span>
            <span class="meta-item">{{ session.findingsCount }} findings</span>
            <span class="meta-sep">·</span>
            <span class="meta-item">{{ formatTokens(session.totalTokens) }} tokens</span>
            <span class="meta-sep" v-if="session.estimatedCost">·</span>
            <span class="meta-item cost" v-if="session.estimatedCost">${{ session.estimatedCost.toFixed(3) }}</span>
          </div>

          <div class="session-duration" v-if="session.endTime">
            {{ duration(session.startTime, session.endTime) }}
          </div>
        </div>
      </div>

      <!-- Detail Panel -->
      <transition name="slide">
        <div v-if="selectedSession" class="session-detail">
          <div class="detail-top">
            <div class="detail-domain">{{ selectedSession.domain }}</div>
            <button class="detail-close" @click="selectedSession = null">×</button>
          </div>

          <h3 class="detail-topic">{{ selectedSession.topic }}</h3>
          <p class="detail-question">{{ selectedSession.researchQuestion }}</p>

          <div class="detail-metrics">
            <div class="detail-metric">
              <div class="dm-val" :class="qualityClass(selectedSession.metadata?.qualityScore)">
                {{ selectedSession.metadata?.qualityScore }}/100
              </div>
              <div class="dm-label">Quality</div>
            </div>
            <div class="detail-metric">
              <div class="dm-val">{{ selectedSession.findingsCount }}</div>
              <div class="dm-label">Findings</div>
            </div>
            <div class="detail-metric">
              <div class="dm-val">{{ selectedSession.citationsCount }}</div>
              <div class="dm-label">Citations</div>
            </div>
            <div class="detail-metric">
              <div class="dm-val">{{ formatTokens(selectedSession.metadata?.totalTokens) }}</div>
              <div class="dm-label">Tokens</div>
            </div>
          </div>

          <div class="detail-dates">
            <span>Started: {{ formatDate(selectedSession.startTime) }}</span>
            <span v-if="selectedSession.endTime">
              · Completed: {{ formatDate(selectedSession.endTime) }}
              · Duration: {{ duration(selectedSession.startTime, selectedSession.endTime) }}
            </span>
          </div>

          <!-- Top Findings Preview -->
          <div class="detail-section" v-if="selectedSession.findings?.length > 0">
            <div class="detail-label">Top Findings</div>
            <div class="finding-list">
              <div
                v-for="(f, i) in selectedSession.findings.slice(0, 6)"
                :key="i"
                class="finding-item"
              >
                <div class="finding-agent">{{ shortRole(f.agentRole) }}</div>
                <div class="finding-content">
                  <div class="finding-title">{{ f.title }}</div>
                  <div class="finding-confidence">
                    <div class="conf-bar">
                      <div class="conf-fill" :style="{ width: `${f.confidence * 100}%` }"></div>
                    </div>
                    <span>{{ Math.round(f.confidence * 100) }}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Status chips -->
          <div class="detail-chips">
            <div class="chip" :class="{ active: selectedSession.hasPaper }">
              {{ selectedSession.hasPaper ? '✓' : '○' }} Paper Generated
            </div>
            <div class="chip" :class="{ active: selectedSession.skillExtracted }">
              {{ selectedSession.skillExtracted ? '✓' : '○' }} Knowledge Extracted
            </div>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useMemory } from '../composables/useMemory'

const {
  sessions, isLoadingSessions, selectedSession,
  loadSessions, loadSessionDetail, loadSystemStats, systemStats,
  formatDate, formatTokens,
} = useMemory()

const domainFilter = ref('')
const sortBy = ref('date')

const availableDomains = computed(() => {
  if (!systemStats.value) return []
  return systemStats.value.domainsExplored || []
})

const sortedSessions = computed(() => {
  const list = [...sessions.value]
  if (sortBy.value === 'quality') return list.sort((a, b) => b.qualityScore - a.qualityScore)
  if (sortBy.value === 'tokens') return list.sort((a, b) => b.totalTokens - a.totalTokens)
  return list // already sorted by date desc from API
})

onMounted(async () => {
  await Promise.all([loadSessions(), loadSystemStats()])
})

async function onFilter() {
  await loadSessions({ domain: domainFilter.value || undefined })
}

async function openSession(id) {
  await loadSessionDetail(id)
}

function qualityClass(score) {
  if (score >= 80) return 'quality-high'
  if (score >= 60) return 'quality-mid'
  return 'quality-low'
}

function duration(start, end) {
  if (!start || !end) return ''
  const ms = new Date(end) - new Date(start)
  const mins = Math.floor(ms / 60000)
  const secs = Math.floor((ms % 60000) / 1000)
  if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`
  if (mins > 0) return `${mins}m ${secs}s`
  return `${secs}s`
}

const shortRoleMap = {
  research_director: 'Director',
  literature_reviewer: 'Literature',
  hypothesis_generator: 'Hypothesis',
  methodology_expert: 'Methodology',
  data_analyst: 'Data',
  critical_reviewer: 'Review',
  synthesis_specialist: 'Synthesis',
  scientific_writer: 'Writer',
  citation_manager: 'Citations',
}

function shortRole(role) {
  return shortRoleMap[role] || role
}
</script>

<style scoped>
.session-history {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: hidden;
}

.sh-header { flex-shrink: 0; }
.sh-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.sh-title-row h2 { font-size: 18px; font-weight: 600; color: var(--text); }
.sh-count {
  padding: 2px 10px;
  background: rgba(102, 126, 234, 0.1);
  border: 1px solid rgba(102, 126, 234, 0.2);
  border-radius: 20px;
  font-size: 11px;
  color: var(--accent);
}

.sh-filters { display: flex; gap: 8px; }
.domain-select, .sort-select {
  padding: 7px 12px;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  font-size: 12px;
  outline: none;
  cursor: pointer;
}

.sh-loading, .sh-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 20px;
  color: var(--text-muted);
  text-align: center;
}
.empty-icon { font-size: 36px; }
.empty-title { font-size: 16px; font-weight: 600; color: var(--text); }
.empty-desc { font-size: 13px; color: var(--text-muted); max-width: 360px; line-height: 1.6; }

.spinner {
  width: 20px; height: 20px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.sessions-container {
  flex: 1;
  display: flex;
  gap: 16px;
  overflow: hidden;
  position: relative;
}

.sessions-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-right: 4px;
}

.session-card {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px;
  cursor: pointer;
  transition: border-color 0.2s, transform 0.15s;
}
.session-card:hover { border-color: rgba(102, 126, 234, 0.3); transform: translateX(2px); }
.session-card.selected { border-color: var(--accent); background: rgba(102, 126, 234, 0.06); }
.session-card.has-paper { border-left: 3px solid var(--success); }

.session-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.session-domain {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--accent);
  background: rgba(102, 126, 234, 0.1);
  padding: 2px 8px;
  border-radius: 4px;
}
.session-status-row { display: flex; align-items: center; gap: 6px; }
.session-quality {
  font-size: 14px;
  font-weight: 700;
}
.quality-unit { font-size: 10px; font-weight: 400; }
.quality-high { color: var(--success); }
.quality-mid { color: var(--warning); }
.quality-low { color: var(--error); }

.session-paper-badge, .session-skill-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
}
.session-paper-badge {
  background: rgba(72, 187, 120, 0.12);
  color: var(--success);
  border: 1px solid rgba(72, 187, 120, 0.2);
}
.session-skill-badge {
  background: rgba(102, 126, 234, 0.12);
  color: var(--accent);
  border: 1px solid rgba(102, 126, 234, 0.2);
}

.session-topic { font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 4px; line-height: 1.4; }
.session-question { font-size: 11px; color: var(--text-muted); margin-bottom: 8px; line-height: 1.4; }
.session-meta { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--text-muted); }
.meta-sep { opacity: 0.4; }
.meta-item.cost { color: var(--warning); }
.session-duration { font-size: 10px; color: var(--text-muted); margin-top: 4px; }

/* Detail panel */
.session-detail {
  width: 380px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 18px;
  overflow-y: auto;
  flex-shrink: 0;
}

.slide-enter-active, .slide-leave-active { transition: opacity 0.2s, transform 0.2s; }
.slide-enter-from, .slide-leave-to { opacity: 0; transform: translateX(20px); }

.detail-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.detail-domain {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--accent);
  background: rgba(102,126,234,0.1);
  padding: 2px 8px;
  border-radius: 4px;
}
.detail-close {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 20px;
  line-height: 1;
}

.detail-topic { font-size: 15px; font-weight: 600; color: var(--text); margin-bottom: 6px; line-height: 1.4; }
.detail-question { font-size: 12px; color: var(--text-muted); margin-bottom: 14px; line-height: 1.5; }

.detail-metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 12px;
  padding: 12px;
  background: var(--surface2);
  border-radius: 8px;
}
.detail-metric { text-align: center; }
.dm-val { font-size: 16px; font-weight: 700; }
.dm-val.quality-high { color: var(--success); }
.dm-val.quality-mid { color: var(--warning); }
.dm-val.quality-low { color: var(--error); }
.dm-label { font-size: 10px; color: var(--text-muted); margin-top: 2px; }

.detail-dates { font-size: 11px; color: var(--text-muted); margin-bottom: 14px; }

.detail-section { margin-bottom: 14px; }
.detail-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
  margin-bottom: 8px;
}

.finding-list { display: flex; flex-direction: column; gap: 6px; }
.finding-item {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 8px;
  background: var(--surface2);
  border-radius: 6px;
}
.finding-agent {
  font-size: 10px;
  color: var(--accent);
  background: rgba(102,126,234,0.1);
  padding: 2px 6px;
  border-radius: 3px;
  flex-shrink: 0;
  white-space: nowrap;
}
.finding-content { flex: 1; }
.finding-title { font-size: 11px; color: var(--text); line-height: 1.4; margin-bottom: 4px; }
.finding-confidence { display: flex; align-items: center; gap: 6px; }
.conf-bar { flex: 1; height: 3px; background: var(--border); border-radius: 2px; overflow: hidden; }
.conf-fill { height: 100%; background: var(--accent); border-radius: 2px; }
.finding-confidence span { font-size: 10px; color: var(--text-muted); min-width: 26px; }

.detail-chips { display: flex; gap: 8px; }
.chip {
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid var(--border);
  color: var(--text-muted);
  background: var(--surface2);
}
.chip.active { color: var(--success); border-color: rgba(72,187,120,0.3); background: rgba(72,187,120,0.08); }
</style>
