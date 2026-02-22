<template>
  <div class="si-panel">
    <!-- Header -->
    <div class="si-header">
      <div class="si-title-row">
        <h2>System Intelligence</h2>
        <div class="si-badge" v-if="pendingProposals.length > 0">
          {{ pendingProposals.length }} pending review
        </div>
      </div>
      <p class="si-desc">
        After each research session, the system analyzes its own performance and proposes improvements.
        Nothing is applied without your explicit approval.
      </p>
    </div>

    <!-- Stats Bar -->
    <div class="si-stats" v-if="systemStats">
      <div class="si-stat">
        <div class="si-stat-val">{{ systemStats.avgQualityScore }}</div>
        <div class="si-stat-label">Avg Quality</div>
      </div>
      <div class="si-stat">
        <div class="si-stat-val" :class="trendClass">
          {{ avgQualityTrend ? (avgQualityTrend.delta > 0 ? '+' : '') + avgQualityTrend.delta : '—' }}
        </div>
        <div class="si-stat-label">Trend</div>
      </div>
      <div class="si-stat">
        <div class="si-stat-val">{{ systemStats.totalProposals }}</div>
        <div class="si-stat-label">Total Proposals</div>
      </div>
      <div class="si-stat">
        <div class="si-stat-val approved">{{ approvedProposals.length }}</div>
        <div class="si-stat-label">Approved</div>
      </div>
      <button class="analyze-btn" @click="runAnalysis" :disabled="isAnalyzing">
        <span v-if="isAnalyzing" class="spinner-small"></span>
        {{ isAnalyzing ? 'Analyzing...' : '⚡ Analyze System' }}
      </button>
    </div>

    <!-- Quality Trend Chart (simple ASCII-style) -->
    <div class="trend-section" v-if="performanceData.length >= 2">
      <div class="trend-label">Quality Trend (last {{ Math.min(10, performanceData.length) }} sessions)</div>
      <div class="trend-bars">
        <div
          v-for="(snap, i) in performanceData.slice(0, 10).reverse()"
          :key="i"
          class="trend-bar-wrap"
        >
          <div
            class="trend-bar"
            :style="{ height: `${snap.overallQuality}%`, background: barColor(snap.overallQuality) }"
            :title="`${snap.topic} — Quality: ${snap.overallQuality}`"
          ></div>
          <div class="trend-bar-val">{{ snap.overallQuality }}</div>
        </div>
      </div>
    </div>

    <!-- Filter Tabs -->
    <div class="si-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="si-tab"
        :class="{ active: activeTab === tab.key }"
        @click="switchTab(tab.key)"
      >
        {{ tab.label }}
        <span class="tab-count" v-if="countFor(tab.key) > 0">{{ countFor(tab.key) }}</span>
      </button>
    </div>

    <!-- Loading -->
    <div v-if="isLoadingProposals" class="si-loading">
      <div class="spinner"></div>
      <span>Loading proposals...</span>
    </div>

    <!-- Proposal List -->
    <div v-else class="proposals-list">
      <div v-if="filteredProposals.length === 0" class="no-proposals">
        <div class="no-icon">{{ activeTab === 'pending' ? '🎯' : '📋' }}</div>
        <div>{{ activeTab === 'pending' ? 'No pending proposals. Run a research session to generate improvement suggestions.' : 'No proposals in this category.' }}</div>
      </div>

      <div
        v-for="proposal in filteredProposals"
        :key="proposal.id"
        class="proposal-card"
        :class="[proposal.status, proposal.priority]"
      >
        <!-- Card Header -->
        <div class="proposal-header">
          <div class="proposal-meta">
            <span class="proposal-icon">{{ categoryIcon(proposal.category) }}</span>
            <span class="proposal-category">{{ formatCategory(proposal.category) }}</span>
            <span class="proposal-priority" :style="{ color: priorityColor(proposal.priority) }">
              {{ proposal.priority.toUpperCase() }}
            </span>
          </div>
          <div class="proposal-impact">
            <span class="impact-label">Impact</span>
            <div class="impact-bar">
              <div class="impact-fill" :style="{ width: `${proposal.estimatedImpact}%`, background: impactColor(proposal.estimatedImpact) }"></div>
            </div>
            <span class="impact-val">{{ proposal.estimatedImpact }}%</span>
          </div>
        </div>

        <div class="proposal-title">{{ proposal.title }}</div>

        <!-- Collapsible details -->
        <div class="proposal-body" v-if="expanded[proposal.id]">
          <div class="proposal-field">
            <div class="field-label">Observed Problem</div>
            <div class="field-text problem">{{ proposal.observedProblem }}</div>
          </div>
          <div class="proposal-field">
            <div class="field-label">Proposed Change</div>
            <div class="field-text change">{{ proposal.proposedChange }}</div>
          </div>
          <div class="proposal-field">
            <div class="field-label">Expected Improvement</div>
            <div class="field-text improvement">{{ proposal.expectedImprovement }}</div>
          </div>
          <div v-if="proposal.affectedAgent" class="proposal-field">
            <div class="field-label">Affects Agent</div>
            <div class="field-text agent-tag">{{ proposal.affectedAgent }}</div>
          </div>
          <!-- Prompt diff -->
          <div v-if="proposal.promptBefore && proposal.promptAfter" class="prompt-diff">
            <div class="diff-label">Prompt Change</div>
            <div class="diff-before">
              <div class="diff-tag">BEFORE</div>
              <pre class="diff-text">{{ proposal.promptBefore }}</pre>
            </div>
            <div class="diff-after">
              <div class="diff-tag">AFTER</div>
              <pre class="diff-text">{{ proposal.promptAfter }}</pre>
            </div>
          </div>
          <div class="proposal-field">
            <div class="field-label">Rationale</div>
            <div class="field-text">{{ proposal.rationale }}</div>
          </div>
          <div class="proposal-field confidence">
            <div class="field-label">Agent Confidence</div>
            <div class="confidence-bar">
              <div class="confidence-fill" :style="{ width: `${proposal.confidence * 100}%` }"></div>
            </div>
            <span class="confidence-val">{{ Math.round(proposal.confidence * 100) }}%</span>
          </div>
        </div>

        <!-- Actions -->
        <div class="proposal-footer">
          <button class="btn-expand" @click="toggleExpand(proposal.id)">
            {{ expanded[proposal.id] ? '▲ Less' : '▼ Details' }}
          </button>

          <div class="proposal-actions" v-if="proposal.status === 'pending'">
            <button class="btn-reject" @click="doReject(proposal.id)">
              Reject
            </button>
            <button class="btn-approve" @click="doApprove(proposal.id)">
              ✓ Approve & Apply
            </button>
          </div>
          <div class="status-badge" v-else :class="proposal.status">
            {{ proposal.status === 'approved' ? '✓ Approved' : '✗ Rejected' }}
            <span v-if="proposal.rejectionReason" class="rejection-reason"> — {{ proposal.rejectionReason }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useMemory } from '../composables/useMemory'

const {
  proposals, systemStats, performanceData,
  pendingProposals, approvedProposals, avgQualityTrend,
  isLoadingProposals, isAnalyzing,
  loadProposals, loadSystemStats, approveProposal, rejectProposal, triggerSystemAnalysis,
  categoryIcon, priorityColor, formatDate,
} = useMemory()

const activeTab = ref('pending')
const expanded = ref({})

const tabs = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
]

const filteredProposals = computed(() => {
  if (activeTab.value === 'all') return proposals.value
  return proposals.value.filter(p => p.status === activeTab.value)
})

const trendClass = computed(() => {
  if (!avgQualityTrend.value) return ''
  return avgQualityTrend.value.delta > 0 ? 'trend-up' : avgQualityTrend.value.delta < 0 ? 'trend-down' : ''
})

function countFor(tab) {
  if (tab === 'all') return proposals.value.length
  return proposals.value.filter(p => p.status === tab).length
}

onMounted(async () => {
  await Promise.all([loadProposals(), loadSystemStats()])
})

async function switchTab(tab) {
  activeTab.value = tab
}

function toggleExpand(id) {
  expanded.value[id] = !expanded.value[id]
}

async function doApprove(id) {
  await approveProposal(id)
}

async function doReject(id) {
  const reason = prompt('Rejection reason (optional):') || ''
  await rejectProposal(id, reason)
}

async function runAnalysis() {
  await triggerSystemAnalysis()
}

function formatCategory(cat) {
  return cat.replace(/_/g, ' ')
}

function barColor(quality) {
  if (quality >= 80) return '#48bb78'
  if (quality >= 60) return '#667eea'
  return '#fbbf24'
}

function impactColor(impact) {
  if (impact >= 70) return '#48bb78'
  if (impact >= 40) return '#667eea'
  return '#fbbf24'
}
</script>

<style scoped>
.si-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: hidden;
}

.si-header { flex-shrink: 0; }
.si-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 6px;
}
.si-title-row h2 { font-size: 18px; font-weight: 600; color: var(--text); }
.si-badge {
  padding: 3px 10px;
  background: rgba(252, 129, 74, 0.15);
  border: 1px solid rgba(252, 129, 74, 0.3);
  border-radius: 20px;
  font-size: 11px;
  color: var(--error);
  animation: pulse-badge 2s infinite;
}
@keyframes pulse-badge { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }
.si-desc { font-size: 12px; color: var(--text-muted); line-height: 1.5; }

.si-stats {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  background: var(--surface2);
  border-radius: 10px;
  border: 1px solid var(--border);
}
.si-stat { text-align: center; min-width: 60px; }
.si-stat-val { font-size: 20px; font-weight: 700; color: var(--text); }
.si-stat-val.approved { color: var(--success); }
.si-stat-val.trend-up { color: var(--success); }
.si-stat-val.trend-down { color: var(--error); }
.si-stat-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }

.analyze-btn {
  margin-left: auto;
  padding: 8px 16px;
  background: linear-gradient(135deg, var(--accent), var(--accent2));
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: opacity 0.2s;
}
.analyze-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.spinner-small {
  width: 12px; height: 12px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.trend-section { flex-shrink: 0; }
.trend-label { font-size: 11px; color: var(--text-muted); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
.trend-bars {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 60px;
}
.trend-bar-wrap { display: flex; flex-direction: column; align-items: center; gap: 3px; flex: 1; }
.trend-bar { width: 100%; border-radius: 3px 3px 0 0; min-height: 3px; transition: height 0.3s; }
.trend-bar-val { font-size: 9px; color: var(--text-muted); }

.si-tabs {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border);
  padding-bottom: 0;
}
.si-tab {
  padding: 6px 14px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-muted);
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: color 0.2s;
}
.si-tab.active { color: var(--accent); border-bottom-color: var(--accent); }
.tab-count {
  background: rgba(102,126,234,0.15);
  color: var(--accent);
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 10px;
}

.si-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--text-muted);
  padding: 40px;
}
.spinner { width: 20px; height: 20px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; }

.proposals-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-right: 4px;
}

.no-proposals {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px;
  color: var(--text-muted);
  font-size: 13px;
  text-align: center;
}
.no-icon { font-size: 36px; }

.proposal-card {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px;
  transition: border-color 0.2s;
}
.proposal-card.pending { border-left: 3px solid var(--warning); }
.proposal-card.approved { border-left: 3px solid var(--success); }
.proposal-card.rejected { border-left: 3px solid var(--text-muted); opacity: 0.7; }

.proposal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.proposal-meta { display: flex; align-items: center; gap: 8px; }
.proposal-icon { font-size: 14px; }
.proposal-category { font-size: 11px; color: var(--text-muted); text-transform: capitalize; }
.proposal-priority { font-size: 10px; font-weight: 700; letter-spacing: 0.5px; }

.proposal-impact { display: flex; align-items: center; gap: 6px; }
.impact-label { font-size: 10px; color: var(--text-muted); }
.impact-bar { width: 60px; height: 4px; background: var(--border); border-radius: 2px; overflow: hidden; }
.impact-fill { height: 100%; border-radius: 2px; transition: width 0.3s; }
.impact-val { font-size: 11px; color: var(--text-muted); min-width: 28px; }

.proposal-title { font-size: 13px; font-weight: 600; color: var(--text); line-height: 1.4; margin-bottom: 10px; }

.proposal-body { display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px; }
.proposal-field {}
.field-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
  margin-bottom: 4px;
}
.field-text {
  font-size: 12px;
  color: var(--text);
  line-height: 1.5;
  padding: 8px 10px;
  background: rgba(255,255,255,0.03);
  border-radius: 6px;
  border-left: 2px solid var(--border);
}
.field-text.problem { border-color: var(--error); }
.field-text.change { border-color: var(--accent); }
.field-text.improvement { border-color: var(--success); }
.field-text.agent-tag {
  display: inline-block;
  font-size: 11px;
  padding: 2px 8px;
  background: rgba(102,126,234,0.1);
  border: 1px solid rgba(102,126,234,0.2);
  border-radius: 4px;
  color: var(--accent);
}

.prompt-diff { display: flex; flex-direction: column; gap: 6px; }
.diff-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 2px; }
.diff-before, .diff-after { border-radius: 6px; overflow: hidden; }
.diff-tag {
  font-size: 10px;
  font-weight: 700;
  padding: 3px 8px;
  letter-spacing: 0.5px;
}
.diff-before .diff-tag { background: rgba(252,129,74,0.15); color: var(--error); }
.diff-after .diff-tag { background: rgba(72,187,120,0.15); color: var(--success); }
.diff-text {
  font-size: 11px;
  font-family: monospace;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--text);
  padding: 8px;
  background: rgba(255,255,255,0.02);
  margin: 0;
  max-height: 120px;
  overflow-y: auto;
}

.confidence { flex-direction: row !important; align-items: center; gap: 8px; }
.confidence .field-label { margin-bottom: 0; min-width: 120px; }
.confidence-bar { flex: 1; height: 4px; background: var(--border); border-radius: 2px; overflow: hidden; }
.confidence-fill { height: 100%; background: var(--accent2); border-radius: 2px; }
.confidence-val { font-size: 11px; color: var(--text-muted); min-width: 30px; }

.proposal-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.btn-expand {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 11px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}
.btn-expand:hover { background: rgba(255,255,255,0.05); color: var(--text); }

.proposal-actions { display: flex; gap: 8px; }
.btn-reject {
  padding: 6px 14px;
  background: none;
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-reject:hover { border-color: var(--error); color: var(--error); }

.btn-approve {
  padding: 6px 16px;
  background: rgba(72,187,120,0.15);
  border: 1px solid rgba(72,187,120,0.3);
  border-radius: 6px;
  color: var(--success);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-approve:hover { background: rgba(72,187,120,0.25); }

.status-badge {
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 6px;
}
.status-badge.approved { color: var(--success); background: rgba(72,187,120,0.1); }
.status-badge.rejected { color: var(--text-muted); background: rgba(255,255,255,0.05); }
.rejection-reason { font-weight: 400; font-size: 11px; }
</style>
