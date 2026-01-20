# LibreUML

**LibreUML** is an open-source, professional UML diagram editor designed for scalability and clean architecture.

## 🏗 Architecture Pivot

This project has migrated from a Monolithic JavaFX architecture to a **Decoupled Client-Server Architecture**:

* **Backend:** Java 21+ with Spring Boot (REST API). Adheres to Hexagonal Architecture principles.
* **Frontend:** React 18+ with TypeScript and Vite. Uses React Flow for the diagramming canvas.

This separation allows for independent scaling, modern UI development, and robust API management.

## 🛠 Tech Stack:

### Backend (`/backend`)
* **Language:** Java 21
* **Framework:** Spring Boot 3.5.9
* **Architecture:** Hexagonal (Ports & Adapters)
* **Database:** PostgreSQL / H2 (Dev)
* **Build Tool:** Maven

### Frontend (`/frontend`)
* **Framework:** React
* **Language:** TypeScript (Strict Mode)
* **Build Tool:** Vite
* **Styling:** Tailwind CSS
* **Core Library:** React Flow

## 📂 Project Structure

```text
LibreUML/
├── backend/            # Spring Boot Application (API)
│   ├── src/
│   └── pom.xml
├── frontend/           # React Application (UI)
│   ├── src/
│   └── package.json
└── README.md           # Project Documentation
```

## 🚀 Getting Started

### Backend
Navigate to `/backend`.

Configure your `application.properties` (or use the default dev profile).

Run `mvn spring-boot:run`.

### Frontend
Navigate to `/frontend`.

Run `npm install`.

Run `npm run dev`.

---

Developed by Miguel Gonzalez
