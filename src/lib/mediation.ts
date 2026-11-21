import type {
  AppData,
  CaseDocument,
  CaseRecord,
  Mediator,
  User,
} from "./types";

export const CONSENT_VERSION = "referral-2026-11-20-v1";
export const CONSENT_TEXT =
  "Nizoni mediatsiyaga yo‘naltirishga roziman. Ikkala taraf rozilik bildirgach, shahrimizdagi tasdiqlangan mediatorlarga anonim so‘rov ko‘rsatiladi. Qabul qilgan mediatorga telefonim, bayonim va yuklagan hujjatlarim ochiladi. U men bilan bog‘lanishi mumkin. Mediatorni o‘zaro tanlash va yozma tartib-taomil kelishuvi keyin alohida rasmiylashtiriladi.";
export const COMMISSION_PERCENT = 15;

export class MediationError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function normalizeCity(value: string = "") {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[’‘`ʻʼ]/g, "'")
    .replace(/\b(shahri|shahar)\b/g, "")
    .replace(/\btumani\b/g, "tuman")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!/^998\d{9}$/.test(digits))
    throw new MediationError(
      400,
      "Telefonni +998 va 9 ta raqam bilan kiriting.",
    );
  return `+${digits}`;
}

export function isParty(record: CaseRecord, userId: string) {
  return record.userId === userId || record.mediation?.respondentId === userId;
}

export function setUserPhone(data: AppData, user: User, value: string) {
  const phone = value ? normalizePhone(value) : "";
  if (
    phone &&
    data.users.some(
      (item) =>
        item.id !== user.id &&
        item.phone.replace(/\D/g, "") === phone.replace(/\D/g, ""),
    )
  )
    throw new MediationError(
      409,
      "Ushbu telefon raqami boshqa hisobda ishlatilmoqda.",
    );
  if (user.phone !== phone) delete user.phoneVerifiedAt;
  user.phone = phone;
}

export function hasBothConsents(record: CaseRecord) {
  const flow = record.mediation;
  return Boolean(
    flow?.respondentId &&
    flow.respondentId !== record.userId &&
    flow.initiatorConsent?.userId === record.userId &&
    flow.respondentConsent?.userId === flow.respondentId &&
    flow.initiatorConsent.textVersion === CONSENT_VERSION &&
    flow.respondentConsent.textVersion === CONSENT_VERSION,
  );
}

export function hasMutualAppointment(record: CaseRecord) {
  const flow = record.mediation;
  return Boolean(
    record.mediatorId &&
    hasBothConsents(record) &&
    [record.userId, flow?.respondentId].every((userId) =>
      flow?.mediatorApprovals.some(
        (item) =>
          item.userId === userId && item.mediatorId === record.mediatorId,
      ),
    ),
  );
}

export function currentMediator(data: AppData, id: string) {
  const mediator = data.mediators.find((item) => item.id === id);
  if (!mediator) return undefined;
  const owner = data.users.find((item) => item.id === mediator.userId);
  if (owner ? !owner.isActive || owner.role !== "MEDIATOR" : !mediator.demo)
    return undefined;
  return mediator;
}

export function queueEligible(
  data: AppData,
  record: CaseRecord,
  mediator: Mediator,
) {
  return Boolean(
    currentMediator(data, mediator.id) &&
    !record.mediatorId &&
    !isParty(record, mediator.userId) &&
    record.status === "OPEN_FOR_MEDIATORS" &&
    record.chosenSolution === "MEDIATION" &&
    hasBothConsents(record) &&
    record.mediation?.publishedAt &&
    !record.analysis.criminal &&
    record.routingFacts?.thirdPartyRights !== "YES" &&
    mediator.specializations.includes(record.type) &&
    record.region === mediator.region &&
    normalizeCity(record.city) &&
    normalizeCity(record.city) === normalizeCity(mediator.city),
  );
}

export function canReadCase(data: AppData, record: CaseRecord, user: User) {
  if (
    !data.users.some(
      (item) => item.id === user.id && item.isActive && item.role === user.role,
    )
  )
    return false;
  if (isParty(record, user.id) || user.role === "ADMIN") return true;
  const mediator =
    record.mediatorId && currentMediator(data, record.mediatorId);
  return Boolean(
    user.role === "MEDIATOR" &&
    mediator &&
    mediator.userId === user.id &&
    (!record.mediation || hasBothConsents(record)),
  );
}

export function canReadDocument(
  data: AppData,
  record: CaseRecord,
  document: CaseDocument,
  user: User,
) {
  if (!canReadCase(data, record, user)) return false;
  if (user.role === "ADMIN")
    return (
      (document.uploadedBy || record.userId) === user.id ||
      document.visibility === "PARTIES"
    );
  if (!isParty(record, user.id)) return true;
  return (
    (document.uploadedBy || record.userId) === user.id ||
    document.visibility === "PARTIES"
  );
}

export function mayReadConfidential(
  data: AppData,
  record: CaseRecord,
  user: User,
  ownerId: string,
) {
  if (user.id === ownerId) return true;
  const mediator =
    record.mediatorId && currentMediator(data, record.mediatorId);
  return Boolean(
    mediator &&
    user.role === "MEDIATOR" &&
    mediator.userId === user.id &&
    (!record.mediation || hasBothConsents(record)) &&
    canReadCase(data, record, user),
  );
}

export function visibleMessages(data: AppData, record: CaseRecord, user: User) {
  return (record.messages || []).filter(
    (message) =>
      message.visibility === "PARTIES" ||
      message.senderId === user.id ||
      message.recipientId === user.id ||
      (user.role === "MEDIATOR" &&
        mayReadConfidential(data, record, user, message.senderId)),
  );
}

export function caseForViewer(
  data: AppData,
  record: CaseRecord,
  user: User,
): CaseRecord {
  const result = structuredClone(record);
  delete result.creationRequest;
  result.hasPendingAgreement = (data.agreements || []).some(
    (agreement) =>
      agreement.caseId === record.id &&
      agreement.versions.some(
        (version) =>
          version.id === agreement.currentVersionId &&
          !["SIGNED", "SUPERSEDED"].includes(version.status),
      ),
  );
  result.positions = (record.positions || []).map((position) => ({
    ...position,
    confidentialStatement: mayReadConfidential(
      data,
      record,
      user,
      position.userId,
    )
      ? position.confidentialStatement
      : "",
  }));
  result.privateReviews = (record.privateReviews || []).filter((review) =>
    mayReadConfidential(data, record, user, review.userId),
  );
  result.messages = visibleMessages(data, record, user);
  result.documents = record.documents
    .filter((item) => canReadDocument(data, record, item, user))
    .map((item) => ({ ...item, storageKey: "" }));
  if (result.mediation) {
    delete result.mediation.invitationHash;
    delete result.mediation.invitationToken;
    delete result.mediation.invitationRequestId;
    const privileged = user.role === "ADMIN" || !isParty(record, user.id);
    for (const consent of [
      result.mediation.initiatorConsent,
      result.mediation.respondentConsent,
    ]) {
      if (consent && !privileged && consent.userId !== user.id)
        consent.phone = "";
    }
    if (!privileged) result.mediation.calls = [];
  }
  return result;
}

export function requireCase(data: AppData, id: string, user: User) {
  const record = data.cases.find((item) => item.id === id);
  if (!record || !canReadCase(data, record, user))
    throw new MediationError(404, "Nizo topilmadi.");
  return record;
}

export function requireAssignedMediator(
  data: AppData,
  record: CaseRecord,
  user: User,
) {
  const mediator =
    record.mediatorId && currentMediator(data, record.mediatorId);
  if (
    !mediator ||
    user.role !== "MEDIATOR" ||
    mediator.userId !== user.id ||
    !hasBothConsents(record)
  )
    throw new MediationError(
      403,
      "Ushbu amalni ikki taraf roziligidan so‘ng qabul qilgan mediator bajaradi.",
    );
  return mediator;
}

export function recordEvent(
  record: CaseRecord,
  note: string,
  status = record.status,
) {
  record.status = status;
  record.updatedAt = new Date().toISOString();
  record.history.push({ status, note, at: record.updatedAt });
}
