"use client";
import { T as LocalizedText, translate as localizeText } from "@/lib/i18n";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import {
  Bell,
  BookOpen,
  BriefcaseBusiness,
  Calculator,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Command,
  FileText,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  MessageCircle,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { Brand, ErrorState, Loading, Toasts } from "./shared";
import { Dialog } from "./ui/dialog";
import { Button } from "./ui/button";
import { useData } from "@/lib/use-data";
import { useUI } from "@/lib/client-store";
import { api, initials, shortDate } from "@/lib/utils";
import type {
  CaseRecord,
  LegalSource,
  Notification,
  PublicUser,
} from "@/lib/types";
import { Dashboard, CustomerPayments } from "./pages/customer";
import { Cases, CaseDetail } from "./pages/cases";
import { NewCase } from "./pages/guided-case";
import { Mediators } from "./pages/mediators";
import {
  CalculatorPage,
  ChatPage,
  DocumentsPage,
  HelpPage,
  LawsPage,
  SettingsPage,
} from "./pages/tools";
import { AuthPage } from "./pages/auth";
import { AdminPage, MediatorPanel } from "./pages/workspaces";
import { InvitationPage } from "./pages/mediation";
import { LandingPage, PublicInfoPage } from "./pages/friendly-public";
import {
  WorkspaceIndex,
  CaseWorkbench,
  NotificationsPage,
  IntegrationAdminPage,
} from "./pages/kelishuv";
import { LocaleSwitcher, translate, useI18n } from "@/lib/i18n";
import { AssistantWidget } from "./assistant";
import {
  IdentityPage,
  ServicePayments,
  TemplateStudio,
} from "./pages/services";

type Profile = {
  user: PublicUser;
  demo: boolean;
  localDemo: boolean;
  integrations: { ai: boolean; email: boolean; database: boolean };
};
const ProfileContext = createContext<Profile | null>(null);
export function useProfile() {
  const profile = useContext(ProfileContext);
  if (!profile) throw new Error("Profile context missing");
  return profile;
}
const citizenNavigation = [
  { href: "/", label: "Bosh sahifa", icon: LayoutDashboard },
  { href: "/dashboard", label: "Mening ishlarim", icon: BriefcaseBusiness },
  { href: "/room", label: "Xabarlar", icon: MessageCircle },
  { href: "/documents", label: "Hujjatlar", icon: FileText },
  { href: "/payments", label: "To‘lovlar", icon: Calculator },
  { href: "/settings", label: "Profil", icon: Users },
];
const mediatorNavigation = [
  { href: "/mediator", label: "Bosh sahifa", icon: LayoutDashboard },
  {
    href: "/mediator/cases",
    label: "Mening nizolarim",
    icon: BriefcaseBusiness,
  },
  { href: "/mediator/sessions", label: "Sessiyalar", icon: CalendarDays },
  { href: "/mediator/earnings", label: "Daromadlar", icon: Calculator },
  { href: "/room", label: "Mediatsiya xonasi", icon: MessageCircle },
  { href: "/agreements", label: "Shartnomalar", icon: BookOpen },
  { href: "/execution", label: "Ijro kuzatuvi", icon: Check },
  { href: "/notifications", label: "Bildirishnomalar", icon: Bell },
];
const adminNavigation = [
  { href: "/admin", label: "Umumiy ko‘rinish", icon: LayoutDashboard },
  { href: "/admin/cases", label: "Ishlar", icon: BriefcaseBusiness },
  { href: "/admin/users", label: "Foydalanuvchilar", icon: Users },
  { href: "/admin/mediators", label: "Mediatorlar", icon: ShieldCheck },
  { href: "/admin/payments", label: "To‘lovlar", icon: Calculator },
  { href: "/admin/reports", label: "Hisobotlar", icon: BookOpen },
  { href: "/admin/integrations", label: "Sozlamalar va audit", icon: Settings },
];
function renderPage(path: string) {
  if (path === "/") return <Dashboard />;
  if (path === "/payments")
    return (
      <>
        <ServicePayments />
        <CustomerPayments />
      </>
    );
  if (path === "/verify") return <IdentityPage />;
  if (path === "/analysis") return <WorkspaceIndex mode="analysis" />;
  if (path === "/agreements") return <WorkspaceIndex mode="agreements" />;
  if (path === "/execution") return <WorkspaceIndex mode="execution" />;
  if (path === "/room") return <WorkspaceIndex mode="room" />;
  if (path === "/notifications") return <NotificationsPage />;
  if (path === "/admin/integrations") return <IntegrationAdminPage />;
  if (path === "/dashboard/new") return <NewCase />;
  if (path.startsWith("/dashboard/cases/")) {
    const id = path.split("/")[3];
    if (path.includes("/workbench")) return <CaseWorkbench key={id} caseId={id} />;
    return path.endsWith("/chat") ? (
      <ChatPage caseId={id} />
    ) : (
      <CaseDetail key={id} id={id} />
    );
  }
  if (path === "/dashboard") return <Cases />;
  if (path === "/mediators") return <Mediators />;
  if (path === "/laws") return <LawsPage />;
  if (path === "/documents")
    return (
      <>
        <TemplateStudio />
        <DocumentsPage />
      </>
    );
  if (path === "/assistant") return <AssistantWidget fullPage />;
  if (path === "/calculator") return <CalculatorPage />;
  if (path === "/help" || path === "/how-it-works") return <HelpPage />;
  if (path === "/settings") return <SettingsPage />;
  if (path === "/mediator/earnings")
    return (
      <>
        <ServicePayments />
        <MediatorPanel path={path} />
      </>
    );
  if (path === "/admin/payments")
    return (
      <>
        <ServicePayments />
        <AdminPage path={path} />
      </>
    );
  if (path.startsWith("/mediator")) return <MediatorPanel path={path} />;
  if (path.startsWith("/admin")) return <AdminPage path={path} />;
  return (
    <ErrorState message="Sahifa topilmadi. Menyudan kerakli bo‘limni tanlang." />
  );
}

export function Application() {
  useI18n();
  const pathname = usePathname();
  const isAuth = pathname.startsWith("/auth/");
  const infoPath = [
    "/about",
    "/contact",
    "/privacy",
    "/terms",
    "/legal",
  ].includes(pathname);
  const isPublic =
    pathname === "/welcome" || infoPath || pathname.startsWith("/invite/");
  const profile = useData<Profile>(isAuth || isPublic ? null : "/api/auth/me");
  if (infoPath)
    return (
      <>
        <PublicInfoPage
          path={
            pathname as "/about" | "/contact" | "/privacy" | "/terms" | "/legal"
          }
        />
        <AssistantWidget />
      </>
    );
  if (pathname === "/welcome")
    return (
      <>
        <LandingPage />
        <AssistantWidget />
        <Toasts />
      </>
    );
  if (pathname.startsWith("/invite/"))
    return (
      <>
        <InvitationPage token={pathname.split("/")[2]} />
        <AssistantWidget />
        <Toasts />
      </>
    );
  if (isAuth)
    return (
      <>
        <AuthPage register={pathname === "/auth/register"} />
        <AssistantWidget />
        <Toasts />
      </>
    );
  if (profile.loading && !profile.data)
    return (
      <div className="initial-loading">
        <Brand />
        <Loading label={localizeText("Shaxsiy kabinetingiz ochilmoqda")} />
      </div>
    );
  if (profile.error || !profile.data)
    return (
      <div className="initial-loading">
        <Brand />
        <ErrorState message={profile.error} retry={profile.reload} />
        <Button asChild>
          <Link href="/auth/login">
            <LocalizedText>Hisobga kirish</LocalizedText>
          </Link>
        </Button>
      </div>
    );
  return (
    <ProfileContext.Provider value={profile.data}>
      <Shell pathname={pathname} /> <Toasts />
      {pathname !== "/assistant" && <AssistantWidget />}
    </ProfileContext.Provider>
  );
}

function Shell({ pathname }: { pathname: string }) {
  const profile = useProfile();
  const { user } = profile;
  const creatingCase = pathname === "/dashboard/new";
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const notifications = useData<{ notifications: Notification[] }>(
    "/api/notifications",
  );
  const counts = useData<{ cases: CaseRecord[] }>("/api/cases");
  const navigation = [
    ...(user.role === "ADMIN"
      ? adminNavigation
      : user.role === "MEDIATOR"
        ? mediatorNavigation
        : citizenNavigation),
    { href: "/assistant", label: "AI yordamchi", icon: Sparkles },
  ];
  const active = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href ||
        (href === "/dashboard" && pathname.startsWith("/dashboard/"));
  const current = pathname.includes("/new")
    ? "Yangi nizo"
    : pathname.includes("/cases/")
      ? "Nizo tafsilotlari"
      : [
          ...navigation,
          { href: "/calculator", label: "Sud kalkulyatori" },
          { href: "/settings", label: "Sozlamalar" },
          { href: "/help", label: "Yordam markazi" },
        ].find((item) => active(item.href))?.label || "Shaxsiy kabinet";
  useEffect(() => {
    setMenuOpen(false);
    setNotificationOpen(false);
    setProfileOpen(false);
  }, [pathname]);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
  const unread = notifications.data?.notifications.some((item) => !item.read);
  return (
    <div
      className={`app-shell friendly-shell ${["ADMIN", "MEDIATOR"].includes(user.role) ? "professional-shell" : "customer-shell"}${creatingCase ? " case-creation-shell" : ""}`}
    >
      {menuOpen && (
        <button
          className="mobile-scrim"
          onClick={() => setMenuOpen(false)}
          aria-label={localizeText("Menyuni yopish")}
        />
      )}
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <Brand />
          <button
            className="mobile-close icon-button"
            onClick={() => setMenuOpen(false)}
            aria-label={localizeText("Menyuni yopish")}
          >
            <X size={21} />
          </button>
        </div>
        <div className="workspace-label">
          <span className="workspace-icon">
            <ShieldCheck size={15} />
          </span>
          {user.role === "MEDIATOR"
            ? "Mediator kabineti"
            : user.role === "ADMIN"
              ? "Boshqaruv paneli"
              : "Shaxsiy kabinet"}
          <ChevronDown size={14} />
        </div>
        <nav
          className="main-navigation"
          aria-label={localizeText("Asosiy menyu")}
        >
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${active(item.href) ? "active" : ""}`}
            >
              <item.icon size={19} strokeWidth={1.7} />
              <span>{translate(item.label)}</span>
              {"badge" in item && (
                <small className="nav-ai">
                  <LocalizedText>AI</LocalizedText>
                </small>
              )}
              {item.href === "/dashboard" &&
                Boolean(counts.data?.cases.length) && (
                  <small className="nav-count">
                    {counts.data?.cases.length}
                  </small>
                )}
            </Link>
          ))}
          {user.role === "MEDIATOR" && (
            <>
              <div className="nav-divider" />
              <Link
                className={`nav-item ${pathname === "/calculator" ? "active" : ""}`}
                href="/calculator"
              >
                <Calculator size={19} strokeWidth={1.7} />
                <span>
                  <LocalizedText>Sud kalkulyatori</LocalizedText>
                </span>
              </Link>
              <Link
                className={`nav-item ${pathname === "/help" ? "active" : ""}`}
                href="/help"
              >
                <CircleHelp size={19} strokeWidth={1.7} />
                <span>
                  <LocalizedText>Yordam markazi</LocalizedText>
                </span>
              </Link>
            </>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-help">
            <span className="help-bubble">
              <MessageCircle size={21} />
            </span>
            <h3>
              <LocalizedText>Yolg‘iz emassiz.</LocalizedText>
            </h3>
            <p>
              <LocalizedText>Huquqiy savollaringizga</LocalizedText>
              <br />
              <LocalizedText>birgalikda javob topamiz.</LocalizedText>
            </p>
            <Link href="/assistant">
              <LocalizedText>Yordam olish</LocalizedText>
              <ChevronRight size={15} />
            </Link>
          </div>
          {user.role === "MEDIATOR" && (
            <Link
              className={`nav-item settings-link ${pathname === "/settings" ? "active" : ""}`}
              href="/settings"
            >
              <Settings size={18} />
              <span>
                <LocalizedText>Sozlamalar</LocalizedText>
              </span>
            </Link>
          )}
          <div className="sidebar-user">
            <span className="avatar avatar-gold">
              {initials(user.fullName)}
            </span>
            <span>
              <strong>{user.fullName}</strong>
              <small>{profile.demo ? "Namuna hisobi" : "Shaxsiy hisob"}</small>
            </span>
            <Link
              className="sidebar-user-chevron"
              href="/settings"
              aria-label={localizeText("Hisob sozlamalari")}
            >
              <ChevronRight size={17} />
            </Link>
          </div>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumb">
            {creatingCase ? (
              <Brand />
            ) : (
              <>
                <button
                  className="mobile-menu icon-button"
                  aria-label={localizeText("Menyuni ochish")}
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen(true)}
                >
                  <Menu size={23} />
                </button>
                <span className="breadcrumb-home">
                  <LocalizedText>Shaxsiy kabinet</LocalizedText>
                </span>
                <ChevronRight size={13} />
                <strong>{translate(current)}</strong>
              </>
            )}
          </div>
          <div className="topbar-actions">
            <button
              aria-label={localizeText("Platformada qidirish")}
              className="global-search"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={16} />
              <span>
                <LocalizedText>Qidirish...</LocalizedText>
              </span>
              <kbd>
                <Command size={10} /> <LocalizedText>K</LocalizedText>
              </kbd>
            </button>
            <LocaleSwitcher />
            <span className="topbar-divider" />
            <div className="popover-anchor">
              <button
                className={`icon-button notification-trigger ${notificationOpen ? "selected" : ""}`}
                aria-label={localizeText("Bildirishnomalar")}
                aria-expanded={notificationOpen}
                onClick={() => {
                  setNotificationOpen((value) => !value);
                  setProfileOpen(false);
                }}
              >
                {unread && <i />}
                <Bell size={20} strokeWidth={1.7} />
              </button>
              {notificationOpen && (
                <div className="header-popover notification-popover">
                  <div className="popover-title">
                    <h3>
                      <LocalizedText>Bildirishnomalar</LocalizedText>
                    </h3>
                    <button
                      onClick={async () => {
                        try {
                          await api("/api/notifications", { method: "PUT" });
                          notifications.reload();
                        } catch (error) {
                          useUI
                            .getState()
                            .toast((error as Error).message, "error");
                        }
                      }}
                      aria-label={localizeText(
                        "Barchasini o‘qilgan deb belgilash",
                      )}
                    >
                      <Check size={17} />
                    </button>
                  </div>
                  {notifications.data?.notifications.length ? (
                    notifications.data.notifications.slice(0, 6).map((item) => (
                      <Link
                        key={item.id}
                        href={item.href}
                        className={`notification-item ${item.read ? "" : "unread"}`}
                      >
                        <span className="notification-symbol">
                          <CalendarDays size={17} />
                        </span>
                        <div>
                          <strong>{item.title}</strong>
                          <p>{item.body}</p>
                          <small>{shortDate(item.createdAt)}</small>
                        </div>
                      </Link>
                    ))
                  ) : (
                    <p className="popover-empty">
                      <LocalizedText>
                        Yangi bildirishnomalar yo‘q.
                      </LocalizedText>
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="popover-anchor">
              <button
                className="profile-trigger"
                onClick={() => {
                  setProfileOpen((value) => !value);
                  setNotificationOpen(false);
                }}
                aria-label={localizeText("Hisob menyusi")}
                aria-expanded={profileOpen}
              >
                <span className="avatar avatar-photo">
                  {initials(user.fullName)}
                </span>
                <ChevronDown size={13} />
              </button>
              {profileOpen && (
                <div className="header-popover profile-popover">
                  <strong>{user.fullName}</strong>
                  <small>
                    {profile.demo
                      ? "Mahalliy demo"
                      : user.email.endsWith("@phone.kelishuv.local")
                        ? user.phone
                        : user.email}
                  </small>
                  <Link href="/settings">
                    <Settings size={16} />
                    <LocalizedText>Hisob sozlamalari</LocalizedText>
                  </Link>
                  <Link href="/help">
                    <CircleHelp size={16} />
                    <LocalizedText>Yordam markazi</LocalizedText>
                  </Link>
                  {profile.demo ? (
                    <Link href="/auth/login">
                      <LogIn size={16} />
                      <LocalizedText>Hisobga kirish</LocalizedText>
                    </Link>
                  ) : (
                    <button
                      onClick={() => signOut({ callbackUrl: "/auth/login" })}
                    >
                      <LogOut size={16} />
                      <LocalizedText>Chiqish</LocalizedText>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="page-content" key={pathname}>
          {renderPage(pathname)}
        </main>
        <footer className="app-footer">
          <span>
            <LocalizedText>© </LocalizedText>
            {new Date().getFullYear()}{" "}
            <LocalizedText>KELISHUV AI</LocalizedText>
          </span>
          <span>
            <ShieldCheck size={13} />
            <LocalizedText>
              Huquqiy ma’lumot. Individual maslahat uchun advokatga murojaat
              qiling.
            </LocalizedText>
          </span>
          <Link href="/help#privacy">
            <LocalizedText>Maxfiylik</LocalizedText>
          </Link>
        </footer>
      </div>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}

function SearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const router = useRouter();
  const cases = useData<{ cases: CaseRecord[] }>(open ? "/api/cases" : null);
  const laws = useData<{ sources: LegalSource[] }>(
    open ? `/api/laws/search?q=${encodeURIComponent(query)}` : null,
  );
  const matching =
    cases.data?.cases.filter((record) =>
      `${record.title} ${record.number}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    ) || [];
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={localizeText("Platformada qidirish")}
      description={localizeText(
        "Nizo raqami, nomi yoki qonunchilik bo‘yicha izlang.",
      )}
    >
      <div className="search-input-wrap">
        <Search size={19} />
        <input
          autoFocus
          placeholder={localizeText("Masalan, ish haqi yoki MM-1042")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="search-results">
        <h4>
          <LocalizedText>Nizolar</LocalizedText>
        </h4>
        {matching.length ? (
          matching.slice(0, 4).map((record) => (
            <button
              key={record.id}
              onClick={() => {
                router.push(`/dashboard/cases/${record.id}`);
                onOpenChange(false);
              }}
            >
              <FileText size={18} />
              <span>
                {record.title}
                <small>{record.number}</small>
              </span>
              <ChevronRight size={16} />
            </button>
          ))
        ) : (
          <p>
            <LocalizedText>Mos nizo topilmadi.</LocalizedText>
          </p>
        )}
        <h4>
          <LocalizedText>Qonunchilik</LocalizedText>
        </h4>
        {laws.data?.sources.slice(0, 4).map((source) => (
          <a key={source.id} href={source.url} target="_blank" rel="noreferrer">
            <BookOpen size={18} />
            <span>
              {source.title}
              <small>{source.lawNumber}</small>
            </span>
            <ChevronRight size={16} />
          </a>
        ))}
        {laws.data?.sources.length === 0 && (
          <p>
            <LocalizedText>
              Mos manba topilmadi. Boshqa so‘z bilan izlang.
            </LocalizedText>
          </p>
        )}
      </div>
    </Dialog>
  );
}
