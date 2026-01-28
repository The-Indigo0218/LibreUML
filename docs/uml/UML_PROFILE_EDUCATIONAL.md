# 📏 LibreUML Educational Profile

Este documento define el "Perfil Educativo" utilizado por LibreUML.
Para reducir la complejidad cognitiva y facilitar la enseñanza, LibreUML impone ciertas restricciones sobre el estándar UML 2.5.

## 1. Convenciones de Naming
El motor de validación sugiere (pero no fuerza) las siguientes convenciones estándar de Java/C#:

* **Clases:** `PascalCase` (Ej: `Usuario`, `CarritoDeCompras`).
* **Interfaces:** `PascalCase` comenzando con 'I' o adjetivos (Ej: `IRepositorio`, `Volador`).
* **Atributos:** `camelCase` (Ej: `nombre`, `fechaCreacion`).
* **Métodos:** `camelCase` (Ej: `calcularTotal()`, `validar()`).

## 2. Restricciones de Relaciones
Para evitar arquitecturas frágiles, LibreUML restringe ciertas conexiones:

| Origen | Destino | Relación Permitida | Razón Pedagógica |
| :--- | :--- | :--- | :--- |
| **Interface** | **Class** | ❌ Ninguna | Una interfaz no puede heredar ni depender de una implementación concreta. |
| **Class** | **Interface** | ✅ Realization (Implementación) | Es la base del polimorfismo. |
| **Interface** | **Interface** | ✅ Generalization (Herencia) | Una interfaz puede extender a otra. |
| **Class** | **Class** | ✅ Todas (Menos Realization) | Una clase no "implementa" a otra clase. |

## 3. Simplificaciones Visuales
* **Multiplicidad:** Por defecto es `1` a `1`. Se soporta `0..1`, `1..*` y `*`.
* **Estereotipos:** Se ocultan estereotipos complejos como `<<utility>>` o `<<process>>` para enfocarse en `<<interface>>` y `<<enumeration>>`.