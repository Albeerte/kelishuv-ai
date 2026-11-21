import "server-only";
import {
  createHmac,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { boundedBody, documentForm, jsonBody } from "./api-request";
import { loadDocument, removeDocument, saveDocument } from "./documents";
import { extractEvidence } from "./evidence-extraction";
import { runStructuredAI } from "./ai-provider";
import { encryptionKey, readStore } from "./store";
import { MediationError } from "./mediation";
import { EMPTY_IDENTITY_FIELDS, normalizePhone } from "./service-catalog";
import {
  applicationOrigin,
  sendSms,
  serviceStatus,
  startIdentitySession,
  IdentitySessionError,
} from "./service-providers";
import { withinRateLimit } from "./rate-limit";
import type { AppData, User } from "./types";
import type { IdentityCheck } from "./service-types";

type Mutate = <T>(operation: (data: AppData) => T) => Promise<T>;
const fieldsSchema = z.object({
  firstName: z.string().trim().max(100),
  lastName: z.string().trim().max(100),
  middleName: z.string().trim().max(100),
  birthDate: z
    .string()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/)
    .refine((value) => {
      if (!value) return true;
      const date = Date.parse(`${value}T00:00:00Z`);
      return (
        Number.isFinite(date) &&
        new Date(date).toISOString().slice(0, 10) === value &&
        date <= Date.now() &&
        value >= "1900-01-01"
      );
    }, "Tug‘ilgan sanani tekshiring."),
  address: z.string().trim().max(500),
  documentNumber: z.string().trim().max(40),
});
function ownCheck(data: AppData, userId: string) {
  const existing = data.identityChecks?.find((item) => item.userId === userId);
  if (existing) return existing;
  const check: IdentityCheck = {
    id: randomUUID(),
    userId,
    fields: { ...EMPTY_IDENTITY_FIELDS },
    status: "DRAFT",
    updatedAt: new Date().toISOString(),
  };
  (data.identityChecks ??= []).push(check);
  return check;
}
function publicCheck(check: IdentityCheck | undefined) {
  if (!check) return null;
  return {
    ...check,
    status: sessionExpired(check) ? "REVIEW_REQUIRED" : check.status,
    document: check.document
      ? { mime: check.document.mime, uploadedAt: check.document.uploadedAt }
      : undefined,
    sessionId: undefined,
    sessionUrl: undefined,
    canResume: Boolean(
      check.status === "PENDING" && !sessionExpired(check) && check.sessionUrl,
    ),
    pendingDocuments: undefined,
  };
}
async function cleanupIdentityDocuments(userId: string, mutate: Mutate) {
  const snapshot = (await readStore()).identityChecks?.find(
    (item) => item.userId === userId,
  );
  for (const pending of (snapshot?.pendingDocuments || [])
    .filter((item) => Date.parse(item.removeAfter) <= Date.now())
    .slice(0, 5)) {
    const cleanupId = randomUUID();
    const claimed = await mutate((data) => {
      const check = data.identityChecks?.find((item) => item.userId === userId);
      const entry = check?.pendingDocuments?.find(
        (item) =>
          item.storageKey === pending.storageKey &&
          Date.parse(item.removeAfter) <= Date.now(),
      );
      if (!entry || check?.document?.storageKey === pending.storageKey)
        return false;
      entry.cleanupId = cleanupId;
      return true;
    });
    if (!claimed) continue;
    try {
      await removeDocument(pending.storageKey);
    } catch (failure) {
      if (
        !(
          failure &&
          typeof failure === "object" &&
          "code" in failure &&
          failure.code === "ENOENT"
        )
      )
        continue;
    }
    await mutate((data) => {
      const check = data.identityChecks?.find((item) => item.userId === userId);
      if (check)
        check.pendingDocuments = (check.pendingDocuments || []).filter(
          (item) =>
            item.storageKey !== pending.storageKey ||
            item.cleanupId !== cleanupId,
        );
    });
  }
}
function sessionExpired(check: IdentityCheck) {
  const startedAt = Date.parse(check.sessionStartedAt || check.updatedAt);
  return (
    check.status === "PENDING" &&
    (!Number.isFinite(startedAt) || startedAt <= Date.now() - 1800000)
  );
}
function releaseExpiredSession(check: IdentityCheck) {
  if (!sessionExpired(check)) return;
  check.id = randomUUID();
  check.status = "REVIEW_REQUIRED";
  check.sessionId = undefined;
  check.sessionUrl = undefined;
  check.sessionStartedAt = undefined;
  check.updatedAt = new Date().toISOString();
}
function codeHash(challengeId: string, code: string) {
  return createHmac("sha256", encryptionKey())
    .update(`${challengeId}:${code}`)
    .digest("hex");
}
function equalNames(first: string, second: string) {
  const normalize = (value: string) =>
    value
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]/gu, "");
  return normalize(first) === normalize(second);
}

export async function identityWebhook(
  request: NextRequest,
  mutate: Mutate,
): Promise<Response | null> {
  if (
    request.nextUrl.pathname !== "/api/webhooks/identity" ||
    request.method !== "POST"
  )
    return null;
  const secret = process.env.IDENTITY_WEBHOOK_SECRET;
  if (!secret)
    throw new MediationError(503, "Shaxsni tekshirish xizmati sozlanmagan.");
  const raw = await boundedBody(request, 12000);
  const timestamp = request.headers.get("x-identity-timestamp") || "";
  const signature = request.headers.get("x-identity-signature") || "";
  const expected = createHmac("sha256", secret)
    .update(timestamp)
    .update(".")
    .update(raw)
    .digest();
  if (
    !/^\d{13}$/.test(timestamp) ||
    Math.abs(Date.now() - Number(timestamp)) > 300000 ||
    !/^[a-f0-9]{64}$/i.test(signature) ||
    !timingSafeEqual(expected, Buffer.from(signature, "hex"))
  )
    throw new MediationError(401, "Provayder imzosi mos kelmadi.");
  const input = z
    .object({
      reference: z.string().uuid(),
      sessionId: z.string().min(1).max(200),
      status: z.enum(["VERIFIED", "FAILED"]),
      liveness: z.boolean(),
      documentVerified: z.boolean(),
      fields: fieldsSchema,
    })
    .parse(JSON.parse(raw.toString("utf8")));
  await mutate((data) => {
    const check = data.identityChecks?.find(
      (item) => item.id === input.reference,
    );
    if (!check) throw new MediationError(404, "Tekshiruv sessiyasi topilmadi.");
    if (check.sessionId && check.sessionId !== input.sessionId)
      throw new MediationError(404, "Tekshiruv sessiyasi mos kelmadi.");
    if (check.status === "VERIFIED" || check.status === "FAILED") return;
    if (check.status !== "PENDING")
      throw new MediationError(409, "Tekshiruv sessiyasi yakunlangan.");
    if (sessionExpired(check))
      throw new MediationError(
        410,
        "Tekshiruv muddati tugagan. Yangi sessiya oching.",
      );
    check.sessionId = input.sessionId;
    const matches =
      equalNames(check.fields.firstName, input.fields.firstName) &&
      equalNames(check.fields.lastName, input.fields.lastName) &&
      check.fields.birthDate === input.fields.birthDate &&
      equalNames(check.fields.documentNumber, input.fields.documentNumber);
    const verified =
      input.status === "VERIFIED" &&
      input.liveness &&
      input.documentVerified &&
      matches;
    check.status = verified ? "VERIFIED" : "FAILED";
    check.nameMatches = matches;
    check.verifiedAt = verified ? new Date().toISOString() : undefined;
    check.updatedAt = new Date().toISOString();
    if (verified) {
      const currentUser = data.users?.find((item) => item.id === check.userId);
      if (currentUser) {
        currentUser.fullName = [
          check.fields.firstName,
          check.fields.lastName,
          check.fields.middleName,
        ]
          .filter(Boolean)
          .join(" ");
        const mediator = data.mediators?.find(
          (item) => item.userId === currentUser.id,
        );
        if (mediator) mediator.name = currentUser.fullName;
      }
    }
  });
  return NextResponse.json({ received: true });
}

export async function handleIdentityRequest(
  request: NextRequest,
  user: User,
  mutate: Mutate,
): Promise<Response | null> {
  const route = request.nextUrl.pathname;
  if (!route.startsWith("/api/identity")) return null;
  if (route === "/api/identity" && request.method === "GET") {
    await cleanupIdentityDocuments(user.id, mutate);
    const data = await readStore();
    const current = data.users.find((item) => item.id === user.id)!;
    return NextResponse.json(
      {
        check: publicCheck(
          data.identityChecks?.find((item) => item.userId === user.id),
        ),
        phone: current.phone,
        phoneVerifiedAt: current.phoneVerifiedAt,
        services: serviceStatus(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  if (route === "/api/identity/phone/send" && request.method === "POST") {
    if (!serviceStatus().sms)
      throw new MediationError(
        503,
        "SMS xizmati ulanmoqda. Telefon raqamingiz tasdiqlashni kutmoqda.",
      );
    if (!(await withinRateLimit(`otp-send:${user.id}`, 2)))
      throw new MediationError(
        429,
        "Kod uchun bir daqiqadan so‘ng qayta urinib ko‘ring.",
      );
    const code = String(randomInt(100000, 1000000));
    const challenge = await mutate((data) => {
      const current = data.users.find((item) => item.id === user.id)!;
      const phone = normalizePhone(current.phone);
      if (!phone)
        throw new MediationError(
          400,
          "Profilga +998 bilan telefon raqamingizni kiriting.",
        );
      const previous = data.phoneChallenges?.find(
        (item) =>
          item.userId === user.id &&
          Date.parse(item.createdAt) > Date.now() - 60000,
      );
      if (previous)
        throw new MediationError(429, "Yangi kod uchun 60 soniya kuting.");
      const id = randomUUID();
      data.phoneChallenges = (data.phoneChallenges || []).filter(
        (item) =>
          Date.parse(item.expiresAt) > Date.now() && item.userId !== user.id,
      );
      const challenge = {
        id,
        userId: user.id,
        phone,
        codeHash: codeHash(id, code),
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 300000).toISOString(),
        attempts: 0,
        accepted: false,
      };
      data.phoneChallenges.push(challenge);
      return challenge;
    });
    try {
      await sendSms(
        challenge.phone,
        `Kelishuv tasdiqlash kodi: ${code}. Kod 5 daqiqa amal qiladi. Kodni boshqalarga bermang.`,
      );
      await mutate((data) => {
        const current = data.phoneChallenges?.find(
          (item) => item.id === challenge.id,
        );
        if (current) current.accepted = true;
      });
    } catch {
      throw new MediationError(
        502,
        "SMS yuborilishi tasdiqlanmadi. 60 soniyadan keyin qayta urinib ko‘ring.",
      );
    }
    return NextResponse.json({
      challengeId: challenge.id,
      expiresAt: challenge.expiresAt,
    });
  }
  if (route === "/api/identity/phone/verify" && request.method === "POST") {
    const input = z
      .object({
        challengeId: z.string().uuid(),
        code: z.string().regex(/^\d{6}$/),
      })
      .parse(await jsonBody(request));
    const result = await mutate((data) => {
      const challenge = data.phoneChallenges?.find(
        (item) => item.id === input.challengeId && item.userId === user.id,
      );
      const current = data.users.find((item) => item.id === user.id)!;
      if (
        !challenge?.accepted ||
        challenge.attempts >= 5 ||
        Date.parse(challenge.expiresAt) <= Date.now() ||
        normalizePhone(current.phone) !== challenge.phone
      )
        return {
          ok: false,
          error:
            "Kod muddati tugagan yoki urinishlar tugagan. Yangi kod oling.",
        };
      challenge.attempts += 1;
      if (
        !timingSafeEqual(
          Buffer.from(challenge.codeHash, "hex"),
          Buffer.from(codeHash(challenge.id, input.code), "hex"),
        )
      )
        return { ok: false, error: "Kod mos kelmadi." };
      current.phoneVerifiedAt = new Date().toISOString();
      data.phoneChallenges = data.phoneChallenges!.filter(
        (item) => item.userId !== user.id,
      );
      return { ok: true, error: "" };
    });
    if (!result.ok) throw new MediationError(400, result.error);
    return NextResponse.json({ verified: true });
  }
  if (route === "/api/identity/document" && request.method === "POST") {
    const { form, file, mime } = await documentForm(request);
    if (!["image/png", "image/jpeg"].includes(mime))
      throw new MediationError(
        400,
        "Pasportning JPG yoki PNG rasmini yuklang.",
      );
    if (form.get("consent") !== "true")
      throw new MediationError(
        400,
        "Shaxsiy hujjatni qayta ishlashga rozilik bering.",
      );
    const buffer = Buffer.from(await file.arrayBuffer());
    const { imageSize } = await import("image-size");
    const size = imageSize(buffer);
    if (
      !size.width ||
      !size.height ||
      size.width * size.height > 36000000 ||
      !["png", "jpg"].includes(size.type || "")
    )
      throw new MediationError(400, "Rasm formati va o‘lchamini tekshiring.");
    const key = randomUUID();
    await mutate((data) => {
      const check = ownCheck(data, user.id);
      releaseExpiredSession(check);
      if (check.status === "PENDING")
        throw new MediationError(
          409,
          "Joriy Face ID tekshiruvi yakunlanishini kuting.",
        );
      (check.pendingDocuments ??= []).push({
        storageKey: key,
        removeAfter: new Date(Date.now() + 3600000).toISOString(),
      });
    });
    // The precommitted cleanup record retains failed or interrupted uploads.
    await saveDocument(key, buffer);
    const published = await mutate((data) => {
      const check = ownCheck(data, user.id);
      releaseExpiredSession(check);
      if (check.status === "PENDING")
        throw new MediationError(
          409,
          "Joriy Face ID tekshiruvi yakunlanishini kuting.",
        );
      const reservation = check.pendingDocuments?.find(
        (item) => item.storageKey === key,
      );
      if (
        !reservation ||
        reservation.cleanupId ||
        Date.parse(reservation.removeAfter) <= Date.now()
      ) {
        check.pendingDocuments = (check.pendingDocuments || []).filter(
          (item) => item.storageKey !== key,
        );
        check.pendingDocuments.push({
          storageKey: key,
          removeAfter: new Date().toISOString(),
        });
        return false;
      }
      const previous = check.document?.storageKey;
      check.pendingDocuments = (check.pendingDocuments || []).filter(
        (item) => item.storageKey !== key,
      );
      if (previous)
        check.pendingDocuments.push({
          storageKey: previous,
          removeAfter: new Date().toISOString(),
        });
      Object.assign(check, {
        document: {
          storageKey: key,
          mime,
          uploadedAt: new Date().toISOString(),
        },
        documentConsentAt: new Date().toISOString(),
        status: "REVIEW_REQUIRED",
        extractedFields: undefined,
        extractionMessage: undefined,
        verifiedAt: undefined,
        nameMatches: undefined,
        sessionId: undefined,
        sessionUrl: undefined,
        updatedAt: new Date().toISOString(),
      });
      return true;
    });
    if (!published)
      throw new MediationError(
        409,
        "Hujjat yuklash muddati tugagan. Rasmingizni qayta tanlang.",
      );
    await cleanupIdentityDocuments(user.id, mutate);
    return NextResponse.json({
      uploaded: true,
      message:
        "Hujjat shaxsiy tekshiruvga yuklandi. AI orqali maydonlarni ajratishingiz mumkin.",
    });
  }
  if (route === "/api/identity/extract" && request.method === "POST") {
    const input = z
      .object({
        localConsent: z.literal(true),
        externalConsent: z.boolean().default(false),
      })
      .parse(await jsonBody(request));
    const snapshot = (await readStore()).identityChecks?.find(
      (item) => item.userId === user.id,
    );
    if (!snapshot?.document)
      throw new MediationError(400, "Avval pasport rasmini yuklang.");
    if (
      snapshot.status === "VERIFIED" ||
      (snapshot.status === "PENDING" && !sessionExpired(snapshot))
    )
      throw new MediationError(409, "Joriy tekshiruv tugashini kuting.");
    if (!(await withinRateLimit(`identity-extract:${user.id}`, 3)))
      throw new MediationError(
        429,
        "Tahlil uchun bir daqiqadan keyin qayta urinib ko‘ring.",
      );
    let contents: Buffer;
    try {
      contents = await loadDocument(snapshot.document.storageKey);
    } catch {
      throw new MediationError(
        409,
        "Hujjat o‘qilmadi yoki yangilangan. Joriy hujjatni ochib, tahlilni qayta boshlang.",
      );
    }
    const extraction = await extractEvidence(
      {
        id: snapshot.id,
        name: "identity.png",
        mime: snapshot.document.mime,
        size: 0,
        storageKey: snapshot.document.storageKey,
        uploadedAt: snapshot.updatedAt,
      },
      contents,
      input,
    );
    let fields = { ...EMPTY_IDENTITY_FIELDS };
    let message =
      "Tasvirdan maydonlar ajratilmadi. Maydonlarni qo‘lda tekshirib kiriting.";
    if (extraction.text.trim()) {
      try {
        const result = await runStructuredAI(
          z.toJSONSchema(fieldsSchema),
          "Extract only explicitly present passport fields from this transcription. Use empty strings for unreadable fields. Date format YYYY-MM-DD. Never invent names, dates, addresses or document numbers. These are unverified OCR suggestions.",
          extraction.text.slice(0, 18000),
          input,
        );
        fields = fieldsSchema.parse(result.data);
        message =
          "AI ajratgan maydonlarni asl hujjat bilan solishtirib tekshiring.";
      } catch {
        message =
          "Matn ajratildi. Tuzilgan maydonlarni qo‘lda kiriting va tekshiring.";
      }
    }
    const check = await mutate((data) => {
      const current = ownCheck(data, user.id);
      releaseExpiredSession(current);
      if (
        current.document?.storageKey !== snapshot.document!.storageKey ||
        current.status === "PENDING" ||
        current.status === "VERIFIED"
      )
        throw new MediationError(
          409,
          "Hujjat yoki tekshiruv holati o‘zgargan. Sahifani yangilang.",
        );
      current.extractedFields = fields;
      current.extractionConsent = {
        local: input.localConsent,
        external: input.externalConsent,
        at: new Date().toISOString(),
      };
      current.fields = Object.fromEntries(
        Object.keys(current.fields).map((key) => [
          key,
          current.fields[key as keyof typeof fields] ||
            fields[key as keyof typeof fields],
        ]),
      ) as typeof fields;
      current.extractionMessage = message;
      current.updatedAt = new Date().toISOString();
      return publicCheck(current);
    });
    return NextResponse.json({ check });
  }
  if (route === "/api/identity/fields" && request.method === "PUT") {
    const fields = fieldsSchema.parse(await jsonBody(request));
    const check = await mutate((data) => {
      const current = ownCheck(data, user.id);
      releaseExpiredSession(current);
      if (current.status === "PENDING" || current.status === "VERIFIED")
        throw new MediationError(
          409,
          "Tasdiqlangan yoki tekshirilayotgan ma’lumotlar qulflangan.",
        );
      current.fields = fields;
      current.nameMatches =
        current.extractedFields?.firstName && current.extractedFields.lastName
          ? equalNames(fields.firstName, current.extractedFields.firstName) &&
            equalNames(fields.lastName, current.extractedFields.lastName)
          : undefined;
      current.updatedAt = new Date().toISOString();
      return publicCheck(current);
    });
    return NextResponse.json({ check });
  }
  if (route === "/api/identity/session" && request.method === "POST") {
    z.object({ consent: z.literal(true) }).parse(await jsonBody(request));
    if (!serviceStatus().identity)
      throw new MediationError(
        503,
        "Face ID provayderini ulash kutilmoqda. Hujjat va maydonlaringiz saqlandi.",
      );
    const returnUrl = `${applicationOrigin(request)}/verify`;
    const check = await mutate((data) => {
      const current = ownCheck(data, user.id);
      if (!data.users.find((item) => item.id === user.id)?.phoneVerifiedAt)
        throw new MediationError(
          409,
          "Avval telefon raqamingizni SMS orqali tasdiqlang.",
        );
      if (
        !current.document ||
        !current.fields.firstName ||
        !current.fields.lastName ||
        !current.fields.documentNumber ||
        !current.fields.birthDate
      )
        throw new MediationError(
          400,
          "Hujjat, ism, familiya, tug‘ilgan sana va hujjat raqamini to‘ldiring.",
        );
      if (current.status === "VERIFIED")
        throw new MediationError(409, "Shaxs tasdiqlangan.");
      if (
        current.status === "PENDING" &&
        Date.parse(current.sessionStartedAt || "") > Date.now() - 1800000
      ) {
        if (current.sessionUrl) return structuredClone(current);
        throw new MediationError(
          409,
          "Face ID sessiyasi davom etmoqda. Provayder natijasini kuting.",
        );
      }
      current.id = randomUUID();
      current.status = "PENDING";
      current.sessionStartedAt = new Date().toISOString();
      current.providerConsentAt = new Date().toISOString();
      current.sessionId = undefined;
      current.sessionUrl = undefined;
      return structuredClone(current);
    });
    if (check.sessionUrl) return NextResponse.json({ url: check.sessionUrl });
    try {
      const session = await startIdentitySession(check.id, returnUrl);
      await mutate((data) => {
        const current = data.identityChecks?.find(
          (item) => item.id === check.id,
        );
        if (!current)
          throw new MediationError(409, "Tekshiruv sessiyasi yangilangan.");
        if (current.sessionId && current.sessionId !== session.id)
          throw new MediationError(
            502,
            "Provayder sessiyasi natijalari mos kelmadi.",
          );
        if (current.status === "PENDING") {
          current.sessionId = session.id;
          current.sessionUrl = session.url;
        }
      });
      return NextResponse.json({ url: session.url });
    } catch (error) {
      await mutate((data) => {
        const current = data.identityChecks?.find(
          (item) => item.id === check.id,
        );
        if (
          current?.status === "PENDING" &&
          error instanceof IdentitySessionError &&
          !error.ambiguous
        )
          current.status = "FAILED";
      });
      throw error;
    }
  }
  return null;
}
