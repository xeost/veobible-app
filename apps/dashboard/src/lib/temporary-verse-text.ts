export type TemporaryVerseText = {
  scope: string;
  original: string;
  accepted: string;
  draft: string | null;
};

export function initialVerseText(
  scope: string,
  original: string,
): TemporaryVerseText {
  return { scope, original, accepted: original, draft: null };
}

type Action =
  | { type: "select"; scope: string; original: string }
  | { type: "edit" }
  | { type: "change"; text: string }
  | { type: "accept" }
  | { type: "cancel" }
  | { type: "restore" }
  | { type: "discard" };

export function temporaryVerseText(
  state: TemporaryVerseText,
  action: Action,
): TemporaryVerseText {
  switch (action.type) {
    case "select":
      return state.scope === action.scope && state.original === action.original
        ? state
        : initialVerseText(action.scope, action.original);
    case "edit":
      return { ...state, draft: state.accepted };
    case "change":
      return state.draft === null ? state : { ...state, draft: action.text };
    case "accept":
      return state.draft?.trim()
        ? { ...state, accepted: state.draft.trim(), draft: null }
        : state;
    case "cancel":
      return { ...state, draft: null };
    case "restore":
      return {
        ...state,
        accepted: state.original,
        draft: state.draft === null ? null : state.original,
      };
    case "discard":
      return initialVerseText(state.scope, state.original);
  }
}

/** Only accepted text can be sent to synthesis; drafts never affect generation. */
export function verseTextOverride(state: TemporaryVerseText) {
  return state.accepted === state.original ? undefined : state.accepted;
}
