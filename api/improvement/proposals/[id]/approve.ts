// Vercel Serverless Function — POST /api/improvement/proposals/:id/approve
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { memoryStore } from '../../../../engine/memory/MemoryStore'

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { id } = req.query as { id: string }
    const proposal = memoryStore.approveProposal(id)
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' })
    return res.json({ proposal })
  } catch (e: unknown) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to approve' })
  }
}
