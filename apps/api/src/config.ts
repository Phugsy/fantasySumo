const DEFAULT_TEAM_SIZE = 2;

export function getTeamSize(): number {
  // TODO - This should come from a DB config table, possibly allowing for different team sizes configurable for each event, defined by the users running the fantasy basho. For now, we'll just use an environment variable with a default fallback.
  const configuredTeamSize = Number(process.env.TEAM_SIZE);

  if (Number.isInteger(configuredTeamSize) && configuredTeamSize > 0) {
    return configuredTeamSize;
  }

  return DEFAULT_TEAM_SIZE;
}

export function getDemoAdminToken(): string | undefined {
  const token = process.env.DEMO_ADMIN_TOKEN?.trim();

  return token === undefined || token.length === 0 ? undefined : token;
}

export function getAdminImportToken(): string | undefined {
  const token = process.env.ADMIN_IMPORT_TOKEN?.trim();

  return token === undefined || token.length === 0 ? undefined : token;
}

export function allowsUnprotectedAdminImports(): boolean {
  const nodeEnv = process.env.NODE_ENV?.trim();

  return nodeEnv === "development" || nodeEnv === "test";
}
