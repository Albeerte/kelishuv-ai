"use client";
import { T as LocalizedText, translate as localizeText } from "@/lib/i18n";
import Link from "next/link";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  FileCheck2,
  FileText,
  FolderOpen,
  Handshake,
  Landmark,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  Video,
} from "lucide-react";
import { Button } from "../ui/button";
import { CaseClosureControls } from "../case-closure";

import {
  Empty,
  ErrorState,
  Loading,
  PageHeading,
  StatusBadge,
} from "../shared";
import { useData } from "@/lib/use-data";
import { useUI } from "@/lib/client-store";
import { api, fullDate, money, timeOf } from "@/lib/utils";
import {
  STATUS_LABELS,
  TYPE_LABELS,
  type CaseRecord,
  type MediationSession,
  type Mediator,
  type SolutionType,
} from "@/lib/types";
import { useProfile } from "../application";
import { BookingDialog } from "./mediators";
import { CaseMediationPanel, LegalGuide } from "./mediation";
import { hasMutualAppointment } from "@/lib/mediation";
import type { CaseDocument } from "@/lib/types";
import { CustomerCaseList } from "./customer";
import { CaseJourney } from "./friendly-case";

export function Cases() {
  const { data, loading, error, reload } = useData<{ cases: CaseRecord[] }>(
    "/api/cases",
  );
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  useEffect(() => {
    const query = new URLSearchParams(window.location.search).get("filter");
    if (query) setTab(query);
  }, []);
  const cases = data?.cases || [];
  const active = cases.filter(
    (record) => !["RESOLVED", "CLOSED", "ESCALATED"].includes(record.status),
  );
  const filtered = cases.filter(
    (record) =>
      (tab === "all" ||
        (tab === "active" && active.includes(record)) ||
        (tab === "resolved" && record.status === "RESOLVED")) &&
      (!type || record.type === type) &&
      `${record.title} ${record.number}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        title={localizeText("Mening ishlarim")}
        description={localizeText(
          "Murojaatlaringiz, tanlangan yechimlar va jarayon bir joyda.",
        )}
      >
        <Button asChild>
          <Link href="/dashboard/new">
            <Plus size={17} />
            <LocalizedText>Yangi muammo boshlash</LocalizedText>
          </Link>
        </Button>
      </PageHeading>
      <div className="panel cases-list-panel">
        <div className="list-toolbar">
          <div className="tabs filter-tabs">
            {[
              { key: "all", label: "Barcha ishlar", count: cases.length },
              { key: "active", label: "Jarayonda", count: active.length },
              {
                key: "resolved",
                label: "Yakunlangan",
                count: cases.filter((record) => record.status === "RESOLVED")
                  .length,
              },
            ].map((item) => (
              <button
                key={item.key}
                className={tab === item.key ? "active" : ""}
                onClick={() => setTab(item.key)}
              >
                {item.label}
                <span>{item.count}</span>
              </button>
            ))}
          </div>
          <div className="list-search">
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={localizeText("Ishni qidirish...")}
              aria-label={localizeText("Ishni qidirish")}
            />
          </div>
        </div>
        <div className="list-filter-row">
          <span>
            {filtered.length} <LocalizedText>ta nizo</LocalizedText>
          </span>
          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
            aria-label={localizeText("Nizo turi")}
          >
            <option value="">
              <LocalizedText>Barcha yo‘nalishlar</LocalizedText>
            </option>
            {Object.entries(TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorState message={error} retry={reload} />
        ) : filtered.length ? (
          <CustomerCaseList cases={filtered} />
        ) : (
          <Empty
            title={
              cases.length ? "Mos nizo topilmadi" : "Yechimga birinchi qadam"
            }
            description={
              cases.length
                ? "Boshqa so‘z yoki filtr orqali qidirib ko‘ring."
                : "Yangi murojaat yarating va huquqiy yo‘nalishlar bilan tanishing."
            }
          >
            <Button asChild>
              <Link href="/dashboard/new">
                <LocalizedText>Nizo yaratish</LocalizedText>
              </Link>
            </Button>
          </Empty>
        )}
      </div>
    </>
  );
}

export function Solutions({
  record,
  onSelected,
}: {
  record: CaseRecord;
  onSelected: () => void;
}) {
  const { user } = useProfile();
  const [busy, setBusy] = useState("");
  const { toast, refresh } = useUI();
  async function choose(solution: SolutionType) {
    setBusy(solution);
    try {
      await api(`/api/cases/${record.id}/solution`, {
        method: "POST",
        body: JSON.stringify({ solution }),
      });
      toast("Tanlangan yechim saqlandi");
      refresh();
      onSelected();
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <div className="solutions-heading">
        <h2>
          <LocalizedText>Uch yo‘l. Sizga mos yechim.</LocalizedText>
        </h2>
        <p>
          <LocalizedText>
            Har bir yo‘lning imkoniyati, xarajati va keyingi qadamlarini
            solishtiring.
          </LocalizedText>
        </p>
      </div>
      {record.analysis.criminal && (
        <div className="warning-note">
          <AlertCircle size={20} />
          <p>{record.analysis.summary}</p>
        </div>
      )}
      <div className="solutions-grid">
        {record.analysis.solutions.map((solution) => {
          const Icon =
            solution.type === "MEDIATION"
              ? Handshake
              : solution.type === "COURT"
                ? Landmark
                : FileText;
          const current = record.chosenSolution === solution.type;
          return (
            <article
              key={solution.type}
              className={`solution-card solution-${solution.type.toLowerCase()} ${current ? "solution-chosen" : ""}`}
            >
              <div className="solution-top">
                <span className="solution-icon">
                  <Icon size={25} strokeWidth={1.6} />
                </span>
                {current ? (
                  <span className="solution-recommended">
                    <Check size={13} />
                    <LocalizedText>Tanlangan</LocalizedText>
                  </span>
                ) : (
                  solution.type === "MEDIATION" && (
                    <span className="solution-recommended">
                      <LocalizedText>Ixtiyoriy kelishuv</LocalizedText>
                    </span>
                  )
                )}
              </div>
              <h3>{solution.title}</h3>
              <p>{solution.description}</p>
              <div className="solution-numbers">
                <span>
                  <Clock3 size={15} />
                  {solution.duration}
                </span>
                <strong>
                  {solution.cost === 0
                    ? "Bepul"
                    : `${money(solution.cost)} so‘m`}
                  <small>
                    {solution.cost > 0
                      ? "Taxminiy xarajat"
                      : "Platformada xat tayyorlash"}
                  </small>
                </strong>
              </div>
              <ul>
                {solution.advantages.map((item) => (
                  <li key={item}>
                    <CheckCircle2 size={14} />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="solution-consideration">
                {solution.consideration}
              </div>
              <Button
                className="full-width"
                variant={solution.type === "MEDIATION" ? "default" : "outline"}
                disabled={
                  Boolean(busy) ||
                  user.id !== record.userId ||
                  Boolean(record.mediation && record.mediatorId) ||
                  record.analysis.criminal ||
                  [
                    "RESOLVED",
                    "CLOSED",
                    "ESCALATED",
                    "SESSION_SCHEDULED",
                  ].includes(record.status)
                }
                onClick={() => choose(solution.type)}
              >
                {busy === solution.type ? (
                  <Loader2 className="spin" size={16} />
                ) : null}
                {solution.type === "MEDIATION"
                  ? "Mediatsiyaga o‘tish"
                  : solution.type === "COURT"
                    ? "Sud yo‘lini tanlash"
                    : "Kelishuv yo‘lini tanlash"}
              </Button>
            </article>
          );
        })}
      </div>
    </>
  );
}

export function CaseDetail({ id }: { id: string }) {
  const { data, loading, error, reload } = useData<{
    case: CaseRecord;
    mediator: Mediator | null;
    sessions: MediationSession[];
  }>(`/api/cases/${id}`);
  const [tab, setTab] = useState("overview");
  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("tab");
    if (initial && ["overview", "documents", "history"].includes(initial))
      setTab(initial);
  }, [id]);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [ratingBusy, setRatingBusy] = useState(false);
  const { toast, refresh } = useUI();
  if (loading && !data) return <Loading />;
  if (error || !data)
    return <ErrorState message={error || "Nizo topilmadi."} retry={reload} />;
  const record = data.case;
  const session = data.sessions.find(
    (session) => session.status === "SCHEDULED",
  );
  const completed = data.sessions.find(
    (session) => session.status === "COMPLETED",
  );
  async function cancelSession() {
    if (!session) return;
    try {
      await api(`/api/sessions/${session.id}`, {
        method: "PUT",
        body: JSON.stringify({ action: "cancel" }),
      });
      toast("Sessiya bekor qilindi");
      refresh();
    } catch (error) {
      toast((error as Error).message, "error");
    }
  }
  async function submitRating() {
    if (!completed) return;
    setRatingBusy(true);
    try {
      await api(`/api/sessions/${completed.id}`, {
        method: "PUT",
        body: JSON.stringify({ action: "rate", rating }),
      });
      toast("Bahoyingiz saqlandi");
      refresh();
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setRatingBusy(false);
    }
  }
  return (
    <>
      <Link href="/dashboard" className="back-link">
        <ArrowLeft size={15} />
        <LocalizedText>Nizolar ro‘yxati</LocalizedText>
      </Link>
      <div className="case-detail-heading">
        <div className="case-number">
          <span>{record.number}</span>
          <StatusBadge status={record.status} />
          {record.demo && (
            <span className="demo-label">
              <LocalizedText>Namuna nizo</LocalizedText>
            </span>
          )}
        </div>
        <PageHeading
          title={record.title}
          description={`${TYPE_LABELS[record.type]} · ${record.region} · ${fullDate(record.createdAt)}`}
        >
          <Button variant="outline" asChild>
            <Link href={`/dashboard/cases/${id}/workbench`}>
              <Sparkles size={16} />
              <LocalizedText>Kelishuv ish maydoni</LocalizedText>
            </Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href={`/documents?case=${id}`}>
              <Download size={16} />
              <LocalizedText>Talabnoma</LocalizedText>
            </Link>
          </Button>
        </PageHeading>
      </div>
      <CaseJourney record={record} mediatorName={data.mediator?.name} />
      <CaseClosureControls record={record} />
      <div className="tabs detail-tabs">
        {[
          { key: "overview", label: "Umumiy ma’lumot" },
          { key: "documents", label: `Hujjatlar (${record.documents.length})` },
          { key: "history", label: "Jarayon tarixi" },
        ].map((item) => (
          <button
            className={tab === item.key ? "active" : ""}
            key={item.key}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {tab === "overview" && (
        <>
          <section className="panel friendly-case-summary">
            <h2>
              <LocalizedText>Vaziyat qisqacha</LocalizedText>
            </h2>
            <p>{record.description}</p>
          </section>
          <details
            id="case-guidance"
            className="friendly-disclosure case-full-details"
            open={
              record.analysis.criminal ||
              record.guidance?.options.some(
                (option) =>
                  option.id === "MEDIATION" &&
                  option.availability === "UNSUITABLE",
              ) ||
              undefined
            }
          >
            <summary>
              <LocalizedText>
                Hujjatlar, huquqiy yo‘llar va barcha amallar
              </LocalizedText>
            </summary>
            <CaseMediationPanel record={record} mediator={data.mediator} />
            <LegalGuide guidance={record.guidance} />
            <div className="case-overview-grid">
              <section className="panel case-summary">
                <div className="section-heading">
                  <h2>
                    <FileText size={19} />
                    <LocalizedText>Vaziyat tavsifi</LocalizedText>
                  </h2>
                  <span className="category-pill">
                    {TYPE_LABELS[record.type]}
                  </span>
                </div>
                <p className="case-description">{record.description}</p>
                <div className="case-facts">
                  <div>
                    <span>
                      <LocalizedText>Talab miqdori</LocalizedText>
                    </span>
                    <strong>
                      {money(record.claimAmount)}{" "}
                      <LocalizedText>so‘m</LocalizedText>
                    </strong>
                  </div>
                  <div>
                    <span>
                      <LocalizedText>Hudud</LocalizedText>
                    </span>
                    <strong>{record.region}</strong>
                  </div>
                  <div>
                    <span>
                      <LocalizedText>Yaratilgan sana</LocalizedText>
                    </span>
                    <strong>{fullDate(record.createdAt)}</strong>
                  </div>
                </div>
                <div className="analysis-summary">
                  <span>
                    <Sparkles size={18} />
                  </span>
                  <div>
                    <h3>
                      <LocalizedText>Dastlabki huquqiy tahlil</LocalizedText>
                    </h3>
                    <p>{record.analysis.summary}</p>
                    <small>
                      {record.analysis.mode === "rag"
                        ? "RAG yordamida tayyorlangan"
                        : "Mahalliy huquqiy ma’lumotnoma"}
                    </small>
                  </div>
                </div>
              </section>
              <aside className="panel case-next-step">
                <h2>
                  <CalendarDays size={19} />
                  <LocalizedText>Keyingi qadam</LocalizedText>
                </h2>
                {session ? (
                  <>
                    <span className="session-label">
                      <Video size={14} />
                      <LocalizedText>Onlayn mediatsiya</LocalizedText>
                    </span>
                    <h3>{fullDate(session.scheduledAt)}</h3>
                    <div className="session-time">
                      <Clock3 size={15} />
                      {timeOf(session.scheduledAt)}{" "}
                      <LocalizedText>· </LocalizedText>
                      {session.duration}{" "}
                      <LocalizedText>daqiqa · UTC+5</LocalizedText>
                    </div>
                    {data.mediator && (
                      <div className="session-person">
                        <img
                          src={data.mediator.image}
                          alt={data.mediator.name}
                        />
                        <span>
                          <strong>{data.mediator.name}</strong>
                          <small>
                            <LocalizedText>Professional mediator</LocalizedText>
                          </small>
                        </span>
                      </div>
                    )}
                    <Button className="full-width" asChild>
                      <a
                        href={`https://meet.jit.si/${session.room}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Video size={16} />
                        <LocalizedText>Uchrashuvga kirish</LocalizedText>
                      </a>
                    </Button>
                    <p className="meeting-note">
                      <LocalizedText>
                        Havola tashqi Jitsi Meet xizmatida ochiladi. Birinchi
                        ishtirokchidan kirish talab qilinishi mumkin.
                      </LocalizedText>
                    </p>
                    <button className="cancel-session" onClick={cancelSession}>
                      <LocalizedText>Sessiyani bekor qilish</LocalizedText>
                    </button>
                  </>
                ) : data.mediator && record.status !== "RESOLVED" ? (
                  <>
                    <div className="session-person">
                      <img src={data.mediator.image} alt={data.mediator.name} />
                      <span>
                        <strong>{data.mediator.name}</strong>
                        <small>
                          <LocalizedText>Mediator tanlangan</LocalizedText>
                        </small>
                      </span>
                    </div>
                    <p>
                      {record.mediation && !record.mediation.procedureDocumentId
                        ? "Ikkala taraf mediatorni tanlasin va yozma tartib-taomil kelishuvi yuklansin."
                        : "Mediatsiya uchun o‘zingizga mos vaqtni belgilang."}
                    </p>
                    <Button
                      className="full-width"
                      disabled={Boolean(
                        record.mediation &&
                        (!hasMutualAppointment(record) ||
                          !record.mediation.procedureDocumentId),
                      )}
                      onClick={() => setBookingOpen(true)}
                    >
                      <CalendarDays size={16} />
                      <LocalizedText>Sessiya belgilash</LocalizedText>
                    </Button>
                  </>
                ) : record.status === "RESOLVED" ? (
                  <div className="resolved-state">
                    <CheckCircle2 size={36} />
                    <h3>
                      <LocalizedText>Kelishuvga erishildi</LocalizedText>
                    </h3>
                    <p>
                      {completed?.notes ||
                        "Nizo mediatsiya orqali yakunlangan."}
                    </p>
                    {completed && (
                      <>
                        <label>
                          <LocalizedText>Mediatorga baho bering</LocalizedText>
                          <select
                            value={rating}
                            onChange={(event) =>
                              setRating(Number(event.target.value))
                            }
                          >
                            {[5, 4, 3, 2, 1].map((stars) => (
                              <option key={stars} value={stars}>
                                {stars} <LocalizedText>yulduz</LocalizedText>
                              </option>
                            ))}
                          </select>
                        </label>
                        <Button
                          size="sm"
                          disabled={ratingBusy}
                          onClick={submitRating}
                        >
                          {completed.rating ? "Bahoni yangilash" : "Baholash"}
                        </Button>
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="next-step-symbol">
                      <Handshake size={30} />
                    </div>
                    <h3>
                      {record.chosenSolution === "COURT"
                        ? "Sudga tayyorgarlik"
                        : record.chosenSolution === "NEGOTIATION"
                          ? "Talabnomani tayyorlang"
                          : record.chosenSolution === "MEDIATION"
                            ? "Mediator kutilmoqda"
                            : "O‘zingizga mos yo‘lni tanlang"}
                    </h3>
                    <p>
                      {record.chosenSolution === "MEDIATION"
                        ? "Ikkala taraf rozilik bildirgach, so‘rov shu shahardagi mos mediatorlarga ko‘rinadi."
                        : "Quyidagi yechimlar, hujjatlar va xarajatlar bilan tanishing."}
                    </p>
                    <Button
                      variant="outline"
                      className="full-width"
                      onClick={() => setTab("documents")}
                    >
                      <FolderOpen size={16} />
                      <LocalizedText>Hujjatlarni ko‘rish</LocalizedText>
                    </Button>
                  </>
                )}
              </aside>
            </div>
            <section className="panel legal-basis">
              <div className="section-heading">
                <div>
                  <h2>
                    <BookOpen size={19} />
                    <LocalizedText>Huquqiy asoslar</LocalizedText>
                  </h2>
                  <p>
                    <LocalizedText>
                      Rasmiy manbada amaldagi tahrirni ko‘rib chiqing
                    </LocalizedText>
                  </p>
                </div>
                <a
                  className="source-brand"
                  href="https://lex.uz"
                  target="_blank"
                  rel="noreferrer"
                >
                  <LocalizedText>lex.uz</LocalizedText>
                  <ShieldCheck size={14} />
                </a>
              </div>
              <div className="source-list">
                {record.analysis.sources.map((source) => (
                  <a
                    href={source.url}
                    key={source.id}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span className="source-doc">
                      <BookOpen size={19} />
                    </span>
                    <div>
                      <strong>
                        {source.title}
                        <small>{source.article}</small>
                      </strong>
                      <p>{source.summary}</p>
                      <span>
                        {source.lawNumber}{" "}
                        <LocalizedText>· Tekshirilgan </LocalizedText>
                        {source.verifiedAt}
                      </span>
                    </div>
                    <ChevronRight size={17} />
                  </a>
                ))}
              </div>
            </section>
            <Solutions record={record} onSelected={reload} />
            <section className="panel costs-breakdown">
              <div>
                <h2>
                  <LocalizedText>Sud xarajatlari taxmini</LocalizedText>
                </h2>
                <p>
                  <LocalizedText>
                    Talab turi va imtiyozlar yakuniy xarajatlarga ta’sir qiladi.
                  </LocalizedText>
                </p>
              </div>
              <div>
                {[
                  {
                    label: "Davlat boji",
                    value: record.analysis.costs.stateFee,
                  },
                  {
                    label: "Advokat (taxminan)",
                    value: record.analysis.costs.lawyerFee,
                  },
                  {
                    label: "Ekspertiza",
                    value: record.analysis.costs.expertFee,
                  },
                  {
                    label: "Boshqa xarajatlar",
                    value: record.analysis.costs.transportFee,
                  },
                  { label: "Jami", value: record.analysis.costs.total },
                ].map((item) => (
                  <span key={item.label}>
                    <small>{item.label}</small>
                    <strong>
                      {money(item.value)} <LocalizedText>so‘m</LocalizedText>
                    </strong>
                  </span>
                ))}
              </div>
              <a
                href={record.analysis.costs.source}
                target="_blank"
                rel="noreferrer"
              >
                <LocalizedText>Davlat boji to‘g‘risidagi qonun</LocalizedText>
                <ChevronRight size={14} />
              </a>
            </section>
            <p className="legal-disclaimer">
              <AlertCircle size={15} />
              {record.analysis.disclaimer}
            </p>
          </details>
        </>
      )}
      {tab === "documents" && (
        <DocumentsForCase record={record} onUploaded={reload} />
      )}
      {tab === "history" && (
        <section className="panel timeline-panel">
          <h2>
            <LocalizedText>Nizoning jarayon tarixi</LocalizedText>
          </h2>
          <div className="timeline">
            {[...record.history].reverse().map((item, index) => (
              <div className="timeline-item" key={`${item.at}-${index}`}>
                <span>
                  <Check size={15} />
                </span>
                <div>
                  <h3>{STATUS_LABELS[item.status]}</h3>
                  <p>{item.note}</p>
                  <small>
                    {fullDate(item.at)} <LocalizedText>· </LocalizedText>
                    {timeOf(item.at)}
                  </small>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      {data.mediator && (
        <BookingDialog
          open={bookingOpen}
          onOpenChange={setBookingOpen}
          mediator={data.mediator}
          caseId={record.id}
        />
      )}
    </>
  );
}

export function DocumentsForCase({
  record,
  onUploaded,
}: {
  record: CaseRecord;
  onUploaded: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<CaseDocument["kind"]>("APPLICATION");
  const [share, setShare] = useState(false);
  const { toast, refresh } = useUI();
  async function upload(file: File) {
    setBusy(true);
    const form = new FormData();
    form.append("file", file);
    form.append("kind", kind || "EVIDENCE");
    form.append("visibility", share ? "PARTIES" : "MEDIATOR_ONLY");
    try {
      await api(`/api/cases/${record.id}/documents`, {
        method: "POST",
        body: form,
      });
      toast("Hujjat yuklandi va shifrlab saqlandi");
      refresh();
      onUploaded();
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="documents-case-grid">
      <section className="panel document-list">
        <div className="section-heading">
          <div>
            <h2>
              <LocalizedText>Nizo hujjatlari</LocalizedText>
            </h2>
            <p>
              {record.number}{" "}
              <LocalizedText>ga biriktirilgan fayllar</LocalizedText>
            </p>
          </div>
          <Button
            size="sm"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <Plus size={16} />
            <LocalizedText>Hujjat yuklash</LocalizedText>
          </Button>
        </div>
        <div className="document-upload-options form-stack">
          <label>
            <LocalizedText>Hujjat turi</LocalizedText>
            <select
              value={kind}
              onChange={(event) =>
                setKind(event.target.value as CaseDocument["kind"])
              }
            >
              <option value="APPLICATION">
                <LocalizedText>Ariza yoki bayon</LocalizedText>
              </option>
              <option value="EVIDENCE">
                <LocalizedText>Dalil va ilova</LocalizedText>
              </option>
            </select>
          </label>
          <label className="consent-checkbox">
            <input
              type="checkbox"
              checked={share}
              onChange={(event) => setShare(event.target.checked)}
            />
            <span>
              <LocalizedText>
                Ushbu faylni ikkinchi tarafga ham ochishga roziman.
              </LocalizedText>
            </span>
          </label>
          <small>
            <LocalizedText>
              Shaxsiy faylingizni o‘zingiz va ikki taraf roziligidan so‘ng
              nizoni qabul qilgan mediator ko‘radi. Administrator vakolati
              saqlanadi.
            </LocalizedText>
          </small>
        </div>
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept=".pdf,.docx,.txt,.jpg,.jpeg,.png"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) upload(file);
            event.target.value = "";
          }}
        />
        {record.documents.length ? (
          record.documents.map((document) => (
            <div className="document-row" key={document.id}>
              <span className="document-icon">
                <FileText size={23} />
              </span>
              <div>
                <strong>{document.name}</strong>
                <small>
                  {Math.ceil(document.size / 1024)}{" "}
                  <LocalizedText>KB ·</LocalizedText>{" "}
                  {fullDate(document.uploadedAt)}
                  {document.kind === "APPLICATION" ? " · Ariza/bayon" : ""}{" "}
                  <LocalizedText>·</LocalizedText>{" "}
                  {document.visibility === "PARTIES"
                    ? "Taraflarga ochiq"
                    : "Mediator uchun"}
                </small>
              </div>
              <a
                className="icon-button"
                href={`/api/cases/${record.id}/documents/${document.id}`}
                aria-label={`${document.name} faylini yuklab olish`}
              >
                <Download size={18} />
              </a>
            </div>
          ))
        ) : (
          <button
            className="upload-dropzone"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const file = event.dataTransfer.files[0];
              if (file && !busy) upload(file);
            }}
          >
            <UploadCloud size={30} />
            <strong>
              {busy
                ? "Shifrlab saqlanmoqda..."
                : "Birinchi hujjatingizni yuklang"}
            </strong>
            <span>
              <LocalizedText>
                PDF, DOCX, TXT, JPG, PNG · 10 MB gacha
              </LocalizedText>
            </span>
          </button>
        )}
        <div className="generated-document">
          <FileCheck2 size={22} />
          <div>
            <strong>
              <LocalizedText>Rasmiy talabnoma loyihasi</LocalizedText>
            </strong>
            <p>
              <LocalizedText>
                Tarifni tanlang va vaziyatingiz asosida loyiha tayyorlang.
              </LocalizedText>
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/documents?case=${record.id}`}>
              <Download size={15} />
              <LocalizedText>Hujjat tayyorlash</LocalizedText>
            </Link>
          </Button>
        </div>
      </section>
      <aside className="panel document-checklist">
        <h2>
          <LocalizedText>Tavsiya etilgan hujjatlar</LocalizedText>
        </h2>
        <p>
          {TYPE_LABELS[record.type]}{" "}
          <LocalizedText>uchun tayyorlang</LocalizedText>
        </p>
        {record.analysis.documents.map((document, index) => (
          <div key={document}>
            <span>{index + 1}</span>
            {document}
          </div>
        ))}
        <small>
          <LocalizedText>
            Talab etiladigan yakuniy ro‘yxat vaziyat va tanlangan yechimga
            bog‘liq.
          </LocalizedText>
        </small>
      </aside>
    </div>
  );
}
