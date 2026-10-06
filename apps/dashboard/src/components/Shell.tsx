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
} from "lucide-react";
import type { User } from "../lib/auth";
import { api } from "./api";
import { UserProfileModal } from "./UserProfileModal";
import { BrandLogo } from "./BrandLogo";
import { GenerationQueueModal } from "./GenerationQueueModal";
import {
  queueChangedEvent,
  type GenerationQueueState,
} from "../lib/generation-queue";
const items = [
  ["/", "Dashboard", LayoutDashboard],
  ["/short-videos", "Short Videos", Clapperboard],
  ["/long-videos", "Long Videos", Film],
  ["/deployments", "Actualizaciones", Rocket],
  ["/settings", "Settings", Settings],
] as const;
export function Shell({ children, user }: { children: ReactNode; user: User }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false),
    [profile, setProfile] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [queue, setQueue] = useState<GenerationQueueState>({
    connected: false,
    items: [],
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
      if (fetching) {
        refreshAgain = true;
        return;
      }
      fetching = true;
      clearTimeout(timer);
      let delay = 30000;
      try {
        const data = await api<GenerationQueueState>("generation-queue");
        if (live)
          setQueue((current) =>
            data.connected ? data : { ...current, connected: false },
          );
        if (
          data.items.some((item) => ["queued", "running"].includes(item.status))
        )
          delay = 3000;
      } catch {
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
            if (document.hidden) timer = setTimeout(refresh, 30000);
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
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      live = false;
      clearTimeout(timer);
      window.removeEventListener(queueChangedEvent, refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
  const title = items.find((i) => isActive(i[0]))?.[1] ?? "Dashboard";
  return (
    <div className="shell">
      <aside className={open ? "sidebar expanded" : "sidebar"}>
        <Link href="/" className="brand">
          <BrandLogo />
          <div>
            <strong>{t("VeoBible")}</strong>
            <small>{t("PRODUCCIÓN DE VIDEOS")}</small>
          </div>
        </Link>
        <div className="nav-label">{t("TUS PROYECTOS")}</div>
        <nav>
          {items
            .filter(
              ([href]) =>
                !["/deployments", "/settings"].includes(href) ||
                user.role === "admin",
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
            aria-label={t("Abrir cola de generación")}
            onClick={() => {
              setQueueOpen(true);
              setOpen(false);
              refreshQueue.current();
            }}
          >
            <span className={queue.connected ? "dot green" : "dot"} />
            <strong>
              {t(
                queue.connected
                  ? "Generación disponible"
                  : "Generación no disponible",
              )}
            </strong>
            <p>
              {t(
                queue.items.some((item) => item.status === "running")
                  ? "Generación en curso"
                  : queue.items.some((item) => item.status === "queued")
                    ? "Generaciones en espera"
                    : "Sin generaciones pendientes",
              )}
            </p>
            <span className="queue-card-link">
              <ListOrdered size={15} />
              {t("Ver cola")}
              <b>
                {
                  queue.items.filter((item) =>
                    ["queued", "running"].includes(item.status),
                  ).length
                }
              </b>
            </span>
          </button>
          <div className="sidebar-note">
            {t("VeoBible Dashboard")} <span>01</span>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header>
          <div className="breadcrumb">
            <button
              className="mobile-toggle icon-button"
              aria-label={t("Abrir menú")}
              onClick={() => setOpen(!open)}
            >
              <Menu size={20} />
            </button>
            <span>{t("Mis proyectos")}</span>
            <ChevronRight size={14} />
            <b>{title}</b>
          </div>
          <div className="header-actions">
            <button
              type="button"
              className="user-button"
              aria-label={t("Abrir mi perfil")}
              title={t("Mi perfil")}
              onClick={() => setProfile(true)}
            >
              <span className="profile-avatar">
                <span>
                  <UserRound size={16} />
                </span>
              </span>
              <span className="user-info">
                <strong>{account.name || account.username}</strong>
                <small>
                  {t(account.role === "admin" ? "Administrador" : "Editor")}
                </small>
              </span>
            </button>
            <button
              className="icon-button"
              aria-label={t("Cerrar sesión")}
              onClick={async () => {
                await api("auth/logout", { method: "POST" });
                window.location.assign("/login");
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>
        <main
          className={
            /^\/(short|long)-videos\/[^/]+/.test(pathname)
              ? "video-editor-main"
              : undefined
          }
        >
          {children}
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
          close={() => setQueueOpen(false)}
          refresh={() => refreshQueue.current()}
        />
      )}
    </div>
  );
}
