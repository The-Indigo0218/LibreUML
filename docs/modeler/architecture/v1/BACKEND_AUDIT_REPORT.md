# LibreUML Backend Audit Report

**Date:** 2026-04-13  
**Auditor:** Claude Sonnet 4.6  
**Backend Path:** `/home/indigodev/Desktop/LibreUML Backend`

---

## Executive Summary

The LibreUML backend is a well-architected Spring Boot 3.5.10 (Java 21) REST API following a strict hexagonal (ports & adapters) architecture enforced at runtime by ArchUnit tests. In six documented development phases, the team has delivered a substantial foundation: a complete authentication system (credential + OAuth via GitHub and Google), JWT with refresh token rotation, a full user feedback/reporting system, cloud diagram CRUD with optimistic locking, and a production-grade observability stack (Prometheus, OpenTelemetry, structured logging). The codebase reflects real engineering discipline: domain invariants live in aggregate roots, security headers are configured, CVEs are patched proactively, and integration tests run against a real PostgreSQL Testcontainer.

However, two v1.0 features are missing entirely: **30 MB per-user storage quota enforcement** (no tracking column, no enforcement logic, no related metrics) and **API key authentication for external/MCP consumers** (Bearer JWT works but there is no key-issuance or key-management system). A third gap—email verification—is a UX risk rather than a hard blocker. Additionally, the in-memory rate limiter (Caffeine + Bucket4j) will not coordinate across multiple API pods, which is a meaningful scalability concern for cloud deployment.

**Overall Readiness:** ~72%  
**Estimated Work to v1.0:** 3–4 development sprints

---

## 1. Technology Stack Inventory

| Category | Technology | Version |
|---|---|---|
| Framework | Spring Boot | 3.5.10 |
| Language | Java (with preview features) | 21 |
| Build Tool | Apache Maven (wrapper) | 3.9.6 |
| Architecture Pattern | Hexagonal (Ports & Adapters) | — |
| Database | PostgreSQL | 16 (alpine) |
| ORM | Spring Data JPA + Hibernate | Boot-managed |
| Migrations | Flyway (`flyway-database-postgresql`) | Boot-managed |
| Security | Spring Security | Boot-managed |
| JWT | jjwt-api / jjwt-impl / jjwt-jackson | 0.11.5 |
| Object Mapping | MapStruct + lombok-mapstruct-binding | 1.6.3 |
| Boilerplate | Lombok | Boot-managed |
| Rate Limiting | Bucket4j-core + Caffeine | 8.10.1 |
| Cryptography | BouncyCastle (`bcprov-jdk18on`) | 1.77 |
| Observability | Spring Actuator + Micrometer Prometheus | Boot-managed |
| Distributed Tracing | Micrometer → OpenTelemetry OTLP exporter | Boot-managed |
| Structured Logging | Logstash Logback Encoder | 8.0 |
| API Documentation | SpringDoc OpenAPI (Swagger UI) | 2.8.8 |
| Testing | JUnit 5 + MockMvc + Testcontainers + ArchUnit | Boot-managed / 1.2.1 |
| Container | Docker (multi-stage) + docker-compose | — |
| HTTP Client | Spring `RestClient` (for OAuth) | Boot-managed |

**Lines of source code (estimate):** ~5,000–6,500 LOC across 100+ Java files in `src/main/java`.

---

## 2. Existing Features Matrix

| Feature | Status | Notes |
|---|---|---|
| Credential registration + login | ✅ Complete | BCrypt password, cookie-based JWT |
| JWT access token (HttpOnly cookie) | ✅ Complete | 15-minute expiry, `__Host-jwt` prefix |
| Refresh token rotation | ✅ Complete | SHA-256 hash stored in DB, IP/UA tracked |
| Password versioning | ✅ Complete | `pwdVersion` claim invalidates old tokens |
| GitHub OAuth | ✅ Complete | Full Authorization Code flow + HMAC state |
| Google OAuth | ✅ Complete | Same flow via `GoogleOAuthAdapter` |
| Rate limiting (auth endpoints) | ✅ Complete | 10 req/min; register: 3 req/hour |
| User profile management | ✅ Complete | PATCH me, password, email, social |
| Diagram CRUD | ✅ Complete | POST, GET, PATCH, DELETE |
| Diagram optimistic locking | ✅ Complete | `version` column + JPA `@Version` |
| Diagram payload limit (5 MB) | ✅ Complete | Domain-enforced in `Diagram.create()` |
| Diagram collaborators table | ✅ Complete | Schema exists; sharing endpoints TBD |
| Report/feedback submission | ✅ Complete | Types, priorities, statuses |
| Admin report dashboard | ✅ Complete | Pagination, filter by type/priority/status |
| Admin respond to reports | ✅ Complete | PATCH /{id}/respond |
| Courses + resources (edu) | ✅ Complete | Full CRUD with visibility, tags |
| Enrollments | ✅ Complete | Student–course with progress |
| Observability (Prometheus) | ✅ Complete | 4 custom Micrometer counters |
| Distributed tracing (OTEL) | ✅ Complete | OTLP export, MDC in logs |
| Structured logging (JSON) | ✅ Complete | Logstash encoder (prod profile) |
| OpenAPI / Swagger UI | ✅ Complete | `/api/docs`, `/api/api-docs` |
| Docker + docker-compose | ✅ Complete | Multi-stage build, non-root user |
| CVE-2026-24734 patched | ✅ Complete | Tomcat overridden to 10.1.52 |
| ArchUnit architecture tests | ✅ Complete | 4 rules enforcing hex boundaries |
| Integration tests (Testcontainers) | ✅ Complete | Real PostgreSQL; 3 integration suites |
| 30 MB per-user storage quota | ❌ Missing | No tracking, no enforcement |
| API key authentication | ❌ Missing | No key issuance or management system |
| Email verification | ❌ Missing | No email sending dependency |
| Active user metrics | ❌ Missing | No session/gauge metrics |
| Storage usage analytics | ❌ Missing | No per-user byte tracking |
| Multi-instance rate limiting | ❌ Missing | Caffeine is per-JVM |

---

## 3. Feature Gap Analysis

### 3.1 Authentication (OAuth)

- ✅ **Implemented:** GitHub OAuth (full flow: `GitHubOAuthAdapter`, state HMAC via `OAuthStateSigner` + BouncyCastle, primary-email fallback), Google OAuth (`GoogleOAuthAdapter`), JWT cookie issuance/refresh/revocation, password versioning, user auto-provisioning on first OAuth login.
- ❌ **Missing:** Email address verification flow (no `spring-boot-starter-mail` dependency, no verification token table). Users can register with any email they claim to own.
- ⚠️ **Needs Work:** `jjwt` 0.11.5 is two minor versions behind the current 0.12.x branch. The API changed (`io.jsonwebtoken.Claims` parsing) but the library is not vulnerable; upgrade is low-priority but recommended before v1.0.

### 3.2 User Feedback System

- ✅ **Implemented:** `POST /api/v1/reports` (types: BUG, FEEDBACK, etc.), report storage with evidence images (JSONB), paginated listing for users and admins, admin respond/status/priority mutation endpoints, full `OPEN → IN_PROGRESS → RESOLVED/CLOSED` lifecycle, `ReportService` + `ReportController`.
- ❌ **Missing:** Email notification when admin responds (no mail integration). Admin can respond but user is not notified.
- ⚠️ **Needs Work:** Admin response is a single text field (`admin_response`), not a thread. Adequate for v1.0 but may need threading for v2.

### 3.3 Cloud Storage (30 MB Quota)

This is the most significant v1.0 gap.

- ✅ **Implemented:** Full diagram CRUD (`POST /api/v1/diagrams`, `GET`, `PATCH`, `DELETE`), JSONB content storage with GIN index (`idx_diagrams_content_gin`), 5 MB per-diagram content ceiling enforced in the `Diagram` domain aggregate, `diagram_collaborators` join table.
- ❌ **Missing:**
  - No `storage_used_bytes` or `diagram_count` column on the `users` table.
  - No quota check in `DiagramService.create()` before persisting.
  - No `GET /users/me/storage` endpoint reporting usage.
  - No rejection logic when the 30 MB threshold is crossed.
  - No Micrometer gauge for per-user storage consumption.
- ⚠️ **Needs Work:** Diagram content is stored as JSONB inline in PostgreSQL. Binary assets (images embedded in diagrams) are not handled separately. The 5 MB per-diagram cap was added in Phase 4, but an accumulating limit (30 MB total across all diagrams) needs a new column and service-layer enforcement.

**Implementation estimate:** 1 sprint.
- Add `storage_quota_bytes BIGINT DEFAULT 31457280` and `storage_used_bytes BIGINT DEFAULT 0` to `users` table (V9 migration).
- In `DiagramService.create()`, load the user's quota, sum existing content sizes, reject if exceeded.
- Add a `GET /api/v1/users/me/quota` endpoint.
- Add a Micrometer gauge for storage usage.

### 3.4 Auto-Save Synchronization

- ✅ **Implemented:** `PATCH /api/v1/diagrams/{id}` accepts partial updates (title, content independently nullable), `version` field required for optimistic concurrency. Application-level version guard (fast fail with deterministic 409) plus JPA `@Version` as safety net. Both layers tested in `DiagramIntegrationTest` (including stale-version scenario).
- ⚠️ **Needs Work:** No real-time sync (WebSocket/SSE). The API is debounce-friendly for HTTP polling, which is adequate for v1.0, but collaborative real-time editing is not supported.

### 3.5 Telemetry / Metrics

- ✅ **Implemented:** `libreuml.diagrams.saved` (tagged by type), `libreuml.users.registered`, `libreuml.auth.failed_logins`, `libreuml.auth.oauth_logins` (tagged by provider), Prometheus endpoint at `/internal/prometheus`, OTLP tracing with MDC trace/span IDs in logs, Kubernetes-compatible liveness/readiness probes at `/internal/health`.
- ❌ **Missing:**
  - Active user gauge (no concurrent-session or daily-active-user tracking).
  - Storage usage metric (no per-user byte gauge).
  - Diagram edit counter (only creation tracked, not edits).
  - No Grafana dashboard definitions (infrastructure concern, not code).
- ⚠️ **Needs Work:** Failed login counter exists but there is no automated alerting rule. This is an infra/ops concern but worth noting.

### 3.6 Public External API (MCP Integration)

This is the second significant v1.0 gap.

- ✅ **Implemented:** `JwtCookieAuthFilter` already supports `Authorization: Bearer <token>` as a fallback (for non-browser clients like Electron and MCP agents). Swagger UI is public at `/api/docs`.
- ❌ **Missing:**
  - No API key entity or table (no `api_keys` migration).
  - No key issuance endpoint (`POST /api/v1/api-keys`).
  - No key revocation endpoint.
  - No rate limiting on diagram or external endpoints (only `/api/v1/auth/**` is rate-limited).
  - No dedicated MCP submission endpoint with its own validation rules.
  - No `X-API-Key` header authentication path in the security filter chain.
- ⚠️ **Needs Work:** The existing Bearer JWT fallback could serve MCP clients if they log in via credential auth, but long-lived API keys with independent rate limits are a separate requirement and are fully absent.

**Implementation estimate:** 1–1.5 sprints.
- V9/V10 migration: `api_keys` table (hashed key, user_id, name, created_at, last_used_at, revoked).
- New `ApiKeyAuthFilter` checking `X-API-Key` header.
- CRUD endpoints for key management.
- Rate limiting for API key paths (separate bucket, configurable).

---

## 4. Architecture Assessment

### 4.1 Scalability

| Concern | Status | Notes |
|---|---|---|
| Connection pooling | ✅ | HikariCP (Spring Boot default) |
| Stateless auth | ✅ | JWT → horizontal scaling is safe |
| Caching | ⚠️ | Caffeine only — per-JVM, not distributed |
| Rate limiting (multi-instance) | ❌ | Caffeine buckets are in-memory; limits reset per pod |
| Async processing | ❌ | No message queue; all ops synchronous |
| Database indexes | ✅ | `idx_diagrams_owner_id`, `idx_diagrams_content_gin`, `idx_refresh_tokens_hash`, partial indexes on OAuth IDs |

**Verdict:** Works for a single-pod deployment. Before scaling to 2+ pods, the rate limiter must be backed by Redis (Bucket4j has a Redis integration). No other blocking scalability issue.

### 4.2 Security

| Control | Status | Notes |
|---|---|---|
| SQL injection | ✅ | JPA parameterized queries throughout |
| XSS | ✅ | HttpOnly cookies, JSON-only responses, `X-Content-Type-Options` |
| CSRF | ✅ | Stateless JWT (no session), HMAC state for OAuth |
| CORS | ✅ | Env-configured origins, `allowCredentials`, max-age 3600 |
| Security headers | ✅ | HSTS (2 yr, includeSubDomains), `X-Frame-Options: DENY`, cache-control |
| Rate limiting | ⚠️ | Auth only; diagram and other endpoints unprotected |
| Secrets management | ✅ | All secrets via env vars (`${JWT_SECRET}`, `${GITHUB_CLIENT_SECRET}`, etc.) |
| Password storage | ✅ | BCrypt via `PasswordEncoderAdapter` |
| Token invalidation | ✅ | `pwdVersion` claim checked on every request |
| `X-Forwarded-For` spoofing | ⚠️ | Rate limiter trusts first IP in header without proxy whitelist |
| Input validation | ✅ | Jakarta Bean Validation on all request records |
| CVE patching | ✅ | Tomcat 10.1.52 (CVE-2026-24734 remediated) |

### 4.3 Performance

- JSONB GIN index on `diagrams.content` enables path-based queries.
- Owner index on `diagrams.owner_id` makes `GET /diagrams` (list) O(index scan).
- No N+1 issues visible in the diagram module; course/resource modules use JPA relationships and could develop N+1 patterns under load.
- No explicit caching for frequently-read data (courses, user profiles).
- No response compression configured (`server.compression.enabled` not set).

### 4.4 Monitoring & Logging

- **Logging:** Dual profile strategy — structured JSON (Logstash encoder) in prod, human-readable with traceId/spanId in dev. Log levels appropriate (Security: WARN in prod, DEBUG in dev).
- **Health:** Kubernetes liveness/readiness probes at `/internal/health/liveness` and `/internal/health/readiness`. Details visible only when authorized.
- **Metrics:** 4 business counters + all Spring Boot Actuator defaults (JVM, HTTP, DB pool). Prometheus scraping unauthenticated (standard practice for metrics infrastructure).
- **Tracing:** 100% sampling in dev; configurable via `TRACING_PROBABILITY` env var for prod.

### 4.5 Deployment Readiness

| Item | Status | Notes |
|---|---|---|
| Dockerfile | ✅ | Multi-stage build; non-root `spring` user |
| docker-compose | ✅ | API + PostgreSQL 16-alpine with health check |
| Env var configuration | ✅ | All secrets and overrides via env |
| Flyway auto-migration | ✅ | `baseline-on-migrate: true` |
| Production vs dev configs | ✅ | `application.yml` + `application-dev.yml` profiles |
| Kubernetes manifests | ❌ | No k8s YAML (Deployment, Service, Ingress) |
| Database backup strategy | ❌ | Not defined (docker-compose volume only) |
| Response compression | ❌ | Not configured |

---

## 5. Risk Assessment

### 5.1 Technical Debt

| Item | Severity | Notes |
|---|---|---|
| `jjwt` 0.11.5 (not 0.12.x) | Low | Functional but API deprecated in 0.12; no CVE |
| In-memory rate limiter | Medium | Breaks under horizontal scaling; needs Redis |
| `X-Forwarded-For` trust | Medium | No proxy IP whitelist; attackers can forge IPs |
| No response compression | Low | Increases bandwidth cost in cloud |
| Q&A module (Answer/Question) | Low | Services exist but no controllers; dead code for now |

### 5.2 Missing Critical Features (v1.0 Blockers)

| Feature | Blocking? | Effort |
|---|---|---|
| 30 MB storage quota enforcement | **Yes** | ~5 days |
| API key auth for MCP | **Yes** | ~7 days |
| Email verification | Soft | ~3 days |
| Rate limiting on non-auth endpoints | Soft | ~2 days |

### 5.3 Performance Bottlenecks

- **Diagram content serialization:** `content.toString().getBytes(UTF_8)` in `Diagram.assertPayloadSize()` double-serializes the JSON on every create/update. For large diagrams, this is a minor CPU cost but measurable at scale.
- **No pagination on `GET /diagrams`:** `listByOwner()` returns all diagrams for a user with no paging. A user with hundreds of diagrams causes a full table scan on that user's rows.
- **No cache for user lookups:** Every authenticated request calls `loadUserByUsername(email)` → DB hit to validate `pwdVersion`. Caching with a short TTL (e.g., 30 s) would reduce DB load.

### 5.4 Security Concerns

| Concern | Severity | Recommendation |
|---|---|---|
| No rate limit on `POST /diagrams` | Medium | Add per-user diagram creation rate limit |
| `X-Forwarded-For` IP spoofing bypasses rate limits | Medium | Trust only from known proxy CIDR ranges |
| No refresh token family tracking | Low | If a refresh token is stolen, both parties can use it until expiry; consider token families |
| Swagger UI accessible without login | Informational | Acceptable for dev/docs; ensure no sensitive data exposed |

---

## 6. Recommended Action Plan

### Phase 1: Critical Path (Sprint 1–2, ~2 weeks)

- [ ] **Storage quota (V9 migration):** Add `storage_quota_bytes` (default 31,457,280 = 30 MB) and `storage_used_bytes` (default 0) to `users` table.
- [ ] **Quota enforcement in `DiagramService`:** Before `diagramRepository.save()` in `create()`, compute current usage and reject with `QuotaExceededException` (→ HTTP 422) if the new diagram would exceed quota. Update `storage_used_bytes` on create and delete.
- [ ] **Quota endpoint:** `GET /api/v1/users/me/quota` returning `{quota, used, available}`.
- [ ] **Quota metrics:** Add `Gauge` in `MicrometerMetricsAdapter` for storage utilization (or derive from DB query in a scheduled job).
- [ ] **Paginate `GET /diagrams`:** Add `?page=0&size=20` query params; return `PagedResult<DiagramSummaryResponse>` consistent with the report endpoint.

### Phase 2: Core Features (Sprint 3–4, ~2 weeks)

- [ ] **API key system (V10 migration):** Create `api_keys` table (`id`, `user_id`, `name`, `key_hash VARCHAR(64)`, `created_at`, `last_used_at`, `revoked BOOLEAN`).
- [ ] **`ApiKeyAuthFilter`:** Check `X-Api-Key` header; resolve user from hashed key; set security context. Run before `JwtCookieAuthFilter`.
- [ ] **Key management endpoints:** `POST /api/v1/api-keys` (generate + return raw key once), `GET /api/v1/api-keys` (list), `DELETE /api/v1/api-keys/{id}` (revoke).
- [ ] **Rate limiting for API keys:** Separate Bucket4j bucket (e.g., 60 req/min per key) in a new `ApiKeyRateLimitFilter`.
- [ ] **Distributed rate limiting:** Replace Caffeine with Redis-backed Bucket4j (`bucket4j-redis`) or extract rate limiting to an API gateway (Kong/Nginx) for horizontal-scale deployments.
- [ ] **Email verification:** Add `spring-boot-starter-mail`, verification token table (V11), `POST /api/v1/auth/verify-email` endpoint, send verification email on registration.

### Phase 3: Polish & Testing (Sprint 5–6, ~1 week)

- [ ] **Rate limit all mutating endpoints:** Extend `RateLimitFilter` to cover `POST /api/v1/diagrams` (e.g., 60 req/min per user).
- [ ] **Response compression:** Set `server.compression.enabled=true`, `min-response-size=2048` in `application.yml`.
- [ ] **Proxy trust:** Whitelist known proxy CIDRs before trusting `X-Forwarded-For` in IP extraction helpers.
- [ ] **Kubernetes manifests:** Add `k8s/` directory with `Deployment`, `Service`, `Ingress`, `ConfigMap`, `HorizontalPodAutoscaler` YAML.
- [ ] **Upgrade jjwt to 0.12.x:** Migrate from deprecated `Jwts.parser()` to `Jwts.parserBuilder()`.
- [ ] **Cache user lookups:** Add short-TTL Caffeine cache in `CustomUserDetailsService` to reduce DB hits per request.
- [ ] **Integration tests for quota, API keys, email verification:** Extend `AbstractIntegrationTest` infrastructure.
- [ ] **Diagram edit counter:** Add `libreuml.diagrams.updated` in `MicrometerMetricsAdapter` and call from `DiagramService.update()`.

---

## 7. Appendices

### A. File Structure Tree

```
LibreUML Backend/
├── src/
│   ├── main/
│   │   ├── java/com/libreuml/backend/
│   │   │   ├── domain/model/          # Aggregate roots, value objects, enums
│   │   │   │   ├── Diagram.java       # Core cloud diagram aggregate
│   │   │   │   ├── User.java, Student, Teacher, Developer
│   │   │   │   ├── Course.java, Resource, CourseResource, Enrollment
│   │   │   │   ├── Report.java, ReportStatus, ReportPriority, ReportType
│   │   │   │   ├── RefreshToken.java
│   │   │   │   └── exception/         # Domain exceptions
│   │   │   ├── application/           # Use cases + ports
│   │   │   │   ├── auth/              # OAuth, refresh token, login use cases
│   │   │   │   ├── diagram/           # Create/Get/Update/Delete use cases
│   │   │   │   ├── user/              # Register, update, password use cases
│   │   │   │   ├── courses/           # Course management use cases
│   │   │   │   ├── courseResource/    # Course resource management
│   │   │   │   ├── enrollment/        # Enrollment management
│   │   │   │   ├── report/            # Report lifecycle use cases
│   │   │   │   ├── resource/          # Learning resource use cases
│   │   │   │   ├── answer/            # Q&A (no HTTP layer yet)
│   │   │   │   ├── question/          # Q&A (no HTTP layer yet)
│   │   │   │   └── common/            # PagedResult, PaginationCommand, MetricsPort
│   │   │   └── infrastructure/
│   │   │       ├── in/web/
│   │   │       │   ├── controller/    # 9 REST controllers
│   │   │       │   ├── dto/           # Request/response records
│   │   │       │   ├── mapper/        # MapStruct web mappers
│   │   │       │   ├── filter/        # RateLimitFilter, RegisterRateLimitFilter
│   │   │       │   └── advice/        # GlobalControllerAdvice (ProblemDetail)
│   │   │       ├── out/
│   │   │       │   ├── persistence/   # JPA entities, Spring Data repos, adapters
│   │   │       │   ├── oauth/         # GitHubOAuthAdapter, GoogleOAuthAdapter
│   │   │       │   └── metrics/       # MicrometerMetricsAdapter
│   │   │       └── security/
│   │   │           ├── config/        # SecurityConfig, PasswordEncoderConfig
│   │   │           ├── JwtCookieAuthFilter.java
│   │   │           ├── JwtAuthenticationFilter.java
│   │   │           ├── JwtAdapter.java
│   │   │           ├── OAuthStateSigner.java  (BouncyCastle HMAC-SHA256)
│   │   │           ├── CustomUserDetails.java
│   │   │           ├── CustomUserDetailsService.java
│   │   │           └── cookie/CookieTokenStrategy.java
│   │   └── resources/
│   │       ├── application.yml
│   │       ├── application-dev.yml
│   │       ├── logback-spring.xml
│   │       └── db/migration/          # V1–V8 Flyway scripts
│   └── test/
│       └── java/com/libreuml/backend/
│           ├── AbstractIntegrationTest.java
│           ├── ArchitectureTest.java   (4 ArchUnit rules)
│           ├── LibreUmlBackendApplicationTests.java
│           ├── TestcontainersConfiguration.java
│           └── application/*/service/ (unit tests: UserServiceTest, etc.)
│           └── infrastructure/in/web/controller/
│               ├── AuthSecurityIntegrationTest.java
│               ├── OAuthIntegrationTest.java
│               └── DiagramIntegrationTest.java
├── Dockerfile                          (multi-stage, non-root user)
├── docker-compose.yml                  (API + Postgres 16-alpine)
├── pom.xml
├── mvnw / mvnw.cmd
├── CHANGELOG-PHASE-3.md … CHANGELOG-PHASE-6.md
└── STRUCTURE.md
```

### B. API Endpoints Inventory

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/auth/register` | Public | Register new user |
| POST | `/api/v1/auth/login` | Public | Login; sets `__Host-jwt` + `__Host-refresh` cookies |
| POST | `/api/v1/auth/refresh` | Cookie | Rotate refresh token |
| DELETE | `/api/v1/auth/logout` | Cookie | Revoke refresh token, clear cookies |
| GET | `/api/v1/oauth/{provider}/authorize` | Public | Get OAuth authorization URL |
| GET | `/api/v1/oauth/{provider}/callback` | Public | OAuth callback; sets cookies; redirects to frontend |
| GET | `/api/v1/users/me` | JWT | Get current user profile |
| PATCH | `/api/v1/users/about_me` | JWT | Update name, bio |
| PATCH | `/api/v1/users/social_profile` | JWT | Update social links |
| PATCH | `/api/v1/users/password` | JWT | Change password |
| PATCH | `/api/v1/users/email` | JWT | Update email |
| POST | `/api/v1/courses` | JWT | Create course |
| GET | `/api/v1/courses/{id}` | JWT | Get course |
| PATCH | `/api/v1/courses/{id}/title` | JWT | Update course title/description |
| PATCH | `/api/v1/courses/{id}/visibility` | JWT | Toggle course visibility |
| DELETE | `/api/v1/courses/{id}` | JWT | Deactivate course |
| POST | `/api/v1/reports` | JWT | Submit bug report / feedback |
| GET | `/api/v1/reports/my` | JWT | List my reports (paginated) |
| GET | `/api/v1/reports/{id}` | JWT | Get report by ID |
| GET | `/api/v1/reports` | ADMIN | List all reports (paginated, filterable) |
| PATCH | `/api/v1/reports/{id}/status` | ADMIN | Update report status |
| PATCH | `/api/v1/reports/{id}/priority` | ADMIN | Update report priority |
| PATCH | `/api/v1/reports/{id}/respond` | ADMIN | Respond to report |
| POST | `/api/v1/diagrams` | JWT | Create diagram |
| GET | `/api/v1/diagrams` | JWT | List all user's diagrams |
| GET | `/api/v1/diagrams/{id}` | JWT | Get diagram by ID |
| PATCH | `/api/v1/diagrams/{id}` | JWT | Partial update (auto-save, requires `version`) |
| DELETE | `/api/v1/diagrams/{id}` | JWT | Delete diagram |
| GET | `/internal/health/**` | Public | Kubernetes liveness/readiness probes |
| GET | `/internal/prometheus` | Public | Prometheus metrics scrape |
| GET | `/api/docs/**` | Public | Swagger UI |
| GET | `/api/api-docs/**` | Public | OpenAPI JSON spec |

### C. Database Schema

| Table | Description | Key Columns |
|---|---|---|
| `users` | Polymorphic user entity | `id UUID`, `user_type`, `email UNIQUE`, `password`, `role`, `password_version`, `github_id`, `google_id` |
| `courses` | UML learning courses | `id`, `title`, `slug UNIQUE`, `creator_id → users`, `visibility`, `tags JSONB` |
| `resources` | Course content units | `id`, `type`, `content TEXT`, `creator_id → users`, `tags JSONB` |
| `course_resources` | Course–resource join | `course_id`, `resource_id`, `position`, `visible` |
| `enrollments` | Student–course join | `student_id → users`, `course_id → courses`, `progress`, `UNIQUE(student, course)` |
| `reports` | User feedback/bug reports | `id`, `user_id → users`, `type`, `status`, `priority`, `admin_response`, `evidences_images JSONB` |
| `refresh_tokens` | Refresh token store | `id`, `user_id → users`, `token_hash VARCHAR(64) UNIQUE`, `expires_at`, `revoked`, `ip_address`, `user_agent` |
| `diagrams` | Cloud UML diagrams | `id`, `owner_id → users`, `title`, `type`, `visibility`, `content JSONB`, `version BIGINT` |
| `diagram_collaborators` | Diagram sharing | `diagram_id → diagrams`, `user_id → users`, PK composite |

**Indexes of note:** `idx_diagrams_owner_id`, `idx_diagrams_content_gin` (GIN on JSONB), `idx_refresh_tokens_hash`, `idx_users_github_id` (partial), `idx_users_google_id` (partial).

### D. Dependencies List

| Artifact | Version | Purpose |
|---|---|---|
| `spring-boot-starter-web` | 3.5.10 | REST API |
| `spring-boot-starter-data-jpa` | 3.5.10 | ORM / persistence |
| `spring-boot-starter-validation` | 3.5.10 | Jakarta Bean Validation |
| `spring-boot-starter-security` | 3.5.10 | Spring Security |
| `spring-boot-starter-actuator` | 3.5.10 | Health + metrics endpoints |
| `flyway-core` + `flyway-database-postgresql` | Boot-managed | DB migrations |
| `postgresql` (JDBC driver) | Boot-managed | PostgreSQL connectivity |
| `jjwt-api/impl/jackson` | 0.11.5 | JWT signing and parsing |
| `mapstruct` + `mapstruct-processor` | 1.6.3 | DTO ↔ domain mapping |
| `lombok` | Boot-managed | Boilerplate reduction |
| `bucket4j-core` | 8.10.1 | Token-bucket rate limiting |
| `caffeine` | Boot-managed | In-memory cache for rate buckets |
| `bcprov-jdk18on` | 1.77 | HMAC-SHA256 for OAuth state signing |
| `micrometer-registry-prometheus` | Boot-managed | Prometheus metrics export |
| `micrometer-tracing-bridge-otel` | Boot-managed | Micrometer → OpenTelemetry bridge |
| `opentelemetry-exporter-otlp` | Boot-managed | OTLP trace export |
| `logstash-logback-encoder` | 8.0 | JSON structured logging |
| `springdoc-openapi-starter-webmvc-ui` | 2.8.8 | Swagger UI + OpenAPI JSON |
| `spring-boot-testcontainers` | 3.5.10 | Testcontainers integration |
| `testcontainers:postgresql` | Boot-managed | Real PostgreSQL in tests |
| `archunit-junit5` | 1.2.1 | Architecture constraint testing |
| `tomcat.version` override | **10.1.52** | CVE-2026-24734 patch |