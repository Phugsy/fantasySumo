const deploymentUrl = process.argv[2];

if (deploymentUrl === undefined) {
  throw new Error("Usage: node scripts/smoke-deployment.mjs <deployment-url>");
}

const baseUrl = new URL(deploymentUrl);
const attempts = 6;
const retryDelayMs = 5_000;
const requestTimeoutMs = 15_000;

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
    redirect: "follow",
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
  if (!response.ok) {
    throw new Error(`GET / returned HTTP ${response.status}`);
  }
});

await waitFor("API health", async () => {
  const response = await fetch(new URL("/api/health", baseUrl), {
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
