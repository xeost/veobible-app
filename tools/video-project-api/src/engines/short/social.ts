import { videoDomainSchema } from "../../domain.js";
import type { Version } from "./config.js";
import type { OutroTitle } from "./video.js";

const platforms = ["youtube", "x", "instagram", "tiktok", "facebook"] as const;
const labels: Record<Version["locale"], { title: string; highlight: string }> =
  {
    es: {
      title: "Síguenos",
      highlight: "para escuchar más",
    },
    en: {
      title: "Follow us",
      highlight: "to hear more",
    },
    pt: {
      title: "Siga-nos",
      highlight: "para ouvir mais",
    },
  };

export async function outroTitle(
  locale: Version["locale"],
  configuredAccounts: Partial<Record<(typeof platforms)[number], string>> & {
    shortTitle?: string;
    title?: string;
  } = {},
  website = "",
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
  return {
    ...labels[locale],
    shortTitle: (configuredAccounts.shortTitle ?? "").trim().toUpperCase(),
    channel: (configuredAccounts.title ?? "").trim(),
    social,
    website: videoDomainSchema.parse(website),
  };
}
