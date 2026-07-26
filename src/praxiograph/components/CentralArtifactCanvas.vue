<template>
  <div class="canvas">
    <div class="canvas-head">
      <div class="wf-title">Central Artifact Canvas</div>
      <span v-if="current" class="type-pill">{{ current.artifact.type }}</span>
    </div>

    <!-- Empty state -->
    <div v-if="!current && !running" class="empty">
      <div class="orb"></div>
      <h3>La sala de parto de artefactos</h3>
      <p>Elige un dominio, escribe una intención y ejecuta el pipeline.
        El artefacto central nace aquí — validado, accionable y con descendencia.</p>
    </div>

    <!-- Running -->
    <div v-else-if="running" class="empty">
      <div class="orb spin"></div>
      <h3>Generando artefacto…</h3>
      <p>Recorriendo el pipeline madre: intención → evidencia → significado → artefacto.</p>
    </div>

    <!-- Result -->
    <div v-else class="artifact">
      <h2 class="art-title">{{ current.artifact.title }}</h2>
      <div class="art-meta">
        <span class="chip">{{ current.domainName }}</span>
        <span class="chip" :class="statusClass">{{ statusLabel }}</span>
        <span class="chip ghost">{{ current.intentContract.audience }}</span>
      </div>
      <article class="sections">
        <section v-for="s in current.artifact.sections" :key="s.heading">
          <h4>{{ s.heading }}</h4>
          <div class="content" v-html="renderMarkdown(s.content)"></div>
        </section>
      </article>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  current: { type: Object, default: null },
  running: { type: Boolean, default: false },
})

const statusLabel = computed(() => {
  const s = props.current?.status
  return s === 'validated' ? '✅ Validated' : s === 'human-review' ? '⚠ Human review' : '⛔ Blocked'
})
const statusClass = computed(() => props.current?.status)

// tiny markdown renderer (bold, lists, tables-as-text, line breaks)
function renderMarkdown(md) {
  const esc = (s) => s.replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]))
  return esc(md)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.*)$/gm, '<li>$1</li>')
    .replace(/^\d+\. (.*)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .replace(/\n/g, '<br>')
}
</script>

<style scoped>
.canvas { display: flex; flex-direction: column; height: 100%; }
.canvas-head { display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; border-bottom: 1px solid #ded6c8; }
.wf-title { font-weight: 900; font-size: 13px; color: #244253; }
.type-pill { font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: .04em; color: #6d28d9; background: #f5f3ff; border: 1px solid #ddd6fe; padding: 4px 9px; border-radius: 999px; }

.empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 28px; }
.empty h3 { margin: 6px 0; color: #172033; letter-spacing: -.03em; }
.empty p { max-width: 420px; color: #637083; font-size: 14px; }
.orb {
  width: 190px; aspect-ratio: 1.2; border-radius: 50%; margin-bottom: 12px;
  background: radial-gradient(circle at 38% 32%, #fff7ed 0 11%, #7dd3fc 22%, #a78bfa 43%, #f97316 56%, #0f172a 79%);
  filter: drop-shadow(0 26px 46px rgba(15,23,42,.24));
}
.orb.spin { animation: float 1.6s ease-in-out infinite; }
@keyframes float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-10px) } }

.artifact { padding: 22px 26px; overflow-y: auto; }
.art-title { margin: 0 0 10px; font-size: clamp(22px, 3vw, 32px); letter-spacing: -.04em; color: #172033; }
.art-meta { display: flex; gap: 7px; flex-wrap: wrap; margin-bottom: 22px; }
.chip { font-size: 12px; font-weight: 800; padding: 5px 10px; border-radius: 999px; background: rgba(36,92,122,.1); color: #1f5068; border: 1px solid rgba(36,92,122,.16); }
.chip.ghost { background: #fff; color: #637083; }
.chip.validated { background: #ecfdf5; color: #166534; border-color: #bbf7d0; }
.chip.human-review { background: #fff7ed; color: #9a3412; border-color: #fed7aa; }
.chip.blocked { background: #fef2f2; color: #991b1b; border-color: #fecaca; }

.sections section { margin-bottom: 20px; padding-bottom: 18px; border-bottom: 1px solid #ece5d8; }
.sections section:last-child { border-bottom: 0; }
.sections h4 { margin: 0 0 8px; font-size: 15px; color: #245c7a; letter-spacing: -.02em; }
.content { color: #3a4658; font-size: 14px; line-height: 1.65; }
.content :deep(ul) { margin: 6px 0; padding-left: 20px; }
.content :deep(li) { margin: 3px 0; }
.content :deep(strong) { color: #172033; }
</style>
