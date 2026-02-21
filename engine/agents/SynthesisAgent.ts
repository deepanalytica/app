// ============================================================
// SYNTHESIS SPECIALIST AGENT — Knowledge Integration Expert
// Integrates all findings into coherent scientific narrative
// ============================================================

import { BaseAgent, type AgentConfig, type EventEmitFn } from './BaseAgent';
import { MessageBus } from '../coordination/MessageBus';
import type { ResearchTask, TaskResult } from '../models/types';

const SYSTEM_PROMPT = `You are a master synthesizer — the intellectual architect who transforms diverse research findings into unified, coherent scientific knowledge. You possess the rare ability to:

1. INTEGRATE findings from multiple disciplines and methodologies
2. IDENTIFY emergent patterns that are invisible in individual studies
3. RESOLVE apparent contradictions through higher-order frameworks
4. CONSTRUCT theoretical frameworks that explain observed patterns
5. GENERATE novel insights that transcend any individual finding
6. TRANSLATE complex findings into clear, impactful narratives

Your synthesis philosophy:
- The whole is greater than the sum of its parts
- Look for second-order and third-order patterns
- What does the evidence COLLECTIVELY tell us?
- What are the boundary conditions of any conclusion?
- How does this change what we know?

You excel at:
- Cross-study meta-synthesis
- Theory building from grounded evidence
- Identifying moderators and mediators across findings
- Constructing conceptual models and frameworks
- Writing executive summaries that capture the essence
- Translating findings for different audiences (academic, policy, public)

Your syntheses are characterized by:
- Clear hierarchical organization of ideas
- Appropriate hedging (don't overclaim, don't underclaim)
- Identification of what is CERTAIN vs. PROBABLE vs. POSSIBLE
- Clear separation of findings from interpretations
- Forward-looking implications`;

export class SynthesisAgent extends BaseAgent {
  constructor(messageBus: MessageBus, emitEvent: EventEmitFn) {
    const config: AgentConfig = {
      role: 'synthesis_specialist',
      name: 'Dr. Synthesis Specialist',
      expertise: 'Knowledge Integration, Theory Building, Meta-Synthesis, Cross-Domain Analysis',
      systemPrompt: SYSTEM_PROMPT,
      maxTokens: 32000,
    };
    super(config, messageBus, emitEvent);
  }

  async executeTask(task: ResearchTask, sessionContext: string): Promise<TaskResult> {
    const start = Date.now();
    this.updateStatus('working', 'Synthesizing all research findings');

    const prompt = `
# Comprehensive Research Synthesis

## Research Context
${sessionContext}

## Task
${task.description}

## Instructions

Create a masterful synthesis of all research components. This synthesis will serve as the intellectual backbone of the final paper.

### 1. THE BIG PICTURE — What We Now Know

Write a compelling 3-4 paragraph narrative that tells the story of what the research collectively reveals. This should:
- Answer the central research question definitively (or explain why it can't be fully answered yet)
- Show how the pieces fit together
- Highlight the most important discoveries
- Convey the significance without hyperbole

---

### 2. INTEGRATED THEORETICAL FRAMEWORK

Construct a unified theoretical framework that:
- Integrates findings from all research phases
- Specifies the relationships between key constructs
- Explains the mechanisms underlying observed effects
- Identifies boundary conditions and moderators
- Shows how this advances or modifies existing theory

**Conceptual Model:**
[Describe the model with its components, relationships, and directionality]

**Key Propositions:**
1. Proposition 1: [Formal statement] — Evidence: [supporting findings]
2. Proposition 2: [Formal statement] — Evidence: [supporting findings]
3. Proposition 3: [Formal statement] — Evidence: [supporting findings]
[etc.]

---

### 3. EVIDENCE STRENGTH ASSESSMENT

For each major conclusion, rate evidence quality:

| Conclusion | Evidence Quality | Confidence Level | Caveats |
|------------|-----------------|-----------------|---------|
| [Claim 1] | Strong/Moderate/Weak | High/Medium/Low | [caveats] |
| [Claim 2] | Strong/Moderate/Weak | High/Medium/Low | [caveats] |
| [Claim 3] | Strong/Moderate/Weak | High/Medium/Low | [caveats] |

Use GRADE framework:
- High: Very unlikely that further research will change confidence
- Moderate: Further research likely to have impact
- Low: Further research likely to change estimate
- Very Low: Estimate very uncertain

---

### 4. RESOLVING CONTRADICTIONS

Where the evidence is mixed or contradictory:
- **Contradiction 1**: [Two opposing findings]
  - Most likely explanation: [...]
  - How to resolve: [...]
  - Remaining uncertainty: [...]

---

### 5. EMERGENT INSIGHTS

What insights emerge from the synthesis that weren't visible in individual findings?
1. **Emergent insight 1**: [...]
   - This was not obvious from any single study/phase
   - It only becomes clear when [...]
   - Implications: [...]

2. **Emergent insight 2**: [...]

---

### 6. WHAT WE DON'T KNOW — Remaining Uncertainties

Honest assessment of what remains unclear:
- **High-priority unknown 1**: [What we don't know, why it matters, how to find out]
- **High-priority unknown 2**: [...]
- **Moderate-priority unknowns**: [...]

---

### 7. IMPLICATIONS

#### 7a. Theoretical Implications
- How does this change or advance existing theory?
- What new theoretical directions does this open?
- What theoretical questions does this resolve?

#### 7b. Practical/Applied Implications
- For practitioners/policymakers: [Specific, actionable implications]
- For organizations/institutions: [...]
- For individuals: [if applicable]

#### 7c. Future Research Directions (Priority-ordered)
1. **Most critical next step**: [Specific study design]
2. **Second priority**: [...]
3. **Longer-term agenda**: [...]

---

### 8. CONCLUSIONS

**Primary conclusion** (one sentence): [The clearest, most defensible conclusion]

**Secondary conclusions** (3-5):
1. [...]
2. [...]
3. [...]

**The "So What?" statement**: [Why should anyone care about these findings? What changes because of this research?]

---

### 9. ABSTRACT DRAFT

Write a 250-word structured abstract:
**Background:** [context and gap]
**Objective:** [research question]
**Methods:** [brief methodology]
**Results:** [key findings with statistics]
**Conclusions:** [what it means]
**Keywords:** [5-8 keywords]
`;

    const result = await this.callClaude(prompt);

    const primarySynthesis = this.createFinding(
      'Comprehensive Research Synthesis',
      result.text,
      'synthesis',
      0.91,
      ['Multi-phase integration', 'Theory development', 'Evidence triangulation'],
      ['synthesis', 'integration', 'framework', 'conclusions', 'implications']
    );

    this.state.metrics.tasksCompleted++;
    this.updateStatus('completed', 'Synthesis complete');

    return {
      taskId: task.id,
      agentRole: this.config.role,
      success: true,
      findings: [primarySynthesis],
      data: {
        synthesis: result.text,
        thinking: result.thinking,
      },
      tokensUsed: result.tokensUsed,
      thinkingTokens: result.thinkingTokens,
      duration: Date.now() - start,
      timestamp: new Date(),
    };
  }
}
