# LibreUML v0.7.0 — Architecture Reference

**Status:** Active
**Branch:** `hotfix/v0.6.4-usability-patches` (targets main as v0.7.0)
**Last Updated:** 2026-03-26

---

## Table of Contents

1. [High-Level Architecture](#1-high-level-architecture)
2. [Domain Models (IR Types)](#2-domain-models-ir-types)
3. [State Forking — The Standalone Sandbox](#3-state-forking--the-standalone-sandbox)
4. [Known Limitations & Roadmap](#4-known-limitations--roadmap)

---

## 1. High-Level Architecture

### Runtime Stack

LibreUML is a desktop-first UML editor built on the following stack:

| Layer | Technology |
|---|---|
| UI Framework | React 18 + TypeScript (Vite) |
| Canvas Rendering | React Flow (DOM-based, virtualized) |
| Desktop Shell | Electron (optional — web fallback supported) |
| State Management | Zustand with `persist` and `immer` middleware |
| Internationalization | react-i18next (`en.json` / `es.json`) |
| Styling | Tailwind CSS v3 |
| Storage Adapter | Pluggable (`storageAdapter`) — `localStorage` in web, Electron FS in desktop |

### Component Tree Overview

```
DiagramEditor (ReactFlowProvider)
└── EditorLogic
    ├── AppMenubar          ← window chrome, project title, panel toggles
    ├── ActivityBar         ← tab switcher (structure / explorer / etc.)
    ├── PrimarySideBar      ← context-sensitive left panel
    ├── DiagramCanvas       ← React Flow instance + canvas-scoped modals
    ├── RightSidebar        ← element inspector
    ├── BottomTerminal      ← code preview / output
    ├── StatusBar
    └── [Global Modals]     ← KeyboardShortcutsModal, ExportModal, etc.
```

The `WelcomeScreen` is rendered in place of `EditorLogic` when `useVFSStore.project === null`.

### Zustand Store Architecture

Three orthogonal stores handle the full application state:

```
useModelStore          — Global SemanticModel (SSOT for shared elements)
useVFSStore            — Project file-system tree (LibreUMLProject + standalone localModels)
useWorkspaceStore      — Editor session state (open tabs, active file, dirty flags, viewport)
```

A fourth store (`useUiStore`) handles transient UI state — active modal, keyboard shortcut overlay, etc. — and is not persisted.

**Persistence key names:**

| Store | `localStorage` key |
|---|---|
| `useModelStore` | `libreuml-model-storage` |
| `useVFSStore` | `libreuml-vfs-storage` |
| `useWorkspaceStore` | `libreuml-workspace-storage` |

All three stores use a custom `storageAdapter` so they can be swapped from `localStorage` to Electron's file system without changing store logic.

### Modal Architecture

Modals fall into two categories by lifecycle scope:

**Canvas-scoped modals** (live inside `DiagramCanvas`): These require an active canvas context — live React Flow state, selected node IDs, etc. Examples: `SSoTClassEditorModal`, `GlobalDeleteModal`, `VfsEdgeActionModal`, `SpotlightModal`.

**Editor-scoped modals** (live inside `EditorLogic`): These must be available regardless of whether a tab is open or the canvas is ready. They are driven by `useUiStore.activeModal` (a discriminated string union). Examples: `KeyboardShortcutsModal`, `ExportModal`, `SingleClassGeneratorModal`, `ProjectGeneratorModal`, `ImportCodeModal`, `CodeExportConfigModal`.

> **Note:** A prior bug placed editor-scoped modals inside `DiagramCanvas`, which silently suppressed them when `activeTabId === null` or `isCanvasReady === false`. This was resolved in v0.7.0 by lifting them to `EditorLogic`.

---

## 2. Domain Models (IR Types)

LibreUML uses a **two-layer model** — an IR (Intermediate Representation) semantic layer and a presentation layer.

### 2.1 Base Domain Interfaces

All domain nodes and edges share common base interfaces defined in `src/core/domain/models/`.

**`BaseDomainNode`** (`nodes/base.types.ts`):
```typescript
interface BaseDomainNode {
  id: string;
  type: string;          // discriminator
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
}
```

**`BaseDomainEdge`** (`edges/base.types.ts`):
```typescript
interface BaseDomainEdge {
  id: string;
  type: string;          // discriminator
  sourceNodeId: string;
  targetNodeId: string;
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
}
```

**Shared mixins:**

```typescript
type Visibility = '+' | '-' | '#' | '~';  // public, private, protected, package

interface Packageable  { package?: string; }
interface Documentable { documentation?: string; tags?: string[]; }
interface Multiplicable { sourceMultiplicity?: string; targetMultiplicity?: string; }
interface Labelable     { label?: string; }
```

### 2.2 Class Diagram Node Types

Defined in `src/core/domain/models/nodes/class-diagram.types.ts`. All extend `BaseDomainNode` plus mixins.

| Type | Key fields |
|---|---|
| `ClassNode` | `name`, `isAbstract`, `attributes: ClassAttribute[]`, `methods: ClassMethod[]`, `packageName?` |
| `AbstractClassNode` | Same as `ClassNode` with `isAbstract: true` enforced |
| `InterfaceNode` | `name`, `methods: ClassMethod[]`, `packageName?` |
| `EnumNode` | `name`, `values: string[]`, `packageName?` |
| `NoteNode` | `content: string` |

```typescript
type ClassDiagramNode =
  | ClassNode
  | AbstractClassNode
  | InterfaceNode
  | EnumNode
  | NoteNode;
```

**Member types:**
```typescript
interface ClassAttribute {
  id: string;
  name: string;
  type: string;
  visibility: Visibility;
  isStatic?: boolean;
}

interface MethodParameter {
  name: string;
  type: string;
}

interface ClassMethod {
  id: string;
  name: string;
  returnType: string;
  visibility: Visibility;
  parameters: MethodParameter[];
  isStatic?: boolean;
  isAbstract?: boolean;
}
```

### 2.3 Class Diagram Edge Types

Defined in `src/core/domain/models/edges/class-diagram.types.ts`. All extend `BaseDomainEdge`.

| Type | Additional fields |
|---|---|
| `AssociationEdge` | `Multiplicable`, `Labelable` |
| `InheritanceEdge` | (base only) |
| `ImplementationEdge` | (base only) |
| `DependencyEdge` | `Labelable` |
| `AggregationEdge` | `Multiplicable`, `Labelable` |
| `CompositionEdge` | `Multiplicable`, `Labelable` |
| `NoteLinkEdge` | (base only) |

```typescript
type ClassDiagramEdge =
  | AssociationEdge
  | InheritanceEdge
  | ImplementationEdge
  | DependencyEdge
  | AggregationEdge
  | CompositionEdge
  | NoteLinkEdge;
```

### 2.4 IR Layer — SemanticModel

Defined in `src/core/domain/vfs/vfs.types.ts`. This is the **canonical domain model** held by `useModelStore` (global) or `VFSFile.localModel` (standalone).

```typescript
interface SemanticModel {
  id: string;
  name: string;
  version: string;

  // Element dictionaries (id → element)
  packages:        Record<string, IRPackage>;
  classes:         Record<string, IRClass>;
  interfaces:      Record<string, IRInterface>;
  enums:           Record<string, IREnum>;
  dataTypes:       Record<string, IRDataType>;
  attributes:      Record<string, IRAttribute>;
  operations:      Record<string, IROperation>;
  actors:          Record<string, IRActor>;
  useCases:        Record<string, IRUseCase>;
  activityNodes:   Record<string, IRActivityNode>;
  objectInstances: Record<string, IRObjectInstance>;
  components:      Record<string, IRComponent>;
  nodes:           Record<string, IRNode>;
  artifacts:       Record<string, IRArtifact>;
  relations:       Record<string, IRRelation>;

  // Optional
  packageNames?: string[];

  createdAt: number;
  updatedAt: number;
}
```

**IR element types (class diagram subset):**

```typescript
interface IRClass {
  id: string;
  kind: 'CLASS';
  name: string;
  isAbstract?: boolean;
  packageName?: string;
  attributeIds: string[];   // references into model.attributes
  operationIds: string[];   // references into model.operations
  isExternal?: boolean;
}

interface IRInterface {
  id: string;
  kind: 'INTERFACE';
  name: string;
  packageName?: string;
  operationIds: string[];
  isExternal?: boolean;
}

interface IREnum {
  id: string;
  kind: 'ENUM';
  name: string;
  packageName?: string;
  values: string[];
  isExternal?: boolean;
}

interface IRAttribute {
  id: string;
  name: string;
  type: string;
  visibility: '+' | '-' | '#' | '~';
  isStatic?: boolean;
}

interface IROperation {
  id: string;
  name: string;
  returnType: string;
  visibility: '+' | '-' | '#' | '~';
  parameters: IRParameter[];
  isStatic?: boolean;
  isAbstract?: boolean;
}

interface IRParameter {
  name: string;
  type: string;
}
```

**`IRRelation` and `RelationKind`:**

```typescript
interface IRRelation {
  id: string;
  kind: RelationKind;
  sourceId: string;   // ID of source IR element
  targetId: string;   // ID of target IR element
  sourceMultiplicity?: string;
  targetMultiplicity?: string;
  label?: string;
}

type RelationKind =
  | 'ASSOCIATION'
  | 'DIRECTED_ASSOCIATION'
  | 'BIDIRECTIONAL_ASSOCIATION'
  | 'AGGREGATION'
  | 'COMPOSITION'
  | 'INHERITANCE'
  | 'REALIZATION'
  | 'DEPENDENCY'
  | 'USAGE'
  | 'ABSTRACTION'
  | 'REFINEMENT'
  | 'SUBSTITUTION'
  | 'NOTE_LINK'
  | 'INFORMATION_FLOW';
```

### 2.5 Presentation Layer (React Flow)

Defined in `src/features/diagram/types/diagram.types.ts`. Used exclusively for React Flow rendering — **not persisted as the source of truth.**

```typescript
// A rendered node on the React Flow canvas
interface UmlClassData {
  label: string;
  isAbstract?: boolean;
  isInterface?: boolean;
  isEnum?: boolean;
  attributes: UmlAttribute[];
  methods: UmlMethod[];
  elementId: string;  // references IR element ID
}

type UmlClassNode = Node<UmlClassData>;

interface UmlAttribute {
  id: string;
  visibility: '+' | '-' | '#' | '~';
  name: string;
  type: string;
  isStatic?: boolean;
}

interface UmlMethod {
  id: string;
  visibility: '+' | '-' | '#' | '~';
  name: string;
  returnType: string;
  params: string;
  isStatic?: boolean;
  isAbstract?: boolean;
}
```

### 2.6 View Layer (DiagramView)

Defined in `vfs.types.ts`. The `DiagramView` is the **persisted canvas layout** stored in `VFSFile.content`. It records where IR elements appear on screen — not what they are.

```typescript
interface ViewNode {
  elementId: string;   // references IR element ID
  x: number;
  y: number;
  width?: number;
  height?: number;
}

interface ViewEdge {
  relationId: string;  // references IRRelation ID
  waypoints?: { x: number; y: number }[];
}

interface DiagramView {
  diagramId: string;
  nodes: ViewNode[];
  edges: ViewEdge[];
}
```

**Data flow summary:**

```
SemanticModel (IR)          ← source of truth for element identity + structure
    ↓ hydration
DiagramView (ViewNode[])    ← source of truth for canvas position
    ↓ merge
UmlClassData (React Flow)   ← ephemeral render object, derived on each canvas mount
```

---

## 3. State Forking — The Standalone Sandbox

V0.7.0 introduces the most significant architectural decision in LibreUML's history: **per-file semantic model isolation via state forking.**

### 3.1 The Problem

Prior to v0.7.0, all diagram files within a project shared a single global `SemanticModel` held in `useModelStore`. This meant:

- Deleting a class from one diagram would cascade-delete it from every diagram in the project.
- There was no way to draft experimental diagrams without polluting the shared model.
- Students working on UML exercises had no concept of "this diagram has its own scope."

### 3.2 The Solution: VFSFile.localModel

Each `VFSFile` can now carry its own `SemanticModel` via the optional `localModel` field:

```typescript
interface VFSFile extends VFSBaseNode {
  type: 'FILE';
  diagramType: DiagramType;
  extension: FileExtension;
  content: DiagramView | unknown | null;
  isExternal?: boolean;
  standalone?: boolean;       // ← marks this file as operating in isolation
  localModel?: SemanticModel; // ← the forked semantic model
}
```

When `standalone === true`, the file's `localModel` is used as its semantic source of truth instead of `useModelStore`. The global model is **never read or written** for standalone files.

### 3.3 The standaloneModelOps Factory

`src/store/standaloneModelOps.ts` provides a CRUD API identical in shape to `useModelStore`, but scoped to a single file's `localModel`.

```typescript
const ops = standaloneModelOps(fileId);

// All of these route through VFSStore.updateLocalModel — zero contact with useModelStore
ops.createClass({ name: 'Vehicle', attributeIds: [], operationIds: [] });
ops.createRelation({ kind: 'INHERITANCE', sourceId: '...', targetId: '...' });
ops.deleteClass(classId);  // also cascade-deletes relations
```

**Implementation detail:** `updateLocalModel(fileId, updater)` in `useVFSStore` does **not** use immer. It performs a `JSON.parse(JSON.stringify(localModel))` deep-clone, passes the mutable copy to the updater function, then replaces the stored value. This is intentional — the VFS store does not use the immer middleware.

```typescript
// Inside useVFSStore
updateLocalModel: (fileId, updater) => {
  set((state) => {
    const file = state.project.nodes[fileId] as VFSFile;
    const draft = JSON.parse(JSON.stringify(file.localModel)) as SemanticModel;
    updater(draft);
    return { project: { ...state.project, nodes: { ...state.project.nodes,
      [fileId]: { ...file, localModel: draft, updatedAt: Date.now() }
    }}};
  });
},
```

### 3.4 Consumer Dispatch Pattern

Components that perform mutations check the file's standalone flag to route to the correct store:

```typescript
// From PackageExplorer.tsx
const isStandalone = useVFSStore((s): boolean =>
  (s.project?.nodes[fileId] as VFSFile)?.standalone === true
);

// Dispatch to the right store
if (isStandalone) {
  standaloneModelOps(activeTabId).createClass(data);
} else {
  useModelStore.getState().createClass(data);
}
```

This pattern is replicated consistently across all mutation sites: `PackageExplorer`, `SSoTClassEditorModal`, `SSoTElementEditorModal`, and canvas interaction handlers.

### 3.5 Eject Lifecycle (Global → Standalone)

Implemented as `handleMakeStandalone` in `src/features/diagram/components/layout/ProjectStructure.tsx`.

When a user "ejects" a diagram file into standalone mode:

1. The current `DiagramView` (canvas layout) is read from `VFSFile.content`.
2. All `elementId` references in `ViewNode[]` are collected.
3. For each referenced element in the global `SemanticModel`, a **deep clone** is created with a **new UUID** (`crypto.randomUUID()`).
4. All `IRRelation` entries that connect two ejected elements are also cloned with new UUIDs.
5. The cloned elements are written into a new `SemanticModel` and set as `VFSFile.localModel`.
6. The `DiagramView` is updated to reference the new element UUIDs.
7. `VFSFile.standalone` is set to `true`.

The original elements in `useModelStore` are **not removed** — the eject is non-destructive. The file becomes self-contained without affecting the rest of the project.

### 3.6 Merge Lifecycle (Standalone → Global)

Implemented as `handleAddStandaloneToProject` in `ProjectStructure.tsx`.

When a user promotes a standalone file back to the shared project:

1. All elements in `VFSFile.localModel` are read.
2. **Conflict resolution:** If a class/interface/enum name already exists in `useModelStore`, the incoming element is renamed with a `_1` / `_2` suffix.
3. **Package deduplication:** Package names are added via `useModelStore.addPackageName`, which guards against duplicates internally.
4. The merged elements are written into `useModelStore` via standard CRUD operations.
5. The `DiagramView` is updated to reference the globally-assigned IDs.
6. `VFSFile.standalone` is set to `false` and `VFSFile.localModel` is cleared.

### 3.7 Visual Indicators

Standalone files display an amber **"solo"** badge in the Project Explorer sidebar (`ProjectStructure.tsx`). This makes the isolation state immediately visible to the user and serves as an affordance for the eject/merge context menu actions.

---

## 4. Known Limitations & Roadmap

### 4.1 Canvas Rendering Engine (Critical)

**Limitation:** React Flow is a DOM-based renderer. Each UML class node is a full React component subtree. At scale (50+ classes with visible attributes/methods), render performance degrades significantly due to:

- DOM diffing overhead on every zoom/pan event.
- No virtualization for node internals (attributes, methods rows).
- React Flow's edge routing recalculates on every layout change.

**Planned fix:** Migrate the canvas rendering engine to **React-Konva / HTML5 Canvas**. This would make node rendering O(1) per frame regardless of diagram complexity. The IR layer (`SemanticModel`) and VFS layer are already canvas-agnostic — only the React Flow presentation types (`UmlClassData`, `DiagramState`) would be replaced.

### 4.2 SemanticModel Over-Scoping

**Limitation:** `SemanticModel` currently carries 15+ typed dictionaries for all future diagram types (use cases, activity nodes, components, artifacts, etc.). Only the class diagram subset (`classes`, `interfaces`, `enums`, `attributes`, `operations`, `relations`) is actively used in v0.7.0.

**Implication:** Every `initLocalModel` call allocates and persists empty dictionaries for all these future types. For projects with many standalone files, this creates unnecessary storage bloat.

**Planned fix:** Introduce a `diagramType` discriminant on `SemanticModel` and use sparse initialization — only allocate the dictionaries relevant to the file's `diagramType`.

### 4.3 updateLocalModel Deep-Clone Cost

**Limitation:** `useVFSStore.updateLocalModel` uses `JSON.parse(JSON.stringify(...))` for deep cloning. For models with hundreds of elements, this is a synchronous O(n) operation on every mutation. The VFS store intentionally does not use immer (to keep its middleware stack simple), so structural sharing is not available.

**Planned fix:** Either adopt immer for the VFS store (aligning it with `useModelStore`), or introduce a worker-based serialization pipeline for large models.

### 4.4 Merge Conflict Strategy is Rename-Only

**Limitation:** The current merge conflict resolution strategy (`_1` / `_2` suffix) is a mechanical fallback. It does not offer the user any UI for inspecting conflicts, choosing which version to keep, or merging attribute-level changes.

**Planned fix:** Build a visual diff/merge dialog that presents conflicting elements side-by-side before committing the merge. This is explicitly tracked in the roadmap.

### 4.5 No Multi-Diagram Cascade for Standalone Files

**Limitation:** When an element is deleted from a standalone `localModel`, `purgeElementFromAllDiagrams` is **not** called (it only operates on the global model). If a standalone file's diagram layout still references a deleted element ID, the canvas will render orphaned `ViewNode` entries with no corresponding IR element.

**Planned fix:** Extend `standaloneModelOps.deleteClass/Interface/Enum` to call a local equivalent of `purgeElementFromAllDiagrams` scoped to the single file's `DiagramView`.

### 4.6 WorkspaceStore / VFSStore Dual Tracking

**Limitation:** `useWorkspaceStore` maintains its own `files: DiagramFile[]` array (a legacy artifact from the pre-VFS era). In VFS mode, `DiagramFile` entries are partially redundant with `VFSFile` nodes. The `isDirty` flag, `viewport`, and `nodeIds`/`edgeIds` arrays in `DiagramFile` are still used by the canvas and tab bar, but `VFSFile.content` is the canonical layout store.

**Planned fix:** Fully migrate layout and dirty tracking to `VFSStore` and deprecate the `DiagramFile.nodeIds`/`edgeIds` arrays. `WorkspaceStore` would be reduced to session-only state (open tabs, active tab ID, connection modes).

---

*This document was generated from source analysis of the `hotfix/v0.6.4-usability-patches` branch. For the forward-looking product roadmap, see [`roadmap.md`](../roadmap.md) and [`docs/VISION.md`](./VISION.md).*
