export function toLocalBashoId(sourceBashoId: string): string {
  const compactMatch = /^(\d{4})(\d{2})$/.exec(sourceBashoId);

  if (compactMatch !== null) {
    return `${compactMatch[1]}-${compactMatch[2]}`;
  }

  return sourceBashoId;
}

export function toCompactBashoId(localBashoId: string): string {
  return localBashoId.replace("-", "");
}
