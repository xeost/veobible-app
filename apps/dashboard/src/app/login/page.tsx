"use client";
import { useI18n } from "../../i18n/context";
import { userMessage } from "../../lib/presentation";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { BrandLogo } from "../../components/BrandLogo";
export default function Login() {
  const { t } = useI18n();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="login">
      <section className="login-form">
        <BrandLogo />
        <p className="eyebrow">{t("BIENVENIDO AL DASHBOARD")}</p>
        <h2>{t("Inicia sesión")}</h2>
        <p className="muted">
          {t("Accede a tu espacio de producción de videos.")}
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const form = new FormData(e.currentTarget);
            try {
              const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(Object.fromEntries(form)),
              });
              const data = (await response.json()) as { error?: string };
              if (!response.ok) throw new Error(data.error);
              window.location.assign("/");
            } catch (e) {
              setError(userMessage(e));
              setBusy(false);
            }
          }}
        >
          <label>
            {t("Usuario")}
            <input
              name="username"
              required
              autoComplete="username"
              placeholder={t("Tu usuario")}
            />
          </label>
          <label>
            {t("Contraseña")}
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder={t("Tu contraseña")}
            />
          </label>
          {error && (
            <p role="alert" className="error">
              {t(error)}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {t(busy ? "Ingresando…" : "Entrar al Dashboard")}
            <ArrowRight size={17} />
          </button>
        </form>
        <small className="muted">
          {t("Acceso privado · Usuarios del dashboard")}
        </small>
      </section>
    </div>
  );
}
