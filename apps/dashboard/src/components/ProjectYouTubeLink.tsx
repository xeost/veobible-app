"use client";
import { useI18n } from "../i18n/context";
import { detectedYouTubeId } from "../lib/social-video-ids";
export function ProjectYouTubeLink({
  socialVideoIds,
}: {
  socialVideoIds?: string | null;
}) {
  const { t } = useI18n();
  const id = detectedYouTubeId(socialVideoIds);
  const label = t(id ? "Watch on YouTube" : "YouTube video not detected yet");
  const logo = (
    <svg
      width="18"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
  return id ? (
    <a
      className="icon-button project-youtube-link"
      href={`https://www.youtube.com/watch?v=${id}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      data-tooltip={label}
    >
      {logo}
    </a>
  ) : (
    <button
      className="icon-button project-youtube-link"
      type="button"
      disabled
      aria-label={label}
      title={label}
    >
      {logo}
    </button>
  );
}
