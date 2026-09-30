# VeoBible Voice

Herramienta Python genérica para sintetizar pistas de voz con Chatterbox. Recibe un JSON de guiones, un idioma y un directorio de salida. Por cada pista produce `<nombre>.txt`, `<nombre>.wav` y `<nombre>.aiff`. Los audios finales son PCM de 24 bits a 48 kHz; el AIFF se convierte desde el WAV.

## Instalación

Requiere Python 3.12, `ffmpeg` en `PATH` y los paquetes de [requirements.txt](requirements.txt). Crea el entorno virtual dentro de `tools/veobible-voice`:

```bash
cd tools/veobible-voice
python3.12 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
```

`veobible-shorts` usa este intérprete de forma predeterminada para generar voces locales.

La primera carga del modelo puede descargar pesos desde Hugging Face. Chatterbox multilingüe admite español, inglés y portugués, entre otros idiomas. El modelo `latam` usa el checkpoint `ResembleAI/Chatterbox-Multilingual-es-mx-latam` y solo admite español. Si usas Hugging Face con autenticación, exporta `HF_TOKEN`.

## Uso

Crea un JSON que asigne nombres de pista a textos, por ejemplo:

```json
{
  "bienvenida": "Bienvenidos a mi canal.",
  "despedida": "Hasta la próxima."
}
```

Después ejecuta:

```bash
.venv/bin/python cli.py --scripts /ruta/a/guiones.json --language es --output-dir /ruta/a/salida --dry-run
.venv/bin/python cli.py --scripts /ruta/a/guiones.json --language es --output-dir /ruta/a/salida
```

`--dry-run` valida y muestra los textos sin cargar el modelo ni escribir archivos. `--force` reemplaza pistas existentes. `--model latam` selecciona el modelo latinoamericano; el valor predeterminado es `multilingual`. `--device` admite `auto`, `mps`, `cuda` o `cpu`. `--voice-prompt` acepta una muestra WAV/MP3 común para todas las pistas. `--voice-prompts` acepta un JSON que asigna nombres de pista a rutas de muestras específicas; cada ruta prevalece sobre la muestra común. `--exaggeration` y `--cfg-weight` controlan la generación; ambos valen `0.5` por defecto.

Los nombres de pista admiten letras minúsculas, números, guiones y guiones bajos, y deben comenzar con una letra. Una invocación genera todas las pistas con el modelo cargado una sola vez. `veobible-shorts` usa esta interfaz para sus intros y outros, con sus propias [plantillas](../veobible-shorts/voice-templates.json).
