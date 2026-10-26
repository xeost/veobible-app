"use client";
import { useEffect, useState } from "react";
import { useI18n } from "../i18n/context";
import { CurrentVideoProjects } from "./CurrentVideoProjects";
import { CurrentAudioProjects } from "./CurrentAudioProjects";
import { useHomeScrollPosition } from "./useHomeScrollPosition";

const storageKey = "veo-ongoing-projects-active-tab";
const tabs = [
  { id: "all", label: "All languages" },
  { id: "es", label: "Spanish" },
  { id: "en", label: "English" },
  { id: "pt", label: "Portuguese" },
] as const;
type ProjectTab = (typeof tabs)[number]["id"];

export function OngoingProjects() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<ProjectTab>("all");
  const [ready, setReady] = useState(false);
  const [videosLoading, setVideosLoading] = useState(true);
  const [audiosLoading, setAudiosLoading] = useState(true);
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (tabs.some((tab) => tab.id === stored))
        setActiveTab(stored as ProjectTab);
    } catch {
      // Keep navigation available when browser storage is blocked.
    }
    setReady(true);
  }, []);
  useHomeScrollPosition(
    ready && !videosLoading && !audiosLoading,
    `veo-ongoing-projects-scroll:${activeTab}`,
  );
  const selectTab = (tab: ProjectTab) => {
    setActiveTab(tab);
    try {
      localStorage.setItem(storageKey, tab);
    } catch {
      // Keep the selected tab available for this visit.
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{t("Ongoing projects")}</h1>
          <p className="muted">
            {t("Resume your marked projects and continue working by language.")}
          </p>
        </div>
      </div>
      {ready && (
        <>
          <div
            className="tabs"
            role="tablist"
            aria-label={t("Ongoing projects")}
          >
            {tabs.map((tab, index) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`ongoing-${tab.id}-tab`}
                aria-controls="ongoing-projects-panel"
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
                    .getElementById(`ongoing-${tabs[next].id}-tab`)
                    ?.focus({ preventScroll: true });
                }}
              >
                {t(tab.label)}
              </button>
            ))}
          </div>
          <div
            id="ongoing-projects-panel"
            role="tabpanel"
            aria-labelledby={`ongoing-${activeTab}-tab`}
            tabIndex={0}
          >
            <CurrentVideoProjects
              locale={activeTab}
              onLoadingChange={setVideosLoading}
            />
            <CurrentAudioProjects
              locale={activeTab}
              onLoadingChange={setAudiosLoading}
            />
          </div>
        </>
      )}
    </>
  );
}
