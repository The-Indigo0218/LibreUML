# 🎓 Guía del Estudiante: Pensar como un Arquitecto

Bienvenido a LibreUML. Esta herramienta no es para "hacer dibujos", es para **diseñar sistemas**.

En la universidad te enseñan a escribir código, pero en la industria, el error más costoso es escribir código sin haber pensado primero en la estructura. LibreUML es tu **Dojo de Arquitectura**.

---

## 🚀 Cómo empezar (Sin dolor)

1.  **No dibujes todo de golpe:** Empieza por los sustantivos de tu problema. Si el problema dice *"Un Usuario compra un Producto"*, crea dos cajas: `Usuario` y `Producto`.
2.  **Define el contrato:** Antes de conectar nada, define qué *tiene* cada clase (Atributos) y qué *hace* (Métodos).
3.  **Conecta con sentido:**
    * Si A **es un tipo de** B → Usa Herencia (Triángulo vacío).
    * Si A **tiene un** B → Usa Asociación o Agregación (Rombo).
    * Si A **usa** a B momentáneamente → Usa Dependencia (Flecha punteada).

---

## ✅ Buenas Prácticas (Cómo obtener la máxima nota)

### 1. Usa la visibilidad correcta
No dejes todo en público (`+`).
* Usa **Privado (-)** para los datos internos de la clase (Atributos).
* Usa **Público (+)** solo para lo que otros objetos necesitan llamar (Métodos).
* *Tip:* LibreUML te permite cambiar esto con un clic en el candado 🔓/🔒.

### 2. Evita el "Plato de Espagueti"
Si tienes líneas cruzándose por todos lados, tu diseño probablemente está mal (alto acoplamiento).
* Mueve los nodos para desenredar las líneas.
* Si una clase está conectada a todo, es una "Clase Dios" (God Class). ¡Divídela!

### 3. Nombres Claros
* Clases: Singular y Mayúscula (`Estudiante`, no `estudiantes`).
* Interfaces: Suelen ser adjetivos o acciones (`Volador`, `Repositorio`).

---

## 📦 Cómo entregar tu tarea

Si tu profesor te pide el diagrama y el código:

1.  **Guarda tu modelo:** Ve a `File > Save` y guarda el archivo `.luml`. Este es tu "plano maestro".
2.  **Exporta la imagen:** Ve a `Export > PNG` para pegar el diagrama en tu documento PDF/Word.
3.  **Genera el código:** Ve a `Code > Generate Project`. Descarga el `.zip`.
    * *Nota:* No entregues el zip tal cual. Ábrelo, completa la lógica de los métodos y verifica que compile.

---

## ❌ Errores Comunes de Novato

* **Error:** Usar Herencia (`extends`) solo para reutilizar código.
    * *Corrección:* Úsala solo si existe una relación "Es-Un". Un `Perro` es un `Animal`. Pero una `Llanta` NO es un `Coche`.
* **Error:** Crear flechas dobles (bidireccionales) sin necesidad.
    * *Corrección:* Intenta que las relaciones tengan una sola dirección. Simplifica el código y evita ciclos infinitos.
* **Error:** Poner la lógica en el diagrama.
    * *Corrección:* El diagrama muestra *qué* hace el sistema, no *cómo* lo hace (el algoritmo va en el IDE).

---

> **Recuerda:** "Unas horas de planeación te pueden ahorrar semanas de programación." No seas ese programador que escribe código a lo loco. Planea primero.