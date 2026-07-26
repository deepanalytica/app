// ============================================================
// Lineage Engine — obliga a que cada artefacto tenga descendencia:
// derivados inmediatos, comerciales, operativos, learning y system.
// ============================================================

import type { Domain, DescendantNode } from './types'

export function buildLineage(domain: Domain): DescendantNode[] {
  const d = domain.descendants
  const nodes: DescendantNode[] = []
  d.immediate.forEach((label) => nodes.push({ kind: 'immediate', label }))
  d.commercial.forEach((label) => nodes.push({ kind: 'commercial', label }))
  d.operational.forEach((label) => nodes.push({ kind: 'operational', label }))
  d.learning.forEach((label) => nodes.push({ kind: 'learning', label }))
  d.system.forEach((label) => nodes.push({ kind: 'system', label }))
  return nodes
}

export const LINEAGE_LABELS: Record<DescendantNode['kind'], string> = {
  immediate: 'Inmediatos',
  commercial: 'Comerciales',
  operational: 'Operativos',
  learning: 'Learning',
  system: 'Sistema',
}
