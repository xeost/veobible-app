"use client";
import { useI18n } from "../../i18n/context";
import { CurrentVideoProjects } from "../../components/CurrentVideoProjects";
import { userMessage, publicationLabel } from "../../lib/presentation";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Clapperboard,
  Film,
  CheckCheck,
  Send,
  ArrowUpRight,
  BookOpen,
} from "lucide-react";
import { api, date } from "../../components/api";
export default function Dashboard() {
  const { t, language } = useI18n();
  const [data, setData] = useState<any>(null),
    [error, setError] = useState("");
  useEffect(() => {
    api("summary")
      .then(setData)
      .catch((e) => setError(userMessage(e)));
  }, []);
  const count = (kind: string) =>
    data?.projects.find((v: any) => v.kind === kind)?.total ?? 0;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{t("PRODUCTION OVERVIEW")}</p>
          <h1>{t("Dashboard")}</h1>
          <p className="muted">
            {t("Every story starts here. Plan your next production.")}
          </p>
        </div>
        <Link className="primary" href="/short-videos">
          {t("Create a video")} <ArrowUpRight size={17} />
        </Link>
      </div>
      {error && <p className="error">{t(error)}</p>}
      <div className="stats">
        {[
          [
            Clapperboard,
            "Short passages",
            count("short"),
            "Daily Dose catalog",
          ],
          [Film, "Long episodes", count("long"), "Reading plan · 365 days"],
          [
            CheckCheck,
            "Unpublished",
            data?.unpublished?.total ?? 0,
            "Available projects",
          ],
          [Send, "Published", data?.published?.total ?? 0, "Published videos"],
        ].map(([Icon, label, note, sub]: any) => (
          <div className="stat" key={label}>
            <div className="stat-top">
              <span>{t(label)}</span>
              <Icon size={18} />
            </div>
            <strong>{data ? note : "—"}</strong>
            <small>{t(sub)}</small>
          </div>
        ))}
      </div>
      <CurrentVideoProjects />
      <div className="overview-grid">
        <section className="hero-card">
          <div className="hero-orb">
            <BookOpen size={130} />
          </div>
          <p className="eyebrow">{t("CREATE WITH PURPOSE")}</p>
          <h2>
            {t("The Word,")}
            <br />
            {t("on every screen.")}
          </h2>
          <p>
            {t("Two formats. One purpose.")}
            <br />
            {t("Choose a passage and create your next video.")}
          </p>
          <div className="hero-links">
            <Link href="/short-videos">
              {t("Daily Dose")} <ArrowUpRight size={16} />
            </Link>
            <Link href="/long-videos">
              {t("365 Days")} <ArrowUpRight size={16} />
            </Link>
          </div>
        </section>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <h3>{t("Recent activity")}</h3>
          <span className="muted">{t("Latest productions")}</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("Project")}</th>
                <th>{t("Format")}</th>
                <th>{t("Version")}</th>
                <th>{t("Publication")}</th>
                <th>{t("Updated")}</th>
              </tr>
            </thead>
            <tbody>
              {data?.recent.map((p: any) => (
                <tr key={p.id}>
                  <td>
                    <Link
                      href={`/${p.kind === "short" ? "short-videos" : "long-videos"}/${p.id}`}
                    >
                      {p.title}
                    </Link>
                  </td>
                  <td>{t(p.kind === "short" ? "Short" : "Long")}</td>
                  <td>{p.label}</td>
                  <td>
                    <span
                      className={`badge${p.published ? " publication-published" : ""}`}
                    >
                      {publicationLabel(p.published, language)}
                    </span>
                  </td>
                  <td className="muted">{date(p.updated_at, language)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data?.recent.length === 0 && (
            <div className="empty">
              {t(
                "Your next video will appear here. Choose a passage to get started.",
              )}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
