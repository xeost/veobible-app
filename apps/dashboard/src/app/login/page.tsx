"use client";
import { useState } from "react";
import { BookOpen, ArrowRight } from "lucide-react";
export default function Login() {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="login">
      <div className="login-art">
        <BookOpen size={64} />
        <p className="eyebrow">VEO BIBLE STUDIO</p>
        <h1>
          Historias eternas.
          <br />
          <span>Nuevas formas de contarlas.</span>
        </h1>
        <p>Tu espacio para crear, organizar y dar vida a la Palabra.</p>
        <div className="login-caption">SHORT VIDEOS · 365 DAYS · LOCAL AI</div>
      </div>
      <section className="login-form">
        <div className="brand-icon">
          <BookOpen size={28} />
        </div>
        <p className="eyebrow">BIENVENIDO AL STUDIO</p>
        <h2>Inicia sesión</h2>
        <p className="muted">Accede a tu espacio de producción de videos.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const form = new FormData(e.currentTarget);
            try {
              const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(Object.fromEntries(form)),
              });
              const data = (await response.json()) as { error?: string };
              if (!response.ok) throw new Error(data.error);
              window.location.assign("/");
            } catch (e) {
              setError(String(e));
              setBusy(false);
            }
          }}
        >
          <label>
            Usuario
            <input
              name="username"
              required
              autoComplete="username"
              placeholder="Tu usuario"
            />
          </label>
          <label>
            Contraseña
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="Tu contraseña"
            />
          </label>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy ? "Ingresando…" : "Entrar al Studio"}
            <ArrowRight size={17} />
          </button>
        </form>
        <small className="muted">Acceso privado · Usuarios del dashboard</small>
      </section>
    </div>
  );
}
