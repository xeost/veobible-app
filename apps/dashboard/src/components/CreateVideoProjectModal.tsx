"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { api } from "./api";
import { useI18n } from "../i18n/context";
import { userMessage } from "../lib/presentation";
import {
  validateManualVideoProject,
  type BibleBook,
} from "../lib/manual-video-project";
import type { BibleVersion } from "../lib/bible-versions";
type Point = { book: string; chapter: number; verse: number };
export function CreateVideoProjectModal({
  kind,
  close,
}: {
  kind: "short" | "long";
  close: () => void;
}) {
  const { t } = useI18n(),
    router = useRouter(),
    dialog = useRef<HTMLDialogElement>(null);
  const [versions, setVersions] = useState<BibleVersion[]>([]),
    [version, setVersion] = useState(""),
    [books, setBooks] = useState<BibleBook[]>([]);
  const [loading, setLoading] = useState(true),
    [loadingBooks, setLoadingBooks] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [title, setTitle] = useState(""),
    [slug, setSlug] = useState(""),
    [episode, setEpisode] = useState(1);
  const [start, setStart] = useState<Point>({ book: "", chapter: 1, verse: 1 }),
    [end, setEnd] = useState<Point>({ book: "", chapter: 1, verse: 1 });
  useEffect(() => {
    let live = true;
    dialog.current?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    api<{ versions: BibleVersion[] }>("versions")
      .then((data) => {
        if (live) {
          setVersions(data.versions);
          setVersion(String(data.versions[0]?.id ?? ""));
        }
      })
      .catch((cause) => {
        if (live) setError(userMessage(cause));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
      document.body.style.overflow = overflow;
    };
  }, []);
  useEffect(() => {
    if (!version) return;
    let live = true;
    setBooks([]);
    setLoadingBooks(true);
    setError("");
    api<{ books: BibleBook[] }>(`versions/${version}/books`)
      .then((data) => {
        if (live) {
          setBooks(data.books);
          setStart({ book: data.books[0].id, chapter: 1, verse: 1 });
          setEnd({ book: data.books[0].id, chapter: 1, verse: 1 });
        }
      })
      .catch((cause) => {
        if (live) setError(userMessage(cause));
      })
      .finally(() => {
        if (live) setLoadingBooks(false);
      });
    return () => {
      live = false;
    };
  }, [version]);
  const pointFields = (
    edge: "start" | "end",
    point: Point,
    update: (value: Point) => void,
  ) => {
    const book = books.find((row) => row.id === point.book),
      initial = edge === "start";
    return (
      <fieldset className="manual-passage-point">
        <legend>{t(initial ? "Inicio del pasaje" : "Final del pasaje")}</legend>
        <label>
          {t(initial ? "Libro de inicio" : "Libro de final")}
          <select
            required
            value={point.book}
            onChange={(event) =>
              update({ book: event.target.value, chapter: 1, verse: 1 })
            }
          >
            {books.map((book) => (
              <option key={book.id} value={book.id}>
                {book.name}
              </option>
            ))}
          </select>
        </label>
        <div className="manual-passage-numbers">
          <label>
            {t(initial ? "Capítulo de inicio" : "Capítulo de final")}
            <input
              type="number"
              required
              min={1}
              max={book?.chapters}
              step={1}
              value={point.chapter || ""}
              onChange={(event) =>
                update({
                  ...point,
                  chapter: Number(event.target.value),
                  verse: 1,
                })
              }
            />
          </label>
          <label>
            {t(initial ? "Versículo de inicio" : "Versículo de final")}
            <input
              type="number"
              required
              min={1}
              max={book?.versesPerChapter[point.chapter - 1]}
              step={1}
              value={point.verse || ""}
              onChange={(event) =>
                update({ ...point, verse: Number(event.target.value) })
              }
            />
          </label>
        </div>
      </fieldset>
    );
  };
  return (
    <dialog
      ref={dialog}
      className="generation-queue-dialog voice-settings-dialog"
      aria-labelledby="create-video-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) close();
      }}
    >
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy || !books.length) return;
          setError("");
          const raw = {
            kind,
            versionId: Number(version),
            title,
            slug,
            ...(kind === "long" ? { episode } : {}),
            start,
            end,
          };
          let input;
          try {
            input = validateManualVideoProject(raw, books);
          } catch {
            setError(
              "Revisa el título, el nombre corto y los límites del pasaje.",
            );
            return;
          }
          setBusy(true);
          try {
            const project = await api<{ id: number }>("videos", {
              method: "POST",
              body: JSON.stringify(input),
            });
            router.push(
              `/${kind === "short" ? "short-videos" : "long-videos"}/${project.id}`,
            );
            close();
          } catch (cause) {
            setError(userMessage(cause));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="generation-queue-heading">
          <h2 id="create-video-title">{t("Nuevo proyecto de video")}</h2>
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
        {error && (
          <p className="error" role="alert">
            {t(error)}
          </p>
        )}
        {loading ? (
          <p>{t("Cargando versiones…")}</p>
        ) : !versions.length ? (
          <p className="notice">
            {t(
              "Añade una versión de la Biblia antes de crear un proyecto. Si no tienes acceso, solicita ayuda al administrador.",
            )}
          </p>
        ) : (
          <fieldset disabled={busy} className="voice-settings-fields">
            <label>
              {t("Versión bíblica")}
              <select
                required
                value={version}
                onChange={(event) => setVersion(event.target.value)}
              >
                {versions.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.locale.toUpperCase()} · {row.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("Título del proyecto")}
              <input
                required
                maxLength={500}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label>
              {t("Nombre corto")}
              <input
                required
                maxLength={200}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                placeholder={kind === "short" ? "john-3-14-19" : "episode-001"}
              />
              <small className="muted">
                {t(
                  "Debe ser único para esta versión. Usa letras minúsculas, números y guiones, sin espacios.",
                )}
              </small>
            </label>
            {kind === "long" && (
              <label>
                {t("Número de episodio")}
                <input
                  type="number"
                  required
                  min={1}
                  step={1}
                  value={episode || ""}
                  onChange={(event) => setEpisode(Number(event.target.value))}
                />
              </label>
            )}
            {loadingBooks ? (
              <p className="muted">{t("Cargando libros…")}</p>
            ) : (
              books.length > 0 && (
                <div className="manual-passage-points">
                  {pointFields("start", start, setStart)}
                  {pointFields("end", end, setEnd)}
                </div>
              )
            )}
          </fieldset>
        )}
        <div className="modal-footer">
          <button type="button" disabled={busy} onClick={close}>
            {t("Cerrar")}
          </button>
          <button
            className="primary"
            disabled={
              busy || loading || loadingBooks || !version || !books.length
            }
          >
            {t(busy ? "Guardando…" : "Crear proyecto")}
          </button>
        </div>
      </form>
    </dialog>
  );
}
