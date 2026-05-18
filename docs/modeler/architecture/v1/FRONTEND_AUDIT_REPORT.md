# LibreUML Frontend Audit Report — v1.0 Cloud Integration

**Date:** 2026-04-13  
**Auditor:** Claude Opus 4.6  
**Frontend Path:** `/home/indigodev/Desktop/LibreUML`  
**Backend Report:** `docs/architecture/v1/BACKEND_AUDIT_REPORT.md`  
**Quota Policy:** **10 MB per-user** (adjusted down from 30 MB for shared-server optimization)

---

## Executive Summary

The LibreUML frontend is a **~47,000-line React 19 + TypeScript + Zustand + Konva** single-page application, delivered as both a Vite web app and an Electron desktop application. The codebase reflects genuine architectural discipline: a clean domain-model layer (`src/core/domain/`), a hexagonal storage adapter pattern (`src/adapters/storage/`), a rich Konva-based canvas with connection drawing, selection, auto-layout, and SVG/image export, and a mature VFS (Virtual File System) that manages multi-diagram projects with undo/redo via Immer patches.

However, the application is **100% offline-only**. There is no HTTP client library, no authentication state, no API service layer, no routing/guards, no cloud-aware UI, and no telemetry instrumentation beyond a basic `@vercel/analytics` script. Every Zustand store persists exclusively to `localStorage` via a synchronous `StorageAdapter`, and "auto-save" merely writes local backup data. The terminal commands `cloud` and `gh` print "Coming Soon." The `StatusBar` hardcodes `isCloudConnected = false`.

The **10 MB quota limit** is a meaningful UX constraint: a single complex `.luml` project with 20–30 diagrams already approaches 1–2 MB; users with large class diagrams including Java source snippets can hit the limit in 5–8 diagrams. The frontend must surface this limit proactively, not just react to HTTP 422.

Of the six cloud modules required for v1.0, **zero** have frontend implementations — but the architecture is clean enough that integration will be additive rather than invasive. The store separation (ModelStore / VFSStore / WorkspaceStore) aligns naturally with the backend's `diagrams`, `users`, and session concepts, and the `StorageAdapter` abstraction provides a clean injection point for cloud persistence.

**Overall Cloud Readiness:** **~12%**  
**Estimated Frontend Work:** **7–9 sprints** (14–18 weeks)  
**Critical Blockers:** No HTTP client, no auth store, no routing layer, no telemetry SDK

---

## 1. Current Architecture Analysis

### 1.1 Technology Stack

| Category | Technology | Version | Notes |
|---|---|---|---|
| UI Framework | React | 19.2.0 | Latest stable |
| Language | TypeScript (strict) | 5.9.3 | `strict: true`, `noUnusedLocals`, `verbatimModuleSyntax` |
| State Management | Zustand | 5.0.9 | 9 stores, 7 persisted |
| Immutable Updates | Immer | 11.1.4 | Used in ModelStore, VFSStore |
| Canvas Rendering | Konva + react-konva | 10.2.3 / 19.2.3 | Custom shapes, edge routing, SVG export |
| Build Tool | Vite | 7.2.4 | `@vitejs/plugin-react` |
| Desktop Shell | Electron | 39.2.7 | File dialogs, `.luml` association |
| Styling | Tailwind CSS | 4.1.18 | PostCSS pipeline, custom theme tokens |
| Internationalization | i18next + react-i18next | 25.8.0 / 16.5.3 | EN + ES locales |
| File Archival | JSZip | 3.10.1 | `.luml.zip` project format |
| Auto Layout | dagre | 0.8.5 | Graph layout engine |
| Analytics (current) | `@vercel/analytics` | 1.6.1 | Minimal page-view tracking only |
| Testing | Vitest + jsdom | 4.0.18 | 18 test files |
| Icons | `lucide-react` | 0.562.0 | SVG icon library |

**Notable absences:** No HTTP client (Axios/ky/React Query), no router (react-router), no form library, no WebSocket client, no OpenTelemetry Web SDK, no error tracking (Sentry/Rollbar), no runtime schema validation (Zod/Yup).

### 1.2 State Management — Zustand Stores

The application uses **9 application-level Zustand stores** plus **3 canvas-local stores**, 7 of which persist to `localStorage` via a custom `StorageAdapter` (`src/adapters/storage/storage.adapter.ts`):

| Store | File | Persisted | Middleware | Purpose |
|---|---|---|---|---|
| `useModelStore` | `src/store/model.store.ts` | ✅ (v1) | `persist` + `immer` | Semantic model — IR classes, interfaces, enums, relations. SSoT for UML domain data. |
| `useVFSStore` | `src/store/project-vfs.store.ts` | ✅ (v1) | `persist` + `immer` | Virtual File System — project tree, diagram views, standalone local models. |
| `useWorkspaceStore` | `src/store/workspace.store.ts` | ✅ (v1) | `persist` | Editor session — open tabs, active file, per-tab connection modes. |
| `useProjectStore` | `src/store/project.store.ts` | ✅ (v1) | `persist` | Legacy SSOT for DomainNode/DomainEdge dictionaries (non-VFS canvas path). |
| `useSettingsStore` | `src/store/settingsStore.ts` | ✅ | `persist` | User preferences — auto-save toggle, theme, language, grid, minimap. |
| `useLayoutStore` | `src/store/layout.store.ts` | ✅ | `persist` | Panel visibility — left/right/bottom panels, bottom panel tab. |
| `useCodeGenerationStore` | `src/store/codeGeneration.store.ts` | ✅ (partial) | `persist` | Code generation config — target language, getter/setter toggles. |
| `useSelectionStore` | `src/store/selection.store.ts` | ❌ | — | Transient — selected node/edge IDs. |
| `useUiStore` | `src/store/uiStore.ts` | ❌ | — | Transient — active modal, editing ID, get-started widget. |
| `useToastStore` | `src/store/toast.store.ts` | ❌ | — | Transient — toast notifications with 3s auto-dismiss. |
| `stageStore` | `src/canvas/store/stageStore.ts` | ❌ | — | Konva stage reference. |
| `viewportControlStore` | `src/canvas/store/viewportControlStore.ts` | ❌ | — | Viewport zoom/pan state. |
| `inlineEditorStore` | `src/canvas/store/inlineEditorStore.ts` | ❌ | — | Inline text editing overlay state. |

**Key observation:** All persistence goes through the `StorageAdapter` abstraction (`src/adapters/storage/storage.adapter.ts:14`), which currently resolves to `localStorage` in web mode and a `localStorage`-backed cache in Electron. This is a **well-designed injection point** for adding cloud persistence — the adapter interface (`getItem` / `setItem` / `removeItem`) can be extended with an async cloud sync layer without modifying individual stores.

**Undo/Redo integration:** `ModelStore` uses a `withUndo()` bridge (`src/core/undo/undoBridge.ts`) that wraps every mutation in an Immer patch. On rehydrate, `onRehydrateStorage` clears the undo stack. This pattern will interact carefully with cloud sync — undo operates on local state, cloud sync operates on snapshots.

### 1.3 API Layer

**Current state: Non-existent.**

There is no HTTP client, no API service layer, no base URL configuration, no request interceptors, no error handling middleware. The application has zero outbound network calls to any backend API.

The only network-adjacent code:

- **`@vercel/analytics`** (`src/App.tsx:10`) — Page-view tracking via Vercel's client SDK (automatic, no custom events)
- **`window.electronAPI`** (`src/types/electron.d.ts`) — IPC bridge for Electron file dialogs (not HTTP)
- **Terminal commands** (`src/features/terminal/commands/cloud.ts`) — `cloud sync` and `gh push/clone` return `"Coming Soon"` strings

There are no environment variables for API URLs. The `vite.config.ts` has no proxy configuration. The `index.html` has no `<meta>` tags or `<link rel="preconnect">` for API base URLs.

### 1.4 Component Structure

The frontend follows a **feature-based directory structure** (~170 TypeScript files, ~47,000 LOC):

```
src/
├── adapters/              # Storage adapter (localStorage/Electron) + ReactFlow view-models
├── canvas/                # Konva canvas engine (~25 files)
│   ├── edges/             # Edge rendering, markers, geometry, obstacle avoidance
│   ├── engine/            # Grid, viewport, performance monitor, package layout
│   ├── export/            # SVG export (diagramToSvg.ts)
│   ├── hooks/             # Canvas controller, auto-layout, DnD, pan
│   ├── interactions/      # Selection, connection draw, drag, keyboard, package drop
│   ├── overlays/          # Tooltips, inline editor, package picker/modal
│   ├── shapes/            # ClassShape, NoteShape, PackageShape
│   └── store/             # Canvas-local Zustand stores
├── components/            # Shared UI components
│   ├── shared/            # ConfirmationModal, Toast, DynamicList, NameConflictModal
│   ├── ui/menubar/        # MenubarItem, MenubarTrigger, WindowControls
│   ├── Wiki/              # Wiki modal (UML reference documentation)
│   └── UndoHistoryPanel.tsx
├── config/                # Theme config, data type registry
├── core/                  # Domain layer — zero UI dependencies
│   ├── domain/models/     # Node/edge/VFS/workspace TypeScript types
│   ├── registry/          # Diagram type registry, icon map, tool registry
│   ├── undo/              # UndoManager with Immer patches, useUndoManager hook
│   └── validation/        # Class diagram + use-case validators
├── data/                  # Static wiki data
├── features/
│   ├── diagram/           # Main editor layout + modals (~40 files)
│   │   ├── components/layout/   # DiagramEditor, StatusBar, Sidebars, TabBar, ToolPalette
│   │   ├── components/menubar/  # AppMenubar + 8 menu modules (File/Edit/View/Export/...)
│   │   ├── components/modals/   # 20+ modal dialogs
│   │   ├── hooks/               # Lifecycle, actions, shortcuts, validation
│   │   └── utils/               # Auto-connect, package sync
│   ├── terminal/          # In-app terminal (commands: core, cloud, vfs, export, editor)
│   └── workspace/         # WelcomeScreen, SleepScreen
├── hooks/                 # Global hooks
│   ├── actions/           # useAutoSave, useVFSAutoSave
│   ├── canvas/            # useCanvasEventHandlers, useEdgeActions, useNodeActions
│   └── wiki/              # Wiki search/article hooks
├── i18n/                  # i18next config + EN/ES locale JSON
├── services/              # Business logic services (~15 files)
│   ├── diagram/           # DiagramIOService (serialize/deserialize/validate)
│   ├── javaGenerator.service.ts, javaParser.service.ts, javaImport.service.ts
│   ├── projectIO.service.ts     # .luml.zip project save/load
│   └── storage.service.ts       # Electron file dialogs
├── store/                 # Zustand stores (see 1.2)
├── types/                 # Electron IPC type declarations
└── utils/                 # Package helpers
```

### 1.5 Routing

**Current state: No routing.**

`src/App.tsx` renders a single component tree unconditionally:

```tsx
function App() {
  return (
    <>
      <MobileGuard />
      <DiagramEditor />
      <Analytics />
    </>
  );
}
```

`DiagramEditor` internally switches between `WelcomeScreen` (no project loaded) and the full editor layout (project loaded). There is no URL-based routing, no `react-router`, no navigation state, and no concept of protected vs. public routes.

For cloud integration, routing will be needed to support:
- `/login` — OAuth login page
- `/` — Main editor (protected)
- `/settings` — User settings, API keys, profile
- `/oauth/callback` — OAuth callback handler (backend redirects here after GitHub/Google)

### 1.6 Build & Configuration

- **Vite config** (`vite.config.ts`): Minimal — React plugin, `server.open: false`, jsdom test env. **No API proxy configured.**
- **TypeScript config** (`tsconfig.app.json`): Strict mode with `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `verbatimModuleSyntax`.
- **Environment variables:** None defined. No `.env` file present. No `VITE_*` variables referenced in code.
- **Electron build**: `electron-builder` targets Windows NSIS, macOS DMG, Linux AppImage. File association for `.luml` extension configured.

---

## 2. Feature Gap Analysis

### 2.A Authentication Module

**Backend Endpoints (from BACKEND_AUDIT_REPORT.md):**
- `GET /api/v1/oauth/{provider}/authorize` — Get OAuth authorization URL
- `GET /api/v1/oauth/{provider}/callback` — OAuth callback (sets `__Host-jwt` + `__Host-refresh` cookies, redirects)
- `POST /api/v1/auth/register` — Register with credentials
- `POST /api/v1/auth/login` — Login (sets cookies)
- `POST /api/v1/auth/refresh` — Rotate refresh token
- `DELETE /api/v1/auth/logout` — Revoke refresh token, clear cookies
- `GET /api/v1/users/me` — Get current user profile
- `PATCH /api/v1/users/about_me` — Update name/bio
- `PATCH /api/v1/users/password` — Change password
- `PATCH /api/v1/users/email` — Change email

**Frontend Requirements:**
- AuthContext / auth store with user state
- Login/register UI with OAuth buttons + credential form
- OAuth callback handler (backend redirects to frontend after auth)
- Protected route wrapper
- HTTP 401 interceptor with automatic refresh token logic
- User profile dropdown menu in header
- Logout functionality

**Current State:**

✅ **Exists:** Nothing auth-related exists in the frontend.

❌ **Missing:**
- **Auth store** — No `useAuthStore` (user, isAuthenticated, isLoading, error state)
- **HTTP client** — No Axios/fetch wrapper, no cookie interceptor, no 401 refresh logic
- **Login page** — No login UI, no OAuth buttons, no credential form
- **Route guards** — No `ProtectedRoute`, no redirect-to-login logic
- **OAuth callback handler** — No `/oauth/callback` route to handle post-authentication state
- **User profile UI** — No avatar/menu in `AppMenubar`, no profile page
- **Registration flow** — No register form, no email verification prompt
- **Logout** — No logout button wired to `DELETE /auth/logout`

**Token storage note:** Backend uses `HttpOnly` cookies (`__Host-jwt`, `__Host-refresh`), so the frontend **must not** store tokens directly. The browser manages cookies automatically via `credentials: 'include'`. This is a security win — no XSS risk of token exfiltration.

⚠️ **Needs Modification:**
- `src/App.tsx` — Must wrap content in a router and auth provider
- `src/features/diagram/components/layout/DiagramEditor.tsx` — Must be gated behind auth (or allow anonymous local mode — see §7 Migration)
- `src/features/workspace/components/WelcomeScreen.tsx` — Needs login/register CTA for unauthenticated users
- `src/features/diagram/components/menubar/AppMenubar.tsx` — Needs user menu (avatar + dropdown with Profile, Settings, Logout)
- `src/features/diagram/components/layout/StatusBar.tsx:24` — Hardcoded `isCloudConnected = false` must read from auth/sync state

**Implementation Estimate:** **8–10 days**

**Dependencies:** HTTP client must be built first. Router must be installed.

---

### 2.B Cloud Storage & 10 MB Quota Module

> ⚠️ **Quota Policy:** The backend enforces a **10 MB per-user** storage limit (adjusted down from 30 MB for shared-server optimization). The frontend must surface this limit proactively — not just react to HTTP 422 errors.

**Backend Endpoints (from BACKEND_AUDIT_REPORT.md):**
- `POST /api/v1/diagrams` — Create diagram (rejects with 422 if quota exceeded)
- `GET /api/v1/diagrams?page=0&size=20` — List user's diagrams (paginated)
- `GET /api/v1/diagrams/{id}` — Get diagram by ID
- `PATCH /api/v1/diagrams/{id}` — Partial update (requires `version` for optimistic locking)
- `DELETE /api/v1/diagrams/{id}` — Delete diagram (frees quota)
- `GET /api/v1/users/me/quota` — Returns `{ quota: 10485760, used: N, available: 10485760 - N }` *(Phase 1 backend deliverable)*

**Frontend Requirements:**
- Cloud save/load UI (menu items + modal dialogs)
- Quota progress bar: **"X MB / 10 MB"** with color-coded states (green < 70%, yellow 70–90%, red > 90%)
- Pre-flight quota check before large saves to avoid 422 round-trips
- HTTP 422 error handler with user-friendly "Storage Full" dialog
- Paginated cloud diagram list with search/sort/delete
- Optimistic locking conflict resolution (HTTP 409)

**Current State:**

✅ **Exists:**
- `useVFSStore` (`src/store/project-vfs.store.ts`) — Full VFS tree with `loadProject()`, `closeProject()`, CRUD for files/folders
- `src/services/projectIO.service.ts` — ZIP-based project save/load (`.luml.zip` format) with `downloadProject()` and `exportDiagram()`
- `src/features/diagram/components/layout/StatusBar.tsx:24` — Cloud status placeholder (`CloudOff` icon, `isCloudConnected = false`)
- `src/features/terminal/commands/cloud.ts` — Placeholder `cloud sync` command returning `"Coming Soon"`
- `src/hooks/actions/useAutoSave.ts` — Local backup auto-save with debounce (30s interval, 2s debounce)
- `src/hooks/actions/useVFSAutoSave.ts` — VFS change monitoring via Zustand `subscribe()`
- `src/adapters/storage/storage.adapter.ts` — Abstraction layer for localStorage/Electron

❌ **Missing:**
- **Cloud diagram API service** — No `DiagramApiService` to call REST endpoints
- **Cloud project list UI** — No "My Cloud Diagrams" dialog/page
- **Save to Cloud button** — No UI to explicitly push a project to the backend
- **Load from Cloud dialog** — No UI to browse and open cloud-stored diagrams
- **10 MB quota display** — No storage gauge, no usage numbers, no warning near limit
- **Pre-flight quota check** — No local calculation of payload size before send (critical for 10 MB ceiling)
- **Quota exceeded UI** — No handler for HTTP 422 with user-friendly dialog
- **Optimistic locking UI** — No handler for HTTP 409 version conflict
- **Cloud ↔ local sync strategy** — No offline queue, no conflict resolution
- **Diagram list pagination** — Backend returns `?page=0&size=20`; frontend needs infinite scroll or pagination controls

⚠️ **Needs Modification:**
- `src/adapters/storage/storage.adapter.ts` — Must be supplemented with a cloud-aware sync layer (adjacent pipeline, not modification of the sync-required `StorageAdapter` interface)
- `src/services/projectIO.service.ts:424` (`downloadProject`) — Current path produces a client-side ZIP download; a parallel `saveToCloud()` must send JSONB to `POST /diagrams`
- `src/hooks/actions/useVFSAutoSave.ts` — Currently only provides feedback on Zustand persistence; must trigger actual HTTP PATCH calls for cloud-connected projects
- `src/features/workspace/components/WelcomeScreen.tsx:87` — "Recent Projects" section is hardcoded mock data (`E-Commerce System`, `Library Management`, `Banking App`); must pull from `GET /diagrams` for authenticated users
- `src/features/diagram/components/menubar/modules/FileMenu.tsx` — Needs "Save to Cloud" / "Open from Cloud" menu items

**10 MB Quota UX Implications:**

The 10 MB ceiling is aggressive for a UML tool. Based on observed `.luml.zip` output shapes:
- A minimal project (1 diagram, 5 classes): ~5–10 KB
- A typical student project (5 diagrams, 30 classes with documentation): ~100–300 KB
- A complex project with Java import snippets and 10+ diagrams: ~1–3 MB
- A project approaching the limit: 5–8 MB (rare but possible with many diagrams and large notes)

**Recommendations:**
1. Show the quota bar **always** in the StatusBar (not just on overflow)
2. Compute payload size **client-side** before sending; warn at 80% (~8 MB)
3. At 95% (~9.5 MB), show a **hard warning** with suggestions to delete old diagrams
4. Block saves at 100% — don't round-trip to backend for a guaranteed 422
5. Measure `JSON.stringify(project).length` in bytes (UTF-8 overhead is typically ~1.05×)

**Implementation Estimate:** **12–15 days**

**Dependencies:** Auth module must be complete. HTTP client required.

---

### 2.C Auto-Save Synchronization Module

**Backend Endpoints (from BACKEND_AUDIT_REPORT.md):**
- `PATCH /api/v1/diagrams/{id}` — Partial update (title, content independently nullable, `version` required for optimistic concurrency)

**Frontend Requirements:**
- Debounced cloud save (5s recommended, configurable)
- Change detection via Zustand `subscribe()` on VFS/Model stores
- Sync status indicator: `Saving...` / `Saved ✓` / `Error ✗` / `Offline` / `Conflict`
- HTTP 409 conflict resolution dialog (overwrite / reload / cancel)
- HTTP 422 quota exceeded handler (deferred to 2.B)
- Offline queue with `localStorage` persistence and exponential-backoff retry
- Optional Web Worker for large payload serialization

**Current State:**

✅ **Exists:**
- `src/hooks/actions/useAutoSave.ts` — 30s interval + 2s debounce local backup save. Monitors `isDirty` state, serializes nodes/edges to `localStorage` under `libreuml-backup` key
- `src/hooks/actions/useVFSAutoSave.ts` — Zustand `subscribe()` listener on VFS project changes; provides `flushSave()` for Ctrl+S instant feedback (registered via `globalFlushSave`)
- `useSettingsStore.autoSave` (`src/store/settingsStore.ts:38`) — Toggle with `toggleAutoSave()` action
- `src/features/diagram/components/menubar/modules/SettingsMenu.tsx:55` — Auto-Save toggle with green check indicator
- `src/features/diagram/components/layout/StatusBar.tsx:102` — Cloud connection status display (currently hardcoded offline)

❌ **Missing:**
- **Cloud auto-save logic** — No HTTP PATCH call on debounced save; everything stays in localStorage
- **Sync status indicator** — No dynamic "Saving..." / "Saved ✓" / "Error ✗" indicator
- **Version tracking** — No `version` field maintained on the frontend for optimistic locking
- **Conflict resolution UI** — No modal/dialog for 409 version conflict resolution
- **Offline queue** — No failed-save retry queue with persistence
- **Web Worker serialization** — Large diagrams serialize on the main thread; no worker offload
- **Cloud debounce tuning** — Current 2s debounce is right for local; cloud debounce should be longer (5s recommended) to reduce HTTP chatter

⚠️ **Needs Modification:**
- `src/hooks/actions/useAutoSave.ts:29` (`performSave`) — Must add a cloud save path that fires HTTP PATCH when user is authenticated and project has a cloud ID
- `src/hooks/actions/useVFSAutoSave.ts:76` — `subscribe()` listener must integrate with a new `SyncService` that handles cloud push
- `src/features/diagram/components/layout/StatusBar.tsx:102` — Must render real-time sync status instead of hardcoded `false`

**Implementation Estimate:** **8–10 days**

**Dependencies:** Cloud Storage module (2.B) must provide the `PATCH` API call. Auth module provides the authenticated session.

---

### 2.D User Feedback Module

**Backend Endpoints (from BACKEND_AUDIT_REPORT.md):**
- `POST /api/v1/reports` — Submit bug report / feedback (types: BUG, FEEDBACK; fields: title, description, evidence images as JSONB)
- `GET /api/v1/reports/my` — List user's reports (paginated)
- `GET /api/v1/reports/{id}` — Get report by ID

**Frontend Requirements:**
- In-app bug report modal with form
- Automatic Konva canvas screenshot capture (`stage.toDataURL()`)
- Manual screenshot upload option
- Form validation (required fields, max lengths)
- Metadata auto-collection: browser info, OS, viewport size, current diagram ID, user agent
- "My Reports" list page to track submission status

**Current State:**

✅ **Exists:**
- `src/features/diagram/components/menubar/modules/HelpMenu.tsx:21` — "Report Issue" button that opens `https://github.com/The-Indigo0218/LibreUML/issues` in a new tab (external link only)
- `useToastStore` (`src/store/toast.store.ts`) — Toast notification system for success/error messages
- Konva canvas `toDataURL()` capability exists (used in `src/canvas/export/diagramToSvg.ts` and `src/services/export.service.ts`) — can be reused for screenshot capture
- `stageStore` (`src/canvas/store/stageStore.ts`) — Holds the Konva stage reference, enabling screenshot access

❌ **Missing:**
- **Bug report modal** — No in-app feedback form (title, description, type selector, screenshot attachment)
- **Screenshot capture service** — No utility to trigger canvas `toDataURL()` on modal open
- **Feedback API service** — No `ReportApiService` to call `POST /reports`
- **My reports list** — No UI to view past submitted reports
- **Form validation** — No client-side validation for report fields
- **Metadata collection** — No automatic collection of browser info, viewport, active diagram ID

⚠️ **Needs Modification:**
- `src/features/diagram/components/menubar/modules/HelpMenu.tsx:21` — "Report Issue" should open the in-app modal (keep GitHub Issues as secondary option)
- `src/store/uiStore.ts:12` — `ActiveModal` union needs new variant `'feedback'`

**Implementation Estimate:** **5–7 days**

**Dependencies:** Auth module (user must be logged in to submit reports). HTTP client.

---

### 2.E API Key Management (MCP Integration) Module

**Backend Endpoints (from BACKEND_AUDIT_REPORT.md Phase 2):**
- `POST /api/v1/api-keys` — Generate new API key (returns raw key **once**, then only hash stored)
- `GET /api/v1/api-keys` — List user's API keys (name, createdAt, lastUsedAt, revoked)
- `DELETE /api/v1/api-keys/{id}` — Revoke an API key

**Frontend Requirements:**
- Dedicated Settings page with "API Keys" tab
- "Generate New Key" flow with name input and one-time key display
- Copy-to-clipboard button with success feedback
- Warning dialog: "You will only see this key once — save it securely"
- Key list table (name, created date, last used date, revoke button)
- Revocation confirmation dialog
- MCP integration docs link

**Current State:**

✅ **Exists:** Nothing exists for API key management.

❌ **Missing:**
- **Settings page** — No dedicated settings/account page (only a dropdown menu exists at `src/features/diagram/components/menubar/modules/SettingsMenu.tsx`)
- **API Keys section** — No UI for listing, generating, or revoking API keys
- **Key generation flow** — No "Generate New Key" button, no one-time key display, no copy-to-clipboard component
- **Key list table** — No table showing key name, creation date, last used date
- **Revocation confirmation** — No confirmation dialog before revoking a key
- **API key service** — No `ApiKeyService` to call REST endpoints
- **MCP documentation link** — No link to integration docs or example usage

⚠️ **Needs Modification:**
- `src/features/diagram/components/menubar/modules/SettingsMenu.tsx` — Current menu is a dropdown; needs "Account Settings..." item that opens the new settings page
- `src/App.tsx` — Must support routing to `/settings`

**Implementation Estimate:** **5–7 days**

**Dependencies:** Auth module. Backend Phase 2 must deliver the API key endpoints first.

---

### 2.F Telemetry & Observability Module

> This module pairs the frontend with the backend's **existing** Prometheus + OpenTelemetry + Micrometer stack (backend report §3.5, §4.4). The backend already emits 4 business counters (`libreuml.diagrams.saved`, `libreuml.users.registered`, `libreuml.auth.failed_logins`, `libreuml.auth.oauth_logins`) and exposes an OTLP trace export path. The frontend has **no equivalent** — only passive `@vercel/analytics` page-view tracking.

**Backend Observability Stack (from BACKEND_AUDIT_REPORT.md):**
- Prometheus metrics at `/internal/prometheus`
- OpenTelemetry OTLP trace export (configurable via `TRACING_PROBABILITY` env var)
- Micrometer → OTEL bridge with MDC trace/span IDs propagated to Logstash JSON logs
- Kubernetes liveness/readiness probes at `/internal/health`
- 4 custom business counters (tagged)

**Frontend Requirements:**
- OpenTelemetry Web SDK for distributed tracing (propagate `traceparent` header to backend so frontend spans link to backend spans)
- Custom business event instrumentation (diagram exports, code generations, UI feature usage)
- Web Vitals tracking (LCP, FID/INP, CLS) — report to backend or dedicated metrics endpoint
- Error boundary with error tracking (send exceptions to backend logging)
- Performance marks around critical paths (auto-save serialization, canvas render, project load)
- User-consent gate (GDPR compliance for EU users)

**Current State:**

✅ **Exists:**
- `@vercel/analytics` (`src/App.tsx:10`) — Passive page-view tracking only, no custom events
- `src/canvas/engine/usePerformanceMonitor.ts` — Local canvas FPS/render-time monitoring (dev-only, not reported anywhere)
- `console.log` statements throughout auto-save/VFS code for local debugging (`src/hooks/actions/useAutoSave.ts:29`, etc.)

❌ **Missing:**
- **OpenTelemetry Web SDK** — No `@opentelemetry/sdk-trace-web`, no OTLP exporter, no `traceparent` header propagation
- **Custom event instrumentation** — No tracking of: diagram created/exported, Java import used, code generation triggered, OAuth provider chosen, wiki articles read, keyboard shortcuts used, welcome screen CTA clicked
- **Error tracking** — No React error boundary; no Sentry/Rollbar/custom error reporter
- **Web Vitals** — No `web-vitals` package integration, no LCP/INP/CLS reporting
- **Performance instrumentation** — No `performance.mark()` / `performance.measure()` around auto-save, canvas render, project load
- **Consent gate** — No cookie/telemetry consent banner for GDPR compliance
- **Telemetry service/hook** — No centralized `useTelemetry()` hook or `TelemetryService` facade

⚠️ **Needs Modification:**
- `src/App.tsx:11` — Currently only renders `<Analytics />`; needs OTel provider initialization
- Existing `console.log` statements — Replace debugging logs with structured telemetry events in release builds (but **keep dev-mode logs** — they are genuinely useful)
- `src/main.tsx` — Entry point is where OTel tracer must be initialized before React mounts

**Instrumentation Plan:**

| Event Category | Specific Events | Priority |
|---|---|---|
| **Auth** | login_success, login_failed, oauth_provider_selected, logout | P0 |
| **Diagram Lifecycle** | diagram_created, diagram_opened, diagram_saved_cloud, diagram_exported (by format) | P0 |
| **Cloud Sync** | cloud_save_start, cloud_save_success, cloud_save_error, quota_warning_shown, conflict_resolved | P0 |
| **Code Generation** | code_generated (by language), java_imported, reverse_engineered | P1 |
| **UI Engagement** | wiki_opened, shortcut_used, menubar_item_clicked, welcome_cta_clicked | P1 |
| **Performance** | LCP, INP, CLS (Web Vitals); auto_save_duration_ms, canvas_render_ms, project_load_ms | P1 |
| **Errors** | unhandled_exception, api_error, render_error | P0 |

**Backend Integration Approach:**

The backend uses Micrometer + OpenTelemetry. For the frontend to truly integrate with this stack (rather than shipping telemetry to a separate service):

1. **Distributed Tracing:** Use `@opentelemetry/sdk-trace-web` with OTLP HTTP exporter pointed at the backend OTLP endpoint (or a sidecar collector). This makes frontend spans → backend spans linkable in a tracing UI like Jaeger/Grafana Tempo.
2. **Custom Events → Backend:** Create a lightweight `POST /api/v1/telemetry/events` endpoint on the backend that accepts batched events and forwards them to Micrometer counters (not proposed in current backend roadmap — see Risk §8).
3. **Web Vitals → Backend:** Same batched endpoint; backend records as Micrometer `Timer` metrics.
4. **Alternative (simpler):** If the backend doesn't want to add a telemetry ingest endpoint, use a dedicated third-party SDK (PostHog, Sentry) for frontend events. Trade-off: no unified dashboard with backend metrics.

**Recommendation:** For v1.0, start with **approach 4** (third-party SDK like PostHog for events + Sentry for errors). Add OTel Web SDK tracing as a stretch goal in Phase 3 — it requires backend OTLP collector configuration and is not strictly a v1.0 blocker.

**Implementation Estimate:** **7–9 days**

**Dependencies:** Auth module (for user ID attribution). Backend Phase 3 if proposing a new `/telemetry/events` endpoint.

---

## 3. Architecture Assessment

### 3.1 Strengths

1. **Clean domain model layer** — `src/core/domain/vfs/vfs.types.ts` defines a rich, well-typed IR with 20+ interfaces (`IRClass`, `IRInterface`, `IREnum`, `IRRelation`, etc.). Domain types have zero UI dependencies and map naturally to the backend's JSONB `content` field.

2. **Storage adapter abstraction** — The `StorageAdapter` interface (`src/adapters/storage/storage.adapter.ts:14`) with `WebStorageAdapter` and `ElectronStorageAdapter` is a textbook strategy pattern. A `CloudStorageAdapter` or adjacent sync pipeline can be added cleanly.

3. **Store separation** — ModelStore (semantic) / VFSStore (project) / WorkspaceStore (session) cleanly match the backend's diagram CRUD surface.

4. **Undo/redo via Immer patches** — `src/core/undo/UndoManager.ts` with `withUndo()` bridge is production-grade. Stores opt in declaratively via `'model'` scope. Cloud sync operates on snapshots, so the two pipelines don't conflict.

5. **i18n from day one** — `src/i18n/config.ts` with `LanguageDetector` and EN/ES locales. All cloud-facing strings can be translated from the start.

6. **TypeScript strict mode** — Catches integration errors at compile time during cloud feature development.

7. **Feature-based directory structure** — Allows adding `features/auth/`, `features/cloud/`, `features/settings/`, `features/feedback/`, and `features/telemetry/` cleanly without touching existing code.

8. **Existing test infrastructure** — 18 test files with Vitest + jsdom, covering stores, services, validators, serialization. Test patterns are established.

### 3.2 Weaknesses

1. **Zero network capability** — No HTTP client, no API layer, no error interceptors. Largest single gap.

2. **No routing** — Single-component app with conditional rendering. Cannot support OAuth callback URLs, settings pages, or deep links.

3. **`localStorage` scale concerns** — All stores persist to `localStorage` (5–10 MB quota per origin). A complex project (2+ MB) plus other stores could approach the browser limit. With the new 10 MB backend quota, there's a tight interaction: cloud-synced projects should evict from localStorage after successful sync.

4. **Synchronous persistence** — `StorageAdapter` is synchronous (required by Zustand's `persist` middleware). Cloud sync is inherently async. Requires a parallel pipeline rather than extending the adapter.

5. **Hardcoded mock data** — `src/features/workspace/components/WelcomeScreen.tsx:87` has hardcoded "Recent Projects". Must be replaced with real data from `GET /diagrams`.

6. **No error boundary** — No React error boundary. A network error or deserialization failure crashes the whole app.

7. **Incomplete Electron storage adapter** — `src/adapters/storage/storage.adapter.ts:131` has `TODO: Phase 5.1` for native file system persistence; currently falls back to localStorage.

8. **No observability instrumentation** — Only `@vercel/analytics` for page views. No custom events, no error tracking, no Web Vitals, no distributed tracing.

### 3.3 Recommended Architecture Changes

#### A. New `src/api/` Layer

```
src/api/
├── client.ts          # Axios instance, baseURL, withCredentials, 401 interceptor
├── auth.api.ts        # login, register, logout, refreshToken, getMe
├── diagrams.api.ts    # createDiagram, listDiagrams, getDiagram, updateDiagram, deleteDiagram
├── reports.api.ts     # submitReport, listMyReports
├── apiKeys.api.ts     # generateKey, listKeys, revokeKey
├── quota.api.ts       # getQuota
└── types.ts           # Request/response TypeScript interfaces
```

#### B. New Feature Folders

```
src/features/
├── auth/              # useAuthStore, LoginPage, UserMenu, ProtectedRoute, OAuthCallback
├── cloud/             # useSyncStore, CloudSyncService, CloudProjectMapper, CloudDiagramPicker
├── feedback/          # FeedbackModal, MyReportsPanel, screenshot capture utility
├── settings/          # SettingsPage, ProfilePanel, ApiKeysPanel, PreferencesPanel
└── telemetry/         # TelemetryService, useTelemetry hook, error boundary, Web Vitals reporter
```

#### C. New Shared Components

```
src/components/shared/
├── ErrorBoundary.tsx
├── LoadingSpinner.tsx
├── SyncStatusIndicator.tsx   # Saving... / Saved / Offline / Conflict badge
├── StorageQuotaBar.tsx       # X MB / 10 MB progress bar, color-coded
├── CopyButton.tsx            # Copy-to-clipboard with feedback
└── ConsentBanner.tsx         # Telemetry consent (GDPR)
```

### 3.4 Performance Considerations

| Concern | Current | Cloud/Telemetry Impact | Mitigation |
|---|---|---|---|
| Auto-save serialization | Main thread, 2s debounce | Cloud PATCH adds network latency | Web Worker for serialization; increase cloud debounce to 5s |
| Payload size for 10 MB quota | No tracking | Must measure before send | `JSON.stringify(payload).length` check; warn at 8 MB |
| localStorage vs 10 MB quota | Unbounded | Dual-copy of project can exceed 5 MB localStorage | Evict VFS/Model from localStorage after cloud sync |
| Initial page load | All stores rehydrate sync | Cloud users also need API fetch | Show skeleton; fetch in parallel with rehydration |
| Telemetry overhead | None | OTel SDK adds ~30 KB; events fire frequently | Batch events (5s window, 50-event cap); sampling for high-volume events |

### 3.5 Security Considerations

| Control | Current | Required | Recommendation |
|---|---|---|---|
| Token storage | N/A | Backend uses `HttpOnly` cookies | Never store tokens in frontend; use `withCredentials: true` on Axios |
| XSS | React escaping by default | API responses must not use `dangerouslySetInnerHTML` | Audit any existing usage; ban via ESLint rule `react/no-danger` |
| CSRF | N/A | Backend is stateless JWT (no CSRF tokens) | Ensure same-origin or properly-scoped CORS; set `SameSite=Strict` on cookies |
| API key storage | N/A | Keys must be shown once, never persisted locally | Display in modal with copy button; clear state on modal close |
| Sensitive data in localStorage | Full project data persisted | Users on shared computers must be able to clear | "Sign Out" action clears all localStorage keys |
| Content Security Policy | None defined | Prevent script injection and lock down origins | Add CSP `<meta>` tag or HTTP header; allow only backend origin for `connect-src` |
| Telemetry consent | None | GDPR compliance for EU users | Opt-out banner on first visit; persist consent in localStorage |

---

## 4. Synchronized Phased Roadmap

The frontend phases **mirror** backend phases from `BACKEND_AUDIT_REPORT.md` exactly.

### Phase 1: Foundation, Auth & 10 MB Quota UI (Sprints 1–2, ~2 weeks)

**Backend Deliverables (Phase 1):**
- Storage quota V9 migration (`storage_quota_bytes`, `storage_used_bytes`)
- Quota enforcement in `DiagramService` — rejects with HTTP 422
- `GET /api/v1/users/me/quota` endpoint
- Paginate `GET /diagrams` (`?page=0&size=20`)

**Frontend Deliverables (Synchronized):**

**Timeline:** 2 weeks (10 working days)

#### Tasks Breakdown:

**1. HTTP Client & API Layer (3 days)**
- [ ] Install `axios@^1.7`
- [ ] Create `src/api/client.ts` — base instance with `baseURL` from `VITE_API_URL`, `withCredentials: true`, interceptors
- [ ] Implement 401 interceptor: on 401, call `POST /auth/refresh`; if refresh fails, redirect to `/login`
- [ ] Create `src/api/auth.api.ts`, `diagrams.api.ts`, `quota.api.ts`
- [ ] Create `src/api/types.ts` — TypeScript interfaces matching backend DTOs
- [ ] Add `.env.development` (`VITE_API_URL=http://localhost:8080/api/v1`) and `.env.production` (`VITE_API_URL=/api/v1`)
- [ ] Update `vite.config.ts` with API proxy for dev mode

**2. Router & Auth Store (2 days)**
- [ ] Install `react-router-dom@^7`
- [ ] Create `src/features/auth/store/auth.store.ts` — `useAuthStore` with `user`, `isAuthenticated`, `isLoading`, `error`, `login()`, `logout()`, `checkSession()`
- [ ] Create `src/features/auth/components/ProtectedRoute.tsx`
- [ ] Refactor `src/App.tsx` to use `BrowserRouter` with routes: `/login`, `/`, `/oauth/callback`, `/settings`
- [ ] Create `src/features/auth/components/OAuthCallback.tsx` — handles redirect from backend

**3. Login UI (2 days)**
- [ ] Create `src/features/auth/components/LoginPage.tsx` with:
  - GitHub OAuth button (calls `GET /oauth/github/authorize`)
  - Google OAuth button (calls `GET /oauth/google/authorize`)
  - Email/password login form
  - Registration form (toggle)
  - Loading states, error display
- [ ] Create `src/features/auth/components/UserMenu.tsx` — avatar dropdown in header
- [ ] Integrate `UserMenu` into `src/features/diagram/components/menubar/AppMenubar.tsx`
- [ ] Update `src/features/workspace/components/WelcomeScreen.tsx` to show login CTA for unauthenticated users

**4. 10 MB Quota UI (2 days)**
- [ ] Create `src/components/shared/StorageQuotaBar.tsx` — progress bar with:
  - Format: `"X.X MB / 10 MB"` (or `"X%"` compact mode)
  - Color: green < 70%, yellow 70–90%, red > 90%
  - Tooltip: exact bytes + breakdown per diagram
  - Always visible in StatusBar; expandable view with diagram breakdown
- [ ] Create `src/features/cloud/hooks/useQuota.ts` — fetches `GET /users/me/quota` on login, caches for 30s, refetches after save
- [ ] Modify `src/features/diagram/components/layout/StatusBar.tsx:102` — replace hardcoded cloud status with real auth/sync state + quota bar
- [ ] Create `src/features/cloud/utils/payloadSize.ts` — computes serialized payload size for pre-flight quota checks

**5. Error Boundary & Foundation (1 day)**
- [ ] Create `src/components/shared/ErrorBoundary.tsx` — React error boundary with recovery UI
- [ ] Create `src/components/shared/LoadingSpinner.tsx`
- [ ] Wrap `DiagramEditor` in error boundary
- [ ] Add i18n keys for all auth/cloud/quota strings (EN + ES)

**Integration Points:**
- Login → Backend sets `__Host-jwt` + `__Host-refresh` cookies → Browser includes cookies on all subsequent API calls
- Quota fetched from backend on login → displayed in StatusBar

**Success Criteria:**
- [ ] User logs in via GitHub OAuth and sees their name in the header
- [ ] Unauthenticated users redirect to `/login`
- [ ] 401 responses trigger silent token refresh
- [ ] Quota bar displays "X MB / 10 MB" with real usage
- [ ] Login page renders in EN and ES

**Risks:**
- **CORS/cookie setup** — Frontend and backend must be on same origin or properly-configured CORS with `allowCredentials: true`. Cookies with `__Host-` prefix require HTTPS + Secure + no Domain attribute. **Mitigation:** Deploy behind same-origin reverse proxy (Nginx/Caddy) — `libreuml.com/` → frontend, `libreuml.com/api/` → backend.

---

### Phase 2: Cloud Save/Load, Auto-Save & API Keys (Sprints 3–4, ~2 weeks)

**Backend Deliverables (Phase 2):**
- API key system (V10 migration, `api_keys` table)
- `ApiKeyAuthFilter` for `X-Api-Key` header
- Key management endpoints: `POST/GET/DELETE /api/v1/api-keys`
- Rate limiting for API keys
- Email verification (optional)

**Frontend Deliverables (Synchronized):**

**Timeline:** 2 weeks (10 working days)

#### Tasks Breakdown:

**1. Cloud Save/Load (4 days)**
- [ ] Create `src/features/cloud/services/CloudProjectMapper.ts` — maps `useVFSStore.project` + `useModelStore.model` → backend `CreateDiagramRequest` / `UpdateDiagramRequest` payload
- [ ] Create `src/features/cloud/services/CloudDiagramService.ts` — `saveToCloud()`, `loadFromCloud()`, `deleteFromCloud()`
- [ ] Add "Save to Cloud" menu item in `src/features/diagram/components/menubar/modules/FileMenu.tsx`
- [ ] Add "Open from Cloud" menu item
- [ ] Create `src/features/cloud/components/CloudDiagramPicker.tsx` — modal with paginated list from `GET /diagrams?page=0&size=20`, search, sort, delete
- [ ] **Pre-flight 10 MB quota check:** Before `POST /diagrams`, call `payloadSize()`; if result + used > 10 MB, show quota dialog without sending
- [ ] HTTP 422 handler: "Storage Full" modal with quota bar + "Delete old diagrams" CTA
- [ ] HTTP 409 handler: "Version Conflict" modal with overwrite/reload/cancel options

**2. Cloud Auto-Save Pipeline (3 days)**
- [ ] Create `src/features/cloud/store/sync.store.ts` — `useSyncStore` with `syncStatus` ('idle'|'saving'|'saved'|'error'|'conflict'|'offline'), `lastSyncedAt`, `cloudDiagramId`, `version`, `offlineQueue`
- [ ] Create `src/features/cloud/services/CloudSyncService.ts` — watches stores via `subscribe()`, debounces at **5s**, fires `PATCH /diagrams/{id}` with `version`, handles 409/422/network errors, exponential-backoff retry
- [ ] Create `src/features/cloud/hooks/useCloudSync.ts` — activates pipeline when user is authenticated and project has a cloud ID
- [ ] Implement offline queue: failed saves persist to `localStorage`, retry on reconnect (listen for `window.online` event)
- [ ] Create `src/components/shared/SyncStatusIndicator.tsx` — animated states: `Saving...` / `Saved ✓` (fades after 2s) / `Error ✗` (red, clickable for retry) / `Offline` (gray) / `Conflict` (red, clickable for resolution dialog)
- [ ] Integrate into `StatusBar.tsx` alongside the quota bar

**3. API Key Management UI (3 days)**
- [ ] Create `src/api/apiKeys.api.ts` — `generateKey()`, `listKeys()`, `revokeKey()`
- [ ] Create `src/features/settings/components/SettingsPage.tsx` — tabbed page (Profile | API Keys | Preferences)
- [ ] Create `src/features/settings/components/ApiKeysPanel.tsx` — table with name, created, last used, revoke button
- [ ] Create `src/features/settings/components/GenerateKeyModal.tsx` — name input → generate → show raw key once with copy button + warning
- [ ] Create `src/components/shared/CopyButton.tsx` — copy-to-clipboard with success animation
- [ ] Create `src/features/settings/components/RevokeKeyConfirmation.tsx`
- [ ] Add `/settings` route in router
- [ ] Add "Account Settings..." item in user menu

**Integration Points:**
- Auto-save fires `PATCH /diagrams/{id}` with `version` → backend checks optimistic lock → returns updated `version` → frontend stores new `version`
- API keys page calls `POST/GET/DELETE /api-keys`

**Success Criteria:**
- [ ] User saves project to cloud; reloads in a new browser session and sees it
- [ ] Auto-save silently pushes every 5s when changes detected
- [ ] Status bar shows real sync status
- [ ] 409 Conflict shows resolution dialog; 422 shows storage-full dialog with quota bar
- [ ] User generates API key, copies it, revokes it

**Risks:**
- **Pre-flight check accuracy** — Backend stores JSONB with some serialization overhead; frontend byte count may differ ~1–5%. **Mitigation:** Use 9.5 MB as the client-side hard threshold, leaving 500 KB headroom.
- **Race conditions** — User edits locally while sync is in-flight. **Mitigation:** Sync service reads current state at fire time via `useVFSStore.getState()`, not at debounce-init time.

---

### Phase 3: Feedback, Telemetry & Polish (Sprints 5–6, ~2 weeks)

**Backend Deliverables (Phase 3):**
- Rate limit all mutating endpoints
- Response compression
- Proxy trust (X-Forwarded-For whitelist)
- Kubernetes manifests
- jjwt upgrade to 0.12.x
- Cache user lookups
- Integration tests for quota, API keys, email verification
- Diagram edit counter (`libreuml.diagrams.updated`)

**Frontend Deliverables (Synchronized):**

**Timeline:** 2 weeks (10 working days)

#### Tasks Breakdown:

**1. Bug Report / Feedback Modal (3 days)**
- [ ] Create `src/api/reports.api.ts` — `submitReport()`, `listMyReports()`, `getReport()`
- [ ] Create `src/features/feedback/services/ScreenshotService.ts` — captures active Konva stage via `stageStore.getStage().toDataURL()`, compresses to JPEG < 300 KB
- [ ] Create `src/features/feedback/components/FeedbackModal.tsx` — form with type selector, title (max 200), description (max 5000), auto-screenshot with re-capture option, metadata auto-collection
- [ ] Create `src/features/feedback/components/MyReportsPanel.tsx` — list submitted reports with status indicators
- [ ] Add `ActiveModal` variant `'feedback'` to `src/store/uiStore.ts`
- [ ] Add "Report Bug" item in `HelpMenu.tsx` that opens the in-app modal (keep GitHub Issues link)
- [ ] i18n keys for feedback strings

**2. Telemetry & Observability (4 days)**

- [ ] **Choose approach** (team decision): (a) PostHog/Sentry third-party SDK, or (b) OpenTelemetry Web SDK pointing at backend OTLP collector. **Default recommendation: (a)** for v1.0 speed, (b) for Phase 4.
- [ ] Create `src/features/telemetry/services/TelemetryService.ts` — facade with `track(eventName, props)`, `identify(userId, traits)`, `page()`, buffered flush, consent gate
- [ ] Create `src/features/telemetry/hooks/useTelemetry.ts` — React hook wrapper
- [ ] Create `src/features/telemetry/WebVitalsReporter.tsx` — installs `web-vitals` (~5 KB) listeners for LCP/INP/CLS, reports via `TelemetryService`
- [ ] Create `src/components/shared/ConsentBanner.tsx` — first-visit banner with Accept/Decline; persists in `useSettingsStore`
- [ ] Enhance `ErrorBoundary.tsx` to report exceptions via `TelemetryService.track('error', { message, stack })`
- [ ] Instrument key events:
  - **Auth** (LoginPage): `login_success`, `login_failed`, `oauth_provider_selected`
  - **Diagram lifecycle** (DiagramEditor, FileMenu): `diagram_created`, `diagram_opened`, `diagram_exported`
  - **Cloud sync** (CloudSyncService): `cloud_save_success`, `cloud_save_error`, `quota_warning_shown`, `conflict_resolved`
  - **Code generation** (CodeExportConfigModal): `code_generated` (tagged by language)
  - **UI engagement** (WikiModal, KeyboardShortcutsModal): `wiki_opened`, `shortcut_used`
- [ ] Add `performance.mark()` around auto-save serialization and `performance.measure()` reported as `auto_save_duration_ms`
- [ ] Add `TelemetryService.identify(userId)` on successful login for user attribution

**3. Welcome Screen Cloud Integration & Profile (2 days)**
- [ ] Replace hardcoded `recentProjects` array in `src/features/workspace/components/WelcomeScreen.tsx:87` with data from `GET /diagrams?page=0&size=5&sort=updatedAt,desc`
- [ ] Show "Open from Cloud" CTA for authenticated users
- [ ] Show login CTA for unauthenticated users (with GitHub/Google logo)
- [ ] Create `src/features/settings/components/ProfilePanel.tsx` — display/edit name, bio, email, password
- [ ] Wire to `PATCH /users/about_me`, `PATCH /users/email`, `PATCH /users/password`
- [ ] Migrate existing preferences from `SettingsMenu.tsx` into `PreferencesPanel.tsx` in the settings page (keep menubar item as quick-access shortcuts)

**4. Comprehensive Testing (1 day)**
- [ ] Install `msw@^2` — set up for API mocking in tests
- [ ] Write tests for `useAuthStore`, `CloudSyncService`, `CloudProjectMapper`, 401 interceptor, `FeedbackModal`, `StorageQuotaBar`
- [ ] Install `@playwright/test@^1.49` — configuration only; one E2E smoke test: login → create → save → reload

**Integration Points:**
- Feedback modal captures Konva canvas → sends base64 JPEG in `evidence_images` JSONB array to `POST /reports`
- Welcome screen fetches real cloud diagrams for authenticated users
- Telemetry events flow to chosen backend (PostHog or OTLP collector)
- Error boundary reports exceptions

**Success Criteria:**
- [ ] Users submit bug reports with auto-screenshots
- [ ] Welcome screen shows real cloud projects
- [ ] Profile settings allow editing user info
- [ ] Telemetry events fire on key user actions (auth, save, export, error)
- [ ] Web Vitals reported (LCP, INP, CLS)
- [ ] Error boundary catches and reports unhandled exceptions
- [ ] Consent banner shows on first visit
- [ ] Test coverage > 80% for cloud-related code
- [ ] E2E smoke test passes

**Risks:**
- **Telemetry backend alignment** — If using OpenTelemetry Web SDK, backend needs OTLP collector (sidecar or dedicated service). Not part of backend roadmap. **Mitigation:** Default to PostHog for v1.0; add OTel integration in a v1.1 follow-up PR.
- **Screenshot size** — Konva canvas at 4K could produce multi-MB base64 strings. **Mitigation:** Downscale to 1280×720 max, JPEG quality 0.7, hard-cap at 300 KB.

---

## 5. Dependencies & Libraries

### 5.1 New Dependencies

| Package | Version | Purpose | Priority | Alternatives | Size (gzipped) |
|---|---|---|---|---|---|
| `axios` | ^1.7.0 | HTTP client with interceptors | **P0** | `ky`, native `fetch` wrapper | ~15 KB |
| `react-router-dom` | ^7.0.0 | Client-side routing | **P0** | `@tanstack/router`, `wouter` | ~12 KB |
| `@tanstack/react-query` | ^5.60.0 | Server state management, caching, retry | **P1** | SWR, custom hooks | ~13 KB |
| `zod` | ^3.23.0 | Runtime schema validation for API responses | **P1** | `yup`, manual validation | ~14 KB |
| `web-vitals` | ^4.2.0 | LCP/INP/CLS measurement | **P1** | Manual `PerformanceObserver` | ~1.7 KB |
| `posthog-js` | ^1.200.0 | Event analytics (recommended default) | **P1** | Sentry, Matomo, self-hosted OTLP | ~55 KB |
| `msw` | ^2.6.0 | API mocking for tests | **P1** (dev) | `nock`, manual mocks | Dev only |
| `@playwright/test` | ^1.49.0 | E2E testing | **P2** (dev) | `cypress` | Dev only |

**Optional (Phase 4 / stretch):**

| Package | Version | Purpose | Priority |
|---|---|---|---|
| `@opentelemetry/sdk-trace-web` | ^1.30 | Distributed tracing to backend OTLP | P3 |
| `@opentelemetry/exporter-trace-otlp-http` | ^0.57 | OTLP HTTP exporter | P3 |
| `@sentry/react` | ^8.0.0 | Alternative: error tracking | P3 |

### 5.2 Rationale

- **Axios vs. `fetch`** — Axios provides first-class interceptors (critical for 401 refresh), consistent error shapes (network vs HTTP), and `withCredentials` as a single config flag. Well-worn in the React ecosystem.
- **react-router-dom** — Required for `/oauth/callback` URL handling and `/settings` page. Most mature choice; `@tanstack/router` has better types but is less battle-tested.
- **React Query** — Dramatically simplifies server state management. Optimistic mutations for save operations. Built-in retry logic. Worth the 13 KB. If rejected, fall back to custom hooks with `useState` + `useEffect` — more boilerplate but zero extra dependency.
- **Zod** — Catches backend/frontend contract drift at runtime. TypeScript types inferred from schemas — one source of truth.
- **web-vitals** — Tiny (~1.7 KB), official Google library for measuring Core Web Vitals.
- **PostHog** — Self-hostable, privacy-friendly, unified analytics + feature flags + session replay. Preferred over Sentry + Amplitude duo for v1.0. Free tier covers LibreUML's likely early usage.
- **MSW** — Intercepts `fetch`/XHR at the network layer; test file setup is minimal.
- **Playwright** — Better cross-browser coverage than Cypress; headless-by-default; plays well with CI.

---

## 6. Testing Strategy

### 6.1 Unit Tests (Vitest)

| Target | Coverage Target | Priority |
|---|---|---|
| `useAuthStore` | 90% | P0 |
| `useSyncStore` | 90% | P0 |
| `CloudSyncService` | 85% | P0 |
| `CloudProjectMapper` | 95% | P0 |
| `payloadSize()` utility | 100% | P0 |
| API interceptors (401 refresh) | 90% | P0 |
| `StorageQuotaBar` rendering at all thresholds | 80% | P0 |
| `FeedbackModal` validation + screenshot | 80% | P1 |
| `ApiKeysPanel` CRUD flows | 80% | P1 |
| `TelemetryService` (buffering, consent gate) | 85% | P1 |

### 6.2 Integration Tests (Vitest + MSW)

| Scenario | Priority |
|---|---|
| Login flow (credential + OAuth) | P0 |
| Save to cloud → reload → verify | P0 |
| Auto-save debounce + cloud push | P0 |
| 409 Conflict resolution flow | P0 |
| **422 Quota Exceeded flow (hitting 10 MB)** | P0 |
| Offline save → reconnect → retry | P1 |
| Feedback submission with screenshot | P1 |
| API key generate → list → revoke | P1 |

### 6.3 E2E Tests (Playwright)

| Flow | Priority |
|---|---|
| Login → Create Project → Save to Cloud → Reload → Verify | P1 |
| Approach 10 MB quota → receive warning → delete old diagrams | P1 |
| Submit bug report with screenshot | P2 |
| Generate API key → copy → revoke | P2 |

### 6.4 Performance Tests

| Concern | Threshold |
|---|---|
| Auto-save serialization (500-node diagram) | < 100 ms main thread |
| Cloud PATCH latency perceived by user | 5s debounce hides network; "Saving..." shows < 200 ms |
| Initial load with auth check | < 2 s on 3G |
| Memory at 1000-node diagram | < 200 MB |

---

## 7. Migration Strategy

### 7.1 Backward Compatibility — Dual Mode

The application **must** continue to function fully offline for non-authenticated users (Electron desktop, privacy-minded users, students without accounts).

```
┌─────────────────────────────────────────────┐
│           App Launch                         │
│                                              │
│  Authenticated?                              │
│  ├─ YES → Cloud Mode                         │
│  │    • Auto-save to cloud (5s debounce)    │
│  │    • Quota bar "X MB / 10 MB" in StatusBar│
│  │    • Sync status: Saving.../Saved        │
│  │    • Cloud diagrams in list               │
│  │    • Local cache evicted after sync      │
│  │                                           │
│  └─ NO → Local Mode (current behavior)      │
│       • Save to localStorage                 │
│       • Status: "Offline" in StatusBar       │
│       • Local projects only                  │
│       • No quota limits                      │
│       • Shows "Log in to sync" CTA          │
└─────────────────────────────────────────────┘
```

- **Feature flag pattern:** Every cloud operation checks `useAuthStore.getState().isAuthenticated`. Unauthenticated path falls back to current local behavior.
- **No breaking changes to localStorage:** Existing `libreuml-*` keys continue to work as before. Cloud sync is an **additive** overlay.
- **Graceful degradation:** If the backend is unreachable, cloud-connected users fall back to local save with "Offline" indicator. Offline queue retries when `window.online` event fires.

### 7.2 Data Migration — Upload Existing Local Projects

**Scenario:** User has existing local projects in `useVFSStore` and logs in for the first time.

1. On first successful auth, check if `useVFSStore.getState().project` is non-null and not linked to a cloud ID
2. Show a **one-time migration dialog**:
   - **Title:** "Welcome! Move your work to the cloud?"
   - **Body:** "We found a local project: `<projectName>`. You can upload it to your cloud storage (uses X.X MB of 10 MB) or keep it local."
   - **Options:** `Upload to Cloud` / `Keep Local` / `Ask Later`
3. **Pre-flight 10 MB check** before upload: if `payloadSize(project) > 10 MB`, disable the upload button with explanation
4. After successful upload, set `useSyncStore.cloudDiagramId` and `version`; the project is now cloud-synced
5. Dialog persists user's choice in `useSettingsStore` so it doesn't reappear next login (unless they click "Ask Later")

**Bulk migration wizard is out of scope for v1.0.** Users typically have 1–3 projects; one-by-one upload via "Save to Cloud" menu item covers the rest.

### 7.3 User Communication

- **WelcomeScreen banner (unauthenticated):** "New! Sign in with GitHub or Google to sync your diagrams to the cloud (10 MB free)."
- **StatusBar tooltips:** Explain sync states on hover
- **Quota warning thresholds:**
  - 70% (7 MB): Silent (yellow bar color only)
  - 90% (9 MB): Toast notification: "You're using 90% of your storage. Delete old diagrams to free space."
  - 95% (9.5 MB): Blocking dialog before next save: "Storage almost full — delete old diagrams?"
  - 100%: Hard block; dialog: "Storage full. Delete diagrams to continue saving."
- **First-login onboarding:** Brief tooltip tour on cloud features (optional, not a v1.0 blocker)
- **Help docs update:** README and in-app wiki with cloud feature documentation

---

## 8. Risk Assessment

### High Risk

- **Cookie / CORS configuration mismatch** — Backend uses `__Host-jwt` cookies which require HTTPS, `Secure`, no `Domain` attribute, and `Path=/`. Frontend and backend **must share an origin** (or use a same-origin reverse proxy). **Mitigation:** Deploy behind Nginx/Caddy — `libreuml.com/` → static frontend, `libreuml.com/api/` → backend proxy. Document this clearly in deployment guide.

- **10 MB quota is aggressive** — Users with many diagrams or embedded Java snippets will hit it. Without pre-flight checks, every save could round-trip for a guaranteed 422. **Mitigation:** Client-side `payloadSize()` check with 9.5 MB threshold (leaves 500 KB headroom for backend serialization overhead); proactive warnings at 70% and 90%.

- **localStorage + cloud dual-storage** — Current architecture persists everything to localStorage (5–10 MB browser quota). A 2 MB cloud project is also 2 MB locally. Users approaching 5 MB of projects hit **browser localStorage limits** before the 10 MB cloud limit. **Mitigation:** For cloud-authenticated users, configure Zustand `persist` `partialize` to exclude project content from localStorage, keeping only cloud references (`cloudDiagramId`, `version`). Load full content from cloud on demand.

### Medium Risk

- **Auto-save race conditions** — User edits while cloud sync is in-flight. **Mitigation:** `CloudSyncService` reads `useVFSStore.getState()` at fire time, not at debounce-init time. After successful PATCH, update `useSyncStore.version` from backend response.

- **Optimistic locking UX with multiple tabs** — If two tabs are open, second save hits 409. **Mitigation:** Clear "Version Conflict" dialog with overwrite/reload/cancel. Stretch: use `BroadcastChannel` API to keep tabs in sync.

- **Electron ↔ web parity** — Desktop users expect file-system save (`.luml.zip`). **Mitigation:** Keep existing `downloadProject()` file-system path intact; cloud save is additive, not a replacement. Menu shows both "Save to File" and "Save to Cloud" options when cloud is available.

- **Telemetry backend alignment** — Backend has Prometheus/OTel for server metrics but no ingest endpoint for client events. **Mitigation:** Default to PostHog (self-hosted option available). If OTel integration is desired, add `POST /api/v1/telemetry/events` to backend roadmap as v1.1 work.

- **Consent banner friction** — GDPR compliance requires opt-in; first-visit banner adds friction. **Mitigation:** Minimal, dismissible banner. Track only essential events without consent (error reports, with IP-blind anonymization).

### Low Risk

- **Bundle size increase** — Axios + React Router + React Query + Zod + web-vitals + PostHog ≈ 110 KB gzipped. Konva is already ~130 KB. **Mitigation:** Code-split settings page, login page, and telemetry init with `React.lazy()`.

- **i18n coverage** — New cloud/auth/quota strings need EN + ES translations. **Mitigation:** Add all keys to both locales during implementation.

- **Screenshot upload size** — Konva at 4K could produce multi-MB base64. **Mitigation:** Downscale to 1280×720, JPEG 0.7 quality, hard-cap 300 KB.

- **Test infrastructure setup** — MSW + Playwright need config. Vitest is already set up. **Mitigation:** 1 day for MSW setup, 1 day for Playwright scaffolding in Phase 3.

---

## 9. Implementation Estimates

| Phase | Frontend Tasks | Estimate | Backend Dependency | Parallelizable? |
|---|---|---|---|---|
| **Phase 1** | HTTP client, Router, Auth store, Login UI, **10 MB quota bar**, Error boundary | **2 weeks** | Backend Phase 1 (quota endpoint) — BE auth already exists | Yes, FE can start immediately; quota UI finalizes when BE endpoint lands |
| **Phase 2** | Cloud save/load, Auto-save sync pipeline, 409/422 handlers, API key management | **2 weeks** | Backend Phase 2 (API keys, rate limiting) | Cloud save/load can start with existing diagram endpoints |
| **Phase 3** | Feedback modal + screenshots, Telemetry/observability, Welcome screen cloud integration, Profile settings, Comprehensive tests | **2 weeks** | Backend Phase 3 polish; optionally a `/telemetry/events` endpoint | Mostly independent; can parallelize |
| **Buffer** | Bug fixes, integration issues, performance tuning, OAuth edge cases | **1 week** | — | — |

**Total Estimated Time:** **7 weeks** (35 working days) for a single developer, **5 weeks** with 2 developers working in parallel on non-dependent tasks.

---

## 10. Appendices

### A. Proposed File Structure Changes

```diff
 src/
+├── api/                          # NEW: HTTP client + API services
+│   ├── client.ts                 # Axios instance, interceptors
+│   ├── auth.api.ts               # Auth endpoints
+│   ├── diagrams.api.ts           # Diagram CRUD endpoints
+│   ├── quota.api.ts              # Quota endpoint (10 MB)
+│   ├── reports.api.ts            # Feedback/report endpoints
+│   ├── apiKeys.api.ts            # API key management endpoints
+│   └── types.ts                  # API request/response types
 ├── adapters/
 │   └── storage/
 │       └── storage.adapter.ts    # UNCHANGED
 ├── canvas/                       # UNCHANGED
 ├── components/
 │   └── shared/
+│       ├── ErrorBoundary.tsx      # NEW: React error boundary
+│       ├── LoadingSpinner.tsx     # NEW: Reusable loading indicator
+│       ├── SyncStatusIndicator.tsx # NEW: Cloud sync badge
+│       ├── StorageQuotaBar.tsx    # NEW: "X MB / 10 MB" progress bar
+│       ├── CopyButton.tsx         # NEW: Copy-to-clipboard
+│       └── ConsentBanner.tsx      # NEW: Telemetry consent banner
 ├── features/
+│   ├── auth/                     # NEW: Authentication feature
+│   │   ├── store/auth.store.ts
+│   │   ├── components/{LoginPage,UserMenu,ProtectedRoute,OAuthCallback}.tsx
+│   │   └── hooks/useAuth.ts
+│   ├── cloud/                    # NEW: Cloud sync feature
+│   │   ├── store/sync.store.ts
+│   │   ├── services/{CloudSyncService,CloudProjectMapper,CloudDiagramService}.ts
+│   │   ├── components/CloudDiagramPicker.tsx
+│   │   ├── utils/payloadSize.ts  # Pre-flight 10 MB check
+│   │   └── hooks/{useCloudSync,useQuota}.ts
+│   ├── feedback/                 # NEW: Bug report feature
+│   │   ├── services/ScreenshotService.ts
+│   │   └── components/{FeedbackModal,MyReportsPanel}.tsx
+│   ├── settings/                 # NEW: Settings feature
+│   │   └── components/{SettingsPage,ProfilePanel,ApiKeysPanel,PreferencesPanel,GenerateKeyModal,RevokeKeyConfirmation}.tsx
+│   ├── telemetry/                # NEW: Telemetry & observability
+│   │   ├── services/TelemetryService.ts
+│   │   ├── hooks/useTelemetry.ts
+│   │   └── components/WebVitalsReporter.tsx
 │   ├── diagram/                  # Modified: FileMenu, StatusBar, AppMenubar
 │   ├── terminal/                 # Modified: cloud commands replaced with real calls
 │   └── workspace/                # Modified: WelcomeScreen uses real cloud data
 ├── store/                        # UNCHANGED: existing stores
 └── App.tsx                       # MODIFIED: BrowserRouter + routes + ErrorBoundary + ConsentBanner
```

### B. API Client Design (Reference)

```typescript
// src/api/client.ts
import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  withCredentials: true, // Send HttpOnly cookies
  headers: { 'Content-Type': 'application/json' },
});

// 401 Interceptor: refresh token and retry
let isRefreshing = false;
let failedQueue: Array<{ resolve: Function; reject: Function }> = [];

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => apiClient(originalRequest));
      }
      originalRequest._retry = true;
      isRefreshing = true;
      try {
        await apiClient.post('/auth/refresh');
        failedQueue.forEach(({ resolve }) => resolve());
        failedQueue = [];
        return apiClient(originalRequest);
      } catch {
        failedQueue.forEach(({ reject }) => reject(error));
        failedQueue = [];
        window.location.href = '/login';
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  },
);

export default apiClient;
```

### C. 10 MB Quota Pre-Flight Utility

```typescript
// src/features/cloud/utils/payloadSize.ts
const QUOTA_BYTES = 10 * 1024 * 1024; // 10 MB
const WARN_THRESHOLD = 0.70;  // 7 MB
const ALERT_THRESHOLD = 0.90; // 9 MB
const HARD_THRESHOLD = 0.95;  // 9.5 MB (client-side block)

export function payloadSize(obj: unknown): number {
  return new TextEncoder().encode(JSON.stringify(obj)).length;
}

export type QuotaLevel = 'ok' | 'warning' | 'alert' | 'blocked';

export function classifyQuota(usedBytes: number): QuotaLevel {
  const ratio = usedBytes / QUOTA_BYTES;
  if (ratio >= HARD_THRESHOLD) return 'blocked';
  if (ratio >= ALERT_THRESHOLD) return 'alert';
  if (ratio >= WARN_THRESHOLD) return 'warning';
  return 'ok';
}

export function formatQuota(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

/**
 * Pre-flight check before cloud save.
 * Returns true if safe to send; throws with user-facing message otherwise.
 */
export function canSaveToCloud(
  payload: unknown,
  currentUsedBytes: number,
): { ok: boolean; projectedUsed: number; message?: string } {
  const size = payloadSize(payload);
  const projected = currentUsedBytes + size;
  if (projected >= QUOTA_BYTES * HARD_THRESHOLD) {
    return {
      ok: false,
      projectedUsed: projected,
      message: `Saving would bring you to ${formatQuota(projected)} of your 10 MB quota. Delete old diagrams to free space.`,
    };
  }
  return { ok: true, projectedUsed: projected };
}
```

### D. Store Schema Additions

**`useAuthStore`:**
```typescript
interface AuthStoreState {
  user: {
    id: string;
    email: string;
    name: string;
    role: 'STUDENT' | 'TEACHER' | 'DEVELOPER' | 'ADMIN';
    avatarUrl?: string;
    provider?: 'CREDENTIAL' | 'GITHUB' | 'GOOGLE';
  } | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  checkSession: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}
```

**`useSyncStore`:**
```typescript
type SyncStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict' | 'offline';

interface SyncStoreState {
  syncStatus: SyncStatus;
  lastSyncedAt: number | null;
  cloudDiagramId: string | null;
  version: number;
  error: string | null;
  quotaUsedBytes: number;
  quotaTotalBytes: number; // Always 10485760 (10 MB)
  offlineQueue: Array<{ id: string; payload: unknown; attempts: number }>;

  setSyncStatus: (status: SyncStatus) => void;
  setCloudDiagram: (id: string, version: number) => void;
  incrementVersion: (newVersion: number) => void;
  updateQuota: (used: number) => void;
  clearCloudLink: () => void;
}
```

### E. Environment Variables

```env
# .env.development
VITE_API_URL=http://localhost:8080/api/v1
VITE_TELEMETRY_ENABLED=false
VITE_POSTHOG_KEY=
VITE_POSTHOG_HOST=

# .env.production
VITE_API_URL=/api/v1
VITE_TELEMETRY_ENABLED=true
VITE_POSTHOG_KEY=phc_xxx
VITE_POSTHOG_HOST=https://telemetry.libreuml.com
```

Add to `vite.config.ts`:
```typescript
server: {
  proxy: {
    '/api': { target: 'http://localhost:8080', changeOrigin: true },
  },
},
```

---

## Conclusion

The LibreUML frontend is a well-structured, mature **offline-only** UML editor with clean domain-model separation, a capable Konva canvas engine, a thoughtful storage adapter pattern, and strong TypeScript discipline. The primary gap is the complete absence of network/cloud infrastructure — no HTTP client, no auth, no routing, no API layer, and no observability instrumentation.

The existing architecture is **additive-friendly**: store separation aligns with the backend's data model, the storage adapter pattern provides a clean injection point for cloud persistence, and the feature-based directory structure supports new `auth/`, `cloud/`, `feedback/`, `settings/`, and `telemetry/` feature folders without restructuring existing code.

**Key synchronization confirmed:**
- **Phase 1**: Backend delivers quota enforcement + auth endpoints → Frontend delivers Login UI + 10 MB quota bar ✅
- **Phase 2**: Backend delivers API keys + rate limiting → Frontend delivers API key management UI + auto-save pipeline ✅
- **Phase 3**: Backend delivers polish + observability counters → Frontend delivers feedback module + telemetry instrumentation ✅

**Key decisions for the team:**
1. **Quota UX thresholds** — Recommend 70% / 90% / 95% as warning / alert / hard-block thresholds, respectively
2. **Telemetry approach** — Recommend PostHog for v1.0; add OpenTelemetry Web SDK integration with backend OTLP collector in v1.1 if desired
3. **React Query adoption** — Recommended but not strictly required; adds 13 KB but greatly simplifies server state
4. **Deployment topology** — Same-origin reverse proxy is strongly recommended due to `__Host-` cookie prefix requirements

**With 7 weeks of focused development (5 weeks with 2 devs in parallel), the frontend can be fully integrated with the backend and ready for v1.0 cloud launch.**
