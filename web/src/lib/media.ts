import { resolveSpriteLayout } from "./sprite-format";
import type { SpriteGrid, SpriteState } from "./types";

const FULL_IMAGE_CACHE_LIMIT = 4;
const fullSpriteImages = new Map<string, Promise<HTMLImageElement>>();

export const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function safeExternalUrl(value: string | null | undefined) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value, window.location.href);
    if (url.protocol === "https:" || url.origin === window.location.origin) return url.href;
  } catch {
    // Invalid URLs are omitted.
  }
  return null;
}

export function requestImage(url: string, { anonymous = false } = {}) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    if (anonymous) image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener("error", () => reject(new Error(`无法加载图片：${url}`)), { once: true });
    image.src = url;
  });
}

export function loadSpriteImage(url: string) {
  if (fullSpriteImages.has(url)) {
    const request = fullSpriteImages.get(url)!;
    fullSpriteImages.delete(url);
    fullSpriteImages.set(url, request);
    return request;
  }

  const request = requestImage(url).catch((error) => {
    fullSpriteImages.delete(url);
    throw error;
  });
  fullSpriteImages.set(url, request);
  while (fullSpriteImages.size > FULL_IMAGE_CACHE_LIMIT) {
    fullSpriteImages.delete(fullSpriteImages.keys().next().value!);
  }
  return request;
}

export function getFrameSize(image: HTMLImageElement, grid: SpriteGrid) {
  const layout = resolveSpriteLayout(image, grid);
  return {
    width: layout.frameWidth,
    height: layout.frameHeight,
  };
}

export function drawSpriteFrame(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  grid: SpriteGrid,
  state: SpriteState,
  frameIndex: number,
  destination?: { width: number; height: number },
) {
  const natural = image as HTMLImageElement;
  const frame = "naturalWidth" in natural
    ? getFrameSize(natural, grid)
    : { width: (image as HTMLCanvasElement).width / grid.columns, height: (image as HTMLCanvasElement).height / grid.rows };

  const width = destination?.width ?? context.canvas.width;
  const height = destination?.height ?? context.canvas.height;
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  context.imageSmoothingEnabled = false;
  context.drawImage(
    image,
    frame.width * frameIndex,
    frame.height * state.row,
    frame.width,
    frame.height,
    0,
    0,
    width,
    height,
  );
}

type AnimatorOptions = {
  canvas: HTMLCanvasElement;
  url: string;
  grid: SpriteGrid;
  state: SpriteState;
  onReady?: () => void;
  onError?: (error: unknown) => void;
  imageLoader?: (url: string) => Promise<HTMLImageElement>;
  /** Start on this frame (wrapped by state.frames). */
  startFrame?: number;
  /** Playback speed multiplier. 1 = normal, 1.2 = faster. */
  speed?: number;
  /** Shift the first tick backward so pets desync without waiting. */
  phaseOffsetMs?: number;
  /** Keep animating even when prefers-reduced-motion is on (trial companion). */
  forceAnimate?: boolean;
};

export class SpriteAnimator {
  canvas: HTMLCanvasElement;
  url: string;
  grid: SpriteGrid;
  state: SpriteState;
  onReady?: () => void;
  onError?: (error: unknown) => void;
  imageLoader: (url: string) => Promise<HTMLImageElement>;
  frameIndex = 0;
  lastFrameAt = 0;
  animationFrame: number | null = null;
  destroyed = false;
  image: HTMLImageElement | null = null;
  speed = 1;
  phaseOffsetMs = 0;
  forceAnimate = false;
  ready = false;

  constructor({
    canvas,
    url,
    grid,
    state,
    onReady,
    onError,
    imageLoader = loadSpriteImage,
    startFrame = 0,
    speed = 1,
    phaseOffsetMs = 0,
    forceAnimate = false,
  }: AnimatorOptions) {
    this.canvas = canvas;
    this.url = url;
    this.grid = grid;
    this.state = state;
    this.onReady = onReady;
    this.onError = onError;
    this.imageLoader = imageLoader;
    this.speed = Math.max(0.25, speed || 1);
    this.phaseOffsetMs = Math.max(0, phaseOffsetMs || 0);
    this.forceAnimate = Boolean(forceAnimate);
    const frames = Math.max(1, state.frames || 1);
    this.frameIndex = ((Math.floor(startFrame) % frames) + frames) % frames;
    this.tick = this.tick.bind(this);
    void this.load();
  }

  async load() {
    try {
      this.image = await this.imageLoader(this.url);
      if (this.destroyed) return;

      const frame = getFrameSize(this.image, this.grid);
      if (frame.width < 1 || frame.height < 1) throw new Error("宠物图尺寸无效");
      this.canvas.width = frame.width;
      this.canvas.height = frame.height;
      this.ready = true;
      this.draw();
      this.onReady?.();
      if (!reduceMotion || this.forceAnimate) this.animationFrame = requestAnimationFrame(this.tick);
    } catch (error) {
      if (!this.destroyed) this.onError?.(error);
    }
  }

  tick(timestamp: number) {
    if (this.destroyed) return;
    if (!this.lastFrameAt) {
      // Apply phase offset once so each actor starts mid-cycle.
      this.lastFrameAt = timestamp - this.phaseOffsetMs;
    }

    const duration = Math.max(16, Number(this.state.frameDuration) / this.speed);
    if (timestamp - this.lastFrameAt >= duration) {
      const elapsedFrames = Math.floor((timestamp - this.lastFrameAt) / duration);
      this.frameIndex = (this.frameIndex + elapsedFrames) % Math.max(1, this.state.frames);
      this.lastFrameAt += elapsedFrames * duration;
      this.draw();
    }
    this.animationFrame = requestAnimationFrame(this.tick);
  }

  draw() {
    if (!this.image) return;
    const context = this.canvas.getContext("2d");
    if (!context) return;
    drawSpriteFrame(context, this.image, this.grid, this.state, this.frameIndex);
  }

  getFrameIndex() {
    return this.frameIndex;
  }

  setState(state: SpriteState) {
    this.state = state;
    this.frameIndex = 0;
    this.lastFrameAt = performance.now();
    this.canvas.setAttribute("aria-label", `${state.label}状态动画`);
    this.draw();
  }

  destroy() {
    this.destroyed = true;
    this.ready = false;
    if (this.animationFrame !== null) cancelAnimationFrame(this.animationFrame);
    this.image = null;
  }
}

export function getDefaultState(grid: SpriteGrid) {
  return grid.states.find((state) => state.id === grid.defaultState) ?? grid.states[0];
}

/** Prefer the build-time detail sheet; fall back to the author original. */
export function getDetailPlaybackUrl(pet: { detailUrl?: string | null; spriteUrl?: string | null }) {
  return safeExternalUrl(pet.detailUrl) ?? safeExternalUrl(pet.spriteUrl);
}
