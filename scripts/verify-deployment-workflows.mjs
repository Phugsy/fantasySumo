import { readFileSync } from "node:fs";

const previewPath = ".github/workflows/deploy-preview.yml";
const playtestPath = ".github/workflows/deploy-playtest.yml";
const productionPath = ".github/workflows/deploy-production.yml";
const qualityPath = ".github/workflows/quality.yml";
const smokePath = "scripts/smoke-deployment.mjs";
const packagePath = "package.json";
const tsconfigPath = "tsconfig.json";
const vercelPath = "vercel.json";
const preview = readFileSync(previewPath, "utf8");
const playtest = readFileSync(playtestPath, "utf8");
const production = readFileSync(productionPath, "utf8");
const quality = readFileSync(qualityPath, "utf8");
const smoke = readFileSync(smokePath, "utf8");
const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
const tsconfig = JSON.parse(readFileSync(tsconfigPath, "utf8"));
const vercelConfig = JSON.parse(readFileSync(vercelPath, "utf8"));

function requireText(source, file, description, pattern) {
  if (!pattern.test(source)) {
    throw new Error(`${file} must ${description}.`);
  }
}

function forbidText(source, file, description, pattern) {
  if (pattern.test(source)) {
    throw new Error(`${file} must not ${description}.`);
  }
}

function requireOccurrenceCount(source, file, description, text, count) {
  const actualCount = source.split(text).length - 1;
  if (actualCount !== count) {
    throw new Error(`${file} must ${description}.`);
  }
}

function requireOrder(source, file, before, after) {
  const beforeIndex = source.indexOf(before);
  const afterIndex = source.indexOf(after);

  if (beforeIndex === -1 || afterIndex === -1 || beforeIndex >= afterIndex) {
    throw new Error(`${file} must run ${before} before ${after}.`);
  }
}

function getJob(source, file, jobName) {
  const marker = `\n  ${jobName}:\n`;
  const start = source.indexOf(marker);
  if (start === -1) {
    throw new Error(`${file} must define the ${jobName} job.`);
  }

  const contentStart = start + 1;
  const afterHeader = start + marker.length;
  const remaining = source.slice(afterHeader);
  const nextJob = remaining.search(/\n {2}[a-zA-Z0-9_-]+:\n/);
  return nextJob === -1
    ? source.slice(contentStart)
    : source.slice(contentStart, afterHeader + nextJob);
}

const playwrightVersion = packageJson.devDependencies?.["@playwright/test"];
if (!/^\d+\.\d+\.\d+$/.test(playwrightVersion ?? "")) {
  throw new Error(
    `${packagePath} must pin @playwright/test to an exact semantic version.`,
  );
}

const playwrightImage = `mcr.microsoft.com/playwright:v${playwrightVersion}-noble`;

function requireContainerizedE2E(source, file, resolvedSha) {
  const e2eJob = getJob(source, file, "e2e");
  const imagePattern = resolvedSha
    ? /image: \$\{\{ needs\.resolve\.outputs\.playwright_image \}\}/
    : new RegExp(`image: ${playwrightImage.replaceAll(".", "\\.")}`);

  requireText(
    e2eJob,
    file,
    resolvedSha
      ? "use the Playwright image resolved from the selected commit"
      : `use the matching pinned Playwright image ${playwrightImage}`,
    imagePattern,
  );
  requireText(
    e2eJob,
    file,
    "share host memory with Chromium",
    /options: --ipc=host/,
  );
  requireText(
    e2eJob,
    file,
    "run browser E2E without downloading system dependencies",
    /run: pnpm e2e/,
  );
  forbidText(
    source,
    file,
    "install Playwright browsers or operating-system dependencies at runtime",
    /playwright install/,
  );

  if (resolvedSha) {
    requireText(
      e2eJob,
      file,
      "run E2E against the immutable resolved SHA",
      /ref: \$\{\{ needs\.resolve\.outputs\.sha \}\}/,
    );
  }
}

requireContainerizedE2E(quality, qualityPath, false);
requireText(
  getJob(quality, qualityPath, "e2e"),
  qualityPath,
  "finish main validation before browser E2E",
  /needs: validate/,
);

for (const [source, file, environment, concurrencyGroup] of [
  [preview, previewPath, "Preview", "fantasy-sumo-preview-database"],
  [playtest, playtestPath, "Playtest", "fantasy-sumo-playtest-database"],
  [
    production,
    productionPath,
    "Production",
    "fantasy-sumo-production-database",
  ],
]) {
  requireContainerizedE2E(source, file, true);
  requireText(
    getJob(source, file, "resolve"),
    file,
    "derive an exact Playwright image from the selected commit lockfile",
    /playwright_version=\$\(awk .* pnpm-lock\.yaml\)[\s\S]*\[\[ ! "\$playwright_version" =~ \^\[0-9\]\+\\\.\[0-9\]\+\\\.\[0-9\]\+\$ \]\][\s\S]*playwright_image=mcr\.microsoft\.com\/playwright:v\$\{playwright_version\}-noble/,
  );
  requireText(
    getJob(source, file, "e2e"),
    file,
    "finish main validation before browser E2E",
    /needs:\s*\n\s+- resolve\s*\n\s+- validate/,
  );
  const deployJob = getJob(source, file, "deploy");
  const deployJobPreamble = deployJob.slice(
    0,
    deployJob.indexOf("\n    steps:"),
  );

  requireText(
    deployJob,
    file,
    `use the protected ${environment} environment`,
    new RegExp(`name: ${environment}`),
  );
  requireText(
    deployJob,
    file,
    "serialize database migrations and deployments",
    new RegExp(`group: ${concurrencyGroup}`),
  );
  requireText(
    deployJob,
    file,
    "finish validation and browser E2E before deployment",
    /needs:\s*\n\s+- resolve\s*\n\s+- validate\s*\n\s+- e2e/,
  );
  requireText(
    deployJob,
    file,
    "avoid interrupting an in-flight migration or deployment",
    /cancel-in-progress: false/,
  );
  requireText(
    deployJob,
    file,
    "receive DATABASE_URL from an environment secret",
    /DATABASE_URL: \$\{\{ secrets\.DATABASE_URL \}\}/,
  );
  requireText(deployJob, file, "pin the Vercel CLI", /vercel@56\.3\.2/);
  requireText(
    deployJob,
    file,
    "type-check the Vercel function entrypoint",
    /Type-check Vercel function entrypoint\s*\n\s*run: pnpm exec tsc -p tsconfig\.json/,
  );
  forbidText(
    deployJobPreamble,
    file,
    "expose VERCEL_TOKEN to every deploy-job step",
    /VERCEL_TOKEN/,
  );
  requireText(
    deployJob,
    file,
    "deploy the immutable resolved SHA",
    /ref: \$\{\{ needs\.resolve\.outputs\.sha \}\}/,
  );
  requireText(
    deployJob,
    file,
    "run the hosted migration under production database rules",
    /DATABASE_URL: \$\{\{ secrets\.DATABASE_URL \}\}\s*\n\s*NODE_ENV: production/,
  );
  requireText(
    deployJob,
    file,
    "run post-deployment smoke tests",
    /smoke-deployment\.mjs/,
  );
  requireText(
    deployJob,
    file,
    "load smoke tooling from the workflow revision",
    /ref: \$\{\{ github\.workflow_sha \}\}/,
  );
  requireText(
    deployJob,
    file,
    "run smoke tooling independently of the selected deployment SHA",
    /node \.workflow-tools\/scripts\/smoke-deployment\.mjs/,
  );
  requireText(
    deployJob,
    file,
    "provide the Vercel protection bypass secret only to deployment smoke tests",
    /Smoke-test [^\n]+ deployment[\s\S]*?VERCEL_AUTOMATION_BYPASS_SECRET: \$\{\{ secrets\.VERCEL_AUTOMATION_BYPASS_SECRET \}\}[\s\S]*?smoke-deployment\.mjs/,
  );
  requireOccurrenceCount(
    deployJob,
    file,
    "expose the Vercel protection bypass secret exactly once",
    "secrets.VERCEL_AUTOMATION_BYPASS_SECRET",
    1,
  );
  requireText(
    deployJob,
    file,
    "publish an observable workflow summary",
    /GITHUB_STEP_SUMMARY/,
  );
  requireOrder(
    deployJob,
    file,
    `Build prepared ${environment.toLowerCase()} deployment`,
    "Type-check Vercel function entrypoint",
  );
  requireOrder(
    deployJob,
    file,
    "Type-check Vercel function entrypoint",
    `Apply ${environment.toLowerCase()} database migrations`,
  );
  requireOrder(
    deployJob,
    file,
    `Apply ${environment.toLowerCase()} database migrations`,
    `Deploy tested ${environment.toLowerCase()} build`,
  );
  requireOrder(
    deployJob,
    file,
    `Deploy tested ${environment.toLowerCase()} build`,
    `Smoke-test ${environment.toLowerCase()} deployment`,
  );
}

requireText(
  preview,
  previewPath,
  "reject secret-bearing preview jobs for fork pull requests",
  /head\.repo\.full_name == github\.repository/,
);
requireText(
  preview,
  previewPath,
  "reject a stale pull request head before migration and deployment",
  /gh api "repos\/\$GITHUB_REPOSITORY\/pulls\/\$PR_NUMBER" --jq \.head\.sha/,
);
requireText(
  playtest,
  playtestPath,
  "be manually dispatched rather than deploy on repository events",
  /on:\s*\n\s*workflow_dispatch:/,
);
forbidText(
  playtest,
  playtestPath,
  "deploy automatically for pull requests, pushes, or releases",
  /\n\s+(pull_request|push|release):/,
);
requireText(
  playtest,
  playtestPath,
  "require a full commit SHA for playtest deployments",
  /\^\[0-9a-fA-F\]\{40\}\$/,
);
requireText(
  playtest,
  playtestPath,
  "restrict playtests to commits from master",
  /merge-base --is-ancestor.*origin\/master/,
);
const playtestDeployJob = getJob(playtest, playtestPath, "deploy");
requireText(
  playtest,
  playtestPath,
  "grant only read access to Actions metadata used for stale-run checks",
  /permissions:\s*\n\s*actions: read\s*\n\s*contents: read/,
);
requireText(
  playtestDeployJob,
  playtestPath,
  "build the client in deterministic demo mode",
  /Build prepared playtest deployment[\s\S]*?VITE_BASHO_MODE: demo[\s\S]*?vercel@56\.3\.2 build/,
);
requireText(
  playtestDeployJob,
  playtestPath,
  "make demo reset an explicit manual choice",
  /Reset deterministic demo for a new round[\s\S]*?if: inputs\.reset_demo[\s\S]*?pnpm db:seed:demo/,
);
const playtestResetStep = playtestDeployJob.match(
  /- name: Reset deterministic demo for a new round[\s\S]*?(?=\n\s+- name:)/,
)?.[0];
if (playtestResetStep === undefined) {
  throw new Error(
    `${playtestPath} must define the deterministic demo reset step.`,
  );
}
requireOrder(
  playtestResetStep,
  playtestPath,
  "actions/workflows/deploy-playtest.yml/runs?event=workflow_dispatch&per_page=100",
  "pnpm db:seed:demo",
);
requireOrder(
  playtestDeployJob,
  playtestPath,
  "Require latest playtest dispatch before database changes",
  "Apply playtest database migrations",
);
requireOrder(
  playtestDeployJob,
  playtestPath,
  "Apply playtest database migrations",
  "Reset deterministic demo for a new round",
);
requireOrder(
  playtestDeployJob,
  playtestPath,
  "Reset deterministic demo for a new round",
  "Require latest playtest dispatch before deployment",
);
requireOrder(
  playtestDeployJob,
  playtestPath,
  "Require latest playtest dispatch before deployment",
  "Deploy tested playtest build",
);
requireOccurrenceCount(
  playtestDeployJob,
  playtestPath,
  "reject stale dispatches before migration, immediately before reset, and before deployment",
  "actions/workflows/deploy-playtest.yml/runs?event=workflow_dispatch&per_page=100",
  3,
);
requireOccurrenceCount(
  playtestDeployJob,
  playtestPath,
  "compare every stale-run check with the current run number",
  'latest_run_number" != "$GITHUB_RUN_NUMBER',
  3,
);
requireText(
  playtestDeployJob,
  playtestPath,
  "smoke-test the flagged deterministic demo",
  /SMOKE_BASHO_MODE: demo/,
);
requireText(
  playtestDeployJob,
  playtestPath,
  "record the playtest round in deployment metadata",
  /--meta playtestRound="\$PLAYTEST_ROUND"/,
);
forbidText(
  playtestDeployJob,
  playtestPath,
  "publish the playtest through a production deployment",
  /vercel@56\.3\.2 deploy[^\n]*--prod/,
);
requireText(
  production,
  productionPath,
  "support manually approved releases",
  /workflow_dispatch:/,
);
requireText(
  production,
  productionPath,
  "support published GitHub Releases",
  /release:/,
);
const productionResolveJob = getJob(production, productionPath, "resolve");
const productionDeployJob = getJob(production, productionPath, "deploy");
requireText(
  productionResolveJob,
  productionPath,
  "exclude prereleases from the production release path",
  /if: github\.event_name == 'workflow_dispatch' \|\| github\.event\.release\.prerelease == false/,
);
requireText(
  productionDeployJob,
  productionPath,
  "reject stale automatic release runs without blocking manual rollback dispatches",
  /Require latest published production release\s*\n\s*if: github\.event_name == 'release'[\s\S]*?github\.event\.release\.id[\s\S]*?releases\?per_page=100[\s\S]*?prerelease == false[\s\S]*?max_by\(\.published_at\)/,
);
requireOrder(
  productionDeployJob,
  productionPath,
  "Require latest published production release",
  "Apply production database migrations",
);
requireText(
  production,
  productionPath,
  "require a full commit SHA for manual production releases",
  /\^\[0-9a-fA-F\]\{40\}\$/,
);
requireText(
  production,
  productionPath,
  "restrict releases to commits from master",
  /merge-base --is-ancestor.*origin\/master/,
);
requireText(
  smoke,
  smokePath,
  "exercise a database-backed API route",
  /\/api\/basho\/current/,
);
requireText(
  smoke,
  smokePath,
  "send the Vercel automation protection bypass header",
  /"x-vercel-protection-bypass": protectionBypassSecret/,
);
requireText(
  smoke,
  smokePath,
  "support asserting the flagged deterministic demo for playtests",
  /SMOKE_BASHO_MODE[\s\S]*searchParams\.set\("mode", "demo"\)[\s\S]*payload\.isDemo !== true/,
);

if (vercelConfig.git?.deploymentEnabled !== false) {
  throw new Error(
    `${vercelPath} must disable automatic Git deployments so they cannot bypass migration-gated GitHub Actions.`,
  );
}

if (
  tsconfig.extends !== "./tsconfig.base.json" ||
  !tsconfig.compilerOptions?.lib?.includes("ES2022") ||
  !tsconfig.compilerOptions?.typeRoots?.includes(
    "./apps/api/node_modules/@types",
  ) ||
  !tsconfig.compilerOptions?.types?.includes("node") ||
  !tsconfig.include?.includes("api/**/*.ts")
) {
  throw new Error(
    `${tsconfigPath} must apply the shared ES2022 and Node.js TypeScript configuration to the Vercel function entrypoint.`,
  );
}

console.log("Deployment workflow safety contract passed.");
