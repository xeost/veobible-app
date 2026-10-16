"use client";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useI18n } from "../i18n/context";

export function ProjectEditorHeader({
  title,
  version,
  backHref,
  children,
}: {
  title: string;
  version: string;
  backHref: string;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const [compact, setCompact] = useState(false);
  const heading = useRef<HTMLDivElement>(null);
  const space = useRef<HTMLDivElement>(null);
  const expandedHeight = useRef(0);
  const compactRef = useRef(false);
  const scrollBeforeChange = useRef<number | null>(null);
  const measure = () => {
    if (!heading.current || !space.current) return;
    const height = heading.current.getBoundingClientRect().height;
    if (!compactRef.current) expandedHeight.current = height;
    // Preserve document height and the current section's position while the sticky row shrinks.
    space.current.style.height = `${Math.max(0, expandedHeight.current - height)}px`;
  };
  useLayoutEffect(() => {
    measure();
    const onScroll = () => {
      const next = window.scrollY > 0;
      if (next === compactRef.current) return;
      scrollBeforeChange.current = window.scrollY;
      compactRef.current = next;
      setCompact(next);
    };
    const observer = new ResizeObserver(measure);
    if (heading.current) observer.observe(heading.current);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);
  useLayoutEffect(() => {
    measure();
    if (scrollBeforeChange.current !== null) {
      window.scrollTo({ top: scrollBeforeChange.current, behavior: "instant" });
      scrollBeforeChange.current = null;
    }
  }, [compact]);

  return (
    <>
      <div
        ref={heading}
        className={`page-heading project-studio-heading${compact ? " is-compact" : ""}`}
      >
        <div className="project-studio-preamble" hidden={compact}>
          <Link className="editor-back" href={backHref}>
            <ChevronLeft size={14} />
            {t("Back to projects")}
          </Link>
          <p className="eyebrow">
            {t("PROJECT EDITOR")} · {version.toUpperCase()}
          </p>
        </div>
        <div className="project-studio-title-row">
          <h1 title={title}>{title}</h1>
          <div className="project-top-actions">{children}</div>
        </div>
        <p className="muted project-studio-description" hidden={compact}>
          {t(
            "Prepare the narration and synchronize each verse with its audio.",
          )}
        </p>
      </div>
      <div ref={space} aria-hidden="true" />
    </>
  );
}
