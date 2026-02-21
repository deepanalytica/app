// ============================================================
// MULTI-AGENT RESEARCH SYSTEM — Backend Server
// Express + WebSocket server with real-time streaming
// ============================================================

import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { ResearchPipeline } from './coordination/ResearchPipeline';
import type { ResearchConfig, StreamEvent } from './models/types';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3001;
const pipeline = new ResearchPipeline();

// ─── Middleware ────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

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

        // Send current session state if available
        const session = pipeline.getSession(msg.sessionId);
        if (session) {
          ws.send(
            JSON.stringify({
              type: 'session_state',
              sessionId: msg.sessionId,
              data: {
                phase: session.phase,
                findingsCount: session.findings.length,
                metadata: session.metadata,
              },
              timestamp: new Date().toISOString(),
            })
          );
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
      const sessionClients = clients.get(subscribedSession);
      sessionClients?.delete(ws);
    }
  });

  ws.on('error', (err) => {
    console.error('[WS] Error:', err);
  });

  // Send welcome
  ws.send(
    JSON.stringify({
      type: 'connected',
      message: 'Connected to Multi-Agent Research System',
      timestamp: new Date().toISOString(),
    })
  );
});

// ─── REST API Routes ───────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'operational',
    system: 'Multi-Agent Research System',
    version: '1.0.0',
    agents: [
      'Research Director',
      'Literature Reviewer',
      'Hypothesis Generator',
      'Methodology Expert',
      'Data Analyst',
      'Critical Reviewer',
      'Synthesis Specialist',
      'Scientific Writer',
      'Citation Manager',
    ],
    timestamp: new Date().toISOString(),
  });
});

// Start a new research session
app.post('/api/research/start', async (req, res) => {
  try {
    const config: ResearchConfig = req.body;

    // Validate required fields
    if (!config.topic || !config.researchQuestion || !config.domain) {
      return res.status(400).json({
        error: 'Missing required fields: topic, researchQuestion, domain',
      });
    }

    // Set defaults
    config.depth = config.depth || 'comprehensive';
    config.outputFormat = config.outputFormat || 'full_paper';
    config.language = config.language || 'English';
    config.objectives = config.objectives || [
      `Investigate ${config.topic} systematically`,
      'Review existing literature comprehensively',
      'Generate and evaluate testable hypotheses',
      'Design rigorous research methodology',
    ];

    console.log(`[Pipeline] Starting research: "${config.topic}"`);
    const sessionId = await pipeline.startResearch(config);

    res.json({
      sessionId,
      message: 'Research session started successfully',
      websocketPath: `/ws?session=${sessionId}`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API] Start research error:', error);
    res.status(500).json({
      error: (error as Error).message,
      details: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined,
    });
  }
});

// Get session status
app.get('/api/research/:sessionId', (req, res) => {
  const session = pipeline.getSession(req.params.sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

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
  });
});

// Get session findings
app.get('/api/research/:sessionId/findings', (req, res) => {
  const session = pipeline.getSession(req.params.sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const { role, phase } = req.query;
  let findings = session.findings;

  if (role) {
    findings = findings.filter((f) => f.agentRole === role);
  }
  if (phase) {
    findings = findings.filter((f) => f.phase === phase);
  }

  res.json({ findings, total: findings.length });
});

// Get the generated paper
app.get('/api/research/:sessionId/paper', (req, res) => {
  const session = pipeline.getSession(req.params.sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  if (!session.paper) {
    return res.status(404).json({ error: 'Paper not yet generated' });
  }

  res.json({ paper: session.paper, citations: session.citations });
});

// ─── Server Start ───────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║        MULTI-AGENT RESEARCH SYSTEM — SERVER READY           ║
╠══════════════════════════════════════════════════════════════╣
║  HTTP API:  http://localhost:${PORT}                          ║
║  WebSocket: ws://localhost:${PORT}                            ║
║  Health:    http://localhost:${PORT}/api/health               ║
╠══════════════════════════════════════════════════════════════╣
║  AGENTS: 9 Specialized AI Agents                            ║
║  MODEL:  claude-opus-4-6 (Adaptive Thinking)               ║
╚══════════════════════════════════════════════════════════════╝
  `);
});

export default app;
