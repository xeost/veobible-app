"use client";
import { useEffect, useState } from "react";
import { Rocket, RefreshCw } from "lucide-react";
import { api, date } from "../../../components/api";
export default function Deployments() {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = () =>
    api("deployments")
      .then(setData)
      .catch((e) => setError(String(e)));
  useEffect(() => {
    void load();
  }, []);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">CLOUDFLARE WORKERS</p>
          <h1>Deployments</h1>
          <p className="muted">
            Publicaciones del dashboard y versiones del Worker.
          </p>
        </div>
        <button onClick={load}>
          <RefreshCw size={16} /> Actualizar
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      <section className="panel deployment-card">
        <div className="brand-icon">
          <Rocket size={24} />
        </div>
        <div>
          <h2>VeoBible Dashboard</h2>
          <p className="muted">ViNext · Cloudflare Workers · D1</p>
          <small>
            {data?.configured
              ? "Deploy hook configurado"
              : "Configura DASHBOARD_DEPLOY_HOOK para publicar"}
          </small>
        </div>
        <button
          className="primary"
          disabled={!data?.configured || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await api("deployments", { method: "POST", body: "{}" });
              await load();
            } catch (e) {
              setError(String(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Rocket size={16} /> {busy ? "Solicitando…" : "Publicar dashboard"}
        </button>
      </section>
      <section className="panel">
        <h3>Solicitudes de publicación</h3>
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Estado</th>
              <th>Detalles</th>
            </tr>
          </thead>
          <tbody>
            {data?.deployments.map((d: any) => (
              <tr key={d.id}>
                <td>{date(d.created_at)}</td>
                <td>
                  <span className="badge">{d.status}</span>
                </td>
                <td>
                  <details>
                    <summary>Ver respuesta</summary>
                    <pre>{d.details}</pre>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data?.deployments.length === 0 && (
          <p className="empty">Todavía no hay solicitudes de publicación.</p>
        )}
      </section>
      <section className="panel">
        <h3>Versiones publicadas en Cloudflare</h3>
        {data?.syncError && <p className="error">{data.syncError}</p>}
        {data?.cloudflare.length ? (
          data.cloudflare.map((d: any) => (
            <div className="state-line" key={d.id}>
              <span>{d.id}</span>
              <span className="muted">{date(d.created_on)}</span>
              <details>
                <summary>Versión</summary>
                <pre>{JSON.stringify(d, null, 2)}</pre>
              </details>
            </div>
          ))
        ) : (
          <p className="muted">
            Configura el account ID y un token con acceso al Worker para
            consultar versiones. El resultado del hook se registra como
            solicitud; las versiones publicadas se consultan por separado.
          </p>
        )}
      </section>
    </>
  );
}
