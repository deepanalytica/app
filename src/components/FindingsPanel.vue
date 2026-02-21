<template>
  <div class="findings-panel">
    <div class="panel-header">
      <h3>Research Findings</h3>
      <div class="findings-count">{{ findings.length }}</div>
    </div>

    <div class="filter-bar">
      <button
        v-for="f in filters"
        :key="f.value"
        @click="activeFilter = f.value"
        class="filter-btn"
        :class="{ active: activeFilter === f.value }"
      >{{ f.label }}</button>
    </div>

    <div class="findings-list" ref="listRef">
      <div v-if="filteredFindings.length === 0" class="empty-state">
        <div class="empty-icon">🔍</div>
        <p>Findings will appear here as agents complete their research...</p>
      </div>

      <transition-group name="finding" tag="div">
        <div
          v-for="finding in filteredFindings"
          :key="finding.id"
          class="finding-card"
          :class="finding.agentRole"
        >
          <div class="finding-header">
            <div class="finding-icon">{{ agentIcons[finding.agentRole] }}</div>
            <div class="finding-meta">
              <div class="finding-title">{{ finding.title }}</div>
              <div class="finding-agent">{{ agentNames[finding.agentRole] }}</div>
            </div>
            <div class="confidence-badge" :style="confidenceStyle(finding.confidence)">
              {{ Math.round(finding.confidence * 100) }}%
            </div>
          </div>

          <div class="finding-body" :class="{ expanded: expandedId === finding.id }">
            <div class="finding-preview">{{ previewContent(finding.content) }}</div>
            <div class="finding-full" v-if="expandedId === finding.id">
              <pre>{{ finding.content }}</pre>
            </div>
          </div>

          <div class="finding-footer">
            <div class="finding-tags">
              <span v-for="tag in finding.tags.slice(0, 4)" :key="tag" class="tag">{{ tag }}</span>
            </div>
            <button @click="toggleExpand(finding.id)" class="btn-expand">
              {{ expandedId === finding.id ? 'Collapse' : 'Read more' }}
            </button>
          </div>
        </div>
      </transition-group>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  findings: {
    type: Array,
    default: () => [],
  },
})

const activeFilter = ref('all')
const expandedId = ref(null)
const listRef = ref(null)

const agentIcons = {
  research_director: '🎯',
  literature_reviewer: '📚',
  hypothesis_generator: '💡',
  methodology_expert: '🔬',
  data_analyst: '📊',
  critical_reviewer: '🔍',
  synthesis_specialist: '🧩',
  scientific_writer: '✍️',
  citation_manager: '📋',
}

const agentNames = {
  research_director: 'Research Director',
  literature_reviewer: 'Literature Reviewer',
  hypothesis_generator: 'Hypothesis Generator',
  methodology_expert: 'Methodology Expert',
  data_analyst: 'Data Analyst',
  critical_reviewer: 'Critical Reviewer',
  synthesis_specialist: 'Synthesis Specialist',
  scientific_writer: 'Scientific Writer',
  citation_manager: 'Citation Manager',
}

const filters = [
  { value: 'all', label: 'All' },
  { value: 'literature_reviewer', label: '📚 Literature' },
  { value: 'hypothesis_generator', label: '💡 Hypotheses' },
  { value: 'methodology_expert', label: '🔬 Methods' },
  { value: 'data_analyst', label: '📊 Analysis' },
  { value: 'synthesis_specialist', label: '🧩 Synthesis' },
]

const filteredFindings = computed(() => {
  if (activeFilter.value === 'all') return [...props.findings].reverse()
  return [...props.findings]
    .filter((f) => f.agentRole === activeFilter.value)
    .reverse()
})

function previewContent(content) {
  if (!content) return ''
  return content.substring(0, 300) + (content.length > 300 ? '...' : '')
}

function toggleExpand(id) {
  expandedId.value = expandedId.value === id ? null : id
}

function confidenceStyle(confidence) {
  const hue = confidence * 120 // 0 = red, 120 = green
  return {
    background: `hsla(${hue}, 70%, 40%, 0.3)`,
    color: `hsl(${hue}, 70%, 70%)`,
    border: `1px solid hsla(${hue}, 70%, 50%, 0.3)`,
  }
}
</script>

<style scoped>
.findings-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.panel-header {
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.panel-header h3 {
  font-size: 14px;
  font-weight: 700;
  color: #e2e8f0;
  margin: 0;
}

.findings-count {
  background: rgba(154, 117, 255, 0.2);
  color: #9a75ff;
  font-size: 12px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 10px;
}

.filter-bar {
  padding: 10px 16px;
  display: flex;
  gap: 6px;
  overflow-x: auto;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}

.filter-btn {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 20px;
  color: #64748b;
  font-size: 11px;
  padding: 4px 12px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}

.filter-btn.active {
  background: rgba(154, 117, 255, 0.15);
  border-color: rgba(154, 117, 255, 0.3);
  color: #9a75ff;
}

.findings-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
  color: #475569;
  text-align: center;
}

.empty-icon {
  font-size: 32px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.empty-state p {
  font-size: 13px;
  line-height: 1.5;
}

.finding-card {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 10px;
  overflow: hidden;
}

.finding-header {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px 8px;
}

.finding-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.finding-meta {
  flex: 1;
  min-width: 0;
}

.finding-title {
  font-size: 13px;
  font-weight: 600;
  color: #e2e8f0;
  line-height: 1.3;
}

.finding-agent {
  font-size: 11px;
  color: #64748b;
  margin-top: 2px;
}

.confidence-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 20px;
  white-space: nowrap;
  flex-shrink: 0;
}

.finding-body {
  padding: 0 14px 8px;
}

.finding-preview {
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.6;
}

.finding-full pre {
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  margin: 8px 0 0;
}

.finding-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px 12px;
}

.finding-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tag {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 4px;
  color: #64748b;
  font-size: 10px;
  padding: 2px 6px;
}

.btn-expand {
  background: none;
  border: none;
  color: #63b3ed;
  font-size: 11px;
  cursor: pointer;
  padding: 0;
}

.finding-enter-active {
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
