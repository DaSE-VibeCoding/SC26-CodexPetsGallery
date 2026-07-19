import type {
  PhotoBackground,
  PhotoNameMode,
  PhotoSceneFx,
  PhotoSlogan,
  Pet,
  SloganPosition,
  SloganStyle,
  SpriteGrid,
  SpriteState,
} from "./types";
import { getDefaultState, getFrameSize, requestImage, safeExternalUrl } from "./media";

export const PHOTO_MIN = 1;
export const PHOTO_MAX = 12;

/**
 * Built-in atmospheres for the photo booth.
 * Each preset is intentionally distinct: color story + décor + weather particles.
 *
 * Rename map from older builds:
 *   cloud  → snow  (霁雪)
 *   rose   → sakura (樱雨)
 *   night  → starry (星漩 · 梵高式)
 *   lavender removed → neon-rain (霓窗)
 */
export const PHOTO_BACKGROUNDS: PhotoBackground[] = [
  {
    id: "sky",
    label: "晴空",
    type: "gradient",
    from: "#e0f2fe",
    mid: "#bae6fd",
    to: "#7dd3fc",
    accent: "#38bdf8",
    fx: "sunny",
  },
  {
    id: "snow",
    label: "霁雪",
    type: "gradient",
    from: "#f8fafc",
    mid: "#e2e8f0",
    to: "#cbd5e1",
    accent: "#94a3b8",
    fx: "snow",
  },
  {
    id: "mint",
    label: "薄荷",
    type: "gradient",
    from: "#ecfdf5",
    mid: "#a7f3d0",
    to: "#6ee7b7",
    accent: "#34d399",
    fx: "mint",
  },
  {
    id: "sunset",
    label: "暮色",
    type: "gradient",
    from: "#fff7ed",
    mid: "#fdba74",
    to: "#fb923c",
    accent: "#f97316",
    fx: "dusk",
  },
  {
    id: "neon-rain",
    label: "霓窗",
    type: "gradient",
    from: "#0b1026",
    mid: "#1a1140",
    to: "#2a0f3a",
    accent: "#f472b6",
    dark: true,
    fx: "neon-rain",
  },
  {
    id: "starry",
    label: "星漩",
    type: "gradient",
    from: "#0b1b3a",
    mid: "#1e3a6e",
    to: "#0f172a",
    accent: "#fbbf24",
    dark: true,
    fx: "starry",
  },
  {
    id: "sakura",
    label: "樱雨",
    type: "gradient",
    from: "#fff1f5",
    mid: "#fecdd3",
    to: "#fda4af",
    accent: "#fb7185",
    fx: "sakura",
  },
  {
    id: "ceremony",
    label: "典礼",
    type: "gradient",
    from: "#1e1b4b",
    mid: "#4c1d95",
    to: "#7c3aed",
    accent: "#fbbf24",
    dark: true,
    fx: "ceremony",
  },
];

export const DEFAULT_SLOGAN: PhotoSlogan = {
  text: "SC26 宠物合影",
  size: 42,
  style: "badge",
  position: "top-center",
  color: "#0f172a",
};

export const SLOGAN_STYLE_OPTIONS: Array<{ id: SloganStyle; label: string }> = [
  { id: "plain", label: "纯字" },
  { id: "badge", label: "胶囊" },
  { id: "outline", label: "描边" },
  { id: "glow", label: "光晕" },
];

export const SLOGAN_POSITION_OPTIONS: Array<{ id: SloganPosition; label: string }> = [
  { id: "top-left", label: "左上" },
  { id: "top-center", label: "上中" },
  { id: "top-right", label: "右上" },
  { id: "center", label: "居中" },
  { id: "bottom-left", label: "左下" },
  { id: "bottom-center", label: "下中" },
  { id: "bottom-right", label: "右下" },
];

export const PHOTO_NAME_MODE_OPTIONS: Array<{ id: PhotoNameMode; label: string; hint: string }> = [
  { id: "hidden", label: "不显示", hint: "宠物脚下不显示文字" },
  { id: "pet", label: "宠物名", hint: "显示宠物名称" },
  { id: "github", label: "GitHub", hint: "显示作者的 GitHub 用户名" },
  { id: "nickname", label: "创作昵称", hint: "显示作者昵称" },
];

/** Resolve the nameplate text for a pet under the selected mode. */
export function resolvePhotoNameLabel(pet: Pet, mode: PhotoNameMode): string | null {
  if (mode === "hidden") return null;

  if (mode === "github") {
    const login = pet.githubLogin?.trim();
    if (login) return login;
    // Examples / missing login: fall back so the plate still has meaning.
    return pet.nickname?.trim() || pet.petName;
  }

  if (mode === "nickname") {
    const nick = pet.nickname?.trim();
    if (nick) return nick;
    return pet.githubLogin?.trim() || pet.petName;
  }

  // pet name
  return pet.petName?.trim() || pet.nickname?.trim() || pet.githubLogin?.trim() || "未命名";
}

export type PhotoSlot = {
  x: number;
  y: number;
  size: number;
  /** 0–1 relative coordinates for live CSS stage */
  rx: number;
  ry: number;
  rsize: number;
};

export function layoutSlots(count: number, width: number, height: number): PhotoSlot[] {
  const groundY = height * 0.78;
  if (count <= 0) return [];

  const toSlot = (x: number, y: number, size: number): PhotoSlot => ({
    x,
    y,
    size,
    rx: x / width,
    ry: y / height,
    rsize: size / width,
  });

  if (count <= 5) {
    const size = Math.min(210, width / (count + 0.8));
    const total = count * size;
    const startX = (width - total) / 2 + size / 2;
    return Array.from({ length: count }, (_, index) =>
      toSlot(startX + index * size, groundY, size),
    );
  }

  const topCount = Math.ceil(count / 2);
  const bottomCount = count - topCount;
  const topSize = Math.min(170, width / (topCount + 0.9));
  const bottomSize = Math.min(190, width / (bottomCount + 0.8));
  const topY = groundY - topSize * 0.72;
  const bottomY = groundY + 8;
  const topStart = (width - topCount * topSize) / 2 + topSize / 2;
  const bottomStart = (width - bottomCount * bottomSize) / 2 + bottomSize / 2;

  return [
    ...Array.from({ length: topCount }, (_, index) =>
      toSlot(topStart + index * topSize, topY, topSize),
    ),
    ...Array.from({ length: bottomCount }, (_, index) =>
      toSlot(bottomStart + index * bottomSize, bottomY, bottomSize),
    ),
  ];
}

export function isDarkBackground(background: PhotoBackground) {
  if (background.type !== "gradient") return false;
  if (background.dark) return true;
  // Backward-compatible fallback for any leftover night id.
  return background.id === "night" || background.id === "starry" || background.id === "neon-rain";
}

export function resolveSceneFx(background: PhotoBackground): PhotoSceneFx | null {
  if (background.type !== "gradient") return null;
  if (background.fx) return background.fx;
  // Legacy ids
  if (background.id === "cloud") return "snow";
  if (background.id === "rose") return "sakura";
  if (background.id === "night") return "starry";
  if (background.id === "lavender") return "neon-rain";
  if (background.id === "sky") return "sunny";
  if (background.id === "mint") return "mint";
  if (background.id === "sunset") return "dusk";
  return null;
}

/** Deterministic pseudo-random in [0,1) from integer seed. */
function unit(seed: number) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function paintBaseGradient(
  ctx: CanvasRenderingContext2D,
  background: Extract<PhotoBackground, { type: "gradient" }>,
  width: number,
  height: number,
) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, background.from);
  if (background.mid) gradient.addColorStop(0.48, background.mid);
  gradient.addColorStop(1, background.to);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function paintGround(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  dark: boolean,
  tint?: string,
) {
  const ground = ctx.createLinearGradient(0, height * 0.58, 0, height);
  ground.addColorStop(0, "rgba(255,255,255,0)");
  ground.addColorStop(1, tint ?? (dark ? "rgba(0,0,0,0.42)" : "rgba(20,24,22,0.14)"));
  ctx.fillStyle = ground;
  ctx.fillRect(0, height * 0.58, width, height * 0.42);
}

function paintSoftOrb(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string,
  alpha: number,
) {
  ctx.save();
  const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function paintCloud(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  alpha: number,
  color = "rgba(255,255,255,0.92)",
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, 72 * scale, 28 * scale, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 46 * scale, y + 6 * scale, 48 * scale, 22 * scale, 0, 0, Math.PI * 2);
  ctx.ellipse(x - 42 * scale, y + 8 * scale, 44 * scale, 20 * scale, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 10 * scale, y - 16 * scale, 36 * scale, 24 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function paintSun(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
) {
  // Outer glow
  paintSoftOrb(ctx, x, y, r * 2.4, r * 2.4, "rgba(253, 224, 71, 0.55)", 0.85);
  // Core
  const core = ctx.createRadialGradient(x - r * 0.2, y - r * 0.2, r * 0.1, x, y, r);
  core.addColorStop(0, "#fffbeb");
  core.addColorStop(0.55, "#fde047");
  core.addColorStop(1, "#f59e0b");
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  // Soft rays
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = "rgba(253, 224, 71, 0.35)";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 1.25, Math.sin(a) * r * 1.25);
    ctx.lineTo(Math.cos(a) * r * 1.7, Math.sin(a) * r * 1.7);
    ctx.stroke();
  }
  ctx.restore();
}

function paintBirds(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.save();
  ctx.strokeStyle = "rgba(30, 58, 138, 0.35)";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  const flock = [
    [0.62, 0.22],
    [0.66, 0.25],
    [0.7, 0.21],
    [0.74, 0.26],
    [0.78, 0.23],
  ];
  for (const [rx, ry] of flock) {
    const x = width * rx;
    const y = height * ry;
    const s = 10 + unit(Math.floor(x + y)) * 6;
    ctx.beginPath();
    ctx.moveTo(x - s, y);
    ctx.quadraticCurveTo(x - s * 0.3, y - s * 0.55, x, y);
    ctx.quadraticCurveTo(x + s * 0.3, y - s * 0.55, x + s, y);
    ctx.stroke();
  }
  ctx.restore();
}

function paintSunnyScene(
  ctx: CanvasRenderingContext2D,
  bg: Extract<PhotoBackground, { type: "gradient" }>,
  width: number,
  height: number,
) {
  paintBaseGradient(ctx, bg, width, height);
  paintSoftOrb(ctx, width * 0.18, height * 0.2, 180, 120, "rgba(125, 211, 252, 0.55)", 0.55);
  paintSoftOrb(ctx, width * 0.82, height * 0.16, 200, 130, "rgba(56, 189, 248, 0.4)", 0.45);
  paintSun(ctx, width * 0.82, height * 0.18, 58);
  paintCloud(ctx, width * 0.18, height * 0.2, 1.15, 0.72);
  paintCloud(ctx, width * 0.42, height * 0.12, 0.85, 0.55);
  paintCloud(ctx, width * 0.58, height * 0.28, 0.7, 0.4);
  // Soft meadow ground
  paintGround(ctx, width, height, false, "rgba(34, 197, 94, 0.12)");
  // Light sparkles
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  for (let i = 0; i < 18; i += 1) {
    const x = unit(i * 17 + 3) * width;
    const y = unit(i * 29 + 5) * height * 0.55;
    const r = 0.8 + unit(i * 7) * 1.8;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  paintBirds(ctx, width, height);
}

function paintSnowScene(
  ctx: CanvasRenderingContext2D,
  bg: Extract<PhotoBackground, { type: "gradient" }>,
  width: number,
  height: number,
) {
  paintBaseGradient(ctx, bg, width, height);
  // Cool blue ambient
  paintSoftOrb(ctx, width * 0.25, height * 0.18, 220, 140, "rgba(186, 230, 253, 0.55)", 0.55);
  paintSoftOrb(ctx, width * 0.78, height * 0.22, 180, 120, "rgba(148, 163, 184, 0.4)", 0.4);

  // Soft winter sun
  paintSoftOrb(ctx, width * 0.78, height * 0.16, 90, 90, "rgba(254, 243, 199, 0.7)", 0.7);
  const sun = ctx.createRadialGradient(width * 0.78, height * 0.16, 4, width * 0.78, height * 0.16, 36);
  sun.addColorStop(0, "rgba(255,255,255,0.95)");
  sun.addColorStop(1, "rgba(253, 230, 138, 0)");
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(width * 0.78, height * 0.16, 36, 0, Math.PI * 2);
  ctx.fill();

  // Distant pine silhouettes
  ctx.save();
  for (let i = 0; i < 9; i += 1) {
    const x = width * (0.05 + i * 0.11);
    const baseY = height * 0.72;
    const h = 70 + unit(i * 13) * 90;
    const w = 28 + unit(i * 19) * 22;
    ctx.fillStyle = `rgba(71, 85, 105, ${0.18 + unit(i * 5) * 0.18})`;
    ctx.beginPath();
    ctx.moveTo(x, baseY - h);
    ctx.lineTo(x + w, baseY);
    ctx.lineTo(x - w, baseY);
    ctx.closePath();
    ctx.fill();
    // Mid layer
    ctx.beginPath();
    ctx.moveTo(x, baseY - h * 0.7);
    ctx.lineTo(x + w * 0.85, baseY - h * 0.25);
    ctx.lineTo(x - w * 0.85, baseY - h * 0.25);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Snow bank ground
  const bank = ctx.createLinearGradient(0, height * 0.62, 0, height);
  bank.addColorStop(0, "rgba(248,250,252,0)");
  bank.addColorStop(0.35, "rgba(248,250,252,0.55)");
  bank.addColorStop(1, "rgba(226,232,240,0.92)");
  ctx.fillStyle = bank;
  ctx.beginPath();
  ctx.moveTo(0, height * 0.72);
  ctx.quadraticCurveTo(width * 0.25, height * 0.66, width * 0.5, height * 0.72);
  ctx.quadraticCurveTo(width * 0.75, height * 0.78, width, height * 0.7);
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fill();

  // Falling snow (static frame for export)
  for (let i = 0; i < 110; i += 1) {
    const x = unit(i * 11 + 2) * width;
    const y = unit(i * 23 + 7) * height;
    const r = 1.1 + unit(i * 31) * 3.2;
    const a = 0.35 + unit(i * 41) * 0.55;
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    // Soft halo on larger flakes
    if (r > 2.6) {
      ctx.fillStyle = `rgba(255,255,255,${a * 0.25})`;
      ctx.beginPath();
      ctx.arc(x, y, r * 2.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function paintMintScene(
  ctx: CanvasRenderingContext2D,
  bg: Extract<PhotoBackground, { type: "gradient" }>,
  width: number,
  height: number,
) {
  paintBaseGradient(ctx, bg, width, height);
  paintSoftOrb(ctx, width * 0.2, height * 0.22, 200, 140, "rgba(167, 243, 208, 0.7)", 0.55);
  paintSoftOrb(ctx, width * 0.8, height * 0.18, 180, 120, "rgba(52, 211, 153, 0.45)", 0.4);

  // Soft leaf blobs
  ctx.save();
  for (let i = 0; i < 14; i += 1) {
    const x = unit(i * 17 + 1) * width;
    const y = unit(i * 29 + 3) * height * 0.7;
    const s = 10 + unit(i * 7) * 22;
    const rot = unit(i * 13) * Math.PI;
    ctx.globalAlpha = 0.18 + unit(i * 5) * 0.22;
    ctx.fillStyle = i % 2 === 0 ? "#34d399" : "#6ee7b7";
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.ellipse(0, 0, s, s * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  ctx.restore();

  // Dew droplets
  for (let i = 0; i < 24; i += 1) {
    const x = unit(i * 19 + 4) * width;
    const y = unit(i * 37 + 8) * height * 0.65;
    const r = 1.2 + unit(i * 11) * 2.4;
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
    g.addColorStop(0, "rgba(255,255,255,0.9)");
    g.addColorStop(0.55, "rgba(167, 243, 208, 0.55)");
    g.addColorStop(1, "rgba(52, 211, 153, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Soft meadow
  paintGround(ctx, width, height, false, "rgba(16, 185, 129, 0.16)");
  // Firefly dots
  ctx.fillStyle = "rgba(253, 224, 71, 0.55)";
  for (let i = 0; i < 16; i += 1) {
    const x = unit(i * 41 + 2) * width;
    const y = height * (0.45 + unit(i * 17) * 0.4);
    const r = 1.2 + unit(i * 9) * 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintDuskScene(
  ctx: CanvasRenderingContext2D,
  bg: Extract<PhotoBackground, { type: "gradient" }>,
  width: number,
  height: number,
) {
  // Warm multi-stop sky
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#1e1b4b");
  sky.addColorStop(0.22, "#7c3aed");
  sky.addColorStop(0.48, bg.mid ?? "#fdba74");
  sky.addColorStop(0.72, bg.to);
  sky.addColorStop(1, "#fb923c");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  // Setting sun
  paintSoftOrb(ctx, width * 0.72, height * 0.42, 160, 120, "rgba(251, 146, 60, 0.55)", 0.9);
  paintSoftOrb(ctx, width * 0.72, height * 0.42, 70, 70, "rgba(254, 243, 199, 0.9)", 0.95);
  const sun = ctx.createRadialGradient(width * 0.72, height * 0.42, 4, width * 0.72, height * 0.42, 48);
  sun.addColorStop(0, "#fff7ed");
  sun.addColorStop(0.5, "#fdba74");
  sun.addColorStop(1, "rgba(249, 115, 22, 0)");
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(width * 0.72, height * 0.42, 48, 0, Math.PI * 2);
  ctx.fill();

  // Horizon haze bands
  for (let i = 0; i < 5; i += 1) {
    const y = height * (0.48 + i * 0.05);
    const band = ctx.createLinearGradient(0, y, 0, y + 24);
    band.addColorStop(0, `rgba(255, 237, 213, ${0.08 + i * 0.03})`);
    band.addColorStop(1, "rgba(255,237,213,0)");
    ctx.fillStyle = band;
    ctx.fillRect(0, y, width, 28);
  }

  // Silhouette hills
  ctx.fillStyle = "rgba(67, 20, 7, 0.45)";
  ctx.beginPath();
  ctx.moveTo(0, height * 0.72);
  ctx.quadraticCurveTo(width * 0.2, height * 0.58, width * 0.42, height * 0.7);
  ctx.quadraticCurveTo(width * 0.62, height * 0.8, width, height * 0.64);
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(28, 11, 8, 0.55)";
  ctx.beginPath();
  ctx.moveTo(0, height * 0.8);
  ctx.quadraticCurveTo(width * 0.3, height * 0.7, width * 0.55, height * 0.82);
  ctx.quadraticCurveTo(width * 0.78, height * 0.9, width, height * 0.76);
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fill();

  // Early stars
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  for (let i = 0; i < 22; i += 1) {
    const x = unit(i * 13 + 1) * width;
    const y = unit(i * 19 + 4) * height * 0.38;
    const r = 0.6 + unit(i * 7) * 1.4;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintNeonRainScene(
  ctx: CanvasRenderingContext2D,
  bg: Extract<PhotoBackground, { type: "gradient" }>,
  width: number,
  height: number,
) {
  paintBaseGradient(ctx, bg, width, height);

  // Distant neon city bokeh
  const bokehColors = [
    "rgba(244, 114, 182, 0.55)", // pink
    "rgba(56, 189, 248, 0.5)", // cyan
    "rgba(167, 139, 250, 0.5)", // violet
    "rgba(251, 191, 36, 0.4)", // amber
    "rgba(52, 211, 153, 0.4)", // mint
    "rgba(248, 113, 113, 0.45)", // coral
  ];
  for (let i = 0; i < 42; i += 1) {
    const x = unit(i * 17 + 3) * width;
    const y = height * (0.28 + unit(i * 23 + 5) * 0.55);
    const r = 8 + unit(i * 11) * 36;
    const color = bokehColors[i % bokehColors.length];
    paintSoftOrb(ctx, x, y, r, r, color, 0.55 + unit(i * 7) * 0.35);
  }

  // Soft city skyline suggestion
  ctx.fillStyle = "rgba(5, 8, 22, 0.55)";
  for (let i = 0; i < 18; i += 1) {
    const x = (i / 18) * width;
    const w = width / 16;
    const h = height * (0.12 + unit(i * 29) * 0.28);
    ctx.fillRect(x, height * 0.72 - h, w * 0.85, h + height * 0.3);
  }
  // Window lights
  const windowColors = [
    "rgba(244, 114, 182, 0.85)",
    "rgba(56, 189, 248, 0.8)",
    "rgba(167, 139, 250, 0.8)",
    "rgba(251, 191, 36, 0.75)",
    "rgba(52, 211, 153, 0.75)",
    "rgba(248, 113, 113, 0.8)",
  ];
  for (let i = 0; i < 60; i += 1) {
    const x = unit(i * 41 + 2) * width;
    const y = height * (0.5 + unit(i * 17) * 0.35);
    ctx.fillStyle = windowColors[i % windowColors.length];
    ctx.fillRect(x, y, 2 + unit(i) * 3, 2 + unit(i * 3) * 4);
  }

  // Glass condensation wash
  const mist = ctx.createLinearGradient(0, 0, 0, height);
  mist.addColorStop(0, "rgba(148, 163, 184, 0.08)");
  mist.addColorStop(0.4, "rgba(148, 163, 184, 0.04)");
  mist.addColorStop(1, "rgba(15, 23, 42, 0.18)");
  ctx.fillStyle = mist;
  ctx.fillRect(0, 0, width, height);

  // Soft ground reflection
  paintGround(ctx, width, height, true, "rgba(244, 114, 182, 0.12)");
}

/** Foreground glass rain for neon-rain (drawn after pets so it sits on the window plane). */
function paintWindowRainOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  for (let i = 0; i < 90; i += 1) {
    const x = unit(i * 19 + 1) * width;
    const y = unit(i * 31 + 4) * height;
    const r = 2 + unit(i * 7) * 5.5;
    const drop = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
    drop.addColorStop(0, "rgba(255,255,255,0.72)");
    drop.addColorStop(0.45, "rgba(186, 230, 253, 0.28)");
    drop.addColorStop(1, "rgba(255,255,255,0.02)");
    ctx.fillStyle = drop;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.75, r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.ellipse(x - r * 0.25, y - r * 0.35, r * 0.18, r * 0.28, -0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(186, 230, 253, 0.28)";
  ctx.lineWidth = 1.4;
  ctx.lineCap = "round";
  for (let i = 0; i < 28; i += 1) {
    const x = unit(i * 43 + 6) * width;
    const y = unit(i * 17 + 2) * height * 0.85;
    const len = 18 + unit(i * 11) * 55;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + unit(i * 5) * 4 - 1, y + len);
    ctx.stroke();
  }
}

function paintStarryScene(
  ctx: CanvasRenderingContext2D,
  bg: Extract<PhotoBackground, { type: "gradient" }>,
  width: number,
  height: number,
) {
  // Deep indigo base with warm undertone
  const base = ctx.createLinearGradient(0, 0, 0, height);
  base.addColorStop(0, "#071428");
  base.addColorStop(0.45, bg.mid ?? "#1e3a6e");
  base.addColorStop(1, "#0b1220");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  // Van Gogh-like swirling bands
  const swirlColors = [
    "rgba(96, 165, 250, 0.22)",
    "rgba(125, 211, 252, 0.18)",
    "rgba(251, 191, 36, 0.14)",
    "rgba(167, 139, 250, 0.16)",
    "rgba(56, 189, 248, 0.2)",
    "rgba(253, 224, 71, 0.12)",
  ];

  for (let band = 0; band < 8; band += 1) {
    const cy = height * (0.12 + band * 0.09);
    const amp = 28 + band * 6;
    const freq = 1.6 + band * 0.18;
    const phase = band * 0.9;
    ctx.strokeStyle = swirlColors[band % swirlColors.length];
    ctx.lineWidth = 10 + band * 1.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let x = -20; x <= width + 20; x += 8) {
      const y = cy
        + Math.sin((x / width) * Math.PI * freq + phase) * amp
        + Math.sin((x / width) * Math.PI * (freq * 1.7) + phase * 1.3) * (amp * 0.35);
      if (x === -20) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Secondary tighter swirls (brush-stroke feel)
  for (let band = 0; band < 12; band += 1) {
    const cy = height * (0.08 + unit(band * 17) * 0.55);
    const amp = 10 + unit(band * 9) * 22;
    const freq = 2.4 + unit(band * 5) * 2.2;
    const phase = unit(band * 13) * Math.PI * 2;
    ctx.strokeStyle = `rgba(186, 230, 253, ${0.08 + unit(band * 7) * 0.12})`;
    ctx.lineWidth = 2.5 + unit(band * 3) * 3;
    ctx.beginPath();
    const startX = unit(band * 11) * width * 0.4;
    const endX = startX + width * (0.25 + unit(band * 19) * 0.45);
    for (let x = startX; x <= endX; x += 6) {
      const t = (x - startX) / Math.max(1, endX - startX);
      const y = cy + Math.sin(t * Math.PI * freq + phase) * amp;
      if (x === startX) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Glowing moon
  const mx = width * 0.78;
  const my = height * 0.2;
  paintSoftOrb(ctx, mx, my, 90, 90, "rgba(253, 224, 71, 0.35)", 0.9);
  paintSoftOrb(ctx, mx, my, 50, 50, "rgba(254, 243, 199, 0.7)", 0.95);
  const moon = ctx.createRadialGradient(mx - 8, my - 8, 4, mx, my, 34);
  moon.addColorStop(0, "#fffbeb");
  moon.addColorStop(0.55, "#fde68a");
  moon.addColorStop(1, "#f59e0b");
  ctx.fillStyle = moon;
  ctx.beginPath();
  ctx.arc(mx, my, 34, 0, Math.PI * 2);
  ctx.fill();

  // Stars with cross glints
  for (let i = 0; i < 70; i += 1) {
    const x = unit(i * 17 + 2) * width;
    const y = unit(i * 29 + 5) * height * 0.7;
    const r = 0.7 + unit(i * 11) * 2.2;
    const bright = 0.55 + unit(i * 7) * 0.45;
    ctx.fillStyle = `rgba(255,255,255,${bright})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    if (r > 1.8) {
      ctx.strokeStyle = `rgba(253, 224, 71, ${bright * 0.7})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - r * 3.2, y);
      ctx.lineTo(x + r * 3.2, y);
      ctx.moveTo(x, y - r * 3.2);
      ctx.lineTo(x, y + r * 3.2);
      ctx.stroke();
    }
  }

  // Cypress-like dark silhouette (homage, simplified)
  ctx.fillStyle = "rgba(2, 6, 23, 0.72)";
  ctx.beginPath();
  ctx.moveTo(width * 0.12, height);
  ctx.bezierCurveTo(
    width * 0.08, height * 0.7,
    width * 0.16, height * 0.45,
    width * 0.11, height * 0.22,
  );
  ctx.bezierCurveTo(
    width * 0.14, height * 0.35,
    width * 0.2, height * 0.55,
    width * 0.18, height,
  );
  ctx.closePath();
  ctx.fill();

  paintGround(ctx, width, height, true, "rgba(2, 6, 23, 0.55)");
}

function paintSakuraScene(
  ctx: CanvasRenderingContext2D,
  bg: Extract<PhotoBackground, { type: "gradient" }>,
  width: number,
  height: number,
) {
  paintBaseGradient(ctx, bg, width, height);
  paintSoftOrb(ctx, width * 0.2, height * 0.18, 200, 140, "rgba(251, 113, 133, 0.28)", 0.55);
  paintSoftOrb(ctx, width * 0.8, height * 0.22, 180, 120, "rgba(253, 164, 175, 0.35)", 0.45);

  // Soft branch silhouettes (top corners)
  ctx.strokeStyle = "rgba(120, 53, 15, 0.28)";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  const branches: Array<[number, number, number, number, number, number]> = [
    [0, height * 0.08, width * 0.18, height * 0.02, width * 0.32, height * 0.12],
    [0, height * 0.18, width * 0.14, height * 0.14, width * 0.26, height * 0.22],
    [width, height * 0.06, width * 0.82, height * 0.02, width * 0.68, height * 0.14],
    [width, height * 0.2, width * 0.86, height * 0.16, width * 0.72, height * 0.24],
  ];
  for (const [x0, y0, x1, y1, x2, y2] of branches) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(x1, y1, x2, y2);
    ctx.stroke();
  }

  // Static petals for export
  for (let i = 0; i < 48; i += 1) {
    const x = unit(i * 19 + 3) * width;
    const y = unit(i * 31 + 7) * height;
    const s = 5 + unit(i * 11) * 10;
    const rot = unit(i * 13) * Math.PI * 2;
    const pink = unit(i * 5);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha = 0.45 + unit(i * 17) * 0.4;
    ctx.fillStyle = pink > 0.55
      ? "rgba(251, 113, 133, 0.85)"
      : pink > 0.25
        ? "rgba(253, 164, 175, 0.9)"
        : "rgba(255, 228, 230, 0.95)";
    // Heart-ish petal
    ctx.beginPath();
    ctx.moveTo(0, s * 0.55);
    ctx.quadraticCurveTo(s * 0.85, s * 0.1, s * 0.15, -s * 0.7);
    ctx.quadraticCurveTo(0, -s * 0.35, 0, -s * 0.45);
    ctx.quadraticCurveTo(0, -s * 0.35, -s * 0.15, -s * 0.7);
    ctx.quadraticCurveTo(-s * 0.85, s * 0.1, 0, s * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Soft grass / path
  paintGround(ctx, width, height, false, "rgba(190, 24, 93, 0.1)");
}

/** Full-camp memorial default: ceremonial hall / closing-night stage. */
function paintCeremonyScene(
  ctx: CanvasRenderingContext2D,
  bg: Extract<PhotoBackground, { type: "gradient" }>,
  width: number,
  height: number,
) {
  paintBaseGradient(ctx, bg, width, height);

  // Deep stage wash
  const wash = ctx.createRadialGradient(
    width * 0.5,
    height * 0.42,
    width * 0.08,
    width * 0.5,
    height * 0.55,
    width * 0.72,
  );
  wash.addColorStop(0, "rgba(251, 191, 36, 0.22)");
  wash.addColorStop(0.45, "rgba(167, 139, 250, 0.18)");
  wash.addColorStop(1, "rgba(15, 23, 42, 0)");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, width, height);

  // Soft spotlight cones
  for (const [cx, alpha] of [
    [0.22, 0.16],
    [0.5, 0.22],
    [0.78, 0.16],
  ] as const) {
    const cone = ctx.createLinearGradient(width * cx, height * 0.02, width * cx, height * 0.72);
    cone.addColorStop(0, `rgba(254, 243, 199, ${alpha})`);
    cone.addColorStop(0.55, `rgba(251, 191, 36, ${alpha * 0.35})`);
    cone.addColorStop(1, "rgba(251, 191, 36, 0)");
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(width * (cx - 0.08), 0);
    ctx.lineTo(width * (cx + 0.08), 0);
    ctx.lineTo(width * (cx + 0.18), height * 0.78);
    ctx.lineTo(width * (cx - 0.18), height * 0.78);
    ctx.closePath();
    ctx.fill();
  }

  // Side curtains
  const curtain = (side: "left" | "right") => {
    const x0 = side === "left" ? 0 : width;
    const dir = side === "left" ? 1 : -1;
    ctx.save();
    const g = ctx.createLinearGradient(x0, 0, x0 + dir * width * 0.18, 0);
    g.addColorStop(0, "rgba(76, 29, 149, 0.92)");
    g.addColorStop(0.55, "rgba(91, 33, 182, 0.55)");
    g.addColorStop(1, "rgba(91, 33, 182, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x0, 0);
    ctx.lineTo(x0 + dir * width * 0.14, 0);
    ctx.quadraticCurveTo(
      x0 + dir * width * 0.2,
      height * 0.35,
      x0 + dir * width * 0.12,
      height,
    );
    ctx.lineTo(x0, height);
    ctx.closePath();
    ctx.fill();

    // Fold lines
    ctx.strokeStyle = "rgba(251, 191, 36, 0.12)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i += 1) {
      const fx = x0 + dir * width * (0.03 + i * 0.028);
      ctx.beginPath();
      ctx.moveTo(fx, 0);
      ctx.bezierCurveTo(
        fx + dir * 10,
        height * 0.25,
        fx - dir * 8,
        height * 0.55,
        fx + dir * 6,
        height,
      );
      ctx.stroke();
    }
    ctx.restore();
  };
  curtain("left");
  curtain("right");

  // Top valance / arch ribbon
  const valance = ctx.createLinearGradient(0, 0, 0, height * 0.18);
  valance.addColorStop(0, "rgba(49, 16, 89, 0.92)");
  valance.addColorStop(0.7, "rgba(76, 29, 149, 0.55)");
  valance.addColorStop(1, "rgba(76, 29, 149, 0)");
  ctx.fillStyle = valance;
  ctx.fillRect(0, 0, width, height * 0.18);

  ctx.fillStyle = "rgba(251, 191, 36, 0.55)";
  ctx.beginPath();
  ctx.moveTo(width * 0.18, height * 0.015);
  ctx.quadraticCurveTo(width * 0.5, height * 0.07, width * 0.82, height * 0.015);
  ctx.lineTo(width * 0.82, height * 0.035);
  ctx.quadraticCurveTo(width * 0.5, height * 0.09, width * 0.18, height * 0.035);
  ctx.closePath();
  ctx.fill();

  // Floating sparkles
  for (let i = 0; i < 36; i += 1) {
    const x = unit(i * 17 + 2) * width;
    const y = unit(i * 29 + 5) * height * 0.55;
    const r = 1.2 + unit(i * 7) * 2.4;
    ctx.globalAlpha = 0.35 + unit(i * 11) * 0.55;
    ctx.fillStyle = unit(i * 3) > 0.55 ? "#fde68a" : "#f5d0fe";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Tiered stage floor
  paintGround(ctx, width, height, true, "rgba(15, 23, 42, 0.55)");
  const stageTop = height * 0.72;
  const stageGrad = ctx.createLinearGradient(0, stageTop, 0, height);
  stageGrad.addColorStop(0, "rgba(30, 27, 75, 0.15)");
  stageGrad.addColorStop(0.35, "rgba(49, 46, 129, 0.55)");
  stageGrad.addColorStop(1, "rgba(15, 23, 42, 0.82)");
  ctx.fillStyle = stageGrad;
  ctx.beginPath();
  ctx.moveTo(width * 0.04, height);
  ctx.lineTo(width * 0.1, stageTop);
  ctx.lineTo(width * 0.9, stageTop);
  ctx.lineTo(width * 0.96, height);
  ctx.closePath();
  ctx.fill();

  // Gold edge on stage lip
  ctx.strokeStyle = "rgba(251, 191, 36, 0.55)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(width * 0.1, stageTop);
  ctx.lineTo(width * 0.9, stageTop);
  ctx.stroke();

  // Soft footlights
  for (let i = 0; i < 7; i += 1) {
    const lx = width * (0.18 + i * 0.11);
    paintSoftOrb(ctx, lx, stageTop + 8, 28, 12, "rgba(253, 224, 71, 0.55)", 0.45);
  }
}

/** Paint a full scene (or custom image) onto a canvas — shared by export + live stage. */
export function paintSceneBackground(
  ctx: CanvasRenderingContext2D,
  background: PhotoBackground,
  width: number,
  height: number,
  image?: HTMLImageElement | null,
) {
  fillBackground(ctx, background, width, height, image);
}

function fillBackground(
  ctx: CanvasRenderingContext2D,
  background: PhotoBackground,
  width: number,
  height: number,
  image?: HTMLImageElement | null,
) {
  if (background.type === "image" && image) {
    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const drawW = image.naturalWidth * scale;
    const drawH = image.naturalHeight * scale;
    const dx = (width - drawW) / 2;
    const dy = (height - drawH) / 2;
    ctx.drawImage(image, dx, dy, drawW, drawH);
    // Soft vignette so pets stay readable on busy photos.
    const vignette = ctx.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.2,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.72,
    );
    vignette.addColorStop(0, "rgba(15,23,42,0)");
    vignette.addColorStop(1, "rgba(15,23,42,0.28)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
    return;
  }

  if (background.type === "gradient") {
    const fx = resolveSceneFx(background);
    switch (fx) {
      case "sunny":
        paintSunnyScene(ctx, background, width, height);
        break;
      case "snow":
        paintSnowScene(ctx, background, width, height);
        break;
      case "mint":
        paintMintScene(ctx, background, width, height);
        break;
      case "dusk":
        paintDuskScene(ctx, background, width, height);
        break;
      case "neon-rain":
        paintNeonRainScene(ctx, background, width, height);
        break;
      case "starry":
        paintStarryScene(ctx, background, width, height);
        break;
      case "sakura":
        paintSakuraScene(ctx, background, width, height);
        break;
      case "ceremony":
        paintCeremonyScene(ctx, background, width, height);
        break;
      default: {
        paintBaseGradient(ctx, background, width, height);
        paintGround(ctx, width, height, isDarkBackground(background));
        const accent = background.accent ?? "#93c5fd";
        paintSoftOrb(ctx, width * 0.18, height * 0.22, 140, 90, accent, 0.22);
        paintSoftOrb(ctx, width * 0.82, height * 0.18, 160, 100, accent, 0.18);
      }
    }
    return;
  }

  ctx.fillStyle = "#eef2ee";
  ctx.fillRect(0, 0, width, height);
}

/** CSS live-stage background layers matching the canvas atmospheres. */
export function backgroundStyle(bg: PhotoBackground): Record<string, string> {
  if (bg.type === "image") {
    return {
      backgroundImage: `linear-gradient(180deg, rgba(15,23,42,0.08), rgba(15,23,42,0.22)), url(${bg.src})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  }

  const accent = bg.accent ?? "#93c5fd";
  const mid = bg.mid ?? bg.to;
  const fx = resolveSceneFx(bg);

  switch (fx) {
    case "sunny":
      return {
        backgroundImage: `
          radial-gradient(circle 120px at 82% 18%, rgba(253,224,71,0.85), rgba(253,224,71,0) 70%),
          radial-gradient(ellipse 70% 50% at 18% 22%, ${accent}55, transparent 60%),
          radial-gradient(ellipse 50% 40% at 70% 70%, rgba(134,239,172,0.25), transparent 60%),
          linear-gradient(180deg, ${bg.from} 0%, ${mid} 48%, ${bg.to} 100%)
        `,
      };
    case "snow":
      return {
        backgroundImage: `
          radial-gradient(circle 90px at 78% 16%, rgba(255,255,255,0.9), rgba(254,243,199,0.35) 40%, transparent 70%),
          radial-gradient(ellipse 70% 50% at 22% 20%, rgba(186,230,253,0.55), transparent 60%),
          linear-gradient(180deg, ${bg.from} 0%, ${mid} 50%, ${bg.to} 100%)
        `,
      };
    case "mint":
      return {
        backgroundImage: `
          radial-gradient(ellipse 60% 45% at 20% 25%, rgba(167,243,208,0.7), transparent 60%),
          radial-gradient(ellipse 50% 40% at 80% 20%, ${accent}44, transparent 58%),
          radial-gradient(ellipse 40% 30% at 50% 80%, rgba(16,185,129,0.18), transparent 60%),
          linear-gradient(180deg, ${bg.from} 0%, ${mid} 48%, ${bg.to} 100%)
        `,
      };
    case "dusk":
      return {
        backgroundImage: `
          radial-gradient(circle 110px at 72% 42%, rgba(255,247,237,0.95), rgba(251,146,60,0.55) 35%, transparent 68%),
          linear-gradient(180deg, #1e1b4b 0%, #7c3aed 22%, ${mid} 52%, ${bg.to} 78%, #fb923c 100%)
        `,
      };
    case "neon-rain":
      return {
        backgroundImage: `
          radial-gradient(circle 80px at 18% 40%, rgba(244,114,182,0.45), transparent 60%),
          radial-gradient(circle 100px at 70% 55%, rgba(56,189,248,0.35), transparent 62%),
          radial-gradient(circle 70px at 48% 70%, rgba(167,139,250,0.4), transparent 60%),
          radial-gradient(circle 90px at 85% 30%, rgba(251,191,36,0.28), transparent 58%),
          linear-gradient(180deg, ${bg.from} 0%, ${mid} 50%, ${bg.to} 100%)
        `,
      };
    case "starry":
      return {
        backgroundImage: `
          radial-gradient(circle 70px at 78% 20%, rgba(253,224,71,0.7), rgba(251,191,36,0.25) 40%, transparent 70%),
          radial-gradient(ellipse 80% 40% at 40% 30%, rgba(96,165,250,0.28), transparent 60%),
          radial-gradient(ellipse 60% 35% at 60% 55%, rgba(167,139,250,0.22), transparent 60%),
          linear-gradient(180deg, #071428 0%, ${mid} 48%, #0b1220 100%)
        `,
      };
    case "sakura":
      return {
        backgroundImage: `
          radial-gradient(ellipse 60% 45% at 20% 18%, rgba(251,113,133,0.28), transparent 60%),
          radial-gradient(ellipse 50% 40% at 80% 22%, ${accent}40, transparent 58%),
          radial-gradient(ellipse 40% 30% at 50% 85%, rgba(190,24,93,0.12), transparent 60%),
          linear-gradient(180deg, ${bg.from} 0%, ${mid} 48%, ${bg.to} 100%)
        `,
      };
    case "ceremony":
      return {
        backgroundImage: `
          radial-gradient(ellipse 40% 55% at 22% 0%, rgba(254,243,199,0.28), transparent 60%),
          radial-gradient(ellipse 45% 60% at 50% 0%, rgba(251,191,36,0.22), transparent 62%),
          radial-gradient(ellipse 40% 55% at 78% 0%, rgba(254,243,199,0.28), transparent 60%),
          radial-gradient(ellipse 70% 40% at 50% 70%, rgba(167,139,250,0.25), transparent 65%),
          linear-gradient(90deg, rgba(76,29,149,0.85) 0%, transparent 18%, transparent 82%, rgba(76,29,149,0.85) 100%),
          linear-gradient(180deg, #1e1b4b 0%, ${mid} 45%, #0f172a 100%)
        `,
      };
    default:
      return {
        backgroundImage: `
          radial-gradient(ellipse 70% 50% at 18% 22%, ${accent}44, transparent 60%),
          radial-gradient(ellipse 60% 45% at 82% 18%, ${accent}33, transparent 58%),
          linear-gradient(180deg, ${bg.from}, ${bg.to})
        `,
      };
  }
}

function sloganAnchor(position: SloganPosition, width: number, height: number, boxW: number, boxH: number) {
  const padX = 48;
  const padY = 44;
  switch (position) {
    case "top-left":
      return { x: padX, y: padY, align: "left" as const };
    case "top-right":
      return { x: width - padX - boxW, y: padY, align: "right" as const };
    case "center":
      return { x: (width - boxW) / 2, y: (height - boxH) / 2, align: "center" as const };
    case "bottom-left":
      return { x: padX, y: height - padY - boxH, align: "left" as const };
    case "bottom-center":
      return { x: (width - boxW) / 2, y: height - padY - boxH, align: "center" as const };
    case "bottom-right":
      return { x: width - padX - boxW, y: height - padY - boxH, align: "right" as const };
    case "top-center":
    default:
      return { x: (width - boxW) / 2, y: padY, align: "center" as const };
  }
}

export function drawSlogan(
  ctx: CanvasRenderingContext2D,
  slogan: PhotoSlogan,
  width: number,
  height: number,
  darkBg: boolean,
) {
  const text = slogan.text.trim();
  if (!text) return;

  const fontSize = Math.max(16, Math.min(96, slogan.size));
  ctx.font = `800 ${fontSize}px "Segoe UI", "PingFang SC", "Microsoft YaHei UI", sans-serif`;
  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  const padX = slogan.style === "badge" ? Math.max(22, fontSize * 0.55) : 8;
  const padY = slogan.style === "badge" ? Math.max(12, fontSize * 0.32) : 4;
  const boxW = textWidth + padX * 2;
  const boxH = fontSize + padY * 2;
  const anchor = sloganAnchor(slogan.position, width, height, boxW, boxH);
  const color = slogan.color || (darkBg ? "#f8fafc" : "#0f172a");

  ctx.save();
  if (slogan.style === "badge") {
    ctx.fillStyle = darkBg ? "rgba(15,23,42,0.55)" : "rgba(255,255,255,0.88)";
    ctx.shadowColor = "rgba(15,23,42,0.18)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;
    ctx.beginPath();
    ctx.roundRect(anchor.x, anchor.y, boxW, boxH, 999);
    ctx.fill();
    ctx.shadowColor = "transparent";
  }

  const textX = anchor.x + boxW / 2;
  const textY = anchor.y + boxH / 2;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (slogan.style === "outline") {
    ctx.lineWidth = Math.max(3, fontSize * 0.08);
    ctx.strokeStyle = darkBg ? "rgba(15,23,42,0.75)" : "rgba(255,255,255,0.92)";
    ctx.strokeText(text, textX, textY);
    ctx.fillStyle = color;
    ctx.fillText(text, textX, textY);
  } else if (slogan.style === "glow") {
    ctx.shadowColor = color;
    ctx.shadowBlur = Math.max(12, fontSize * 0.45);
    ctx.fillStyle = color;
    ctx.fillText(text, textX, textY);
    ctx.shadowBlur = 0;
    ctx.fillStyle = darkBg ? "#ffffff" : color;
    ctx.fillText(text, textX, textY);
  } else {
    ctx.fillStyle = color;
    ctx.fillText(text, textX, textY);
  }
  ctx.restore();
}

export type PhotoPosePlan = {
  /** Preferred animation frame when a preview strip is available. */
  frameIndex: number;
};

/** Stable-ish hash for deterministic-looking but per-export-varied seeds. */
export function hashString(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Build a desynced playback plan for live stage actors. */
export function createActorMotion(petId: string, salt = Math.random()) {
  const seed = hashString(`${petId}:${salt.toFixed(6)}`);
  const unit = (seed % 1000) / 1000;
  const unit2 = ((seed >>> 10) % 1000) / 1000;
  const unit3 = ((seed >>> 20) % 1000) / 1000;
  return {
    startFrame: Math.floor(unit * 12),
    speed: 0.82 + unit2 * 0.46, // ~0.82x – 1.28x
    phaseOffsetMs: Math.floor(unit3 * 900),
    bobDelay: `${(unit * 1.4).toFixed(2)}s`,
    bobDuration: `${(2.3 + unit2 * 1.4).toFixed(2)}s`,
  };
}

/** Resolve playback for gallery cards / photo booth (full-grid q90 sheet). */
export function getPreviewPlayback(pet: Pet): {
  url: string;
  grid: SpriteGrid;
  state: SpriteState;
} | null {
  const url = safeExternalUrl(pet.previewUrl) ?? safeExternalUrl(pet.detailUrl);
  if (!url) return null;
  const state = getDefaultState(pet.spriteGrid);
  if (!state) return null;
  return {
    url,
    grid: pet.spriteGrid,
    state,
  };
}

function assertSameOriginDrawable(urlValue: string, petName: string) {
  const url = new URL(urlValue, window.location.href);
  if (
    url.origin !== window.location.origin
    && !url.protocol.startsWith("blob")
    && !url.protocol.startsWith("data")
  ) {
    throw new Error(`${petName} 暂时没法导出，换一只试试`);
  }
  return url.href;
}

export async function loadPetPoseSource(pet: Pet, preferredFrame?: number) {
  const preview = getPreviewPlayback(pet);
  if (preview) {
    try {
      const href = assertSameOriginDrawable(preview.url, pet.petName);
      const image = await requestImage(href);
      const frameCount = Math.max(1, preview.state.frames);
      const frameIndex = preferredFrame == null
        ? Math.floor(Math.random() * frameCount)
        : ((Math.floor(preferredFrame) % frameCount) + frameCount) % frameCount;
      return {
        kind: "preview" as const,
        image,
        grid: preview.grid,
        state: preview.state,
        frameIndex,
      };
    } catch {
      // Fall through to poster.
    }
  }

  if (!pet.posterUrl) throw new Error(`${pet.petName} 缺少可导出的预览图`);
  const href = assertSameOriginDrawable(pet.posterUrl, pet.petName);
  const image = await requestImage(href);
  return {
    kind: "poster" as const,
    image,
    frameIndex: 0,
  };
}

export function drawPetPose(
  ctx: CanvasRenderingContext2D,
  pose: Awaited<ReturnType<typeof loadPetPoseSource>>,
  slot: { x: number; y: number; size: number },
) {
  ctx.save();
  ctx.shadowColor = "rgba(20,24,22,0.28)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 10;
  ctx.imageSmoothingEnabled = false;

  if (pose.kind === "preview") {
    const frame = getFrameSize(pose.image, pose.grid);
    const aspect = frame.height / Math.max(1, frame.width);
    const drawWidth = slot.size;
    const drawHeight = slot.size * aspect;
    const x = slot.x - drawWidth / 2;
    const y = slot.y - drawHeight;
    ctx.drawImage(
      pose.image,
      frame.width * pose.frameIndex,
      frame.height * pose.state.row,
      frame.width,
      frame.height,
      x,
      y,
      drawWidth,
      drawHeight,
    );
  } else {
    const aspect = pose.image.naturalHeight / pose.image.naturalWidth || 208 / 192;
    const drawWidth = slot.size;
    const drawHeight = slot.size * aspect;
    const x = slot.x - drawWidth / 2;
    const y = slot.y - drawHeight;
    ctx.drawImage(pose.image, x, y, drawWidth, drawHeight);
  }

  ctx.restore();
}

export async function composeGroupPhoto({
  pets,
  background,
  nameMode = "pet",
  showNames,
  slogan = DEFAULT_SLOGAN,
  width = 1600,
  height = 900,
  /** Live-stage frame indices keyed by pet id. Missing pets get a fresh random frame. */
  poseByPetId,
}: {
  pets: Pet[];
  background: PhotoBackground;
  nameMode?: PhotoNameMode;
  /** @deprecated Prefer nameMode. Kept for older call sites. */
  showNames?: boolean;
  slogan?: PhotoSlogan;
  width?: number;
  height?: number;
  poseByPetId?: Record<string, number | undefined>;
}) {
  if (pets.length < PHOTO_MIN || pets.length > PHOTO_MAX) {
    throw new Error(`合影人数需在 ${PHOTO_MIN}–${PHOTO_MAX} 之间`);
  }

  // Backward-compatible bridge: showNames=false maps to hidden.
  const resolvedMode: PhotoNameMode = showNames === false ? "hidden" : nameMode;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建画布");

  let bgImage: HTMLImageElement | null = null;
  if (background.type === "image") {
    bgImage = await requestImage(background.src, { anonymous: background.src.startsWith("http") });
  }
  fillBackground(ctx, background, width, height, bgImage);

  const slots = layoutSlots(pets.length, width, height);
  const poses = await Promise.all(
    pets.map((pet) => loadPetPoseSource(pet, poseByPetId?.[pet.id])),
  );

  poses.forEach((pose, index) => {
    const slot = slots[index];
    drawPetPose(ctx, pose, slot);

    const label = resolvePhotoNameLabel(pets[index], resolvedMode);
    if (label) {
      ctx.font = `600 ${Math.max(16, Math.floor(slot.size * 0.12))}px "Segoe UI", "PingFang SC", sans-serif`;
      const textWidth = ctx.measureText(label).width;
      const padX = 12;
      const boxW = textWidth + padX * 2;
      const boxH = Math.max(28, slot.size * 0.16);
      const boxX = slot.x - boxW / 2;
      const boxY = slot.y + 8;
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 999);
      ctx.fill();
      ctx.fillStyle = "#141816";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, slot.x, boxY + boxH / 2 + 0.5);
    }
  });

  // Foreground glass rain after pets so the export matches the live window plane.
  if (resolveSceneFx(background) === "neon-rain") {
    paintWindowRainOverlay(ctx, width, height);
  }

  drawSlogan(ctx, slogan, width, height, isDarkBackground(background));

  // Brand watermark.
  ctx.fillStyle = isDarkBackground(background) ? "rgba(248,250,252,0.45)" : "rgba(20,24,22,0.45)";
  ctx.font = '600 18px "Segoe UI", "PingFang SC", sans-serif';
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("SC26 宠物画廊", 36, height - 28);

  return canvas;
}

/** Foreground rain overlay for neon-rain scenes (after pets). */
export function paintForegroundSceneFx(
  ctx: CanvasRenderingContext2D,
  background: PhotoBackground,
  width: number,
  height: number,
) {
  if (resolveSceneFx(background) === "neon-rain") {
    paintWindowRainOverlay(ctx, width, height);
  }
}

export async function downloadCanvasPng(canvas: HTMLCanvasElement, filename: string) {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("导出失败");
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** CSS helpers for the live stage slogan. */
export function sloganPositionClass(position: SloganPosition) {
  switch (position) {
    case "top-left":
      return "items-start justify-start text-left";
    case "top-right":
      return "items-start justify-end text-right";
    case "center":
      return "items-center justify-center text-center";
    case "bottom-left":
      return "items-end justify-start text-left";
    case "bottom-center":
      return "items-end justify-center text-center";
    case "bottom-right":
      return "items-end justify-end text-right";
    case "top-center":
    default:
      return "items-start justify-center text-center";
  }
}
