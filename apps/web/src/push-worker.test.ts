// @vitest-environment node
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const source = readFileSync(
  new URL("../public/push-worker.js", import.meta.url),
  "utf8",
);
const payload = {
  tag: "pick-window:demo:1",
  revision: "r",
  expiresAt: "2026-05-10T03:00:00Z",
  url: "https://evil.test",
};
function harness(extra = {}) {
  let record = {
    enabled: true,
    ownerId: "alice",
    revision: "r",
    bashoId: "demo",
    endsAt: "2026-05-24T15:00:00Z",
    timezone: "Asia/Tokyo",
    ...extra,
  };
  const handlers: Record<string, (event: unknown) => void> = {};
  const showNotification = vi.fn(async () => {}),
    focus = vi.fn(async () => {});
  const navigate = vi.fn(async () => ({ focus })),
    openWindow = vi.fn(async () => {});
  runInNewContext(source, {
    Response,
    Date,
    Intl,
    URL,
    caches: {
      open: async () => ({
        match: async () => new Response(JSON.stringify(record)),
        put: async (_: string, response: Response) => {
          record = await response.json();
        },
      }),
    },
    self: {
      addEventListener: (name: string, fn: (e: unknown) => void) => {
        handlers[name] = fn;
      },
      navigator: {
        locks: { request: (_: string, work: () => Promise<void>) => work() },
      },
      location: { origin: "https://fantasy.test" },
      registration: { showNotification },
      clients: {
        matchAll: async () => [{ url: "https://fantasy.test/", navigate }],
        openWindow,
      },
    },
  });
  return {
    showNotification,
    navigate,
    focus,
    openWindow,
    send: async (type = "push", data: unknown = payload) => {
      let task: Promise<void> = Promise.resolve();
      handlers[type]!({
        data: { json: () => data },
        notification: { data, close: vi.fn() },
        waitUntil: (p: Promise<void>) => {
          task = p;
        },
      });
      await task;
    },
  };
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-10T02:00:00Z"));
});
afterEach(() => vi.useRealTimers());
it("uses generic content, deduplicates a day, and never opens payload-controlled URLs", async () => {
  const h = harness();
  await h.send();
  await h.send();
  expect(h.showNotification).toHaveBeenCalledOnce();
  expect(h.showNotification).toHaveBeenCalledWith(
    "Fantasy Sumo",
    expect.objectContaining({
      body: "Today's Pick Window is open. Check the app for your deadline.",
    }),
  );
  await h.send("notificationclick");
  expect(h.navigate).toHaveBeenCalledWith("https://fantasy.test/stable");
  expect(h.focus).toHaveBeenCalledOnce();
  expect(h.openWindow).not.toHaveBeenCalled();
});
it.each([
  { enabled: false },
  { revision: "replacement" },
  { bashoId: "different" },
  { endsAt: "2026-05-10T02:00:00Z" },
  { timezone: "Europe/London" },
  { timezone: "invalid" },
])(
  "suppresses disabled, stale, expired and quiet reminders %j",
  async (extra) => {
    const h = harness(extra);
    await h.send();
    await h.send("notificationclick");
    expect(h.showNotification).not.toHaveBeenCalled();
    expect(h.navigate).not.toHaveBeenCalled();
  },
);
it.each([
  null,
  {},
  { ...payload, expiresAt: "2026-05-10T02:00:00Z" },
  { ...payload, tag: "pick-window:demo:16" },
  { ...payload, expiresAt: "invalid" },
])("suppresses malformed/late payloads %j", async (data) => {
  const h = harness();
  await h.send("push", data);
  expect(h.showNotification).not.toHaveBeenCalled();
});
