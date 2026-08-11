/**
 * SemanticModel schema migrations (ADR-0012).
 *
 * The model carries two versions: `version` is the business version of the
 * content, `schemaVersion` is the storage format. Only the second one drives
 * this pipeline.
 *
 * Rules for adding a migration:
 *   1. Bump `CURRENT_SCHEMA_VERSION` and append one entry to `MIGRATIONS`.
 *      Never renumber or edit a shipped migration — projects in the wild have
 *      already run it.
 *   2. It must be idempotent. Running the pipeline twice must be a no-op the
 *      second time, because a model can be migrated on load and again on
 *      import.
 *   3. It must not throw on malformed input. A migration that crashes takes
 *      the user's project with it; prefer dropping or repairing the bad datum.
 *
 * Before this existed, `normalize()` in model.store.ts backfilled missing
 * collections to `{}`. That handles "a collection is absent" and nothing else —
 * it cannot reshape data that is present but in an old form. `normalize()`
 * stays as a cheap guard; real shape changes belong here.
 */
import type { SemanticModel } from '../../core/domain/vfs/vfs.types';

export const CURRENT_SCHEMA_VERSION = 1;

interface Migration {
  /** The version this migration produces. */
  to: number;
  describe: string;
  run: (model: SemanticModel) => void;
}

/**
 * v1 — activity diagrams become real (A1).
 *
 * Before this, `activityNodes` existed as a stub: no owning activity, and a
 * final node was typed `FINAL`. Nothing in the app could create one, so in
 * practice these collections are empty; the migration is written to cope
 * anyway, because "nobody could have made one" is an assumption about the past
 * and imported files are not bound by it.
 */
const migrateToV1: Migration = {
  to: 1,
  describe: 'activity collections, ACTIVITY_FINAL rename, orphan nodes adopted',
  run: (model) => {
    model.activities ??= {};
    model.activityPartitions ??= {};
    model.activityNodes ??= {};

    const nodes = Object.values(model.activityNodes);
    if (nodes.length === 0) return;

    // The stub called it FINAL; UML and our IR call it ACTIVITY_FINAL.
    for (const node of nodes) {
      if ((node.activityType as string) === 'FINAL') {
        node.activityType = 'ACTIVITY_FINAL';
      }
    }

    // A node must belong to exactly one activity. Anything without a valid one
    // is adopted by a single recovery activity rather than dropped — losing the
    // user's nodes silently would be worse than an oddly-named container.
    const orphans = nodes.filter((n) => !n.activityId || !model.activities![n.activityId]);
    if (orphans.length === 0) return;

    const RECOVERED_ID = 'activity-recovered';
    model.activities![RECOVERED_ID] ??= {
      id: RECOVERED_ID,
      kind: 'ACTIVITY',
      name: 'Recovered Activity',
    };
    for (const node of orphans) node.activityId = RECOVERED_ID;
  },
};

const MIGRATIONS: Migration[] = [migrateToV1];

/**
 * Brings a model up to `CURRENT_SCHEMA_VERSION`, mutating it in place and
 * returning it. A model with no `schemaVersion` predates the pipeline and is
 * treated as version 0, so every migration runs.
 *
 * Migrations run in order and each one is skipped if the model already declares
 * a version at or beyond it, which is what makes repeated calls cheap.
 */
export function migrateModel(model: SemanticModel): SemanticModel {
  const from = model.schemaVersion ?? 0;

  // Nothing to do — and nothing written. A model already in the store is frozen
  // by immer, so an up-to-date model must come back untouched rather than being
  // re-stamped with the version it already has.
  if (from >= CURRENT_SCHEMA_VERSION) return model;

  for (const migration of MIGRATIONS) {
    if (from >= migration.to) continue;
    migration.run(model);
  }

  model.schemaVersion = CURRENT_SCHEMA_VERSION;
  return model;
}

/** Whether a model would be changed by the pipeline. For diagnostics. */
export function needsMigration(model: SemanticModel): boolean {
  return (model.schemaVersion ?? 0) < CURRENT_SCHEMA_VERSION;
}
