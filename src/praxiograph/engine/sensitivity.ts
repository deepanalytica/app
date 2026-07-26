// ============================================================
// Sensitivity detection — shared by the engine (Action Queue)
// and the Policy Gate so both agree on when a human review is
// required. Acciones outward-facing (publicar, lanzar, enviar,
// declarar, contactar) exigen revisión humana.
// ============================================================

import type { Domain, IntentContract } from './types'

const SENSITIVE_VERBS = ['publicar', 'lanzar', 'enviar', 'declarar', 'contactar', 'alerta', 'campaña']

export function detectSensitiveIntent(intent: IntentContract, domain: Domain): string | null {
  const text = intent.intent.toLowerCase()
  // Match the full sensitive phrase declared by the domain first.
  const phraseHit = domain.sensitive.find((s) => text.includes(s.toLowerCase()))
  if (phraseHit) return phraseHit
  // Otherwise fall back to a sensitive verb, mapped to a domain phrase.
  const verbHit = SENSITIVE_VERBS.find((v) => text.includes(v))
  if (verbHit) {
    return domain.sensitive.find((s) => s.toLowerCase().includes(verbHit)) ?? verbHit
  }
  return null
}
