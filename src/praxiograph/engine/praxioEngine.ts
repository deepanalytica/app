// ============================================================
// PraxioGraph OS — engine principal.
// Convierte intención → evidencia → significado → artefacto →
// acción → aprendizaje → descendencia. Determinístico: la IA puede
// entrar luego como motor cognitivo, pero el estado vive aquí.
//
// Pipeline madre:
// IntentContract → SemanticMapping → EvidenceBundle → OntologyCheck
// → ConstraintSet → ArtifactBrief → Generation → Validation
// → RevisionPatch → ApprovedArtifact → ActionQueue → LearningRecord
// → ArtifactDescendants
// ============================================================

import type {
  Domain,
  ExecutionRecord,
  IntentContract,
  SemanticMappingItem,
  EvidenceItem,
  OntologyCheck,
  ArtifactBrief,
  Artifact,
  ActionItem,
  LearningRecord,
} from './types'
import { getDomain } from './domains'
import { runValidation } from './validationEngine'
import { evaluatePolicy } from './policyEngine'
import { buildLineage } from './lineageEngine'
import { detectSensitiveIntent } from './sensitivity'

const STOP_WORDS = new Set([
  'de', 'la', 'el', 'los', 'las', 'un', 'una', 'y', 'o', 'para', 'con', 'sin',
  'que', 'del', 'al', 'en', 'por', 'su', 'sus', 'lo', 'se', 'es', 'a', 'the',
])

let counter = 0
function uid(prefix: string): string {
  counter += 1
  const rand = Math.random().toString(36).slice(2, 7)
  return `${prefix}_${Date.now().toString(36)}${counter}${rand}`
}

export interface RunOptions {
  domainKey: string
  intent: string
  audience?: string
  goal?: string
}

function extractKeywords(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 3 && !STOP_WORDS.has(w)),
    ),
  ).slice(0, 12)
}

// ── 1. IntentContract ──
function buildIntent(opts: RunOptions, domain: Domain): IntentContract {
  return {
    id: uid('intent'),
    domain: domain.key,
    intent: opts.intent.trim(),
    audience: opts.audience?.trim() || 'Cliente / equipo de Deep Analytica',
    goal: opts.goal?.trim() || `Producir un ${domain.artifactType} accionable para ${domain.name}.`,
    keywords: extractKeywords(opts.intent),
    createdAt: new Date().toISOString(),
  }
}

// ── 2. SemanticMapping ──
function mapSemantics(intent: IntentContract, domain: Domain): SemanticMappingItem[] {
  const tokens = intent.keywords.length ? intent.keywords : extractKeywords(intent.goal)
  return tokens.map((token) => {
    const hit = domain.ontology.find(
      (o) =>
        o.term === token ||
        o.synonyms.includes(token) ||
        o.term.includes(token) ||
        token.includes(o.term),
    )
    return {
      token,
      klass: hit ? hit.klass : 'Unmapped',
      term: hit ? hit.term : token,
      matched: Boolean(hit),
    }
  })
}

// ── 3. EvidenceBundle ──
function buildEvidence(intent: IntentContract, domain: Domain): EvidenceItem[] {
  // genera evidencia a partir de los inputs del dominio, con un
  // gradiente de confianza determinístico para evitar "todo verdad".
  return domain.inputs.slice(0, 5).map((source, i) => {
    const confidence = Math.max(0.45, 0.92 - i * 0.12)
    const status: EvidenceItem['status'] =
      confidence >= 0.8 ? 'verified' : confidence >= 0.6 ? 'unverified' : 'hypothesis'
    return {
      id: uid('ev'),
      source,
      claim: `"${source}" aporta señal sobre: ${intent.intent.slice(0, 80)}.`,
      confidence: Number(confidence.toFixed(2)),
      limitation:
        status === 'verified'
          ? 'Fuente directa, requiere refresco periódico.'
          : status === 'unverified'
            ? 'Necesita contraste con una segunda fuente.'
            : 'Hipótesis: no usar como verdad sin verificación.',
      status,
    }
  })
}

// ── 4. OntologyCheck ──
function checkOntology(mapping: SemanticMappingItem[], domain: Domain): OntologyCheck {
  const classes = Array.from(new Set(mapping.filter((m) => m.matched).map((m) => m.klass)))
  const unmapped = mapping.filter((m) => !m.matched).map((m) => m.token)
  const relations = domain.ontology
    .slice(0, 3)
    .map((o, i) => `${o.klass} —[${['describe', 'afecta', 'genera'][i % 3]}]→ ${domain.ontology[(i + 1) % domain.ontology.length].klass}`)
  const issues: string[] = []
  if (classes.length === 0) issues.push('Ningún término de la intención mapeó a la ontología del dominio.')
  if (unmapped.length > mapping.length / 2)
    issues.push(`Demasiados términos sin mapear (${unmapped.length}).`)
  return { passed: classes.length > 0, classes, relations, issues }
}

// ── 5 + 6. ConstraintSet + ArtifactBrief ──
function buildBrief(intent: IntentContract, domain: Domain): ArtifactBrief {
  const baseSections = SECTION_TEMPLATES[domain.key] ?? ['Resumen', 'Desarrollo', 'Acciones']
  return {
    type: domain.artifactType,
    title: titleCase(intent.intent.slice(0, 70)) || `${domain.name} Artifact`,
    audience: intent.audience,
    sections: baseSections,
    constraints: domain.constraints.map((c) => c.rule),
  }
}

const SECTION_TEMPLATES: Record<string, string[]> = {
  'deep-geo': ['Resumen del evento', 'Geolocalización & contexto', 'Evidencia & confianza', 'Decisión de riesgo', 'Responsables & acciones', 'Mensaje ciudadano'],
  'ebook-revenue': ['Promesa & dolor', 'Tabla de contenidos', 'Capítulo muestra', 'Plantilla aplicable', 'Prompt pack', 'Oferta & CTA'],
  'sci-viz': ['Concepto & audiencia', 'Componentes obligatorios', 'Restricciones visuales', 'Brief de generación', 'Checklist de validación', 'Derivados educativos'],
  'biz-ops': ['Inventario de oportunidades', 'Matriz de prioridad', 'Decisiones', 'Action queue', 'Oferta', 'Seguimiento & learning'],
}

// ── 7. Generation ──
function generateArtifact(
  brief: ArtifactBrief,
  intent: IntentContract,
  domain: Domain,
  evidence: EvidenceItem[],
): Artifact {
  const sections = brief.sections.map((heading) => ({
    heading,
    content: sectionContent(heading, intent, domain, evidence),
  }))
  const body = [
    `# ${brief.title}`,
    `> **Dominio:** ${domain.name} · **Audiencia:** ${brief.audience}`,
    '',
    ...sections.map((s) => `## ${s.heading}\n\n${s.content}`),
  ].join('\n')
  return {
    id: uid('art'),
    type: brief.type,
    title: brief.title,
    body,
    sections,
  }
}

function sectionContent(
  heading: string,
  intent: IntentContract,
  domain: Domain,
  evidence: EvidenceItem[],
): string {
  const h = heading.toLowerCase()
  const topEvidence = evidence[0]?.source ?? domain.inputs[0]
  if (h.includes('oferta') || h.includes('cta')) {
    return [
      '**Oferta básica → Pro → Premium**',
      '- **Básica:** acceso al artefacto + plantilla. CTA: *“Descárgalo ahora”*.',
      '- **Pro:** + prompt pack + sesión de implementación.',
      '- **Premium:** + sistema mensual y soporte.',
      '',
      `CTA dominante orientado a: ${intent.intent}.`,
    ].join('\n')
  }
  if (h.includes('evidencia') || h.includes('confianza')) {
    return evidence
      .map((e) => `- **${e.source}** — confianza ${(e.confidence * 100).toFixed(0)}% (${e.status}). ${e.limitation}`)
      .join('\n')
  }
  if (h.includes('acci') || h.includes('responsable') || h.includes('queue')) {
    return [
      'Acciones priorizadas con owner y estado (ver Action Queue):',
      '1. Asignar responsable y fecha.',
      '2. Ejecutar y registrar resultado.',
      '3. Capturar learning al cerrar.',
    ].join('\n')
  }
  if (h.includes('component') || h.includes('restricc') || h.includes('checklist')) {
    return domain.constraints.map((c) => `- [ ] ${c.rule}`).join('\n')
  }
  if (h.includes('priorid') || h.includes('matriz') || h.includes('inventario')) {
    return [
      '| Oportunidad | Impacto | Esfuerzo | Prioridad |',
      '| --- | --- | --- | --- |',
      `| ${intent.intent.slice(0, 40)} | Alto | Medio | **P1** |`,
      `| Derivado inmediato | Medio | Bajo | P2 |`,
    ].join('\n')
  }
  if (h.includes('promesa') || h.includes('dolor') || h.includes('resumen')) {
    return `**Promesa:** ${intent.goal}\n\n**Dolor que ataca:** ${domain.pain}\n\n` +
      `Anclado en *${topEvidence}*, este ${domain.artifactType} traduce "${intent.intent}" en un resultado concreto y medible.`
  }
  if (h.includes('tabla de contenido') || h.includes('outline') || h.includes('toc')) {
    return domain.outputs.slice(0, 6).map((o, i) => `${i + 1}. ${titleCase(o)}`).join('\n')
  }
  if (h.includes('cap') || h.includes('muestra') || h.includes('desarrollo') || h.includes('manuscrito')) {
    return `Fragmento de muestra desarrollando "${intent.intent}". ` +
      `Cada afirmación se apoya en evidencia (${topEvidence}) y termina en un paso accionable para ${intent.audience}.`
  }
  if (h.includes('plantilla') || h.includes('template')) {
    return '```\n' +
      `[Contexto] ${domain.name}\n[Objetivo] ${intent.goal}\n[Entrada] ${domain.inputs.slice(0, 3).join(', ')}\n[Salida esperada] ${domain.artifactType}\n` +
      '```\nRellena los campos y reutiliza la plantilla en cada nuevo caso.'
  }
  if (h.includes('prompt')) {
    return '```\n' +
      `Actúa como generador PraxioGraph para ${domain.name}.\n` +
      `Intención: ${intent.intent}\nRestricciones: ${domain.constraints.map((c) => c.rule).join(' | ')}\n` +
      `Entrega un ${domain.artifactType} con evidencia, validación y descendencia.\n` +
      '```'
  }
  if (h.includes('geolocal') || h.includes('contexto') || h.includes('geo')) {
    return `Ubicación y contexto del evento asociado a "${intent.intent}". ` +
      `Fuentes: ${domain.inputs.slice(0, 3).join(', ')}. Requiere capa GIS y verificación en terreno.`
  }
  if (h.includes('decisi') || h.includes('riesgo')) {
    return `**Decisión propuesta** sobre "${intent.intent}":\n` +
      `- Nivel de riesgo estimado a partir de la evidencia disponible.\n` +
      `- Umbral que dispara acción y responsable asignado.\n` +
      `- Requiere Policy Gate antes de comunicar externamente.`
  }
  if (h.includes('mensaje') || h.includes('ciudadan')) {
    return `> Mensaje propuesto para ${intent.audience}: comunicación clara sobre "${intent.intent}". ` +
      `⚠ Sujeto a revisión humana antes de publicar (Policy Gate).`
  }
  if (h.includes('seguimiento') || h.includes('follow') || h.includes('feedback')) {
    return `Bucle de seguimiento: capturar respuesta, medir *${METRICS[domain.key] ?? 'la métrica clave'}* y alimentar el Learning Loop para la siguiente iteración.`
  }
  if (h.includes('audiencia') || h.includes('concepto')) {
    return `**Concepto:** ${intent.intent}\n\n**Audiencia:** ${intent.audience}. ` +
      `El registro y la complejidad se ajustan a este público, según la ontología del dominio.`
  }
  if (h.includes('derivado') || h.includes('descend')) {
    return domain.descendants.immediate.concat(domain.descendants.commercial).map((d) => `- ${d}`).join('\n')
  }
  // default narrative section
  return `Sección generada a partir de la intención **“${intent.intent}”**, apoyada en *${topEvidence}*. ` +
    `Mantiene la gramática PraxioGraph: cada afirmación debe ser trazable a evidencia y conectar con una acción o aprendizaje.`
}

// ── 8 + 9. Validation + RevisionPatch ──
function buildRevisionPatch(validation: ReturnType<typeof runValidation>): string[] {
  const failed = validation.filter((v) => !v.passed)
  if (failed.length === 0) return ['Sin revisiones: el artefacto pasó toda la validación en el primer intento.']
  return failed.map((f) => `Revisar: ${f.label} — ${f.detail}`)
}

// ── 11. ActionQueue ──
function buildActions(intent: IntentContract, domain: Domain): ActionItem[] {
  const owners = ['Owner: Estrategia', 'Owner: Producto', 'Owner: Operaciones']
  const sensitiveHit = detectSensitiveIntent(intent, domain)
  return domain.outputs.slice(0, 4).map((out, i) => {
    // Sólo el output ligado a la intención sensible exige revisión humana.
    const requiresHumanReview = Boolean(
      sensitiveHit &&
        (out.toLowerCase().includes(sensitiveHit.toLowerCase().split(' ').pop() ?? '·') ||
          i === 0),
    )
    return {
      id: uid('act'),
      title: `Producir / activar: ${out}`,
      owner: owners[i % owners.length],
      status: i === 0 ? 'doing' : 'todo',
      priority: i === 0 ? 'high' : i === 1 ? 'med' : 'low',
      requiresHumanReview,
    }
  })
}

// ── 12. LearningRecord ──
function buildLearning(domain: Domain, validation: ReturnType<typeof runValidation>): LearningRecord {
  const failed = validation.filter((v) => !v.passed)
  return {
    worked: [
      `El pipeline madre produjo un ${domain.artifactType} completo con evidencia y descendencia.`,
      'La ontología del dominio ancló los términos de la intención.',
    ],
    failed: failed.length
      ? failed.map((f) => f.label)
      : ['Sin fallos detectados en esta ejecución.'],
    ruleUpdate:
      failed.length > 0
        ? `Reforzar la constraint relacionada a: ${failed[0].label}.`
        : 'Mantener las constraints actuales; monitorear drift conceptual.',
    metric: METRICS[domain.key] ?? 'Tasa de artefactos que generan una acción cerrada.',
  }
}

const METRICS: Record<string, string> = {
  'deep-geo': 'Tiempo desde reporte hasta acción con responsable.',
  'ebook-revenue': 'Conversión landing → oferta y revenue por lanzamiento.',
  'sci-viz': '% de imágenes que pasan validación científica al primer intento.',
  'biz-ops': 'Oportunidades priorizadas que cierran en venta.',
}

// ── Orquestación completa ──
export function runPipeline(opts: RunOptions): ExecutionRecord {
  const domain = getDomain(opts.domainKey)

  const intentContract = buildIntent(opts, domain)
  const semanticMapping = mapSemantics(intentContract, domain)
  const evidence = buildEvidence(intentContract, domain)
  const ontologyCheck = checkOntology(semanticMapping, domain)
  const brief = buildBrief(intentContract, domain)
  const artifact = generateArtifact(brief, intentContract, domain, evidence)
  const validation = runValidation({
    domain,
    brief,
    artifact,
    evidence,
    intentKeywords: intentContract.keywords,
  })
  const revisionPatch = buildRevisionPatch(validation)
  const actions = buildActions(intentContract, domain)
  const learning = buildLearning(domain, validation)
  const descendants = buildLineage(domain)

  const policy = evaluatePolicy({
    domain,
    intent: intentContract,
    evidence,
    validation,
    actions,
    descendants,
    hasArtifact: artifact.sections.length > 0,
  })

  return {
    id: uid('exec'),
    domain: domain.key,
    domainName: domain.name,
    status: policy.status,
    createdAt: new Date().toISOString(),
    intentContract,
    semanticMapping,
    evidence,
    ontologyCheck,
    constraints: domain.constraints.map((c) => c.rule),
    brief,
    artifact,
    validation,
    revisionPatch,
    actions,
    learning,
    descendants,
    policy,
  }
}

// ── helpers ──
function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase())
}
