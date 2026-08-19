import type {
  Dispatch,
  FormEvent,
  MutableRefObject,
  ReactNode,
  SetStateAction,
} from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";
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
  reportAuthClientTokenUnavailable,
  setAuthTokenProvider,
  updateFantasyTeam,
} from "./api";
import {
  createNeonSessionCompletionTokenProvider,
  getFreshNeonAccessToken,
  getNeonAccessToken,
  IncompleteSessionError,
  INCOMPLETE_SESSION_ERROR_MESSAGE,
  isNeonAuthConfigured,
  signInWithNeon,
  signOutNeon,
  signUpWithNeon,
} from "./authClient";
import { AccountPanel } from "./components/AccountPanel";
import { AdminPanel } from "./components/AdminPanel";
import { AppHeader } from "./components/AppHeader";
import { BashoPanel } from "./components/BashoPanel";
import { LeaderboardPanel } from "./components/LeaderboardPanel";
import { MyStablePanel } from "./components/MyStablePanel";
import { PageHeader } from "./components/PageHeader";
import { TeamSelection } from "./components/TeamSelection";
import {
  appPaths,
  getActiveView,
  getLoginPath,
  getSafeReturnPath,
} from "./routing";
import { waitForVerifiedSession } from "./sessionVerification";
import type {
  Basho,
  CreatedTeamResponse,
  LeaderboardEntry,
  LeaderboardLoadState,
  LeaderboardResponse,
  LoadState,
  MyTeamResponse,
  RankedRikishi,
  SessionResponse,
  SessionUser,
} from "./types";
import { canEditFantasyPicks, getPickLockMessage } from "./lifecycle";

export function App() {
  return (
    <BrowserRouter>
      <RoutedApp />
    </BrowserRouter>
  );
}

function RoutedApp() {
  const location = useLocation();
  const navigate = useNavigate();
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
  const [lastSaveAction, setLastSaveAction] = useState<
    "created" | "updated" | null
  >(null);
  const [myTeam, setMyTeam] = useState<MyTeamResponse | null>(null);
  const [privateTeamLoadState, setPrivateTeamLoadState] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [privateTeamErrorMessage, setPrivateTeamErrorMessage] = useState<
    string | null
  >(null);
  const [ownedTeamLockedAt, setOwnedTeamLockedAt] = useState<
    string | undefined
  >(undefined);
  const bashoRequestIdRef = useRef(0);
  const leaderboardRequestIdRef = useRef(0);
  const sessionOperationInFlightRef = useRef(false);
  const activeView = getActiveView(location.pathname);

  const selectedRikishi = useMemo(
    () =>
      selectedIds
        .map((id) => rikishi.find((entry) => entry.id === id))
        .filter((entry): entry is RankedRikishi => entry !== undefined),
    [rikishi, selectedIds],
  );
  const teamSize = basho?.teamSize ?? 0;
  const canEditPicks =
    basho === null ? false : canEditFantasyPicks(basho, ownedTeamLockedAt);
  const pickLockMessage =
    basho === null ? undefined : getPickLockMessage(basho, ownedTeamLockedAt);
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
    setLastSaveAction(null);

    try {
      const saveAction = myTeam === null ? "created" : "updated";
      const response = await (saveAction === "created"
        ? createFantasyTeam(basho.id, {
            displayName: displayName.trim(),
            rikishiIds: selectedIds,
          })
        : updateFantasyTeam(basho.id, {
            displayName: displayName.trim(),
            rikishiIds: selectedIds,
          }));

      setCreatedTeam(response);
      setLastSaveAction(saveAction);
      setOwnedTeamLockedAt(response.team.lockedAt);
      setMyTeam(createMyTeamResponse(response, basho, rikishi));
      navigate(appPaths.stable);

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
        setMyTeam((current) =>
          mergeLeaderboardMyTeam(current, leaderboardResponse),
        );
        setLeaderboardTotalDays(leaderboardResponse.totalDays);
        setLeaderboard(leaderboardResponse.leaderboard);
        setExpandedTeamId(
          getExpandedTeamId(leaderboardResponse, response.team.id),
        );
        setLeaderboardLoadState("ready");
      } catch (error) {
        if (!isCurrentLeaderboardRequest(leaderboardRequestIdRef, requestId)) {
          return;
        }

        setLeaderboardLoadState("ready");
        setLeaderboardErrorMessage(getErrorMessage(error));
      }
    } catch (error) {
      if (
        error instanceof ApiRequestError &&
        error.status === 409 &&
        error.code === "picks-locked"
      ) {
        if (error.teamLockedAt !== undefined) {
          const teamLockedAt = error.teamLockedAt;

          setOwnedTeamLockedAt(teamLockedAt);
          setMyTeam((current) =>
            current === null
              ? null
              : {
                  ...current,
                  team: { ...current.team, lockedAt: teamLockedAt },
                },
          );

          if (myTeam === null && basho !== null) {
            try {
              const lockedTeam = await fetchMyTeam(basho.id);

              applyMyTeam(
                lockedTeam,
                rikishi,
                false,
                setDisplayName,
                setSelectedIds,
              );
              setMyTeam(lockedTeam);
              setOwnedTeamLockedAt(lockedTeam.team.lockedAt ?? teamLockedAt);
              navigate(appPaths.stable, { replace: true });
            } catch {
              navigate(appPaths.team, { replace: true });
            }
          } else {
            applyMyTeam(myTeam, rikishi, false, setDisplayName, setSelectedIds);
            navigate(appPaths.stable, { replace: true });
          }
        } else if (error.bashoStatus !== undefined) {
          const lockedStatus = error.bashoStatus;

          setBasho((current) =>
            current === null ? null : { ...current, status: lockedStatus },
          );
          setMyTeam((current) =>
            current === null
              ? null
              : {
                  ...current,
                  basho: { ...current.basho, status: lockedStatus },
                },
          );
          navigate(appPaths.stable, { replace: true });
        }
      }

      setErrorMessage(getErrorMessage(error));
    } finally {
      setSubmitState("idle");
    }
  }

  function openTeamEditor() {
    setCreatedTeam(null);
    setLastSaveAction(null);
    setErrorMessage(null);

    if (myTeam !== null) {
      applyMyTeam(myTeam, rikishi, false, setDisplayName, setSelectedIds);
    }

    navigate(appPaths.team);
  }

  function cancelTeamEdit() {
    if (myTeam === null) {
      return;
    }

    applyMyTeam(myTeam, rikishi, false, setDisplayName, setSelectedIds);
    setCreatedTeam(null);
    setLastSaveAction(null);
    setErrorMessage(null);
    navigate(appPaths.stable);
  }

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await submitAccount("sign-in");
  }

  async function handleSignUp() {
    await submitAccount("sign-up");
  }

  async function submitAccount(intent: "sign-in" | "sign-up") {
    if (sessionOperationInFlightRef.current) {
      return;
    }

    sessionOperationInFlightRef.current = true;
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
        setErrorMessage(getErrorMessage(error));
        setLoadState("error");
      }
      setSessionErrorMessage(getErrorMessage(error));
    } finally {
      sessionOperationInFlightRef.current = false;
      setSessionState("ready");
    }
  }

  async function handleSignOut() {
    if (sessionOperationInFlightRef.current) {
      return;
    }

    sessionOperationInFlightRef.current = true;
    let bashoReloadStarted = false;

    setSessionState("submitting");
    setSessionErrorMessage(null);

    try {
      if (authMode === "neon") {
        await signOutNeon();
      } else {
        await clearSession();
      }
      navigate(appPaths.home, { replace: true });
      await wait(0);
      setSessionUser(null);
      setAccountEmail("");
      setAccountDisplayName("");
      setCreatedTeam(null);
      setLastSaveAction(null);
      setMyTeam(null);
      setOwnedTeamLockedAt(undefined);
      setDisplayName("");
      setSelectedIds([]);

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
      sessionOperationInFlightRef.current = false;
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
    setPrivateTeamErrorMessage(null);
    setPrivateTeamLoadState(session.user === null ? "ready" : "loading");

    if (session.user !== null) {
      setMyTeam(null);
      setOwnedTeamLockedAt(undefined);
    }

    let currentBasho: Basho;
    let bashoRikishi: Awaited<ReturnType<typeof fetchBashoRikishi>>;

    try {
      currentBasho = await fetchCurrentBasho();
      bashoRikishi = await fetchBashoRikishi(currentBasho.id);
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
    setLoadState(bashoRikishi.rikishi.length === 0 ? "empty" : "ready");

    const requestId = nextLeaderboardRequestId(leaderboardRequestIdRef);
    setLeaderboardLoadState("loading");

    const leaderboardPromise = (async () => {
      try {
        const leaderboardResponse = await fetchLeaderboard(currentBasho.id);

        if (
          !isCurrentBashoRequest() ||
          !isCurrentLeaderboardRequest(leaderboardRequestIdRef, requestId)
        ) {
          return null;
        }

        setBasho((current) =>
          mergeLeaderboardBasho(current, leaderboardResponse),
        );
        setLeaderboardTotalDays(leaderboardResponse.totalDays);
        setLeaderboard(leaderboardResponse.leaderboard);
        setExpandedTeamId(getExpandedTeamId(leaderboardResponse, null));
        setLeaderboardErrorMessage(null);
        setLeaderboardLoadState("ready");

        return leaderboardResponse;
      } catch (error) {
        if (
          !isCurrentBashoRequest() ||
          !isCurrentLeaderboardRequest(leaderboardRequestIdRef, requestId)
        ) {
          return null;
        }

        setLeaderboard([]);
        setExpandedTeamId(null);
        setLeaderboardErrorMessage(getErrorMessage(error));
        setLeaderboardLoadState("ready");

        return null;
      }
    })();

    const privateTeamPromise = (async () => {
      if (session.user === null) {
        applyMyTeam(
          null,
          bashoRikishi.rikishi,
          preserveDraftWhenTeamMissing,
          setDisplayName,
          setSelectedIds,
        );
        setMyTeam(null);
        setOwnedTeamLockedAt(undefined);

        return null;
      }

      try {
        const loadedMyTeam = await fetchMyTeamOrNull(currentBasho.id);

        if (!isCurrentBashoRequest()) {
          return null;
        }

        applyMyTeam(
          loadedMyTeam,
          bashoRikishi.rikishi,
          preserveDraftWhenTeamMissing,
          setDisplayName,
          setSelectedIds,
        );
        setMyTeam(loadedMyTeam);
        setOwnedTeamLockedAt(loadedMyTeam?.team.lockedAt);
        setPrivateTeamLoadState("ready");

        return loadedMyTeam;
      } catch (error) {
        if (!isCurrentBashoRequest()) {
          return null;
        }

        setPrivateTeamErrorMessage(getErrorMessage(error));
        setPrivateTeamLoadState("error");

        return null;
      }
    })();

    const [leaderboardResponse, loadedMyTeam] = await Promise.all([
      leaderboardPromise,
      privateTeamPromise,
    ]);

    if (
      !isCurrentBashoRequest() ||
      leaderboardResponse === null ||
      loadedMyTeam === null
    ) {
      return;
    }

    setExpandedTeamId(
      getExpandedTeamId(leaderboardResponse, loadedMyTeam.team.id),
    );
  }

  async function refreshPlayerData(session: SessionResponse) {
    try {
      await loadBashoData(session, () => true);
    } catch (error) {
      setErrorMessage(getPublicDataErrorMessage(error));
      setLoadState("error");
      throw error;
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

  useEffect(() => {
    document.title = `${getPageTitle(activeView)} | Fantasy Sumo`;

    const focusTimer = window.setTimeout(() => {
      document.getElementById("page-title")?.focus();
    }, 0);

    return () => window.clearTimeout(focusTimer);
  }, [activeView]);

  function renderPlayerData(content: ReactNode) {
    if (loadState === "loading") {
      return (
        <section className="state-panel" aria-live="polite">
          Loading the current basho...
        </section>
      );
    }

    if (loadState === "error") {
      return (
        <section className="state-panel error-state" role="alert">
          {errorMessage ?? "Unable to load basho data."}
        </section>
      );
    }

    if (loadState === "empty" || basho === null) {
      return (
        <section className="state-panel">
          No rikishi are available for the current basho yet.
        </section>
      );
    }

    if (privateTeamLoadState === "loading") {
      return (
        <section className="state-panel" aria-live="polite">
          Loading your stable...
        </section>
      );
    }

    if (privateTeamLoadState === "error") {
      return (
        <section className="state-panel error-state" role="alert">
          {privateTeamErrorMessage ?? "Unable to load your fantasy team."}
        </section>
      );
    }

    return (
      <>
        <BashoPanel basho={basho} selectedCount={selectedIds.length} />
        {content}
      </>
    );
  }

  const safeLoginReturnPath =
    getSafeReturnPath(location.search) ?? appPaths.stable;

  return (
    <div className="site-shell">
      <AppHeader
        onSignOut={handleSignOut}
        sessionState={sessionState}
        signOutDisabled={submitState === "submitting"}
        showAdmin={sessionUser?.isAdmin === true}
        showTeam={sessionUser !== null && canEditPicks}
        user={sessionUser}
      />
      <main className="app-shell">
        <PageHeader activeView={activeView} />
        {sessionUser !== null && sessionErrorMessage !== null && (
          <section className="state-panel error-state" role="alert">
            {sessionErrorMessage}
          </section>
        )}

        <Routes>
          <Route
            path={appPaths.home}
            element={
              loadState === "loading" ? (
                <section className="state-panel" aria-live="polite">
                  Loading the current basho...
                </section>
              ) : loadState === "error" ? (
                <section className="state-panel error-state" role="alert">
                  {errorMessage ?? "Unable to load basho data."}
                </section>
              ) : loadState === "empty" || basho === null ? (
                <section className="state-panel">
                  No rikishi are available for the current basho yet.
                </section>
              ) : (
                <>
                  <BashoPanel
                    basho={basho}
                    selectedCount={0}
                    showPickProgress={false}
                  />
                  {sessionState === "ready" &&
                    sessionUser === null &&
                    canEditPicks && (
                      <section
                        className="public-cta"
                        aria-labelledby="join-title"
                      >
                        <div>
                          <p className="eyebrow">Join this basho</p>
                          <h2 id="join-title">Build your own stable</h2>
                          <p>
                            Log in or register to choose rikishi before picks
                            close.
                          </p>
                        </div>
                        <Link to={getLoginPath(appPaths.team)}>
                          Log in / Join
                        </Link>
                      </section>
                    )}
                  <LeaderboardPanel
                    basho={basho}
                    createdTeam={null}
                    currentTeamId={myTeam?.team.id ?? null}
                    errorMessage={leaderboardErrorMessage}
                    expandedTeamId={expandedTeamId}
                    leaderboard={leaderboard}
                    loadState={leaderboardLoadState}
                    onToggleTeam={(teamId) =>
                      setExpandedTeamId(
                        expandedTeamId === teamId ? null : teamId,
                      )
                    }
                    rikishi={rikishi}
                    totalDays={leaderboardTotalDays}
                  />
                </>
              )
            }
          />
          <Route
            path={appPaths.login}
            element={
              sessionState === "ready" && sessionUser !== null ? (
                <Navigate replace to={safeLoginReturnPath} />
              ) : (
                <>
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
                    user={null}
                    userDisplayName={accountDisplayName}
                  />
                  {loadState === "error" && (
                    <section className="state-panel error-state" role="alert">
                      {errorMessage ?? "Unable to load basho data."}
                    </section>
                  )}
                </>
              )
            }
          />
          <Route
            path={appPaths.stable}
            element={
              <ProtectedRoute
                returnTo={appPaths.stable}
                sessionState={sessionState}
                user={sessionUser}
              >
                {renderPlayerData(
                  <>
                    {createdTeam !== null && lastSaveAction !== null && (
                      <div
                        className="confirmation stable-confirmation"
                        role="status"
                      >
                        <strong>
                          {lastSaveAction === "created"
                            ? `${createdTeam.team.displayName} submitted.`
                            : `Changes saved for ${createdTeam.team.displayName}.`}
                        </strong>
                        <span>
                          {createdTeam.picks.length} rikishi selected for this
                          basho.
                        </span>
                      </div>
                    )}
                    <MyStablePanel
                      basho={basho!}
                      myTeam={myTeam}
                      onEdit={openTeamEditor}
                      user={sessionUser}
                    />
                  </>,
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path={appPaths.team}
            element={
              <ProtectedRoute
                returnTo={appPaths.team}
                sessionState={sessionState}
                user={sessionUser}
              >
                {renderPlayerData(
                  <TeamSelection
                    canSubmit={canSubmit}
                    createdTeam={createdTeam}
                    displayName={displayName}
                    errorMessage={errorMessage}
                    isLocked={!canEditPicks || sessionState === "submitting"}
                    lockMessage={pickLockMessage}
                    mode={myTeam === null ? "create" : "edit"}
                    onCancel={cancelTeamEdit}
                    onDisplayNameChange={(nextDisplayName) => {
                      setDisplayName(nextDisplayName);
                      setCreatedTeam(null);
                      setLastSaveAction(null);
                    }}
                    onSubmit={handleSubmit}
                    onToggleRikishi={toggleRikishi}
                    rikishi={rikishi}
                    selectedIds={selectedIds}
                    selectedRikishi={selectedRikishi}
                    submitState={submitState}
                    teamSize={teamSize}
                  />,
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path={appPaths.admin}
            element={
              <ProtectedRoute
                adminOnly
                returnTo={appPaths.admin}
                sessionState={sessionState}
                user={sessionUser}
              >
                <AdminPanel
                  onPlayerDataRefresh={() =>
                    refreshPlayerData({
                      mode: authMode ?? "local",
                      user: sessionUser,
                    })
                  }
                />
              </ProtectedRoute>
            }
          />
          <Route
            path="/leaderboard"
            element={<Navigate replace to={appPaths.home} />}
          />
          <Route path="*" element={<Navigate replace to={appPaths.home} />} />
        </Routes>
      </main>
    </div>
  );
}

interface ProtectedRouteProps {
  adminOnly?: boolean;
  children: ReactNode;
  returnTo: "/stable" | "/team" | "/admin";
  sessionState: "loading" | "ready" | "submitting";
  user: SessionUser | null;
}

function ProtectedRoute({
  adminOnly = false,
  children,
  returnTo,
  sessionState,
  user,
}: ProtectedRouteProps) {
  if (sessionState !== "ready") {
    return (
      <section className="state-panel" aria-live="polite">
        Checking your session...
      </section>
    );
  }

  if (user === null) {
    return <Navigate replace to={getLoginPath(returnTo)} />;
  }

  if (adminOnly && user.isAdmin !== true) {
    return (
      <section className="state-panel error-state" role="alert">
        Administrator access is required to open this page.
      </section>
    );
  }

  return children;
}

function getPageTitle(activeView: ReturnType<typeof getActiveView>): string {
  switch (activeView) {
    case "login":
      return "Log in or join";
    case "stable":
      return "My stable";
    case "team":
      return "Team picks";
    case "admin":
      return "Admin controls";
    default:
      return "Leaderboard";
  }
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

  setAuthTokenProvider(
    createNeonSessionCompletionTokenProvider(
      getFreshNeonAccessToken,
      getNeonAccessToken,
    ),
  );

  let session: SessionResponse;

  try {
    session = await waitForVerifiedSession(fetchSession, wait);
  } catch (error) {
    if (error instanceof IncompleteSessionError) {
      reportAuthClientTokenUnavailable();
    }

    throw error;
  } finally {
    setAuthTokenProvider(getNeonAccessToken);
  }

  if (session.user === null) {
    throw new Error(INCOMPLETE_SESSION_ERROR_MESSAGE);
  }

  return session;
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

function mergeLeaderboardMyTeam(
  currentTeam: MyTeamResponse | null,
  leaderboardResponse: LeaderboardResponse,
): MyTeamResponse | null {
  if (
    currentTeam === null ||
    currentTeam.basho.id !== leaderboardResponse.basho.id
  ) {
    return currentTeam;
  }

  return {
    ...currentTeam,
    basho: {
      ...currentTeam.basho,
      ...leaderboardResponse.basho,
    },
  };
}

function applyMyTeam(
  myTeam: MyTeamResponse | null,
  availableRikishi: readonly { id: string }[],
  preserveDraftWhenTeamMissing: boolean,
  setDisplayName: (displayName: string) => void,
  setSelectedIds: Dispatch<SetStateAction<string[]>>,
) {
  const availableRikishiIds = new Set(
    availableRikishi.map((rikishi) => rikishi.id),
  );

  if (myTeam === null) {
    if (preserveDraftWhenTeamMissing) {
      setSelectedIds((selectedIds) =>
        selectedIds.filter((rikishiId) => availableRikishiIds.has(rikishiId)),
      );
    } else {
      setDisplayName("");
      setSelectedIds([]);
    }
    return;
  }

  setDisplayName(myTeam.team.displayName);
  setSelectedIds(
    myTeam.picks
      .map((pick) => pick.rikishiId)
      .filter((rikishiId) => availableRikishiIds.has(rikishiId)),
  );
}

function createMyTeamResponse(
  createdTeam: CreatedTeamResponse,
  basho: Basho,
  rankedRikishi: RankedRikishi[],
): MyTeamResponse {
  const rikishiById = new Map(
    rankedRikishi.map((rikishi) => [rikishi.id, rikishi]),
  );

  return {
    basho: {
      id: basho.id,
      isDemo: basho.isDemo,
      name: basho.name,
      startDate: basho.startDate,
      endDate: basho.endDate,
      status: basho.status,
      ...(basho.currentDay === undefined
        ? {}
        : { currentDay: basho.currentDay }),
    },
    team: createdTeam.team,
    totalScore: 0,
    picks: createdTeam.picks
      .map((pick) => {
        const rikishi = rikishiById.get(pick.rikishiId);

        return {
          ...pick,
          shikona: rikishi?.shikona ?? pick.rikishiId,
          ...(rikishi?.heya === undefined ? {} : { heya: rikishi.heya }),
          ...(rikishi?.rank === undefined ? {} : { rank: rikishi.rank }),
          ...(rikishi?.rankOrder === undefined
            ? {}
            : { rankOrder: rikishi.rankOrder }),
          wins: 0,
          score: 0,
        };
      })
      .sort(
        (left, right) =>
          (left.rankOrder ?? Number.MAX_SAFE_INTEGER) -
            (right.rankOrder ?? Number.MAX_SAFE_INTEGER) ||
          left.shikona.localeCompare(right.shikona),
      ),
  };
}

async function fetchMyTeamOrNull(
  bashoId: string,
): Promise<MyTeamResponse | null> {
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
