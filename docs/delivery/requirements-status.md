---
title: 需求实现状态总览
type: delivery
status: accepted
last_updated: 2026-11-07
source_of_truth: supporting
---

# 需求台账（需求 × 实现状态总览）

> 本表是全项目**需求统一入口**：凡项目里出现过的需求（含未立项、历史遗留），都应收敛到本表登记，避免散落各处无法追踪。它不是独立真相源——
> - 逐功能可验收行为（怎么算对）以 `openspec/specs/<domain>/spec.md` 为准；
> - 进行中变更（正在改什么）以 `openspec/changes/` 活跃 change 为准；
> - 本表的状态列**必须**能从 openspec 归档记录推断，禁止脱离 openspec 自行标状态。

## 维护规则（硬约束）

1. **新增/变更需求**：先 `/opsx-propose` 建立 change 工作包（proposal + design + tasks），需求才算"进行中"。
2. **实现**：`/opsx-apply` 勾选任务、同步 delta specs。
3. **完成**：`/opsx-archive` 归档（delta 合入主规格、变更移入 `openspec/changes/archive/`）后，本表状态列更新为 ✅。
4. **新需求一律先登记到本表"未立项需求"节**，再走 propose 立项；禁止只在对话/其他文件里提需求不登记。
5. **状态口径**：
   - ✅ = 有归档 change 覆盖（实现 + 验收 + 规格折叠闭环完成）
   - 🟡 = 已实现/已完成设计，但**未走 openspec 变更登记**（多为 V3 沿用或早期实现，建议逐步补 change 记录）
   - ⬜ = 待开发（设计已定或未定，无实现）
   - 🗒 = 未立项（已登记、尚未建 change）
6. 每次归档后跑一次 `openspec list` 确认 active changes 归零；本表随最新归档同步。

## 快捷命令

```bash
openspec list              # 进行中变更（0 = 当前无在做的功能）
openspec list --specs      # 各域 + requirement 数
openspec view              # 交互式 dashboard（specs + changes 一屏总览）
openspec status --change <name>   # 单个变更工件完成度
```

## 总览统计（截至 2026-11-07）

- 规格：17 域 / 128 requirement（2026-11-07 归档 html-edit-toolbar、html-visual-move-capture、html-toolbar-by-node-type 后）
- ✅ 经 openspec 归档实现：14
- 🟡 已实现/设计完成（未走 openspec 变更）：24
- ⬜ 待开发：16
- 🗒 未立项（遗留散件登记）：约 16（展卷仪式 8 模块 + TODOS 安全/功能项）
- 布局域（`layout-portal`）：12 条构建验收（L-1…L-12，第 12 条 Out of Scope）已实现，16/16 票合并，已归档 `openspec/changes/archive/2026-11-05-layout-portal`
- 阅读/编辑表面域（`reading-surface-refine`）：+10 需求（G-6/G-7、A-13/A-14、E-17/E-18、N-1…N-3、CF-6）已实现，8/8 票合并（含 #224/#226/#231 三次缺陷修复），已归档 `openspec/changes/archive/2026-11-06-reading-surface-refine`
- 编辑域（`html-edit-toolbar`）：+1 需求（E-19 HTML 可视化编辑工具条），已归档 `openspec/changes/archive/2026-11-07-html-edit-toolbar`（PR #264）
- 编辑域（`html-visual-move-capture`）：+2 需求（E-20 拖拽移动节点、E-21 区域截图），已归档 `openspec/changes/archive/2026-11-07-html-visual-move-capture`（PR #266）
- 编辑域（`html-toolbar-by-node-type`）：+1 需求（E-22 工具条按节点类型分化），已归档 `openspec/changes/archive/2026-11-07-html-toolbar-by-node-type`（PR #269）

## 逐域状态

### reading（10）

| 编号 | 需求 | 状态 | 证据 |
|---|---|---|---|
| A-1 | 冷启动秒开 | 🟡 | V3 沿用 |
| A-2 | GFM 完整渲染 | 🟡 | V3 沿用（marked） |
| A-3 | HTML 预览 | ✅ | change `html-css-view-support` / `html-preview-rework` |
| A-5 | 沉浸阅读模式 | 🟡 | 设计已批 `docs/design/approved/immersive-reading/` |
| A-6 | 全局字号缩放 | 🟡 | 设计已批 `docs/design/approved/font-size-scaling/` |
| A-7 | Dark/Light 主题 | 🟡 | V3 沿用 |
| A-8 | 滚动顺滑 | 🟡 | V3 沿用 |
| A-9 | 阅读进度与位置恢复 | ✅ | change `reading-view-implementation` |
| A-10 | 阅读宽度与标题配色 | ✅ | change `html-preview-rework` |
| A-11 | 预览表格宽度与自动换行 | ✅ | change `preview-table-width` |
| A-12 | 图表渲染（Pele，同步出图 / 主题变量 / 导出带图） | ✅ | change `diagram-engine-pele` |
| A-13 | 悬浮预览的离开关闭与媒体渲染 | ✅ | change `reading-surface-refine`（归档 2026-11-06） |
| A-14 | HTML 摘要文本化 | ✅ | change `reading-surface-refine`（归档 2026-11-06） |

### capture（15）

| 编号 | 需求 | 状态 | 证据 |
|---|---|---|---|
| D-1 | 大纲侧栏 | ⬜ | 设计已批 `docs/design/approved/outline-quick-capture/` |
| D-2 | Headings Palette | ⬜ | 设计已批同上 |
| D-3 | Quick Capture 全局浮窗 | 🟡 | 已实现（`src/components/CaptureOverlay.tsx`） |
| D-4 | prefix 粘滞输入 | 🟡 | 已实现 |
| D-5 | inbox daily file 保存 | 🟡 | 已实现 |
| D-6 | 文件面板 QC 条目接入 | ⬜ | 依赖 B-3 |
| D-7 | QC 转正 | ⬜ | — |
| D-8 | Cmd+Shift+, Inspector | ⬜ | — |
| D-9 | QC filter 与 batch | ⬜ | — |
| D-10 | 窗口宽高可调 | 🟡 | v5.4 已实现 |
| D-11 | 面板拖拽分隔条 | 🟡 | v5.4 已实现 |
| D-12 | X 按钮保存关闭 | 🟡 | v5.4 已实现 |
| D-13 | Escape 关闭语义 | 🟡 | v5.4 已实现 |
| D-14 | Capsule tooltip 移除 | 🟡 | v5.4 已实现 |
| D-15 | 一次批量混合 prefix 录入 | ✅ | change `capture-mixed-prefix-input` |

### application-shell（7）

| 编号 | 需求 | 状态 | 证据 |
|---|---|---|---|
| G-1 | 移除左侧栏逻辑 | ⬜ | 设计已批 `docs/design/approved/shell-ui/` |
| G-2 | 无右侧边栏 | ⬜ | 设计已批同上 |
| G-3 | 单一顶栏（Chrome Bar） | ⬜ | 设计已批同上 |
| G-5 | 正文分栏（可选） | ⬜ | 设计已批同上 |
| B-2 | 空状态继续区分块 | 🟡 | 设计已批 `docs/design/approved/empty-state/` |
| B-4 | 内置示例文件释放 | 🟡 | `src-tauri/samples/` 已就位 |
| B-5 | 空状态设计规则 | 🟡 | 设计已批 `docs/design/approved/empty-state/` |
| G-6 | 顶栏职责与页签身份 | ✅ | change `reading-surface-refine`（归档 2026-11-06） |
| G-7 | 图标语义与全屏可用性 | ✅ | change `reading-surface-refine`（归档 2026-11-06） |

### navigation（5）

| 编号 | 需求 | 状态 | 证据 |
|---|---|---|---|
| B-1 | 启动面板（欢迎页） | 🟡 | 设计已批 `docs/design/approved/empty-state/` + `0-welcome.md` 就位 |
| B-3 | 统一文件面板（Cmd+P） | ⬜ | 无实现 |
| B-6 | 三视图切换 | ⬜ | 无实现 |
| B-7 | Ctrl+1~9 直开条目 | ⬜ | 无实现 |
| B-8 | 后退/前进历史导航 | ⬜ | 无实现 |
| N-1 | 本机最近文件自动发现 | ✅ | change `reading-surface-refine`（归档 2026-11-06） |
| N-2 | 阅读空间预览触发区与列表回顶 | ✅ | change `reading-surface-refine`（归档 2026-11-06） |
| N-3 | 本机标题与正文检索 | ✅ | change `reading-surface-refine`（归档 2026-11-06） |

### configuration（1）

| 编号 | 需求 | 状态 | 证据 |
|---|---|---|---|
| CF-1…CF-5 | 配置三层/原子写/快照回滚/校验/热应用 | ✅ | 既有实现（V3 沿用） |
| CF-6 | 阅读设置归属与设置窗自适应 | ✅ | change `reading-surface-refine`（归档 2026-11-06） |

### layout（12）

> change `layout-portal`（spec issue #170 / 收尾票 #186）：16/16 票已实现并合并（含收尾阶段的 #204–#209），已归档 `openspec/changes/archive/2026-11-05-layout-portal`。逐条证据见 [layout-portal-acceptance.md](./layout-portal-acceptance.md)。

| 编号 | 需求 | 状态 | 证据 |
|---|---|---|---|
| L-1 | 门户四块齐全，无「来源」 | ✅ | [e2e/portal.spec.ts](../../e2e/portal.spec.ts) |
| L-2 | 工作区 pane 递归树（N 栏/多页签/全屏/拖拽换位/四向落区/240px/持久化） | ✅ | [e2e/pane-tree.spec.ts](../../e2e/pane-tree.spec.ts)、[e2e/pane-drag.spec.ts](../../e2e/pane-drag.spec.ts) |
| L-3 | 阅读空间三态/双布局/三密度/卡片规格/滑杆下拉「设为默认」 | ✅ | [e2e/reading-rail.spec.ts](../../e2e/reading-rail.spec.ts)、[e2e/rail-cards.spec.ts](../../e2e/rail-cards.spec.ts) |
| L-4 | 网格下拉/bento 三型/缩略图优先/首卡选中/键盘行切换/动态编号 | ✅ | [e2e/grid-overview.spec.ts](../../e2e/grid-overview.spec.ts)、[e2e/grid-keyboard.spec.ts](../../e2e/grid-keyboard.spec.ts) |
| L-5 | 悬浮预览窗真内容/四边四角缩放/贴栏锚定/拖动保持/hover 动作区/双开关独立 | ✅ | [e2e/floating-preview.spec.ts](../../e2e/floating-preview.spec.ts) |
| L-6 | AI 唯一入口/小窗 285×260/停靠脱离/人话确认卡/撤销+快照/视图改写 | ✅ | [e2e/ai-forms.spec.ts](../../e2e/ai-forms.spec.ts) |
| L-7 | 设置左导航 10 区/跟随系统外观 | ✅ | [e2e/settings-scene.spec.ts](../../e2e/settings-scene.spec.ts)、[e2e/settings-content.spec.ts](../../e2e/settings-content.spec.ts) |
| L-8 | 扩展拖入即用/导出/AI 生成 | ✅ | [e2e/extensions-manage.spec.ts](../../e2e/extensions-manage.spec.ts) |
| L-9 | 图标 universe-icon/标签三级/类型色/无 emoji | ✅ | [e2e/icon-system.spec.ts](../../e2e/icon-system.spec.ts) |
| L-10 | 快捷键完整表可执行/tooltip 显示/`?` 总览 | ✅ | [e2e/shortcuts.spec.ts](../../e2e/shortcuts.spec.ts) |
| L-11 | 哲学 12 红线全过 | ✅ | [layout-portal-acceptance.md](./layout-portal-acceptance.md) §二 |
| L-12 | 生成物离线单文件（contentweave 部分） | ⬜ Out of Scope | 批准设计 §14 第 12 条 + §15；contentweave 单文件生成不属于本 change，显式记录不阻塞 |

### file-management（6）

| 编号 | 需求 | 状态 | 证据 |
|---|---|---|---|
| C-1 | 打开文件 | ✅ | change `file-format-support` / `pdf-viewer-text-selection` |
| C-2 | 拖拽打开 | 🟡 | V3 沿用 |
| C-3 | 自动保存 | 🟡 | V3 沿用（2s debounce） |
| C-4 | 新建文档 | ⬜ | — |
| C-5 | 全部文件视图 | ⬜ | 依赖 B-3 |
| C-6 | 视频预览播放器 | ✅ | change `video-preview-player` |

### editing（9）

| 编号 | 需求 | 状态 | 证据 |
|---|---|---|---|
| E-1 | 源码模式 | 🟡 | V3 沿用 |
| E-2 | GFM L2 编辑 | 🟡 | `src/editors/decorations/` 已实现 |
| E-3 | 保存文件与写入保护 | 🟡 | V3 沿用（原子写入） |
| E-4 | HTML 源码编辑 | ✅ | `@codemirror/lang-html` + `case "html"`；change `html-edit-loop`（归档 2026-11-04） |
| E-6 | 编辑内核与插入入口（块级装饰 / 斜杠菜单 / 智能输入） | ✅ | change `md-kernel-port` |
| E-7 | 编排层交互契约（块手柄 / 菜单栈 / 浮层裁剪 / 共享色板） | ✅ | change `md-orchestration`（归档 2026-11-03） |
| E-8 | 编辑态与预览态同貌（同一张纸 / 同一套排版 / 块级组合规则） | ✅ | change `editor-preview-parity`（归档 2026-11-02） |
| E-9 | 单元格工具条（已整体移除：无合并 / 无背景色） | ✅（移除） | change `editor-block-parity`（归档 2026-11-06；#140 实施移除） |
| E-10 | 编辑器大纲浮层（右上角入口 / 跳转 / 跳过代码块） | ✅ | change `editor-outline`（归档 2026-11-03） |
| E-7 修订 | 块菜单贴手柄居中、二级面板、hover 稳定性 | ✅ | change `editor-interaction-fixes`（归档 2026-11-03） |
| E-11 | 块菜单结构与图标体系 | ✅ | change `editor-block-parity`（归档 2026-11-06） |
| E-12 | 单元格富文本编辑 | ✅ | change `editor-block-parity`（归档 2026-11-06） |
| E-13 | 全角标点修正 | ✅ | `transactionFilter`（PR #121） |
| E-14 | 浮层定位优先级（不遮挡不越界 > 对齐 > 最近） | ✅ | PR #134 + `e2e/shortest-path.spec.ts` |
| E-15 | HTML 编辑闭环（iframe 预览 / 相对资源 / 编辑后可见） | ✅ | change `html-edit-loop`（归档 2026-11-04，PR #159） |
| E-16 | HTML 可视化编辑（点选 / 改字 / 拆块 / 保存零残留） | ✅ | change `html-visual-editing`（PR #168/#169/#188/#189）；ADR 0010 |
| E-17 | 块手柄召唤区域与滑入菜单 | ✅ | change `reading-surface-refine`（归档 2026-11-06） |
| E-18 | 正文选区胶囊 | ✅ | change `reading-surface-refine`（归档 2026-11-06） |
| E-19 | HTML 可视化编辑工具条（换标签 / 改样式 / 改属性） | ✅ | change `html-edit-toolbar`（归档 2026-11-07，PR #264） |
| E-20 | HTML 可视化编辑：拖拽移动节点 | ✅ | change `html-visual-move-capture`（归档 2026-11-07，PR #266） |
| E-21 | HTML 可视化编辑：区域截图 | ✅ | change `html-visual-move-capture`（归档 2026-11-07，PR #266） |
| E-22 | HTML 可视化编辑：工具条按节点类型分化 | ✅ | change `html-toolbar-by-node-type`（归档 2026-11-07，PR #269） |

### docs-governance（3）

| 编号 | 需求 | 状态 | 证据 |
|---|---|---|---|
| G-1 | 文档体系结构 | ✅ | change `docs-migration-governance` |
| G-2 | 引用与索引有效性门禁 | ✅ | 同上 |
| G-3 | 开发者上下文路由 | ✅ | 同上 |

### extensions（3，2026-11-03 新增）

| 编号 | 需求 | 状态 | 证据 |
|---|---|---|---|
| X-1 | 数据文件扩展点（snippets / templates） | ✅ | change `extension-points`（归档 2026-11-03）；`src-tauri/src/extensions.rs`、`src/lib/extensions/` |
| X-2 | 主题 token 覆盖（`theme.toml` 白名单） | ✅ | 同上；`src/lib/extensions/theme-tokens.ts` |
| X-3 | 核心能力开关（幂等 enable/disable） | ✅ | 同上；`src/lib/capabilities.ts`、`src/components/SettingsDialog.tsx` |

---

## 下一步建议（待开发 16 项）

按依赖顺序：**B-3（统一文件面板）是当前最大缺口**——它同时阻塞 D-6、C-5，且是"无侧栏"导航体系的枢纽。建议从 `/opsx-propose` 建立 `unified-file-panel` change 开始，实现后 D-6/C-5 一并归入。

## 未立项需求（🗒 已登记，尚未建 change）

> 这些需求散落在历史/零散文件中，尚未进入 `openspec/` 闭环。**新建需求先登记到这里，再 `/opsx-propose` 立项。**

### 展卷仪式系统（来源：`docs/阅读写作软件「展卷仪式」功能需求清单.md`，P1 差异化）

| 编号 | 需求 | 状态 | 对应阶段 |
|---|---|---|---|
| I-1 | 展卷动画（三档速度、光影配套、避坑约束） | 🗒 | P1 |
| I-2 | 收卷仪式（写作/阅读专属配套） | 🗒 | P1 |
| I-3 | 自动专注联动 | 🗒 | P1 |
| I-4 | 启动开屏前置仪式（底色/动画/封面/音效） | 🗒 | P1 |
| I-5 | 沉浸式听觉氛围模块 | 🗒 | P1 |
| I-6 | 个性化设置开关（全部可独立开关） | 🗒 | P1 |

> 注：`docs/MVP-需求跟踪表.md` 原模块 I（I-1~I-3）与此同源，现已随该表 superseded。

### 安全与缺陷修复（来源：`TODOS.md`，评审遗留，本质是 bug 修复而非新功能）

| 编号 | 需求 | 状态 | 优先级 |
|---|---|---|---|
| S-1 | HTML 预览 iframe 隔离加固（asset 协议 scope 收紧） | 🗒 | P0 |
| S-2 | inbox 日期参数路径穿越校验 | 🗒 | P0 |
| S-3 | 翻译端点 SSRF 防护接线 | 🗒 | P0 |
| S-4 | capability 缺窗口权限（关闭/拖拽/缩放被 ACL 拒绝） | 🗒 | P0 |
| S-5 | archive/delete IPC 参数缺失致静默失效 | 🗒 | P0 |
| S-6 | 批量提交后第 2+ 条无法编辑/归档/删除 | 🗒 | P1 |
| S-7 | media:// 编码双斜杠致视频预览 404 | 🗒 | P1 |
| S-8 | media 协议无 Range 请求整文件读入内存 | 🗒 | P1 |
| S-9 | read_file_base64 / register_media_path 无来源校验 | 🗒 | P1 |
| S-10 | OpenAI 翻译路径不可用 + key 未走 keyring | 🗒 | P1 |
| S-11 | highlight.ts 源码含字面 NUL 字节 | 🗒 | P1 |
| S-12 | 其余 P2/P3 项（死代码/DRY/防抖/性能/文件大小来源） | 🗒 | P2/P3 |

> 建议：S-1~S-5 这类 P0 安全项修复是"修复既有实现"，不需要建独立需求 change，但修复完成后应**登记实现状态**；如需走 OpenSpec 记录，按 `docs-governance` 域的变更流程补 change。

## 遗留散件去向（历史文件，勿当活文档）

| 文件 | 性质 | 状态 | 去向 |
|---|---|---|---|
| `docs/CORE-REQUIREMENTS-clairis.md` | 全量需求旧稿 | ✅ 已 superseded + redirect | → `docs/product/` + `openspec/specs/`，仅历史存根 |
| `docs/MVP-需求跟踪表.md` | 人工跟踪表 | ✅ 已 superseded + redirect | → 本表，仅历史对照 |
| `docs/capture-overlay-SPEC.md` | Capture Overlay v5.5 实施规格 | ⏳ 待处理 | → 应 superseded + redirect 到 `openspec/specs/capture/spec.md`（2026-09-02 起） |
| `docs/阅读写作软件「展卷仪式」功能需求清单.md` | P1 展卷仪式需求稿 | 🗒 待立项 | 需求已登记本节，建 change 后该文件可 superseded |
| `TODOS.md` | 评审遗留缺陷清单 | 🗒 活（缺陷清单） | 缺陷已登记本节；修复后逐项勾销 |

> 历史：本表取代 `docs/MVP-需求跟踪表.md`（已 superseded，仅作历史对照）。