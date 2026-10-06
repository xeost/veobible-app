"use client";
import { useState, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  LayoutDashboard,
  Clapperboard,
  Film,
  Rocket,
  LogOut,
  UserRound,
  Menu,
  ChevronRight,
  Users,
  X,
} from "lucide-react";
import type { User } from "../lib/auth";
import { api } from "./api";
import { UsersPanel } from "./UsersPanel";
const items = [
  ["/", "Dashboard", LayoutDashboard],
  ["/short-videos", "Short Videos", Clapperboard],
  ["/long-videos", "Long Videos", Film],
  ["/deployments", "Deployments", Rocket],
] as const;
export function Shell({ children, user }: { children: ReactNode; user: User }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false),
    [profile, setProfile] = useState(false),
    [users, setUsers] = useState(false),
    [connected, setConnected] = useState(false),
    [error, setError] = useState("");
  const [name, setName] = useState(user.name),
    [email, setEmail] = useState(user.email),
    [password, setPassword] = useState(""),
    [currentPassword, setCurrentPassword] = useState("");
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
  const title = items.find((i) => i[0] === pathname)?.[1] ?? "Studio";
  return (
    <div className="shell">
      <aside className={open ? "sidebar expanded" : "sidebar"}>
        <Link href="/" className="brand">
          <div className="brand-icon">
            <BookOpen size={25} />
          </div>
          <div>
            <strong>VeoBible</strong>
            <small>PRODUCTION STUDIO</small>
          </div>
        </Link>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {items.map(([href, label, Icon]) => (
            <Link
              onClick={() => setOpen(false)}
              key={href}
              href={href}
              className={pathname === href ? "active" : ""}
            >
              <Icon size={18} />
              <span>{label}</span>
              {pathname === href && <i />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-card">
            <span className={connected ? "dot green" : "dot"} />
            <strong>
              {connected ? "Laptop conectada" : "Laptop desconectada"}
            </strong>
            <p>IA y archivos multimedia locales</p>
          </div>
          <div className="sidebar-note">
            VeoBible Studio <span>01</span>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header>
          <div className="breadcrumb">
            <button
              className="mobile-toggle icon-button"
              aria-label="Abrir menú"
              onClick={() => setOpen(!open)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <b>{title}</b>
          </div>
          <div className="header-actions">
            <span className="env-badge">D1 · Dashboard</span>
            {user.role === "admin" && (
              <button
                className="icon-button"
                aria-label="Gestionar usuarios"
                onClick={() => setUsers(true)}
              >
                <Users size={18} />
              </button>
            )}
            <button className="user-button" onClick={() => setProfile(true)}>
              <span className="avatar">{name.slice(0, 1).toUpperCase()}</span>
              <span>
                {name}
                <small>{user.role}</small>
              </span>
            </button>
            <button
              className="icon-button"
              aria-label="Cerrar sesión"
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
        <div className="modal-backdrop">
          <section
            className="modal small"
            role="dialog"
            aria-modal="true"
            aria-label="Mi perfil"
          >
            <div className="modal-title">
              <h2>
                <UserRound size={20} /> Mi perfil
              </h2>
              <button
                className="icon-button"
                aria-label="Cerrar"
                onClick={() => setProfile(false)}
              >
                <X />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await api("auth/profile", {
                    method: "PATCH",
                    body: JSON.stringify({
                      name,
                      email,
                      ...(password ? { password, currentPassword } : {}),
                    }),
                  });
                  setProfile(false);
                  setPassword("");
                } catch (e) {
                  setError(String(e));
                }
              }}
            >
              <label>
                Nombre
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label>
                Contraseña actual
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </label>
              <label>
                Nueva contraseña
                <input
                  type="password"
                  minLength={12}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </label>
              {error && <p className="error">{error}</p>}
              <button className="primary">Guardar perfil</button>
            </form>
          </section>
        </div>
      )}
      {users && (
        <UsersPanel currentId={user.id} close={() => setUsers(false)} />
      )}
    </div>
  );
}
