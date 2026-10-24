import {
  replacesDomain,
  socialHorizontalPosition,
  socialVerticalPosition,
  type VisualElement,
  type SocialButtonElement,
} from "./visual-elements";
import {
  fitFontSize as shortFit,
  positionY as shortY,
} from "./engines/short/remotion/animation";
import {
  fitFontSize as longFit,
  positionY as longY,
} from "./engines/long/remotion/animation";

export type DomainScene = "reading" | "outro";
export type DomainReplacementRange = {
  id: string;
  element: VisualElement;
  start: number;
  duration: number;
};
export const domainFadeSeconds = 0.3;
export const domainSceneForSection = (id: string): DomainScene =>
  id === "outro" ? "outro" : "reading";

/** Hide only the domain, retaining the scene's own entrance and exit animation. */
export function domainReplacementOpacity(
  time: number,
  ranges: DomainReplacementRange[],
  scene: DomainScene,
) {
  return ranges.reduce((opacity, range) => {
    if (
      range.element.template !== "social-button" ||
      !replacesDomain(range.element) ||
      range.element.hidden ||
      domainSceneForSection(range.id) !== scene
    )
      return opacity;
    const end = range.start + range.duration;
    const value =
      time < range.start
        ? (range.start - time) / domainFadeSeconds
        : time <= end
          ? 0
          : (time - end) / domainFadeSeconds;
    return Math.min(opacity, Math.max(0, Math.min(1, value)));
  }, 1);
}

/** Match the domain's horizontal alignment and text-line center in each scene. */
export function domainReplacementAnchor(
  width: number,
  height: number,
  scene: DomainScene,
  website = "VEOBIBLE.COM",
) {
  const portrait = height > width;
  if (!portrait && scene === "reading") {
    const font = (20 * width) / 1920;
    return {
      x: width / 2 + ((1488 / 2 - 100) * width) / 1920,
      y:
        (height + (740 * height) / 1080) / 2 -
        (45 * height) / 1080 -
        (font * 1.2) / 2,
      align: "right" as const,
    };
  }
  const artWidth = portrait ? 1080 : 1920;
  const artHeight = portrait ? 1920 : 1080;
  const x = portrait ? (scene === "reading" ? 116 : 112) : 160;
  const y = portrait ? shortY(scene === "reading" ? 1510 : 1418) : longY(890);
  const text =
    portrait && scene === "reading"
      ? website.toUpperCase().split("").join(" ")
      : website;
  const size = Math.max(
    1,
    Math.round(((scene === "reading" ? 24 : 54) * width) / artWidth),
  );
  const maxWidth = Math.round(((portrait ? 800 : 1600) * width) / artWidth);
  const fitted = Math.max(
    1,
    Math.round((portrait ? shortFit : longFit)(text, size, maxWidth)),
  );
  return {
    x: Math.round((x * width) / artWidth),
    y: Math.round((y * height) / artHeight) + (fitted * 1.28) / 2,
    align: "left" as const,
  };
}

/** Resolve both positioning modes and apply offsets as percentages of the frame. */
export function socialButtonPlacement(
  element: SocialButtonElement,
  width: number,
  height: number,
  scene: DomainScene = "reading",
  website?: string,
) {
  const anchor = replacesDomain(element)
    ? domainReplacementAnchor(width, height, scene, website)
    : {
        x: socialHorizontalPosition(element) * width,
        y: socialVerticalPosition(element) * height,
        align:
          element.verticalPosition === "custom"
            ? ("center" as const)
            : element.horizontalPosition === "left"
              ? ("left" as const)
              : element.horizontalPosition === "right"
                ? ("right" as const)
                : ("center" as const),
      };
  return {
    ...anchor,
    x:
      anchor.x +
      (element.offsetsEnabled
        ? ((element.horizontalOffset ?? 0) * width) / 100
        : 0),
    y:
      anchor.y +
      (element.offsetsEnabled
        ? ((element.verticalOffset ?? 0) * height) / 100
        : 0),
  };
}
