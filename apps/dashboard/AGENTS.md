# Lenguaje de la interfaz

El dashboard está dirigido a personas que editan y publican videos. No presupongas conocimientos de desarrollo de software ni de la infraestructura de la plataforma.

- Usa lenguaje claro, orientado a la tarea del usuario: crear videos, ajustar tiempos, guardar cambios, revisar el progreso y publicar contenido.
- No muestres terminología interna de desarrollo o infraestructura en títulos, menús, botones, formularios, ayudas, textos de accesibilidad, notificaciones, estados, errores, historial ni estados vacíos. Esto incluye mensajes recibidos de otros servicios.
- Evita referencias como D1, SQL, API, proxy, backend, frontend, Worker, Cloudflare, ViNext, Remotion, Chatterbox, CLI, JSON, UUID, tokens, hooks, callbacks, bindings, migraciones y rutas internas de archivos. Usa alternativas como «ajustes guardados», «creando el video», «actualizaciones» o «generación disponible», según la situación.
- Presenta los ajustes mediante controles gráficos y el historial mediante datos legibles. No expongas objetos JSON, respuestas de servicios, trazas de errores, identificadores internos ni nombres de variables de configuración.
- Explica los errores con una consecuencia comprensible y una acción posible. Conserva los detalles técnicos en los registros internos para diagnóstico. Reutiliza y amplía `src/lib/presentation.ts` para traducir estados, etapas y errores.
- Los términos propios de la edición de videos, como volumen, miniatura, narración, pasaje, versión bíblica y tiempos en segundos, son apropiados cuando ayudan a tomar una decisión. Describe el uso práctico sin explicar su implementación.
- Esta regla se aplica al producto visible, no a nombres de código, contratos, bases de datos, pruebas, documentación para desarrolladores ni registros internos. Una instrucción explícita del usuario puede solicitar información técnica en una vista concreta.
- Antes de entregar un cambio de interfaz, revisa sus textos visibles y mensajes dinámicos para comprobar que cumplen esta regla.

- La interfaz admite español e inglés. Reutiliza `useI18n` y añade la traducción correspondiente en `src/i18n/en.ts` al introducir textos nuevos; conserva los nombres propios y el contenido bíblico.
