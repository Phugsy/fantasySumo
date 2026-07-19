import { readFileSync } from "node:fs";

const previewPath = ".github/workflows/deploy-preview.yml";
const productionPath = ".github/workflows/deploy-production.yml";
const smokePath = "scripts/smoke-deployment.mjs";
const vercelPath = "vercel.json";
const preview = readFileSync(previewPath, "utf8");
const production = readFileSync(productionPath, "utf8");
const smoke = readFileSync(smokePath, "utf8");
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

for (const [source, file, environment, concurrencyGroup] of [
  [preview, previewPath, "Preview", "fantasy-sumo-preview-database"],
  [
    production,
    productionPath,
    "Production",
    "fantasy-sumo-production-database",
  ],
]) {
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
    "finish validation before deployment",
    /needs:\s*\n\s+- resolve\s*\n\s+- validate/,
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

if (vercelConfig.git?.deploymentEnabled !== false) {
  throw new Error(
    `${vercelPath} must disable automatic Git deployments so they cannot bypass migration-gated GitHub Actions.`,
  );
}

console.log("Deployment workflow safety contract passed.");
