import { ApiError } from "./api";

/** Steps of the registration form that an error can send the user back to. */
export type RegistrationStep = "account" | "encryption" | "confirm";

export interface RegistrationErrorInfo {
  /** Translation key for the message. */
  key: string;
  /** The step whose field caused the error, when it is not the current one. */
  step?: RegistrationStep;
}

interface ValidationIssue {
  loc?: unknown[];
}

/** FastAPI 422 bodies carry a list of issues, each with a field path in `loc`. */
function isFieldValidationError(err: ApiError, field: string): boolean {
  if (err.status !== 422) return false;
  const detail = err.detail as unknown;
  if (!Array.isArray(detail)) return false;
  return detail.some(
    (issue: ValidationIssue) => Array.isArray(issue?.loc) && issue.loc.includes(field),
  );
}

/**
 * Map a failed registration to a message and, when the problem is the email
 * address, to the step where it can be fixed. Registration submits on the
 * last step, so without this an unusable email surfaces two steps away from
 * the field that caused it.
 */
export function registrationErrorFor(err: unknown): RegistrationErrorInfo {
  if (!(err instanceof ApiError)) return { key: "auth.registerError" };
  if (err.status === 409) return { key: "auth.emailTaken", step: "account" };
  if (isFieldValidationError(err, "email")) return { key: "auth.emailRejected", step: "account" };
  if (err.detail === "invalid_or_expired_invite") return { key: "waitlist.invalidInvite" };
  if (err.detail === "invite_email_mismatch")
    return { key: "waitlist.emailMismatch", step: "account" };
  return { key: "auth.registerError" };
}

/**
 * Map a failed backup import to a message the user can act on, instead of
 * surfacing a parser or Web Crypto message.
 */
export function importErrorKey(err: unknown): string {
  // JSON.parse failure, or a JSON file that is not one of our backups.
  if (err instanceof SyntaxError) return "tree.importErrorNotBackup";
  if (err instanceof Error && err.message === "Invalid backup file") {
    return "tree.importErrorNotBackup";
  }
  // AES-GCM decryption fails with an OperationError when the backup was
  // encrypted under a different master key.
  if (err instanceof DOMException && err.name === "OperationError") {
    return "tree.importErrorOtherKey";
  }
  return "tree.importError";
}

/**
 * The message for a tree that failed to load. A rate limit (429) is a busy
 * server, not a key problem: telling someone their data cannot be decrypted
 * and to log in again would send them down the wrong path.
 */
export function treeLoadErrorKey(err: unknown): string {
  if (err instanceof ApiError && err.status === 429) return "tree.loadBusy";
  return "tree.decryptionError";
}
