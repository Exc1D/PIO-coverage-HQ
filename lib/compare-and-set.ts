// Compare-and-set for a version counter. Pure (the caller supplies the reads
// and writes) so the retry logic can be unit tested.

/**
 * Read the current version and write `current + 1` only if it is still
 * `current`; when another writer got there first, read again and retry.
 * Concurrent callers therefore each get a distinct version. Throws after
 * `attempts` lost races.
 */
export async function bumpVersion(
  read: () => Promise<number>,
  writeIf: (current: number, next: number) => Promise<boolean>,
  attempts = 3,
): Promise<number> {
  for (let i = 0; i < attempts; i++) {
    const current = await read();
    if (await writeIf(current, current + 1)) return current + 1;
  }
  throw new Error(`The version kept changing; gave up after ${attempts} attempts.`);
}
