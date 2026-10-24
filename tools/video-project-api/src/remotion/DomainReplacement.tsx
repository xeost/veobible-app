import React, { createContext, useContext, type ReactNode } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import {
  domainReplacementOpacity,
  type DomainReplacementRange,
  type DomainScene,
} from "../domain-replacement";

const DomainContext = createContext<{
  time: number;
  ranges: DomainReplacementRange[];
}>({ time: 0, ranges: [] });

export function DomainReplacementProvider({
  ranges,
  children,
}: {
  ranges: DomainReplacementRange[];
  children: ReactNode;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rounded = ranges.map((range) => ({
    ...range,
    start: Math.round(range.start * fps) / fps,
    duration: Math.max(1, Math.round(range.duration * fps)) / fps,
  }));
  return (
    <DomainContext.Provider value={{ time: frame / fps, ranges: rounded }}>
      {children}
    </DomainContext.Provider>
  );
}

export function useDomainOpacity(scene: DomainScene) {
  const { time, ranges } = useContext(DomainContext);
  return domainReplacementOpacity(time, ranges, scene);
}
