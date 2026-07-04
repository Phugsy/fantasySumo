import { afterEach, describe, expect, it } from "vitest";
import { allowsUnprotectedAdminImports } from "./config.js";

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

describe("API config", () => {
  it("fails closed for unprotected admin imports in production", () => {
    process.env.NODE_ENV = "production";

    expect(allowsUnprotectedAdminImports()).toBe(false);
  });

  it("fails closed for unprotected admin imports when the environment is unset", () => {
    process.env.NODE_ENV = "";

    expect(allowsUnprotectedAdminImports()).toBe(false);
  });

  it("allows unprotected admin imports in development", () => {
    process.env.NODE_ENV = "development";

    expect(allowsUnprotectedAdminImports()).toBe(true);
  });

  it("allows unprotected admin imports in test", () => {
    process.env.NODE_ENV = "test";

    expect(allowsUnprotectedAdminImports()).toBe(true);
  });
});
