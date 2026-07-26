// ============================================================
// Policy Gate — permite, bloquea o exige revisión humana.
// Publicar alertas, lanzar ofertas o declarar validaciones
// requieren gate. Anti-humo: bloquea outputs muertos.
// ============================================================

import type {
  Domain,
  EvidenceItem,
  ValidationItem,
  ActionItem,
  DescendantNode,
  PolicyDecision,
  IntentContract,
} from './types'
import { detectSensitiveIntent } from './sensitivity'

interface PolicyInput {
  domain: Domain
  intent: IntentContract
  evidence: EvidenceItem[]
  validation: ValidationItem[]
  actions: ActionItem[]
  descendants: DescendantNode[]
  hasArtifact: boolean
}

export function evaluatePolicy(input: PolicyInput): PolicyDecision {
  const { domain, intent, evidence, validation, actions, descendants, hasArtifact } = input
  const blockedBy: string[] = []
  const reasons: string[] = []

  // ── Anti-humo hard gates: si falta una pieza esencial, se bloquea.
  if (!hasArtifact) blockedBy.push('Falta el artefacto central.')
  if (evidence.length === 0) blockedBy.push('Falta evidencia o fuente.')
  if (validation.length === 0) blockedBy.push('Falta validación.')
  if (actions.length === 0) blockedBy.push('Falta action queue.')
  if (descendants.length === 0) blockedBy.push('Falta árbol de descendencia.')

  // ── Constraints duros del dominio.
  const blockingConstraints = domain.constraints.filter((c) => c.severity === 'block')
  const failedValidations = validation.filter((v) => !v.passed)
  for (const fv of failedValidations) {
    const matched = blockingConstraints.find((c) => fv.id.includes(c.id))
    if (matched) blockedBy.push(`Constraint bloqueante incumplida: ${matched.rule}`)
  }

  // ── Evidencia: hipótesis no puede pasar como verdad.
  const onlyHypotheses = evidence.length > 0 && evidence.every((e) => e.status === 'hypothesis')
  if (onlyHypotheses) {
    blockedBy.push('Toda la evidencia es hipótesis sin verificar.')
  }

  // ── Acciones sensibles: requieren revisión humana.
  const sensitiveHit = detectSensitiveIntent(intent, domain)
  const requiresHumanReview =
    Boolean(sensitiveHit) ||
    actions.some((a) => a.requiresHumanReview) ||
    domain.constraints.some((c) => c.severity === 'review' && failedValidations.some((v) => v.id.includes(c.id)))

  if (sensitiveHit) reasons.push(`Acción sensible detectada ("${sensitiveHit}"): requiere human review.`)

  if (blockedBy.length > 0) {
    return { status: 'blocked', reasons, blockedBy, requiresHumanReview }
  }
  if (requiresHumanReview) {
    reasons.push('El artefacto está completo pero contiene acciones sensibles.')
    return { status: 'human-review', reasons, blockedBy, requiresHumanReview: true }
  }
  reasons.push('Artefacto completo, con evidencia, validación, acciones y descendencia.')
  return { status: 'validated', reasons, blockedBy, requiresHumanReview: false }
}
