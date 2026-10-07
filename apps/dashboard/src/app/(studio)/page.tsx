"use client";
import { useI18n } from "../../i18n/context";
import { userMessage, statusLabel } from "../../lib/presentation";
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
          <p className="eyebrow">{t("RESUMEN DE PRODUCCIÓN")}</p>
          <h1>{t("Dashboard")}</h1>
          <p className="muted">
            {t("Cada historia empieza aquí. Organiza tu próxima producción.")}
          </p>
        </div>
        <Link className="primary" href="/short-videos">
          {t("Crear un video")} <ArrowUpRight size={17} />
        </Link>
      </div>
      {error && <p className="error">{t(error)}</p>}
      <div className="stats">
        {[
          [
            Clapperboard,
            "Pasajes cortos",
            count("short"),
            "Catálogo Daily Dose",
          ],
          [
            Film,
            "Episodios largos",
            count("long"),
            "Plan de lectura · 365 días",
          ],
          [
            CheckCheck,
            "Sin usar",
            data?.unused?.total ?? 0,
            "Proyectos disponibles",
          ],
          [Send, "Usados", data?.used?.total ?? 0, "Proyectos utilizados"],
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
      <div className="overview-grid">
        <section className="hero-card">
          <div className="hero-orb">
            <BookOpen size={130} />
          </div>
          <p className="eyebrow">{t("CREA CON PROPÓSITO")}</p>
          <h2>
            {t("La Palabra,")}
            <br />
            {t("en cada pantalla.")}
          </h2>
          <p>
            {t("Dos formatos. Un mismo propósito.")}
            <br />
            {t("Elige un pasaje y crea tu próximo video.")}
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
          <h3>{t("Actividad reciente")}</h3>
          <span className="muted">{t("Últimas producciones")}</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("Proyecto")}</th>
                <th>{t("Formato")}</th>
                <th>{t("Versión")}</th>
                <th>{t("Uso")}</th>
                <th>{t("Actualizado")}</th>
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
                    <span className="badge">
                      {t(p.used ? "Usado" : "Sin usar")}
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
                "Tu próximo video aparecerá aquí. Elige un pasaje para comenzar.",
              )}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
