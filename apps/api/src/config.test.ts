import { afterEach, describe, expect, it } from "vitest";
import { allowsUnprotectedAdminImports } from "./config.js";

const originalNodeEnv = process.env.NODE_ENV;
const originalAllowUnprotectedAdminImports =
  process.env.ALLOW_UNPROTECTED_ADMIN_IMPORTS;
const originalVercel = process.env.VERCEL;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  process.env.ALLOW_UNPROTECTED_ADMIN_IMPORTS =
    originalAllowUnprotectedAdminImports;
  process.env.VERCEL = originalVercel;
});

describe("API config", () => {
  it("allows unprotected admin imports for local dev with an unset node env", () => {
    process.env.NODE_ENV = "";
    process.env.ALLOW_UNPROTECTED_ADMIN_IMPORTS = "";
    process.env.VERCEL = "";

    expect(allowsUnprotectedAdminImports()).toBe(true);
  });

  it("fails closed for unprotected admin imports in explicit production", () => {
    process.env.NODE_ENV = "production";
    process.env.ALLOW_UNPROTECTED_ADMIN_IMPORTS = "";
    process.env.VERCEL = "1";

    expect(allowsUnprotectedAdminImports()).toBe(false);
  });

  it("does not allow the unprotected import override in explicit production", () => {
    process.env.NODE_ENV = "production";
    process.env.ALLOW_UNPROTECTED_ADMIN_IMPORTS = "true";
    process.env.VERCEL = "";

    expect(allowsUnprotectedAdminImports()).toBe(false);
  });

  it("allows unprotected admin imports in known local test contexts", () => {
    process.env.NODE_ENV = "test";
    process.env.ALLOW_UNPROTECTED_ADMIN_IMPORTS = "";
    process.env.VERCEL = "";

    expect(allowsUnprotectedAdminImports()).toBe(true);
  });

  it("allows explicit local opt-in for unprotected admin imports", () => {
    process.env.NODE_ENV = "";
    process.env.ALLOW_UNPROTECTED_ADMIN_IMPORTS = "true";
    process.env.VERCEL = "";

    expect(allowsUnprotectedAdminImports()).toBe(true);
  });
});
