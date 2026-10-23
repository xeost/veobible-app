import type { SocialVariant } from "./visual-elements";
export const videoFilename = (kind: string) =>
  kind === "short" ? "0-short.mp4" : "0-episode.mp4";
export const videoVariantFilename = (kind: string, variant: SocialVariant) =>
  `0-${kind}-${variant}.mp4`;

export const legacyVideoVariantFilename = (kind: string) =>
  videoFilename(kind).replace(/\.mp4$/, "-subscribe.mp4");

/** Single videos retain their established filename; multiple videos name every variant. */
export const renderedVideoFilename = (
  kind: string,
  variant: SocialVariant,
  count: number,
) => (count > 1 ? videoVariantFilename(kind, variant) : videoFilename(kind));

export const generatedVideoFilenames = (kind: string) => [
  ...new Set([
    videoFilename(kind),
    videoFilename(kind).slice(2),
    legacyVideoVariantFilename(kind),
    videoVariantFilename(kind, "subscribe"),
    videoVariantFilename(kind, "follow"),
  ]),
];
export function thumbnailFilename(descriptions: Record<string, string> = {}) {
  const sections = Object.keys(descriptions).flatMap((name) => {
    const match = /^3\.(\d+)-youtube\.txt$/.exec(name);
    return match ? [Number(match[1])] : [];
  });
  return `3.${Math.max(0, ...sections) + 1}-thumbnail.jpg`;
}

export const isPublicationFilename = (name: string) =>
  /^[1-5](?:\.\d+)?-(?:instagram|facebook|youtube|tiktok|x)\.txt$/.test(name);
export const isNumberedThumbnailFilename = (name: string) =>
  /^3\.\d+-thumbnail\.jpg$/.test(name);
export const publicationFilenames = {
  instagram: "1-instagram.txt",
  facebook: "2-facebook.txt",
  youtube: "3-youtube.txt",
  tiktok: "4-tiktok.txt",
  x: "5-x.txt",
} as const;
