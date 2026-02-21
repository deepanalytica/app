<template>
  <div class="agent-card" :class="[`status-${agent.status}`, { active: isActive }]">
    <div class="agent-header">
      <div class="agent-icon">{{ agentIcon }}</div>
      <div class="agent-info">
        <div class="agent-name">{{ agentName }}</div>
        <div class="agent-role">{{ agentRoleLabel }}</div>
      </div>
      <div class="status-badge" :class="agent.status">
        <span class="status-dot"></span>
        {{ statusLabel }}
      </div>
    </div>

    <div class="agent-task" v-if="agent.currentTask">
      <div class="task-label">Current task</div>
      <div class="task-text">{{ agent.currentTask }}</div>
    </div>

    <div class="agent-metrics" v-if="agent.metrics && agent.metrics.tasksCompleted > 0">
      <div class="metric">
        <span class="metric-val">{{ agent.metrics.tasksCompleted }}</span>
        <span class="metric-label">tasks</span>
      </div>
      <div class="metric">
        <span class="metric-val">{{ formatTokens(agent.metrics.tokensUsed) }}</span>
        <span class="metric-label">tokens</span>
      </div>
      <div class="metric" v-if="agent.metrics.qualityScore">
        <span class="metric-val">{{ agent.metrics.qualityScore }}%</span>
        <span class="metric-label">quality</span>
      </div>
    </div>

    <div class="thinking-pulse" v-if="agent.status === 'thinking'">
      <div class="pulse-bar" v-for="i in 5" :key="i" :style="{ animationDelay: `${i * 0.15}s` }"></div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  role: String,
  agent: Object,
})

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

const roleLabels = {
  research_director: 'Chief Strategist',
  literature_reviewer: 'Database Mining',
  hypothesis_generator: 'Theory Builder',
  methodology_expert: 'Design Architect',
  data_analyst: 'Statistical Engine',
  critical_reviewer: 'Quality Gatekeeper',
  synthesis_specialist: 'Knowledge Integrator',
  scientific_writer: 'Manuscript Author',
  citation_manager: 'Reference Curator',
}

const agentIcon = computed(() => agentIcons[props.role] || '🤖')
const agentName = computed(() => props.agent.name || props.role)
const agentRoleLabel = computed(() => roleLabels[props.role] || '')

const isActive = computed(() =>
  ['thinking', 'working', 'reviewing'].includes(props.agent.status)
)

const statusLabels = {
  idle: 'Standby',
  initializing: 'Init',
  thinking: 'Thinking',
  working: 'Working',
  reviewing: 'Reviewing',
  completed: 'Done',
  error: 'Error',
  waiting: 'Waiting',
}

const statusLabel = computed(() => statusLabels[props.agent.status] || props.agent.status)

function formatTokens(n) {
  if (!n) return '0'
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}
</script>

<style scoped>
.agent-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 16px;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.agent-card.active {
  border-color: rgba(99, 179, 237, 0.4);
  background: rgba(99, 179, 237, 0.05);
  box-shadow: 0 0 20px rgba(99, 179, 237, 0.1);
}

.agent-card.status-completed {
  border-color: rgba(72, 187, 120, 0.3);
  background: rgba(72, 187, 120, 0.04);
}

.agent-card.status-error {
  border-color: rgba(252, 129, 74, 0.3);
  background: rgba(252, 129, 74, 0.04);
}

.agent-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.agent-icon {
  font-size: 24px;
  width: 36px;
  text-align: center;
}

.agent-info {
  flex: 1;
  min-width: 0;
}

.agent-name {
  font-weight: 600;
  font-size: 13px;
  color: #e2e8f0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.agent-role {
  font-size: 11px;
  color: #64748b;
  margin-top: 2px;
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 500;
  padding: 3px 8px;
  border-radius: 20px;
  white-space: nowrap;
  background: rgba(100, 116, 139, 0.2);
  color: #94a3b8;
}

.status-badge.thinking {
  background: rgba(99, 179, 237, 0.15);
  color: #63b3ed;
}

.status-badge.working {
  background: rgba(154, 117, 255, 0.15);
  color: #9a75ff;
}

.status-badge.reviewing {
  background: rgba(251, 191, 36, 0.15);
  color: #fbbf24;
}

.status-badge.completed {
  background: rgba(72, 187, 120, 0.15);
  color: #48bb78;
}

.status-badge.error {
  background: rgba(252, 129, 74, 0.15);
  color: #fc814a;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.status-badge.thinking .status-dot,
.status-badge.working .status-dot {
  animation: pulse 1.2s ease-in-out infinite;
}

.agent-task {
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 6px;
  margin-bottom: 10px;
}

.task-label {
  font-size: 10px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 3px;
}

.task-text {
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.4;
}

.agent-metrics {
  display: flex;
  gap: 12px;
}

.metric {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.metric-val {
  font-size: 14px;
  font-weight: 700;
  color: #e2e8f0;
}

.metric-label {
  font-size: 10px;
  color: #64748b;
}

.thinking-pulse {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 20px;
  margin-top: 8px;
}

.pulse-bar {
  width: 3px;
  height: 100%;
  background: #63b3ed;
  border-radius: 2px;
  animation: soundwave 0.8s ease-in-out infinite alternate;
  opacity: 0.7;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
}

@keyframes soundwave {
  0% { transform: scaleY(0.2); }
  100% { transform: scaleY(1); }
}
</style>
