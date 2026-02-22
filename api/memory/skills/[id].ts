// Vercel Serverless Function — GET /api/memory/skills/:id
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { memoryStore } from '../../../engine/memory/MemoryStore'

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const { id } = req.params as { id: string }
    const skill = memoryStore.getSkill(id)
    if (!skill) return res.status(404).json({ error: 'Skill not found' })

    const related = (skill.relatedSkillIds || [])
      .map((rid: string) => memoryStore.getSkill(rid))
      .filter(Boolean)

    return res.json({ skill, related })
  } catch {
    return res.status(404).json({ error: 'Skill not found' })
  }
}
