import { describe, it, expect } from 'vitest';
import { migrateModel, needsMigration, CURRENT_SCHEMA_VERSION } from '../schema';
import type { SemanticModel } from '../../../core/domain/vfs/vfs.types';

/** A model in the pre-migration format: no schemaVersion, no activity collections. */
function legacyModel(over: Partial<SemanticModel> = {}): SemanticModel {
  return {
    id: 'm1',
    name: 'Legacy',
    version: '1.0.0',
    packages: {},
    classes: {},
    interfaces: {},
    enums: {},
    dataTypes: {},
    attributes: {},
    operations: {},
    actors: {},
    useCases: {},
    activityNodes: {},
    objectInstances: {},
    components: {},
    nodes: {},
    artifacts: {},
    relations: {},
    createdAt: 1,
    updatedAt: 1,
    ...over,
  } as SemanticModel;
}

describe('migrateModel', () => {
  it('treats a model with no schemaVersion as version 0 and migrates it', () => {
    const model = legacyModel();
    expect(needsMigration(model)).toBe(true);

    migrateModel(model);

    expect(model.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(needsMigration(model)).toBe(false);
  });

  it('creates the activity collections', () => {
    const model = migrateModel(legacyModel());
    expect(model.activities).toEqual({});
    expect(model.activityNodes).toEqual({});
    expect(model.activityPartitions).toEqual({});
  });

  it('renames the stub FINAL node type to ACTIVITY_FINAL', () => {
    const model = legacyModel({
      activityNodes: {
        n1: { id: 'n1', kind: 'ACTIVITY_NODE', name: 'End', activityType: 'FINAL' },
      } as never,
    });

    migrateModel(model);

    expect(model.activityNodes.n1.activityType).toBe('ACTIVITY_FINAL');
  });

  it('adopts nodes with no owning activity instead of dropping them', () => {
    const model = legacyModel({
      activityNodes: {
        n1: { id: 'n1', kind: 'ACTIVITY_NODE', name: 'Do', activityType: 'ACTION' },
        n2: { id: 'n2', kind: 'ACTIVITY_NODE', name: 'Start', activityType: 'INITIAL' },
      } as never,
    });

    migrateModel(model);

    const activityIds = Object.keys(model.activities!);
    expect(activityIds).toHaveLength(1);
    // Both land in the same recovery activity, not one each.
    expect(model.activityNodes.n1.activityId).toBe(activityIds[0]);
    expect(model.activityNodes.n2.activityId).toBe(activityIds[0]);
  });

  it('adopts a node whose activityId points at an activity that does not exist', () => {
    const model = legacyModel({
      activityNodes: {
        n1: {
          id: 'n1', kind: 'ACTIVITY_NODE', name: 'Do',
          activityType: 'ACTION', activityId: 'gone',
        },
      } as never,
    });

    migrateModel(model);

    expect(model.activityNodes.n1.activityId).not.toBe('gone');
    expect(model.activities![model.activityNodes.n1.activityId]).toBeDefined();
  });

  it('leaves a node that already has a valid activity alone', () => {
    const model = legacyModel({
      activities: { a1: { id: 'a1', kind: 'ACTIVITY', name: 'Checkout' } },
      activityNodes: {
        n1: {
          id: 'n1', kind: 'ACTIVITY_NODE', name: 'Do',
          activityType: 'ACTION', activityId: 'a1',
        },
      } as never,
    });

    migrateModel(model);

    expect(model.activityNodes.n1.activityId).toBe('a1');
    expect(Object.keys(model.activities!)).toEqual(['a1']);
  });

  it('is idempotent — a second run changes nothing', () => {
    const model = legacyModel({
      activityNodes: {
        n1: { id: 'n1', kind: 'ACTIVITY_NODE', name: 'End', activityType: 'FINAL' },
      } as never,
    });

    const once = JSON.parse(JSON.stringify(migrateModel(model)));
    const twice = JSON.parse(JSON.stringify(migrateModel(model)));

    expect(twice).toEqual(once);
  });

  it('skips migrations a model has already run', () => {
    // Already at the current version, but carrying a legacy-looking node: the
    // pipeline must not touch it, because its version says it was handled.
    const model = legacyModel({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      activityNodes: {
        n1: { id: 'n1', kind: 'ACTIVITY_NODE', name: 'End', activityType: 'FINAL' },
      } as never,
    });

    migrateModel(model);

    expect(model.activityNodes.n1.activityType).toBe('FINAL');
  });

  it('survives a round-trip through JSON after migrating', () => {
    const model = migrateModel(
      legacyModel({
        activityNodes: {
          n1: { id: 'n1', kind: 'ACTIVITY_NODE', name: 'Do', activityType: 'ACTION' },
        } as never,
      }),
    );

    const reloaded = JSON.parse(JSON.stringify(model)) as SemanticModel;

    expect(needsMigration(reloaded)).toBe(false);
    expect(migrateModel(reloaded)).toEqual(model);
  });

  it('opens a project with no activity data without writing garbage', () => {
    const model = migrateModel(legacyModel());

    expect(model.activities).toEqual({});
    expect(model.activityNodes).toEqual({});
    expect(model.activityPartitions).toEqual({});
    // No recovery activity invented when there was nothing to recover.
    expect(Object.keys(model.activities!)).toHaveLength(0);
  });
});
