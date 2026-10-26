export type AudioMediaAccess = {
  base: string;
  query: string;
  expiresAt: number;
};

export function audioMediaUrl(
  access: AudioMediaAccess,
  chapter: number,
  verse?: number,
  revision = "",
  file?: string,
  original = false,
) {
  const query = new URLSearchParams(access.query);
  query.set("chapter", String(chapter));
  query.set("revision", revision);
  if (verse !== undefined) query.set("verse", String(verse));
  if (file) query.set("file", file);
  return `${access.base}${original ? "original-media" : "media"}?${query}`;
}
