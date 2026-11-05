type NamedStaff = { full_name: string; display_name: string };

const normalise = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * The staff member a typed sign-in name means: their short name, else their full name.
 * A full name two people share matches nobody, since `full_name` isn't unique; they use
 * their short name, which the database keeps unique.
 * A short name beats someone else's identical full name for the same reason: refusing
 * both would leave its owner with no name that's sure to work.
 */
export function findStaffByName<T extends NamedStaff>(staff: readonly T[], typed: string): T | null {
  const name = normalise(typed);
  if (!name) return null;
  const byShort = staff.find((s) => normalise(s.display_name) === name);
  if (byShort) return byShort;
  const byFull = staff.filter((s) => normalise(s.full_name) === name);
  return byFull.length === 1 ? byFull[0] : null;
}
