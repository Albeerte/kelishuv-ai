"use client";
import { T as LocalizedText, translate as localizeText } from "@/lib/i18n";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Clipboard, FileCheck2, Handshake, MapPin, Phone, ShieldCheck } from "lucide-react";
import { useProfile } from "../application";
import { Brand, Empty, ErrorState, Loading, PageHeading } from "../shared";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { useData } from "@/lib/use-data";
import { useUI } from "@/lib/client-store";
import { api, fullDate, money, timeOf } from "@/lib/utils";
import { CONSENT_TEXT, CONSENT_VERSION, hasBothConsents, hasMutualAppointment, isParty } from "@/lib/mediation";
import { REGIONS, TYPE_LABELS, type CaseDocument, type CasePayment, type CaseRecord, type LegalGuidance, type Mediator, type PublicUser, type RoutingFacts } from "@/lib/types";

export const EMPTY_FACTS: RoutingFacts = {
  publicAuthority: "UNKNOWN",
  bothBusinesses: "UNKNOWN",
  arbitrationAgreement: "UNKNOWN",
  internationalCommercial: "UNKNOWN",
  thirdPartyRights: "UNKNOWN",
};
const factLabels: Record<keyof RoutingFacts, string> = {
  publicAuthority:
    "Taraflardan biri davlat organi, davlat tashkiloti, davlat ishtirokidagi korxona yoki mahalla organimi?",
  bothBusinesses: "Ikkala taraf ham tadbirkor yoki tashkilotmi?",
  arbitrationAgreement:
    "Ushbu nizoni qamrab oladigan yozma arbitraj kelishuvi bormi?",
  internationalCommercial: "Nizo xalqaro tijorat munosabatiga bog‘liqmi?",
  thirdPartyRights:
    "Ishtirok etmayotgan uchinchi shaxslar yoki jamoat manfaatlariga daxldormi?",
};

export function RoutingQuestions({
  value,
  onChange,
}: {
  value: RoutingFacts;
  onChange: (value: RoutingFacts) => void;
}) {
  return (
    <fieldset className="routing-questions form-stack">
      <legend>
        <LocalizedText>Huquqiy yo‘lni aniqlashtirish</LocalizedText>
      </legend>
      {Object.entries(factLabels).map(([key, label]) => (
        <label key={key}>
          {label}
          <select
            value={value[key as keyof RoutingFacts]}
            onChange={(event) =>
              onChange({ ...value, [key]: event.target.value })
            }
          >
            <option value="UNKNOWN">
              <LocalizedText>Aniq emas</LocalizedText>
            </option>
            <option value="YES">
              <LocalizedText>Ha</LocalizedText>
            </option>
            <option value="NO">
              <LocalizedText>Yo‘q</LocalizedText>
            </option>
          </select>
        </label>
      ))}
    </fieldset>
  );
}

export function LegalGuide({ guidance }: { guidance?: LegalGuidance }) {
  if (!guidance) return null;
  const labels = {
    POSSIBLE: "Ko‘rib chiqish mumkin",
    CONDITIONAL: "Shartlar bilan",
    UNSUITABLE: "Doiradan tashqari",
    REVIEW: "Aniqlashtirish kerak",
  };
  return (
    <section className="panel legal-guide">
      <div className="section-heading">
        <div>
          <h2>
            <LocalizedText>Qaysi yo‘l mos keladi?</LocalizedText>
          </h2>
          <p><LocalizedText>{guidance.summary}</LocalizedText></p>
        </div>
        <ShieldCheck size={23} />
      </div>
      <p className="court-direction"><LocalizedText>{guidance.court}</LocalizedText></p>
      <div className="forum-grid">
        {guidance.options.map((option) => (
          <article
            className={`forum-card forum-${option.availability.toLowerCase()}`}
            key={option.id}
          >
            <span className="forum-status"><LocalizedText>{labels[option.availability]}</LocalizedText></span>
            <h3><LocalizedText>{option.title}</LocalizedText></h3>
            <p><LocalizedText>{option.reason}</LocalizedText></p>
            <details>
              <summary>
                <LocalizedText>Talablar va keyingi qadamlar</LocalizedText>
              </summary>
              <ul>
                {[...option.requirements, ...option.nextSteps].map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </details>
            <div className="forum-sources">
              {option.sources.map((source) => (
                <a
                  key={`${source.lawId}-${source.article}`}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <LocalizedText>{source.title}</LocalizedText> <LocalizedText>· </LocalizedText>
                  <LocalizedText>{source.article}</LocalizedText>
                </a>
              ))}
            </div>
          </article>
        ))}
      </div>
      {guidance.questions.length > 0 && (
        <details className="routing-open-questions">
          <summary>
            <LocalizedText>Aniqlashtiriladigan savollar</LocalizedText>
          </summary>
          <ul>
            {guidance.questions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </details>
      )}
      <small className="source-checked">
        <LocalizedText>Manbalar tekshirilgan sana · </LocalizedText>
        {guidance.checkedAt}
      </small>
    </section>
  );
}

type Dossier = {
  parties: {
    id: string;
    name: string;
    role: string;
    phone: string;
    demo: boolean;
  }[];
  payment: CasePayment | null;
  fees: { total: number; platformFee: number; mediatorFee: number };
};

export function CaseMediationPanel({
  record,
  mediator,
}: {
  record: CaseRecord;
  mediator: Mediator | null;
}) {
  const { user, demo } = useProfile();
  const { toast, refresh } = useUI();
  const dossier = useData<Dossier>(`/api/cases/${record.id}/dossier`);
  const flow = record.mediation;
  const owner = user.id === record.userId;
  const party = isParty(record, user.id);
  const assigned =
    user.role === "MEDIATOR" &&
    mediator?.userId === user.id &&
    hasBothConsents(record);
  const finished = ["RESOLVED", "CLOSED", "ESCALATED"].includes(record.status);
  const mine = owner ? flow?.initiatorConsent : flow?.respondentConsent;
  const [email, setEmail] = useState("");
  const [invitedPhone, setInvitedPhone] = useState("");
  const [channel, setChannel] = useState("PHONE");
  const [smsStatus, setSmsStatus] = useState("");
  const invitationRequest = useRef("");
  const [name, setName] = useState("");
  const [city, setCity] = useState(
    record.city ||
      user.city ||
      (record.region === "Toshkent shahri" ? "Toshkent" : ""),
  );
  const [invitation, setInvitation] = useState("");
  const savedInvitation = useData<{ invitationUrl: string | null }>(
    owner && !finished && flow?.invitationExpiresAt && !flow.respondentId
      ? `/api/cases/${record.id}/invitation`
      : null,
  );
  useEffect(() => {
    if (savedInvitation.data?.invitationUrl)
      setInvitation(
        new URL(savedInvitation.data.invitationUrl, window.location.origin)
          .href,
      );
  }, [savedInvitation.data]);
  const [phone, setPhone] = useState(mine?.phone || user.phone);
  const [statement, setStatement] = useState(flow?.respondentStatement || "");
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);

  async function post(action: string, values: unknown) {
    setBusy(true);
    try {
      await api(`/api/cases/${record.id}/${action}`, {
        method: "POST",
        body: JSON.stringify(values),
      });
      toast("Ma’lumot saqlandi");
      refresh();
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function invite(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      invitationRequest.current ||= crypto.randomUUID();
      const result = await api<{
        invitationUrl: string;
        smsStatus: string | null;
      }>(`/api/cases/${record.id}/invitation`, {
        method: "POST",
        body: JSON.stringify({
          email: channel === "EMAIL" ? email : undefined,
          phone: channel === "PHONE" ? invitedPhone : undefined,
          name,
          city,
          requestId: invitationRequest.current,
        }),
      });
      setInvitation(new URL(result.invitationUrl, window.location.origin).href);
      setSmsStatus(result.smsStatus || "");
      toast("Taklif havolasi tayyor. Ikkinchi tarafga ulashing.");
      refresh();
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  if (!flow && record.mediatorId) return null;
  return (
    <section className="panel mediation-flow">
      <div className="section-heading">
        <div>
          <h2>
            <Handshake size={21} />{" "}
            <LocalizedText>Tomonlar va mediatsiya</LocalizedText>
          </h2>
          <p>
            <MapPin size={14} /> {record.city || "Shahar kiritiladi"}{" "}
            <LocalizedText>·</LocalizedText> {record.region}
          </p>
        </div>
        <span className="category-pill">
          <LocalizedText>{hasBothConsents(record)
            ? "Ikkala taraf rozilik bergan"
            : "Ikki taraf roziligi"}</LocalizedText>
        </span>
      </div>
      <div className="mediation-milestones">
        {[
          { label: "Taklif qabul qilindi", done: !!flow?.respondentId },
          { label: "Ikki taraf roziligi", done: hasBothConsents(record) },
          { label: "Mediator qabul qildi", done: !!record.mediatorId },
          {
            label: "Mediator o‘zaro tanlandi",
            done: hasMutualAppointment(record),
          },
          { label: "Yozma tartib-taomil", done: !!flow?.procedureDocumentId },
          { label: "Mediativ kelishuv", done: !!flow?.settlementDocumentId },
        ].map((step) => (
          <span className={step.done ? "done" : ""} key={step.label}>
            <CheckCircle2 size={16} />
            <LocalizedText>{step.label}</LocalizedText>
          </span>
        ))}
      </div>
      <div className="mediation-content">
        {owner && !flow?.respondentId && !finished && (
          <div className="referral-invitation">
            <h3>
              <LocalizedText>Ikkinchi tarafni taklif qiling</LocalizedText>
            </h3>
            <p>
              <LocalizedText>
                Nizo tavsifi taklifni qabul qilgan tarafga ko‘rinadi.
                Hujjatlaringiz uchun ulashish tanlovini alohida belgilang.
              </LocalizedText>
            </p>
            <form className="form-stack" onSubmit={invite}>
              <label>
                <LocalizedText>Taklif usuli</LocalizedText>
                <select
                  value={channel}
                  onChange={(event) => {
                    setChannel(event.target.value);
                    invitationRequest.current = "";
                  }}
                >
                  <option value="PHONE">
                    {localizeText("Telefon va SMS")}
                  </option>
                  <option value="EMAIL">
                    {localizeText("Emailga bog‘langan havola")}
                  </option>
                </select>
              </label>
              <div className="form-two-cols">
                <label>
                  <LocalizedText>Ikkinchi taraf ismi</LocalizedText>
                  <input
                    required
                    minLength={2}
                    maxLength={100}
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value);
                      invitationRequest.current = "";
                    }}
                  />
                </label>
                <label>
                  <LocalizedText>
                    {channel === "PHONE"
                      ? "Ikkinchi taraf telefoni"
                      : "Ikkinchi taraf emaili"}
                  </LocalizedText>
                  <input
                    required
                    type={channel === "PHONE" ? "tel" : "email"}
                    value={channel === "PHONE" ? invitedPhone : email}
                    placeholder={channel === "PHONE" ? "+998 90 123 45 67" : ""}
                    onChange={(event) => {
                      if (channel === "PHONE")
                        setInvitedPhone(event.target.value);
                      else setEmail(event.target.value);
                      invitationRequest.current = "";
                    }}
                  />
                </label>
              </div>
              <label>
                <LocalizedText>Mediatsiya shahri yoki tumani</LocalizedText>
                <input
                  required
                  minLength={2}
                  maxLength={100}
                  value={city}
                  onChange={(event) => {
                    setCity(event.target.value);
                    invitationRequest.current = "";
                  }}
                  placeholder={localizeText("Masalan, Samarqand")}
                />
              </label>
              {demo && (
                <button
                  className="text-link"
                  type="button"
                  onClick={() => {
                    setName("Ikkinchi taraf (namuna)");
                    setEmail("demo-respondent@demo.medimatch.uz");
                    setChannel("EMAIL");
                    invitationRequest.current = "";
                  }}
                >
                  <LocalizedText>
                    Ikkinchi namuna hisobini taklif qilish
                  </LocalizedText>
                </button>
              )}
              <Button disabled={busy || record.analysis.criminal} type="submit">
                <LocalizedText>{busy
                  ? "Tayyorlanmoqda..."
                  : "Shaxsiy taklif havolasini yaratish"}</LocalizedText>
              </Button>
            </form>
            {invitation && (
              <div className="invitation-result">
                {smsStatus && (
                  <p role="status">
                    <LocalizedText>
                      {smsStatus === "ACCEPTED"
                        ? "SMS provayder tomonidan qabul qilindi. Yetkazilishi operatorga bog‘liq."
                        : smsStatus === "UNCONFIGURED"
                          ? "SMS xizmati ulanishini kutmoqda. Shaxsiy havolani qarshi tarafga ulashing. U taklifdagi telefon raqamli hisobidan qo‘shiladi."
                          : "SMS yuborilishi tasdiqlanmadi. Havolani ulashing yoki keyin qayta urinib ko‘ring."}
                    </LocalizedText>
                  </p>
                )}
                <label>
                  <LocalizedText>7 kunlik taklif havolasi</LocalizedText>
                  <input
                    readOnly
                    value={invitation}
                    onFocus={(event) => event.target.select()}
                  />
                </label>
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(invitation);
                      toast("Havola nusxalandi");
                    } catch {
                      toast("Havolani belgilab nusxalang", "error");
                    }
                  }}
                >
                  <Clipboard size={16} />
                  <LocalizedText>Nusxalash</LocalizedText>
                </Button>
                <a href={invitation}>
                  <LocalizedText>Taklifni ochish</LocalizedText>
                </a>
              </div>
            )}
          </div>
        )}
        {flow?.respondentId && (
          <div className="party-consent-grid">
            {[
              { name: "Murojaatchi", consent: flow.initiatorConsent },
              { name: "Ikkinchi taraf", consent: flow.respondentConsent },
            ].map((item) => (
              <div
                className={`consent-state ${item.consent ? "consented" : ""}`}
                key={item.name}
              >
                <ShieldCheck size={22} />
                <div>
                  <strong>{item.name}</strong>
                  <span>
                    <LocalizedText>{item.consent
                      ? "Yo‘naltirishga rozilik berdi"
                      : "Rozilik kutilmoqda"}</LocalizedText>
                  </span>
                  {item.consent && (
                    <small>
                      {fullDate(item.consent.at)}{" "}
                      <LocalizedText>· </LocalizedText>
                      {timeOf(item.consent.at)}
                    </small>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {party && !owner && !finished && (
          <form
            className="form-stack respondent-statement"
            onSubmit={(event) => {
              event.preventDefault();
              void post("position", { statement });
            }}
          >
            <label>
              <LocalizedText>Ikkinchi taraf bayoni</LocalizedText>
              <textarea
                rows={5}
                minLength={20}
                maxLength={10000}
                required
                value={statement}
                onChange={(event) => setStatement(event.target.value)}
                placeholder={localizeText(
                  "Murojaatga munosabatingiz, dalillaringiz va taklifingizni yozing.",
                )}
              />
            </label>
            <Button variant="outline" disabled={busy} type="submit">
              <LocalizedText>Bayonni saqlash</LocalizedText>
            </Button>
          </form>
        )}
        {party && (flow?.invitedEmail || flow?.invitedPhone) && !finished && (
          <div className="consent-form form-stack">
            {mine ? (
              <div className="consent-saved">
                <CheckCircle2 size={21} />
                <p>
                  <LocalizedText>
                    Roziligingiz qayd etilgan. Har ikki taraf rozilik
                    bildirgach, so‘rov shu shahardagi mos mediatorlarga chiqadi.
                  </LocalizedText>
                </p>
                <Button
                  disabled={busy}
                  variant="outline"
                  onClick={() => post("consent", { agree: false })}
                >
                  <LocalizedText>Rozilikni qaytarib olish</LocalizedText>
                </Button>
              </div>
            ) : (
              <>
                <label>
                  <LocalizedText>Aloqa telefoningiz</LocalizedText>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder={localizeText("+998 90 123 45 67")}
                  />
                </label>
                <label className="consent-checkbox">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => setChecked(event.target.checked)}
                  />
                  <span>{CONSENT_TEXT}</span>
                </label>
                <Button
                  disabled={!checked || busy}
                  onClick={() =>
                    post("consent", {
                      agree: true,
                      phone,
                      textVersion: CONSENT_VERSION,
                    })
                  }
                >
                  <Handshake size={17} />
                  <LocalizedText>Mediatorga yuborishga roziman</LocalizedText>
                </Button>
              </>
            )}
          </div>
        )}
        {hasBothConsents(record) && !mediator && !finished && (
          <p className="info-note">
            <ShieldCheck size={19} />
            <LocalizedText>So‘rov </LocalizedText>
            {record.city}{" "}
            <LocalizedText>
              shahridagi mos ixtisosli mediatorlar navbatida. Qabul qilgan
              mediator sizga qo‘ng‘iroq qiladi.
            </LocalizedText>
          </p>
        )}
        {mediator && (
          <div className="appointment-block">
            <div>
              <strong>{mediator.name}</strong>
              <p>
                {mediator.city || mediator.region}{" "}
                <LocalizedText>· </LocalizedText>
                {mediator.certNumber}
                {mediator.demo ? " · Namuna profil" : ""}
              </p>
            </div>
            {party &&
              !finished &&
              (flow?.mediatorApprovals.some(
                (item) =>
                  item.userId === user.id && item.mediatorId === mediator.id,
              ) ? (
                <span className="category-pill">
                  <LocalizedText>Mediatorni tanladingiz</LocalizedText>
                </span>
              ) : (
                <Button
                  disabled={busy || !hasBothConsents(record)}
                  onClick={() =>
                    post("mediator-approval", {
                      mediatorId: mediator.id,
                      agree: true,
                    })
                  }
                >
                  <LocalizedText>Ushbu mediatorni tanlayman</LocalizedText>
                </Button>
              ))}
          </div>
        )}
        {flow?.procedureDocumentId && (
          <AgreementLink
            record={record}
            id={flow.procedureDocumentId}
            label={localizeText("Yozma tartib-taomil kelishuvi")}
          />
        )}
        {flow?.settlementDocumentId && (
          <AgreementLink
            record={record}
            id={flow.settlementDocumentId}
            label={localizeText("Mediativ kelishuv")}
          />
        )}
        {party && flow?.actionPlan && (
          <div className="mediator-review-summary">
            <h3>
              <LocalizedText>Mediatorning ish rejasi</LocalizedText>
            </h3>
            <h4>
              <LocalizedText>Kelishilgan jihatlar</LocalizedText>
            </h4>
            <p>{flow.agreedPoints}</p>
            <h4>
              <LocalizedText>Bahsli jihatlar</LocalizedText>
            </h4>
            <p>{flow.disputedPoints}</p>
            <h4>
              <LocalizedText>Keyingi qadamlar</LocalizedText>
            </h4>
            <p>{flow.actionPlan}</p>
          </div>
        )}
        {assigned && (
          <MediatorDossier
            record={record}
            dossier={dossier.data}
            post={post}
            busy={busy}
          />
        )}
        {dossier.error && (
          <p className="form-error" role="alert">
            {dossier.error}
          </p>
        )}
      </div>
    </section>
  );
}

function AgreementLink({
  record,
  id,
  label,
}: {
  record: CaseRecord;
  id: string;
  label: string;
}) {
  return (
    <a
      className="agreement-link"
      href={`/api/cases/${record.id}/documents/${id}`}
    >
      <FileCheck2 size={20} />
      <span>
        {label}
        <small>{record.documents.find((item) => item.id === id)?.name}</small>
      </span>
    </a>
  );
}

function MediatorDossier({
  record,
  dossier,
  post,
  busy,
}: {
  record: CaseRecord;
  dossier: Dossier | null;
  post: (action: string, values: unknown) => Promise<void>;
  busy: boolean;
}) {
  const [partyId, setPartyId] = useState(record.userId);
  const [outcome, setOutcome] = useState("SPOKE");
  const [callNote, setCallNote] = useState("");
  const [reference, setReference] = useState("");
  const [received, setReceived] = useState(false);
  const [agreedPoints, setAgreedPoints] = useState(
    record.mediation?.agreedPoints || "",
  );
  const [disputedPoints, setDisputedPoints] = useState(
    record.mediation?.disputedPoints || "",
  );
  const [actionPlan, setActionPlan] = useState(
    record.mediation?.actionPlan || "",
  );
  const finished = record.status === "RESOLVED";
  return (
    <div className="mediator-dossier">
      <h3>
        <LocalizedText>Mediator ish dosyesi</LocalizedText>
      </h3>
      <div className="dossier-contacts">
        {dossier?.parties.map((party) => (
          <div key={party.id}>
            <span>{party.role}</span>
            <strong>{party.name}</strong>
            {party.demo ? (
              <small>
                <LocalizedText>Namuna hisobi · </LocalizedText>
                {party.phone || "telefon kiritilmagan"}
              </small>
            ) : (
              <a href={`tel:${party.phone}`}>
                <Phone size={15} />
                {party.phone}
              </a>
            )}
          </div>
        ))}
      </div>
      <div className="party-statements">
        <article>
          <h4>
            <LocalizedText>Murojaatchining talabi</LocalizedText>
          </h4>
          <p>{record.description}</p>
        </article>
        <article>
          <h4>
            <LocalizedText>Ikkinchi taraf bayoni</LocalizedText>
          </h4>
          <p>{record.mediation?.respondentStatement || "Bayon kutilmoqda"}</p>
        </article>
      </div>
      {!finished && (
        <form
          className="form-stack agreement-form"
          onSubmit={(event) => {
            event.preventDefault();
            void post("review", { agreedPoints, disputedPoints, actionPlan });
          }}
        >
          <h4>
            <LocalizedText>Hujjatlar ko‘rigi va ish rejasi</LocalizedText>
          </h4>
          <label>
            <LocalizedText>Kelishilgan jihatlar</LocalizedText>
            <textarea
              rows={3}
              required
              minLength={3}
              maxLength={4000}
              value={agreedPoints}
              onChange={(event) => setAgreedPoints(event.target.value)}
            />
          </label>
          <label>
            <LocalizedText>Bahsli jihatlar</LocalizedText>
            <textarea
              rows={3}
              required
              minLength={3}
              maxLength={4000}
              value={disputedPoints}
              onChange={(event) => setDisputedPoints(event.target.value)}
            />
          </label>
          <label>
            <LocalizedText>Keyingi qadamlar</LocalizedText>
            <textarea
              rows={4}
              required
              minLength={20}
              maxLength={5000}
              value={actionPlan}
              onChange={(event) => setActionPlan(event.target.value)}
            />
          </label>
          <p>
            <LocalizedText>
              Saqlangan ko‘rik va reja ikkala tarafga ko‘rinadi.
            </LocalizedText>
          </p>
          <Button variant="outline" disabled={busy} type="submit">
            <LocalizedText>Ish rejasini saqlash</LocalizedText>
          </Button>
        </form>
      )}
      {!finished && (
        <form
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault();
            void post("calls", { partyId, outcome, note: callNote });
          }}
        >
          <h4>
            <LocalizedText>Qo‘ng‘iroq natijasi</LocalizedText>
          </h4>
          <div className="form-two-cols">
            <label>
              <LocalizedText>Taraf</LocalizedText>
              <select
                value={partyId}
                onChange={(event) => setPartyId(event.target.value)}
              >
                {dossier?.parties.map((party) => (
                  <option key={party.id} value={party.id}>
                    {party.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <LocalizedText>Natija</LocalizedText>
              <select
                value={outcome}
                onChange={(event) => setOutcome(event.target.value)}
              >
                <option value="SPOKE">
                  <LocalizedText>Suhbat bo‘ldi</LocalizedText>
                </option>
                <option value="NO_ANSWER">
                  <LocalizedText>Javob bermadi</LocalizedText>
                </option>
                <option value="SCHEDULED">
                  <LocalizedText>Uchrashuv kelishildi</LocalizedText>
                </option>
              </select>
            </label>
          </div>
          <label>
            <LocalizedText>Suhbat qaydi</LocalizedText>
            <textarea
              required
              minLength={3}
              maxLength={2000}
              rows={3}
              value={callNote}
              onChange={(event) => setCallNote(event.target.value)}
            />
          </label>
          <Button variant="outline" disabled={busy} type="submit">
            <LocalizedText>Qo‘ng‘iroqni qayd etish</LocalizedText>
          </Button>
        </form>
      )}
      {record.mediation?.calls.length ? (
        <details>
          <summary>
            <LocalizedText>Qo‘ng‘iroqlar tarixi</LocalizedText>
          </summary>
          {record.mediation.calls.map((call) => (
            <p className="call-history-row" key={call.id}>
              {fullDate(call.at)} <LocalizedText>· </LocalizedText>
              {timeOf(call.at)} <LocalizedText>·</LocalizedText>{" "}
              <LocalizedText>{call.outcome === "SPOKE"
                ? "Suhbat bo‘ldi"
                : call.outcome === "NO_ANSWER"
                  ? "Javob bermadi"
                  : "Uchrashuv kelishildi"}</LocalizedText>
              <span>{call.note}</span>
            </p>
          ))}
        </details>
      ) : null}
      {!finished && !record.journeyVersion && (
        <>
          <p className="info-note">
            <LocalizedText>
              Har ikki taraf mediatorni tanlagach, taraflar imzolagan yozma
              tartib-taomil kelishuvini qayd eting. Yakunda taraflar imzolagan
              va mediator tasdiqlagan mediativ kelishuvni yuklang.
            </LocalizedText>
          </p>
          <AgreementForm
            key={
              record.mediation?.procedureDocumentId
                ? "SETTLEMENT"
                : "PROCEDURE_AGREEMENT"
            }
            record={record}
            kind={
              record.mediation?.procedureDocumentId
                ? "SETTLEMENT"
                : "PROCEDURE_AGREEMENT"
            }
            post={post}
            busy={busy}
          />
        </>
      )}
      {finished && dossier && (
        <div className="case-payment">
          <h4>
            <LocalizedText>Nizo bo‘yicha xizmat haqi</LocalizedText>
          </h4>
          <div className="fee-quote">
            <span>
              <LocalizedText>Jami</LocalizedText>
              <strong>
                {money(dossier.fees.total)} <LocalizedText>so‘m</LocalizedText>
              </strong>
            </span>
            <span>
              <LocalizedText>Platforma 15%</LocalizedText>
              <strong>
                {money(dossier.fees.platformFee)}{" "}
                <LocalizedText>so‘m</LocalizedText>
              </strong>
            </span>
            <span>
              <LocalizedText>Mediator 85%</LocalizedText>
              <strong>
                {money(dossier.fees.mediatorFee)}{" "}
                <LocalizedText>so‘m</LocalizedText>
              </strong>
            </span>
          </div>
          {dossier.payment ? (
            <p className="info-note">
              <LocalizedText>Tushum qo‘lda qayd etilgan · </LocalizedText>
              {dossier.payment.reference}
              <LocalizedText>. Komissiya</LocalizedText>{" "}
              <LocalizedText>{dossier.payment.commissionStatus === "SETTLED"
                ? "to‘langan deb tasdiqlangan"
                : "to‘lanishi kutilmoqda"}</LocalizedText>
              <LocalizedText>.</LocalizedText>
            </p>
          ) : (
            <form
              className="form-stack"
              onSubmit={(event) => {
                event.preventDefault();
                void post("payment", { reference, received });
              }}
            >
              <label>
                <LocalizedText>Kvitansiya yoki to‘lov qaydi</LocalizedText>
                <input
                  required
                  minLength={3}
                  maxLength={200}
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                />
              </label>
              <label className="consent-checkbox">
                <input
                  required
                  type="checkbox"
                  checked={received}
                  onChange={(event) => setReceived(event.target.checked)}
                />
                <span>
                  <LocalizedText>
                    Xizmat haqi to‘liq tushganini tasdiqlayman. Ushbu qayd
                    qo‘lda hisobga olinadi.
                  </LocalizedText>
                </span>
              </label>
              <Button type="submit" disabled={busy || !received}>
                <LocalizedText>Tushumni qayd etish</LocalizedText>
              </Button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

function AgreementForm({
  record,
  kind,
  post,
  busy,
}: {
  record: CaseRecord;
  kind: "PROCEDURE_AGREEMENT" | "SETTLEMENT";
  post: (action: string, values: unknown) => Promise<void>;
  busy: boolean;
}) {
  const { toast, refresh } = useUI();
  const [documentId, setDocumentId] = useState("");
  const [notes, setNotes] = useState("");
  const [signed, setSigned] = useState(false);
  const [uploading, setUploading] = useState(false);
  const title =
    kind === "SETTLEMENT"
      ? "Yakuniy mediativ kelishuv"
      : "Yozma tartib-taomil kelishuvi";
  async function upload(file: File) {
    setUploading(true);
    const body = new FormData();
    body.append("file", file);
    body.append("kind", kind);
    body.append("visibility", "PARTIES");
    try {
      const result = await api<{ document: CaseDocument }>(
        `/api/cases/${record.id}/documents`,
        { method: "POST", body },
      );
      setDocumentId(result.document.id);
      toast("Kelishuv fayli yuklandi");
      refresh();
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setUploading(false);
    }
  }
  return (
    <form
      className="form-stack agreement-form"
      onSubmit={(event) => {
        event.preventDefault();
        void post(kind === "SETTLEMENT" ? "settlement" : "procedure", {
          documentId,
          notes,
          signedByParties: signed,
          mediatorApproved: signed,
        });
      }}
    >
      <h4>{title}</h4>
      <label>
        <LocalizedText>Imzoli hujjatni yuklash</LocalizedText>
        <input
          type="file"
          accept=".pdf,.docx,.txt,.jpg,.jpeg,.png"
          disabled={uploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
      </label>
      <label>
        <LocalizedText>Yuklangan hujjat</LocalizedText>
        <select
          required
          value={documentId}
          onChange={(event) => setDocumentId(event.target.value)}
        >
          <option value="">
            <LocalizedText>Faylni tanlang</LocalizedText>
          </option>
          {record.documents
            .filter(
              (item) => item.kind === kind && item.visibility === "PARTIES",
            )
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
        </select>
      </label>
      <label>
        <LocalizedText>Kelishuv va bajarish rejasi</LocalizedText>
        <textarea
          rows={4}
          required
          minLength={20}
          maxLength={5000}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder={localizeText(
            "Majburiyatlar, muddatlar va keyingi qadamlar",
          )}
        />
      </label>
      <label className="consent-checkbox">
        <input
          type="checkbox"
          required
          checked={signed}
          onChange={(event) => setSigned(event.target.checked)}
        />
        <span>
          <LocalizedText>
            Hujjatni ikkala taraf imzolaganini tekshirdim va mediator sifatida
            tasdiqlayman. Fayl ikkala tarafga ochiladi. Imzolar inson tekshiruvi
            bilan qayd etiladi.
          </LocalizedText>
        </span>
      </label>
      <Button
        type="submit"
        disabled={
          busy ||
          uploading ||
          !signed ||
          !documentId ||
          !hasMutualAppointment(record)
        }
      >
        <LocalizedText>{kind === "SETTLEMENT"
          ? "Kelishuvni tasdiqlash va yakunlash"
          : "Tartib-taomil kelishuvini qayd etish"}</LocalizedText>
      </Button>
    </form>
  );
}

export function InvitationPage({ token }: { token: string }) {
  const preview = useData<{
    number: string;
    type: keyof typeof TYPE_LABELS;
    city: string;
    region: string;
    emailHint: string;
    phoneHint?: string;
    expiresAt: string;
  }>(`/api/invitations/${token}`);
  const profile = useData<{
    user: PublicUser;
    demo: boolean;
    localDemo: boolean;
  }>("/api/auth/me");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const next = encodeURIComponent(`/invite/${token}`);
  async function join() {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ case: CaseRecord }>(
        `/api/invitations/${token}/join`,
        { method: "POST" },
      );
      window.location.assign(
        `/dashboard/cases/${result.case.id}/workbench?section=positions`,
      );
    } catch (error) {
      setError((error as Error).message);
      setBusy(false);
    }
  }
  return (
    <main className="invitation-page">
      <Brand />
      <div className="panel invitation-card">
        <Handshake size={38} />
        {preview.loading ? (
          <Loading />
        ) : preview.error || !preview.data ? (
          <ErrorState message={preview.error} />
        ) : (
          <>
            <h1>
              <LocalizedText>Mediatsiyaga taklif</LocalizedText>
            </h1>
            <p>
              {preview.data.number} <LocalizedText>· </LocalizedText>
              <LocalizedText>{TYPE_LABELS[preview.data.type]}</LocalizedText>
            </p>
            <p>
              {preview.data.city} <LocalizedText>· </LocalizedText>
              {preview.data.region}
            </p>
            <p>
              <LocalizedText>Taklif </LocalizedText>
              {preview.data.phoneHint || preview.data.emailHint}{" "}
              <LocalizedText>
                hisobiga bog‘langan. Qabul qilgach murojaat bilan tanishing va
                o‘z bayoningizni kiriting.
              </LocalizedText>
            </p>
            <small>
              <LocalizedText>Amal qilish muddati · </LocalizedText>
              {fullDate(preview.data.expiresAt)}
            </small>
            {profile.data ? (
              <div className="form-stack">
                <p className="info-note">
                  <LocalizedText>Joriy hisob · </LocalizedText>
                  {profile.data.user.phone || profile.data.user.email}
                </p>
                <Button disabled={busy} onClick={join}>
                  <LocalizedText>{busy
                    ? "Ochilmoqda..."
                    : "Ikkinchi taraf sifatida qo‘shilish"}</LocalizedText>
                </Button>
                {profile.data.demo && profile.data.localDemo && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={async () => {
                      await api("/api/auth/demo", {
                        method: "POST",
                        body: JSON.stringify({ role: "RESPONDENT" }),
                      });
                      window.location.reload();
                    }}
                  >
                    <LocalizedText>
                      Ikkinchi taraf namuna hisobiga o‘tish
                    </LocalizedText>
                  </Button>
                )}
              </div>
            ) : (
              <p>
                <LocalizedText>
                  Davom etish uchun taklif yuborilgan telefon yoki email bilan
                  hisobga kiring yoki ro‘yxatdan o‘ting.
                </LocalizedText>
              </p>
            )}
            <div className="invitation-auth-links">
              <Link href={`/auth/login?next=${next}`}>
                <LocalizedText>Hisobga kirish</LocalizedText>
              </Link>
              <Link href={`/auth/register?next=${next}`}>
                <LocalizedText>Ro‘yxatdan o‘tish</LocalizedText>
              </Link>
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </>
        )}
        <Link href="/dashboard">
          <LocalizedText>Nizolarimga qaytish</LocalizedText>
        </Link>
      </div>
    </main>
  );
}

export function MediatorApplicationPage() {
  const { user } = useProfile();
  const previous = user.mediatorApplication;
  const { refresh, toast } = useUI();
  const [city, setCity] = useState(
    user.city || (user.region === "Toshkent shahri" ? "Toshkent" : ""),
  );
  const [region, setRegion] = useState(user.region);
  const [phone, setPhone] = useState(user.phone);
  const [cert, setCert] = useState(previous?.certNumber || "");
  const [registry, setRegistry] = useState(
    previous?.registryUrl ||
      "https://gov.uz/oz/adliya/sections/professional-mediatorlar-reyestri",
  );
  const [bio, setBio] = useState(previous?.bio || "");
  const [experience, setExperience] = useState(previous?.experience || 0);
  const [specializations, setSpecializations] = useState(
    previous?.specializations || [],
  );
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/mediator/application", {
        method: "POST",
        body: JSON.stringify({
          city,
          region,
          phone,
          certNumber: cert,
          registryUrl: registry,
          specializations,
          experience,
          bio,
        }),
      });
      if (file) {
        const body = new FormData();
        body.append("file", file);
        await api("/api/mediator/application/documents", {
          method: "POST",
          body,
        });
      }
      toast("Mediator arizasi tekshiruvga yuborildi");
      refresh();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        title={localizeText("Mediator sifatida ishlash")}
        description={localizeText(
          "Guvohnoma va reyestr ma’lumotlarini yuboring. Administrator tekshiruvidan so‘ng shahringizdagi so‘rovlarni qabul qilasiz.",
        )}
      />
      <section className="panel mediator-application-panel">
        <div className="section-heading">
          <h2>
            <ShieldCheck size={22} />
            <LocalizedText>Professional profil</LocalizedText>
          </h2>
          {previous && (
            <span className="category-pill">
              <LocalizedText>{previous.status === "PENDING"
                ? "Tekshiruv kutilmoqda"
                : previous.status === "REJECTED"
                  ? "Tuzatish talab qilinadi"
                  : "Tasdiqlangan"}</LocalizedText>
            </span>
          )}
        </div>
        {previous?.reviewNote && (
          <p className="info-note">
            <LocalizedText>Administrator qaydi · </LocalizedText>
            {previous.reviewNote}
          </p>
        )}
        <form className="form-stack" onSubmit={submit}>
          <div className="form-two-cols">
            <label>
              <LocalizedText>Hudud</LocalizedText>
              <select
                value={region}
                onChange={(event) => setRegion(event.target.value)}
              >
                {REGIONS.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              <LocalizedText>Shahar yoki tuman</LocalizedText>
              <input
                required
                minLength={2}
                maxLength={100}
                value={city}
                onChange={(event) => setCity(event.target.value)}
              />
            </label>
          </div>
          <div className="form-two-cols">
            <label>
              <LocalizedText>Telefon</LocalizedText>
              <input
                type="tel"
                required
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder={localizeText("+998 90 123 45 67")}
              />
            </label>
            <label>
              <LocalizedText>Guvohnoma raqami</LocalizedText>
              <input
                required
                minLength={3}
                maxLength={80}
                value={cert}
                onChange={(event) => setCert(event.target.value)}
              />
            </label>
          </div>
          <label>
            <LocalizedText>Rasmiy reyestr havolasi</LocalizedText>
            <input
              type="url"
              required
              maxLength={500}
              value={registry}
              onChange={(event) => setRegistry(event.target.value)}
            />
          </label>
          <fieldset className="specialization-fields">
            <legend>
              <LocalizedText>Ixtisoslar</LocalizedText>
            </legend>
            {Object.entries(TYPE_LABELS).map(([key, label]) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={specializations.includes(
                    key as keyof typeof TYPE_LABELS,
                  )}
                  onChange={(event) =>
                    setSpecializations((current) =>
                      event.target.checked
                        ? [...current, key as keyof typeof TYPE_LABELS]
                        : current.filter((item) => item !== key),
                    )
                  }
                />
                {label}
              </label>
            ))}
          </fieldset>
          <label>
            <LocalizedText>Tajriba, yil</LocalizedText>
            <input
              type="number"
              required
              min={0}
              max={70}
              value={experience}
              onChange={(event) => setExperience(Number(event.target.value))}
            />
          </label>
          <label>
            <LocalizedText>Professional faoliyat haqida</LocalizedText>
            <textarea
              rows={4}
              required
              minLength={20}
              maxLength={2000}
              value={bio}
              onChange={(event) => setBio(event.target.value)}
            />
          </label>
          <label>
            <LocalizedText>
              Guvohnoma yoki reyestrdan ma’lumot fayli
            </LocalizedText>
            <input
              type="file"
              accept=".pdf,.docx,.txt,.jpg,.jpeg,.png"
              required={!previous?.documents.length}
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
          </label>
          {previous?.documents.map((document) => (
            <a
              key={document.id}
              href={`/api/mediator-applications/${user.id}/documents/${document.id}`}
            >
              {document.name}
            </a>
          ))}
          <p className="info-note">
            <LocalizedText>
              Xizmat haqi tushumi nizo bo‘yicha qayd etiladi. Boshlang‘ich
              platforma ulushi shartnomaviy tarif bo‘yicha 15 foiz.
            </LocalizedText>
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <Button disabled={busy || !specializations.length} type="submit">
            <LocalizedText>{busy ? "Yuborilmoqda..." : "Arizani tekshiruvga yuborish"}</LocalizedText>
          </Button>
        </form>
        <p className="application-law">
          <a
            href="https://lex.uz/docs/-3805227"
            target="_blank"
            rel="noreferrer"
          >
            <LocalizedText>Mediator talablari · 12-modda</LocalizedText>
          </a>
          <a
            href="https://lex.uz/docs/-8115139"
            target="_blank"
            rel="noreferrer"
          >
            <LocalizedText>Reyestr tartibi · 140-son qaror</LocalizedText>
          </a>
        </p>
      </section>
    </>
  );
}

export function MediatorReviewDialog({
  target,
  onClose,
}: {
  target: PublicUser | null;
  onClose: () => void;
}) {
  const { toast, refresh } = useUI();
  const [checked, setChecked] = useState(false);
  const [note, setNote] = useState("");
  const [rate, setRate] = useState(200000);
  const [busy, setBusy] = useState(false);
  const application = target?.mediatorApplication;
  async function review(approve: boolean) {
    if (!target) return;
    setBusy(true);
    try {
      await api(
        approve
          ? "/api/admin/mediators"
          : `/api/admin/applications/${target.id}`,
        {
          method: approve ? "POST" : "PUT",
          body: JSON.stringify({
            userId: target.id,
            applicationRevision: application?.revision,
            registryChecked: checked,
            reviewNote: note,
            hourlyRate: rate,
          }),
        },
      );
      toast(
        approve ? "Mediator tasdiqlandi" : "Ariza tuzatish uchun qaytarildi",
      );
      onClose();
      refresh();
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={!!target}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={localizeText("Mediator arizasini tekshirish")}
      description={target?.fullName || ""}
    >
      {application ? (
        <div className="form-stack">
          <p>
            {target?.city} <LocalizedText>· </LocalizedText>
            {target?.phone} <LocalizedText>· </LocalizedText>
            {application.experience} <LocalizedText>yil tajriba</LocalizedText>
          </p>
          <p>
            <strong>{application.certNumber}</strong>
          </p>
          <p>{application.bio}</p>
          <p>
            {application.specializations
              .map((type) => TYPE_LABELS[type])
              .join(", ")}
          </p>
          <a href={application.registryUrl} target="_blank" rel="noreferrer">
            <LocalizedText>Rasmiy reyestrni ochish</LocalizedText>
          </a>
          {application.documents.map((document) => (
            <a
              key={document.id}
              href={`/api/mediator-applications/${target?.id}/documents/${document.id}`}
            >
              {document.name}
            </a>
          ))}
          <label>
            <LocalizedText>Soatlik maslahat narxi, so‘m</LocalizedText>
            <input
              type="number"
              min={0}
              max={10000000}
              value={rate}
              onChange={(event) => setRate(Number(event.target.value))}
            />
          </label>
          <label>
            <LocalizedText>Tekshiruv qaydi</LocalizedText>
            <textarea
              rows={3}
              minLength={10}
              maxLength={2000}
              required
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          <label className="consent-checkbox">
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => setChecked(event.target.checked)}
            />
            <span>
              <LocalizedText>
                Shaxs, guvohnoma va amaldagi reyestr yozuvini qo‘lda
                solishtirdim.
              </LocalizedText>
            </span>
          </label>
          <Button
            disabled={
              busy ||
              !checked ||
              note.trim().length < 10 ||
              !application.documents.length
            }
            onClick={() => review(true)}
          >
            <LocalizedText>Profilni tasdiqlash</LocalizedText>
          </Button>
          <Button
            variant="outline"
            disabled={busy || note.trim().length < 10}
            onClick={() => review(false)}
          >
            <LocalizedText>Tuzatish uchun qaytarish</LocalizedText>
          </Button>
        </div>
      ) : (
        <p>
          <LocalizedText>
            Mediator o‘z kabinetida ariza va guvohnoma faylini topshirishi
            kerak.
          </LocalizedText>
        </p>
      )}
    </Dialog>
  );
}

export function PaymentLedger({
  payments,
  admin = false,
}: {
  payments: CasePayment[];
  admin?: boolean;
}) {
  const { toast, refresh } = useUI();
  const [selected, setSelected] = useState<CasePayment | null>(null);
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  async function settle(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    try {
      await api(`/api/admin/payments/${selected.id}/commission`, {
        method: "POST",
        body: JSON.stringify({ reference }),
      });
      toast("Komissiya to‘lovi tasdiqlandi");
      setSelected(null);
      setReference("");
      refresh();
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel payments-ledger">
      <div className="section-heading">
        <div>
          <h2>
            <LocalizedText>Tushum va komissiya daftari</LocalizedText>
          </h2>
          <p>
            <LocalizedText>
              Har bir nizo bo‘yicha bitta tushum. Kvitansiyalar qo‘lda
              tekshiriladi.
            </LocalizedText>
          </p>
        </div>
      </div>
      {payments.length ? (
        <div className="table-scroll">
          <table className="standard-table">
            <thead>
              <tr>
                <th>
                  <LocalizedText>Nizo</LocalizedText>
                </th>
                <th>
                  <LocalizedText>Tushum</LocalizedText>
                </th>
                <th>
                  <LocalizedText>Platforma 15%</LocalizedText>
                </th>
                <th>
                  <LocalizedText>Mediator 85%</LocalizedText>
                </th>
                <th>
                  <LocalizedText>Komissiya</LocalizedText>
                </th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td>
                    <Link href={`/dashboard/cases/${payment.caseId}`}>
                      <LocalizedText>Nizoni ochish</LocalizedText>
                    </Link>
                    <small>{payment.reference}</small>
                  </td>
                  <td>
                    {money(payment.gross)} <LocalizedText>so‘m</LocalizedText>
                  </td>
                  <td>
                    {money(payment.platformFee)}{" "}
                    <LocalizedText>so‘m</LocalizedText>
                  </td>
                  <td>
                    {money(payment.mediatorNet)}{" "}
                    <LocalizedText>so‘m</LocalizedText>
                  </td>
                  <td>
                    <LocalizedText>{payment.commissionStatus === "SETTLED"
                      ? "To‘langan, qo‘lda tasdiqlangan"
                      : "To‘lanishi kutilmoqda"}</LocalizedText>
                    {admin && payment.commissionStatus === "DUE" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelected(payment)}
                      >
                        <LocalizedText>To‘lovni tekshirish</LocalizedText>
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title={localizeText("Tushum hali qayd etilmagan")}
          description={localizeText(
            "Yakuniy kelishuvdan so‘ng mediator nizo sahifasida xizmat haqi tushumini qayd etadi.",
          )}
        />
      )}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={localizeText("Komissiya to‘lovini tasdiqlash")}
        description={localizeText(
          "To‘lovni tekshirib, kvitansiya yoki bank operatsiyasi raqamini kiriting.",
        )}
      >
        <form className="form-stack" onSubmit={settle}>
          <label>
            <LocalizedText>To‘lov asosi</LocalizedText>
            <input
              required
              minLength={3}
              maxLength={200}
              value={reference}
              onChange={(event) => setReference(event.target.value)}
            />
          </label>
          <Button type="submit" disabled={busy}>
            <LocalizedText>Komissiya olinganini qayd etish</LocalizedText>
          </Button>
        </form>
      </Dialog>
    </section>
  );
}
