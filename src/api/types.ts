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
  // JSONB payload — shape validated by CloudProjectMapper in Phase 2
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

// ── Quota ─────────────────────────────────────────────────────────────────────

export interface QuotaResponse {
  quota: number;
  used: number;
  available: number;
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
