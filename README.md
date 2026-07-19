# SC26 宠物画廊

SummerCamp 2026 的学员宠物图鉴：把大家做的像素宠物收在一起看、搜、分享，还能多宠合影。

**线上站点**：https://dase-vibecoding.github.io/SC26-CodexPetsGallery/

页面始终带三个官方示例，示例不占投稿名额。

---

## 写给学员

### 你能在这里做什么

- 浏览所有公开宠物，点开看动画和状态
- 按名字 / 昵称 / 分组搜索、筛选
- 复制某个宠物的分享链接发给朋友
- 多选几只宠物（或按组加入）进照相馆：换场景背景，拍合影并导出 PNG
- 一键生成**全营纪念合影**（横/竖构图、铭牌、高清导出）
- 把某只宠物拉成**试用伙伴**：跟着页面走、可拖动、气泡台词，还能点特殊动作

### 怎么投稿

1. 打开仓库的 **Issues → 提交我的宠物**
2. 标题写成：`[宠物投稿] 你的宠物名`（`[宠物投稿]` 后面必须有名字）
3. 填写昵称、一句话介绍；分组选填，填的话只写 `1`–`33` 的数字
4. 上传两个文件（文件名请保持原样）：
   - `pet.json`
   - `spritesheet.webp`
5. 勾选公开展示确认后提交

同一账号只展示**最近一条有效投稿**。改宠物内容就编辑原 Issue 或再开新帖覆盖。

### 投稿会被收下的条件

- Issue 保持开启，并带 `pet-submission` 标签（表单会自动打上）
- 标题、昵称、介绍完整，已勾选公开展示
- 同时附上合法的 `pet.json` 与 `spritesheet.webp`
- 精灵图为 WebP，尺寸符合下表，且不超过 10 MB

| 版本 | 网格 | 图片尺寸 | 画廊展示 |
| --- | --- | --- | --- |
| v1 | 8×9 | 1536×1872 | 九行基础状态 |
| v2 | 8×11 | 1536×2288 | 前九行基础状态（末两行方位不进入选择器） |

单帧 192×208。不需要自己做封面或压缩展示图，画廊构建时会自动处理。

提交后稍等 Actions 部署完成，你的宠物就会出现在线上画廊。

---

## 写给开发者

### 架构一览

```text
学员 Issue 附件
        │
        ▼
GitHub Actions：校验 → 生成预览/详情图 → Vite 构建 → 部署 Pages
        │
        ▼
静态站点（列表用小图，详情用同源 detail 图；原附件仅作「完整立绘」外链）
```

- **前端**：Vite + Preact + TypeScript + Tailwind → 纯静态
- **数据**：Actions 读带标签的 Issue，写出 `pets.json` / `previews.json`
- **图片流水线**（`scripts/build-gallery-data.mjs`，内容 hash + `.gallery-cache` 增量）：
  - `poster`：默认状态单帧（lossless WebP），列表静帧 / 合影导出
  - `sheet`：全分辨率有损 WebP（q90），列表动画与详情共用（`previewUrl` = `detailUrl`）
- 原 `spritesheet.webp` 仍指向 GitHub 附件，不打进 Pages 大图
- **前端模块**（均在 `web/src/`）：
  - 照相馆：`components/PhotoBooth.tsx` + `lib/photo-booth.ts`
  - 全营纪念合影：`components/CampPhoto.tsx` + `lib/camp-photo.ts`
  - 试用伙伴：`components/TrialCompanion.tsx` + `lib/trial-companion.ts`

### 目录

```text
.github/               Issue 表单与 Pages 工作流
lib/                   构建与前端共用的纯 JS
scripts/               Issue 解析、预览/详情图生成
web/public/examples/   固定示例宠物（勿塞学员投稿）
web/public/generated/  构建产物（gitignore）
web/src/               前端源码
.gallery-cache/        Actions 可复用的图片缓存（gitignore）
tests/
gallery.config.json    仓库名、文案、投稿标签
```

### 本地开发

需要 Node.js 20+。

```powershell
npm install
npm test
npm run build:data:empty   # 无真实投稿时的空数据 + 示例图
npm run dev                # http://localhost:4173/
```

生产构建：

```powershell
npm run build:data:empty
npm run build              # 产物在 dist/
npm run preview
```

拉真实 Issue：

```powershell
$env:GITHUB_TOKEN = "你的 Token"
$env:GITHUB_REPOSITORY = "owner/repo"
npm run build:data
```

新增官方示例：复制 `web/public/examples/<id>/`，并把 `<id>` 写入 `manifest.json`。

### 仓库启用

1. 公开仓库，打开 Issues
2. 创建标签 `pet-submission`（或与 `gallery.config.json` 中一致）
3. 推送 `main`，Pages 来源选 **GitHub Actions**
4. 用「提交我的宠物」试投一条

工作流：`npm ci` → `build-gallery-data` → `vite build` → 上传 `dist/`。图片缓存键为 `gallery-previews-v3-`。

### 迁到正式仓库

复制：

`.github/` · `lib/` · `scripts/` · `web/` · `tests/` · `gallery.config.json` · `package.json` · `package-lock.json`

改 `gallery.config.json` 里的 `repository`、`pageTitle`、`eventName`（以及如需的 `submissionLabel`），按上一节打开 Pages 即可。
