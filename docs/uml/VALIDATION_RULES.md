# ✅ Reglas de Validación (Linter)

LibreUML incluye un analizador estático (Linter) que busca "Code Smells" a nivel de diagrama. Estas reglas educan al estudiante sobre buenas prácticas arquitectónicas.

## 🔴 Errores Críticos (Error)
Impiden la generación de código correcta.

1.  **Nombre Duplicado:** Dos clases no pueden llamarse igual en el mismo paquete.
2.  **Ciclo de Herencia:** `A extiende B` y `B extiende A`. (Java no permite herencia circular).
3.  **Implementación Inválida:** Una clase no puede implementar a otra clase, solo a interfaces.

## 🟡 Advertencias de Diseño (Warning)
El código se genera, pero el diseño es sospechoso.

1.  **God Class (Clase Dios):** Una clase con más de 10 relaciones salientes o más de 20 métodos. Sugiere falta de cohesión.
2.  **Dependencia Circular:** `ClaseA` usa a `ClaseB` y `ClaseB` usa a `ClaseA`. Viola el Principio de Inversión de Dependencias.
3.  **Abuso de Herencia:** Más de 3 niveles de profundidad en la jerarquía de herencia. (Prefiera Composición sobre Herencia).
4.  **Interface Vacía:** Una interfaz sin métodos definidos (Marker Interface) suele ser innecesaria en diseños modernos.