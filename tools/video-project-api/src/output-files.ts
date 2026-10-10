export const videoFilename = (kind: string) =>
  kind === "short" ? "0-short.mp4" : "0-episode.mp4";
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
