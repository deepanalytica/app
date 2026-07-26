// ============================================================
// Domain Registry — la gramática PraxioGraph es común, pero cada
// dominio cambia inputs, artefactos, reglas, validaciones y
// descendencia. Datos derivados del explainer de arquitectura.
// ============================================================

import type { Domain } from './types'

export const DOMAINS: Domain[] = [
  {
    key: 'deep-geo',
    name: 'Deep Geo',
    tag: 'Territorio · municipio · riesgo',
    accent: '#0e7490',
    pain: 'Eventos territoriales dispersos sin evidencia, responsables, acción ni aprendizaje.',
    inputs: ['reporte ciudadano', 'foto', 'ubicación', 'clima', 'mapa', 'capa GIS', 'documento'],
    outputs: ['ficha territorial', 'brief ejecutivo', 'mapa narrativo', 'mensaje ciudadano', 'action queue', 'learning post-evento'],
    pipeline: ['Raw Report', 'Metadata', 'Semantic Mapping', 'Evidence', 'Geo Context', 'Risk Decision', 'Responsibility', 'Artifact', 'Action', 'Learning'],
    artifactType: 'ficha',
    ontology: [
      { term: 'evento', klass: 'Event', synonyms: ['incidente', 'reporte', 'emergencia'] },
      { term: 'territorio', klass: 'Place', synonyms: ['municipio', 'zona', 'sector', 'barrio'] },
      { term: 'riesgo', klass: 'Risk', synonyms: ['amenaza', 'peligro', 'vulnerabilidad'] },
      { term: 'responsable', klass: 'Actor', synonyms: ['autoridad', 'owner', 'entidad'] },
    ],
    constraints: [
      { id: 'geo-ev', rule: 'Todo riesgo declarado requiere al menos una evidencia verificada.', severity: 'block' },
      { id: 'geo-resp', rule: 'Toda acción crítica debe tener responsable asignado.', severity: 'review' },
      { id: 'geo-loc', rule: 'La ficha debe geolocalizar el evento.', severity: 'warn' },
    ],
    descendants: {
      immediate: ['ficha territorial', 'mapa narrativo'],
      commercial: ['brief recurrente para municipios'],
      operational: ['protocolo preventivo', 'módulo de monitoreo'],
      learning: ['learning post-evento', 'patrón de riesgo recurrente'],
      system: ['Municipal Decision OS'],
    },
    sensitive: ['publicar alerta', 'mensaje ciudadano', 'declarar riesgo'],
  },
  {
    key: 'ebook-revenue',
    name: 'Ebook Revenue',
    tag: 'Cash rápido · producto digital',
    accent: '#d97706',
    pain: 'Conocimiento acumulado sin producto, oferta, landing, campaña, follow-up ni feedback.',
    inputs: ['experiencia', 'conversaciones WhatsApp', 'dolores', 'objeciones', 'casos', 'ideas'],
    outputs: ['ebook', 'plantilla', 'prompt pack', 'landing', 'posts', 'lead tracker', 'oferta básica/pro/premium'],
    pipeline: ['Knowledge Asset', 'Pain', 'Evidence', 'Product Brief', 'Outline', 'Manuscript', 'Template', 'Prompt Pack', 'Offer', 'Landing', 'Launch', 'Feedback'],
    artifactType: 'ebook',
    ontology: [
      { term: 'conocimiento', klass: 'Asset', synonyms: ['experiencia', 'expertise', 'know-how'] },
      { term: 'dolor', klass: 'Pain', synonyms: ['problema', 'objeción', 'fricción'] },
      { term: 'oferta', klass: 'Offer', synonyms: ['producto', 'paquete', 'plan'] },
      { term: 'lead', klass: 'Lead', synonyms: ['cliente', 'prospecto', 'contacto'] },
    ],
    constraints: [
      { id: 'eb-offer', rule: 'Todo ebook debe terminar en una oferta accionable.', severity: 'block' },
      { id: 'eb-pain', rule: 'El contenido debe atacar un dolor explícito y validado.', severity: 'review' },
      { id: 'eb-cta', rule: 'La landing debe tener un único CTA dominante.', severity: 'warn' },
    ],
    descendants: {
      immediate: ['ebook', 'plantilla', 'prompt pack', 'landing'],
      commercial: ['oferta básica/pro/premium', 'consultoría express', 'implementación premium'],
      operational: ['lead tracker', 'secuencia de follow-up'],
      learning: ['feedback de lanzamiento', 'objeciones más frecuentes'],
      system: ['Sales Recovery OS', 'sistema mensual'],
    },
    sensitive: ['lanzar oferta', 'publicar landing', 'campaña de outbound'],
  },
  {
    key: 'sci-viz',
    name: 'Scientific Visualization',
    tag: 'Educación · visualización científica',
    accent: '#6d28d9',
    pain: 'Imágenes bonitas pero sin control de componentes, restricciones, validación ni derivados educativos.',
    inputs: ['concepto científico', 'componentes obligatorios', 'restricciones', 'checklist', 'audiencia'],
    outputs: ['imagen científica', 'versión etiquetada', 'lámina educativa', 'ficha didáctica', 'prompt pack', 'atlas visual'],
    pipeline: ['Intent', 'Semantic Mapping', 'Ontology Check', 'Constraints', 'Visual Brief', 'Generation', 'Scientific Validation', 'Revision', 'Final Artifact'],
    artifactType: 'imagen',
    ontology: [
      { term: 'concepto', klass: 'Concept', synonyms: ['fenómeno', 'estructura', 'proceso'] },
      { term: 'componente', klass: 'Component', synonyms: ['parte', 'elemento', 'estructura'] },
      { term: 'restricción', klass: 'Constraint', synonyms: ['regla', 'requisito', 'límite'] },
      { term: 'audiencia', klass: 'Audience', synonyms: ['público', 'nivel', 'lector'] },
    ],
    constraints: [
      { id: 'sv-comp', rule: 'Todos los componentes obligatorios deben estar presentes y etiquetados.', severity: 'block' },
      { id: 'sv-valid', rule: 'La imagen debe pasar validación científica antes de aprobarse.', severity: 'block' },
      { id: 'sv-aud', rule: 'El registro visual debe ajustarse a la audiencia declarada.', severity: 'review' },
    ],
    descendants: {
      immediate: ['imagen científica', 'versión etiquetada', 'ficha didáctica'],
      commercial: ['biblioteca de imágenes', 'curso visual'],
      operational: ['atlas celular', 'plantilla de prompts visuales'],
      learning: ['checklist de validación refinado'],
      system: ['Scientific Visual Generator'],
    },
    sensitive: ['publicar lámina', 'declarar validación científica'],
  },
  {
    key: 'biz-ops',
    name: 'Business Operations',
    tag: 'Operación · estrategia · ventas',
    accent: '#245c7a',
    pain: 'Demasiadas ideas y oportunidades sin ciclo cerrado hacia venta, entrega, aprendizaje y nuevos productos.',
    inputs: ['ideas', 'leads', 'clientes', 'propuestas', 'bloqueos', 'ventas', 'feedback'],
    outputs: ['brief diario', 'product queue', 'lead follow-up', 'oferta', 'campaña', 'matriz de decisión', 'learning report'],
    pipeline: ['Inventory', 'Opportunity', 'Priority', 'Brief', 'Action Queue', 'Offer', 'Follow-up', 'Feedback', 'Learning'],
    artifactType: 'matriz',
    ontology: [
      { term: 'oportunidad', klass: 'Opportunity', synonyms: ['idea', 'lead', 'opción'] },
      { term: 'prioridad', klass: 'Priority', synonyms: ['ranking', 'urgencia', 'peso'] },
      { term: 'decisión', klass: 'Decision', synonyms: ['elección', 'gate', 'corte'] },
      { term: 'venta', klass: 'Sale', synonyms: ['cierre', 'deal', 'conversión'] },
    ],
    constraints: [
      { id: 'bo-cycle', rule: 'Toda oportunidad priorizada debe convertirse en acción con owner.', severity: 'block' },
      { id: 'bo-feedback', rule: 'Cada ciclo cerrado debe dejar un learning record.', severity: 'review' },
      { id: 'bo-offer', rule: 'Las ofertas deben tener precio y alcance definidos.', severity: 'warn' },
    ],
    descendants: {
      immediate: ['brief diario', 'matriz de decisión'],
      commercial: ['oferta', 'servicio empaquetado', 'consultoría', 'producto digital'],
      operational: ['product queue', 'lead follow-up'],
      learning: ['learning report', 'tasa de conversión por canal'],
      system: ['Business PraxioGraph OS'],
    },
    sensitive: ['enviar campaña', 'lanzar oferta', 'contactar lead'],
  },
]

export function getDomain(key: string): Domain {
  const d = DOMAINS.find((x) => x.key === key)
  if (!d) throw new Error(`Unknown domain: ${key}`)
  return d
}
