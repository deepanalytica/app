// ============================================================
// LITERATURE REVIEW AGENT — Academic Knowledge Synthesizer
// Searches, evaluates, and synthesizes scientific literature
// ============================================================

import { BaseAgent, type AgentConfig, type EventEmitFn } from './BaseAgent';
import { MessageBus } from '../coordination/MessageBus';
import type { ResearchTask, TaskResult } from '../models/types';
import {
  academicSearchTools,
  executeAcademicSearchTool,
} from '../tools/AcademicSearchTool';

const SYSTEM_PROMPT = `You are a world-class academic librarian and systematic review specialist with expertise across all scientific disciplines. You have a photographic memory of millions of scientific papers and can instantly identify the most relevant, high-quality research.

Your responsibilities:
1. SYSTEMATICALLY search and identify relevant literature using multiple academic databases
2. EVALUATE source quality, impact factor, methodology rigor, and citation metrics
3. SYNTHESIZE findings across multiple studies, identifying consensus and controversies
4. IDENTIFY knowledge gaps, contradictions, and emerging research directions
5. CREATE comprehensive literature maps showing how studies relate to each other
6. EXTRACT key methodologies, findings, and theoretical contributions

You approach literature review with the rigor of a systematic review for a Cochrane Review or meta-analysis. You think critically about:
- Publication bias and its effects
- Methodological quality (RCTs vs observational, sample sizes, effect sizes)
- Theoretical frameworks and their evolution
- Interdisciplinary connections

You always cite specific papers with authors, year, journal, and key findings. You distinguish between:
- Foundational/seminal works (must-cite)
- Recent high-impact papers (< 5 years)
- Controversial or contested findings
- Meta-analyses and systematic reviews (highest evidence level)`;

export class LiteratureReviewAgent extends BaseAgent {
  constructor(messageBus: MessageBus, emitEvent: EventEmitFn) {
    const config: AgentConfig = {
      role: 'literature_reviewer',
      name: 'Dr. Literature Reviewer',
      expertise: 'Systematic Reviews, Meta-Analysis, Academic Database Mining, Evidence Synthesis',
      systemPrompt: SYSTEM_PROMPT,
      maxTokens: 32000,
    };
    super(config, messageBus, emitEvent);
  }

  async executeTask(task: ResearchTask, sessionContext: string): Promise<TaskResult> {
    const start = Date.now();
    this.updateStatus('working', 'Conducting systematic literature review');

    // Compute current date so Claude knows the upper bound for "recent papers"
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentDateStr = now.toISOString().split('T')[0]; // e.g. "2026-02-21"
    const recentYearFrom = currentYear - 5;                 // e.g. 2021 for a 5-year window

    const prompt = `
# Systematic Literature Review

**TODAY'S DATE: ${currentDateStr}**
**CURRENT YEAR: ${currentYear}**

When using search tools:
- For RECENT papers (last 5 years): set year_from=${recentYearFrom}, year_to=${currentYear}
- For SEMINAL works (no date restriction): omit year_from and year_to
- Never retrieve papers beyond year ${currentYear} — they do not exist yet

## Research Context
${sessionContext}

## Task
${task.description}

## Instructions

Conduct a comprehensive systematic literature review following PRISMA guidelines. Structure your review as follows:

### 1. SEARCH STRATEGY
- Databases searched: Semantic Scholar, arXiv, CrossRef (via real-time API calls)
- Search terms and Boolean operators used
- Inclusion/exclusion criteria
- Time range: seminal works (all years) + recent papers (${recentYearFrom}–${currentYear})

### 2. SEMINAL WORKS (5-10 papers)
For each foundational paper, provide:
- Full citation (Authors, Year, Title, Journal, DOI)
- Key contribution and why it's seminal
- Methodology used
- Main findings and their significance
- Limitations acknowledged
- Citation count (approximate)

### 3. RECENT HIGH-IMPACT RESEARCH (10-15 papers, ${recentYearFrom}–${currentYear})
For each paper:
- Full citation
- How it advances the field
- Methodology and sample
- Key findings with effect sizes/statistics
- Relationship to seminal works

### 4. META-ANALYSES & SYSTEMATIC REVIEWS
- List any existing systematic reviews or meta-analyses
- Their findings and confidence levels
- Heterogeneity issues if present

### 5. THEORETICAL FRAMEWORKS
- Dominant theories in this field
- Competing theoretical perspectives
- Theoretical gaps and controversies

### 6. KNOWLEDGE GAPS
- What questions remain unanswered
- Contradictions in the literature
- Methodological limitations across studies
- Emerging research directions

### 7. EVIDENCE QUALITY ASSESSMENT
- Overall quality of evidence (using GRADE framework)
- Risk of bias across studies
- Publication bias assessment

### 8. SYNTHESIS NARRATIVE
A 2-3 paragraph synthesis of what the literature collectively tells us about the research question.

IMPORTANT: All papers returned by the search tools are REAL papers retrieved live from academic databases.
Cite them accurately using the exact metadata (title, authors, year, DOI) returned by the tools.
Do NOT invent or guess any citations — only use papers confirmed by the search tools.
Today is ${currentDateStr}; do not cite papers with a year later than ${currentYear}.
`;

    // Use real academic search tools if enabled (via environment variable or config)
    const useRealSearch = process.env.ENABLE_REAL_SEARCH !== 'false'; // default: on
    let result: { text: string; thinking: string; tokensUsed: number; thinkingTokens: number; toolCallCount?: number };

    if (useRealSearch) {
      result = await this.callClaudeWithTools(
        prompt,
        academicSearchTools,
        executeAcademicSearchTool,
        undefined,
        5 // max tool rounds — will search multiple queries
      );
    } else {
      result = await this.callClaude(prompt);
    }

    const finding = this.createFinding(
      'Systematic Literature Review',
      result.text,
      'literature_review',
      0.88,
      ['Systematic database search', 'PRISMA methodology', 'Quality assessment'],
      ['literature', 'systematic-review', 'evidence', 'papers']
    );

    // Create specific findings for key papers
    const gapsFinding = this.createFinding(
      'Knowledge Gaps & Research Opportunities',
      this.extractSection(result.text, 'KNOWLEDGE GAPS') ||
        'Knowledge gaps identified during literature review - see main review document.',
      'literature_review',
      0.85,
      ['Literature analysis'],
      ['gaps', 'opportunities', 'future-research']
    );

    this.state.metrics.tasksCompleted++;
    this.updateStatus('completed', 'Literature review complete');

    return {
      taskId: task.id,
      agentRole: this.config.role,
      success: true,
      findings: [finding, gapsFinding],
      data: {
        review: result.text,
        thinking: result.thinking,
      },
      tokensUsed: result.tokensUsed,
      thinkingTokens: result.thinkingTokens,
      duration: Date.now() - start,
      timestamp: new Date(),
    };
  }

  private extractSection(text: string, sectionName: string): string | null {
    const regex = new RegExp(
      `###\\s*\\d*\\.?\\s*${sectionName}([\\s\\S]*?)(?=###|$)`,
      'i'
    );
    const match = text.match(regex);
    return match ? match[1].trim() : null;
  }
}
