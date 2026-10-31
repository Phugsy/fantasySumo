import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { run } from "./pilot-session.mjs";

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), "fantasy-sumo-pilot-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const file = join(directory, "state.json");
  const now = Date.parse("2026-10-31T12:00:00Z");
  return {
    file,
    now,
    call: (command, ...args) => run(command, args, file, now),
  };
}

test("a missing, stopped, or expired session cannot claim work", (t) => {
  const { file, now, call } = fixture(t);
  assert.equal(call("status").reason, "not-started");
  assert.throws(() => call("claim", "worker"), /not-started/);
  call("start");
  assert.equal(run("status", [], file, now + 120 * 60_000).reason, "expired");
  assert.throws(
    () => run("claim", ["worker"], file, now + 120 * 60_000),
    /expired/,
  );
  call("stop");
  assert.throws(() => call("claim", "worker"), /stopped/);
});

test("only one worker across invocations can change the checkpoint", (t) => {
  const { call } = fixture(t);
  call("start", "30");
  call("claim", "first");
  assert.throws(() => call("claim", "second"), /unavailable/);
  assert.throws(() => call("release", "second"), /does not match/);
  assert.throws(() => call("start"), /still owns/);
  assert.throws(
    () => call("checkpoint", "second", '{"issue":50,"phase":"intake"}'),
    /does not match/,
  );
  call("checkpoint", "first", '{"issue":50,"phase":"review","pr":110}');
  call("release", "first");
  call("claim", "second");
  assert.equal(call("status").state.current.pr, 110);
});

test("stop and expiry revoke a worker guard but allow recording in-flight outcomes", (t) => {
  const { file, now, call } = fixture(t);
  call("start", "1");
  call("claim", "worker");
  assert.equal(call("guard", "worker").active, true);
  assert.throws(() => run("guard", ["worker"], file, now + 60_000), /expired/);
  call("stop");
  assert.throws(() => call("guard", "worker"), /stopped/);
  call("checkpoint", "worker", '{"issue":50,"phase":"verifying","runId":123}');
  call("completed", "worker", "a".repeat(40), "123");
  call("release", "worker");
  assert.equal(call("status").active, false);
});

test("ticket switching and new sessions preserve monotonic repair counts and notifications", (t) => {
  const { call } = fixture(t);
  call("start");
  call("claim", "first");
  call(
    "checkpoint",
    "first",
    '{"issue":26,"phase":"blocked","repairCycles":2,"notified":["missing-source"]}',
  );
  call("checkpoint", "first", '{"issue":50,"phase":"done"}');
  call("release", "first");
  call("start");
  call("claim", "second");
  call("checkpoint", "second", '{"issue":26,"phase":"blocked"}');
  assert.equal(call("status").state.current.repairCycles, 2);
  assert.deepEqual(call("status").state.current.notified, ["missing-source"]);
  assert.throws(
    () =>
      call(
        "checkpoint",
        "second",
        '{"issue":26,"phase":"building","repairCycles":0}',
      ),
    /Invalid checkpoint/,
  );
  assert.throws(
    () =>
      call(
        "checkpoint",
        "second",
        '{"issue":26,"phase":"building","repairCycles":3}',
      ),
    /Invalid checkpoint/,
  );
});

test("three unique deployments exhaust a session and duplicate observations do not", (t) => {
  const { call } = fixture(t);
  call("start");
  call("claim", "worker");
  for (const character of ["a", "a", "b", "c"]) {
    call("completed", "worker", character.repeat(40), "123");
  }
  assert.equal(call("status").state.releases.length, 3);
  assert.throws(() => call("guard", "worker"), /release-limit/);
  call("release", "worker");
  assert.throws(() => call("claim", "next"), /release-limit/);
});

test("invalid state, checkpoint, duration, or busy transaction fails closed", (t) => {
  const { file, call } = fixture(t);
  for (const duration of ["0", "241", "Infinity", "1.5"]) {
    assert.throws(() => call("start", duration), /duration/);
  }
  call("start");
  call("claim", "worker");
  assert.throws(
    () => call("checkpoint", "worker", '{"issue":1,"phase":"merge-anything"}'),
    /Invalid checkpoint/,
  );
  assert.throws(
    () => call("completed", "worker", "master", "123"),
    /deployed SHA/,
  );
  mkdirSync(`${file}.lock`);
  assert.throws(() => call("guard", "worker"), /EEXIST/);
  rmSync(`${file}.lock`, { recursive: true });
  writeFileSync(file, "{}");
  assert.throws(() => call("status"), /Invalid pilot state/);
  writeFileSync(file, "invalid json");
  assert.throws(() => call("start"), /Unreadable pilot state/);
});
