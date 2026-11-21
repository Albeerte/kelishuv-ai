import { NextRequest, NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { saveDocument, loadDocument, removeDocument } from "@/lib/documents";
import { withinRateLimit } from "@/lib/rate-limit";
import { deliverEmails } from "@/lib/email";
import path from "node:path";
import { z } from "zod";
import { auth } from "@/auth";
import { LOCAL_DEMO, mutateStore, readStore } from "@/lib/store";
import {
  analyzeLocal,
  classify,
  isCriminal,
  courtCosts,
  DISCLAIMER,
  LEGAL_SOURCES,
  mediationFee,
  searchLaws,
} from "@/lib/legal";
import { hashPassword } from "@/lib/seed";
import {
  TYPE_LABELS,
  REGIONS,
  type AppData,
  type CaseRecord,
  type CaseStatus,
  type DisputeType,
  type PublicUser,
  type User,
} from "@/lib/types";
import { money } from "@/lib/utils";
import { boundedBody, jsonBody } from "@/lib/api-request";
import { handleMediationRequest, publicInvitation } from "@/lib/mediation-api";
import { handleKelishuvRequest } from "@/lib/kelishuv-api";
import { createReminderNotifications } from "@/lib/kelishuv-domain";
import { handleAssistantRequest } from "@/lib/assistant-api";
import { handleIdentityRequest, identityWebhook } from "@/lib/identity-api";
import {
  handleServiceRequest,
  hasTemplatePurchase,
  paidServiceTotals,
} from "@/lib/service-api";
import { handlePaymeRequest } from "@/lib/payme";
import { normalizePhone as normalizedAccountPhone } from "@/lib/service-catalog";
import { assessLegalRoutes, DEFAULT_ROUTING_FACTS } from "@/lib/legal-routing";
import {
  MediationError,
  canReadCase,
  canReadDocument,
  caseForViewer,
  currentMediator,
  hasBothConsents,
  hasMutualAppointment,
  isParty,
  normalizeCity,
  setUserPhone,
  queueEligible,
} from "@/lib/mediation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const disputeTypes = [
  "MEHNAT",
  "SHARTNOMA",
  "QOSHNI",
  "OILA",
  "ISTE_MOLCHI",
  "BIZNES",
  "YER_MULK",
  "BOSHQA",
] as const;
const amountSchema = z.number().finite().min(0).max(1e12);
const caseSchema = z.object({
  requestId: z.string().uuid().optional(),
  title: z.string().trim().min(4).max(120),
  description: z.string().trim().min(20).max(10000),
  type: z.enum(disputeTypes).optional(),
  claimAmount: amountSchema.default(0),
  region: z
    .string()
    .refine((region) => REGIONS.includes(region))
    .default("Toshkent shahri"),
  city: z.string().trim().min(2).max(100).optional(),
  routingFacts: z
    .object({
      publicAuthority: z.enum(["YES", "NO", "UNKNOWN"]),
      bothBusinesses: z.enum(["YES", "NO", "UNKNOWN"]),
      arbitrationAgreement: z.enum(["YES", "NO", "UNKNOWN"]),
      internationalCommercial: z.enum(["YES", "NO", "UNKNOWN"]),
      thirdPartyRights: z.enum(["YES", "NO", "UNKNOWN"]),
    })
    .optional(),
});
const registrationSchema = z
  .object({
    fullName: z.string().trim().min(3).max(100),
    email: z
      .string()
      .email()
      .max(200)
      .transform((email) => email.toLowerCase())
      .optional(),
    password: z.string().min(8).max(128),
    role: z.enum(["CITIZEN", "MEDIATOR", "ORGANIZATION"]).default("CITIZEN"),
    accountType: z.enum(["PERSON", "ORGANIZATION", "BANK"]).default("PERSON"),
    organizationName: z.string().trim().max(200).optional(),
    region: z
      .string()
      .refine((region) => REGIONS.includes(region))
      .default("Toshkent shahri"),
    phone: z.string().max(30).default(""),
    city: z.string().trim().min(2).max(100).optional(),
    acceptTerms: z.literal(true).optional(),
    termsVersion: z.literal("kelishuv-mvp-2026-11-v1").optional(),
  })
  .refine(
    (input) => Boolean(input.email || normalizedAccountPhone(input.phone)),
    "Telefon raqami yoki email kiriting.",
  )
  .refine(
    (input) => !input.phone || Boolean(normalizedAccountPhone(input.phone)),
    "Telefonni +998 bilan kiriting.",
  )
  .refine(
    (input) => !input.email?.endsWith("@phone.kelishuv.local"),
    "Haqiqiy email manzilini kiriting.",
  );
class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public caseId?: string,
  ) {
    super(message);
  }
}
const publicUser = ({ passwordHash: _hash, ...user }: User): PublicUser => user;
async function rateLimit(key: string, max: number) {
  if (!(await withinRateLimit(key, max)))
    throw new ApiError(
      429,
      "So‘rovlar soni oshdi. Bir daqiqadan so‘ng qayta urinib ko‘ring.",
    );
}
async function actor(request: NextRequest): Promise<User> {
  const session = await auth();
  const data = await readStore();
  const sessionId = session?.user?.id;
  if (sessionId) {
    const user = data.users.find(
      (user) => user.id === sessionId && user.isActive,
    );
    if (!user) throw new ApiError(401, "Hisobga qayta kiring.");
    return user;
  }
  if (LOCAL_DEMO) {
    const role = request.cookies.get("mm-demo-role")?.value;
    const id =
      role === "MEDIATOR"
        ? "demo-mediator"
        : role === "ADMIN"
          ? "demo-admin"
          : role === "RESPONDENT"
            ? "demo-respondent"
            : "demo-citizen";
    const user = data.users.find((user) => user.id === id);
    if (user) return user;
  }
  throw new ApiError(401, "Davom etish uchun hisobingizga kiring.");
}
function assertRole(user: User, roles: User["role"][]) {
  if (!roles.includes(user.role))
    throw new ApiError(403, "Ushbu amal uchun vakolat yetarli emas.");
}
function canAccess(data: AppData, record: CaseRecord, user: User) {
  return canReadCase(data, record, user);
}
function activeMediator(data: AppData, id: string, caseOwnerId?: string) {
  const mediator = currentMediator(data, id);
  return mediator?.userId === caseOwnerId ? undefined : mediator;
}
function getCase(data: AppData, id: string, user: User) {
  const record = data.cases.find((record) => record.id === id);
  if (!record || !canAccess(data, record, user))
    throw new ApiError(404, "Nizo topilmadi.");
  return record;
}
function transition(record: CaseRecord, status: CaseStatus, note: string) {
  if (record.status === status) return;
  record.status = status;
  record.updatedAt = new Date().toISOString();
  record.history.push({ status, note, at: record.updatedAt });
}
function notify(
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
function letter(record: CaseRecord, user: User) {
  return `TALABNOMA\n\nKimga: ______________________________\nKimdan: ${user.fullName}\nManzil: ${record.region}\nSana: ${new Intl.DateTimeFormat("uz-UZ", { timeZone: "Asia/Tashkent" }).format(new Date())}\nNizo: ${record.number}\n\n${record.title}\n\nHOLAT BAYONI\n${record.description}\n\nTALAB\nUshbu holat yuzasidan talabimni ko‘rib chiqishingizni${record.claimAmount ? ` va ${money(record.claimAmount)} so‘m miqdoridagi talab bo‘yicha yozma javob taqdim etishingizni` : ", yozma javob taqdim etishingizni"} so‘rayman.\n\nJavob berish muddati: __________________\n(Muddat tegishli qonun va shartnoma asosida belgilanadi.)\n\nNizoni muzokara yoki mediatsiya orqali hal qilishni taklif etaman.\n\nILOVALAR\n${record.analysis.documents.map((doc, index) => `${index + 1}. ${doc}`).join("\n")}\n\nImzo: __________________\n\nLoyiha. Yuborishdan oldin faktlarni, talablarni va manzillarni tekshiring.\n${DISCLAIMER}\n`;
}

async function handle(request: NextRequest): Promise<Response> {
  try {
    const requestHost = request.headers.get("host") || request.nextUrl.host;
    if (
      LOCAL_DEMO &&
      !["localhost:2345", "127.0.0.1:2345", "[::1]:2345"].includes(requestHost)
    )
      throw new ApiError(
        403,
        "Mahalliy platformani localhost:2345 orqali oching.",
      );
    const parts = request.nextUrl.pathname.replace(/^\/api\//, "").split("/");
    const route = parts.join("/");
    const method = request.method;
    const mutation = !["GET", "HEAD", "OPTIONS"].includes(method);
    if (mutation) {
      const origin = request.headers.get("origin");
      let originHost: string | null = null;
      try {
        originHost = origin ? new URL(origin).host : null;
      } catch {
        throw new ApiError(403, "So‘rov manbasi mos kelmadi.");
      }
      const requestHost = request.headers.get("host") || request.nextUrl.host;
      const localOrigins = [
        "http://localhost:2345",
        "http://127.0.0.1:2345",
        "http://[::1]:2345",
      ];
      if (
        origin &&
        originHost !== requestHost &&
        !(LOCAL_DEMO && localOrigins.includes(origin))
      )
        throw new ApiError(403, "So‘rov manbasi mos kelmadi.");
      const size = Number(request.headers.get("content-length") || 0);
      if (size > 11 * 1024 * 1024)
        throw new ApiError(413, "Fayl hajmi 10 MB dan oshmasligi kerak.");
      await rateLimit(
        `${route.split("/")[0]}:${request.headers.get("x-forwarded-for") || "local"}`,
        route === "chat" ? 20 : 60,
      );
    }

    if (route === "health" && method === "GET")
      return NextResponse.json({
        ok: true,
        storage: process.env.DATABASE_URL ? "postgresql" : "encrypted-local",
        ai: process.env.FASTAPI_URL ? "configured" : "local",
        demo: LOCAL_DEMO,
      });
    const assistantResponse = await handleAssistantRequest(request);
    if (assistantResponse) return assistantResponse;
    const webhookResponse = await identityWebhook(request, mutateStore);
    if (webhookResponse) return webhookResponse;
    const paymeResponse = await handlePaymeRequest(request, mutateStore);
    if (paymeResponse) return paymeResponse;
    const invitation = await publicInvitation(request);
    if (invitation) return invitation;
    if (route === "laws/search" && method === "GET") {
      const type = z
        .enum(disputeTypes)
        .optional()
        .parse(request.nextUrl.searchParams.get("type") || undefined);
      return NextResponse.json({
        sources: searchLaws(request.nextUrl.searchParams.get("q") || "", type),
      });
    }
    if (route === "mediators" && method === "GET") {
      const data = await readStore();
      const region = request.nextUrl.searchParams.get("region");
      const type = request.nextUrl.searchParams.get("type");
      const city = request.nextUrl.searchParams.get("city");
      return NextResponse.json({
        mediators: data.mediators.filter(
          (mediator) =>
            activeMediator(data, mediator.id) &&
            (!region || mediator.region === region) &&
            (!city || normalizeCity(mediator.city) === normalizeCity(city)) &&
            (!type || mediator.specializations.includes(type as DisputeType)),
        ),
      });
    }
    if (route === "auth/register" && method === "POST") {
      const input = registrationSchema.parse(await jsonBody(request));
      const phone = normalizedAccountPhone(input.phone);
      const email =
        input.email || `${phone.replace(/\D/g, "")}@phone.kelishuv.local`;
      await rateLimit(`register:${email}`, 3);
      const passwordHash = hashPassword(input.password);
      const user = await mutateStore((data) => {
        if (
          data.users.some(
            (user) =>
              user.email === email ||
              Boolean(phone && normalizedAccountPhone(user.phone) === phone),
          )
        )
          throw new ApiError(
            409,
            "Bu telefon yoki email bilan hisob mavjud. Hisobingizga kiring.",
          );
        const user: User = {
          id: randomUUID(),
          fullName: input.fullName,
          email,
          phone,
          accountType: input.accountType,
          organizationName: input.organizationName,
          termsAcceptance:
            input.acceptTerms && input.termsVersion
              ? { version: input.termsVersion, at: new Date().toISOString() }
              : undefined,
          city:
            input.city ||
            (input.region === "Toshkent shahri" ? "Toshkent" : ""),
          region: input.region,
          role:
            input.role === "MEDIATOR"
              ? "MEDIATOR"
              : input.accountType !== "PERSON"
                ? "ORGANIZATION"
                : input.role,
          passwordHash,
          createdAt: new Date().toISOString(),
          isActive: true,
        };
        data.users.push(user);
        return publicUser(user);
      });
      return NextResponse.json({ user }, { status: 201 });
    }

    const user = await actor(request);
    function mutateAsUser<T>(operation: (data: AppData) => T) {
      return mutateStore((data) => {
        const current = data.users.find(
          (item) => item.id === user.id && item.isActive,
        );
        if (!current) throw new ApiError(401, "Hisobga qayta kiring.");
        if (current.role !== user.role)
          throw new ApiError(
            403,
            "Hisob vakolati o‘zgardi. Sahifani yangilang.",
          );
        return operation(data);
      });
    }
    const identityResponse = await handleIdentityRequest(
      request,
      user,
      mutateAsUser,
    );
    if (identityResponse) return identityResponse;
    const serviceResponse = await handleServiceRequest(
      request,
      user,
      mutateAsUser,
    );
    if (serviceResponse) return serviceResponse;
    const kelishuvResponse = await handleKelishuvRequest(
      request,
      user,
      mutateAsUser,
    );
    if (kelishuvResponse) return kelishuvResponse;
    const mediationResponse = await handleMediationRequest(
      request,
      user,
      mutateAsUser,
    );
    if (mediationResponse) return mediationResponse;
    if (route === "auth/me" && method === "GET")
      return NextResponse.json({
        user: publicUser(user),
        demo: user.id.startsWith("demo-"),
        localDemo: LOCAL_DEMO,
        integrations: {
          ai: Boolean(process.env.FASTAPI_URL),
          email: Boolean(process.env.SMTP_HOST),
          database: Boolean(process.env.DATABASE_URL),
        },
      });
    if (route === "auth/demo" && method === "POST") {
      if (!LOCAL_DEMO || !user.id.startsWith("demo-"))
        throw new ApiError(
          403,
          "Demo almashtirish faqat mahalliy namuna hisoblari uchun.",
        );
      const { role } = z
        .object({
          role: z.enum(["CITIZEN", "RESPONDENT", "MEDIATOR", "ADMIN"]),
        })
        .parse(await jsonBody(request));
      const response = NextResponse.json({ ok: true });
      response.cookies.set("mm-demo-role", role, {
        httpOnly: true,
        sameSite: "strict",
        path: "/",
        maxAge: 86400,
        secure: request.nextUrl.protocol === "https:",
      });
      return response;
    }
    if (route === "profile" && method === "PUT") {
      const input = z
        .object({
          fullName: z.string().trim().min(3).max(100),
          phone: z.string().max(30),
          region: z.string().refine((region) => REGIONS.includes(region)),
          city: z.string().trim().min(2).max(100).optional(),
        })
        .parse(await jsonBody(request));
      const saved = await mutateAsUser((data) => {
        const record = data.users.find((record) => record.id === user.id)!;
        setUserPhone(data, record, input.phone);
        if (record.fullName !== input.fullName) {
          const identity = data.identityChecks?.find(
            (item) => item.userId === user.id,
          );
          if (identity) {
            identity.status = "REVIEW_REQUIRED";
            identity.verifiedAt = undefined;
            identity.sessionId = undefined;
          }
        }
        Object.assign(record, { ...input, phone: record.phone });
        const mediator = data.mediators.find((item) => item.userId === user.id);
        if (mediator)
          Object.assign(mediator, {
            name: record.fullName,
            region: record.region,
            city: record.city,
          });
        return publicUser(record);
      });
      return NextResponse.json({ user: saved });
    }
    if (route === "stats" && method === "GET") {
      const data = await readStore();
      const cases = data.cases
        .filter((record) => isParty(record, user.id))
        .map((record) => caseForViewer(data, record, user));
      return NextResponse.json({
        total: cases.length,
        active: cases.filter(
          (record) =>
            !["RESOLVED", "CLOSED", "ESCALATED"].includes(record.status),
        ).length,
        resolved: cases.filter((record) => record.status === "RESOLVED").length,
        documents: cases.reduce(
          (count, record) => count + record.documents.length,
          0,
        ),
        sessions: data.sessions
          .filter(
            (session) =>
              cases.some((record) => record.id === session.caseId) &&
              session.status === "SCHEDULED",
          )
          .sort(
            (a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt),
          ),
        cases,
        mediators: data.mediators.filter((mediator) =>
          activeMediator(data, mediator.id),
        ),
      });
    }
    if (route === "notifications" && method === "GET") {
      await mutateAsUser((data) => createReminderNotifications(data));
      return NextResponse.json({
        notifications: (await readStore()).notifications.filter(
          (notification) => notification.userId === user.id,
        ),
      });
    }
    if (route === "notifications" && method === "PUT") {
      await mutateAsUser((data) => {
        data.notifications
          .filter((item) => item.userId === user.id)
          .forEach((item) => {
            item.read = true;
          });
      });
      return NextResponse.json({ ok: true });
    }
    if (route === "court-costs" && method === "POST") {
      const input = z
        .object({
          amount: amountSchema,
          type: z.enum([...disputeTypes, "FUQAROLIK", "IQTISODIY"]),
          bhm: z.number().int().min(1).max(100000000).default(440000),
        })
        .parse(await jsonBody(request));
      return NextResponse.json({
        costs: courtCosts(input.amount, input.type, input.bhm),
      });
    }
    if (route === "cases" && method === "GET") {
      const data = await readStore();
      return NextResponse.json({
        cases: data.cases
          .filter(
            (record) =>
              isParty(record, user.id) ||
              (user.role === "MEDIATOR" &&
                data.mediators.some(
                  (mediator) =>
                    mediator.userId === user.id &&
                    record.mediatorId === mediator.id,
                )),
          )
          .filter((record) => canReadCase(data, record, user))
          .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
          .map((record) => caseForViewer(data, record, user)),
      });
    }
    if (route === "cases" && method === "POST") {
      assertRole(user, ["CITIZEN", "LAWYER", "ORGANIZATION"]);
      const input = caseSchema.parse(await jsonBody(request));
      const type = input.type || classify(input.description);
      const analysis = analyzeLocal(input.description, type, input.claimAmount);
      const record = await mutateAsUser((data) => {
        const creationHash = createHash("sha256")
          .update(JSON.stringify(input))
          .digest("hex");
        if (input.requestId) {
          const existing = data.cases.find(
            (record) =>
              record.userId === user.id &&
              record.creationRequest?.id === input.requestId,
          );
          if (existing) {
            if (existing.creationRequest?.hash !== creationHash)
              throw new ApiError(
                409,
                "Bu so‘rov bo‘yicha ish saqlangan. Mening ishlarim bo‘limidan uni oching.",
                existing.id,
              );
            return caseForViewer(data, existing, user);
          }
        }
        const now = new Date().toISOString();
        const record: CaseRecord = {
          creationRequest: input.requestId
            ? { id: input.requestId, hash: creationHash }
            : undefined,
          journeyVersion: 3,
          positions: [],
          privateReviews: [],
          messages: [],
          proposalDecisions: [],
          id: randomUUID(),
          number: `MM-${Math.max(1042, ...data.cases.map((item) => Number(item.number.split("-")[1]) || 0)) + 1}`,
          userId: user.id,
          title: input.title,
          type,
          description: input.description,
          claimAmount: input.claimAmount,
          region: input.region,
          city:
            input.city ||
            (input.region === "Toshkent shahri" ? "Toshkent" : ""),
          routingFacts: input.routingFacts || { ...DEFAULT_ROUTING_FACTS },
          guidance: assessLegalRoutes(
            type,
            input.description,
            input.routingFacts,
          ),
          mediation: { version: 2, mediatorApprovals: [], calls: [] },
          status: "SOLUTIONS_READY",
          analysis,
          documents: [],
          history: [
            {
              status: "SOLUTIONS_READY",
              note: "Nizo saqlandi va dastlabki tahlil tayyorlandi",
              at: now,
            },
          ],
          createdAt: now,
          updatedAt: now,
        };
        data.cases.unshift(record);
        notify(data, user.id, "Nizo tahlili tayyor", input.title, record.id);
        return caseForViewer(data, record, user);
      });
      return NextResponse.json({ case: record }, { status: 201 });
    }
    if (parts[0] === "cases" && parts[1]) {
      const id = parts[1];
      if (parts.length === 2 && method === "GET") {
        const data = await readStore();
        const record = getCase(data, id, user);
        return NextResponse.json({
          case: {
            ...caseForViewer(data, record, user),
            guidance:
              record.guidance ||
              assessLegalRoutes(
                record.type,
                record.description,
                record.routingFacts,
              ),
          },
          mediator:
            data.mediators.find(
              (mediator) => mediator.id === record.mediatorId,
            ) || null,
          sessions: data.sessions.filter((session) => session.caseId === id),
        });
      }
      if (parts[2] === "solution" && method === "POST") {
        const input = z
          .object({
            solution: z.enum(["MEDIATION", "NEGOTIATION", "COURT"]),
            mediatorId: z.string().max(100).optional(),
          })
          .parse(await jsonBody(request));
        const result = await mutateAsUser((data) => {
          const record = getCase(data, id, user);
          if (record.userId !== user.id)
            throw new ApiError(403, "Yechimni nizo egasi tanlaydi.");
          if (record.analysis.criminal)
            throw new ApiError(
              400,
              "Bu holatni avval advokat yoki vakolatli organ bilan baholang.",
            );
          if (
            ["RESOLVED", "CLOSED", "ESCALATED"].includes(record.status) ||
            data.sessions.some(
              (session) =>
                session.caseId === id && session.status === "SCHEDULED",
            )
          )
            throw new ApiError(
              409,
              "Nizoning amaldagi jarayoni davom etmoqda yoki yakunlangan.",
            );
          if (record.chosenSolution === input.solution)
            return caseForViewer(data, record, user);
          if (record.mediation && record.mediatorId)
            throw new ApiError(
              409,
              "Avval mediatsiyaga rozilikni qaytarib olish jarayonidan foydalaning.",
            );
          if (input.solution === "MEDIATION") {
            record.guidance = assessLegalRoutes(
              record.type,
              record.description,
              record.routingFacts,
            );
            if (
              record.guidance.options.find(
                (option) => option.id === "MEDIATION",
              )?.availability === "UNSUITABLE"
            )
              throw new ApiError(
                400,
                "Ushbu holat bo‘yicha huquqiy yo‘naltirishni mutaxassis bilan ko‘rib chiqing.",
              );
            record.mediation ??= {
              version: 2,
              mediatorApprovals: [],
              calls: [],
            };
          } else if (record.mediation) {
            delete record.mediation.initiatorConsent;
            delete record.mediation.respondentConsent;
            delete record.mediation.publishedAt;
            record.mediation.mediatorApprovals = [];
          }
          record.chosenSolution = input.solution;
          record.mediatorId = undefined;
          transition(
            record,
            input.solution === "COURT"
              ? "ESCALATED"
              : input.solution === "MEDIATION"
                ? "AWAITING_CONSENT"
                : "IN_PROGRESS",
            input.solution === "COURT"
              ? "Sud orqali hal etish yo‘li tanlandi"
              : input.solution === "NEGOTIATION"
                ? "Sudgacha kelishuv yo‘li tanlandi"
                : "Mediatsiya yo‘li tanlandi",
          );
          return caseForViewer(data, record, user);
        });
        return NextResponse.json({ case: result });
      }
      if (parts[2] === "letter" && method === "GET") {
        const data = await readStore();
        const record = getCase(data, id, user);
        if (
          !isParty(record, user.id) ||
          !hasTemplatePurchase(data, user.id, id)
        )
          throw new ApiError(
            402,
            "Talabnoma uchun Hujjatlar bo‘limida tarifni tanlang va to‘lovni tasdiqlang.",
          );
        const owner = data.users.find((item) => item.id === record.userId)!;
        const text =
          user.id === record.mediation?.respondentId
            ? `IKKINCHI TARAF BAYONI\n\n${record.number}\n${user.fullName}\n\n${record.mediation.respondentStatement || "Bayoningizni kiriting."}\n\nImzo __________________\nSana __________________`
            : letter(record, owner);
        await mutateAsUser((current) => {
          const paid = hasTemplatePurchase(current, user.id, id);
          if (!paid) throw new ApiError(402, "To‘lov holati o‘zgargan.");
          paid.consumedAt ||= new Date().toISOString();
        });
        return new Response("\uFEFF" + text, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Content-Disposition": `attachment; filename="talabnoma-${record.number}.txt"`,
            "Cache-Control": "no-store",
          },
        });
      }
      if (parts[2] === "documents" && method === "POST") {
        const before = await readStore();
        getCase(before, id, user);
        const contents = await boundedBody(request, 11 * 1024 * 1024);
        const form = await new Request(request.url, {
          method: "POST",
          headers: request.headers,
          body: new Uint8Array(contents),
        }).formData();
        const file = form.get("file");
        if (
          !(file instanceof File) ||
          file.size === 0 ||
          file.size > 10 * 1024 * 1024
        )
          throw new ApiError(400, "10 MB gacha bo‘lgan fayl tanlang.");
        const extension = file.name.split(".").pop()?.toLowerCase();
        const allowed: Record<string, string> = {
          pdf: "application/pdf",
          png: "image/png",
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          txt: "text/plain",
          docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        };
        if (!extension || !allowed[extension])
          throw new ApiError(400, "PDF, DOCX, TXT, JPG yoki PNG fayl yuklang.");
        const kind = z
          .enum([
            "APPLICATION",
            "EVIDENCE",
            "PROCEDURE_AGREEMENT",
            "SETTLEMENT",
          ])
          .parse(form.get("kind") || "EVIDENCE");
        const visibility = z
          .enum(["MEDIATOR_ONLY", "PARTIES"])
          .parse(form.get("visibility") || "MEDIATOR_ONLY");
        const storageKey = randomUUID();
        await saveDocument(storageKey, Buffer.from(await file.arrayBuffer()));
        try {
          const document = await mutateAsUser((data) => {
            const record = getCase(data, id, user);
            if (
              ["PROCEDURE_AGREEMENT", "SETTLEMENT"].includes(kind) &&
              (user.role !== "MEDIATOR" ||
                !data.mediators.some(
                  (item) =>
                    item.id === record.mediatorId && item.userId === user.id,
                ))
            )
              throw new ApiError(
                403,
                "Kelishuv hujjatini qabul qilgan mediator yuklaydi.",
              );
            const document = {
              id: randomUUID(),
              name: path.basename(file.name).slice(0, 200),
              size: file.size,
              mime: allowed[extension],
              uploadedAt: new Date().toISOString(),
              storageKey,
              uploadedBy: user.id,
              kind,
              visibility,
            };
            record.documents.push(document);
            record.updatedAt = document.uploadedAt;
            return { ...document, storageKey: "" };
          });
          return NextResponse.json({ document }, { status: 201 });
        } catch (error) {
          await removeDocument(storageKey).catch(() => undefined);
          throw error;
        }
      }
      if (parts[2] === "documents" && parts[3] && method === "GET") {
        const data = await readStore();
        const record = getCase(data, id, user);
        const document = record.documents.find(
          (document) => document.id === parts[3],
        );
        if (!document || !canReadDocument(data, record, document, user))
          throw new ApiError(404, "Hujjat topilmadi.");
        const buffer = await loadDocument(document.storageKey);
        return new Response(new Uint8Array(buffer), {
          headers: {
            "Content-Type": document.mime,
            "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(document.name)}`,
            "Cache-Control": "no-store",
          },
        });
      }
    }
    if (route === "chat" && method === "POST") {
      const input = z
        .object({
          message: z.string().trim().min(2).max(4000),
          caseId: z.string().optional(),
        })
        .parse(await jsonBody(request));
      if (input.caseId) getCase(await readStore(), input.caseId, user);
      if (isCriminal(input.message))
        return NextResponse.json({
          message: `Holatingizda xavfsizlik yoki jinoyatga oid masala bo‘lishi mumkin. Vakolatli organ va malakali advokat bilan bog‘laning. ${DISCLAIMER}`,
          sources: [],
          mode: "local",
        });
      const type = classify(input.message);
      const sources = searchLaws(input.message, type).slice(0, 3);
      if (process.env.FASTAPI_URL && user.id.startsWith("demo-")) {
        const response = await fetch(`${process.env.FASTAPI_URL}/ai/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Service-Key": process.env.AI_SERVICE_KEY || "",
          },
          body: JSON.stringify({ message: input.message, dispute_type: type }),
          signal: AbortSignal.timeout(45000),
        }).catch(() => null);
        const result = response?.ok
          ? await response.json().catch(() => null)
          : null;
        if (
          result?.mode === "rag" &&
          typeof result.message === "string" &&
          Array.isArray(result.source_ids)
        ) {
          const verified = LEGAL_SOURCES.filter((source) =>
            result.source_ids.includes(source.id),
          );
          if (verified.length)
            return NextResponse.json({
              message: `${result.message}\n\n${DISCLAIMER}`,
              sources: verified,
              mode: "rag",
            });
        }
      }
      const related =
        sources.find(
          (source) => source.id !== "mediation" && source.id !== "court-fee",
        ) || LEGAL_SOURCES.find((source) => source.types.includes(type));
      const answer = `${related?.summary || "Vaziyatingizga oid hujjatlar va dalillarni yig‘ing."}\n\nMuammoning qachon boshlanganini, yozma shartnoma mavjudligini va ikkinchi tomondan qanday javob olganingizni aniqlashtiring. Mediatsiya, yozma talabnoma va sud orqali hal etish yo‘llarini nizo tahlilida solishtirishingiz mumkin.\n\nBu javob mahalliy ma’lumotnoma asosida tayyorlandi. ${DISCLAIMER}`;
      return NextResponse.json({
        message: answer,
        sources: related ? [related] : [],
        mode: "local",
      });
    }
    if (parts[0] === "mediator") {
      assertRole(user, ["MEDIATOR", "ADMIN"]);
      const data = await readStore();
      const mediator = data.mediators.find(
        (item) => item.userId === user.id && currentMediator(data, item.id),
      );
      if (!mediator && user.role !== "ADMIN")
        if (
          method === "GET" &&
          ["mediator/cases", "mediator/earnings"].includes(route)
        )
          return NextResponse.json({
            applicationRequired: true,
            available: [],
            assigned: [],
            mediator: null,
            sessions: [],
            payments: [],
            completed: 0,
            pending: 0,
            paid: 0,
          });
        else
          throw new ApiError(
            403,
            "Mediator profilingiz administrator tasdig‘ini kutmoqda.",
          );
      if (route === "mediator/cases" && method === "GET") {
        const available = data.cases
          .filter((record) =>
            mediator
              ? queueEligible(data, record, mediator)
              : record.status === "OPEN_FOR_MEDIATORS" &&
                hasBothConsents(record),
          )
          .map((record) => ({
            id: record.id,
            number: record.number,
            type: record.type,
            region: record.region,
            city: record.city,
            claimAmount: record.claimAmount,
            status: record.status,
            createdAt: record.createdAt,
            summary: `${TYPE_LABELS[record.type]} bo‘yicha tomonlar o‘rtasida kelishuv izlanmoqda.`,
          }));
        return NextResponse.json({
          available,
          assigned: data.cases
            .filter(
              (record) =>
                Boolean(mediator) &&
                record.mediatorId === mediator?.id &&
                canReadCase(data, record, user),
            )
            .map((record) => caseForViewer(data, record, user)),
          mediator,
        });
      }
      if (route === "mediator/earnings" && method === "GET") {
        const providerTotals = paidServiceTotals(data, mediator?.id);
        const invoices = (data.mediatorInvoices || []).filter(
          (item) =>
            item.mediatorId === mediator?.id &&
            !data.payments?.some((payment) => payment.caseId === item.caseId),
        );
        const invoiceCaseIds = new Set(invoices.map((item) => item.caseId));
        const pendingInvoices = invoices.reduce(
          (sum, invoice) =>
            sum +
            Math.max(
              0,
              invoice.mediatorNet -
                (data.serviceOrders || [])
                  .filter(
                    (order) =>
                      order.invoiceId === invoice.id && order.status === "PAID",
                  )
                  .reduce((net, order) => net + order.mediatorNet, 0),
            ),
          0,
        );
        const sessions = data.sessions.filter(
          (session) => session.mediatorId === mediator?.id,
        );
        const payments = (data.payments || []).filter(
          (item) => item.mediatorId === mediator?.id,
        );
        const legacySessions = sessions.filter(
          (session) =>
            !data.cases.find((item) => item.id === session.caseId)?.mediation,
        );
        return NextResponse.json({
          sessions,
          payments,
          commissionDue: payments
            .filter((item) => item.commissionStatus === "DUE")
            .reduce((sum, item) => sum + item.platformFee, 0),
          receivedGross:
            payments.reduce((sum, item) => sum + item.gross, 0) +
            providerTotals.gross,
          completed:
            providerTotals.mediatorNet +
            payments.reduce((sum, item) => sum + item.mediatorNet, 0) +
            legacySessions
              .filter((session) => session.status === "COMPLETED")
              .reduce((sum, session) => sum + session.mediatorFee, 0),
          pending:
            pendingInvoices +
            data.cases
              .filter(
                (record) =>
                  record.mediation &&
                  !invoiceCaseIds.has(record.id) &&
                  record.mediatorId === mediator?.id &&
                  ![
                    "RESOLVED",
                    "CLOSED",
                    "ESCALATED",
                    "CONSENT_WITHDRAWN",
                  ].includes(record.status),
              )
              .reduce(
                (sum, record) =>
                  sum + mediationFee(record.claimAmount).mediatorFee,
                0,
              ) +
            legacySessions
              .filter((session) => session.status === "SCHEDULED")
              .reduce((sum, session) => sum + session.mediatorFee, 0),
          paid:
            providerTotals.mediatorNet +
            payments.reduce((sum, item) => sum + item.mediatorNet, 0) +
            legacySessions
              .filter((session) => session.paid)
              .reduce((sum, session) => sum + session.mediatorFee, 0),
        });
      }
      if (
        parts[1] === "cases" &&
        parts[2] &&
        parts[3] === "accept" &&
        method === "POST"
      ) {
        if (!mediator) throw new ApiError(403, "Mediator profili kerak.");
        const saved = await mutateAsUser((data) => {
          const record = data.cases.find((record) => record.id === parts[2]);
          const freshMediator = currentMediator(data, mediator.id);
          if (
            !record ||
            !freshMediator ||
            !queueEligible(data, record, freshMediator)
          )
            throw new ApiError(
              409,
              "Bu nizo hozir qabul qilish uchun mavjud emas.",
            );
          record.mediatorId = mediator.id;
          transition(
            record,
            "MEDIATOR_ASSIGNED",
            "Mediator nizoni qabul qildi",
          );
          notify(
            data,
            record.userId,
            "Mediator topildi",
            `${mediator.name} nizongizni qabul qildi.`,
            record.id,
          );
          if (record.mediation?.respondentId)
            notify(
              data,
              record.mediation.respondentId,
              "Mediator topildi",
              `${mediator.name} nizoni qabul qildi.`,
              record.id,
            );
          return caseForViewer(data, record, user);
        });
        return NextResponse.json({ case: saved });
      }
    }
    if (route === "sessions" && method === "GET") {
      const data = await readStore();
      return NextResponse.json({
        sessions: data.sessions.filter((session) => {
          const record = data.cases.find(
            (record) => record.id === session.caseId,
          );
          return record && canAccess(data, record, user);
        }),
        mediators: data.mediators,
      });
    }
    if (
      (route === "sessions" || route === "mediator/sessions") &&
      method === "POST"
    ) {
      const input = z
        .object({
          caseId: z.string(),
          mediatorId: z.string(),
          scheduledAt: z.string().datetime({ offset: true }),
          duration: z.number().int().min(30).max(120).default(60),
          type: z.enum(["ONLINE", "OFFLINE"]).default("ONLINE"),
        })
        .parse(await jsonBody(request));
      if (Date.parse(input.scheduledAt) < Date.now() + 60000)
        throw new ApiError(400, "Kelajakdagi sana va vaqtni tanlang.");
      const session = await mutateAsUser((data) => {
        const record = getCase(data, input.caseId, user);
        const mediator = activeMediator(data, input.mediatorId, record.userId);
        if (
          !mediator ||
          isParty(record, mediator.userId) ||
          !mediator.specializations.includes(record.type)
        )
          throw new ApiError(400, "Nizo yo‘nalishiga mos mediator tanlang.");
        if (
          record.mediation &&
          (!hasMutualAppointment(record) ||
            !record.mediation.procedureDocumentId ||
            record.mediatorId !== mediator.id)
        )
          throw new ApiError(
            409,
            "Sessiya uchun ikkala tarafning mediator tanlovi va yozma tartib-taomil kelishuvi kerak.",
          );
        if (
          !record.mediation &&
          (record.mediatorId !== mediator.id ||
            record.chosenSolution !== "MEDIATION")
        )
          throw new ApiError(
            409,
            "Yangi mediator biriktirish uchun taklif va ikkala taraf roziligini rasmiylashtiring.",
          );
        if (
          record.analysis.criminal ||
          ["RESOLVED", "CLOSED", "ESCALATED"].includes(record.status)
        )
          throw new ApiError(409, "Bu nizo uchun sessiya belgilab bo‘lmaydi.");
        if (record.mediatorId && record.mediatorId !== mediator.id)
          throw new ApiError(409, "Nizo boshqa mediatorga biriktirilgan.");
        const existing = data.sessions.find(
          (session) =>
            session.caseId === record.id && session.status === "SCHEDULED",
        );
        if (existing) {
          if (
            existing.scheduledAt === input.scheduledAt &&
            existing.mediatorId === input.mediatorId
          )
            return existing;
          throw new ApiError(
            409,
            "Bu nizo uchun faol sessiya allaqachon belgilangan.",
          );
        }
        const start = Date.parse(input.scheduledAt);
        const end = start + input.duration * 60000;
        const participants = new Set(
          [
            record.userId,
            record.mediation?.respondentId,
            mediator.userId,
          ].filter(Boolean),
        );
        const overlap = data.sessions.some((session) => {
          if (
            session.status !== "SCHEDULED" ||
            Date.parse(session.scheduledAt) >= end ||
            Date.parse(session.scheduledAt) + session.duration * 60000 <= start
          )
            return false;
          const otherCase = data.cases.find(
            (item) => item.id === session.caseId,
          );
          const otherMediator = data.mediators.find(
            (item) => item.id === session.mediatorId,
          );
          return [
            otherCase?.userId,
            otherCase?.mediation?.respondentId,
            otherMediator?.userId,
          ].some((id) => Boolean(id) && participants.has(id));
        });
        if (overlap)
          throw new ApiError(
            409,
            "Ushbu vaqtda boshqa sessiya mavjud. Boshqa vaqt tanlang.",
          );
        const fees = mediationFee(record.claimAmount);
        const session = {
          id: randomUUID(),
          ...input,
          status: "SCHEDULED" as const,
          notes: "",
          fee: fees.total,
          platformFee: fees.platformFee,
          mediatorFee: fees.mediatorFee,
          paid: false,
          room: `medimatch-${randomUUID()}`,
        };
        data.sessions.push(session);
        record.mediatorId = mediator.id;
        record.chosenSolution = "MEDIATION";
        transition(
          record,
          "SESSION_SCHEDULED",
          "Mediatsiya sessiyasi belgilandi",
        );
        notify(
          data,
          record.userId,
          "Sessiya belgilandi",
          `${mediator.name} bilan uchrashuv saqlandi.`,
          record.id,
        );
        notify(
          data,
          mediator.userId,
          "Yangi sessiya",
          `${record.number} bo‘yicha uchrashuv belgilandi.`,
          record.id,
        );
        return session;
      });
      return NextResponse.json({ session }, { status: 201 });
    }
    if (parts[0] === "sessions" && parts[1] && method === "PUT") {
      const input = z
        .object({
          action: z.enum(["cancel", "complete", "rate"]),
          notes: z.string().max(10000).default(""),
          rating: z.number().int().min(1).max(5).optional(),
        })
        .parse(await jsonBody(request));
      const session = await mutateAsUser((data) => {
        const session = data.sessions.find(
          (session) => session.id === parts[1],
        );
        if (!session) throw new ApiError(404, "Sessiya topilmadi.");
        const record = getCase(data, session.caseId, user);
        if (input.action === "rate") {
          if (
            record.userId !== user.id ||
            session.status !== "COMPLETED" ||
            !input.rating
          )
            throw new ApiError(
              400,
              "Baholash uchun yakunlangan sessiya va 1–5 yulduz tanlang.",
            );
          session.rating = input.rating;
          const mediator = data.mediators.find(
            (mediator) => mediator.id === session.mediatorId,
          );
          const ratings = data.sessions
            .filter(
              (item) => item.mediatorId === session.mediatorId && item.rating,
            )
            .map((item) => item.rating!);
          if (mediator)
            mediator.rating =
              Math.round(
                (ratings.reduce((sum, rating) => sum + rating, 0) /
                  ratings.length) *
                  10,
              ) / 10;
          return session;
        }
        if (session.status !== "SCHEDULED")
          throw new ApiError(
            409,
            "Sessiya allaqachon yakunlangan yoki bekor qilingan.",
          );
        if (input.action === "complete") {
          if (record.mediation)
            throw new ApiError(
              409,
              "Yakunlash uchun nizo sahifasida taraflar imzolagan va mediator tasdiqlagan kelishuvni yuklang.",
            );
          assertRole(user, ["MEDIATOR", "ADMIN"]);
          if (
            user.role === "MEDIATOR" &&
            !data.mediators.some(
              (mediator) =>
                mediator.userId === user.id &&
                mediator.id === session.mediatorId,
            )
          )
            throw new ApiError(
              403,
              "Sessiyani biriktirilgan mediator yakunlaydi.",
            );
          if (input.notes.trim().length < 20)
            throw new ApiError(
              400,
              "Kelishuv natijasini kamida 20 belgi bilan kiriting.",
            );
          session.status = "COMPLETED";
          session.notes = input.notes;
          transition(
            record,
            "RESOLVED",
            "Mediatsiya yakunlandi, kelishuv qayd etildi",
          );
          const mediator = data.mediators.find(
            (mediator) => mediator.id === session.mediatorId,
          );
          if (mediator) mediator.casesResolved += 1;
          notify(
            data,
            record.userId,
            "Nizo hal etildi",
            "Kelishuv natijasi saqlandi. Mediatorga baho bering.",
            record.id,
          );
        } else {
          session.status = "CANCELLED";
          transition(
            record,
            "MEDIATOR_ASSIGNED",
            "Sessiya bekor qilindi. Yangi vaqt belgilash mumkin.",
          );
        }
        return session;
      });
      return NextResponse.json({ session });
    }
    if (parts[0] === "admin") {
      assertRole(user, ["ADMIN"]);
      if (route === "admin/analytics" && method === "GET") {
        const data = await readStore();
        return NextResponse.json({
          cases: data.cases.map((record) => caseForViewer(data, record, user)),
          users: data.users.map(publicUser),
          mediators: data.mediators,
          sessions: data.sessions,
          payments: data.payments || [],
          totalCommission:
            paidServiceTotals(data).platformFee +
            (data.payments || []).reduce(
              (sum, item) => sum + item.platformFee,
              0,
            ) +
            data.sessions
              .filter(
                (session) =>
                  !data.cases.find((record) => record.id === session.caseId)
                    ?.mediation,
              )
              .filter((session) => session.status === "COMPLETED")
              .reduce((sum, session) => sum + session.platformFee, 0),
        });
      }
      if (route === "admin/cases" && method === "GET") {
        const data = await readStore();
        return NextResponse.json({
          cases: data.cases.map((record) => caseForViewer(data, record, user)),
        });
      }
      if (route === "admin/users" && method === "GET")
        return NextResponse.json({
          users: (await readStore()).users.map(publicUser),
        });
      if (
        parts[1] === "users" &&
        parts[2] &&
        parts[3] === "role" &&
        method === "PUT"
      ) {
        const input = z
          .object({
            role: z.enum([
              "CITIZEN",
              "MEDIATOR",
              "LAWYER",
              "ADMIN",
              "ORGANIZATION",
            ]),
          })
          .parse(await jsonBody(request));
        const saved = await mutateAsUser((data) => {
          const target = data.users.find((target) => target.id === parts[2]);
          if (!target) throw new ApiError(404, "Foydalanuvchi topilmadi.");
          if (target.id === user.id)
            throw new ApiError(
              400,
              "O‘z hisobingiz rolini bu yerdan o‘zgartirib bo‘lmaydi.",
            );
          target.role = input.role;
          return publicUser(target);
        });
        return NextResponse.json({ user: saved });
      }
    }
    throw new ApiError(404, "So‘ralgan sahifa yoki amal topilmadi.");
  } catch (error) {
    if (error instanceof ApiError || error instanceof MediationError)
      return NextResponse.json(
        {
          error: error.message,
          ...(error instanceof ApiError && error.caseId
            ? { caseId: error.caseId }
            : {}),
        },
        { status: error.status },
      );
    if (error instanceof z.ZodError)
      return NextResponse.json(
        {
          error: "Kiritilgan ma’lumotlarni tekshiring.",
          fields: error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    if (error instanceof SyntaxError)
      return NextResponse.json(
        { error: "So‘rov ma’lumotlari formati noto‘g‘ri." },
        { status: 400 },
      );
    console.error(
      "MediMatch API request failed",
      error instanceof Error ? error.message : "unknown error",
    );
    return NextResponse.json(
      { error: "Ma’lumotni saqlash yoki o‘qishda xato. Qayta urinib ko‘ring." },
      { status: 500 },
    );
  }
}
async function dispatch(request: NextRequest) {
  const response = await handle(request);
  if (request.method !== "GET" && response.ok) void deliverEmails();
  return response;
}
export {
  dispatch as GET,
  dispatch as POST,
  dispatch as PUT,
  dispatch as DELETE,
};
