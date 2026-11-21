"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clipboard,
  FileText,
  Loader2,
  Paperclip,
  Save,
  ShieldCheck,
  UploadCloud,
  X,
} from "lucide-react";
import { useProfile } from "../application";
import { Button } from "../ui/button";
import { T, useI18n } from "@/lib/i18n";
import { useUI } from "@/lib/client-store";
import { api, money } from "@/lib/utils";
import {
  REGIONS,
  TYPE_LABELS,
  type CaseRecord,
  type DisputeType,
} from "@/lib/types";
import { EMPTY_FACTS, RoutingQuestions } from "./mediation";

const draftSchema = z.object({
  requestId: z.string().uuid().optional(),
  submitted: z.boolean().optional(),
  caseId: z.string().uuid().optional(),
  invitationUrl: z.string().max(2000).optional(),
  uploadFailures: z.array(z.string().max(500)).max(10).optional(),
  step: z.number().int().min(1).max(5),
  type: z
    .enum([
      "MEHNAT",
      "SHARTNOMA",
      "QOSHNI",
      "OILA",
      "ISTE_MOLCHI",
      "BIZNES",
      "YER_MULK",
      "BOSHQA",
    ])
    .or(z.literal("")),
  title: z.string().max(120),
  description: z.string().max(10000),
  amount: z.string().max(30),
  region: z.string().max(100),
  city: z.string().max(100),
  invite: z.boolean(),
  name: z.string().max(100),
  email: z.string().max(200),
  phone: z.string().max(30).default(""),
  inviteChannel: z.enum(["PHONE", "EMAIL"]).optional(),
  routingFacts: z.object({
    publicAuthority: z.enum(["YES", "NO", "UNKNOWN"]),
    bothBusinesses: z.enum(["YES", "NO", "UNKNOWN"]),
    arbitrationAgreement: z.enum(["YES", "NO", "UNKNOWN"]),
    internationalCommercial: z.enum(["YES", "NO", "UNKNOWN"]),
    thirdPartyRights: z.enum(["YES", "NO", "UNKNOWN"]),
  }),
});
const descriptions: Record<DisputeType, string> = {
  MEHNAT: "Ish haqi va mehnat munosabatlari",
  SHARTNOMA: "Qarz, ijara va kelishilgan shartlar",
  QOSHNI: "Qo‘shnichilik va umumiy hudud",
  OILA: "Oila va mol-mulk masalalari",
  ISTE_MOLCHI: "Tovar yoki xizmat sifati",
  BIZNES: "Hamkorlar va biznes munosabatlari",
  YER_MULK: "Yer va ko‘chmas mulk",
  BOSHQA: "Boshqa masala bo‘yicha yordam",
};
const steps = [
  "Muammo turi",
  "Vaziyat",
  "Ikkinchi taraf",
  "Hujjatlar",
  "Tekshirish",
];

export function NewCase() {
  const { user } = useProfile();
  return <GuidedCase key={user.id} />;
}

function GuidedCase() {
  const { user } = useProfile();
  const { toast, refresh } = useUI();
  const { t } = useI18n();
  const [draft, setDraft] = useState<z.infer<typeof draftSchema>>({
    step: 1,
    type: "",
    title: "",
    description: "",
    amount: "",
    region: user.region,
    city: user.city || "",
    invite: false,
    name: "",
    email: "",
    phone: "",
    inviteChannel: "PHONE",
    routingFacts: { ...EMPTY_FACTS },
  });
  const [files, setFiles] = useState<File[]>([]);
  const inviteChannel =
    draft.inviteChannel || (draft.email ? "EMAIL" : "PHONE");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [restored, setRestored] = useState(false);
  const [result, setResult] = useState<Pick<CaseRecord, "id" | "title"> | null>(null);
  const [invitationUrl, setInvitationUrl] = useState("");
  const [invitationError, setInvitationError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [uploadFailures, setUploadFailures] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const created = useRef<CaseRecord | null>(null);
  const submitting = useRef(false);
  const requestId = useRef("");
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const key = `kelishuv-case-draft-${user.id}`;
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(key);
      if (saved) {
        const restoredDraft = draftSchema.parse(JSON.parse(saved));
        setDraft({
          ...restoredDraft,
          step: restoredDraft.submitted ? 5 : restoredDraft.step,
        });
        if (restoredDraft.caseId) {
          setResult({ id: restoredDraft.caseId, title: restoredDraft.title });
          setUploadFailures(restoredDraft.uploadFailures || []);
          setInvitationUrl(
            restoredDraft.invitationUrl
              ? new URL(restoredDraft.invitationUrl, window.location.origin)
                  .href
              : "",
          );
          if (restoredDraft.invite && !restoredDraft.invitationUrl)
            setInvitationError("Taklifni qayta yaratishingiz mumkin.");
        }
        setRestored(true);
      } else {
        const type = new URLSearchParams(window.location.search).get("type");
        if (type && Object.hasOwn(TYPE_LABELS, type))
          setDraft((current) => ({ ...current, type: type as DisputeType }));
      }
    } catch {
      try {
        sessionStorage.removeItem(key);
      } catch {
        /* Draft storage is optional. */
      }
    }
  }, [key]);
  function update(values: Partial<typeof draft>) {
    setDraft((current) => ({ ...current, ...values }));
  }
  function changeStep(step: number) {
    if (draft.submitted) return;
    update({ step });
    setError("");
    requestAnimationFrame(() => heading.current?.focus());
  }
  function addFiles(selected: FileList | File[]) {
    const additions = Array.from(selected);
    if (additions.some((file) => file.size > 10 * 1024 * 1024)) {
      setError(t("Har bir fayl 10 MB dan oshmasligi kerak."));
      return;
    }
    setFiles((current) => [...current, ...additions].slice(0, 10));
  }
  function saveDraft() {
    requestId.current ||= draft.requestId || crypto.randomUUID();
    if (writeDraft({ ...draft, requestId: requestId.current }))
      toast(t("Qoralama shu brauzer sessiyasida saqlandi"));
    else
      setError(
        t("Qoralama saqlanmadi. Brauzer saqlash ruxsatlarini tekshiring."),
      );
  }
  function writeDraft(value: typeof draft) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }
  function clearDraft() {
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* Submission works independently of optional browser storage. */
    }
  }
  function saveResult(
    record: Pick<CaseRecord, "id" | "title">,
    failedFiles: string[],
    url = "",
  ) {
    if ((draft.invite && !url) || failedFiles.length)
      writeDraft({
        ...draft,
        title: record.title,
        step: 5,
        submitted: true,
        requestId: requestId.current || draft.requestId,
        caseId: record.id,
        uploadFailures: failedFiles,
        invitationUrl: url,
      });
    else clearDraft();
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (draft.step < 5) {
      changeStep(draft.step + 1);
      return;
    }
    if (submitting.current) return;
    if (
      !draft.type ||
      draft.title.trim().length < 4 ||
      draft.description.trim().length < 20 ||
      draft.city.trim().length < 2
    ) {
      setError(
        t(
          "Sarlavha, vaziyat va shaharni tekshiring. Bo‘sh joylar hisobga olinmaydi.",
        ),
      );
      return;
    }
    requestId.current ||= draft.requestId || crypto.randomUUID();
    const pendingFiles = [
      ...new Set([
        ...(draft.uploadFailures || []),
        ...files.map((file) => file.name),
      ]),
    ];
    const submittedDraft = {
      ...draft,
      step: 5,
      submitted: true,
      requestId: requestId.current,
      uploadFailures: pendingFiles,
    };
    setDraft(submittedDraft);
    writeDraft(submittedDraft);
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const record =
        created.current ||
        (
          await api<{ case: CaseRecord }>("/api/cases", {
            method: "POST",
            body: JSON.stringify({
              requestId: requestId.current,
              title: draft.title.trim(),
              description: draft.description.trim(),
              type: draft.type,
              claimAmount: Number(draft.amount) || 0,
              region: draft.region,
              city: draft.city,
              routingFacts: draft.routingFacts,
            }),
          })
        ).case;
      created.current = record;
      if (!active.current) return;
      saveResult(record, pendingFiles);
      const failed = (draft.uploadFailures || []).filter(
        (name) => !files.some((file) => file.name === name),
      );
      for (const file of files) {
        if (!active.current) return;
        const body = new FormData();
        body.append("file", file);
        body.append("kind", "EVIDENCE");
        body.append("visibility", "MEDIATOR_ONLY");
        try {
          await api(`/api/cases/${record.id}/documents`, {
            method: "POST",
            body,
          });
          if (!active.current) return;
        } catch {
          failed.push(file.name);
        }
      }
      if (!active.current) return;
      setUploadFailures(failed);
      let url = "";
      if (draft.invite) {
        try {
          const invitation = await api<{ invitationUrl: string }>(
            `/api/cases/${record.id}/invitation`,
            {
              method: "POST",
              body: JSON.stringify({
                name: draft.name,
                email: inviteChannel === "EMAIL" ? draft.email : undefined,
                phone: inviteChannel === "PHONE" ? draft.phone : undefined,
                requestId: requestId.current,
                city: draft.city,
              }),
            },
          );
          if (!active.current) return;
          url = new URL(invitation.invitationUrl, window.location.origin).href;
          setInvitationUrl(url);
        } catch (error) {
          if (!active.current) return;
          setInvitationError((error as Error).message);
        }
      }
      saveResult(record, failed, url);
      setResult(record);
      refresh();
    } catch (error) {
      if (active.current) {
        setError((error as Error).message);
        const { status, caseId } = error as Error & {
          status?: number;
          caseId?: string;
        };
        if (status === 409 && caseId) {
          try {
            const recovered = (
              await api<{ case: CaseRecord }>(`/api/cases/${caseId}`)
            ).case;
            if (!active.current) return;
            setResult(recovered);
            setUploadFailures(pendingFiles);
            if (draft.invite)
              setInvitationError("Taklifni qayta yaratishingiz mumkin.");
            saveResult(recovered, pendingFiles);
            setError("");
            refresh();
          } catch (recoveryError) {
            if (active.current) setError((recoveryError as Error).message);
          }
        }
        if (
          status &&
          status >= 400 &&
          status < 500 &&
          status !== 408 &&
          status !== 409
        ) {
          const editable = {
            ...submittedDraft,
            submitted: false,
            uploadFailures: [],
          };
          setDraft(editable);
          writeDraft(editable);
        }
      }
    } finally {
      if (active.current) setBusy(false);
      submitting.current = false;
    }
  }
  if (result)
    return (
      <section className="panel friendly-submitted">
        <CheckCircle2 size={44} />
        <h1>
          <T>Ma’lumotlaringiz qabul qilindi.</T>
        </h1>
        <p>
          <T>
            Dastlabki yo‘nalishlar tayyor. Endi ish tafsilotlari bilan tanishib,
            keyingi qadamni tanlashingiz mumkin.
          </T>
        </p>
        <strong>{result.title}</strong>
        {uploadFailures.length > 0 && (
          <p className="form-error">
            <T>Ayrim hujjatlar yuklanmadi. Ish sahifasida qayta yuklang.</T>{" "}
            {uploadFailures.join(", ")}
          </p>
        )}
        {invitationUrl && (
          <div className="friendly-invitation">
            <T>Taklif havolasi tayyor. Ikkinchi tarafga ulashing.</T>
            <input
              readOnly
              value={invitationUrl}
              aria-label={t("Taklif havolasi")}
              onFocus={(event) => event.target.select()}
            />
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(invitationUrl);
                  setCopyStatus("Havola nusxalandi");
                } catch {
                  setCopyStatus("Havolani belgilab nusxalang");
                }
              }}
            >
              <Clipboard size={18} />
              <T>Havolani nusxalash</T>
            </Button>
            {copyStatus && (
              <p role="status">
                <T>{copyStatus}</T>
              </p>
            )}
          </div>
        )}
        {invitationError && (
          <div className="friendly-invitation-retry">
            <p className="form-error" role="alert">
              <T>Ish saqlandi. Taklif yaratish yakunlanmadi.</T>{" "}
              {t(invitationError)}
            </p>
            <p>
              {draft.name} ·{" "}
              {inviteChannel === "PHONE" ? draft.phone : draft.email}
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const invitation = await api<{ invitationUrl: string }>(
                    `/api/cases/${result.id}/invitation`,
                    {
                      method: "POST",
                      body: JSON.stringify({
                        name: draft.name,
                        email:
                          inviteChannel === "EMAIL" ? draft.email : undefined,
                        phone:
                          inviteChannel === "PHONE" ? draft.phone : undefined,
                        requestId: (requestId.current ||=
                          draft.requestId || crypto.randomUUID()),
                        city: draft.city,
                      }),
                    },
                  );
                  if (active.current) {
                    const sharedUrl = new URL(
                      invitation.invitationUrl,
                      window.location.origin,
                    ).href;
                    setInvitationUrl(sharedUrl);
                    setInvitationError("");
                    saveResult(result, uploadFailures, sharedUrl);
                  }
                } catch (error) {
                  if (active.current)
                    setInvitationError((error as Error).message);
                } finally {
                  if (active.current) setBusy(false);
                }
              }}
            >
              <T>Taklifni qayta yaratish</T>
            </Button>
          </div>
        )}
        <Button asChild>
          <Link href={`/dashboard/cases/${result.id}`}>
            <T>Ishimni ko‘rish</T>
            <ArrowRight size={18} />
          </Link>
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={() => {
            clearDraft();
            window.location.assign("/dashboard/new");
          }}
        >
          <T>Yangi murojaat boshlash</T>
        </Button>
      </section>
    );
  return (
    <div className="friendly-wizard">
      <Link href="/dashboard" className="back-link">
        <ArrowLeft size={16} />
        <T>Mening ishlarim</T>
      </Link>
      <header>
        <h1>
          <T>Muammoingizni birga tushunib olaylik.</T>
        </h1>
        <p>
          <T>
            Hozir bilganlaringizni yozing. Qolganini keyin aniqlashtirish
            mumkin.
          </T>
        </p>
      </header>
      <ol className="friendly-wizard-progress">
        {steps.map((label, index) => (
          <li
            className={
              draft.step === index + 1
                ? "current"
                : draft.step > index + 1
                  ? "complete"
                  : ""
            }
            key={label}
            aria-current={draft.step === index + 1 ? "step" : undefined}
          >
            <span>
              {draft.step > index + 1 ? <Check size={16} /> : index + 1}
            </span>
            <T>{label}</T>
          </li>
        ))}
      </ol>
      {draft.submitted ? (
        <p className="friendly-draft-notice" role="status">
          <T>
            Yuborilgan ma’lumotlar saqlandi. Natijani tekshirish uchun qayta
            yuboring. Shu murojaat tiklanadi.
          </T>
        </p>
      ) : (
        restored && (
          <p className="friendly-draft-notice">
            <T>Qoralamangiz tiklandi. Kerakli fayllarni qaytadan tanlang.</T>
          </p>
        )
      )}
      <form
        className="panel friendly-wizard-panel form-stack"
        onSubmit={submit}
      >
        <h2 ref={heading} tabIndex={-1}>
          <T>{steps[draft.step - 1]}</T>
        </h2>
        {draft.step === 1 && (
          <>
            <p>
              <T>Vaziyatingizga eng yaqin yo‘nalishni tanlang.</T>
            </p>
            <div className="friendly-type-list">
              {Object.entries(TYPE_LABELS).map(([type, label]) => (
                <button
                  type="button"
                  aria-pressed={draft.type === type}
                  className={draft.type === type ? "selected" : ""}
                  key={type}
                  onClick={() => update({ type: type as DisputeType })}
                >
                  <span>
                    <strong>
                      <T>{label}</T>
                    </strong>
                    <small>
                      <T>{descriptions[type as DisputeType]}</T>
                    </small>
                  </span>
                  <span className="selection-check">
                    {draft.type === type && <Check size={15} />}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
        {draft.step === 2 && (
          <>
            <label>
              <T>Muammo sarlavhasi</T>
              <input
                required
                minLength={4}
                maxLength={120}
                value={draft.title}
                onChange={(event) => update({ title: event.target.value })}
                placeholder={t("Masalan, ijara puli bo‘yicha kelishmovchilik")}
              />
            </label>
            <label>
              <T>Vaziyatni qisqacha tushuntiring</T>
              <textarea
                aria-label={t("Vaziyatni qisqacha tushuntiring")}
                aria-describedby="case-description-hint"
                required
                minLength={20}
                maxLength={10000}
                rows={6}
                value={draft.description}
                onChange={(event) =>
                  update({ description: event.target.value })
                }
                placeholder={t(
                  "Nima bo‘ldi va qanday natijaga erishmoqchisiz?",
                )}
              />
              <small id="case-description-hint">
                <T>Oddiy so‘zlar yetarli. Kamida 20 belgi.</T>
              </small>
            </label>
            <label>
              <T>Talab miqdori, so‘m</T>
              <small>
                <T>Ixtiyoriy</T>
              </small>
              <input
                type="number"
                min={0}
                max={1e12}
                step={1}
                value={draft.amount}
                onChange={(event) => update({ amount: event.target.value })}
              />
            </label>
            <details className="friendly-disclosure">
              <summary>
                <T>Huquqiy yo‘l uchun qo‘shimcha savollar</T>
              </summary>
              <RoutingQuestions
                value={draft.routingFacts}
                onChange={(routingFacts) => update({ routingFacts })}
              />
            </details>
          </>
        )}
        {draft.step === 3 && (
          <>
            <p>
              <T>
                Shahar mediator topishga yordam beradi. Ikkinchi tarafni hozir
                yoki keyin taklif qilishingiz mumkin.
              </T>
            </p>
            <div className="form-two-cols">
              <label>
                <T>Hudud</T>
                <select
                  value={draft.region}
                  onChange={(event) => update({ region: event.target.value })}
                >
                  {REGIONS.map((region) => (
                    <option value={region} key={region}>
                      {region}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <T>Shahar yoki tuman</T>
                <input
                  required
                  minLength={2}
                  maxLength={100}
                  value={draft.city}
                  onChange={(event) => update({ city: event.target.value })}
                />
              </label>
            </div>
            <label className="consent-checkbox">
              <input
                type="checkbox"
                checked={draft.invite}
                onChange={(event) => update({ invite: event.target.checked })}
              />
              <span>
                <T>Ikkinchi taraf uchun taklif havolasi yaratmoqchiman</T>
              </span>
            </label>
            {draft.invite && (
              <>
                <label>
                  <T>Taklif usuli</T>
                  <select
                    value={inviteChannel}
                    onChange={(event) =>
                      update({
                        inviteChannel: event.target.value as "PHONE" | "EMAIL",
                      })
                    }
                  >
                    <option value="PHONE">{t("Telefon va SMS")}</option>
                    <option value="EMAIL">
                      {t("Emailga bog‘langan havola")}
                    </option>
                  </select>
                </label>
                <label>
                  <T>Ikkinchi tarafning ismi</T>
                  <input
                    required
                    minLength={2}
                    maxLength={100}
                    value={draft.name}
                    onChange={(event) => update({ name: event.target.value })}
                  />
                </label>
                <label>
                  <T>
                    {inviteChannel === "PHONE"
                      ? "Ikkinchi tarafning telefoni"
                      : "Ikkinchi tarafning emaili"}
                  </T>
                  <input
                    type={inviteChannel === "PHONE" ? "tel" : "email"}
                    required
                    maxLength={200}
                    value={
                      inviteChannel === "PHONE" ? draft.phone : draft.email
                    }
                    placeholder={
                      inviteChannel === "PHONE" ? "+998 90 123 45 67" : ""
                    }
                    onChange={(event) =>
                      update(
                        inviteChannel === "PHONE"
                          ? { phone: event.target.value }
                          : { email: event.target.value },
                      )
                    }
                  />
                </label>
                <p className="field-hint">
                  <T>
                    Taklif ixtiyoriy ishtirok uchun yuboriladi. Har bir taraf
                    o‘z hisobidan qo‘shiladi.
                  </T>
                </p>
              </>
            )}
          </>
        )}
        {draft.step === 4 && (
          <>
            <p>
              <T>
                Hujjat yuklash ixtiyoriy. Ularni ish yaratilgandan so‘ng ham
                qo‘shishingiz mumkin.
              </T>
            </p>
            <input
              className="sr-only"
              aria-label={t("Hujjatlar")}
              ref={fileRef}
              type="file"
              multiple
              accept=".pdf,.docx,.txt,.jpg,.jpeg,.png"
              onChange={(event) => {
                if (event.target.files) addFiles(event.target.files);
                event.target.value = "";
              }}
            />
            <button
              type="button"
              className="friendly-upload"
              onClick={() => fileRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                addFiles(event.dataTransfer.files);
              }}
            >
              <UploadCloud size={32} />
              <strong>
                <T>Hujjat tanlash</T>
              </strong>
              <span>
                <T>PDF, DOCX, TXT, JPG yoki PNG. Har biri 10 MB gacha.</T>
              </span>
            </button>
            <div className="friendly-selected-files">
              {files.map((file, index) => (
                <div key={`${file.name}-${index}`}>
                  <Paperclip size={17} />
                  <span>{file.name}</span>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`${file.name} ${t("faylini olib tashlash")}`}
                    onClick={() =>
                      setFiles((current) =>
                        current.filter((_, selected) => selected !== index),
                      )
                    }
                  >
                    <X size={18} />
                  </button>
                </div>
              ))}
            </div>
            <p className="friendly-privacy-note">
              <ShieldCheck size={18} />
              <T>
                Hujjatlar o‘zingiz va ishga vakolatli mediator uchun saqlanadi.
                Keyin ulashish tanlovini belgilaysiz.
              </T>
            </p>
          </>
        )}
        {draft.step === 5 && (
          <>
            <p>
              <T>Yuborishdan oldin ma’lumotlarni ko‘rib chiqing.</T>
            </p>
            <dl className="friendly-review">
              <div>
                <dt>
                  <T>Muammo</T>
                </dt>
                <dd>{draft.title}</dd>
              </div>
              <div>
                <dt>
                  <T>Yo‘nalish</T>
                </dt>
                <dd>
                  <T>{draft.type ? TYPE_LABELS[draft.type] : ""}</T>
                </dd>
              </div>
              <div>
                <dt>
                  <T>Vaziyat</T>
                </dt>
                <dd>{draft.description}</dd>
              </div>
              <div>
                <dt>
                  <T>Joylashuv</T>
                </dt>
                <dd>
                  {draft.region}, {draft.city}
                </dd>
              </div>
              {draft.amount && (
                <div>
                  <dt>
                    <T>Talab miqdori</T>
                  </dt>
                  <dd>
                    {money(Number(draft.amount))} <T>so‘m</T>
                  </dd>
                </div>
              )}
              <div>
                <dt>
                  <T>Hujjatlar</T>
                </dt>
                <dd>
                  {files.length
                    ? files.map((file) => file.name).join(", ")
                    : t("Keyin qo‘shiladi")}
                </dd>
              </div>
              {draft.invite && (
                <div>
                  <dt>
                    <T>Taklif</T>
                  </dt>
                  <dd>
                    {draft.name},{" "}
                    {inviteChannel === "PHONE" ? draft.phone : draft.email}
                  </dd>
                </div>
              )}
            </dl>
            <p className="friendly-privacy-note">
              <ShieldCheck size={18} />
              <T>
                Dastlabki tahlil tavsiya sifatida beriladi. Ushbu qadamda tashqi
                AIga ma’lumot yuborilmaydi. AI ishloviga rozilikni ish maydonida
                alohida belgilaysiz.
              </T>
            </p>
          </>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <footer className="friendly-wizard-actions">
          <Button
            type="button"
            variant="ghost"
            disabled={busy || draft.submitted}
            onClick={() =>
              draft.step > 1 ? changeStep(draft.step - 1) : saveDraft()
            }
          >
            {draft.step > 1 ? <ArrowLeft size={17} /> : <Save size={17} />}
            <T>{draft.step > 1 ? "Orqaga" : "Qoralamani saqlash"}</T>
          </Button>
          <Button
            type="submit"
            disabled={busy || (draft.step === 1 && !draft.type)}
          >
            {busy ? (
              <Loader2 size={18} className="spin" />
            ) : draft.step === 5 ? (
              <FileText size={18} />
            ) : null}
            <T>
              {busy
                ? "Saqlanmoqda..."
                : draft.step === 5
                  ? "Murojaatni yuborish"
                  : "Davom etish"}
            </T>
            {!busy && draft.step < 5 && <ArrowRight size={17} />}
          </Button>
        </footer>
      </form>
      <div className="friendly-draft-controls">
        <span>
          <T>Qoralama shu brauzer sessiyasida saqlanadi.</T>
        </span>
        {draft.step > 1 && (
          <button
            type="button"
            className="quiet-link"
            disabled={busy || draft.submitted}
            onClick={saveDraft}
          >
            <Save size={16} />
            <T>Qoralamani saqlash</T>
          </button>
        )}
      </div>
    </div>
  );
}
