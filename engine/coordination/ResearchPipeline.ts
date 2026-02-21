// ============================================================
// RESEARCH PIPELINE — Orchestrates Multi-Agent Workflow
// Supports: Express+WebSocket (local dev) and SSE (Vercel)
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

export interface StartResult {
  sessionId: string;
}

export type SSEWriter = (event: StreamEvent) => void;

export class ResearchPipeline extends EventEmitter {
  private messageBus: MessageBus;
  private sessions: Map<string, ResearchSession> = new Map();
  private pendingSessions: Map<string, ResearchConfig> = new Map();

  constructor() {
    super();
    this.setMaxListeners(100);
    this.messageBus = new MessageBus();
  }

  private makeAgents(emitEvent: SSEWriter) {
    return {
      director: new ResearchDirector(this.messageBus, emitEvent),
      literature: new LiteratureReviewAgent(this.messageBus, emitEvent),
      hypothesis: new HypothesisAgent(this.messageBus, emitEvent),
      methodology: new MethodologyAgent(this.messageBus, emitEvent),
      dataAnalyst: new DataAnalysisAgent(this.messageBus, emitEvent),
      criticalReview: new CriticalReviewAgent(this.messageBus, emitEvent),
      synthesis: new SynthesisAgent(this.messageBus, emitEvent),
      writer: new ScientificWriterAgent(this.messageBus, emitEvent),
      citation: new CitationManagerAgent(this.messageBus, emitEvent),
    };
  }

  // ── Mode 1: SSE / Vercel ─────────────────────────────────
  async startResearchSession(config: ResearchConfig): Promise<string> {
    const sessionId = uuidv4();
    this.pendingSessions.set(sessionId, config);
    return sessionId;
  }

  async runResearchWithSSE(sessionId: string, write: SSEWriter): Promise<void> {
    const config = this.pendingSessions.get(sessionId);
    if (!config) {
      write({
        type: 'error',
        sessionId,
        data: { error: 'Session not found. POST /api/research/start first.' },
        timestamp: new Date(),
      });
      return;
    }
    this.pendingSessions.delete(sessionId);

    const emit: SSEWriter = (event) => {
      write({ ...event, sessionId });
      this.emit('stream', { ...event, sessionId });
    };

    const session = this.createSession(sessionId, config);
    this.sessions.set(sessionId, session);
    await this.runPipeline(sessionId, config, session, emit);
  }

  // ── Mode 2: Express + WebSocket (local dev) ──────────────
  async startResearch(config: ResearchConfig): Promise<string> {
    const sessionId = uuidv4();

    const emit: SSEWriter = (event) => {
      this.emit('stream', { ...event, sessionId });
    };

    const session = this.createSession(sessionId, config);
    this.sessions.set(sessionId, session);

    this.runPipeline(sessionId, config, session, emit).catch((err) => {
      emit({ type: 'error', sessionId, data: { error: err.message }, timestamp: new Date() });
    });

    return sessionId;
  }

  // ── Core Pipeline ─────────────────────────────────────────
  private createSession(sessionId: string, config: ResearchConfig): ResearchSession {
    return {
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
  }

  private async runPipeline(
    sessionId: string,
    config: ResearchConfig,
    session: ResearchSession,
    emit: SSEWriter
  ): Promise<void> {
    const agents = this.makeAgents(emit);

    const phase = (p: ResearchPhase, message: string) => {
      session.phase = p;
      emit({ type: 'phase_change', sessionId, data: { phase: p, message }, timestamp: new Date() });
    };

    const progress = (percentage: number, message: string) => {
      emit({ type: 'progress', sessionId, data: { percentage, message }, timestamp: new Date() });
    };

    const ctx = this.buildContext(config, session);

    try {
      // Phase 1: Strategy
      phase('initialization', 'Research Director planning strategy...');
      const { tasks } = await agents.director.createResearchPlan(config);
      progress(10, 'Research strategy established');

      // Phase 2: Literature Review
      phase('literature_review', 'Searching academic databases...');
      const litResult = await agents.literature.executeTask(
        this.makeTask('literature_reviewer', tasks[0]), ctx
      );
      this.collect(session, litResult);
      progress(25, 'Literature review complete');

      // Phase 3: Hypothesis
      phase('hypothesis_formation', 'Generating research hypotheses...');
      const hypResult = await agents.hypothesis.executeTask(
        this.makeTask('hypothesis_generator', tasks[1]),
        this.enrichCtx(ctx, litResult)
      );
      this.collect(session, hypResult);
      progress(38, 'Hypotheses formulated');

      // Phase 4: Methodology
      phase('methodology_design', 'Designing research methodology...');
      const methCtx = this.enrichCtx(ctx, litResult, hypResult);
      const methResult = await agents.methodology.executeTask(
        this.makeTask('methodology_expert', tasks[2]), methCtx
      );
      this.collect(session, methResult);
      progress(50, 'Methodology designed');

      // Phase 5: Data Analysis
      phase('data_analysis', 'Running statistical analysis framework...');
      const analysisCtx = this.enrichCtx(methCtx, methResult);
      const analysisResult = await agents.dataAnalyst.executeTask(
        this.makeTask('data_analyst', tasks[3]), analysisCtx
      );
      this.collect(session, analysisResult);
      progress(62, 'Analysis complete');

      // Phase 6: Critical Review
      phase('critical_review', 'Peer reviewing all findings...');
      const reviewResult = await agents.criticalReview.executeTask(
        this.makeTask('critical_reviewer', tasks[4]),
        this.enrichCtx(analysisCtx, analysisResult)
      );
      this.collect(session, reviewResult);
      progress(73, 'Critical review complete');

      // Phase 7: Synthesis
      phase('synthesis', 'Synthesizing all findings...');
      const synthCtx = this.enrichCtx(analysisCtx, reviewResult);
      const synthResult = await agents.synthesis.executeTask(
        this.makeTask('synthesis_specialist', tasks[5]), synthCtx
      );
      this.collect(session, synthResult);
      progress(82, 'Synthesis complete');

      // Phase 8: Writing + Citations (parallel)
      phase('writing', 'Writing paper & compiling references...');
      const writeCtx = this.enrichCtx(synthCtx, synthResult);
      const [writeResult, citResult] = await Promise.all([
        agents.writer.executeTask(this.makeTask('scientific_writer', tasks[6]), writeCtx),
        agents.citation.executeTask(this.makeTask('citation_manager', tasks[7]), writeCtx),
      ]);
      this.collect(session, writeResult);
      this.collect(session, citResult);
      progress(93, 'Paper and citations ready');

      // Phase 9: Final assembly
      phase('final_review', 'Assembling final research package...');
      if (writeResult.data.paper) session.paper = writeResult.data.paper as ResearchPaper;
      if (citResult.data.citations) {
        session.citations = citResult.data.citations as typeof session.citations;
      }

      session.metadata = this.calcMetrics(session);
      session.phase = 'completed';
      session.endTime = new Date();

      progress(100, 'Research complete!');

      emit({
        type: 'paper_ready',
        sessionId,
        data: {
          paper: session.paper,
          paperText: writeResult.data.paperText,
          bibliography: citResult.data.bibliography,
        },
        timestamp: new Date(),
      });

      emit({
        type: 'session_complete',
        sessionId,
        data: {
          findingsCount: session.findings.length,
          metrics: session.metadata,
          duration: session.endTime
            ? Math.round((session.endTime.getTime() - session.startTime.getTime()) / 1000)
            : 0,
        },
        timestamp: new Date(),
      });
    } catch (err) {
      session.phase = 'completed';
      session.endTime = new Date();
      throw err;
    }
  }

  private makeTask(role: AgentRole, taskDef: Omit<ResearchTask, 'id' | 'result'>): ResearchTask {
    return { id: uuidv4(), ...taskDef, assignedTo: role };
  }

  private buildContext(config: ResearchConfig, session: ResearchSession): string {
    return `## RESEARCH CONTEXT
**Topic:** ${config.topic}
**Research Question:** ${config.researchQuestion}
**Domain:** ${config.domain}
**Depth:** ${config.depth}
**Objectives:**
${config.objectives.map((o, i) => `${i + 1}. ${o}`).join('\n')}
**Session:** ${session.id} | Started: ${session.startTime.toISOString()}`;
  }

  private enrichCtx(base: string, ...results: TaskResult[]): string {
    const summaries = results
      .flatMap((r) => r.findings)
      .map((f) => `### ${f.title}\n${f.content.substring(0, 1500)}...`)
      .join('\n\n');
    return `${base}\n\n---\n## PRIOR FINDINGS\n${summaries}`;
  }

  private collect(session: ResearchSession, result: TaskResult): void {
    session.findings.push(...result.findings);
    session.metadata.totalTokens += result.tokensUsed;
    session.metadata.totalThinkingTokens += result.thinkingTokens;
    session.metadata.totalAgentCalls++;
    session.metadata.estimatedCost += (result.tokensUsed * 15) / 1_000_000;
  }

  private calcMetrics(session: ResearchSession): typeof session.metadata {
    const avg =
      session.findings.length > 0
        ? session.findings.reduce((s, f) => s + f.confidence, 0) / session.findings.length
        : 0;
    return { ...session.metadata, qualityScore: Math.round(avg * 100) };
  }

  getSession(id: string): ResearchSession | undefined {
    return this.sessions.get(id);
  }
}
