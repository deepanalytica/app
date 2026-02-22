// ============================================================
// MULTI-AGENT RESEARCH SYSTEM — Backend Server
// Express + WebSocket server with real-time streaming
// NEW: Code Analysis, Interactive Control, Export, GitHub Input
// ============================================================

import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { ResearchPipeline } from './coordination/ResearchPipeline';
import { CodeAnalysisPipeline } from './coordination/CodeAnalysisPipeline';
import { exportPaper, codeReportToMarkdown } from './export/PaperExporter';
import { memoryStore } from './memory/MemoryStore';
import { selfImprovementAgent } from './self_improvement/SelfImprovementAgent';
import type {
  ResearchConfig,
  StreamEvent,
  CodeAnalysisConfig,
  CodeFocusArea,
  ExportFormat,
  AgentRole,
} from './models/types';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3001;
const pipeline = new ResearchPipeline();
const codePipeline = new CodeAnalysisPipeline();

// ─── Middleware ────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' })); // Increased for code file uploads

// ─── WebSocket Client Registry ─────────────────────────────
const clients = new Map<string, Set<WebSocket>>();

function getClientsForSession(sessionId: string): Set<WebSocket> {
  if (!clients.has(sessionId)) {
    clients.set(sessionId, new Set());
  }
  return clients.get(sessionId)!;
}

function broadcastToSession(sessionId: string, event: StreamEvent): void {
  const sessionClients = clients.get(sessionId);
  if (!sessionClients) return;

  const message = JSON.stringify({
    ...event,
    timestamp: event.timestamp.toISOString(),
  });

  for (const ws of sessionClients) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(message);
      } catch (err) {
        console.error('[WS] Send error:', err);
        sessionClients.delete(ws);
      }
    } else {
      sessionClients.delete(ws);
    }
  }
}

// ─── Pipeline Event → WebSocket Bridge ─────────────────────
pipeline.on('stream', (event: StreamEvent) => {
  broadcastToSession(event.sessionId, event);
});

codePipeline.on('stream', (event: StreamEvent) => {
  broadcastToSession(event.sessionId, event);
});

// ─── WebSocket Connection Handler ──────────────────────────
wss.on('connection', (ws) => {
  let subscribedSession: string | null = null;

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'subscribe' && msg.sessionId) {
        subscribedSession = msg.sessionId;
        getClientsForSession(msg.sessionId).add(ws);
        ws.send(JSON.stringify({ type: 'subscribed', sessionId: msg.sessionId }));

        // Send current research session state if available
        const session = pipeline.getSession(msg.sessionId);
        if (session) {
          ws.send(JSON.stringify({
            type: 'session_state',
            sessionId: msg.sessionId,
            data: { phase: session.phase, findingsCount: session.findings.length, metadata: session.metadata },
            timestamp: new Date().toISOString(),
          }));
        }

        // Send current code session state if available
        const codeSession = codePipeline.getSession(msg.sessionId);
        if (codeSession) {
          ws.send(JSON.stringify({
            type: 'session_state',
            sessionId: msg.sessionId,
            data: { phase: codeSession.phase, findingsCount: codeSession.findings.length, metadata: codeSession.metadata },
            timestamp: new Date().toISOString(),
          }));
        }
      }

      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch (err) {
      console.error('[WS] Message parse error:', err);
    }
  });

  ws.on('close', () => {
    if (subscribedSession) {
      clients.get(subscribedSession)?.delete(ws);
    }
  });

  ws.on('error', (err) => {
    console.error('[WS] Error:', err);
  });

  ws.send(JSON.stringify({
    type: 'connected',
    message: 'Connected to Multi-Agent Research System v2.0',
    timestamp: new Date().toISOString(),
  }));
});

// ────────────────────────────────────────────────────────────
// REST API ROUTES
// ────────────────────────────────────────────────────────────

// ─── Health Check ──────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'operational',
    system: 'Multi-Agent Research System',
    version: '2.0.0',
    agents: {
      research: [
        'Research Director', 'Literature Reviewer', 'Hypothesis Generator',
        'Methodology Expert', 'Data Analyst', 'Critical Reviewer',
        'Synthesis Specialist', 'Scientific Writer', 'Citation Manager',
      ],
      code: ['Code Reviewer', 'Architecture Analyst', 'Security Auditor', 'Documentation Generator'],
    },
    features: [
      'real_time_streaming', 'interactive_control', 'code_analysis',
      'export', 'github_input', 'persistent_memory', 'knowledge_skills', 'self_improvement',
    ],
    memory: memoryStore.getSystemStats(),
    timestamp: new Date().toISOString(),
  });
});

// ════════════════════════════════════════════════════════════
// RESEARCH ENDPOINTS
// ════════════════════════════════════════════════════════════

// Start a new research session
app.post('/api/research/start', async (req, res) => {
  try {
    const config: ResearchConfig = req.body;

    if (!config.topic || !config.researchQuestion || !config.domain) {
      return res.status(400).json({ error: 'Missing required fields: topic, researchQuestion, domain' });
    }

    config.depth = config.depth || 'comprehensive';
    config.outputFormat = config.outputFormat || 'full_paper';
    config.language = config.language || 'English';
    config.objectives = config.objectives || [
      `Investigate ${config.topic} systematically`,
      'Review existing literature comprehensively',
      'Generate and evaluate testable hypotheses',
      'Design rigorous research methodology',
    ];

    console.log(`[Research] Starting: "${config.topic}"`);
    const sessionId = await pipeline.startResearch(config);

    res.json({
      sessionId,
      message: 'Research session started',
      websocketPath: `/ws?session=${sessionId}`,
      interactiveControls: {
        pause: `POST /api/research/${sessionId}/pause`,
        resume: `POST /api/research/${sessionId}/resume`,
        feedback: `POST /api/research/${sessionId}/feedback`,
        chat: `POST /api/research/${sessionId}/chat`,
        export: `POST /api/research/${sessionId}/export`,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API] Start research error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get session status
app.get('/api/research/:sessionId', (req, res) => {
  const session = pipeline.getSession(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  res.json({
    id: session.id,
    topic: session.topic,
    phase: session.phase,
    startTime: session.startTime,
    endTime: session.endTime,
    findingsCount: session.findings.length,
    citationsCount: session.citations.length,
    metadata: session.metadata,
    hasPaper: !!session.paper,
    paused: pipeline.getPausedSessions().includes(req.params.sessionId),
  });
});

// Get session findings
app.get('/api/research/:sessionId/findings', (req, res) => {
  const session = pipeline.getSession(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const { role, phase } = req.query;
  let findings = session.findings;
  if (role) findings = findings.filter(f => f.agentRole === role);
  if (phase) findings = findings.filter(f => f.phase === phase);

  res.json({ findings, total: findings.length });
});

// Get generated paper
app.get('/api/research/:sessionId/paper', (req, res) => {
  const session = pipeline.getSession(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (!session.paper) return res.status(404).json({ error: 'Paper not yet generated' });

  res.json({ paper: session.paper, citations: session.citations });
});

// ─── INTERACTIVE CONTROLS ──────────────────────────────────

// Pause pipeline (between phases)
app.post('/api/research/:sessionId/pause', (req, res) => {
  const { sessionId } = req.params;
  const session = pipeline.getSession(sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (session.phase === 'completed') return res.status(400).json({ error: 'Session already completed' });

  pipeline.pause(sessionId);
  broadcastToSession(sessionId, {
    type: 'pipeline_paused',
    sessionId,
    data: { phase: session.phase, message: 'Pause requested — will pause after current phase completes' },
    timestamp: new Date(),
  });

  res.json({ status: 'pause_requested', phase: session.phase, message: 'Pipeline will pause after the current phase completes' });
});

// Resume pipeline
app.post('/api/research/:sessionId/resume', (req, res) => {
  const { sessionId } = req.params;
  const session = pipeline.getSession(sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  pipeline.resume(sessionId);

  broadcastToSession(sessionId, {
    type: 'pipeline_resumed',
    sessionId,
    data: { phase: session.phase, message: 'Pipeline resumed' },
    timestamp: new Date(),
  });

  res.json({ status: 'resumed', phase: session.phase });
});

// Submit user feedback
app.post('/api/research/:sessionId/feedback', (req, res) => {
  const { sessionId } = req.params;
  const session = pipeline.getSession(sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const { type, message, targetAgent } = req.body;
  if (!message) return res.status(400).json({ error: 'Missing feedback message' });

  const validTypes = ['correction', 'expansion', 'redirect', 'approval', 'rejection'];
  if (type && !validTypes.includes(type)) {
    return res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` });
  }

  pipeline.submitFeedback(sessionId, {
    phase: session.phase,
    type: type || 'correction',
    targetAgent: targetAgent as AgentRole | undefined,
    message,
  });

  broadcastToSession(sessionId, {
    type: 'user_feedback_received',
    sessionId,
    data: { type: type || 'correction', message, phase: session.phase },
    timestamp: new Date(),
  });

  res.json({
    status: 'feedback_accepted',
    message: 'Feedback will be incorporated into the next agent\'s context',
    phase: session.phase,
  });
});

// Chat with a specific agent mid-session
app.post('/api/research/:sessionId/chat', async (req, res) => {
  const { sessionId } = req.params;
  const session = pipeline.getSession(sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const { agentRole, message } = req.body;
  if (!agentRole || !message) {
    return res.status(400).json({ error: 'Missing agentRole or message' });
  }

  const validRoles: AgentRole[] = [
    'research_director', 'literature_reviewer', 'hypothesis_generator',
    'methodology_expert', 'data_analyst', 'critical_reviewer',
    'synthesis_specialist', 'scientific_writer', 'citation_manager',
  ];

  if (!validRoles.includes(agentRole)) {
    return res.status(400).json({ error: `Invalid agentRole. Valid options: ${validRoles.join(', ')}` });
  }

  try {
    const response = await pipeline.chatWithAgent(sessionId, agentRole as AgentRole, message);

    broadcastToSession(sessionId, {
      type: 'agent_chat_response',
      sessionId,
      agentRole: agentRole as AgentRole,
      data: { userMessage: message, agentResponse: response, agentRole },
      timestamp: new Date(),
    });

    res.json({ agentRole, question: message, response });
  } catch (error) {
    const msg = (error as Error).message;
    if (msg.includes('Agents not initialized')) {
      return res.status(409).json({
        error: 'Agents are not available for chat at this time. The session may have completed or not started yet.',
      });
    }
    res.status(500).json({ error: msg });
  }
});

// Export paper in specified format
app.post('/api/research/:sessionId/export', (req, res) => {
  const session = pipeline.getSession(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (!session.paper) return res.status(404).json({ error: 'Paper not yet generated' });

  const format = (req.body.format || req.query.format || 'markdown') as ExportFormat;
  const validFormats: ExportFormat[] = ['latex', 'markdown', 'html', 'json'];

  if (!validFormats.includes(format)) {
    return res.status(400).json({ error: `Invalid format. Must be one of: ${validFormats.join(', ')}` });
  }

  try {
    const result = exportPaper(session.paper, session.citations, format);
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.content);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// ════════════════════════════════════════════════════════════
// CODE ANALYSIS ENDPOINTS
// ════════════════════════════════════════════════════════════

// Start code analysis from paste, files, or GitHub URL
app.post('/api/code/analyze', async (req, res) => {
  try {
    const body = req.body;

    // Validate input
    const inputType = body.inputType as string;
    if (!inputType || !['paste', 'files', 'github_url'].includes(inputType)) {
      return res.status(400).json({ error: 'inputType must be: paste, files, or github_url' });
    }

    if (inputType === 'paste' && !body.code) {
      return res.status(400).json({ error: 'code is required for paste input' });
    }
    if (inputType === 'files' && (!body.files || !Array.isArray(body.files) || body.files.length === 0)) {
      return res.status(400).json({ error: 'files array is required for files input' });
    }
    if (inputType === 'github_url' && !body.githubUrl) {
      return res.status(400).json({ error: 'githubUrl is required for github_url input' });
    }

    const validFocusAreas: CodeFocusArea[] = ['security', 'architecture', 'quality', 'documentation', 'performance', 'testing'];
    const focusAreas: CodeFocusArea[] = (body.focusAreas || ['security', 'architecture', 'quality', 'documentation'])
      .filter((f: string) => validFocusAreas.includes(f as CodeFocusArea));

    const config: CodeAnalysisConfig = {
      inputType: inputType as 'paste' | 'files' | 'github_url',
      code: body.code,
      language: body.language,
      fileName: body.fileName,
      files: body.files,
      githubUrl: body.githubUrl,
      githubToken: body.githubToken,
      projectName: body.projectName || (body.githubUrl ? body.githubUrl.split('/').slice(-1)[0] : 'Unnamed Project'),
      projectDescription: body.projectDescription || '',
      analysisDepth: body.analysisDepth || 'standard',
      focusAreas,
      outputFormat: body.outputFormat || 'full_report',
    };

    console.log(`[Code] Starting analysis: "${config.projectName}" (${inputType})`);
    const sessionId = await codePipeline.startAnalysis(config);

    res.json({
      sessionId,
      message: 'Code analysis started',
      websocketPath: `/ws?session=${sessionId}`,
      config: {
        projectName: config.projectName,
        inputType: config.inputType,
        analysisDepth: config.analysisDepth,
        focusAreas: config.focusAreas,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API] Code analysis error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get code analysis session status
app.get('/api/code/:sessionId', (req, res) => {
  const session = codePipeline.getSession(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Code session not found' });

  res.json({
    id: session.id,
    projectName: session.config.projectName,
    phase: session.phase,
    startTime: session.startTime,
    endTime: session.endTime,
    filesAnalyzed: session.files.length,
    findingsCount: session.findings.length,
    hasReport: !!session.report,
    metadata: session.metadata,
  });
});

// Get code analysis report (JSON)
app.get('/api/code/:sessionId/report', (req, res) => {
  const session = codePipeline.getSession(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Code session not found' });
  if (!session.report) return res.status(404).json({ error: 'Report not yet generated' });

  res.json({ report: session.report, findings: session.findings });
});

// Export code analysis report
app.post('/api/code/:sessionId/export', (req, res) => {
  const session = codePipeline.getSession(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Code session not found' });
  if (!session.report) return res.status(404).json({ error: 'Report not yet generated' });

  const format = (req.body.format || req.query.format || 'markdown') as string;

  if (format === 'markdown') {
    const content = codeReportToMarkdown(session.report);
    const filename = `code-analysis-${session.config.projectName?.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'report'}.md`;
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  } else if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="code-analysis-${session.id}.json"`);
    res.json({ report: session.report, findings: session.findings });
  } else {
    res.status(400).json({ error: 'Format must be: markdown or json' });
  }
});

// Get code analysis findings
app.get('/api/code/:sessionId/findings', (req, res) => {
  const session = codePipeline.getSession(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Code session not found' });

  const { role } = req.query;
  let findings = session.findings;
  if (role) findings = findings.filter(f => f.agentRole === role);

  res.json({ findings, total: findings.length });
});

// ════════════════════════════════════════════════════════════
// MEMORY — Knowledge Skills & Session History
// ════════════════════════════════════════════════════════════

// List knowledge skills
app.get('/api/memory/skills', (req, res) => {
  const { domain, tags, q, limit } = req.query;
  const lim = parseInt(limit as string) || 50;

  let skills;
  if (q) {
    skills = memoryStore.searchSkills(q as string);
  } else {
    const tagList = tags ? String(tags).split(',') : undefined;
    skills = memoryStore.listSkills(domain as string | undefined, tagList, lim);
  }

  res.json({ skills, total: skills.length });
});

// Get skill detail
app.get('/api/memory/skills/:skillId', (req, res) => {
  const skill = memoryStore.getSkill(req.params.skillId);
  if (!skill) return res.status(404).json({ error: 'Skill not found' });

  // Include related skills
  const related = skill.relatedSkillIds
    .slice(0, 5)
    .map(id => memoryStore.getSkill(id))
    .filter(Boolean);

  res.json({ skill, related });
});

// Search skills
app.post('/api/memory/skills/search', (req, res) => {
  const { query, domain, tags } = req.body;
  if (!query && !domain && !tags) {
    return res.status(400).json({ error: 'Provide query, domain, or tags' });
  }
  const skills = query
    ? memoryStore.searchSkills(query)
    : memoryStore.listSkills(domain, tags);
  res.json({ skills, total: skills.length });
});

// List session history
app.get('/api/memory/sessions', (req, res) => {
  const { domain, limit, offset } = req.query;
  const lim = parseInt(limit as string) || 20;
  const off = parseInt(offset as string) || 0;
  const sessions = memoryStore.listSessions(lim, off, domain as string | undefined);
  res.json({ sessions, total: sessions.length });
});

// Get persisted session detail
app.get('/api/memory/sessions/:sessionId', (req, res) => {
  const session = memoryStore.getSession(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found in memory' });
  res.json({
    id: session.id,
    topic: session.topic,
    domain: session.domain,
    researchQuestion: session.researchQuestion,
    phase: session.phase,
    startTime: session.startTime,
    endTime: session.endTime,
    findingsCount: session.findings.length,
    citationsCount: session.citations.length,
    hasPaper: !!session.paper,
    metadata: session.metadata,
    findings: session.findings.slice(0, 10), // First 10 findings
  });
});

// System stats
app.get('/api/memory/stats', (_req, res) => {
  res.json(memoryStore.getSystemStats());
});

// Performance snapshots
app.get('/api/memory/performance', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 30;
  res.json({ snapshots: memoryStore.getPerformanceSnapshots(limit) });
});

// ════════════════════════════════════════════════════════════
// SELF-IMPROVEMENT — Proposals & Overrides
// ════════════════════════════════════════════════════════════

// List proposals
app.get('/api/improvement/proposals', (req, res) => {
  const { status } = req.query;
  const validStatuses = ['pending', 'approved', 'rejected', 'applied'];
  const s = validStatuses.includes(status as string)
    ? status as 'pending' | 'approved' | 'rejected' | 'applied'
    : undefined;
  const proposals = memoryStore.listProposals(s);
  res.json({ proposals, total: proposals.length });
});

// Get proposal detail
app.get('/api/improvement/proposals/:proposalId', (req, res) => {
  const proposal = memoryStore.getProposal(req.params.proposalId);
  if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
  res.json({ proposal });
});

// Approve proposal
app.post('/api/improvement/proposals/:proposalId/approve', (req, res) => {
  const proposal = memoryStore.approveProposal(req.params.proposalId);
  if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
  res.json({ status: 'approved', proposal });
});

// Reject proposal
app.post('/api/improvement/proposals/:proposalId/reject', (req, res) => {
  const { reason } = req.body;
  const proposal = memoryStore.rejectProposal(req.params.proposalId, reason);
  if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
  res.json({ status: 'rejected', proposal });
});

// Trigger system-wide analysis manually
app.post('/api/improvement/analyze', async (_req, res) => {
  try {
    const proposals = await selfImprovementAgent.analyzeSystemPerformance();
    res.json({
      status: 'analysis_complete',
      newProposals: proposals.length,
      proposals: proposals.map(p => ({ id: p.id, title: p.title, priority: p.priority })),
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// List active prompt overrides
app.get('/api/improvement/overrides', (req, res) => {
  const { agentRole } = req.query;
  const overrides = agentRole
    ? memoryStore.getApprovedOverrides(agentRole as string)
    : memoryStore.getApprovedOverrides('synthesis_specialist'); // default
  res.json({ overrides });
});

// ─── Server Start ───────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║        MULTI-AGENT RESEARCH SYSTEM — SERVER v2.0 READY          ║
╠══════════════════════════════════════════════════════════════════╣
║  HTTP API:  http://localhost:${PORT}                              ║
║  WebSocket: ws://localhost:${PORT}                                ║
║  Health:    http://localhost:${PORT}/api/health                   ║
╠══════════════════════════════════════════════════════════════════╣
║  RESEARCH AGENTS: 9 Specialized (Research + Writing)            ║
║  CODE AGENTS:     4 Specialized (Review + Arch + Security + Docs)║
╠══════════════════════════════════════════════════════════════════╣
║  NEW: Interactive Control (pause/resume/feedback/chat)           ║
║  NEW: Code Analysis (paste/files/GitHub URL)                     ║
║  NEW: Export (LaTeX/Markdown/HTML/JSON)                          ║
║  NEW: Real Database Search (Semantic Scholar + arXiv)            ║
╚══════════════════════════════════════════════════════════════════╝
  `);
});

export default app;
