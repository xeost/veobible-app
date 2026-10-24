"use client";
import { useEffect, useState } from "react";
import { useI18n } from "../i18n/context";
import { SocialSettings } from "./SocialSettings";
import { VoiceGenerationSettings } from "./VoiceGenerationSettings";

const storageKey = "veo-settings-active-tab";
const tabs = [
  { id: "general", label: "General" },
  { id: "voices", label: "Narration voices" },
] as const;
type SettingsTab = (typeof tabs)[number]["id"];

export function Settings() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored === "general" || stored === "voices") setActiveTab(stored);
    } catch {
      // Settings remain usable when browser storage is unavailable.
    }
    setReady(true);
  }, []);

  function selectTab(tab: SettingsTab) {
    setActiveTab(tab);
    try {
      localStorage.setItem(storageKey, tab);
    } catch {
      // Keep tab navigation available even if the preference cannot be saved.
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{t("SETTINGS")}</p>
          <h1>{t("System settings")}</h1>
          <p className="muted">
            {t("Configure publishing, narration voices and voice volume.")}
          </p>
        </div>
      </div>
      {ready && (
        <>
          <div
            className="tabs"
            role="tablist"
            aria-label={t("System settings")}
          >
            {tabs.map((tab, index) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`settings-${tab.id}-tab`}
                aria-controls={`settings-${tab.id}-panel`}
                aria-selected={activeTab === tab.id}
                tabIndex={activeTab === tab.id ? 0 : -1}
                className={activeTab === tab.id ? "active" : ""}
                onClick={() => selectTab(tab.id)}
                onKeyDown={(event) => {
                  let next: number;
                  if (event.key === "ArrowRight")
                    next = (index + 1) % tabs.length;
                  else if (event.key === "ArrowLeft")
                    next = (index + tabs.length - 1) % tabs.length;
                  else if (event.key === "Home") next = 0;
                  else if (event.key === "End") next = tabs.length - 1;
                  else return;
                  event.preventDefault();
                  selectTab(tabs[next].id);
                  document
                    .getElementById(`settings-${tabs[next].id}-tab`)
                    ?.focus();
                }}
              >
                {t(tab.label)}
              </button>
            ))}
          </div>
          <div
            role="tabpanel"
            id="settings-general-panel"
            aria-labelledby="settings-general-tab"
            hidden={activeTab !== "general"}
            tabIndex={0}
          >
            <SocialSettings />
          </div>
          <div
            role="tabpanel"
            id="settings-voices-panel"
            aria-labelledby="settings-voices-tab"
            hidden={activeTab !== "voices"}
            tabIndex={0}
          >
            <VoiceGenerationSettings />
          </div>
        </>
      )}
    </>
  );
}
