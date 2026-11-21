"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  HeartHandshake,
  Landmark,
  LockKeyhole,
  Menu,
  MessageCircle,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { Brand } from "../shared";
import { Button } from "../ui/button";
import { LocaleSwitcher, T, useI18n } from "@/lib/i18n";
import { courtCosts, mediationFee } from "@/lib/legal";
import { money } from "@/lib/utils";

const comparisonAmount = 50_000_000;
const comparisonMediationFee = mediationFee(comparisonAmount).total;
const comparisonCourtFee = courtCosts(comparisonAmount, "FUQAROLIK").stateFee;

const faqs = [
  [
    "Mediatsiya nima?",
    "Mediatsiya — taraflar xolis mediator ko‘magida o‘zaro maqbul yechimni muhokama qiladigan ixtiyoriy jarayon. Yakuniy qarorni taraflar qabul qiladi.",
  ],
  [
    "Suddan qanday farq qiladi?",
    "Mediatsiyada taraflar yechimni o‘zlari kelishadi. Sudda ish tegishli tartibda ko‘rib chiqilib, sud qarori qabul qilinadi. Vaziyatingizga mos yo‘l hujjatlar va qonun asosida aniqlanadi.",
  ],
  [
    "AI qanday yordam beradi?",
    "AI bayon va ruxsat berilgan hujjatlarni tartiblaydi, yetishmayotgan ma’lumotni ko‘rsatadi va dastlabki takliflar tayyorlaydi. Huquqiy baho va yakuniy kelishuvni mediator bilan tekshirasiz.",
  ],
  [
    "Mening ma’lumotlarim maxfiymi?",
    "Ochiq va maxfiy ma’lumotlarni o‘zingiz belgilaysiz. Maxfiy bayon o‘zingiz va vakolatli mediatorga ochiladi. Hujjatlar shifrlanadi. Mahalliy va tashqi AI ishloviga alohida rozilik berasiz.",
  ],
  [
    "Mediator qanday tanlanadi?",
    "Shahar, yo‘nalish va til bo‘yicha profillarni ko‘rasiz. Ikkala taraf yo‘naltirishga rozilik bergach, mos mediator ishni qabul qiladi. Uni har ikki taraf alohida tasdiqlaydi. Namuna profillari belgilangan.",
  ],
  [
    "Xizmat qancha turadi?",
    "Mahalliy namuna muhitida dastlabki yordam bepul. Mediator xizmatining namuna hisobi talab summasiga qarab 200 000, 400 000 yoki 800 000 so‘m. Xizmat hajmi, sessiyalar va to‘lov shartlarini oldindan kelishasiz.",
  ],
  [
    "Kelishuv qanday rasmiylashtiriladi?",
    "Mediator shartlar, muddatlar va rekvizitlarni tekshiradi. Taraflar va mediator hujjatni navbat bilan tasdiqlaydi. Qo‘lda imzo PDFga joylashtiriladi. ERI va shaxsni davlat tizimida tekshirish ulanish holati alohida ko‘rsatiladi.",
  ],
];

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  return (
    <header className="friendly-header">
      <Brand href="/welcome" />
      <nav
        className={open ? "friendly-public-nav is-open" : "friendly-public-nav"}
        aria-label={t("Platforma haqida")}
      >
        {[
          ["/welcome#jarayon", "Qanday ishlaydi?"],
          ["/welcome#xizmatlar", "Xizmatlar"],
          ["/welcome#biznes", "Biznes uchun"],
          ["/about", "Biz haqimizda"],
        ].map(([href, label]) => (
          <Link key={href} href={href} onClick={() => setOpen(false)}>
            <T>{label}</T>
          </Link>
        ))}
      </nav>
      <div className="friendly-header-actions">
        <LocaleSwitcher />
        <Link className="public-login" href="/auth/login">
          <T>Kirish</T>
        </Link>
        <Button asChild>
          <Link href="/auth/register">
            <T>Ro‘yxatdan o‘tish</T>
          </Link>
        </Button>
        <button
          type="button"
          className="public-menu-toggle icon-button"
          aria-label={t(open ? "Menyuni yopish" : "Menyuni ochish")}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
    </header>
  );
}

export function PublicFooter() {
  const { t } = useI18n();
  return (
    <footer className="friendly-footer">
      <div>
        <Brand href="/welcome" />
        <p>
          <T>Kelishuvga birinchi qadamni birga qo‘yamiz.</T>
        </p>
        <small>© {new Date().getFullYear()} <T>KELISHUV AI</T></small>
      </div>
      <nav aria-label={t("Ma’lumotlar")}>
        {[
          ["/about", "Biz haqimizda"],
          ["/contact", "Bog‘lanish"],
          ["/privacy", "Maxfiylik siyosati"],
          ["/terms", "Foydalanish shartlari"],
          ["/legal", "Huquqiy ma’lumot"],
          ["/contact#channels", "Rasmiy kanallar"],
        ].map(([href, text]) => (
          <Link href={href} key={href}>
            <T>{text}</T>
          </Link>
        ))}
      </nav>
    </footer>
  );
}

export function LandingPage() {
  const { t } = useI18n();
  return (
    <div className="friendly-public">
      <a className="skip-link" href="#main">
        <T>Asosiy mazmunga o‘tish</T>
      </a>
      <PublicHeader />
      <main id="main">
        <section className="friendly-hero public-width">
          <div className="friendly-hero-copy">
            <h1>
              <T>
                Nizolarni sudgacha, tinch va o‘zaro kelishuv orqali hal qiling.
              </T>
            </h1>
            <p>
              <T>
                Muammoingizni tushuntiring. Vaziyatni tahlil qilish, yechimlarni
                ko‘rib chiqish va professional mediator bilan bog‘lanishda
                yordam beramiz.
              </T>
            </p>
            <div className="friendly-hero-actions">
              <Button asChild>
                <Link href="/auth/register">
                  <T>Ro‘yxatdan o‘tib boshlash</T>
                  <ArrowRight size={18} />
                </Link>
              </Button>
              <a href="#jarayon" className="quiet-link">
                <T>Qanday ishlaydi?</T>
                <ChevronDown size={16} />
              </a>
            </div>
            <ul className="friendly-reassurance">
              <li>
                <Check size={16} />
                <T>Ixtiyoriy ishtirok</T>
              </li>
              <li>
                <LockKeyhole size={16} />
                <T>Shifrlangan hujjatlar</T>
              </li>
              <li>
                <Users size={16} />
                <T>Mediator bilan suhbat</T>
              </li>
            </ul>
          </div>
          <div className="friendly-hero-art">
            <Image
              src="/images/mediation-meeting.png"
              width={1448}
              height={1086}
              alt={t(
                "Mediator ikki taraf bilan kelishuv shartlarini muhokama qilmoqda",
              )}
              priority
              sizes="(max-width: 700px) 100vw, 50vw"
              quality={85}
            />
          </div>
        </section>
        <section
          id="taqqoslash"
          className="friendly-comparison public-width"
          aria-labelledby="comparison-title"
        >
          <div className="friendly-section-heading">
            <h2 id="comparison-title">
              <T>Narx va vaqtni solishtiring.</T>
            </h2>
            <p>
              <T>Talab summasi</T>{" "}
              <strong>
                {money(comparisonAmount)} <T>so‘m</T>
              </strong>
              .{" "}
              <T>Fuqarolik sudiga beriladigan, boj imtiyozisiz mulkiy da’vo.</T>
            </p>
          </div>
          <div className="comparison-grid">
            <article
              className="comparison-mediation"
              aria-labelledby="mediation-comparison-title"
            >
              <header>
                <HeartHandshake
                  size={30}
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
                <h3 id="mediation-comparison-title">
                  <T>Mediatsiya</T>
                </h3>
              </header>
              <dl>
                <div className="comparison-metric">
                  <dt>
                    <T>Xizmat haqi</T>
                  </dt>
                  <dd>
                    <div className="comparison-value">
                      <strong>{money(comparisonMediationFee)}</strong>
                      <span>
                        <T>so‘m</T>
                      </span>
                    </div>
                    <p>
                      <T>
                        Platformadagi namuna tarifi. Yakuniy haq mediator bilan
                        kelishiladi.
                      </T>
                    </p>
                  </dd>
                </div>
                <div className="comparison-metric">
                  <dt>
                    <T>Asosiy muddat, ko‘pi bilan</T>
                  </dt>
                  <dd>
                    <div className="comparison-value comparison-duration">
                      <strong>30</strong>
                      <span>
                        <T>kun</T>
                      </span>
                    </div>
                    <p>
                      <T>
                        Kelishuv tuzilgan kundan. Taraflar roziligi bilan yana
                        30 kungacha uzaytirilishi mumkin.
                      </T>
                    </p>
                  </dd>
                </div>
              </dl>
              <a
                href="https://lex.uz/docs/-3805227"
                target="_blank"
                rel="noreferrer"
              >
                <T>Mediatsiya to‘g‘risidagi qonun, 23 va 28-moddalar</T>
              </a>
            </article>
            <article aria-labelledby="court-comparison-title">
              <header>
                <Landmark size={30} strokeWidth={1.5} aria-hidden="true" />
                <h3 id="court-comparison-title">
                  <T>Fuqarolik sudi</T>
                </h3>
              </header>
              <dl>
                <div className="comparison-metric">
                  <dt>
                    <T>Davlat boji</T>
                  </dt>
                  <dd>
                    <div className="comparison-value">
                      <strong>{money(comparisonCourtFee)}</strong>
                      <span>
                        <T>so‘m</T>
                      </span>
                    </div>
                    <p>
                      <T>
                        Talab summasining 4%i, kamida 1 BHM. Advokat, ekspertiza
                        va pochta xarajatlari alohida.
                      </T>
                    </p>
                  </dd>
                </div>
                <div className="comparison-metric">
                  <dt>
                    <T>Tayyorlash + ko‘rish, ko‘pi bilan</T>
                  </dt>
                  <dd>
                    <div className="comparison-timeline">
                      <span className="comparison-value comparison-duration">
                        <strong>10</strong>
                        <span>
                          <T>kun</T>
                        </span>
                      </span>
                      <span className="comparison-plus">+</span>
                      <span className="comparison-value comparison-duration">
                        <strong>1</strong>
                        <span>
                          <T>oy</T>
                        </span>
                      </span>
                    </div>
                    <p>
                      <T>
                        Ish qo‘zg‘atilgandan keyingi tayyorlash va ko‘rish.
                        Murakkab ishlarda muddatlar uzayishi mumkin.
                      </T>
                    </p>
                  </dd>
                </div>
              </dl>
              <div className="comparison-sources">
                <a
                  href="https://lex.uz/docs/-4680944"
                  target="_blank"
                  rel="noreferrer"
                >
                  <T>Davlat boji stavkalari</T>
                </a>
                <a
                  href="https://lex.uz/docs/-3517337?ONDATE=12.09.2026"
                  target="_blank"
                  rel="noreferrer"
                >
                  <T>FPK, 202 va 207-moddalar</T>
                </a>
              </div>
            </article>
          </div>
          <p className="comparison-note">
            <T>
              Muddatlar qonundagi asosiy bosqichlarni ko‘rsatadi. Arizani qabul
              qilish, apellyatsiya va ijro muddatlari alohida.
            </T>
          </p>
        </section>
        <section id="xizmatlar" className="friendly-services public-width">
          <div className="friendly-section-heading">
            <h2>
              <T>Har qanday kelishmovchilikni murakkablashtirish shart emas.</T>
            </h2>
            <p>
              <T>Vaziyatingizga yaqin yo‘nalishdan boshlang.</T>
            </p>
          </div>
          <div className="friendly-service-list">
            {[
              {
                icon: BriefcaseBusiness,
                title: "Biznesdagi kelishmovchiliklar",
                text: "Hamkorlik, to‘lov va shartnoma majburiyatlarini birgalikda ko‘rib chiqing.",
                type: "BIZNES",
              },
              {
                icon: HeartHandshake,
                title: "Shaxsiy va oilaviy nizolar",
                text: "Mol-mulk va o‘zaro majburiyatlar bo‘yicha mos yo‘lni mutaxassis bilan aniqlashtiring.",
                type: "OILA",
              },
              {
                icon: MessageCircle,
                title: "Xizmat yoki shartnoma nizolari",
                text: "Qarz, ijara, xizmat sifati yoki kelishilgan shartlar yuzasidan yordam oling.",
                type: "SHARTNOMA",
              },
            ].map((item) => (
              <Link
                className="friendly-service"
                href={`/dashboard/new?type=${item.type}`}
                key={item.type}
              >
                <span className="friendly-icon">
                  <item.icon size={25} strokeWidth={1.5} />
                </span>
                <h3>
                  <T>{item.title}</T>
                </h3>
                <p>
                  <T>{item.text}</T>
                </p>
                <ArrowRight size={20} />
              </Link>
            ))}
          </div>
        </section>
        <section id="jarayon" className="friendly-process-wrap">
          <div className="public-width">
            <div className="friendly-section-heading">
              <h2>
                <T>Qadam-baqadam, xotirjamlik bilan.</T>
              </h2>
              <p>
                <T>Har bosqichda nima qilish kerakligi tushunarli bo‘ladi.</T>
              </p>
            </div>
            <ol className="friendly-process">
              {[
                [
                  "Muammoingizni tushuntiring",
                  "Oddiy so‘zlar bilan yozing. Hujjatlarni keyin ham qo‘shishingiz mumkin.",
                ],
                [
                  "Dastlabki tahlilni ko‘ring",
                  "AI ma’lumotlarni tartiblaydi va aniqlashtiriladigan savollarni ko‘rsatadi.",
                ],
                [
                  "Keyingi qadamni tanlang",
                  "Mumkin bo‘lgan yechimlar va huquqiy yo‘llar bilan tanishing.",
                ],
                [
                  "Mediator bilan ishlang",
                  "Kerak bo‘lsa, taraflar tanlagan mediator bilan shartlarni kelishing.",
                ],
              ].map(([title, text], index) => (
                <li key={title}>
                  <span>{index + 1}</span>
                  <h3>
                    <T>{title}</T>
                  </h3>
                  <p>
                    <T>{text}</T>
                  </p>
                </li>
              ))}
            </ol>
            <p className="friendly-human-note">
              <Users size={20} />
              <T>
                AI dastlabki yordam beradi. Taraflar qaror qiladi, mediator
                jarayon va hujjatlarni tekshiradi.
              </T>
            </p>
          </div>
        </section>
        <section className="friendly-benefits public-width">
          <div>
            <h2>
              <T>Jarayon aniq bo‘lsa, keyingi qadam osonroq.</T>
            </h2>
            <p>
              <T>Kerakli ma’lumot va yordam bir joyda.</T>
            </p>
          </div>
          <ul>
            {[
              "Sodda va tushunarli jarayon",
              "Masofadan foydalanish imkoniyati",
              "Oldindan kelishiladigan narxlar",
              "Maxfiylikka e’tibor",
              "Mediator bilan insoniy muloqot",
              "Majburiyat va muddatlarni kuzatish",
            ].map((text) => (
              <li key={text}>
                <Check size={18} />
                <T>{text}</T>
              </li>
            ))}
          </ul>
        </section>
        <section id="narxlar" className="public-width friendly-pricing">
          <div className="friendly-section-heading">
            <h2>
              <T>Xarajatlarni oldindan bilib oling.</T>
            </h2>
            <p>
              <T>
                Har bir xizmatga rozilik berishdan oldin uning shartlari bilan
                tanishasiz.
              </T>
            </p>
          </div>
          <div className="friendly-price-grid">
            <article>
              <h3>
                <T>Dastlabki yordam</T>
              </h3>
              <strong>
                <T>Bepul</T>
              </strong>
              <p>
                <T>Ish ochish va dastlabki yo‘naltirish</T>
              </p>
              <ul>
                {[
                  "Muammoni yozish va hujjat yuklash",
                  "Dastlabki AI tahlili va yechim takliflari",
                  "Shaxsiy ish maydoni",
                ].map((text) => (
                  <li key={text}>
                    <Check size={17} />
                    <T>{text}</T>
                  </li>
                ))}
              </ul>
              <Link className="quiet-link" href="/auth/register">
                <T>Hisob ochish</T>
                <ArrowRight size={16} />
              </Link>
            </article>
            <article>
              <h3>
                <T>Hujjat namunalari</T>
              </h3>
              <strong>
                19 000{" "}
                <small>
                  <T>so‘mdan</T>
                </small>
              </strong>
              <ul>
                <li>
                  <T>Talabnoma</T> — 19 000 <T>so‘m</T>
                </li>
                <li>
                  <T>Mediatsiya arizasi</T> — 29 000 <T>so‘m</T>
                </li>
                <li>
                  <T>Da’vo loyihasi</T> — 49 000 <T>so‘m</T>
                </li>
              </ul>
              <p>
                <T>
                  AI bilan to‘ldirish va DOCX yuklash tanlangan hujjat tarifiga
                  kiradi. To‘lov provayderi ulanishini kutmoqda.
                </T>
              </p>
              <Link className="quiet-link" href="/auth/register">
                <T>Hisob ochish</T>
                <ArrowRight size={16} />
              </Link>
            </article>
            <article>
              <h3>
                <T>Mediator bilan ishlash</T>
              </h3>
              <strong>
                200 000{" "}
                <small>
                  <T>so‘mdan</T>
                </small>
              </strong>
              <p>
                <T>Namuna hisob-kitobi, nizo bo‘yicha</T>
              </p>
              <details>
                <summary>
                  <T>Summa qanday hisoblanadi?</T>
                </summary>
                <p>
                  <T>
                    Talab 5 mln so‘mdan kam bo‘lsa 200 000, 5 mln dan 20 mln
                    gacha 400 000, 20 mln va undan yuqori bo‘lsa 800 000 so‘m.
                    Xizmat hajmi va qo‘shimcha sessiyalar shartlari oldindan
                    kelishiladi.
                  </T>
                </p>
              </details>
              <p>
                <T>
                  Kelishuvga erishilmasa, to‘lov va davom ettirish shartlari
                  mediator bilan xizmat boshlanishidan oldin yozma belgilanadi.
                </T>
              </p>
              <Link className="quiet-link" href="/mediators">
                <T>Mediatorlarni ko‘rish</T>
                <ArrowRight size={16} />
              </Link>
            </article>
          </div>
        </section>
        <section id="biznes" className="friendly-business public-width">
          <BriefcaseBusiness size={40} strokeWidth={1.3} />
          <div>
            <h2>
              <T>Biznes munosabatlarini davom ettirishga yo‘l izlang.</T>
            </h2>
            <p>
              <T>
                Hamkor, mijoz yoki yetkazib beruvchi bilan kelishmovchilikni
                tartibli muhokama qiling. Tashkilot va banklar uchun alohida
                hisob mavjud.
              </T>
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/auth/register?role=ORGANIZATION">
              <T>Biznes uchun boshlash</T>
            </Link>
          </Button>
        </section>
        <section className="public-width friendly-faq">
          <div>
            <h2>
              <T>Savollaringiz bormi?</T>
            </h2>
            <p>
              <T>Boshlashdan oldin bilish foydali bo‘lgan javoblar.</T>
            </p>
            <Link className="quiet-link" href="/contact">
              <T>Biz bilan bog‘lanish</T>
              <ArrowRight size={16} />
            </Link>
          </div>
          <div>
            {faqs.map(([question, answer]) => (
              <details key={question}>
                <summary>
                  <T>{question}</T>
                  <ChevronDown size={18} />
                </summary>
                <p>
                  <T>{answer}</T>
                </p>
              </details>
            ))}
          </div>
        </section>
        <section className="friendly-final public-width">
          <h2>
            <T>Kelishmovchilikni hal qilishni bugun boshlang.</T>
          </h2>
          <p>
            <T>Birinchi qadam — vaziyatingizni tushuntirish.</T>
          </p>
          <Button asChild>
            <Link href="/auth/register">
              <T>Ro‘yxatdan o‘tib boshlash</T>
              <ArrowRight size={18} />
            </Link>
          </Button>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

const info = {
  "/about": {
    title: "Kelishuvga yordam beradigan xizmat",
    paragraphs: [
      "KELISHUV AI O‘zbekistondagi fuqarolar, tashkilotlar va mediatorlar uchun nizoni tartibli muhokama qilishga yordam beradi.",
      "Taraflar o‘z bayonlarini mustaqil kiritadi. AI dastlabki ma’lumotni tayyorlaydi, mediator hujjatlar va jarayonni ko‘rib chiqadi. Ishtirok va yakuniy qaror taraflarning o‘ziga bog‘liq.",
    ],
  },
  "/privacy": {
    title: "Ma’lumotlaringiz va maxfiylik",
    paragraphs: [
      "Hisob ma’lumotlari, bayonlar, dalillar va imzolar mahalliy shifrlangan omborda saqlanadi. Hisobga email va parol orqali kiriladi.",
      "Ochiq va maxfiy bayonlar alohida saqlanadi. Maxfiy ma’lumot o‘z egasi va ishga vakolatli mediatorga ko‘rinadi. Tashqi AIga yuborish uchun tegishli rozilik va provayder sozlamasi kerak. Rozilik tanlovini ish yakunlangach ham o‘zgartirish mumkin.",
      "Eksport, tuzatish va o‘chirish masalalari bo‘yicha profildagi murojaat formasidan foydalaning. Saqlash muddati ish hujjatlari va qonuniy majburiyatlar bilan birga ko‘rib chiqiladi.",
    ],
  },
  "/terms": {
    title: "Foydalanish shartlari",
    paragraphs: [
      "Ushbu mahalliy MVP nizo bayoni, mediator bilan muhokama, hujjat tayyorlash va majburiyatlarni kuzatish uchun xizmat qiladi. Namuna hisoblari, profillar va narxlar tegishli belgi bilan ko‘rsatiladi.",
      "Foydalanuvchi taqdim etgan ma’lumotini tekshiradi va boshqa shaxslarning ma’lumotlarini ulashish uchun tegishli asosga ega bo‘lishi kerak. Mediatsiyada ishtirok ixtiyoriy.",
      "Mediator xizmati hajmi, haq, to‘lov, qaytarish va qo‘shimcha sessiya shartlari xizmat boshlanishidan oldin taraflar bilan yozma kelishiladi. Kelishuv natijasi kafolatlanmaydi.",
      "Qo‘lda chizilgan imzo vizual qayd sifatida saqlanadi. Shaxsni aniqlash, ERI va hujjatni huquqiy rasmiylashtirish holati alohida tekshiriladi. Ushbu MVP shartlari ommaviy ishga tushirishdan oldin operator va yurist tomonidan yakunlanadi.",
    ],
  },
  "/legal": {
    title: "Huquqiy ma’lumot va manbalar",
    paragraphs: [
      "AI xulosasi dastlabki tavsiya sifatida beriladi. Vaziyatga mos huquqiy baho va hujjat shakli mediator yoki malakali mutaxassis bilan aniqlashtiriladi.",
      "Ilovadagi tanlangan qonun moddalari Lex.uz havolalari, tahrir va tekshirish sanasi bilan ko‘rsatiladi. Har bir ishga tatbiq etiladigan amaldagi tahrir tekshirilishi kerak.",
    ],
  },
  "/contact": {
    title: "Yordam kerak bo‘lsa, yozing",
    paragraphs: [
      "Texnik savol, mediator faoliyati yoki ma’lumotlaringiz yuzasidan murojaatni shaxsiy kabinetingiz orqali yuboring. Administrator javob va bajarilgan ishni qayd etadi.",
      "Shaxsiy ish tafsilotlari va maxfiy hujjatlarni faqat vakolatli ish maydonida ulashing.",
    ],
  },
};
export function PublicInfoPage({ path }: { path: keyof typeof info }) {
  const page = info[path];
  return (
    <div className="friendly-public">
      <PublicHeader />
      <main className="public-width public-info">
        <Link href="/welcome" className="quiet-link">
          <T>Bosh sahifaga qaytish</T>
        </Link>
        <h1>
          <T>{page.title}</T>
        </h1>
        {page.paragraphs.map((text) => (
          <p key={text}>
            <T>{text}</T>
          </p>
        ))}
        {path === "/contact" && (
          <>
            <Button asChild>
              <Link href="/settings">
                <T>Murojaat yozish</T>
              </Link>
            </Button>
            <section id="channels">
              <h2>
                <T>Rasmiy kanallar</T>
              </h2>
              <p>
                <T>
                  Ijtimoiy tarmoq va aloqa xizmatlari ushbu mahalliy muhitda
                  sozlanmagan. Murojaat formasidan foydalanishingiz mumkin.
                </T>
              </p>
            </section>
          </>
        )}
        {path === "/legal" && (
          <a
            className="quiet-link"
            href="https://lex.uz/docs/-3805227"
            target="_blank"
            rel="noreferrer"
          >
            <ShieldCheck size={18} />
            <T>Mediatsiya to‘g‘risidagi qonun</T>
          </a>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
