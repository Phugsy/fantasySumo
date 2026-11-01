import { lookup } from "node:dns/promises";
import { createECDH } from "node:crypto";
import { isIP } from "node:net";
import https from "node:https";
import webPush from "web-push";
import type { PushClaim, PushSubscriptionData } from "@fantasy-sumo/db";
export type PushOutcome = "accepted" | "expired" | "failed" | "unknown";
export interface PreparedPush {
  send: (ready: PushClaim) => Promise<PushOutcome>;
}
export type PushTransport = (
  claim: PushClaim,
) => Promise<PreparedPush | undefined>;
export function validatePushSubscription(
  data: PushSubscriptionData,
  allowedHosts: readonly string[],
) {
  const url = new URL(data.endpoint);
  if (
    url.protocol !== "https:" ||
    url.port ||
    url.username ||
    url.password ||
    url.hash ||
    data.endpoint.length > 2048 ||
    !allowedHosts.includes(url.hostname) ||
    !knownHost(url.hostname)
  )
    throw new Error("invalid-push-endpoint");
  for (const [key, length] of [
    [data.keys.p256dh, 65],
    [data.keys.auth, 16],
  ] as const) {
    if (
      !/^[A-Za-z0-9_-]+$/.test(key) ||
      Buffer.from(key, "base64url").length !== length
    )
      throw new Error("invalid-push-key");
  }
  const point = Buffer.from(data.keys.p256dh, "base64url");
  // Reject malformed curve points before request construction.
  const curve = createECDH("prime256v1");
  curve.generateKeys();
  curve.computeSecret(point);
}
function knownHost(host: string) {
  return (
    host === "fcm.googleapis.com" ||
    host === "updates.push.services.mozilla.com" ||
    host.endsWith(".push.apple.com")
  );
}
export function publicPushAddress(address: string) {
  if (isIP(address) !== 4) return false;
  const [a, b, c] = address.split(".").map(Number);
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a! >= 224 ||
    (a === 100 && b! >= 64 && b! <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b! >= 16 && b! <= 31) ||
    (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113)
  );
}
function postPinned(
  url: URL,
  details: webPush.RequestDetails,
  address: string,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        hostname: url.hostname,
        port: 443,
        path: url.pathname + url.search,
        method: "POST",
        headers: details.headers,
        family: 4,
        agent: false,
        rejectUnauthorized: true,
        servername: url.hostname,
        maxHeaderSize: 8192,
        lookup: (_host, _options, callback) => callback(null, address, 4),
      },
      (response) => {
        clearTimeout(timer);
        const status = response.statusCode ?? 0;
        response.destroy();
        resolve(status);
      },
    );
    const timer = setTimeout(
      () => request.destroy(new Error("push-timeout")),
      3000,
    );
    request.setTimeout(3000, () => request.destroy(new Error("push-timeout")));
    request.on("error", () => {
      clearTimeout(timer);
      reject(new Error("push-transport-failed"));
    });
    request.end(details.body);
  });
}
export function createWebPushTransport(
  config: {
    publicKey: string;
    privateKey: string;
    subject: string;
    allowedHosts: readonly string[];
  },
  io: {
    resolve?: (host: string) => Promise<string[]>;
    post?: (
      url: URL,
      details: webPush.RequestDetails,
      address: string,
    ) => Promise<number>;
    now?: () => Date;
  } = {},
): PushTransport {
  if (
    !config.allowedHosts.length ||
    config.allowedHosts.some((h) => !knownHost(h)) ||
    !/^mailto:[^\s@]+@[^\s@]+$/.test(config.subject)
  )
    throw new Error("invalid-push-config");
  const curve = createECDH("prime256v1");
  curve.setPrivateKey(Buffer.from(config.privateKey, "base64url"));
  if (curve.getPublicKey().toString("base64url") !== config.publicKey)
    throw new Error("invalid-vapid-key-pair");
  return async (claim) => {
    try {
      validatePushSubscription(claim.subscription, config.allowedHosts);
      const url = new URL(claim.subscription.endpoint);
      let timer: ReturnType<typeof setTimeout> | undefined;
      const addresses = await Promise.race([
        (
          io.resolve ??
          (async (host) =>
            (await lookup(host, { all: true, family: 4 })).map(
              (a) => a.address,
            ))
        )(url.hostname),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("push-dns-timeout")), 3000);
        }),
      ]).finally(() => clearTimeout(timer));
      if (!addresses.length || addresses.some((a) => !publicPushAddress(a)))
        return undefined;
      let used = false;
      return {
        send: async (ready) => {
          if (
            used ||
            ready.id !== claim.id ||
            ready.revision !== claim.revision ||
            ready.subscription.endpoint !== claim.subscription.endpoint
          )
            return "failed";
          used = true;
          const ttl = Math.min(
            ready.ttl,
            Math.floor(
              (Date.parse(ready.payload.expiresAt) -
                (io.now ?? (() => new Date()))().getTime()) /
                1000,
            ),
          );
          if (ttl < 1) return "failed";
          try {
            const details = webPush.generateRequestDetails(
              ready.subscription,
              JSON.stringify(ready.payload),
              {
                TTL: ttl,
                urgency: "low",
                vapidDetails: {
                  subject: config.subject,
                  publicKey: config.publicKey,
                  privateKey: config.privateKey,
                },
              },
            );
            const status = await (io.post ?? postPinned)(
              url,
              details,
              addresses[0]!,
            );
            return status === 404 || status === 410
              ? "expired"
              : status >= 200 && status < 300
                ? "accepted"
                : status >= 400 && status < 500
                  ? "failed"
                  : "unknown";
          } catch {
            return "unknown";
          }
        },
      };
    } catch {
      return undefined;
    } // No endpoint/key/vendor error logs; no network handoff occurred.
  };
}
