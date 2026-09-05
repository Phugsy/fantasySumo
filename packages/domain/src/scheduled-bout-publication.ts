const COMPLETE_SCHEDULE_SOURCE_SUFFIX = ":complete";

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
