
# LibreUML

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-green.svg)
![Tests](https://img.shields.io/badge/tests-373%20passing-brightgreen)
![Stack](https://img.shields.io/badge/stack-React%20%7C%20Konva%20%7C%20TypeScript-blueviolet)

**Plataforma open source de modelado de arquitectura de software.**

LibreUML nació para hacer que el modelado visual sea accesible, moderno y útil de verdad — sin barreras de precio, sin instalación obligatoria, sin depender de herramientas que llevan 20 años sin actualizarse.

---

## El ecosistema

LibreUML no es una sola app. Es un monorepo con dos productos que crecen juntos:

### 🖊️ LibreUML Modeler
El editor de diagramas. Hoy soporta Class Diagrams, Use Case Diagrams y Domain Model Diagrams con un modelo semántico compartido entre vistas — igual que hace Enterprise Architect, pero en el browser y gratis.

La hoja de ruta apunta a cubrir el **modelo de vistas 4+1** (Kruchten) completo: vistas lógica, proceso, desarrollo, física y escenarios. Después vienen los templates de frameworks como C4.

Lo que ya tiene:
- Editor de diagramas con canvas Konva
- Modelo semántico real — los elementos tienen tipo, atributos y relaciones, no son solo cajas
- Cross-diagram element sharing — la misma clase aparece en el Class y en el Use Case sin duplicarse
- Generación de código Java (forward engineering)
- Importación desde `.java` (reverse engineering)
- Cloud sync con cuenta propia
- Soporte completo ES / EN

### 🎓 LibreUML Academy
El componente educativo. La idea es convertir el editor en un entorno de aprendizaje guiado donde los estudiantes construyan sistemas, los rompan y entiendan por qué — sin memorizar notación, sino desarrollando pensamiento de diseño.

Academy está en desarrollo temprano. La visión completa está en [`docs/education/ACADEMY_VISION.md`](docs/education/ACADEMY_VISION.md).

---

## ¿Por qué existe esto?

Las herramientas UML disponibles hoy tienen al menos uno de estos problemas:

- **Enterprise Architect:** la referencia de la industria, pero caro, solo Windows, UX de los 90s
- **StarUML:** simple pero desactualizado y sin colaboración
- **draw.io / Lucidchart:** genéricos — cajas y flechas sin semántica UML real
- **PlantUML:** solo texto, sin interfaz visual

LibreUML apunta al hueco que dejan todos: moderno, gratuito, con semántica UML real y preparado para los frameworks de arquitectura que usan los equipos hoy.

---

## Features actuales

### Editor de diagramas

- Drag & drop desde la paleta de herramientas
- Validación en tiempo real (previene relaciones inválidas)
- Modo oscuro nativo
- Atajos de teclado (Ctrl+Z/Y, Ctrl+K para spotlight, etc.)
- Spotlight search para encontrar elementos en el diagrama
- Auto-layout automático

### Tipos de diagrama disponibles

| Tipo | Vista 4+1 | Estado |
|---|---|---|
| Class Diagram | Lógica | ✅ |
| Use Case Diagram | Escenarios (+1) | ✅ |
| Domain Model Diagram | Lógica | ✅ |
| Sequence Diagram | Proceso | 🔵 En roadmap |
| Component Diagram | Desarrollo | 🔵 En roadmap |
| Deployment Diagram | Física | 🔵 En roadmap |
| Activity Diagram | Proceso | 🔵 En roadmap |
| State Machine | Lógica | 🔵 En roadmap |

### Code engineering

- **Forward:** diseña en el editor, genera proyecto Java (Maven o Gradle)
- **Reverse:** importa `.java` y reconstruye el diagrama automáticamente

### Cloud

- Proyectos sincronizados en la nube con cuenta propia
- Local-first por defecto — funciona 100% offline

---

## Stack

| Capa | Tecnología |
|---|---|
| UI | React 18 + TypeScript |
| Bundler | Vite |
| Canvas | Konva + react-konva |
| Estado | Zustand (immer + persist selectivo) |
| Estilos | Tailwind CSS |
| Tests | Vitest |
| i18n | react-i18next |
| Monorepo | Turborepo |

---

## Getting Started

### Prerrequisitos

- Node.js 18+
- npm 9+

### Instalación

```bash
# Clonar el repositorio
git clone https://github.com/The_Indigo0218/LibreUML.git
cd LibreUML

# Instalar dependencias (instala todo el monorepo)
npm install

# Iniciar en modo desarrollo
npm run dev
```

El Modeler corre en `http://localhost:5173` por defecto.

### Tests

```bash
npm run test    # corre todos los tests del monorepo
npm run build   # build de producción (tsc -b + vite)
```

---

## Estructura del monorepo

```
LibreUML/
├── apps/
│   ├── modeler/     ← el editor de diagramas
│   └── academy/     ← la plataforma educativa
├── packages/        ← código compartido entre apps
├── docs/            ← documentación técnica
└── turbo.json       ← configuración del monorepo
```

---

## Documentación

- [Visión del proyecto](docs/VISION.md)
- [Modeler — Arquitectura técnica](docs/modeler/ARCHITECTURE.md)
- [Modeler — Getting started](docs/modeler/onboarding/GETTING_STARTED.md)
- [Academy — Visión educativa](docs/academy/VISION.md)
- [Academy — Para educadores](docs/academy/FOR_EDUCATORS.md)

---

## Contribuir

LibreUML es un proyecto open source. Las contribuciones son bienvenidas.

Antes de arrancar con algo grande, abre un issue para alinear el enfoque. El proyecto tiene convenciones de commits y de ramas documentadas.

---

## Licencia

MIT — libre de usar, modificar y distribuir, incluyendo entornos educativos y comerciales.

---

<p align="center">
  Hecho con ❤️ para quien aprende y para quien diseña.
</p>
