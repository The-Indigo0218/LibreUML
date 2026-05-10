# 🤝 Contributing to LibreUML

First off, thank you for considering contributing to **LibreUML**! 🚀  
We are an open-source project built by students for students (and developers), and we value **every contribution** — whether it's fixing a typo, translating languages, or building a complex engineering engine.

---

## 🛠️ The Tech Stack

Before diving in, make sure you are comfortable with our core stack:

- **Frontend:** React 18 + TypeScript + Vite  
- **State Management:** Zustand  
- **Diagram Engine:** React Flow  
- **Styling:** Tailwind CSS  
- **Testing:** Vitest  

---

## 🚦 Getting Started

1. Fork the repository on GitHub.

2. Clone your fork locally:

```bash
git clone https://github.com/The-Indigo0218/LibreUML.git
cd LibreUML
```

3. Install dependencies:

```bash
npm install
```

4. Run the development server:

```bash
npm run dev
```

5. Run tests (please ensure everything is green before submitting):

```bash
npm run test
```

---

## 🗺️ Roadmap & Help Wanted (Wishlist)

We have a clear vision, but we need hands on deck.  
Feel free to pick a feature and open a **Pull Request**!

### 🟢 Easy / Good First Issues

- 🇧🇷 **Portuguese Translation**  
  Create `src/locales/pt.json` and add the language option in **Settings**.

- ⌨️ **Shortcuts Cheat Sheet**  
  Create a Modal or Sidebar panel listing all keyboard shortcuts (Ctrl+Z, Ctrl+C, etc.).

- 🎨 **High Contrast Theme**  
  Add a new theme in `tailwind.config.js` for better accessibility.

### 🟡 Intermediate / Features

- ☕ **Java Getters & Setters**  
  Update `JavaGeneratorService` to optionally include boilerplate getters and setters for private attributes.

- 💾 **SQL Export**  
  Implement a context menu action **Generate SQL** on a node to copy a `CREATE TABLE` script to the clipboard.

### 🔴 Advanced / Engineering Engines

- 🐍 **Python Support**  
  Create `PythonGeneratorService`.

  **Challenge:** Handle Python’s lack of strict types (use **Type Hints**) and indentation-based syntax.

- 🔷 **C# Support**  
  Create `CSharpGeneratorService`.

  **Challenge:** Handle **Namespaces** correctly.

- 🎓 **UML Linter (Education Layer)**  
  Analyze the diagram graph (nodes and edges) to detect architectural smells:
  - Circular Dependencies (A → B → A)
  - God Classes (classes with >20 methods)
  - Interface overuse

---

## 📏 Code Style & Standards

### 1. Commits

We follow the **Conventional Commits** specification.

Examples:

```text
feat(lang): add portuguese translation
fix(parser): resolve crash on empty java file
docs(readme): update installation steps
style(ui): improve button contrast
```

### 2. File Structure

We use a **Domain-Driven / Hexagonal-ish** architecture:

- `src/features/` — UI components scoped to a domain (e.g., diagram)
- `src/services/` — Pure logic (parsers, generators). **No React code**
- `src/store/` — Global state management (Zustand)

### 3. Testing

If you touch logic inside `src/services/`, you **must** add or update the corresponding test in `__tests__/`.

---

## ⚖️ Pull Request Process

1. Create a new branch:

```bash
git checkout -b feature/my-new-feature
```

2. Make your changes and commit.

3. Push to your fork and submit a **Pull Request**.

4. Describe your changes clearly.  
   📸 **Screenshots are highly appreciated for UI changes!**

---

Thank you for building with us! ❤️  
**The LibreUML Team**
