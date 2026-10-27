"use client";
import { useState } from "react";
import { useI18n } from "../i18n/context";
import { AboutVoicesModal } from "./AboutVoicesModal";
import { BaseVoiceSelector } from "./BaseVoiceSelector";
import type { VoiceSampleSettings } from "../lib/voice-sample-settings";

export function VoiceSamples({
  settings,
  disabled,
  disabledModels,
}: {
  settings: VoiceSampleSettings | null;
  disabled: boolean;
  disabledModels?: string[];
}) {
  const { t } = useI18n();
  const [aboutOpen, setAboutOpen] = useState(false);
  const [voices, setVoices] = useState({ en: "en-1", es: "es-1", pt: "pt-1" });
  return (
    <section
      className="panel voice-samples"
      aria-labelledby="voice-samples-title"
    >
      <div className="voice-samples-heading">
        <h2 id="voice-samples-title">{t("Try narration voices")}</h2>
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => setAboutOpen(true)}
        >
          {t("About the voices")}
        </button>
      </div>
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
                disabled={
                  disabled || disabledModels?.includes(settings.models[locale])
                }
                narrationSettings={settings}
                disabledModels={disabledModels}
              />
            </fieldset>
          ))}
        </div>
      ) : (
        <p className="muted">
          {t("Load voice generation settings above to try the voices.")}
        </p>
      )}
      {aboutOpen && <AboutVoicesModal close={() => setAboutOpen(false)} />}
    </section>
  );
}
