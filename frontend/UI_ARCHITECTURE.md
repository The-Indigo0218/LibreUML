# 🧩 UI_ARCHITECTURE.md
## LibreUML — User Interface Architecture

Este documento describe la **arquitectura de la interfaz de usuario** de LibreUML.  
Su objetivo es servir como referencia técnica, guía de diseño y documento de alineación para futuras contribuciones.

LibreUML adopta una **filosofía de interfaz tipo VS Code**:
- Menús claros y jerárquicos
- Funciones explícitas
- Separación estricta entre *Core* y *Future Features*
- Enfoque profesional, no experimental

---

## 🎯 Principios de Diseño

1. **Clarity over Cleverness**  
   Cada acción debe ser explícita y predecible.

2. **Local-First UX**  
   El usuario siempre siente control total de sus archivos.

3. **Progressive Disclosure**  
   Funcionalidades avanzadas existen, pero no saturan la interfaz.

4. **Editor First**  
   LibreUML es un editor visual. Educación y métricas son capas adicionales.

5. **Parity Desktop / Web**  
   La UI debe sentirse consistente entre Electron y Web.

---

## 🧱 Estructura Global de la UI

```
┌───────────────────────────────────────────┐
│ Application Menu (File · Edit · View …)   │
├───────────────────────────────────────────┤
│ Header / Toolbar (contextual actions)     │
├───────────────┬───────────────────────────┤
│ Sidebar       │ Canvas (React Flow)       │
│ (Tools)       │                           │
│               │                           │
├───────────────┴───────────────────────────┤
│ Status Bar (future: metrics, hints)       │
└───────────────────────────────────────────┘
```

---

## 📁 FILE — Gestión de Archivos

| Acción | Estado |
|------|--------|
| New Diagram | ✅ |
| Open (.luml / .json) | ✅ |
| Open Recent | 🔒 Incoming |
| Save | ✅ |
| Save As | ✅ |
| Auto Save (backup local) | 🟡 In progress |
| Revert Diagram | 🔒 Incoming |
| Close Diagram (safe close) | ✅ |
| Start Clean | ✅ |
| File Association (.luml) | 🟡 In progress |
| Exit | ✅ |

---

## ✏️ EDIT — Edición UML

| Acción | Estado |
|------|--------|
| Undo / Redo | 🟡 In progress |
| Duplicate Node (Ctrl+D) | ✅ |
| Delete Selection | ✅ |
| Edit Node Content | ✅ |
| Connection Management | ✅ |
| Drag & Drop Nodes | ✅ |
| Collision Detection | ✅ |
| Copy / Paste Style | 🔒 Incoming |

---

## 👁️ VIEW — Visualización

| Acción | Estado |
|------|--------|
| Zoom In / Out | ✅ |
| Fit View | ✅ |
| Minimap | ✅ |
| Spotlight Search (Ctrl+K) | 🟡 In progress |
| Theme (Light / Dark) | 🟡 In progress |
| Language (ES / EN) | 🟡 In progress |
| Zen Mode | 🔒 Incoming |

---

## 📤 EXPORT — Exportación

| Acción | Estado |
|------|--------|
| Export .luml | ✅ |
| Export PNG (HD) | 🟡 In progress |
| Export SVG | 🟡 In progress |
| Export PDF | 🔒 Incoming |
| Export to GitHub | 🔒 Incoming |

---

## ⚙️ ENGINEERING — Generación de Código

| Acción | Estado |
|------|--------|
| UML → Java | 🟡 In progress |
| UML → Python | 🔒 Incoming |
| UML → SQL | 🔒 Incoming |
| Code → UML | 🔒 Incoming |
| Live Code Preview | 🔒 Incoming |

---

## 🎓 EDU — Capa Educativa (No Core)

| Acción | Estado |
|------|--------|
| UML Linter | 🔒 Incoming |
| Exam Mode | 🔒 Incoming |
| Achievements / Badges | 🔒 Incoming |
| Keyboard Gamification | 🔒 Incoming |
| Certificates | 🔒 Incoming |

---

## ❓ HELP — Soporte y Comunidad

| Acción | Estado |
|------|--------|
| Getting Started | 🔒 Incoming |
| Documentation | 🟡 In progress |
| Report Issue | 🟡 In progress |
| Roadmap | ✅ |
| About LibreUML | ✅ |

---

## 🧭 Header / Toolbar (Tipo VS Code)

### Acciones visibles (Core):
- New Diagram
- Open
- Save
- Undo / Redo
- Zoom Controls
- Fit View

### Acciones contextuales:
- Export
- Theme Toggle
- Spotlight Search

---

## 🧠 Notas Finales

- Funcionalidades **Incoming** deben mostrarse deshabilitadas.
- El editor nunca debe depender de login para funcionar.
- Capas educativas y métricas son opcionales.

---

**Este documento define el contrato visual de LibreUML.**
