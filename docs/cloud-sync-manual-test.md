# Cloud Sync — Test Manual

> Ejecutar en orden. Cada sección asume que la anterior pasó.
> Tener abierta la pestaña **Network** del DevTools para verificar requests y status codes.

---

## Prerequisitos

- Backend corriendo en `http://localhost:8080`
- Frontend corriendo en `http://localhost:5173`
- Base de datos limpia (o al menos sin el usuario de prueba)
- Dos ventanas/pestañas del navegador disponibles para tests de conflicto

---

## 1. Registro e inicio de sesión

### 1.1 Registro nuevo usuario
1. Ir a la pantalla de registro
2. Completar: nombre, email, contraseña, rol `DEVELOPER`
3. Enviar
4. **Esperar:** `POST /api/v1/auth/register` → **201**
5. Si hay verificación de email: ir al link del correo → `GET /auth/verify-email?token=...` → **204**

### 1.2 Login
1. Ingresar con las credenciales del paso anterior
2. **Esperar:** `POST /api/v1/auth/login` → **204** (cookies HttpOnly seteadas)
3. Verificar que la app carga el estado autenticado
4. **Esperar:** `GET /api/v1/users/me` → **200** con el perfil

### 1.3 Refresh de token (automático)
1. Con sesión activa, abrir DevTools → Application → Cookies
2. Forzar expiración del access token (o esperar si tiene TTL corto)
3. Hacer cualquier acción que dispare una llamada API
4. **Esperar:** interceptor dispara `POST /api/v1/auth/refresh` → **204**, luego el request original se reintenta

### 1.4 Recuperación de contraseña
1. Cerrar sesión
2. Ir al flujo "Olvidé mi contraseña"
3. Ingresar el email
4. **Esperar:** `POST /api/v1/auth/password/forgot` → **204**
5. Ir al link del correo → ingresar nueva contraseña
6. **Esperar:** `POST /api/v1/auth/password/reset` → **204**
7. Iniciar sesión con la nueva contraseña → debe funcionar

---

## 2. Creación y guardado inicial de proyecto

### 2.1 Crear proyecto local
1. Iniciar sesión
2. Crear un nuevo proyecto: nombre `"Test Cloud"`, descripción `"test"`, lenguaje `Java`
3. Agregar un **Class Diagram** con al menos:
   - 2 clases con atributos y métodos
   - 1 relación de herencia entre ellas
4. Agregar una **carpeta** en el VFS y mover un diagrama dentro

### 2.2 Subir a la nube
1. Hacer click en "Guardar en la nube" (o el botón equivalente)
2. En DevTools → Network, verificar en orden:
   - `POST /api/v1/projects` → **201** — anotar el `id` devuelto
   - `PATCH /api/v1/projects/{id}/model` → **200** — anotar `version` devuelta
   - `POST /api/v1/projects/{id}/diagrams` (una por cada diagrama) → **201** cada una
3. En el indicador de sincronización de la UI: debe mostrar "Guardado" o equivalente

### 2.3 Verificar estado del sync store
1. DevTools → Application → Local Storage
2. Buscar la key `libreuml-sync-storage`
3. Verificar que contiene:
   - `cloudProjectId`: el UUID del proyecto
   - `projectVersion`: 1
   - `modelVersion`: 1
   - `cloudDiagrams`: un entry por cada diagrama con `cloudId` y `version`
   - `storageMode`: `"cloud"`

---

## 3. Auto-save (debounce de 30 segundos)

### 3.1 Editar y esperar sincronización
1. Con el proyecto cloud abierto, modificar una clase (renombrar, agregar atributo)
2. Esperar ~30 segundos
3. **Esperar:**
   - `PATCH /api/v1/projects/{id}/diagrams/{diagramId}` → **200** con nuevo `version`
   - `PATCH /api/v1/projects/{id}/model` → **200** con nuevo `version`
4. Verificar que `modelVersion` en localStorage se actualizó

### 3.2 Editar metadatos del proyecto
1. Cambiar el nombre o descripción del proyecto
2. Esperar ~30 segundos
3. **Esperar:** `PATCH /api/v1/projects/{id}` → **200** con nuevo `version`
4. Verificar que `projectVersion` en localStorage se actualizó

### 3.3 Force sync
1. Editar algo en el diagrama
2. Antes de los 30 segundos: usar el botón de sincronización manual (si existe)
3. **Esperar:** el PATCH se dispara inmediatamente, sin esperar el debounce

---

## 4. Cargar proyecto desde la nube

### 4.1 Abrir el picker de proyectos cloud
1. Abrir una **nueva pestaña** (o recargar la página para limpiar el estado local)
2. Iniciar sesión con el mismo usuario
3. Abrir el listado de proyectos cloud
4. **Esperar:** `GET /api/v1/projects?page=0&size=20` → **200** con `content` conteniendo el proyecto

### 4.2 Abrir el proyecto
1. Click en "Abrir" sobre el proyecto `"Test Cloud"`
2. **Esperar:** `GET /api/v1/projects/{id}/full` → **200**
3. Verificar en la respuesta (DevTools → Preview):
   - `project.vfsSnapshot` presente con la estructura de carpetas
   - `model.data` con las clases y relaciones
   - `diagrams[]` con `viewData` para cada diagrama

### 4.3 Verificar fidelidad del render
1. El proyecto debe cargar con **exactamente** la misma estructura de carpetas del VFS
2. Los diagramas deben mostrar **exactamente** las mismas clases en las mismas posiciones
3. Las relaciones deben preservar multiplicidades y roles
4. El IR en el panel de modelo debe mostrar las mismas clases/atributos/operaciones

---

## 5. Crear nuevo diagrama en proyecto cloud

1. Con el proyecto cloud abierto, crear un nuevo **Sequence Diagram**
2. Agregar algunos elementos
3. Esperar el debounce (~30s)
4. **Esperar:**
   - `PATCH /api/v1/projects/{id}` → **200** (vfsSnapshot actualizado)
   - `POST /api/v1/projects/{id}/diagrams` → **201** (diagrama nuevo creado)
5. Verificar en localStorage que el nuevo diagrama tiene entry en `cloudDiagrams`
6. Recargar la app y volver a abrir el proyecto → el nuevo diagrama debe estar presente

---

## 6. Eliminar diagrama

1. Con el proyecto cloud abierto, eliminar uno de los diagramas
2. **Esperar:** `DELETE /api/v1/projects/{id}/diagrams/{diagramId}` → **204**
3. Recargar y volver a abrir → el diagrama eliminado no debe aparecer

---

## 7. Conflict Resolution (409)

> Simula que dos sesiones editan el mismo recurso concurrentemente.

### 7.1 Conflicto en modelo
1. Abrir el proyecto en **dos pestañas** con la misma cuenta
2. En la pestaña A: editar una clase y esperar que se sincronice (verificar PATCH 200)
3. En la pestaña B: sin recargar, editar otra clase (la pestaña B tiene `modelVersion` desactualizado)
4. Esperar el debounce de la pestaña B
5. **Esperar:** `PATCH /projects/{id}/model` → **409**
6. Verificar que aparece el diálogo de resolución de conflicto en la pestaña B
7. Elegir "Mantener local" o "Usar servidor" y verificar que se resuelve

---

## 8. Modo offline y retry queue

1. Con el proyecto cloud abierto, **desconectar la red** (DevTools → Network → Offline)
2. Hacer cambios en el diagrama
3. Esperar el debounce
4. Verificar que el indicador de sync muestra estado "offline"
5. Verificar en localStorage (`libreuml-sync-storage`) que `offlineQueue` tiene entries
6. **Reconectar la red**
7. **Esperar:** los PATCH pendientes se reenvían automáticamente → **200**
8. Verificar que `offlineQueue` queda vacía

---

## 9. Keepalive al cerrar pestaña

1. Con el proyecto cloud abierto, editar algo
2. **Antes** de que pase el debounce, cerrar la pestaña
3. Verificar en los logs del backend que recibió los PATCH de modelo y diagramas pendientes
4. Volver a abrir el proyecto → los cambios deben estar guardados

---

## 10. Eliminar proyecto

1. Abrir el picker de proyectos cloud
2. Hacer hover sobre un proyecto → aparece ícono de eliminar
3. Click en eliminar
4. **Esperar:** `DELETE /api/v1/projects/{id}` → **204**
5. El proyecto desaparece de la lista

---

## 11. Quota

1. Con sesión activa, navegar a la sección de configuración/cuenta donde se muestre el uso de almacenamiento
2. **Esperar:** `GET /api/v1/users/me/quota` → **200**
3. Verificar que muestra `used`, `available` y el desglose `models`/`diagrams`
4. Subir un proyecto adicional y verificar que el contador `used` aumenta

---

## 12. API Keys

1. Ir a la sección de API Keys en la configuración
2. **Esperar:** `GET /api/v1/api-keys` → **200** (lista vacía inicialmente)
3. Crear una key: nombre `"test-key"`, scope `read`
4. **Esperar:** `POST /api/v1/api-keys` → **201** con el raw `key` visible solo esta vez
5. Copiar la key — cerrar el diálogo
6. Verificar que en la lista aparece la key **sin** el valor raw
7. Revocar la key
8. **Esperar:** `DELETE /api/v1/api-keys/{id}` → **204**
9. La key desaparece de la lista

---

## 13. Reports / Feedback

1. Ir al formulario de reporte/feedback
2. Enviar un reporte tipo `BUG` con título y descripción
3. **Esperar:** `POST /api/v1/reports` → **201** con `ReportResponse` (incluye `type` y `updatedAt`)
4. Ir a la sección "Mis reportes"
5. **Esperar:** `GET /api/v1/reports/my?page=0&size=20` → **200** con el reporte recién creado

---

## 14. OAuth (opcional si está configurado)

1. Cerrar sesión
2. Click en "Continuar con GitHub" (o Google)
3. **Esperar:** `GET /api/v1/oauth/github/authorize?redirectUri=...` → **200** con `authorizationUrl`
4. Verificar que redirige al proveedor correctamente

---

## Checklist resumen

| Flujo | Endpoint(s) clave | Status esperado |
|---|---|---|
| Registro | `POST /auth/register` | 201 |
| Login | `POST /auth/login` | 204 |
| Refresh | `POST /auth/refresh` | 204 |
| Password reset | `POST /auth/password/forgot` + `/reset` | 204 + 204 |
| Email verify | `GET /auth/verify-email?token=` | 204 |
| Guardar proyecto | `POST /projects` + `/model` + `/diagrams` | 201 + 200 + 201 |
| Auto-save diagrama | `PATCH /projects/{id}/diagrams/{id}` | 200 |
| Auto-save model | `PATCH /projects/{id}/model` | 200 |
| Auto-save metadata | `PATCH /projects/{id}` | 200 |
| Cargar proyecto | `GET /projects/{id}/full` | 200 con vfsSnapshot |
| Nuevo diagrama en cloud | `POST /projects/{id}/diagrams` | 201 |
| Eliminar diagrama | `DELETE /projects/{id}/diagrams/{id}` | 204 |
| Conflicto 409 | `PATCH /projects/{id}/model` | 409 → dialog |
| Offline retry | PATCH → offline queue → retry | 200 tras reconexión |
| Keepalive | `PATCH` via fetch keepalive | 200 |
| Eliminar proyecto | `DELETE /projects/{id}` | 204 |
| Quota | `GET /users/me/quota` | 200 |
| API Keys | `POST/GET/DELETE /api-keys` | 201/200/204 |
| Reports | `POST /reports` + `GET /reports/my` | 201/200 |
| OAuth | `GET /oauth/{provider}/authorize` | 200 |
