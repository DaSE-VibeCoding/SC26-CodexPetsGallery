import { normalizeSpriteGrid, validateSpriteGrid } from "./sprite-format";
import type { GalleryConfig, Pet } from "./types";

const DEFAULT_CONFIG: GalleryConfig = {
  repository: "RheinXenon/SC26-CodexPetsGallery",
  pageTitle: "SC26 宠物画廊",
  eventName: "SummerCamp 2026",
};

const ACCENTS = ["#f0c14b", "#3f9a6f", "#e06b55", "#5b86c4"];

async function fetchJson<T>(url: string, { optional = false } = {}): Promise<T | null> {
  const response = await fetch(url, { cache: "no-store" });
  if (optional && response.status === 404) return null;
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.json() as Promise<T>;
}

export async function loadConfig() {
  return (await fetchJson<GalleryConfig>("gallery.config.json", { optional: true })) ?? DEFAULT_CONFIG;
}

export async function loadExamples(): Promise<Pet[]> {
  const [ids, previewData] = await Promise.all([
    fetchJson<string[]>("examples/manifest.json"),
    fetchJson<{ examples?: Record<string, Partial<Pet>> }>("previews.json", { optional: true }).catch(() => null),
  ]);
  if (!ids) throw new Error("缺少示例清单");

  const examples = await Promise.all(
    ids.map(async (id, index) => {
      const pet = await fetchJson<{
        id: string;
        displayName: string;
        description: string;
        spritesheetPath: string;
        spriteGrid?: Record<string, unknown>;
      }>(`examples/${encodeURIComponent(id)}/pet.json`);
      if (!pet) throw new Error(`缺少示例 ${id}`);
      const spriteGrid = normalizeSpriteGrid(pet.spriteGrid ?? {});
      if (!validateSpriteGrid(spriteGrid)) {
        throw new Error(`${pet.id || id} 的宠物图配置无效`);
      }
      const previews = previewData?.examples?.[id] ?? {};
      return {
        kind: "example" as const,
        id: pet.id?.startsWith("example-") ? pet.id : `example-${id}`,
        petName: pet.displayName,
        nickname: "SC26 示例",
        description: pet.description,
        // Author/original sheet — used for “打开完整立绘”. Playback prefers detailUrl.
        spriteUrl: `examples/${encodeURIComponent(id)}/${pet.spritesheetPath}`,
        ...previews,
        configUrl: `examples/${encodeURIComponent(id)}/pet.json`,
        spriteGrid,
        accent: ACCENTS[index % ACCENTS.length],
      };
    }),
  );
  return examples;
}

export async function loadSubmissions() {
  const data = await fetchJson<{ generatedAt?: string; pets: Array<Record<string, unknown>> }>("pets.json");
  if (!data || !Array.isArray(data.pets)) throw new Error("pets.json 格式无效");

  return {
    generatedAt: data.generatedAt ?? null,
    pets: data.pets.map((pet, index) => {
      const spriteGrid = normalizeSpriteGrid((pet.spriteGrid as Record<string, unknown>) ?? {});
      if (!validateSpriteGrid(spriteGrid) || !pet.spritesheetUrl) {
        throw new Error(`投稿 #${pet.issueNumber} 的宠物数据无效`);
      }
      return {
        ...pet,
        kind: "submission" as const,
        id: `issue-${pet.issueNumber}`,
        petName: String(pet.petName ?? ""),
        nickname: String(pet.nickname ?? ""),
        description: String(pet.description ?? ""),
        // Keep the GitHub attachment as the canonical original; detailUrl is for playback.
        spriteUrl: String(pet.spritesheetUrl),
        spritesheetUrl: String(pet.spritesheetUrl),
        detailUrl: pet.detailUrl ? String(pet.detailUrl) : null,
        spriteGrid,
        accent: ACCENTS[(index + 3) % ACCENTS.length],
      } as Pet;
    }),
  };
}

export { DEFAULT_CONFIG };
