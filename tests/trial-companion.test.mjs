import test from "node:test";
import assert from "node:assert/strict";

import {
  clampTrialPosition,
  clampTrialScaleStep,
  defaultTrialPosition,
  listEggStates,
  nextTapAnimation,
  onceDurationMs,
  registerClickBurst,
  resolveTrialState,
  runDirectionFromDelta,
  trialScaleHeight,
} from "../lib/trial-companion.js";

const sampleGrid = {
  defaultState: "idle",
  columns: 8,
  rows: 9,
  states: [
    { id: "idle", label: "待机", row: 0, frames: 6, frameDuration: 180 },
    { id: "run-right", label: "向右跑", row: 1, frames: 8, frameDuration: 90 },
    { id: "run-left", label: "向左跑", row: 2, frames: 8, frameDuration: 90 },
    { id: "waving", label: "招手", row: 3, frames: 4, frameDuration: 170 },
    { id: "jumping", label: "跳跃", row: 4, frames: 5, frameDuration: 130 },
    { id: "failed", label: "失败", row: 5, frames: 8, frameDuration: 170 },
    { id: "waiting", label: "等待", row: 6, frames: 6, frameDuration: 190 },
    { id: "running", label: "处理中", row: 7, frames: 6, frameDuration: 100 },
    { id: "review", label: "审阅", row: 8, frames: 6, frameDuration: 170 },
  ],
};

const aliasGrid = {
  defaultState: "idle",
  columns: 8,
  rows: 9,
  states: [
    { id: "idle", label: "待机", row: 0, frames: 6, frameDuration: 180 },
    { id: "running-right", label: "向右跑", row: 1, frames: 8, frameDuration: 90 },
    { id: "running-left", label: "向左跑", row: 2, frames: 8, frameDuration: 90 },
  ],
};

test("resolveTrialState matches canonical and alias ids", () => {
  assert.equal(resolveTrialState(sampleGrid, "run-left")?.id, "run-left");
  assert.equal(resolveTrialState(aliasGrid, "run-left")?.id, "running-left");
  assert.equal(resolveTrialState(aliasGrid, "run-right")?.id, "running-right");
  assert.equal(resolveTrialState(sampleGrid, "idle")?.id, "idle");
});

test("listEggStates only returns available special states", () => {
  const eggs = listEggStates(sampleGrid).map((state) => state.id).sort();
  assert.deepEqual(eggs, ["failed", "review", "running"]);
  assert.deepEqual(listEggStates(aliasGrid), []);
});

test("onceDurationMs multiplies frames by duration", () => {
  assert.equal(onceDurationMs({ frames: 4, frameDuration: 170 }), 680);
  assert.equal(onceDurationMs({ frames: 0, frameDuration: 100 }), 100);
});

test("clamp and default trial position stay inside the viewport", () => {
  const viewport = { width: 400, height: 300 };
  const size = { width: 100, height: 100 };
  const def = defaultTrialPosition(size, viewport);
  assert.ok(def.x + size.width <= viewport.width);
  assert.ok(def.y + size.height <= viewport.height);

  const clamped = clampTrialPosition({ x: 9999, y: -40 }, size, viewport);
  assert.equal(clamped.x, viewport.width - size.width - 16);
  assert.equal(clamped.y, 40);
});

test("scale steps clamp to 0..2", () => {
  assert.equal(clampTrialScaleStep(-3), 0);
  assert.equal(clampTrialScaleStep(1), 1);
  assert.equal(clampTrialScaleStep(9), 2);
  assert.equal(trialScaleHeight(1), 112);
});

test("runDirectionFromDelta uses hysteresis", () => {
  assert.equal(runDirectionFromDelta(-5, null), "run-left");
  assert.equal(runDirectionFromDelta(5, null), "run-right");
  assert.equal(runDirectionFromDelta(0, "run-left"), "run-left");
  assert.equal(runDirectionFromDelta(1, "run-right"), "run-right");
});

test("registerClickBurst escalates to multi then resets", () => {
  let burst = { count: 0, lastAt: 0 };
  let result;

  ({ burst, result } = registerClickBurst(burst, 1000));
  assert.equal(result.kind, "single");
  assert.equal(burst.count, 1);

  ({ burst, result } = registerClickBurst(burst, 1100));
  assert.equal(result.kind, "single");
  assert.equal(burst.count, 2);

  ({ burst, result } = registerClickBurst(burst, 1200));
  assert.equal(result.kind, "multi");
  assert.equal(burst.count, 0);

  ({ burst, result } = registerClickBurst(burst, 2000));
  assert.equal(result.kind, "single");
  assert.equal(burst.count, 1);
});

test("nextTapAnimation alternates waving and jumping", () => {
  assert.equal(nextTapAnimation(null), "waving");
  assert.equal(nextTapAnimation("waving"), "jumping");
  assert.equal(nextTapAnimation("jumping"), "waving");
});
