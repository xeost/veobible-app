export type VideoWaveformResource = {
  section: string;
  resourceKey: string;
  src: string;
};

/** Only visible audio participates in the blocking startup preparation. */
export function visibleVideoWaveforms(
  resources: VideoWaveformResource[],
  expanded: ReadonlySet<string>,
) {
  return resources.filter((resource) => expanded.has(resource.section));
}

/** Warm one reading section ahead, or the first reading before one is opened. */
export function nextVideoWaveforms(
  resources: VideoWaveformResource[],
  readingSections: string[],
  expanded: ReadonlySet<string>,
  activeSection?: string,
) {
  const current =
    activeSection && expanded.has(activeSection)
      ? activeSection
      : readingSections.find((section) => expanded.has(section));
  const next =
    readingSections[current ? readingSections.indexOf(current) + 1 : 0];
  if (!next || expanded.has(next)) return [];
  return resources.filter((resource) => resource.section === next);
}
