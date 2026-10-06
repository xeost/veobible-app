# Archivos internos del vídeo

Esta carpeta contiene los archivos de trabajo del pasaje. Los archivos para publicar están un nivel arriba: `episode.mp4`, `thumbnail.jpg` y las descripciones de cada red social.

## Qué contiene cada archivo

Los prefijos agrupan los archivos por etapa: `0-` general, `1-` intro, `2-` lectura del pasaje y `3-` outro.

| Archivo | Función |
| --- | --- |
| `0-metadata.txt` | Referencia, versión, fuentes, fondo elegido, duración, segundo de la miniatura y límites del audio antes y después de los offsets. |
| `1-intro.txt` | Guion de la locución de intro. |
| `1-intro.wav` | Locución de intro utilizada en el vídeo. |
| `2-passage-audio-offsets.json` | Ajustes del inicio y del final del **audio de todo el pasaje**, recortado desde los audios fuente de los capítulos. |
| `2-passage-audio-settings.json` | Multiplicador del volumen de la lectura del pasaje. Se conserva al reprocesar. |
| `2-verse-text-offsets.json` | Ajustes de la entrada y de la salida del **texto de cada versículo** en pantalla. No recorta ni modifica el audio. |
| `2-versiculos.txt` | Texto completo del pasaje, con referencia y versión. |
| `3-outro.txt` | Guion de la locución de outro. |
| `3-outro.wav` | Locución de outro utilizada en el vídeo. |
| `README.md` | Esta guía. |

El renderizado genera las locuciones WAV y sus guiones cuando se usan voces, en los modos `voice` y `mix`. Editar un guion TXT no modifica el audio existente: para cambiar la locución, edita las plantillas de voz de la herramienta. **Regenerate intro audio** y **Regenerate outro audio**, antes de **Reprocess complete video**, regeneran por separado el WAV y TXT correspondientes con el proveedor configurado en `.env`. Después reprocesa el vídeo reutilizando los audios para incluir la nueva pista. También puedes reprocesar eligiendo generar ambas voces de nuevo.

## Ajustar el volumen de la lectura

En el directorio de la versión, dos niveles por encima de `_internal`, se crea `default-version-settings.json` tras el primer renderizado correcto si aún no existe. Contiene `volumeMultiplier` con el volumen usado en ese renderizado. Puedes editarlo para establecer el valor inicial de los nuevos pasajes de esta versión; los siguientes renders no lo sobrescriben. Admite los mismos valores de `0` a `4`. Este archivo del pasaje tiene prioridad sobre el de la versión, y el ajuste en memoria de la CLI tiene prioridad sobre ambos.


Edita `2-passage-audio-settings.json` y selecciona **Reprocess complete video** para aplicar el valor al siguiente renderizado:

```json
{
  "volumeMultiplier": 1
}
```

`volumeMultiplier` acepta cualquier número **entre 0 y 4, incluidos ambos extremos**. Usa punto decimal y escribe el número sin comillas. Los negativos, valores mayores que 4, textos y valores nulos no están permitidos.

Desde el menú del pasaje, **Adjust reading volume** aparece debajo de **Adjust audio and verse timings** antes de crear o reprocesar. Comienza con el último valor en memoria de esta sesión, el valor de este JSON, el valor predeterminado de la versión o `1` si no hay configuración. Enter conserva el valor mostrado. Se guarda en este archivo al crear o reprocesar el vídeo; salir de la CLI antes de renderizar pierde el ajuste pendiente. Las previsualizaciones de tiempos también usan el volumen elegido (con volumen `0` usan `1` para poder escuchar).

| Valor | Efecto |
| --- | --- |
| `0` | Silencia la lectura; conserva sus tiempos y el texto en pantalla. |
| `0.5` | Reduce la amplitud del audio a la mitad. |
| `1` | Volumen original; es el valor por defecto. |
| `1.25` | Aumenta la amplitud un 25 %. |
| `1.5` | Aumenta la amplitud un 50 %. |
| `2` | Duplica la amplitud. |
| `4` | Multiplicador máximo: cuatro veces la amplitud. |

El multiplicador modifica la amplitud de la señal; el volumen percibido no aumenta en la misma proporción. Puedes empezar con `1.25` o `1.5` y escuchar el resultado. Al usar valores mayores que `1`, FFmpeg aplica un limitador de picos con compensación de su retardo para evitar saturación. Si se alcanza ese límite, los picos no aumentarán en la proporción solicitada.

Este ajuste solo afecta a la lectura del pasaje: conserva el volumen de intro y outro, los audios fuente, los cortes y la sincronización del texto. Puedes reutilizar las voces al reprocesar. El valor se aplica siempre al audio fuente y no se acumula entre renderizados. Las salidas anteriores que no tienen este JSON usan `1`; el archivo se crea al generar o reprocesar.

## Ajustar el corte del audio del pasaje

Primero escucha `../episode.mp4`. Si faltan palabras al principio o al final, o se escucha contenido de otro versículo, edita `2-passage-audio-offsets.json`:

```json
{
  "startSeconds": 0,
  "endSeconds": 0
}
```

Los valores se suman a los límites estimados automáticamente. Son segundos: aceptan enteros y decimales, con punto decimal y sin comillas. `0` conserva el límite automático.

| Campo | Valor negativo | Valor positivo |
| --- | --- | --- |
| `startSeconds` | Empieza antes en el audio fuente; incluye más audio al principio. | Empieza después; recorta más del principio. |
| `endSeconds` | Termina antes; recorta más del final. | Termina después; incluye más audio al final. |

Por ejemplo, `"startSeconds": -0.25` recupera 250 milisegundos al principio y `"endSeconds": -0.15` recorta 150 milisegundos del final.

Los offsets son relativos al cálculo automático, no al resultado del renderizado anterior: no se acumulan al reprocesar. Si el pasaje cruza capítulos, el inicio afecta al primer capítulo y el final al último. El corte debe permanecer dentro del audio fuente y tener duración positiva. Los segundos de silencio antes y después de la lectura se añaden aparte.

## Ajustar cuándo se muestra cada versículo

Si el audio está bien recortado pero el texto aparece demasiado pronto o tarde, edita `2-verse-text-offsets.json`. Cada entrada de `verses` contiene:

| Campo | Función |
| --- | --- |
| `reference` | Identifica el versículo. Conserva la referencia existente. |
| `estimatedStartSeconds` | Inicio estimado automáticamente. Se recalcula al renderizar; no es un ajuste manual. |
| `estimatedEndSeconds` | Final estimado automáticamente. Se recalcula al renderizar; no es un ajuste manual. |
| `startOffsetSeconds` | Ajuste manual del inicio de su presentación en pantalla. |
| `endOffsetSeconds` | Ajuste manual del final de su presentación en pantalla. |

Los tiempos estimados se miden desde el inicio del audio bíblico recortado, **sin contar el segundo de silencio inicial** ni la intro. Cada offset se suma a su tiempo estimado. Los valores por defecto son `0`; también aceptan decimales positivos y negativos.

- Un offset negativo adelanta la entrada o salida del texto.
- Un offset positivo retrasa la entrada o salida del texto.
- Las animaciones se programan dentro de los intervalos resultantes.

Para adelantar 200 milisegundos el cambio de un versículo al siguiente, ajusta **ambos lados de la unión** en las entradas existentes:

```json
{
  "verses": [
    {
      "reference": "Juan 3:14",
      "estimatedStartSeconds": 0,
      "estimatedEndSeconds": 10,
      "startOffsetSeconds": 0,
      "endOffsetSeconds": -0.2
    },
    {
      "reference": "Juan 3:15",
      "estimatedStartSeconds": 10,
      "estimatedEndSeconds": 20,
      "startOffsetSeconds": -0.2,
      "endOffsetSeconds": 0
    }
  ]
}
```

Los tiempos y referencias de este ejemplo son ilustrativos. Edita los offsets de tu archivo, conservando sus versículos. El intervalo de cada versículo debe tener inicio mayor o igual a cero, duración positiva y final dentro de la lectura. Los intervalos no pueden superponerse; si adelantas la entrada de uno, puede ser necesario adelantar también la salida del anterior.

## Aplicar los cambios

También puedes ajustar estos valores sin editar los JSON: en el menú del pasaje elige **Adjust audio and verse timings**, situado antes de crear o reprocesar el vídeo. Los menús son listas fijas y numeradas y aparecen desde la parte superior de la terminal junto al banner. Selecciona con ↑/↓ o escribiendo el número y pulsa Enter; el cursor salta de la primera a la última opción y viceversa, sin cambiar el orden de la lista. Al volver a un menú, Enter repite la última opción utilizada si sigue disponible. Primero escucha y ajusta el corte del audio, después revisa los intervalos de los versículos con texto sincronizado en la terminal. El editor mueve juntas las fronteras de versículos vecinos: el final de uno es el inicio del siguiente. Los extremos del primer y último versículo se ajustan por separado.

Puedes escuchar todo el pasaje, solo el comienzo o el final, o un versículo con contexto. Al escuchar los primeros cinco segundos se muestra el primer versículo y su referencia; al escuchar los últimos cinco segundos se muestra el último. Ese texto permanece visible durante la escucha y al repetirla para ayudarte a reconocer los límites del corte. Usa **Enter/Esc** para detener, **R** para repetir y **Space** para pausar/continuar en macOS/Linux. Ajusta el inicio y el final con **Set start offset…** y **Set end offset…**, que aceptan valores decimales. La previsualización muestra los intervalos de cada texto; las animaciones se aplican en el vídeo final.

En el vídeo, el 100 % de la transición entre versículos ocurre antes del límite configurado, dentro del tiempo del versículo saliente. Primero se retira suavemente el texto anterior y después entra suavemente el siguiente, sin solapar los textos. Todas las líneas del nuevo versículo ya están completamente visibles cuando comienza su audio. La entrada conserva su duración natural, sin comprimirla al 10 %. La transición se acorta para versículos breves. Los offsets siguen indicando los límites del audio; no hace falta compensar las animaciones manualmente.

El editor comienza con los offsets existentes o los últimos valores en memoria de esta sesión. **Use these timings — keep in memory** confirma los ajustes para el siguiente vídeo. No modifica estos JSON hasta que crees o reproceses el vídeo. Cancelar descarta los cambios del editor; cerrar la CLI antes de renderizar pierde los ajustes que no se guardaron aún. Si un cambio del corte vuelve inválidos los offsets de texto existentes, puedes regresar al audio o elegir usar las estimaciones automáticas.

1. Revisa el vídeo y ajusta primero el corte del audio si es necesario.
2. En la CLI, selecciona **Reprocess complete video** y confirma el reemplazo.
3. Puedes reutilizar las voces de intro y outro: los offsets afectan a la lectura.
4. Escucha el nuevo vídeo y ajusta después los tiempos del texto si hace falta.

Los offsets editados se conservan y se aplican al siguiente renderizado. Los tiempos estimados se recalculan, también cuando cambias los offsets del audio. La guía y los demás archivos generados se actualizan al reprocesar. Si el proceso falla, se conserva la salida anterior.

Las salidas antiguas se reconocen automáticamente: `2-offsets.json` y `2-verse-offsets.json` dentro de `_internal/`, o `offsets.json` y `verse-offsets.json` dentro de `internal/` o en la raíz. Al reprocesar se guardan con los nombres nuevos; si coexisten varias versiones, los archivos con los nombres nuevos tienen prioridad.

### Texto durante la escucha completa

**Play complete passage** muestra todos los versículos del pasaje con sus referencias, resaltados y marcados como **PASSAGE**. Incluye hasta dos versículos anteriores y dos posteriores, cuando existen dentro del mismo libro, atenuados y marcados como **CONTEXT**, incluso de capítulos vecinos. El audio sigue siendo el corte ajustado del pasaje. Puedes recorrer el texto sin detener la escucha con **↑/↓**, **PgUp/PgDn** y **Home/End**.
