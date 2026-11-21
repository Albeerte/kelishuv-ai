import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonBody } from "./api-request";
import type { AppData } from "./types";
import type { PaymentTransaction, ServiceOrder } from "./service-types";

type Mutate = <T>(operation: (data: AppData) => T) => Promise<T>;
class PaymentError extends Error {
  constructor(
    public code: number,
    message: string,
    public data?: string,
  ) {
    super(message);
  }
}
function expire(data: AppData) {
  for (const transaction of data.paymentTransactions || []) {
    if (
      transaction.state === 1 &&
      Date.now() - transaction.providerTime > 43200000
    ) {
      transaction.state = -1;
      transaction.reason = 4;
      transaction.cancelTime = Date.now();
    }
  }
}
function orderFor(data: AppData, account: unknown, amount: unknown) {
  const id = z.object({ order_id: z.string().uuid() }).safeParse(account);
  const order =
    id.success &&
    data.serviceOrders?.find((item) => item.id === id.data.order_id);
  if (!order) throw new PaymentError(-31050, "Buyurtma topilmadi.", "order_id");
  if (
    order.kind === "MEDIATOR" &&
    data.payments?.some((item) => item.caseId === order.caseId)
  )
    throw new PaymentError(-31008, "Xizmat tushumi avval qayd etilgan.");
  if (!Number.isSafeInteger(amount) || amount !== order.amount * 100)
    throw new PaymentError(-31001, "To‘lov summasi mos kelmadi.");
  return order;
}
function transactionFor(data: AppData, id: unknown) {
  const transaction = data.paymentTransactions?.find((item) => item.id === id);
  if (!transaction) throw new PaymentError(-31003, "Tranzaksiya topilmadi.");
  return transaction;
}
function result(transaction: PaymentTransaction) {
  return {
    create_time: transaction.createTime,
    perform_time: transaction.performTime,
    cancel_time: transaction.cancelTime,
    transaction: transaction.id,
    state: transaction.state,
    reason: transaction.reason,
  };
}

export function paymeOperation(
  data: AppData,
  method: string,
  params: Record<string, unknown>,
) {
  expire(data);
  if (method === "CheckPerformTransaction") {
    const order = orderFor(data, params.account, params.amount);
    if (
      order.status !== "PENDING" ||
      data.paymentTransactions?.some(
        (item) =>
          item.orderId === order.id && (item.state === 1 || item.state === 2),
      )
    )
      throw new PaymentError(-31008, "Buyurtma band yoki to‘langan.");
    return { allow: true };
  }
  if (method === "CreateTransaction") {
    const id = z.string().min(1).max(100).safeParse(params.id);
    const time = z.number().int().positive().safeParse(params.time);
    if (!id.success || !time.success)
      throw new PaymentError(-32600, "Tranzaksiya parametrlari mos kelmadi.");
    const order = orderFor(data, params.account, params.amount);
    const existing = data.paymentTransactions?.find(
      (item) => item.id === id.data,
    );
    if (existing) {
      if (existing.orderId !== order.id || existing.state !== 1)
        throw new PaymentError(
          -31008,
          "Tranzaksiya holati amalni bajarishga mos kelmadi.",
        );
      return result(existing);
    }
    if (
      Date.now() - time.data > 43200000 ||
      time.data > Date.now() + 300000 ||
      order.status !== "PENDING" ||
      data.paymentTransactions?.some(
        (item) =>
          item.orderId === order.id && (item.state === 1 || item.state === 2),
      )
    )
      throw new PaymentError(
        -31008,
        "Buyurtma holati yoki tranzaksiya vaqti mos kelmadi.",
      );
    const transaction: PaymentTransaction = {
      id: id.data,
      orderId: order.id,
      providerTime: time.data,
      createTime: Date.now(),
      performTime: 0,
      cancelTime: 0,
      state: 1,
      reason: null,
    };
    (data.paymentTransactions ??= []).push(transaction);
    return result(transaction);
  }
  if (method === "PerformTransaction") {
    const transaction = transactionFor(data, params.id);
    if (transaction.state === 2) return result(transaction);
    if (transaction.state !== 1)
      throw new PaymentError(-31008, "Tranzaksiya bekor qilingan.");
    const order = data.serviceOrders!.find(
      (item) => item.id === transaction.orderId,
    )!;
    if (order.status !== "PENDING")
      throw new PaymentError(-31008, "Buyurtma holati mos kelmadi.");
    orderFor(data, { order_id: order.id }, order.amount * 100);
    transaction.performTime = Date.now();
    transaction.state = 2;
    order.status = "PAID";
    order.paidAt = new Date(transaction.performTime).toISOString();
    return result(transaction);
  }
  if (method === "CancelTransaction") {
    const transaction = transactionFor(data, params.id);
    const reason = z.number().int().min(0).max(10).safeParse(params.reason);
    if (!reason.success)
      throw new PaymentError(-32600, "Bekor qilish sababi mos kelmadi.");
    const order = data.serviceOrders!.find(
      (item) => item.id === transaction.orderId,
    )!;
    if (transaction.state === -1 || transaction.state === -2)
      return result(transaction);
    if (order.consumedAt)
      throw new PaymentError(
        -31007,
        "Xizmat ko‘rsatilgan. Qaytarishni qo‘llab-quvvatlash orqali kelishing.",
      );
    transaction.cancelTime = Date.now();
    transaction.reason = reason.data;
    transaction.state = transaction.state === 2 ? -2 : -1;
    if (order.status === "PAID") {
      order.status = "CANCELLED";
      order.paidAt = undefined;
    }
    return result(transaction);
  }
  if (method === "CheckTransaction")
    return result(transactionFor(data, params.id));
  if (method === "GetStatement") {
    const range = z
      .object({ from: z.number().int().min(0), to: z.number().int().min(0) })
      .safeParse(params);
    if (!range.success || range.data.from > range.data.to)
      throw new PaymentError(-32600, "Hisobot davrini tekshiring.");
    return {
      transactions: (data.paymentTransactions || [])
        .filter(
          (item) =>
            item.providerTime >= range.data.from &&
            item.providerTime <= range.data.to,
        )
        .sort((a, b) => a.providerTime - b.providerTime)
        .map((item) => {
          const order = data.serviceOrders!.find(
            (order) => order.id === item.orderId,
          )!;
          return {
            id: item.id,
            time: item.providerTime,
            amount: order.amount * 100,
            account: { order_id: order.id },
            ...result(item),
          };
        }),
    };
  }
  throw new PaymentError(-32601, "Usul topilmadi.");
}

export function checkoutUrl(order: ServiceOrder) {
  if (order.status !== "PENDING") return null;
  if (!process.env.PAYME_MERCHANT_ID || !process.env.PAYME_SECRET) return null;
  const origin = process.env.APP_PUBLIC_URL || process.env.AUTH_URL;
  const path =
    order.kind === "TEMPLATE"
      ? `/documents?case=${order.caseId}&template=${order.templateId}`
      : "/payments";
  const returnUrl = origin ? `;c=${new URL(path, origin).href};ct=5000` : "";
  const encoded = Buffer.from(
    `m=${process.env.PAYME_MERCHANT_ID};ac.order_id=${order.id};a=${order.amount * 100};l=uz${returnUrl}`,
  ).toString("base64");
  return `https://${process.env.PAYME_TEST_MODE === "true" ? "test.paycom.uz" : "checkout.paycom.uz"}/${encoded}`;
}

export async function handlePaymeRequest(
  request: NextRequest,
  mutate: Mutate,
): Promise<Response | null> {
  if (
    request.nextUrl.pathname !== "/api/payments/payme" ||
    request.method !== "POST"
  )
    return null;
  const secret = process.env.PAYME_SECRET;
  const expected = `Basic ${Buffer.from(`Paycom:${secret || ""}`).toString("base64")}`;
  const provided = request.headers.get("authorization") || "";
  const expectedBytes = Buffer.from(expected);
  const providedBytes = Buffer.from(provided);
  const authenticated =
    Boolean(secret) &&
    providedBytes.length === expectedBytes.length &&
    timingSafeEqual(providedBytes, expectedBytes);
  if (!authenticated)
    return NextResponse.json(
      {
        id: null,
        error: {
          code: -32504,
          message: {
            uz: "Autentifikatsiya bajarilmadi.",
            ru: "Ошибка авторизации",
            en: "Unauthorized",
          },
        },
      },
      { status: 401 },
    );
  let id: unknown = null;
  let validated = false;
  try {
    const input = z
      .object({
        id: z.union([z.string(), z.number()]),
        method: z.string(),
        params: z.record(z.string(), z.unknown()),
      })
      .parse(await jsonBody(request));
    id = input.id;
    validated = true;
    // Returning failures commits timeout transitions in the same store transaction.
    const response = await mutate((data) => {
      try {
        return { result: paymeOperation(data, input.method, input.params) };
      } catch (failure) {
        if (!(failure instanceof PaymentError)) throw failure;
        return {
          error: {
            code: failure.code,
            message: {
              uz: failure.message,
              ru: failure.message,
              en: failure.message,
            },
            ...(failure.data ? { data: failure.data } : {}),
          },
        };
      }
    });
    return NextResponse.json({ id, ...response });
  } catch {
    return NextResponse.json({
      id,
      error: {
        code: validated ? -32400 : -32600,
        message: {
          uz: validated
            ? "Hisob-kitob xizmati javob bermadi. So‘rovni qayta yuboring."
            : "So‘rov shaklini tekshiring.",
          ru: validated ? "Внутренняя ошибка" : "Неверный запрос",
          en: validated ? "Internal error" : "Invalid request",
        },
      },
    });
  }
}
