# VeoBible Shorts CLI

Asistente interactivo para reunir material de versículos populares para shorts. Selecciona idioma, versión y rango. Cada preparación crea una carpeta con los audios, `versiculos.txt` y `metadata.txt`. Se puede marcar el rango como utilizado después de prepararlo.

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

`VEOBIBLE_SHORTS_OUTPUT_DIR` es opcional: si lo omites, se usa `outputs` dentro de `VEOBIBLE_SHORTS_WORKING_DIR`. El archivo `.env` queda excluido de Git; `.env.example` sirve como plantilla.

El catálogo común a todos los idiomas está en `popular-verses.json`. Cada entrada necesita un `id` único, el `book` en inglés tal como aparece en los índices bíblicos, y puntos `start` y `end` con `chapter` y `verse`. Los rangos pueden cruzar capítulos dentro de un mismo libro. La herramienta valida los límites según la versión elegida.

Al configurar un rango, procura que el texto de los versículos seleccionados abarque **entre 130 y 150 palabras**. Esa extensión apunta a una narración de alrededor de **60 segundos** para el short video. El número de palabras puede variar entre idiomas y versiones, por lo que conviene comprobarlo en cada versión que vayas a utilizar.

El catálogo incluido contiene **100 rangos de los 66 libros**, todos verificados con **130–150 palabras en Reina Valera 1909**. Consulta [la selección y los conteos por versión](popular-verses.md) para ver el tema de cada pasaje, los criterios de selección y las fuentes de interés consultadas. El orden es una propuesta editorial para shorts. La duración de 60–70 segundos depende de la velocidad de narración y las pausas; debe confirmarse con el audio final.

Los archivos se guardan en `<outputDir>/<versionId>/<id>/`. `status.json` se guarda directamente en `<outputDir>` y marca los rangos globalmente por `id`, independientemente de idioma y versión. Preparar archivos no los marca automáticamente; el asistente lo pregunta al final. Si se omite, el rango se puede marcar más tarde desde su menú.

**Alcance de audio:** los archivos fuente están divididos por capítulo, no por versículo. La herramienta copia cada capítulo completo en su formato original (`.mp3` o `.m4a`) y crea junto a él un `.wav` y un `.aiff` **PCM de 24 bits a 48 kHz** para importarlos en DaVinci Resolve. El AIFF se convierte desde el WAV PCM, sin otra compresión con pérdida. Ambos contienen el rango elegido más **hasta 5 segundos antes y 5 segundos después**, sin sobrepasar los límites del capítulo, y conservan el número de canales del original. `versiculos.txt` contiene únicamente los versículos seleccionados. En `metadata.txt` se indican los tres nombres y, para **cada WAV y AIFF**, el inicio y el fin estimados del rango dentro del audio original, los límites del recorte y los segundos correspondientes dentro del archivo. Las duraciones se obtienen con `ffprobe`; los límites del rango se estiman según la proporción de palabras de cada versículo dentro del capítulo. Como las fuentes no tienen marcas de tiempo por versículo, **comprueba esos puntos escuchando el audio antes de editar el video**.

Para una salida creada antes de incorporar los tiempos, selecciona ese mismo rango y elige **Actualizar tiempos en metadata**. La opción también permite recalcularlos si cambia un audio; conserva las copias de audio y `versiculos.txt`.

Para una salida ya preparada, selecciona el mismo rango y elige **Generar WAV y AIFF de 48 kHz**. La CLI crea o reemplaza ambos archivos recortados a partir de los originales copiados y actualiza `metadata.txt`. Ambos son audio PCM real y tienen una transición de 20 ms al comienzo y al final para evitar chasquidos causados por cortes bruscos. El AIFF ofrece otro contenedor para probar la importación en Resolve; el cambio de formato no elimina chasquidos presentes en la grabación de origen.
