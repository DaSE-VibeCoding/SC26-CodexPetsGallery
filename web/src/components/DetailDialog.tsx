import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import {
  SpriteAnimator,
  drawSpriteFrame,
  getDefaultState,
  getDetailPlaybackUrl,
  loadSpriteImage,
  safeExternalUrl,
} from "../lib/media";
import { buildShareUrl } from "../lib/url-state";
import type { Pet, SpriteState } from "../lib/types";

type Props = {
  pet: Pet | null;
  trialPetId?: string | null;
  onClose: () => void;
  onStartTrial?: (pet: Pet) => void;
  onDismissTrial?: () => void;
};

function DetailLink({ label, href }: { label: string; href?: string | null }) {
  const safe = safeExternalUrl(href);
  if (!safe) return null;
  return (
    <a
      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3.5 py-2 text-sm font-medium text-ink-soft transition hover:border-brand/40 hover:bg-brand-soft hover:text-brand-dark"
      href={safe}
      target="_blank"
      rel="noreferrer"
    >
      {label}
      <span aria-hidden="true">↗</span>
    </a>
  );
}

export function DetailDialog({
  pet,
  trialPetId = null,
  onClose,
  onStartTrial,
  onDismissTrial,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const animatorRef = useRef<SpriteAnimator | null>(null);
  const [activeState, setActiveState] = useState<SpriteState | null>(null);
  const [copied, setCopied] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const states = useMemo(() => pet?.spriteGrid.states ?? [], [pet]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (pet && !dialog.open) dialog.showModal();
    if (!pet && dialog.open) dialog.close();
  }, [pet]);

  useEffect(() => {
    animatorRef.current?.destroy();
    animatorRef.current = null;
    setLoadError(false);
    setCopied(false);

    if (!pet || !previewRef.current) {
      setActiveState(null);
      return;
    }

    const defaultState = getDefaultState(pet.spriteGrid);
    setActiveState(defaultState);
    const target = previewRef.current;
    target.replaceChildren();

    const imageUrl = getDetailPlaybackUrl(pet);
    if (!imageUrl) {
      setLoadError(true);
      return;
    }

    const canvas = document.createElement("canvas");
    // Seed intrinsic size before the sheet arrives so we never flash the UA
    // default 300×150 box and then jump to the real frame aspect.
    canvas.width = Number(pet.previewFrameWidth) || 192;
    canvas.height = Number(pet.previewFrameHeight) || 208;
    canvas.className = "pixelated relative z-[1] mx-auto max-h-[min(48vh,400px)] w-auto max-w-full opacity-0 transition-opacity duration-200 drop-shadow-[0_18px_30px_rgba(15,23,42,0.14)]";
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", `${pet.petName} 的${defaultState.label}状态动画`);
    const loading = document.createElement("span");
    loading.className = "absolute bottom-4 left-1/2 z-[2] -translate-x-1/2 rounded-full bg-ink/70 px-3 py-1 text-xs text-white backdrop-blur";
    loading.textContent = "正在加载动画…";
    target.append(canvas, loading);

    animatorRef.current = new SpriteAnimator({
      canvas,
      url: imageUrl,
      grid: pet.spriteGrid,
      state: defaultState,
      onReady: () => {
        loading.remove();
        canvas.classList.add("opacity-100");
      },
      onError: () => {
        setLoadError(true);
        target.replaceChildren();
      },
    });

    return () => {
      animatorRef.current?.destroy();
      animatorRef.current = null;
      target.replaceChildren();
    };
  }, [pet]);

  useEffect(() => {
    if (!activeState || !animatorRef.current) return;
    animatorRef.current.setState(activeState);
  }, [activeState]);

  useEffect(() => {
    if (!pet) return;
    for (const state of states) {
      void (async () => {
        const canvas = document.querySelector<HTMLCanvasElement>(`[data-state-thumb="${pet.id}-${state.id}"]`);
        if (!canvas) return;
        try {
          const imageUrl = getDetailPlaybackUrl(pet);
          if (!imageUrl) throw new Error("invalid");
          const image = await loadSpriteImage(imageUrl);
          const context = canvas.getContext("2d");
          if (!context) return;
          const frameWidth = image.naturalWidth / pet.spriteGrid.columns;
          const frameHeight = image.naturalHeight / pet.spriteGrid.rows;
          canvas.width = frameWidth;
          canvas.height = frameHeight;
          drawSpriteFrame(context, image, pet.spriteGrid, state, 0);
        } catch {
          canvas.closest("[data-thumb-wrap]")?.classList.add("opacity-40");
        }
      })();
    }
  }, [pet, states]);

  async function copyLink() {
    if (!pet) return;
    try {
      await navigator.clipboard.writeText(buildShareUrl(pet.id));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="detail-dialog fixed left-1/2 top-1/2 z-50 m-0 w-[min(980px,calc(100%-1rem))] max-h-[min(920px,calc(100%-1.5rem))] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-[1.75rem] border border-line bg-white p-0 text-ink shadow-[var(--shadow-panel)] open:flex open:flex-col backdrop:bg-slate-900/40 backdrop:backdrop-blur-[2px]"
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
      onClose={onClose}
    >
      {pet ? (
        <div className="relative">
          <button
            type="button"
            className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full border border-line bg-white/95 text-xl text-ink-soft shadow-sm transition hover:border-brand/30 hover:text-brand"
            aria-label="关闭详情"
            onClick={() => dialogRef.current?.close()}
          >
            ×
          </button>

          <div className="grid gap-0 lg:grid-cols-[1.2fr_0.9fr]">
            <section className="border-b border-line p-5 sm:p-6 lg:border-b-0 lg:border-r">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                  pet.kind === "example" ? "bg-example-soft text-example" : "bg-brand-soft text-brand-dark"
                }`}>
                  {pet.kind === "example" ? "示例宠物" : `学员作品 #${pet.issueNumber}`}
                </span>
                {pet.group ? (
                  <span className="rounded-full bg-canvas px-2.5 py-1 text-xs font-semibold text-ink-soft">
                    第 {pet.group} 组
                  </span>
                ) : null}
              </div>

              <div
                ref={previewRef}
                className="stage-glow relative grid min-h-[300px] place-items-center overflow-hidden rounded-[1.5rem] border border-line/80 p-5 shadow-inner"
              >
                <span className="pointer-events-none absolute inset-x-[20%] bottom-[12%] h-8 rounded-[100%] bg-slate-500/10 blur-lg" />
                {loadError ? (
                  <span className="text-sm text-muted">图片暂时无法显示</span>
                ) : null}
              </div>

              {activeState ? (
                <div className="mt-4 rounded-2xl border border-line bg-canvas/50 p-4">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand">当前状态</p>
                      <h3 className="mt-1 text-xl font-bold tracking-tight">{activeState.label}</h3>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-brand-dark shadow-sm">
                      {activeState.frames} 帧
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted">{activeState.description}</p>
                </div>
              ) : null}

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {states.map((state) => {
                  const active = state.id === activeState?.id;
                  return (
                    <button
                      key={state.id}
                      type="button"
                      className={`flex items-center justify-between gap-2 rounded-2xl border px-3 py-2.5 text-left transition ${
                        active
                          ? "border-brand/40 bg-brand-soft shadow-sm"
                          : "border-line bg-white hover:border-brand/25"
                      }`}
                      aria-pressed={active}
                      onClick={() => setActiveState(state)}
                    >
                      <span>
                        <strong className="block text-sm tracking-tight">{state.label}</strong>
                        <span className="text-xs text-muted">{state.frames} 帧</span>
                      </span>
                      <span data-thumb-wrap className="grid h-12 w-12 place-items-center overflow-hidden rounded-xl bg-canvas">
                        <canvas data-state-thumb={`${pet.id}-${state.id}`} className="pixelated max-h-full max-w-full" aria-hidden="true" />
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="flex flex-col gap-5 p-5 sm:p-6">
              <header>
                <h2 className="text-3xl font-extrabold tracking-tight">{pet.petName}</h2>
                <p className="mt-2 text-sm text-muted">
                  {pet.kind === "example"
                    ? "官方示例宠物"
                    : `${pet.nickname} · @${pet.githubLogin}`}
                </p>
                <p className="mt-4 text-[15px] leading-7 text-ink-soft">{pet.description}</p>
              </header>

              <div className="flex flex-wrap gap-2">
                {(() => {
                  const isCurrentTrial = Boolean(pet && trialPetId === pet.id);
                  const hasOtherTrial = Boolean(pet && trialPetId && trialPetId !== pet.id);
                  const trialLabel = isCurrentTrial
                    ? "送回图鉴"
                    : hasOtherTrial
                      ? "换成它"
                      : "放到页面上玩玩";
                  return (
                    <button
                      type="button"
                      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold shadow-[0_10px_22px_rgba(59,130,246,0.25)] transition ${
                        isCurrentTrial
                          ? "border border-brand/20 bg-white text-brand-dark hover:border-brand/40"
                          : "bg-brand text-white hover:bg-brand-dark"
                      }`}
                      onClick={() => {
                        if (!pet) return;
                        if (isCurrentTrial) onDismissTrial?.();
                        else onStartTrial?.(pet);
                      }}
                    >
                      {trialLabel}
                    </button>
                  );
                })()}
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink-soft transition hover:border-brand/30 hover:text-brand"
                  onClick={copyLink}
                >
                  {copied ? "已复制链接" : "复制分享链接"}
                </button>
              </div>

              <div>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-muted">相关链接</h3>
                <div className="flex flex-wrap gap-2">
                  {pet.kind === "example" ? (
                    <>
                      <DetailLink label="查看宠物配置" href={pet.configUrl} />
                      <DetailLink label="打开完整立绘" href={pet.spriteUrl} />
                    </>
                  ) : (
                    <>
                      <DetailLink label="作者的 GitHub 主页" href={pet.githubUrl} />
                      <DetailLink label="查看原投稿" href={pet.issueUrl} />
                    </>
                  )}
                </div>
              </div>

              <details className="rounded-2xl border border-line bg-canvas/40 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-ink-soft">更多素材</summary>
                <div className="mt-3 flex flex-wrap gap-2">
                  {pet.kind === "example" ? (
                    <>
                      <DetailLink label="宠物配置" href={pet.configUrl} />
                      <DetailLink label="完整立绘" href={pet.spriteUrl} />
                    </>
                  ) : (
                    <>
                      <DetailLink label="宠物配置" href={pet.petConfigUrl} />
                      <DetailLink label="完整立绘" href={pet.spritesheetUrl} />
                    </>
                  )}
                </div>
              </details>
            </section>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
