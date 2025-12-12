# LibreUML

**LibreUML** is a lightweight, local-first, open-source UML modeling tool built for developers who prioritize performance and privacy. Unlike heavy web-based alternatives, LibreUML runs natively on the desktop, leveraging the robustness of the JVM ecosystem.

## 🏗 Architecture & Stack

LibreUML follows a **Modular Monolith** architecture, decoupling the UI from the business logic using an Event-Driven approach.

### Core Technologies
* **Language:** Java 21 (LTS) - Leveraging Records, Pattern Matching, and Virtual Threads.
* **Application Framework:** Spring Boot 3.x - Manages the Dependency Injection (DI) container, application lifecycle, and transaction management.
* **UI Framework:** JavaFX 21 - Hardware-accelerated graphics for rendering the diagram canvas.
* **Persistence:** SQLite - Serverless, zero-configuration local storage engine.

### Architectural Patterns
1.  **Spring-JavaFX Integration:**
    * The application bootstraps via a custom `ApplicationContext`.
    * JavaFX Controllers are managed as Spring Beans, allowing full `@Autowired` injection of services into UI components.
2.  **MVVM (Model-View-ViewModel):**
    * Separation of UI definition (`.fxml`), presentation logic (ViewModel/Controller), and domain data (Model).
3.  **Command Pattern:**
    * All canvas operations (Add, Move, Delete, Resize) are encapsulated as `Command` objects to support an infinite Undo/Redo stack.
4.  **Observer Pattern:**
    * The UI reacts to model changes via reactive bindings (JavaFX Properties) and Application Events.

## 🚀 Getting Started

### Prerequisites
* JDK 21+
* Maven 3.8+

### Build & Run
```bash
mvn clean javafx:run
