# VeoBible Shorts CLI

Asistente interactivo para reunir material de versículos populares para shorts. Selecciona idioma, versión y rango. Cada preparación crea una carpeta con los audios bíblicos, las locuciones de intro y outro, `versiculos.txt` y `metadata.txt`. Se puede marcar el rango como utilizado después de prepararlo.

## Instalación y ejecución

Requiere Node.js 18+, pnpm, `ffmpeg` y `ffprobe` (incluidos en FFmpeg) disponibles en `PATH`.

```bash
cd tools/veobible-shorts
pnpm install
cp .env.example .env
pnpm start
```

También se puede iniciar desde la raíz con `pnpm shorts`.

Al iniciar la CLI en una terminal interactiva, la interfaz comienza en la parte superior de la pantalla. El contenido que estaba visible antes queda disponible al desplazarse hacia arriba en el historial de la terminal.

## Configuración

Copia `.env.example` a `.env` dentro de `tools/veobible-shorts` y ajusta las rutas. La herramienta carga ese archivo aunque la ejecutes desde la raíz del repositorio. También puedes cambiar los valores predeterminados en `src/config.ts`. Las variables exportadas en el entorno del proceso tienen prioridad sobre `.env`; si falta una variable, se usa el valor predeterminado de `config.ts`.

| Variable | Valor predeterminado |
| --- | --- |
| `VEOBIBLE_SHORTS_WORKING_DIR` | `/Users/fabian/Documents/veobible-shorts` |
| `VEOBIBLE_SHORTS_OUTPUT_DIR` | `<workingDir>/outputs` |
| `VEOBIBLE_SHORTS_AUDIO_DIR` | `/Users/fabian/Documents/audiobibles/sources/audios` |
| `VEOBIBLE_SHORTS_BIBLE_DATA_DIR` | `<raíz del repositorio>/frontend/public/bible-data` |
| `VEOBIBLE_SHORTS_TTS_PYTHON` | `/Users/fabian/Documents/CodeTrying/kokoro/chatterbox/.venv/bin/python` |
| `VEOBIBLE_SHORTS_TTS_MODEL` | `multilingual` (`latam` solo para español) |
| `VEOBIBLE_SHORTS_TTS_MODEL_ES`, `_EN`, `_PT` | Modelo del idioma; si falta, usa `VEOBIBLE_SHORTS_TTS_MODEL` |
| `VEOBIBLE_SHORTS_TTS_DEVICE` | `auto` |
| `VEOBIBLE_SHORTS_TTS_VOICE_PROMPT_ES` | `<workingDir>/voices/es.mp3` |
| `VEOBIBLE_SHORTS_TTS_VOICE_PROMPT_EN` | `<workingDir>/voices/en.mp3` |
| `VEOBIBLE_SHORTS_TTS_VOICE_PROMPT_PT` | `<workingDir>/voices/pt.mp3` |
| `VEOBIBLE_SHORTS_TTS_VOICE_PROMPT` | Vacío; muestra compartida que sustituye los valores predeterminados cuando no hay ruta por idioma |
| `VEOBIBLE_SHORTS_TTS_TEMPLATES` | `tools/veobible-shorts/voice-templates.json` |

`VEOBIBLE_SHORTS_OUTPUT_DIR` es opcional: si lo omites, se usa `outputs` dentro de `VEOBIBLE_SHORTS_WORKING_DIR`. El archivo `.env` queda excluido de Git; `.env.example` sirve como plantilla.

El catálogo común a todos los idiomas está en `popular-verses.json`. Cada entrada necesita un `id` único, el `book` en inglés tal como aparece en los índices bíblicos, y puntos `start` y `end` con `chapter` y `verse`. Los rangos pueden cruzar capítulos dentro de un mismo libro. La herramienta valida los límites según la versión elegida.

Al configurar un rango, procura que el texto de los versículos seleccionados abarque **entre 130 y 150 palabras**. Esa extensión apunta a una narración de alrededor de **60 segundos** para el short video. El número de palabras puede variar entre idiomas y versiones, por lo que conviene comprobarlo en cada versión que vayas a utilizar.

El catálogo incluido contiene **100 rangos de los 66 libros**, todos verificados con **130–150 palabras en Reina Valera 1909**. Consulta [la selección y los conteos por versión](popular-verses.md) para ver el tema de cada pasaje, los criterios de selección y las fuentes de interés consultadas. El orden es una propuesta editorial para shorts. La duración de 60–70 segundos depende de la velocidad de narración y las pausas; debe confirmarse con el audio final.

Los archivos se guardan en `<outputDir>/<versionId>/<id>/`. `status.json` se guarda directamente en `<outputDir>` y marca los rangos globalmente por `id`, independientemente de idioma y versión. Preparar archivos no los marca automáticamente; el asistente lo pregunta al final. Si se omite, el rango se puede marcar más tarde desde su menú.

**Alcance de audio:** los archivos fuente están divididos por capítulo, no por versículo. La herramienta copia cada capítulo completo en su formato original (`.mp3` o `.m4a`) y crea junto a él un `.wav` y un `.aiff` **PCM de 24 bits a 48 kHz** para importarlos en DaVinci Resolve. El AIFF se convierte desde el WAV PCM, sin otra compresión con pérdida. Ambos contienen el rango elegido más **hasta 5 segundos antes y 5 segundos después**, sin sobrepasar los límites del capítulo, y conservan el número de canales del original. `versiculos.txt` contiene únicamente los versículos seleccionados. En `metadata.txt` se indican los tres nombres y, para **cada WAV y AIFF**, el inicio y el fin estimados del rango dentro del audio original, los límites del recorte y los segundos correspondientes dentro del archivo. Las duraciones se obtienen con `ffprobe`; los límites del rango se estiman según la proporción de palabras de cada versículo dentro del capítulo. Como las fuentes no tienen marcas de tiempo por versículo, **comprueba esos puntos escuchando el audio antes de editar el video**.

Para una salida creada antes de incorporar los tiempos, selecciona ese mismo rango y elige **Actualizar tiempos en metadata**. La opción también permite recalcularlos si cambia un audio; conserva las copias de audio y `versiculos.txt`.

Para una salida ya preparada, selecciona el mismo rango y elige **Generar WAV y AIFF de 48 kHz**. La CLI crea o reemplaza ambos archivos recortados a partir de los originales copiados y actualiza `metadata.txt`. Ambos son audio PCM real y tienen una transición de 20 ms al comienzo y al final para evitar chasquidos causados por cortes bruscos. El AIFF ofrece otro contenedor para probar la importación en Resolve; el cambio de formato no elimina chasquidos presentes en la grabación de origen.

## Voz de intro y outro

Al preparar un rango, la CLI también genera la intro y el outro: `intro.txt`, `outro.txt`, `intro.wav`, `outro.wav`, `intro.aiff` y `outro.aiff` quedan junto a los audios bíblicos, el texto y la metadata. Si falla la síntesis, se cancela esa preparación sin dejar una salida incompleta. Para una salida ya preparada, **Generar voz de intro y outro con Chatterbox** permite actualizar las locuciones después de cambiar una plantilla o una voz.

Las plantillas de español, inglés y portugués se editan en [voice-templates.json](voice-templates.json), dentro de esta herramienta. Admiten `{reference}`, `{version}`, `{book}`, `{start}`, `{end}` y `{passage_id}`. Los valores provienen del rango y la versión elegidos; `veobible-shorts` entrega los guiones completos a [VeoBible Voice](../veobible-voice/README.md), que solo sintetiza el texto recibido.

Configura `VEOBIBLE_SHORTS_TTS_PYTHON` con el ejecutable del entorno Python que tenga instalado `chatterbox-tts`. La plantilla `.env.example` apunta al entorno del experimento local. Puedes seleccionar `latam` solo para español con `VEOBIBLE_SHORTS_TTS_MODEL_ES` o usar otro JSON de plantillas con `VEOBIBLE_SHORTS_TTS_TEMPLATES`. Los WAV y AIFF finales son PCM de 24 bits a 48 kHz.

### Muestras de voz por idioma

Las muestras actuales están fuera del repositorio, en `/Users/fabian/Documents/veobible-shorts/voices/` como `es.mp3`, `en.mp3` y `pt.mp3`. Son las rutas predeterminadas si no defines otras en `.env`. Para cambiarlas, añade las rutas absolutas a `tools/veobible-shorts/.env`:

```dotenv
VEOBIBLE_SHORTS_TTS_VOICE_PROMPT_ES=/Users/fabian/Documents/veobible-shorts/voices/es.mp3
VEOBIBLE_SHORTS_TTS_VOICE_PROMPT_EN=/Users/fabian/Documents/veobible-shorts/voices/en.mp3
VEOBIBLE_SHORTS_TTS_VOICE_PROMPT_PT=/Users/fabian/Documents/veobible-shorts/voices/pt.mp3
```

Cada muestra debe contener idealmente **5–10 segundos de voz clara**, sin música ni ruido de fondo, en el idioma correspondiente. Se aceptan WAV o MP3. La misma muestra se usa para la intro y el outro de ese idioma. Si una variable por idioma está ausente, se usa `VEOBIBLE_SHORTS_TTS_VOICE_PROMPT` si existe; de lo contrario, se usa el MP3 predeterminado de ese idioma. Una variable por idioma definida como vacía desactiva la muestra y deja la voz predeterminada del modelo. La CLI comprueba que la ruta configurada exista antes de sintetizar.

Chatterbox multilingüe admite portugués con `language_id="pt"`. Resemble AI también publica modelos dedicados para [portugués de Brasil](https://huggingface.co/ResembleAI/Chatterbox-Multilingual-pt-br) y [portugués de Portugal](https://huggingface.co/ResembleAI/Chatterbox-Multilingual-pt-pt). Esta integración usa actualmente el modelo multilingüe para portugués y aplica `pt.mp3` como muestra de voz. Para español latinoamericano, puedes definir `VEOBIBLE_SHORTS_TTS_MODEL_ES=latam` sin cambiar el modelo de inglés ni el de portugués.
