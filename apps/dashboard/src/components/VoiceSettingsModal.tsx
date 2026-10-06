"use client";
import { useEffect, useRef, useState } from "react";
import { X, Save, Mic } from "lucide-react";
import { useI18n } from "../i18n/context";
import { api } from "./api";
import {
  emptyVoiceSettings,
  voiceSettingsSchema,
  type VoiceSettings,
} from "../lib/voice-settings";
export function VoiceSettingsModal({
  kind,
  close,
  canEdit,
}: {
  kind: "short" | "long";
  close: () => void;
  canEdit: boolean;
}) {
  const { t } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const [templates, setTemplates] = useState<VoiceSettings>(emptyVoiceSettings);
  const [loading, setLoading] = useState(true),
    [loadFailed, setLoadFailed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    dialog.current?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    api<{ templates: VoiceSettings }>(`settings/voice-templates?kind=${kind}`)
      .then((data) => {
        if (live) setTemplates(data.templates);
      })
      .catch(() => {
        if (live) {
          setLoadFailed(true);
          setError(
            "No se pudieron cargar los textos de voz. Cierra y vuelve a abrir Settings.",
          );
        }
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
      document.body.style.overflow = overflow;
    };
  }, [kind]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = voiceSettingsSchema.safeParse(templates);
    if (!parsed.success) {
      setError(
        "Revisa los marcadores de los textos y usa un máximo de 10000 caracteres por sección.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api(`settings/voice-templates?kind=${kind}`, {
        method: "PUT",
        body: JSON.stringify(parsed.data),
      });
      close();
    } catch {
      setError(
        "No se pudieron guardar los textos de voz. Vuelve a intentarlo.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <dialog
      ref={dialog}
      className="generation-queue-dialog voice-settings-dialog"
      aria-labelledby="voice-settings-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) close();
      }}
    >
      <form onSubmit={submit}>
        <div className="generation-queue-heading">
          <div>
            <p className="eyebrow">
              {t(kind === "short" ? "Short Videos" : "Long Videos")}
            </p>
            <h2 id="voice-settings-title">
              <Mic size={22} />
              {t("Settings de voz")}
            </h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label={t("Cerrar")}
            disabled={busy}
            onClick={close}
          >
            <X size={20} />
          </button>
        </div>
        <p className="muted">
          {t(
            "Configura los textos de introducción y cierre en cada idioma. Se usarán en las próximas generaciones de voz y video.",
          )}
        </p>
        <p className="notice">
          {t(
            "Usa {reference} para el pasaje, {version} para la versión bíblica, {book} para el libro, {start} para el inicio y {end} para el final.",
          )}
        </p>
        {!canEdit && (
          <p className="muted">
            {t("Solo los administradores pueden cambiar estos ajustes.")}
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {t(error)}
          </p>
        )}
        {loading ? (
          <p className="empty">{t("Cargando textos de voz…")}</p>
        ) : (
          <fieldset
            disabled={busy || loadFailed || !canEdit}
            className="voice-settings-fields"
          >
            {(
              [
                ["es", "Español"],
                ["en", "Inglés"],
                ["pt", "Portugués"],
              ] as const
            ).map(([locale, label]) => (
              <section className="voice-settings-language" key={locale}>
                <h3>{t(label)}</h3>
                {(["intro", "outro"] as const).map((part) => (
                  <label key={part} htmlFor={`voice-${locale}-${part}`}>
                    {t(part === "intro" ? "Introducción" : "Cierre")}
                    <textarea
                      id={`voice-${locale}-${part}`}
                      aria-label={`${t(part === "intro" ? "Introducción" : "Cierre")} · ${t(label)}`}
                      value={templates[locale][part]}
                      maxLength={10000}
                      rows={4}
                      onChange={(event) =>
                        setTemplates((current) => ({
                          ...current,
                          [locale]: {
                            ...current[locale],
                            [part]: event.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                ))}
              </section>
            ))}
          </fieldset>
        )}
        <div className="modal-footer">
          <button type="button" disabled={busy} onClick={close}>
            {t("Cerrar")}
          </button>
          {canEdit && (
            <button
              type="submit"
              className="primary"
              disabled={loading || loadFailed || busy}
            >
              <Save size={16} />
              {t(busy ? "Guardando…" : "Guardar cambios")}
            </button>
          )}
        </div>
      </form>
    </dialog>
  );
}
