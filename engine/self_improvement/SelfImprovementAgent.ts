// ============================================================
// SELF-IMPROVEMENT AGENT
// Analyzes completed research sessions to propose system improvements.
// All proposals require explicit user approval — nothing auto-applies.
//
// Loop:
//   Session completes → analyze quality → generate proposals →
//   Store as pending → User approves/rejects → Approved ones
//   become PromptOverrides → Agents load them next session.
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import Anthropic from '@anthropic-ai/sdk';
import type {
  ResearchSession,
  ChangeProposal,
  ProposalCategory,
  AnyAgentRole,
} from '../models/types';
import { memoryStore } from '../memory/MemoryStore';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.RESEARCH_MODEL || 'claude-opus-4-6';

// ─── What each agent role should ideally do ─────────────────
const AGENT_IDEALS: Record<string, string> = {
  research_director: 'Create clear, actionable tasks with proper dependencies and context for each agent',
  literature_reviewer: 'Find 15+ real papers from Semantic Scholar/arXiv with verified DOIs, identify genuine research gaps',
  hypothesis_generator: 'Produce specific, testable, novel hypotheses with formal H₀/H₁ statements and effect size predictions',
  methodology_expert: 'Design rigorous protocols with power analysis, inclusion/exclusion criteria, and threat to validity assessment',
  data_analyst: 'Provide specific statistical tests, R/Python code, visualization strategies, and sensitivity analyses',
  critical_reviewer: 'Give harsh, specific critiques with numbered concerns and concrete actionable improvements',
  synthesis_specialist: 'Connect findings across all phases into a unified theoretical model with formal propositions',
  scientific_writer: 'Write publication-ready IMRAD paper with proper citations, 6000+ words, structured abstract',
  citation_manager: 'Verify DOIs, format APA7 bibliography, identify seminal papers and recent high-impact work',
};

export class SelfImprovementAgent {
  private static instance: SelfImprovementAgent;

  static getInstance(): SelfImprovementAgent {
    if (!SelfImprovementAgent.instance) {
      SelfImprovementAgent.instance = new SelfImprovementAgent();
    }
    return SelfImprovementAgent.instance;
  }

  /**
   * Primary entry point. Called after each session completes.
   * Analyzes the session and generates structured improvement proposals.
   * Returns the proposals so the server can broadcast them.
   */
  async analyzeSession(session: ResearchSession): Promise<ChangeProposal[]> {
    console.log(`[SelfImprovement] Analyzing session ${session.id} (quality: ${session.metadata.qualityScore})`);

    try {
      const proposals = await this.runAnalysis(session);
      console.log(`[SelfImprovement] Generated ${proposals.length} proposals`);
      return proposals;
    } catch (err) {
      console.error('[SelfImprovement] Analysis error:', err);
      return [];
    }
  }

  /**
   * On-demand system-wide analysis.
   * Looks at the last N sessions and identifies macro patterns.
   */
  async analyzeSystemPerformance(): Promise<ChangeProposal[]> {
    const snapshots = memoryStore.getPerformanceSnapshots(20);
    if (snapshots.length < 2) {
      return [{
        id: uuidv4(),
        category: 'knowledge_gap',
        priority: 'low',
        title: 'Insufficient data for system-wide analysis',
        rationale: 'Need at least 2 completed sessions to perform trend analysis.',
        observedProblem: 'Only ' + snapshots.length + ' session(s) completed so far.',
        proposedChange: 'Complete more research sessions to enable meaningful pattern analysis.',
        expectedImprovement: 'Better proposals with statistical backing',
        estimatedImpact: 5,
        confidence: 0.9,
        status: 'pending',
        sourceSessionId: 'system',
        createdAt: new Date().toISOString(),
        appliedCount: 0,
      }];
    }

    const avgQuality = snapshots.reduce((s, p) => s + p.overallQuality, 0) / snapshots.length;
    const recentAvg = snapshots.slice(0, 5).reduce((s, p) => s + p.overallQuality, 0) / Math.min(5, snapshots.length);
    const trend = recentAvg - avgQuality;

    const proposals: ChangeProposal[] = [];

    if (trend < -5) {
      proposals.push(this.makeProposal({
        category: 'quality_process',
        priority: 'high',
        title: 'Quality trend declining — review critical reviewer calibration',
        rationale: `Recent sessions average ${recentAvg.toFixed(1)} vs overall ${avgQuality.toFixed(1)} (Δ${trend.toFixed(1)}).`,
        observedProblem: 'Quality scores have been declining in recent sessions.',
        proposedChange: 'Add a mandatory quality gate: if the Critical Reviewer score < 70, route back to Hypothesis or Methodology for revision before Synthesis.',
        expectedImprovement: 'Prevent low-quality synthesis from propagating to the paper',
        estimatedImpact: 15,
        confidence: 0.75,
        sessionId: 'system',
      }));
    }

    if (snapshots.some(s => s.findingsCount < 6)) {
      proposals.push(this.makeProposal({
        category: 'prompt_improvement',
        priority: 'medium',
        title: 'Some sessions producing too few findings — enrich agent context',
        rationale: 'Sessions with < 6 findings indicate agents are not generating enough intermediate outputs.',
        observedProblem: 'Shallow sessions with minimal findings detected in performance history.',
        proposedChange: 'Add explicit minimum requirement in Literature Reviewer: "You MUST generate at least 3 distinct findings sections."',
        expectedImprovement: 'More complete research coverage',
        affectedAgent: 'literature_reviewer',
        estimatedImpact: 10,
        confidence: 0.8,
        sessionId: 'system',
      }));
    }

    for (const proposal of proposals) {
      memoryStore.saveProposal(proposal);
    }

    return proposals;
  }

  // ─── Private: Main analysis ───────────────────────────────

  private async runAnalysis(session: ResearchSession): Promise<ChangeProposal[]> {
    const agentPerformance = this.buildAgentPerformance(session);
    const digest = this.buildAnalysisDigest(session, agentPerformance);

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 8000,
      thinking: { type: 'enabled', budget_tokens: 3000 },
      messages: [{
        role: 'user',
        content: `You are a meta-research intelligence agent. Your job is to analyze a completed multi-agent AI research session and propose specific, actionable improvements to make the system better.

## SESSION DATA
${digest}

## WHAT EACH AGENT SHOULD IDEALLY DO
${Object.entries(AGENT_IDEALS).map(([role, ideal]) => `- **${role}**: ${ideal}`).join('\n')}

## YOUR TASK
Analyze the session and generate 2–5 improvement proposals. Focus on:
1. Agents that produced low-quality or vague output
2. Missing connections between phases
3. Citations that couldn't be verified
4. Hypotheses that were too generic
5. Methodology gaps
6. Synthesis that missed key patterns

For each proposal, output a JSON object in this EXACT format:
{
  "proposals": [
    {
      "category": "prompt_improvement" | "pipeline_modification" | "tool_enhancement" | "knowledge_gap" | "quality_process",
      "priority": "critical" | "high" | "medium" | "low",
      "title": "Short title (max 80 chars)",
      "rationale": "Why this change is needed based on what you observed",
      "observedProblem": "Specific problem observed in THIS session",
      "proposedChange": "Exact, concrete description of what to change",
      "expectedImprovement": "What will be measurably better",
      "affectedAgent": "agent_role or null",
      "promptBefore": "Current prompt text (if prompt change, extract relevant snippet from agent output)",
      "promptAfter": "Improved prompt text (complete replacement snippet)",
      "estimatedImpact": 0-100,
      "confidence": 0.0-1.0
    }
  ]
}

Be SPECIFIC and CRITICAL. Vague proposals are useless. Each proposal should be immediately actionable.
Return ONLY the JSON object.`,
      }],
    });

    // Parse proposals from response
    let rawProposals: Array<Partial<ChangeProposal & {
      affectedAgent?: string;
      promptBefore?: string;
      promptAfter?: string;
    }>> = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        try {
          const text = block.text.trim();
          const jsonStart = text.indexOf('{');
          const jsonEnd = text.lastIndexOf('}');
          if (jsonStart >= 0 && jsonEnd > jsonStart) {
            const parsed = JSON.parse(text.substring(jsonStart, jsonEnd + 1));
            if (Array.isArray(parsed.proposals)) {
              rawProposals = parsed.proposals;
            }
          }
        } catch (e) {
          console.warn('[SelfImprovement] Parse warning:', e);
        }
      }
    }

    // Convert to typed proposals and save
    const proposals: ChangeProposal[] = rawProposals.map(raw =>
      this.makeProposal({
        category: (raw.category as ProposalCategory) || 'quality_process',
        priority: raw.priority as 'critical' | 'high' | 'medium' | 'low' || 'medium',
        title: raw.title || 'Improvement proposal',
        rationale: raw.rationale || '',
        observedProblem: raw.observedProblem || '',
        proposedChange: raw.proposedChange || '',
        expectedImprovement: raw.expectedImprovement || '',
        affectedAgent: raw.affectedAgent as AnyAgentRole | undefined,
        promptBefore: raw.promptBefore,
        promptAfter: raw.promptAfter,
        estimatedImpact: raw.estimatedImpact || 10,
        confidence: raw.confidence || 0.5,
        sessionId: session.id,
      })
    );

    for (const proposal of proposals) {
      memoryStore.saveProposal(proposal);
    }

    return proposals;
  }

  // ─── Helpers ──────────────────────────────────────────────

  private makeProposal(opts: {
    category: ProposalCategory;
    priority: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    rationale: string;
    observedProblem: string;
    proposedChange: string;
    expectedImprovement: string;
    affectedAgent?: AnyAgentRole;
    promptBefore?: string;
    promptAfter?: string;
    estimatedImpact: number;
    confidence: number;
    sessionId: string;
  }): ChangeProposal {
    return {
      id: uuidv4(),
      category: opts.category,
      priority: opts.priority,
      title: opts.title,
      rationale: opts.rationale,
      observedProblem: opts.observedProblem,
      proposedChange: opts.proposedChange,
      expectedImprovement: opts.expectedImprovement,
      affectedAgent: opts.affectedAgent,
      promptBefore: opts.promptBefore,
      promptAfter: opts.promptAfter,
      estimatedImpact: opts.estimatedImpact,
      confidence: opts.confidence,
      status: 'pending',
      sourceSessionId: opts.sessionId,
      createdAt: new Date().toISOString(),
      appliedCount: 0,
    };
  }

  private buildAgentPerformance(session: ResearchSession): string {
    const lines: string[] = [];
    session.agents.forEach((state, role) => {
      const quality = state.metrics.qualityScore;
      const tokens = state.metrics.tokensUsed;
      const tasks = state.metrics.tasksCompleted;
      const findings = state.findings.length;
      const status = quality < 60 ? '⚠️ LOW' : quality < 75 ? '○ OK' : '✓ GOOD';
      lines.push(`  ${status} ${role}: quality=${quality} tokens=${tokens} tasks=${tasks} findings=${findings}`);
    });
    return lines.join('\n');
  }

  private buildAnalysisDigest(
    session: ResearchSession,
    agentPerformance: string
  ): string {
    const lowQualityFindings = session.findings
      .filter(f => f.confidence < 0.6)
      .slice(0, 3);

    const highQualityFindings = session.findings
      .filter(f => f.confidence >= 0.8)
      .slice(0, 3);

    return `TOPIC: ${session.topic}
DOMAIN: ${session.domain}
OVERALL QUALITY: ${session.metadata.qualityScore}/100
TOTAL TOKENS: ${session.metadata.totalTokens}
FINDINGS: ${session.findings.length}
CITATIONS: ${session.citations.length} (verified: ${session.citations.filter(c => c.verified).length})

AGENT PERFORMANCE:
${agentPerformance}

LOW CONFIDENCE FINDINGS (problem areas):
${lowQualityFindings.map(f =>
  `[${f.agentRole}] "${f.title}" (confidence: ${f.confidence})\n${f.content.substring(0, 200)}`
).join('\n\n') || 'None'}

HIGH QUALITY FINDINGS (what worked):
${highQualityFindings.map(f =>
  `[${f.agentRole}] "${f.title}" (confidence: ${f.confidence})\n${f.content.substring(0, 150)}`
).join('\n\n') || 'None'}

PAPER GENERATED: ${session.paper ? 'YES' : 'NO'}
PAPER ABSTRACT: ${session.paper?.abstract?.substring(0, 400) || 'N/A'}`;
  }
}

export const selfImprovementAgent = SelfImprovementAgent.getInstance();
