"use client";
import { useI18n } from "../i18n/context";
import { useState, useEffect, type ReactNode } from "react";
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
} from "lucide-react";
import type { User } from "../lib/auth";
import { api } from "./api";
import { UserProfileModal } from "./UserProfileModal";
import { BrandLogo } from "./BrandLogo";
const items = [
  ["/", "Dashboard", LayoutDashboard],
  ["/short-videos", "Short Videos", Clapperboard],
  ["/long-videos", "Long Videos", Film],
  ["/deployments", "Actualizaciones", Rocket],
] as const;
export function Shell({ children, user }: { children: ReactNode; user: User }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false),
    [profile, setProfile] = useState(false),
    [connected, setConnected] = useState(false);
  const [account, setAccount] = useState(user);
  useEffect(() => {
    let live = true;
    const refresh = () =>
      api("health")
        .then((d) => {
          if (live) setConnected(d.connected);
        })
        .catch(() => {
          if (live) setConnected(false);
        });
    void refresh();
    const timer = setInterval(refresh, 30000);
    return () => {
      live = false;
      clearInterval(timer);
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
              ([href]) => href !== "/deployments" || user.role === "admin",
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
          <div className="local-card">
            <span className={connected ? "dot green" : "dot"} />
            <strong>
              {t(
                connected
                  ? "Generación disponible"
                  : "Generación no disponible",
              )}
            </strong>
            <p>
              {t(
                connected
                  ? "Puedes crear nuevos videos"
                  : "Inténtalo de nuevo más tarde",
              )}
            </p>
          </div>
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
        <main>{children}</main>
      </div>
      {profile && (
        <UserProfileModal
          user={account}
          close={() => setProfile(false)}
          onUpdated={setAccount}
        />
      )}
    </div>
  );
}
