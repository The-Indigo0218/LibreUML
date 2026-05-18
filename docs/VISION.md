# LibreUML — Visión del Proyecto

> Última actualización: 2026-05-18

---

## Por qué existe LibreUML

LibreUML nació de una necesidad concreta: los estudiantes que aprenden diseño y arquitectura de software no tienen una herramienta gratuita, moderna y que funcione bien. EA (Enterprise Architect) es la referencia de la industria pero es caro, pesado y solo corre en Windows. StarUML está desactualizado. draw.io y Lucidchart son editores de formas genéricos — las cajas no tienen semántica UML real.

Esa brecha sigue existiendo. LibreUML la cierra.

---

## Qué es LibreUML hoy

Un ecosistema de dos productos que crecen juntos:

**LibreUML Modeler** — el editor de diagramas. Soporta Class Diagrams, Use Case Diagrams y Domain Model Diagrams con un modelo semántico compartido entre vistas. La misma clase definida en el Class Diagram es la misma entidad que aparece como actor en el Use Case — sin duplicación, igual que en EA.

**LibreUML Academy** — el componente educativo. Transforma el editor en un entorno de aprendizaje guiado donde los estudiantes construyen sistemas, los rompen y entienden por qué. No memorizar notación — desarrollar pensamiento de diseño.

---

## A dónde va

LibreUML quiere ser la herramienta de referencia para modelado de arquitectura de software — en academia y en equipos profesionales.

El diferenciador real: al crear un proyecto, el usuario elige qué framework de arquitectura quiere usar. LibreUML pre-configura el espacio de trabajo con los tipos de diagrama correctos, interconectados por el mismo modelo semántico.

### Frameworks objetivo

**UML completo con el modelo de vistas 4+1 (Kruchten)**

El estándar más usado en la industria para describir arquitectura de software. Cinco vistas que juntas dan un retrato completo de un sistema:

| Vista | Responde a | Diagramas |
|---|---|---|
| Lógica | ¿Qué hace el sistema? | Class, Object, State Machine |
| Proceso | ¿Cómo fluye la ejecución? | Sequence, Activity |
| Desarrollo | ¿Cómo está organizado el código? | Component, Package |
| Física | ¿Dónde corre el software? | Deployment |
| Escenarios (+1) | ¿Qué une a las 4 vistas? | Use Case |

El mismo elemento aparece en múltiples vistas — la clase `Customer` es actor en Use Case, lifeline en Sequence, y nodo en el Class Diagram. Eso es lo que hace poderoso al 4+1 y es exactamente lo que permite el SemanticModel compartido de LibreUML.

**Template C4 (Simon Brown)**

Un modelo más simple y moderno, muy adoptado en equipos ágiles. Cuatro niveles de zoom: Context → Containers → Components → Code. El nivel Code enlaza directamente con los Class Diagrams del proyecto. LibreUML lo implementará como un tipo de proyecto con notación y shapes propios.

**ArchiMate (a futuro)**

Para equipos que trabajan con TOGAF y necesitan modelar Business + Application + Technology layers. Es Enterprise Architecture real, más allá del software. Se evalúa después de tener C4 sólido.

---

## Principios que no cambian

**Open source.** Siempre. El código es abierto, auditable y libre de modificar.

**Web-first.** Sin instalación obligatoria. El browser es suficiente. Electron no es un objetivo.

**Local-first.** El proyecto vive en el dispositivo del usuario. La nube es opcional, no el default.

**Semántica antes que apariencia.** Un diagrama debe ser correcto antes de ser bonito. Los elementos tienen tipo, atributos y relaciones — no son solo formas.

**Cross-diagram element sharing.** El mismo elemento semántico puede aparecer en múltiples diagramas del mismo proyecto. Es el modelo que usan EA y StarUML y es lo que diferencia un modelador serio de un editor de cajas.

**Education-first en Academy.** El aprendizaje siempre por encima del interés comercial. Academy será gratuita y abierta.

---

## Para quién

**Academia** — estudiantes y docentes que modelan como parte del aprendizaje de diseño y arquitectura de software. LibreUML puede reemplazar a EA y StarUML sin que nadie extrañe nada.

**Equipos de desarrollo** — equipos que documentan arquitectura antes de construir o mientras construyen. El template C4 les habla directamente.

**Formación independiente** — personas aprendiendo arquitectura de software por su cuenta, sin acceso a licencias institucionales.

---

## Lo que LibreUML no es

- No es un IDE. No escribe código por ti. La generación Java es un bonus, no el foco.
- No es draw.io. Los elementos tienen semántica real.
- No es un LMS. Academy no califica estudiantes ni emite certificados.
- No reemplaza la documentación escrita. La complementa.
- No es una herramienta de gestión de proyectos.

---

## Documentación por producto

- [Modeler — Arquitectura técnica](modeler/ARCHITECTURE.md)
- [Modeler — Estándar UML](modeler/uml/UML_STANDARD.md)
- [Modeler — Ingeniería de código](modeler/engineering/ENGINEERING_EXPORTS.md)
- [Academy — Visión educativa](academy/VISION.md)
- [Academy — Para educadores](academy/FOR_EDUCATORS.md)
- [Academy — Guía de estudiantes](academy/STUDENT_GUIDE.md)
