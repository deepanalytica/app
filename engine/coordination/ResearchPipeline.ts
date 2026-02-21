// ============================================================
// RESEARCH PIPELINE — Orchestrates Multi-Agent Workflow
// Manages execution order, parallelism, and data flow
// ============================================================

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { MessageBus } from './MessageBus';
import { ResearchDirector } from '../agents/ResearchDirector';
import { LiteratureReviewAgent } from '../agents/LiteratureReviewAgent';
import { HypothesisAgent } from '../agents/HypothesisAgent';
import { MethodologyAgent } from '../agents/MethodologyAgent';
import { DataAnalysisAgent } from '../agents/DataAnalysisAgent';
import { CriticalReviewAgent } from '../agents/CriticalReviewAgent';
import { SynthesisAgent } from '../agents/SynthesisAgent';
import { ScientificWriterAgent } from '../agents/ScientificWriterAgent';
import { CitationManagerAgent } from '../agents/CitationManagerAgent';
import type {
  ResearchConfig,
  ResearchSession,
  ResearchTask,
  TaskResult,
  StreamEvent,
  ResearchPhase,
  AgentRole,
  ResearchPaper,
} from '../models/types';

export type PipelineEventHandler = (event: StreamEvent) => void;

export class ResearchPipeline extends EventEmitter {
  private messageBus: MessageBus;
  private sessions: Map<string, ResearchSession> = new Map();

  // Agents
  private director: ResearchDirector;
  private literatureAgent: LiteratureReviewAgent;
  private hypothesisAgent: HypothesisAgent;
  private methodologyAgent: MethodologyAgent;
  private dataAnalystAgent: DataAnalysisAgent;
  private criticalReviewAgent: CriticalReviewAgent;
  private synthesisAgent: SynthesisAgent;
  private writerAgent: ScientificWriterAgent;
  private citationAgent: CitationManagerAgent;

  constructor() {
    super();
    this.setMaxListeners(100);
    this.messageBus = new MessageBus();

    const emitEvent: (event: StreamEvent) => void = (event) => {
      this.emit('stream', event);
    };

    // Initialize all agents
    this.director = new ResearchDirector(this.messageBus, emitEvent);
    this.literatureAgent = new LiteratureReviewAgent(this.messageBus, emitEvent);
    this.hypothesisAgent = new HypothesisAgent(this.messageBus, emitEvent);
    this.methodologyAgent = new MethodologyAgent(this.messageBus, emitEvent);
    this.dataAnalystAgent = new DataAnalysisAgent(this.messageBus, emitEvent);
    this.criticalReviewAgent = new CriticalReviewAgent(this.messageBus, emitEvent);
    this.synthesisAgent = new SynthesisAgent(this.messageBus, emitEvent);
    this.writerAgent = new ScientificWriterAgent(this.messageBus, emitEvent);
    this.citationAgent = new CitationManagerAgent(this.messageBus, emitEvent);
  }

  async startResearch(config: ResearchConfig): Promise<string> {
    const sessionId = uuidv4();

    const session: ResearchSession = {
      id: sessionId,
      topic: config.topic,
      researchQuestion: config.researchQuestion,
      domain: config.domain,
      objectives: config.objectives,
      constraints: config.constraints || [],
      startTime: new Date(),
      phase: 'initialization',
      agents: new Map(),
      findings: [],
      citations: [],
      metadata: {
        totalTokens: 0,
        totalThinkingTokens: 0,
        totalAgentCalls: 0,
        estimatedCost: 0,
        qualityScore: 0,
      },
    };

    this.sessions.set(sessionId, session);

    // Start the pipeline asynchronously
    this.runPipeline(sessionId, config, session).catch((err) => {
      this.emitSessionEvent(sessionId, 'error', { error: err.message });
    });

    return sessionId;
  }

  private async runPipeline(
    sessionId: string,
    config: ResearchConfig,
    session: ResearchSession
  ): Promise<void> {
    const emit = (phase: ResearchPhase, data: Record<string, unknown>) => {
      session.phase = phase;
      this.emitSessionEvent(sessionId, 'phase_change', { phase, ...data });
    };

    try {
      // ==========================================
      // PHASE 1: INITIALIZATION & STRATEGY
      // ==========================================
      emit('initialization', { message: 'Research Director planning strategy...' });

      const sessionContext = this.buildSessionContext(config, session);
      const { strategy, tasks } = await this.director.createResearchPlan(config);

      this.emitSessionEvent(sessionId, 'progress', {
        percentage: 10,
        message: 'Research strategy established',
        phase: 'initialization',
      });

      // ==========================================
      // PHASE 2: LITERATURE REVIEW
      // ==========================================
      emit('literature_review', { message: 'Literature reviewer searching databases...' });

      const litTask = this.makeTask('literature_reviewer', tasks[0], sessionId);
      const litResult = await this.literatureAgent.executeTask(litTask, sessionContext);
      this.processResult(session, litResult);

      this.emitSessionEvent(sessionId, 'progress', {
        percentage: 25,
        message: 'Literature review complete',
        phase: 'literature_review',
      });

      // ==========================================
      // PHASE 3: HYPOTHESIS GENERATION
      // ==========================================
      emit('hypothesis_formation', { message: 'Generating research hypotheses...' });

      const hypContext = this.enrichContext(sessionContext, litResult);
      const hypTask = this.makeTask('hypothesis_generator', tasks[1], sessionId);
      const hypResult = await this.hypothesisAgent.executeTask(hypTask, hypContext);
      this.processResult(session, hypResult);

      this.emitSessionEvent(sessionId, 'progress', {
        percentage: 38,
        message: 'Hypotheses formulated',
        phase: 'hypothesis_formation',
      });

      // ==========================================
      // PHASE 4: METHODOLOGY DESIGN
      // ==========================================
      emit('methodology_design', { message: 'Designing research methodology...' });

      const methContext = this.enrichContext(hypContext, hypResult);
      const methTask = this.makeTask('methodology_expert', tasks[2], sessionId);
      const methResult = await this.methodologyAgent.executeTask(methTask, methContext);
      this.processResult(session, methResult);

      this.emitSessionEvent(sessionId, 'progress', {
        percentage: 50,
        message: 'Methodology designed',
        phase: 'methodology_design',
      });

      // ==========================================
      // PHASE 5: DATA ANALYSIS (parallel with citations)
      // ==========================================
      emit('data_analysis', { message: 'Running statistical analysis framework...' });

      const analysisContext = this.enrichContext(methContext, methResult);
      const analysisTask = this.makeTask('data_analyst', tasks[3], sessionId);

      // Run data analysis and citation start in parallel
      const [analysisResult] = await Promise.all([
        this.dataAnalystAgent.executeTask(analysisTask, analysisContext),
      ]);
      this.processResult(session, analysisResult);

      this.emitSessionEvent(sessionId, 'progress', {
        percentage: 62,
        message: 'Data analysis framework complete',
        phase: 'data_analysis',
      });

      // ==========================================
      // PHASE 6: CRITICAL REVIEW
      // ==========================================
      emit('critical_review', { message: 'Critical reviewer evaluating research quality...' });

      const reviewContext = this.enrichContext(analysisContext, analysisResult);
      const reviewTask = this.makeTask('critical_reviewer', tasks[4], sessionId);
      const reviewResult = await this.criticalReviewAgent.executeTask(reviewTask, reviewContext);
      this.processResult(session, reviewResult);

      this.emitSessionEvent(sessionId, 'progress', {
        percentage: 73,
        message: 'Critical review complete',
        phase: 'critical_review',
      });

      // ==========================================
      // PHASE 7: SYNTHESIS
      // ==========================================
      emit('synthesis', { message: 'Synthesizing all findings...' });

      const synthContext = this.enrichContext(reviewContext, reviewResult);
      const synthTask = this.makeTask('synthesis_specialist', tasks[5], sessionId);
      const synthResult = await this.synthesisAgent.executeTask(synthTask, synthContext);
      this.processResult(session, synthResult);

      this.emitSessionEvent(sessionId, 'progress', {
        percentage: 82,
        message: 'Synthesis complete',
        phase: 'synthesis',
      });

      // ==========================================
      // PHASE 8: SCIENTIFIC WRITING (parallel with citations)
      // ==========================================
      emit('writing', { message: 'Writing comprehensive scientific paper...' });

      const writeContext = this.enrichContext(synthContext, synthResult);
      const writeTask = this.makeTask('scientific_writer', tasks[6], sessionId);
      const citTask = this.makeTask('citation_manager', tasks[7], sessionId);

      // Run writing and citation compilation in parallel
      const [writeResult, citResult] = await Promise.all([
        this.writerAgent.executeTask(writeTask, writeContext),
        this.citationAgent.executeTask(citTask, writeContext),
      ]);

      this.processResult(session, writeResult);
      this.processResult(session, citResult);

      this.emitSessionEvent(sessionId, 'progress', {
        percentage: 93,
        message: 'Paper and citations complete',
        phase: 'writing',
      });

      // ==========================================
      // PHASE 9: FINAL ASSEMBLY
      // ==========================================
      emit('final_review', { message: 'Assembling final research package...' });

      // Extract the paper from writer result
      const paper = writeResult.data.paper as ResearchPaper | undefined;
      if (paper) {
        session.paper = paper;
      }

      // Extract citations from citation result
      if (citResult.data.citations) {
        session.citations = citResult.data.citations as typeof session.citations;
      }

      // Calculate final metrics
      session.metadata = this.calculateMetrics(session);

      this.emitSessionEvent(sessionId, 'progress', {
        percentage: 100,
        message: 'Research complete!',
        phase: 'completed',
      });

      // ==========================================
      // PHASE 10: COMPLETED
      // ==========================================
      session.phase = 'completed';
      session.endTime = new Date();

      this.emitSessionEvent(sessionId, 'session_complete', {
        sessionId,
        session: this.serializeSession(session),
        paper: session.paper,
        findings: session.findings,
        metrics: session.metadata,
      });

      if (session.paper) {
        this.emitSessionEvent(sessionId, 'paper_ready', {
          paper: session.paper,
          paperText: writeResult.data.paperText,
          bibliography: citResult.data.bibliography,
        });
      }
    } catch (error) {
      session.phase = 'completed';
      session.endTime = new Date();
      this.emitSessionEvent(sessionId, 'error', {
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      throw error;
    }
  }

  private makeTask(
    role: AgentRole,
    taskDef: Omit<ResearchTask, 'id' | 'result'>,
    sessionId: string
  ): ResearchTask {
    return {
      id: uuidv4(),
      ...taskDef,
      assignedTo: role,
    };
  }

  private buildSessionContext(config: ResearchConfig, session: ResearchSession): string {
    return `
## RESEARCH SESSION CONTEXT
**Session ID:** ${session.id}
**Research Topic:** ${config.topic}
**Primary Research Question:** ${config.researchQuestion}
**Scientific Domain:** ${config.domain}
**Research Depth:** ${config.depth}

**Research Objectives:**
${config.objectives.map((o, i) => `${i + 1}. ${o}`).join('\n')}

${config.constraints && config.constraints.length > 0 ? `**Constraints:**\n${config.constraints.join('\n')}` : ''}

**Session Started:** ${session.startTime.toISOString()}
`;
  }

  private enrichContext(baseContext: string, result: TaskResult): string {
    const findingsSummary = result.findings
      .map((f) => `### ${f.title}\n${f.content.substring(0, 2000)}...\n`)
      .join('\n');

    return `${baseContext}

---

## PRIOR FINDINGS (${result.agentRole})
${findingsSummary}
`;
  }

  private processResult(session: ResearchSession, result: TaskResult): void {
    session.findings.push(...result.findings);
    session.metadata.totalTokens += result.tokensUsed;
    session.metadata.totalThinkingTokens += result.thinkingTokens;
    session.metadata.totalAgentCalls++;
    // Estimate cost: $5/1M input tokens, $25/1M output tokens (Opus 4.6)
    session.metadata.estimatedCost += (result.tokensUsed * 15) / 1_000_000;
  }

  private calculateMetrics(session: ResearchSession): typeof session.metadata {
    const avgConfidence =
      session.findings.length > 0
        ? session.findings.reduce((sum, f) => sum + f.confidence, 0) / session.findings.length
        : 0;

    return {
      ...session.metadata,
      qualityScore: Math.round(avgConfidence * 100),
    };
  }

  private emitSessionEvent(
    sessionId: string,
    type: StreamEvent['type'],
    data: Record<string, unknown>
  ): void {
    const event: StreamEvent = {
      type,
      sessionId,
      data,
      timestamp: new Date(),
    };
    this.emit('stream', event);
  }

  private serializeSession(session: ResearchSession): Record<string, unknown> {
    return {
      id: session.id,
      topic: session.topic,
      researchQuestion: session.researchQuestion,
      domain: session.domain,
      phase: session.phase,
      startTime: session.startTime,
      endTime: session.endTime,
      findingsCount: session.findings.length,
      metadata: session.metadata,
    };
  }

  getSession(sessionId: string): ResearchSession | undefined {
    return this.sessions.get(sessionId);
  }

  getSessionFindings(sessionId: string) {
    return this.sessions.get(sessionId)?.findings || [];
  }
}
