// Vercel Serverless Function — POST /api/improvement/analyze
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { selfImprovementAgent } from '../../engine/self_improvement/SelfImprovementAgent'

export const config = {
  maxDuration: 120,
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const result = await selfImprovementAgent.analyzeSystem()
    return res.json({ success: true, proposals: result })
  } catch (e: unknown) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Analysis failed' })
  }
}
