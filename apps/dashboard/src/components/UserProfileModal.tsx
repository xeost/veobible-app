"use client";
import { useEffect, useRef, useState } from "react";
import {
  X,
  UserRound,
  LockKeyhole,
  Mail,
  Shield,
  Save,
  KeyRound,
  Globe,
  AlertCircle,
} from "lucide-react";
import type { User } from "../lib/auth";
import { userMessage } from "../lib/presentation";
import { useI18n, type Language } from "../i18n/context";
import { api } from "./api";
export function UserProfileModal({
  user,
  close,
  onUpdated,
}: {
  user: User;
  close: () => void;
  onUpdated: (user: User) => void;
}) {
  const { language, setLanguage, t } = useI18n();
  const [tab, setTab] = useState<"profile" | "password">("profile");
  const [username, setUsername] = useState(user.username),
    [name, setName] = useState(user.name),
    [email, setEmail] = useState(user.email);
  const [currentPassword, setCurrentPassword] = useState(""),
    [password, setPassword] = useState(""),
    [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const dialog = useRef<HTMLElement>(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  const busyRef = useRef(busy);
  busyRef.current = busy;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLElement>("button")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busyRef.current) closeRef.current();
      if (event.key === "Tab") {
        const controls = [
          ...(dialog.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]',
          ) ?? []),
        ];
        const first = controls[0],
          last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  const changeTab = (value: "profile" | "password") => {
    setTab(value);
    setError("");
    setCurrentPassword("");
    setPassword("");
    setConfirmPassword("");
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!/^[a-z0-9_.-]{3,60}$/.test(username.trim().toLowerCase())) {
      setError(
        "El usuario debe tener entre 3 y 60 caracteres: letras, números, puntos, guiones o guiones bajos.",
      );
      return;
    }
    if (!name.trim()) {
      setError("Escribe tu nombre.");
      return;
    }
    if (tab === "password") {
      if (!currentPassword) {
        setError("Escribe tu contraseña actual.");
        return;
      }
      if (password.length < 12) {
        setError("La nueva contraseña debe tener al menos 12 caracteres.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Las contraseñas no coinciden.");
        return;
      }
    }
    setBusy(true);
    try {
      const data = await api<{ user: User }>("auth/profile", {
        method: "PATCH",
        body: JSON.stringify({
          username: username.trim().toLowerCase(),
          name: name.trim(),
          email: email.trim(),
          ...(tab === "password" ? { currentPassword, password } : {}),
        }),
      });
      onUpdated(data.user);
      close();
    } catch (error) {
      setError(userMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) close();
      }}
    >
      <section
        ref={dialog}
        className="modal profile-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-title"
        aria-describedby="profile-description"
      >
        <div className="profile-modal-heading">
          <div className="profile-title-icon">
            <UserRound size={21} />
          </div>
          <div>
            <h2 id="profile-title">{t("Mi perfil")}</h2>
            <p id="profile-description" className="muted">
              {t(
                "Gestiona tu información personal y la seguridad de tu cuenta.",
              )}
            </p>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label={t("Cerrar perfil")}
            disabled={busy}
            onClick={close}
          >
            <X size={18} />
          </button>
        </div>
        <div
          className="tabs profile-tabs"
          role="tablist"
          aria-label={t("Opciones de perfil")}
        >
          <button
            type="button"
            role="tab"
            id="profile-tab"
            aria-selected={tab === "profile"}
            aria-controls="profile-content"
            className={tab === "profile" ? "active" : ""}
            disabled={busy}
            onClick={() => changeTab("profile")}
          >
            <UserRound size={15} />
            {t("Datos personales")}
          </button>
          <button
            type="button"
            role="tab"
            id="password-tab"
            aria-selected={tab === "password"}
            aria-controls="profile-content"
            className={tab === "password" ? "active" : ""}
            disabled={busy}
            onClick={() => changeTab("password")}
          >
            <KeyRound size={15} />
            {t("Cambiar contraseña")}
          </button>
        </div>
        <form onSubmit={submit} className="profile-form">
          {error && (
            <p className="error profile-alert" role="alert">
              <AlertCircle size={17} />
              {t(error)}
            </p>
          )}
          <div
            id="profile-content"
            role="tabpanel"
            aria-labelledby={tab === "profile" ? "profile-tab" : "password-tab"}
          >
            {tab === "profile" ? (
              <>
                <label>
                  {t("Usuario")}
                  <div className="profile-input">
                    <UserRound size={16} />
                    <input
                      value={username}
                      required
                      minLength={3}
                      maxLength={60}
                      autoComplete="username"
                      disabled={busy}
                      onChange={(e) =>
                        setUsername(
                          e.target.value.toLowerCase().replace(/\s/g, ""),
                        )
                      }
                    />
                  </div>
                </label>
                <p className="profile-hint">
                  {t("Usa este nombre para iniciar sesión.")}
                </p>
                <label>
                  {t("Nombre")}
                  <div className="profile-input">
                    <UserRound size={16} />
                    <input
                      value={name}
                      required
                      maxLength={100}
                      autoComplete="name"
                      disabled={busy}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                </label>
                <label>
                  {t("Correo electrónico")}
                  <div className="profile-input">
                    <Mail size={16} />
                    <input
                      type="email"
                      value={email}
                      autoComplete="email"
                      disabled={busy}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </label>
                <label>
                  {t("Idioma")}
                  <div className="profile-input">
                    <Globe size={16} />
                    <select
                      value={language}
                      disabled={busy}
                      onChange={(e) => setLanguage(e.target.value as Language)}
                    >
                      <option value="es">Español</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                </label>
                <p className="profile-hint">
                  {t(
                    "El idioma se aplica a la interfaz y se recuerda en este navegador.",
                  )}
                </p>
                <div className="profile-role">
                  <span>
                    <Shield size={16} />
                    {t("Rol de la cuenta")}
                  </span>
                  <span className="badge">
                    {t(user.role === "admin" ? "Administrador" : "Editor")}
                  </span>
                </div>
              </>
            ) : (
              <>
                <p className="notice profile-alert">
                  <LockKeyhole size={17} />
                  {t(
                    "Para cambiar tu contraseña, confirma tu identidad con la contraseña actual.",
                  )}
                </p>
                <label>
                  {t("Contraseña actual")}
                  <div className="profile-input">
                    <LockKeyhole size={16} />
                    <input
                      type="password"
                      value={currentPassword}
                      required
                      maxLength={256}
                      autoComplete="current-password"
                      disabled={busy}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                    />
                  </div>
                </label>
                <label>
                  {t("Nueva contraseña")}
                  <div className="profile-input">
                    <KeyRound size={16} />
                    <input
                      type="password"
                      value={password}
                      required
                      minLength={12}
                      maxLength={256}
                      autoComplete="new-password"
                      disabled={busy}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </label>
                <p className="profile-hint">
                  {t("Usa al menos 12 caracteres.")}
                </p>
                <label>
                  {t("Confirmar nueva contraseña")}
                  <div className="profile-input">
                    <KeyRound size={16} />
                    <input
                      type="password"
                      value={confirmPassword}
                      required
                      minLength={12}
                      maxLength={256}
                      autoComplete="new-password"
                      disabled={busy}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </label>
              </>
            )}
          </div>
          <div className="profile-footer">
            <button type="button" disabled={busy} onClick={close}>
              {t("Cerrar")}
            </button>
            <button type="submit" className="primary" disabled={busy}>
              <Save size={16} />
              {t(busy ? "Guardando…" : "Guardar cambios")}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
