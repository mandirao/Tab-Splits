/**
 * Computes the shortest unambiguous display label for each person in a group.
 *
 * Rules (applied in order):
 *  1. Show first name only — unless another person shares it.
 *  2. If first names clash, show "First L." (last-name initial) — unless that
 *     combo also clashes or the person has no last name.
 *  3. If "First L." still clashes (or there's no last name to disambiguate),
 *     show the full name.
 */
export function getDisplayNames<T extends { id: string; name: string }>(
  people: T[]
): Map<string, string> {
  const result = new Map<string, string>();

  const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;
  const lastInitial = (name: string) => {
    const parts = name.trim().split(/\s+/);
    return parts.length > 1 ? (parts[parts.length - 1][0] ?? "").toUpperCase() : "";
  };

  // Count how many people share each first name
  const firstNameCount = new Map<string, number>();
  for (const p of people) {
    const fn = firstName(p.name);
    firstNameCount.set(fn, (firstNameCount.get(fn) ?? 0) + 1);
  }

  // For those sharing a first name, build the "First L." short form and count clashes
  const shortFormCount = new Map<string, number>();
  for (const p of people) {
    const fn = firstName(p.name);
    if ((firstNameCount.get(fn) ?? 1) > 1) {
      const li = lastInitial(p.name);
      const short = li ? `${fn} ${li}.` : fn;
      shortFormCount.set(short, (shortFormCount.get(short) ?? 0) + 1);
    }
  }

  for (const p of people) {
    const fn = firstName(p.name);
    if ((firstNameCount.get(fn) ?? 1) === 1) {
      result.set(p.id, fn);
    } else {
      const li = lastInitial(p.name);
      const short = li ? `${fn} ${li}.` : fn;
      if (!li || (shortFormCount.get(short) ?? 1) > 1) {
        // No last name, or short form still ambiguous — show full name
        result.set(p.id, p.name);
      } else {
        result.set(p.id, short);
      }
    }
  }

  return result;
}
