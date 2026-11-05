export const PUSH_LIMITS = Object.freeze({
  testers: 20,
  daily: 20,
  total: 300,
});
export function pushQuietHours(timezone: string, now: string): boolean {
  if (!timezone) throw new Error("timezone-required");
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date(now)),
  );
  return hour >= 22 || hour < 8;
}
export function pushBashoEnd(endDate: string): string {
  const end = new Date(`${endDate}T15:00:00.000Z`); // next midnight in Japan
  if (!Number.isFinite(end.getTime())) throw new Error("invalid-end-date");
  return end.toISOString();
}
export function pushPayload(bashoId: string, day: number, deadline: string) {
  return {
    title: "Fantasy Sumo",
    body: "Today's Pick Window is open. Check the app for your deadline.",
    tag: `pick-window:${bashoId}:${day}`,
    expiresAt: deadline,
    url: "/stable",
  };
}
