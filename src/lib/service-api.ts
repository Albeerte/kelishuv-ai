import "server-only";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { jsonBody } from "./api-request";
import { readStore } from "./store";
import { audit, currentVersion } from "./kelishuv-domain";
import {
  COMMISSION_PERCENT,
  MediationError,
  hasMutualAppointment,
  isParty,
  requireAssignedMediator,
  requireCase,
} from "./mediation";
import { DOCUMENT_TARIFFS } from "./service-catalog";
import { checkoutUrl } from "./payme";
import {
  createZoomMeeting,
  findZoomMeeting,
  ZoomCreationError,
  serviceStatus,
} from "./service-providers";
import { runStructuredAI } from "./ai-provider";
import { LEGAL_SOURCES } from "./legal";
import type { AppData, MediationSession, User } from "./types";
import type { ServiceOrder } from "./service-types";

type Mutate = <T>(operation: (data: AppData) => T) => Promise<T>;
const templateFields = z.object({
  recipient: z.string().trim().max(300),
  applicant: z.string().trim().max(300),
  facts: z.string().trim().max(6000),
  request: z.string().trim().max(4000),
  attachments: z.string().trim().max(1500),
});
export function hasTemplatePurchase(
  data: AppData,
  userId: string,
  caseId: string,
  templateId = "DEMAND",
) {
  return data.serviceOrders?.find(
    (order) =>
      order.userId === userId &&
      order.caseId === caseId &&
      order.templateId === templateId &&
      order.status === "PAID",
  );
}
function myOrder(data: AppData, id: string, user: User) {
  const order = data.serviceOrders?.find(
    (item) => item.id === id && item.userId === user.id,
  );
  if (!order) throw new MediationError(404, "Buyurtma topilmadi.");
  return order;
}
export function paidServiceTotals(data: AppData, mediatorId?: string) {
  return (data.serviceOrders || [])
    .filter(
      (order) =>
        order.status === "PAID" &&
        (!mediatorId ||
          (order.kind === "MEDIATOR" && order.mediatorId === mediatorId)),
    )
    .reduce(
      (totals, order) => ({
        gross: totals.gross + order.amount,
        platformFee: totals.platformFee + order.platformFee,
        mediatorNet: totals.mediatorNet + order.mediatorNet,
      }),
      { gross: 0, platformFee: 0, mediatorNet: 0 },
    );
}
function sameZoomReservation(
  current: MediationSession | undefined,
  snapshot: MediationSession,
) {
  return (
    current &&
    current.zoomRequestId === snapshot.zoomRequestId &&
    current.zoomAttemptId === snapshot.zoomAttemptId &&
    current.status === "SCHEDULED" &&
    current.scheduledAt === snapshot.scheduledAt &&
    current.duration === snapshot.duration &&
    current.type === snapshot.type &&
    current.mediatorId === snapshot.mediatorId
  );
}

export async function handleServiceRequest(
  request: NextRequest,
  user: User,
  mutate: Mutate,
): Promise<Response | null> {
  const parts = request.nextUrl.pathname.replace(/^\/api\//, "").split("/");
  const route = parts.join("/");
  const method = request.method;
  if (route === "services/status" && method === "GET")
    return NextResponse.json(serviceStatus());
  if (route === "services/orders" && method === "GET") {
    const data = await readStore();
    const mediator = data.mediators.find((item) => item.userId === user.id);
    return NextResponse.json({
      orders: (data.serviceOrders || [])
        .filter(
          (order) =>
            order.userId === user.id ||
            user.role === "ADMIN" ||
            Boolean(mediator && order.mediatorId === mediator.id),
        )
        .map((order) =>
          order.userId === user.id ? order : { ...order, draft: undefined },
        ),
      services: serviceStatus(),
      tariffs: DOCUMENT_TARIFFS,
    });
  }
  if (
    parts[0] === "services" &&
    parts[1] === "orders" &&
    parts[2] &&
    method === "GET"
  ) {
    const order = myOrder(await readStore(), parts[2], user);
    return NextResponse.json({ order, checkoutUrl: checkoutUrl(order) });
  }
  if (route === "services/orders" && method === "POST") {
    const input = z
      .object({
        requestId: z.string().uuid(),
        kind: z.enum(["TEMPLATE", "MEDIATOR"]),
        caseId: z.string().min(1).max(100),
        templateId: z.enum(["DEMAND", "MEDIATION", "COURT"]).optional(),
        invoiceId: z.string().uuid().optional(),
        fields: templateFields.optional(),
      })
      .refine(
        (input) =>
          input.kind === "TEMPLATE"
            ? Boolean(input.templateId && !input.invoiceId)
            : Boolean(input.invoiceId && !input.templateId && !input.fields),
        "Buyurtma turiga mos hujjat yoki xizmat hisobini tanlang.",
      )
      .parse(await jsonBody(request));
    const order = await mutate((data) => {
      const existing = data.serviceOrders?.find(
        (order) =>
          order.userId === user.id && order.requestId === input.requestId,
      );
      if (existing) {
        if (
          existing.caseId !== input.caseId ||
          existing.kind !== input.kind ||
          existing.templateId !== input.templateId ||
          existing.invoiceId !== input.invoiceId
        )
          throw new MediationError(409, "Buyurtma so‘rovi o‘zgargan.");
        if (input.fields && existing.kind === "TEMPLATE")
          existing.draft = input.fields;
        return existing;
      }
      const record = requireCase(data, input.caseId, user);
      if (!isParty(record, user.id))
        throw new MediationError(403, "Buyurtmani nizo tarafi yaratadi.");
      const base = {
        id: randomUUID(),
        requestId: input.requestId,
        userId: user.id,
        caseId: record.id,
        kind: input.kind,
        status: "PENDING" as const,
        createdAt: new Date().toISOString(),
      };
      let order: ServiceOrder;
      if (input.kind === "TEMPLATE") {
        const tariff = DOCUMENT_TARIFFS.find(
          (item) => item.id === input.templateId,
        );
        if (!tariff) throw new MediationError(400, "Hujjat turini tanlang.");
        const previous = data.serviceOrders?.find(
          (order) =>
            order.userId === user.id &&
            order.caseId === record.id &&
            order.templateId === tariff.id &&
            order.status !== "CANCELLED",
        );
        if (previous) {
          if (input.fields) previous.draft = input.fields;
          return previous;
        }
        order = {
          ...base,
          templateId: tariff.id,
          title: tariff.title,
          amount: tariff.price,
          platformFee: tariff.price,
          mediatorNet: 0,
          draft: input.fields,
        };
      } else {
        if (data.payments?.some((item) => item.caseId === record.id))
          throw new MediationError(
            409,
            "Mediator xizmati tushumi qo‘lda qayd etilgan.",
          );
        const invoice = data.mediatorInvoices?.find(
          (item) =>
            item.id === input.invoiceId &&
            item.caseId === record.id &&
            item.mediatorId === record.mediatorId,
        );
        const party = invoice?.parties.find((item) => item.userId === user.id);
        const signed = data.agreements?.some(
          (item) =>
            item.caseId === record.id &&
            item.kind === "SETTLEMENT" &&
            currentVersion(item).status === "SIGNED",
        );
        if (!invoice || !party || !signed || !hasMutualAppointment(record))
          throw new MediationError(
            409,
            "Mediator hisobini va imzolangan yakuniy kelishuvni tekshiring.",
          );
        const previous = data.serviceOrders?.find(
          (order) =>
            order.invoiceId === invoice.id &&
            order.userId === user.id &&
            order.status !== "CANCELLED",
        );
        if (previous) return previous;
        order = {
          ...base,
          invoiceId: invoice.id,
          mediatorId: invoice.mediatorId,
          title: "Mediator xizmati — taraf ulushi",
          amount: party.amount,
          platformFee: party.platformFee,
          mediatorNet: party.amount - party.platformFee,
        };
      }
      (data.serviceOrders ??= []).push(order);
      audit(data, user.id, "SERVICE_ORDER_CREATED", {
        caseId: record.id,
        details: { orderId: order.id, amount: order.amount, kind: order.kind },
      });
      return order;
    });
    return NextResponse.json({
      order,
      checkoutUrl: checkoutUrl(order),
      paymentConfigured: serviceStatus().payment,
    });
  }
  if (parts[0] === "cases" && parts[1] && parts[2] === "invoice") {
    if (method === "GET") {
      const data = await readStore();
      const record = requireCase(data, parts[1], user);
      return NextResponse.json({
        invoice:
          data.mediatorInvoices?.find((item) => item.caseId === record.id) ||
          null,
        paymentConfigured: serviceStatus().payment,
      });
    }
    if (method === "POST") {
      const input = z
        .object({
          amount: z.number().int().min(1000).max(100000000),
          confirm: z.literal(true),
        })
        .parse(await jsonBody(request));
      const invoice = await mutate((data) => {
        const record = requireCase(data, parts[1], user);
        const mediator = requireAssignedMediator(data, record, user);
        if (!hasMutualAppointment(record) || !record.mediation?.respondentId)
          throw new MediationError(
            409,
            "Mediatorni ikki taraf tasdiqlashi kerak.",
          );
        const existing = data.mediatorInvoices?.find(
          (item) => item.caseId === record.id,
        );
        if (data.payments?.some((item) => item.caseId === record.id))
          throw new MediationError(
            409,
            "Mediator xizmati tushumi avval qayd etilgan.",
          );
        if (existing) {
          if (existing.gross !== input.amount)
            throw new MediationError(
              409,
              "Xizmat hisobi yaratilgan. Summani administrator bilan aniqlashtiring.",
            );
          return existing;
        }
        const platformFee = Math.round(
          (input.amount * COMMISSION_PERCENT) / 100,
        );
        const firstAmount = Math.floor(input.amount / 2);
        const firstFee = Math.floor(platformFee / 2);
        const invoice = {
          id: randomUUID(),
          caseId: record.id,
          mediatorId: mediator.id,
          createdBy: user.id,
          gross: input.amount,
          platformFee,
          mediatorNet: input.amount - platformFee,
          parties: [
            {
              userId: record.userId,
              amount: firstAmount,
              platformFee: firstFee,
            },
            {
              userId: record.mediation.respondentId,
              amount: input.amount - firstAmount,
              platformFee: platformFee - firstFee,
            },
          ],
          createdAt: new Date().toISOString(),
        };
        (data.mediatorInvoices ??= []).push(invoice);
        audit(data, user.id, "MEDIATOR_INVOICE_CREATED", {
          caseId: record.id,
          details: {
            invoiceId: invoice.id,
            amount: invoice.gross,
            platformFee,
          },
        });
        return invoice;
      });
      return NextResponse.json({ invoice }, { status: 201 });
    }
  }
  if (
    parts[0] === "templates" &&
    ["autofill", "download"].includes(parts[1]) &&
    method === "POST"
  ) {
    const input = z
      .object({
        orderId: z.string().uuid(),
        fields: templateFields.optional(),
        localConsent: z.boolean().default(false),
        externalConsent: z.boolean().default(false),
        confirmed: z.boolean().default(false),
      })
      .parse(await jsonBody(request));
    const data = await readStore();
    const order = myOrder(data, input.orderId, user);
    if (order.kind !== "TEMPLATE" || order.status !== "PAID")
      throw new MediationError(402, "Hujjat uchun tasdiqlangan to‘lov kerak.");
    const record = requireCase(data, order.caseId, user);
    if (!isParty(record, user.id))
      throw new MediationError(403, "Hujjat nizo tarafi uchun tayyorlanadi.");
    if (parts[1] === "autofill") {
      if (!input.localConsent && !input.externalConsent)
        throw new MediationError(400, "AI qayta ishlashiga rozilik bering.");
      const ownPosition =
        record.positions?.find((item) => item.userId === user.id)
          ?.sharedStatement ||
        (record.userId === user.id
          ? record.description
          : record.mediation?.respondentStatement || "");
      const result = await runStructuredAI(
        z.toJSONSchema(templateFields),
        "Draft a document using only the supplied applicant's own statement and supplied fields. Preserve facts. Leave unknown recipient and missing details blank. Never invent legal citations, evidence, obligations or admissions. Return a draft for human review.",
        JSON.stringify({
          template: order.templateId,
          applicant: user.fullName,
          statement: ownPosition,
          amountClaimed: record.claimAmount,
          supplied: input.fields,
        }),
        {
          localConsent: input.localConsent,
          externalConsent: input.externalConsent,
        },
      );
      const fields = templateFields.parse(result.data);
      await mutate((data) => {
        const current = myOrder(data, order.id, user);
        if (current.status !== "PAID")
          throw new MediationError(409, "To‘lov holati o‘zgargan.");
        current.draft = fields;
      });
      return NextResponse.json({
        fields,
        model: result.model,
      });
    }
    if (!input.fields || !input.confirmed)
      throw new MediationError(
        400,
        "Maydonlarni tekshirib, loyihani tasdiqlang.",
      );
    const fields = input.fields;
    const title = DOCUMENT_TARIFFS.find(
      (item) => item.id === order.templateId,
    )!.title;
    const sources = record.analysis.sources.filter((item) =>
      LEGAL_SOURCES.some((source) => source.id === item.id),
    );
    const lines = [
      `Kimga — ${fields.recipient || "________________"}`,
      `Murojaatchi — ${fields.applicant || user.fullName}`,
      `Sana — ${new Intl.DateTimeFormat("uz-UZ", { timeZone: "Asia/Tashkent" }).format(new Date())}`,
      `Nizo — ${record.number}`,
      "Holat bayoni",
      fields.facts,
      "Talab va taklif",
      fields.request,
      "Ilovalar",
      fields.attachments,
      "Huquqiy manbalarni tekshirish",
      ...sources.map(
        (source) => `${source.title}, ${source.article}. ${source.url}`,
      ),
      "Imzo — ________________",
      "Loyiha. Hujjatni yuborishdan oldin vakolatli mutaxassis bilan faktlar, talablar, muddatlar va sudlovga tegishlilikni tekshiring.",
    ];
    const file = await Packer.toBuffer(
      new Document({
        sections: [
          {
            children: [
              new Paragraph({ text: title, heading: HeadingLevel.TITLE }),
              ...lines.map(
                (text) =>
                  new Paragraph({
                    children: [new TextRun({ text, size: 24, font: "Arial" })],
                    spacing: { after: 180 },
                  }),
              ),
            ],
          },
        ],
      }),
    );
    await mutate((current) => {
      const paid = myOrder(current, order.id, user);
      if (paid.status !== "PAID")
        throw new MediationError(409, "To‘lov holati o‘zgargan.");
      paid.consumedAt ||= new Date().toISOString();
      paid.draft = fields;
    });
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="kelishuv-${order.templateId}.docx"`,
        "Cache-Control": "no-store",
      },
    });
  }
  if (
    parts[0] === "sessions" &&
    parts[1] &&
    parts[2] === "zoom" &&
    method === "POST"
  ) {
    if (!serviceStatus().zoom)
      throw new MediationError(
        503,
        "Zoom hisobi ulanishini kutmoqda. Administrator OAuth sozlamalarini kiritadi.",
      );
    const reserved = await mutate((data) => {
      const session = data.sessions.find((item) => item.id === parts[1]);
      if (!session) throw new MediationError(404, "Sessiya topilmadi.");
      const record = requireCase(data, session.caseId, user);
      requireAssignedMediator(data, record, user);
      if (
        !hasMutualAppointment(record) ||
        session.status !== "SCHEDULED" ||
        session.type !== "ONLINE"
      )
        throw new MediationError(409, "Kelishilgan onlayn sessiyani tanlang.");
      if (session.zoom)
        return { session: structuredClone(session), existing: true };
      if (
        session.zoomRequestId &&
        Date.parse(session.zoomRequestedAt || "") > Date.now() - 60000
      )
        throw new MediationError(
          409,
          "Zoom so‘rovi davom etmoqda. Bir daqiqadan keyin holatini qayta tekshiring.",
        );
      const recovering = Boolean(session.zoomRequestId);
      session.zoomRequestId ||= randomUUID();
      session.zoomAttemptId = randomUUID();
      session.zoomRequestedAt = new Date().toISOString();
      return { session: structuredClone(session), existing: false, recovering };
    });
    if (reserved.existing)
      return NextResponse.json({ zoom: reserved.session.zoom });
    let zoom;
    try {
      const found = reserved.recovering
        ? await findZoomMeeting(
            reserved.session.zoomRequestId!,
            reserved.session.scheduledAt,
            reserved.session.duration,
          )
        : null;
      if (!found && Date.parse(reserved.session.scheduledAt) <= Date.now())
        throw new MediationError(
          409,
          "Sessiya vaqti o‘tgan. Uchrashuv holatini tekshiring va yangi vaqt belgilang.",
        );
      zoom =
        found ||
        (await createZoomMeeting({
          reference: reserved.session.zoomRequestId!,
          start: reserved.session.scheduledAt,
          duration: reserved.session.duration,
          beforeCreate: async () => {
            await mutate((data) => {
              const current = data.sessions.find(
                (item) => item.id === parts[1],
              );
              if (
                !sameZoomReservation(current, reserved.session) ||
                Date.parse(reserved.session.zoomRequestedAt!) <=
                  Date.now() - 30000
              )
                throw new MediationError(
                  409,
                  "Sessiya yoki Zoom so‘rovi yangilangan. Holatini qayta tekshiring.",
                );
              requireAssignedMediator(
                data,
                requireCase(data, reserved.session.caseId, user),
                user,
              );
            });
          },
        }));
    } catch (failure) {
      if (
        !reserved.recovering &&
        failure instanceof ZoomCreationError &&
        !failure.ambiguous
      ) {
        await mutate((data) => {
          const session = data.sessions.find((item) => item.id === parts[1]);
          if (
            session &&
            session.zoomRequestId === reserved.session.zoomRequestId &&
            session.zoomAttemptId === reserved.session.zoomAttemptId &&
            !session.zoom
          ) {
            session.zoomRequestId = undefined;
            session.zoomRequestedAt = undefined;
          }
        });
      }
      throw failure;
    }
    await mutate((data) => {
      const session = data.sessions.find((item) => item.id === parts[1]);
      if (!sameZoomReservation(session, reserved.session))
        throw new MediationError(
          409,
          "Sessiya o‘zgargan. Zoom kabinetida uchrashuvni tekshiring.",
        );
      requireAssignedMediator(
        data,
        requireCase(data, reserved.session.caseId, user),
        user,
      );
      session!.zoom = zoom;
    });
    return NextResponse.json({ zoom });
  }
  return null;
}
