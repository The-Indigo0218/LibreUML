# 📐 Estándar UML y Cumplimiento

Este documento detalla la adhesión de LibreUML a la especificación ISO/IEC 19505 (UML 2.x) y justifica las desviaciones pedagógicas.

## Filosofía de Implementación

LibreUML implementa el **Subconjunto Educativo** del estándar UML 2.5. Priorizamos la claridad conceptual y la velocidad de aprendizaje sobre la exhaustividad industrial.

> "El objetivo no es cubrir el 100% del estándar, sino el 20% que se usa en el 80% de los proyectos de software modernos."

---

## ✅ Elementos Soportados (Compliance Level 1)

### Diagramas de Clase (Kernel)
LibreUML soporta estrictamente la semántica de:

* **Class:** Representación rectangular con compartimentos para nombre, atributos y métodos.
* **Interface:** Estereotipo `<<Interface>>` o notación circular (próximamente).
* **Abstract Class:** Nombre en *cursiva* o etiqueta `{abstract}`.
* **Enumeration:** Estereotipo `<<Enumeration>>`.

### Relaciones (Relationships)
Implementamos la semántica visual y lógica de:

| Relación | Notación | Semántica de Código (Java) |
| :--- | :--- | :--- |
| **Generalization** | Línea sólida + Triángulo vacío | `extends` |
| **Realization** | Línea punteada + Triángulo vacío | `implements` |
| **Dependency** | Línea punteada + Flecha abierta | Uso en parámetros/variables locales |
| **Association** | Línea sólida | Atributo de instancia |
| **Aggregation** | Línea sólida + Rombo vacío | Colección / Referencia débil |
| **Composition** | Línea sólida + Rombo lleno | Instancia obligatoria (Cycle life) |

---

## ⚠️ Desviaciones Conscientes

Por razones pedagógicas, LibreUML restringe ciertas libertades del estándar:

1.  **Bidireccionalidad Implícita:**
    * *Estándar:* Permite asociaciones sin flechas (lectura ambigua).
    * *LibreUML:* Fuerza una dirección inicial para fomentar el principio de "Dueño de la Relación" en código.

2.  **Conexiones Ilegales:**
    * *Estándar:* Permite conectar cualquier cosa con una nota o restricción.
    * *LibreUML:* El motor impide conexiones semánticamente inválidas (ej. una Interface heredando de una Clase Final) para educar al usuario.

---

## 📚 Referencias
* OMG Unified Modeling LanguageTM (OMG UML), Version 2.5.1
* ISO/IEC 19505-1:2012 Information technology — OMG Unified Modeling Language (OMG UML)