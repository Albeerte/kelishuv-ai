export function invitationPath(value: string): string | null {
  const input = value.trim();
  if (!input || input.length > 2000) return null;
  if (/^[a-f0-9]{64}$/i.test(input)) return `/invite/${input.toLowerCase()}`;
  try {
    const url = new URL(input, "https://kelishuv.invalid");
    if (!["http:", "https:"].includes(url.protocol)) return null;
    const match = /^\/invite\/([a-f0-9]{64})\/?$/i.exec(url.pathname);
    return match ? `/invite/${match[1].toLowerCase()}` : null;
  } catch {
    return null;
  }
}

export function caseEntryStep(step: number, version?: number): number {
  if (version === 2) return Math.max(1, Math.min(3, step));
  return step <= 2 ? 1 : step <= 4 ? 2 : 3;
}

export function caseEntryTitle(title: string, description: string): string {
  const trimmed = title.trim();
  return trimmed.length >= 4 ? trimmed : description.trim().slice(0, 120);
}
