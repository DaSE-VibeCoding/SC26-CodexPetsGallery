import { access, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { normalizeGroupNumber } from "../lib/gallery-filter.js";
import { normalizeSpriteGrid, validateSpriteGrid } from "../lib/sprite-format.js";

const FIELD_LABELS = {
  nickname: "学员昵称",
  group: "所属分组",
  description: "一句话介绍",
  files: "宠物文件",
  consent: "公开展示确认",
};

const PET_TITLE_PREFIX = "[宠物投稿]";
const MAX_SPRITE_BYTES = 10 * 1024 * 1024;
// v3: list preview and detail share one full-resolution lossy WebP sheet (q90).
const PREVIEW_PIPELINE_VERSION = "v3";
const SHEET_WEBP_QUALITY = 90;
const SHEET_WEBP_ALPHA_QUALITY = 100;
const DEFAULT_BUILD_CONCURRENCY = 4;
const EXPECTED_SPRITE_FORMATS = new Map([
  ["1536x1872", { formatVersion: "v1", rows: 9 }],
  ["1536x2288", { formatVersion: "v2", rows: 11 }],
]);

const ALLOWED_ATTACHMENT_HOSTS = new Set([
  "user-images.githubusercontent.com",
  "private-user-images.githubusercontent.com",
]);

export function extractFields(body = "") {
  const fields = new Map();
  const headings = [...body.matchAll(/^###\s+(.+?)\s*$/gm)];

  for (const [index, heading] of headings.entries()) {
    const valueStart = heading.index + heading[0].length;
    const valueEnd = headings[index + 1]?.index ?? body.length;
    fields.set(heading[1].trim(), body.slice(valueStart, valueEnd).trim());
  }

  return Object.fromEntries(fields);
}

export function isAllowedGithubAttachment(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;

    if (ALLOWED_ATTACHMENT_HOSTS.has(url.hostname)) return true;
    return url.hostname === "github.com" && url.pathname.startsWith("/user-attachments/");
  } catch {
    return false;
  }
}

export function extractAllowedUrl(value = "") {
  const candidates = value.match(/https:\/\/[^\s<>)\]"']+/g) ?? [];
  return candidates.find(isAllowedGithubAttachment) ?? null;
}

export function extractPetAttachments(value = "") {
  const markdownLinks = [...value.matchAll(/(!?)\[([^\]]*)\]\((https:\/\/[^)\s]+)\)/g)]
    .map((match) => ({
      isImage: match[1] === "!",
      name: match[2].trim(),
      url: match[3],
    }));
  const htmlImages = [...value.matchAll(/<img\b[^>]*>/gi)]
    .map((match) => {
      const attributes = new Map();
      for (const attribute of match[0].matchAll(
        /([a-z][\w:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi,
      )) {
        attributes.set(attribute[1].toLowerCase(), attribute[2] ?? attribute[3] ?? attribute[4]);
      }
      return {
        isImage: true,
        name: attributes.get("alt") ?? "",
        url: attributes.get("src") ?? "",
      };
    });
  const links = [...markdownLinks, ...htmlImages]
    .map((link) => {
      const { url } = link;
      if (!isAllowedGithubAttachment(url)) return null;

      let pathName = "";
      try {
        pathName = decodeURIComponent(new URL(url).pathname).toLowerCase();
      } catch {
        return null;
      }
      return {
        isImage: link.isImage,
        name: link.name.toLowerCase(),
        pathName,
        url,
      };
    })
    .filter(Boolean);

  const config = links.find((link) => (
    link.name === "pet.json"
    || link.pathName.endsWith("/pet.json")
  ));
  const spritesheet = links.find((link) => (
    link.name === "spritesheet.webp"
    || link.name === "spritesheet"
    || link.pathName.endsWith("/spritesheet.webp")
  )) ?? (() => {
    const unnamedImages = links.filter((link) => link.isImage && link.url !== config?.url);
    return unnamedImages.length === 1 ? unnamedImages[0] : null;
  })();

  if (!config || !spritesheet || config.url === spritesheet.url) return null;
  return {
    petConfigUrl: config.url,
    spritesheetUrl: spritesheet.url,
  };
}

function cleanSingleLine(value, maxLength) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned || cleaned === "_No response_") return null;
  return cleaned.slice(0, maxLength);
}

export function extractPetName(title = "") {
  const withoutPrefix = title.startsWith(PET_TITLE_PREFIX)
    ? title.slice(PET_TITLE_PREFIX.length)
    : title;
  return cleanSingleLine(withoutPrefix, 80);
}

export function describeSubmissionRejection(issue) {
  if (!issue || issue.pull_request) return "不是有效的投稿 Issue";
  if (issue.state !== "open") return "投稿已关闭";
  if (!issue.user?.login) return "缺少投稿账号信息";

  const fields = extractFields(issue.body ?? "");
  const petName = extractPetName(issue.title ?? "");
  const nickname = cleanSingleLine(fields[FIELD_LABELS.nickname] ?? "", 50);
  const description = cleanSingleLine(fields[FIELD_LABELS.description] ?? "", 160);
  const attachments = extractPetAttachments(fields[FIELD_LABELS.files] ?? "");
  const hasConsent = /-\s*\[x\]/i.test(fields[FIELD_LABELS.consent] ?? "");

  if (!petName) {
    return "标题中缺少宠物名，请把名字写在「[宠物投稿]」后面";
  }
  if (!nickname) return "缺少学员昵称";
  if (!description) return "缺少一句话介绍";
  if (!attachments) {
    return "宠物文件不完整，需要同时包含 pet.json 和 spritesheet.webp 附件";
  }
  if (!hasConsent) return "未勾选公开展示确认";
  return null;
}

export function parseSubmission(issue) {
  if (describeSubmissionRejection(issue)) return null;

  const fields = extractFields(issue.body ?? "");
  return {
    issueNumber: issue.number,
    petName: extractPetName(issue.title ?? ""),
    nickname: cleanSingleLine(fields[FIELD_LABELS.nickname] ?? "", 50),
    group: normalizeGroupNumber(fields[FIELD_LABELS.group]),
    description: cleanSingleLine(fields[FIELD_LABELS.description] ?? "", 160),
    githubLogin: issue.user.login,
    githubUrl: `https://github.com/${encodeURIComponent(issue.user.login)}`,
    ...extractPetAttachments(fields[FIELD_LABELS.files] ?? ""),
    issueUrl: issue.html_url,
    updatedAt: issue.updated_at,
  };
}

function readUInt24LE(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

export function readWebpDimensions(source) {
  const bytes = Buffer.from(source);
  if (bytes.length < 20 || bytes.toString("ascii", 0, 4) !== "RIFF"
    || bytes.toString("ascii", 8, 12) !== "WEBP") return null;

  for (let offset = 12; offset + 8 <= bytes.length;) {
    const type = bytes.toString("ascii", offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;
    if (dataOffset + size > bytes.length) return null;

    if (type === "VP8X" && size >= 10) {
      return {
        width: readUInt24LE(bytes, dataOffset + 4) + 1,
        height: readUInt24LE(bytes, dataOffset + 7) + 1,
      };
    }
    if (type === "VP8L" && size >= 5 && bytes[dataOffset] === 0x2f) {
      const bits = bytes.readUInt32LE(dataOffset + 1);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >>> 14) & 0x3fff) + 1,
      };
    }
    if (type === "VP8 " && size >= 10
      && bytes[dataOffset + 3] === 0x9d
      && bytes[dataOffset + 4] === 0x01
      && bytes[dataOffset + 5] === 0x2a) {
      return {
        width: bytes.readUInt16LE(dataOffset + 6) & 0x3fff,
        height: bytes.readUInt16LE(dataOffset + 8) & 0x3fff,
      };
    }

    offset = dataOffset + size + (size % 2);
  }

  return null;
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function getDefaultState(spriteGrid) {
  return spriteGrid.states.find((state) => state.id === spriteGrid.defaultState)
    ?? spriteGrid.states[0];
}

function previewFileName(petId, digest, kind) {
  const safeId = String(petId).replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "pet";
  return `${safeId}-${digest}-${kind}.webp`;
}

async function materializePreviewAssets(rootDir, previewAssets) {
  if (!previewAssets?.posterUrl || !previewAssets?.previewUrl || !previewAssets?.detailUrl) {
    return false;
  }

  const cacheDir = path.join(rootDir, ".gallery-cache", "previews");
  const publishedDir = path.join(rootDir, "web", "public", "generated", "previews");
  const posterName = path.posix.basename(previewAssets.posterUrl);
  // previewUrl and detailUrl share one full-resolution q90 sheet.
  const sheetNames = [...new Set([
    path.posix.basename(previewAssets.previewUrl),
    path.posix.basename(previewAssets.detailUrl),
  ])];
  const cachedPoster = path.join(cacheDir, posterName);
  const cachedSheets = sheetNames.map((name) => path.join(cacheDir, name));
  if (!await fileExists(cachedPoster)) return false;
  for (const cachedSheet of cachedSheets) {
    if (!await fileExists(cachedSheet)) return false;
  }

  await mkdir(publishedDir, { recursive: true });
  await Promise.all([
    copyFile(cachedPoster, path.join(publishedDir, posterName)),
    ...sheetNames.map((name) => copyFile(path.join(cacheDir, name), path.join(publishedDir, name))),
  ]);
  return true;
}

export async function generatePreviewAssets(source, { petId, spriteGrid, rootDir }) {
  const dimensions = readWebpDimensions(source);
  const defaultState = getDefaultState(spriteGrid);
  if (!dimensions || !defaultState) throw new Error("无法生成精灵图预览");

  const frameWidth = dimensions.width / spriteGrid.columns;
  const frameHeight = dimensions.height / spriteGrid.rows;
  if (!Number.isInteger(frameWidth) || !Number.isInteger(frameHeight)) {
    throw new Error("精灵图尺寸与网格配置不匹配");
  }

  const digest = createHash("sha256")
    .update(PREVIEW_PIPELINE_VERSION)
    .update(source)
    .digest("hex")
    .slice(0, 16);
  const posterName = previewFileName(petId, digest, "poster");
  // One full-grid lossy sheet is reused by list cards and the detail dialog.
  const sheetName = previewFileName(petId, digest, "sheet");
  const cacheDir = path.join(rootDir, ".gallery-cache", "previews");
  const cachedPoster = path.join(cacheDir, posterName);
  const cachedSheet = path.join(cacheDir, sheetName);
  await mkdir(cacheDir, { recursive: true });

  const top = defaultState.row * frameHeight;
  const posterTask = fileExists(cachedPoster).then((exists) => (
    exists
      ? null
      : sharp(source)
        .extract({ left: 0, top, width: frameWidth, height: frameHeight })
        .webp({ lossless: true, effort: 6 })
        .toFile(cachedPoster)
  ));
  const sheetTask = fileExists(cachedSheet).then((exists) => (
    exists
      ? null
      : sharp(source)
        .webp({
          quality: SHEET_WEBP_QUALITY,
          alphaQuality: SHEET_WEBP_ALPHA_QUALITY,
          effort: 6,
        })
        .toFile(cachedSheet)
  ));
  await Promise.all([posterTask, sheetTask]);

  const sheetUrl = `generated/previews/${sheetName}`;
  const previewAssets = {
    posterUrl: `generated/previews/${posterName}`,
    previewUrl: sheetUrl,
    detailUrl: sheetUrl,
    previewFrameWidth: frameWidth,
    previewFrameHeight: frameHeight,
  };
  await materializePreviewAssets(rootDir, previewAssets);
  return previewAssets;
}

function attachmentRequestHeaders(token, accept) {
  const headers = { Accept: accept };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function hydrateSubmission(submission, {
  fetchImpl = fetch,
  getCachedMedia,
  createPreviewAssets,
  token,
} = {}) {
  try {
    const cachedMedia = await getCachedMedia?.(submission);
    if (cachedMedia) {
      return {
        ...submission,
        petId: `issue-${submission.issueNumber}`,
        ...cachedMedia,
      };
    }

    const response = await fetchImpl(submission.spritesheetUrl, {
      headers: attachmentRequestHeaders(token, "image/webp"),
      redirect: "follow",
    });
    if (!response.ok) return null;

    const declaredSize = Number(response.headers?.get?.("content-length") ?? 0);
    if (declaredSize > MAX_SPRITE_BYTES) return null;
    const source = Buffer.from(await response.arrayBuffer());
    if (source.byteLength > MAX_SPRITE_BYTES) return null;
    const dimensions = readWebpDimensions(source);
    const format = dimensions
      ? EXPECTED_SPRITE_FORMATS.get(`${dimensions.width}x${dimensions.height}`)
      : null;
    if (!format) return null;

    const spriteGrid = normalizeSpriteGrid({
      formatVersion: format.formatVersion,
      columns: 8,
      rows: format.rows,
    });
    if (!validateSpriteGrid(spriteGrid)) return null;

    const previewAssets = await createPreviewAssets?.({
      source,
      petId: `issue-${submission.issueNumber}`,
      spriteGrid,
      submission,
    }) ?? {};
    return {
      ...submission,
      petId: `issue-${submission.issueNumber}`,
      spriteGrid,
      ...previewAssets,
    };
  } catch {
    return null;
  }
}

export function selectLatestSubmissions(issues) {
  const latestByAccount = new Map();
  const sorted = [...issues].sort(
    (left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at),
  );

  for (const issue of sorted) {
    const submission = parseSubmission(issue);
    if (!submission || latestByAccount.has(submission.githubLogin)) continue;
    latestByAccount.set(submission.githubLogin, submission);
  }

  return [...latestByAccount.values()];
}

export async function selectLatestValidSubmissions(
  issues,
  {
    fetchImpl = fetch,
    onRejected = () => {},
    getCachedMedia,
    createPreviewAssets,
    concurrency = DEFAULT_BUILD_CONCURRENCY,
    token,
  } = {},
) {
  const sorted = [...issues].sort(
    (left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at),
  );
  const candidatesByAccount = new Map();

  for (const issue of sorted) {
    const rejection = describeSubmissionRejection(issue);
    if (rejection) {
      onRejected(issue, rejection);
      continue;
    }
    const candidate = parseSubmission(issue);
    if (!candidate) {
      onRejected(issue, "表单字段、附件或公开展示确认不完整");
      continue;
    }
    const accountCandidates = candidatesByAccount.get(candidate.githubLogin) ?? [];
    accountCandidates.push({ issue, candidate });
    candidatesByAccount.set(candidate.githubLogin, accountCandidates);
  }

  const groups = [...candidatesByAccount.values()];
  let nextGroup = 0;
  const selected = new Array(groups.length).fill(null);
  const workers = Array.from(
    { length: Math.min(Math.max(1, concurrency), groups.length) },
    async () => {
      for (;;) {
        const groupIndex = nextGroup;
        nextGroup += 1;
        if (groupIndex >= groups.length) return;

        let accepted = false;
        for (const { issue, candidate } of groups[groupIndex]) {
          if (accepted) {
            onRejected(issue, "同一账号已有更新的有效投稿");
            continue;
          }
          const submission = await hydrateSubmission(candidate, {
            fetchImpl,
            getCachedMedia,
            createPreviewAssets,
            token,
          });
          if (submission) {
            selected[groupIndex] = submission;
            accepted = true;
          } else {
            onRejected(issue, "spritesheet.webp 无法读取、超过 10 MB、尺寸不符合标准或预览生成失败");
          }
        }
      }
    },
  );
  await Promise.all(workers);
  return selected.filter(Boolean);
}

async function loadPreviewCache(rootDir) {
  const cachePath = path.join(rootDir, ".gallery-cache", "preview-cache.json");
  try {
    const data = JSON.parse(await readFile(cachePath, "utf8"));
    if (data.version === PREVIEW_PIPELINE_VERSION && data.entries) return data;
  } catch {
    // A missing or stale cache is rebuilt from the source attachments.
  }
  return { version: PREVIEW_PIPELINE_VERSION, entries: {} };
}

async function savePreviewCache(rootDir, cache) {
  const cacheDir = path.join(rootDir, ".gallery-cache");
  await mkdir(cacheDir, { recursive: true });
  await writeFile(
    path.join(cacheDir, "preview-cache.json"),
    `${JSON.stringify(cache, null, 2)}\n`,
  );
}

async function buildExamplePreviews(rootDir) {
  const examplesDir = path.join(rootDir, "web", "public", "examples");
  const ids = JSON.parse(await readFile(path.join(examplesDir, "manifest.json"), "utf8"));
  const entries = await Promise.all(ids.map(async (id) => {
    const petDir = path.join(examplesDir, id);
    const pet = JSON.parse(await readFile(path.join(petDir, "pet.json"), "utf8"));
    const spriteGrid = normalizeSpriteGrid(pet.spriteGrid);
    if (!validateSpriteGrid(spriteGrid)) throw new Error(`${id} 的示例精灵图配置无效`);
    const source = await readFile(path.join(petDir, pet.spritesheetPath));
    const previewAssets = await generatePreviewAssets(source, {
      petId: `example-${id}`,
      spriteGrid,
      rootDir,
    });
    return [id, previewAssets];
  }));
  return Object.fromEntries(entries);
}

async function fetchSubmissionIssues({ repository, label, token, fetchImpl = fetch }) {
  const issues = [];

  for (let page = 1; ; page += 1) {
    const query = new URLSearchParams({
      state: "open",
      labels: label,
      per_page: "100",
      page: String(page),
    });
    const response = await fetchImpl(
      `https://api.github.com/repos/${repository}/issues?${query}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`GitHub API 请求失败：${response.status} ${response.statusText}`);
    }

    const pageIssues = await response.json();
    issues.push(...pageIssues);
    if (pageIssues.length < 100) break;
  }

  return issues;
}

export async function buildGalleryData({
  rootDir = process.cwd(),
  token = process.env.GITHUB_TOKEN,
  repository = process.env.GITHUB_REPOSITORY,
  fetchImpl = fetch,
} = {}) {
  const configPath = path.join(rootDir, "gallery.config.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  const targetRepository = repository || config.repository;

  if (!token) throw new Error("缺少 GITHUB_TOKEN，无法读取投稿 Issue。");
  if (!targetRepository) throw new Error("缺少仓库地址。");

  const previewCache = await loadPreviewCache(rootDir);
  const examplePreviewsPromise = buildExamplePreviews(rootDir);

  const issues = await fetchSubmissionIssues({
    repository: targetRepository,
    label: config.submissionLabel,
    token,
    fetchImpl,
  });
  const rejected = [];
  const pets = await selectLatestValidSubmissions(issues, {
    fetchImpl,
    token,
    onRejected: (issue, reason) => rejected.push({ number: issue.number, reason }),
    getCachedMedia: async (submission) => {
      const cached = previewCache.entries[submission.spritesheetUrl];
      if (!cached || !await materializePreviewAssets(rootDir, cached)) return null;
      return cached;
    },
    createPreviewAssets: async ({ source, petId, spriteGrid, submission }) => {
      const previewAssets = await generatePreviewAssets(source, { petId, spriteGrid, rootDir });
      previewCache.entries[submission.spritesheetUrl] = { spriteGrid, ...previewAssets };
      return previewAssets;
    },
  });
  const examplePreviews = await examplePreviewsPromise;
  const data = {
    generatedAt: new Date().toISOString(),
    pets,
  };
  const publicDir = path.join(rootDir, "web", "public");
  await mkdir(publicDir, { recursive: true });

  await writeFile(path.join(publicDir, "pets.json"), `${JSON.stringify(data, null, 2)}\n`);
  await writeFile(
    path.join(publicDir, "previews.json"),
    `${JSON.stringify({ examples: examplePreviews }, null, 2)}\n`,
  );
  await writeFile(
    path.join(publicDir, "gallery.config.json"),
    `${JSON.stringify({ ...config, repository: targetRepository }, null, 2)}\n`,
  );
  await savePreviewCache(rootDir, previewCache);

  console.log(`读取到 ${issues.length} 条投稿 Issue，接受 ${pets.length} 条，忽略 ${rejected.length} 条。`);
  for (const item of rejected) {
    console.warn(`忽略投稿 #${item.number}：${item.reason}`);
  }

  return data;
}

const isDirectRun = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isDirectRun) {
  const emptyPreview = process.argv.includes("--empty");
  buildGalleryData(emptyPreview
    ? {
        token: "local-preview",
        fetchImpl: async () => ({ ok: true, json: async () => [] }),
      }
    : undefined)
    .then((data) => {
      console.log(`已生成 ${data.pets.length} 条有效投稿。`);
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
