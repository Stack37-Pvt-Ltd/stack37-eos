import { describe, expect, it } from 'vitest';
import { normalizeBranchRelation } from '../../src/lib/retail/branch-assignment';

describe('normalizeBranchRelation', () => {
  it('accepts the object shape returned for a many-to-one embedded branch', () => {
    expect(normalizeBranchRelation({ id: 'branch-1', name: 'Headquarters' })).toEqual([
      { id: 'branch-1', name: 'Headquarters' },
    ]);
  });

  it('keeps supporting an array relation shape', () => {
    expect(normalizeBranchRelation([
      { id: 'branch-1', name: 'Headquarters' },
      { id: 'branch-2', name: 'South' },
    ])).toEqual([
      { id: 'branch-1', name: 'Headquarters' },
      { id: 'branch-2', name: 'South' },
    ]);
  });

  it('ignores missing or malformed related values', () => {
    expect(normalizeBranchRelation(null)).toEqual([]);
    expect(normalizeBranchRelation([{ id: 'branch-1' }, 'invalid'])).toEqual([]);
  });
});
