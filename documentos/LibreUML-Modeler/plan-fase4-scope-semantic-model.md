# Plan de trabajo — Fase 4: Scopear el SemanticModel al proyecto

> Ciclo actual · Rama objetivo: `refactor/scope-semantic-model`  
> Prerequisito: Fases 1 y 2 completadas ✅

---

## El problema en una oración

El `SemanticModel` (clases, interfaces, relaciones) vive en su propio store de Zustand con persistencia en localStorage, **separado** del proyecto VFS. Si el usuario abre un proyecto distinto sin cerrar correctamente el anterior, el modelo del proyecto viejo contamina el nuevo.

Hoy eso está parcheado con un check en `useVFSCanvasController`:

```ts
if (!ms.model || ms.model.id !== project.domainModelId) {
  ms.initModel(project.domainModelId);
}
```

Funciona, pero es exactamente eso: un parche. El modelo debería vivir *dentro* del proyecto, no al lado.

---

## Objetivo

Que `LibreUMLProject` cargue, contenga y descargue su propio `SemanticModel`. El store `useModelStore` sigue existiendo como capa reactiva (los componentes lo suscriben), pero ya no persiste nada por cuenta propia — solo refleja lo que hay en el proyecto activo.

Resultado esperado: abrir un proyecto A, cambiar al proyecto B, volver al A — cada uno tiene su modelo limpio, sin ningún check adicional.

---

## Estado actual de los archivos que importan

| Archivo | Qué hace hoy | Qué cambia |
|---|---|---|
| `src/core/domain/vfs/vfs.types.ts` | Define `LibreUMLProject` sin modelo | Agregar campo `semanticModel` |
| `src/store/model.store.ts` | Store Zustand con `persist` | Quitar `persist`, agregar `loadModel` / `unloadModel` |
| `src/store/project-vfs.store.ts` | Carga el proyecto VFS, no toca el modelo | Cargar/descargar `semanticModel` en `loadProject` / `closeProject` |
| `src/services/projectIO.service.ts` | Lee y escribe el VFS snapshot; modelo lo maneja aparte | Incluir `semanticModel` en el snapshot del proyecto |
| `src/features/cloud/services/cloudSync.service.ts` | Sincroniza proyecto + modelo por separado | Sincronizar todo junto |
| `src/features/cloud/hooks/useAutoSave.ts` (cloud) | Escucha cambios del modelo global | Escuchar el modelo del proyecto activo |

---

## Pasos en orden

### 1. Tipo — agregar `semanticModel` a `LibreUMLProject`

```ts
// vfs.types.ts
export interface LibreUMLProject {
  // ... campos actuales ...
  semanticModel?: SemanticModel; // opcional para compatibilidad con proyectos viejos
}
```

Opcional porque los proyectos existentes en localStorage no tienen este campo — la migración viene después.

---

### 2. Store — quitar `persist` de `useModelStore`

`model.store.ts` actualmente persiste con la key `libreuml-model-storage`. Hay que:

- Eliminar el middleware `persist`
- Agregar `loadModel(model: SemanticModel)` — ya existe
- Agregar `unloadModel()` — alias de `resetModel()` existente

El store queda igual en interfaz, solo deja de escribir en localStorage.

**Riesgo:** Si hay código que asume que el modelo persiste entre recargas de página fuera del contexto de un proyecto abierto, rompe. Hay que revisar `useAutoRestore` antes de tocar esto.

---

### 3. VFSStore — conectar carga/descarga del modelo

En `project-vfs.store.ts`:

```ts
loadProject: (project) => {
  set({ project });
  // Cargar el modelo del proyecto si trae uno
  if (project.semanticModel) {
    useModelStore.getState().loadModel(project.semanticModel);
  } else {
    useModelStore.getState().initModel(project.domainModelId);
  }
},

closeProject: () => {
  set({ project: null });
  useModelStore.getState().resetModel(); // limpia completamente
},
```

Esto reemplaza el check en `useVFSCanvasController` — que puede eliminarse limpiamente.

---

### 4. Sincronización del modelo hacia el proyecto

El modelo cambia constantemente mientras el usuario dibaja. Esos cambios tienen que fluir de vuelta a `project.semanticModel` para que el snapshot sea fiel.

Dos opciones:

**Opción A (recomendada):** Suscripción en `project-vfs.store` que escucha cambios de `useModelStore` y actualiza `project.semanticModel` con debounce.

**Opción B:** Cada operación de escritura al modelo llama también a `vfsStore.updateSemanticModel(...)`.

La opción A es más limpia porque no requiere tocar cada operación CRUD del modelo. La B es más explícita pero genera mucho ruido de cambios.

---

### 5. ProjectIO — incluir el modelo en el snapshot

`projectIO.service.ts` hoy serializa el proyecto VFS y el modelo por separado. Con el cambio, el modelo va dentro del proyecto:

```ts
// al guardar
const snapshot = {
  ...project,
  semanticModel: useModelStore.getState().model,
};

// al cargar
vfsStore.loadProject(snapshot); // el step 3 ya maneja el modelo
```

---

### 6. Cloud sync — simplificación

El servicio de cloud hoy sube el VFS y el modelo en pasos distintos. Con el modelo dentro del proyecto, sube todo junto. Esto debería simplificar `cloudSync.service` considerablemente.

Cuidado aquí: los 12 tests en `describe.skip` de `cloudSync.service.test.ts` apuntan a la API vieja. Si tocamos el servicio, es buen momento para reescribir esos tests también — es deuda que aplaza la confianza en el cloud.

---

### 7. Migración de datos en localStorage

Los proyectos existentes tienen el modelo en `libreuml-model-storage` separado del proyecto VFS. Al abrir un proyecto viejo:

```ts
// En loadProject, si no viene semanticModel:
if (!project.semanticModel) {
  // Intentar leer del localStorage legacy
  const legacyModel = readLegacyModelFromStorage(project.domainModelId);
  if (legacyModel) {
    project.semanticModel = legacyModel;
  } else {
    // Inicializar modelo vacío, el usuario parte de cero
    useModelStore.getState().initModel(project.domainModelId);
  }
}
```

Después de la primera vez que el proyecto se guarda, `semanticModel` queda en el VFS y el legacy ya no es necesario.

---

## Lo que NO cambia

- La interfaz pública de `useModelStore` — los componentes la siguen usando igual
- `standaloneModelOps` — ya funciona correctamente con `localModel` por archivo
- `useActiveSemanticModelOps` — la abstracción es correcta, solo cambia qué hay detrás
- El cross-diagram element sharing — sigue funcionando, el modelo sigue siendo compartido entre diagramas del mismo proyecto

---

## Criterio de aceptación

- Abrir proyecto A → modelo A cargado
- Abrir proyecto B sin cerrar → modelo B cargado, modelo A limpio
- Cerrar sesión y volver → proyecto A con su modelo intacto (desde VFS, no desde localStorage legacy)
- `tsc -b` sin errores
- Tests actuales pasan (373 +  los que se reescriban de cloud)
- El check `model.id !== project.domainModelId` en `useVFSCanvasController` puede eliminarse

---

## Orden de commits sugerido

```
1. types: add semanticModel to LibreUMLProject
2. refactor(model-store): remove persist middleware
3. refactor(vfs-store): load/unload model on project lifecycle
4. refactor(vfs-canvas): remove stale model.id check
5. refactor(projectIO): include semanticModel in project snapshot
6. refactor(cloud-sync): unify model in project snapshot
7. test(cloud): rewrite 12 skipped cloudSync tests
8. chore: localStorage migration for legacy projects
```

Cada commit compila y los tests pasan — nada de "commit de arreglos" al final.
