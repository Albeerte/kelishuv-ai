"use client";
import { T as LocalizedText, translate as localizeText } from "@/lib/i18n";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Award,
  CalendarDays,
  ChevronRight,
  Clock3,
  Globe2,
  MapPin,
  Search,
  ShieldCheck,
  Star,
  Video,
} from "lucide-react";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { Empty, ErrorState, Loading, PageHeading } from "../shared";
import {
  TYPE_LABELS,
  REGIONS,
  type CaseRecord,
  type Mediator,
} from "@/lib/types";
import { api, money } from "@/lib/utils";
import { useData } from "@/lib/use-data";
import { useUI } from "@/lib/client-store";
import { hasMutualAppointment, normalizeCity } from "@/lib/mediation";
import { fullDate, timeOf } from "@/lib/utils";
import { useProfile } from "../application";

export function MediatorCard({
  mediator,
  compact = false,
  onBook,
}: {
  mediator: Mediator;
  compact?: boolean;
  onBook?: (mediator: Mediator) => void;
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const availability = useData<{
    slots: { start: string; available: boolean; duration: number }[];
    published: boolean;
    source: string;
  }>(profileOpen ? `/api/mediators/${mediator.id}/availability` : null);
  const book = () => {
    setProfileOpen(false);
    if (onBook) onBook(mediator);
    else setBookingOpen(true);
  };
  return (
    <>
      <article
        className={`mediator-card panel ${compact ? "mediator-compact" : ""}`}
      >
        <div className="mediator-card-top">
          <button
            className="mediator-person"
            onClick={() => setProfileOpen(true)}
          >
            <span className="mediator-photo">
              <img src={mediator.image} alt={mediator.name} />
              {mediator.isOnline && (
                <i title={localizeText("Demo onlayn holati")} />
              )}
            </span>
            <span>
              <strong>
                {mediator.name}
                <ShieldCheck size={15} />
              </strong>
              <small>{mediator.title}</small>
            </span>
          </button>
          <div className="mediator-rating">
            <Star size={13} fill="currentColor" />
            <strong>{mediator.rating}</strong>
            <small>
              <LocalizedText>(</LocalizedText>
              {mediator.casesResolved}
              <LocalizedText>)</LocalizedText>
            </small>
          </div>
        </div>
        <span
          className={`mediator-verification ${mediator.demo ? "is-demo" : ""}`}
        >
          {mediator.demo
            ? "DEMO DATA"
            : mediator.registryCheckedAt
              ? localizeText("Reyestr qo‘lda tekshirilgan")
              : localizeText("Profil ma’lumotlari")}
        </span>
        <div className="mediator-tags">
          {mediator.specializations.slice(0, compact ? 2 : 3).map((type) => (
            <span key={type}>
              <LocalizedText>{TYPE_LABELS[type]}</LocalizedText>
            </span>
          ))}
        </div>
        <div className="mediator-info">
          <span>
            <MapPin size={13} />
            {mediator.city || mediator.region.replace(" shahri", "")}
          </span>
          <span>
            <BriefcaseIcon />
            {mediator.experience} <LocalizedText>yillik tajriba</LocalizedText>
          </span>
        </div>
        {!compact && <p className="mediator-bio">{mediator.bio}</p>}
        <div className="mediator-card-footer">
          <div>
            <strong>{money(mediator.hourlyRate)}</strong>
            <span>
              {" "}
              <LocalizedText>so‘m / soat</LocalizedText>
            </span>
          </div>
          <button
            onClick={() => setProfileOpen(true)}
            className="mediator-profile-link"
          >
            <LocalizedText>Profilni ko‘rish</LocalizedText>
            <ChevronRight size={15} />
          </button>
        </div>
        <div className="mediator-session-duration">
          <Clock3 size={14} />
          <LocalizedText>60 daqiqalik sessiya</LocalizedText>
        </div>
      </article>
      <Dialog
        open={profileOpen}
        onOpenChange={setProfileOpen}
        title={localizeText("Mediator profili")}
        description={
          mediator.demo
            ? "Mahalliy namuna profili"
            : "Reyestr ma’lumotlari administrator tomonidan tekshirilgan"
        }
      >
        <div className="mediator-profile-head">
          <img src={mediator.image} alt={mediator.name} />
          <div>
            <h2>{mediator.name}</h2>
            <p>{mediator.title}</p>
            <span className="mediator-rating">
              <Star size={15} fill="currentColor" />
              {mediator.rating}{" "}
              <small>
                <LocalizedText>· </LocalizedText>
                {mediator.casesResolved}{" "}
                <LocalizedText>
                  {mediator.demo ? "ta namuna nizo" : "ta yakunlangan nizo"}
                </LocalizedText>
              </small>
            </span>
          </div>
        </div>
        <p className="profile-bio">{mediator.bio}</p>
        {mediator.registryUrl && (
          <a href={mediator.registryUrl} target="_blank" rel="noreferrer">
            <LocalizedText>Rasmiy reyestr · </LocalizedText>
            {mediator.certNumber}
          </a>
        )}
        <div className="profile-facts">
          <span>
            <MapPin size={17} />
            {mediator.region}
          </span>
          <span>
            <Award size={17} />
            {mediator.experience} <LocalizedText>yillik tajriba</LocalizedText>
          </span>
          <span>
            <Globe2 size={17} />
            {mediator.languages.join(", ")}
          </span>
          <span>
            <Video size={17} />
            <LocalizedText>Onlayn va yuzma-yuz</LocalizedText>
          </span>
        </div>
        <div className="mediator-tags profile-tags">
          {mediator.specializations.map((type) => (
            <span key={type}>{TYPE_LABELS[type]}</span>
          ))}
        </div>
        <div className="booking-price">
          <span>
            <LocalizedText>Soatlik xizmat narxi</LocalizedText>
            <strong>
              {money(mediator.hourlyRate)} <LocalizedText>so‘m</LocalizedText>
            </strong>
          </span>
          <small>
            <LocalizedText>
              Bir nizo uchun yakuniy xizmat haqi talab miqdori asosida
              hisoblanadi.
            </LocalizedText>
          </small>
        </div>
        <div className="mediator-availability">
          <h3>
            <LocalizedText>Qabul vaqtlari</LocalizedText>
          </h3>
          {availability.loading ? (
            <Loading />
          ) : availability.data?.published ? (
            <>
              <span className="category-pill">
                {availability.data.source === "DEMO"
                  ? "DEMO DATA"
                  : localizeText("Mediator e’lon qilgan jadval")}
              </span>
              <div className="availability-slots">
                {availability.data.slots
                  .filter((slot) => slot.available)
                  .slice(0, 8)
                  .map((slot) => (
                    <span key={slot.start}>
                      {fullDate(slot.start)} · {timeOf(slot.start)}
                    </span>
                  ))}
              </div>
            </>
          ) : (
            <p>
              <LocalizedText>
                Vaqt mediator bilan o‘zaro kelishiladi.
              </LocalizedText>
            </p>
          )}
        </div>
        <Button className="full-width" onClick={book}>
          <CalendarDays size={17} />
          <LocalizedText>Uchrashuv belgilash</LocalizedText>
        </Button>
      </Dialog>
      <BookingDialog
        open={bookingOpen}
        onOpenChange={setBookingOpen}
        mediator={mediator}
      />
    </>
  );
}
function BriefcaseIcon() {
  return <Award size={13} />;
}

export function BookingDialog({
  open,
  onOpenChange,
  mediator,
  caseId,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  mediator: Mediator;
  caseId?: string;
}) {
  const cases = useData<{ cases: CaseRecord[] }>(open ? "/api/cases" : null);
  const [selected, setSelected] = useState(caseId || "");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("14:00");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { toast, refresh } = useUI();
  useEffect(() => {
    if (open) {
      setSelected(caseId || "");
      setDate(
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Tashkent",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(Date.now() + 86400000)),
      );
      setError("");
    }
  }, [open, caseId]);
  const eligible =
    cases.data?.cases.filter(
      (record) =>
        record.userId !== mediator.userId &&
        mediator.specializations.includes(record.type) &&
        !["RESOLVED", "CLOSED", "ESCALATED", "SESSION_SCHEDULED"].includes(
          record.status,
        ) &&
        record.mediatorId === mediator.id &&
        (!record.mediation ||
          (hasMutualAppointment(record) &&
            !!record.mediation.procedureDocumentId)) &&
        !record.analysis.criminal,
    ) || [];
  const selectedCase = eligible.find((record) => record.id === selected);
  const fee = selectedCase
    ? selectedCase.claimAmount < 5000000
      ? 200000
      : selectedCase.claimAmount < 20000000
        ? 400000
        : 800000
    : 0;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/sessions", {
        method: "POST",
        body: JSON.stringify({
          caseId: selected,
          mediatorId: mediator.id,
          scheduledAt: `${date}T${time}:00+05:00`,
          duration: 60,
          type: "ONLINE",
        }),
      });
      toast("Mediatsiya sessiyasi belgilandi");
      refresh();
      onOpenChange(false);
      router.push(`/dashboard/cases/${selected}`);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={localizeText("Mediatsiya sessiyasini belgilash")}
      description={`${mediator.name} bilan 60 daqiqalik onlayn uchrashuv.`}
    >
      {cases.loading ? (
        <Loading />
      ) : eligible.length ? (
        <form onSubmit={submit} className="form-stack">
          <label>
            <LocalizedText>Nizoni tanlang</LocalizedText>
            <select
              required
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
            >
              <option value="">
                <LocalizedText>Nizoni tanlang</LocalizedText>
              </option>
              {eligible.map((record) => (
                <option key={record.id} value={record.id}>
                  {record.number} <LocalizedText>— </LocalizedText>
                  {record.title}
                </option>
              ))}
            </select>
          </label>
          <div className="form-two-cols">
            <label>
              <LocalizedText>Sana</LocalizedText>
              <input
                type="date"
                value={date}
                min={new Intl.DateTimeFormat("en-CA", {
                  timeZone: "Asia/Tashkent",
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                }).format(new Date())}
                onChange={(event) => setDate(event.target.value)}
                required
              />
            </label>
            <label>
              <LocalizedText>Vaqt</LocalizedText>
              <input
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                required
              />
            </label>
          </div>
          <div className="info-note">
            <Clock3 size={17} />
            <span>
              <LocalizedText>
                Toshkent vaqti (UTC+5). Uchrashuv havolasi nizo sahifasida
                ochiladi.
              </LocalizedText>
            </span>
          </div>
          {Boolean(fee) && (
            <div className="booking-price">
              <span>
                <LocalizedText>Nizo bo‘yicha xizmat haqi</LocalizedText>
                <strong>
                  {money(fee)} <LocalizedText>so‘m</LocalizedText>
                </strong>
              </span>
              <small>
                <LocalizedText>
                  Platforma ulushi 15%, mediator ulushi 85%. To‘lov holati
                  kelishuvdan so‘ng qayd etiladi.
                </LocalizedText>
              </small>
            </div>
          )}
          {error && (
            <p className="form-error" role="alert">
              <LocalizedText>{error}</LocalizedText>
            </p>
          )}
          <Button type="submit" disabled={busy || !selected}>
            {busy ? "Saqlanmoqda..." : "Sessiyani belgilash"}
            <CalendarDays size={16} />
          </Button>
        </form>
      ) : (
        <Empty
          title={localizeText("Mos faol nizo kerak")}
          description={localizeText(
            "Ushbu mediator yo‘nalishiga mos yangi nizo yarating yoki mavjud sessiyangizni ko‘ring.",
          )}
        >
          <Button asChild>
            <Link href="/dashboard/new" onClick={() => onOpenChange(false)}>
              <LocalizedText>Yangi nizo yaratish</LocalizedText>
            </Link>
          </Button>
        </Empty>
      )}
    </Dialog>
  );
}

export function Mediators() {
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [type, setType] = useState("");
  const [online, setOnline] = useState(false);
  const [language, setLanguage] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minRating, setMinRating] = useState("");
  const [published, setPublished] = useState(false);
  const [sort, setSort] = useState("rating");
  const { data, loading, error, reload } = useData<{ mediators: Mediator[] }>(
    "/api/mediators",
  );
  const filtered =
    data?.mediators
      .filter(
        (mediator) =>
          mediator.name.toLowerCase().includes(search.toLowerCase()) &&
          (!region || mediator.region === region) &&
          (!city ||
            normalizeCity(mediator.city).includes(normalizeCity(city))) &&
          (!type ||
            mediator.specializations.includes(
              type as keyof typeof TYPE_LABELS,
            )) &&
          (!online || mediator.isOnline) &&
          (!language || mediator.languages.includes(language)) &&
          (!maxPrice || mediator.hourlyRate <= Number(maxPrice)) &&
          (!minRating || mediator.rating >= Number(minRating)) &&
          (!published || mediator.demo || Boolean(mediator.availability)),
      )
      .sort((a, b) =>
        sort === "price" ? a.hourlyRate - b.hourlyRate : b.rating - a.rating,
      ) || [];
  return (
    <>
      <PageHeading
        title={localizeText("Kelishuv sari, birgalikda.")}
        description={localizeText(
          "Vaziyatingizni tushunadigan va yechim topishga yordam beradigan mediatorni tanlang.",
        )}
      >
        <Button variant="outline" asChild>
          <Link href="/auth/register?role=MEDIATOR">
            <LocalizedText>Mediator bo‘lib ro‘yxatdan o‘tish</LocalizedText>
          </Link>
        </Button>
      </PageHeading>
      <div className="directory-intro">
        <span>
          <UsersIcon />
          <strong>
            <LocalizedText>Professional yondashuv</LocalizedText>
          </strong>
          <small>
            <LocalizedText>Xolislik va tomonlar tengligi</LocalizedText>
          </small>
        </span>
        <span>
          <ShieldCheck size={23} />
          <strong>
            <LocalizedText>Maxfiy muloqot</LocalizedText>
          </strong>
          <small>
            <LocalizedText>Shifrlangan hujjatlar</LocalizedText>
          </small>
        </span>
        <span>
          <Video size={23} />
          <strong>
            <LocalizedText>Qulay uchrashuvlar</LocalizedText>
          </strong>
          <small>
            <LocalizedText>O‘zingizga mos vaqtni tanlang</LocalizedText>
          </small>
        </span>
      </div>
      <div className="panel directory-filters">
        <div className="search-field">
          <Search size={18} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={localizeText("Mediatorni qidirish")}
            aria-label={localizeText("Mediatorni qidirish")}
          />
        </div>
        <select
          value={type}
          onChange={(event) => setType(event.target.value)}
          aria-label={localizeText("Mutaxassislik")}
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
        <select
          value={region}
          onChange={(event) => setRegion(event.target.value)}
          aria-label={localizeText("Hudud")}
        >
          <option value="">
            <LocalizedText>Barcha hududlar</LocalizedText>
          </option>
          {REGIONS.map((region) => (
            <option key={region}>{region}</option>
          ))}
        </select>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={online}
            onChange={(event) => setOnline(event.target.checked)}
          />
          <LocalizedText>Hozir onlayn</LocalizedText>
        </label>
        <input
          value={city}
          onChange={(event) => setCity(event.target.value)}
          placeholder={localizeText("Shahar yoki tuman")}
          aria-label={localizeText("Shahar yoki tuman bo‘yicha qidirish")}
        />
      </div>
      <div className="panel directory-extra-filters">
        <label>
          <LocalizedText>Til</LocalizedText>
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          >
            <option value="">{localizeText("Barcha tillar")}</option>
            {[
              ...new Set(
                data?.mediators.flatMap((mediator) => mediator.languages) || [],
              ),
            ].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          <LocalizedText>Eng yuqori narx</LocalizedText>
          <input
            type="number"
            min={0}
            step={10000}
            value={maxPrice}
            onChange={(event) => setMaxPrice(event.target.value)}
            placeholder={localizeText("Cheklanmagan")}
          />
        </label>
        <label>
          <LocalizedText>Reyting</LocalizedText>
          <select
            value={minRating}
            onChange={(event) => setMinRating(event.target.value)}
          >
            <option value="">{localizeText("Barchasi")}</option>
            <option value="4">4+</option>
            <option value="4.5">4.5+</option>
          </select>
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={published}
            onChange={(event) => setPublished(event.target.checked)}
          />
          <LocalizedText>Jadvali e’lon qilingan</LocalizedText>
        </label>
      </div>
      <div className="list-meta">
        <p>
          <strong>{filtered.length}</strong>{" "}
          <LocalizedText>ta mediator</LocalizedText>{" "}
          <span>
            <LocalizedText>· Profil holati tafsilotlarda</LocalizedText>
          </span>
        </p>
        <label>
          <LocalizedText>Saralash</LocalizedText>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="rating">
              <LocalizedText>Reyting bo‘yicha</LocalizedText>
            </option>
            <option value="price">
              <LocalizedText>Narx bo‘yicha</LocalizedText>
            </option>
          </select>
        </label>
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} retry={reload} />
      ) : filtered.length ? (
        <div className="mediator-grid directory-grid">
          {filtered.map((mediator) => (
            <MediatorCard key={mediator.id} mediator={mediator} />
          ))}
        </div>
      ) : (
        <div className="panel">
          <Empty
            title={localizeText("Mediator topilmadi")}
            description={localizeText(
              "Boshqa yo‘nalish yoki hududni tanlab ko‘ring.",
            )}
          >
            <Button
              variant="outline"
              onClick={() => {
                setSearch("");
                setRegion("");
                setType("");
                setOnline(false);
              }}
            >
              <LocalizedText>Filtrlarni tozalash</LocalizedText>
            </Button>
          </Empty>
        </div>
      )}
      <div className="directory-note">
        <ShieldCheck size={17} />
        <p>
          <LocalizedText>
            Mahalliy demo profillari, reytinglar va narxlar platforma
            imkoniyatlarini ko‘rsatish uchun kiritilgan.
          </LocalizedText>
        </p>
      </div>
    </>
  );
}
function UsersIcon() {
  return <Award size={23} />;
}

export function MediatorAvailabilityEditor({
  mediator,
}: {
  mediator: Mediator;
}) {
  const { user } = useProfile();
  const { toast } = useUI();
  const [weekdays, setWeekdays] = useState(
    mediator.availability?.weekdays || [1, 2, 3, 4, 5],
  );
  const [startHour, setStartHour] = useState(
    mediator.availability?.startHour ?? 9,
  );
  const [endHour, setEndHour] = useState(mediator.availability?.endHour ?? 17);
  const [busy, setBusy] = useState(false);
  if (user.role !== "MEDIATOR") return null;
  return (
    <section className="panel workbench-panel">
      <div className="section-heading">
        <h2>
          <Clock3 size={20} />
          <LocalizedText>Qabul jadvalini e’lon qilish</LocalizedText>
        </h2>
      </div>
      <form
        className="form-stack panel-body"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          try {
            await api("/api/mediator/availability", {
              method: "POST",
              body: JSON.stringify({
                weekdays,
                startHour,
                endHour,
                duration: 60,
              }),
            });
            toast(localizeText("Jadval e’lon qilindi"));
          } catch (error) {
            toast((error as Error).message, "error");
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset className="availability-weekdays">
          {[
            "Yakshanba",
            "Dushanba",
            "Seshanba",
            "Chorshanba",
            "Payshanba",
            "Juma",
            "Shanba",
          ].map((day, index) => (
            <label key={day}>
              <input
                type="checkbox"
                checked={weekdays.includes(index)}
                onChange={(event) =>
                  setWeekdays((current) =>
                    event.target.checked
                      ? [...current, index]
                      : current.filter((value) => value !== index),
                  )
                }
              />
              {localizeText(day)}
            </label>
          ))}
        </fieldset>
        <div className="form-two-cols">
          <label>
            <LocalizedText>Boshlanish soati</LocalizedText>
            <input
              type="number"
              required
              min={0}
              max={22}
              value={startHour}
              onChange={(event) => setStartHour(Number(event.target.value))}
            />
          </label>
          <label>
            <LocalizedText>Tugash soati</LocalizedText>
            <input
              type="number"
              required
              min={1}
              max={23}
              value={endHour}
              onChange={(event) => setEndHour(Number(event.target.value))}
            />
          </label>
        </div>
        <p>
          <LocalizedText>
            Toshkent vaqti. Har bir sessiya 60 daqiqa, band vaqtlar navbatda
            ajratiladi.
          </LocalizedText>
        </p>
        <Button
          disabled={busy || !weekdays.length || endHour <= startHour}
          type="submit"
        >
          <LocalizedText>Jadvalni saqlash</LocalizedText>
        </Button>
      </form>
    </section>
  );
}
