import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readStore } from "./store";
import { documentForm, jsonBody } from "./api-request";
import { loadDocument, removeDocument, saveDocument } from "./documents";
import { mediationFee } from "./legal";
import { assessLegalRoutes } from "./legal-routing";
import { negotiationState } from "./negotiation";
import { applicationOrigin, sendSms, serviceStatus } from "./service-providers";
import { normalizePhone as accountPhone } from "./service-catalog";
import { withinRateLimit } from "./rate-limit";
import type { SmsDelivery } from "./service-types";
import {
  CONSENT_VERSION,
  COMMISSION_PERCENT,
  MediationError,
  caseForViewer,
  hasBothConsents,
  hasMutualAppointment,
  isParty,
  normalizePhone,
  queueEligible,
  recordEvent,
  requireAssignedMediator,
  requireCase,
  setUserPhone,
} from "./mediation";
import {
  REGIONS,
  TYPE_LABELS,
  type AppData,
  type CaseDocument,
  type CaseRecord,
  type User,
} from "./types";

type Mutate = <T>(operation: (data: AppData) => T) => Promise<T>;
const specialization = z.enum([
  "MEHNAT",
  "SHARTNOMA",
  "QOSHNI",
  "OILA",
  "ISTE_MOLCHI",
  "BIZNES",
  "YER_MULK",
  "BOSHQA",
]);
const registryUrl = z
  .string()
  .url()
  .max(500)
  .refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "gov.uz" || url.hostname.endsWith(".gov.uz"))
    );
  }, "Rasmiy gov.uz reyestr havolasini kiriting.");
const applicationSchema = z.object({
  certNumber: z.string().trim().min(3).max(80),
  registryUrl,
  specializations: z.array(specialization).min(1).max(8),
  experience: z.number().int().min(0).max(70),
  bio: z.string().trim().min(20).max(2000),
  phone: z.string().transform(normalizePhone),
  city: z.string().trim().min(2).max(100),
  region: z.string().refine((value) => REGIONS.includes(value)),
});

function notification(
  data: AppData,
  userId: string,
  title: string,
  body: string,
  caseId: string,
) {
  data.notifications.unshift({
    id: randomUUID(),
    userId,
    title,
    body,
    href: `/dashboard/cases/${caseId}`,
    read: false,
    createdAt: new Date().toISOString(),
  });
}

function notifyParties(
  data: AppData,
  record: CaseRecord,
  title: string,
  body: string,
) {
  for (const userId of [record.userId, record.mediation?.respondentId])
    if (userId) notification(data, userId, title, body, record.id);
}

function findInvitation(data: AppData, token: string) {
  if (!/^[a-f0-9]{64}$/.test(token))
    throw new MediationError(404, "Taklif topilmadi.");
  const hash = createHash("sha256").update(token).digest("hex");
  const record = data.cases.find(
    (item) => item.mediation?.invitationHash === hash,
  );
  if (
    !record ||
    Date.parse(record.mediation?.invitationExpiresAt || "") <= Date.now()
  )
    throw new MediationError(
      410,
      "Taklif muddati tugagan. Murojaatchidan yangi havola oling.",
    );
  return record;
}
function canDispatchSms(delivery: SmsDelivery | undefined) {
  return Boolean(
    delivery &&
    delivery.status !== "ACCEPTED" &&
    (delivery.attempts || 0) < 3 &&
    (!delivery.attemptStartedAt ||
      Date.parse(delivery.attemptStartedAt) <= Date.now() - 60000),
  );
}

export async function publicInvitation(
  request: NextRequest,
): Promise<Response | null> {
  const match = /^\/api\/invitations\/([a-f0-9]{64})$/.exec(
    request.nextUrl.pathname,
  );
  if (!match || request.method !== "GET") return null;
  const record = findInvitation(await readStore(), match[1]);
  const email = record.mediation?.invitedEmail || "";
  return NextResponse.json(
    {
      number: record.number,
      type: record.type,
      city: record.city,
      region: record.region,
      emailHint: email.replace(/^(.).+(@.*)$/, "$1***$2"),
      phoneHint: record.mediation?.invitedPhone?.replace(
        /^(\+998)\d{7}(\d{2})$/,
        "$1*******$2",
      ),
      expiresAt: record.mediation?.invitationExpiresAt,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

function ensureParty(record: CaseRecord, user: User) {
  if (!isParty(record, user.id))
    throw new MediationError(403, "Ushbu amalni nizo tarafi bajaradi.");
}

function ensureOpen(record: CaseRecord) {
  if (["RESOLVED", "CLOSED", "ESCALATED"].includes(record.status))
    throw new MediationError(
      409,
      "Nizo yakunlangan. Ushbu bosqichni o‘zgartirib bo‘lmaydi.",
    );
}

export async function handleMediationRequest(
  request: NextRequest,
  user: User,
  mutate: Mutate,
): Promise<Response | null> {
  const parts = request.nextUrl.pathname.replace(/^\/api\//, "").split("/");
  const route = parts.join("/");
  const method = request.method;

  if (route === "mediator/application" && method === "GET") {
    if (user.role !== "MEDIATOR")
      throw new MediationError(403, "Mediator hisobi kerak.");
    const current = (await readStore()).users.find(
      (item) => item.id === user.id,
    )!;
    return NextResponse.json({
      application: current.mediatorApplication || null,
    });
  }
  if (route === "mediator/application" && method === "POST") {
    if (user.role !== "MEDIATOR")
      throw new MediationError(403, "Mediator hisobi kerak.");
    const input = applicationSchema.parse(await jsonBody(request));
    const application = await mutate((data) => {
      if (data.mediators.some((item) => item.userId === user.id))
        throw new MediationError(
          409,
          "Profil tasdiqlangan. O‘zgartirish uchun administratorga murojaat qiling.",
        );
      const target = data.users.find((item) => item.id === user.id)!;
      target.phone = input.phone;
      target.city = input.city;
      target.region = input.region;
      target.mediatorApplication = {
        revision: randomUUID(),
        certNumber: input.certNumber,
        registryUrl: input.registryUrl,
        specializations: [...new Set(input.specializations)],
        experience: input.experience,
        bio: input.bio,
        status: "PENDING",
        submittedAt: new Date().toISOString(),
        documents: target.mediatorApplication?.documents || [],
      };
      return target.mediatorApplication;
    });
    return NextResponse.json({ application });
  }
  if (route === "mediator/application/documents" && method === "POST") {
    if (user.role !== "MEDIATOR")
      throw new MediationError(403, "Mediator hisobi kerak.");
    const { file, mime } = await documentForm(request);
    const storageKey = randomUUID();
    await saveDocument(storageKey, Buffer.from(await file.arrayBuffer()));
    try {
      const document = await mutate((data) => {
        const application = data.users.find(
          (item) => item.id === user.id,
        )!.mediatorApplication;
        if (!application || application.status !== "PENDING")
          throw new MediationError(409, "Avval mediator arizasini yuboring.");
        const document: CaseDocument = {
          id: randomUUID(),
          name: path.basename(file.name).slice(0, 200),
          size: file.size,
          mime,
          storageKey,
          uploadedAt: new Date().toISOString(),
          uploadedBy: user.id,
          kind: "CERTIFICATE",
        };
        application.documents.push(document);
        application.revision = randomUUID();
        return { ...document, storageKey: "" };
      });
      return NextResponse.json({ document }, { status: 201 });
    } catch (error) {
      await removeDocument(storageKey).catch(() => undefined);
      throw error;
    }
  }
  if (
    parts[0] === "mediator-applications" &&
    parts[1] &&
    parts[2] === "documents" &&
    parts[3] &&
    method === "GET"
  ) {
    if (user.id !== parts[1] && user.role !== "ADMIN")
      throw new MediationError(404, "Hujjat topilmadi.");
    const target = (await readStore()).users.find(
      (item) => item.id === parts[1],
    );
    const document = target?.mediatorApplication?.documents.find(
      (item) => item.id === parts[3],
    );
    if (!document) throw new MediationError(404, "Hujjat topilmadi.");
    return new Response(
      new Uint8Array(await loadDocument(document.storageKey)),
      {
        headers: {
          "Content-Type": document.mime,
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(document.name)}`,
          "Cache-Control": "no-store",
        },
      },
    );
  }
  if (route === "admin/mediators" && method === "POST") {
    if (user.role !== "ADMIN")
      throw new MediationError(403, "Administrator vakolati kerak.");
    const input = z
      .object({
        userId: z.string(),
        applicationRevision: z.string().min(16).max(100),
        registryChecked: z.literal(true),
        reviewNote: z.string().trim().min(10).max(2000),
        hourlyRate: z.number().int().min(0).max(10000000).default(200000),
      })
      .parse(await jsonBody(request));
    const mediator = await mutate((data) => {
      const target = data.users.find(
        (item) =>
          item.id === input.userId && item.role === "MEDIATOR" && item.isActive,
      );
      const application = target?.mediatorApplication;
      if (
        !target ||
        !application ||
        application.status !== "PENDING" ||
        !application.documents.length
      )
        throw new MediationError(
          400,
          "Tasdiqlash uchun faol mediator hisobi, ariza va guvohnoma fayli kerak.",
        );
      if (application.revision !== input.applicationRevision)
        throw new MediationError(
          409,
          "Ariza yangilangan. Yangi nusxani ochib, qayta tekshiring.",
        );
      applicationSchema.parse({
        ...application,
        phone: target.phone,
        city: target.city,
        region: target.region,
      });
      if (
        data.mediators.some(
          (item) =>
            item.userId === target.id ||
            item.certNumber.toLowerCase() ===
              application.certNumber.toLowerCase(),
        )
      )
        throw new MediationError(409, "Profil yoki guvohnoma raqami mavjud.");
      const now = new Date().toISOString();
      const mediator = {
        id: randomUUID(),
        userId: target.id,
        name: target.fullName,
        title: "Professional mediator",
        image: "/favicon.svg",
        region: target.region,
        city: target.city,
        registryUrl: application.registryUrl,
        registryCheckedAt: now,
        specializations: application.specializations,
        rating: 0,
        casesResolved: 0,
        experience: application.experience,
        hourlyRate: input.hourlyRate,
        certNumber: application.certNumber,
        isOnline: false,
        bio: application.bio,
        languages: ["O‘zbek"],
        demo: false,
      };
      data.mediators.push(mediator);
      application.status = "APPROVED";
      application.reviewedAt = now;
      application.reviewNote = input.reviewNote;
      return mediator;
    });
    return NextResponse.json({ mediator }, { status: 201 });
  }
  if (
    parts[0] === "admin" &&
    parts[1] === "applications" &&
    parts[2] &&
    method === "PUT"
  ) {
    if (user.role !== "ADMIN")
      throw new MediationError(403, "Administrator vakolati kerak.");
    const input = z
      .object({
        reviewNote: z.string().trim().min(10).max(2000),
        applicationRevision: z.string().min(16).max(100),
      })
      .parse(await jsonBody(request));
    await mutate((data) => {
      const application = data.users.find(
        (item) => item.id === parts[2],
      )?.mediatorApplication;
      if (!application || application.status !== "PENDING")
        throw new MediationError(409, "Kutilayotgan ariza topilmadi.");
      if (application.revision !== input.applicationRevision)
        throw new MediationError(
          409,
          "Ariza yangilangan. Yangi nusxani ochib, qayta tekshiring.",
        );
      application.status = "REJECTED";
      application.reviewNote = input.reviewNote;
      application.reviewedAt = new Date().toISOString();
    });
    return NextResponse.json({ ok: true });
  }
  if (
    parts[0] === "admin" &&
    parts[1] === "payments" &&
    parts[2] &&
    parts[3] === "commission" &&
    method === "POST"
  ) {
    if (user.role !== "ADMIN")
      throw new MediationError(403, "Administrator vakolati kerak.");
    const input = z
      .object({ reference: z.string().trim().min(3).max(200) })
      .parse(await jsonBody(request));
    const payment = await mutate((data) => {
      const payment = data.payments?.find((item) => item.id === parts[2]);
      if (!payment) throw new MediationError(404, "To‘lov qaydi topilmadi.");
      if (payment.commissionStatus === "SETTLED") {
        if (payment.commissionReference !== input.reference)
          throw new MediationError(409, "Komissiya avval tasdiqlangan.");
        return payment;
      }
      payment.commissionStatus = "SETTLED";
      payment.commissionReference = input.reference;
      payment.commissionConfirmedAt = new Date().toISOString();
      payment.commissionConfirmedBy = user.id;
      return payment;
    });
    return NextResponse.json({ payment });
  }
  if (
    parts[0] === "invitations" &&
    parts[1] &&
    parts[2] === "join" &&
    method === "POST"
  ) {
    const record = await mutate((data) => {
      const record = findInvitation(data, parts[1]);
      const flow = record.mediation!;
      ensureOpen(record);
      if (user.id === record.userId)
        throw new MediationError(
          400,
          "Taklifni ikkinchi taraf alohida hisobdan qabul qiladi.",
        );
      const current = data.users.find((item) => item.id === user.id)!;
      const matches = flow.invitedPhone
        ? Boolean(
            current.phoneVerifiedAt &&
            accountPhone(current.phone) === flow.invitedPhone,
          )
        : flow.invitedEmail === current.email.toLowerCase();
      if (!matches)
        throw new MediationError(
          403,
          flow.invitedPhone
            ? "Taklifdagi telefonni profilingizda SMS orqali tasdiqlang va shu hisobdan qo‘shiling."
            : "Ushbu taklif uchun ko‘rsatilgan emaildagi hisobga kiring.",
        );
      if (flow.respondentId && flow.respondentId !== user.id)
        throw new MediationError(409, "Taklif allaqachon qabul qilingan.");
      if (!flow.respondentId) {
        flow.respondentId = user.id;
        recordEvent(
          record,
          "Ikkinchi taraf taklifga alohida hisobdan qo‘shildi",
        );
      }
      return caseForViewer(data, record, user);
    });
    return NextResponse.json({ case: record });
  }
  if (parts[0] !== "cases" || !parts[1]) return null;
  const id = parts[1];
  const action = parts[2];
  if (
    ![
      "invitation",
      "consent",
      "position",
      "mediator-approval",
      "procedure",
      "settlement",
      "calls",
      "review",
      "payment",
      "dossier",
    ].includes(action)
  )
    return null;

  if (action === "dossier" && method === "GET") {
    const data = await readStore();
    const record = requireCase(data, id, user);
    const contactsVisible =
      user.role === "ADMIN" ||
      (user.role === "MEDIATOR" &&
        !isParty(record, user.id) &&
        hasBothConsents(record));
    const parties = [record.userId, record.mediation?.respondentId]
      .filter(Boolean)
      .map((userId) => {
        const party = data.users.find((item) => item.id === userId);
        const consent =
          userId === record.userId
            ? record.mediation?.initiatorConsent
            : record.mediation?.respondentConsent;
        return {
          id: userId,
          name: party?.fullName || "Taraf",
          role: userId === record.userId ? "Murojaatchi" : "Ikkinchi taraf",
          phone:
            contactsVisible || userId === user.id
              ? consent?.phone || party?.phone || ""
              : "",
          demo: Boolean(party?.id.startsWith("demo-")),
        };
      });
    return NextResponse.json({
      parties,
      payment: data.payments?.find((item) => item.caseId === id) || null,
      fees: mediationFee(record.claimAmount),
    });
  }
  if (method !== "POST") return null;
  const input = await jsonBody(request);

  if (action === "invitation") {
    const values = z
      .object({
        email: z
          .string()
          .email()
          .max(200)
          .transform((value) => value.toLowerCase())
          .optional(),
        phone: z.string().max(30).optional(),
        requestId: z.string().uuid().optional(),
        name: z.string().trim().min(2).max(100),
        city: z.string().trim().min(2).max(100),
      })
      .refine(
        (value) => Boolean(value.email) !== Boolean(value.phone),
        "Telefon yoki emaildan birini tanlang.",
      )
      .parse(input);
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
    const invitation = await mutate((data) => {
      const record = requireCase(data, id, user);
      if (record.userId !== user.id)
        throw new MediationError(403, "Taklifni murojaatchi yaratadi.");
      ensureOpen(record);
      if (
        values.requestId &&
        record.mediation?.invitationRequestId === values.requestId &&
        record.mediation.invitationToken
      ) {
        if (
          record.mediation.invitedEmail !== values.email ||
          record.mediation.invitedPhone !==
            (values.phone ? normalizePhone(values.phone) : undefined) ||
          record.mediation.invitedName !== values.name ||
          record.city !== values.city
        )
          throw new MediationError(409, "Taklif ma’lumotlari o‘zgargan.");
        const delivery = data.smsDeliveries?.find(
          (item) => item.id === record.mediation!.smsDeliveryId,
        );
        return {
          token: record.mediation.invitationToken,
          expiresAt: record.mediation.invitationExpiresAt!,
          deliveryId: record.mediation.smsDeliveryId,
          shouldSend: Boolean(
            !record.mediation.respondentId &&
            serviceStatus().sms &&
            canDispatchSms(delivery) &&
            Date.parse(record.mediation.invitationExpiresAt || "") > Date.now(),
          ),
        };
      }
      if (values.email === user.email.toLowerCase())
        throw new MediationError(
          400,
          "Ikkinchi tarafning alohida emailini kiriting.",
        );
      const activeDelivery = data.smsDeliveries?.find(
        (item) => item.id === record.mediation?.smsDeliveryId,
      );
      if (
        activeDelivery?.status === "SENDING" &&
        Date.parse(
          activeDelivery.attemptStartedAt || activeDelivery.createdAt,
        ) >
          Date.now() - 60000
      )
        throw new MediationError(
          409,
          "SMS taklifi yuborilmoqda. Yangi havola yaratishdan oldin bir daqiqa kuting.",
        );
      const phone = values.phone ? normalizePhone(values.phone) : undefined;
      if (phone && accountPhone(user.phone) === phone)
        throw new MediationError(
          400,
          "Ikkinchi tarafning telefon raqamini kiriting.",
        );
      if (record.mediation?.respondentId || record.mediatorId)
        throw new MediationError(
          409,
          "Ikkinchi taraf qo‘shilgan yoki mediator biriktirilgan.",
        );
      record.guidance = assessLegalRoutes(
        record.type,
        record.description,
        record.routingFacts,
      );
      if (
        record.analysis.criminal ||
        record.guidance.options.find((item) => item.id === "MEDIATION")
          ?.availability === "UNSUITABLE"
      )
        throw new MediationError(
          400,
          "Ushbu holat bo‘yicha huquqiy yo‘naltirishni mutaxassis bilan ko‘rib chiqing.",
        );
      record.city = values.city;
      record.chosenSolution = "MEDIATION";
      record.mediation ??= { version: 2, mediatorApprovals: [], calls: [] };
      Object.assign(record.mediation, {
        invitedEmail: values.email,
        invitedPhone: phone,
        smsDeliveryId: undefined,
        invitedName: values.name,
        invitationHash: createHash("sha256").update(token).digest("hex"),
        invitationToken: token,
        invitationRequestId: values.requestId,
        invitationExpiresAt: expiresAt,
      });
      recordEvent(
        record,
        "Ikkinchi taraf uchun 7 kunlik shaxsiy taklif yaratildi",
        "AWAITING_CONSENT",
      );
      const delivery = phone
        ? {
            id: randomUUID(),
            caseId: record.id,
            userId: user.id,
            status: serviceStatus().sms
              ? ("SENDING" as const)
              : ("UNCONFIGURED" as const),
            createdAt: new Date().toISOString(),
          }
        : undefined;
      if (delivery) {
        (data.smsDeliveries ??= []).push(delivery);
        record.mediation.smsDeliveryId = delivery.id;
      }
      return {
        token,
        expiresAt,
        deliveryId: delivery?.id,
        shouldSend: Boolean(delivery && serviceStatus().sms),
      };
    });
    if (invitation.shouldSend && invitation.deliveryId && values.phone) {
      const allowed = await withinRateLimit(`invitation-sms:${user.id}`, 3);
      const attemptId = randomUUID();
      const claimed = await mutate((data) => {
        const delivery = data.smsDeliveries?.find(
          (item) => item.id === invitation.deliveryId,
        );
        const record = requireCase(data, id, user);
        if (
          !delivery ||
          record.mediation?.smsDeliveryId !== delivery.id ||
          !canDispatchSms(delivery)
        )
          return false;
        if (!allowed) {
          delivery.status = "FAILED";
          return false;
        }
        delivery.attemptId = attemptId;
        delivery.attemptStartedAt = new Date().toISOString();
        delivery.attempts = (delivery.attempts || 0) + 1;
        delivery.status = "SENDING";
        return true;
      });
      if (claimed) {
        try {
          await mutate((data) => {
            const record = requireCase(data, id, user);
            const delivery = data.smsDeliveries?.find(
              (item) => item.id === invitation.deliveryId,
            );
            if (
              record.mediation?.invitationToken !== invitation.token ||
              delivery?.attemptId !== attemptId ||
              Date.parse(delivery.attemptStartedAt || "") < Date.now() - 30000
            )
              throw new MediationError(
                409,
                "Taklif yoki SMS so‘rovi yangilangan.",
              );
          });
          const providerId = await sendSms(
            normalizePhone(values.phone),
            `Siz Kelishuv platformasiga taklif qilindingiz. Shaxsiy havola 7 kun amal qiladi: ${applicationOrigin(request)}/invite/${invitation.token}`,
            invitation.deliveryId,
          );
          await mutate((data) => {
            const delivery = data.smsDeliveries?.find(
              (item) => item.id === invitation.deliveryId,
            );
            if (delivery) {
              // Each attempt sends the same immutable invitation. Acceptance is terminal.
              delivery.status = "ACCEPTED";
              delivery.providerId ||= providerId;
            }
          });
        } catch {
          await mutate((data) => {
            const delivery = data.smsDeliveries?.find(
              (item) => item.id === invitation.deliveryId,
            );
            if (delivery?.attemptId === attemptId && delivery.status !== "ACCEPTED") delivery.status = "UNKNOWN";
          });
        }
      }
    }
    const delivery = (await readStore()).smsDeliveries?.find(
      (item) => item.id === invitation.deliveryId,
    );
    return NextResponse.json({
      invitationUrl: `/invite/${invitation.token}`,
      expiresAt: invitation.expiresAt,
      smsStatus: delivery?.status || null,
    });
  }

  const result = await mutate((data) => {
    const record = requireCase(data, id, user);
    const flow = record.mediation;
    if (!flow)
      throw new MediationError(
        409,
        "Avval ikkinchi taraf uchun taklif yarating.",
      );

    if (action === "position") {
      ensureParty(record, user);
      ensureOpen(record);
      const values = z
        .object({ statement: z.string().trim().min(20).max(10000) })
        .parse(input);
      if (user.id !== flow.respondentId)
        throw new MediationError(403, "Bu bayonni ikkinchi taraf yozadi.");
      flow.respondentStatement = values.statement;
      const position = record.positions?.find(
        (item) => item.userId === user.id,
      );
      if (position) {
        position.sharedStatement = values.statement;
        position.updatedAt = new Date().toISOString();
      }
      recordEvent(record, "Ikkinchi taraf o‘z bayonini saqladi");
    }
    if (action === "consent") {
      ensureParty(record, user);
      ensureOpen(record);
      const values = z
        .object({
          agree: z.boolean(),
          phone: z.string().max(30).optional(),
          textVersion: z.string().optional(),
        })
        .parse(input);
      const key =
        record.userId === user.id ? "initiatorConsent" : "respondentConsent";
      if (values.agree) {
        if (record.chosenSolution !== "MEDIATION")
          throw new MediationError(409, "Avval mediatsiya yo‘lini tanlang.");
        if (values.textVersion !== CONSENT_VERSION)
          throw new MediationError(
            409,
            "Rozilik matni yangilangan. Sahifani yangilang.",
          );
        if (key === "respondentConsent" && !flow.respondentStatement)
          throw new MediationError(400, "Avval o‘z bayoningizni kiriting.");
        if (!record.city)
          throw new MediationError(
            400,
            "Mediatsiya shahri ko‘rsatilishi kerak.",
          );
        const phone = normalizePhone(values.phone || "");
        flow[key] = {
          userId: user.id,
          phone,
          textVersion: CONSENT_VERSION,
          at: new Date().toISOString(),
        };
        setUserPhone(
          data,
          data.users.find((item) => item.id === user.id)!,
          phone,
        );
        if (hasBothConsents(record)) {
          const negotiation = negotiationState(record);
          if (
            record.journeyVersion === 3 &&
            !negotiation.exhausted &&
            !negotiation.agreed &&
            !record.mediatorId
          ) {
            flow.publishedAt = undefined;
            recordEvent(
              record,
              "Ikkala taraf rozilik berdi. Navbatma-navbat AI takliflari muhokamasi ochildi.",
              "IN_PROGRESS",
            );
            return caseForViewer(data, record, user);
          }
          const firstPublication = !flow.publishedAt;
          flow.publishedAt = new Date().toISOString();
          recordEvent(
            record,
            "Ikkala taraf rozilik berdi, shahar bo‘yicha mediatorlar navbatiga ochildi",
            record.mediatorId ? record.status : "OPEN_FOR_MEDIATORS",
          );
          if (firstPublication && !record.mediatorId) {
            for (const mediator of data.mediators.filter((item) =>
              queueEligible(data, record, item),
            ))
              data.notifications.unshift({
                id: randomUUID(),
                userId: mediator.userId,
                title: "Shahringizda yangi so‘rov",
                body: `${TYPE_LABELS[record.type]} · ${record.city}`,
                href: "/mediator/cases",
                read: false,
                createdAt: record.updatedAt,
              });
          }
        } else
          recordEvent(
            record,
            "Taraf mediatorga yo‘naltirishga rozilik berdi",
            "AWAITING_CONSENT",
          );
      } else {
        delete flow[key];
        delete flow.publishedAt;
        flow.mediatorApprovals = [];
        delete flow.procedureDocumentId;
        delete record.mediatorId;
        for (const session of data.sessions.filter(
          (item) => item.caseId === id && item.status === "SCHEDULED",
        ))
          session.status = "CANCELLED";
        recordEvent(
          record,
          "Taraf roziligini qaytarib oldi, mediatorga kirish yopildi",
          "CONSENT_WITHDRAWN",
        );
        notifyParties(
          data,
          record,
          "Rozilik qaytarib olindi",
          "Mediatsiyaga yo‘naltirish to‘xtatildi.",
        );
      }
    }
    if (action === "mediator-approval") {
      ensureParty(record, user);
      ensureOpen(record);
      const values = z
        .object({ mediatorId: z.string(), agree: z.literal(true) })
        .parse(input);
      if (!hasBothConsents(record) || record.mediatorId !== values.mediatorId)
        throw new MediationError(
          409,
          "Qabul qilgan mediator va ikkala rozilik kerak.",
        );
      if (
        !flow.mediatorApprovals.some(
          (item) =>
            item.userId === user.id && item.mediatorId === values.mediatorId,
        )
      ) {
        flow.mediatorApprovals.push({
          userId: user.id,
          mediatorId: values.mediatorId,
          at: new Date().toISOString(),
        });
        recordEvent(
          record,
          "Taraf qabul qilgan mediatorni tanlaganini tasdiqladi",
        );
      }
    }
    if (action === "calls") {
      const mediator = requireAssignedMediator(data, record, user);
      ensureOpen(record);
      const values = z
        .object({
          partyId: z.string(),
          outcome: z.enum(["SPOKE", "NO_ANSWER", "SCHEDULED"]),
          note: z.string().trim().min(3).max(2000),
        })
        .parse(input);
      if (!isParty(record, values.partyId))
        throw new MediationError(400, "Nizo tarafini tanlang.");
      flow.calls.push({
        id: randomUUID(),
        mediatorId: mediator.id,
        ...values,
        at: new Date().toISOString(),
      });
      recordEvent(record, "Mediator taraf bilan aloqa natijasini qayd etdi");
    }
    if (action === "review") {
      requireAssignedMediator(data, record, user);
      ensureOpen(record);
      const values = z
        .object({
          agreedPoints: z.string().trim().min(3).max(4000),
          disputedPoints: z.string().trim().min(3).max(4000),
          actionPlan: z.string().trim().min(20).max(5000),
        })
        .parse(input);
      Object.assign(flow, values);
      recordEvent(record, "Mediator hujjatlar ko‘rigi va ish rejasini saqladi");
    }
    if (action === "procedure" || action === "settlement") {
      if (record.journeyVersion === 3)
        throw new MediationError(
          409,
          "Kelishuv ish maydonida uch ishtirokchining mustaqil imzosi bilan rasmiylashtiriladi.",
        );
      const mediator = requireAssignedMediator(data, record, user);
      ensureOpen(record);
      const values = z
        .object({
          documentId: z.string(),
          signedByParties: z.literal(true),
          mediatorApproved: z.literal(true),
          notes: z.string().trim().min(20).max(5000),
        })
        .parse(input);
      if (!hasMutualAppointment(record))
        throw new MediationError(
          409,
          "Ikkala taraf ushbu mediatorni tanlaganini tasdiqlashi kerak.",
        );
      const kind =
        action === "procedure" ? "PROCEDURE_AGREEMENT" : "SETTLEMENT";
      const document = record.documents.find(
        (item) =>
          item.id === values.documentId &&
          item.kind === kind &&
          item.visibility === "PARTIES" &&
          item.uploadedBy === user.id,
      );
      if (!document)
        throw new MediationError(
          400,
          "Mediator yuklagan, ikkala tarafga ochilgan tegishli kelishuv faylini tanlang.",
        );
      if (action === "procedure") {
        if (flow.procedureDocumentId === document.id)
          return caseForViewer(data, record, user);
        flow.procedureDocumentId = document.id;
        recordEvent(
          record,
          `Yozma tartib-taomil kelishuvi qayd etildi. ${values.notes}`,
          data.sessions.some(
            (session) =>
              session.caseId === id && session.status === "SCHEDULED",
          )
            ? "SESSION_SCHEDULED"
            : "IN_PROGRESS",
        );
      } else {
        if (!flow.procedureDocumentId)
          throw new MediationError(
            409,
            "Avval yozma tartib-taomil kelishuvini qayd eting.",
          );
        flow.settlementDocumentId = document.id;
        recordEvent(
          record,
          `Taraflar imzolagan, mediator tasdiqlagan mediativ kelishuv qayd etildi. ${values.notes}`,
          "RESOLVED",
        );
        for (const session of data.sessions.filter(
          (item) => item.caseId === id && item.status === "SCHEDULED",
        )) {
          session.status = "COMPLETED";
          session.notes = values.notes;
        }
        mediator.casesResolved += 1;
        notifyParties(
          data,
          record,
          "Mediativ kelishuv saqlandi",
          "Imzoli hujjat va mediator tasdig‘i qayd etildi.",
        );
      }
    }
    if (action === "payment") {
      const mediator = requireAssignedMediator(data, record, user);
      const values = z
        .object({
          reference: z.string().trim().min(3).max(200),
          received: z.literal(true),
        })
        .parse(input);
      if (record.status !== "RESOLVED" || !flow.settlementDocumentId)
        throw new MediationError(
          409,
          "Tushumni yakuniy kelishuvdan so‘ng qayd eting.",
        );
      data.payments ??= [];
      const previous = data.payments.find((item) => item.caseId === id);
      if (previous) {
        if (previous.reference !== values.reference)
          throw new MediationError(
            409,
            "Ushbu nizo tushumi avval qayd etilgan.",
          );
      } else {
        const orders = (data.serviceOrders || []).filter(
          (order) => order.caseId === id && order.kind === "MEDIATOR",
        );
        if (
          orders.some(
            (order) =>
              order.status === "PAID" ||
              data.paymentTransactions?.some(
                (transaction) =>
                  transaction.orderId === order.id && transaction.state === 1,
              ),
          )
        )
          throw new MediationError(
            409,
            "Ushbu xizmat uchun raqamli to‘lov jarayoni mavjud. To‘lov holatini tekshiring.",
          );
        for (const order of orders.filter(
          (order) => order.status === "PENDING",
        ))
          order.status = "CANCELLED";
        const invoice = data.mediatorInvoices?.find(
          (item) => item.caseId === id,
        );
        const fees = invoice
          ? {
              total: invoice.gross,
              platformFee: invoice.platformFee,
              mediatorFee: invoice.mediatorNet,
            }
          : mediationFee(record.claimAmount);
        data.payments.push({
          id: randomUUID(),
          caseId: id,
          mediatorId: mediator.id,
          gross: fees.total,
          platformFee: fees.platformFee,
          mediatorNet: fees.mediatorFee,
          commissionPercent: COMMISSION_PERCENT,
          method: "MANUAL",
          reference: values.reference,
          recordedAt: new Date().toISOString(),
          recordedBy: user.id,
          commissionStatus: "DUE",
        });
        recordEvent(record, "Mediator xizmat haqi tushumini qo‘lda qayd etdi");
      }
    }
    return caseForViewer(data, record, user);
  });
  return NextResponse.json({ case: result });
}
