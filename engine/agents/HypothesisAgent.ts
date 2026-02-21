// ============================================================
// HYPOTHESIS GENERATION AGENT — Scientific Hypothesis Architect
// Formulates, refines, and validates research hypotheses
// ============================================================

import { BaseAgent, type AgentConfig, type EventEmitFn } from './BaseAgent';
import { MessageBus } from '../coordination/MessageBus';
import type { ResearchTask, TaskResult } from '../models/types';

const SYSTEM_PROMPT = `You are a brilliant scientific theorist and hypothesis architect — the mind that generates the innovative ideas that drive breakthrough research. You combine deep domain expertise with creative thinking to formulate hypotheses that are:

1. SCIENTIFICALLY GROUNDED — based on existing evidence and theory
2. NOVEL — offering new perspectives not fully explored in the literature
3. TESTABLE — can be empirically verified or falsified
4. SPECIFIC — clearly defined with measurable variables
5. PLAUSIBLE — mechanistically sound and logically coherent

You excel at:
- Identifying hidden patterns and connections across disciplines
- Formulating hypotheses at different levels (mechanistic, functional, theoretical)
- Generating competing alternative hypotheses
- Assessing prior probability and expected effect sizes
- Identifying confounds and moderating variables

Your hypothesis generation follows the Hypothetico-Deductive Method:
1. Observation → Question → Hypothesis → Prediction → Test

For each hypothesis, you provide:
- The formal null (H₀) and alternative hypothesis (H₁)
- Theoretical rationale
- Predicted effect direction and magnitude
- Key variables and their operationalization
- Potential confounds and controls needed
- Methods best suited to test it
- Prior probability assessment (based on theory and literature)`;

export class HypothesisAgent extends BaseAgent {
  constructor(messageBus: MessageBus, emitEvent: EventEmitFn) {
    const config: AgentConfig = {
      role: 'hypothesis_generator',
      name: 'Dr. Hypothesis Generator',
      expertise: 'Theoretical Modeling, Causal Inference, Scientific Reasoning, Theory Development',
      systemPrompt: SYSTEM_PROMPT,
      maxTokens: 28000,
    };
    super(config, messageBus, emitEvent);
  }

  async executeTask(task: ResearchTask, sessionContext: string): Promise<TaskResult> {
    const start = Date.now();
    this.updateStatus('working', 'Generating and evaluating research hypotheses');

    const prompt = `
# Research Hypothesis Generation & Evaluation

## Research Context
${sessionContext}

## Task
${task.description}

## Instructions

Generate a comprehensive set of scientifically rigorous hypotheses. Structure your output as:

### 1. PRIMARY RESEARCH HYPOTHESIS

**H₀ (Null Hypothesis):**
[Formal statement of the null hypothesis]

**H₁ (Alternative Hypothesis):**
[Formal statement of the alternative hypothesis — directional if appropriate]

**Theoretical Rationale:**
[2-3 paragraphs explaining WHY this relationship should exist, grounded in theory and evidence]

**Predicted Effect:**
- Direction: [positive/negative/non-linear]
- Expected magnitude: [small/medium/large per Cohen's d, r, or η²]
- Confidence in prediction: [0-100%]

**Key Variables:**
- Independent Variable(s): [name, operationalization, measurement]
- Dependent Variable(s): [name, operationalization, measurement]
- Mediating Variables: [if applicable]
- Moderating Variables: [if applicable]

**Potential Confounds:** [list with control strategies]

**Best Testing Approach:** [methodology recommendation]

---

### 2. SECONDARY HYPOTHESES (3-5)

[For each secondary hypothesis, provide the same structure as above but more concise]

**Hypothesis 2A:** [...]
**Hypothesis 2B:** [...]
**Hypothesis 2C:** [...]

---

### 3. COMPETING ALTERNATIVE HYPOTHESES

What alternative explanations exist that could produce the same observations?
- Alternative 1: [...]
- Alternative 2: [...]
- Alternative 3: [...]
How would you distinguish between these alternatives?

---

### 4. MECHANISTIC HYPOTHESES

What are the underlying mechanisms or pathways?
- Proposed mechanism: [...]
- Intermediate steps: [...]
- Testable predictions of the mechanism: [...]

---

### 5. BOUNDARY CONDITIONS

Under what conditions would the hypothesis hold vs. fail?
- Contexts where effect is expected to be strongest
- Contexts where effect might be absent or reversed
- Population/sample constraints

---

### 6. HYPOTHESIS EVALUATION MATRIX

| Hypothesis | Novelty (1-10) | Testability (1-10) | Theoretical Basis (1-10) | Priority |
|------------|----------------|---------------------|---------------------------|----------|
| Primary H₁ | X | X | X | 1st |
| H 2A | X | X | X | 2nd |
[etc.]

---

### 7. RESEARCH PREDICTIONS

Specific, quantifiable predictions that follow from the hypotheses:
1. [Specific measurable prediction]
2. [Specific measurable prediction]
3. [Specific measurable prediction]

These predictions should be precise enough that a researcher could go collect data to test them.
`;

    const result = await this.callClaude(prompt);

    const primaryFinding = this.createFinding(
      'Primary Research Hypothesis',
      result.text,
      'hypothesis_formation',
      0.82,
      ['Theory-driven hypothesis generation', 'Literature synthesis'],
      ['hypothesis', 'h0', 'h1', 'predictions', 'variables']
    );

    this.state.metrics.tasksCompleted++;
    this.updateStatus('completed', 'Hypotheses generated');

    return {
      taskId: task.id,
      agentRole: this.config.role,
      success: true,
      findings: [primaryFinding],
      data: {
        hypotheses: result.text,
        thinking: result.thinking,
      },
      tokensUsed: result.tokensUsed,
      thinkingTokens: result.thinkingTokens,
      duration: Date.now() - start,
      timestamp: new Date(),
    };
  }
}
