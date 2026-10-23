"use client";
import { useI18n } from "../i18n/context";
import { useState, useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Clapperboard,
  Film,
  Rocket,
  LogOut,
  UserRound,
  Menu,
  ChevronRight,
  ListOrdered,
  Settings,
  BookOpen,
  House,
  Wrench,
  AudioLines,
} from "lucide-react";
import type { User } from "../lib/auth";
import { api } from "./api";
import { UserProfileModal } from "./UserProfileModal";
import { BrandLogo } from "./BrandLogo";
import {
  ProjectBreadcrumbContext,
  type ProjectBreadcrumb,
} from "./ProjectBreadcrumb";
import { GenerationQueueContext } from "./GenerationQueueContext";
import { GenerationProgress } from "./GenerationProgress";
import { GenerationQueueModal } from "./GenerationQueueModal";
import {
  queueChangedEvent,
  type GenerationQueueState,
} from "../lib/generation-queue";
const items = [
  ["/", "Dashboard", LayoutDashboard],
  ["/bible-versions", "Bible versions", BookOpen],
  ["/short-videos", "Short Videos", Clapperboard],
  ["/long-videos", "Long Videos", Film],
  ["/book-videos", "Book Videos", Film],
  ["/audios", "Audios", AudioLines],
  ["/deployments", "Publications", Rocket],
  ["/settings", "Settings", Settings],
  ["/admin-tools", "Admin Tools", Wrench],
] as const;
export function Shell({ children, user }: { children: ReactNode; user: User }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [projectBreadcrumb, setProjectBreadcrumb] =
    useState<ProjectBreadcrumb | null>(null);
  const [open, setOpen] = useState(false),
    [profile, setProfile] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const userButtonRef = useRef<HTMLButtonElement>(null);
  const closeUserMenu = () => {
    setUserMenuOpen(false);
    userButtonRef.current?.focus();
  };
  useEffect(() => {
    setUserMenuOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!userMenuOpen) return;
    userMenuRef.current
      ?.querySelector<HTMLElement>('[role="menuitem"]')
      ?.focus();
    const dismiss = (event: Event) => {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("focusin", dismiss);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("focusin", dismiss);
    };
  }, [userMenuOpen]);
  const [queueOpen, setQueueOpen] = useState(false);
  const queueOpenRef = useRef(false);
  const [queue, setQueue] = useState<GenerationQueueState>({
    connected: false,
    items: [],
    summary: { progress: 0, completed: 0, total: 0 },
  });
  const refreshQueue = useRef<() => void>(() => {});
  const [account, setAccount] = useState(user);
  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    let fetching = false;
    let refreshAgain = false;
    const refresh = async () => {
      if (!live) return;
      if (document.hidden) {
        clearTimeout(timer);
        timer = setTimeout(refresh, 60000);
        return;
      }
      if (fetching) {
        refreshAgain = true;
        return;
      }
      fetching = true;
      clearTimeout(timer);
      let delay = 60000;
      try {
        const data = await api<GenerationQueueState>(
          queueOpenRef.current
            ? "generation-queue?history=1"
            : "generation-queue",
        );
        if (live)
          setQueue((current) =>
            data.connected ? data : { ...current, connected: false },
          );
        if (
          data.items.some((item) => ["queued", "running"].includes(item.status))
        )
          delay = 10000;
        if (!data.connected) delay = 120000;
      } catch {
        delay = 120000;
        if (live) setQueue((current) => ({ ...current, connected: false }));
      } finally {
        fetching = false;
        if (live && refreshAgain) {
          refreshAgain = false;
          void refresh();
          return;
        }
        if (live)
          timer = setTimeout(() => {
            if (document.hidden) timer = setTimeout(refresh, 60000);
            else void refresh();
          }, delay);
      }
    };
    refreshQueue.current = refresh;
    const onVisible = () => {
      if (!document.hidden) void refresh();
    };
    void refresh();
    window.addEventListener(queueChangedEvent, refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      live = false;
      clearTimeout(timer);
      window.removeEventListener(queueChangedEvent, refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
  const section = items.find((i) => isActive(i[0]));
  const title = section?.[1] ?? "Dashboard";
  const isProjectEditor =
    /^\/(?:(?:short|long|book)-videos\/[^/]+|audios\/[^/]+\/[^/]+)/.test(
      pathname,
    );
  const projectTitle =
    projectBreadcrumb?.href === pathname
      ? projectBreadcrumb.title
      : t(pathname.startsWith("/audios/") ? "Audio project" : "Video project");
  const pending = queue.items.filter((item) =>
    ["queued", "running"].includes(item.status),
  );
  return (
    <ProjectBreadcrumbContext.Provider value={setProjectBreadcrumb}>
      <div className="shell">
        <aside className={open ? "sidebar expanded" : "sidebar"}>
          <Link href="/" className="brand">
            <BrandLogo />
            <div>
              <strong>{t("VeoBible")}</strong>
              <small>{t("VIDEO PRODUCTION")}</small>
            </div>
          </Link>
          <div className="nav-label">{t("YOUR PROJECTS")}</div>
          <nav>
            {items
              .filter(
                ([href]) =>
                  !["/settings", "/admin-tools"].includes(href) &&
                  (!["/deployments", "/bible-versions"].includes(href) ||
                    user.role === "admin"),
              )
              .map(([href, label, Icon]) => (
                <Link
                  onClick={() => setOpen(false)}
                  key={href}
                  href={href}
                  className={isActive(href) ? "active" : ""}
                >
                  <Icon size={18} />
                  <span>{t(label)}</span>
                  {isActive(href) && <i />}
                </Link>
              ))}
          </nav>
          <div className="sidebar-bottom">
            <button
              type="button"
              className="local-card generation-queue-card"
              aria-label={t("Open generation queue")}
              onClick={() => {
                queueOpenRef.current = true;
                setQueueOpen(true);
                setOpen(false);
                refreshQueue.current();
              }}
            >
              <span className={queue.connected ? "dot green" : "dot"} />
              <strong>
                {queue.connected
                  ? t("Generation available")
                  : t("Generation unavailable")}
              </strong>
              <p>
                {queue.items.some((item) => item.status === "running")
                  ? t("Generation in progress")
                  : queue.items.some((item) => item.status === "queued")
                    ? t("Generations waiting")
                    : t("No pending generations")}
              </p>
              {pending.length > 0 && (
                <>
                  <GenerationProgress
                    value={
                      pending.find((item) => item.status === "running")
                        ?.progress ?? 0
                    }
                    label={t("Current task")}
                  />
                  <GenerationProgress
                    value={queue.summary?.progress ?? 0}
                    label={t("Entire queue")}
                  />
                </>
              )}
              <span className="queue-card-link">
                <ListOrdered size={15} />
                {t("View queue")}
                <b>{pending.length}</b>
              </span>
            </button>
            <div className="sidebar-note">
              {t("VeoBible Dashboard")} <span>01</span>
            </div>
          </div>
        </aside>
        <div className="workspace">
          <header>
            <nav className="breadcrumb" aria-label={t("Breadcrumb")}>
              <button
                className="mobile-toggle icon-button"
                aria-label={t("Open menu")}
                onClick={() => setOpen(!open)}
              >
                <Menu size={20} />
              </button>
              <Link
                href="/"
                className="breadcrumb-home icon-button"
                aria-label={t("Home")}
                data-tooltip={t("Home")}
                aria-current={pathname === "/" ? "page" : undefined}
              >
                <House size={17} aria-hidden="true" />
              </Link>
              <ChevronRight size={14} aria-hidden="true" />
              {isProjectEditor && section ? (
                <>
                  <Link href={section[0]} className="breadcrumb-section">
                    {t(title)}
                  </Link>
                  <ChevronRight size={14} aria-hidden="true" />
                  <b
                    className="breadcrumb-current"
                    aria-current="page"
                    data-tooltip={projectTitle}
                  >
                    {projectTitle}
                  </b>
                </>
              ) : (
                <b aria-current={pathname === "/" ? undefined : "page"}>
                  {t(title)}
                </b>
              )}
            </nav>
            <div
              className="header-actions user-menu-container"
              ref={userMenuRef}
              onKeyDown={(event) => {
                if (event.key === "Escape" && userMenuOpen) {
                  event.preventDefault();
                  closeUserMenu();
                }
                if (
                  !userMenuOpen ||
                  !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
                )
                  return;
                event.preventDefault();
                const entries = Array.from(
                  userMenuRef.current?.querySelectorAll<HTMLElement>(
                    '[role="menuitem"]',
                  ) ?? [],
                );
                const current = entries.indexOf(
                  document.activeElement as HTMLElement,
                );
                const next =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? entries.length - 1
                      : (current +
                          (event.key === "ArrowDown" ? 1 : -1) +
                          entries.length) %
                        entries.length;
                entries[next]?.focus();
              }}
            >
              <button
                type="button"
                className="user-button"
                ref={userButtonRef}
                id="user-menu-button"
                aria-label={t("Open user menu")}
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
                aria-controls={userMenuOpen ? "user-menu" : undefined}
                onClick={() => setUserMenuOpen((current) => !current)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault();
                    event.stopPropagation();
                    setUserMenuOpen(true);
                  }
                }}
              >
                <span className="profile-avatar">
                  <span>
                    <UserRound size={16} />
                  </span>
                </span>
                <span className="user-info">
                  <strong>{account.name || account.username}</strong>
                  <small>
                    {account.role === "admin"
                      ? t("Administrator")
                      : t("Editor")}
                  </small>
                </span>
              </button>
              {userMenuOpen && (
                <div
                  id="user-menu"
                  className="user-menu"
                  role="menu"
                  aria-labelledby="user-menu-button"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      closeUserMenu();
                      setProfile(true);
                    }}
                  >
                    <UserRound size={17} aria-hidden="true" />
                    {t("My profile")}
                  </button>
                  <div className="user-menu-separator" role="separator" />
                  {user.role === "admin" && (
                    <Link
                      href="/settings"
                      role="menuitem"
                      onClick={closeUserMenu}
                    >
                      <Settings size={17} aria-hidden="true" />
                      {t("Settings")}
                    </Link>
                  )}
                  <Link
                    href="/admin-tools"
                    role="menuitem"
                    onClick={closeUserMenu}
                  >
                    <Wrench size={17} aria-hidden="true" />
                    {t("Admin Tools")}
                  </Link>
                  <div className="user-menu-separator" role="separator" />
                  <button
                    type="button"
                    role="menuitem"
                    className="user-menu-signout"
                    onClick={async () => {
                      await api("auth/logout", { method: "POST" });
                      window.location.assign("/login");
                    }}
                  >
                    <LogOut size={17} aria-hidden="true" />
                    {t("Sign out")}
                  </button>
                </div>
              )}
            </div>
          </header>
          <main className={isProjectEditor ? "video-editor-main" : undefined}>
            <GenerationQueueContext.Provider value={queue}>
              {children}
            </GenerationQueueContext.Provider>
          </main>
        </div>
        {profile && (
          <UserProfileModal
            user={account}
            close={() => setProfile(false)}
            onUpdated={setAccount}
          />
        )}
        {queueOpen && (
          <GenerationQueueModal
            state={queue}
            close={() => {
              queueOpenRef.current = false;
              setQueueOpen(false);
            }}
            refresh={() => refreshQueue.current()}
          />
        )}
      </div>
    </ProjectBreadcrumbContext.Provider>
  );
}
