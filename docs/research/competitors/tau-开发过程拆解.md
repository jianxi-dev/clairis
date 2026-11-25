---
title: "Tau 开发过程拆解：从定位到交付的七段流水线"
type: research
source_of_truth: historical
status: draft
last_updated: 2026-11-24
---

# Tau 开发过程拆解 —— 一个 207 个版本的桌面产品是怎么被造出来的

> 2026-11-24。对照对象：Tau（`/Users/mason/ToHighs/AI-doc/竞品分析学习/editor-master`，v0.66.2）。姊妹篇：[tau-界面品质与架构学习.md](./tau-界面品质与架构学习.md)（界面/图标结论）。
> 本文只研究**过程**：怎么建立、怎么设计、怎么交付、怎么防 bug、怎么保证 UI 统一。每条都带 tau 侧路径证据与本仓（`/Users/mason/ToHighs/clairis`）对照。

## 0. 三个定性结论

1. **Tau 的开发过程是一条七段流水线，每段都有"产物 + 判据 + 责任人"**：定位（PRODUCT/preferences）→ 原型（mockup）→ 需求（任务文档）→ 实现（声明式协议）→ 交付（版本公告）→ 质量（本地门禁）→ 防腐化（专项治理 + 规则沉淀）。**没有 CI**（`.github/` 只有 `assets/cover.jpg`），质量完全靠 pre-commit + 本地脚本 + 用户视觉验收。
2. **UI 高品质来自"三段同源"**：mockup 阶段就写最终 CSS 变量名（`var(--ink-2)`、`var(--surface)`、`var(--r-sm)`、`var(--shadow-float)`，见 `apps/desktop/mockups/articles/list-view.html:8-40`），实现阶段消费同一套 `--tau-*`，样板间阶段再拿真组件对照。**同一个视觉事实只有一处取值，三段只是引用方式不同。**
3. **防 bug 不靠"小心"，靠三类硬机制**：①架构级守护测试（`check-*boundaries.mjs` + `*.parity.test.ts`，提交钩子必跑）；②真实入口回归（容量 12 组合、硬杀 4 切点 ×20 次、长稳 60 分钟，见 `docs/guides/dev-content-verification.md`）；③**专项治理闭环**（发现漂移 → 多子代理并行扫描 → 量化 → 分批修复 → 规则写进 `docs/decisions.md` → 变成机检栅栏）。

---

## 1. 全流程地图


| 阶段 | 产物（tau 实物） | 判据 / 门禁 | 谁验收 |
| --- | --- | --- | --- |
| 定位 | `PRODUCT.md`（定位/气质/避免方向/设计原则/无障碍）、`docs/preferences.md`（81 行审美与工程偏好） | 评审对照 preferences；「讨厌什么」写得比「喜欢什么」更具体 | 作者 |
| 原型 | `apps/desktop/mockups/<feature>/*.html`（**88 个目录 / 183 个 HTML**）+ `apps/mobile/mockups`（28 个） | `.claude/launch.json` 里 **40+ 个端口配置**逐个开图对着看；方向对比后定稿 | 用户 |
| 需求 | `docs/tasks/<名>/README.md`（自含：状态/目标/需求/方案/决策/进度+验证），90 天期限 | 四步协作法：先调研对齐 → 可评审模块方案 → 复杂度留给真实业务 → 伪代码+流程图 | 用户评审 |
| 实现 | 四个声明式协议（`definePage`/`defineTheme`/`defineAssistView`/`defineDatabaseExtension`），文件即注册 | 分层归属规则；组件进 `ui/` 必须带测试 + 样板间档案 | 作者 |
| 交付 | `apps/desktop/release-notes/*.md` — **207 个版本文件**（0.0.1 → 0.66.2） | 发布前校验公告存在且非空，缺失拒绝发布；发布后不许改 | 用户 |
| 质量 | `scripts/` 5 个边界脚本 + `pnpm lint/format/check:*` + 169 行 `AGENTS.md` 测试规则 | pre-commit 跑 lint-staged + 3 个边界脚本；`test:quality` 必须通过 | 机器 |
| 防腐化 | `docs/notes/` **73 份**日期文档（调研/验证/压测/审计）+ `docs/decisions.md` 规则 | 漂移即修；规则沉淀后进 `decisions.md`，再加机检 | 作者 |


---

## 2. 定位：先写"讨厌什么"

`docs/preferences.md`（81 行）是整套过程的判据库，写法极克制——**只写结论，不写日期、原话与设计稿出处**（过程留在任务文档）。结构：

- **复杂需求的协作方式**：四步（调研对齐 → 可评审模块方案 → 复杂度留给真实业务 → 伪代码与流程图）。并明确分工：「用户主要评审目标、架构边界和系统行为，具体算法与实现细节由 Codex 选择并验证」。
- **设计语言**：总纲「有个人特色的暖纸设计语言」，然后 **负面清单比正面清单多**：「讨厌『一坨 antd』的通用后台脸、工程 README 脸和『贴上去的板子』；特色从排版、层次与组织里来，不从加颜色里来」。
- **层次与配色**：拒绝同色相糊成一坨的米黄与死档；分组靠大平面/留白/投影不靠 border；「同一屏多张碎卡片露底、每格一卡的『瓷砖』都是负样本」。
- **交互**：「轻与稳」——悬停/激活只做底色/描边/文字色变化，**至多加深一档投影，不上浮、不放大、不改变尺寸与布局**；悬浮层要么常驻不透明要么完全收起，不做半透明叠在内容上。
- **架构与工程文化**：声明式 API 贯穿一切；文件即注册单元；pure core + React shell；**渐进式升级而非大爆炸，升级进度必须可感知**；「喜欢文档沉淀 + AGENTS.md 防腐化规则的工程文化」。
- **命名与代码**：单一拼写事实、一个概念一个动词、持久化 key 是对外 API。

**可迁移**：这是一份「评审时能直接引用的判据表」，不是设计宣言。本仓 `docs/design/system/spec.md` 管的是**数值**（间距/字号/圆角），缺的正是这一层**审美与工程偏好**的文字化——`spec.md` §7.3 的「审美判据七问」是雏形，但只有 7 个问题，没有「讨厌什么」的具体负样本。

## 3. 原型：mockup 与 token 同源，且一图一端口

这是 Tau 在 UI 上"看着有品质"的最直接原因，机制有三：

1. **mockup 直接写最终变量名**。`apps/desktop/mockups/articles/list-view.html:8-40` 里是 `var(--accent)`、`var(--ink-2)`、`var(--ink-3)`、`var(--surface)`、`var(--hover)`、`var(--line-1)`、`var(--shadow-float)`、`var(--r-sm)`，`<html data-theme="cream">`，图标从 `https://unpkg.com/lucide@0.469.0` 加载。**原型不是"画个大概"，而是"用最终颜色系统画"**——所以定稿后搬进组件是逐值搬运，不是重新调色。
2. **一图一端口，逐个开**。`.claude/launch.json` 里 40+ 个 `python3 -m http.server` 配置，每个 mockup 一个端口（8793 db-toolbar / 8794 publish / 8795 settings / 8796 calendar / 8800 chat / 8813 markdown-window …），外加 `showcase` 6199 与 `mockups` 6211 总目录。作者是**一个个打开、并排看、再定稿**的。
3. **方向对比 → 定稿 → 取值回填**。`design-system.md` 写着「视觉方向以样板间评审结果为准，三套方向的 palette 在各自 HTML 内嵌注释里——本文档锁定的是结构与机制，方向定稿后把选中的取值回填到这里」。

**可迁移（本仓最缺的一段）**：本仓的流程是「spec 条款 → 直接写码 → `npm run tauri dev` 看」，中间没有"可点原型"阶段。补这一段成本很低：一个 `docs/design/explorations/<feature>/prototype.html`（直接用 `src/styles/tokens.css` 的变量 + `data-theme`），作者开浏览器改到满意再写码。**收益不是好看，是"改 HTML 比改 CM6 编辑器便宜一个数量级"**。

## 4. 需求：任务文档自含 + 90 天退役

`docs/tasks/README.md` 定义模板：

```markdown
# <任务名>
状态：进行中 | 待验收 | 已放弃
目标：<一句话说清原始目标>
需求：<范围、约束、验收标准>
方案：<技术方案与结构，自含完整>
决策：<任务过程中用户做的选择与理由>
进度：
- [ ] …
      验证：<命令与结果>
```

硬规则：**自含**（不外链决策档案）+ **90 天期限**（超期 `pnpm check:docs` 提示）+ **收尾三步**（①沉淀：现在是什么→`architecture/`、通用裁决→`decisions.md`/`preferences.md`、可复用流程→`guides/`；②退役：删任务目录；③索引：更新 `docs/README.md`）。

实例质量（`docs/tasks/whiteboard-agent/README.md`）值得逐段抄：

- **首版体验用用户视角叙述**，不写接口：「用户选中两个框，在右侧说『中间加一个校验步骤，连起来』。Agent 读取选区与相邻连线，按当前写入权限提交一个批次。左侧原位出现新节点和连线…用户的视口、选区、输入焦点和撤销记录独立」。
- **「已有基础与缺口」三列表**：可复用入口 / 已有能力 / 本次工作——直接把"不要重写什么"钉死。
- **工具契约表**：工具名 / 输入 / **输出和失败行为**（含「响应大小有界，截断给续读游标；页失效返回可识别错误」）。
- **提交与并发**：一份 `write-flow.html` 流程图 + 一段伪代码（捕获窗口/资料库/基线/epoch/页与视图代次 → 读当前页 → 核对权限 → 在文档队列里核对身份与请求摘要 → 核对页仍有效…）。

**可迁移**：本仓有 OpenSpec（proposal/design/tasks）+ change-workflow 五 gate，**规格闭环比 tau 更重**。tau 值得借的是两点：①「已有基础与缺口」三列表（防重写）；②**90 天期限 + 收尾三步**（本仓 `openspec/changes/archive` 归档只搬 spec，过程文档会长期堆积）。

## 5. 实现：让"加功能"变成"加文件"

四个协议（详见姊妹篇 §1.2）的价值不在优雅，而在于**降低每加一个功能的"结构性协商成本"**：

- `definePage`：33 个页面零登记表，`match: "single" | "params"` 决定单例/多实例。
- `defineTheme`：一个文件 = 一主题族 × 明暗，`tokens(p)` 全键强制，漏键编译不过。
- `defineAssistView` / `defineDatabaseExtension`：右侧栏视图、数据库扩展同构。

配套的**归属规则**（`page-protocol.md`）：单域业务件→`features/<域>/components`、跨域→`src/components`、纯视觉→`packages/ui/primitives`；features 禁新增 `@/pages` 依赖，共享 components 不反向 import features。**每次新增都有唯一正确位置，不需要讨论。**

## 6. 交付：207 个版本，每版一份"用户语言"公告

`apps/desktop/release-notes/` 有 **207 个文件**（`0.0.1.md` … `0.66.2.md`）。`README.md` 的硬约束：

- `pnpm publish:desktop` **发布前校验当前版本公告存在且非空，缺失即拒绝发布**。
- 公告随安装包打进应用（升级后展示），同时写进 OSS `latest*.yml`（升级前展示）。
- **发布后不要再改已发布版本的公告**：已安装客户端只认安装包里那一份。
- 跨版本升级合并展示中间每版公告，从新到旧排列。

写法规则（这是"高品质"的对外投影）：

- 用**用户能感知的语言**，不写 commit 前缀、模块名、内部编号。
- 一条一句话，**先说用户得到了什么**，必要时再说怎么用。
- 移除或行为变化的功能务必写明，并告诉用户替代做法。
- 分组固定：`## 新功能` / `## 改进` / `## 修复`，没有内容的分组省略。

实例（`0.66.2.md`）：「**导出 Word 文档**：卡片、文章、项目文档和 Markdown 文件可以从「⋯ › 导出」保存为 Word 文档（.docx）。标题、列表、表格和代码在 Word 里可以继续编辑…」——没有一个模块名。

**可迁移**：本仓 `CHANGELOG` 与 release 流程若有，可对照这四条硬约束；尤其「发布前机器校验公告存在」和「发布后不可改」是低成本高收益。**207 个版本说明的是节奏，不是纪律**——真正可抄的是"每版必写、写作用户语言、发布前机检"。

## 7. 质量：五道闸门（无 CI）

| 闸门 | 时机 | 内容 | 证据 |
| --- | --- | --- | --- |
| 1. 提交钩子 | pre-commit | `lint-staged`（`oxlint --fix` + `oxfmt --write`）→ `check-database-boundaries` → `check-whiteboard-boundaries` → `check-docs` | `.husky/pre-commit`、`.lintstagedrc.js` |
| 2. commit 规范 | commit-msg | `commitlint`（conventional，header 长度不限） | `.husky/commit-msg` |
| 3. 日常检查 | 随手 | `pnpm lint` / `format` / `format:check` / `lint:all` / `test:quality` / 4 个 `check:*` | `docs/guides/development-quality.md` |
| 4. 交付前 | 发版前 | 真实构建入口验证（`verify-renderer-startup.mjs`、`verify-plugin-content.mjs --production`）+ 安装包验收 + 架构边界 | 同上「构建工具验证」节 |
| 5. 视觉 | 每次 UI 改动 | **Agent 不做视觉验证，截图对照与浏览器走查由用户完成** | `AGENTS.md` 桌面端规范 |

**为什么没有 CI 也能稳**：门禁全部前移到本地（钩子 + 脚本），且**边界脚本是架构级的**——`check-database-boundaries` / `check-whiteboard-boundaries` / `check-desktop-startup-boundaries` / `check-plugin-process-boundaries` 检查的是"分层依赖方向"，这类错误在 CI 抓到时已晚。

**性能与可靠性验收模板**（`docs/guides/dev-content-verification.md`，这是最值得抄的一段）：

- **容量**：1/5/20 份正文 × 每份 1/2/5/10 个 IPC 租约 = 12 组合；单篇 20 个固定种子、**10,000 次接纳**，超出单次增量限制时原正文保持；核对关系、计数、外键。
- **硬杀**：在日志增量事务内 / 日志事务提交后 / 主库投影事务内 / 主库事务提交后 **四个切点各 `SIGKILL` 20 次**；进程外读 SQLite 确认切点；重送原增量后**只保留一次投影与业务流水**。
- **长稳**：预热 5 分钟后**连续采样 60 分钟**（含断线、重连、切库、重开），每 5 分钟采进程内存，每 10 分钟核对主库与服务端，最后排空退出。
- 三条纪律：用同一台机器与相同参数；功能断言通过 ≠ 性能达标（**单独记录主线程延迟与快照大小**）；「不以用例通过代替性能判断」。

**可迁移**：本仓 `scripts/verify.sh` + Playwright 两套 + 软著证据链已经很重。缺的是**这套"容量 / 硬杀 / 长稳"的态度**——本仓的验收多为功能正确性，没有"在事务的哪个切点杀掉进程，数据是否还能对上"这类问题。

## 8. 防 bug：架构边界 + 契约守护 + 漂移即修

- **架构边界脚本**：4 个 `check-*-boundaries.mjs` 在提交钩子跑，检查分层方向不被侵蚀（如 desktop 启动依赖、插件进程边界、数据库包不得依赖桌面）。
- **契约对账测试**：`theme-parity.test.ts`（主题数据块 ↔ `tokens()` 逐值一致 + AA 对比度）、`retired-tokens.test.ts`（退役 token 防回流）、`cn.test.ts`（尺度词登记与 tokens.css 一致）。**都是"两处事实必须一致"型守护**。
- **扫描型守护必须自带"扫描非空"自检**（`AGENTS.md`）：防止扫描路径失效后断言空过恒真。
- **漂移即修**：「失败测试不过夜；不允许用弱断言换绿——断言必须更新到当前正确契约，分不清是漂移还是 bug 时按 bug 上报」。
- **测试纪律极硬**（`AGENTS.md`「测试投入规则」）：只锁契约不锁实现；值得写的七类；**明确禁止**断言常量/注册表内容、断言 UI 文案与类名、与实现同构、mock 演出、恒真断言、数量写死、wall-clock、快照测试；**五种测试退出机制**（被测对象退役 / 守护目标消失 / 已有更强版本 / 同一断言第三次漂移 / skip 超期一季）；不设覆盖率门槛。

## 9. 防腐化：专项治理闭环（本报告最有价值的一段）

Tau 两次大规模的"自我修复"，展示了**人 + 多 Agent 的工业化流水线**：

### 9.1 代码风格治理专项（2026-11-16 ～ 11-17，`docs/notes/2026-11-16-code-style-governance-report.md`）

**起因**：「用户发现长期 Agent 写码导致代码风格漂移」。

**两阶段**：①六维度调研（命名 / 注释 / 结构 / 类型 / 重复死码 / Agent 气味），**6 个子代理并行扫描 + `git blame` 时间线验证**；②分批修复（六批，主代理 + 子代理流水线）。

**修复账本（部分）**：
- 类型：`tables/` 29 文件的 `parse(row: any)` / `as any[]` 模板清零 → `SqliteRow` 契约（`src-electron/main/types/table.ts`）。
- 一致性：`WhiteBoard` → `Whiteboard` **550 处 + 14 文件改名**。
- 结构：**8 个巨型文件/方法拆分，1500 行以上生产文件 8 → 0**（如 `plugins/host.ts` 的 `context()` 2110 行 → 222 行组装 + 39 个域方法；`ChatContainer.tsx` 1975 → 862 + 10 个域 hooks，且有 11 个用例护栏先行）。
- 注释：**决策元数据约 600 处清零**（「方案X定稿」「裁决日期」「mockups/xxx 路径」），动词播报注释约 400 处清理。
- 死代码：`knip` 落地，1242 → 694；零消费导出清除约 560 处。

**闭环**：规则沉淀进 `docs/decisions.md` 新增「代码风格」节 4 条 → `docs/guides/dev-code-style.md`（70 行判据 + 每节「本仓样板」指向真实文件）→ 工具栅栏表（`no-explicit-any` warn / `no-non-null-assertion` warn / knip 已配置，**并写明升级路径**）。

### 9.2 测试治理专项（2026-11-16，`docs/notes/2026-11-16-test-governance-audit.md`）

**起因**：用户感知「很多测试意义不大：为极小的点写测试、写死了值」。

**方法**：**8 个分区子 agent** 按统一口径（A 琐碎低价值 / B 重复实现 / C 写死值脆性 / D 过度 mock / E 守护对账-保留 / F 高价值-保留 / G 巨型文件 / H flaky）审查 **1631/1653 个测试文件（约 26.4 万行）**。

**结论**：问题「少数集中的口袋，非系统性腐烂」——F+E 类占各区 60-80%，A-D 类约 6-8%，集中在 UI 层。

**执行**：P0+P1 = 41 文件 +38/−957 行（删 11 个整文件、删常量/透传/注册表断言、删性能断言与 `performance.now/Date.now/Math.random/console.log/heapUsed`、文案/类名断言重写为结构级、写死值动态化）；P2 = 巨型文件拆分（用例守恒：55/69、30、35 逐口径对账）。

**闭环**：裁决沉淀进 `decisions.md`「工作方式」节；P2 遗留清单留在文末，**完成后本文件可删**。

### 9.3 工具迁移也走同一套（`docs/notes/2026-10-25-quality-tools-migration.md`）

ESLint/Prettier → Oxlint/Oxfmt 的迁移笔记，方法学值得完整抄：

- 固定同一提交、文件清单（`git ls-files` + 旧规则 ignores，共 **5,637 个**）、Node 版本、机器（Apple M3 Pro）。
- 两套工具**完全相同的批次**（按 100,000 字节切 4 批），关闭缓存，不跑 fix/write。
- 每组**预热一次 + 顺序跑三次，取中位数**；退出码 0/1 都记录，其他退出码视为测量失败。
- 结果：纯 lint **28.461s → 2.446s（11.6×）**；格式检查 **72.134s → 1.433s（50.3×）**。
- 明确声明局限：「开发机有其他常驻进程，旧工具三次波动较大；结果是本机快照，不是稳定的 CI 性能承诺」。
- 原始秒数、版本、退出码、源码校验摘要存 `2026-10-25-quality-tools-benchmark.json`。

**这是"量化决策"的样板**：迁移不是"新工具更现代"，而是"11.6 倍与 50.3 倍，附测量方法与原始数据，并声明局限"。

## 10. AI 协作的工作方式

- **`AGENTS.md` 169 行**是 agent 的操作手册，最硬的一条是**任务列表纪律**：「创建任务列表时，**只添加一个**首要任务…调查完成后撰写简洁计划并添加最小必要数量的后续任务（3–5 个）…始终保证只有一个 IN_PROGRESS」。
- **`.claude/launch.json`** 40+ 端口 = 作者用 Claude Code，每个 mockup 一个预览服务，agent 与人都能直接开图看。
- **`docs/notes/` 73 份日期文档**是"每做一件大事留一份证据"的产物：调研快照、验证记录、压测数据、审计报告。命名一律 `YYYY-MM-DD-<主题>.md`，**写完即冻结、随时可删、禁止被引用**。
- **对 agent 子系统本身做故障压测**（`docs/guides/dev-subagent-stress.md`）：用「pi 模型替身 + 127.0.0.1 临时 HTTP 网关」，**不读用户模型凭据、不向真实服务商发负载**；判据 10 条（同一子会话始终串行、并发不超注入值、取消后迟到结果不能覆盖终态、写盘失败也要停止运行…）；指标 `SUBAGENT_STRESS` / `SUBAGENT_HISTORY_STRESS` / `SUBAGENT_RACE_STRESS` / `SUBAGENT_NETWORK`。
- **意识到 agent 的副作用**：9.1 的起因就是「长期 Agent 写码导致代码风格漂移」——他们的应对不是"少用 agent"，而是**把漂移当成一类可治理的技术债，用专项 + 规则 + 机检闭环修掉**。

---

## 11. 本仓（Biaoyue）对照与可迁移清单

本仓已有的（比 tau 更重的部分）：OpenSpec 规格闭环 + change-workflow 五 gate（G0–G4）+ C9/C10/C11 机检 + 数据面六栏表 + 反馈对账表 + `scripts/cw-*.sh` 系列 + `verify.sh` + docs 治理门禁 + 软著证据链。**流程密度不输 tau。**

真正的差距是六项，按性价比排序：

| # | 差距 | tau 的做法 | 本仓落地方式 | 成本 |
| --- | --- | --- | --- | --- |
| 1 | **无可点原型阶段** | 183 个 mockup HTML，直接用最终 CSS 变量 | `docs/design/explorations/<feature>/prototype.html`，引 `src/styles/tokens.css` + `data-theme`，定稿后取值回填 spec | 半天/功能 |
| 2 | **无组件对照场** | `showcase` 31 份档案（LIVE 标本 + 状态矩阵 + API 表），一图一端口 | 加 `/showcase` 路由（Vite 现成）；先做 4 个基件 | 1 天 |
| 3 | **无审美负样本清单** | `preferences.md` 81 行，负面清单多于正面 | 新建 `docs/design/system/preferences.md`（或并入 spec §7.3），只写结论、不写日期 | 2 小时 |
| 4 | **无发布公告纪律** | 207 版 × 每版用户语言公告 + 发布前机检 + 发布后不可改 | 若已有 CHANGELOG，补「发布前校验存在」与「用户语言、不写模块名」两条；接进发布脚本 | 2 小时 |
| 5 | **验收偏功能、缺可靠性模板** | 容量 12 组合 / 硬杀 4 切点 ×20 / 长稳 60 分钟 | 为「正文保存」「文件改写」写一份 `docs/delivery/<域>-verification.md`，先只做硬杀一项 | 1 天/域 |
| 6 | **无专项治理闭环** | 多子代理分维度扫描 → 量化 → 分批修复 → 规则沉淀 → 栅栏表 | 复用本仓 `/sync-gbrain` 之外的手段：一次「CSS 字面量治理」专项（1325 px / 288 色）即可跑通整套闭环 | 2–3 天 |

**不要照抄的两点**：
- **无 CI**：tau 靠 pre-commit + 本地脚本；本仓已有 CI（tsc + vitest --coverage + css-manifest），**保留 CI**，把 tau 的边界脚本思想加进去即可。
- **207 个版本**：那是单人高频发版的节奏，不是目标；抄"每版必写 + 用户语言 + 发布前机检"三条纪律就够。

---

## 12. 方法与局限

- **方法**：源码级阅读 tau 的 `AGENTS.md`(169 行)、`docs/README.md`、`docs/preferences.md`、`docs/tasks/README.md` 与实例、`docs/guides/{development-quality,dev-code-style,dev-content-verification,dev-subagent-stress}.md`、`docs/notes/` 中的治理/迁移/审计报告、`apps/desktop/release-notes/README.md` + 实例、`.husky/*`、`.lintstagedrc.js`、`scripts/quality.mjs`、`.claude/launch.json`、`apps/desktop/mockups/` 抽样。
- **局限 1**：**无 git 历史**（快照目录无 `.git`），所以"迭代节奏、PR 规模、分支策略"无法从提交记录验证；版本数 207 是从 release-notes 文件数得出，不是提交数。`git blame` 时间线是文档里提到的做法，本文无法复现。
- **局限 2**：**未运行** tau（需要 Electron 全量与依赖安装），所有关于"作者怎么用"的推断都基于配置与文档，不是观察。
- **局限 3**：`docs/notes/` 73 份只抽样读了 4 份（治理 2 + 迁移 1 + 测试审计 1），其余按文件名分类归纳；具体数字（如 knip 1242→694）来自报告自述，未独立复算。
- **局限 4**：本仓侧对照基于 `AGENTS.md`、`scripts/` 目录、`openspec/`、`docs/delivery/` 的现状，未逐项验证每个门禁是否真的在跑。
