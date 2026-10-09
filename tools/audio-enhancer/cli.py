#!/usr/bin/env python3
"""Ecualización de audiobiblias con Python estándar y FFmpeg, sin IA."""

import argparse
from contextlib import contextmanager
import fcntl
import hashlib
import json
import math
import os
from pathlib import Path
import re
import shlex
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone

TOOL_VERSION = "1.1.0"
HERE = Path(__file__).resolve().parent
EXTENSIONS = {".mp3", ".m4a", ".aac", ".wav", ".flac", ".ogg", ".opus", ".aiff", ".aif"}
# Ganancias dB: shelf 120 Hz, cuerpo 190 Hz, caja 400 Hz,
# aspereza 3200 Hz, shelf 6000 Hz. Punto de partida, no calibración individual.
PRESETS = {
    "gentle": (1.5, 0.8, -0.5, -1.5, -1.5),
    "warm": (2.5, 1.5, -1.0, -2.5, -3.0),
    "deep": (3.5, 2.0, -1.5, -3.5, -4.5),
    "full": (6.0, 4.0, -1.5, -5.0, -6.0),
    "dark": (8.0, 5.5, -2.0, -7.0, -9.0),
}


class EnhanceError(Exception):
    pass


def load_env(path):
    """Leer valores literales; el entorno del proceso tiene precedencia."""
    values = {}
    if path.exists():
        for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if line.startswith("export "):
                line = line[7:]
            key, separator, value = line.partition("=")
            key = key.strip()
            if not separator or not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", key):
                raise EnhanceError(f"{path}:{number}: variable inválida")
            try:
                parts = shlex.split(value, comments=True)
            except ValueError as exc:
                raise EnhanceError(f"{path}:{number}: {exc}") from exc
            if len(parts) > 1:
                raise EnhanceError(f"{path}:{number}: usa comillas para valores con espacios")
            values[key] = parts[0] if parts else ""
    return values | dict(os.environ)


def roots(env):
    paths = []
    for key in ("AUDIO_ENHANCE_INPUT_DIR", "AUDIO_ENHANCE_OUTPUT_DIR"):
        if not env.get(key):
            raise EnhanceError(f"Falta {key}; configura {HERE / '.env'}")
        path = Path(env[key]).expanduser()
        if not path.is_absolute():
            raise EnhanceError(f"{key} debe ser una ruta absoluta")
        paths.append(path.resolve())
    source, output = paths
    if source == output or source in output.parents or output in source.parents:
        raise EnhanceError("Entrada y salida deben ser carpetas separadas, sin solapamiento")
    if not source.is_dir():
        raise EnhanceError(f"No existe la carpeta de entrada: {source}")
    return source, output


def within(path, root):
    resolved = path.resolve()
    if resolved != root and root not in resolved.parents:
        raise EnhanceError(f"Ruta fuera de la carpeta permitida: {path}")
    return resolved


def version_dir(root, version):
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]*", version):
        raise EnhanceError("La versión debe ser un identificador como rv1909, kjv o arc")
    directory = within(root / version, root)
    if not directory.is_dir():
        raise EnhanceError(f"No existe la versión: {version}")
    return directory


def natural_key(path):
    return [int(part) if part.isdigit() else part.lower()
            for part in re.split(r"(\d+)", str(path))]


def audio_files(directory, pattern="*", limit=None):
    files = []
    for path in directory.rglob("*"):
        if path.suffix.lower() not in EXTENSIONS or not path.is_file():
            continue
        if not path.relative_to(directory).match(pattern):
            continue
        if path.is_symlink():
            raise EnhanceError(f"No se admiten audios enlazados: {path}")
        within(path, directory)
        files.append(path)
    files.sort(key=lambda path: natural_key(path.relative_to(directory)))
    return files[:limit] if limit else files


def run(command):
    # Sin shell: rutas con espacios/caracteres especiales no se interpretan.
    process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    try:
        stdout, stderr = process.communicate()
    except BaseException:
        process.terminate()
        try:
            process.communicate(timeout=3)
        except subprocess.TimeoutExpired:
            process.kill()
            process.communicate()
        raise
    if process.returncode:
        raise EnhanceError(f"{Path(command[0]).name} falló:\n{stderr[-4000:]}")
    return stdout, stderr


def binaries(env, output_format):
    result = []
    for name in ("ffmpeg", "ffprobe"):
        executable = shutil.which(env.get(f"AUDIO_ENHANCE_{name.upper()}", name))
        if not executable:
            raise EnhanceError(f"No se encontró {name}. En macOS: brew install ffmpeg")
        result.append(executable)
    ffmpeg, ffprobe = result
    filters, _ = run([ffmpeg, "-hide_banner", "-filters"])
    available = {line.split()[1] for line in filters.splitlines() if len(line.split()) >= 3}
    required = {"aformat", "highpass", "bass", "equalizer", "treble", "loudnorm",
                "asetrate", "aresample", "atempo"}
    if not required <= available:
        raise EnhanceError(f"FFmpeg no incluye estos filtros: {', '.join(sorted(required - available))}")
    encoders, _ = run([ffmpeg, "-hide_banner", "-encoders"])
    codec = {"mp3": "libmp3lame", "flac": "flac", "wav": "pcm_s24le"}[output_format]
    if codec not in {line.split()[1] for line in encoders.splitlines() if len(line.split()) >= 3}:
        raise EnhanceError(f"FFmpeg no incluye el encoder {codec}")
    version, _ = run([ffmpeg, "-version"])
    return ffmpeg, ffprobe, version.splitlines()[0]


def probe(ffprobe, path):
    stdout, _ = run([ffprobe, "-v", "error", "-select_streams", "a:0",
                     "-show_entries", "stream=sample_rate,channels:format=duration", "-of", "json", str(path)])
    data = json.loads(stdout)
    if not data.get("streams"):
        raise EnhanceError(f"Sin pista de audio: {path}")
    stream = data["streams"][0]
    info = {"sample_rate": int(stream["sample_rate"]), "channels": int(stream["channels"]),
            "duration": float(data["format"]["duration"])}
    if info["channels"] not in (1, 2):
        raise EnhanceError(f"Solo se admiten audios mono/estéreo: {path}")
    if not math.isfinite(info["duration"]) or info["duration"] <= 0:
        raise EnhanceError(f"Duración inválida: {path}")
    if info["sample_rate"] < 16000:
        raise EnhanceError(f"Se requiere una frecuencia de muestreo de al menos 16 kHz: {path}")
    return info


def eq_chain(preset, strength, sample_rate):
    if preset == "original" or strength == 0:
        return "aformat=sample_fmts=dblp"
    bass, body, box, harsh, air = (gain * strength for gain in PRESETS[preset])
    # Frecuencias siempre por debajo de Nyquist; formato float para no recortar el refuerzo.
    harsh_frequency = min(3200, sample_rate * 0.4)
    air_frequency = min(6000, sample_rate * 0.4)
    return ",".join([
        "aformat=sample_fmts=dblp", "highpass=f=55:p=2:r=f64",
        f"bass=f=120:t=q:w=0.707:g={bass:g}:r=f64",
        f"equalizer=f=190:t=q:w=0.8:g={body:g}:r=f64",
        f"equalizer=f=400:t=q:w=1:g={box:g}:r=f64",
        f"equalizer=f={harsh_frequency:g}:t=q:w=0.9:g={harsh:g}:r=f64",
        f"treble=f={air_frequency:g}:t=q:w=0.707:g={air:g}:r=f64",
    ])


def processing_chain(preset, strength, sample_rate, pitch_semitones=0):
    chain = eq_chain(preset, strength, sample_rate)
    if preset != "original" and pitch_semitones:
        # Resampling cambia pitch y formantes; atempo compensa la velocidad.
        # Usar el cociente de tasas enteras evita acumular deriva por redondeo.
        shifted_rate = round(sample_rate * 2 ** (pitch_semitones / 12))
        tempo = sample_rate / shifted_rate
        chain += (f",asetrate={shifted_rate},aresample={sample_rate}:filter_size=64"
                  f",atempo={tempo:.12g}")
    return chain


def loudness_json(stderr):
    for block in reversed(re.findall(r"\{[^{}]*\}", stderr, re.DOTALL)):
        try:
            data = json.loads(block)
            if "input_i" in data:
                return data
        except json.JSONDecodeError:
            continue
    raise EnhanceError("FFmpeg no devolvió las mediciones de loudnorm")


def norm_filter(args, measured=None):
    value = f"loudnorm=I={args.lufs:g}:TP={args.true_peak:g}:LRA={args.lra:g}:print_format=json"
    if measured:
        for option, key in (("measured_I", "input_i"), ("measured_TP", "input_tp"),
                            ("measured_LRA", "input_lra"), ("measured_thresh", "input_thresh"),
                            ("offset", "target_offset")):
            number = float(measured[key])
            if not math.isfinite(number):
                raise EnhanceError("Audio silencioso o no medible; no se generará una salida normalizada")
            value += f":{option}={number:g}"
        value += ":linear=true"
    return value


def fingerprint(path):
    stat = path.stat()
    return {"path": str(path), "size": stat.st_size, "mtime_ns": stat.st_mtime_ns}


def output_guard(path, output):
    within(path, output)
    # Tampoco sobrescribir enlaces, aunque apunten al interior de la salida.
    if path.is_symlink():
        raise EnhanceError(f"La salida no puede ser un enlace simbólico: {path}")


def atomic_json(path, data, output):
    output_guard(path, output)
    descriptor, temporary = tempfile.mkstemp(prefix=".report-", suffix=".json", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as file:
            json.dump(data, file, indent=2, ensure_ascii=False, allow_nan=False)
            file.write("\n")
        os.replace(temporary, path)
    finally:
        Path(temporary).unlink(missing_ok=True)


@contextmanager
def output_lock(directory, output):
    output_guard(directory, output)
    directory.mkdir(parents=True, exist_ok=True)
    lock = directory / ".enhance.lock"
    output_guard(lock, output)
    with lock.open("a") as file:
        try:
            fcntl.flock(file, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as exc:
            raise EnhanceError(f"Otra ejecución está procesando {directory.name}") from exc
        try:
            yield
        finally:
            fcntl.flock(file, fcntl.LOCK_UN)


def process_audio(source, destination, output, args, executables, preset, start=0, seconds=None):
    ffmpeg, ffprobe, ffmpeg_version = executables
    output_guard(destination, output)
    report_path = destination.with_suffix(destination.suffix + ".json")
    output_guard(report_path, output)
    source_id = fingerprint(source)
    settings = {"tool_version": TOOL_VERSION, "ffmpeg": ffmpeg_version, "preset": preset,
                "gains_db": PRESETS.get(preset), "strength": args.strength,
                "pitch_semitones": 0 if preset == "original" else args.pitch_semitones,
                "lufs": args.lufs, "true_peak": args.true_peak, "lra": args.lra,
                "format": args.format, "bitrate": args.bitrate, "start": start, "seconds": seconds}
    signature = hashlib.sha256(json.dumps({"source": source_id, "settings": settings},
                                         sort_keys=True).encode()).hexdigest()
    if destination.exists() and not args.force:
        try:
            report = json.loads(report_path.read_text(encoding="utf-8"))
            if report["signature"] == signature and report["output_file"] == fingerprint(destination):
                return "omitido"
        except (OSError, ValueError, KeyError):
            pass
        raise EnhanceError(f"Ya existe una salida distinta o sin informe: {destination}. Usa --force para reemplazarla")

    info = probe(ffprobe, source)
    if start >= info["duration"]:
        raise EnhanceError("El inicio del fragmento supera la duración del audio")
    expected_duration = min(seconds, info["duration"] - start) if seconds else info["duration"] - start
    if expected_duration < 3:
        raise EnhanceError("Se necesitan al menos 3 segundos para medir el volumen")
    chain = processing_chain(preset, args.strength, info["sample_rate"], args.pitch_semitones)
    base = [ffmpeg, "-hide_banner", "-nostdin", "-v", "info", "-threads", "1",
            "-filter_threads", "1"]
    if start:
        base += ["-ss", str(start)]
    if seconds:
        # Limitar la entrada, para medir exactamente el mismo fragmento que se renderiza.
        base += ["-t", str(seconds)]
    base += ["-i", str(source)]
    base += ["-map", "0:a:0", "-vn", "-sn", "-dn"]
    print(f"  Midiendo {source.name} ({preset})...", flush=True)
    _, stderr = run(base + ["-af", chain + "," + norm_filter(args), "-f", "null", "-"])
    measured = loudness_json(stderr)
    normalized = chain + "," + norm_filter(args, measured)
    output_guard(destination.parent, output)
    destination.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=".enhance-", suffix=destination.suffix, dir=destination.parent)
    os.close(descriptor)
    temporary = Path(temporary)
    try:
        codec = {"mp3": ["-c:a", "libmp3lame", "-b:a", args.bitrate],
                 "flac": ["-c:a", "flac", "-sample_fmt", "s32"],
                 "wav": ["-c:a", "pcm_s24le"]}[args.format]
        # No trasladar ReplayGain/R128 antiguos: alterarían el volumen de reproducción.
        _, stderr = run(base + ["-af", normalized, "-ar", str(info["sample_rate"]),
                                "-ac", str(info["channels"]), "-map_metadata", "-1"]
                        + codec + ["-y", str(temporary)])
        rendered = probe(ffprobe, temporary)
        if (abs(rendered["duration"] - expected_duration) > 0.25
                or rendered["channels"] != info["channels"]
                or rendered["sample_rate"] != info["sample_rate"]):
            raise EnhanceError("La salida no conserva la duración, los canales o la frecuencia de muestreo")
        if fingerprint(source) != source_id:
            raise EnhanceError("El original cambió durante el procesamiento; salida descartada")
        output_guard(destination, output)
        os.replace(temporary, destination)
        report = {"signature": signature, "source": source_id, "settings": settings,
                  "filter": normalized, "input_audio": info, "output_audio": rendered,
                  "output_file": fingerprint(destination), "analysis_after_eq": measured,
                  "render_loudness_before_encoding": loudness_json(stderr),
                  "created_at": datetime.now(timezone.utc).isoformat()}
        atomic_json(report_path, report, output)
        return "generado"
    finally:
        temporary.unlink(missing_ok=True)


def bounded_number(low, high):
    def parse(value):
        try:
            number = float(value)
        except ValueError as exc:
            raise argparse.ArgumentTypeError("Debe ser un número") from exc
        if not math.isfinite(number) or not low <= number <= high:
            raise argparse.ArgumentTypeError(f"Debe estar entre {low} y {high}")
        return number
    return parse


def positive_int(value):
    number = int(value)
    if number < 1:
        raise argparse.ArgumentTypeError("Debe ser un entero positivo")
    return number


def parser():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--env-file", type=Path, default=HERE / ".env")
    commands = cli.add_subparsers(dest="command", required=True)
    commands.add_parser("versions", help="Listar versiones y cantidad de audios")
    commands.add_parser("presets", help="Mostrar perfiles de ecualización")
    for command in ("enhance", "preview"):
        sub = commands.add_parser(command, help="Procesar una versión" if command == "enhance" else "Comparar un fragmento")
        sub.add_argument("version", help="Por ejemplo rv1909, kjv o arc")
        sub.add_argument("--strength", type=bounded_number(0, 2), default=1, help="Intensidad de EQ (0 a 2; default 1)")
        sub.add_argument("--pitch-semitones", type=bounded_number(-3, 0), default=0,
                         help="Bajar el tono, compensando la velocidad (-3 a 0; default 0)")
        sub.add_argument("--lufs", type=bounded_number(-30, -12), default=-18, help="Volumen integrado objetivo (default -18)")
        sub.add_argument("--true-peak", type=bounded_number(-9, -1), default=-2, help="Techo de pico verdadero dBTP (default -2)")
        sub.add_argument("--lra", type=bounded_number(1, 50), default=11, help="Rango dinámico objetivo LU (default 11)")
        sub.add_argument("--format", choices=("mp3", "flac", "wav"), default="wav" if command == "preview" else "mp3")
        sub.add_argument("--bitrate", choices=("128k", "160k", "192k", "256k", "320k"), default="192k", help="Solo MP3")
        sub.add_argument("--force", action="store_true", help="Reemplazar salidas existentes, nunca originales")
        sub.add_argument("--dry-run", action="store_true", help="Mostrar plan sin escribir archivos")
        if command == "enhance":
            sub.add_argument("--preset", choices=tuple(PRESETS), default="warm")
            sub.add_argument("--pattern", default="*", help="Filtro glob, por ejemplo '01-genesis-*.mp3'")
            sub.add_argument("--limit", type=positive_int, help="Procesar solo los primeros N audios")
        else:
            sub.add_argument("--file", required=True, help="Ruta relativa de un audio dentro de la versión")
            sub.add_argument("--start", type=bounded_number(0, 100000), default=10, help="Inicio en segundos (default 10)")
            sub.add_argument("--seconds", type=bounded_number(3, 300), default=30, help="Duración del fragmento (default 30)")
            sub.add_argument("--presets", nargs="+", choices=tuple(PRESETS), default=list(PRESETS),
                             help="Perfiles a comparar; siempre incluye el original normalizado")
            sub.add_argument("--label", help="Subcarpeta para guardar otra comparación, por ejemplo intense-eq")
    return cli


def main(argv=None):
    args = parser().parse_args(argv)
    try:
        if args.command == "presets":
            print("Perfil    Graves120  Cuerpo190  Caja400  Aspereza3200  Agudos6000 (dB)")
            for name, gains in PRESETS.items():
                print(f"{name:8} " + "  ".join(f"{gain:+5.1f}" for gain in gains))
            return 0
        if not args.env_file.is_file():
            raise EnhanceError(f"No existe {args.env_file}; copia .env.example a .env")
        source, output = roots(load_env(args.env_file))
        if args.command == "versions":
            for directory in sorted(source.iterdir()):
                if directory.is_dir() and not directory.is_symlink():
                    print(f"{directory.name:12} {len(audio_files(directory))} audios")
            return 0
        directory = version_dir(source, args.version)
        target = output / args.version
        jobs = []
        if args.command == "enhance":
            for path in audio_files(directory, args.pattern, args.limit):
                destination = target / path.relative_to(directory).with_suffix("." + args.format)
                jobs.append((path, destination, args.preset, 0, None))
        else:
            relative = Path(args.file)
            if relative.is_absolute() or ".." in relative.parts:
                raise EnhanceError("--file debe ser una ruta relativa dentro de la versión")
            path = directory / relative
            within(path, directory)
            if not path.is_file() or path.is_symlink() or path.suffix.lower() not in EXTENSIONS:
                raise EnhanceError(f"Audio inválido: {path}")
            preview_dir = target / "_previews" / relative.with_suffix("")
            if args.label:
                if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]*", args.label):
                    raise EnhanceError("--label debe contener solo letras, números, guiones o guiones bajos")
                preview_dir /= args.label
            for preset in ("original", *dict.fromkeys(args.presets)):
                jobs.append((path, preview_dir / f"{preset}.{args.format}", preset, args.start, args.seconds))
        if not jobs:
            raise EnhanceError("No hay audios para la selección indicada")
        destinations = [job[1] for job in jobs]
        if len(set(destinations)) != len(destinations):
            raise EnhanceError("Dos originales tienen el mismo nombre de salida; selecciona una extensión con --pattern")
        for destination in destinations:
            output_guard(destination, output)
        executables = binaries(load_env(args.env_file), args.format)
        print(f"Entrada (solo lectura): {directory}\nSalida: {target}\nArchivos: {len(jobs)}", flush=True)
        if args.dry_run:
            for path, destination, preset, _, _ in jobs:
                print(f"{path.relative_to(directory)} -> {destination} [{preset}]")
            print("Simulación completada. No se escribió ningún archivo.")
            return 0
        counts = {"generado": 0, "omitido": 0, "error": 0}
        with output_lock(target, output):
            for index, (path, destination, preset, start, seconds) in enumerate(jobs, 1):
                print(f"[{index}/{len(jobs)}] {path.name} -> {destination.name}", flush=True)
                try:
                    status = process_audio(path, destination, output, args, executables, preset, start, seconds)
                    counts[status] += 1
                    print(f"  {status}: {destination}", flush=True)
                except (EnhanceError, OSError, ValueError, KeyError) as exc:
                    counts["error"] += 1
                    print(f"  ERROR: {exc}", file=sys.stderr, flush=True)
        print(f"Finalizado: {counts['generado']} generados, {counts['omitido']} omitidos, {counts['error']} errores")
        return 1 if counts["error"] else 0
    except (EnhanceError, OSError, ValueError, KeyError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("\nInterrumpido. Puedes reanudar con el mismo comando.", file=sys.stderr)
        return 130


if __name__ == "__main__":
    sys.exit(main())
