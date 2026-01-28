# ⚙️ Ingeniería y Exportación

LibreUML no es solo una herramienta de dibujo. Es un motor de ingeniería que entiende la semántica de tu diagrama. Este documento explica cómo transformamos cajas y líneas en código funcional.

## ☕ Generación Java (Stable)

El motor de exportación Java toma el grafo del diagrama y produce un proyecto estándar.

### Mapeo de Elementos

| Elemento UML | Código Java Generado |
| :--- | :--- |
| Clase `Usuario` | `public class Usuario { ... }` |
| Interfaz `Pagable` | `public interface Pagable { ... }` |
| Atributo `+ edad: int` | `public int edad;` |
| Atributo `- nombre: String` | `private String nombre;` |
| Método `+ calcular(): void` | `public void calcular() { throw new UnsupportedOperationException(); }` |

### Relaciones

* **Herencia (Generalization):** Se traduce a `public class A extends B`.
* **Implementación (Realization):** Se traduce a `public class A implements I`.
    * *Nota:* LibreUML soporta implementación múltiple (varias interfaces).
* **Composición/Agregación:** Se generan como atributos de instancia.
    * Ej: Una relación de `Casa` a `Ventana` genera `private Ventana ventana;` dentro de `Casa`.

### Limitaciones Conocidas
* **Cuerpos de Métodos:** LibreUML genera la *firma* del método. La lógica interna (el algoritmo) debes escribirla en tu IDE.
* **Genéricos Complejos:** Actualmente soporta `List<T>` básico, pero definiciones complejas como `Map<String, List<? extends T>>` deben ajustarse en el código final.

---

## 🐍 Generación Python (Experimental / Roadmap)

*Planeado para Q3 2026.*
Se centrará en el uso de **Type Hints** (PEP 484) y **Data Classes** para mantener la estructura estricta definida en el diagrama.

---

## 💾 Generación SQL (Experimental / Roadmap)

*Planeado para Q4 2026.*
Permitirá seleccionar un subconjunto de clases y generar scripts `CREATE TABLE` asumiendo un mapeo ORM estándar (Clase = Tabla, Atributo = Columna).