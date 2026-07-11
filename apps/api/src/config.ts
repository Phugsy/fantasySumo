const DEFAULT_TEAM_SIZE = 2;
const AUTH_MODES = ["local", "neon"] as const;

export type AuthMode = (typeof AUTH_MODES)[number];

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

export function getAuthMode(): AuthMode {
  const configuredMode = process.env.AUTH_MODE?.trim();

  if (AUTH_MODES.some((mode) => mode === configuredMode)) {
    return configuredMode as AuthMode;
  }

  const nodeEnv = process.env.NODE_ENV?.trim();

  return nodeEnv === "development" || nodeEnv === "test" ? "local" : "neon";
}

export function getNeonAuthJwksUrl(): string | undefined {
  const url = process.env.NEON_AUTH_JWKS_URL?.trim();

  return url === undefined || url.length === 0 ? undefined : url;
}

export function getNeonAuthIssuer(): string | undefined {
  const issuer = process.env.NEON_AUTH_ISSUER?.trim();

  return issuer === undefined || issuer.length === 0 ? undefined : issuer;
}

export function getNeonAuthAudience(): string | undefined {
  const audience = process.env.NEON_AUTH_AUDIENCE?.trim();

  return audience === undefined || audience.length === 0 ? undefined : audience;
}
