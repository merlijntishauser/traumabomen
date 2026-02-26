export type PasswordLevel = "weak" | "fair" | "strong";

export interface PasswordStrength {
  score: number;
  level: PasswordLevel;
}

export function getPasswordStrength(password: string): PasswordStrength {
  if (password.length < 8) {
    return { score: 0, level: "weak" };
  }

  let score = 1; // >= 8 chars
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;

  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  if (hasLower && hasUpper) score++;

  const hasDigitOrSymbol = /[\d\W_]/.test(password);
  if (hasDigitOrSymbol) score++;

  const level: PasswordLevel = score <= 2 ? "weak" : score === 3 ? "fair" : "strong";
  return { score, level };
}
