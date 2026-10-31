export function parseBanzukeImportArgs(args: readonly string[]) {
  let source: "jsa" | "sumo-api" = "jsa";
  let bashoId: string | undefined;
  let dryRun = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--") continue;
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--source") {
      const value = args[++index];
      if (value !== "jsa" && value !== "sumo-api")
        throw new Error("--source must be jsa or sumo-api.");
      source = value;
    } else if (arg === "--basho") {
      bashoId = args[++index];
      if (!bashoId || !/^\d{4}-(01|03|05|07|09|11)$/.test(bashoId)) {
        throw new Error("--basho must name a tournament as YYYY-MM.");
      }
    } else {
      throw new Error(`Unknown banzuke import argument: ${arg}`);
    }
  }
  if (source === "sumo-api" && bashoId === undefined) {
    throw new Error("Sumo API backup requires --basho YYYY-MM.");
  }
  if (source === "jsa" && bashoId !== undefined) {
    throw new Error(
      "--basho is supported only with --source sumo-api; JSA discovers its current tournament.",
    );
  }
  return { source, bashoId, dryRun };
}
