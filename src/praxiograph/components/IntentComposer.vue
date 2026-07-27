<template>
  <div class="composer">
    <div class="row">
      <div class="field grow">
        <label>Intención</label>
        <textarea
          :value="intent"
          @input="$emit('update:intent', $event.target.value)"
          rows="2"
          :placeholder="`¿Qué quieres convertir en artefacto para ${domain.name}?`"
        ></textarea>
      </div>
      <div class="field">
        <label>Audiencia</label>
        <input
          :value="audience"
          @input="$emit('update:audience', $event.target.value)"
          :placeholder="'Opcional'"
        />
      </div>
    </div>
    <div class="actions">
      <span class="pain">⚑ {{ domain.pain }}</span>
      <div class="btns">
        <button class="ghost" @click="$emit('sample')">Ejemplo</button>
        <button class="run" :disabled="running || !intent.trim()" @click="$emit('run')">
          {{ running ? 'Generando…' : 'Ejecutar pipeline ▶' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  intent: { type: String, default: '' },
  audience: { type: String, default: '' },
  domain: { type: Object, required: true },
  running: { type: Boolean, default: false },
})
defineEmits(['update:intent', 'update:audience', 'run', 'sample'])
</script>

<style scoped>
.composer { padding: 12px 20px; border-bottom: 1px solid #ded6c8; background: rgba(255,255,255,.55); }
.row { display: flex; gap: 12px; }
.field { display: flex; flex-direction: column; gap: 4px; }
.field.grow { flex: 1; }
.field label { font-size: 11px; font-weight: 900; text-transform: uppercase; color: #94a3b8; letter-spacing: .04em; }
textarea, input {
  font-family: inherit; font-size: 13.5px; color: #172033; padding: 9px 11px;
  border: 1px solid #ded6c8; border-radius: 11px; background: #fffdf8; resize: vertical;
}
.field input { min-width: 200px; }
textarea:focus, input:focus { outline: none; border-color: #245c7a; box-shadow: 0 0 0 3px rgba(36,92,122,.12); }
.actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 10px; flex-wrap: wrap; }

@media (max-width: 700px) {
  .row { flex-direction: column; }
  .field input { min-width: 0; width: 100%; }
  .btns { flex: 1; }
  .btns button { flex: 1; }
}
.pain { font-size: 12px; color: #9a3412; background: #fff7ed; border: 1px solid #fed7aa; padding: 5px 10px; border-radius: 999px; }
.btns { display: flex; gap: 8px; }
button { font-weight: 900; font-size: 13px; padding: 9px 15px; border-radius: 11px; cursor: pointer; border: 1px solid #245c7a; }
.ghost { background: #fff; color: #245c7a; }
.run { background: linear-gradient(135deg, #245c7a, #6d28d9); color: #fff; border-color: transparent; }
.run:disabled { opacity: .5; cursor: not-allowed; }
</style>
