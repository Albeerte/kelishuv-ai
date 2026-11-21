"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  Eye,
  EyeOff,
  HeartHandshake,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Brand } from "../shared";
import { Button } from "../ui/button";
import { LocaleSwitcher, T, useI18n } from "@/lib/i18n";
import { api } from "@/lib/utils";

export function AuthPage({ register }: { register: boolean }) {
  const { t } = useI18n();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState("CITIZEN");
  const [accountType, setAccountType] = useState<
    "PERSON" | "ORGANIZATION" | "BANK"
  >("PERSON");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [nextPath, setNextPath] = useState("");
  const [created, setCreated] = useState(false);
  const submitting = useRef(false);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const next = query.get("next") || "";
    if (/^\/invite\/[a-f0-9]{64}$/.test(next)) setNextPath(next);
    if (query.get("role") === "MEDIATOR") setRole("MEDIATOR");
    if (query.get("role") === "ORGANIZATION") {
      setRole("ORGANIZATION");
      setAccountType("ORGANIZATION");
    }
  }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (register && step === 1) {
      setStep(2);
      return;
    }
    if (submitting.current) return;
    submitting.current = true;
    const credentials = { email: register ? phone || email : email, password };
    setBusy(true);
    setError("");
    try {
      let authenticated = false;
      if (register && !created) {
        try {
          await api("/api/auth/register", {
            method: "POST",
            body: JSON.stringify({
              password,
              email: email || undefined,
              phone,
              fullName,
              role,
              accountType,
              organizationName:
                accountType === "PERSON" ? undefined : organizationName,
              acceptTerms: accepted,
              termsVersion: "kelishuv-mvp-2026-11-v1",
            }),
          });
          setCreated(true);
        } catch (registrationError) {
          // Authentication recovers an account committed before a response was lost.
          const recovered = await signIn("credentials", {
            ...credentials,
            redirect: false,
          });
          if (!recovered?.ok) throw registrationError;
          authenticated = true;
          setCreated(true);
        }
      }
      if (!authenticated) {
        const login = await signIn("credentials", {
          ...credentials,
          redirect: false,
        });
        if (!login?.ok)
          throw new Error(
            t("Email yoki parolni tekshirib, qayta urinib ko‘ring."),
          );
      }
      const profile = await api<{ user: { id: string; role: string } }>(
        "/api/auth/me",
      );
      if (register) {
        try {
          sessionStorage.setItem(`kelishuv-onboarding-${profile.user.id}`, "1");
        } catch {
          /* Browser storage is optional. */
        }
      }
      window.location.assign(
        nextPath ||
          (register ? "/verify" : "") ||
          (register && profile.user.role === "MEDIATOR" ? "/mediator" : "/"),
      );
    } catch (error) {
      setError((error as Error).message);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  const roles = [
    {
      role: "CITIZEN",
      icon: UserRound,
      label: "Shaxsiy muammomni hal qilmoqchiman",
      text: "O‘zim yoki oilam bilan bog‘liq masala uchun",
    },
    {
      role: "ORGANIZATION",
      icon: BriefcaseBusiness,
      label: "Biznesim uchun foydalanmoqchiman",
      text: "Tashkilot, hamkor yoki mijoz bilan kelishmovchilik",
    },
    {
      role: "MEDIATOR",
      icon: HeartHandshake,
      label: "Mediator sifatida ishlamoqchiman",
      text: "Taraflarga professional yordam berish uchun",
    },
  ];
  return (
    <main className="friendly-auth">
      <aside className="friendly-auth-story">
        <Brand href="/welcome" />
        <div>
          <h1>
            <T>Kelishuv suhbatdan boshlanadi.</T>
          </h1>
          <p>
            <T>
              Har bir vaziyatning o‘z hikoyasi bor. Sizni tinglashdan
              boshlaymiz.
            </T>
          </p>
          <Image
            src="/images/mediation-meeting.png"
            sizes="(max-width: 700px) 1px, 45vw"
            width={560}
            height={420}
            alt=""
          />
        </div>
        <p className="friendly-privacy-note">
          <ShieldCheck size={18} />
          <T>Ishtirok ixtiyoriy. Ma’lumotlar shifrlangan holda saqlanadi.</T>
        </p>
      </aside>
      <section className="friendly-auth-main">
        <div className="friendly-auth-top">
          <Link href="/welcome" className="quiet-link">
            <ArrowLeft size={17} />
            <T>Bosh sahifaga</T>
          </Link>
          <LocaleSwitcher />
        </div>
        <div className="friendly-auth-form">
          <header>
            <p className="auth-step-label">
              {register && (
                <>
                  <T>Hisob yaratish</T> · {step}/2
                </>
              )}
            </p>
            <h2>
              <T>
                {register
                  ? step === 1
                    ? "Platformadan qanday foydalanmoqchisiz?"
                    : "Tanishing, bu sizning hisobingiz."
                  : "Yana ko‘rishganimizdan xursandmiz."}
              </T>
            </h2>
            <p>
              <T>
                {register
                  ? step === 1
                    ? "Sizga mos jarayonni tanlaymiz."
                    : "Boshlash uchun bir nechta ma’lumot yetarli."
                  : "Ishlaringizni davom ettirish uchun hisobingizga kiring."}
              </T>
            </p>
          </header>
          <form className="form-stack" onSubmit={submit}>
            {register && step === 1 ? (
              <>
                <div className="friendly-role-options">
                  {roles.map((item) => (
                    <button
                      key={item.role}
                      type="button"
                      aria-pressed={role === item.role}
                      className={role === item.role ? "selected" : ""}
                      onClick={() => {
                        setRole(item.role);
                        setAccountType(
                          item.role === "ORGANIZATION"
                            ? "ORGANIZATION"
                            : "PERSON",
                        );
                      }}
                    >
                      <item.icon size={24} strokeWidth={1.5} />
                      <span>
                        <strong>
                          <T>{item.label}</T>
                        </strong>
                        <small>
                          <T>{item.text}</T>
                        </small>
                      </span>
                      <span className="selection-check">
                        {role === item.role && <Check size={15} />}
                      </span>
                    </button>
                  ))}
                </div>
                <Button type="submit" className="full-width">
                  <T>Davom etish</T>
                  <ArrowRight size={18} />
                </Button>
              </>
            ) : (
              <>
                {register && (
                  <>
                    <button
                      type="button"
                      className="quiet-link"
                      disabled={busy || created}
                      onClick={() => setStep(1)}
                    >
                      <ArrowLeft size={16} />
                      <T>Foydalanish turini o‘zgartirish</T>
                    </button>
                    <label>
                      <T>To‘liq ism</T>
                      <input
                        required
                        minLength={3}
                        maxLength={100}
                        value={fullName}
                        readOnly={created || busy}
                        onChange={(event) => setFullName(event.target.value)}
                        autoComplete="name"
                        placeholder={t("Ism va familiyangiz")}
                      />
                    </label>
                    <label>
                      <T>Telefon raqami</T>
                      <input
                        type="tel"
                        required
                        aria-label={t("Telefon raqami")}
                        aria-describedby="phone-guidance"
                        value={phone}
                        maxLength={30}
                        pattern={"[+0-9\\s\\(\\)\\-]{9,30}"}
                        autoComplete="tel"
                        placeholder="+998 90 123 45 67"
                        readOnly={created || busy}
                        onChange={(event) => setPhone(event.target.value)}
                      />
                      <small id="phone-guidance">
                        <T>
                          SMS orqali tasdiqlash hisob yaratilgach bajariladi.
                        </T>
                      </small>
                    </label>
                    {role === "ORGANIZATION" && (
                      <>
                        <label>
                          <T>Hisob turi</T>
                          <select
                            value={accountType}
                            disabled={created || busy}
                            onChange={(event) =>
                              setAccountType(
                                event.target.value as "ORGANIZATION" | "BANK",
                              )
                            }
                          >
                            <option value="ORGANIZATION">
                              {t("Tashkilot")}
                            </option>
                            <option value="BANK">{t("Bank")}</option>
                          </select>
                        </label>
                        <label>
                          <T>Tashkilot yoki bank nomi</T>
                          <input
                            required
                            minLength={2}
                            maxLength={200}
                            value={organizationName}
                            readOnly={created || busy}
                            onChange={(event) =>
                              setOrganizationName(event.target.value)
                            }
                            autoComplete="organization"
                          />
                        </label>
                      </>
                    )}
                  </>
                )}
                <label>
                  <T>
                    {register
                      ? "Email manzil, ixtiyoriy"
                      : "Telefon raqami yoki email"}
                  </T>
                  <input
                    type={register ? "email" : "text"}
                    required={!register}
                    maxLength={200}
                    value={email}
                    readOnly={created || busy}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete={register ? "email" : "username"}
                    placeholder={
                      register ? "siz@example.com" : "+998 90 123 45 67"
                    }
                  />
                </label>
                <label>
                  <T>Parol</T>
                  <div className="password-input">
                    <input
                      required
                      type={visible ? "text" : "password"}
                      aria-label={t("Parol")}
                      aria-describedby={
                        register ? "password-guidance" : undefined
                      }
                      minLength={register ? 8 : 1}
                      maxLength={128}
                      readOnly={busy}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete={
                        register ? "new-password" : "current-password"
                      }
                    />
                    <button
                      type="button"
                      aria-label={t(
                        visible ? "Parolni yashirish" : "Parolni ko‘rsatish",
                      )}
                      onClick={() => setVisible(!visible)}
                    >
                      {visible ? <EyeOff size={19} /> : <Eye size={19} />}
                    </button>
                  </div>
                  {register && (
                    <small id="password-guidance">
                      <T>
                        Kamida 8 belgi. Boshqa xizmatdagi parolingizdan farqli
                        parol tanlang.
                      </T>
                    </small>
                  )}
                </label>
                {register && (
                  <label className="consent-checkbox">
                    <input
                      type="checkbox"
                      required
                      disabled={busy || created}
                      checked={accepted}
                      onChange={(event) => setAccepted(event.target.checked)}
                    />
                    <span>
                      <Link href="/privacy" target="_blank">
                        <T>Maxfiylik siyosati</T>
                      </Link>
                      <T> va </T>
                      <Link href="/terms" target="_blank">
                        <T>foydalanish shartlari</T>
                      </Link>
                      <T> bilan tanishdim va roziman.</T>
                    </span>
                  </label>
                )}
                {error && (
                  <p className="form-error" role="alert">
                    <T>{error}</T>
                  </p>
                )}
                {created && (
                  <p>
                    <T>
                      Hisobingiz yaratildi. Kirishni qayta urinib ko‘rishingiz
                      mumkin.
                    </T>
                  </p>
                )}
                <Button className="full-width" type="submit" disabled={busy}>
                  {busy
                    ? t("Kutilmoqda...")
                    : register && !created
                      ? t("Hisob yaratish")
                      : t("Hisobga kirish")}
                  <ArrowRight size={18} />
                </Button>
                {register && role === "MEDIATOR" && (
                  <p className="friendly-privacy-note">
                    <ShieldCheck size={18} />
                    <T>
                      Profil va guvohnomangiz administrator ko‘rigidan keyin ish
                      qabul qilishingiz mumkin.
                    </T>
                  </p>
                )}
              </>
            )}
          </form>
          <p className="friendly-auth-switch">
            <T>{register ? "Hisobingiz bormi?" : "Hali hisobingiz yo‘qmi?"}</T>{" "}
            <Link
              href={`${register ? "/auth/login" : "/auth/register"}${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`}
            >
              <T>{register ? "Kirish" : "Ro‘yxatdan o‘tish"}</T>
            </Link>
          </p>
        </div>
        <footer>
          © {new Date().getFullYear()} <T>KELISHUV AI</T>{" "}
          <Link href="/privacy">
            <T>Maxfiylik</T>
          </Link>
        </footer>
      </section>
    </main>
  );
}
