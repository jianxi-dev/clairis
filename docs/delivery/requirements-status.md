---
title: 需求实现状态总览
type: delivery
status: accepted
last_updated: 2026-11-02
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

## 总览统计（截至 2026-11-02）

- 规格：8 域 / 54 requirement（`openspec validate` 通过）
- ✅ 经 openspec 归档实现：12
- 🟡 已实现/设计完成（未走 openspec 变更）：24
- ⬜ 待开发：16
- 🗒 未立项（遗留散件登记）：约 16（展卷仪式 8 模块 + TODOS 安全/功能项）

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

### navigation（5）

| 编号 | 需求 | 状态 | 证据 |
|---|---|---|---|
| B-1 | 启动面板（欢迎页） | 🟡 | 设计已批 `docs/design/approved/empty-state/` + `0-welcome.md` 就位 |
| B-3 | 统一文件面板（Cmd+P） | ⬜ | 无实现 |
| B-6 | 三视图切换 | ⬜ | 无实现 |
| B-7 | Ctrl+1~9 直开条目 | ⬜ | 无实现 |
| B-8 | 后退/前进历史导航 | ⬜ | 无实现 |

### file-management（6）

| 编号 | 需求 | 状态 | 证据 |
|---|---|---|---|
| C-1 | 打开文件 | ✅ | change `file-format-support` / `pdf-viewer-text-selection` |
| C-2 | 拖拽打开 | 🟡 | V3 沿用 |
| C-3 | 自动保存 | 🟡 | V3 沿用（2s debounce） |
| C-4 | 新建文档 | ⬜ | — |
| C-5 | 全部文件视图 | ⬜ | 依赖 B-3 |
| C-6 | 视频预览播放器 | ✅ | change `video-preview-player` |

### editing（5）

| 编号 | 需求 | 状态 | 证据 |
|---|---|---|---|
| E-1 | 源码模式 | 🟡 | V3 沿用 |
| E-2 | GFM L2 编辑 | 🟡 | `src/editors/decorations/` 已实现 |
| E-3 | 保存文件与写入保护 | 🟡 | V3 沿用（原子写入） |
| E-4 | HTML 源码编辑 | 🟡 | V3 沿用 |
| E-6 | 编辑内核与插入入口（块级装饰 / 斜杠菜单 / 智能输入） | ✅ | change `md-kernel-port` |

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