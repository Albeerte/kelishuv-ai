import { randomUUID } from "node:crypto";
import { MediationError } from "./mediation";
import type { AppData } from "./types";
import type { AssistantRequestRecord } from "./assistant-types";

export const FREE_ASSISTANT_REQUESTS = 10;
export const ASSISTANT_REQUEST_LEASE_MS = 180000;
export function assistantUsage(
  data: AppData,
  subject: string,
  now = Date.now(),
) {
  const used = (data.assistantRequests || []).filter(
    (item) =>
      item.subject === subject &&
      (item.status === "COMPLETE" ||
        (item.status === "PENDING" &&
          now - Date.parse(item.startedAt) < ASSISTANT_REQUEST_LEASE_MS)),
  ).length;
  return {
    limit: FREE_ASSISTANT_REQUESTS,
    used,
    remaining: Math.max(0, FREE_ASSISTANT_REQUESTS - used),
  };
}
export function reserveAssistantRequest(
  data: AppData,
  subject: string,
  requestId: string,
  hash: string,
  now = Date.now(),
): AssistantRequestRecord {
  data.assistantRequests ??= [];
  const existing = data.assistantRequests.find(
    (item) => item.subject === subject && item.requestId === requestId,
  );
  if (existing) {
    if (existing.hash !== hash)
      throw new MediationError(
        409,
        "So‘rov mazmuni o‘zgargan. Yangi savol yuboring.",
      );
    if (existing.status === "COMPLETE") return existing;
    if (
      existing.status === "PENDING" &&
      now - Date.parse(existing.startedAt) < ASSISTANT_REQUEST_LEASE_MS
    )
      throw new MediationError(
        409,
        "Savolingiz ustida ishlanmoqda. Birozdan so‘ng qayta urinib ko‘ring.",
      );
    existing.status = "FAILED";
  }
  if (!assistantUsage(data, subject, now).remaining)
    throw new MediationError(429, "10 ta bepul so‘rovdan foydalandingiz.");
  const record: AssistantRequestRecord = {
    id: existing?.id || randomUUID(),
    subject,
    requestId,
    hash,
    attemptId: randomUUID(),
    status: "PENDING",
    startedAt: new Date(now).toISOString(),
  };
  if (existing) Object.assign(existing, record);
  else data.assistantRequests.push(record);
  return existing || record;
}
