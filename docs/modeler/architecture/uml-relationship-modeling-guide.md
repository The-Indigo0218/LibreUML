# LibreUML — Guía de modelado de relaciones

> Fecha: 2026-04-26  
> Propósito: aclarar qué tipo de relación UML corresponde a cada patrón de tipo TypeScript usado en el codebase, resolviendo la ambigüedad del documento `frontend-class-diagram-models.md`.  
> Aplica a: quien vaya a modelar el propio LibreUML **dentro** de LibreUML.

---

## 1. El problema concreto

El documento original dice cosas como:

```
ClassNode → BaseDomainNode   | Herencia         |
ClassNode → Packageable      | Realización (mixin) |
ClassNode → Documentable     | Realización (mixin) |
```

Esto mezcla dos tipos de relación distintos para el mismo patrón, sin explicar por qué. La pregunta válida es: **¿se puede heredar de varias cosas a la vez en UML 2.5.1, y cómo se diagrama?**

---

## 2. Qué dice UML 2.5.1 sobre herencia múltiple

### 2.1 Herencia múltiple de Clases

UML 2.5.1 (ISO/IEC 19505-1:2012, §9.2.3.3) **sí permite** que una Clase generalice de múltiples padres. No hay restricción en el metamodelo. Cada relación de generalización se dibuja como una flecha sólida con triángulo hueco apuntando al padre.

```
        ┌──────────┐     ┌──────────┐
        │  PadreA  │     │  PadreB  │
        └────△─────┘     └────△─────┘
             │                │
             └────────┬───────┘
                   ┌──┴───┐
                   │ Hijo │
                   └──────┘
```

**Sin embargo, esto no es implementable en Java ni C#**, que sólo permiten heredar de una clase concreta/abstracta. Sí es implementable en Python, Scala, C++ y Ruby.

### 2.2 Realización múltiple de Interfaces

Tanto UML como todos los lenguajes principales permiten que una clase **implemente múltiples interfaces**. La relación es **Realization** (flecha discontinua con triángulo hueco):

```
        ┌──────────┐     ┌──────────┐
        │«interface│     │«interface│
        │  IfaceA  │     │  IfaceB  │
        └────△─ ─ ─┘     └────△─ ─ ─┘
             :                :
             └────────┬───────┘
                   ┌──┴───┐
                   │ Hijo │
                   └──────┘
```

---

## 3. Relaciones UML vs TypeScript: tabla de equivalencias

| Patrón TypeScript | Relación UML correcta | Flecha en LibreUML |
|---|---|---|
| `class A extends B` (B es clase concreta o abstracta) | **Generalization** | Sólida + triángulo hueco |
| `class A implements I` (I es interfaz) | **Realization** | Discontinua + triángulo hueco |
| `interface A extends B` (B es interfaz) | **Generalization** sobre interfaz | Sólida + triángulo hueco |
| `type A = B & C` (intersection type) | No tiene equivalente directo UML — modelar como Realization a cada interfaz componente | Ver §4 |
| `class A extends B implements I1, I2` | Una Generalization (→B) + dos Realization (→I1, →I2) | Flecha sólida + dos discontinuas |

---

## 4. Corrección de `frontend-class-diagram-models.md`

### 4.1 `BaseDomainNode`, `Packageable`, `Documentable`

En el código TypeScript, los tres son declarados como **`interface`**:

```typescript
// src/core/domain/models/nodes/base.types.ts
export interface BaseDomainNode { … }   // interfaz
export interface Packageable    { … }   // mixin / interfaz
export interface Documentable   { … }   // mixin / interfaz
```

Consecuencia: la relación desde `ClassNode` (y todos los demás nodos concretos) hacia **los tres** debe ser **Realization**, no Generalization.

| Relación en el doc original | Corrección |
|---|---|
| `ClassNode → BaseDomainNode` — "Herencia" ❌ | **Realization** — BaseDomainNode es `interface` |
| `ClassNode → Packageable` — "Realización (mixin)" ✅ | Correcto |
| `ClassNode → Documentable` — "Realización (mixin)" ✅ | Correcto |

**Cómo diagramarlo en LibreUML:**

1. Colocar `BaseDomainNode`, `Packageable` y `Documentable` como nodos de tipo `«interface»`.
2. Usar la relación **Implementation (Realization)** desde cada nodo concreto hacia cada interfaz.
3. Resultado: 3 flechas discontinuas con triángulo hueco saliendo de `ClassNode`.

### 4.2 `BaseDomainEdge`, `Multiplicable`, `Labelable`

Igual que el caso anterior: en TypeScript los tres son `interface`. Todas las aristas concretas (`AssociationEdge`, etc.) deben usar **Realization** hacia los tres.

El doc original las llama correctamente "Realización (mixin)" para `Multiplicable` y `Labelable`, pero llama "Herencia" a la relación con `BaseDomainEdge`. Debe corregirse por **Realization**.

### 4.3 `IRClass`, `IRInterface`, `IREnum`, `IRPackage`, `IRAttribute`, `IROperation` → `IRElement`

Aquí aplica la misma pregunta. En el código:

```typescript
// src/core/domain/vfs/vfs.types.ts
export interface IRElement { … }   // interfaz base del IR
export interface IRClass extends IRElement { … }
```

`extends` entre interfaces es **Generalization** en UML (una interfaz que generaliza otra interfaz). Esto es correcto tal como está en el doc.

**Regla de oro:** `interface extends interface` → Generalization. `class/interface implements interface` → Realization.

### 4.4 `VFSFolder`, `VFSFile` → `VFSBaseNode`

```typescript
export interface VFSBaseNode { … }
export interface VFSFolder extends VFSBaseNode { … }
export interface VFSFile   extends VFSBaseNode { … }
```

Todas interfaces → relación: **Generalization** (interfaz hereda de interfaz). El doc dice "Herencia" que en este contexto es técnicamente correcto, aunque lo más preciso sería "Generalization sobre interfaz".

---

## 5. Compatibilidad por lenguaje

Cuando LibreUML genere código desde un diagrama que usa estas relaciones, aplican las siguientes restricciones:

| Escenario | UML 2.5.1 | Java | C# | Python | TypeScript |
|---|:---:|:---:|:---:|:---:|:---:|
| Una clase hereda una clase | ✅ | ✅ | ✅ | ✅ | ✅ |
| Una clase hereda **múltiples** clases | ✅ | ❌ | ❌ | ✅ | ❌* |
| Una clase realiza una interfaz | ✅ | ✅ | ✅ | ✅ | ✅ |
| Una clase realiza **múltiples** interfaces | ✅ | ✅ | ✅ | ✅ | ✅ |
| Una interfaz generaliza una interfaz | ✅ | ✅ | ✅ | ✅ | ✅ |
| Una interfaz generaliza **múltiples** interfaces | ✅ | ✅ | ✅ | ✅ | ✅ |

\* TypeScript: una clase sólo puede `extends` una clase, pero puede `implements` múltiples interfaces.

**Implicación práctica:** si el diagrama del codebase de LibreUML usa correctamente `Realization` para `BaseDomainNode`, `Packageable` y `Documentable`, el modelo es **100% compatible** con Java y C# — no hay herencia múltiple de clases.

---

## 6. Cómo modelar el patrón "mixin de interfaz" en LibreUML

### Nodo visual

- Tipo: **Interface** (aparece con el estereotipo `«interface»` en la cabecera del nodo)
- Para `Packageable` y `Documentable`: considerar añadir el estereotipo adicional `«mixin»` en el campo de estereotipo del editor

### Relación visual

- Relación: **Implementation (Realization)**
- Apariencia: línea **discontinua** con triángulo **hueco** apuntando a la interfaz
- No usar Generalization (línea sólida) salvo entre interfaces o entre clases concretas/abstractas

### Ejemplo completo para `ClassNode`

```
«interface»          «interface»          «interface»
BaseDomainNode       Packageable          Documentable
     △                   △                    △
     : - - - - - - - - - : - - - - - - - - -  :
                         |
                    ┌────┴─────┐
                    │ClassNode │
                    │ type='CLASS' │
                    │ name: string │
                    │ …           │
                    └────────────┘
```

---

## 7. Campos desactualizados en `frontend-class-diagram-models.md`

El documento fue generado el 2026-04-25; desde entonces se realizaron cambios relevantes:

| Campo en el doc | Estado | Corrección |
|---|---|---|
| `SettingsState.showGrid: boolean` | ❌ Eliminado | Reemplazado por `gridType: 'none'\|'dots'\|'lines'\|'grid'` |
| `SettingsState` sin `viewportCulling` | ❌ Incompleto | Añadir `viewportCulling: boolean`, `suppressCullingWarning: boolean` |
| `ViewportControlStore` — sólo `zoomIn, zoomOut, fitView` | ❌ Incompleto | Añadir `panTo: (worldCx, worldCy) => void` |
| `UiStoreState` — sin `anchorSnapshot` | ❌ Incompleto | Añadir `anchorSnapshot: AnchorSnapshot \| null` |
| `ViewEdge` — sin `anchorLocked` | ❌ Incompleto | Añadir `anchorLocked?: boolean` (ya está en el doc de VFS pero no en la sección ViewEdge del workspace) |

---

## 8. Resumen de decisiones de diseño

| Decisión | Razón |
|---|---|
| `BaseDomainNode`, `Packageable`, `Documentable` → modelar como `«interface»` + Realization | Son TypeScript `interface`, no clases abstractas |
| NO usar Generalization múltiple de clases en el modelo del codebase | Compatibilidad con Java/C# en generación de código |
| Usar Realization para toda relación clase→interfaz | Semántica correcta UML 2.5.1 |
| `interface extends interface` → Generalization (no Realization) | UML 2.5.1 §7.3.45: las interfaces pueden generalizarse entre sí |
| Los mixins sin estado (`Packageable`, `Documentable`) pueden llevar estereotipo `«mixin»` | Comunica la intención sin romper la semántica UML |
