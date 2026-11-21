import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { jsonBody } from "./api-request";
import { readStore } from "./store";
import { audit } from "./kelishuv-domain";
import { isParty, MediationError, recordEvent, requireCase } from "./mediation";
import type { AppData, User } from "./types";

const inputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("REQUEST"),
    requestId: z.string().uuid(),
    kind: z.enum(["WITHDRAWN", "SETTLED_EXTERNALLY"]),
    reason: z.string().trim().min(3).max(1000),
  }),
  z.object({
    action: z.literal("RESPOND"),
    requestId: z.string().uuid(),
    accept: z.boolean(),
  }),
]);

export async function handleCaseClosureRequest(
  request: NextRequest,
  user: User,
  mutate: <T>(operation: (data: AppData) => T) => Promise<T>,
) {
  const match = /^\/api\/cases\/([^/]+)\/closure$/.exec(
    request.nextUrl.pathname,
  );
  if (!match) return null;
  if (request.method === "GET") {
    const record = requireCase(await readStore(), match[1], user);
    return NextResponse.json(
      { closure: record.closure || null, status: record.status },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  if (request.method !== "POST") return null;
  const input = inputSchema.parse(await jsonBody(request));
  const result = await mutate((data) => {
    const record = requireCase(data, match[1], user);
    if (!isParty(record, user.id))
      throw new MediationError(
        403,
        "Nizoni yakunlashni nizo tarafi tasdiqlaydi.",
      );
    const previous = record.closure;
    if (input.action === "REQUEST" && previous?.id === input.requestId) {
      if (
        previous.requestedBy !== user.id ||
        previous.kind !== input.kind ||
        previous.reason !== input.reason
      )
        throw new MediationError(409, "Yopish so‘rovi o‘zgargan.");
      return { closure: previous, status: record.status };
    }
    if (
      input.action === "RESPOND" &&
      previous?.id === input.requestId &&
      previous.status === "CLOSED" &&
      input.accept
    )
      return { closure: previous, status: record.status };
    if (["CLOSED", "RESOLVED", "ESCALATED"].includes(record.status))
      throw new MediationError(409, "Ushbu nizo yakunlangan.");
    let note: string;
    if (input.action === "REQUEST") {
      if (input.kind === "SETTLED_EXTERNALLY" && previous?.status === "PENDING")
        throw new MediationError(
          409,
          "Amaldagi yopish so‘roviga javob bering.",
        );
      record.closure = {
        id: input.requestId,
        kind: input.kind,
        reason: input.reason,
        requestedBy: user.id,
        requestedAt: new Date().toISOString(),
        confirmations: [user.id],
        status: "PENDING",
      };
      if (input.kind === "WITHDRAWN" || !record.mediation?.respondentId)
        record.closure.status = "CLOSED";
      note =
        input.kind === "WITHDRAWN"
          ? "Taraf murojaatini qaytarib olib, ishtirokini tugatdi"
          : "Taraflar mustaqil kelishgani bo‘yicha yopish so‘rovi yuborildi";
    } else {
      if (
        !previous ||
        previous.id !== input.requestId ||
        previous.status !== "PENDING"
      )
        throw new MediationError(
          409,
          "Yopish so‘rovi yangilangan. Sahifani yangilang.",
        );
      if (!input.accept) {
        previous.status = "DECLINED";
        note = "Mustaqil kelishuv bo‘yicha yopish so‘rovi bekor qilindi";
      } else {
        if (!previous.confirmations.includes(user.id))
          previous.confirmations.push(user.id);
        if (
          [record.userId, record.mediation?.respondentId]
            .filter(Boolean)
            .every((id) => previous.confirmations.includes(id!))
        )
          previous.status = "CLOSED";
        note =
          previous.status === "CLOSED"
            ? "Ikki taraf mustaqil kelishganini tasdiqladi va nizo yopildi"
            : "Yopish so‘rovi tasdiqlandi";
      }
    }
    const closure = record.closure!;
    if (closure.status === "CLOSED") {
      closure.closedAt = new Date().toISOString();
      for (const session of data.sessions)
        if (session.caseId === record.id && session.status === "SCHEDULED")
          session.status = "CANCELLED";
    }
    recordEvent(
      record,
      `${note}. ${closure.reason}`,
      closure.status === "CLOSED" ? "CLOSED" : record.status,
    );
    audit(data, user.id, "CASE_CLOSURE_UPDATED", {
      caseId: record.id,
      details: {
        closureId: closure.id,
        kind: closure.kind,
        status: closure.status,
      },
    });
    data.notifications ??= [];
    const recipients = new Set(
      [
        record.userId,
        record.mediation?.respondentId,
        data.mediators.find((item) => item.id === record.mediatorId)?.userId,
      ].filter((id): id is string => Boolean(id)),
    );
    for (const recipient of recipients)
      data.notifications.unshift({
        id: randomUUID(),
        userId: recipient,
        title:
          closure.status === "CLOSED"
            ? "Nizo yopildi"
            : "Nizoni yopish so‘rovi",
        body: note,
        href: `/dashboard/cases/${record.id}`,
        createdAt: new Date().toISOString(),
        read: false,
      });
    return { closure, status: record.status };
  });
  return NextResponse.json(result);
}
