"use client";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { BrainCircuit, RefreshCw, ExternalLink } from "lucide-react";
import { useI18n } from "../i18n/context";
import { api } from "./api";
import {
  localModelsSchema,
  localModelUpdateSchema,
  type LocalModels,
  type LocalModelUpdate,
} from "../lib/local-models";
import {
  LocalModelUpdateResult,
  modelUpdateLabels,
} from "./LocalModelUpdateResult";

const roles = {
  voice: "Narration",
  alignment: "Reading timing",
  recognition: "Chapter heading recognition",
} as const;
const statuses = {
  downloaded: "Downloaded",
  not_downloaded: "Not downloaded",
  incomplete: "Incomplete download",
  unavailable: "Could not check",
  custom: "Custom configuration",
  local: "Local model",
} as const;
const languages = { es: "Spanish", en: "English", pt: "Portuguese" } as const;
export function AdminTools() {
  const { t, language } = useI18n();
  const [data, setData] = useState<LocalModels | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const updateRequest = useRef<AbortController | null>(null);
  const [checkingModel, setCheckingModel] = useState<string | null>(null);
  const [checks, setChecks] = useState<Record<string, LocalModelUpdate>>({});
  const [checkErrors, setCheckErrors] = useState<Record<string, string>>({});

  const refresh = useCallback(async (force = false) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    updateRequest.current?.abort();
    setCheckingModel(null);
    setChecks({});
    setCheckErrors({});
    setLoading(true);
    setError("");
    try {
      const result = localModelsSchema.parse(
        await api(`admin-tools/local-models${force ? "?refresh=1" : ""}`, {
          signal: controller.signal,
        }),
      );
      if (!controller.signal.aborted) setData(result);
    } catch {
      if (!controller.signal.aborted)
        setError(
          "Could not read local model versions. Check that generation is available and try again.",
        );
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    return () => {
      request.current?.abort();
      updateRequest.current?.abort();
    };
  }, [refresh]);
  const checkModel = async (model: LocalModels["models"][number]) => {
    if (loading || checkingModel) return;
    updateRequest.current?.abort();
    const controller = new AbortController();
    updateRequest.current = controller;
    setCheckingModel(model.id);
    setCheckErrors((current) => ({ ...current, [model.id]: "" }));
    setChecks((current) => {
      const next = { ...current };
      delete next[model.id];
      return next;
    });
    try {
      const result = localModelUpdateSchema.parse(
        await api(
          `admin-tools/local-models/${encodeURIComponent(model.id)}/updates`,
          { signal: controller.signal },
        ),
      );
      if (controller.signal.aborted) return;
      if (
        result.model.id !== model.id ||
        result.model.repository !== model.repository ||
        result.model.role !== model.role
      ) {
        setCheckErrors((current) => ({
          ...current,
          [model.id]:
            "The local model configuration changed. Refresh the list before checking again.",
        }));
        return;
      }
      setData((current) =>
        current
          ? {
              ...current,
              models: current.models.map((row) =>
                row.id === model.id ? result.model : row,
              ),
            }
          : current,
      );
      setChecks((current) => ({ ...current, [model.id]: result }));
    } catch {
      if (!controller.signal.aborted)
        setCheckErrors((current) => ({
          ...current,
          [model.id]:
            "Could not check model updates. Check that generation is available and try again.",
        }));
    } finally {
      if (!controller.signal.aborted) setCheckingModel(null);
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{t("Admin tools")}</h1>
          <p className="muted">
            {t("Review the tools used to prepare and create videos.")}
          </p>
        </div>
      </div>
      <div
        className="tabs admin-tools-tabs"
        role="tablist"
        aria-label={t("Admin tools")}
      >
        <button
          type="button"
          role="tab"
          id="local-models-tab"
          aria-selected="true"
          aria-controls="local-models-panel"
          className="active"
        >
          <BrainCircuit size={17} aria-hidden="true" />
          {t("Local AI models")}
        </button>
      </div>
      <section
        className="panel local-models-panel"
        role="tabpanel"
        id="local-models-panel"
        aria-labelledby="local-models-tab"
        aria-busy={loading}
      >
        <div className="local-models-heading">
          <div>
            <h2>{t("Current model versions")}</h2>
            <p className="muted">
              {t(
                "Versions found on the Mac used to create videos. Reading this information does not load or download models.",
              )}
            </p>
          </div>
          <button
            type="button"
            disabled={loading || checkingModel !== null}
            onClick={() => void refresh(true)}
          >
            <RefreshCw
              size={16}
              aria-hidden="true"
              className={loading ? "voice-spinner" : undefined}
            />
            {t("Refresh")}
          </button>
        </div>
        <p className="muted local-models-note">
          {t(
            "Target computer: MacBook Air M2 · 16 GB RAM. Checks run manually and do not install updates.",
          )}
        </p>
        {error && (
          <p className="error" role="alert">
            {t(error)}
          </p>
        )}
        {loading && (
          <p className="empty" role="status">
            {t("Reading local model versions…")}
          </p>
        )}
        {data && (
          <>
            <div className="table-wrap">
              <table className="catalog local-models-table">
                <thead>
                  <tr>
                    <th scope="col">{t("Model")}</th>
                    <th scope="col">{t("Used for")}</th>
                    <th scope="col">{t("Local revision")}</th>
                    <th scope="col">{t("Installed software")}</th>
                    <th scope="col">{t("Status")}</th>
                    <th scope="col">{t("Model updates")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.models.map((model) => (
                    <Fragment key={model.id}>
                      <tr>
                        <td>
                          <strong>{t(model.name)}</strong>
                          {(model.variant === "chatterbox-v2" ||
                            model.variant === "chatterbox-v3") && (
                            <small>
                              {t(
                                model.variant === "chatterbox-v3"
                                  ? "Selected variant: Multilingual V3"
                                  : "Selected variant: Multilingual V2",
                              )}
                            </small>
                          )}
                          {model.repository && (
                            <a
                              className="local-model-source"
                              href={`https://huggingface.co/${model.repository}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {model.repository}
                              <ExternalLink size={12} aria-hidden="true" />
                              <span className="sr-only">
                                {t("Opens in a new tab")}
                              </span>
                            </a>
                          )}
                        </td>
                        <td>
                          <strong>{t(roles[model.role])}</strong>
                          {model.uses.map((use) => (
                            <small key={use.kind}>
                              {t(
                                use.kind === "short"
                                  ? "Short Videos"
                                  : "Long Videos",
                              )}{" "}
                              ·{" "}
                              {use.languages
                                .map((locale) => t(languages[locale]))
                                .join(", ")}
                            </small>
                          ))}
                        </td>
                        <td>
                          {model.revision ? (
                            <code data-tooltip={model.revision}>
                              {model.revision.slice(0, 12)}
                            </code>
                          ) : (
                            <span className="muted">
                              {t(
                                model.status === "custom" ||
                                  model.status === "local"
                                  ? "Version not identified"
                                  : "Not available",
                              )}
                            </span>
                          )}
                        </td>
                        <td>
                          {model.status === "custom"
                            ? t("Version not identified")
                            : model.software.name === "chatterbox-tts"
                              ? "Chatterbox"
                              : "MLX Audio"}
                          <small>
                            {model.software.version ?? t("Not available")}
                          </small>
                        </td>
                        <td>
                          <span
                            className={`badge local-model-status ${model.status}`}
                          >
                            {t(statuses[model.status])}
                          </span>
                        </td>
                        <td className="local-model-update-action">
                          <button
                            type="button"
                            disabled={loading || checkingModel !== null}
                            aria-label={`${t("Check updates")}: ${model.name}`}
                            onClick={() => void checkModel(model)}
                          >
                            <RefreshCw
                              size={14}
                              aria-hidden="true"
                              className={
                                checkingModel === model.id
                                  ? "voice-spinner"
                                  : undefined
                              }
                            />
                            {t(
                              checkingModel === model.id
                                ? "Checking updates…"
                                : "Check updates",
                            )}
                          </button>
                          {checks[model.id] && (
                            <small>
                              {t(modelUpdateLabels[checks[model.id].status])}
                            </small>
                          )}
                          {checkErrors[model.id] && (
                            <p className="error" role="alert">
                              {t(checkErrors[model.id])}
                            </p>
                          )}
                        </td>
                      </tr>
                      {checks[model.id] && (
                        <tr className="local-model-update-row">
                          <td colSpan={6}>
                            <LocalModelUpdateResult result={checks[model.id]} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            {!data.models.length && (
              <p className="empty">{t("No local models are configured.")}</p>
            )}
            <p className="muted local-models-note">
              {t(
                "Model files and software versions are listed separately. Update checks run only when you click Check updates.",
              )}
            </p>
            {data.models.some(
              (model) => model.status === "custom" || model.status === "local",
            ) && (
              <p className="muted local-models-note">
                {t(
                  "Custom models may not provide a version that can be read automatically.",
                )}
              </p>
            )}
            <p className="muted local-models-note">
              {t("Last checked:")}{" "}
              {new Date(data.checkedAt).toLocaleString(
                language === "es"
                  ? "es-AR"
                  : language === "pt"
                    ? "pt-BR"
                    : "en-US",
              )}
            </p>
          </>
        )}
      </section>
    </>
  );
}
