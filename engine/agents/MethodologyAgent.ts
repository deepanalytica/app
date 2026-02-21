// ============================================================
// METHODOLOGY EXPERT AGENT — Research Design Architect
// Designs rigorous research methodologies and study designs
// ============================================================

import { BaseAgent, type AgentConfig, type EventEmitFn } from './BaseAgent';
import { MessageBus } from '../coordination/MessageBus';
import type { ResearchTask, TaskResult } from '../models/types';

const SYSTEM_PROMPT = `You are a master research methodologist with expertise across quantitative, qualitative, and mixed-methods research design. You have deep knowledge of:

QUANTITATIVE METHODS:
- Experimental design (RCTs, quasi-experiments, factorial designs)
- Survey methodology and psychometrics
- Longitudinal and cross-sectional designs
- Power analysis and sample size calculation
- Statistical modeling (regression, SEM, MLM, Bayesian methods)

QUALITATIVE METHODS:
- Grounded theory, phenomenology, ethnography
- Thematic analysis, discourse analysis
- Case study design, narrative research
- Trustworthiness and rigor criteria

MIXED METHODS:
- Sequential, concurrent, and embedded designs
- Integration strategies
- Handling complexity and breadth

SPECIALIZED TECHNIQUES:
- Meta-analysis and systematic review methodology
- Network analysis and computational methods
- Machine learning approaches for research
- Natural experiments and econometric methods
- Neuroimaging, biomarker, and physiological measurement

You design methodologies that are:
1. APPROPRIATE — match the research question and hypothesis
2. RIGOROUS — minimize threats to internal and external validity
3. FEASIBLE — practical and ethical
4. POWERFUL — adequate statistical power to detect expected effects
5. REPRODUCIBLE — detailed enough for exact replication`;

export class MethodologyAgent extends BaseAgent {
  constructor(messageBus: MessageBus, emitEvent: EventEmitFn) {
    const config: AgentConfig = {
      role: 'methodology_expert',
      name: 'Dr. Methodology Expert',
      expertise: 'Research Design, Statistical Methods, Experimental Design, Psychometrics',
      systemPrompt: SYSTEM_PROMPT,
      maxTokens: 28000,
    };
    super(config, messageBus, emitEvent);
  }

  async executeTask(task: ResearchTask, sessionContext: string): Promise<TaskResult> {
    const start = Date.now();
    this.updateStatus('working', 'Designing optimal research methodology');

    const prompt = `
# Research Methodology Design

## Research Context
${sessionContext}

## Task
${task.description}

## Instructions

Design a comprehensive, rigorous research methodology. Structure your response as:

### 1. RECOMMENDED RESEARCH DESIGN

**Primary Approach:** [Quantitative/Qualitative/Mixed Methods — justify choice]

**Specific Design:** [e.g., Randomized Controlled Trial, Grounded Theory, Sequential Explanatory]

**Justification:** [Why this design is optimal for the research question, with alternatives considered]

**Philosophical Paradigm:** [Positivist/Interpretive/Critical/Pragmatic — and why]

---

### 2. STUDY DESIGN SPECIFICATIONS

#### 2a. Sampling Strategy
- Target Population: [precise definition]
- Sampling Method: [probability/non-probability — specific type]
- Inclusion Criteria: [list all]
- Exclusion Criteria: [list all]
- Sample Size Calculation:
  - Effect size (d, r, or η²): [estimated from literature]
  - Alpha level: [typically 0.05]
  - Power (1-β): [typically 0.80 or 0.90]
  - Required N: [calculated]
  - Accounting for attrition: [adjusted N]

#### 2b. Data Collection Methods
- Primary measures: [instruments, tools, scales]
- Secondary measures: [additional variables]
- Timing: [when data is collected]
- Procedure: [step-by-step protocol]
- Training requirements: [for data collectors]

#### 2c. Instrumentation & Measurement
For each key variable:
- Instrument name and reference
- Psychometric properties (reliability, validity)
- Number of items and scale type
- Administration time
- Scoring procedure

---

### 3. DATA ANALYSIS PLAN

#### Primary Analysis
- Statistical test(s): [specific tests with justification]
- Software recommended: [R, Python, SPSS, STATA, etc.]
- Effect size measures to report
- Confidence intervals
- Multiple comparisons corrections (if needed)

#### Secondary Analyses
- [list additional analyses]

#### Handling Missing Data
- Expected missing data rate
- Missing data mechanism (MCAR, MAR, MNAR)
- Imputation strategy

#### Sensitivity Analyses
- What sensitivity analyses to perform
- How to handle outliers and influential observations

---

### 4. VALIDITY THREATS & MITIGATIONS

#### Internal Validity
| Threat | Risk Level | Mitigation Strategy |
|--------|-----------|---------------------|
| Selection bias | [H/M/L] | [strategy] |
| Attrition | [H/M/L] | [strategy] |
| History effects | [H/M/L] | [strategy] |
| Maturation | [H/M/L] | [strategy] |
| Instrumentation | [H/M/L] | [strategy] |

#### External Validity
| Threat | Risk Level | Mitigation Strategy |
|--------|-----------|---------------------|
| Population validity | [H/M/L] | [strategy] |
| Ecological validity | [H/M/L] | [strategy] |

---

### 5. ETHICAL CONSIDERATIONS

- Informed consent procedure
- Data privacy and anonymization
- Risk-benefit analysis for participants
- IRB/Ethics committee requirements
- Data storage and security
- Conflicts of interest declaration

---

### 6. IMPLEMENTATION TIMELINE

| Phase | Activities | Duration | Milestones |
|-------|-----------|----------|------------|
| Preparation | [activities] | [weeks] | [milestone] |
| Data Collection | [activities] | [weeks] | [milestone] |
| Analysis | [activities] | [weeks] | [milestone] |
| Writing | [activities] | [weeks] | [milestone] |

---

### 7. RESOURCE REQUIREMENTS

- Personnel: [roles and time commitment]
- Equipment/Materials: [specific tools needed]
- Software: [specific packages and versions]
- Budget considerations: [major cost categories]

---

### 8. QUALITY CONTROL PROTOCOL

- Pilot testing plan
- Inter-rater reliability checks (if applicable)
- Data auditing procedures
- Protocol deviation management
`;

    const result = await this.callClaude(prompt);

    const finding = this.createFinding(
      'Research Methodology & Study Design',
      result.text,
      'methodology_design',
      0.90,
      ['Power analysis', 'Validity assessment', 'Protocol design'],
      ['methodology', 'design', 'protocol', 'statistics', 'sampling']
    );

    this.state.metrics.tasksCompleted++;
    this.updateStatus('completed', 'Methodology designed');

    return {
      taskId: task.id,
      agentRole: this.config.role,
      success: true,
      findings: [finding],
      data: {
        methodology: result.text,
        thinking: result.thinking,
      },
      tokensUsed: result.tokensUsed,
      thinkingTokens: result.thinkingTokens,
      duration: Date.now() - start,
      timestamp: new Date(),
    };
  }
}
