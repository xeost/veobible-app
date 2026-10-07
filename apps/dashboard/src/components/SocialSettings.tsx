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
  ["es", "Spanish"],
  ["en", "English"],
  ["pt", "Portuguese"],
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
          setError("Could not load accounts. Reload the page to try again.");
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
        "Enter usernames, without links or spaces, up to 100 characters.",
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
      setNotice("Settings saved.");
    } catch {
      setError("Could not save accounts. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{t("SETTINGS")}</p>
          <h1>{t("Settings")}</h1>
          <p className="muted">
            {t("Configure social media accounts for each language.")}
          </p>
        </div>
      </div>
      {loading ? (
        <p className="empty">{t("Loading accounts…")}</p>
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
              <h2>{t("Social media accounts")}</h2>
              <p className="muted">
                {t(
                  "Enter the username with or without @. Leave an account empty to hide that network in the video.",
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
                    "Could not load accounts. Reload the page to try again."
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
              {t("Changes apply to the next videos you submit for generation.")}
            </p>
            <button
              type="submit"
              className="primary"
              disabled={
                busy ||
                error ===
                  "Could not load accounts. Reload the page to try again."
              }
            >
              <Save size={16} />
              {busy ? t("Saving…") : t("Save changes")}
            </button>
          </div>
        </form>
      )}
    </>
  );
}
