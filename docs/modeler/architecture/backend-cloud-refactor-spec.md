# LibreUML — Backend Cloud Refactor Specification
**Versión:** 1.0.0  
**Fecha:** 2026-04-20  
**Autor:** LibreUML Core Team  
**Estado:** Pendiente de implementación

---

## Índice

1. [Contexto y problema actual](#1-contexto-y-problema-actual)
2. [Arquitectura objetivo](#2-arquitectura-objetivo)
3. [Schema de base de datos](#3-schema-de-base-de-datos)
4. [Contrato de API completo](#4-contrato-de-api-completo)
5. [Reglas de negocio y SSOT](#5-reglas-de-negocio-y-ssot)
6. [Matriz de triggers de sincronización](#6-matriz-de-triggers-de-sincronización)
7. [Plan de migración](#7-plan-de-migración)
8. [Checklist de validación](#8-checklist-de-validación)

---

## 1. Contexto y problema actual

### Estado actual

El sistema guarda proyectos completos bajo el endpoint `/api/v1/diagrams`, tratando cada proyecto como si fuera un único diagrama. El payload enviado tiene la siguiente forma:

```json
POST /api/v1/diagrams
{
  "title": "Mi Proyecto",
  "type": "CLASS",
  "content": {
    "project": { "...todo el árbol VFS con TODOS los diagramas..." },
    "model":   { "...SemanticModel completo con clases, relaciones, etc..." }
  }
}
```

### Problemas críticos

| Problema | Impacto |
|---|---|
| Un proyecto con 8 diagramas reescribe el JSON completo (~750 KB) ante cualquier cambio mínimo | Ancho de banda y cómputo innecesario |
| El campo `type` solo acepta un tipo de diagrama (`CLASS`, `SEQUENCE`, etc.) — no existe el concepto de proyecto multi-diagrama | Error arquitectural: un proyecto con clase + use case no cabe en el modelo |
| El listado de proyectos del usuario requiere deserializar el JSON completo para obtener el nombre | Consultas lentas, escalabilidad nula |
| El optimistic locking es global — un conflicto en el canvas de clases bloquea la edición del modelo de use cases | Experiencia de usuario degradada |

### Objetivo

Reemplazar el endpoint `/diagrams` por una arquitectura de **3 recursos independientes**:
- `projects` — metadatos del proyecto
- `project_models` — modelo semántico compartido (clases, relaciones, paquetes, etc.)
- `diagrams` — vista canvas de cada diagrama (posiciones, colores, waypoints)

Cada recurso tiene su propio ciclo de vida, versión de optimistic locking y endpoint de actualización.

---

## 2. Arquitectura objetivo

```
┌──────────────────────────────────────────────────────────────────────┐
│                            projects                                  │
│  id │ owner_id │ name │ description │ target_language │ base_package │
│     │          │      │ author      │ version         │ updated_at   │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ 1
              ─────────────────┴──────────────────────────
              │                                           │
              │ 1                                         │ N
 ┌────────────▼──────────────┐           ┌───────────────▼─────────────┐
 │      project_models       │           │           diagrams           │
 │  id │ project_id (FK)     │           │  id │ project_id (FK)       │
 │  model_data (JSONB)       │           │  name │ diagram_type        │
 │  version │ updated_at     │           │  path │ view_data (JSONB)   │
 └───────────────────────────┘           │  version │ updated_at       │
                                         │  created_at                 │
                                         └─────────────────────────────┘
```

### Principio de separación

- **`projects`**: solo metadatos del proyecto (nombre, descripción, lenguaje, etc.). Nunca contiene datos de diagramas ni modelo.
- **`project_models`**: el `SemanticModel` completo. Uno por proyecto. Es el SSOT (Single Source of Truth) de todos los elementos UML: clases, interfaces, enums, actores, relaciones, paquetes, etc.
- **`diagrams`**: solo la vista visual (`view_data`). Contiene posiciones de nodos en canvas, colores, waypoints de aristas, estado collapsed/expanded. **No contiene definiciones de clases ni relaciones** — solo referencias a IDs del modelo semántico.

---

## 3. Schema de base de datos

### Tabla `projects`

```sql
CREATE TABLE projects (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name             VARCHAR(255)  NOT NULL,
  description      TEXT,
  author           VARCHAR(255),
  project_version  VARCHAR(50)   NOT NULL DEFAULT '1.0.0',
  target_language  VARCHAR(50),
  base_package     VARCHAR(255),
  visibility       VARCHAR(20)   NOT NULL DEFAULT 'PRIVATE'
                                 CHECK (visibility IN ('PRIVATE', 'SHARED', 'PUBLIC')),
  vfs_snapshot     JSONB,        -- VFS tree structure WITHOUT viewData (folder hierarchy, file metadata)
  version          BIGINT        NOT NULL DEFAULT 1,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
-- ADDENDUM (frontend implementation): vfs_snapshot stores the LibreUMLProject
-- serialized WITHOUT each VFSFile.content (which lives in diagrams.view_data).
-- Required to reconstruct the full folder/file tree when loading a project.
-- Include in GET /projects/{id} and GET /projects/{id}/full responses as vfsSnapshot.

CREATE INDEX idx_projects_owner_id ON projects(owner_id);
CREATE INDEX idx_projects_updated_at ON projects(owner_id, updated_at DESC);
```

### Tabla `project_models`

```sql
CREATE TABLE project_models (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  model_data   JSONB       NOT NULL DEFAULT '{}',
  version      BIGINT      NOT NULL DEFAULT 1,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_project_models_project UNIQUE (project_id)
);

CREATE INDEX idx_project_models_project_id ON project_models(project_id);
-- Índices GIN para consultas dentro del JSON si se requiere en el futuro
CREATE INDEX idx_project_models_data ON project_models USING GIN (model_data);
```

### Tabla `diagrams`

```sql
CREATE TABLE diagrams (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name         VARCHAR(255) NOT NULL,
  diagram_type VARCHAR(50) NOT NULL
                           CHECK (diagram_type IN (
                             'CLASS', 'USE_CASE', 'SEQUENCE', 'ACTIVITY',
                             'STATE', 'COMPONENT', 'DEPLOYMENT', 'PACKAGE',
                             'OBJECT', 'UNSPECIFIED'
                           )),
  path         VARCHAR(500),           -- Ruta lógica: "/src/domain/Dominio.luml"
  view_data    JSONB       NOT NULL DEFAULT '{}',
  version      BIGINT      NOT NULL DEFAULT 1,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_diagrams_project_id ON diagrams(project_id);
CREATE INDEX idx_diagrams_type ON diagrams(project_id, diagram_type);
```

### Trigger: `updated_at` automático

```sql
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_project_models_updated_at
  BEFORE UPDATE ON project_models
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_diagrams_updated_at
  BEFORE UPDATE ON diagrams
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

---

## 4. Contrato de API completo

**Base URL:** `/api/v1`  
**Autenticación:** Bearer token en header `Authorization`  
**Content-Type:** `application/json`

---

### 4.1 Proyectos — `/projects`

#### `GET /projects`
Lista los proyectos del usuario autenticado. **No incluye model_data ni view_data.**

**Query params:**
| Param | Tipo | Default | Descripción |
|---|---|---|---|
| `page` | int | 0 | Página (0-indexed) |
| `size` | int | 20 | Elementos por página |
| `sort` | string | `updatedAt,desc` | Campo y dirección |

**Response 200:**
```json
{
  "content": [
    {
      "id": "uuid",
      "name": "Sistema de Facturación",
      "description": "Módulo de pagos y facturación",
      "author": "IndigoDev",
      "projectVersion": "1.0.0",
      "targetLanguage": "java",
      "basePackage": "com.example.billing",
      "visibility": "PRIVATE",
      "version": 5,
      "diagramCount": 4,
      "diagramTypes": ["CLASS", "USE_CASE", "SEQUENCE", "PACKAGE"],
      "createdAt": "2026-04-20T10:00:00Z",
      "updatedAt": "2026-04-20T14:32:00Z"
    }
  ],
  "totalElements": 12,
  "totalPages": 1,
  "page": 0,
  "size": 20
}
```

> **Nota:** `diagramCount` y `diagramTypes` se calculan con un JOIN a la tabla `diagrams`. No cargan `view_data`.

---

#### `POST /projects`
Crea un proyecto vacío. El backend crea automáticamente el `project_models` vacío asociado.

**Request body:**
```json
{
  "name": "Nuevo Proyecto",
  "description": "Descripción opcional",
  "author": "IndigoDev",
  "projectVersion": "1.0.0",
  "targetLanguage": "java",
  "basePackage": "com.example"
}
```

**Response 201:**
```json
{
  "id": "uuid-del-proyecto",
  "modelId": "uuid-del-model",
  "version": 1,
  "createdAt": "2026-04-20T10:00:00Z"
}
```

> El backend debe crear el registro en `project_models` con `model_data = {}` en la misma transacción.

---

#### `GET /projects/{projectId}`
Carga los metadatos del proyecto con el resumen de diagramas. **No incluye model_data ni view_data.**

**Response 200:**
```json
{
  "id": "uuid",
  "name": "Sistema de Facturación",
  "description": "...",
  "author": "IndigoDev",
  "projectVersion": "1.0.0",
  "targetLanguage": "java",
  "basePackage": "com.example",
  "visibility": "PRIVATE",
  "version": 5,
  "diagrams": [
    {
      "id": "diag-uuid-1",
      "name": "Modelo de Dominio",
      "diagramType": "CLASS",
      "path": "/src/domain/Dominio.luml",
      "version": 12,
      "updatedAt": "2026-04-20T14:00:00Z"
    },
    {
      "id": "diag-uuid-2",
      "name": "Casos de Uso",
      "diagramType": "USE_CASE",
      "path": "/src/requirements/UseCases.luml",
      "version": 3,
      "updatedAt": "2026-04-20T11:00:00Z"
    }
  ],
  "createdAt": "2026-04-20T10:00:00Z",
  "updatedAt": "2026-04-20T14:32:00Z"
}
```

---

#### `PATCH /projects/{projectId}`
Actualiza **solo los metadatos** del proyecto (nombre, descripción, etc.). No toca model ni diagramas.

**Request body:**
```json
{
  "name": "Nuevo Nombre",
  "description": "Nueva descripción",
  "targetLanguage": "kotlin",
  "version": 5
}
```

> **Optimistic locking:** Si `version` no coincide con el valor en DB, retornar `409 Conflict`.

**Response 200:**
```json
{
  "id": "uuid",
  "version": 6,
  "updatedAt": "2026-04-20T15:00:00Z"
}
```

**Response 409:**
```json
{
  "error": "CONFLICT",
  "message": "El proyecto fue modificado por otra sesión.",
  "serverVersion": 7
}
```

---

#### `DELETE /projects/{projectId}`
Elimina el proyecto. El CASCADE en FK borra automáticamente `project_models` y todos los `diagrams`.

**Response 204:** No content.

---

### 4.2 Modelo Semántico — `/projects/{projectId}/model`

#### `GET /projects/{projectId}/model`
Carga el `SemanticModel` completo del proyecto.

**Response 200:**
```json
{
  "id": "model-uuid",
  "projectId": "project-uuid",
  "data": {
    "id": "model-uuid",
    "name": "Domain Model",
    "version": "1.0.0",
    "packages":        { "pkg-1": { "kind": "PACKAGE", "id": "pkg-1", "name": "com.example", "parentId": null } },
    "classes":         { "cls-1": { "kind": "CLASS", "id": "cls-1", "name": "User", "packageId": "pkg-1", "attributeIds": ["attr-1"], "operationIds": ["op-1"] } },
    "interfaces":      {},
    "enums":           {},
    "dataTypes":       {},
    "attributes":      { "attr-1": { "kind": "ATTRIBUTE", "id": "attr-1", "name": "id", "type": "Long", "visibility": "PRIVATE" } },
    "operations":      { "op-1":   { "kind": "OPERATION", "id": "op-1", "name": "getId", "returnType": "Long", "parameters": [] } },
    "actors":          {},
    "useCases":        {},
    "activityNodes":   {},
    "objectInstances": {},
    "components":      {},
    "nodes":           {},
    "artifacts":       {},
    "relations":       { "rel-1": { "id": "rel-1", "kind": "GENERALIZATION", "sourceId": "cls-1", "targetId": "cls-2" } },
    "packageNames":    ["com.example"],
    "createdAt":       1713607200000,
    "updatedAt":       1713607200000
  },
  "version": 12,
  "updatedAt": "2026-04-20T14:00:00Z"
}
```

---

#### `PATCH /projects/{projectId}/model`
Reemplaza el `model_data` completo. El frontend envía el `SemanticModel` serializado.

**Request body:**
```json
{
  "data": {
    "id": "model-uuid",
    "name": "Domain Model",
    "classes": { "...": "..." },
    "relations": { "...": "..." },
    "...": "todos los campos del SemanticModel"
  },
  "version": 12
}
```

> **Optimistic locking:** Si `version` no coincide, retornar `409 Conflict`.  
> **Quota check:** Si el tamaño del payload supera la cuota del usuario, retornar `422`.

**Response 200:**
```json
{
  "id": "model-uuid",
  "version": 13,
  "updatedAt": "2026-04-20T15:00:00Z"
}
```

**Response 409:**
```json
{
  "error": "CONFLICT",
  "message": "El modelo fue modificado por otra sesión.",
  "serverVersion": 15,
  "serverData": { "...SemanticModel del servidor..." }
}
```

> En el 409 del modelo, incluir `serverData` para que el frontend pueda presentar el dialog de resolución de conflictos con diff.

**Response 422:**
```json
{
  "error": "QUOTA_EXCEEDED",
  "message": "Cuota de almacenamiento superada.",
  "used": 5100000,
  "quota": 5242880
}
```

---

### 4.3 Diagramas — `/projects/{projectId}/diagrams`

#### `GET /projects/{projectId}/diagrams`
Lista los diagramas del proyecto **sin** `view_data` (solo metadatos).

**Response 200:**
```json
[
  {
    "id": "diag-uuid-1",
    "projectId": "project-uuid",
    "name": "Modelo de Dominio",
    "diagramType": "CLASS",
    "path": "/src/domain/Dominio.luml",
    "version": 12,
    "createdAt": "2026-04-20T10:00:00Z",
    "updatedAt": "2026-04-20T14:00:00Z"
  }
]
```

---

#### `POST /projects/{projectId}/diagrams`
Crea un diagrama nuevo dentro del proyecto.

**Request body:**
```json
{
  "name": "Diagrama de Clases Principal",
  "diagramType": "CLASS",
  "path": "/src/domain/Dominio.luml",
  "viewData": {
    "nodes": [],
    "edges": []
  }
}
```

**Response 201:**
```json
{
  "id": "diag-uuid-nuevo",
  "projectId": "project-uuid",
  "version": 1,
  "createdAt": "2026-04-20T10:00:00Z"
}
```

---

#### `GET /projects/{projectId}/diagrams/{diagramId}`
Carga un diagrama con su `view_data` completo.

**Response 200:**
```json
{
  "id": "diag-uuid-1",
  "projectId": "project-uuid",
  "name": "Modelo de Dominio",
  "diagramType": "CLASS",
  "path": "/src/domain/Dominio.luml",
  "viewData": {
    "nodes": [
      {
        "id": "vnode-1",
        "elementId": "cls-1",
        "x": 120,
        "y": 80,
        "width": 160,
        "height": 120,
        "collapsed": false,
        "color": null,
        "parentPackageId": "pkg-1"
      }
    ],
    "edges": [
      {
        "id": "vedge-1",
        "relationId": "rel-1",
        "waypoints": [{ "x": 200, "y": 140 }, { "x": 400, "y": 140 }],
        "anchorLocked": false
      }
    ]
  },
  "version": 12,
  "createdAt": "2026-04-20T10:00:00Z",
  "updatedAt": "2026-04-20T14:00:00Z"
}
```

---

#### `PATCH /projects/{projectId}/diagrams/{diagramId}`
Actualiza **solo** la vista canvas de un diagrama. No toca el modelo semántico.

**Request body:**
```json
{
  "name": "Nuevo Nombre Diagrama",
  "viewData": {
    "nodes": [{ "...nodos actualizados..." }],
    "edges": [{ "...aristas actualizadas..." }]
  },
  "version": 12
}
```

> `name` es opcional. `viewData` es opcional. Al menos uno debe estar presente.  
> **Optimistic locking:** Si `version` no coincide, retornar `409 Conflict`.

**Response 200:**
```json
{
  "id": "diag-uuid-1",
  "version": 13,
  "updatedAt": "2026-04-20T15:00:00Z"
}
```

**Response 409:**
```json
{
  "error": "CONFLICT",
  "message": "El diagrama fue modificado por otra sesión.",
  "serverVersion": 14
}
```

---

#### `DELETE /projects/{projectId}/diagrams/{diagramId}`
Elimina un diagrama. El modelo semántico **no se modifica** — las clases y relaciones siguen existiendo.

**Response 204:** No content.

---

### 4.4 Carga inicial del proyecto (batch load)

Para evitar múltiples round-trips al abrir un proyecto, se expone un endpoint de carga completa:

#### `GET /projects/{projectId}/full`
Retorna metadatos + modelo + todos los diagramas en una sola llamada.

**Response 200:**
```json
{
  "project": {
    "id": "uuid",
    "name": "Sistema de Facturación",
    "...metadatos..."
  },
  "model": {
    "id": "model-uuid",
    "data": { "...SemanticModel completo..." },
    "version": 12
  },
  "diagrams": [
    {
      "id": "diag-uuid-1",
      "name": "Modelo de Dominio",
      "diagramType": "CLASS",
      "path": "/src/domain/Dominio.luml",
      "viewData": { "nodes": [...], "edges": [...] },
      "version": 12
    },
    {
      "id": "diag-uuid-2",
      "name": "Casos de Uso",
      "diagramType": "USE_CASE",
      "path": "/src/requirements/UseCases.luml",
      "viewData": { "nodes": [...], "edges": [...] },
      "version": 3
    }
  ]
}
```

---

### 4.5 Quota

#### `GET /users/me/quota`
Sin cambios. La cuota aplica por usuario y se calcula sumando el tamaño de `model_data` y `view_data` de todos sus proyectos.

**Response 200:**
```json
{
  "quota": 5242880,
  "used": 1048576,
  "available": 4194304,
  "breakdown": {
    "models": 786432,
    "diagrams": 262144
  }
}
```

---

## 5. Reglas de negocio y SSOT

### 5.1 El SemanticModel es el SSOT

El **SemanticModel** (`project_models.model_data`) es la única fuente de verdad para todos los elementos UML del proyecto:

- Clases, interfaces, enums, actores, casos de uso
- Todos los atributos y operaciones
- Todas las relaciones (herencia, asociación, composición, etc.)
- Todos los paquetes y su jerarquía

El `view_data` de cada diagrama contiene **solo referencias** (`elementId`, `relationId`) a elementos del modelo más datos visuales (`x`, `y`, `color`, `waypoints`). **Nunca define el elemento en sí.**

```
SemanticModel (projects_models)          DiagramView (diagrams.view_data)
────────────────────────────────         ──────────────────────────────────
IRClass { id: "cls-1",                   ViewNode { elementId: "cls-1",
  name: "User",               ◄──ref──     x: 120, y: 80, color: null }
  packageId: "pkg-1",
  attributeIds: [...] }
```

### 5.2 Consistencia entre diagramas

Cuando una clase cambia de paquete (operación en el canvas de clases):

1. El frontend actualiza `IRClass.packageId` en el `model.store` (SemanticModel en memoria)
2. El diagrama de paquetes lee del mismo store en tiempo real → se actualiza automáticamente en el canvas sin ninguna llamada a la nube
3. A los 30 segundos (debounce), el frontend llama `PATCH /projects/{id}/model` con el nuevo SemanticModel
4. **No se requiere sincronizar el diagrama de paquetes por separado** — su `view_data` no contiene definición de pertenencia, solo posiciones visuales

> **Regla:** La consistencia entre diagramas es responsabilidad del SemanticModel. El backend no necesita validar referencias cruzadas entre diagramas.

### 5.3 Diagrama eliminado vs. elementos del modelo

Al eliminar un diagrama (`DELETE /projects/{id}/diagrams/{diagramId}`):
- El `view_data` del diagrama se elimina
- Las clases/relaciones en el `model_data` que eran visibles en ese diagrama **permanecen intactas** en el SemanticModel
- Es responsabilidad del frontend decidir si el usuario quiere también eliminar los elementos del modelo

### 5.4 Quota por proyecto

La cuota se mide por el tamaño serializado de:
- `project_models.model_data` del proyecto
- Suma de `diagrams.view_data` de todos los diagramas del proyecto

Límites (sin cambios respecto al sistema actual):
- Cuota total: **5 MB por usuario** (`5_242_880` bytes)
- Hard threshold: **95%** → bloquear saves
- Alert threshold: **90%** → mostrar advertencia
- Warning threshold: **70%** → mostrar indicador

---

## 6. Matriz de triggers de sincronización

Esta tabla define qué operación del frontend dispara qué llamada al backend.

| Acción del usuario | Qué cambia en el store | Endpoint backend | Payload |
|---|---|---|---|
| Renombrar proyecto | `project.projectName` | `PATCH /projects/{id}` | Solo metadatos |
| Cambiar lenguaje objetivo | `project.targetLanguage` | `PATCH /projects/{id}` | Solo metadatos |
| Agregar clase desde sidebar | `model.classes[newId]` | `PATCH /projects/{id}/model` | SemanticModel completo |
| Agregar atributo a clase | `model.attributes[newId]`, `model.classes[id].attributeIds` | `PATCH /projects/{id}/model` | SemanticModel completo |
| Eliminar clase | `model.classes`, `model.relations` | `PATCH /projects/{id}/model` | SemanticModel completo |
| Agregar relación de herencia | `model.relations[newId]` | `PATCH /projects/{id}/model` | SemanticModel completo |
| Mover clase a otro paquete | `model.classes[id].packageId` | `PATCH /projects/{id}/model` | SemanticModel completo |
| Mover nodo en canvas (drag) | `diagram.viewData.nodes[n].x/y` | `PATCH /projects/{id}/diagrams/{diagramId}` | Solo `view_data` del diagrama activo |
| Colapsar clase en canvas | `diagram.viewData.nodes[n].collapsed` | `PATCH /projects/{id}/diagrams/{diagramId}` | Solo `view_data` del diagrama activo |
| Cambiar color de nodo | `diagram.viewData.nodes[n].color` | `PATCH /projects/{id}/diagrams/{diagramId}` | Solo `view_data` del diagrama activo |
| Ajustar waypoint de arista | `diagram.viewData.edges[n].waypoints` | `PATCH /projects/{id}/diagrams/{diagramId}` | Solo `view_data` del diagrama activo |
| Crear nuevo diagrama | VFS: nuevo `VFSFile` + nuevo `DiagramView` vacío | `POST /projects/{id}/diagrams` | Metadatos + viewData vacío |
| Eliminar diagrama | VFS: eliminar `VFSFile` | `DELETE /projects/{id}/diagrams/{diagramId}` | — |
| Renombrar diagrama | VFS: `VFSFile.name` | `PATCH /projects/{id}/diagrams/{diagramId}` | Solo `name` |
| Clase cambia de paquete → reflejo en diagrama de paquetes | `model.classes[id].packageId` (mismo cambio) | `PATCH /projects/{id}/model` | SemanticModel completo — el diagrama de paquetes NO necesita sync separado porque lee del store en tiempo real |

### Reglas del debounce (30 segundos)

- Cada recurso tiene su propio timer de debounce independiente
- Si el modelo cambia 5 veces en 30s, se envía **una sola** llamada al final
- Si el modelo Y el canvas del diagrama de clases cambian en la misma ventana de 30s, se envían **dos** llamadas paralelas independientes
- Un conflicto en el modelo no bloquea la sincronización del canvas de un diagrama

---

## 7. Plan de migración

### 7.1 Datos existentes en `/diagrams`

Los proyectos ya guardados bajo el endpoint `/diagrams` tienen la estructura:
```json
{
  "content": {
    "project": { "...LibreUMLProject con VFS tree..." },
    "model":   { "...SemanticModel..." }
  }
}
```

### 7.2 Script de migración

```sql
-- Paso 1: Para cada registro en diagrams (viejo), crear un proyecto
INSERT INTO projects (id, owner_id, name, project_version, created_at, updated_at)
SELECT 
  (content->>'project'->>'id')::uuid,
  owner_id,
  title,
  COALESCE(content->'project'->>'version', '1.0.0'),
  created_at,
  updated_at
FROM legacy_diagrams;

-- Paso 2: Crear project_models desde el model embebido
INSERT INTO project_models (project_id, model_data)
SELECT 
  (content->>'project'->>'id')::uuid,
  content->'model'
FROM legacy_diagrams;

-- Paso 3: Crear diagramas individuales desde cada VFSFile del árbol
-- (requiere lógica de aplicación para iterar los nodos del VFS tree)
```

> **Nota:** El Paso 3 requiere código de aplicación (Java/Kotlin/Node) para iterar `content.project.nodes` y crear un registro por cada `VFSFile` con `type = 'FILE'`.

### 7.3 Estrategia frontend de migración

El frontend detecta `syncStore.cloudDiagramId` (formato antiguo) vs `syncStore.cloudProjectId` (formato nuevo):

1. Si existe `cloudDiagramId` y no `cloudProjectId`: mostrar banner "Actualizar formato de guardado en la nube"
2. Al confirmar: hacer `GET /diagrams/{cloudDiagramId}` (endpoint legacy), extraer el payload, y hacer `POST /projects` con la nueva estructura
3. Guardar el nuevo `cloudProjectId`, limpiar `cloudDiagramId`

---

## 8. Checklist de validación

Una vez implementado, verificar cada ítem antes de marcar como completo.

### 8.1 Base de datos

- [ ] **DB-01** La tabla `projects` existe con todos los campos definidos en la sección 3
- [ ] **DB-02** La tabla `project_models` existe con constraint `UNIQUE (project_id)`
- [ ] **DB-03** La tabla `diagrams` existe con el CHECK constraint en `diagram_type`
- [ ] **DB-04** Las FK de `project_models.project_id` y `diagrams.project_id` tienen `ON DELETE CASCADE`
- [ ] **DB-05** Los triggers `set_updated_at` están activos en las 3 tablas
- [ ] **DB-06** Al eliminar un proyecto, se eliminan en cascada su `project_models` y todos sus `diagrams`
- [ ] **DB-07** Los índices están creados en `owner_id`, `project_id`, y `updated_at`
- [ ] **DB-08** Un proyecto puede tener múltiples diagramas de diferentes tipos simultáneamente

### 8.2 Endpoints de proyectos

- [ ] **API-P01** `GET /projects` retorna lista paginada sin `model_data` ni `view_data`
- [ ] **API-P02** `GET /projects` incluye `diagramCount` y `diagramTypes` calculados dinámicamente
- [ ] **API-P03** `POST /projects` crea el proyecto Y el `project_models` vacío en la misma transacción
- [ ] **API-P04** `GET /projects/{id}` retorna metadatos + lista de diagramas (sin view_data ni model_data)
- [ ] **API-P05** `PATCH /projects/{id}` acepta y persiste `vfsSnapshot` (estructura VFS sin viewData)
- [ ] **API-P05b** `GET /projects/{id}` y `GET /projects/{id}/full` incluyen `vfsSnapshot` en la respuesta
- [ ] **API-P06** `PATCH /projects/{id}` con version incorrecta retorna `409` con `serverVersion`
- [ ] **API-P07** `DELETE /projects/{id}` retorna `204` y elimina en cascada todos los recursos hijos
- [ ] **API-P08** Todos los endpoints de proyecto validan que `owner_id` corresponde al usuario autenticado (403 si no)

### 8.3 Endpoints del modelo semántico

- [ ] **API-M01** `GET /projects/{id}/model` retorna el `model_data` completo con su `version`
- [ ] **API-M02** `PATCH /projects/{id}/model` reemplaza `model_data` completo
- [ ] **API-M03** `PATCH /projects/{id}/model` con version incorrecta retorna `409` con `serverVersion` Y `serverData`
- [ ] **API-M04** `PATCH /projects/{id}/model` que supera la cuota retorna `422` con breakdown de uso
- [ ] **API-M05** `PATCH /projects/{id}/model` actualiza `updated_at` del proyecto padre (para ordenamiento en listado)
- [ ] **API-M06** `PATCH /projects/{id}/model` que pertenece a otro usuario retorna `403`

### 8.4 Endpoints de diagramas

- [ ] **API-D01** `GET /projects/{id}/diagrams` retorna lista sin `view_data`
- [ ] **API-D02** `POST /projects/{id}/diagrams` crea diagrama con `view_data` inicial
- [ ] **API-D03** `GET /projects/{id}/diagrams/{diagId}` retorna `view_data` completo
- [ ] **API-D04** `PATCH /projects/{id}/diagrams/{diagId}` acepta `name` y/o `viewData` (al menos uno)
- [ ] **API-D05** `PATCH /projects/{id}/diagrams/{diagId}` con version incorrecta retorna `409`
- [ ] **API-D06** `DELETE /projects/{id}/diagrams/{diagId}` retorna `204` y **no modifica** `project_models`
- [ ] **API-D07** Un proyecto puede tener dos diagramas del mismo tipo (ej: dos `CLASS`) simultáneamente
- [ ] **API-D08** `PATCH .../diagrams/{diagId}` actualiza `updated_at` del proyecto padre

### 8.5 Endpoint de carga completa

- [ ] **API-F01** `GET /projects/{id}/full` retorna proyecto + modelo + todos los diagramas con view_data
- [ ] **API-F02** `GET /projects/{id}/full` es una sola query con JOINs (no N+1 queries)
- [ ] **API-F03** Si el proyecto no tiene diagramas, `diagrams` es un array vacío (no null)

### 8.6 Quota

- [ ] **API-Q01** `GET /users/me/quota` calcula `used` sumando `model_data` + todos los `view_data` del usuario
- [ ] **API-Q02** El campo `breakdown` distingue entre uso en modelos y uso en diagramas
- [ ] **API-Q03** El check de cuota se ejecuta **antes** de escribir en DB, no después

### 8.7 Consistencia y reglas de negocio

- [ ] **BIZ-01** El backend **no valida** referencias cruzadas entre `elementId` en `view_data` y elementos en `model_data` — esto es responsabilidad del frontend
- [ ] **BIZ-02** Eliminar un diagrama no elimina las clases/relaciones del modelo semántico
- [ ] **BIZ-03** Un `PATCH /model` no modifica ningún `diagrams.view_data` — son recursos independientes
- [ ] **BIZ-04** El `version` de optimistic locking es por recurso: el modelo tiene su propio version, cada diagrama tiene el suyo
- [ ] **BIZ-05** Dos sesiones simultáneas editando el mismo proyecto no generan corrupción de datos (el optimistic locking lo previene)

### 8.8 Seguridad

- [ ] **SEC-01** Todos los endpoints requieren autenticación (401 si no hay token)
- [ ] **SEC-02** Un usuario no puede acceder a proyectos de otro usuario (403)
- [ ] **SEC-03** Un usuario no puede acceder a diagramas de un proyecto que no le pertenece (403)
- [ ] **SEC-04** `GET /projects/{id}` con proyecto de visibilidad `PRIVATE` de otro usuario retorna `403`, no `404`
- [ ] **SEC-05** El `owner_id` nunca puede ser sobrescrito por el cliente (ignorar si viene en el body)

### 8.9 Migración

- [ ] **MIG-01** El script de migración corre sin errores en un dump de producción
- [ ] **MIG-02** Todos los proyectos migrados tienen exactamente un registro en `project_models`
- [ ] **MIG-03** Los diagramas migrados conservan los mismos `id` de VFSFile del árbol VFS original
- [ ] **MIG-04** El endpoint legacy `GET /diagrams/{id}` permanece activo durante el período de migración del frontend
- [ ] **MIG-05** El endpoint legacy `/diagrams` retorna `410 Gone` después del período de migración

### 8.10 Performance

- [ ] **PERF-01** `GET /projects` (listado) no ejecuta queries sobre `model_data` ni `view_data`
- [ ] **PERF-02** `GET /projects/{id}/full` no genera N+1 queries (usar JOIN o batch load)
- [ ] **PERF-03** El cálculo de quota no escanea el contenido JSONB, usa `pg_column_size()` o equivalente
- [ ] **PERF-04** Los índices de `project_id` reducen el tiempo de `GET /projects/{id}/diagrams` a O(log n)
- [ ] **PERF-05** `PATCH /model` con un SemanticModel de 2 MB responde en < 500 ms bajo carga normal

---

## Apéndice A — Tipos TypeScript de referencia (para validación de contratos)

El frontend espera exactamente estas interfaces. El backend debe serializar/deserializar compatible con ellas:

```typescript
// Enviado en PATCH /projects/{id}/model
interface CloudModelPayload {
  data: SemanticModel;
  version: number;
}

// Enviado en PATCH /projects/{id}/diagrams/{diagId}
interface CloudDiagramPayload {
  name?: string;
  viewData?: {
    nodes: ViewNode[];
    edges: ViewEdge[];
  };
  version: number;
}

// Recibido en GET /projects/{id}/full
interface CloudProjectFull {
  project: {
    id: string;
    name: string;
    description?: string;
    author?: string;
    projectVersion: string;
    targetLanguage?: string;
    basePackage?: string;
    visibility: 'PRIVATE' | 'SHARED' | 'PUBLIC';
    version: number;
    createdAt: string;
    updatedAt: string;
  };
  model: {
    id: string;
    data: SemanticModel;
    version: number;
    updatedAt: string;
  };
  diagrams: Array<{
    id: string;
    name: string;
    diagramType: ApiDiagramType;
    path: string;
    viewData: { nodes: ViewNode[]; edges: ViewEdge[] };
    version: number;
    createdAt: string;
    updatedAt: string;
  }>;
}

type ApiDiagramType =
  | 'CLASS' | 'USE_CASE' | 'SEQUENCE' | 'ACTIVITY'
  | 'STATE' | 'COMPONENT' | 'DEPLOYMENT' | 'PACKAGE'
  | 'OBJECT' | 'UNSPECIFIED';
```

---

*Documento generado por LibreUML Core Team — 2026-04-20*  
*Toda implementación debe pasar el 100% del checklist de validación antes de hacer deploy a producción.*
