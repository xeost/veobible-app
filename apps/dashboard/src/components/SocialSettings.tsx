"use client";
import {
  defaultLoudnessSettings,
  type LoudnessSettings,
} from "../lib/loudness-settings";
import { LoudnessSettingsPanel } from "./LoudnessSettingsPanel";
import { useToast } from "./ToastProvider";
import { useEffect, useState } from "react";
import { Save, Globe } from "lucide-react";
import { useI18n } from "../i18n/context";
import { api } from "./api";
import {
  emptySocialSettings,
  socialSettingsSchema,
  socialAccountsSchema,
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
  const notify = useToast();
  const { t } = useI18n();
  const [accounts, setAccounts] = useState<Accounts>(emptySocialSettings);
  const [loudness, setLoudness] = useState<LoudnessSettings>(
    defaultLoudnessSettings,
  );
  const [loadFailed, setLoadFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    Promise.all([
      api<{ accounts: Accounts }>("settings/social-accounts"),
      api<{ settings: LoudnessSettings }>("settings/video-loudness"),
    ])
      .then(([social, volume]) => {
        if (live) {
          setAccounts(social.accounts);
          setLoudness(volume.settings);
        }
      })
      .catch(() => {
        if (live) {
          setLoadFailed(true);
          setError("Could not load settings. Reload the page to try again.");
        }
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
    if (loading || loadFailed || busy) return;
    const parsed = socialSettingsSchema.safeParse(accounts);
    if (!parsed.success) {
      const invalidDomain = Object.values(accounts).some(
        (account) =>
          !socialAccountsSchema.shape.domain.safeParse(account.domain).success,
      );
      const invalidTitle = Object.values(accounts).some(
        (account) =>
          !socialAccountsSchema.shape.shortTitle.safeParse(account.shortTitle)
            .success ||
          !socialAccountsSchema.shape.title.safeParse(account.title).success,
      );
      setError(
        invalidDomain
          ? "Enter a domain such as veobible.com, without https://, paths or spaces."
          : invalidTitle
            ? "Use up to 100 characters for the short title and 200 for the title."
            : "Enter usernames, without links or spaces, up to 100 characters.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const [social, volume] = await Promise.allSettled([
        api<{ accounts: Accounts }>("settings/social-accounts", {
          method: "PUT",
          body: JSON.stringify(parsed.data),
        }),
        api<{ settings: LoudnessSettings }>("settings/video-loudness", {
          method: "PUT",
          body: JSON.stringify(loudness),
        }),
      ]);
      if (social.status === "rejected" || volume.status === "rejected")
        throw new Error("Could not save all settings");
      setAccounts(social.value.accounts);
      setLoudness(volume.value.settings);
      notify("Settings saved.");
    } catch {
      notify("Could not save settings. Try again.", "error");
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
            {t(
              "Configure titles, domains and social media accounts for each language, and voice volume.",
            )}
          </p>
        </div>
      </div>
      {loading ? (
        <p className="empty">{t("Loading settings…")}</p>
      ) : (
        <form onSubmit={submit} className="social-settings-form">
          {error && (
            <p className="error" role="alert">
              {t(error)}
            </p>
          )}
          <div className="social-settings-intro">
            <div>
              <h2>{t("Titles, domains and social media accounts")}</h2>
              <p className="muted">
                {t(
                  "Set the short title, full title and domain for each language, for use in videos and on websites. Titles start empty; the examples are only suggestions. Enter social media usernames with or without @, and leave any unused fields empty.",
                )}
              </p>
            </div>
          </div>
          <div className="social-settings-grid">
            {languages.map(([locale, label]) => (
              <fieldset
                className="panel social-settings-language"
                key={locale}
                disabled={busy || loadFailed}
              >
                <legend>
                  <Globe size={17} />
                  {t(label)}
                  <small>{locale.toUpperCase()}</small>
                </legend>
                {(
                  [
                    ["shortTitle", "Short title", "VeoBible", 100],
                    [
                      "title",
                      "Title",
                      locale === "es"
                        ? "VeoBible en Español"
                        : locale === "en"
                          ? "VeoBible in English"
                          : "VeoBible em Português",
                      200,
                    ],
                  ] as const
                ).map(([field, fieldLabel, example, maxLength]) => (
                  <label key={field} htmlFor={`${field}-${locale}`}>
                    {t(fieldLabel)}
                    <input
                      id={`${field}-${locale}`}
                      type="text"
                      autoComplete="off"
                      placeholder={example}
                      maxLength={maxLength}
                      value={accounts[locale][field]}
                      aria-label={`${t(fieldLabel)} · ${t(label)}`}
                      onChange={(event) => {
                        setAccounts((current) => ({
                          ...current,
                          [locale]: {
                            ...current[locale],
                            [field]: event.target.value,
                          },
                        }));
                      }}
                    />
                  </label>
                ))}
                <label htmlFor={`domain-${locale}`}>
                  {t("Domain")}
                  <input
                    id={`domain-${locale}`}
                    type="text"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="veobible.com"
                    maxLength={253}
                    value={accounts[locale].domain}
                    aria-label={`${t("Domain")} · ${t(label)}`}
                    onChange={(event) => {
                      setAccounts((current) => ({
                        ...current,
                        [locale]: {
                          ...current[locale],
                          domain: event.target.value,
                        },
                      }));
                    }}
                  />
                </label>
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
                      }}
                    />
                  </label>
                ))}
              </fieldset>
            ))}
          </div>
          <LoudnessSettingsPanel
            settings={loudness}
            onChange={setLoudness}
            disabled={busy || loadFailed}
          />
          <div className="social-settings-footer">
            <p className="muted">
              {t(
                "Changes apply to audio playback, previews and the next videos you generate.",
              )}
            </p>
            <button
              type="submit"
              className="primary"
              disabled={busy || loadFailed}
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
