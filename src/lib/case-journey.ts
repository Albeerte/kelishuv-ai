import type { CaseRecord } from "./types";
import { hasBothConsents, hasMutualAppointment } from "./mediation";
import { negotiationState } from "./negotiation";

export function caseNextStep(record: CaseRecord, userId?: string) {
  const base = `/dashboard/cases/${record.id}/workbench`;
  if (record.hasPendingAgreement)
    return {
      label: "Hujjatni ko‘rish",
      description:
        "Kelishuv nusxasi tayyor. Mazmuni va imzolash navbati bilan tanishing.",
      href: `${base}?section=agreement`,
    };
  if (record.status === "RESOLVED" && !record.execution)
    return {
      label: "Hujjatlarni ko‘rish",
      description: "Yakunlangan ishning hujjatlari va kelishuvini ko‘ring.",
      href: `/dashboard/cases/${record.id}?tab=documents`,
    };
  if (record.status === "RESOLVED")
    return {
      label: "Ijroni ko‘rish",
      description: "Kelishuvdagi majburiyat va to‘lov muddatlarini kuzating.",
      href: `${base}?section=execution`,
    };
  if (["CLOSED", "ESCALATED"].includes(record.status))
    return {
      label: "Tafsilotlarni ko‘rish",
      description:
        "Saqlangan hujjatlar va tanlangan keyingi yo‘l bilan tanishing.",
      href: `/dashboard/cases/${record.id}`,
    };
  if (
    record.analysis.criminal ||
    record.guidance?.options.some(
      (option) => option.id === "MEDIATION" && option.availability === "UNSUITABLE",
    )
  )
    return {
      label: "Huquqiy yo‘llarni ko‘rish",
      description:
        "Vaziyat bo‘yicha huquqiy yo‘nalishlar va mutaxassis bilan aniqlashtiriladigan savollarni ko‘ring.",
      href: `/dashboard/cases/${record.id}#case-guidance`,
    };
  if (record.status === "SESSION_SCHEDULED")
    return {
      label: "Uchrashuvni ko‘rish",
      description:
        "Belgilangan vaqt va uchrashuv tafsilotlari bilan tanishing.",
      href: `${base}?section=room`,
    };
  if (!record.mediation?.respondentId)
    return {
      label: "Ikkinchi tarafni taklif qilish",
      description: "Ixtiyoriy ishtirok uchun ikkinchi tarafga taklif yuboring.",
      href: `${base}?section=positions`,
    };
  if (
    record.journeyVersion === 3 &&
    hasBothConsents(record) &&
    !record.mediatorId &&
    !negotiationState(record).exhausted &&
    !negotiationState(record).agreed
  )
    return {
      label: "Kelishuv taklifini ko‘rish",
      description:
        "Takliflar navbat bilan ochiladi. Har ikki taraf o‘z javobini kiritsin.",
      href: `${base}?section=analysis`,
    };
  if (!hasMutualAppointment(record))
    return {
      label:
        record.userId === userId
          ? "Rozilik va mediator tanlovi"
          : "Bayon va rozilikni ko‘rish",
      description: "Har bir taraf o‘z bayoni va roziligini mustaqil saqlaydi.",
      href: `${base}?section=positions`,
    };
  if (!record.mediation.procedureDocumentId)
    return {
      label: "Hujjat holatini ko‘rish",
      description:
        "Mediator hujjat loyihasini tayyorlaydi. Tayyor bo‘lgach, mazmuni va imzolash navbatini ko‘rasiz.",
      href: `${base}?section=agreement`,
    };
  return {
    label: "Jarayonni davom ettirish",
    description:
      "Mediator bilan muloqot qiling va keyingi uchrashuvni kelishing.",
    href: `${base}?section=room`,
  };
}

export function caseStage(record: CaseRecord) {
  if (["RESOLVED", "CLOSED"].includes(record.status)) return 3;
  if (record.mediatorId) return 2;
  if (record.mediation?.respondentId || record.chosenSolution) return 1;
  return 0;
}
