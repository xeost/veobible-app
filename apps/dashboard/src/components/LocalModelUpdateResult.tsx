"use client";
import { ExternalLink } from "lucide-react";
import { useI18n } from "../i18n/context";
import type { LocalModelUpdate } from "../lib/local-models";
export const modelUpdateLabels = {
  up_to_date: "Model files are up to date",
  update_available: "Model update available",
  new_variant: "New model variant available",
  not_downloaded: "Model download needed",
  review_required: "Review before updating",
  unavailable: "Could not check updates",
  unsupported: "Manual review needed",
} as const;
const reasons = {
  same_revision:
    "The downloaded revision matches the latest published revision.",
  same_files: "Only documentation or files unused by this system changed.",
  used_files_changed:
    "Files used by this system have changed. Test the new revision before replacing the current one.",
  missing_local:
    "Download or complete this model before using it. This check has not downloaded model weights.",
  unknown_baseline:
    "The downloaded revision could not be compared reliably. Review the publisher's changes before updating.",
  unknown_software:
    "Compatibility with the installed software could not be established. Review the software requirements before updating.",
  format_changed:
    "The model's files or configuration changed. Software compatibility needs review.",
  size_limit:
    "The published files are larger or their size is unknown. They are not recommended automatically for this Mac.",
  no_public_source:
    "This custom configuration has no supported public source to check.",
  source_unavailable:
    "The publisher could not be reached. Try the check again.",
  rate_limited:
    "The publisher is receiving too many requests. Try again later.",
} as const;
const compatibility = {
  expected_fit: "Expected to fit the M2 with 16 GB",
  review_required: "Compatibility needs review",
  not_assessed: "Compatibility not assessed",
} as const;
export function LocalModelUpdateResult({
  result,
}: {
  result: LocalModelUpdate;
}) {
  const { t, language } = useI18n();
  const locale =
    language === "es" ? "es-AR" : language === "pt" ? "pt-BR" : "en-US";
  const size = (bytes: number) =>
    `${(bytes / 1024 ** 3).toLocaleString(locale, { maximumFractionDigits: 2 })} GiB`;
  return (
    <div className="local-model-update-result" role="status" aria-live="polite">
      <strong>{t(modelUpdateLabels[result.status])}</strong>
      <p>{t(reasons[result.reason])}</p>
      <p>
        <b>{t(compatibility[result.compatibility])}</b>
        {result.downloadBytes !== null && (
          <>
            {" "}
            ·{" "}
            {t("Model files: {size}").replace(
              "{size}",
              size(result.downloadBytes),
            )}
          </>
        )}
      </p>
      {result.compatibility === "expected_fit" && (
        <p className="muted">
          {t(
            "Estimated from the current model family, configuration and file size. A short generation test is still needed to verify memory use and quality.",
          )}
        </p>
      )}
      {result.latestRevision && result.model.repository && (
        <p>
          <a
            href={`https://huggingface.co/${result.model.repository}/commits/${result.latestRevision}`}
            target="_blank"
            rel="noreferrer"
          >
            {t("Review the published changes")}
            <ExternalLink size={12} aria-hidden="true" />
            <span className="sr-only">{t("Opens in a new tab")}</span>
          </a>{" "}
          ·{" "}
          <code data-tooltip={result.latestRevision}>
            {result.latestRevision.slice(0, 12)}
          </code>
        </p>
      )}
      {result.variants.length > 0 && (
        <div className="local-model-new-variants">
          <h3>{t("Newer model variants")}</h3>
          <ul>
            {result.variants.map((variant) => (
              <li key={`${variant.repository}:${variant.name}`}>
                <a
                  href={`https://huggingface.co/${variant.repository}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {variant.name}
                  <ExternalLink size={12} aria-hidden="true" />
                  <span className="sr-only">{t("Opens in a new tab")}</span>
                </a>
                <p>
                  {t(compatibility[variant.compatibility])} ·{" "}
                  {t("Model files: {size}").replace(
                    "{size}",
                    size(variant.weightsBytes),
                  )}
                </p>
                <p>
                  {t(
                    variant.requiresIntegration
                      ? "Requires adapting the local tool before use. It is not a direct replacement for the selected variant."
                      : "Supported by the local tool. Select this variant in the narration configuration to use it.",
                  )}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
      {result.discovery === "unavailable" && (
        <p className="notice">
          {t(
            "The configured model was checked, but the search for newer family releases could not be completed. Try again.",
          )}
        </p>
      )}
      <small className="muted">
        {t("Updates checked:")}{" "}
        {new Date(result.checkedAt).toLocaleString(locale)}
      </small>
    </div>
  );
}
