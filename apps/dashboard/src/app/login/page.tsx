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
        <p className="eyebrow">{t("WELCOME TO THE DASHBOARD")}</p>
        <h2>{t("Sign in")}</h2>
        <p className="muted">{t("Access your video production workspace.")}</p>
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
            {t("Username")}
            <input
              name="username"
              required
              autoComplete="username"
              placeholder={t("Your username")}
            />
          </label>
          <label>
            {t("Password")}
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder={t("Your password")}
            />
          </label>
          {error && (
            <p role="alert" className="error">
              {t(error)}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy ? t("Signing in…") : t("Sign in to the Dashboard")}
            <ArrowRight size={17} />
          </button>
        </form>
        <small className="muted">{t("Private access · Dashboard users")}</small>
      </section>
    </div>
  );
}
