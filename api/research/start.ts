// Vercel Serverless Function — POST /api/research/start
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ResearchPipeline, type StartResult } from '../../engine/coordination/ResearchPipeline';
import type { ResearchConfig } from '../../engine/models/types';

// In-memory session store (Vercel Edge shares memory within the same instance)
// For production scale, replace with Redis or KV store
const pipeline = new ResearchPipeline();

// Export pipeline so the stream route can access sessions
export { pipeline };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const config: ResearchConfig = req.body;

  if (!config.topic || !config.researchQuestion || !config.domain) {
    return res.status(400).json({
      error: 'Missing required fields: topic, researchQuestion, domain',
    });
  }

  // Set defaults
  config.depth = config.depth || 'standard';
  config.outputFormat = config.outputFormat || 'full_paper';
  config.language = config.language || 'English';
  config.objectives = config.objectives?.filter(Boolean) || [
    `Investigate ${config.topic} systematically`,
    'Review existing literature comprehensively',
    'Generate and evaluate testable hypotheses',
    'Design rigorous research methodology',
  ];

  const sessionId = await pipeline.startResearchSession(config);

  res.status(200).json({
    sessionId,
    streamUrl: `/api/research/stream?sessionId=${sessionId}`,
    message: 'Research session created. Connect to streamUrl for real-time updates.',
  });
}
