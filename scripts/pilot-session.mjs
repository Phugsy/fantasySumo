import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const phases = new Set([
  "intake",
  "building",
  "review",
  "checks",
  "approval",
  "releasing",
  "verifying",
  "blocked",
  "done",
]);
const shaPattern = /^[a-f0-9]{40}$/;

function readState(file) {
  let state;
  try {
    state = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw new Error("Unreadable pilot state; stop and inspect it.");
  }
  if (
    state?.version !== 1 ||
    typeof state.sessionId !== "string" ||
    !Number.isFinite(Date.parse(state.expiresAt)) ||
    typeof state.stopped !== "boolean" ||
    !state.items ||
    typeof state.items !== "object" ||
    Array.isArray(state.items) ||
    !Array.isArray(state.releases) ||
    state.releases.some((release) => !shaPattern.test(release.sha)) ||
    (state.worker !== null && typeof state.worker?.owner !== "string")
  ) {
    throw new Error("Invalid pilot state; stop and inspect it.");
  }
  return state;
}

function status(state, now) {
  const reason = !state
    ? "not-started"
    : state.stopped
      ? "stopped"
      : now >= Date.parse(state.expiresAt)
        ? "expired"
        : state.releases.length >= 3
          ? "release-limit"
          : "active";
  return { active: reason === "active", reason, state };
}

// The transaction lock protects local state updates; the persisted worker
// lease protects the whole agent turn. Neither is stolen after a timeout.
export function run(command, args, file, now = Date.now()) {
  if (command === "status") return status(readState(file), now);
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  const lock = `${file}.lock`;
  mkdirSync(lock);
  try {
    let state = readState(file);
    const requireActive = () => {
      const result = status(state, now);
      if (!result.active) throw new Error(`Pilot is ${result.reason}.`);
    };
    const requireOwner = () => {
      if (!args[0] || state?.worker?.owner !== args[0]) {
        throw new Error("Worker lease does not match; do not continue.");
      }
    };
    switch (command) {
      case "start": {
        const minutes = Number(args[0] ?? 120);
        if (!Number.isInteger(minutes) || minutes < 1 || minutes > 240) {
          throw new Error("Session duration must be 1–240 minutes.");
        }
        if (state?.worker) throw new Error("A worker still owns this session.");
        state = {
          version: 1,
          sessionId: randomUUID(),
          startedAt: new Date(now).toISOString(),
          expiresAt: new Date(now + minutes * 60_000).toISOString(),
          stopped: false,
          worker: null,
          current: state?.current ?? null,
          items: state?.items ?? {},
          releases: [],
        };
        break;
      }
      case "stop":
        if (!state) return status(null, now);
        state.stopped = true;
        break;
      case "claim":
        requireActive();
        if (!args[0] || state.worker) throw new Error("Worker unavailable.");
        state.worker = {
          owner: args[0],
          claimedAt: new Date(now).toISOString(),
        };
        break;
      case "guard":
        requireActive();
        requireOwner();
        return status(state, now);
      case "checkpoint": {
        requireOwner();
        const patch = JSON.parse(args[1]);
        const previous = state.items[patch.issue] ?? {};
        const next = { ...previous, ...patch };
        if (
          !Number.isSafeInteger(next.issue) ||
          next.issue < 1 ||
          !phases.has(next.phase) ||
          (next.pr !== undefined &&
            (!Number.isSafeInteger(next.pr) || next.pr < 1)) ||
          (next.headSha !== undefined && !shaPattern.test(next.headSha)) ||
          (next.runId !== undefined &&
            (!Number.isSafeInteger(next.runId) || next.runId < 1)) ||
          (next.repairCycles !== undefined &&
            (!Number.isInteger(next.repairCycles) ||
              next.repairCycles < (previous.repairCycles ?? 0) ||
              next.repairCycles > 2))
        ) {
          throw new Error("Invalid checkpoint.");
        }
        state.current = { ...next, updatedAt: new Date(now).toISOString() };
        state.items[next.issue] = state.current;
        break;
      }
      case "completed":
        requireOwner();
        if (!shaPattern.test(args[1]) || !/^[1-9]\d*$/.test(args[2] ?? "")) {
          throw new Error("Completion requires the deployed SHA and run ID.");
        }
        if (!state.releases.some((release) => release.sha === args[1])) {
          state.releases.push({ sha: args[1], runId: args[2] });
        }
        break;
      case "release":
        requireOwner();
        state.worker = null;
        break;
      default:
        throw new Error(`Unknown pilot command: ${command}`);
    }
    const temporary = `${file}.${randomUUID()}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, {
      mode: 0o600,
    });
    renameSync(temporary, file);
    return status(state, now);
  } finally {
    rmdirSync(lock);
  }
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  try {
    const common = execFileSync("git", ["rev-parse", "--git-common-dir"], {
      encoding: "utf8",
    }).trim();
    const file = join(resolve(common), "fantasy-sumo-pilot", "state.json");
    console.log(
      JSON.stringify(
        run(process.argv[2], process.argv.slice(3), file),
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
