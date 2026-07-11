import { afterEach, describe, expect, it } from "vitest";
import {
  allowsUnprotectedAdminImports,
  getAuthMode,
  getNeonAuthJwksUrl,
} from "./config.js";

const originalNodeEnv = process.env.NODE_ENV;
const originalAuthMode = process.env.AUTH_MODE;
const originalNeonAuthJwksUrl = process.env.NEON_AUTH_JWKS_URL;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  process.env.AUTH_MODE = originalAuthMode;
  process.env.NEON_AUTH_JWKS_URL = originalNeonAuthJwksUrl;
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

  it("uses local auth in development and Neon auth in production by default", () => {
    process.env.AUTH_MODE = "";
    process.env.NODE_ENV = "development";

    expect(getAuthMode()).toBe("local");

    process.env.NODE_ENV = "production";

    expect(getAuthMode()).toBe("neon");
  });

  it("reads Neon Auth JWKS URL from the environment", () => {
    process.env.NEON_AUTH_JWKS_URL =
      "https://auth.example.test/.well-known/jwks.json";

    expect(getNeonAuthJwksUrl()).toBe(
      "https://auth.example.test/.well-known/jwks.json",
    );
  });
});
