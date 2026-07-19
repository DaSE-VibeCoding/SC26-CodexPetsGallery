import type { Pet, SortMode } from "./types";

const STORAGE_KEY = "sc26-gallery-sort";

export const SORT_MODES: SortMode[] = ["newest", "oldest", "random"];

export const SORT_LABELS: Record<SortMode, string> = {
  newest: "最新",
  oldest: "最旧",
  random: "随机",
};

export const SORT_HINTS: Record<SortMode, string> = {
  newest: "按 Issue 上传时间，最新在前",
  oldest: "按 Issue 上传时间，最旧在前",
  random: "打乱顺序浏览",
};

export function loadSortMode(): SortMode {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === "newest" || value === "oldest" || value === "random") return value;
  } catch {
    // Ignore storage failures (private mode / blocked storage).
  }
  return "newest";
}

export function saveSortMode(mode: SortMode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Ignore storage failures.
  }
}

function petCreatedTime(pet: Pet): number {
  return Date.parse(pet.createdAt ?? pet.updatedAt ?? "") || 0;
}

/** Mulberry32 — small deterministic PRNG for stable random order across re-renders. */
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWithSeed<T>(items: T[], seed: number): T[] {
  const next = [...items];
  const random = mulberry32(seed || 1);
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function compareByCreatedAt(left: Pet, right: Pet, direction: "newest" | "oldest") {
  const leftTime = petCreatedTime(left);
  const rightTime = petCreatedTime(right);
  if (rightTime !== leftTime) {
    return direction === "newest" ? rightTime - leftTime : leftTime - rightTime;
  }
  const leftIssue = left.issueNumber ?? 0;
  const rightIssue = right.issueNumber ?? 0;
  return direction === "newest" ? rightIssue - leftIssue : leftIssue - rightIssue;
}

/**
 * Sort gallery pets. Submissions follow the chosen mode; official examples stay after
 * submissions so they never push real uploads off the first page.
 */
export function sortPets(pets: Pet[], mode: SortMode, randomSeed = 1): Pet[] {
  const submissions = pets.filter((pet) => pet.kind === "submission");
  const examples = pets.filter((pet) => pet.kind !== "submission");

  if (mode === "random") {
    return [
      ...shuffleWithSeed(submissions, randomSeed),
      ...shuffleWithSeed(examples, randomSeed ^ 0x9e3779b9),
    ];
  }

  const sorted = [...submissions].sort((left, right) => compareByCreatedAt(left, right, mode));
  return [...sorted, ...examples];
}
