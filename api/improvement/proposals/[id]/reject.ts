// Vercel Serverless Function — POST /api/improvement/proposals/:id/reject
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { memoryStore } from '../../../../engine/memory/MemoryStore'

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { id } = req.query as { id: string }
    const { reason = '' } = req.body || {}
    const proposal = memoryStore.rejectProposal(id, reason)
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' })
    return res.json({ proposal })
  } catch (e: unknown) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to reject' })
  }
}
