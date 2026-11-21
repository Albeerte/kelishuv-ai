export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startExecutionReminders } = await import(
      "./lib/execution-reminders"
    );
    startExecutionReminders();
  }
}
