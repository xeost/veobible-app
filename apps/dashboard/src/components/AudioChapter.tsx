"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AudioLines,
  ChevronDown,
  ChevronRight,
  Download,
  Mic,
  RotateCcw,
  WandSparkles,
} from "lucide-react";
import type {
  AudioProjectDetail,
  AudioSettings,
} from "../../../../tools/video-project-api/src/audio-project-schema";
import { useI18n } from "../i18n/context";
import type { GenerationQueueItem } from "../lib/generation-queue";
import { GenerationProgress } from "./GenerationProgress";
import { VerseWaveform } from "./VerseWaveform";
import { OriginalVerseAudio } from "./OriginalVerseAudio";

export function AudioChapter({
  chapter,
  project,
  settings,
  locked,
  submitting,
  tasks,
  open,
  toggle,
  change,
  generate,
  media,
  onPlay,
}: {
  chapter: AudioProjectDetail["content"][number];
  project: AudioProjectDetail;
  settings: AudioSettings;
  locked: boolean;
  submitting: boolean;
  tasks: GenerationQueueItem[];
  open: boolean;
  toggle: () => void;
  change: (settings: AudioSettings) => void;
  generate: (scope: {
    chapter: number;
    verse?: number;
    regenerate?: boolean;
  }) => Promise<void>;
  media: (chapter: number, verse?: number, revision?: string) => string;
  onPlay: (audio: HTMLAudioElement) => void;
}) {
  const { t } = useI18n();
  const activeTask =
    tasks.find((task) => task.status === "running") ?? tasks[0];
  const [selection, setSelection] = useState({ index: 0, play: false });
  const [resetRevision, setResetRevision] = useState(0);
  const [listenToOriginal, setListenToOriginal] = useState(false);
  const verse = chapter.verses[selection.index] ?? chapter.verses[0];
  const reference = `${chapter.chapter}:${verse.verse}`;
  const recording = project.recordings[reference];
  const generationLocked =
    submitting ||
    tasks.some((task) => !task.verse || task.verse === verse.verse);
  const final = project.chapters[String(chapter.chapter)];
  const title = `${t("Chapter")} ${chapter.chapter}`;
  const picker = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const collapseTop = useRef<number | null>(null);
  const completed = chapter.verses.filter(
    (v) => project.recordings[`${chapter.chapter}:${v.verse}`],
  ).length;
  const references = chapter.verses.map((v) => `${chapter.chapter}:${v.verse}`);
  const hasCuts = references.some((ref) => settings.trims[ref]);
  const toggleSection = () => {
    if (open)
      collapseTop.current =
        heading.current?.getBoundingClientRect().top ?? null;
    toggle();
  };
  useLayoutEffect(() => {
    if (!open && collapseTop.current !== null && heading.current) {
      window.scrollBy(
        0,
        heading.current.getBoundingClientRect().top - collapseTop.current,
      );
      collapseTop.current = null;
    }
  }, [open]);
  useEffect(() => {
    if (!open) {
      setSelection((current) =>
        current.play ? { ...current, play: false } : current,
      );
      return;
    }
    const list = picker.current;
    const active = list?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!list || !active) return;
    const viewport = list.getBoundingClientRect(),
      item = active.getBoundingClientRect();
    if (item.top < viewport.top) list.scrollTop += item.top - viewport.top - 4;
    else if (item.bottom > viewport.bottom)
      list.scrollTop += item.bottom - viewport.bottom + 4;
    if (item.left < viewport.left)
      list.scrollLeft += item.left - viewport.left - 4;
    else if (item.right > viewport.right)
      list.scrollLeft += item.right - viewport.right + 4;
  }, [selection.index, open]);
  const selectVerse = (index: number, play = false) => {
    body.current?.querySelectorAll("audio").forEach((audio) => audio.pause());
    setSelection({ index, play });
  };
  const original = project.originalChapters?.includes(chapter.chapter) ? (
    <OriginalVerseAudio
      endpoint={`audios/${encodeURIComponent(project.edition)}/${encodeURIComponent(project.book)}`}
      chapter={chapter.chapter}
      reference={reference}
      locale={project.version.locale}
      checked={listenToOriginal}
      onChange={setListenToOriginal}
    />
  ) : null;
  const versePicker = (
    <div className="verse-picker" ref={picker} aria-label={t("Verses")}>
      {chapter.verses.map((v, index) => {
        const ref = `${chapter.chapter}:${v.verse}`,
          audio = project.recordings[ref];
        const trim = settings.trims[ref];
        return (
          <button
            type="button"
            key={ref}
            className={selection.index === index ? "active" : ""}
            aria-pressed={selection.index === index}
            onClick={() => selectVerse(index)}
          >
            <span>{ref}</span>
            <small>
              {audio
                ? `${(trim?.startSeconds ?? 0).toFixed(2)}–${(trim?.endSeconds ?? audio.duration).toFixed(2)} s`
                : t("Pending")}
            </small>
          </button>
        );
      })}
    </div>
  );
  const nextVerse = (play: boolean) => {
    if (selection.index < chapter.verses.length - 1)
      selectVerse(selection.index + 1, play);
  };
  return (
    <section className="section-card">
      <div
        ref={heading}
        className="reading-section-heading"
        onClick={(event) => {
          if (!(event.target as Element).closest("button, a")) toggleSection();
        }}
      >
        <button
          type="button"
          className="section-heading"
          aria-expanded={open}
          aria-controls={`audio-chapter-${chapter.chapter}`}
          onClick={toggleSection}
        >
          <span className="section-number">
            {String(chapter.chapter).padStart(2, "0")}
          </span>
          <span className="section-role reading">
            <AudioLines size={15} />
            {t("Reading")}
          </span>
          <span className="section-heading-text">
            <strong>{title}</strong>
            <small>
              {completed} / {chapter.verses.length} {t("verses")}
            </small>
          </span>
        </button>
        <button
          type="button"
          className="icon-button section-action-button"
          disabled={submitting || tasks.length > 0}
          aria-label={t("Generate all audio for this chapter")}
          data-tooltip={t("Generate all audio for this chapter")}
          onClick={() => void generate({ chapter: chapter.chapter })}
        >
          <WandSparkles size={17} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="icon-button section-action-button"
          disabled={locked || !hasCuts}
          aria-label={t("Reset manual verse cuts")}
          data-tooltip={t("Reset manual verse cuts")}
          onClick={() => {
            const trims = { ...settings.trims };
            references.forEach((ref) => delete trims[ref]);
            change({ ...settings, trims });
            setResetRevision((current) => current + 1);
          }}
        >
          <RotateCcw size={17} aria-hidden="true" />
        </button>
        {final && (
          <>
            <span className="section-action-separator" aria-hidden="true" />
            <a
              className="icon-button section-action-button"
              href={`${media(chapter.chapter, undefined, final.revision)}&download=1`}
              aria-label={`${t("Download chapter audio")} ${chapter.chapter}`}
              data-tooltip={t("Download chapter audio")}
            >
              <Download size={17} aria-hidden="true" />
            </a>
          </>
        )}
        <button
          type="button"
          className="reading-section-expand icon-button"
          aria-label={title}
          aria-expanded={open}
          aria-controls={`audio-chapter-${chapter.chapter}`}
          onClick={toggleSection}
        >
          <ChevronDown size={18} className={open ? "expanded" : ""} />
        </button>
      </div>
      {activeTask && (
        <GenerationProgress
          value={activeTask.progress}
          label={`${t(activeTask.status === "queued" ? "Waiting to generate audio" : activeTask.verse ? "Generating verse audio…" : "Joining chapter audio…")}${activeTask.verse ? ` · ${chapter.chapter}:${activeTask.verse}` : ""}`}
        />
      )}
      {open && (
        <div
          ref={body}
          className="section-body"
          id={`audio-chapter-${chapter.chapter}`}
          onPlayCapture={(event) => {
            if (event.target instanceof HTMLAudioElement) onPlay(event.target);
          }}
        >
          {recording ? (
            <VerseWaveform
              key={`${reference}/${recording.revision}`}
              src={media(chapter.chapter, verse.verse, recording.revision)}
              resourceKey={`${project.edition}/${project.book}/${reference}/${recording.revision}`}
              onPrepared={() => {}}
              locale={project.version.locale}
              expanded={open}
              sourceStart={0}
              sourceEnd={recording.duration}
              sourceDuration={recording.duration}
              timelineStart={0}
              volumeMultiplier={1}
              onExpand={() => {}}
              showSourceContext={false}
              playbackSpeedHelp="Playback speed for listening in the editor only. Saved for this Bible language; generated audios keep their original speed."
              cues={[
                {
                  reference,
                  text: verse.text,
                  start: settings.trims[reference]?.startSeconds ?? 0,
                  end:
                    settings.trims[reference]?.endSeconds ?? recording.duration,
                },
              ]}
              disabled={locked}
              resetRevision={resetRevision}
              preservedReferences={[reference]}
              versePicker={versePicker}
              toolbarActions={
                <button
                  type="button"
                  className="icon-button"
                  aria-label={t("Use full recording")}
                  data-tooltip={t("Use full recording")}
                  disabled={locked || !settings.trims[reference]}
                  onClick={() => {
                    const trims = { ...settings.trims };
                    delete trims[reference];
                    change({ ...settings, trims });
                    setResetRevision((current) => current + 1);
                  }}
                >
                  <RotateCcw size={16} aria-hidden="true" />
                </button>
              }
              onRegenerate={() =>
                void generate({
                  chapter: chapter.chapter,
                  verse: verse.verse,
                  regenerate: true,
                })
              }
              regenerationDisabled={generationLocked}
              regenerateLabel="Regenerate this verse"
              onTrim={(_, edge, value) =>
                change({
                  ...settings,
                  trims: {
                    ...settings.trims,
                    [reference]: {
                      startSeconds:
                        settings.trims[reference]?.startSeconds ?? 0,
                      endSeconds:
                        settings.trims[reference]?.endSeconds ??
                        recording.duration,
                      [edge === "start" ? "startSeconds" : "endSeconds"]: value,
                    },
                  },
                })
              }
              onShift={() => false}
              onNextVerse={nextVerse}
              hasNextVerse={selection.index < chapter.verses.length - 1}
              autoPlay={selection.play}
              onAutoPlay={() =>
                setSelection((current) => ({ ...current, play: false }))
              }
            >
              {original}
            </VerseWaveform>
          ) : (
            <div className="verse-sync">
              {versePicker}
              <div className="sync-workspace">
                <div className="sync-heading">
                  <AudioLines size={18} />
                  <strong>{t("Generate verse audio")}</strong>
                  <div>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={t("Next verse")}
                      data-tooltip={t("Next verse")}
                      disabled={selection.index >= chapter.verses.length - 1}
                      onClick={() => nextVerse(false)}
                    >
                      <ChevronRight size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  className="primary audio-verse-generate"
                  disabled={generationLocked}
                  onClick={() =>
                    void generate({
                      chapter: chapter.chapter,
                      verse: verse.verse,
                    })
                  }
                >
                  <Mic size={15} />
                  {t("Generate verse audio")}
                </button>
                <div className="verse-preview">
                  <span className="eyebrow">{reference}</span>
                  <p>{verse.text}</p>
                </div>
                {original}
              </div>
            </div>
          )}
          {final && (
            <audio
              className="audio-chapter-player"
              controls
              preload="none"
              src={media(chapter.chapter, undefined, final.revision)}
              aria-label={`${t("Chapter")} ${chapter.chapter}`}
            />
          )}
        </div>
      )}
    </section>
  );
}
