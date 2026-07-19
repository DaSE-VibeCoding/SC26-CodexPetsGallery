import type { DensityMode, GalleryConfig, SortMode } from "../lib/types";
import { DENSITY_LABELS, DENSITY_MODES } from "../lib/density";
import { SORT_HINTS, SORT_LABELS, SORT_MODES } from "../lib/sort";

type HeaderProps = {
  config: GalleryConfig;
  submissionCount: number;
  selectMode: boolean;
  selectedCount: number;
  onToggleSelectMode: () => void;
  onOpenPhotoBooth: () => void;
  onOpenCampPhoto: () => void;
};

export function SiteHeader({
  config,
  submissionCount,
  selectMode,
  selectedCount,
  onToggleSelectMode,
  onOpenPhotoBooth,
  onOpenCampPhoto,
}: HeaderProps) {
  const submitHref = `https://github.com/${config.repository}/issues/new?template=pet-submission.yml`;

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-white/75 backdrop-blur-xl">
      <div className="shell flex min-h-[4.25rem] flex-wrap items-center justify-between gap-3 py-3">
        <a href="./" className="group flex items-center gap-3 no-underline">
          <span className="relative grid h-11 w-11 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-brand to-brand-dark text-[11px] font-black tracking-[0.08em] text-white shadow-[0_8px_20px_rgba(59,130,246,0.28)] transition duration-300 group-hover:scale-105 group-hover:shadow-[0_12px_28px_rgba(59,130,246,0.36)]">
            <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_45%)]" />
            <span className="relative">SC</span>
          </span>
          <span>
            <span className="block text-[15px] font-bold tracking-tight text-ink sm:text-base">{config.pageTitle}</span>
            <span className="block text-xs text-muted">{submissionCount} 份学员作品 · 宠物画廊</span>
          </span>
        </a>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={`rounded-full px-3.5 py-2 text-sm font-semibold transition active:scale-[0.98] ${
              selectMode
                ? "bg-brand text-white shadow-[0_8px_18px_rgba(59,130,246,0.28)]"
                : "border border-line bg-white text-ink-soft hover:border-brand/30 hover:text-brand"
            }`}
            onClick={onToggleSelectMode}
          >
            {selectMode ? `选宠中 ${selectedCount}` : "合影选宠"}
          </button>
          <button
            type="button"
            className="rounded-full border border-line bg-white px-3.5 py-2 text-sm font-semibold text-ink-soft transition hover:border-brand/30 hover:text-brand active:scale-[0.98]"
            onClick={onOpenPhotoBooth}
          >
            打开合影
          </button>
          <button
            type="button"
            className="rounded-full border border-amber-300/70 bg-gradient-to-r from-amber-50 to-violet-50 px-3.5 py-2 text-sm font-semibold text-amber-900 transition hover:border-amber-400 hover:shadow-[0_8px_18px_rgba(245,158,11,0.16)] active:scale-[0.98]"
            onClick={onOpenCampPhoto}
          >
            全营纪念照
          </button>
          <a
            className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white no-underline shadow-[0_10px_22px_rgba(59,130,246,0.28)] transition hover:bg-brand-dark hover:shadow-[0_14px_28px_rgba(59,130,246,0.34)] active:scale-[0.98]"
            href={submitHref}
            target="_blank"
            rel="noreferrer"
          >
            提交我的宠物 <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
    </header>
  );
}

type ToolsProps = {
  query: string;
  group: string;
  sortMode: SortMode;
  density: DensityMode;
  resultSummary: string;
  onQueryChange: (value: string) => void;
  onGroupChange: (value: string) => void;
  onSortModeChange: (value: SortMode) => void;
  onDensityChange: (value: DensityMode) => void;
};

export function GalleryTools({
  query,
  group,
  sortMode,
  density,
  resultSummary,
  onQueryChange,
  onGroupChange,
  onSortModeChange,
  onDensityChange,
}: ToolsProps) {
  return (
    <section className="sticky top-[4.25rem] z-30 py-3">
      <div className="shell">
        <div className="ui-card border-line/90 bg-white/90 px-4 py-3.5 backdrop-blur-xl sm:px-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">搜索</span>
                <input
                  className="rounded-2xl border border-line bg-canvas/60 px-3.5 py-2.5 text-ink outline-none transition placeholder:text-muted/80 focus:border-brand/40 focus:bg-white focus:ring-4 focus:ring-brand/10"
                  type="search"
                  placeholder="宠物名、作者、分组或介绍"
                  value={query}
                  onInput={(event) => onQueryChange((event.target as HTMLInputElement).value)}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">分组</span>
                <input
                  className="rounded-2xl border border-line bg-canvas/60 px-3.5 py-2.5 text-ink outline-none transition placeholder:text-muted/80 focus:border-brand/40 focus:bg-white focus:ring-4 focus:ring-brand/10"
                  type="search"
                  list="group-suggestions"
                  inputMode="numeric"
                  maxLength={2}
                  placeholder="1–33"
                  value={group}
                  onInput={(event) => onGroupChange((event.target as HTMLInputElement).value.replace(/\D/g, ""))}
                />
                <datalist id="group-suggestions">
                  {Array.from({ length: 33 }, (_, index) => (
                    <option key={index + 1} value={String(index + 1)} />
                  ))}
                </datalist>
              </label>
              <div className="flex flex-col gap-1.5 text-sm sm:col-span-2 xl:col-span-1">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">排序</span>
                <div
                  className="inline-flex w-full rounded-2xl border border-line bg-canvas/70 p-1"
                  role="group"
                  aria-label="排序方式"
                >
                  {SORT_MODES.map((mode) => {
                    const active = sortMode === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        title={SORT_HINTS[mode]}
                        aria-label={SORT_HINTS[mode]}
                        aria-pressed={active}
                        className={`relative min-h-10 flex-1 rounded-xl px-2.5 text-sm font-semibold transition active:scale-[0.98] ${
                          active
                            ? "bg-white text-brand shadow-sm ring-1 ring-brand/15"
                            : "text-muted hover:bg-white/60 hover:text-ink"
                        }`}
                        onClick={() => onSortModeChange(mode)}
                      >
                        <span className="inline-flex items-center justify-center gap-1.5">
                          <SortGlyph mode={mode} active={active} />
                          {SORT_LABELS[mode]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 lg:justify-end">
              <p className="text-sm text-muted" aria-live="polite">{resultSummary}</p>
              <div className="inline-flex rounded-full border border-line bg-canvas/70 p-1" role="group" aria-label="卡片密度">
                {DENSITY_MODES.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    title={DENSITY_LABELS[mode]}
                    aria-label={DENSITY_LABELS[mode]}
                    aria-pressed={density === mode}
                    className={`grid h-9 min-w-9 place-items-center rounded-full px-2 text-[11px] font-bold transition ${
                      density === mode
                        ? "bg-white text-brand shadow-sm"
                        : "text-muted hover:text-ink"
                    }`}
                    onClick={() => onDensityChange(mode)}
                  >
                    {mode === "cozy" ? "宽" : mode === "comfortable" ? "中" : "密"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SortGlyph({ mode, active }: { mode: SortMode; active: boolean }) {
  const tone = active ? "text-brand" : "text-muted";
  if (mode === "newest") {
    return (
      <svg className={`h-3.5 w-3.5 ${tone}`} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M4 11.5 8 4.5l4 7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5.5 9.5h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }
  if (mode === "oldest") {
    return (
      <svg className={`h-3.5 w-3.5 ${tone}`} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M4 4.5 8 11.5l4-7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5.5 6.5h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg className={`h-3.5 w-3.5 ${tone}`} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3.5 5.5h5.2M11.5 5.5l-1.6-1.6M11.5 5.5l-1.6 1.6M12.5 10.5H7.3M4.5 10.5l1.6-1.6M4.5 10.5l1.6 1.6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type PaginationProps = {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
};

function visiblePageNumbers(page: number, pageCount: number) {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);
  return [...new Set([
    1,
    page - 1,
    page,
    page + 1,
    pageCount,
  ].filter((item) => item >= 1 && item <= pageCount))].sort((left, right) => left - right);
}

export function Pagination({ page, pageCount, onChange }: PaginationProps) {
  if (pageCount <= 1) return null;
  let previous = 0;

  return (
    <nav className="mt-10 flex items-center justify-center gap-2" aria-label="画廊分页">
      <button
        type="button"
        className="grid h-10 w-10 place-items-center rounded-full border border-line bg-white text-ink-soft transition hover:border-brand/30 hover:text-brand disabled:opacity-40"
        aria-label="上一页"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        ←
      </button>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {visiblePageNumbers(page, pageCount).flatMap((pageNumber) => {
          const nodes = [];
          if (pageNumber - previous > 1) {
            nodes.push(<span key={`e-${pageNumber}`} className="px-1 text-muted" aria-hidden="true">…</span>);
          }
          nodes.push(
            <button
              key={pageNumber}
              type="button"
              className={`grid h-10 min-w-10 place-items-center rounded-full border px-3 text-sm font-semibold transition ${
                pageNumber === page
                  ? "border-brand bg-brand text-white shadow-[0_8px_18px_rgba(59,130,246,0.25)]"
                  : "border-line bg-white text-ink-soft hover:border-brand/30 hover:text-brand"
              }`}
              aria-label={`第 ${pageNumber} 页`}
              aria-current={pageNumber === page ? "page" : undefined}
              onClick={() => onChange(pageNumber)}
            >
              {pageNumber}
            </button>,
          );
          previous = pageNumber;
          return nodes;
        })}
      </div>
      <button
        type="button"
        className="grid h-10 w-10 place-items-center rounded-full border border-line bg-white text-ink-soft transition hover:border-brand/30 hover:text-brand disabled:opacity-40"
        aria-label="下一页"
        disabled={page >= pageCount}
        onClick={() => onChange(page + 1)}
      >
        →
      </button>
    </nav>
  );
}
