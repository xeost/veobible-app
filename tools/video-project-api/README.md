# VeoBible Video Project API

Servicio Node local autónomo con análisis bíblico, síntesis de voces y composiciones Remotion propias en `src/engines/short` y `src/engines/long`. No importa código, dependencias, catálogos, outputs ni configuración de las CLI o del dashboard. Usa los datos bíblicos estáticos del frontend sin importar su código. Su contrato HTTP está en `src/protocol.ts`.

## Instalación y fuentes

Requiere Node 22+, pnpm y FFmpeg/ffprobe. Instala únicamente este paquete y copia `.env.example` a `.env`. Arranca con `pnpm start` desde esta carpeta, o mediante `pnpm start:api-proxy` desde la raíz. El proxy transmite el token compartido; las variables de proceso prevalecen sobre el `.env` propio de esta API.

- `apps/frontend/public/bible-data/<locale>/<version>/index.json` y `<book>/<chapter>.json`: datos bíblicos estáticos compartidos con el sitio público. La ruta es fija, relativa al repositorio, e independiente del directorio de ejecución; no es configurable.
- `<SHORTS_WORKING_DIR|LONGS_WORKING_DIR>/material/bible-audio/<version>/`: audios originales de capítulos; alternativa `VIDEO_AUDIO_DIR`. Se mantiene la nomenclatura existente `NN-book-chapter.mp3` o `.m4a`.
- `<SHORTS_WORKING_DIR|LONGS_WORKING_DIR>/material/videos/`: `0-intro.mp4`, `0-outro.mp4` y fondos `bg-N.mp4`.
- `<SHORTS_WORKING_DIR|LONGS_WORKING_DIR>/material/voices/`: muestras para Chatterbox (`es.mp3`, `en.mp3`, `pt.mp3`, con variantes por intro/outro).
- Los textos de narración se configuran por formato e idioma en los botones Settings de Short Videos y Long Videos. Se guardan en `site_settings` y se reciben en `voiceTemplates` para analizar, generar voces o renderizar; no se leen plantillas locales. Las cuentas sociales se configuran en Settings del dashboard, se guardan en `site_settings` y se reciben en `socialAccounts` de cada solicitud de render. No se leen cuentas desde archivos locales; si no se envían cuentas, las redes se omiten del cierre.

`SHORTS_WORKING_DIR` y `LONGS_WORKING_DIR` definen las raíces por formato (rutas absolutas o relativas al paquete). En esta laptop apuntan a `/Users/fabian/Documents/veobible-shorts` y `/Users/fabian/Documents/veobible-longs`. Cada raíz contiene `material/{videos,voices,bible-audio}`, `outputs/<version>/<passage>` para producción y las CLI, y `outputs-dev/<version>/<passage>` para el dashboard en desarrollo, con la misma estructura que las CLI: `short.mp4` o `episode.mp4`, `thumbnail.jpg`, textos de publicación y `_internal/`. Los audios bíblicos pueden seguir en su biblioteca externa mediante `VIDEO_AUDIO_DIR` o las opciones por formato. Sin variables se usa `work/short` y `work/long` dentro del paquete. Las variables anteriores `VIDEO_MEDIA_DIR` y `VIDEO_SHORT/LONG_WORKING_DIR` ya no se usan.

`VIDEO_SHORT_*` y `VIDEO_LONG_*` permiten configurar cada motor por separado: `VIDEOS_DIR`, `AUDIO_DIR`, `FFMPEG`, `RENDER_CONCURRENCY`, `TTS_PROVIDER`, `TTS_PYTHON`, `TTS_MODEL`, `TTS_MODEL_ES/EN/PT`, `TTS_DEVICE`, `TTS_VOICE_PROMPT`, `TTS_VOICE_PROMPT_ES/EN/PT`, y `TTS_VOICE_PROMPT_<locale>_INTRO/OUTRO`. Las cuentas sociales provienen de Settings del dashboard. También se admiten `ELEVENLABS_API_KEY`, `ELEVENLABS_MODEL` y `ELEVENLABS_VOICE_ES/EN/PT` por motor.

Para modelos locales, el único servicio compartido es `voice-generator`: por defecto usa `../voice-generator/cli.py` y su `.venv/bin/python`. `VIDEO_TTS_SCRIPT` y las variables `TTS_PYTHON` permiten otra instalación. Las CLI no participan en esta llamada.

El dashboard guarda el entorno de archivos por proyecto y envía `outputEnvironment` al generar, consultar voces y reproducir archivos. Los proyectos nuevos siguen su `NODE_ENV`; los importados siguen el entorno del dashboard que solicita la sincronización. La API admite `production` (por defecto) y `development` por solicitud, por lo que puede atender ambos entornos con salidas independientes. El material se comparte entre ambos entornos.

`GET /v1/projects/existing?kind=short|long&outputEnvironment=production|development` descubre proyectos en `outputs/<version>/<slug>` o `outputs-dev/<version>/<slug>` según el entorno solicitado del working dir correspondiente. Usa los presets y la metadata del proyecto para reconstruir los pasajes, y lee `status.json` en el directorio de salidas seleccionado para traducir las marcas de uso a publicación, aisladas por idioma y versión. Los archivos internos aportan offsets, volumen y opciones de audio; admite los nombres internos anteriores. Mantiene ambos entornos separados, no importa código de las CLI y no modifica sus archivos. Devuelve los proyectos válidos, el número de omitidos y los IDs con trabajo activo. Los videos ya presentes se reconocen como generados aunque no tengan `render-result.json`.

## HTTP y persistencia

Rutas autenticadas con Bearer token de 32+ caracteres:

- `GET /v1/video-project-proposals?kind=short|long&locale=es|en|pt&version=<code>`: lee las propuestas de `material/video-project-presets.json` del working dir correspondiente y añade títulos con los nombres de libros de la versión seleccionada.
- `GET /v1/bible-versions/books?locale=es|en|pt&version=<code>`: libros, nombres y límites de capítulos y versículos de la versión seleccionada para la creación manual de proyectos.
- `GET /v1/bible-versions`: descubre versiones por idioma y código en el directorio compartido `bible-data`; toma el nombre de los metadatos de cada índice y vuelve a leerlo en cada consulta.
- `GET /health`: disponibilidad y trabajos activos.
- `POST /v1/analyze`: texto, contexto, guiones, cortes, tiempos y fondos.
- `POST /v1/jobs`: render con identificador de tarea, ID numérico de proyecto, pasaje, versión y ajustes. El callback autenticado es opcional; el dashboard no lo utiliza.
- `GET /v1/jobs/:id`: progreso efímero de una tarea de render.
- `GET /v1/queue`: tareas de voces y videos; el dashboard muestra solo las activas o pendientes.
- `GET /v1/projects/:id/state`: estado derivado de la cola activa y resultado guardado en los archivos del proyecto.
- `GET /v1/projects/:id/media/:asset?kind=short|long&version=rv1909&passage=<id>&outputEnvironment=production|development>`: video, thumbnail, intro/outro; soporta Range.

Los callbacks opcionales solo pueden dirigirse a `DASHBOARD_ORIGINS`. La cola es serial y admite hasta 20 trabajos. El dashboard conserva los ajustes y la marca de uso en D1, sin tabla de trabajos ni estado persistido. La API guarda progreso temporal en RAM y escribe `_internal/render-result.json` al completar el render. Tras reiniciar conserva los resultados en disco, pero no reanuda renders pendientes; se pueden volver a generar desde los ajustes del proyecto.

Las voces y sus textos se conservan en `_internal/1-intro.{wav,txt}` y `_internal/3-outro.{wav,txt}`, junto a `2-versiculos.txt`, `0-metadata.txt` y `README.md`. Los ajustes siguen en la base de datos: el dashboard no necesita ni crea `2-passage-audio-offsets.json`, `2-passage-audio-settings.json`, `2-verse-text-offsets.json` o `default-version-settings.json`. Los archivos existentes de las CLI se conservan; no se importan automáticamente sus ajustes ni su estado al dashboard. `status.json` pertenece al registro de publicaciones utilizadas de las CLI, no al renderizado. Los archivos auxiliares de síntesis y render son temporales.

Los proyectos del dashboard se crean manualmente. Los avances de las CLI no se sincronizan automáticamente con la base del dashboard.

## Propuestas de proyectos

Cada formato tiene una lista en `<WORKING_DIR>/material/video-project-presets.json`. Ambos archivos usan la misma estructura, independiente del idioma o versión bíblica:

```json
[
  {
    "id": 1,
    "slug": "john-3-14-19",
    "start": { "book": "john", "chapter": 3, "verse": 14 },
    "end": { "book": "john", "chapter": 3, "verse": 19 }
  }
]
```

`id` es el número de propuesta dentro de la lista y no un ID de proyecto de la base de datos. En largos conserva el número original de episodio. `slug` conserva el identificador textual de la CLI: el pasaje original en cortos y `episode-001`, `episode-002`, etc. en largos. Ambos extremos incluyen siempre libro, capítulo y versículo, por lo que pueden abarcar libros diferentes.

La conversión inicial conserva exactamente los 100 pasajes de `tools/shorts-daily-dose/popular-verses.json` y los 365 episodios de `tools/longs-365-days/episodes.json`, en su orden original, incluidos los 40 episodios que cruzan libros. Los archivos fuente de las CLI no se modifican. El generador vuelve a leer la lista correspondiente en cada solicitud. Los menús de Short Videos y Long Videos del dashboard sincronizan estas propuestas por versión bíblica, insertando solo los slugs que faltan. Los libros inicial y final se conservan al convertir la propuesta al contrato de render; los largos incluyen el número de episodio.

## Verificación

`pnpm check` verifica también las composiciones TSX. `pnpm test` ejecuta una prueba desde una copia aislada de la API, sin carpetas hermanas de CLI/dashboard, con fuentes sintéticas y un adaptador de voz de prueba.

`pnpm test:render` agrega renders completos de ambos formatos y verifica que solo queden MP4/JPG/WAV en los directorios de proyectos. Remotion necesita puertos locales y descarga su navegador en el paquete de la API si falta.

Generation queue responses include individual progress percentages and a batch summary. A batch starts when an idle queue receives work and includes tasks added before it drains. Total progress weights each task equally, retains finished tasks until the next batch, and counts failed tasks as settled. Video progress combines preparation stages with renderer progress; speech progress uses provider stages and local sampling percentages when available.
