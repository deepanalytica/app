// ============================================================
// Export Engine — JSON, Markdown, HTML o paquete de entrega.
// Un output sin export reutilizable es output muerto (anti-humo).
// ============================================================

import type { ExecutionRecord } from './types'
import { LINEAGE_LABELS } from './lineageEngine'

export function toJSON(rec: ExecutionRecord): string {
  return JSON.stringify(rec, null, 2)
}

export function toMarkdown(rec: ExecutionRecord): string {
  const lines: string[] = []
  lines.push(`# ${rec.artifact.title}`)
  lines.push('')
  lines.push(`- **Dominio:** ${rec.domainName}`)
  lines.push(`- **Estado / Policy Gate:** ${statusLabel(rec.status)}`)
  lines.push(`- **Intención:** ${rec.intentContract.intent}`)
  lines.push(`- **Audiencia:** ${rec.intentContract.audience}`)
  lines.push(`- **Generado:** ${rec.createdAt}`)
  lines.push('')

  lines.push('## Artefacto')
  lines.push('')
  lines.push(rec.artifact.body)
  lines.push('')

  lines.push('## Evidence Ledger')
  lines.push('')
  rec.evidence.forEach((e) => {
    lines.push(`- **${e.source}** — confianza ${(e.confidence * 100).toFixed(0)}% · ${e.status}. ${e.limitation}`)
  })
  lines.push('')

  lines.push('## Validación')
  lines.push('')
  rec.validation.forEach((v) => lines.push(`- [${v.passed ? 'x' : ' '}] ${v.label} — ${v.detail}`))
  lines.push('')

  lines.push('## Action Queue')
  lines.push('')
  rec.actions.forEach((a) =>
    lines.push(`- **${a.title}** · ${a.owner} · prioridad ${a.priority} · estado ${a.status}${a.requiresHumanReview ? ' · ⚠ human review' : ''}`),
  )
  lines.push('')

  lines.push('## Learning')
  lines.push('')
  lines.push(`**Funcionó:** ${rec.learning.worked.join('; ')}`)
  lines.push('')
  lines.push(`**Falló:** ${rec.learning.failed.join('; ')}`)
  lines.push('')
  lines.push(`**Regla a actualizar:** ${rec.learning.ruleUpdate}`)
  lines.push('')
  lines.push(`**Métrica:** ${rec.learning.metric}`)
  lines.push('')

  lines.push('## Descendencia')
  lines.push('')
  const grouped = groupDescendants(rec)
  Object.entries(grouped).forEach(([kind, items]) => {
    if (items.length) lines.push(`- **${LINEAGE_LABELS[kind as keyof typeof LINEAGE_LABELS]}:** ${items.join(', ')}`)
  })
  lines.push('')

  return lines.join('\n')
}

export function toHTML(rec: ExecutionRecord): string {
  const md = toMarkdown(rec)
  // minimal, self-contained delivery page
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(rec.artifact.title)} · PraxioGraph</title>
<style>body{font-family:Inter,system-ui,sans-serif;max-width:760px;margin:40px auto;padding:0 18px;color:#172033;line-height:1.6;background:#fffdf8}pre{white-space:pre-wrap;background:#f4efe6;padding:16px;border-radius:14px}h1{letter-spacing:-.03em}</style>
</head><body><pre>${escapeHtml(md)}</pre>
<p style="color:#637083;font-size:13px">Generado por PraxioGraph Artifact Workbench · Deep Analytica</p>
</body></html>`
}

function groupDescendants(rec: ExecutionRecord) {
  const out: Record<string, string[]> = {
    immediate: [], commercial: [], operational: [], learning: [], system: [],
  }
  rec.descendants.forEach((d) => out[d.kind].push(d.label))
  return out
}

export function statusLabel(s: ExecutionRecord['status']): string {
  return s === 'validated' ? '✅ Validated' : s === 'human-review' ? '⚠ Human review' : '⛔ Blocked'
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m] as string))
}

export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
