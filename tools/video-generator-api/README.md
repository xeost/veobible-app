# VeoBible Video Generator API

Servicio Node local autónomo con análisis bíblico, síntesis de voces y composiciones Remotion propias en `src/engines/short` y `src/engines/long`. No importa código, dependencias, catálogos, outputs ni configuración de las CLI o del dashboard. Usa los datos bíblicos estáticos del frontend sin importar su código. Su contrato HTTP está en `src/protocol.ts`.

## Instalación y fuentes

Requiere Node 22+, pnpm y FFmpeg/ffprobe. Instala únicamente este paquete y copia `.env.example` a `.env`. Arranca con `pnpm start` desde esta carpeta, o mediante `pnpm start:api-proxy` desde la raíz. El proxy transmite el token compartido; las variables de proceso prevalecen sobre el `.env` propio de esta API.

- `apps/frontend/public/bible-data/<locale>/<version>/index.json` y `<book>/<chapter>.json`: datos bíblicos estáticos compartidos con el sitio público. La ruta es fija, relativa al repositorio, e independiente del directorio de ejecución; no es configurable.
- `<SHORTS_WORKING_DIR|LONGS_WORKING_DIR>/material/bible-audio/<version>/`: audios originales de capítulos; alternativa `VIDEO_AUDIO_DIR`. Se mantiene la nomenclatura existente `NN-book-chapter.mp3` o `.m4a`.
- `<SHORTS_WORKING_DIR|LONGS_WORKING_DIR>/material/videos/`: `0-intro.mp4`, `0-outro.mp4` y fondos `bg-N.mp4`.
- `<SHORTS_WORKING_DIR|LONGS_WORKING_DIR>/material/voices/`: muestras para Chatterbox (`es.mp3`, `en.mp3`, `pt.mp3`, con variantes por intro/outro).
- Los textos de narración se configuran por formato e idioma en los botones Settings de Short Videos y Long Videos. Se guardan en `site_settings` y se reciben en `voiceTemplates` para analizar, generar voces o renderizar; no se leen plantillas locales. Las cuentas sociales se configuran en Settings del dashboard, se guardan en `site_settings` y se reciben en `socialAccounts` de cada solicitud de render. No se leen cuentas desde archivos locales; si no se envían cuentas, las redes se omiten del cierre.

`SHORTS_WORKING_DIR` y `LONGS_WORKING_DIR` definen las raíces por formato (rutas absolutas o relativas al paquete). En esta laptop apuntan a `/Users/fabian/Documents/veobible-shorts` y `/Users/fabian/Documents/veobible-longs`. Cada raíz contiene `material/{videos,voices,bible-audio}`, `media/sources/<UUID>` y `outputs/<UUID>`; estos últimos conservan el video y la miniatura finales. Los audios bíblicos pueden seguir en su biblioteca externa mediante `VIDEO_AUDIO_DIR` o las opciones por formato. Sin variables se usa `work/short` y `work/long` dentro del paquete. Las variables anteriores `VIDEO_MEDIA_DIR` y `VIDEO_SHORT/LONG_WORKING_DIR` ya no se usan.

`VIDEO_SHORT_*` y `VIDEO_LONG_*` permiten configurar cada motor por separado: `VIDEOS_DIR`, `AUDIO_DIR`, `FFMPEG`, `RENDER_CONCURRENCY`, `TTS_PROVIDER`, `TTS_PYTHON`, `TTS_MODEL`, `TTS_MODEL_ES/EN/PT`, `TTS_DEVICE`, `TTS_VOICE_PROMPT`, `TTS_VOICE_PROMPT_ES/EN/PT`, y `TTS_VOICE_PROMPT_<locale>_INTRO/OUTRO`. Las cuentas sociales provienen de Settings del dashboard. También se admiten `ELEVENLABS_API_KEY`, `ELEVENLABS_MODEL` y `ELEVENLABS_VOICE_ES/EN/PT` por motor.

Para modelos locales, el único servicio compartido es `voice-generator`: por defecto usa `../voice-generator/cli.py` y su `.venv/bin/python`. `VIDEO_TTS_SCRIPT` y las variables `TTS_PYTHON` permiten otra instalación. Las CLI no participan en esta llamada.

## HTTP y persistencia

Rutas autenticadas con Bearer token de 32+ caracteres:

- `GET /health`: disponibilidad y trabajos activos.
- `POST /v1/analyze`: texto, contexto, guiones, cortes, tiempos y fondos.
- `POST /v1/jobs`: render con UUID, pasaje, versión, ajustes y callback autenticado.
- `GET /v1/jobs/:id`: progreso efímero para reconciliar D1.
- `GET /v1/projects/:id/media/:asset?kind=short|long`: video, thumbnail, intro/outro; soporta Range.

Los callbacks solo pueden dirigirse a `DASHBOARD_ORIGINS`. La cola es serial y admite hasta 20 trabajos. D1 guarda estados, guiones, ajustes y snapshots; la API guarda progreso temporal en RAM. Tras un reinicio no se reanudan renders; el dashboard permite reintentar con los ajustes conservados.

La persistencia de proyectos en disco es solo multimedia: `media/sources` conserva voces y `media/renders` contiene videos y miniaturas descartables. No guarda JSON de estados/ajustes. Los archivos de solicitud para síntesis y los archivos auxiliares de render son temporales y se eliminan al terminar. `VIDEO_MEDIA_DIR` permite otra ubicación (relativa a este paquete).

La importación histórica es opcional y pertenece al dashboard: `apps/dashboard/scripts/import-cli.mjs` prepara SQL usando su propia copia del catálogo y lee outputs antiguos solo cuando se invoca; `import-media.mjs` copia multimedia tras aplicar ese SQL. No forma parte del arranque ni del render.

## Verificación

`pnpm check` verifica también las composiciones TSX. `pnpm test` ejecuta una prueba desde una copia aislada de la API, sin carpetas hermanas de CLI/dashboard, con fuentes sintéticas y un adaptador de voz de prueba.

`pnpm test:render` agrega renders completos de ambos formatos y verifica que solo queden MP4/JPG/WAV en los directorios de proyectos. Remotion necesita puertos locales y descarga su navegador en el paquete de la API si falta.
