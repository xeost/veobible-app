# VeoBible Shorts CLI

Asistente interactivo para crear vídeos completos de pasajes bíblicos populares. Selecciona idioma, versión y pasaje. Cada preparación crea el vídeo, una miniatura y descripciones listas para publicar; los archivos de trabajo quedan dentro de `_internal/`. Se puede marcar el pasaje como utilizado después de generarlo.

## Archivos locales en Remotion

El renderer de Remotion prepara automáticamente los vídeos de intro, fondo y outro, los audios bíblicos y las locuciones en una carpeta pública temporal de su bundle. La composición usa `staticFile()` para obtener URLs que el navegador puede cargar, en lugar de recibir rutas absolutas del disco (`/Users/...`). No necesitas mover tus archivos ni cambiar sus rutas en `.env`.

Cada render utiliza nombres independientes, reutiliza una sola copia por archivo de audio fuente y elimina sus medios temporales al terminar o fallar. Los archivos originales se conservan. Esto evita errores HTTP 404 al cargar vídeos o audios locales, incluidos renders consecutivos durante la misma sesión. Consulta la [documentación de Remotion sobre rutas absolutas](https://www.remotion.dev/docs/miscellaneous/absolute-paths).

El video comienza y termina sin fundirse a negro. Su primer fotograma muestra todos los elementos de la intro en su posición final; desde el segundo se ocultan y se reproduce la entrada habitual. Solo las capas de la intro reinician su animación: el audio y el fondo mantienen su tiempo original. `thumbnail.jpg` sigue capturándose después de la entrada normal. El primer fotograma sirve como portada si la plataforma lo utiliza; cada red social puede seleccionar otra imagen de vista previa.

## Rendimiento y fluidez del renderizado

Las tres etapas usan `Video` de `@remotion/media`, que decodifica el fotograma correspondiente a la línea de tiempo. El montaje conserva los FPS de `0-intro.mp4` (incluidos valores fraccionarios como `30000/1001`); el boomerang se genera con esa misma frecuencia. Si los clips fuente tienen frecuencias diferentes, se adaptan a la del montaje sin cambiar su velocidad. No se inventan fotogramas mediante interpolación.

La duración real de cada video de intro/outro se trata por separado de la duración de su locución. Si el video termina antes, se mantiene su último fotograma mientras las animaciones y el audio siguen avanzando. Si es más largo, se corta al terminar la etapa.

El render usa fotogramas JPEG intermedios y, por defecto, la mitad de las CPU disponibles con un máximo de cuatro procesos. Puedes configurar `VEOBIBLE_SHORTS_RENDER_CONCURRENCY` en `.env`: admite enteros entre `1` y el número de CPU disponibles. Aumentarlo puede empeorar el rendimiento o aumentar el consumo de memoria.

Ejecuta `pnpm benchmark` desde esta herramienta para comparar 1, 2 y 4 procesos. Usa muestras de dos segundos de tus videos reales, a su resolución original, y audio sintético; calienta el bundle antes de medir y elimina todos sus archivos temporales. No modifica tus fondos, locuciones ni publicaciones. Los tiempos incluyen preparación y codificación; los pasajes más largos pueden favorecer otra concurrencia. Remotion compone mediante un navegador y no garantiza igualar la velocidad del montaje nativo con FFmpeg. Consulta las [recomendaciones oficiales de rendimiento](https://www.remotion.dev/docs/performance).

## Instalación y ejecución

Requiere Node.js 18+, pnpm, `ffmpeg` y `ffprobe` (incluidos en FFmpeg) disponibles en `PATH`. El título de la intro se dibuja con el filtro `drawtext`: la compilación de FFmpeg debe incluir `libfreetype`, `libharfbuzz` y `libfontconfig`.

En macOS, instala [ffmpeg-full de Homebrew](https://formulae.brew.sh/formula/ffmpeg-full). Es una fórmula independiente de `ffmpeg` y no se añade automáticamente al `PATH`. La CLI detecta su ejecutable en los prefijos habituales de Homebrew, por lo que no necesitas reemplazar el FFmpeg del sistema:

```bash
brew install ffmpeg-full
"$(brew --prefix ffmpeg-full)/bin/ffmpeg" -hide_banner -filters | grep -E 'drawtext|drawbox|geq|xfade|acrossfade|silencedetect'
```

Si instalaste `ffmpeg-full` en otro prefijo, configura `VEOBIBLE_SHORTS_FFMPEG` en `.env` con la ruta completa a su ejecutable; `ffprobe` se buscará en el mismo directorio. Si prefieres usarlo también desde la terminal, añade `export PATH="$(brew --prefix ffmpeg-full)/bin:$PATH"` a tu configuración de shell (por ejemplo, `~/.zshrc`). La CLI informa qué filtros faltan antes de renderizar.

Filtros usados por el montaje:

| Función | Filtros |
| --- | --- |
| Título y composición | `drawtext`, `drawbox`, `geq`, `vignette`, `color`, `fade`, `overlay`, `format`, `fps`, `scale`, `crop` |
| Boomerang y duración | `split`, `reverse`, `concat`, `trim`, `tpad`, `setpts`, `settb` |
| Audio y transiciones | `atrim`, `asetpts`, `aresample`, `aformat`, `anull`, `adelay`, `apad`, `amix`, `volume`, `alimiter`, `acrossfade`, `xfade` |
| Ajuste del corte | `silencedetect` |

```bash
cd tools/shorts-daily-dose
pnpm install
cp .env.example .env
pnpm start
```

También se puede iniciar desde la raíz con `pnpm shorts`.

Los menús muestran una lista de opciones con orden y numeración fijos. Selecciona con **↑/↓** o escribiendo el número, y pulsa **Enter** para elegir. El cursor es cíclico: ↑ desde la primera opción selecciona la última, y ↓ desde la última selecciona la primera, manteniendo el orden fijo de la lista. En listas largas se desplaza la ventana visible para mantener el banner en pantalla. Cada vez que se abre un menú, aparece en la parte superior de la terminal con el banner de VeoBible encima. Pulsa **Backspace** para volver a mostrar el menú actual desde arriba. El contenido anterior queda disponible al desplazarse por el historial de la terminal.

## Configuración

Copia `.env.example` a `.env` dentro de `tools/shorts-daily-dose` y ajusta las rutas. La herramienta carga ese archivo aunque la ejecutes desde la raíz del repositorio. También puedes cambiar los valores predeterminados en `src/config.ts`. Las variables exportadas en el entorno del proceso tienen prioridad sobre `.env`; si falta una variable, se usa el valor predeterminado de `config.ts`.

| Variable | Valor predeterminado |
| --- | --- |
| `VEOBIBLE_SHORTS_WORKING_DIR` | `/Users/fabian/Documents/veobible-shorts` |
| `VEOBIBLE_SHORTS_OUTPUT_DIR` | `<workingDir>/outputs` |
| `VEOBIBLE_SHORTS_VIDEOS_DIR` | `<workingDir>/material/videos` |
| `VEOBIBLE_SHORTS_FFMPEG` | `ffmpeg-full` de Homebrew en macOS si está instalado; en otro caso, `ffmpeg` del `PATH` |
| `VEOBIBLE_SHORTS_CLIP_AUDIO_MODE` | `voice`; también admite `mix` y `video` |
| `VEOBIBLE_SHORTS_AUDIO_DIR` | `/Users/fabian/Documents/audiobibles/sources/audios` |
| `VEOBIBLE_SHORTS_BIBLE_DATA_DIR` | `<raíz del repositorio>/frontend/public/bible-data` |
| `VEOBIBLE_SHORTS_TTS_PROVIDER` | `chatterbox`; también admite `elevenlabs` |
| `VEOBIBLE_SHORTS_ELEVENLABS_API_KEY` | Vacío; obligatorio para ElevenLabs |
| `VEOBIBLE_SHORTS_ELEVENLABS_MODEL` | `eleven_multilingual_v2` |
| `VEOBIBLE_SHORTS_ELEVENLABS_VOICE_ES`, `_EN`, `_PT` | Vacío; ID de voz obligatorio para el idioma seleccionado con ElevenLabs |
| `VEOBIBLE_SHORTS_TTS_PYTHON` | `<raíz del repositorio>/tools/voice-generator/.venv/bin/python` |
| `VEOBIBLE_SHORTS_TTS_MODEL` | `multilingual` (`latam` solo para español) |
| `VEOBIBLE_SHORTS_TTS_MODEL_ES`, `_EN`, `_PT` | Modelo del idioma; si falta, usa `VEOBIBLE_SHORTS_TTS_MODEL` |
| `VEOBIBLE_SHORTS_TTS_DEVICE` | `auto` |
| `VEOBIBLE_SHORTS_TTS_VOICE_PROMPT_ES` | `<workingDir>/material/voices/es.mp3` |
| `VEOBIBLE_SHORTS_TTS_VOICE_PROMPT_EN` | `<workingDir>/material/voices/en.mp3` |
| `VEOBIBLE_SHORTS_TTS_VOICE_PROMPT_PT` | `<workingDir>/material/voices/pt.mp3` |
| `VEOBIBLE_SHORTS_TTS_VOICE_PROMPT_ES_INTRO`, `_ES_OUTRO` (y equivalentes `_EN_*`, `_PT_*`) | Rutas opcionales para cada pista; si faltan, busca `<workingDir>/material/voices/<idioma>-<pista>.mp3` o `.wav` |
| `VEOBIBLE_SHORTS_TTS_VOICE_PROMPT` | Vacío; muestra compartida que sustituye los valores predeterminados cuando no hay ruta por idioma |
| `VEOBIBLE_SHORTS_TTS_TEMPLATES` | `tools/shorts-daily-dose/voice-templates.json` |

`VEOBIBLE_SHORTS_OUTPUT_DIR` es opcional: si lo omites, se usa `outputs` dentro de `VEOBIBLE_SHORTS_WORKING_DIR`. El archivo `.env` queda excluido de Git; `.env.example` sirve como plantilla.

El catálogo común a todos los idiomas está en `popular-verses.json`. Cada entrada necesita un `id` único, el `book` en inglés tal como aparece en los índices bíblicos, y puntos `start` y `end` con `chapter` y `verse`. Los pasajes pueden cruzar capítulos dentro de un mismo libro. La herramienta valida los límites según la versión elegida.

Al configurar un pasaje, procura que el texto de los versículos seleccionados abarque **entre 130 y 150 palabras**. Esa extensión apunta a una narración de alrededor de **60 segundos** para el short video. El número de palabras puede variar entre idiomas y versiones, por lo que conviene comprobarlo en cada versión que vayas a utilizar.

El catálogo incluido contiene **100 pasajes de los 66 libros**, todos verificados con **130–150 palabras en Reina Valera 1909**. Consulta [la selección y los conteos por versión](popular-verses.md) para ver el tema de cada pasaje, los criterios de selección y las fuentes de interés consultadas. El orden es una propuesta editorial para shorts. La duración de 60–70 segundos depende de la velocidad de narración y las pausas; debe confirmarse con el audio final.

Los archivos se guardan en `<outputDir>/<versionId>/<id>/`. `status.json` se guarda directamente en `<outputDir>` y registra cada pasaje por **idioma, versión y pasaje**, con claves como `es/rv1909/john-3-14-19`. Marcarlo en una versión no lo marca en otras versiones ni idiomas. En la lista, los pasajes usados de la versión e idioma seleccionados aparecen al final con la marca **✓ Used**. Crear el vídeo no lo marca automáticamente; el asistente lo pregunta al final. Si se omite, el pasaje se puede marcar más tarde desde su menú.

Los registros del formato anterior se interpretan usando el idioma y la versión que ya guardaban en sus campos `locale` y `version`. Al marcar otro pasaje, el archivo se guarda con las nuevas claves, conservando las fechas y rutas existentes. La CLI no atribuye esas marcas antiguas a versiones o idiomas diferentes.

## Ajuste interactivo de audio y texto

En el menú de cada pasaje, **Adjust audio and verse timings** aparece antes de **Create complete video** o **Reprocess complete video**. Funciona también antes de generar el primer vídeo; no ejecuta Chatterbox ni renderiza el vídeo para escuchar los ajustes.

Todos los menús recuerdan la última opción utilizada durante la sesión, incluidos los del editor de tiempos. Al volver a un menú, esa opción aparece seleccionada si sigue disponible: pulsa **Enter** para repetirla o cambia la selección con las flechas o un número. La memoria es independiente por menú y contexto (idioma, versión y pasaje) y se reinicia al cerrar la CLI. Elegir **Back** también borra la selección recordada de ese menú: al volver queda activa la primera opción, incluidos los menús del editor de tiempos. Marcar un pasaje como usado es otra excepción: se olvida la selección de la lista de pasajes de esa versión para que, al volver, quede activo el primero de la lista reordenada.

1. **Audio cut**: escucha el pasaje completo, sus primeros cinco segundos o sus últimos cinco segundos. Al escuchar el comienzo se mantiene visible la referencia y el texto del primer versículo; al escuchar el final, los del último versículo. Escribe offsets decimales mediante **Set start offset…** y **Set end offset…** para ajustar el inicio y el final. Repite la escucha hasta que el corte contenga exactamente la lectura deseada.
2. **Verse text**: elige un versículo y escucha su audio con un segundo de contexto a cada lado, o reproduce todo el pasaje con el texto mostrado en la terminal. Ajusta su aparición y desaparición. Mover el final de un versículo mueve también el inicio del siguiente; mover su inicio mueve también el final del anterior. El primero y el último tienen un solo vecino. La vista previa muestra los intervalos de texto; las animaciones de entrada y salida se aplican al renderizar el vídeo.

En **Play complete passage** puedes ajustar el corte de audio sin volver al menú:

- **S** selecciona el inicio; **F** selecciona el final (selección inicial). La pantalla indica el extremo activo y ambos offsets.
- **A/D** suma/resta cinco segundos al offset del extremo activo. En el inicio, sumar recorta audio y restar incluye audio anterior; en el final, sumar extiende y restar recorta.
- **E** fija el extremo activo en el punto actual de escucha y calcula su offset respecto de la estimación original.
- **B** retrocede cinco segundos desde el punto actual; **L** reproduce los últimos cinco segundos del corte actualizado; **R** reproduce el corte desde su inicio.

Al ajustar el inicio, la reproducción vuelve al nuevo inicio para comprobarlo. Al ajustar el final, el fragmento se actualiza y puedes revisarlo con **L** o **R**. Se mantiene disponible el audio fuente fuera del corte original, incluso en pasajes de varios capítulos; no se permite salir de la fuente ni dejar cortes vacíos. Los textos **PASSAGE/CONTEXT** y su desplazamiento siguen disponibles. La interfaz permanece abierta al terminar el audio, y los cambios se conservan en memoria al volver al menú; se guardan al renderizar el video con esos ajustes.

En **Play selected verse with context** la interfaz muestra el porcentaje reproducido del fragmento, la posición dentro del pasaje, el final del versículo y su offset. Permanece abierta al terminar el audio para poder continuar ajustando:

- **A**: suma cinco segundos al offset final, igual que **Set end offset…**. Amplía la escucha hasta ese nuevo final más un segundo de contexto, dentro del audio del pasaje.
- **D**: resta cinco segundos al offset final y reajusta el fragmento al nuevo final más un segundo de contexto. Se rechaza el cambio si deja duraciones inválidas o límites fuera del pasaje.
- **B**: retrocede cinco segundos desde el punto actual y vuelve a reproducir desde allí, sin salir del fragmento.
- **L**: reproduce los últimos cinco segundos del fragmento completo, usando su final actualizado (o todo el fragmento si dura menos de cinco segundos).
- **N**: selecciona el siguiente versículo y comienza a reproducirlo con un segundo de contexto a cada lado, sin salir de la interfaz. Usa los límites y offsets actualizados, conserva los ajustes anteriores y deja seleccionado ese versículo al volver al menú. En el último versículo muestra un aviso y permanece allí.
- **E**: establece el final del versículo en el punto actual y calcula su offset respecto de la estimación original. También actualiza el inicio del siguiente versículo. El fragmento se reajusta al nuevo final más un segundo de contexto; el texto mostrado cambia en vivo según los límites corregidos, para comprobarlo con **L** o **R**.
- **R**: vuelve a reproducir el fragmento entero; **Space** pausa/reanuda; **Enter/Esc** vuelve al menú.

Las mismas validaciones de **Set end offset…** impiden solapamientos, duraciones negativas o salir del pasaje: un ajuste rechazado se indica en pantalla. Los cambios quedan en memoria; elige **Use these timings — keep in memory** y crea o reprocesa el video para guardarlos en el JSON. La posición de escucha se estima con el reloj del reproductor, como en las otras previsualizaciones; puede haber pequeñas diferencias por la latencia del dispositivo de audio.

3. **Use these timings — keep in memory**: vuelve al menú del pasaje y crea o reprocesa el vídeo. Solo entonces se guardan los offsets en los JSON de `_internal/`.

En el vídeo, el 100 % de la transición entre versículos ocurre antes del límite configurado, dentro del tiempo del versículo saliente. Primero se retira suavemente el texto anterior y después entra suavemente el siguiente, sin solapar los textos. Todas las líneas del nuevo versículo ya están completamente visibles cuando comienza su audio. La entrada conserva su duración natural, sin comprimirla al 10 %. La transición se acorta para versículos breves. Los offsets siguen indicando los límites del audio; no hace falta compensar las animaciones manualmente.

Los JSON existentes se cargan al iniciar el editor, incluidos los nombres de formatos anteriores. Si ya ajustaste ese pasaje durante la sesión, se usan primero sus valores en memoria. Puedes volver al corte del audio desde el ajuste de versículos; sus tiempos automáticos se recalculan para el nuevo corte. Si los offsets anteriores dejan de ser válidos, el editor permite volver al corte o elegir las estimaciones automáticas. Los ajustes descartados no modifican archivos ni la sesión guardada. **Cerrar la CLI antes de generar el vídeo pierde los cambios que solo estaban en memoria.**

Durante la reproducción: **Enter/Esc** detiene, **R** repite y **Space** pausa o continúa. **Backspace** vuelve al menú desde la parte superior; **Ctrl+C** sale. Todas las previsualizaciones usan `mpv` con su pausa nativa, sin suspender el proceso con señales. El volumen baja y sube brevemente al pausar/reanudar (aproximadamente 80 ms para pausar) para evitar cortes bruscos, y el contador usa la posición informada por el reproductor. La latencia del dispositivo de audio puede añadir demora, especialmente con Bluetooth.

En macOS instala el reproductor con `brew install mpv`; se detecta la instalación de Homebrew automáticamente. En Linux/Windows instala `mpv` y añádelo al PATH. Puedes indicar otra ruta con `VEOBIBLE_SHORTS_MPV` en `.env`. Se necesita una terminal interactiva. Los WAV de previsualización son temporales y se eliminan al salir del editor. Se escucha el volumen configurado para la lectura; si está silenciada con `volumeMultiplier: 0`, la previsualización usa el volumen original para poder ajustar los tiempos. El cambio de reproductor afecta a la escucha en la CLI, no a los audios ni al video final.

## Archivos de salida para publicación

La carpeta de cada pasaje queda organizada así:

```text
john-3-14-19/
├── short.mp4
├── thumbnail.jpg
├── youtube.txt
├── x.txt
├── instagram.txt
├── tiktok.txt
└── _internal/
    ├── 0-metadata.txt
    ├── 1-intro.txt
    ├── 1-intro.wav
    ├── 2-passage-audio-offsets.json
    ├── 2-passage-audio-settings.json
    ├── 2-verse-text-offsets.json
    ├── 2-versiculos.txt
    ├── 3-outro.txt
    ├── 3-outro.wav
    └── README.md
```

Las locuciones WAV y sus guiones se generan en los modos `voice` y `mix`. `thumbnail.jpg` conserva la resolución del vídeo y captura el primer fotograma posterior al final de todas las animaciones de entrada de la intro. Su segundo exacto queda registrado en `_internal/0-metadata.txt`.

Los cuatro TXT de la raíz contienen descripciones en el idioma seleccionado, con la referencia, la versión, una invitación adaptada a cada red, el sitio web y hashtags bíblicos, del libro y de los temas identificados en el texto del pasaje. YouTube incluye `#Shorts` e Instagram `#Reels`. `x.txt` incluye además **todos los versículos del pasaje**, sin truncarlos; para pasajes largos puede requerir una publicación larga en X. Puedes editar los textos antes de publicarlos; se generan de nuevo al reprocesar.

`_internal/README.md` explica cada archivo y cómo ajustar los offsets del audio del pasaje y los tiempos del texto de cada versículo, con ejemplos decimales.

Los prefijos agrupan los archivos: `0-` para información general, `1-` para la intro, `2-` para la lectura y `3-` para la outro.

Al reprocesar una salida antigua, la CLI lee los offsets y las voces desde los nombres anteriores en `_internal/`, `internal/` o la raíz y los guarda con sus nuevos prefijos en `_internal/`, conservando los ajustes manuales y las voces si eliges reutilizarlas. Edita los offsets dentro de `_internal/` a partir de ese momento.

## Montaje del vídeo

Coloca en `<workingDir>/material/videos/` los clips `0-intro.mp4`, `0-outro.mp4` y uno o más fondos llamados `bg-0.mp4`, `bg-1.mp4`, etc. Si usas otra carpeta, configúrala con `VEOBIBLE_SHORTS_VIDEOS_DIR`. La CLI elige un fondo al azar, crea una secuencia que lo reproduce hacia adelante y en reversa, y la repite durante la lectura. `ffmpeg` monta intro, lectura y outro en `short.mp4` con un fundido cruzado de imagen y audio de 0,5 segundos en cada unión. El audio del fondo elegido no se utiliza.

Las tres etapas comparten una composición editorial alineada a la izquierda y márgenes amplios para las interfaces de vídeos cortos. La intro y la outro usan marfil y oro suave; la lectura invierte el contraste con un fondo claro y tinta oscura. Un sombreado transparente y gradual aporta contraste sin encerrar el contenido en un recuadro. La intro destaca «dosis diaria» (o su equivalente en inglés y portugués) en cursiva de gran tamaño; debajo aparecen la referencia del pasaje y la versión. La lectura compone el versículo en líneas equilibradas y adapta el tamaño a su longitud. La outro presenta el título, el canal, las cuentas sociales en filas y el sitio web. Se usan Georgia y Avenir; `fontconfig` elige alternativas cuando no están disponibles.

En la lectura, el sombreado adapta automáticamente su paleta al fondo elegido: FFmpeg toma ocho muestras repartidas por el clip y agrupa sus colores en cuatro tonos representativos. Se aclaran hasta obtener tonos de papel teñido que mantienen el contraste del texto oscuro y se mezclan en campos elípticos con degradados no lineales que se desplazan lentamente. La superficie clara cubre todo el vídeo: tiene un 60 % de opacidad detrás del texto y de la marca «V E O B I B L E . C O M» en semibold, y se degrada suavemente hasta un 12 % en los bordes superior e inferior. El filtro `geq`, incluido en `ffmpeg-full`, genera esta animación; no requiere archivos gráficos adicionales ni configuración manual.

Las animaciones se generan con FFmpeg: los textos entran por líneas con desaceleración suave, los trazos dorados se dibujan desde la izquierda y las salidas combinan desplazamiento breve con desvanecimiento. Las fases se adaptan a la duración disponible y a los tiempos de cada versículo. El diseño solo afecta a las capas superpuestas; conserva los clips de fondo, las voces, los cortes y las duraciones del montaje.

Los audios bíblicos originales siguen divididos por capítulo. La CLI estima el inicio y el final del pasaje según la proporción de palabras de cada versículo y usa `ffmpeg` para ajustar cada límite a una pausa cercana cuando la detecta. Después concatena los fragmentos necesarios si el pasaje cruza capítulos. El segmento de lectura tiene un segundo de silencio antes y después del audio bíblico; 0,5 segundos de cada margen se solapan con el fundido correspondiente. Las pausas no identifican por sí solas los versículos, así que **comprueba el inicio y el final escuchando el vídeo generado**. `_internal/0-metadata.txt` guarda los límites antes y después de los ajustes y el nombre del fondo seleccionado.

Durante la lectura, el vídeo presenta cada versículo por separado: primero aparece su referencia pequeña (por ejemplo, `Juan 3:14`) y después el texto grande. Ambos entran y salen suavemente antes de pasar al siguiente. La CLI reparte la duración del audio según las palabras y letras de los versículos y acerca los límites a pausas detectadas por FFmpeg cuando hay una próxima. Este cálculo es una estimación acústica: FFmpeg no reconoce las palabras pronunciadas, por lo que conviene revisar la sincronización escuchando `short.mp4`.

Cada salida incluye un `_internal/2-passage-audio-offsets.json` editable, inicialmente con `{"startSeconds": 0, "endSeconds": 0}`. Tras escuchar `short.mp4`, cambia `startSeconds` para mover el inicio de la lectura y `endSeconds` para mover su final; un número positivo mueve el límite más adelante en el audio fuente y uno negativo lo mueve hacia atrás. Los valores están en segundos y se suman a los límites automáticos indicados en `_internal/0-metadata.txt`. En **Reprocess complete video**, la CLI conserva el archivo editado y aplica sus valores al nuevo montaje. Si el pasaje cruza capítulos, el offset inicial afecta al primer capítulo y el final al último. Los límites deben quedar dentro del audio de cada capítulo y mantener un fragmento de duración positiva.

Cada salida también incluye `_internal/2-verse-text-offsets.json`. Su lista `verses` contiene la referencia, `estimatedStartSeconds` y `estimatedEndSeconds` para cada versículo, medidos **desde el inicio del audio bíblico recortado**, sin contar el segundo de silencio inicial de la lectura. Ajusta `startOffsetSeconds` y `endOffsetSeconds` para adelantar (valor negativo) o retrasar (valor positivo) la aparición y desaparición de un versículo. Por ejemplo, si el versículo siguiente debe entrar 0,2 segundos antes, cambia su `startOffsetSeconds` a `-0.2` y el `endOffsetSeconds` del anterior a `-0.2`. Los tiempos deben ser positivos, mantener cada versículo con duración mayor que cero y evitar superposiciones. Al reprocesar, la CLI conserva los offsets editados y recalcula los tiempos estimados, incluso si cambiaste los offsets globales en `_internal/2-passage-audio-offsets.json`.

Para volver a generar un vídeo existente, elige **Reprocess complete video** y confirma el reemplazo. Si la salida anterior contiene `1-intro.wav`, `3-outro.wav`, `1-intro.txt` y `3-outro.txt` dentro de `_internal/` (o sus nombres anteriores en `internal/` o en la raíz), la CLI pregunta si quieres reutilizarlos; **Yes** es la respuesta predeterminada. Los cuatro archivos se copian al nuevo directorio `_internal/` y se evita volver a ejecutar Chatterbox o llamar a ElevenLabs. Si quieres actualizar la voz, sus muestras o sus guiones, responde **No** para generarlos de nuevo. La CLI prepara la salida en una carpeta temporal y conserva la anterior si falla la generación. La marca del pasaje en `status.json` se conserva. Esta opción también convierte salidas del formato anterior al nuevo vídeo completo.

Antes de **Reprocess complete video** aparecen **Listen to or regenerate intro audio** y **Listen to or regenerate outro audio**. Cada opción abre un menú para escuchar la locución actual (mostrando su TXT, con pausa y repetición), regenerarla o volver. Si todavía no existe el audio, escuchar queda desactivado y se puede generar desde el mismo menú. Regenerar genera solo la locución elegida con Chatterbox o ElevenLabs según `.env`, usando las plantillas y muestras actuales, y reemplaza su WAV y TXT en `_internal/`. Conserva la otra locución y los archivos anteriores si la generación falla. Después elige **Reprocess complete video** y **Yes** para reutilizar los audios e incorporar la nueva pista al vídeo (en modos `voice` o `mix`).

El volumen de la lectura se configura por pasaje en `_internal/2-passage-audio-settings.json`: `{"volumeMultiplier": 1}` conserva el volumen original. Admite números de `0` a `4`, incluidos decimales; `0` silencia, `1.5` multiplica la amplitud por 1,5 y `2` la duplica. Por encima de `1`, el filtro `alimiter` limita los picos para evitar saturación. El archivo se conserva al reprocesar y solo modifica el audio de la lectura. La guía `_internal/README.md` incluye todos los valores permitidos y ejemplos.

Cada versión tiene sus valores iniciales en `<outputDir>/<versionId>/default-version-settings.json`, actualmente con esta estructura:

```json
{
  "volumeMultiplier": 1.5
}
```

El archivo se crea después del primer renderizado correcto (también al reprocesar un vídeo existente), si todavía no existe, con el volumen usado en ese vídeo. Los renders posteriores conservan el archivo. Edítalo para definir el volumen inicial de los nuevos pasajes de esa versión; admite el mismo rango de `0` a `4`. Los pasajes con un JSON propio mantienen su volumen al reprocesar. La opción de ajuste y las previsualizaciones también usan el valor de la versión cuando el pasaje aún no tiene configuración.

También puedes elegir **Adjust reading volume**, justo debajo de **Adjust audio and verse timings**, tanto antes de crear como de reprocesar. El valor inicial es el último ajuste de la sesión, el del JSON del pasaje, el de la versión o `1` si ninguno existe. Enter conserva el valor mostrado. El ajuste permanece en memoria, se usa en las previsualizaciones de tiempos y se guarda en el JSON al crear o reprocesar el vídeo; cerrar la CLI antes de renderizar pierde los cambios pendientes.

## Voz de intro y outro

Por defecto, `VEOBIBLE_SHORTS_CLIP_AUDIO_MODE=voice` genera las locuciones de intro y outro con Chatterbox o ElevenLabs y las coloca sobre `0-intro.mp4` y `0-outro.mp4`, respectivamente, sustituyendo el audio original de esos clips. Con `mix`, las locuciones se mezclan con el audio original a volumen reducido. Con `video`, se usa únicamente el audio incorporado en los MP4. **La intro termina un segundo después de su audio; la outro comienza con un segundo de silencio y termina un segundo después de su audio.** Esto se aplica también al audio original de los MP4 en los modos `mix` y `video`. Si el vídeo de fondo dura más o menos, se recorta o se prolonga su último fotograma. Dentro de `_internal/`, cada locución se guarda como WAV PCM de 24 bits a 48 kHz, junto a su guion; `ffmpeg` utiliza esos WAV directamente para el montaje. Si falla la síntesis o el montaje, la salida anterior se conserva. El proveedor se elige en `.env`.

La outro muestra el título «Síguenos para escuchar más» traducido al idioma del pasaje, el nombre del canal, las cuentas de YouTube, X, Instagram y TikTok, y `veobible.com`. Edita [`social-accounts.json`](social-accounts.json) para configurar los usuarios por idioma. Los usuarios de YouTube ya corresponden a los canales del proyecto; los de X, Instagram y TikTok son **ejemplos** y debes reemplazarlos antes de publicar. Un usuario vacío omite esa red del vídeo. Puedes usar otro archivo con la misma estructura mediante `VEOBIBLE_SHORTS_SOCIAL_ACCOUNTS` en `.env`.

Las plantillas de español, inglés y portugués se editan en [voice-templates.json](voice-templates.json), dentro de esta herramienta. Admiten `{reference}`, `{version}`, `{book}`, `{start}`, `{end}` y `{passage_id}`. Los valores provienen del pasaje y la versión elegidos; `shorts-daily-dose` entrega los guiones completos a [VeoBible Voice](../voice-generator/README.md), que solo sintetiza el texto recibido.

En las locuciones, `{reference}` escribe los números con letras (por ejemplo, «Juan capítulo tres versículos catorce al diecinueve»). También convierte los números de libros como «1 Juan» a «Primera de Juan». `_internal/0-metadata.txt` conserva la referencia escrita «Juan 3:14-19». Después de editar las plantillas o cambiar de proveedor, usa **Reprocess complete video** y elige generar las locuciones de nuevo para actualizar la salida.

### Chatterbox local

Instala primero las dependencias en el entorno propio de [VeoBible Voice](../voice-generator/README.md). `shorts-daily-dose` usa automáticamente `tools/voice-generator/.venv/bin/python` y ejecuta su `cli.py`; no necesita configurar `VEOBIBLE_SHORTS_TTS_PYTHON` salvo que uses otra ubicación para ese entorno. Puedes seleccionar `latam` solo para español con `VEOBIBLE_SHORTS_TTS_MODEL_ES` o usar otro JSON de plantillas con `VEOBIBLE_SHORTS_TTS_TEMPLATES`. Los WAV finales son PCM de 24 bits a 48 kHz.

Durante la generación local, la terminal muestra la etapa actual y el tiempo transcurrido. Los mensajes de descarga, avisos y barras internas de Chatterbox se ocultan; si falla la generación, se muestran los detalles técnicos del error.

### Muestras de voz por idioma

Las muestras están fuera del repositorio, en `<workingDir>/material/voices/`. Para cada idioma se busca primero una muestra dedicada a la pista: `es-intro.mp3` y `es-outro.mp3`, `en-intro.mp3` y `en-outro.mp3`, o `pt-intro.mp3` y `pt-outro.mp3`. También se aceptan archivos `.wav`. Si falta una muestra dedicada, se usa la muestra general de ese idioma (`es.mp3`, `en.mp3` o `pt.mp3`; también `.wav`). Puedes cambiar las rutas generales en `tools/shorts-daily-dose/.env`:

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

### Texto durante la escucha completa

**Play complete passage** muestra todos los versículos del pasaje con sus referencias, resaltados y marcados como **PASSAGE**. Incluye hasta dos versículos anteriores y dos posteriores, cuando existen dentro del mismo libro, atenuados y marcados como **CONTEXT**, incluso de capítulos vecinos. El audio sigue siendo el corte ajustado del pasaje. Puedes recorrer el texto sin detener la escucha con **↑/↓**, **PgUp/PgDn** y **Home/End**.
