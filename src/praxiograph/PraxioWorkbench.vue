<template>
  <div class="workbench">
    <ExecutionHeader
      :domains="domains"
      :selected="selectedDomain"
      :current="current"
      @select="onSelectDomain"
    />

    <IntentComposer
      v-model:intent="intent"
      v-model:audience="audience"
      :domain="domain"
      :running="running"
      @run="run"
      @sample="loadSample"
    />

    <div class="main">
      <!-- Left: Pipeline Rail + History -->
      <aside class="col left">
        <PipelineRail
          :stages="stages"
          :active-stage="activeStage"
          :running="running"
          :current="current"
        />
        <div class="history">
          <div class="h-title">Execution History</div>
          <p v-if="!history.length" class="h-empty">Aún no hay ejecuciones.</p>
          <button
            v-for="rec in history"
            :key="rec.id"
            class="h-item"
            :class="{ active: current && current.id === rec.id }"
            @click="selectExecution(rec.id)"
          >
            <span class="dot" :class="rec.status"></span>
            <span class="h-name">{{ rec.artifact.title }}</span>
            <small>{{ rec.domainName }}</small>
          </button>
        </div>
      </aside>

      <!-- Center: Artifact -->
      <section class="col center">
        <CentralArtifactCanvas :current="current" :running="running" />
      </section>

      <!-- Right: Inspector -->
      <aside class="col right">
        <RightInspector :current="current" />
      </aside>
    </div>

    <BottomDock :current="current" @export="exportAs" />
  </div>
</template>

<script setup>
import ExecutionHeader from './components/ExecutionHeader.vue'
import IntentComposer from './components/IntentComposer.vue'
import PipelineRail from './components/PipelineRail.vue'
import CentralArtifactCanvas from './components/CentralArtifactCanvas.vue'
import RightInspector from './components/RightInspector.vue'
import BottomDock from './components/BottomDock.vue'
import { usePraxio } from './usePraxio'

const {
  domains, selectedDomain, domain, intent, audience,
  history, current, running, activeStage, stages,
  loadSample, run, selectExecution, exportAs,
} = usePraxio()

function onSelectDomain(key) {
  selectedDomain.value = key
}
</script>

<style scoped>
.workbench {
  display: flex; flex-direction: column; height: 100%; min-height: 100vh;
  background:
    radial-gradient(circle at 0 0, rgba(36,92,122,.14), transparent 30rem),
    radial-gradient(circle at 90% 0, rgba(217,119,6,.10), transparent 26rem),
    linear-gradient(135deg, #fff8e8, #eef5f7 55%, #f7f5ef);
  color: #172033;
  font-family: Inter, system-ui, -apple-system, "Segoe UI", sans-serif;
  overflow: hidden;
}
.main { flex: 1; display: grid; grid-template-columns: 270px 1fr 320px; min-height: 0; }
.col { min-height: 0; overflow: hidden; }
.left { border-right: 1px solid #ded6c8; display: flex; flex-direction: column; overflow-y: auto; }
.center { border-right: 1px solid #ded6c8; overflow: hidden; background: rgba(255,253,248,.5); }
.right { background: rgba(255,253,248,.4); }

.history { padding: 14px 16px; border-top: 1px solid #ece5d8; }
.h-title { font-weight: 900; font-size: 13px; color: #244253; margin-bottom: 9px; }
.h-empty { font-size: 12px; color: #94a3b8; }
.h-item { display: flex; align-items: center; gap: 8px; width: 100%; text-align: left; padding: 8px 9px; border-radius: 10px; border: 1px solid transparent; background: transparent; cursor: pointer; margin-bottom: 3px; }
.h-item:hover { background: #fff; }
.h-item.active { background: #fff; border-color: #ded6c8; box-shadow: 0 4px 10px rgba(15,23,42,.05); }
.h-item .dot { width: 8px; height: 8px; border-radius: 50%; flex: 0 0 auto; background: #94a3b8; }
.h-item .dot.validated { background: #15803d; }
.h-item .dot.human-review { background: #d97706; }
.h-item .dot.blocked { background: #b91c1c; }
.h-name { flex: 1; font-size: 12px; color: #334155; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.h-item small { font-size: 10.5px; color: #94a3b8; }

@media (max-width: 980px) {
  .workbench { overflow: auto; }
  .main { grid-template-columns: 1fr; }
  .left, .center { border-right: 0; border-bottom: 1px solid #ded6c8; }
}
</style>
