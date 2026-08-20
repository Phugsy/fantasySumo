import type { ActiveView } from "./types";

export const appPaths = {
  home: "/",
  login: "/login",
  resetPassword: "/reset-password",
  stable: "/stable",
  team: "/team",
  admin: "/admin",
} as const;

export type ProtectedAppPath =
  | typeof appPaths.stable
  | typeof appPaths.team
  | typeof appPaths.admin;

const protectedPaths = new Set<string>([
  appPaths.stable,
  appPaths.team,
  appPaths.admin,
]);

export function getActiveView(pathname: string): ActiveView {
  switch (pathname) {
    case appPaths.login:
      return "login";
    case appPaths.resetPassword:
      return "reset-password";
    case appPaths.stable:
      return "stable";
    case appPaths.team:
      return "team";
    case appPaths.admin:
      return "admin";
    default:
      return "home";
  }
}

export function getSafeReturnPath(search: string): ProtectedAppPath | null {
  const returnTo = new URLSearchParams(search).get("returnTo");

  return returnTo !== null && protectedPaths.has(returnTo)
    ? (returnTo as ProtectedAppPath)
    : null;
}

export function getLoginPath(returnTo: ProtectedAppPath): string {
  return `${appPaths.login}?${new URLSearchParams({ returnTo }).toString()}`;
}

export function getPasswordResetPath(returnTo: ProtectedAppPath): string {
  return `${appPaths.resetPassword}?${new URLSearchParams({ returnTo }).toString()}`;
}

export function getPasswordResetRedirectUrl(
  origin: string,
  returnTo: ProtectedAppPath,
): string {
  return new URL(getPasswordResetPath(returnTo), origin).toString();
}
