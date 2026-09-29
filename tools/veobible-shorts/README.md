# VeoBible Shorts CLI

Asistente interactivo para reunir material de versículos populares para shorts. Selecciona idioma, versión y rango. Cada preparación crea una carpeta con los audios, `versiculos.txt` y `metadata.txt`. Se puede marcar el rango como utilizado después de prepararlo.

## Instalación y ejecución

Requiere Node.js 18+ y pnpm.

```bash
cd tools/veobible-shorts
pnpm install
cp .env.example .env
pnpm start
```

También se puede iniciar desde la raíz con `pnpm shorts`.

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

Los archivos se guardan en `<outputDir>/<versionId>/<id>/`. `status.json` se guarda directamente en `<outputDir>` y marca los rangos globalmente por `id`, independientemente de idioma y versión. Preparar archivos no los marca automáticamente; el asistente lo pregunta al final. Si se omite, el rango se puede marcar más tarde desde su menú.

**Alcance de audio:** los archivos fuente están divididos por capítulo, no por versículo. La herramienta copia los capítulos completos que contienen el rango sin recortar audio. `versiculos.txt` contiene únicamente los versículos seleccionados y `metadata.txt` deja constancia del alcance de los audios.
