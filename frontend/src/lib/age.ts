export function formatAge(birthYear: number | null, deathYear: number | null): string | null {
  if (birthYear == null) return null;
  const endYear = deathYear ?? new Date().getFullYear();
  const age = endYear - birthYear;
  return age >= 0 ? String(age) : null;
}
