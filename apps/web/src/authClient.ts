import { createAuthClient } from "@neondatabase/neon-js/auth";
import type { SessionResponse, SessionUser } from "./types";

const PASSWORD_REQUIREMENTS_MESSAGE =
  "Choose a stronger password. Use at least 8 characters and avoid common passwords.";
const FORCE_NEON_SESSION_FETCH_OPTIONS = {
  fetchOptions: {
    headers: {
      "X-Force-Fetch": "true",
    },
  },
} as const;
export const INCOMPLETE_SESSION_ERROR_MESSAGE =
  "We signed you in, but could not complete your session. Refresh the page or try signing in again.";

interface NeonAccessTokenResponse {
  data: { session?: { token?: string } | null } | null;
  error: unknown | null;
}

type AccessTokenProvider = () => Promise<string | null>;

const neonAuthUrl = import.meta.env.VITE_NEON_AUTH_URL as string | undefined;
const neonAuthClient =
  neonAuthUrl === undefined || neonAuthUrl.trim().length === 0
    ? null
    : createAuthClient(neonAuthUrl);

export function isNeonAuthConfigured(): boolean {
  return neonAuthClient !== null;
}

export class IncompleteSessionError extends Error {
  constructor() {
    super(INCOMPLETE_SESSION_ERROR_MESSAGE);
    this.name = "IncompleteSessionError";
  }
}

export async function getNeonAccessToken(): Promise<string | null> {
  if (neonAuthClient === null) {
    return null;
  }

  return requireNeonAccessToken(await neonAuthClient.getSession());
}

export async function getFreshNeonAccessToken(): Promise<string | null> {
  if (neonAuthClient === null) {
    return null;
  }

  return requestFreshNeonAccessToken((options) =>
    neonAuthClient.getSession(options),
  );
}

export async function requestFreshNeonAccessToken(
  requestSession: (
    options: typeof FORCE_NEON_SESSION_FETCH_OPTIONS,
  ) => Promise<NeonAccessTokenResponse>,
): Promise<string> {
  // A live session response seeds Neon's normal expiry-aware session cache.
  // Only the post-login completion provider uses this bypass.
  const response = await requestSession(FORCE_NEON_SESSION_FETCH_OPTIONS);

  return requireNeonAccessToken(response);
}

export function createNeonSessionCompletionTokenProvider(
  getFreshToken: AccessTokenProvider,
  getCachedToken: AccessTokenProvider,
): AccessTokenProvider {
  let needsFreshSession = true;
  let freshTokenRequest: Promise<string | null> | null = null;

  return async () => {
    if (!needsFreshSession) {
      return getCachedToken();
    }

    freshTokenRequest ??= getFreshToken();

    try {
      const token = await freshTokenRequest;

      if (token !== null) {
        needsFreshSession = false;
      }

      return token;
    } finally {
      freshTokenRequest = null;
    }
  };
}

export function requireNeonAccessToken(
  response: NeonAccessTokenResponse,
): string {
  const token = response.data?.session?.token?.trim();

  if (response.error !== null || token === undefined || token.length === 0) {
    throw new IncompleteSessionError();
  }

  return token;
}

export async function getNeonSession(): Promise<SessionResponse> {
  if (neonAuthClient === null) {
    return {
      mode: "local",
      user: null,
    };
  }

  const response = await neonAuthClient.getSession();

  if (response.error !== null || response.data === null) {
    return {
      mode: "neon",
      user: null,
    };
  }

  return {
    mode: "neon",
    user: toSessionUser(response.data.user),
  };
}

export async function signInWithNeon(input: {
  email: string;
  password: string;
}): Promise<SessionResponse> {
  if (neonAuthClient === null) {
    throw new Error("Neon Auth is not configured.");
  }

  const response = await neonAuthClient.signIn.email(input);

  if (response.error !== null) {
    throw new Error(
      getNeonAuthErrorMessage(response.error.message, "Unable to sign in."),
    );
  }

  return getNeonSession();
}

export async function signUpWithNeon(input: {
  displayName: string;
  email: string;
  password: string;
}): Promise<SessionResponse> {
  if (neonAuthClient === null) {
    throw new Error("Neon Auth is not configured.");
  }

  const response = await neonAuthClient.signUp.email({
    email: input.email,
    name: input.displayName,
    password: input.password,
  });

  if (response.error !== null) {
    throw new Error(
      getNeonAuthErrorMessage(
        response.error.message,
        "Unable to create account.",
      ),
    );
  }

  return getNeonSession();
}

export async function signOutNeon(): Promise<void> {
  if (neonAuthClient === null) {
    return;
  }

  const response = await neonAuthClient.signOut();

  if (response.error !== null) {
    throw new Error(
      getNeonAuthErrorMessage(response.error.message, "Unable to sign out."),
    );
  }
}

export function getNeonAuthErrorMessage(
  message: string | undefined,
  fallback: string,
): string {
  if (message === undefined || message.trim().length === 0) {
    return fallback;
  }

  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes("password") &&
    (normalizedMessage.includes("security requirements") ||
      normalizedMessage.includes("too short") ||
      normalizedMessage.includes("weak"))
  ) {
    return PASSWORD_REQUIREMENTS_MESSAGE;
  }

  if (normalizedMessage.includes("invalid origin")) {
    return `Neon Auth rejected this origin (${window.location.origin}). Add this exact URL in Neon Auth trusted domains.`;
  }

  return message;
}

function toSessionUser(user: {
  email?: string;
  id: string;
  name?: string | null;
}): SessionUser {
  return {
    id: user.id,
    ...(user.email === undefined || user.email.length === 0
      ? {}
      : { email: user.email }),
    ...(user.name === undefined || user.name === null || user.name.length === 0
      ? {}
      : { displayName: user.name }),
  };
}
