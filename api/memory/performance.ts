// Vercel Serverless Function — GET /api/memory/performance
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { memoryStore } from '../../engine/memory/MemoryStore'

export default function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { limit = '30' } = req.query
    const snapshots = memoryStore.getPerformanceSnapshots(parseInt(String(limit), 10))
    return res.json({ snapshots })
  } catch {
    return res.json({ snapshots: [] })
  }
}
