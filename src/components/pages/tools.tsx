"use client";
import { T as LocalizedText, translate as localizeText } from "@/lib/i18n";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  BookOpen,
  Calculator,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  Download,
  FileText,
  FolderOpen,
  Handshake,
  Info,
  Loader2,
  LockKeyhole,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { Empty, ErrorState, Loading, PageHeading } from "../shared";
import { useData } from "@/lib/use-data";
import { api, fullDate, money } from "@/lib/utils";
import { useUI } from "@/lib/client-store";
import {
  REGIONS,
  TYPE_LABELS,
  type CaseRecord,
  type LegalSource,
} from "@/lib/types";
import { courtCosts, DISCLAIMER } from "@/lib/legal";
import { useProfile } from "../application";
import { DataRequestForm } from "./kelishuv";
import { DocumentsForCase } from "./cases";

export function LawsPage() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const { data, error, loading, reload } = useData<{ sources: LegalSource[] }>(
    `/api/laws/search?q=${encodeURIComponent(query)}${type ? `&type=${type}` : ""}`,
  );
  return (
    <>
      <PageHeading
        title={localizeText("Huquqingizni biling.")}
        description={localizeText(
          "O‘zbekiston qonunchiligi bo‘yicha rasmiy manbalar va sodda tushuntirishlar.",
        )}
      />
      <section className="law-search-banner">
        <div className="law-search-symbol">
          <BookOpen size={34} strokeWidth={1.4} />
        </div>
        <div>
          <h2>
            <LocalizedText>Kerakli qonunni toping</LocalizedText>
          </h2>
          <p>
            <LocalizedText>
              Kalit so‘z, qonun nomi yoki raqami bo‘yicha qidiring.
            </LocalizedText>
          </p>
        </div>
        <a href="https://lex.uz" target="_blank" rel="noreferrer">
          <LocalizedText>lex.uz</LocalizedText>
          <ShieldCheck size={17} />
        </a>
      </section>
      <div className="law-filters">
        <div className="search-field">
          <Search size={19} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={localizeText(
              "Masalan, ish haqi, mediatsiya yoki O‘RQ-482",
            )}
            aria-label={localizeText("Qonunchilikni qidirish")}
          />
        </div>
        <select
          value={type}
          onChange={(event) => setType(event.target.value)}
          aria-label={localizeText("Huquq yo‘nalishi")}
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
      <div className="list-meta">
        <p>
          <strong>{data?.sources.length || 0}</strong>{" "}
          <LocalizedText>ta huquqiy manba</LocalizedText>
        </p>
        <span className="source-verification">
          <ShieldCheck size={14} />
          <LocalizedText>Rasmiy LexUZ havolalari</LocalizedText>
        </span>
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} retry={reload} />
      ) : data?.sources.length ? (
        <div className="law-grid">
          {data.sources.map((source) => (
            <article className="panel law-card" key={source.id}>
              <div className="law-card-top">
                <span>
                  <BookOpen size={24} strokeWidth={1.5} />
                </span>
                <small>{source.lawNumber}</small>
              </div>
              <h2>{source.title}</h2>
              <span className="law-article">{source.article}</span>
              <p>{source.summary}</p>
              {source.content && (
                <details className="cached-article">
                  <summary>
                    <LocalizedText>Moddani mahalliy o‘qish</LocalizedText>
                  </summary>
                  <p>{source.content}</p>
                  <small>
                    <LocalizedText>Tahrir sanasi · </LocalizedText>
                    {source.editionDate}
                  </small>
                </details>
              )}
              <div className="law-card-footer">
                <span>
                  <LocalizedText>Tekshirilgan </LocalizedText>
                  {source.verifiedAt}
                </span>
                <a href={source.url} target="_blank" rel="noreferrer">
                  <LocalizedText>LexUZda o‘qish</LocalizedText>
                  <ChevronRight size={15} />
                </a>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="panel">
          <Empty
            title={localizeText("Mos hujjat topilmadi")}
            description={localizeText(
              "So‘zni qisqartiring yoki boshqa yo‘nalishni tanlang.",
            )}
          >
            <Button
              variant="outline"
              onClick={() => {
                setQuery("");
                setType("");
              }}
            >
              <LocalizedText>Qidiruvni tozalash</LocalizedText>
            </Button>
          </Empty>
        </div>
      )}
      <p className="legal-disclaimer">
        <Info size={16} />
        <LocalizedText>
          Manba tekshirilgan sana hujjatning oxirgi o‘zgartirilgan sanasidan
          farq qiladi. Amaldagi tahrirni LexUZda tekshiring.
        </LocalizedText>
      </p>
    </>
  );
}

export function CalculatorPage() {
  const [amount, setAmount] = useState("10000000");
  const [type, setType] = useState<
    "FUQAROLIK" | "IQTISODIY" | "MEHNAT" | "ISTE_MOLCHI"
  >("FUQAROLIK");
  const [bhm, setBhm] = useState("440000");
  const valid =
    Number(amount) >= 0 && Number(amount) <= 1e12 && Number(bhm) > 0;
  const costs = useMemo(
    () =>
      courtCosts(
        Math.max(0, Math.min(Number(amount) || 0, 1e12)),
        type,
        Math.max(1, Number(bhm) || 440000),
      ),
    [amount, type, bhm],
  );
  const totalMax = Math.max(costs.total, 1);
  const savings = Math.max(
    costs.total -
      (Number(amount) < 5000000
        ? 200000
        : Number(amount) < 20000000
          ? 400000
          : 800000),
    0,
  );
  return (
    <>
      <PageHeading
        title={localizeText("Aniqroq reja, xotirjam qaror.")}
        description={localizeText(
          "Sudga murojaat qilishdan oldin taxminiy xarajatlarni hisoblang.",
        )}
      />
      <div className="calculator-grid">
        <section className="panel calculator-form">
          <div className="section-heading">
            <h2>
              <Calculator size={20} />
              <LocalizedText>Sud xarajatlari kalkulyatori</LocalizedText>
            </h2>
          </div>
          <div className="form-stack">
            <label>
              <LocalizedText>Talab miqdori</LocalizedText>
              <div className="input-affix">
                <input
                  type="number"
                  min="0"
                  max="1000000000000"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
                <span>
                  <LocalizedText>so‘m</LocalizedText>
                </span>
              </div>
            </label>
            <label>
              <LocalizedText>Nizo yoki sud turi</LocalizedText>
              <select
                value={type}
                onChange={(event) => setType(event.target.value as typeof type)}
              >
                <option value="FUQAROLIK">
                  <LocalizedText>Fuqarolik sudi — mulkiy talab</LocalizedText>
                </option>
                <option value="IQTISODIY">
                  <LocalizedText>Iqtisodiy sud — mulkiy talab</LocalizedText>
                </option>
                <option value="MEHNAT">
                  <LocalizedText>Mehnat nizosi — xodim talabi</LocalizedText>
                </option>
                <option value="ISTE_MOLCHI">
                  <LocalizedText>
                    Iste’molchi huquqlari — iste’molchi talabi
                  </LocalizedText>
                </option>
              </select>
            </label>
            <label>
              <LocalizedText>Bazaviy hisoblash miqdori (BHM)</LocalizedText>
              <div className="input-affix">
                <input
                  type="number"
                  min="1"
                  max="100000000"
                  value={bhm}
                  onChange={(event) => setBhm(event.target.value)}
                />
                <span>
                  <LocalizedText>so‘m</LocalizedText>
                </span>
              </div>
              <small className="field-hint">
                <LocalizedText>
                  Hisoblash sanasidagi amaldagi BHMni kiriting.
                </LocalizedText>
              </small>
            </label>
            {costs.exempt && (
              <div className="success-note">
                <CheckCircle2 size={18} />
                <p>
                  <LocalizedText>
                    Tanlangan talab uchun davlat boji imtiyozi hisobga olindi.
                    Qo‘llanish shartlarini qonunda tekshiring.
                  </LocalizedText>
                </p>
              </div>
            )}
            {!valid && (
              <p className="form-error">
                <LocalizedText>
                  Talab miqdori va BHMni tekshiring.
                </LocalizedText>
              </p>
            )}
            <div className="info-note">
              <Info size={17} />
              <p>
                <LocalizedText>
                  Advokat xizmati talabning 10 foizi, ekspertiza va transport
                  xarajatlari taxminiy kiritilgan.
                </LocalizedText>
              </p>
            </div>
          </div>
          <a
            className="law-formula-link"
            href="https://lex.uz/docs/-4680944"
            target="_blank"
            rel="noreferrer"
          >
            <BookOpen size={16} />
            <LocalizedText>Davlat boji to‘g‘risidagi qonun</LocalizedText>
            <ChevronRight size={15} />
          </a>
        </section>
        <section className="panel calculator-result">
          <div className="result-heading">
            <span>
              <LocalizedText>Taxminiy jami xarajat</LocalizedText>
            </span>
            <span className="category-pill">
              <LocalizedText>Hisob-kitob</LocalizedText>
            </span>
          </div>
          <div className="result-total">
            {money(costs.total)}
            <span>
              <LocalizedText>so‘m</LocalizedText>
            </span>
          </div>
          <div
            className="cost-composition"
            aria-label={localizeText("Xarajatlar taqsimoti")}
          >
            {[
              { value: costs.stateFee, className: "state-fee" },
              { value: costs.lawyerFee, className: "lawyer-fee" },
              { value: costs.expertFee, className: "expert-fee" },
              { value: costs.transportFee, className: "transport-fee" },
            ].map((item) => (
              <span
                key={item.className}
                className={item.className}
                style={{ width: `${(item.value / totalMax) * 100}%` }}
              />
            ))}
          </div>
          <div className="cost-line-items">
            {[
              {
                label: "Davlat boji",
                value: costs.stateFee,
                className: "state-fee",
              },
              {
                label: "Advokat xizmati",
                value: costs.lawyerFee,
                className: "lawyer-fee",
              },
              {
                label: "Ekspertiza",
                value: costs.expertFee,
                className: "expert-fee",
              },
              {
                label: "Transport va boshqa",
                value: costs.transportFee,
                className: "transport-fee",
              },
            ].map((item) => (
              <div key={item.className}>
                <span>
                  <i className={item.className} />
                  {item.label}
                </span>
                <strong>
                  {money(item.value)} <LocalizedText>so‘m</LocalizedText>
                </strong>
              </div>
            ))}
          </div>
          <div className="estimated-duration">
            <Clock3 size={18} />
            <span>
              <LocalizedText>Taxminiy davomiylik</LocalizedText>
              <strong>
                <LocalizedText>3–18 oy</LocalizedText>
              </strong>
            </span>
          </div>
          <div className="mediation-savings">
            <Handshake size={24} />
            <div>
              <h3>
                <LocalizedText>
                  Mediatsiya imkoniyatini ham ko‘ring
                </LocalizedText>
              </h3>
              <p>
                {savings > 0
                  ? `Taxminiy xarajatlar farqi ${money(savings)} so‘m.`
                  : "Tomonlarning roziligi bilan kelishuvga erishing."}
              </p>
            </div>
          </div>
          <Button className="full-width" asChild>
            <Link href="/dashboard/new">
              <Plus size={16} />
              <LocalizedText>Nizoni tahlil qilish</LocalizedText>
            </Link>
          </Button>
        </section>
      </div>
      <p className="legal-disclaimer">
        <AlertCircle size={16} />
        {DISCLAIMER}{" "}
        <LocalizedText>
          Ushbu hisob mulkiy talablar uchun umumiy yo‘nalish beradi.
        </LocalizedText>
      </p>
    </>
  );
}

type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  text: string;
  sources?: LegalSource[];
};
export function ChatPage({ caseId }: { caseId?: string }) {
  const { user, integrations } = useProfile();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useUI();
  const scroll = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const caseData = useData<{ case: CaseRecord }>(
    caseId ? `/api/cases/${caseId}` : null,
  );
  useEffect(() => {
    scroll.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);
  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    setInput("");
    setBusy(true);
    setMessages((current) => [
      ...current,
      { id: Date.now(), role: "user", text: question },
    ]);
    try {
      const result = await api<{ message: string; sources: LegalSource[] }>(
        "/api/chat",
        { method: "POST", body: JSON.stringify({ message: question, caseId }) },
      );
      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: "assistant",
          text: result.message,
          sources: result.sources,
        },
      ]);
    } catch (error) {
      toast((error as Error).message, "error");
      setInput(question);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }
  const suggestions = [
    "Ish haqim o‘z vaqtida to‘lanmasa nima qilishim kerak?",
    "Mediatsiya jarayoni qanday ishlaydi?",
    "Shartnoma bo‘yicha qarzni qanday undirish mumkin?",
    "Sifatsiz tovarni qaytarish uchun nima kerak?",
  ];
  return (
    <>
      <PageHeading
        title={localizeText("Savolingizni birga ko‘rib chiqamiz.")}
        description={localizeText(
          "Vaziyatingizni tushuntiring, huquqiy manbalar va keyingi qadamlar bilan tanishing.",
        )}
      >
        <span className="assistant-mode">
          <Sparkles size={15} />
          {integrations.ai ? "AI xizmati sozlangan" : "Mahalliy ma’lumotnoma"}
        </span>
      </PageHeading>
      <section className="panel chat-panel">
        <div className="chat-topbar">
          <span className="chat-avatar">
            <Sparkles size={22} />
          </span>
          <div>
            <strong>
              <LocalizedText>KELISHUV yordamchi</LocalizedText>
            </strong>
            <small>
              {caseData.data
                ? `${caseData.data.case.number} bo‘yicha suhbat`
                : "Huquqiy savollaringizga yordam"}
            </small>
          </div>
          <span className="chat-privacy">
            <LockKeyhole size={14} />
            <LocalizedText>Shaxsiy suhbat</LocalizedText>
          </span>
        </div>
        <div
          className={`chat-messages ${messages.length ? "has-messages" : ""}`}
        >
          {messages.length ? (
            <>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`chat-message message-${message.role}`}
                >
                  {message.role === "assistant" && (
                    <span className="message-avatar">
                      <Sparkles size={17} />
                    </span>
                  )}
                  <div className="message-content">
                    <p>{message.text}</p>
                    {message.sources?.length ? (
                      <div className="message-sources">
                        {message.sources.map((source) => (
                          <a
                            key={source.id}
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <BookOpen size={14} />
                            <span>{source.title}</span>
                            <ChevronRight size={13} />
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="chat-message message-assistant">
                  <span className="message-avatar">
                    <Sparkles size={17} />
                  </span>
                  <div className="message-content typing-indicator">
                    <i />
                    <i />
                    <i />
                    <span>
                      <LocalizedText>Javob tayyorlanmoqda</LocalizedText>
                    </span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="chat-welcome">
              <div className="chat-welcome-icon">
                <Sparkles size={35} strokeWidth={1.5} />
              </div>
              <h2>
                <LocalizedText>Assalomu alaykum, </LocalizedText>
                {user.fullName.split(" ")[0]}
                <LocalizedText>.</LocalizedText>
              </h2>
              <p>
                <LocalizedText>
                  Huquqiy masalangizni o‘z so‘zlaringiz bilan yozing.
                </LocalizedText>
                <br />
                <LocalizedText>
                  Boshlash uchun quyidagi savollardan birini tanlashingiz
                  mumkin.
                </LocalizedText>
              </p>
              <div className="chat-suggestions">
                {suggestions.map((suggestion, index) => {
                  const Icon = [
                    BriefcaseIcon,
                    Handshake,
                    FileText,
                    ShieldCheck,
                  ][index];
                  return (
                    <button key={suggestion} onClick={() => send(suggestion)}>
                      <Icon size={20} />
                      <span>{suggestion}</span>
                      <ChevronRight size={16} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div ref={scroll} />
        </div>
        <form
          className="chat-compose"
          onSubmit={(event) => {
            event.preventDefault();
            send(input);
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            maxLength={4000}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send(input);
              }
            }}
            placeholder={localizeText("Huquqiy savolingizni yozing...")}
            rows={1}
            aria-label={localizeText("Xabar matni")}
          />
          <Button
            type="submit"
            size="icon"
            disabled={busy || input.trim().length < 2}
            aria-label={localizeText("Xabarni yuborish")}
          >
            {busy ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
          </Button>
        </form>
        <p className="chat-disclaimer">{DISCLAIMER}</p>
      </section>
    </>
  );
}
function BriefcaseIcon({ size = 20 }: { size?: number }) {
  return <Wallet size={size} />;
}

export function DocumentsPage() {
  const { data, loading, error, reload } = useData<{ cases: CaseRecord[] }>(
    "/api/cases",
  );
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const [open, setOpen] = useState(false);
  const files =
    data?.cases
      .flatMap((record) =>
        record.documents.map((document) => ({ ...document, record })),
      )
      .filter((document) =>
        `${document.name} ${document.record.number}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ) || [];
  const selectedCase = data?.cases.find((record) => record.id === selected);
  return (
    <>
      <PageHeading
        title={localizeText("Hujjatlaringiz, bir joyda.")}
        description={localizeText(
          "Nizolarga oid dalillar va tayyorlangan talabnomalarni boshqaring.",
        )}
      >
        <Button onClick={() => setOpen(true)}>
          <Plus size={17} />
          <LocalizedText>Hujjat yuklash</LocalizedText>
        </Button>
      </PageHeading>
      <div className="document-overview">
        <div>
          <span className="stat-icon stat-blue">
            <FolderOpen size={23} />
          </span>
          <span>
            <strong>
              {data?.cases.reduce(
                (sum, record) => sum + record.documents.length,
                0,
              ) || 0}
            </strong>
            <small>
              <LocalizedText>Yuklangan hujjatlar</LocalizedText>
            </small>
          </span>
        </div>
        <div>
          <span className="stat-icon stat-green">
            <ShieldCheck size={23} />
          </span>
          <span>
            <strong>
              <LocalizedText>AES-256</LocalizedText>
            </strong>
            <small>
              <LocalizedText>Saqlashda shifrlash</LocalizedText>
            </small>
          </span>
        </div>
        <div>
          <span className="stat-icon stat-violet">
            <FileText size={23} />
          </span>
          <span>
            <strong>{data?.cases.length || 0}</strong>
            <small>
              <LocalizedText>Talabnoma loyihalari</LocalizedText>
            </small>
          </span>
        </div>
      </div>
      <section className="panel">
        <div className="section-heading">
          <h2>
            <LocalizedText>Mening fayllarim</LocalizedText>
          </h2>
          <div className="list-search">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={localizeText("Fayl yoki nizo raqami")}
              aria-label={localizeText("Hujjat qidirish")}
            />
          </div>
        </div>
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorState message={error} retry={reload} />
        ) : files.length ? (
          <div className="document-table">
            {files.map((document) => (
              <div key={document.id} className="document-row">
                <span className="document-icon">
                  <FileText size={23} />
                </span>
                <div>
                  <strong>{document.name}</strong>
                  <small>
                    {Math.ceil(document.size / 1024)}{" "}
                    <LocalizedText>KB ·</LocalizedText>{" "}
                    {fullDate(document.uploadedAt)}
                  </small>
                </div>
                <Link
                  className="document-case-link"
                  href={`/dashboard/cases/${document.record.id}`}
                >
                  {document.record.number}
                </Link>
                <a
                  className="icon-button"
                  href={`/api/cases/${document.record.id}/documents/${document.id}`}
                  aria-label={`${document.name} faylini yuklab olish`}
                >
                  <Download size={18} />
                </a>
              </div>
            ))}
          </div>
        ) : (
          <Empty
            title={
              query ? "Fayl topilmadi" : "Hujjatlaringizni tartibga keltiring"
            }
            description={
              query
                ? "Boshqa nom bilan qidirib ko‘ring."
                : "Shartnoma, chek va boshqa dalillarni tegishli nizoga biriktiring."
            }
          >
            <Button variant="outline" onClick={() => setOpen(true)}>
              <Plus size={16} />
              <LocalizedText>Birinchi hujjatni yuklash</LocalizedText>
            </Button>
          </Empty>
        )}
      </section>
      <section className="panel generated-letters">
        <div className="section-heading">
          <div>
            <h2>
              <LocalizedText>Rasmiy talabnoma loyihalari</LocalizedText>
            </h2>
            <p>
              <LocalizedText>
                Har bir nizo uchun vaziyat asosida tayyorlangan xat
              </LocalizedText>
            </p>
          </div>
          <FileText size={22} />
        </div>
        {data?.cases.map((record) => (
          <div className="document-row" key={record.id}>
            <span className="document-icon letter-icon">
              <FileText size={22} />
            </span>
            <div>
              <strong>{record.title}</strong>
              <small>
                {record.number} <LocalizedText>· DOCX loyiha</LocalizedText>
              </small>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/documents?case=${record.id}#template-studio`}>
                <Download size={14} />
                <LocalizedText>Tarifni tanlash</LocalizedText>
              </Link>
            </Button>
          </div>
        ))}
      </section>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={localizeText("Hujjatni nizoga biriktirish")}
        description={localizeText(
          "Hujjat qaysi murojaatga tegishli ekanini tanlang.",
        )}
      >
        <div className="form-stack">
          <label>
            <LocalizedText>Nizoni tanlang</LocalizedText>
            <select
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
            >
              <option value="">
                <LocalizedText>Nizoni tanlang</LocalizedText>
              </option>
              {data?.cases.map((record) => (
                <option key={record.id} value={record.id}>
                  {record.number} <LocalizedText>— </LocalizedText>
                  {record.title}
                </option>
              ))}
            </select>
          </label>
          {selectedCase && (
            <DocumentsForCase record={selectedCase} onUploaded={reload} />
          )}
          {data?.cases.length === 0 && (
            <Empty
              title={localizeText("Avval nizo yarating")}
              description={localizeText(
                "Hujjatlar tegishli murojaatga biriktiriladi.",
              )}
            >
              <Button asChild>
                <Link href="/dashboard/new">
                  <LocalizedText>Nizo yaratish</LocalizedText>
                </Link>
              </Button>
            </Empty>
          )}
        </div>
      </Dialog>
    </>
  );
}

export function SettingsPage() {
  const profile = useProfile();
  const [name, setName] = useState(profile.user.fullName);
  const [phone, setPhone] = useState(profile.user.phone);
  const [region, setRegion] = useState(profile.user.region);
  const [city, setCity] = useState(profile.user.city || "");
  const [busy, setBusy] = useState(false);
  const { toast, refresh } = useUI();
  const router = useRouter();
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api("/api/profile", {
        method: "PUT",
        body: JSON.stringify({
          fullName: name,
          phone,
          region,
          city: city || undefined,
        }),
      });
      toast("Profil ma’lumotlari saqlandi");
      refresh();
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  async function switchRole(role: string) {
    setBusy(true);
    try {
      await api("/api/auth/demo", {
        method: "POST",
        body: JSON.stringify({ role }),
      });
      refresh();
      router.push(
        ["CITIZEN", "RESPONDENT"].includes(role)
          ? "/"
          : role === "MEDIATOR"
            ? "/mediator"
            : "/admin",
      );
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        title={localizeText("Hisob sozlamalari")}
        description={localizeText(
          "Shaxsiy ma’lumotlaringiz va platforma ulanishlari.",
        )}
      />
      <div className="settings-grid">
        <section className="panel service-panel">
          <h2>
            <LocalizedText>Shaxsni tekshirish</LocalizedText>
          </h2>
          <p>
            <LocalizedText>
              Telefon, pasport va Face ID holatini tekshiring.
            </LocalizedText>
          </p>
          <Button asChild>
            <Link href="/verify">
              <LocalizedText>Shaxsni tasdiqlash bo‘limi</LocalizedText>
            </Link>
          </Button>
        </section>
        <form className="panel settings-form" onSubmit={save}>
          <div className="section-heading">
            <h2>
              <LocalizedText>Shaxsiy ma’lumotlar</LocalizedText>
            </h2>
            <span className="category-pill">
              {profile.demo ? "Namuna hisobi" : "Shaxsiy hisob"}
            </span>
          </div>
          <div className="form-stack">
            <label>
              <LocalizedText>To‘liq ism</LocalizedText>
              <input
                required
                minLength={3}
                maxLength={100}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label>
              <LocalizedText>Email</LocalizedText>
              <input
                type="email"
                value={
                  profile.user.email.endsWith("@phone.kelishuv.local")
                    ? ""
                    : profile.user.email
                }
                placeholder={localizeText("Email kiritilmagan")}
                readOnly
              />
              <small className="field-hint">
                <LocalizedText>
                  Hisobingizga kirish uchun ishlatiladi.
                </LocalizedText>
              </small>
            </label>
            <div className="form-two-cols">
              <label>
                <LocalizedText>Telefon raqami</LocalizedText>
                <input
                  type="tel"
                  maxLength={30}
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder={localizeText("+998 90 123 45 67")}
                />
              </label>
              <label>
                <LocalizedText>Hudud</LocalizedText>
                <select
                  value={region}
                  onChange={(event) => setRegion(event.target.value)}
                >
                  {REGIONS.map((region) => (
                    <option key={region}>{region}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              <LocalizedText>Shahar yoki tuman</LocalizedText>
              <input
                minLength={2}
                maxLength={100}
                value={city}
                onChange={(event) => setCity(event.target.value)}
              />
            </label>
            <Button type="submit" disabled={busy}>
              {busy ? "Saqlanmoqda..." : "O‘zgarishlarni saqlash"}
            </Button>
          </div>
        </form>
        <aside className="panel integration-panel">
          <h2>
            <LocalizedText>Platforma muhiti</LocalizedText>
          </h2>
          <div className="environment-mode">
            <span>
              <ShieldCheck size={20} />
            </span>
            <div>
              <strong>
                {profile.demo ? "Mahalliy demo" : "Shaxsiy ish muhiti"}
              </strong>
              <small>
                <LocalizedText>Vaqt mintaqasi — Toshkent (UTC+5)</LocalizedText>
              </small>
            </div>
          </div>
          {[
            {
              title: "Ma’lumotlar ombori",
              status: profile.integrations.database
                ? "PostgreSQL"
                : "Shifrlangan lokal fayl",
            },
            {
              title: "AI / RAG xizmati",
              status: profile.integrations.ai
                ? "Sozlangan"
                : "Mahalliy ma’lumotnoma",
            },
            {
              title: "Email bildirishnomalari",
              status: profile.integrations.email
                ? "SMTP sozlangan"
                : "SMTP sozlash kerak",
            },
          ].map((item) => (
            <div className="integration-row" key={item.title}>
              <span>{item.title}</span>
              <strong>{item.status}</strong>
            </div>
          ))}
          <p className="integration-note">
            <LocalizedText>
              Tashqi xizmatlar loyiha muhit o‘zgaruvchilari orqali ulanadi.
            </LocalizedText>
          </p>
        </aside>
      </div>
      <DataRequestForm />
      {profile.demo && (
        <section className="panel demo-role-panel">
          <div>
            <h2>
              <LocalizedText>Platformani boshqa rolda ko‘ring</LocalizedText>
            </h2>
            <p>
              <LocalizedText>
                Namuna hisoblari bir xil mahalliy ma’lumotlar bilan ishlaydi.
              </LocalizedText>
            </p>
          </div>
          <div>
            {[
              { role: "CITIZEN", label: "Fuqaro", icon: Users },
              { role: "RESPONDENT", label: "Ikkinchi taraf", icon: Users },
              { role: "MEDIATOR", label: "Mediator", icon: Handshake },
              { role: "ADMIN", label: "Administrator", icon: ShieldCheck },
            ].map((item) => (
              <Button
                key={item.role}
                variant={
                  profile.user.role === item.role ? "default" : "outline"
                }
                disabled={busy || profile.user.role === item.role}
                onClick={() => switchRole(item.role)}
              >
                <item.icon size={17} />
                {item.label}
              </Button>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

export function HelpPage() {
  const steps = [
    {
      icon: FileText,
      title: "Vaziyatingizni bayon qiling",
      text: "Nizo yo‘nalishini tanlang, muammoni tushuntiring va tegishli dalillarni biriktiring.",
    },
    {
      icon: Sparkles,
      title: "Huquqiy yo‘llarni ko‘rib chiqing",
      text: "Dastlabki tahlil, rasmiy manbalar, hujjatlar ro‘yxati va uchta yechim bilan tanishing.",
    },
    {
      icon: Handshake,
      title: "Yechimni tanlang",
      text: "Mediatsiya, sudgacha kelishuv yoki sud yo‘lini o‘zingizga mos ravishda tanlang.",
    },
    {
      icon: Users,
      title: "Mediator bilan ishlang",
      text: "Mutaxassisni tanlang va onlayn sessiya uchun mos sana hamda vaqtni belgilang.",
    },
    {
      icon: CheckCircle2,
      title: "Natijani rasmiylashtiring",
      text: "Kelishuv natijasini qayd eting, hujjatlaringizni saqlang va mediatorni baholang.",
    },
  ];
  const faqs = [
    {
      question: "Mediatsiya nima?",
      answer:
        "Mediatsiya tomonlarning ixtiyoriy roziligi bilan xolis mediator ko‘magida o‘zaro maqbul kelishuvga erishish jarayonidir. Har bir tomon jarayonning istalgan bosqichida ishtirokni tugatishi mumkin.",
    },
    {
      question: "Platformadan foydalanish qancha turadi?",
      answer:
        "Ish ochish va dastlabki yo‘naltirish bepul. Hujjat tariflari talabnoma uchun 19 000, mediatsiya arizasi uchun 29 000 va da’vo loyihasi uchun 49 000 so‘m. Mediator haqi yozma kelishiladi. To‘lov provayderining holati To‘lovlar bo‘limida ko‘rsatiladi.",
    },
    {
      question: "AI javoblari qanday tayyorlanadi?",
      answer:
        "Mahalliy rejimda yo‘nalishlar tekshirilgan huquqiy manbalar katalogidan tayyorlanadi. RAG xizmati, Qdrant va LLM sozlanganda hujjatlar qidiruvi asosida qo‘shimcha tahlil olinadi. Har bir manbani LexUZda ko‘rishingiz mumkin.",
    },
    {
      question: "Qanday hujjatlarni yuklash mumkin?",
      answer:
        "PDF, DOCX, TXT, JPG va PNG fayllarini yuklash mumkin. Har bir faylning eng katta hajmi 10 MB. Hujjatni tegishli nizo sahifasida yoki Hujjatlarim bo‘limida biriktiring.",
    },
    {
      question: "Onlayn uchrashuvga qanday kiraman?",
      answer:
        "Nizo tafsilotlari sahifasida sessiya havolasi bo‘ladi. U Jitsi Meet xizmatini yangi oynada ochadi. Xizmat birinchi ishtirokchidan hisobga kirishni so‘rashi mumkin. Uchrashuv vaqti Toshkent vaqtida ko‘rsatiladi.",
    },
  ];
  return (
    <>
      <PageHeading
        title={localizeText("Yechim topish, qadam-baqadam.")}
        description={localizeText(
          "KELISHUV imkoniyatlari va tez-tez beriladigan savollar.",
        )}
      />
      <section className="help-process">
        {steps.map((step, index) => (
          <article className="panel" key={step.title}>
            <div className="process-step-number">{index + 1}</div>
            <step.icon size={29} strokeWidth={1.5} />
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </article>
        ))}
      </section>
      <div className="help-columns">
        <section className="panel faq-panel">
          <h2>
            <LocalizedText>Ko‘p beriladigan savollar</LocalizedText>
          </h2>
          {faqs.map((faq) => (
            <details key={faq.question}>
              <summary>
                {faq.question}
                <Plus size={17} />
              </summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </section>
        <aside className="help-contact">
          <div className="help-large-icon">
            <MessageIcon />
          </div>
          <h2>
            <LocalizedText>Savolingiz javobsiz qoldimi?</LocalizedText>
          </h2>
          <p>
            <LocalizedText>
              Huquqiy savolingizni yordamchiga yozing yoki rasmiy manbalarni
              ko‘rib chiqing.
            </LocalizedText>
          </p>
          <Button asChild>
            <Link href="/assistant">
              <Sparkles size={17} />
              <LocalizedText>Yordamchiga yozish</LocalizedText>
            </Link>
          </Button>
          <Link className="text-link" href="/laws">
            <LocalizedText>Qonunchilik bazasi</LocalizedText>
            <ChevronRight size={16} />
          </Link>
        </aside>
      </div>
      <section className="panel privacy-panel" id="privacy">
        <h2>
          <LockKeyhole size={22} />
          <LocalizedText>Ma’lumotlar va maxfiylik</LocalizedText>
        </h2>
        <p>
          <LocalizedText>
            Nizolar va yuklangan hujjatlar AES-256-GCM yordamida shifrlanib
            saqlanadi. Shaxsiy hisoblar paroli alohida salt bilan scrypt orqali
            xeshlanadi. Nizoga uning egasi, biriktirilgan mediator va
            administrator ruxsat bilan kira oladi.
          </LocalizedText>
        </p>
        <p>
          <LocalizedText>
            Mahalliy demo hisobidagi namuna ma’lumotlari birgalikda
            foydalaniladi. Shaxsiy ishlar uchun alohida hisob yarating.
            Shifrlash kalitini va loyiha ma’lumotlari papkasini himoyalang.
          </LocalizedText>
        </p>
        <p>{DISCLAIMER}</p>
        <div className="help-credits">
          <span>
            <LocalizedText>Namuna portretlari — Unsplash.</LocalizedText>
          </span>
          <span>
            <LocalizedText>
              Tarozi tasviri — AI yordamida yaratilgan.
            </LocalizedText>
          </span>
        </div>
      </section>
    </>
  );
}
function MessageIcon() {
  return <CircleHelp size={39} strokeWidth={1.4} />;
}
