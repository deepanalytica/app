// ============================================================
// RESEARCH DIRECTOR — Chief Orchestrator Agent
// Plans research strategy and coordinates the entire team
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import { BaseAgent, type AgentConfig, type EventEmitFn } from './BaseAgent';
import { MessageBus } from '../coordination/MessageBus';
import type {
  ResearchTask,
  TaskResult,
  ResearchFinding,
  ResearchConfig,
} from '../models/types';

const SYSTEM_PROMPT = `You are the Chief Research Director of an elite scientific research team. You are a world-class academic with decades of experience across multiple disciplines. Your role is to:

1. ANALYZE the research topic deeply and identify the most important questions to investigate
2. DEVELOP a comprehensive research strategy with clear objectives and milestones
3. IDENTIFY key knowledge gaps, potential methodologies, and theoretical frameworks
4. COORDINATE team activities by assigning tasks based on each agent's expertise
5. SYNTHESIZE findings into coherent narratives and ensure scientific rigor
6. MAINTAIN quality standards equivalent to top-tier peer-reviewed journals

You think systematically, identify hidden connections between ideas, and ensure all research meets the highest standards of academic excellence. You are authoritative but collaborative, and you know when to push boundaries and when to follow established methodologies.

Always respond with structured, actionable insights that guide the research team effectively.`;

export class ResearchDirector extends BaseAgent {
  constructor(messageBus: MessageBus, emitEvent: EventEmitFn) {
    const config: AgentConfig = {
      role: 'research_director',
      name: 'Dr. Research Director',
      expertise: 'Scientific Strategy, Multi-disciplinary Research, Team Coordination',
      systemPrompt: SYSTEM_PROMPT,
      maxTokens: 32000,
    };
    super(config, messageBus, emitEvent);
  }

  async executeTask(task: ResearchTask, sessionContext: string): Promise<TaskResult> {
    const start = Date.now();
    this.updateStatus('working', task.description);

    const prompt = `
# Research Strategy Development Task

## Research Configuration
${sessionContext}

## Your Task
${task.description}

## Required Output
Please provide a comprehensive research strategy including:

### 1. RESEARCH ANALYSIS
- Core research question breakdown
- Sub-questions that need to be addressed
- Key variables and concepts to investigate
- Potential hypotheses to explore

### 2. KNOWLEDGE LANDSCAPE
- What is already known in this field
- Key theoretical frameworks to apply
- Methodological approaches most suitable
- Potential data sources and evidence types

### 3. RESEARCH ROADMAP
- Phase 1: Literature Review objectives (specific papers/topics to find)
- Phase 2: Hypothesis generation guidelines
- Phase 3: Methodology design requirements
- Phase 4: Analysis framework
- Phase 5: Synthesis approach

### 4. QUALITY CRITERIA
- Standards for evidence acceptance
- Confidence thresholds
- Peer review criteria
- Output quality benchmarks

### 5. COORDINATION PLAN
- Agent-specific task assignments
- Dependencies between tasks
- Critical path for research completion

Provide a rigorous, scientifically sound strategy that will produce publishable-quality results.
`;

    const result = await this.callClaude(prompt);

    const finding = this.createFinding(
      'Research Strategy & Coordination Plan',
      result.text,
      'initialization',
      0.95,
      ['Director analysis', 'Strategic planning'],
      ['strategy', 'coordination', 'planning']
    );

    this.state.metrics.tasksCompleted++;
    this.updateStatus('completed', 'Strategy developed');

    return {
      taskId: task.id,
      agentRole: this.config.role,
      success: true,
      findings: [finding],
      data: {
        strategy: result.text,
        thinking: result.thinking,
        tokensUsed: result.tokensUsed,
      },
      tokensUsed: result.tokensUsed,
      thinkingTokens: result.thinkingTokens,
      duration: Date.now() - start,
      timestamp: new Date(),
    };
  }

  async createResearchPlan(config: ResearchConfig): Promise<{
    strategy: string;
    tasks: Omit<ResearchTask, 'id' | 'result'>[];
  }> {
    this.updateStatus('thinking', 'Creating comprehensive research plan');

    const prompt = `
# Create Research Execution Plan

## Research Topic: ${config.topic}
## Research Question: ${config.researchQuestion}
## Domain: ${config.domain}
## Objectives:
${config.objectives.map((o, i) => `${i + 1}. ${o}`).join('\n')}
## Depth: ${config.depth}
## Output Format: ${config.outputFormat}

Create a detailed, executable research plan that will guide our team of 8 specialized agents. The plan should be systematic and thorough, producing results of the highest academic quality.

Structure your response as:
1. Overall research strategy (2-3 paragraphs)
2. Phase breakdown with specific tasks for each agent
3. Quality checkpoints
4. Expected outputs and deliverables

Be specific about what each agent should focus on.
`;

    const result = await this.callClaude(prompt);
    this.updateStatus('completed', 'Research plan created');

    const tasks: Omit<ResearchTask, 'id' | 'result'>[] = [
      {
        assignedTo: 'literature_reviewer',
        description: `Conduct systematic literature review for: "${config.researchQuestion}". Search for recent publications (last 10 years), foundational papers, and seminal works. Identify key researchers, journals, and emerging trends.`,
        context: result.text,
        priority: 'high',
        dependencies: [],
        status: 'pending',
      },
      {
        assignedTo: 'hypothesis_generator',
        description: `Generate and evaluate research hypotheses for: "${config.researchQuestion}". Formulate testable hypotheses, null hypotheses, and alternative hypotheses based on current knowledge gaps.`,
        context: result.text,
        priority: 'high',
        dependencies: ['literature_reviewer'],
        status: 'pending',
      },
      {
        assignedTo: 'methodology_expert',
        description: `Design the optimal research methodology for investigating: "${config.researchQuestion}". Consider experimental design, sampling strategies, data collection methods, and statistical approaches.`,
        context: result.text,
        priority: 'high',
        dependencies: ['hypothesis_generator'],
        status: 'pending',
      },
      {
        assignedTo: 'data_analyst',
        description: `Perform comprehensive data analysis and statistical evaluation for the research on: "${config.researchQuestion}". Apply appropriate statistical methods, identify patterns, and quantify effect sizes.`,
        context: result.text,
        priority: 'high',
        dependencies: ['methodology_expert'],
        status: 'pending',
      },
      {
        assignedTo: 'critical_reviewer',
        description: `Conduct rigorous critical review of all research findings related to: "${config.researchQuestion}". Identify methodological limitations, potential biases, alternative interpretations, and areas requiring further investigation.`,
        context: result.text,
        priority: 'normal',
        dependencies: ['data_analyst'],
        status: 'pending',
      },
      {
        assignedTo: 'synthesis_specialist',
        description: `Synthesize all research findings into a coherent narrative for: "${config.researchQuestion}". Connect findings across different phases, identify emergent patterns, and formulate overarching conclusions.`,
        context: result.text,
        priority: 'high',
        dependencies: ['critical_reviewer'],
        status: 'pending',
      },
      {
        assignedTo: 'scientific_writer',
        description: `Write a comprehensive scientific paper on: "${config.researchQuestion}". Structure the paper with proper academic format, clear argumentation, and publication-ready prose.`,
        context: result.text,
        priority: 'high',
        dependencies: ['synthesis_specialist'],
        status: 'pending',
      },
      {
        assignedTo: 'citation_manager',
        description: `Compile and format all citations and references for the research on: "${config.researchQuestion}". Ensure proper citation formatting, verify sources, and create a comprehensive bibliography.`,
        context: result.text,
        priority: 'normal',
        dependencies: ['scientific_writer'],
        status: 'pending',
      },
    ];

    return { strategy: result.text, tasks };
  }
}
