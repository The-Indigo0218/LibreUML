# 🗺️ LibreUML Roadmap

Este documento detalla la evolución del editor de diagramas UML. El enfoque es **Local-First**, priorizando el rendimiento en escritorio y la experiencia de usuario.

---

## 🟢 Fase 1: Cimientos y Arquitectura Core

- [x] ✅ **Inicialización:** Configuración de Vite, React, TypeScript (Strict Mode).
- [x] ✅ **Estilos:** Integración de Tailwind CSS v4 y PostCSS.
- [x] ✅ **Contratos de Dominio:** Definición de interfaces para DiagramState, Nodes y Edges.
- [x] ✅ **Canvas Engine:** Integración base con React Flow.
- [x] ✅ **Componente UML Class:** Implementación visual de la caja de clase (Header, Attrs, Methods).
- [x] ✅ **Validación de Conexiones:** Lógica para evitar conexiones duplicadas o redundantes.

---

## 🟡 Fase 2: Interacción y Lógica de Creación (Refinada)

- [x] ✅ **Edición en Línea (Inline Editing):** Implementado el doble clic para editar el nombre de la clase mediante el Store de Zustand.
- [X] ✅ **Lógica de Creación Dinámica:** Desarrollar la acción `addNode` en el Store para inyectar nuevos objetos `UmlClassData` en el canvas basándose en coordenadas dinámicas del mouse.
- [x] ✅ **Sistema de Prevención de Colisiones:** Implementar validación lógica en el Store para evitar el solapamiento visual de nodos al momento de la creación.
- [x] ✅ **Menú Contextual (Clic Derecho):** Crear una interfaz flotante para acciones rápidas (Borrar, Duplicar, Editar) activada por `onPaneContextMenu`.
- [x] ✅ **Editor de Contenido (Modals):** Implementar ventanas emergentes para la gestión avanzada y cómoda de listas extensas de atributos y métodos.
---

## 🟠 Fase 3: Elementos UML Avanzados (Community Issues)
- [x] ✅ **Toolbar:** Maquetación final de la barra lateral de herramientas.
- [x] ✅ **Refactor de Tipos de Nodos:** Soporte explícito para Interface, Abstract Class.
- [ ] **Relaciones Especializadas:** Implementación visual de Herencia, Realización, Agregación y Composición (flechas personalizadas).
- [ ] **Notas y Comentarios:** Nodos de texto libre para documentar el diagrama.
- [ ] **Shell UI:** Diseño general de la aplicación una vez consolidada las funcionalidades.

---

## 🔵 Fase 4: Persistencia y Desktop (Electron)

- [ ] **Servicio de Persistencia:** Implementación de PersistenceService con LocalStorage / IndexedDB.
- [ ] **Auto-save:** Sistema de guardado automático con Debouncing para optimizar recursos.
- [ ] **Electron Wrapper:** Empaquetado de la app para Windows/Linux/Mac.
- [ ] **File System Access:** Capacidad de guardar y abrir archivos con extensión `.luml` en el disco duro.

---

## 🟣 Fase 5: Backend & Cloud Sync (Spring Boot)

- [ ] **Capa de Servicio API:** Integración con Axios para comunicación con el backend.
- [ ] **Sincronización en la Nube:** Opción para subir diagramas locales al servidor remoto.
- [ ] **Exportación:** Generar imágenes PNG o vectores SVG del diagrama actual.

---

## ⚪ Fase 6: Calidad y Testing

- [ ] **Unit Testing:** Pruebas para la lógica de los nodos y validaciones con Vitest.
- [ ] **E2E Testing:** Pruebas de flujo completo con Playwright o Cypress.
- [ ] **Optimización de Performance:** Pruebas de carga con +100 nodos simultáneos.

---

### ⏳ Pendientes de UX / Polishing (Post-MVP)
- [ ] **Dynamic Ghost:** El elemento fantasma al arrastrar debe reflejar el tipo específico (ej: mostrar `<<interface>>` o cursiva) en lugar de un genérico "New Class...".
- [ ] **Real-time Collision Feedback (Move):** Implementar lógica en `onNodeDrag` para evitar que nodos existentes se solapen al moverlos (similar a la validación de creación).
- [ ] **Logo:** Agregar el logo al header.
- [ ] **Buscar Nodo:** Buscar el nodo/clases por el nombre.
---

## 📝 Notas de Arquitectura

- **Estado Global:** Se evaluará el uso de Zustand si el estado del diagrama se vuelve demasiado complejo para `useState`.
- **Estándar de Código:** Todo el código debe mantener el tipado estricto y seguir la filosofía de *Clean Code*.

