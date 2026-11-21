import "server-only";
import nodemailer from "nodemailer";
import { randomUUID } from "node:crypto";
import { mutateStore } from "./store";

const state = globalThis as typeof globalThis & {
  mmEmailQueue?: Promise<void>;
};
export async function deliverEmails() {
  if (!process.env.SMTP_HOST) return;
  const delivery = (state.mmEmailQueue || Promise.resolve()).then(
    flushEmails,
    flushEmails,
  );
  state.mmEmailQueue = delivery.catch(() => undefined);
  return delivery;
}

async function flushEmails() {
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
    connectionTimeout: 5000,
    socketTimeout: 10000,
  });
  try {
    while (true) {
      const claim = randomUUID();
      const batch = await mutateStore((data) => {
        const now = Date.now();
        const eligible = data.notifications
          .filter(
            (item) =>
              !item.emailedAt &&
              !item.userId.startsWith("demo-") &&
              (item.emailAttempts || 0) < 3 &&
              (!item.emailRetryAt || Date.parse(item.emailRetryAt) <= now) &&
              (!item.emailClaimedAt ||
                Date.parse(item.emailClaimedAt) < now - 300000) &&
              data.users.some(
                (user) => user.id === item.userId && user.isActive && !user.email.endsWith("@phone.kelishuv.local"),
              ),
          )
          .slice(0, 10);
        return eligible.map((item) => {
          item.emailClaim = claim;
          item.emailClaimedAt = new Date(now).toISOString();
          const user = data.users.find((user) => user.id === item.userId)!;
          return {
            id: item.id,
            title: item.title,
            href: item.href,
            email: user.email,
          };
        });
      });
      if (!batch.length) break;
      for (const notification of batch) {
        const owned = await mutateStore((data) => {
          const saved = data.notifications.find(
            (item) => item.id === notification.id,
          );
          if (!saved || saved.emailedAt || saved.emailClaim !== claim)
            return false;
          saved.emailClaimedAt = new Date().toISOString();
          return true;
        });
        if (!owned) continue;
        let delivered = false;
        try {
          const base = process.env.AUTH_URL || "http://localhost:2345";
          await transport.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: notification.email,
            messageId: `<${notification.id}@medimatch.local>`,
            subject: `KELISHUV AI — ${notification.title}`,
            text: `${notification.title}\n\nShaxsiy kabinetingizda yangi bildirishnoma mavjud.\n${new URL(notification.href, base).toString()}\n\nKELISHUV AI`,
          });
          delivered = true;
        } catch {
          /* Keep the in-app notification and retry delivery on a subsequent flush. */
        }
        await mutateStore((data) => {
          const saved = data.notifications.find(
            (item) => item.id === notification.id,
          );
          if (!saved || saved.emailClaim !== claim) return;
          delete saved.emailClaim;
          delete saved.emailClaimedAt;
          if (delivered) {
            saved.emailedAt = new Date().toISOString();
            delete saved.emailRetryAt;
          } else {
            saved.emailAttempts = (saved.emailAttempts || 0) + 1;
            saved.emailRetryAt = new Date(
              Date.now() + 30000 * 2 ** (saved.emailAttempts - 1),
            ).toISOString();
          }
        });
      }
    }
  } catch (error) {
    console.error(
      "MediMatch email queue failed",
      error instanceof Error ? error.name : "unknown error",
    );
  } finally {
    transport.close();
  }
}
