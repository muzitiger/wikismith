# Tutorial Site Template — 设计文档 v1

> 定位：**一个程序化 SEO 教程站模板**。一份 `src/content/` 目录 = 一个技术主题站。
> 换主题 = 换内容目录 + 改 3 个配置字段，不动一行 `.astro`。
> 技术栈：Astro 5（纯静态 SSG）+ Tailwind 4 + Zod 内容校验。
> 域名占位：`https://example.com`
>
> 本文档中的关键词示例统一以 **Astro** 作为演示主题（`{T}` = Astro）。模板语法用 `{T}` 表示，
> 实际项目里 `{T}` 由 `src/content/topic/*.json` 的 `name` 字段提供，组件从数据读取而非字符串替换。

---

## 0. 模板不变式（Invariants）

生成代码时这 6 条是硬约束，任何一条破了就算实现错误：

| # | 不变式 | 落地方式 |
|---|---|---|
| I1 | 组件里**零教程文案**。所有标题、结论、步骤、报错、FAQ 来自内容集合 | `content.config.ts` Zod 校验 + code review |
| I2 | 页面 `<title>` / `<meta description>` / `canonical` 一律从 `seo` 字段读取，禁止组件内拼接 | `Seo.astro` 单一出口 |
| I3 | 每个页面的结构化数据与**页面上可见的内容同源**（同一份数据生成 JSON-LD，不允许另行手写） | `lib/jsonld.ts` 只接受内容对象为入参 |
| I4 | 单篇教程正文 ≥ 1000 词，构建时校验，不达标直接 fail | `scripts/check-content.ts`（构建前置） |
| I5 | 所有内链走 `lib/routes.ts`，且受 `SITEMAP_OPEN` 门禁控制（未开放的路由不出链） | `linkIfOpen()` |
| I6 | 静态产物包含 `404.html`、`sitemap.xml`（+ 分片）、`robots.txt` | Astro 默认 + `pages/*.ts` |

**Fork 清单**（新主题复制后需要改的全部内容）：

```
src/config/site.ts        → url / locale / timezone
src/content/topic/        → 主题元数据（1 个 JSON）
src/content/**            → 教程、报错、对比、系列
src/config/ui.ts          → 导航标签（可选，默认英文可直接用）
```

URL 结构（全站唯一，写死在 `routes.ts`）：

```
/                                   首页（主题 hub）
/tutorials/                         全部教程索引
/tutorials/{slug}/                  教程详情（T1/T2/T3/T6/T7 共用一套渲染管线）
/vs/                                对比索引
/vs/{a}-vs-{b}/                     对比详情（T4）
/errors/                            报错索引
/errors/{slug}/                     单个报错（T5）
/series/{slug}/                     系列目录（线性学习路径）
/tags/  /tags/{tag}/                标签聚合
/about/  /privacy/                  法务页（legal 集合）
```

---

## 1. 关键词分类（Keyword Taxonomy）

程序化 SEO 的核心不是“写很多文章”，是**把查询语式穷举成有限几类，每类一个模板，每类一个 URL 模式**。
下面 7 类是这套模板收纳的全部语式，超出这 7 类的查询一律不进站（进站就会变成一次性手写页面，失去扩量能力）。

### K1 · 操作型 — `how to {动作} in {T}`

**意图**：已经决定用 `{T}`，现在要完成一个具体动作。转化最高、竞争最现实的一类。
**模板**：T1 Step Guide ｜ **URL**：`/tutorials/{action-slug}/`
**示例**（演示主题 = Astro）：

1. `how to add a sitemap in astro`
2. `how to create dynamic routes in astro`
3. `how to deploy astro to cloudflare pages`

**扩量矩阵**：`{动作} × {T}`。动作词库固定 40 个（add / create / configure / deploy / migrate / secure / cache / redirect / generate / lazy-load …），
每个动作至少能落 1 篇。Astro 演示集给 40 个动作 → 40 篇，这就是站点的基本盘。

### K2 · 教程型 — `{T} tutorial` / `{T} guide` / `{T} {特性} tutorial`

**意图**：从零建立认知，搜索量大但意图宽，用**支柱页（pillar）**承接，不跟 K1 抢。
**模板**：T2 Pillar Hub ｜ **URL**：`/tutorials/{topic-slug}-tutorial/`（每个子领域一篇，不是全站一篇）
**示例**：

1. `astro tutorial`
2. `astro content collections tutorial`
3. `astro ssr tutorial`

**扩量矩阵**：`{T} {特性} tutorial`，特性词来自 `topic.features[]`（Astro 演示：content-collections / islands / ssr / i18n / view-transitions / actions）。

### K3 · 入门型 — `{T} for beginners` / `{T} getting started` / `learn {T}`

**意图**：还没装。需要“最短成功路径”而不是知识体系。
**模板**：T3 Getting Started ｜ **URL**：`/tutorials/getting-started-with-{topic}/`
**示例**：

1. `astro for beginners`
2. `astro getting started`
3. `learn astro from scratch`

**注意**：这类页面只有一个，全站仅 1 篇 + 1 个 `series`。它的价值是**入口页**（承接新流量 + 把权重导向 pillar），不是靠数量。别给每个特性都做一篇 "for beginners"，那是自相残杀。

### K4 · 对比型 — `{T} vs {替代品}`

**意图**：选型阶段，商业意图最强，也是最容易做出差异化的地方（要有明确结论，不能"各有千秋"）。
**模板**：T4 Comparison ｜ **URL**：`/vs/{a}-vs-{b}/`
**示例**：

1. `astro vs nextjs`
2. `astro vs sveltekit`
3. `astro vs hugo`

**扩量矩阵**：`n × (n-1) / 2`，n = 直接竞品数（Astro 演示 n=6 → 15 篇）。**只做有真实搜索量的组合**，别机械穷举出 200 个零搜索页面。

### K5 · 排障型 — `{T} not working` / `error {码}` / `{T} {错误信息}`

**意图**：卡住了，情绪最急，跳出率最低，长尾最肥。这类词是教程站的**流量暗河**。
**模板**：T5 Error Page ｜ **URL**：`/errors/{slug}/`（一错一页，独立集合，被多篇教程引用）
**示例**：

1. `astro content collections invalid frontmatter`
2. `astro build failed javascript heap out of memory`
3. `astro dev server not reloading`

**扩量矩阵**：`{错误信息原文} × {T}`。错误信息直接抄真实报错首行（带引号、带路径那种），因为用户是**整段粘贴进搜索框**的。这条是这套模板最值钱的机制，详见 §3.4。

### K6 · 清单/最佳实践型 — `{T} best practices` / `{T} checklist` / `{T} examples`

**意图**：已上手，想确认自己没做错。适合做“可保存、可分享”的页面，外链天然多。
**模板**：T6 Checklist ｜ **URL**：`/tutorials/{topic}-{aspect}-best-practices/`
**示例**：

1. `astro seo checklist`
2. `astro performance best practices`
3. `astro project structure best practices`

### K7 · 迁移型 — `migrate from {替代品} to {T}` / `convert {X} to {T}`

**意图**：已有一坨存量资产要搬过来。转化意图极高，且这类读者会认真读完。
**模板**：T7 Migration ｜ **URL**：`/tutorials/migrate-from-{x}-to-{topic}/`
**示例**：

1. `migrate from nextjs to astro`
2. `move gatsby blog to astro`
3. `convert create-react-app to astro`

**扩量矩阵**：`{来源} × {T}`，来源 = K4 里的竞品集合。**K4 和 K7 共用同一份竞品清单**，所以 `n=6` 时这两个模板一起产出 30 篇，且互相内链。

### 分类 → 模板 → URL 总表

| 类 | 语式 | 模板 | URL 模式 | 数量级（Astro 演示） | 主 JSON-LD |
|---|---|---|---|---|---|
| K1 | how to {动作} in {T} | T1 Step Guide | `/tutorials/{action}/` | 40 | HowTo |
| K2 | {T} {特性} tutorial | T2 Pillar | `/tutorials/{topic}-{feature}-tutorial/` | 6 | Article + ItemList |
| K3 | {T} for beginners | T3 Getting Started | `/tutorials/getting-started-with-{topic}/` | 1 | HowTo + Article |
| K4 | {T} vs {替代} | T4 Comparison | `/vs/{a}-vs-{b}/` | 15 | Article + FAQPage |
| K5 | {T} error {码} / not working | T5 Error | `/errors/{slug}/` | 30+ | FAQPage + TechArticle |
| K6 | {T} best practices | T6 Checklist | `/tutorials/{topic}-{aspect}-best-practices/` | 8 | Article + ItemList |
| K7 | migrate {X} to {T} | T7 Migration | `/tutorials/migrate-from-{x}-to-{topic}/` | 15 | HowTo |

合计 ~115 篇 = 一个中等规模教程站的完整骨架。每篇 ≥1000 词 → 11.5 万词。

---

## 2. 页面模板与区块

所有详情页共用一条渲染管线：**`answer` 头 → 前置条件 → 编号步骤 → 正文补充 → 报错 → FAQ → 相关**。
模板之间的差别只是**哪些区块存在、顺序如何**，靠 `template` 字段驱动，不靠复制组件。

### 2.0 通用区块定义（Block Primitives）

| 区块 | 组件 | 数据来源 | 说明 |
|---|---|---|---|
| `B1` AnswerBox | `AnswerBox.astro` | `answer` | 一句话结论，首屏第一块，无标题 |
| `B2` MetaBar | `MetaBar.astro` | `difficulty` / `totalMinutes` / `testedWith` / `updated` | 难度、耗时、验证版本、更新时间 |
| `B3` PrereqList | `PrereqList.astro` | `prerequisites[]` | 分 required / optional，带校验命令 |
| `B4` StepList | `StepList.astro` → `Step.astro` | `steps[]` | H2 编号 + H3 子操作 + 预期结果 |
| `B5` ProseBody | `ProseBody.astro` | `body[]` (blocks) | 深入说明，渲染在步骤之后 |
| `B6` ErrorList | `ErrorList.astro` | `errors[]`（引用） | 症状 / 原因 / 修复，链到 `/errors/{slug}/` |
| `B7` FaqList | `FaqList.astro` | `faq[]` | 可见 FAQ，与 FAQPage JSON-LD 同源 |
| `B8` RelatedList | `RelatedList.astro` | `relatedIds` + 自动推导 | 相关教程（见 §4） |
| `B9` Toc | `Toc.astro` | 由 H2 自动生成 | 右侧目录，纯 CSS + 锚点，无 JS |
| `B10` Breadcrumbs | `Breadcrumbs.astro` | `pillarId` + `seriesId` | 可见面包屑，与 BreadcrumbList 同源 |
| `B11` SeriesNav | `SeriesNav.astro` | `seriesId` + `order` | 上/下一篇，线性路径 |
| `B12` TableBlock | `DataTable.astro` | `blocks[type=table]` | 对比表、参数表 |
| `B13` CodeBlock | `CodeBlock.astro` | `steps[].code[]` / `blocks[type=code]` | 静态高亮，零 JS |
| `B14` AdSlot | `AdSlot.astro` | `FEATURES.ads` | 已有组件，步骤 2 之后插一个 |

### T1 · Step Guide（K1 主力）

承接 `how to {动作} in {T}`。**这是全站最重要的模板**，也是 HowTo 富结果的唯一来源。

```
B10 Breadcrumbs
H1   {步骤结果导向的标题}，例：How to Add a Sitemap in Astro (3 Steps)
B1  AnswerBox          ← 一句话结论，40–320 字符，直接给答案
B2  MetaBar
B9  Toc
H2  Prerequisites      ← 前置条件（不是步骤，不编号）
B3  PrereqList
H2  Step 1 — {标题}     ← 编号步骤开始，每步一个 H2
  H3 {子操作 1}
  H3 {子操作 2}
  B13 CodeBlock
  ▸ Expected result   ← 每步必须有的「预期结果」小块（固定样式，不占 H2）
H2  Step 2 — {标题} …（2–8 步）
H2  Common errors      ← B6，2–5 条，每条链到 /errors/{slug}/
H2  {可选的背景/原理段} ← B5，放在报错之后，不打断主流程
H2  FAQ                ← B7，3–6 条
B8  Related tutorials
```

**为什么步骤要放 H2**：`HowTo` 的 `step` 序列要能被抓成 feature snippet；同时 H2 才进目录。单步内的多个操作必须是 H3，否则目录会被撑爆、步骤边界丢失。

**禁止**：把 `Prerequisites` 编进步骤序列（`HowTo.step` 里不能含前置条件，Google 会把前置条件当成一个"步骤"导致富结果错位）。

### T2 · Pillar Hub（K2）

支柱页 = 该子领域的知识地图，不追求“手把手”，追求**覆盖 + 分流**。

```
B10 Breadcrumbs
H1  {T} {特性} Tutorial
B1  AnswerBox（"这一页解决什么 + 适合谁"）
B2  MetaBar
B9  Toc
H2  What is {特性}            （概念，300–400 词）
H2  How {特性} works          （机制 + 一张结构表 B12）
H2  {特性} in {T}: step by step  ← 3–5 个高层 H2 步骤，每步链到对应的 K1 详解页
H2  Common mistakes           （B6 轻量版，不重复 error 页正文）
H2  When not to use it        （诚实段落，提升可信度与停留）
H2  FAQ
B8  Related + 完整子页面清单（12–20 条，分组）
```

Pillar 的核心是**出口多**：一篇 pillar 应链出 12–20 篇 cluster，且被所有 cluster 回链。它是内链的中枢（§4）。

### T3 · Getting Started（K3，全站 1 篇）

```
B10 Breadcrumbs
H1  Getting Started with {T}: From Zero to Running in 15 Minutes
B1  AnswerBox
B2  MetaBar
B9  Toc
H2  What you'll build        （结果先行，给最终形态截图位）
H2  Prerequisites           B3
H2  Step 1 — Install {T}
H2  Step 2 — Create your first project
H2  Step 3 — Understand the file that matters  ← 只讲 1 个文件，别讲架构
H2  Step 4 — Deploy it
H2  Common errors          B6（新手最常撞的 3 个）
H2  Where to go next        ← 手动指向 pillar 与 3 条推荐路径
H2  FAQ
B11 SeriesNav
```

### T4 · Comparison（K4）

```
B10 Breadcrumbs
H1  {T} vs {X}: Which One Should You Use in 2026?
B1  AnswerBox          ← 必须给结论 + 适用条件（"选 {T} 如果你…；选 {X} 如果你…"）
B2  MetaBar（含双方当前版本与对比日期）
H2  The short answer      （150 词内，可被 AI 摘录）
H2  Side-by-side comparison  B12 表格（8–12 行，行名固定：渲染模型 / 学习曲线 / 生态 / 构建速度 / 托管 / 类型安全 / 迁移成本 / 适用规模）
H2  Where {T} wins        （3 点，每点 80–150 词）
H2  Where {X} wins        （3 点，必须真诚，否则不可信）
H2  Performance and bundle size  （数据表 + 来源说明）
H2  Migration cost        ← 链到 K7 迁移教程
H2  Verdict by use case   （3–5 个场景各给一句结论）
H2  FAQ
B8  Related
```

### T5 · Error Page（K5，独立集合）

一错一页。**这类页面允许短**（600–900 词），但结构必须极硬，因为用户要的是第 3 秒解决。

```
B10 Breadcrumbs
H1  {错误信息原文或 "{T} {症状}: How to Fix"}   ← 带上用户会粘贴的原文
B1  AnswerBox          ← "原因：X。修复：执行 Y。" 一句话说完
B2  MetaBar（受影响版本、平台）
H2  What this error means     （症状复现描述 + 报错原文 B13）
H2  Why it happens            （1–3 个成因，各自 H3）
H2  How to fix it             ← 编号步骤，同样是 HowToStep（复用 T1 的 StepList 组件）
H2  How to verify the fix     ← 验证命令 + 预期输出
H2  Prevention                （2–4 条）
H2  Still broken?             ← 分诊：列 3–5 个"如果上面都不行，可能是…"并链到相关错误页
H2  FAQ
B8  Referenced in these tutorials   ← 反向链接区，自动生成
```

`Still broken?` 区块是这类页面做内链簇的抓手：错误 A → 错误 B → 错误 C，形成"排障链"，一个用户能连看 4 页。

### T6 · Checklist（K6）

```
H1  {T} {Aspect} Best Practices: 12-Point Checklist
B1  AnswerBox（"照这 12 条过一遍，能解决 90% 的 {aspect} 问题。"）
H2  The checklist       ← 12 条，每条 H3，每条带 ✓/✗ 对照和一句"为什么"
H2  How we tested       ← 可信度区块（真实项目、版本、测量方法）
H2  What to do first if you only have 10 minutes  ← 挑 3 条，实用感
H2  FAQ
B8  Related
```
每条 checklist 项链到解释它的 K1 页面 → 天然的 hub-spoke。

### T7 · Migration（K7）

```
H1  How to Migrate from {X} to {T} (Without Breaking SEO)
B1  AnswerBox（"能迁。核心是把 A 换成 B、C 换成 D，其余 80% 逻辑可直接搬。"）
H2  Before you start          ← 兼容性矩阵 B12 + 工作量估算表
H2  Step 1 — Inventory what you have
H2  Step 2 — Map {X} concepts to {T}
H2  Step 3 — Migrate routes and redirects   ← 301 表，SEO 关键
H2  Step 4 — Migrate data/content
H2  Step 5 — Verify parity
H2  What breaks and how to fix it   B6
H2  FAQ
```

### 其余页面

| 页面 | 区块要点 |
|---|---|
| `/` 首页 | H1 主题名 + AnswerBox + 4 个入口卡（入门/Pillar 列表/报错索引/对比索引）+ 最新更新 6 篇 + 主题 FAQ |
| `/tutorials/` | H1 + 按 `template` 分组的列表 + 难度筛选（静态，无 JS）+ 分页 |
| `/errors/` | 按 `errorCategory` 分组，同组内按引用次数排序（被引用多 = 更常见） |
| `/vs/` | 卡片网格，每张卡一句话结论 |
| `/series/{slug}/` | 线性路径，带 order 编号和总时长 |
| `/tags/{tag}/` | 聚合列表 + 该 tag 的说明段（`tags` 集合提供） |

---

## 3. 数据 Schema

### 3.1 集合划分

按**形状**划分，不按 URL 划分（沿用现有模板的约定）。

```
src/content/
├── topic/            topic.json           1 个：主题元数据（站点的唯一真源）
├── tutorials/        *.json               N 个：所有教程（T1/T2/T3/T6/T7 共用）
├── errors/           *.json               独立报错条目（被 tutorials 引用）
├── comparisons/      *.json               对比页
├── series/           *.json               系列（线性学习路径）
├── tags/             *.json               标签
└── legal/            *.json               about / privacy
```

**为什么 `errors` 要独立于 `tutorials`**：同一个错误会被 3–8 篇教程提到。若内嵌，就是 3–8 份重复正文 → 关键词自食 + 内链无法收敛。独立成集合后，**一个错误一个 canonical URL，所有教程只是引用它的 `slug`**，页面只渲染一句摘要 + 链接。这是这套 schema 最关键的一个决定。

### 3.2 核心 Zod Schema

```ts
/* ---------- 基础原语 ---------- */

const id = z.string().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);  // kebab-case

const seo = z.object({
  title: z.string().min(15).max(60),        // 不含站点后缀；后缀由 Seo.astro 追加
  description: z.string().min(70).max(158), // 超 158 会被截断，构建期报错
  canonical: z.string().url().optional(),    // 缺省 = 由路由推导
  noindex: z.boolean().default(false),
  ogImage: z.string().optional(),
});

/** 正文块。所有长文都走这个联合类型，禁止在 JSON 里塞 HTML。 */
const block = z.discriminatedUnion('type', [
  z.object({ type: z.literal('p'), text: z.string().min(1) }),
  z.object({ type: z.literal('h2'), text: z.string().min(1) }),   // 仅 body 内允许
  z.object({ type: z.literal('h3'), text: z.string().min(1) }),
  z.object({ type: z.literal('list'), ordered: z.boolean().default(false), items: z.array(z.string()).min(1) }),
  z.object({ type: z.literal('code'), lang: z.string(), code: z.string().min(1), filename: z.string().optional() }),
  z.object({ type: z.literal('table'), caption: z.string().optional(),
             headers: z.array(z.string()).min(2), rows: z.array(z.array(z.string())).min(1) }),
  z.object({ type: z.literal('note'), tone: z.enum(['info', 'warn', 'danger']).default('info'), text: z.string() }),
  z.object({ type: z.literal('image'), src: z.string(), alt: z.string().min(5),
             width: z.number().int().positive(), height: z.number().int().positive(),
             caption: z.string().optional() }),
  z.object({ type: z.literal('errorRef'), slug: id }),            // 内联引用一个报错页
]);

/* ---------- 前置条件 ---------- */

const prerequisite = z.object({
  text: z.string().min(10),                  // "Node.js 20.3 或更高版本"
  kind: z.enum(['tool', 'account', 'knowledge', 'file']),
  version: z.string().optional(),
  required: z.boolean().default(true),
  /** 校验方式：命令 + 期望输出。渲染成可复制的检查块，也是 HowTo 的"前置"信号 */
  verify: z.object({ cmd: z.string(), expect: z.string() }).optional(),
  /** 该前置条件对应的教程（内链用） */
  tutorialId: id.optional(),
});

/* ---------- 步骤（HowToStep 的唯一来源） ---------- */

const step = z.object({
  n: z.number().int().positive(),            // 1-based；构建期校验连续、不跳号
  title: z.string().min(8).max(70),          // 渲染为 H2 "Step {n} — {title}"
  /** 子操作：渲染为 H3。0 个则本步无 H3 */
  subSteps: z
    .array(z.object({ title: z.string().min(5), text: z.string().min(10) }))
    .default([]),
  /** 本步说明段落（可含 code / list / note） */
  body: z.array(block).min(1),
  /** 必填：预期结果。一句话，用户据此判断"我做对了吗" */
  expected: z.string().min(15).max(200),
  /** 可选：命令验证 */
  verify: z.object({ cmd: z.string(), expect: z.string() }).optional(),
  /** 该步可能触发的报错 → 内链到 /errors/ */
  errorIds: z.array(id).default([]),
  minutes: z.number().positive().optional(),
});

/* ---------- 教程（T1/T2/T3/T6/T7） ---------- */

const tutorial = z.object({
  slug: id,
  template: z.enum(['howto', 'pillar', 'getting-started', 'checklist', 'migration']),
  seo,
  h1: z.string().min(15).max(80),            // 与 seo.title 分离：H1 可更长更口语

  /** 一句话结论。首屏第一块，同时用于 HowTo.description 与 speakable */
  answer: z.string().min(40).max(320),

  /** 摘要：卡片 / 列表 / og:description 兜底 */
  excerpt: z.string().min(60).max(200),

  /** K1 关联：本页对应的动作词（用于程序化扩量审计，不上 meta keywords） */
  primaryKeyword: z.string().min(3),
  secondaryKeywords: z.array(z.string()).default([]),

  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  totalMinutes: z.number().int().positive().optional(),

  /** E-E-A-T 信号：实测版本 + 最近验证日期 */
  testedWith: z.object({
    version: z.string(),
    date: z.coerce.date(),
    environment: z.string().optional(),      // "macOS 15 / Node 22.11"
  }),

  prerequisites: z.array(prerequisite).default([]),
  steps: z.array(step).min(2),               // getting-started/checklist 也复用；pillar 可 3+
  body: z.array(block).default([]),          // 步骤之后的深入段落

  /** 报错引用（只存 slug，正文在 errors 集合） */
  errorIds: z.array(id).default([]),

  faq: z.array(z.object({ q: z.string().min(10), a: z.string().min(40) })).default([]),

  /** 内链结构（§4） */
  pillarId: id.optional(),                   // 上级 pillar
  seriesId: id.optional(),                   // 所属系列
  order: z.number().int().positive().optional(), // 系列内序号
  relatedIds: z.array(id).max(6).default([]),    // 手动指定，优先级高于自动推导
  comparisonIds: z.array(id).default([]),

  tags: z.array(id).default([]),
  published: z.coerce.date(),
  updated: z.coerce.date(),
});
```

### 3.3 报错 Schema（独立集合）

```ts
const errorDoc = z.object({
  slug: id,                                  // 例：content-collections-invalid-frontmatter
  seo,
  h1: z.string().min(15).max(90),

  /** 原始报错文本（单行，用户会整段粘贴搜索） */
  message: z.string().min(10),
  /** 错误码：errno / HTTP / 工具自定义码。无则省略 */
  code: z.string().optional(),

  answer: z.string().min(40).max(320),       // "原因：X。修复：Y。"
  symptom: z.string().min(60),               // 用户视角的症状描述
  category: z.enum(['build', 'runtime', 'config', 'network', 'types', 'deploy', 'other']),

  affected: z.object({
    versions: z.string().optional(),          // ">= 5.0.0, < 5.4.2"
    platforms: z.array(z.string()).default([]),
  }),

  /** 1–3 个成因，每个成因有自己的修复步骤 */
  causes: z
    .array(
      z.object({
        title: z.string().min(10),
        explain: z.string().min(60),
        steps: z.array(step).min(1),          // 复用同一个 step schema → 也产出 HowToStep
      })
    )
    .min(1),

  verification: z.object({ cmd: z.string(), expect: z.string() }),
  prevention: z.array(z.string().min(20)).min(1),

  /** 排障链：如果这些修复都不行，去看这些 */
  seeAlsoIds: z.array(id).default([]),

  faq: z.array(z.object({ q: z.string().min(10), a: z.string().min(40) })).default([]),
  tags: z.array(id).default([]),
  published: z.coerce.date(),
  updated: z.coerce.date(),
});
```

### 3.4 报错页的程序化扩量机制

这是整套方案的“暗河”，单独说清楚：

1. 采集：从 `tutorials[].steps[].errorIds` 反向统计引用次数 → `referenceCount` 在构建期计算，**不落库**（避免手写错）。
2. 排序：`/errors/` 索引按 `category` 分组、组内按 `referenceCount` 降序 → 自动把“最常见的错”排前面。
3. 正文只写一次：教程页里的报错区只渲染 `message` 首行 + `answer` 一句 + 链接，**绝不复制 `causes` 正文**。
4. 反向区：报错页底部的 `Referenced in these tutorials` 由构建期扫描生成，无需维护。
5. 扩量：新增一篇教程时，若它撞了新错，只需在 `errors/` 加一个 JSON + 在 `steps[].errorIds` 填 slug，两页同时获得内链。

### 3.5 对比 / 系列 / 主题 Schema

```ts
const comparison = z.object({
  slug: id,                                  // nextjs-vs-astro（字典序，保证唯一）
  seo,
  h1: z.string().min(15).max(90),
  answer: z.string().min(60).max(400),       // 必须含双方适用条件
  subjectId: id,                             // 本站主题，例 astro
  rivalId: id,                               // 对照方，例 nextjs
  testedWith: z.object({ aVersion: z.string(), bVersion: z.string(), date: z.coerce.date() }),
  rows: z.array(z.object({
    feature: z.string().min(3),
    a: z.string().min(1),
    b: z.string().min(1),
    edge: z.enum(['a', 'b', 'tie']).default('tie'),   // 驱动表格高亮
    note: z.string().optional(),
  })).min(6),
  winsA: z.array(z.string().min(40)).min(2),  // 本站赢的点
  winsB: z.array(z.string().min(40)).min(2),  // 对手赢的点（必须真诚）
  verdicts: z.array(z.object({ scenario: z.string(), pick: z.enum(['a', 'b', 'either']), why: z.string().min(40) })).min(2),
  migrationId: id.optional(),                 // 链到 T7
  faq: z.array(z.object({ q: z.string(), a: z.string().min(40) })).default([]),
  published: z.coerce.date(),
  updated: z.coerce.date(),
});

const series = z.object({
  slug: id,
  seo,
  h1: z.string().min(10),
  intro: z.string().min(120),
  /** 有序条目。构建期校验：itemId 都存在、order 连续、每篇的 seriesId 回指本系列 */
  itemIds: z.array(id).min(2),
  pillarId: id.optional(),
  updated: z.coerce.date(),
});

const topic = z.object({
  slug: id,
  name: z.string().min(2),                   // "Astro"
  nameShort: z.string().optional(),          // "Astro"
  tagline: z.string().min(10).max(120),
  /** 站点首页的 SEO，与主题自身描述分离 */
  seo,
  intro: z.string().min(200),
  officialUrl: z.string().url(),
  docsUrl: z.string().url(),
  category: z.string(),                      // "Static site framework"
  currentVersion: z.string(),                // "5.18"
  features: z.array(z.object({ id, label: z.string() })).default([]),  // 驱动 K2 扩量
  rivals: z.array(z.object({ id, label: z.string(), url: z.string().url() })).default([]), // 驱动 K4/K7
  /** 首页 FAQ */
  faq: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
  updated: z.coerce.date(),
});
```

### 3.6 字段 → JSON-LD 映射表

| 页面 | JSON-LD 类型 | 字段映射 |
|---|---|---|
| T1 Step Guide | `HowTo` | `name←h1`、`description←answer`、`totalTime←totalMinutes`(PT{n}M)、`tool←prerequisites[kind=tool]`、`supply←prerequisites[kind=file]`、`step[]←steps[]`（每步一个 `HowToStep`：`position←n`、`name←title`、`text←body[0..].text` 拼接、`url←{canonical}#step-{n}`）、`estimatedCost←omit` |
| T1 | `FAQPage` | `mainEntity[]←faq[]` |
| T1 | `BreadcrumbList` | `Home → Tutorials → {pillar? or 当前}` |
| T2 Pillar | `TechArticle` + `ItemList` | `ItemList.itemListElement←cluster 列表` |
| T3 Getting Started | `HowTo` + `Article` | 同 T1 |
| T4 Comparison | `Article` + `FAQPage` | 不伪造 `Review`/`aggregateRating`（无真实评分，发了会被判 spam） |
| T5 Error | `TechArticle` + `FAQPage` | `about←{@type:Thing,name:message}`、`keywords←code` |
| T7 Migration | `HowTo` | 同 T1 |
| `/` 首页 | `WebSite` + `Organization` + `FAQPage` | `potentialAction←SearchAction`（若加站内搜索） |
| 列表页 | `CollectionPage` + `ItemList` | — |

**硬规则**：`HowTo.step` 的 `text` 必须是纯文本（去 markdown 标记），且不得为空；`step.name` 不得重复。构建期校验，重复即 fail。

### 3.7 构建期门禁（`scripts/check-content.ts`）

在 `astro build` 之前跑，任一不达标则退出非 0：

| 检查 | 阈值 | 失败后果 |
|---|---|---|
| 正文词数 | ≥ 1000（error 页 ≥ 600，允许 `wordCountFloor` 覆盖） | fail |
| `seo.title` 长度 | 15–60 | fail |
| `seo.description` 长度 | 70–158 | fail |
| `steps[].n` 连续性 | 1..n 无跳号、无重复 | fail |
| `steps[].expected` | 非空 | fail |
| H2 编号一致性 | 页面 H2 序列 = Prerequisites → Step 1..n → Common errors → FAQ（顺序校验） | fail |
| `primaryKeyword` 覆盖 | 出现在 `h1` 或 `answer` 或首个 `body.p` 中 | warn |
| 关键词密度 | `primaryKeyword` 出现次数 ≤ 词数 × 1.5% | warn（防堆砌） |
| 断链 | 所有 `*Ids` 引用可解析 | fail |
| 孤儿页 | 每篇至少 1 条入链、≥3 条出链 | warn |
| 自适应重复度 | 两篇 `answer` 相似度 > 0.85 | warn（防程序化内容千篇一律） |

---

## 4. 内链规划

### 4.1 三层结构

程序化 SEO 站最容易死在“100 个互不相连的页面”。这套模板强制三层：

```
L0  首页 /                             ← 只链 4 个枢纽，不链单篇教程
     │
L1  Pillar（T2）+ 索引页（/tutorials/ /errors/ /vs/ /series/）
     │        每篇 pillar 链出 12–20 个 cluster
     │
L2  Cluster（T1/T5/T4/T7/T6）
              每篇链回 pillar(1) + 兄弟(2–3) + 报错(1–2) + 对比(0–1)
```

**深度约束**：任何页面从首页 ≤ 3 次点击可达。构建期可校验（BFS from `/`）。

### 4.2 链接配额（每页出链）

| 页面类型 | 必链 | 可选 | 上限 |
|---|---|---|---|
| T1 Step Guide | pillar ×1、同系列前后 ×2、`errorIds` 全部、related ≥3 | 前置条件教程、对比 ×1 | 15 |
| T2 Pillar | cluster 全部（12–20）、相关 error 索引 | 对比 ×2、系列 | 25 |
| T3 Getting Started | pillar ×1、series 后续 ×2、error ×3 | 对比 ×1 | 15 |
| T4 Comparison | 双方 pillar ×2、`migrationId` ×1、related ×3 | 对方站点官方链接（`rel="nofollow noopener"`） | 12 |
| T5 Error | 引用它的教程（自动，取前 8）、`seeAlsoIds` 全部 | 相关 pillar ×1 | 15 |
| T6 Checklist | 每条 checklist 项对应的详解页（≤12）、pillar ×1 | error ×2 | 16 |
| T7 Migration | 源技术 pillar（若有）、目标 pillar ×1、error ×3 | 对比 ×1 | 12 |

### 4.3 字段驱动的连边（不手写链接）

页面里**不出现硬编码 `<a href>`**，全部由数据推导：

| 边 | 来源 | 方向 |
|---|---|---|
| cluster → pillar | `tutorial.pillarId` | 单向（pillar 侧由构建期反查生成） |
| pillar → cluster | 反查 `pillarId === self.id` | 自动 |
| 系列前后 | `series.itemIds` + `tutorial.order` | 双向 |
| 教程 → 报错 | `steps[].errorIds ∪ errorIds` | 单向 |
| 报错 → 教程 | 反查上述引用 | 自动（`Referenced in these tutorials`） |
| 教程 → 对比 | `comparisonIds` 或按 tag 匹配 | 单向 |
| 对比 → 迁移 | `comparison.migrationId` | 单向 |
| 同 tag 兜底 | `relatedByTags()`（现有函数） | 自动，凑满 3 条 |

**`relatedIds` 的优先级规则**（避免自动推荐把人工编排冲掉）：

```
最终 related = 人工 relatedIds（≤6）
             + 同 pillar 且 order 相邻的兄弟
             + 同 tag 高分项
             → 去重、去自身、截断到 6
```

### 4.4 锚文本策略

禁止全站用同一个精确匹配锚文本（那是过度优化的最明显指纹）。每页内的锚文本按来源自动分档：

| 位置 | 锚文本形态 | 例 |
|---|---|---|
| 面包屑 / SeriesNav | 页面 `seo.title` 截断 | `Add a Sitemap in Astro` |
| pillar 列表项 | 列表标题 = `h1` | `How to Add a Sitemap in Astro (3 Steps)` |
| 步骤内 `errorIds` | 报错 `message` 首 6 词 | `Invalid frontmatter in content collections` |
| 正文内嵌（`errorRef` block） | 自然句 + 部分匹配 | `如果出现 frontmatter 校验失败，见…` |
| 文末 related | `h1` 去前缀 | `Add a Sitemap in Astro` |

同一页内同一 URL 只允许**一个**可点链接，第二次出现用纯文本或 `aria-hidden` 的装饰链接。

### 4.5 系列（Series）怎么组织

系列不是“所有教程按顺序排”，而是**一条有终点的学习路径**。全站 3–5 个系列：

1. `getting-started`（K3 那篇起，4–6 篇）→ 到"能部署上线"为止。
2. `{核心特性}-deep-dive`（K2 pillar 起，5–8 篇）→ 到"能自建一个完整功能"。
3. `{场景}-build-along`（项目式，4–6 篇）→ 到"有一个能跑的真实项目"。
4. `seo-and-performance`（K6 + K1 混合，5 篇）。
5. `migration`（K7 集合，按来源技术各一条）。

系列页的价值：`SeriesNav` 的上下篇产生**链式停留**（用户连看 5 页），这是站均时长最有效的杠杆，比 "related" 卡片强得多。

### 4.6 内链示意图

```
                        ┌─────────────┐
                        │  /  首页    │
                        └──────┬──────┘
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
      ┌──────────────┐  ┌────────────┐  ┌────────────┐
      │ /tutorials/  │  │  /errors/  │  │   /vs/     │
      └──────┬───────┘  └─────┬──────┘  └─────┬──────┘
             ▼                │               │
    ┌─────────────────┐       │        ┌──────▼───────┐
    │ Pillar (T2)     │       │        │ Comparison   │
    │ 12–20 出链      │       │        │   (T4)       │
    └───┬──┬──┬──┬────┘       │        └──────┬───────┘
        │  │  │  │            │               │
   ┌────▼┐ │  │  └─────┐      │               ▼
   │ T1  │ │  │        │      │        ┌──────────────┐
   │Step │ │  │        │      │        │ Migration T7 │
   └──┬──┘ │  │        │      │        └──────┬───────┘
      │ ┌──▼──┐┌▼─────┐│      │               │
      │ │ T6  ││ T3    ││      │               │
      │ │List ││Start  ││      │               │
      │ └──┬──┘└──┬────┘│      │               │
      │    │      │     │      │               │
      └────┴──────┴─────┴──────┼───────────────┘
                               ▼
                     ┌───────────────────┐
                     │ Error Page (T5)   │
                     │ 反向区自动生成    │
                     │ seeAlso 排障链    │
                     └───────────────────┘
```

---

## 5. 程序化扩量的落地节奏

不要一次生成 115 篇。按这个顺序上，每批都能独立验证索引效果：

| 批次 | 内容 | 数量 | 目的 |
|---|---|---|---|
| P1 | topic + 首页 + 1 篇 pillar + 3 篇 T1 + 2 篇 error | 7 | 打通管线，验证 JSON-LD 与门禁 |
| P2 | 主 pillar 的全部 cluster（T1）+ 对应 errors | 20 | 验证 hub-spoke 内链是否被爬 |
| P3 | 15 篇对比 + 15 篇迁移 | 30 | 吃选型流量（转化最高） |
| P4 | 3 个系列 + 入门页 + K6 清单 | 15 | 拉站均时长 |
| P5 | 剩余 K1 + 长尾 error | 40+ | 铺量 |

每批上线后改 `SITEMAP_OPEN`（现有机制），未验证的路由保持 `noindex` + 不进 sitemap + 不出内链。这样即使某一批内容质量不达标，也不会拖累整站。

---

## 6. 与现有 `game-wiki` 模板的关系

| 项 | 复用 | 重写 |
|---|---|---|
| `BaseLayout.astro` / `Seo.astro` / `JsonLd.astro` | ✅ 直接搬 | — |
| `lib/routes.ts` / `lib/sitemap.ts` / `pages/sitemap*.ts` / `robots.txt.ts` / `404.astro` | ✅ 改路由表 | — |
| `config/site.ts`（含 `SITEMAP_OPEN` 门禁） | ✅ 直接搬 | — |
| `content.config.ts` | 结构照搬 | 全部 schema 换成本文 §3 |
| `lib/jsonld.ts` | `breadcrumbNode` / `faqNode` / `itemListNode` 复用 | 新增 `howToNode` |
| `lib/content.ts` | 访问层模式复用 | 集合与关联函数重写 |
| 组件 | `AdSlot` / `SiteHeader` / `SiteFooter` | 新增 §2.0 的 B1–B13 |

落地目录：`/Users/lilaoji/WorkBuddy/模版站开发/wikismith/tutorial-site/`（与 `game-wiki` 平级，互不干扰）。

---

## 7. 待你确认的 3 个决策点

1. **内容格式**：本文档按 **JSON + 类型化 blocks**（与现有模板一致，机器生成友好）。若你更想手写长文，可改为 **Markdown frontmatter + 正文 MD**——代价是 `steps` 塞进 YAML 后多行 code block 会很难维护。**我建议 JSON**。
2. **词数阈值**：正文 1000 词按**英文词**算（`words` 计数，剥离代码块）。若站点语言是中文，阈值要换算成 1800 字符——`site.ts` 里加一个 `wordCountMode: 'words' | 'chars'`。
3. **演示数据集**：用 Astro 作为内置示例主题（可验证、无需编造产品事实），还是你直接给一个真实业务主题（如 Shopify App / n8n / Supabase），我按真实词库写种子内容？
