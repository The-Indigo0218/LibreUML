# 👨‍🏫 Teaching Guide: Clase de 90 Minutos

Esta guía propone una sesión práctica para introducir **Programación Orientada a Objetos (POO)** utilizando LibreUML.

**Objetivo:** Pasar de un requerimiento en texto a un diagrama estructural y finalmente a código Java.
**Duración:** 90 Minutos.
**Nivel:** Introductorio (CS101 / POO I).

---

## 🕒 Minuto 0-15: El Problema (Sin Computadora)
**Teoría:** Breve repaso de Clase vs. Objeto.
**Actividad:** Escriba el siguiente requerimiento en el pizarrón:

> *"Diseñe un sistema para una Tienda en Línea. Un **Cliente** puede realizar un **Pedido**. El pedido tiene un total y una lista de **Productos**. Algunos productos son físicos (pesan) y otros digitales (se descargan)."*

**Discusión:** Pida a los alumnos identificar los sustantivos (Clases) y verbos (Métodos).

---

## 🕒 Minuto 15-45: Modelado en LibreUML
**Instrucción:** Abran LibreUML.

1.  **Paso 1: Entidades (10 min)**
    * Crear clases `Cliente`, `Pedido`, `Producto`.
    * Añadir atributos obvios (`nombre`, `precio`, `fecha`).
    * *Reto:* Discutir la visibilidad. ¿El `total` del pedido debe ser público? (No, debe ser calculado o privado).

2.  **Paso 2: Relaciones (10 min)**
    * Conectar `Cliente` -> `Pedido` (Asociación o Agregación).
    * Conectar `Pedido` -> `Producto` (Agregación/Composición 1..*).

3.  **Paso 3: Herencia (10 min)**
    * Crear clases `ProductoFisico` y `ProductoDigital`.
    * Usar la flecha de **Generalización** (Triángulo vacío) hacia `Producto`.
    * Mover el atributo `peso` solo a `ProductoFisico`.

---

## 🕒 Minuto 45-60: Refinamiento y Polimorfismo
**Teoría:** Clases Abstractas e Interfaces.

1.  **Abstract:** Marcar la clase padre `Producto` como **Abstracta** (ya que no vendemos "productos genéricos", solo físicos o digitales).
2.  **Método Abstracto:** Añadir `calcularEnvio()` en `Producto`.
    * En `ProductoDigital`, el envío es $0.
    * En `ProductoFisico`, el envío depende del peso.
    * *Esto visualiza el polimorfismo.*

---

## 🕒 Minuto 60-75: Generación de Código (El "Wow" Moment)
1.  Pedir a los alumnos ir a **Code > Generate Project**.
2.  Descargar el ZIP y abrirlo en el IDE (IntelliJ/Eclipse).
3.  **Actividad:** Inspeccionar el código generado.
    * Ver cómo `extends` se generó automáticamente.
    * Ver cómo las listas `List<Producto>` se crearon en `Pedido`.

---

## 🕒 Minuto 75-90: Cierre y Tarea
**Reflexión:** ¿Por qué fue más fácil cambiar la herencia en el diagrama que reescribir 10 archivos de código?
**Tarea:** Extender el sistema agregando un método de pago (`Interface IPagable`) que implementen `Tarjeta` y `PayPal`.