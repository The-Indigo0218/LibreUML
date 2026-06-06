// Enums — mirror backend domain model exactly
export type DiagramType =
  | 'SEQUENCE'
  | 'CLASS'
  | 'USE_CASE'
  | 'ACTIVITY'
  | 'STATE'
  | 'COMPONENT'
  | 'DEPLOYMENT'
  | 'ER';

// Extended type for the new projects API (includes PACKAGE, OBJECT, DOMAIN, UNSPECIFIED)
export type ProjectDiagramType =
  | DiagramType
  | 'PACKAGE'
  | 'OBJECT'
  | 'DOMAIN'
  | 'UNSPECIFIED';

export type DiagramVisibility = 'PRIVATE' | 'SHARED' | 'PUBLIC';

export type UserRole = 'TEACHER' | 'STUDENT' | 'DEVELOPER' | 'MODERATOR' | 'ADMIN';

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  fullName: string;
  email: string;
  password: string;
  role: 'STUDENT' | 'TEACHER' | 'DEVELOPER';
}

// ── Users ─────────────────────────────────────────────────────────────────────

export interface UserResponse {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  academicDegrees: string[];
  organization: string[];
  stacks: string[];
}

// ── Diagrams ──────────────────────────────────────────────────────────────────

export interface DiagramSummaryResponse {
  id: string;
  title: string;
  type: DiagramType;
  visibility: DiagramVisibility;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface DiagramDetailResponse {
  id: string;
  ownerId: string;
  title: string;
  type: DiagramType;
  visibility: DiagramVisibility;
  // JSONB payload — shape validated by CloudProjectMapper
  content: unknown;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDiagramRequest {
  title: string;
  type: DiagramType;
  content?: Record<string, unknown>;
}

export interface UpdateDiagramRequest {
  title?: string;
  content?: Record<string, unknown>;
  version: number;
}

// ── Projects ──────────────────────────────────────────────────────────────────

export interface ProjectDiagramSummary {
  id: string;
  name: string;
  diagramType: ProjectDiagramType;
  path: string;
  version: number;
  updatedAt: string;
}

export type ProjectKind = 'SOFTWARE_ARCHITECTURE' | 'FREE';

export interface ProjectSummaryResponse {
  id: string;
  name: string;
  description?: string;
  author?: string;
  projectVersion: string;
  projectKind?: ProjectKind;
  targetLanguage?: string;
  basePackage?: string;
  visibility: DiagramVisibility;
  version: number;
  diagramCount: number;
  diagramTypes: ProjectDiagramType[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDetailResponse {
  id: string;
  name: string;
  description?: string;
  author?: string;
  projectVersion: string;
  projectKind?: ProjectKind;
  targetLanguage?: string;
  basePackage?: string;
  visibility: DiagramVisibility;
  version: number;
  vfsSnapshot?: Record<string, unknown>;
  diagrams: ProjectDiagramSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  author?: string;
  projectVersion?: string;
  projectKind?: 'SOFTWARE_ARCHITECTURE' | 'FREE';
  targetLanguage?: string;
  basePackage?: string;
  vfsSnapshot?: Record<string, unknown>;
}

export interface CreateProjectResponse {
  id: string;
  modelId: string;
  version: number;
  createdAt: string;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  author?: string;
  targetLanguage?: string;
  basePackage?: string;
  vfsSnapshot?: Record<string, unknown>;
  version: number;
}

export interface UpdateProjectResponse {
  id: string;
  version: number;
  updatedAt: string;
}

// ── Project Model ─────────────────────────────────────────────────────────────

export interface ModelResponse {
  id: string;
  projectId: string;
  data: Record<string, unknown>;
  version: number;
  updatedAt: string;
}

export interface UpdateModelRequest {
  data: Record<string, unknown>;
  version: number;
}

export interface UpdateModelResponse {
  id: string;
  version: number;
  updatedAt: string;
}

// ── Project Diagrams ──────────────────────────────────────────────────────────

export interface CloudDiagramResponse {
  id: string;
  projectId: string;
  name: string;
  diagramType: ProjectDiagramType;
  path: string;
  viewData: Record<string, unknown>;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCloudDiagramRequest {
  name: string;
  diagramType: ProjectDiagramType;
  path?: string;
  viewData?: Record<string, unknown>;
}

export interface CreateCloudDiagramResponse {
  id: string;
  projectId: string;
  version: number;
  createdAt: string;
}

export interface UpdateCloudDiagramRequest {
  name?: string;
  viewData?: Record<string, unknown>;
  version: number;
}

export interface UpdateCloudDiagramResponse {
  id: string;
  version: number;
  updatedAt: string;
}

// ── Full project load ─────────────────────────────────────────────────────────

export interface ProjectFullResponse {
  project: ProjectDetailResponse;
  model: ModelResponse;
  diagrams: CloudDiagramResponse[];
}

// ── Quota ─────────────────────────────────────────────────────────────────────

export interface QuotaResponse {
  quota: number;
  used: number;
  available: number;
  breakdown?: {
    models: number;
    diagrams: number;
  };
}

// ── Pagination ────────────────────────────────────────────────────────────────

// Field names match Spring Boot's PagedResult record serialization (Jackson 2.18,
// Spring Boot 3.5): components are serialized by their canonical names — `isLast`
// remains `isLast`, not `last`.
export interface PagedResult<T> {
  content: T[];
  pageNumber: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
  isLast: boolean;
}

// ── OAuth ─────────────────────────────────────────────────────────────────────

export interface OAuthAuthorizeResponse {
  authorizationUrl: string;
}

// ── API Keys ──────────────────────────────────────────────────────────────────

export type ApiKeyScope = 'read' | 'write';

export interface CreateApiKeyRequest {
  name: string;
  scope: ApiKeyScope;
}

/** Shape returned by GET /api-keys — raw key is NOT included. */
export interface ApiKeyResponse {
  id: string;
  name: string;
  scope: ApiKeyScope;
  createdAt: string;
  lastUsedAt: string | null;
  revoked: boolean;
}

/** Shape returned by POST /api-keys — raw key shown once, then only hash stored. */
export interface ApiKeyCreatedResponse {
  id: string;
  name: string;
  scope: ApiKeyScope;
  key: string;
  createdAt: string;
}

// ── Reports (Feedback) ────────────────────────────────────────────────────────

export type ReportType = 'BUG' | 'FEEDBACK' | 'OTHER';

export type ReportStatus = 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'CLOSED';

export interface CreateReportRequest {
  type: ReportType;
  title: string;
  description: string;
  /** Base64-encoded JPEG screenshots (≤ 500 KB each). */
  evidenceImages?: string[];
}

export interface ReportResponse {
  id: string;
  type: ReportType;
  title: string;
  description: string;
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
}
