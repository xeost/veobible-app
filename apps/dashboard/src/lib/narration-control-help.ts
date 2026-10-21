export const narrationControlHelp = {
  repetition_penalty:
    "Discourages repeated sounds. 1–2: 1 applies no penalty; higher values discourage repetition more strongly. Narration presets use 2. This does not guarantee that every sentence will be spoken.",
  exaggeration:
    "Controls emotional intensity. 0–2: 0.5 is neutral; higher values add expression and may speed up speech. Extreme values can be unstable.",
  cfg_weight:
    "Controls guidance and pacing. 0–1: lower values allow freer, more deliberate speech; higher values strengthen guidance. It is not an exact speed control.",
  temperature:
    "Controls variation between generations. 0.05–5: lower values are more predictable; higher values add variation and may reduce clarity. The usual starting value is 0.8.",
} as const;
