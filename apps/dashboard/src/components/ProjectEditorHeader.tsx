"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useI18n } from "../i18n/context";

export function ProjectEditorHeader({
  title,
  version,
  versionAction,
  backHref,
  showDescription = true,
  eyebrow = "PROJECT EDITOR",
  children,
}: {
  title: string;
  version: string;
  versionAction?: ReactNode;
  backHref: string;
  showDescription?: boolean;
  eyebrow?: string;
  children: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <>
      <div className="project-studio-preamble">
        <Link className="editor-back" href={backHref}>
          <ChevronLeft size={14} />
          {t("Back to projects")}
        </Link>
        <p className="eyebrow">{t(eyebrow)}</p>
      </div>
      <div className="page-heading project-studio-heading">
        <div className="project-studio-title-row">
          <div className="project-studio-title">
            <h1 title={title}>{title}</h1>
            <div className="project-studio-version-actions">
              <span
                className="project-studio-version"
                aria-label={`${t("Bible version")}: ${version.toUpperCase()}`}
                title={version.toUpperCase()}
              >
                {version.toUpperCase()}
              </span>
              {versionAction}
            </div>
          </div>
          <div className="project-top-actions">{children}</div>
        </div>
      </div>
      {showDescription && (
        <p className="muted project-studio-description">
          {t(
            "Prepare the narration and synchronize each verse with its audio.",
          )}
        </p>
      )}
    </>
  );
}
