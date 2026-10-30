"use client";
import { useState } from "react";
import { useI18n } from "../i18n/context";
export function AudioPhrasePatch({
  text,
  disabled,
  generate,
}: {
  text: string;
  disabled: boolean;
  generate: (patch: {
    start: number;
    end: number;
    text: string;
    sourceText: string;
  }) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const [range, setRange] = useState({ start: 0, end: 0 });
  const [replacement, setReplacement] = useState("");
  return (
    <details className="audio-phrase-patch">
      <summary>{t("Correct a phrase")}</summary>
      <p>
        {t(
          "Select a complete phrase, enter its replacement, then listen to the verse before approving it.",
        )}
      </p>
      <textarea
        rows={3}
        aria-label={t("Select the phrase to replace")}
        readOnly
        value={text}
        disabled={disabled}
        onSelect={(event) => {
          const field = event.currentTarget;
          let start = field.selectionStart,
            end = field.selectionEnd;
          if (end > start) {
            while (
              start > 0 &&
              /[\p{L}\p{N}]/u.test(text[start - 1]) &&
              /[\p{L}\p{N}]/u.test(text[start])
            )
              start--;
            while (
              end < text.length &&
              /[\p{L}\p{N}]/u.test(text[end - 1]) &&
              /[\p{L}\p{N}]/u.test(text[end])
            )
              end++;
          }
          setRange({ start, end });
        }}
      />
      <p>{text.slice(range.start, range.end)}</p>
      <textarea
        rows={2}
        aria-label={t("Replacement phrase")}
        value={replacement}
        maxLength={1000}
        disabled={disabled}
        onChange={(event) => setReplacement(event.target.value)}
      />
      <button
        type="button"
        className="primary"
        disabled={
          disabled ||
          range.end <= range.start ||
          !replacement.trim() ||
          !text.slice(range.start, range.end).trim()
        }
        onClick={async () => {
          if (
            await generate({
              ...range,
              text: replacement.trim(),
              sourceText: text,
            })
          )
            setReplacement("");
        }}
      >
        {t("Generate replacement phrase")}
      </button>
    </details>
  );
}
