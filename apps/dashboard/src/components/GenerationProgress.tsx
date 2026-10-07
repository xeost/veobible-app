"use client";
export function GenerationProgress({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  const percent = Number.isFinite(value)
    ? Math.round(Math.max(0, Math.min(100, value)))
    : 0;
  return (
    <span className="generation-progress">
      <span className="generation-progress-heading">
        <span>{label}</span>
        <b>{percent}%</b>
      </span>
      <progress max={100} value={percent} aria-label={label} />
    </span>
  );
}
