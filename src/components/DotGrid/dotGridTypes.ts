import type { CSSProperties } from "react";

export type DotGridProps = {
  dotSize?: number;
  gap?: number;
  baseColor?: string;
  activeColor?: string;
  proximity?: number;
  speedTrigger?: number;
  shockRadius?: number;
  shockStrength?: number;
  maxSpeed?: number;
  resistance?: number;
  returnDuration?: number;
  idleMotion?: boolean;
  idleSpeed?: number;
  idleStrength?: number;
  reducedMotionScale?: number;
  className?: string;
  style?: CSSProperties;
};
