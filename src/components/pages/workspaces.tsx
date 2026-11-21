"use client";
import { T as LocalizedText, translate as localizeText } from "@/lib/i18n";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileCheck2,
  Handshake,
  LockKeyhole,
  ShieldCheck,
  Users,
  Video,
  Wallet,
} from "lucide-react";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { CaseTable, Empty, ErrorState, Loading, PageHeading } from "../shared";
import { useProfile } from "../application";
import { useData } from "@/lib/use-data";
import { useUI } from "@/lib/client-store";
import { api, fullDate, money, timeOf } from "@/lib/utils";
import {
  TYPE_LABELS,
  STATUS_LABELS,
  type CaseRecord,
  type MediationSession,
  type Mediator,
  type PublicUser,
} from "@/lib/types";
import { BookingDialog, MediatorAvailabilityEditor } from "./mediators";
import { CaseDetail } from "./cases";
import {
  MediatorApplicationPage,
  MediatorReviewDialog,
  PaymentLedger,
} from "./mediation";
import { hasMutualAppointment } from "@/lib/mediation";
import type { CasePayment } from "@/lib/types";

function RoleGate({ role }: { role: "MEDIATOR" | "ADMIN" }) {
  const { demo, localDemo } = useProfile();
  const { refresh, toast } = useUI();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function enter() {
    setBusy(true);
    try {
      await api("/api/auth/demo", {
        method: "POST",
        body: JSON.stringify({ role }),
      });
      refresh();
      router.push(role === "MEDIATOR" ? "/mediator" : "/admin");
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="panel role-gate">
      <span className="role-gate-icon">
        <ShieldCheck size={38} />
      </span>
      <h1>
        {role === "MEDIATOR" ? "Mediator kabineti" : "Administrator paneli"}
      </h1>
      <p>
        <LocalizedText>
          Ushbu bo‘lim tegishli vakolatli hisob orqali ochiladi.
        </LocalizedText>
      </p>
      {demo && localDemo ? (
        <Button onClick={enter} disabled={busy}>
          {busy
            ? "Ochilmoqda..."
            : `${role === "MEDIATOR" ? "Mediator" : "Administrator"} namuna hisobini ochish`}
        </Button>
      ) : (
        <Button variant="outline" asChild>
          <Link href="/auth/login">
            <LocalizedText>Hisobga kirish</LocalizedText>
          </Link>
        </Button>
      )}
    </div>
  );
}
type Available = {
  id: string;
  number: string;
  type: keyof typeof TYPE_LABELS;
  region: string;
  city?: string;
  claimAmount: number;
  status: CaseRecord["status"];
  createdAt: string;
  summary: string;
};
type MediatorData = {
  applicationRequired?: boolean;
  available: Available[];
  assigned: CaseRecord[];
  mediator: Mediator;
};
type EarningsData = {
  payments: CasePayment[];
  sessions: MediationSession[];
  completed: number;
  pending: number;
  paid: number;
};
export function MediatorPanel({ path }: { path: string }) {
  const { user } = useProfile();
  const allowed = ["MEDIATOR", "ADMIN"].includes(user.role);
  const cases = useData<MediatorData>(allowed ? "/api/mediator/cases" : null);
  const earnings = useData<EarningsData>(
    allowed ? "/api/mediator/earnings" : null,
  );
  const [complete, setComplete] = useState<MediationSession | null>(null);
  const [book, setBook] = useState<CaseRecord | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast, refresh } = useUI();
  if (!allowed) return <RoleGate role="MEDIATOR" />;
  if (path.startsWith("/mediator/cases/"))
    return <CaseDetail id={path.split("/")[3]} />;
  if (cases.loading || earnings.loading) return <Loading />;
  if (cases.data?.applicationRequired) return <MediatorApplicationPage />;
  if (cases.error || earnings.error)
    return (
      <ErrorState
        message={cases.error || earnings.error}
        retry={() => {
          cases.reload();
          earnings.reload();
        }}
      />
    );
  const assigned = cases.data?.assigned || [];
  const available = cases.data?.available || [];
  const sessions = earnings.data?.sessions || [];
  const upcoming = sessions.filter((session) => session.status === "SCHEDULED");
  const mode = path.split("/")[2];
  async function accept(id: string) {
    setBusy(true);
    try {
      await api(`/api/mediator/cases/${id}/accept`, { method: "POST" });
      toast("Nizo qabul qilindi");
      refresh();
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  async function completeSession(event: React.FormEvent) {
    event.preventDefault();
    if (!complete) return;
    setBusy(true);
    try {
      await api(`/api/sessions/${complete.id}`, {
        method: "PUT",
        body: JSON.stringify({ action: "complete", notes }),
      });
      toast("Sessiya yakunlandi va kelishuv qayd etildi");
      setComplete(null);
      setNotes("");
      refresh();
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        title={
          mode === "earnings"
            ? "Daromadlar hisobi"
            : mode === "sessions"
              ? "Mediatsiya sessiyalari"
              : mode === "cases"
                ? "Nizolar bilan ishlash"
                : `Xush kelibsiz, ${user.fullName.split(" ")[0]}.`
        }
        description={
          mode === "earnings"
            ? "Xizmat haqi, platforma ulushi va hisoblangan daromadlar."
            : "Tomonlarni tinglang, manfaatlarni birlashtiring, kelishuvga yo‘l oching."
        }
      />
      {mode === "sessions" && cases.data?.mediator && (
        <MediatorAvailabilityEditor
          key={cases.data.mediator.id}
          mediator={cases.data.mediator}
        />
      )}
      <div className="workspace-stats">
        {[
          {
            label: "Biriktirilgan nizolar",
            value: assigned.length,
            icon: BriefcaseBusiness,
          },
          {
            label: "Rejadagi sessiyalar",
            value: upcoming.length,
            icon: CalendarDays,
          },
          {
            label: "Hisoblangan daromad",
            value: `${money(earnings.data?.completed || 0)} so‘m`,
            icon: Wallet,
          },
          {
            label: "Kutilayotgan xizmat haqi",
            value: `${money(earnings.data?.pending || 0)} so‘m`,
            icon: Clock3,
          },
        ].map((item) => (
          <div className="panel workspace-stat" key={item.label}>
            <span className="stat-icon stat-blue">
              <item.icon size={21} />
            </span>
            <span>
              {item.label}
              <strong>{item.value}</strong>
            </span>
          </div>
        ))}
      </div>
      {(!mode || mode === "cases") && (
        <>
          <section className="panel workspace-case-panel">
            <div className="section-heading">
              <div>
                <h2>
                  <LocalizedText>Yangi mediatsiya so‘rovlari</LocalizedText>
                </h2>
                <p>
                  <LockKeyhole size={13} />
                  <LocalizedText>
                    Ochiq nizolar umumlashtirilgan va anonim ko‘rinadi
                  </LocalizedText>
                </p>
              </div>
              <span className="category-pill">
                {available.length} <LocalizedText>ta so‘rov</LocalizedText>
              </span>
            </div>
            {available.length ? (
              <div className="available-case-list">
                {available.map((record) => (
                  <article key={record.id}>
                    <span className="available-case-icon">
                      <Handshake size={24} />
                    </span>
                    <div>
                      <h3>{TYPE_LABELS[record.type]}</h3>
                      <p>{record.summary}</p>
                      <small>
                        {record.number} <LocalizedText>· </LocalizedText>
                        {record.city || record.region}{" "}
                        <LocalizedText>·</LocalizedText>{" "}
                        {money(record.claimAmount)}{" "}
                        <LocalizedText>so‘m</LocalizedText>
                      </small>
                    </div>
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => accept(record.id)}
                    >
                      <LocalizedText>Qabul qilish</LocalizedText>
                    </Button>
                  </article>
                ))}
              </div>
            ) : (
              <Empty
                title={localizeText("Yangi so‘rovlar kutilmoqda")}
                description={localizeText(
                  "Ikkala taraf rozilik bildirgan, shahringiz va ixtisosingizga mos so‘rovlar shu yerda ko‘rinadi.",
                )}
              />
            )}
          </section>
          <section className="panel workspace-case-panel">
            <div className="section-heading">
              <div>
                <h2>
                  <LocalizedText>Mening nizolarim</LocalizedText>
                </h2>
                <p>
                  <LocalizedText>
                    Qabul qilingan murojaatlar va navbatdagi qadamlar
                  </LocalizedText>
                </p>
              </div>
            </div>
            {assigned.length ? (
              <>
                <CaseTable cases={assigned} />
                {cases.data?.mediator && (
                  <div className="assigned-booking-list">
                    {assigned
                      .filter(
                        (record) =>
                          (!record.mediation ||
                            (hasMutualAppointment(record) &&
                              record.mediation.procedureDocumentId)) &&
                          ![
                            "RESOLVED",
                            "CLOSED",
                            "ESCALATED",
                            "SESSION_SCHEDULED",
                          ].includes(record.status),
                      )
                      .map((record) => (
                        <div key={record.id}>
                          <span>
                            {record.number} <LocalizedText>— </LocalizedText>
                            {record.title}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setBook(record)}
                          >
                            <CalendarDays size={15} />
                            <LocalizedText>Sessiya belgilash</LocalizedText>
                          </Button>
                        </div>
                      ))}
                  </div>
                )}
              </>
            ) : (
              <Empty
                title={localizeText("Hozircha biriktirilgan nizo yo‘q")}
                description={localizeText(
                  "Yuqoridagi mos yo‘nalishdagi murojaatni qabul qilib, ishni boshlang.",
                )}
              />
            )}
          </section>
        </>
      )}
      {(mode === "sessions" || !mode) && (
        <section className="panel sessions-panel">
          <div className="section-heading">
            <h2>
              {mode ? "Sessiyalar jadvali" : "Yaqinlashayotgan sessiyalar"}
            </h2>
            {!mode && (
              <Link className="text-link" href="/mediator/sessions">
                <LocalizedText>Barchasi</LocalizedText>
                <ChevronRight size={15} />
              </Link>
            )}
          </div>
          {sessions.length ? (
            <div className="table-scroll">
              <table className="standard-table">
                <thead>
                  <tr>
                    <th>
                      <LocalizedText>Nizo</LocalizedText>
                    </th>
                    <th>
                      <LocalizedText>Uchrashuv vaqti</LocalizedText>
                    </th>
                    <th>
                      <LocalizedText>Holat</LocalizedText>
                    </th>
                    <th>
                      <LocalizedText>Amallar</LocalizedText>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(mode ? sessions : upcoming).map((session) => {
                    const record = assigned.find(
                      (record) => record.id === session.caseId,
                    );
                    return (
                      <tr key={session.id}>
                        <td>
                          <Link href={`/dashboard/cases/${session.caseId}`}>
                            <strong>{record?.number || "Nizo"}</strong>
                            <small>{record?.title}</small>
                          </Link>
                        </td>
                        <td>
                          <strong>{fullDate(session.scheduledAt)}</strong>
                          <small>
                            {timeOf(session.scheduledAt)}{" "}
                            <LocalizedText>· </LocalizedText>
                            {session.duration}{" "}
                            <LocalizedText>daqiqa</LocalizedText>
                          </small>
                        </td>
                        <td>
                          <span
                            className={`status-badge ${session.status === "COMPLETED" ? "status-resolved" : session.status === "CANCELLED" ? "status-closed" : "status-session_scheduled"}`}
                          >
                            <span />
                            {session.status === "COMPLETED"
                              ? "Yakunlangan"
                              : session.status === "CANCELLED"
                                ? "Bekor qilingan"
                                : "Rejada"}
                          </span>
                        </td>
                        <td>
                          {session.status === "SCHEDULED" && (
                            <div className="table-actions">
                              <a
                                className="icon-button"
                                href={`https://meet.jit.si/${session.room}`}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={localizeText("Video uchrashuv")}
                              >
                                <Video size={18} />
                              </a>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  record?.mediation
                                    ? window.location.assign(
                                        `/dashboard/cases/${record.id}`,
                                      )
                                    : setComplete(session)
                                }
                              >
                                <LocalizedText>Yakunlash</LocalizedText>
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title={localizeText("Sessiyalar belgilanmagan")}
              description={localizeText(
                "Qabul qilingan nizo uchun uchrashuv vaqtini belgilang.",
              )}
            />
          )}
        </section>
      )}
      {mode === "earnings" && (
        <PaymentLedger payments={earnings.data?.payments || []} />
      )}
      {mode === "earnings" && (
        <>
          <div className="info-note earnings-note">
            <Wallet size={20} />
            <p>
              <LocalizedText>
                Tushumlar yuqoridagi daftarda qo‘lda qayd etiladi. Quyida
                sessiyalar bo‘yicha xizmat haqi ko‘rsatilgan. Platforma ulushi
                15%, mediator ulushi 85%.
              </LocalizedText>
            </p>
          </div>
          <section className="panel">
            <div className="section-heading">
              <h2>
                <LocalizedText>Xizmat haqi tarixi</LocalizedText>
              </h2>
              <span className="category-pill">
                <LocalizedText>To‘langan </LocalizedText>
                {money(earnings.data?.paid || 0)}{" "}
                <LocalizedText>so‘m</LocalizedText>
              </span>
            </div>
            {sessions.length ? (
              <div className="table-scroll">
                <table className="standard-table">
                  <thead>
                    <tr>
                      <th>
                        <LocalizedText>Sana</LocalizedText>
                      </th>
                      <th>
                        <LocalizedText>Xizmat haqi</LocalizedText>
                      </th>
                      <th>
                        <LocalizedText>Platforma 15%</LocalizedText>
                      </th>
                      <th>
                        <LocalizedText>Mediator 85%</LocalizedText>
                      </th>
                      <th>
                        <LocalizedText>To‘lov holati</LocalizedText>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((session) => (
                      <tr key={session.id}>
                        <td>{fullDate(session.scheduledAt)}</td>
                        <td>
                          {money(session.fee)}{" "}
                          <LocalizedText>so‘m</LocalizedText>
                        </td>
                        <td>
                          {money(session.platformFee)}{" "}
                          <LocalizedText>so‘m</LocalizedText>
                        </td>
                        <td>
                          <strong>
                            {money(session.mediatorFee)}{" "}
                            <LocalizedText>so‘m</LocalizedText>
                          </strong>
                        </td>
                        <td>
                          <span className="category-pill">
                            {session.paid
                              ? "To‘langan"
                              : session.status === "COMPLETED"
                                ? "Hisoblangan"
                                : session.status === "CANCELLED"
                                  ? "Bekor qilingan"
                                  : "Kutilmoqda"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty
                title={localizeText("Hali xizmat haqi qayd etilmagan")}
                description={localizeText(
                  "Sessiyalaringiz belgilanganidan so‘ng hisob-kitob shu yerda ko‘rinadi.",
                )}
              />
            )}
          </section>
        </>
      )}
      <Dialog
        open={Boolean(complete)}
        onOpenChange={(open) => {
          if (!open) setComplete(null);
        }}
        title={localizeText("Mediatsiyani yakunlash")}
        description={localizeText(
          "Tomonlarning kelishuv natijasini yozma qayd eting.",
        )}
      >
        <form className="form-stack" onSubmit={completeSession}>
          <label>
            <LocalizedText>Kelishuv mazmuni</LocalizedText>
            <textarea
              required
              minLength={20}
              maxLength={10000}
              rows={6}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={localizeText(
                "Tomonlar qanday kelishuvga erishdi? Majburiyatlar va bajarish muddatlarini kiriting.",
              )}
            />
          </label>
          <div className="info-note">
            <FileCheck2 size={18} />
            <p>
              <LocalizedText>
                Natija nizo tarixida saqlanadi va fuqaro tomonidan ko‘rinadi.
              </LocalizedText>
            </p>
          </div>
          <Button type="submit" disabled={busy || notes.trim().length < 20}>
            {busy ? "Saqlanmoqda..." : "Kelishuvni qayd etish"}
          </Button>
        </form>
      </Dialog>
      {book && cases.data?.mediator && (
        <BookingDialog
          open={Boolean(book)}
          onOpenChange={(open) => {
            if (!open) setBook(null);
          }}
          mediator={cases.data.mediator}
          caseId={book.id}
        />
      )}
    </>
  );
}

type AdminData = {
  cases: CaseRecord[];
  users: PublicUser[];
  mediators: Mediator[];
  sessions: MediationSession[];
  totalCommission: number;
  payments: CasePayment[];
};
export function AdminPage({ path }: { path: string }) {
  const { user } = useProfile();
  const { data, loading, error, reload } = useData<AdminData>(
    user.role === "ADMIN" ? "/api/admin/analytics" : null,
  );
  const { toast, refresh } = useUI();
  const [approve, setApprove] = useState<PublicUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  if (user.role !== "ADMIN") return <RoleGate role="ADMIN" />;
  if (loading) return <Loading />;
  if (error || !data) return <ErrorState message={error} retry={reload} />;
  const mode = path.split("/")[2];
  const filteredCases = data.cases.filter(
    (record) =>
      `${record.title} ${record.number}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (!status || record.status === status),
  );
  const pending = data.users.filter(
    (user) =>
      user.role === "MEDIATOR" &&
      !data.mediators.some((mediator) => mediator.userId === user.id),
  );
  async function changeRole(userId: string, role: string) {
    setBusy(true);
    try {
      await api(`/api/admin/users/${userId}/role`, {
        method: "PUT",
        body: JSON.stringify({ role }),
      });
      toast("Foydalanuvchi roli yangilandi");
      refresh();
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        title={
          mode === "users"
            ? "Foydalanuvchilar"
            : mode === "cases"
              ? "Barcha nizolar"
              : mode === "mediators"
                ? "Mediatorlar boshqaruvi"
                : mode === "payments"
                  ? "To‘lovlar"
                  : mode === "reports"
                    ? "Hisobotlar"
                    : "Umumiy ko‘rinish"
        }
      />
      {!mode && (
        <div className="workspace-stats">
          {[
            {
              label: "Jami ishlar",
              value: data.cases.length,
              icon: BriefcaseBusiness,
            },
            {
              label: "Faol ishlar",
              value: data.cases.filter(
                (record) =>
                  !["RESOLVED", "CLOSED", "ESCALATED"].includes(record.status),
              ).length,
              icon: Clock3,
            },
            {
              label: "Yakunlangan",
              value: data.cases.filter((record) => record.status === "RESOLVED")
                .length,
              icon: CheckCircle2,
            },
            {
              label: "Foydalanuvchilar",
              value: data.users.length,
              icon: Users,
            },
            {
              label: "Faol mediatorlar",
              value: data.mediators.filter(
                (mediator) =>
                  (mediator.demo || mediator.registryCheckedAt) &&
                  data.users.some(
                    (user) => user.id === mediator.userId && user.isActive,
                  ),
              ).length,
              icon: ShieldCheck,
            },
            {
              label: "Tasdiqlangan komissiya",
              value: `${money((data.payments || []).filter((payment) => payment.commissionStatus === "SETTLED").reduce((sum, payment) => sum + payment.platformFee, 0))} so‘m`,
              icon: Wallet,
            },
          ].map((item) => (
            <div className="workspace-stat" key={item.label}>
              <span className="stat-icon">
                <item.icon size={21} />
              </span>
              <span>
                <LocalizedText>{item.label}</LocalizedText>
                <strong>{item.value}</strong>
              </span>
            </div>
          ))}
        </div>
      )}
      {mode === "payments" && (
        <PaymentLedger payments={data.payments || []} admin />
      )}
      {mode === "reports" && (
        <section className="panel analytics-panel">
          <div className="section-heading">
            <h2>
              <LocalizedText>Ishlar yo‘nalishlar bo‘yicha</LocalizedText>
            </h2>
          </div>
          <dl className="friendly-report-list">
            {Object.entries(TYPE_LABELS).map(([type, label]) => {
              const count = data.cases.filter(
                (record) => record.type === type,
              ).length;
              return (
                <div key={type}>
                  <dt>
                    <LocalizedText>{label}</LocalizedText>
                  </dt>
                  <dd>{count}</dd>
                </div>
              );
            })}
          </dl>
        </section>
      )}
      {(mode === "cases" || !mode) && (
        <section className="panel workspace-case-panel">
          <div className="section-heading">
            <h2>
              <LocalizedText>Nizolar ro‘yxati</LocalizedText>
            </h2>
            {!mode && (
              <Link className="text-link" href="/admin/cases">
                <LocalizedText>Barchasi</LocalizedText>
                <ChevronRight size={15} />
              </Link>
            )}
          </div>
          {mode === "cases" && (
            <div className="friendly-admin-filters">
              <label>
                <LocalizedText>Ishni qidirish</LocalizedText>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={localizeText("Sarlavha yoki raqam")}
                />
              </label>
              <label>
                <LocalizedText>Holat</LocalizedText>
                <select
                  aria-label={localizeText("Holat")}
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  <option value="">{localizeText("Barchasi")}</option>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option value={value} key={value}>
                      {localizeText(label)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {filteredCases.length ? (
            <CaseTable
              cases={mode ? filteredCases : filteredCases.slice(0, 5)}
            />
          ) : (
            <Empty
              title={localizeText("Nizolar kutilmoqda")}
              description={localizeText(
                "Yangi murojaatlar shu yerda ko‘rinadi.",
              )}
            />
          )}
        </section>
      )}
      {mode === "users" && (
        <section className="panel workspace-users-panel">
          <div className="section-heading">
            <h2>
              <LocalizedText>Foydalanuvchilar va vakolatlar</LocalizedText>
            </h2>
          </div>
          <div className="table-scroll">
            <table className="standard-table">
              <thead>
                <tr>
                  <th>
                    <LocalizedText>Foydalanuvchi</LocalizedText>
                  </th>
                  <th>
                    <LocalizedText>Hudud</LocalizedText>
                  </th>
                  <th>
                    <LocalizedText>Ro‘yxatdan o‘tgan</LocalizedText>
                  </th>
                  <th>
                    <LocalizedText>Rol</LocalizedText>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((person) => (
                  <tr key={person.id}>
                    <td>
                      <strong>{person.fullName}</strong>
                      <small>{person.email}</small>
                    </td>
                    <td>{person.region}</td>
                    <td>{fullDate(person.createdAt)}</td>
                    <td>
                      <select
                        value={person.role}
                        disabled={busy || person.id === user.id}
                        onChange={(event) =>
                          changeRole(person.id, event.target.value)
                        }
                        aria-label={`${person.fullName} roli`}
                      >
                        <option value="CITIZEN">
                          <LocalizedText>Fuqaro</LocalizedText>
                        </option>
                        <option value="MEDIATOR">
                          <LocalizedText>Mediator</LocalizedText>
                        </option>
                        <option value="LAWYER">
                          <LocalizedText>Advokat</LocalizedText>
                        </option>
                        <option value="ADMIN">
                          <LocalizedText>Administrator</LocalizedText>
                        </option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {mode === "mediators" && (
        <section className="panel workspace-mediators-panel">
          <div className="section-heading">
            <div>
              <h2>
                <LocalizedText>Mediatorlarni tasdiqlash</LocalizedText>
              </h2>
              <p>
                {pending.length}{" "}
                <LocalizedText>ta hisob tasdiq kutmoqda</LocalizedText>
              </p>
            </div>
            <ShieldCheck size={21} />
          </div>
          {pending.map((person) => (
            <div className="approval-row" key={person.id}>
              <span>
                <strong>{person.fullName}</strong>
                <small>
                  {person.email} <LocalizedText>· </LocalizedText>
                  {person.region}
                </small>
              </span>
              <Button size="sm" onClick={() => setApprove(person)}>
                <LocalizedText>Profilni tasdiqlash</LocalizedText>
              </Button>
            </div>
          ))}
          <div className="table-scroll">
            <table className="standard-table">
              <thead>
                <tr>
                  <th>
                    <LocalizedText>Mediator</LocalizedText>
                  </th>
                  <th>
                    <LocalizedText>Sertifikat</LocalizedText>
                  </th>
                  <th>
                    <LocalizedText>Yo‘nalishlar</LocalizedText>
                  </th>
                  <th>
                    <LocalizedText>Soatlik narx</LocalizedText>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.mediators.map((mediator) => (
                  <tr key={mediator.id}>
                    <td>
                      <strong>{mediator.name}</strong>
                      <small>
                        {mediator.demo ? "Namuna profili" : mediator.region}
                      </small>
                    </td>
                    <td>{mediator.certNumber}</td>
                    <td>
                      {mediator.specializations
                        .map((type) => TYPE_LABELS[type])
                        .join(", ")}
                    </td>
                    <td>
                      {money(mediator.hourlyRate)}{" "}
                      <LocalizedText>so‘m</LocalizedText>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <MediatorReviewDialog
        key={approve?.id || "none"}
        target={approve}
        onClose={() => setApprove(null)}
      />
    </>
  );
}
