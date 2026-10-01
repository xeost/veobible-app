# Archivos internos del vídeo

Esta carpeta contiene los archivos de trabajo del pasaje. Los archivos para publicar están un nivel arriba: `short.mp4`, `thumbnail.jpg` y las descripciones de cada red social.

## Qué contiene cada archivo

Los prefijos agrupan los archivos por etapa: `0-` general, `1-` intro, `2-` lectura del pasaje y `3-` outro.

| Archivo | Función |
| --- | --- |
| `0-metadata.txt` | Referencia, versión, fuentes, fondo elegido, duración, segundo de la miniatura y límites del audio antes y después de los offsets. |
| `1-intro.txt` | Guion de la locución de intro. |
| `1-intro.wav` | Locución de intro utilizada en el vídeo. |
| `2-passage-audio-offsets.json` | Ajustes del inicio y del final del **audio de todo el pasaje**, recortado desde los audios fuente de los capítulos. |
| `2-verse-text-offsets.json` | Ajustes de la entrada y de la salida del **texto de cada versículo** en pantalla. No recorta ni modifica el audio. |
| `2-versiculos.txt` | Texto completo del pasaje, con referencia y versión. |
| `3-outro.txt` | Guion de la locución de outro. |
| `3-outro.wav` | Locución de outro utilizada en el vídeo. |
| `README.md` | Esta guía. |

Las locuciones WAV y sus guiones solo se generan cuando se usan voces, en los modos `voice` y `mix`. Editar un guion TXT no modifica el audio existente: para cambiar la locución, edita las plantillas de voz de la herramienta y reprocesa eligiendo generar las voces de nuevo.

## Ajustar el corte del audio del pasaje

Primero escucha `../short.mp4`. Si faltan palabras al principio o al final, o se escucha contenido de otro versículo, edita `2-passage-audio-offsets.json`:

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

1. Revisa el vídeo y ajusta primero el corte del audio si es necesario.
2. En la CLI, selecciona **Reprocess complete video** y confirma el reemplazo.
3. Puedes reutilizar las voces de intro y outro: los offsets afectan a la lectura.
4. Escucha el nuevo vídeo y ajusta después los tiempos del texto si hace falta.

Los offsets editados se conservan y se aplican al siguiente renderizado. Los tiempos estimados se recalculan, también cuando cambias los offsets del audio. La guía y los demás archivos generados se actualizan al reprocesar. Si el proceso falla, se conserva la salida anterior.

Las salidas antiguas se reconocen automáticamente: `2-offsets.json` y `2-verse-offsets.json` dentro de `_internal/`, o `offsets.json` y `verse-offsets.json` dentro de `internal/` o en la raíz. Al reprocesar se guardan con los nombres nuevos; si coexisten varias versiones, los archivos con los nombres nuevos tienen prioridad.
