"use client";
import Link from "next/link";
import { WebsitePages } from "../../../components/WebsitePages";
import { Rocket, Download, Film, Clapperboard } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../../components/api";
import { useI18n } from "../../../i18n/context";
import { useToast } from "../../../components/ToastProvider";
import { userMessage } from "../../../lib/presentation";
import type { WebsiteSource } from "../../../lib/website";
const activeTabStorageKey = "veo-website-active-tab";
type WebsiteTab = "short" | "long" | "import";
type Source = WebsiteSource;
type Data = {
  siteUrl: string | null;
  sources: Source[];
  catalog: Record<
    string,
    { name: string; books: { id: string; name: string }[] }
  >;
};
export default function Website() {
  const { t } = useI18n();
  const notify = useToast();
  const [tab, setTab] = useState<WebsiteTab>("import");
  useEffect(() => {
    try {
      const stored = localStorage.getItem(activeTabStorageKey);
      if (stored === "short" || stored === "long" || stored === "import")
        setTab(stored);
      else if (stored === "projects") setTab("short");
    } catch {
      // Tab navigation remains available when browser storage is unavailable.
    }
  }, []);
  const selectTab = (value: WebsiteTab) => {
    setTab(value);
    try {
      localStorage.setItem(activeTabStorageKey, value);
    } catch {
      // Saving the preference is optional; selecting a tab should always work.
    }
  };
  const [data, setData] = useState<Data | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const scan = useRef<AbortController | null>(null);
  useEffect(() => () => scan.current?.abort(), []);
  const load = useCallback(async () => {
    try {
      const d = await api<Data>("website");
      setData(d);
      setSources(d.sources);
      setError("");
    } catch (e) {
      setError(userMessage(e));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const action = async (path: string, body: unknown) => {
    setBusy(true);
    setError("");
    try {
      const r = await api<any>(`website/${path}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      await load();
      notify("Settings saved.");
      return r;
    } catch (e) {
      setError(userMessage(e));
      return null;
    } finally {
      setBusy(false);
    }
  };
  const scanChannels = async (channels: string[]) => {
    if (scan.current) return;
    const controller = new AbortController();
    scan.current = controller;
    setBusy(true);
    setError("");
    let imported = 0,
      projects = 0,
      books = 0,
      ambiguous = 0,
      pending = 0;
    const notes: string[] = [];
    const run = crypto.randomUUID();
    const noteText = {
      templates:
        "Review the YouTube title in Publication templates for the video format and language.",
      "not-found": "No matching videos were found in the available catalog.",
      blocked: "YouTube asked us to wait. Try again later.",
      ambiguous: "Some videos could not be matched with certainty.",
      limit:
        "The search paused after checking several catalog pages. You can continue later.",
      unreadable: "The YouTube catalog could not be read. Try again later.",
    };
    try {
      for (const channel of channels) {
        let more = true;
        while (more && !controller.signal.aborted) {
          const result = await api<{
            imported: number;
            projects: number;
            books: number;
            ambiguous: number;
            pending: number;
            more: boolean;
            retryAfterMs?: number;
            state: string;
            note?: keyof typeof noteText;
          }>("website/import", {
            method: "POST",
            body: JSON.stringify({ channel, run }),
            signal: controller.signal,
          });
          imported += result.imported;
          projects += result.projects;
          books += result.books;
          ambiguous = result.ambiguous;
          pending = result.pending;
          more = result.more;
          if (result.note) notes.push(t(noteText[result.note]));
          if (more && result.retryAfterMs)
            await new Promise<void>((resolve) => {
              const done = () => {
                clearTimeout(timer);
                controller.signal.removeEventListener("abort", done);
                resolve();
              };
              const timer = setTimeout(
                done,
                Math.min(result.retryAfterMs!, 10000),
              );
              controller.signal.addEventListener("abort", done, { once: true });
            });
        }
      }
      if (controller.signal.aborted) return;
      notify(
        [
          `${t("Videos imported")}: ${imported}`,
          `${t("Projects matched")}: ${projects}`,
          `${t("Books matched")}: ${books}`,
          `${t("Pending projects")}: ${pending}`,
          `${t("Matches requiring review")}: ${ambiguous}`,
          ...new Set(notes),
        ].join("\n"),
        pending || ambiguous || notes.length ? "info" : "success",
      );
      await load();
    } catch (e) {
      if (!controller.signal.aborted) setError(userMessage(e));
    } finally {
      scan.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  return (
    <div className="website-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{t("PLATFORM MANAGEMENT")}</p>
          <h1>{t("Website")}</h1>
          <p className="muted">
            {t(
              "Prepare website pages from videos already published on social media.",
            )}
          </p>
        </div>
        <Link href="/deployments" className="button">
          <Rocket size={16} aria-hidden="true" />
          {t("Publications")}
        </Link>
      </div>
      <div
        className="tabs website-tabs"
        role="tablist"
        aria-label={t("Website")}
      >
        <button
          role="tab"
          className={tab === "import" ? "active" : ""}
          id="website-import-tab"
          aria-controls="website-import"
          aria-selected={tab === "import"}
          onClick={() => selectTab("import")}
        >
          <Film size={15} aria-hidden="true" />
          {t("Videos on social media")}
        </button>
        {(["short", "long"] as const).map((kind) => (
          <button
            key={kind}
            role="tab"
            className={tab === kind ? "active" : ""}
            id={`website-${kind}-tab`}
            aria-controls={`website-${kind}`}
            aria-selected={tab === kind}
            onClick={() => selectTab(kind)}
          >
            {kind === "short" ? (
              <Clapperboard size={15} aria-hidden="true" />
            ) : (
              <Film size={15} aria-hidden="true" />
            )}
            {t(kind === "short" ? "Daily dose of God" : "Bible in 365 days")}
          </button>
        ))}
      </div>
      {error && (
        <p className="error" role="alert">
          {t(error)}
        </p>
      )}
      {!data && <p className="empty">{t("Loading…")}</p>}
      {data && tab !== "import" && (
        <div
          role="tabpanel"
          id={`website-${tab}`}
          aria-labelledby={`website-${tab}-tab`}
        >
          <WebsitePages key={tab} kind={tab} siteUrl={data.siteUrl} />
        </div>
      )}
      {data && tab === "import" && (
        <div
          role="tabpanel"
          id="website-import"
          aria-labelledby="website-import-tab"
        >
          <section className="panel website-panel">
            <h2>{t("YouTube imports")}</h2>
            <p className="muted">
              {t(
                "Import YouTube videos to find links for published video projects. Existing links are kept. Ambiguous matches require review.",
              )}
            </p>
            <div className="table-wrap website-table">
              <table className="website-sources-table">
                <thead>
                  <tr>
                    {[
                      "Bible version",
                      "YouTube channel",
                      "First publication date",
                      "Enabled",
                    ].map((s) => (
                      <th key={s}>{t(s)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sources.map((s, i) => (
                    <tr key={`${s.locale}/${s.version}`}>
                      <td>
                        {data.catalog[`${s.locale}/${s.version}`]?.name ??
                          s.version}
                      </td>
                      <td>
                        <span>{s.channel || t("Not configured")}</span>
                      </td>
                      <td>
                        <input
                          type="date"
                          aria-label={`${t("First publication date")} ${s.version}`}
                          value={s.since}
                          disabled={busy}
                          onChange={(e) =>
                            setSources((a) =>
                              a.map((v, j) =>
                                j === i ? { ...v, since: e.target.value } : v,
                              ),
                            )
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="website-checkbox"
                          type="checkbox"
                          aria-label={`${t("Enabled")} ${s.version}`}
                          checked={s.enabled}
                          disabled={busy}
                          onChange={(e) =>
                            setSources((a) =>
                              a.map((v, j) =>
                                j === i
                                  ? { ...v, enabled: e.target.checked }
                                  : v,
                              ),
                            )
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted">
              {t(
                "When a channel contains several Bible versions, the latest first publication date before each video determines its version.",
              )}
            </p>
            <button
              className="primary"
              disabled={busy}
              onClick={() => void action("sources", sources)}
            >
              {t("Save changes")}
            </button>
            <div className="deployment-actions website-actions website-channel-actions">
              {[
                ...new Set(
                  data.sources
                    .filter((s) => s.enabled && s.channel)
                    .map((s) => s.channel),
                ),
              ].map((channel) => (
                <button
                  key={channel}
                  disabled={busy}
                  onClick={() => void scanChannels([channel])}
                >
                  <Download size={15} aria-hidden="true" />
                  {t(
                    busy ? "Detecting videos…" : "Detect YouTube links",
                  )} · {channel}
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
