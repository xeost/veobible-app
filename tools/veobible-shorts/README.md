# VeoBible Shorts CLI

Asistente interactivo para crear vídeos completos de pasajes bíblicos populares. Selecciona idioma, versión y pasaje. Cada preparación crea `short.mp4`, `versiculos.txt`, `metadata.txt` y `offsets.json` en su carpeta de salida. Se puede marcar el pasaje como utilizado después de generarlo.

## Instalación y ejecución

Requiere Node.js 18+, pnpm, `ffmpeg` y `ffprobe` (incluidos en FFmpeg) disponibles en `PATH`.

```bash
cd tools/veobible-shorts
pnpm install
cp .env.example .env
pnpm start
```

También se puede iniciar desde la raíz con `pnpm shorts`.

Al iniciar la CLI en una terminal interactiva, la interfaz comienza en la parte superior de la pantalla. Pulsa **Backspace** para volver a mostrar el menú actual desde arriba. El contenido anterior queda disponible al desplazarse por el historial de la terminal.

## Configuración

Copia `.env.example` a `.env` dentro de `tools/veobible-shorts` y ajusta las rutas. La herramienta carga ese archivo aunque la ejecutes desde la raíz del repositorio. También puedes cambiar los valores predeterminados en `src/config.ts`. Las variables exportadas en el entorno del proceso tienen prioridad sobre `.env`; si falta una variable, se usa el valor predeterminado de `config.ts`.

| Variable | Valor predeterminado |
| --- | --- |
| `VEOBIBLE_SHORTS_WORKING_DIR` | `/Users/fabian/Documents/veobible-shorts` |
| `VEOBIBLE_SHORTS_OUTPUT_DIR` | `<workingDir>/outputs` |
| `VEOBIBLE_SHORTS_VIDEOS_DIR` | `<workingDir>/material/videos` |
| `VEOBIBLE_SHORTS_CLIP_AUDIO_MODE` | `voice`; también admite `mix` y `video` |
| `VEOBIBLE_SHORTS_AUDIO_DIR` | `/Users/fabian/Documents/audiobibles/sources/audios` |
| `VEOBIBLE_SHORTS_BIBLE_DATA_DIR` | `<raíz del repositorio>/frontend/public/bible-data` |
| `VEOBIBLE_SHORTS_TTS_PROVIDER` | `chatterbox`; también admite `elevenlabs` |
| `VEOBIBLE_SHORTS_ELEVENLABS_API_KEY` | Vacío; obligatorio para ElevenLabs |
| `VEOBIBLE_SHORTS_ELEVENLABS_MODEL` | `eleven_multilingual_v2` |
| `VEOBIBLE_SHORTS_ELEVENLABS_VOICE_ES`, `_EN`, `_PT` | Vacío; ID de voz obligatorio para el idioma seleccionado con ElevenLabs |
| `VEOBIBLE_SHORTS_TTS_PYTHON` | `<raíz del repositorio>/tools/veobible-voice/.venv/bin/python` |
| `VEOBIBLE_SHORTS_TTS_MODEL` | `multilingual` (`latam` solo para español) |
| `VEOBIBLE_SHORTS_TTS_MODEL_ES`, `_EN`, `_PT` | Modelo del idioma; si falta, usa `VEOBIBLE_SHORTS_TTS_MODEL` |
| `VEOBIBLE_SHORTS_TTS_DEVICE` | `auto` |
| `VEOBIBLE_SHORTS_TTS_VOICE_PROMPT_ES` | `<workingDir>/material/voices/es.mp3` |
| `VEOBIBLE_SHORTS_TTS_VOICE_PROMPT_EN` | `<workingDir>/material/voices/en.mp3` |
| `VEOBIBLE_SHORTS_TTS_VOICE_PROMPT_PT` | `<workingDir>/material/voices/pt.mp3` |
| `VEOBIBLE_SHORTS_TTS_VOICE_PROMPT_ES_INTRO`, `_ES_OUTRO` (y equivalentes `_EN_*`, `_PT_*`) | Rutas opcionales para cada pista; si faltan, busca `<workingDir>/material/voices/<idioma>-<pista>.mp3` o `.wav` |
| `VEOBIBLE_SHORTS_TTS_VOICE_PROMPT` | Vacío; muestra compartida que sustituye los valores predeterminados cuando no hay ruta por idioma |
| `VEOBIBLE_SHORTS_TTS_TEMPLATES` | `tools/veobible-shorts/voice-templates.json` |

`VEOBIBLE_SHORTS_OUTPUT_DIR` es opcional: si lo omites, se usa `outputs` dentro de `VEOBIBLE_SHORTS_WORKING_DIR`. El archivo `.env` queda excluido de Git; `.env.example` sirve como plantilla.

El catálogo común a todos los idiomas está en `popular-verses.json`. Cada entrada necesita un `id` único, el `book` en inglés tal como aparece en los índices bíblicos, y puntos `start` y `end` con `chapter` y `verse`. Los pasajes pueden cruzar capítulos dentro de un mismo libro. La herramienta valida los límites según la versión elegida.

Al configurar un pasaje, procura que el texto de los versículos seleccionados abarque **entre 130 y 150 palabras**. Esa extensión apunta a una narración de alrededor de **60 segundos** para el short video. El número de palabras puede variar entre idiomas y versiones, por lo que conviene comprobarlo en cada versión que vayas a utilizar.

El catálogo incluido contiene **100 pasajes de los 66 libros**, todos verificados con **130–150 palabras en Reina Valera 1909**. Consulta [la selección y los conteos por versión](popular-verses.md) para ver el tema de cada pasaje, los criterios de selección y las fuentes de interés consultadas. El orden es una propuesta editorial para shorts. La duración de 60–70 segundos depende de la velocidad de narración y las pausas; debe confirmarse con el audio final.

Los archivos se guardan en `<outputDir>/<versionId>/<id>/`. `status.json` se guarda directamente en `<outputDir>` y marca los pasajes globalmente por `id`, independientemente de idioma y versión. En la lista, los pasajes usados aparecen al final con la marca **✓ Used**. Crear el vídeo no lo marca automáticamente; el asistente lo pregunta al final. Si se omite, el pasaje se puede marcar más tarde desde su menú.

## Montaje del vídeo

Coloca en `<workingDir>/material/videos/` los clips `0-intro.mp4`, `0-outro.mp4` y uno o más fondos llamados `bg-0.mp4`, `bg-1.mp4`, etc. Si usas otra carpeta, configúrala con `VEOBIBLE_SHORTS_VIDEOS_DIR`. La CLI elige un fondo al azar, crea una secuencia que lo reproduce hacia adelante y en reversa, y la repite durante la lectura. `ffmpeg` monta intro, lectura y outro en `short.mp4` con un fundido cruzado de imagen y audio de 0,5 segundos en cada unión. El audio del fondo elegido no se utiliza.

Los audios bíblicos originales siguen divididos por capítulo. La CLI estima el inicio y el final del pasaje según la proporción de palabras de cada versículo y usa `ffmpeg` para ajustar cada límite a una pausa cercana cuando la detecta. Después concatena los fragmentos necesarios si el pasaje cruza capítulos. El segmento de lectura tiene un segundo de silencio antes y después del audio bíblico; 0,5 segundos de cada margen se solapan con el fundido correspondiente. Las pausas no identifican por sí solas los versículos, así que **comprueba el inicio y el final escuchando el vídeo generado**. `metadata.txt` guarda los límites antes y después de los ajustes y el nombre del fondo seleccionado.

Cada salida incluye un `offsets.json` editable, inicialmente con `{"startSeconds": 0, "endSeconds": 0}`. Tras escuchar `short.mp4`, cambia `startSeconds` para mover el inicio de la lectura y `endSeconds` para mover su final; un número positivo mueve el límite más adelante en el audio fuente y uno negativo lo mueve hacia atrás. Los valores están en segundos y se suman a los límites automáticos indicados en `metadata.txt`. En **Reprocess complete video**, la CLI conserva el archivo editado y aplica sus valores al nuevo montaje. Si el pasaje cruza capítulos, el offset inicial afecta al primer capítulo y el final al último. Los límites deben quedar dentro del audio de cada capítulo y mantener un fragmento de duración positiva.

Para volver a generar un vídeo existente, elige **Reprocess complete video** y confirma el reemplazo. Si la salida anterior contiene `intro.wav`, `outro.wav`, `intro.txt` y `outro.txt`, la CLI pregunta si quieres reutilizarlos; **Yes** es la respuesta predeterminada. Los cuatro archivos se copian a la nueva salida y se evita volver a ejecutar Chatterbox o llamar a ElevenLabs. Si quieres actualizar la voz, sus muestras o sus guiones, responde **No** para generarlos de nuevo. La CLI prepara la salida en una carpeta temporal y conserva la anterior si falla la generación. La marca del pasaje en `status.json` se conserva. Esta opción también convierte salidas del formato anterior al nuevo vídeo completo.

## Voz de intro y outro

Por defecto, `VEOBIBLE_SHORTS_CLIP_AUDIO_MODE=voice` genera las locuciones de intro y outro con Chatterbox o ElevenLabs y las coloca sobre `0-intro.mp4` y `0-outro.mp4`, respectivamente, sustituyendo el audio original de esos clips. Con `mix`, las locuciones se mezclan con el audio original a volumen reducido. Con `video`, se usa únicamente el audio incorporado en los MP4. **La intro y la outro terminan un segundo después de que termine su audio**, aunque sus vídeos duren más o menos: se recorta el vídeo sobrante o se prolonga el último fotograma. Cada locución se guarda como WAV PCM de 24 bits a 48 kHz, junto a su guion; `ffmpeg` utiliza esos WAV directamente para el montaje. Si falla la síntesis o el montaje, la salida anterior se conserva. El proveedor se elige en `.env`.

Las plantillas de español, inglés y portugués se editan en [voice-templates.json](voice-templates.json), dentro de esta herramienta. Admiten `{reference}`, `{version}`, `{book}`, `{start}`, `{end}` y `{passage_id}`. Los valores provienen del pasaje y la versión elegidos; `veobible-shorts` entrega los guiones completos a [VeoBible Voice](../veobible-voice/README.md), que solo sintetiza el texto recibido.

En las locuciones, `{reference}` escribe los números con letras (por ejemplo, «Juan capítulo tres versículos catorce al diecinueve»). También convierte los números de libros como «1 Juan» a «Primera de Juan». `metadata.txt` conserva la referencia escrita «Juan 3:14-19». Después de editar las plantillas o cambiar de proveedor, usa **Reprocess complete video** y elige generar las locuciones de nuevo para actualizar la salida.

### Chatterbox local

Instala primero las dependencias en el entorno propio de [VeoBible Voice](../veobible-voice/README.md). `veobible-shorts` usa automáticamente `tools/veobible-voice/.venv/bin/python` y ejecuta su `cli.py`; no necesita configurar `VEOBIBLE_SHORTS_TTS_PYTHON` salvo que uses otra ubicación para ese entorno. Puedes seleccionar `latam` solo para español con `VEOBIBLE_SHORTS_TTS_MODEL_ES` o usar otro JSON de plantillas con `VEOBIBLE_SHORTS_TTS_TEMPLATES`. Los WAV finales son PCM de 24 bits a 48 kHz.

Durante la generación local, la terminal muestra la etapa actual y el tiempo transcurrido. Los mensajes de descarga, avisos y barras internas de Chatterbox se ocultan; si falla la generación, se muestran los detalles técnicos del error.

### Muestras de voz por idioma

Las muestras están fuera del repositorio, en `<workingDir>/material/voices/`. Para cada idioma se busca primero una muestra dedicada a la pista: `es-intro.mp3` y `es-outro.mp3`, `en-intro.mp3` y `en-outro.mp3`, o `pt-intro.mp3` y `pt-outro.mp3`. También se aceptan archivos `.wav`. Si falta una muestra dedicada, se usa la muestra general de ese idioma (`es.mp3`, `en.mp3` o `pt.mp3`; también `.wav`). Puedes cambiar las rutas generales en `tools/veobible-shorts/.env`:

```dotenv
VEOBIBLE_SHORTS_TTS_VOICE_PROMPT_ES=/Users/fabian/Documents/veobible-shorts/material/voices/es.mp3
VEOBIBLE_SHORTS_TTS_VOICE_PROMPT_EN=/Users/fabian/Documents/veobible-shorts/material/voices/en.mp3
VEOBIBLE_SHORTS_TTS_VOICE_PROMPT_PT=/Users/fabian/Documents/veobible-shorts/material/voices/pt.mp3
```

Cada muestra debe contener idealmente **5–10 segundos de voz clara**, sin música ni ruido de fondo, en el idioma correspondiente. Se aceptan WAV o MP3. Para rutas dedicadas personalizadas, usa `VEOBIBLE_SHORTS_TTS_VOICE_PROMPT_ES_INTRO` y `_ES_OUTRO` (o sus equivalentes para EN/PT). Si una variable por idioma está ausente, se usa `VEOBIBLE_SHORTS_TTS_VOICE_PROMPT` si existe; de lo contrario, se busca el archivo general predeterminado. Una variable dedicada definida como vacía usa la voz predeterminada del modelo para esa pista; una variable general vacía desactiva solo el respaldo. La CLI comprueba que las rutas seleccionadas existan antes de sintetizar.

Chatterbox multilingüe admite portugués con `language_id="pt"`. Resemble AI también publica modelos dedicados para [portugués de Brasil](https://huggingface.co/ResembleAI/Chatterbox-Multilingual-pt-br) y [portugués de Portugal](https://huggingface.co/ResembleAI/Chatterbox-Multilingual-pt-pt). Esta integración usa actualmente el modelo multilingüe para portugués; si no encuentra una muestra dedicada, aplica `pt.mp3` como respaldo. Para español latinoamericano, puedes definir `VEOBIBLE_SHORTS_TTS_MODEL_ES=latam` sin cambiar el modelo de inglés ni el de portugués.

### ElevenLabs

Para usar la API, define `VEOBIBLE_SHORTS_TTS_PROVIDER=elevenlabs`, `VEOBIBLE_SHORTS_ELEVENLABS_API_KEY` y los IDs `VEOBIBLE_SHORTS_ELEVENLABS_VOICE_ES`, `_EN` y `_PT` en `.env`. Solo es obligatorio el ID del idioma que vas a generar. El modelo predeterminado es `eleven_multilingual_v2`; puedes cambiarlo con `VEOBIBLE_SHORTS_ELEVENLABS_MODEL`. Busca los IDs de voz en tu [biblioteca de voces de ElevenLabs](https://elevenlabs.io/app/voice-library). Cada intro y outro hace una petición a la API. La respuesta MP3 se convierte con `ffmpeg` a WAV PCM de 24 bits a 48 kHz. No necesitas instalar Chatterbox para esta opción.

Al cambiar de proveedor, usa **Reprocess complete video** y responde **No** a la reutilización de audios para montar la salida con las nuevas locuciones.
