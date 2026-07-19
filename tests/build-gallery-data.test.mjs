import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  describeSubmissionRejection,
  extractAllowedUrl,
  extractFields,
  extractPetAttachments,
  extractPetName,
  generatePreviewAssets,
  hydrateSubmission,
  isAllowedGithubAttachment,
  parseSubmission,
  readWebpDimensions,
  selectLatestSubmissions,
  selectLatestValidSubmissions,
} from "../scripts/build-gallery-data.mjs";
import {
  normalizeSpriteGrid,
  resolveSpriteLayout,
} from "../lib/sprite-format.js";
import {
  GROUP_COUNT,
  KNOWN_GROUPS,
  matchesGroup,
  matchesSearch,
  normalizeGroupNumber,
} from "../lib/gallery-filter.js";

const validBody = ({ nickname = "阿澈", group = "3", suffix = "one" } = {}) => `### 学员昵称
${nickname}

### 所属分组
${group}

### 一句话介绍
一只会帮我检查代码的小伙伴。

### 宠物文件
[pet.json](https://github.com/user-attachments/files/${suffix}/pet.json)
![spritesheet](https://github.com/user-attachments/assets/${suffix})

### 公开展示确认
- [x] 我确认该作品可以公开展示
`;

function issue(overrides = {}) {
  return {
    number: 7,
    title: "[宠物投稿] 小火苗",
    state: "open",
    body: validBody(),
    user: { login: "student" },
    html_url: "https://github.com/owner/repo/issues/7",
    updated_at: "2026-07-17T08:00:00Z",
    ...overrides,
  };
}

function responseForBytes(bytes) {
  const copy = Uint8Array.from(bytes);
  return {
    ok: true,
    headers: { get: () => String(copy.byteLength) },
    arrayBuffer: async () => copy.buffer,
  };
}

function makeVp8xHeader(width, height) {
  const bytes = Buffer.alloc(30);
  bytes.write("RIFF", 0, "ascii");
  bytes.writeUInt32LE(22, 4);
  bytes.write("WEBP", 8, "ascii");
  bytes.write("VP8X", 12, "ascii");
  bytes.writeUInt32LE(10, 16);
  bytes.writeUIntLE(width - 1, 24, 3);
  bytes.writeUIntLE(height - 1, 27, 3);
  return bytes;
}

test("extractFields 读取 Issue Form 生成的标题字段", () => {
  const fields = extractFields(validBody());
  assert.equal(fields["学员昵称"], "阿澈");
  assert.equal(fields["所属分组"], "3");
  assert.equal(extractPetName("[宠物投稿] 小火苗"), "小火苗");
  assert.match(fields["公开展示确认"], /\[x\]/);
});

test("只接受 GitHub 托管的附件地址", () => {
  assert.equal(isAllowedGithubAttachment("https://github.com/user-attachments/assets/abc"), true);
  assert.equal(isAllowedGithubAttachment("https://user-images.githubusercontent.com/1/a.png"), true);
  assert.equal(isAllowedGithubAttachment("https://example.com/pet.png"), false);
  assert.equal(extractAllowedUrl("![x](https://example.com/x.png)"), null);
});

test("宠物文件必须同时包含具名的 pet.json 和 spritesheet.webp", () => {
  assert.deepEqual(extractPetAttachments(`
[pet.json](https://github.com/user-attachments/files/one/pet.json)
![spritesheet](https://github.com/user-attachments/assets/one)
`), {
    petConfigUrl: "https://github.com/user-attachments/files/one/pet.json",
    spritesheetUrl: "https://github.com/user-attachments/assets/one",
  });
  assert.equal(extractPetAttachments("![other](https://github.com/user-attachments/assets/one)"), null);
});

test("兼容 GitHub 将 WebP 附件写成 HTML 图片的实际 Issue 内容", () => {
  assert.deepEqual(extractPetAttachments(`
<img width="1536" height="1872" alt="Image" src="https://github.com/user-attachments/assets/sprite-id" />
[pet.json](https://github.com/user-attachments/files/30125974/pet.json)
`), {
    petConfigUrl: "https://github.com/user-attachments/files/30125974/pet.json",
    spritesheetUrl: "https://github.com/user-attachments/assets/sprite-id",
  });
});

test("有多张未具名图片时不猜测哪一张是精灵图", () => {
  assert.equal(extractPetAttachments(`
<img alt="Image" src="https://github.com/user-attachments/assets/first" />
<img alt="Image" src="https://github.com/user-attachments/assets/second" />
[pet.json](https://github.com/user-attachments/files/one/pet.json)
`), null);
});

test("有效投稿会转成公开画廊数据", () => {
  assert.deepEqual(parseSubmission(issue()), {
    issueNumber: 7,
    petName: "小火苗",
    nickname: "阿澈",
    group: "3",
    description: "一只会帮我检查代码的小伙伴。",
    githubLogin: "student",
    githubUrl: "https://github.com/student",
    petConfigUrl: "https://github.com/user-attachments/files/one/pet.json",
    spritesheetUrl: "https://github.com/user-attachments/assets/one",
    issueUrl: "https://github.com/owner/repo/issues/7",
    updatedAt: "2026-07-17T08:00:00Z",
  });
});

test("分组可以不填，且不影响投稿有效性", () => {
  const submission = parseSubmission(issue({ body: validBody({ group: "_No response_" }) }));
  assert.equal(submission.group, null);

  const legacyBody = validBody().replace(/### 所属分组\n3\n\n/, "");
  assert.equal(parseSubmission(issue({ body: legacyBody })).group, null);
});

test("分组可用于全文搜索、候选选择和手动输入筛选", () => {
  const pets = [
    { kind: "submission", petName: "小火苗", nickname: "阿澈", group: "3" },
    { kind: "submission", petName: "小水滴", nickname: "小岚", group: "12" },
    { kind: "submission", petName: "小云朵", nickname: "小夏", group: null },
    { kind: "example", petName: "示例", nickname: "SC26 示例" },
  ];

  assert.equal(matchesSearch(pets[0], "3"), true);
  assert.equal(matchesGroup(pets[0], "3"), true);
  assert.equal(matchesGroup(pets[1], "3"), false);
  assert.equal(matchesGroup(pets[2], "3"), false);
  assert.equal(matchesGroup(pets[0], ""), true);
});

test("分组只接受 1-33 的数字并规范化写法", () => {
  assert.equal(GROUP_COUNT, 33);
  assert.equal(KNOWN_GROUPS.length, 33);
  assert.equal(KNOWN_GROUPS[0], "1");
  assert.equal(KNOWN_GROUPS.at(-1), "33");
  assert.equal(normalizeGroupNumber(" 5 "), "5");
  assert.equal(normalizeGroupNumber("05"), "5");
  assert.equal(normalizeGroupNumber("５"), "5");
  assert.equal(normalizeGroupNumber("第 5 组"), null);
  assert.equal(normalizeGroupNumber("第五组"), null);
  assert.equal(normalizeGroupNumber("0"), null);
  assert.equal(normalizeGroupNumber("34"), null);
  assert.equal(normalizeGroupNumber("123"), null);
});

test("错误分组写法按未填写处理，不影响投稿有效性", () => {
  for (const group of ["第 5 组", "第五组", "34"]) {
    const submission = parseSubmission(issue({ body: validBody({ group }) }));
    assert.equal(submission.group, null);
  }
});

test("未确认公开展示和已关闭投稿会被丢弃", () => {
  assert.equal(parseSubmission(issue({ body: validBody().replace("[x]", "[ ]") })), null);
  assert.equal(parseSubmission(issue({ state: "closed" })), null);
});

test("拒绝原因会明确指出标题缺少宠物名", () => {
  const incomplete = issue({ title: "[宠物投稿]" });
  assert.equal(parseSubmission(incomplete), null);
  assert.equal(
    describeSubmissionRejection(incomplete),
    "标题中缺少宠物名，请把名字写在「[宠物投稿]」后面",
  );
  assert.equal(
    describeSubmissionRejection(issue({ body: validBody().replace("[x]", "[ ]") })),
    "未勾选公开展示确认",
  );
  assert.equal(describeSubmissionRejection(issue()), null);
});

test("同一账号只保留最近更新的有效投稿", () => {
  const older = issue({ number: 1, updated_at: "2026-07-16T08:00:00Z" });
  const newer = issue({
    number: 2,
    title: "[宠物投稿] 新宠物",
    updated_at: "2026-07-17T09:00:00Z",
    body: validBody({ suffix: "two" }),
  });
  const other = issue({
    number: 3,
    user: { login: "another" },
    updated_at: "2026-07-17T10:00:00Z",
  });

  const selected = selectLatestSubmissions([older, newer, other]);
  assert.equal(selected.length, 2);
  assert.equal(selected.find((pet) => pet.githubLogin === "student").petName, "新宠物");
});

test("标准 WebP 精灵图通过校验后会生成安全配置", async () => {
  const submission = parseSubmission(issue());
  const spritesheet = await readFile(
    new URL("../web/public/examples/bananacat/spritesheet.webp", import.meta.url),
  );
  const hydrated = await hydrateSubmission(submission, {
    fetchImpl: async (url) => {
      assert.equal(url, submission.spritesheetUrl);
      return responseForBytes(spritesheet);
    },
  });

  assert.equal(hydrated.petId, "issue-7");
  assert.equal(hydrated.spriteGrid.formatVersion, "v1");
  assert.equal(hydrated.spriteGrid.columns, 8);
  assert.equal(hydrated.spriteGrid.states.length, 9);
});

test("预览流水线会生成封面，并把列表/详情共用一份全尺寸有损精灵图", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "gallery-preview-"));
  try {
    const spritesheet = await readFile(
      new URL("../web/public/examples/bananacat/spritesheet.webp", import.meta.url),
    );
    const spriteGrid = normalizeSpriteGrid({ formatVersion: "v1", columns: 8, rows: 9 });
    const assets = await generatePreviewAssets(spritesheet, {
      petId: "issue-7",
      spriteGrid,
      rootDir,
    });

    assert.match(assets.posterUrl, /generated\/previews\/issue-7-[\da-f]+-poster\.webp$/);
    assert.match(assets.previewUrl, /generated\/previews\/issue-7-[\da-f]+-sheet\.webp$/);
    assert.equal(assets.detailUrl, assets.previewUrl);
    assert.equal(assets.previewFrameWidth, 192);
    assert.equal(assets.previewFrameHeight, 208);

    const sheetPath = path.join(rootDir, "web", "public", assets.previewUrl);
    const sheetStat = await stat(sheetPath);
    assert.ok(sheetStat.size > 50_000, "shared sheet should exist and be non-trivial");
    assert.ok(
      sheetStat.size < spritesheet.byteLength * 0.75,
      "shared sheet should be meaningfully smaller than the original upload",
    );

    // Second run hits content-addressed cache and returns the same paths.
    const again = await generatePreviewAssets(spritesheet, {
      petId: "issue-7",
      spriteGrid,
      rootDir,
    });
    assert.deepEqual(again, assets);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("WebP 头可以识别 v2 精灵图尺寸", () => {
  assert.deepEqual(readWebpDimensions(makeVp8xHeader(1536, 2288)), {
    width: 1536,
    height: 2288,
  });
  assert.equal(readWebpDimensions(Buffer.from("not webp")), null);
});

test("同一账号的最新附件无效时会回退到较早的有效投稿", async () => {
  const spritesheet = await readFile(
    new URL("../web/public/examples/bananacat/spritesheet.webp", import.meta.url),
  );
  const older = issue({ number: 1, updated_at: "2026-07-16T08:00:00Z" });
  const newer = issue({
    number: 2,
    title: "[宠物投稿] 无效新投稿",
    updated_at: "2026-07-17T09:00:00Z",
    body: validBody({ suffix: "invalid" }),
  });
  const selected = await selectLatestValidSubmissions([older, newer], {
    fetchImpl: async (url) => responseForBytes(
      url.includes("invalid") ? Buffer.from("not webp") : spritesheet,
    ),
  });

  assert.equal(selected.length, 1);
  assert.equal(selected[0].issueNumber, 1);
});

test("三个示例宠物都使用完整且不越界的精灵图状态配置", async () => {
  const ids = ["bananacat", "hachiroku", "oiiai"];

  for (const id of ids) {
    const content = await readFile(new URL(`../web/public/examples/${id}/pet.json`, import.meta.url), "utf8");
    const pet = JSON.parse(content);
    const grid = pet.spriteGrid;

    assert.equal(grid.columns, 8, `${id} 应为 8 列`);
    assert.equal(grid.rows, 9, `${id} 应为 9 行`);
    assert.equal(grid.states.length, 9, `${id} 应包含 9 种状态`);
    assert.ok(grid.states.some((state) => state.id === grid.defaultState));
    for (const state of grid.states) {
      assert.ok(state.row >= 0 && state.row < grid.rows, `${id}/${state.id} 行号越界`);
      assert.ok(state.frames >= 1 && state.frames <= grid.columns, `${id}/${state.id} 帧数越界`);
      assert.ok(state.frameDuration > 0, `${id}/${state.id} 缺少播放间隔`);
    }
  }
});

test("v1 与 v2 精灵图都按 192×208 的基础帧解析", () => {
  const grid = normalizeSpriteGrid();
  const v1 = resolveSpriteLayout({ naturalWidth: 1536, naturalHeight: 1872 }, grid);
  const v2 = resolveSpriteLayout({ naturalWidth: 1536, naturalHeight: 2288 }, grid);

  assert.deepEqual(v1, {
    version: "v1",
    columns: 8,
    rows: 9,
    frameWidth: 192,
    frameHeight: 208,
  });
  assert.deepEqual(v2, {
    version: "v2",
    columns: 8,
    rows: 11,
    frameWidth: 192,
    frameHeight: 208,
  });
  assert.equal(grid.states.find((state) => state.id === "running").label, "处理中");
});

test("v2 的额外方位状态不会进入基础状态查看器", () => {
  const grid = normalizeSpriteGrid({
    formatVersion: "v2",
    rows: 11,
    states: [
      ...normalizeSpriteGrid().states,
      { id: "look-a", label: "方位 A", row: 9, frames: 8, frameDuration: 100 },
      { id: "look-b", label: "方位 B", row: 10, frames: 8, frameDuration: 100 },
    ],
  });

  assert.equal(grid.rows, 11);
  assert.equal(grid.states.length, 9);
  assert.equal(grid.states.some((state) => state.row >= 9), false);
});
