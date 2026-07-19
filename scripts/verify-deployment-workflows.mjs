import { readFileSync } from "node:fs";

const previewPath = ".github/workflows/deploy-preview.yml";
const productionPath = ".github/workflows/deploy-production.yml";
const preview = readFileSync(previewPath, "utf8");
const production = readFileSync(productionPath, "utf8");

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
  [preview, previewPath, "preview", "fantasy-sumo-preview-database"],
  [
    production,
    productionPath,
    "production",
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
    "run post-deployment smoke tests",
    /node scripts\/smoke-deployment\.mjs/,
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
    `Apply ${environment} database migrations`,
    `Deploy tested ${environment} build`,
  );
  requireOrder(
    deployJob,
    file,
    `Deploy tested ${environment} build`,
    `Smoke-test ${environment} deployment`,
  );
}

requireText(
  preview,
  previewPath,
  "reject secret-bearing preview jobs for fork pull requests",
  /head\.repo\.full_name == github\.repository/,
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

console.log("Deployment workflow safety contract passed.");
