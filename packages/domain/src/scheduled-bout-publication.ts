const COMPLETE_SCHEDULE_SOURCE_SUFFIX = ":complete";
export const SUMO_API_PRE_BOUT_SOURCE = "sumo-api-schedule:pre-bout";

export function isPreBoutScheduleSource(source: string): boolean {
  return source === SUMO_API_PRE_BOUT_SOURCE;
}

export function toCompleteScheduledBoutPublicationSource(
  source: string,
): string {
  return isCompleteScheduledBoutPublicationSource(source)
    ? source
    : `${source}${COMPLETE_SCHEDULE_SOURCE_SUFFIX}`;
}

export function isCompleteScheduledBoutPublicationSource(
  source: string,
): boolean {
  return source.endsWith(COMPLETE_SCHEDULE_SOURCE_SUFFIX);
}
