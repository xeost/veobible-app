import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  socialButtonText,
  verticalPositionFraction,
  type SocialButtonElement,
  type VideoLocale,
  type SocialVariant,
} from "../visual-elements";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Social button design and motion adapted from the example dashboard's SocialCta. */
export function SocialButtonAnimation({
  element,
  locale,
  variant,
  durationSeconds,
}: {
  element: SocialButtonElement;
  locale: VideoLocale;
  variant: SocialVariant;
  durationSeconds: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const durationFrames = Math.max(1, Math.round(durationSeconds * fps));
  const progress = frame / Math.max(1, durationFrames - 1);
  const enter = interpolate(progress, [0, 0.12], [0, 1], clamp);
  const exit = interpolate(progress, [0.88, 1], [1, 0], clamp);
  const clicked = progress >= 0.36;
  const ringing = progress >= 0.64;
  const youtube = variant === "subscribe";
  const labels = socialButtonText(locale, variant);
  const clickScale =
    1 - Math.max(0, 1 - Math.abs(progress - 0.36) / 0.045) * 0.055;
  const cursorX = interpolate(
    progress,
    [0.13, 0.31, 0.43, 0.59, 0.76, 0.86],
    [660, 285, 285, 533, 533, 660],
    clamp,
  );
  const cursorY = interpolate(
    progress,
    [0.13, 0.31, 0.43, 0.59, 0.76, 0.86],
    [220, 62, 62, 60, 60, 220],
    clamp,
  );
  const ringRotation = ringing
    ? Math.sin((progress - 0.64) * 95) *
      18 *
      Math.max(0, 1 - (progress - 0.64) / 0.2)
    : 0;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: `${verticalPositionFraction[element.verticalPosition] * 100}%`,
          transform: `translate(-50%, -50%) translateY(${(1 - enter) * 35}px) scale(${0.92 + enter * 0.08})`,
          opacity: enter * exit,
          width: 600,
          height: 118,
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          data-visual-button
          style={{
            transform: `scale(${clickScale})`,
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: 12,
            borderRadius: youtube ? 24 : 72,
            background: youtube ? "#ffffff" : "#101827",
            border: youtube ? "2px solid #ffffff" : "2px solid #ffffff30",
            boxShadow: "0 18px 65px #00000060",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 18,
              flex: 1,
              height: 88,
              borderRadius: youtube ? 14 : 60,
              background: clicked
                ? youtube
                  ? "#ed1717"
                  : "#f97316"
                : youtube
                  ? "#eeeeee"
                  : "#24364c",
              color: youtube && !clicked ? "#202020" : "#ffffff",
              fontSize: 39,
              fontWeight: 700,
            }}
          >
            <svg
              width="44"
              height="44"
              viewBox="0 0 44 44"
              fill="none"
              aria-hidden="true"
            >
              {clicked ? (
                <path
                  d="m10 22 8 8 17-18"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : youtube ? (
                <path d="m15 9 23 13-23 13Z" fill="currentColor" />
              ) : (
                <>
                  <circle
                    cx="17"
                    cy="14"
                    r="7"
                    stroke="currentColor"
                    strokeWidth="3"
                  />
                  <path
                    d="M4 38c0-15 26-15 26 0M35 13v14m-7-7h14"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </>
              )}
            </svg>
            <span style={{ display: "inline-grid", textAlign: "center" }}>
              <span
                aria-hidden={clicked}
                style={{
                  gridArea: "1 / 1",
                  visibility: clicked ? "hidden" : "visible",
                }}
              >
                {labels.label}
              </span>
              <span
                aria-hidden={!clicked}
                style={{
                  gridArea: "1 / 1",
                  visibility: clicked ? "visible" : "hidden",
                }}
              >
                {labels.subscribedLabel}
              </span>
            </span>
          </div>
          <div
            data-visual-bell
            style={{
              width: 88,
              height: 88,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: ringing
                ? youtube
                  ? "#eeeeee"
                  : "#f9731633"
                : "transparent",
              color: youtube ? "#202020" : "#ffffff",
            }}
          >
            <svg
              width="52"
              height="52"
              viewBox="0 0 48 48"
              fill="none"
              aria-hidden="true"
              style={{
                transform: `rotate(${ringRotation}deg)`,
                transformOrigin: "50% 20%",
              }}
            >
              <path
                d="M12 20a12 12 0 0 1 24 0v10l4 5H8l4-5Z"
                stroke="currentColor"
                fill={ringing ? "currentColor" : "none"}
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              <path
                d="M19 40a5 5 0 0 0 10 0"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              {ringing && (
                <path
                  d="M5 13 2 23M43 13l3 10"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              )}
            </svg>
          </div>
        </div>
        {[0.36, 0.64].map((at) => {
          const pulse = interpolate(progress, [at, at + 0.1], [0, 1], clamp);
          return (
            <div
              key={at}
              style={{
                position: "absolute",
                left: at === 0.36 ? 285 : 533,
                top: 62,
                width: 65,
                height: 65,
                borderRadius: "50%",
                border: `3px solid ${youtube ? "#ed1717" : "#f97316"}`,
                transform: `translate(-50%, -50%) scale(${0.5 + pulse})`,
                opacity: progress >= at ? 1 - pulse : 0,
              }}
            />
          );
        })}
        <svg
          data-visual-pointer
          width="58"
          height="68"
          viewBox="0 0 40 48"
          aria-hidden="true"
          style={{
            position: "absolute",
            left: cursorX,
            top: cursorY,
            opacity: interpolate(
              progress,
              [0.12, 0.18, 0.81, 0.87],
              [0, 1, 1, 0],
              clamp,
            ),
            filter: "drop-shadow(0 3px 4px #0007)",
          }}
        >
          <path
            d="M3 2v33l9-8 8 17 7-4-8-16h14Z"
            fill="white"
            stroke="#111827"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </AbsoluteFill>
  );
}
