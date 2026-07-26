<template>
  <header class="exec-header">
    <div class="brand">
      <span class="logo"></span>
      <div>
        <h1>PraxioGraph <span>Artifact Workbench</span></h1>
        <small>Sistema operativo de realidad accionable · Deep Analytica</small>
      </div>
    </div>

    <nav class="domain-tabs">
      <button
        v-for="d in domains"
        :key="d.key"
        class="dtab"
        :class="{ active: selected === d.key }"
        :style="selected === d.key ? { background: d.accent, borderColor: d.accent } : {}"
        @click="$emit('select', d.key)"
      >
        {{ d.name }}
      </button>
    </nav>

    <div class="status">
      <span v-if="current" class="pill" :class="current.status">{{ statusLabel }}</span>
      <span class="model">PraxioGraph OS · determinístico</span>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  domains: { type: Array, required: true },
  selected: { type: String, required: true },
  current: { type: Object, default: null },
})
defineEmits(['select'])

const statusLabel = computed(() => {
  const s = props.current?.status
  return s === 'validated' ? '✅ validated' : s === 'human-review' ? '⚠ human review' : '⛔ blocked'
})
</script>

<style scoped>
.exec-header {
  display: flex; align-items: center; gap: 18px; padding: 12px 20px;
  border-bottom: 1px solid #ded6c8; background: rgba(255,253,248,.9);
  backdrop-filter: blur(12px); flex-wrap: wrap;
}
.brand { display: flex; align-items: center; gap: 11px; }
.logo { width: 40px; height: 40px; border-radius: 13px; background: conic-gradient(#245c7a, #d97706, #6d28d9, #245c7a); box-shadow: 0 10px 24px rgba(15,23,42,.18); }
.brand h1 { margin: 0; font-size: 15px; letter-spacing: -.03em; color: #172033; }
.brand h1 span { color: #245c7a; }
.brand small { color: #94a3b8; font-size: 11.5px; }

.domain-tabs { display: flex; gap: 6px; flex-wrap: wrap; margin-left: auto; }
.dtab {
  font-weight: 900; font-size: 12.5px; padding: 7px 12px; border-radius: 999px;
  border: 1px solid rgba(36,92,122,.18); background: #fff; color: #244253; cursor: pointer; transition: .15s;
}
.dtab.active { color: #fff; }

.status { display: flex; align-items: center; gap: 9px; }
.pill { font-size: 11.5px; font-weight: 900; padding: 5px 10px; border-radius: 999px; }
.pill.validated { background: #ecfdf5; color: #166534; }
.pill.human-review { background: #fff7ed; color: #9a3412; }
.pill.blocked { background: #fef2f2; color: #991b1b; }
.model { font-size: 11px; color: #94a3b8; font-weight: 700; }
</style>
