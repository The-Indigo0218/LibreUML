# LibreUML — Modelos listos para diagramar

> Generado: 2026-04-26 — Estado del código en rama `feat/canvas-ux-improvements`.  
> Formato: cada entidad muestra tipo de nodo UML, atributos y tabla de relaciones lista para entrar en LibreUML.  
> Relaciones usan la nomenclatura de **LibreUML**: Inheritance / Implementation / Composition / Aggregation / Association / Dependency.

**Notación en tablas de relaciones:**

| Símbolo | Significado |
|---|---|
| `` `A` ◆──► `B` `` | Composition — `A` es el todo (rombo lleno), `B` es la parte |
| `` `A` ◇──► `B` `` | Aggregation — `A` es el todo (rombo hueco), `B` es la parte |
| `` `A` ──▷ `B` `` | Implementation / Inheritance — `A` implementa o extiende `B` |
| `` `A` ──► `B` `` | Association — `A` referencia `B` sin poseerla |
| `` `A` ··► `B` `` | Dependency — `A` depende de `B` para construirse |

---

## Diagramas sugeridos (un archivo por diagrama)

| # | Nombre del archivo | Contenido |
|---|---|---|
| 1 | `01-core-nodes.luml` | Nodos de dominio: BaseDomainNode, ClassNode, etc. |
| 2 | `02-core-edges.luml` | Aristas de dominio: BaseDomainEdge, AssociationEdge, etc. |
| 3 | `03-vfs-structure.luml` | VFS: VFSBaseNode, VFSFile, VFSFolder, LibreUMLProject, DiagramView, ViewNode, ViewEdge |
| 4 | `04-semantic-model.luml` | IR: SemanticModel, IRElement y todas sus subentidades |
| 5 | `05-stores.luml` | Stores de Zustand: Settings, Model, VFS, Workspace, Sync, UI, Layout |
| 6 | `06-canvas-viewmodels.luml` | Canvas stores + View Models + EdgeView |

---

## DIAGRAMA 1 — `core/domain/nodes`

### `BaseDomainNode`
**Nodo LibreUML:** `«interface»`

| Atributo | Tipo |
|---|---|
| id | string |
| type | string |
| createdAt | number |
| updatedAt | number |
| metadata | Record\<string, unknown\>? |

_Sin relaciones salientes — es la base._

---

### `Packageable`
**Nodo LibreUML:** `«interface»`

| Atributo | Tipo |
|---|---|
| package | string? |

_Sin relaciones salientes._

---

### `Documentable`
**Nodo LibreUML:** `«interface»`

| Atributo | Tipo |
|---|---|
| documentation | string? |
| tags | string[]? |

_Sin relaciones salientes._

---

### `ClassAttribute`
**Nodo LibreUML:** `Class`

| Atributo | Tipo |
|---|---|
| id | string |
| name | string |
| type | string |
| visibility | '+' \| '-' \| '#' \| '~' |
| isArray | boolean |
| isStatic | boolean? |
| isReadOnly | boolean? |
| defaultValue | string? |

| Relación | Tipo LibreUML | Mult. | Nota |
|---|---|---|---|
| — | — | — | Valor puro, sin dependencias |

---

### `MethodParameter`
**Nodo LibreUML:** `Class`

| Atributo | Tipo |
|---|---|
| name | string |
| type | string |
| isArray | boolean? |
| defaultValue | string? |

---

### `ClassMethod`
**Nodo LibreUML:** `Class`

| Atributo | Tipo |
|---|---|
| id | string |
| name | string |
| returnType | string |
| visibility | '+' \| '-' \| '#' \| '~' |
| isReturnArray | boolean? |
| isStatic | boolean? |
| isAbstract | boolean? |
| isConstructor | boolean? |

| Relación | Tipo LibreUML | Mult. | Nota |
|---|---|---|---|
| `ClassMethod` ◆──► `MethodParameter` | **Composition** | 0..* | Un método posee sus parámetros |

---

### `ClassNode`
**Nodo LibreUML:** `Class`

| Atributo | Tipo |
|---|---|
| type | 'CLASS' |
| name | string |
| generics | string? |
| isMain | boolean? |

| Relación | Tipo LibreUML | Mult. | Nota |
|---|---|---|---|
| `ClassNode` ──▷ `BaseDomainNode` | **Implementation** | 1 | `interface` base |
| `ClassNode` ──▷ `Packageable` | **Implementation** | 1 | Puede tener paquete |
| `ClassNode` ──▷ `Documentable` | **Implementation** | 1 | Puede tener documentación |
| `ClassNode` ◆──► `ClassAttribute` | **Composition** | 0..* | Posee sus atributos |
| `ClassNode` ◆──► `ClassMethod` | **Composition** | 0..* | Posee sus métodos |

---

### `InterfaceNode`
**Nodo LibreUML:** `Class`

| Atributo | Tipo |
|---|---|
| type | 'INTERFACE' |
| name | string |
| generics | string? |

| Relación | Tipo LibreUML | Mult. | Nota |
|---|---|---|---|
| `InterfaceNode` ──▷ `BaseDomainNode` | **Implementation** | 1 | |
| `InterfaceNode` ──▷ `Packageable` | **Implementation** | 1 | |
| `InterfaceNode` ──▷ `Documentable` | **Implementation** | 1 | |
| `InterfaceNode` ◆──► `ClassMethod` | **Composition** | 0..* | |

---

### `AbstractClassNode`
**Nodo LibreUML:** `Abstract Class`

| Atributo | Tipo |
|---|---|
| type | 'ABSTRACT_CLASS' |
| name | string |
| generics | string? |

| Relación | Tipo LibreUML | Mult. | Nota |
|---|---|---|---|
| `AbstractClassNode` ──▷ `BaseDomainNode` | **Implementation** | 1 | |
| `AbstractClassNode` ──▷ `Packageable` | **Implementation** | 1 | |
| `AbstractClassNode` ──▷ `Documentable` | **Implementation** | 1 | |
| `AbstractClassNode` ◆──► `ClassAttribute` | **Composition** | 0..* | |
| `AbstractClassNode` ◆──► `ClassMethod` | **Composition** | 0..* | |

---

### `EnumNode`
**Nodo LibreUML:** `Class` _(estereotipo `«enum»`)_

| Atributo | Tipo |
|---|---|
| type | 'ENUM' |
| name | string |
| literals | { id: string; name: string; value?: string\|number }[] |

| Relación | Tipo LibreUML | Mult. | Nota |
|---|---|---|---|
| `EnumNode` ──▷ `BaseDomainNode` | **Implementation** | 1 | |
| `EnumNode` ──▷ `Packageable` | **Implementation** | 1 | |
| `EnumNode` ──▷ `Documentable` | **Implementation** | 1 | |

---

### `NoteNode`
**Nodo LibreUML:** `Class`

| Atributo | Tipo |
|---|---|
| type | 'NOTE' |
| content | string |
| backgroundColor | string? |

| Relación | Tipo LibreUML | Mult. | Nota |
|---|---|---|---|
| `NoteNode` ──▷ `BaseDomainNode` | **Implementation** | 1 | No es Packageable ni Documentable |

---

## DIAGRAMA 2 — `core/domain/edges`

### `BaseDomainEdge`
**Nodo LibreUML:** `«interface»`

| Atributo | Tipo |
|---|---|
| id | string |
| type | string |
| sourceNodeId | string |
| targetNodeId | string |
| createdAt | number |
| updatedAt | number |
| metadata | Record\<string, unknown\>? |

---

### `Multiplicable`
**Nodo LibreUML:** `«interface»`

| Atributo | Tipo |
|---|---|
| sourceMultiplicity | string? |
| targetMultiplicity | string? |

---

### `Labelable`
**Nodo LibreUML:** `«interface»`

| Atributo | Tipo |
|---|---|
| label | string? |

---

### Aristas concretas

Todas tienen el mismo patrón de relaciones, sólo cambian los mixins. La tabla por arista:

#### `AssociationEdge`
**Nodo LibreUML:** `Class`

| Atributo | Tipo |
|---|---|
| isNavigable | boolean? |
| isBidirectional | boolean? |

| Relación | Tipo LibreUML | Mult. | Nota |
|---|---|---|---|
| `AssociationEdge` ──▷ `BaseDomainEdge` | **Implementation** | 1 | |
| `AssociationEdge` ──▷ `Multiplicable` | **Implementation** | 1 | |
| `AssociationEdge` ──▷ `Labelable` | **Implementation** | 1 | |

---

#### `InheritanceEdge`
**Nodo LibreUML:** `Class`

_Sin atributos propios._

| Relación | Tipo LibreUML | Mult. | Nota |
|---|---|---|---|
| `InheritanceEdge` ──▷ `BaseDomainEdge` | **Implementation** | 1 | |

---

#### `ImplementationEdge`
**Nodo LibreUML:** `Class`

| Relación | Tipo LibreUML | Mult. | Nota |
|---|---|---|---|
| `ImplementationEdge` ──▷ `BaseDomainEdge` | **Implementation** | 1 | |

---

#### `DependencyEdge`
**Nodo LibreUML:** `Class`

| Atributo | Tipo |
|---|---|
| stereotype | string? |

| Relación | Tipo LibreUML | Mult. | Nota |
|---|---|---|---|
| `DependencyEdge` ──▷ `BaseDomainEdge` | **Implementation** | 1 | |
| `DependencyEdge` ──▷ `Labelable` | **Implementation** | 1 | |

---

#### `AggregationEdge` y `CompositionEdge`
**Nodo LibreUML:** `Class`

| Relación | Tipo LibreUML | Mult. | Nota |
|---|---|---|---|
| `AggregationEdge` / `CompositionEdge` ──▷ `BaseDomainEdge` | **Implementation** | 1 | |
| `AggregationEdge` / `CompositionEdge` ──▷ `Multiplicable` | **Implementation** | 1 | |
| `AggregationEdge` / `CompositionEdge` ──▷ `Labelable` | **Implementation** | 1 | |

---

#### `NoteLinkEdge`, `PackageImportEdge`, `PackageAccessEdge`, `PackageMergeEdge`

| Relación | Tipo LibreUML | Mult. | Nota |
|---|---|---|---|
| `NoteLinkEdge` / `PackageImportEdge` / ... ──▷ `BaseDomainEdge` | **Implementation** | 1 | Sin mixins adicionales |

---

## DIAGRAMA 3 — `core/domain/vfs` (estructura de archivos)

### `VFSBaseNode`
**Nodo LibreUML:** `«interface»`

| Atributo | Tipo |
|---|---|
| id | string |
| name | string |
| type | 'FOLDER' \| 'FILE' |
| parentId | string \| null |
| description | string? |
| tags | string[]? |
| createdAt | number |
| updatedAt | number |

---

### `VFSFolder`
**Nodo LibreUML:** `«interface»`

| Atributo | Tipo |
|---|---|
| type | 'FOLDER' |

| Relación | Tipo LibreUML | Mult. | Nota |
|---|---|---|---|
| `VFSFolder` ──▷ `VFSBaseNode` | **Inheritance** | 1 | `interface extends interface` |

---

### `VFSFile`
**Nodo LibreUML:** `«interface»`

| Atributo | Tipo |
|---|---|
| type | 'FILE' |
| diagramType | DiagramType (enum) |
| extension | '.luml' \| '.xmi' \| '.md' \| '.model' \| '.json' |
| isExternal | boolean |
| isReadOnly | boolean? |
| standalone | boolean? |
| content | unknown \| null |
| localModel | SemanticModel \| null? |

| Relación | Tipo LibreUML | Mult. | Nota |
|---|---|---|---|
| `VFSFile` ──▷ `VFSBaseNode` | **Inheritance** | 1 | `interface extends interface` |
| `VFSFile` ◇──► `SemanticModel` | **Aggregation** | 0..1 | Sólo si `standalone=true` |
| `VFSFile` ◇──► `DiagramView` | **Aggregation** | 0..1 | El `content` cuando el diagrama está activo |

---

### `ViewNode`
**Nodo LibreUML:** `Class`

| Atributo | Tipo |
|---|---|
| id | string |
| elementId | string |
| x | number |
| y | number |
| width | number? |
| height | number? |
| zIndex | number? |
| color | string? |
| content | string? |
| noteTitle | string? |
| parentPackageId | string \| null? |
| collapsed | boolean? |
| packageName | string? |

---

### `ViewEdge`
**Nodo LibreUML:** `Class`

| Atributo | Tipo |
|---|---|
| id | string |
| relationId | string |
| waypoints | {x:number; y:number}[] |
| sourceHandle | string? |
| targetHandle | string? |
| sourceMultiplicity | string? |
| targetMultiplicity | string? |
| sourceRole | string? |
| targetRole | string? |
| anchorLocked | boolean? |

---

### `DiagramView`
**Nodo LibreUML:** `Class`

| Atributo | Tipo |
|---|---|
| diagramId | string |

| Relación | Tipo LibreUML | Mult. | Nota |
|---|---|---|---|
| `DiagramView` ◆──► `ViewNode` | **Composition** | 0..* | La vista es dueña de sus nodos visuales |
| `DiagramView` ◆──► `ViewEdge` | **Composition** | 0..* | La vista es dueña de sus aristas visuales |

---

### `LibreUMLProject`
**Nodo LibreUML:** `Class`

| Atributo | Tipo |
|---|---|
| id | string |
| projectName | string |
| description | string? |
| author | string? |
| version | string |
| projectKind | 'SOFTWARE_ARCHITECTURE' \| 'FREE'? |
| targetLanguage | string? |
| basePackage | string? |
| domainModelId | string |
| modelIds | string[]? |
| createdAt | number |
| updatedAt | number |

| Relación | Tipo LibreUML | Mult. | Nota |
|---|---|---|---|
| `LibreUMLProject` ◆──► `VFSFolder` \| `VFSFile` | **Composition** | 0..* | `nodes: Record<id, VFSFolder\|VFSFile>` |
| `LibreUMLProject` ──► `SemanticModel` | **Association** | 1 | `domainModelId` referencia al modelo global |

---

## DIAGRAMA 4 — `core/domain/vfs` (Semantic Model / IR)

### `IRElement`
**Nodo LibreUML:** `«interface»`

| Atributo | Tipo |
|---|---|
| id | string |
| name | string |
| visibility | 'public'\|'private'\|'protected'\|'package'? |
| isAbstract | boolean? |
| isStatic | boolean? |
| documentation | string? |
| stereotypes | string[]? |

| Relación | Tipo LibreUML | Mult. | Nota |
|---|---|---|---|
| `IRElement` ◆──► `TaggedValue` | **Composition** | 0..* | |
| `IRElement` ◆──► `Annotation` | **Composition** | 0..* | |
| `IRElement` ──► `SourceRef` | **Association** | 0..1 | Referencia a archivo fuente (ingeniería inversa) |

---

### `TaggedValue`
**Nodo LibreUML:** `Class`

| Atributo | Tipo |
|---|---|
| key | string |
| value | string |

---

### `Annotation`
**Nodo LibreUML:** `Class`

| Atributo | Tipo |
|---|---|
| name | string |
| attributes | Record\<string, string\>? |

---

### `SourceRef`
**Nodo LibreUML:** `Class`

| Atributo | Tipo |
|---|---|
| filePath | string? |
| lineNumber | number? |
| columnNumber | number? |

---

### `IRPackage`
**Nodo LibreUML:** `«interface»`

| Atributo | Tipo |
|---|---|
| kind | 'PACKAGE' |
| packageIds | string[] |
| classIds | string[] |
| interfaceIds | string[] |
| enumIds | string[] |
| dataTypeIds | string[] |

| Relación | Tipo LibreUML | Mult. | Nota |
|---|---|---|---|
| `IRPackage` ──▷ `IRElement` | **Inheritance** | 1 | `interface extends interface` |

---

### `IRClass`
**Nodo LibreUML:** `«interface»`

| Atributo | Tipo |
|---|---|
| kind | 'CLASS' |
| packageId | string? |
| packageName | string? |
| attributeIds | string[] |
| operationIds | string[] |
| isFinal | boolean? |
| isActive | boolean? |
| isExternal | boolean? |

| Relación | Tipo LibreUML | Mult. | Nota |
|---|---|---|---|
| `IRClass` ──▷ `IRElement` | **Inheritance** | 1 | |

---

### `IRInterface`
**Nodo LibreUML:** `«interface»`

| Atributo | Tipo |
|---|---|
| kind | 'INTERFACE' |
| packageId | string? |
| packageName | string? |
| operationIds | string[] |
| isExternal | boolean? |

| Relación | Tipo LibreUML | Mult. | Nota |
|---|---|---|---|
| `IRInterface` ──▷ `IRElement` | **Inheritance** | 1 | |

---

### `IREnum`
**Nodo LibreUML:** `«interface»`

| Atributo | Tipo |
|---|---|
| kind | 'ENUM' |
| packageId | string? |
| packageName | string? |
| isExternal | boolean? |

| Relación | Tipo LibreUML | Mult. | Nota |
|---|---|---|---|
| `IREnum` ──▷ `IRElement` | **Inheritance** | 1 | |
| `IREnum` ◆──► `IREnumLiteral` | **Composition** | 1..* | |

---

### `IREnumLiteral`
**Nodo LibreUML:** `Class`

| Atributo | Tipo |
|---|---|
| name | string |
| value | string? |

---

### `IRAttribute`
**Nodo LibreUML:** `«interface»`

| Atributo | Tipo |
|---|---|
| kind | 'ATTRIBUTE' |
| type | string |
| multiplicity | string? |
| defaultValue | string? |
| isDerived | boolean? |
| isReadOnly | boolean? |

| Relación | Tipo LibreUML | Mult. | Nota |
|---|---|---|---|
| `IRAttribute` ──▷ `IRElement` | **Inheritance** | 1 | |

---

### `IROperation`
**Nodo LibreUML:** `«interface»`

| Atributo | Tipo |
|---|---|
| kind | 'OPERATION' |
| returnType | string? |
| isReturnArray | boolean? |
| isQuery | boolean? |
| exceptions | string[]? |

| Relación | Tipo LibreUML | Mult. | Nota |
|---|---|---|---|
| `IROperation` ──▷ `IRElement` | **Inheritance** | 1 | |
| `IROperation` ◆──► `IRParameter` | **Composition** | 0..* | |

---

### `IRParameter`
**Nodo LibreUML:** `Class`

| Atributo | Tipo |
|---|---|
| name | string |
| type | string |
| direction | 'in'\|'out'\|'inout'\|'return'? |
| defaultValue | string? |
| isArray | boolean? |

---

### `IRRelation`
**Nodo LibreUML:** `Class`

| Atributo | Tipo |
|---|---|
| id | string |
| kind | RelationKind (enum) |
| sourceId | string |
| targetId | string |
| name | string? |
| isExternal | boolean? |
| stereotypes | string[]? |

| Relación | Tipo LibreUML | Mult. | Nota |
|---|---|---|---|
| `IRRelation` ◆──► `IRAssociationEnd` (source) | **Composition** | 0..1 | `sourceEnd` |
| `IRRelation` ◆──► `IRAssociationEnd` (target) | **Composition** | 0..1 | `targetEnd` |

---

### `IRAssociationEnd`
**Nodo LibreUML:** `Class`

| Atributo | Tipo |
|---|---|
| elementId | string |
| role | string? |
| multiplicity | string? |
| isNavigable | boolean? |
| aggregation | 'none'\|'shared'\|'composite'? |

---

### `SemanticModel`
**Nodo LibreUML:** `Class`

| Atributo | Tipo |
|---|---|
| id | string |
| name | string |
| version | string |
| createdAt | number |
| updatedAt | number |
| packageNames | string[]? |

| Relación | Tipo LibreUML | Mult. | Nota |
|---|---|---|---|
| `SemanticModel` ◆──► `IRPackage` | **Composition** | 0..* | `packages: Record<id, IRPackage>` |
| `SemanticModel` ◆──► `IRClass` | **Composition** | 0..* | |
| `SemanticModel` ◆──► `IRInterface` | **Composition** | 0..* | |
| `SemanticModel` ◆──► `IREnum` | **Composition** | 0..* | |
| `SemanticModel` ◆──► `IRAttribute` | **Composition** | 0..* | Atributos centralizados por ID |
| `SemanticModel` ◆──► `IROperation` | **Composition** | 0..* | Operaciones centralizadas por ID |
| `SemanticModel` ◆──► `IRRelation` | **Composition** | 0..* | |

---

## DIAGRAMA 5 — `store` (Zustand stores)

### `SettingsState` (`useSettingsStore`)
**Nodo LibreUML:** `Class`

| Atributo | Tipo |
|---|---|
| autoSave | boolean |
| restoreSession | boolean |
| theme | 'light'\|'dark'\|'system' |
| language | string |
| suppressSvgWarning | boolean |
| hideDuplicateFileWarning | boolean |
| javaImportPreference | 'model'\|'canvas'\|'both'\|null |
| showMiniMap | boolean |
| gridType | 'none'\|'dots'\|'lines'\|'grid' |
| viewportCulling | boolean |
| suppressCullingWarning | boolean |
| snapToGrid | boolean |
| showAllEdges | boolean |
| lastFilePath | string? |
| telemetryOptIn | boolean\|null |

_Sin relaciones estructurales — es un store de valores primitivos._

---

### `ModelStoreState` (`useModelStore`)
**Nodo LibreUML:** `Class`

| Atributo | Tipo |
|---|---|
| model | SemanticModel\|null |

| Relación | Tipo LibreUML | Mult. | Nota |
|---|---|---|---|
| `ModelStoreState` ◇──► `SemanticModel` | **Aggregation** | 0..1 | El store referencia el modelo activo |

---

### `VFSStoreState` (`useVFSStore`)
**Nodo LibreUML:** `Class`

| Atributo | Tipo |
|---|---|
| project | LibreUMLProject\|null |
| isLoading | boolean |

| Relación | Tipo LibreUML | Mult. | Nota |
|---|---|---|---|
| `VFSStoreState` ◆──► `LibreUMLProject` | **Composition** | 0..1 | El store es dueño del proyecto activo |

---

### `WorkspaceStoreState` (`useWorkspaceStore`)
**Nodo LibreUML:** `Class`

| Atributo | Tipo |
|---|---|
| openTabs | string[] |
| activeTabId | string\|null |
| activeFileId | string\|null |
| connectionModes | Record\<string, string\> |

---

### `CloudDiagramEntry`
**Nodo LibreUML:** `Class`

| Atributo | Tipo |
|---|---|
| cloudId | string |
| version | number |

---

### `OfflineQueueItem`
**Nodo LibreUML:** `Class`

| Atributo | Tipo |
|---|---|
| id | string |
| kind | 'metadata'\|'model'\|'diagram' |
| projectId | string |
| vfsDiagramId | string? |
| cloudDiagramId | string? |
| payload | Record\<string, unknown\> |
| attempts | number |
| lastAttemptAt | number |

---

### `SyncStoreState` (`useSyncStore`)
**Nodo LibreUML:** `Class`

| Atributo | Tipo |
|---|---|
| cloudProjectId | string\|null |
| modelVersion | number |
| storageMode | 'local'\|'cloud' |
| syncStatus | 'idle'\|'saving'\|'saved'\|'error'\|'conflict'\|'offline' |
| lastSyncedAt | number\|null |
| error | string\|null |

| Relación | Tipo LibreUML | Mult. | Nota |
|---|---|---|---|
| `SyncStoreState` ◆──► `CloudDiagramEntry` | **Composition** | 0..* | `cloudDiagrams: Record<id, CloudDiagramEntry>` |
| `SyncStoreState` ◆──► `OfflineQueueItem` | **Composition** | 0..* | Cola de reintentos offline |

---

### `UiStoreState` (`useUiStore`)
**Nodo LibreUML:** `Class`

| Atributo | Tipo |
|---|---|
| activeModal | string (union de ~16 valores) |
| editingId | string\|null |
| anchorSnapshot | AnchorSnapshot\|null |
| isGetStartedOpen | boolean |

| Relación | Tipo LibreUML | Mult. | Nota |
|---|---|---|---|
| `UiStoreState` ◇──► `AnchorSnapshot` | **Aggregation** | 0..1 | Snapshot temporal del anchor al abrir modal de arista |

---

### `AnchorSnapshot`
**Nodo LibreUML:** `Class`

| Atributo | Tipo |
|---|---|
| src | 'T'\|'B'\|'L'\|'R'\|'TL'\|'TR'\|'BL'\|'BR' |
| tgt | (mismo tipo) |
| direction | { dx: number; dy: number } |

---

### `LayoutStoreState` (`useLayoutStore`)
**Nodo LibreUML:** `Class`

| Atributo | Tipo |
|---|---|
| isLeftPanelOpen | boolean |
| isRightPanelOpen | boolean |
| isBottomPanelOpen | boolean |
| bottomPanelTab | 'terminal'\|'problems' |

---

### `AuthStoreState` (`useAuthStore`)
**Nodo LibreUML:** `Class`

| Atributo | Tipo |
|---|---|
| isAuthenticated | boolean |
| isLoading | boolean |
| isLocalMode | boolean |
| error | string\|null |

| Relación | Tipo LibreUML | Mult. | Nota |
|---|---|---|---|
| `AuthStoreState` ──► `UserResponse` | **Association** | 0..1 | Usuario autenticado activo |

---

### `UserResponse` (API DTO)
**Nodo LibreUML:** `Class`

| Atributo | Tipo |
|---|---|
| id | string |
| fullName | string |
| email | string |
| role | 'TEACHER'\|'STUDENT'\|'DEVELOPER'\|'MODERATOR'\|'ADMIN' |

---

## DIAGRAMA 6 — `canvas/store` + `adapters/viewmodels`

### `StageStore` (`useStageStore`)
**Nodo LibreUML:** `Class`

| Atributo | Tipo |
|---|---|
| stage | Konva.Stage\|null |

---

### `ViewportControlStore` (`useViewportControlStore`)
**Nodo LibreUML:** `Class`

| Atributo | Tipo |
|---|---|
| zoomIn | () => void |
| zoomOut | () => void |
| fitView | () => void |
| panTo | (worldCx: number, worldCy: number) => void |

---

### `InlineEditorState` (`useInlineEditorStore`)
**Nodo LibreUML:** `Class`

| Atributo | Tipo |
|---|---|
| isEditing | boolean |
| activeNodeId | string\|null |
| currentText | string |
| fieldType | 'name'\|'title' |

| Relación | Tipo LibreUML | Mult. | Nota |
|---|---|---|---|
| `InlineEditorState` ◆──► `InlineEditorPosition` | **Composition** | 0..1 | |
| `InlineEditorState` ◆──► `InlineEditorDimensions` | **Composition** | 0..1 | |

---

### `InlineEditorPosition`
**Nodo LibreUML:** `Class`

| Atributo | Tipo |
|---|---|
| x | number |
| y | number |

---

### `InlineEditorDimensions`
**Nodo LibreUML:** `Class`

| Atributo | Tipo |
|---|---|
| width | number |
| height | number |

---

### `NodeSection`
**Nodo LibreUML:** `Class`

| Atributo | Tipo |
|---|---|
| id | string |
| title | string? |
| collapsible | boolean? |
| collapsed | boolean? |

| Relación | Tipo LibreUML | Mult. | Nota |
|---|---|---|---|
| `NodeSection` ◆──► `NodeSectionItem` | **Composition** | 0..* | |

---

### `NodeSectionItem`
**Nodo LibreUML:** `Class`

| Atributo | Tipo |
|---|---|
| id | string |
| text | string |
| icon | string? |
| isStatic | boolean? |
| isAbstract | boolean? |

---

### `NodeStyleConfig`
**Nodo LibreUML:** `Class`

| Atributo | Tipo |
|---|---|
| containerClass | string |
| headerClass | string |
| badgeColor | string |
| labelFormat | string |
| showStereotype | boolean |

---

### `NodeViewModel`
**Nodo LibreUML:** `Class`

| Atributo | Tipo |
|---|---|
| id | string |
| domainId | string |
| label | string |
| sublabel | string? |
| stereotype | string? |
| badge | string? |

| Relación | Tipo LibreUML | Mult. | Nota |
|---|---|---|---|
| `NodeViewModel` ◆──► `NodeSection` | **Composition** | 0..* | |
| `NodeViewModel` ◆──► `NodeStyleConfig` | **Composition** | 1 | |
| `NodeViewModel` ··► `ClassNode` | **Dependency** | 1 | Se construye a partir del nodo de dominio |

---

### `NoteViewModel`
**Nodo LibreUML:** `Class`

| Atributo | Tipo |
|---|---|
| id | string |
| domainId | string |
| title | string? |
| content | string |

| Relación | Tipo LibreUML | Mult. | Nota |
|---|---|---|---|
| `NoteViewModel` ··► `NoteNode` | **Dependency** | 1 | |

---

### `PackageViewModel`
**Nodo LibreUML:** `Class`

| Atributo | Tipo |
|---|---|
| \_\_brand | 'package' |
| id | string |
| name | string |
| collapsed | boolean |
| color | string? |
| depth | number |

---

### `VFSReactFlowEdge`
**Nodo LibreUML:** `Class`

| Atributo | Tipo |
|---|---|
| id | string |
| source | string |
| target | string |
| type | string |
| sourceHandle | string? |
| targetHandle | string? |

| Relación | Tipo LibreUML | Mult. | Nota |
|---|---|---|---|
| `VFSReactFlowEdge` ··► `IRRelation` | **Dependency** | 1 | data.kind mapea al RelationKind del IR |

---

## Reglas rápidas para elegir la relación en LibreUML

| Situación | Elige en LibreUML |
|---|---|
| TypeScript `class X implements IFace` | **Implementation** |
| TypeScript `interface A extends B` | **Inheritance** |
| Padre posee hijos; si padre muere, hijos mueren | **Composition** |
| Padre referencia hijos; los hijos pueden existir solos | **Aggregation** |
| A referencia B pero no la posee | **Association** |
| A se construye a partir de B (DTO → ViewModel) | **Dependency** |

> **Nota sobre multiplicidad en Records:** `Record<string, X>` equivale a `0..*` hacia X con clave `string`. Modelarlo como una asociación/composición con multiplicidad `0..*` y una nota `«keyed by id»` en la relación.
