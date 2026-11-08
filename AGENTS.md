# AGENTS.md

## 项目

Biaoyue（标月）— Tauri 2 + React 18 + TypeScript 桌面 Markdown 阅读/编辑器。前端 Vite + CodeMirror 6 + Zustand，Rust 后端在 `src-tauri/`。文档入口见 `docs/README.md`，架构现状见 `docs/architecture/overview.md`（中文）。旧名 Folio/MDWRT/Jianming（渐明）仍出现在脚本注释和文档中，是同一项目。

## 语言约定（中文优先）

Biaoyue 面向中文用户，维护者母语为中文。以下为**硬约定**，不是建议：

- **反馈与协作**：用户反馈、issue、PR 描述、commit message、评审意见默认中文。
- **文档**：设计文档、需求文档、架构文档、CHANGELOG 用中文 + 保留 markdown 格式。
- **用户可见文案**：UI 文案、提示、错误信息默认中文。
- **Agent 回复**：与用户对话用中文。
- **OpenSpec 产物**：proposal / spec / tasks 一律中文。
- **英文仅限**：代码标识符、变量名、API/字段名、i18n key、命令、日志输出、引用外部英文资料。

## 视觉输入（硬约定）

截图 / 图片一律先 `read` 直读：本会话模型支持图像输入，`read` 会把图作为附件返回，可直接读像素与文字。

- `look_at` 报「当前模型不支持图像输入」只代表**该工具自己的媒体管线**，不得据此断言模型无视觉能力（其工具说明本就写明：精确读图用 Read）。
- 需要结构化 / 像素级复核时用 `./scripts/cw-vision.sh describe|analyze`，原始输出贴票（`docs/agents/evidence-capture.md` §3.6）。
- 禁止在回复或票面写「当前模型无视觉输入」；任何「能力不存在」的结论必须先跑 10 秒探针（`read` 一张小图 / `cw-vision.sh doctor`）并附输出。

## 项目上下文路由

> 本文件是"地图"。各工具内容在各自的文件里，此处只标位置。

- **规范与变更（OpenSpec）**：功能规格真相源 `openspec/specs/`，进行中变更 `openspec/changes/`（活跃变更 = 正在实现的需求）；配置 `openspec/config.yaml`；`openspec list` 查看状态，`openspec view` 交互式 dashboard；需求×实现状态一览见 `docs/delivery/requirements-status.md`
- **变更收尾**：合并后本地工作区停留在 main（详见 `docs/agents/incident-merge-local-workspace.md`）
- **共享词汇与架构决策（Real Engineers）**：词汇表 `CONTEXT.md`；架构现状 `docs/architecture/overview.md`，架构决策 `docs/architecture/decisions/`
- **项目结构与模块地图（OmO init-deep）**：`.opencode/project-tree.md`；OmO 命令与技能在 `.opencode/`
- **架构/产品/设计文档**：`docs/`（索引 `docs/README.md`）：产品 `docs/product/`、批准设计 `docs/design/approved/`、探索 `docs/design/explorations/`、研究 `docs/research/`、交付 `docs/delivery/`、历史 `docs/archive/`；总纲由 `docs/README.md` + `docs/architecture/overview.md` 承担
- **设计系统（视觉数值唯一来源）**：`docs/design/system/spec.md`（图标/间距/字号/圆角/语义色/判据）、`docs/design/system/decisions.md`（append-only 部件决案台账）；单 feature 设计在 `docs/design/approved/`，只引用条款号不复制数值
- **知识检索（GBrain）**：agent 通过 MCP 工具 `search` / `query` / `get_page` / `code_def` / `code_refs`（共享 HTTP owner，`http://127.0.0.1:3131/mcp`）。PGLite 单写者下，同样功能的 CLI `gbrain search/query/status` 会报 `pglite_busy`；`gbrain sync` 例外，走委托可正常跑。**无常驻 autopilot**，索引刷新用 `/sync-gbrain`。配置 `~/.gbrain/config.json`。
- **需求基线与跟踪**：产品愿景/原则/范围 `docs/product/`，交付路线图 `docs/delivery/roadmap.md`，功能规格 `openspec/specs/`，需求×实现状态一览 `docs/delivery/requirements-status.md`（旧 `CORE-REQUIREMENTS-clairis.md`/`PLAN.md`/`MVP-需求跟踪表.md` 等已 superseded/归档，不作活入口）
- **软著资料准备**：`docs/delivery/softcopyright/`（台账/开发流程证据链规范/申请操作手册）

## Skill 路由（gstack）

请求命中以下场景时调用对应 skill：

- 产品想法/头脑风暴 → /office-hours；战略/范围 → /plan-ceo-review
- 架构评审 → /plan-eng-review；设计系统 → /design-consultation 或 /plan-design-review
- Bug/报错 → /investigate；站点行为 QA → /qa 或 /qa-only
- 代码评审/diff → /review；视觉打磨 → /design-review
- 发布/部署/PR → /ship 或 /land-and-deploy
- 保存/恢复上下文 → /context-save / /context-restore
- 写 backlog-ready spec → /spec

## 命令

- `npm run dev` — Vite dev server，端口固定 1420（strictPort）。
- `npm run tauri dev` — 完整桌面应用（真实 Rust 后端）。UI 验收必须用它。
- `npm test` — vitest run（jsdom）。**只收集 `src/__tests__/**/*.test.{ts,tsx}`**——测试写在源码旁不会被执行。
- 单个测试：`npx vitest run src/__tests__/editorStore.test.ts`。
- `npx tsc --noEmit` — 类型检查（CI 跑这条）。没有 `npm run lint`，ESLint 用 `npx eslint src/`。
- `bash scripts/verify.sh` — 交付前完整验证：tsc → eslint → vitest → CSS manifest → cargo check → 两套 Playwright。全绿才交付。
- `cargo test --manifest-path src-tauri/Cargo.toml` — Rust 单测。

## E2E（Playwright）

- 用 **Playwright 自带 Chromium**（首次运行需 `npx playwright install chromium`；不用 `channel: "chrome"`——系统 Chrome 会 spawn GoogleUpdater 孤儿进程导致 worker teardown 偶发 300s 强杀）；webServer 自动起 dev server 并复用已运行的实例。
- 两套配置：
  - `npx playwright test` — `e2e/*.spec.ts`，浏览器层 UI 测试。
  - `npx playwright test --config=playwright.tauri.config.ts` — `e2e/tauri/`，通过 `addInitScript` 注入 `e2e/mocks/tauri-mock.js` 模拟 Tauri IPC。
- mock 桥：app 暴露 `window.__biaoyue_store__`（Zustand store），mock 提供 `__biaoyue_openFile__(path, content, title)`。新 e2e 用这两个桥驱动，不依赖真实文件系统。
- CI 不跑 E2E（只跑 tsc + `vitest --coverage` + css-manifest-check，macos-latest）。coverage 有阈值（lines/statements 30、branches/functions 20），删测试或不覆盖新代码会挂 CI。

## 仓库特有约束

- **CSS manifest 检查**：`src/editors/decorations/` 中声明的每个 `cm-*` class 必须在 `src/styles/` 有对应 CSS 规则，否则 pre-commit / CI / verify.sh 失败。新增 decoration 类名 = 同时新增 CSS 定义。
- **pre-commit**（husky + lint-staged）：ts/tsx 走 prettier + `eslint --fix --quiet`，css 走 prettier，rs 走 rustfmt，外加 CSS manifest 检查。
- **模式切换不 remount**：preview/edit/source 用 CSS display 切换，保留 CM6 的 undo/选区/编辑状态。不要改成条件渲染重建 EditorView。
- **三个 Zustand store**：`stores/index.ts`（`useStore`，tabs/文件）、`stores/editorStore.ts`（config/editorMode，注释标记 @deprecated 待合并）与 `stores/captureOverlay.ts`（快速捕获浮层状态，由 `stores/index.ts` 再导出）。EditorView 实例存在 `src/editors/editorRef.ts` 的模块级 Map（按 panelId），不进 store；store 只存纯文本。
- 大文件守卫（large file guard）：500KB 强制 source 的守卫仅存在于旧 `useFile` 流程，当前页签打开流程未接入，实际不生效。
- API key 只存 OS keyring（`get/set/delete_api_key` 命令），不要写进 config 文件。

## UI 测试

- 涉及交互、布局、溢出的 UI 修复/功能，交付前必须用 headless 浏览器跑真实 UI。
- 推荐：Playwright（`npx playwright test`），不用 `browser_press` 模拟。
- 测试范围：hover、overflow、click outside、拖拽、focus、Alt-Tab 等真实浏览器事件。
- 只验证 build + test 通过不等于功能可用——视觉层 bug 只在真实渲染时显现。
- **每次修复后，真实跑一次 `npm run tauri dev` + 手动点一遍关键路径。** `npm run test` 和 `npm run build` 不验收 UI 行为。
- **测试结果用功能说明性语言汇报**：描述"能做什么/不能做什么"，不出现变量名、状态码、JSON。例：✓ 输入"-test"自动识别为待办 → 错误：禁止写 `prefix='-', content='test'`。

## 实现

- 先读代码再改，grep 全部调用方再动手。
- 最小 diff 优先。删除 > 新增。
- 实根因修复，不在每个调用点打补丁。
- 业务边界输入必须校验。
- **需求/功能变更必须先走 OpenSpec 闭环**（硬约束）：新增或变更需求 → `/opsx-propose` 建 change（proposal+design+tasks）；实现 → `/opsx-apply` 勾任务；完成后 → `/opsx-archive` 归档并更新 `docs/delivery/requirements-status.md`。**禁止**绕过 change 直接改 `openspec/specs/` 主规格，也禁止不归档就把需求标为已完成。

## UI 修复后必做检查清单

每次 UI 修复完成后，逐项确认（不跳过）：

1. **编译 ≠ 可用** — `cargo build` / `npx tsc` / `npm run build` 只验证编译，不验证行为。必须跑 `npm run tauri dev` + 手动点关键路径。
2. **数据流走查** — 修改后追踪完整路径：用户动作 → 事件处理 → state 变化 → 序列化/存储 → 渲染。每一步都验证。
3. **serde 兼容性** — 涉及 Rust ↔ TypeScript 数据传递时，对比 Rust `struct` 字段名与 TypeScript `interface` 字段名，确认序列化格式一致（`snake_case` vs `camelCase`）。
4. **CSS 层叠上下文** — `backdrop-blur`、`transform`、`z-index`、`opacity < 1` 会创建新层叠上下文，导致 `position: fixed/absolute` 的子元素被裁剪。`createPortal` 可逃逸。
5. **边界值走查** — 检查 0、空字符串、null、undefined 等 falsy 值在条件判断中的表现。特别是 `=== 0` 与 `> 0` 的区别。
6. **事件冒泡/默认行为** — 修改键盘快捷键时，确认是否覆盖了元素默认行为（如 textarea Enter 换行）。避免把不该拦截的键拦截了。
7. **拖拽阈值** — 拖拽和点击共用 mousedown/mouseup 时，必须设 3-5px 阈值区分意图，防止微小移动误触发拖拽。
8. **修复后自测** — 修完一个 bug 后，手动测试**该 bug 的完整复现路径**，而不是只看编译通过。

## 设计

- 不与用户确认不动文件、不动跟踪表。
- 设计文档中文 + 保留 markdown 格式。
- 评审先 /codex N 轮碰撞。
- 视觉数值只在 `docs/design/system/spec.md` 定义一次；feature 稿、票面、e2e 断言引用条款号或 token 名，不复制像素值。
- 实现可见 UI 前，票面须有第七字段 `**视觉锚点**:`，值为 `design-system:§N` 或 `ledger:<部件>`（多条用 `;` 分隔，锚点内不写像素值）。它与 change 的 conformance 验收锚点（`A-<n>.<m>`）是**两个东西**：前者指规范条款，后者指本次验收断言。spec 无对应条款 = 规范缺口，先补条款再写码。**已知弱点**：C9 机检随第二个 change 落地，在此之前由 code-review 执行。
- 单点视觉裁决落 `docs/design/system/decisions.md` 一行（append-only）；刻度级修订走 spec supersede。

## GBrain Configuration（由 /setup-gbrain 配置）

- Mode: local-shared-http（单一 owner）
- Engine: pglite（单写者）
- Config file: ~/.gbrain/config.json（mode 0600）
- Setup date: 2026-08-02
- MCP registered: yes —— 共享 HTTP owner（launchd `com.gbrain.serve` → `gbrain serve --http`，`http://127.0.0.1:3131/mcp`）；opencode 与 pi 均以 HTTP + bearer token 连接，不再每会话各起一个 stdio serve
- Artifacts sync: off（Step 7 选择"不需要"；GitHub 当前不可达）
- Current repo policy: read-write（github.com/lqtdys/clairis）
- transcript_ingest_mode: incremental
- Last cycle: 2026-11-06 增量 sync（`gstack-code-clairis-0cb0a733`，commit `fe5d86ca`，421 页，未嵌入 0）。**无常驻 autopilot**（`launchctl list` 里没有 `com.gbrain.autopilot`；此前文档写"已常驻"是错的）。
- PGLite 单写者约束（重要）：brain 由 launchd `com.gbrain.serve` 独占持有。
  - `gbrain sync --source <id> --no-pull` **可用**：CLI 会委托给运行中的 owner 执行。
  - `gbrain search/get/query/status/sources ...` 等直接开库的命令会报 `pglite_busy`。读操作请走 MCP 工具（`search` / `query` / `get_page` / `sources_status`），或先 `gbrain mcp expose --remove` 停共享服务再跑 CLI（停服务期间 agent 的 MCP 不可用）。
  - autopilot 与共享 serve 互斥：两者都要独占 PGLite，不要同时开。
- 客户端 token 有效期 90 天（TTL 上限 `7776000`s，无法设更长）。到期后 agent 的 gbrain 工具会返回 `invalid_token`，看起来像"又锁死了"，其实只需轮换：
  1. `gbrain connect http://127.0.0.1:3131/mcp --harness opencode --credentials-file ~/.gbrain/private/local-agents.json --install --fresh-token`
  2. 读出 `~/.config/opencode/opencode.json` 里 `mcp.gbrain.headers.Authorization` 的 token，然后 `pi mcp add gbrain --url http://127.0.0.1:3131/mcp --header "Authorization=Bearer <token>"`
  3. `pi mcp list` 应显示 `gbrain: connected`。注意 `~/.gbrain/private/local-agents.json` 里的 `expires_at` 是首次签发时的过期时间，不会随轮换更新，不要拿它判断有效期。

## GBrain Search Guidance（configured by /sync-gbrain）
<!-- gstack-gbrain-search-guidance:start -->

GBrain 已在本机配置并同步。当问题偏语义、或尚不确定确切标识符时，agent 应优先用 `gbrain` 而非 Grep。

**本 worktree 已 pin 到 worktree 级代码源**（仓库根 `.gbrain-source` 文件，kubectl 风格上下文）：`gbrain code-def/code-refs/code-callers/code-callees/search/query` 在该 worktree 任意位置默认路由到该源，无需 `--source` 标志。同仓库的 Conductor 兄弟 worktree 各自有独立 pin 与独立索引页，语义结果与当前磁盘代码一致。

调用图查询（`code-callers`/`code-callees`）需要图已构建——若返回 `count: 0` 先跑 `/sync-gbrain --dream`（或 `--full`）。仅当该源的 gbrain schema pack 能提取代码符号时有效；非 code-aware pack 上 `--dream` 会完成但图保持为空并报 WARN。`code-def`/`code-refs` 同样依赖符号提取。

两个可检索语料库：
- 本 worktree 代码（经 `.gbrain-source` 自动 pin）。
- `~/.gstack/` 精选记忆（经现有 federation 管线注册为 `gstack-brain-<user>` 源）。

优先用 gbrain 的场景：
- "X 在哪里处理？" / 语义意图、尚无确切字符串：`gbrain search "<词>"` 或 `gbrain query "<问题>"`
- "符号 Y 定义在哪？" / 符号级代码问题：`gbrain code-def <符号>` 或 `gbrain code-refs <符号>`
- "什么调用了 Y？" / "Y 依赖什么？"：`gbrain code-callers <符号>` / `gbrain code-callees <符号>`
- "上次我们决定了什么？" / 过往计划、retro、learnings：`gbrain search "<词>" --source gstack-brain-<user>`

已知确切字符串、正则、多行、glob 时仍用 Grep。代码有意义变更后跑 `/sync-gbrain` 刷新（sync 走委托，不会撞锁）。**本机无常驻 autopilot**；要装 `gbrain autopilot --install` 必须先停掉共享 HTTP serve —— PGLite 不允许两个 owner。

安全注意：`gbrain autopilot` 运行期间不要跑 `/sync-gbrain`（orchestrator 检测到活动 autopilot 会拒绝破坏性源操作，避免竞态 #1734）。注册用户仓库优先 `gbrain sources add --path <dir>`（不带 `--url`：URL 管理源可能自动 re-clone，其同步需要显式 `--allow-reclone` 选入）。

<!-- gstack-gbrain-search-guidance:end -->

## Agent skills

### Issue tracker

本仓库的 issue 与 PRD 存放于 GitHub Issues，用 `gh` CLI 操作。详见 `docs/agents/issue-tracker.md`。

### Triage labels

使用默认标签词汇：`needs-triage` / `needs-info` / `ready-for-agent` / `ready-for-human` / `wontfix`。详见 `docs/agents/triage-labels.md`。

### Domain docs

单上下文（single-context）——词汇表 `CONTEXT.md` 在仓库根，架构决策 ADR 在 `docs/architecture/decisions/`。详见 `docs/agents/domain.md`。

### Change workflow（变更流程 gate）

启动新 change、接手进行中 change、拆票、提交/PR、收尾与归档，一律经 `.opencode/skills/change-workflow/`（G0-G4 五 gate + fix-first 自愈回路）。拆票/commit/闭环规范见 `docs/agents/task-tracking.md`（1 task = 1 ticket，1 issue = 1 PR）；看板入列 API 见 `docs/agents/project-board.md`。缺陷流程见 `docs/agents/defect-workflow.md`。

**跨 change 自动接力（维护者 2026-11-01 裁定，覆盖 change-workflow 的「跨 change 停点」）**：G4 收口后直接盘点并启动下一张可开工票 / 下一 change，不等人工确认；`risk-medium` PR 在 CI 全绿后由执行 agent 直接 `gh pr merge --squash`。仅两类仍需人工：`risk-high` 合并前评审、不可逆/破坏性操作。


> 配置：`.change-workflow.conf`（看板 ID / 标签 / 门禁命令 / 目录约定）

### 更新 change-workflow 工具包

```bash
# 检查是否有新版本（不落盘）
./scripts/cw-update.sh --check

# 执行更新（有冲突会写 .new 旁路文件，退 1 是正常语义）
./scripts/cw-update.sh

# 快捷方式（如已安装 Makefile）
make cw-update
```
