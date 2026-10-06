"use client";
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
  const [data, setData] = useState<any>(null),
    [error, setError] = useState("");
  useEffect(() => {
    api("summary")
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);
  const count = (kind: string) =>
    data?.catalog.find((v: any) => v.kind === kind)?.total ?? 0;
  const state = (status: string) =>
    data?.states.find((v: any) => v.status === status)?.total ?? 0;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">PRODUCTION OVERVIEW</p>
          <h1>Dashboard</h1>
          <p className="muted">
            Cada historia empieza aquí. Organiza tu próxima producción.
          </p>
        </div>
        <Link className="primary" href="/short-videos">
          Crear un video <ArrowUpRight size={17} />
        </Link>
      </div>
      {error && <p className="error">{error}</p>}
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
            "Videos generados",
            state("ready"),
            "Listos para compartir",
          ],
          [
            Send,
            "Publicados",
            data?.published?.total ?? 0,
            "Marcados en redes sociales",
          ],
        ].map(([Icon, label, note, sub]: any) => (
          <div className="stat" key={label}>
            <div className="stat-top">
              <span>{label}</span>
              <Icon size={18} />
            </div>
            <strong>{data ? note : "—"}</strong>
            <small>{sub}</small>
          </div>
        ))}
      </div>
      <div className="overview-grid">
        <section className="hero-card">
          <div className="hero-orb">
            <BookOpen size={130} />
          </div>
          <p className="eyebrow">CREATE WITH PURPOSE</p>
          <h2>
            La Palabra,
            <br />
            en cada pantalla.
          </h2>
          <p>
            Dos formatos. Un mismo propósito.
            <br />
            Genera videos con tus modelos de IA locales.
          </p>
          <div className="hero-links">
            <Link href="/short-videos">
              Daily Dose <ArrowUpRight size={16} />
            </Link>
            <Link href="/long-videos">
              365 Days <ArrowUpRight size={16} />
            </Link>
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h3>En producción</h3>
            <span className="badge running">
              {state("running") + state("queued")} activos
            </span>
          </div>
          {["draft", "queued", "running", "failed"].map((s) => (
            <div className="state-line" key={s}>
              <span>
                <i className={`dot ${s === "running" ? "green" : ""}`} />
                {
                  {
                    draft: "Borradores",
                    queued: "En cola",
                    running: "Generando",
                    failed: "Requieren atención",
                  }[s]
                }
              </span>
              <b>{state(s)}</b>
            </div>
          ))}
          <p className="panel-note">
            Los estados y ajustes viven en D1. Los audios, imágenes y videos
            permanecen en tu laptop.
          </p>
        </section>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <h3>Actividad reciente</h3>
          <span className="muted">Últimas producciones</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Proyecto</th>
                <th>Formato</th>
                <th>Versión</th>
                <th>Estado</th>
                <th>Actualizado</th>
              </tr>
            </thead>
            <tbody>
              {data?.recent.map((p: any) => (
                <tr key={p.id}>
                  <td>
                    <Link
                      href={
                        p.kind === "short" ? "/short-videos" : "/long-videos"
                      }
                    >
                      {p.title}
                    </Link>
                  </td>
                  <td>{p.kind === "short" ? "Short" : "Long"}</td>
                  <td>{p.label}</td>
                  <td>
                    <span className={`badge ${p.status}`}>{p.status}</span>
                  </td>
                  <td className="muted">{date(p.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data?.recent.length === 0 && (
            <div className="empty">
              Tu próximo video aparecerá aquí. Importa los estados de la CLI o
              comienza una producción.
            </div>
          )}
        </div>
      </section>
    </>
  );
}
