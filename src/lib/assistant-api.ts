import "server-only";
import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonBody } from "./api-request";
import { withinRateLimit } from "./rate-limit";
import { answerAssistant } from "./assistant";
import { encryptionKey, mutateStore, readStore } from "./store";
import { MediationError } from "./mediation";
import {
  assistantUsage,
  ASSISTANT_REQUEST_LEASE_MS,
  reserveAssistantRequest,
} from "./assistant-quota";
import type { AssistantReply } from "./assistant-types";
import type { User } from "./types";

const cookieName = "kelishuv-assistant";
const pending = new Map<
  string,
  { hash: string; operation: Promise<AssistantReply> }
>();
function visitor(request: NextRequest, user?: User) {
  if (user) return { subject: `user:${user.id}`, cookie: null };
  const supplied = request.cookies.get(cookieName)?.value || "";
  const [nonce, signature] = supplied.split(".");
  const sign = (value: string) =>
    createHmac("sha256", encryptionKey())
      .update(`assistant:${value}`)
      .digest("base64url");
  if (
    /^[a-f0-9-]{36}$/.test(nonce || "") &&
    /^[A-Za-z0-9_-]{43}$/.test(signature || "") &&
    timingSafeEqual(Buffer.from(signature), Buffer.from(sign(nonce)))
  )
    return { subject: `guest:${nonce}`, cookie: null };
  const id = randomUUID();
  return { subject: `guest:${id}`, cookie: `${id}.${sign(id)}` };
}
export async function handleAssistantRequest(
  request: NextRequest,
  user?: User,
): Promise<Response | null> {
  const route = request.nextUrl.pathname;
  if (route !== "/api/assistant" && route !== "/api/assistant/usage")
    return null;
  if (
    !(route === "/api/assistant/usage" && request.method === "GET") &&
    !(route === "/api/assistant" && request.method === "POST")
  )
    return null;
  const identity = visitor(request, user);
  const response = (value: unknown, status = 200) => {
    const result = NextResponse.json(value, {
      status,
      headers: { "Cache-Control": "no-store" },
    });
    if (identity.cookie)
      result.cookies.set(cookieName, identity.cookie, {
        httpOnly: true,
        sameSite: "lax",
        secure:
          request.nextUrl.protocol === "https:" ||
          request.headers.get("x-forwarded-proto") === "https",
        path: "/",
        maxAge: 31536000,
      });
    return result;
  };
  if (request.method === "GET")
    return response({
      usage: assistantUsage(await readStore(), identity.subject),
      account: Boolean(user),
    });
  if (!(await withinRateLimit(`assistant-query:${identity.subject}`, 12)))
    return response(
      {
        error:
          "Yordamchiga so‘rovlar ko‘paydi. Bir daqiqadan so‘ng qayta urinib ko‘ring.",
      },
      429,
    );
  const input = z
    .object({
      requestId: z.string().uuid().optional(),
      question: z.string().trim().min(3).max(2000),
      context: z.array(z.string().max(2000)).max(2).default([]),
      externalConsent: z.boolean().default(false),
      locale: z.enum(["uz", "uz-Cyrl", "ru"]).default("uz"),
    })
    .parse(await jsonBody(request));
  if (
    /\b\d{14}\b|\b[A-Z]{2}\d{7}\b/i.test(
      [input.question, ...input.context].join(" "),
    )
  )
    return response(
      {
        error:
          "Pasport raqami va JSHSHIRni olib tashlab, savolingizni umumiy shaklda yozing.",
      },
      400,
    );
  const requestId = input.requestId || randomUUID();
  const hash = createHash("sha256")
    .update(
      JSON.stringify([
        input.question,
        input.context,
        input.externalConsent,
        input.locale,
      ]),
    )
    .digest("hex");
  const key = `${identity.subject}:${requestId}`;
  let work = pending.get(key);
  if (work && work.hash !== hash)
    return response(
      { error: "So‘rov mazmuni o‘zgargan. Yangi savol yuboring." },
      409,
    );
  if (!work) {
    const operation = (async () => {
      const reservation = await mutateStore((data) => {
        if (
          user &&
          !data.users.some((item) => item.id === user.id && item.isActive)
        )
          throw new MediationError(401, "Hisobga qayta kiring.");
        return {
          ...reserveAssistantRequest(data, identity.subject, requestId, hash),
        };
      });
      if (reservation.reply && reservation.status === "COMPLETE")
        return {
          ...reservation.reply,
          usage: assistantUsage(await readStore(), identity.subject),
        };
      try {
        const reply = await answerAssistant(
          input.question,
          input.context,
          input.externalConsent,
          input.locale,
        );
        return await mutateStore((data) => {
          const current = data.assistantRequests?.find(
            (item) => item.id === reservation.id,
          );
          if (
            !current ||
            current.attemptId !== reservation.attemptId ||
            current.status !== "PENDING" ||
            Date.now() - Date.parse(current.startedAt) >=
              ASSISTANT_REQUEST_LEASE_MS
          )
            throw new MediationError(
              409,
              "So‘rovning kutish muddati tugadi. Qayta yuboring.",
            );
          if (
            user &&
            !data.users.some((item) => item.id === user.id && item.isActive)
          )
            throw new MediationError(401, "Hisobga qayta kiring.");
          current.status = "COMPLETE";
          current.completedAt = new Date().toISOString();
          current.reply = reply;
          return { ...reply, usage: assistantUsage(data, identity.subject) };
        });
      } catch (error) {
        await mutateStore((data) => {
          const current = data.assistantRequests?.find(
            (item) => item.id === reservation.id,
          );
          if (
            current?.attemptId === reservation.attemptId &&
            current.status === "PENDING"
          )
            current.status = "FAILED";
        });
        throw error;
      }
    })();
    work = { hash, operation };
    pending.set(key, work);
  }
  try {
    return response(await work.operation);
  } catch (error) {
    if (error instanceof MediationError)
      return response(
        {
          error: error.message,
          usage: assistantUsage(await readStore(), identity.subject),
        },
        error.status,
      );
    throw error;
  } finally {
    if (pending.get(key) === work) pending.delete(key);
  }
}
