<template>
  <div class="memory-browser">
    <!-- Header + Search -->
    <div class="mb-header">
      <div class="mb-title-row">
        <h2>Memory Library</h2>
        <div class="mb-stats" v-if="systemStats">
          <span class="stat-chip">{{ systemStats.totalSkills }} skills</span>
          <span class="stat-chip">{{ systemStats.totalSessions }} sessions</span>
          <span class="stat-chip domains">{{ systemStats.domainsExplored.length }} domains</span>
        </div>
      </div>

      <div class="mb-search-row">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input
            v-model="searchQuery"
            placeholder="Search knowledge skills by topic, domain, or keyword..."
            @input="onSearch"
            class="search-input"
          />
          <button v-if="searchQuery" @click="clearSearch" class="clear-btn">×</button>
        </div>
        <select v-model="domainFilter" @change="onDomainFilter" class="domain-select">
          <option value="">All domains</option>
          <option v-for="domain in domains" :key="domain" :value="domain">{{ domain }}</option>
        </select>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoadingSkills" class="mb-loading">
      <div class="spinner"></div>
      <span>Loading knowledge library...</span>
    </div>

    <!-- Empty State -->
    <div v-else-if="skills.length === 0" class="mb-empty">
      <div class="empty-icon">🧠</div>
      <div class="empty-title">No knowledge skills yet</div>
      <div class="empty-desc">Complete a research session to build your memory library. Each session automatically extracts structured knowledge that improves future research.</div>
    </div>

    <!-- Skills Grid -->
    <div v-else class="skills-grid">
      <div
        v-for="skill in skills"
        :key="skill.id"
        class="skill-card"
        :class="{ selected: selectedSkill?.skill?.id === skill.id }"
        @click="openSkill(skill.id)"
      >
        <div class="skill-card-header">
          <div class="skill-domain">{{ skill.domain }}</div>
          <div class="skill-quality" :class="qualityClass(skill.qualityScore)">
            {{ skill.qualityScore }}
          </div>
        </div>
        <div class="skill-title">{{ skill.title }}</div>
        <div class="skill-topic">{{ skill.topic }}</div>
        <div class="skill-footer">
          <span class="skill-date">{{ formatDate(skill.createdAt) }}</span>
          <span class="skill-usage" v-if="skill.usageCount > 0">used {{ skill.usageCount }}×</span>
        </div>
        <div class="skill-tags">
          <span v-for="tag in (skill.tags || []).slice(0, 3)" :key="tag" class="tag">{{ tag }}</span>
        </div>
      </div>
    </div>

    <!-- Skill Detail Drawer -->
    <transition name="slide">
      <div v-if="selectedSkill" class="skill-detail">
        <div class="detail-header">
          <div class="detail-domain">{{ selectedSkill.skill.domain }}</div>
          <button class="detail-close" @click="selectedSkill = null">×</button>
        </div>

        <h3 class="detail-title">{{ selectedSkill.skill.title }}</h3>
        <div class="detail-meta">
          <span>v{{ selectedSkill.skill.version }}</span>
          <span>Quality {{ selectedSkill.skill.qualityScore }}/100</span>
          <span>Used {{ selectedSkill.skill.usageCount }}×</span>
          <span>{{ selectedSkill.skill.sourceSessionIds.length }} session(s)</span>
          <span>{{ formatDate(selectedSkill.skill.updatedAt) }}</span>
        </div>

        <div class="detail-section">
          <div class="detail-label">Summary</div>
          <div class="detail-text">{{ selectedSkill.skill.summary }}</div>
        </div>

        <div class="detail-section" v-if="selectedSkill.skill.keyFindings?.length">
          <div class="detail-label">Key Findings</div>
          <ul class="detail-list">
            <li v-for="(f, i) in selectedSkill.skill.keyFindings" :key="i">{{ f }}</li>
          </ul>
        </div>

        <div class="detail-section" v-if="selectedSkill.skill.validatedHypotheses?.length">
          <div class="detail-label">Validated Hypotheses</div>
          <ul class="detail-list hypothesis">
            <li v-for="(h, i) in selectedSkill.skill.validatedHypotheses" :key="i">{{ h }}</li>
          </ul>
        </div>

        <div class="detail-section" v-if="selectedSkill.skill.methodologies?.length">
          <div class="detail-label">Proven Methodologies</div>
          <ul class="detail-list methods">
            <li v-for="(m, i) in selectedSkill.skill.methodologies" :key="i">{{ m }}</li>
          </ul>
        </div>

        <div class="detail-section" v-if="selectedSkill.skill.topCitations?.length">
          <div class="detail-label">Top Citations ({{ selectedSkill.skill.topCitations.length }})</div>
          <div class="citation-list">
            <div v-for="c in selectedSkill.skill.topCitations.slice(0, 5)" :key="c.id" class="citation-item">
              <span class="citation-verified" v-if="c.verified">✓</span>
              <span class="citation-text">{{ c.authors.slice(0,2).join(', ') }} ({{ c.year }}). {{ c.title }}</span>
              <a v-if="c.doi" :href="`https://doi.org/${c.doi}`" target="_blank" class="citation-doi">DOI</a>
            </div>
          </div>
        </div>

        <div class="detail-section" v-if="selectedSkill.skill.keyTerms?.length">
          <div class="detail-label">Key Terms</div>
          <div class="terms-row">
            <span v-for="term in selectedSkill.skill.keyTerms" :key="term" class="term-chip">{{ term }}</span>
          </div>
        </div>

        <div class="detail-section" v-if="selectedSkill.related?.length">
          <div class="detail-label">Related Skills</div>
          <div class="related-list">
            <div
              v-for="rel in selectedSkill.related"
              :key="rel.id"
              class="related-item"
              @click="openSkill(rel.id)"
            >
              <span class="related-domain">{{ rel.domain }}</span>
              <span class="related-title">{{ rel.title }}</span>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useMemory } from '../composables/useMemory'

const {
  skills, systemStats, selectedSkill,
  isLoadingSkills, loadSkills, loadSkillDetail, loadSystemStats, formatDate,
} = useMemory()

const searchQuery = ref('')
const domainFilter = ref('')
let searchTimeout = null

const domains = computed(() => {
  if (!systemStats.value) return []
  return systemStats.value.domainsExplored || []
})

onMounted(async () => {
  await Promise.all([loadSkills(), loadSystemStats()])
})

function onSearch() {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    loadSkills({ query: searchQuery.value || undefined, domain: domainFilter.value || undefined })
  }, 300)
}

function onDomainFilter() {
  loadSkills({ query: searchQuery.value || undefined, domain: domainFilter.value || undefined })
}

function clearSearch() {
  searchQuery.value = ''
  loadSkills({ domain: domainFilter.value || undefined })
}

async function openSkill(skillId) {
  await loadSkillDetail(skillId)
}

function qualityClass(score) {
  if (score >= 80) return 'quality-high'
  if (score >= 60) return 'quality-mid'
  return 'quality-low'
}
</script>

<style scoped>
.memory-browser {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: hidden;
  position: relative;
}

.mb-header {
  flex-shrink: 0;
}

.mb-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.mb-title-row h2 {
  font-size: 18px;
  font-weight: 600;
  color: var(--text);
}

.mb-stats { display: flex; gap: 8px; }
.stat-chip {
  padding: 2px 10px;
  background: rgba(102, 126, 234, 0.15);
  border: 1px solid rgba(102, 126, 234, 0.3);
  border-radius: 20px;
  font-size: 11px;
  color: var(--accent);
}
.stat-chip.domains { background: rgba(72, 187, 120, 0.12); border-color: rgba(72, 187, 120, 0.3); color: var(--success); }

.mb-search-row {
  display: flex;
  gap: 8px;
}

.search-box {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 10px;
  font-size: 13px;
}

.search-input {
  width: 100%;
  padding: 8px 32px 8px 32px;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
}
.search-input:focus { border-color: rgba(102, 126, 234, 0.5); }
.search-input::placeholder { color: var(--text-muted); }

.clear-btn {
  position: absolute;
  right: 8px;
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  padding: 0;
}

.domain-select {
  padding: 8px 12px;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  font-size: 12px;
  outline: none;
  cursor: pointer;
}

.mb-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px;
  color: var(--text-muted);
}

.spinner {
  width: 20px; height: 20px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.mb-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 20px;
  text-align: center;
}
.empty-icon { font-size: 40px; }
.empty-title { font-size: 16px; font-weight: 600; color: var(--text); }
.empty-desc { font-size: 13px; color: var(--text-muted); max-width: 380px; line-height: 1.6; }

.skills-grid {
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
  align-content: start;
  padding-right: 4px;
}

.skill-card {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px;
  cursor: pointer;
  transition: border-color 0.2s, transform 0.15s;
}
.skill-card:hover { border-color: rgba(102, 126, 234, 0.4); transform: translateY(-1px); }
.skill-card.selected { border-color: var(--accent); background: rgba(102, 126, 234, 0.08); }

.skill-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.skill-domain {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--accent);
  background: rgba(102, 126, 234, 0.1);
  padding: 2px 8px;
  border-radius: 4px;
}
.skill-quality {
  font-size: 12px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
}
.quality-high { color: var(--success); background: rgba(72, 187, 120, 0.12); }
.quality-mid { color: var(--warning); background: rgba(251, 191, 36, 0.12); }
.quality-low { color: var(--error); background: rgba(252, 129, 74, 0.12); }

.skill-title { font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 4px; line-height: 1.4; }
.skill-topic { font-size: 11px; color: var(--text-muted); margin-bottom: 8px; }
.skill-footer { display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); margin-bottom: 8px; }
.skill-usage { color: var(--accent); }
.skill-tags { display: flex; flex-wrap: wrap; gap: 4px; }
.tag {
  font-size: 10px;
  padding: 1px 6px;
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--border);
  border-radius: 3px;
  color: var(--text-muted);
}

/* Detail Drawer */
.skill-detail {
  position: absolute;
  top: 0; right: 0;
  width: 420px;
  height: 100%;
  background: var(--surface);
  border-left: 1px solid var(--border);
  overflow-y: auto;
  padding: 20px;
  z-index: 10;
}

.slide-enter-active, .slide-leave-active { transition: transform 0.25s ease; }
.slide-enter-from, .slide-leave-to { transform: translateX(100%); }

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.detail-domain {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--accent);
  background: rgba(102, 126, 234, 0.1);
  padding: 3px 10px;
  border-radius: 4px;
}

.detail-close {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 22px;
  line-height: 1;
  padding: 0;
}

.detail-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 10px;
  line-height: 1.4;
}

.detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}

.detail-section { margin-bottom: 16px; }
.detail-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
  margin-bottom: 6px;
}

.detail-text { font-size: 13px; color: var(--text); line-height: 1.6; }

.detail-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.detail-list li {
  font-size: 12px;
  color: var(--text);
  padding-left: 14px;
  position: relative;
  line-height: 1.5;
}
.detail-list li::before { content: '•'; position: absolute; left: 0; color: var(--accent); }
.detail-list.hypothesis li::before { content: 'H'; color: var(--accent2); font-size: 10px; font-weight: 700; }
.detail-list.methods li::before { content: '→'; color: var(--success); }

.citation-list { display: flex; flex-direction: column; gap: 6px; }
.citation-item {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.4;
}
.citation-verified { color: var(--success); flex-shrink: 0; font-size: 11px; }
.citation-text { flex: 1; }
.citation-doi {
  color: var(--accent);
  text-decoration: none;
  flex-shrink: 0;
  font-size: 10px;
  border: 1px solid rgba(102,126,234,0.3);
  padding: 1px 5px;
  border-radius: 3px;
}

.terms-row { display: flex; flex-wrap: wrap; gap: 6px; }
.term-chip {
  font-size: 11px;
  padding: 2px 8px;
  background: rgba(154, 117, 255, 0.1);
  border: 1px solid rgba(154, 117, 255, 0.2);
  border-radius: 4px;
  color: var(--accent2);
}

.related-list { display: flex; flex-direction: column; gap: 6px; }
.related-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--surface2);
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}
.related-item:hover { background: rgba(102,126,234,0.08); }
.related-domain {
  font-size: 10px;
  text-transform: uppercase;
  color: var(--accent);
  background: rgba(102,126,234,0.1);
  padding: 1px 6px;
  border-radius: 3px;
  flex-shrink: 0;
}
.related-title { font-size: 12px; color: var(--text); }
</style>
