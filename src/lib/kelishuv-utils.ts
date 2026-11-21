import type { SignerRole, CaseExecution } from "./kelishuv-types";
export const AI_CONSENT_VERSION = "kelishuv-ai-processing-2026-11-v1";
export const SIGNING_CONSENT_VERSION = "kelishuv-handwritten-2026-11-v1";
export const SIGNER_ROLES: SignerRole[] = [
  "FIRST_PARTY",
  "SECOND_PARTY",
  "MEDIATOR",
];

export function tashkentDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function obligationPaid(execution: CaseExecution, obligationId: string) {
  return execution.reports
    .filter(
      (report) =>
        report.obligationId === obligationId && report.status === "CONFIRMED",
    )
    .reduce((sum, report) => sum + report.amount, 0);
}

export function executionSummary(execution: CaseExecution, now = new Date()) {
  const total = execution.obligations.reduce(
    (sum, obligation) => sum + obligation.amount,
    0,
  );
  const paid = execution.reports
    .filter((report) => report.status === "CONFIRMED")
    .reduce((sum, report) => sum + report.amount, 0);
  const pending = execution.obligations.filter(
    (obligation) => obligation.status !== "COMPLETED",
  );
  const today = tashkentDate(now);
  const next =
    pending.toSorted((a, b) => a.dueDate.localeCompare(b.dueDate))[0]
      ?.dueDate || null;
  const progress = execution.obligations.reduce(
    (sum, obligation) =>
      sum +
      (obligation.type === "PAYMENT"
        ? Math.min(
            1,
            obligationPaid(execution, obligation.id) /
              Math.max(obligation.amount, 1),
          )
        : Number(obligation.status === "COMPLETED")),
    0,
  );
  return {
    total,
    paid,
    remaining: Math.max(0, total - paid),
    nextDate: next,
    overdue: pending.filter((obligation) => obligation.dueDate < today).length,
    progress: execution.obligations.length
      ? Math.round((progress / execution.obligations.length) * 100)
      : 100,
  };
}
