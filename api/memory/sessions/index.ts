// Vercel Serverless Function — GET /api/memory/sessions
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { memoryStore } from '../../../engine/memory/MemoryStore'

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const { limit = '20', offset = '0', domain } = req.query
    const sessions = memoryStore.listSessions(
      parseInt(String(limit), 10),
      parseInt(String(offset), 10),
      domain as string | undefined,
    )
    return res.json({ sessions })
  } catch {
    return res.json({ sessions: [] })
  }
}
