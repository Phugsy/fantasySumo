import { afterEach, describe, expect, it } from "vitest";
import { getAdminUserIds, getAuthMode, getNeonAuthJwksUrl } from "./config.js";

const originalNodeEnv = process.env.NODE_ENV;
const originalAuthMode = process.env.AUTH_MODE;
const originalNeonAuthJwksUrl = process.env.NEON_AUTH_JWKS_URL;
const originalAdminUserIds = process.env.ADMIN_USER_IDS;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  process.env.AUTH_MODE = originalAuthMode;
  process.env.NEON_AUTH_JWKS_URL = originalNeonAuthJwksUrl;
  process.env.ADMIN_USER_IDS = originalAdminUserIds;
});

describe("API config", () => {
  it("reads unique trimmed admin user ids from the server environment", () => {
    process.env.ADMIN_USER_IDS = " neon-admin-1,local-admin-2,neon-admin-1 ";

    expect(getAdminUserIds()).toEqual(["neon-admin-1", "local-admin-2"]);
  });

  it("uses local auth in development and Neon auth in production by default", () => {
    process.env.AUTH_MODE = "";
    process.env.NODE_ENV = "development";

    expect(getAuthMode()).toBe("local");

    process.env.NODE_ENV = "production";

    expect(getAuthMode()).toBe("neon");
  });

  it("rejects insecure local auth in production", () => {
    process.env.AUTH_MODE = "local";
    process.env.NODE_ENV = "production";

    expect(() => getAuthMode()).toThrow(
      "AUTH_MODE=local is not allowed in production.",
    );
  });

  it("reads Neon Auth JWKS URL from the environment", () => {
    process.env.NEON_AUTH_JWKS_URL =
      "https://auth.example.test/.well-known/jwks.json";

    expect(getNeonAuthJwksUrl()).toBe(
      "https://auth.example.test/.well-known/jwks.json",
    );
  });
});
