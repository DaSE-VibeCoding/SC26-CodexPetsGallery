import { useEffect, useRef, useState } from "preact/hooks";
import type { JSX } from "preact";
import { SpriteAnimator, getDetailPlaybackUrl } from "../lib/media";
import {
  TRIAL_DRAG_THRESHOLD_PX,
  TRIAL_IDLE_WAIT_MS,
  clampTrialPosition,
  clampTrialScaleStep,
  defaultTrialPosition,
  nextTapAnimation,
  onceDurationMs,
  resolveTrialState,
  runDirectionFromDelta,
  trialScaleHeight,
  type TrialLogicalState,
  type TrialPoint,
  type TrialScaleStep,
} from "../lib/trial-companion";
import type { Pet, SpriteState } from "../lib/types";

type Props = {
  pet: Pet;
  position: TrialPoint | null;
  scaleStep: TrialScaleStep;
  hidden?: boolean;
  onPositionChange: (position: TrialPoint) => void;
  onScaleStepChange: (step: TrialScaleStep) => void;
  onDismiss: () => void;
};

type DragSession = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  dragging: boolean;
  lastDir: "run-left" | "run-right" | null;
  lastClientX: number;
};

type TrialBubble = {
  title: string;
  body: string;
};

type SpecialAction = {
  logical: Extract<TrialLogicalState, "failed" | "review" | "running">;
  icon: string;
  label: string;
};

const BUBBLE_HOLD_MS = 4200;
const GREETING_HOLD_MS = 5200;

const CHROME_BTN_CLASS =
  "grid h-7 w-7 place-items-center rounded-full border border-line bg-white/95 text-sm font-bold text-ink-soft shadow-sm transition hover:border-brand/40 hover:text-brand disabled:opacity-40";

const SPECIAL_ACTIONS: readonly SpecialAction[] = [
  { logical: "failed", icon: "!", label: "播放失败动作" },
  { logical: "review", icon: "◎", label: "播放审阅动作" },
  { logical: "running", icon: "↻", label: "播放处理中动作" },
];

function clearTimer(ref: { current: number | null }) {
  if (ref.current !== null) {
    window.clearTimeout(ref.current);
    ref.current = null;
  }
}

function bubbleFromState(state: SpriteState | null, bodyOverride?: string): TrialBubble | null {
  if (!state) return null;
  const body = (bodyOverride ?? state.description ?? "").trim();
  return {
    title: state.label,
    body: body || state.label,
  };
}

function greetingBody(pet: Pet) {
  const intro = (pet.description || "").trim() || pet.petName;
  return `你好，我是${intro}`;
}

export function TrialCompanion({
  pet,
  position,
  scaleStep,
  hidden = false,
  onPositionChange,
  onScaleStepChange,
  onDismiss,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const animatorRef = useRef<SpriteAnimator | null>(null);
  const onceTimerRef = useRef<number | null>(null);
  const idleTimerRef = useRef<number | null>(null);
  const dragRef = useRef<DragSession | null>(null);
  const lastTapRef = useRef<"waving" | "jumping" | null>(null);
  const positionRef = useRef<TrialPoint | null>(position);
  const sizeRef = useRef({ width: trialScaleHeight(scaleStep), height: trialScaleHeight(scaleStep) });
  const petRef = useRef(pet);
  const [loadError, setLoadError] = useState(false);
  const [chromeSticky, setChromeSticky] = useState(false);
  const [chromePulse, setChromePulse] = useState(false);
  const [bubble, setBubble] = useState<TrialBubble | null>(null);
  const chromePulseTimerRef = useRef<number | null>(null);
  const bubbleTimerRef = useRef<number | null>(null);
  const [size, setSize] = useState({ width: trialScaleHeight(scaleStep), height: trialScaleHeight(scaleStep) });

  const maxHeight = trialScaleHeight(scaleStep);
  petRef.current = pet;
  const specialActions = SPECIAL_ACTIONS.map((action) => ({
    ...action,
    available: Boolean(resolveTrialState(pet.spriteGrid, action.logical)),
  }));
  const hasSpecialActions = specialActions.some((action) => action.available);
  const chromeVisible = chromeSticky || chromePulse;
  const chromeRevealClass = chromeVisible
    ? "opacity-100"
    : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100";

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    sizeRef.current = size;
  }, [size]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    animatorRef.current?.destroy();
    animatorRef.current = null;
    clearTimer(onceTimerRef);
    clearTimer(idleTimerRef);
    clearTimer(bubbleTimerRef);
    lastTapRef.current = null;
    setLoadError(false);
    setBubble(null);
    stage.replaceChildren();

    const currentPet = petRef.current;
    const idle = resolveTrialState(currentPet.spriteGrid, "idle");
    const waving = resolveTrialState(currentPet.spriteGrid, "waving");
    const url = getDetailPlaybackUrl(currentPet);
    if (!idle || !url) {
      setLoadError(true);
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.className = "pixelated trial-companion__sprite h-full w-full";
    canvas.setAttribute("aria-hidden", "true");
    stage.append(canvas);

    const heightCap = trialScaleHeight(scaleStep);
    const introState = waving ?? idle;
    const animator = new SpriteAnimator({
      canvas,
      url,
      grid: currentPet.spriteGrid,
      state: introState,
      forceAnimate: true,
      onReady: () => {
        const naturalW = canvas.width || 1;
        const naturalH = canvas.height || 1;
        const height = heightCap;
        const width = Math.max(48, Math.round((naturalW / naturalH) * height));
        setSize({ width, height });
        canvas.style.width = "100%";
        canvas.style.height = "100%";

        // Summon greeting: wave once and introduce with the pet description.
        showBubble(bubbleFromState(introState, greetingBody(currentPet)), GREETING_HOLD_MS);
        if (waving) {
          clearTimer(onceTimerRef);
          onceTimerRef.current = window.setTimeout(() => {
            onceTimerRef.current = null;
            if (animatorRef.current && idle) animatorRef.current.setState(idle);
            armIdleTimer();
          }, onceDurationMs(waving));
        } else {
          armIdleTimer();
        }
      },
      onError: () => setLoadError(true),
    });
    animatorRef.current = animator;

    return () => {
      clearTimer(onceTimerRef);
      clearTimer(idleTimerRef);
      clearTimer(chromePulseTimerRef);
      clearTimer(bubbleTimerRef);
      animator.destroy();
      if (animatorRef.current === animator) animatorRef.current = null;
      stage.replaceChildren();
    };
    // Remount only when the pet identity/assets change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pet.id, pet.detailUrl, pet.spriteUrl]);

  useEffect(() => {
    const canvas = stageRef.current?.querySelector("canvas");
    if (!canvas || !canvas.width || !canvas.height) {
      setSize({ width: maxHeight, height: maxHeight });
      return;
    }
    const height = maxHeight;
    const width = Math.max(48, Math.round((canvas.width / canvas.height) * height));
    setSize({ width, height });
  }, [maxHeight]);

  useEffect(() => {
    const next = position
      ? clampTrialPosition(position, size)
      : defaultTrialPosition(size);
    if (!position || next.x !== position.x || next.y !== position.y) {
      onPositionChange(next);
    }
  }, [position, size, onPositionChange]);

  useEffect(() => {
    const recenter = () => {
      const current = positionRef.current;
      if (!current) return;
      const next = clampTrialPosition(current, sizeRef.current);
      if (next.x !== current.x || next.y !== current.y) onPositionChange(next);
    };
    window.addEventListener("resize", recenter);
    window.visualViewport?.addEventListener("resize", recenter);
    window.visualViewport?.addEventListener("scroll", recenter);
    return () => {
      window.removeEventListener("resize", recenter);
      window.visualViewport?.removeEventListener("resize", recenter);
      window.visualViewport?.removeEventListener("scroll", recenter);
    };
  }, [onPositionChange]);

  function showBubble(next: TrialBubble | null, holdMs = BUBBLE_HOLD_MS) {
    clearTimer(bubbleTimerRef);
    setBubble(next);
    if (!next) return;
    bubbleTimerRef.current = window.setTimeout(() => {
      bubbleTimerRef.current = null;
      setBubble(null);
    }, holdMs);
  }

  function playLoop(state: SpriteState | null, { announce = true }: { announce?: boolean } = {}) {
    if (!state || !animatorRef.current) return;
    clearTimer(onceTimerRef);
    animatorRef.current.setState(state);
    if (!announce) return;
    // Keep run bubbles short-lived while dragging; other loops linger a bit.
    const hold = state.id.includes("run") || state.id.includes("running") ? 1600 : BUBBLE_HOLD_MS;
    showBubble(bubbleFromState(state), hold);
  }

  function playOnce(state: SpriteState | null, then: SpriteState | null) {
    if (!state || !animatorRef.current) return;
    clearTimer(onceTimerRef);
    animatorRef.current.setState(state);
    showBubble(bubbleFromState(state), Math.max(BUBBLE_HOLD_MS, onceDurationMs(state) + 400));
    onceTimerRef.current = window.setTimeout(() => {
      onceTimerRef.current = null;
      if (then) animatorRef.current?.setState(then);
      armIdleTimer();
    }, onceDurationMs(state));
  }

  function armIdleTimer() {
    clearTimer(idleTimerRef);
    idleTimerRef.current = window.setTimeout(() => {
      idleTimerRef.current = null;
      const grid = petRef.current.spriteGrid;
      const waiting = resolveTrialState(grid, "waiting");
      const idle = resolveTrialState(grid, "idle");
      playLoop(waiting ?? idle);
    }, TRIAL_IDLE_WAIT_MS);
  }

  function bumpActivity() {
    clearTimer(idleTimerRef);
  }

  function applyTap() {
    const grid = petRef.current.spriteGrid;
    const waving = resolveTrialState(grid, "waving");
    const jumping = resolveTrialState(grid, "jumping");
    const idle = resolveTrialState(grid, "idle");
    const choice = nextTapAnimation(lastTapRef.current);
    lastTapRef.current = choice;
    const state = choice === "waving" ? waving ?? jumping : jumping ?? waving;
    playOnce(state, idle);
  }

  function applySpecial(logical: SpecialAction["logical"]) {
    const grid = petRef.current.spriteGrid;
    const state = resolveTrialState(grid, logical);
    const idle = resolveTrialState(grid, "idle");
    if (!state) return;
    bumpActivity();
    playOnce(state, idle);
  }

  function handlePointerDown(event: JSX.TargetedPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("[data-trial-chrome]")) return;

    const root = rootRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const current = positionRef.current ?? { x: rect.left, y: rect.top };

    bumpActivity();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: current.x,
      originY: current.y,
      dragging: false,
      lastDir: null,
      lastClientX: event.clientX,
    };

    try {
      root.setPointerCapture(event.pointerId);
    } catch {
      // ignore
    }
    event.preventDefault();
  }

  function handlePointerMove(event: JSX.TargetedPointerEvent<HTMLDivElement>) {
    const session = dragRef.current;
    if (!session || session.pointerId !== event.pointerId) return;

    const dx = event.clientX - session.startX;
    const dy = event.clientY - session.startY;
    if (!session.dragging) {
      if (Math.hypot(dx, dy) < TRIAL_DRAG_THRESHOLD_PX) return;
      session.dragging = true;
    }

    const next = clampTrialPosition(
      { x: session.originX + dx, y: session.originY + dy },
      sizeRef.current,
    );
    onPositionChange(next);

    const frameDx = event.clientX - session.lastClientX;
    session.lastClientX = event.clientX;
    const dir = runDirectionFromDelta(frameDx, session.lastDir);
    if (dir && dir !== session.lastDir) {
      session.lastDir = dir;
      playLoop(resolveTrialState(petRef.current.spriteGrid, dir));
    }
  }

  function handlePointerUp(event: JSX.TargetedPointerEvent<HTMLDivElement>) {
    const session = dragRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    dragRef.current = null;

    const root = rootRef.current;
    try {
      root?.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }

    const grid = petRef.current.spriteGrid;
    if (session.dragging) {
      const idle = resolveTrialState(grid, "idle");
      const jumping = resolveTrialState(grid, "jumping");
      playOnce(jumping ?? idle, idle);
      armIdleTimer();
      return;
    }

    // Coarse pointers have no hover; briefly reveal chrome so controls are discoverable.
    if (event.pointerType !== "mouse") {
      setChromePulse(true);
      clearTimer(chromePulseTimerRef);
      chromePulseTimerRef.current = window.setTimeout(() => {
        chromePulseTimerRef.current = null;
        setChromePulse(false);
      }, 2200);
    }

    applyTap();
    armIdleTimer();
  }

  function handlePointerCancel(event: JSX.TargetedPointerEvent<HTMLDivElement>) {
    const session = dragRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    dragRef.current = null;
    playLoop(resolveTrialState(petRef.current.spriteGrid, "idle"));
    armIdleTimer();
  }

  function nudgeScale(delta: number) {
    onScaleStepChange(clampTrialScaleStep(scaleStep + delta));
  }

  const left = position?.x ?? 0;
  const top = position?.y ?? 0;

  return (
    <div
      ref={rootRef}
      className={`trial-companion group fixed z-40 touch-none select-none transition-opacity duration-150 ${
        hidden ? "pointer-events-none invisible opacity-0" : "visible opacity-100"
      }`}
      style={{
        left: `${left}px`,
        top: `${top}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
      }}
      role="img"
      aria-label={`${pet.petName} 试用中，可拖动；点击互动；底部按钮切换特殊动作`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onFocusCapture={() => setChromeSticky(true)}
      onBlurCapture={(event) => {
        const next = event.relatedTarget as Node | null;
        if (!rootRef.current?.contains(next)) setChromeSticky(false);
      }}
    >
      {bubble ? (
        <div
          className="trial-companion__bubble pointer-events-none absolute bottom-[calc(100%+48px)] left-1/2 z-10 w-max max-w-[min(240px,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-white/10 bg-slate-950/88 px-3.5 py-2.5 text-left shadow-[0_12px_28px_rgba(15,23,42,0.35)] backdrop-blur-md"
          role="status"
          aria-live="polite"
        >
          <p className="text-[12px] font-semibold leading-4 tracking-wide text-white">
            {bubble.title}
          </p>
          <p className="mt-1 line-clamp-3 text-[11px] leading-4 text-slate-300">
            {bubble.body}
          </p>
        </div>
      ) : null}

      <div
        ref={stageRef}
        className="trial-companion__stage relative grid h-full w-full place-items-center drop-shadow-[0_12px_24px_rgba(15,23,42,0.18)]"
      >
        {loadError ? (
          <span className="rounded-full bg-ink/70 px-2 py-1 text-[10px] text-white">加载失败</span>
        ) : null}
      </div>

      {/* Fully outside the sprite box so chrome never covers the pet. */}
      <div
        data-trial-chrome
        className={`trial-companion__chrome absolute bottom-full left-1/2 z-20 mb-2 flex -translate-x-1/2 items-center gap-1 transition ${chromeRevealClass}`}
      >
        <button
          type="button"
          className={CHROME_BTN_CLASS}
          aria-label="缩小试用宠物"
          disabled={scaleStep <= 0}
          onClick={(event) => {
            event.stopPropagation();
            nudgeScale(-1);
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          −
        </button>
        <button
          type="button"
          className={CHROME_BTN_CLASS}
          aria-label="放大试用宠物"
          disabled={scaleStep >= 2}
          onClick={(event) => {
            event.stopPropagation();
            nudgeScale(1);
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          +
        </button>
        <button
          type="button"
          className={`${CHROME_BTN_CLASS} hover:border-coral/40 hover:text-coral`}
          aria-label="送回图鉴"
          onClick={(event) => {
            event.stopPropagation();
            onDismiss();
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          ×
        </button>
      </div>

      {hasSpecialActions ? (
        <div
          data-trial-chrome
          className={`trial-companion__actions absolute left-1/2 top-full z-20 mt-2 flex -translate-x-1/2 items-center gap-1 transition ${chromeRevealClass}`}
        >
          {specialActions.map((action) => (
            <button
              key={action.logical}
              type="button"
              className={CHROME_BTN_CLASS}
              aria-label={action.label}
              title={action.label}
              disabled={!action.available}
              onClick={(event) => {
                event.stopPropagation();
                applySpecial(action.logical);
              }}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <span aria-hidden="true">{action.icon}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
