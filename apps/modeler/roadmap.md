# 🗺️ LibreUML Roadmap
### Unified Roadmap · *Local‑First Strategy*

**Filosofía Central**  
> **Local Powerhouse, Cloud Intelligence**  
LibreUML prioriza el rendimiento, la estabilidad y la experiencia de usuario en escritorio.  
La web y el backend existen como motores de crecimiento, métricas y distribución, no como dependencia funcional del editor.

---

## 🟢 Fase 1: Cimientos y Arquitectura Core *(Completado)*

- [x] Inicialización del proyecto con **Vite + React + TypeScript (Strict)**.
- [x] Estilos base con **Tailwind CSS**.
- [x] Definición de contratos de dominio (`DiagramState`, `Nodes`, `Edges`).
- [x] Canvas Engine basado en **React Flow**.
- [x] Componente **UML Class** (Header, Attributes, Methods).
- [x] Validación de conexiones (prevención de duplicados y ciclos inválidos).

---

## 🟡 Fase 2: Interacción y Lógica de Creación *(Completado / Pulido)*

- [x] Edición en línea mediante doble clic.
- [x] Creación dinámica de nodos (Drag & Drop).
- [x] Prevención de colisiones en creación.
- [x] Menú contextual (clic derecho).
- [x] Modals para edición avanzada.
- [x] **Smart Routing:** recálculo automático de conexiones al mover nodos.

---

## 🟠 Fase 3: Experiencia de Usuario Pro *(En progreso)*
Aquí LibreUML deja de ser un prototipo y se convierte en una herramienta real de trabajo.

### 🔄 Undo / Redo
- Implementar **zundo** (middleware para Zustand) o historial manual.
- Debe registrar:
  - Movimientos.
  - Creación y eliminación de nodos.
  - Cambios de texto.
  - Conexiones.

### 🌓 Theme System (Dark / Light)
- Toggle en Header o Sidebar.
- Persistencia en `localStorage`.
- Ajuste de Grid y Background de React Flow según el tema.

### 🔍 Buscador de Nodos (Spotlight)
- Acceso rápido (`Ctrl + K` / `Cmd + K`).
- Enfoque automático del nodo seleccionado:
```ts
reactflow.fitView({
  nodes: [targetNode],
  duration: 800
})
```

### 🌐 Internacionalización (i18n)
- Idiomas iniciales: Español / Inglés.
- Librería: **react-i18next**.
- Alcance:
  - Sidebar.
  - Menús contextuales.
  - Modals.
  - Alerts.

---

## 🔵 Fase 4: Desktop & Persistencia *(Electron)*

### 📂 Gestión de Archivos Nativa (.luml)
- **Open:** cargar JSON desde el sistema de archivos.
- **Save:** sobrescribir si existe ruta.
- **Save As:** crear nuevo archivo.
- **Dirty State:** asterisco (*) si hay cambios sin guardar.

### 🛡️ Autosave de Emergencia
- Backup en `localStorage` cada 30 segundos.
- No sobrescribe archivos físicos sin confirmación.

---

## 🧩 Fase 5: Elementos UML Avanzados *(Consolidado)*

- [x] Toolbar final.
- [x] Soporte para:
  - Interface.
  - Abstract Class.
- [x] Relaciones UML especializadas:
  - Herencia.
  - Realización.
  - Agregación.
  - Composición.
- [x] Notas y comentarios.
- [x] Shell UI consolidada.

---

## 💻 Fase 6: Generación y Exportación

### Generador de Código
Conversión del `.luml` a:
- Java (`.java`).
- Python (`dataclasses`).
- SQL (`CREATE TABLE`).

### Exportación Visual
- PNG / JPG en alta resolución.
- [x] SVG vectorial para documentación.

---

## 🟣 Fase 7: Estrategia de Crecimiento *(Backend & Web)*

### 🌍 Landing Page
- Showcase del producto.
- Formulario de descarga:
  - Rol.
  - Universidad / Empresa.
  - Email.
- Entrega de instaladores (`.exe`, `.dmg`, `.deb`).

### ⚙️ Backend Spring Boot (Metrics API)
- Endpoints:
  - `/api/download-tracker`
  - `/api/telemetry`
- Base de datos: PostgreSQL o H2.

### 📡 Telemetría en Electron
Ping anónimo:
```json
{
  "os": "win32",
  "version": "1.0.0",
  "sessionId": "uuid"
}
```
- Métrica: **DAU (Daily Active Users)**.

### 🔔 Version Check
- Consulta automática de nuevas versiones.
- Notificación tipo *toast*.

---

## ⚪ Fase 8: Calidad y Testing

- Unit Testing (Vitest).
- E2E Testing (Playwright / Cypress).
- Pruebas de estrés con diagramas grandes.
- Validación estricta de apertura/guardado de archivos.

---

## 📝 Notas de Arquitectura

- **Estado Global:** Zustand con middlewares controlados.
- **Persistencia:** separación estricta entre backup local y archivo físico.
- **Principio clave:** *Local‑First, Offline‑Ready, Zero Lock‑in*.
