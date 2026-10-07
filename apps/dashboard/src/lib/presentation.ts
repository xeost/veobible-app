/** User-facing vocabulary. Diagnostic details remain in logs and saved job records. */
export const statusLabel = (status: string): string =>
  (
    ({
      draft: "Pendiente",
      queued: "En espera",
      running: "Generando",
      ready: "Generado",
      done: "Completado",
      failed: "Requiere atención",
      requested: "Solicitada",
      building: "Preparando publicación",
      deploying: "Publicando",
      success: "Publicado",
      cancelled: "Cancelada",
      unknown: "Por confirmar",
    }) as Record<string, string>
  )[status] ?? "Por confirmar";

export function generationStage(stage: string | null, status: string): string {
  if (status === "done") return "Video generado";
  if (status === "failed") return "La generación no pudo completarse";
  if (status === "queued") return "Esperando turno para generar el video";
  if (/analiz|texto|tiempo/i.test(stage ?? ""))
    return "Preparando el pasaje y sus tiempos";
  if (/vo[zcs]|audio/i.test(stage ?? "")) return "Preparando la narración";
  if (/miniatura/i.test(stage ?? "")) return "Preparando la miniatura";
  return "Creando el video";
}

const messages = new Set([
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
export function userMessage(error: unknown, status?: number): string {
  const text =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  if (messages.has(text)) return text;
  if (
    /Se requiere administrador|Unauthorized|Origen no permitido/i.test(text) ||
    status === 403
  )
    return "No tienes permiso para realizar esta acción.";
  if (/overlap|solap|invalid verse timing/i.test(text))
    return "Los tiempos de algunos versículos se superponen o están fuera del pasaje. Revisa los ajustes de inicio y fin.";
  if (/invalid audio cut|Audio offsets/i.test(text))
    return "El corte de audio está fuera del pasaje. Revisa los ajustes de inicio y fin.";
  if (/volumeMultiplier|reading volume/i.test(text))
    return "El volumen de lectura debe estar entre 0 y 4.";
  if (
    /Missing audio|Missing voice|Voice prompt|ENOENT|unavailable|No bg-/i.test(
      text,
    )
  )
    return "Faltan archivos necesarios para crear este video. Contacta al administrador.";
  if (/interrump|perdió este trabajo/i.test(text))
    return "La generación se interrumpió. Puedes volver a generar el video con tus ajustes guardados.";
  if (
    /fetch failed|Failed to fetch|conexión|ECONN|timeout/i.test(text) ||
    status === 502 ||
    status === 503
  )
    return "No se pudo conectar. Inténtalo de nuevo en unos momentos.";
  if (
    status === 400 ||
    (error && typeof error === "object" && "issues" in error)
  )
    return "Revisa los datos y ajustes introducidos antes de continuar.";
  return "No se pudo completar la acción. Inténtalo de nuevo; si el problema continúa, contacta al administrador.";
}

export function voiceFailureMessage(reason?: string): string {
  if (reason === "disk_full")
    return "No hay espacio suficiente en el equipo que genera la voz. Libera espacio en disco y vuelve a intentarlo.";
  if (reason === "interrupted")
    return "El equipo interrumpió la generación de voz. Revisa el espacio en disco y cierra aplicaciones antes de volver a intentarlo.";
  return "No se pudo generar la voz. Vuelve a intentarlo; si el problema continúa, contacta al administrador.";
}

export function jobSummary(job: {
  snapshot?: string | null;
  result?: string | null;
}) {
  try {
    const snapshot = job.snapshot ? JSON.parse(job.snapshot) : {};
    const result = job.result ? JSON.parse(job.result) : {};
    return {
      version: snapshot.version?.label || null,
      volume:
        typeof snapshot.settings?.volumeMultiplier === "number"
          ? snapshot.settings.volumeMultiplier
          : null,
      voices:
        {
          voice: "Narración generada",
          mix: "Narración y audio del video",
          video: "Audio del video original",
        }[snapshot.settings?.clipAudioMode as "voice" | "mix" | "video"] ||
        null,
      duration: typeof result.duration === "number" ? result.duration : null,
    };
  } catch {
    return { version: null, volume: null, voices: null, duration: null };
  }
}
