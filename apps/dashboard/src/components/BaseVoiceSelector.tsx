"use client";
import { useEffect, useId, useRef, useState } from "react";
import {
  Play,
  Pause,
  WandSparkles,
  RotateCcw,
  CircleHelp,
  Save,
} from "lucide-react";
import { api } from "./api";
import { useI18n } from "../i18n/context";
import { queueChangedEvent } from "../lib/generation-queue";
import { pollWhileVisible } from "../lib/visible-polling";
import {
  narrationPresets,
  narrationParametersSchema,
} from "../lib/narration-parameters";
import {
  builtInNarrationLabels,
  presetSettings,
  narrationPresetLibrarySchema,
  type NarrationPresetLibrary,
} from "../lib/narration-style-presets";
import type { NarrationPresetSelection } from "../lib/voice-style-presets";
import { narrationModelOptions } from "../lib/narration-models";
import type { VoiceSampleSettings } from "../lib/voice-sample-settings";
import {
  sampleTexts,
  type BaseVoice,
  type VoiceLocale,
} from "../lib/base-voices";

export function BaseVoiceSelector({
  locale,
  value,
  defaultVoice,
  onChange,
  disabled = false,
  disabledModels = [],
  label,
  narrationSettings,
  preset,
  onPresetChange,
  inheritSystemSettings = false,
  inheritFormatSettings = false,
  defaultPreset,
}: {
  locale: VoiceLocale;
  value: string;
  defaultVoice?: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  disabledModels?: string[];
  label?: string;
  narrationSettings?: VoiceSampleSettings;
  preset?: NarrationPresetSelection;
  onPresetChange?: (preset: NarrationPresetSelection | undefined) => void;
  inheritSystemSettings?: boolean;
  inheritFormatSettings?: boolean;
  defaultPreset?: NarrationPresetSelection;
}) {
  const { t } = useI18n();
  const canGenerate = Boolean(narrationSettings);
  const generationModel = narrationSettings?.models[locale];
  const [playbackModel, setPlaybackModel] = useState(generationModel ?? "");
  const [previewPlayback, setPreviewPlayback] = useState(false);
  useEffect(() => {
    setPlaybackModel(generationModel ?? "");
    setPreviewPlayback(false);
  }, [generationModel, value, defaultVoice]);
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const id = useId();
  const [voices, setVoices] = useState<BaseVoice[]>([]);
  const [presets, setPresets] = useState<NarrationPresetLibrary | null>(null);
  const [text, setText] = useState(sampleTexts[locale]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [savingSample, setSavingSample] = useState(false);
  const pending = useRef(false);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    return (() => {
      const stop = pollWhileVisible(
        async () => {
          try {
            const data = await api<{
              voices: BaseVoice[];
              presets: NarrationPresetLibrary;
            }>(`base-voices?locale=${locale}`);
            if (!live) return;
            const wasPending = pending.current;
            pending.current = data.voices.some((voice) =>
              ["queued", "running"].includes(voice.status),
            );
            if (wasPending && !pending.current)
              window.dispatchEvent(new Event(queueChangedEvent));
            setPresets(narrationPresetLibrarySchema.parse(data.presets));
            setVoices(data.voices);
            setError("");
          } catch (cause) {
            if (live) setError("Could not load voices. Try again.");
            throw cause;
          } finally {
            if (live) setLoading(false);
          }
        },
        () => pending.current,
        2500,
      );
      return () => {
        live = false;
        stop();
      };
    })();
  }, [locale]);
  const effectiveValue = value || defaultVoice || "";
  const systemPreset = presets?.[locale];
  const systemCustomPreset = systemPreset?.items.find(
    (item) => item.id === systemPreset.selected,
  );
  const systemPresetLabel = systemPreset
    ? Object.hasOwn(builtInNarrationLabels, systemPreset.selected)
      ? t(
          builtInNarrationLabels[
            systemPreset.selected as keyof typeof builtInNarrationLabels
          ],
        )
      : systemCustomPreset?.name === "Saved narration"
        ? t("Saved narration")
        : (systemCustomPreset?.name ?? "")
    : "";
  const selected = voices.find((voice) => voice.id === effectiveValue);
  const generationSample = generationModel
    ? selected?.samples?.find((sample) => sample.voiceModel === generationModel)
    : undefined;
  const playbackEntry = canGenerate
    ? selected?.samples?.find((sample) => sample.voiceModel === playbackModel)
    : selected && { ...selected, preview: undefined };
  const playbackSample =
    canGenerate && previewPlayback ? playbackEntry?.preview : playbackEntry;
  const playbackWorking = Boolean(
    playbackEntry && ["queued", "running"].includes(playbackEntry.status),
  );
  const availableSamples =
    selected?.samples?.filter(
      (sample) => sample.available || sample.preview?.available,
    ) ?? [];
  const formatPresetLabel = defaultPreset
    ? Object.hasOwn(builtInNarrationLabels, defaultPreset.id)
      ? t(
          builtInNarrationLabels[
            defaultPreset.id as keyof typeof builtInNarrationLabels
          ],
        )
      : defaultPreset.name === "Saved narration"
        ? t("Saved narration")
        : defaultPreset.name
    : systemPresetLabel;
  useEffect(() => {
    setText(
      generationSample?.preview?.text ??
        generationSample?.text ??
        sampleTexts[locale],
    );
  }, [
    selected?.id,
    generationSample?.preview?.text,
    generationSample?.text,
    generationModel,
    locale,
  ]);
  const working =
    submitting ||
    savingSample ||
    Boolean(
      generationSample &&
      ["queued", "running"].includes(generationSample.status),
    );
  useEffect(() => {
    const player = audio.current;
    setPlaying(false);
    return () => {
      player?.pause();
    };
  }, [
    effectiveValue,
    locale,
    playbackModel,
    previewPlayback,
    playbackSample?.generatedAt,
  ]);
  useEffect(() => {
    if (playbackWorking) {
      audio.current?.pause();
      setPlaying(false);
    }
  }, [playbackWorking]);
  const togglePlayback = async () => {
    if (playbackWorking || savingSample) return;
    const player = audio.current;
    if (!player) return;
    if (!player.paused) {
      player.pause();
      return;
    }
    setError("");
    try {
      await player.play();
    } catch {
      setError("Could not play the example. Try again.");
    }
  };
  const generate = async () => {
    if (!narrationSettings || working) return;
    audio.current?.pause();
    setPlaying(false);
    setSubmitting(true);
    setPlaybackModel(generationModel ?? "");
    setPreviewPlayback(true);
    setError("");
    try {
      await api(`base-voices/${effectiveValue}/sample`, {
        method: "POST",
        body: JSON.stringify({ text, narrationSettings }),
      });
      pending.current = true;
      window.dispatchEvent(new Event(queueChangedEvent));
      setVoices((current) =>
        current.map((voice) =>
          voice.id === effectiveValue
            ? {
                ...voice,
                samples: (voice.samples ?? []).map((sample) =>
                  sample.voiceModel === generationModel
                    ? { ...sample, status: "queued", progress: 0 }
                    : sample,
                ),
              }
            : voice,
        ),
      );
    } catch {
      setError("Could not generate the example. Try again.");
    } finally {
      setSubmitting(false);
    }
  };
  const saveSample = async () => {
    const preview = playbackEntry?.preview;
    if (
      !canGenerate ||
      !previewPlayback ||
      !preview ||
      working ||
      playbackWorking
    )
      return;
    setSavingSample(true);
    setError("");
    audio.current?.pause();
    setPlaying(false);
    try {
      const data = await api<{ voices: BaseVoice[] }>(
        `base-voices/${effectiveValue}/sample`,
        {
          method: "PUT",
          body: JSON.stringify({ model: playbackModel, previewId: preview.id }),
        },
      );
      setVoices(data.voices.filter((voice) => voice.locale === locale));
      setPreviewPlayback(false);
    } catch {
      setError(
        "Could not save the voice example. Generate a new example and try again.",
      );
    } finally {
      setSavingSample(false);
    }
  };
  const playbackButton = (
    <button
      type="button"
      className="icon-button base-voice-play"
      aria-label={t(
        playing ? "Pause voice example" : "Listen to the generated example",
      )}
      data-tooltip={t(
        !playbackSample?.available
          ? "No example has been generated for this voice yet."
          : playing
            ? "Pause voice example"
            : "Listen to the generated example",
      )}
      disabled={
        loading || playbackWorking || savingSample || !playbackSample?.available
      }
      onClick={() => void togglePlayback()}
    >
      {playing ? (
        <Pause size={18} aria-hidden="true" />
      ) : (
        <Play size={18} aria-hidden="true" />
      )}
    </button>
  );
  return (
    <div className="base-voice-picker">
      <label htmlFor={`${id}-voice`}>
        {t(label ?? (canGenerate ? "Default voice" : "Narration voice"))}
      </label>
      <div className="base-voice-select-row">
        <select
          id={`${id}-voice`}
          value={value}
          disabled={disabled || loading || (canGenerate && working)}
          onChange={(event) => onChange(event.target.value)}
        >
          {defaultVoice && (
            <option value="">
              {t(
                inheritFormatSettings
                  ? "Default ({value})"
                  : "Default ({voice})",
              ).replace(
                inheritFormatSettings ? "{value}" : "{voice}",
                t("Voice {number}").replace(
                  "{number}",
                  defaultVoice.split("-")[1],
                ),
              )}
            </option>
          )}
          {value && !voices.some((voice) => voice.id === value) && (
            <option value={value}>
              {t("Voice {number}").replace("{number}", value.split("-")[1])}
            </option>
          )}
          {voices.map((voice) => (
            <option key={voice.id} value={voice.id}>
              {t("Voice {number}").replace("{number}", voice.id.split("-")[1])}
            </option>
          ))}
        </select>
        {!canGenerate && playbackButton}
      </div>
      {!canGenerate && onPresetChange && (
        <>
          <div className="voice-style-picker-label">
            <label htmlFor={`${id}-preset`}>{t("Narration style")}</label>
            <button
              type="button"
              className="narration-help"
              aria-label={`${t("Narration style")}: ${t("Help")}`}
              data-tooltip={t(
                "Sets the expression and pacing of generated narration. The voice example may have been generated with a different style.",
              )}
              aria-describedby={`${id}-preset-help`}
            >
              <CircleHelp size={15} aria-hidden="true" />
            </button>
            <span id={`${id}-preset-help`} className="sr-only">
              {t(
                "Sets the expression and pacing of generated narration. The voice example may have been generated with a different style.",
              )}
            </span>
          </div>
          <select
            id={`${id}-preset`}
            value={preset?.id ?? ""}
            aria-describedby={`${id}-preset-help`}
            disabled={disabled || loading || !presets}
            onChange={(event) => {
              const selected = event.target.value;
              if (!selected) {
                onPresetChange(undefined);
                return;
              }
              if (Object.hasOwn(narrationPresets, selected)) {
                const key = selected as keyof typeof narrationPresets;
                onPresetChange({
                  id: key,
                  name: builtInNarrationLabels[key],
                  settings: presets
                    ? presetSettings(presets, locale, key)
                    : { ...narrationPresets[key] },
                });
              } else {
                const item = presets?.[locale].items.find(
                  (item) => item.id === selected,
                );
                if (item)
                  onPresetChange({
                    ...item,
                    settings: narrationParametersSchema.parse(item.settings),
                  });
              }
            }}
          >
            <option value="">
              {inheritFormatSettings
                ? t("Default ({value})").replace("{value}", formatPresetLabel)
                : inheritSystemSettings
                  ? t("Default from System settings ({value})").replace(
                      "{value}",
                      systemPresetLabel,
                    )
                  : t("Use default narration style")}
            </option>
            {Object.entries(builtInNarrationLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {t(label)}
              </option>
            ))}
            {presets?.[locale].items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.id === "saved-narration" &&
                item.name === "Saved narration"
                  ? t("Saved narration")
                  : item.name}
              </option>
            ))}
            {preset &&
              !Object.hasOwn(narrationPresets, preset.id) &&
              !presets?.[locale].items.some(
                (item) => item.id === preset.id,
              ) && (
                <option value={preset.id}>
                  {preset.name === "Saved narration"
                    ? t("Saved narration")
                    : preset.name}
                </option>
              )}
          </select>
        </>
      )}
      {loading && (
        <p className="muted" role="status">
          {t("Loading voices…")}
        </p>
      )}
      {!loading && !selected && !error && (
        <p className="notice">
          {t(
            "This voice is currently unavailable. Choose another voice or contact your administrator.",
          )}
        </p>
      )}
      {canGenerate && (
        <>
          <div className="base-voice-text-heading">
            <label htmlFor={`${id}-text`}>{t("Example text")}</label>
            <button
              type="button"
              className="icon-button"
              aria-label={t("Restore default example text")}
              data-tooltip={t("Restore default example text")}
              disabled={
                disabled || loading || working || text === sampleTexts[locale]
              }
              onClick={() => setText(sampleTexts[locale])}
            >
              <RotateCcw size={16} aria-hidden="true" />
            </button>
          </div>
          <textarea
            id={`${id}-text`}
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={500}
            rows={3}
            disabled={disabled || loading || working}
          />
          <div className="base-voice-sample-actions">
            <button
              type="button"
              disabled={disabled || working || !selected || !text.trim()}
              onClick={() => void generate()}
            >
              <WandSparkles size={17} aria-hidden="true" />
              {t(
                savingSample
                  ? "Saving example…"
                  : working
                    ? "Generating example…"
                    : generationSample?.available ||
                        generationSample?.preview?.available
                      ? "Regenerate example"
                      : "Generate example",
              )}
            </button>
          </div>
          <label htmlFor={`${id}-sample-model`}>
            {t("Example to listen to")}
          </label>
          <div className="base-voice-select-row">
            <select
              id={`${id}-sample-model`}
              value={`${playbackModel}${previewPlayback ? ":preview" : ""}`}
              disabled={loading || !selected || working}
              onChange={(event) => {
                audio.current?.pause();
                setPlaying(false);
                setError("");
                const [model, source] = event.target.value.split(":");
                setPlaybackModel(model);
                setPreviewPlayback(source === "preview");
              }}
            >
              {narrationModelOptions[locale]
                .filter((option) => !disabledModels.includes(option.value))
                .filter(
                  (option) =>
                    option.value === generationModel ||
                    availableSamples.some(
                      (sample) => sample.voiceModel === option.value,
                    ),
                )
                .flatMap((option) => {
                  const sample = selected?.samples?.find(
                    (item) => item.voiceModel === option.value,
                  );
                  return [
                    <option key={option.value} value={option.value}>
                      {t(option.label)}
                      {` · ${t(sample?.available ? "Saved example" : "Not generated yet")}`}
                    </option>,
                    ...(sample?.preview
                      ? [
                          <option
                            key={`${option.value}:preview`}
                            value={`${option.value}:preview`}
                          >
                            {t(option.label)} · {t("Temporary example")}
                          </option>,
                        ]
                      : []),
                  ];
                })}
            </select>
            {playbackButton}
            <button
              type="button"
              className="icon-button"
              aria-label={t("Save as the voice and model's default example")}
              data-tooltip={t("Save as the voice and model's default example")}
              disabled={
                disabled ||
                loading ||
                working ||
                playbackWorking ||
                !previewPlayback ||
                !playbackEntry?.preview
              }
              onClick={() => void saveSample()}
            >
              <Save size={18} aria-hidden="true" />
            </button>
          </div>
          <p className="muted">
            {t(
              "Generated examples are temporary. Listen and compare them, then use the save button to replace the saved example for this voice and model.",
            )}
          </p>
          <p className="muted">
            {t(
              "Examples use the model and narration preset currently selected above, including unsaved changes. Regenerate an example after changing them.",
            )}
          </p>
        </>
      )}
      {canGenerate && working && !savingSample && (
        <p className="muted" role="status">
          {t(
            generationSample?.status === "queued"
              ? "Example waiting to be generated…"
              : "Generating example…",
          )}
        </p>
      )}
      {canGenerate && generationSample?.status === "failed" && (
        <p className="error" role="alert">
          {t("Could not generate the example. Try again.")}
        </p>
      )}
      {playbackSample?.available && (
        <audio
          ref={audio}
          id={`${id}-audio`}
          aria-label={t("Listen to the generated example")}
          hidden
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onError={() => {
            setPlaying(false);
            setError("Could not play the example. Try again.");
          }}
          preload="none"
          key={`${effectiveValue}:${playbackModel}:${previewPlayback}:${playbackSample.generatedAt}`}
          src={`/api/base-voices/${effectiveValue}/sample?${canGenerate ? `model=${encodeURIComponent(playbackModel)}&` : ""}${canGenerate && previewPlayback && playbackEntry?.preview ? `preview=${encodeURIComponent(playbackEntry.preview.id)}&` : ""}revision=${encodeURIComponent(playbackSample.generatedAt ?? "")}`}
        />
      )}
      {error && (
        <p className="error" role="alert">
          {t(error)}
        </p>
      )}
    </div>
  );
}
