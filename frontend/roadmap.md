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

## 🟡 Fase 2: Interacción y UI del Editor

- [ ] **Toolbar de Creación:** Barra lateral para arrastrar y soltar (drag & drop) nuevas clases al lienzo.
- [ ] **Edición en Línea (Inline Editing):** Doble clic para editar el nombre de la clase, atributos o métodos directamente en el nodo.
- [ ] **Panel de Propiedades:** Sidebar derecha para configurar estereotipos, visibilidad (+, -, #) y tipos de datos.
- [ ] **Gestión de Selección:** Acciones rápidas al seleccionar nodos (borrar, duplicar).

---

## 🟠 Fase 3: Elementos UML Avanzados (Community Issues)

- [ ] **Refactor de Tipos de Nodos:** Soporte explícito para Interface, Abstract Class y Enum.
- [ ] **Relaciones Especializadas:** Implementación visual de Herencia, Realización, Agregación y Composición (flechas personalizadas).
- [ ] **Notas y Comentarios:** Nodos de texto libre para documentar el diagrama.

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

## 📝 Notas de Arquitectura

- **Estado Global:** Se evaluará el uso de Zustand si el estado del diagrama se vuelve demasiado complejo para `useState`.
- **Estándar de Código:** Todo el código debe mantener el tipado estricto y seguir la filosofía de *Clean Code*.

