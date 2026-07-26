<template>
  <div class="inspector">
    <div class="wf-title">Inspector</div>

    <div v-if="!current" class="ph">Sin ejecución. El inspector mostrará evidencia, ontología, validación y policy gate.</div>

    <template v-else>
      <!-- Evidence Ledger -->
      <section class="block">
        <header @click="toggle('ev')">
          <span>Evidence Panel</span>
          <small>{{ current.evidence.length }}</small>
        </header>
        <div v-show="open.ev" class="body">
          <div v-for="e in current.evidence" :key="e.id" class="ev">
            <div class="ev-top">
              <strong>{{ e.source }}</strong>
              <span class="conf" :class="e.status">{{ Math.round(e.confidence * 100) }}%</span>
            </div>
            <p>{{ e.limitation }}</p>
            <span class="tag" :class="e.status">{{ e.status }}</span>
          </div>
        </div>
      </section>

      <!-- Ontology / Rules -->
      <section class="block">
        <header @click="toggle('ont')">
          <span>Ontology / Rules</span>
          <small :class="{ warn: !current.ontologyCheck.passed }">
            {{ current.ontologyCheck.passed ? 'ok' : 'issues' }}
          </small>
        </header>
        <div v-show="open.ont" class="body">
          <div class="mini-label">Clases mapeadas</div>
          <div class="pills">
            <span v-for="c in current.ontologyCheck.classes" :key="c" class="pill v">{{ c }}</span>
            <span v-if="!current.ontologyCheck.classes.length" class="muted">ninguna</span>
          </div>
          <div class="mini-label">Relaciones</div>
          <ul class="rel">
            <li v-for="r in current.ontologyCheck.relations" :key="r">{{ r }}</li>
          </ul>
          <div v-if="current.ontologyCheck.issues.length" class="issues">
            <div v-for="i in current.ontologyCheck.issues" :key="i">⚠ {{ i }}</div>
          </div>
        </div>
      </section>

      <!-- Validation Checklist -->
      <section class="block">
        <header @click="toggle('val')">
          <span>Validation Checklist</span>
          <small>{{ passed }}/{{ current.validation.length }}</small>
        </header>
        <div v-show="open.val" class="body">
          <div v-for="v in current.validation" :key="v.id" class="val" :class="{ fail: !v.passed }">
            <span class="mark">{{ v.passed ? '✓' : '✕' }}</span>
            <div>
              <div class="v-label">{{ v.label }}</div>
              <small>{{ v.detail }}</small>
            </div>
          </div>
        </div>
      </section>

      <!-- Policy Gate -->
      <section class="block">
        <header @click="toggle('pol')">
          <span>Policy Gate</span>
          <small :class="current.status">{{ current.status }}</small>
        </header>
        <div v-show="open.pol" class="body">
          <div class="gate" :class="current.status">{{ gateLabel }}</div>
          <ul class="reasons">
            <li v-for="r in current.policy.reasons" :key="r">{{ r }}</li>
          </ul>
          <div v-if="current.policy.blockedBy.length" class="blocked-list">
            <div v-for="b in current.policy.blockedBy" :key="b">⛔ {{ b }}</div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { reactive, computed } from 'vue'

const props = defineProps({ current: { type: Object, default: null } })
const open = reactive({ ev: true, ont: false, val: true, pol: true })
function toggle(k) { open[k] = !open[k] }

const passed = computed(() => props.current?.validation.filter((v) => v.passed).length ?? 0)
const gateLabel = computed(() => {
  const s = props.current?.status
  return s === 'validated' ? 'Permitido' : s === 'human-review' ? 'Requiere revisión humana' : 'Bloqueado'
})
</script>

<style scoped>
.inspector { padding: 14px; overflow-y: auto; height: 100%; }
.wf-title { font-weight: 900; font-size: 13px; color: #244253; margin-bottom: 12px; }
.ph { font-size: 12.5px; color: #94a3b8; line-height: 1.5; }
.block { border: 1px solid #e3dccd; border-radius: 14px; margin-bottom: 10px; overflow: hidden; background: #fff; }
.block header { display: flex; justify-content: space-between; align-items: center; padding: 11px 13px; cursor: pointer; font-weight: 900; font-size: 12.5px; color: #244253; }
.block header small { font-weight: 800; color: #94a3b8; }
.block header small.warn { color: #b91c1c; }
.block header small.validated { color: #15803d; }
.block header small.human-review { color: #d97706; }
.block header small.blocked { color: #b91c1c; }
.body { padding: 0 13px 13px; }

.ev { border-top: 1px solid #f0ebe0; padding: 9px 0; }
.ev-top { display: flex; justify-content: space-between; font-size: 12.5px; color: #334155; }
.ev p { margin: 4px 0; font-size: 11.5px; color: #94a3b8; }
.conf { font-weight: 900; }
.conf.verified { color: #15803d; } .conf.unverified { color: #d97706; } .conf.hypothesis { color: #b91c1c; }
.tag { font-size: 10px; font-weight: 900; text-transform: uppercase; padding: 2px 7px; border-radius: 999px; }
.tag.verified { background: #ecfdf5; color: #166534; } .tag.unverified { background: #fff7ed; color: #9a3412; } .tag.hypothesis { background: #fef2f2; color: #991b1b; }

.mini-label { font-size: 11px; font-weight: 900; color: #94a3b8; text-transform: uppercase; margin: 8px 0 5px; }
.pills { display: flex; flex-wrap: wrap; gap: 5px; }
.pill { font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 999px; }
.pill.v { background: #eef2ff; color: #4338ca; }
.muted { color: #94a3b8; font-size: 12px; }
.rel { margin: 4px 0; padding-left: 16px; font-size: 11.5px; color: #475569; }
.rel li { margin: 2px 0; }
.issues { margin-top: 6px; font-size: 11.5px; color: #b91c1c; }

.val { display: flex; gap: 8px; padding: 7px 0; border-top: 1px solid #f0ebe0; }
.val .mark { color: #15803d; font-weight: 900; }
.val.fail .mark { color: #b91c1c; }
.v-label { font-size: 12px; color: #334155; line-height: 1.3; }
.val small { font-size: 11px; color: #94a3b8; }

.gate { text-align: center; font-weight: 900; padding: 9px; border-radius: 10px; margin-bottom: 8px; }
.gate.validated { background: #ecfdf5; color: #166534; }
.gate.human-review { background: #fff7ed; color: #9a3412; }
.gate.blocked { background: #fef2f2; color: #991b1b; }
.reasons { margin: 0; padding-left: 16px; font-size: 11.5px; color: #475569; }
.reasons li { margin: 3px 0; }
.blocked-list { margin-top: 6px; font-size: 11.5px; color: #b91c1c; }
</style>
