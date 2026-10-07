export type TooltipRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/** Keep floating hints inside the visible viewport, including zoomed mobile views. */
export function tooltipPosition(
  anchor: TooltipRect,
  tooltip: { width: number; height: number },
  viewport: TooltipRect,
) {
  const padding = 10;
  const gap = 9;
  const center = anchor.left + anchor.width / 2;
  const above = anchor.top - viewport.top - padding - gap;
  const below =
    viewport.top + viewport.height - padding - anchor.top - anchor.height - gap;
  const side = above >= tooltip.height || above >= below ? "top" : "bottom";
  const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(value, Math.max(min, max)));
  const left = clamp(
    center - tooltip.width / 2,
    viewport.left + padding,
    viewport.left + viewport.width - padding - tooltip.width,
  );
  const top = clamp(
    side === "top"
      ? anchor.top - tooltip.height - gap
      : anchor.top + anchor.height + gap,
    viewport.top + padding,
    viewport.top + viewport.height - padding - tooltip.height,
  );
  return {
    left,
    top,
    side,
    arrow: clamp(center - left, 12, tooltip.width - 12),
  };
}
