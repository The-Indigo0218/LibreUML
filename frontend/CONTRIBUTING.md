### 📝 Description
Currently, the editor allows any valid UML connection. While UML syntax permits bidirectional associations, in software architecture, this often leads to **Strong Coupling** or **Circular Dependencies**, violating the **Dependency Inversion Principle (DIP)**.

We want to add an educational layer to the tool. When a user creates a connection that results in a bidirectional relationship (A -> B and B -> A), the app should trigger an alert/notification explaining the architectural implications.

### 🎯 Goals
- Detect if a connection being made already has an existing connection in the opposite direction.
- Trigger a non-blocking educational message (e.g., `window.alert` or a custom Toast) explaining the DIP and circular dependency risks.
- Do not prevent the connection (UML allows it), just inform the user.

### 💻 Technical Context
- **Feature Location:** `src/features/diagram/component/DiagramEditor.tsx`
- **Logic:** This should be implemented within the `onConnect` callback.
- **Library:** React Flow.

### 🏷️ Labels
- `enhancement`
- `education`
- `good first issue`


# 🚀 Issue: Implementar tipos de nodos especializados

## 📝 Descripción
Actualmente, el editor solo soporta el tipo de nodo genérico `umlClass`. Para que LibreUML sea una herramienta profesional, necesitamos refactorizar el componente `UmlClassNode` para que pueda representar distintos elementos del estándar UML.

## 🎯 Objetivos
- [ ] **Refactorizar Tipos**: Actualizar la unión de tipos en `diagram.types.ts` para incluir `'umlInterface'`, `'umlAbstract'` y `'umlEnum'`.
- [ ] **Estilos Dinámicos**: Modificar `UmlClassNode.tsx` para que cambie su apariencia (colores, bordes o iconos) según el tipo de nodo.
- [ ] **Estereotipos Automáticos**: Hacer que el componente asigne el estereotipo correcto (ej: `<<Interface>>`) automáticamente si el tipo de nodo lo requiere.

## 💻 Detalles Técnicos
- **Archivo a modificar**: `src/features/diagram/component/UmlClassNode.tsx`
- **Contrato relacionado**: `src/types/diagram.types.ts`
- **Requisito**: Mantener el tipado estricto y evitar la duplicación de código (usar composición de estilos).

## 🏷️ Etiquetas
- `enhancement`
- `ui-ux`
- `good first issue`