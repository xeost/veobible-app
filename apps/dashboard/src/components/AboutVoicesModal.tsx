"use client";
import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useI18n } from "../i18n/context";
import { api } from "./api";
import { useModalDismiss } from "./useModalDismiss";

type OriginalVoice = { id: string; locale: "en" | "es" | "pt"; url: string };
const languages = { en: "English", es: "Spanish", pt: "Portuguese" } as const;

function OriginalVoicePlayer({
  locale,
  voices,
}: {
  locale: OriginalVoice["locale"];
  voices: OriginalVoice[];
}) {
  const { t } = useI18n();
  const selectId = useId();
  const audio = useRef<HTMLAudioElement>(null);
  const [selected, setSelected] = useState("");
  const [failed, setFailed] = useState(false);
  const options = voices.filter((voice) => voice.locale === locale);
  const voice = options.find((voice) => voice.id === selected) ?? options[0];
  return (
    <section className="original-voice-player">
      <h3>{t(languages[locale])}</h3>
      <label htmlFor={selectId}>{t("Base voice")}</label>
      <select
        id={selectId}
        value={voice?.id ?? ""}
        disabled={!options.length}
        onChange={(event) => {
          audio.current?.pause();
          setSelected(event.target.value);
          setFailed(false);
        }}
      >
        {!options.length && (
          <option value="">{t("No base voices available.")}</option>
        )}
        {options.map((item) => (
          <option key={item.id} value={item.id}>
            {t("Voice {number}").replace("{number}", item.id.split("-")[1])}
          </option>
        ))}
      </select>
      {voice && (
        <audio
          key={voice.url}
          ref={audio}
          controls
          preload="none"
          src={voice.url}
          aria-label={`${t(languages[locale])} — ${t("Voice {number}").replace("{number}", voice.id.split("-")[1])}`}
          onError={() => setFailed(true)}
          onPlaying={() => setFailed(false)}
        />
      )}
      {failed && (
        <p className="error" role="alert">
          {t(
            "Could not play the base voice. Choose another voice or reopen this window.",
          )}
        </p>
      )}
    </section>
  );
}

export function AboutVoicesModal({ close }: { close: () => void }) {
  const { t } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const dismiss = useModalDismiss(close);
  const [voices, setVoices] = useState<OriginalVoice[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(true);
  const [voicesFailed, setVoicesFailed] = useState(false);
  const [voiceAttempt, setVoiceAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setVoicesLoading(true);
    setVoicesFailed(false);
    const load = async () => {
      try {
        const data = await api<{ voices: OriginalVoice[] }>(
          "base-voices/media-access",
          { signal: controller.signal },
        );
        if (!controller.signal.aborted) setVoices(data.voices);
      } catch {
        if (!controller.signal.aborted) setVoicesFailed(true);
      } finally {
        if (!controller.signal.aborted) setVoicesLoading(false);
      }
    };
    void load();
    // Renew browser playback grants while the window remains open.
    const timer = window.setInterval(() => void load(), 45 * 60 * 1000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [voiceAttempt]);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    api<{ markdown: string }>("base-voices/about", {
      signal: controller.signal,
    })
      .then((data) => {
        if (typeof data.markdown !== "string")
          throw new Error("Invalid voice information");
        if (!controller.signal.aborted) setMarkdown(data.markdown);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [attempt]);
  return (
    <dialog
      ref={dialog}
      className="generation-queue-dialog about-voices-dialog"
      aria-labelledby="about-voices-title"
      {...dismiss}
    >
      <div className="generation-queue-heading">
        <h2 id="about-voices-title">{t("About the base voices")}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label={t("Close")}
          onClick={close}
        >
          <X size={20} />
        </button>
      </div>
      {voicesLoading ? (
        <p role="status" className="muted">
          {t("Loading voices…")}
        </p>
      ) : voicesFailed ? (
        <div role="alert">
          <p>{t("Could not load voices. Try again.")}</p>
          <button
            type="button"
            onClick={() => setVoiceAttempt((value) => value + 1)}
          >
            {t("Try again")}
          </button>
        </div>
      ) : (
        <div
          className="original-voice-grid"
          onPlayCapture={(event) => {
            const current = event.target as HTMLAudioElement;
            event.currentTarget.querySelectorAll("audio").forEach((player) => {
              if (player !== current) player.pause();
            });
          }}
        >
          {(["en", "es", "pt"] as const).map((locale) => (
            <OriginalVoicePlayer key={locale} locale={locale} voices={voices} />
          ))}
        </div>
      )}
      <section className="voice-notes" aria-labelledby="voice-notes-title">
        <h3 id="voice-notes-title">{t("Notes")}</h3>
        <div
          className="voice-notes-scroll"
          tabIndex={0}
          role="region"
          aria-labelledby="voice-notes-title"
        >
          {failed ? (
            <div role="alert">
              <p>
                {t(
                  "Could not load voice information. Try again or contact the administrator.",
                )}
              </p>
              <button
                type="button"
                onClick={() => setAttempt((value) => value + 1)}
              >
                {t("Try again")}
              </button>
            </div>
          ) : markdown === null ? (
            <p className="muted" role="status">
              {t("Loading voice information…")}
            </p>
          ) : !markdown.trim() ? (
            <p className="muted">
              {t("No voice information has been added yet.")}
            </p>
          ) : (
            <article className="voice-information-content">
              <Markdown
                remarkPlugins={[remarkGfm]}
                skipHtml
                components={{
                  a: ({ node, ...props }) => (
                    <a {...props} target="_blank" rel="noopener noreferrer" />
                  ),
                }}
              >
                {markdown}
              </Markdown>
            </article>
          )}
        </div>
      </section>
      <div className="modal-footer">
        <button type="button" onClick={close}>
          {t("Close")}
        </button>
      </div>
    </dialog>
  );
}
