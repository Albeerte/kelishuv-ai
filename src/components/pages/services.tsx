"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  CreditCard,
  FileText,
  ScanFace,
  ShieldCheck,
  Sparkles,
  Video,
} from "lucide-react";
import { Button } from "../ui/button";
import { Empty, ErrorState, Loading, PageHeading } from "../shared";
import { useProfile } from "../application";
import { T, useI18n } from "@/lib/i18n";
import { useData } from "@/lib/use-data";
import { api, fullDate, money } from "@/lib/utils";
import { DOCUMENT_TARIFFS, EMPTY_IDENTITY_FIELDS } from "@/lib/service-catalog";
import { mediationFee } from "@/lib/legal";
import type { CaseRecord, MediationSession } from "@/lib/types";
import type {
  IdentityFields,
  MediatorInvoice,
  ServiceOrder,
  TemplateId,
} from "@/lib/service-types";

type Services = {
  sms: boolean;
  identity: boolean;
  payment: boolean;
  zoom: boolean;
  commissionPercent: number;
};
type IdentityView = {
  check: {
    status: string;
    fields: IdentityFields;
    extractedFields?: IdentityFields;
    extractionMessage?: string;
    document?: { mime: string };
    nameMatches?: boolean;
    updatedAt: string;
    canResume?: boolean;
  } | null;
  phone: string;
  phoneVerifiedAt?: string;
  services: Services;
};
const identityLabels: Record<string, string> = {
  DRAFT: "Ma’lumot kiritish",
  REVIEW_REQUIRED: "Maydonlarni tekshiring",
  PENDING: "Provayder javobi kutilmoqda",
  VERIFIED: "Shaxs tasdiqlangan",
  FAILED: "Tekshiruvni qayta boshlang",
};

export function IdentityPage() {
  const { t } = useI18n();
  const { user } = useProfile();
  const identity = useData<IdentityView>("/api/identity");
  const [fields, setFields] = useState<IdentityFields>({
    ...EMPTY_IDENTITY_FIELDS,
  });
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [externalConsent, setExternalConsent] = useState(false);
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [next, setNext] = useState(
    user.role === "MEDIATOR" ? "/mediator" : "/",
  );
  const submitting = useRef(false);
  const identityEdited = useRef(false);
  const identityFile = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (identity.data?.check && !identityEdited.current)
      setFields(identity.data.check.fields);
  }, [identity.data?.check?.updatedAt]);
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("next");
    if (value && /^\/invite\/[a-f0-9]{64}$/.test(value)) setNext(value);
  }, []);
  useEffect(() => {
    if (identity.data?.check?.status !== "PENDING") return;
    const timer = setInterval(() => {
      if (!document.hidden) identity.reload();
    }, 5000);
    return () => clearInterval(timer);
  }, [identity.data?.check?.status, identity.reload]);
  async function action(name: string, work: () => Promise<void>) {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(name);
    setError("");
    setMessage("");
    try {
      await work();
      identity.reload();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      submitting.current = false;
      setBusy("");
    }
  }
  if (!identity.data)
    return identity.error ? (
      <ErrorState message={identity.error} retry={identity.reload} />
    ) : (
      <Loading />
    );
  const data = identity.data;
  const locked = ["PENDING", "VERIFIED"].includes(data.check?.status || "");
  return (
    <div className="service-page identity-page">
      <PageHeading
        title={t("Shaxsingizni tasdiqlash")}
        description={t(
          "Telefon, hujjat va Face ID bosqichlarini shu yerda boshqaring.",
        )}
      >
        <Button variant="outline" asChild>
          <Link href={next}>
            <T>Kabinetda davom etish</T>
          </Link>
        </Button>
      </PageHeading>
      <ol className="identity-steps">
        <li className={data.phoneVerifiedAt ? "done" : ""}>
          <ShieldCheck />
          <T>Telefon</T>
        </li>
        <li className={data.check?.document ? "done" : ""}>
          <FileText />
          <T>Pasport va maydonlar</T>
        </li>
        <li className={data.check?.status === "VERIFIED" ? "done" : ""}>
          <ScanFace />
          <T>Face ID</T>
        </li>
      </ol>
      {error && (
        <p className="form-error service-feedback" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="success-note service-feedback" role="status">
          {message}
        </p>
      )}
      <div className="identity-grid">
        <div>
          <section className="panel service-panel">
            <h2>
              <T>Telefon raqamingiz</T>
            </h2>
            <strong className="service-phone">
              {data.phone || t("Telefon kiritilmagan")}
            </strong>
            <p>
              <T>
                {data.phoneVerifiedAt
                  ? "SMS orqali tasdiqlangan"
                  : "SMS tasdiqlashi kutilmoqda"}
              </T>
            </p>
            {data.services.sms ? (
              <Button
                disabled={
                  !!busy || !data.phone || Boolean(data.phoneVerifiedAt)
                }
                onClick={() =>
                  action("sms", async () => {
                    const result = await api<{ challengeId: string }>(
                      "/api/identity/phone/send",
                      { method: "POST" },
                    );
                    setChallengeId(result.challengeId);
                    setMessage(
                      t(
                        "Kod SMS xizmatiga yuborildi. 5 daqiqa ichida kiriting.",
                      ),
                    );
                  })
                }
              >
                <T>Kod yuborish</T>
              </Button>
            ) : (
              <p className="service-pending">
                <T>SMS provayderi ulanishini kutmoqda</T>
              </p>
            )}
            {challengeId && (
              <form
                className="form-stack"
                onSubmit={(event) => {
                  event.preventDefault();
                  action("verify", async () => {
                    await api("/api/identity/phone/verify", {
                      method: "POST",
                      body: JSON.stringify({ challengeId, code }),
                    });
                    setChallengeId("");
                    setMessage(t("Telefon tasdiqlandi."));
                  });
                }}
              >
                <label>
                  <T>6 raqamli SMS kod</T>
                  <input
                    value={code}
                    onChange={(event) =>
                      setCode(event.target.value.replace(/\D/g, ""))
                    }
                    required
                    pattern="[0-9]{6}"
                    maxLength={6}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                  />
                </label>
                <Button disabled={!!busy}>
                  <T>Telefonni tasdiqlash</T>
                </Button>
              </form>
            )}
            <Link href="/settings">
              <T>Telefonni profil orqali o‘zgartirish</T>
            </Link>
          </section>
          <section className="panel service-panel">
            <h2>
              <T>Pasport yoki ID-karta rasmi</T>
            </h2>
            <p>
              <T>
                Asosiy ma’lumotlar tushgan aniq JPG yoki PNG rasm yuklang.
                Hujjat shaxsiy tekshiruvda shifrlangan holda saqlanadi.
              </T>
            </p>
            <form
              className="form-stack"
              onSubmit={(event) => {
                event.preventDefault();
                action("upload", async () => {
                  if (!file) return;
                  const form = new FormData();
                  form.append("file", file);
                  form.append("consent", String(consent));
                  await api("/api/identity/document", {
                    method: "POST",
                    body: form,
                  });
                  setFile(null);
                  if (identityFile.current) identityFile.current.value = "";
                  setMessage(t("Hujjat saqlandi. Maydonlarni tekshiring."));
                });
              }}
            >
              <label>
                <T>Hujjat rasmini tanlang</T>
                <input
                  ref={identityFile}
                  type="file"
                  accept="image/png,image/jpeg"
                  required
                  disabled={locked || !!busy}
                  onChange={(event) => setFile(event.target.files?.[0] || null)}
                />
              </label>
              <label className="consent-checkbox">
                <input
                  type="checkbox"
                  required
                  checked={consent}
                  disabled={locked}
                  onChange={(event) => setConsent(event.target.checked)}
                />
                <span>
                  <T>
                    Shaxsiy hujjatimni tekshiruv uchun saqlash va qayta
                    ishlashga roziman
                  </T>
                </span>
              </label>
              <Button
                type="submit"
                disabled={locked || !!busy || !file || !consent}
              >
                <T>
                  {data.check?.document
                    ? "Hujjatni almashtirish"
                    : "Hujjatni yuklash"}
                </T>
              </Button>
            </form>
            {data.check?.document && (
              <>
                <p className="success-note">
                  <CheckCircle2 size={18} />
                  <T>Hujjat yuklangan</T>
                </p>
                <label className="consent-checkbox">
                  <input
                    type="checkbox"
                    checked={externalConsent}
                    disabled={locked}
                    onChange={(event) =>
                      setExternalConsent(event.target.checked)
                    }
                  />
                  <span>
                    <T>
                      Hujjatni sozlangan tashqi AI xizmatiga yuborishga roziman
                    </T>
                  </span>
                </label>
                <Button
                  variant="outline"
                  disabled={locked || !!busy || !consent}
                  onClick={() =>
                    action("extract", async () => {
                      const result = await api<{
                        check: IdentityView["check"];
                      }>("/api/identity/extract", {
                        method: "POST",
                        body: JSON.stringify({
                          localConsent: true,
                          externalConsent,
                        }),
                      });
                      if (result.check?.extractedFields) {
                        identityEdited.current = true;
                        setFields(
                          (previous) =>
                            Object.fromEntries(
                              Object.keys(previous).map((key) => [
                                key,
                                result.check!.extractedFields![
                                  key as keyof IdentityFields
                                ] || previous[key as keyof IdentityFields],
                              ]),
                            ) as IdentityFields,
                        );
                      }
                      setMessage(result.check?.extractionMessage || "");
                    })
                  }
                >
                  <Sparkles size={18} />
                  <T>
                    {busy === "extract"
                      ? "Matn o‘qilmoqda..."
                      : "AI bilan maydonlarni ajratish"}
                  </T>
                </Button>
              </>
            )}
          </section>
        </div>
        <section className="panel service-panel">
          <h2>
            <T>Hujjatdagi ma’lumotlar</T>
          </h2>
          <p>
            <T>{identityLabels[data.check?.status || "DRAFT"]}</T>
          </p>
          <form
            className="form-stack"
            onSubmit={(event) => {
              event.preventDefault();
              action("fields", async () => {
                await api("/api/identity/fields", {
                  method: "PUT",
                  body: JSON.stringify(fields),
                });
                setMessage(t("Maydonlar saqlandi."));
              });
            }}
          >
            {(
              [
                ["firstName", "Ism"],
                ["lastName", "Familiya"],
                ["middleName", "Otasining ismi"],
                ["birthDate", "Tug‘ilgan sana"],
                ["address", "Manzil"],
                ["documentNumber", "Hujjat raqami"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                <T>{label}</T>
                <input
                  type={key === "birthDate" ? "date" : "text"}
                  value={fields[key]}
                  onChange={(event) => {
                    identityEdited.current = true;
                    setFields({ ...fields, [key]: event.target.value });
                  }}
                  readOnly={locked || !!busy}
                  maxLength={
                    key === "address"
                      ? 500
                      : key === "documentNumber"
                        ? 40
                        : 100
                  }
                  autoComplete={
                    key === "firstName"
                      ? "given-name"
                      : key === "lastName"
                        ? "family-name"
                        : key === "birthDate"
                          ? "bday"
                          : "off"
                  }
                />
              </label>
            ))}
            {data.check?.nameMatches !== undefined && (
              <p
                className={
                  data.check.nameMatches ? "success-note" : "warning-note"
                }
              >
                <T>
                  {data.check.nameMatches
                    ? "Ism va familiya ajratilgan matnga mos"
                    : "Ism va familiyani asl hujjat bilan qayta solishtiring"}
                </T>
              </p>
            )}
            <Button disabled={locked || !!busy} type="submit">
              <T>Maydonlarni saqlash</T>
            </Button>
          </form>
          <div className="identity-face">
            <ScanFace size={32} />
            <h3>
              <T>Yuz orqali tasdiqlash</T>
            </h3>
            <p>
              <T>
                Provayder jonlilikni va hujjat egasini tekshiradi. Natija server
                orqali kelgach shaxs tasdiqlanadi.
              </T>
            </p>
            {data.services.identity ? (
              <Button
                disabled={
                  !!busy ||
                  data.check?.status === "VERIFIED" ||
                  (locked && !data.check?.canResume) ||
                  (!consent && !data.check?.canResume)
                }
                onClick={() =>
                  action("face", async () => {
                    if (!locked)
                      await api("/api/identity/fields", {
                        method: "PUT",
                        body: JSON.stringify(fields),
                      });
                    const result = await api<{ url: string }>(
                      "/api/identity/session",
                      {
                        method: "POST",
                        body: JSON.stringify({ consent: true }),
                      },
                    );
                    window.location.assign(result.url);
                  })
                }
              >
                <T>
                  {data.check?.canResume
                    ? "Face ID oynasini qayta ochish"
                    : "Face ID tekshiruvidan o‘tish"}
                </T>
              </Button>
            ) : (
              <p className="service-pending">
                <T>Face ID provayderi ulanishini kutmoqda</T>
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

type DocumentFields = {
  recipient: string;
  applicant: string;
  facts: string;
  request: string;
  attachments: string;
};
export function TemplateStudio() {
  const { user } = useProfile();
  const { t } = useI18n();
  const query = useSearchParams();
  const queryCase = query.get("case");
  const queryTemplate = query.get("template");
  const querySelection = JSON.stringify([queryCase, queryTemplate]);
  const cases = useData<{ cases: CaseRecord[] }>("/api/cases");
  const orders = useData<{ orders: ServiceOrder[]; services: Services }>(
    "/api/services/orders",
  );
  const [caseId, setCaseId] = useState("");
  const [templateId, setTemplateId] = useState<TemplateId>("DEMAND");
  const [fields, setFields] = useState<DocumentFields>({
    recipient: "",
    applicant: user.fullName,
    facts: "",
    request: "",
    attachments: "",
  });
  const [confirmed, setConfirmed] = useState(false);
  const [external, setExternal] = useState(false);
  const [localConsent, setLocalConsent] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const requestId = useRef("");
  const restoredOrder = useRef("");
  const activeSelection = useRef("");
  activeSelection.current = JSON.stringify([
    caseId,
    templateId,
    querySelection,
  ]);
  const queryApplied = useRef<string | null>(null);
  const draftEdited = useRef(false);
  const record = cases.data?.cases.find((item) => item.id === caseId);
  const ownedCases =
    cases.data?.cases.filter(
      (item) =>
        item.userId === user.id || item.mediation?.respondentId === user.id,
    ) || [];
  const order = orders.data?.orders.find(
    (item) =>
      item.kind === "TEMPLATE" &&
      item.userId === user.id &&
      item.caseId === caseId &&
      item.templateId === templateId &&
      item.status !== "CANCELLED",
  );
  const tariff = DOCUMENT_TARIFFS.find((item) => item.id === templateId)!;
  useEffect(() => {
    if (order?.status !== "PENDING") return;
    const timer = setInterval(() => {
      if (!document.hidden) orders.reload();
    }, 5000);
    return () => clearInterval(timer);
  }, [order?.status, orders.reload]);
  useEffect(() => {
    if (queryApplied.current === querySelection || !cases.data) return;
    queryApplied.current = querySelection;
    requestId.current = "";
    setConfirmed(false);
    const selected = ownedCases.find((item) => item.id === queryCase);
    const selectedTemplate = queryTemplate;
    if (DOCUMENT_TARIFFS.some((item) => item.id === selectedTemplate))
      setTemplateId(selectedTemplate as TemplateId);
    if (selected) {
      restoredOrder.current = "";
      draftEdited.current = false;
      setCaseId(selected.id);
      setFields({
        recipient: "",
        applicant: user.fullName,
        request: "",
        facts:
          selected.positions?.find((position) => position.userId === user.id)
            ?.sharedStatement ||
          (selected.userId === user.id
            ? selected.description
            : selected.mediation?.respondentStatement || ""),
        attachments: selected.documents
          .map((document) => document.name)
          .join("\n"),
      });
    }
  }, [
    querySelection,
    queryCase,
    queryTemplate,
    cases.data,
    ownedCases,
    user.id,
    user.fullName,
  ]);
  useEffect(() => {
    if (order?.draft && restoredOrder.current !== order.id) {
      if (!draftEdited.current) {
        setFields(order.draft);
        setConfirmed(false);
      }
      restoredOrder.current = order.id;
    }
  }, [order]);
  async function purchase() {
    const selection = activeSelection.current;
    setBusy("order");
    setError("");
    requestId.current ||= crypto.randomUUID();
    try {
      const result = await api<{
        checkoutUrl: string | null;
        order: ServiceOrder;
      }>("/api/services/orders", {
        method: "POST",
        body: JSON.stringify({
          requestId: requestId.current,
          kind: "TEMPLATE",
          caseId,
          templateId,
          fields,
        }),
      });
      orders.reload();
      if (activeSelection.current !== selection) return;
      if (result.order.status === "CANCELLED") {
        requestId.current = "";
        setError(
          t(
            "Buyurtma bekor qilingan. Yangi buyurtma yaratish uchun qayta bosing.",
          ),
        );
      }
      if (result.checkoutUrl) window.location.assign(result.checkoutUrl);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function generate(download: boolean) {
    if (!order) return;
    const selection = activeSelection.current;
    setBusy(download ? "download" : "ai");
    setError("");
    try {
      const response = await fetch(
        `/api/templates/${download ? "download" : "autofill"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: order.id,
            fields,
            confirmed,
            localConsent,
            externalConsent: external,
          }),
        },
      );
      if (!response.ok) throw new Error((await response.json()).error);
      if (download) {
        const blob = await response.blob();
        if (activeSelection.current !== selection) return;
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `kelishuv-${templateId}.docx`;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      } else {
        const result = await response.json();
        if (activeSelection.current !== selection) return;
        draftEdited.current = true;
        setFields(result.fields);
        setConfirmed(false);
      }
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <section className="template-studio service-page" id="template-studio">
      <PageHeading
        title={t("Hujjatni tayyorlash")}
        description={t(
          "Tarifni tanlang, ma’lumotlarni tekshiring va DOCX faylni oling.",
        )}
      />
      <div className="document-tariffs">
        {DOCUMENT_TARIFFS.map((item) => (
          <button
            key={item.id}
            className={templateId === item.id ? "selected" : ""}
            aria-pressed={templateId === item.id}
            disabled={!!busy}
            onClick={() => {
              setTemplateId(item.id);
              requestId.current = "";
              restoredOrder.current = "";
              draftEdited.current = false;
              setConfirmed(false);
            }}
          >
            <FileText size={24} />
            <strong>
              <T>{item.title}</T>
            </strong>
            <span className="tariff-price">
              {money(item.price)}{" "}
              <small>
                <T>so‘m</T>
              </small>
            </span>
            <p>
              <T>{item.description}</T>
            </p>
          </button>
        ))}
      </div>
      <p className="field-hint">
        <T>
          Boshlang‘ich platforma tariflari. Har bir hujjat alohida buyurtma
          qilinadi.
        </T>
      </p>
      {cases.error && <ErrorState message={cases.error} retry={cases.reload} />}
      {orders.error && (
        <ErrorState message={orders.error} retry={orders.reload} />
      )}
      <div className="panel service-panel form-stack">
        <label>
          <T>Tegishli nizoni tanlang</T>
          <select
            value={caseId}
            disabled={!!busy}
            onChange={(event) => {
              const selected = ownedCases.find(
                (item) => item.id === event.target.value,
              );
              setCaseId(event.target.value);
              requestId.current = "";
              restoredOrder.current = "";
              draftEdited.current = false;
              setConfirmed(false);
              setFields({
                recipient: "",
                applicant: user.fullName,
                request: "",
                facts:
                  selected?.positions?.find(
                    (position) => position.userId === user.id,
                  )?.sharedStatement ||
                  (selected?.userId === user.id
                    ? selected.description
                    : selected?.mediation?.respondentStatement || ""),
                attachments:
                  selected?.documents
                    .map((document) => document.name)
                    .join("\n") || "",
              });
            }}
          >
            <option value="">{t("Nizoni tanlang")}</option>
            {ownedCases.map((item) => (
              <option key={item.id} value={item.id}>
                {item.number} — {item.demo ? t(item.title) : item.title}
              </option>
            ))}
          </select>
        </label>
        {!ownedCases.length && !cases.loading && (
          <Link href="/dashboard/new">
            <T>Avval yangi muammo boshlang</T>
          </Link>
        )}
        {record && (
          <>
            <div className="template-editor">
              {(
                [
                  ["recipient", "Kimga"],
                  ["applicant", "Murojaatchi"],
                  ["facts", "Holat bayoni"],
                  ["request", "Talab va taklif"],
                  ["attachments", "Ilovalar"],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  <T>{label}</T>
                  <textarea
                    aria-label={t(label)}
                    rows={key === "facts" || key === "request" ? 4 : 2}
                    maxLength={
                      key === "facts"
                        ? 6000
                        : key === "request"
                          ? 4000
                          : key === "attachments"
                            ? 1500
                            : 300
                    }
                    value={fields[key]}
                    disabled={!!busy}
                    onChange={(event) => {
                      draftEdited.current = true;
                      requestId.current = "";
                      setFields({ ...fields, [key]: event.target.value });
                      setConfirmed(false);
                    }}
                  />
                </label>
              ))}
            </div>
            {order?.status === "PAID" ? (
              <>
                <p className="success-note">
                  <CheckCircle2 size={18} />
                  <T>To‘lov tasdiqlangan</T>
                </p>
                <label className="consent-checkbox">
                  <input
                    type="checkbox"
                    checked={localConsent}
                    onChange={(event) => setLocalConsent(event.target.checked)}
                  />
                  <span>
                    <T>
                      O‘z bayonimni mahalliy AI bilan qayta ishlashga roziman
                    </T>
                  </span>
                </label>
                <label className="consent-checkbox">
                  <input
                    type="checkbox"
                    checked={external}
                    onChange={(event) => setExternal(event.target.checked)}
                  />
                  <span>
                    <T>
                      O‘z bayonimni sozlangan tashqi AI xizmatiga yuborishga
                      roziman
                    </T>
                  </span>
                </label>
                <Button
                  variant="outline"
                  disabled={!!busy || !(localConsent || external)}
                  onClick={() => generate(false)}
                >
                  <Sparkles size={18} />
                  <T>
                    {busy === "ai"
                      ? "To‘ldirilmoqda..."
                      : "AI bilan to‘ldirish"}
                  </T>
                </Button>
                <label className="consent-checkbox">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                  />
                  <span>
                    <T>Faktlar, ismlar va talablarni tekshirdim</T>
                  </span>
                </label>
                <Button
                  disabled={!!busy || !confirmed}
                  onClick={() => generate(true)}
                >
                  <T>DOCX faylni yuklash</T>
                </Button>
              </>
            ) : (
              <div className="service-checkout">
                <strong>
                  {money(tariff.price)} <T>so‘m</T>
                </strong>
                <p>
                  <T>
                    {orders.data?.services.payment
                      ? "To‘lovdan keyin AI to‘ldirish va yuklab olish ochiladi."
                      : "To‘lov provayderi ulanishini kutmoqda. Maydonlarni tayyorlab, buyurtmani saqlashingiz mumkin."}
                  </T>
                </p>
                <Button disabled={!!busy} onClick={purchase}>
                  <CreditCard size={18} />
                  <T>
                    {orders.data?.services.payment
                      ? "To‘lovga o‘tish"
                      : order
                        ? "Buyurtma holatini tekshirish"
                        : "Buyurtmani saqlash"}
                  </T>
                </Button>
              </div>
            )}
          </>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

export function ServicePayments() {
  const { user } = useProfile();
  const data = useData<{ orders: ServiceOrder[]; services: Services }>(
    "/api/services/orders",
  );
  const { t } = useI18n();
  const [checkoutError, setCheckoutError] = useState("");
  useEffect(() => {
    if (!data.data?.orders.some((order) => order.status === "PENDING")) return;
    const timer = setInterval(() => {
      if (!document.hidden) data.reload();
    }, 5000);
    return () => clearInterval(timer);
  }, [data.data?.orders, data.reload]);
  return (
    <section className="service-page">
      <PageHeading
        title={t("Buyurtmalar va to‘lovlar")}
        description={t("Hujjatlar, mediator xizmati va platforma ulushi.")}
      />
      {checkoutError && (
        <p role="alert" className="form-error service-feedback">
          {checkoutError}
        </p>
      )}
      {data.error ? (
        <ErrorState message={data.error} retry={data.reload} />
      ) : !data.data ? (
        <Loading />
      ) : (
        <div className="panel service-panel">
          <p
            className={
              data.data.services.payment ? "success-note" : "service-pending"
            }
          >
            <T>
              {data.data.services.payment
                ? "Payme to‘lov ulanishi sozlangan"
                : "Payme hisobi ulanishini kutmoqda"}
            </T>
          </p>
          {data.data.orders.length ? (
            data.data.orders.map((order) => (
              <article className="service-order" key={order.id}>
                <div>
                  <strong>
                    <T>{order.title}</T>
                  </strong>
                  <p>{fullDate(order.createdAt)}</p>
                  <small>
                    <T>
                      {order.status === "PAID"
                        ? "To‘lov tasdiqlangan"
                        : order.status === "CANCELLED"
                          ? "Bekor qilingan"
                          : "To‘lov kutilmoqda"}
                    </T>
                  </small>
                </div>
                <div>
                  <strong>
                    {money(order.amount)} <T>so‘m</T>
                  </strong>
                  {order.kind === "MEDIATOR" && (
                    <p>
                      <T>Platforma ulushi</T> {money(order.platformFee)} ·{" "}
                      <T>Mediatorga hisoblangan</T> {money(order.mediatorNet)}
                    </p>
                  )}
                </div>
                {order.status === "PENDING" &&
                  order.userId === user.id &&
                  data.data?.services.payment && (
                    <Button
                      variant="outline"
                      onClick={async () => {
                        setCheckoutError("");
                        try {
                          const result = await api<{
                            checkoutUrl: string | null;
                          }>(`/api/services/orders/${order.id}`);
                          if (result.checkoutUrl)
                            window.location.assign(result.checkoutUrl);
                          else data.reload();
                        } catch (failure) {
                          setCheckoutError((failure as Error).message);
                          data.reload();
                        }
                      }}
                    >
                      <T>To‘lash</T>
                    </Button>
                  )}
              </article>
            ))
          ) : (
            <Empty
              title="Hozircha buyurtma yo‘q"
              description="Hujjatlar bo‘limida tarifni tanlashingiz mumkin."
            />
          )}
          <Link href="/documents">
            <T>Hujjat namunalari</T>
          </Link>
          <p className="field-hint">
            <T>
              Mediator xizmatining 15 foizi platformaga hisoblanadi. Mediatorga
              bank orqali o‘tkazish provayder bilan hisob-kitob sozlangach
              bajariladi.
            </T>
          </p>
        </div>
      )}
    </section>
  );
}

export function CaseServices({
  record,
  sessions,
  canMediate,
  onSaved,
}: {
  record: CaseRecord;
  sessions: Pick<MediationSession, "id" | "scheduledAt" | "status" | "zoom">[];
  canMediate: boolean;
  onSaved: () => void;
}) {
  const { user } = useProfile();
  const { t } = useI18n();
  const invoice = useData<{
    invoice: MediatorInvoice | null;
    paymentConfigured: boolean;
  }>(`/api/cases/${record.id}/invoice`);
  const services = useData<Services>("/api/services/status");
  const [amount, setAmount] = useState(
    String(mediationFee(record.claimAmount).total),
  );
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const requestId = useRef("");
  const [paymentMessage, setPaymentMessage] = useState("");
  const myShare = invoice.data?.invoice?.parties.find(
    (item) => item.userId === user.id,
  );
  useEffect(() => {
    if (invoice.data?.invoice) return;
    const timer = setInterval(() => {
      if (!document.hidden) invoice.reload();
    }, 5000);
    return () => clearInterval(timer);
  }, [invoice.data?.invoice, invoice.reload]);
  async function run(name: string, operation: () => Promise<void>) {
    setBusy(name);
    setError("");
    try {
      await operation();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <section className="panel service-panel case-services">
      <h2>
        <T>Mediator xizmati va videomuloqot</T>
      </h2>
      <div className="case-cost-summary">
        <div>
          <span>
            <T>Mediator uchun taxminiy jami</T>
          </span>
          <strong>
            {money(
              invoice.data?.invoice?.gross ||
                mediationFee(record.claimAmount).total,
            )}{" "}
            <small>
              <T>so‘m</T>
            </small>
          </strong>
          <p>
            <T>Xizmat hajmi va yakuniy haq mediator bilan yozma kelishiladi.</T>
          </p>
        </div>
        <div>
          <span>
            <T>Sud xarajatlari taxmini</T>
          </span>
          <strong>
            {money(record.analysis.costs.total)}{" "}
            <small>
              <T>so‘m</T>
            </small>
          </strong>
          <p>
            <T>
              Davlat boji, advokat, ekspert va transport taxmini. Imtiyozlar
              alohida tekshiriladi.
            </T>
          </p>
        </div>
      </div>
      <p>
        <T>
          Mediatsiya uchun bazaviy muddat 30 kun, o‘zaro kelishuv bilan yana 30
          kungacha uzaytirilishi mumkin. Sud muddati ish turi va bosqichiga
          bog‘liq.
        </T>
      </p>
      <a href="https://lex.uz/docs/-3805227" target="_blank" rel="noreferrer">
        <T>Mediatsiya to‘g‘risidagi qonun</T>
      </a>
      <Link href="/calculator">
        <T>Xarajatlarni batafsil hisoblash</T>
      </Link>
      {canMediate && !invoice.data?.invoice && (
        <form
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault();
            run("invoice", async () => {
              await api(`/api/cases/${record.id}/invoice`, {
                method: "POST",
                body: JSON.stringify({ amount: Number(amount), confirm }),
              });
              invoice.reload();
            });
          }}
        >
          <label>
            <T>Kelishilgan mediator haqi, so‘m</T>
            <input
              type="number"
              min={1000}
              max={100000000}
              required
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>
          <label className="consent-checkbox">
            <input
              type="checkbox"
              required
              checked={confirm}
              onChange={(event) => setConfirm(event.target.checked)}
            />
            <span>
              <T>
                Summani taraflar bilan kelishdim. Har bir taraf teng ulush
                to‘laydi, platforma ulushi 15 foiz.
              </T>
            </span>
          </label>
          <Button disabled={!!busy || !confirm}>
            <T>Xizmat hisobini yaratish</T>
          </Button>
        </form>
      )}
      {invoice.error && (
        <ErrorState message={invoice.error} retry={invoice.reload} />
      )}
      {myShare && (
        <div className="service-checkout">
          <p>
            <T>Sizning ulushingiz</T>{" "}
            <strong>
              {money(myShare.amount)} <T>so‘m</T>
            </strong>
          </p>
          <p>
            <T>
              To‘lov yakuniy kelishuv barcha ishtirokchilar tomonidan
              imzolangach ochiladi.
            </T>
          </p>
          <Button
            disabled={!!busy}
            onClick={() =>
              run("pay", async () => {
                setPaymentMessage("");
                requestId.current ||= crypto.randomUUID();
                const result = await api<{
                  checkoutUrl: string | null;
                  order: ServiceOrder;
                }>("/api/services/orders", {
                  method: "POST",
                  body: JSON.stringify({
                    kind: "MEDIATOR",
                    requestId: requestId.current,
                    caseId: record.id,
                    invoiceId: invoice.data!.invoice!.id,
                  }),
                });
                if (result.order.status === "PAID")
                  setPaymentMessage(t("To‘lov tasdiqlangan"));
                else if (result.order.status === "CANCELLED") {
                  requestId.current = "";
                  setError(
                    t(
                      "Buyurtma bekor qilingan. Yangi buyurtma yaratish uchun qayta bosing.",
                    ),
                  );
                } else if (result.checkoutUrl)
                  window.location.assign(result.checkoutUrl);
                else
                  setError(
                    t(
                      "To‘lov provayderi ulanishini kutmoqda. Buyurtma saqlandi.",
                    ),
                  );
              })
            }
          >
            <CreditCard size={18} />
            <T>Mediator haqini to‘lash</T>
          </Button>
          {paymentMessage && (
            <p className="success-note" role="status">
              {paymentMessage}
            </p>
          )}
        </div>
      )}
      <div className="service-zoom">
        <h3>
          <Video size={22} />
          <T>Zoom uchrashuvi</T>
        </h3>
        {!services.data?.zoom && (
          <p className="service-pending">
            <T>Zoom hisobi ulanishini kutmoqda</T>
          </p>
        )}
        {sessions
          .filter((session) => session.status === "SCHEDULED")
          .map((session) => (
            <div key={session.id}>
              <p>{fullDate(session.scheduledAt)}</p>
              {session.zoom ? (
                <a
                  className="button"
                  href={session.zoom.joinUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <T>Zoom uchrashuviga kirish</T>
                </a>
              ) : (
                canMediate && (
                  <Button
                    variant="outline"
                    disabled={!!busy || !services.data?.zoom}
                    onClick={() =>
                      run("zoom", async () => {
                        await api(`/api/sessions/${session.id}/zoom`, {
                          method: "POST",
                        });
                        onSaved();
                      })
                    }
                  >
                    <T>Zoom havolasini yaratish</T>
                  </Button>
                )
              )}
            </div>
          ))}
        {!sessions.some((session) => session.status === "SCHEDULED") && (
          <p>
            <T>Avval mediatsiya xonasida onlayn sessiya belgilang.</T>
          </p>
        )}
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
