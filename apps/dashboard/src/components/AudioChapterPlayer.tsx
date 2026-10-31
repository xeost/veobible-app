"use client";
import { useState } from "react";
import type { AudioProjectDetail } from "../../../../tools/video-project-api/src/audio-project-schema";
import { useI18n } from "../i18n/context";
import { AudioTakePlayer } from "./AudioTakePlayer";
export function AudioChapterPlayer({
  src,
  chapter,
  project,
}: {
  src: string;
  chapter: AudioProjectDetail["content"][number];
  project: AudioProjectDetail;
}) {
  const { t } = useI18n();
  const [time, setTime] = useState(0);
  const asset = project.chapters[String(chapter.chapter)];
  let cursor = 0;
  const cues =
    asset.cues ??
    chapter.verses.flatMap((verse) => {
      const ref = `${chapter.chapter}:${verse.verse}`,
        recording = project.recordings[ref];
      if (!recording) return [];
      const trim = project.settings.trims[ref];
      const duration =
        (trim?.endSeconds ?? recording.duration) - (trim?.startSeconds ?? 0);
      const cue = {
        verse: verse.verse,
        text: verse.text,
        start: cursor,
        end: cursor + duration,
      };
      cursor += duration + (project.settings.pauses[ref] ?? 0.35);
      return [cue];
    });
  const current = cues.findLast((cue) => time >= cue.start);
  return (
    <div className="audio-chapter-player">
      <strong>{t("Final chapter audio")}</strong>
      <AudioTakePlayer
        src={src}
        label={`${t("Chapter")} ${chapter.chapter}`}
        onTime={setTime}
      />
      <div className="audio-chapter-narration" aria-live="off">
        {current ? (
          <>
            <span className="section-number">
              {chapter.chapter}:{current.verse}
            </span>
            <p>{current.text}</p>
          </>
        ) : (
          <p className="muted">
            {t("Play the final audio to follow the verse being narrated.")}
          </p>
        )}
      </div>
    </div>
  );
}
