# 🧩 UI_ARCHITECTURE.md
## LibreUML — User Interface Architecture

**Versión:** 1.0.0  
**Estado:** Core Feature Complete

Este documento describe la **arquitectura de la interfaz de usuario** de LibreUML.  
Su objetivo es servir como referencia técnica, guía de diseño y documento de alineación para futuras contribuciones.

LibreUML adopta una **filosofía de interfaz tipo VS Code (IDE-like)**:

- Menús claros y jerárquicos (*File, Edit, View, Code...*)
- Funciones explícitas y predecibles
- Separación estricta entre **Core** y **Future Features**
- Enfoque profesional, priorizando la productividad sobre la gamificación

---

## 🎯 Principios de Diseño

### 1. Clarity over Cleverness
Cada acción debe ser explícita. Se evitan menús ocultos o gestos no documentados.

### 2. Local-First UX
El usuario mantiene control total: los archivos se leen y escriben en el disco local, no en una nube opaca.

### 3. Progressive Disclosure
Herramientas avanzadas (Ingeniería Inversa, Generación de Proyectos) existen sin saturar la vista inicial.

### 4. State-Driven UI
La interfaz refleja el estado global (**Zustand**).  
Si el estado cambia, la UI reacciona instantáneamente.

### 5. Parity Desktop / Web
Diseño responsivo y agnóstico a la plataforma, listo para Electron sin cambios mayores.

---

## 🧱 Estructura Global de la UI

La aplicación sigue el patrón **Holy Grail Layout** adaptado a herramientas de diagramación:

```
┌────────────────────────────────────────────────────────┐
│ Application Menubar (File · Edit · View · Code ...)     │
├────────────────────────────────────────────────────────┤
│ Toolbar (Contextual Actions: Zoom, Undo, Fit)          │
├───────────────┬────────────────────────────────────────┤
│ Sidebar       │                                        │
│ (Toolbox &    │      CANVAS (React Flow)               │
│  Drag Items)  │   Infinite Workspace Layer             │
│               │                                        │
│               │   ┌────────────────────────────┐       │
│               │   │ Floating Modals (Z-50)     │       │
│               │   └────────────────────────────┘       │
├───────────────┴────────────────────────────────────────┤
│ Status Bar (Language: Java 21 · Mode: UML Class)       │
└────────────────────────────────────────────────────────┘
```

---

## 📁 FILE — Gestión de Archivos

| Acción | Estado | Descripción |
|------|------|-------------|
| New Diagram | ✅ | Reinicia el store y limpia el canvas |
| Open (.luml) | ✅ | Carga y deshidrata el estado JSON completo |
| Save / Save As | ✅ | Serializa el estado a JSON descargable |
| Auto Save | 🟡 | Persistencia en localStorage (backup local) |
| Exit | ✅ | Cierre seguro con confirmación de cambios |

---

## 👁️ VIEW — Visualización & Accesibilidad

| Acción | Estado | Descripción |
|------|------|-------------|
| Zoom Controls | ✅ | Control preciso del viewport |
| Minimap | ✅ | Navegación rápida en diagramas grandes |
| Theme System | ✅ | Dark / Light con variables CSS |
| Internationalization | ✅ | Motor i18n (ES / EN) |
| Spotlight Search | ✅ | Búsqueda rápida (Ctrl+K) |

---

## 💻 CODE — Ingeniería de Software (Core Feature)

Esta sección diferencia a LibreUML de herramientas de dibujo tradicionales.

| Acción | Estado | Tecnología / Patrón |
|------|------|---------------------|
| Generate Java Class | ✅ | Transpilación UML → Java |
| Generate Project | ✅ | Maven / Gradle + ZIP (JSZip) |
| Reverse Engineering | ✅ | Parser Java + Ghost Nodes |
| Live Code Preview | 🔒 | Renderizado en tiempo real (Próximamente) |

---

## 🎓 EDU — Capa Educativa (Placeholder Architecture)

Menú visible pero funcionalmente bloqueado para mostrar la visión a largo plazo.

| Acción | Estado | Notas |
|------|------|-------|
| UML Linter | 🔒 | Análisis estático de errores |
| Exam Mode | 🔒 | Bloqueo de importaciones |
| Gamification | 🔒 | Badges y logros |

---

## ❓ HELP — Soporte

| Acción | Estado | Descripción |
|------|------|-------------|
| Getting Started | 🔒 | Tour interactivo |
| Documentation | ✅ | Wiki / Readme |
| Roadmap | ✅ | Project Board |
| Report Issue | ✅ | GitHub Issues |
| About | ✅ | Versión y licencia |

---

## 🎨 Design Tokens & Theming

El sistema de diseño utiliza **Tailwind CSS** con abstracción semántica:

- **Surface Levels:** surface-primary, surface-secondary, surface-hover
- **Text Levels:** text-primary, text-secondary, text-muted
- **Accents:** Verde = Éxito, Rojo = Error/Privado, Azul = Info/Público

---

## 🧩 Componentes Modales (Overlay System)

Arquitectura centralizada en el **UiStore** para evitar *prop drilling*.

### Import Code Modal
- Drag & Drop
- Pegado de texto
- Validación visual

### Project Generator Modal
- Metadata (GroupId, ArtifactId)
- Build Tool: Maven / Gradle

---

**Este documento define el contrato visual y funcional de LibreUML v1.0.0.**
