import { useEffect, useRef, useState } from "react";
import { fetchPushPreferences, type PushPreferences } from "../api";
import {
  enablePush,
  disableAllPush,
  pushSupport,
  readPushConsent,
  suspendPush,
  type DeviceConsent,
} from "../push-browser";
import * as styles from "./PushSettings.css";

export function PushSettings({
  ownerId,
  sessionBusy,
}: {
  ownerId: string;
  sessionBusy: boolean;
}) {
  const [preferences, setPreferences] = useState<PushPreferences | null>(null);
  const [device, setDevice] = useState<DeviceConsent>();
  const [busy, setBusy] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const requestId = useRef(0);
  useEffect(() => {
    let current = true;
    const refresh = () => {
      if (pending.current) return;
      const request = ++requestId.current;
      return Promise.all([
        fetchPushPreferences(),
        readPushConsent().then(
          (device) => ({ device, ready: true }),
          () => ({ device: undefined, ready: false }),
        ),
      ])
        .then(([p, d]) => {
          if (current && requestId.current === request && !pending.current) {
            setPreferences(p);
            setDevice(d.device);
            setStorageReady(d.ready);
          }
        })
        .catch(() => {
          if (current && requestId.current === request)
            setError("Unable to check reminders. Try again.");
        });
    };
    void refresh();
    window.addEventListener("focus", refresh);
    return () => {
      current = false;
      window.removeEventListener("focus", refresh);
    };
  }, [ownerId]);
  const supported = storageReady
    ? pushSupport()
    : "Reminder storage is unavailable in this browser. You can still disable server reminders.";
  const active =
    preferences?.subscribed &&
    device?.enabled &&
    device.ownerId === ownerId &&
    preferences.ownerId === ownerId &&
    preferences.revision === device.revision &&
    preferences.deviceId === device.deviceId;
  const available = preferences?.available && preferences.ownerId === ownerId;
  async function change(action: "enable" | "device" | "all") {
    if (pending.current || sessionBusy) return;
    pending.current = true;
    requestId.current++;
    setBusy(true);
    setError(null);
    try {
      if (action === "enable") await enablePush(ownerId, preferences!);
      else if (action === "all") await disableAllPush(ownerId);
      else await suspendPush(ownerId);
      setPreferences(await fetchPushPreferences());
      setDevice(await readPushConsent());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update reminders.");
    } finally {
      setDevice(await readPushConsent().catch(() => undefined));
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      className={styles.root}
      aria-labelledby="push-title"
      aria-busy={busy}
    >
      <h2 className={styles.heading} id="push-title">
        Pick Window reminders
      </h2>
      <p className={styles.text}>
        An optional reminder when your joker Pick Window opens. One device, at
        most one per day. Delivery is not guaranteed; check My Stable for the
        deadline.
      </p>
      <p className={styles.text} role="status">
        {preferences === null
          ? "Checking reminder availability…"
          : !available
            ? "Reminders are not available for this account yet."
            : active
              ? "Reminders are on for this device."
              : preferences.subscribed
                ? preferences.deviceId === device?.deviceId
                  ? "This device is muted. Turn it off or enable it again."
                  : "Reminders are on for another device. Enabling here replaces it."
                : "Reminders are off."}
      </p>
      {available && (
        <>
          <p className={styles.text}>
            Quiet hours: 22:00–08:00 (
            {Intl.DateTimeFormat().resolvedOptions().timeZone}). Reminders
            during quiet hours are skipped.
          </p>
          {supported && <p className={styles.text}>{supported}</p>}
          <div className={styles.controls}>
            <button
              className={styles.button}
              type="button"
              disabled={busy || sessionBusy || !!supported || !!active}
              onClick={() => void change("enable")}
            >
              Enable on this device
            </button>
          </div>
        </>
      )}
      {device?.ownerId === ownerId && (
        <button
          className={styles.button}
          type="button"
          disabled={busy || sessionBusy}
          onClick={() => void change("device")}
        >
          Turn off on this device
        </button>
      )}
      {preferences?.subscribed && (
        <button
          className={styles.button}
          type="button"
          disabled={busy || sessionBusy}
          onClick={() => void change("all")}
        >
          Disable reminders everywhere
        </button>
      )}
      {error && (
        <p role="alert" className={styles.text}>
          {error}
        </p>
      )}
    </section>
  );
}
