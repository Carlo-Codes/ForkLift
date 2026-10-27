// What to show the lifter for a thrown value, e.g. a ValidationError's message
// from @forklift/core.
export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
