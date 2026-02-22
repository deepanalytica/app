<template>
  <div class="app">
    <!-- ── Header ── -->
    <header class="app-header">
      <div class="header-brand">
        <div class="brand-icon">⚗️</div>
        <div class="brand-text">
          <div class="brand-name">ResearchOS</div>
          <div class="brand-tagline">Multi-Agent Scientific Research System</div>
        </div>
      </div>

      <!-- Main Nav Tabs -->
      <nav class="main-nav">
        <button
          v-for="tab in mainTabs"
          :key="tab.key"
          class="nav-tab"
          :class="{ active: mainTab === tab.key }"
          @click="mainTab = tab.key"
        >
          <span class="nav-icon">{{ tab.icon }}</span>
          {{ tab.label }}
          <span v-if="tab.badge" class="nav-badge">{{ tab.badge }}</span>
        </button>
      </nav>

      <div class="header-status" v-if="sessionId && mainTab === 'research'">
        <div class="connection-dot" :class="{ connected: isConnected }"></div>
        <span class="session-id">{{ sessionId.substring(0, 8) }}...</span>
      </div>

      <div class="header-actions">
        <div class="model-badge">
          <span class="model-dot"></span>
          claude-opus-4-6 · Adaptive Thinking
        </div>
        <button v-if="(isComplete || error) && mainTab === 'research'" @click="reset" class="btn-reset">
          🔄 New Research
        </button>
      </div>
    </header>

    <!-- ── Progress Bar ── -->
    <div class="progress-track" v-if="isResearching || isComplete">
      <div class="progress-fill" :style="{ width: `${progress}%` }"></div>
      <div class="progress-label">{{ progressMessage }}</div>
    </div>

    <!-- ── Phase Banner ── -->
    <div class="phase-banner" v-if="isResearching">
      <div class="phase-dot pulse"></div>
      <span class="phase-label">{{ phaseLabel }}</span>
      <div class="phase-separator">·</div>
      <span class="agent-count">{{ completedAgents }}/9 agents active</span>
    </div>

    <!-- ── Main Layout ── -->
    <main class="app-main" :class="{ 'full-panel': mainTab !== 'research' }">
      <!-- ── Full-width panels for non-research tabs ── -->
      <div v-if="mainTab === 'memory'" class="full-panel-content">
        <MemoryBrowser />
      </div>
      <div v-else-if="mainTab === 'history'" class="full-panel-content">
        <SessionHistory />
      </div>
      <div v-else-if="mainTab === 'intelligence'" class="full-panel-content">
        <SelfImprovementPanel />
      </div>

      <!-- LEFT: Research Config or Form (only in research tab) -->
      <aside class="sidebar sidebar-left" v-if="mainTab === 'research'">
        <div class="sidebar-inner">
          <ResearchForm
            v-if="!isResearching && !isComplete"
            :disabled="isResearching"
            @submit="handleStartResearch"
          />

          <!-- Metrics Panel (shown during/after research) -->
          <div v-else class="metrics-panel">
            <div class="metrics-header">
              <h3>Research Session</h3>
              <div class="phase-tag" :class="currentPhase">{{ phaseLabel }}</div>
            </div>

            <div class="metrics-grid">
              <div class="metric-card">
                <div class="metric-icon">📝</div>
                <div class="metric-value">{{ findings.length }}</div>
                <div class="metric-name">Findings</div>
              </div>
              <div class="metric-card">
                <div class="metric-icon">🎯</div>
                <div class="metric-value">{{ completedAgents }}</div>
                <div class="metric-name">Agents Done</div>
              </div>
              <div class="metric-card">
                <div class="metric-icon">⚡</div>
                <div class="metric-value">{{ formatTokens(metrics.totalTokens) }}</div>
                <div class="metric-name">Tokens Used</div>
              </div>
              <div class="metric-card" v-if="metrics.qualityScore > 0">
                <div class="metric-icon">⭐</div>
                <div class="metric-value">{{ metrics.qualityScore }}%</div>
                <div class="metric-name">Quality</div>
              </div>
            </div>

            <div class="session-topic" v-if="currentTopic">
              <div class="topic-label">Research Topic</div>
              <div class="topic-text">{{ currentTopic }}</div>
            </div>

            <button v-if="isComplete" @click="reset" class="btn-new-research">
              🔄 Start New Research
            </button>
          </div>
        </div>
      </aside>

      <!-- CENTER: Agent Dashboard (only in research tab) -->
      <section class="content-center" v-if="mainTab === 'research'">
        <div class="agents-grid-header">
          <h2>Research Team</h2>
          <div class="view-toggle">
            <button @click="centerView = 'agents'" :class="{ active: centerView === 'agents' }">Agents</button>
            <button @click="centerView = 'log'" :class="{ active: centerView === 'log' }">Live Log</button>
          </div>
        </div>

        <!-- Agents Grid -->
        <div v-if="centerView === 'agents'" class="agents-grid">
          <AgentCard
            v-for="(agent, role) in agents"
            :key="role"
            :role="role"
            :agent="agent"
          />
        </div>

        <!-- Live Log -->
        <div v-else class="live-log" ref="logRef">
          <div
            v-for="entry in streamLog.slice(-200).reverse()"
            :key="entry.id"
            class="log-entry"
            :class="entry.type"
          >
            <span class="log-agent">{{ logAgentLabel(entry.agent) }}</span>
            <span class="log-message">{{ entry.message }}</span>
          </div>
          <div v-if="streamLog.length === 0" class="log-empty">
            Waiting for research to begin...
          </div>
        </div>

        <!-- Error Display -->
        <div v-if="error" class="error-banner">
          <span class="error-icon">⚠️</span>
          <div class="error-content">
            <div class="error-title">Error Occurred</div>
            <div class="error-message">{{ error }}</div>
            <div class="error-hint">
              Make sure your ANTHROPIC_API_KEY is set and the backend server is running.
            </div>
          </div>
        </div>

        <!-- Complete Banner -->
        <div v-if="isComplete && !error" class="complete-banner">
          <div class="complete-icon">🎉</div>
          <div class="complete-content">
            <div class="complete-title">Research Complete!</div>
            <div class="complete-stats">
              {{ findings.length }} findings · {{ formatTokens(metrics.totalTokens) }} tokens ·
              Quality score: {{ metrics.qualityScore }}%
            </div>
          </div>
        </div>
      </section>

      <!-- RIGHT: Findings + Paper Viewer (only in research tab) -->
      <aside class="sidebar sidebar-right" v-if="mainTab === 'research'">
        <div class="sidebar-tabs">
          <button
            @click="rightPanel = 'findings'"
            class="tab-btn"
            :class="{ active: rightPanel === 'findings' }"
          >
            Findings <span class="tab-badge">{{ findings.length }}</span>
          </button>
          <button
            @click="rightPanel = 'paper'"
            class="tab-btn"
            :class="{ active: rightPanel === 'paper', highlight: !!paper }"
          >
            Paper {{ paper ? '✓' : '' }}
          </button>
        </div>

        <div class="tab-content">
          <FindingsPanel v-if="rightPanel === 'findings'" :findings="findings" />
          <PaperViewer v-else :paper="paper" :paperText="paperText" :bibliography="bibliography" />
        </div>
      </aside>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, watch } from 'vue'
import AgentCard from './components/AgentCard.vue'
import ResearchForm from './components/ResearchForm.vue'
import FindingsPanel from './components/FindingsPanel.vue'
import PaperViewer from './components/PaperViewer.vue'
import MemoryBrowser from './components/MemoryBrowser.vue'
import SessionHistory from './components/SessionHistory.vue'
import SelfImprovementPanel from './components/SelfImprovementPanel.vue'
import { useResearch } from './composables/useResearch'

const {
  sessionId, isConnected, isResearching, isComplete, error,
  currentPhase, progress, progressMessage, agents, findings,
  paper, paperText, bibliography, metrics, streamLog,
  phaseLabel, completedAgents,
  startResearch, reset,
} = useResearch()

// Main navigation tab
const mainTab = ref('research')

// Track pending improvement proposals from stream events
const pendingProposalCount = ref(0)

const mainTabs = computed(() => [
  { key: 'research', label: 'Research', icon: '🔬' },
  { key: 'history', label: 'History', icon: '📋' },
  { key: 'memory', label: 'Memory', icon: '🧠' },
  {
    key: 'intelligence',
    label: 'Intelligence',
    icon: '⚡',
    badge: pendingProposalCount.value > 0 ? pendingProposalCount.value : null,
  },
])

const centerView = ref('agents')
const rightPanel = ref('findings')
const logRef = ref(null)
const currentTopic = ref('')

function handleStartResearch(config) {
  currentTopic.value = config.topic
  startResearch(config)
  centerView.value = 'agents'
  mainTab.value = 'research'
}

function formatTokens(n) {
  if (!n) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

const agentShortNames = {
  research_director: 'Director',
  literature_reviewer: 'Literature',
  hypothesis_generator: 'Hypothesis',
  methodology_expert: 'Methods',
  data_analyst: 'Analysis',
  critical_reviewer: 'Review',
  synthesis_specialist: 'Synthesis',
  scientific_writer: 'Writer',
  citation_manager: 'Citations',
  system: 'System',
  orchestrator: 'Pipeline',
}

function logAgentLabel(agent) {
  return agentShortNames[agent] || agent || 'System'
}

// Auto-switch to paper tab when paper is ready
watch(paper, (val) => {
  if (val) rightPanel.value = 'paper'
})

// Track self-improvement proposals from stream events
watch(streamLog, (log) => {
  const latest = log[log.length - 1]
  if (latest?.type === 'finding' && latest?.data?.type === 'improvement_proposals') {
    pendingProposalCount.value += (latest.data.count || 0)
  }
}, { deep: true })

// Reset badge when visiting intelligence tab
watch(mainTab, (tab) => {
  if (tab === 'intelligence') pendingProposalCount.value = 0
})
</script>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  --bg: #080c14;
  --surface: #0e1520;
  --surface2: #141c28;
  --border: rgba(255, 255, 255, 0.07);
  --text: #e2e8f0;
  --text-muted: #64748b;
  --accent: #667eea;
  --accent2: #9a75ff;
  --success: #48bb78;
  --warning: #fbbf24;
  --error: #fc814a;
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  overflow: hidden;
  height: 100vh;
}

#app {
  height: 100vh;
}

.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

/* ── Header ── */
.app-header {
  display: flex;
  align-items: center;
  padding: 0 16px;
  height: 56px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  gap: 16px;
  flex-shrink: 0;
  z-index: 10;
}

/* ── Main Nav ── */
.main-nav {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: 1;
  justify-content: center;
}

.nav-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  background: none;
  border: none;
  border-radius: 8px;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  position: relative;
}

.nav-tab:hover {
  color: var(--text);
  background: rgba(255, 255, 255, 0.05);
}

.nav-tab.active {
  color: var(--accent);
  background: rgba(102, 126, 234, 0.12);
}

.nav-icon { font-size: 15px; }

.nav-badge {
  position: absolute;
  top: 3px;
  right: 6px;
  background: var(--error);
  color: white;
  font-size: 9px;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 8px;
  min-width: 16px;
  text-align: center;
}

/* ── Full-panel mode ── */
.app-main.full-panel {
  display: flex;
}

.full-panel-content {
  flex: 1;
  padding: 20px 24px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand-icon {
  font-size: 24px;
}

.brand-name {
  font-size: 16px;
  font-weight: 800;
  background: linear-gradient(135deg, #667eea, #9a75ff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.brand-tagline {
  font-size: 11px;
  color: var(--text-muted);
}

.header-status {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

.connection-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #374151;
}

.connection-dot.connected {
  background: var(--success);
  box-shadow: 0 0 8px rgba(72, 187, 120, 0.5);
}

.session-id {
  font-size: 11px;
  color: var(--text-muted);
  font-family: monospace;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
}

.model-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text-muted);
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 4px 12px;
}

.model-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #9a75ff;
  animation: pulse-glow 2s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.btn-reset {
  background: rgba(255,255,255,0.06);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  font-size: 12px;
  padding: 6px 14px;
  cursor: pointer;
}

/* ── Progress ── */
.progress-track {
  height: 3px;
  background: rgba(255,255,255,0.05);
  position: relative;
  flex-shrink: 0;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea, #9a75ff, #63b3ed);
  transition: width 0.8s ease;
  border-radius: 0 2px 2px 0;
}

.progress-label {
  position: absolute;
  right: 12px;
  top: 6px;
  font-size: 10px;
  color: var(--text-muted);
  white-space: nowrap;
}

/* ── Phase Banner ── */
.phase-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 20px;
  background: rgba(102, 126, 234, 0.06);
  border-bottom: 1px solid rgba(102, 126, 234, 0.1);
  font-size: 12px;
  color: #94a3b8;
  flex-shrink: 0;
}

.phase-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #667eea;
}

.phase-dot.pulse {
  animation: pulseDot 1.5s ease-in-out infinite;
}

@keyframes pulseDot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.5); }
}

.phase-label {
  color: #667eea;
  font-weight: 600;
}

.phase-separator { color: rgba(255,255,255,0.2); }

/* ── Main Layout ── */
.app-main {
  display: grid;
  grid-template-columns: 340px 1fr 360px;
  flex: 1;
  overflow: hidden;
}

.sidebar {
  background: var(--surface);
  border-right: 1px solid var(--border);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.sidebar-right {
  border-right: none;
  border-left: 1px solid var(--border);
}

.sidebar-inner {
  overflow-y: auto;
  height: 100%;
}

/* ── Content Center ── */
.content-center {
  background: var(--bg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 20px;
  gap: 16px;
}

.agents-grid-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.agents-grid-header h2 {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
}

.view-toggle {
  display: flex;
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
}

.view-toggle button {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 12px;
  padding: 5px 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.view-toggle button.active {
  background: rgba(102, 126, 234, 0.2);
  color: #667eea;
}

.agents-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  overflow-y: auto;
  flex: 1;
}

/* ── Live Log ── */
.live-log {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column-reverse;
  gap: 2px;
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 11px;
}

.log-entry {
  display: flex;
  gap: 8px;
  padding: 3px 4px;
  border-radius: 4px;
  line-height: 1.4;
}

.log-entry.error { background: rgba(252, 129, 74, 0.08); }
.log-entry.complete { background: rgba(72, 187, 120, 0.06); }
.log-entry.phase { background: rgba(102, 126, 234, 0.06); }

.log-agent {
  color: #9a75ff;
  flex-shrink: 0;
  font-weight: 600;
  min-width: 80px;
}

.log-message {
  color: #475569;
  word-break: break-word;
}

.log-entry.error .log-message { color: #fc814a; }
.log-entry.phase .log-message { color: #667eea; }

.log-empty {
  color: var(--text-muted);
  font-size: 12px;
  padding: 20px;
  text-align: center;
}

/* ── Error Banner ── */
.error-banner {
  background: rgba(252, 129, 74, 0.08);
  border: 1px solid rgba(252, 129, 74, 0.2);
  border-radius: 10px;
  padding: 16px;
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.error-icon { font-size: 20px; }

.error-title {
  font-weight: 700;
  color: #fc814a;
  margin-bottom: 4px;
}

.error-message {
  font-size: 13px;
  color: #f97316;
  margin-bottom: 6px;
}

.error-hint {
  font-size: 11px;
  color: #92400e;
}

/* ── Complete Banner ── */
.complete-banner {
  background: rgba(72, 187, 120, 0.08);
  border: 1px solid rgba(72, 187, 120, 0.2);
  border-radius: 10px;
  padding: 16px;
  display: flex;
  gap: 12px;
  align-items: center;
}

.complete-icon { font-size: 28px; }

.complete-title {
  font-size: 16px;
  font-weight: 700;
  color: #48bb78;
}

.complete-stats {
  font-size: 12px;
  color: #4ade80;
  margin-top: 4px;
}

/* ── Metrics Panel ── */
.metrics-panel {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.metrics-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.metrics-header h3 {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
}

.phase-tag {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 20px;
  background: rgba(102, 126, 234, 0.15);
  color: #667eea;
}

.metrics-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.metric-card {
  background: rgba(255,255,255,0.03);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  text-align: center;
}

.metric-icon { font-size: 18px; }

.metric-value {
  font-size: 22px;
  font-weight: 800;
  color: var(--text);
}

.metric-name {
  font-size: 11px;
  color: var(--text-muted);
}

.session-topic {
  background: rgba(255,255,255,0.03);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px;
}

.topic-label {
  font-size: 10px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 6px;
}

.topic-text {
  font-size: 13px;
  color: var(--text);
  line-height: 1.5;
  font-weight: 500;
}

.btn-new-research {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 10px;
  color: white;
  font-size: 13px;
  font-weight: 700;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s;
  width: 100%;
}

.btn-new-research:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

/* ── Right Tabs ── */
.sidebar-tabs {
  display: flex;
  border-bottom: 1px solid var(--border);
}

.tab-btn {
  flex: 1;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  padding: 12px 16px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.tab-btn.active {
  border-bottom-color: #667eea;
  color: var(--text);
}

.tab-btn.highlight {
  color: #48bb78;
}

.tab-badge {
  background: rgba(154, 117, 255, 0.2);
  color: #9a75ff;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 10px;
}

.tab-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* ── Scrollbar ── */
::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.1);
  border-radius: 2px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(255,255,255,0.2);
}
</style>
