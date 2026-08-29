# CONTEXT.md — 共享词汇与工程约定（Real Engineers）

> 本文件是唯一词汇来源。工程执行细则见 `AGENTS.md`，架构现状见 `docs/architecture/overview.md`、决策见 `docs/architecture/decisions/`，此处不重复。

## 一、Ubiquitous Language（统一词汇）

| 术语 | 含义 | 备注 |
|------|------|------|
| **Clairis / 渐晰** | 产品名。旧名 Folio / MDWRT 同源，老文档/脚本中出现时指同一项目 | Bundle ID 方案见 `docs/delivery/渐晰（Clairis）App Bundle ID 标准化方案与注册运维手册.md` |
| **panel / panelId** | 编辑器面板实例标识。`editorRef.ts` 模块级 Map 的 key | EditorView 按 panelId 存取 |
| **模式（mode）** | preview / edit / source 三态。CSS display 切换，**不 remount** | 见架构决策 #2 |
| **decoration** | CM6 装饰插件，`src/editors/decorations/`。类名前缀 `cm-*` | 每个类名必须在 `src/styles/` 有对应规则（CSS manifest 校验） |
| **large file guard** | 文件 >500KB 自动关闭 decorations 的保护 | 不可绕过 |
| **CSS manifest 检查** | pre-commit/CI/verify.sh 中的 decoration 类名 ↔ CSS 规则一致性校验 | 挂了这个 = 漏写 CSS |
| **mock 桥** | e2e 的 `window.__clairis_store__` + `__clairis_openFile__(path, content, title)` | 新 e2e 必须用它，不依赖真实文件系统 |
| **capture overlay** | 快速捕获浮层，`stores/captureOverlay.ts` | 需求见 `docs/capture-overlay-SPEC.md` |
| **双渲染管线** | 阅读管线（`src/renderers/`，marked→DOMPurify）与编辑管线（CM6）分离 | 架构决策 #1 |
| **keyring** | OS 钥匙串。API key 唯一合法存储位置（`get/set/delete_api_key` 命令） | 禁止写入 config 文件 |
| **双 store** | `stores/index.ts`（tabs/文件）+ `stores/editorStore.ts`（config/mode，@deprecated 待合并） | store 只存纯文本，不存编辑器对象 |

## 二、架构决策记录（ADR 摘要）

论证全文：架构现状 `docs/architecture/overview.md`，ADR 全文 `docs/architecture/decisions/`。

| # | 决策 | 理由 | 论证 |
|---|------|------|------|
| 1 | 阅读/编辑分离（双渲染管线） | 阅读不受编辑器限制，可极致排版 | [ADR 0001](./docs/architecture/decisions/0001-separate-rendering-pipelines.md) |
| 2 | 模式切换用 CSS display 非 remount | 保留 CM6 undo/选区/编辑状态 | [ADR 0002](./docs/architecture/decisions/0002-mode-switch-css-display-no-remount.md) |
| 3 | store→CM6 同步 debounce 300ms | 避免每 keystroke 同步的性能开销 | [ADR 0003](./docs/architecture/decisions/0003-store-debounce-300ms.md) |
| 4 | store 存纯文本，不存编辑器对象 | 序列化/跨页签/恢复简单 | [ADR 0004](./docs/architecture/decisions/0004-store-plain-text-not-editor-objects.md) |
| 5 | API key 只存 OS keyring | 密钥不进配置文件 | [ADR 0005](./docs/architecture/decisions/0005-api-key-os-keyring.md) |

新增架构决策：先在 `docs/architecture/decisions/` 写 ADR，再在此登记一行摘要。

## 三、工程约定（指向而非复制）

- 执行细则（命令/E2E/UI 测试/检查清单）→ `AGENTS.md`
- 项目结构与模块地图 → `.opencode/project-tree.md`
- 规范与变更 → `openspec/specs/`（功能规格真相源）与 `openspec/changes/`（进行中变更）；`openspec list` 查看状态
- 需求基线与跟踪 → 产品愿景/原则/范围 `docs/product/`，交付路线图 `docs/delivery/roadmap.md`，功能规格 `openspec/specs/`
- 文档索引 → `docs/README.md`（分类导航）；治理规范 `docs/GOVERNANCE.md`
- 文档语言：中文优先（反馈/issue/PR/commit/设计文档/CHANGELOG 默认中文；英文仅限代码标识符、变量名、API/字段名、i18n key、命令、日志输出、引用外部英文资料）；设计评审先 /codex N 轮碰撞
