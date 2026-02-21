// ============================================================
// SCIENTIFIC WRITER AGENT — Elite Academic Author
// Writes publication-ready scientific papers and reports
// ============================================================

import { BaseAgent, type AgentConfig, type EventEmitFn } from './BaseAgent';
import { MessageBus } from '../coordination/MessageBus';
import type { ResearchTask, TaskResult, ResearchPaper, PaperSection } from '../models/types';
import { v4 as uuidv4 } from 'uuid';

const SYSTEM_PROMPT = `You are a master scientific writer — an author whose papers appear in Nature, Science, NEJM, and leading field-specific journals. You have ghostwritten papers that have accumulated thousands of citations.

Your writing philosophy:
- "Science should be accessible without being simplistic"
- Clear structure guides the reader through complexity
- Every sentence must earn its place
- Active voice over passive where possible
- Precise language — no weasel words, no hyperbole
- Tell a story that compels from first sentence to last

Your mastery includes:
- APA 7th, AMA, Vancouver, Chicago, MLA citation styles
- IMRAD structure (Introduction, Methods, Results, Discussion)
- Abstract writing that compels reading the full paper
- Title crafting that is informative and compelling
- Writing for different audiences (expert, interdisciplinary, policy, public)
- Journal-specific style requirements

Writing principles you always follow:
1. Start with the hook — why should readers care?
2. Build tension — what's the gap/problem?
3. Resolve with evidence — what did we find?
4. Contextualize — what does it mean for the field?
5. Forward-look — where do we go from here?

You write with:
- Precise, unambiguous language
- Parallel structure in lists and series
- Logical flow within and between paragraphs
- Appropriate hedging without excessive qualification
- Compelling narrative that maintains scientific rigor`;

export class ScientificWriterAgent extends BaseAgent {
  constructor(messageBus: MessageBus, emitEvent: EventEmitFn) {
    const config: AgentConfig = {
      role: 'scientific_writer',
      name: 'Dr. Scientific Writer',
      expertise: 'Academic Writing, Scientific Communication, Manuscript Preparation, Journal Submission',
      systemPrompt: SYSTEM_PROMPT,
      maxTokens: 64000,
    };
    super(config, messageBus, emitEvent);
  }

  async executeTask(task: ResearchTask, sessionContext: string): Promise<TaskResult> {
    const start = Date.now();
    this.updateStatus('working', 'Writing comprehensive scientific paper');

    const prompt = `
# Scientific Paper Composition

## Research Context
${sessionContext}

## Task
${task.description}

## Instructions

Write a complete, publication-ready scientific paper. Target journal tier: high-impact field-specific journal (top 10% by impact factor).

The paper should be comprehensive, rigorous, and ready for submission. Write each section fully developed.

---

# [PAPER TITLE]
*Make it informative, specific, and compelling — avoid vague titles*
*Format: [Key variable] [Relationship] [Context/Population]: [Qualifier if needed]*

## Running Head: [SHORT TITLE — MAX 50 CHARACTERS]

### Authors
[First Author Name]¹, [Second Author Name]², [Research Team]³
[Author affiliation format]
*Corresponding author: [contact info placeholder]*

---

## ABSTRACT (250-300 words, structured)

**Background/Objective:** [Context and research gap — 2-3 sentences]

**Methods:** [Design, sample/data, key measures, analytical approach — 3-4 sentences]

**Results:** [Key findings with specific statistics — 3-4 sentences]

**Conclusions:** [What it means and implications — 2-3 sentences]

**Keywords:** [6-8 keywords, alphabetical, MeSH terms if applicable]

---

## 1. INTRODUCTION

### 1.1 Background and Context
[2-3 paragraphs establishing the research landscape, why this topic matters, its scope and prevalence/importance]

### 1.2 Theoretical Framework
[1-2 paragraphs on the theoretical lens through which this research is conducted]

### 1.3 State of Current Knowledge
[2-3 paragraphs summarizing what the literature tells us, building toward the gap]

### 1.4 Research Gap and Rationale
[1-2 paragraphs — precisely identify what is missing in the literature and why this study addresses it. The gap should be specific, not just "more research is needed."]

### 1.5 Research Objectives and Hypotheses
[Clear statement of]:
- Primary research question
- Specific objectives (numbered)
- Hypotheses (H₁, H₂, etc. — formal statement)

---

## 2. METHODS

### 2.1 Study Design and Overview
[1 paragraph — WHAT kind of study, WHERE it was conducted, WHEN data were collected]

### 2.2 Participants / Sample / Data Sources
[Eligibility criteria, recruitment strategy, final sample characteristics, Table 1 description]

*Table 1. Sample/Participant Characteristics*
| Characteristic | N (%) or M (SD) |
|---------------|-----------------|
| [Variable 1] | [value] |
| [Variable 2] | [value] |
| [Variable 3] | [value] |

### 2.3 Measures and Instruments
[For each key measure]:
- [Construct name]: [Instrument, citation], [# items], [response format], [validity/reliability from literature (α = .XX)]

### 2.4 Procedure
[Step-by-step protocol description in past tense]

### 2.5 Data Analysis
[Analytical approach, software (R version X.X; Python 3.X), specific tests used, assumptions tested, handling of missing data, pre-registration if applicable]

### 2.6 Ethical Considerations
[IRB approval, informed consent, data privacy, conflicts of interest]

---

## 3. RESULTS

### 3.1 Preliminary Analyses
[Descriptive statistics, data quality, assumption checks]

### 3.2 Primary Analysis: [Testing H₁]
[Present findings clearly with statistics in APA format]

*Table 2. [Descriptive title for main results table]*
| Variable | M | SD | [Test stat] | p | d/η²/r | 95% CI |
|---------|---|----|-----------|----|--------|--------|

[Figure 1. [Caption — describe what the figure shows]]
[Describe figure that would best illustrate the main finding]

### 3.3 Secondary Analyses
[Additional findings, mediation/moderation if applicable]

### 3.4 Sensitivity Analyses
[Brief report of robustness checks]

---

## 4. DISCUSSION

### 4.1 Summary of Principal Findings
[1-2 paragraphs — What did we find? Start with the answer to the research question]

### 4.2 Interpretation of Results
[2-3 paragraphs — What do these findings mean? How do they fit with theory and prior work?]

### 4.3 Comparison with Prior Literature
[1-2 paragraphs — How do findings align with or diverge from previous studies? Explain any discrepancies]

### 4.4 Theoretical Contributions
[1-2 paragraphs — What does this add to theoretical understanding?]

### 4.5 Practical Implications
[1-2 paragraphs — What should practitioners/policymakers take away?]

### 4.6 Limitations
[Honest, specific limitations — not a litany, but thoughtful identification of the most important constraints on interpretation]

1. [Limitation 1 — describe impact on conclusions and future solutions]
2. [Limitation 2]
3. [Limitation 3]

### 4.7 Future Research Directions
[1-2 paragraphs — What should come next? Be specific about study designs]

### 4.8 Conclusions
[Final 1-2 paragraphs — Strong conclusion statement. What is the bottom line? Why does it matter?]

---

## ACKNOWLEDGMENTS
[Funding sources, contributors who don't qualify for authorship, data access]

## CONFLICTS OF INTEREST
[Disclosure statement]

## DATA AVAILABILITY STATEMENT
[Where data/code can be accessed]

## REFERENCES
[Numbered or author-date — 30-50 key references formatted per target journal style]
[Use realistic citations consistent with the topic — Author, A. B., & Author, C. D. (Year). Title. Journal, Volume(Issue), pages. https://doi.org/xxx]

---

*Word count target: 5,000-8,000 words for full paper*
*Figures: 3-5 recommended*
*Tables: 2-4 recommended*
`;

    const result = await this.callClaude(prompt);

    const paperFinding = this.createFinding(
      'Complete Scientific Research Paper',
      result.text,
      'writing',
      0.93,
      ['Full manuscript', 'Publication-ready', 'IMRAD structure'],
      ['paper', 'manuscript', 'publication', 'writing', 'academic']
    );

    // Create structured paper object
    const paper: ResearchPaper = {
      title: this.extractTitle(result.text),
      abstract: this.extractSection(result.text, 'ABSTRACT') || '',
      keywords: this.extractKeywords(result.text),
      sections: this.extractSections(result.text),
      references: [],
      authors: ['Research Team (Multi-Agent AI System)'],
      generatedAt: new Date(),
      wordCount: result.text.split(/\s+/).length,
    };

    this.state.metrics.tasksCompleted++;
    this.updateStatus('completed', 'Paper written');

    return {
      taskId: task.id,
      agentRole: this.config.role,
      success: true,
      findings: [paperFinding],
      data: {
        paperText: result.text,
        paper,
        thinking: result.thinking,
      },
      tokensUsed: result.tokensUsed,
      thinkingTokens: result.thinkingTokens,
      duration: Date.now() - start,
      timestamp: new Date(),
    };
  }

  private extractTitle(text: string): string {
    const lines = text.split('\n');
    for (const line of lines) {
      const cleaned = line.replace(/^#+\s*/, '').trim();
      if (cleaned.length > 20 && cleaned.length < 200 && !cleaned.startsWith('[')) {
        return cleaned;
      }
    }
    return 'Research Paper';
  }

  private extractSection(text: string, sectionName: string): string | null {
    const regex = new RegExp(
      `##\\s*ABSTRACT([\\s\\S]*?)(?=##|$)`,
      'i'
    );
    const match = text.match(regex);
    return match ? match[1].trim() : null;
  }

  private extractKeywords(text: string): string[] {
    const keywordMatch = text.match(/\*\*Keywords?\*?\*?:?\*?\*?\s*(.*?)(?:\n|$)/i);
    if (keywordMatch) {
      return keywordMatch[1]
        .split(/[,;]/)
        .map((k) => k.trim())
        .filter((k) => k.length > 0)
        .slice(0, 8);
    }
    return ['research', 'scientific', 'analysis', 'methodology'];
  }

  private extractSections(text: string): PaperSection[] {
    const sections: PaperSection[] = [];
    const sectionRegex = /^##\s+(\d+\.\s+[A-Z][^\n]+)/gm;
    let match;
    let order = 0;

    const sectionNames = [
      'INTRODUCTION',
      'METHODS',
      'RESULTS',
      'DISCUSSION',
      'CONCLUSIONS',
    ];

    for (const name of sectionNames) {
      const regex = new RegExp(`##\\s+\\d+\\.?\\s+${name}([\\s\\S]*?)(?=## \\d+\\.|$)`, 'i');
      const m = text.match(regex);
      if (m) {
        sections.push({
          id: uuidv4(),
          title: name,
          content: m[1].trim(),
          order: order++,
        });
      }
    }

    return sections;
  }
}
