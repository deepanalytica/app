// ============================================================
// PraxioGraph — smoke test del engine determinístico.
// Run: npm run test:praxio
// Verifica el pipeline madre en los 4 dominios + Policy Gate.
// ============================================================

import { runPipeline } from '../src/praxiograph/engine/praxioEngine'
import { DOMAINS } from '../src/praxiograph/engine/domains'
import { toMarkdown, toJSON } from '../src/praxiograph/engine/exportEngine'

let failures = 0
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++
    console.log('  ✗ FAIL:', msg)
  } else {
    console.log('  ✓', msg)
  }
}

for (const d of DOMAINS) {
  console.log(`\n=== ${d.name} ===`)
  const rec = runPipeline({
    domainKey: d.key,
    intent: `Ejemplo de intención para ${d.name} con oferta, acción y componente etiquetado.`,
  })
  assert(rec.artifact.sections.length >= 3, 'artifact has >=3 sections')
  assert(new Set(rec.artifact.sections.map((s) => s.content)).size > 1, 'sections are not all identical')
  assert(rec.evidence.length > 0, 'evidence generated')
  assert(rec.validation.length > 0, 'validation checklist generated')
  assert(rec.actions.length > 0, 'actions generated')
  assert(rec.descendants.length > 0, 'descendants generated')
  assert(['validated', 'human-review', 'blocked'].includes(rec.status), 'valid gate status')
  assert(rec.status === 'validated', 'neutral intent => validated')
  assert(toMarkdown(rec).includes(rec.artifact.title), 'markdown export includes title')
  assert(JSON.parse(toJSON(rec)).id === rec.id, 'json export round-trips')
  // regresión: \b\w rompía acentos ("inundación" → "InundacióN")
  assert(!/\p{Ll}\p{Lu}/u.test(rec.artifact.title), 'title has no mid-word capitals (acentos)')
  assert(!/[^\n]\n## /.test(rec.artifact.body), 'every ## heading is preceded by a blank line')
  console.log(`  status=${rec.status} validation=${rec.validation.filter((v) => v.passed).length}/${rec.validation.length}`)
}

// Policy Gate: acción sensible => human review
const alert = runPipeline({
  domainKey: 'deep-geo',
  intent: 'Publicar alerta ciudadana urgente por inundación en el sector.',
})
assert(alert.status === 'human-review', 'sensitive intent forces human-review')

console.log(failures === 0 ? '\n✅ ALL PASS' : `\n❌ ${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
