/** Pure helpers for the page-level trial companion. Kept in sync with web/src/lib/trial-companion.ts */

export const TRIAL_SCALE_HEIGHTS = [80, 112, 144];
export const TRIAL_DRAG_THRESHOLD_PX = 10;
export const TRIAL_MULTI_CLICK_WINDOW_MS = 400;
export const TRIAL_MULTI_CLICK_COUNT = 3;
export const TRIAL_IDLE_WAIT_MS = 6000;
export const TRIAL_EDGE_MARGIN = 16;
/** Room above the sprite for the scale/close chrome row. */
export const TRIAL_TOP_MARGIN = 40;
/** Extra room under the sprite for the special-action chrome row. */
export const TRIAL_BOTTOM_MARGIN = 48;

const STATE_ALIASES = {
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

const EGG_LOGICAL = ["failed", "review", "running"];

export function clampTrialScaleStep(value) {
  if (value <= 0) return 0;
  if (value >= 2) return 2;
  return value;
}

export function trialScaleHeight(step) {
  return TRIAL_SCALE_HEIGHTS[clampTrialScaleStep(step)];
}

export function resolveTrialState(grid, logical) {
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

export function listEggStates(grid) {
  return EGG_LOGICAL
    .map((logical) => resolveTrialState(grid, logical))
    .filter(Boolean);
}

export function onceDurationMs(state) {
  return Math.max(16, Number(state.frameDuration) || 160) * Math.max(1, state.frames || 1);
}

export function clampTrialPosition(position, size, viewport) {
  const maxX = Math.max(TRIAL_EDGE_MARGIN, viewport.width - size.width - TRIAL_EDGE_MARGIN);
  const maxY = Math.max(TRIAL_TOP_MARGIN, viewport.height - size.height - TRIAL_BOTTOM_MARGIN);
  return {
    x: Math.min(maxX, Math.max(TRIAL_EDGE_MARGIN, position.x)),
    y: Math.min(maxY, Math.max(TRIAL_TOP_MARGIN, position.y)),
  };
}

export function defaultTrialPosition(size, viewport) {
  return clampTrialPosition(
    {
      x: viewport.width - size.width - TRIAL_EDGE_MARGIN,
      y: viewport.height - size.height - TRIAL_BOTTOM_MARGIN,
    },
    size,
    viewport,
  );
}

export function runDirectionFromDelta(deltaX, previous = null, threshold = 2) {
  if (deltaX <= -threshold) return "run-left";
  if (deltaX >= threshold) return "run-right";
  return previous;
}

export function registerClickBurst(
  previous,
  now,
  { windowMs = TRIAL_MULTI_CLICK_WINDOW_MS, multiCount = TRIAL_MULTI_CLICK_COUNT } = {},
) {
  const inWindow = previous.count > 0 && now - previous.lastAt <= windowMs;
  const count = inWindow ? previous.count + 1 : 1;
  const burst = { count, lastAt: now };
  if (count >= multiCount) {
    return { burst: { count: 0, lastAt: now }, result: { kind: "multi", count } };
  }
  return { burst, result: { kind: "single", count } };
}

export function nextTapAnimation(previousTap) {
  return previousTap === "waving" ? "jumping" : "waving";
}

export function pickEggState(eggs, previousId = null) {
  if (eggs.length === 0) return null;
  if (eggs.length === 1) return eggs[0];
  const options = previousId ? eggs.filter((state) => state.id !== previousId) : eggs;
  const pool = options.length > 0 ? options : eggs;
  const index = Math.floor(Math.random() * pool.length);
  return pool[index] ?? null;
}
