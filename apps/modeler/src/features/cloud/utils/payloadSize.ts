// src/features/cloud/utils/payloadSize.ts
// Single source of truth for the 5 MB quota constant and all derived utilities.

export const QUOTA_BYTES = 5_242_880; // 5 MB

const WARN_THRESHOLD  = 0.70; // 70 % → yellow
const ALERT_THRESHOLD = 0.90; // 90 % → red
const HARD_THRESHOLD  = 0.95; // 95 % → blocks save

export type QuotaLevel = 'ok' | 'warning' | 'alert' | 'blocked';

/**
 * Returns the UTF-8 byte length of `JSON.stringify(obj)`.
 * More accurate than `.length` (which counts code units, not bytes).
 */
export function payloadSize(obj: unknown): number {
  return new TextEncoder().encode(JSON.stringify(obj)).length;
}

/** Maps a used-byte count to one of four severity levels. */
export function classifyQuota(usedBytes: number): QuotaLevel {
  const ratio = usedBytes / QUOTA_BYTES;
  if (ratio >= HARD_THRESHOLD)  return 'blocked';
  if (ratio >= ALERT_THRESHOLD) return 'alert';
  if (ratio >= WARN_THRESHOLD)  return 'warning';
  return 'ok';
}

/**
 * Human-readable MB string.
 * Omits the decimal for round values (e.g. "5 MB" instead of "5.0 MB").
 */
export function formatQuota(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb % 1 === 0 ? `${mb} MB` : `${mb.toFixed(1)} MB`;
}

/**
 * Pre-flight check before a cloud save.
 *
 * @param payload         - The object about to be serialised and sent.
 * @param currentUsedBytes - Bytes already consumed by the user's quota.
 * @returns `{ ok: true }` when safe to send; `{ ok: false, message }` when
 *          the projected total would exceed the 95 % hard threshold.
 */
export function canSaveToCloud(
  payload: unknown,
  currentUsedBytes: number,
): { ok: boolean; projectedUsed: number; message?: string } {
  const size      = payloadSize(payload);
  const projected = currentUsedBytes + size;

  if (projected >= QUOTA_BYTES * HARD_THRESHOLD) {
    return {
      ok: false,
      projectedUsed: projected,
      message: `Saving would bring you to ${formatQuota(projected)} of your ${formatQuota(QUOTA_BYTES)} quota. Delete old diagrams to free space.`,
    };
  }

  return { ok: true, projectedUsed: projected };
}
