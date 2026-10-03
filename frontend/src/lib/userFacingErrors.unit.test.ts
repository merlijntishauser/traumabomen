import { describe, expect, it } from "vitest";
import { ApiError } from "./api";
import { importErrorKey, registrationErrorFor } from "./userFacingErrors";

function validationError(field: string) {
  // FastAPI puts a list of issues in `detail`; ApiError types it as a string.
  const detail = [{ loc: ["body", field], msg: "value is not a valid email address" }];
  return new ApiError(422, detail as unknown as string);
}

describe("registrationErrorFor", () => {
  it("sends a taken email back to the account step", () => {
    expect(registrationErrorFor(new ApiError(409, "conflict"))).toEqual({
      key: "auth.emailTaken",
      step: "account",
    });
  });

  it("sends a server-rejected email back to the account step", () => {
    expect(registrationErrorFor(validationError("email"))).toEqual({
      key: "auth.emailRejected",
      step: "account",
    });
  });

  it("does not blame the email for validation errors on other fields", () => {
    expect(registrationErrorFor(validationError("password"))).toEqual({
      key: "auth.registerError",
    });
  });

  it("maps invite errors", () => {
    expect(registrationErrorFor(new ApiError(400, "invalid_or_expired_invite"))).toEqual({
      key: "waitlist.invalidInvite",
    });
    expect(registrationErrorFor(new ApiError(400, "invite_email_mismatch"))).toEqual({
      key: "waitlist.emailMismatch",
      step: "account",
    });
  });

  it("falls back to the generic message for network and unknown errors", () => {
    expect(registrationErrorFor(new TypeError("Failed to fetch"))).toEqual({
      key: "auth.registerError",
    });
    expect(registrationErrorFor(new ApiError(500, "Internal Server Error"))).toEqual({
      key: "auth.registerError",
    });
  });
});

describe("importErrorKey", () => {
  it("recognises a file that is not a backup", () => {
    expect(importErrorKey(new SyntaxError("Unexpected token"))).toBe("tree.importErrorNotBackup");
    expect(importErrorKey(new Error("Invalid backup file"))).toBe("tree.importErrorNotBackup");
  });

  it("recognises a backup made under a different key", () => {
    expect(importErrorKey(new DOMException("decrypt failed", "OperationError"))).toBe(
      "tree.importErrorOtherKey",
    );
  });

  it("falls back to the generic message", () => {
    expect(importErrorKey(new Error("network down"))).toBe("tree.importError");
    expect(importErrorKey("weird")).toBe("tree.importError");
  });
});
