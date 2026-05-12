// Stub: claude rollback command - DuckHive doesn't support rollback
export async function rollback(
  target?: string,
  _options?: { list?: boolean; dryRun?: boolean; safe?: boolean },
): Promise<void> {
  // DuckHive doesn't have a rollback mechanism
  throw new Error('Rollback is not supported in DuckHive')
}
