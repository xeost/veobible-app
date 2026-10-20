/** Shared, dependency-free contract for the local worker and dashboard. */
export type AlignmentOffset = {
  reference: string;
  startOffsetSeconds: number;
  endOffsetSeconds: number;
  manuallyAdjusted?: boolean;
};
export type AlignmentPadding = {
  sectionIndex: number;
  beforeSeconds: number;
  afterSeconds: number;
};
export type AlignmentResult = {
  signature: string;
  offsets: AlignmentOffset[];
  padding: AlignmentPadding[];
  model: string;
  reviewReferences?: string[];
};
export type AlignmentJob = {
  id: string;
  status: "queued" | "running" | "done" | "failed";
  stage: string;
  progress: number;
  sectionIndex?: number;
  createdAt?: string;
  result?: AlignmentResult;
};
export function alignmentSignature(input: {
  kind: string;
  version: { id: string; locale: string };
  passage: unknown;
  settings: {
    passageOffsets: { startSeconds: number; endSeconds: number };
    audioEdition?: string;
  };
}) {
  const passage =
    input.passage && typeof input.passage === "object"
      ? Object.fromEntries(
          Object.entries(input.passage).filter(
            ([key]) => key !== "bookName" && key !== "endBookName",
          ),
        )
      : input.passage;
  // Canonical JSON: object insertion order must not invalidate a result.
  const canonical = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(canonical)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.entries(value)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, item]) => [key, canonical(item)]),
          )
        : value;
  return JSON.stringify(
    canonical({
      kind: input.kind,
      version: input.version.id,
      locale: input.version.locale,
      passage,
      passageOffsets: input.settings.passageOffsets,
      ...(input.settings.audioEdition
        ? { audioEdition: input.settings.audioEdition }
        : {}),
    }),
  );
}
/** Accept retained results created before display names were excluded. */
export function alignmentSignatureMatches(
  signature: string,
  input: Parameters<typeof alignmentSignature>[0],
) {
  try {
    const previous = JSON.parse(signature);
    return (
      alignmentSignature({
        kind: previous.kind,
        version: { id: previous.version, locale: previous.locale },
        passage: previous.passage,
        settings: {
          passageOffsets: previous.passageOffsets,
          audioEdition: previous.audioEdition,
        },
      }) === alignmentSignature(input)
    );
  } catch {
    return false;
  }
}
export function alignmentWasApplied(
  settings: { alignmentJobId?: string; alignmentAppliedJobIds?: string[] },
  jobId: string,
) {
  return (
    settings.alignmentJobId === jobId ||
    Boolean(settings.alignmentAppliedJobIds?.includes(jobId))
  );
}

export function mergeAlignment<
  T extends {
    verseOffsets: AlignmentOffset[];
    readingSectionPadding: AlignmentPadding[];
    alignmentReviewReferences?: string[];
    alignmentJobId?: string;
    alignmentAppliedJobIds?: string[];
  },
>(
  settings: T,
  result: AlignmentResult,
  jobId: string,
): Omit<
  T,
  | "verseOffsets"
  | "readingSectionPadding"
  | "alignmentJobId"
  | "alignmentAppliedJobIds"
  | "alignmentReviewReferences"
> & {
  verseOffsets: AlignmentOffset[];
  readingSectionPadding: AlignmentPadding[];
  alignmentJobId: string;
  alignmentAppliedJobIds: string[];
  alignmentReviewReferences: string[];
} {
  const applied = [
    ...new Set([
      ...(settings.alignmentAppliedJobIds ?? []),
      ...(settings.alignmentJobId ? [settings.alignmentJobId] : []),
      jobId,
    ]),
  ];
  if (alignmentWasApplied(settings, jobId))
    return {
      ...settings,
      alignmentJobId: settings.alignmentJobId ?? jobId,
      alignmentAppliedJobIds: applied,
      alignmentReviewReferences: settings.alignmentReviewReferences ?? [],
    };
  const offsets = new Map(
    settings.verseOffsets.map((item) => [item.reference, item]),
  );
  for (const item of result.offsets) {
    const existing = offsets.get(item.reference);
    // Existing entries without the marker are legacy manual adjustments.
    if (!existing || existing.manuallyAdjusted === false)
      offsets.set(item.reference, { ...item, manuallyAdjusted: false });
  }
  const padding = new Map(
    settings.readingSectionPadding.map((item) => [item.sectionIndex, item]),
  );
  for (const item of result.padding) {
    const existing = padding.get(item.sectionIndex);
    padding.set(item.sectionIndex, {
      ...item,
      beforeSeconds: Math.max(item.beforeSeconds, existing?.beforeSeconds ?? 0),
      afterSeconds: Math.max(item.afterSeconds, existing?.afterSeconds ?? 0),
    });
  }
  return {
    ...settings,
    verseOffsets: [...offsets.values()],
    readingSectionPadding: [...padding.values()],
    alignmentJobId: jobId,
    alignmentAppliedJobIds: applied,
    alignmentReviewReferences: [
      ...(settings.alignmentReviewReferences ?? []).filter(
        (reference) =>
          !result.offsets.some((offset) => offset.reference === reference),
      ),
      ...(result.reviewReferences ?? []).filter(
        (reference) => offsets.get(reference)?.manuallyAdjusted === false,
      ),
    ],
  };
}
