# ☕ Generated Java Project Structure

Este documento describe la estructura técnica, convenciones y decisiones de diseño del **código Java generado por LibreUML** al utilizar la funcionalidad de exportación.

Está orientado principalmente a **docentes y estudiantes** que utilizan LibreUML en cursos de **Programación Orientada a Objetos (POO)**, con el objetivo de garantizar transparencia, coherencia pedagógica y compatibilidad con estándares de la industria.

---

## 📦 Estructura del Archivo Exportado (.zip)

LibreUML genera un proyecto Java completamente funcional, empaquetado en un archivo `.zip`, compatible con **Maven** o **Gradle** y listo para ser importado en cualquier IDE moderno:

- IntelliJ IDEA  
- Eclipse  
- Visual Studio Code  
- NetBeans  

### 📁 Estructura de Directorios

```text
project-name/
├── pom.xml                 (si se eligió Maven)
├── build.gradle            (si se eligió Gradle)
└── src/
    └── main/
        └── java/
            └── com/
                └── example/
                    └── domain/       (Paquete definido por el usuario)
                        ├── Usuario.java
                        ├── Producto.java
                        └── IRepositorio.java
``` 

La estructura generada sigue las **convenciones estándar de proyectos Java**, facilitando su uso tanto en **entornos académicos** como **profesionales**.

---

## 🛠️ Sistemas de Construcción (Build Tools)

Al momento de exportar un diagrama, el usuario puede elegir entre **dos estándares ampliamente utilizados en la industria**.

### 1️⃣ Maven (`pom.xml`)

LibreUML genera un archivo `pom.xml` **mínimo, limpio y fácil de extender**, con las siguientes características:

- **Versión de Java:** Configurable (8, 11, 17 o 21).
- **Plugin de compilación:**  
  `maven-compiler-plugin` configurado para respetar la versión de Java seleccionada.
- **Dependencias:**  
  Vacías por defecto, permitiendo al docente o estudiante agregar libremente:
  - JUnit
  - Mockito
  - O cualquier librería requerida por el curso.

El objetivo es **evitar ruido innecesario** y mantener el foco en los **conceptos fundamentales de POO**.

---

### 2️⃣ Gradle (`build.gradle`)

LibreUML genera un archivo `build.gradle` utilizando **Groovy DSL**, siguiendo prácticas estándar:

- **Plugins:** `java`
- **Repositorios:** `mavenCentral()`
- **Toolchain:** Configurada para la versión de Java seleccionada.

Gradle se ofrece como una alternativa **moderna y flexible**, especialmente útil en cursos intermedios o avanzados.

---

## 📝 Convenciones del Código Generado

El motor de ingeniería de LibreUML (`JavaGeneratorService`) sigue reglas estrictas para garantizar:

- Claridad del código.
- Correspondencia directa con el diagrama UML.
- Compilación exitosa sin intervención adicional.

---

### 1️⃣ Clases e Interfaces

Los nombres se respetan exactamente como aparecen en el diagrama  
(se recomienda **PascalCase**).

| Tipo UML | Código Java generado |
|--------|----------------------|
| Clase | `public class Nombre { ... }` |
| Clase abstracta | `public abstract class Nombre { ... }` |
| Interfaz | `public interface Nombre { ... }` |

Esto permite una correspondencia directa entre el **modelo visual** y el **código fuente**.

---

### 2️⃣ Atributos y Encapsulamiento

La visibilidad definida en el diagrama UML se traduce directamente a palabras clave de Java:

| UML | Java |
|----|------|
| 🟢 `+` Público | `public Tipo nombre;` |
| 🔴 `-` Privado | `private Tipo nombre;` |
| 🟡 `#` Protegido | `protected Tipo nombre;` |
| 🔵 `~` Paquete | `Tipo nombre;` |

> LibreUML **no genera getters ni setters automáticamente**, dejando esta decisión al docente o estudiante según el enfoque pedagógico del curso.

---

### 3️⃣ Relaciones y Colecciones

Las relaciones de **Agregación** o **Composición** con multiplicidad `0..*` o `1..*` se traducen automáticamente a colecciones.

#### Ejemplo UML

```text
Curso ◇─── Estudiante (*)
```

**Código generado en `Curso.java`:**

```java
private List<Estudiante> estudiantes;
```

- Se asume `java.util.List` por defecto.
- La inicialización de la colección se deja al criterio del estudiante para fomentar:
  - Comprensión del ciclo de vida de los objetos
  - Buenas prácticas de diseño
  - Discusión académica sobre constructores y responsabilidades

---

## 4️⃣ Métodos

LibreUML genera las **firmas de los métodos** definidos en el diagrama UML, con cuerpos mínimos que garantizan que el proyecto compile correctamente.

**Ejemplo:**

```java
public int calcularPromedio() {
    return 0; // Valor por defecto para tipos primitivos
}

public void guardar() {
    // TODO: Implement business logic
}
```

Este enfoque permite:

- ✅ Compilación inmediata del proyecto
- 🧠 Libertad total para implementar la lógica
- 🎯 Enfoque pedagógico en el diseño antes que en la implementación

---

## 🎓 Enfoque Pedagógico

El código generado por LibreUML **no pretende ser código final de producción**, sino:

- Un punto de partida estructurado
- Una representación fiel del diseño visual UML
- Un puente claro entre modelado y código real

El objetivo es que el estudiante comprenda que:

> 💡 **Un buen diseño conduce a una implementación más clara, mantenible y extensible.**


