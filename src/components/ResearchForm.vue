<template>
  <div class="research-form">
    <div class="form-header">
      <h2>Configure Research</h2>
      <p>Define your scientific research parameters</p>
    </div>

    <div class="form-body">
      <div class="field">
        <label>Research Topic <span class="required">*</span></label>
        <input
          v-model="form.topic"
          type="text"
          placeholder="e.g. The impact of sleep deprivation on cognitive performance"
          :disabled="disabled"
        />
      </div>

      <div class="field">
        <label>Primary Research Question <span class="required">*</span></label>
        <textarea
          v-model="form.researchQuestion"
          rows="3"
          placeholder="e.g. How does chronic sleep deprivation (< 6 hours/night) affect executive function and working memory in adults aged 18-65?"
          :disabled="disabled"
        ></textarea>
      </div>

      <div class="field-row">
        <div class="field">
          <label>Scientific Domain <span class="required">*</span></label>
          <select v-model="form.domain" :disabled="disabled">
            <option value="">Select domain...</option>
            <option v-for="d in domains" :key="d.value" :value="d.value">{{ d.label }}</option>
          </select>
        </div>

        <div class="field">
          <label>Research Depth</label>
          <select v-model="form.depth" :disabled="disabled">
            <option value="quick">Quick (Faster)</option>
            <option value="standard">Standard</option>
            <option value="comprehensive">Comprehensive</option>
            <option value="exhaustive">Exhaustive (Deepest)</option>
          </select>
        </div>
      </div>

      <div class="field">
        <label>Research Objectives</label>
        <div class="objectives-list">
          <div
            v-for="(obj, i) in form.objectives"
            :key="i"
            class="objective-item"
          >
            <span class="obj-num">{{ i + 1 }}</span>
            <input
              v-model="form.objectives[i]"
              type="text"
              :placeholder="`Objective ${i + 1}`"
              :disabled="disabled"
            />
            <button
              v-if="form.objectives.length > 1"
              @click="removeObjective(i)"
              class="btn-remove"
              :disabled="disabled"
            >×</button>
          </div>
          <button
            v-if="form.objectives.length < 6"
            @click="addObjective"
            class="btn-add-objective"
            :disabled="disabled"
          >
            + Add Objective
          </button>
        </div>
      </div>

      <div class="field">
        <label>Output Format</label>
        <div class="radio-group">
          <label v-for="fmt in formats" :key="fmt.value" class="radio-option" :class="{ active: form.outputFormat === fmt.value }">
            <input type="radio" v-model="form.outputFormat" :value="fmt.value" :disabled="disabled" />
            <span class="radio-icon">{{ fmt.icon }}</span>
            <span class="radio-label">{{ fmt.label }}</span>
            <span class="radio-desc">{{ fmt.desc }}</span>
          </label>
        </div>
      </div>

      <div class="example-topics">
        <div class="example-label">Example topics:</div>
        <button
          v-for="ex in exampleTopics"
          :key="ex.topic"
          @click="loadExample(ex)"
          class="example-chip"
          :disabled="disabled"
        >{{ ex.topic }}</button>
      </div>
    </div>

    <div class="form-footer">
      <div class="cost-estimate">
        <span class="cost-icon">💰</span>
        Estimated cost: <strong>$2–8</strong> (claude-opus-4-6)
      </div>
      <button
        @click="submit"
        class="btn-start"
        :disabled="disabled || !isValid"
      >
        <span v-if="!disabled">🚀 Start Research</span>
        <span v-else>⏳ Researching...</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { reactive, computed } from 'vue'

const props = defineProps({
  disabled: Boolean,
})

const emit = defineEmits(['submit'])

const form = reactive({
  topic: '',
  researchQuestion: '',
  domain: '',
  depth: 'comprehensive',
  outputFormat: 'full_paper',
  objectives: [
    'Conduct a comprehensive systematic literature review',
    'Generate and evaluate testable research hypotheses',
    'Design rigorous research methodology',
    'Synthesize findings into a publishable paper',
  ],
})

const domains = [
  { value: 'neuroscience', label: '🧠 Neuroscience' },
  { value: 'psychology', label: '🧪 Psychology' },
  { value: 'medicine', label: '🏥 Medicine & Health' },
  { value: 'biology', label: '🦠 Biology' },
  { value: 'computer_science', label: '💻 Computer Science & AI' },
  { value: 'physics', label: '⚛️ Physics' },
  { value: 'chemistry', label: '🧬 Chemistry' },
  { value: 'climate', label: '🌍 Climate & Environment' },
  { value: 'economics', label: '📈 Economics' },
  { value: 'social_sciences', label: '👥 Social Sciences' },
  { value: 'education', label: '📚 Education' },
  { value: 'engineering', label: '⚙️ Engineering' },
  { value: 'materials', label: '🔩 Materials Science' },
  { value: 'astronomy', label: '🔭 Astronomy' },
  { value: 'genetics', label: '🧬 Genetics & Genomics' },
]

const formats = [
  { value: 'summary', icon: '📋', label: 'Summary', desc: 'Brief overview' },
  { value: 'report', icon: '📄', label: 'Report', desc: 'Detailed findings' },
  { value: 'full_paper', icon: '📖', label: 'Full Paper', desc: 'Publication-ready' },
]

const exampleTopics = [
  {
    topic: 'Sleep & Cognition',
    researchQuestion: 'How does chronic sleep deprivation affect executive function in adults?',
    domain: 'neuroscience',
  },
  {
    topic: 'AI in Drug Discovery',
    researchQuestion: 'What is the efficacy of transformer-based models in predicting drug-target interactions?',
    domain: 'computer_science',
  },
  {
    topic: 'Climate Anxiety',
    researchQuestion: 'What is the relationship between climate change awareness and psychological distress in young adults?',
    domain: 'psychology',
  },
  {
    topic: 'CRISPR Ethics',
    researchQuestion: 'What are the bioethical implications of germline CRISPR-Cas9 editing in human embryos?',
    domain: 'biology',
  },
  {
    topic: 'Gut-Brain Axis',
    researchQuestion: 'How does the gut microbiome composition influence neurological and mental health outcomes?',
    domain: 'medicine',
  },
]

const isValid = computed(() => {
  return (
    form.topic.trim().length > 5 &&
    form.researchQuestion.trim().length > 10 &&
    form.domain !== ''
  )
})

function addObjective() {
  form.objectives.push('')
}

function removeObjective(i) {
  form.objectives.splice(i, 1)
}

function loadExample(ex) {
  form.topic = ex.topic
  form.researchQuestion = ex.researchQuestion
  form.domain = ex.domain
}

function submit() {
  if (!isValid.value) return
  emit('submit', {
    topic: form.topic.trim(),
    researchQuestion: form.researchQuestion.trim(),
    domain: form.domain,
    depth: form.depth,
    outputFormat: form.outputFormat,
    objectives: form.objectives.filter((o) => o.trim()),
    language: 'English',
  })
}
</script>

<style scoped>
.research-form {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.form-header {
  padding: 20px 20px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.form-header h2 {
  font-size: 16px;
  font-weight: 700;
  color: #e2e8f0;
  margin: 0 0 4px;
}

.form-header p {
  font-size: 12px;
  color: #64748b;
  margin: 0;
}

.form-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

label {
  font-size: 12px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.required {
  color: #fc814a;
}

input[type="text"],
textarea,
select {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #e2e8f0;
  font-size: 13px;
  padding: 10px 12px;
  transition: border-color 0.2s;
  width: 100%;
  box-sizing: border-box;
  font-family: inherit;
}

input[type="text"]:focus,
textarea:focus,
select:focus {
  outline: none;
  border-color: rgba(99, 179, 237, 0.5);
}

input::placeholder,
textarea::placeholder {
  color: #475569;
}

select option {
  background: #1e293b;
}

textarea {
  resize: vertical;
  min-height: 80px;
}

.objectives-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.objective-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.obj-num {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(99, 179, 237, 0.2);
  color: #63b3ed;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.btn-remove {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(252, 129, 74, 0.15);
  border: none;
  color: #fc814a;
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.btn-add-objective {
  background: none;
  border: 1px dashed rgba(99, 179, 237, 0.3);
  border-radius: 6px;
  color: #63b3ed;
  font-size: 12px;
  padding: 7px;
  cursor: pointer;
  text-align: center;
}

.radio-group {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.radio-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 8px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  cursor: pointer;
  text-align: center;
  gap: 4px;
  transition: all 0.2s;
}

.radio-option.active {
  border-color: rgba(99, 179, 237, 0.5);
  background: rgba(99, 179, 237, 0.08);
}

.radio-option input {
  display: none;
}

.radio-icon {
  font-size: 18px;
}

.radio-label {
  font-size: 12px;
  font-weight: 600;
  color: #e2e8f0;
}

.radio-desc {
  font-size: 10px;
  color: #64748b;
}

.example-topics {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.example-label {
  font-size: 11px;
  color: #64748b;
  flex-basis: 100%;
}

.example-chip {
  background: rgba(154, 117, 255, 0.1);
  border: 1px solid rgba(154, 117, 255, 0.2);
  border-radius: 20px;
  color: #9a75ff;
  font-size: 11px;
  padding: 4px 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.example-chip:hover:not(:disabled) {
  background: rgba(154, 117, 255, 0.2);
}

.form-footer {
  padding: 16px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.cost-estimate {
  font-size: 12px;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 6px;
}

.cost-estimate strong {
  color: #94a3b8;
}

.btn-start {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 10px;
  color: white;
  font-size: 14px;
  font-weight: 700;
  padding: 12px 28px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-start:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4);
}

.btn-start:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
