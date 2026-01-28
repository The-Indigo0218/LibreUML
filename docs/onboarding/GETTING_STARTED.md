# 🚀 Getting Started with LibreUML

Bienvenido. En 5 minutos habrás creado tu primer diagrama y generado código Java real.

## Paso 1: Tu Primera Clase
1.  Abre LibreUML (Web o Desktop).
2.  Desde la barra lateral izquierda (**Toolbox**), arrastra un nodo **Class** al lienzo.
3.  Haz doble clic en el encabezado y renómbralo a `Usuario`.

## Paso 2: Añadir Atributos
1.  En el nodo `Usuario`, haz clic en el botón `+` en la sección de Atributos.
2.  Escribe: `nombre: String`.
3.  Haz clic en el icono de candado 🔓 para cambiar la visibilidad a Privado (rojo/candado cerrado).
    * *Esto generará `private String nombre;` en Java.*

## Paso 3: Crear Relaciones
1.  Arrastra otro nodo **Class** y llámalo `Direccion`.
2.  Pasa el mouse sobre el borde del nodo `Usuario`. Verás un punto azul (handle).
3.  Haz clic y arrastra hasta el nodo `Direccion`.
4.  ¡Listo! Has creado una **Asociación**.

## Paso 4: Generar Código (La Magia ✨)
1.  Ve al menú superior: **Code** > **Generate Project (.zip)**.
2.  Elige **Maven** o **Gradle**.
3.  Clic en **Download .zip**.

**Resultado:**
Abre el zip y verás la carpeta `src/main/java` con tus archivos `.java` perfectamente estructurados, listos para abrir en IntelliJ o Eclipse.

## Atajos de Teclado Útiles
* `Ctrl + S`: Guardar diagrama.
* `Ctrl + Z`: Deshacer.
* `Ctrl + D`: Duplicar nodo seleccionado.
* `Supr`: Borrar nodo/conexión.