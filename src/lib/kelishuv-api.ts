import "server-only";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { boundedBody, jsonBody } from "./api-request";
import { readStore } from "./store";
import { loadDocument, removeDocument, saveDocument } from "./documents";
import { getAIProviderStatus } from "./ai-provider";
import { generatePrivateReview, generateSharedReview } from "./ai-workflow";
import { extractEvidence } from "./evidence-extraction";
import {
  renderAgreementFiles,
  validateSignatureBoxes,
  validateSignaturePng,
} from "./agreement-pdf";
import {
  AI_CONSENT_VERSION,
  SIGNING_CONSENT_VERSION,
  SIGNER_ROLES,
  agreementContentHash,
  audit,
  caseParticipants,
  createExecution,
  createReminderNotifications,
  currentVersion,
  digest,
  executionSummary,
  obligationPaid,
  publicAgreement,
  privateCaseInput,
  privateReviewInputHash,
  reviewInputHash,
  sharedCaseInput,
  tashkentDate,
  validateAgreementTerms,
  verifyAudit,
} from "./kelishuv-domain";
import {
  canReadCase,
  canReadDocument,
  caseForViewer,
  currentMediator,
  hasBothConsents,
  hasMutualAppointment,
  isParty,
  mayReadConfidential,
  MediationError,
  recordEvent,
  requireAssignedMediator,
  requireCase,
  visibleMessages,
} from "./mediation";
import { LEGAL_SOURCES } from "./legal";
import { negotiationState } from "./negotiation";
import { queueEligible } from "./mediation";
import { serviceStatus } from "./service-providers";
import type { AppData, CaseRecord, User } from "./types";
import type {
  Agreement,
  AgreementTerms,
  AgreementVersion,
  AIProcessingOptions,
  SignerRole,
} from "./kelishuv-types";

type Mutate = <T>(operation: (data: AppData) => T) => Promise<T>;
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  });
const amount = z.number().finite().int().min(0).max(1e12);
const termsSchema = z
  .object({
    language: z.string().trim().min(2).max(100).default("O‘zbek tili"),
    durationDays: z.number().int().min(1).max(60).default(30),
    feeTerms: z
      .string()
      .trim()
      .min(10)
      .max(2000)
      .default(
        "Mediator haqi, xarajatlar va taraflar ulushi alohida kelishib yozma qayd etiladi.",
      ),
    confidentiality: z
      .string()
      .trim()
      .min(10)
      .max(2000)
      .default(
        "Mediatsiyaga oid axborot maxfiy saqlanadi. Taraf ma’lumotini boshqa tarafga ochish uning roziligi bilan amalga oshiriladi.",
      ),
    subject: z.string().trim().min(4).max(2000),
    agreedTerms: z.string().trim().min(20).max(12000),
    totalAmount: amount,
    currency: z.literal("UZS"),
    place: z.string().trim().min(2).max(150),
    date: dateSchema,
    paymentSchedule: z
      .array(
        z.object({
          id: z.string().min(1).max(100),
          amount: amount.min(1),
          dueDate: dateSchema,
          payerId: z.string(),
          payeeId: z.string(),
          description: z.string().trim().max(1000),
        }),
      )
      .max(48),
    obligations: z
      .array(
        z.object({
          id: z.string().min(1).max(100),
          title: z.string().trim().min(3).max(1200),
          dueDate: dateSchema,
          assigneeId: z.string(),
          beneficiaryId: z.string(),
        }),
      )
      .max(30),
    responsibilities: z.string().trim().min(3).max(4000),
    conditions: z.string().trim().min(3).max(4000),
    sourceIds: z.array(z.string()).max(15),
  })
  .refine((terms) => {
    const ids = [...terms.paymentSchedule, ...terms.obligations].map(
      (item) => item.id,
    );
    return new Set(ids).size === ids.length;
  }, "Majburiyat raqamlari takrorlangan.");
const boxesSchema = z
  .array(
    z.object({
      role: z.enum(SIGNER_ROLES as [SignerRole, ...SignerRole[]]),
      page: z.number().int().min(0).max(99),
      x: z.number().finite(),
      y: z.number().finite(),
      width: z.number().finite(),
      height: z.number().finite(),
    }),
  )
  .length(3);

function notify(
  data: AppData,
  userId: string,
  caseId: string,
  title: string,
  section = "agreement",
) {
  data.notifications.unshift({
    id: randomUUID(),
    userId,
    title,
    body: `${data.cases.find((record) => record.id === caseId)?.number || ""} · Ish maydonida davom eting.`,
    href: `/dashboard/cases/${caseId}/workbench?section=${section}`,
    read: false,
    createdAt: new Date().toISOString(),
  });
}
function notifyParticipants(
  data: AppData,
  record: CaseRecord,
  title: string,
  section?: string,
) {
  for (const participant of caseParticipants(data, record))
    notify(data, participant.userId, record.id, title, section);
}
function requireParty(record: CaseRecord, user: User) {
  if (!isParty(record, user.id))
    throw new MediationError(
      403,
      "Ushbu amalni nizo tarafi o‘z hisobidan bajaradi.",
    );
}
function processingOptions(
  record: CaseRecord,
  userId?: string,
): AIProcessingOptions {
  const ids = userId
    ? [userId]
    : [record.userId, record.mediation?.respondentId].filter(Boolean);
  const consents = ids.map(
    (id) =>
      record.positions?.find((position) => position.userId === id)?.consent,
  );
  return {
    localConsent: consents.every(
      (consent) => consent?.local && consent.version === AI_CONSENT_VERSION,
    ),
    externalConsent: consents.every(
      (consent) => consent?.external && consent.version === AI_CONSENT_VERSION,
    ),
  };
}
function agreementForUser(data: AppData, id: string, user: User) {
  const agreement = data.agreements?.find((item) => item.id === id);
  if (!agreement) throw new MediationError(404, "Kelishuv topilmadi.");
  const record = requireCase(data, agreement.caseId, user);
  return { agreement, record };
}
async function saveArtifacts(
  version: AgreementVersion,
  files: { pdf: Buffer; docx: Buffer },
) {
  const keys = [randomUUID(), randomUUID()];
  try {
    await saveDocument(keys[0], files.pdf);
    await saveDocument(keys[1], files.docx);
    Object.assign(version, {
      pdfStorageKey: keys[0],
      docxStorageKey: keys[1],
      pdfHash: digest(files.pdf),
      docxHash: digest(files.docx),
    });
  } catch (error) {
    await Promise.allSettled(keys.map(removeDocument));
    throw error;
  }
  return keys;
}
function ensureCurrentSigners(
  data: AppData,
  record: CaseRecord,
  version: AgreementVersion,
) {
  const actual = caseParticipants(data, record);
  if (
    !hasMutualAppointment(record) ||
    actual.length !== 3 ||
    actual.some(
      (participant) =>
        !version.participants.some(
          (item) =>
            item.role === participant.role &&
            item.userId === participant.userId,
        ),
    )
  )
    throw new MediationError(
      409,
      "Mediator tanlovi yoki taraflar tarkibi o‘zgargan. Hujjatni qayta tayyorlang.",
    );
}

export async function handleKelishuvRequest(
  request: NextRequest,
  user: User,
  mutate: Mutate,
): Promise<Response | null> {
  const parts = request.nextUrl.pathname.replace(/^\/api\//, "").split("/");
  const route = parts.join("/");
  const method = request.method;
  const locale = request.cookies.get("kelishuv-locale")?.value;
  const outputLocale = locale === "ru" || locale === "uz-Cyrl" ? locale : "uz";
  if (route === "ai/status" && method === "GET")
    return NextResponse.json(await getAIProviderStatus());
  if (route === "payments" && method === "GET") {
    const data = await readStore();
    return NextResponse.json({
      payments: (data.payments || []).filter((payment) => {
        const record = data.cases.find((item) => item.id === payment.caseId);
        return record && canReadCase(data, record, user);
      }),
    });
  }

  if (route === "workspace" && method === "GET") {
    await mutate((data) => createReminderNotifications(data));
    const data = await readStore();
    const cases = data.cases.filter((record) =>
      canReadCase(data, record, user),
    );
    return NextResponse.json({
      cases: cases.map((record) => caseForViewer(data, record, user)),
      agreements: (data.agreements || [])
        .filter((agreement) =>
          cases.some((record) => record.id === agreement.caseId),
        )
        .map(publicAgreement),
      aiStatus: await getAIProviderStatus(),
      execution: cases
        .filter((record) => record.execution)
        .map((record) => ({
          caseId: record.id,
          number: record.number,
          ...executionSummary(record.execution!),
        })),
    });
  }
  if (route === "integrations" && method === "GET") {
    return NextResponse.json({
      ai: await getAIProviderStatus(),
      adapters: [
        {
          id: "registry",
          title: "Mediatorlar reyestri",
          status: "MANUAL",
          detail: "Rasmiy reyestr administrator tomonidan solishtiriladi.",
          url: "https://gov.uz/oz/adliya/sections/professional-mediatorlar-reyestri",
        },
        {
          id: "oneid",
          title: "OneID",
          status: "UNCONFIGURED",
          detail:
            "Vakolatli xizmatning tasdiqlangan texnik interfeysi va shartnomasi bilan ulanadi.",
        },
        {
          id: "eri",
          title: "ERI / E-IMZO",
          status: "UNCONFIGURED",
          detail:
            "Qo‘lda imzo vizual yozuv sifatida saqlanadi. ERI adapteri vakolatli xizmat sozlangach ishlaydi.",
        },
        {
          id: "payment",
          title: "Payme to‘lovlari",
          status: serviceStatus().payment ? "CONFIGURED" : "UNCONFIGURED",
          detail:
            "Buyurtma, server tasdig‘i, qayta urinishlar va 15 foiz platforma ulushi uchun adapter tayyor.",
          url: "https://developer.help.paycom.uz/",
        },
        {
          id: "identity",
          title: "Pasport va Face ID",
          status: serviceStatus().identity ? "CONFIGURED" : "UNCONFIGURED",
          detail:
            "Shifrlangan hujjat, AI maydonlari va imzolangan provayder natijasi orqali tekshiruv.",
          url: "https://docs.myid.uz/",
        },
        {
          id: "zoom",
          title: "Zoom uchrashuvlari",
          status: serviceStatus().zoom ? "CONFIGURED" : "UNCONFIGURED",
          detail:
            "Server-to-Server OAuth orqali rejalashtirilgan sessiyaga Zoom havolasi yaratiladi.",
          url: "https://developers.zoom.us/docs/internal-apps/s2s-oauth/",
        },
        {
          id: "email",
          title: "Email",
          status: process.env.SMTP_HOST ? "CONFIGURED" : "UNCONFIGURED",
          detail: process.env.SMTP_HOST
            ? "SMTP sozlangan. Yetkazish holati outboxda qayd etiladi."
            : "Ichki bildirishnomalar ishlaydi. SMTP sozlanadi.",
        },
        {
          id: "telegram",
          title: "Telegram",
          status: "UNCONFIGURED",
          detail:
            "Bot va foydalanuvchi roziligi bilan ulash uchun adapter chegarasi tayyor.",
        },
        {
          id: "sms",
          title: "Eskiz SMS",
          status: serviceStatus().sms ? "CONFIGURED" : "UNCONFIGURED",
          detail:
            "Telefon tasdiqlash kodi va qarshi tarafga shaxsiy taklif havolasi uchun adapter tayyor.",
          url: "https://www.eskiz.uz/sms",
        },
        {
          id: "calendar",
          title: "Kalender",
          status: "LOCAL",
          detail:
            "Mahalliy sessiyalar, vaqt to‘qnashuvi tekshiruvi va ICS yuklash ishlaydi.",
        },
        {
          id: "lexuz",
          title: "Lex.uz",
          status: "CACHED",
          detail: `${LEGAL_SOURCES.filter((source) => source.content).length} tanlangan modda. Yangilash buyrug‘i qo‘lda bajariladi.`,
        },
        {
          id: "retention",
          title: "Saqlash muddati",
          status: "MANUAL",
          detail:
            "Ma’lumotni eksport qilish va o‘chirish murojaati administrator orqali qayd etiladi. Avtomatik muddat siyosati tashkilot shartlariga bog‘liq.",
        },
      ],
    });
  }
  if (route === "complaints" && method === "POST") {
    const input = z
      .object({
        caseId: z.string().optional(),
        category: z.enum([
          "SUPPORT",
          "CONFIDENTIALITY",
          "MEDIATOR",
          "DATA_REQUEST",
        ]),
        description: z.string().trim().min(10).max(4000),
      })
      .parse(await jsonBody(request));
    const complaint = await mutate((data) => {
      if (input.caseId) requireCase(data, input.caseId, user);
      const complaint = {
        id: randomUUID(),
        userId: user.id,
        ...input,
        status: "OPEN" as const,
        createdAt: new Date().toISOString(),
      };
      (data.complaints ??= []).push(complaint);
      audit(data, user.id, "COMPLAINT_CREATED", {
        caseId: input.caseId,
        details: { complaintId: complaint.id, category: input.category },
      });
      return complaint;
    });
    return NextResponse.json({ complaint }, { status: 201 });
  }
  if (route === "admin/kelishuv" && method === "GET") {
    if (user.role !== "ADMIN")
      throw new MediationError(403, "Administrator vakolati kerak.");
    const data = await readStore();
    return NextResponse.json({
      agreements: (data.agreements || []).map(publicAgreement),
      audit: (data.audit || []).toReversed().slice(0, 300),
      auditValid: verifyAudit(data.audit || []),
      complaints: data.complaints || [],
      settings: data.settings || { retentionDays: null, reminderDays: 3 },
      sources: LEGAL_SOURCES,
      templates: [
        {
          id: "PROCEDURE",
          name: "Mediatsiya tartib-taomili kelishuvi",
          source: "https://lex.uz/docs/-3805227",
          status: "REQUIRES_MEDIATOR_REVIEW",
        },
        {
          id: "SETTLEMENT",
          name: "Mediativ kelishuv",
          source: "https://lex.uz/docs/-3805227#-3807012",
          status: "REQUIRES_MEDIATOR_REVIEW",
        },
      ],
    });
  }
  if (
    parts[0] === "admin" &&
    parts[1] === "complaints" &&
    parts[2] &&
    method === "PUT"
  ) {
    if (user.role !== "ADMIN")
      throw new MediationError(403, "Administrator vakolati kerak.");
    const input = z
      .object({ reviewNote: z.string().trim().min(10).max(3000) })
      .parse(await jsonBody(request));
    await mutate((data) => {
      const complaint = data.complaints?.find((item) => item.id === parts[2]);
      if (!complaint) throw new MediationError(404, "Murojaat topilmadi.");
      complaint.status = "REVIEWED";
      complaint.reviewNote = input.reviewNote;
      audit(data, user.id, "COMPLAINT_REVIEWED", {
        details: { complaintId: complaint.id },
      });
    });
    return NextResponse.json({ ok: true });
  }
  if (route === "admin/reminders" && method === "POST") {
    if (user.role !== "ADMIN")
      throw new MediationError(403, "Administrator vakolati kerak.");
    return NextResponse.json({
      created: await mutate((data) => createReminderNotifications(data)),
    });
  }
  if (route === "mediator/availability" && method === "POST") {
    const input = z
      .object({
        weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
        startHour: z.number().int().min(0).max(22),
        endHour: z.number().int().min(1).max(23),
        duration: z.literal(60).default(60),
      })
      .refine((input) => input.endHour > input.startHour)
      .parse(await jsonBody(request));
    await mutate((data) => {
      const mediator = data.mediators.find(
        (item) => item.userId === user.id && currentMediator(data, item.id),
      );
      if (!mediator || user.role !== "MEDIATOR")
        throw new MediationError(403, "Tasdiqlangan mediator profili kerak.");
      mediator.availability = {
        ...input,
        weekdays: [...new Set(input.weekdays)],
        updatedAt: new Date().toISOString(),
      };
      audit(data, user.id, "AVAILABILITY_UPDATED", {
        details: { mediatorId: mediator.id },
      });
    });
    return NextResponse.json({ ok: true });
  }
  if (
    parts[0] === "mediators" &&
    parts[1] &&
    parts[2] === "availability" &&
    method === "GET"
  ) {
    const data = await readStore();
    const mediator = currentMediator(data, parts[1]);
    if (!mediator) throw new MediationError(404, "Mediator topilmadi.");
    const schedule =
      mediator.availability ||
      (mediator.demo
        ? { weekdays: [1, 2, 3, 4, 5], startHour: 9, endHour: 17, duration: 60 }
        : null);
    const slots = [];
    if (schedule)
      for (let day = 1; day <= 7; day++) {
        const date = new Date(
          `${tashkentDate(new Date(Date.now() + day * 86400000))}T00:00:00+05:00`,
        );
        if (
          !schedule.weekdays.includes(
            new Date(date.getTime() + 5 * 3600000).getUTCDay(),
          )
        )
          continue;
        for (let hour = schedule.startHour; hour < schedule.endHour; hour++) {
          const start = new Date(date.getTime() + hour * 3600000).toISOString();
          const end = new Date(Date.parse(start) + 3600000).toISOString();
          const available = !data.sessions.some(
            (session) =>
              session.mediatorId === mediator.id &&
              session.status === "SCHEDULED" &&
              Date.parse(session.scheduledAt) < Date.parse(end) &&
              Date.parse(session.scheduledAt) + session.duration * 60000 >
                Date.parse(start),
          );
          slots.push({ start, end, available, duration: 60 });
        }
      }
    return NextResponse.json({
      slots,
      demo: mediator.demo,
      source:
        mediator.demo && !mediator.availability ? "DEMO" : "MEDIATOR_SCHEDULE",
      published: Boolean(schedule),
    });
  }
  if (
    parts[0] === "sessions" &&
    parts[1] &&
    parts[2] === "calendar" &&
    method === "GET"
  ) {
    const data = await readStore();
    const session = data.sessions.find((item) => item.id === parts[1]);
    if (!session) throw new MediationError(404, "Sessiya topilmadi.");
    const record = requireCase(data, session.caseId, user);
    const stamp = (date: Date) =>
      date
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/, "");
    const text = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//KELISHUV AI//UZ",
      "BEGIN:VEVENT",
      `UID:${session.id}@kelishuv.local`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(new Date(session.scheduledAt))}`,
      `DTEND:${stamp(new Date(Date.parse(session.scheduledAt) + session.duration * 60000))}`,
      `SUMMARY:KELISHUV AI ${record.number}`,
      `STATUS:${session.status === "CANCELLED" ? "CANCELLED" : "CONFIRMED"}`,
      "END:VEVENT",
      "END:VCALENDAR",
      "",
    ].join("\r\n");
    return new Response(text, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${record.number}.ics"`,
        "Cache-Control": "no-store",
      },
    });
  }

  if (parts[0] === "cases" && parts[1]) {
    const id = parts[1];
    const action = parts[2];
    if (action === "workspace" && method === "GET") {
      await mutate((data) => {
        requireCase(data, id, user);
        createReminderNotifications(data);
      });
      const data = await readStore();
      const record = requireCase(data, id, user);
      const participants = caseParticipants(data, record).map(
        (participant) => ({
          ...participant,
          phone:
            user.role === "MEDIATOR" || participant.userId === user.id
              ? participant.phone
              : "",
        }),
      );
      return NextResponse.json({
        case: caseForViewer(data, record, user),
        participants,
        agreements: (data.agreements || [])
          .filter((agreement) => agreement.caseId === id)
          .map(publicAgreement),
        execution: record.execution,
        messages: visibleMessages(data, record, user),
        aiStatus: await getAIProviderStatus(),
        aiStale: Boolean(
          record.aiReview &&
          record.aiReview.inputHash !== reviewInputHash(record),
        ),
        myPosition: record.positions?.find(
          (position) => position.userId === user.id,
        ),
        canMediate:
          user.role === "MEDIATOR" &&
          caseParticipants(data, record).some(
            (participant) =>
              participant.role === "MEDIATOR" && participant.userId === user.id,
          ) &&
          hasBothConsents(record),
      });
    }
    if (action === "positions" && method === "POST") {
      const input = z
        .object({
          sharedStatement: z.string().trim().min(20).max(10000),
          confidentialStatement: z.string().trim().max(10000).default(""),
          localConsent: z.boolean(),
          externalConsent: z.boolean(),
          consentVersion: z.literal(AI_CONSENT_VERSION),
        })
        .parse(await jsonBody(request));
      const position = await mutate((data) => {
        const record = requireCase(data, id, user);
        requireParty(record, user);
        const savedPosition = record.positions?.find(
          (item) => item.userId === user.id,
        );
        if (
          ["RESOLVED", "CLOSED"].includes(record.status) &&
          (input.sharedStatement !==
            (savedPosition?.sharedStatement ||
              (record.userId === user.id
                ? record.description
                : record.mediation?.respondentStatement || "")) ||
            input.confidentialStatement !==
              (savedPosition?.confidentialStatement || ""))
        )
          throw new MediationError(
            409,
            "Yakunlangan nizo bayonini o‘zgartirib bo‘lmaydi.",
          );
        const position = {
          userId: user.id,
          sharedStatement: input.sharedStatement,
          confidentialStatement: input.confidentialStatement,
          consent: {
            local: input.localConsent,
            external: input.externalConsent,
            version: AI_CONSENT_VERSION,
            at: new Date().toISOString(),
          },
          updatedAt: new Date().toISOString(),
        };
        record.positions = [
          ...(record.positions || []).filter((item) => item.userId !== user.id),
          position,
        ];
        if (record.mediation?.respondentId === user.id)
          record.mediation.respondentStatement = position.sharedStatement;
        record.updatedAt = position.updatedAt;
        audit(data, user.id, "POSITION_SAVED", {
          caseId: id,
          details: {
            confidential: Boolean(position.confidentialStatement),
            localAI: input.localConsent,
            externalAI: input.externalConsent,
          },
        });
        return position;
      });
      return NextResponse.json({ position });
    }
    if (action === "ai" && method === "POST") {
      const before = await readStore();
      const record = requireCase(before, id, user);
      const input = sharedCaseInput(record);
      if (
        input.statements.length !== 2 ||
        input.statements.some((statement) => statement.text.trim().length < 20)
      )
        throw new MediationError(
          400,
          "To‘rtta taklif uchun ikkala tarafning ochiq bayoni kerak.",
        );
      const fingerprint = reviewInputHash(record);
      if (
        record.aiReview?.inputHash === fingerprint &&
        record.aiReview.proposals.length === 4
      )
        return NextResponse.json({ review: record.aiReview });
      const options = processingOptions(record);
      const review = await generateSharedReview(input, {
        ...options,
        locale: outputLocale,
        beforeDispatch: async (local) => {
          const fresh = requireCase(await readStore(), id, user);
          const consent = processingOptions(fresh);
          if (
            fingerprint !== reviewInputHash(fresh) ||
            !(local ? consent.localConsent : consent.externalConsent)
          )
            throw new MediationError(
              409,
              "AI ishlovi uchun bayon yoki rozilik yangilangan.",
            );
        },
      });
      const result = await mutate((data) => {
        const fresh = requireCase(data, id, user);
        if (fingerprint !== reviewInputHash(fresh))
          throw new MediationError(
            409,
            "Bayon yoki hujjatlar yangilangan. Tahlilni qayta boshlang.",
          );
        if (
          fresh.aiReview?.inputHash === fingerprint &&
          fresh.aiReview.proposals.length === 4
        )
          return fresh.aiReview;
        fresh.aiReview = {
          ...review,
          id: randomUUID(),
          inputHash: fingerprint,
          createdAt: new Date().toISOString(),
        };
        audit(data, user.id, "SHARED_AI_REVIEW_CREATED", {
          caseId: id,
          details: { provider: review.provider, model: review.model },
        });
        return fresh.aiReview;
      });
      return NextResponse.json({ review: result });
    }
    if (action === "private-ai" && method === "POST") {
      const before = await readStore();
      const record = requireCase(before, id, user);
      requireParty(record, user);
      const position = record.positions?.find(
        (position) => position.userId === user.id,
      );
      if (!position?.confidentialStatement.trim())
        throw new MediationError(400, "Avval maxfiy bayoningizni saqlang.");
      const fingerprint = privateReviewInputHash(record, user.id);
      const result = await generatePrivateReview(
        privateCaseInput(record, user.id),
        {
          ...processingOptions(record, user.id),
          locale: outputLocale,
          beforeDispatch: async (local) => {
            const fresh = requireCase(await readStore(), id, user);
            const consent = processingOptions(fresh, user.id);
            if (
              fingerprint !== privateReviewInputHash(fresh, user.id) ||
              !(local ? consent.localConsent : consent.externalConsent)
            )
              throw new MediationError(
                409,
                "Maxfiy tahlil uchun bayon, dalil yoki rozilik yangilangan.",
              );
          },
        },
      );
      const review = await mutate((data) => {
        const fresh = requireCase(data, id, user);
        if (privateReviewInputHash(fresh, user.id) !== fingerprint)
          throw new MediationError(
            409,
            "Maxfiy bayon yangilangan. Qayta tahlil qiling.",
          );
        const review = {
          ...result,
          id: randomUUID(),
          userId: user.id,
          inputHash: fingerprint,
          createdAt: new Date().toISOString(),
        };
        fresh.privateReviews = [
          ...(fresh.privateReviews || []).filter(
            (item) => item.userId !== user.id,
          ),
          review,
        ];
        audit(data, user.id, "PRIVATE_AI_REVIEW_CREATED", {
          caseId: id,
          details: { provider: result.provider },
        });
        return review;
      });
      return NextResponse.json({ review });
    }
    if (
      action === "documents" &&
      parts[3] &&
      parts[4] === "extract" &&
      method === "POST"
    ) {
      const data = await readStore();
      const record = requireCase(data, id, user);
      const document = record.documents.find((item) => item.id === parts[3]);
      if (!document || !canReadDocument(data, record, document, user))
        throw new MediationError(404, "Hujjat topilmadi.");
      const ownerId = document.uploadedBy || record.userId;
      if (
        user.id !== ownerId &&
        !mayReadConfidential(data, record, user, ownerId)
      )
        throw new MediationError(
          403,
          "Dalil tahlilini uning egasi yoki vakolatli mediator boshlaydi.",
        );
      const consent = processingOptions(record, ownerId);
      const extraction = await extractEvidence(
        document,
        await loadDocument(document.storageKey),
        {
          ...consent,
          locale: outputLocale,
          beforeDispatch: async (local) => {
            const freshData = await readStore();
            const fresh = requireCase(freshData, id, user);
            const current = fresh.documents.find(
              (item) => item.id === document.id,
            );
            const currentConsent = processingOptions(fresh, ownerId);
            if (
              !current ||
              current.storageKey !== document.storageKey ||
              !canReadDocument(freshData, fresh, current, user) ||
              !(local
                ? currentConsent.localConsent
                : currentConsent.externalConsent)
            )
              throw new MediationError(
                409,
                "Dalil tahliliga ruxsat yoki rozilik o‘zgargan.",
              );
          },
        },
      ).catch(() => {
        throw new MediationError(
          400,
          "Hujjat tarkibi yoki hajmi tahlil uchun mos emas. PDF, DOCX yoki rasmni tekshirib qayta yuklang.",
        );
      });
      await mutate((data) => {
        const fresh = requireCase(data, id, user);
        const saved = fresh.documents.find((item) => item.id === document.id);
        if (
          !saved ||
          saved.storageKey !== document.storageKey ||
          !canReadDocument(data, fresh, saved, user)
        )
          throw new MediationError(409, "Hujjatga kirish o‘zgargan.");
        const currentOptions = processingOptions(fresh, ownerId);
        if (
          currentOptions.localConsent !== consent.localConsent ||
          currentOptions.externalConsent !== consent.externalConsent
        )
          throw new MediationError(409, "AI ishloviga rozilik o‘zgargan.");
        saved.extraction = extraction;
        audit(data, user.id, "EVIDENCE_EXTRACTED", {
          caseId: id,
          details: {
            documentId: document.id,
            method: extraction.method,
            provider: extraction.provider,
          },
        });
      });
      return NextResponse.json({ extraction });
    }
    if (
      action === "proposals" &&
      parts[3] &&
      parts[4] === "respond" &&
      method === "POST"
    ) {
      const input = z
        .object({
          reviewId: z.string(),
          decision: z.enum(["ACCEPT", "REJECT", "CHANGES"]),
          note: z.string().trim().max(3000).default(""),
        })
        .parse(await jsonBody(request));
      const decision = await mutate((data) => {
        const record = requireCase(data, id, user);
        requireParty(record, user);
        if (
          ["RESOLVED", "CLOSED", "ESCALATED", "CONSENT_WITHDRAWN"].includes(
            record.status,
          )
        )
          throw new MediationError(
            409,
            "Ushbu ishda takliflarga javob berish yakunlangan.",
          );
        if (
          !record.aiReview ||
          record.aiReview.id !== input.reviewId ||
          record.aiReview.inputHash !== reviewInputHash(record)
        )
          throw new MediationError(
            409,
            "Tahlil yangilangan. Joriy taklifni ko‘rib chiqing.",
          );
        const proposal = record.aiReview.proposals.find(
          (item) => item.id === parts[3],
        );
        if (!proposal) throw new MediationError(404, "Taklif topilmadi.");
        const previous = record.proposalDecisions?.find(
          (item) =>
            item.userId === user.id &&
            item.reviewId === input.reviewId &&
            item.proposalId === proposal.id,
        );
        if (
          previous?.decision === input.decision &&
          previous.note === input.note
        )
          return previous;
        const before = negotiationState(record);
        const sequential = record.journeyVersion === 3;
        if (sequential && !hasBothConsents(record)) throw new MediationError(409, "Taklif muhokamasini boshlash uchun ikkala taraf roziligi kerak.");
        if (sequential && (before.proposal?.id !== proposal.id || before.complete))
          throw new MediationError(
            409,
            "Ushbu bosqich yakunlangan. Joriy taklifni oching.",
          );
        if (!record.mediation?.respondentId)
          throw new MediationError(
            409,
            "Avval ikkinchi taraf o‘z hisobidan qo‘shilishi kerak.",
          );
        const decision = {
          userId: user.id,
          reviewId: input.reviewId,
          proposalId: proposal.id,
          decision: input.decision,
          note: input.note,
          at: new Date().toISOString(),
        };
        record.proposalDecisions = [
          ...(record.proposalDecisions || []).filter(
            (item) =>
              !(
                item.userId === user.id &&
                item.reviewId === input.reviewId &&
                item.proposalId === proposal.id
              ),
          ),
          decision,
        ];
        audit(data, user.id, "PROPOSAL_RESPONDED", {
          caseId: id,
          details: { proposalId: proposal.id, decision: input.decision },
        });
        const after = negotiationState(record);
        if (sequential && (after.index !== before.index || after.agreed)) {
          const body = after.agreed
            ? "Ikkala taraf taklifni ma’qulladi. Kelishuv shartlarini mediator bilan rasmiylashtiring."
            : after.exhausted
              ? "To‘rtta taklif yakunlandi. O‘z shahringizdagi mediator bilan muhokamani davom ettiring."
              : `${after.round}/4 taklif muhokamasi ochildi. Har ikki taraf javobini kiritsin.`;
          (record.messages ??= []).push({
            id: randomUUID(),
            senderId: "system-ai",
            visibility: "PARTIES",
            body,
            createdAt: new Date().toISOString(),
          });
          notifyParticipants(data, record, body, "analysis");
          if (
            (after.exhausted || after.agreed) &&
            hasBothConsents(record) &&
            !record.mediatorId &&
            !record.analysis.criminal &&
            record.routingFacts?.thirdPartyRights !== "YES"
          ) {
            record.chosenSolution = "MEDIATION";
            record.mediation!.publishedAt = new Date().toISOString();
            recordEvent(record, body, "OPEN_FOR_MEDIATORS");
            for (const mediator of data.mediators.filter((item) =>
              queueEligible(data, record, item),
            ))
              notify(
                data,
                mediator.userId,
                record.id,
                "Shahringizda mediatsiya so‘rovi",
                "positions",
              );
          }
        }
        return decision;
      });
      return NextResponse.json({ decision });
    }
    if (action === "messages" && method === "POST") {
      const input = z
        .object({
          body: z.string().trim().min(1).max(5000),
          requestId: z.string().uuid().optional(),
          visibility: z.enum(["PARTIES", "PRIVATE"]),
          recipientId: z.string().optional(),
        })
        .parse(await jsonBody(request));
      const message = await mutate((data) => {
        const record = requireCase(data, id, user);
        if (user.role === "ADMIN" && !isParty(record, user.id))
          throw new MediationError(
            403,
            "Muloqotda taraflar va biriktirilgan mediator qatnashadi.",
          );
        const mediator =
          record.mediatorId && currentMediator(data, record.mediatorId);
        if (
          input.visibility === "PRIVATE" &&
          (!mediator || !hasBothConsents(record))
        )
          throw new MediationError(
            409,
            "Maxfiy suhbat uchun mediator biriktirilishi kerak.",
          );
        const recipientId =
          input.visibility === "PRIVATE"
            ? isParty(record, user.id)
              ? mediator && mediator.userId
              : input.recipientId
            : undefined;
        if (
          input.visibility === "PRIVATE" &&
          (!recipientId ||
            recipientId === user.id ||
            ![
              record.userId,
              record.mediation?.respondentId,
              mediator && mediator.userId,
            ].includes(recipientId))
        )
          throw new MediationError(
            400,
            "Suhbat uchun tegishli tarafni tanlang.",
          );
        const previous =
          input.requestId &&
          record.messages?.find(
            (item) =>
              item.senderId === user.id && item.requestId === input.requestId,
          );
        if (previous) {
          if (
            previous.body !== input.body ||
            previous.visibility !== input.visibility ||
            (previous.recipientId || "") !== (recipientId || "")
          )
            throw new MediationError(
              409,
              "Xabar so‘rovi o‘zgargan. Sahifani yangilang.",
            );
          return previous;
        }
        const message = {
          id: randomUUID(),
          senderId: user.id,
          requestId: input.requestId,
          recipientId: recipientId || undefined,
          visibility: input.visibility,
          body: input.body,
          createdAt: new Date().toISOString(),
        };
        (record.messages ??= []).push(message);
        audit(data, user.id, "MESSAGE_SENT", {
          caseId: id,
          details: { visibility: input.visibility },
        });
        return message;
      });
      return NextResponse.json({ message }, { status: 201 });
    }
    if (action === "execution" && parts[3] === "report" && method === "POST") {
      const input = z
        .object({
          versionId: z.string().min(1),
          obligationId: z.string(),
          requestId: z.string().min(10).max(100),
          amount,
          reference: z.string().trim().min(3).max(300),
          evidenceDocumentId: z.string().optional(),
        })
        .parse(await jsonBody(request));
      const report = await mutate((data) => {
        const record = requireCase(data, id, user);
        const execution = record.execution;
        const obligation = execution?.obligations.find(
          (item) => item.id === input.obligationId,
        );
        if (!execution || !obligation)
          throw new MediationError(404, "Majburiyat topilmadi.");
        if (
          execution.versionId !== input.versionId ||
          record.executionHistory?.some((previous) =>
            previous.reports.some(
              (report) => report.requestId === input.requestId,
            ),
          )
        )
          throw new MediationError(
            409,
            "Ijro hujjati yangilangan. Joriy nusxani ko‘rib hisobot yuboring.",
          );
        if (obligation.assigneeId !== user.id)
          throw new MediationError(
            403,
            "Bajarish hisobotini majburiyat egasi yuboradi.",
          );
        const previous = execution.reports.find(
          (item) => item.requestId === input.requestId,
        );
        if (previous) {
          if (
            previous.reportedBy !== user.id ||
            previous.obligationId !== input.obligationId ||
            previous.amount !== input.amount ||
            previous.reference !== input.reference ||
            previous.evidenceDocumentId !== input.evidenceDocumentId
          )
            throw new MediationError(
              409,
              "Takroriy so‘rov ma’lumotlari o‘zgargan.",
            );
          return previous;
        }
        if (obligation.status === "COMPLETED")
          throw new MediationError(409, "Majburiyat bajarilgan.");
        const pending = execution.reports
          .filter(
            (item) =>
              item.obligationId === obligation.id && item.status === "PENDING",
          )
          .reduce((sum, item) => sum + item.amount, 0);
        if (
          obligation.type === "PAYMENT" &&
          (input.amount <= 0 ||
            input.amount + pending + obligationPaid(execution, obligation.id) >
              obligation.amount)
        )
          throw new MediationError(
            400,
            "Hisobot summasi qolgan to‘lovdan oshmasligi kerak.",
          );
        if (obligation.type === "ACTION" && input.amount !== 0)
          throw new MediationError(
            400,
            "Pulga oid bo‘lmagan majburiyat uchun summa nol bo‘lsin.",
          );
        if (
          input.evidenceDocumentId &&
          !record.documents.some(
            (document) =>
              document.id === input.evidenceDocumentId &&
              document.visibility === "PARTIES" &&
              document.uploadedBy === user.id,
          )
        )
          throw new MediationError(
            400,
            "Ikkala tarafga ochilgan o‘z hujjatingizni tanlang.",
          );
        const report = {
          id: randomUUID(),
          ...input,
          reportedBy: user.id,
          reportedAt: new Date().toISOString(),
          status: "PENDING" as const,
        };
        execution.reports.push(report);
        obligation.status = "REPORTED";
        obligation.reportedAt = report.reportedAt;
        audit(data, user.id, "OBLIGATION_REPORTED", {
          caseId: id,
          agreementId: execution.agreementId,
          versionId: execution.versionId,
          details: { obligationId: obligation.id, amount: input.amount },
        });
        notify(
          data,
          obligation.beneficiaryId,
          id,
          "Majburiyat bo‘yicha yangi hisobot",
          "execution",
        );
        return report;
      });
      return NextResponse.json({ report }, { status: 201 });
    }
    if (action === "execution" && parts[3] === "review" && method === "POST") {
      const input = z
        .object({
          reportId: z.string(),
          accept: z.boolean(),
          note: z.string().trim().max(2000).default(""),
        })
        .parse(await jsonBody(request));
      const report = await mutate((data) => {
        const record = requireCase(data, id, user);
        const execution = record.execution;
        const report = execution?.reports.find(
          (item) => item.id === input.reportId,
        );
        const obligation = execution?.obligations.find(
          (item) => item.id === report?.obligationId,
        );
        if (!execution || !report || !obligation)
          throw new MediationError(404, "Hisobot topilmadi.");
        if (obligation.beneficiaryId !== user.id)
          throw new MediationError(
            403,
            "Qabul qilgan taraf bajarishni tasdiqlaydi.",
          );
        if (report.status !== "PENDING") {
          if (report.status === (input.accept ? "CONFIRMED" : "REJECTED"))
            return report;
          throw new MediationError(409, "Hisobot avval ko‘rib chiqilgan.");
        }
        report.status = input.accept ? "CONFIRMED" : "REJECTED";
        report.reviewedBy = user.id;
        report.reviewedAt = new Date().toISOString();
        report.note = input.note;
        const complete =
          obligation.type === "ACTION"
            ? execution.reports.some(
                (item) =>
                  item.obligationId === obligation.id &&
                  item.status === "CONFIRMED",
              )
            : obligationPaid(execution, obligation.id) >= obligation.amount;
        obligation.status = complete
          ? "COMPLETED"
          : execution.reports.some(
                (item) =>
                  item.obligationId === obligation.id &&
                  item.status === "PENDING",
              )
            ? "REPORTED"
            : "PENDING";
        if (complete && !obligation.completedAt)
          obligation.completedAt = report.reviewedAt;
        audit(data, user.id, "OBLIGATION_REVIEWED", {
          caseId: id,
          agreementId: execution.agreementId,
          details: { reportId: report.id, accepted: input.accept },
        });
        notify(
          data,
          obligation.assigneeId,
          id,
          complete
            ? "Majburiyat bajarilgani tasdiqlandi"
            : "Ijro hisoboti ko‘rib chiqildi",
          "execution",
        );
        return report;
      });
      return NextResponse.json({ report });
    }
    if (
      action === "execution" &&
      parts[3] === "followup" &&
      method === "POST"
    ) {
      const input = z
        .object({
          path: z.enum(["RENEGOTIATE", "COURT_INFORMATION"]),
          note: z.string().trim().min(10).max(3000),
        })
        .parse(await jsonBody(request));
      await mutate((data) => {
        const record = requireCase(data, id, user);
        requireParty(record, user);
        if (!record.execution)
          throw new MediationError(404, "Ijro rejasi topilmadi.");
        record.execution.followup = {
          requestedBy: user.id,
          ...input,
          at: new Date().toISOString(),
        };
        audit(data, user.id, "EXECUTION_FOLLOWUP_REQUESTED", {
          caseId: id,
          details: { path: input.path },
        });
        if (input.path === "RENEGOTIATE")
          notifyParticipants(
            data,
            record,
            "Qayta kelishish taklifi",
            "execution",
          );
      });
      return NextResponse.json({
        ok: true,
        source: "https://lex.uz/docs/-3805227#-7791556",
        message:
          input.path === "RENEGOTIATE"
            ? "Mediator bilan qayta kelishish taklifi qayd etildi."
            : "Mediativ kelishuv ijro etilmasa, 29¹-modda bo‘yicha tegishli sudga murojaat qilish tartibini hujjatlar va vakolat asosida mutaxassis bilan baholang.",
      });
    }
    if (action === "agreements" && method === "POST")
      return createAgreement(request, user, mutate, id);
  }

  if (parts[0] === "agreements" && parts[1]) {
    if (parts.length === 2 && method === "GET") {
      const data = await readStore();
      const { agreement } = agreementForUser(data, parts[1], user);
      return NextResponse.json({ agreement: publicAgreement(agreement) });
    }
    if (parts[2] === "versions" && parts.length === 3 && method === "POST")
      return createAgreement(request, user, mutate, undefined, parts[1]);
    if (parts[2] === "versions" && parts[3]) {
      const data = await readStore();
      const { agreement, record } = agreementForUser(data, parts[1], user);
      const version = agreement.versions.find((item) => item.id === parts[3]);
      if (!version) throw new MediationError(404, "Hujjat nusxasi topilmadi.");
      if (parts[4] === "file" && method === "GET") {
        const format =
          request.nextUrl.searchParams.get("format") === "docx"
            ? "docx"
            : "pdf";
        const buffer = await loadDocument(
          format === "pdf" ? version.pdfStorageKey : version.docxStorageKey,
        );
        if (
          digest(buffer) !==
          (format === "pdf" ? version.pdfHash : version.docxHash)
        )
          throw new MediationError(
            409,
            "Hujjat yaxlitligini qayta tekshirish kerak.",
          );
        return new Response(new Uint8Array(buffer), {
          headers: {
            "Content-Type":
              format === "pdf"
                ? "application/pdf"
                : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "Content-Disposition": `${request.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline"}; filename="KELISHUV-${record.number}-v${version.number}.${format}"`,
            "Cache-Control": "no-store",
          },
        });
      }
      if (parts[4] === "review" && method === "POST") {
        const input = z
          .object({
            contentHash: z.string(),
            pagesSeen: z.array(z.number().int().min(0).max(99)).min(1).max(100),
            voluntary: z.literal(true),
          })
          .parse(await jsonBody(request));
        const receipt = await mutate((data) => {
          const { agreement, record } = agreementForUser(data, parts[1], user);
          const fresh = currentVersion(agreement);
          ensureCurrentSigners(data, record, fresh);
          if (
            fresh.id !== version.id ||
            fresh.contentHash !== input.contentHash ||
            ["SIGNED", "SUPERSEDED"].includes(fresh.status)
          )
            throw new MediationError(
              409,
              "Hujjat nusxasi yangilangan yoki qulflangan.",
            );
          if (!fresh.participants.some((party) => party.userId === user.id))
            throw new MediationError(
              403,
              "Hujjat ishtirokchisi bo‘lishingiz kerak.",
            );
          const signature = fresh.signatures.find(
            (item) => item.userId === user.id,
          );
          if (signature) {
            const signedReceipt = fresh.reviews.find(
              (item) => item.id === signature.reviewReceiptId,
            );
            if (!signedReceipt)
              throw new MediationError(409, "Imzolash qaydi topilmadi.");
            return signedReceipt;
          }
          if (
            !Array.from({ length: fresh.pageCount }, (_, index) => index).every(
              (index) => input.pagesSeen.includes(index),
            )
          )
            throw new MediationError(
              400,
              "Hujjatning barcha sahifalarini ko‘rib chiqing.",
            );
          const receipt = {
            id: randomUUID(),
            userId: user.id,
            contentHash: fresh.contentHash,
            pagesSeen: [...new Set(input.pagesSeen)].sort((a, b) => a - b),
            at: new Date().toISOString(),
          };
          fresh.reviews = [
            ...fresh.reviews.filter((item) => item.userId !== user.id),
            receipt,
          ];
          audit(data, user.id, "AGREEMENT_REVIEWED", {
            caseId: record.id,
            agreementId: agreement.id,
            versionId: fresh.id,
            contentHash: fresh.contentHash,
            details: { pages: fresh.pageCount },
          });
          return receipt;
        });
        return NextResponse.json({ receipt });
      }
      if (parts[4] === "sign" && method === "POST")
        return signAgreement(request, user, mutate, agreement.id, version.id);
    }
  }
  return null;
}

async function createAgreement(
  request: NextRequest,
  user: User,
  mutate: Mutate,
  caseId?: string,
  agreementId?: string,
) {
  const input = z
    .object({
      kind: z.enum(["PROCEDURE", "SETTLEMENT"]),
      terms: termsSchema,
      boxes: boxesSchema.optional(),
      participantDetails: z
        .array(
          z.object({
            userId: z.string(),
            address: z.string().trim().min(3).max(1000),
            identityDetails: z.string().trim().min(3).max(1200),
          }),
        )
        .max(3)
        .optional(),
      expectedVersionId: z.string().optional(),
    })
    .parse(await jsonBody(request));
  const data = await readStore();
  const previous = agreementId
    ? agreementForUser(data, agreementId, user).agreement
    : undefined;
  const record = requireCase(data, caseId || previous!.caseId, user);
  const mediator = requireAssignedMediator(data, record, user);
  if (!hasMutualAppointment(record))
    throw new MediationError(
      409,
      "Hujjat yaratishdan avval ikkala taraf mediatorni tanlasin.",
    );
  if (
    previous &&
    (previous.kind !== input.kind ||
      previous.currentVersionId !== input.expectedVersionId)
  )
    throw new MediationError(409, "Joriy hujjat nusxasini yangilang.");
  if (input.boxes) {
    try {
      validateSignatureBoxes(
        input.boxes,
        previous ? currentVersion(previous).pageCount : 100,
      );
    } catch (error) {
      throw new MediationError(400, (error as Error).message);
    }
  }
  if (
    !previous &&
    (data.agreements || []).some(
      (item) => item.caseId === record.id && item.kind === input.kind,
    )
  )
    throw new MediationError(
      409,
      "Ushbu turdagi kelishuv mavjud. Yangi nusxa yaratishdan foydalaning.",
    );
  const participants = caseParticipants(data, record);
  for (const participant of participants)
    if (participant.role !== "MEDIATOR") participant.phone = "";
  for (const participant of participants) {
    const details = input.participantDetails?.find(
      (item) => item.userId === participant.userId,
    );
    if (details) {
      participant.address = details.address;
      participant.identityDetails = details.identityDetails;
    }
  }
  if (input.kind === "SETTLEMENT" && !record.mediation?.procedureDocumentId)
    throw new MediationError(
      409,
      "Avval yozma tartib-taomil kelishuvini rasmiylashtiring.",
    );
  const terms: AgreementTerms = {
    ...input.terms,
    sourceIds: input.terms.sourceIds.filter((id) =>
      LEGAL_SOURCES.some((source) => source.id === id),
    ),
  };
  const version: AgreementVersion = {
    id: randomUUID(),
    number: previous ? currentVersion(previous).number + 1 : 1,
    createdAt: new Date().toISOString(),
    createdBy: user.id,
    kind: input.kind,
    terms,
    participants,
    boxes: input.boxes || [],
    contentHash: "",
    pdfHash: "",
    docxHash: "",
    pdfStorageKey: "",
    docxStorageKey: "",
    pageCount: 0,
    status: "DRAFT",
    signatures: [],
    reviews: [],
    validation: validateAgreementTerms(terms, input.kind, participants),
  };
  const agreement: Agreement = previous
    ? structuredClone(previous)
    : {
        id: randomUUID(),
        caseId: record.id,
        kind: input.kind,
        createdAt: version.createdAt,
        createdBy: user.id,
        currentVersionId: version.id,
        versions: [],
      };
  if (version.validation.some((item) => item.severity === "REQUIRED"))
    throw new MediationError(
      400,
      version.validation
        .filter((item) => item.severity === "REQUIRED")
        .map((item) => item.message)
        .join(" "),
    );
  let rendered = await renderAgreementFiles({
    agreementId: agreement.id,
    version,
  });
  version.boxes = rendered.boxes;
  version.pageCount = rendered.pageCount;
  validateSignatureBoxes(version.boxes, version.pageCount);
  version.contentHash = agreementContentHash(version);
  rendered = await renderAgreementFiles({ agreementId: agreement.id, version });
  version.pageCount = rendered.pageCount;
  const keys = await saveArtifacts(version, rendered);
  try {
    const saved = await mutate((data) => {
      const fresh = requireCase(data, record.id, user);
      const current = requireAssignedMediator(data, fresh, user);
      if (current.id !== mediator.id || !hasMutualAppointment(fresh))
        throw new MediationError(409, "Mediator tanlovi o‘zgargan.");
      if (previous) {
        const target = data.agreements?.find((item) => item.id === previous.id);
        if (!target || target.currentVersionId !== input.expectedVersionId)
          throw new MediationError(409, "Boshqa nusxa avval saqlangan.");
        const old = currentVersion(target);
        if (old.status !== "SIGNED") {
          old.status = "SUPERSEDED";
          old.supersededAt = version.createdAt;
        }
        target.versions.push(version);
        target.currentVersionId = version.id;
      } else {
        if (
          (data.agreements || []).some(
            (item) => item.caseId === record.id && item.kind === input.kind,
          )
        )
          throw new MediationError(409, "Kelishuv avval yaratilgan.");
        agreement.versions.push(version);
        (data.agreements ??= []).push(agreement);
      }
      audit(data, user.id, "AGREEMENT_VERSION_CREATED", {
        caseId: record.id,
        agreementId: agreement.id,
        versionId: version.id,
        contentHash: version.contentHash,
        artifactHash: version.pdfHash,
        details: {
          number: version.number,
          kind: version.kind,
          previousSignaturesRequireRenewal: Boolean(
            previous?.versions.some((item) => item.signatures.length),
          ),
        },
      });
      notifyParticipants(data, fresh, "Kelishuvning yangi nusxasi tayyor");
      return publicAgreement(
        data.agreements!.find((item) => item.id === agreement.id)!,
      );
    });
    return NextResponse.json({ agreement: saved }, { status: 201 });
  } catch (error) {
    await Promise.allSettled(keys.map(removeDocument));
    throw error;
  }
}

async function signAgreement(
  request: NextRequest,
  user: User,
  mutate: Mutate,
  agreementId: string,
  versionId: string,
) {
  const input = z
    .object({
      contentHash: z.string().length(64),
      reviewReceiptId: z.string(),
      voluntary: z.literal(true),
      consentVersion: z.literal(SIGNING_CONSENT_VERSION),
      dataUrl: z.string().max(2_800_000).startsWith("data:image/png;base64,"),
      strokeCount: z.number().int().min(1).max(5000),
      pointCount: z.number().int().min(2).max(300000),
      width: z.number().int().min(32).max(4096),
      height: z.number().int().min(16).max(2048),
    })
    .parse(
      JSON.parse(
        (await boundedBody(request, 3 * 1024 * 1024)).toString("utf8"),
      ),
    );
  const encoded = input.dataUrl.slice("data:image/png;base64,".length);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))
    throw new MediationError(400, "Imzo PNG shaklida bo‘lsin.");
  const png = Buffer.from(encoded, "base64");
  await validateSignaturePng(png).catch(() => {
    throw new MediationError(
      400,
      "Imzo tasviri o‘qilmadi yoki o‘lchami mos emas.",
    );
  });
  const before = await readStore();
  const { agreement, record } = agreementForUser(before, agreementId, user);
  const version = currentVersion(agreement);
  ensureCurrentSigners(before, record, version);
  if (version.id !== versionId || version.contentHash !== input.contentHash)
    throw new MediationError(
      409,
      "Hujjat o‘zgargan. Yangi nusxani o‘qing va qayta imzolang.",
    );
  const signer = version.participants.find((party) => party.userId === user.id);
  if (!signer)
    throw new MediationError(
      403,
      "O‘z hisobingizdagi imzo joyidan foydalaning.",
    );
  const previousSignature = version.signatures.find(
    (signature) => signature.userId === user.id,
  );
  if (previousSignature) {
    if (previousSignature.imageHash !== digest(png))
      throw new MediationError(409, "Bu nusxada imzo avval qayd etilgan.");
    return NextResponse.json({ agreement: publicAgreement(agreement) });
  }
  if (
    ["SIGNED", "SUPERSEDED"].includes(version.status) ||
    SIGNER_ROLES[version.signatures.length] !== signer.role
  )
    throw new MediationError(409, "Imzolash navbati boshqa ishtirokchida.");
  const receipt = version.reviews.find(
    (review) =>
      review.id === input.reviewReceiptId &&
      review.userId === user.id &&
      review.contentHash === version.contentHash,
  );
  if (!receipt)
    throw new MediationError(
      400,
      "Avval hujjatning barcha sahifalarini o‘qib tasdiqlang.",
    );
  const updated = structuredClone(version);
  const signatureKey = randomUUID();
  const now = new Date().toISOString();
  updated.signatures.push({
    id: randomUUID(),
    userId: user.id,
    role: signer.role,
    fullName: signer.fullName,
    method: "HANDWRITTEN",
    pngStorageKey: signatureKey,
    imageHash: digest(png),
    contentHash: version.contentHash,
    reviewReceiptId: receipt.id,
    signedAt: now,
    consentVersion: SIGNING_CONSENT_VERSION,
    strokeCount: input.strokeCount,
    pointCount: input.pointCount,
    canvasWidth: input.width,
    canvasHeight: input.height,
  });
  updated.status = updated.signatures.length === 3 ? "SIGNED" : "SIGNING";
  if (updated.status === "SIGNED") updated.lockedAt = now;
  const images: Partial<Record<SignerRole, Uint8Array>> = {};
  for (const signature of version.signatures)
    images[signature.role] = await loadDocument(signature.pngStorageKey);
  images[signer.role] = png;
  const files = await renderAgreementFiles({
    agreementId,
    version: updated,
    signatureImages: images,
  });
  await saveDocument(signatureKey, png);
  let keys: string[] = [];
  try {
    keys = await saveArtifacts(updated, files);
    const result = await mutate((data) => {
      const { agreement, record } = agreementForUser(data, agreementId, user);
      const fresh = currentVersion(agreement);
      ensureCurrentSigners(data, record, fresh);
      if (
        fresh.id !== versionId ||
        fresh.contentHash !== input.contentHash ||
        fresh.pdfHash !== version.pdfHash ||
        fresh.signatures.length !== version.signatures.length ||
        !fresh.reviews.some(
          (review) =>
            review.id === input.reviewReceiptId && review.userId === user.id,
        )
      )
        throw new MediationError(
          409,
          "Hujjat yoki imzolash holati o‘zgargan. Sahifani yangilang.",
        );
      Object.assign(fresh, { ...updated, reviews: fresh.reviews });
      audit(data, user.id, "AGREEMENT_SIGNED", {
        caseId: record.id,
        agreementId,
        versionId,
        contentHash: fresh.contentHash,
        artifactHash: fresh.pdfHash,
        details: {
          role: signer.role,
          method: "HANDWRITTEN",
          signatureHash: digest(png),
        },
      });
      if (fresh.status === "SIGNED") {
        const documentId = randomUUID();
        record.documents.push({
          id: documentId,
          name: `KELISHUV-${record.number}-${fresh.kind}-v${fresh.number}.pdf`,
          size: files.pdf.length,
          mime: "application/pdf",
          uploadedAt: now,
          storageKey: fresh.pdfStorageKey,
          uploadedBy: fresh.createdBy,
          kind:
            fresh.kind === "PROCEDURE" ? "PROCEDURE_AGREEMENT" : "SETTLEMENT",
          visibility: "PARTIES",
        });
        if (record.mediation) {
          if (fresh.kind === "PROCEDURE") {
            record.mediation.procedureDocumentId = documentId;
            recordEvent(
              record,
              "Uch ishtirokchi yozma tartib-taomil kelishuvini imzoladi",
              record.execution
                ? record.status
                : data.sessions.some(
                      (session) =>
                        session.caseId === record.id &&
                        session.status === "SCHEDULED",
                    )
                  ? "SESSION_SCHEDULED"
                  : "IN_PROGRESS",
            );
          } else {
            record.mediation.settlementDocumentId = documentId;
            const wasResolved = record.status === "RESOLVED";
            if (record.execution && record.execution.versionId !== fresh.id)
              (record.executionHistory ??= []).push(record.execution);
            record.execution = createExecution(record, agreement, fresh);
            recordEvent(
              record,
              "Taraflar imzosi va mediator tasdig‘i bilan mediativ kelishuv saqlandi",
              "RESOLVED",
            );
            for (const session of data.sessions.filter(
              (session) =>
                session.caseId === record.id && session.status === "SCHEDULED",
            )) {
              session.status = "COMPLETED";
              session.notes = "KELISHUV AI imzolangan mediativ kelishuv";
            }
            const mediator =
              record.mediatorId &&
              data.mediators.find(
                (mediator) => mediator.id === record.mediatorId,
              );
            if (mediator && !wasResolved) mediator.casesResolved += 1;
          }
        }
        audit(data, user.id, "AGREEMENT_LOCKED", {
          caseId: record.id,
          agreementId,
          versionId,
          contentHash: fresh.contentHash,
          artifactHash: fresh.pdfHash,
          details: { signatures: 3 },
        });
        notifyParticipants(
          data,
          record,
          fresh.kind === "SETTLEMENT"
            ? "Kelishuv imzolandi, ijro rejasi tayyor"
            : "Tartib-taomil kelishuvi imzolandi",
          fresh.kind === "SETTLEMENT" ? "execution" : "agreement",
        );
      } else {
        const nextRole = SIGNER_ROLES[fresh.signatures.length];
        const next = fresh.participants.find(
          (party) => party.role === nextRole,
        );
        if (next)
          notify(
            data,
            next.userId,
            record.id,
            "Kelishuvni imzolash navbati sizda",
          );
      }
      return publicAgreement(agreement);
    });
    return NextResponse.json({ agreement: result });
  } catch (error) {
    await Promise.allSettled([...keys, signatureKey].map(removeDocument));
    throw error;
  }
}
