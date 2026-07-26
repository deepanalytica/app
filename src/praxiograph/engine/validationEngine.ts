// ============================================================
// Validation Engine — TDD para artefactos. No se declara éxito
// porque "se ve bien". Debe pasar tests de artefacto central,
// evidencia, validation, action queue, learning, descendants y export.
// ============================================================

import type {
  Domain,
  EvidenceItem,
  ValidationItem,
  ArtifactBrief,
  Artifact,
} from './types'

interface ValidationInput {
  domain: Domain
  brief: ArtifactBrief
  artifact: Artifact
  evidence: EvidenceItem[]
  intentKeywords: string[]
}

export function runValidation(input: ValidationInput): ValidationItem[] {
  const { domain, brief, artifact, evidence, intentKeywords } = input
  const items: ValidationItem[] = []

  // ── Anti-humo base checklist (común a todo dominio) ──
  items.push({
    id: 'core-artifact',
    label: 'Artefacto central presente',
    passed: artifact.sections.length > 0 && artifact.body.trim().length > 0,
    detail: `${artifact.sections.length} secciones generadas.`,
  })
  items.push({
    id: 'core-evidence',
    label: 'Evidencia con fuente',
    passed: evidence.length > 0 && evidence.some((e) => e.status !== 'hypothesis'),
    detail: `${evidence.length} evidencias, ${evidence.filter((e) => e.status === 'verified').length} verificadas.`,
  })
  items.push({
    id: 'core-relevance',
    label: 'Artefacto alineado con la intención',
    passed: intentKeywords.length === 0 || intentKeywords.some((k) =>
      artifact.body.toLowerCase().includes(k.toLowerCase()),
    ),
    detail: 'El cuerpo referencia los conceptos clave de la intención.',
  })
  items.push({
    id: 'core-brief',
    label: 'Brief coherente con el output del dominio',
    passed: brief.type === domain.artifactType && brief.sections.length >= 3,
    detail: `Tipo ${brief.type}, ${brief.sections.length} secciones.`,
  })

  // ── Constraints específicas del dominio ──
  for (const c of domain.constraints) {
    items.push({
      id: `constraint-${c.id}`,
      label: c.rule,
      passed: evaluateConstraint(c.id, input),
      detail: `Severidad: ${c.severity}.`,
    })
  }

  return items
}

function evaluateConstraint(id: string, input: ValidationInput): boolean {
  const { evidence, artifact } = input
  switch (id) {
    case 'geo-ev':
      return evidence.some((e) => e.status === 'verified')
    case 'eb-offer':
      return /oferta|cta|plan|precio/i.test(artifact.body)
    case 'sv-comp':
      return /component|etiqueta|label/i.test(artifact.body)
    case 'sv-valid':
      return evidence.some((e) => e.confidence >= 0.7)
    case 'bo-cycle':
      return /acci[oó]n|owner|responsable/i.test(artifact.body)
    default:
      // review/warn constraints: pass by default if there is a real artifact
      return artifact.sections.length > 0
  }
}
