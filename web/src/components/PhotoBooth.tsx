import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { KNOWN_GROUPS, normalizeGroupNumber } from "../lib/gallery-filter";
import {
  DEFAULT_SLOGAN,
  PHOTO_BACKGROUNDS,
  PHOTO_MAX,
  PHOTO_MIN,
  PHOTO_NAME_MODE_OPTIONS,
  SLOGAN_POSITION_OPTIONS,
  SLOGAN_STYLE_OPTIONS,
  backgroundStyle,
  composeGroupPhoto,
  createActorMotion,
  downloadCanvasPng,
  getPreviewPlayback,
  isDarkBackground,
  layoutSlots,
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
  selectedIds: string[];
  onClose: () => void;
  onChangeSelected: (ids: string[]) => void;
  onExitSelectMode: () => void;
};

const STAGE_W = 1600;
const STAGE_H = 900;

type ActorHandle = {
  getFrameIndex: () => number | undefined;
};

function sloganLiveClass(style: SloganStyle, dark: boolean) {
  if (style === "badge") {
    return dark
      ? "rounded-full bg-slate-950/55 px-5 py-2.5 text-white shadow-[0_12px_30px_rgba(0,0,0,0.35)] backdrop-blur-md"
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

function StageActor({
  pet,
  index,
  nameMode,
  dark,
  leftPct,
  bottomPct,
  widthPct,
  onReady,
}: {
  pet: Pet;
  index: number;
  nameMode: PhotoNameMode;
  dark: boolean;
  leftPct: number;
  bottomPct: number;
  widthPct: number;
  onReady: (petId: string, handle: ActorHandle | null) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [animated, setAnimated] = useState(false);
  const [broken, setBroken] = useState(!pet.posterUrl);
  const motion = useMemo(() => createActorMotion(pet.id, Math.random()), [pet.id]);
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

    if (!playback || reduceMotion) {
      onReady(pet.id, null);
      return cleanup;
    }

    canvas = document.createElement("canvas");
    canvas.className = [
      "pixelated photo-actor-sprite absolute left-1/2 top-1/2",
      "h-full w-auto max-h-full max-w-full -translate-x-1/2 -translate-y-1/2",
      "opacity-0 transition-opacity duration-300",
      "drop-shadow-[0_14px_18px_rgba(15,23,42,0.28)]",
    ].join(" ");
    canvas.width = Number(pet.previewFrameWidth) || 192;
    canvas.height = Number(pet.previewFrameHeight) || 208;
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", `${pet.petName} 合影动画`);
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
  }, [pet, motion, onReady]);

  const posterUrl = safeExternalUrl(pet.posterUrl);

  // Actor box bottom == feet baseline (slot.y). Shadow + nameplate sit absolutely
  // below the feet so they never push the sprite upward into the row behind.
  // Matches export geometry in layoutSlots / composeGroupPhoto.
  const zIndex = 10 + index;

  return (
    <div
      className="photo-actor absolute"
      style={{
        left: `${leftPct}%`,
        bottom: `${bottomPct}%`,
        width: `${widthPct}%`,
        zIndex,
        transform: "translateX(-50%)",
        animationDelay: `${index * 70}ms`,
        ["--bob-delay" as string]: motion.bobDelay,
        ["--bob-duration" as string]: motion.bobDuration,
      }}
    >
      <div className="photo-actor-bob relative w-full">
        <div ref={hostRef} className="relative mx-auto aspect-square w-full">
          {posterUrl && !broken ? (
            <img
              src={posterUrl}
              alt={pet.petName}
              width={Number(pet.previewFrameWidth) || 192}
              height={Number(pet.previewFrameHeight) || 208}
              className={`pixelated photo-actor-sprite absolute left-1/2 top-1/2 h-full w-auto max-h-full max-w-full -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow-[0_14px_18px_rgba(15,23,42,0.28)] transition-opacity duration-300 ${
                animated ? "opacity-0" : "opacity-100"
              }`}
              draggable={false}
              onError={() => setBroken(true)}
            />
          ) : !animated ? (
            <div className="grid h-full place-items-center rounded-xl bg-white/50 text-xs text-muted">
              无图
            </div>
          ) : null}
        </div>
      </div>
      <div
        className="photo-actor-shadow pointer-events-none absolute left-1/2 top-full w-[70%] -translate-x-1/2 rounded-[100%] bg-slate-900/20 blur-[3px]"
        style={{ marginTop: "2px", height: "6px" }}
        aria-hidden="true"
      />
      {nameLabel ? (
        <span
          className={`photo-name-tag absolute left-1/2 top-full z-10 max-w-[100%] -translate-x-1/2 truncate rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none sm:text-[11px] ${
            dark
              ? "bg-slate-950/55 text-white"
              : "bg-white/90 text-ink shadow-sm"
          }`}
          style={{ marginTop: "0.45rem" }}
        >
          {nameLabel}
        </span>
      ) : null}
    </div>
  );
}

export function PhotoBooth({
  open,
  allPets,
  selectedIds,
  onClose,
  onChangeSelected,
  onExitSelectMode,
}: Props) {
  const [backgroundId, setBackgroundId] = useState(PHOTO_BACKGROUNDS[0].id);
  const [customBackground, setCustomBackground] = useState<PhotoBackground | null>(null);
  const [groupInput, setGroupInput] = useState("");
  const [nameMode, setNameMode] = useState<PhotoNameMode>("pet");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [slogan, setSlogan] = useState<PhotoSlogan>(DEFAULT_SLOGAN);
  const [panel, setPanel] = useState<"cast" | "scene" | "slogan" | "name">("cast");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const customObjectUrl = useRef<string | null>(null);
  const actorHandles = useRef(new Map<string, ActorHandle>());

  const selectedPets = useMemo(
    () => selectedIds
      .map((id) => allPets.find((pet) => pet.id === id))
      .filter(Boolean) as Pet[],
    [allPets, selectedIds],
  );

  const background: PhotoBackground = customBackground && backgroundId === customBackground.id
    ? customBackground
    : PHOTO_BACKGROUNDS.find((item) => item.id === backgroundId) ?? PHOTO_BACKGROUNDS[0];

  const slots = useMemo(
    () => layoutSlots(selectedPets.length, STAGE_W, STAGE_H),
    [selectedPets.length],
  );

  useEffect(() => {
    return () => {
      if (customObjectUrl.current) {
        URL.revokeObjectURL(customObjectUrl.current);
        customObjectUrl.current = null;
      }
    };
  }, []);

  // Drop handles for pets no longer on stage.
  useEffect(() => {
    const alive = new Set(selectedIds);
    for (const id of [...actorHandles.current.keys()]) {
      if (!alive.has(id)) actorHandles.current.delete(id);
    }
  }, [selectedIds]);

  const handleActorReady = useMemo(() => {
    return (petId: string, handle: ActorHandle | null) => {
      if (handle) actorHandles.current.set(petId, handle);
      else actorHandles.current.delete(petId);
    };
  }, []);

  if (!open) return null;

  function removePet(id: string) {
    onChangeSelected(selectedIds.filter((item) => item !== id));
  }

  function clearAll() {
    onChangeSelected([]);
    setMessage(null);
  }

  function addGroup() {
    const group = normalizeGroupNumber(groupInput);
    if (!group) {
      setMessage("请输入 1–33 的分组数字");
      return;
    }
    const groupPets = allPets.filter((pet) => normalizeGroupNumber(pet.group) === group);
    if (groupPets.length === 0) {
      setMessage(`第 ${group} 组暂时没有可合影的宠物`);
      return;
    }
    const merged = [...selectedIds];
    for (const pet of groupPets) {
      if (!merged.includes(pet.id)) merged.push(pet.id);
    }
    if (merged.length > PHOTO_MAX) {
      setMessage(`合影最多 ${PHOTO_MAX} 只，已尽量加入第 ${group} 组，请再手动调整`);
      onChangeSelected(merged.slice(0, PHOTO_MAX));
      return;
    }
    onChangeSelected(merged);
    setMessage(`已加入第 ${group} 组 ${groupPets.length} 只宠物`);
  }

  function updateSlogan<K extends keyof PhotoSlogan>(key: K, value: PhotoSlogan[K]) {
    setSlogan((current) => ({ ...current, [key]: value }));
  }

  function handleBackgroundUpload(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage("请上传图片文件（PNG / JPG / WebP）");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setMessage("背景图请控制在 8MB 以内");
      return;
    }
    if (customObjectUrl.current) URL.revokeObjectURL(customObjectUrl.current);
    const url = URL.createObjectURL(file);
    customObjectUrl.current = url;
    const next: PhotoBackground = {
      id: "custom-upload",
      label: "自定义",
      type: "image",
      src: url,
    };
    setCustomBackground(next);
    setBackgroundId(next.id);
    setMessage("已加载自定义背景");
  }

  function clearCustomBackground() {
    if (customObjectUrl.current) {
      URL.revokeObjectURL(customObjectUrl.current);
      customObjectUrl.current = null;
    }
    setCustomBackground(null);
    if (backgroundId === "custom-upload") {
      setBackgroundId(PHOTO_BACKGROUNDS[0].id);
    }
  }

  function capturePoseByPetId() {
    const poseByPetId: Record<string, number | undefined> = {};
    for (const pet of selectedPets) {
      const live = actorHandles.current.get(pet.id)?.getFrameIndex();
      if (typeof live === "number") {
        poseByPetId[pet.id] = live;
      } else {
        // No live animator (reduced motion / missing preview): random freeze frame.
        const frames = Math.max(1, getDefaultFrameCount(pet));
        poseByPetId[pet.id] = Math.floor(Math.random() * frames);
      }
    }
    return poseByPetId;
  }

  async function exportPng() {
    setBusy(true);
    setMessage(null);
    try {
      if (selectedPets.length < PHOTO_MIN) throw new Error(`请至少选择 ${PHOTO_MIN} 只宠物`);
      const hasDrawable = selectedPets.every((pet) =>
        safeExternalUrl(pet.posterUrl) || safeExternalUrl(pet.previewUrl),
      );
      if (!hasDrawable) {
        throw new Error("有些宠物暂时没法合影，换几只试试");
      }

      // Freeze near the live stage moment; missing actors get a random frame.
      const poseByPetId = capturePoseByPetId();
      const canvas = await composeGroupPhoto({
        pets: selectedPets,
        background,
        nameMode,
        slogan,
        poseByPetId,
      });
      await downloadCanvasPng(canvas, "sc26-pets-photo.png");
      setMessage("合影已保存。想换姿势的话，再导一次就行。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "导出失败");
    } finally {
      setBusy(false);
    }
  }

  const dark = isDarkBackground(background);
  const sceneFx = resolveSceneFx(background);
  const canExport = selectedPets.length >= PHOTO_MIN && !busy;

  return (
    <div className="photo-booth-overlay fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="photo-booth-panel flex max-h-[100dvh] w-full max-w-6xl flex-col overflow-hidden rounded-t-[1.85rem] border border-white/70 bg-white/95 shadow-[var(--shadow-panel)] backdrop-blur-xl sm:max-h-[min(940px,calc(100dvh-2rem))] sm:rounded-[1.85rem]">
        <header className="relative flex items-center justify-between gap-3 border-b border-line/80 px-4 py-4 sm:px-6">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/50 to-transparent" />
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand">Photo Booth</p>
            <h2 className="truncate text-xl font-extrabold tracking-tight text-ink">宠物合影棚</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full border border-line bg-canvas/80 px-3 py-1 text-xs font-semibold text-muted sm:inline-flex">
              实时预览 · 一键导出
            </span>
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-full border border-line bg-white text-xl text-ink-soft transition hover:border-brand/30 hover:text-brand active:scale-95"
              aria-label="关闭合影"
              onClick={() => {
                onClose();
                onExitSelectMode();
              }}
            >
              ×
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.18fr)]">
          <section className="flex min-h-0 flex-col border-b border-line/80 lg:border-b-0 lg:border-r">
            <div className="flex gap-1 border-b border-line/70 bg-canvas/50 p-2">
              {([
                ["cast", "选宠"],
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

            <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4 sm:p-5">
              {panel === "cast" ? (
                <>
                  <p className="text-sm leading-6 text-muted">
                    先在画廊点选宠物，或按组一键加入，最多 {PHOTO_MAX} 只。选好后在右侧舞台预览，再导出合影图。
                  </p>

                  <div className="flex flex-wrap items-end gap-2">
                    <label className="flex min-w-[8rem] flex-1 flex-col gap-1.5 text-sm">
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-muted">按组加入</span>
                      <input
                        className="rounded-2xl border border-line bg-canvas/60 px-3 py-2.5 outline-none transition focus:border-brand/40 focus:bg-white focus:ring-4 focus:ring-brand/10"
                        list="photo-group-suggestions"
                        inputMode="numeric"
                        maxLength={2}
                        placeholder="1-33"
                        value={groupInput}
                        onInput={(event) => setGroupInput((event.target as HTMLInputElement).value.replace(/\D/g, ""))}
                      />
                      <datalist id="photo-group-suggestions">
                        {KNOWN_GROUPS.map((group) => <option key={group} value={group} />)}
                      </datalist>
                    </label>
                    <button
                      type="button"
                      className="rounded-2xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(59,130,246,0.25)] transition hover:bg-brand-dark active:scale-[0.98]"
                      onClick={addGroup}
                    >
                      加入该组
                    </button>
                    <button
                      type="button"
                      className="rounded-2xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink-soft transition hover:border-brand/30 active:scale-[0.98]"
                      onClick={clearAll}
                    >
                      清空
                    </button>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold">已选 {selectedPets.length}/{PHOTO_MAX}</h3>
                      <span className="text-xs text-muted">
                        名牌：{PHOTO_NAME_MODE_OPTIONS.find((item) => item.id === nameMode)?.label ?? "宠物名"}
                      </span>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {selectedPets.length === 0 ? (
                        <div className="flex w-full items-center justify-center rounded-2xl border border-dashed border-line bg-canvas/40 px-4 py-8 text-sm text-muted">
                          还没选宠物。关掉这里，回画廊点选即可。
                        </div>
                      ) : selectedPets.map((pet, index) => (
                        <div
                          key={pet.id}
                          className="photo-cast-chip relative w-[4.6rem] shrink-0 rounded-2xl border border-line bg-white p-1.5 shadow-sm"
                          style={{ animationDelay: `${index * 40}ms` }}
                        >
                          {pet.posterUrl ? (
                            <img src={pet.posterUrl} alt={pet.petName} className="pixelated mx-auto h-16 w-16 object-contain" />
                          ) : (
                            <div className="grid h-16 place-items-center text-[10px] text-muted">无图</div>
                          )}
                          <p className="truncate px-1 text-center text-[11px] font-medium">{pet.petName}</p>
                          <button
                            type="button"
                            className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-ink text-[10px] text-white transition hover:bg-brand"
                            aria-label={`移除 ${pet.petName}`}
                            onClick={() => removePet(pet.id)}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}

              {panel === "scene" ? (
                <>
                  <p className="text-sm leading-6 text-muted">
                    换个背景试试氛围。导出的合影会和预览一致。
                  </p>
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold">预设背景</h3>
                      <button
                        type="button"
                        className="rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-ink-soft transition hover:border-brand/30 hover:text-brand"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        上传背景
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="hidden"
                        onChange={(event) => {
                          const input = event.target as HTMLInputElement;
                          handleBackgroundUpload(input.files?.[0]);
                          input.value = "";
                        }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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
                          <span className="text-sm font-medium">{item.label}</span>
                        </button>
                      ))}

                      {customBackground ? (
                        <button
                          type="button"
                          className={`group relative overflow-hidden rounded-2xl border p-2 text-left transition ${
                            backgroundId === customBackground.id
                              ? "border-brand ring-2 ring-brand/15"
                              : "border-line hover:border-brand/25"
                          }`}
                          onClick={() => setBackgroundId(customBackground.id)}
                        >
                          <span
                            className="photo-bg-swatch mb-2 block h-14 rounded-xl"
                            style={backgroundStyle(customBackground)}
                          />
                          <span className="text-sm font-medium">自定义</span>
                          <span
                            role="button"
                            tabIndex={0}
                            className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-ink/80 text-[11px] text-white"
                            onClick={(event) => {
                              event.stopPropagation();
                              clearCustomBackground();
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                event.stopPropagation();
                                clearCustomBackground();
                              }
                            }}
                            aria-label="移除自定义背景"
                          >
                            ×
                          </span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="flex min-h-[5.5rem] flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-line bg-canvas/40 p-2 text-sm font-medium text-muted transition hover:border-brand/30 hover:text-brand"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <span className="text-lg">＋</span>
                          上传图片
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs leading-5 text-muted">
                    也可以上传自己的背景图。换设备或刷新后需要重新上传。
                  </p>
                </>
              ) : null}

              {panel === "slogan" ? (
                <div className="space-y-4">
                  <p className="text-sm leading-6 text-muted">
                    给合影加一句标语。改完右侧会马上更新，导出时也会带上。
                  </p>

                  <label className="flex flex-col gap-1.5 text-sm">
                    <span className="text-xs font-bold uppercase tracking-[0.12em] text-muted">标语文案</span>
                    <input
                      className="rounded-2xl border border-line bg-canvas/60 px-3 py-2.5 outline-none transition focus:border-brand/40 focus:bg-white focus:ring-4 focus:ring-brand/10"
                      type="text"
                      maxLength={32}
                      placeholder="写一句合影标语"
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
                      min={20}
                      max={84}
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
                    <span className="font-medium text-ink-soft">标语颜色</span>
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
                    onClick={() => setSlogan(DEFAULT_SLOGAN)}
                  >
                    恢复默认标语
                  </button>
                </div>
              ) : null}

              {panel === "name" ? (
                <div className="space-y-4">
                  <div>
                    <p className="mb-1 text-xs font-bold uppercase tracking-[0.12em] text-muted">名牌内容</p>
                    <p className="mb-3 text-sm leading-6 text-muted">
                      选宠物脚下要不要显示名字，以及显示哪种名字。
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
                  <p className="rounded-2xl border border-line bg-canvas/50 px-3.5 py-3 text-xs leading-5 text-muted">
                    当前：
                    <span className="font-semibold text-ink-soft">
                      {PHOTO_NAME_MODE_OPTIONS.find((item) => item.id === nameMode)?.label ?? "宠物名"}
                    </span>
                    。没有对应信息时，会改用宠物名。
                  </p>
                </div>
              ) : null}
            </div>
          </section>

          <section className="flex min-h-0 flex-col gap-3 overflow-auto p-4 sm:p-5">
            <div className="photo-stage relative aspect-[16/9] w-full overflow-hidden rounded-[1.5rem] border border-line/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_18px_40px_rgba(15,23,42,0.08)]">
              <StageBackdrop background={background} />

              <StageAtmosphere fx={sceneFx} dark={dark} />

              {slogan.text.trim() ? (
                <div className={`pointer-events-none absolute inset-0 z-20 flex p-4 sm:p-6 ${sloganPositionClass(slogan.position)}`}>
                  <div
                    className={`photo-slogan-live max-w-[90%] ${sloganLiveClass(slogan.style, dark)}`}
                    style={{
                      color: slogan.color,
                      fontSize: `clamp(0.85rem, ${(slogan.size / 16)}cqi, ${Math.round(slogan.size * 0.72)}px)`,
                      lineHeight: 1.15,
                    }}
                  >
                    {slogan.text.trim()}
                  </div>
                </div>
              ) : null}

              {selectedPets.length === 0 ? (
                <div className="absolute inset-0 z-10 grid place-items-center px-6 text-center">
                  <div className={`rounded-2xl px-5 py-4 text-sm backdrop-blur-md ${
                    dark ? "bg-slate-950/40 text-slate-200" : "bg-white/70 text-muted"
                  }`}>
                    选好宠物后，它们会出现在这里一起动起来
                  </div>
                </div>
              ) : (
                selectedPets.map((pet, index) => {
                  const slot = slots[index];
                  if (!slot) return null;
                  return (
                    <StageActor
                      key={pet.id}
                      pet={pet}
                      index={index}
                      nameMode={nameMode}
                      dark={dark}
                      leftPct={slot.rx * 100}
                      bottomPct={(1 - slot.ry) * 100}
                      widthPct={slot.rsize * 100}
                      onReady={handleActorReady}
                    />
                  );
                })
              )}

              <div className="pointer-events-none absolute bottom-3 left-3 z-30 rounded-full bg-black/25 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-white/90 backdrop-blur-sm">
                LIVE · {background.label}
              </div>
            </div>

            {message ? (
              <p className="text-sm text-ink-soft" role="status">{message}</p>
            ) : (
              <p className="text-sm text-muted">
                对好画面后点「导出 PNG」。多导几次，姿势可能略有不同，可以挑一张最喜欢的。
              </p>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                className="rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(59,130,246,0.25)] transition hover:bg-brand-dark active:scale-[0.98] disabled:opacity-50"
                disabled={!canExport}
                onClick={exportPng}
              >
                {busy ? "导出中…" : "导出 PNG"}
              </button>
              <button
                type="button"
                className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink-soft transition hover:border-brand/30 active:scale-[0.98]"
                onClick={onClose}
              >
                返回选宠
              </button>
              <button
                type="button"
                className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink-soft transition hover:border-brand/30 active:scale-[0.98]"
                onClick={() => {
                  onClose();
                  onExitSelectMode();
                }}
              >
                完成
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function getDefaultFrameCount(pet: Pet) {
  const state = pet.spriteGrid?.states?.find((item) => item.id === pet.spriteGrid.defaultState)
    ?? pet.spriteGrid?.states?.[0];
  return Math.max(1, state?.frames || 1);
}

/**
 * Live-stage backdrop that reuses the same canvas scene painter as PNG export.
 * This keeps skyline / swirls / décor identical between preview and download.
 */
function StageBackdrop({ background }: { background: PhotoBackground }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  // CSS fallback while canvas paints / for reduced-fidelity quick flash
  const fallbackStyle = useMemo(() => backgroundStyle(background), [background]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    setReady(false);

    const paint = async () => {
      // Render at stage design resolution; CSS scales it to the live box.
      const width = STAGE_W;
      const height = STAGE_H;
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
        // Keep CSS fallback visible if image load fails.
        if (!cancelled) setReady(false);
      }
    };

    void paint();
    return () => {
      cancelled = true;
    };
  }, [background]);

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
        className={`photo-stage-canvas absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
          ready ? "opacity-100" : "opacity-0"
        }`}
        width={STAGE_W}
        height={STAGE_H}
        aria-hidden="true"
      />
    </>
  );
}

/**
 * Live weather particles only.
 * Static décor (skyline, hills, moon, pines…) already lives in the canvas backdrop
 * so we deliberately avoid duplicating it here — keeps preview == export.
 */
function StageAtmosphere({ fx }: { fx: PhotoSceneFx | null; dark: boolean }) {
  if (!fx || reduceMotion) return null;

  if (fx === "sunny") {
    return (
      <div className="photo-fx photo-fx-sunny" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className={`photo-fx-spark photo-fx-spark-${i}`} />
        ))}
        <div className="photo-fx-bird photo-fx-bird-a" />
        <div className="photo-fx-bird photo-fx-bird-b" />
      </div>
    );
  }

  if (fx === "snow") {
    return (
      <div className="photo-fx photo-fx-snow" aria-hidden="true">
        {Array.from({ length: 28 }, (_, i) => (
          <span key={i} className={`photo-fx-flake photo-fx-flake-${i}`} />
        ))}
      </div>
    );
  }

  if (fx === "mint") {
    return (
      <div className="photo-fx photo-fx-mint" aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => (
          <span key={`leaf-${i}`} className={`photo-fx-leaf photo-fx-leaf-${i}`} />
        ))}
        {Array.from({ length: 8 }, (_, i) => (
          <span key={`fly-${i}`} className={`photo-fx-firefly photo-fx-firefly-${i}`} />
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
      <>
        {/* Soft living bokeh over the canvas skyline */}
        <div className="photo-fx photo-fx-neon" aria-hidden="true">
          {Array.from({ length: 10 }, (_, i) => (
            <span key={`bokeh-${i}`} className={`photo-fx-bokeh photo-fx-bokeh-${i}`} />
          ))}
        </div>
        {/* Glass rain sits in front of pets to sell the window plane. */}
        <div className="photo-fx photo-fx-neon-glass" aria-hidden="true">
          {Array.from({ length: 22 }, (_, i) => (
            <span key={`drop-${i}`} className={`photo-fx-window-drop photo-fx-window-drop-${i}`} />
          ))}
          {Array.from({ length: 10 }, (_, i) => (
            <span key={`streak-${i}`} className={`photo-fx-rain-streak photo-fx-rain-streak-${i}`} />
          ))}
        </div>
      </>
    );
  }

  if (fx === "starry") {
    return (
      <div className="photo-fx photo-fx-starry" aria-hidden="true">
        {Array.from({ length: 18 }, (_, i) => (
          <span key={i} className={`photo-fx-star photo-fx-star-${i}`} />
        ))}
      </div>
    );
  }

  if (fx === "sakura") {
    return (
      <div className="photo-fx photo-fx-sakura" aria-hidden="true">
        {Array.from({ length: 22 }, (_, i) => (
          <span key={i} className={`photo-fx-petal photo-fx-petal-${i}`} />
        ))}
      </div>
    );
  }

  return null;
}
