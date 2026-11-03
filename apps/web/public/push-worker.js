// No fetch handler, offline cache, auth token or background subscription renewal.
// Metadata names and lock match src/push-browser.ts. Missing storage fails closed.
const CACHE = "fantasy-sumo-push-v1";
const KEY = "/__fantasy-sumo-push-consent";
const LOCK = "fantasy-sumo-push";
const BODY = "Today's Pick Window is open. Check the app for your deadline.";

async function consent() {
  const cache = await caches.open(CACHE);
  const response = await cache.match(KEY);
  return { cache, value: response ? await response.json() : undefined };
}
function valid(value, data) {
  if (
    !value?.enabled ||
    !value.ownerId ||
    !value.revision ||
    !value.timezone ||
    data?.revision !== value.revision ||
    !Number.isFinite(Date.parse(value.endsAt)) ||
    Date.now() >= Date.parse(value.endsAt) ||
    !Number.isFinite(Date.parse(data.expiresAt)) ||
    Date.now() >= Date.parse(data.expiresAt)
  )
    return false;
  const match = /^pick-window:([^:]+):([1-9]|1[0-5])$/.exec(data.tag);
  if (!match || match[1] !== value.bashoId) return false;
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: value.timezone,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date()),
  );
  return hour >= 8 && hour < 22;
}
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      if (!self.navigator.locks || !event.data) return;
      await self.navigator.locks.request(LOCK, async () => {
        const data = event.data.json();
        const { cache, value } = await consent();
        if (!valid(value, data)) return;
        const day = Number(data.tag.split(":").at(-1));
        const bit = 1 << (day - 1);
        if (((value.shownDays ?? 0) & bit) !== 0) return;
        // Conservative dedupe: failed/uncertain display is not retried.
        await cache.put(
          KEY,
          new Response(
            JSON.stringify({
              ...value,
              shownDays: (value.shownDays ?? 0) | bit,
            }),
          ),
        );
        await self.registration.showNotification("Fantasy Sumo", {
          body: BODY,
          tag: data.tag,
          data: {
            tag: data.tag,
            revision: data.revision,
            expiresAt: data.expiresAt,
          },
        });
      });
    })().catch(() => {
      /* Suppress malformed payloads/storage errors without logs. */
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      if (!self.navigator.locks) return;
      await self.navigator.locks.request(LOCK, async () => {
        const { value } = await consent();
        if (!valid(value, event.notification.data)) return;
        const target = new URL("/stable", self.location.origin).href;
        const clients = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        const existing = clients.find(
          (client) => new URL(client.url).origin === self.location.origin,
        );
        if (existing) {
          const navigated = await existing.navigate(target);
          if (navigated) await navigated.focus();
        } else await self.clients.openWindow(target);
      });
    })().catch(() => {
      /* Notification clicks never open payload-controlled URLs. */
    }),
  );
});
