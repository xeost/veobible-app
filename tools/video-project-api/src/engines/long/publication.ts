import { publicationDescriptions as descriptions } from "../../publication.js";
import type { PublicationTemplates } from "../../publication-templates.js";
import type { Version } from "./config.js";
import type { IntroTitle } from "./video.js";
export function publicationDescriptions(
  locale: Version["locale"],
  title: IntroTitle,
  verses: string[],
  templates: PublicationTemplates = {},
  passageUrl = "",
): Record<string, string> {
  return descriptions(locale, title, verses, templates, "long", passageUrl);
}
