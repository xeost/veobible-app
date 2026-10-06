import fs from "node:fs/promises";
import { config, type Version } from "./config.js";
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
): Promise<OutroTitle> {
  let data: unknown;
  try {
    data = JSON.parse(await fs.readFile(config.socialAccounts, "utf8"));
  } catch (error) {
    throw new Error(
      `Cannot read social accounts from ${config.socialAccounts}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const entry = (data as Record<string, unknown> | null)?.[locale];
  if (!entry || typeof entry !== "object" || Array.isArray(entry))
    throw new Error(`Missing ${locale} accounts in ${config.socialAccounts}`);
  const accounts = entry as Record<string, unknown>;
  const social: OutroTitle["social"] = [];
  for (const platform of platforms) {
    const value = accounts[platform];
    if (platform === "facebook" && value === undefined) continue;
    if (typeof value !== "string")
      throw new Error(
        `Expected a string for ${locale}.${platform} in ${config.socialAccounts}`,
      );
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
