// ============================================================
// KNOWLEDGE SKILL ENGINE
// Extracts structured knowledge from completed research sessions
// and injects prior knowledge into new sessions of the same domain.
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import Anthropic from '@anthropic-ai/sdk';
import type { ResearchSession, KnowledgeSkill, ResearchConfig } from '../models/types';
import { memoryStore } from './MemoryStore';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.RESEARCH_MODEL || 'claude-opus-4-6';

export class KnowledgeSkillEngine {
  private static instance: KnowledgeSkillEngine;

  static getInstance(): KnowledgeSkillEngine {
    if (!KnowledgeSkillEngine.instance) {
      KnowledgeSkillEngine.instance = new KnowledgeSkillEngine();
    }
    return KnowledgeSkillEngine.instance;
  }

  /**
   * Called after a research session completes.
   * Uses Claude to distill the session into a reusable knowledge skill.
   */
  async extractFromSession(session: ResearchSession): Promise<KnowledgeSkill> {
    console.log(`[KnowledgeSkill] Extracting knowledge from session: ${session.id}`);

    // Build a compact session digest for Claude to analyze
    const digest = this.buildSessionDigest(session);

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4000,
      thinking: { type: 'enabled', budget_tokens: 1000 },
      messages: [{
        role: 'user',
        content: `You are a knowledge extraction specialist. Analyze this completed research session and extract a structured knowledge skill that can be reused in future research on the same domain.

## RESEARCH SESSION DATA
${digest}

## YOUR TASK
Extract a JSON knowledge skill with this exact structure:
{
  "title": "Concise knowledge title (max 80 chars)",
  "summary": "2-4 sentence synthesis of the most important knowledge gained",
  "keyFindings": ["finding 1", "finding 2", ... up to 8 key findings],
  "validatedHypotheses": ["hypothesis 1", ... up to 5 validated hypotheses],
  "methodologies": ["methodology 1", ... up to 5 effective methodologies"],
  "keyTerms": ["term1", "term2", ... up to 10 domain-specific terms],
  "tags": ["tag1", "tag2", ... up to 6 tags for categorization]
}

Focus on:
- Findings with high confidence scores
- Methodologies that produced good results
- Knowledge that will help future researchers in this domain
- Practical, specific knowledge (not vague generalities)

Return ONLY the JSON object, no markdown fencing.`,
      }],
    });

    // Parse response
    let extracted: Partial<KnowledgeSkill> = {};
    for (const block of response.content) {
      if (block.type === 'text') {
        try {
          const text = block.text.trim();
          const jsonStart = text.indexOf('{');
          const jsonEnd = text.lastIndexOf('}');
          if (jsonStart >= 0 && jsonEnd > jsonStart) {
            extracted = JSON.parse(text.substring(jsonStart, jsonEnd + 1));
          }
        } catch (e) {
          console.warn('[KnowledgeSkill] JSON parse warning:', e);
        }
      }
    }

    // Find related skills in same domain
    const existingSkills = memoryStore.getSkillsByDomain(session.domain);
    const relatedIds = existingSkills.slice(0, 5).map(s => s.id);

    // Build the skill
    const skill: KnowledgeSkill = {
      id: uuidv4(),
      domain: session.domain,
      topic: session.topic,
      title: extracted.title || `Knowledge: ${session.topic}`,
      summary: extracted.summary || session.findings[0]?.content?.substring(0, 400) || '',
      keyFindings: extracted.keyFindings || this.extractTopFindings(session),
      validatedHypotheses: extracted.validatedHypotheses || [],
      methodologies: extracted.methodologies || [],
      keyTerms: extracted.keyTerms || [],
      topCitations: session.citations.slice(0, 8),
      confidenceScore: this.avgConfidence(session),
      qualityScore: session.metadata.qualityScore,
      usageCount: 0,
      tags: extracted.tags || [session.domain, session.topic.toLowerCase()],
      sourceSessionIds: [session.id],
      relatedSkillIds: relatedIds,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };

    // Update related skills to point to this new skill
    for (const relatedId of relatedIds) {
      const related = memoryStore.getSkill(relatedId);
      if (related && !related.relatedSkillIds.includes(skill.id)) {
        related.relatedSkillIds.push(skill.id);
        related.updatedAt = new Date().toISOString();
        memoryStore.saveSkill(related);
      }
    }

    // Save the skill
    memoryStore.saveSkill(skill);
    memoryStore.updateSessionSkillId(session.id, skill.id);

    console.log(`[KnowledgeSkill] Saved skill: ${skill.id} — "${skill.title}"`);
    return skill;
  }

  /**
   * Returns relevant prior knowledge to inject into a new session's context.
   * Searches by domain and topic keywords.
   */
  async buildKnowledgeContext(config: ResearchConfig): Promise<string> {
    const domainSkills = memoryStore.getSkillsByDomain(config.domain);
    const topicSkills = memoryStore.searchSkills(config.topic);

    // Merge and deduplicate, prioritizing by quality score
    const allSkills = [...domainSkills, ...topicSkills]
      .filter((s, idx, arr) => arr.findIndex(x => x.id === s.id) === idx)
      .sort((a, b) => b.qualityScore - a.qualityScore)
      .slice(0, 3);

    if (allSkills.length === 0) return '';

    // Increment usage count
    for (const skill of allSkills) {
      skill.usageCount += 1;
      skill.updatedAt = new Date().toISOString();
      memoryStore.saveSkill(skill);
    }

    const context = allSkills.map(skill => `
### Prior Knowledge: ${skill.title}
Domain: ${skill.domain} | Quality: ${skill.qualityScore}/100 | Sessions: ${skill.sourceSessionIds.length}
Updated: ${skill.updatedAt.substring(0, 10)}

**Summary**: ${skill.summary}

**Key Findings**:
${skill.keyFindings.map(f => `- ${f}`).join('\n')}

**Validated Methodologies**:
${skill.methodologies.map(m => `- ${m}`).join('\n')}

**Key Terms**: ${skill.keyTerms.join(', ')}

**Top Citations** (${skill.topCitations.length} verified):
${skill.topCitations.slice(0, 3).map(c =>
  `- ${c.authors.slice(0, 2).join(', ')} (${c.year}). "${c.title}"${c.doi ? `. DOI: ${c.doi}` : ''}`
).join('\n')}
`).join('\n---\n');

    return `## ACCUMULATED DOMAIN KNOWLEDGE (from ${allSkills.length} prior research session${allSkills.length > 1 ? 's' : ''})

${context}

> Use this prior knowledge as a foundation. Build upon it, don't repeat it verbatim.
`;
  }

  // ─── Private Helpers ────────────────────────────────────

  private buildSessionDigest(session: ResearchSession): string {
    const topFindings = session.findings
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 12);

    return `Topic: ${session.topic}
Domain: ${session.domain}
Research Question: ${session.researchQuestion}
Quality Score: ${session.metadata.qualityScore}/100
Total Findings: ${session.findings.length}
Total Citations: ${session.citations.length}

TOP FINDINGS:
${topFindings.map(f =>
  `[${f.agentRole}] (confidence: ${f.confidence.toFixed(2)}) ${f.title}\n${f.content.substring(0, 400)}`
).join('\n\n')}

PAPER ABSTRACT:
${session.paper?.abstract?.substring(0, 600) || 'Not yet generated'}

TOP CITATIONS:
${session.citations.slice(0, 6).map(c =>
  `- ${c.authors.slice(0, 2).join(', ')} (${c.year}). "${c.title}"${c.doi ? ` DOI: ${c.doi}` : ''}`
).join('\n')}`;
  }

  private extractTopFindings(session: ResearchSession): string[] {
    return session.findings
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 6)
      .map(f => `${f.title}: ${f.content.substring(0, 150)}`);
  }

  private avgConfidence(session: ResearchSession): number {
    if (session.findings.length === 0) return 0;
    const sum = session.findings.reduce((acc, f) => acc + f.confidence, 0);
    return Math.round((sum / session.findings.length) * 100) / 100;
  }
}

export const knowledgeSkillEngine = KnowledgeSkillEngine.getInstance();
