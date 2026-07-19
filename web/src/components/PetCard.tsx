import type { Pet } from "../lib/types";
import { CardPreview, auraForPet, githubAvatarUrl } from "./CardPreview";

type Props = {
  pet: Pet;
  index: number;
  density: "cozy" | "comfortable" | "compact";
  selectMode?: boolean;
  selected?: boolean;
  trialPetId?: string | null;
  showTrialShortcut?: boolean;
  onOpen: (pet: Pet) => void;
  onToggleSelect?: (pet: Pet) => void;
  onStartTrial?: (pet: Pet) => void;
  onDismissTrial?: () => void;
};

function padNo(value: number | undefined) {
  if (!value) return "---";
  return String(value).padStart(3, "0");
}

export function PetCard({
  pet,
  index,
  density,
  selectMode = false,
  selected = false,
  trialPetId = null,
  showTrialShortcut = false,
  onOpen,
  onToggleSelect,
  onStartTrial,
  onDismissTrial,
}: Props) {
  const compact = density === "compact";
  const aura = auraForPet(pet.id);
  const numberLabel = pet.kind === "example" ? "EX" : padNo(pet.issueNumber);
  const kindLabel = pet.kind === "example" ? "EXAMPLE" : "SUBMISSION";
  const isCurrentTrial = trialPetId === pet.id;
  const hasOtherTrial = Boolean(trialPetId && trialPetId !== pet.id);
  const trialLabel = isCurrentTrial ? "使用中" : hasOtherTrial ? "换成它" : "试用";

  return (
    <div className="group relative h-full">
      <button
        type="button"
        data-pet-id={pet.id}
        className={`fade-up flex h-full w-full flex-col overflow-hidden rounded-[1.5rem] border bg-white text-left shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_rgba(15,23,42,0.05)] transition duration-300 will-change-transform group-hover:-translate-y-1.5 group-hover:shadow-[0_18px_40px_rgba(59,130,246,0.14),0_6px_16px_rgba(15,23,42,0.06)] active:scale-[0.985] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
          selected ? "border-brand ring-2 ring-brand/20 shadow-[0_12px_28px_rgba(59,130,246,0.16)]" : "border-slate-200/90"
        }`}
        style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}
        aria-label={selectMode ? `${selected ? "取消选择" : "选择"} ${pet.petName}` : `查看 ${pet.petName} 的详情`}
        aria-pressed={selectMode ? selected : undefined}
        onClick={() => {
          if (selectMode) onToggleSelect?.(pet);
          else onOpen(pet);
        }}
      >
        {/* Header row: NO. + accent bar, like petdex */}
        <span className="flex items-center justify-between gap-2 px-4 pt-3.5">
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span className="shrink-0 text-[10px] font-bold tracking-[0.18em] text-slate-400">
              NO. {numberLabel}
            </span>
            <span
              className="h-[2px] min-w-6 flex-1 rounded-full"
              style={{ background: `linear-gradient(90deg, ${aura.accent}, transparent)` }}
            />
          </span>
          {selectMode ? (
            <span className={`grid h-6 w-6 place-items-center rounded-full border text-xs font-bold ${
              selected ? "border-brand bg-brand text-white" : "border-slate-200 bg-white text-slate-400"
            }`}>
              {selected ? "✓" : ""}
            </span>
          ) : pet.kind === "example" ? (
            <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white shadow-sm">
              ★ 示例
            </span>
          ) : (
            <span className="grid h-6 w-6 place-items-center rounded-full border border-slate-200 text-slate-300">
              ···
            </span>
          )}
        </span>

        <CardPreview
          pet={pet}
          eager={index < 6}
          density={density}
          accentColor={aura.accent}
          glowColor={aura.glow}
          className="mt-1"
        />

        <span className={`flex flex-1 flex-col ${compact ? "gap-1.5 px-3.5 pb-3.5 pt-1" : "gap-2 px-4 pb-4 pt-1"}`}>
          <span className="flex items-start justify-between gap-2">
            <strong className={`min-w-0 tracking-tight text-slate-900 ${compact ? "text-[15px]" : "text-lg"}`}>
              {pet.petName}
            </strong>
            <span className="shrink-0 pt-1 text-[10px] font-bold tracking-[0.14em] text-slate-400">
              {kindLabel}
            </span>
          </span>

          <span className={`text-slate-500 ${compact ? "line-clamp-2 text-xs leading-5" : "line-clamp-2 text-sm leading-6"}`}>
            {pet.description}
          </span>

          {pet.kind === "submission" && pet.group ? (
            <span className="inline-flex w-fit rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
              第 {pet.group} 组
            </span>
          ) : pet.kind === "example" ? (
            <span className="inline-flex w-fit rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
              SC26 示例
            </span>
          ) : null}

          <span className={`mt-auto flex items-center gap-2 border-t border-slate-100 pt-2.5 ${compact ? "text-[11px]" : "text-xs"}`}>
            {pet.kind === "submission" && pet.githubLogin ? (
              <>
                <img
                  src={githubAvatarUrl(pet.githubLogin, 48)}
                  alt=""
                  width={22}
                  height={22}
                  className="h-[22px] w-[22px] rounded-full border border-slate-200 object-cover"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={(event) => {
                    (event.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
                <span className="truncate font-medium uppercase tracking-[0.04em] text-slate-500">
                  BY {pet.nickname || pet.githubLogin}
                </span>
              </>
            ) : (
              <span className="truncate font-medium uppercase tracking-[0.04em] text-slate-400">
                SC26 示例
              </span>
            )}
          </span>
        </span>
      </button>

      {showTrialShortcut && !selectMode ? (
        <button
          type="button"
          className={`absolute right-3 top-[4.25rem] z-10 rounded-full border px-2.5 py-1 text-[11px] font-bold shadow-sm transition opacity-0 pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 hover:-translate-y-0.5 ${
            isCurrentTrial
              ? "border-brand/30 bg-brand text-white"
              : "border-line bg-white/95 text-brand-dark hover:border-brand/40"
          }`}
          aria-label={
            isCurrentTrial
              ? `送回 ${pet.petName}`
              : hasOtherTrial
                ? `把试用宠换成 ${pet.petName}`
                : `试用 ${pet.petName}`
          }
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (isCurrentTrial) onDismissTrial?.();
            else onStartTrial?.(pet);
          }}
        >
          {trialLabel}
        </button>
      ) : null}
    </div>
  );
}
