import type { ImportValidationIssue } from "./types.js";

export class ImportValidationError extends Error {
  constructor(readonly issues: ImportValidationIssue[]) {
    super("Import validation failed.");
  }
}
