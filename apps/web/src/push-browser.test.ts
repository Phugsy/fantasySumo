import { beforeEach, afterEach, expect, it, vi } from "vitest";
import * as api from "./api";
import {
  enablePush,
  disableAllPush,
  readPushConsent,
  reconcilePushSession,
  suspendPush,
  pushSupport,
} from "./push-browser";
vi.mock("./api", () => ({
  fetchPushPreferences: vi.fn(),
  savePushSubscription: vi.fn(),
  revokePushDevice: vi.fn(),
  deletePushDevice: vi.fn(),
}));
const key = btoa(String.fromCharCode(4, ...Array(64).fill(1))).replace(
  /=/g,
  "",
);
const base = {
  available: true,
  subscribed: false,
  revision: null,
  ownerId: "alice",
  publicKey: key,
  bashoId: "demo",
  endsAt: "2099-05-24T15:00:00Z",
};
let stored: string | undefined;
let notificationPermission = "default";
let queue: Promise<unknown>;
const unsubscribe = vi.fn(async () => true);
const close = vi.fn();
const native = {
  toJSON: () => ({
    endpoint: "https://fcm.googleapis.com/wp/synthetic",
    expirationTime: null,
    keys: { p256dh: key, auth: "synthetic" },
  }),
  unsubscribe,
};
const subscribe = vi.fn(async () => native);
const registration = {
  active: {
    state: "activated",
    scriptURL: "http://localhost:3000/push-worker.js",
  },
  pushManager: { getSubscription: vi.fn(async () => null), subscribe },
  getNotifications: vi.fn(async () => [{ close }]),
};
const register = vi.fn(async () => registration);
const permission = vi.fn(async () => {
  notificationPermission = "granted";
  return "granted";
});
beforeEach(() => {
  vi.clearAllMocks();
  stored = undefined;
  queue = Promise.resolve();
  vi.stubGlobal("isSecureContext", true);
  notificationPermission = "default";
  vi.stubGlobal("Notification", {
    get permission() {
      return notificationPermission;
    },
    requestPermission: permission,
  });
  vi.stubGlobal("PushManager", class {});
  vi.stubGlobal("caches", {
    open: async () => ({
      match: async () => (stored ? new Response(stored) : undefined),
      put: async (_: string, response: Response) => {
        stored = await response.text();
      },
      delete: async () => {
        stored = undefined;
        return true;
      },
    }),
  });
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: (_: string, work: () => Promise<unknown>) => {
        const next = queue.then(work);
        queue = next.catch(() => {});
        return next;
      },
    },
  });
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { register, getRegistration: vi.fn(async () => registration) },
  });
  vi.mocked(api.fetchPushPreferences).mockResolvedValue(base);
  vi.mocked(api.savePushSubscription).mockImplementation(async (body) => {
    vi.mocked(api.fetchPushPreferences).mockResolvedValue({
      ...base,
      subscribed: true,
      revision: "revision",
      deviceId: body.deviceId,
    });
    return { revision: "revision", revokeToken: "proof" };
  });
  vi.mocked(api.revokePushDevice).mockResolvedValue();
  vi.mocked(api.deletePushDevice).mockResolvedValue();
  permission.mockImplementation(async () => {
    notificationPermission = "granted";
    return "granted";
  });
  unsubscribe.mockResolvedValue(true);
});
afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "locks");
  Reflect.deleteProperty(navigator, "serviceWorker");
});
it("never prompts or registers when unavailable, unsupported or ownership has changed", async () => {
  await expect(
    enablePush("alice", { ...base, available: false }),
  ).rejects.toThrow("not available");
  await expect(enablePush("bob", base)).rejects.toThrow("not available");
  vi.stubGlobal("isSecureContext", false);
  expect(pushSupport()).toContain("supported browser");
  await expect(enablePush("alice", base)).rejects.toThrow("supported browser");
  expect(permission).not.toHaveBeenCalled();
  expect(register).not.toHaveBeenCalled();
});
it("can disable server reminders everywhere without native Push APIs", async () => {
  Reflect.deleteProperty(navigator, "locks");
  Reflect.deleteProperty(navigator, "serviceWorker");
  await disableAllPush("alice");
  expect(api.deletePushDevice).toHaveBeenCalledWith(undefined, "alice");
  expect(register).not.toHaveBeenCalled();
});
it("disables the server even when native notification cleanup fails", async () => {
  await enablePush("alice", base);
  registration.getNotifications.mockRejectedValueOnce(
    new Error("browser cleanup failed"),
  );
  await expect(disableAllPush("alice")).rejects.toThrow(
    "Unable to silence reminders",
  );
  expect(api.deletePushDevice).toHaveBeenCalledWith(undefined, "alice");
  expect(api.revokePushDevice).toHaveBeenCalledOnce();
  expect(await readPushConsent()).toMatchObject({ enabled: false });
});
it("ignores corrupt local metadata without enabling or blocking an anonymous session", async () => {
  stored = "not-json";
  await reconcilePushSession(null);
  expect(await readPushConsent()).toBeUndefined();
  expect(register).not.toHaveBeenCalled();
});
it("requests permission directly from the gesture, handles denial without registration", async () => {
  permission.mockResolvedValue("denied");
  const result = enablePush("alice", base);
  expect(permission).toHaveBeenCalledOnce();
  await expect(result).rejects.toThrow("not enabled");
  expect(register).not.toHaveBeenCalled();
  expect(api.savePushSubscription).not.toHaveBeenCalled();
});
it("stores only consent/proof after server confirmation and revokes before clearing it", async () => {
  await enablePush("alice", base);
  const record = await readPushConsent();
  expect(record).toMatchObject({
    ownerId: "alice",
    enabled: true,
    revision: "revision",
    revokeToken: "proof",
  });
  expect(stored).not.toContain("fcm.googleapis");
  expect(stored).not.toContain("p256dh");
  expect(register).toHaveBeenCalledWith("/push-worker.js", { scope: "/" });
  vi.mocked(api.revokePushDevice).mockImplementation(async () => {
    expect((await readPushConsent())!.enabled).toBe(false);
    expect(close).toHaveBeenCalled();
  });
  await suspendPush("alice");
  expect(api.revokePushDevice).toHaveBeenCalledWith(record!.deviceId, "proof");
  expect(await readPushConsent()).toBeUndefined();
});
it("fails closed and retains retry proof when remote cleanup fails", async () => {
  await enablePush("alice", base);
  vi.mocked(api.revokePushDevice).mockRejectedValue(new Error("offline"));
  await expect(suspendPush("alice")).rejects.toThrow("offline");
  expect(await readPushConsent()).toMatchObject({
    enabled: false,
    revokeToken: "proof",
  });
  expect(close).toHaveBeenCalled();
});
it("leaves uncertain enrollment muted, unsubscribes, and supports owner-checked recovery", async () => {
  vi.mocked(api.savePushSubscription).mockRejectedValue(
    new Error("response lost"),
  );
  await expect(enablePush("alice", base)).rejects.toThrow("remains muted");
  expect(await readPushConsent()).toMatchObject({
    ownerId: "alice",
    enabled: false,
  });
  expect(unsubscribe).toHaveBeenCalled();
  await suspendPush("alice");
  expect(api.deletePushDevice).toHaveBeenCalledWith(
    expect.any(String),
    "alice",
  );
});
it("serializes opt-out behind an enrollment already in flight", async () => {
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  vi.mocked(api.savePushSubscription).mockImplementation(async (body) => {
    await pending;
    vi.mocked(api.fetchPushPreferences).mockResolvedValue({
      ...base,
      subscribed: true,
      revision: "revision",
      deviceId: body.deviceId,
    });
    return { revision: "revision", revokeToken: "proof" };
  });
  const enabling = enablePush("alice", base);
  await vi.waitFor(() => expect(api.savePushSubscription).toHaveBeenCalled());
  const disabling = suspendPush("alice");
  finish();
  await Promise.all([enabling, disabling]);
  expect(await readPushConsent()).toBeUndefined();
  expect(api.revokePushDevice).toHaveBeenCalledOnce();
});
it("serializes sign-out even before in-flight enrollment has written any consent", async () => {
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  vi.mocked(api.fetchPushPreferences).mockImplementationOnce(async () => {
    await pending;
    return base;
  });
  const enabling = enablePush("alice", base);
  await vi.waitFor(() =>
    expect(api.fetchPushPreferences).toHaveBeenCalledOnce(),
  );
  expect(await readPushConsent()).toBeUndefined();
  const disabling = suspendPush("alice");
  finish();
  await Promise.all([enabling, disabling]);
  expect(await readPushConsent()).toBeUndefined();
  expect(api.revokePushDevice).toHaveBeenCalledOnce();
});
it("silences account changes and uses only the revocation proof for a different signed-in owner", async () => {
  await enablePush("alice", base);
  await reconcilePushSession(null);
  expect(await readPushConsent()).toMatchObject({
    enabled: false,
    revokeToken: "proof",
  });
  expect(api.revokePushDevice).not.toHaveBeenCalled();
  await reconcilePushSession("bob");
  expect(api.revokePushDevice).toHaveBeenCalledOnce();
  expect(api.deletePushDevice).not.toHaveBeenCalled();
  expect(await readPushConsent()).toBeUndefined();
});
it("mutes revoked/expired server consent without registering or silently renewing", async () => {
  await enablePush("alice", base);
  register.mockClear();
  vi.mocked(api.fetchPushPreferences).mockResolvedValue({
    ...base,
    available: false,
  });
  await reconcilePushSession("alice");
  expect(await readPushConsent()).toMatchObject({ enabled: false });
  expect(register).not.toHaveBeenCalled();
});
