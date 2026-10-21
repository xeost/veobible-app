"use client";
import { useState } from "react";
import { useI18n } from "../i18n/context";
import { BaseVoiceSelector } from "./BaseVoiceSelector";
import type { VoiceSampleSettings } from "../lib/voice-sample-settings";

export function VoiceSamples({
  settings,
  disabled,
}: {
  settings: VoiceSampleSettings | null;
  disabled: boolean;
}) {
  const { t } = useI18n();
  const [voices, setVoices] = useState({ en: "en-1", es: "es-1", pt: "pt-1" });
  return (
    <section
      className="panel voice-samples"
      aria-labelledby="voice-samples-title"
    >
      <h2 id="voice-samples-title">{t("Try narration voices")}</h2>
      <p className="muted">
        {t(
          "Choose a voice for each Bible language and generate an example using the model and narration preset selected above. You can try changes before saving them.",
        )}
      </p>
      {settings ? (
        <div className="voice-generation-languages">
          {(["en", "es", "pt"] as const).map((locale) => (
            <fieldset key={locale}>
              <legend>
                {t({ en: "English", es: "Spanish", pt: "Portuguese" }[locale])}
              </legend>
              <BaseVoiceSelector
                locale={locale}
                value={voices[locale]}
                onChange={(voice) =>
                  setVoices((current) => ({ ...current, [locale]: voice }))
                }
                label="Narration voice"
                disabled={disabled}
                narrationSettings={settings}
              />
            </fieldset>
          ))}
        </div>
      ) : (
        <p className="muted">
          {t("Load voice generation settings above to try the voices.")}
        </p>
      )}
    </section>
  );
}
