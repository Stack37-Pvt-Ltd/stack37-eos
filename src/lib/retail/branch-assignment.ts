export type BranchSummary = { id: string; name: string };

function isBranchSummary(value: unknown): value is BranchSummary {
  return typeof value === 'object'
    && value !== null
    && 'id' in value
    && typeof value.id === 'string'
    && 'name' in value
    && typeof value.name === 'string';
}

/** PostgREST may return a many-to-one embedded branch as one object or an array. */
export function normalizeBranchRelation(value: unknown): BranchSummary[] {
  const related = Array.isArray(value) ? value : value == null ? [] : [value];
  return related.filter(isBranchSummary).map(({ id, name }) => ({ id, name }));
}
