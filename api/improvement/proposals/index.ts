// Vercel Serverless Function — GET /api/improvement/proposals
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { memoryStore } from '../../../engine/memory/MemoryStore'

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const { status } = req.query
    const proposals = memoryStore.listProposals(
      status && status !== 'all' ? (status as string) : undefined,
    )
    return res.json({ proposals })
  } catch {
    return res.json({ proposals: [] })
  }
}
