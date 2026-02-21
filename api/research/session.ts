// Vercel Serverless Function — GET /api/research/session?sessionId=xxx
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ResearchPipeline } from '../../engine/coordination/ResearchPipeline';

const pipeline = new ResearchPipeline();

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { sessionId } = req.query;

  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'sessionId required' });
  }

  const session = pipeline.getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  res.json({
    id: session.id,
    topic: session.topic,
    phase: session.phase,
    findingsCount: session.findings.length,
    hasPaper: !!session.paper,
    metadata: session.metadata,
  });
}
