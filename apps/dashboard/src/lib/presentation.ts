import type { Language } from "../i18n/context";
import { translateServer } from "./i18n-server";

export function publicationLabel(
  published: boolean | number,
  language: Language = "en",
): string {
  const labels = {
    en: { published: "Published", unpublished: "Unpublished" },
    es: { published: "Publicado", unpublished: "No publicado" },
    pt: { published: "Publicado", unpublished: "Não publicado" },
  };
  return labels[language][published ? "published" : "unpublished"];
}

/** User-facing vocabulary. Diagnostic details remain in logs and saved job records. */
export const statusLabel = (status: string, lang?: Language): string => {
  const label =
    (
      {
        draft: "Pending",
        queued: "Queued",
        running: "Generating",
        ready: "Generated",
        done: "Completed",
        failed: "Needs attention",
        requested: "Requested",
        building: "Preparing publication",
        deploying: "Publishing",
        success: "Published",
        cancelled: "Cancelled",
        unknown: "Awaiting confirmation",
      } as Record<string, string>
    )[status] ?? "Awaiting confirmation";
  return lang ? translateServer(label, lang) : label;
};

export function generationStage(
  stage: string | null,
  status: string,
  lang?: Language,
): string {
  let text = "Creating the video";
  if (status === "done") text = "Video generated";
  else if (status === "failed") text = "Generation could not be completed";
  else if (status === "queued") text = "Waiting to generate the video";
  else if (/analiz|texto|tiempo|analyz|timing/i.test(stage ?? ""))
    text = "Preparing the passage and timing";
  else if (/vo[zcs]|audio|narration/i.test(stage ?? ""))
    text = "Preparing the narration";
  else if (/miniatura|thumbnail/i.test(stage ?? ""))
    text = "Preparing the thumbnail";

  return lang ? translateServer(text, lang) : text;
}

const messages = new Set([
  "Generate every chapter introduction before generating the video.",
  "Generate the introduction and closing voices before generating the video.",
  "Could not sync existing projects. Check that generation is available and try again.",
  "Books could not be loaded. Check that this version is available and try again.",
  "A project with this short name already exists for the selected version.",
  "Projects could not be synced. Check that generation is available and try again.",
  "Versions could not be synced. Check that generation is available and try again.",
  "This version has associated projects. You can change its name, but you cannot change its language or code or delete it.",
  "A version with this code already exists in the selected language.",
  "Configure narration scripts in Settings before generating.",
  "This username is already in use. Choose another one.",
  "You do not have permission to perform this action.",
  "Some verse timings fall outside the passage or have a start after the end. Review the start and end adjustments.",
  "Some verse times overlap or fall outside the passage. Review the start and end adjustments.",
  "The audio cut falls outside the passage. Review the start and end adjustments.",
  "Reading volume must be between 0 and 4.",
  "Files needed to create this video are missing. Contact your administrator.",
  "Could not connect. Try again in a few moments.",
  "Review the information and settings you entered before continuing.",
  "Could not complete this action. Try again; if the problem continues, contact your administrator.",

  "Sign in",
  "Incorrect username or password",
  "Incorrect current password",
  "Wait a few minutes before trying again",
  "You cannot change your own role or access from this list",
  "Video not found",
  "Version not found",
  "No files available",
  "Wait for generation to finish",
  "A generation is already in progress",
  "Generation was interrupted. You can generate the video again with your saved settings.",
  "Publishing updates is not available yet. Contact your administrator.",

  // Legacy / Spanish inputs
  "No se pudieron sincronizar los proyectos existentes. Comprueba que la generación esté disponible y vuelve a intentarlo.",
  "No se pudieron cargar los libros. Comprueba que esta versión esté disponible y vuelve a intentarlo.",
  "Ya existe un proyecto con este nombre corto para la versión seleccionada.",
  "No se pudieron sincronizar los proyectos. Comprueba que la generación esté disponible y vuelve a intentarlo.",
  "No se pudieron sincronizar las versiones. Comprueba que la generación esté disponible y vuelve a intentarlo.",
  "Esta versión tiene proyectos asociados. Puedes cambiar su nombre, pero no su idioma o código ni eliminarla.",
  "Ya existe una versión con este código en el idioma seleccionado.",
  "Configura los textos de voz en Settings antes de generar.",
  "Ese nombre de usuario ya está en uso. Elige otro.",
  "No tienes permiso para realizar esta acción.",
  "Los tiempos de algunos versículos están fuera del pasaje o tienen el inicio después del final. Revisa los ajustes de inicio y fin.",
  "Los tiempos de algunos versículos se superponen o están fuera del pasaje. Revisa los ajustes de inicio y fin.",
  "El corte de audio está fuera del pasaje. Revisa los ajustes de inicio y fin.",
  "El volumen de lectura debe estar entre 0 y 4.",
  "Faltan archivos necesarios para crear este video. Contacta al administrador.",
  "No se pudo conectar. Inténtalo de nuevo en unos momentos.",
  "Revisa los datos y ajustes introducidos antes de continuar.",
  "No se pudo completar la acción. Inténtalo de nuevo; si el problema continúa, contacta al administrador.",
  "Inicia sesión",
  "Usuario o contraseña incorrectos",
  "Contraseña actual incorrecta",
  "Espera unos minutos antes de reintentar",
  "No puedes cambiar tu propio rol o acceso desde esta lista",
  "Video inexistente",
  "Versión inexistente",
  "Sin archivos",
  "Espera a que termine la generación",
  "Ya hay un trabajo activo",
  "La generación se interrumpió. Puedes volver a generar el video con tus ajustes guardados.",
  "La publicación de actualizaciones todavía no está disponible. Contacta al administrador.",
]);

export function userMessage(
  error: unknown,
  status?: number,
  lang?: Language,
): string {
  const text =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  let result = "";
  if (messages.has(text)) {
    result = text;
  } else if (
    /Se requiere administrador|Administrator required|Unauthorized|Origen no permitido|Origin not allowed/i.test(
      text,
    ) ||
    status === 403
  ) {
    result = "You do not have permission to perform this action.";
  } else if (/overlap|solap|invalid verse timing/i.test(text)) {
    result =
      "Some verse times overlap or fall outside the passage. Review the start and end adjustments.";
  } else if (/invalid audio cut|Audio offsets/i.test(text)) {
    result =
      "The audio cut falls outside the passage. Review the start and end adjustments.";
  } else if (/volumeMultiplier|reading volume/i.test(text)) {
    result = "Reading volume must be between 0 and 4.";
  } else if (
    /Missing audio|Missing voice|Voice prompt|ENOENT|unavailable|No bg-/i.test(
      text,
    )
  ) {
    result =
      "Files needed to create this video are missing. Contact your administrator.";
  } else if (/interrump|perdió este trabajo|interrupted/i.test(text)) {
    result =
      "Generation was interrupted. You can generate the video again with your saved settings.";
  } else if (
    /fetch failed|Failed to fetch|conexión|ECONN|timeout/i.test(text) ||
    status === 502 ||
    status === 503
  ) {
    result = "Could not connect. Try again in a few moments.";
  } else if (
    status === 400 ||
    (error && typeof error === "object" && "issues" in error)
  ) {
    result =
      "Review the information and settings you entered before continuing.";
  } else {
    result =
      "Could not complete this action. Try again; if the problem continues, contact your administrator.";
  }

  return lang ? translateServer(result, lang) : result;
}

export function voiceFailureMessage(reason?: string, lang?: Language): string {
  let text =
    "Could not generate narration. Try again; if the problem persists, contact the administrator.";
  if (reason === "disk_full")
    text =
      "There is not enough space on the computer generating narration. Free up disk space and try again.";
  else if (reason === "interrupted")
    text =
      "The computer interrupted narration generation. Check disk space and close applications before trying again.";
  else if (reason === "resource_limit")
    text =
      "Narration generation stopped to keep the computer responsive. Close unused applications and try again.";
  else if (reason === "timeout")
    text =
      "Narration generation exceeded its time limit. Try again; if the problem persists, contact the administrator.";
  else if (reason === "voice_busy")
    text =
      "Another narration is still being generated. Wait for it to finish and try again.";

  return lang ? translateServer(text, lang) : text;
}

export function jobSummary(
  job: {
    snapshot?: string | null;
    result?: string | null;
  },
  lang?: Language,
) {
  try {
    const snapshot = job.snapshot ? JSON.parse(job.snapshot) : {};
    const result = job.result ? JSON.parse(job.result) : {};
    const rawVoices =
      {
        voice: "Generated narration",
        mix: "Narration and video audio",
        video: "Original video audio",
      }[snapshot.settings?.clipAudioMode as "voice" | "mix" | "video"] || null;

    return {
      version: snapshot.version?.label || null,
      volume:
        typeof snapshot.settings?.volumeMultiplier === "number"
          ? snapshot.settings.volumeMultiplier
          : null,
      voices: rawVoices && lang ? translateServer(rawVoices, lang) : rawVoices,
      duration: typeof result.duration === "number" ? result.duration : null,
    };
  } catch {
    return { version: null, volume: null, voices: null, duration: null };
  }
}
