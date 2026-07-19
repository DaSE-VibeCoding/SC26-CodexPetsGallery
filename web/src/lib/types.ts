export type SpriteState = {
  id: string;
  label: string;
  row: number;
  frames: number;
  frameDuration: number;
  description?: string;
};

export type SpriteGrid = {
  formatVersion?: string;
  columns: number;
  rows: number;
  defaultState: string;
  states: SpriteState[];
};

export type GalleryConfig = {
  repository: string;
  submissionLabel?: string;
  pageTitle: string;
  eventName: string;
};

export type PetKind = "example" | "submission";

export type Pet = {
  id: string;
  kind: PetKind;
  petName: string;
  nickname: string;
  description: string;
  accent: string;
  spriteUrl: string;
  spriteGrid: SpriteGrid;
  posterUrl?: string | null;
  previewUrl?: string | null;
  /** Same-origin full-grid sheet optimized for the detail player. */
  detailUrl?: string | null;
  previewFrameWidth?: number;
  previewFrameHeight?: number;
  githubLogin?: string;
  githubUrl?: string;
  group?: string | null;
  issueNumber?: number;
  issueUrl?: string;
  petConfigUrl?: string;
  spritesheetUrl?: string;
  configUrl?: string;
  /** Issue creation time (upload time). Preferred for gallery sort. */
  createdAt?: string;
  updatedAt?: string;
};

export type DensityMode = "cozy" | "comfortable" | "compact";

/** Gallery list sort order. Default is newest issue upload first. */
export type SortMode = "newest" | "oldest" | "random";

export type UrlState = {
  petId: string | null;
  query: string;
  group: string;
  page: number;
};

/** Built-in photo-booth atmosphere effects. */
export type PhotoSceneFx =
  | "sunny"
  | "snow"
  | "mint"
  | "dusk"
  | "neon-rain"
  | "starry"
  | "sakura"
  | "ceremony";

export type PhotoBackground =
  | {
      id: string;
      label: string;
      type: "gradient";
      from: string;
      to: string;
      /** Optional mid-stop for richer sky gradients. */
      mid?: string;
      accent?: string;
      /** Force dark UI chrome (nameplates / slogan). */
      dark?: boolean;
      /** Live stage + export atmosphere. */
      fx?: PhotoSceneFx;
    }
  | { id: string; label: string; type: "image"; src: string };

export type SloganStyle = "plain" | "badge" | "outline" | "glow";
export type SloganPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export type PhotoSlogan = {
  text: string;
  size: number;
  style: SloganStyle;
  position: SloganPosition;
  color: string;
};

/** What each actor nameplate shows under the pet. */
export type PhotoNameMode = "hidden" | "pet" | "github" | "nickname";

