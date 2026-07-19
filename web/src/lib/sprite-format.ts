export const BASE_SPRITE_STATES = [
  { id: "idle", label: "待机", row: 0, frames: 6, frameDuration: 180, description: "安静呼吸和眨眼。" },
  { id: "run-right", label: "向右跑", row: 1, frames: 8, frameDuration: 90, description: "向右侧快速移动。" },
  { id: "run-left", label: "向左跑", row: 2, frames: 8, frameDuration: 90, description: "向左侧快速移动。" },
  { id: "waving", label: "招手", row: 3, frames: 4, frameDuration: 170, description: "停下来向你打招呼。" },
  { id: "jumping", label: "跳跃", row: 4, frames: 5, frameDuration: 130, description: "开心地跳起来。" },
  { id: "failed", label: "失败", row: 5, frames: 8, frameDuration: 170, description: "遇到挫折后的反应。" },
  { id: "waiting", label: "等待", row: 6, frames: 6, frameDuration: 190, description: "在原地耐心等待。" },
  { id: "running", label: "处理中", row: 7, frames: 6, frameDuration: 100, description: "任务正在执行、思考或处理。" },
  { id: "review", label: "审阅", row: 8, frames: 6, frameDuration: 170, description: "认真检查当前任务。" },
] as const;

const KNOWN_FORMATS = new Map([
  ["1536x1872", { version: "v1", columns: 8, rows: 9 }],
  ["1536x2288", { version: "v2", columns: 8, rows: 11 }],
]);
const BASIC_STATE_ROWS = 9;

import type { SpriteGrid, SpriteState } from "./types";

export function normalizeSpriteGrid(value: Partial<SpriteGrid> | Record<string, unknown> = {}): SpriteGrid {
  const raw = value as Partial<SpriteGrid>;
  const rows = Number(raw.rows) || (raw.formatVersion === "v2" ? 11 : 9);
  const providedStates = Array.isArray(raw.states) && raw.states.length > 0
    ? raw.states
    : [...BASE_SPRITE_STATES];
  const states = providedStates
    .filter((state) => Number(state.row) < BASIC_STATE_ROWS)
    .map((state) => ({ ...state })) as SpriteState[];
  const requestedDefault = raw.defaultState || "idle";
  const defaultState = states.some((state) => state.id === requestedDefault)
    ? requestedDefault
    : states.find((state) => state.id === "idle")?.id ?? states[0]?.id ?? "idle";

  return {
    formatVersion: raw.formatVersion || (rows === 11 ? "v2" : "v1"),
    columns: Number(raw.columns) || 8,
    rows,
    defaultState,
    states,
  };
}

export function validateSpriteGrid(grid: SpriteGrid | null | undefined): grid is SpriteGrid {
  if (!Number.isInteger(grid?.columns) || (grid?.columns ?? 0) < 1) return false;
  if (!Number.isInteger(grid?.rows) || (grid?.rows ?? 0) < 1) return false;
  if (!Array.isArray(grid.states) || grid.states.length === 0) return false;
  if (!grid.states.some((state) => state.id === grid.defaultState)) return false;

  return grid.states.every((state) => (
    typeof state.id === "string"
    && typeof state.label === "string"
    && Number.isInteger(state.row)
    && state.row >= 0
    && state.row < grid.rows
    && Number.isInteger(state.frames)
    && state.frames >= 1
    && state.frames <= grid.columns
    && Number(state.frameDuration) > 0
  ));
}

export function resolveSpriteLayout(
  image: { naturalWidth: number; naturalHeight: number },
  grid: SpriteGrid,
) {
  const known = KNOWN_FORMATS.get(`${image.naturalWidth}x${image.naturalHeight}`);
  const columns = known?.columns ?? grid.columns;
  const rows = known?.rows ?? grid.rows;

  if (!Number.isInteger(columns) || !Number.isInteger(rows) || columns < 1 || rows < 1) {
    throw new Error("宠物图网格配置无效");
  }
  if (image.naturalWidth % columns !== 0 || image.naturalHeight % rows !== 0) {
    throw new Error("宠物图尺寸与网格配置不匹配");
  }

  return {
    version: known?.version ?? grid.formatVersion ?? "custom",
    columns,
    rows,
    frameWidth: image.naturalWidth / columns,
    frameHeight: image.naturalHeight / rows,
  };
}
