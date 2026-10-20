"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AudioLines,
  Plus,
  Search,
  X,
  ArrowRight,
  LoaderCircle,
} from "lucide-react";
import type {
  AudioProjectSummary,
  AudioVersion,
} from "../../../../tools/video-project-api/src/audio-project-schema";
import { useI18n } from "../i18n/context";
import { api } from "./api";
import { useToast } from "./ToastProvider";
import { useModalDismiss } from "./useModalDismiss";
import { statusLabel } from "../lib/presentation";
export type AudioVersionOption = AudioVersion & {
  edition: string;
  number: number;
};
function CreateAudioProjects({
  close,
  created,
}: {
  close: () => void;
  created: (edition: string) => void;
}) {
  const { t } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const [options, setOptions] = useState<AudioVersionOption[]>([]);
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const dismiss = useModalDismiss(() => {
    if (!busy) close();
  });
  const load = async () => {
    const data = await api<{ versions: AudioVersionOption[] }>(
      "audios/options",
    );
    setOptions(data.versions);
    setSelected((current) =>
      data.versions.some((v) => v.id === current)
        ? current
        : (data.versions[0]?.id ?? 0),
    );
  };
  useEffect(() => {
    dialog.current?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    void load()
      .catch(() => setError("Could not load audio versions. Try again."))
      .finally(() => setLoading(false));
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  const option = options.find((v) => v.id === selected);
  return (
    <dialog
      ref={dialog}
      {...dismiss}
      className="generation-queue-dialog voice-settings-dialog"
      aria-labelledby="create-audio-title"
    >
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (!option || busy) return;
          setBusy(true);
          setError("");
          try {
            const result = await api<{ edition: string }>("audios", {
              method: "POST",
              body: JSON.stringify({
                versionId: selected,
                edition: option.edition,
              }),
            });
            created(result.edition);
          } catch {
            setError(
              "Could not create audio projects. Reload the available versions and try again.",
            );
            await load().catch(() => {});
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="generation-queue-heading">
          <h2 id="create-audio-title">{t("Create audio projects")}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label={t("Close")}
            onClick={close}
            disabled={busy}
          >
            <X size={20} />
          </button>
        </div>
        <p className="muted">
          {t(
            "Create one audio project for each book in a new audio version. Original recordings and previous audio versions are preserved.",
          )}
        </p>
        {error && (
          <p className="error" role="alert">
            {t(error)}
          </p>
        )}
        {loading ? (
          <p className="empty">{t("Loading versions…")}</p>
        ) : (
          <fieldset
            className="voice-settings-fields"
            disabled={busy || !options.length}
          >
            <label>
              {t("Bible version")}
              <select
                value={selected}
                onChange={(event) => setSelected(Number(event.target.value))}
              >
                {options.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.locale.toUpperCase()} · {v.label} · {t("Audio version")}{" "}
                    {v.number}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>
        )}
        {!loading && !options.length && (
          <p className="notice">
            {t("Add a Bible version before creating audio projects.")}
          </p>
        )}
        <div className="modal-footer">
          <button type="button" onClick={close} disabled={busy}>
            {t("Cancel")}
          </button>
          <button className="primary" disabled={busy || loading || !option}>
            {busy ? (
              <LoaderCircle size={16} className="voice-spinner" />
            ) : (
              <Plus size={16} />
            )}
            {t("Create audio projects")}
          </button>
        </div>
      </form>
    </dialog>
  );
}
export function Audios() {
  const { t, language } = useI18n();
  const notify = useToast();
  const [rows, setRows] = useState<AudioProjectSummary[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [create, setCreate] = useState(false),
    [edition, setEdition] = useState(""),
    [query, setQuery] = useState("");
  const load = useCallback(async () => {
    setError("");
    try {
      setRows(
        (await api<{ projects: AudioProjectSummary[] }>("audios")).projects,
      );
    } catch {
      setError(
        "Could not load audio projects. Check that generation is available and try again.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const editions = [...new Map(rows.map((p) => [p.edition, p])).values()];
  const visible = rows.filter(
    (p) =>
      (!edition || p.edition === edition) &&
      (!query ||
        `${p.title} ${p.version.label}`
          .toLocaleLowerCase()
          .includes(query.toLocaleLowerCase())),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{t("YOUR PROJECTS")}</p>
          <h1>{t("Audios")}</h1>
          <p className="muted">
            {t("Prepare chapter recordings to use in your videos.")}
          </p>
        </div>
        <button className="primary" onClick={() => setCreate(true)}>
          <Plus size={17} />
          {t("Create audio projects")}
        </button>
      </div>
      <div className="audio-project-filters">
        <label>
          {t("Audio version")}
          <select
            value={edition}
            onChange={(event) => setEdition(event.target.value)}
          >
            <option value="">{t("All versions")}</option>
            {editions.map((p) => (
              <option key={p.edition} value={p.edition}>
                {p.version.label} · {t("Audio version")}{" "}
                {p.edition.match(/-v(\d+)$/)?.[1]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>
            <Search size={14} /> {t("Search books")}
          </span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("Search books")}
          />
        </label>
      </div>
      {error && (
        <p className="error" role="alert">
          {t(error)} <button onClick={() => void load()}>{t("Retry")}</button>
        </p>
      )}
      {loading ? (
        <p className="empty">{t("Loading projects…")}</p>
      ) : !visible.length && !error ? (
        <div className="empty">
          <AudioLines size={30} />
          <h2>{t("No audio projects yet")}</h2>
          <p>
            {t(
              "Create a new audio version to start preparing chapter recordings.",
            )}
          </p>
        </div>
      ) : (
        <div className="audio-project-groups">
          {editions
            .filter((group) => visible.some((p) => p.edition === group.edition))
            .map((group) => (
              <section className="panel" key={group.edition}>
                <h2>
                  {group.version.label} · {t("Audio version")}{" "}
                  {group.edition.match(/-v(\d+)$/)?.[1]}
                </h2>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>{t("Book")}</th>
                        <th>{t("Chapters")}</th>
                        <th>{t("Status")}</th>
                        <th>
                          <span className="sr-only">{t("Open project")}</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible
                        .filter((p) => p.edition === group.edition)
                        .map((p) => (
                          <tr key={p.book}>
                            <td>
                              <Link href={`/audios/${p.edition}/${p.book}`}>
                                {p.title}
                              </Link>
                            </td>
                            <td>
                              {Object.keys(p.chapters).length} /{" "}
                              {p.chapterCount}
                            </td>
                            <td>{statusLabel(p.status, language)}</td>
                            <td>
                              <Link
                                className="icon-button"
                                href={`/audios/${p.edition}/${p.book}`}
                                aria-label={`${t("Open project")}: ${p.title}`}
                              >
                                <ArrowRight size={17} />
                              </Link>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
        </div>
      )}
      {create && (
        <CreateAudioProjects
          close={() => setCreate(false)}
          created={(value) => {
            setCreate(false);
            setEdition(value);
            void load();
            notify("Audio projects created.", "success");
          }}
        />
      )}
    </>
  );
}
