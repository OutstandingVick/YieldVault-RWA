import { describe, it, expect } from "vitest";
import { mapServerError } from "./errorMappers";

describe("Error Mappers", () => {
  describe("mapServerError", () => {
    it("maps field-level errors from server response", () => {
      const error = {
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        details: {
          field: "amount",
          message: "Amount exceeds vault capacity",
        },
      };

      const result = mapServerError(error);
      expect(result.fieldErrors).toHaveLength(1);
      expect(result.fieldErrors[0].fieldName).toBe("amount");
      expect(result.fieldErrors[0].message).toBe("Amount exceeds vault capacity");
      expect(result.generalError).toBeNull();
    });

    it("maps general errors from server response", () => {
      const error = {
        message: "Internal server error",
      };

      const result = mapServerError(error);
      expect(result.fieldErrors).toHaveLength(0);
      expect(result.generalError).toBe("Internal server error");
    });

    it("sanitizes error messages to remove stack traces", () => {
      const error = {
        message: "Something went wrong at line 123 at /path/to/file.ts",
      };

      const result = mapServerError(error);
      expect(result.generalError).not.toContain("at");
    });

    it("sanitizes error messages to remove database constraint info", () => {
      const error = {
        message: "Constraint violation: unique constraint vault_users_email",
      };

      const result = mapServerError(error);
      expect(result.generalError).not.toContain("constraint");
    });

    it("handles Error objects", () => {
      const error = new Error("Network timeout");

      const result = mapServerError(error);
      expect(result.generalError).toBe("Network timeout");
    });

    it("handles unknown error types", () => {
      const result = mapServerError(null);
      expect(result.generalError).toBe("An error occurred. Please try again.");
    });

    it("handles empty error messages", () => {
      const error = {
        message: "",
      };

      const result = mapServerError(error);
      expect(result.generalError).toBe("An error occurred. Please try again.");
    });

    it("truncates very long error messages", () => {
      const longMessage = "x".repeat(300);
      const error = {
        message: longMessage,
      };

      const result = mapServerError(error);
      expect(result.generalError?.length).toBeLessThanOrEqual(200);
    });
  });
});
