const DEFAULT_TEAM_SIZE = 2;

export function getTeamSize(): number {
  // TODO - This should come from a DB config table, possibly allowing for different team sizes configurable for each event, defined by the users running the fantasy basho. For now, we'll just use an environment variable with a default fallback.
  const configuredTeamSize = Number(process.env.TEAM_SIZE);

  if (Number.isInteger(configuredTeamSize) && configuredTeamSize > 0) {
    return configuredTeamSize;
  }

  return DEFAULT_TEAM_SIZE;
}
