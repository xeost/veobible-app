import type { Version } from "./config.js";
import type { OutroTitle } from "./video.js";

const platforms = ["youtube", "x", "instagram", "tiktok", "facebook"] as const;
const labels: Record<
  Version["locale"],
  { title: string; highlight: string; channel: string }
> = {
  es: {
    title: "Síguenos",
    highlight: "para escuchar más",
    channel: "VeoBible en Español",
  },
  en: {
    title: "Follow us",
    highlight: "to hear more",
    channel: "VeoBible in English",
  },
  pt: {
    title: "Siga-nos",
    highlight: "para ouvir mais",
    channel: "VeoBible em Português",
  },
};

export async function outroTitle(
  locale: Version["locale"],
  configuredAccounts: Partial<Record<(typeof platforms)[number], string>> = {},
): Promise<OutroTitle> {
  const social: OutroTitle["social"] = [];
  for (const platform of platforms) {
    const value = configuredAccounts[platform];
    if (value === undefined) continue;
    if (typeof value !== "string")
      throw new Error(`Expected a social username for ${locale}.${platform}`);
    const handle = value.trim();
    if (handle)
      social.push({
        platform:
          platform === "x"
            ? "X"
            : platform === "youtube"
              ? "YouTube"
              : platform === "instagram"
                ? "Instagram"
                : platform === "facebook"
                  ? "Facebook"
                  : "TikTok",
        handle: handle.startsWith("@") ? handle : `@${handle}`,
      });
  }
  return { ...labels[locale], social, website: "veobible.com" };
}
