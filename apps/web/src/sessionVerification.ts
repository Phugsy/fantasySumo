import type { SessionResponse } from "./types";

const MAX_SESSION_ATTEMPTS = 8;
const SESSION_RETRY_DELAY_MS = 250;

export async function waitForVerifiedSession(
  fetchSession: () => Promise<SessionResponse>,
  waitForRetry: (ms: number) => Promise<void>,
): Promise<SessionResponse> {
  for (let attempt = 1; attempt <= MAX_SESSION_ATTEMPTS; attempt += 1) {
    try {
      const session = await fetchSession();

      if (session.user !== null || attempt === MAX_SESSION_ATTEMPTS) {
        return session;
      }
    } catch (error) {
      if (attempt === MAX_SESSION_ATTEMPTS) {
        throw error;
      }
    }

    await waitForRetry(SESSION_RETRY_DELAY_MS);
  }

  return {
    mode: "neon",
    user: null,
  };
}
