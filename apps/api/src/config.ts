const DEFAULT_TEAM_SIZE = 2;

export function getTeamSize(): number {
  const configuredTeamSize = Number(process.env.TEAM_SIZE);

  if (Number.isInteger(configuredTeamSize) && configuredTeamSize > 0) {
    return configuredTeamSize;
  }

  return DEFAULT_TEAM_SIZE;
}
