/** Keyboard grammar: Enter commits a single-line field by blurring it. */
export function blurOnEnter(event: React.KeyboardEvent<HTMLInputElement>): void {
  if (event.key === "Enter") event.currentTarget.blur();
}

/** Restrict a year field's raw value to at most four digits. */
export function sanitizeYearInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, 4);
}
