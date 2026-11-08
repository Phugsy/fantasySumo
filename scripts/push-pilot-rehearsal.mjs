// Offline policy rehearsal only. No endpoints, keys, network or durable storage.
export const PILOT_LIMITS = Object.freeze({
  testers: 20,
  perDay: 20,
  total: 300,
});

function instant(value) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error("Invalid rehearsal time.");
  return parsed;
}

function localHour(timezone, now) {
  if (typeof timezone !== "string" || !timezone) {
    throw new Error("Choose a valid IANA timezone.");
  }
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now),
  );
}

export function createPilotRehearsal({ bashoId, invitedUserIds, clock }) {
  const invited = new Set(invitedUserIds);
  if (
    !bashoId ||
    invited.size !== invitedUserIds.length ||
    invited.size > PILOT_LIMITS.testers ||
    [...invited].some((id) => typeof id !== "string" || !id)
  ) {
    throw new Error("Use one basho and at most 20 distinct synthetic testers.");
  }
  const consents = new Map();
  const decisions = new Map();
  let stopped = false;
  let revision = 0;
  const now = () => instant(clock());
  const attempts = () => [...decisions.values()].filter((item) => item.attempt);

  return {
    consent(userId, { deviceId, timezone, expiresAt = null }) {
      if (!invited.has(userId) || typeof deviceId !== "string" || !deviceId) {
        throw new Error("Only invited synthetic testers can opt in.");
      }
      localHour(timezone, now());
      if (expiresAt !== null && instant(expiresAt) <= now()) {
        throw new Error("Subscription is expired.");
      }
      if (
        [...consents].some(
          ([owner, consent]) =>
            owner !== userId && consent.deviceId === deviceId,
        )
      ) {
        throw new Error("Detach the previous account before switching.");
      }
      consents.set(userId, {
        deviceId,
        timezone,
        expiresAt,
        revision: ++revision,
      });
    },
    disable(userId) {
      consents.delete(userId);
    },
    detachDevice(deviceId) {
      for (const [userId, consent] of consents) {
        if (consent.deviceId === deviceId) consents.delete(userId);
      }
    },
    stop() {
      stopped = true;
    },
    // loadWindow represents a fresh authoritative server read, never browser input.
    // outcomeByUser is a synthetic acknowledgement; there is no send adapter.
    async publish(publication, loadWindow, outcomeByUser = {}) {
      if (
        stopped ||
        publication.bashoId !== bashoId ||
        !Number.isInteger(publication.day) ||
        publication.day < 1 ||
        publication.day > 15 ||
        publication.committed !== true ||
        publication.validated !== true
      ) {
        return this.report();
      }
      for (const userId of invited) {
        const key = JSON.stringify([
          bashoId,
          publication.day,
          userId,
          "opening",
        ]);
        if (decisions.has(key)) continue;
        // Record the opening once, including skips. A reimport must not defer
        // a quiet-hours reminder or create another opportunity after opt-in.
        const decision = {
          day: publication.day,
          status: "evaluating",
          attempt: false,
        };
        decisions.set(key, decision);
        const skip = (reason) =>
          Object.assign(decision, { status: "skipped", reason });
        const consent = consents.get(userId);
        if (!consent) {
          skip("not-opted-in");
          continue;
        }
        let window;
        try {
          window = await loadWindow(userId, publication);
        } catch {
          skip("unavailable");
          continue;
        }
        const at = now();
        if (stopped || consents.get(userId)?.revision !== consent.revision) {
          skip("consent-changed-or-stopped");
          continue;
        }
        if (consent.expiresAt !== null && instant(consent.expiresAt) <= at) {
          consents.delete(userId);
          skip("expired");
          continue;
        }
        const hour = localHour(consent.timezone, at);
        if (hour >= 22 || hour < 8) {
          skip("quiet-hours");
          continue;
        }
        const deadline = Date.parse(window?.deadline);
        const ttl = Math.floor((deadline - at) / 1000);
        if (
          window?.bashoId !== bashoId ||
          window.day !== publication.day ||
          window.userId !== userId ||
          window.status !== "open" ||
          window.hasSelection !== false ||
          window.eligibleOwnBout !== true ||
          !Number.isInteger(window.remaining) ||
          window.remaining < 1 ||
          window.remaining > 3 ||
          !Number.isFinite(ttl) ||
          ttl < 1
        ) {
          skip("ineligible-or-late");
          continue;
        }
        const prior = attempts();
        if (
          prior.length >= PILOT_LIMITS.total ||
          prior.filter((item) => item.day === publication.day).length >=
            PILOT_LIMITS.perDay
        ) {
          skip("cap");
          continue;
        }
        // Synchronous claim before the acknowledgement yields: two overlapping
        // calls in this one process cannot double-attempt. This is NOT a DB lock.
        Object.assign(decision, {
          attempt: true,
          status: "unknown",
          ttl,
          payload: {
            title: "Fantasy Sumo",
            body: "Today's Pick Window is open. Check the app for your deadline.",
            tag: `pick-window:${bashoId}:${publication.day}`,
            url: "/",
            expiresAt: window.deadline,
          },
        });
        const outcome = await Promise.resolve(
          outcomeByUser[userId] ?? "accepted",
        );
        decision.status = ["accepted", "failed", "expired", "unknown"].includes(
          outcome,
        )
          ? outcome
          : "unknown";
        if (
          outcome === "expired" &&
          consents.get(userId)?.revision === consent.revision
        ) {
          consents.delete(userId);
        }
      }
      return this.report();
    },
    report() {
      const items = structuredClone([...decisions.values()]);
      return {
        mode: "offline-stub-only",
        stopped,
        optedIn: consents.size,
        attempts: items.filter((item) => item.attempt).length,
        decisions: items,
      };
    },
  };
}
