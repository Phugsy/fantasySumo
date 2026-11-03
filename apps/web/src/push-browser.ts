import {
  deletePushDevice,
  fetchPushPreferences,
  revokePushDevice,
  savePushSubscription,
  type PushPreferences,
} from "./api";

// Shared with the standalone worker. Store no endpoint, encryption key or JWT.
const CACHE = "fantasy-sumo-push-v1";
const KEY = "/__fantasy-sumo-push-consent";
const LOCK = "fantasy-sumo-push";
const WORKER = "/push-worker.js";
export interface DeviceConsent {
  deviceId: string;
  ownerId: string;
  enabled: boolean;
  revision?: string;
  revokeToken?: string;
  bashoId?: string;
  endsAt?: string;
  timezone?: string;
  shownDays?: number;
}
export async function readPushConsent(): Promise<DeviceConsent | undefined> {
  if (!("caches" in globalThis)) return;
  const response = await (await caches.open(CACHE)).match(KEY);
  if (!response) return;
  try {
    const value = await response.json();
    return value &&
      typeof value.deviceId === "string" &&
      typeof value.ownerId === "string" &&
      typeof value.enabled === "boolean"
      ? (value as DeviceConsent)
      : undefined;
  } catch {
    return;
  } // Corrupt metadata also fails closed in the worker.
}
async function writeConsent(value: DeviceConsent) {
  await (
    await caches.open(CACHE)
  ).put(KEY, new Response(JSON.stringify(value)));
}
async function exclusive<T>(work: () => Promise<T>): Promise<T> {
  if (!navigator.locks)
    throw new Error("This browser cannot safely manage reminders.");
  return await navigator.locks.request(LOCK, work);
}
export function pushSupport(): string | null {
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (
    ios &&
    !window.matchMedia("(display-mode: standalone)").matches &&
    !(navigator as Navigator & { standalone?: boolean }).standalone
  )
    return "On iPhone or iPad, add Fantasy Sumo to your Home Screen and open it there first.";
  if (
    !globalThis.isSecureContext ||
    !("Notification" in globalThis) ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in globalThis) ||
    !("caches" in globalThis) ||
    !navigator.locks
  )
    return "Reminders need a supported browser with secure storage.";
  if (Notification.permission === "denied")
    return "Notifications are blocked. You can change this in your browser settings.";
  return null;
}
function available(
  p: PushPreferences,
  owner: string,
): p is PushPreferences & {
  bashoId: string;
  endsAt: string;
  publicKey: string;
} {
  return (
    p.available &&
    p.ownerId === owner &&
    !!p.bashoId &&
    !!p.publicKey &&
    !!p.endsAt &&
    Date.parse(p.endsAt) > Date.now()
  );
}
async function ownRegistration() {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration("/");
  return registration?.active?.scriptURL ===
    new URL(WORKER, window.location.origin).href
    ? registration
    : undefined;
}
async function silence(record: DeviceConsent) {
  await writeConsent({ ...record, enabled: false });
  const registration = await ownRegistration();
  for (const notification of (await registration?.getNotifications()) ?? [])
    notification.close();
  return registration;
}
async function suspendLocked(owner: string | null, revoke: boolean) {
  const record = await readPushConsent();
  if (!record) return;
  let registration: ServiceWorkerRegistration | undefined;
  let cleanupError: Error | undefined;
  try {
    registration = await silence(record);
  } catch {
    cleanupError = new Error(
      "Unable to silence reminders in this browser. Try again.",
    );
  }
  // Browser cleanup must never prevent the independent server opt-out.
  if (revoke) {
    if (record.revokeToken)
      await revokePushDevice(record.deviceId, record.revokeToken);
    else if (owner === record.ownerId)
      await deletePushDevice(record.deviceId, owner);
    else
      throw new Error(
        "Sign in to the previous account to finish disabling reminders.",
      );
  }
  if (cleanupError) throw cleanupError;
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription && !(await subscription.unsubscribe()))
    throw new Error(
      "Unable to disconnect this device. Try again before signing out.",
    );
  if (revoke) await (await caches.open(CACHE)).delete(KEY);
}
// Called before changing auth, never after credentials have been discarded.
export async function suspendPush(owner: string | null) {
  if (!navigator.locks && !(await readPushConsent())) return;
  await exclusive(() => suspendLocked(owner, true));
}
export async function disableAllPush(owner: string) {
  // Account-wide server opt-out remains available without native browser APIs.
  const work = async () => {
    const record = await readPushConsent();
    await deletePushDevice(undefined, owner);
    if (record?.ownerId === owner) await suspendLocked(owner, true);
  };
  if (navigator.locks) await exclusive(work);
  else {
    if (await readPushConsent())
      throw new Error("This browser cannot safely manage reminders.");
    await work();
  }
}
// A restored/externally changed session must not inherit the old account's opt-in.
// Anonymous startup silences locally and retains only the proof for next login.
export async function reconcilePushSession(owner: string | null) {
  if (!navigator.locks && !(await readPushConsent())) return;
  await exclusive(async () => {
    const record = await readPushConsent();
    if (!record) return;
    if (record.ownerId !== owner) {
      await suspendLocked(owner, owner !== null);
      return;
    }
    try {
      const p = await fetchPushPreferences();
      if (
        !available(p, owner!) ||
        !p.subscribed ||
        p.revision !== record.revision ||
        p.deviceId !== record.deviceId ||
        Notification.permission !== "granted"
      ) {
        await silence(record);
      }
    } catch {
      await silence(record);
    }
  });
}
function publicKey(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(value))
    throw new Error("Invalid reminder configuration.");
  const key = Uint8Array.from(
    atob(value.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0),
  );
  if (key.length !== 65 || key[0] !== 4)
    throw new Error("Invalid reminder configuration.");
  return key;
}
async function activated(registration: ServiceWorkerRegistration) {
  if (registration.active?.state === "activated") return;
  const worker =
    registration.installing ?? registration.waiting ?? registration.active;
  if (!worker) throw new Error("Unable to prepare reminders.");
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Reminder setup timed out. Try again."));
    }, 10_000);
    const cleanup = () => {
      clearTimeout(timer);
      worker.removeEventListener("statechange", change);
    };
    const change = () => {
      if (worker.state === "activated") {
        cleanup();
        resolve();
      } else if (worker.state === "redundant") {
        cleanup();
        reject(new Error("Reminder setup failed."));
      }
    };
    worker.addEventListener("statechange", change);
    change();
  });
}
export function enablePush(
  owner: string,
  cached: PushPreferences,
): Promise<void> {
  const unsupported = pushSupport();
  if (unsupported) return Promise.reject(new Error(unsupported));
  if (!available(cached, owner))
    return Promise.reject(
      new Error("Reminders are not available for this session."),
    );
  // Invoke directly in the click handler, before awaiting locks or network IO.
  const permission =
    Notification.permission === "granted"
      ? Promise.resolve("granted" as const)
      : Notification.requestPermission();
  return permission.then((result) => {
    if (result !== "granted")
      throw new Error(
        "Notifications were not enabled. You can keep playing without them.",
      );
    return exclusive(async () => {
      let p = await fetchPushPreferences();
      if (!available(p, owner))
        throw new Error("Reminders are not available for this session.");
      publicKey(p.publicKey);
      await suspendLocked(owner, true);
      p = await fetchPushPreferences();
      if (!available(p, owner))
        throw new Error(
          "Your session changed. Refresh before enabling reminders.",
        );
      const key = publicKey(p.publicKey);
      const record: DeviceConsent = {
        deviceId: crypto.randomUUID(),
        ownerId: owner,
        enabled: false,
      };
      // Persist recovery identity before any remote write. A lost response stays muted.
      await writeConsent(record);
      let native: PushSubscription | null = null;
      try {
        const registration = await navigator.serviceWorker.register(WORKER, {
          scope: "/",
        });
        await activated(registration);
        native = await registration.pushManager.getSubscription();
        if (native) {
          if (!(await native.unsubscribe()))
            throw new Error("Unable to replace this device registration.");
          native = null;
        }
        native = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key,
        });
        const value = native.toJSON();
        if (!value.endpoint || !value.keys?.p256dh || !value.keys.auth)
          throw new Error(
            "This browser did not provide a usable subscription.",
          );
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const saved = await savePushSubscription({
          expectedOwnerId: owner,
          deviceId: record.deviceId,
          expectedRevision: p.revision,
          subscription: {
            endpoint: value.endpoint,
            expirationTime: value.expirationTime ?? null,
            keys: { p256dh: value.keys.p256dh, auth: value.keys.auth },
            timezone,
          },
        });
        Object.assign(record, saved, {
          bashoId: p.bashoId,
          endsAt: p.endsAt,
          timezone,
        });
        await writeConsent(record);
        const confirmed = await fetchPushPreferences();
        if (
          !available(confirmed, owner) ||
          confirmed.revision !== saved.revision ||
          confirmed.deviceId !== record.deviceId ||
          Notification.permission !== "granted"
        )
          throw new Error("Reminder setup changed. Try again.");
        await writeConsent({ ...record, enabled: true, shownDays: 0 });
      } catch {
        // No uncertain enrollment can enable local display. Preserve revocation
        // proof/identity for explicit retry, and disconnect the native endpoint.
        try {
          await writeConsent({ ...record, enabled: false });
        } finally {
          await native?.unsubscribe().catch(() => false);
        }
        throw new Error(
          "Unable to enable reminders. This device remains muted; retry or turn reminders off.",
        );
      }
    });
  });
}
