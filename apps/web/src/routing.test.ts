import { describe, expect, it } from "vitest";
import {
  appPaths,
  getActiveView,
  getLoginPath,
  getSafeReturnPath,
} from "./routing";

describe("routing", () => {
  it("maps known paths to their page view", () => {
    expect(getActiveView(appPaths.home)).toBe("home");
    expect(getActiveView(appPaths.login)).toBe("login");
    expect(getActiveView(appPaths.stable)).toBe("stable");
    expect(getActiveView(appPaths.team)).toBe("team");
    expect(getActiveView(appPaths.admin)).toBe("admin");
    expect(getActiveView("/unknown")).toBe("home");
  });

  it("accepts only known internal protected return paths", () => {
    expect(getSafeReturnPath("?returnTo=%2Fstable")).toBe("/stable");
    expect(getSafeReturnPath("?returnTo=%2Fteam")).toBe("/team");
    expect(getSafeReturnPath("?returnTo=%2Fadmin")).toBe("/admin");
    expect(
      getSafeReturnPath("?returnTo=https%3A%2F%2Fevil.example"),
    ).toBeNull();
    expect(getSafeReturnPath("?returnTo=%2F%2Fevil.example")).toBeNull();
    expect(getSafeReturnPath("?returnTo=%2Fstable%3Fleak%3D1")).toBeNull();
  });

  it("builds a login URL with an encoded internal return path", () => {
    expect(getLoginPath(appPaths.team)).toBe("/login?returnTo=%2Fteam");
  });
});
