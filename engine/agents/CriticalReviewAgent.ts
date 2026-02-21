// ============================================================
// CRITICAL REVIEW AGENT — Scientific Peer Reviewer
// Rigorously evaluates all research for quality and validity
// ============================================================

import { BaseAgent, type AgentConfig, type EventEmitFn } from './BaseAgent';
import { MessageBus } from '../coordination/MessageBus';
import type { ResearchTask, TaskResult } from '../models/types';

const SYSTEM_PROMPT = `You are the most rigorous peer reviewer in academia — the brilliant, demanding critic who ensures only the best science passes scrutiny. You have reviewed for Nature, Science, Cell, NEJM, The Lancet, and all major field-specific journals.

Your review philosophy:
- "The plural of anecdote is not data"
- Extraordinary claims require extraordinary evidence
- Statistical significance ≠ scientific significance
- Correlation ≠ causation (always check causal reasoning)
- Replication crisis awareness — be skeptical of novel findings

You systematically evaluate:
METHODOLOGICAL RIGOR:
- Experimental control and confound management
- Statistical assumptions and their validity
- Sample representativeness and size adequacy
- Measurement validity and reliability
- Potential for p-hacking or HARKing

LOGICAL CONSISTENCY:
- Do conclusions follow from the data?
- Are alternative explanations considered?
- Is the theoretical framework internally consistent?
- Are generalizations appropriately scoped?

EVIDENCE QUALITY:
- Are sources credible and current?
- Is citation appropriate and unbiased?
- Are effect sizes meaningful in practice?
- Is the evidence triangulated from multiple sources?

You provide CONSTRUCTIVE criticism that makes research stronger, not just negativity. You identify FATAL flaws vs. minor issues, and suggest specific improvements for each problem identified.`;

export class CriticalReviewAgent extends BaseAgent {
  constructor(messageBus: MessageBus, emitEvent: EventEmitFn) {
    const config: AgentConfig = {
      role: 'critical_reviewer',
      name: 'Dr. Critical Reviewer',
      expertise: 'Peer Review, Methodology Evaluation, Scientific Validity, Bias Detection',
      systemPrompt: SYSTEM_PROMPT,
      maxTokens: 28000,
    };
    super(config, messageBus, emitEvent);
  }

  async executeTask(task: ResearchTask, sessionContext: string): Promise<TaskResult> {
    const start = Date.now();
    this.updateStatus('reviewing', 'Conducting rigorous critical review');

    const prompt = `
# Critical Scientific Review

## Research Context
${sessionContext}

## Task
${task.description}

## Instructions

Conduct a thorough, rigorous critical review of the research approach, findings, and conclusions developed so far. Be the strictest peer reviewer this work will face.

### 1. EXECUTIVE SUMMARY OF REVIEW

**Overall Assessment:** [Accept / Major Revisions / Minor Revisions / Reject with explanation]

**Significance Score:** [1-10, where 10 = transformative]
**Rigor Score:** [1-10, where 10 = flawless methodology]
**Novelty Score:** [1-10, where 10 = completely new contribution]
**Clarity Score:** [1-10, where 10 = perfectly written]

**One-paragraph summary of strengths:**
[...]

**One-paragraph summary of major concerns:**
[...]

---

### 2. MAJOR CONCERNS (Must address before publication)

For each major concern:
**Concern 1: [Title]**
- Description: [Detailed explanation of the problem]
- Impact: [How this undermines the research]
- Suggested fix: [Specific, actionable remedy]
- Literature support: [Papers that support this critique]

[Repeat for each major concern — aim for 3-5 substantive issues]

---

### 3. METHODOLOGICAL CRITIQUE

#### 3a. Research Design
- Is the design appropriate for the research question? [Yes/No/Partially — explain]
- What confounds are inadequately controlled?
- What alternative designs should have been considered?

#### 3b. Statistical Analysis
- Are the statistical tests appropriate?
- Were assumptions tested and met?
- Is statistical power adequate?
- Are multiple comparisons addressed?
- Are effect sizes reported and interpretable?
- Is there evidence of p-hacking or HARKing?

#### 3c. Sampling & Generalizability
- Is the sample representative of the target population?
- What limits external validity?
- Who does this research NOT apply to?

#### 3d. Measurement
- Are constructs validly measured?
- What common method bias risks exist?
- Are outcome measures appropriate?

---

### 4. THEORETICAL & CONCEPTUAL ISSUES

- Are the theoretical foundations solid?
- Are constructs clearly defined and operationalized?
- Are the hypotheses derivable from the stated theory?
- Are alternative theoretical explanations considered?
- Is the theoretical contribution clear and significant?

---

### 5. SPECIFIC LINE-BY-LINE CRITIQUES

Review the literature review, hypotheses, and methodology for:
- Unsupported claims
- Logical leaps
- Missing key citations
- Overgeneralizations
- Inconsistencies between sections

---

### 6. STRENGTHS & POSITIVE ASPECTS

What is genuinely commendable:
1. [Strength 1 — be specific]
2. [Strength 2]
3. [Strength 3]

---

### 7. MINOR CONCERNS

- [Minor issue 1]
- [Minor issue 2]
- [etc. — smaller issues that should be fixed but won't invalidate the work]

---

### 8. RECOMMENDATIONS FOR IMPROVEMENT

Priority improvements (in order of importance):
1. **[Most critical]**: [Specific action required]
2. **[Second priority]**: [Specific action required]
3. **[Third priority]**: [Specific action required]
4. **[Additional]**: [...]
5. **[Optional enhancement]**: [...]

---

### 9. COMPARISON TO FIELD STANDARDS

How does this work compare to:
- The best papers in this field (e.g., published in top journals)?
- Current methodological best practices?
- Open science standards (pre-registration, data sharing)?

**Gap to top-tier publication:** [What would it take to reach Nature/Science level?]

---

### 10. REVISED VERDICT

After full review, provide:
- Final recommendation with justification
- Estimated probability of acceptance in [target journal tier]
- The single most important improvement to make
`;

    const result = await this.callClaude(prompt);

    const finding = this.createFinding(
      'Critical Peer Review — Quality Assessment',
      result.text,
      'critical_review',
      0.92,
      ['Methodological evaluation', 'Bias detection', 'Quality standards'],
      ['peer-review', 'critique', 'quality', 'validity', 'limitations']
    );

    this.state.metrics.tasksCompleted++;
    this.updateStatus('completed', 'Critical review complete');

    return {
      taskId: task.id,
      agentRole: this.config.role,
      success: true,
      findings: [finding],
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
}
