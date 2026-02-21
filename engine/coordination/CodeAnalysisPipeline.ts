// ============================================================
// CODE ANALYSIS PIPELINE — 7-Phase Code Analysis Orchestrator
// Coordinates CodeReview, Architecture, Security, Documentation agents
// ============================================================

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { MessageBus } from './MessageBus';
import { CodeReviewAgent } from '../agents/code/CodeReviewAgent';
import { ArchitectureAgent } from '../agents/code/ArchitectureAgent';
import { SecurityAuditAgent } from '../agents/code/SecurityAuditAgent';
import { DocumentationAgent } from '../agents/code/DocumentationAgent';
import { SynthesisAgent } from '../agents/SynthesisAgent';
import { fetchGitHubRepo, summarizeCodeFiles, parseGitHubUrl } from '../tools/GitHubFetcher';
import type {
  CodeAnalysisConfig,
  CodeAnalysisSession,
  CodeAnalysisPhase,
  CodeFile,
  CodeAnalysisReport,
  CodeMetrics,
  StreamEvent,
  ResearchTask,
  TaskResult,
  AgentRole,
  CodeAgentRole,
  AgentState,
} from '../models/types';

export type SSEWriter = (event: StreamEvent) => void;

export interface CodeAnalysisStartResult {
  sessionId: string;
}

export class CodeAnalysisPipeline extends EventEmitter {
  private messageBus: MessageBus;
  private sessions: Map<string, CodeAnalysisSession> = new Map();
  private pendingConfigs: Map<string, CodeAnalysisConfig> = new Map();

  constructor() {
    super();
    this.setMaxListeners(100);
    this.messageBus = new MessageBus();
  }

  // ── Mode 1: SSE / Vercel ─────────────────────────────────
  async startAnalysisSession(config: CodeAnalysisConfig): Promise<string> {
    const sessionId = uuidv4();
    this.pendingConfigs.set(sessionId, config);
    return sessionId;
  }

  async runAnalysisWithSSE(sessionId: string, write: SSEWriter): Promise<void> {
    const config = this.pendingConfigs.get(sessionId);
    if (!config) {
      write({
        type: 'error',
        sessionId,
        data: { error: 'Session not found. POST /api/code/analyze first.' },
        timestamp: new Date(),
      });
      return;
    }
    this.pendingConfigs.delete(sessionId);

    const emit: SSEWriter = (event) => {
      write({ ...event, sessionId });
      this.emit('stream', { ...event, sessionId });
    };

    const session = this.createSession(sessionId, config);
    this.sessions.set(sessionId, session);
    await this.runPipeline(sessionId, config, session, emit);
  }

  // ── Mode 2: Express + WebSocket ──────────────────────────
  async startAnalysis(config: CodeAnalysisConfig): Promise<string> {
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
  private createSession(sessionId: string, config: CodeAnalysisConfig): CodeAnalysisSession {
    return {
      id: sessionId,
      config,
      startTime: new Date(),
      phase: 'parsing',
      files: [],
      findings: [],
      metadata: {
        totalTokens: 0,
        totalThinkingTokens: 0,
        totalAgentCalls: 0,
        estimatedCost: 0,
        qualityScore: 0,
      },
      agents: new Map<CodeAgentRole, AgentState>(),
    };
  }

  private makeAgents(emit: SSEWriter) {
    return {
      codeReview: new CodeReviewAgent(this.messageBus, emit),
      architecture: new ArchitectureAgent(this.messageBus, emit),
      security: new SecurityAuditAgent(this.messageBus, emit),
      documentation: new DocumentationAgent(this.messageBus, emit),
      synthesis: new SynthesisAgent(this.messageBus, emit),
    };
  }

  private async runPipeline(
    sessionId: string,
    config: CodeAnalysisConfig,
    session: CodeAnalysisSession,
    emit: SSEWriter
  ): Promise<void> {
    const agents = this.makeAgents(emit);

    const phase = (p: CodeAnalysisPhase, message: string) => {
      session.phase = p;
      emit({ type: 'phase_change', sessionId, data: { phase: p, message }, timestamp: new Date() });
    };

    const progress = (percentage: number, message: string) => {
      emit({ type: 'progress', sessionId, data: { percentage, message }, timestamp: new Date() });
    };

    try {
      // ── Phase 1: Parsing — Resolve code input ──────────────
      phase('parsing', 'Resolving code input...');
      const files = await this.resolveCodeInput(config, emit, sessionId);
      session.files = files;
      progress(10, `Loaded ${files.length} files (${this.countLines(files)} lines)`);

      // Build context
      const projectCtx = this.buildCodeContext(config, files);

      // ── Phase 2 & 3: Code Review + Security (parallel) ────
      phase('code_review', 'Reviewing code quality and security in parallel...');

      const [reviewResult, securityResult] = await Promise.all([
        config.focusAreas.includes('quality') || config.focusAreas.includes('architecture')
          ? agents.codeReview.executeTask(this.makeTask('code_reviewer', 'Review code quality, patterns, and bugs', projectCtx), projectCtx)
          : this.skipResult('code_reviewer'),
        config.focusAreas.includes('security')
          ? agents.security.executeTask(this.makeTask('security_auditor', 'Conduct security audit', projectCtx), projectCtx)
          : this.skipResult('security_auditor'),
      ]);

      this.collect(session, reviewResult);
      this.collect(session, securityResult);
      progress(45, 'Code review and security audit complete');

      // ── Phase 4: Architecture ──────────────────────────────
      phase('architecture', 'Analyzing system architecture...');
      const archResult = config.focusAreas.includes('architecture')
        ? await agents.architecture.executeTask(
            this.makeTask('architecture_analyst', 'Analyze system architecture and design', projectCtx),
            this.enrichCtx(projectCtx, reviewResult)
          )
        : this.skipResult('architecture_analyst');
      this.collect(session, archResult);
      progress(62, 'Architecture analysis complete');

      // ── Phase 5: Documentation ─────────────────────────────
      phase('documentation', 'Generating documentation...');
      const docsResult = config.focusAreas.includes('documentation')
        ? await agents.documentation.executeTask(
            this.makeTask('documentation_generator', 'Generate comprehensive documentation', projectCtx),
            this.enrichCtx(projectCtx, reviewResult, archResult)
          )
        : this.skipResult('documentation_generator');
      this.collect(session, docsResult);
      progress(78, 'Documentation generated');

      // ── Phase 6: Synthesis ────────────────────────────────
      phase('synthesis', 'Synthesizing all findings...');
      const synthCtx = this.enrichCtx(projectCtx, reviewResult, securityResult, archResult, docsResult);
      const synthTask = this.makeTask(
        'synthesis_specialist',
        `Synthesize all code analysis findings into a coherent executive summary.
         Focus on: overall code health, top priorities, actionable roadmap.
         The project is: ${config.projectName || 'Unknown'} — ${config.projectDescription || ''}`,
        synthCtx
      );
      const synthResult = await agents.synthesis.executeTask(synthTask, synthCtx);
      this.collect(session, synthResult);
      progress(90, 'Synthesis complete');

      // ── Phase 7: Report Assembly ───────────────────────────
      phase('report', 'Assembling final analysis report...');
      const report = this.assembleReport(config, files, session, reviewResult, securityResult, archResult, docsResult, synthResult);
      session.report = report;

      session.phase = 'completed';
      session.endTime = new Date();
      session.metadata = this.calcMetrics(session);
      progress(100, 'Analysis complete!');

      emit({
        type: 'code_analysis_ready',
        sessionId,
        data: {
          report,
          metrics: session.metadata,
          filesAnalyzed: files.length,
          duration: Math.round((session.endTime.getTime() - session.startTime.getTime()) / 1000),
        },
        timestamp: new Date(),
      });

      emit({
        type: 'session_complete',
        sessionId,
        data: {
          findingsCount: session.findings.length,
          metrics: session.metadata,
          duration: Math.round((session.endTime.getTime() - session.startTime.getTime()) / 1000),
        },
        timestamp: new Date(),
      });
    } catch (err) {
      session.phase = 'completed';
      session.endTime = new Date();
      emit({
        type: 'error',
        sessionId,
        data: { error: (err as Error).message, phase: session.phase },
        timestamp: new Date(),
      });
      throw err;
    }
  }

  // ── Code Input Resolution ──────────────────────────────────
  private async resolveCodeInput(
    config: CodeAnalysisConfig,
    emit: SSEWriter,
    sessionId: string
  ): Promise<CodeFile[]> {
    switch (config.inputType) {
      case 'paste': {
        if (!config.code) throw new Error('No code provided for paste input');
        const lines = config.code.split('\n').length;
        return [{
          name: config.fileName || 'code.txt',
          path: config.fileName || 'code.txt',
          content: config.code,
          language: config.language || this.detectLanguageFromContent(config.code),
          sizeBytes: Buffer.byteLength(config.code),
          lineCount: lines,
        }];
      }

      case 'files': {
        if (!config.files || config.files.length === 0) throw new Error('No files provided');
        return config.files;
      }

      case 'github_url': {
        if (!config.githubUrl) throw new Error('No GitHub URL provided');

        emit({
          type: 'progress',
          sessionId,
          data: { percentage: 3, message: `Fetching repository: ${config.githubUrl}` },
          timestamp: new Date(),
        });

        const { owner, repo } = parseGitHubUrl(config.githubUrl);
        emit({
          type: 'agent_update',
          sessionId,
          data: { status: 'working', currentTask: `Fetching ${owner}/${repo} from GitHub...`, name: 'GitHub Fetcher' },
          timestamp: new Date(),
        });

        const ghRepo = await fetchGitHubRepo(config.githubUrl, {
          token: config.githubToken,
          maxFiles: config.analysisDepth === 'quick' ? 20 : config.analysisDepth === 'standard' ? 40 : 60,
        });

        emit({
          type: 'finding',
          sessionId,
          data: {
            finding: {
              title: `Repository: ${ghRepo.owner}/${ghRepo.name}`,
              content: `Stars: ${ghRepo.stars} | Forks: ${ghRepo.forks} | Language: ${ghRepo.language}\n\nFile Tree:\n${ghRepo.fileTree}`,
              agentRole: 'code_reviewer',
            },
          },
          timestamp: new Date(),
        });

        return ghRepo.files;
      }

      default:
        throw new Error(`Unknown input type: ${config.inputType}`);
    }
  }

  // ── Context Builders ───────────────────────────────────────
  private buildCodeContext(config: CodeAnalysisConfig, files: CodeFile[]): string {
    const languageSummary = this.countLanguages(files);
    const codeSummary = summarizeCodeFiles(files, 40000);

    return `## CODE ANALYSIS CONTEXT
**Project**: ${config.projectName || 'Unknown Project'}
**Description**: ${config.projectDescription || 'No description provided'}
**Input Type**: ${config.inputType}
${config.githubUrl ? `**GitHub URL**: ${config.githubUrl}` : ''}
**Analysis Depth**: ${config.analysisDepth}
**Focus Areas**: ${config.focusAreas.join(', ')}

## CODEBASE OVERVIEW
**Total Files**: ${files.length}
**Total Lines**: ${this.countLines(files)}
**Languages**: ${Object.entries(languageSummary).map(([l, n]) => `${l}: ${n} lines`).join(' | ')}

## FILE STRUCTURE
${this.buildSimpleTree(files)}

## SOURCE CODE
${codeSummary}`;
  }

  private enrichCtx(base: string, ...results: TaskResult[]): string {
    const summaries = results
      .filter(r => r.findings.length > 0)
      .flatMap((r) => r.findings)
      .map((f) => `### [${f.agentRole}] ${f.title}\n${f.content.substring(0, 2000)}...`)
      .join('\n\n');
    return summaries ? `${base}\n\n---\n## PRIOR ANALYSIS FINDINGS\n${summaries}` : base;
  }

  private buildSimpleTree(files: CodeFile[]): string {
    return files
      .slice(0, 40)
      .map(f => `  ${f.path} (${f.language}, ${f.lineCount} lines)`)
      .join('\n') + (files.length > 40 ? `\n  ... and ${files.length - 40} more files` : '');
  }

  // ── Report Assembly ─────────────────────────────────────────
  private assembleReport(
    config: CodeAnalysisConfig,
    files: CodeFile[],
    session: CodeAnalysisSession,
    reviewResult: TaskResult,
    securityResult: TaskResult,
    archResult: TaskResult,
    docsResult: TaskResult,
    synthResult: TaskResult
  ): CodeAnalysisReport {
    const allIssues = [
      ...((reviewResult.data.issues as unknown as CodeIssueItem[]) || []),
      ...((securityResult.data.vulnerabilities as unknown as CodeIssueItem[]) || []),
    ];

    const issuesBySeverity: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const issue of allIssues) {
      const sev = (issue.severity || 'info') as string;
      issuesBySeverity[sev] = (issuesBySeverity[sev] || 0) + 1;
    }

    const criticalIssues = issuesBySeverity['critical'] || 0;
    const highIssues = issuesBySeverity['high'] || 0;

    // Compute overall score
    const overallScore = Math.max(0, 100
      - criticalIssues * 25
      - highIssues * 10
      - (issuesBySeverity['medium'] || 0) * 3
      - (issuesBySeverity['low'] || 0) * 1
    );

    const metrics: CodeMetrics = {
      totalFiles: files.length,
      totalLines: this.countLines(files),
      languages: this.countLanguages(files),
      issuesBySeverity,
      overallScore: Math.min(100, overallScore),
      securityScore: Math.max(0, 100 - criticalIssues * 30 - highIssues * 15),
      maintainabilityScore: Math.max(0, 85 - (issuesBySeverity['medium'] || 0) * 5),
      documentationScore: docsResult.findings.length > 0 ? 80 : 40,
    };

    const architectureInsights = (archResult.data.insights as unknown as ArchInsight[]) || [];

    const docs = (docsResult.data.docs as import('../models/types').GeneratedDocumentation) || {};

    const recommendations: string[] = [];
    if (criticalIssues > 0) recommendations.push(`Fix ${criticalIssues} critical security/quality issues immediately`);
    if (highIssues > 0) recommendations.push(`Address ${highIssues} high-priority issues before next release`);
    if (architectureInsights.length > 0) recommendations.push('Refactor identified architectural anti-patterns');
    if (metrics.documentationScore < 60) recommendations.push('Improve documentation coverage');

    const summary = synthResult.findings[0]?.content || 'Analysis complete. See detailed findings.';

    return {
      projectName: config.projectName || 'Unknown Project',
      summary: summary.slice(0, 1000),
      metrics,
      issues: allIssues as unknown as import('../models/types').CodeIssue[],
      architectureInsights: architectureInsights as unknown as import('../models/types').ArchitectureInsight[],
      generatedDocs: docs,
      recommendations,
      sections: [
        { id: '1', title: 'Code Review', content: (reviewResult.data.review as string) || '', order: 1 },
        { id: '2', title: 'Security Audit', content: (securityResult.data.audit as string) || '', order: 2 },
        { id: '3', title: 'Architecture Analysis', content: (archResult.data.analysis as string) || '', order: 3 },
        { id: '4', title: 'Documentation', content: (docsResult.data.generatedText as string) || '', order: 4 },
        { id: '5', title: 'Synthesis', content: summary, order: 5 },
      ],
      generatedAt: new Date(),
    };
  }

  // ── Helpers ────────────────────────────────────────────────
  private makeTask(role: string, description: string, context: string): ResearchTask {
    return {
      id: uuidv4(),
      assignedTo: role as AgentRole,
      description,
      context,
      priority: 'high',
      dependencies: [],
      status: 'pending',
    };
  }

  private skipResult(role: string): TaskResult {
    return {
      taskId: uuidv4(),
      agentRole: role as AgentRole,
      success: true,
      findings: [],
      data: {},
      tokensUsed: 0,
      thinkingTokens: 0,
      duration: 0,
      timestamp: new Date(),
    };
  }

  private collect(session: CodeAnalysisSession, result: TaskResult): void {
    session.findings.push(...result.findings);
    session.metadata.totalTokens += result.tokensUsed;
    session.metadata.totalThinkingTokens += result.thinkingTokens;
    session.metadata.totalAgentCalls++;
    session.metadata.estimatedCost += (result.tokensUsed * 15) / 1_000_000;
  }

  private calcMetrics(session: CodeAnalysisSession): typeof session.metadata {
    const avg = session.findings.length > 0
      ? session.findings.reduce((s, f) => s + f.confidence, 0) / session.findings.length
      : 0;
    return { ...session.metadata, qualityScore: Math.round(avg * 100) };
  }

  private countLines(files: CodeFile[]): number {
    return files.reduce((sum, f) => sum + (f.lineCount || 0), 0);
  }

  private countLanguages(files: CodeFile[]): Record<string, number> {
    const langs: Record<string, number> = {};
    for (const f of files) {
      const lang = f.language || 'Unknown';
      langs[lang] = (langs[lang] || 0) + (f.lineCount || 0);
    }
    return langs;
  }

  private detectLanguageFromContent(code: string): string {
    if (code.includes('import React') || code.includes('useState')) return 'JavaScript';
    if (code.includes('def ') && code.includes('import ')) return 'Python';
    if (code.includes('func ') && code.includes('package ')) return 'Go';
    if (code.includes('fn ') && code.includes('let mut')) return 'Rust';
    if (code.includes('public class') || code.includes('import java')) return 'Java';
    if (code.includes('interface ') || code.includes(': string') || code.includes('const ')) return 'TypeScript';
    return 'Unknown';
  }

  getSession(id: string): CodeAnalysisSession | undefined {
    return this.sessions.get(id);
  }
}

// ── Internal types for type narrowing ─────────────────────
interface CodeIssueItem {
  severity?: string;
  [key: string]: unknown;
}

interface ArchInsight {
  [key: string]: unknown;
}
