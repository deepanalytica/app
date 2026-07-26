<template>
  <div class="dock">
    <!-- Action Queue -->
    <div class="cell">
      <div class="cell-title">Action Queue</div>
      <template v-if="current">
        <div v-for="a in current.actions" :key="a.id" class="action">
          <span class="prio" :class="a.priority"></span>
          <div class="a-main">
            <div class="a-title">{{ a.title }}</div>
            <small>{{ a.owner }}</small>
          </div>
          <span class="status" :class="a.status">{{ a.status }}</span>
          <span v-if="a.requiresHumanReview" class="hr" title="Requiere revisión humana">⚠</span>
        </div>
      </template>
      <p v-else class="ph">Tareas, owners, estados y revisión humana.</p>
    </div>

    <!-- Learning -->
    <div class="cell">
      <div class="cell-title">Learning</div>
      <template v-if="current">
        <div class="lrn">
          <strong>Funcionó</strong>
          <ul><li v-for="w in current.learning.worked" :key="w">{{ w }}</li></ul>
        </div>
        <div class="lrn">
          <strong>Falló</strong>
          <ul><li v-for="f in current.learning.failed" :key="f">{{ f }}</li></ul>
        </div>
        <div class="rule">↻ {{ current.learning.ruleUpdate }}</div>
        <div class="metric">📈 {{ current.learning.metric }}</div>
      </template>
      <p v-else class="ph">Qué funcionó, qué falló y qué regla actualizar.</p>
    </div>

    <!-- Descendants -->
    <div class="cell">
      <div class="cell-title">Descendants</div>
      <template v-if="current">
        <div v-for="(group, kind) in grouped" :key="kind" class="dgroup" v-show="group.length">
          <span class="kind" :class="kind">{{ labels[kind] }}</span>
          <span v-for="d in group" :key="d" class="dnode">{{ d }}</span>
        </div>
      </template>
      <p v-else class="ph">Qué productos, protocolos o sistemas nacen del artefacto.</p>
    </div>

    <!-- Export -->
    <div class="cell">
      <div class="cell-title">Export</div>
      <p class="ph">JSON, Markdown, HTML o paquete de entrega.</p>
      <div class="exports">
        <button :disabled="!current" @click="$emit('export', 'json')">JSON</button>
        <button :disabled="!current" @click="$emit('export', 'md')">Markdown</button>
        <button :disabled="!current" @click="$emit('export', 'html')">HTML</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({ current: { type: Object, default: null } })
defineEmits(['export'])

const labels = { immediate: 'Inmediatos', commercial: 'Comerciales', operational: 'Operativos', learning: 'Learning', system: 'Sistema' }

const grouped = computed(() => {
  const out = { immediate: [], commercial: [], operational: [], learning: [], system: [] }
  props.current?.descendants.forEach((d) => out[d.kind].push(d.label))
  return out
})
</script>

<style scoped>
.dock { display: grid; grid-template-columns: repeat(4, 1fr); border-top: 1px solid #ded6c8; background: rgba(255,253,248,.7); }
.cell { padding: 13px 15px; border-right: 1px solid #ded6c8; min-height: 150px; max-height: 230px; overflow-y: auto; }
.cell:last-child { border-right: 0; }
.cell-title { font-weight: 900; font-size: 12.5px; color: #244253; margin-bottom: 9px; }
.ph { font-size: 11.5px; color: #94a3b8; line-height: 1.5; margin: 0 0 8px; }

.action { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid #f0ebe0; }
.prio { width: 8px; height: 8px; border-radius: 50%; flex: 0 0 auto; }
.prio.high { background: #b91c1c; } .prio.med { background: #d97706; } .prio.low { background: #94a3b8; }
.a-main { flex: 1; min-width: 0; }
.a-title { font-size: 11.5px; color: #334155; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.action small { font-size: 10.5px; color: #94a3b8; }
.status { font-size: 9.5px; font-weight: 900; text-transform: uppercase; padding: 2px 6px; border-radius: 999px; background: #e2e8f0; color: #475569; }
.status.doing { background: #dbeafe; color: #1d4ed8; } .status.done { background: #dcfce7; color: #166534; } .status.blocked { background: #fee2e2; color: #991b1b; }
.hr { color: #d97706; font-size: 12px; }

.lrn { margin-bottom: 7px; }
.lrn strong { font-size: 11px; color: #245c7a; }
.lrn ul { margin: 2px 0; padding-left: 15px; }
.lrn li { font-size: 11px; color: #475569; margin: 1px 0; }
.rule { font-size: 11px; color: #6d28d9; margin-top: 4px; }
.metric { font-size: 11px; color: #15803d; margin-top: 3px; }

.dgroup { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; margin-bottom: 6px; }
.kind { font-size: 9.5px; font-weight: 900; text-transform: uppercase; padding: 2px 6px; border-radius: 6px; background: #e2e8f0; color: #475569; }
.kind.immediate { background: #dbeafe; color: #1d4ed8; }
.kind.commercial { background: #fff7ed; color: #9a3412; }
.kind.operational { background: #ecfdf5; color: #166534; }
.kind.learning { background: #f5f3ff; color: #5b21b6; }
.kind.system { background: #0f172a; color: #fff; }
.dnode { font-size: 11px; color: #334155; background: #fff; border: 1px solid #e3dccd; border-radius: 999px; padding: 2px 8px; }

.exports { display: flex; gap: 6px; flex-wrap: wrap; }
.exports button { flex: 1; min-width: 64px; font-weight: 900; font-size: 11.5px; padding: 8px; border-radius: 10px; border: 1px solid #245c7a; background: #245c7a; color: #fff; cursor: pointer; }
.exports button:disabled { opacity: .4; cursor: not-allowed; background: #fff; color: #94a3b8; border-color: #e3dccd; }
</style>
