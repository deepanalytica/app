// Vercel Serverless Function — GET /api/memory/stats
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { memoryStore } from '../../engine/memory/MemoryStore'

export default function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    return res.json(memoryStore.getSystemStats())
  } catch {
    return res.json({
      totalSessions: 0,
      totalSkills: 0,
      domainsExplored: [],
      avgQualityScore: 0,
      totalTokensUsed: 0,
      lastUpdated: null,
    })
  }
}
