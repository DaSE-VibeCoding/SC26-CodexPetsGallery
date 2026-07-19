import type { JSX } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import {
  CAMP_ANIM_THRESHOLD,
  CAMP_ASPECT_OPTIONS,
  CAMP_STAGE,
  CEREMONY_BACKGROUND_ID,
  buildDefaultCampSlogan,
  campSlotHitTest,
  composeCampPhoto,
  getCampPets,
  groupCarpetColor,
  groupKeyOf,
  layoutCampSlots,
  type CampAspect,
  type CampPhotoSlot,
} from "../lib/camp-photo";
import {
  PHOTO_BACKGROUNDS,
  PHOTO_NAME_MODE_OPTIONS,
  SLOGAN_POSITION_OPTIONS,
  SLOGAN_STYLE_OPTIONS,
  backgroundStyle,
  createActorMotion,
  downloadCanvasPng,
  getPreviewPlayback,
  isDarkBackground,
  paintSceneBackground,
  resolvePhotoNameLabel,
  resolveSceneFx,
  sloganPositionClass,
} from "../lib/photo-booth";
import { SpriteAnimator, loadSpriteImage, reduceMotion, requestImage, safeExternalUrl } from "../lib/media";
import type {
  Pet,
  PhotoBackground,
  PhotoNameMode,
  PhotoSceneFx,
  PhotoSlogan,
  SloganPosition,
  SloganStyle,
} from "../lib/types";

type Props = {
  open: boolean;
  allPets: Pet[];
  onClose: () => void;
};

type ActorHandle = {
  getFrameIndex: () => number | undefined;
};

function sloganLiveClass(style: SloganStyle, dark: boolean) {
  if (style === "badge") {
    return dark
      ? "rounded-full bg-slate-950/55 px-5 py-2.5 text-amber-50 shadow-[0_12px_30px_rgba(0,0,0,0.35)] backdrop-blur-md ring-1 ring-amber-300/30"
      : "rounded-full bg-white/88 px-5 py-2.5 text-ink shadow-[0_12px_30px_rgba(15,23,42,0.12)] backdrop-blur-md";
  }
  if (style === "outline") {
    return "font-black tracking-tight [text-shadow:0_0_0_#fff,0_1px_0_#fff,1px_0_0_#fff,-1px_0_0_#fff,0_-1px_0_#fff,2px_2px_0_rgba(15,23,42,0.15)]";
  }
  if (style === "glow") {
    return "font-black tracking-tight drop-shadow-[0_0_18px_currentColor]";
  }
  return "font-extrabold tracking-tight drop-shadow-[0_2px_10px_rgba(15,23,42,0.18)]";
}

function CampActor({
  pet,
  index,
  slot,
  nameMode,
  dark,
  animate,
  selected,
  onReady,
  onSelect,
}: {
  pet: Pet;
  index: number;
  slot: CampPhotoSlot;
  nameMode: PhotoNameMode;
  dark: boolean;
  animate: boolean;
  selected: boolean;
  onReady: (petId: string, handle: ActorHandle | null) => void;
  onSelect: (pet: Pet) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [animated, setAnimated] = useState(false);
  const [broken, setBroken] = useState(!pet.posterUrl);
  const motion = useMemo(() => createActorMotion(pet.id, index * 0.17), [pet.id, index]);
  const nameLabel = resolvePhotoNameLabel(pet, nameMode);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let animator: SpriteAnimator | null = null;
    let canvas: HTMLCanvasElement | null = null;
    const playback = getPreviewPlayback(pet);

    const cleanup = () => {
      onReady(pet.id, null);
      animator?.destroy();
      animator = null;
      canvas?.remove();
      canvas = null;
      setAnimated(false);
    };

    if (!animate || !playback || reduceMotion) {
      onReady(pet.id, null);
      return cleanup;
    }

    canvas = document.createElement("canvas");
    canvas.className = [
      "pixelated photo-actor-sprite absolute left-1/2 top-1/2",
      "h-full w-auto max-h-full max-w-full -translate-x-1/2 -translate-y-1/2",
      "opacity-0 transition-opacity duration-300",
      "drop-shadow-[0_10px_14px_rgba(15,23,42,0.28)]",
    ].join(" ");
    canvas.width = Number(pet.previewFrameWidth) || 192;
    canvas.height = Number(pet.previewFrameHeight) || 208;
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", `${pet.petName}`);
    host.append(canvas);

    animator = new SpriteAnimator({
      canvas,
      url: playback.url,
      grid: playback.grid,
      state: playback.state,
      imageLoader: loadSpriteImage,
      startFrame: motion.startFrame,
      speed: motion.speed,
      phaseOffsetMs: motion.phaseOffsetMs,
      onReady: () => {
        canvas?.classList.add("opacity-100");
        setAnimated(true);
        onReady(pet.id, {
          getFrameIndex: () => animator?.getFrameIndex(),
        });
      },
      onError: () => {
        cleanup();
      },
    });

    return cleanup;
  }, [pet, motion, onReady, animate]);

  const posterUrl = safeExternalUrl(pet.posterUrl);
  const leftPct = slot.rx * 100;
  const bottomPct = (1 - slot.ry) * 100;
  const widthPct = slot.rsize * 100;
  // Live nameplate tracks pet size (rsize is size/stageWidth). Hide when microscopic.
  const plateFontPx = Math.max(6, Math.min(13, widthPct * 0.24));
  const showPlate = Boolean(nameLabel) && widthPct >= 2.4;

  return (
    <button
      type="button"
      className={`photo-actor absolute z-10 flex flex-col items-center border-0 bg-transparent p-0 ${
        selected ? "z-20" : ""
      }`}
      style={{
        left: `${leftPct}%`,
        bottom: `${bottomPct}%`,
        width: `${widthPct}%`,
        transform: "translateX(-50%)",
        ["--bob-delay" as string]: motion.bobDelay,
        ["--bob-duration" as string]: motion.bobDuration,
      }}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(pet);
      }}
      aria-label={`查看 ${pet.petName}`}
    >
      <div className={`photo-actor-bob relative w-full ${animate && !reduceMotion ? "" : "[animation:none]"}`}>
        <div
          ref={hostRef}
          className={`relative mx-auto aspect-square w-full rounded-xl transition ${
            selected ? "ring-2 ring-amber-300/90 ring-offset-2 ring-offset-transparent" : ""
          }`}
        >
          {posterUrl && !broken ? (
            <img
              src={posterUrl}
              alt=""
              width={Number(pet.previewFrameWidth) || 192}
              height={Number(pet.previewFrameHeight) || 208}
              className={`pixelated photo-actor-sprite absolute left-1/2 top-1/2 h-full w-auto max-h-full max-w-full -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow-[0_10px_14px_rgba(15,23,42,0.28)] transition-opacity duration-300 ${
                animated ? "opacity-0" : "opacity-100"
              }`}
              draggable={false}
              onError={() => setBroken(true)}
            />
          ) : !animated ? (
            <div className="grid h-full place-items-center rounded-xl bg-white/40 text-[10px] text-muted">
              无图
            </div>
          ) : null}
        </div>
        <div
          className="photo-actor-shadow mx-auto rounded-[100%] bg-slate-900/20 blur-[2px]"
          style={{
            marginTop: `${Math.max(1, widthPct * 0.04)}px`,
            height: `${Math.max(2, Math.min(6, widthPct * 0.08))}px`,
            width: "65%",
          }}
        />
      </div>
      {showPlate ? (
        <span
          className={`photo-name-tag max-w-[135%] truncate rounded-full font-semibold leading-none ${
            dark ? "bg-slate-950/55 text-white" : "bg-white/90 text-ink shadow-sm"
          }`}
          style={{
            marginTop: `${Math.max(1, plateFontPx * 0.2)}px`,
            fontSize: `${plateFontPx}px`,
            padding: `${Math.max(1, plateFontPx * 0.22)}px ${Math.max(3, plateFontPx * 0.55)}px`,
          }}
        >
          {nameLabel}
        </span>
      ) : null}
    </button>
  );
}

export function CampPhoto({ open, allPets, onClose }: Props) {
  const campPets = useMemo(() => getCampPets(allPets), [allPets]);
  const [aspect, setAspect] = useState<CampAspect>("portrait");
  const [backgroundId, setBackgroundId] = useState(CEREMONY_BACKGROUND_ID);
  const [nameMode, setNameMode] = useState<PhotoNameMode>("hidden");
  const [showCarpets, setShowCarpets] = useState(false);
  const [slogan, setSlogan] = useState<PhotoSlogan>(() => buildDefaultCampSlogan(0));
  const [panel, setPanel] = useState<"scene" | "slogan" | "name">("scene");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [forceStatic, setForceStatic] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const actorHandles = useRef(new Map<string, ActorHandle>());
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const [stageFit, setStageFit] = useState({ width: 0, height: 0 });

  const stage = CAMP_STAGE[aspect];
  const background: PhotoBackground =
    PHOTO_BACKGROUNDS.find((item) => item.id === backgroundId) ?? PHOTO_BACKGROUNDS[0];

  const slots = useMemo(
    () => layoutCampSlots(campPets, stage.width, stage.height, aspect),
    [campPets, stage.width, stage.height, aspect],
  );

  // Keep the full poster visible (letterbox/pillarbox) instead of clipping tall 2:3 art.
  useEffect(() => {
    const frame = frameRef.current;
    if (!open || !frame) return;

    const measure = () => {
      const styles = getComputedStyle(frame);
      const padX = (Number.parseFloat(styles.paddingLeft) || 0) + (Number.parseFloat(styles.paddingRight) || 0);
      const padY = (Number.parseFloat(styles.paddingTop) || 0) + (Number.parseFloat(styles.paddingBottom) || 0);
      const cw = Math.max(0, frame.clientWidth - padX);
      const ch = Math.max(0, frame.clientHeight - padY);
      if (cw < 2 || ch < 2) return;
      const ar = stage.width / stage.height;
      let width = cw;
      let height = width / ar;
      if (height > ch) {
        height = ch;
        width = height * ar;
      }
      setStageFit((current) => (
        Math.abs(current.width - width) < 0.5 && Math.abs(current.height - height) < 0.5
          ? current
          : { width, height }
      ));
    };

    measure();
    const observer = new ResizeObserver(() => measure());
    observer.observe(frame);
    return () => observer.disconnect();
  }, [open, stage.width, stage.height, aspect]);

  const slotByPetId = useMemo(() => {
    const map = new Map<string, CampPhotoSlot>();
    for (const slot of slots) map.set(slot.petId, slot);
    return map;
  }, [slots]);

  const shouldAnimate =
    !forceStatic
    && !reduceMotion
    && campPets.length > 0
    && campPets.length <= CAMP_ANIM_THRESHOLD;

  // Keep default slogan count in sync when first opening / cast changes,
  // but don't clobber a user edit that no longer matches the template prefix.
  useEffect(() => {
    if (!open) return;
    setSlogan((current) => {
      const nextDefault = buildDefaultCampSlogan(campPets.length);
      if (!current.text.trim() || /^VibeCoding夏令营 全营合影留念/.test(current.text)) {
        return { ...current, text: nextDefault.text };
      }
      return current;
    });
  }, [open, campPets.length]);

  useEffect(() => {
    if (!open) {
      setSelectedPetId(null);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setMessage(null);
      setForceStatic(false);
      actorHandles.current.clear();
    }
  }, [open]);

  useEffect(() => {
    const alive = new Set(campPets.map((pet) => pet.id));
    for (const id of [...actorHandles.current.keys()]) {
      if (!alive.has(id)) actorHandles.current.delete(id);
    }
  }, [campPets]);

  // Lightweight FPS watchdog: if the tab stutters, freeze animations.
  useEffect(() => {
    if (!open || !shouldAnimate) return;
    let frames = 0;
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      frames += 1;
      if (now - last >= 1200) {
        const fps = (frames * 1000) / (now - last);
        if (fps < 28) setForceStatic(true);
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open, shouldAnimate]);

  // Non-passive wheel so we can prevent page scroll while zooming the stage.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!open || !viewport) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta = event.deltaY > 0 ? -0.12 : 0.12;
      setZoom((current) => Math.min(4, Math.max(1, Number((current + delta).toFixed(2)))));
    };
    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, [open]);

  const handleActorReady = useMemo(() => {
    return (petId: string, handle: ActorHandle | null) => {
      if (handle) actorHandles.current.set(petId, handle);
      else actorHandles.current.delete(petId);
    };
  }, []);

  // Carpet ellipses for live preview (approximate export carpets).
  const carpetRuns = useMemo(() => {
    if (!showCarpets || slots.length === 0) return [] as Array<{
      key: string;
      left: number;
      top: number;
      width: number;
      height: number;
      color: string;
    }>;

    type Run = { groupKey: string; xs: number[]; ry: number; rsize: number };
    const runs: Run[] = [];
    let current: Run | null = null;
    for (const slot of slots) {
      if (
        current
        && current.groupKey === slot.groupKey
        && Math.abs(current.ry - slot.ry) < slot.rsize * 0.35
      ) {
        current.xs.push(slot.rx);
        current.rsize = Math.max(current.rsize, slot.rsize);
      } else {
        if (current) runs.push(current);
        current = {
          groupKey: slot.groupKey,
          xs: [slot.rx],
          ry: slot.ry,
          rsize: slot.rsize,
        };
      }
    }
    if (current) runs.push(current);

    return runs.map((run, index) => {
      const minX = Math.min(...run.xs);
      const maxX = Math.max(...run.xs);
      const cx = (minX + maxX) / 2;
      const halfW = (maxX - minX) / 2 + run.rsize * 0.55;
      const halfH = run.rsize * 0.22;
      return {
        key: `${run.groupKey}-${index}`,
        left: (cx - halfW) * 100,
        top: (run.ry - halfH * 0.2) * 100,
        width: halfW * 2 * 100,
        height: halfH * 2 * 100,
        color: groupCarpetColor(run.groupKey, 0.34),
      };
    });
  }, [showCarpets, slots]);

  if (!open) return null;

  const dark = isDarkBackground(background);
  const sceneFx = resolveSceneFx(background);
  const selectedPet = selectedPetId
    ? campPets.find((pet) => pet.id === selectedPetId) ?? null
    : null;
  const canExport = campPets.length > 0 && !busy;

  function updateSlogan<K extends keyof PhotoSlogan>(key: K, value: PhotoSlogan[K]) {
    setSlogan((current) => ({ ...current, [key]: value }));
  }

  function resetView() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  function capturePoseByPetId() {
    const poseByPetId: Record<string, number | undefined> = {};
    for (const pet of campPets) {
      const live = actorHandles.current.get(pet.id)?.getFrameIndex();
      if (typeof live === "number") {
        poseByPetId[pet.id] = live;
      }
    }
    return poseByPetId;
  }

  async function exportPng() {
    setBusy(true);
    setMessage(null);
    try {
      if (campPets.length === 0) throw new Error("还没有宠物可以合影");
      const poseByPetId = capturePoseByPetId();
      const canvas = await composeCampPhoto({
        pets: campPets,
        background,
        nameMode,
        slogan,
        aspect,
        showGroupCarpets: showCarpets,
        poseByPetId,
      });
      await downloadCanvasPng(canvas, "vibecoding-camp-all.png");
      setMessage("图片已保存，可以去发啦。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  function onPointerDown(event: JSX.TargetedPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: pan.x,
      originY: pan.y,
      moved: false,
    };
  }

  function onPointerMove(event: JSX.TargetedPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    if (zoom <= 1) return;
    setPan({ x: drag.originX + dx, y: drag.originY + dy });
  }

  function onPointerUp(event: JSX.TargetedPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const wasDrag = drag.moved;
    dragRef.current = null;
    if (wasDrag) return;

    // Click empty stage → clear selection; click near a slot via hit-test fallback.
    const stageEl = stageRef.current;
    if (!stageEl) {
      setSelectedPetId(null);
      return;
    }
    const rect = stageEl.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const nx = (event.clientX - rect.left) / rect.width;
    const ny = (event.clientY - rect.top) / rect.height;
    const hit = campSlotHitTest(slots, nx, ny);
    if (hit) {
      const pet = campPets.find((item) => item.id === hit.petId) ?? null;
      setSelectedPetId(pet?.id ?? null);
    } else {
      setSelectedPetId(null);
    }
  }

  return (
    <div className="photo-booth-overlay fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="photo-booth-panel camp-photo-panel flex max-h-[100dvh] w-full max-w-7xl flex-col overflow-hidden rounded-t-[1.85rem] border border-white/70 bg-white/95 shadow-[var(--shadow-panel)] backdrop-blur-xl sm:max-h-[min(960px,calc(100dvh-2rem))] sm:rounded-[1.85rem]">
        <header className="relative flex items-center justify-between gap-3 border-b border-line/80 px-4 py-4 sm:px-6">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
          <div className="min-w-0">
            <h2 className="truncate text-xl font-extrabold tracking-tight text-ink">全营纪念照</h2>
            <p className="mt-0.5 text-xs text-muted">
              {campPets.length > 0
                ? `已经有 ${campPets.length} 只宠物入场啦`
                : "还没有宠物来合影"}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="hidden rounded-full border border-line bg-canvas/80 p-1 sm:inline-flex" role="group" aria-label="画幅">
              {CAMP_ASPECT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  title={option.hint}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    aspect === option.id
                      ? "bg-white text-brand shadow-sm"
                      : "text-muted hover:text-ink"
                  }`}
                  onClick={() => {
                    setAspect(option.id);
                    resetView();
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-full border border-line bg-white text-xl text-ink-soft transition hover:border-brand/30 hover:text-brand active:scale-95"
              aria-label="关闭全营纪念照"
              onClick={onClose}
            >
              ×
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[minmax(0,0.58fr)_minmax(0,1.52fr)]">
          <section className="flex min-h-0 flex-col border-b border-line/80 lg:border-b-0 lg:border-r">
            <div className="flex gap-1 border-b border-line/70 bg-canvas/50 p-2">
              {([
                ["scene", "场景"],
                ["slogan", "标语"],
                ["name", "名牌"],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`flex-1 rounded-xl px-2 py-2 text-sm font-semibold transition sm:px-3 ${
                    panel === id
                      ? "bg-white text-brand shadow-sm"
                      : "text-muted hover:text-ink"
                  }`}
                  onClick={() => setPanel(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-auto p-3 sm:p-4">
              <div className="sm:hidden">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-muted">画幅</p>
                <div className="grid grid-cols-2 gap-2">
                  {CAMP_ASPECT_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={`rounded-2xl border px-3 py-2.5 text-left transition ${
                        aspect === option.id
                          ? "border-brand bg-brand-soft text-brand"
                          : "border-line bg-white text-ink-soft"
                      }`}
                      onClick={() => {
                        setAspect(option.id);
                        resetView();
                      }}
                    >
                      <span className="block text-sm font-semibold">{option.label}</span>
                      <span className="mt-0.5 block text-[11px] opacity-80">{option.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              {panel === "scene" ? (
                <>
                  <p className="text-sm leading-6 text-muted">
                    换个背景，挑一张你喜欢的。
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {PHOTO_BACKGROUNDS.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`group overflow-hidden rounded-2xl border p-2 text-left transition ${
                          item.id === backgroundId
                            ? "border-brand ring-2 ring-brand/15"
                            : "border-line hover:border-brand/25"
                        }`}
                        onClick={() => setBackgroundId(item.id)}
                      >
                        <span
                          className="photo-bg-swatch mb-2 block h-14 rounded-xl transition duration-500 group-hover:scale-[1.03]"
                          style={backgroundStyle(item)}
                        />
                        <span className="flex items-center justify-between gap-1">
                          <span className="text-sm font-medium">{item.label}</span>
                          {item.id === CEREMONY_BACKGROUND_ID ? (
                            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                              推荐
                            </span>
                          ) : null}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              ) : null}

              {panel === "slogan" ? (
                <div className="space-y-4">
                  <p className="text-sm leading-6 text-muted">
                    想写点什么就改这里，右边会马上看到效果。
                  </p>
                  <label className="flex flex-col gap-1.5 text-sm">
                    <span className="text-xs font-bold uppercase tracking-[0.12em] text-muted">标题文字</span>
                    <input
                      className="rounded-2xl border border-line bg-canvas/60 px-3 py-2.5 outline-none transition focus:border-brand/40 focus:bg-white focus:ring-4 focus:ring-brand/10"
                      type="text"
                      maxLength={48}
                      placeholder="VibeCoding夏令营 全营合影留念"
                      value={slogan.text}
                      onInput={(event) => updateSlogan("text", (event.target as HTMLInputElement).value)}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm">
                    <span className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.12em] text-muted">
                      <span>字号</span>
                      <span className="tabular-nums text-ink-soft">{slogan.size}px</span>
                    </span>
                    <input
                      type="range"
                      min={22}
                      max={72}
                      step={1}
                      value={slogan.size}
                      onInput={(event) => updateSlogan("size", Number((event.target as HTMLInputElement).value))}
                      className="accent-brand"
                    />
                  </label>
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-muted">样式</p>
                    <div className="grid grid-cols-4 gap-2">
                      {SLOGAN_STYLE_OPTIONS.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          className={`rounded-xl border px-2 py-2 text-xs font-semibold transition ${
                            slogan.style === option.id
                              ? "border-brand bg-brand-soft text-brand"
                              : "border-line bg-white text-ink-soft hover:border-brand/25"
                          }`}
                          onClick={() => updateSlogan("style", option.id)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-muted">位置</p>
                    <div className="grid grid-cols-3 gap-2">
                      {SLOGAN_POSITION_OPTIONS.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          className={`rounded-xl border px-2 py-2 text-xs font-semibold transition ${
                            slogan.position === option.id
                              ? "border-brand bg-brand-soft text-brand"
                              : "border-line bg-white text-ink-soft hover:border-brand/25"
                          }`}
                          onClick={() => updateSlogan("position", option.id as SloganPosition)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-canvas/50 px-3 py-2.5 text-sm">
                    <span className="font-medium text-ink-soft">文字颜色</span>
                    <input
                      type="color"
                      value={slogan.color}
                      onInput={(event) => updateSlogan("color", (event.target as HTMLInputElement).value)}
                      className="h-9 w-14 cursor-pointer rounded-lg border border-line bg-white p-1"
                    />
                  </label>
                  <button
                    type="button"
                    className="w-full rounded-2xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink-soft transition hover:border-brand/30"
                    onClick={() => setSlogan(buildDefaultCampSlogan(campPets.length))}
                  >
                    恢复默认标题
                  </button>
                </div>
              ) : null}

              {panel === "name" ? (
                <div className="space-y-5">
                  <div className="space-y-3">
                    <p className="text-sm leading-6 text-muted">
                      可以给每只宠物脚下加名字，默认先不显示。
                    </p>
                    <div className="grid grid-cols-1 gap-2">
                      {PHOTO_NAME_MODE_OPTIONS.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          className={`rounded-2xl border px-3.5 py-3 text-left transition ${
                            nameMode === option.id
                              ? "border-brand bg-brand-soft text-brand ring-2 ring-brand/10"
                              : "border-line bg-white text-ink-soft hover:border-brand/25"
                          }`}
                          onClick={() => setNameMode(option.id)}
                        >
                          <span className="block text-sm font-semibold">{option.label}</span>
                          <span className={`mt-1 block text-xs leading-5 ${
                            nameMode === option.id ? "text-brand/80" : "text-muted"
                          }`}>
                            {option.hint}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3 border-t border-line/70 pt-4">
                    <p className="text-sm leading-6 text-muted">
                      打开后，同一组会铺上浅色底，更容易找到自己的组。
                    </p>
                    <button
                      type="button"
                      className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                        showCarpets
                          ? "border-brand bg-brand-soft text-brand ring-2 ring-brand/10"
                          : "border-line bg-white text-ink-soft hover:border-brand/25"
                      }`}
                      onClick={() => setShowCarpets((value) => !value)}
                    >
                      <span>
                        <span className="block text-sm font-semibold">按组显示颜色</span>
                        <span className={`mt-1 block text-xs ${showCarpets ? "text-brand/80" : "text-muted"}`}>
                          {showCarpets ? "已打开" : "已关闭"}
                        </span>
                      </span>
                      <span className={`grid h-7 w-12 place-items-center rounded-full text-[11px] font-bold ${
                        showCarpets ? "bg-brand text-white" : "bg-canvas text-muted"
                      }`}>
                        {showCarpets ? "开" : "关"}
                      </span>
                    </button>
                    {showCarpets ? (
                      <div className="flex flex-wrap gap-2">
                        {Array.from(new Set(campPets.map((pet) => groupKeyOf(pet)))).slice(0, 12).map((key) => (
                          <span
                            key={key}
                            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1 text-[11px] font-semibold text-ink-soft"
                          >
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ background: groupCarpetColor(key, 0.9) }}
                            />
                            {key === "none" ? "未分组" : `第 ${key} 组`}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          <section className="flex min-h-0 flex-col gap-3 overflow-hidden p-4 sm:p-5">
            <div
              ref={viewportRef}
              className="camp-stage-viewport relative min-h-0 flex-1 overflow-hidden rounded-[1.5rem] border border-line/80 bg-slate-950/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_18px_40px_rgba(15,23,42,0.08)]"
              style={{ touchAction: "none" }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <div
                ref={frameRef}
                className="camp-stage-frame flex h-full min-h-[240px] w-full items-center justify-center overflow-hidden p-2 sm:p-3"
              >
                <div
                  ref={stageRef}
                  className="photo-stage camp-stage relative origin-center will-change-transform"
                  style={{
                    width: stageFit.width > 0 ? `${stageFit.width}px` : "100%",
                    height: stageFit.height > 0 ? `${stageFit.height}px` : undefined,
                    aspectRatio: `${stage.width} / ${stage.height}`,
                    maxWidth: "100%",
                    maxHeight: "100%",
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transition: dragRef.current ? undefined : "transform 120ms ease-out",
                  }}
                >
                  <CampStageBackdrop background={background} width={stage.width} height={stage.height} />
                  <CampStageAtmosphere fx={sceneFx} />

                  {/* Soft frame overlay matching export chrome */}
                  <div
                    className={`pointer-events-none absolute inset-[1.6%] z-20 rounded-[0.9rem] border ${
                      dark ? "border-amber-300/35" : "border-slate-900/10"
                    }`}
                    aria-hidden="true"
                  />
                  <div
                    className={`pointer-events-none absolute inset-[2.3%] z-20 rounded-[0.7rem] border ${
                      dark ? "border-amber-200/15" : "border-brand/10"
                    }`}
                    aria-hidden="true"
                  />

                  {carpetRuns.map((run) => (
                    <div
                      key={run.key}
                      className="pointer-events-none absolute z-[5] rounded-[100%] opacity-90 blur-[0.5px]"
                      style={{
                        left: `${run.left}%`,
                        top: `${run.top}%`,
                        width: `${run.width}%`,
                        height: `${run.height}%`,
                        background: `radial-gradient(ellipse at center, ${run.color}, transparent 70%)`,
                      }}
                      aria-hidden="true"
                    />
                  ))}

                  {slogan.text.trim() ? (
                    <div className={`pointer-events-none absolute inset-0 z-20 flex p-4 sm:p-6 ${sloganPositionClass(slogan.position)}`}>
                      <div
                        className={`photo-slogan-live max-w-[92%] ${sloganLiveClass(slogan.style, dark)}`}
                        style={{
                          color: slogan.color,
                          fontSize: `clamp(0.75rem, ${(slogan.size / 18)}cqi, ${Math.round(slogan.size * 0.62)}px)`,
                          lineHeight: 1.15,
                        }}
                      >
                        {slogan.text.trim()}
                      </div>
                    </div>
                  ) : null}

                  {campPets.length === 0 ? (
                    <div className="absolute inset-0 z-10 grid place-items-center px-6 text-center">
                      <div className={`max-w-sm rounded-2xl px-5 py-5 text-sm backdrop-blur-md ${
                        dark ? "bg-slate-950/45 text-slate-100" : "bg-white/75 text-muted"
                      }`}>
                        <p className="text-base font-bold text-current">还没有宠物来合影</p>
                        <p className="mt-2 leading-6 opacity-90">
                          大家提交宠物后，就会自动出现在这里一起合影。
                        </p>
                      </div>
                    </div>
                  ) : (
                    campPets.map((pet, index) => {
                      const slot = slotByPetId.get(pet.id);
                      if (!slot) return null;
                      return (
                        <CampActor
                          key={pet.id}
                          pet={pet}
                          index={index}
                          slot={slot}
                          nameMode={nameMode}
                          dark={dark}
                          animate={shouldAnimate}
                          selected={selectedPetId === pet.id}
                          onReady={handleActorReady}
                          onSelect={(next) => setSelectedPetId(next.id)}
                        />
                      );
                    })
                  )}
                </div>
              </div>

              {selectedPet ? (
                <div className={`absolute bottom-3 left-3 right-3 z-40 mx-auto max-w-md rounded-2xl border px-3.5 py-3 shadow-lg backdrop-blur-md sm:left-auto sm:right-3 sm:mx-0 ${
                  dark
                    ? "border-white/10 bg-slate-950/75 text-slate-50"
                    : "border-line bg-white/92 text-ink"
                }`}>
                  <div className="flex items-start gap-3">
                    {selectedPet.posterUrl ? (
                      <img
                        src={selectedPet.posterUrl}
                        alt=""
                        className="pixelated h-14 w-14 shrink-0 object-contain"
                      />
                    ) : (
                      <div className="grid h-14 w-14 place-items-center rounded-xl bg-canvas text-[10px] text-muted">无图</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{selectedPet.petName}</p>
                      <p className="mt-0.5 truncate text-xs opacity-80">
                        {selectedPet.nickname || selectedPet.githubLogin || "学员作品"}
                        {groupKeyOf(selectedPet) !== "none" ? ` · 第 ${groupKeyOf(selectedPet)} 组` : " · 未分组"}
                      </p>
                      {selectedPet.githubLogin ? (
                        <p className="mt-0.5 truncate text-[11px] opacity-70">@{selectedPet.githubLogin}</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="grid h-8 w-8 place-items-center rounded-full border border-white/20 text-lg opacity-80 transition hover:opacity-100"
                      aria-label="关闭信息"
                      onClick={() => setSelectedPetId(null)}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex shrink-0 flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-1 rounded-full border border-line bg-canvas/70 p-1">
                  <button
                    type="button"
                    className="grid h-8 w-8 place-items-center rounded-full text-sm font-bold text-ink-soft transition hover:bg-white hover:text-brand"
                    aria-label="缩小"
                    onClick={() => setZoom((value) => Math.max(1, Number((value - 0.25).toFixed(2))))}
                  >
                    −
                  </button>
                  <span className="min-w-[3.5rem] text-center text-xs font-semibold tabular-nums text-muted">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    type="button"
                    className="grid h-8 w-8 place-items-center rounded-full text-sm font-bold text-ink-soft transition hover:bg-white hover:text-brand"
                    aria-label="放大"
                    onClick={() => setZoom((value) => Math.min(4, Number((value + 0.25).toFixed(2))))}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className="rounded-full px-2.5 py-1.5 text-xs font-semibold text-ink-soft transition hover:bg-white hover:text-brand"
                    onClick={resetView}
                  >
                    回正
                  </button>
                </div>
                <p className="text-xs text-muted">可以放大、拖动查看；点宠物能看是谁</p>
              </div>

              {message ? (
                <p className="text-sm text-ink-soft" role="status">{message}</p>
              ) : (
                <p className="text-sm text-muted">
                  {campPets.length === 0
                    ? "等有宠物入场后，就可以保存图片了。"
                    : "调好看一点，再保存图片发朋友圈吧。"}
                </p>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  className="rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(59,130,246,0.25)] transition hover:bg-brand-dark active:scale-[0.98] disabled:opacity-50"
                  disabled={!canExport}
                  onClick={exportPng}
                >
                  {busy ? "保存中…" : "导出 PNG"}
                </button>
                <button
                  type="button"
                  className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink-soft transition hover:border-brand/30 active:scale-[0.98]"
                  onClick={onClose}
                >
                  关闭
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function CampStageBackdrop({
  background,
  width,
  height,
}: {
  background: PhotoBackground;
  width: number;
  height: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const fallbackStyle = useMemo(() => backgroundStyle(background), [background]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    setReady(false);

    const paint = async () => {
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      try {
        let image: HTMLImageElement | null = null;
        if (background.type === "image") {
          image = await requestImage(background.src, {
            anonymous: background.src.startsWith("http"),
          });
        }
        if (cancelled) return;
        paintSceneBackground(ctx, background, width, height, image);
        if (!cancelled) setReady(true);
      } catch {
        if (!cancelled) setReady(false);
      }
    };

    void paint();
    return () => {
      cancelled = true;
    };
  }, [background, width, height]);

  return (
    <>
      <div
        className={`photo-stage-bg absolute inset-0 transition-opacity duration-500 ${
          ready ? "opacity-0" : "opacity-100"
        }`}
        style={fallbackStyle}
        aria-hidden="true"
      />
      <canvas
        ref={canvasRef}
        className={`photo-stage-canvas absolute inset-0 h-full w-full object-fill transition-opacity duration-500 ${
          ready ? "opacity-100" : "opacity-0"
        }`}
        width={width}
        height={height}
        aria-hidden="true"
      />
    </>
  );
}

function CampStageAtmosphere({ fx }: { fx: PhotoSceneFx | null }) {
  if (!fx || reduceMotion) return null;

  if (fx === "ceremony") {
    return (
      <div className="photo-fx photo-fx-ceremony" aria-hidden="true">
        {Array.from({ length: 16 }, (_, i) => (
          <span key={i} className={`photo-fx-spark photo-fx-spark-${i % 10}`} />
        ))}
      </div>
    );
  }

  if (fx === "sunny") {
    return (
      <div className="photo-fx photo-fx-sunny" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className={`photo-fx-spark photo-fx-spark-${i}`} />
        ))}
      </div>
    );
  }

  if (fx === "snow") {
    return (
      <div className="photo-fx photo-fx-snow" aria-hidden="true">
        {Array.from({ length: 20 }, (_, i) => (
          <span key={i} className={`photo-fx-flake photo-fx-flake-${i}`} />
        ))}
      </div>
    );
  }

  if (fx === "mint") {
    return (
      <div className="photo-fx photo-fx-mint" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className={`photo-fx-leaf photo-fx-leaf-${i}`} />
        ))}
      </div>
    );
  }

  if (fx === "dusk") {
    return (
      <div className="photo-fx photo-fx-dusk" aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} className={`photo-fx-dusk-star photo-fx-dusk-star-${i}`} />
        ))}
      </div>
    );
  }

  if (fx === "neon-rain") {
    return (
      <div className="photo-fx photo-fx-neon-glass" aria-hidden="true">
        {Array.from({ length: 16 }, (_, i) => (
          <span key={i} className={`photo-fx-window-drop photo-fx-window-drop-${i % 22}`} />
        ))}
      </div>
    );
  }

  if (fx === "starry") {
    return (
      <div className="photo-fx photo-fx-starry" aria-hidden="true">
        {Array.from({ length: 14 }, (_, i) => (
          <span key={i} className={`photo-fx-star photo-fx-star-${i % 18}`} />
        ))}
      </div>
    );
  }

  if (fx === "sakura") {
    return (
      <div className="photo-fx photo-fx-sakura" aria-hidden="true">
        {Array.from({ length: 16 }, (_, i) => (
          <span key={i} className={`photo-fx-petal photo-fx-petal-${i % 22}`} />
        ))}
      </div>
    );
  }

  return null;
}
