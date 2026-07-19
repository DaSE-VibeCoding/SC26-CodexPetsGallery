import { normalizeGroupNumber } from "./gallery-filter";
import {
  drawPetPose,
  drawSlogan,
  isDarkBackground,
  loadPetPoseSource,
  paintForegroundSceneFx,
  paintSceneBackground,
  resolvePhotoNameLabel,
  type PhotoSlot,
} from "./photo-booth";
import { requestImage } from "./media";
import type {
  Pet,
  PhotoBackground,
  PhotoNameMode,
  PhotoSlogan,
} from "./types";

/** Aspect / export preset for the camp memorial photo. */
export type CampAspect = "portrait" | "landscape";

export type CampPhotoSlot = PhotoSlot & {
  petId: string;
  groupKey: string; // "1"…"33" or "none"
  row: number;
  col: number;
};

export const CAMP_ASPECT_OPTIONS: Array<{
  id: CampAspect;
  label: string;
  hint: string;
}> = [
  { id: "portrait", label: "长图", hint: "适合发朋友圈" },
  { id: "landscape", label: "横版 16:9", hint: "高清横图 2560×1440" },
];

/** Design-time canvas sizes (export pixels). */
export const CAMP_STAGE: Record<CampAspect, { width: number; height: number; rows: number }> = {
  // Soft ceiling; actual row count is chosen to maximize pet size while filling the stage.
  // Landscape uses 2560×1440 (~3.7MP) so per-pet pixels stay close to portrait 1600×2400 (~3.8MP).
  portrait: { width: 1600, height: 2400, rows: 14 },
  landscape: { width: 2560, height: 1440, rows: 9 },
};

export const CAMP_ANIM_THRESHOLD = 40;

/**
 * How tall one pet cell is relative to its slot size.
 * Includes sprite body + a little room for the nameplate under the feet.
 */
const CAMP_CELL_RATIO = 1.22;

export const CEREMONY_BACKGROUND_ID = "ceremony";

export function buildDefaultCampSlogan(count: number): PhotoSlogan {
  return {
    text: `VibeCoding夏令营 全营合影留念 · ${count}只`,
    size: 48,
    style: "badge",
    position: "top-center",
    color: "#fef3c7",
  };
}

/** Submissions only, stable order by group then issue/id. */
export function getCampPets(allPets: Pet[]): Pet[] {
  return allPets
    .filter((pet) => pet.kind === "submission")
    .slice()
    .sort(compareCampPets);
}

function compareCampPets(a: Pet, b: Pet) {
  const ga = groupSortKey(a.group);
  const gb = groupSortKey(b.group);
  if (ga !== gb) return ga - gb;

  const ia = a.issueNumber ?? Number.MAX_SAFE_INTEGER;
  const ib = b.issueNumber ?? Number.MAX_SAFE_INTEGER;
  if (ia !== ib) return ia - ib;

  return a.id.localeCompare(b.id);
}

/** 1–33 numeric; ungrouped sorts after 33. */
function groupSortKey(group: unknown) {
  const n = normalizeGroupNumber(group);
  if (!n) return 1000;
  return Number(n);
}

export function groupKeyOf(pet: Pet): string {
  return normalizeGroupNumber(pet.group) ?? "none";
}

function buildRowLengths(count: number, rows: number): number[] {
  // Prefer a nearly-rectangular grid; remainder pets go on the front rows.
  const base = Math.floor(count / rows);
  let extra = count % rows;
  const rowLengths: number[] = [];
  for (let r = 0; r < rows; r += 1) {
    // Front rows (higher index) receive the extras first → fuller front.
    const fromFront = rows - 1 - r;
    const add = fromFront < extra ? 1 : 0;
    rowLengths.push(base + add);
  }
  // Guard: if base was 0, some back rows may be empty — fold into fewer rows at call site.
  return rowLengths;
}

/**
 * Pet size for a candidate grid: limited by cell width and cell height.
 * Rows are non-overlapping and evenly tiled across the stage band.
 */
function estimateCampPetSize(
  fullestRow: number,
  rows: number,
  usableW: number,
  bandH: number,
  aspect: CampAspect,
) {
  // Landscape canvas is wider/taller in pixels; allow larger absolute pet slots.
  const maxSize = aspect === "portrait" ? 260 : 340;
  const minSize = aspect === "portrait" ? 44 : 52;
  // Small horizontal breathing room between neighbors.
  const byWidth = usableW / Math.max(1, fullestRow + 0.08);
  // Each row owns an equal vertical slice; cell must fit body + nameplate.
  const byHeight = bandH / Math.max(1, rows * CAMP_CELL_RATIO);
  return Math.max(minSize, Math.min(maxSize, byWidth, byHeight));
}

/**
 * Multi-row graduation layout with soft group clustering.
 * Pets are already expected in group order (use getCampPets).
 *
 * Goals:
 * - Maximize pet size (search row count)
 * - Fill the usable stage evenly (no bottom clustering, no huge empty bands)
 * - No row stagger / no intentional overlap
 */
export function layoutCampSlots(
  pets: Pet[],
  width: number,
  height: number,
  aspect: CampAspect,
): CampPhotoSlot[] {
  const count = pets.length;
  if (count <= 0) return [];

  const preset = CAMP_STAGE[aspect];
  // Leave room for slogan (top) and watermark (bottom), but keep the cast band large.
  const topPad = height * (aspect === "portrait" ? 0.1 : 0.12);
  const bottomPad = height * (aspect === "portrait" ? 0.06 : 0.08);
  const bandH = Math.max(120, height - topPad - bottomPad);
  const sidePad = width * (aspect === "portrait" ? 0.03 : 0.028);
  const usableW = width - sidePad * 2;

  const minRows = count >= 3 ? 2 : 1;
  const maxRows = Math.min(preset.rows, count);

  let bestRows = minRows;
  let bestSize = 0;
  let bestLengths = buildRowLengths(count, minRows);

  for (let rows = minRows; rows <= maxRows; rows += 1) {
    const rowLengths = buildRowLengths(count, rows);
    if (rowLengths.some((n) => n <= 0)) continue;
    const fullest = Math.max(...rowLengths);
    // Skip pathological single-file columns when we still have row budget.
    if (fullest < 2 && count >= 6 && rows < maxRows) continue;

    const size = estimateCampPetSize(fullest, rows, usableW, bandH, aspect);
    // Prefer larger pets; slight bias toward more rows when sizes are within 1px
    // so the grid stays closer to square and fills the stage more evenly.
    const betterSize = size > bestSize + 0.5;
    const similarButFuller =
      Math.abs(size - bestSize) <= 0.5
      && Math.abs(fullest - rows) < Math.abs(Math.max(...bestLengths) - bestRows);
    if (betterSize || similarButFuller) {
      bestSize = size;
      bestRows = rows;
      bestLengths = rowLengths;
    }
  }

  const rows = bestRows;
  const size = bestSize;
  const cellH = bandH / rows;

  // Back row is index 0; front row is last. Feet sit near the bottom of each equal cell.
  const slots: CampPhotoSlot[] = [];
  let petIndex = 0;

  for (let row = 0; row < rows; row += 1) {
    const n = bestLengths[row];
    // Very mild perspective only — back row a touch smaller, still aligned.
    const depth = rows === 1 ? 1 : 0.94 + (row / Math.max(1, rows - 1)) * 0.06;
    const rowSize = size * depth;

    // Even vertical tiles: each row gets the same band slice.
    // Feet baseline sits in the lower portion of the cell so the body fills upward.
    const cellTop = topPad + row * cellH;
    const rowY = cellTop + cellH * 0.82;

    // Center the row horizontally; no stagger.
    const gap = rowSize * 0.02;
    const step = rowSize + gap;
    const totalW = n * rowSize + Math.max(0, n - 1) * gap;
    const startX = (width - totalW) / 2 + rowSize / 2;

    for (let col = 0; col < n; col += 1) {
      const pet = pets[petIndex];
      if (!pet) break;
      const x = startX + col * step;
      const y = rowY;
      slots.push({
        x,
        y,
        size: rowSize,
        rx: x / width,
        ry: y / height,
        rsize: rowSize / width,
        petId: pet.id,
        groupKey: groupKeyOf(pet),
        row,
        col,
      });
      petIndex += 1;
    }
  }

  return slots;
}

/** Stable pastel carpet color for a group key. */
export function groupCarpetColor(groupKey: string, alpha = 0.28): string {
  if (groupKey === "none") return `rgba(148, 163, 184, ${alpha})`;
  const n = Number(groupKey) || 0;
  const hue = (n * 47 + 18) % 360;
  return `hsla(${hue}, 62%, 62%, ${alpha})`;
}

function paintGroupCarpets(
  ctx: CanvasRenderingContext2D,
  pets: Pet[],
  slots: CampPhotoSlot[],
) {
  // Cluster consecutive same-group slots and draw one soft ellipse under each run per row.
  type Run = { groupKey: string; xs: number[]; y: number; size: number };
  const runs: Run[] = [];

  let current: Run | null = null;
  for (let i = 0; i < slots.length; i += 1) {
    const slot = slots[i];
    const key = slot.groupKey;
    if (
      current
      && current.groupKey === key
      && Math.abs(current.y - slot.y) < slot.size * 0.35
    ) {
      current.xs.push(slot.x);
      current.size = Math.max(current.size, slot.size);
    } else {
      if (current) runs.push(current);
      current = { groupKey: key, xs: [slot.x], y: slot.y, size: slot.size };
    }
  }
  if (current) runs.push(current);

  for (const run of runs) {
    const minX = Math.min(...run.xs);
    const maxX = Math.max(...run.xs);
    const cx = (minX + maxX) / 2;
    const rx = (maxX - minX) / 2 + run.size * 0.55;
    const ry = run.size * 0.22;
    const cy = run.y + run.size * 0.02;

    ctx.save();
    const grad = ctx.createRadialGradient(cx, cy, ry * 0.2, cx, cy, rx);
    grad.addColorStop(0, groupCarpetColor(run.groupKey, 0.38));
    grad.addColorStop(0.7, groupCarpetColor(run.groupKey, 0.18));
    grad.addColorStop(1, groupCarpetColor(run.groupKey, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  void pets;
}

/** Extra memorial chrome: frame, corner seals, stage lip polish. */
function paintCampChrome(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  dark: boolean,
) {
  // Inner frame
  ctx.save();
  ctx.strokeStyle = dark ? "rgba(251, 191, 36, 0.35)" : "rgba(15, 23, 42, 0.12)";
  ctx.lineWidth = Math.max(3, width * 0.004);
  const inset = Math.max(18, width * 0.018);
  ctx.strokeRect(inset, inset, width - inset * 2, height - inset * 2);

  // Double thin gold line for ceremony feel
  ctx.strokeStyle = dark ? "rgba(253, 224, 71, 0.18)" : "rgba(59, 130, 246, 0.12)";
  ctx.lineWidth = 1.5;
  const inset2 = inset + 8;
  ctx.strokeRect(inset2, inset2, width - inset2 * 2, height - inset2 * 2);

  // Corner ornaments
  const arm = Math.max(28, width * 0.028);
  ctx.strokeStyle = dark ? "rgba(251, 191, 36, 0.55)" : "rgba(37, 99, 235, 0.35)";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  const corners: Array<[number, number, number, number]> = [
    [inset, inset, 1, 1],
    [width - inset, inset, -1, 1],
    [inset, height - inset, 1, -1],
    [width - inset, height - inset, -1, -1],
  ];
  for (const [x, y, dx, dy] of corners) {
    ctx.beginPath();
    ctx.moveTo(x, y + dy * arm);
    ctx.lineTo(x, y);
    ctx.lineTo(x + dx * arm, y);
    ctx.stroke();
  }

  ctx.restore();
}

function paintNameplate(
  ctx: CanvasRenderingContext2D,
  label: string,
  slot: CampPhotoSlot,
  dark: boolean,
) {
  // Hide plates that would be illegible when the cast is dense.
  if (slot.size < 36) return;

  // Scale type with pet size; keep a readable floor without blowing past the body.
  const fontSize = Math.max(8, Math.min(20, Math.round(slot.size * 0.145)));
  ctx.font = `600 ${fontSize}px "Segoe UI", "PingFang SC", "Microsoft YaHei UI", sans-serif`;
  const textWidth = ctx.measureText(label).width;
  const maxW = slot.size * (slot.size < 64 ? 1.35 : 1.2);
  let drawLabel = label;
  if (textWidth > maxW) {
    // Truncate with ellipsis
    while (drawLabel.length > 1 && ctx.measureText(`${drawLabel}…`).width > maxW) {
      drawLabel = drawLabel.slice(0, -1);
    }
    drawLabel = `${drawLabel}…`;
  }

  const finalW = ctx.measureText(drawLabel).width;
  const padX = Math.max(5, fontSize * 0.5);
  const boxW = finalW + padX * 2;
  const boxH = Math.max(12, fontSize + Math.round(fontSize * 0.55));
  const boxX = slot.x - boxW / 2;
  const boxY = slot.y + Math.max(2, Math.round(slot.size * 0.02));

  ctx.fillStyle = dark ? "rgba(15,23,42,0.62)" : "rgba(255,255,255,0.92)";
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, 999);
  ctx.fill();
  ctx.fillStyle = dark ? "#f8fafc" : "#141816";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(drawLabel, slot.x, boxY + boxH / 2 + 0.5);
}

export async function composeCampPhoto({
  pets,
  background,
  nameMode = "hidden",
  slogan,
  aspect = "portrait",
  showGroupCarpets = false,
  poseByPetId,
  width: widthOverride,
  height: heightOverride,
}: {
  pets: Pet[];
  background: PhotoBackground;
  nameMode?: PhotoNameMode;
  slogan?: PhotoSlogan;
  aspect?: CampAspect;
  showGroupCarpets?: boolean;
  poseByPetId?: Record<string, number | undefined>;
  width?: number;
  height?: number;
}) {
  if (pets.length === 0) {
    throw new Error("还没有宠物可以合影");
  }

  const preset = CAMP_STAGE[aspect];
  const width = widthOverride ?? preset.width;
  const height = heightOverride ?? preset.height;
  const resolvedSlogan = slogan ?? buildDefaultCampSlogan(pets.length);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建画布");

  let bgImage: HTMLImageElement | null = null;
  if (background.type === "image") {
    bgImage = await requestImage(background.src, {
      anonymous: background.src.startsWith("http"),
    });
  }
  paintSceneBackground(ctx, background, width, height, bgImage);

  const ordered = pets.slice().sort(compareCampPets);
  const slots = layoutCampSlots(ordered, width, height, aspect);

  if (showGroupCarpets) {
    paintGroupCarpets(ctx, ordered, slots);
  }

  const poses = await Promise.all(
    ordered.map((pet) => loadPetPoseSource(pet, poseByPetId?.[pet.id])),
  );

  const dark = isDarkBackground(background);

  poses.forEach((pose, index) => {
    const slot = slots[index];
    if (!slot) return;
    drawPetPose(ctx, pose, slot);

    const label = resolvePhotoNameLabel(ordered[index], nameMode);
    if (label) paintNameplate(ctx, label, slot, dark);
  });

  paintForegroundSceneFx(ctx, background, width, height);
  paintCampChrome(ctx, width, height, dark);
  drawSlogan(ctx, resolvedSlogan, width, height, dark);

  // Distinct memorial watermark
  ctx.fillStyle = dark ? "rgba(254, 243, 199, 0.55)" : "rgba(20, 24, 22, 0.45)";
  ctx.font = '600 18px "Segoe UI", "PingFang SC", sans-serif';
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("VibeCoding 夏令营 · 全营纪念", 36, height - 28);

  ctx.textAlign = "right";
  ctx.fillText(`${ordered.length} 只宠物`, width - 36, height - 28);

  return canvas;
}

export function campSlotHitTest(
  slots: CampPhotoSlot[],
  nx: number,
  ny: number,
): CampPhotoSlot | null {
  // nx/ny are normalized 0–1 in stage space. Prefer front rows (higher index).
  for (let i = slots.length - 1; i >= 0; i -= 1) {
    const slot = slots[i];
    const half = slot.rsize / 2;
    const top = slot.ry - slot.rsize * 1.05;
    const bottom = slot.ry + slot.rsize * 0.15;
    if (nx >= slot.rx - half && nx <= slot.rx + half && ny >= top && ny <= bottom) {
      return slot;
    }
  }
  return null;
}
