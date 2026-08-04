export function normalizeUsername(raw: string): string {
  return raw.trim().toUpperCase().slice(0, 12);
}

export function isValidUsername(name: string): boolean {
  return /^[A-Z0-9_]{3,12}$/.test(name);
}
