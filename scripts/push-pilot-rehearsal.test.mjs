import assert from "node:assert/strict";
import test from "node:test";
import { createPilotRehearsal, PILOT_LIMITS } from "./push-pilot-rehearsal.mjs";

const bashoId = "synthetic-basho";
const publication = (day = 1) => ({
  bashoId,
  day,
  committed: true,
  validated: true,
});
const deadline = (day = 1) =>
  `2026-05-${String(day + 9).padStart(2, "0")}T03:00:00.000Z`;
const eligible = (userId, event) => ({
  bashoId,
  day: event.day,
  userId,
  status: "open",
  deadline: deadline(event.day),
  remaining: 3,
  hasSelection: false,
  eligibleOwnBout: true,
});

function fixture(count = 1) {
  let time = "2026-05-10T02:00:00.000Z";
  const ids = Array.from({ length: count }, (_, index) => `tester-${index}`);
  const pilot = createPilotRehearsal({
    bashoId,
    invitedUserIds: ids,
    clock: () => time,
  });
  const consent = (id = ids[0], options = {}) =>
    pilot.consent(id, {
      deviceId: `device-${id}`,
      timezone: "Asia/Tokyo",
      ...options,
    });
  return {
    pilot,
    ids,
    consent,
    setTime: (value) => {
      time = value;
    },
  };
}

test("bounds invitations, owned devices, replacement, opt-out and account switching", async () => {
  assert.throws(() => fixture(21));
  const { pilot, ids, consent } = fixture(2);
  assert.throws(() => consent("outsider"));
  assert.throws(() => consent(ids[0], { timezone: "" }));
  assert.throws(() => consent(ids[0], { timezone: "Not/A_Zone" }));
  consent();
  assert.throws(() => consent(ids[1], { deviceId: `device-${ids[0]}` }));
  consent(ids[0], { deviceId: "replacement" });
  assert.equal(pilot.report().optedIn, 1);
  pilot.detachDevice("replacement");
  consent(ids[1], { deviceId: "replacement" });
  pilot.disable(ids[1]);
  await pilot.publish(publication(), eligible);
  assert.equal(pilot.report().attempts, 0);
});

test("20/day and 300/basho count attempts, including failures and unknown outcomes", async () => {
  const { pilot, ids, consent, setTime } = fixture(20);
  ids.forEach((id) => consent(id));
  for (let day = 1; day <= 15; day += 1) {
    setTime(deadline(day).replace("T03:", "T02:"));
    await Promise.all([
      pilot.publish(publication(day), eligible, {
        [ids[0]]: "unknown",
        [ids[1]]: "failed",
      }),
      pilot.publish(publication(day), eligible),
    ]);
    const report = pilot.report();
    assert.equal(
      report.decisions.filter((item) => item.day === day && item.attempt)
        .length,
      20,
    );
    assert.equal(report.attempts, day * 20);
  }
  assert.equal(pilot.report().attempts, PILOT_LIMITS.total);
  await pilot.publish(publication(16), eligible);
  assert.equal(pilot.report().attempts, 300);
});

test("day-one publication must be committed and validated; late/missing facts skip", async () => {
  const { pilot, consent } = fixture();
  consent();
  await pilot.publish({ ...publication(), committed: false }, eligible);
  await pilot.publish({ ...publication(), validated: false }, eligible);
  await pilot.publish({ ...publication(), bashoId: "other" }, eligible);
  assert.equal(pilot.report().decisions.length, 0);
  await pilot.publish(publication(), async () => {
    throw new Error("missing card");
  });
  assert.equal(pilot.report().attempts, 0);
  await pilot.publish(publication(), eligible);
  assert.equal(pilot.report().attempts, 0);
});

test("cutoff is strict and subsecond TTL is skipped", async () => {
  for (const time of [
    deadline(),
    "2026-05-10T03:00:00.001Z",
    "2026-05-10T02:59:59.500Z",
  ]) {
    const { pilot, consent, setTime } = fixture();
    consent();
    setTime(time);
    await pilot.publish(publication(), eligible);
    assert.equal(pilot.report().attempts, 0);
  }
  const { pilot, consent, setTime } = fixture();
  consent();
  setTime("2026-05-10T02:59:59.000Z");
  await pilot.publish(publication(), eligible);
  assert.equal(pilot.report().decisions[0].ttl, 1);
});

test("authoritative eligibility rejects closed windows, spent tokens, selection and wrong ownership", async () => {
  for (const patch of [
    { status: "closed" },
    { status: "unavailable" },
    { remaining: 0 },
    { hasSelection: true },
    { eligibleOwnBout: false },
    { userId: "other" },
    { day: 2 },
    { bashoId: "other" },
    { deadline: "invalid" },
  ]) {
    const { pilot, consent } = fixture();
    consent();
    await pilot.publish(publication(), (id, event) => ({
      ...eligible(id, event),
      ...patch,
    }));
    assert.equal(pilot.report().attempts, 0);
  }
});

test("quiet hours use the selected timezone, including DST, and are never deferred", async () => {
  const { pilot, consent, setTime } = fixture();
  consent(undefined, { timezone: "Europe/London" });
  await pilot.publish(publication(), eligible); // 03:00 BST, skip.
  setTime("2026-05-10T08:00:00.000Z");
  await pilot.publish(publication(), eligible); // Reimport cannot defer it.
  assert.equal(pilot.report().decisions[0].reason, "quiet-hours");
  assert.equal(pilot.report().attempts, 0);
  for (const [at, expected] of [
    ["2026-05-09T21:00:00.000Z", 0],
    ["2026-05-09T07:00:00.000Z", 1],
  ]) {
    const f = fixture();
    f.consent(undefined, { timezone: "Europe/London" });
    f.setTime(at);
    await f.pilot.publish(publication(), eligible);
    assert.equal(f.pilot.report().attempts, expected); // 22:00 and 08:00 BST.
  }
});

test("expiry, revocation, replacement and stop are rechecked after loading fresh facts", async () => {
  for (const change of [
    (f) => f.pilot.disable(f.ids[0]),
    (f) => f.consent(undefined, { deviceId: "changed-device" }),
    (f) => f.pilot.stop(),
    (f) => f.setTime("2026-05-10T02:30:00.000Z"),
  ]) {
    const f = fixture();
    f.consent(undefined, { expiresAt: "2026-05-10T02:30:00.000Z" });
    await f.pilot.publish(publication(), async (id, event) => {
      change(f);
      return eligible(id, event);
    });
    assert.equal(f.pilot.report().attempts, 0);
  }
});

test("expired acknowledgements remove only that subscription; uncertain sends never retry", async () => {
  const f = fixture(3);
  f.ids.forEach((id) => f.consent(id));
  const outcomes = {
    [f.ids[0]]: "expired",
    [f.ids[1]]: "unknown",
    [f.ids[2]]: "failed",
  };
  await f.pilot.publish(publication(), eligible, outcomes);
  await f.pilot.publish(publication(), eligible);
  assert.equal(f.pilot.report().attempts, 3);
  assert.equal(f.pilot.report().optedIn, 2);
  assert.deepEqual(
    f.pilot.report().decisions.map((item) => item.status),
    ["expired", "unknown", "failed"],
  );
});

test("payload is generic and report copies cannot mutate the ledger", async () => {
  const f = fixture();
  f.consent();
  await f.pilot.publish(publication(), eligible);
  const report = f.pilot.report();
  assert.equal(report.mode, "offline-stub-only");
  assert.equal(report.decisions[0].ttl, 3600);
  assert.equal(report.decisions[0].payload.url, "/");
  assert.ok(!JSON.stringify(report).includes(f.ids[0]));
  report.decisions[0].attempt = false;
  assert.equal(f.pilot.report().attempts, 1);
});
