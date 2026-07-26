// ============================================================
// PraxioGraph OS — Core type model
// "Grafo de realidad accionable": cada intención, evidencia,
// regla, artefacto, acción y aprendizaje queda conectado.
// ============================================================

export type GateStatus = 'validated' | 'human-review' | 'blocked'

export type ArtifactType =
  | 'ebook'
  | 'brief'
  | 'ficha'
  | 'mapa'
  | 'imagen'
  | 'landing'
  | 'protocolo'
  | 'matriz'
  | 'prompt-pack'

// ─── Domain registry ────────────────────────────────────────
export interface DomainDescendants {
  immediate: string[]
  commercial: string[]
  operational: string[]
  learning: string[]
  system: string[]
}

export interface DomainConstraint {
  id: string
  rule: string
  severity: 'block' | 'review' | 'warn'
}

export interface DomainOntologyTerm {
  term: string
  klass: string
  synonyms: string[]
}

export interface Domain {
  key: string
  name: string
  tag: string
  accent: string
  pain: string
  inputs: string[]
  outputs: string[]
  pipeline: string[]
  artifactType: ArtifactType
  ontology: DomainOntologyTerm[]
  constraints: DomainConstraint[]
  descendants: DomainDescendants
  // sensitive actions in this domain force a human-review gate
  sensitive: string[]
}

// ─── Pipeline-stage records ─────────────────────────────────
export interface IntentContract {
  id: string
  domain: string
  intent: string
  audience: string
  goal: string
  keywords: string[]
  createdAt: string
}

export interface SemanticMappingItem {
  token: string
  klass: string
  term: string
  matched: boolean
}

export interface EvidenceItem {
  id: string
  source: string
  claim: string
  confidence: number // 0..1
  limitation: string
  status: 'verified' | 'unverified' | 'hypothesis'
}

export interface OntologyCheck {
  passed: boolean
  classes: string[]
  relations: string[]
  issues: string[]
}

export interface ArtifactBrief {
  type: ArtifactType
  title: string
  audience: string
  sections: string[]
  constraints: string[]
}

export interface ValidationItem {
  id: string
  label: string
  passed: boolean
  detail: string
}

export interface ActionItem {
  id: string
  title: string
  owner: string
  status: 'todo' | 'doing' | 'blocked' | 'review' | 'done'
  priority: 'low' | 'med' | 'high'
  requiresHumanReview: boolean
}

export interface LearningRecord {
  worked: string[]
  failed: string[]
  ruleUpdate: string
  metric: string
}

export interface DescendantNode {
  kind: 'immediate' | 'commercial' | 'operational' | 'learning' | 'system'
  label: string
}

export interface Artifact {
  id: string
  type: ArtifactType
  title: string
  body: string // markdown
  sections: { heading: string; content: string }[]
}

export interface PolicyDecision {
  status: GateStatus
  reasons: string[]
  blockedBy: string[]
  requiresHumanReview: boolean
}

export interface ExecutionRecord {
  id: string
  domain: string
  domainName: string
  status: GateStatus
  createdAt: string
  intentContract: IntentContract
  semanticMapping: SemanticMappingItem[]
  evidence: EvidenceItem[]
  ontologyCheck: OntologyCheck
  constraints: string[]
  brief: ArtifactBrief
  artifact: Artifact
  validation: ValidationItem[]
  revisionPatch: string[]
  actions: ActionItem[]
  learning: LearningRecord
  descendants: DescendantNode[]
  policy: PolicyDecision
}

export const PIPELINE_STAGES = [
  'IntentContract',
  'SemanticMapping',
  'EvidenceBundle',
  'OntologyCheck',
  'ConstraintSet',
  'ArtifactBrief',
  'Generation',
  'Validation',
  'RevisionPatch',
  'ApprovedArtifact',
  'ActionQueue',
  'LearningRecord',
  'ArtifactDescendants',
] as const

export type PipelineStage = (typeof PIPELINE_STAGES)[number]
