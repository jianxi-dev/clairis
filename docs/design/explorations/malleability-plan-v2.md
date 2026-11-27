---
title: "数据文件化与插件化：方案 v2（经 Codex 对抗评审）"
type: design
status: draft
last_updated: 2026-11-25
source_of_truth: historical
---

# 数据文件化与插件化：方案 v2（经 Codex 对抗评审）

> 来源：2026-11-25 会话（开头依据 `docs/research/competitors/tau-界面品质与架构学习.md` 与 `docs/research/technical/data-fileization-omarchy-inventory.md` 做出的分析 + 规划），经 `/codex` 对抗评审（20 项发现，采纳 17 / 澄清 2 / 反驳 1）后形成的 v2 方案。
> 状态：方案草稿（historical）。当时的下一步（P0-0/P0-1 开 change）已落地为 `data-surface-contract-v1`；本文补录为可检索文档，不改变既有裁定。

CODEX SAYS（consult）：
════════════════════════════════════════════════════════════
（Codex 实际读取了方案列出的源码、文档、`ci.yml` 与 `Cargo.toml`；工具调用日志略，以下为评审全文。）

## 总体判断

这份计划最大的问题不是方向错，而是**用一套庞大的生成器/门禁机器去解决一个当前只用两个已知缺陷就能说清的问题**。它把「已有的三层配置底座」当成不够，却没证明现有机制为什么不能渐进扩展。以下按严重度排列。

---

## 一、与现状事实冲突（计划建立在错误前提上）

1. **`apply_patch_at` 清空 `state.json` 不是新发现，是已裁定待修的根因**。`docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md` §5.8 已经确认：`config.rs:993` 的 `apply_patch_at` 只读 user、`recent_files=None` → `state_value`（`config.rs:451`）写空默认值并覆盖磁盘 `state/state.json`；修复方案也已选定（删 state 写入 + 修返回值语义 + 补字节不变单测）。计划把它列进 P0 验收第 4 条，却没有实现设计，也没排到第一位。顺序错了。

2. **「未知键被拒绝」与现状直接冲突，且会破坏前向兼容**。`AppConfig` 及嵌套 struct 全部没有 `deny_unknown_fields`（grep 零命中）；`merge_json`（`config.rs:~392`）对数组整体替换、对象深合并任意键，然后 serde 静默丢弃未知字段。要做「未知键拒绝」必须显式顶层 allowlist + 未知键检测，且要定义「新版本写、旧版本读」的兼容策略。计划同时要求「未知键被拒绝」和「旧配置仍可加载」，没给调和方案。

3. **「只有自定义校验需要写 Rust」是假的**。现有 `validate_config` 是纯手写：范围、枚举、`htmlToolbarItems` 的 `ALLOWED` 白名单、重复 id、`propTemplates` 字段规则。Cargo 里没有 `schemars` / `jsonschema` / `valico` 任何校验库。通用 loader 要么引入依赖，要么接受「schema 只是文档，运行时无真校验」。计划没有选。

4. **D2「必须绑定既有命令 id」当前几乎无解**。`src/editors/orchestration/commands.ts` 的注册表只有 `floating-toolbar.ts:412-421` 注册的 5 个格式命令；导出、开路径、AI 预设提示、插片段都不是 registry 命令。要让插件贡献菜单/工具条，必须先造一个声明式动作 DSL 和分发器，这是计划没列的前置工程。

5. **「已文件化」不等于硬编码消失**。`rouletteSectors` / `htmlToolbarItems` 只是用户覆盖层；默认集合仍是 `ROOT_SECTORS`（`roulette.ts`）、`HTML_TOOLBAR_ITEMS`（`slots.ts`），且 `resolveToolbarOrder` 在配置为空/过滤为空时回落常量。计划没有定义「默认源 vs 兜底常量」的优先级，迁移后仍有第二真相。

6. **计划引用的路径有不存在的东西**：`src/shared/` 不存在，`scripts/check-data-surfaces.mjs` 不存在，`package.json` 无 `surface:new`，Cargo 无 schema/codegen 依赖。这些不是问题本身，但说明可行性论证是空的。

---

## 二、核心逻辑缺口

7. **registry-first 还是 codegen，计划自己问了但没答，且现状两套都不够**。真实漂移源有五个：registry JSON、JSON Schema、Rust struct、TS interface、文档。计划一面生成 Rust struct + validate 桩，一面又说「只写 schema + 消费者」，自相矛盾。生成的 `src-tauri/src/surfaces/<id>.rs` 还需要改 `lib.rs`/`mod.rs` 才编译——自动生成器改 Rust 模块树是高风险操作，计划一字未提。

8. **五种合并语义没有判据**。计划说 list = 「整体替换 + 未知 id 过滤 + 去重」，但仓库现状是三种政策并存：`theme.toml` 忽略未知键并告警、`capabilities.applyCapabilityConfig` 忽略未知 id、`htmlToolbarItems` 静默过滤未知 id。哪个面用「失败关闭」哪个用「容错开放」，计划没给规则。「非法值拒绝」和「未知 id 过滤」在同一个 loader 里互相打架。

9. **「改文件 → 行为变化」测试不可机检，且生成的 e2e 必然是假的**。`cw-data-surface.sh` 的 `diff` 只用 `grep -qF` 查符号，符号出现在注释里也能过；新门禁第 1 条「有 consumer」大概率沿用同款 grep。生成器即使产出 e2e，也不知道该面 UI 长什么样，只能写空壳断言——这正是计划自己想避免的「有定义、无机检」。

10. **热应用承诺与现有代码冲突**。watcher 只轮询 `user/settings.json`（`config.rs:1128`），新面要么扩 watcher，要么复用 `config-changed`；但 `reloadAppConfig` 有 1500ms `SAVE_ECHO_WINDOW_MS` 抑制（`useConfig.ts:135`），且 `applyRustConfig` 是全量应用，会 `restorePaneLayout`、重置 store。AI 改一个面触发整页配置重放，既可能吞掉未保存 UI 状态，也可能被 echo 窗口吃掉——「1 秒内生效」没有依据。

11. **反向棘轮是全线最弱的一环，基本必然失败**。
   - 目标文件里大量常量是几何/性能/调色板/度量（`roulette.ts` 的 `ROULETTE_BOX`、`HUB_RADIUS`，`menu-metrics.ts`，`color-palette.ts`，`SHOW_DELAY_MS`），regex 扫「顶层 const 数组」会立刻误伤几十处，baseline 会大到失去意义。
   - `// data-surface: none: <理由>` 是自由文本，机检只能验注释存在，等于门禁剧场。
   - 「存量只减不增」没有初始快照就不可证伪；「每次触及该文件必须迁移」会让无关改动背上迁移债务。
   - 结论：这条棘轮不应做全局 AST/regex。真要做，只做 3–5 个注册文件上的 eslint 自定义规则（禁止新增导出常量数组/Record），其余交给 code-review。

12. **五问分级不可机检**。G0 只能检查「有没有这一节」，无法检查分类是否正确；代码里新加了常量但 proposal 写 D0，没有任何机制会发现。计划第 6.1 节对此没有答案。

13. **快照/回滚语义没扩到面级**。现有 `snapshot_user` 只快照 `user/settings.json`，保留 10 份。新面各自的快照命名、保留策略、跨面一致性（恢复单个面时其它面已变）、与 `useAiEntry` 撤销条的关系，全部未定义。验收第 3 条「可回滚」只演示一次，证明不了机制。

14. **迁移故事缺版本锚点**。`ensure_defaults` 只在文件不存在时写默认，升级覆盖默认值没有迁移路径；`surface.schemaVersion` 只描述面内 schema，管不了 app 升级。「`deprecatedAt` + 两个版本后删除」里的「版本」指什么没定义。

15. **插件权限模型是空白**。当前 `validate_manifest` 只校验 id/name/version/source 四项；计划要加 `contributes/permissions/minAppVersion`，但权限怎么授予、如何与「不执行代码」的铁律共存、SKILL.md 注入 agent 上下文的注入面怎么防，都没有设计。这是安全边界，不是收尾细节。

---

## 三、可行性与排序风险

16. **P0 第 1 条「30 分钟完成」不成立**。即便只做导出预设这一个面，也至少要动：registry、schema、Rust 读取/校验、TS accessor、loader 注册、watcher、AI 工具、快照、契约测试、文档、两道门禁接入。加上 `npm run tauri dev` 手动验收，是数天量级。

17. **顺序反了**。正确顺序是：先修 `apply_patch_at`（根因，已有方案）→ 挑一个已文件化的面（`htmlToolbarItems` 最小）证明「默认源唯一 + 改文件即生效 + 可回滚」→ 再抽象通用 loader → 最后才是生成器。计划是先造生成器，再用新面验证，属于拿未证实的机制当地基。

18. **CI 覆盖不到新 Rust 代码**。`verify.sh` 跑 `cargo check`，CI 只跑 tsc + vitest coverage + css manifest；生成的 Rust validate 桩没有 cargo test 入口，新增分支会成为覆盖盲区。计划要求「每个面有 fixture 测试」但没排进 CI。

19. **测试基建不支持文件面 e2e**。Playwright 通过 `tauri-mock.js` 注入 mock IPC，碰不到真实文件系统/Rust loader。要么补 mock 桥（文件面事件/种子），要么承认这类测试只是前端归一化测试 + Rust 集成测试 + 手动 tauri dev，不能写成验收里的「UI 行为测试」。

20. **图标决策缺失**。AGENTS.md 硬约定两套图标表必须同时覆盖。计划把图标列为数据面，却没决定数据里存的是名字→字形路径、还是名字→SVG；`src/ui/icons.ts` 是 React 组件表，`src/editors/icons.ts` 是 DOM 构建表，两者结构不同。生成器为一个面只产一套访问器，覆盖不了这个硬约束。

21. **快捷键被低估**。改键位要重新注册 `tauri-plugin-global-shortcut`，chord 解析/校验在 `shortcuts.ts` 和 `key-chord` 两处；把它当普通 map 面会产生「文件改了但全局快捷键没变」的半生效状态。

20 项错误处理全部缺失：schema 文件损坏、registry 指向不存在路径、目录扫描权限失败、非 UTF-8、超大文件、重复 id、原子写期间的 watcher 抖动/去抖、dir 面部分失败、symlink 逃逸、AI 写路径 TOCTOU。计划只有一句「告警聚合」。

---

## 四、计划自身违反仓库流程

21. 这份计划触动了 `config.rs`、`extensions.rs`、两套 icons、`shortcuts.ts`、`paneHeaderMenu.ts`、`floating-toolbar.ts`、`capabilities.ts`、`useConfig.ts`、`App.tsx`——全部命中 `DATA_SURFACE_PATHS`。按 `docs/agents/data-surface.md` 和 AGENTS.md 硬约束，它必须先建 OpenSpec change，design.md 里要有「## 数据面」六栏表和「## 数据面分级」。计划本身两样都没有。以现状直接实现，第一道 G0 门就过不去。

---

## 五、更小的替代方案（针对过度复杂）

如果只做三件事：

1. **修根因**：删 `apply_patch_at` 的 state 写入，修返回值语义，补「state.json 字节不变」单测；顶层加显式未知键检测（保留前向兼容策略）。这是一切的前提，已有现成方案。
2. **收口一个已文件化的面**：用 `htmlToolbarItems` 或 `rouletteSectors` 做样板，把默认源从 `HTML_TOOLBAR_ITEMS` 常量改成 registry 声明的 `user/surfaces/<id>.json` + 代码兜底显式化，配一个通用 `SurfaceStore`（registry + 手写 validator 子集 + 一个 `load_surfaces` 命令 + 一个 `surfaces-changed` 事件）。不生成 Rust struct，Rust 侧统一用 `Value` + validator，TS 侧只生成类型 Accessor。
3. **再写 scaffold**：`surface:new` 只生成 registry 行、数据文件、TS accessor、契约测试骨架；不生成 Rust 代码、不生成 e2e。反向棘轮降级为针对少数注册文件的 eslint 规则。

这套能把「新增功能默认文件化」跑通，工作量约为原计划的 1/5，且每一步都能被现有机检和真实 tauri dev 验收。原计划的生成器、AST 棘轮、manifest v2 权限、AI 面级工具都可以等样板面证明后再谈。

════════════════════════════════════════════════════════════
Tokens: 1,430,339 | Est. cost: provider-dependent
Session saved: `.context/codex-session-id` = `01a21123-bad5-71a3-8c10-63ad4723ee95`

---

## 我的处置

Codex 这次抓到的是真问题，不是噪音。原方案确实把“生成器”当成了地基，顺序反了；下面按条处置。

| Codex 发现 | 处置 |
|---|---|
| 1. `apply_patch_at` 根因应排第一 | **接受**。P0 第一件事，独立小票，不跟 registry 混。 |
| 2. 未知键拒绝 vs 前向兼容 | **接受**。改为“写边界显式 allowlist + 版本化”，不做全局 `deny_unknown_fields`；旧配置读取保持宽松。 |
| 3. “只写 schema + 消费者”不成立 | **接受**。P0 不引入 JSON Schema 运行时依赖；schema 只作契约/夹具/AI 文档，Rust 校验仍是 `Value` + validator。 |
| 4. D2 依赖命令目录 | **接受**。命令目录扩到全站动作之前，不碰插件贡献。 |
| 5. 默认源 vs 兜底常量双真相 | **接受**。每个面声明 `defaultSource`；默认文件是唯一源，删掉代码兜底常量。 |
| 6. 合并/未知策略不统一 | **接受**。registry 增加 `unknownPolicy`（fail-closed / filter-warn / ignore-warn），逐面声明。 |
| 7. registry/codegen 未决 | **部分接受**。不做全量 codegen；registry 是唯一元数据，Rust/TS 类型手写 + 对账测试，避免生成 Rust 模块树。 |
| 8. “改文件→行为变化”测试不可机检 | **接受**。不生成 e2e 空壳；契约测试用夹具驱动，Rust 集成测试进 `cargo test`，UI 行为只在有真实 mock 桥时写。 |
| 9. 热应用全量重放 + echo 窗口 | **接受**。面级 `surfaces-changed(id)`，只重载该面；不复用 `applyRustConfig` 全量重放。 |
| 10. 反向棘轮必然误伤 | **接受**。降级为 3–5 个注册文件的 ESLint 规则 + baseline 快照，不做全局 AST/正则。 |
| 11. 五问分级不可机检 | **接受**。G0 只机检“节存在 + 六栏 + D0 理由”，分类正确性交 code-review；AI 辅助分级。 |
| 12. 面级快照未定义 | **接受**。`snapshots/surfaces/<id>/`，单面恢复，不承诺跨面一致。 |
| 13. 迁移缺版本锚点 | **接受**。app semver + surface `schemaVersion`；加载端迁移，失败回最后快照。 |
| 14. 插件权限空白 | **接受**。推迟到命令目录 + 贡献注册表之后；先定义 surface 权限 scope，再做 manifest v2。 |
| 15. 30 分钟不成立 | **部分接受**。原文指“脚手架就绪后新增一个面”，但表述不清；改为“P0 样板面 2–3 天，脚手架后新增面 1–2 天”。 |
| 16. `src/shared` 等路径不存在 | **接受**。全部标注“拟新增”，先做样板面再落目录。 |
| 17. CI 只跑 tsc/vitest/CSS | **不接受（事实过时）**。`ci.yml` 已有 `rust-tests`（`cargo test`）与 `e2e-smoke`（#1444/#1445）。但 `verify.sh` 仍只 `cargo check`，新 Rust 面测试要确保进 `cargo test`。 |
| 18. 图标两套表结构不同 | **接受**。图标面单独设计：数据只存“概念→字形路径”，两套表由同一个 registry 生成/对账，不能用一个 accessor 糊过去。 |
| 19. 快捷键要重注册全局快捷键 | **接受**。键位面不是普通 map，必须包含“重注册 + 半生效检测”。 |
| 20. 计划违反 OpenSpec G0 | **接受**。本轮只是方案草稿；下一步必须先建 change，design 带“## 数据面分级”和“## 数据面”六栏。 |

只有一条我明确反驳：Codex 说 CI 覆盖不到 Rust 测试，这是旧信息。仓库今天已有 `rust-tests` job；真正要补的是“新面的 Rust 测试必须写进 `cargo test`”，不是“CI 没有 cargo test”。

---

## 修订后的方案 v2（聚焦“后续新增功能如何自动文件化”）

### 核心变化

不再追求“一条命令生成全套含 Rust/e2e”，改成四步可验证的渐进路径：

```
新功能
  → G0 数据面分级（D0/D1/D2/D3）
  → 若是 D1/D2：surface:new 生成 registry/schema/TS accessor/契约测试/六栏
  → 写消费者（这一步不能自动）
  → G1 门禁（登记完整 + 契约测试 + 真实消费点 + 扫描非空）
  → G4 重生成 AI 地图/文档/状态表
```

“自动”的边界：**能自动的是登记、schema、类型、夹具、测试骨架、文档、门禁接线；不能自动的是“这个功能该不该文件化”和“消费者怎么读”。**

### P0：先修根因，再做单面样板

**P0-0 修 `apply_patch_at`（1–2 天）**
- 删 state 写入；只写合并后的 user diff，不把代码默认值固化进 user。
- 返回值改为真实有效配置。
- 补测试：含 `state.json` 的目录 → patch → state 字节不变。
- 写边界未知键检测：显式 allowlist + 版本化；不做全局 `deny_unknown_fields`。
- 验收：`cargo test` 绿；旧配置可加载；未知键被拒且磁盘不变。

**P0-1 单面样板：`htmlToolbarItems`（2–3 天）**
- 默认源从 `slots.ts` 常量迁到 `defaults/surfaces/toolbar.json`，代码常量删除。
- 新增 `SurfaceStore` + `load_surfaces` 命令 + `surfaces-changed(id)` 事件。
- 前端只重载该面，不走 `applyRustConfig` 全量重放。
- AI 工具先只覆盖这一个面：`read_data_surface("toolbar")` / `patch_data_surface("toolbar")`。
- 验收：改文件 → 工具条变化；AI 改 → 1 秒内生效；可回滚；代码里没有第二份默认数组。

### P1：再抽象，再生成

**P1-1 通用 loader（3–5 天）**
- 支持 map / list / dir / package 四种形态；Rust 用 `Value` + `SurfaceValidator` trait，不生成 struct。
- registry 增加 `unknownPolicy`、`defaultSource`、`merge`、`reload`、`snapshot`。
- 只迁第二个面（图标或键位）验证通用性；不追求一次覆盖全部。

**P1-2 `surface:new` 脚手架（2–3 天）**
- 只生成：registry 行、schema、TS accessor、契约测试骨架、`## 数据面` 六栏、文档页、门禁清单。
- 不生成 Rust 代码、不生成 e2e、不动 `lib.rs`/`mod.rs`。
- 验收：用脚手架新增一个面 ≤1 天；G1 门禁能在注册文件里抓到未登记的新常量。

**P1-3 命令目录（3–5 天，D2 的前置）**
- 把 `commands.ts` 从 6 个格式命令扩到全站动作：`{id, label, icon, scope, run, args?}`。
- 增加声明式命令类型：插片段、套模板、设配置、跑导出、开路径、AI 预设提示。
- 之后菜单/工具条/轮盘/键位/插件都只引用命令 id。

### P2：迁移与插件

- 面板菜单（依赖命令目录）→ 图标（两套表同源）→ 键位（全局重注册）→ 胶囊。
- manifest v2：`schemaVersion/kind/contributes/permissions/minAppVersion`；权限 scope 按 surface 定义；只允许 D2 贡献；不执行代码。
- 技能文本继续作为“不可信背景”，不提升为系统指令。

### 质量线（并行，不阻塞）

- P0：`tokens.ts` + `check-tokens.mjs`（禁新增 hex/rgba、AA 对比度），进 `verify.sh`。
- P1：4 个基件 + `/showcase` + 四条交互条款。
- 先 supersede `spec.md` §8 的“一刀切不做组件库/动效”。

### v2 验收（替换原来的夸张指标）

1. P0-0：state 字节不变；未知键写边界拒绝；旧配置可读；`cargo test` 绿。
2. P0-1：工具条默认只有一份文件源；改文件/ AI 改都生效；可回滚；无代码常量兜底。
3. P1-1：第二个面只写 validator + 消费者即可接入。
4. P1-2：脚手架新增面 ≤1 天；未登记常量在注册文件里被门禁拦住。
5. P1-3：不改代码，通过数据文件给菜单加一个引用既有命令的项。
6. P2：插件贡献一个菜单项 + 一个主题 token；停用即移除；零代码执行。

---

## Recommendation

Recommendation: 采纳 Codex 的“先修 `apply_patch_at` → 用 `htmlToolbarItems` 做单面样板 → 再抽通用 loader → 最后写 `surface:new`”顺序，并把未知键拒绝限定在写边界/版本化 allowlist，因为原方案把未证实的生成器当地基，而 Codex 指出的默认源双真相、全量配置重放和反向棘轮误报会先让机制失去可信度；同时保留我关于 CI 已含 `cargo test` 的更正，新面的 Rust 测试只需确保进 `cargo test`，不必重造 CI。

---

补充两条运行事实：

- gstack 自动升级未完成：`git fetch` 经 `127.0.0.1:7890` 代理拒绝/超时，未做破坏性回退；本次 `/codex` 在 v1.88.1.0 上完成。
- 本轮未改仓库代码，只在 `.context/` 写了会话 ID（该目录已被 `.git/info/exclude` 忽略）。下一步若确认，我会按 v2 先开 `malleability-contract-v1`，design 里补“## 数据面分级”和六栏表，再拆 P0-0 / P0-1 两张票。

STATUS: DONE_WITH_CONCERNS — 方案已整理并经 Codex 对抗评审；升级因代理失败未执行，未影响评审。
