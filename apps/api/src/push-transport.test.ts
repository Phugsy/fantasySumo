import { createECDH, randomBytes } from "node:crypto";
import https from "node:https";
import { EventEmitter } from "node:events";
import type { ClientRequest } from "node:http";
import { describe, it, expect, vi } from "vitest";
import webPush from "web-push";
import {
  createWebPushTransport,
  publicPushAddress,
  validatePushSubscription,
} from "./push-transport.js";
import type { PushClaim } from "@fantasy-sumo/db";
const vapid = webPush.generateVAPIDKeys();
const curve = createECDH("prime256v1");
curve.generateKeys();
const claim: PushClaim = {
  id: "c",
  bashoId: "b",
  day: 1,
  ownerId: "synthetic",
  revision: "r",
  ttl: 3600,
  subscription: {
    endpoint: "https://fcm.googleapis.com/wp/synthetic",
    expirationTime: null,
    keys: {
      p256dh: curve.getPublicKey().toString("base64url"),
      auth: randomBytes(16).toString("base64url"),
    },
    timezone: "Asia/Tokyo",
  },
  payload: {
    title: "Fantasy Sumo",
    body: "synthetic-message",
    tag: "pick-window:b:1",
    url: "/stable",
    expiresAt: "2026-05-10T03:00:00.000Z",
  },
};
const config = {
  ...vapid,
  subject: "mailto:pilot@example.test",
  allowedHosts: ["fcm.googleapis.com"],
};
const now = () => new Date("2026-05-10T02:00:00.000Z");
function sender(...args: Parameters<typeof createWebPushTransport>) {
  const prepare = createWebPushTransport(...args);
  return async (c: PushClaim) => {
    const prepared = await prepare(c);
    return prepared ? prepared.send(c) : "failed";
  };
}
describe("bounded Web Push transport (all IO stubbed)", () => {
  it("uses certificate-verified pinned TLS and an absolute request timeout without real IO", async () => {
    vi.useFakeTimers();
    let respond = true;
    const request = vi.spyOn(https, "request").mockImplementation((...args) => {
      const options = args[0] as https.RequestOptions;
      expect(options.hostname).toBe("fcm.googleapis.com");
      expect(options.servername).toBe("fcm.googleapis.com");
      expect(options.rejectUnauthorized).toBe(true);
      expect(options.family).toBe(4);
      expect(options.agent).toBe(false);
      const lookedUp = vi.fn();
      options.lookup!("fcm.googleapis.com", { family: 4 }, lookedUp);
      expect(lookedUp).toHaveBeenCalledWith(null, "8.8.8.8", 4);
      const callback = args[1] as unknown as (response: {
        statusCode: number;
        destroy: () => void;
      }) => void;
      const emitter = new EventEmitter();
      const fake = Object.assign(emitter, {
        setTimeout: () => fake,
        destroy: () => {
          emitter.emit("error", new Error("synthetic timeout"));
          return fake;
        },
        end: () => {
          if (respond)
            queueMicrotask(() =>
              callback({ statusCode: 201, destroy: () => undefined }),
            );
          return fake;
        },
      });
      return fake as unknown as ClientRequest;
    });
    try {
      const send = sender(config, { resolve: async () => ["8.8.8.8"], now });
      const accepted = send(claim);
      await vi.advanceTimersByTimeAsync(0);
      expect(await accepted).toBe("accepted");
      respond = false;
      const timedOut = send(claim);
      await vi.advanceTimersByTimeAsync(3000);
      expect(await timedOut).toBe("unknown");
      expect(request).toHaveBeenCalledTimes(2);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.restoreAllMocks();
      vi.useRealTimers();
    }
  });
  it("permits only one send from a prepared request", async () => {
    const post = vi.fn(async () => 201);
    const prepared = await createWebPushTransport(config, {
      resolve: async () => ["8.8.8.8"],
      post,
      now,
    })(claim);
    expect(await prepared!.send(claim)).toBe("accepted");
    expect(await prepared!.send(claim)).toBe("failed");
    expect(post).toHaveBeenCalledTimes(1);
  });
  it("encrypts/signs through the library and pins one public address with bounded TTL", async () => {
    const post = vi.fn(async (_url, details, address) => {
      expect(address).toBe("8.8.8.8");
      expect(details.headers.TTL).toBe(3600);
      expect(details.body.toString()).not.toContain("synthetic-message");
      return 201;
    });
    const send = sender(config, {
      resolve: async () => ["8.8.8.8"],
      post,
      now,
    });
    expect(await send(claim)).toBe("accepted");
    expect(post).toHaveBeenCalledTimes(1);
  });
  it("rejects arbitrary destinations, credentials, ports and malformed encryption keys", () => {
    for (const endpoint of [
      "http://fcm.googleapis.com/wp/id",
      "https://localhost/id",
      "https://fcm.googleapis.com.evil.test/id",
      "https://fcm.googleapis.com:444/id",
      "https://user:pass@fcm.googleapis.com/id",
      "https://fcm.googleapis.com/id#fragment",
    ])
      expect(() =>
        validatePushSubscription(
          { ...claim.subscription, endpoint },
          config.allowedHosts,
        ),
      ).toThrow();
    expect(() =>
      validatePushSubscription(
        {
          ...claim.subscription,
          keys: { ...claim.subscription.keys, p256dh: "A".repeat(87) },
        },
        config.allowedHosts,
      ),
    ).toThrow();
    expect(() =>
      createWebPushTransport({ ...config, allowedHosts: ["evil.test"] }),
    ).toThrow();
  });
  it("blocks local/private/link-local/mixed DNS and never follows redirects or retries", async () => {
    for (const address of [
      "127.0.0.1",
      "10.1.1.1",
      "172.16.0.1",
      "192.168.0.1",
      "169.254.169.254",
      "100.100.100.200",
      "198.18.1.1",
      "0.0.0.0",
      "224.0.0.1",
      "::1",
      "::ffff:127.0.0.1",
    ])
      expect(publicPushAddress(address)).toBe(false);
    const post = vi.fn(async () => 201);
    expect(
      await sender(config, {
        resolve: async () => ["8.8.8.8", "127.0.0.1"],
        post,
        now,
      })(claim),
    ).toBe("failed");
    expect(post).not.toHaveBeenCalled();
    const redirect = vi.fn(async () => 302);
    expect(
      await sender(config, {
        resolve: async () => ["8.8.8.8"],
        post: redirect,
        now,
      })(claim),
    ).toBe("unknown");
    expect(redirect).toHaveBeenCalledTimes(1);
  });
  it("rechecks cutoff after DNS and classifies expired, failed and uncertain acknowledgements", async () => {
    const post = vi.fn(async () => 201);
    expect(
      await sender(config, {
        resolve: async () => ["8.8.8.8"],
        post,
        now: () => new Date(claim.payload.expiresAt),
      })(claim),
    ).toBe("failed");
    expect(post).not.toHaveBeenCalled();
    for (const [status, outcome] of [
      [410, "expired"],
      [404, "expired"],
      [400, "failed"],
      [503, "unknown"],
    ] as const)
      expect(
        await sender(config, {
          resolve: async () => ["8.8.8.8"],
          post: async () => status,
          now,
        })(claim),
      ).toBe(outcome);
    expect(
      await sender(config, {
        resolve: async () => ["8.8.8.8"],
        post: async () => {
          throw new Error("private vendor response");
        },
        now,
      })(claim),
    ).toBe("unknown");
  });
});
