// ============================================================
// DATA ANALYSIS AGENT — Quantitative & Statistical Expert
// Performs deep statistical analysis and data interpretation
// ============================================================

import { BaseAgent, type AgentConfig, type EventEmitFn } from './BaseAgent';
import { MessageBus } from '../coordination/MessageBus';
import type { ResearchTask, TaskResult } from '../models/types';

const SYSTEM_PROMPT = `You are a world-class data scientist and statistician with mastery of both classical statistics and modern machine learning. You have a PhD in Statistics and 15+ years of experience analyzing complex datasets in high-impact research.

Your analytical philosophy:
- "Let the data speak, but speak the language it uses"
- Statistical significance is not the same as practical significance
- Effect sizes and confidence intervals matter as much as p-values
- Exploratory analysis before confirmatory analysis
- Transparency in analytical decisions (pre-registration mindset)

Your expertise spans:
CLASSICAL STATISTICS:
- Regression analysis (linear, logistic, Poisson, Cox proportional hazards)
- ANOVA, MANOVA, repeated measures
- Structural Equation Modeling (SEM) and path analysis
- Multilevel/hierarchical linear modeling
- Time series analysis (ARIMA, state-space models)
- Bayesian inference and probabilistic modeling
- Non-parametric methods

ADVANCED METHODS:
- Machine learning (supervised, unsupervised, reinforcement)
- Natural Language Processing and text analysis
- Network/graph analysis
- Survival analysis
- Meta-analytic methods (fixed, random effects, meta-regression)
- Causal inference (propensity scores, instrumental variables, difference-in-differences)
- Power analysis and simulation

You report results following APA 7th edition and CONSORT/STROBE reporting guidelines.`;

export class DataAnalysisAgent extends BaseAgent {
  constructor(messageBus: MessageBus, emitEvent: EventEmitFn) {
    const config: AgentConfig = {
      role: 'data_analyst',
      name: 'Dr. Data Analyst',
      expertise: 'Statistics, Machine Learning, Causal Inference, Data Science',
      systemPrompt: SYSTEM_PROMPT,
      maxTokens: 32000,
    };
    super(config, messageBus, emitEvent);
  }

  async executeTask(task: ResearchTask, sessionContext: string): Promise<TaskResult> {
    const start = Date.now();
    this.updateStatus('working', 'Conducting comprehensive data analysis');

    const prompt = `
# Comprehensive Data Analysis

## Research Context
${sessionContext}

## Task
${task.description}

## Instructions

Conduct a thorough analytical framework for this research. Since we are at the theoretical/planning stage, provide:
1. The specific analyses that WOULD be conducted
2. Expected results based on theory and prior literature
3. Interpretation frameworks for different possible outcomes
4. Code examples where appropriate

Structure your analysis as:

### 1. DESCRIPTIVE STATISTICS FRAMEWORK

What descriptive statistics should be reported:
- For continuous variables: M, SD, range, skewness, kurtosis, normality tests
- For categorical variables: frequencies, percentages, χ² tests
- For grouped data: means per group, standard deviations, effect sizes

Expected distributions and patterns based on theory.

---

### 2. PRIMARY STATISTICAL ANALYSIS

#### 2a. Main Analysis
- Statistical test: [exact test with formula if applicable]
- Assumptions and how to test them:
  1. [Assumption 1] — Test: [Shapiro-Wilk / Levene / etc.]
  2. [Assumption 2] — Test: [...]
- If assumptions violated, alternatives: [...]

**Hypothetical Results Section (APA format):**
[Write out how results would be reported, with placeholder statistics]

Example: "A [statistical test] revealed a [significant/non-significant] effect of [IV] on [DV], [F(df1, df2)/t(df)/χ²(df)] = [X.XX], p [</>/=] [.XXX], [Cohen's d/η²/r] = [.XX], 95% CI [.XX, .XX]. This indicates..."

#### 2b. Effect Size Interpretation
- Effect size metric used: [specify]
- Benchmarks (Cohen's conventions or field-specific):
  - Small: [threshold]
  - Medium: [threshold]
  - Large: [threshold]
- Expected effect size and justification from literature

---

### 3. SECONDARY ANALYSES

#### 3a. Mediation Analysis
If relevant — specify mediator(s) and indirect effects to test
- Baron and Kenny steps or PROCESS macro (Model 4)
- Bootstrap CI for indirect effects (10,000 iterations recommended)

#### 3b. Moderation Analysis
If relevant — specify moderator(s)
- Interaction terms in regression
- Simple slopes analysis
- Johnson-Neyman technique for continuous moderators

#### 3c. Subgroup Analyses
- Pre-specified subgroups
- Correction for multiple comparisons (Bonferroni, FDR)

---

### 4. VISUALIZATION STRATEGY

Recommended visualizations:
1. **[Chart type]**: [what it shows, why it's appropriate]
   - X-axis: [variable]
   - Y-axis: [variable]
   - Color coding: [if applicable]

2. **[Chart type]**: [what it shows]

For each visualization, include:
- What patterns to look for
- How it relates to the hypotheses

---

### 5. SENSITIVITY ANALYSES

- **Robustness checks**: How would results change if using different analytical choices?
- **Outlier analysis**: Leverage plots, Cook's D, influence statistics
- **Missing data**: Complete case vs. multiple imputation comparison
- **Model specification**: Testing alternative model specifications

---

### 6. REPORTING STANDARDS

Report following these guidelines:
- APA 7th Edition for statistics notation
- CONSORT flow diagram for RCTs
- STROBE checklist for observational studies
- PRISMA for systematic reviews

**Key statistics to always report:**
- Test statistic and exact p-value (not "p < .05")
- Effect size with 95% CI
- Degrees of freedom
- Sample sizes per group
- Power achieved

---

### 7. INTERPRETATION FRAMEWORK

| Possible Outcome | Statistical Pattern | Theoretical Interpretation | Practical Implications |
|-----------------|--------------------|-----------------------------|----------------------|
| H₁ supported | [statistics] | [interpretation] | [implications] |
| H₁ not supported | [statistics] | [interpretation] | [implications] |
| Unexpected finding | [statistics] | [interpretation] | [implications] |

---

### 8. REPRODUCIBILITY PROTOCOL

- Code availability (recommend R or Python with version numbers)
- Data sharing statement
- Pre-registration recommendation (OSF, AsPredicted)
- Package versions for computational reproducibility
- Random seed for any stochastic procedures

**Example R code skeleton:**
\`\`\`r
# Load required packages
library(tidyverse)
library(lme4)
library(emmeans)
library(effectsize)
library(ggplot2)

# Set seed for reproducibility
set.seed(42)

# Primary analysis
model <- lm(outcome ~ predictor + covariate1 + covariate2,
            data = research_data)
summary(model)
cohens_d(model)
\`\`\`

**Example Python code skeleton:**
\`\`\`python
import pandas as pd
import numpy as np
from scipy import stats
import statsmodels.api as sm
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.preprocessing import StandardScaler

# Primary analysis
X = sm.add_constant(predictors)
model = sm.OLS(outcome, X).fit()
print(model.summary())
\`\`\`
`;

    const result = await this.callClaude(prompt);

    const finding = this.createFinding(
      'Statistical Analysis Framework & Findings',
      result.text,
      'data_analysis',
      0.87,
      ['Statistical modeling', 'Effect size analysis', 'Visualization planning'],
      ['statistics', 'analysis', 'effect-sizes', 'modeling', 'visualization']
    );

    this.state.metrics.tasksCompleted++;
    this.updateStatus('completed', 'Data analysis complete');

    return {
      taskId: task.id,
      agentRole: this.config.role,
      success: true,
      findings: [finding],
      data: {
        analysis: result.text,
        thinking: result.thinking,
      },
      tokensUsed: result.tokensUsed,
      thinkingTokens: result.thinkingTokens,
      duration: Date.now() - start,
      timestamp: new Date(),
    };
  }
}
