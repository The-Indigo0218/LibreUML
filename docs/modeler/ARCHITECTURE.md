# LibreUML Modeler — Architecture Reference

**Status:** Active  
**Version:** post-v1 (Fases 1 y 2 completadas)  
**Last Updated:** 2026-05-18  

---

## Tabla de contenidos

1. [Stack y estructura general](#1-stack-y-estructura-general)
2. [Los tres stores](#2-los-tres-stores)
3. [Flujo de datos — del tab al canvas](#3-flujo-de-datos--del-tab-al-canvas)
4. [Canvas router](#4-canvas-router)
5. [Modelo semántico — IR Types](#5-modelo-semántico--ir-types)
6. [Standalone model — localModel por archivo](#6-standalone-model--localmodel-por-archivo)
7. [Limitaciones conocidas](#7-limitaciones-conocidas)

---

## 1. Stack y estructura general

### Runtime Stack

| Capa | Tecnología | Notas |
|---|---|---|
| UI | React 18 + TypeScript | Vite como bundler |
| Canvas | Konva + react-konva | Reemplazó React Flow en v1.5 |
| Estado | Zustand | `immer` en model/vfs, sin immer en workspace |
| Estilos | Tailwind CSS |  |
| Tests | Vitest | 373 tests, 23 archivos |
| i18n | react-i18next | `es.json` / `en.json` |
| Monorepo | Turborepo |  |

### Árbol de componentes principal

```
WelcomeScreen                     ← cuando no hay proyecto abierto
DiagramEditor
└── EditorLogic
    ├── AppMenubar                 ← título del proyecto, controles de panel
    ├── ActivityBar                ← switcher de tabs
    ├── PrimarySideBar             ← panel izquierdo (explorador, estructura)
    ├── KonvaCanvas                ← canvas principal
    ├── RightSidebar               ← inspector de elementos
    ├── BottomTerminal             ← preview de código
    ├── StatusBar
    └── [Modales globales]         ← ExportModal, SingleClassGeneratorModal, etc.
```

Los modales viven en `EditorLogic`, no dentro del canvas — así funcionan aunque no haya un tab activo.

---

## 2. Los tres stores

### `useVFSStore`
Árbol de archivos y carpetas del proyecto activo (`LibreUMLProject`). Cada `VFSFile` contiene:

- `content: DiagramView` — posiciones visuales (x, y de cada nodo en el canvas)
- `localModel?: SemanticModel` — modelo semántico aislado, solo para archivos `standalone`
- `diagramType` — qué tipo de diagrama es este archivo

**Regla:** todo lo visual vive aquí.

### `useModelStore`
El `SemanticModel` compartido del proyecto: clases, interfaces, enums, relaciones, actores, casos de uso. Es el "repositorio" del proyecto, equivalente al `.eap` de Enterprise Architect.

**Regla:** todo lo semántico que se comparte entre diagramas vive aquí.

**Limitación actual:** persiste globalmente en `localStorage` separado del VFS. Si el usuario cambia de proyecto sin cerrar correctamente el anterior, el modelo viejo puede contaminar el nuevo. Esto está mitigado con un check `model.id !== project.domainModelId` en `useVFSCanvasController`. La solución definitiva es mover el modelo dentro de `LibreUMLProject` en VFS (Fase 4 del roadmap).

### `useWorkspaceStore`
Reducido en Fase 1. Solo maneja estado de sesión del editor:
- `openTabs: string[]` — archivos VFS abiertos como tabs
- `activeTabId: string | null` — tab activo
- `connectionModes: Record<string, string>` — modo de conexión por tab

**Persistence keys:**

| Store | Key en localStorage | Versión |
|---|---|---|
| `useModelStore` | `libreuml-model-storage` | 1 |
| `useVFSStore` | `libreuml-vfs-storage` | 1 |
| `useWorkspaceStore` | `libreuml-workspace-storage` | 2 |

---

## 3. Flujo de datos — del tab al canvas

```
useWorkspaceStore.activeTabId
        ↓
useVFSStore.project.nodes[activeTabId]  →  VFSFile
        ↓
vfsFile.content  →  DiagramView { nodes: ViewNode[], edges: ViewEdge[] }
        ↓
useVFSCanvasController  →  routeNodes(vfsFile.diagramType)
        ↓
controllers/classDiagramNodes.ts  (o el tipo que corresponda)
        ↓
resolveSemanticElement(model, viewNode.elementId)
        ↓
useModelStore.model  (o vfsFile.localModel si standalone === true)
        ↓
makeReactFlowNode(viewNode, element, ...)
        ↓
KonvaCanvas.nodes
```

**Separación clave:**
- `ViewNode` sabe *dónde* está el elemento en el canvas (x, y)
- `SemanticModel` sabe *qué* es el elemento (nombre, atributos, tipo, relaciones)

---

## 4. Canvas router

`useVFSCanvasController.ts` es el núcleo del canvas. Después de Fase 2 tiene tres responsabilidades:

1. **Infraestructura:** resolver el VFS file activo, inicializar el modelo, manejar el lifecycle del tab
2. **Routing:** elegir qué builder usar según `vfsFile.diagramType`
3. **Edges:** construir aristas (genérico — todos los tipos usan `model.relations`)

```ts
function routeNodes(vfsFile: VFSFile, ctx: NodeBuilderContext): VFSReactFlowNode[] {
  switch (vfsFile.diagramType) {
    case 'CLASS_DIAGRAM':         return buildClassDiagramNodes(ctx);
    case 'USE_CASE_DIAGRAM':      return buildUseCaseDiagramNodes(ctx);
    case 'DOMAIN_MODEL_DIAGRAM':  return buildDomainModelNodes(ctx);
    default:                      return buildClassDiagramNodes(ctx);
  }
}
```

**Agregar un tipo nuevo:** crear `controllers/[tipo]DiagramNodes.ts` con `build[Tipo]DiagramNodes()` y añadir un `case` en `routeNodes()`. Sin tocar código existente.

### Estructura de controllers

```
src/features/diagram/hooks/
├── useVFSCanvasController.ts       ← router + infraestructura (~290 líneas)
└── controllers/
    ├── sharedNodeBuilders.ts       ← resolveSemanticElement, getAbsolutePosition, noteNode
    ├── classDiagramNodes.ts        ← CLASS_DIAGRAM, PACKAGE_DIAGRAM, OBJECT_DIAGRAM
    ├── useCaseDiagramNodes.ts      ← USE_CASE_DIAGRAM
    └── domainModelNodes.ts         ← DOMAIN_MODEL_DIAGRAM
```

---

## 5. Modelo semántico — IR Types

Definido en `src/core/domain/vfs/vfs.types.ts`. Es la capa canónica de dominio.

### SemanticModel

```ts
interface SemanticModel {
  id: string;
  name: string;
  version: string;

  packages:          Record<string, IRPackage>;
  classes:           Record<string, IRClass>;
  interfaces:        Record<string, IRInterface>;
  enums:             Record<string, IREnum>;
  attributes:        Record<string, IRAttribute>;
  operations:        Record<string, IROperation>;
  actors:            Record<string, IRActor>;
  useCases:          Record<string, IRUseCase>;
  systemBoundaries?: Record<string, IRSystemBoundary>;
  ucModules?:        Record<string, IRUCModule>;
  domainEntities?:   Record<string, IRDomainEntity>;
  components:        Record<string, IRComponent>;
  relations:         Record<string, IRRelation>;

  createdAt: number;
  updatedAt: number;
}
```

### Tipos principales de elementos

```ts
interface IRClass {
  id: string; kind: 'CLASS';
  name: string; isAbstract?: boolean; packageName?: string;
  attributeIds: string[];   // referencias a model.attributes
  operationIds: string[];   // referencias a model.operations
}

interface IRRelation {
  id: string;
  kind: RelationKind;       // 'INHERITANCE' | 'ASSOCIATION' | 'COMPOSITION' | ...
  sourceId: string;         // ID del elemento IR origen
  targetId: string;         // ID del elemento IR destino
  sourceMultiplicity?: string;
  targetMultiplicity?: string;
  label?: string;
}
```

### View Layer — DiagramView

Capa de presentación. Almacenada en `VFSFile.content`. Registra *dónde* aparecen los elementos en el canvas, no *qué* son.

```ts
interface ViewNode {
  id: string;
  elementId: string;   // referencia al ID del elemento IR
  x: number; y: number;
  width?: number; height?: number;
  parentPackageId?: string | null;
}

interface ViewEdge {
  id: string;
  relationId: string;  // referencia al ID de IRRelation
  waypoints: { x: number; y: number }[];
  sourceHandle?: string; targetHandle?: string;
}

interface DiagramView {
  diagramId: string;
  nodes: ViewNode[];
  edges: ViewEdge[];
}
```

---

## 6. Standalone model — localModel por archivo

Algunos tipos de diagrama usan un `SemanticModel` propio por archivo en vez del modelo global. Se marca con `VFSFile.standalone = true`.

**Qué tipos usan standalone:**

| Tipo | Modelo | Motivo |
|---|---|---|
| Class Diagram | Global (`useModelStore`) | Cross-diagram sharing de clases, como EA |
| Component Diagram | Global | Los componentes se reusan entre vistas |
| Use Case Diagram | `localModel` (standalone) | Actores y casos de uso son locales al diagrama |
| Domain Model | `localModel` (standalone) | Entidades locales al modelo de dominio |
| Sequence Diagram | `localModel` (standalone) | Lifelines específicas de la interacción |
| Deployment Diagram | `localModel` (standalone) | Nodos específicos del despliegue |

**Cross-diagram reuse:** aunque un diagrama standalone tenga su propio modelo, puede referenciar elementos del modelo global. Por ejemplo, arrastrar una clase al canvas de Use Case crea un Actor que apunta a esa clase — el nombre se hereda automáticamente. Mismo elemento semántico, representación visual distinta.

### standaloneModelOps

`src/store/standaloneModelOps.ts` provee la misma API CRUD que `useModelStore`, enrutada al `localModel` del archivo:

```ts
const ops = standaloneModelOps(fileId);
// Estos métodos escriben al localModel del archivo, sin tocar useModelStore
ops.createClass({ name: 'Order', attributeIds: [], operationIds: [] });
ops.createRelation({ kind: 'ASSOCIATION', sourceId: '...', targetId: '...' });
```

### useActiveSemanticModelOps

`src/store/useActiveSemanticModelOps.ts` abstrae la bifurcación global/standalone. Los componentes la usan para no tener que gestionar el routing manualmente.

```ts
const { getOps, getModel } = useActiveSemanticModelOps();
// getOps() devuelve standaloneModelOps o useModelStore según el tab activo
// getModel() devuelve localModel o model global según el tab activo
```

---

## 7. Limitaciones conocidas

### Scope del SemanticModel (Fase 4 del roadmap)
El modelo persiste globalmente en `localStorage` separado del VFS. La solución es moverlo dentro de `LibreUMLProject` — que el modelo viaje con el proyecto, igual que en EA. Ver [plan de Fase 4](../../documentos/LibreUML-Modeler/plan-fase4-scope-semantic-model.md).

### Tests cloud en skip
20 tests en `describe.skip` en `cloudSync.service.test.ts` y `autoSave.test.ts`. Prueban la API `diagApi` vieja. Pendientes de reescritura contra `cloudAdapter`.

### SemanticModel con colecciones vacías
`SemanticModel` ya tiene las colecciones para todos los tipos de diagrama futuros (activityNodes, components, artifacts, etc.) aunque la mayoría estén vacías. Al implementar cada tipo en Fase 3 hay que validar que las colecciones existentes sean suficientes o extenderlas.
