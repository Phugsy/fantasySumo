const deploymentUrl = process.argv[2];

if (deploymentUrl === undefined) {
  throw new Error("Usage: node scripts/smoke-deployment.mjs <deployment-url>");
}

const baseUrl = new URL(deploymentUrl);
const protectionBypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

if (!protectionBypassSecret) {
  throw new Error(
    "VERCEL_AUTOMATION_BYPASS_SECRET is required for deployment smoke tests",
  );
}

const attempts = 6;
const retryDelayMs = 5_000;
const requestTimeoutMs = 15_000;
const requestHeaders = {
  "x-vercel-protection-bypass": protectionBypassSecret,
};

async function waitFor(checkName, check) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await check();
      console.log(`${checkName} smoke test passed.`);
      return;
    } catch (error) {
      lastError = error;
      console.warn(
        `${checkName} smoke test attempt ${attempt}/${attempts} failed: ${error.message}`,
      );

      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }
  }

  throw lastError;
}

await waitFor("Web", async () => {
  const response = await fetch(baseUrl, {
    headers: requestHeaders,
    redirect: "follow",
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
  if (!response.ok) {
    throw new Error(`GET / returned HTTP ${response.status}`);
  }
});

await waitFor("API health", async () => {
  const response = await fetch(new URL("/api/health", baseUrl), {
    headers: requestHeaders,
    redirect: "follow",
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
  if (!response.ok) {
    throw new Error(`GET /api/health returned HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (payload.ok !== true || payload.service !== "fantasy-sumo-api") {
    throw new Error("GET /api/health returned an unexpected payload");
  }
});

await waitFor("API database", async () => {
  const response = await fetch(new URL("/api/basho/current", baseUrl), {
    headers: requestHeaders,
    redirect: "follow",
    signal: AbortSignal.timeout(requestTimeoutMs),
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(`GET /api/basho/current returned HTTP ${response.status}`);
  }

  const payload = await response.json();

  if (response.status === 404) {
    if (payload.error !== "not-found") {
      throw new Error("GET /api/basho/current returned an unexpected payload");
    }
    return;
  }

  if (typeof payload.id !== "string" || typeof payload.name !== "string") {
    throw new Error("GET /api/basho/current returned an unexpected payload");
  }
});
