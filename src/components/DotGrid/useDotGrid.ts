import { useCallback, useEffect, useMemo, useRef } from "react";
import { gsap } from "gsap";
import { InertiaPlugin } from "gsap/InertiaPlugin";
import type { DotGridProps } from "./dotGridTypes";
import { hexToRgb, throttle, type Dot } from "./dotGridUtils";

gsap.registerPlugin(InertiaPlugin);

export function useDotGrid({
  dotSize = 16,
  gap = 32,
  baseColor = "#5227FF",
  activeColor = "#5227FF",
  proximity = 150,
  speedTrigger = 100,
  shockRadius = 250,
  shockStrength = 5,
  maxSpeed = 5000,
  resistance = 750,
  returnDuration = 1.5,
  idleMotion = true,
  idleSpeed = 1,
  idleStrength = 1.8,
  reducedMotionScale = 0.32,
}: DotGridProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dotsRef = useRef<Dot[]>([]);
  const pointerRef = useRef({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    speed: 0,
    lastTime: 0,
    lastX: 0,
    lastY: 0,
    lastInteraction: Number.NEGATIVE_INFINITY,
    renderX: null as number | null,
    renderY: null as number | null,
  });

  const baseRgb = useMemo(() => hexToRgb(baseColor), [baseColor]);
  const activeRgb = useMemo(() => hexToRgb(activeColor), [activeColor]);

  const circlePath = useMemo(() => {
    if (typeof window === "undefined" || !window.Path2D) return null;

    const p = new Path2D();
    p.arc(0, 0, dotSize / 2, 0, Math.PI * 2);
    return p;
  }, [dotSize]);

  const buildGrid = useCallback(() => {
    const wrap = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const { width, height } = wrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(dpr, dpr);

    const cols = Math.floor((width + gap) / (dotSize + gap));
    const rows = Math.floor((height + gap) / (dotSize + gap));
    const cell = dotSize + gap;

    const gridW = cell * cols - gap;
    const gridH = cell * rows - gap;

    const extraX = width - gridW;
    const extraY = height - gridH;

    const startX = extraX / 2 + dotSize / 2;
    const startY = extraY / 2 + dotSize / 2;

    const dots: Dot[] = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const cx = startX + x * cell;
        const cy = startY + y * cell;
        dots.push({ cx, cy, xOffset: 0, yOffset: 0, _inertiaApplied: false });
      }
    }
    dotsRef.current = dots;
  }, [dotSize, gap]);

  useEffect(() => {
    if (!circlePath) return;

    let rafId: number;
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const draw = (timestamp: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const pointer = pointerRef.current;
      const idleEnabled = idleMotion;
      const motionScale = prefersReducedMotion ? reducedMotionScale : 1;
      const userIsActive = timestamp - pointer.lastInteraction < 1800;
      const idleTime = timestamp * 0.00032 * idleSpeed * motionScale;
      const idleX = width * (0.5 + Math.sin(idleTime) * 0.38);
      const idleY = height * (0.5 + Math.sin(idleTime * 0.73 + 1.4) * 0.36);
      const targetX = userIsActive || !idleEnabled ? pointer.x : idleX;
      const targetY = userIsActive || !idleEnabled ? pointer.y : idleY;
      const ease = userIsActive ? 0.18 : 0.028;

      pointer.renderX ??= idleEnabled ? idleX : pointer.x;
      pointer.renderY ??= idleEnabled ? idleY : pointer.y;
      pointer.renderX += (targetX - pointer.renderX) * ease;
      pointer.renderY += (targetY - pointer.renderY) * ease;

      const px = pointer.renderX;
      const py = pointer.renderY;
      const idleAmount = idleEnabled && !userIsActive ? 1 : 0;
      const activeProximity =
        proximity *
        (1 + Math.sin(idleTime * 1.35) * 0.18 * idleAmount * motionScale);
      const activeProxSq = activeProximity * activeProximity;

      for (const dot of dotsRef.current) {
        const phase =
          dot.cx * 0.018 +
          dot.cy * 0.012 -
          timestamp * 0.00145 * idleSpeed * motionScale;
        const driftX =
          Math.sin(phase) * idleStrength * idleAmount * motionScale;
        const driftY =
          Math.cos(phase * 0.82) *
          idleStrength *
          0.72 *
          idleAmount *
          motionScale;
        const ox = dot.cx + dot.xOffset + driftX;
        const oy = dot.cy + dot.yOffset + driftY;
        const dx = dot.cx - px;
        const dy = dot.cy - py;
        const dsq = dx * dx + dy * dy;

        let style = baseColor;
        let influence = 0;
        if (dsq <= activeProxSq) {
          const dist = Math.sqrt(dsq);
          influence = 1 - dist / activeProximity;
          const r = Math.round(
            baseRgb.r + (activeRgb.r - baseRgb.r) * influence,
          );
          const g = Math.round(
            baseRgb.g + (activeRgb.g - baseRgb.g) * influence,
          );
          const b = Math.round(
            baseRgb.b + (activeRgb.b - baseRgb.b) * influence,
          );
          style = `rgb(${r},${g},${b})`;
        }

        ctx.save();
        ctx.translate(ox, oy);
        const pulse =
          1 +
          Math.sin(phase * 1.18) * 0.28 * idleAmount * motionScale +
          influence * 0.16;
        ctx.scale(pulse, pulse);
        ctx.fillStyle = style;
        ctx.globalAlpha = 0.62 + influence * 0.38;
        ctx.fill(circlePath);
        ctx.restore();
      }

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [
    proximity,
    baseColor,
    activeRgb,
    baseRgb,
    circlePath,
    idleMotion,
    idleSpeed,
    idleStrength,
    reducedMotionScale,
  ]);

  useEffect(() => {
    buildGrid();
    let ro: ResizeObserver | null = null;
    if ("ResizeObserver" in window) {
      ro = new ResizeObserver(buildGrid);
      wrapperRef.current && ro.observe(wrapperRef.current);
    } else {
      (window as Window).addEventListener("resize", buildGrid);
    }
    return () => {
      if (ro) ro.disconnect();
      else window.removeEventListener("resize", buildGrid);
    };
  }, [buildGrid]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const now = performance.now();
      const pr = pointerRef.current;
      const dt = pr.lastTime ? now - pr.lastTime : 16;
      const dx = e.clientX - pr.lastX;
      const dy = e.clientY - pr.lastY;
      let vx = (dx / dt) * 1000;
      let vy = (dy / dt) * 1000;
      let speed = Math.hypot(vx, vy);
      if (speed > maxSpeed) {
        const scale = maxSpeed / speed;
        vx *= scale;
        vy *= scale;
        speed = maxSpeed;
      }
      pr.lastTime = now;
      pr.lastX = e.clientX;
      pr.lastY = e.clientY;
      pr.vx = vx;
      pr.vy = vy;
      pr.speed = speed;
      pr.lastInteraction = now;

      const rect = canvasRef.current!.getBoundingClientRect();
      pr.x = e.clientX - rect.left;
      pr.y = e.clientY - rect.top;

      for (const dot of dotsRef.current) {
        const dist = Math.hypot(dot.cx - pr.x, dot.cy - pr.y);
        if (speed > speedTrigger && dist < proximity && !dot._inertiaApplied) {
          dot._inertiaApplied = true;
          gsap.killTweensOf(dot);
          const pushX = dot.cx - pr.x + vx * 0.005;
          const pushY = dot.cy - pr.y + vy * 0.005;
          gsap.to(dot, {
            inertia: { xOffset: pushX, yOffset: pushY, resistance },
            onComplete: () => {
              gsap.to(dot, {
                xOffset: 0,
                yOffset: 0,
                duration: returnDuration,
                ease: "elastic.out(1,0.75)",
              });
              dot._inertiaApplied = false;
            },
          });
        }
      }
    };

    const onClick = (e: MouseEvent) => {
      pointerRef.current.lastInteraction = performance.now();
      const rect = canvasRef.current!.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      for (const dot of dotsRef.current) {
        const dist = Math.hypot(dot.cx - cx, dot.cy - cy);
        if (dist < shockRadius && !dot._inertiaApplied) {
          dot._inertiaApplied = true;
          gsap.killTweensOf(dot);
          const falloff = Math.max(0, 1 - dist / shockRadius);
          const pushX = (dot.cx - cx) * shockStrength * falloff;
          const pushY = (dot.cy - cy) * shockStrength * falloff;
          gsap.to(dot, {
            inertia: { xOffset: pushX, yOffset: pushY, resistance },
            onComplete: () => {
              gsap.to(dot, {
                xOffset: 0,
                yOffset: 0,
                duration: returnDuration,
                ease: "elastic.out(1,0.75)",
              });
              dot._inertiaApplied = false;
            },
          });
        }
      }
    };

    const throttledMove = throttle(onMove, 50);
    window.addEventListener("mousemove", throttledMove, { passive: true });
    window.addEventListener("click", onClick);

    return () => {
      window.removeEventListener("mousemove", throttledMove);
      window.removeEventListener("click", onClick);
    };
  }, [
    maxSpeed,
    speedTrigger,
    proximity,
    resistance,
    returnDuration,
    shockRadius,
    shockStrength,
  ]);
  return { wrapperRef, canvasRef };
}
