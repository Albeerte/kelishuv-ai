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
  Link2,
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
import { caseEntryStep, caseEntryTitle, invitationPath } from "@/lib/case-entry";

const draftSchema = z.object({
  version: z.literal(2).optional(),
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
const steps = ["Nizo", "Dalil va taklif", "Yuborish"];

export function NewCase() {
  const { user } = useProfile();
  return <GuidedCase key={user.id} />;
}

function GuidedCase() {
  const { user } = useProfile();
  const { toast, refresh } = useUI();
  const { t } = useI18n();
  const [draft, setDraft] = useState<z.infer<typeof draftSchema>>({
    version: 2,
    step: 1,
    type: "BOSHQA",
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
  const [loaded, setLoaded] = useState(false);
  const [entry, setEntry] = useState<"create" | "join">("create");
  const [inviteLink, setInviteLink] = useState("");
  const [joinError, setJoinError] = useState("");
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
    const query = new URLSearchParams(window.location.search);
    if (query.get("party") === "2") setEntry("join");
    try {
      const saved = sessionStorage.getItem(key);
      if (saved) {
        const restoredDraft = draftSchema.parse(JSON.parse(saved));
        setDraft({
          ...restoredDraft,
          version: 2,
          type: restoredDraft.type || "BOSHQA",
          step: restoredDraft.submitted
            ? 3
            : restoredDraft.description.trim().length < 20 || restoredDraft.city.trim().length < 2
              ? 1
              : caseEntryStep(restoredDraft.step, restoredDraft.version),
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
        const type = query.get("type");
        if (type && Object.hasOwn(TYPE_LABELS, type))
          setDraft((current) => ({ ...current, type: type as DisputeType }));
      }
    } catch {
      try {
        sessionStorage.removeItem(key);
      } catch {
        /* Draft storage is optional. */
      }
    } finally {
      setLoaded(true);
    }
  }, [key]);
  useEffect(() => {
    if (!loaded || result) return;
    try {
      sessionStorage.setItem(key, JSON.stringify(draft));
    } catch {
      /* The form also works when optional browser storage is unavailable. */
    }
  }, [draft, loaded, key, result]);
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
        step: 3,
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
    if (draft.step < 3) {
      if (
        draft.step === 1 &&
        (draft.description.trim().length < 20 || draft.city.trim().length < 2)
      ) {
        setError(t("Vaziyatni kamida 20 belgi bilan yozing va shaharni kiriting."));
        return;
      }
      changeStep(draft.step + 1);
      return;
    }
    if (submitting.current) return;
    if (
      !draft.type ||
      draft.description.trim().length < 20 ||
      draft.city.trim().length < 2
    ) {
      setError(
        t(
          "Vaziyatni kamida 20 belgi bilan yozing va shaharni kiriting.",
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
      title: caseEntryTitle(draft.title, draft.description),
      step: 3,
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
              title: submittedDraft.title,
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
  if (result && entry === "create")
    return (
      <section className="panel friendly-submitted">
        <CheckCircle2 size={44} />
        <h1>
          <T>Nizo saqlandi</T>
        </h1>
        <strong>{result.title}</strong>
        {uploadFailures.length > 0 && (
          <p className="form-error">
            <T>Ayrim hujjatlar yuklanmadi. Ish sahifasida qayta yuklang.</T>{" "}
            {uploadFailures.join(", ")}
          </p>
        )}
        {invitationUrl && (
          <div className="friendly-invitation">
            <T>Havolani 2-tarafga yuboring.</T>
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
          <Link href={`/dashboard/cases/${result.id}/workbench?section=positions`}>
            <T>Nizoni ochish</T>
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
          <T>
            {entry === "create" ? "Yangi nizo" : "Taklifga javob"}
          </T>
        </h1>
      </header>
      <div
        className="party-entry-options"
        role="group"
        aria-label={t("Nizodagi tarafingiz")}
      >
        <button
          type="button"
          aria-pressed={entry === "create"}
          onClick={() => setEntry("create")}
        >
          <strong><T>1-taraf</T></strong>
          <span><T>Murojaat</T></span>
        </button>
        <button
          type="button"
          aria-pressed={entry === "join"}
          onClick={() => setEntry("join")}
        >
          <strong><T>2-taraf</T></strong>
          <span><T>Javob</T></span>
        </button>
      </div>
      {entry === "join" ? (
        <form
          className="panel form-stack party-join-form"
          onSubmit={(event) => {
            event.preventDefault();
            const path = invitationPath(inviteLink);
            if (!path) {
              setJoinError(t("Sizga yuborilgan to‘liq taklif havolasini kiriting."));
              return;
            }
            window.location.assign(path);
          }}
        >
          <h2><T>Sizga taklif yuborildimi?</T></h2>
          <label>
            <T>Taklif havolasi</T>
            <input
              required
              type="text"
              inputMode="url"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={2000}
              value={inviteLink}
              onChange={(event) => {
                setInviteLink(event.target.value);
                setJoinError("");
              }}
              placeholder={t("Bu yerga yuborilgan havolani joylang")}
              aria-describedby="party-join-hint"
              aria-invalid={!!joinError}
            />
          </label>
          <p id="party-join-hint">
            <T>Havolani 1-tarafdan oling. Nizoga qo‘shilgach, o‘z bayoningiz va hujjatlaringizni kiritasiz.</T>
          </p>
          {joinError && <p className="form-error" role="alert">{joinError}</p>}
          <Button type="submit">
            <Link2 size={18} />
            <T>Taklifni ochish</T>
          </Button>
        </form>
      ) : <>
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
            <T>Qoralama tiklandi. Fayllarni qayta tanlang.</T>
          </p>
        )
      )}
      <form
        className="panel friendly-wizard-panel form-stack"
        onSubmit={submit}
      >
        <h2 ref={heading} tabIndex={-1} className={draft.step === 1 ? "sr-only" : undefined}>
          <T>{steps[draft.step - 1]}</T>
        </h2>
        {draft.step === 1 && (
          <>
            <label>
              <T>Vaziyat</T>
              <textarea
                aria-label={t("Vaziyat")}
                aria-describedby="case-description-hint"
                required
                minLength={20}
                maxLength={10000}
                rows={5}
                value={draft.description}
                onChange={(event) =>
                  update({ description: event.target.value })
                }
                placeholder={t(
                  "Nima bo‘ldi? Nimani so‘rayapsiz?",
                )}
              />
              <small id="case-description-hint">
                <T>Ikkinchi taraf ham ko‘radi.</T>
              </small>
            </label>
            <div className="form-two-cols">
              <label>
                <T>Hudud</T>
                <select value={draft.region} onChange={(event) => update({ region: event.target.value })}>
                  {REGIONS.map((region) => <option value={region} key={region}>{region}</option>)}
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
                  autoComplete="address-level2"
                />
              </label>
            </div>
            <details className="friendly-disclosure">
              <summary>
                <T>Qo‘shimcha</T>
              </summary>
              <div className="party-optional-fields">
            <div className="form-two-cols">
              <label>
                <T>Muammo turi</T>
                <select
                  value={draft.type || "BOSHQA"}
                  onChange={(event) => update({ type: event.target.value as DisputeType })}
                >
                  {Object.entries(TYPE_LABELS).map(([type, label]) => (
                    <option key={type} value={type}>
                      {t(type === "BOSHQA" ? "Boshqa / aniq bilmayman" : label)}
                    </option>
                  ))}
                </select>
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
                onInvalid={(event) => {
                  const details = event.currentTarget.closest("details");
                  if (details) details.open = true;
                }}
              />
            </label>
            </div>

                <label>
                  <T>Murojaat nomi</T>
                  <small><T>Ixtiyoriy. Kiritmasangiz, bayoningizdan olinadi.</T></small>
                  <input
                    maxLength={120}
                    value={draft.title}
                    onChange={(event) => update({ title: event.target.value })}
                  />
                </label>
              </div>
              <RoutingQuestions
                value={draft.routingFacts}
                onChange={(routingFacts) => update({ routingFacts })}
              />
            </details>
          </>
        )}
        {draft.step === 2 && (
          <>
            <label className="consent-checkbox">
              <input
                type="checkbox"
                checked={draft.invite}
                onChange={(event) => update({ invite: event.target.checked })}
              />
              <span>
                <T>2-tarafni taklif qilish</T>
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
        {draft.step === 2 && (
          <details className="friendly-disclosure">
            <summary><T>Hujjat ilova qilish</T>{files.length > 0 && ` (${files.length})`}</summary>
            <div className="party-optional-fields">
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
            </div>
          </details>
        )}
        {draft.step === 3 && (
          <>
            <p>
              <T>Yuborishdan oldin ma’lumotlarni ko‘rib chiqing.</T>
            </p>
            <dl className="friendly-review">
              <div>
                <dt>
                  <T>Muammo</T>
                </dt>
                <dd>{caseEntryTitle(draft.title, draft.description)}</dd>
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
            disabled={busy || !loaded}
          >
            {busy ? (
              <Loader2 size={18} className="spin" />
            ) : draft.step === 3 ? (
              <FileText size={18} />
            ) : null}
            <T>
              {busy
                ? "Saqlanmoqda..."
                : draft.step === 3
                  ? "Yuborish"
                  : "Keyingi"}
            </T>
            {!busy && draft.step < 3 && <ArrowRight size={17} />}
          </Button>
        </footer>
      </form>
      <div className="friendly-draft-controls">
        <span>
          <T>Avtomatik saqlanadi.</T>
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
      </>}
    </div>
  );
}
