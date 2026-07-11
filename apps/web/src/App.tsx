import type { FormEvent, MutableRefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
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
  getNeonSession,
  isNeonAuthConfigured,
  signInWithNeon,
  signOutNeon,
  signUpWithNeon,
} from "./authClient";
import { AccountPanel } from "./components/AccountPanel";
import { BashoPanel } from "./components/BashoPanel";
import { LeaderboardPanel } from "./components/LeaderboardPanel";
import { PageHeader } from "./components/PageHeader";
import { TeamSelection } from "./components/TeamSelection";
import { ViewSwitch } from "./components/ViewSwitch";
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
  const leaderboardRequestIdRef = useRef(0);

  useEffect(() => {
    let isCurrent = true;

    async function loadBasho() {
      const neonAuthConfigured = isNeonAuthConfigured();

      try {
        if (neonAuthConfigured) {
          setAuthTokenProvider(getNeonAccessToken);
        }

        const session = await loadInitialSession(neonAuthConfigured).catch(
          (error) => {
            if (isCurrent) {
              setSessionErrorMessage(getErrorMessage(error));
            }

            return {
              mode: neonAuthConfigured ? "neon" : "local",
              user: null,
            } satisfies SessionResponse;
          },
        );

        if (!isCurrent) {
          return;
        }

        setAuthMode(session.mode);
        setSessionUser(session.user);
        setAccountEmail(session.user?.email ?? "");
        setAccountDisplayName(session.user?.displayName ?? "");
        setSessionState("ready");

        const currentBasho = await fetchCurrentBasho();
        const bashoRikishi = await fetchBashoRikishi(currentBasho.id);
        const myTeam =
          session.user === null
            ? null
            : await fetchMyTeam(currentBasho.id).catch(() => null);

        if (!isCurrent) {
          return;
        }

        setBasho({
          ...bashoRikishi.basho,
          teamSize: currentBasho.teamSize,
        });
        setRikishi(bashoRikishi.rikishi);
        applyMyTeam(myTeam, setDisplayName, setSelectedIds);
        setLoadState(bashoRikishi.rikishi.length === 0 ? "empty" : "ready");

        const requestId = nextLeaderboardRequestId(leaderboardRequestIdRef);
        setLeaderboardLoadState("loading");

        try {
          const leaderboardResponse = await fetchLeaderboard(currentBasho.id);

          if (
            !isCurrent ||
            !isCurrentLeaderboardRequest(leaderboardRequestIdRef, requestId)
          ) {
            return;
          }

          setBasho((current) =>
            mergeLeaderboardBasho(current, leaderboardResponse),
          );
          setLeaderboardTotalDays(leaderboardResponse.totalDays);
          setLeaderboard(leaderboardResponse.leaderboard);
          setExpandedTeamId(leaderboardResponse.leaderboard[0]?.teamId ?? null);
          setLeaderboardErrorMessage(null);
          setLeaderboardLoadState("ready");
        } catch (error) {
          if (
            !isCurrent ||
            !isCurrentLeaderboardRequest(leaderboardRequestIdRef, requestId)
          ) {
            return;
          }

          setLeaderboard([]);
          setExpandedTeamId(null);
          setLeaderboardErrorMessage(getErrorMessage(error));
          setLeaderboardLoadState("ready");
        }
      } catch (error) {
        if (!isCurrent) {
          return;
        }

        setErrorMessage(getErrorMessage(error));
        setSessionState("ready");
        setLoadState("error");
      }
    }

    void loadBasho();

    return () => {
      isCurrent = false;
    };
  }, []);

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
        setExpandedTeamId(getExpandedTeamId(leaderboardResponse, response));
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
    setSessionState("submitting");
    setSessionErrorMessage(null);

    try {
      const session =
        authMode === "neon"
          ? intent === "sign-up"
            ? await signUpWithNeon({
                displayName: accountDisplayName.trim(),
                email: accountEmail.trim(),
                password: accountPassword,
              })
            : await signInWithNeon({
                email: accountEmail.trim(),
                password: accountPassword,
              })
          : await createSession({
              email: accountEmail.trim(),
              displayName: accountDisplayName.trim(),
            });

      setAuthMode(session.mode);
      setSessionUser(session.user);
      setAccountPassword("");

      if (basho !== null && session.user !== null) {
        const myTeam = await fetchMyTeam(basho.id).catch(() => null);
        applyMyTeam(myTeam, setDisplayName, setSelectedIds);
      }
    } catch (error) {
      setSessionErrorMessage(getErrorMessage(error));
    } finally {
      setSessionState("ready");
    }
  }

  async function handleSignOut() {
    setSessionState("submitting");
    setSessionErrorMessage(null);

    try {
      if (authMode === "neon") {
        await signOutNeon();
      } else {
        await clearSession();
      }
      setSessionUser(null);
      setCreatedTeam(null);
    } catch (error) {
      setSessionErrorMessage(getErrorMessage(error));
    } finally {
      setSessionState("ready");
    }
  }

  return (
    <main className="app-shell">
      <PageHeader />

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
          <ViewSwitch
            activeView={activeView}
            disabled={submitState === "submitting"}
            onChange={setActiveView}
          />

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
  );
}

async function loadInitialSession(
  neonAuthConfigured: boolean,
): Promise<SessionResponse> {
  const apiSession = await fetchSession();

  return apiSession.mode === "neon" && neonAuthConfigured
    ? getNeonSession()
    : apiSession;
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
  setDisplayName: (displayName: string) => void,
  setSelectedIds: (selectedIds: string[]) => void,
) {
  if (myTeam === null) {
    return;
  }

  setDisplayName(myTeam.team.displayName);
  setSelectedIds(myTeam.picks.map((pick) => pick.rikishiId));
}

function getExpandedTeamId(
  leaderboardResponse: LeaderboardResponse,
  createdTeam: CreatedTeamResponse,
): string | null {
  const createdTeamIsRanked = leaderboardResponse.leaderboard.some(
    (entry) => entry.teamId === createdTeam.team.id,
  );

  if (createdTeamIsRanked) {
    return createdTeam.team.id;
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
