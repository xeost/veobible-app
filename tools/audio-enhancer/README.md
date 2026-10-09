# Audio Enhancer

CLI para dar más cuerpo a voces de audiobiblias antiguas ya procesadas con Adobe Podcast. Usa **Python 3.10+ y FFmpeg**, con ecualización y filtros tradicionales. No usa IA, modelos, servicios externos ni paquetes de Python adicionales. Compatible con macOS y Linux (bloqueo de archivos con `fcntl`).

Los originales se abren únicamente para lectura. La salida conserva la estructura de carpetas, los nombres de capítulo, el número de canales y la frecuencia de muestreo. Por defecto, la percepción de una voz más grave se obtiene reforzando su cuerpo y reduciendo el brillo excesivo, sin cambiar el pitch ni la velocidad. Opcionalmente, `--pitch-semitones` baja el tono mediante procesamiento clásico y compensa la velocidad.

## Preparación

FFmpeg y ffprobe deben estar disponibles en `PATH`:

```bash
brew install ffmpeg
```

El archivo local `tools/audio-enhancer/.env` ya está configurado con:

```dotenv
AUDIO_ENHANCE_INPUT_DIR=/Users/fabian/Documents/audiobibles/sources/audios
AUDIO_ENHANCE_OUTPUT_DIR=/Users/fabian/Documents/audiobibles/sources/enhanced-audios
```

`.env` está excluido de Git. En otra máquina, copia `.env.example` a `.env`. Las variables exportadas en el entorno prevalecen sobre el archivo; los paths deben ser absolutos. También puedes usar `--env-file /ruta/config.env` **antes del subcomando**. No se expanden expresiones de shell dentro del archivo.

## Uso desde la raíz del repositorio

```bash
# Ver las versiones disponibles y los perfiles.
python3 tools/audio-enhancer/cli.py versions
python3 tools/audio-enhancer/cli.py presets

# Comparar 30 segundos de un capítulo, desde el segundo 10.
python3 tools/audio-enhancer/cli.py preview rv1909 --file 01-genesis-1.mp3

# Ver qué se procesaría sin escribir archivos.
python3 tools/audio-enhancer/cli.py enhance rv1909 --dry-run

# Procesar una versión completa con el perfil cálido.
python3 tools/audio-enhancer/cli.py enhance rv1909 --preset warm

# Seleccionar un libro o limitar la cantidad de capítulos.
python3 tools/audio-enhancer/cli.py enhance rv1909 --pattern '01-genesis-*.mp3'
python3 tools/audio-enhancer/cli.py enhance kjv --limit 3

# Reducir la intensidad si la voz queda demasiado oscura.
python3 tools/audio-enhancer/cli.py enhance rv1909 --preset warm --strength 0.7

# Guardar un master sin pérdidas adicionales.
python3 tools/audio-enhancer/cli.py enhance rv1909 --format flac
```

También puedes usar `pnpm audio:enhance <subcomando> ...`. Consulta todas las opciones con `enhance --help` y `preview --help`.

Cada versión es una subcarpeta de la entrada (`rv1909`, `kjv`, `arc`, etc.). Se descubren audios MP3, M4A, AAC, WAV, FLAC, OGG, Opus y AIFF, incluyendo subcarpetas. Los capítulos se ordenan numéricamente. La selección por `--pattern` se aplica a sus rutas relativas. Si dos formatos del mismo capítulo producirían el mismo nombre de salida, la CLI solicita seleccionar una extensión.

## Escuchar antes de procesar todo

`preview` genera el original normalizado y los cinco perfiles:

```text
enhanced-audios/rv1909/_previews/01-genesis-1/
  original.wav
  gentle.wav
  warm.wav
  deep.wav
  full.wav
  dark.wav
  *.wav.json
```

`original.wav` es el fragmento sin EQ ni cambio de pitch, **normalizado al mismo objetivo de volumen** que los perfiles, para facilitar una comparación sin favorecer al más fuerte. Todos usan WAV de 24 bits por defecto. Puedes elegir el tramo y su duración:

```bash
python3 tools/audio-enhancer/cli.py preview rv1909 \
  --file 01-genesis-1.mp3 --start 40 --seconds 45
```

Escucha el cuerpo de las vocales, la claridad de las consonantes y las pausas. `warm` es conservador; si el cambio resulta demasiado sutil, prueba `full`. `dark` es una corrección intensa y puede apagar las consonantes o amplificar resonancias. Conviene revisar capítulos de distintos libros si cambia el narrador o la calidad de grabación.

`--presets` permite seleccionar los perfiles y `--label` guarda la comparación en una subcarpeta distinta, sin reemplazar las anteriores:

```bash
# Cambio intenso mediante EQ, sin modificar el tono fundamental.
pnpm audio:enhance preview rv1909 --file 01-genesis-1.mp3 \
  --start 20 --seconds 30 --presets warm full dark --label intense-eq

# Voz realmente más grave: un semitono abajo, con la velocidad compensada.
pnpm audio:enhance preview rv1909 --file 01-genesis-1.mp3 \
  --start 20 --seconds 30 --presets full --pitch-semitones -1 --label lower-voice

# Aplicar el ajuste elegido a una versión.
pnpm audio:enhance enhance rv1909 --preset full --pitch-semitones -1
```

Para reemplazar una comparación existente con otros parámetros, usa `--force`. Los perfiles más fuertes siguen siendo procesamiento tradicional, sin IA. Más intensidad no garantiza mejor calidad: usa el perfil menos intenso que consiga el resultado deseado.

## Procesamiento de audio

Cadena de filtros:

1. Procesamiento en coma flotante de doble precisión para mantener margen durante la EQ.
2. Filtro pasa altos a **55 Hz**, dos polos, para retirar retumbos muy bajos.
3. Shelf de graves a **120 Hz** y refuerzo ancho a **190 Hz**, para cuerpo y calidez.
4. Reducción moderada a **400 Hz**, para evitar una voz encerrada o turbia.
5. Reducción ancha a **3.2 kHz**, para suavizar la aspereza.
6. Shelf de agudos a **6 kHz**, para reducir el brillo metálico.
7. Normalización EBU R128 en **dos pasadas**, midiendo después de la EQ.

| Perfil | Graves 120 Hz | Cuerpo 190 Hz | Caja 400 Hz | Aspereza 3.2 kHz | Agudos 6 kHz |
| --- | ---: | ---: | ---: | ---: | ---: |
| `gentle` | +1.5 dB | +0.8 dB | −0.5 dB | −1.5 dB | −1.5 dB |
| `warm` (default) | +2.5 dB | +1.5 dB | −1.0 dB | −2.5 dB | −3.0 dB |
| `deep` | +3.5 dB | +2.0 dB | −1.5 dB | −3.5 dB | −4.5 dB |
| `full` | +6.0 dB | +4.0 dB | −1.5 dB | −5.0 dB | −6.0 dB |
| `dark` | +8.0 dB | +5.5 dB | −2.0 dB | −7.0 dB | −9.0 dB |

`--strength` multiplica las ganancias: `0.7` es más sutil; `1.3` más marcado; `0` desactiva la EQ. Rango permitido: 0 a 2. Los valores y las frecuencias están definidos en `PRESETS` y `eq_chain()` de `cli.py`, por si necesitas ajustar una grabación concreta.

`--pitch-semitones` es independiente de la EQ y admite de `-3` a `0`, con `0` como valor predeterminado. Un valor de `-1` baja las frecuencias aproximadamente un 5.6 %. La cadena `asetrate` → `aresample` → `atempo` baja el pitch y los formantes (las resonancias que dan carácter a la voz), compensando la velocidad. No usa IA ni requiere dependencias adicionales. La compensación temporal puede introducir pequeñas diferencias de duración (la CLI admite hasta 250 ms) y artefactos; este método no preserva los formantes. Comienza con `-0.5` o `-1` y escucha el resultado antes de procesar toda una versión. La referencia `original` nunca recibe este cambio.

El objetivo predeterminado es **−18 LUFS**, con techo **−2 dBTP** y rango dinámico objetivo **11 LU**. Se solicita normalización lineal para conservar la dinámica cuando es viable; FFmpeg puede pasar a modo dinámico si el rango o los picos no permiten alcanzar el objetivo. El informe registra el modo utilizado. Las opciones `--lufs`, `--true-peak` y `--lra` permiten cambiar esos valores. La medición corresponde a los canales almacenados (sin compensación dual mono).

No se añade compresión de voz ni reducción de ruido adicional: estas fuentes ya pasaron por Enhance Speech. La normalización dinámica, si FFmpeg la necesita, sí puede reducir la dinámica. La EQ no reconstruye graves ausentes ni convierte una voz naturalmente aguda en una voz de otro registro. Un exceso de refuerzo puede aumentar ruido o quitar inteligibilidad.

Documentación técnica: [filtros de EQ y normalización de FFmpeg](https://ffmpeg.org/ffmpeg-filters.html#Audio-Filters), [cambio de tasa y pitch](https://www.ffmpeg.org/ffmpeg-filters.html#asetrate) y [compensación de tempo](https://www.ffmpeg.org/ffmpeg-filters.html#atempo).

## Formatos y resultados

`enhance` produce **MP3 a 192 kbps** por defecto, con una única recodificación desde el original. Puedes usar `--bitrate 256k` o `320k`. `--format flac` y `--format wav` generan audio de 24 bits sin pérdidas adicionales; no recuperan la información perdida en el MP3 de entrada. Requiere fuentes mono o estéreo de al menos 16 kHz.

```text
enhanced-audios/rv1909/
  01-genesis-1.mp3
  01-genesis-1.mp3.json
  ...
```

El JSON de cada audio incluye la identidad del original, los parámetros, la cadena exacta de filtros, las mediciones de volumen, la duración, los canales, la frecuencia de muestreo y la versión de FFmpeg. Las mediciones de la segunda pasada son **anteriores a la codificación**; un MP3 puede presentar pequeños cambios en volumen y picos al codificarse. El margen predeterminado de −2 dBTP reduce este riesgo. Para un techo de entrega estricto, mide también el archivo final o utiliza FLAC/WAV.

Se omiten salidas completas cuando coinciden el original (ruta, tamaño y fecha de modificación), los parámetros y el archivo de salida (tamaño y fecha). Esta identidad es un mecanismo de reanudación, no una verificación criptográfica del contenido. Si existe una salida distinta, alterada o sin informe, se informa un error y se conserva hasta usar `--force`. Esta opción reemplaza únicamente las salidas seleccionadas; vuelve a leer el original.

El audio se renderiza en un archivo temporal dentro de la salida y se publica mediante reemplazo atómico después de validar duración, canales y frecuencia. Una interrupción elimina el temporal del capítulo activo; lo ya completado puede reanudarse. El archivo `.enhance.lock` evita dos ejecuciones simultáneas sobre la misma versión. No borres ese archivo mientras la herramienta esté ejecutándose.

Entrada y salida deben ser rutas separadas sin solapamientos. La CLI valida rutas relativas y rechaza audios enlazados y salidas que escapen de la carpeta configurada. `--dry-run` valida la selección y las dependencias sin crear carpetas, bloqueos ni informes. Los errores de un capítulo permiten continuar con los restantes; el código de salida será `1` si hubo errores, `0` si terminó correctamente y `130` si se interrumpió con Ctrl+C.

## Verificación

```bash
python3 -m unittest discover -s tools/audio-enhancer -p 'test_*.py' -v
```

Las pruebas incluyen archivos sintéticos procesados con FFmpeg, normalización, duración, canales, efecto espectral de la EQ, protección de originales, reanudación y validación de rutas. Las pruebas de integración se omiten si no están instalados FFmpeg y ffprobe.
