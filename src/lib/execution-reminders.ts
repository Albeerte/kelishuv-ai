import "server-only";
import { mutateStore } from "./store";
import { createReminderNotifications } from "./kelishuv-domain";
import { deliverEmails } from "./email";

const runtime = globalThis as typeof globalThis & {
  kelishuvReminderTimer?: ReturnType<typeof setInterval>;
  kelishuvReminderRunning?: boolean;
};
export function startExecutionReminders() {
  if (runtime.kelishuvReminderTimer) return;
  async function check() {
    if (runtime.kelishuvReminderRunning) return;
    runtime.kelishuvReminderRunning = true;
    try {
      await mutateStore((data) => createReminderNotifications(data));
      await deliverEmails();
    } catch {
      console.error("KELISHUV reminder check could not finish");
    } finally {
      runtime.kelishuvReminderRunning = false;
    }
  }
  runtime.kelishuvReminderTimer = setInterval(() => {
    void check();
  }, 60_000);
  runtime.kelishuvReminderTimer.unref();
}
