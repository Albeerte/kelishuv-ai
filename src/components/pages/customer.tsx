"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  FolderOpen,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { useProfile } from "../application";
import { Button } from "../ui/button";
import { Empty, ErrorState, Loading, StatusBadge } from "../shared";
import { useData } from "@/lib/use-data";
import { fullDate, money } from "@/lib/utils";
import type { CasePayment, CaseRecord } from "@/lib/types";
import { caseNextStep } from "@/lib/case-journey";
import { T, useI18n } from "@/lib/i18n";

export function CustomerCaseList({ cases }: { cases: CaseRecord[] }) {
  const { user } = useProfile();
  const { t } = useI18n();
  return (
    <div className="friendly-case-list">
      {cases.map((record) => {
        const next = caseNextStep(record, user.id);
        return (
          <article className="friendly-case-row" key={record.id}>
            <span className="friendly-case-symbol">
              <FolderOpen size={23} strokeWidth={1.5} />
            </span>
            <div>
              <div className="friendly-case-title">
                <Link href={`/dashboard/cases/${record.id}`}>
                  {record.title}
                </Link>
                {record.demo && (
                  <span className="demo-label">
                    <T>Namuna</T>
                  </span>
                )}
              </div>
              <p>
                <time dateTime={record.createdAt}>
                  {fullDate(record.createdAt)}
                </time>
              </p>
              <span className="case-next-label">
                <T>{next.description}</T>
              </span>
            </div>
            <StatusBadge status={record.status} />
            <Link
              className="case-row-action"
              href={next.href}
              aria-label={`${record.title} — ${t(next.label)}`}
            >
              <T>{next.label}</T>
              <ArrowRight size={18} />
            </Link>
          </article>
        );
      })}
    </div>
  );
}

export function Dashboard() {
  const { user, demo } = useProfile();
  const data = useData<{
    cases: CaseRecord[];
  }>("/api/stats");
  const [intro, setIntro] = useState(false);
  useEffect(() => {
    try {
      setIntro(
        sessionStorage.getItem(`kelishuv-onboarding-${user.id}`) === "1",
      );
    } catch {
      setIntro(false);
    }
  }, [user.id]);
  if (user.role === "MEDIATOR" || user.role === "ADMIN")
    return (
      <div className="friendly-welcome">
        <h1>
          <T>Xush kelibsiz.</T> {user.fullName}
        </h1>
        <p>
          <T>Ishlaringizni kabinetingizda davom ettiring.</T>
        </p>
        <Button asChild>
          <Link href={user.role === "MEDIATOR" ? "/mediator" : "/admin"}>
            <T>Kabinetni ochish</T>
          </Link>
        </Button>
      </div>
    );
  return (
    <div className="friendly-customer">
      <section className="friendly-welcome">
        <div>
          <h1>
            <T>Assalomu alaykum! Sizga qanday yordam bera olamiz?</T>
          </h1>
          <p>
            <T>
              Muammoingizni oddiy so‘zlar bilan aytib bering. Keyingi qadamni
              birga aniqlaymiz.
            </T>
          </p>
          <Button className="friendly-start-action" asChild>
            <Link href="/dashboard/new">
              <Plus size={20} />
              <T>Yangi muammo boshlash</T>
            </Link>
          </Button>
        </div>
      </section>
      {intro && (
        <section className="friendly-onboarding">
          <div>
            <ShieldCheck size={22} />
            <h2>
              <T>Hisobingiz tayyor. O‘zingizga qulay vaqtda boshlang.</T>
            </h2>
          </div>
          <ol>
            {[
              "Vaziyatingizni qisqacha yozing.",
              "Dastlabki tahlil va mumkin bo‘lgan yo‘llarni ko‘ring.",
              "Kerak bo‘lsa, mediator bilan kelishuvni muhokama qiling.",
            ].map((text) => (
              <li key={text}>
                <Check size={16} />
                <T>{text}</T>
              </li>
            ))}
          </ol>
          <button
            className="quiet-link"
            onClick={() => {
              try {
                sessionStorage.removeItem(`kelishuv-onboarding-${user.id}`);
              } catch {
                /* Dismissal also works when browser storage becomes unavailable. */
              }
              setIntro(false);
            }}
          >
            <T>Tushunarli</T>
          </button>
        </section>
      )}
      <section className="panel friendly-recent">
        <header>
          <h2>
            <T>Mening ishlarim</T>
          </h2>
          <Link className="quiet-link" href="/dashboard">
            <T>Barchasini ko‘rish</T>
            <ArrowRight size={16} />
          </Link>
        </header>
        {data.loading ? (
          <Loading />
        ) : data.error ? (
          <ErrorState message={data.error} retry={data.reload} />
        ) : data.data?.cases.length ? (
          <CustomerCaseList cases={data.data.cases.slice(0, 5)} />
        ) : (
          <Empty
            title="Hozircha sizda ishlar mavjud emas."
            description="Birinchi murojaatingizni yaratib, mumkin bo‘lgan yechimlarni ko‘ring."
          />
        )}
      </section>
      <aside className="friendly-help-line">
        <ShieldCheck size={21} />
        <p>
          <T>
            Ochiq va maxfiy ma’lumotlarni o‘zingiz tanlaysiz. Yakuniy qarorni
            taraflar qabul qiladi.
          </T>
        </p>
        <Link className="quiet-link" href="/help">
          <T>Yordam</T>
          <ArrowRight size={16} />
        </Link>
      </aside>
      {demo && (
        <p className="friendly-demo-note">
          <T>
            Siz namuna hisobidasiz. Shaxsiy ishlar uchun o‘z hisobingizga
            kiring.
          </T>{" "}
          <Link href="/auth/login">
            <T>Hisobga kirish</T>
          </Link>
        </p>
      )}
    </div>
  );
}

export function CustomerPayments() {
  const data = useData<{ payments: CasePayment[] }>("/api/payments");
  if (!data.loading && !data.error && !data.data?.payments.length) return null;
  return (
    <>
      <header className="friendly-page-heading">
        <h2><T>Qo‘lda qayd etilgan tushumlar</T></h2>
      </header>
      <section className="panel friendly-recent">
        {data.loading ? (
          <Loading />
        ) : data.error ? (
          <ErrorState message={data.error} retry={data.reload} />
        ) : data.data?.payments.length ? (
          data.data.payments.map((payment) => (
            <article className="friendly-payment-row" key={payment.id}>
              <div>
                <strong>{payment.reference}</strong>
                <p>{fullDate(payment.recordedAt)}</p>
              </div>
              <strong>
                {money(payment.gross)} <T>so‘m</T>
              </strong>
              <span>
                <T>Qo‘lda qayd etilgan</T>
              </span>
            </article>
          ))
        ) : (
          <Empty
            title="Hozircha to‘lov qayd etilmagan."
            description="Xizmat hajmi va narxini mediator bilan oldindan kelishasiz."
          />
        )}
      </section>
    </>
  );
}
