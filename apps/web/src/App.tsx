import type { FormEvent, MutableRefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ApiRequestError,
  clearSession,
  createSession,
  createFantasyTeam,
  fetchBashoRikishi,
  fetchCurrentBasho,
  fetchLeaderboard,
  fetchMyTeam,
  fetchSession,
  getErrorMessage,
  setAuthTokenProvider,
} from "./api";
import {
  getNeonAccessToken,
  isNeonAuthConfigured,
  signInWithNeon,
  signOutNeon,
  signUpWithNeon,
} from "./authClient";
import { AccountPanel } from "./components/AccountPanel";
import { AppHeader } from "./components/AppHeader";
import { BashoPanel } from "./components/BashoPanel";
import { LeaderboardPanel } from "./components/LeaderboardPanel";
import { PageHeader } from "./components/PageHeader";
import { TeamSelection } from "./components/TeamSelection";
import type {
  ActiveView,
  Basho,
  CreatedTeamResponse,
  LeaderboardEntry,
  LeaderboardLoadState,
  LeaderboardResponse,
  LoadState,
  RankedRikishi,
  SessionResponse,
  SessionUser,
  TeamResponse,
} from "./types";
import { canEditFantasyPicks, getPickLockMessage } from "./lifecycle";

export function App() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [sessionState, setSessionState] = useState<
    "loading" | "ready" | "submitting"
  >("loading");
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [authMode, setAuthMode] = useState<SessionResponse["mode"] | null>(
    null,
  );
  const [basho, setBasho] = useState<Basho | null>(null);
  const [rikishi, setRikishi] = useState<RankedRikishi[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardTotalDays, setLeaderboardTotalDays] = useState<
    number | undefined
  >(undefined);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>("selection");
  const [leaderboardLoadState, setLeaderboardLoadState] =
    useState<LeaderboardLoadState>("loading");
  const [displayName, setDisplayName] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [accountDisplayName, setAccountDisplayName] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [submitState, setSubmitState] = useState<"idle" | "submitting">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessionErrorMessage, setSessionErrorMessage] = useState<string | null>(
    null,
  );
  const [leaderboardErrorMessage, setLeaderboardErrorMessage] = useState<
    string | null
  >(null);
  const [createdTeam, setCreatedTeam] = useState<CreatedTeamResponse | null>(
    null,
  );
  const [ownedTeamId, setOwnedTeamId] = useState<string | null>(null);
  const bashoRequestIdRef = useRef(0);
  const leaderboardRequestIdRef = useRef(0);

  const selectedRikishi = useMemo(
    () =>
      selectedIds
        .map((id) => rikishi.find((entry) => entry.id === id))
        .filter((entry): entry is RankedRikishi => entry !== undefined),
    [rikishi, selectedIds],
  );
  const teamSize = basho?.teamSize ?? 0;
  const canEditPicks = basho === null ? false : canEditFantasyPicks(basho);
  const pickLockMessage =
    basho === null ? undefined : getPickLockMessage(basho);
  const canSubmit =
    loadState === "ready" &&
    sessionState === "ready" &&
    sessionUser !== null &&
    canEditPicks &&
    submitState === "idle" &&
    displayName.trim().length > 0 &&
    selectedIds.length === teamSize;

  function toggleRikishi(rikishiId: string) {
    if (!canEditPicks) {
      return;
    }

    setErrorMessage(null);
    setCreatedTeam(null);
    setSelectedIds((current) => {
      if (current.includes(rikishiId)) {
        return current.filter((id) => id !== rikishiId);
      }

      if (current.length >= teamSize) {
        return current;
      }

      return [...current, rikishiId];
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (basho === null || !canSubmit) {
      return;
    }

    setSubmitState("submitting");
    setErrorMessage(null);
    setLeaderboardErrorMessage(null);
    setCreatedTeam(null);

    try {
      const response = await createFantasyTeam(basho.id, {
        displayName: displayName.trim(),
        rikishiIds: selectedIds,
      });

      setCreatedTeam(response);
      setOwnedTeamId(response.team.id);

      const requestId = nextLeaderboardRequestId(leaderboardRequestIdRef);
      setLeaderboardLoadState("loading");

      try {
        const leaderboardResponse = await fetchLeaderboard(basho.id);

        if (!isCurrentLeaderboardRequest(leaderboardRequestIdRef, requestId)) {
          return;
        }

        setBasho((current) =>
          mergeLeaderboardBasho(current, leaderboardResponse),
        );
        setLeaderboardTotalDays(leaderboardResponse.totalDays);
        setLeaderboard(leaderboardResponse.leaderboard);
        setExpandedTeamId(
          getExpandedTeamId(leaderboardResponse, response.team.id),
        );
        setLeaderboardLoadState("ready");
        setActiveView("leaderboard");
      } catch (error) {
        if (!isCurrentLeaderboardRequest(leaderboardRequestIdRef, requestId)) {
          return;
        }

        setLeaderboardLoadState("ready");
        setErrorMessage(getErrorMessage(error));
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSubmitState("idle");
    }
  }

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await submitAccount("sign-in");
  }

  async function handleSignUp() {
    await submitAccount("sign-up");
  }

  async function submitAccount(intent: "sign-in" | "sign-up") {
    let bashoReloadStarted = false;
    const preserveAnonymousDraft =
      sessionUser === null &&
      (displayName.trim().length > 0 || selectedIds.length > 0);

    setSessionState("submitting");
    setSessionErrorMessage(null);

    try {
      const session =
        authMode === "neon"
          ? await submitNeonAccount({
              displayName: accountDisplayName.trim(),
              email: accountEmail.trim(),
              intent,
              password: accountPassword,
            })
          : await createSession({
              email: accountEmail.trim(),
              displayName: accountDisplayName.trim(),
            });

      setAuthMode(session.mode);
      setSessionUser(session.user);
      setAccountPassword("");

      bashoReloadStarted = true;
      await loadBashoData(session, () => true, preserveAnonymousDraft);
    } catch (error) {
      if (bashoReloadStarted) {
        setLoadState("error");
      }
      setSessionErrorMessage(getErrorMessage(error));
    } finally {
      setSessionState("ready");
    }
  }

  async function handleSignOut() {
    let bashoReloadStarted = false;

    setSessionState("submitting");
    setSessionErrorMessage(null);

    try {
      if (authMode === "neon") {
        await signOutNeon();
      } else {
        await clearSession();
      }
      setSessionUser(null);
      setAccountEmail("");
      setAccountDisplayName("");
      setCreatedTeam(null);
      setOwnedTeamId(null);
      setDisplayName("");
      setSelectedIds([]);
      setActiveView("selection");

      bashoReloadStarted = true;
      await loadBashoData(
        { mode: authMode ?? "local", user: null },
        () => true,
      );
    } catch (error) {
      if (bashoReloadStarted) {
        setLoadState("error");
      }
      setSessionErrorMessage(getErrorMessage(error));
    } finally {
      setSessionState("ready");
    }
  }

  async function loadBashoData(
    session: SessionResponse,
    isCurrent: () => boolean,
    preserveDraftWhenTeamMissing = false,
  ) {
    bashoRequestIdRef.current += 1;
    const bashoRequestId = bashoRequestIdRef.current;
    const isCurrentBashoRequest = () =>
      isCurrent() && bashoRequestIdRef.current === bashoRequestId;

    setLoadState("loading");

    setErrorMessage(null);
    setLeaderboardErrorMessage(null);

    let currentBasho: Basho;
    let bashoRikishi: Awaited<ReturnType<typeof fetchBashoRikishi>>;
    let myTeam: TeamResponse | null;

    try {
      currentBasho = await fetchCurrentBasho();
      bashoRikishi = await fetchBashoRikishi(currentBasho.id);
      myTeam =
        session.user === null ? null : await fetchMyTeamOrNull(currentBasho.id);
    } catch (error) {
      if (!isCurrentBashoRequest()) {
        return;
      }

      throw error;
    }

    if (!isCurrentBashoRequest()) {
      return;
    }

    setBasho({
      ...bashoRikishi.basho,
      teamSize: currentBasho.teamSize,
    });
    setRikishi(bashoRikishi.rikishi);
    applyMyTeam(
      myTeam,
      bashoRikishi.rikishi,
      preserveDraftWhenTeamMissing,
      setDisplayName,
      setSelectedIds,
    );
    setOwnedTeamId(myTeam?.team.id ?? null);
    setActiveView(myTeam === null ? "selection" : "leaderboard");
    setLoadState(bashoRikishi.rikishi.length === 0 ? "empty" : "ready");

    const requestId = nextLeaderboardRequestId(leaderboardRequestIdRef);
    setLeaderboardLoadState("loading");

    try {
      const leaderboardResponse = await fetchLeaderboard(currentBasho.id);

      if (
        !isCurrentBashoRequest() ||
        !isCurrentLeaderboardRequest(leaderboardRequestIdRef, requestId)
      ) {
        return;
      }

      setBasho((current) =>
        mergeLeaderboardBasho(current, leaderboardResponse),
      );
      setLeaderboardTotalDays(leaderboardResponse.totalDays);
      setLeaderboard(leaderboardResponse.leaderboard);
      setExpandedTeamId(
        getExpandedTeamId(leaderboardResponse, myTeam?.team.id ?? null),
      );
      setLeaderboardErrorMessage(null);
      setLeaderboardLoadState("ready");
    } catch (error) {
      if (
        !isCurrentBashoRequest() ||
        !isCurrentLeaderboardRequest(leaderboardRequestIdRef, requestId)
      ) {
        return;
      }

      setLeaderboard([]);
      setExpandedTeamId(null);
      setLeaderboardErrorMessage(getErrorMessage(error));
      setLeaderboardLoadState("ready");
    }
  }

  useEffect(() => {
    let isCurrent = true;

    async function loadInitialPage() {
      const neonAuthConfigured = isNeonAuthConfigured();

      try {
        if (neonAuthConfigured) {
          setAuthTokenProvider(getNeonAccessToken);
        }

        const session = await loadInitialSession(neonAuthConfigured).catch(
          () =>
            ({
              mode: neonAuthConfigured ? "neon" : "local",
              user: null,
            }) satisfies SessionResponse,
        );

        if (!isCurrent) {
          return;
        }

        setAuthMode(session.mode);
        setSessionUser(session.user);
        setAccountEmail(session.user?.email ?? "");
        setAccountDisplayName(session.user?.displayName ?? "");
        setSessionState("ready");

        await loadBashoData(session, () => isCurrent);
      } catch (error) {
        if (!isCurrent) {
          return;
        }

        setErrorMessage(getPublicDataErrorMessage(error));
        setSessionState("ready");
        setLoadState("error");
      }
    }

    void loadInitialPage();

    return () => {
      isCurrent = false;
    };
    // Initial page loading is intentionally one-shot; later session changes
    // call loadBashoData directly after sign-in.
  }, []);

  return (
    <div className="site-shell">
      <AppHeader
        activeView={activeView}
        disabled={loadState !== "ready" || submitState === "submitting"}
        onChange={setActiveView}
      />
      <main className="app-shell">
        <PageHeader activeView={activeView} />

        {loadState === "loading" && (
          <section className="state-panel" aria-live="polite">
            Loading the current basho...
          </section>
        )}

        <AccountPanel
          email={accountEmail}
          errorMessage={sessionErrorMessage}
          mode={authMode}
          onDisplayNameChange={setAccountDisplayName}
          onEmailChange={setAccountEmail}
          onPasswordChange={setAccountPassword}
          onSignIn={handleSignIn}
          onSignOut={handleSignOut}
          onSignUp={handleSignUp}
          password={accountPassword}
          sessionState={sessionState}
          signOutDisabled={submitState === "submitting"}
          user={sessionUser}
          userDisplayName={accountDisplayName}
        />

        {loadState === "error" && (
          <section className="state-panel error-state" role="alert">
            {errorMessage ?? "Unable to load basho data."}
          </section>
        )}

        {loadState === "empty" && (
          <section className="state-panel">
            No rikishi are available for the current basho yet.
          </section>
        )}

        {loadState === "ready" && basho !== null && (
          <>
            <BashoPanel basho={basho} selectedCount={selectedIds.length} />

            {activeView === "selection" && (
              <TeamSelection
                canSubmit={canSubmit}
                createdTeam={createdTeam}
                displayName={displayName}
                errorMessage={errorMessage}
                isLocked={!canEditPicks}
                lockMessage={pickLockMessage}
                onDisplayNameChange={(nextDisplayName) => {
                  setDisplayName(nextDisplayName);
                  setCreatedTeam(null);
                }}
                onSubmit={handleSubmit}
                onToggleRikishi={toggleRikishi}
                rikishi={rikishi}
                selectedIds={selectedIds}
                selectedRikishi={selectedRikishi}
                submitState={submitState}
                teamSize={teamSize}
              />
            )}

            {activeView === "leaderboard" && (
              <LeaderboardPanel
                basho={basho}
                createdTeam={createdTeam}
                currentTeamId={ownedTeamId}
                errorMessage={leaderboardErrorMessage}
                expandedTeamId={expandedTeamId}
                leaderboard={leaderboard}
                loadState={leaderboardLoadState}
                onToggleTeam={(teamId) =>
                  setExpandedTeamId(expandedTeamId === teamId ? null : teamId)
                }
                rikishi={rikishi}
                totalDays={leaderboardTotalDays}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

function getPublicDataErrorMessage(error: unknown): string {
  const message = getErrorMessage(error);

  return message.includes("401")
    ? "Public basho data is unavailable because this deployment is returning HTTP 401 for anonymous API requests."
    : message;
}

async function loadInitialSession(
  neonAuthConfigured: boolean,
): Promise<SessionResponse> {
  return fetchSession().catch(() => ({
    mode: neonAuthConfigured ? "neon" : "local",
    user: null,
  }));
}

async function submitNeonAccount(input: {
  displayName: string;
  email: string;
  intent: "sign-in" | "sign-up";
  password: string;
}): Promise<SessionResponse> {
  if (input.intent === "sign-up") {
    await signUpWithNeon({
      displayName: input.displayName,
      email: input.email,
      password: input.password,
    });
  } else {
    await signInWithNeon({
      email: input.email,
      password: input.password,
    });
  }

  setAuthTokenProvider(getNeonAccessToken);

  const session = await waitForVerifiedSession();

  if (session.user === null) {
    throw new Error(
      "Signed in, but the app could not verify your session yet. Please try signing in again.",
    );
  }

  return session;
}

async function waitForVerifiedSession(): Promise<SessionResponse> {
  const maxAttempts = 8;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const session = await fetchSession();

      if (session.user !== null || attempt === maxAttempts) {
        return session;
      }
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }
    }

    await wait(250);
  }

  return {
    mode: "neon",
    user: null,
  };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function mergeLeaderboardBasho(
  currentBasho: Basho | null,
  leaderboardResponse: LeaderboardResponse,
): Basho {
  return {
    ...leaderboardResponse.basho,
    teamSize: currentBasho?.teamSize ?? 0,
  };
}

function applyMyTeam(
  myTeam: TeamResponse | null,
  availableRikishi: readonly { id: string }[],
  preserveDraftWhenTeamMissing: boolean,
  setDisplayName: (displayName: string) => void,
  setSelectedIds: (selectedIds: string[]) => void,
) {
  if (myTeam === null) {
    if (!preserveDraftWhenTeamMissing) {
      setDisplayName("");
      setSelectedIds([]);
    }
    return;
  }

  setDisplayName(myTeam.team.displayName);
  const availableRikishiIds = new Set(
    availableRikishi.map((rikishi) => rikishi.id),
  );
  setSelectedIds(
    myTeam.picks
      .map((pick) => pick.rikishiId)
      .filter((rikishiId) => availableRikishiIds.has(rikishiId)),
  );
}

async function fetchMyTeamOrNull(
  bashoId: string,
): Promise<TeamResponse | null> {
  try {
    return await fetchMyTeam(bashoId);
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

function getExpandedTeamId(
  leaderboardResponse: LeaderboardResponse,
  preferredTeamId: string | null,
): string | null {
  const preferredTeamIsRanked = leaderboardResponse.leaderboard.some(
    (entry) => entry.teamId === preferredTeamId,
  );

  if (preferredTeamIsRanked) {
    return preferredTeamId;
  }

  return leaderboardResponse.leaderboard[0]?.teamId ?? null;
}

function nextLeaderboardRequestId(
  requestIdRef: MutableRefObject<number>,
): number {
  requestIdRef.current += 1;
  return requestIdRef.current;
}

function isCurrentLeaderboardRequest(
  requestIdRef: MutableRefObject<number>,
  requestId: number,
): boolean {
  return requestIdRef.current === requestId;
}
