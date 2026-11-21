"use client";
import { T as LocalizedText } from "@/lib/i18n";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  Download,
  FileCheck2,
  FileText,
  Fingerprint,
  Handshake,
  LockKeyhole,
  MessageCircle,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import {
  Empty,
  ErrorState,
  Loading,
  PageHeading,
  StatusBadge,
} from "../shared";
import { useProfile } from "../application";
import { useI18n } from "@/lib/i18n";
import { useData } from "@/lib/use-data";
import { api, fullDate, money, timeOf } from "@/lib/utils";
import { useUI } from "@/lib/client-store";
import {
  AI_CONSENT_VERSION,
  SIGNING_CONSENT_VERSION,
  SIGNER_ROLES,
  executionSummary,
  obligationPaid,
  tashkentDate,
} from "@/lib/kelishuv-utils";
import { hasBothConsents, hasMutualAppointment, isParty } from "@/lib/mediation";
import type {
  CaseRecord,
  Mediator,
  MediationSession,
  Notification,
} from "@/lib/types";
import { negotiationState } from "@/lib/negotiation";
import { CaseServices } from "./services";
import type {
  Agreement,
  AgreementTerms,
  CaseWorkspace,
  SignatureBox,
  SignatureCapture,
} from "@/lib/kelishuv-types";
import { CaseMediationPanel, LegalGuide } from "./mediation";
import { PdfPreview } from "../agreements/pdf-preview";
import { SignatureCanvas } from "../agreements/signature-canvas";
import { SignatureLayoutEditor } from "../agreements/signature-layout-editor";
import { BookingDialog } from "./mediators";

type Section = "positions" | "analysis" | "agreement" | "execution" | "room";
const sectionLabels: Record<Section, string> = {
  positions: "Tomonlar va bayonlar",
  analysis: "AI tahlil",
  agreement: "Kelishuv va imzo",
  execution: "Ijro kuzatuvi",
  room: "Mediatsiya xonasi",
};

export function WorkspaceIndex({
  mode,
}: {
  mode: "analysis" | "agreements" | "execution" | "room";
}) {
  const { user } = useProfile();
  const data = useData<{
    cases: CaseRecord[];
    agreements: Agreement[];
    aiStatus: CaseWorkspace["aiStatus"];
  }>("/api/workspace");
  const { t } = useI18n();
  const section = mode === "agreements" ? "agreement" : mode;
  if (data.loading && !data.data) return <Loading />;
  if (data.error || !data.data)
    return <ErrorState message={data.error} retry={data.reload} />;
  return (
    <>
      <PageHeading
        title={t(sectionLabels[section])}
        description={t("Nizoni tanlang va umumiy ish maydonida davom eting.")}
      >
        <Button asChild>
          <Link href="/dashboard/new">
            <Plus size={16} />
            <LocalizedText>Yangi nizo boshlash</LocalizedText>
          </Link>
        </Button>
      </PageHeading>
      {mode === "analysis" && (
        <div className="ai-provider-strip">
          <Sparkles size={20} />
          <div>
            <strong>{data.data.aiStatus.model}</strong>
            <span>
              <LocalizedText>{data.data.aiStatus.message}</LocalizedText>
            </span>
          </div>
          <span className="category-pill">
            <LocalizedText>
              {data.data.aiStatus.local ? "Mahalliy ishlov" : "Tashqi xizmat"}
            </LocalizedText>
          </span>
        </div>
      )}
      {data.data.cases.length ? (
        <div className="workspace-index-grid">
          {data.data.cases.map((record) => {
            const agreements = data.data!.agreements.filter(
              (agreement) => agreement.caseId === record.id,
            );
            const signed = agreements
              .flatMap((agreement) => agreement.versions)
              .filter((version) => version.status === "SIGNED");
            const summary =
              record.execution && executionSummary(record.execution);
            return (
              <article className="panel workspace-index-card" key={record.id}>
                <div className="workspace-index-meta">
                  <span>{record.number}</span>
                  <StatusBadge status={record.status} />
                </div>
                <h2>{record.title}</h2>
                <p>{record.city || record.region}</p>
                {mode === "agreements" && (
                  <p>
                    {agreements.length} <LocalizedText>hujjat</LocalizedText>{" "}
                    <LocalizedText>· </LocalizedText>
                    {signed.length}{" "}
                    <LocalizedText>imzolangan nusxa</LocalizedText>
                  </p>
                )}
                {mode === "analysis" && (
                  <p>
                    <LocalizedText>
                      {record.aiReview
                        ? "Tahlil tayyor"
                        : "Ikki taraf bayoni asosida tahlil tayyorlang"}
                    </LocalizedText>
                  </p>
                )}
                {summary && mode === "execution" && (
                  <div className="index-execution">
                    <strong>
                      {summary.progress}
                      <LocalizedText>%</LocalizedText>
                    </strong>
                    <span>
                      {money(summary.remaining)}{" "}
                      <LocalizedText>so‘m qoldiq</LocalizedText>
                    </span>
                    <progress value={summary.progress} max={100} />
                  </div>
                )}
                <Button variant="outline" asChild>
                  <Link
                    href={`/dashboard/cases/${record.id}/workbench?section=${section}`}
                  >
                    <LocalizedText>Ish maydonini ochish</LocalizedText>
                    <ArrowRight size={16} />
                  </Link>
                </Button>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="panel">
          <Empty
            title={t("Hozircha nizo yo‘q")}
            description={t(
              user.role === "MEDIATOR"
                ? "Qabul qilingan nizolar shu yerda ko‘rinadi."
                : "Yangi nizo yarating yoki ikkinchi taraf taklifini qabul qiling.",
            )}
          />
        </div>
      )}
    </>
  );
}

export function CaseWorkbench({
  caseId,
  section: initialSection = "positions",
}: {
  caseId: string;
  section?: Section;
}) {
  const workspace = useData<CaseWorkspace>(`/api/cases/${caseId}/workspace`);
  const details = useData<{
    mediator: Mediator | null;
    sessions: MediationSession[];
  }>(`/api/cases/${caseId}`);
  const [section, setSection] = useState<Section>(initialSection);
  const { t } = useI18n();
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get(
      "section",
    ) as Section;
    if (value in sectionLabels) setSection(value);
  }, [caseId]);
  useEffect(() => {
    if (
      section !== "room" &&
      section !== "analysis" &&
      section !== "execution" &&
      section !== "agreement"
    )
      return;
    const interval = window.setInterval(
      () => {
        if (!document.hidden) {
          workspace.reload();
          if (section === "room" || section === "execution") details.reload();
        }
      },
      section === "room" || section === "analysis" ? 2000 : 12000,
    );
    return () => clearInterval(interval);
  }, [section, workspace.reload, details.reload]);
  if (workspace.loading && !workspace.data) return <Loading />;
  if (workspace.error || !workspace.data)
    return <ErrorState message={workspace.error} retry={workspace.reload} />;
  const data = workspace.data;
  return (
    <div className="case-workbench">
      <Link className="back-link" href={`/dashboard/cases/${caseId}`}>
        <ArrowLeft size={15} />
        <LocalizedText>Nizo tafsilotlari</LocalizedText>
      </Link>
      <div className="workbench-heading">
        <div>
          <span className="workspace-case-number">{data.case.number}</span>
          <PageHeading
            title={data.case.title}
            description={`${data.case.city || data.case.region} · ${t("Umumiy ish maydoni")}`}
          />
        </div>
        <StatusBadge status={data.case.status} />
      </div>
      <nav className="workbench-tabs" aria-label={t("Nizo bosqichlari")}>
        {Object.entries(sectionLabels).map(([key, label]) => (
          <button
            key={key}
            className={section === key ? "active" : ""}
            aria-current={section === key ? "step" : undefined}
            onClick={() => {
              setSection(key as Section);
              window.history.replaceState(null, "", `?section=${key}`);
            }}
          >
            {key === "analysis" ? (
              <Sparkles size={17} />
            ) : key === "agreement" ? (
              <Fingerprint size={17} />
            ) : key === "execution" ? (
              <CheckCircle2 size={17} />
            ) : key === "room" ? (
              <MessageCircle size={17} />
            ) : (
              <Handshake size={17} />
            )}
            <LocalizedText>{label}</LocalizedText>
          </button>
        ))}
      </nav>
      {section === "positions" && (
        <>
          <PositionEditor
            key={`${caseId}-${data.myPosition?.userId || "new"}`}
            data={data}
            onSaved={workspace.reload}
          />
          <CaseMediationPanel
            record={data.case}
            mediator={details.data?.mediator || null}
          />
        </>
      )}
      {section === "analysis" && (
        <AnalysisWorkspace data={data} onSaved={workspace.reload} />
      )}
      {section === "agreement" && (
        <AgreementWorkspace data={data} onSaved={workspace.reload} />
      )}
      {section === "execution" && (
        <ExecutionWorkspace data={data} onSaved={workspace.reload} />
      )}
      {(section === "room" || section === "execution") && (
        <CaseServices
          record={data.case}
          canMediate={data.canMediate}
          sessions={details.data?.sessions || []}
          onSaved={() => {
            workspace.reload();
            details.reload();
          }}
        />
      )}
      {section === "room" && (
        <RoomWorkspace
          data={data}
          mediator={details.data?.mediator || null}
          sessions={details.data?.sessions || []}
          onSaved={workspace.reload}
        />
      )}
    </div>
  );
}

function PositionEditor({
  data,
  onSaved,
}: {
  data: CaseWorkspace;
  onSaved: () => void;
}) {
  const { user } = useProfile();
  const { toast, refresh } = useUI();
  const { t } = useI18n();
  const [shared, setShared] = useState(
    data.myPosition?.sharedStatement ||
      (user.id === data.case.userId
        ? data.case.description
        : data.case.mediation?.respondentStatement || ""),
  );
  const [confidential, setConfidential] = useState(
    data.myPosition?.confidentialStatement || "",
  );
  const [local, setLocal] = useState(data.myPosition?.consent.local || false);
  const [external, setExternal] = useState(
    data.myPosition?.consent.external || false,
  );
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState("APPLICATION");
  const [visibility, setVisibility] = useState("MEDIATOR_ONLY");
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api(`/api/cases/${data.case.id}/positions`, {
        method: "POST",
        body: JSON.stringify({
          sharedStatement: shared,
          confidentialStatement: confidential,
          localConsent: local,
          externalConsent: external,
          consentVersion: AI_CONSENT_VERSION,
        }),
      });
      toast(t("Bayoningiz saqlandi"));
      refresh();
      onSaved();
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  async function upload(file: File) {
    setBusy(true);
    const body = new FormData();
    body.append("file", file);
    body.append("kind", kind);
    body.append("visibility", visibility);
    try {
      await api(`/api/cases/${data.case.id}/documents`, {
        method: "POST",
        body,
      });
      toast(t("Hujjat yuklandi"));
      onSaved();
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="panel workbench-panel">
        <div className="section-heading">
          <div>
            <h2>
              <LocalizedText>Har bir tarafning o‘z bayoni</LocalizedText>
            </h2>
            <p>
              <LocalizedText>
                Ochiq ma’lumotlar ikkala tarafga ko‘rinadi. Maxfiy bayon
                o‘zingiz va vakolatli mediator uchun saqlanadi.
              </LocalizedText>
            </p>
          </div>
          <LockKeyhole size={23} />
        </div>
        {isParty(data.case, user.id) ? (
          <form className="form-stack panel-body" onSubmit={save}>
            <label>
              <LocalizedText>Ochiq ma’lumotlar</LocalizedText>
              <textarea
                required
                minLength={20}
                maxLength={10000}
                rows={5}
                value={shared}
                readOnly={["RESOLVED", "CLOSED"].includes(data.case.status)}
                onChange={(event) => setShared(event.target.value)}
              />
            </label>
            <label>
              <LocalizedText>Maxfiy ma’lumotlar</LocalizedText>
              <textarea
                maxLength={10000}
                rows={4}
                value={confidential}
                readOnly={["RESOLVED", "CLOSED"].includes(data.case.status)}
                onChange={(event) => setConfidential(event.target.value)}
                placeholder={t(
                  "Faqat o‘zingiz va vakolatli mediator bilan muhokama qilinadigan ma’lumotlar",
                )}
              />
            </label>
            <div className="ai-consent-box">
              <h3>
                <LocalizedText>AI ishlovi uchun tanlovingiz</LocalizedText>
              </h3>
              <label className="consent-checkbox">
                <input
                  type="checkbox"
                  checked={local}
                  onChange={(event) => setLocal(event.target.checked)}
                />
                <span>
                  <LocalizedText>
                    Matn va ruxsat bergan hujjatlarimga ushbu kompyuterdagi
                    mahalliy AI modeli ishlov berishiga roziman.
                  </LocalizedText>
                </span>
              </label>
              <label className="consent-checkbox">
                <input
                  type="checkbox"
                  checked={external}
                  onChange={(event) => setExternal(event.target.checked)}
                />
                <span>
                  <LocalizedText>
                    Sozlangan tashqi AI xizmatiga ma’lumot yuborishga roziman.
                    Provayder holati tahlil bo‘limida ko‘rsatiladi.
                  </LocalizedText>
                </span>
              </label>
              <small>
                <LocalizedText>
                  Umumiy takliflar ochiq bayon va ulashilgan dalillardan
                  tayyorlanadi. Maxfiy tahlil alohida saqlanadi. Rozilik
                  tanlovingizni nizo yakunlangach ham o‘zgartirishingiz mumkin.
                </LocalizedText>
              </small>
            </div>
            <Button disabled={busy} type="submit">
              <Check size={16} />
              <LocalizedText>Bayon va rozilikni saqlash</LocalizedText>
            </Button>
          </form>
        ) : (
          <div className="panel-body">
            <div className="party-statements">
              {data.case.positions?.map((position) => (
                <article key={position.userId}>
                  <h3>
                    {
                      data.participants.find(
                        (party) => party.userId === position.userId,
                      )?.fullName
                    }
                  </h3>
                  <h4>
                    <LocalizedText>Ochiq bayon</LocalizedText>
                  </h4>
                  <p>{position.sharedStatement}</p>
                  {position.confidentialStatement && (
                    <>
                      <h4>
                        <LockKeyhole size={14} />
                        <LocalizedText>Maxfiy bayon</LocalizedText>
                      </h4>
                      <p>{position.confidentialStatement}</p>
                    </>
                  )}
                </article>
              ))}
            </div>
          </div>
        )}
      </section>
      <section className="panel workbench-panel">
        <div className="section-heading">
          <div>
            <h2>
              <LocalizedText>Ariza va dalillar</LocalizedText>
            </h2>
            <p>
              <LocalizedText>
                PDF, DOCX, TXT, JPG, PNG · 10 MB gacha
              </LocalizedText>
            </p>
          </div>
          <UploadCloud size={22} />
        </div>
        <div className="panel-body form-stack">
          <div className="form-two-cols">
            <label>
              <LocalizedText>Hujjat turi</LocalizedText>
              <select
                value={kind}
                onChange={(event) => setKind(event.target.value)}
              >
                <option value="APPLICATION">{t("Ariza yoki bayon")}</option>
                <option value="EVIDENCE">{t("Dalil va ilova")}</option>
              </select>
            </label>
            <label>
              <LocalizedText>Hujjatni kim ko‘radi?</LocalizedText>
              <select
                value={visibility}
                disabled={busy}
                onChange={(event) => setVisibility(event.target.value)}
              >
                <option value="MEDIATOR_ONLY">
                  {t("O‘zim va vakolatli mediator")}
                </option>
                <option value="PARTIES">{t("Ikkala taraf va mediator")}</option>
              </select>
            </label>
          </div>
          <label>
            <LocalizedText>Fayl yuklash</LocalizedText>
            <input
              type="file"
              disabled={busy}
              accept=".pdf,.docx,.txt,.png,.jpg,.jpeg"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void upload(file);
                event.target.value = "";
              }}
            />
          </label>
          <EvidenceList data={data} onSaved={onSaved} />
        </div>
      </section>
    </>
  );
}

function EvidenceList({
  data,
  onSaved,
}: {
  data: CaseWorkspace;
  onSaved: () => void;
}) {
  const { user } = useProfile();
  const { toast } = useUI();
  const [busy, setBusy] = useState("");
  const { t } = useI18n();
  async function extract(id: string) {
    setBusy(id);
    try {
      await api(`/api/cases/${data.case.id}/documents/${id}/extract`, {
        method: "POST",
      });
      toast(t("Hujjat tahlili saqlandi"));
      onSaved();
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="evidence-inventory">
      {data.case.documents.length ? (
        data.case.documents.map((document) => (
          <article className="evidence-item" key={document.id}>
            <div className="evidence-item-heading">
              <FileText size={21} />
              <div>
                <strong>{document.name}</strong>
                <small>
                  {document.visibility === "PARTIES"
                    ? t("Taraflarga ochiq")
                    : t("Maxfiy hujjat")}{" "}
                  <LocalizedText>· </LocalizedText>
                  {Math.ceil(document.size / 1024)}{" "}
                  <LocalizedText>KB</LocalizedText>
                </small>
              </div>
              <a
                href={`/api/cases/${data.case.id}/documents/${document.id}`}
                aria-label={t("Yuklab olish")}
              >
                <Download size={18} />
              </a>
              {(document.uploadedBy === user.id || data.canMediate) && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!!busy}
                  onClick={() => extract(document.id)}
                >
                  {busy === document.id
                    ? t("Tahlil qilinmoqda...")
                    : t("Matn va dalillarni ajratish")}
                </Button>
              )}
            </div>
            {document.extraction && (
              <details>
                <summary>
                  <LocalizedText>
                    Ajratilgan ma’lumotlarni ko‘rish
                  </LocalizedText>{" "}
                  <LocalizedText>·</LocalizedText>{" "}
                  {document.extraction.provider} {document.extraction.model}
                </summary>
                <p className="extracted-text">
                  {document.extraction.text ||
                    t("Matn ajratilmadi. Mediator tekshiruvi kerak.")}
                </p>
                <p>
                  <LocalizedText>Sanalar</LocalizedText>{" "}
                  <LocalizedText>· </LocalizedText>
                  {document.extraction.dates.join(", ") || "—"}
                </p>
                <p>
                  <LocalizedText>Summalar</LocalizedText>{" "}
                  <LocalizedText>·</LocalizedText>{" "}
                  {document.extraction.amounts.map(money).join(", ") || "—"}
                </p>
                <p>
                  <LocalizedText>Ko‘rinadigan imzo belgilari</LocalizedText>{" "}
                  <LocalizedText>·</LocalizedText>{" "}
                  {document.extraction.visibleSignatures.join(", ") || "—"}
                </p>
                {document.extraction.warnings.map((warning) => (
                  <p className="ai-limit" key={warning}>
                    {warning}
                  </p>
                ))}
              </details>
            )}
          </article>
        ))
      ) : (
        <p>
          <LocalizedText>Hujjatlar hali yuklanmagan.</LocalizedText>
        </p>
      )}
    </div>
  );
}

function AnalysisWorkspace({
  data,
  onSaved,
}: {
  data: CaseWorkspace;
  onSaved: () => void;
}) {
  const { user } = useProfile();
  const { toast } = useUI();
  const { t } = useI18n();
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  async function run(privateReview = false) {
    setBusy(privateReview ? "private" : "shared");
    try {
      await api(
        `/api/cases/${data.case.id}/${privateReview ? "private-ai" : "ai"}`,
        { method: "POST" },
      );
      onSaved();
      toast(t("Tahlil tayyor"));
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setBusy("");
    }
  }
  async function respond(proposalId: string, decision: string) {
    setBusy(proposalId);
    try {
      await api(`/api/cases/${data.case.id}/proposals/${proposalId}/respond`, {
        method: "POST",
        body: JSON.stringify({
          reviewId: data.case.aiReview!.id,
          decision,
          note,
        }),
      });
      toast(t("Javobingiz saqlandi"));
      onSaved();
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setBusy("");
    }
  }
  const review = data.case.aiReview;
  const negotiation = negotiationState(data.case);
  const sequential = data.case.journeyVersion === 3;
  const nextSection =
    negotiation.agreed && data.case.mediatorId ? "agreement" : "positions";
  return (
    <>
      <section className="panel workbench-panel">
        <div className="section-heading">
          <div>
            <h2>
              <Sparkles size={22} />
              <LocalizedText>
                Ikki tarafli tahlil va to‘rtta taklif
              </LocalizedText>
            </h2>
            <p>
              <LocalizedText>
                AI tayyorlaydi. Qarorni taraflar va mediator qabul qiladi.
              </LocalizedText>
            </p>
          </div>
          <Button disabled={!!busy} onClick={() => run()}>
            <RefreshCw size={16} />
            <LocalizedText>
              {busy === "shared"
                ? "Tahlil qilinmoqda..."
                : review
                  ? "Tahlilni yangilash"
                  : "Tahlil va 4 taklif tayyorlash"}
            </LocalizedText>
          </Button>
        </div>
        <div className="panel-body">
          <div className="ai-provider-strip">
            <Sparkles size={19} />
            <div>
              <strong>{data.aiStatus.model}</strong>
              <span>
                <LocalizedText>{data.aiStatus.message}</LocalizedText>
              </span>
            </div>
          </div>
          {data.aiStale && (
            <p className="warning-note">
              <LocalizedText>
                Bayon yoki dalillar yangilangan. Takliflarga javob berishdan
                oldin tahlilni yangilang.
              </LocalizedText>
            </p>
          )}
          {!review && (
            <p>
              <LocalizedText>
                Ikkala taraf ochiq bayonini kiritsin. Modelga rozilik bo‘lsa AI
                tahlili, boshqa holatda mahalliy qoidalar ishlatiladi.
              </LocalizedText>
            </p>
          )}
          {review && (
            <>
              <div className="analysis-output">
                <span className="category-pill">
                  {review.provider} <LocalizedText>· </LocalizedText>
                  {review.model}
                </span>
                <h3>{review.mainIssue}</h3>
                <p>{review.summary}</p>
                <div className="analysis-columns">
                  <div>
                    <h4>
                      <LocalizedText>
                        Aniqlashtiriladigan ma’lumotlar
                      </LocalizedText>
                    </h4>
                    <ul>
                      {review.missingInformation.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4>
                      <LocalizedText>Bahsli faktlar</LocalizedText>
                    </h4>
                    <ul>
                      {review.disputedFacts.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                {review.contradictions.length > 0 && (
                  <>
                    <h4>
                      <LocalizedText>
                        Solishtiriladigan tafovutlar
                      </LocalizedText>
                    </h4>
                    <ul>
                      {review.contradictions.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </>
                )}
                <p>{review.mediationEligibility}</p>
                <p>
                  <strong>{review.nextStep}</strong>
                </p>
                {review.warnings.map((item) => (
                  <p className="ai-limit" key={item}>
                    {item}
                  </p>
                ))}
              </div>
              <div className="settlement-proposals">
                {sequential && <div className="negotiation-progress">
                  <strong>
                    {Math.min(negotiation.round, 4)}/4{" "}
                    <LocalizedText>taklif</LocalizedText>
                  </strong>
                  <p>
                    <LocalizedText>
                      {negotiation.agreed
                        ? "Ikkala taraf taklifni ma’qulladi. Kelishuvni rasmiylashtiring."
                        : negotiation.exhausted
                          ? "To‘rtta taklif yakunlandi. Mediator bilan davom eting."
                          : "Har ikki taraf javob bergach keyingi taklif ochiladi."}
                    </LocalizedText>
                  </p>
                  {(negotiation.agreed || negotiation.exhausted) && (
                    <Button asChild>
                      <a
                        href={`/dashboard/cases/${data.case.id}/workbench?section=${nextSection}`}
                      >
                        <LocalizedText>
                          {negotiation.agreed
                            ? "Kelishuv"
                            : "Mediator bilan davom etish"}
                        </LocalizedText>
                      </a>
                    </Button>
                  )}
                </div>}
                {review.proposals
                  .filter((_, index) => !sequential || index === negotiation.index)
                  .map((proposal) => {
                    const mine = data.case.proposalDecisions?.find(
                      (decision) =>
                        decision.reviewId === review.id &&
                        decision.proposalId === proposal.id &&
                        decision.userId === user.id,
                    );
                    return (
                      <article key={proposal.id} className="proposal-card">
                        <div className="proposal-card-head">
                          <Handshake size={21} />
                          {mine && (
                            <span className="category-pill">
                              {t(
                                mine.decision === "ACCEPT"
                                  ? "Qabul qilindi"
                                  : mine.decision === "REJECT"
                                    ? "Rad etildi"
                                    : "O‘zgartirish so‘raldi",
                              )}
                            </span>
                          )}
                        </div>
                        <h3>
                          <LocalizedText>{proposal.title}</LocalizedText>
                        </h3>
                        <p>
                          <LocalizedText>{proposal.description}</LocalizedText>
                        </p>
                        <strong className="proposal-amount">
                          {money(proposal.amount)}{" "}
                          <LocalizedText>so‘m</LocalizedText>
                        </strong>
                        <ul className="proposal-schedule">
                          {proposal.schedule.map((payment, index) => (
                            <li key={index}>
                              <CalendarDays size={14} />
                              <span>{payment.dueDate}</span>
                              <strong>
                                {money(payment.amount)}{" "}
                                <LocalizedText>so‘m</LocalizedText>
                              </strong>
                            </li>
                          ))}
                        </ul>
                        <details>
                          <summary>
                            <LocalizedText>
                              Mas’uliyat, afzallik va shartlar
                            </LocalizedText>
                          </summary>
                          <ul>
                            {[
                              ...proposal.responsibilities,
                              ...proposal.advantages,
                              ...proposal.risks,
                              ...proposal.conditions,
                            ].map((item) => (
                              <li key={item}>
                                <LocalizedText>{item}</LocalizedText>
                              </li>
                            ))}
                          </ul>
                        </details>
                        {isParty(data.case, user.id) && (
                          <div className="proposal-actions">
                            <Button
                              size="sm"
                              disabled={
                                !!busy || data.aiStale || sequential && (negotiation.complete || !hasBothConsents(data.case))
                              }
                              onClick={() => respond(proposal.id, "ACCEPT")}
                            >
                              <LocalizedText>Qabul qilish</LocalizedText>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={
                                !!busy || data.aiStale || sequential && (negotiation.complete || !hasBothConsents(data.case))
                              }
                              onClick={() => respond(proposal.id, "CHANGES")}
                            >
                              <LocalizedText>O‘zgartirish</LocalizedText>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={
                                !!busy || data.aiStale || sequential && (negotiation.complete || !hasBothConsents(data.case))
                              }
                              onClick={() => respond(proposal.id, "REJECT")}
                            >
                              <LocalizedText>Rad etish</LocalizedText>
                            </Button>
                          </div>
                        )}
                        <div className="proposal-responses">
                          {data.participants
                            .filter(
                              (participant) => participant.role !== "MEDIATOR",
                            )
                            .map((participant) => {
                              const decision =
                                data.case.proposalDecisions?.find(
                                  (decision) =>
                                    decision.userId === participant.userId &&
                                    decision.reviewId === review.id &&
                                    decision.proposalId === proposal.id,
                                );
                              return (
                                <p key={participant.userId}>
                                  <span>{participant.fullName}</span>
                                  <strong>
                                    <LocalizedText>
                                      {decision
                                        ? decision.decision === "ACCEPT"
                                          ? "Qabul qilindi"
                                          : decision.decision === "REJECT"
                                            ? "Rad etildi"
                                            : "O‘zgartirish so‘raldi"
                                        : "Javob kutilmoqda"}
                                    </LocalizedText>
                                  </strong>
                                </p>
                              );
                            })}
                        </div>
                      </article>
                    );
                  })}
              </div>
              {isParty(data.case, user.id) && (
                <label className="proposal-note">
                  <LocalizedText>Javobingizga izoh</LocalizedText>
                  <textarea
                    maxLength={3000}
                    rows={3}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </label>
              )}
            </>
          )}
        </div>
      </section>
      <section className="panel workbench-panel">
        <div className="section-heading">
          <h2>
            <LockKeyhole size={20} />
            <LocalizedText>Maxfiy tahlil</LocalizedText>
          </h2>
          {isParty(data.case, user.id) && (
            <Button
              variant="outline"
              disabled={!!busy || !data.myPosition?.confidentialStatement}
              onClick={() => run(true)}
            >
              <LocalizedText>
                {busy === "private"
                  ? "Tahlil qilinmoqda..."
                  : "Maxfiy bayonimni tahlil qilish"}
              </LocalizedText>
            </Button>
          )}
        </div>
        <div className="panel-body">
          {data.case.privateReviews?.length ? (
            data.case.privateReviews.map((review) => (
              <article className="private-review" key={review.id}>
                <span className="category-pill">
                  {review.provider} <LocalizedText>· </LocalizedText>
                  {review.model}
                </span>
                <ul>
                  {[...review.observations, ...review.questions].map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                {review.warnings.map((item) => (
                  <p className="ai-limit" key={item}>
                    {item}
                  </p>
                ))}
              </article>
            ))
          ) : (
            <p>
              <LocalizedText>
                Maxfiy bayon va tahlil faqat egasi hamda vakolatli mediatorga
                ko‘rinadi.
              </LocalizedText>
            </p>
          )}
        </div>
      </section>
      <LegalGuide guidance={data.case.guidance} />
    </>
  );
}

function AgreementWorkspace({
  data,
  onSaved,
}: {
  data: CaseWorkspace;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [edit, setEdit] = useState<Agreement | "NEW" | null>(null);
  const [kind, setKind] = useState<"PROCEDURE" | "SETTLEMENT">(
    data.case.mediation?.procedureDocumentId ? "SETTLEMENT" : "PROCEDURE",
  );
  return (
    <>
      <section className="panel workbench-panel">
        <div className="section-heading">
          <div>
            <h2>
              <FileCheck2 size={22} />
              <LocalizedText>Kelishuvlar va imzolash</LocalizedText>
            </h2>
            <p>
              <LocalizedText>
                Ikkala taraf mustaqil imzolaydi, mediator yakuniy tasdig‘ini
                qayd etadi.
              </LocalizedText>
            </p>
          </div>
          {data.canMediate && (
            <div className="agreement-create-actions">
              <select
                aria-label={t("Kelishuv turi")}
                value={kind}
                onChange={(event) => setKind(event.target.value as typeof kind)}
              >
                <option value="PROCEDURE">
                  {t("Tartib-taomil kelishuvi")}
                </option>
                <option value="SETTLEMENT">{t("Mediativ kelishuv")}</option>
              </select>
              <Button
                disabled={
                  !hasMutualAppointment(data.case) ||
                  data.agreements.some((agreement) => agreement.kind === kind)
                }
                onClick={() => setEdit("NEW")}
              >
                <Plus size={16} />
                <LocalizedText>Hujjat yaratish</LocalizedText>
              </Button>
            </div>
          )}
        </div>
        <div className="panel-body">
          <p className="signing-legal-note">
            <ShieldCheck size={19} />
            <LocalizedText>
              Qo‘lda chizilgan imzo vizual yozuv, vaqt va hujjat xeshi bilan
              saqlanadi. ERI va shaxsni davlat tizimida tekshirish holati
              alohida ko‘rsatiladi.
            </LocalizedText>
            <a
              href="https://lex.uz/docs/-6234904"
              target="_blank"
              rel="noreferrer"
            >
              <LocalizedText>ERI qonuni</LocalizedText>
            </a>
          </p>
          {!hasMutualAppointment(data.case) && (
            <p className="info-note">
              <LocalizedText>
                Avval ikkala taraf qabul qilgan mediatorni tanlaganini
                tasdiqlasin. Bu amal “Tomonlar va bayonlar” bo‘limida mavjud.
              </LocalizedText>
            </p>
          )}
          {data.agreements.length ? (
            data.agreements.map((agreement) => (
              <AgreementViewer
                key={agreement.id}
                agreement={agreement}
                data={data}
                onSaved={onSaved}
                onEdit={() => setEdit(agreement)}
              />
            ))
          ) : (
            <Empty
              title={t("Kelishuv hali yaratilmagan")}
              description={t(
                data.canMediate
                  ? "Tartib-taomil kelishuvini tayyorlang va taraflarga imzolash uchun oching."
                  : "Mediator kelishuv loyihasini tayyorlagach, bu yerda to‘liq hujjatni ko‘rib imzolaysiz.",
              )}
            />
          )}
        </div>
      </section>
      {edit && (
        <AgreementEditor
          key={typeof edit === "string" ? `new-${kind}` : edit.currentVersionId}
          data={data}
          agreement={edit === "NEW" ? undefined : edit}
          kind={edit === "NEW" ? kind : edit.kind}
          onSaved={() => {
            setEdit(null);
            onSaved();
          }}
          onClose={() => setEdit(null)}
        />
      )}
    </>
  );
}

function AgreementViewer({
  agreement,
  data,
  onSaved,
  onEdit,
}: {
  agreement: Agreement;
  data: CaseWorkspace;
  onSaved: () => void;
  onEdit: () => void;
}) {
  const { user } = useProfile();
  const { toast } = useUI();
  const { t } = useI18n();
  const [viewId, setViewId] = useState(agreement.currentVersionId);
  const [seen, setSeen] = useState<number[]>([]);
  const [approved, setApproved] = useState(false);
  const [receipt, setReceipt] = useState("");
  const [signing, setSigning] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setViewId(agreement.currentVersionId);
    setSeen([]);
    setApproved(false);
    setReceipt("");
    setSigning(false);
  }, [agreement.currentVersionId]);
  const version =
    agreement.versions.find((version) => version.id === viewId) ||
    agreement.versions.at(-1)!;
  const current = version.id === agreement.currentVersionId;
  const signer = version.participants.find(
    (participant) => participant.userId === user.id,
  );
  const mine = version.signatures.find(
    (signature) => signature.userId === user.id,
  );
  const nextRole = SIGNER_ROLES[version.signatures.length];
  const canSign =
    current &&
    !!signer &&
    !mine &&
    nextRole === signer.role &&
    !["SIGNED", "SUPERSEDED"].includes(version.status) &&
    hasMutualAppointment(data.case);
  const base = `/api/agreements/${agreement.id}/versions/${version.id}`;
  async function review() {
    setBusy(true);
    try {
      const result = await api<{ receipt: { id: string } }>(`${base}/review`, {
        method: "POST",
        body: JSON.stringify({
          contentHash: version.contentHash,
          pagesSeen: seen,
          voluntary: approved,
        }),
      });
      setReceipt(result.receipt.id);
      setSigning(true);
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  async function save(capture: SignatureCapture) {
    setBusy(true);
    try {
      await api(`${base}/sign`, {
        method: "POST",
        body: JSON.stringify({
          ...capture,
          contentHash: version.contentHash,
          reviewReceiptId: receipt,
          voluntary: approved,
          consentVersion: SIGNING_CONSENT_VERSION,
        }),
      });
      toast(t("Imzo hujjat ichiga joylashtirildi"));
      setSigning(false);
      setApproved(false);
      setReceipt("");
      onSaved();
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="agreement-viewer">
      <div className="agreement-title-row">
        <div>
          <span className="category-pill">
            <LocalizedText>
              {agreement.kind === "PROCEDURE"
                ? "Tartib-taomil kelishuvi"
                : "Mediativ kelishuv"}
            </LocalizedText>
          </span>
          <h3>{version.terms.subject}</h3>
          <small>
            {t("Nusxa")} {version.number} <LocalizedText>·</LocalizedText>{" "}
            {version.status === "SIGNED"
              ? t("Imzolangan va qulflangan")
              : version.status === "SUPERSEDED"
                ? t("Oldingi nusxa")
                : t("Imzolash jarayonida")}
          </small>
        </div>
        <div className="agreement-downloads">
          <Button variant="outline" size="sm" asChild>
            <a href={`${base}/file?download=1`}>
              <Download size={15} />
              <LocalizedText>PDF</LocalizedText>
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={`${base}/file?format=docx&download=1`}>
              <LocalizedText>DOCX</LocalizedText>
            </a>
          </Button>
          {data.canMediate && (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <LocalizedText>Yangi nusxa / joylashuv</LocalizedText>
            </Button>
          )}
        </div>
      </div>
      <div className="signature-status-grid">
        {version.participants.map((participant) => {
          const signature = version.signatures.find(
            (signature) => signature.role === participant.role,
          );
          return (
            <div key={participant.role} className={signature ? "signed" : ""}>
              <span>
                {signature ? (
                  <CheckCircle2 size={18} />
                ) : (
                  <Fingerprint size={18} />
                )}
                <LocalizedText>
                  {participant.role === "FIRST_PARTY"
                    ? "Birinchi taraf"
                    : participant.role === "SECOND_PARTY"
                      ? "Ikkinchi taraf"
                      : "Mediator"}
                </LocalizedText>
              </span>
              <strong>{participant.fullName}</strong>
              <small>
                {signature
                  ? `${fullDate(signature.signedAt)} · ${timeOf(signature.signedAt)}`
                  : t("Imzo kutilmoqda")}
              </small>
            </div>
          );
        })}
      </div>
      {agreement.versions.length > 1 && (
        <div className="version-history">
          <label>
            <LocalizedText>Hujjat nusxalari</LocalizedText>
            <select
              value={version.id}
              onChange={(event) => {
                setViewId(event.target.value);
                setSeen([]);
                setApproved(false);
                setSigning(false);
              }}
            >
              {agreement.versions.toReversed().map((version) => (
                <option key={version.id} value={version.id}>
                  {t("Nusxa")} {version.number}{" "}
                  <LocalizedText>· </LocalizedText>
                  {fullDate(version.createdAt)}{" "}
                  <LocalizedText>· </LocalizedText>
                  {version.signatures.length}
                  <LocalizedText>/3</LocalizedText>
                </option>
              ))}
            </select>
          </label>
          <details>
            <summary>
              <LocalizedText>Nusxalar orasidagi o‘zgarishlar</LocalizedText>
            </summary>
            {agreement.versions.slice(1).map((version, index) => (
              <div className="version-diff" key={version.id}>
                <h4>
                  {index + 1} <LocalizedText>→ </LocalizedText>
                  {version.number}
                </h4>
                <div>
                  <article>
                    <strong>
                      <LocalizedText>Oldingi shartlar</LocalizedText>
                    </strong>
                    <p>{agreement.versions[index].terms.agreedTerms}</p>
                    <p>
                      {money(agreement.versions[index].terms.totalAmount)}{" "}
                      <LocalizedText>UZS</LocalizedText>
                    </p>
                  </article>
                  <article>
                    <strong>
                      <LocalizedText>Yangi shartlar</LocalizedText>
                    </strong>
                    <p>{version.terms.agreedTerms}</p>
                    <p>
                      {money(version.terms.totalAmount)}{" "}
                      <LocalizedText>UZS</LocalizedText>
                    </p>
                  </article>
                </div>
                <p>
                  <LocalizedText>
                    Yangi nusxa uchun barcha imzolar qaytadan olinadi.
                  </LocalizedText>
                </p>
              </div>
            ))}
          </details>
        </div>
      )}
      <PdfPreview
        url={`${base}/file?hash=${version.pdfHash}`}
        versionKey={`${version.id}-${version.pdfHash}`}
        onPageSeen={(page) =>
          setSeen((current) =>
            current.includes(page) ? current : [...current, page],
          )
        }
      />
      <details className="document-integrity">
        <summary>
          <LocalizedText>Hujjat yaxlitligi va tekshiruv ro‘yxati</LocalizedText>
        </summary>
        <p>
          <LocalizedText>SHA-256 </LocalizedText>
          <code>{version.contentHash}</code>
        </p>
        <p>
          <LocalizedText>PDF </LocalizedText>
          <code>{version.pdfHash}</code>
        </p>
        {version.validation.map((item, index) => (
          <p key={index}>
            <LocalizedText>{item.message}</LocalizedText>
          </p>
        ))}
      </details>
      {canSign && (
        <div className="signing-action">
          <h4>
            {signer!.fullName} <LocalizedText>·</LocalizedText>{" "}
            <LocalizedText>
              {signer!.role === "MEDIATOR"
                ? "Mediator tasdig‘i"
                : "Sizning imzolash navbatingiz"}
            </LocalizedText>
          </h4>
          <p>
            <LocalizedText>
              Imzolashdan oldin barcha sahifalarni oching va hujjatning to‘liq
              mazmunini ko‘rib chiqing.
            </LocalizedText>{" "}
            {seen.length}
            <LocalizedText>/</LocalizedText>
            {version.pageCount}
          </p>
          <label className="consent-checkbox">
            <input
              type="checkbox"
              checked={approved}
              onChange={(event) => setApproved(event.target.checked)}
            />
            <span>
              <LocalizedText>
                Ushbu nusxani to‘liq o‘qidim, shartlarga ixtiyoriy roziman va
                o‘z qo‘lda chizilgan imzomni hujjatga qo‘yishni tasdiqlayman.
              </LocalizedText>
            </span>
          </label>
          {!signing ? (
            <Button
              disabled={busy || !approved || seen.length < version.pageCount}
              onClick={review}
            >
              <Fingerprint size={17} />
              <LocalizedText>Qo‘lda imzolash</LocalizedText>
            </Button>
          ) : (
            <SignatureCanvas
              key={version.id}
              disabled={busy}
              onSave={save}
              onCancel={() => setSigning(false)}
            />
          )}
        </div>
      )}
      {current && !canSign && version.status !== "SIGNED" && (
        <p className="info-note">
          <LocalizedText>
            {mine
              ? "Ushbu nusxadagi imzoingiz saqlangan. Navbatdagi ishtirokchi tasdig‘i kutilmoqda."
              : "Imzolash navbati birinchi taraf, ikkinchi taraf va mediator tartibida davom etadi."}
          </LocalizedText>
        </p>
      )}
    </article>
  );
}

function AgreementEditor({
  data,
  agreement,
  kind,
  onSaved,
  onClose,
}: {
  data: CaseWorkspace;
  agreement?: Agreement;
  kind: "PROCEDURE" | "SETTLEMENT";
  onSaved: () => void;
  onClose: () => void;
}) {
  const previous = agreement?.versions.find(
    (version) => version.id === agreement.currentVersionId,
  );
  const { toast } = useUI();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [boxes, setBoxes] = useState<SignatureBox[]>(previous?.boxes || []);
  const owner = data.case.userId;
  const respondent = data.case.mediation?.respondentId || "";
  const mutual = data.case.aiReview?.proposals.find((proposal) =>
    [owner, respondent].every((userId) =>
      data.case.proposalDecisions?.some(
        (decision) =>
          decision.reviewId === data.case.aiReview?.id &&
          decision.proposalId === proposal.id &&
          decision.userId === userId &&
          decision.decision === "ACCEPT",
      ),
    ),
  );
  const initial: AgreementTerms = previous?.terms || {
    subject: data.case.title,
    agreedTerms:
      kind === "PROCEDURE"
        ? "Taraflar ushbu nizoni tanlangan mediator ishtirokida ixtiyoriy mediatsiya tartib-taomili orqali muhokama qiladi. Jarayon tili o‘zbek tili, joyi va uchrashuvlar tartibi taraflar bilan kelishiladi. Mediator jarayon muddatini, maxfiylik va xizmat haqi shartlarini taraflar bilan aniqlashtiradi."
        : mutual?.description ||
          "Taraflar muhokama natijasida quyidagi majburiyat va bajarish shartlarini o‘zaro kelishib belgilaydi.",
    totalAmount:
      kind === "PROCEDURE" ? 0 : mutual?.amount || data.case.claimAmount,
    currency: "UZS",
    date: tashkentDate(),
    place: data.case.city || data.case.region,
    paymentSchedule:
      kind === "PROCEDURE" || data.case.claimAmount === 0
        ? []
        : (
            mutual?.schedule || [
              {
                amount: data.case.claimAmount,
                dueDate: tashkentDate(new Date(Date.now() + 30 * 86400000)),
              },
            ]
          ).map((payment) => ({
            id: crypto.randomUUID(),
            ...payment,
            payerId: respondent,
            payeeId: owner,
            description: "Kelishilgan to‘lov",
          })),
    obligations: [],
    responsibilities:
      "Taraflar majburiyatlarni kelishilgan muddatlarda bajaradi va bajarish holatini bir-biriga ma’lum qiladi.",
    conditions:
      "O‘zgartirishlar taraflar kelishuvi va tegishli rasmiylashtirish bilan amalga oshiriladi. Mediator qonun talablari va uchinchi shaxslar huquqlarini tekshiradi.",
    sourceIds: data.case.analysis.sources
      .map((source) => source.id)
      .slice(0, 4),
  };
  const [terms, setTerms] = useState<AgreementTerms>(structuredClone(initial));
  const [participantDetails, setParticipantDetails] = useState(
    data.participants.map((participant) => ({
      userId: participant.userId,
      address: participant.address,
      identityDetails: participant.identityDetails,
    })),
  );
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api(
        agreement
          ? `/api/agreements/${agreement.id}/versions`
          : `/api/cases/${data.case.id}/agreements`,
        {
          method: "POST",
          body: JSON.stringify({
            kind,
            terms,
            ...(boxes.length ? { boxes } : {}),
            expectedVersionId: agreement?.currentVersionId,
            participantDetails,
          }),
        },
      );
      toast(t("Kelishuv nusxasi yaratildi"));
      onSaved();
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      wide
      title={t(
        agreement
          ? "Kelishuvning yangi nusxasi"
          : "Kelishuv loyihasini tayyorlash",
      )}
      description={t(
        "Matn, muddatlar va majburiyatlarni tekshiring. Saqlash yangi hujjat nusxasini yaratadi.",
      )}
    >
      <form className="form-stack agreement-editor" onSubmit={save}>
        <fieldset className="agreement-party-details">
          <legend>
            <LocalizedText>Taraflar va rekvizitlar</LocalizedText>
          </legend>
          {participantDetails.map((details, index) => (
            <div key={details.userId}>
              <h3>
                {
                  data.participants.find(
                    (participant) => participant.userId === details.userId,
                  )?.fullName
                }
              </h3>
              <label>
                <LocalizedText>Manzil</LocalizedText>
                <input
                  required
                  minLength={3}
                  maxLength={1000}
                  value={details.address}
                  onChange={(event) =>
                    setParticipantDetails((current) =>
                      current.map((item, currentIndex) =>
                        currentIndex === index
                          ? { ...item, address: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
              </label>
              <label>
                <LocalizedText>Rekvizitlar va vakolat</LocalizedText>
                <textarea
                  required
                  minLength={3}
                  maxLength={1200}
                  rows={2}
                  value={details.identityDetails}
                  onChange={(event) =>
                    setParticipantDetails((current) =>
                      current.map((item, currentIndex) =>
                        currentIndex === index
                          ? { ...item, identityDetails: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
              </label>
            </div>
          ))}
        </fieldset>
        <div className="form-two-cols">
          <label>
            <LocalizedText>Jarayon tili</LocalizedText>
            <input
              required
              minLength={2}
              value={terms.language || "O‘zbek tili"}
              onChange={(event) =>
                setTerms({ ...terms, language: event.target.value })
              }
            />
          </label>
          <label>
            <LocalizedText>Kelishilgan muddat, kun</LocalizedText>
            <input
              type="number"
              required
              min={1}
              max={60}
              value={terms.durationDays || 30}
              onChange={(event) =>
                setTerms({ ...terms, durationDays: Number(event.target.value) })
              }
            />
          </label>
        </div>
        <label>
          <LocalizedText>Xizmat haqi va xarajatlar</LocalizedText>
          <textarea
            required
            minLength={10}
            maxLength={2000}
            rows={3}
            value={
              terms.feeTerms ||
              "Mediator haqi, taraflar ulushi va xarajatlar yozma kelishiladi."
            }
            onChange={(event) =>
              setTerms({ ...terms, feeTerms: event.target.value })
            }
          />
        </label>
        <label>
          <LocalizedText>Nizo predmeti</LocalizedText>
          <input
            required
            minLength={4}
            maxLength={2000}
            value={terms.subject}
            onChange={(event) =>
              setTerms({ ...terms, subject: event.target.value })
            }
          />
        </label>
        <label>
          <LocalizedText>Kelishilgan shartlar</LocalizedText>
          <textarea
            required
            minLength={20}
            maxLength={12000}
            rows={6}
            value={terms.agreedTerms}
            onChange={(event) =>
              setTerms({ ...terms, agreedTerms: event.target.value })
            }
          />
        </label>
        <div className="form-two-cols">
          <label>
            <LocalizedText>Joy</LocalizedText>
            <input
              required
              minLength={2}
              value={terms.place}
              onChange={(event) =>
                setTerms({ ...terms, place: event.target.value })
              }
            />
          </label>
          <label>
            <LocalizedText>Sana</LocalizedText>
            <input
              required
              type="date"
              value={terms.date}
              onChange={(event) =>
                setTerms({ ...terms, date: event.target.value })
              }
            />
          </label>
        </div>
        {kind === "SETTLEMENT" && (
          <>
            <label>
              <LocalizedText>Jami kelishuv summasi</LocalizedText>
              <input
                required
                type="number"
                min={0}
                max={1e12}
                step={1}
                value={terms.totalAmount}
                onChange={(event) =>
                  setTerms({
                    ...terms,
                    totalAmount: Number(event.target.value),
                  })
                }
              />
            </label>
            <div className="editor-schedule">
              <h3>
                <LocalizedText>To‘lov jadvali</LocalizedText>
              </h3>
              {terms.paymentSchedule.map((payment, index) => (
                <div className="editor-payment-row" key={payment.id}>
                  <label>
                    <LocalizedText>Summa</LocalizedText>
                    <input
                      type="number"
                      required
                      min={1}
                      value={payment.amount}
                      onChange={(event) =>
                        setTerms({
                          ...terms,
                          paymentSchedule: terms.paymentSchedule.map(
                            (item, current) =>
                              current === index
                                ? {
                                    ...item,
                                    amount: Number(event.target.value),
                                  }
                                : item,
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    <LocalizedText>Muddat</LocalizedText>
                    <input
                      type="date"
                      required
                      value={payment.dueDate}
                      onChange={(event) =>
                        setTerms({
                          ...terms,
                          paymentSchedule: terms.paymentSchedule.map(
                            (item, current) =>
                              current === index
                                ? { ...item, dueDate: event.target.value }
                                : item,
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    <LocalizedText>To‘lovchi</LocalizedText>
                    <select
                      value={payment.payerId}
                      onChange={(event) =>
                        setTerms({
                          ...terms,
                          paymentSchedule: terms.paymentSchedule.map(
                            (item, current) =>
                              current === index
                                ? {
                                    ...item,
                                    payerId: event.target.value,
                                    payeeId:
                                      event.target.value === owner
                                        ? respondent
                                        : owner,
                                  }
                                : item,
                          ),
                        })
                      }
                    >
                      {data.participants
                        .filter(
                          (participant) => participant.role !== "MEDIATOR",
                        )
                        .map((participant) => (
                          <option
                            key={participant.userId}
                            value={participant.userId}
                          >
                            {participant.fullName}
                          </option>
                        ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={t("To‘lovni olib tashlash")}
                    onClick={() =>
                      setTerms({
                        ...terms,
                        paymentSchedule: terms.paymentSchedule.filter(
                          (_, current) => current !== index,
                        ),
                      })
                    }
                  >
                    <X size={18} />
                  </button>
                </div>
              ))}
              <Button
                variant="outline"
                type="button"
                onClick={() =>
                  setTerms({
                    ...terms,
                    paymentSchedule: [
                      ...terms.paymentSchedule,
                      {
                        id: crypto.randomUUID(),
                        amount: Math.max(
                          1,
                          terms.totalAmount -
                            terms.paymentSchedule.reduce(
                              (sum, payment) => sum + payment.amount,
                              0,
                            ),
                        ),
                        dueDate: tashkentDate(
                          new Date(Date.now() + 30 * 86400000),
                        ),
                        payerId: respondent,
                        payeeId: owner,
                        description: "Kelishilgan to‘lov",
                      },
                    ],
                  })
                }
              >
                <Plus size={15} />
                <LocalizedText>To‘lov qo‘shish</LocalizedText>
              </Button>
            </div>
            <div className="editor-obligations">
              <h3>
                <LocalizedText>Boshqa majburiyatlar</LocalizedText>
              </h3>
              {terms.obligations.map((obligation, index) => (
                <div className="editor-obligation-row" key={obligation.id}>
                  <label>
                    <LocalizedText>Majburiyat</LocalizedText>
                    <input
                      required
                      minLength={3}
                      value={obligation.title}
                      onChange={(event) =>
                        setTerms({
                          ...terms,
                          obligations: terms.obligations.map((item, current) =>
                            current === index
                              ? { ...item, title: event.target.value }
                              : item,
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    <LocalizedText>Muddat</LocalizedText>
                    <input
                      required
                      type="date"
                      value={obligation.dueDate}
                      onChange={(event) =>
                        setTerms({
                          ...terms,
                          obligations: terms.obligations.map((item, current) =>
                            current === index
                              ? { ...item, dueDate: event.target.value }
                              : item,
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    <LocalizedText>Mas’ul taraf</LocalizedText>
                    <select
                      value={obligation.assigneeId}
                      onChange={(event) =>
                        setTerms({
                          ...terms,
                          obligations: terms.obligations.map((item, current) =>
                            current === index
                              ? {
                                  ...item,
                                  assigneeId: event.target.value,
                                  beneficiaryId:
                                    event.target.value === owner
                                      ? respondent
                                      : owner,
                                }
                              : item,
                          ),
                        })
                      }
                    >
                      {data.participants
                        .filter(
                          (participant) => participant.role !== "MEDIATOR",
                        )
                        .map((participant) => (
                          <option
                            key={participant.userId}
                            value={participant.userId}
                          >
                            {participant.fullName}
                          </option>
                        ))}
                    </select>
                  </label>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={t("Majburiyatni olib tashlash")}
                    onClick={() =>
                      setTerms({
                        ...terms,
                        obligations: terms.obligations.filter(
                          (_, current) => current !== index,
                        ),
                      })
                    }
                  >
                    <X size={18} />
                  </button>
                </div>
              ))}
              <Button
                variant="outline"
                type="button"
                onClick={() =>
                  setTerms({
                    ...terms,
                    obligations: [
                      ...terms.obligations,
                      {
                        id: crypto.randomUUID(),
                        title: "",
                        dueDate: tashkentDate(
                          new Date(Date.now() + 30 * 86400000),
                        ),
                        assigneeId: respondent,
                        beneficiaryId: owner,
                      },
                    ],
                  })
                }
              >
                <Plus size={15} />
                <LocalizedText>Majburiyat qo‘shish</LocalizedText>
              </Button>
            </div>
          </>
        )}
        <label>
          <LocalizedText>Mas’uliyat</LocalizedText>
          <textarea
            required
            minLength={3}
            rows={3}
            value={terms.responsibilities}
            onChange={(event) =>
              setTerms({ ...terms, responsibilities: event.target.value })
            }
          />
        </label>
        <label>
          <LocalizedText>Qo‘shimcha shartlar</LocalizedText>
          <textarea
            required
            minLength={3}
            rows={3}
            value={terms.conditions}
            onChange={(event) =>
              setTerms({ ...terms, conditions: event.target.value })
            }
          />
        </label>
        {previous && (
          <>
            <PdfPreview
              url={`/api/agreements/${agreement!.id}/versions/${previous.id}/file`}
              boxes={boxes}
              editable
              onBoxesChange={setBoxes}
            />
            <SignatureLayoutEditor
              boxes={boxes}
              pageCount={previous.pageCount}
              onChange={setBoxes}
            />
          </>
        )}
        <p className="info-note">
          <LocalizedText>
            Hujjat loyihasining shaxs, vakolat, majburiyat va qonun talablariga
            mosligini mediator tekshiradi. Yangi nusxada imzolar qaytadan
            olinadi.
          </LocalizedText>
        </p>
        <Button disabled={busy} type="submit">
          <FileCheck2 size={17} />
          <LocalizedText>
            {busy
              ? "PDF va DOCX tayyorlanmoqda..."
              : "Nusxani yaratish va imzolashga ochish"}
          </LocalizedText>
        </Button>
      </form>
    </Dialog>
  );
}

function ExecutionWorkspace({
  data,
  onSaved,
}: {
  data: CaseWorkspace;
  onSaved: () => void;
}) {
  const { user } = useProfile();
  const { t } = useI18n();
  const { toast } = useUI();
  const [reportFor, setReportFor] = useState("");
  const [reportVersion, setReportVersion] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [followup, setFollowup] = useState<"RENEGOTIATE" | "COURT_INFORMATION">(
    "RENEGOTIATE",
  );
  const [note, setNote] = useState("");
  const [requestId, setRequestId] = useState("");
  const execution = data.execution;
  if (!execution)
    return (
      <div className="panel">
        <Empty
          title={t("Ijro rejasi kelishuvdan so‘ng ochiladi")}
          description={t(
            "Yakuniy mediativ kelishuv uch ishtirokchi tomonidan imzolangach, majburiyat va to‘lovlar shu yerda kuzatiladi.",
          )}
        />
      </div>
    );
  const summary = executionSummary(execution);
  async function post(action: string, body: unknown) {
    setBusy(true);
    try {
      const result = await api<{ message?: string }>(
        `/api/cases/${data.case.id}/execution/${action}`,
        { method: "POST", body: JSON.stringify(body) },
      );
      toast(result.message || t("Ijro holati saqlandi"));
      onSaved();
      setReportFor("");
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="execution-stats">
        {[
          { title: "Kelishilgan summa", value: `${money(summary.total)} UZS` },
          { title: "Tasdiqlangan to‘lov", value: `${money(summary.paid)} UZS` },
          { title: "Qoldiq", value: `${money(summary.remaining)} UZS` },
          { title: "Keyingi muddat", value: summary.nextDate || "—" },
        ].map((item) => (
          <article className="panel" key={item.title}>
            <span>
              <LocalizedText>{item.title}</LocalizedText>
            </span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </div>
      <section className="panel workbench-panel">
        <div className="section-heading">
          <div>
            <h2>
              <CheckCircle2 size={22} />
              <LocalizedText>Majburiyatlar ijrosi</LocalizedText>
            </h2>
            <p>
              <LocalizedText>
                To‘lovchi hisobot beradi, oluvchi bajarilganini tasdiqlaydi.
              </LocalizedText>
            </p>
          </div>
          <strong>
            {summary.progress}
            <LocalizedText>%</LocalizedText>
          </strong>
        </div>
        <div className="panel-body">
          <progress
            className="execution-progress"
            value={summary.progress}
            max={100}
          />
          {execution.obligations.map((obligation) => {
            const overdue =
              obligation.status !== "COMPLETED" &&
              obligation.dueDate < tashkentDate();
            return (
              <article
                className={`execution-obligation ${overdue ? "overdue" : ""}`}
                key={obligation.id}
              >
                <div>
                  <span className="category-pill">
                    <LocalizedText>
                      {obligation.status === "COMPLETED"
                        ? "Bajarilgan"
                        : overdue
                          ? "Muddati o‘tgan"
                          : obligation.status === "REPORTED"
                            ? "Tasdiq kutilmoqda"
                            : "Kutilmoqda"}
                    </LocalizedText>
                  </span>
                  <h3>{obligation.title}</h3>
                  <p>
                    {
                      data.participants.find(
                        (participant) =>
                          participant.userId === obligation.assigneeId,
                      )?.fullName
                    }{" "}
                    <LocalizedText>→</LocalizedText>{" "}
                    {
                      data.participants.find(
                        (participant) =>
                          participant.userId === obligation.beneficiaryId,
                      )?.fullName
                    }
                  </p>
                  <small>
                    {obligation.dueDate}
                    {obligation.type === "PAYMENT"
                      ? ` · ${money(obligation.amount)} UZS · ${t("Tasdiqlangan")} ${money(obligationPaid(execution, obligation.id))}`
                      : ""}
                  </small>
                </div>
                {obligation.assigneeId === user.id &&
                  obligation.status !== "COMPLETED" && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => {
                        setReportFor(obligation.id);
                        setReportVersion(execution.versionId);
                        setAmount(
                          String(
                            Math.max(
                              0,
                              obligation.amount -
                                obligationPaid(execution, obligation.id),
                            ),
                          ),
                        );
                        setRequestId(crypto.randomUUID());
                        setReference("");
                      }}
                    >
                      <LocalizedText>Bajarganimni bildirish</LocalizedText>
                    </Button>
                  )}
              </article>
            );
          })}
          <h3>
            <LocalizedText>To‘lov va bajarish tarixi</LocalizedText>
          </h3>
          {execution.reports.length ? (
            execution.reports.toReversed().map((report) => {
              const obligation = execution.obligations.find(
                (obligation) => obligation.id === report.obligationId,
              )!;
              return (
                <article className="execution-report" key={report.id}>
                  <div>
                    <strong>{report.reference}</strong>
                    <p>
                      {report.amount ? `${money(report.amount)} UZS · ` : ""}
                      {fullDate(report.reportedAt)}{" "}
                      <LocalizedText>·</LocalizedText>{" "}
                      <LocalizedText>
                        {report.status === "CONFIRMED"
                          ? "Qabul qiluvchi tasdiqlagan"
                          : report.status === "REJECTED"
                            ? "Qabul qiluvchi qaytargan"
                            : "Qabul qiluvchi tekshirmoqda"}
                      </LocalizedText>
                    </p>
                  </div>
                  {report.status === "PENDING" &&
                    obligation.beneficiaryId === user.id && (
                      <div className="table-actions">
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            post("review", {
                              reportId: report.id,
                              accept: true,
                            })
                          }
                        >
                          <LocalizedText>Tasdiqlash</LocalizedText>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            post("review", {
                              reportId: report.id,
                              accept: false,
                            })
                          }
                        >
                          <LocalizedText>Qaytarish</LocalizedText>
                        </Button>
                      </div>
                    )}
                </article>
              );
            })
          ) : (
            <p>
              <LocalizedText>
                Bajarish hisoboti hali yuborilmagan.
              </LocalizedText>
            </p>
          )}
        </div>
      </section>
      {!!data.case.executionHistory?.length && (
        <details className="panel execution-history">
          <summary>
            <LocalizedText>Oldingi nusxalar bo‘yicha ijro tarixi</LocalizedText>
          </summary>
          {data.case.executionHistory.toReversed().map((previous) => {
            const totals = executionSummary(previous);
            const version = data.agreements
              .flatMap((item) => item.versions)
              .find((item) => item.id === previous.versionId);
            return (
              <article key={previous.versionId}>
                <strong>
                  <LocalizedText>Nusxa</LocalizedText>{" "}
                  {version?.number || previous.versionId.slice(0, 8)}
                </strong>
                <p>
                  <LocalizedText>Tasdiqlangan to‘lov</LocalizedText>{" "}
                  {money(totals.paid)} UZS ·{" "}
                  <LocalizedText>Qoldiq</LocalizedText>{" "}
                  {money(totals.remaining)} UZS
                </p>
                {previous.reports.map((report) => (
                  <p key={report.id}>
                    {report.reference} · {money(report.amount)} UZS ·{" "}
                    {fullDate(report.reportedAt)}
                  </p>
                ))}
              </article>
            );
          })}
        </details>
      )}
      {isParty(data.case, user.id) && (
        <section className="panel workbench-panel">
          <div className="section-heading">
            <h2>
              <LocalizedText>Kelishuv bajarilmasa keyingi qadam</LocalizedText>
            </h2>
          </div>
          <form
            className="form-stack panel-body"
            onSubmit={(event) => {
              event.preventDefault();
              void post("followup", { path: followup, note });
            }}
          >
            <label>
              <LocalizedText>Yo‘lni tanlang</LocalizedText>
              <select
                value={followup}
                onChange={(event) =>
                  setFollowup(event.target.value as typeof followup)
                }
              >
                <option value="RENEGOTIATE">
                  {t("Mediator bilan qayta kelishish")}
                </option>
                <option value="COURT_INFORMATION">
                  {t("Sud orqali ijro tartibini ko‘rib chiqish")}
                </option>
              </select>
            </label>
            <label>
              <LocalizedText>Murojaat mazmuni</LocalizedText>
              <textarea
                required
                minLength={10}
                maxLength={3000}
                rows={3}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
            <p>
              <LocalizedText>
                Tegishli sud, hujjatlar va murojaat tartibi mutaxassis bilan
                tekshiriladi.
              </LocalizedText>{" "}
              <a
                href="https://lex.uz/docs/-3805227#-7791556"
                target="_blank"
                rel="noreferrer"
              >
                <LocalizedText>Lex.uz · 29¹</LocalizedText>
              </a>
            </p>
            <Button disabled={busy} type="submit">
              <LocalizedText>Murojaatni qayd etish</LocalizedText>
            </Button>
          </form>
        </section>
      )}
      <Dialog
        open={!!reportFor}
        onOpenChange={(open) => {
          if (!open) setReportFor("");
        }}
        title={t("Bajarish hisoboti")}
        description={t("Hisobotni qabul qiluvchi taraf tekshiradi.")}
      >
        <form
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault();
            void post("report", {
              versionId: reportVersion,
              obligationId: reportFor,
              requestId,
              amount: Number(amount),
              reference,
            });
          }}
        >
          {execution.obligations.find(
            (obligation) => obligation.id === reportFor,
          )?.type === "PAYMENT" && (
            <label>
              <LocalizedText>To‘langan summa</LocalizedText>
              <input
                required
                type="number"
                min={1}
                max={1e12}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </label>
          )}
          <label>
            <LocalizedText>Kvitansiya raqami yoki bajarish izohi</LocalizedText>
            <input
              required
              minLength={3}
              maxLength={300}
              value={reference}
              onChange={(event) => setReference(event.target.value)}
            />
          </label>
          <Button disabled={busy} type="submit">
            <LocalizedText>Hisobotni yuborish</LocalizedText>
          </Button>
        </form>
      </Dialog>
    </>
  );
}

function RoomWorkspace({
  data,
  mediator,
  sessions,
  onSaved,
}: {
  data: CaseWorkspace;
  mediator: Mediator | null;
  sessions: MediationSession[];
  onSaved: () => void;
}) {
  const { user } = useProfile();
  const { t } = useI18n();
  const { toast } = useUI();
  const [text, setText] = useState("");
  const [visibility, setVisibility] = useState("PARTIES");
  const [recipient, setRecipient] = useState(data.case.userId);
  const [busy, setBusy] = useState(false);
  const [booking, setBooking] = useState(false);
  const messageRequest = useRef("");
  async function send(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api(`/api/cases/${data.case.id}/messages`, {
        method: "POST",
        body: JSON.stringify({
          body: text,
          requestId: (messageRequest.current ||= crypto.randomUUID()),
          visibility,
          recipientId: recipient,
        }),
      });
      setText("");
      messageRequest.current = "";
      onSaved();
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="room-grid">
      <section className="panel workbench-panel">
        <div className="section-heading">
          <div>
            <h2>
              <MessageCircle size={22} />
              <LocalizedText>Mediatsiya xonasi</LocalizedText>
            </h2>
            <p>
              <LocalizedText>
                Umumiy yoki mediator bilan maxfiy suhbatni tanlang.
              </LocalizedText>
            </p>
          </div>
        </div>
        <div className="room-message-list">
          {data.messages.length ? (
            data.messages.map((message) => (
              <article
                className={`room-message ${message.senderId === user.id ? "mine" : ""}`}
                key={message.id}
              >
                <div>
                  <strong>
                    {data.participants.find(
                      (participant) => participant.userId === message.senderId,
                    )?.fullName ||
                      (message.senderId === "system-ai"
                        ? t("Kelishuv AI")
                        : t("Ishtirokchi"))}
                  </strong>
                  <span>
                    {timeOf(message.createdAt)}
                    {message.visibility === "PRIVATE"
                      ? ` · ${t("Maxfiy")}`
                      : ""}
                  </span>
                </div>
                <p>{message.body}</p>
              </article>
            ))
          ) : (
            <p>
              <LocalizedText>
                Muloqotni boshlang. Har bir xabar tanlangan auditoriyaga
                ko‘rinadi.
              </LocalizedText>
            </p>
          )}
        </div>
        <form className="form-stack panel-body" onSubmit={send}>
          <div className="form-two-cols">
            <label>
              <LocalizedText>Xabar auditoriyasi</LocalizedText>
              <select
                value={visibility}
                disabled={busy}
                onChange={(event) => {
                  setVisibility(event.target.value);
                  messageRequest.current = "";
                }}
              >
                <option value="PARTIES">{t("Ikkala taraf va mediator")}</option>
                <option value="PRIVATE">{t("Mediator bilan maxfiy")}</option>
              </select>
            </label>
            {visibility === "PRIVATE" && data.canMediate && (
              <label>
                <LocalizedText>Qabul qiluvchi</LocalizedText>
                <select
                  value={recipient}
                  disabled={busy}
                  onChange={(event) => {
                    setRecipient(event.target.value);
                    messageRequest.current = "";
                  }}
                >
                  {data.participants
                    .filter((participant) => participant.role !== "MEDIATOR")
                    .map((participant) => (
                      <option
                        key={participant.userId}
                        value={participant.userId}
                      >
                        {participant.fullName}
                      </option>
                    ))}
                </select>
              </label>
            )}
          </div>
          <label>
            <LocalizedText>Xabar</LocalizedText>
            <textarea
              required
              maxLength={5000}
              rows={4}
              value={text}
              disabled={busy}
              onChange={(event) => {
                setText(event.target.value);
                messageRequest.current = "";
              }}
            />
          </label>
          <Button disabled={busy || user.role === "ADMIN"} type="submit">
            <Send size={16} />
            <LocalizedText>Yuborish</LocalizedText>
          </Button>
        </form>
      </section>
      <aside>
        <section className="panel workbench-panel">
          <div className="section-heading">
            <h2>
              <CalendarDays size={21} />
              <LocalizedText>Uchrashuvlar</LocalizedText>
            </h2>
          </div>
          <div className="panel-body form-stack">
            {mediator && (
              <p>
                <strong>{mediator.name}</strong>
              </p>
            )}
            {sessions.map((session) => (
              <div key={session.id}>
                <strong>
                  {fullDate(session.scheduledAt)}{" "}
                  <LocalizedText>·</LocalizedText> {timeOf(session.scheduledAt)}
                </strong>
                <p>
                  <LocalizedText>
                    {session.status === "SCHEDULED"
                      ? "Rejada"
                      : session.status === "COMPLETED"
                        ? "Yakunlangan"
                        : "Bekor qilingan"}
                  </LocalizedText>
                </p>
                <a href={`/api/sessions/${session.id}/calendar`}>
                  <LocalizedText>Kalenderga yuklash</LocalizedText>
                </a>
              </div>
            ))}
            <Button
              variant="outline"
              disabled={
                !mediator ||
                !data.case.mediation?.procedureDocumentId ||
                !hasMutualAppointment(data.case) ||
                data.case.status === "RESOLVED"
              }
              onClick={() => setBooking(true)}
            >
              <LocalizedText>Sessiya belgilash</LocalizedText>
            </Button>
            <Link href={`/dashboard/cases/${data.case.id}`}>
              <LocalizedText>Uchrashuv havolasi va tafsilotlari</LocalizedText>
            </Link>
          </div>
        </section>
        <div className="info-note">
          <LockKeyhole size={18} />
          <p>
            <LocalizedText>
              Maxfiy xabarlar tanlangan taraf va vakolatli mediatorga ko‘rinadi.
            </LocalizedText>
          </p>
        </div>
      </aside>
      {booking && mediator && (
        <BookingDialog
          open
          onOpenChange={setBooking}
          mediator={mediator}
          caseId={data.case.id}
        />
      )}
    </div>
  );
}

export function NotificationsPage() {
  const data = useData<{ notifications: Notification[] }>("/api/notifications");
  const { t } = useI18n();
  const { toast, refresh } = useUI();
  return (
    <>
      <PageHeading
        title={t("Bildirishnomalar")}
        description={t(
          "Takliflar, imzolash navbati va yaqinlashayotgan majburiyatlar.",
        )}
      >
        <Button
          variant="outline"
          onClick={async () => {
            try {
              await api("/api/notifications", { method: "PUT" });
              refresh();
            } catch (error) {
              toast((error as Error).message, "error");
            }
          }}
        >
          <Check size={16} />
          <LocalizedText>Barchasini o‘qilgan qilish</LocalizedText>
        </Button>
      </PageHeading>
      <section className="panel notifications-page">
        {data.loading && !data.data ? (
          <Loading />
        ) : data.error ? (
          <ErrorState message={data.error} retry={data.reload} />
        ) : data.data?.notifications.length ? (
          data.data.notifications.map((notification) => (
            <Link
              href={notification.href}
              key={notification.id}
              className={`notification-page-item ${notification.read ? "" : "unread"}`}
            >
              <Bell size={21} />
              <div>
                <h3>{notification.title}</h3>
                <p>{notification.body}</p>
                <small>
                  {fullDate(notification.createdAt)}{" "}
                  <LocalizedText>·</LocalizedText>{" "}
                  {timeOf(notification.createdAt)}
                </small>
              </div>
              <ArrowRight size={17} />
            </Link>
          ))
        ) : (
          <Empty
            title={t("Yangi bildirishnoma yo‘q")}
            description={t("Jarayondagi yangiliklar shu yerda ko‘rinadi.")}
          />
        )}
      </section>
    </>
  );
}

export function DataRequestForm() {
  const { t } = useI18n();
  const { toast } = useUI();
  const [category, setCategory] = useState("DATA_REQUEST");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section className="panel workbench-panel">
      <div className="section-heading">
        <h2>
          <LockKeyhole size={20} />
          <LocalizedText>Ma’lumotlar va yordam bo‘yicha murojaat</LocalizedText>
        </h2>
      </div>
      <form
        className="form-stack panel-body"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          try {
            await api("/api/complaints", {
              method: "POST",
              body: JSON.stringify({ category, description }),
            });
            setDescription("");
            toast(t("Murojaatingiz administratorga yuborildi"));
          } catch (error) {
            toast((error as Error).message, "error");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          <LocalizedText>Murojaat turi</LocalizedText>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="DATA_REQUEST">
              {t("Ma’lumotni eksport qilish yoki o‘chirish so‘rovi")}
            </option>
            <option value="CONFIDENTIALITY">{t("Maxfiylik masalasi")}</option>
            <option value="MEDIATOR">{t("Mediator bo‘yicha murojaat")}</option>
            <option value="SUPPORT">{t("Texnik yordam")}</option>
          </select>
        </label>
        <label>
          <LocalizedText>Murojaat mazmuni</LocalizedText>
          <textarea
            rows={4}
            required
            minLength={10}
            maxLength={4000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <p>
          <LocalizedText>
            Ma’lumotlaringiz hisob va ish hujjatlari doirasida shifrlangan holda
            saqlanadi. Saqlash muddati, eksport va o‘chirish bo‘yicha so‘rov
            administrator tomonidan hujjatlarga tegishli majburiyatlar bilan
            birga ko‘rib chiqiladi.
          </LocalizedText>
        </p>
        <Button type="submit" disabled={busy}>
          <Send size={16} />
          <LocalizedText>Murojaatni yuborish</LocalizedText>
        </Button>
      </form>
    </section>
  );
}

export function IntegrationAdminPage() {
  const { user } = useProfile();
  const { t } = useI18n();
  const { toast } = useUI();
  const integrations = useData<{
    ai: CaseWorkspace["aiStatus"];
    adapters: {
      id: string;
      title: string;
      status: string;
      detail: string;
      url?: string;
    }[];
  }>("/api/integrations");
  const admin = useData<{
    auditValid: boolean;
    audit: {
      id: string;
      action: string;
      at: string;
      actorId: string;
      caseId?: string;
      hash: string;
    }[];
    complaints: {
      id: string;
      category: string;
      description: string;
      status: string;
      createdAt: string;
      reviewNote?: string;
    }[];
    sources: {
      id: string;
      title: string;
      article: string;
      url: string;
      editionDate?: string;
      verifiedAt: string;
    }[];
    templates: { id: string; name: string; source: string; status: string }[];
  }>(user.role === "ADMIN" ? "/api/admin/kelishuv" : null);
  const [reviewId, setReviewId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <>
      <PageHeading
        title={t("Integratsiyalar va audit")}
        description={t(
          "Har bir xizmatning amaldagi ulanishi va tekshiruv holati.",
        )}
      />
      {integrations.loading && !integrations.data ? (
        <Loading />
      ) : integrations.error ? (
        <ErrorState message={integrations.error} retry={integrations.reload} />
      ) : (
        <div className="integration-card-grid">
          {integrations.data?.adapters.map((adapter) => (
            <article className="panel integration-status-card" key={adapter.id}>
              <div>
                <ShieldCheck size={20} />
                <span className="category-pill">{adapter.status}</span>
              </div>
              <h2>{adapter.title}</h2>
              <p>
                <LocalizedText>{adapter.detail}</LocalizedText>
              </p>
              {adapter.url && (
                <a href={adapter.url} target="_blank" rel="noreferrer">
                  <LocalizedText>Rasmiy manba</LocalizedText>
                </a>
              )}
            </article>
          ))}
        </div>
      )}
      {user.role === "ADMIN" && admin.data && (
        <>
          <section className="panel workbench-panel">
            <div className="section-heading">
              <h2>
                <LocalizedText>Audit jurnali</LocalizedText>
              </h2>
              <span className="category-pill">
                <LocalizedText>
                  {admin.data.auditValid
                    ? "Xesh zanjiri tekshirildi"
                    : "Tekshiruv talab qilinadi"}
                </LocalizedText>
              </span>
            </div>
            <div className="table-scroll">
              <table className="standard-table">
                <thead>
                  <tr>
                    <th>
                      <LocalizedText>Amal</LocalizedText>
                    </th>
                    <th>
                      <LocalizedText>Vaqt</LocalizedText>
                    </th>
                    <th>
                      <LocalizedText>Hisob</LocalizedText>
                    </th>
                    <th>
                      <LocalizedText>Yaxlitlik</LocalizedText>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {admin.data.audit.map((event) => (
                    <tr key={event.id}>
                      <td>{event.action}</td>
                      <td>
                        {fullDate(event.at)} <LocalizedText>· </LocalizedText>
                        {timeOf(event.at)}
                      </td>
                      <td>{event.actorId}</td>
                      <td>
                        <code>
                          {event.hash.slice(0, 16)}
                          <LocalizedText>…</LocalizedText>
                        </code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="panel workbench-panel">
            <div className="section-heading">
              <h2>
                <LocalizedText>Shikoyat va ma’lumot so‘rovlari</LocalizedText>
              </h2>
            </div>
            <div className="panel-body">
              {admin.data.complaints.length ? (
                admin.data.complaints.map((complaint) => (
                  <article className="complaint-item" key={complaint.id}>
                    <strong>
                      {complaint.category} <LocalizedText>· </LocalizedText>
                      {complaint.status}
                    </strong>
                    <p>{complaint.description}</p>
                    {complaint.reviewNote && <p>{complaint.reviewNote}</p>}
                    {complaint.status === "OPEN" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setReviewId(complaint.id)}
                      >
                        <LocalizedText>Ko‘rib chiqish</LocalizedText>
                      </Button>
                    )}
                  </article>
                ))
              ) : (
                <p>
                  <LocalizedText>Yangi murojaatlar yo‘q.</LocalizedText>
                </p>
              )}
            </div>
          </section>
          <section className="panel workbench-panel">
            <div className="section-heading">
              <h2>
                <LocalizedText>Hujjat shablonlari va manbalar</LocalizedText>
              </h2>
            </div>
            <div className="panel-body">
              {admin.data.templates.map((template) => (
                <p key={template.id}>
                  {template.name} <LocalizedText>· </LocalizedText>
                  <LocalizedText>Mediator tekshiruvi bilan</LocalizedText>{" "}
                  <LocalizedText>·</LocalizedText>{" "}
                  <a href={template.source} target="_blank" rel="noreferrer">
                    <LocalizedText>Lex.uz</LocalizedText>
                  </a>
                </p>
              ))}
              <details>
                <summary>
                  <LocalizedText>Huquqiy katalog tahrirlari</LocalizedText>
                </summary>
                {admin.data.sources.map((source) => (
                  <p key={source.id}>
                    <a href={source.url} target="_blank" rel="noreferrer">
                      {source.title} <LocalizedText>· </LocalizedText>
                      {source.article}
                    </a>{" "}
                    <LocalizedText>· </LocalizedText>
                    {source.editionDate || source.verifiedAt}
                  </p>
                ))}
              </details>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    const result = await api<{ created: number }>(
                      "/api/admin/reminders",
                      { method: "POST" },
                    );
                    toast(`${t("Yaratilgan eslatmalar")} ${result.created}`);
                  } catch (error) {
                    toast((error as Error).message, "error");
                  }
                }}
              >
                <RefreshCw size={16} />
                <LocalizedText>Eslatmalarni tekshirish</LocalizedText>
              </Button>
            </div>
          </section>
        </>
      )}
      <Dialog
        open={!!reviewId}
        onOpenChange={(open) => {
          if (!open) setReviewId("");
        }}
        title={t("Murojaatni ko‘rib chiqish")}
      >
        <form
          className="form-stack"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            try {
              await api(`/api/admin/complaints/${reviewId}`, {
                method: "PUT",
                body: JSON.stringify({ reviewNote: note }),
              });
              setReviewId("");
              setNote("");
              admin.reload();
              toast(t("Ko‘rib chiqish qaydi saqlandi"));
            } catch (error) {
              toast((error as Error).message, "error");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            <LocalizedText>Javob va bajarilgan ish</LocalizedText>
            <textarea
              required
              minLength={10}
              rows={4}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          <Button disabled={busy} type="submit">
            <LocalizedText>Qaydni saqlash</LocalizedText>
          </Button>
        </form>
      </Dialog>
    </>
  );
}
