import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { AppData, CaseRecord } from "./types";
import type {
  Agreement,
  AgreementParty,
  AgreementTerms,
  AgreementValidation,
  AgreementVersion,
  AuditEvent,
  CaseExecution,
  SharedCaseInput,
} from "./kelishuv-types";
import { currentMediator, MediationError } from "./mediation";
import { LEGAL_SOURCES } from "./legal";

export {
  AI_CONSENT_VERSION,
  SIGNING_CONSENT_VERSION,
  SIGNER_ROLES,
  tashkentDate,
  obligationPaid,
  executionSummary,
} from "./kelishuv-utils";
import { tashkentDate } from "./kelishuv-utils";
export const digest = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");

export function caseParticipants(
  data: AppData,
  record: CaseRecord,
): AgreementParty[] {
  const mediator =
    record.mediatorId && currentMediator(data, record.mediatorId);
  const participants = [
    { userId: record.userId, role: "FIRST_PARTY" as const },
    { userId: record.mediation?.respondentId, role: "SECOND_PARTY" as const },
    { userId: mediator && mediator.userId, role: "MEDIATOR" as const },
  ];
  return participants
    .filter((participant) => participant.userId)
    .map((participant) => {
      const user = data.users.find((item) => item.id === participant.userId);
      const consent =
        participant.role === "FIRST_PARTY"
          ? record.mediation?.initiatorConsent
          : record.mediation?.respondentConsent;
      return {
        userId: participant.userId as string,
        role: participant.role,
        fullName: user?.fullName || "Taraf",
        phone:
          participant.role === "MEDIATOR"
            ? user?.phone || ""
            : consent?.phone || user?.phone || "",
        address: `${record.region}, ${record.city || ""}`,
        identityDetails:
          "Hisob egasi taqdim etgan ma’lumot. Shaxsni mediator tekshiradi.",
      };
    });
}

export function sharedCaseInput(record: CaseRecord): SharedCaseInput {
  const positions = record.positions || [];
  return {
    type: record.type,
    description: record.description,
    claimAmount: record.claimAmount,
    statements: [
      {
        userId: record.userId,
        role: "FIRST_PARTY" as const,
        text:
          positions.find((position) => position.userId === record.userId)
            ?.sharedStatement || record.description,
      },
      {
        userId: record.mediation?.respondentId || "",
        role: "SECOND_PARTY" as const,
        text:
          positions.find(
            (position) => position.userId === record.mediation?.respondentId,
          )?.sharedStatement ||
          record.mediation?.respondentStatement ||
          "",
      },
    ].filter((statement) => statement.userId),
    evidence: record.documents
      .filter(
        (document) => document.visibility === "PARTIES" && document.extraction,
      )
      .map((document) => ({
        id: document.id,
        name: document.name,
        text: document.extraction!.text.slice(0, 18000),
      })),
    sources: LEGAL_SOURCES.filter((source) =>
      source.types.includes(record.type),
    ).slice(0, 20),
  };
}

export function reviewInputHash(record: CaseRecord) {
  const input = sharedCaseInput(record);
  return digest(
    JSON.stringify({
      input,
      consent: (record.positions || []).map((position) => ({
        userId: position.userId,
        consent: position.consent,
      })),
      documents: record.documents
        .filter((document) => document.visibility === "PARTIES")
        .map((document) => ({ id: document.id, at: document.uploadedAt })),
    }),
  );
}

export function privateCaseInput(record: CaseRecord, userId: string) {
  return {
    type: record.type,
    statement:
      record.positions?.find((position) => position.userId === userId)
        ?.confidentialStatement || "",
    evidence: record.documents
      .filter(
        (document) => document.uploadedBy === userId && document.extraction,
      )
      .map((document) => ({
        id: document.id,
        name: document.name,
        text: document.extraction!.text,
      })),
  };
}

export function privateReviewInputHash(record: CaseRecord, userId: string) {
  return digest(
    JSON.stringify({
      input: privateCaseInput(record, userId),
      position: record.positions?.find(
        (position) => position.userId === userId,
      ),
    }),
  );
}

export function agreementContentHash(version: AgreementVersion) {
  return digest(
    JSON.stringify({
      kind: version.kind,
      terms: version.terms,
      participants: version.participants,
      boxes: version.boxes,
      version: version.number,
      id: version.id,
    }),
  );
}

export function currentVersion(agreement: Agreement) {
  const version = agreement.versions.find(
    (item) => item.id === agreement.currentVersionId,
  );
  if (!version)
    throw new MediationError(409, "Kelishuvning joriy nusxasi topilmadi.");
  return version;
}

export function publicAgreement(agreement: Agreement): Agreement {
  const clone = structuredClone(agreement);
  for (const version of clone.versions) {
    version.pdfStorageKey = "";
    version.docxStorageKey = "";
    for (const signature of version.signatures) signature.pngStorageKey = "";
  }
  return clone;
}

export function audit(
  data: AppData,
  actorId: string,
  action: string,
  context: {
    caseId?: string;
    agreementId?: string;
    versionId?: string;
    contentHash?: string;
    artifactHash?: string;
    details?: AuditEvent["details"];
  } = {},
) {
  data.audit ??= [];
  const payload = {
    id: randomUUID(),
    actorId,
    action,
    at: new Date().toISOString(),
    caseId: context.caseId,
    agreementId: context.agreementId,
    versionId: context.versionId,
    contentHash: context.contentHash,
    artifactHash: context.artifactHash,
    previousHash: data.audit.at(-1)?.hash,
    details: context.details || {},
  };
  const event: AuditEvent = {
    ...payload,
    hash: digest(JSON.stringify(payload)),
  };
  data.audit.push(event);
}

export function verifyAudit(events: AuditEvent[]) {
  return events.every((event, index) => {
    const { hash, ...payload } = event;
    return (
      hash === digest(JSON.stringify(payload)) &&
      event.previousHash === events[index - 1]?.hash
    );
  });
}

export function validateAgreementTerms(
  terms: AgreementTerms,
  kind: "PROCEDURE" | "SETTLEMENT",
  participants: AgreementParty[],
): AgreementValidation[] {
  const validation: AgreementValidation[] = [];
  if (
    participants.length !== 3 ||
    new Set(participants.map((participant) => participant.userId)).size !== 3
  )
    validation.push({
      field: "participants",
      severity: "REQUIRED",
      message: "Ikkala taraf va alohida mediator ko‘rsatilishi kerak.",
    });
  if (!terms.subject.trim() || !terms.agreedTerms.trim())
    validation.push({
      field: "subject",
      severity: "REQUIRED",
      message: "Nizo predmeti va kelishilgan shartlarni kiriting.",
    });
  if (
    kind === "SETTLEMENT" &&
    terms.paymentSchedule.reduce((sum, payment) => sum + payment.amount, 0) !==
      terms.totalAmount
  )
    validation.push({
      field: "paymentSchedule",
      severity: "REQUIRED",
      message: "To‘lovlar yig‘indisi kelishuv summasiga teng bo‘lishi kerak.",
    });
  if (
    kind === "SETTLEMENT" &&
    !terms.paymentSchedule.length &&
    !terms.obligations.length
  )
    validation.push({
      field: "obligations",
      severity: "REQUIRED",
      message: "Kamida bitta to‘lov yoki bajariladigan majburiyat kiriting.",
    });
  const partyIds = participants
    .filter((participant) => participant.role !== "MEDIATOR")
    .map((participant) => participant.userId);
  for (const payment of terms.paymentSchedule) {
    if (
      payment.payerId === payment.payeeId ||
      !partyIds.includes(payment.payerId) ||
      !partyIds.includes(payment.payeeId)
    )
      validation.push({
        field: "paymentSchedule",
        severity: "REQUIRED",
        message:
          "To‘lovchi va oluvchi ikki alohida nizo tarafi bo‘lishi kerak.",
      });
  }
  for (const obligation of terms.obligations) {
    if (
      obligation.assigneeId === obligation.beneficiaryId ||
      !partyIds.includes(obligation.assigneeId) ||
      !partyIds.includes(obligation.beneficiaryId)
    )
      validation.push({
        field: "obligations",
        severity: "REQUIRED",
        message: "Majburiyat bajaruvchisi va qabul qiluvchisini belgilang.",
      });
  }
  validation.push({
    field: "identity",
    severity: "REVIEW",
    message:
      "Shaxs, vakolat va rekvizitlarni mediator asl hujjatlar bilan tekshiradi.",
  });
  validation.push({
    field: "law",
    severity: "REVIEW",
    message:
      "Shartlarning amaldagi qonun va uchinchi shaxslar huquqlariga mosligini mediator tekshiradi.",
  });
  return validation;
}

export function createExecution(
  record: CaseRecord,
  agreement: Agreement,
  version: AgreementVersion,
): CaseExecution {
  return {
    agreementId: agreement.id,
    versionId: version.id,
    createdAt: new Date().toISOString(),
    reports: [],
    reminderKeys: [],
    obligations: [
      ...version.terms.paymentSchedule.map((payment) => ({
        id: payment.id,
        agreementId: agreement.id,
        versionId: version.id,
        caseId: record.id,
        type: "PAYMENT" as const,
        title: payment.description || "Kelishilgan to‘lov",
        assigneeId: payment.payerId,
        beneficiaryId: payment.payeeId,
        amount: payment.amount,
        dueDate: payment.dueDate,
        status: "PENDING" as const,
      })),
      ...version.terms.obligations.map((obligation) => ({
        id: obligation.id,
        agreementId: agreement.id,
        versionId: version.id,
        caseId: record.id,
        type: "ACTION" as const,
        title: obligation.title,
        assigneeId: obligation.assigneeId,
        beneficiaryId: obligation.beneficiaryId,
        amount: 0,
        dueDate: obligation.dueDate,
        status: "PENDING" as const,
      })),
    ],
  };
}

export function createReminderNotifications(data: AppData, now = new Date()) {
  const today = tashkentDate(now);
  const upcomingDate = new Date(`${today}T00:00:00+05:00`);
  upcomingDate.setUTCDate(
    upcomingDate.getUTCDate() + (data.settings?.reminderDays ?? 3),
  );
  const threshold = tashkentDate(upcomingDate);
  let created = 0;
  for (const record of data.cases) {
    const execution = record.execution;
    if (!execution) continue;
    for (const obligation of execution.obligations) {
      if (obligation.status === "COMPLETED" || obligation.dueDate > threshold)
        continue;
      const overdue = obligation.dueDate < today;
      const key = `${obligation.id}:${overdue ? "OVERDUE" : "UPCOMING"}:${today}`;
      if (execution.reminderKeys.includes(key)) continue;
      execution.reminderKeys.push(key);
      for (const userId of [obligation.assigneeId, obligation.beneficiaryId]) {
        if (!data.users.some((user) => user.id === userId && user.isActive))
          continue;
        data.notifications.unshift({
          id: randomUUID(),
          userId,
          title: overdue
            ? "Majburiyat muddati o‘tgan"
            : "Majburiyat muddati yaqinlashmoqda",
          body: `${record.number} · ${obligation.dueDate}`,
          href: `/dashboard/cases/${record.id}/workbench?section=execution`,
          read: false,
          createdAt: now.toISOString(),
        });
        created += 1;
      }
    }
  }
  return created;
}
