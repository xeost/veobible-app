# VeoBible · Longs 365 Days

CLI interactiva para generar episodios horizontales de **La Biblia en 365 días**. Usa el catálogo existente `episodes.json`, con 365 episodios, y produce vídeos **1920×1080 (16:9)**. Conserva las funciones de `shorts-daily-dose`: idiomas, versiones, estados de uso, ajustes de audio y textos, volumen, locuciones Chatterbox/ElevenLabs, regeneración y archivos para publicar.

## Instalación y ejecución

```bash
cd tools/longs-365-days
pnpm install
cp .env.example .env
pnpm start
```

También se puede ejecutar desde la raíz del repositorio con **`pnpm longs`**. Las dependencias y la configuración de esta herramienta son independientes de `shorts-daily-dose`; no necesita esa herramienta para funcionar. Chatterbox utiliza el entorno propio de [voice-generator](../voice-generator/README.md).

Se requieren Node.js, pnpm, FFmpeg/ffprobe y mpv para escuchar y ajustar el audio. En macOS:

```bash
brew install ffmpeg mpv
```

Remotion utiliza Chromium para renderizar; en el primer render puede descargar su navegador. Si ya está instalado en `node_modules/.remotion`, lo reutiliza. Las fuentes del diseño son Georgia y Avenir, disponibles en macOS; se aplica la fuente de reserva del navegador en otros sistemas.

## Configuración y materiales

Copia o adapta `.env.example`. Todas las variables propias llevan el prefijo **`VEOBIBLE_LONGS_`**. No se carga el `.env` de los shorts ni se reutilizan sus claves API automáticamente. La herramienta carga su propio `.env` aunque se ejecute desde la raíz del repositorio; las variables exportadas en el proceso tienen prioridad.

El directorio de trabajo predeterminado es `/Users/fabian/Documents/veobible-longs`:

```text
veobible-longs/
├── material/
│   ├── videos/
│   │   ├── 0-intro.mp4
│   │   ├── 0-outro.mp4
│   │   ├── bg-0.mp4
│   │   └── bg-1.mp4
│   └── voices/
│       ├── es.mp3
│       ├── en.mp3
│       └── pt.mp3
└── outputs/
    ├── status.json
    └── rv1909/
        ├── default-version-settings.json
        └── episode-001/
```

Usa fondos horizontales para aprovechar el encuadre. La salida siempre es 16:9; los clips con otra proporción se recortan al centro, sin deformarlos. Se conserva la frecuencia de fotogramas de la intro. Un fondo `bg-[n].mp4` se elige aleatoriamente y se prepara como boomerang en bucle.

El origen de los audios bíblicos permanece, por defecto, en `/Users/fabian/Documents/audiobibles/sources/audios`. Los textos se leen de `frontend/public/bible-data` del repositorio. Estas rutas pueden cambiarse con `VEOBIBLE_LONGS_AUDIO_DIR` y `VEOBIBLE_LONGS_BIBLE_DATA_DIR`.

Configura en `.env`:

- Rutas de trabajo, outputs, fondos y datos bíblicos.
- Proveedor de voces, modelos, intérprete y muestras de Chatterbox.
- Clave, modelo y voz de ElevenLabs para cada idioma. Las voces de biblioteca requieren un plan de pago para usarlas mediante la API; consulta la sección 4 de `.env.example`.
- Cuentas sociales mediante `social-accounts.json` o `VEOBIBLE_LONGS_SOCIAL_ACCOUNTS`.
- Facebook se configura con la clave `facebook` de cada idioma y se muestra en la outro junto a YouTube, X, Instagram y TikTok. Una cadena vacía lo oculta; la clave se puede omitir en archivos anteriores.
- Concurrencia del render mediante `VEOBIBLE_LONGS_RENDER_CONCURRENCY`.

No se modifican los materiales ni los outputs de `shorts-daily-dose`.

## Catálogo de episodios

`episodes.json` es la fuente del catálogo. Conserva su estructura original:

```json
{
  "id": 33,
  "start": { "book": "exodus", "chapter": 39, "verse": 8 },
  "end": { "book": "leviticus", "chapter": 1, "verse": 17 }
}
```

Los IDs numéricos entre 1 y 365 se convierten en carpetas estables `episode-001`…`episode-365`. Los menús muestran `Day 033` seguido de la referencia traducida. Los episodios usados se muestran al final. El estado es independiente por idioma, versión y episodio, incluso si su carpeta de vídeo se ha eliminado.

Se admiten episodios entre capítulos y **entre libros**. Se recorren los libros en el orden del índice de la versión elegida; se incluye el final del libro inicial, todos los libros intermedios y el comienzo del libro final. Las referencias de cada versículo incluyen el nombre del libro para evitar confundir capítulos iguales de libros diferentes. Los extremos se validan contra esa versión; un episodio no disponible muestra un error y no produce un vídeo incompleto.

Con los datos bíblicos actuales, los 365 episodios tienen extremos válidos en RV1909, KJV y ARC. El episodio 334 termina en Romanos 16:27, pero SPABLL y WEB tienen el capítulo 16 hasta el versículo 24; ese episodio se muestra como no disponible en esas dos versiones. El catálogo original se conserva.

## Composición y audio

El vídeo tiene tres etapas: intro, lectura y outro. Remotion realiza composición y animaciones; FFmpeg analiza pausas, prepara el boomerang, corta y concatena los capítulos, aplica volumen con limitador al aumentarlo y extrae la miniatura.

La lectura comienza y termina con un segundo de silencio. Los capítulos se concatenan en una sola pista temporal para conservar el orden y evitar solapamientos; los versículos aparecen secuencialmente con su referencia. El diseño horizontal mantiene texto oscuro sobre un degradado claro y animado, y una outro con redes en dos columnas.

La intro dura su locución más un segundo. La outro añade un segundo antes de la locución y otro después. Hay transiciones entre etapas, pero no fade desde negro al inicio ni hacia negro al final. El primer fotograma muestra la intro completa como portada y el siguiente inicia su animación habitual. La miniatura se extrae después de terminar las animaciones de entrada.

## Ajustes interactivos

Los menús son numerados, con selección mediante flechas, cursor cíclico y memoria de la última opción. `Back` restablece la selección del menú. Backspace vuelve a mostrar el menú en la parte superior; al introducir números o responder `(Y/n)`, borra normalmente.

**Adjust audio and verse timings** carga los offsets JSON existentes o los ajustes de la sesión. Los cambios se mantienen en memoria; se guardan en los JSON al crear o reprocesar el vídeo.

En **Play complete passage** comienza activo `Editing passage START`:

- `S` / `F`: seleccionar inicio / final.
- `A` / `D`: sumar / restar cinco segundos al offset seleccionado.
- `E`: asignar el punto actual de reproducción al extremo seleccionado.
- `B`: retroceder cinco segundos; `L`: escuchar los últimos cinco segundos; `R`: repetir.
- Espacio: pausar / reanudar con una breve rampa de volumen.
- `Enter` o Backspace: volver conservando los ajustes en memoria.
- `Esc`: volver descartando los cambios de esa reproducción, conservando los anteriores.

En **Play selected verse with context**, `A`, `D` y `E` ajustan el final del versículo, y `N` pasa al siguiente. Mover una frontera mueve también la frontera compartida con el versículo vecino. `Esc` descarta todos los cambios realizados en esa reproducción, incluidos los de versículos seleccionados con `N`; `Enter` y Backspace los conservan. La interfaz muestra progreso y textos; la reproducción completa incluye versículos vecinos como contexto.

**Adjust reading volume** acepta decimales de `0` a `4`: `0` silencia, `1` mantiene la amplitud original, `0.5` reduce a la mitad y `2` duplica. El valor inicial se toma de la sesión, del episodio o de `default-version-settings.json`, en ese orden.

**Listen to or generate intro/outro audio** está disponible antes y después del primer render. El submenú ofrece **Generate** si todavía no existe la pista, o **Regenerate** si ya existe, además de escucharla con su texto. Los WAV y TXT se guardan en `_internal/` sin renderizar el vídeo. Crear audios no cambia **Create complete video** por **Reprocess complete video**.

Al crear o reprocesar el vídeo, se ofrece reutilizar los audios existentes con respuesta predeterminada **Yes**. Si solo está generada una locución, se conserva y se genera la que falta. Los ajustes JSON que ya existan también se conservan al crear el primer vídeo. La generación usa `voice-generator` o ElevenLabs según `.env`.

## Archivos de salida

```text
outputs/<version>/episode-001/
├── _internal/
│   ├── README.md
│   ├── 0-metadata.txt
│   ├── 1-intro.wav
│   ├── 1-intro.txt
│   ├── 2-passage-audio-offsets.json
│   ├── 2-passage-audio-settings.json
│   ├── 2-verse-text-offsets.json
│   ├── 2-versiculos.txt
│   ├── 3-outro.wav
│   └── 3-outro.txt
├── episode.mp4
├── thumbnail.jpg
├── youtube.txt
├── instagram.txt
├── tiktok.txt
└── x.txt
```

Se mantienen los nombres de los ajustes de pasaje para facilitar el mismo flujo de edición. `_internal/README.md` explica sus valores y efectos. En modo `video`, las locuciones WAV/TXT no se generan. Las descripciones están en el idioma elegido; `x.txt` incluye todos los versículos del episodio y puede exceder el límite de una publicación de la plataforma.

## Comprobaciones

```bash
pnpm check
pnpm build
pnpm test
```

Las pruebas incluyen catálogo, episodios entre libros, ajustes, estados, proveedores de voz y un render horizontal con medios sintéticos. Los renders de prueba requieren Chromium y permiso para abrir un servidor local. `pnpm benchmark` compara concurrencias usando fragmentos de los fondos configurados, sin tocar los outputs publicados.
