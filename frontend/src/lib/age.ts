export function formatAge(
  birthYear: number | null,
  deathYear: number | null,
  birthMonth?: number | null,
  birthDay?: number | null,
  deathMonth?: number | null,
  deathDay?: number | null,
): string | null {
  if (birthYear == null) return null;

  const now = new Date();
  const endYear = deathYear ?? now.getFullYear();
  let age = endYear - birthYear;

  if (birthMonth != null && birthDay != null) {
    const endMonth = deathYear != null ? (deathMonth ?? null) : now.getMonth() + 1;
    const endDay = deathYear != null ? (deathDay ?? null) : now.getDate();

    if (endMonth != null && endDay != null) {
      if (endMonth < birthMonth || (endMonth === birthMonth && endDay < birthDay)) {
        age -= 1;
      }
    }
  }

  return age >= 0 ? String(age) : null;
}
