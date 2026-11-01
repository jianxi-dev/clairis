# CONTEXT.md — 共享词汇与工程约定（Real Engineers）

> 本文件是唯一词汇来源。工程执行细则见 `AGENTS.md`，架构现状见 `docs/architecture/overview.md`、决策见 `docs/architecture/decisions/`，此处不重复。

## 一、Ubiquitous Language（统一词汇）

| 术语 | 含义 | 备注 |
|------|------|------|
| **Biaoyue / 标月** | 产品名。旧名 Folio / MDWRT / Jianming（渐明）同源，老文档/脚本中出现时指同一项目 | Bundle ID 方案见 `docs/delivery/biaoyue-App-Bundle-ID-标准化方案与注册运维手册.md` |
| **panel / panelId** | 编辑器面板实例标识。`editorRef.ts` 模块级 Map 的 key | EditorView 按 panelId 存取 |
| **模式（mode）** | preview / edit / source 三态。CSS display 切换，**不 remount** | 见架构决策 #2 |
| **decoration** | CM6 装饰插件，`src/editors/decorations/`。类名前缀 `cm-*` | 每个类名必须在 `src/styles/` 有对应规则（CSS manifest 校验） |
| **large file guard** | 500KB 强制 source 的历史守卫，仅存在于旧 `useFile` 流程 | 当前页签打开流程未接入，实际不生效 |
| **CSS manifest 检查** | pre-commit/CI/verify.sh 中的 decoration 类名 ↔ CSS 规则一致性校验 | 挂了这个 = 漏写 CSS |
| **mock 桥** | e2e 的 `window.__biaoyue_store__` + `__biaoyue_openFile__(path, content, title)` | 新 e2e 必须用它，不依赖真实文件系统 |
| **capture overlay** | 快速捕获浮层，`stores/captureOverlay.ts` | 需求见 `docs/capture-overlay-SPEC.md` |
| **双渲染管线** | 阅读管线（`src/renderers/`，marked→DOMPurify）与编辑管线（CM6）分离 | 架构决策 #1 |
| **keyring** | OS 钥匙串。API key 唯一合法存储位置（`get/set/delete_api_key` 命令） | 禁止写入 config 文件 |
| **双 store** | `stores/index.ts`（tabs/文件）+ `stores/editorStore.ts`（config/mode，@deprecated 待合并） | store 只存纯文本，不存编辑器对象 |
| **Doctrine** | 产品铁律 D1–D10 + 「不为谁做」五条，见 `docs/product/principles.md` | 任何设计/规格/变更冲突时须引用 D# 豁免 |
| **可塑层（malleability）** | 一切可变状态皆文本：配置三层 + 视图规格 + 扩展包（SKILL.md 式） | 产品铁律 D6 |
| **四入口** | AI 交互的四个入口：顶栏星芒小窗 ⇄ 嵌入窗格、⌘K 快捷浮层、命令面板 AI 区、选区动作 | 共享同一 agent 后端与确认密度 |
| **生成物** | contentweave 生成的 `.html`，源 `.md` 的编译产物，只读查看 | 源 md 唯一事实源，保存即重渲染（ADR 0007） |
| **快照** | 配置/视图/布局写前留档，保留最近 10 份，可任意恢复 | 产品铁律 D7/D8（ADR 0006） |
| **SKILL.md** | 约定目录下的系统心智地图（配置文件地图 + 改后验证规约） | AI 读取的配置地图，见 `$APPCONFIG/skills/biaoyue/SKILL.md` |
| **阅读空间** | 左侧竖排栏，三态（折叠 / 悬停浮层不挤压 / 钉住），双布局三密度 | 取代旧「无侧栏」（ADR 0009） |
| **网格概览** | 4 列 bento 批量浏览视图，缩略图优先，下拉控件，动态编号直开 | ⌘⇧\ 打开，见布局规格 §5 |
| **pane 树** | 工作区递归分栏树（`{dir, ratio, children}` / leaf 多页签），N 栏可分可换位 | 布局持久化，见布局规格 §3 |
| **视图规格** | 阅读空间/网格/预览窗的文本化配置（`$APPCONFIG/user/views/*.json`），AI 可改 | 产品铁律 D6，见布局规格 §13 |

## 二、架构决策记录（ADR 摘要）

论证全文：架构现状 `docs/architecture/overview.md`，ADR 全文 `docs/architecture/decisions/`。

| # | 决策 | 理由 | 论证 |
|---|------|------|------|
| 1 | 阅读/编辑分离（双渲染管线） | 阅读不受编辑器限制，可极致排版 | [ADR 0001](./docs/architecture/decisions/0001-separate-rendering-pipelines.md) |
| 2 | 模式切换用 CSS display 非 remount | 保留 CM6 undo/选区/编辑状态 | [ADR 0002](./docs/architecture/decisions/0002-mode-switch-css-display-no-remount.md) |
| 3 | store→CM6 同步 debounce 300ms | 避免每 keystroke 同步的性能开销 | [ADR 0003](./docs/architecture/decisions/0003-store-debounce-300ms.md) |
| 4 | store 存纯文本，不存编辑器对象 | 序列化/跨页签/恢复简单 | [ADR 0004](./docs/architecture/decisions/0004-store-plain-text-not-editor-objects.md) |
| 5 | API key 只存 OS keyring | 密钥不进配置文件 | [ADR 0005](./docs/architecture/decisions/0005-api-key-os-keyring.md) |
| 6 | 配置三层与快照回滚 | defaults/user/state 分离 + 原子写 + 10 份快照 + 校验回滚 | [ADR 0006](./docs/architecture/decisions/0006-config-three-layers-snapshots.md) |
| 7 | 生成物=编译产物，源 md 唯一事实源 | 保存即重渲染、生成物只读 | [ADR 0007](./docs/architecture/decisions/0007-generated-artifact-is-compiled-output.md) |
| 8 | AI 入口分期与语音第二输入源 | 唯一入口、小窗⇄嵌入、语音三件套 | [ADR 0008](./docs/architecture/decisions/0008-ai-entry-phasing-voice.md) |
| 9 | 可折叠阅读空间取代无侧栏 | 三态栏（折叠/浮层/钉住）取代旧「无侧栏」 | [ADR 0009](./docs/architecture/decisions/0009-collapsible-reading-rail-supersedes-no-sidebar.md) |

新增架构决策：先在 `docs/architecture/decisions/` 写 ADR，再在此登记一行摘要。

## 三、工程约定（指向而非复制）

- 执行细则（命令/E2E/UI 测试/检查清单）→ `AGENTS.md`
- 项目结构与模块地图 → `.opencode/project-tree.md`
- 规范与变更 → `openspec/specs/`（功能规格真相源）与 `openspec/changes/`（进行中变更）；`openspec list` 查看状态
- 需求基线与跟踪 → 产品愿景/原则/范围 `docs/product/`，交付路线图 `docs/delivery/roadmap.md`，功能规格 `openspec/specs/`
- 文档索引 → `docs/README.md`（分类导航）；治理规范 `docs/GOVERNANCE.md`
- 文档语言：中文优先（反馈/issue/PR/commit/设计文档/CHANGELOG 默认中文；英文仅限代码标识符、变量名、API/字段名、i18n key、命令、日志输出、引用外部英文资料）；设计评审先 /codex N 轮碰撞
