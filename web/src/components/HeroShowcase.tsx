import { useEffect, useMemo, useState } from "preact/hooks";
import type { Pet } from "../lib/types";
import { reduceMotion } from "../lib/media";

type Props = {
  pets: Pet[];
  eventName: string;
  submissionCount: number;
};

const TILTS = [-14, -8, -3, 3, 8, 14];
const LIFTS = [18, 8, 2, 0, 6, 16];

function pickShowcase(pets: Pet[], seed: number, count: number) {
  if (pets.length === 0) return [] as Pet[];
  const pool = [...pets];
  // deterministic shuffle by seed
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.abs((seed * 9301 + i * 49297) % (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  if (pool.length >= count) return pool.slice(0, count);
  const result = [...pool];
  while (result.length < count) {
    result.push(pool[result.length % pool.length]);
  }
  return result;
}

export function HeroShowcase({ pets, eventName, submissionCount }: Props) {
  const [seed, setSeed] = useState(() => Math.floor(Date.now() / 1000) % 10000);

  useEffect(() => {
    if (reduceMotion || pets.length <= 1) return;
    const timer = window.setInterval(() => {
      setSeed((value) => value + 1);
    }, 4200);
    return () => window.clearInterval(timer);
  }, [pets.length]);

  const showcase = useMemo(() => pickShowcase(pets, seed, 6), [pets, seed]);

  return (
    <section className="relative overflow-hidden">
      {/* Petdex-like soft blue-violet premium wash */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 90% 70% at 50% -10%, rgba(255,255,255,0.95) 0%, transparent 55%),
            radial-gradient(ellipse 70% 60% at 15% 40%, rgba(191,219,254,0.55) 0%, transparent 55%),
            radial-gradient(ellipse 80% 70% at 85% 30%, rgba(196,181,253,0.45) 0%, transparent 55%),
            linear-gradient(180deg, #eef4ff 0%, #e8e9ff 42%, #f7f9fc 100%)
          `,
        }}
      />
      {!reduceMotion ? (
        <>
          <div className="hero-float-orb hero-float-orb-a" aria-hidden="true" />
          <div className="hero-float-orb hero-float-orb-b" aria-hidden="true" />
          <div className="hero-float-orb hero-float-orb-c" aria-hidden="true" />
        </>
      ) : null}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-[var(--color-canvas)]" />

      <div className="shell relative py-10 sm:py-14">
        <div className="mx-auto max-w-3xl text-center fade-up">
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-brand">
            {eventName} · Pet Index
          </p>
          <h1 className="mt-4 text-balance text-4xl font-black tracking-tight text-slate-900 sm:text-6xl">
            大家的宠物
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-sm leading-7 text-slate-500 sm:text-base">
            把你做的宠物放上来，逛逛大家的作品，挑几只一起拍张合影。
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <div className="rounded-full border border-white/80 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:shadow-md">
              <span className="tabular-nums text-brand">{submissionCount}</span> 份学员作品
            </div>
            <div className="rounded-full border border-white/80 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-500 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:shadow-md">
              动画展示 · 一键合影 · 轻松分享
            </div>
          </div>
        </div>

        {/* Fan of tilted cards */}
        <div className="relative mx-auto mt-10 flex max-w-5xl items-end justify-center px-2 sm:mt-12">
          <div className="flex items-end justify-center gap-2 sm:gap-3 md:gap-4">
            {showcase.map((pet, index) => {
              const tilt = TILTS[index] ?? 0;
              const lift = LIFTS[index] ?? 0;
              return (
                  <div
                    key={`${pet.id}-${seed}-${index}`}
                    className="hero-fan-card group relative w-[4.6rem] sm:w-[5.6rem] md:w-[6.4rem]"
                    style={{
                      ["--fan-tilt" as string]: `${tilt}deg`,
                      ["--fan-lift" as string]: `${lift}px`,
                      zIndex: index === 2 || index === 3 ? 5 : 3 - Math.abs(index - 2.5),
                      animationDelay: `${index * 60}ms`,
                    }}
                  >
                  <div className="overflow-hidden rounded-[1.15rem] border border-white/90 bg-white/90 p-2 shadow-[0_16px_40px_rgba(79,70,229,0.14),0_4px_12px_rgba(15,23,42,0.06)] backdrop-blur transition duration-500 group-hover:-translate-y-2 group-hover:shadow-[0_22px_48px_rgba(79,70,229,0.18)]">
                    <div
                      className="grid aspect-[4/5] place-items-center rounded-[0.9rem]"
                      style={{
                        background: `
                          radial-gradient(circle at 50% 40%, rgba(147,197,253,0.35), transparent 60%),
                          linear-gradient(180deg, #f8faff, #eef2ff)
                        `,
                      }}
                    >
                      {pet.posterUrl ? (
                        <img
                          src={pet.posterUrl}
                          alt={pet.petName}
                          className="pixelated max-h-[85%] max-w-[85%] object-contain drop-shadow-md transition duration-500 group-hover:-translate-y-1 group-hover:scale-105"
                          loading="eager"
                        />
                      ) : (
                        <span className="text-[10px] text-slate-400">...</span>
                      )}
                    </div>
                    <p className="mt-1.5 truncate text-center text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400 sm:text-[10px]">
                      {pet.petName}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
