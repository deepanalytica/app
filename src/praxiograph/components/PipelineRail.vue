<template>
  <div class="rail">
    <div class="rail-title">Pipeline Rail</div>
    <p class="rail-sub">Pipeline madre de artefacto</p>
    <ol class="stages">
      <li
        v-for="(stage, i) in stages"
        :key="stage"
        class="stage"
        :class="{
          active: i === activeStage,
          done: activeStage > i || (current && !running),
        }"
      >
        <span class="dot">{{ i + 1 }}</span>
        <span class="label">{{ stage }}</span>
      </li>
    </ol>
  </div>
</template>

<script setup>
defineProps({
  stages: { type: Array, required: true },
  activeStage: { type: Number, default: -1 },
  running: { type: Boolean, default: false },
  current: { type: Object, default: null },
})
</script>

<style scoped>
.rail { padding: 16px; }
.rail-title { font-weight: 900; font-size: 13px; color: #244253; letter-spacing: -.02em; }
.rail-sub { margin: 2px 0 14px; font-size: 12px; color: #94a3b8; }
.stages { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.stage {
  display: flex; align-items: center; gap: 10px; padding: 7px 9px;
  border-radius: 11px; font-size: 12.5px; color: #64748b;
  border: 1px solid transparent; transition: .18s;
}
.stage .dot {
  width: 22px; height: 22px; flex: 0 0 auto; border-radius: 7px;
  display: grid; place-items: center; font-size: 11px; font-weight: 900;
  background: #e7e0d3; color: #8a8170;
}
.stage.done { color: #15803d; }
.stage.done .dot { background: #dcfce7; color: #15803d; }
.stage.active {
  color: #fff; background: linear-gradient(135deg, #245c7a, #6d28d9);
  border-color: rgba(36,92,122,.4); box-shadow: 0 8px 18px rgba(36,92,122,.25);
}
.stage.active .dot { background: rgba(255,255,255,.22); color: #fff; }
</style>
