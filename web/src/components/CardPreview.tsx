import { useEffect, useRef, useState } from "preact/hooks";
import { SpriteAnimator, getDefaultState, loadSpriteImage, reduceMotion, safeExternalUrl } from "../lib/media";
import type { DensityMode, Pet } from "../lib/types";

type Props = {
  pet: Pet;
  eager?: boolean;
  className?: string;
  density?: DensityMode;
  accentColor?: string;
  glowColor?: string;
};

/** Soft radial auras inspired by petdex cards */
export const CARD_AURAS = [
  { accent: "#c4a484", glow: "rgba(196,164,132,0.45)", soft: "rgba(255,244,230,0.95)" },
  { accent: "#60a5fa", glow: "rgba(96,165,250,0.42)", soft: "rgba(235,245,255,0.95)" },
  { accent: "#f59e0b", glow: "rgba(245,158,11,0.40)", soft: "rgba(255,248,230,0.95)" },
  { accent: "#f43f5e", glow: "rgba(244,63,94,0.35)", soft: "rgba(255,240,244,0.95)" },
  { accent: "#34d399", glow: "rgba(52,211,153,0.40)", soft: "rgba(236,253,245,0.95)" },
  { accent: "#a78bfa", glow: "rgba(167,139,250,0.40)", soft: "rgba(245,243,255,0.95)" },
  { accent: "#38bdf8", glow: "rgba(56,189,248,0.40)", soft: "rgba(240,249,255,0.95)" },
  { accent: "#fb7185", glow: "rgba(251,113,133,0.35)", soft: "rgba(255,241,242,0.95)" },
] as const;

export function auraForPet(petId: string) {
  return CARD_AURAS[Math.abs(hashId(petId)) % CARD_AURAS.length];
}

const STAGE_ASPECT: Record<DensityMode, string> = {
  cozy: "aspect-[1/1.02]",
  comfortable: "aspect-[5/4.55]",
  compact: "aspect-[5/4.15]",
};

const STAGE_PAD: Record<DensityMode, string> = {
  cozy: "p-3 sm:p-4",
  comfortable: "p-2.5 sm:p-3.5",
  compact: "p-2 sm:p-2.5",
};

/** How much of the stage the sprite may fill (upscale allowed). */
const SPRITE_BOX: Record<DensityMode, string> = {
  cozy: "h-[94%] w-[94%]",
  comfortable: "h-[92%] w-[92%]",
  compact: "h-[94%] w-[94%]",
};

export function CardPreview({
  pet,
  eager = false,
  className = "",
  density = "comfortable",
  accentColor,
  glowColor,
}: Props) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const [broken, setBroken] = useState(!pet.posterUrl);
  const [animated, setAnimated] = useState(false);
  const aura = auraForPet(pet.id);
  const accent = accentColor ?? aura.accent;
  const glow = glowColor ?? aura.glow;
  const soft = aura.soft;
  const spriteBox = SPRITE_BOX[density];

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let animator: SpriteAnimator | null = null;
    let canvas: HTMLCanvasElement | null = null;
    const previewUrl = safeExternalUrl(pet.previewUrl);
    const state = getDefaultState(pet.spriteGrid);

    const activate = () => {
      if (reduceMotion || animator || !previewUrl || !state) return;
      canvas = document.createElement("canvas");
      // Keep the original h-full scale; center with translate instead of inset-0 + m-auto
      // so width never stretch-resolves and jumps when the sheet becomes ready.
      canvas.className = [
        "sprite-canvas pixelated absolute left-1/2 top-1/2",
        "h-full w-auto max-h-full max-w-full -translate-x-1/2 -translate-y-1/2",
        "opacity-0 transition-opacity duration-300",
        "drop-shadow-[0_14px_22px_rgba(15,23,42,0.14)]",
      ].join(" ");
      canvas.width = Number(pet.previewFrameWidth) || 192;
      canvas.height = Number(pet.previewFrameHeight) || 208;
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", `${pet.petName} 的${state.label}状态动画`);
      host.append(canvas);
      animator = new SpriteAnimator({
        canvas,
        url: previewUrl,
        grid: pet.spriteGrid,
        state,
        // Share the in-memory sheet cache with the detail dialog.
        imageLoader: loadSpriteImage,
        onReady: () => {
          canvas?.classList.add("opacity-100");
          setAnimated(true);
        },
        onError: () => {
          animator?.destroy();
          animator = null;
          canvas?.remove();
          canvas = null;
        },
      });
    };

    const deactivate = () => {
      animator?.destroy();
      animator = null;
      canvas?.remove();
      canvas = null;
      setAnimated(false);
    };

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) activate();
        else deactivate();
      }
    }, { rootMargin: "240px 0px", threshold: 0.01 });

    observer.observe(host);
    return () => {
      observer.disconnect();
      deactivate();
    };
  }, [pet, density]);

  const posterUrl = safeExternalUrl(pet.posterUrl);

  return (
    <span
      className={`relative flex w-full items-center justify-center overflow-hidden ${STAGE_ASPECT[density]} ${className}`}
      style={{
        background: `
          radial-gradient(circle at 50% 42%, ${glow} 0%, transparent 58%),
          radial-gradient(circle at 50% 100%, rgba(255,255,255,0.9) 0%, transparent 42%),
          linear-gradient(180deg, ${soft} 0%, #ffffff 100%)
        `,
      }}
      data-animated={animated ? "true" : "false"}
    >
      <span
        className="pointer-events-none absolute inset-x-8 top-0 h-[2px] rounded-full opacity-90"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
      />
      <span className="pointer-events-none absolute inset-x-[18%] bottom-[10%] h-8 rounded-[100%] bg-slate-500/10 blur-md" />

      {/* Media box: in-flow poster sets the old scale; canvas overlays with the same box */}
      <span className={`relative flex h-full w-full items-center justify-center ${STAGE_PAD[density]}`}>
        <span ref={hostRef} className={`relative ${spriteBox}`}>
          {posterUrl && !broken ? (
            <img
              src={posterUrl}
              alt={`${pet.petName} 的预览`}
              width={Number(pet.previewFrameWidth) || 192}
              height={Number(pet.previewFrameHeight) || 208}
              loading={eager ? "eager" : "lazy"}
              decoding="async"
              className={`pixelated h-full w-auto max-w-full object-contain drop-shadow-[0_14px_22px_rgba(15,23,42,0.14)] transition duration-300 group-hover:-translate-y-1 ${
                animated ? "opacity-0" : "opacity-100"
              }`}
              onError={() => setBroken(true)}
            />
          ) : (
            <span className="grid h-full place-items-center px-3 text-center text-sm text-muted">
              预览暂时无法显示
            </span>
          )}
        </span>
      </span>
    </span>
  );
}

export function hashId(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  return hash;
}

export function githubAvatarUrl(login: string, size = 64) {
  return `https://github.com/${encodeURIComponent(login)}.png?size=${size}`;
}
