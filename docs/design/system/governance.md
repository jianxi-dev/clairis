---
title: "设计全景与治理运行手册"
type: guide
status: in-review
last_updated: 2026-11-08
source_of_truth: supporting
---

# 设计全景与治理运行手册

> **这份文档回答两件事**：本仓的设计信息到底有哪些（内容全景），以及权威矩阵的六层怎么贯穿到日常设计与实现里（运行机制）。
>
> **它不是第二真相源**：规范数值的 canonical 仍是 [spec.md](./spec.md)，单点裁决的 canonical 是 [decisions.md](./decisions.md)。本文含**2026-11-08 的数值快照**用于通读；两者不一致时**以 spec / decisions 为准**，并由触发修订的同一个 change 回头同步本文。
> DG-2 的「不复制数值」约束对象是 feature 设计、票面与 e2e 断言；本文是导览，不受该禁令约束，但受「不准成为第二裁定来源」约束。

---

## 0. 全貌地图：两个轴

| 轴 | 内容 | 回答的问题 | 权威来源 |
|---|---|---|---|
| **权威轴（6 层）** | 文档类别之间谁说了算 | 两份文档对同一事实说法不同时听谁的 | [`docs/README.md`](../../README.md) §二 + [`GOVERNANCE.md`](../../GOVERNANCE.md) §5 |
| **生命周期轴（G0–G4）** | 一件事从触发到归档经过哪些阶段 | 现在该做什么、做完算什么 | `.opencode/skills/change-workflow/` |

**六层里没有「检查层」和「缺陷层」**——检查是生命周期里的门，缺陷是生命周期里的入口。**设计系统也不是第 7 层**，它住在第 4 层内部：

```
第 4 层 approved design
├── design/system/     ← 跨界面共享数值与裁决（spec / decisions / 本文）
└── design/approved/   ← 单 feature 形态（只引用，不复制数值）
```

| 层 | 名称 | 本仓实际位置 | 一句话内容 |
|---|---|---|---|
| L1 | active change delta | `openspec/changes/` | 本次变更的临时真相 |
| L2 | canonical spec | `openspec/specs/`（17 域） | 功能怎么算对 |
| L3 | ADR / architecture | `docs/architecture/`（11 条 ADR） | 为什么这么选 |
| L4 | approved design | `docs/design/system/` + `docs/design/approved/` | 视觉数值与单 feature 形态 |
| L5 | product direction | `docs/product/` | 该不该有、为谁做 |
| L6 | research / history | `docs/design/explorations/`、`docs/research/`、`docs/archive/` | 当时为什么这么想 |

**「贯穿」的实体不是链条，是每条跨层边上的三件套**：引用契约（下层引用上层的哪个标识）、机检（谁验、在哪一步验）、退役条件（何时失效、失效后能否被引用）。参见 §9。

---

## 1. L5 产品层：Doctrine（设计哲学）

位置：[`docs/product/principles.md`](../../product/principles.md)（accepted · canonical）。**这里裁决「该不该有」，不裁决「多大算合适」。**

### 1.1 总纲与气质

- **总纲**：用最少干扰达成用户所愿。
- **气质**（不具裁决力）：懂你、减负、惊喜、正向陪伴；沉浸、仪式、留白。
- **品质对标**：比 Notes 安静、比 Drafts 轻、比 Keep 有组织；生成物「单文件即成品」。
- **效力**：任何设计、规格、变更与铁律冲突时，须显式引用 D# 给出豁免理由并经维护者确认。

### 1.2 十条铁律（D1–D10）

| # | 条款 | 一句话 | 判定问题 |
|---|---|---|---|
| D1 | **内容是王** | 界面 chrome 不抢注意力、不占文档展示空间 | 这个元素在不交互时出现，是在服务谁？ |
| D2 | **减法至上** | 每个元素必须证明自己存在；删不掉 = 不该存在 | 去掉它，界面是否更好？ |
| D3 | **操作即所得** | 意图与响应之间步骤 = 1；AI 写前确认卡是代理侧最小打扰形态 | 用户想完成这件事要点几下？ |
| D4 | **键盘优先** | 高频操作快捷键 ≥80% 可达，主流程单手键盘走通 | 主流程必须碰鼠标吗？ |
| D5 | **默认值即产品（omakase）** | 精选默认行为，高级选项藏 override 层 | 新用户不看说明书能不能直接用？ |
| D6 | **一切可变状态皆文本（malleable）** | 配置/键位/模板/扩展 = 约定目录的文本文件；扩展点先做数据文件，不做 API | 这个调整需要改源码吗？ |
| D7 | **AI 可塑但必须可撤销（agentic）** | 写前确认卡、写后快照、改坏一键恢复；永不绕过审计 | 用户手滑一下能不能一步回来？ |
| D8 | **误操作与升级皆可逆** | 破坏性操作必有回退；升级 = 幂等迁移 + 回滚点 | 误操作或升级后数据还在吗？ |
| D9 | **生成物离线单文件** | HTML 断网可看、零外部子资源 | 生成的产物断网能看吗？ |
| D10 | **零门槛** | 不装外部依赖即可用全部核心能力 | 用户要装什么才能用核心功能？ |

### 1.3 不为谁做（五条）

1. 不为愿意折腾的系统级玩家做整机级定制（那是 omarchy 的领地）。
2. 不为团队/多人协作做（本定位周期不承诺）。
3. 不为插件市场/公开扩展 API 做（扩展点 = 数据文件，见 D6）。
4. 不为云端免费服务做（本地优先，API key 用户自持）。
5. 不为多语言市场调整产品节奏（中文体验优先，英文是翻译不是重设计）。

### 1.4 这一层裁决不了什么

「下拉三角多大算合适」「斜杠线多长算对」——D# 只能回答「这个元素该不该存在」。数值问题必须下沉到 L4 的 [spec.md](./spec.md)。这正是 2026-11 那批返工的根因：哲学被当成了规范。

---

## 2. L4 上半：设计系统规格（视觉数值）

位置：[`spec.md`](./spec.md)（accepted · canonical）。下面的数值是 **2026-11-08 快照**，可复现命令写在 spec 页脚。

### 2.1 图标：网格与笔画

| 项 | 规范 |
|---|---|
| viewBox | `0 0 24 24` |
| 安全区 | 四周 2px，笔画落在 2..22 |
| 等效笔画 | **1.7px**（1.6–1.8），`stroke-linecap/linejoin = round` |
| 圆角 | 容器 2px；小元素 1–1.5px |
| 光学对齐 | 按视觉重心居中；圆形比方形大 0.5px |
| 密度 | 单个图标 ≤6 条独立笔画 |
| 尺寸 | **14 / 18 / 24 三档**（`IconSize`）：14 仅密集工具条与卡片内联，18 常规，24 主操作与空态 |
| 颜色 | path 不写死颜色，一律 `currentColor`；类型色由容器 `--type-*` 提供 |

**实现契约**：保留 `Icon` 组件 `fill="currentColor"`，描边图标写 `fill="none" stroke="currentColor" stroke-width="1.7"`；新概念必须同时进 `src/ui/icons.ts` 的 `ICONS` 表，禁止组件内联一次性 SVG。

### 2.2 图标：概念分组与规则

| 组 | 概念 |
|---|---|
| 文件类型（8） | markdown / html / text / pdf / video / image / code / audio |
| 导航与外观（10） | folder / file / search / grid / pin / chevronLeft / chevronRight / sun / moon / monitor |
| 动作（10） | close / settings / expand / more / eye / pencil / export / share / locate / copyPath |
| 状态（2） | check / warning |
| 分屏（2） | splitRight / splitDown |
| AI（1） | sparkle |

**覆盖缺口（已知）**：实现有 **61 个键**，本表只覆盖 33 个；另有 28 个未归组——媒体控件（play / pause / prev / next / volume / volumeMute / playlist / loop×3 / subtitle / timestampNote / keyboardHints / pip / speed / home / heart×2）、导出族（exportWord / exportZip / exportMdpkg）、其余（pinOff / collapse / sunBright / sunWarm / closeOthers / chevronDown / immersive）。

**跨概念规则**：
- **html / code 靠斜杠区分**：html `</>`，code `<>`；
- **export 与 share 不共用构图**：export = 向上箭头 + 开口托盘；share = 三节点连线；
- **可逆动作必须成对**（6 对）：pin/pinOff、expand/collapse、volume/volumeMute、play/pause、heart/heartFilled、沉浸进入/退出；禁止单向孤儿。

**注意事项**：
- `collapse` 18px 下四角括号内收后略像「+」：保留 tooltip 与 `aria-pressed` 兜底；QA 对加大位移的措辞是「可考虑」，当前未改。
- **实现偏差**：`icons.ts` 的 pinOff 斜杠仍是贯穿整格的版本，尚未对齐台账定案。

### 2.3 间距刻度

来源：`src/styles/*.css` 实测频次（单一 glob；同时传 `src/**/*.css` 会翻倍）。

| token（目标） | 值 | 次数 | 用途 |
|---|---|---|---|
| `--space-2` | 2px | 56 | 图标与文字紧贴、微调 |
| `--space-4` | 4px | 52 | 紧凑内距（主力档） |
| `--space-6` | 6px | 38 | 控件内距、按钮水平 padding |
| `--space-8` | 8px | 29 | 常规内距、列表项间隔 |
| `--space-10` | 10px | 19 | 行高补偿、中等内距 |
| `--space-12` | 12px | 27 | 区块内距 |
| `--space-16` | 16px | 17 | 区块间间隔 |
| `--space-24` | 24px | 8 | 区域分隔（凭语义入档，不凭频次） |

**不进入刻度**：`1px`（93 次，发丝线/边框）、`3px`（14）、`5px`（7）、`14px`（7）为微调值；`20px` / `22px` 多为容器宽高。

### 2.4 字号阶梯

| token（目标） | 值 | 次数 | 用途 |
|---|---|---|---|
| `--fs-11` | 11px | 5 | 极小标注、状态栏副信息 |
| `--fs-12` | 12px | 13 | 次级 UI 文本（主力） |
| `--fs-13` | 13px | 6 | 常规 UI 文本（主力） |
| `--fs-14` | 14px | 3 | 强调 UI 文本、按钮 |

**正文字号不在表内**：阅读区字号由用户设置控制，见 [`approved/reader-typography/`](../approved/reader-typography/)。

### 2.5 圆角与阴影

| 名称 | 值 | 用途 |
|---|---|---|
| `--radius-4` | 4px | 控件、按钮、菜单行（基准，实际 21 次） |
| `--radius-8` | 8px | 卡片、浮层、弹窗 |
| `--radius-full` | 999px | 胶囊、圆形 |
| `--app-radius` | 6px | **存量**（仅 5 次），不新增使用 |

**阴影现存矛盾**：20 处 `box-shadow` 声明 = 6 处纯 token（`--app-shadow` ×5、`--reader-shadow` ×1）+ 4 处 inset 混用 `--app-accent` + 10 处纯字面量（6 种）。规则：新代码一律用 `--app-shadow`，存量不追溯。

### 2.6 语义色（三主题现状誊写）

| 变量 | 亮（:root） | 暗（.dark） | 暖（.warm） |
|---|---|---|---|
| `--app-accent` | `#6366f1` | `#818cf8` | `#0071e3` |
| `--app-bg` | `#f7f7f6` | `#131316` | `#f2e9da` |
| `--app-surface` | `#fbfaf8` | `#1a1b1e` | `#fbf4e8` |
| `--app-sunken` | `#f4f2ec` | `#22242a` | `#efe3d0` |
| `--app-text` | `#24262b` | `#d8dade` | `#3b3024` |
| `--app-text-strong` | `#16181c` | `#eceef1` | `#241c12` |
| `--app-text-2` | `#55595f` | `#a7abb3` | `#6b5a45` |
| `--app-text-3` | `#8b8f96` | `#75797f` | `#96826a` |
| `--app-border` | `#e7e3db` | `#2e3138` | `#e0d2bc` |
| `--app-border-strong` | `#d8d3c8` | `#3d4149` | `#cdbca1` |

**类型色**（三主题不换色）：markdown `#6366f1`、html `#f59e0b`、text `#64748b`、pdf `#ef4444`、video `#a855f7`、image `#10b981`、code `#06b6d4`、audio `#ec4899`。

**错误 / 危险色**：亮 `#a8402f`、暗 `#e08b7a`（callout danger/error 与错误文本）。红色只用于错误，绝不用于未保存/脏状态。注意 `--type-pdf` 的 `#ef4444` 是**类型色不是错误色**。

**已知缺口**：错误色无独立 token（现值散落在 `editor.css` / `reader.css`）；`--app-accent-soft` 各主题 alpha 不同（.10 / .14 / .08）。

### 2.7 L3 审美判据（人工裁决，不机检）

源自已作废的 `ui-philosophy` §六，仅此清单被回收：

- 能删吗？删掉会影响核心功能吗？
- 能合并吗？能不能和其他入口合并？
- 默认出现吗？用户需要时它在那里吗？
- 能直觉发现吗？不看书能不能找到？
- 能一键完成吗？操作路径 = 1？
- 提醒打扰吗？不打扰，除非出错。
- 心智模型一致吗？和浏览器/系统习惯一致吗？

### 2.8 明确不做

不做组件模式库、不写动效规范、不做品牌指南、不做像素级审计、不机检审美判据、不为每个像素立法、不追溯改写存量硬编码。

---

## 3. L4 下半：决案台账（具体部件裁决）

位置：[`decisions.md`](./decisions.md)（accepted · canonical · `ledger: append-only`）。

| 部件 | 决定 | 出处 | 日期 |
|---|---|---|---|
| 图钉 pin / pinOff | 矩形钉头 + 三角钉身 + 针；pinOff 斜杠只穿钉身 | v3 QA 第三轮 | 2026-11-07 |
| pinOff 斜杠 | 只覆盖本体不贯穿；原型值未落地，实现为 `M7.4 16.6L16.6 7.4`，以实现值为准 | #366 / PR #387 | 2026-11-08 |
| pin 钉住态边框 | 未钉住无边框；钉住 1px 细边框 | #368 / PR #388 | 2026-11-08 |
| settings 图标 | 7 齿圆头齿轮 + 内孔（圆环）；r9.2、齿顶 26°、齿根 33°、齿角 r0.6 | v3 QA 第七轮 | 2026-11-07 |
| 沉浸模式 immersive | 圆相（Ensō）：未闭合圆、缺口在下 | v3 QA 第七轮 | 2026-11-07 |
| 预览 eye | 还原为眼睛（两段三次贝塞尔 + 瞳孔），不用眼镜 | v3 QA 第七轮 | 2026-11-07 |
| 倍速 speed | 240° 速度表：弧 + 指针 + 轴心 | v3 QA 第五轮定案 A | 2026-11-07 |
| 循环三态 | 弧形版 r5.5，角标 1/N 置于环内中心 | v3 QA 第六轮（回退，第七轮确认） | 2026-11-07 |
| 分屏 split | 实线格 + 虚线格，间距 3 单位 | v3 QA 第 8–10 格 | 2026-11-07 |
| 状态栏主题按钮 | 不加下拉指示，三角整体移除；亮/暖靠光线数区分 | #389 / PR #397 | 2026-11-08 |
| 缩略图 rail | 64 × 48，不再放大；修与上下文字重叠 | #392 / PR #396 | 2026-11-08 |
| 悬浮预览动作按钮 | 14px，悬停浮现 | #365 / PR #386 | 2026-11-08 |
| 状态栏宽度面板 | 斜面柱 + 长滑块，上限 1400，中位跟随指针 | #390 / PR #398 | 2026-11-08 |
| 大纲按钮位置 | 右移到距右缘三分之二 | #393 / PR #395 | 2026-11-08 |
| markdown 图标 | 圆角纸片 + 粗 M（M 宽 7 单位，18px 下可读） | v3 QA 定案 B | 2026-11-07 |

**维护规则**：只追加不改写既有行；同部件冲突须注明「取代第 N 行」；已落地行必须带 PR 号；一行只讲一件事；需要引用时写 `ledger:<部件>`，不复制内容。

---

## 4. L4 内：单 feature 批准设计

位置：`docs/design/approved/<feature>/`。**只引用 spec 条款，不复制数值。**

当前 10 个已批准 feature：

| Feature | 行为规格（canonical） |
|---|---|
| 沉浸阅读 `immersive-reading/` | `openspec/specs/reading/`（A-5） |
| 字号缩放 `font-size-scaling/` | `openspec/specs/reading/`（A-6） |
| 阅读进度 `reading-progress/` | `openspec/specs/reading/`（A-9） |
| 空状态 `empty-state/` | `openspec/specs/application-shell/`（B-1/2/4/5） |
| 无侧栏导航 `navigation/` | `openspec/specs/navigation/`（B-3/6/7/8） |
| 大纲 + Quick Capture `outline-quick-capture/` | `openspec/specs/capture/`（D-1..D-14） |
| 界面布局 `shell-ui/` | `openspec/specs/application-shell/`（G-1..G-5） |
| 阅读排版 `reader-typography/` | `src/styles/reader.css` + `src/renderers/` |
| 视频播放器 `video-player/` | 待同步 `openspec/specs/` |
| 门户与布局 `layout-portal/` | `openspec/specs/navigation/` |

**注意**：approved 层低于 canonical spec；设计稿与 spec 冲突时 spec 胜，改设计稿。

---

## 5. L3 架构层：ADR（为什么这么选）

位置：[`docs/architecture/decisions/`](../../architecture/decisions/README.md)。编号不回收；只新增 superseding ADR，不改写旧文。

| # | 决策 | 状态 |
|---|---|---|
| 0001 | 阅读/编辑分离（双渲染管线） | accepted |
| 0002 | 模式切换用 CSS display 非 remount | accepted |
| 0003 | store→CM6 同步 debounce 300ms | accepted |
| 0004 | store 存纯文本，不存编辑器对象 | accepted |
| 0005 | API key 只存 OS keyring | accepted |
| 0006 | 配置三层与快照回滚 | accepted |
| 0007 | 生成物 = 编译产物，源 md 唯一事实源 | accepted |
| 0008 | AI 入口分期与语音第二输入源 | accepted |
| 0009 | 可折叠阅读空间取代无侧栏 | accepted |
| 0010 | HTML 可视化编辑以 content 为唯一真相 | accepted |
| 0011 | 场景化外壳与 Pane 递归树取代旧扁平分屏 | accepted |

**缺口**：没有「ADR 是否被引用/索引可达」的机检。`overview.md` 与代码漂移靠跨模块 change 顺手核对。

---

## 6. L2 规格层：功能行为真相

位置：`openspec/specs/`，**17 个域**：

`ai-agent`、`ai-entry`、`app-identity`、`application-shell`、`brand-narrative`、`capture`、`configuration`、`diagram-rendering`、`docs-governance`、`editing`、`export`、`extensions`、`file-management`、`mdpkg`、`navigation`、`pr-automation`、`reading`。

规则：
- **只由 change delta 合入**，禁止手改主规格；
- **不写视觉数值**，写「紧凑档」并引用 `design-system:§N`；
- requirement 必须可观测（QG-1）。

`docs-governance` 域含 G-1..G-3 与本次新增的 **DG-2..DG-5**（设计系统唯一数值来源 / append-only 台账 / 票面视觉锚点 / 视觉缺陷承接）。

---

## 7. L1 变更层：一次改动怎么被裁

- `openspec/changes/<change>/`：proposal / design / tasks / specs delta；
- **M0 锚点门**：每 requirement ≥1 anchor，anchor 的 `source` 只允许四种——`design-system:§N`、`spec:§`、`principles:D#`、一手观察（附证据）。写「上次实现」就是返工的起点；
- G0 程序化生成 `conformance.json` + `baseline/*.png` 并锁哈希，实施期只消费；
- 纯文档 change 会 `validate --strict` 失败（需至少一个 spec delta）——补最小 delta 或显式非 strict。

---

## 8. L6 研究历史层：探索与归档

位置：`docs/design/explorations/`、`docs/research/`、`docs/archive/`。**默认不参与实现裁定。**

截至 2026-08-01 的 20 个建档探索组（详见 [explorations/README](../explorations/README.md)），后续又增 `icon-system-v2`、`icon-system-v3`、`design-governance`：

| 类别 | 组 |
|---|---|
| 已收编（内容进批准设计或规格） | immersive-reading、font-size-scaling、reading-progress、empty-state、outline、no-sidebar、three-column、reader-typography、capture-overlay |
| 纯探索（无裁定力） | theme、prototypes、design-codex、folio-breakthrough、ink-desk、ink-river、jianming-nextgen、the-desk、ui-html、landing |
| 本次收编 | icon-system-v2（规则进 spec）、icon-system-v3（七轮定案进 spec/台账）、ui-philosophy（仅 L3 判据被回收）、design-governance（结论进本文与 change） |

**越界风险（已发生一次）**：`ui-philosophy` 曾被当成实现依据。规则：canonical 文档不得引用 `explorations/` 路径；**该检查尚未机检**。

---

## 9. 跨层引用契约

| 边 | 契约 | 现状 | 机检 |
|---|---|---|---|
| L5 → L4 | spec 每条规则显式标 D# 依据 | 未强制 | 人工评审 |
| L4 system → L4 feature | 只引用条款，不复制数值 | 规则已立 | **未机检** |
| L4 → L1 | 可见 UI 票面必须有 `**视觉锚点**` | 规则已立 | **C9 未落地**（上游工具包） |
| L2 → L1 | requirement ↔ delta 双射 | 有 | `validate --strict` |
| L1 → L2 | 归档 delta 合入 specs | 有 | G4 / `openspec archive` |
| L1 → L3 | 架构性变更必须产 ADR | 弱（靠自觉） | 人工 |
| L6 → L4 | 吸收后旧稿标 `superseded_by` + `redirect` | 有 | `docs-governance-check` |

**两条解释条款**（[`GOVERNANCE.md`](../../GOVERNANCE.md) §5.1）：

- **条款 A · 具体性优先**：同一事实，低层更具体且不矛盾 → 共存，不算冲突。
- **条款 B · 矛盾即缺陷**：低层与高层矛盾（如设计违反 D#）→ 高层胜，且低层文档必须修订；产品方向对设计的约束通过评审落地，不在矩阵内另设权威。

---

## 10. 三个回路（规范怎么长、怎么记、怎么查）

### 回路 1：规范更新

| 档 | 触发 | 形态 | 门 |
|---|---|---|---|
| 小裁决 | 用户裁决 / 缺陷票定案 | 追加一行台账 | risk-low 文档 PR |
| 刻度级修订 | 规范不足 / 多次 gap | spec supersede（新文件 + 旧文 superseded） | 评审 |
| 发现 gap | 票面锚点找不到条款 | 先补条款再写码；gap 是正常信号 | 不阻断 |

### 回路 2：append-only 台账

四列固定（部件 / 决定 / 出处 / 日期）；合并后只追加；冲突写「取代第 N 行」；例外只约束**已合并**台账，同一 PR 内定稿前更正不受限。

### 回路 3：漂移巡检

| 检查 | 现状 | 缺口 |
|---|---|---|
| frontmatter / canonical 唯一 / 相对链接 / 归档位置 | `npm run docs:check`，已接 `scripts/verify.sh` 3b | **未接 CI** |
| explorations 越界 | 无 | 待补 |
| 票面视觉锚点 | 无 | C9（上游工具包） |
| e2e 断言锚定 spec | 无（如 285×260 硬编码） | 待后续 change |
| spec ↔ tokens 漂移 | 无 | 本文与 spec 标注为快照 |
| T2 感知核验 | `CMD_FIDELITY` 未配置 → **静默跳过** | 配或明确不声称 |

---

## 11. 生命周期 × 六层

| 阶段 | 产出到哪层 | 门 |
|---|---|---|
| 触发（issue / 反馈 / 缺陷） | 无层（意图） | 归一化 |
| G0-PRE `to-spec` | 收集 L5/L4 引用 | L-1 契约门 |
| G0 阶段二 `propose` | **L1** delta + M0 锚点 | M0 四规则 |
| G0-POST `to-tickets` | **L1** 票面 | C1–C8（+ C9 待落地） |
| G1 实施 | 代码落地 **L4** 数值 | QG-5 证据（before/after 成对） |
| G1 出口 | 证据 + 视觉锚点核对 | code-review → review（risk≥medium） |
| G2 PR | **L1** | `pr-automation.sh` |
| G3 | **L6**（learn 沉淀） | 无 |
| G4 收尾 | **L2** 合入、**L1** 退役、架构性则 **L3** ADR | `validate --strict` |

**唯一允许写代码的阶段是 G1**——挡掉「设计讨论顺手改 CSS」这类越层操作（无机检）。

---

## 12. 现状台账（诚实版）

| 机制 | 状态 | 位置 |
|---|---|---|
| 设计系统数值唯一来源 | ✅ | `spec.md`（accepted · canonical） |
| 单点裁决台账 | ✅ | `decisions.md`（append-only） |
| 治理条款（例外 / 字段 / 解释条款） | ✅ | `GOVERNANCE.md` §2.3 / §3.2 / §5.1 / §6 |
| 上下文路由（实现 UI 前读规范） | ✅ | `AGENTS.md` |
| 视觉缺陷通道 + 四要素反馈 | ✅ | `docs/agents/defect-workflow.md`、`ui-feedback.md` |
| 票面视觉锚点（人工执行） | ✅ 规则 | `AGENTS.md`；C9 前由 code-review |
| C9 机检 | ⬜ 待上游 | [`delivery/plans/c9-visual-anchor.md`](../../delivery/plans/c9-visual-anchor.md) |
| tokens.css 扩容 / 存量迁移 | ⬜ 待后续 change | `--space-*` 等尚未定义 |
| e2e 断言锚定条款 | ⬜ 待后续 change | 现为硬编码 |
| spec ↔ tokens 漂移检查 | ⬜ 未规划 | — |

---

## 13. 怎么判断这套东西失败

**不看「文档写完没有」，只看两个数：**

1. **主指标**：同一 UI 部件在 30 天内被 ≥2 张票重复修改视觉参数的事件数（按部件计）。基线：复盘前 3 天 4 个部件。
2. **先行指标**：可见 UI 票的视觉锚点引用率。**100% 才健康**；恒为 0 = 票面在绕过规范；出现 gap 票是健康信号。

**失败信号**：4–8 周内票面从不引用、台账零新增、返工照旧——那就是第四本被 superseded 的手册。

---

## 14. 延伸阅读（建议顺序）

按这个顺序读，先有地图再进细节：

| # | 文档 | 读它回答什么 |
|---|---|---|
| 1 | 本文 | 全仓设计信息与运行机制 |
| 2 | [设计复盘（retro.md）](../explorations/design-governance/retro.md) | 为什么要做：五个断点与返工证据链 |
| 3 | [设计系统规格（spec.md）](./spec.md) | 数值的 canonical 原文与复现命令 |
| 4 | [决案台账（decisions.md）](./decisions.md) | 台账原文与维护规则 |
| 5 | [文档治理规范（GOVERNANCE.md）](../../GOVERNANCE.md) §2.3 / §3.2 / §5.1 / §6.3 | 台账例外、字段、矩阵解释条款、归档要求 |
| 6 | [AGENTS.md](../../../AGENTS.md)「项目上下文路由」「设计」 | agent 实际被约束成什么样 |
| 7 | [C9 视觉锚点机检方案](../../delivery/plans/c9-visual-anchor.md) | 唯一剩下的机检怎么实现（交 cw 工具包上游） |
| 8 | [change 归档：design-system-governance](../../../openspec/changes/archive/2026-11-08-design-system-governance/proposal.md) | 这次治理变更的完整 Why / What / Delta |

阅读提示：L3（ADR 引用检查）与 L6（越界检查）目前只有人工约束，没有机检——那两处是本文最虚的地方。
