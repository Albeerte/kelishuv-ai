"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BookOpen, MessageCircle, Send, Sparkles } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { T, useI18n } from "@/lib/i18n";
import { api } from "@/lib/utils";
import { useData } from "@/lib/use-data";
import type { AssistantReply, AssistantUsage } from "@/lib/assistant-types";

export function AssistantWidget({ fullPage = false }: { fullPage?: boolean }) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<
    { question: string; reply: AssistantReply }[]
  >([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [failedQuestion, setFailedQuestion] = useState("");
  const [externalConsent, setExternalConsent] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const sending = useRef(false);
  const usage = useData<{ usage: AssistantUsage }>(
    open || fullPage ? "/api/assistant/usage" : null,
  );
  const [quota, setQuota] = useState<AssistantUsage | null>(null);
  const lastRequest = useRef({ id: "", hash: "" });
  const [failedStatus, setFailedStatus] = useState<number | undefined>();
  useEffect(() => {
    if (usage.data) setQuota(usage.data.usage);
  }, [usage.data]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [turns, busy]);
  async function ask(value: string, retry = false) {
    if (
      sending.current ||
      !quota ||
      (!quota.remaining && !retry) ||
      value.trim().length < 3
    )
      return;
    sending.current = true;
    setQuestion(value);
    setFailedQuestion("");
    setBusy(true);
    setError("");
    const context = turns.slice(-2).map((turn) => turn.question);
    const hash = JSON.stringify([value, context, externalConsent, locale]);
    if (lastRequest.current.hash !== hash)
      lastRequest.current = { id: crypto.randomUUID(), hash };
    try {
      const reply = await api<AssistantReply>("/api/assistant", {
        method: "POST",
        body: JSON.stringify({
          requestId: lastRequest.current.id,
          question: value,
          context,
          externalConsent,
          locale,
        }),
      });
      setTurns((previous) => [
        ...previous.slice(-9),
        { question: value, reply },
      ]);
      setQuestion("");
      if (reply.usage) setQuota(reply.usage);
      lastRequest.current = { id: "", hash: "" };
      usage.reload();
    } catch (failure) {
      setError((failure as Error).message);
      setFailedQuestion(value);
      setFailedStatus((failure as Error & { status?: number }).status);
      usage.reload();
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  const content = (
    <div className="kelishuv-assistant">
      <div className="assistant-quota" role="status">
        <strong>
          <T>10 ta bepul so‘rov</T>
        </strong>
        {quota && (
          <span>
            <T>Qoldi</T> {quota.remaining} / {quota.limit}
          </span>
        )}
      </div>
      {usage.error && (
        <p className="form-error" role="alert">
          {usage.error}{" "}
          <button className="text-link" onClick={usage.reload}>
            <T>Qayta yuklash</T>
          </button>
        </p>
      )}
      <div className="assistant-intro">
        <Sparkles size={24} />
        <p>
          <T>
            Saytdan foydalanish yoki huquqiy masalangiz haqida so‘rang.
            Javoblarda qonun moddalari va Lex.uz havolalari ko‘rsatiladi.
          </T>
        </p>
      </div>
      <p className="field-hint">
        <T>
          Pasport raqami va boshqa shaxsiy ma’lumotlarni savolga kiritmang.
          Shaxsiy hujjatlar profil orqali yuklanadi.
        </T>
      </p>
      <div
        className="assistant-log"
        role="log"
        aria-label={t("Yordamchi bilan suhbat")}
        aria-busy={busy}
      >
        {!turns.length && (
          <div className="assistant-suggestions">
            {[
              "Sayt qanday ishlaydi?",
              "Ish haqim to‘lanmagan. Qaysi huquqlarim bor?",
              "Hujjat tariflari qancha?",
            ].map((text) => (
              <button
                key={text}
                onClick={() => ask(text)}
                disabled={busy || !quota?.remaining}
              >
                <T>{text}</T>
              </button>
            ))}
          </div>
        )}
        {turns.map((turn, index) => (
          <article className="assistant-turn" key={index}>
            <p className="assistant-question">{turn.question}</p>
            <div className="assistant-answer">
              <small>
                <T>{turn.reply.mode}</T>
              </small>
              <p>{turn.reply.answer}</p>
              <ol>
                {turn.reply.steps.map((step, i) => (
                  <li key={i}>
                    <T>{step}</T>
                  </li>
                ))}
              </ol>
              {turn.reply.sources.map((source) => (
                <div className="assistant-source" key={source.id}>
                  <BookOpen size={18} />
                  <div>
                    <strong>
                      {source.title} · {source.article}
                    </strong>
                    <small>
                      <T>Manbaning asl matni (o‘zbekcha)</T>
                    </small>
                    <p lang={source.originalLanguage}>{source.summary}</p>
                    <small>
                      <T>
                        {source.kind === "COURT_PRACTICE"
                          ? "Sud amaliyotiga oid ochiq material"
                          : source.kind === "PLENUM"
                            ? "Oliy sud Plenumi qarori"
                            : "Qonunchilik manbasi"}
                      </T>
                      {" · "}
                      <T>
                        {source.current
                          ? "Manbadan tekshirildi"
                          : "Saqlangan nusxa"}
                      </T>{" "}
                      {source.current
                        ? source.verifiedAt.slice(0, 10)
                        : source.snapshotDate ||
                          source.editionDate ||
                          source.verifiedAt.slice(0, 10)}
                    </small>
                    {source.editionDate && (
                      <small>
                        <T>Tahrir</T> {source.editionDate}
                      </small>
                    )}
                    <a href={source.url} target="_blank" rel="noreferrer">
                      <T>
                        {source.url.includes("lex.uz/")
                          ? "Lex.uz da moddani ochish"
                          : "Sud manbasini ochish"}
                      </T>
                    </a>
                  </div>
                </div>
              ))}
              <div className="assistant-links">
                {turn.reply.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                  >
                    <T>{link.title}</T>
                  </Link>
                ))}
              </div>
            </div>
          </article>
        ))}
        {busy && (
          <p role="status">
            <T>Javob tayyorlanmoqda...</T>
          </p>
        )}
        <div ref={end} />
      </div>
      <form
        className="assistant-form"
        onSubmit={(event) => {
          event.preventDefault();
          ask(question);
        }}
      >
        <label>
          <span className="sr-only">
            <T>Savolingiz</T>
          </span>
          <textarea
            aria-label={t("Savolingiz")}
            required
            minLength={3}
            maxLength={2000}
            rows={2}
            placeholder={t("Savolingizni yozing...")}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            disabled={busy || !quota?.remaining}
          />
        </label>
        <Button
          type="submit"
          disabled={busy || !quota?.remaining || question.trim().length < 3}
          aria-label={t("Savolni yuborish")}
        >
          <Send size={20} />
        </Button>
      </form>
      {error && (
        <p role="alert" className="form-error">
          {error}{" "}
          {failedStatus !== 429 && (
            <button
              className="text-link"
              onClick={() => ask(failedQuestion, true)}
              disabled={busy}
            >
              <T>Qayta urinish</T>
            </button>
          )}
        </p>
      )}
      {quota?.remaining === 0 && (
        <p className="info-note">
          <T>10 ta bepul so‘rovdan foydalandingiz.</T>
        </p>
      )}
      <label className="consent-checkbox">
        <input
          type="checkbox"
          checked={externalConsent}
          onChange={(event) => setExternalConsent(event.target.checked)}
        />
        <span>
          <T>Savolimni sozlangan tashqi AI xizmatida qayta ishlashga roziman</T>
        </span>
      </label>
      <small className="assistant-disclaimer">
        <T>
          Umumiy huquqiy ma’lumot. Vaziyatga yakuniy baho hujjatlar va taraflar
          bayoni asosida beriladi.
        </T>
      </small>
    </div>
  );
  if (fullPage)
    return (
      <section className="panel assistant-page">
        <h1>
          <T>Kelishuv yordamchisi</T>
        </h1>
        {content}
      </section>
    );
  return (
    <>
      <button
        className="assistant-launcher"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        <MessageCircle size={23} />
        <span>
          <T>AI yordamchi</T>
        </span>
      </button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Kelishuv yordamchisi"
        description="Platforma va huquqiy savollar bo‘yicha yordam"
      >
        {content}
      </Dialog>
    </>
  );
}
