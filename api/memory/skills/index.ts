// Vercel Serverless Function — GET /api/memory/skills
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { memoryStore } from '../../../engine/memory/MemoryStore'

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const { q, domain, tags, limit = '50' } = req.query
    let skills

    if (q && typeof q === 'string') {
      skills = memoryStore.searchSkills(q)
    } else {
      const tagList = tags ? String(tags).split(',').map(t => t.trim()) : undefined
      skills = memoryStore.listSkills(
        domain as string | undefined,
        tagList,
        parseInt(String(limit), 10),
      )
    }
    return res.json({ skills })
  } catch {
    return res.json({ skills: [] })
  }
}
