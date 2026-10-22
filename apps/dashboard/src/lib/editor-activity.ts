type EditorActivity = {
  busy: boolean;
  submittingTasks: boolean;
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
    taskQueueLocked:
      activity.busy || activity.active || !activity.alignmentLoaded,
    editingLocked:
      updating ||
      activity.submittingTasks ||
      activity.alignmentPending ||
      activity.alignmentAwaitingApply ||
      (activity.hasAnalysis && !activity.alignmentLoaded),
  };
}

/** A block only inherits work that changes its own audio or verse cuts. */
export function editorBlockLocks(
  activity: EditorActivity,
  block: {
    submitting: boolean;
    alignmentBusy: boolean;
    applyingAlignment: boolean;
  },
) {
  return editorActivityLocks({
    ...activity,
    submittingTasks: block.submitting,
    alignmentPending: block.alignmentBusy,
    alignmentAwaitingApply: false,
    applyingAlignment: block.applyingAlignment,
  });
}
