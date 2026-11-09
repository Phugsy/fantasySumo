import { pathToFileURL } from "node:url";

function deploymentOrigin(value) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    !/^fantasy-sumo-[a-z0-9-]+-phuggo\.vercel\.app$/.test(url.hostname) ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw new Error(
      "API timings require a plain HTTPS Vercel deployment origin.",
    );
  return url.origin;
}
function summary(samples) {
  const sorted = samples.map((sample) => sample.ttfbMs).sort((a, b) => a - b);
  const server = samples
    .map((sample) => sample.appMs)
    .filter((n) => n !== null)
    .sort((a, b) => a - b);
  return {
    samples,
    medianMs: sorted[Math.floor(sorted.length / 2)],
    minMs: sorted[0],
    maxMs: sorted.at(-1),
    appMedianMs: server.length ? server[Math.floor(server.length / 2)] : null,
  };
}
export async function compareApiTimings({
  beforeUrl,
  afterUrl,
  token,
  fetchImpl = fetch,
  rounds = 3,
  now = () => performance.now(),
}) {
  const before = deploymentOrigin(beforeUrl),
    after = deploymentOrigin(afterUrl);
  if (!token)
    throw new Error(
      "Deployment smoke authentication is required for API timings.",
    );
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > 10)
    throw new Error("Invalid timing sample count.");
  async function request(origin, path) {
    const started = now();
    const response = await fetchImpl(new URL(path, origin), {
      headers: { "x-vercel-protection-bypass": token },
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
    const headersAt = now();
    if (response.status !== 200)
      throw new Error(
        `API timing request ${path} returned HTTP ${response.status}.`,
      );
    let body;
    try {
      body = await response.json();
    } catch {
      throw new Error(`API timing request ${path} returned invalid JSON.`);
    }
    const match = response.headers
      .get("server-timing")
      ?.match(/(?:^|,)\s*app;dur=([\d.]+)/);
    return {
      body,
      timing: {
        ttfbMs: Math.round((headersAt - started) * 10) / 10,
        totalMs: Math.round((now() - started) * 10) / 10,
        appMs: match ? Number(match[1]) : null,
      },
    };
  }
  const oldBasho = (await request(before, "/api/basho/current")).body;
  const newBasho = (await request(after, "/api/basho/current")).body;
  if (
    typeof oldBasho.id !== "string" ||
    oldBasho.id.length > 120 ||
    oldBasho.id !== newBasho.id
  )
    throw new Error(
      "API timing comparison requires the same current basho on both deployments.",
    );
  const basho = encodeURIComponent(oldBasho.id);
  const paths = [
    "/api/health",
    "/api/basho/current",
    `/api/basho/${basho}/rikishi`,
    `/api/basho/${basho}/leaderboard`,
  ];
  const measurements = paths.map((path) => ({ path, before: [], after: [] }));
  // Warm each endpoint once. Alternate versions in each round against the same DB.
  for (let round = 0; round <= rounds; round++) {
    for (const row of measurements) {
      for (const [label, origin] of [
        ["before", before],
        ["after", after],
      ]) {
        const { timing } = await request(origin, row.path);
        if (round > 0) row[label].push(timing);
      }
    }
  }
  return {
    beforeUrl: before,
    afterUrl: after,
    bashoId: oldBasho.id,
    rounds,
    warmupRounds: 1,
    measuredAt: new Date().toISOString(),
    note: "Paired warm TTFB from one CI runner; includes transport to Vercel. appMs is handler time when available. No application session or fixture mutation.",
    endpoints: measurements.map((row) => {
      const oldSummary = summary(row.before),
        newSummary = summary(row.after);
      return {
        path: row.path,
        before: oldSummary,
        after: newSummary,
        changePercent:
          oldSummary.medianMs > 0
            ? Math.round(
                (newSummary.medianMs / oldSummary.medianMs - 1) * 1000,
              ) / 10
            : null,
      };
    }),
  };
}
if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  try {
    const result = await compareApiTimings({
      beforeUrl: process.argv[2],
      afterUrl: process.argv[3],
      token: process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
