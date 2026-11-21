import "server-only";
import { NextRequest } from "next/server";
import { z } from "zod";
import { MediationError } from "./mediation";

export function serviceStatus() {
  return {
    sms: Boolean(process.env.ESKIZ_TOKEN && process.env.ESKIZ_SENDER),
    identity: Boolean(
      process.env.IDENTITY_API_URL &&
        process.env.IDENTITY_API_KEY &&
        process.env.IDENTITY_WEBHOOK_SECRET &&
        process.env.IDENTITY_REDIRECT_HOSTS,
    ),
    payment: Boolean(process.env.PAYME_MERCHANT_ID && process.env.PAYME_SECRET),
    zoom: Boolean(
      process.env.ZOOM_ACCOUNT_ID &&
        process.env.ZOOM_CLIENT_ID &&
        process.env.ZOOM_CLIENT_SECRET &&
        process.env.ZOOM_HOST_USER_ID,
    ),
    commissionPercent: 15,
  };
}

export function applicationOrigin(request: NextRequest) {
  const value = process.env.APP_PUBLIC_URL || process.env.AUTH_URL;
  if (
    !value &&
    !(
      ["localhost", "127.0.0.1", "[::1]"].includes(request.nextUrl.hostname) &&
      ["2345", "2346"].includes(request.nextUrl.port)
    )
  )
    throw new MediationError(
      503,
      "Platformaning ommaviy HTTPS manzilini sozlang.",
    );
  const url = new URL(value || request.nextUrl.origin);
  if (
    url.protocol !== "https:" &&
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  )
    throw new MediationError(
      503,
      "Platformaning ommaviy HTTPS manzilini sozlang.",
    );
  return url.origin;
}

async function providerJson(response: Response) {
  const raw = await response.text();
  if (!response.ok || raw.length > 100000)
    throw new MediationError(
      502,
      "Xizmat javobi olinmadi. Ulanish holatini tekshiring.",
    );
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new MediationError(502, "Xizmat javobining shaklini tekshiring.");
  }
}

const smsRequests = new Map<string, Promise<string>>();

export async function sendSms(
  phone: string,
  message: string,
  deliveryId?: string,
) {
  if (!deliveryId) return dispatchSms(phone, message);
  const existing = smsRequests.get(deliveryId);
  if (existing) return existing;
  const operation = dispatchSms(phone, message);
  smsRequests.set(deliveryId, operation);
  try {
    return await operation;
  } finally {
    if (smsRequests.get(deliveryId) === operation)
      smsRequests.delete(deliveryId);
  }
}

async function dispatchSms(phone: string, message: string) {
  if (!serviceStatus().sms)
    throw new MediationError(
      503,
      "SMS uchun Eskiz hisobi va jo‘natuvchi nomini sozlash kerak.",
    );
  const response = await fetch("https://notify.eskiz.uz/api/message/sms/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.ESKIZ_TOKEN}` },
    body: new URLSearchParams({
      mobile_phone: phone.replace(/\D/g, ""),
      message,
      from: process.env.ESKIZ_SENDER!,
    }),
    signal: AbortSignal.timeout(15000),
  });
  const result = z
    .object({ id: z.string().min(1) })
    .parse(await providerJson(response));
  return result.id;
}

export class IdentitySessionError extends MediationError {
  constructor(public ambiguous: boolean) {
    super(
      502,
      ambiguous
        ? "Face ID sessiyasi javobi olinmadi. Provayder natijasi kutilmoqda."
        : "Face ID ulanishi yoki provayder ruxsatlarini tekshiring.",
    );
  }
}

export async function startIdentitySession(
  reference: string,
  returnUrl: string,
) {
  if (!serviceStatus().identity)
    throw new MediationError(
      503,
      "Face ID uchun shaxsni tekshirish provayderini ulash kerak.",
    );
  let base: URL;
  try {
    base = new URL(process.env.IDENTITY_API_URL!);
  } catch {
    throw new IdentitySessionError(false);
  }
  if (base.protocol !== "https:") throw new IdentitySessionError(false);
  try {
    const response = await fetch(`${base.href.replace(/\/$/, "")}/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.IDENTITY_API_KEY}`,
        "Idempotency-Key": reference,
      },
      body: JSON.stringify({
        reference,
        returnUrl,
        callbackUrl: `${new URL(returnUrl).origin}/api/webhooks/identity`,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (
      response.status >= 400 &&
      response.status < 500 &&
      response.status !== 408
    )
      throw new IdentitySessionError(false);
    const result = z
      .object({ id: z.string().min(1).max(200), url: z.string().url() })
      .parse(await providerJson(response));
    const redirect = new URL(result.url);
    const hosts = (process.env.IDENTITY_REDIRECT_HOSTS || "")
      .split(",")
      .map((item) => item.trim());
    if (
      redirect.protocol !== "https:" ||
      !hosts.includes(redirect.hostname) ||
      redirect.username ||
      redirect.password
    )
      throw new MediationError(
        502,
        "Face ID oynasi manzilini provayder sozlamalarida tekshiring.",
      );
    return result;
  } catch (failure) {
    if (failure instanceof IdentitySessionError) throw failure;
    throw new IdentitySessionError(true);
  }
}

export class ZoomCreationError extends MediationError {
  constructor(public ambiguous: boolean) {
    super(
      502,
      ambiguous
        ? "Zoom natijasi olinmadi. Bir daqiqadan so‘ng holatini qayta tekshiring."
        : "Zoom ulanishi yoki ruxsatlarini tekshiring va qayta urinib ko‘ring.",
    );
  }
}

async function zoomToken() {
  if (!serviceStatus().zoom)
    throw new MediationError(
      503,
      "Zoom Server-to-Server OAuth hisobini sozlash kerak.",
    );
  try {
    const tokenResponse = await fetch("https://zoom.us/oauth/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "account_credentials",
        account_id: process.env.ZOOM_ACCOUNT_ID!,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const token = z
      .object({ access_token: z.string().min(1) })
      .parse(await providerJson(tokenResponse));
    return token.access_token;
  } catch {
    throw new ZoomCreationError(false);
  }
}

function zoomResult(meeting: { id: string | number; join_url: string }) {
  const url = new URL(meeting.join_url);
  if (
    url.protocol !== "https:" ||
    !(url.hostname === "zoom.us" || url.hostname.endsWith(".zoom.us"))
  )
    throw new ZoomCreationError(true);
  return {
    meetingId: String(meeting.id),
    joinUrl: meeting.join_url,
    createdAt: new Date().toISOString(),
  };
}

export async function createZoomMeeting(input: {
  reference: string;
  start: string;
  duration: number;
  beforeCreate?: () => Promise<void>;
}) {
  const token = await zoomToken();
  await input.beforeCreate?.();
  try {
    const response = await fetch(
      `https://api.zoom.us/v2/users/${encodeURIComponent(process.env.ZOOM_HOST_USER_ID!)}/meetings`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          topic: "Kelishuv mediatsiya uchrashuvi",
          type: 2,
          start_time: input.start,
          duration: input.duration,
          timezone: "Asia/Tashkent",
          agenda: input.reference,
          settings: {
            waiting_room: true,
            join_before_host: false,
            approval_type: 2,
            meeting_authentication: false,
          },
        }),
        signal: AbortSignal.timeout(15000),
      },
    );
    if (
      response.status >= 400 &&
      response.status < 500 &&
      response.status !== 408
    )
      throw new ZoomCreationError(false);
    const meeting = z
      .object({
        id: z.union([z.string(), z.number()]),
        join_url: z.string().url(),
      })
      .parse(await providerJson(response));
    return zoomResult(meeting);
  } catch (failure) {
    if (failure instanceof ZoomCreationError) throw failure;
    throw new ZoomCreationError(true);
  }
}

export async function findZoomMeeting(
  reference: string,
  scheduledAt: string,
  duration?: number,
) {
  const startedAt = Date.now();
  const token = await zoomToken();
  const meetingSchema = z.object({
    id: z.union([z.string(), z.number()]),
    agenda: z.string().optional(),
    start_time: z.string().optional(),
    join_url: z.string().optional(),
    duration: z.number().optional(),
  });
  let pageToken = "";
  for (let page = 0; page < 5; page++) {
    if (Date.now() - startedAt > 30000) throw new ZoomCreationError(true);
    const query = new URLSearchParams({
      type: "scheduled",
      page_size: "100",
      ...(pageToken ? { next_page_token: pageToken } : {}),
    });
    const response = await fetch(
      `https://api.zoom.us/v2/users/${encodeURIComponent(process.env.ZOOM_HOST_USER_ID!)}/meetings?${query}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(15000),
        cache: "no-store",
      },
    );
    const result = z
      .object({
        meetings: z.array(meetingSchema).max(100),
        next_page_token: z.string().optional(),
      })
      .parse(await providerJson(response));
    for (const candidate of result.meetings) {
      if (Date.now() - startedAt > 30000) throw new ZoomCreationError(true);
      let meeting = candidate;
      if (
        (meeting.agenda === reference && !meeting.join_url) ||
        (meeting.agenda === undefined &&
          Math.abs(
            Date.parse(meeting.start_time || "") - Date.parse(scheduledAt),
          ) < 60000)
      ) {
        const details = await fetch(
          `https://api.zoom.us/v2/meetings/${encodeURIComponent(String(meeting.id))}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(15000),
            cache: "no-store",
          },
        );
        meeting = meetingSchema.parse(await providerJson(details));
      }
      if (
        meeting.agenda === reference &&
        ((meeting.start_time &&
          Math.abs(Date.parse(meeting.start_time) - Date.parse(scheduledAt)) >=
            60000) ||
          (meeting.duration && duration && meeting.duration !== duration))
      )
        throw new MediationError(
          409,
          "Zoom uchrashuvi va sessiya vaqti mos kelmadi. Administrator bilan sessiyani qayta belgilang.",
        );
      if (meeting.agenda === reference && meeting.join_url)
        return zoomResult({ id: meeting.id, join_url: meeting.join_url });
      if (meeting.agenda === reference) throw new ZoomCreationError(true);
    }
    pageToken = result.next_page_token || "";
    if (!pageToken) return null;
  }
  throw new MediationError(
    409,
    "Zoom uchrashuvlari ro‘yxati tekshiruv chegarasidan katta. Administrator ushbu sessiya identifikatori bilan provayder holatini aniqlashtirsin.",
  );
}
