# PraxioGraph Artifact Workbench

> Sistema operativo de realidad accionable. De intención a artefacto, acción, aprendizaje y descendencia.

PraxioGraph Artifact Workbench es una **sala de parto de artefactos**: una interfaz y
un motor determinístico que convierten una intención (idea, dato, señal o evento) en un
**artefacto accionable** con evidencia, validación, acciones, aprendizaje y descendencia.

No termina en la respuesta. Termina en artefacto, acción, aprendizaje y descendencia.

## Cómo correrlo

```bash
npm install
npm run client:dev     # abre la app en http://localhost:5173
npm run build:frontend # build de producción en dist/
npm run test:praxio    # smoke test del engine (4 dominios + Policy Gate)
```

El explainer de arquitectura original está servido en `/architecture.html`.

## Qué hace

Elige un **dominio**, escribe una **intención** y ejecuta el pipeline. El engine recorre
el **pipeline madre** de forma determinística:

```
IntentContract → SemanticMapping → EvidenceBundle → OntologyCheck → ConstraintSet
→ ArtifactBrief → Generation → Validation → RevisionPatch → ApprovedArtifact
→ ActionQueue → LearningRecord → ArtifactDescendants
```

Y produce un `ExecutionRecord` con: artefacto central, Evidence Ledger, chequeo de
ontología, checklist de validación, Policy Gate, Action Queue, Learning Loop, árbol de
descendencia y exports (JSON / Markdown / HTML).

### Dominios incluidos

- **Deep Geo** — territorio, municipio, riesgo (ficha territorial).
- **Ebook Revenue** — producto digital, cash rápido (ebook + oferta + landing).
- **Scientific Visualization** — visualización científica educativa (imagen validada).
- **Business Operations** — operación, estrategia, ventas (matriz de decisión).

## Arquitectura del código

```
src/praxiograph/
├── PraxioWorkbench.vue          # layout raíz (header + composer + 3 columnas + dock)
├── usePraxio.ts                 # estado del workbench (ejecución activa, historial, export)
├── components/
│   ├── ExecutionHeader.vue      # marca, tabs de dominio, estado del Policy Gate
│   ├── IntentComposer.vue       # entrada de intención + audiencia + ejecutar
│   ├── PipelineRail.vue         # las 13 etapas del pipeline madre
│   ├── CentralArtifactCanvas.vue# el artefacto central (domina visualmente)
│   ├── RightInspector.vue       # evidencia, ontología, validación, policy gate
│   └── BottomDock.vue           # action queue, learning, descendants, export
└── engine/                      # motor determinístico (sin IA, estado propio)
    ├── types.ts                 # modelo de tipos del grafo accionable
    ├── domains.ts               # domain registry (inputs, ontología, constraints, lineage)
    ├── praxioEngine.ts          # orquesta el pipeline madre completo
    ├── policyEngine.ts          # Policy Gate: permite / human review / bloquea
    ├── validationEngine.ts      # checklist anti-humo + constraints del dominio
    ├── lineageEngine.ts         # descendencia (inmediata/comercial/operativa/learning/system)
    ├── sensitivity.ts           # detección de acciones sensibles (revisión humana)
    └── exportEngine.ts          # export a JSON / Markdown / HTML
```

## Regla anti-humo

Si un output no tiene artefacto central, evidencia, validación, acción, learning y
descendencia, el **Policy Gate lo bloquea**. Acciones sensibles (publicar, lanzar,
enviar, declarar) exigen **revisión humana** antes de pasar. Un output que no activa
nada ni deja aprendizaje es un output muerto.

---

*El engine es determinístico por diseño: la IA puede entrar luego como motor cognitivo,
pero la memoria, la policy y los tests viven en el sistema, no en el modelo.*
