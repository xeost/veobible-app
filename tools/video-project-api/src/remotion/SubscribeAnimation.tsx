import { SocialButtonAnimation } from "./SocialButtonAnimation";
import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  visualElementRanges,
  type SubscribeElement,
  type VisualElements,
  type VisualElement,
  type SocialVariant,
  type VideoLocale,
  verticalPositionFraction,
} from "../visual-elements";
import type { ShortCompositionProps } from "../engines/short/remotion/types";

export function SubscribeAnimation({
  element,
  durationSeconds,
  variant = "subscribe",
  verticalPosition,
}: {
  element: SubscribeElement;
  durationSeconds: number;
  variant?: SocialVariant;
  verticalPosition?: keyof typeof verticalPositionFraction;
}) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const time = frame / fps;
  const progress = time / durationSeconds;
  const subscribed = progress >= 0.42;
  const entrance = Math.min(1, time / 0.35);
  const exit = Math.min(1, (durationSeconds - time) / 0.35);
  const scale = (width / 1080) * 1.25;
  const click = Math.max(0, 1 - Math.abs(progress - 0.42) / 0.045);
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        alignItems: "center",
        justifyContent: verticalPosition ? "flex-start" : "flex-end",
        paddingTop: verticalPosition
          ? height * verticalPositionFraction[verticalPosition]
          : undefined,
        paddingBottom: verticalPosition ? 0 : width < height ? "26%" : "14%",
        opacity: Math.max(0, Math.min(entrance, exit)),
      }}
    >
      <div
        style={{
          transform: `translateY(${verticalPosition ? -50 : 0}%) translateY(${(1 - entrance) * 40}px) scale(${scale})`,
          transformOrigin: verticalPosition ? "center" : "bottom center",
          position: "relative",
        }}
      >
        <div
          data-visual-button
          style={{
            transform: `scale(${1 - click * 0.06})`,
            display: "flex",
            alignItems: "center",
            gap: 20,
            padding: "24px 32px",
            borderRadius: variant === "follow" ? 60 : 18,
            background:
              variant === "follow"
                ? subscribed
                  ? "#e8f4ff"
                  : "#2463eb"
                : subscribed
                  ? "#f5f5f5"
                  : "#ff0033",
            color: subscribed ? "#202020" : "white",
            fontFamily: "Arial, sans-serif",
            fontSize: Math.min(
              34,
              680 /
                Math.max(
                  element.label.length,
                  element.subscribedLabel.length,
                  1,
                ),
            ),
            fontWeight: 700,
            boxShadow: "0 8px 32px #0006",
          }}
        >
          {variant === "follow" ? (
            <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
              <circle
                cx="15"
                cy="11"
                r="6"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
              />
              <path
                d="M3 34v-4a12 12 0 0 1 24 0v4"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
              />
              <path
                d={subscribed ? "M27 15l4 4 7-8" : "M32 9v14M25 16h14"}
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg width="48" height="36" viewBox="0 0 48 36" aria-hidden="true">
              <rect
                width="48"
                height="36"
                rx="10"
                fill={subscribed ? "#ff0033" : "white"}
              />
              <path
                d="M20 10 L33 18 L20 26 Z"
                fill={subscribed ? "white" : "#ff0033"}
              />
            </svg>
          )}
          <span
            style={{
              display: "inline-grid",
              textAlign: variant === "follow" ? "center" : undefined,
            }}
          >
            <span
              aria-hidden={subscribed}
              style={{
                gridArea: "1 / 1",
                visibility: subscribed ? "hidden" : "visible",
              }}
            >
              {element.label}
            </span>
            <span
              aria-hidden={!subscribed}
              style={{
                gridArea: "1 / 1",
                visibility: subscribed ? "visible" : "hidden",
              }}
            >
              {element.subscribedLabel}
            </span>
          </span>
          {variant === "subscribe" && (
            <svg
              width="32"
              height="36"
              viewBox="0 0 32 36"
              aria-hidden="true"
              style={{
                visibility: subscribed ? "visible" : "hidden",
                flexShrink: 0,
              }}
            >
              <path
                d="M7 24V14a9 9 0 0 1 18 0v10l4 4H3l4-4M12 32h8"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <path
                d="M2 9l-1 9M30 9l1 9"
                stroke="currentColor"
                strokeWidth="2"
              />
            </svg>
          )}
        </div>
        {progress > 0.22 && progress < 0.68 && (
          <svg
            data-visual-pointer
            width="42"
            height="50"
            viewBox="0 0 42 50"
            aria-hidden="true"
            style={{
              position: "absolute",
              right: 65,
              bottom: -23,
              transform: `translate(${Math.max(0, 0.36 - progress) * 250}px, ${Math.max(0, 0.36 - progress) * 220}px)`,
            }}
          >
            <path
              d="M3 2v35l10-9 9 19 9-5-9-18h15Z"
              fill="white"
              stroke="#202020"
              strokeWidth="3"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
    </AbsoluteFill>
  );
}

export function VisualElementAnimation({
  element,
  durationSeconds,
  locale = "en",
  variant = "subscribe",
}: {
  element: VisualElement;
  durationSeconds: number;
  locale?: VideoLocale;
  variant?: SocialVariant;
}) {
  if (element.template === "youtube-subscribe")
    return (
      <SubscribeAnimation element={element} durationSeconds={durationSeconds} />
    );
  return (
    <SocialButtonAnimation
      element={element}
      durationSeconds={durationSeconds}
      locale={locale}
      variant={variant}
    />
  );
}

export function VisualElementsOverlay({
  props,
}: {
  props: ShortCompositionProps & { visualElements?: VisualElements };
}) {
  const { fps } = useVideoConfig();
  return (
    <>
      {visualElementRanges(props, props.visualElements).map(
        ({ key, element, start, duration }) => (
          <Sequence
            key={key}
            from={Math.round(start * fps)}
            durationInFrames={Math.max(1, Math.round(duration * fps))}
            layout="none"
          >
            <VisualElementAnimation
              element={element}
              durationSeconds={duration}
              locale={props.videoLocale}
              variant={props.socialVariant}
            />
          </Sequence>
        ),
      )}
    </>
  );
}
