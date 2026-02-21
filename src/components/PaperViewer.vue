<template>
  <div class="paper-viewer">
    <div class="viewer-header">
      <h3>📖 Research Paper</h3>
      <div class="header-actions">
        <button @click="copyPaper" class="btn-action">
          {{ copied ? '✓ Copied' : '📋 Copy' }}
        </button>
        <button @click="downloadPaper" class="btn-action primary">
          ⬇️ Download
        </button>
      </div>
    </div>

    <div class="paper-meta" v-if="paper">
      <div class="meta-item">
        <span class="meta-label">Words</span>
        <span class="meta-val">{{ paper.wordCount?.toLocaleString() || '—' }}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Sections</span>
        <span class="meta-val">{{ paper.sections?.length || '—' }}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Generated</span>
        <span class="meta-val">{{ formatDate(paper.generatedAt) }}</span>
      </div>
    </div>

    <div class="paper-content" ref="contentRef">
      <div v-if="!paperText && !paper" class="paper-placeholder">
        <div class="placeholder-icon">📄</div>
        <p>Your research paper will appear here once the Scientific Writer agent completes its work.</p>
        <div class="paper-stages">
          <div v-for="stage in stages" :key="stage.label" class="stage">
            <span>{{ stage.icon }}</span>
            <span>{{ stage.label }}</span>
          </div>
        </div>
      </div>

      <div v-else class="paper-text">
        <div v-if="paper && paper.title" class="paper-title">{{ paper.title }}</div>
        <div v-if="paper && paper.authors" class="paper-authors">
          {{ paper.authors.join(', ') }}
        </div>
        <div v-if="paper && paper.keywords && paper.keywords.length" class="paper-keywords">
          <strong>Keywords:</strong> {{ paper.keywords.join(', ') }}
        </div>

        <div class="paper-body" v-html="formattedPaper"></div>

        <div v-if="bibliography" class="bibliography">
          <h3>References</h3>
          <div class="bibliography-content">{{ bibliography }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  paper: Object,
  paperText: String,
  bibliography: String,
})

const contentRef = ref(null)
const copied = ref(false)

const stages = [
  { icon: '📚', label: 'Literature Review' },
  { icon: '💡', label: 'Hypotheses' },
  { icon: '🔬', label: 'Methodology' },
  { icon: '📊', label: 'Analysis' },
  { icon: '🧩', label: 'Synthesis' },
  { icon: '✍️', label: 'Writing' },
]

const formattedPaper = computed(() => {
  if (!props.paperText) return ''
  return props.paperText
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[h1-6]|<\/p>|<p>)(.+)$/gm, '<p>$1</p>')
    .replace(/<p><\/p>/g, '')
    .replace(/\|(.+)\|/g, (match) => {
      const cells = match.split('|').filter(Boolean).map((c) => `<td>${c.trim()}</td>`)
      return `<tr>${cells.join('')}</tr>`
    })
})

function formatDate(date) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function copyPaper() {
  const text = props.paperText || ''
  await navigator.clipboard.writeText(text)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

function downloadPaper() {
  const text = props.paperText || ''
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `research-paper-${Date.now()}.md`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.paper-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.viewer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

.viewer-header h3 {
  font-size: 14px;
  font-weight: 700;
  color: #e2e8f0;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.btn-action {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px;
  color: #94a3b8;
  font-size: 12px;
  padding: 6px 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-action:hover {
  background: rgba(255,255,255,0.1);
  color: #e2e8f0;
}

.btn-action.primary {
  background: rgba(154, 117, 255, 0.2);
  border-color: rgba(154, 117, 255, 0.3);
  color: #9a75ff;
}

.paper-meta {
  display: flex;
  gap: 20px;
  padding: 10px 20px;
  background: rgba(255,255,255,0.02);
  border-bottom: 1px solid rgba(255,255,255,0.04);
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.meta-label {
  font-size: 10px;
  color: #475569;
  text-transform: uppercase;
}

.meta-val {
  font-size: 13px;
  font-weight: 600;
  color: #e2e8f0;
}

.paper-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.paper-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  color: #475569;
  padding: 40px;
}

.placeholder-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.4;
}

.paper-placeholder p {
  font-size: 13px;
  line-height: 1.6;
  max-width: 300px;
  margin-bottom: 24px;
}

.paper-stages {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}

.stage {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #334155;
  padding: 4px 10px;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 20px;
}

.paper-text {
  color: #e2e8f0;
  font-size: 14px;
  line-height: 1.8;
}

.paper-title {
  font-size: 22px;
  font-weight: 800;
  color: #f1f5f9;
  margin-bottom: 8px;
  line-height: 1.3;
}

.paper-authors {
  color: #64748b;
  font-size: 13px;
  margin-bottom: 8px;
}

.paper-keywords {
  font-size: 13px;
  color: #64748b;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

.paper-body :deep(h1) {
  font-size: 20px;
  font-weight: 700;
  color: #f1f5f9;
  margin: 24px 0 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

.paper-body :deep(h2) {
  font-size: 16px;
  font-weight: 700;
  color: #e2e8f0;
  margin: 20px 0 8px;
}

.paper-body :deep(h3) {
  font-size: 14px;
  font-weight: 600;
  color: #cbd5e1;
  margin: 16px 0 8px;
}

.paper-body :deep(p) {
  color: #94a3b8;
  margin: 0 0 12px;
}

.paper-body :deep(strong) {
  color: #e2e8f0;
  font-weight: 600;
}

.paper-body :deep(em) {
  color: #9a75ff;
  font-style: italic;
}

.paper-body :deep(code) {
  background: rgba(255,255,255,0.06);
  border-radius: 4px;
  color: #63b3ed;
  font-size: 12px;
  padding: 1px 6px;
  font-family: monospace;
}

.paper-body :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 16px 0;
}

.paper-body :deep(td) {
  border: 1px solid rgba(255,255,255,0.1);
  padding: 8px 12px;
  font-size: 13px;
  color: #94a3b8;
}

.bibliography {
  margin-top: 32px;
  padding-top: 16px;
  border-top: 1px solid rgba(255,255,255,0.08);
}

.bibliography h3 {
  font-size: 16px;
  font-weight: 700;
  color: #e2e8f0;
  margin-bottom: 12px;
}

.bibliography-content {
  font-size: 12px;
  color: #64748b;
  line-height: 1.8;
  white-space: pre-wrap;
}
</style>
