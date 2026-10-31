"use client";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useReducer,
} from "react";
import {
  AudioLines,
  ChevronDown,
  ChevronRight,
  Trash2,
  Combine,
  UnfoldHorizontal,
  WandSparkles,
  ScanText,
  CircleCheck,
} from "lucide-react";
import { isAudioVerseApproved } from "../../../../tools/video-project-api/src/audio-approvals";
import type {
  AudioProjectDetail,
  AudioSettings,
} from "../../../../tools/video-project-api/src/audio-project-schema";
import { useI18n } from "../i18n/context";
import type { GenerationQueueItem } from "../lib/generation-queue";
import { GenerationProgress } from "./GenerationProgress";
import { VerseWaveform } from "./VerseWaveform";
import { VersePronunciationEditor } from "./VersePronunciationEditor";
import { OriginalVerseAudio } from "./OriginalVerseAudio";
import { AudioLayers } from "./AudioLayers";
import { AudioChapterPlayer } from "./AudioChapterPlayer";
import { AudioPhrasePatch } from "./AudioPhrasePatch";
import { AudioChapterVoiceMenu } from "./AudioChapterVoiceMenu";
import { ConfirmDialog } from "./ConfirmDialog";
import { audioWaveformResourceKey } from "../lib/audio-editor-preparation";
import { loadAudioWaveform } from "../lib/audio-waveform";
import {
  initialVerseText,
  temporaryVerseText,
  verseTextOverride,
} from "../lib/temporary-verse-text";

export function AudioChapter({
  chapter,
  project,
  settings,
  locked,
  approvalLocked,
  submitting,
  tasks,
  open,
  toggle,
  change,
  generate,
  media,
  originalMedia,
  onPlay,
  onToggleApproval,
  selectedVerse,
  onSelectVerse,
  onPrepared,
  cleanEditingFiles,
}: {
  chapter: AudioProjectDetail["content"][number];
  project: AudioProjectDetail;
  settings: AudioSettings;
  locked: boolean;
  approvalLocked: boolean;
  submitting: boolean;
  tasks: GenerationQueueItem[];
  open: boolean;
  toggle: () => void;
  change: (settings: AudioSettings) => void;
  generate: (scope: {
    chapter: number;
    verse?: number;
    regenerate?: boolean;
    assembleOnly?: boolean;
    voicesOnly?: boolean;
    alignOnly?: boolean;
    patch?: { start: number; end: number; text: string; sourceText: string };
    layerEdits?: { revision: string; enabled: boolean }[];
    textOverride?: string;
  }) => Promise<boolean>;
  media: (
    chapter: number,
    verse?: number,
    revision?: string,
    file?: string,
  ) => string;
  originalMedia: (chapter: number, revision: string) => string;
  onPlay: (audio: HTMLAudioElement) => void;
  onToggleApproval: (reference: string) => Promise<void>;
  selectedVerse?: number;
  onSelectVerse: (verse: number) => void;
  onPrepared: (key: string, success: boolean) => void;
  cleanEditingFiles: (chapter: number) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const activeTask =
    tasks.find((task) => task.status === "running") ?? tasks[0];
  const [selection, setSelection] = useState({ index: 0, play: false });
  useEffect(() => {
    if (selectedVerse === undefined) return;
    const index = chapter.verses.findIndex(
      (verse) => verse.verse === selectedVerse,
    );
    if (index < 0) return;
    setSelection((current) =>
      current.index === index ? current : { index, play: false },
    );
  }, [selectedVerse, chapter.verses]);
  const [resetRevision, setResetRevision] = useState(0);
  const [listenToOriginal, setListenToOriginal] = useState(false);
  const verse = chapter.verses[selection.index] ?? chapter.verses[0];
  const reference = `${chapter.chapter}:${verse.verse}`;
  const speechScope = `${project.edition}/${project.book}/${reference}`;
  const [speechState, dispatchSpeech] = useReducer(
    temporaryVerseText,
    initialVerseText(
      speechScope,
      verse.text,
      settings.pronunciation?.[reference],
    ),
  );
  const speech =
    speechState.scope === speechScope && speechState.original === verse.text
      ? speechState
      : initialVerseText(
          speechScope,
          verse.text,
          settings.pronunciation?.[reference],
        );
  const editingSpeech = speech.draft !== null;
  useEffect(() => {
    dispatchSpeech({
      type: "select",
      scope: speechScope,
      original: verse.text,
      accepted: settings.pronunciation?.[reference],
    });
  }, [speechScope, verse.text, settings.pronunciation?.[reference]]);
  useEffect(() => {
    if (selectedVerse === undefined) dispatchSpeech({ type: "cancel" });
  }, [selectedVerse]);
  const recording = project.recordings[reference];
  const [preparedKey, setPreparedKey] = useState<string | null>(null);
  const currentKey = recording
    ? audioWaveformResourceKey(project, reference, recording.revision)
    : undefined;
  const next = chapter.verses[selection.index + 1];
  const nextReference = next ? `${chapter.chapter}:${next.verse}` : undefined;
  const nextRecording = nextReference
    ? project.recordings[nextReference]
    : undefined;
  const nextKey =
    nextRecording && nextReference
      ? audioWaveformResourceKey(project, nextReference, nextRecording.revision)
      : undefined;
  const nextSrc =
    nextRecording && next
      ? media(chapter.chapter, next.verse, nextRecording.revision)
      : undefined;
  useEffect(() => {
    if (!open || preparedKey !== currentKey || !nextKey || !nextSrc) return;
    const controller = new AbortController();
    void loadAudioWaveform(nextSrc, controller.signal, {
      resourceKey: nextKey,
      immutableWaveform: true,
    }).catch(() => {
      // Speculation is optional; opening the verse retries failures normally.
    });
    return () => controller.abort();
  }, [open, preparedKey, currentKey, nextKey, nextSrc]);
  const approved = isAudioVerseApproved(project, settings, reference);
  const generationLocked =
    submitting ||
    tasks.some((task) => !task.verse || task.verse === verse.verse);
  const finalCandidate = project.chapters[String(chapter.chapter)];
  const finalUrl = finalCandidate
    ? media(chapter.chapter, undefined, finalCandidate.revision)
    : undefined;
  const [availableFinalUrl, setAvailableFinalUrl] = useState<string>();
  const [confirmCleanup, setConfirmCleanup] = useState(false);
  useEffect(() => {
    if (!finalUrl) return;
    const controller = new AbortController();
    void fetch(finalUrl, {
      method: "HEAD",
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => {
        if (!controller.signal.aborted)
          setAvailableFinalUrl(response.ok ? finalUrl : undefined);
      })
      .catch(() => {
        if (!controller.signal.aborted) setAvailableFinalUrl(undefined);
      });
    return () => controller.abort();
  }, [finalUrl]);
  const final =
    finalUrl && availableFinalUrl === finalUrl ? finalCandidate : undefined;
  const title = `${t("Chapter")} ${chapter.chapter}`;
  const picker = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const collapseTop = useRef<number | null>(null);
  const completed = chapter.verses.filter(
    (v) => project.recordings[`${chapter.chapter}:${v.verse}`],
  ).length;
  const approvedCount = chapter.verses.filter((v) =>
    isAudioVerseApproved(project, settings, `${chapter.chapter}:${v.verse}`),
  ).length;
  const references = chapter.verses.map((v) => `${chapter.chapter}:${v.verse}`);
  const hasCuts = references.some((ref) => settings.trims[ref]);
  const toggleSection = () => {
    if (!open) onSelectVerse(verse.verse);
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
    const verse = chapter.verses[index];
    if (!verse) return;
    body.current?.querySelectorAll("audio").forEach((audio) => audio.pause());
    setSelection({ index, play });
    onSelectVerse(verse.verse);
  };
  const original = project.originalChapters?.includes(chapter.chapter) ? (
    <OriginalVerseAudio
      endpoint={`audios/${encodeURIComponent(project.edition)}/${encodeURIComponent(project.book)}`}
      chapter={chapter.chapter}
      reference={reference}
      locale={project.version.locale}
      media={originalMedia}
      checked={listenToOriginal}
      onChange={setListenToOriginal}
    />
  ) : null;
  const generateCurrentVerse = async () => {
    if (editingSpeech) return;
    await generate({
      chapter: chapter.chapter,
      verse: verse.verse,
      regenerate: Boolean(recording),
      textOverride: verseTextOverride(speech),
    });
  };
  const versePreview = (
    <VersePronunciationEditor
      reference={reference}
      speech={speech}
      disabled={locked}
      dispatch={(action) => {
        if (action.type === "edit") onSelectVerse(verse.verse);
        if (action.type === "accept" || action.type === "restore") {
          const pronunciation = { ...settings.pronunciation };
          if (action.type === "restore") delete pronunciation[reference];
          else if (speech.draft?.trim())
            pronunciation[reference] = speech.draft.trim();
          change({ ...settings, pronunciation });
        }
        dispatchSpeech(action);
      }}
    >
      {recording && selectedVerse === verse.verse && (
        <AudioPhrasePatch
          key={`${reference}/${recording.revision}`}
          text={recording.base?.text ?? speech.accepted}
          disabled={locked || editingSpeech}
          generate={(patch) =>
            generate({
              chapter: chapter.chapter,
              verse: verse.verse,
              regenerate: true,
              patch,
            })
          }
        />
      )}
    </VersePronunciationEditor>
  );
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
            <span className="audio-verse-label">
              {ref}
              {isAudioVerseApproved(project, settings, ref) && (
                <CircleCheck size={13} aria-label={t("Approved")} role="img" />
              )}
            </span>
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
    <section
      className="section-card"
      id={`audio-chapter-block-${chapter.chapter}`}
    >
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
              {t("{total} verses · {generated} generated · {approved} approved")
                .replace("{total}", String(chapter.verses.length))
                .replace("{generated}", String(completed))
                .replace("{approved}", String(approvedCount))}
              {final && (
                <>
                  {" · "}
                  <span className="audio-final-generated">
                    {t("Final audio generated")}
                  </span>
                </>
              )}
            </small>
          </span>
        </button>
        <AudioChapterVoiceMenu
          title={title}
          completed={completed}
          total={chapter.verses.length}
          disabled={submitting || tasks.length > 0}
          generate={(regenerate) =>
            void generate({
              chapter: chapter.chapter,
              voicesOnly: true,
              regenerate,
            })
          }
        />
        <span className="section-action-separator" aria-hidden="true" />
        <button
          type="button"
          className="icon-button section-action-button"
          disabled={submitting || tasks.length > 0 || completed === 0}
          aria-label={`${t("Analyze generated verse voices with AI")} · ${title}`}
          data-tooltip={t(
            "Analyze generated verse voices with AI. Updates the cuts for all recorded verses in this chapter.",
          )}
          onClick={() =>
            void generate({ chapter: chapter.chapter, alignOnly: true })
          }
        >
          <ScanText size={17} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="icon-button section-action-button"
          disabled={locked || !hasCuts}
          aria-label={t("Use full recordings")}
          data-tooltip={t("Use full recordings")}
          onClick={() => {
            const trims = { ...settings.trims };
            references.forEach((ref) => delete trims[ref]);
            change({ ...settings, trims });
            setResetRevision((current) => current + 1);
          }}
        >
          <UnfoldHorizontal size={17} aria-hidden="true" />
        </button>
        <span className="section-action-separator" aria-hidden="true" />
        <button
          type="button"
          className="audio-chapter-generate"
          disabled={
            submitting ||
            tasks.length > 0 ||
            completed !== chapter.verses.length
          }
          aria-label={`${t("Create final audio")} · ${title}`}
          data-tooltip={t("Create final audio")}
          onClick={() =>
            void generate({ chapter: chapter.chapter, assembleOnly: true })
          }
        >
          <Combine size={17} aria-hidden="true" />
          {t("Create final audio")}
        </button>
        {completed > 0 && (
          <>
            <span className="section-action-separator" aria-hidden="true" />
            <button
              type="button"
              className="icon-button section-action-button"
              disabled={locked}
              onClick={() => setConfirmCleanup(true)}
              aria-label={`${t("Clean editing audio files")} · ${title}`}
              data-tooltip={t("Clean editing audio files")}
            >
              <Trash2 size={17} aria-hidden="true" />
            </button>
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
          label={`${t(activeTask.status === "queued" ? "Waiting to generate audio" : activeTask.stage === "Analyzing audio" ? "Analyzing verse audio…" : activeTask.verse ? "Generating verse audio…" : "Joining chapter audio…")}${activeTask.verse ? ` · ${chapter.chapter}:${activeTask.verse}` : ""}`}
        />
      )}
      {open && (
        <div
          ref={body}
          className="section-body"
          id={`audio-chapter-${chapter.chapter}`}
          onPlayCapture={(event) => {
            if (event.target instanceof HTMLAudioElement) {
              onSelectVerse(verse.verse);
              onPlay(event.target);
            }
          }}
        >
          {recording ? (
            <VerseWaveform
              key={`${reference}/${recording.revision}`}
              src={media(chapter.chapter, verse.verse, recording.revision)}
              resourceKey={audioWaveformResourceKey(
                project,
                reference,
                recording.revision,
              )}
              immutableWaveform
              onPrepared={(key, success) => {
                if (success) setPreparedKey(key);
                onPrepared(key, success);
              }}
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
              resetRevision={resetRevision + project.revision}
              preservedReferences={[reference]}
              versePicker={versePicker}
              versePreview={versePreview}
              playbackActions={
                <>
                  <span
                    className="section-action-separator"
                    aria-hidden="true"
                  />
                  <button
                    type="button"
                    className="icon-button verse-playback-icon audio-verse-approval"
                    aria-pressed={approved}
                    aria-label={t(
                      approved ? "Remove verse approval" : "Approve verse",
                    )}
                    data-tooltip={t(
                      approved ? "Remove verse approval" : "Approve verse",
                    )}
                    disabled={approvalLocked}
                    onClick={() => void onToggleApproval(reference)}
                  >
                    <CircleCheck size={16} aria-hidden="true" />
                  </button>
                </>
              }
              toolbarActions={
                <>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={t("Analyze this verse audio with AI")}
                    data-tooltip={t("Analyze this verse audio with AI")}
                    disabled={locked}
                    onClick={() =>
                      void generate({
                        chapter: chapter.chapter,
                        verse: verse.verse,
                        alignOnly: true,
                      })
                    }
                  >
                    <ScanText size={16} aria-hidden="true" />
                  </button>
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
                    <UnfoldHorizontal size={16} aria-hidden="true" />
                  </button>
                </>
              }
              onRegenerate={() => void generateCurrentVerse()}
              regenerationDisabled={generationLocked || editingSpeech}
              regenerateLabel="Regenerate this verse"
              regenerateIcon={<WandSparkles size={16} aria-hidden="true" />}
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
                  disabled={generationLocked || editingSpeech}
                  onClick={() => void generateCurrentVerse()}
                >
                  <WandSparkles size={15} aria-hidden="true" />
                  {t("Generate verse audio")}
                </button>
                {versePreview}
                {original}
              </div>
            </div>
          )}
          {recording?.layers?.length ? (
            <AudioLayers
              key={reference}
              recording={recording}
              disabled={locked}
              media={(file, revision) =>
                media(chapter.chapter, verse.verse, revision, file)
              }
              update={(layerEdits) =>
                generate({
                  chapter: chapter.chapter,
                  verse: verse.verse,
                  layerEdits,
                })
              }
            />
          ) : null}
          {final && (
            <AudioChapterPlayer
              key={final.revision}
              src={media(chapter.chapter, undefined, final.revision)}
              chapter={chapter}
              project={project}
            />
          )}
        </div>
      )}
      {confirmCleanup && (
        <ConfirmDialog
          title={`${t("Clean editing audio files")} · ${title}`}
          confirmLabel={t("Delete editing files")}
          destructive
          busy={submitting}
          close={() => setConfirmCleanup(false)}
          onConfirm={() => {
            void cleanEditingFiles(chapter.chapter).then((cleaned) => {
              if (cleaned) setConfirmCleanup(false);
            });
          }}
        >
          <p>
            {t(
              "This will permanently delete all editing recordings, patches and saved verse cuts for this chapter to free disk space.",
            )}
          </p>
          <p>
            {t(
              "Any final chapter audio and existing verse approvals will be kept. To edit verse audio or cuts again, you will need to generate the verse voices again.",
            )}
          </p>
        </ConfirmDialog>
      )}
    </section>
  );
}
