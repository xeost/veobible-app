"use client";
import { useEffect, useState } from "react";
import { Save, Globe, AtSign } from "lucide-react";
import { useI18n } from "../i18n/context";
import { api } from "./api";
import {
  emptySocialSettings,
  socialSettingsSchema,
  type SocialSettings as Accounts,
} from "../lib/social-settings";
const languages = [
  ["es", "Español"],
  ["en", "Inglés"],
  ["pt", "Portugués"],
] as const;
const platforms = [
  ["youtube", "YouTube"],
  ["x", "X"],
  ["instagram", "Instagram"],
  ["tiktok", "TikTok"],
  ["facebook", "Facebook"],
] as const;
export function SocialSettings() {
  const { t } = useI18n();
  const [accounts, setAccounts] = useState<Accounts>(emptySocialSettings);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let live = true;
    api<{ accounts: Accounts }>("settings/social-accounts")
      .then((data) => {
        if (live) setAccounts(data.accounts);
      })
      .catch(() => {
        if (live)
          setError(
            "No se pudieron cargar las cuentas. Recarga la página para reintentar.",
          );
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setNotice("");
    const parsed = socialSettingsSchema.safeParse(accounts);
    if (!parsed.success) {
      setError(
        "Escribe nombres de usuario, sin enlaces ni espacios, de hasta 100 caracteres.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = await api<{ accounts: Accounts }>(
        "settings/social-accounts",
        { method: "PUT", body: JSON.stringify(parsed.data) },
      );
      setAccounts(data.accounts);
      setNotice("Ajustes guardados.");
    } catch {
      setError("No se pudieron guardar las cuentas. Vuelve a intentarlo.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{t("CONFIGURACIÓN")}</p>
          <h1>{t("Settings")}</h1>
          <p className="muted">
            {t("Configura las cuentas de redes sociales para cada idioma.")}
          </p>
        </div>
      </div>
      {loading ? (
        <p className="empty">{t("Cargando cuentas…")}</p>
      ) : (
        <form onSubmit={submit} className="social-settings-form">
          {error && (
            <p className="error" role="alert">
              {t(error)}
            </p>
          )}
          {notice && (
            <p className="success" role="status">
              {t(notice)}
            </p>
          )}
          <div className="social-settings-intro">
            <AtSign size={22} />
            <div>
              <h2>{t("Cuentas de redes sociales")}</h2>
              <p className="muted">
                {t(
                  "Introduce el nombre de usuario con o sin @. Deja una cuenta vacía para no mostrar esa red en el video.",
                )}
              </p>
            </div>
          </div>
          <div className="social-settings-grid">
            {languages.map(([locale, label]) => (
              <fieldset
                className="panel social-settings-language"
                key={locale}
                disabled={
                  busy ||
                  error ===
                    "No se pudieron cargar las cuentas. Recarga la página para reintentar."
                }
              >
                <legend>
                  <Globe size={17} />
                  {t(label)}
                  <small>{locale.toUpperCase()}</small>
                </legend>
                {platforms.map(([platform, name]) => (
                  <label
                    key={platform}
                    htmlFor={`social-${locale}-${platform}`}
                  >
                    {name}
                    <input
                      id={`social-${locale}-${platform}`}
                      type="text"
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      maxLength={100}
                      value={accounts[locale][platform]}
                      aria-label={`${name} · ${t(label)}`}
                      onChange={(event) => {
                        setAccounts((current) => ({
                          ...current,
                          [locale]: {
                            ...current[locale],
                            [platform]: event.target.value,
                          },
                        }));
                        setNotice("");
                      }}
                    />
                  </label>
                ))}
              </fieldset>
            ))}
          </div>
          <div className="social-settings-footer">
            <p className="muted">
              {t(
                "Los cambios se aplican a los próximos videos que envíes a generar.",
              )}
            </p>
            <button
              type="submit"
              className="primary"
              disabled={
                busy ||
                error ===
                  "No se pudieron cargar las cuentas. Recarga la página para reintentar."
              }
            >
              <Save size={16} />
              {t(busy ? "Guardando…" : "Guardar cambios")}
            </button>
          </div>
        </form>
      )}
    </>
  );
}
