"use client";
import { useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Trash2 } from "lucide-react";
import type { AudioRecording } from "../../../../tools/video-project-api/src/audio-project-schema";
import { useI18n } from "../i18n/context";
import { AudioTakePlayer } from "./AudioTakePlayer";
import { ConfirmDialog } from "./ConfirmDialog";
export function AudioLayers({
  recording,
  media,
  disabled,
  update,
}: {
  recording: AudioRecording;
  media: (file: string, revision: string) => string;
  disabled: boolean;
  update: (edits: { revision: string; enabled: boolean }[]) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const [deleting, setDeleting] = useState<string>();
  const layers = recording.layers ?? [];
  const submit = (next: typeof layers) =>
    update(next.map(({ revision, enabled }) => ({ revision, enabled })));
  return (
    <div className="audio-layers">
      <strong>{t("Audio patches")}</strong>
      <p className="muted">
        {t(
          "The last enabled patch covers overlapping parts of earlier patches. Move patches down to give them priority.",
        )}
      </p>
      {recording.base && (
        <div className="audio-layer">
          <strong>{t("Initial recording")}</strong>
          <AudioTakePlayer
            key={recording.base.revision}
            label={t("Initial recording")}
            src={media(recording.base.file, recording.base.revision)}
          />
        </div>
      )}
      <ol>
        {layers.map((layer, index) => (
          <li
            key={layer.revision}
            className={`audio-layer${layer.enabled ? "" : " audio-layer-disabled"}`}
          >
            <div className="audio-layer-heading">
              <button
                type="button"
                className="icon-button"
                disabled={disabled}
                aria-pressed={layer.enabled}
                aria-label={t(layer.enabled ? "Disable patch" : "Enable patch")}
                data-tooltip={t(
                  layer.enabled ? "Disable patch" : "Enable patch",
                )}
                onClick={() =>
                  void submit(
                    layers.map((item) =>
                      item === layer
                        ? { ...item, enabled: !item.enabled }
                        : item,
                    ),
                  )
                }
              >
                {layer.enabled ? <Eye size={17} /> : <EyeOff size={17} />}
              </button>
              <strong>
                {t("Patch")} {index + 1}
              </strong>
              <small>
                {layer.start.toFixed(2)}–{layer.end.toFixed(2)} s
              </small>
              <div className="audio-layer-actions">
                {(
                  [
                    [-1, ArrowUp, "Move patch up"],
                    [1, ArrowDown, "Move patch down"],
                  ] as const
                ).map(([offset, Icon, label]) => (
                  <button
                    type="button"
                    className="icon-button"
                    key={label}
                    aria-label={t(label)}
                    data-tooltip={t(label)}
                    disabled={
                      disabled ||
                      index + offset < 0 ||
                      index + offset >= layers.length
                    }
                    onClick={() => {
                      const next = [...layers];
                      [next[index], next[index + offset]] = [
                        next[index + offset],
                        next[index],
                      ];
                      void submit(next);
                    }}
                  >
                    <Icon size={16} />
                  </button>
                ))}
                <button
                  type="button"
                  className="icon-button danger"
                  disabled={disabled}
                  aria-label={t("Delete patch")}
                  data-tooltip={t("Delete patch")}
                  onClick={() => setDeleting(layer.revision)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <p>{layer.text}</p>
            <AudioTakePlayer
              label={`${t("Patch")} ${index + 1}`}
              src={media(layer.file, layer.revision)}
            />
          </li>
        ))}
      </ol>
      {deleting && (
        <ConfirmDialog
          title={t("Delete patch")}
          confirmLabel={t("Delete patch")}
          destructive
          busy={disabled}
          close={() => setDeleting(undefined)}
          onConfirm={() => {
            void submit(
              layers.filter((layer) => layer.revision !== deleting),
            ).then((ok) => {
              if (ok) setDeleting(undefined);
            });
          }}
        >
          <p>
            {t(
              "Delete this patch? The initial recording and other patches will be kept.",
            )}
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}
