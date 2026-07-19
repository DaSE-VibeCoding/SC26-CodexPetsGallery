import type { DensityMode } from "./types";

const STORAGE_KEY = "sc26-gallery-density";
export const DENSITY_MODES: DensityMode[] = ["cozy", "comfortable", "compact"];

export const DENSITY_LABELS: Record<DensityMode, string> = {
  cozy: "舒适",
  comfortable: "标准",
  compact: "紧凑",
};

export function loadDensity(): DensityMode {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === "cozy" || value === "comfortable" || value === "compact") return value;
  } catch {
    // Ignore storage failures (private mode / blocked storage).
  }
  return "comfortable";
}

export function saveDensity(mode: DensityMode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Ignore storage failures.
  }
}
