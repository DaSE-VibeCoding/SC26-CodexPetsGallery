import type { SpriteGrid, SpriteState } from "./types";

export type TrialScaleStep = 0 | 1 | 2;
export type TrialLogicalState =
  | "idle"
  | "run-right"
  | "run-left"
  | "waving"
  | "jumping"
  | "waiting"
  | "failed"
  | "review"
  | "running";

export type TrialPoint = { x: number; y: number };

/** Render height caps for small / medium / large. */
export const TRIAL_SCALE_HEIGHTS = [80, 112, 144] as const;

export const TRIAL_DRAG_THRESHOLD_PX = 10;
export const TRIAL_MULTI_CLICK_WINDOW_MS = 400;
export const TRIAL_MULTI_CLICK_COUNT = 3;
export const TRIAL_IDLE_WAIT_MS = 6000;
export const TRIAL_EDGE_MARGIN = 16;
/** Room above the sprite for the scale/close chrome row. */
export const TRIAL_TOP_MARGIN = 40;
/** Extra room under the sprite for the special-action chrome row. */
export const TRIAL_BOTTOM_MARGIN = 48;

const STATE_ALIASES: Record<TrialLogicalState, readonly string[]> = {
  idle: ["idle"],
  "run-right": ["run-right", "running-right"],
  "run-left": ["run-left", "running-left"],
  waving: ["waving"],
  jumping: ["jumping"],
  waiting: ["waiting"],
  failed: ["failed"],
  review: ["review"],
  running: ["running"],
};

const EGG_LOGICAL: readonly TrialLogicalState[] = ["failed", "review", "running"];

export function clampTrialScaleStep(value: number): TrialScaleStep {
  if (value <= 0) return 0;
  if (value >= 2) return 2;
  return value as TrialScaleStep;
}

export function trialScaleHeight(step: TrialScaleStep): number {
  return TRIAL_SCALE_HEIGHTS[clampTrialScaleStep(step)];
}

export function resolveTrialState(grid: SpriteGrid, logical: TrialLogicalState): SpriteState | null {
  const aliases = STATE_ALIASES[logical] ?? [logical];
  for (const id of aliases) {
    const found = grid.states.find((state) => state.id === id);
    if (found) return found;
  }
  if (logical === "idle") {
    return grid.states.find((state) => state.id === grid.defaultState) ?? grid.states[0] ?? null;
  }
  return null;
}

export function listEggStates(grid: SpriteGrid): SpriteState[] {
  return EGG_LOGICAL
    .map((logical) => resolveTrialState(grid, logical))
    .filter((state): state is SpriteState => Boolean(state));
}

export function onceDurationMs(state: SpriteState) {
  return Math.max(16, Number(state.frameDuration) || 160) * Math.max(1, state.frames || 1);
}

export function defaultTrialPosition(size: { width: number; height: number }, viewport = getViewportSize()): TrialPoint {
  return clampTrialPosition(
    {
      x: viewport.width - size.width - TRIAL_EDGE_MARGIN,
      y: viewport.height - size.height - TRIAL_BOTTOM_MARGIN,
    },
    size,
    viewport,
  );
}

export function getViewportSize() {
  if (typeof window === "undefined") return { width: 1280, height: 720 };
  const vv = window.visualViewport;
  return {
    width: Math.round(vv?.width ?? window.innerWidth),
    height: Math.round(vv?.height ?? window.innerHeight),
  };
}

export function clampTrialPosition(
  position: TrialPoint,
  size: { width: number; height: number },
  viewport = getViewportSize(),
): TrialPoint {
  const maxX = Math.max(TRIAL_EDGE_MARGIN, viewport.width - size.width - TRIAL_EDGE_MARGIN);
  const maxY = Math.max(TRIAL_TOP_MARGIN, viewport.height - size.height - TRIAL_BOTTOM_MARGIN);
  return {
    x: Math.min(maxX, Math.max(TRIAL_EDGE_MARGIN, position.x)),
    y: Math.min(maxY, Math.max(TRIAL_TOP_MARGIN, position.y)),
  };
}

/** Pick run direction from horizontal delta; small moves keep previous. */
export function runDirectionFromDelta(
  deltaX: number,
  previous: "run-left" | "run-right" | null = null,
  threshold = 2,
): "run-left" | "run-right" | null {
  if (deltaX <= -threshold) return "run-left";
  if (deltaX >= threshold) return "run-right";
  return previous;
}

export type ClickBurstResult =
  | { kind: "none" }
  | { kind: "single"; count: number }
  | { kind: "multi"; count: number };

/**
 * Track rapid clicks. Returns whether this click should fire a single action
 * immediately is deferred to the caller (they wait a short window); when count
 * hits the multi threshold, caller should cancel the pending single.
 */
export function registerClickBurst(
  previous: { count: number; lastAt: number },
  now: number,
  {
    windowMs = TRIAL_MULTI_CLICK_WINDOW_MS,
    multiCount = TRIAL_MULTI_CLICK_COUNT,
  } = {},
): { burst: { count: number; lastAt: number }; result: ClickBurstResult } {
  const inWindow = previous.count > 0 && now - previous.lastAt <= windowMs;
  const count = inWindow ? previous.count + 1 : 1;
  const burst = { count, lastAt: now };
  if (count >= multiCount) {
    return { burst: { count: 0, lastAt: now }, result: { kind: "multi", count } };
  }
  return { burst, result: { kind: "single", count } };
}

export function nextTapAnimation(previousTap: "waving" | "jumping" | null): "waving" | "jumping" {
  return previousTap === "waving" ? "jumping" : "waving";
}

export function pickEggState(eggs: SpriteState[], previousId: string | null = null): SpriteState | null {
  if (eggs.length === 0) return null;
  if (eggs.length === 1) return eggs[0];
  const options = previousId ? eggs.filter((state) => state.id !== previousId) : eggs;
  const pool = options.length > 0 ? options : eggs;
  const index = Math.floor(Math.random() * pool.length);
  return pool[index] ?? null;
}

export function supportsHoverFinePointer() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}
