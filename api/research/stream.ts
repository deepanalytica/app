// Vercel Serverless Function — GET /api/research/stream?sessionId=xxx
// Uses Server-Sent Events (SSE) to stream research progress
// Vercel Pro supports up to 300s streaming duration
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ResearchPipeline } from '../../engine/coordination/ResearchPipeline';
import type { StreamEvent } from '../../engine/models/types';

const pipeline = new ResearchPipeline();

export const config = {
  maxDuration: 300, // Vercel Pro: 300 seconds max
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { sessionId } = req.query;

  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'sessionId required' });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  const write = (event: StreamEvent) => {
    const data = JSON.stringify({
      ...event,
      timestamp: event.timestamp instanceof Date
        ? event.timestamp.toISOString()
        : event.timestamp,
    });
    res.write(`data: ${data}\n\n`);
  };

  // Send heartbeat every 15 seconds to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 15_000);

  // Send initial connected event
  write({
    type: 'progress',
    sessionId,
    data: { percentage: 0, message: 'Connected — starting research agents...' },
    timestamp: new Date(),
  });

  try {
    await pipeline.runResearchWithSSE(sessionId, write);
  } catch (error) {
    write({
      type: 'error',
      sessionId,
      data: { error: (error as Error).message },
      timestamp: new Date(),
    });
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
}
