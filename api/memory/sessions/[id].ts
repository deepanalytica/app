// Vercel Serverless Function — GET /api/memory/sessions/:id
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { memoryStore } from '../../../engine/memory/MemoryStore'

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const { id } = req.params as { id: string }
    const session = memoryStore.getSession(id)
    if (!session) return res.status(404).json({ error: 'Session not found in memory' })
    return res.json(session)
  } catch {
    return res.status(404).json({ error: 'Session not found' })
  }
}
