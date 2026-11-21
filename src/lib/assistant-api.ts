import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonBody } from "./api-request";
import { withinRateLimit } from "./rate-limit";
import { answerAssistant } from "./assistant";

export async function handleAssistantRequest(
  request: NextRequest,
): Promise<Response | null> {
  if (
    request.nextUrl.pathname !== "/api/assistant" ||
    request.method !== "POST"
  )
    return null;
  if (
    !(await withinRateLimit(
      `assistant:${request.headers.get("x-forwarded-for") || "local"}`,
      12,
    ))
  )
    return NextResponse.json(
      {
        error:
          "Yordamchiga so‘rovlar ko‘paydi. Bir daqiqadan so‘ng qayta urinib ko‘ring.",
      },
      { status: 429 },
    );
  const input = z
    .object({
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
    return NextResponse.json(
      {
        error:
          "Pasport raqami va JSHSHIRni olib tashlab, savolingizni umumiy shaklda yozing.",
      },
      { status: 400 },
    );
  return NextResponse.json(
    await answerAssistant(
      input.question,
      input.context,
      input.externalConsent,
      input.locale,
    ),
    { headers: { "Cache-Control": "no-store" } },
  );
}
