import { test } from "node:test";
import assert from "node:assert/strict";
import { compareApiTimings } from "./compare-api-timings.mjs";
const beforeUrl = "https://fantasy-sumo-uat-phuggo.vercel.app";
const afterUrl = "https://fantasy-sumo-test-phuggo.vercel.app";
test("pairs warm requests to the same basho and never exports credentials or response bodies", async () => {
  const calls = [];
  let time = 0;
  const report = await compareApiTimings({
    beforeUrl,
    afterUrl,
    token: "test-only-secret",
    rounds: 2,
    now: () => ++time,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(
        JSON.stringify({ id: "2026-07", privateMarker: "not-in-the-report" }),
        {
          headers:
            url.origin === afterUrl ? { "server-timing": "app;dur=12.3" } : {},
        },
      );
    },
  });
  assert.equal(report.endpoints.length, 4);
  assert.ok(
    report.endpoints.every(
      (entry) =>
        entry.before.samples.length === 2 && entry.after.appMedianMs === 12.3,
    ),
  );
  assert.ok(
    calls.every(
      ({ options }) =>
        options.redirect === "error" &&
        options.headers["x-vercel-protection-bypass"] === "test-only-secret",
    ),
  );
  assert.ok(!JSON.stringify(report).includes("test-only-secret"));
  assert.ok(!JSON.stringify(report).includes("not-in-the-report"));
});
test("rejects secret-bearing or external targets before sending any request", async () => {
  for (const url of [
    "https://example.com",
    "https://unrelated.vercel.app",
    "http://test.vercel.app",
    "https://user:pass@test.vercel.app",
    "https://test.vercel.app/?token=value",
    "https://test.vercel.app/api",
  ]) {
    await assert.rejects(
      compareApiTimings({
        beforeUrl,
        afterUrl: url,
        token: "test",
        fetchImpl: () => {
          throw new Error("must not fetch");
        },
      }),
      /plain HTTPS Vercel/,
    );
  }
});
test("does not follow redirects and refuses different fixtures", async () => {
  await assert.rejects(
    compareApiTimings({
      beforeUrl,
      afterUrl,
      token: "test",
      fetchImpl: async () => new Response(null, { status: 302 }),
    }),
    /HTTP 302/,
  );
  await assert.rejects(
    compareApiTimings({
      beforeUrl,
      afterUrl,
      token: "test",
      fetchImpl: async (url) =>
        Response.json({ id: url.origin === beforeUrl ? "2026-07" : "2026-11" }),
    }),
    /same current basho/,
  );
});
