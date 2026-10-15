"use client";
import { createContext, useContext } from "react";
import type { GenerationQueueState } from "../lib/generation-queue";

export const GenerationQueueContext = createContext<GenerationQueueState>({
  connected: false,
  items: [],
  summary: { progress: 0, completed: 0, total: 0 },
});

export const useGenerationQueue = () => useContext(GenerationQueueContext);
