# LibreUML Modeler — Hoja de ruta post-v1: limpieza y escalabilidad

> Elaborado al cierre del semestre (2026-04-25).
> Actualizado 2026-05-17 — refleja decisiones arquitectónicas tomadas durante el ciclo de refactor.

---

## Contexto

v1 entrega Class Diagrams + Cloud con una arquitectura que funciona bien para ese scope.
El objetivo de este documento es identificar lo que debe subsanarse **antes de agregar nuevos tipos de diagrama**, para no acumular deuda que después paralice el desarrollo.

**Estado al 2026-05-17:** Fases 1 y 2 completadas y mergeadas a `develop`.

La regla de oro: cada fase se puede mergear de forma independiente. Ninguna fase rompe lo que funciona en producción.

---

## Decisiones arquitectónicas tomadas

### Cross-diagram element sharing — FEATURE, no deuda

Se analizó si eliminar `useModelStore` por completo (Fase 4 original). La decisión es **no hacerlo** por las siguientes razones:

- **EA y StarUML usan exactamente el mismo modelo:** un único `SemanticModel` por proyecto, múltiples diagramas como vistas distintas sobre ese modelo. Un elemento existe UNA sola vez y puede aparecer en N diagramas.
- **Es una feature, no un bug:** la clase `Usuario` definida en un CLASS_DIAGRAM puede ser reutilizada en un USE_CASE_DIAGRAM (p.ej. como actor). Esta capacidad es la que diferencia un modelador UML serio de un editor de cajas y flechas.
- **El problema real no es `useModelStore` sino su scope de persistencia:** el store persiste globalmente en el browser (Zustand persist), lo que genera riesgo de contaminación cross-project. Esto está parcialmente mitigado con el check `model.id !== project.domainModelId` en `useVFSCanvasController`, pero la solución correcta es scopear el modelo al proyecto (ver Fase 4 redefinida).

### Visión de reutilización cross-diagram

Un elemento del `SemanticModel` puede tener representaciones visuales distintas según el tipo de diagrama donde aparece. Ejemplos:

- `IRClass` arrastrado al canvas de USE_CASE_DIAGRAM → crea un `Actor` que referencia el mismo elemento semántico
- `IRClass` arrastrado al canvas de SEQUENCE_DIAGRAM → se convierte en un `Lifeline`
- El mismo elemento en CLASS_DIAGRAM muestra sus atributos y métodos; en USE_CASE_DIAGRAM solo muestra el nombre con estereotipo `<<actor>>`

Esto es posible porque `SemanticModel` es compartido entre todos los diagramas del proyecto. Cada diagram-type controller sabe cómo renderizar el subconjunto de elementos que le corresponde.

---

## Deuda técnica — estado actual

### D-01 — `useProjectStore` ✅ RESUELTA
~~`src/store/project.store.ts`~~ — **Eliminado en Fase 1.** Store antiguo de nodos/edges del dominio. Se eliminó el store, sus tests, el `useAutoSave` legacy que lo consumía y todos los imports residuales.

---

### D-02 — `useWorkspaceStore` ✅ RESUELTA
~~`src/store/workspace.store.ts`~~ — **Reducido en Fase 1.** El workspace store se redujo a su núcleo mínimo: `{ openTabs, activeTabId, connectionModes }` + 5 métodos. Se eliminó toda la interfaz `DiagramFile` del workspace (files, getActiveFile, isDirty, addNodeToFile, etc.).

---

### D-03 — Lógica class-diagram hardcoded en `useVFSCanvasController` ✅ RESUELTA
~~`src/features/diagram/hooks/useVFSCanvasController.ts`~~ — **Extraído en Fase 2.** El controller pasó de 1015 líneas a ~290 como router puro. Los node builders de cada familia de diagrama viven en:
```
src/features/diagram/hooks/controllers/
  sharedNodeBuilders.ts       ← resolveSemanticElement, getAbsolutePosition, makeNoteNode
  classDiagramNodes.ts        ← CLASS_DIAGRAM, PACKAGE_DIAGRAM, OBJECT_DIAGRAM
  useCaseDiagramNodes.ts      ← USE_CASE_DIAGRAM
  domainModelNodes.ts         ← DOMAIN_MODEL_DIAGRAM
```

Agregar un nuevo tipo de diagrama requiere: un archivo nuevo en `controllers/` + un `case` en `routeNodes()`. Sin tocar código existente.

---

### D-04 — `useModelStore` con scope de persistencia global ⚠️ REDEFINIDA
**Archivo:** `src/store/model.store.ts`

El store persiste el `SemanticModel` globalmente en el browser (Zustand persist), independiente del proyecto VFS activo. Esto genera riesgo de contaminación cross-project: si el usuario cambia de proyecto sin limpiar el store, el modelo del proyecto anterior puede "contaminar" el nuevo.

**Mitigación actual:** `useVFSCanvasController` verifica `model.id !== project.domainModelId` y reinicializa si no coinciden. Funciona, pero es un parche.

**Decisión:** `useModelStore` NO debe eliminarse — provee cross-diagram element sharing (feature core del producto). Sí debe **scopearse al proyecto VFS activo** (ver Fase 4 redefinida).

---

### D-05 — `useAutoSave` legacy ✅ RESUELTA
~~`src/hooks/actions/useAutoSave.ts`~~ — **Eliminado en Fase 1.** El hook y su re-export en `src/hooks/useAutosave.ts` fueron borrados. El autosave local está correctamente manejado por `useVFSAutoSave` y el cloud hook.

---

### D-06 — Tests cloud en skip 🔴 PENDIENTE
**Archivos:** `src/features/cloud/__tests__/cloudSync.service.test.ts`, `src/features/cloud/__tests__/autoSave.test.ts`

20 tests en `describe.skip` porque apuntan a la API `diagApi.createDiagram/updateDiagram/getDiagram` que fue reemplazada por el modelo `cloudAdapter` project-centric. Los tests existen pero cubren una superficie eliminada.

**Acción:** Reescribir los 20 tests para que prueben la nueva superficie (`cloudAdapter.createProjectInCloud`, `updateModelInCloud`, etc.).

---

## Fases de ejecución

### Fase 1 — Borrado de legacy ✅ COMPLETADA
**Rama:** `refactor/remove-legacy-stores` → mergeada a `develop` y `main` el 2026-05-17
**Commits:** `b8f5b27` → `85c2031` → `df079de` → `f840454`

**Ejecutado:**
1. ✅ Eliminar `project.store.ts` y `project.store.test.ts`
2. ✅ Eliminar todos los imports de `useProjectStore` (9 consumidores migrados a VFS/IR)
3. ✅ Eliminar `useAutoSave.ts` legacy y re-export `useAutosave.ts`
4. ✅ Reducir `useWorkspaceStore` a núcleo mínimo (version bump a v2 con migración)
5. ✅ Limpiar imports residuales — `AppMenubar`, `ToolPalette`, `ExportModal`, `FileMenu`, `CodeMenu`, `projectIO.service`
6. ✅ Migrar `useSpotlight` y `ProjectGeneratorModal` a VFS/model store
7. ✅ Migrar `javaImport.service` canvas target a VFS
8. ✅ Gutear `useFileLifecycle` (Electron no es objetivo): `importFromWeb` delega a `openLumlFile`

**Criterio de aceptación:** ✅ `tsc -b` y `npm run build` sin errores. 373 tests pasan.

---

### Fase 2 — Canvas router por tipo de diagrama ✅ COMPLETADA
**Rama:** `refactor/canvas-diagram-router` → mergeada a `develop` el 2026-05-17
**Commits:** `028ef4d` → `27316f8`

**Ejecutado:**
1. ✅ Extraer lógica class-diagram de `useVFSCanvasController` a `controllers/classDiagramNodes.ts`
2. ✅ Extraer builders de use case a `controllers/useCaseDiagramNodes.ts`
3. ✅ Extraer builders de domain model a `controllers/domainModelNodes.ts`
4. ✅ Extraer utilidades compartidas a `controllers/sharedNodeBuilders.ts`
5. ✅ Convertir `useVFSCanvasController` en router puro con `routeNodes(vfsFile.diagramType)`
6. ✅ Tests para `resolveSemanticElement`, `getAbsolutePosition` y `generateAndDownloadZipFromModel`

**Estructura resultante:**
```
src/features/diagram/hooks/
  useVFSCanvasController.ts     ← router + infra genérica (~290 líneas)
  controllers/
    sharedNodeBuilders.ts
    classDiagramNodes.ts        ← CLASS_DIAGRAM, PACKAGE_DIAGRAM, OBJECT_DIAGRAM
    useCaseDiagramNodes.ts      ← USE_CASE_DIAGRAM
    domainModelNodes.ts         ← DOMAIN_MODEL_DIAGRAM
    [nuevos tipos aquí]         ← sin tocar código existente
```

**Criterio de aceptación:** ✅ Class/UseCase/DomainModel funcionan idéntico. Router listo para nuevos tipos.

---

### Fase 3 — Nuevos tipos de diagrama 🔵 PENDIENTE (baja prioridad inmediata)
**Dependencias:** Fase 2 completada ✅
**Prerequisito:** Actualizar documentación de especificación por tipo antes de implementar.

**Principio de modelo:**
- **Class Diagrams:** `useModelStore` global — cross-project element sharing, alineado con EA/StarUML.
- **Todos los demás tipos:** `localModel` en el VFSFile — cada archivo es su propio universo semántico. No tiene sentido compartir lifelines o estados entre archivos.
- **Cross-diagram reuse:** Ver sección de visión. Un `IRClass` del modelo global puede ser referenciado desde un Use Case o Sequence diagram con representación visual distinta.

**Por cada nuevo tipo de diagrama se necesita:**
1. Especificación semántica (qué elementos, qué relaciones, qué propiedades)
2. Definir el `localModel` del tipo (si aplica) — ej. `SequenceModel { lifelines, messages, fragments }`
3. Crear el controller en `controllers/[tipo]DiagramNodes.ts`
4. Crear los shapes Konva específicos
5. Crear el validador y registrarlo en `DiagramRegistry`
6. Agregar traducciones
7. Agregar el `case` en `routeNodes()` del controller

**Ramas por tipo:**
- `feat/sequence-diagram`
- `feat/state-machine-diagram`
- `feat/activity-diagram`
- `feat/component-diagram`

---

### Fase 4 — Scopear `SemanticModel` al proyecto VFS 🔴 PENDIENTE (alta prioridad)
**Rama:** `refactor/scope-semantic-model`
**Dependencias:** Fase 1 completada ✅

**Objetivo redefinido:** Mover el `SemanticModel` del scope global del browser (Zustand persist independiente) al interior del `LibreUMLProject` en VFSStore. El cross-diagram sharing se mantiene — lo que cambia es *dónde* vive el modelo: en el proyecto, no en el browser.

**Arquitectura objetivo:**
```
LibreUMLProject (en VFSStore)
├── id, projectName, version, ...
├── nodes: Record<string, VFSFolder | VFSFile>
└── semanticModel: SemanticModel   ← NUEVO: el modelo vive aquí
```

`useModelStore` queda como una "vista reactiva" del `semanticModel` del proyecto activo — se carga cuando el proyecto abre, se descarta cuando cierra. Sin persistencia Zustand independiente.

**Beneficios:**
- Elimina la contaminación cross-project de raíz (no hay parche `model.id !== domainModelId` necesario)
- El modelo viaja con el proyecto — export/import/cloud sync son más simples y coherentes
- Snapshot completo del proyecto incluye modelo + vistas en una sola estructura
- Alineado con el modelo de EA (el `.eap` contiene TODO — modelo + diagramas)

**Tareas:**
1. Agregar `semanticModel?: SemanticModel` a `LibreUMLProject` en `vfs.types.ts`
2. Migrar `projectIO.service` para cargar/guardar el modelo desde `project.semanticModel` en vez de `useModelStore` persist
3. Migrar `cloudSync.service` para incluir `semanticModel` en el snapshot del proyecto
4. Convertir `useModelStore` en store no-persistido, inicializado desde `project.semanticModel` al cargar
5. Al cerrar proyecto: `useModelStore.resetModel()`
6. Migración de datos en localStorage para proyectos existentes

**Criterio de aceptación:** Cambiar de proyecto limpia el modelo sin ningún check adicional. El snapshot de cloud incluye el modelo completo. `tsc -b` sin errores.

---

## Resumen de ramas

| Fase | Rama | Base | Estado |
|------|------|------|--------|
| 1 — Borrado legacy | `refactor/remove-legacy-stores` | `main` post-v1 | ✅ Mergeada |
| 2 — Canvas router | `refactor/canvas-diagram-router` | Fase 1 | ✅ Mergeada |
| 4 — Scope semantic model | `refactor/scope-semantic-model` | `develop` actual | 🔴 Siguiente |
| 6 — Cloud tests rewrite | rama propia | `develop` actual | 🔴 Pendiente |
| 3 — Sequence Diagram | `feat/sequence-diagram` | Fase 2 | 🔵 Bajo prioridad |
| 3 — State Machine | `feat/state-machine-diagram` | Fase 2 | 🔵 Bajo prioridad |
| 3 — Activity Diagram | `feat/activity-diagram` | Fase 2 | 🔵 Bajo prioridad |
| 3 — Component Diagram | `feat/component-diagram` | Fase 2 | 🔵 Bajo prioridad |

---

## Lo que NO hay que tocar

Las siguientes partes están bien diseñadas y escalan sin cambios:

- `src/core/undo/` — agnóstico al tipo de diagrama
- `src/core/domain/vfs/` — el VFS ya soporta todos los `DiagramType`
- `src/core/validation/` — el registry acepta nuevos validadores sin modificación
- `src/store/sync.store.ts` — funciona con cualquier proyecto VFS
- `src/features/diagram/hooks/controllers/` — arquitectura de router lista para extensión
- `src/store/standaloneModelOps.ts` — patrón correcto para modelos per-file
- `src/store/useActiveSemanticModelOps.ts` — abstracción útil para Fase 4

## Lo que hay que tocar con cuidado

- `src/store/model.store.ts` — central en Fase 4; no modificar hasta tener plan completo
- `src/features/cloud/` — cloudSync.service usa el modelo global; impactado por Fase 4
- `src/services/projectIO.service.ts` — carga/guarda modelo separado del VFS; impactado por Fase 4
