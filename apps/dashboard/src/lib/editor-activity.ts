type EditorActivity = {
  busy: boolean;
  active: boolean;
  applyingAlignment: boolean;
  alignmentLoaded: boolean;
  hasAnalysis: boolean;
  alignmentPending: boolean;
  alignmentAwaitingApply: boolean;
};

/** Background timing jobs protect reading edits without blocking independent tasks. */
export function editorActivityLocks(activity: EditorActivity) {
  const updating =
    activity.busy || activity.active || activity.applyingAlignment;
  return {
    taskQueueLocked: updating || !activity.alignmentLoaded,
    editingLocked:
      updating ||
      activity.alignmentPending ||
      activity.alignmentAwaitingApply ||
      (activity.hasAnalysis && !activity.alignmentLoaded),
  };
}
