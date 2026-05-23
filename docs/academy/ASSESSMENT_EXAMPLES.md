# 📝 Assessment Examples & Rúbricas

Ejemplos de ejercicios de evaluación utilizando LibreUML para cursos de Ingeniería de Software y POO.

## Ejercicio 1: Ingeniería Inversa (Análisis)
**Nivel:** Básico
**Instrucción:**
"Importe el siguiente código Java en LibreUML (copiar y pegar) y responda: ¿Qué patrón de diseño se está utilizando?"

*Código a proveer:*
```java
public class Singleton {
    private static Singleton instance;
    private Singleton() {}
    public static Singleton getInstance() { ... }
}
```

**Respuesta Esperada:** Patrón Singleton.
**Evidencia:** Captura de pantalla del diagrama mostrando la auto-asociación o el método estático subrayado.

---

## Ejercicio 2: Modelado de Dominio (Diseño)
**Nivel:** Intermedio

**Instrucción:**
"Diseñe un sistema de **Reserva de Vuelos**. Debe incluir `Pasajero`, `Vuelo`, `Aeropuerto` y `Ticket`.

**Restricciones:**
1. Un Vuelo sale de un Aeropuerto y llega a otro.
2. Un Ticket pertenece a un único Pasajero.
3. Use la visibilidad adecuada (Private para atributos)."

**Rúbrica de Evaluación (10 Pts):**
* [3 pts] Uso correcto de clases y atributos.
* [3 pts] Relación Vuelo-Aeropuerto (Asociación doble o dos asociaciones simples).
* [2 pts] Modificadores de acceso (Candado cerrado/Rojo).
* [2 pts] Código Java generado compila sin errores de sintaxis.

---

## Ejercicio 3: Refactorización Visual (Arquitectura)
**Nivel:** Avanzado

**Instrucción:**
"Se le entrega el archivo `sistema_legado.luml` (descargar adjunto). El diagrama muestra una `ClaseDios` conectada a 15 clases diferentes.

1. Identifique grupos funcionales.
2. Extraiga interfaces o clases intermedias para reducir el acoplamiento.
3. Entregue la versión refactorizada `sistema_nuevo.luml`."

---

## Ejercicio 4: Completar el Diagrama
**Nivel:** Principiante / Examen Rápido

**Instrucción:**
Se presenta un diagrama incompleto donde la clase `Pato` y la clase `Avion` no tienen relación.
"Agregue una interfaz `Volador` con el método `volar()` y haga que ambas clases la implementen."

**Objetivo:** Evaluar la diferencia entre Herencia (`extends`) e Implementación (`implements`).