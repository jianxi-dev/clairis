Reading additional input from stdin...
2026-11-16T22:49:02.841801Z ERROR codex_skills_extension::loader::host: skills scan reached its traversal limit (root: file:///Users/mason/.agents/skills)
OpenAI Codex v0.167.2
--------
workdir: /Users/mason/ToHighs/clairis-wt-design-plan
model: deepseek-flash
provider: custom
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR]
reasoning effort: none
reasoning summaries: none
session id: 01a1e68c-b03c-7c70-9824-efed0603b73d
--------
user
你是严格的独立对抗式评审专家。只做只读评审，绝对不要修改任何文件。
请对设计方案文档做对抗式评审，路径：docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md
先阅读该文档，再对照本仓库实际代码核查事实准确性。重点：
1. 事实核查：文档引用的文件路径、函数名、字段名、行号是否与仓库代码一致；发现任何虚构或错误必须指出，附实际证据（文件路径:行号或实际字段名）。
2. 逻辑漏洞：论证是否成立、前后矛盾、边界条件、遗漏。
3. 修订建议：具体可执行，按优先级排列。
输出格式：
## 总体判定：通过 / 需修订
## 事实核查（逐项，附证据）
## 逻辑与遗漏问题（编号）
## 修订建议（按优先级）
直接输出评审报告，不要客套。
hook: SessionStart
hook: SessionStart
hook: SessionStart
hook: SessionStart
hook: SessionStart Completed
hook: SessionStart Completed
hook: SessionStart Completed
hook: SessionStart Completed
codex
我会先完整读取该设计文档，再按文档中的路径、函数、字段和行号逐一对照仓库实现；只做只读检查，不会修改任何文件。
exec
/bin/zsh -lc "pwd && wc -l docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md && sed -n '1,240p' docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
/Users/mason/ToHighs/clairis-wt-design-plan
     209 docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md
# 数据文件化提取方案

> 状态：设计方案（已通过独立对抗评审，按意见修订）
> 对应目标：第 2 项——深化数据文件化研究，输出「可提取为数据文件的功能清单」与设计实现方案
> 事实基线（已校正）：`src-tauri/src/config.rs`、`src-tauri/src/commands/config_cmd.rs`、`src-tauri/src/commands/capture.rs`、`src-tauri/src/extensions.rs`、`src/hooks/useConfig.ts`、`src/stores/index.ts`、`src/stores/editorStore.ts`、`src/lib/capabilities.ts`、`docs/research/technical/data-fileization-omarchy-inventory.md`

## 1. 背景与目标

数据文件化是本产品既定的产品设计方向，已有底座与部分实现。存在两个明确问题：

1. **提取不够**：许多可配置能力仍是代码常量，只有被明确要求时才会文件化，「不明确说明的能力不会进行数据文件的设计」。
2. **目标**：让用户**通过 AGENT 直接自定义产品功能**——AGENT 改数据文件即改产品行为，无需改源码。

本方案回答：哪些功能可提取为数据文件、数据文件的目录与合并设计、AGENT 自定义的落点与边界，以及一个必须修复的根因缺陷。

## 2. 立场与硬边界

- **扩展点 = 数据文件，不执行用户代码**。AGENT 只改声明式数据文件，最坏「没生效」，不会「搞坏应用」。
- **密钥永不文件化**（apiKey 仅内存，走 keyring 命令）。
- **用户层目录是 AGENT 写入口**：`user/` 是核心写入口，扩展点目录（snippets/templates/theme.toml）也在用户层，但不在 `user/` 子目录下——边界表述按此校正。
- **无消费者不提前建目录**：不为「未来可能用到」提前建数据文件。

## 3. 数据文件底座（现状，已校正）

`config_base()` = Tauri `app.config_dir()`，macOS `~/Library/Application Support/dev.biaoyue.app/`（`config.rs:1033-1038`）。

| 目录 | 内容 | 写入方 |
|---|---|---|
| `defaults/settings.json` | 内置默认（随包发布，用户不可改） | 构建产物 |
| `user/settings.json` | 用户层覆盖（深合并后唯一生效值） | Tauri 命令 / AGENT |
| `state/state.json` | 运行时派生（`recentFiles` / `scrollPositions` / `embedScrollPositions` 三字段） | 派生存储 |
| `snapshots/settings-*.json` | 快照（保留 10 份，有单测） | Tauri 命令 |
| `snippets/*.md`、`templates/*.md`、`theme.toml` | 扩展点数据文件 | 位于 `app_config_dir()` 根，用户层 |

**读取管线（已校正）**：`applyRustConfig`（`useConfig.ts:407-477`）→ `useEditorStore.setConfig`。方案原称的 `loadSettings()` 函数不存在，已修正。

**合并语义（关键，已校正）**：
- `save_config` 是全量覆盖；`patch_config` 本身对 user 层深合并（`config.rs:949-976`）。
- **`merge_json` 对数组是整体替换**（`config.rs:392-396` `(_, over) => over.clone()`）——这是本仓既有语义，B 档文件设计需沿用，不可另造。

## 4. 可提取为数据文件的功能清单

按提取条件分三档。**A 档字段名已按代码实际校正**。

### A 档：已文件化（保持，纳入统一清单管理）

| 功能域 | 真实字段 / 文件 | 消费者 | 状态 |
|---|---|---|---|
| 阅读设置 | `readerFontSize`（数值，校验 8–96）、`readerWidth`、`readerSkin` | 阅读区 | ✅ 已落地（注：无 `reader.font` 字体族、`lineHeight`、`mode` 字段） |
| 视图规格 | `settings.json` 顶层四字段：`railViewSpec`/`previewSettings`/`aiViewSpec`/`paneLayout` | `useStore` 的 `setRailViewSpec` 等 | ✅ 已落地（顶层字段，非 `viewSpec.` 嵌套） |
| AI 连接 | `openaiEndpoint`/`openaiModel`/`ollamaEndpoint`/`translationProvider`/`langPair`；apiKey 仅内存 | AI 客户端 | ✅ 已落地（无 `style`/`sessionId` 字段） |
| 编辑器扩展 | `capabilities` 键，id 为 `math`/`code-highlight`/`mermaid`/`preview-zoom` | `CapabilityRegistry` | ✅ 已落地 |
| 派生状态 | `state.json`：`recentFiles`/`scrollPositions`/`embedScrollPositions` | `useStore` / `useScrollRestore` | ✅ 已落地 |
| 主题覆盖 | `theme.toml`（白名单 13 个 `--app-*` token，是 `tokens.css` 17 个的子集） | 主题注入 | ✅ 已落地 |
| 片段 / 模板 | `snippets/*.md`、`templates/*.md` | 斜杠菜单 / 模板选择器 | ✅ 已落地 |
| **轮盘扇区** | `rouletteSectors`（`config.rs:65`，设置页有勾选 UI，`floating-toolbar.ts:715` + `useConfig.ts:440` 消费；默认集合 `ROOT_SECTORS` 是常量） | 轮盘 | ✅ **已文件化**（原误判为 B 档） |
| **工具条按钮** | `htmlToolbarItems`（`config.rs:68`，设置页可编辑，`slots.ts:resolveToolbarOrder` 消费） | 水平工具条 | ✅ **已文件化**（原误判为 B 档） |
| **捕获配置** | `~/.biaoyue/config.toml`（TOML，**在应用配置目录之外**，`CaptureConfig`，无 hotkey 字段） | 捕获浮层 | ✅ 已落地，但**与三层目录是两个世界**，是否纳入统一管理需明确立场（见 §5.7） |

### B 档：可进一步文件化（当前是代码常量或未持久化）

| # | 功能 | 现状（已校正） | 数据文件设计 | AGENT 自定义价值 |
|---|---|---|---|---|
| B1 | **键位绑定** | `keybindings.ts`（86 行）+ `shortcuts.ts`（573 行，`SHORTCUTS` 常量表，`ShortcutDef` 已带 `scope: global/local` 结构） | `user/keybindings.json`：按键 → 命令映射，支持全局/局部作用域、禁用、重映射 | 改键位文件即重映射；**依赖按键分发层重接线（见第 3 项 §4.4）** |
| B2 | **菜单结构** | 菜单项常量在 `src/lib/paneHeaderMenu.ts`（PANE/EXPORT/AI_PANE 三表） | `user/menus.json`：菜单分组与项的增删排序、启用/停用 | AGENT 增删/排序菜单项 |
| B5 | **胶囊工具条** | 胶囊按钮集是代码常量（`capsule-toolbar.ts`）；`selectionToolbar: "roulette"|"capsule"` 切换已存在 | `user/capsules.json` | AGENT 配置胶囊按钮（注：`slots` 即 B4 已文件化的 HTML 工具条，两者不可混为一谈） |
| B6 | **图标注册表** | `src/ui/icons.ts`（711 行）+ `src/editors/icons.ts`（803 行），代码常量 | `user/icons.json`：概念 → 图标路径映射 | AGENT 替换/新增图标 |
| B7 | **视图规格独立文件** | 已并入 `settings.json` 顶层四字段。**勘误**：omarchy-inventory 明确「独立视图文件从未实现、四字段是实现选择而非欠账」 | 抽出独立 `user/view-specs.json` | AGENT 直接改视图布局。**需先裁决为何现在要改**（见 §5.6） |
| B8 | **导出配置** | 导出菜单是代码常量（6 项，`paneHeaderMenu.ts`），**无任何持久化导出设置**（`exportFormat` 零命中） | `user/export.json`：格式清单、默认格式、选项开关 | AGENT 自定义导出格式选项与默认 |
| B9 | **阅读预设** | `readerFontSize` 是数值型（非字体族字符串），无预设集合 | `user/reader-presets.json`：字号/宽度/皮肤预设集合 | AGENT 增加阅读预设，一键切换 |
| B10 | **新建文档默认** | `defaultNewDocFormat` 不存在；相近字段是 `defaultSavePath` | `user/newdoc.json`：默认保存路径、默认模板、默认 frontmatter | AGENT 自定义新文档模板与默认路径 |
| B11 | **捕获配置归一** | 当前落点 `~/.biaoyue/config.toml`（TOML，三层目录之外） | 是否迁入 `user/capture.json` 纳入统一体系 | AGENT 统一管理捕获配置（需先裁决迁移立场） |

### C 档：不文件化（明确不做）

| # | 功能 | 不文件化理由 |
|---|---|---|
| C1 | **API 密钥 / 密钥类** | 密钥永不文件化（ADR 0005）；apiKey 仅内存走 keyring |
| C2 | **编辑器运行时状态**（undo/选区、CM6 实例） | 运行时状态归 `editorRef.ts` 模块级 Map，不进数据文件 |
| C3 | **模式切换/渲染管线运行时开关** | 由 `capabilities` 统一管理，是运行时行为 |
| C4 | **执行代码的能力** | 数据文件不执行用户代码（与插件方案 C 档一致） |

## 5. 设计实现方案

### 5.1 目录约定（终态布局，标注为「终态」避免与「无消费者不建目录」纪律打架）

```
defaults/settings.json        内置默认（随包）
user/
  settings.json               用户覆盖（核心设置，热应用）
  keybindings.json            键位映射（B1，map 型）
  menus.json                  菜单结构（B2，list 型）
  capsules.json               胶囊工具条（B5，list 型）
  icons.json                  图标映射（B6，map 型）
  view-specs.json             视图规格（B7，待裁决）
  export.json                 导出配置（B8）
  reader-presets.json         阅读预设（B9）
  newdoc.json                 新文档默认（B10）
  capture.json                捕获配置（B11，待裁决迁移）
state/state.json              运行时派生（recentFiles/scrollPositions/embedScrollPositions）
snapshots/settings-*.json     快照
app_config_dir 根：snippets/ templates/ theme.toml   扩展点（用户层，不在 user/ 子目录）
```

**纪律**：上表为终态布局，每个文件在它的第一个消费者落地时才创建，不为「未来可能用到」提前建。

### 5.2 合并语义（分型，已校正）

按文件结构分两类，**不可一刀切**：

| 类型 | 适用文件 | 合并语义 | 依据 |
|---|---|---|---|
| **map 型** | `keybindings.json`、`icons.json` | **逐键深合并**（键是命令 id / 概念名，天然支持逐键覆盖） | `merge_json` 现状语义；`ShortcutDef` 已是 id 键控结构 |
| **list 型** | `menus.json`、`capsules.json` | **整体覆盖 + 未知 id 过滤**（顺序即语义，整体替换合理；过滤未知 id 容错） | 照抄 `slots.ts:resolveToolbarOrder` 既有容错范式（本仓现成正确范式）；`merge_json` 对数组本就是整体替换 |

**注**：方案原称「声明式覆盖避免部分覆盖导致结构不完整」的论证与现状 `merge_json` 对数组整体替换的语义重复，已去除。

### 5.3 热重载（写实，已校正）

**现状**：唯一热重载是 `spawn_config_watcher`，只盯 `user/settings.json` 的 (mtime,len)（`config.rs:1083-1106`）。B 档任何新文件改动都不触发 `config-changed`。

**设计**：
- **`settings.json` 热应用**（既有 watcher）。
- **B 档文件重启生效**（成本最低，优先选此）。不补每个 B 档文件的 watcher——除非评审后明确需要，否则不为每个文件新增 watcher 设计。

### 5.4 验证门（加载端契约，已校正）

AGENT 直改文件不走写侧校验，**验证门只能落在加载端**：

- 每个 B 档文件规定**加载端契约**：加载失败/非法时的语义——**回退默认 + 聚合告警**（对齐 `theme.toml` 的白名单过滤纪律）。
- **未知键防线（根因）**：`AppConfig` 当前无 `deny_unknown_fields`，`patch_config` 会**静默吞掉未知键**（`config.rs` grep 零命中）。这是 R2 的根——AGENT 照着错清单写无效字段却不可见。**必须给 `AppConfig` 加 `deny_unknown_fields` 或在 patch 入口拒绝未知键**，方案的校验门承诺依赖此防线。
- **快照覆盖范围**：现 `snapshot_user` 只覆盖 `settings.json`。明确 B 档文件是否进快照——建议 B 档文件不进快照（重启生效、结构简单），或扩展 `snapshot_user`，实现时定。

### 5.5 AGENT 自定义路径（核心价值，已校正）

**现状**：AGENT 只有 `read_config` / `patch_config` / `list_snapshots` 三工具（`ai_agent.rs:708`），`patch_config` 只写 `settings.json`。B 档「AGENT 直写 `user/*.json`」意味着每批需新增 loader、加载端校验、（可选）watcher、快照覆盖。

**完整链路**：

```
用户说「帮我把导出默认改成 PDF，把 X 快捷键改成 Ctrl+Shift+D」
  → AGENT 识别目标功能域（export / keybindings）
  → AGENT 读取对应 user/ 数据文件（或 defaults 兜底）
  → AGENT 校验字段合法性（依赖 deny_unknown_fields 防线）
  → AGENT 写入 user/ 对应文件
  → 重启生效（B 档）/ 热应用（settings.json）
```

**AGENT 可见性载体**：`SKILL_MAP`（`config.rs:977-1031`，`seed_skill_map`）是既有 AGENT 可见性载体。清单登记 + AGENT 可见性落在 SKILL_MAP，让 AGENT 知道有哪些文件可改、字段含义。

### 5.6 B7 视图规格独立文件（裁决）

omarchy-inventory 勘误明确：「独立视图文件从未实现、四字段是实现选择而非欠账」。本方案重提独立文件，**必须先给独立理由**：

- 若理由是「让 AGENT 直接改视图布局、与 settings.json 解耦便于备份迁移」——成立，但需写明旧字段迁移策略、并存优先级、UI 写路径改造点（`paneLayout` 是序列化 JSON 字符串，改存储位即改格式）。
- 若无独立理由——**B7 保留现状，不抽独立文件**。

评审裁定：**保留现状优先**，除非实现时给出充分独立理由。

### 5.7 捕获配置归一（裁决）

捕获配置当前落点 `~/.biaoyue/config.toml`（TOML），**在三层目录体系之外，是两个世界**。

- 若纳入统一管理——迁入 `user/capture.json`，需迁移与兼容。
- 若保持独立——明确声明捕获配置是独立体系，不纳入三层目录，AGENT 通过专用工具管理。

评审裁定：**保持独立体系优先**，避免为归一引入迁移成本；在清单中显式标注其独立落点。

### 5.8 根因缺陷修复（必须处理，方案已收敛）

**现状缺陷（确认属实）**：`apply_patch_at`（`config.rs:949-976`）只读 user 层、**从不读 `state.json`**；`config` 从 user+patch 反序列化，`recent_files=None` → `state_value` 输出空默认值并 `atomic_write` 覆盖磁盘 `state.json`，**清空 `recentFiles`/`scrollPositions`/`embedScrollPositions`**。每次调用都清空，无单测覆盖。

**收敛后的修复方案（选定）**：**删除 `apply_patch_at` 的 state 写入**——`apply_patch_at` 本身无状态语义，直接删掉其 state 写入即可。`save_config` 的状态由前端实时值维护（`useConfig.ts:185-192` 已显式读实时 store 防陈旧）。

**附带修正**：`apply_patch_at` 返回值是修复前 `load_config_at`（含磁盘旧 state），AGENT 验证时看到的是已被清空前的假数据、磁盘却是空的——修复时一并修正返回值语义。

**测试要求（明确）**：构造含 `state.json` 的目录 → 调用 `apply_patch_at` → 断言 `state.json` **字节不变**。当前零覆盖，必须补。

## 6. 分批实施路线（已按校正事实调整）

每批一个 OpenSpec change（G0–G4），每批注明按 data-surface 六栏契约落表：

1. **第一批（根因修复）**：删 `apply_patch_at` 的 state 写入 + 修正返回值语义 + 补单测（断言 state.json 字节不变）。**这是后续数据文件化的前提**。
2. **第二批（核心文件化）**：B1 键位、B6 图标、B8 导出配置（B7 视图规格按 §5.6 裁决，若无独立理由则不抽）。
3. **第三批（配置面文件化）**：B2 菜单、B5 胶囊工具条（B3 轮盘扇区、B4 工具条按钮已文件化，仅需 A 档登记收尾，不重做）。
4. **第四批（体验类文件化）**：B9 阅读预设、B10 新文档默认。B11 捕获配置按 §5.7 裁决（保持独立则不迁）。

## 7. 对抗评审记录

**评审方**：独立只读评审子代理（注：用户指定 codex CLI，实测 codex 未登录且登录进行中；为不阻塞，先以独立评审子代理完成对抗评审，codex 登录完成后补跑）。

**总体判定**：需修订（已按意见全部修订）。

**主要意见与处置**：

1. **基线文件路径错误（settings.rs/state.rs/capabilities.rs 不存在，实际 config.rs；stores 在 src/stores/）** → 已采纳，§顶部事实基线校正。
2. **A 档清单字段名大量虚构（reader.font/export.format/prefs.*/ai.style 等不存在）** → 已采纳，§4 A 档按真实字段重写。
3. **B3 轮盘扇区、B4 工具条按钮实际已文件化** → 已采纳，移入 A 档登记，批 3 减负。
4. **B5 混淆 slots 与 HTML 工具条** → 已采纳，§4 B5 澄清。
5. **B8/B9/B10/B11 前提错误** → 已采纳，按真实字段/落点重写。
6. **合并语义一刀切** → 已采纳，§5.2 分 map 型/list 型。
7. **热重载承诺过头** → 已采纳，§5.3 写实为 settings.json 热应用、B 档重启生效。
8. **验证门无承载** → 已采纳，§5.4 落加载端契约 + deny_unknown_fields 防线。
9. **B7 未引用勘误、立场冲突** → 已采纳，§5.6 裁决，保留现状优先。
10. **5.6 修复方案收敛** → 已采纳，§5.8 选定删 state 写入 + 修正返回值 + 明确测试。
11. **AGENT 通路断裂、SKILL_MAP 未点名** → 已采纳，§5.5 补齐。
12. **§5.1 目录树漏扩展点、与纪律打架** → 已采纳，§5.1 标注终态布局。

**可保留**：B1/B2/B6 提取方向与目标文件设计；三层目录与快照底座；分批路线「根因优先、按消费者分批」结构。

exec
/bin/zsh -lc 'rg -n "config_base|merge_json|apply_patch_at|save_config|patch_config|snapshot_user|spawn_config_watcher|SKILL_MAP|seed_skill_map|deny_unknown_fields|recent_files|scroll_positions|embed_scroll_positions|state_value|load_config_at" src-tauri/src/config.rs src-tauri/src/commands/config_cmd.rs' in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src-tauri/src/commands/config_cmd.rs:16:pub async fn save_config(app: AppHandle, config: AppConfig) -> Result<(), AppError> {
src-tauri/src/commands/config_cmd.rs:17:    config::save_config(&app, &config).await
src-tauri/src/commands/config_cmd.rs:59:    Ok(crate::extensions::scan_extensions(&config::config_base(
src-tauri/src/config.rs:37:    pub recent_files: Option<Vec<RecentFile>>,
src-tauri/src/config.rs:38:    pub scroll_positions: Option<HashMap<String, ScrollPosition>>,
src-tauri/src/config.rs:41:    pub embed_scroll_positions: Option<HashMap<String, ScrollPosition>>,
src-tauri/src/config.rs:235:            recent_files: Some(Vec::new()),
src-tauri/src/config.rs:236:            scroll_positions: Some(HashMap::new()),
src-tauri/src/config.rs:237:            embed_scroll_positions: Some(HashMap::new()),
src-tauri/src/config.rs:346:fn merge_json(defaults: &Value, user: &Value) -> Value {
src-tauri/src/config.rs:352:                    Some(existing) => merge_json(existing, value),
src-tauri/src/config.rs:407:fn state_value(config: &AppConfig) -> Result<Value, AppError> {
src-tauri/src/config.rs:408:    let recent_files = serde_json::to_value(config.recent_files.clone().unwrap_or_default())
src-tauri/src/config.rs:410:    let scroll_positions =
src-tauri/src/config.rs:411:        serde_json::to_value(config.scroll_positions.clone().unwrap_or_default())
src-tauri/src/config.rs:413:    let embed_scroll_positions =
src-tauri/src/config.rs:414:        serde_json::to_value(config.embed_scroll_positions.clone().unwrap_or_default())
src-tauri/src/config.rs:417:        "recentFiles": recent_files,
src-tauri/src/config.rs:418:        "scrollPositions": scroll_positions,
src-tauri/src/config.rs:419:        "embedScrollPositions": embed_scroll_positions,
src-tauri/src/config.rs:428:    let mut merged = merge_json(&defaults, user.as_ref().unwrap_or(&Value::Null));
src-tauri/src/config.rs:453:    let state = serde_json::to_vec_pretty(&state_value(&config)?)
src-tauri/src/config.rs:771:fn snapshot_user(base: &Path) -> Result<(), AppError> {
src-tauri/src/config.rs:826:    snapshot_user(base)?;
src-tauri/src/config.rs:829:    load_config_at(base)
src-tauri/src/config.rs:834:pub fn load_config_at(base: &Path) -> Result<AppConfig, AppError> {
src-tauri/src/config.rs:840:    let defaults = merge_json(&code_defaults, &file_defaults);
src-tauri/src/config.rs:846:pub fn save_config_at(base: &Path, config: &AppConfig) -> Result<(), AppError> {
src-tauri/src/config.rs:849:    snapshot_user(base)?;
src-tauri/src/config.rs:853:        serde_json::to_vec_pretty(&state_value(config)?).map_err(|e| json_err("state", e))?;
src-tauri/src/config.rs:862:/// 顺序：读 user（缺失按 `{}`）→ `merge_json` 深合并 → 反序列化 → 校验 →
src-tauri/src/config.rs:864:pub fn apply_patch_at(base: &Path, patch: &Value) -> Result<AppConfig, AppError> {
src-tauri/src/config.rs:874:    let merged = merge_json(&current_user, patch);
src-tauri/src/config.rs:879:    snapshot_user(base)?;
src-tauri/src/config.rs:883:        serde_json::to_vec_pretty(&state_value(&config)?).map_err(|e| json_err("state", e))?;
src-tauri/src/config.rs:888:    load_config_at(base)
src-tauri/src/config.rs:892:pub fn seed_skill_map(app: &AppHandle) {
src-tauri/src/config.rs:893:    let path = config_base(app)
src-tauri/src/config.rs:900:    if let Err(e) = atomic_write(&path, SKILL_MAP.as_bytes()) {
src-tauri/src/config.rs:905:const SKILL_MAP: &str = r#"# Biaoyue 配置地图
src-tauri/src/config.rs:912:| user | `user/settings.json` | 用户设置，`patch_config` 写这里 |
src-tauri/src/config.rs:919:- `patch_config`：`{"patch": {...}}`，深合并进 user 层，写入前校验并生成快照；非法值不落盘。
src-tauri/src/config.rs:946:pub fn config_base(app: &AppHandle) -> PathBuf {
src-tauri/src/config.rs:976:    let base = config_base(app);
src-tauri/src/config.rs:978:    load_config_at(&base)
src-tauri/src/config.rs:982:pub async fn save_config(app: &AppHandle, config: &AppConfig) -> Result<(), AppError> {
src-tauri/src/config.rs:983:    save_config_at(&config_base(app), config)
src-tauri/src/config.rs:987:    list_snapshots(&config_base(app))
src-tauri/src/config.rs:991:    restore_snapshot(&config_base(app), name)
src-tauri/src/config.rs:996:pub fn spawn_config_watcher(app: AppHandle) {
src-tauri/src/config.rs:997:    let path = user_path(&config_base(&app));
src-tauri/src/config.rs:1088:        let config = load_config_at(base).unwrap();
src-tauri/src/config.rs:1101:        config.recent_files = Some(vec![RecentFile {
src-tauri/src/config.rs:1108:        save_config_at(base, &config).unwrap();
src-tauri/src/config.rs:1121:        assert_eq!(load_config_at(base).unwrap().recent_files.unwrap().len(), 1);
src-tauri/src/config.rs:1161:        let err = save_config_at(base, &config).unwrap_err();
src-tauri/src/config.rs:1214:            save_config_at(base, &config).unwrap();
src-tauri/src/config.rs:1236:        save_config_at(base, &config).unwrap();
src-tauri/src/config.rs:1239:        save_config_at(base, &config).unwrap();
src-tauri/src/config.rs:1245:        save_config_at(base, &config).unwrap();
src-tauri/src/config.rs:1286:        let config = load_config_at(base).unwrap();
src-tauri/src/config.rs:1289:        assert_eq!(config.recent_files.as_ref().unwrap().len(), 1);
src-tauri/src/config.rs:1298:        let again = load_config_at(base).unwrap();
src-tauri/src/config.rs:1307:        load_config_at(base).unwrap();
src-tauri/src/config.rs:1313:        let config = load_config_at(base).unwrap();
src-tauri/src/config.rs:1324:    fn state_layer_supplies_recent_files() {
src-tauri/src/config.rs:1335:        let config = load_config_at(base).unwrap();
src-tauri/src/config.rs:1337:        let recent = config.recent_files.unwrap();
src-tauri/src/config.rs:1343:    fn embed_scroll_positions_round_trip_and_stay_out_of_user_file() {
src-tauri/src/config.rs:1349:        assert!(load_config_at(base)
src-tauri/src/config.rs:1351:            .embed_scroll_positions
src-tauri/src/config.rs:1356:        config.embed_scroll_positions = Some(HashMap::from([(
src-tauri/src/config.rs:1363:        save_config_at(base, &config).unwrap();
src-tauri/src/config.rs:1372:        let loaded = load_config_at(base).unwrap();
src-tauri/src/config.rs:1373:        let table = loaded.embed_scroll_positions.unwrap();
src-tauri/src/config.rs:1386:        assert_eq!(load_config_at(base).unwrap().rail_view_spec, None);
src-tauri/src/config.rs:1395:        save_config_at(base, &config).unwrap();
src-tauri/src/config.rs:1401:        let loaded = load_config_at(base).unwrap().rail_view_spec.unwrap();
src-tauri/src/config.rs:1429:        assert_eq!(load_config_at(base).unwrap().rail_pin_hidden, None);
src-tauri/src/config.rs:1433:        save_config_at(base, &config).unwrap();
src-tauri/src/config.rs:1439:        assert_eq!(load_config_at(base).unwrap().rail_pin_hidden, Some(true));
src-tauri/src/config.rs:1442:        save_config_at(base, &config).unwrap();
src-tauri/src/config.rs:1443:        assert_eq!(load_config_at(base).unwrap().rail_pin_hidden, Some(false));
src-tauri/src/config.rs:1453:        assert_eq!(load_config_at(base).unwrap().preview_settings, None);
src-tauri/src/config.rs:1462:        save_config_at(base, &config).unwrap();
src-tauri/src/config.rs:1468:        let loaded = load_config_at(base).unwrap().preview_settings.unwrap();
src-tauri/src/config.rs:1496:        assert_eq!(load_config_at(base).unwrap().ai_view_spec, None);
src-tauri/src/config.rs:1516:        save_config_at(base, &config).unwrap();
src-tauri/src/config.rs:1522:        let loaded = load_config_at(base).unwrap().ai_view_spec.unwrap();
src-tauri/src/config.rs:1622:        let loaded = load_config_at(base).unwrap();
src-tauri/src/config.rs:1658:        assert_eq!(load_config_at(base).unwrap().notice_duration, None);
src-tauri/src/config.rs:1662:        save_config_at(base, &config).unwrap();
src-tauri/src/config.rs:1668:        assert_eq!(load_config_at(base).unwrap().notice_duration, Some(1.5));
src-tauri/src/config.rs:1672:        save_config_at(base, &config).unwrap();
src-tauri/src/config.rs:1682:        assert!(save_config_at(base, &config).is_err());
src-tauri/src/config.rs:1693:        assert_eq!(load_config_at(base).unwrap().heading_fonts, None);
src-tauri/src/config.rs:1705:        save_config_at(base, &config).unwrap();
src-tauri/src/config.rs:1711:        let loaded = load_config_at(base).unwrap().heading_fonts.unwrap();
src-tauri/src/config.rs:1744:        assert_eq!(load_config_at(base).unwrap().property_bar, None);
src-tauri/src/config.rs:1756:        save_config_at(base, &config).unwrap();
src-tauri/src/config.rs:1762:        let loaded = load_config_at(base).unwrap().property_bar.unwrap();
src-tauri/src/config.rs:1781:        assert!(save_config_at(base, &config).is_err());
src-tauri/src/config.rs:1798:        save_config_at(base, &config).unwrap();

exec
/bin/zsh -lc "rg --files src-tauri/src src docs/research/technical 2>/dev/null | rg '("'^src-tauri/src/(config|extensions|commands/(config_cmd|capture|ai_agent)|.*'"\\.rs)"'$)|(''^src/(hooks/useConfig'"\\.ts|stores/(index|editorStore)\\.ts|lib/(capabilities|keybindings)\\.ts|ui/icons\\.ts|editors/icons\\.ts|components/.*|editors/.*|lib/.*))|data-fileization-omarchy-inventory'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src-tauri/src/extensions.rs
docs/research/technical/data-fileization-omarchy-inventory.md
src-tauri/src/commands/file.rs
src-tauri/src/commands/capture.rs
src-tauri/src/commands/recent.rs
src-tauri/src/commands/search.rs
src-tauri/src/commands/directory.rs
src-tauri/src/commands/mod.rs
src-tauri/src/commands/translate.rs
src-tauri/src/commands/config_cmd.rs
src-tauri/src/commands/ai_agent_cmd.rs
src-tauri/src/main.rs
src-tauri/src/fonts.rs
src-tauri/src/errors.rs
src-tauri/src/validation.rs
src-tauri/src/ai_agent.rs
src-tauri/src/lib.rs
src-tauri/src/extension_packages.rs
src-tauri/src/config.rs
src-tauri/src/media_protocol.rs
src-tauri/src/types.rs
src/stores/index.ts
src/stores/editorStore.ts
src/lib/assetSrc.ts
src/lib/finder.ts
src/lib/aiErrors.ts
src/lib/pdfThumb.ts
src/lib/frontmatter.ts
src/editors/editorRef.ts
src/editors/callout-types.ts
src/editors/slash.ts
src/editors/keybindings.ts
src/editors/icons.ts
src/lib/export/docx.ts
src/lib/export/base64.ts
src/lib/export/exportDocument.ts
src/lib/export/html.ts
src/lib/export/pdf.ts
src/lib/export/png.ts
src/lib/export/zip.ts
src/lib/export/inlineImages.ts
src/lib/export/mdpkg.ts
src/lib/paneTree.ts
src/lib/shortcuts.ts
src/lib/gridKeyboard.ts
src/lib/propertyBarConfig.ts
src/lib/railView.ts
src/lib/fileType.ts
src/lib/selectionPillMode.ts
src/lib/mediaUrl.ts
src/ui/icons.ts
src/editors/smart-input.ts
src/editors/user-extensions.ts
src/editors/block-model.ts
src/editors/orchestration/block-convert.ts
src/editors/orchestration/capsule-toolbar.ts
src/editors/orchestration/roulette.ts
src/editors/orchestration/block-actions.ts
src/editors/orchestration/placement.ts
src/editors/orchestration/menu-stack.ts
src/editors/orchestration/commands.ts
src/editors/orchestration/toolbar-shared.ts
src/editors/orchestration/menu-metrics.ts
src/editors/orchestration/color-palette.ts
src/editors/orchestration/block-menu.ts
src/editors/orchestration/slots.ts
src/editors/key-chord.ts
src/editors/orchestration/anchor.ts
src/editors/orchestration/block-color.ts
src/editors/slash-filter.ts
src/editors/orchestration/block-handle.ts
src/editors/orchestration/horizontal-toolbar.ts
src/editors/orchestration/roulette-view.ts
src/editors/orchestration/block-alignment.ts
src/editors/orchestration/hover-gate.ts
src/editors/orchestration/floating-toolbar.ts
src/lib/headingFonts.ts
src/lib/paneDrop.ts
src/lib/printPreview.ts
src/lib/aiViewSpec.ts
src/lib/exportActions.ts
src/lib/fileInfo.ts
src/lib/overlayGate.ts
src/lib/mdpkg/vendor/mdpkg-web.d.ts
src/lib/mdpkg/vendor/mdpkg-web.js
src/lib/mdpkg/index.ts
src/lib/extensions/bundle.ts
src/lib/extensions/templates.ts
src/lib/extensions/theme-tokens.ts
src/lib/gridView.ts
src/lib/providers.ts
src/lib/paneAutoLayout.ts
src/lib/outline.ts
src/lib/capabilities.ts
src/lib/paneHeaderMenu.ts
src/lib/mediaPicker.ts
src/lib/previewAnchor.ts
src/lib/readerWidth.ts
src/lib/quickOpen.ts
src/lib/railCards.ts
src/hooks/useConfig.ts
src/editors/setup.ts
src/editors/decorations/cell-selection.ts
src/editors/decorations/imageCrop.ts
src/editors/decorations/link.ts
src/editors/decorations/callout-emoji.ts
src/editors/decorations/callout-insert.ts
src/editors/decorations/list.ts
src/editors/decorations/boldItalic.ts
src/editors/decorations/theme.ts
src/editors/decorations/structuralTagPattern.ts
src/editors/decorations/index.ts
src/editors/decorations/mermaid.ts
src/editors/decorations/quote.ts
src/editors/decorations/imageToolbar.ts
src/editors/decorations/code.ts
src/editors/decorations/structuralTags.ts
src/editors/decorations/hr.ts
src/editors/decorations/heading.ts
src/editors/decorations/columns.ts
src/editors/decorations/cell-text.ts
src/editors/decorations/block-dom.ts
src/editors/decorations/math.ts
src/editors/decorations/composition.ts
src/editors/decorations/table.ts
src/editors/decorations/callout.ts
src/editors/decorations/alignFence.ts
src/editors/decorations/image.ts
src/editors/decorations/fold.ts
src/editors/decorations/fileEmbed.ts
src/editors/html/bridge.ts
src/editors/html/edit.ts
src/editors/html/runtime.ts
src/editors/html/model.ts
src/editors/html/capture.ts
src/editors/html/undoStack.ts
src/components/Grid/GridToolbar.tsx
src/components/Grid/GridTile.tsx
src/components/ErrorBoundary.tsx
src/components/TabBar.tsx
src/components/GridView.tsx
src/components/Preview/FloatingPreview.tsx
src/components/Rail/ReadingRail.tsx
src/components/BiaoyueIcon.tsx
src/components/ai/CommandOverlay.tsx
src/components/ai/UndoBar.tsx
src/components/ai/SelectionPill.tsx
src/components/ai/AiDockedPane.tsx
src/components/ai/SnapshotPanel.tsx
src/components/ai/DiffView.tsx
src/components/ai/AiConversation.tsx
src/components/ai/AiBubble.tsx
src/components/StatusBar.tsx
src/components/ContextMenu.tsx
src/components/TemplatePicker.tsx
src/components/CaptureOverlay.tsx
src/components/QuickOpen.tsx
src/components/TabInfoPopover.tsx
src/components/ShortcutOverlay.tsx
src/components/TooltipLayer.tsx
src/components/SettingsView.tsx
src/components/PortalView.tsx
src/components/Icon.tsx
src/components/Content/OutlineMenu.tsx
src/components/Content/pdfToolbarPin.ts
src/components/Content/PaneDivider.tsx
src/components/Content/HtmlRangeToolbar.tsx
src/components/Content/ReadingProgressInk.tsx
src/components/Content/HtmlVisualEditor.tsx
src/components/Content/PaneTreeView.tsx
src/components/Content/VideoPlayer.tsx
src/components/Content/PdfViewer.tsx
src/components/Content/DocPropertyBar.tsx
src/components/Content/HtmlPreview.tsx
src/components/Content/ContentArea.tsx
src/components/Content/mediaIndex.ts
src/components/Content/PreviewView.tsx
src/components/Content/SuggestMenu.tsx
src/components/Content/mediaPlayerState.ts
src/components/Content/ContentSplitView.tsx
src/components/Content/MediaPlayerHost.tsx
src/components/Content/mediaMute.ts
src/components/Content/SplitResizeHandle.tsx
src/components/Content/HtmlEditToolbar.tsx

exec
/bin/zsh -lc "rg -n \"readerFontSize|readerWidth|readerSkin|railViewSpec|previewSettings|aiViewSpec|paneLayout|openaiEndpoint|openaiModel|ollamaEndpoint|translationProvider|langPair|capabilities|theme\\.toml|rouletteSectors|htmlToolbarItems|slots|selectionToolbar|capsule|defaultSavePath|defaultNewDocFormat|exportFormat|state\\.json|scrollPositions|embedScrollPositions|recentFiles\" src-tauri/src src | head -n 400" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src-tauri/src/extensions.rs:86:/// 把 `theme.toml` 里的键规范化成 `--app-<name>`。
src-tauri/src/extensions.rs:314:/// 读取 `<dir>/theme.toml` 的 `[tokens]` 表，白名单校验键与值。
src-tauri/src/extensions.rs:316:    let path = dir.join("theme.toml");
src-tauri/src/extensions.rs:325:                warnings: vec![format!("theme.toml: 读取失败（{e}）")],
src-tauri/src/extensions.rs:354:        Ok(_) => warnings.push("theme.toml: 顶层不是表".into()),
src-tauri/src/extensions.rs:355:        Err(e) => warnings.push(format!("theme.toml: 解析失败（{e}）")),
src-tauri/src/extensions.rs:359:        warnings.push(format!("theme.toml: 忽略 {invalid} 个非法 token"));
src-tauri/src/extensions.rs:506:            "theme.toml",
src-tauri/src/extensions.rs:541:            "theme.toml",
src-tauri/src/extensions.rs:577:            "theme.toml",
src-tauri/src/extensions.rs:600:            "theme.toml",
src/lib/aiErrors.ts:17:  readerFontSize: "阅读字号需要在 8–96 之间",
src/lib/aiErrors.ts:18:  readerWidth: "阅读区宽度需要在 480–1400 之间",
src/lib/aiErrors.ts:24:  readerSkin: "阅读皮肤只能选纸感或素雅",
src-tauri/src/commands/capture.rs:457:    pub capsule_x: Option<f64>,
src-tauri/src/commands/capture.rs:458:    pub capsule_y: Option<f64>,
src-tauri/src/commands/capture.rs:523:    if let Some(cx) = capture_config.capsule_x {
src-tauri/src/commands/capture.rs:524:        capture.insert("capsule_x".to_string(), toml::Value::Float(cx));
src-tauri/src/commands/capture.rs:526:    if let Some(cy) = capture_config.capsule_y {
src-tauri/src/commands/capture.rs:527:        capture.insert("capsule_y".to_string(), toml::Value::Float(cy));
src-tauri/src/commands/capture.rs:612:            capsule_x: None,
src-tauri/src/commands/capture.rs:613:            capsule_y: None,
src-tauri/src/commands/capture.rs:641:    let capsule_x = doc
src-tauri/src/commands/capture.rs:643:        .and_then(|c: &toml::Value| c.get("capsule_x"))
src-tauri/src/commands/capture.rs:645:    let capsule_y = doc
src-tauri/src/commands/capture.rs:647:        .and_then(|c: &toml::Value| c.get("capsule_y"))
src-tauri/src/commands/capture.rs:672:        capsule_x,
src-tauri/src/commands/capture.rs:673:        capsule_y,
src/lib/quickOpen.ts:49:  recentFiles: RecentFile[],
src/lib/quickOpen.ts:73:  for (const file of recentFiles) {
src/lib/extensions/theme-tokens.ts:3: * `theme.toml` 的 `[tokens]` 经 IPC 传到前端后**再校验一遍**（不信任 IPC 输入）：
src/lib/extensions/theme-tokens.ts:38: * 把 `theme.toml` 里的键规范化成 `--app-<name>`。
src-tauri/src/commands/config_cmd.rs:56:/// Scan user extension directories (snippets / templates / theme.toml).
src/types/index.ts:3:import type { ViewSpec } from "../lib/aiViewSpec";
src/types/index.ts:69:  readerFontSize: number;
src/types/index.ts:71:  readerWidth: number;
src/types/index.ts:73:  defaultSavePath?: string | null;
src/types/index.ts:75:  selectionToolbar?: "roulette" | "capsule";
src/types/index.ts:77:  readerSkin: string;
src/types/index.ts:78:  ollamaEndpoint: string;
src/types/index.ts:79:  openaiEndpoint: string;
src/types/index.ts:80:  openaiModel: string;
src/types/index.ts:81:  translationProvider: TranslationProvider;
src/types/index.ts:82:  langPair: LangPair;
src/types/index.ts:92:  recentFiles: RecentFile[];
src/types/index.ts:93:  scrollPositions: Record<string, ScrollPosition>;
src/types/index.ts:96:   * 与 `scrollPositions` 同类结构，持久化在 state 层；不含用户可配置项。
src/types/index.ts:98:  embedScrollPositions: Record<string, ScrollPosition>;
src/types/index.ts:100:  capabilities?: Record<string, boolean>;
src/types/index.ts:104:  rouletteSectors?: string[] | null;
src/types/index.ts:113:  /** 横向工具条动作集合与顺序；null/缺省 = 内置 12 项（ui-toolbar-slots 1.1） */
src/types/index.ts:114:  htmlToolbarItems?: string[] | null;
src/types/index.ts:116:  paneLayout?: string | null;
src/types/index.ts:119:  /** AI 视图改写规格（layout-portal 9.1）：持久化到 Rust `aiViewSpec` */
src/types/index.ts:120:  aiViewSpec?: ViewSpec | null;
src/types/index.ts:127:export type CaptureStatus = "closed" | "normal" | "pinned" | "capsule";
src/main.tsx:81:      // Overlay double-click top bar → show capsule in main window
src/main.tsx:82:      listen("overlay-to-capsule", () => {
src/components/TabBar.tsx:539:                    ? "tab-capsule rounded-full bg-[var(--app-accent-soft)] font-medium text-[var(--app-text-strong)]"
src/App.tsx:190:          defaultDir: useEditorStore.getState().config.defaultSavePath ?? null,
src/App.tsx:358:      // 编辑态与阅读态共用一个字号：readerFontSize 驱动 --type-font-size，
src/App.tsx:365:      editorStore.setConfig({ readerFontSize: applied });
src/App.tsx:844:  const scrollPositions = useStore((s) => s.scrollPositions);
src/App.tsx:845:  const embedScrollPositions = useStore((s) => s.embedScrollPositions);
src/App.tsx:848:  }, [scrollPositions, embedScrollPositions, scheduleSave]);
src/App.tsx:942:            useEditorStore.getState().setConfig({ readerWidth: w });
src/components/StatusBar.tsx:15:} from "../lib/readerWidth";
src/components/StatusBar.tsx:107:  const scrollPositions = useStore((s) => s.scrollPositions);
src/components/StatusBar.tsx:108:  const readerWidth = useEditorStore((s) => s.config.readerWidth ?? 1080);
src/components/StatusBar.tsx:115:    ? readPercentOf(scrollPositions[activeTab.path])
src/components/StatusBar.tsx:298:            title={`页面宽度 ${readerWidth}px`}
src/components/StatusBar.tsx:306:            {readerWidth}px
src/components/StatusBar.tsx:331:                      aria-pressed={readerWidth === opt.value}
src/components/StatusBar.tsx:336:                      className={`width-bar ${readerWidth === opt.value ? "is-active" : ""}`}
src/components/StatusBar.tsx:348:                  value={Math.min(READER_WIDTH_MAX, readerWidth)}
src/components/TabInfoPopover.tsx:106:      ? s.recentFiles.find((f) => f.path === tab.path)?.openedAt
src-tauri/src/config.rs:43:    pub capabilities: Option<HashMap<String, bool>>,
src-tauri/src/config.rs:65:    /// 横向工具条动作集合与顺序（ui-toolbar-slots 1.1）。缺省 = 内置默认。
src-tauri/src/config.rs:238:            capabilities: Some(HashMap::new()),
src-tauri/src/config.rs:269:const STATE_FILE: &str = "state.json";
src-tauri/src/config.rs:400:        map.remove("recentFiles");
src-tauri/src/config.rs:401:        map.remove("scrollPositions");
src-tauri/src/config.rs:402:        map.remove("embedScrollPositions");
src-tauri/src/config.rs:409:        .map_err(|e| json_err("recentFiles", e))?;
src-tauri/src/config.rs:412:            .map_err(|e| json_err("scrollPositions", e))?;
src-tauri/src/config.rs:415:            .map_err(|e| json_err("embedScrollPositions", e))?;
src-tauri/src/config.rs:417:        "recentFiles": recent_files,
src-tauri/src/config.rs:418:        "scrollPositions": scroll_positions,
src-tauri/src/config.rs:419:        "embedScrollPositions": embed_scroll_positions,
src-tauri/src/config.rs:430:        for key in ["recentFiles", "scrollPositions", "embedScrollPositions"] {
src-tauri/src/config.rs:557:    check_range("readerFontSize", config.reader_font_size, 8.0, 96.0)?;
src-tauri/src/config.rs:558:    check_range("readerWidth", config.reader_width, 480.0, 2400.0)?;
src-tauri/src/config.rs:584:        "readerSkin",
src-tauri/src/config.rs:590:            "railViewSpec.layout",
src-tauri/src/config.rs:595:            "railViewSpec.density",
src-tauri/src/config.rs:599:        check_range("railViewSpec.cardHeight", spec.card_height, 88.0, 160.0)?;
src-tauri/src/config.rs:603:            "previewSettings.gridMode",
src-tauri/src/config.rs:610:            "aiViewSpec.railLayout",
src-tauri/src/config.rs:615:            "aiViewSpec.railDensity",
src-tauri/src/config.rs:620:            "aiViewSpec.iconLabel",
src-tauri/src/config.rs:625:            "aiViewSpec.gridMode",
src-tauri/src/config.rs:630:            "aiViewSpec.gridGrouping",
src-tauri/src/config.rs:635:            "aiViewSpec.gridSort",
src-tauri/src/config.rs:640:            "aiViewSpec.railCardHeight",
src-tauri/src/config.rs:646:            "aiViewSpec.railPinnedWidth",
src-tauri/src/config.rs:652:            "aiViewSpec.pinnedSegmentScale",
src-tauri/src/config.rs:664:                context: "rouletteSectors".into(),
src-tauri/src/config.rs:672:                    context: "rouletteSectors".into(),
src-tauri/src/config.rs:678:                    context: "rouletteSectors".into(),
src-tauri/src/config.rs:729:                context: "htmlToolbarItems".into(),
src-tauri/src/config.rs:737:                    context: "htmlToolbarItems".into(),
src-tauri/src/config.rs:743:                    context: "htmlToolbarItems".into(),
src-tauri/src/config.rs:913:| state | `state/state.json` | 派生状态（recentFiles / scrollPositions / embedScrollPositions），不归 patch 管 |
src-tauri/src/config.rs:927:| `readerFontSize` | 8–96 |
src-tauri/src/config.rs:928:| `readerWidth` | 480–2400 |
src-tauri/src/config.rs:933:| `readerSkin` | `paper` / `plain` |
src-tauri/src/config.rs:937:| `openaiEndpoint` / `openaiModel` | 任意字符串 |
src-tauri/src/config.rs:942:- 不要手改 `state/state.json`；它由应用维护。
src-tauri/src/config.rs:1112:            !user.contains("recentFiles"),
src-tauri/src/config.rs:1113:            "user 层不应含 recentFiles: {user}"
src-tauri/src/config.rs:1116:            !user.contains("scrollPositions"),
src-tauri/src/config.rs:1117:            "user 层不应含 scrollPositions: {user}"
src-tauri/src/config.rs:1120:        assert!(state.contains("recentFiles"));
src-tauri/src/config.rs:1282:            r#"{"theme":"dark","fontSize":19.0,"recentFiles":[{"path":"/tmp/a.md","title":"a.md","openedAt":"2026-01-01T00:00:00Z"}],"scrollPositions":{}}"#,
src-tauri/src/config.rs:1292:        assert!(!user.contains("recentFiles"));
src-tauri/src/config.rs:1331:            r#"{"recentFiles":[{"path":"/tmp/b.md","title":"b.md","openedAt":"2026-01-02T00:00:00Z"}],"scrollPositions":{}}"#,
src-tauri/src/config.rs:1367:            !user.contains("embedScrollPositions"),
src-tauri/src/config.rs:1368:            "user 层不应含 embedScrollPositions: {user}"
src-tauri/src/config.rs:1371:        assert!(state.contains("embedScrollPositions"));
src-tauri/src/config.rs:1398:            user.contains("railViewSpec"),
src-tauri/src/config.rs:1399:            "user 层应含 railViewSpec: {user}"
src-tauri/src/config.rs:1465:            user.contains("previewSettings"),
src-tauri/src/config.rs:1466:            "user 层应含 previewSettings: {user}"
src-tauri/src/config.rs:1519:            user.contains("aiViewSpec"),
src-tauri/src/config.rs:1520:            "user 层应含 aiViewSpec: {user}"
src/components/SettingsView.tsx:14:} from "../lib/capabilities";
src/components/SettingsView.tsx:29:import { HTML_TOOLBAR_ITEMS } from "../editors/orchestration/slots";
src/components/SettingsView.tsx:36:} from "../lib/readerWidth";
src/components/SettingsView.tsx:610:  const [capabilities, setCapabilities] = useState(listCapabilities);
src/components/SettingsView.tsx:614:  const readerFontSize = useEditorStore((s) => s.config.readerFontSize ?? 17);
src/components/SettingsView.tsx:615:  const readerWidth = useEditorStore((s) => s.config.readerWidth ?? 1080);
src/components/SettingsView.tsx:616:  const selectionToolbar = useEditorStore(
src/components/SettingsView.tsx:617:    (s) => s.config.selectionToolbar ?? "roulette",
src/components/SettingsView.tsx:627:  const rouletteSectors = useEditorStore(
src/components/SettingsView.tsx:628:    (s) => s.config.rouletteSectors ?? null,
src/components/SettingsView.tsx:639:  const htmlToolbarItems = useEditorStore(
src/components/SettingsView.tsx:640:    (s) => s.config.htmlToolbarItems ?? null,
src/components/SettingsView.tsx:642:  const readerSkin = useEditorStore((s) => s.config.readerSkin ?? "paper");
src/components/SettingsView.tsx:643:  const defaultSavePath = useEditorStore(
src/components/SettingsView.tsx:644:    (s) => s.config.defaultSavePath ?? null,
src/components/SettingsView.tsx:647:  const openaiEndpoint = useEditorStore((s) => s.config.openaiEndpoint ?? "");
src/components/SettingsView.tsx:648:  const openaiModel = useEditorStore((s) => s.config.openaiModel ?? "");
src/components/SettingsView.tsx:672:  const previewSettings = useStore((s) => s.previewSettings);
src/components/SettingsView.tsx:831:    setConfig({ readerFontSize: size });
src/components/SettingsView.tsx:884:    setConfig({ readerWidth: width });
src/components/SettingsView.tsx:892:      setConfig({ defaultSavePath: dir });
src/components/SettingsView.tsx:900:    setConfig({ defaultSavePath: null });
src/components/SettingsView.tsx:907:    setConfig({ readerWidth: width });
src/components/SettingsView.tsx:914:  const chooseSelectionToolbar = (mode: "roulette" | "capsule") => {
src/components/SettingsView.tsx:915:    setConfig({ selectionToolbar: mode });
src/components/SettingsView.tsx:966:    rouletteSectors ?? ROULETTE_SECTOR_META.map((m) => m.id);
src/components/SettingsView.tsx:968:    setConfig({ rouletteSectors: next.length > 0 ? next : null });
src/components/SettingsView.tsx:989:    setConfig({ rouletteSectors: null });
src/components/SettingsView.tsx:994:    htmlToolbarItems ?? HTML_TOOLBAR_ITEMS.map((item) => item.id);
src/components/SettingsView.tsx:996:    setConfig({ htmlToolbarItems: next.length > 0 ? next : null });
src/components/SettingsView.tsx:1019:    setConfig({ htmlToolbarItems: null });
src/components/SettingsView.tsx:1024:    setConfig({ readerSkin: skin });
src/components/SettingsView.tsx:1064:      openaiEndpoint: preset.endpoint,
src/components/SettingsView.tsx:1065:      openaiModel: preset.defaultModel,
src/components/SettingsView.tsx:1243:                    const selected = readerFontSize === size;
src/components/SettingsView.tsx:1386:                      { value: "capsule", label: "胶囊" },
src/components/SettingsView.tsx:1393:                      aria-pressed={selectionToolbar === option.value}
src/components/SettingsView.tsx:1396:                        selectionToolbar === option.value
src/components/SettingsView.tsx:1638:                  {capabilities.map((capability) => (
src/components/SettingsView.tsx:1840:                    const selected = readerWidth === option.value;
src/components/SettingsView.tsx:1868:                      Math.max(READER_WIDTH_MIN, readerWidth),
src/components/SettingsView.tsx:1881:                    {readerWidth}px
src/components/SettingsView.tsx:1892:                    const selected = readerSkin === tone.id;
src/components/SettingsView.tsx:2152:                      value={openaiEndpoint}
src/components/SettingsView.tsx:2154:                        setConfig({ openaiEndpoint: e.target.value })
src/components/SettingsView.tsx:2167:                      value={openaiModel}
src/components/SettingsView.tsx:2169:                        setConfig({ openaiModel: e.target.value })
src/components/SettingsView.tsx:2254:                  title={defaultSavePath ?? ""}
src/components/SettingsView.tsx:2256:                  {defaultSavePath || "未设置（使用系统默认位置）"}
src/components/SettingsView.tsx:2271:                    disabled={!defaultSavePath}
src/components/SettingsView.tsx:2397:                    checked={previewSettings.railHover}
src/components/SettingsView.tsx:2415:                    const selected = previewSettings.gridMode === mode.value;
src/components/GridView.tsx:5:import { isUnread } from "../lib/aiViewSpec";
src/components/GridView.tsx:64:  const recentFiles = useStore((s) => s.recentFiles);
src/components/GridView.tsx:65:  const scrollPositions = useStore((s) => s.scrollPositions);
src/components/GridView.tsx:78:    const list = filterGridItems(recentFiles, {
src/components/GridView.tsx:85:      ? list.filter((f) => isUnread(f.path, scrollPositions))
src/components/GridView.tsx:88:    recentFiles,
src/components/GridView.tsx:94:    scrollPositions,
src/components/GridView.tsx:100:  const continuePath = recentFiles[0]?.path ?? null;
src/components/GridView.tsx:115:    (path: string): number | undefined => readPercentOf(scrollPositions[path]),
src/components/GridView.tsx:116:    [scrollPositions],
src/components/GridView.tsx:196:    const trigger = gridTriggerOf(st.previewSettings.gridMode);
src/components/GridView.tsx:197:    if (!st.previewSettings.enabled || !trigger.onClick) return false;
src/components/GridView.tsx:249:      if (!st.previewSettings.enabled) return;
src/components/GridView.tsx:250:      if (!gridTriggerOf(st.previewSettings.gridMode).onHover) return;
src/stores/index.ts:36:} from "../lib/aiViewSpec";
src/stores/index.ts:218:  scrollPositions: Record<string, ScrollPosition>;
src/stores/index.ts:220:  embedScrollPositions: Record<string, ScrollPosition>;
src/stores/index.ts:221:  recentFiles: RecentFile[];
src/stores/index.ts:281:  railViewSpec: RailViewSpec;
src/stores/index.ts:353:  paneLayoutJson: () => string;
src/stores/index.ts:385:  previewSettings: PreviewSettings;
src/stores/index.ts:435:  scrollPositions: {} as Record<string, ScrollPosition>,
src/stores/index.ts:436:  embedScrollPositions: {} as Record<string, ScrollPosition>,
src/stores/index.ts:437:  recentFiles: [] as RecentFile[],
src/stores/index.ts:467:  railViewSpec: { ...DEFAULT_RAIL_VIEW_SPEC },
src/stores/index.ts:470:  previewSettings: { ...DEFAULT_PREVIEW_SETTINGS },
src/stores/index.ts:510:        recentFiles: [
src/stores/index.ts:517:          ...state.recentFiles.filter((f) => f.path !== path),
src/stores/index.ts:567:      recentFiles: [
src/stores/index.ts:574:        ...state.recentFiles.filter((f) => f.path !== path),
src/stores/index.ts:754:    const { tabs, scrollPositions } = get();
src/stores/index.ts:767:      scrollPositions: { ...scrollPositions, ...scrollPatch },
src/stores/index.ts:772:    set({ scrollPositions: positions });
src/stores/index.ts:778:      embedScrollPositions: {
src/stores/index.ts:779:        ...s.embedScrollPositions,
src/stores/index.ts:786:    set({ embedScrollPositions: positions });
src/stores/index.ts:887:      const prev = s.recentFiles.find((f) => f.path === path);
src/stores/index.ts:888:      const filtered = s.recentFiles.filter((f) => f.path !== path);
src/stores/index.ts:897:      return { recentFiles: [entry, ...filtered].slice(0, 10) };
src/stores/index.ts:904:      recentFiles: mergeRecentFileList(s.recentFiles, incoming, 10),
src/stores/index.ts:908:  clearRecentFiles: () => set({ recentFiles: [] }),
src/stores/index.ts:1172:  paneLayoutJson: () => {
src/stores/index.ts:1237:    const recentFiles = [
src/stores/index.ts:1244:      ...state.recentFiles.filter((f) => f.path !== path),
src/stores/index.ts:1256:        recentFiles,
src/stores/index.ts:1280:      set({ tabs, recentFiles });
src/stores/index.ts:1300:      recentFiles,
src/stores/index.ts:1353:    const railViewSpec: RailViewSpec =
src/stores/index.ts:1361:    set({ railViewSpec });
src/stores/index.ts:1442:    set((s) => ({ previewSettings: { ...s.previewSettings, ...patch } })),
src/stores/index.ts:1446:      const enabled = !s.previewSettings.enabled;
src/stores/index.ts:1448:        previewSettings: { ...s.previewSettings, enabled },
src/stores/index.ts:1465:      previewSettings: { ...s.previewSettings, enabled: next.previewEnabled },
src/stores/index.ts:1484:      previewSettings: { ...s.previewSettings, enabled: next.previewEnabled },
src/stores/index.ts:1499:        previewEnabled: s.previewSettings.enabled,
src/components/QuickOpen.tsx:81:  const recentFiles = useStore((s) => s.recentFiles);
src/components/QuickOpen.tsx:107:    () => buildQuickItems(tabs, recentFiles, commands, query),
src/components/QuickOpen.tsx:108:    [tabs, recentFiles, commands, query],
src/components/CaptureOverlay.tsx:77:  const isCapsule = !IS_OVERLAY_WINDOW && store.status === "capsule";
src/components/CaptureOverlay.tsx:268:      // Tell main window to show capsule, then hide overlay
src/components/CaptureOverlay.tsx:271:          emit("overlay-to-capsule");
src/components/CaptureOverlay.tsx:419:      x: e.clientX - (store.capsuleX || window.innerWidth - 24 - 44),
src/components/CaptureOverlay.tsx:420:      y: e.clientY - (store.capsuleY || window.innerHeight - 24 - 44),
src/components/CaptureOverlay.tsx:449:      store.capsuleX === 0 ? window.innerWidth - 24 - 44 : store.capsuleX;
src/components/CaptureOverlay.tsx:451:      store.capsuleY === 0 ? window.innerHeight - 24 - 44 : store.capsuleY;
src/components/CaptureOverlay.tsx:453:      store.capsuleX === 0 && store.capsuleY === 0
src/hooks/useConfig.ts:20:} from "../lib/capabilities";
src/hooks/useConfig.ts:38:} from "../lib/aiViewSpec";
src/hooks/useConfig.ts:46:  readerFontSize: number | null;
src/hooks/useConfig.ts:47:  readerWidth: number | null;
src/hooks/useConfig.ts:48:  readerSkin: string | null;
src/hooks/useConfig.ts:49:  defaultSavePath?: string | null;
src/hooks/useConfig.ts:50:  ollamaEndpoint: string | null;
src/hooks/useConfig.ts:51:  openaiEndpoint: string | null;
src/hooks/useConfig.ts:52:  openaiModel: string | null;
src/hooks/useConfig.ts:53:  translationProvider: string | null;
src/hooks/useConfig.ts:65:  recentFiles: Array<{
src/hooks/useConfig.ts:71:  scrollPositions: Record<string, ScrollPosition> | null;
src/hooks/useConfig.ts:72:  embedScrollPositions: Record<string, ScrollPosition> | null;
src/hooks/useConfig.ts:73:  capabilities?: Record<string, boolean> | null;
src/hooks/useConfig.ts:74:  rouletteSectors?: string[] | null;
src/hooks/useConfig.ts:79:  htmlToolbarItems?: string[] | null;
src/hooks/useConfig.ts:80:  paneLayout?: string | null;
src/hooks/useConfig.ts:90:  railViewSpec?: {
src/hooks/useConfig.ts:95:  previewSettings?: {
src/hooks/useConfig.ts:100:  aiViewSpec?: {
src/hooks/useConfig.ts:152:    readerFontSize: es.config.readerFontSize ?? null,
src/hooks/useConfig.ts:153:    readerWidth: es.config.readerWidth ?? null,
src/hooks/useConfig.ts:154:    readerSkin: es.config.readerSkin ?? null,
src/hooks/useConfig.ts:155:    defaultSavePath: es.config.defaultSavePath ?? null,
src/hooks/useConfig.ts:156:    ollamaEndpoint: es.config.ollamaEndpoint ?? null,
src/hooks/useConfig.ts:157:    openaiEndpoint: es.config.openaiEndpoint ?? null,
src/hooks/useConfig.ts:158:    openaiModel: es.config.openaiModel ?? null,
src/hooks/useConfig.ts:159:    translationProvider: es.config.translationProvider ?? null,
src/hooks/useConfig.ts:160:    sourceLang: es.config.langPair?.source ?? null,
src/hooks/useConfig.ts:161:    targetLang: es.config.langPair?.target ?? null,
src/hooks/useConfig.ts:173:    recentFiles: useStore.getState().recentFiles,
src/hooks/useConfig.ts:174:    scrollPositions: useStore.getState().scrollPositions ?? null,
src/hooks/useConfig.ts:175:    embedScrollPositions: useStore.getState().embedScrollPositions ?? null,
src/hooks/useConfig.ts:176:    capabilities: serializeCapabilities(),
src/hooks/useConfig.ts:177:    rouletteSectors: es.config.rouletteSectors ?? null,
src/hooks/useConfig.ts:182:    htmlToolbarItems: es.config.htmlToolbarItems ?? null,
src/hooks/useConfig.ts:184:    paneLayout: useStore.getState().paneLayoutJson(),
src/hooks/useConfig.ts:188:    railViewSpec: useStore.getState().railViewSpec,
src/hooks/useConfig.ts:190:    previewSettings: useStore.getState().previewSettings,
src/hooks/useConfig.ts:192:    aiViewSpec: useStore.getState().captureViewSpec(),
src/hooks/useConfig.ts:218:  paneLayoutJson: string | null | undefined,
src/hooks/useConfig.ts:222:  if (!paneLayoutJson) return;
src/hooks/useConfig.ts:224:  const parsed = parseSerializedLayout(paneLayoutJson);
src/hooks/useConfig.ts:226:    log.warn("Config", "paneLayout 解析失败，退回默认单格");
src/hooks/useConfig.ts:273:  raw: RustAppConfig["railViewSpec"],
src/hooks/useConfig.ts:394:    readerFontSize: raw.readerFontSize ?? 17,
src/hooks/useConfig.ts:395:    readerWidth: raw.readerWidth ?? 1080,
src/hooks/useConfig.ts:396:    readerSkin: raw.readerSkin ?? "paper",
src/hooks/useConfig.ts:397:    defaultSavePath: raw.defaultSavePath ?? null,
src/hooks/useConfig.ts:398:    ollamaEndpoint: raw.ollamaEndpoint ?? "http://localhost:11434",
src/hooks/useConfig.ts:399:    openaiEndpoint: raw.openaiEndpoint ?? "https://api.openai.com",
src/hooks/useConfig.ts:400:    openaiModel: raw.openaiModel ?? "gpt-4o-mini",
src/hooks/useConfig.ts:401:    translationProvider:
src/hooks/useConfig.ts:402:      (raw.translationProvider as AppConfig["translationProvider"]) ?? "ollama",
src/hooks/useConfig.ts:403:    langPair: {
src/hooks/useConfig.ts:418:    recentFiles: raw.recentFiles ?? [],
src/hooks/useConfig.ts:419:    capabilities: raw.capabilities ?? {},
src/hooks/useConfig.ts:420:    rouletteSectors: normalizeRouletteSectors(raw.rouletteSectors),
src/hooks/useConfig.ts:433:    htmlToolbarItems: normalizeHtmlToolbarItems(raw.htmlToolbarItems),
src/hooks/useConfig.ts:447:  useStore.getState().setScrollPositions(raw.scrollPositions ?? {});
src/hooks/useConfig.ts:449:  useStore.getState().setEmbedScrollPositions(raw.embedScrollPositions ?? {});
src/hooks/useConfig.ts:467:  if (config.recentFiles && config.recentFiles.length > 0) {
src/hooks/useConfig.ts:468:    const { recentFiles } = useStore.getState();
src/hooks/useConfig.ts:469:    if (recentFiles.length === 0) {
src/hooks/useConfig.ts:474:        recentFiles: config.recentFiles
src/hooks/useConfig.ts:487:  applyReaderSkin(config.readerSkin ?? "paper");
src/hooks/useConfig.ts:488:  applyCapabilityConfig(raw.capabilities);
src/hooks/useConfig.ts:491:  const railSpec = normalizeRailViewSpec(raw.railViewSpec);
src/hooks/useConfig.ts:493:    railViewSpec: railSpec,
src/hooks/useConfig.ts:499:        raw.railViewSpec?.cardHeight ??
src/hooks/useConfig.ts:506:  const previewSpec = normalizePreviewSettings(raw.previewSettings);
src/hooks/useConfig.ts:507:  useStore.setState({ previewSettings: previewSpec });
src/hooks/useConfig.ts:520:    .setViewSpec(normalizeViewSpec(raw.aiViewSpec, baseViewSpec));
src/hooks/useConfig.ts:523:  void restorePaneLayout(raw.paneLayout);
src/hooks/useConfig.ts:556:        readerFontSize: 17,
src/hooks/useConfig.ts:557:        readerWidth: 1080,
src/hooks/useConfig.ts:558:        readerSkin: "paper",
src/hooks/useConfig.ts:559:        ollamaEndpoint: "http://localhost:11434",
src/hooks/useConfig.ts:560:        openaiEndpoint: "https://api.openai.com",
src/hooks/useConfig.ts:561:        openaiModel: "gpt-4o-mini",
src/hooks/useConfig.ts:562:        translationProvider: "ollama",
src/hooks/useConfig.ts:563:        langPair: { source: "en", target: "zh-CN" },
src/hooks/useConfig.ts:572:        recentFiles: [],
src/components/PortalView.tsx:73:  const recentFiles = useStore((s) => s.recentFiles);
src/components/PortalView.tsx:74:  const scrollPositions = useStore((s) => s.scrollPositions);
src/components/PortalView.tsx:92:    for (const f of recentFiles) {
src/components/PortalView.tsx:97:  }, [recentFiles]);
src/components/PortalView.tsx:99:  const hero = recentFiles[0] ?? null;
src/components/PortalView.tsx:100:  const cards = recentFiles.slice(0, 6);
src/components/PortalView.tsx:127:    const pos = scrollPositions[path];
src/components/PortalView.tsx:153:      {recentFiles.length === 0 ? (
src/components/Rail/ReadingRail.tsx:49:} from "../../lib/aiViewSpec";
src/components/Rail/ReadingRail.tsx:50:import { isUnread } from "../../lib/aiViewSpec";
src/components/Rail/ReadingRail.tsx:805:  const recentFiles = useStore((s) => s.recentFiles);
src/components/Rail/ReadingRail.tsx:808:  const scrollPositions = useStore((s) => s.scrollPositions);
src/components/Rail/ReadingRail.tsx:809:  const previewEnabled = useStore((s) => s.previewSettings.enabled);
src/components/Rail/ReadingRail.tsx:1115:    (path: string): number | undefined => readPercentOf(scrollPositions[path]),
src/components/Rail/ReadingRail.tsx:1116:    [scrollPositions],
src/components/Rail/ReadingRail.tsx:1130:    if (!st.previewSettings.enabled || !st.previewSettings.railHover) return;
src/components/Rail/ReadingRail.tsx:1163:      if (!st.previewSettings.enabled || !st.previewSettings.railHover) return;
src/components/Rail/ReadingRail.tsx:1189:      if (!st.previewSettings.enabled || !st.previewSettings.railHover) return;
src/components/Rail/ReadingRail.tsx:1227:  const chips = useMemo(() => fileTypeChips(recentFiles), [recentFiles]);
src/components/Rail/ReadingRail.tsx:1257:        return tab?.path ? recentFiles.filter((f) => f.path === tab.path) : [];
src/components/Rail/ReadingRail.tsx:1260:        return recentFiles.filter((f) => pinnedPaths.includes(f.path));
src/components/Rail/ReadingRail.tsx:1262:      return recentFiles;
src/components/Rail/ReadingRail.tsx:1264:    [activeTabId, tabs, recentFiles, pinnedPaths],
src/components/Rail/ReadingRail.tsx:1273:      (m) => !viewSpec.unreadOnly || isUnread(m.item.path, scrollPositions),
src/components/ai/AiConversation.tsx:3:import { SPEC_PRESETS } from "../../lib/aiViewSpec";
src/hooks/useAiEntry.ts:14:} from "../lib/aiViewSpec";
src/renderers/math.ts:3:import { isCapabilityEnabled } from "../lib/capabilities";
src/__tests__/useAiEntry.test.ts:24:    readerFontSize: 17,
src/__tests__/useAiEntry.test.ts:25:    readerWidth: 1080,
src/__tests__/useAiEntry.test.ts:26:    readerSkin: "paper",
src/__tests__/useAiEntry.test.ts:27:    ollamaEndpoint: "http://localhost:11434",
src/__tests__/useAiEntry.test.ts:28:    openaiEndpoint: "https://api.openai.com",
src/__tests__/useAiEntry.test.ts:29:    openaiModel: "gpt-4o-mini",
src/__tests__/useAiEntry.test.ts:30:    translationProvider: "ollama",
src/__tests__/useAiEntry.test.ts:41:    recentFiles: [],
src/__tests__/useAiEntry.test.ts:42:    scrollPositions: {},
src/stores/captureOverlay.ts:147:  capsuleX: number;
src/stores/captureOverlay.ts:148:  capsuleY: number;
src/stores/captureOverlay.ts:209:    capsuleX: 0,
src/stores/captureOverlay.ts:210:    capsuleY: 0,
src/stores/captureOverlay.ts:231:      if (status === "closed" || status === "capsule") {
src/stores/captureOverlay.ts:255:    minimize: () => set({ status: "capsule" }),
src/stores/captureOverlay.ts:562:          capsuleX?: number;
src/stores/captureOverlay.ts:563:          capsuleY?: number;
src/stores/captureOverlay.ts:576:        if (config.capsuleX !== undefined && config.capsuleX !== null)
src/stores/captureOverlay.ts:577:          patch.capsuleX = config.capsuleX;
src/stores/captureOverlay.ts:578:        if (config.capsuleY !== undefined && config.capsuleY !== null)
src/stores/captureOverlay.ts:579:          patch.capsuleY = config.capsuleY;
src/stores/captureOverlay.ts:595:      set({ capsuleX: x, capsuleY: y }),
src/stores/captureOverlay.ts:602:      const { capsuleX, capsuleY } = get();
src/stores/captureOverlay.ts:603:      const newX = Math.max(padding, Math.min(capsuleX, maxX));
src/stores/captureOverlay.ts:604:      const newY = Math.max(padding, Math.min(capsuleY, maxY));
src/stores/captureOverlay.ts:605:      set({ capsuleX: newX, capsuleY: newY });
src/stores/captureOverlay.ts:606:      // Persist capsule position
src/stores/captureOverlay.ts:609:          captureConfig: { capsuleX: newX, capsuleY: newY },
src/renderers/diagram/engine.ts:13:} from "../../lib/capabilities";
src/__tests__/capabilitiesGating.test.ts:6:} from "../lib/capabilities";
src/components/Content/ContentArea.tsx:448:  const readerFontSize = useEditorStore((s) => s.config.readerFontSize);
src/components/Content/ContentArea.tsx:449:  const readerWidth = useEditorStore((s) => s.config.readerWidth);
src/components/Content/ContentArea.tsx:465:    if (readerFontSize) vars["--type-font-size"] = `${readerFontSize}px`;
src/components/Content/ContentArea.tsx:466:    if (readerWidth) {
src/components/Content/ContentArea.tsx:467:      vars["--type-measure"] = `${readerWidth}px`;
src/components/Content/ContentArea.tsx:468:      vars["--type-measure-wide"] = `${Math.min(readerWidth + 120, 1400)}px`;
src/components/Content/ContentArea.tsx:471:  }, [headingColors, headingFonts, readerFontSize, readerWidth]);

exec
/bin/zsh -lc "nl -ba src-tauri/src/config.rs | sed -n '1,120p;330,470p;740,1010p;1080,1375p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
     1	use serde::{Deserialize, Serialize};
     2	use serde_json::Value;
     3	use std::collections::HashMap;
     4	use std::io::Write;
     5	use std::path::{Path, PathBuf};
     6	use std::time::{SystemTime, UNIX_EPOCH};
     7	use tauri::{AppHandle, Manager};
     8	use tracing::{info, warn};
     9	
    10	use crate::errors::AppError;
    11	
    12	#[derive(Debug, Serialize, Deserialize, Clone)]
    13	#[serde(rename_all = "camelCase")]
    14	pub struct AppConfig {
    15	    pub font_size: Option<f64>,
    16	    pub heading_colors: Option<HeadingColors>,
    17	    // 阅读区设置（预览专用，与编辑器字号解耦）
    18	    pub reader_font_size: Option<f64>,
    19	    pub reader_width: Option<f64>,
    20	    pub reader_skin: Option<String>,
    21	    pub ollama_endpoint: Option<String>,
    22	    pub openai_endpoint: Option<String>,
    23	    pub openai_model: Option<String>,
    24	    #[serde(skip)]
    25	    pub openai_api_key: Option<String>,
    26	    pub translation_provider: Option<String>,
    27	    pub source_lang: Option<String>,
    28	    pub target_lang: Option<String>,
    29	    pub theme: Option<String>,
    30	    pub ai_confirm_density: Option<String>,
    31	    pub sidebar_left_visible: Option<bool>,
    32	    pub sidebar_right_visible: Option<bool>,
    33	    pub sidebar_left_width: Option<f64>,
    34	    pub sidebar_right_width: Option<f64>,
    35	    pub horizontal_split_ratio: Option<f64>,
    36	    pub vertical_split_ratio: Option<f64>,
    37	    pub recent_files: Option<Vec<RecentFile>>,
    38	    pub scroll_positions: Option<HashMap<String, ScrollPosition>>,
    39	    /// 内嵌文件滚动定格（D10 / B5b）：文档级 view-state，键 = `文档路径\u0000内嵌路径`。
    40	    #[serde(default, skip_serializing_if = "Option::is_none")]
    41	    pub embed_scroll_positions: Option<HashMap<String, ScrollPosition>>,
    42	    /// 核心能力开关：只记录被关闭的能力，缺省即全开（spec X-3）。
    43	    pub capabilities: Option<HashMap<String, bool>>,
    44	    /// 图标标签级别（Layout Portal §10）：auto / text / icon。
    45	    pub icon_label: Option<String>,
    46	    /// 工作区 pane 递归树（layout-portal 3.1）：序列化后的 JSON 字符串。
    47	    /// `default` + `skip_serializing_if` 让老配置仍能读、新配置不多出空字段。
    48	    #[serde(default, skip_serializing_if = "Option::is_none")]
    49	    pub pane_layout: Option<String>,
    50	    /// 阅读空间栏「设为默认」的视图规格（layout-portal 6.1）。
    51	    /// `default` + `skip_serializing_if` 让老配置仍能读、新配置不多出空字段。
    52	    #[serde(default, skip_serializing_if = "Option::is_none")]
    53	    pub rail_view_spec: Option<RailViewSpec>,
    54	    /// 悬浮预览窗双轨开关（layout-portal 8.1）。
    55	    /// `default` + `skip_serializing_if` 让老配置仍能读、新配置不多出空字段。
    56	    #[serde(default, skip_serializing_if = "Option::is_none")]
    57	    pub preview_settings: Option<PreviewSettings>,
    58	    /// AI 视图改写规格（layout-portal 9.1）。
    59	    /// `default` + `skip_serializing_if` 让老配置仍能读、新配置不多出空字段。
    60	    #[serde(default, skip_serializing_if = "Option::is_none")]
    61	    pub ai_view_spec: Option<AiViewSpec>,
    62	    /// 轮盘根扇区集合与顺序（ui-command-registry 2.1）。缺省 = 内置默认。
    63	    #[serde(default, skip_serializing_if = "Option::is_none")]
    64	    pub roulette_sectors: Option<Vec<String>>,
    65	    /// 横向工具条动作集合与顺序（ui-toolbar-slots 1.1）。缺省 = 内置默认。
    66	    #[serde(default, skip_serializing_if = "Option::is_none")]
    67	    pub html_toolbar_items: Option<Vec<String>>,
    68	    /// 新建文档首次保存的默认目录（ui-polish-batch12 6.1）。
    69	    /// `default` + `skip_serializing_if` 让老配置仍能读、新配置不多出空字段。
    70	    #[serde(default, skip_serializing_if = "Option::is_none")]
    71	    pub default_save_path: Option<String>,
    72	    /// 轮盘开关快捷键（ui-polish-batch15 2.1）；缺省 = Mod+Shift+Space。
    73	    #[serde(default, skip_serializing_if = "Option::is_none")]
    74	    pub roulette_hotkey: Option<String>,
    75	    /// 轮盘默认形态（ui-polish-batch15 2.1）：hub 圆心 / disk 整盘。
    76	    #[serde(default, skip_serializing_if = "Option::is_none")]
    77	    pub roulette_form: Option<String>,
    78	    /// 轮盘圆心位置（ui-polish-batch15 2.1）：中键拖动后的落点，重载后保持。
    79	    #[serde(default, skip_serializing_if = "Option::is_none")]
    80	    pub roulette_position: Option<RoulettePosition>,
    81	    /// 提示信息显示时长（秒，ui-polish-batch15 4.1）：0.1–10，最多 1 位小数。
    82	    /// 缺省 = None，消费端按 3 秒处理。
    83	    #[serde(default, skip_serializing_if = "Option::is_none")]
    84	    pub notice_duration: Option<f64>,
    85	    /// 标题逐级字体（C1 / #853）：键 h1..h6，值 = CSS font-family 列表。
    86	    /// 缺省 = None，消费端回落到 `--type-font-sans`（#854 应用）。
    87	    #[serde(default, skip_serializing_if = "Option::is_none")]
    88	    pub heading_fonts: Option<HeadingFonts>,
    89	    /// 左边栏固定隐藏（C3 / D14）：隐藏后箭头热区一并收起，滑入不唤出。
    90	    /// `default` + `skip_serializing_if` 让老配置仍能读、新配置不多出空字段。
    91	    #[serde(default, skip_serializing_if = "Option::is_none")]
    92	    pub rail_pin_hidden: Option<bool>,
    93	    /// 文档属性面板（doc-property-panel P-2）：显示样式 / 预览编辑默认档 / 新建默认显隐。
    94	    #[serde(default, skip_serializing_if = "Option::is_none")]
    95	    pub property_bar: Option<PropertyBar>,
    96	}
    97	
    98	/// 文档属性面板配置（doc-property-panel P-2）。
    99	#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
   100	#[serde(rename_all = "camelCase")]
   101	pub struct PropertyBar {
   102	    /// list = A 一行条，dual = B 精排双列。
   103	    pub display_style: Option<String>,
   104	    pub display_default: Option<PropertyBarDefault>,
   105	    pub new_doc_visible: Option<bool>,
   106	}
   107	
   108	/// 预览 / 编辑各自的默认显示档：show / collapse / hide。
   109	#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
   110	#[serde(rename_all = "camelCase")]
   111	pub struct PropertyBarDefault {
   112	    pub preview: Option<String>,
   113	    pub edit: Option<String>,
   114	}
   115	
   116	/// 轮盘位置（ui-polish-batch15 2.1）：中键拖动后的圆心坐标（屏内像素）。
   117	#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
   118	#[serde(rename_all = "camelCase")]
   119	pub struct RoulettePosition {
   120	    pub x: f64,
   330	        let mut file = std::fs::File::create(&tmp)?;
   331	        file.write_all(data)?;
   332	        file.sync_all()?;
   333	        drop(file);
   334	        std::fs::rename(&tmp, path)
   335	    })();
   336	
   337	    if let Err(e) = result {
   338	        let _ = std::fs::remove_file(&tmp);
   339	        return Err(io_err("atomic write", e));
   340	    }
   341	    Ok(())
   342	}
   343	
   344	// ── 合并（design §D2）────────────────────────────────────────
   345	
   346	fn merge_json(defaults: &Value, user: &Value) -> Value {
   347	    match (defaults, user) {
   348	        (Value::Object(base), Value::Object(over)) => {
   349	            let mut merged = base.clone();
   350	            for (key, value) in over {
   351	                let next = match merged.get(key) {
   352	                    Some(existing) => merge_json(existing, value),
   353	                    None => value.clone(),
   354	                };
   355	                merged.insert(key.clone(), next);
   356	            }
   357	            Value::Object(merged)
   358	        }
   359	        (base, Value::Null) => base.clone(),
   360	        (_, over) => over.clone(),
   361	    }
   362	}
   363	
   364	fn read_json(path: &Path) -> Result<Option<Value>, AppError> {
   365	    match std::fs::read_to_string(path) {
   366	        Ok(data) => serde_json::from_str(&data)
   367	            .map(Some)
   368	            .map_err(|e| json_err(&format!("parse {}", path.display()), e)),
   369	        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
   370	        Err(e) => Err(io_err(&format!("read {}", path.display()), e)),
   371	    }
   372	}
   373	
   374	/// 损坏的文件改名留档后按缺失处理，避免一次手滑就让应用起不来。
   375	fn read_json_or_quarantine(path: &Path) -> Option<Value> {
   376	    match read_json(path) {
   377	        Ok(value) => value,
   378	        Err(e) => {
   379	            warn!(error = %e, path = %path.display(), "配置文件无法解析，已改名留档");
   380	            let _ = std::fs::rename(path, path.with_extension("json.bak"));
   381	            None
   382	        }
   383	    }
   384	}
   385	
   386	fn ensure_defaults(base: &Path) -> Result<(), AppError> {
   387	    let path = defaults_path(base);
   388	    if path.exists() {
   389	        return Ok(());
   390	    }
   391	    let data = serde_json::to_vec_pretty(&settings_value(&AppConfig::default())?)
   392	        .map_err(|e| json_err("defaults", e))?;
   393	    atomic_write(&path, &data)
   394	}
   395	
   396	/// 设置字段（不含派生状态），用于写入 user 层与快照。
   397	fn settings_value(config: &AppConfig) -> Result<Value, AppError> {
   398	    let mut value = serde_json::to_value(config).map_err(|e| json_err("config", e))?;
   399	    if let Value::Object(map) = &mut value {
   400	        map.remove("recentFiles");
   401	        map.remove("scrollPositions");
   402	        map.remove("embedScrollPositions");
   403	    }
   404	    Ok(value)
   405	}
   406	
   407	fn state_value(config: &AppConfig) -> Result<Value, AppError> {
   408	    let recent_files = serde_json::to_value(config.recent_files.clone().unwrap_or_default())
   409	        .map_err(|e| json_err("recentFiles", e))?;
   410	    let scroll_positions =
   411	        serde_json::to_value(config.scroll_positions.clone().unwrap_or_default())
   412	            .map_err(|e| json_err("scrollPositions", e))?;
   413	    let embed_scroll_positions =
   414	        serde_json::to_value(config.embed_scroll_positions.clone().unwrap_or_default())
   415	            .map_err(|e| json_err("embedScrollPositions", e))?;
   416	    Ok(serde_json::json!({
   417	        "recentFiles": recent_files,
   418	        "scrollPositions": scroll_positions,
   419	        "embedScrollPositions": embed_scroll_positions,
   420	    }))
   421	}
   422	
   423	fn effective_config(
   424	    defaults: Value,
   425	    user: Option<Value>,
   426	    state: Option<Value>,
   427	) -> Result<AppConfig, AppError> {
   428	    let mut merged = merge_json(&defaults, user.as_ref().unwrap_or(&Value::Null));
   429	    if let (Value::Object(map), Some(Value::Object(state))) = (&mut merged, state) {
   430	        for key in ["recentFiles", "scrollPositions", "embedScrollPositions"] {
   431	            if let Some(value) = state.get(key) {
   432	                map.insert(key.to_string(), value.clone());
   433	            }
   434	        }
   435	    }
   436	    serde_json::from_value(merged).map_err(|e| json_err("effective config", e))
   437	}
   438	
   439	/// 旧 `app_config.json` 拆成 user + state。旧文件保留不动，靠 user 层是否
   440	/// 存在判断是否需要迁移，因此重复调用天然幂等。
   441	fn migrate_legacy(base: &Path) -> Result<bool, AppError> {
   442	    let legacy = legacy_path(base);
   443	    if user_path(base).exists() || !legacy.exists() {
   444	        return Ok(false);
   445	    }
   446	    let Some(raw) = read_json_or_quarantine(&legacy) else {
   447	        return Ok(false);
   448	    };
   449	    let config: AppConfig =
   450	        serde_json::from_value(raw).map_err(|e| json_err("legacy config", e))?;
   451	    let user = serde_json::to_vec_pretty(&settings_value(&config)?)
   452	        .map_err(|e| json_err("legacy settings", e))?;
   453	    let state = serde_json::to_vec_pretty(&state_value(&config)?)
   454	        .map_err(|e| json_err("legacy state", e))?;
   455	    atomic_write(&user_path(base), &user)?;
   456	    atomic_write(&state_path(base), &state)?;
   457	    info!(from = %legacy.display(), "旧配置已拆分为 user/state 两层");
   458	    Ok(true)
   459	}
   460	
   461	// ── 校验（design §D5）────────────────────────────────────────
   462	
   463	fn check_range(field: &str, value: Option<f64>, min: f64, max: f64) -> Result<(), AppError> {
   464	    match value {
   465	        Some(v) if !(min..=max).contains(&v) => Err(AppError::Validation {
   466	            context: field.into(),
   467	            message: format!("{v} 超出范围 {min}–{max}"),
   468	        }),
   469	        _ => Ok(()),
   470	    }
   740	            }
   741	            if !seen.insert(id.as_str()) {
   742	                return Err(AppError::Validation {
   743	                    context: "htmlToolbarItems".into(),
   744	                    message: format!("重复动作: {id}"),
   745	                });
   746	            }
   747	        }
   748	    }
   749	    Ok(())
   750	}
   751	
   752	// ── 快照（design §D4）────────────────────────────────────────
   753	
   754	fn snapshot_name() -> String {
   755	    let stamp = chrono::Utc::now()
   756	        .format("%Y-%m-%dT%H-%M-%S-%6fZ")
   757	        .to_string();
   758	    format!("{SNAPSHOT_PREFIX}{stamp}.json")
   759	}
   760	
   761	/// 快照文件名只接受 `settings-` 前缀与安全字符，拒绝路径穿越。
   762	fn is_safe_snapshot_name(name: &str) -> bool {
   763	    name.starts_with(SNAPSHOT_PREFIX)
   764	        && name.ends_with(".json")
   765	        && name
   766	            .chars()
   767	            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-'))
   768	}
   769	
   770	/// 把当前 user 层复制进 snapshots/。user 层不存在时跳过。
   771	fn snapshot_user(base: &Path) -> Result<(), AppError> {
   772	    let source = user_path(base);
   773	    if !source.exists() {
   774	        return Ok(());
   775	    }
   776	    let data = std::fs::read(&source).map_err(|e| io_err("read user config", e))?;
   777	    atomic_write(&snapshots_dir(base).join(snapshot_name()), &data)
   778	}
   779	
   780	/// 只保留最新 10 份；文件名按时间升序，因此保留字典序最大的 10 个。
   781	fn prune_snapshots(base: &Path) -> Result<(), AppError> {
   782	    let mut names = list_snapshots(base)?;
   783	    if names.len() <= SNAPSHOT_LIMIT {
   784	        return Ok(());
   785	    }
   786	    names.sort();
   787	    let dir = snapshots_dir(base);
   788	    for name in &names[..names.len() - SNAPSHOT_LIMIT] {
   789	        std::fs::remove_file(dir.join(name)).map_err(|e| io_err("prune snapshot", e))?;
   790	    }
   791	    Ok(())
   792	}
   793	
   794	/// 快照名列表，按时间升序（最旧在前）。
   795	pub fn list_snapshots(base: &Path) -> Result<Vec<String>, AppError> {
   796	    let dir = snapshots_dir(base);
   797	    let entries = match std::fs::read_dir(&dir) {
   798	        Ok(entries) => entries,
   799	        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
   800	        Err(e) => return Err(io_err("list snapshots", e)),
   801	    };
   802	    let mut names = Vec::new();
   803	    for entry in entries {
   804	        let entry = entry.map_err(|e| io_err("list snapshots", e))?;
   805	        let name = entry.file_name().to_string_lossy().into_owned();
   806	        if is_safe_snapshot_name(&name) && entry.path().is_file() {
   807	            names.push(name);
   808	        }
   809	    }
   810	    names.sort();
   811	    Ok(names)
   812	}
   813	
   814	/// 恢复前先给当前状态拍一份快照，因此「恢复」本身也可再回滚。
   815	pub fn restore_snapshot(base: &Path, name: &str) -> Result<AppConfig, AppError> {
   816	    if !is_safe_snapshot_name(name) {
   817	        return Err(AppError::Validation {
   818	            context: "snapshot".into(),
   819	            message: format!("非法的快照名 {name}"),
   820	        });
   821	    }
   822	    let source = snapshots_dir(base).join(name);
   823	    let data = std::fs::read(&source).map_err(|e| io_err("read snapshot", e))?;
   824	    // 先确认快照可解析，避免把坏内容写进 user 层。
   825	    serde_json::from_slice::<Value>(&data).map_err(|e| json_err("snapshot", e))?;
   826	    snapshot_user(base)?;
   827	    atomic_write(&user_path(base), &data)?;
   828	    prune_snapshots(base)?;
   829	    load_config_at(base)
   830	}
   831	
   832	// ── 加载 / 保存 ──────────────────────────────────────────────
   833	
   834	pub fn load_config_at(base: &Path) -> Result<AppConfig, AppError> {
   835	    ensure_defaults(base)?;
   836	    migrate_legacy(base)?;
   837	    let code_defaults =
   838	        serde_json::to_value(AppConfig::default()).map_err(|e| json_err("code defaults", e))?;
   839	    let file_defaults = read_json_or_quarantine(&defaults_path(base)).unwrap_or(Value::Null);
   840	    let defaults = merge_json(&code_defaults, &file_defaults);
   841	    let user = read_json_or_quarantine(&user_path(base));
   842	    let state = read_json_or_quarantine(&state_path(base));
   843	    effective_config(defaults, user, state)
   844	}
   845	
   846	pub fn save_config_at(base: &Path, config: &AppConfig) -> Result<(), AppError> {
   847	    validate_config(config)?;
   848	    ensure_defaults(base)?;
   849	    snapshot_user(base)?;
   850	    let user = serde_json::to_vec_pretty(&settings_value(config)?)
   851	        .map_err(|e| json_err("user config", e))?;
   852	    let state =
   853	        serde_json::to_vec_pretty(&state_value(config)?).map_err(|e| json_err("state", e))?;
   854	    atomic_write(&user_path(base), &user)?;
   855	    atomic_write(&state_path(base), &state)?;
   856	    prune_snapshots(base)?;
   857	    Ok(())
   858	}
   859	
   860	/// 把 JSON 合并补丁打进 user 层，复用 C2 的校验 / 快照 / 原子写语义。
   861	///
   862	/// 顺序：读 user（缺失按 `{}`）→ `merge_json` 深合并 → 反序列化 → 校验 →
   863	/// 快照当前 user → 原子写 user + state。任一步失败都不落盘；返回新的有效配置。
   864	pub fn apply_patch_at(base: &Path, patch: &Value) -> Result<AppConfig, AppError> {
   865	    if !patch.is_object() {
   866	        return Err(AppError::Validation {
   867	            context: "patch".into(),
   868	            message: "补丁必须是 JSON 对象".into(),
   869	        });
   870	    }
   871	    ensure_defaults(base)?;
   872	    migrate_legacy(base)?;
   873	    let current_user = read_json_or_quarantine(&user_path(base)).unwrap_or(Value::Null);
   874	    let merged = merge_json(&current_user, patch);
   875	    let config: AppConfig =
   876	        serde_json::from_value(merged).map_err(|e| json_err("patched config", e))?;
   877	    validate_config(&config)?;
   878	
   879	    snapshot_user(base)?;
   880	    let user = serde_json::to_vec_pretty(&settings_value(&config)?)
   881	        .map_err(|e| json_err("user config", e))?;
   882	    let state =
   883	        serde_json::to_vec_pretty(&state_value(&config)?).map_err(|e| json_err("state", e))?;
   884	    atomic_write(&user_path(base), &user)?;
   885	    atomic_write(&state_path(base), &state)?;
   886	    prune_snapshots(base)?;
   887	
   888	    load_config_at(base)
   889	}
   890	
   891	/// 首次启动写一份给 AI 读的配置地图；文件已存在则保留用户改动，不覆盖。
   892	pub fn seed_skill_map(app: &AppHandle) {
   893	    let path = config_base(app)
   894	        .join("skills")
   895	        .join("biaoyue")
   896	        .join("SKILL.md");
   897	    if path.exists() {
   898	        return;
   899	    }
   900	    if let Err(e) = atomic_write(&path, SKILL_MAP.as_bytes()) {
   901	        warn!(error = %e, path = %path.display(), "SKILL.md 写入失败");
   902	    }
   903	}
   904	
   905	const SKILL_MAP: &str = r#"# Biaoyue 配置地图
   906	
   907	这是标月的配置心智地图，供 AI agent 读取。配置分三层，都位于应用配置目录下：
   908	
   909	| 层 | 路径 | 作用 |
   910	| --- | --- | --- |
   911	| defaults | `defaults/settings.json` | 代码默认值，首次运行生成 |
   912	| user | `user/settings.json` | 用户设置，`patch_config` 写这里 |
   913	| state | `state/state.json` | 派生状态（recentFiles / scrollPositions / embedScrollPositions），不归 patch 管 |
   914	| snapshots | `snapshots/settings-*.json` | 每次写入前的 user 层副本，保留最新 10 份 |
   915	
   916	## 可用工具
   917	
   918	- `read_config`：返回合并后的有效配置。
   919	- `patch_config`：`{"patch": {...}}`，深合并进 user 层，写入前校验并生成快照；非法值不落盘。
   920	- `list_snapshots`：返回快照文件名，最旧在前。
   921	
   922	## 可改键与取值范围（camelCase）
   923	
   924	| 键 | 范围 / 取值 |
   925	| --- | --- |
   926	| `fontSize` | 8–96 |
   927	| `readerFontSize` | 8–96 |
   928	| `readerWidth` | 480–2400 |
   929	| `sidebarLeftWidth` / `sidebarRightWidth` | 0–800 |
   930	| `horizontalSplitRatio` / `verticalSplitRatio` | 0–1 |
   931	| `theme` | `light` / `dark` / `warm` / `system` |
   932	| `aiConfirmDensity` | `always` / `session-silent` / `never` |
   933	| `readerSkin` | `paper` / `plain` |
   934	| `propertyBar.displayStyle` | `list` / `dual` |
   935	| `propertyBar.displayDefault.preview` / `.edit` | `show` / `collapse` / `hide` |
   936	| `propertyBar.newDocVisible` | `true` / `false` |
   937	| `openaiEndpoint` / `openaiModel` | 任意字符串 |
   938	
   939	## 禁止项
   940	
   941	- API key 只存操作系统 keyring，绝不写进配置文件、日志或本文件。
   942	- 不要手改 `state/state.json`；它由应用维护。
   943	"#;
   944	
   945	/// 应用配置目录（用户层根目录）。扩展点扫描复用同一目录解析。
   946	pub fn config_base(app: &AppHandle) -> PathBuf {
   947	    app.path()
   948	        .app_config_dir()
   949	        .unwrap_or_else(|_| PathBuf::from("."))
   950	}
   951	
   952	const LEGACY_BUNDLE_IDENTIFIER: &str = "com.clairis.app";
   953	
   954	/// 更早版本把配置放在旧 bundle id 目录下；只读复制，旧文件保留。
   955	async fn migrate_legacy_bundle(app: &AppHandle, base: &Path) {
   956	    if user_path(base).exists() || legacy_path(base).exists() {
   957	        return;
   958	    }
   959	    let Ok(config_dir) = app.path().config_dir() else {
   960	        return;
   961	    };
   962	    let legacy = config_dir.join(LEGACY_BUNDLE_IDENTIFIER).join(LEGACY_FILE);
   963	    if legacy == legacy_path(base) || !legacy.exists() {
   964	        return;
   965	    }
   966	    let Ok(data) = tokio::fs::read(&legacy).await else {
   967	        return;
   968	    };
   969	    if atomic_write(&legacy_path(base), &data).is_ok() {
   970	        info!(from = %legacy.display(), "旧 bundle 配置已复制到当前目录");
   971	    }
   972	}
   973	
   974	/// Load config from disk, return default on missing/corrupt.
   975	pub async fn load_config(app: &AppHandle) -> Result<AppConfig, AppError> {
   976	    let base = config_base(app);
   977	    migrate_legacy_bundle(app, &base).await;
   978	    load_config_at(&base)
   979	}
   980	
   981	/// Save config to disk.
   982	pub async fn save_config(app: &AppHandle, config: &AppConfig) -> Result<(), AppError> {
   983	    save_config_at(&config_base(app), config)
   984	}
   985	
   986	pub async fn list_config_snapshots(app: &AppHandle) -> Result<Vec<String>, AppError> {
   987	    list_snapshots(&config_base(app))
   988	}
   989	
   990	pub async fn restore_config_snapshot(app: &AppHandle, name: &str) -> Result<AppConfig, AppError> {
   991	    restore_snapshot(&config_base(app), name)
   992	}
   993	
   994	/// 轮询 `user/settings.json` 的 (mtime, len)，变化时发 `config-changed`。
   995	/// 按路径取状态，文件被 rename 替换也能发现；首轮只记录基线。
   996	pub fn spawn_config_watcher(app: AppHandle) {
   997	    let path = user_path(&config_base(&app));
   998	    tauri::async_runtime::spawn(async move {
   999	        use tauri::Emitter;
  1000	        let fingerprint = |path: &Path| -> Option<(SystemTime, u64)> {
  1001	            let meta = std::fs::metadata(path).ok()?;
  1002	            Some((meta.modified().ok()?, meta.len()))
  1003	        };
  1004	        let mut last = fingerprint(&path);
  1005	        loop {
  1006	            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
  1007	            let current = fingerprint(&path);
  1008	            if current != last {
  1009	                last = current;
  1010	                info!(path = %path.display(), "配置文件被外部修改，通知前端热应用");
  1080	    }
  1081	
  1082	    #[test]
  1083	    fn user_overrides_defaults() {
  1084	        let dir = temp_base("merge");
  1085	        let base = dir.path();
  1086	        write_user(base, r#"{"theme":"dark"}"#);
  1087	
  1088	        let config = load_config_at(base).unwrap();
  1089	
  1090	        assert_eq!(config.theme.as_deref(), Some("dark"));
  1091	        // 未覆盖的键仍来自 defaults
  1092	        assert_eq!(config.font_size, Some(17.0));
  1093	        assert_eq!(config.reader_width, Some(1080.0));
  1094	    }
  1095	
  1096	    #[test]
  1097	    fn save_keeps_derived_state_out_of_user_file() {
  1098	        let dir = temp_base("split");
  1099	        let base = dir.path();
  1100	        let mut config = AppConfig::default();
  1101	        config.recent_files = Some(vec![RecentFile {
  1102	            path: "/tmp/a.md".into(),
  1103	            title: "a.md".into(),
  1104	            opened_at: "2026-01-01T00:00:00Z".into(),
  1105	            excerpt: None,
  1106	        }]);
  1107	
  1108	        save_config_at(base, &config).unwrap();
  1109	
  1110	        let user = read_user(base);
  1111	        assert!(
  1112	            !user.contains("recentFiles"),
  1113	            "user 层不应含 recentFiles: {user}"
  1114	        );
  1115	        assert!(
  1116	            !user.contains("scrollPositions"),
  1117	            "user 层不应含 scrollPositions: {user}"
  1118	        );
  1119	        let state = std::fs::read_to_string(state_path(base)).unwrap();
  1120	        assert!(state.contains("recentFiles"));
  1121	        assert_eq!(load_config_at(base).unwrap().recent_files.unwrap().len(), 1);
  1122	    }
  1123	
  1124	    #[test]
  1125	    fn atomic_write_failure_keeps_original_bytes() {
  1126	        let dir = temp_base("atomic");
  1127	        let base = dir.path();
  1128	        write_user(base, r#"{"theme":"warm"}"#);
  1129	        let before = read_user(base);
  1130	
  1131	        // 目标路径被目录占用 → rename 必然失败
  1132	        let target = user_path(base);
  1133	        std::fs::remove_file(&target).unwrap();
  1134	        std::fs::create_dir(&target).unwrap();
  1135	
  1136	        let err = atomic_write(&target, b"{\"theme\":\"dark\"}").unwrap_err();
  1137	        assert!(matches!(err, AppError::Io { .. }));
  1138	
  1139	        std::fs::remove_dir(&target).unwrap();
  1140	        std::fs::write(&target, &before).unwrap();
  1141	        assert_eq!(read_user(base), before);
  1142	
  1143	        // 目录里不残留临时文件
  1144	        let leftovers: Vec<_> = std::fs::read_dir(target.parent().unwrap())
  1145	            .unwrap()
  1146	            .filter_map(|e| e.ok())
  1147	            .filter(|e| e.file_name().to_string_lossy().contains(".tmp-"))
  1148	            .collect();
  1149	        assert!(leftovers.is_empty(), "临时文件未清理: {leftovers:?}");
  1150	    }
  1151	
  1152	    #[test]
  1153	    fn invalid_font_size_is_rejected_without_writing() {
  1154	        let dir = temp_base("validate");
  1155	        let base = dir.path();
  1156	        write_user(base, r#"{"theme":"light"}"#);
  1157	        let before = read_user(base);
  1158	
  1159	        let mut config = AppConfig::default();
  1160	        config.font_size = Some(200.0);
  1161	        let err = save_config_at(base, &config).unwrap_err();
  1162	
  1163	        assert!(matches!(err, AppError::Validation { .. }), "got {err:?}");
  1164	        assert_eq!(read_user(base), before);
  1165	    }
  1166	
  1167	    #[test]
  1168	    fn validation_covers_every_rule() {
  1169	        let mut config = AppConfig::default();
  1170	        assert!(validate_config(&config).is_ok());
  1171	
  1172	        config.reader_width = Some(479.0);
  1173	        assert!(validate_config(&config).is_err());
  1174	        config.reader_width = Some(2400.0);
  1175	        assert!(validate_config(&config).is_ok());
  1176	
  1177	        config.theme = Some("neon".into());
  1178	        assert!(validate_config(&config).is_err());
  1179	        config.theme = Some("warm".into());
  1180	        assert!(validate_config(&config).is_ok());
  1181	
  1182	        config.ai_confirm_density = Some("sometimes".into());
  1183	        assert!(validate_config(&config).is_err());
  1184	        config.ai_confirm_density = Some("always".into());
  1185	        assert!(validate_config(&config).is_ok());
  1186	
  1187	        config.reader_skin = Some("indigo".into());
  1188	        assert!(validate_config(&config).is_err());
  1189	        config.reader_skin = Some("plain".into());
  1190	        assert!(validate_config(&config).is_ok());
  1191	
  1192	        config.horizontal_split_ratio = Some(1.5);
  1193	        assert!(validate_config(&config).is_err());
  1194	        config.horizontal_split_ratio = Some(1.0);
  1195	        assert!(validate_config(&config).is_ok());
  1196	
  1197	        config.sidebar_left_width = Some(-1.0);
  1198	        assert!(validate_config(&config).is_err());
  1199	        config.sidebar_left_width = Some(0.0);
  1200	        assert!(validate_config(&config).is_ok());
  1201	
  1202	        config.reader_font_size = Some(7.9);
  1203	        assert!(validate_config(&config).is_err());
  1204	    }
  1205	
  1206	    #[test]
  1207	    fn twelve_saves_keep_newest_ten_snapshots() {
  1208	        let dir = temp_base("prune");
  1209	        let base = dir.path();
  1210	        let mut config = AppConfig::default();
  1211	
  1212	        for i in 0..12 {
  1213	            config.font_size = Some(10.0 + i as f64);
  1214	            save_config_at(base, &config).unwrap();
  1215	        }
  1216	
  1217	        let snapshots = list_snapshots(base).unwrap();
  1218	        assert_eq!(snapshots.len(), 10, "快照数应为 10: {snapshots:?}");
  1219	
  1220	        // 最新一份快照是第 11 次保存前的状态（fontSize = 20）
  1221	        let newest = snapshots.last().unwrap();
  1222	        let data = std::fs::read_to_string(snapshots_dir(base).join(newest)).unwrap();
  1223	        assert!(data.contains("\"fontSize\": 20.0"), "got {data}");
  1224	        // 最旧一份应是第 2 次保存前的状态（fontSize = 11）
  1225	        let oldest = &snapshots[0];
  1226	        let data = std::fs::read_to_string(snapshots_dir(base).join(oldest)).unwrap();
  1227	        assert!(data.contains("\"fontSize\": 11.0"), "got {data}");
  1228	    }
  1229	
  1230	    #[test]
  1231	    fn restore_snapshots_current_state_first() {
  1232	        let dir = temp_base("restore");
  1233	        let base = dir.path();
  1234	        let mut config = AppConfig::default();
  1235	        config.theme = Some("light".into());
  1236	        save_config_at(base, &config).unwrap();
  1237	
  1238	        config.theme = Some("dark".into());
  1239	        save_config_at(base, &config).unwrap();
  1240	        let snapshots = list_snapshots(base).unwrap();
  1241	        // 最新快照保存的是 light 状态
  1242	        let light_snapshot = snapshots.last().unwrap().clone();
  1243	
  1244	        config.theme = Some("warm".into());
  1245	        save_config_at(base, &config).unwrap();
  1246	
  1247	        let restored = restore_snapshot(base, &light_snapshot).unwrap();
  1248	        assert_eq!(restored.theme.as_deref(), Some("light"));
  1249	
  1250	        // 恢复前的 warm 状态已作为新快照存在
  1251	        let after = list_snapshots(base).unwrap();
  1252	        assert!(after.len() > snapshots.len());
  1253	        let newest = after.last().unwrap();
  1254	        let data = std::fs::read_to_string(snapshots_dir(base).join(newest)).unwrap();
  1255	        assert!(data.contains("\"warm\""), "got {data}");
  1256	    }
  1257	
  1258	    #[test]
  1259	    fn restore_rejects_path_traversal() {
  1260	        let dir = temp_base("traversal");
  1261	        let base = dir.path();
  1262	        for name in [
  1263	            "../settings.json",
  1264	            "settings-x/../y.json",
  1265	            "other.json",
  1266	            "settings-a b.json",
  1267	        ] {
  1268	            let err = restore_snapshot(base, name).unwrap_err();
  1269	            assert!(
  1270	                matches!(err, AppError::Validation { .. }),
  1271	                "{name} → {err:?}"
  1272	            );
  1273	        }
  1274	    }
  1275	
  1276	    #[test]
  1277	    fn legacy_config_is_split_and_migration_is_idempotent() {
  1278	        let dir = temp_base("legacy");
  1279	        let base = dir.path();
  1280	        std::fs::write(
  1281	            legacy_path(base),
  1282	            r#"{"theme":"dark","fontSize":19.0,"recentFiles":[{"path":"/tmp/a.md","title":"a.md","openedAt":"2026-01-01T00:00:00Z"}],"scrollPositions":{}}"#,
  1283	        )
  1284	        .unwrap();
  1285	
  1286	        let config = load_config_at(base).unwrap();
  1287	        assert_eq!(config.theme.as_deref(), Some("dark"));
  1288	        assert_eq!(config.font_size, Some(19.0));
  1289	        assert_eq!(config.recent_files.as_ref().unwrap().len(), 1);
  1290	
  1291	        let user = read_user(base);
  1292	        assert!(!user.contains("recentFiles"));
  1293	        assert!(state_path(base).exists());
  1294	        assert!(legacy_path(base).exists(), "旧文件应保留");
  1295	
  1296	        // 二次加载不重复迁移，也不覆盖用户后续修改
  1297	        write_user(base, r#"{"theme":"warm"}"#);
  1298	        let again = load_config_at(base).unwrap();
  1299	        assert_eq!(again.theme.as_deref(), Some("warm"));
  1300	        assert!(read_user(base).contains("warm"));
  1301	    }
  1302	
  1303	    #[test]
  1304	    fn defaults_layer_is_created_once() {
  1305	        let dir = temp_base("defaults");
  1306	        let base = dir.path();
  1307	        load_config_at(base).unwrap();
  1308	        let path = defaults_path(base);
  1309	        assert!(path.exists());
  1310	
  1311	        // 已存在的 defaults 不再被覆盖（用户/测试改过也保留）
  1312	        std::fs::write(&path, r#"{"theme":"light"}"#).unwrap();
  1313	        let config = load_config_at(base).unwrap();
  1314	        assert_eq!(config.theme.as_deref(), Some("light"));
  1315	        assert_eq!(
  1316	            std::fs::read_to_string(&path).unwrap(),
  1317	            r#"{"theme":"light"}"#
  1318	        );
  1319	        // 其余键仍来自代码内默认
  1320	        assert_eq!(config.font_size, Some(17.0));
  1321	    }
  1322	
  1323	    #[test]
  1324	    fn state_layer_supplies_recent_files() {
  1325	        let dir = temp_base("state");
  1326	        let base = dir.path();
  1327	        write_user(base, r#"{"theme":"dark"}"#);
  1328	        std::fs::create_dir_all(state_path(base).parent().unwrap()).unwrap();
  1329	        std::fs::write(
  1330	            state_path(base),
  1331	            r#"{"recentFiles":[{"path":"/tmp/b.md","title":"b.md","openedAt":"2026-01-02T00:00:00Z"}],"scrollPositions":{}}"#,
  1332	        )
  1333	        .unwrap();
  1334	
  1335	        let config = load_config_at(base).unwrap();
  1336	        assert_eq!(config.theme.as_deref(), Some("dark"));
  1337	        let recent = config.recent_files.unwrap();
  1338	        assert_eq!(recent.len(), 1);
  1339	        assert_eq!(recent[0].path, "/tmp/b.md");
  1340	    }
  1341	
  1342	    #[test]
  1343	    fn embed_scroll_positions_round_trip_and_stay_out_of_user_file() {
  1344	        let dir = temp_base("embed_freeze");
  1345	        let base = dir.path();
  1346	
  1347	        // 老配置无该字段 → 默认空表，读得进。
  1348	        write_user(base, r#"{"theme":"dark"}"#);
  1349	        assert!(load_config_at(base)
  1350	            .unwrap()
  1351	            .embed_scroll_positions
  1352	            .unwrap()
  1353	            .is_empty());
  1354	
  1355	        let mut config = AppConfig::default();
  1356	        config.embed_scroll_positions = Some(HashMap::from([(
  1357	            "/tmp/doc.md\u{0}assets/note.md".into(),
  1358	            ScrollPosition {
  1359	                scroll_pos: 120.0,
  1360	                content_height: 900.0,
  1361	            },
  1362	        )]));
  1363	        save_config_at(base, &config).unwrap();
  1364	
  1365	        let user = read_user(base);
  1366	        assert!(
  1367	            !user.contains("embedScrollPositions"),
  1368	            "user 层不应含 embedScrollPositions: {user}"
  1369	        );
  1370	        let state = std::fs::read_to_string(state_path(base)).unwrap();
  1371	        assert!(state.contains("embedScrollPositions"));
  1372	        let loaded = load_config_at(base).unwrap();
  1373	        let table = loaded.embed_scroll_positions.unwrap();
  1374	        let hit = table.get("/tmp/doc.md\u{0}assets/note.md").unwrap();
  1375	        assert_eq!(hit.scroll_pos, 120.0);

exec
/bin/zsh -lc "nl -ba src/hooks/useConfig.ts | sed -n '1,230p;250,590p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
     1	import { useEffect, useCallback, useRef } from "react";
     2	import { invoke } from "@tauri-apps/api/core";
     3	import { listen } from "@tauri-apps/api/event";
     4	import { useEditorStore } from "../stores/editorStore";
     5	import { useStore } from "../stores/index";
     6	import { useDocPropertyPanelStore } from "../stores/docPropertyPanel";
     7	import { isTauriEnv } from "../utils/tauri";
     8	import { log } from "../utils/log";
     9	import type {
    10	  AppConfig,
    11	  HeadingFonts,
    12	  PropertyBarConfig,
    13	  ScrollPosition,
    14	  Theme,
    15	} from "../types";
    16	import { normalizePropertyBar } from "../lib/propertyBarConfig";
    17	import {
    18	  applyCapabilityConfig,
    19	  serializeCapabilities,
    20	} from "../lib/capabilities";
    21	import {
    22	  parseSerializedLayout,
    23	  restoreLayout,
    24	  type SerializedNode,
    25	} from "../lib/paneTree";
    26	import {
    27	  DEFAULT_RAIL_VIEW_SPEC,
    28	  type RailDensity,
    29	  type RailLayout,
    30	  type RailViewSpec,
    31	} from "../lib/railView";
    32	import { DENSITY_HEIGHT, clampCardHeight } from "../lib/railCards";
    33	import { normalizePreviewSettings } from "../lib/previewAnchor";
    34	import {
    35	  DEFAULT_VIEW_SPEC,
    36	  normalizeViewSpec,
    37	  type ViewSpec,
    38	} from "../lib/aiViewSpec";
    39	import { ensureHeadingFonts, normalizeHeadingFonts } from "../lib/headingFonts";
    40	
    41	/** Snake-case config from Rust, mapped to camelCase in the store. */
    42	interface RustAppConfig {
    43	  fontSize: number | null;
    44	  headingColors: Record<string, string> | null;
    45	  headingFonts?: HeadingFonts | null;
    46	  readerFontSize: number | null;
    47	  readerWidth: number | null;
    48	  readerSkin: string | null;
    49	  defaultSavePath?: string | null;
    50	  ollamaEndpoint: string | null;
    51	  openaiEndpoint: string | null;
    52	  openaiModel: string | null;
    53	  translationProvider: string | null;
    54	  sourceLang: string | null;
    55	  targetLang: string | null;
    56	  theme: string | null;
    57	  aiConfirmDensity: string | null;
    58	  iconLabel: string | null;
    59	  sidebarLeftVisible: boolean | null;
    60	  sidebarRightVisible: boolean | null;
    61	  sidebarLeftWidth: number | null;
    62	  sidebarRightWidth: number | null;
    63	  horizontalSplitRatio: number | null;
    64	  verticalSplitRatio: number | null;
    65	  recentFiles: Array<{
    66	    path: string;
    67	    title: string;
    68	    openedAt: string;
    69	    excerpt?: string;
    70	  }> | null;
    71	  scrollPositions: Record<string, ScrollPosition> | null;
    72	  embedScrollPositions: Record<string, ScrollPosition> | null;
    73	  capabilities?: Record<string, boolean> | null;
    74	  rouletteSectors?: string[] | null;
    75	  rouletteHotkey?: string | null;
    76	  rouletteForm?: string | null;
    77	  roulettePosition?: { x: number; y: number } | null;
    78	  noticeDuration?: number | null;
    79	  htmlToolbarItems?: string[] | null;
    80	  paneLayout?: string | null;
    81	  railPinHidden?: boolean | null;
    82	  propertyBar?: {
    83	    displayStyle?: string | null;
    84	    displayDefault?: {
    85	      preview?: string | null;
    86	      edit?: string | null;
    87	    } | null;
    88	    newDocVisible?: boolean | null;
    89	  } | null;
    90	  railViewSpec?: {
    91	    layout: string | null;
    92	    density: string | null;
    93	    cardHeight?: number | null;
    94	  } | null;
    95	  previewSettings?: {
    96	    railHover: boolean | null;
    97	    gridMode: string | null;
    98	    enabled: boolean | null;
    99	  } | null;
   100	  aiViewSpec?: {
   101	    railLayout?: string | null;
   102	    railDensity?: string | null;
   103	    railCardHeight?: number | null;
   104	    blockColors?: boolean | null;
   105	    iconLabel?: string | null;
   106	    previewEnabled?: boolean | null;
   107	    railPinnedWidth?: number | null;
   108	    gridMode?: string | null;
   109	    gridGrouping?: string | null;
   110	    gridSort?: string | null;
   111	    unreadOnly?: boolean | null;
   112	    themeGroups?: boolean | null;
   113	    pinnedAndRecentOnly?: boolean | null;
   114	    pinnedSegmentScale?: number | null;
   115	  } | null;
   116	}
   117	
   118	const DEBOUNCE_MS = 500;
   119	
   120	const SAVE_ECHO_WINDOW_MS = 1500;
   121	let lastLocalSaveAt = 0;
   122	
   123	/** Apply theme to <html> element. */
   124	export function applyTheme(theme: string): void {
   125	  const root = document.documentElement;
   126	  if (!root) return;
   127	  const isDark =
   128	    theme === "dark" ||
   129	    (theme === "system" &&
   130	      window.matchMedia("(prefers-color-scheme: dark)").matches);
   131	
   132	  root.classList.toggle("dark", isDark);
   133	  root.classList.toggle("warm", !isDark && theme === "warm");
   134	}
   135	
   136	/** Apply theme to <html> element. */
   137	export function applyReaderSkin(skin: string): void {
   138	  document.documentElement.dataset.skin = skin || "paper";
   139	}
   140	
   141	/** Persist the current editor + app config (module-level, callable outside hooks). */
   142	export async function saveAppConfig(): Promise<void> {
   143	  if (!isTauriEnv()) return;
   144	  lastLocalSaveAt = Date.now();
   145	  const es = useEditorStore.getState();
   146	  const config: RustAppConfig = {
   147	    fontSize: es.fontSize,
   148	    headingColors: es.headingColors
   149	      ? ({ ...es.headingColors } as unknown as Record<string, string>)
   150	      : null,
   151	    headingFonts: ensureHeadingFonts(es.config.headingFonts),
   152	    readerFontSize: es.config.readerFontSize ?? null,
   153	    readerWidth: es.config.readerWidth ?? null,
   154	    readerSkin: es.config.readerSkin ?? null,
   155	    defaultSavePath: es.config.defaultSavePath ?? null,
   156	    ollamaEndpoint: es.config.ollamaEndpoint ?? null,
   157	    openaiEndpoint: es.config.openaiEndpoint ?? null,
   158	    openaiModel: es.config.openaiModel ?? null,
   159	    translationProvider: es.config.translationProvider ?? null,
   160	    sourceLang: es.config.langPair?.source ?? null,
   161	    targetLang: es.config.langPair?.target ?? null,
   162	    theme: es.config.theme ?? null,
   163	    aiConfirmDensity: es.config.aiConfirmDensity ?? null,
   164	    iconLabel: es.config.iconLabel ?? null,
   165	    sidebarLeftVisible: es.config.sidebarLeftVisible ?? null,
   166	    sidebarRightVisible: es.config.sidebarRightVisible ?? null,
   167	    sidebarLeftWidth: es.config.sidebarLeftWidth ?? null,
   168	    sidebarRightWidth: es.config.sidebarRightWidth ?? null,
   169	    horizontalSplitRatio: es.config.horizontalSplitRatio ?? null,
   170	    verticalSplitRatio: es.config.verticalSplitRatio ?? null,
   171	    // 读 store 的实时值，不是加载时的陈旧快照——否则本次会话新开的文件
   172	    // 永远不会被持久化，门户下次启动又变成空的
   173	    recentFiles: useStore.getState().recentFiles,
   174	    scrollPositions: useStore.getState().scrollPositions ?? null,
   175	    embedScrollPositions: useStore.getState().embedScrollPositions ?? null,
   176	    capabilities: serializeCapabilities(),
   177	    rouletteSectors: es.config.rouletteSectors ?? null,
   178	    rouletteHotkey: es.config.rouletteHotkey ?? null,
   179	    rouletteForm: es.config.rouletteForm ?? null,
   180	    roulettePosition: es.config.roulettePosition ?? null,
   181	    noticeDuration: es.config.noticeDuration ?? null,
   182	    htmlToolbarItems: es.config.htmlToolbarItems ?? null,
   183	    // 读实时值：本次会话分裂/调整的比例要能持久化
   184	    paneLayout: useStore.getState().paneLayoutJson(),
   185	    railPinHidden: es.config.railPinHidden ?? null,
   186	    propertyBar: es.config.propertyBar ?? null,
   187	    // 阅读空间栏「设为默认」规格（layout-portal 6.1）
   188	    railViewSpec: useStore.getState().railViewSpec,
   189	    // 悬浮预览窗双轨开关（layout-portal 8.1）
   190	    previewSettings: useStore.getState().previewSettings,
   191	    // AI 视图改写规格（layout-portal 9.1）
   192	    aiViewSpec: useStore.getState().captureViewSpec(),
   193	  };
   194	  try {
   195	    await invoke("save_config", { config });
   196	  } catch (e) {
   197	    log.error("Config", "Failed to save config", e);
   198	  }
   199	}
   200	
   201	/** 文档属性面板样式桥接：设置改了显示样式立即换形态（字段内容与顺序不变）。 */
   202	export function applyPropertyBarConfig(config: PropertyBarConfig): void {
   203	  useDocPropertyPanelStore
   204	    .getState()
   205	    .setVariant(config.displayStyle === "dual" ? "B" : "A");
   206	}
   207	
   208	/**
   209	 * 启动时恢复工作区布局树（layout-portal 3.1）。
   210	 *
   211	 * 持久化的是每格页签的文件路径；这里按路径走 open_file_direct 把页签重建
   212	 * 出来，再按原结构还原。解析失败 / 文件已不在都退化处理，绝不抛错。
   213	 * 只在首次配置加载时跑一次（reloadAppConfig 重入由 guard 拦掉）。
   214	 */
   215	let paneRestoreStarted = false;
   216	
   217	async function restorePaneLayout(
   218	  paneLayoutJson: string | null | undefined,
   219	): Promise<void> {
   220	  if (paneRestoreStarted) return;
   221	  paneRestoreStarted = true;
   222	  if (!paneLayoutJson) return;
   223	
   224	  const parsed = parseSerializedLayout(paneLayoutJson);
   225	  if (!parsed) {
   226	    log.warn("Config", "paneLayout 解析失败，退回默认单格");
   227	    return;
   228	  }
   229	
   230	  const paths = new Set<string>();
   250	  for (const path of paths) {
   251	    if (idOfPath(path)) continue;
   252	    try {
   253	      const result = await invoke<{
   254	        content: string;
   255	        path: string;
   256	        file_size: number;
   257	      }>("open_file_direct", { path });
   258	      useStore.getState().openFile(result.path, result.content);
   259	    } catch (e) {
   260	      log.warn("Config", `布局恢复：文件打不开，跳过 ${path}`, e);
   261	    }
   262	  }
   263	
   264	  const { root, focusedId } = restoreLayout(parsed, idOfPath);
   265	  useStore.getState().restorePaneLayout(root, focusedId);
   266	}
   267	
   268	/**
   269	 * 阅读空间栏视图规格的合法取值；非法 / 缺失一律退回默认。
   270	 * 老配置没有 `rail_view_spec` 时走默认值，绝不抛错。
   271	 */
   272	function normalizeRailViewSpec(
   273	  raw: RustAppConfig["railViewSpec"],
   274	): RailViewSpec {
   275	  const layouts: RailLayout[] = ["stacked", "tabs"];
   276	  const densities: RailDensity[] = ["compact", "comfortable", "card"];
   277	  const layout = layouts.includes(raw?.layout as RailLayout)
   278	    ? (raw?.layout as RailLayout)
   279	    : DEFAULT_RAIL_VIEW_SPEC.layout;
   280	  const density = densities.includes(raw?.density as RailDensity)
   281	    ? (raw?.density as RailDensity)
   282	    : DEFAULT_RAIL_VIEW_SPEC.density;
   283	  const cardHeight = clampCardHeight(
   284	    raw?.cardHeight ?? DEFAULT_RAIL_VIEW_SPEC.cardHeight ?? DENSITY_HEIGHT.card,
   285	  );
   286	  // 卡片高度只属于卡片档；紧凑/舒适档保持 6.1 的规格形状（无该字段）
   287	  return density === "card"
   288	    ? { layout, density, cardHeight }
   289	    : { layout, density };
   290	}
   291	
   292	/**
   293	 * Map a Rust config onto the stores and the document.
   294	 * Touches config/theme only; never rewrites editor content.
   295	 */
   296	const ROULETTE_SECTOR_IDS = [
   297	  "smart",
   298	  "convert",
   299	  "align",
   300	  "columns",
   301	  "history",
   302	  "clear",
   303	  "format",
   304	  "color",
   305	] as const;
   306	
   307	export function normalizeRouletteSectors(
   308	  raw: string[] | null | undefined,
   309	): string[] | null {
   310	  if (!Array.isArray(raw) || raw.length === 0) return null;
   311	  const out: string[] = [];
   312	  for (const id of raw) {
   313	    if (!ROULETTE_SECTOR_IDS.some((known) => known === id)) {
   314	      log.warn("Config", `忽略未知轮盘扇区: ${id}`);
   315	      continue;
   316	    }
   317	    if (!out.includes(id)) out.push(id);
   318	  }
   319	  return out.length > 0 ? out : null;
   320	}
   321	
   322	const HTML_TOOLBAR_IDS = [
   323	  "ai-rewrite",
   324	  "ai-translate",
   325	  "ai-polish",
   326	  "format-bold",
   327	  "format-italic",
   328	  "format-underline",
   329	  "format-strike",
   330	  "format-code",
   331	  "format-link",
   332	  "align-left",
   333	  "align-center",
   334	  "align-right",
   335	] as const;
   336	
   337	export function normalizeHtmlToolbarItems(
   338	  raw: string[] | null | undefined,
   339	): string[] | null {
   340	  if (!Array.isArray(raw) || raw.length === 0) return null;
   341	  const out: string[] = [];
   342	  for (const id of raw) {
   343	    if (!HTML_TOOLBAR_IDS.some((known) => known === id)) {
   344	      log.warn("Config", `忽略未知工具条动作: ${id}`);
   345	      continue;
   346	    }
   347	    if (!out.includes(id)) out.push(id);
   348	  }
   349	  return out.length > 0 ? out : null;
   350	}
   351	
   352	/**
   353	 * 提示时长（ui-polish-batch15 4.1）：有限数、0.1–10、1 位小数才有效，
   354	 * 其余（含缺失）一律回落 null，消费端按默认 3 秒处理。
   355	 */
   356	export function normalizeNoticeDuration(
   357	  raw: number | null | undefined,
   358	): number | null {
   359	  if (raw == null || !Number.isFinite(raw)) return null;
   360	  if (raw < 0.1 || raw > 10) return null;
   361	  if (Math.abs(raw * 10 - Math.round(raw * 10)) > 1e-9) return null;
   362	  return raw;
   363	}
   364	
   365	/** 未配置「提示时长」时的回退延迟（ms）：tooltip 与页签信息窗共用（Q-缺陷4b 钉死 400ms）。 */
   366	export const NOTICE_DURATION_FALLBACK_MS = 400;
   367	const NOTICE_DURATION_MIN_MS = 100;
   368	const NOTICE_DURATION_MAX_MS = 10_000;
   369	
   370	/**
   371	 * 提示延迟（ms）：取配置「提示时长」（秒），钳制 100–10000ms，未配置回退 400ms。
   372	 * 悬停胶囊与页签信息窗共用同一回退值（单一来源）。
   373	 */
   374	export function noticeDurationMs(seconds: number | null | undefined): number {
   375	  if (seconds == null || !Number.isFinite(seconds))
   376	    return NOTICE_DURATION_FALLBACK_MS;
   377	  const ms = Math.round(seconds * 1000);
   378	  return Math.min(NOTICE_DURATION_MAX_MS, Math.max(NOTICE_DURATION_MIN_MS, ms));
   379	}
   380	
   381	function applyRustConfig(raw: RustAppConfig): void {
   382	  const { config: propertyBarConfig, warnings } = normalizePropertyBar(
   383	    raw.propertyBar,
   384	  );
   385	  if (warnings.length > 0) {
   386	    log.warn("Config", warnings.join("；"));
   387	  }
   388	  const config: Partial<AppConfig> = {
   389	    fontSize: raw.fontSize ?? 17,
   390	    headingColors: raw.headingColors
   391	      ? (raw.headingColors as unknown as AppConfig["headingColors"])
   392	      : undefined,
   393	    headingFonts: normalizeHeadingFonts(raw.headingFonts),
   394	    readerFontSize: raw.readerFontSize ?? 17,
   395	    readerWidth: raw.readerWidth ?? 1080,
   396	    readerSkin: raw.readerSkin ?? "paper",
   397	    defaultSavePath: raw.defaultSavePath ?? null,
   398	    ollamaEndpoint: raw.ollamaEndpoint ?? "http://localhost:11434",
   399	    openaiEndpoint: raw.openaiEndpoint ?? "https://api.openai.com",
   400	    openaiModel: raw.openaiModel ?? "gpt-4o-mini",
   401	    translationProvider:
   402	      (raw.translationProvider as AppConfig["translationProvider"]) ?? "ollama",
   403	    langPair: {
   404	      source: raw.sourceLang ?? "en",
   405	      target: raw.targetLang ?? "zh-CN",
   406	    },
   407	    theme: (raw.theme as Theme) ?? "system",
   408	    aiConfirmDensity:
   409	      (raw.aiConfirmDensity as AppConfig["aiConfirmDensity"]) ??
   410	      "session-silent",
   411	    iconLabel: (raw.iconLabel as AppConfig["iconLabel"]) ?? "text",
   412	    sidebarLeftVisible: raw.sidebarLeftVisible ?? true,
   413	    sidebarRightVisible: raw.sidebarRightVisible ?? false,
   414	    sidebarLeftWidth: raw.sidebarLeftWidth ?? 220,
   415	    sidebarRightWidth: raw.sidebarRightWidth ?? 320,
   416	    horizontalSplitRatio: raw.horizontalSplitRatio ?? 0.5,
   417	    verticalSplitRatio: raw.verticalSplitRatio ?? 0.5,
   418	    recentFiles: raw.recentFiles ?? [],
   419	    capabilities: raw.capabilities ?? {},
   420	    rouletteSectors: normalizeRouletteSectors(raw.rouletteSectors),
   421	    rouletteHotkey: raw.rouletteHotkey ? raw.rouletteHotkey : null,
   422	    rouletteForm:
   423	      raw.rouletteForm === "hub" || raw.rouletteForm === "disk"
   424	        ? raw.rouletteForm
   425	        : null,
   426	    roulettePosition:
   427	      raw.roulettePosition &&
   428	      Number.isFinite(raw.roulettePosition.x) &&
   429	      Number.isFinite(raw.roulettePosition.y)
   430	        ? { x: raw.roulettePosition.x, y: raw.roulettePosition.y }
   431	        : null,
   432	    noticeDuration: normalizeNoticeDuration(raw.noticeDuration),
   433	    htmlToolbarItems: normalizeHtmlToolbarItems(raw.htmlToolbarItems),
   434	    railPinHidden: raw.railPinHidden ?? false,
   435	    propertyBar: propertyBarConfig,
   436	  };
   437	
   438	  const es = useEditorStore.getState();
   439	  es.setConfig(config);
   440	  es.setFontSize(config.fontSize ?? 17);
   441	  es.setConfigLoaded(true);
   442	  useDocPropertyPanelStore
   443	    .getState()
   444	    .setVariant(propertyBarConfig.displayStyle === "dual" ? "B" : "A");
   445	
   446	  // Restore scroll positions (A-9)
   447	  useStore.getState().setScrollPositions(raw.scrollPositions ?? {});
   448	  // Restore embedded scroll freezes (D10 / B5b)
   449	  useStore.getState().setEmbedScrollPositions(raw.embedScrollPositions ?? {});
   450	
   451	  // Restore sidebar state
   452	  if (config.sidebarLeftVisible !== undefined) {
   453	    useStore.getState().setSidebarLeftVisible(config.sidebarLeftVisible);
   454	  }
   455	  if (config.sidebarRightVisible !== undefined) {
   456	    useStore.getState().setSidebarRightVisible(config.sidebarRightVisible);
   457	  }
   458	
   459	  // Restore split ratios
   460	  const splitRatios = {
   461	    horizontal: config.horizontalSplitRatio,
   462	    vertical: config.verticalSplitRatio,
   463	  };
   464	  useStore.getState().setSplitRatios(splitRatios);
   465	
   466	  // Sync recent files
   467	  if (config.recentFiles && config.recentFiles.length > 0) {
   468	    const { recentFiles } = useStore.getState();
   469	    if (recentFiles.length === 0) {
   470	      // 整体赋值而不是逐条 addRecentFile：那个 API 是前置插入，逐条加会把
   471	      // 持久化的「最近优先」顺序翻反——重启后门户 hero 会显示最旧的一份。
   472	      // 直接放回数组也保住了原来的 openedAt（否则相对时间全变成「刚刚」）。
   473	      useStore.setState({
   474	        recentFiles: config.recentFiles
   475	          .map((f) => ({
   476	            path: f.path,
   477	            title: f.title,
   478	            openedAt: f.openedAt,
   479	            excerpt: f.excerpt,
   480	          }))
   481	          .slice(0, 10),
   482	      });
   483	    }
   484	  }
   485	
   486	  applyTheme(config.theme ?? "system");
   487	  applyReaderSkin(config.readerSkin ?? "paper");
   488	  applyCapabilityConfig(raw.capabilities);
   489	
   490	  // 阅读空间栏视图规格（layout-portal 6.1）：老配置缺字段 → 默认；重启后与所设严格相等
   491	  const railSpec = normalizeRailViewSpec(raw.railViewSpec);
   492	  useStore.setState({
   493	    railViewSpec: railSpec,
   494	    railLayout: railSpec.layout,
   495	    railDensity: railSpec.density,
   496	    railCardHeight:
   497	      railSpec.cardHeight ??
   498	      clampCardHeight(
   499	        raw.railViewSpec?.cardHeight ??
   500	          DEFAULT_RAIL_VIEW_SPEC.cardHeight ??
   501	          DENSITY_HEIGHT.card,
   502	      ),
   503	  });
   504	
   505	  // 悬浮预览窗开关（layout-portal 8.1）：老配置缺字段 → 默认；非法值归一化
   506	  const previewSpec = normalizePreviewSettings(raw.previewSettings);
   507	  useStore.setState({ previewSettings: previewSpec });
   508	
   509	  // AI 视图规格（layout-portal 9.1）：最后应用，覆盖 rail/preview；缺字段回落
   510	  const baseViewSpec: ViewSpec = {
   511	    ...DEFAULT_VIEW_SPEC,
   512	    railLayout: railSpec.layout,
   513	    railDensity: railSpec.density,
   514	    railCardHeight: railSpec.cardHeight ?? DEFAULT_VIEW_SPEC.railCardHeight,
   515	    previewEnabled: previewSpec.enabled,
   516	    iconLabel: config.iconLabel ?? DEFAULT_VIEW_SPEC.iconLabel,
   517	  };
   518	  useStore
   519	    .getState()
   520	    .setViewSpec(normalizeViewSpec(raw.aiViewSpec, baseViewSpec));
   521	
   522	  // 布局树恢复放在配置生效之后：它依赖 tabs 记录与页签打开流程
   523	  void restorePaneLayout(raw.paneLayout);
   524	}
   525	
   526	/** Re-read the effective config from Rust and apply it without touching content. */
   527	export function reloadAppConfig(force = false): void {
   528	  if (!isTauriEnv()) return;
   529	  if (!force && Date.now() - lastLocalSaveAt < SAVE_ECHO_WINDOW_MS) return;
   530	  invoke<RustAppConfig>("load_config")
   531	    .then(applyRustConfig)
   532	    .catch((e) => log.error("Config", "Failed to reload config", e));
   533	}
   534	
   535	export function useConfig() {
   536	  const configLoaded = useEditorStore((s) => s.configLoaded);
   537	  const configLoading = useEditorStore((s) => s.configLoading);
   538	  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
   539	  const loadedRef = useRef(false);
   540	
   541	  // Load config once on mount
   542	  useEffect(() => {
   543	    if (loadedRef.current) return;
   544	    loadedRef.current = true;
   545	
   546	    const editorStore = useEditorStore.getState();
   547	    editorStore.setConfigLoading(true);
   548	
   549	    // 浏览器环境（dev server / 无 Tauri mock 的 e2e）无 invoke：直接落默认配置。
   550	    if (!isTauriEnv()) {
   551	      const es = useEditorStore.getState();
   552	      es.setConfig({
   553	        fontSize: 17,
   554	        headingColors: undefined,
   555	        headingFonts: ensureHeadingFonts(null),
   556	        readerFontSize: 17,
   557	        readerWidth: 1080,
   558	        readerSkin: "paper",
   559	        ollamaEndpoint: "http://localhost:11434",
   560	        openaiEndpoint: "https://api.openai.com",
   561	        openaiModel: "gpt-4o-mini",
   562	        translationProvider: "ollama",
   563	        langPair: { source: "en", target: "zh-CN" },
   564	        theme: "system",
   565	        aiConfirmDensity: "session-silent",
   566	        sidebarLeftVisible: true,
   567	        sidebarRightVisible: false,
   568	        sidebarLeftWidth: 220,
   569	        sidebarRightWidth: 320,
   570	        horizontalSplitRatio: 0.5,
   571	        verticalSplitRatio: 0.5,
   572	        recentFiles: [],
   573	      });
   574	      es.setConfigLoaded(true);
   575	      es.setConfigLoading(false);
   576	      applyTheme("system");
   577	      applyReaderSkin("paper");
   578	      return;
   579	    }
   580	
   581	    invoke<RustAppConfig>("load_config")
   582	      .then(applyRustConfig)
   583	      .catch((e) => {
   584	        log.error("Config", "Failed to load config", e);
   585	      })
   586	      .finally(() => {
   587	        useEditorStore.getState().setConfigLoading(false);
   588	      });
   589	  }, []); // Only run once on mount
   590	

exec
/bin/zsh -lc "nl -ba src-tauri/src/commands/config_cmd.rs | sed -n '1,180p'; nl -ba src-tauri/src/commands/capture.rs | sed -n '1,240p;430,700p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
     1	use tauri::AppHandle;
     2	
     3	use crate::config;
     4	use crate::config::AppConfig;
     5	use crate::errors::AppError;
     6	use crate::extensions::ExtensionsSnapshot;
     7	
     8	/// Load configuration from disk.
     9	#[tauri::command]
    10	pub async fn load_config(app: AppHandle) -> Result<AppConfig, AppError> {
    11	    config::load_config(&app).await
    12	}
    13	
    14	/// Save configuration to disk.
    15	#[tauri::command]
    16	pub async fn save_config(app: AppHandle, config: AppConfig) -> Result<(), AppError> {
    17	    config::save_config(&app, &config).await
    18	}
    19	
    20	/// List config snapshots, oldest first.
    21	#[tauri::command]
    22	pub async fn list_config_snapshots(app: AppHandle) -> Result<Vec<String>, AppError> {
    23	    config::list_config_snapshots(&app).await
    24	}
    25	
    26	/// 本机已安装字体族（C1 / #853）；`enumerated=false` 表示退回预设兜底列表。
    27	#[tauri::command]
    28	pub fn list_system_fonts() -> crate::fonts::SystemFonts {
    29	    crate::fonts::system_fonts()
    30	}
    31	
    32	/// Restore a config snapshot; the current state is snapshotted first.
    33	#[tauri::command]
    34	pub async fn restore_config_snapshot(app: AppHandle, name: String) -> Result<AppConfig, AppError> {
    35	    config::restore_config_snapshot(&app, &name).await
    36	}
    37	
    38	/// Get API key from system keyring.
    39	#[tauri::command]
    40	pub async fn get_api_key(service: String, account: String) -> Result<Option<String>, AppError> {
    41	    config::get_api_key(&service, &account).await
    42	}
    43	
    44	/// Set API key in system keyring.
    45	#[tauri::command]
    46	pub async fn set_api_key(service: String, account: String, key: String) -> Result<(), AppError> {
    47	    config::set_api_key(&service, &account, &key).await
    48	}
    49	
    50	/// Delete API key from system keyring.
    51	#[tauri::command]
    52	pub async fn delete_api_key(service: String, account: String) -> Result<(), AppError> {
    53	    config::delete_api_key(&service, &account).await
    54	}
    55	
    56	/// Scan user extension directories (snippets / templates / theme.toml).
    57	#[tauri::command]
    58	pub fn list_extensions(app: AppHandle) -> Result<ExtensionsSnapshot, String> {
    59	    Ok(crate::extensions::scan_extensions(&config::config_base(
    60	        &app,
    61	    )))
    62	}
    63	
    64	#[cfg(test)]
    65	mod tests {
    66	    use super::*;
    67	
    68	    #[test]
    69	    fn test_config_default() {
    70	        let config = AppConfig::default();
    71	        assert_eq!(config.font_size, Some(17.0));
    72	        assert_eq!(
    73	            config.ollama_endpoint,
    74	            Some("http://localhost:11434".into())
    75	        );
    76	        assert_eq!(config.translation_provider, Some("ollama".into()));
    77	    }
    78	}
     1	use std::fs;
     2	
     3	use serde::{Deserialize, Serialize};
     4	
     5	use crate::errors::AppError;
     6	
     7	#[derive(Debug, Serialize, Deserialize, Clone)]
     8	#[serde(rename_all = "camelCase")]
     9	pub struct InboxEntry {
    10	    pub id: String,
    11	    pub content: String,
    12	    pub prefix: String,
    13	    pub captured_at: String,
    14	}
    15	
    16	#[derive(Debug, Serialize, Deserialize)]
    17	#[serde(rename_all = "camelCase")]
    18	pub struct InboxEntryInput {
    19	    pub id: String,
    20	    pub content: String,
    21	    pub prefix: String,
    22	    pub captured_at: String,
    23	}
    24	
    25	#[derive(Debug, Serialize, Deserialize)]
    26	#[serde(rename_all = "camelCase")]
    27	pub struct InboxEntryEdit {
    28	    pub date: String,
    29	    pub entry_id: String,
    30	    pub new_content: String,
    31	}
    32	
    33	#[derive(Debug, Serialize, Deserialize)]
    34	#[serde(rename_all = "camelCase")]
    35	pub struct InboxEntryDelete {
    36	    pub date: String,
    37	    pub entry_id: String,
    38	}
    39	
    40	#[derive(Debug, Serialize, Deserialize)]
    41	#[serde(rename_all = "camelCase")]
    42	pub struct InboxEntryArchive {
    43	    pub date: String,
    44	    pub entry_id: String,
    45	}
    46	
    47	#[cfg(test)]
    48	static TEST_INBOX_BASE: std::sync::Mutex<Option<std::path::PathBuf>> = std::sync::Mutex::new(None);
    49	
    50	#[cfg(test)]
    51	fn set_test_inbox_base(dir: std::path::PathBuf) {
    52	    *TEST_INBOX_BASE.lock().unwrap() = Some(dir);
    53	}
    54	
    55	fn inbox_base_dir() -> Result<std::path::PathBuf, AppError> {
    56	    #[cfg(test)]
    57	    {
    58	        if let Some(dir) = TEST_INBOX_BASE.lock().unwrap().clone() {
    59	            fs::create_dir_all(&dir).map_err(|e| AppError::Io {
    60	                context: "create test inbox dir".into(),
    61	                source: e,
    62	            })?;
    63	            return Ok(dir);
    64	        }
    65	    }
    66	    let home = dirs::home_dir().ok_or(AppError::Io {
    67	        context: "Cannot determine home dir".into(),
    68	        source: std::io::Error::new(std::io::ErrorKind::Other, "no home"),
    69	    })?;
    70	    let base = home.join("documents").join("inbox");
    71	    fs::create_dir_all(&base).map_err(|e| AppError::Io {
    72	        context: "create inbox dir".into(),
    73	        source: e,
    74	    })?;
    75	    Ok(base)
    76	}
    77	
    78	fn day_file_path(date: &str, active: bool) -> Result<std::path::PathBuf, AppError> {
    79	    let base = inbox_base_dir()?;
    80	    let filename = format!("inbox-{}.md", date);
    81	    if active {
    82	        Ok(base.join(&filename))
    83	    } else {
    84	        fs::create_dir_all(base.join("archive")).map_err(|e| AppError::Io {
    85	            context: "create archive dir".into(),
    86	            source: e,
    87	        })?;
    88	        Ok(base.join("archive").join(&filename))
    89	    }
    90	}
    91	
    92	fn format_entry(entry: &InboxEntryInput) -> String {
    93	    let prefix_char = entry.prefix.clone();
    94	    format!(
    95	        "---\ntime: {}\nprefix: {}\n---\n\n{}\n",
    96	        entry.captured_at, prefix_char, entry.content
    97	    )
    98	}
    99	
   100	/// time → id 嵌入编码（冒号/点 → 下划线），load 生成 id 与 CRUD 反解必须共用同一函数。
   101	fn encode_time_key(time: &str) -> String {
   102	    time.replace(':', "_").replace('.', "_")
   103	}
   104	
   105	/// 从 entry_id 提取 time_key（去掉 "cap-" 前缀与 "-{长度}" 后缀，保留编码）。
   106	fn time_key_from_entry_id(entry_id: &str) -> String {
   107	    entry_id
   108	        .rsplit_once('-')
   109	        .map(|(before, _)| before.strip_prefix("cap-").unwrap_or(before).to_string())
   110	        .unwrap_or_else(|| entry_id.to_string())
   111	}
   112	
   113	/// 块是否属于给定 time_key 的条目：行级解析 frontmatter 的 time 行并编码比较。
   114	fn block_matches_time_key(block: &str, time_key: &str) -> bool {
   115	    block.lines().any(|line| {
   116	        line.strip_prefix("time: ")
   117	            .map(|t| encode_time_key(t) == time_key)
   118	            .unwrap_or(false)
   119	    })
   120	}
   121	
   122	/// 归一化切块：按 "\n---\ntime: " 切分后，块 0 保留 "---\n" 前缀、其余块以裸时间值开头。
   123	/// 统一为 "time: {t}\nprefix: {p}\n---\n\n{content}" 的规范形态；空块返回 None。
   124	fn normalize_block(raw: &str) -> Option<String> {
   125	    let t = raw.trim_start_matches('\n').trim_end();
   126	    if t.is_empty() {
   127	        return None;
   128	    }
   129	    let bare = t.strip_prefix("---\n").unwrap_or(t);
   130	    if bare.starts_with("time: ") {
   131	        Some(bare.to_string())
   132	    } else {
   133	        Some(format!("time: {bare}"))
   134	    }
   135	}
   136	
   137	/// 把裸块（time: ... 开头）重组成与 append 写入一致的条目文件格式。
   138	fn join_blocks(blocks: &[String]) -> String {
   139	    if blocks.is_empty() {
   140	        return String::new();
   141	    }
   142	    let mut out = String::from("---\n");
   143	    out.push_str(&blocks.join("\n---\n"));
   144	    out
   145	}
   146	
   147	#[tauri::command]
   148	pub fn append_inbox(entry: InboxEntryInput) -> Result<(), AppError> {
   149	    let date = entry.captured_at.split('T').next().unwrap_or("unknown");
   150	    let path = day_file_path(date, true)?;
   151	    let new_content = format_entry(&entry);
   152	
   153	    let mut existing = if path.exists() {
   154	        fs::read_to_string(&path).unwrap_or_default()
   155	    } else {
   156	        String::new()
   157	    };
   158	    existing.push_str(&new_content);
   159	
   160	    let dir = path.parent().unwrap_or_else(|| std::path::Path::new("."));
   161	    let tmp = tempfile::NamedTempFile::new_in(dir).map_err(|e| AppError::Io {
   162	        context: "create temp file".into(),
   163	        source: e,
   164	    })?;
   165	    fs::write(&tmp, &existing).map_err(|e| AppError::Io {
   166	        context: "write temp".into(),
   167	        source: e,
   168	    })?;
   169	    tmp.persist(&path).map_err(|e| AppError::Io {
   170	        context: "persist".into(),
   171	        source: e.error,
   172	    })?;
   173	
   174	    Ok(())
   175	}
   176	
   177	#[tauri::command]
   178	pub fn append_inbox_batch(entries: Vec<InboxEntryInput>) -> Result<(), AppError> {
   179	    if entries.is_empty() {
   180	        return Ok(());
   181	    }
   182	
   183	    // 按 captured_at 日期分组，保持组内顺序与首次出现顺序
   184	    let mut groups: Vec<(String, Vec<InboxEntryInput>)> = Vec::new();
   185	    for entry in entries {
   186	        let date = entry
   187	            .captured_at
   188	            .split('T')
   189	            .next()
   190	            .unwrap_or("unknown")
   191	            .to_string();
   192	        match groups.iter_mut().find(|(d, _)| *d == date) {
   193	            Some((_, list)) => list.push(entry),
   194	            None => groups.push((date, vec![entry])),
   195	        }
   196	    }
   197	
   198	    // 每个 date 一次原子写：读现有 → 追加该 date 全部块 → 临时文件 → persist 替换
   199	    for (date, list) in groups {
   200	        let path = day_file_path(&date, true)?;
   201	        let mut existing = if path.exists() {
   202	            fs::read_to_string(&path).unwrap_or_default()
   203	        } else {
   204	            String::new()
   205	        };
   206	        for entry in &list {
   207	            existing.push_str(&format_entry(entry));
   208	        }
   209	
   210	        let dir = path.parent().unwrap_or_else(|| std::path::Path::new("."));
   211	        let tmp = tempfile::NamedTempFile::new_in(dir).map_err(|e| AppError::Io {
   212	            context: "create temp file".into(),
   213	            source: e,
   214	        })?;
   215	        fs::write(&tmp, &existing).map_err(|e| AppError::Io {
   216	            context: "write temp".into(),
   217	            source: e,
   218	        })?;
   219	        tmp.persist(&path).map_err(|e| AppError::Io {
   220	            context: "persist".into(),
   221	            source: e.error,
   222	        })?;
   223	    }
   224	
   225	    Ok(())
   226	}
   227	
   228	#[tauri::command]
   229	pub fn load_today_inbox() -> Result<Vec<InboxEntry>, AppError> {
   230	    let date = chrono::Local::now().format("%Y-%m-%d").to_string();
   231	    load_inbox_by_date(date)
   232	}
   233	
   234	#[tauri::command]
   235	pub fn load_inbox_by_date(date: String) -> Result<Vec<InboxEntry>, AppError> {
   236	    let path = day_file_path(&date, true)?;
   237	    if !path.exists() {
   238	        return Ok(vec![]);
   239	    }
   240	    let content = fs::read_to_string(&path)?;
   430	
   431	        let archive_dir = archive_path
   432	            .parent()
   433	            .unwrap_or_else(|| std::path::Path::new("."));
   434	        let tmp_a = tempfile::NamedTempFile::new_in(archive_dir).map_err(|e| AppError::Io {
   435	            context: "create archive temp file".into(),
   436	            source: e,
   437	        })?;
   438	        fs::write(&tmp_a, &archive_content).map_err(|e| AppError::Io {
   439	            context: "write archive".into(),
   440	            source: e,
   441	        })?;
   442	        tmp_a.persist(&archive_path).map_err(|e| AppError::Io {
   443	            context: "persist archive".into(),
   444	            source: e.error,
   445	        })?;
   446	    }
   447	
   448	    Ok(())
   449	}
   450	
   451	#[derive(Debug, Serialize, Deserialize)]
   452	#[serde(rename_all = "camelCase")]
   453	pub struct CaptureConfig {
   454	    pub font_size: Option<u32>,
   455	    pub position_x: Option<i32>,
   456	    pub position_y: Option<i32>,
   457	    pub capsule_x: Option<f64>,
   458	    pub capsule_y: Option<f64>,
   459	    pub pinned: Option<bool>,
   460	    pub overlay_width: Option<i32>,
   461	    pub overlay_height: Option<i32>,
   462	    pub panel_ratio: Option<f64>,
   463	}
   464	
   465	fn migrate_legacy_capture_config(legacy: &std::path::Path, target: &std::path::Path) {
   466	    if target.exists() || legacy == target || !legacy.exists() {
   467	        return;
   468	    }
   469	    let _ = fs::copy(legacy, target);
   470	}
   471	
   472	fn config_path() -> Result<std::path::PathBuf, AppError> {
   473	    let home = dirs::home_dir().ok_or(AppError::Io {
   474	        context: "Cannot determine home dir".into(),
   475	        source: std::io::Error::new(std::io::ErrorKind::Other, "no home"),
   476	    })?;
   477	    let dir = home.join(".biaoyue");
   478	    fs::create_dir_all(&dir).map_err(|e| AppError::Io {
   479	        context: "create .biaoyue dir".into(),
   480	        source: e,
   481	    })?;
   482	    let path = dir.join("config.toml");
   483	    let legacy = home.join(".clairis").join("config.toml");
   484	    migrate_legacy_capture_config(&legacy, &path);
   485	    Ok(path)
   486	}
   487	
   488	#[tauri::command]
   489	pub fn save_config_capture(capture_config: CaptureConfig) -> Result<(), AppError> {
   490	    let path = config_path()?;
   491	    let mut doc: toml::Value = if path.exists() {
   492	        let content = fs::read_to_string(&path).unwrap_or_default();
   493	        content
   494	            .parse::<toml::Value>()
   495	            .unwrap_or(toml::Value::Table(Default::default()))
   496	    } else {
   497	        toml::Value::Table(Default::default())
   498	    };
   499	
   500	    let table = doc.as_table_mut().ok_or_else(|| AppError::Io {
   501	        context: "config is not a table".into(),
   502	        source: std::io::Error::new(std::io::ErrorKind::Other, "not a table"),
   503	    })?;
   504	
   505	    let capture = table
   506	        .entry("capture".to_string())
   507	        .or_insert_with(|| toml::Value::Table(Default::default()))
   508	        .as_table_mut()
   509	        .ok_or_else(|| AppError::Io {
   510	            context: "capture section is not a table".into(),
   511	            source: std::io::Error::new(std::io::ErrorKind::Other, "not a table"),
   512	        })?;
   513	
   514	    if let Some(fs) = capture_config.font_size {
   515	        capture.insert("font_size".to_string(), toml::Value::Integer(fs as i64));
   516	    }
   517	    if let Some(px) = capture_config.position_x {
   518	        capture.insert("position_x".to_string(), toml::Value::Integer(px as i64));
   519	    }
   520	    if let Some(py) = capture_config.position_y {
   521	        capture.insert("position_y".to_string(), toml::Value::Integer(py as i64));
   522	    }
   523	    if let Some(cx) = capture_config.capsule_x {
   524	        capture.insert("capsule_x".to_string(), toml::Value::Float(cx));
   525	    }
   526	    if let Some(cy) = capture_config.capsule_y {
   527	        capture.insert("capsule_y".to_string(), toml::Value::Float(cy));
   528	    }
   529	    if let Some(p) = capture_config.pinned {
   530	        capture.insert("pinned".to_string(), toml::Value::Boolean(p));
   531	    }
   532	    if let Some(w) = capture_config.overlay_width {
   533	        capture.insert("overlay_width".to_string(), toml::Value::Integer(w as i64));
   534	    }
   535	    if let Some(h) = capture_config.overlay_height {
   536	        capture.insert("overlay_height".to_string(), toml::Value::Integer(h as i64));
   537	    }
   538	    if let Some(r) = capture_config.panel_ratio {
   539	        capture.insert("panel_ratio".to_string(), toml::Value::Float(r));
   540	    }
   541	
   542	    let toml_str = toml::to_string_pretty(&doc).map_err(|e| AppError::Io {
   543	        context: "serialize config".into(),
   544	        source: std::io::Error::new(std::io::ErrorKind::Other, e.to_string()),
   545	    })?;
   546	
   547	    let dir = path.parent().unwrap_or_else(|| std::path::Path::new("."));
   548	    let tmp = tempfile::NamedTempFile::new_in(dir).map_err(|e| AppError::Io {
   549	        context: "create temp config".into(),
   550	        source: e,
   551	    })?;
   552	    fs::write(&tmp, &toml_str).map_err(|e| AppError::Io {
   553	        context: "write config".into(),
   554	        source: e,
   555	    })?;
   556	    tmp.persist(&path).map_err(|e| AppError::Io {
   557	        context: "persist config".into(),
   558	        source: e.error,
   559	    })?;
   560	
   561	    Ok(())
   562	}
   563	
   564	#[tauri::command]
   565	pub fn set_overlay_pinned(app: tauri::AppHandle, pinned: bool) -> Result<(), AppError> {
   566	    use tauri::Manager;
   567	    if let Some(window) = app.get_webview_window("overlay") {
   568	        window.set_always_on_top(pinned).map_err(|e| AppError::Io {
   569	            context: "set always on top".into(),
   570	            source: std::io::Error::new(std::io::ErrorKind::Other, e.to_string()),
   571	        })?;
   572	    }
   573	    Ok(())
   574	}
   575	
   576	#[tauri::command]
   577	pub fn show_overlay_window(app: tauri::AppHandle) -> Result<(), AppError> {
   578	    use tauri::Manager;
   579	    if let Some(window) = app.get_webview_window("overlay") {
   580	        window.show().map_err(|e| AppError::Io {
   581	            context: "show overlay".into(),
   582	            source: std::io::Error::new(std::io::ErrorKind::Other, e.to_string()),
   583	        })?;
   584	        window.set_focus().map_err(|e| AppError::Io {
   585	            context: "focus overlay".into(),
   586	            source: std::io::Error::new(std::io::ErrorKind::Other, e.to_string()),
   587	        })?;
   588	    }
   589	    Ok(())
   590	}
   591	
   592	#[tauri::command]
   593	pub fn hide_overlay_window(app: tauri::AppHandle) -> Result<(), AppError> {
   594	    use tauri::Manager;
   595	    if let Some(window) = app.get_webview_window("overlay") {
   596	        window.hide().map_err(|e| AppError::Io {
   597	            context: "hide overlay".into(),
   598	            source: std::io::Error::new(std::io::ErrorKind::Other, e.to_string()),
   599	        })?;
   600	    }
   601	    Ok(())
   602	}
   603	
   604	#[tauri::command]
   605	pub fn load_config_capture() -> Result<CaptureConfig, AppError> {
   606	    let path = config_path()?;
   607	    if !path.exists() {
   608	        return Ok(CaptureConfig {
   609	            font_size: Some(15),
   610	            position_x: None,
   611	            position_y: None,
   612	            capsule_x: None,
   613	            capsule_y: None,
   614	            pinned: None,
   615	            overlay_width: None,
   616	            overlay_height: None,
   617	            panel_ratio: None,
   618	        });
   619	    }
   620	    let content = fs::read_to_string(&path)?;
   621	    let doc: toml::Value = content.parse::<toml::Value>().map_err(|e| AppError::Io {
   622	        context: "parse config.toml".into(),
   623	        source: std::io::Error::new(std::io::ErrorKind::Other, e.to_string()),
   624	    })?;
   625	
   626	    let font_size = doc
   627	        .get("capture")
   628	        .and_then(|c: &toml::Value| c.get("font_size"))
   629	        .and_then(|v: &toml::Value| v.as_integer())
   630	        .map(|v| v as u32);
   631	    let position_x = doc
   632	        .get("capture")
   633	        .and_then(|c: &toml::Value| c.get("position_x"))
   634	        .and_then(|v: &toml::Value| v.as_integer())
   635	        .map(|v| v as i32);
   636	    let position_y = doc
   637	        .get("capture")
   638	        .and_then(|c: &toml::Value| c.get("position_y"))
   639	        .and_then(|v: &toml::Value| v.as_integer())
   640	        .map(|v| v as i32);
   641	    let capsule_x = doc
   642	        .get("capture")
   643	        .and_then(|c: &toml::Value| c.get("capsule_x"))
   644	        .and_then(|v: &toml::Value| v.as_float());
   645	    let capsule_y = doc
   646	        .get("capture")
   647	        .and_then(|c: &toml::Value| c.get("capsule_y"))
   648	        .and_then(|v: &toml::Value| v.as_float());
   649	    let pinned = doc
   650	        .get("capture")
   651	        .and_then(|c: &toml::Value| c.get("pinned"))
   652	        .and_then(|v: &toml::Value| v.as_bool());
   653	    let overlay_width = doc
   654	        .get("capture")
   655	        .and_then(|c: &toml::Value| c.get("overlay_width"))
   656	        .and_then(|v: &toml::Value| v.as_integer())
   657	        .map(|v| v as i32);
   658	    let overlay_height = doc
   659	        .get("capture")
   660	        .and_then(|c: &toml::Value| c.get("overlay_height"))
   661	        .and_then(|v: &toml::Value| v.as_integer())
   662	        .map(|v| v as i32);
   663	    let panel_ratio = doc
   664	        .get("capture")
   665	        .and_then(|c: &toml::Value| c.get("panel_ratio"))
   666	        .and_then(|v: &toml::Value| v.as_float());
   667	
   668	    Ok(CaptureConfig {
   669	        font_size,
   670	        position_x,
   671	        position_y,
   672	        capsule_x,
   673	        capsule_y,
   674	        pinned,
   675	        overlay_width,
   676	        overlay_height,
   677	        panel_ratio,
   678	    })
   679	}
   680	
   681	#[cfg(test)]
   682	mod tests {
   683	    use super::*;
   684	    use std::fs;
   685	
   686	    // 测试共享 TEST_INBOX_BASE 静态，串行化避免并行测试互相覆盖
   687	    static TEST_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());
   688	
   689	    fn setup_inbox_dir(label: &str) -> std::path::PathBuf {
   690	        let dir = std::env::temp_dir().join(format!(
   691	            "biaoyue_test_inbox_{}_{}",
   692	            label,
   693	            std::process::id()
   694	        ));
   695	        let _ = fs::remove_dir_all(&dir);
   696	        fs::create_dir_all(&dir).unwrap();
   697	        set_test_inbox_base(dir.clone());
   698	        dir
   699	    }
   700	

exec
/bin/zsh -lc "nl -ba src-tauri/src/extensions.rs | sed -n '1,130p;280,375p;470,620p'; nl -ba src/lib/capabilities.ts | sed -n '1,240p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
     1	//! 用户扩展点（design §D1–D4）：snippets / templates / theme tokens。
     2	//!
     3	//! 只读用户配置目录下的数据文件，**不执行任何文件内容、不写任何文件**。
     4	//! 目录缺失或单个文件非法都只记录 warning 并继续，绝不报错中断。
     5	
     6	use serde::Serialize;
     7	use std::collections::BTreeMap;
     8	use std::path::Path;
     9	
    10	#[derive(Debug, Clone, PartialEq, Serialize)]
    11	pub struct Snippet {
    12	    pub id: String,
    13	    pub label: String,
    14	    pub keywords: Vec<String>,
    15	    pub icon: Option<String>,
    16	    pub body: String,
    17	    pub path: String,
    18	}
    19	
    20	#[derive(Debug, Clone, PartialEq, Serialize)]
    21	pub struct Template {
    22	    pub name: String,
    23	    pub body: String,
    24	    pub path: String,
    25	}
    26	
    27	#[derive(Debug, Clone, PartialEq, Serialize, Default)]
    28	pub struct ThemeTokens {
    29	    pub tokens: BTreeMap<String, String>,
    30	    pub warnings: Vec<String>,
    31	}
    32	
    33	#[derive(Debug, Clone, PartialEq, Serialize, Default)]
    34	pub struct ExtensionsSnapshot {
    35	    pub snippets: Vec<Snippet>,
    36	    pub templates: Vec<Template>,
    37	    pub theme: ThemeTokens,
    38	    pub warnings: Vec<String>,
    39	}
    40	
    41	/// frontmatter 值：标量或字符串列表。
    42	enum FrontValue {
    43	    Scalar(String),
    44	    List(Vec<String>),
    45	}
    46	
    47	/// 去掉成对引号（单/双）。
    48	fn unquote(value: &str) -> String {
    49	    let bytes = value.as_bytes();
    50	    if bytes.len() >= 2 {
    51	        let first = bytes[0];
    52	        let last = bytes[bytes.len() - 1];
    53	        if (first == b'"' && last == b'"') || (first == b'\'' && last == b'\'') {
    54	            return value[1..value.len() - 1].to_string();
    55	        }
    56	    }
    57	    value.to_string()
    58	}
    59	
    60	/// `id` 必须匹配 `[a-z0-9-]+`。
    61	fn is_valid_id(value: &str) -> bool {
    62	    !value.is_empty()
    63	        && value
    64	            .chars()
    65	            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
    66	}
    67	
    68	/// `src/styles/tokens.css` 已声明的 token 名（不含 `--app-` 前缀）。
    69	/// 新增内置 token 时同步此处；未声明的键一律忽略。
    70	const DECLARED_TOKENS: &[&str] = &[
    71	    "accent",
    72	    "accent-soft",
    73	    "bg",
    74	    "surface",
    75	    "sunken",
    76	    "text",
    77	    "text-strong",
    78	    "text-2",
    79	    "text-3",
    80	    "border",
    81	    "border-strong",
    82	    "radius",
    83	    "shadow",
    84	];
    85	
    86	/// 把 `theme.toml` 里的键规范化成 `--app-<name>`。
    87	/// `accent` 与 `--app-accent` 两种写法等价；未声明或形状非法返回 `None`。
    88	fn normalize_token_key(key: &str) -> Option<String> {
    89	    let name = key.strip_prefix("--app-").unwrap_or(key);
    90	    if name.is_empty()
    91	        || !name
    92	            .chars()
    93	            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
    94	    {
    95	        return None;
    96	    }
    97	    if !DECLARED_TOKENS.contains(&name) {
    98	        return None;
    99	    }
   100	    Some(format!("--app-{name}"))
   101	}
   102	
   103	/// 颜色白名单：`#rgb` / `#rrggbb` / `rgb(` / `rgba(` / `hsl(` / `hsla(` / 具名色。
   104	/// 明确拒绝 `url(` / `expression(` / `var(` 等可注入 CSS 的值。
   105	fn is_valid_color(value: &str) -> bool {
   106	    let value = value.trim();
   107	    if value.is_empty() {
   108	        return false;
   109	    }
   110	    for forbidden in ["url(", "expression(", "var("] {
   111	        if value.starts_with(forbidden) {
   112	            return false;
   113	        }
   114	    }
   115	    if let Some(hex) = value.strip_prefix('#') {
   116	        return (hex.len() == 3 || hex.len() == 6) && hex.chars().all(|c| c.is_ascii_hexdigit());
   117	    }
   118	    for func in ["rgb(", "rgba(", "hsl(", "hsla("] {
   119	        if value.starts_with(func) {
   120	            return value.ends_with(')');
   121	        }
   122	    }
   123	    // 具名色：仅字母（拒绝 `red; background:url(...)` 之类）
   124	    value.chars().all(|c| c.is_ascii_alphabetic())
   125	}
   126	
   127	/// 解析单个 snippet 文件。成功返回 `Some`，失败（缺 id / 非法 frontmatter /
   128	/// 未闭合）记录 warning 并返回 `None`。
   129	fn parse_snippet(raw: &str, rel: &str, path: &Path, warnings: &mut Vec<String>) -> Option<Snippet> {
   130	    // 容忍 UTF-8 BOM。
   280	        }
   281	    };
   282	
   283	    let mut templates: BTreeMap<String, Template> = BTreeMap::new();
   284	    for entry in entries.flatten() {
   285	        let path = entry.path();
   286	        if !path.is_file() {
   287	            continue;
   288	        }
   289	        let name = entry.file_name().to_string_lossy().into_owned();
   290	        if !name.ends_with(".md") {
   291	            continue;
   292	        }
   293	        let rel = format!("templates/{name}");
   294	        let Some(stem) = path.file_stem() else {
   295	            warnings.push(format!("{rel}: 无法解析文件名"));
   296	            continue;
   297	        };
   298	        let Ok(body) = std::fs::read_to_string(&path) else {
   299	            warnings.push(format!("{rel}: 读取失败"));
   300	            continue;
   301	        };
   302	        templates.insert(
   303	            stem.to_string_lossy().into_owned(),
   304	            Template {
   305	                name: stem.to_string_lossy().into_owned(),
   306	                body,
   307	                path: path.to_string_lossy().into_owned(),
   308	            },
   309	        );
   310	    }
   311	    templates.into_values().collect()
   312	}
   313	
   314	/// 读取 `<dir>/theme.toml` 的 `[tokens]` 表，白名单校验键与值。
   315	fn scan_theme(dir: &Path) -> ThemeTokens {
   316	    let path = dir.join("theme.toml");
   317	    let data = match std::fs::read_to_string(&path) {
   318	        Ok(data) => data,
   319	        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
   320	            return ThemeTokens::default();
   321	        }
   322	        Err(e) => {
   323	            return ThemeTokens {
   324	                tokens: BTreeMap::new(),
   325	                warnings: vec![format!("theme.toml: 读取失败（{e}）")],
   326	            };
   327	        }
   328	    };
   329	
   330	    let mut tokens = BTreeMap::new();
   331	    let mut invalid = 0usize;
   332	    let mut warnings = Vec::new();
   333	
   334	    match toml::from_str::<toml::Value>(&data) {
   335	        Ok(toml::Value::Table(table)) => {
   336	            if let Some(toml::Value::Table(token_table)) = table.get("tokens") {
   337	                for (key, value) in token_table {
   338	                    let Some(value) = value.as_str() else {
   339	                        invalid += 1;
   340	                        continue;
   341	                    };
   342	                    let Some(key) = normalize_token_key(key) else {
   343	                        invalid += 1;
   344	                        continue;
   345	                    };
   346	                    if !is_valid_color(value) {
   347	                        invalid += 1;
   348	                        continue;
   349	                    }
   350	                    tokens.insert(key, value.to_string());
   351	                }
   352	            }
   353	        }
   354	        Ok(_) => warnings.push("theme.toml: 顶层不是表".into()),
   355	        Err(e) => warnings.push(format!("theme.toml: 解析失败（{e}）")),
   356	    }
   357	
   358	    if invalid > 0 {
   359	        warnings.push(format!("theme.toml: 忽略 {invalid} 个非法 token"));
   360	    }
   361	
   362	    ThemeTokens { tokens, warnings }
   363	}
   364	
   365	/// 扫描用户扩展目录，返回快照。任何缺失/非法都只记录 warning，不报错。
   366	pub fn scan_extensions(config_dir: &Path) -> ExtensionsSnapshot {
   367	    let mut warnings = Vec::new();
   368	    let snippets = scan_snippets(config_dir, &mut warnings);
   369	    let templates = scan_templates(config_dir, &mut warnings);
   370	    let theme = scan_theme(config_dir);
   371	
   372	    ExtensionsSnapshot {
   373	        snippets,
   374	        templates,
   375	        theme,
   470	            "snippets/c.md",
   471	            "---\nid: ok\nbroken line\n---\n正文\n",
   472	        );
   473	
   474	        let snapshot = scan_extensions(base);
   475	
   476	        assert!(snapshot.snippets.is_empty());
   477	        assert_eq!(snapshot.warnings.len(), 3, "got {:?}", snapshot.warnings);
   478	        assert!(snapshot
   479	            .warnings
   480	            .iter()
   481	            .any(|w| w.contains("缺少 frontmatter")));
   482	        assert!(snapshot.warnings.iter().any(|w| w.contains("未闭合")));
   483	        assert!(snapshot.warnings.iter().any(|w| w.contains("无法解析")));
   484	    }
   485	
   486	    #[test]
   487	    fn missing_directories_return_empty_not_error() {
   488	        let dir = temp_dir("empty");
   489	        let base = dir.path();
   490	
   491	        let snapshot = scan_extensions(base);
   492	
   493	        assert!(snapshot.snippets.is_empty());
   494	        assert!(snapshot.templates.is_empty());
   495	        assert!(snapshot.theme.tokens.is_empty());
   496	        assert!(snapshot.theme.warnings.is_empty());
   497	        assert!(snapshot.warnings.is_empty());
   498	    }
   499	
   500	    #[test]
   501	    fn theme_valid_tokens_are_kept() {
   502	        let dir = temp_dir("theme_ok");
   503	        let base = dir.path();
   504	        write_file(
   505	            base,
   506	            "theme.toml",
   507	            "[tokens]\n--app-accent = \"#c2410c\"\n--app-bg = \"rgb(255, 255, 255)\"\n--app-text = \"red\"\n",
   508	        );
   509	
   510	        let snapshot = scan_extensions(base);
   511	
   512	        assert!(
   513	            snapshot.theme.warnings.is_empty(),
   514	            "got {:?}",
   515	            snapshot.theme.warnings
   516	        );
   517	        assert_eq!(
   518	            snapshot
   519	                .theme
   520	                .tokens
   521	                .get("--app-accent")
   522	                .map(String::as_str),
   523	            Some("#c2410c")
   524	        );
   525	        assert_eq!(
   526	            snapshot.theme.tokens.get("--app-bg").map(String::as_str),
   527	            Some("rgb(255, 255, 255)")
   528	        );
   529	        assert_eq!(
   530	            snapshot.theme.tokens.get("--app-text").map(String::as_str),
   531	            Some("red")
   532	        );
   533	    }
   534	
   535	    #[test]
   536	    fn theme_bare_token_name_matches_prefixed_form() {
   537	        let dir = temp_dir("theme_bare");
   538	        let base = dir.path();
   539	        write_file(
   540	            base,
   541	            "theme.toml",
   542	            "[tokens]\naccent = \"#c2410c\"\ntext-2 = \"#55595f\"\n",
   543	        );
   544	
   545	        let snapshot = scan_extensions(base);
   546	
   547	        assert!(
   548	            snapshot.theme.warnings.is_empty(),
   549	            "got {:?}",
   550	            snapshot.theme.warnings
   551	        );
   552	        assert_eq!(
   553	            snapshot
   554	                .theme
   555	                .tokens
   556	                .get("--app-accent")
   557	                .map(String::as_str),
   558	            Some("#c2410c")
   559	        );
   560	        assert_eq!(
   561	            snapshot
   562	                .theme
   563	                .tokens
   564	                .get("--app-text-2")
   565	                .map(String::as_str),
   566	            Some("#55595f")
   567	        );
   568	        assert!(!snapshot.theme.tokens.contains_key("accent"));
   569	    }
   570	
   571	    #[test]
   572	    fn theme_undeclared_app_prefixed_key_is_rejected() {
   573	        let dir = temp_dir("theme_undeclared");
   574	        let base = dir.path();
   575	        write_file(
   576	            base,
   577	            "theme.toml",
   578	            "[tokens]\n--app-not-a-real-token = \"#fff\"\n--app-accent = \"#c2410c\"\n",
   579	        );
   580	
   581	        let snapshot = scan_extensions(base);
   582	
   583	        assert_eq!(snapshot.theme.tokens.len(), 1);
   584	        assert!(snapshot.theme.tokens.contains_key("--app-accent"));
   585	        assert_eq!(
   586	            snapshot.theme.warnings.len(),
   587	            1,
   588	            "got {:?}",
   589	            snapshot.theme.warnings
   590	        );
   591	        assert!(snapshot.theme.warnings[0].contains("忽略 1 个非法 token"));
   592	    }
   593	
   594	    #[test]
   595	    fn theme_invalid_keys_and_values_are_aggregated_into_one_warning() {
   596	        let dir = temp_dir("theme_bad");
   597	        let base = dir.path();
   598	        write_file(
   599	            base,
   600	            "theme.toml",
   601	            "[tokens]\n--app-accent = \"#c2410c\"\n--unknown = \"#fff\"\n--app-bg = \"url(http://x)\"\n--app-text = \"expression(alert(1))\"\n",
   602	        );
   603	
   604	        let snapshot = scan_extensions(base);
   605	
   606	        // 只有合法的那个保留
   607	        assert_eq!(snapshot.theme.tokens.len(), 1);
   608	        assert!(snapshot.theme.tokens.contains_key("--app-accent"));
   609	        // 3 个非法项聚合成一条 warning
   610	        assert_eq!(
   611	            snapshot.theme.warnings.len(),
   612	            1,
   613	            "got {:?}",
   614	            snapshot.theme.warnings
   615	        );
   616	        assert!(
   617	            snapshot.theme.warnings[0].contains("忽略 3 个非法 token"),
   618	            "got {:?}",
   619	            snapshot.theme.warnings
   620	        );
     1	/* 核心能力开关（design §D5 / spec X-3）。
     2	 *
     3	 * 每个内置能力一个稳定 id，默认全开。`enable()/disable()` 幂等：重复调用同一
     4	 * 状态不产生任何通知，订阅者只在模块加载时注册一次，因此不会重复挂监听或 DOM。
     5	 *
     6	 * 关闭语义 = 停用渲染/交互路径，**不删用户数据**：源码文本始终留在文档里，
     7	 * 只是不再被水合成图、公式或高亮。
     8	 */
     9	
    10	export type CapabilityId =
    11	  "math" | "code-highlight" | "mermaid" | "preview-zoom";
    12	
    13	export interface CapabilityMeta {
    14	  id: CapabilityId;
    15	  label: string;
    16	  hint: string;
    17	}
    18	
    19	/** 展示顺序即设置面板里的顺序。 */
    20	export const CAPABILITY_META: readonly CapabilityMeta[] = [
    21	  { id: "math", label: "数学公式", hint: "关闭后 $$…$$ 显示为原文" },
    22	  { id: "code-highlight", label: "代码高亮", hint: "关闭后代码块显示为纯文本" },
    23	  { id: "mermaid", label: "图表水合", hint: "关闭后图显示为源码块" },
    24	  {
    25	    id: "preview-zoom",
    26	    label: "预览缩放",
    27	    hint: "关闭后 Ctrl+滚轮/捏合不缩放",
    28	  },
    29	];
    30	
    31	const ALL_IDS: readonly CapabilityId[] = CAPABILITY_META.map((m) => m.id);
    32	
    33	type Listener = (id: CapabilityId, enabled: boolean) => void;
    34	
    35	const state = new Map<CapabilityId, boolean>(ALL_IDS.map((id) => [id, true]));
    36	const listeners = new Set<Listener>();
    37	
    38	/** 当前是否启用；未知 id 视为启用（宁可不拦）。 */
    39	export function isCapabilityEnabled(id: CapabilityId): boolean {
    40	  return state.get(id) ?? true;
    41	}
    42	
    43	/** 幂等切换：状态未变则不通知，返回是否真的变了。 */
    44	export function setCapabilityEnabled(
    45	  id: CapabilityId,
    46	  enabled: boolean,
    47	): boolean {
    48	  const current = state.get(id) ?? true;
    49	  if (current === enabled) return false;
    50	  state.set(id, enabled);
    51	  for (const listener of listeners) listener(id, enabled);
    52	  return true;
    53	}
    54	
    55	export const enableCapability = (id: CapabilityId): boolean =>
    56	  setCapabilityEnabled(id, true);
    57	export const disableCapability = (id: CapabilityId): boolean =>
    58	  setCapabilityEnabled(id, false);
    59	
    60	/** 订阅能力变化；同一个函数重复订阅只保留一份。返回退订函数。 */
    61	export function subscribeCapability(listener: Listener): () => void {
    62	  listeners.add(listener);
    63	  return () => {
    64	    listeners.delete(listener);
    65	  };
    66	}
    67	
    68	export interface CapabilityView extends CapabilityMeta {
    69	  enabled: boolean;
    70	}
    71	
    72	/** 设置面板用的快照（按展示顺序）。 */
    73	export function listCapabilities(): CapabilityView[] {
    74	  return CAPABILITY_META.map((meta) => ({
    75	    ...meta,
    76	    enabled: isCapabilityEnabled(meta.id),
    77	  }));
    78	}
    79	
    80	/** 可持久化的开关表：只包含被显式关闭的项，默认全开的项不落盘。 */
    81	export function serializeCapabilities(): Record<string, boolean> {
    82	  const out: Record<string, boolean> = {};
    83	  for (const id of ALL_IDS) {
    84	    if (!isCapabilityEnabled(id)) out[id] = false;
    85	  }
    86	  return out;
    87	}
    88	
    89	/**
    90	 * 应用持久化的开关表。未出现的 id 保持默认（开），未知 id 忽略。
    91	 * 只在值真的变化时逐项通知，因此重复加载同一份配置不会重复触发副作用。
    92	 */
    93	export function applyCapabilityConfig(
    94	  config: Record<string, unknown> | null | undefined,
    95	): void {
    96	  if (!config) return;
    97	  for (const id of ALL_IDS) {
    98	    const raw = config[id];
    99	    const enabled = raw === undefined ? true : raw !== false;
   100	    setCapabilityEnabled(id, enabled);
   101	  }
   102	}
   103	
   104	/**
   105	 * 测试用：恢复全开。
   106	 * 不动订阅者——渲染模块在 import 时就订阅了一次，清掉会让它们静默失效。
   107	 */
   108	export function resetCapabilities(): void {
   109	  for (const id of ALL_IDS) state.set(id, true);
   110	}

exec
/bin/zsh -lc "nl -ba src-tauri/src/config.rs | sed -n '240,330p;460,750p;990,1080p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
   240	    }
   241	}
   242	
   243	#[derive(Debug, Serialize, Deserialize, Clone)]
   244	pub struct HeadingColors {
   245	    pub h1: Option<String>,
   246	    pub h2: Option<String>,
   247	    pub h3: Option<String>,
   248	    pub h4: Option<String>,
   249	    pub h5: Option<String>,
   250	    pub h6: Option<String>,
   251	}
   252	
   253	/// 标题逐级字体（C1 / #853）：H1–H6 各一个 CSS font-family 列表，缺省回落默认栈。
   254	#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
   255	#[serde(rename_all = "camelCase")]
   256	pub struct HeadingFonts {
   257	    pub h1: Option<String>,
   258	    pub h2: Option<String>,
   259	    pub h3: Option<String>,
   260	    pub h4: Option<String>,
   261	    pub h5: Option<String>,
   262	    pub h6: Option<String>,
   263	}
   264	
   265	// ── 目录布局（design §D1）─────────────────────────────────────
   266	
   267	const DEFAULTS_FILE: &str = "settings.json";
   268	const USER_FILE: &str = "settings.json";
   269	const STATE_FILE: &str = "state.json";
   270	const LEGACY_FILE: &str = "app_config.json";
   271	const SNAPSHOT_PREFIX: &str = "settings-";
   272	const SNAPSHOT_LIMIT: usize = 10;
   273	
   274	fn defaults_path(base: &Path) -> PathBuf {
   275	    base.join("defaults").join(DEFAULTS_FILE)
   276	}
   277	
   278	fn user_path(base: &Path) -> PathBuf {
   279	    base.join("user").join(USER_FILE)
   280	}
   281	
   282	fn state_path(base: &Path) -> PathBuf {
   283	    base.join("state").join(STATE_FILE)
   284	}
   285	
   286	fn snapshots_dir(base: &Path) -> PathBuf {
   287	    base.join("snapshots")
   288	}
   289	
   290	/// 旧版单文件配置（分层改造前的 `app_config.json`）。
   291	fn legacy_path(base: &Path) -> PathBuf {
   292	    base.join(LEGACY_FILE)
   293	}
   294	
   295	// ── 原子写（design §D2）───────────────────────────────────────
   296	
   297	fn io_err(context: &str, source: std::io::Error) -> AppError {
   298	    AppError::Io {
   299	        context: context.into(),
   300	        source,
   301	    }
   302	}
   303	
   304	fn json_err(context: &str, source: serde_json::Error) -> AppError {
   305	    AppError::Serialization {
   306	        context: context.into(),
   307	        source,
   308	    }
   309	}
   310	
   311	/// 同目录临时文件 → fsync → rename。任一步失败都删除临时文件并返回错误，
   312	/// 目标文件保持写入前的字节不变（rename 是原子替换）。
   313	fn atomic_write(path: &Path, data: &[u8]) -> Result<(), AppError> {
   314	    let dir = path
   315	        .parent()
   316	        .ok_or_else(|| io_err("atomic write", std::io::Error::other("path has no parent")))?;
   317	    std::fs::create_dir_all(dir).map_err(|e| io_err("create config dir", e))?;
   318	
   319	    let nanos = SystemTime::now()
   320	        .duration_since(UNIX_EPOCH)
   321	        .map(|d| d.as_nanos())
   322	        .unwrap_or_default();
   323	    let file_name = path
   324	        .file_name()
   325	        .map(|n| n.to_string_lossy().into_owned())
   326	        .unwrap_or_else(|| "config".into());
   327	    let tmp = dir.join(format!(".{file_name}.tmp-{}-{nanos}", std::process::id()));
   328	
   329	    let result = (|| -> std::io::Result<()> {
   330	        let mut file = std::fs::File::create(&tmp)?;
   460	
   461	// ── 校验（design §D5）────────────────────────────────────────
   462	
   463	fn check_range(field: &str, value: Option<f64>, min: f64, max: f64) -> Result<(), AppError> {
   464	    match value {
   465	        Some(v) if !(min..=max).contains(&v) => Err(AppError::Validation {
   466	            context: field.into(),
   467	            message: format!("{v} 超出范围 {min}–{max}"),
   468	        }),
   469	        _ => Ok(()),
   470	    }
   471	}
   472	
   473	fn check_enum(field: &str, value: Option<&str>, allowed: &[&str]) -> Result<(), AppError> {
   474	    match value {
   475	        Some(v) if !allowed.contains(&v) => Err(AppError::Validation {
   476	            context: field.into(),
   477	            message: format!("{v} 不属于 {}", allowed.join("|")),
   478	        }),
   479	        _ => Ok(()),
   480	    }
   481	}
   482	
   483	/// 提示时长（ui-polish-batch15 4.1）：有限数、0.1–10、最多 1 位小数。
   484	fn check_notice_duration(value: Option<f64>) -> Result<(), AppError> {
   485	    let Some(v) = value else { return Ok(()) };
   486	    if !v.is_finite() {
   487	        return Err(AppError::Validation {
   488	            context: "noticeDuration".into(),
   489	            message: "必须是有限数值".into(),
   490	        });
   491	    }
   492	    if !(0.1..=10.0).contains(&v) {
   493	        return Err(AppError::Validation {
   494	            context: "noticeDuration".into(),
   495	            message: format!("{v} 超出范围 0.1–10"),
   496	        });
   497	    }
   498	    if (v * 10.0 - (v * 10.0).round()).abs() > 1e-9 {
   499	        return Err(AppError::Validation {
   500	            context: "noticeDuration".into(),
   501	            message: format!("{v} 最多 1 位小数"),
   502	        });
   503	    }
   504	    Ok(())
   505	}
   506	
   507	/// 字体族（C1 / #853）：非空、无控制字符、无 CSS 结构字符、长度受限。
   508	/// 系统可用性无法在同步校验里真判（枚举需起子进程），由设置面板的枚举列表保证。
   509	fn check_font_family(field: &str, value: &str) -> Result<(), AppError> {
   510	    let trimmed = value.trim();
   511	    if trimmed.is_empty() {
   512	        return Err(AppError::Validation {
   513	            context: field.into(),
   514	            message: "字体族不能为空".into(),
   515	        });
   516	    }
   517	    if trimmed.chars().any(|c| c.is_control()) {
   518	        return Err(AppError::Validation {
   519	            context: field.into(),
   520	            message: "字体族不能包含控制字符".into(),
   521	        });
   522	    }
   523	    if trimmed.chars().count() > 300 {
   524	        return Err(AppError::Validation {
   525	            context: field.into(),
   526	            message: "字体族过长（上限 300 字符）".into(),
   527	        });
   528	    }
   529	    if trimmed.contains(['{', '}', '<', '>', '\\', '`']) {
   530	        return Err(AppError::Validation {
   531	            context: field.into(),
   532	            message: "字体族含非法字符".into(),
   533	        });
   534	    }
   535	    Ok(())
   536	}
   537	
   538	fn check_heading_fonts(fonts: &Option<HeadingFonts>) -> Result<(), AppError> {
   539	    let Some(fonts) = fonts else { return Ok(()) };
   540	    for (level, value) in [
   541	        ("h1", &fonts.h1),
   542	        ("h2", &fonts.h2),
   543	        ("h3", &fonts.h3),
   544	        ("h4", &fonts.h4),
   545	        ("h5", &fonts.h5),
   546	        ("h6", &fonts.h6),
   547	    ] {
   548	        if let Some(v) = value {
   549	            check_font_family(&format!("headingFonts.{level}"), v)?;
   550	        }
   551	    }
   552	    Ok(())
   553	}
   554	
   555	pub fn validate_config(config: &AppConfig) -> Result<(), AppError> {
   556	    check_range("fontSize", config.font_size, 8.0, 96.0)?;
   557	    check_range("readerFontSize", config.reader_font_size, 8.0, 96.0)?;
   558	    check_range("readerWidth", config.reader_width, 480.0, 2400.0)?;
   559	    check_range("sidebarLeftWidth", config.sidebar_left_width, 0.0, 800.0)?;
   560	    check_range("sidebarRightWidth", config.sidebar_right_width, 0.0, 800.0)?;
   561	    check_range(
   562	        "horizontalSplitRatio",
   563	        config.horizontal_split_ratio,
   564	        0.0,
   565	        1.0,
   566	    )?;
   567	    check_range("verticalSplitRatio", config.vertical_split_ratio, 0.0, 1.0)?;
   568	    check_enum(
   569	        "theme",
   570	        config.theme.as_deref(),
   571	        &["light", "dark", "warm", "system"],
   572	    )?;
   573	    check_enum(
   574	        "aiConfirmDensity",
   575	        config.ai_confirm_density.as_deref(),
   576	        &["always", "session-silent", "never"],
   577	    )?;
   578	    check_enum(
   579	        "iconLabel",
   580	        config.icon_label.as_deref(),
   581	        &["auto", "text", "icon"],
   582	    )?;
   583	    check_enum(
   584	        "readerSkin",
   585	        config.reader_skin.as_deref(),
   586	        &["paper", "plain"],
   587	    )?;
   588	    if let Some(spec) = &config.rail_view_spec {
   589	        check_enum(
   590	            "railViewSpec.layout",
   591	            spec.layout.as_deref(),
   592	            &["stacked", "tabs"],
   593	        )?;
   594	        check_enum(
   595	            "railViewSpec.density",
   596	            spec.density.as_deref(),
   597	            &["compact", "comfortable", "card"],
   598	        )?;
   599	        check_range("railViewSpec.cardHeight", spec.card_height, 88.0, 160.0)?;
   600	    }
   601	    if let Some(preview) = &config.preview_settings {
   602	        check_enum(
   603	            "previewSettings.gridMode",
   604	            preview.grid_mode.as_deref(),
   605	            &["hover", "click", "off"],
   606	        )?;
   607	    }
   608	    if let Some(spec) = &config.ai_view_spec {
   609	        check_enum(
   610	            "aiViewSpec.railLayout",
   611	            spec.rail_layout.as_deref(),
   612	            &["stacked", "tabs"],
   613	        )?;
   614	        check_enum(
   615	            "aiViewSpec.railDensity",
   616	            spec.rail_density.as_deref(),
   617	            &["compact", "comfortable", "card"],
   618	        )?;
   619	        check_enum(
   620	            "aiViewSpec.iconLabel",
   621	            spec.icon_label.as_deref(),
   622	            &["auto", "text", "icon"],
   623	        )?;
   624	        check_enum(
   625	            "aiViewSpec.gridMode",
   626	            spec.grid_mode.as_deref(),
   627	            &["grid", "list"],
   628	        )?;
   629	        check_enum(
   630	            "aiViewSpec.gridGrouping",
   631	            spec.grid_grouping.as_deref(),
   632	            &["time", "none", "type"],
   633	        )?;
   634	        check_enum(
   635	            "aiViewSpec.gridSort",
   636	            spec.grid_sort.as_deref(),
   637	            &["recent", "name", "type"],
   638	        )?;
   639	        check_range(
   640	            "aiViewSpec.railCardHeight",
   641	            spec.rail_card_height,
   642	            88.0,
   643	            160.0,
   644	        )?;
   645	        check_range(
   646	            "aiViewSpec.railPinnedWidth",
   647	            spec.rail_pinned_width,
   648	            200.0,
   649	            360.0,
   650	        )?;
   651	        check_range(
   652	            "aiViewSpec.pinnedSegmentScale",
   653	            spec.pinned_segment_scale,
   654	            1.0,
   655	            1.5,
   656	        )?;
   657	    }
   658	    if let Some(sectors) = &config.roulette_sectors {
   659	        const ALLOWED: [&str; 8] = [
   660	            "smart", "convert", "align", "columns", "history", "clear", "format", "color",
   661	        ];
   662	        if sectors.is_empty() || sectors.len() > ALLOWED.len() {
   663	            return Err(AppError::Validation {
   664	                context: "rouletteSectors".into(),
   665	                message: "长度须在 1..=8".into(),
   666	            });
   667	        }
   668	        let mut seen = std::collections::HashSet::new();
   669	        for id in sectors {
   670	            if !ALLOWED.contains(&id.as_str()) {
   671	                return Err(AppError::Validation {
   672	                    context: "rouletteSectors".into(),
   673	                    message: format!("未知扇区: {id}"),
   674	                });
   675	            }
   676	            if !seen.insert(id.as_str()) {
   677	                return Err(AppError::Validation {
   678	                    context: "rouletteSectors".into(),
   679	                    message: format!("重复扇区: {id}"),
   680	                });
   681	            }
   682	        }
   683	    }
   684	    if let Some(form) = &config.roulette_form {
   685	        check_enum("rouletteForm", Some(form.as_str()), &["hub", "disk"])?;
   686	    }
   687	    check_notice_duration(config.notice_duration)?;
   688	    check_heading_fonts(&config.heading_fonts)?;
   689	    if let Some(pos) = &config.roulette_position {
   690	        check_range("roulettePosition.x", Some(pos.x), -20000.0, 20000.0)?;
   691	        check_range("roulettePosition.y", Some(pos.y), -20000.0, 20000.0)?;
   692	    }
   693	    if let Some(bar) = &config.property_bar {
   694	        check_enum(
   695	            "propertyBar.displayStyle",
   696	            bar.display_style.as_deref(),
   697	            &["list", "dual"],
   698	        )?;
   699	        if let Some(defaults) = &bar.display_default {
   700	            check_enum(
   701	                "propertyBar.displayDefault.preview",
   702	                defaults.preview.as_deref(),
   703	                &["show", "collapse", "hide"],
   704	            )?;
   705	            check_enum(
   706	                "propertyBar.displayDefault.edit",
   707	                defaults.edit.as_deref(),
   708	                &["show", "collapse", "hide"],
   709	            )?;
   710	        }
   711	    }
   712	    if let Some(items) = &config.html_toolbar_items {
   713	        const ALLOWED: [&str; 12] = [
   714	            "ai-rewrite",
   715	            "ai-translate",
   716	            "ai-polish",
   717	            "format-bold",
   718	            "format-italic",
   719	            "format-underline",
   720	            "format-strike",
   721	            "format-code",
   722	            "format-link",
   723	            "align-left",
   724	            "align-center",
   725	            "align-right",
   726	        ];
   727	        if items.is_empty() || items.len() > ALLOWED.len() {
   728	            return Err(AppError::Validation {
   729	                context: "htmlToolbarItems".into(),
   730	                message: "长度须在 1..=12".into(),
   731	            });
   732	        }
   733	        let mut seen = std::collections::HashSet::new();
   734	        for id in items {
   735	            if !ALLOWED.contains(&id.as_str()) {
   736	                return Err(AppError::Validation {
   737	                    context: "htmlToolbarItems".into(),
   738	                    message: format!("未知动作: {id}"),
   739	                });
   740	            }
   741	            if !seen.insert(id.as_str()) {
   742	                return Err(AppError::Validation {
   743	                    context: "htmlToolbarItems".into(),
   744	                    message: format!("重复动作: {id}"),
   745	                });
   746	            }
   747	        }
   748	    }
   749	    Ok(())
   750	}
   990	pub async fn restore_config_snapshot(app: &AppHandle, name: &str) -> Result<AppConfig, AppError> {
   991	    restore_snapshot(&config_base(app), name)
   992	}
   993	
   994	/// 轮询 `user/settings.json` 的 (mtime, len)，变化时发 `config-changed`。
   995	/// 按路径取状态，文件被 rename 替换也能发现；首轮只记录基线。
   996	pub fn spawn_config_watcher(app: AppHandle) {
   997	    let path = user_path(&config_base(&app));
   998	    tauri::async_runtime::spawn(async move {
   999	        use tauri::Emitter;
  1000	        let fingerprint = |path: &Path| -> Option<(SystemTime, u64)> {
  1001	            let meta = std::fs::metadata(path).ok()?;
  1002	            Some((meta.modified().ok()?, meta.len()))
  1003	        };
  1004	        let mut last = fingerprint(&path);
  1005	        loop {
  1006	            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
  1007	            let current = fingerprint(&path);
  1008	            if current != last {
  1009	                last = current;
  1010	                info!(path = %path.display(), "配置文件被外部修改，通知前端热应用");
  1011	                #[cfg(debug_assertions)]
  1012	                eprintln!("[config] 外部修改已检测，发送 config-changed");
  1013	                let _ = app.emit("config-changed", ());
  1014	            }
  1015	        }
  1016	    });
  1017	}
  1018	
  1019	/// Get API key from system keyring.
  1020	pub async fn get_api_key(service: &str, account: &str) -> Result<Option<String>, AppError> {
  1021	    let entry = keyring::Entry::new(service, account).map_err(|e| AppError::Keyring {
  1022	        context: "create entry".into(),
  1023	        source: e.to_string(),
  1024	    })?;
  1025	    match entry.get_password() {
  1026	        Ok(key) => Ok(Some(key)),
  1027	        Err(keyring::Error::NoEntry) => Ok(None),
  1028	        Err(e) => Err(AppError::Keyring {
  1029	            context: "get password".into(),
  1030	            source: e.to_string(),
  1031	        }),
  1032	    }
  1033	}
  1034	
  1035	/// Set API key in system keyring.
  1036	pub async fn set_api_key(service: &str, account: &str, key: &str) -> Result<(), AppError> {
  1037	    let entry = keyring::Entry::new(service, account).map_err(|e| AppError::Keyring {
  1038	        context: "create entry".into(),
  1039	        source: e.to_string(),
  1040	    })?;
  1041	    entry.set_password(key).map_err(|e| AppError::Keyring {
  1042	        context: "set password".into(),
  1043	        source: e.to_string(),
  1044	    })?;
  1045	    Ok(())
  1046	}
  1047	
  1048	/// Delete API key from system keyring.
  1049	pub async fn delete_api_key(service: &str, account: &str) -> Result<(), AppError> {
  1050	    let entry = keyring::Entry::new(service, account).map_err(|e| AppError::Keyring {
  1051	        context: "create entry".into(),
  1052	        source: e.to_string(),
  1053	    })?;
  1054	    entry.delete_credential().map_err(|e| AppError::Keyring {
  1055	        context: "delete password".into(),
  1056	        source: e.to_string(),
  1057	    })?;
  1058	    Ok(())
  1059	}
  1060	
  1061	#[cfg(test)]
  1062	mod tests {
  1063	    use super::*;
  1064	
  1065	    fn temp_base(tag: &str) -> tempfile::TempDir {
  1066	        tempfile::Builder::new()
  1067	            .prefix(&format!("biaoyue_config_{tag}_"))
  1068	            .tempdir()
  1069	            .expect("create temp dir")
  1070	    }
  1071	
  1072	    fn write_user(base: &Path, json: &str) {
  1073	        let path = user_path(base);
  1074	        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
  1075	        std::fs::write(&path, json).unwrap();
  1076	    }
  1077	
  1078	    fn read_user(base: &Path) -> String {
  1079	        std::fs::read_to_string(user_path(base)).unwrap()
  1080	    }

exec
/bin/zsh -lc "nl -ba src/lib/paneHeaderMenu.ts | sed -n '1,360p'; nl -ba src/editors/orchestration/slots.ts | sed -n '1,360p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
     1	/**
     2	 * 格头 ⋯ 菜单的静态定义与模式切换纯逻辑（layout-portal 4.1；editor-surface-batch18 D1 后只承载格级动作）。
     3	 *
     4	 * 与渲染解耦，便于单测断言「恰好 6 项、顺序与图标」以及「模式只在预览↔编辑」。
     5	 * 文件级动作（导出 / 刷新 / 打开文件位置）已迁到页签右键菜单。
     6	 */
     7	
     8	import type { IconName } from "../ui/icons";
     9	import type { EditorMode } from "../types";
    10	
    11	export type PaneMenuAction =
    12	  | "new-file"
    13	  | "share"
    14	  | "splitRight"
    15	  | "splitDown"
    16	  | "source"
    17	  | "locate"
    18	  | "copyPath"
    19	  | "undockAi"
    20	  | "closePane";
    21	
    22	export interface PaneMenuItem {
    23	  action: PaneMenuAction;
    24	  label: string;
    25	  icon: IconName;
    26	}
    27	
    28	export type ExportMenuAction =
    29	  | "exportHtml"
    30	  | "exportPng"
    31	  | "exportPdf"
    32	  | "exportDocx"
    33	  | "exportMdpkg"
    34	  | "exportZip";
    35	
    36	export interface ExportMenuItem {
    37	  action: ExportMenuAction;
    38	  label: string;
    39	  icon: IconName;
    40	  disabled?: boolean;
    41	  title?: string;
    42	}
    43	
    44	/** 格头 ⋯ 菜单：只保留格级动作，恰好 6 项（editor-surface-batch18 D1）。 */
    45	export const PANE_MENU_ITEMS: readonly PaneMenuItem[] = [
    46	  { action: "new-file", label: "新建文件", icon: "file" },
    47	  { action: "share", label: "分享", icon: "share" },
    48	  { action: "splitRight", label: "右分", icon: "splitRight" },
    49	  { action: "splitDown", label: "下分", icon: "splitDown" },
    50	  { action: "source", label: "源码模式", icon: "code" },
    51	  { action: "locate", label: "定位", icon: "locate" },
    52	];
    53	
    54	// 导出能力清单，恰好 6 项；顺序即子菜单渲染顺序（用户 2026-11-10 指定：
    55	// word、mdpkg、图片、pdf、html、zip）。打印不走导出管线，是同级独立菜单项。
    56	export const EXPORT_MENU_ITEMS: readonly ExportMenuItem[] = [
    57	  { action: "exportDocx", label: "Word", icon: "exportWord" },
    58	  { action: "exportMdpkg", label: ".mdpkg", icon: "exportMdpkg" },
    59	  { action: "exportPng", label: "图片", icon: "image" },
    60	  { action: "exportPdf", label: "PDF", icon: "pdf" },
    61	  { action: "exportHtml", label: "HTML", icon: "html" },
    62	  { action: "exportZip", label: "ZIP", icon: "exportZip" },
    63	];
    64	
    65	/**
    66	 * AI 停靠窗格的 ⋯ 菜单（layout-portal 9.1）——独立于普通格的 6 项列表，
    67	 * 保证 pane-header 用例对普通格「恰好 6 项」的断言不受影响。
    68	 */
    69	export const AI_PANE_MENU_ITEMS: readonly PaneMenuItem[] = [
    70	  { action: "undockAi", label: "脱离为小窗", icon: "export" },
    71	];
    72	
    73	/** 模式图标只在预览↔编辑间切换；源码模式由 ⋯ 菜单进入。 */
    74	export function nextPaneMode(mode: EditorMode): EditorMode {
    75	  return mode === "preview" ? "edit" : "preview";
    76	}
     1	import type { IconName } from "../../ui/icons";
     2	
     3	export interface ToolbarSlotItem {
     4	  id: string;
     5	  label: string;
     6	  icon: IconName;
     7	  group: "ai" | "format" | "align";
     8	}
     9	
    10	export const HTML_TOOLBAR_ITEMS: readonly ToolbarSlotItem[] = [
    11	  { id: "ai-rewrite", label: "改写", icon: "edit", group: "ai" },
    12	  { id: "ai-translate", label: "翻译", icon: "globe", group: "ai" },
    13	  { id: "ai-polish", label: "润色", icon: "sparkle", group: "ai" },
    14	  { id: "format-bold", label: "粗体", icon: "bold", group: "format" },
    15	  { id: "format-italic", label: "斜体", icon: "italic", group: "format" },
    16	  {
    17	    id: "format-underline",
    18	    label: "下划线",
    19	    icon: "underline",
    20	    group: "format",
    21	  },
    22	  { id: "format-strike", label: "删除线", icon: "strike", group: "format" },
    23	  { id: "format-code", label: "行内代码", icon: "code", group: "format" },
    24	  { id: "format-link", label: "链接", icon: "link", group: "format" },
    25	  { id: "align-left", label: "左对齐", icon: "alignLeft", group: "align" },
    26	  { id: "align-center", label: "居中", icon: "alignCenter", group: "align" },
    27	  { id: "align-right", label: "右对齐", icon: "alignRight", group: "align" },
    28	];
    29	
    30	export const HTML_TOOLBAR_DEFAULT_ORDER: readonly string[] =
    31	  HTML_TOOLBAR_ITEMS.map((item) => item.id);
    32	
    33	const KNOWN_IDS = new Set(HTML_TOOLBAR_DEFAULT_ORDER);
    34	
    35	export function resolveToolbarOrder(
    36	  configured: string[] | null | undefined,
    37	): string[] {
    38	  if (!Array.isArray(configured) || configured.length === 0) {
    39	    return [...HTML_TOOLBAR_DEFAULT_ORDER];
    40	  }
    41	  const out: string[] = [];
    42	  for (const id of configured) {
    43	    if (!KNOWN_IDS.has(id) || out.includes(id)) continue;
    44	    out.push(id);
    45	  }
    46	  return out.length > 0 ? out : [...HTML_TOOLBAR_DEFAULT_ORDER];
    47	}

exec
/bin/zsh -lc "nl -ba src/lib/shortcuts.ts | sed -n '1,680p'; nl -ba src/editors/keybindings.ts | sed -n '1,130p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
     1	/**
     2	 * 快捷键注册表（layout-portal 15.1 / R-10）。
     3	 *
     4	 * 唯一真相源：实际 keymap 绑定、tooltip 键位显示、`?` 总览浮层、设置快捷键区
     5	 * 都从这里渲染。新增/调整快捷键只改本文件，四处消费点自动同源。
     6	 *
     7	 * 设计规则（批准设计 §11）：单 ⌘ 高频 / ⌘⇧ 二级 / ⌘⌥ 分栏 / ⌥ 过滤 / 不用三修饰键。
     8	 */
     9	
    10	export type ShortcutFamily =
    11	  | "global"
    12	  | "typeFilter"
    13	  | "mode"
    14	  | "file"
    15	  | "workspace"
    16	  | "navigation"
    17	  | "card"
    18	  | "ai"
    19	  | "media"
    20	  | "local";
    21	
    22	export type ShortcutScope = "global" | "local";
    23	
    24	export interface ShortcutDef {
    25	  id: string;
    26	  /** 展示形式，如 "⌘P"、"⌥4"、"⌘⌥→"。 */
    27	  keys: string;
    28	  label: string;
    29	  family: ShortcutFamily;
    30	  /** 作用域：global（默认，任意处生效）/ local（仅在其 context 激活时生效并优先于全局）。 */
    31	  scope?: ShortcutScope;
    32	  /** 局部键的生效上下文描述；scope 为 local 时必填。 */
    33	  context?: string;
    34	  /** 设置页「核心快捷键」展示的 7 条。 */
    35	  core?: boolean;
    36	  /** 冲突裁定说明：仅在有旧绑定竞争时填写，总览浮层会显示。 */
    37	  decision?: string;
    38	  implemented: boolean;
    39	}
    40	
    41	export const SHORTCUT_FAMILY_LABELS: Record<ShortcutFamily, string> = {
    42	  global: "全局",
    43	  typeFilter: "类型过滤",
    44	  mode: "模式",
    45	  file: "文件",
    46	  workspace: "工作区",
    47	  navigation: "导航",
    48	  card: "卡片直开",
    49	  ai: "AI / 其他",
    50	  media: "媒体",
    51	  local: "局部（上下文）",
    52	};
    53	
    54	/** 家族展示顺序（总览浮层与设置完整列表按此顺序分组）。 */
    55	export const SHORTCUT_FAMILY_ORDER: readonly ShortcutFamily[] = [
    56	  "global",
    57	  "typeFilter",
    58	  "mode",
    59	  "file",
    60	  "workspace",
    61	  "navigation",
    62	  "card",
    63	  "ai",
    64	  "media",
    65	  "local",
    66	];
    67	
    68	export const SHORTCUTS: readonly ShortcutDef[] = [
    69	  // ── 全局（10）─────────────────────────────────────────────
    70	  {
    71	    id: "global-quick-open",
    72	    keys: "⌘P",
    73	    label: "快速打开",
    74	    family: "global",
    75	    core: true,
    76	    decision: "页签 / 最近文件 / 命令；统一文件面板见 B-3",
    77	    implemented: true,
    78	  },
    79	  {
    80	    id: "global-reading-rail",
    81	    keys: "⌘\\",
    82	    label: "阅读空间",
    83	    family: "global",
    84	    core: true,
    85	    decision: "折叠态不切沉浸阅读（⌘⇧F 专责）",
    86	    implemented: true,
    87	  },
    88	  {
    89	    id: "global-rail-pin",
    90	    keys: "⌘⌥\\",
    91	    label: "固定 / 取消固定左边栏",
    92	    family: "global",
    93	    implemented: true,
    94	  },
    95	  {
    96	    id: "global-rail-pin-hidden",
    97	    keys: "⌘⇧X",
    98	    label: "左边栏固定隐藏 / 取消",
    99	    family: "global",
   100	    decision: "网格概览/门户下同样生效，不被场景门拦截（#924）",
   101	    implemented: true,
   102	  },
   103	  {
   104	    id: "global-grid",
   105	    keys: "⌘⇧\\",
   106	    label: "网格概览",
   107	    family: "global",
   108	    core: true,
   109	    decision: "旧右侧栏切换已移除，归网格概览",
   110	    implemented: true,
   111	  },
   112	  {
   113	    id: "global-ai-overlay",
   114	    keys: "⌘K",
   115	    label: "AI 快捷浮层",
   116	    family: "global",
   117	    core: true,
   118	    implemented: true,
   119	  },
   120	  {
   121	    id: "global-ai-bubble",
   122	    keys: "⌘⇧A",
   123	    label: "AI 小窗·停靠",
   124	    family: "global",
   125	    core: true,
   126	    implemented: true,
   127	  },
   128	  {
   129	    id: "global-settings",
   130	    keys: "⌘,",
   131	    label: "设置",
   132	    family: "global",
   133	    core: true,
   134	    implemented: true,
   135	  },
   136	  {
   137	    id: "global-preview-toggle",
   138	    keys: "⌘⇧V",
   139	    label: "悬浮预览开关",
   140	    family: "global",
   141	    decision: "旧向下分屏让位 ⌘⌥↓",
   142	    implemented: true,
   143	  },
   144	  {
   145	    id: "global-doc-property-toggle",
   146	    keys: "⌘⇧Y",
   147	    label: "属性面板显隐",
   148	    family: "global",
   149	    implemented: true,
   150	  },
   151	  {
   152	    id: "global-shortcuts",
   153	    keys: "?",
   154	    label: "快捷键总览",
   155	    family: "global",
   156	    core: true,
   157	    implemented: true,
   158	  },
   159	  {
   160	    id: "global-escape",
   161	    keys: "Esc",
   162	    label: "层级关闭",
   163	    family: "global",
   164	    implemented: true,
   165	  },
   166	
   167	  // ── 类型过滤（9：⌥1–8 八类 + ⌥0 全部）────────────────────
   168	  {
   169	    id: "type-filter-markdown",
   170	    keys: "⌥1",
   171	    label: "Markdown",
   172	    family: "typeFilter",
   173	    implemented: true,
   174	  },
   175	  {
   176	    id: "type-filter-html",
   177	    keys: "⌥2",
   178	    label: "HTML",
   179	    family: "typeFilter",
   180	    implemented: true,
   181	  },
   182	  {
   183	    id: "type-filter-text",
   184	    keys: "⌥3",
   185	    label: "文本",
   186	    family: "typeFilter",
   187	    implemented: true,
   188	  },
   189	  {
   190	    id: "type-filter-pdf",
   191	    keys: "⌥4",
   192	    label: "PDF",
   193	    family: "typeFilter",
   194	    implemented: true,
   195	  },
   196	  {
   197	    id: "type-filter-video",
   198	    keys: "⌥5",
   199	    label: "视频",
   200	    family: "typeFilter",
   201	    implemented: true,
   202	  },
   203	  {
   204	    id: "type-filter-image",
   205	    keys: "⌥6",
   206	    label: "图片",
   207	    family: "typeFilter",
   208	    implemented: true,
   209	  },
   210	  {
   211	    id: "type-filter-code",
   212	    keys: "⌥7",
   213	    label: "代码",
   214	    family: "typeFilter",
   215	    implemented: true,
   216	  },
   217	  {
   218	    id: "type-filter-audio",
   219	    keys: "⌥8",
   220	    label: "音频",
   221	    family: "typeFilter",
   222	    implemented: true,
   223	  },
   224	  {
   225	    id: "type-filter-all",
   226	    keys: "⌥0",
   227	    label: "全部",
   228	    family: "typeFilter",
   229	    implemented: true,
   230	  },
   231	
   232	  // ── 模式（2）──────────────────────────────────────────────
   233	  {
   234	    id: "mode-cycle",
   235	    keys: "⌘⇧M",
   236	    label: "循环预览 / 编辑 / 源码",
   237	    family: "mode",
   238	    implemented: true,
   239	  },
   240	  {
   241	    // 仅活动页签为 PDF 时生效；视图级状态，切页签即复位。
   242	    id: "mode-pdf-toolbar-pin",
   243	    keys: "⌘⇧D",
   244	    label: "PDF 按钮栏固定显示 / 隐藏",
   245	    family: "mode",
   246	    implemented: true,
   247	  },
   248	
   249	  // ── 文件（6）──────────────────────────────────────────────
   250	  {
   251	    id: "file-open",
   252	    keys: "⌘O",
   253	    label: "打开",
   254	    family: "file",
   255	    implemented: true,
   256	  },
   257	  {
   258	    id: "file-save",
   259	    keys: "⌘S",
   260	    label: "保存",
   261	    family: "file",
   262	    implemented: true,
   263	  },
   264	  {
   265	    id: "file-new",
   266	    keys: "⌘N",
   267	    label: "新建",
   268	    family: "file",
   269	    implemented: true,
   270	  },
   271	  {
   272	    id: "file-new-tab",
   273	    keys: "⌘T",
   274	    label: "新页签",
   275	    family: "file",
   276	    implemented: true,
   277	  },
   278	  {
   279	    id: "file-close-tab",
   280	    keys: "⌘W",
   281	    label: "关页签 / 格",
   282	    family: "file",
   283	    implemented: true,
   284	  },
   285	  {
   286	    id: "file-pin",
   287	    keys: "⌘⇧P",
   288	    label: "收藏",
   289	    family: "file",
   290	    implemented: true,
   291	  },
   292	
   293	  // ── 工作区（5）────────────────────────────────────────────
   294	  {
   295	    id: "workspace-open-selected",
   296	    keys: "⌘↵",
   297	    label: "打开选中",
   298	    family: "workspace",
   299	    implemented: true,
   300	  },
   301	  {
   302	    id: "workspace-split-right",
   303	    keys: "⌘⌥→",
   304	    label: "右分",
   305	    family: "workspace",
   306	    implemented: true,
   307	  },
   308	  {
   309	    id: "workspace-split-down",
   310	    keys: "⌘⌥↓",
   311	    label: "下分",
   312	    family: "workspace",
   313	    implemented: true,
   314	  },
   315	  {
   316	    id: "workspace-fullscreen",
   317	    keys: "⌘⇧↵",
   318	    label: "全屏当前格",
   319	    family: "workspace",
   320	    implemented: true,
   321	  },
   322	  {
   323	    id: "workspace-immersive",
   324	    keys: "⌘⇧F",
   325	    label: "沉浸",
   326	    family: "workspace",
   327	    implemented: true,
   328	  },
   329	
   330	  // ── 导航（6）──────────────────────────────────────────────
   331	  {
   332	    id: "nav-vertical",
   333	    keys: "j/k",
   334	    label: "上下整行",
   335	    family: "navigation",
   336	    implemented: true,
   337	  },
   338	  {
   339	    id: "nav-horizontal",
   340	    keys: "h/l",
   341	    label: "行内左右",
   342	    family: "navigation",
   343	    implemented: true,
   344	  },
   345	  {
   346	    id: "nav-page",
   347	    keys: "PageUp/PageDown",
   348	    label: "整页",
   349	    family: "navigation",
   350	    implemented: true,
   351	  },
   352	  {
   353	    id: "nav-edge",
   354	    keys: "Home/End",
   355	    label: "首尾",
   356	    family: "navigation",
   357	    implemented: true,
   358	  },
   359	  {
   360	    id: "nav-open",
   361	    keys: "Enter",
   362	    label: "打开",
   363	    family: "navigation",
   364	    implemented: true,
   365	  },
   366	  {
   367	    id: "nav-search",
   368	    keys: "/",
   369	    label: "搜索",
   370	    family: "navigation",
   371	    implemented: true,
   372	  },
   373	
   374	  // ── 卡片直开（3）──────────────────────────────────────────
   375	  {
   376	    id: "card-show-numbers",
   377	    keys: "按住 ⌘",
   378	    label: "显示编号",
   379	    family: "card",
   380	    implemented: true,
   381	  },
   382	  {
   383	    id: "card-open",
   384	    keys: "⌘1–9",
   385	    label: "当前格打开",
   386	    family: "card",
   387	    implemented: true,
   388	  },
   389	  {
   390	    id: "card-split-right",
   391	    keys: "⌘⇧1–9",
   392	    label: "右分打开",
   393	    family: "card",
   394	    implemented: true,
   395	  },
   396	  {
   397	    id: "card-split-down",
   398	    keys: "⌘⌥1–9",
   399	    label: "下分打开",
   400	    family: "card",
   401	    implemented: true,
   402	  },
   403	
   404	  // ── AI / 其他（3）─────────────────────────────────────────
   405	  {
   406	    id: "ai-study-page",
   407	    keys: "⌘⇧E",
   408	    label: "生成学习页",
   409	    family: "ai",
   410	    implemented: true,
   411	  },
   412	  {
   413	    id: "ai-translate",
   414	    keys: "⌘⇧T",
   415	    label: "翻译",
   416	    family: "ai",
   417	    implemented: true,
   418	  },
   419	  {
   420	    id: "ai-quick-capture",
   421	    keys: "⌘⇧.",
   422	    label: "快速捕获",
   423	    family: "ai",
   424	    implemented: true,
   425	  },
   426	
   427	  // ── 媒体（播放器聚焦时生效）────────────────────────────────
   428	  {
   429	    id: "media-play-pause",
   430	    keys: "空格",
   431	    label: "播放 / 暂停",
   432	    family: "media",
   433	    implemented: true,
   434	  },
   435	  {
   436	    id: "media-seek-back",
   437	    keys: "←",
   438	    label: "快退 5s",
   439	    family: "media",
   440	    implemented: true,
   441	  },
   442	  {
   443	    id: "media-seek-forward",
   444	    keys: "→",
   445	    label: "快进 5s",
   446	    family: "media",
   447	    implemented: true,
   448	  },
   449	  {
   450	    id: "media-volume-up",
   451	    keys: "↑",
   452	    label: "音量 +",
   453	    family: "media",
   454	    implemented: true,
   455	  },
   456	  {
   457	    id: "media-volume-down",
   458	    keys: "↓",
   459	    label: "音量 −",
   460	    family: "media",
   461	    implemented: true,
   462	  },
   463	  {
   464	    id: "media-fullscreen",
   465	    keys: "F",
   466	    label: "全屏",
   467	    family: "media",
   468	    implemented: true,
   469	  },
   470	  {
   471	    id: "media-mute",
   472	    keys: "M",
   473	    label: "静音",
   474	    family: "media",
   475	    implemented: true,
   476	  },
   477	  {
   478	    id: "media-prev-next",
   479	    keys: "N / P",
   480	    label: "上一集 / 下一集",
   481	    family: "media",
   482	    implemented: true,
   483	  },
   484	  {
   485	    id: "media-loop",
   486	    keys: "L",
   487	    label: "循环模式",
   488	    family: "media",
   489	    implemented: true,
   490	  },
   491	  {
   492	    id: "media-subtitle-track",
   493	    keys: "C",
   494	    label: "字幕轨道",
   495	    family: "media",
   496	    implemented: true,
   497	  },
   498	  {
   499	    id: "media-subtitle-position",
   500	    keys: "X",
   501	    label: "字幕上 / 下",
   502	    family: "media",
   503	    implemented: true,
   504	  },
   505	  {
   506	    id: "media-timestamp-note",
   507	    keys: "T",
   508	    label: "时间戳笔记",
   509	    family: "media",
   510	    implemented: true,
   511	  },
   512	
   513	  // ── 局部（上下文激活时生效，优先于全局同名键）────────────────
   514	  {
   515	    id: "local-doc-menu-pick",
   516	    keys: "⌘1–9",
   517	    label: "文档链接菜单直选",
   518	    family: "local",
   519	    scope: "local",
   520	    context: "属性面板 [[ 文档菜单打开",
   521	    implemented: true,
   522	  },
   523	  {
   524	    id: "local-tag-menu-pick",
   525	    keys: "⌘1–9",
   526	    label: "标签建议菜单直选",
   527	    family: "local",
   528	    scope: "local",
   529	    context: "属性面板标签建议菜单打开",
   530	    implemented: true,
   531	  },
   532	];
   533	
   534	/** 设置页「核心快捷键」的 7 条。 */
   535	export function coreShortcuts(): ShortcutDef[] {
   536	  return SHORTCUTS.filter((s) => s.core);
   537	}
   538	
   539	/** 按家族取条目（总览浮层与设置完整列表共用）。 */
   540	export function shortcutsByFamily(family: ShortcutFamily): ShortcutDef[] {
   541	  return SHORTCUTS.filter((s) => s.family === family);
   542	}
   543	
   544	const activeLocalContexts = new Set<string>();
   545	
   546	/** 激活局部键上下文（建议菜单等局部 UI 打开时调用）；返回注销函数。 */
   547	export function activateLocalContext(context: string): () => void {
   548	  activeLocalContexts.add(context);
   549	  return () => {
   550	    activeLocalContexts.delete(context);
   551	  };
   552	}
   553	
   554	export function isLocalContextActive(context: string): boolean {
   555	  return activeLocalContexts.has(context);
   556	}
   557	
   558	/** 该局部键在其上下文激活时生效（未激活或 id/context 不匹配返回 false）。 */
   559	export function isLocalShortcutActive(id: string, context: string): boolean {
   560	  if (!activeLocalContexts.has(context)) return false;
   561	  return SHORTCUTS.some(
   562	    (s) => s.id === id && s.scope === "local" && s.context === context,
   563	  );
   564	}
     1	import { keymap, type EditorView, type KeyBinding } from "@codemirror/view";
     2	import { redo, undo } from "@codemirror/commands";
     3	
     4	/**
     5	 * CM6 markdown formatting keybindings: Cmd+B (bold), Cmd+I (italic).
     6	 */
     7	export function formattingKeymap() {
     8	  return keymap.of([
     9	    {
    10	      key: "Mod-b",
    11	      run: toggleBold,
    12	    },
    13	    {
    14	      key: "Mod-i",
    15	      run: toggleItalic,
    16	    },
    17	  ]);
    18	}
    19	
    20	/**
    21	 * historyKeymap 只绑定 `Mod-`（macOS 上是 Command）。这里补 Control 变体，
    22	 * 让习惯 Ctrl 的用户不必去够 Command；两者指向同一组 undo/redo 命令。
    23	 */
    24	export const ctrlHistoryBindings: KeyBinding[] = [
    25	  { key: "Ctrl-z", run: undo, preventDefault: true },
    26	  { key: "Ctrl-Shift-z", run: redo, preventDefault: true },
    27	  { key: "Ctrl-y", run: redo, preventDefault: true },
    28	];
    29	
    30	/** 全局撤销：焦点不在编辑器时由 App 转交。 */
    31	export function undoOnce(view: EditorView): boolean {
    32	  return undo(view);
    33	}
    34	
    35	/** 全局重做：焦点不在编辑器时由 App 转交。 */
    36	export function redoOnce(view: EditorView): boolean {
    37	  return redo(view);
    38	}
    39	
    40	export function toggleBold(view: EditorView): boolean {
    41	  toggleFormatting(view, "**");
    42	  return true;
    43	}
    44	
    45	export function toggleItalic(view: EditorView): boolean {
    46	  toggleFormatting(view, "*");
    47	  return true;
    48	}
    49	
    50	function toggleFormatting(view: EditorView, delimiter: string) {
    51	  const { from, to, empty } = view.state.selection.main;
    52	  const doc = view.state.doc.toString();
    53	
    54	  if (empty) {
    55	    // No selection: insert delimiter pair, cursor in middle
    56	    view.dispatch({
    57	      changes: { from, to, insert: delimiter + delimiter },
    58	      selection: {
    59	        anchor: from + delimiter.length,
    60	        head: from + delimiter.length,
    61	      },
    62	    });
    63	    return;
    64	  }
    65	
    66	  const selected = doc.slice(from, to);
    67	  const len = delimiter.length;
    68	
    69	  // Check if already wrapped
    70	  if (
    71	    selected.startsWith(delimiter) &&
    72	    selected.endsWith(delimiter) &&
    73	    selected.length >= len * 2
    74	  ) {
    75	    const inner = selected.slice(len, -len);
    76	    view.dispatch({
    77	      changes: { from, to, insert: inner },
    78	      selection: { anchor: from, head: from + inner.length },
    79	    });
    80	  } else {
    81	    view.dispatch({
    82	      changes: { from, to, insert: delimiter + selected + delimiter },
    83	      selection: { anchor: from + len, head: from + len + selected.length },
    84	    });
    85	  }
    86	}

exec
/bin/zsh -lc "nl -ba src/editors/orchestration/capsule-toolbar.ts | sed -n '1,360p'; nl -ba src/editors/orchestration/floating-toolbar.ts | sed -n '680,750p'; nl -ba src/components/SettingsView.tsx | sed -n '600,1040p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
     1	/**
     2	 * 胶囊选区工具条（#572）。
     3	 *
     4	 * 两行按钮：靠近指针的一行放高频动作，另一行放次级动作；颜色按钮在原位
     5	 * 展开 12 色条，不另起浮层。按钮在 pointerdown 阻止默认行为，避免点击时
     6	 * 丢失编辑器选区。
     7	 */
     8	import { iconSvg, type IconName } from "../../ui/icons";
     9	
    10	export interface CapsuleItem {
    11	  id: string;
    12	  label: string;
    13	  icon: IconName;
    14	  run: () => void;
    15	}
    16	
    17	export interface CapsulePalette {
    18	  font: readonly { label: string; className: string; swatch?: string }[];
    19	  background: readonly {
    20	    label: string;
    21	    className: string;
    22	    swatch?: string;
    23	  }[];
    24	  apply: (kind: "font" | "background", className: string) => void;
    25	}
    26	
    27	export interface CapsuleHandle {
    28	  element: HTMLDivElement;
    29	  destroy: () => void;
    30	}
    31	
    32	const GAP = 8;
    33	
    34	function node<K extends keyof HTMLElementTagNameMap>(
    35	  tag: K,
    36	  className: string,
    37	): HTMLElementTagNameMap[K] {
    38	  const el = document.createElement(tag);
    39	  el.className = className;
    40	  return el;
    41	}
    42	
    43	export function createCapsuleToolbar(
    44	  primary: CapsuleItem[],
    45	  secondary: CapsuleItem[],
    46	  onClose: () => void,
    47	  palette: CapsulePalette,
    48	  anchor: { x: number; y: number },
    49	): CapsuleHandle {
    50	  const root = node("div", "app-capsule-toolbar");
    51	  root.dataset.testid = "selection-capsule";
    52	  root.setAttribute("role", "toolbar");
    53	  root.setAttribute("aria-label", "选区工具条");
    54	
    55	  const row = node("div", "capsule-row capsule-row-single");
    56	  root.appendChild(row);
    57	
    58	  const makeButton = (item: CapsuleItem, row: HTMLElement) => {
    59	    const btn = node("button", "capsule-btn");
    60	    btn.type = "button";
    61	    btn.dataset.action = item.id;
    62	    btn.title = item.label;
    63	    btn.setAttribute("aria-label", item.label);
    64	    btn.innerHTML = iconSvg(item.icon, 16);
    65	    btn.addEventListener("pointerdown", (e) => e.preventDefault());
    66	    btn.addEventListener("click", (e) => {
    67	      e.preventDefault();
    68	      e.stopPropagation();
    69	      item.run();
    70	    });
    71	    row.appendChild(btn);
    72	  };
    73	
    74	  const paintRows = () => {
    75	    row.replaceChildren();
    76	    for (const item of secondary) makeButton(item, row);
    77	    for (const item of primary) makeButton(item, row);
    78	    root.classList.remove("is-palette");
    79	  };
    80	
    81	  const paintPalette = () => {
    82	    row.replaceChildren();
    83	    const draw = (
    84	      colors: CapsulePalette["font"],
    85	      kind: "font" | "background",
    86	      row: HTMLElement,
    87	    ) => {
    88	      for (const color of colors) {
    89	        const btn = node("button", "capsule-swatch");
    90	        btn.type = "button";
    91	        btn.dataset.action = `${kind}-${color.className || "default"}`;
    92	        btn.title = color.label;
    93	        btn.setAttribute("aria-label", color.label);
    94	        if (color.swatch) btn.style.background = color.swatch;
    95	        else btn.classList.add("is-default");
    96	        btn.addEventListener("pointerdown", (e) => e.preventDefault());
    97	        btn.addEventListener("click", (e) => {
    98	          e.preventDefault();
    99	          e.stopPropagation();
   100	          palette.apply(kind, color.className);
   101	        });
   102	        row.appendChild(btn);
   103	      }
   104	    };
   105	    draw(palette.font, "font", row);
   106	    draw(palette.background, "background", row);
   107	    root.classList.add("is-palette");
   108	  };
   109	
   110	  for (const item of primary) {
   111	    if (item.id === "capsule-font" || item.id === "capsule-bg") {
   112	      item.run = paintPalette;
   113	    }
   114	  }
   115	
   116	  paintRows();
   117	
   118	  document.body.appendChild(root);
   119	
   120	  function close(): void {
   121	    cleanup();
   122	    root.remove();
   123	    onClose();
   124	  }
   125	
   126	  const onOutside = (e: PointerEvent) => {
   127	    if (root.contains(e.target as Node)) return;
   128	    close();
   129	  };
   130	  const onKey = (e: KeyboardEvent) => {
   131	    if (e.key === "Escape") {
   132	      e.preventDefault();
   133	      e.stopPropagation();
   134	      close();
   135	    }
   136	  };
   137	  const onScroll = () => close();
   138	
   139	  document.addEventListener("pointerdown", onOutside, true);
   140	  document.addEventListener("keydown", onKey, true);
   141	  window.addEventListener("scroll", onScroll, true);
   142	
   143	  function cleanup(): void {
   144	    document.removeEventListener("pointerdown", onOutside, true);
   145	    document.removeEventListener("keydown", onKey, true);
   146	    window.removeEventListener("scroll", onScroll, true);
   147	  }
   148	
   149	  const place = (x: number, y: number) => {
   150	    const rect = root.getBoundingClientRect();
   151	    const left = Math.min(
   152	      Math.max(x - rect.width / 2, GAP),
   153	      window.innerWidth - rect.width - GAP,
   154	    );
   155	    const top = Math.max(y - rect.height - GAP, GAP);
   156	    root.style.left = `${left}px`;
   157	    root.style.top = `${top}px`;
   158	  };
   159	
   160	  requestAnimationFrame(() => {
   161	    if (!root.isConnected) return;
   162	    place(anchor.x, anchor.y);
   163	    root.classList.add("is-open");
   164	  });
   165	
   166	  return {
   167	    element: root,
   168	    destroy: () => {
   169	      cleanup();
   170	      root.remove();
   171	    },
   172	  };
   173	}
   680	        toCapsule(actions.smart[0]),
   681	        toCapsule(actions.smart[1]),
   682	        toCapsule(actions.smart[2]),
   683	        { id: "capsule-font", label: "字色", icon: "tune", run: () => {} },
   684	        { id: "capsule-bg", label: "背景色", icon: "droplet", run: () => {} },
   685	        toCapsule(actions.clear[0]),
   686	      ];
   687	      return { primary, secondary: [] };
   688	    };
   689	
   690	    const showCapsule = (point: { x: number; y: number }) => {
   691	      const mode = useEditorStore.getState().config.selectionToolbar;
   692	      if (!allowCapsule || mode !== "capsule") return false;
   693	      hide();
   694	      const { primary, secondary } = capsuleItems();
   695	      capsule = createCapsuleToolbar(
   696	        primary,
   697	        secondary,
   698	        () => {
   699	          capsule = null;
   700	        },
   701	        {
   702	          font: FONT_COLORS,
   703	          background: BACKGROUND_COLORS,
   704	          apply: (kind, className) => {
   705	            if (kind === "font") actions.color("font", className);
   706	            else actions.color("background", className);
   707	          },
   708	        },
   709	        point,
   710	      );
   711	      return true;
   712	    };
   713	
   714	    const configuredSectors = (): SectorId[] | undefined => {
   715	      const configured = useEditorStore.getState().config.rouletteSectors;
   716	      if (!configured) return undefined;
   717	      const valid = configured.filter((id): id is SectorId =>
   718	        ROOT_SECTORS.some((sector) => sector.id === id),
   719	      );
   720	      return valid.length > 0 ? valid : undefined;
   721	    };
   722	
   723	    const show = () => {
   724	      const config = useEditorStore.getState().config;
   725	      const half = ROULETTE_BOX / 2;
   726	      const stored = config.roulettePosition;
   727	      let point: { x: number; y: number } | null = null;
   728	      if (stored && Number.isFinite(stored.x) && Number.isFinite(stored.y)) {
   729	        point = {
   730	          x: Math.min(Math.max(stored.x, half), window.innerWidth - half),
   731	          y: Math.min(Math.max(stored.y, half), window.innerHeight - half),
   732	        };
   733	      }
   734	      if (!point) point = anchorPoint();
   735	      if (!point) return;
   736	      if (showCapsule(point)) return;
   737	      if (!handle) {
   738	        handle = createRoulette(
   739	          actions,
   740	          () => {
   741	            handle = null;
   742	          },
   743	          {
   744	            commandContext: () => ({ view }),
   745	            sectors: configuredSectors(),
   746	            form: config.rouletteForm ?? "hub",
   747	            onMove: (x, y) => {
   748	              useEditorStore
   749	                .getState()
   750	                .setConfig({ roulettePosition: { x, y } });
   600	          </p>
   601	        )}
   602	      </section>
   603	    </div>
   604	  );
   605	}
   606	
   607	export default function SettingsView({ onClose }: SettingsViewProps) {
   608	  const tauriEnv = isTauriEnv();
   609	  const [active, setActive] = useState<SectionId>("appearance");
   610	  const [capabilities, setCapabilities] = useState(listCapabilities);
   611	  const [showFullShortcuts, setShowFullShortcuts] = useState(false);
   612	
   613	  const theme = useEditorStore((s) => s.config.theme ?? "system");
   614	  const readerFontSize = useEditorStore((s) => s.config.readerFontSize ?? 17);
   615	  const readerWidth = useEditorStore((s) => s.config.readerWidth ?? 1080);
   616	  const selectionToolbar = useEditorStore(
   617	    (s) => s.config.selectionToolbar ?? "roulette",
   618	  );
   619	  const propertyBar = useEditorStore((s) => s.config.propertyBar);
   620	  const propertyBarStyle: PropertyBarDisplayStyle =
   621	    propertyBar?.displayStyle ?? "list";
   622	  const propertyBarPreview: PropertyBarDefaultMode =
   623	    propertyBar?.displayDefault?.preview ?? "show";
   624	  const propertyBarEdit: PropertyBarDefaultMode =
   625	    propertyBar?.displayDefault?.edit ?? "show";
   626	  const propertyBarNewDoc = propertyBar?.newDocVisible ?? true;
   627	  const rouletteSectors = useEditorStore(
   628	    (s) => s.config.rouletteSectors ?? null,
   629	  );
   630	  const rouletteHotkey = useEditorStore((s) => s.config.rouletteHotkey ?? null);
   631	  const rouletteForm = useEditorStore((s) => s.config.rouletteForm ?? "hub");
   632	  const noticeDuration = useEditorStore((s) => s.config.noticeDuration ?? null);
   633	  const [noticeText, setNoticeText] = useState("");
   634	  const [appliedDuration, setAppliedDuration] = useState<number | null>(null);
   635	  if (noticeDuration !== appliedDuration) {
   636	    setAppliedDuration(noticeDuration);
   637	    setNoticeText(noticeDuration == null ? "" : noticeDuration.toFixed(1));
   638	  }
   639	  const htmlToolbarItems = useEditorStore(
   640	    (s) => s.config.htmlToolbarItems ?? null,
   641	  );
   642	  const readerSkin = useEditorStore((s) => s.config.readerSkin ?? "paper");
   643	  const defaultSavePath = useEditorStore(
   644	    (s) => s.config.defaultSavePath ?? null,
   645	  );
   646	  const fontSize = useEditorStore((s) => s.fontSize);
   647	  const openaiEndpoint = useEditorStore((s) => s.config.openaiEndpoint ?? "");
   648	  const openaiModel = useEditorStore((s) => s.config.openaiModel ?? "");
   649	  const setConfig = useEditorStore((s) => s.setConfig);
   650	  const setFontSize = useEditorStore((s) => s.setFontSize);
   651	  const headingFonts = useEditorStore((s) => s.config.headingFonts);
   652	  const headingFontMap = useMemo(
   653	    () => ensureHeadingFonts(headingFonts),
   654	    [headingFonts],
   655	  );
   656	  const [headingFontText, setHeadingFontText] = useState<
   657	    Record<HeadingLevel, string>
   658	  >(
   659	    () =>
   660	      Object.fromEntries(
   661	        HEADING_LEVELS.map((level) => [
   662	          level,
   663	          headingFontInputValue(headingFontMap[level]),
   664	        ]),
   665	      ) as Record<HeadingLevel, string>,
   666	  );
   667	  const [headingFontOptions, setHeadingFontOptions] = useState<string[] | null>(
   668	    null,
   669	  );
   670	  const [headingFontHint, setHeadingFontHint] = useState("");
   671	
   672	  const previewSettings = useStore((s) => s.previewSettings);
   673	  const railPinHidden = useEditorStore((s) => s.config.railPinHidden) ?? false;
   674	  const railLayout = useStore((s) => s.railLayout);
   675	  const railDensity = useStore((s) => s.railDensity);
   676	  const railCardHeight = useStore((s) => s.railCardHeight);
   677	  const gridGroup = useStore((s) => s.gridGroup);
   678	  const gridSort = useStore((s) => s.gridSort);
   679	  const viewSpec = useStore((s) => s.viewSpec);
   680	  const setRailLayout = useStore((s) => s.setRailLayout);
   681	  const setRailDensity = useStore((s) => s.setRailDensity);
   682	  const setRailCardHeight = useStore((s) => s.setRailCardHeight);
   683	  const saveRailViewSpec = useStore((s) => s.saveRailViewSpec);
   684	  const setGridGroup = useStore((s) => s.setGridGroup);
   685	  const setGridSort = useStore((s) => s.setGridSort);
   686	  const applyViewSpec = useStore((s) => s.applyViewSpec);
   687	
   688	  const [selectedProvider, setSelectedProvider] = useState("");
   689	  const [keyInput, setKeyInput] = useState("");
   690	  const [keyStatus, setKeyStatus] = useState<
   691	    "loading" | "configured" | "empty" | "error"
   692	  >("loading");
   693	  const [keyBusy, setKeyBusy] = useState(false);
   694	  const [keyNotice, setKeyNotice] = useState("");
   695	
   696	  const [dropActive, setDropActive] = useState(false);
   697	
   698	  const [snapshots, setSnapshots] = useState<string[]>([]);
   699	  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
   700	  const [pendingRestore, setPendingRestore] = useState<string | null>(null);
   701	  const [restoreNotice, setRestoreNotice] = useState("");
   702	
   703	  const [systemDark, setSystemDark] = useState(
   704	    () =>
   705	      typeof window !== "undefined" &&
   706	      window.matchMedia("(prefers-color-scheme: dark)").matches,
   707	  );
   708	  useEffect(() => {
   709	    const mq = window.matchMedia("(prefers-color-scheme: dark)");
   710	    const handler = () => setSystemDark(mq.matches);
   711	    mq.addEventListener("change", handler);
   712	    return () => mq.removeEventListener("change", handler);
   713	  }, []);
   714	
   715	  const lastExplicitRef = useRef<"light" | "dark" | "warm">(
   716	    theme === "system" ? "light" : theme,
   717	  );
   718	  const effectiveTheme: "light" | "dark" | "warm" =
   719	    theme === "system" ? (systemDark ? "dark" : "light") : theme;
   720	  const followSystem = theme === "system";
   721	
   722	  const rootRef = useRef<HTMLDivElement>(null);
   723	  useEffect(() => {
   724	    rootRef.current?.focus();
   725	  }, []);
   726	
   727	  // 本机已安装字体（C1 / #853）：枚举失败时退回结构性校验，不阻塞设置面板。
   728	  useEffect(() => {
   729	    if (!tauriEnv) return;
   730	    let cancelled = false;
   731	    invoke<SystemFontsResponse>("list_system_fonts")
   732	      .then((res) => {
   733	        if (!cancelled && res && Array.isArray(res.families)) {
   734	          // 预设兜底列表不代表本机字体全集，不做「系统可用性」权威判定。
   735	          setHeadingFontOptions(res.enumerated ? res.families : null);
   736	        }
   737	      })
   738	      .catch(() => {
   739	        if (!cancelled) setHeadingFontOptions(null);
   740	      });
   741	    return () => {
   742	      cancelled = true;
   743	    };
   744	  }, [tauriEnv]);
   745	
   746	  // 配置从磁盘 / AI 改动后同步输入框显示（默认栈显示为空）。
   747	  const [appliedHeadingFonts, setAppliedHeadingFonts] =
   748	    useState(headingFontMap);
   749	  if (appliedHeadingFonts !== headingFontMap) {
   750	    setAppliedHeadingFonts(headingFontMap);
   751	    setHeadingFontText(
   752	      Object.fromEntries(
   753	        HEADING_LEVELS.map((level) => [
   754	          level,
   755	          headingFontInputValue(headingFontMap[level]),
   756	        ]),
   757	      ) as Record<HeadingLevel, string>,
   758	    );
   759	  }
   760	
   761	  useEffect(() => {
   762	    if (active !== "ai" || !tauriEnv) return;
   763	    let cancelled = false;
   764	    invoke<string | null>("get_api_key", {
   765	      service: "biaoyue",
   766	      account: "openai",
   767	    })
   768	      .then((key) => {
   769	        if (!cancelled) setKeyStatus(key ? "configured" : "empty");
   770	      })
   771	      .catch(() => {
   772	        if (!cancelled) setKeyStatus("error");
   773	      });
   774	    return () => {
   775	      cancelled = true;
   776	    };
   777	  }, [active, tauriEnv]);
   778	
   779	  useEffect(() => {
   780	    if (active !== "data" || !tauriEnv) return;
   781	    let cancelled = false;
   782	    invoke<string[]>("list_config_snapshots")
   783	      .then((names) => {
   784	        if (!cancelled) setSnapshots([...names].reverse());
   785	      })
   786	      .catch(() => {
   787	        if (!cancelled) setSnapshots([]);
   788	      })
   789	      .finally(() => {
   790	        if (!cancelled) setSnapshotsLoading(false);
   791	      });
   792	    return () => {
   793	      cancelled = true;
   794	    };
   795	  }, [active, tauriEnv]);
   796	
   797	  useEffect(() => {
   798	    const onKeyDown = (e: KeyboardEvent) => {
   799	      if (e.key === "Escape") {
   800	        e.preventDefault();
   801	        e.stopPropagation();
   802	        if (dropActive) {
   803	          setDropActive(false);
   804	          return;
   805	        }
   806	        onClose();
   807	      }
   808	    };
   809	    document.addEventListener("keydown", onKeyDown, true);
   810	    return () => document.removeEventListener("keydown", onKeyDown, true);
   811	  }, [onClose, dropActive]);
   812	
   813	  const chooseTheme = (next: "light" | "dark" | "warm") => {
   814	    lastExplicitRef.current = next;
   815	    setConfig({ theme: next });
   816	    applyTheme(next);
   817	    void saveAppConfig();
   818	  };
   819	
   820	  const toggleFollowSystem = (next: boolean) => {
   821	    if (next) {
   822	      setConfig({ theme: "system" });
   823	      applyTheme("system");
   824	      void saveAppConfig();
   825	    } else {
   826	      chooseTheme(lastExplicitRef.current);
   827	    }
   828	  };
   829	
   830	  const chooseFontSize = (size: number) => {
   831	    setConfig({ readerFontSize: size });
   832	    setFontSize(size);
   833	    document.documentElement.style.setProperty(
   834	      "--editor-font-size",
   835	      `${size}px`,
   836	    );
   837	    void saveAppConfig();
   838	  };
   839	
   840	  // 标题字体（C1 / #853）：输入即改本地文本，失焦 / 回车才校验落盘；
   841	  // 不在本机已安装列表里的值拒绝写入并回落默认。
   842	  const commitHeadingFont = (level: HeadingLevel, text: string) => {
   843	    const parsed = parseHeadingFontInput(text, headingFontOptions);
   844	    if (parsed.kind === "invalid") {
   845	      setHeadingFontText((prev) => ({
   846	        ...prev,
   847	        [level]: headingFontInputValue(headingFontMap[level]),
   848	      }));
   849	      setHeadingFontHint("该字体不在本机已安装列表中，已回落默认。");
   850	      return;
   851	    }
   852	    const value = parsed.kind === "default" ? HEADING_FONT_STACK : parsed.value;
   853	    setConfig({ headingFonts: { ...headingFontMap, [level]: value } });
   854	    setHeadingFontText((prev) => ({
   855	      ...prev,
   856	      [level]: headingFontInputValue(value),
   857	    }));
   858	    setHeadingFontHint("");
   859	    void saveAppConfig();
   860	  };
   861	
   862	  const toggleCapability = (id: CapabilityId, enabled: boolean) => {
   863	    setCapabilityEnabled(id, enabled);
   864	    setCapabilities(listCapabilities());
   865	    void saveAppConfig();
   866	  };
   867	
   868	  const updatePreview = (patch: Partial<PreviewSettings>) => {
   869	    useStore.getState().setPreviewSettings(patch);
   870	    void saveAppConfig();
   871	  };
   872	
   873	  const chooseEditorFontSize = (size: number) => {
   874	    setFontSize(size);
   875	    setConfig({ fontSize: size });
   876	    document.documentElement.style.setProperty(
   877	      "--editor-font-size",
   878	      `${size}px`,
   879	    );
   880	    void saveAppConfig();
   881	  };
   882	
   883	  const chooseReaderWidth = (width: number) => {
   884	    setConfig({ readerWidth: width });
   885	    void saveAppConfig();
   886	  };
   887	
   888	  const chooseDefaultSavePath = async () => {
   889	    try {
   890	      const dir = await invoke<string>("pick_folder");
   891	      if (!dir) return;
   892	      setConfig({ defaultSavePath: dir });
   893	      void saveAppConfig();
   894	    } catch {
   895	      // 用户取消选择：保持原值
   896	    }
   897	  };
   898	
   899	  const clearDefaultSavePath = () => {
   900	    setConfig({ defaultSavePath: null });
   901	    void saveAppConfig();
   902	  };
   903	
   904	  // 拖动滑块时只更新配置（正文即时跟随）；松手/失焦再落盘，避免每一档
   905	  // 都触发一次 saveAppConfig。
   906	  const previewReaderWidth = (width: number) => {
   907	    setConfig({ readerWidth: width });
   908	  };
   909	
   910	  const commitReaderWidth = () => {
   911	    void saveAppConfig();
   912	  };
   913	
   914	  const chooseSelectionToolbar = (mode: "roulette" | "capsule") => {
   915	    setConfig({ selectionToolbar: mode });
   916	    void saveAppConfig();
   917	  };
   918	
   919	  const updatePropertyBar = (patch: Partial<PropertyBarConfig>) => {
   920	    const next: PropertyBarConfig = {
   921	      displayStyle: propertyBarStyle,
   922	      displayDefault: {
   923	        preview: propertyBarPreview,
   924	        edit: propertyBarEdit,
   925	      },
   926	      newDocVisible: propertyBarNewDoc,
   927	      ...patch,
   928	    };
   929	    setConfig({ propertyBar: next });
   930	    applyPropertyBarConfig(next);
   931	    void saveAppConfig();
   932	  };
   933	
   934	  const chooseRouletteForm = (form: "hub" | "disk") => {
   935	    setConfig({ rouletteForm: form });
   936	    void saveAppConfig();
   937	  };
   938	
   939	  // 提示时长：输入只改本地文本，失焦/回车才校验落盘；非法值不写配置并回退。
   940	  const onNoticeDurationChange = (e: ChangeEvent<HTMLInputElement>) => {
   941	    setNoticeText(e.target.value);
   942	  };
   943	  const commitNoticeDuration = () => {
   944	    const parsed = parseNoticeDuration(noticeText);
   945	    if (parsed.kind === "invalid") {
   946	      setNoticeText(noticeDuration == null ? "" : noticeDuration.toFixed(1));
   947	      return;
   948	    }
   949	    setConfig({
   950	      noticeDuration: parsed.kind === "valid" ? parsed.value : null,
   951	    });
   952	    void saveAppConfig();
   953	  };
   954	
   955	  // 快捷键输入：输入即写配置，失焦/回车才落盘；清空视为恢复默认。
   956	  const onRouletteHotkeyChange = (e: ChangeEvent<HTMLInputElement>) => {
   957	    const value = e.target.value;
   958	    setConfig({ rouletteHotkey: value.trim() ? value : null });
   959	  };
   960	  const commitRouletteHotkey = () => {
   961	    if (!rouletteHotkey?.trim()) setConfig({ rouletteHotkey: null });
   962	    void saveAppConfig();
   963	  };
   964	
   965	  const activeSectors: string[] =
   966	    rouletteSectors ?? ROULETTE_SECTOR_META.map((m) => m.id);
   967	  const saveSectors = (next: string[]) => {
   968	    setConfig({ rouletteSectors: next.length > 0 ? next : null });
   969	    void saveAppConfig();
   970	  };
   971	  const toggleSector = (id: string) => {
   972	    const has = activeSectors.includes(id);
   973	    if (has && activeSectors.length <= 1) return;
   974	    saveSectors(
   975	      has ? activeSectors.filter((x) => x !== id) : [...activeSectors, id],
   976	    );
   977	  };
   978	  const moveSector = (id: string, dir: -1 | 1) => {
   979	    const idx = activeSectors.indexOf(id);
   980	    const to = idx + dir;
   981	    if (idx < 0 || to < 0 || to >= activeSectors.length) return;
   982	    const next = [...activeSectors];
   983	    const tmp = next[idx];
   984	    next[idx] = next[to];
   985	    next[to] = tmp;
   986	    saveSectors(next);
   987	  };
   988	  const resetSectors = () => {
   989	    setConfig({ rouletteSectors: null });
   990	    void saveAppConfig();
   991	  };
   992	
   993	  const activeToolbarItems: string[] =
   994	    htmlToolbarItems ?? HTML_TOOLBAR_ITEMS.map((item) => item.id);
   995	  const saveToolbarItems = (next: string[]) => {
   996	    setConfig({ htmlToolbarItems: next.length > 0 ? next : null });
   997	    void saveAppConfig();
   998	  };
   999	  const toggleToolbarItem = (id: string) => {
  1000	    const has = activeToolbarItems.includes(id);
  1001	    if (has && activeToolbarItems.length <= 1) return;
  1002	    saveToolbarItems(
  1003	      has
  1004	        ? activeToolbarItems.filter((x) => x !== id)
  1005	        : [...activeToolbarItems, id],
  1006	    );
  1007	  };
  1008	  const moveToolbarItem = (id: string, dir: -1 | 1) => {
  1009	    const idx = activeToolbarItems.indexOf(id);
  1010	    const to = idx + dir;
  1011	    if (idx < 0 || to < 0 || to >= activeToolbarItems.length) return;
  1012	    const next = [...activeToolbarItems];
  1013	    const tmp = next[idx];
  1014	    next[idx] = next[to];
  1015	    next[to] = tmp;
  1016	    saveToolbarItems(next);
  1017	  };
  1018	  const resetToolbarItems = () => {
  1019	    setConfig({ htmlToolbarItems: null });
  1020	    void saveAppConfig();
  1021	  };
  1022	
  1023	  const chooseReaderSkin = (skin: string) => {
  1024	    setConfig({ readerSkin: skin });
  1025	    applyReaderSkin(skin);
  1026	    void saveAppConfig();
  1027	  };
  1028	
  1029	  const chooseRailLayout = (layout: "stacked" | "tabs") => {
  1030	    setRailLayout(layout);
  1031	    saveRailViewSpec();
  1032	  };
  1033	
  1034	  const chooseRailDensity = (density: "compact" | "comfortable" | "card") => {
  1035	    setRailDensity(density);
  1036	    saveRailViewSpec();
  1037	  };
  1038	
  1039	  const changeRailCardHeight = (height: number) => {
  1040	    setRailCardHeight(height);

exec
/bin/zsh -lc 'wc -l src/lib/shortcuts.ts src/editors/keybindings.ts src/lib/paneHeaderMenu.ts src/ui/icons.ts src/editors/icons.ts src/editors/orchestration/capsule-toolbar.ts src/editors/orchestration/floating-toolbar.ts src/editors/orchestration/slots.ts src-tauri/src/config.rs src/hooks/useConfig.ts src-tauri/src/ai_agent.rs src-tauri/src/extensions.rs; rg -n "exportFormat|defaultExport|export.*(option|setting)|EXPORT_MENU_ITEMS|EXPORT_" src src-tauri | head -n 200' in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
     564 src/lib/shortcuts.ts
      86 src/editors/keybindings.ts
      76 src/lib/paneHeaderMenu.ts
     711 src/ui/icons.ts
     803 src/editors/icons.ts
     173 src/editors/orchestration/capsule-toolbar.ts
     903 src/editors/orchestration/floating-toolbar.ts
      47 src/editors/orchestration/slots.ts
    1807 src-tauri/src/config.rs
     668 src/hooks/useConfig.ts
     772 src-tauri/src/ai_agent.rs
     691 src-tauri/src/extensions.rs
    7301 total
src/lib/export/html.ts:33:const EXPORT_SHELL_CSS = `
src/lib/export/html.ts:91:    `<style>${opts.css}\n${EXPORT_SHELL_CSS}</style>`,
src/lib/paneHeaderMenu.ts:56:export const EXPORT_MENU_ITEMS: readonly ExportMenuItem[] = [
src/lib/mdpkg/vendor/mdpkg-web.js:15110:    combineExtensions([constructs_exports, ...settings.extensions || []])
src/editors/orchestration/horizontal-toolbar.ts:176:export function horizontalToolbar(options?: { copyOnly?: boolean }) {
src/types/index.ts:173:export type Scene = "portal" | "workspace" | "grid" | "settings";
src/components/TabBar.tsx:27:import { EXPORT_MENU_ITEMS } from "../lib/paneHeaderMenu";
src/components/TabBar.tsx:764:                {EXPORT_MENU_ITEMS.map((sub) => (
src/editors/decorations/imageCrop.ts:109:export function openImageCrop(options: ImageCropOptions): void {
src/__tests__/paneHeader.test.tsx:4:  EXPORT_MENU_ITEMS,
src/__tests__/paneHeader.test.tsx:76:    expect(EXPORT_MENU_ITEMS.map((i) => i.label)).toEqual([
src/__tests__/paneHeader.test.tsx:87:    expect(EXPORT_MENU_ITEMS.map((i) => i.action)).not.toContain("print");

exec
/bin/zsh -lc "nl -ba src/ui/icons.ts | sed -n '1,120p;680,760p'; nl -ba src/editors/icons.ts | sed -n '1,130p;760,840p'; rg -n \"export (const|type|function)|ICONS|iconSvg|IconName\" src/ui/icons.ts src/editors/icons.ts" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
     1	/**
     2	 * 全站图标 path 表（Layout Portal D9）。
     3	 *
     4	 * 24×24 viewBox、`fill="currentColor"`、18（密集）/24（主操作）两档。
     5	 * 刻意做成静态 path 表而不是引入图标库：没有运行时依赖、可被 tree-shake，
     6	 * 也方便「图标抽屉」把在用图标全部列出来。
     7	 *
     8	 * 规矩：一个概念一个图标；同一概念全产品同一形状；不混风格；禁 emoji。
     9	 */
    10	
    11	export type IconName =
    12	  | "markdown"
    13	  | "html"
    14	  | "text"
    15	  | "pdf"
    16	  | "video"
    17	  | "image"
    18	  | "code"
    19	  | "audio"
    20	  | "folder"
    21	  | "moveTo"
    22	  | "clock"
    23	  | "file"
    24	  | "close"
    25	  | "closeOthers"
    26	  | "search"
    27	  | "settings"
    28	  | "sun"
    29	  | "moon"
    30	  | "monitor"
    31	  | "pin"
    32	  | "grid"
    33	  | "check"
    34	  | "warning"
    35	  | "expand"
    36	  | "more"
    37	  | "eye"
    38	  | "pencil"
    39	  | "export"
    40	  | "exportWord"
    41	  | "exportZip"
    42	  | "exportMdpkg"
    43	  | "print"
    44	  | "share"
    45	  | "splitRight"
    46	  | "splitDown"
    47	  | "locate"
    48	  | "refresh"
    49	  | "copyPath"
    50	  | "chevronLeft"
    51	  | "chevronRight"
    52	  | "chevronDown"
    53	  | "sparkle"
    54	  | "pinOff"
    55	  | "immersive"
    56	  | "collapse"
    57	  | "play"
    58	  | "pause"
    59	  | "prev"
    60	  | "next"
    61	  | "volume"
    62	  | "volumeMute"
    63	  | "playlist"
    64	  | "loopNone"
    65	  | "loopSingle"
    66	  | "loopPlaylist"
    67	  | "subtitle"
    68	  | "timestampNote"
    69	  | "fullscreen"
    70	  | "keyboardHints"
    71	  | "pip"
    72	  | "camera"
    73	  | "tune"
    74	  | "droplet"
    75	  | "layoutAuto"
    76	  | "rotate"
    77	  | "zoomIn"
    78	  | "zoomOut"
    79	  | "speed"
    80	  | "width"
    81	  | "home"
    82	  | "heart"
    83	  | "heartFilled"
    84	  | "sunBright"
    85	  | "sunWarm"
    86	  | "abstract"
    87	  | "success"
    88	  | "question"
    89	  | "failure"
    90	  | "bug"
    91	  | "example"
    92	  | "convert"
    93	  | "align"
    94	  | "bold"
    95	  | "italic"
    96	  | "underline"
    97	  | "strike"
    98	  | "link"
    99	  | "h1"
   100	  | "h2"
   101	  | "h3"
   102	  | "h4"
   103	  | "h5"
   104	  | "h6"
   105	  | "bullet"
   106	  | "ordered"
   107	  | "todo"
   108	  | "quote"
   109	  | "blockcode"
   110	  | "callout"
   111	  | "table"
   112	  | "undo"
   113	  | "redo"
   114	  | "copy"
   115	  | "trash"
   116	  | "scissors"
   117	  | "brush"
   118	  | "alignLeft"
   119	  | "alignCenter"
   120	  | "alignRight"
   680	
   681	export const ICON_NAMES = Object.keys(ICONS) as IconName[];
   682	
   683	/**
   684	 * 把图标序列化成 HTML 字符串，供非 React 渲染面（播放器 ArtPlayer 自绘控件）
   685	 * 复用同一张表。规则与 `Icon.tsx` 保持一致：`s` 描边、`d` 实心、`parts` 多段。
   686	 */
   687	export function iconSvg(name: IconName, size = 22): string {
   688	  const def = ICONS[name];
   689	  const parts = def.parts ?? [{ d: def.d, s: def.s, dash: def.dash }];
   690	  const inner = parts
   691	    .map((part) => {
   692	      const out: string[] = [];
   693	      if (part.s) {
   694	        const dash = part.dash ? ` stroke-dasharray="${part.dash}"` : "";
   695	        out.push(
   696	          `<path d="${part.s}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"${dash}/>`,
   697	        );
   698	      }
   699	      if (part.d) {
   700	        out.push(
   701	          `<path d="${part.d}" fill="currentColor" fill-rule="evenodd"/>`,
   702	        );
   703	      }
   704	      return out.join("");
   705	    })
   706	    .join("");
   707	  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" data-icon="${name}">${inner}</svg>`;
   708	}
   709	
   710	/** 两档尺寸：密集列表 18px，主操作 24px。 */
   711	export type IconSize = 14 | 18 | 24;
     1	/* 图标系统（移植自 md-bundle packages/editor/src/icons.ts，ticket #322）。
     2	 *
     3	 * 生成 `<svg data-icon="XxxOutlined" viewBox="0 0 24 24" fill="currentColor">`，
     4	 * 并给出块类型/动作到图标名的映射。图标名沿用 Material 的 "XxxOutlined"
     5	 * 命名，让 data-icon 成为稳定、可 grep 的词汇 token；SVG 内容要么是路径
     6	 * 数据（几何图标），要么是短文本字形（标题级别 H1..H6），两者共用同一
     7	 * viewBox/取色契约。
     8	 *
     9	 * 纯 SSOT：不出现 emoji，图标一律是 SVG。
    10	 */
    11	
    12	import { ICONS as UI_ICONS, type IconName as UiIconName } from "../ui/icons";
    13	
    14	const SVG_NS = "http://www.w3.org/2000/svg";
    15	
    16	/** Default rendered icon size — matches the existing 16px gutter slot. */
    17	const ICON_SIZE_PX = "20px";
    18	
    19	type IconDef =
    20	  | { readonly kind: "text"; readonly label: string; readonly weight?: number }
    21	  | {
    22	      readonly kind: "paths";
    23	      readonly paths: readonly string[];
    24	      /** true 时按描边渲染（线稿图标，与 `ui/icons.ts` 的 `iconSvg` 同一条 path）。 */
    25	      readonly stroke?: boolean;
    26	    };
    27	
    28	/** 分栏 1..5 栏：直接取 `ui/icons.ts` 的描边 path，保证与选区轮盘图形同源。 */
    29	function columnStrokePath(name: UiIconName): string {
    30	  return UI_ICONS[name].s ?? "";
    31	}
    32	
    33	/**
    34	 * Icon registry — the single source of truth for the `data-icon` vocabulary.
    35	 * Adding a new block type or action only needs a new entry here; consumers
    36	 * reference icons by name string, so no call-site changes are required.
    37	 */
    38	const ICON_REGISTRY: Record<string, IconDef> = {
    39	  // Inline format — the doubao vocabulary (spec: .lavish/doubao-editor-spec-v2.html).
    40	  // These replace the text glyphs (`B`/`I`/`U`/`S`) the toolbar used to print (#471).
    41	  BoldOutlined: {
    42	    kind: "paths",
    43	    paths: [
    44	      "M6 4h6.2a4 4 0 0 1 2.9 6.7A4.2 4.2 0 0 1 13 18H6zm3 2.6v3.6h3.2a1.8 1.8 0 0 0 0-3.6zm0 6.2v3.6h4a1.8 1.8 0 0 0 0-3.6z",
    45	    ],
    46	  },
    47	  ItalicOutlined: {
    48	    kind: "paths",
    49	    paths: ["M10 4h6v2h-2.2l-3.4 12H13v2H7v-2h2.2l3.4-12H10z"],
    50	  },
    51	  UnderlineOutlined: {
    52	    kind: "paths",
    53	    paths: ["M6 3h2v8a4 4 0 0 0 8 0V3h2v8a6 6 0 0 1-12 0zM5 20h14v2H5z"],
    54	  },
    55	  StrikethroughOutlined: {
    56	    kind: "paths",
    57	    paths: [
    58	      "M12 3c3 0 5 1.4 5 3.8h-2c0-1.1-1.2-1.8-3-1.8s-3 .6-3 1.8c0 .7.4 1.2 1.3 1.6H8.2C7.5 7.8 7 7.1 7 6c0-2.2 2-3 5-3z",
    59	      "M4 11h16v2H4z",
    60	      "M12 21c-3 0-5-1.4-5-3.8h2c0 1.1 1.2 1.8 3 1.8s3-.6 3-1.8c0-.7-.4-1.2-1.3-1.6h2.1c.7.6 1.2 1.3 1.2 2.4 0 2.2-2 3-5 3z",
    61	    ],
    62	  },
    63	  FontcolorOutlined: {
    64	    kind: "paths",
    65	    paths: [
    66	      "M9.4 4h2.2L16.4 18h-2.3l-.9-3.2H8.8L7.9 18H5.6zm.3 8.9h3.6l-1.8-6z",
    67	      "M4 20h16v2H4z",
    68	    ],
    69	  },
    70	  DocColumnsOutlined: {
    71	    kind: "paths",
    72	    paths: ["M4 4h7v16H4zm9 0h7v16h-7zM6 6v12h3V6zm9 0v12h3V6z"],
    73	  },
    74	  GlobalLinkOutlined: {
    75	    kind: "paths",
    76	    paths: [
    77	      "M10.6 13.4a1 1 0 0 1 0-1.4l2.8-2.8a4 4 0 0 1 5.7 5.7l-1.4 1.4-1.4-1.4 1.4-1.4a2 2 0 1 0-2.9-2.9l-2.8 2.8a1 1 0 0 1-1.4 0z",
    78	      "M13.4 10.6a1 1 0 0 1 0 1.4l-2.8 2.8a4 4 0 0 1-5.7-5.7l1.4-1.4 1.4 1.4-1.4 1.4a2 2 0 1 0 2.9 2.9l2.8-2.8a1 1 0 0 1 1.4 0z",
    79	    ],
    80	  },
    81	  DeleteTrashOutlined: {
    82	    kind: "paths",
    83	    paths: [
    84	      "M9 3h6l1 2h4v2H4V5h4zM6 8h12l-1 12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2zm3 3v8h2v-8zm4 0v8h2v-8z",
    85	    ],
    86	  },
    87	  TypographyOutlined: {
    88	    kind: "paths",
    89	    paths: ["M4 4h16v3h-6.5v13h-3V7H4z"],
    90	  },
    91	  InlineCodeOutlined: {
    92	    kind: "paths",
    93	    paths: [
    94	      "M9.4 7.4 4.8 12l4.6 4.6-1.4 1.4L1.9 12 8 5.9zM14.6 7.4 20.1 12l-5.5 5.4-1.4-1.4L17.3 12l-4.1-4.6z",
    95	    ],
    96	  },
    97	
    98	  StyleSetOutlined: {
    99	    kind: "paths",
   100	    paths: [
   101	      "M12 3a9 9 0 0 1 9 9 3 3 0 0 1-3 3h-1.2a1.8 1.8 0 0 0 0 3.6H18a3 3 0 0 1-3 3 9 9 0 1 1-3-18zm-3.5 5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm2 6a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm6-1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-4-5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z",
   102	    ],
   103	  },
   104	
   105	  // 公式 —— 根号 + 变量（新增手柄「常用」段）。
   106	  FormulaOutlined: {
   107	    kind: "paths",
   108	    paths: ["M3 16h3l3-9 3 9", "M12 12h7", "M15 17l4-4", "M19 17l-4-4"],
   109	  },
   110	
   111	  // Headings — bold "H1".."H6" text marks so each level is visually distinct
   112	  // (AC: "手柄图标随块型切换" must be observable, not just attribute-different).
   113	  H1Outlined: { kind: "text", label: "H1", weight: 700 },
   114	  H2Outlined: { kind: "text", label: "H2", weight: 700 },
   115	  H3Outlined: { kind: "text", label: "H3", weight: 700 },
   116	  H4Outlined: { kind: "text", label: "H4", weight: 700 },
   117	  H5Outlined: { kind: "text", label: "H5", weight: 700 },
   118	  H6Outlined: { kind: "text", label: "H6", weight: 700 },
   119	  HOutlined: { kind: "text", label: "H", weight: 700 },
   120	
   121	  // Task — checked = circle with checkmark, unchecked = empty square.
   122	  TaskAltOutlined: {
   123	    kind: "paths",
   124	    paths: [
   125	      "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1.2 14.5L6.4 12l1.4-1.4 3 3 5.4-5.4 1.4 1.4z",
   126	    ],
   127	  },
   128	  CheckBoxOutlineBlankOutlined: {
   129	    kind: "paths",
   130	    paths: [
   760	}
   761	
   762	/**
   763	 * Action/convert → icon-name maps — the single source of truth for the
   764	 * block-handle menu. Kept here (not in block-handle-dom) so the icon
   765	 * vocabulary has one home; block-handle-dom imports the names it needs.
   766	 */
   767	
   768	/** Icon name for a 转换为 menu row targeting a heading level or paragraph. */
   769	export const CONVERT_ICON_NAME: Record<string, string> = {
   770	  h1: "H1Outlined",
   771	  h2: "H2Outlined",
   772	  h3: "H3Outlined",
   773	  h4: "H4Outlined",
   774	  h5: "H5Outlined",
   775	  h6: "H6Outlined",
   776	  paragraph: "FormatParagraphOutlined",
   777	  ordered: "OrderListOutlined",
   778	  bullet: "DisorderListOutlined",
   779	  todo: "TodoOutlined",
   780	  code: "CodeblockOutlined",
   781	  quote: "ReferenceOutlined",
   782	  callout: "CalloutOutlined",
   783	};
   784	
   785	/** Icon name for a structural action (move/duplicate/delete). */
   786	export const ACTION_ICON_NAME: Record<
   787	  "move-up" | "move-down" | "duplicate" | "delete",
   788	  string
   789	> = {
   790	  "move-up": "ArrowUpwardOutlined",
   791	  "move-down": "ArrowDownwardOutlined",
   792	  // Same vocabulary as COMMAND_ICON_NAME: one delete icon, one copy icon (#484).
   793	  duplicate: "CopyOutlined",
   794	  delete: "DeleteTrashOutlined",
   795	};
   796	
   797	/** True when `name` is a registry icon (so a toolbar option can render an SVG). */
   798	export function hasIcon(name: string): boolean {
   799	  return Object.prototype.hasOwnProperty.call(ICON_REGISTRY, name);
   800	}
   801	
   802	/** Icon name for the empty-line "+" affordance. */
   803	export const ADD_ICON_NAME = "AddOutlined";
src/editors/icons.ts:12:import { ICONS as UI_ICONS, type IconName as UiIconName } from "../ui/icons";
src/editors/icons.ts:24:      /** true 时按描边渲染（线稿图标，与 `ui/icons.ts` 的 `iconSvg` 同一条 path）。 */
src/editors/icons.ts:29:function columnStrokePath(name: UiIconName): string {
src/editors/icons.ts:30:  return UI_ICONS[name].s ?? "";
src/editors/icons.ts:587:export const COMMAND_ICON_NAME: Readonly<Record<string, string>> = {
src/editors/icons.ts:678:export function resolveIconName(
src/editors/icons.ts:692:export function renderIconInto(
src/editors/icons.ts:697:  const name = resolveIconName(commandId, declared);
src/editors/icons.ts:711:export const HANDLE_DEFAULT_ICON = FALLBACK_ICON_NAME;
src/editors/icons.ts:719:export function renderIcon(name: string): SVGSVGElement {
src/editors/icons.ts:769:export const CONVERT_ICON_NAME: Record<string, string> = {
src/editors/icons.ts:786:export const ACTION_ICON_NAME: Record<
src/editors/icons.ts:798:export function hasIcon(name: string): boolean {
src/editors/icons.ts:803:export const ADD_ICON_NAME = "AddOutlined";
src/ui/icons.ts:11:export type IconName =
src/ui/icons.ts:160:export const ICONS: Record<IconName, IconDef> = {
src/ui/icons.ts:681:export const ICON_NAMES = Object.keys(ICONS) as IconName[];
src/ui/icons.ts:687:export function iconSvg(name: IconName, size = 22): string {
src/ui/icons.ts:688:  const def = ICONS[name];
src/ui/icons.ts:711:export type IconSize = 14 | 18 | 24;

exec
/bin/zsh -lc "nl -ba src-tauri/src/ai_agent.rs | sed -n '650,780p;780,900p'; rg -n \"read_config|patch_config|list_snapshots|skill_map|SKILL_MAP|export|keybind|menus|capsules|icons|view-specs|reader-presets|newdoc|capture\" src-tauri/src/ai_agent.rs src-tauri/src/commands/ai_agent_cmd.rs src-tauri/src/lib.rs" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
   650	            tool_call("c2", "list_snapshots", json!({})),
   651	            text("已改为深色"),
   652	        ]);
   653	        let reply = run_loop(&completer, base, vec![Message::user("切深色")])
   654	            .await
   655	            .unwrap();
   656	
   657	        assert_eq!(reply.text, "已改为深色");
   658	        assert!(read_user(base).contains("\"dark\""), "{}", read_user(base));
   659	        assert_eq!(load_config_at(base).unwrap().theme.as_deref(), Some("dark"));
   660	
   661	        let snapshots = list_snapshots(base).unwrap();
   662	        assert_eq!(snapshots.len(), 1, "写入前应产生一份快照: {snapshots:?}");
   663	        let snapshot = std::fs::read_to_string(base.join("snapshots").join(&snapshots[0])).unwrap();
   664	        assert!(snapshot.contains("\"light\""), "快照应是旧值: {snapshot}");
   665	
   666	        let tool_msgs: Vec<String> = completer
   667	            .last_messages()
   668	            .into_iter()
   669	            .filter(|m| m.role == "tool")
   670	            .filter_map(|m| m.content)
   671	            .collect();
   672	        assert_eq!(tool_msgs.len(), 2);
   673	        assert!(tool_msgs[1].contains(&snapshots[0]), "got {}", tool_msgs[1]);
   674	    }
   675	
   676	    #[test]
   677	    fn read_config_matches_effective_config() {
   678	        let dir = temp_base("read");
   679	        let base = dir.path();
   680	        std::fs::create_dir_all(user_path(base).parent().unwrap()).unwrap();
   681	        std::fs::write(user_path(base), r#"{"theme":"warm","fontSize":19.0}"#).unwrap();
   682	
   683	        let raw = dispatch_tool(base, "read_config", &json!({})).unwrap();
   684	        let parsed: Value = serde_json::from_str(&raw).unwrap();
   685	        let expected = serde_json::to_value(load_config_at(base).unwrap()).unwrap();
   686	
   687	        assert_eq!(parsed["ok"], json!(true));
   688	        assert_eq!(parsed["result"], expected);
   689	        assert_eq!(parsed["result"]["theme"], json!("warm"));
   690	        assert_eq!(parsed["result"]["fontSize"], json!(19.0));
   691	    }
   692	
   693	    #[test]
   694	    fn unknown_tool_returns_structured_error() {
   695	        let dir = temp_base("unknown");
   696	        let raw = dispatch_tool(dir.path(), "rm_rf", &json!({})).unwrap();
   697	        let parsed: Value = serde_json::from_str(&raw).unwrap();
   698	        assert_eq!(parsed["ok"], json!(false));
   699	        assert_eq!(parsed["error"]["kind"], json!("tool"));
   700	    }
   701	
   702	    #[test]
   703	    fn tool_schemas_cover_three_tools() {
   704	        let names: Vec<String> = tool_schemas()
   705	            .iter()
   706	            .map(|s| s["function"]["name"].as_str().unwrap().to_string())
   707	            .collect();
   708	        assert_eq!(names, vec!["read_config", "patch_config", "list_snapshots"]);
   709	    }
   710	
   711	    #[tokio::test]
   712	    async fn openai_completer_uses_configured_endpoint_and_bearer() {
   713	        use std::io::{Read, Write};
   714	        use std::net::TcpListener;
   715	        use std::sync::{Arc, Mutex};
   716	
   717	        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
   718	        let addr = listener.local_addr().unwrap();
   719	        let captured = Arc::new(Mutex::new(String::new()));
   720	        let server_capture = captured.clone();
   721	
   722	        let server = std::thread::spawn(move || {
   723	            let (mut stream, _) = listener.accept().unwrap();
   724	            let mut buf = [0u8; 8192];
   725	            let n = stream.read(&mut buf).unwrap();
   726	            server_capture
   727	                .lock()
   728	                .unwrap()
   729	                .push_str(&String::from_utf8_lossy(&buf[..n]));
   730	            let body = r#"{"choices":[{"message":{"content":"ok"}}]}"#;
   731	            let response = format!(
   732	                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
   733	                body.len(),
   734	                body
   735	            );
   736	            stream.write_all(response.as_bytes()).unwrap();
   737	            stream.flush().unwrap();
   738	        });
   739	
   740	        let completer = OpenAiCompleter::new(format!("http://{addr}"), "test-model", "sk-test");
   741	        let response = completer
   742	            .complete(CompletionRequest {
   743	                messages: vec![Message::user("hi")],
   744	                tools: vec![],
   745	            })
   746	            .await
   747	            .unwrap();
   748	        server.join().unwrap();
   749	
   750	        assert_eq!(response.content.as_deref(), Some("ok"));
   751	        let request = captured.lock().unwrap().clone();
   752	        assert!(request.contains("POST /v1/chat/completions"), "{request}");
   753	        assert!(request.contains("Bearer sk-test"), "{request}");
   754	        assert!(request.contains("\"model\":\"test-model\""), "{request}");
   755	    }
   756	
   757	    #[test]
   758	    fn completions_url_respects_versioned_bases() {
   759	        assert_eq!(
   760	            completions_url("https://api.deepseek.com"),
   761	            "https://api.deepseek.com/v1/chat/completions"
   762	        );
   763	        assert_eq!(
   764	            completions_url("https://open.bigmodel.cn/api/paas/v4/"),
   765	            "https://open.bigmodel.cn/api/paas/v4/chat/completions"
   766	        );
   767	        assert_eq!(
   768	            completions_url("https://dashscope.aliyuncs.com/compatible-mode/v1"),
   769	            "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
   770	        );
   771	    }
   772	}
src-tauri/src/lib.rs:195:            config::seed_skill_map(app.handle());
src-tauri/src/lib.rs:237:            commands::capture::append_inbox,
src-tauri/src/lib.rs:238:            commands::capture::append_inbox_batch,
src-tauri/src/lib.rs:239:            commands::capture::load_today_inbox,
src-tauri/src/lib.rs:240:            commands::capture::load_inbox_by_date,
src-tauri/src/lib.rs:241:            commands::capture::edit_inbox_entry,
src-tauri/src/lib.rs:242:            commands::capture::delete_inbox_entry,
src-tauri/src/lib.rs:243:            commands::capture::archive_entry,
src-tauri/src/lib.rs:244:            commands::capture::save_config_capture,
src-tauri/src/lib.rs:245:            commands::capture::load_config_capture,
src-tauri/src/lib.rs:246:            commands::capture::set_overlay_pinned,
src-tauri/src/lib.rs:247:            commands::capture::show_overlay_window,
src-tauri/src/lib.rs:248:            commands::capture::hide_overlay_window,
src-tauri/src/ai_agent.rs:8:use crate::config::{apply_patch_at, list_snapshots, load_config_at};
src-tauri/src/ai_agent.rs:192:                "name": "read_config",
src-tauri/src/ai_agent.rs:200:                "name": "patch_config",
src-tauri/src/ai_agent.rs:218:                "name": "list_snapshots",
src-tauri/src/ai_agent.rs:238:        "read_config" => match load_config_at(base) {
src-tauri/src/ai_agent.rs:241:                    context: "read_config".into(),
src-tauri/src/ai_agent.rs:248:        "patch_config" => {
src-tauri/src/ai_agent.rs:258:                        context: "patch_config".into(),
src-tauri/src/ai_agent.rs:266:        "list_snapshots" => match list_snapshots(base) {
src-tauri/src/ai_agent.rs:562:            tool_call("c1", "read_config", json!({})),
src-tauri/src/ai_agent.rs:572:        assert_eq!(reply.tool_calls, vec!["read_config".to_string()]);
src-tauri/src/ai_agent.rs:590:            .map(|i| tool_call(&format!("c{i}"), "list_snapshots", json!({})))
src-tauri/src/ai_agent.rs:616:                "patch_config",
src-tauri/src/ai_agent.rs:647:                "patch_config",
src-tauri/src/ai_agent.rs:650:            tool_call("c2", "list_snapshots", json!({})),
src-tauri/src/ai_agent.rs:661:        let snapshots = list_snapshots(base).unwrap();
src-tauri/src/ai_agent.rs:677:    fn read_config_matches_effective_config() {
src-tauri/src/ai_agent.rs:683:        let raw = dispatch_tool(base, "read_config", &json!({})).unwrap();
src-tauri/src/ai_agent.rs:708:        assert_eq!(names, vec!["read_config", "patch_config", "list_snapshots"]);
src-tauri/src/ai_agent.rs:719:        let captured = Arc::new(Mutex::new(String::new()));
src-tauri/src/ai_agent.rs:720:        let server_capture = captured.clone();
src-tauri/src/ai_agent.rs:726:            server_capture
src-tauri/src/ai_agent.rs:751:        let request = captured.lock().unwrap().clone();

exec
/bin/zsh -lc "nl -ba docs/research/technical/data-fileization-omarchy-inventory.md | sed -n '1,280p'; rg -n \"独立视图|四字段|view|欠账|未实现|读者|reader|导出|快捷键|图标\" docs/research/technical/data-fileization-omarchy-inventory.md" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
     1	---
     2	title: 数据文件化盘点——omarchy 扩展点落地现状、AI 可改通路与数据范围
     3	type: research
     4	source_of_truth: supporting
     5	status: draft
     6	last_updated: 2026-11-10
     7	---
     8	
     9	# 数据文件化盘点——omarchy 扩展点落地现状、AI 可改通路与数据范围
    10	
    11	> **目的**：回答四个问题——数据文件化是如何实现的、任务如何安排落实、如何让数据尽可能文件化后 AI 可直接修改、数据文件化的范围有哪些。
    12	> **依据**：`docs/research/technical/plugin-management-benchmark.md`（Omarchy「扩展点 = 数据文件」对标）、已归档 change `2026-11-01-text-config-layer` 与 `2026-11-03-extension-points` 的 design.md、已归档 change `layout-portal`（[#170](https://github.com/jianxi-dev/clairis/issues/170)）的 design.md D11、ADR 0004/0005。
    13	> **效力**：第 6 层 research（supporting），不参与行为裁定；行为真相源在 `openspec/specs/` 与 change 内。
    14	> **勘误（2026-11-10）**：本文 11-04 版有三处与代码不符，已就地更正——①`user/views/{rail,grid,preview}.json` **从未实现**：`layout-portal` D11 未按独立文件落地，视图规格实际合并进 `user/settings.json` 的 `railViewSpec` / `previewSettings` / `aiViewSpec` / `paneLayout` 四字段（现状见 `docs/architecture/overview.md` §7；`grep -rn "user/views" src-tauri/src` 零命中）；②扩展管理面已落地（`src-tauri/src/extension_packages.rs`，[#184](https://github.com/jianxi-dev/clairis/issues/184) 已关闭）；③扩展点根目录是 `app_config_dir()`——macOS `~/Library/Application Support/dev.biaoyue.app/`、Linux `~/.config/dev.biaoyue.app/`，文中 `~/.config/clairis/` 为旧标识符写法。数据面现行判据已升级为 `docs/agents/data-surface.md`（六栏落点 + 机检），本文 §3.2 保留为历史推理。
    15	
    16	---
    17	
    18	## 一、数据文件化是如何实现的（已落地机制）
    19	
    20	Omarchy 的核心借鉴是：**扩展点 = 数据文件，不执行用户代码**（benchmark 建议 2 → extension-points change 前提 D6）；加上**所有权三分**目录约定（benchmark 建议 4）。落地分两批：
    21	
    22	### 1.1 配置三层与快照回滚（text-config-layer，2026-11-01 归档，已实现）
    23	
    24	在 `app_config_dir()` 下建立四类文件，这是数据文件化的**底座**：
    25	
    26	```
    27	defaults/settings.json              # 内置默认（随包发布，升级整体覆盖，用户不可改）
    28	user/settings.json                  # 用户层 / AI 唯一写入口（升级永不触碰）
    29	state/state.json                    # 派生状态（recentFiles、scrollPositions）
    30	snapshots/settings-<RFC3339>.json   # user 快照，最近 10 份
    31	```
    32	
    33	关键机制（design.md D2–D8）：
    34	
    35	- **合并**：有效配置 = defaults ← user 深合并（`serde_json::Value`），前端只看到合并后的 `AppConfig`，结构不变。
    36	- **原子写**：任何写路径先校验 → 写前快照当前 user → tempfile 原子替换；**任何失败路径不产生部分写入**。
    37	- **快照回滚**：写入前自动快照（保留 10 份），`restore_config_snapshot` 一键恢复（拒绝路径穿越）。
    38	- **校验门**：字段级白名单（字号/宽度/比例/主题枚举），非法值拒绝，磁盘不变。
    39	- **热应用**：后端 500ms 轮询 `user/settings.json` 的 `(mtime, len)`，变化即 `config-changed` 事件 → 前端即时生效。**文件被外部改（包括 AI 直接改）也能被发现**——这是「数据文件化后 AI 可改」的物理前提。
    40	
    41	### 1.2 扩展点 = 数据文件（extension-points，2026-11-03 归档，已实现）
    42	
    43	同一目录三分哲学扩展到用户可扩展点——**放一个文件到某个目录就生效**：
    44	
    45	| 扩展点 | 位置 | 格式 | 生效方式 |
    46	|---|---|---|---|
    47	| snippets（斜杠命令） | `app_config_dir()/snippets/*.md` | frontmatter `id/label/keywords/icon` + 正文即插入文本 | 目录扫描 → 注入斜杠菜单；插入走 `insertCommandTextAt` 单事务可撤销 |
    48	| templates（新建页模板） | `app_config_dir()/templates/*.md` | 文件名即模板名；占位符仅 `{{date}}`/`{{title}}` | 新建页选择后写入；未知占位符原样保留不吞内容 |
    49	| theme tokens（主题覆盖） | `app_config_dir()/theme.toml` | `[tokens]` + 仅颜色值 | 白名单：只接受已声明 `--app-*` 键；未知键忽略并聚合告警；删文件即恢复默认 |
    50	| 核心能力开关 | 设置·高级·能力 | `{ id, enable(), disable() }` 幂等接口 | 默认全开、无常驻 UI；关闭=移除扩展不删数据 |
    51	
    52	容错原则：单个文件格式非法 → 跳过该文件并在设置里列出原因，**不影响其它文件**；目录不存在/扫描失败 → 返回空列表不算错误。这继承了 Omarchy「用数据格式本身限制能力」（无执行面 → 最坏结果是「没生效」而不是「搞坏应用」）。
    53	
    54	---
    55	
    56	## 二、任务是如何安排落实的（已完成 vs 排队中）
    57	
    58	| 批次 | change / 票 | 内容 | 状态 |
    59	|---|---|---|---|
    60	| 底座 | `2026-11-01-text-config-layer` | 三层配置 + 原子写 + 快照回滚 + 热应用 | ✅ 已归档（4/4 票） |
    61	| 执行层 | `2026-11-01-ai-agent-loop` + `ai-entry-v1` | agent 循环（三工具）、确认卡三档、撤销/快照 UI | ✅ 已归档 |
    62	| 扩展点 P0 | `2026-11-03-extension-points`（[#76](https://github.com/jianxi-dev/clairis/issues/76)/[#78](https://github.com/jianxi-dev/clairis/issues/78)） | snippets / templates / theme.toml / 能力开关 | ✅ 已归档（4/4 票，票未关需收尾） |
    63	| 视图规格文件化 | `layout-portal`（[#177](https://github.com/jianxi-dev/clairis/issues/177)、[#179](https://github.com/jianxi-dev/clairis/issues/179)，均已关闭） | 设计为 `rail.json`/`grid.json`/`preview.json`/布局树 + 快照 10 份（design.md D11） | ❌ **未按 D11 落地**：change 已归档（16/16 票），但独立文件从未实现；视图规格合并进 `user/settings.json` 四字段（overview §7） |
    64	| 扩展管理面 | `layout-portal` [#184](https://github.com/jianxi-dev/clairis/issues/184)（已关闭） | 文件夹式扩展（manifest.json + SKILL.md）、拖入即启用、AI 生成、导出 | ✅ 已落地（`src-tauri/src/extension_packages.rs`） |
    65	| AI 技能文件化 | 未立项 | 提示词/SKILL 目录约定（对齐 pi skills 模型，benchmark 建议 2 第三条） | 🗒 未立项 |
    66	
    67	落实方式遵循仓库硬约束：**每批能力 = 一个 OpenSpec change**（G0–G4 五 gate），数据文件的目录、格式、校验规则写进 change 的 design.md D 条，验收锚点进 `anchors.md`/`conformance.json`，逐票实施逐票验收。**不做「一次把所有数据都文件化」的大票**——每批跟着需要它的功能 change 走，避免没有消费者的空目录。
    68	
    69	---
    70	
    71	## 三、如何让数据尽可能文件化后 AI 可直接修改
    72	
    73	### 3.1 三条设计保障（已实现或已在 change 中锁定）
    74	
    75	1. **真相源是文件，不是注册表**（benchmark 共同规律 1）：AI 与用户读写**同一份文件**（`user/settings.json`、`app_config_dir()/*.md|toml`），不存在「AI 改了内存、用户存盘被覆盖」的双真相问题。
    76	2. **写路径收敛 + 热应用**：结构化配置走 `save_config`（校验→快照→原子写）；文件被外部改动由 500ms 轮询发现并 `config-changed` 热生效。**AI 既可走受控写，也可直接改文件**，两条路都即时生效且不产生部分写入。
    77	3. **可逆兜底（D7 铁律）**：写前确认卡（人话、三档密度）+ 写前快照（10 份）+ 撤销条；AI 改坏了 `restore_config_snapshot` 一步回来。视图规格类改动（#179）同样经确认卡+快照链路。
    78	
    79	### 3.2 「尽可能文件化」的可操作判据（评审清单）
    80	
    81	拿到任何「应该可配置/可扩展」的需求时，按序回答：
    82	
    83	- **需要改源码吗？** → 需要 = 违反 D6，先想办法变成文本（P4）。
    84	- **是可变状态吗？** → 是 = 应落 `user/` 层文本文件（defaults 层只放精选默认，D5）。
    85	- **会执行代码吗？** → 会 = 不进数据文件扩展点（保持 P0 无执行面；代码级插件是 P1 的事且需信任门）。
    86	- **AI 改错的代价是什么？** → 若最坏是「没生效/被忽略」（白名单容错），合格；若可能「搞坏应用」，缺校验门。
    87	
    88	### 3.3 明确的边界（不文件化的数据）
    89	
    90	| 数据 | 去处 | 理由 |
    91	|---|---|---|
    92	| API key | OS 钥匙串（`get/set/delete_api_key`） | ADR 0005：密钥永不落盘进配置文件 |
    93	| EditorView 实例 | 内存模块级 Map（`editorRef.ts`） | ADR 0004：store/文件只存纯文本，编辑器对象不可序列化 |
    94	| 运行时缓存/索引 | `~/Library/Application Support/dev.biaoyue.app/` | 可随时重建的生成态，不属于用户可改数据（所有权三分） |
    95	| 派生状态（recentFiles/滚动位置） | `state/state.json` | 用户行为产物，AI 不直接写（读取参与上下文可以） |
    96	
    97	---
    98	
    99	## 四、数据文件化的数据范围（全量盘点）
   100	
   101	| # | 数据 | 文件位置 | 状态 | AI 可改方式 |
   102	|---|---|---|---|---|
   103	| 1 | 应用设置（字号/主题/宽度/皮肤…） | `user/settings.json`（defaults 合并） | ✅ 已落地 | 受控写 `save_config`（校验+快照+热应用） |
   104	| 2 | 核心能力开关 | `user/settings.json` 能力段 | ✅ 已落地 | 受控写；默认全开 |
   105	| 3 | 斜杠 snippets | `app_config_dir()/snippets/*.md` | ✅ 已落地 | **直接写文件**，扫描即生效 |
   106	| 4 | 新建页 templates | `app_config_dir()/templates/*.md` | ✅ 已落地 | 直接写文件 |
   107	| 5 | 主题 token 覆盖 | `app_config_dir()/theme.toml` | ✅ 已落地 | 直接写文件（白名单容错） |
   108	| 6 | 配置快照 | `snapshots/settings-*.json`（10 份） | ✅ 已落地 | 恢复入口（AI 触发恢复走确认卡） |
   109	| 7 | 用户文档内容 | 用户自己的 md/html 文件 | ✅ 天然文件化 | 编辑器直接改；可视化编辑走 html-visual-editing（保存写回字节不变约束） |
   110	| 8 | 视图规格（阅读空间/网格/悬浮窗） | `user/settings.json` 的 `railViewSpec` / `previewSettings` / `aiViewSpec` | ✅ 已落地（非独立文件） | AI 视图改写经确认卡+快照（#179 已关闭；预设 6 条） |
   111	| 9 | 工作区布局树（pane 树） | `user/settings.json` 的 `paneLayout`（序列化 JSON 字符串） | ✅ 已落地（非独立文件） | 同上；快照可回滚 |
   112	| 10 | 扩展包（manifest.json + SKILL.md） | `app_config_dir()/extensions/<id>/` | ✅ 已落地 | AI 一句话生成新扩展（默认启用）+ 直接编辑 SKILL.md |
   113	| 11 | AI 提示词 / 技能 | 约定目录（对齐 pi skills） | 🗒 未立项 | 目标形态：markdown 文件直接改 |
   114	| 12 | 快速捕获收件箱 | 收件箱数据文件（按日） | ✅ 已落地 | 经捕获浮层/命令写入 |
   115	| 13 | API key | OS 钥匙串 | ✅ 已落地 | **永不文件化**（ADR 0005） |
   116	| 14 | 生成物（contentweave 学习页） | 离线单文件 HTML | 🚧 阶段 2 另立 change | 产物即文件 |
   117	
   118	---
   119	
   120	## 五、结论
   121	
   122	- **实现骨架已经就位**：三层目录（defaults / user / 运行时）+ 原子写 + 快照回滚 + 热应用轮询，是 Omarchy「扩展点 = 数据文件」在本仓库的落地底座；snippets/templates/theme.toml 三个扩展点已可用（「放一个文件就生效」）。
   123	- **缺口不在「文件没建」，而在「UI 结构没数据化」**：视图规格已随 `layout-portal` 落地，但落点是 `settings.json` 四字段而非 D11 设计的独立文件（这是实现选择，不是欠账）；扩展管理面已落地。真正的缺口是轮盘/工具条/图标/菜单仍是代码常量——现行判据与落点契约见 `docs/agents/data-surface.md`。
   124	- **AI 可改的三要素**：真相源唯一（文件）、写路径收敛且有热应用（改了就生效）、可逆兜底（确认卡+快照+撤销）——三者缺一，AI 可塑就会退化为「危险直改」。
   125	- **范围纪律**：密钥永不文件化；执行代码不进数据扩展点；没有消费者的数据文件不提前建目录。
14:> **勘误（2026-11-10）**：本文 11-04 版有三处与代码不符，已就地更正——①`user/views/{rail,grid,preview}.json` **从未实现**：`layout-portal` D11 未按独立文件落地，视图规格实际合并进 `user/settings.json` 的 `railViewSpec` / `previewSettings` / `aiViewSpec` / `paneLayout` 四字段（现状见 `docs/architecture/overview.md` §7；`grep -rn "user/views" src-tauri/src` 零命中）；②扩展管理面已落地（`src-tauri/src/extension_packages.rs`，[#184](https://github.com/jianxi-dev/clairis/issues/184) 已关闭）；③扩展点根目录是 `app_config_dir()`——macOS `~/Library/Application Support/dev.biaoyue.app/`、Linux `~/.config/dev.biaoyue.app/`，文中 `~/.config/clairis/` 为旧标识符写法。数据面现行判据已升级为 `docs/agents/data-surface.md`（六栏落点 + 机检），本文 §3.2 保留为历史推理。
63:| 视图规格文件化 | `layout-portal`（[#177](https://github.com/jianxi-dev/clairis/issues/177)、[#179](https://github.com/jianxi-dev/clairis/issues/179)，均已关闭） | 设计为 `rail.json`/`grid.json`/`preview.json`/布局树 + 快照 10 份（design.md D11） | ❌ **未按 D11 落地**：change 已归档（16/16 票），但独立文件从未实现；视图规格合并进 `user/settings.json` 四字段（overview §7） |
64:| 扩展管理面 | `layout-portal` [#184](https://github.com/jianxi-dev/clairis/issues/184)（已关闭） | 文件夹式扩展（manifest.json + SKILL.md）、拖入即启用、AI 生成、导出 | ✅ 已落地（`src-tauri/src/extension_packages.rs`） |
110:| 8 | 视图规格（阅读空间/网格/悬浮窗） | `user/settings.json` 的 `railViewSpec` / `previewSettings` / `aiViewSpec` | ✅ 已落地（非独立文件） | AI 视图改写经确认卡+快照（#179 已关闭；预设 6 条） |
123:- **缺口不在「文件没建」，而在「UI 结构没数据化」**：视图规格已随 `layout-portal` 落地，但落点是 `settings.json` 四字段而非 D11 设计的独立文件（这是实现选择，不是欠账）；扩展管理面已落地。真正的缺口是轮盘/工具条/图标/菜单仍是代码常量——现行判据与落点契约见 `docs/agents/data-surface.md`。

exec
/bin/zsh -lc 'rg -n "setRailViewSpec|setPreviewSettings|setAiViewSpec|captureViewSpec|railViewSpec|paneLayoutJson|setRailLayout|setRailDensity|setViewSpec|restorePaneLayout" src/stores/index.ts src/hooks/useConfig.ts src | head -n 250' in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src/hooks/useConfig.ts:90:  railViewSpec?: {
src/hooks/useConfig.ts:184:    paneLayout: useStore.getState().paneLayoutJson(),
src/hooks/useConfig.ts:188:    railViewSpec: useStore.getState().railViewSpec,
src/hooks/useConfig.ts:192:    aiViewSpec: useStore.getState().captureViewSpec(),
src/hooks/useConfig.ts:217:async function restorePaneLayout(
src/hooks/useConfig.ts:218:  paneLayoutJson: string | null | undefined,
src/hooks/useConfig.ts:222:  if (!paneLayoutJson) return;
src/hooks/useConfig.ts:224:  const parsed = parseSerializedLayout(paneLayoutJson);
src/hooks/useConfig.ts:265:  useStore.getState().restorePaneLayout(root, focusedId);
src/hooks/useConfig.ts:273:  raw: RustAppConfig["railViewSpec"],
src/hooks/useConfig.ts:491:  const railSpec = normalizeRailViewSpec(raw.railViewSpec);
src/hooks/useConfig.ts:493:    railViewSpec: railSpec,
src/hooks/useConfig.ts:499:        raw.railViewSpec?.cardHeight ??
src/hooks/useConfig.ts:520:    .setViewSpec(normalizeViewSpec(raw.aiViewSpec, baseViewSpec));
src/hooks/useConfig.ts:523:  void restorePaneLayout(raw.paneLayout);
src/stores/index.ts:281:  railViewSpec: RailViewSpec;
src/stores/index.ts:350:  restorePaneLayout: (root: PaneLayout, focusedId: string) => void;
src/stores/index.ts:353:  paneLayoutJson: () => string;
src/stores/index.ts:369:  setRailLayout: (layout: RailLayout) => void;
src/stores/index.ts:370:  setRailDensity: (density: RailDensity) => void;
src/stores/index.ts:402:  setPreviewSettings: (patch: Partial<PreviewSettings>) => void;
src/stores/index.ts:409:  setViewSpec: (spec: ViewSpec) => void;
src/stores/index.ts:413:  captureViewSpec: () => ViewSpec;
src/stores/index.ts:467:  railViewSpec: { ...DEFAULT_RAIL_VIEW_SPEC },
src/stores/index.ts:862:      // 同步回 viewSpec，避免之后配置重载（setViewSpec）把用户手选的排序悄悄改掉
src/stores/index.ts:868:      // 同步回 viewSpec，避免之后配置重载（setViewSpec）把用户手选的分组悄悄改掉
src/stores/index.ts:1137:  restorePaneLayout: (root, focusedId) => {
src/stores/index.ts:1172:  paneLayoutJson: () => {
src/stores/index.ts:1319:  setRailLayout: (layout) =>
src/stores/index.ts:1328:  setRailDensity: (density) =>
src/stores/index.ts:1353:    const railViewSpec: RailViewSpec =
src/stores/index.ts:1361:    set({ railViewSpec });
src/stores/index.ts:1441:  setPreviewSettings: (patch) =>
src/stores/index.ts:1456:  setViewSpec: (spec) => {
src/stores/index.ts:1473:    const next = applyViewSpecPatch(get().captureViewSpec(), patch);
src/stores/index.ts:1491:  captureViewSpec: () => {
src/hooks/useConfig.ts:90:  railViewSpec?: {
src/hooks/useConfig.ts:184:    paneLayout: useStore.getState().paneLayoutJson(),
src/hooks/useConfig.ts:188:    railViewSpec: useStore.getState().railViewSpec,
src/hooks/useConfig.ts:192:    aiViewSpec: useStore.getState().captureViewSpec(),
src/hooks/useConfig.ts:217:async function restorePaneLayout(
src/hooks/useConfig.ts:218:  paneLayoutJson: string | null | undefined,
src/hooks/useConfig.ts:222:  if (!paneLayoutJson) return;
src/hooks/useConfig.ts:224:  const parsed = parseSerializedLayout(paneLayoutJson);
src/hooks/useConfig.ts:265:  useStore.getState().restorePaneLayout(root, focusedId);
src/hooks/useConfig.ts:273:  raw: RustAppConfig["railViewSpec"],
src/hooks/useConfig.ts:491:  const railSpec = normalizeRailViewSpec(raw.railViewSpec);
src/hooks/useConfig.ts:493:    railViewSpec: railSpec,
src/hooks/useConfig.ts:499:        raw.railViewSpec?.cardHeight ??
src/hooks/useConfig.ts:520:    .setViewSpec(normalizeViewSpec(raw.aiViewSpec, baseViewSpec));
src/hooks/useConfig.ts:523:  void restorePaneLayout(raw.paneLayout);
src/hooks/useAiEntry.ts:333:      const preSpec = useStore.getState().captureViewSpec();
src/hooks/useAiEntry.ts:377:      const before = useStore.getState().captureViewSpec();
src/hooks/useAiEntry.ts:417:          useStore.getState().setViewSpec(undoPreSpec);
src/components/SettingsView.tsx:680:  const setRailLayout = useStore((s) => s.setRailLayout);
src/components/SettingsView.tsx:681:  const setRailDensity = useStore((s) => s.setRailDensity);
src/components/SettingsView.tsx:869:    useStore.getState().setPreviewSettings(patch);
src/components/SettingsView.tsx:1030:    setRailLayout(layout);
src/components/SettingsView.tsx:1035:    setRailDensity(density);
src/components/Rail/ReadingRail.tsx:818:  const setRailLayout = useStore((s) => s.setRailLayout);
src/components/Rail/ReadingRail.tsx:819:  const setRailDensity = useStore((s) => s.setRailDensity);
src/components/Rail/ReadingRail.tsx:1335:          onClick={() => setRailLayout(layout)}
src/components/Rail/ReadingRail.tsx:1392:                onClick={() => setRailLayout(layout)}
src/components/Rail/ReadingRail.tsx:1413:                onClick={() => setRailDensity(d)}
src/__tests__/paneTreeStore.test.ts:134:  it("setPaneRatio / restorePaneLayout / collapsePanes", () => {
src/__tests__/paneTreeStore.test.ts:150:    useStore.getState().restorePaneLayout(
src/__tests__/paneTreeStore.test.ts:181:  it("paneLayoutJson 用文件路径序列化，丢弃未保存页签", () => {
src/__tests__/paneTreeStore.test.ts:184:    const json = useStore.getState().paneLayoutJson();
src/__tests__/paneTreeStore.test.ts:261:    useStore.getState().restorePaneLayout(
src/__tests__/aiForms.test.ts:152:    useStore.getState().setRailDensity("compact");
src/__tests__/aiForms.test.ts:153:    useStore.getState().setPreviewSettings({ enabled: false });
src/__tests__/aiForms.test.ts:155:    // 现场值经 captureViewSpec 合并（viewSpec 存储字段仍是旧的 card/true）
src/__tests__/aiForms.test.ts:156:    const live = useStore.getState().captureViewSpec();
src/__tests__/aiForms.test.ts:168:    expect(useStore.getState().captureViewSpec()).toEqual(
src/__tests__/aiForms.test.ts:217:    const json = useStore.getState().paneLayoutJson();
src/__tests__/components/Rail/ReadingRail.test.tsx:140:      useStore.getState().setRailDensity("compact");
src/__tests__/components/Rail/ReadingRail.test.tsx:155:      useStore.getState().setRailLayout("tabs");
src/stores/index.ts:281:  railViewSpec: RailViewSpec;
src/stores/index.ts:350:  restorePaneLayout: (root: PaneLayout, focusedId: string) => void;
src/stores/index.ts:353:  paneLayoutJson: () => string;
src/stores/index.ts:369:  setRailLayout: (layout: RailLayout) => void;
src/stores/index.ts:370:  setRailDensity: (density: RailDensity) => void;
src/stores/index.ts:402:  setPreviewSettings: (patch: Partial<PreviewSettings>) => void;
src/stores/index.ts:409:  setViewSpec: (spec: ViewSpec) => void;
src/stores/index.ts:413:  captureViewSpec: () => ViewSpec;
src/stores/index.ts:467:  railViewSpec: { ...DEFAULT_RAIL_VIEW_SPEC },
src/stores/index.ts:862:      // 同步回 viewSpec，避免之后配置重载（setViewSpec）把用户手选的排序悄悄改掉
src/stores/index.ts:868:      // 同步回 viewSpec，避免之后配置重载（setViewSpec）把用户手选的分组悄悄改掉
src/stores/index.ts:1137:  restorePaneLayout: (root, focusedId) => {
src/stores/index.ts:1172:  paneLayoutJson: () => {
src/stores/index.ts:1319:  setRailLayout: (layout) =>
src/stores/index.ts:1328:  setRailDensity: (density) =>
src/stores/index.ts:1353:    const railViewSpec: RailViewSpec =
src/stores/index.ts:1361:    set({ railViewSpec });
src/stores/index.ts:1441:  setPreviewSettings: (patch) =>
src/stores/index.ts:1456:  setViewSpec: (spec) => {
src/stores/index.ts:1473:    const next = applyViewSpecPatch(get().captureViewSpec(), patch);
src/stores/index.ts:1491:  captureViewSpec: () => {

exec
/bin/zsh -lc "nl -ba src/stores/index.ts | sed -n '180,410p;430,480p;1140,1205p;1330,1515p'; nl -ba src/types/index.ts | sed -n '50,135p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
   180	
   181	function detectFileKind(path: string): FileKind {
   182	  const dot = path.lastIndexOf(".");
   183	  if (dot === -1) return "text";
   184	  const ext = path.slice(dot + 1).toLowerCase();
   185	  return TEXT_EXTENSIONS[ext] ?? MEDIA_EXTENSIONS[ext] ?? "text";
   186	}
   187	
   188	export function isMediaKind(kind: FileKind): boolean {
   189	  return (
   190	    kind === "image" || kind === "video" || kind === "audio" || kind === "pdf"
   191	  );
   192	}
   193	
   194	function extractFileName(path: string): string {
   195	  const parts = path.split("/");
   196	  return parts[parts.length - 1] || path;
   197	}
   198	
   199	/**
   200	 * 把 AI 视图规格里的分组维度翻译成网格的 gridGroup（layout-portal 10.1）。
   201	 * 主题分组优先；其余按规格声明（默认「时间」）。
   202	 */
   203	function gridGroupFromSpec(spec: ViewSpec): GridGroupMode {
   204	  if (spec.themeGroups) return "theme";
   205	  return spec.gridGrouping;
   206	}
   207	
   208	interface AppStore {
   209	  activeTabId: string | null;
   210	  tabs: Record<string, Tab>;
   211	  sidebarLeftVisible: boolean;
   212	  sidebarRightVisible: boolean;
   213	  readingMode: boolean;
   214	  immersiveChromeVisible: boolean;
   215	  immersivePeekPaneId: string | null;
   216	  /** 页签拖拽进行中：抑制沉浸热区 2s 收起，避免拖拽被浮层卸载打断。 */
   217	  tabDragActive: boolean;
   218	  scrollPositions: Record<string, ScrollPosition>;
   219	  /** 内嵌文件滚动定格（D10 / B5b）：键 = `文档路径\u0000内嵌路径`。 */
   220	  embedScrollPositions: Record<string, ScrollPosition>;
   221	  recentFiles: RecentFile[];
   222	  /** 当前场景：门户 / 工作区 / 网格 / 设置（Layout Portal §1） */
   223	  scene: Scene;
   224	  /** 网格按类型过滤（门户分类磁贴点击后带入） */
   225	  gridTypeFilter: FileTypeKind | null;
   226	  // ── 网格概览会话状态（change layout-portal / 10.1）──
   227	  /** 网格搜索词；与阅读空间搜索完全独立。 */
   228	  gridQuery: string;
   229	  /** 网格排序：最近 / 名称 / 类型。 */
   230	  gridSort: GridSort;
   231	  /** 网格分组：时间 / 类型 / 主题 / 不分组。 */
   232	  gridGroup: GridGroupMode;
   233	  /** 只显示收藏条目。 */
   234	  gridPinnedOnly: boolean;
   235	  /** 当前选中条目路径；null = 无选中。 */
   236	  gridSelectedPath: string | null;
   237	  /** 收藏条目路径（网格与阅读空间共享；会话级，不持久化）。 */
   238	  pinnedPaths: string[];
   239	  // Split panel — each panel holds its own tab refs
   240	  splitDirection: SplitDirection | null;
   241	  splitTabIds: string[];
   242	  splitActiveTabId: string | null;
   243	  splitEditorMode: EditorMode;
   244	  horizontalSplitRatio: number;
   245	  verticalSplitRatio: number;
   246	
   247	  // ── Pane 递归树（change layout-portal / 3.1）──
   248	  /** 工作区分栏树。根 leaf id 固定 `"main"`。 */
   249	  paneRoot: PaneLayout;
   250	  /** 当前聚焦的 leaf id（⌘⌥→ / ⌘⌥↓ 作用于此格）。 */
   251	  focusedPaneId: string;
   252	  /** 最近一次聚焦的普通栏（跳过 AI 停靠栏），供打开文件选宿主。 */
   253	  lastTabsPaneId: string;
   254	  /** 全屏格 id；null = 正常多格布局。 */
   255	  fullscreenPaneId: string | null;
   256	  /** 正在被拖拽的格 id；仅 UI 预览，不持久化。 */
   257	  dragPaneSourceId: string | null;
   258	  /** 正在被拖拽的文件路径；仅 UI 预览，不持久化。 */
   259	  draggingFilePath: string | null;
   260	
   261	  // ── 阅读空间竖排栏（change layout-portal / 6.1）──
   262	  /** 栏三态：折叠 / 悬停浮层 / 钉住。瞬态，不持久化。 */
   263	  railState: RailState;
   264	  /** 是否钉住（= railState === 'pinned' 的镜像）。 */
   265	  railPinned: boolean;
   266	  /** 栏内布局：段叠放 / 分段页签。 */
   267	  railLayout: RailLayout;
   268	  /** 栏内密度：紧凑 / 舒适 / 卡片。 */
   269	  railDensity: RailDensity;
   270	  /** 卡片档高度（88–160，默认 112）；只影响卡片密度。 */
   271	  railCardHeight: number;
   272	  /** 顶部搜索是否处于展开（聚焦）状态。 */
   273	  railSearchOpen: boolean;
   274	  /** 栏内搜索词；与网格搜索完全独立。 */
   275	  railQuery: string;
   276	  /** 当前段（标签布局下的活动签 / 堆叠布局下无强约束）。 */
   277	  railSection: RailSection;
   278	  /** 分类段的活动 chip。 */
   279	  railChip: RailChipKind;
   280	  /** 「设为默认」保存的视图规格，持久化到 Rust `rail_view_spec`。 */
   281	  railViewSpec: RailViewSpec;
   282	
   283	  reset: () => void;
   284	  openFile: (path: string, content: string) => void;
   285	  newTab: () => void;
   286	  newTabWith: (title: string, content: string) => void;
   287	  switchTab: (id: string) => void;
   288	  closeTab: (id: string) => void;
   289	  updateContent: (content: string) => void;
   290	  updateTabContent: (tabId: string, content: string) => void;
   291	  /** 用磁盘内容覆盖页签内容（刷新）：内容以磁盘为准，页签回到干净态。 */
   292	  refreshTabContent: (tabId: string, content: string) => void;
   293	  renameTab: (tabId: string, title: string) => void;
   294	  /** 文件在磁盘上被移动后，同步页签的路径与标题。 */
   295	  setTabPath: (tabId: string, path: string) => void;
   296	  setEditorMode: (mode: EditorMode) => void;
   297	  setReadingMode: (on: boolean) => void;
   298	  setImmersiveChromeVisible: (v: boolean) => void;
   299	  setImmersivePeekPaneId: (id: string | null) => void;
   300	  setTabDragActive: (v: boolean) => void;
   301	  updateScrollPos: (
   302	    tabId: string,
   303	    scrollPos: number,
   304	    contentHeight: number,
   305	  ) => void;
   306	  setScrollPositions: (positions: Record<string, ScrollPosition>) => void;
   307	  setEmbedScrollPos: (
   308	    key: string,
   309	    scrollPos: number,
   310	    contentHeight: number,
   311	  ) => void;
   312	  setEmbedScrollPositions: (positions: Record<string, ScrollPosition>) => void;
   313	  markClean: () => void;
   314	  toggleLeftSidebar: () => void;
   315	  toggleRightSidebar: () => void;
   316	  setSidebarLeftVisible: (v: boolean) => void;
   317	  setSidebarRightVisible: (v: boolean) => void;
   318	  addRecentFile: (path: string, title: string, excerpt?: string) => void;
   319	  mergeRecentFiles: (incoming: RecentFile[]) => void;
   320	  setScene: (scene: Scene) => void;
   321	  setGridTypeFilter: (kind: FileTypeKind | null) => void;
   322	  setGridQuery: (query: string) => void;
   323	  setGridSort: (sort: GridSort) => void;
   324	  setGridGroup: (group: GridGroupMode) => void;
   325	  setGridPinnedOnly: (only: boolean) => void;
   326	  setGridSelectedPath: (path: string | null) => void;
   327	  togglePinnedPath: (path: string) => void;
   328	  clearRecentFiles: () => void;
   329	  // Split actions
   330	  splitTab: (tabId: string, direction: SplitDirection) => void;
   331	  unsplit: () => void;
   332	  moveTabToSplit: (tabId: string) => void;
   333	  moveTabToMain: (tabId: string) => void;
   334	  setSplitEditorMode: (mode: EditorMode) => void;
   335	  setSplitActiveTab: (id: string) => void;
   336	  setSplitRatio: (direction: SplitDirection, ratio: number) => void;
   337	  setSplitRatios: (ratios: { horizontal?: number; vertical?: number }) => void;
   338	  // Pane 递归树 actions（layout-portal 3.1）
   339	  splitPane: (dir: PaneDir) => void;
   340	  /** 在 tabId 所在格的指定方向新建一格，并把该页签搬进去（页签右键分栏）。 */
   341	  splitPaneWithTab: (dir: PaneDir, tabId: string) => void;
   342	  closePane: (leafId: string) => void;
   343	  focusPane: (id: string) => void;
   344	  toggleFullscreenPane: () => void;
   345	  setPaneRatio: (branchId: string, ratio: number) => void;
   346	  setPaneEditorMode: (leafId: string, mode: EditorMode) => void;
   347	  reorderPaneTabs: (leafId: string, from: number, to: number) => void;
   348	  /** 把页签移到目标格；源格与目标格相同则只聚焦。不删空源格。 */
   349	  moveTabToPane: (tabId: string, targetLeafId: string) => void;
   350	  restorePaneLayout: (root: PaneLayout, focusedId: string) => void;
   351	  collapsePanes: () => void;
   352	  autoLayoutPanes: () => void;
   353	  paneLayoutJson: () => string;
   354	  // 拖拽换位 actions（layout-portal 5.1）
   355	  swapPanes: (a: string, b: string) => void;
   356	  movePane: (sourceId: string, targetId: string, side: PaneSide) => void;
   357	  movePaneToRoot: (sourceId: string, side: PaneSide) => void;
   358	  dropFileOnPane: (
   359	    path: string,
   360	    content: string,
   361	    targetLeafId: string,
   362	    side: PaneSide,
   363	  ) => void;
   364	  setDragPaneSource: (id: string | null) => void;
   365	  setDraggingFilePath: (path: string | null) => void;
   366	  // 阅读空间栏 actions（layout-portal 6.1）
   367	  setRailState: (state: RailState) => void;
   368	  toggleRailPin: () => void;
   369	  setRailLayout: (layout: RailLayout) => void;
   370	  setRailDensity: (density: RailDensity) => void;
   371	  setRailCardHeight: (height: number) => void;
   372	  openRailSearch: () => void;
   373	  closeRailSearch: () => void;
   374	  setRailQuery: (query: string) => void;
   375	  setRailSection: (section: RailSection) => void;
   376	  setRailChip: (chip: RailChipKind) => void;
   377	  saveRailViewSpec: () => void;
   378	
   379	  // ── 悬浮预览窗（change layout-portal / 8.1）──
   380	  /** 当前悬浮预览窗；null = 不显示。瞬态，不持久化（重开回默认锚定）。 */
   381	  preview: PreviewState | null;
   382	  /** 已钉住的悬浮窗；钉住后继续打开新窗不会替换这些实例。 */
   383	  pinnedPreviews: PreviewState[];
   384	  /** 双轨开关：阅读空间悬停 / 网格触发方式 / 总开关。持久化到 Rust `preview_settings`。 */
   385	  previewSettings: PreviewSettings;
   386	  openPreview: (payload: Omit<PreviewState, "pinned" | "id">) => void;
   387	  closePreview: (id?: string) => void;
   388	  movePreview: (
   389	    id: string,
   390	    x: number,
   391	    y: number,
   392	    flippedX: boolean,
   393	    flippedY: boolean,
   394	  ) => void;
   395	  resizePreviewTo: (
   396	    id: string,
   397	    rect: { x: number; y: number; w: number; h: number },
   398	    flippedX: boolean,
   399	    flippedY: boolean,
   400	  ) => void;
   401	  togglePreviewPin: (id?: string) => void;
   402	  setPreviewSettings: (patch: Partial<PreviewSettings>) => void;
   403	  togglePreviewEnabled: () => void;
   404	
   405	  // ── AI 视图规格（change layout-portal / 9.1）──
   406	  /** AI 可改写的整体视图规格；唯一真相，镜像到 rail/preview/editor 各域。 */
   407	  viewSpec: ViewSpec;
   408	  /** 整体写入（归一化 + 夹取）并镜像各域。 */
   409	  setViewSpec: (spec: ViewSpec) => void;
   410	  /** 在现有规格上叠加补丁并镜像各域。 */
   430	  sidebarRightVisible: false,
   431	  readingMode: false,
   432	  immersiveChromeVisible: false,
   433	  immersivePeekPaneId: null,
   434	  tabDragActive: false,
   435	  scrollPositions: {} as Record<string, ScrollPosition>,
   436	  embedScrollPositions: {} as Record<string, ScrollPosition>,
   437	  recentFiles: [] as RecentFile[],
   438	  scene: "portal" as Scene,
   439	  gridTypeFilter: null as FileTypeKind | null,
   440	  gridQuery: "",
   441	  gridSort: "recent" as GridSort,
   442	  gridGroup: "time" as GridGroupMode,
   443	  gridPinnedOnly: false,
   444	  gridSelectedPath: null as string | null,
   445	  pinnedPaths: [] as string[],
   446	  splitDirection: null as SplitDirection | null,
   447	  splitTabIds: [] as string[],
   448	  splitActiveTabId: null as string | null,
   449	  splitEditorMode: "preview" as EditorMode,
   450	  horizontalSplitRatio: 0.5,
   451	  verticalSplitRatio: 0.5,
   452	  paneRoot: createRootLeaf() as PaneLayout,
   453	  focusedPaneId: "main",
   454	  lastTabsPaneId: "main",
   455	  fullscreenPaneId: null as string | null,
   456	  dragPaneSourceId: null as string | null,
   457	  draggingFilePath: null as string | null,
   458	  railState: "collapsed" as RailState,
   459	  railPinned: false,
   460	  railLayout: DEFAULT_RAIL_VIEW_SPEC.layout,
   461	  railDensity: DEFAULT_RAIL_VIEW_SPEC.density,
   462	  railCardHeight: DEFAULT_RAIL_VIEW_SPEC.cardHeight ?? DENSITY_HEIGHT.card,
   463	  railSearchOpen: false,
   464	  railQuery: "",
   465	  railSection: "recent" as RailSection,
   466	  railChip: "all" as RailChipKind,
   467	  railViewSpec: { ...DEFAULT_RAIL_VIEW_SPEC },
   468	  preview: null as PreviewState | null,
   469	  pinnedPreviews: [] as PreviewState[],
   470	  previewSettings: { ...DEFAULT_PREVIEW_SETTINGS },
   471	  viewSpec: { ...DEFAULT_VIEW_SPEC },
   472	};
   473	
   474	export const useStore = create<AppStore>((set, get) => ({
   475	  ...initialState,
   476	
   477	  reset: () => set(initialState),
   478	  openFile: (path: string, content: string) => {
   479	    const state = get();
   480	
  1140	      paneRoot: root,
  1141	      focusedPaneId: focusedId,
  1142	      fullscreenPaneId: null,
  1143	      activeTabId: leaf?.activeTabId ?? null,
  1144	    });
  1145	  },
  1146	
  1147	  collapsePanes: () => {
  1148	    const state = get();
  1149	    const activeTab = state.activeTabId ? state.tabs[state.activeTabId] : null;
  1150	    const root: PaneLayout = {
  1151	      ...createRootLeaf(),
  1152	      tabs: Object.keys(state.tabs),
  1153	      activeTabId: state.activeTabId,
  1154	      editorMode: activeTab ? activeTab.editorMode : "preview",
  1155	    };
  1156	    set({ paneRoot: root, focusedPaneId: "main", fullscreenPaneId: null });
  1157	  },
  1158	
  1159	  autoLayoutPanes: () => {
  1160	    const state = get();
  1161	    if (listLeaves(state.paneRoot).length < 2) return;
  1162	    const isMedia = (leaf: PaneLeaf) => {
  1163	      const tab = leaf.activeTabId ? state.tabs[leaf.activeTabId] : null;
  1164	      return !!tab && isMediaKind(tab.fileKind);
  1165	    };
  1166	    set({
  1167	      paneRoot: buildAutoLayout({ root: state.paneRoot, isMedia }),
  1168	      fullscreenPaneId: null,
  1169	    });
  1170	  },
  1171	
  1172	  paneLayoutJson: () => {
  1173	    const { paneRoot, focusedPaneId, tabs } = get();
  1174	    const pathOf = (tabId: string | null) =>
  1175	      tabId && tabs[tabId]?.path ? tabs[tabId].path : null;
  1176	    return JSON.stringify(serializeLayout(paneRoot, focusedPaneId, pathOf));
  1177	  },
  1178	
  1179	  // ── 拖拽换位 actions（layout-portal 5.1）──
  1180	
  1181	  swapPanes: (a, b) => {
  1182	    const state = get();
  1183	    const paneRoot = swapLeaves(state.paneRoot, a, b);
  1184	    if (paneRoot !== state.paneRoot) set({ paneRoot });
  1185	  },
  1186	
  1187	  movePane: (sourceId, targetId, side) => {
  1188	    const state = get();
  1189	    const paneRoot = moveLeaf(state.paneRoot, sourceId, targetId, side);
  1190	    if (paneRoot === state.paneRoot) return;
  1191	    set({ paneRoot, focusedPaneId: sourceId, fullscreenPaneId: null });
  1192	  },
  1193	
  1194	  movePaneToRoot: (sourceId, side) => {
  1195	    const state = get();
  1196	    const paneRoot = moveLeafToRoot(state.paneRoot, sourceId, side);
  1197	    if (paneRoot === state.paneRoot) return;
  1198	    set({ paneRoot, focusedPaneId: sourceId, fullscreenPaneId: null });
  1199	  },
  1200	
  1201	  dropFileOnPane: (path, content, targetLeafId, side) => {
  1202	    const state = get();
  1203	    const found = findLeaf(state.paneRoot, targetLeafId);
  1204	    if (!found) return;
  1205	    const target =
  1330	      railDensity: density,
  1331	      viewSpec: normalizeViewSpec(
  1332	        { ...s.viewSpec, railDensity: density },
  1333	        s.viewSpec,
  1334	      ),
  1335	    })),
  1336	
  1337	  setRailCardHeight: (height) =>
  1338	    set({ railCardHeight: clampCardHeight(height) }),
  1339	
  1340	  openRailSearch: () => set({ railSearchOpen: true }),
  1341	
  1342	  closeRailSearch: () => set({ railSearchOpen: false, railQuery: "" }),
  1343	
  1344	  setRailQuery: (query) => set({ railQuery: query, railSearchOpen: true }),
  1345	
  1346	  setRailSection: (section) => set({ railSection: section }),
  1347	
  1348	  setRailChip: (chip) => set({ railChip: chip }),
  1349	
  1350	  saveRailViewSpec: () => {
  1351	    const { railLayout, railDensity, railCardHeight } = get();
  1352	    // 卡片高度只在卡片档有意义；紧凑/舒适档不写这个字段，保持 6.1 旧规格形状
  1353	    const railViewSpec: RailViewSpec =
  1354	      railDensity === "card"
  1355	        ? {
  1356	            layout: railLayout,
  1357	            density: railDensity,
  1358	            cardHeight: clampCardHeight(railCardHeight),
  1359	          }
  1360	        : { layout: railLayout, density: railDensity };
  1361	    set({ railViewSpec });
  1362	    // 动态导入避免 stores ↔ useConfig 的静态循环依赖（useConfig 依赖本模块）
  1363	    void import("../hooks/useConfig").then((m) => m.saveAppConfig());
  1364	  },
  1365	
  1366	  // ── 悬浮预览窗 actions（layout-portal 8.1）──
  1367	
  1368	  openPreview: (payload) =>
  1369	    set(() => ({
  1370	      // 新打开的窗口恒为未钉住；已钉住的实例留在 pinnedPreviews，不被替换。
  1371	      preview: { ...payload, id: nextPreviewId(), pinned: false },
  1372	    })),
  1373	
  1374	  closePreview: (id) =>
  1375	    set((s) => {
  1376	      const targetId = id ?? s.preview?.id;
  1377	      if (!targetId) return {};
  1378	      return {
  1379	        preview: s.preview?.id === targetId ? null : s.preview,
  1380	        pinnedPreviews: s.pinnedPreviews.filter((p) => p.id !== targetId),
  1381	      };
  1382	    }),
  1383	
  1384	  movePreview: (id, x, y, flippedX, flippedY) =>
  1385	    set((s) => ({
  1386	      preview:
  1387	        s.preview?.id === id
  1388	          ? { ...s.preview, x, y, flippedX, flippedY }
  1389	          : s.preview,
  1390	      pinnedPreviews: s.pinnedPreviews.map((p) =>
  1391	        p.id === id ? { ...p, x, y, flippedX, flippedY } : p,
  1392	      ),
  1393	    })),
  1394	
  1395	  resizePreviewTo: (id, rect, flippedX, flippedY) =>
  1396	    set((s) => {
  1397	      const patch = {
  1398	        x: rect.x,
  1399	        y: rect.y,
  1400	        w: rect.w,
  1401	        h: rect.h,
  1402	        flippedX,
  1403	        flippedY,
  1404	      };
  1405	      return {
  1406	        preview: s.preview?.id === id ? { ...s.preview, ...patch } : s.preview,
  1407	        pinnedPreviews: s.pinnedPreviews.map((p) =>
  1408	          p.id === id ? { ...p, ...patch } : p,
  1409	        ),
  1410	      };
  1411	    }),
  1412	
  1413	  togglePreviewPin: (id) =>
  1414	    set((s) => {
  1415	      const target = id
  1416	        ? s.preview?.id === id
  1417	          ? s.preview
  1418	          : s.pinnedPreviews.find((p) => p.id === id)
  1419	        : s.preview;
  1420	      if (!target) return {};
  1421	      if (target.pinned) {
  1422	        return {
  1423	          preview:
  1424	            s.preview?.id === target.id
  1425	              ? { ...s.preview, pinned: false }
  1426	              : s.preview,
  1427	          pinnedPreviews: s.pinnedPreviews.map((p) =>
  1428	            p.id === target.id ? { ...p, pinned: false } : p,
  1429	          ),
  1430	        };
  1431	      }
  1432	      const pinned = { ...target, pinned: true };
  1433	      return {
  1434	        preview: s.preview?.id === target.id ? pinned : s.preview,
  1435	        pinnedPreviews: s.pinnedPreviews.some((p) => p.id === target.id)
  1436	          ? s.pinnedPreviews.map((p) => (p.id === target.id ? pinned : p))
  1437	          : [...s.pinnedPreviews, pinned],
  1438	      };
  1439	    }),
  1440	
  1441	  setPreviewSettings: (patch) =>
  1442	    set((s) => ({ previewSettings: { ...s.previewSettings, ...patch } })),
  1443	
  1444	  togglePreviewEnabled: () =>
  1445	    set((s) => {
  1446	      const enabled = !s.previewSettings.enabled;
  1447	      return {
  1448	        previewSettings: { ...s.previewSettings, enabled },
  1449	        preview: enabled ? s.preview : null,
  1450	        pinnedPreviews: enabled ? s.pinnedPreviews : [],
  1451	      };
  1452	    }),
  1453	
  1454	  // ── AI 视图规格（layout-portal 9.1）──
  1455	
  1456	  setViewSpec: (spec) => {
  1457	    const next = normalizeViewSpec(spec);
  1458	    set((s) => ({
  1459	      viewSpec: next,
  1460	      gridGroup: gridGroupFromSpec(next),
  1461	      gridSort: next.gridSort,
  1462	      railLayout: next.railLayout,
  1463	      railDensity: next.railDensity,
  1464	      railCardHeight: next.railCardHeight,
  1465	      previewSettings: { ...s.previewSettings, enabled: next.previewEnabled },
  1466	      preview: next.previewEnabled ? s.preview : null,
  1467	      pinnedPreviews: next.previewEnabled ? s.pinnedPreviews : [],
  1468	    }));
  1469	    useEditorStore.getState().setConfig({ iconLabel: next.iconLabel });
  1470	  },
  1471	
  1472	  applyViewSpec: (patch) => {
  1473	    const next = applyViewSpecPatch(get().captureViewSpec(), patch);
  1474	    // 只有补丁真的碰了分组维度才镜像到 gridGroup，避免网格/列表切换覆盖用户所选分组
  1475	    const touchesGrouping = "themeGroups" in patch || "gridGrouping" in patch;
  1476	    const grouped = touchesGrouping ? gridGroupFromSpec(next) : null;
  1477	    set((s) => ({
  1478	      viewSpec: next,
  1479	      gridGroup: grouped ?? s.gridGroup,
  1480	      gridSort: next.gridSort,
  1481	      railLayout: next.railLayout,
  1482	      railDensity: next.railDensity,
  1483	      railCardHeight: next.railCardHeight,
  1484	      previewSettings: { ...s.previewSettings, enabled: next.previewEnabled },
  1485	      preview: next.previewEnabled ? s.preview : null,
  1486	      pinnedPreviews: next.previewEnabled ? s.pinnedPreviews : [],
  1487	    }));
  1488	    useEditorStore.getState().setConfig({ iconLabel: next.iconLabel });
  1489	  },
  1490	
  1491	  captureViewSpec: () => {
  1492	    const s = get();
  1493	    return normalizeViewSpec(
  1494	      {
  1495	        ...s.viewSpec,
  1496	        railLayout: s.railLayout,
  1497	        railDensity: s.railDensity,
  1498	        railCardHeight: s.railCardHeight,
  1499	        previewEnabled: s.previewSettings.enabled,
  1500	        gridSort: s.gridSort,
  1501	        iconLabel:
  1502	          useEditorStore.getState().config.iconLabel ?? s.viewSpec.iconLabel,
  1503	      },
  1504	      s.viewSpec,
  1505	    );
  1506	  },
  1507	
  1508	  dockAiPane: () => {
  1509	    const state = get();
  1510	    if (findLeaf(state.paneRoot, AI_PANE_ID)) return AI_PANE_ID;
  1511	    const aiLeaf: PaneLeaf = {
  1512	      type: "leaf",
  1513	      id: AI_PANE_ID,
  1514	      tabs: [],
  1515	      activeTabId: null,
    50	export type PropertyBarDefaultMode = "show" | "collapse" | "hide";
    51	
    52	/** 文档属性面板配置（doc-property-panel P-2）。 */
    53	export interface PropertyBarConfig {
    54	  displayStyle: PropertyBarDisplayStyle;
    55	  displayDefault: {
    56	    preview: PropertyBarDefaultMode;
    57	    edit: PropertyBarDefaultMode;
    58	  };
    59	  /** 新建文档的默认显隐（全局，不做模板级 / 文件级覆盖）。 */
    60	  newDocVisible: boolean;
    61	}
    62	
    63	export interface AppConfig {
    64	  fontSize: number;
    65	  headingColors: HeadingColors;
    66	  /** 标题逐级字体（H1–H6）；缺省回落 `--type-font-sans` */
    67	  headingFonts?: HeadingFonts;
    68	  /** 阅读区字号，与编辑器字号解耦 */
    69	  readerFontSize: number;
    70	  /** 阅读区正文行宽（px） */
    71	  readerWidth: number;
    72	  /** 新建文档首次保存的默认目录；空 = 沿用系统默认 */
    73	  defaultSavePath?: string | null;
    74	  /** 选区工具条形态：轮盘（默认）/ 胶囊 */
    75	  selectionToolbar?: "roulette" | "capsule";
    76	  /** 阅读皮肤：paper / modern … */
    77	  readerSkin: string;
    78	  ollamaEndpoint: string;
    79	  openaiEndpoint: string;
    80	  openaiModel: string;
    81	  translationProvider: TranslationProvider;
    82	  langPair: LangPair;
    83	  theme: Theme;
    84	  /** AI 改动前的确认密度：always 每次确认 / session-silent 本会话静默 / never 只靠撤销 */
    85	  aiConfirmDensity?: "always" | "session-silent" | "never";
    86	  sidebarLeftVisible: boolean;
    87	  sidebarRightVisible: boolean;
    88	  sidebarLeftWidth: number;
    89	  sidebarRightWidth: number;
    90	  horizontalSplitRatio: number;
    91	  verticalSplitRatio: number;
    92	  recentFiles: RecentFile[];
    93	  scrollPositions: Record<string, ScrollPosition>;
    94	  /**
    95	   * 内嵌文件滚动定格（D10 / B5b）：文档级 view-state，键 = `文档路径\u0000内嵌路径`。
    96	   * 与 `scrollPositions` 同类结构，持久化在 state 层；不含用户可配置项。
    97	   */
    98	  embedScrollPositions: Record<string, ScrollPosition>;
    99	  /** 核心能力开关：只存被关闭的项，缺省全开（spec X-3） */
   100	  capabilities?: Record<string, boolean>;
   101	  /** 图标标签级别（Layout Portal §10）：自动 / 始终文字 / 仅图标 */
   102	  iconLabel?: "auto" | "text" | "icon";
   103	  /** 轮盘根扇区集合与顺序；null/缺省 = 内置 8 项（ui-command-registry 2.1） */
   104	  rouletteSectors?: string[] | null;
   105	  /** 轮盘开关快捷键；null/缺省 = Mod+Shift+Space（ui-polish-batch15 2.1） */
   106	  rouletteHotkey?: string | null;
   107	  /** 轮盘默认形态：hub 圆心 / disk 整盘；null/缺省 = hub（ui-polish-batch15 2.1） */
   108	  rouletteForm?: "hub" | "disk" | null;
   109	  /** 轮盘圆心位置（px）；null/缺省 = 跟在选区旁（ui-polish-batch15 2.1） */
   110	  roulettePosition?: { x: number; y: number } | null;
   111	  /** 提示信息显示时长（秒，0.1–10，1 位小数）；null/缺省 = 3 秒（ui-polish-batch15 4.1） */
   112	  noticeDuration?: number | null;
   113	  /** 横向工具条动作集合与顺序；null/缺省 = 内置 12 项（ui-toolbar-slots 1.1） */
   114	  htmlToolbarItems?: string[] | null;
   115	  /** 工作区 pane 递归树（layout-portal 3.1）：序列化 JSON，跨重启恢复 */
   116	  paneLayout?: string | null;
   117	  /** 左边栏固定隐藏（C3 / D14）：隐藏后箭头热区收起、滑入不唤出；缺省 false */
   118	  railPinHidden?: boolean | null;
   119	  /** AI 视图改写规格（layout-portal 9.1）：持久化到 Rust `aiViewSpec` */
   120	  aiViewSpec?: ViewSpec | null;
   121	  /** 文档属性面板（doc-property-panel P-2） */
   122	  propertyBar?: PropertyBarConfig;
   123	}
   124	
   125	export type Theme = "system" | "light" | "dark" | "warm";
   126	
   127	export type CaptureStatus = "closed" | "normal" | "pinned" | "capsule";
   128	export type CapturePrefix = "" | "." | "-" | "!" | "?";
   129	
   130	export type EntryType = "problem" | "todo" | "idea" | "wonder" | "note";
   131	
   132	export interface InboxEntry {
   133	  id: string;
   134	  type?: EntryType;
   135	  prefix: CapturePrefix;

exec
/bin/zsh -lc 'rg -n "ROOT_SECTORS|SectorId|rouletteSectors|HTML_TOOLBAR_ITEMS|resolveToolbarOrder|PANE_MENU_ITEMS|EXPORT_MENU_ITEMS|AI_PANE_MENU_ITEMS|selectionToolbar" src | head -n 300' in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src/lib/paneHeaderMenu.ts:45:export const PANE_MENU_ITEMS: readonly PaneMenuItem[] = [
src/lib/paneHeaderMenu.ts:56:export const EXPORT_MENU_ITEMS: readonly ExportMenuItem[] = [
src/lib/paneHeaderMenu.ts:69:export const AI_PANE_MENU_ITEMS: readonly PaneMenuItem[] = [
src/__tests__/editor/roulette.test.ts:16:  ROOT_SECTORS,
src/__tests__/editor/roulette.test.ts:44:    expect(ROOT_SECTORS).toHaveLength(8);
src/__tests__/editor/roulette.test.ts:45:    expect(ROOT_SECTORS.map((s) => s.angle)).toEqual([
src/__tests__/editor/roulette.test.ts:48:    expect(ROOT_SECTORS[0].id).toBe("smart");
src/__tests__/editor/roulette.test.ts:49:    expect(ROOT_SECTORS[7].id).toBe("color");
src/__tests__/config/toolbar-slots.test.ts:14:  resolveToolbarOrder,
src/__tests__/config/toolbar-slots.test.ts:19:    expect(resolveToolbarOrder(null)).toEqual([...HTML_TOOLBAR_DEFAULT_ORDER]);
src/__tests__/config/toolbar-slots.test.ts:20:    expect(resolveToolbarOrder([])).toEqual([...HTML_TOOLBAR_DEFAULT_ORDER]);
src/__tests__/config/toolbar-slots.test.ts:25:    expect(resolveToolbarOrder(["format-italic", "nope", "ai-polish"])).toEqual(
src/__tests__/config/toolbar-slots.test.ts:32:      resolveToolbarOrder(["format-bold", "ai-polish", "format-bold"]),
src/__tests__/config/toolbar-slots.test.ts:37:    expect(resolveToolbarOrder(["a", "b"])).toEqual([
src/hooks/useConfig.ts:74:  rouletteSectors?: string[] | null;
src/hooks/useConfig.ts:177:    rouletteSectors: es.config.rouletteSectors ?? null,
src/hooks/useConfig.ts:420:    rouletteSectors: normalizeRouletteSectors(raw.rouletteSectors),
src/components/TabBar.tsx:27:import { EXPORT_MENU_ITEMS } from "../lib/paneHeaderMenu";
src/components/TabBar.tsx:764:                {EXPORT_MENU_ITEMS.map((sub) => (
src/types/index.ts:75:  selectionToolbar?: "roulette" | "capsule";
src/types/index.ts:104:  rouletteSectors?: string[] | null;
src/editors/orchestration/slots.ts:10:export const HTML_TOOLBAR_ITEMS: readonly ToolbarSlotItem[] = [
src/editors/orchestration/slots.ts:31:  HTML_TOOLBAR_ITEMS.map((item) => item.id);
src/editors/orchestration/slots.ts:35:export function resolveToolbarOrder(
src/__tests__/paneHeader.test.tsx:4:  EXPORT_MENU_ITEMS,
src/__tests__/paneHeader.test.tsx:5:  PANE_MENU_ITEMS,
src/__tests__/paneHeader.test.tsx:51:    expect(PANE_MENU_ITEMS.map((i) => i.label)).toEqual([
src/__tests__/paneHeader.test.tsx:62:    for (const item of PANE_MENU_ITEMS) {
src/__tests__/paneHeader.test.tsx:65:    const labels = PANE_MENU_ITEMS.map((i) => i.label);
src/__tests__/paneHeader.test.tsx:70:    expect(PANE_MENU_ITEMS.map((i) => i.icon)).not.toContain("expand");
src/__tests__/paneHeader.test.tsx:76:    expect(EXPORT_MENU_ITEMS.map((i) => i.label)).toEqual([
src/__tests__/paneHeader.test.tsx:87:    expect(EXPORT_MENU_ITEMS.map((i) => i.action)).not.toContain("print");
src/editors/orchestration/roulette-view.ts:20:  ROOT_SECTORS,
src/editors/orchestration/roulette-view.ts:30:  type SectorId,
src/editors/orchestration/roulette-view.ts:183:    sectors?: readonly SectorId[];
src/editors/orchestration/roulette-view.ts:190:  const visibleSectors = options.sectors ?? ROOT_SECTORS.map((s) => s.id);
src/editors/orchestration/roulette-view.ts:239:  let openSector: SectorId | null = null;
src/editors/orchestration/roulette-view.ts:252:  const sectorOf = (id: SectorId) => ROOT_SECTORS.find((s) => s.id === id)!;
src/editors/orchestration/roulette-view.ts:556:  const openSectorById = (id: SectorId) => {
src/editors/orchestration/roulette-view.ts:918:function sectorIcon(id: SectorId): IconName {
src/editors/orchestration/horizontal-toolbar.ts:21:import { HTML_TOOLBAR_ITEMS, resolveToolbarOrder } from "./slots";
src/editors/orchestration/horizontal-toolbar.ts:208:      const order = resolveToolbarOrder(
src/editors/orchestration/horizontal-toolbar.ts:213:        const item = HTML_TOOLBAR_ITEMS.find((entry) => entry.id === id);
src/editors/orchestration/floating-toolbar.ts:37:  ROOT_SECTORS,
src/editors/orchestration/floating-toolbar.ts:38:  type SectorId,
src/editors/orchestration/floating-toolbar.ts:691:      const mode = useEditorStore.getState().config.selectionToolbar;
src/editors/orchestration/floating-toolbar.ts:714:    const configuredSectors = (): SectorId[] | undefined => {
src/editors/orchestration/floating-toolbar.ts:715:      const configured = useEditorStore.getState().config.rouletteSectors;
src/editors/orchestration/floating-toolbar.ts:717:      const valid = configured.filter((id): id is SectorId =>
src/editors/orchestration/floating-toolbar.ts:718:        ROOT_SECTORS.some((sector) => sector.id === id),
src/editors/orchestration/floating-toolbar.ts:776:        if (useEditorStore.getState().config.selectionToolbar !== "capsule") {
src/editors/orchestration/roulette.ts:48:export type SectorId =
src/editors/orchestration/roulette.ts:59:  id: SectorId;
src/editors/orchestration/roulette.ts:65:export const ROOT_SECTORS: readonly RootSector[] = [
src/components/Content/PaneTreeView.tsx:29:  AI_PANE_MENU_ITEMS,
src/components/Content/PaneTreeView.tsx:30:  PANE_MENU_ITEMS,
src/components/Content/PaneTreeView.tsx:623:                {PANE_MENU_ITEMS.map((item) => (
src/components/Content/PaneTreeView.tsx:731:              {AI_PANE_MENU_ITEMS.map((item) => (
src/components/SettingsView.tsx:29:import { HTML_TOOLBAR_ITEMS } from "../editors/orchestration/slots";
src/components/SettingsView.tsx:616:  const selectionToolbar = useEditorStore(
src/components/SettingsView.tsx:617:    (s) => s.config.selectionToolbar ?? "roulette",
src/components/SettingsView.tsx:627:  const rouletteSectors = useEditorStore(
src/components/SettingsView.tsx:628:    (s) => s.config.rouletteSectors ?? null,
src/components/SettingsView.tsx:915:    setConfig({ selectionToolbar: mode });
src/components/SettingsView.tsx:966:    rouletteSectors ?? ROULETTE_SECTOR_META.map((m) => m.id);
src/components/SettingsView.tsx:968:    setConfig({ rouletteSectors: next.length > 0 ? next : null });
src/components/SettingsView.tsx:989:    setConfig({ rouletteSectors: null });
src/components/SettingsView.tsx:994:    htmlToolbarItems ?? HTML_TOOLBAR_ITEMS.map((item) => item.id);
src/components/SettingsView.tsx:1393:                      aria-pressed={selectionToolbar === option.value}
src/components/SettingsView.tsx:1396:                        selectionToolbar === option.value
src/components/SettingsView.tsx:1568:                    ...HTML_TOOLBAR_ITEMS.map((item) => item.id).filter(
src/components/SettingsView.tsx:1573:                      HTML_TOOLBAR_ITEMS.find((item) => item.id === id)

exec
/bin/zsh -lc 'rg -n "Config|config-changed|spawn_config_watcher|reloadAppConfig|saveAppConfig" src-tauri/src/lib.rs src/App.tsx src/hooks/useConfig.ts src/main.tsx src | head -n 200' in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src/hooks/useConfig.ts:10:  AppConfig,
src/hooks/useConfig.ts:12:  PropertyBarConfig,
src/hooks/useConfig.ts:16:import { normalizePropertyBar } from "../lib/propertyBarConfig";
src/hooks/useConfig.ts:18:  applyCapabilityConfig,
src/hooks/useConfig.ts:42:interface RustAppConfig {
src/hooks/useConfig.ts:142:export async function saveAppConfig(): Promise<void> {
src/hooks/useConfig.ts:146:  const config: RustAppConfig = {
src/hooks/useConfig.ts:197:    log.error("Config", "Failed to save config", e);
src/hooks/useConfig.ts:202:export function applyPropertyBarConfig(config: PropertyBarConfig): void {
src/hooks/useConfig.ts:213: * 只在首次配置加载时跑一次（reloadAppConfig 重入由 guard 拦掉）。
src/hooks/useConfig.ts:226:    log.warn("Config", "paneLayout 解析失败，退回默认单格");
src/hooks/useConfig.ts:260:      log.warn("Config", `布局恢复：文件打不开，跳过 ${path}`, e);
src/hooks/useConfig.ts:273:  raw: RustAppConfig["railViewSpec"],
src/hooks/useConfig.ts:314:      log.warn("Config", `忽略未知轮盘扇区: ${id}`);
src/hooks/useConfig.ts:344:      log.warn("Config", `忽略未知工具条动作: ${id}`);
src/hooks/useConfig.ts:381:function applyRustConfig(raw: RustAppConfig): void {
src/hooks/useConfig.ts:382:  const { config: propertyBarConfig, warnings } = normalizePropertyBar(
src/hooks/useConfig.ts:386:    log.warn("Config", warnings.join("；"));
src/hooks/useConfig.ts:388:  const config: Partial<AppConfig> = {
src/hooks/useConfig.ts:391:      ? (raw.headingColors as unknown as AppConfig["headingColors"])
src/hooks/useConfig.ts:402:      (raw.translationProvider as AppConfig["translationProvider"]) ?? "ollama",
src/hooks/useConfig.ts:409:      (raw.aiConfirmDensity as AppConfig["aiConfirmDensity"]) ??
src/hooks/useConfig.ts:411:    iconLabel: (raw.iconLabel as AppConfig["iconLabel"]) ?? "text",
src/hooks/useConfig.ts:435:    propertyBar: propertyBarConfig,
src/hooks/useConfig.ts:439:  es.setConfig(config);
src/hooks/useConfig.ts:441:  es.setConfigLoaded(true);
src/hooks/useConfig.ts:444:    .setVariant(propertyBarConfig.displayStyle === "dual" ? "B" : "A");
src/hooks/useConfig.ts:488:  applyCapabilityConfig(raw.capabilities);
src/hooks/useConfig.ts:527:export function reloadAppConfig(force = false): void {
src/hooks/useConfig.ts:530:  invoke<RustAppConfig>("load_config")
src/hooks/useConfig.ts:531:    .then(applyRustConfig)
src/hooks/useConfig.ts:532:    .catch((e) => log.error("Config", "Failed to reload config", e));
src/hooks/useConfig.ts:535:export function useConfig() {
src/hooks/useConfig.ts:547:    editorStore.setConfigLoading(true);
src/hooks/useConfig.ts:552:      es.setConfig({
src/hooks/useConfig.ts:574:      es.setConfigLoaded(true);
src/hooks/useConfig.ts:575:      es.setConfigLoading(false);
src/hooks/useConfig.ts:581:    invoke<RustAppConfig>("load_config")
src/hooks/useConfig.ts:582:      .then(applyRustConfig)
src/hooks/useConfig.ts:584:        log.error("Config", "Failed to load config", e);
src/hooks/useConfig.ts:587:        useEditorStore.getState().setConfigLoading(false);
src/hooks/useConfig.ts:596:    listen("config-changed", () => reloadAppConfig())
src/hooks/useConfig.ts:602:        log.error("Config", "Failed to subscribe config-changed", e);
src/hooks/useConfig.ts:610:  const saveConfig = useCallback(() => {
src/hooks/useConfig.ts:611:    void saveAppConfig();
src/hooks/useConfig.ts:617:      saveConfig();
src/hooks/useConfig.ts:619:  }, [saveConfig]);
src/hooks/useConfig.ts:623:      useEditorStore.getState().setConfig({ theme });
src/hooks/useConfig.ts:656:    loadConfig: () => {}, // No-op: config loads on mount
src/hooks/useConfig.ts:657:    saveConfig,
src/hooks/useConfig.ts:660:    setHeadingColors: (colors: AppConfig["headingColors"]) => {
src-tauri/src/lib.rs:194:            config::spawn_config_watcher(app.handle().clone());
src/App.tsx:39:import { saveAppConfig, useConfig } from "./hooks/useConfig";
src/App.tsx:93:  const { setTheme, scheduleSave } = useConfig();
src/App.tsx:365:      editorStore.setConfig({ readerFontSize: applied });
src/App.tsx:479:        es.setConfig({ railPinHidden: next });
src/App.tsx:481:        void saveAppConfig();
src/App.tsx:528:          es.setConfig({ railPinHidden: false });
src/App.tsx:529:          void saveAppConfig();
src/App.tsx:832:    es.setConfig({ horizontalSplitRatio, verticalSplitRatio });
src/App.tsx:843:  // Persist scroll positions after each update (A-9; switch/close flushes via saveAppConfig)
src/App.tsx:870:          await saveAppConfig();
src/App.tsx:942:            useEditorStore.getState().setConfig({ readerWidth: w });
src/lib/propertyBarConfig.ts:2:  PropertyBarConfig,
src/lib/propertyBarConfig.ts:7:export const DEFAULT_PROPERTY_BAR: PropertyBarConfig = {
src/lib/propertyBarConfig.ts:43:  config: PropertyBarConfig;
src/lib/propertyBarConfig.ts:83:  config: Pick<PropertyBarConfig, "displayDefault"> | undefined,
src/lib/mdpkg/vendor/mdpkg-web.js:9643:   *   Configuration (optional).
src/lib/mdpkg/vendor/mdpkg-web.js:10259:   *   Configuration (optional).
src/lib/mdpkg/vendor/mdpkg-web.js:10324:   *   Configuration (optional).
src/lib/mdpkg/vendor/mdpkg-web.js:10387:   *   Configuration (optional).
src/lib/mdpkg/vendor/mdpkg-web.js:10528:   * Configure the processor with info available to all plugins.
src/lib/mdpkg/vendor/mdpkg-web.js:10939:   * Configure the processor to use a plugin, a list of usable values, or a
src/lib/headingFonts.ts:96:    log.warn("Config", `标题字体非法值已回落默认: ${rejected.join(", ")}`);
src/__tests__/useAiEntry.test.ts:20:function rustConfig(theme: string) {
src/__tests__/useAiEntry.test.ts:56:    undoPreConfig: null,
src/__tests__/useAiEntry.test.ts:65:  useEditorStore.getState().setConfig({ aiConfirmDensity: "session-silent" });
src/__tests__/useAiEntry.test.ts:98:      if (cmd === "load_config") return Promise.resolve(rustConfig("light"));
src/__tests__/useAiEntry.test.ts:131:      if (cmd === "load_config") return Promise.resolve(rustConfig("system"));
src/__tests__/useAiEntry.test.ts:138:      return Promise.resolve(rustConfig("system"));
src/__tests__/useAiEntry.test.ts:148:    expect(state.undoPreConfig).toEqual(rustConfig("system"));
src/__tests__/useAiEntry.test.ts:153:    expect(saveCall?.[1]).toEqual({ config: rustConfig("system") });
src/__tests__/useAiEntry.test.ts:161:      if (cmd === "load_config") return Promise.resolve(rustConfig("light"));
src/stores/docPropertyPanel.ts:2:import type { EditorMode, PropertyBarConfig } from "../types";
src/stores/docPropertyPanel.ts:3:import { modeDefault } from "../lib/propertyBarConfig";
src/stores/docPropertyPanel.ts:10: * 显示样式与默认档由设置配置驱动（1.2），经 useConfig 桥接同步。
src/stores/docPropertyPanel.ts:29:    cfg?: Pick<PropertyBarConfig, "displayDefault">,
src/lib/capabilities.ts:93:export function applyCapabilityConfig(
src/hooks/useConfig.ts:10:  AppConfig,
src/hooks/useConfig.ts:12:  PropertyBarConfig,
src/hooks/useConfig.ts:16:import { normalizePropertyBar } from "../lib/propertyBarConfig";
src/hooks/useConfig.ts:18:  applyCapabilityConfig,
src/hooks/useConfig.ts:42:interface RustAppConfig {
src/hooks/useConfig.ts:142:export async function saveAppConfig(): Promise<void> {
src/hooks/useConfig.ts:146:  const config: RustAppConfig = {
src/hooks/useConfig.ts:197:    log.error("Config", "Failed to save config", e);
src/hooks/useConfig.ts:202:export function applyPropertyBarConfig(config: PropertyBarConfig): void {
src/hooks/useConfig.ts:213: * 只在首次配置加载时跑一次（reloadAppConfig 重入由 guard 拦掉）。
src/hooks/useConfig.ts:226:    log.warn("Config", "paneLayout 解析失败，退回默认单格");
src/hooks/useConfig.ts:260:      log.warn("Config", `布局恢复：文件打不开，跳过 ${path}`, e);
src/hooks/useConfig.ts:273:  raw: RustAppConfig["railViewSpec"],
src/hooks/useConfig.ts:314:      log.warn("Config", `忽略未知轮盘扇区: ${id}`);
src/hooks/useConfig.ts:344:      log.warn("Config", `忽略未知工具条动作: ${id}`);
src/hooks/useConfig.ts:381:function applyRustConfig(raw: RustAppConfig): void {
src/hooks/useConfig.ts:382:  const { config: propertyBarConfig, warnings } = normalizePropertyBar(
src/hooks/useConfig.ts:386:    log.warn("Config", warnings.join("；"));
src/hooks/useConfig.ts:388:  const config: Partial<AppConfig> = {
src/hooks/useConfig.ts:391:      ? (raw.headingColors as unknown as AppConfig["headingColors"])
src/hooks/useConfig.ts:402:      (raw.translationProvider as AppConfig["translationProvider"]) ?? "ollama",
src/hooks/useConfig.ts:409:      (raw.aiConfirmDensity as AppConfig["aiConfirmDensity"]) ??
src/hooks/useConfig.ts:411:    iconLabel: (raw.iconLabel as AppConfig["iconLabel"]) ?? "text",
src/hooks/useConfig.ts:435:    propertyBar: propertyBarConfig,
src/hooks/useConfig.ts:439:  es.setConfig(config);
src/hooks/useConfig.ts:441:  es.setConfigLoaded(true);
src/hooks/useConfig.ts:444:    .setVariant(propertyBarConfig.displayStyle === "dual" ? "B" : "A");
src/hooks/useConfig.ts:488:  applyCapabilityConfig(raw.capabilities);
src/hooks/useConfig.ts:527:export function reloadAppConfig(force = false): void {
src/hooks/useConfig.ts:530:  invoke<RustAppConfig>("load_config")
src/hooks/useConfig.ts:531:    .then(applyRustConfig)
src/hooks/useConfig.ts:532:    .catch((e) => log.error("Config", "Failed to reload config", e));
src/hooks/useConfig.ts:535:export function useConfig() {
src/hooks/useConfig.ts:547:    editorStore.setConfigLoading(true);
src/hooks/useConfig.ts:552:      es.setConfig({
src/hooks/useConfig.ts:574:      es.setConfigLoaded(true);
src/hooks/useConfig.ts:575:      es.setConfigLoading(false);
src/hooks/useConfig.ts:581:    invoke<RustAppConfig>("load_config")
src/hooks/useConfig.ts:582:      .then(applyRustConfig)
src/hooks/useConfig.ts:584:        log.error("Config", "Failed to load config", e);
src/hooks/useConfig.ts:587:        useEditorStore.getState().setConfigLoading(false);
src/hooks/useConfig.ts:596:    listen("config-changed", () => reloadAppConfig())
src/hooks/useConfig.ts:602:        log.error("Config", "Failed to subscribe config-changed", e);
src/hooks/useConfig.ts:610:  const saveConfig = useCallback(() => {
src/hooks/useConfig.ts:611:    void saveAppConfig();
src/hooks/useConfig.ts:617:      saveConfig();
src/hooks/useConfig.ts:619:  }, [saveConfig]);
src/hooks/useConfig.ts:623:      useEditorStore.getState().setConfig({ theme });
src/hooks/useConfig.ts:656:    loadConfig: () => {}, // No-op: config loads on mount
src/hooks/useConfig.ts:657:    saveConfig,
src/hooks/useConfig.ts:660:    setHeadingColors: (colors: AppConfig["headingColors"]) => {
src/stores/index.ts:1362:    // 动态导入避免 stores ↔ useConfig 的静态循环依赖（useConfig 依赖本模块）
src/stores/index.ts:1363:    void import("../hooks/useConfig").then((m) => m.saveAppConfig());
src/stores/index.ts:1469:    useEditorStore.getState().setConfig({ iconLabel: next.iconLabel });
src/stores/index.ts:1488:    useEditorStore.getState().setConfig({ iconLabel: next.iconLabel });
src/__tests__/types.test.ts:5:  AppConfig,
src/__tests__/types.test.ts:27:  it("AppConfig has required fields", () => {
src/__tests__/types.test.ts:28:    const config: AppConfig = {
src/types/index.ts:53:export interface PropertyBarConfig {
src/types/index.ts:63:export interface AppConfig {
src/types/index.ts:122:  propertyBar?: PropertyBarConfig;
src/__tests__/useConfig.hotApply.test.ts:23:import { useConfig } from "../hooks/useConfig";
src/__tests__/useConfig.hotApply.test.ts:25:function rustConfig(theme: "light" | "dark") {
src/__tests__/useConfig.hotApply.test.ts:50:describe("useConfig — config-changed hot apply (C2)", () => {
src/__tests__/useConfig.hotApply.test.ts:55:    useEditorStore.getState().setConfig({ theme: "light" });
src/__tests__/useConfig.hotApply.test.ts:58:  it("registers a config-changed listener and applies the reloaded config", async () => {
src/__tests__/useConfig.hotApply.test.ts:60:      if (cmd === "load_config") return Promise.resolve(rustConfig("light"));
src/__tests__/useConfig.hotApply.test.ts:64:    renderHook(() => useConfig());
src/__tests__/useConfig.hotApply.test.ts:73:      if (cmd === "load_config") return Promise.resolve(rustConfig("dark"));
src/__tests__/useConfig.hotApply.test.ts:87:      if (cmd === "load_config") return Promise.resolve(rustConfig("light"));
src/__tests__/useConfig.hotApply.test.ts:91:    renderHook(() => useConfig());
src/__tests__/useConfig.hotApply.test.ts:100:      if (cmd === "load_config") return Promise.resolve(rustConfig("dark"));
src/stores/editorStore.ts:6:  AppConfig,
src/stores/editorStore.ts:38:  // Config
src/stores/editorStore.ts:39:  config: Partial<AppConfig>;
src/stores/editorStore.ts:41:  // Config loading/saving
src/stores/editorStore.ts:55:  setConfig: (config: Partial<AppConfig>) => void;
src/stores/editorStore.ts:56:  setConfigLoaded: (loaded: boolean) => void;
src/stores/editorStore.ts:57:  setConfigLoading: (loading: boolean) => void;
src/stores/editorStore.ts:118:  setConfig: (config) =>
src/stores/editorStore.ts:123:  setConfigLoaded: (loaded) => set({ configLoaded: loaded }),
src/stores/editorStore.ts:125:  setConfigLoading: (loading) => set({ configLoading: loading }),
src/hooks/useAiEntry.ts:6:import { reloadAppConfig, saveAppConfig } from "./useConfig";
src/hooks/useAiEntry.ts:115:  undoPreConfig: unknown | null;
src/hooks/useAiEntry.ts:218:        const preConfig = await invoke("load_config");
src/hooks/useAiEntry.ts:230:          reloadAppConfig(true);
src/hooks/useAiEntry.ts:233:            undoPreConfig: preConfig,
src/hooks/useAiEntry.ts:281:    undoPreConfig: null,
src/hooks/useAiEntry.ts:354:        undoPreConfig: null,
src/hooks/useAiEntry.ts:371:      void saveAppConfig();
src/hooks/useAiEntry.ts:398:      const { undoTarget, undoPreConfig, undoPreSpec } = get();
src/hooks/useAiEntry.ts:399:      if (!undoTarget && !undoPreConfig && !undoPreSpec) return;
src/hooks/useAiEntry.ts:404:        undoPreConfig: null,
src/hooks/useAiEntry.ts:410:          reloadAppConfig(true);
src/hooks/useAiEntry.ts:411:        } else if (undoPreConfig) {
src/hooks/useAiEntry.ts:412:          await invoke("save_config", { config: undoPreConfig });
src/hooks/useAiEntry.ts:413:          reloadAppConfig(true);
src/hooks/useAiEntry.ts:416:          // 同步还原视图规格；reloadAppConfig 为 fire-and-forget，且缺字段不覆盖
src/hooks/useAiEntry.ts:418:          void saveAppConfig();
src/hooks/useAiEntry.ts:469:        reloadAppConfig(true);
src/hooks/useAiEntry.ts:497:      if (!get().undoTarget && !get().undoPreConfig && !get().undoPreSpec)
src/__tests__/setup.ts:4:// jsdom polyfills for browser APIs used by react-resizable-panels and useConfig
src/__tests__/config/roulette-sectors.test.ts:11:import { normalizeRouletteSectors } from "../../hooks/useConfig";
src/stores/captureOverlay.ts:185:  loadConfig: () => Promise<void>;
src/stores/captureOverlay.ts:226:      get().loadConfig();
src/stores/captureOverlay.ts:437:          captureConfig: {
src/stores/captureOverlay.ts:452:            captureConfig: { fontSize: clamped },
src/stores/captureOverlay.ts:555:    loadConfig: async () => {
src/stores/captureOverlay.ts:609:          captureConfig: { capsuleX: newX, capsuleY: newY },
src/stores/captureOverlay.ts:628:          captureConfig: { overlayWidth: clampedW, overlayHeight: clampedH },
src/stores/captureOverlay.ts:638:          captureConfig: { panelRatio: clamped },
src/__tests__/config/propertyBar.test.ts:11:import { normalizePropertyBar } from "../../lib/propertyBarConfig";

exec
/bin/zsh -lc "nl -ba src-tauri/src/ai_agent.rs | sed -n '150,290p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
   150	        Self {
   151	            role: "tool".into(),
   152	            content: Some(content.into()),
   153	            tool_calls: None,
   154	            tool_call_id: Some(tool_call_id.into()),
   155	        }
   156	    }
   157	}
   158	
   159	#[derive(Debug, Clone, Serialize, Deserialize)]
   160	pub struct ToolCall {
   161	    pub id: String,
   162	    pub name: String,
   163	    pub arguments: Value,
   164	}
   165	
   166	#[derive(Debug, Clone)]
   167	pub struct CompletionRequest {
   168	    pub messages: Vec<Message>,
   169	    pub tools: Vec<Value>,
   170	}
   171	
   172	#[derive(Debug, Clone, Default)]
   173	pub struct CompletionResponse {
   174	    pub content: Option<String>,
   175	    pub tool_calls: Vec<ToolCall>,
   176	}
   177	
   178	pub type CompletionFuture<'a> =
   179	    Pin<Box<dyn Future<Output = Result<CompletionResponse, AgentError>> + Send + 'a>>;
   180	
   181	pub trait Completer: Send + Sync {
   182	    fn complete<'a>(&'a self, req: CompletionRequest) -> CompletionFuture<'a>;
   183	}
   184	
   185	// ── 工具 ────────────────────────────────────────────────────
   186	
   187	pub fn tool_schemas() -> Vec<Value> {
   188	    vec![
   189	        json!({
   190	            "type": "function",
   191	            "function": {
   192	                "name": "read_config",
   193	                "description": "读取当前生效的应用配置（defaults + user + state 合并后的结果）。",
   194	                "parameters": { "type": "object", "properties": {}, "additionalProperties": false }
   195	            }
   196	        }),
   197	        json!({
   198	            "type": "function",
   199	            "function": {
   200	                "name": "patch_config",
   201	                "description": "把 JSON 合并补丁写入 user 层配置。写入前会校验并生成快照，非法值不会落盘。",
   202	                "parameters": {
   203	                    "type": "object",
   204	                    "properties": {
   205	                        "patch": {
   206	                            "type": "object",
   207	                            "description": "要合并进 user 层的配置补丁，键名用 camelCase，例如 {\"theme\":\"dark\"}"
   208	                        }
   209	                    },
   210	                    "required": ["patch"],
   211	                    "additionalProperties": false
   212	                }
   213	            }
   214	        }),
   215	        json!({
   216	            "type": "function",
   217	            "function": {
   218	                "name": "list_snapshots",
   219	                "description": "列出配置快照文件名，按时间升序（最旧在前）。",
   220	                "parameters": { "type": "object", "properties": {}, "additionalProperties": false }
   221	            }
   222	        }),
   223	    ]
   224	}
   225	
   226	fn tool_ok(value: Value) -> String {
   227	    json!({ "ok": true, "result": value }).to_string()
   228	}
   229	
   230	fn tool_err(err: &AgentError) -> String {
   231	    json!({ "ok": false, "error": err }).to_string()
   232	}
   233	
   234	/// 执行一个工具调用。任何失败都转成结构化 JSON 字符串（`{ok:false,error}`），
   235	/// 由循环回灌给模型；只有 `AgentError` 之外的意外才向上冒泡。
   236	pub fn dispatch_tool(base: &Path, name: &str, args: &Value) -> Result<String, AgentError> {
   237	    match name {
   238	        "read_config" => match load_config_at(base) {
   239	            Ok(config) => {
   240	                let value = serde_json::to_value(&config).map_err(|e| AgentError::Io {
   241	                    context: "read_config".into(),
   242	                    message: e.to_string(),
   243	                })?;
   244	                Ok(tool_ok(value))
   245	            }
   246	            Err(e) => Ok(tool_err(&AgentError::from_app(name, e))),
   247	        },
   248	        "patch_config" => {
   249	            let Some(patch) = args.get("patch") else {
   250	                return Ok(tool_err(&AgentError::validation(
   251	                    "patch",
   252	                    "缺少 patch 参数",
   253	                )));
   254	            };
   255	            match apply_patch_at(base, patch) {
   256	                Ok(config) => {
   257	                    let value = serde_json::to_value(&config).map_err(|e| AgentError::Io {
   258	                        context: "patch_config".into(),
   259	                        message: e.to_string(),
   260	                    })?;
   261	                    Ok(tool_ok(value))
   262	                }
   263	                Err(e) => Ok(tool_err(&AgentError::from_app(name, e))),
   264	            }
   265	        }
   266	        "list_snapshots" => match list_snapshots(base) {
   267	            Ok(names) => Ok(tool_ok(json!(names))),
   268	            Err(e) => Ok(tool_err(&AgentError::from_app(name, e))),
   269	        },
   270	        other => Ok(tool_err(&AgentError::tool(
   271	            other,
   272	            format!("未知工具 {other}"),
   273	        ))),
   274	    }
   275	}
   276	
   277	// ── 循环 ────────────────────────────────────────────────────
   278	
   279	#[derive(Debug, Clone, Serialize, Deserialize)]
   280	pub struct AgentReply {
   281	    pub text: String,
   282	    pub turns: usize,
   283	    pub tool_calls: Vec<String>,
   284	}
   285	
   286	pub async fn run_loop(
   287	    completer: &dyn Completer,
   288	    base: &Path,
   289	    messages: Vec<Message>,
   290	) -> Result<AgentReply, AgentError> {

exec
/bin/zsh -lc "nl -ba src/hooks/useConfig.ts | sed -n '590,670p'; nl -ba src/App.tsx | sed -n '830,880p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
   590	
   591	  // Hot-apply config written by the app, the AI, or an external editor (C2).
   592	  useEffect(() => {
   593	    if (!isTauriEnv()) return;
   594	    let unlisten: (() => void) | undefined;
   595	    let cancelled = false;
   596	    listen("config-changed", () => reloadAppConfig())
   597	      .then((fn) => {
   598	        if (cancelled) fn();
   599	        else unlisten = fn;
   600	      })
   601	      .catch((e) => {
   602	        log.error("Config", "Failed to subscribe config-changed", e);
   603	      });
   604	    return () => {
   605	      cancelled = true;
   606	      unlisten?.();
   607	    };
   608	  }, []);
   609	
   610	  const saveConfig = useCallback(() => {
   611	    void saveAppConfig();
   612	  }, []);
   613	
   614	  const scheduleSave = useCallback(() => {
   615	    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
   616	    saveTimerRef.current = setTimeout(() => {
   617	      saveConfig();
   618	    }, DEBOUNCE_MS);
   619	  }, [saveConfig]);
   620	
   621	  const setTheme = useCallback(
   622	    (theme: Theme) => {
   623	      useEditorStore.getState().setConfig({ theme });
   624	      applyTheme(theme);
   625	      scheduleSave();
   626	    },
   627	    [scheduleSave],
   628	  );
   629	
   630	  const setFontSize = useCallback(
   631	    (size: number) => {
   632	      useEditorStore.getState().setFontSize(size);
   633	      document.documentElement.style.setProperty(
   634	        "--editor-font-size",
   635	        `${size}px`,
   636	      );
   637	      scheduleSave();
   638	    },
   639	    [scheduleSave],
   640	  );
   641	
   642	  // Listen for system theme changes when theme is "system"
   643	  useEffect(() => {
   644	    const mq = window.matchMedia("(prefers-color-scheme: dark)");
   645	    const handler = () => {
   646	      const theme = useEditorStore.getState().config.theme;
   647	      if (theme === "system") {
   648	        applyTheme("system");
   649	      }
   650	    };
   651	    mq.addEventListener("change", handler);
   652	    return () => mq.removeEventListener("change", handler);
   653	  }, []);
   654	
   655	  return {
   656	    loadConfig: () => {}, // No-op: config loads on mount
   657	    saveConfig,
   658	    scheduleSave,
   659	    setFontSize,
   660	    setHeadingColors: (colors: AppConfig["headingColors"]) => {
   661	      useEditorStore.getState().setHeadingColors(colors);
   662	      scheduleSave();
   663	    },
   664	    setTheme,
   665	    configLoaded,
   666	    configLoading,
   667	  };
   668	}
   830	  useEffect(() => {
   831	    const es = useEditorStore.getState();
   832	    es.setConfig({ horizontalSplitRatio, verticalSplitRatio });
   833	    scheduleSave();
   834	  }, [horizontalSplitRatio, verticalSplitRatio, scheduleSave]);
   835	
   836	  // Persist pane layout whenever the tree or focus changes (debounced)
   837	  const paneRoot = useStore((s) => s.paneRoot);
   838	  const focusedPaneId = useStore((s) => s.focusedPaneId);
   839	  useEffect(() => {
   840	    scheduleSave();
   841	  }, [paneRoot, focusedPaneId, scheduleSave]);
   842	
   843	  // Persist scroll positions after each update (A-9; switch/close flushes via saveAppConfig)
   844	  const scrollPositions = useStore((s) => s.scrollPositions);
   845	  const embedScrollPositions = useStore((s) => s.embedScrollPositions);
   846	  useEffect(() => {
   847	    scheduleSave();
   848	  }, [scrollPositions, embedScrollPositions, scheduleSave]);
   849	
   850	  // ── Window close: capture scroll positions and flush config before close (A-9) ──
   851	
   852	  useEffect(() => {
   853	    if (!isTauri) return;
   854	    let unlisten: (() => void) | null = null;
   855	    (async () => {
   856	      try {
   857	        const { getCurrentWindow } = await import("@tauri-apps/api/window");
   858	        const win = getCurrentWindow();
   859	        unlisten = await win.onCloseRequested(async (event) => {
   860	          event.preventDefault();
   861	          const store = useStore.getState();
   862	          const capture = (panelId: string, tabId: string | null) => {
   863	            if (!tabId) return;
   864	            const el = getPanelScrollEl(panelId);
   865	            if (!el) return;
   866	            store.updateScrollPos(tabId, el.scrollTop, el.scrollHeight);
   867	          };
   868	          capture("main", store.activeTabId);
   869	          capture("split", store.splitActiveTabId);
   870	          await saveAppConfig();
   871	          await win.destroy();
   872	        });
   873	      } catch (e) {
   874	        log.warn("App", "Window close listener unavailable", e);
   875	      }
   876	    })();
   877	    return () => {
   878	      unlisten?.();
   879	    };
   880	  }, []);

exec
/bin/zsh -lc "rg -n \"fn tool_schemas|fn dispatch_tool|apply_patch_at|read_user|state_path|state_value|snapshot_user\" src-tauri/src/ai_agent.rs; sed -n '1,165p' src-tauri/src/ai_agent.rs" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
8:use crate::config::{apply_patch_at, list_snapshots, load_config_at};
187:pub fn tool_schemas() -> Vec<Value> {
236:pub fn dispatch_tool(base: &Path, name: &str, args: &Value) -> Result<String, AgentError> {
255:            match apply_patch_at(base, patch) {
535:    fn read_user(base: &Path) -> String {
611:        let before = read_user(base);
626:        assert_eq!(read_user(base), before, "非法补丁不应落盘");
658:        assert!(read_user(base).contains("\"dark\""), "{}", read_user(base));
703:    fn tool_schemas_cover_three_tools() {
use std::future::Future;
use std::path::Path;
use std::pin::Pin;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::config::{apply_patch_at, list_snapshots, load_config_at};
use crate::errors::AppError;

pub const MAX_TURNS: usize = 8;
pub const MAX_REPEATED_TOOL_ERRORS: usize = 3;

// ── 错误 ────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum AgentError {
    TurnLimit { turns: usize },
    Provider { status: u16, body: String },
    Tool { name: String, message: String },
    Validation { field: String, message: String },
    Io { context: String, message: String },
}

impl AgentError {
    pub fn validation(field: impl Into<String>, message: impl Into<String>) -> Self {
        AgentError::Validation {
            field: field.into(),
            message: message.into(),
        }
    }

    pub fn tool(name: impl Into<String>, message: impl Into<String>) -> Self {
        AgentError::Tool {
            name: name.into(),
            message: message.into(),
        }
    }

    fn from_app(name: &str, err: AppError) -> Self {
        match err {
            AppError::Validation { context, message } => AgentError::Validation {
                field: context,
                message,
            },
            AppError::Io { context, source } => AgentError::Io {
                context,
                message: source.to_string(),
            },
            AppError::Serialization { context, source } => AgentError::Io {
                context,
                message: source.to_string(),
            },
            other => AgentError::Tool {
                name: name.into(),
                message: other.to_string(),
            },
        }
    }
}

impl std::fmt::Display for AgentError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AgentError::TurnLimit { turns } => write!(f, "超过 {turns} 轮工具调用上限"),
            AgentError::Provider { status, body } => {
                write!(f, "provider 返回 {status}: {body}")
            }
            AgentError::Tool { name, message } => write!(f, "工具 {name} 失败: {message}"),
            AgentError::Validation { field, message } => {
                write!(f, "校验失败 ({field}): {message}")
            }
            AgentError::Io { context, message } => write!(f, "IO 错误 ({context}): {message}"),
        }
    }
}

impl std::error::Error for AgentError {}

impl From<AppError> for AgentError {
    fn from(err: AppError) -> Self {
        match err {
            AppError::Validation { context, message } => AgentError::Validation {
                field: context,
                message,
            },
            AppError::Io { context, source } => AgentError::Io {
                context,
                message: source.to_string(),
            },
            AppError::Serialization { context, source } => AgentError::Io {
                context,
                message: source.to_string(),
            },
            other => AgentError::Tool {
                name: "config".into(),
                message: other.to_string(),
            },
        }
    }
}

// ── 消息与补全 ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
}

impl Message {
    pub fn user(content: impl Into<String>) -> Self {
        Self {
            role: "user".into(),
            content: Some(content.into()),
            tool_calls: None,
            tool_call_id: None,
        }
    }

    pub fn system(content: impl Into<String>) -> Self {
        Self {
            role: "system".into(),
            content: Some(content.into()),
            tool_calls: None,
            tool_call_id: None,
        }
    }

    pub fn assistant(content: Option<String>, tool_calls: Vec<ToolCall>) -> Self {
        Self {
            role: "assistant".into(),
            content,
            tool_calls: if tool_calls.is_empty() {
                None
            } else {
                Some(tool_calls)
            },
            tool_call_id: None,
        }
    }

    pub fn tool_result(tool_call_id: impl Into<String>, content: impl Into<String>) -> Self {
        Self {
            role: "tool".into(),
            content: Some(content.into()),
            tool_calls: None,
            tool_call_id: Some(tool_call_id.into()),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub arguments: Value,
}


exec
/bin/zsh -lc 'rg -n "apply_patch_at|patch_config|state|recentFiles|scrollPositions|embedScrollPositions" src-tauri/src/config.rs src-tauri/src/ai_agent.rs src/__tests__ e2e | head -n 300' in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src-tauri/src/ai_agent.rs:8:use crate::config::{apply_patch_at, list_snapshots, load_config_at};
src-tauri/src/ai_agent.rs:193:                "description": "读取当前生效的应用配置（defaults + user + state 合并后的结果）。",
src-tauri/src/ai_agent.rs:200:                "name": "patch_config",
src-tauri/src/ai_agent.rs:248:        "patch_config" => {
src-tauri/src/ai_agent.rs:255:            match apply_patch_at(base, patch) {
src-tauri/src/ai_agent.rs:258:                        context: "patch_config".into(),
src-tauri/src/ai_agent.rs:616:                "patch_config",
src-tauri/src/ai_agent.rs:647:                "patch_config",
src-tauri/src/ai_agent.rs:708:        assert_eq!(names, vec!["read_config", "patch_config", "list_snapshots"]);
src-tauri/src/config.rs:39:    /// 内嵌文件滚动定格（D10 / B5b）：文档级 view-state，键 = `文档路径\u0000内嵌路径`。
src-tauri/src/config.rs:269:const STATE_FILE: &str = "state.json";
src-tauri/src/config.rs:282:fn state_path(base: &Path) -> PathBuf {
src-tauri/src/config.rs:283:    base.join("state").join(STATE_FILE)
src-tauri/src/config.rs:400:        map.remove("recentFiles");
src-tauri/src/config.rs:401:        map.remove("scrollPositions");
src-tauri/src/config.rs:402:        map.remove("embedScrollPositions");
src-tauri/src/config.rs:407:fn state_value(config: &AppConfig) -> Result<Value, AppError> {
src-tauri/src/config.rs:409:        .map_err(|e| json_err("recentFiles", e))?;
src-tauri/src/config.rs:412:            .map_err(|e| json_err("scrollPositions", e))?;
src-tauri/src/config.rs:415:            .map_err(|e| json_err("embedScrollPositions", e))?;
src-tauri/src/config.rs:417:        "recentFiles": recent_files,
src-tauri/src/config.rs:418:        "scrollPositions": scroll_positions,
src-tauri/src/config.rs:419:        "embedScrollPositions": embed_scroll_positions,
src-tauri/src/config.rs:426:    state: Option<Value>,
src-tauri/src/config.rs:429:    if let (Value::Object(map), Some(Value::Object(state))) = (&mut merged, state) {
src-tauri/src/config.rs:430:        for key in ["recentFiles", "scrollPositions", "embedScrollPositions"] {
src-tauri/src/config.rs:431:            if let Some(value) = state.get(key) {
src-tauri/src/config.rs:439:/// 旧 `app_config.json` 拆成 user + state。旧文件保留不动，靠 user 层是否
src-tauri/src/config.rs:453:    let state = serde_json::to_vec_pretty(&state_value(&config)?)
src-tauri/src/config.rs:454:        .map_err(|e| json_err("legacy state", e))?;
src-tauri/src/config.rs:456:    atomic_write(&state_path(base), &state)?;
src-tauri/src/config.rs:457:    info!(from = %legacy.display(), "旧配置已拆分为 user/state 两层");
src-tauri/src/config.rs:842:    let state = read_json_or_quarantine(&state_path(base));
src-tauri/src/config.rs:843:    effective_config(defaults, user, state)
src-tauri/src/config.rs:852:    let state =
src-tauri/src/config.rs:853:        serde_json::to_vec_pretty(&state_value(config)?).map_err(|e| json_err("state", e))?;
src-tauri/src/config.rs:855:    atomic_write(&state_path(base), &state)?;
src-tauri/src/config.rs:863:/// 快照当前 user → 原子写 user + state。任一步失败都不落盘；返回新的有效配置。
src-tauri/src/config.rs:864:pub fn apply_patch_at(base: &Path, patch: &Value) -> Result<AppConfig, AppError> {
src-tauri/src/config.rs:882:    let state =
src-tauri/src/config.rs:883:        serde_json::to_vec_pretty(&state_value(&config)?).map_err(|e| json_err("state", e))?;
src-tauri/src/config.rs:885:    atomic_write(&state_path(base), &state)?;
src-tauri/src/config.rs:912:| user | `user/settings.json` | 用户设置，`patch_config` 写这里 |
src-tauri/src/config.rs:913:| state | `state/state.json` | 派生状态（recentFiles / scrollPositions / embedScrollPositions），不归 patch 管 |
src-tauri/src/config.rs:919:- `patch_config`：`{"patch": {...}}`，深合并进 user 层，写入前校验并生成快照；非法值不落盘。
src-tauri/src/config.rs:942:- 不要手改 `state/state.json`；它由应用维护。
src-tauri/src/config.rs:1097:    fn save_keeps_derived_state_out_of_user_file() {
src-tauri/src/config.rs:1112:            !user.contains("recentFiles"),
src-tauri/src/config.rs:1113:            "user 层不应含 recentFiles: {user}"
src-tauri/src/config.rs:1116:            !user.contains("scrollPositions"),
src-tauri/src/config.rs:1117:            "user 层不应含 scrollPositions: {user}"
src-tauri/src/config.rs:1119:        let state = std::fs::read_to_string(state_path(base)).unwrap();
src-tauri/src/config.rs:1120:        assert!(state.contains("recentFiles"));
src-tauri/src/config.rs:1231:    fn restore_snapshots_current_state_first() {
src-tauri/src/config.rs:1282:            r#"{"theme":"dark","fontSize":19.0,"recentFiles":[{"path":"/tmp/a.md","title":"a.md","openedAt":"2026-01-01T00:00:00Z"}],"scrollPositions":{}}"#,
src-tauri/src/config.rs:1292:        assert!(!user.contains("recentFiles"));
src-tauri/src/config.rs:1293:        assert!(state_path(base).exists());
src-tauri/src/config.rs:1324:    fn state_layer_supplies_recent_files() {
src-tauri/src/config.rs:1325:        let dir = temp_base("state");
src-tauri/src/config.rs:1328:        std::fs::create_dir_all(state_path(base).parent().unwrap()).unwrap();
src-tauri/src/config.rs:1330:            state_path(base),
src-tauri/src/config.rs:1331:            r#"{"recentFiles":[{"path":"/tmp/b.md","title":"b.md","openedAt":"2026-01-02T00:00:00Z"}],"scrollPositions":{}}"#,
src-tauri/src/config.rs:1367:            !user.contains("embedScrollPositions"),
src-tauri/src/config.rs:1368:            "user 层不应含 embedScrollPositions: {user}"
src-tauri/src/config.rs:1370:        let state = std::fs::read_to_string(state_path(base)).unwrap();
src-tauri/src/config.rs:1371:        assert!(state.contains("embedScrollPositions"));
src/__tests__/railView.test.ts:64:  const state = (c: RailState, e: RailEvent) => nextRailState(c, e);
src/__tests__/railView.test.ts:67:    expect(state("collapsed", { type: "hover-enter" })).toBe("hover");
src/__tests__/railView.test.ts:71:    expect(state("hover", { type: "hover-leave" })).toBe("collapsed");
src/__tests__/railView.test.ts:75:    expect(state("hover", { type: "toggle-pin" })).toBe("pinned");
src/__tests__/railView.test.ts:76:    expect(state("pinned", { type: "hover-leave" })).toBe("pinned");
src/__tests__/railView.test.ts:77:    expect(state("pinned", { type: "hover-enter" })).toBe("pinned");
src/__tests__/railView.test.ts:81:    expect(state("collapsed", { type: "toggle-pin" })).toBe("pinned");
src/__tests__/railView.test.ts:82:    expect(state("pinned", { type: "toggle-pin" })).toBe("collapsed");
src/__tests__/railView.test.ts:86:    expect(state("pinned", { type: "toggle-key" })).toBe("collapsed");
src/__tests__/railView.test.ts:87:    expect(state("collapsed", { type: "toggle-key" })).toBe("pinned");
src/__tests__/railView.test.ts:88:    expect(state("hover", { type: "toggle-key" })).toBe("pinned");
src/__tests__/railView.test.ts:93:      expect(state(c, { type: "collapse" })).toBe("collapsed");
src/__tests__/useAiEntry.test.ts:41:    recentFiles: [],
src/__tests__/useAiEntry.test.ts:42:    scrollPositions: {},
src/__tests__/useAiEntry.test.ts:103:          tool_calls: ["patch_config"],
src/__tests__/useAiEntry.test.ts:115:    const state = useAiEntryStore.getState();
src/__tests__/useAiEntry.test.ts:116:    expect(state.undoVisible).toBe(true);
src/__tests__/useAiEntry.test.ts:117:    const last = state.messages.at(-1);
src/__tests__/useAiEntry.test.ts:136:          tool_calls: ["patch_config"],
src/__tests__/useAiEntry.test.ts:146:    const state = useAiEntryStore.getState();
src/__tests__/useAiEntry.test.ts:147:    expect(state.undoTarget).toBeNull();
src/__tests__/useAiEntry.test.ts:148:    expect(state.undoPreConfig).toEqual(rustConfig("system"));
e2e/tab-info-popover.spec.ts:146:  await shot(page, "no-path-state");
src/__tests__/editor/blockModel.test.ts:8:import { EditorState } from "@codemirror/state";
src/__tests__/editor/blockModel.test.ts:22:    const state = makeState("");
src/__tests__/editor/blockModel.test.ts:23:    expect(getBlocks(state)).toEqual([]);
src/__tests__/editor/blockModel.test.ts:27:    const state = makeState("hello world");
src/__tests__/editor/blockModel.test.ts:28:    const blocks = getBlocks(state);
src/__tests__/editor/blockModel.test.ts:36:    const state = makeState("![图片](photo.png)");
src/__tests__/editor/blockModel.test.ts:37:    expect(getBlocks(state).map((b) => b.type)).toEqual(["image"]);
src/__tests__/editor/blockModel.test.ts:51:    const state = makeState("看图 ![图片](photo.png) 结束");
src/__tests__/editor/blockModel.test.ts:52:    expect(getBlocks(state).map((b) => b.type)).toEqual(["paragraph"]);
src/__tests__/editor/blockModel.test.ts:56:    const state = makeState("> [!NOTE] 标题\n> 正文");
src/__tests__/editor/blockModel.test.ts:57:    expect(getBlocks(state).map((b) => b.type)).toEqual(["callout"]);
src/__tests__/editor/blockModel.test.ts:68:    const state = makeState("# Title\n## Subtitle");
src/__tests__/editor/blockModel.test.ts:69:    const blocks = getBlocks(state);
src/__tests__/editor/blockModel.test.ts:83:    const state = makeState("> quoted text");
src/__tests__/editor/blockModel.test.ts:84:    const blocks = getBlocks(state);
src/__tests__/editor/blockModel.test.ts:92:    const state = makeState("- item 1\n- item 2");
src/__tests__/editor/blockModel.test.ts:93:    const blocks = getBlocks(state);
src/__tests__/editor/blockModel.test.ts:99:    const state = makeState(
src/__tests__/editor/blockModel.test.ts:102:    const blocks = getBlocks(state);
src/__tests__/editor/blockModel.test.ts:111:    const state = makeState("H1\n===\n\nH2\n---");
src/__tests__/editor/blockModel.test.ts:112:    const blocks = getBlocks(state);
src/__tests__/editor/blockModel.test.ts:122:    const state = makeState(sections.join("\n\n"));
src/__tests__/editor/blockModel.test.ts:123:    expect(getBlocks(state)).toHaveLength(200);
src/__tests__/editor/blockModel.test.ts:127:    const state = makeState("- [ ] todo\n- [x] done\n- [X] also done");
src/__tests__/editor/blockModel.test.ts:128:    const blocks = getBlocks(state);
src/__tests__/editor/blockModel.test.ts:135:    const state = makeState("1. [ ] todo\n2. [x] done");
src/__tests__/editor/blockModel.test.ts:136:    const blocks = getBlocks(state);
src/__tests__/editor/blockModel.test.ts:143:    const state = makeState("- item 1\n- item 2");
src/__tests__/editor/blockModel.test.ts:144:    const blocks = getBlocks(state);
src/__tests__/editor/blockModel.test.ts:151:    const state = makeState("- [ ] todo\n- plain item");
src/__tests__/editor/blockModel.test.ts:152:    const blocks = getBlocks(state);
src/__tests__/editor/blockModel.test.ts:159:    const state = makeState("- [ ] solo task");
src/__tests__/editor/blockModel.test.ts:160:    const blocks = getBlocks(state);
src/__tests__/editor/blockModel.test.ts:167:    const state = makeState("- [x] done\n- [X] also done");
src/__tests__/editor/blockModel.test.ts:168:    const blocks = getBlocks(state);
src/__tests__/editor/blockModel.test.ts:175:    const state = makeState("```\ncode here\n```");
src/__tests__/editor/blockModel.test.ts:176:    const blocks = getBlocks(state);
src/__tests__/editor/blockModel.test.ts:183:    const state = makeState("| A | B |\n| --- | --- |\n| 1 | 2 |");
src/__tests__/editor/blockModel.test.ts:184:    const blocks = getBlocks(state);
src/__tests__/editor/blockModel.test.ts:192:    const state = makeState("---");
src/__tests__/editor/blockModel.test.ts:193:    const blocks = getBlocks(state);
src/__tests__/editor/blockModel.test.ts:201:    const state = makeState("![alt](path/to.png)");
src/__tests__/editor/blockModel.test.ts:202:    const blocks = getBlocks(state);
src/__tests__/editor/blockModel.test.ts:208:    const state = makeState("# Head\n\nparagraph\n\n> quote");
src/__tests__/editor/blockModel.test.ts:209:    const blocks = getBlocks(state);
src/__tests__/editor/blockModel.test.ts:217:    const state = makeState(
src/__tests__/editor/blockModel.test.ts:220:    const blocks = getBlocks(state);
src/__tests__/editor/blockModel.test.ts:236:    const state = makeState("# Title\n\nparagraph");
src/__tests__/editor/blockModel.test.ts:237:    const blocks = getBlocks(state);
src/__tests__/editor/blockModel.test.ts:244:    const state = makeState("hello");
src/__tests__/editor/blockModel.test.ts:245:    const blocks = getBlocks(state);
src/__tests__/editor/blockModel.test.ts:251:    const state = makeState("hello");
src/__tests__/editor/blockModel.test.ts:252:    const blocks = getBlocks(state);
src/__tests__/editor/blockModel.test.ts:258:    const state = makeState("# Head\n\npara");
src/__tests__/editor/blockModel.test.ts:259:    const blocks = getBlocks(state);
src/__tests__/editor/blockModel.test.ts:267:    const state = makeState("hello");
src/__tests__/editor/blockModel.test.ts:268:    const blocks = getBlocks(state);
src/__tests__/editor/blockModel.test.ts:278:    const state = makeState("> 第一段\n>\n> ## 小标题\n");
src/__tests__/editor/blockModel.test.ts:279:    const [quote] = getBlocks(state);
src/__tests__/editor/blockModel.test.ts:281:    const nested = getNestedBlocks(state, quote);
src/__tests__/editor/blockModel.test.ts:288:    const state = makeState(
src/__tests__/editor/blockModel.test.ts:291:    const [list] = getBlocks(state);
src/__tests__/editor/blockModel.test.ts:293:    const nested = getNestedBlocks(state, list);
src/__tests__/editor/blockModel.test.ts:298:    const state = makeState("> [!NOTE] 标题\n> 卡片正文\n");
src/__tests__/editor/blockModel.test.ts:299:    const [callout] = getBlocks(state);
src/__tests__/editor/blockModel.test.ts:301:    expect(getNestedBlocks(state, callout)).toEqual([]);
src/__tests__/editor/blockModel.test.ts:305:    const state = makeState("普通段落");
src/__tests__/editor/blockModel.test.ts:306:    const [para] = getBlocks(state);
src/__tests__/editor/blockModel.test.ts:307:    expect(getNestedBlocks(state, para)).toEqual([]);
e2e/preview-code-syntax-856.spec.ts:18:function shot(page: Page, name: string, state: string): Promise<string> {
e2e/preview-code-syntax-856.spec.ts:24:        "record-state",
e2e/preview-code-syntax-856.spec.ts:26:        "--state",
e2e/preview-code-syntax-856.spec.ts:27:        state,
e2e/block-color.spec.ts:37:    const state = store.getState();
e2e/block-color.spec.ts:38:    return state.tabs[state.activeTabId]?.content ?? "";
src/__tests__/editor/decorations-blocks.test.ts:11:import type { Range } from "@codemirror/state";
src/__tests__/editor/decorations-blocks.test.ts:12:import { EditorState } from "@codemirror/state";
src/__tests__/editor/decorations-blocks.test.ts:96:      state: EditorState.create({
src/__tests__/editor/decorations-blocks.test.ts:142:      expect(view.state.doc.toString()).toBe("---\n\nParagraph");
src/__tests__/editor/decorations-blocks.test.ts:185:      expect(view.state.doc.toString()).toBe("[文字](https://example.com)");
src/__tests__/editor/decorations-blocks.test.ts:196:      placeCursor(view.state.doc.length);
src/__tests__/editor/decorations-blocks.test.ts:209:      placeCursor(view.state.doc.length);
src/__tests__/editor/decorations-blocks.test.ts:218:      placeCursor(view.state.doc.length);
src/__tests__/editor/decorations-blocks.test.ts:235:      placeCursor(view.state.doc.length);
src/__tests__/editor/decorations-blocks.test.ts:241:      expect(view.state.doc.toString()).toBe("![dot](./photo.png)");
src/__tests__/editor/decorations-blocks.test.ts:248:      placeCursor(view.state.doc.length);
src/__tests__/editor/decorations-blocks.test.ts:264:      placeCursor(view.state.doc.length);
src/__tests__/editor/decorations-blocks.test.ts:273:      placeCursor(view.state.doc.length);
src/__tests__/editor/decorations-blocks.test.ts:282:      placeCursor(view.state.doc.length);
src/__tests__/editor/decorations-blocks.test.ts:307:      placeCursor(view.state.doc.length);
src/__tests__/editor/decorations-blocks.test.ts:337:      placeCursor(view.state.doc.length);
src/__tests__/editor/decorations-blocks.test.ts:356:      placeCursor(view.state.doc.length);
src/__tests__/editor/decorations-blocks.test.ts:372:      placeCursor(view.state.doc.length);
src/__tests__/editor/decorations-blocks.test.ts:379:      view.dispatch({ changes: { from: 0, to: view.state.doc.length } });
src/__tests__/editor/decorations-blocks.test.ts:469:      expect(view.state.doc.toString()).toBe(original);
src/__tests__/editor/decorations-blocks.test.ts:556:      placeCursor(view.state.doc.length);
src/__tests__/editor/decorations-blocks.test.ts:564:      expect(view.state.doc.toString()).toBe("![a](b.png){width=700}");
src/__tests__/editor/decorations-blocks.test.ts:569:      placeCursor(view.state.doc.length);
src/__tests__/editor/decorations-blocks.test.ts:577:      expect(view.state.doc.toString()).toBe(
src/__tests__/editor/decorations-blocks.test.ts:586:      placeCursor(view.state.doc.length);
src/__tests__/editor/decorations-blocks.test.ts:597:      placeCursor(view.state.doc.length);
src/__tests__/editor/decorations-blocks.test.ts:608:      placeCursor(view.state.doc.length);
src/__tests__/editor/decorations-blocks.test.ts:612:      expect(view.state.doc.toString()).toBe(md);
src/__tests__/editor/decorations-blocks.test.ts:691:      placeCursor(view.state.doc.length);
src/__tests__/editor/decorations-blocks.test.ts:701:      expect(() => placeCursor(view.state.doc.length)).not.toThrow();
src/__tests__/editor/decorations-blocks.test.ts:708:      expect(() => placeCursor(view.state.doc.length)).not.toThrow();
src/__tests__/editor/decorations-blocks.test.ts:713:      expect(view.state.doc.toString()).toBe(DOC);
src/__tests__/editor/decorations-blocks.test.ts:769:      it(`${c.name}: renders in the inactive state`, () => {
src/__tests__/editor/decorations-blocks.test.ts:773:        expect(view.state.doc.toString()).toBe(c.doc);
src/__tests__/editor/decorations-blocks.test.ts:776:      it(`${c.name}: drops the rendered form in the active state`, () => {
src/__tests__/editor/decorations-blocks.test.ts:784:        expect(view.state.doc.toString()).toBe(c.doc);
src/__tests__/editor/decorations-blocks.test.ts:809:      expect(view.state.doc.toString()).toBe(original);
e2e/rail-cards.spec.ts:153:    "data-rail-state",
e2e/rail-cards.spec.ts:544:  const state = await page.evaluate(() => {
e2e/rail-cards.spec.ts:564:  expect(state.layout).toBe("stacked");
e2e/rail-cards.spec.ts:565:  expect(state.density).toBe("card");
e2e/rail-cards.spec.ts:566:  expect(state.cardHeight).toBe(160);
e2e/rail-cards.spec.ts:567:  expect(state.spec).toEqual({
src/__tests__/editor/callout-insert.test.ts:11:import { EditorState } from "@codemirror/state";
src/__tests__/editor/callout-insert.test.ts:71:      state: EditorState.create({
src/__tests__/editor/callout-insert.test.ts:76:    view.dispatch({ selection: { anchor: view.state.doc.length } });
src/__tests__/editor/callout-insert.test.ts:117:    expect(view.state.doc.toString()).toBe(DOC);
src/__tests__/editor/callout-insert.test.ts:131:    expect(view.state.doc.toString()).toBe(
src/__tests__/editor/callout-insert.test.ts:157:    expect(view.state.doc.toString()).toBe(
src/__tests__/editor/testEditor.ts:1:import { EditorState } from "@codemirror/state";
src/__tests__/editor/testEditor.ts:33:    state: EditorState.create({ doc, extensions }),
e2e/block-menu.spec.ts:28:    const state = store.getState();
e2e/block-menu.spec.ts:29:    return state.tabs[state.activeTabId]?.content ?? "";
src/__tests__/editor/callout-title-edit.test.ts:10:import { EditorState } from "@codemirror/state";
src/__tests__/editor/callout-title-edit.test.ts:61:      state: EditorState.create({
src/__tests__/editor/callout-title-edit.test.ts:67:    view.dispatch({ selection: { anchor: view.state.doc.length } });
src/__tests__/editor/callout-title-edit.test.ts:115:    expect(view.state.doc.toString()).toBe("> [!NOTE] 自定义标题\n> 内容");
src/__tests__/editor/callout-title-edit.test.ts:135:    expect(view.state.doc.toString()).toBe("> [!TIP]\n> 内容");
src/__tests__/editor/callout-title-edit.test.ts:155:    expect(view.state.doc.toString()).toBe("> [!NOTE] 旧标题\n> 内容");
e2e/rail-pin-hidden-857.spec.ts:98:    "data-rail-state",
e2e/rail-pin-hidden-857.spec.ts:146:    "data-rail-state",
e2e/rail-pin-hidden-857.spec.ts:157:    "data-rail-state",
src/__tests__/editor/slash.test.ts:68:    const head = view.state.selection.main.head;
src/__tests__/editor/slash.test.ts:77:    const head = view.state.selection.main.head;
src/__tests__/editor/slash.test.ts:95:    expect(view.state.doc.toString()).toBe("/");
src/__tests__/editor/slash.test.ts:131:    expect(view.state.doc.toString()).toBe("/");
src/__tests__/editor/slash.test.ts:145:    expect(view.state.doc.toString()).toBe("## ");
src/__tests__/editor/slash.test.ts:148:    expect(view.state.selection.main.head).toBe(view.state.doc.length);
src/__tests__/editor/slash.test.ts:162:    const doc = view.state.doc.toString();
src/__tests__/editor/slash.test.ts:184:    expect(view.state.doc.toString()).toBe("/");
src/__tests__/editor/slash.test.ts:195:    const doc = view.state.doc.toString();
src/__tests__/editor/slash.test.ts:234:    const doc = view.state.doc.toString();
src/__tests__/editor/slash.test.ts:311:    expect(view.state.doc.toString()).toBe("/");
src/__tests__/editor/slash.test.ts:359:    expect(view.state.doc.toString()).toBe("::: {.col-3}\n\n:::");
src/__tests__/editor/slash.test.ts:376:    expect(view.state.doc.toString()).toBe("::: {.col-2}\n\n:::");
src/__tests__/editor/slash.test.ts:432:    expect(view.state.doc.toString()).toBe("");
src/__tests__/editor/slash.test.ts:447:    expect(view.state.doc.toString()).toBe("");
src/__tests__/editor/slash.test.ts:465:    expect(view.state.doc.toString()).toBe("before ");
src/__tests__/editor/slash.test.ts:474:    expect(view.state.doc.toString()).toBe("");
src/__tests__/editor/slash.test.ts:475:    expect(view.state.selection.main.head).toBe(0);
src/__tests__/editor/slash.test.ts:481:    expect(view.state.doc.toString()).toBe("plain text");
src/__tests__/editor/slash.test.ts:489:    expect(view.state.doc.toString()).toBe("");
src/__tests__/editor/slash.test.ts:498:    expect(view.state.doc.toString()).toBe("/");
src/__tests__/editor/slash.test.ts:511:    expect(view.state.doc.toString()).toBe("before ");
src/__tests__/editor/slash.test.ts:522:    expect(view.state.doc.toString()).toBe("first\n");
src/__tests__/editor/slash.test.ts:530:    expect(view.state.doc.toString()).toBe("/bXY");
src/__tests__/editor/slash.test.ts:534:    expect(view.state.doc.toString()).toBe("XY");
src/__tests__/editor/slash.test.ts:542:    expect(view.state.doc.toString()).toBe("/");
src/__tests__/editor/slash.test.ts:551:    expect(view.state.doc.toString()).toBe("/b");
src/__tests__/editor/slash.test.ts:581:    expect(view.state.doc.toString()).toBe("/");
src/__tests__/editor/slash.test.ts:587:  it("shows an empty state for a filter with no match, and a newline closes the menu", () => {
src/__tests__/editor/slash.test.ts:603:    expect(view.state.doc.toString()).toBe("/bt");
src/__tests__/editor/slash.test.ts:610:    expect(view.state.doc.toString()).toBe("## ");
src/__tests__/editor/slash.test.ts:611:    expect(view.state.selection.main.head).toBe(view.state.doc.length);
src/__tests__/editor/slash.test.ts:625:    expect(view.state.doc.toString()).toBe("> [!NOTE]\n> ");
src/__tests__/editor/slash.test.ts:643:    expect(view.state.doc.toString()).toBe("/");
src/__tests__/editor/slash.test.ts:687:    expect(view.state.doc.toString()).toBe("hello");
src/__tests__/editor/slash.test.ts:695:    expect(view.state.doc.toString()).toBe("/");
src/__tests__/editor/slash.test.ts:865:    expect(view.state.doc.toString()).toBe("／");
src/__tests__/editor/slash.test.ts:872:    expect(view.state.doc.toString()).toBe("、");
src/__tests__/editor/slash.test.ts:878:    expect(view.state.doc.toString()).toBe("你好,世界");
src/__tests__/editor/slash.test.ts:903:    const head = view.state.selection.main.head;
src/__tests__/editor/slash.test.ts:970:    expect(view.state.doc.toString()).toBe("![pic.png](assets/pic.png)");
src/__tests__/editor/slash.test.ts:971:    expect(view.state.selection.main.head).toBe(view.state.doc.length);
src/__tests__/editor/slash.test.ts:987:    expect(view.state.doc.toString()).toBe("![clip.mp4](assets/clip.mp4)");
src/__tests__/editor/slash.test.ts:995:    expect(view.state.doc.toString()).toBe("");
src/__tests__/editor/slash.test.ts:1002:    expect(view.state.doc.toString()).toBe("/img");
src/__tests__/editor/slash.test.ts:1008:    expect(view.state.doc.toString()).toBe("");
src/__tests__/editor/slash.test.ts:1023:    expect(view.state.doc.toString()).toBe("");
src/__tests__/editor/slash.test.ts:1033:    expect(view.state.doc.toString()).toBe("/v");
src/__tests__/editor/slash.test.ts:1041:    expect(view.state.doc.toString()).toBe("");
src/__tests__/editor/slash.test.ts:1060:    expect(view.state.doc.toString()).toBe("ab![pic.png](assets/pic.png)cdef");
src/__tests__/editor/slash.test.ts:1075:    expect(view.state.doc.toString()).toBe("abc\n![pic.png](assets/pic.png)");
src/__tests__/editor/slash.test.ts:1116:    expect(view.state.doc.toString()).toBe("/");
src/__tests__/editor/slash.test.ts:1126:    expect(view.state.doc.toString()).toBe("text");
src/__tests__/editor/slash.test.ts:1185:    expect(view.state.doc.toString()).toBe("");
src/__tests__/editor/slash.test.ts:1217:    expect(view.state.doc.toString()).toBe("已有内容");
src/__tests__/editor/slash.test.ts:1227:    expect(view.state.doc.toString()).toBe("");
e2e/callout-columns.spec.ts:27:  await editor.waitFor({ state: "visible", timeout: 10000 });
src/__tests__/editor/blockConvert.test.ts:2:import { Text } from "@codemirror/state";
src/__tests__/editor/blockConvert.test.ts:18:  const state = doc(text);
src/__tests__/editor/blockConvert.test.ts:20:    state,
src/__tests__/editor/blockConvert.test.ts:21:    { from: 0, to: state.length },
src/__tests__/editor/blockConvert.test.ts:67:    const state = doc("正文\n第二行");
src/__tests__/editor/blockConvert.test.ts:68:    const changes = blockConvertChanges(state, { from: 0, to: 5 }, "h2");
e2e/callout-editor.spec.ts:27:  await editor.waitFor({ state: "visible", timeout: 10000 });
src/__tests__/editor/structural-tags-decorations.test.ts:9:import { EditorState } from "@codemirror/state";
src/__tests__/editor/structural-tags-decorations.test.ts:81:      state: EditorState.create({
src/__tests__/editor/structural-tags-decorations.test.ts:99:    expect(view.state.doc.toString()).toBe(doc.replace(/\r\n/g, "\n"));
e2e/columns-picker-caption-848.spec.ts:95:        "record-state",
e2e/columns-picker-caption-848.spec.ts:97:        "--state",
e2e/video-controls.spec.ts:403:    path.join(evidenceDir, "state-coverage.json"),
e2e/video-controls.spec.ts:406:        states: [
e2e/video-controls.spec.ts:408:            state: "non-fullscreen-bar",
e2e/video-controls.spec.ts:413:            state: "fullscreen-before-move",
e2e/video-controls.spec.ts:418:            state: "fullscreen-after-move",

exec
/bin/zsh -lc "rg -n 'identifier|productName|bundle|name' src-tauri/tauri.conf.json src-tauri/Cargo.toml package.json | head -n 100; sed -n '1,100p' src-tauri/tauri.conf.json" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src-tauri/tauri.conf.json:3:  "productName": "Biaoyue",
src-tauri/tauri.conf.json:5:  "identifier": "dev.biaoyue.app",
src-tauri/tauri.conf.json:35:  "bundle": {
src-tauri/tauri.conf.json:48:        "name": "Markdown",
src-tauri/tauri.conf.json:54:        "name": "HTML",
src-tauri/tauri.conf.json:60:        "name": "Text",
src-tauri/Cargo.toml:2:name = "biaoyue"
src-tauri/Cargo.toml:9:name = "biaoyue_lib"
package.json:2:  "name": "biaoyue",
{
  "$schema": "https://raw.githubusercontent.com/nicedoc/tauri/main/packages/api/schema.json",
  "productName": "Biaoyue",
  "version": "0.4.0",
  "identifier": "dev.biaoyue.app",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:1420",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build"
  },
  "app": {
    "windows": [
      {
        "title": "标月",
        "width": 1200,
        "height": 800,
        "resizable": true,
        "fullscreen": false,
        "minWidth": 600,
        "minHeight": 400,
        "dragDropEnabled": true,
        "titleBarStyle": "Overlay",
        "hiddenTitle": true
      }
    ],
    "security": {
      "csp": null,
      "assetProtocol": {
        "enable": true,
        "scope": ["**"]
      }
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "fileAssociations": [
      {
        "ext": ["md"],
        "name": "Markdown",
        "description": "Markdown document",
        "role": "Editor"
      },
      {
        "ext": ["html", "htm"],
        "name": "HTML",
        "description": "HTML document",
        "role": "Viewer"
      },
      {
        "ext": ["txt"],
        "name": "Text",
        "description": "Plain text document",
        "role": "Editor"
      }
    ]
  }
}

exec
/bin/zsh -lc "rg -n \"fn default|impl Default|reader_font_size|reader_width|reader_skin|roulette_sectors|html_toolbar_items|heading_fonts|default_save_path\" src-tauri/src/config.rs | head -n 100; nl -ba src-tauri/src/config.rs | sed -n '120,245p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
18:    pub reader_font_size: Option<f64>,
19:    pub reader_width: Option<f64>,
20:    pub reader_skin: Option<String>,
64:    pub roulette_sectors: Option<Vec<String>>,
67:    pub html_toolbar_items: Option<Vec<String>>,
71:    pub default_save_path: Option<String>,
88:    pub heading_fonts: Option<HeadingFonts>,
197:impl Default for AppConfig {
198:    fn default() -> Self {
202:            reader_font_size: Some(17.0),
203:            reader_width: Some(1080.0),
204:            reader_skin: Some("paper".into()),
219:            roulette_sectors: None,
220:            html_toolbar_items: None,
221:            default_save_path: None,
226:            heading_fonts: None,
274:fn defaults_path(base: &Path) -> PathBuf {
538:fn check_heading_fonts(fonts: &Option<HeadingFonts>) -> Result<(), AppError> {
557:    check_range("readerFontSize", config.reader_font_size, 8.0, 96.0)?;
558:    check_range("readerWidth", config.reader_width, 480.0, 2400.0)?;
585:        config.reader_skin.as_deref(),
658:    if let Some(sectors) = &config.roulette_sectors {
688:    check_heading_fonts(&config.heading_fonts)?;
712:    if let Some(items) = &config.html_toolbar_items {
1093:        assert_eq!(config.reader_width, Some(1080.0));
1172:        config.reader_width = Some(479.0);
1174:        config.reader_width = Some(2400.0);
1187:        config.reader_skin = Some("indigo".into());
1189:        config.reader_skin = Some("plain".into());
1202:        config.reader_font_size = Some(7.9);
1304:    fn defaults_layer_is_created_once() {
1556:    fn html_toolbar_items_accepts_subset_and_rejects_bad_input() {
1558:        config.html_toolbar_items = Some(vec!["format-bold".into(), "ai-polish".into()]);
1561:        config.html_toolbar_items = Some(vec!["format-bold".into(), "nope".into()]);
1564:        config.html_toolbar_items = Some(vec!["format-bold".into(), "format-bold".into()]);
1567:        config.html_toolbar_items = Some(Vec::new());
1572:    fn roulette_sectors_accepts_subset_and_rejects_bad_input() {
1574:        config.roulette_sectors = Some(vec!["format".into(), "smart".into()]);
1577:        config.roulette_sectors = Some(vec!["format".into(), "nope".into()]);
1580:        config.roulette_sectors = Some(vec!["format".into(), "format".into()]);
1583:        config.roulette_sectors = Some(Vec::new());
1687:    fn heading_fonts_round_trips_and_rejects_bad_input() {
1688:        let dir = temp_base("heading_fonts");
1693:        assert_eq!(load_config_at(base).unwrap().heading_fonts, None);
1696:        config.heading_fonts = Some(HeadingFonts {
1711:        let loaded = load_config_at(base).unwrap().heading_fonts.unwrap();
1716:        config.heading_fonts = Some(HeadingFonts {
1723:        config.heading_fonts = Some(HeadingFonts {
1730:        config.heading_fonts = Some(HeadingFonts {
   120	    pub x: f64,
   121	    pub y: f64,
   122	}
   123	
   124	/// AI 视图改写规格：布局 / 密度 / 卡片高度 / 区块颜色 / 图标标签 / 预览开关 /
   125	/// 面板宽窄 / 网格排布与分组 / 未读 / 主题分组 / 置顶段缩放。
   126	#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
   127	#[serde(rename_all = "camelCase")]
   128	pub struct AiViewSpec {
   129	    pub rail_layout: Option<String>,
   130	    pub rail_density: Option<String>,
   131	    #[serde(default, skip_serializing_if = "Option::is_none")]
   132	    pub rail_card_height: Option<f64>,
   133	    #[serde(default, skip_serializing_if = "Option::is_none")]
   134	    pub block_colors: Option<bool>,
   135	    #[serde(default, skip_serializing_if = "Option::is_none")]
   136	    pub icon_label: Option<String>,
   137	    #[serde(default, skip_serializing_if = "Option::is_none")]
   138	    pub preview_enabled: Option<bool>,
   139	    #[serde(default, skip_serializing_if = "Option::is_none")]
   140	    pub rail_pinned_width: Option<f64>,
   141	    #[serde(default, skip_serializing_if = "Option::is_none")]
   142	    pub grid_mode: Option<String>,
   143	    #[serde(default, skip_serializing_if = "Option::is_none")]
   144	    pub grid_grouping: Option<String>,
   145	    #[serde(default, skip_serializing_if = "Option::is_none")]
   146	    pub grid_sort: Option<String>,
   147	    #[serde(default, skip_serializing_if = "Option::is_none")]
   148	    pub unread_only: Option<bool>,
   149	    #[serde(default, skip_serializing_if = "Option::is_none")]
   150	    pub theme_groups: Option<bool>,
   151	    #[serde(default, skip_serializing_if = "Option::is_none")]
   152	    pub pinned_and_recent_only: Option<bool>,
   153	    #[serde(default, skip_serializing_if = "Option::is_none")]
   154	    pub pinned_segment_scale: Option<f64>,
   155	}
   156	
   157	/// 悬浮预览窗开关：阅读空间悬停 / 网格触发方式 / 总开关。
   158	#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
   159	#[serde(rename_all = "camelCase")]
   160	pub struct PreviewSettings {
   161	    pub rail_hover: Option<bool>,
   162	    /// hover / click / off；非法值由校验拦下。
   163	    pub grid_mode: Option<String>,
   164	    pub enabled: Option<bool>,
   165	}
   166	
   167	/// 阅读空间栏视图规格：布局（堆叠/标签）、密度（紧凑/舒适/卡片）与卡片高度。
   168	#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
   169	#[serde(rename_all = "camelCase")]
   170	pub struct RailViewSpec {
   171	    pub layout: Option<String>,
   172	    pub density: Option<String>,
   173	    /// 卡片档高度 88–160；旧配置无此字段仍可加载（default + skip）。
   174	    #[serde(default, skip_serializing_if = "Option::is_none")]
   175	    pub card_height: Option<f64>,
   176	}
   177	
   178	#[derive(Debug, Serialize, Deserialize, Clone)]
   179	#[serde(rename_all = "camelCase")]
   180	pub struct RecentFile {
   181	    pub path: String,
   182	    pub title: String,
   183	    pub opened_at: String,
   184	    /// 打开时截下的正文开头；门户卡片用它显示真摘要。
   185	    /// `default` + `skip_serializing_if` 保证老配置文件仍能读、新文件不多出空字段。
   186	    #[serde(default, skip_serializing_if = "Option::is_none")]
   187	    pub excerpt: Option<String>,
   188	}
   189	
   190	#[derive(Debug, Serialize, Deserialize, Clone)]
   191	#[serde(rename_all = "camelCase")]
   192	pub struct ScrollPosition {
   193	    pub scroll_pos: f64,
   194	    pub content_height: f64,
   195	}
   196	
   197	impl Default for AppConfig {
   198	    fn default() -> Self {
   199	        Self {
   200	            font_size: Some(17.0),
   201	            heading_colors: None,
   202	            reader_font_size: Some(17.0),
   203	            reader_width: Some(1080.0),
   204	            reader_skin: Some("paper".into()),
   205	            ollama_endpoint: Some("http://localhost:11434".into()),
   206	            openai_endpoint: Some("https://api.openai.com".into()),
   207	            openai_model: Some("gpt-4o-mini".into()),
   208	            openai_api_key: None,
   209	            translation_provider: Some("ollama".into()),
   210	            source_lang: Some("en".into()),
   211	            target_lang: Some("zh-CN".into()),
   212	            theme: Some("system".into()),
   213	            ai_confirm_density: Some("session-silent".into()),
   214	            icon_label: Some("text".into()),
   215	            pane_layout: None,
   216	            rail_view_spec: None,
   217	            preview_settings: None,
   218	            ai_view_spec: None,
   219	            roulette_sectors: None,
   220	            html_toolbar_items: None,
   221	            default_save_path: None,
   222	            roulette_hotkey: None,
   223	            roulette_form: None,
   224	            roulette_position: None,
   225	            notice_duration: None,
   226	            heading_fonts: None,
   227	            rail_pin_hidden: None,
   228	            property_bar: None,
   229	            sidebar_left_visible: Some(true),
   230	            sidebar_right_visible: Some(false),
   231	            sidebar_left_width: Some(220.0),
   232	            sidebar_right_width: Some(320.0),
   233	            horizontal_split_ratio: Some(0.5),
   234	            vertical_split_ratio: Some(0.5),
   235	            recent_files: Some(Vec::new()),
   236	            scroll_positions: Some(HashMap::new()),
   237	            embed_scroll_positions: Some(HashMap::new()),
   238	            capabilities: Some(HashMap::new()),
   239	        }
   240	    }
   241	}
   242	
   243	#[derive(Debug, Serialize, Deserialize, Clone)]
   244	pub struct HeadingColors {
   245	    pub h1: Option<String>,

exec
/bin/zsh -lc 'rg -n "readerSkin|paper|plain|modern|skin" src src-tauri docs/design/system/spec.md docs/design/system/decisions.md | head -n 250' in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src-tauri/src/extensions.rs:652:        write_file(base, "snippets/a.md", "---\nid: plain\n---\n正文\n");
src-tauri/src/extensions.rs:656:        assert_eq!(snapshot.snippets[0].label, "plain");
src/lib/aiErrors.ts:24:  readerSkin: "阅读皮肤只能选纸感或素雅",
src/lib/railCards.ts:81:export function plainTextOf(html: string): string {
src/lib/railCards.ts:111:  const plain = path && /\.html?$/i.test(path) ? plainTextOf(text) : text;
src/lib/railCards.ts:112:  return plain.replace(/\s+/g, " ").trim().slice(0, 160);
src/lib/railCards.ts:118: * 与 `plainTextOf` 平行：HTML 在 `excerptOf` 里已去标签，Markdown 的语法
src-tauri/src/config.rs:20:    pub reader_skin: Option<String>,
src-tauri/src/config.rs:204:            reader_skin: Some("paper".into()),
src-tauri/src/config.rs:584:        "readerSkin",
src-tauri/src/config.rs:585:        config.reader_skin.as_deref(),
src-tauri/src/config.rs:586:        &["paper", "plain"],
src-tauri/src/config.rs:933:| `readerSkin` | `paper` / `plain` |
src-tauri/src/config.rs:1187:        config.reader_skin = Some("indigo".into());
src-tauri/src/config.rs:1189:        config.reader_skin = Some("plain".into());
src/components/SettingsView.tsx:165:  { id: "paper", label: "纸墨", swatch: "#1f1d1a" },
src/components/SettingsView.tsx:642:  const readerSkin = useEditorStore((s) => s.config.readerSkin ?? "paper");
src/components/SettingsView.tsx:1023:  const chooseReaderSkin = (skin: string) => {
src/components/SettingsView.tsx:1024:    setConfig({ readerSkin: skin });
src/components/SettingsView.tsx:1025:    applyReaderSkin(skin);
src/components/SettingsView.tsx:1892:                    const selected = readerSkin === tone.id;
src/hooks/useConfig.ts:48:  readerSkin: string | null;
src/hooks/useConfig.ts:137:export function applyReaderSkin(skin: string): void {
src/hooks/useConfig.ts:138:  document.documentElement.dataset.skin = skin || "paper";
src/hooks/useConfig.ts:154:    readerSkin: es.config.readerSkin ?? null,
src/hooks/useConfig.ts:396:    readerSkin: raw.readerSkin ?? "paper",
src/hooks/useConfig.ts:487:  applyReaderSkin(config.readerSkin ?? "paper");
src/hooks/useConfig.ts:558:        readerSkin: "paper",
src/hooks/useConfig.ts:577:      applyReaderSkin("paper");
src/styles/reader.css:22:  --reader-paper: var(--app-surface);
src/styles/reader.css:60:  background: var(--reader-paper);
src/styles/reader.css:1278:  --pele-surface: var(--reader-paper);
src/styles/reader.css:1300:html[data-skin="indigo"] .preview-content,
src/styles/reader.css:1301:html[data-skin="indigo"] .cm-editor-container {
src/styles/reader.css:1310:html.dark[data-skin="indigo"] .preview-content,
src/styles/reader.css:1311:html.dark[data-skin="indigo"] .cm-editor-container {
src/styles/reader.css:1320:html[data-skin="moss"] .preview-content,
src/styles/reader.css:1321:html[data-skin="moss"] .cm-editor-container {
src/styles/reader.css:1330:html.dark[data-skin="moss"] .preview-content,
src/styles/reader.css:1331:html.dark[data-skin="moss"] .cm-editor-container {
src/styles/reader.css:1340:html[data-skin="clay"] .preview-content,
src/styles/reader.css:1341:html[data-skin="clay"] .cm-editor-container {
src/styles/reader.css:1350:html.dark[data-skin="clay"] .preview-content,
src/styles/reader.css:1351:html.dark[data-skin="clay"] .cm-editor-container {
src/components/ai/SelectionPill.tsx:56:  | { key: "explain"; label: "解释"; prompt: string }
src/components/ai/SelectionPill.tsx:62:    key: "explain",
src/__tests__/useAiEntry.test.ts:26:    readerSkin: "paper",
src/types/index.ts:76:  /** 阅读皮肤：paper / modern … */
src/types/index.ts:77:  readerSkin: string;
src/__tests__/store.test.ts:44:      useStore.getState().openFile("/path/notes.txt", "plain text");
src/__tests__/types.test.ts:33:      readerSkin: "paper",
src/__tests__/editor/blockModel.test.ts:26:  it("returns a single paragraph for plain text", () => {
src/__tests__/editor/blockModel.test.ts:60:  it("keeps an unknown callout type and a plain blockquote as blockquote", () => {
src/__tests__/editor/blockModel.test.ts:142:  it("plain list items remain type list (not task)", () => {
src/__tests__/editor/blockModel.test.ts:151:    const state = makeState("- [ ] todo\n- plain item");
src/components/Content/PreviewView.tsx:142:  const readerSkin = useEditorStore((s) => s.config.readerSkin);
src/components/Content/PreviewView.tsx:180:    if (readerSkin) applyReaderSkin(readerSkin);
src/components/Content/PreviewView.tsx:181:  }, [readerSkin]);
src/lib/mdpkg/vendor/mdpkg-web.js:9475:// node_modules/is-plain-obj/index.js
src/lib/mdpkg/vendor/mdpkg-web.js:16188:  txt: "text/plain",
src/lib/mdpkg/vendor/mdpkg-web.js:23518:function plainRun(text8, fmt) {
src/lib/mdpkg/vendor/mdpkg-web.js:23526:    if (i2 > 0 && parts[i2]) out += plainRun(" ", fmt);
src/lib/mdpkg/vendor/mdpkg-web.js:23527:    if (parts[i2]) out += plainRun(parts[i2], fmt);
src/lib/mdpkg/vendor/mdpkg-web.js:23532:  return plainRun(text8, { ...fmt, code: true });
src/lib/mdpkg/vendor/mdpkg-web.js:23841:  const prefix = extra?.prefix ? plainRun(extra.prefix, {}) : "";
src/lib/mdpkg/vendor/mdpkg-web.js:23915:      const prefix = extra?.prefix ? plainRun(extra.prefix, {}) : "";
src/__tests__/captureOverlay.prefix.test.ts:11:  it("returns '' for a plain '想法' line", () => {
src/__tests__/editor/decorations-blocks.test.ts:401:      const plain = widgetOf(
src/__tests__/editor/decorations-blocks.test.ts:404:      expect(plain.dataset.mediaKind).toBe("video");
src/__tests__/editor/decorations-blocks.test.ts:405:      expect(plain.dataset.align).toBe("center");
src/__tests__/editor/decorations-blocks.test.ts:406:      expect(plain.style.width).toBe("");
src/__tests__/editor/decorations-blocks.test.ts:407:      expect(plain.querySelector("video")?.style.width).toBe("100%");
src/__tests__/editor/decorations-blocks.test.ts:650:        createMermaidDecorations("```\nplain\n```", -1, -1, hydrate()),
src/__tests__/editor/slash.test.ts:479:    typeText("plain text");
src/__tests__/editor/slash.test.ts:481:    expect(view.state.doc.toString()).toBe("plain text");
src/renderers/text.ts:2: * Render plain text as HTML-safe <pre> content.
src/__tests__/editors/decorations/list.test.ts:36:    it("does not match plain text", () => {
src/__tests__/editors/decorations/list.test.ts:38:      expect(unorderedListRegex.test("plain text")).toBe(false);
src/__tests__/editors/decorations/list.test.ts:76:    it("does not match plain list item", () => {
src/__tests__/editors/decorations/list.test.ts:78:      expect(taskListRegex.test("- plain item")).toBe(false);
src/__tests__/editors/decorations/list.test.ts:122:    it("returns empty for plain text", () => {
src/__tests__/editors/decorations/list.test.ts:123:      const result = createListDecorations("plain text");
src/__tests__/editors/decorations/list.test.ts:142:    it("classifies plain text", () => {
src/__tests__/editors/decorations/list.test.ts:143:      expect(classifyListLine("plain").kind).toBe("plain");
src/__tests__/editors/decorations/list.test.ts:181:    it("keeps the ordered marker plain when inactive", () => {
src/__tests__/editors/decorations/code.test.ts:74:    it("returns empty for plain text", () => {
src/__tests__/editors/decorations/code.test.ts:75:      const result = createCodeDecorations("plain text");
src/__tests__/editors/decorations/heading.test.ts:32:    it("does not match plain text", () => {
src/__tests__/editors/decorations/heading.test.ts:98:    it("returns empty for plain text", () => {
src/__tests__/editors/decorations/heading.test.ts:99:      const result = createHeadingDecorations("plain text\nno headings\n");
src/__tests__/editors/decorations/boldItalic.test.ts:76:    it("returns empty for plain text", () => {
src/__tests__/editors/decorations/boldItalic.test.ts:77:      const result = createBoldItalicDecorations("plain text");
src/__tests__/useConfig.hotApply.test.ts:31:    readerSkin: "paper",
src/__tests__/editors/decorations/quote.test.ts:26:    it("does not match plain text", () => {
src/__tests__/editors/decorations/quote.test.ts:28:      expect(quoteRegex.test("plain text")).toBe(false);
src/__tests__/editors/decorations/quote.test.ts:81:    it("returns empty for plain text", () => {
src/__tests__/editors/decorations/quote.test.ts:82:      const result = createQuoteDecorations("plain text");
src/__tests__/editor/table-decorations.test.ts:100:  it("passes plain text through untouched", () => {
src/__tests__/editor/table-decorations.test.ts:101:    expect(sanitizeCellText("plain text")).toBe("plain text");
src/__tests__/editor/table-decorations.test.ts:128:  it("passes plain text through untouched", () => {
src/__tests__/editor/table-decorations.test.ts:129:    expect(renderCellText("plain text")).toBe("plain text");
src/__tests__/markdownRender.test.ts:14:    const html = renderMarkdown("```\nplain text\n```");
src/__tests__/components/SettingsView.test.tsx:12:  applyReaderSkin: (skin: string) => {
src/__tests__/components/SettingsView.test.tsx:13:    document.documentElement.dataset.skin = skin || "paper";
src/__tests__/components/SettingsView.test.tsx:43:  delete document.documentElement.dataset.skin;
src/__tests__/components/SettingsView.test.tsx:124:    expect(useEditorStore.getState().config.readerSkin).toBe("indigo");
src/__tests__/components/SettingsView.test.tsx:125:    expect(document.documentElement.dataset.skin).toBe("indigo");
src/__tests__/useConfig.webFallback.test.tsx:38:    expect(es.config.readerSkin).toBe("paper");
src/__tests__/useConfig.webFallback.test.tsx:41:    expect(document.documentElement.dataset.skin).toBe("paper");
src/__tests__/railCards.test.ts:17:  plainTextOf,
src/__tests__/railCards.test.ts:103:      plainTextOf("<html><body><h1>页面</h1><p>HTML 预览</p></body></html>"),
src/__tests__/railCards.test.ts:105:    expect(plainTextOf("<script>var x=1;</script><p>正文</p>")).toBe("正文");
src/__tests__/railCards.test.ts:106:    expect(plainTextOf("<style>.a{}</style><p>正文</p>")).toBe("正文");
src/__tests__/railCards.test.ts:107:    expect(plainTextOf("<!-- 注释 --><p>正文</p>")).toBe("正文");
src/__tests__/railCards.test.ts:108:    expect(plainTextOf("<p>a &amp; b &lt;tag&gt; &nbsp; c</p>")).toBe(
src/__tests__/railCards.test.ts:111:    expect(plainTextOf("<p>第一</p><p>第二</p>")).toBe("第一 第二");
src/__tests__/railCards.test.ts:113:    expect(plainTextOf("<p>&#x110000; &#xD800; &#65;</p>")).toBe(
src/__tests__/railCards.test.ts:243:    const item = file("/u/plain.md", "正文没有任何勾选框。");
src/__tests__/railCards.test.ts:252:    const item = file("/u/plain.md", "正文没有任何勾选框。");
src/__tests__/editor/smartInput.test.ts:84:  it("converts '- [ ] ' to task item (not plain bullet)", () => {
src/__tests__/editor/smartInput.test.ts:146:    type("plain text");
src/__tests__/captureOverlay.chunk.test.ts:17:  describe("plain note (no prefix)", () => {
src/editors/decorations/block-dom.ts:55:  if (classifyListLine(line).kind !== "plain") {
src/editors/html/model.ts:37:  "plaintext",
src/editors/decorations/list.ts:35:  kind: "task" | "unordered" | "ordered" | "plain";
src/editors/decorations/list.ts:80:  return { ...base, kind: "plain", markerLen: 0 };
src/editors/decorations/list.ts:226:  if (info.kind === "plain") {
src/__tests__/renderers.markdown.test.ts:24:      '<input type="text" name="x" onerror="alert(1)">\n\nplain',

exec
/bin/zsh -lc 'rg -n "theme.toml|DECLARED_TOKENS|17|--app-|tokens" docs/design docs/agents/evidence-capture.md src-tauri/src/extensions.rs src/styles/tokens.css | head -n 250' in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src/styles/tokens.css:8: * 而非抢眼。想统一时把 --reader-accent 指回 var(--app-accent) 即可。
src/styles/tokens.css:21:  --app-accent: #6366f1;
src/styles/tokens.css:22:  --app-accent-soft: rgba(99, 102, 241, 0.1);
src/styles/tokens.css:24:  --app-bg: #f7f7f6;
src/styles/tokens.css:25:  --app-surface: #fbfaf8;
src/styles/tokens.css:26:  --app-sunken: #f4f2ec;
src/styles/tokens.css:27:  --app-chrome-bg: var(--app-surface);
src/styles/tokens.css:29:  --app-text: #24262b;
src/styles/tokens.css:30:  --app-text-strong: #16181c;
src/styles/tokens.css:31:  --app-text-2: #55595f;
src/styles/tokens.css:32:  --app-text-3: #8b8f96;
src/styles/tokens.css:33:  --app-chrome-rest: #8b8f96;
src/styles/tokens.css:34:  --app-chrome-hover: #24262b;
src/styles/tokens.css:35:  --app-chrome-rest: #8b8f96;
src/styles/tokens.css:36:  --app-chrome-hover: #24262b;
src/styles/tokens.css:38:  --app-border: #e7e3db;
src/styles/tokens.css:39:  --app-border-strong: #d8d3c8;
src/styles/tokens.css:41:  --app-radius: 6px;
src/styles/tokens.css:47:     取值 6px 延续视频块既有圆角（预览 --reader-radius / 编辑 --app-radius 均为 6px）。 */
src/styles/tokens.css:51:  --app-shadow:
src/styles/tokens.css:56:  --app-accent: #818cf8;
src/styles/tokens.css:57:  --app-accent-soft: rgba(129, 140, 248, 0.14);
src/styles/tokens.css:59:  --app-bg: #131316;
src/styles/tokens.css:60:  --app-surface: #1a1b1e;
src/styles/tokens.css:61:  --app-sunken: #22242a;
src/styles/tokens.css:62:  --app-chrome-bg: var(--app-surface);
src/styles/tokens.css:64:  --app-text: #d8dade;
src/styles/tokens.css:65:  --app-text-strong: #eceef1;
src/styles/tokens.css:66:  --app-text-2: #a7abb3;
src/styles/tokens.css:67:  --app-text-3: #75797f;
src/styles/tokens.css:68:  --app-chrome-rest: #75797f;
src/styles/tokens.css:69:  --app-chrome-hover: #d8dade;
src/styles/tokens.css:70:  --app-chrome-rest: #75797f;
src/styles/tokens.css:71:  --app-chrome-hover: #d8dade;
src/styles/tokens.css:73:  --app-border: #2e3138;
src/styles/tokens.css:74:  --app-border-strong: #3d4149;
src/styles/tokens.css:79:  --app-accent: #0071e3;
src/styles/tokens.css:80:  --app-accent-soft: rgba(0, 113, 227, 0.08);
src/styles/tokens.css:82:  --app-bg: #f2e9da;
src/styles/tokens.css:83:  --app-surface: #fbf4e8;
src/styles/tokens.css:84:  --app-sunken: #efe3d0;
src/styles/tokens.css:85:  --app-chrome-bg: var(--app-surface);
src/styles/tokens.css:87:  --app-text: #3b3024;
src/styles/tokens.css:88:  --app-text-strong: #241c12;
src/styles/tokens.css:89:  --app-text-2: #6b5a45;
src/styles/tokens.css:90:  --app-text-3: #96826a;
src/styles/tokens.css:91:  --app-chrome-rest: #96826a;
src/styles/tokens.css:92:  --app-chrome-hover: #3b3024;
src/styles/tokens.css:93:  --app-chrome-rest: #96826a;
src/styles/tokens.css:94:  --app-chrome-hover: #3b3024;
src/styles/tokens.css:96:  --app-border: #e0d2bc;
src/styles/tokens.css:97:  --app-border-strong: #cdbca1;
src/styles/tokens.css:103: * 中性工具类映射回 `--app-*`，使亮/暗/暖三主题共用同一套语义色。
src/styles/tokens.css:104: * 新增组件请直接用 `var(--app-*)`，不要再依赖这层。 */
src/styles/tokens.css:106:  background-color: var(--app-surface) !important;
src/styles/tokens.css:111:  background-color: var(--app-sunken) !important;
src/styles/tokens.css:115:  background-color: var(--app-border) !important;
src/styles/tokens.css:120:  background-color: var(--app-text) !important;
src/styles/tokens.css:131:    var(--app-surface) 94%,
src/styles/tokens.css:139:  color: var(--app-text) !important;
src/styles/tokens.css:145:  color: var(--app-text-2) !important;
src/styles/tokens.css:152:  border-color: var(--app-border) !important;
src/styles/tokens.css:160:  background-color: var(--app-sunken) !important;
src/styles/tokens.css:165:  background-color: var(--app-surface) !important;
src/styles/tokens.css:169:  background-color: var(--app-sunken) !important;
src/styles/tokens.css:174:  color: var(--app-text) !important;
src/styles/tokens.css:179:  color: var(--app-text-2) !important;
src/styles/tokens.css:183:  border-color: var(--app-border) !important;
src/styles/tokens.css:188:  background-color: var(--app-sunken) !important;
src-tauri/src/extensions.rs:1://! 用户扩展点（design §D1–D4）：snippets / templates / theme tokens。
src-tauri/src/extensions.rs:29:    pub tokens: BTreeMap<String, String>,
src-tauri/src/extensions.rs:68:/// `src/styles/tokens.css` 已声明的 token 名（不含 `--app-` 前缀）。
src-tauri/src/extensions.rs:70:const DECLARED_TOKENS: &[&str] = &[
src-tauri/src/extensions.rs:86:/// 把 `theme.toml` 里的键规范化成 `--app-<name>`。
src-tauri/src/extensions.rs:87:/// `accent` 与 `--app-accent` 两种写法等价；未声明或形状非法返回 `None`。
src-tauri/src/extensions.rs:89:    let name = key.strip_prefix("--app-").unwrap_or(key);
src-tauri/src/extensions.rs:97:    if !DECLARED_TOKENS.contains(&name) {
src-tauri/src/extensions.rs:100:    Some(format!("--app-{name}"))
src-tauri/src/extensions.rs:314:/// 读取 `<dir>/theme.toml` 的 `[tokens]` 表，白名单校验键与值。
src-tauri/src/extensions.rs:316:    let path = dir.join("theme.toml");
src-tauri/src/extensions.rs:324:                tokens: BTreeMap::new(),
src-tauri/src/extensions.rs:325:                warnings: vec![format!("theme.toml: 读取失败（{e}）")],
src-tauri/src/extensions.rs:330:    let mut tokens = BTreeMap::new();
src-tauri/src/extensions.rs:336:            if let Some(toml::Value::Table(token_table)) = table.get("tokens") {
src-tauri/src/extensions.rs:350:                    tokens.insert(key, value.to_string());
src-tauri/src/extensions.rs:354:        Ok(_) => warnings.push("theme.toml: 顶层不是表".into()),
src-tauri/src/extensions.rs:355:        Err(e) => warnings.push(format!("theme.toml: 解析失败（{e}）")),
src-tauri/src/extensions.rs:359:        warnings.push(format!("theme.toml: 忽略 {invalid} 个非法 token"));
src-tauri/src/extensions.rs:362:    ThemeTokens { tokens, warnings }
src-tauri/src/extensions.rs:495:        assert!(snapshot.theme.tokens.is_empty());
src-tauri/src/extensions.rs:501:    fn theme_valid_tokens_are_kept() {
src-tauri/src/extensions.rs:506:            "theme.toml",
src-tauri/src/extensions.rs:507:            "[tokens]\n--app-accent = \"#c2410c\"\n--app-bg = \"rgb(255, 255, 255)\"\n--app-text = \"red\"\n",
src-tauri/src/extensions.rs:520:                .tokens
src-tauri/src/extensions.rs:521:                .get("--app-accent")
src-tauri/src/extensions.rs:526:            snapshot.theme.tokens.get("--app-bg").map(String::as_str),
src-tauri/src/extensions.rs:530:            snapshot.theme.tokens.get("--app-text").map(String::as_str),
src-tauri/src/extensions.rs:541:            "theme.toml",
src-tauri/src/extensions.rs:542:            "[tokens]\naccent = \"#c2410c\"\ntext-2 = \"#55595f\"\n",
src-tauri/src/extensions.rs:555:                .tokens
src-tauri/src/extensions.rs:556:                .get("--app-accent")
src-tauri/src/extensions.rs:563:                .tokens
src-tauri/src/extensions.rs:564:                .get("--app-text-2")
src-tauri/src/extensions.rs:568:        assert!(!snapshot.theme.tokens.contains_key("accent"));
src-tauri/src/extensions.rs:577:            "theme.toml",
src-tauri/src/extensions.rs:578:            "[tokens]\n--app-not-a-real-token = \"#fff\"\n--app-accent = \"#c2410c\"\n",
src-tauri/src/extensions.rs:583:        assert_eq!(snapshot.theme.tokens.len(), 1);
src-tauri/src/extensions.rs:584:        assert!(snapshot.theme.tokens.contains_key("--app-accent"));
src-tauri/src/extensions.rs:600:            "theme.toml",
src-tauri/src/extensions.rs:601:            "[tokens]\n--app-accent = \"#c2410c\"\n--unknown = \"#fff\"\n--app-bg = \"url(http://x)\"\n--app-text = \"expression(alert(1))\"\n",
src-tauri/src/extensions.rs:607:        assert_eq!(snapshot.theme.tokens.len(), 1);
src-tauri/src/extensions.rs:608:        assert!(snapshot.theme.tokens.contains_key("--app-accent"));
docs/design/approved/selection-roulette/HANDOFF.md:18:| 2 | `docs/design/system/spec.md` | 视觉数值（图标 14px、字号 11/12/13、圆角 4/8、语义色、`--app-shadow`） |
docs/design/approved/selection-roulette/README.md:160:| 浮层底色 / 描边 / 阴影 | `--app-surface` / `--app-border` / `--app-shadow` | spec §5、§6 |
docs/design/approved/selection-roulette/README.md:162:| 强调色（悬停 / 激活） | `--app-accent` + `--app-accent-soft` | spec §6 |
docs/design/approved/font-size-scaling/spec.md:30:全局 baseFontSize = 17   // 存于现有 config.json
docs/design/approved/font-size-scaling/spec.md:33:**全部存储**：现有 `~/.config/biaoyue/config.json` 的 `fontSize: number = 17`。零新文件，零新字段。
docs/design/approved/font-size-scaling/spec.md:47:| 元素 | 倍率 | base=17 时实际 |
docs/design/approved/font-size-scaling/spec.md:49:| body / p / li / blockquote / 任务列表 | 1.00x | 17px |
docs/design/approved/font-size-scaling/spec.md:71:  --base-font-size: var(--editor-font-size, 17px);
docs/design/approved/font-size-scaling/spec.md:85:  --base-font-size: var(--editor-font-size, 17px);
docs/design/approved/font-size-scaling/spec.md:199:  config.json { fontSize: 17 }   // 持久化
docs/design/system/decisions.md:67:| 手柄菜单宽度 | 新建/转换菜单统一 176px（原 264 的 2/3）；颜色面板 168px | #497 | 2026-11-09 |
docs/design/approved/README.md:32:| 阅读排版 | [reader-typography/spec.md](./reader-typography/spec.md) | 阅读排版设计系统（实现见 `src/styles/tokens.css`、`src/styles/reader.css`、`src/renderers/`） | — |
docs/design/approved/reader-typography/spec.md:15:> 落地位置：`src/styles/tokens.css`（全局语义色）、`src/styles/reader.css`（阅读排版）、
docs/design/approved/reader-typography/spec.md:25:6. **主题色与全局合并**：新建 `--app-*` 全局语义色层，强调色沿用 D7 定案的 indigo（`#6366f1` / `#818cf8`），预览侧默认继承——换主题色只改一处；老 UI 渐进迁移，本期不做大替换（详见 §5.2）。
docs/design/approved/reader-typography/spec.md:37:| 6 | 背景纯白 `#ffffff` + 正文 `#24292e`；暗色 `#0d1117`（代码托管站配色） | `theme-light.css:4-5`、`theme-dark.css:4-5` | 对比过强刺眼；暗色与阅读场景不匹配 |
docs/design/approved/reader-typography/spec.md:42:| 11 | **内嵌 HTML 被剥光**：白名单只有 25 个标签，无 `div`/`span`/`details`/`kbd` 等 | `src/renderers/markdown.ts:4-17` | md 里写的 HTML 结构/样式全部失效 |
docs/design/approved/reader-typography/spec.md:51:- **字号**：正文 ≥16px（USWDS）；阅读类应用实际落在 17–19px。
docs/design/approved/reader-typography/spec.md:73:- **朱/靛**：强调色**不另造**——直接吃全局 `--app-accent`（见 §5.2，D7 定案的 indigo）；行内代码用低饱和朱色做辨识。
docs/design/approved/reader-typography/spec.md:85:| ① 全局语义色 | `--app-*` | bg / surface / sunken / text / text-2 / text-3 / border / border-strong / **accent** / accent-soft / radius / shadow | `.dark` |
docs/design/approved/reader-typography/spec.md:86:| ② 阅读外观 | `--reader-*` | paper / ink / sunken / line / accent / radius / shadow | `[data-skin=…]`（默认全部指向 `--app-*`） |
docs/design/approved/reader-typography/spec.md:94:  --app-accent: #6366f1;                    /* indigo-500，light */
docs/design/approved/reader-typography/spec.md:95:  --app-bg: #f7f7f6;  --app-surface: #fbfaf8;  --app-sunken: #f4f2ec;
docs/design/approved/reader-typography/spec.md:96:  --app-text: #24262b;  --app-text-2: #55595f;  --app-text-3: #8b8f96;
docs/design/approved/reader-typography/spec.md:97:  --app-border: #e7e3db;  --app-border-strong: #d8d3c8;
docs/design/approved/reader-typography/spec.md:100:  --reader-paper: var(--app-surface);
docs/design/approved/reader-typography/spec.md:101:  --reader-ink: var(--app-text);
docs/design/approved/reader-typography/spec.md:102:  --reader-accent: var(--app-accent);
docs/design/approved/reader-typography/spec.md:105:.dark { --app-accent: #818cf8; /* indigo-400 */ --app-surface: #1a1b1e; /* … */ }
docs/design/approved/reader-typography/spec.md:113:- **UI 强调色沿用 D7**：`--app-accent` = `#6366f1` / `#818cf8`（indigo），服务 focus ring、选中态、活跃指示器、目录高亮——这些是交互信号，需要醒目且与软件整体一致，D7 的定案没问题。
docs/design/approved/reader-typography/spec.md:115:- **两者仍是一套体系**：`--reader-accent` 默认独立取值，但改一行即可挂回全局（`--reader-accent: var(--app-accent)`）——想完全统一随时可切。这不是二选一的架构问题，是一个变量的默认值问题。
docs/design/approved/reader-typography/spec.md:120:**迁移策略（关键）**：D7 注意事项 3 已指出「`theme-light.css` + `theme-dark.css` 合并为 `tokens.css`」是破坏性修改。因此分两步：
docs/design/approved/reader-typography/spec.md:122:1. **本期**：新建 `src/styles/tokens.css` 承载 ① 全局语义色（accent = D7 indigo）；预览侧全部走新 token；`theme-*.css` 中的 `.preview-view*` 段落按 §10 步骤 2 删除，其余原样保留。
docs/design/approved/reader-typography/spec.md:123:2. **后续（对齐 design-codex 路线图 Phase 0.8 / 0.95）**：按 Toolbar → TabBar → Sidebar 逐模块把硬编码换成 `var(--app-*)`，**每模块一个 PR、独立验证**，不做一次性全量替换。
docs/design/approved/reader-typography/spec.md:146:| `--reader-accent` | `#3d5a8a`（默认独立；改一行即可挂回 `var(--app-accent)` = `#6366f1`） | `#8ab4e8` | 链接 / 引用条 / Callout 主色（低饱和靛青，对纸白 ≈ 6.3:1） |
docs/design/approved/reader-typography/spec.md:164:| `--type-font-size` | **17px 默认**，独立于 `--editor-font-size` | 设置项：15 / 16 / 17 / 18 / 19 / 21 |
docs/design/approved/reader-typography/spec.md:309:| 阅读字号 `--type-font-size` | 15 / 16 / **17** / 18 / 19 / 21 | 与编辑器字号解耦，默认 17 |
docs/design/approved/reader-typography/spec.md:322:| 1a | 新增 `src/styles/tokens.css` | ① 全局语义色 `--app-*`（accent = D7 indigo）+ light/dark 两份，在 `main.tsx` 引入 | — |
docs/design/approved/reader-typography/spec.md:323:| 1b | 新增 `src/styles/reader.css` | ② 阅读外观 `--reader-*`（默认映射到 `--app-*`，皮肤可整体覆盖）+ ③ 排版尺度 `--type-*` + 全部预览规则 + `.tok-*` + Callout + 公式样式 | 1a |
docs/design/approved/reader-typography/spec.md:346:| 全局语义色层 `tokens.css`（`--app-*`，D7 indigo） | ✅ 已建 |
docs/design/approved/reader-typography/spec.md:359:2. **UI 主题渐进迁移**：按 Toolbar → TabBar → Sidebar 逐模块把硬编码色换成 `var(--app-*)`（对齐 design-codex 路线图 Phase 0.95）。
docs/design/approved/reader-typography/README.md:21:- `src/styles/tokens.css` — 全局语义色层（`--app-*`，强调色沿用 D7 indigo）
docs/design/system/spec.md:22:- **token 名称是目标**：`--space-*` / `--fs-*` / `--radius-*` 尚未在 `tokens.css` 定义；落地前以本表字面值为准，不假装 token 已存在。
docs/design/system/spec.md:92:| `--space-16` | 16px | 17 次 | 区块间间隔 |
docs/design/system/spec.md:116:**现存矛盾（必须知道）**：`tokens.css` 定义 `--app-radius: 6px`，但实际 CSS 中 `border-radius: 4px` 出现 21 次、`6px` 仅 5 次。规范按**实际使用**裁定，`6px` 保留为存量值，不新增使用。
docs/design/system/spec.md:123:| `--app-radius` | 6px | **存量**，不新增使用 |
docs/design/system/spec.md:125:阴影：**现存矛盾，不假装只有一处**。`src/styles/*.css` 共 20 处 `box-shadow` 声明——6 处纯 token（`--app-shadow` ×5、`--reader-shadow` ×1）、4 处 inset 描边混用 `--app-accent`、10 处纯字面量（6 种，如 `0 4px 12px rgba(0,0,0,.18)` ×3、`0 8px 24px rgba(31,26,20,.12)` ×2）。规则：**新代码一律用 `--app-shadow`**；存量字面量登记为待收敛，不追溯，下次触及该组件时改引 token。
docs/design/system/spec.md:129:来源：`src/styles/tokens.css` 三主题现状**誊写**（不重新设计）。
docs/design/system/spec.md:133:| `--app-accent` | `#6366f1` | `#818cf8` | `#0071e3` |
docs/design/system/spec.md:134:| `--app-bg` | `#f7f7f6` | `#131316` | `#f2e9da` |
docs/design/system/spec.md:135:| `--app-surface` | `#fbfaf8` | `#1a1b1e` | `#fbf4e8` |
docs/design/system/spec.md:136:| `--app-sunken` | `#f4f2ec` | `#22242a` | `#efe3d0` |
docs/design/system/spec.md:137:| `--app-text` | `#24262b` | `#d8dade` | `#3b3024` |
docs/design/system/spec.md:138:| `--app-text-strong` | `#16181c` | `#eceef1` | `#241c12` |
docs/design/system/spec.md:139:| `--app-text-2` | `#55595f` | `#a7abb3` | `#6b5a45` |
docs/design/system/spec.md:140:| `--app-text-3` | `#8b8f96` | `#75797f` | `#96826a` |
docs/design/system/spec.md:141:| `--app-border` | `#e7e3db` | `#2e3138` | `#e0d2bc` |
docs/design/system/spec.md:142:| `--app-border-strong` | `#d8d3c8` | `#3d4149` | `#cdbca1` |
docs/design/system/spec.md:153:| 1 | 青碧 | `#e6f7f4` | `#0f766e` | `#b8e6de` | `#173b37` | `#7ee0d0` | `#256055` |
docs/design/system/spec.md:163:**已知缺口**：错误色尚无独立 token（现值散落在 `editor.css` / `reader.css`）；`--app-accent-soft` 各主题 alpha 不同（亮 .10 / 暗 .14 / 暖 .08）。两处均在第二个 change 的 token 扩容时处理，本文件先登记，不假装已完成。
docs/design/system/spec.md:192:     图标规格溯源自 icon-system-v2 §1–§2 与 v3 QA 第一至七轮；语义色逐值誊自 tokens.css。 -->
docs/design/explorations/design-governance/proposal.md:23:实现层       tokens.css + 组件 CSS（已有，需扩容）
docs/design/explorations/design-governance/proposal.md:47:| 1 | **设计系统总规格** `spec.md`：图标规格、尺寸/间距/字号/圆角/阴影 token 表、语义色、组件模式、L3 判据 | `docs/design/approved/design-system/spec.md` | 新建。收敛三个来源：ui-design-philosophy §3 数值 + icon-system-v2 ICON-GUIDELINES（1.7px/24px 栅格定案，v2/v3 收敛为单一 canonical）+ tokens.css 现状 |
docs/design/explorations/design-governance/proposal.md:48:| 2 | **token 扩容**：补 `--space-1..8`、`--fs-*` 字号阶梯、`--icon-stroke`、`--radius-*` 梯度、`--shadow-*` | `src/styles/tokens.css` | 扩展现有文件 |
docs/design/explorations/design-governance/proposal.md:68:- e2e 视觉断言数值改为**从 tokens.css 读取**（断言「间距 = --space-2」而非「= 8」），规范改了测试不碎，测试永远锚定规范。
docs/design/explorations/design-governance/proposal.md:89:| 2 | tokens.css 扩容 +存量硬编码迁移（可分批，只约束增量） | 中 |
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:33:| A3 | **主题覆盖** | `theme.toml` 白名单覆盖，**仅颜色 token，无装饰主题切换**。无 `themeProvider` 结构、无历史逻辑 | 配置型 | ✅ 已落地，扩展面有限（见 A3 边界） |
docs/design/explorations/design-codex/design-consultation-20260702.md:244:3. **CSS Token 迁移**: 现有 `theme-light.css` 和 `theme-dark.css` 合并为一个 `tokens.css`，用 `:root` 和 `.dark` 区分。这是破坏性修改，需确保所有组件同时迁移。
docs/design/system/governance.md:36:| L2 | canonical spec | `openspec/specs/`（17 域） | 功能怎么算对 |
docs/design/system/governance.md:139:| `--space-16` | 16px | 17 | 区块间间隔 |
docs/design/system/governance.md:162:| `--app-radius` | 6px | **存量**（仅 5 次），不新增使用 |
docs/design/system/governance.md:164:**阴影现存矛盾**：20 处 `box-shadow` 声明 = 6 处纯 token（`--app-shadow` ×5、`--reader-shadow` ×1）+ 4 处 inset 混用 `--app-accent` + 10 处纯字面量（6 种）。规则：新代码一律用 `--app-shadow`，存量不追溯。
docs/design/system/governance.md:170:| `--app-accent` | `#6366f1` | `#818cf8` | `#0071e3` |
docs/design/system/governance.md:171:| `--app-bg` | `#f7f7f6` | `#131316` | `#f2e9da` |
docs/design/system/governance.md:172:| `--app-surface` | `#fbfaf8` | `#1a1b1e` | `#fbf4e8` |
docs/design/system/governance.md:173:| `--app-sunken` | `#f4f2ec` | `#22242a` | `#efe3d0` |
docs/design/system/governance.md:174:| `--app-text` | `#24262b` | `#d8dade` | `#3b3024` |
docs/design/system/governance.md:175:| `--app-text-strong` | `#16181c` | `#eceef1` | `#241c12` |
docs/design/system/governance.md:176:| `--app-text-2` | `#55595f` | `#a7abb3` | `#6b5a45` |
docs/design/system/governance.md:177:| `--app-text-3` | `#8b8f96` | `#75797f` | `#96826a` |
docs/design/system/governance.md:178:| `--app-border` | `#e7e3db` | `#2e3138` | `#e0d2bc` |
docs/design/system/governance.md:179:| `--app-border-strong` | `#d8d3c8` | `#3d4149` | `#cdbca1` |
docs/design/system/governance.md:185:**已知缺口**：错误色无独立 token（现值散落在 `editor.css` / `reader.css`）；`--app-accent-soft` 各主题 alpha 不同（.10 / .14 / .08）。
docs/design/system/governance.md:278:位置：`openspec/specs/`，**17 个域**：
docs/design/system/governance.md:357:| spec ↔ tokens 漂移 | 无 | 本文与 spec 标注为快照 |
docs/design/system/governance.md:391:| tokens.css 扩容 / 存量迁移 | ⬜ 待后续 change | `--space-*` 等尚未定义 |
docs/design/system/governance.md:393:| spec ↔ tokens 漂移检查 | ⬜ 未规划 | — |
docs/design/pluginization-datafile-settings-rail/03-settings-page-optimization.md:179:- 圆角与阴影：§5（`--radius-4` 控件、`--radius-8` 浮层、`--app-shadow`）
docs/design/pluginization-datafile-settings-rail/03-settings-page-optimization.md:180:- 语义色：§6（`--app-accent`、`--app-surface`、`--app-border` 等）
docs/design/explorations/design-governance/retro.md:38:| 实现层（token） | ⚠️ `src/styles/tokens.css` 仅 168 行：颜色 + 1 个 radius。间距/字号/图标线长全缺，editor.css（2611 行）大量硬编码 |
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:20:- **用户层目录是 AGENT 写入口**：`user/` 是核心写入口，扩展点目录（snippets/templates/theme.toml）也在用户层，但不在 `user/` 子目录下——边界表述按此校正。
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:33:| `snippets/*.md`、`templates/*.md`、`theme.toml` | 扩展点数据文件 | 位于 `app_config_dir()` 根，用户层 |
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:54:| 主题覆盖 | `theme.toml`（白名单 13 个 `--app-*` token，是 `tokens.css` 17 个的子集） | 主题注入 | ✅ 已落地 |
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:102:app_config_dir 根：snippets/ templates/ theme.toml   扩展点（用户层，不在 user/ 子目录）
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:130:- 每个 B 档文件规定**加载端契约**：加载失败/非法时的语义——**回退默认 + 聚合告警**（对齐 `theme.toml` 的白名单过滤纪律）。
docs/design/pluginization-datafile-settings-rail/04-document-discovery-and-plugin-display.md:78:**数据基础修正（原方案误判）**：变体 B 的「frontmatter 标签」数据基础**当前不存在**——`RecentFile` 只有 path/title/openedAt/excerpt（`src/types/index.ts:178-184`），**无标签模型、无标签索引**，frontmatter 解析是通用 YAML、无 tags 字段约定。网格现有「主题」分组是按父目录，不是标签。
docs/design/pluginization-datafile-settings-rail/04-document-discovery-and-plugin-display.md:111:**「第 1 项会提取出较多插件」不成立**：01 号文档 A 档用户可见插件仅 4 项（片段/模板/theme.toml/SKILL.md 包），B 档目前还是代码常量、需另立批次文件化。展示策略不建立在「插件很多」的夸大前提上。
docs/design/explorations/capture-overlay/capture-overlay-问题及想法记录-1.md:27:17. 提交动画：你说提交内容向上飞出，你的设计理由，为何不是向下的下载完成动画。
docs/design/approved/selection-roulette/prototype.html:8:/* ── 设计 token（誊自 src/styles/tokens.css 三主题） ───────────── */
docs/design/approved/selection-roulette/prototype.html:10:  --app-accent:#6366f1; --app-accent-soft:rgba(99,102,241,.10);
docs/design/approved/selection-roulette/prototype.html:11:  --app-bg:#f7f7f6; --app-surface:#fbfaf8; --app-sunken:#f4f2ec;
docs/design/approved/selection-roulette/prototype.html:12:  --app-text:#24262b; --app-text-strong:#16181c; --app-text-2:#55595f; --app-text-3:#8b8f96;
docs/design/approved/selection-roulette/prototype.html:13:  --app-border:#e7e3db; --app-border-strong:#d8d3c8;
docs/design/approved/selection-roulette/prototype.html:14:  --app-shadow:0 8px 24px rgba(31,26,20,.12);
docs/design/approved/selection-roulette/prototype.html:17:  --app-accent:#818cf8; --app-accent-soft:rgba(129,140,248,.14);
docs/design/approved/selection-roulette/prototype.html:18:  --app-bg:#131316; --app-surface:#1a1b1e; --app-sunken:#22242a;
docs/design/approved/selection-roulette/prototype.html:19:  --app-text:#d8dade; --app-text-strong:#eceef1; --app-text-2:#a7abb3; --app-text-3:#75797f;
docs/design/approved/selection-roulette/prototype.html:20:  --app-border:#2e3138; --app-border-strong:#3d4149;
docs/design/approved/selection-roulette/prototype.html:21:  --app-shadow:0 8px 24px rgba(0,0,0,.42);
docs/design/approved/selection-roulette/prototype.html:24:  --app-accent:#0071e3; --app-accent-soft:rgba(0,113,227,.08);
docs/design/approved/selection-roulette/prototype.html:25:  --app-bg:#f2e9da; --app-surface:#fbf4e8; --app-sunken:#efe3d0;
docs/design/approved/selection-roulette/prototype.html:26:  --app-text:#3b3024; --app-text-strong:#241c12; --app-text-2:#6b5a45; --app-text-3:#96826a;
docs/design/approved/selection-roulette/prototype.html:27:  --app-border:#e0d2bc; --app-border-strong:#cdbca1;
docs/design/approved/selection-roulette/prototype.html:28:  --app-shadow:0 8px 24px rgba(76,58,32,.14);
docs/design/approved/selection-roulette/prototype.html:36:  background:var(--app-bg);
docs/design/approved/selection-roulette/prototype.html:37:  color:var(--app-text);
docs/design/approved/selection-roulette/prototype.html:48:  background:var(--app-surface);
docs/design/approved/selection-roulette/prototype.html:49:  border-bottom:1px solid var(--app-border);
docs/design/approved/selection-roulette/prototype.html:51:.brand { display:flex; align-items:center; gap:8px; font-size:13px; font-weight:600; color:var(--app-text-strong); letter-spacing:.02em; }
docs/design/approved/selection-roulette/prototype.html:54:  background:var(--app-accent);
docs/design/approved/selection-roulette/prototype.html:59:  border:1.7px solid var(--app-surface); border-left-color:transparent; border-radius:2px;
docs/design/approved/selection-roulette/prototype.html:62:  font-size:12px; color:var(--app-text-2);
docs/design/approved/selection-roulette/prototype.html:63:  padding-left:12px; border-left:1px solid var(--app-border);
docs/design/approved/selection-roulette/prototype.html:66:.themes { margin-left:auto; display:flex; gap:2px; padding:2px; background:var(--app-sunken); border-radius:999px; }
docs/design/approved/selection-roulette/prototype.html:70:  background:transparent; color:var(--app-text-3); cursor:pointer;
docs/design/approved/selection-roulette/prototype.html:72:.themes button.on { background:var(--app-accent-soft); color:var(--app-accent); font-weight:600; }
docs/design/approved/selection-roulette/prototype.html:85:  background:var(--app-surface);
docs/design/approved/selection-roulette/prototype.html:86:  border:1px solid var(--app-border);
docs/design/approved/selection-roulette/prototype.html:88:  box-shadow:var(--app-shadow);
docs/design/approved/selection-roulette/prototype.html:90:  font-size:17px; line-height:1.78;
docs/design/approved/selection-roulette/prototype.html:91:  color:var(--app-text);
docs/design/approved/selection-roulette/prototype.html:93:  caret-color:var(--app-accent);
docs/design/approved/selection-roulette/prototype.html:95:.paper ::selection { background:color-mix(in srgb, var(--app-accent) 22%, transparent); }
docs/design/approved/selection-roulette/prototype.html:96:.paper h1 { font-size:26px; line-height:1.35; font-weight:600; margin:0 0 22px; color:var(--app-text-strong); letter-spacing:-.01em; }
docs/design/approved/selection-roulette/prototype.html:97:.paper h2 { font-size:19px; line-height:1.45; font-weight:600; margin:34px 0 12px; color:var(--app-text-strong); }
docs/design/approved/selection-roulette/prototype.html:104:  width:12px; height:12px; border:1.5px solid var(--app-border-strong); border-radius:3px;
docs/design/approved/selection-roulette/prototype.html:108:  border-left:2px solid var(--app-border-strong); color:var(--app-text-2);
docs/design/approved/selection-roulette/prototype.html:112:  background:var(--app-sunken); border:1px solid var(--app-border); border-radius:8px;
docs/design/approved/selection-roulette/prototype.html:118:  font-size:.88em; padding:1px 4px; border-radius:4px; background:var(--app-sunken);

exec
/bin/zsh -lc "rg -o --no-filename -- '--app-[a-z0-9-]+' src/styles/tokens.css | sort -u; printf '\\ncount: '; rg -o --no-filename -- '--app-[a-z0-9-]+' src/styles/tokens.css | sort -u | wc -l; printf 'whitelist count: '; sed -n '70,84p' src-tauri/src/extensions.rs | rg -o '\"["'^"]+"'"' | wc -l" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
--app-accent
--app-accent-soft
--app-bg
--app-border
--app-border-strong
--app-chrome-bg
--app-chrome-hover
--app-chrome-rest
--app-radius
--app-shadow
--app-sunken
--app-surface
--app-text
--app-text-2
--app-text-3
--app-text-strong

count:       16
whitelist count:       13

exec
/bin/zsh -lc 'rg -n "selectionToolbar|defaultSavePath|defaultNewDocFormat|newdoc|frontmatter|template" src src-tauri/src | head -n 300' in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src-tauri/src/extensions.rs:1://! 用户扩展点（design §D1–D4）：snippets / templates / theme tokens。
src-tauri/src/extensions.rs:36:    pub templates: Vec<Template>,
src-tauri/src/extensions.rs:41:/// frontmatter 值：标量或字符串列表。
src-tauri/src/extensions.rs:127:/// 解析单个 snippet 文件。成功返回 `Some`，失败（缺 id / 非法 frontmatter /
src-tauri/src/extensions.rs:139:        warnings.push(format!("{rel}: 缺少 frontmatter（未以 --- 开头）"));
src-tauri/src/extensions.rs:144:    // 收集 frontmatter 行直到闭合 `---`。
src-tauri/src/extensions.rs:161:        warnings.push(format!("{rel}: frontmatter 未闭合"));
src-tauri/src/extensions.rs:170:            warnings.push(format!("{rel}: 无法解析 frontmatter 行 {line:?}"));
src-tauri/src/extensions.rs:271:/// 扫描 `<dir>/templates/*.md`。文件名（去扩展名）即模板名；重名后读覆盖先读。
src-tauri/src/extensions.rs:272:fn scan_templates(dir: &Path, warnings: &mut Vec<String>) -> Vec<Template> {
src-tauri/src/extensions.rs:273:    let dir = dir.join("templates");
src-tauri/src/extensions.rs:278:            warnings.push(format!("templates: 无法读取目录（{e}）"));
src-tauri/src/extensions.rs:283:    let mut templates: BTreeMap<String, Template> = BTreeMap::new();
src-tauri/src/extensions.rs:293:        let rel = format!("templates/{name}");
src-tauri/src/extensions.rs:302:        templates.insert(
src-tauri/src/extensions.rs:311:    templates.into_values().collect()
src-tauri/src/extensions.rs:369:    let templates = scan_templates(config_dir, &mut warnings);
src-tauri/src/extensions.rs:374:        templates,
src-tauri/src/extensions.rs:398:    fn parses_snippet_and_template() {
src-tauri/src/extensions.rs:406:        write_file(base, "templates/日记.md", "# {{title}}\n{{date}}\n");
src-tauri/src/extensions.rs:419:        assert_eq!(snapshot.templates.len(), 1);
src-tauri/src/extensions.rs:420:        assert_eq!(snapshot.templates[0].name, "日记");
src-tauri/src/extensions.rs:421:        assert_eq!(snapshot.templates[0].body, "# {{title}}\n{{date}}\n");
src-tauri/src/extensions.rs:460:    fn invalid_frontmatter_is_skipped() {
src-tauri/src/extensions.rs:464:        write_file(base, "snippets/a.md", "id: no-frontmatter\n---\n正文\n");
src-tauri/src/extensions.rs:481:            .any(|w| w.contains("缺少 frontmatter")));
src-tauri/src/extensions.rs:494:        assert!(snapshot.templates.is_empty());
src-tauri/src/extensions.rs:662:    fn template_duplicate_name_last_read_wins() {
src-tauri/src/extensions.rs:667:        write_file(base, "templates/a.md", "A\n");
src-tauri/src/extensions.rs:668:        write_file(base, "templates/b.md", "B\n");
src-tauri/src/extensions.rs:672:        assert_eq!(snapshot.templates.len(), 2);
src-tauri/src/extensions.rs:673:        let names: Vec<_> = snapshot.templates.iter().map(|t| t.name.clone()).collect();
src-tauri/src/extensions.rs:683:        write_file(base, "templates/notes.txt", "正文\n");
src-tauri/src/extensions.rs:688:        assert!(snapshot.templates.is_empty());
src-tauri/src/commands/capture.rs:113:/// 块是否属于给定 time_key 的条目：行级解析 frontmatter 的 time 行并编码比较。
src-tauri/src/commands/capture.rs:250:        let frontmatter = parts.next().unwrap_or("");
src-tauri/src/commands/capture.rs:252:        // split("---\ntime: ") 已吞掉 "time: " 前缀：frontmatter 第一行即为 time 值；
src-tauri/src/commands/capture.rs:254:        let mut lines = frontmatter.lines();
src-tauri/src/commands/search.rs:31:    /// frontmatter title 优先，缺省用文件名。
src-tauri/src/commands/search.rs:80:/// 取 YAML frontmatter 里的 `title:`（不含引号）。无 frontmatter 或无 title 时返回 None。
src-tauri/src/commands/search.rs:81:fn frontmatter_title(text: &str) -> Option<String> {
src-tauri/src/commands/search.rs:205:    let title = frontmatter_title(&raw).unwrap_or_else(|| filename.clone());
src-tauri/src/commands/search.rs:259:/// 本机全文检索：文件名 / frontmatter title / H1 / 正文，大小写不敏感，限量返回。
src/lib/frontmatter.ts:4: * 文档 frontmatter 解析 / 序列化（doc-property-panel 功能一）。
src/lib/frontmatter.ts:476: * - 无 frontmatter 时在文档首部新建 `--- ... ---` 块。
src/lib/frontmatter.ts:538: * 用 `new Pair` 插到指定位置。无 frontmatter 时退化为新建块（同 writeFrontmatter）。
src/lib/frontmatter.ts:723:  if (!parsed.present) return { ok: false, reason: "文档没有 frontmatter" };
src/lib/export/docx.ts:1:// 导出 Word：剥离 frontmatter → 组装 files Map → vendor toDocx → base64 → 主进程写盘。
src-tauri/src/commands/config_cmd.rs:56:/// Scan user extension directories (snippets / templates / theme.toml).
src/types/index.ts:73:  defaultSavePath?: string | null;
src/types/index.ts:75:  selectionToolbar?: "roulette" | "capsule";
src/types/index.ts:163:  /** frontmatter title 优先，缺省为文件名 */
src/lib/export/mdpkg.ts:41: * 组装包内文件：入口 Markdown 逐字保留（含 frontmatter），资产按原引用路径写入。
src/stores/docPropertyPanel.ts:16:  /** 面板显隐。隐藏只改显示，不改文档内容（数据仍在 frontmatter 里）。 */
src/renderers/markdown.ts:193:// 文档开头的 YAML frontmatter：Obsidian 阅读视图默认隐藏，不参与渲染。
src/renderers/markdown.ts:776:    const tpl = doc.createElement("template");
src/App.tsx:49:} from "./lib/extensions/templates";
src/App.tsx:50:import type { Template } from "./lib/extensions/templates";
src/App.tsx:85:  const [templates, setTemplates] = useState<Template[]>([]);
src/App.tsx:190:          defaultDir: useEditorStore.getState().config.defaultSavePath ?? null,
src/App.tsx:215:    if (templates.length > 0) {
src/App.tsx:220:  }, [templates]);
src/App.tsx:226:      setTemplates(bundle.templates);
src/App.tsx:261:  const handleTemplateSelect = useCallback((template: Template) => {
src/App.tsx:263:      template.name,
src/App.tsx:264:      applyTemplatePlaceholders(template.body, {
src/App.tsx:265:        title: template.name,
src/App.tsx:992:      {pickerOpen && templates.length > 0 && (
src/App.tsx:994:          templates={templates}
src/lib/extensions/templates.ts:3: * `list_extensions` 返回的 `templates[]` 元素形状；正文里的占位符仅两个：
src/lib/extensions/bundle.ts:1:/* 扩展 bundle：一次 `list_extensions` 调用拿回 templates + theme tokens + warnings。
src/lib/extensions/bundle.ts:9:import type { Template } from "./templates";
src/lib/extensions/bundle.ts:14:  templates: Template[];
src/lib/extensions/bundle.ts:22:  templates: Template[];
src/lib/extensions/bundle.ts:30:/** 宽松解析单个 template；缺 `name`/`body` 或类型不对返回 null。 */
src/lib/extensions/bundle.ts:43:  const templates = result.templates;
src/lib/extensions/bundle.ts:44:  if (!Array.isArray(templates)) return [];
src/lib/extensions/bundle.ts:46:  for (const entry of templates) {
src/lib/extensions/bundle.ts:47:    const template = toTemplate(entry);
src/lib/extensions/bundle.ts:48:    if (template !== null) out.push(template);
src/lib/extensions/bundle.ts:78:    templates: extractTemplates(result),
src/lib/extensions/bundle.ts:95:    return { templates: [], themeTokens: {}, warnings: [] };
src/lib/extensions/bundle.ts:100: * 调一次 `list_extensions`，解析 snippets / templates / theme tokens 三类。
src/lib/extensions/bundle.ts:111:      templates: bundle.templates,
src/lib/extensions/bundle.ts:115:    return { snippets: [], templates: [], themeTokens: {} };
src/styles/doc-property.css:308:  grid-template-columns: 16px 30px 92px minmax(0, 1fr) 18px;
src/styles/reader.css:123:  grid-template-columns: repeat(1, minmax(0, 1fr));
src/styles/reader.css:127:  grid-template-columns: repeat(2, minmax(0, 1fr));
src/styles/reader.css:131:  grid-template-columns: repeat(3, minmax(0, 1fr));
src/styles/reader.css:135:  grid-template-columns: repeat(4, minmax(0, 1fr));
src/styles/reader.css:139:  grid-template-columns: repeat(5, minmax(0, 1fr));
src/styles/reader.css:143:  grid-template-columns: repeat(6, minmax(0, 1fr));
src/styles/reader.css:152:    grid-template-columns: minmax(0, 1fr);
src/hooks/useConfig.ts:49:  defaultSavePath?: string | null;
src/hooks/useConfig.ts:155:    defaultSavePath: es.config.defaultSavePath ?? null,
src/hooks/useConfig.ts:397:    defaultSavePath: raw.defaultSavePath ?? null,
src/styles/editor.css:1702:  grid-template-columns: minmax(0, 1fr);
src/styles/editor.css:1825:  grid-template-columns: repeat(5, minmax(0, 1fr));
src/styles/editor.css:1891:  grid-template-columns: repeat(5, minmax(0, 1fr));
src/styles/editor.css:2395:  grid-template-columns: repeat(8, 1fr);
src/styles/editor.css:2734:  grid-template-columns: repeat(5, 1fr);
src/editors/orchestration/floating-toolbar.ts:691:      const mode = useEditorStore.getState().config.selectionToolbar;
src/editors/orchestration/floating-toolbar.ts:776:        if (useEditorStore.getState().config.selectionToolbar !== "capsule") {
src/editors/user-extensions.ts:7: * 模板与主题 token 的前端接入见 `src/lib/extensions/`（bundle / templates /
src/lib/mdpkg/vendor/mdpkg-web.js:10559:   * @template {keyof Data} Key
src/lib/mdpkg/vendor/mdpkg-web.js:10971:   * @template {Array<unknown>} [Parameters=[]]
src/lib/mdpkg/vendor/mdpkg-web.js:10972:   * @template {Node | string | undefined} [Input=undefined]
src/lib/mdpkg/vendor/mdpkg-web.js:10973:   * @template [Output=Input]
src/lib/mdpkg/vendor/mdpkg-web.js:15963:  // Note: overloads in JSDoc can’t yet use different `@template`s.
src/lib/mdpkg/vendor/mdpkg-web.js:22938:  return !head2 || head2.type !== "comment" && !(head2.type === "text" && whitespace(head2.value.charAt(0))) && !(head2.type === "element" && (head2.tagName === "meta" || head2.tagName === "link" || head2.tagName === "script" || head2.tagName === "style" || head2.tagName === "template"));
src/lib/mdpkg/vendor/mdpkg-web.js:22992:    schema.space === "html" && node2.tagName === "template" ? node2.content : node2
src/__tests__/renderers/structural-tags.test.ts:6: * YAML frontmatter → 独占一行的未知结构标签 → 紧接的标题 / 表格。
src/__tests__/renderers/structural-tags.test.ts:37:| template-structure.md | 模板章节结构详解 |
src/__tests__/frontmatter.test.ts:22:} from "../lib/frontmatter";
src/__tests__/frontmatter.test.ts:43:describe("frontmatter parse", () => {
src/__tests__/frontmatter.test.ts:106:  it("无 frontmatter", () => {
src/__tests__/frontmatter.test.ts:130:  it("无 frontmatter 时创建块", () => {
src/__tests__/frontmatter.test.ts:425:  it("字段不存在 / 无 frontmatter 被拒绝", () => {
src/__tests__/frontmatter.test.ts:603:  it("无 frontmatter 时新建块", () => {
src/components/SettingsView.tsx:616:  const selectionToolbar = useEditorStore(
src/components/SettingsView.tsx:617:    (s) => s.config.selectionToolbar ?? "roulette",
src/components/SettingsView.tsx:643:  const defaultSavePath = useEditorStore(
src/components/SettingsView.tsx:644:    (s) => s.config.defaultSavePath ?? null,
src/components/SettingsView.tsx:892:      setConfig({ defaultSavePath: dir });
src/components/SettingsView.tsx:900:    setConfig({ defaultSavePath: null });
src/components/SettingsView.tsx:915:    setConfig({ selectionToolbar: mode });
src/components/SettingsView.tsx:1393:                      aria-pressed={selectionToolbar === option.value}
src/components/SettingsView.tsx:1396:                        selectionToolbar === option.value
src/components/SettingsView.tsx:2254:                  title={defaultSavePath ?? ""}
src/components/SettingsView.tsx:2256:                  {defaultSavePath || "未设置（使用系统默认位置）"}
src/components/SettingsView.tsx:2271:                    disabled={!defaultSavePath}
src/components/Content/DocPropertyBar.tsx:32:} from "../../lib/frontmatter";
src/components/Content/DocPropertyBar.tsx:1493:        暂无 frontmatter 属性 · 首次添加字段时自动创建
src/components/Content/VideoPlayer.tsx:264:    const tpl = artRef.current?.template as unknown as
src/components/Content/VideoPlayer.tsx:1218:      const rect = art.template.$player.getBoundingClientRect();
src/components/Content/VideoPlayer.tsx:1249:      const player = art.template.$player;
src/components/TemplatePicker.tsx:3:import type { Template } from "../lib/extensions/templates";
src/components/TemplatePicker.tsx:6:  templates: Template[];
src/components/TemplatePicker.tsx:7:  onSelect: (template: Template) => void;
src/components/TemplatePicker.tsx:17:  templates,
src/components/TemplatePicker.tsx:45:        data-testid="template-picker"
src/components/TemplatePicker.tsx:55:          {templates.map((template) => (
src/components/TemplatePicker.tsx:56:            <li key={template.path}>
src/components/TemplatePicker.tsx:59:                data-testid="template-item"
src/components/TemplatePicker.tsx:61:                onClick={() => onSelect(template)}
src/components/TemplatePicker.tsx:63:                {template.name}
src/components/TemplatePicker.tsx:70:              data-testid="template-blank"
src/__tests__/editor/user-extensions.test.ts:64:      templates: [],
src/__tests__/docsGovernanceGate.test.ts:110:  it("缺必需 frontmatter 字段 → frontmatter 违例且门禁失败", () => {
src/__tests__/docsGovernanceGate.test.ts:121:    expect(res.byRule[RULE.frontmatter] || 0).toBeGreaterThan(0);
src/__tests__/editor/structural-tags-decorations.test.ts:4: * 真实 SKILL.md 形态：frontmatter + 中文正文 + 围栏代码 + 多个 <tag> 包裹分节。
src/__tests__/exportDocx.test.ts:38:  it("没有 frontmatter 时不动", () => {
src/__tests__/exportDocx.test.ts:42:  it("正文中间的 --- 分隔线不当成 frontmatter", () => {
src/__tests__/exportDocx.test.ts:77:  it("frontmatter 不进正文，图片随文档内联", async () => {
src/__tests__/markdownRender.test.ts:285:describe("renderMarkdown YAML frontmatter", () => {
src/__tests__/markdownRender.test.ts:286:  it("文档开头的 frontmatter 不参与渲染（Obsidian 阅读视图默认隐藏）", () => {
src/__tests__/markdownRender.test.ts:294:  it("带 BOM 前缀的 frontmatter 同样剥离", () => {
src/__tests__/markdownRender.test.ts:300:  it("非 frontmatter 的 --- 水平线仍正常渲染", () => {
src/__tests__/lib/frontmatterCollections.test.ts:8:} from "../../lib/frontmatter";
src/__tests__/lib/templates.test.ts:6:} from "../../lib/extensions/templates";
src/__tests__/lib/templates.test.ts:78:    const template: Template = {
src/__tests__/lib/templates.test.ts:81:      path: "/Users/test/.config/clairis/templates/日记.md",
src/__tests__/lib/templates.test.ts:83:    expect(template.path).toContain("templates");
src/__tests__/lib/templates.test.ts:88:  it("一次调用解析 templates 与 theme tokens", async () => {
src/__tests__/lib/templates.test.ts:91:      templates: [{ name: "日记", body: "# {{title}}", path: "/x/日记.md" }],
src/__tests__/lib/templates.test.ts:95:    expect(snapshot.templates).toEqual([
src/__tests__/lib/templates.test.ts:105:        templates: [],
src/__tests__/lib/templates.test.ts:109:    ).resolves.toMatchObject({ templates: [] });
src/__tests__/lib/templates.test.ts:117:    ).resolves.toEqual({ snippets: [], templates: [], themeTokens: {} });
src/__tests__/lib/templates.test.ts:123:      templates: [],

exec
/bin/zsh -lc "rg -n \"readerFontSize|readerWidth|readerSkin|fontSize|defaultSavePath|rouletteSectors|htmlToolbarItems|translationProvider|langPair|capabilities\" src/components/SettingsView.tsx | head -n 200; nl -ba src/components/SettingsView.tsx | sed -n '150,180p;1350,1430p;1820,1920p;2225,2290p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
14:} from "../lib/capabilities";
36:} from "../lib/readerWidth";
610:  const [capabilities, setCapabilities] = useState(listCapabilities);
614:  const readerFontSize = useEditorStore((s) => s.config.readerFontSize ?? 17);
615:  const readerWidth = useEditorStore((s) => s.config.readerWidth ?? 1080);
627:  const rouletteSectors = useEditorStore(
628:    (s) => s.config.rouletteSectors ?? null,
639:  const htmlToolbarItems = useEditorStore(
640:    (s) => s.config.htmlToolbarItems ?? null,
642:  const readerSkin = useEditorStore((s) => s.config.readerSkin ?? "paper");
643:  const defaultSavePath = useEditorStore(
644:    (s) => s.config.defaultSavePath ?? null,
646:  const fontSize = useEditorStore((s) => s.fontSize);
831:    setConfig({ readerFontSize: size });
875:    setConfig({ fontSize: size });
884:    setConfig({ readerWidth: width });
892:      setConfig({ defaultSavePath: dir });
900:    setConfig({ defaultSavePath: null });
907:    setConfig({ readerWidth: width });
966:    rouletteSectors ?? ROULETTE_SECTOR_META.map((m) => m.id);
968:    setConfig({ rouletteSectors: next.length > 0 ? next : null });
989:    setConfig({ rouletteSectors: null });
994:    htmlToolbarItems ?? HTML_TOOLBAR_ITEMS.map((item) => item.id);
996:    setConfig({ htmlToolbarItems: next.length > 0 ? next : null });
1019:    setConfig({ htmlToolbarItems: null });
1024:    setConfig({ readerSkin: skin });
1243:                    const selected = readerFontSize === size;
1354:                    const selected = fontSize === size;
1638:                  {capabilities.map((capability) => (
1840:                    const selected = readerWidth === option.value;
1868:                      Math.max(READER_WIDTH_MIN, readerWidth),
1881:                    {readerWidth}px
1892:                    const selected = readerSkin === tone.id;
2254:                  title={defaultSavePath ?? ""}
2256:                  {defaultSavePath || "未设置（使用系统默认位置）"}
2271:                    disabled={!defaultSavePath}
   150	function parseNoticeDuration(text: string): NoticeDurationParse {
   151	  const trimmed = text.trim();
   152	  if (!trimmed) return { kind: "default" };
   153	  const value = Number(trimmed);
   154	  if (!Number.isFinite(value)) return { kind: "invalid" };
   155	  if (value < NOTICE_DURATION_MIN || value > NOTICE_DURATION_MAX) {
   156	    return { kind: "invalid" };
   157	  }
   158	  if (Math.abs(value * 10 - Math.round(value * 10)) > 1e-9) {
   159	    return { kind: "invalid" };
   160	  }
   161	  return { kind: "valid", value };
   162	}
   163	
   164	const READER_TONES = [
   165	  { id: "paper", label: "纸墨", swatch: "#1f1d1a" },
   166	  { id: "indigo", label: "靛青", swatch: "#2b4a7d" },
   167	  { id: "moss", label: "松绿", swatch: "#2f5d3f" },
   168	  { id: "clay", label: "赭石", swatch: "#8a4b2a" },
   169	] as const;
   170	
   171	const ROULETTE_SECTOR_META = [
   172	  { id: "smart", label: "智能" },
   173	  { id: "convert", label: "转换" },
   174	  { id: "align", label: "对齐" },
   175	  { id: "columns", label: "分栏" },
   176	  { id: "history", label: "历史" },
   177	  { id: "clear", label: "清格" },
   178	  { id: "format", label: "格式" },
   179	  { id: "color", label: "颜色" },
   180	] as const;
  1350	                  编辑器字号
  1351	                </h2>
  1352	                <div className="flex flex-wrap gap-2">
  1353	                  {FONT_SIZES.map((size) => {
  1354	                    const selected = fontSize === size;
  1355	                    return (
  1356	                      <button
  1357	                        key={size}
  1358	                        type="button"
  1359	                        data-testid={`editor-font-size-${size}`}
  1360	                        aria-pressed={selected}
  1361	                        onClick={() => chooseEditorFontSize(size)}
  1362	                        className={`rounded border px-3 py-1.5 text-sm ${
  1363	                          selected
  1364	                            ? "border-[var(--app-accent)] bg-[var(--app-accent-soft)] text-[var(--app-accent)]"
  1365	                            : "border-[var(--app-border)] text-[var(--app-text-2)] hover:bg-[var(--app-sunken)]"
  1366	                        }`}
  1367	                      >
  1368	                        {size}
  1369	                      </button>
  1370	                    );
  1371	                  })}
  1372	                </div>
  1373	              </section>
  1374	
  1375	              <section>
  1376	                <h2 className="mb-1 text-sm font-medium text-[var(--app-text-strong)]">
  1377	                  选区工具条
  1378	                </h2>
  1379	                <p className="mb-2 text-xs text-[var(--app-text-3)]">
  1380	                  选中文字后出现的工具条形态。胶囊把高频动作放在靠近指针的一行。
  1381	                </p>
  1382	                <div className="flex flex-wrap gap-2">
  1383	                  {(
  1384	                    [
  1385	                      { value: "roulette", label: "轮盘" },
  1386	                      { value: "capsule", label: "胶囊" },
  1387	                    ] as const
  1388	                  ).map((option) => (
  1389	                    <button
  1390	                      key={option.value}
  1391	                      type="button"
  1392	                      data-testid={`selection-toolbar-${option.value}`}
  1393	                      aria-pressed={selectionToolbar === option.value}
  1394	                      onClick={() => chooseSelectionToolbar(option.value)}
  1395	                      className={`rounded border px-3 py-1.5 text-sm ${
  1396	                        selectionToolbar === option.value
  1397	                          ? "border-[var(--app-accent)] bg-[var(--app-accent-soft)] text-[var(--app-accent)]"
  1398	                          : "border-[var(--app-border)] text-[var(--app-text-2)] hover:bg-[var(--app-sunken)]"
  1399	                      }`}
  1400	                    >
  1401	                      {option.label}
  1402	                    </button>
  1403	                  ))}
  1404	                </div>
  1405	              </section>
  1406	
  1407	              <section data-testid="settings-notice-duration-section">
  1408	                <h2 className="mb-1 text-sm font-medium text-[var(--app-text-strong)]">
  1409	                  提示时长
  1410	                </h2>
  1411	                <p className="mb-2 text-xs text-[var(--app-text-3)]">
  1412	                  提示信息显示时长（秒）：悬停提示与底部提示
  1413	                </p>
  1414	                <input
  1415	                  type="number"
  1416	                  step={NOTICE_DURATION_STEP}
  1417	                  min={NOTICE_DURATION_MIN}
  1418	                  max={NOTICE_DURATION_MAX}
  1419	                  value={noticeText}
  1420	                  placeholder="3.0"
  1421	                  onChange={onNoticeDurationChange}
  1422	                  onBlur={commitNoticeDuration}
  1423	                  onKeyDown={(e) => {
  1424	                    if (e.key === "Enter") {
  1425	                      e.preventDefault();
  1426	                      commitNoticeDuration();
  1427	                      e.currentTarget.blur();
  1428	                    }
  1429	                  }}
  1430	                  data-testid="settings-notice-duration"
  1820	                    }}
  1821	                    className="mt-0.5"
  1822	                  />
  1823	                  <span>
  1824	                    <span className="block text-sm text-[var(--app-text)]">
  1825	                      固定隐藏左边栏
  1826	                    </span>
  1827	                    <span className="block text-xs text-[var(--app-text-3)]">
  1828	                      隐藏后鼠标滑入触发区也不显示，左侧箭头彻底消失；取消固定后箭头恢复，滑入自动显示
  1829	                    </span>
  1830	                  </span>
  1831	                </label>
  1832	              </section>
  1833	
  1834	              <section>
  1835	                <h2 className="mb-2 text-sm font-medium text-[var(--app-text-strong)]">
  1836	                  行宽
  1837	                </h2>
  1838	                <div className="flex flex-wrap gap-2">
  1839	                  {READER_WIDTH_PRESETS.map((option) => {
  1840	                    const selected = readerWidth === option.value;
  1841	                    return (
  1842	                      <button
  1843	                        key={option.value}
  1844	                        type="button"
  1845	                        data-testid={`reader-width-${option.value}`}
  1846	                        aria-pressed={selected}
  1847	                        onClick={() => chooseReaderWidth(option.value)}
  1848	                        className={`rounded border px-3 py-1.5 text-sm ${
  1849	                          selected
  1850	                            ? "border-[var(--app-accent)] bg-[var(--app-accent-soft)] text-[var(--app-accent)]"
  1851	                            : "border-[var(--app-border)] text-[var(--app-text-2)] hover:bg-[var(--app-sunken)]"
  1852	                        }`}
  1853	                      >
  1854	                        {option.label}
  1855	                      </button>
  1856	                    );
  1857	                  })}
  1858	                </div>
  1859	                <div className="mt-3 flex items-center gap-3">
  1860	                  <input
  1861	                    type="range"
  1862	                    data-testid="reader-width-range"
  1863	                    min={READER_WIDTH_MIN}
  1864	                    max={READER_WIDTH_MAX}
  1865	                    step={READER_WIDTH_STEP}
  1866	                    value={Math.min(
  1867	                      READER_WIDTH_MAX,
  1868	                      Math.max(READER_WIDTH_MIN, readerWidth),
  1869	                    )}
  1870	                    aria-label="正文行宽"
  1871	                    onChange={(e) => previewReaderWidth(Number(e.target.value))}
  1872	                    onPointerUp={commitReaderWidth}
  1873	                    onKeyUp={commitReaderWidth}
  1874	                    onBlur={commitReaderWidth}
  1875	                    className="h-1 w-full cursor-pointer accent-[var(--app-accent)]"
  1876	                  />
  1877	                  <span
  1878	                    data-testid="reader-width-value"
  1879	                    className="w-16 shrink-0 text-right text-xs tabular-nums text-[var(--app-text-2)]"
  1880	                  >
  1881	                    {readerWidth}px
  1882	                  </span>
  1883	                </div>
  1884	              </section>
  1885	
  1886	              <section>
  1887	                <h2 className="mb-2 text-sm font-medium text-[var(--app-text-strong)]">
  1888	                  配色
  1889	                </h2>
  1890	                <div className="flex flex-wrap gap-2">
  1891	                  {READER_TONES.map((tone) => {
  1892	                    const selected = readerSkin === tone.id;
  1893	                    return (
  1894	                      <button
  1895	                        key={tone.id}
  1896	                        type="button"
  1897	                        data-testid={`reader-tone-${tone.id}`}
  1898	                        aria-pressed={selected}
  1899	                        onClick={() => chooseReaderSkin(tone.id)}
  1900	                        className={`flex items-center rounded border px-3 py-1.5 text-sm ${
  1901	                          selected
  1902	                            ? "border-[var(--app-accent)] bg-[var(--app-accent-soft)] text-[var(--app-accent)]"
  1903	                            : "border-[var(--app-border)] text-[var(--app-text-2)] hover:bg-[var(--app-sunken)]"
  1904	                        }`}
  1905	                      >
  1906	                        <span
  1907	                          className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full border border-black/15"
  1908	                          style={{ background: tone.swatch }}
  1909	                        />
  1910	                        {tone.label}
  1911	                      </button>
  1912	                    );
  1913	                  })}
  1914	                </div>
  1915	              </section>
  1916	
  1917	              <section>
  1918	                <h2 className="mb-2 text-sm font-medium text-[var(--app-text-strong)]">
  1919	                  默认布局
  1920	                </h2>
  2225	                        : keyStatus === "empty"
  2226	                          ? "未配置"
  2227	                          : keyStatus === "loading"
  2228	                            ? "读取中…"
  2229	                            : "无法读取钥匙串状态"}
  2230	                    </p>
  2231	                    {keyNotice && (
  2232	                      <p className="text-xs text-[var(--app-accent)]">
  2233	                        {keyNotice}
  2234	                      </p>
  2235	                    )}
  2236	                  </div>
  2237	                )}
  2238	              </section>
  2239	            </div>
  2240	          )}
  2241	
  2242	          {active === "files" && (
  2243	            <section>
  2244	              <h2 className="mb-1 text-sm font-medium text-[var(--app-text-strong)]">
  2245	                新建文档
  2246	              </h2>
  2247	              <p className="mb-2 text-xs text-[var(--app-text-3)]">
  2248	                首次保存新建文档时，保存对话框将以此目录为初始位置。
  2249	              </p>
  2250	              <div className="flex items-center justify-between gap-2 rounded border border-[var(--app-border)] px-3 py-2">
  2251	                <span
  2252	                  className="truncate text-sm text-[var(--app-text)]"
  2253	                  data-testid="default-save-path"
  2254	                  title={defaultSavePath ?? ""}
  2255	                >
  2256	                  {defaultSavePath || "未设置（使用系统默认位置）"}
  2257	                </span>
  2258	                <span className="flex shrink-0 items-center gap-1">
  2259	                  <button
  2260	                    type="button"
  2261	                    data-testid="default-save-pick"
  2262	                    className="rounded border border-[var(--app-border)] px-2 py-1 text-xs hover:bg-[var(--app-sunken)]"
  2263	                    onClick={() => void chooseDefaultSavePath()}
  2264	                  >
  2265	                    选择…
  2266	                  </button>
  2267	                  <button
  2268	                    type="button"
  2269	                    data-testid="default-save-clear"
  2270	                    className="rounded border border-[var(--app-border)] px-2 py-1 text-xs hover:bg-[var(--app-sunken)] disabled:cursor-not-allowed disabled:opacity-45"
  2271	                    disabled={!defaultSavePath}
  2272	                    onClick={clearDefaultSavePath}
  2273	                  >
  2274	                    清除
  2275	                  </button>
  2276	                </span>
  2277	              </div>
  2278	            </section>
  2279	          )}
  2280	
  2281	          {active === "data" && (
  2282	            <section>
  2283	              <h2 className="mb-1 text-sm font-medium text-[var(--app-text-strong)]">
  2284	                配置快照
  2285	              </h2>
  2286	              <p className="mb-2 text-xs text-[var(--app-text-3)]">
  2287	                每次保存配置前自动留存一份，可恢复到任一历史状态。
  2288	              </p>
  2289	              {snapshotsLoading ? (
  2290	                <p className="text-sm text-[var(--app-text-3)]">读取中…</p>

exec
/bin/zsh -lc 'rg -n "template|newTab|new file|new_file|defaultSavePath|pick_folder|save_as|new_document" src src-tauri/src | head -n 300' in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src-tauri/src/extensions.rs:1://! 用户扩展点（design §D1–D4）：snippets / templates / theme tokens。
src-tauri/src/extensions.rs:36:    pub templates: Vec<Template>,
src-tauri/src/extensions.rs:271:/// 扫描 `<dir>/templates/*.md`。文件名（去扩展名）即模板名；重名后读覆盖先读。
src-tauri/src/extensions.rs:272:fn scan_templates(dir: &Path, warnings: &mut Vec<String>) -> Vec<Template> {
src-tauri/src/extensions.rs:273:    let dir = dir.join("templates");
src-tauri/src/extensions.rs:278:            warnings.push(format!("templates: 无法读取目录（{e}）"));
src-tauri/src/extensions.rs:283:    let mut templates: BTreeMap<String, Template> = BTreeMap::new();
src-tauri/src/extensions.rs:293:        let rel = format!("templates/{name}");
src-tauri/src/extensions.rs:302:        templates.insert(
src-tauri/src/extensions.rs:311:    templates.into_values().collect()
src-tauri/src/extensions.rs:369:    let templates = scan_templates(config_dir, &mut warnings);
src-tauri/src/extensions.rs:374:        templates,
src-tauri/src/extensions.rs:398:    fn parses_snippet_and_template() {
src-tauri/src/extensions.rs:406:        write_file(base, "templates/日记.md", "# {{title}}\n{{date}}\n");
src-tauri/src/extensions.rs:419:        assert_eq!(snapshot.templates.len(), 1);
src-tauri/src/extensions.rs:420:        assert_eq!(snapshot.templates[0].name, "日记");
src-tauri/src/extensions.rs:421:        assert_eq!(snapshot.templates[0].body, "# {{title}}\n{{date}}\n");
src-tauri/src/extensions.rs:494:        assert!(snapshot.templates.is_empty());
src-tauri/src/extensions.rs:662:    fn template_duplicate_name_last_read_wins() {
src-tauri/src/extensions.rs:667:        write_file(base, "templates/a.md", "A\n");
src-tauri/src/extensions.rs:668:        write_file(base, "templates/b.md", "B\n");
src-tauri/src/extensions.rs:672:        assert_eq!(snapshot.templates.len(), 2);
src-tauri/src/extensions.rs:673:        let names: Vec<_> = snapshot.templates.iter().map(|t| t.name.clone()).collect();
src-tauri/src/extensions.rs:683:        write_file(base, "templates/notes.txt", "正文\n");
src-tauri/src/extensions.rs:688:        assert!(snapshot.templates.is_empty());
src-tauri/src/commands/file.rs:244:pub async fn save_as_file(
src-tauri/src/commands/file.rs:433:pub async fn pick_folder(app: AppHandle) -> Result<String, AppError> {
src-tauri/src/commands/file.rs:434:    let folder = app.dialog().file().blocking_pick_folder();
src/lib/export/exportDocument.ts:48:    const saved = await invoke<SaveResult>("save_as_file", {
src-tauri/src/lib.rs:19:    import_media_bytes, import_media_file, move_file, open_file, open_file_direct, pick_folder,
src-tauri/src/lib.rs:20:    read_file_base64, reveal_in_finder, save_as_file, save_binary_as_file, save_file,
src-tauri/src/lib.rs:202:            pick_folder,
src-tauri/src/lib.rs:207:            save_as_file,
src-tauri/src/commands/config_cmd.rs:56:/// Scan user extension directories (snippets / templates / theme.toml).
src/App.tsx:49:} from "./lib/extensions/templates";
src/App.tsx:50:import type { Template } from "./lib/extensions/templates";
src/App.tsx:85:  const [templates, setTemplates] = useState<Template[]>([]);
src/App.tsx:187:        const saved = await invoke<{ path: string }>("save_as_file", {
src/App.tsx:190:          defaultDir: useEditorStore.getState().config.defaultSavePath ?? null,
src/App.tsx:215:    if (templates.length > 0) {
src/App.tsx:219:    useStore.getState().newTab();
src/App.tsx:220:  }, [templates]);
src/App.tsx:226:      setTemplates(bundle.templates);
src/App.tsx:261:  const handleTemplateSelect = useCallback((template: Template) => {
src/App.tsx:262:    useStore.getState().newTabWith(
src/App.tsx:263:      template.name,
src/App.tsx:264:      applyTemplatePlaceholders(template.body, {
src/App.tsx:265:        title: template.name,
src/App.tsx:273:    useStore.getState().newTab();
src/App.tsx:514:        store.newTab();
src/App.tsx:992:      {pickerOpen && templates.length > 0 && (
src/App.tsx:994:          templates={templates}
src/types/index.ts:73:  defaultSavePath?: string | null;
src/hooks/useConfig.ts:49:  defaultSavePath?: string | null;
src/hooks/useConfig.ts:155:    defaultSavePath: es.config.defaultSavePath ?? null,
src/hooks/useConfig.ts:397:    defaultSavePath: raw.defaultSavePath ?? null,
src/renderers/markdown.ts:776:    const tpl = doc.createElement("template");
src/hooks/useFile.ts:61:      const result = await invoke<SaveResult>("save_as_file", {
src/__tests__/readingStore.test.ts:32:    useStore.getState().newTab();
src/__tests__/renderers/structural-tags.test.ts:37:| template-structure.md | 模板章节结构详解 |
src/components/TabBar.tsx:864:                  const dir = await invoke<string>("pick_folder");
src/lib/extensions/bundle.ts:1:/* 扩展 bundle：一次 `list_extensions` 调用拿回 templates + theme tokens + warnings。
src/lib/extensions/bundle.ts:9:import type { Template } from "./templates";
src/lib/extensions/bundle.ts:14:  templates: Template[];
src/lib/extensions/bundle.ts:22:  templates: Template[];
src/lib/extensions/bundle.ts:30:/** 宽松解析单个 template；缺 `name`/`body` 或类型不对返回 null。 */
src/lib/extensions/bundle.ts:43:  const templates = result.templates;
src/lib/extensions/bundle.ts:44:  if (!Array.isArray(templates)) return [];
src/lib/extensions/bundle.ts:46:  for (const entry of templates) {
src/lib/extensions/bundle.ts:47:    const template = toTemplate(entry);
src/lib/extensions/bundle.ts:48:    if (template !== null) out.push(template);
src/lib/extensions/bundle.ts:78:    templates: extractTemplates(result),
src/lib/extensions/bundle.ts:95:    return { templates: [], themeTokens: {}, warnings: [] };
src/lib/extensions/bundle.ts:100: * 调一次 `list_extensions`，解析 snippets / templates / theme tokens 三类。
src/lib/extensions/bundle.ts:111:      templates: bundle.templates,
src/lib/extensions/bundle.ts:115:    return { snippets: [], templates: [], themeTokens: {} };
src-tauri/src/extension_packages.rs:822:        "folder" => app.dialog().file().blocking_pick_folder(),
src/__tests__/lib/templates.test.ts:6:} from "../../lib/extensions/templates";
src/__tests__/lib/templates.test.ts:78:    const template: Template = {
src/__tests__/lib/templates.test.ts:81:      path: "/Users/test/.config/clairis/templates/日记.md",
src/__tests__/lib/templates.test.ts:83:    expect(template.path).toContain("templates");
src/__tests__/lib/templates.test.ts:88:  it("一次调用解析 templates 与 theme tokens", async () => {
src/__tests__/lib/templates.test.ts:91:      templates: [{ name: "日记", body: "# {{title}}", path: "/x/日记.md" }],
src/__tests__/lib/templates.test.ts:95:    expect(snapshot.templates).toEqual([
src/__tests__/lib/templates.test.ts:105:        templates: [],
src/__tests__/lib/templates.test.ts:109:    ).resolves.toMatchObject({ templates: [] });
src/__tests__/lib/templates.test.ts:117:    ).resolves.toEqual({ snippets: [], templates: [], themeTokens: {} });
src/__tests__/lib/templates.test.ts:123:      templates: [],
src/components/TemplatePicker.tsx:3:import type { Template } from "../lib/extensions/templates";
src/components/TemplatePicker.tsx:6:  templates: Template[];
src/components/TemplatePicker.tsx:7:  onSelect: (template: Template) => void;
src/components/TemplatePicker.tsx:17:  templates,
src/components/TemplatePicker.tsx:45:        data-testid="template-picker"
src/components/TemplatePicker.tsx:55:          {templates.map((template) => (
src/components/TemplatePicker.tsx:56:            <li key={template.path}>
src/components/TemplatePicker.tsx:59:                data-testid="template-item"
src/components/TemplatePicker.tsx:61:                onClick={() => onSelect(template)}
src/components/TemplatePicker.tsx:63:                {template.name}
src/components/TemplatePicker.tsx:70:              data-testid="template-blank"
src/__tests__/paneTreeStore.test.ts:183:    useStore.getState().newTab(); // path=null
src/components/SettingsView.tsx:643:  const defaultSavePath = useEditorStore(
src/components/SettingsView.tsx:644:    (s) => s.config.defaultSavePath ?? null,
src/components/SettingsView.tsx:890:      const dir = await invoke<string>("pick_folder");
src/components/SettingsView.tsx:892:      setConfig({ defaultSavePath: dir });
src/components/SettingsView.tsx:900:    setConfig({ defaultSavePath: null });
src/components/SettingsView.tsx:2254:                  title={defaultSavePath ?? ""}
src/components/SettingsView.tsx:2256:                  {defaultSavePath || "未设置（使用系统默认位置）"}
src/components/SettingsView.tsx:2271:                    disabled={!defaultSavePath}
src/components/Content/PaneTreeView.tsx:469:          store.newTab();
src/styles/reader.css:123:  grid-template-columns: repeat(1, minmax(0, 1fr));
src/styles/reader.css:127:  grid-template-columns: repeat(2, minmax(0, 1fr));
src/styles/reader.css:131:  grid-template-columns: repeat(3, minmax(0, 1fr));
src/styles/reader.css:135:  grid-template-columns: repeat(4, minmax(0, 1fr));
src/styles/reader.css:139:  grid-template-columns: repeat(5, minmax(0, 1fr));
src/styles/reader.css:143:  grid-template-columns: repeat(6, minmax(0, 1fr));
src/styles/reader.css:152:    grid-template-columns: minmax(0, 1fr);
src/stores/index.ts:285:  newTab: () => void;
src/stores/index.ts:286:  newTabWith: (title: string, content: string) => void;
src/stores/index.ts:621:    const newTabs = leaf.tabs.filter((t) => t !== id);
src/stores/index.ts:625:    if (newTabs.length === 0 && state.paneRoot.type !== "leaf") {
src/stores/index.ts:636:      if (activeTabId === id) activeTabId = newTabs[0] ?? null;
src/stores/index.ts:638:        tabs: newTabs,
src/stores/index.ts:803:  newTab: () => get().newTabWith("未命名", ""),
src/stores/index.ts:805:  newTabWith: (title: string, content: string) => {
src/styles/doc-property.css:308:  grid-template-columns: 16px 30px 92px minmax(0, 1fr) 18px;
src/components/Content/VideoPlayer.tsx:264:    const tpl = artRef.current?.template as unknown as
src/components/Content/VideoPlayer.tsx:1218:      const rect = art.template.$player.getBoundingClientRect();
src/components/Content/VideoPlayer.tsx:1249:      const player = art.template.$player;
src/styles/editor.css:1702:  grid-template-columns: minmax(0, 1fr);
src/styles/editor.css:1825:  grid-template-columns: repeat(5, minmax(0, 1fr));
src/styles/editor.css:1891:  grid-template-columns: repeat(5, minmax(0, 1fr));
src/styles/editor.css:2395:  grid-template-columns: repeat(8, 1fr);
src/styles/editor.css:2734:  grid-template-columns: repeat(5, 1fr);
src/__tests__/editor/user-extensions.test.ts:64:      templates: [],
src/lib/extensions/templates.ts:3: * `list_extensions` 返回的 `templates[]` 元素形状；正文里的占位符仅两个：
src/lib/mdpkg/vendor/mdpkg-web.js:10020:   * *   `VFile` — shallow copies its data over to the new file
src/lib/mdpkg/vendor/mdpkg-web.js:10021:   * *   `object` — all fields are shallow copied over to the new file
src/lib/mdpkg/vendor/mdpkg-web.js:10559:   * @template {keyof Data} Key
src/lib/mdpkg/vendor/mdpkg-web.js:10971:   * @template {Array<unknown>} [Parameters=[]]
src/lib/mdpkg/vendor/mdpkg-web.js:10972:   * @template {Node | string | undefined} [Input=undefined]
src/lib/mdpkg/vendor/mdpkg-web.js:10973:   * @template [Output=Input]
src/lib/mdpkg/vendor/mdpkg-web.js:15963:  // Note: overloads in JSDoc can’t yet use different `@template`s.
src/lib/mdpkg/vendor/mdpkg-web.js:22938:  return !head2 || head2.type !== "comment" && !(head2.type === "text" && whitespace(head2.value.charAt(0))) && !(head2.type === "element" && (head2.tagName === "meta" || head2.tagName === "link" || head2.tagName === "script" || head2.tagName === "style" || head2.tagName === "template"));
src/lib/mdpkg/vendor/mdpkg-web.js:22992:    schema.space === "html" && node2.tagName === "template" ? node2.content : node2
src/editors/user-extensions.ts:7: * 模板与主题 token 的前端接入见 `src/lib/extensions/`（bundle / templates /

exec
/bin/zsh -lc "nl -ba src/components/SettingsView.tsx | sed -n '1450,1605p;1605,1665p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
  1450	                    onKeyDown={(e) => {
  1451	                      if (e.key === "Enter") {
  1452	                        e.preventDefault();
  1453	                        commitRouletteHotkey();
  1454	                        e.currentTarget.blur();
  1455	                      }
  1456	                    }}
  1457	                    data-testid="settings-roulette-hotkey"
  1458	                    className="mt-1 w-full rounded border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-1.5 text-sm text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
  1459	                  />
  1460	                </label>
  1461	                <div className="mt-2 flex flex-wrap gap-2">
  1462	                  {(
  1463	                    [
  1464	                      { value: "hub", label: "圆心" },
  1465	                      { value: "disk", label: "整盘" },
  1466	                    ] as const
  1467	                  ).map((option) => (
  1468	                    <button
  1469	                      key={option.value}
  1470	                      type="button"
  1471	                      data-testid={`settings-roulette-form-${option.value}`}
  1472	                      aria-pressed={rouletteForm === option.value}
  1473	                      onClick={() => chooseRouletteForm(option.value)}
  1474	                      className={`rounded border px-3 py-1.5 text-sm ${
  1475	                        rouletteForm === option.value
  1476	                          ? "border-[var(--app-accent)] bg-[var(--app-accent-soft)] text-[var(--app-accent)]"
  1477	                          : "border-[var(--app-border)] text-[var(--app-text-2)] hover:bg-[var(--app-sunken)]"
  1478	                      }`}
  1479	                    >
  1480	                      {option.label}
  1481	                    </button>
  1482	                  ))}
  1483	                </div>
  1484	              </section>
  1485	
  1486	              <section data-testid="settings-roulette-sectors">
  1487	                <h2 className="mb-1 text-sm font-medium text-[var(--app-text-strong)]">
  1488	                  轮盘扇区
  1489	                </h2>
  1490	                <p className="mb-2 text-xs text-[var(--app-text-3)]">
  1491	                  勾选显示的扇区；上下移动决定顺时针顺序。至少保留一个。
  1492	                </p>
  1493	                <ul className="space-y-1">
  1494	                  {[
  1495	                    ...activeSectors,
  1496	                    ...ROULETTE_SECTOR_META.map((m) => m.id).filter(
  1497	                      (id) => !activeSectors.includes(id),
  1498	                    ),
  1499	                  ].map((id) => {
  1500	                    const label =
  1501	                      ROULETTE_SECTOR_META.find((m) => m.id === id)?.label ??
  1502	                      id;
  1503	                    const included = activeSectors.includes(id);
  1504	                    const idx = activeSectors.indexOf(id);
  1505	                    return (
  1506	                      <li
  1507	                        key={id}
  1508	                        data-testid={`roulette-sector-row-${id}`}
  1509	                        className="flex items-center gap-2 text-sm"
  1510	                      >
  1511	                        <input
  1512	                          type="checkbox"
  1513	                          checked={included}
  1514	                          disabled={included && activeSectors.length <= 1}
  1515	                          onChange={() => toggleSector(id)}
  1516	                          data-testid={`roulette-sector-toggle-${id}`}
  1517	                          className="h-3.5 w-3.5"
  1518	                        />
  1519	                        <span className="flex-1 text-[var(--app-text-2)]">
  1520	                          {label}
  1521	                        </span>
  1522	                        {included && (
  1523	                          <>
  1524	                            <button
  1525	                              type="button"
  1526	                              disabled={idx <= 0}
  1527	                              onClick={() => moveSector(id, -1)}
  1528	                              data-testid={`roulette-sector-up-${id}`}
  1529	                              className="rounded border border-[var(--app-border)] px-1.5 text-xs disabled:opacity-40"
  1530	                            >
  1531	                              ↑
  1532	                            </button>
  1533	                            <button
  1534	                              type="button"
  1535	                              disabled={idx >= activeSectors.length - 1}
  1536	                              onClick={() => moveSector(id, 1)}
  1537	                              data-testid={`roulette-sector-down-${id}`}
  1538	                              className="rounded border border-[var(--app-border)] px-1.5 text-xs disabled:opacity-40"
  1539	                            >
  1540	                              ↓
  1541	                            </button>
  1542	                          </>
  1543	                        )}
  1544	                      </li>
  1545	                    );
  1546	                  })}
  1547	                </ul>
  1548	                <button
  1549	                  type="button"
  1550	                  onClick={resetSectors}
  1551	                  data-testid="roulette-sector-reset"
  1552	                  className="mt-2 rounded border border-[var(--app-border)] px-3 py-1.5 text-sm text-[var(--app-text-2)] hover:bg-[var(--app-sunken)]"
  1553	                >
  1554	                  恢复默认
  1555	                </button>
  1556	              </section>
  1557	
  1558	              <section data-testid="settings-toolbar-items">
  1559	                <h2 className="mb-1 text-sm font-medium text-[var(--app-text-strong)]">
  1560	                  文字工具条
  1561	                </h2>
  1562	                <p className="mb-2 text-xs text-[var(--app-text-3)]">
  1563	                  勾选显示的动作；上下移动决定从左到右的顺序。至少保留一个。
  1564	                </p>
  1565	                <ul className="space-y-1">
  1566	                  {[
  1567	                    ...activeToolbarItems,
  1568	                    ...HTML_TOOLBAR_ITEMS.map((item) => item.id).filter(
  1569	                      (id) => !activeToolbarItems.includes(id),
  1570	                    ),
  1571	                  ].map((id) => {
  1572	                    const label =
  1573	                      HTML_TOOLBAR_ITEMS.find((item) => item.id === id)
  1574	                        ?.label ?? id;
  1575	                    const included = activeToolbarItems.includes(id);
  1576	                    const idx = activeToolbarItems.indexOf(id);
  1577	                    return (
  1578	                      <li
  1579	                        key={id}
  1580	                        data-testid={`toolbar-item-row-${id}`}
  1581	                        className="flex items-center gap-2 text-sm"
  1582	                      >
  1583	                        <input
  1584	                          type="checkbox"
  1585	                          checked={included}
  1586	                          disabled={included && activeToolbarItems.length <= 1}
  1587	                          onChange={() => toggleToolbarItem(id)}
  1588	                          data-testid={`toolbar-item-toggle-${id}`}
  1589	                          className="h-3.5 w-3.5"
  1590	                        />
  1591	                        <span className="flex-1 text-[var(--app-text-2)]">
  1592	                          {label}
  1593	                        </span>
  1594	                        {included && (
  1595	                          <>
  1596	                            <button
  1597	                              type="button"
  1598	                              disabled={idx <= 0}
  1599	                              onClick={() => moveToolbarItem(id, -1)}
  1600	                              data-testid={`toolbar-item-up-${id}`}
  1601	                              className="rounded border border-[var(--app-border)] px-1.5 text-xs disabled:opacity-40"
  1602	                            >
  1603	                              ↑
  1604	                            </button>
  1605	                            <button
  1605	                            <button
  1606	                              type="button"
  1607	                              disabled={idx >= activeToolbarItems.length - 1}
  1608	                              onClick={() => moveToolbarItem(id, 1)}
  1609	                              data-testid={`toolbar-item-down-${id}`}
  1610	                              className="rounded border border-[var(--app-border)] px-1.5 text-xs disabled:opacity-40"
  1611	                            >
  1612	                              ↓
  1613	                            </button>
  1614	                          </>
  1615	                        )}
  1616	                      </li>
  1617	                    );
  1618	                  })}
  1619	                </ul>
  1620	                <button
  1621	                  type="button"
  1622	                  onClick={resetToolbarItems}
  1623	                  data-testid="toolbar-item-reset"
  1624	                  className="mt-2 rounded border border-[var(--app-border)] px-3 py-1.5 text-sm text-[var(--app-text-2)] hover:bg-[var(--app-sunken)]"
  1625	                >
  1626	                  恢复默认
  1627	                </button>
  1628	              </section>
  1629	
  1630	              <section>
  1631	                <h2 className="mb-1 text-sm font-medium text-[var(--app-text-strong)]">
  1632	                  高级
  1633	                </h2>
  1634	                <p className="mb-3 text-xs text-[var(--app-text-3)]">
  1635	                  能力默认全开；关闭后只是不再渲染，文档内容不受影响。
  1636	                </p>
  1637	                <ul className="space-y-2">
  1638	                  {capabilities.map((capability) => (
  1639	                    <li key={capability.id}>
  1640	                      <label className="flex cursor-pointer items-start gap-2">
  1641	                        <input
  1642	                          type="checkbox"
  1643	                          data-testid={`capability-${capability.id}`}
  1644	                          checked={capability.enabled}
  1645	                          onChange={(e) =>
  1646	                            toggleCapability(capability.id, e.target.checked)
  1647	                          }
  1648	                          className="mt-0.5"
  1649	                        />
  1650	                        <span>
  1651	                          <span className="block text-sm text-[var(--app-text)]">
  1652	                            {capability.label}
  1653	                          </span>
  1654	                          <span className="block text-xs text-[var(--app-text-3)]">
  1655	                            {capability.hint}
  1656	                          </span>
  1657	                        </span>
  1658	                      </label>
  1659	                    </li>
  1660	                  ))}
  1661	                </ul>
  1662	              </section>
  1663	
  1664	              <section data-testid="settings-doc-property">
  1665	                <h2 className="mb-1 text-sm font-medium text-[var(--app-text-strong)]">

exec
/bin/zsh -lc 'rg -n "langPair|sourceLang|targetLang|python|openai|ollama|provider" src-tauri/src/config.rs src/hooks/useConfig.ts src/types/index.ts src/components/SettingsView.tsx | head -n 220' in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src/hooks/useConfig.ts:50:  ollamaEndpoint: string | null;
src/hooks/useConfig.ts:51:  openaiEndpoint: string | null;
src/hooks/useConfig.ts:52:  openaiModel: string | null;
src/hooks/useConfig.ts:54:  sourceLang: string | null;
src/hooks/useConfig.ts:55:  targetLang: string | null;
src/hooks/useConfig.ts:156:    ollamaEndpoint: es.config.ollamaEndpoint ?? null,
src/hooks/useConfig.ts:157:    openaiEndpoint: es.config.openaiEndpoint ?? null,
src/hooks/useConfig.ts:158:    openaiModel: es.config.openaiModel ?? null,
src/hooks/useConfig.ts:160:    sourceLang: es.config.langPair?.source ?? null,
src/hooks/useConfig.ts:161:    targetLang: es.config.langPair?.target ?? null,
src/hooks/useConfig.ts:398:    ollamaEndpoint: raw.ollamaEndpoint ?? "http://localhost:11434",
src/hooks/useConfig.ts:399:    openaiEndpoint: raw.openaiEndpoint ?? "https://api.openai.com",
src/hooks/useConfig.ts:400:    openaiModel: raw.openaiModel ?? "gpt-4o-mini",
src/hooks/useConfig.ts:402:      (raw.translationProvider as AppConfig["translationProvider"]) ?? "ollama",
src/hooks/useConfig.ts:403:    langPair: {
src/hooks/useConfig.ts:404:      source: raw.sourceLang ?? "en",
src/hooks/useConfig.ts:405:      target: raw.targetLang ?? "zh-CN",
src/hooks/useConfig.ts:559:        ollamaEndpoint: "http://localhost:11434",
src/hooks/useConfig.ts:560:        openaiEndpoint: "https://api.openai.com",
src/hooks/useConfig.ts:561:        openaiModel: "gpt-4o-mini",
src/hooks/useConfig.ts:562:        translationProvider: "ollama",
src/hooks/useConfig.ts:563:        langPair: { source: "en", target: "zh-CN" },
src-tauri/src/config.rs:21:    pub ollama_endpoint: Option<String>,
src-tauri/src/config.rs:22:    pub openai_endpoint: Option<String>,
src-tauri/src/config.rs:23:    pub openai_model: Option<String>,
src-tauri/src/config.rs:25:    pub openai_api_key: Option<String>,
src-tauri/src/config.rs:26:    pub translation_provider: Option<String>,
src-tauri/src/config.rs:205:            ollama_endpoint: Some("http://localhost:11434".into()),
src-tauri/src/config.rs:206:            openai_endpoint: Some("https://api.openai.com".into()),
src-tauri/src/config.rs:207:            openai_model: Some("gpt-4o-mini".into()),
src-tauri/src/config.rs:208:            openai_api_key: None,
src-tauri/src/config.rs:209:            translation_provider: Some("ollama".into()),
src-tauri/src/config.rs:937:| `openaiEndpoint` / `openaiModel` | 任意字符串 |
src/components/SettingsView.tsx:46:import { PROVIDERS } from "../lib/providers";
src/components/SettingsView.tsx:647:  const openaiEndpoint = useEditorStore((s) => s.config.openaiEndpoint ?? "");
src/components/SettingsView.tsx:648:  const openaiModel = useEditorStore((s) => s.config.openaiModel ?? "");
src/components/SettingsView.tsx:766:      account: "openai",
src/components/SettingsView.tsx:1064:      openaiEndpoint: preset.endpoint,
src/components/SettingsView.tsx:1065:      openaiModel: preset.defaultModel,
src/components/SettingsView.tsx:1081:        account: "openai",
src/components/SettingsView.tsx:1100:        account: "openai",
src/components/SettingsView.tsx:2097:                  {PROVIDERS.map((provider) => {
src/components/SettingsView.tsx:2098:                    const selected = selectedProvider === provider.id;
src/components/SettingsView.tsx:2100:                      <li key={provider.id}>
src/components/SettingsView.tsx:2103:                          data-testid="ai-provider"
src/components/SettingsView.tsx:2104:                          data-provider={provider.id}
src/components/SettingsView.tsx:2106:                          onClick={() => selectProvider(provider.id)}
src/components/SettingsView.tsx:2113:                          <span>{provider.label}</span>
src/components/SettingsView.tsx:2123:                  {PLANNED_PROVIDERS.map((provider) => (
src/components/SettingsView.tsx:2125:                      key={provider.id}
src/components/SettingsView.tsx:2130:                        {provider.label}
src/components/SettingsView.tsx:2152:                      value={openaiEndpoint}
src/components/SettingsView.tsx:2154:                        setConfig({ openaiEndpoint: e.target.value })
src/components/SettingsView.tsx:2167:                      value={openaiModel}
src/components/SettingsView.tsx:2169:                        setConfig({ openaiModel: e.target.value })
src/types/index.ts:10:  | "python"
src/types/index.ts:20:export type TranslationProvider = "ollama" | "openai";
src/types/index.ts:78:  ollamaEndpoint: string;
src/types/index.ts:79:  openaiEndpoint: string;
src/types/index.ts:80:  openaiModel: string;
src/types/index.ts:82:  langPair: LangPair;

exec
/bin/zsh -lc "rg -n \"fn save_config_at|fn apply_patch_at|fn merge_json|fn config_base|fn spawn_config_watcher|const SKILL_MAP|fn seed_skill_map|fn snapshot_user|fn state_value\" src-tauri/src/config.rs; rg -n \"fn save_config|fn apply_patch_at|fn merge_json|fn config_base|fn spawn_config_watcher|const SKILL_MAP|fn seed_skill_map|fn snapshot_user|fn state_value\" src-tauri/src/config.rs | awk -F: '{print "'$1":"$2" "$3}'"'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
346:fn merge_json(defaults: &Value, user: &Value) -> Value {
407:fn state_value(config: &AppConfig) -> Result<Value, AppError> {
771:fn snapshot_user(base: &Path) -> Result<(), AppError> {
846:pub fn save_config_at(base: &Path, config: &AppConfig) -> Result<(), AppError> {
864:pub fn apply_patch_at(base: &Path, patch: &Value) -> Result<AppConfig, AppError> {
892:pub fn seed_skill_map(app: &AppHandle) {
905:const SKILL_MAP: &str = r#"# Biaoyue 配置地图
946:pub fn config_base(app: &AppHandle) -> PathBuf {
996:pub fn spawn_config_watcher(app: AppHandle) {
346:fn merge_json(defaults  &Value, user
407:fn state_value(config  &AppConfig) -> Result<Value, AppError> {
771:fn snapshot_user(base  &Path) -> Result<(), AppError> {
846:pub fn save_config_at(base  &Path, config
864:pub fn apply_patch_at(base  &Path, patch
892:pub fn seed_skill_map(app  &AppHandle) {
905:const SKILL_MAP  &str = r#"# Biaoyue 配置地图
946:pub fn config_base(app  &AppHandle) -> PathBuf {
982:pub async fn save_config(app  &AppHandle, config
996:pub fn spawn_config_watcher(app  AppHandle) {

exec
/bin/zsh -lc "rg -n \"readerFontSize|readerWidth|readerSkin|headingFonts|lineHeight|reader\\.font|mode|reader\" src-tauri/src/config.rs src/hooks/useConfig.ts src/types/index.ts docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md | head -n 250" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src/types/index.ts:67:  headingFonts?: HeadingFonts;
src/types/index.ts:69:  readerFontSize: number;
src/types/index.ts:71:  readerWidth: number;
src/types/index.ts:76:  /** 阅读皮肤：paper / modern … */
src/types/index.ts:77:  readerSkin: string;
src/hooks/useConfig.ts:39:import { ensureHeadingFonts, normalizeHeadingFonts } from "../lib/headingFonts";
src/hooks/useConfig.ts:45:  headingFonts?: HeadingFonts | null;
src/hooks/useConfig.ts:46:  readerFontSize: number | null;
src/hooks/useConfig.ts:47:  readerWidth: number | null;
src/hooks/useConfig.ts:48:  readerSkin: string | null;
src/hooks/useConfig.ts:151:    headingFonts: ensureHeadingFonts(es.config.headingFonts),
src/hooks/useConfig.ts:152:    readerFontSize: es.config.readerFontSize ?? null,
src/hooks/useConfig.ts:153:    readerWidth: es.config.readerWidth ?? null,
src/hooks/useConfig.ts:154:    readerSkin: es.config.readerSkin ?? null,
src/hooks/useConfig.ts:393:    headingFonts: normalizeHeadingFonts(raw.headingFonts),
src/hooks/useConfig.ts:394:    readerFontSize: raw.readerFontSize ?? 17,
src/hooks/useConfig.ts:395:    readerWidth: raw.readerWidth ?? 1080,
src/hooks/useConfig.ts:396:    readerSkin: raw.readerSkin ?? "paper",
src/hooks/useConfig.ts:487:  applyReaderSkin(config.readerSkin ?? "paper");
src/hooks/useConfig.ts:555:        headingFonts: ensureHeadingFonts(null),
src/hooks/useConfig.ts:556:        readerFontSize: 17,
src/hooks/useConfig.ts:557:        readerWidth: 1080,
src/hooks/useConfig.ts:558:        readerSkin: "paper",
src-tauri/src/config.rs:18:    pub reader_font_size: Option<f64>,
src-tauri/src/config.rs:19:    pub reader_width: Option<f64>,
src-tauri/src/config.rs:20:    pub reader_skin: Option<String>,
src-tauri/src/config.rs:23:    pub openai_model: Option<String>,
src-tauri/src/config.rs:142:    pub grid_mode: Option<String>,
src-tauri/src/config.rs:163:    pub grid_mode: Option<String>,
src-tauri/src/config.rs:202:            reader_font_size: Some(17.0),
src-tauri/src/config.rs:203:            reader_width: Some(1080.0),
src-tauri/src/config.rs:204:            reader_skin: Some("paper".into()),
src-tauri/src/config.rs:207:            openai_model: Some("gpt-4o-mini".into()),
src-tauri/src/config.rs:549:            check_font_family(&format!("headingFonts.{level}"), v)?;
src-tauri/src/config.rs:557:    check_range("readerFontSize", config.reader_font_size, 8.0, 96.0)?;
src-tauri/src/config.rs:558:    check_range("readerWidth", config.reader_width, 480.0, 2400.0)?;
src-tauri/src/config.rs:584:        "readerSkin",
src-tauri/src/config.rs:585:        config.reader_skin.as_deref(),
src-tauri/src/config.rs:604:            preview.grid_mode.as_deref(),
src-tauri/src/config.rs:626:            spec.grid_mode.as_deref(),
src-tauri/src/config.rs:927:| `readerFontSize` | 8–96 |
src-tauri/src/config.rs:928:| `readerWidth` | 480–2400 |
src-tauri/src/config.rs:933:| `readerSkin` | `paper` / `plain` |
src-tauri/src/config.rs:1093:        assert_eq!(config.reader_width, Some(1080.0));
src-tauri/src/config.rs:1172:        config.reader_width = Some(479.0);
src-tauri/src/config.rs:1174:        config.reader_width = Some(2400.0);
src-tauri/src/config.rs:1187:        config.reader_skin = Some("indigo".into());
src-tauri/src/config.rs:1189:        config.reader_skin = Some("plain".into());
src-tauri/src/config.rs:1202:        config.reader_font_size = Some(7.9);
src-tauri/src/config.rs:1459:            grid_mode: Some("hover".into()),
src-tauri/src/config.rs:1470:        assert_eq!(loaded.grid_mode.as_deref(), Some("hover"));
src-tauri/src/config.rs:1476:            grid_mode: Some("diagonal".into()),
src-tauri/src/config.rs:1483:            grid_mode: Some("off".into()),
src-tauri/src/config.rs:1508:            grid_mode: Some("list".into()),
src-tauri/src/config.rs:1524:        assert_eq!(loaded.grid_mode.as_deref(), Some("list"));
src-tauri/src/config.rs:1708:            user.contains("headingFonts"),
src-tauri/src/config.rs:1709:            "user 层应含 headingFonts: {user}"
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:49:| 阅读设置 | `readerFontSize`（数值，校验 8–96）、`readerWidth`、`readerSkin` | 阅读区 | ✅ 已落地（注：无 `reader.font` 字体族、`lineHeight`、`mode` 字段） |
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:70:| B9 | **阅读预设** | `readerFontSize` 是数值型（非字体族字符串），无预设集合 | `user/reader-presets.json`：字号/宽度/皮肤预设集合 | AGENT 增加阅读预设，一键切换 |
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:97:  reader-presets.json         阅读预设（B9）
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:197:2. **A 档清单字段名大量虚构（reader.font/export.format/prefs.*/ai.style 等不存在）** → 已采纳，§4 A 档按真实字段重写。

exec
/bin/zsh -lc "nl -ba src/App.tsx | sed -n '330,380p'; nl -ba src/components/Content/ContentArea.tsx | sed -n '440,480p'; nl -ba src/components/Content/PreviewView.tsx | sed -n '130,190p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
   330	    activeTab?.path,
   331	    activeTab?.fileKind,
   332	  ]);
   333	
   334	  // ── Keyboard shortcuts ───────────────────────────────────────
   335	
   336	  // 缩放统一入口：Cmd/Ctrl+=/-/0 由键盘（Ctrl）或原生菜单（Cmd，macOS 菜单拦截）驱动，
   337	  // 分流到字号（markdown/文本/编辑态）或预览帧缩放（图片/HTML/PDF）。
   338	  const handleScaleDelta = useCallback(
   339	    (delta: number) => {
   340	      const tab = useStore.getState().activeTabId
   341	        ? useStore.getState().tabs[useStore.getState().activeTabId!]
   342	        : null;
   343	
   344	      // PDF 缩放由查看器自带控件/缩放菜单处理（T5 实测可用）；App 层不干预，
   345	      // 避免 preview-scale 事件无人消费、或误落字号分支改动全局字号。
   346	      if (tab?.fileKind === "pdf") return;
   347	
   348	      const viewportPreview =
   349	        tab?.editorMode === "preview" &&
   350	        (tab.fileKind === "image" || tab.fileKind === "html");
   351	      if (viewportPreview) {
   352	        window.dispatchEvent(
   353	          new CustomEvent("preview-scale", { detail: delta }),
   354	        );
   355	        return;
   356	      }
   357	      const editorStore = useEditorStore.getState();
   358	      // 编辑态与阅读态共用一个字号：readerFontSize 驱动 --type-font-size，
   359	      // 编辑器的纸面排版也读它，Cmd+/- 因此不会在编辑态失效。
   360	      const applied =
   361	        delta === 0
   362	          ? 17
   363	          : Math.max(12, Math.min(32, editorStore.fontSize + delta));
   364	      editorStore.setFontSize(applied);
   365	      editorStore.setConfig({ readerFontSize: applied });
   366	      document.documentElement.style.setProperty(
   367	        "--editor-font-size",
   368	        `${applied}px`,
   369	      );
   370	      scheduleSave();
   371	    },
   372	    [scheduleSave],
   373	  );
   374	
   375	  // 打开网格概览：清空筛选与选中后切场景。键盘 ⌘⇧\ 与顶栏入口共用同一动作。
   376	  const openGridOverview = useCallback(() => {
   377	    const store = useStore.getState();
   378	    store.setGridTypeFilter(null);
   379	    store.setGridSelectedPath(null);
   380	    store.setScene("grid");
   440	  tabPathRef.current = tab?.path || null;
   441	  currentModeRef.current = editorMode;
   442	  activeDocPath = tab?.path || null;
   443	  showNoticeSink = showNotice;
   444	
   445	  // 与 PreviewView 的 `.preview-content` 注入同一组变量，两个模式才会同貌。
   446	  const headingColors = useEditorStore((s) => s.headingColors);
   447	  const headingFonts = useEditorStore((s) => s.config.headingFonts);
   448	  const readerFontSize = useEditorStore((s) => s.config.readerFontSize);
   449	  const readerWidth = useEditorStore((s) => s.config.readerWidth);
   450	
   451	  const editorThemeVars = useMemo(() => {
   452	    const vars: Record<string, string> = {};
   453	    if (headingColors) {
   454	      for (const level of HEADING_LEVELS) {
   455	        const color = headingColors[level];
   456	        if (color) vars[`--heading-${level}`] = color;
   457	      }
   458	    }
   459	    // 标题字体（#854）：默认值即 --type-font-sans 栈，CSS 里回退到该 token。
   460	    if (headingFonts) {
   461	      for (const level of HEADING_LEVELS) {
   462	        vars[`--heading-${level}-font`] = headingFonts[level];
   463	      }
   464	    }
   465	    if (readerFontSize) vars["--type-font-size"] = `${readerFontSize}px`;
   466	    if (readerWidth) {
   467	      vars["--type-measure"] = `${readerWidth}px`;
   468	      vars["--type-measure-wide"] = `${Math.min(readerWidth + 120, 1400)}px`;
   469	    }
   470	    return vars as React.CSSProperties;
   471	  }, [headingColors, headingFonts, readerFontSize, readerWidth]);
   472	
   473	  // Register preview scroll container for scroll position capture
   474	  useEffect(() => {
   475	    const el = scrollContainerRef.current;
   476	    setScrollContainer(el);
   477	    setPanelScrollEl(panelId, el);
   478	    return () => setPanelScrollEl(panelId, null);
   479	  }, [panelId]);
   480	
   130	  );
   131	}
   132	
   133	export default function PreviewView({
   134	  content = "",
   135	  fileKind = "markdown",
   136	  filePath = null,
   137	}: PreviewViewProps) {
   138	  const headingColors = useEditorStore((s) => s.headingColors);
   139	  const headingFonts = useEditorStore((s) => s.config.headingFonts);
   140	  const readerFontSize = useEditorStore((s) => s.config.readerFontSize);
   141	  const readerWidth = useEditorStore((s) => s.config.readerWidth);
   142	  const readerSkin = useEditorStore((s) => s.config.readerSkin);
   143	  // 能力开关变化时重算 HTML：关闭公式/高亮后当前文档要立刻反映，而不是等下次改内容。
   144	  const [capabilityEpoch, setCapabilityEpoch] = useState(0);
   145	
   146	  useEffect(
   147	    () => subscribeCapability(() => setCapabilityEpoch((n) => n + 1)),
   148	    [],
   149	  );
   150	
   151	  const headingVars = useMemo(() => {
   152	    const vars: Record<string, string> = {};
   153	    if (headingColors) {
   154	      for (const level of HEADING_LEVELS) {
   155	        if (headingColors[level])
   156	          vars[`--heading-${level}`] = headingColors[level];
   157	      }
   158	    }
   159	    // 与 ContentArea 的 editorThemeVars 同源：默认值即 --type-font-sans 栈。
   160	    if (headingFonts) {
   161	      for (const level of HEADING_LEVELS) {
   162	        vars[`--heading-${level}-font`] = headingFonts[level];
   163	      }
   164	    }
   165	    return vars as React.CSSProperties;
   166	  }, [headingColors, headingFonts]);
   167	
   168	  const typeVars = useMemo(() => {
   169	    const vars: Record<string, string> = {};
   170	    if (readerFontSize) vars["--type-font-size"] = `${readerFontSize}px`;
   171	    if (readerWidth) {
   172	      vars["--type-measure"] = `${readerWidth}px`;
   173	      // 表格 / 代码块 / 图片走更宽的通道，宽内容不被正文宽度卡住
   174	      vars["--type-measure-wide"] = `${Math.min(readerWidth + 120, 1400)}px`;
   175	    }
   176	    return vars as React.CSSProperties;
   177	  }, [readerFontSize, readerWidth]);
   178	
   179	  useEffect(() => {
   180	    if (readerSkin) applyReaderSkin(readerSkin);
   181	  }, [readerSkin]);
   182	
   183	  const html = useMemo(() => {
   184	    if (PLAIN_TEXT_KINDS.includes(fileKind)) {
   185	      return renderTextContent(content, previewLanguageOf(filePath));
   186	    }
   187	    switch (fileKind) {
   188	      case "html":
   189	        return null; // HtmlPreview handles rendering
   190	      default:

exec
/bin/zsh -lc "nl -ba src/__tests__/components/SettingsView.test.tsx | sed -n '100,140p'; rg -n \"reader-tone|indigo|moss|clay|readerSkin\" e2e src/__tests__ | head -n 180" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
   100	      "宽松",
   101	    ]);
   102	    const tones = screen.getAllByTestId(/^reader-tone-/);
   103	    expect(tones).toHaveLength(4);
   104	    expect(tones.map((el) => el.textContent)).toEqual([
   105	      "纸墨",
   106	      "靛青",
   107	      "松绿",
   108	      "赭石",
   109	    ]);
   110	
   111	    fireEvent.click(screen.getByTestId("reader-width-720"));
   112	    expect(useEditorStore.getState().config.readerWidth).toBe(720);
   113	
   114	    // 连续滑块（#274）：480–2400，实时写配置与数值展示
   115	    const range = screen.getByTestId("reader-width-range") as HTMLInputElement;
   116	    expect(range.min).toBe("480");
   117	    expect(range.max).toBe("1400");
   118	    expect(screen.getByTestId("reader-width-value").textContent).toBe("720px");
   119	    fireEvent.change(range, { target: { value: "1400" } });
   120	    expect(useEditorStore.getState().config.readerWidth).toBe(1400);
   121	    expect(screen.getByTestId("reader-width-value").textContent).toBe("1400px");
   122	
   123	    fireEvent.click(screen.getByTestId("reader-tone-indigo"));
   124	    expect(useEditorStore.getState().config.readerSkin).toBe("indigo");
   125	    expect(document.documentElement.dataset.skin).toBe("indigo");
   126	  });
   127	
   128	  it("外观区保留阅读字号入口，点击写入 readerFontSize", () => {
   129	    render(<SettingsView onClose={() => {}} />);
   130	
   131	    expect(screen.getAllByTestId(/^font-size-/)).toHaveLength(6);
   132	    fireEvent.click(screen.getByTestId("font-size-19"));
   133	    expect(useEditorStore.getState().config.readerFontSize).toBe(19);
   134	  });
   135	
   136	  it("设置窗自适应：根容器裁剪，内容区与导航各自可滚动", () => {
   137	    render(<SettingsView onClose={() => {}} />);
   138	
   139	    const scene = screen.getByTestId("settings-scene");
   140	    expect(scene.className).toContain("min-h-0");
src/__tests__/useAiEntry.test.ts:26:    readerSkin: "paper",
src/__tests__/components/SettingsView.test.tsx:102:    const tones = screen.getAllByTestId(/^reader-tone-/);
src/__tests__/components/SettingsView.test.tsx:123:    fireEvent.click(screen.getByTestId("reader-tone-indigo"));
src/__tests__/components/SettingsView.test.tsx:124:    expect(useEditorStore.getState().config.readerSkin).toBe("indigo");
src/__tests__/components/SettingsView.test.tsx:125:    expect(document.documentElement.dataset.skin).toBe("indigo");
src/__tests__/useConfig.webFallback.test.tsx:38:    expect(es.config.readerSkin).toBe("paper");
src/__tests__/types.test.ts:33:      readerSkin: "paper",
src/__tests__/useConfig.hotApply.test.ts:31:    readerSkin: "paper",
e2e/settings-reading.spec.ts:112:  await expect(page.locator('[data-testid^="reader-tone-"]')).toHaveCount(4);
e2e/settings-reading.spec.ts:119:  await page.locator('[data-testid="reader-tone-indigo"]').click();
e2e/settings-reading.spec.ts:120:  await expect(page.locator("html")).toHaveAttribute("data-skin", "indigo");
e2e/settings-reading.spec.ts:122:    .poll(() => storedConfig(page).then((c) => c?.readerSkin))
e2e/settings-reading.spec.ts:123:    .toBe("indigo");
e2e/settings-reading.spec.ts:297:  await page.locator(`[data-testid="reader-tone-${tone}"]`).click();
e2e/settings-reading.spec.ts:370:  await chooseTone913(page, "indigo");
e2e/settings-reading.spec.ts:371:  const indigoEditH1 = await editH1Color(page);
e2e/settings-reading.spec.ts:372:  const indigoEditBody = await editBodyColor(page);
e2e/settings-reading.spec.ts:373:  await shot913(page, "indigo-edit");
e2e/settings-reading.spec.ts:375:  const indigoPreviewH1 = await previewH1Color(page);
e2e/settings-reading.spec.ts:376:  const indigoPreviewBody = await previewBodyColor(page);
e2e/settings-reading.spec.ts:377:  await shot913(page, "indigo-preview");
e2e/settings-reading.spec.ts:380:  await chooseTone913(page, "moss");
e2e/settings-reading.spec.ts:381:  const mossEditH1 = await editH1Color(page);
e2e/settings-reading.spec.ts:382:  const mossEditBody = await editBodyColor(page);
e2e/settings-reading.spec.ts:383:  await shot913(page, "moss-edit");
e2e/settings-reading.spec.ts:385:  const mossPreviewH1 = await previewH1Color(page);
e2e/settings-reading.spec.ts:386:  const mossPreviewBody = await previewBodyColor(page);
e2e/settings-reading.spec.ts:387:  await shot913(page, "moss-preview");
e2e/settings-reading.spec.ts:397:    indigoEditH1 === indigoPreviewH1 &&
e2e/settings-reading.spec.ts:398:    mossEditH1 === mossPreviewH1 &&
e2e/settings-reading.spec.ts:409:        indigoEditH1,
e2e/settings-reading.spec.ts:410:        indigoPreviewH1,
e2e/settings-reading.spec.ts:411:        indigoEditBody,
e2e/settings-reading.spec.ts:412:        indigoPreviewBody,
e2e/settings-reading.spec.ts:413:        mossEditH1,
e2e/settings-reading.spec.ts:414:        mossPreviewH1,
e2e/settings-reading.spec.ts:415:        mossEditBody,
e2e/settings-reading.spec.ts:416:        mossPreviewBody,
e2e/settings-reading.spec.ts:423:  record913("indigo-edit", ".artifacts/913/indigo-edit.png", verdict);
e2e/settings-reading.spec.ts:424:  record913("indigo-preview", ".artifacts/913/indigo-preview.png", verdict);
e2e/settings-reading.spec.ts:425:  record913("moss-edit", ".artifacts/913/moss-edit.png", verdict);
e2e/settings-reading.spec.ts:426:  record913("moss-preview", ".artifacts/913/moss-preview.png", verdict);
e2e/settings-reading.spec.ts:429:  expect(indigoEditH1).toBe(indigoPreviewH1);
e2e/settings-reading.spec.ts:430:  expect(mossEditH1).toBe(mossPreviewH1);
e2e/settings-reading.spec.ts:435:  expect(indigoEditH1).not.toBe(mossEditH1);
e2e/settings-reading.spec.ts:436:  expect(indigoPreviewH1).not.toBe(mossPreviewH1);
e2e/settings-reading.spec.ts:437:  expect(indigoEditBody).toBe(paperEditBody);
e2e/settings-reading.spec.ts:438:  expect(mossEditBody).toBe(paperEditBody);
e2e/settings-reading.spec.ts:439:  expect(indigoPreviewBody).toBe(paperPreviewBody);
e2e/settings-reading.spec.ts:440:  expect(mossPreviewBody).toBe(paperPreviewBody);
e2e/settings-reading.spec.ts:441:  expect(indigoPreviewBody).not.toBe(indigoPreviewH1);
e2e/settings-reading.spec.ts:446:  await chooseTone913(page, "indigo");
e2e/settings-reading.spec.ts:453:  expect(warmEditH1, "暖色 + 靛蓝应沿用亮色色板").toBe(indigoEditH1);
e2e/settings-reading.spec.ts:454:  await shot913(page, "warm-indigo-edit");
e2e/settings-reading.spec.ts:455:  record913("warm-indigo-edit", ".artifacts/913/warm-indigo-edit.png", "passed");
e2e/tauri/reader-typography.spec.ts:406:  await page.locator('[data-testid="reader-tone-indigo"]').click();

exec
/bin/zsh -lc 'rg -n "READER_WIDTH_PRESETS|READER_WIDTH_MIN|READER_WIDTH_MAX|READER_WIDTH_STEP|FONT_SIZES" src/lib/readerWidth.ts src/components/SettingsView.tsx src | head -n 120' in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src/components/SettingsView.tsx:32:  READER_WIDTH_MAX,
src/components/SettingsView.tsx:33:  READER_WIDTH_MIN,
src/components/SettingsView.tsx:34:  READER_WIDTH_PRESETS,
src/components/SettingsView.tsx:35:  READER_WIDTH_STEP,
src/components/SettingsView.tsx:141:const FONT_SIZES = [15, 16, 17, 18, 19, 21] as const;
src/components/SettingsView.tsx:1242:                  {FONT_SIZES.map((size) => {
src/components/SettingsView.tsx:1353:                  {FONT_SIZES.map((size) => {
src/components/SettingsView.tsx:1839:                  {READER_WIDTH_PRESETS.map((option) => {
src/components/SettingsView.tsx:1863:                    min={READER_WIDTH_MIN}
src/components/SettingsView.tsx:1864:                    max={READER_WIDTH_MAX}
src/components/SettingsView.tsx:1865:                    step={READER_WIDTH_STEP}
src/components/SettingsView.tsx:1867:                      READER_WIDTH_MAX,
src/components/SettingsView.tsx:1868:                      Math.max(READER_WIDTH_MIN, readerWidth),
src/lib/readerWidth.ts:2:export const READER_WIDTH_MIN = 480;
src/lib/readerWidth.ts:3:export const READER_WIDTH_MAX = 1400;
src/lib/readerWidth.ts:4:export const READER_WIDTH_STEP = 20;
src/lib/readerWidth.ts:6:export const READER_WIDTH_PRESETS = [
src/lib/readerWidth.ts:2:export const READER_WIDTH_MIN = 480;
src/lib/readerWidth.ts:3:export const READER_WIDTH_MAX = 1400;
src/lib/readerWidth.ts:4:export const READER_WIDTH_STEP = 20;
src/lib/readerWidth.ts:6:export const READER_WIDTH_PRESETS = [
src/components/SettingsView.tsx:32:  READER_WIDTH_MAX,
src/components/SettingsView.tsx:33:  READER_WIDTH_MIN,
src/components/SettingsView.tsx:34:  READER_WIDTH_PRESETS,
src/components/SettingsView.tsx:35:  READER_WIDTH_STEP,
src/components/SettingsView.tsx:141:const FONT_SIZES = [15, 16, 17, 18, 19, 21] as const;
src/components/SettingsView.tsx:1242:                  {FONT_SIZES.map((size) => {
src/components/SettingsView.tsx:1353:                  {FONT_SIZES.map((size) => {
src/components/SettingsView.tsx:1839:                  {READER_WIDTH_PRESETS.map((option) => {
src/components/SettingsView.tsx:1863:                    min={READER_WIDTH_MIN}
src/components/SettingsView.tsx:1864:                    max={READER_WIDTH_MAX}
src/components/SettingsView.tsx:1865:                    step={READER_WIDTH_STEP}
src/components/SettingsView.tsx:1867:                      READER_WIDTH_MAX,
src/components/SettingsView.tsx:1868:                      Math.max(READER_WIDTH_MIN, readerWidth),
src/components/Content/HtmlEditToolbar.tsx:27:const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 40];
src/components/Content/HtmlEditToolbar.tsx:256:            {fontSize && !FONT_SIZES.some((n) => `${n}px` === fontSize) && (
src/components/Content/HtmlEditToolbar.tsx:259:            {FONT_SIZES.map((n) => (
src/components/Content/HtmlRangeToolbar.tsx:8:const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 40];
src/components/Content/HtmlRangeToolbar.tsx:164:        {FONT_SIZES.map((n) => (
src/components/StatusBar.tsx:11:  READER_WIDTH_MAX,
src/components/StatusBar.tsx:12:  READER_WIDTH_MIN,
src/components/StatusBar.tsx:13:  READER_WIDTH_PRESETS,
src/components/StatusBar.tsx:14:  READER_WIDTH_STEP,
src/components/StatusBar.tsx:326:                  {READER_WIDTH_PRESETS.map((opt) => (
src/components/StatusBar.tsx:345:                  min={READER_WIDTH_MIN}
src/components/StatusBar.tsx:346:                  max={READER_WIDTH_MAX}
src/components/StatusBar.tsx:347:                  step={READER_WIDTH_STEP}
src/components/StatusBar.tsx:348:                  value={Math.min(READER_WIDTH_MAX, readerWidth)}

exec
/bin/zsh -lc 'rg -n "readerSkin|readerFontSize|readerWidth" src-tauri/src/config.rs docs/openspec openspec 2>/dev/null | head -n 200' in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src-tauri/src/config.rs:557:    check_range("readerFontSize", config.reader_font_size, 8.0, 96.0)?;
src-tauri/src/config.rs:558:    check_range("readerWidth", config.reader_width, 480.0, 2400.0)?;
src-tauri/src/config.rs:584:        "readerSkin",
src-tauri/src/config.rs:927:| `readerFontSize` | 8–96 |
src-tauri/src/config.rs:928:| `readerWidth` | 480–2400 |
src-tauri/src/config.rs:933:| `readerSkin` | `paper` / `plain` |
openspec/changes/archive/2026-11-01-text-config-layer/design.md:38:| `fontSize` / `readerFontSize` | None 或 8.0–96.0 | 拒绝 |
openspec/changes/archive/2026-11-01-text-config-layer/design.md:39:| `readerWidth` | None 或 480.0–2400.0 | 拒绝 |
openspec/changes/archive/2026-11-01-text-config-layer/design.md:43:| `readerSkin` | None 或 `paper` / `plain` | 拒绝 |
openspec/specs/reading/spec.md:370:设置「阅读空间」区 SHALL 提供连续行宽滑块：范围 480–2400px、步长 20px，并实时显示当前像素值；拖动滑块 SHALL 写入 `config.readerWidth` 并即时更新正文 `--type-measure`。既有 720 / 1080 / 1200 三档预设 SHALL 保留为快捷按钮，点击后滑块 SHALL 同步到对应值。
openspec/changes/archive/2026-11-02-editor-preview-parity/design.md:9:- `--type-font-size` / `--type-measure` / `--type-measure-wide`：`config.readerFontSize` / `config.readerWidth`。
openspec/changes/archive/2026-11-07-workspace-ux-batch4/design.md:49:`config.readerWidth` 已是数值（480–2400 校验），只是 UI 缺连续控件。新增 `<input type="range" min=480 max=2400 step=20>` 与数值展示；三档预设保留为快捷按钮，点击后滑块同步。写入仍走 `setConfig + saveAppConfig`。
openspec/changes/archive/2026-11-07-workspace-ux-batch4/specs/reading/spec.md:19:设置「阅读空间」区 SHALL 提供连续行宽滑块：范围 480–2400px、步长 20px，并实时显示当前像素值；拖动滑块 SHALL 写入 `config.readerWidth` 并即时更新正文 `--type-measure`。既有 720 / 1080 / 1200 三档预设 SHALL 保留为快捷按钮，点击后滑块 SHALL 同步到对应值。
openspec/changes/archive/2026-11-10-ui-polish-batch13/design.md:58:- 新增 `src/lib/readerWidth.ts`：MIN 480 / MAX 1400 / STEP 20 / 预设表；`StatusBar`、`SettingsView` 共用；`aiErrors` 文案同步。
openspec/changes/archive/2026-11-10-ui-polish-batch13/tasks.md:62:  - 新增 `src/lib/readerWidth.ts`（MIN 480 / MAX 1400 / STEP 20 / 预设）；两处共用；`aiErrors` 文案同步。
openspec/changes/archive/2026-11-10-ui-polish-batch13/tasks.md:65:  - 接线归属：`readerWidth` 常量由本票接入两组件。
openspec/changes/archive/2026-11-08-ui-polish-batch6/design.md:43:点状态栏上的 `1200px` 打开面板：三档预设（窄/标准/宽，取现有合法档位）+ 一条滑块（与 `readerWidth` 合法区间同界）。拖动即预览，关闭面板保留当前值。值写入 `editorStore.config.readerWidth`，与既有持久化一致。
openspec/changes/archive/2026-11-08-ui-polish-batch6/tasks.md:80:  - `StatusBar.tsx`：`1200px` 变按钮，点击打开面板：三档预设 + 滑块（与 `readerWidth` 合法区间同界）
openspec/changes/archive/2026-11-08-ui-polish-batch6/tasks.md:81:  - 拖动即预览并写入 `editorStore.config.readerWidth`；关闭保留当前值
openspec/changes/archive/2026-09-15-preview-table-width/design.md:7:宽度约束链（`src/styles/reader.css`）：`.preview-content` 是"纸"（`max-width: var(--type-measure-wide)`，默认 1200px；运行时 = 阅读行宽 readerWidth + 120，上限 1400）；正文子元素走 `--type-measure`（默认 1080px）；`.table-wrap.wide` 走宽通道（= 纸宽）。

exec
/bin/zsh -lc 'rg -n "SHORTCUTS|coreShortcuts|shortcutsByFamily|isLocalShortcutActive|keydown|keyup|KeyboardEvent|key ===|match.*key|parse.*keys" src | head -n 400' in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src/lib/frontmatter.ts:159:  return key === "created" || key === "updated";
src/lib/frontmatter.ts:394:    f.key === key ? { ...f, value } : f,
src/lib/frontmatter.ts:500:      (f, i) => f.key === fields[i].key && sameValue(f.value, fields[i].value),
src/lib/frontmatter.ts:562:      (f, i) => f.key === fields[i].key && sameValue(f.value, fields[i].value),
src/lib/frontmatter.ts:665:    return key === f.key ? f : { ...f, key };
src/lib/frontmatter.ts:725:  const idx = parsed.fields.findIndex((f) => f.key === fromKey);
src/lib/frontmatter.ts:736:  if (parsed.fields.some((f, i) => i !== idx && f.key === next)) {
src/lib/frontmatter.ts:766:      f.key === fromKey ? { ...f, key: next } : f,
src/lib/shortcuts.ts:68:export const SHORTCUTS: readonly ShortcutDef[] = [
src/lib/shortcuts.ts:535:export function coreShortcuts(): ShortcutDef[] {
src/lib/shortcuts.ts:536:  return SHORTCUTS.filter((s) => s.core);
src/lib/shortcuts.ts:540:export function shortcutsByFamily(family: ShortcutFamily): ShortcutDef[] {
src/lib/shortcuts.ts:541:  return SHORTCUTS.filter((s) => s.family === family);
src/lib/shortcuts.ts:559:export function isLocalShortcutActive(id: string, context: string): boolean {
src/lib/shortcuts.ts:561:  return SHORTCUTS.some(
src/lib/gridKeyboard.ts:162: * 从 `KeyboardEvent.code` 解析 1–9 数字键（含小键盘 `Numpad1`–`Numpad9`）。
src/components/Grid/GridToolbar.tsx:6:  type KeyboardEvent as ReactKeyboardEvent,
src/components/Grid/GridToolbar.tsx:110:  const onTypeTriggerKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
src/components/Grid/GridToolbar.tsx:112:    if (e.key === "Escape") {
src/components/Grid/GridToolbar.tsx:120:    if (e.key === "Enter" || e.key === " ") {
src/components/Grid/GridToolbar.tsx:136:      setTypeMenuIndex(e.key === "ArrowDown" ? 0 : last);
src/components/Grid/GridToolbar.tsx:141:      return e.key === "ArrowDown"
src/components/Grid/GridToolbar.tsx:148:    const onKey = (e: KeyboardEvent) => {
src/components/Grid/GridToolbar.tsx:156:    window.addEventListener("keydown", onKey);
src/components/Grid/GridToolbar.tsx:157:    return () => window.removeEventListener("keydown", onKey);
src/App.tsx:287:    const capturePeriodHandler = (e: KeyboardEvent) => {
src/App.tsx:288:      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === ".") {
src/App.tsx:295:    document.addEventListener("keydown", capturePeriodHandler, {
src/App.tsx:300:      document.removeEventListener("keydown", capturePeriodHandler, {
src/App.tsx:421:    const handler = (e: KeyboardEvent) => {
src/App.tsx:442:      const questionKey = e.key === "?" || (e.key === "/" && e.shiftKey);
src/App.tsx:466:      if (meta && e.shiftKey && (e.key === "\\" || e.key === "|")) {
src/App.tsx:494:      if (meta && e.key === "o") {
src/App.tsx:500:      if (meta && e.key === "s") {
src/App.tsx:506:      if (meta && e.key === "n") {
src/App.tsx:518:      if (meta && e.key === "w" && activeTabId) {
src/App.tsx:537:      if (meta && e.altKey && e.key === "\\") {
src/App.tsx:546:      if (meta && e.key === "\\") {
src/App.tsx:630:      if (meta && e.altKey && e.key === "ArrowRight") {
src/App.tsx:634:      if (meta && e.altKey && e.key === "ArrowDown") {
src/App.tsx:640:      if (meta && e.shiftKey && e.key === "Enter") {
src/App.tsx:682:      if (meta && e.key === "b") {
src/App.tsx:691:      if (meta && (e.key === "=" || e.key === "-" || e.key === "0")) {
src/App.tsx:693:        const delta = e.key === "0" ? 0 : e.key === "=" ? 1 : -1;
src/App.tsx:698:      if (meta && e.key === ",") {
src/App.tsx:716:      if (e.key === "Escape") {
src/App.tsx:737:    window.addEventListener("keydown", handler);
src/App.tsx:740:    const captureHandler = (e: KeyboardEvent) => {
src/App.tsx:741:      if ((e.metaKey || e.ctrlKey) && e.key === "i") {
src/App.tsx:761:    document.addEventListener("keydown", captureHandler, { capture: true });
src/App.tsx:764:      window.removeEventListener("keydown", handler);
src/App.tsx:765:      document.removeEventListener("keydown", captureHandler, {
src/lib/extensions/templates.ts:30:  return body.replace(PLACEHOLDER_RE, (match, key: string) => {
src/lib/extensions/templates.ts:31:    if (key === "date") return vars.date;
src/lib/extensions/templates.ts:32:    if (key === "title") return vars.title;
src/components/TabBar.tsx:72:      if (key === path) setMuted(m);
src/components/TabBar.tsx:213:    const onKey = (e: KeyboardEvent) => {
src/components/TabBar.tsx:214:      if (e.key === "Escape") finish(false);
src/components/TabBar.tsx:219:    window.addEventListener("keydown", onKey, true);
src/components/TabBar.tsx:225:      window.removeEventListener("keydown", onKey, true);
src/components/TabBar.tsx:356:    const onKeyDown = (e: KeyboardEvent) => {
src/components/TabBar.tsx:367:    document.addEventListener("keydown", onKeyDown, true);
src/components/TabBar.tsx:374:      document.removeEventListener("keydown", onKeyDown, true);
src/components/TabBar.tsx:559:                      if (e.key === "Enter") {
src/components/TabBar.tsx:562:                      } else if (e.key === "Escape") {
src/lib/extensions/theme-tokens.ts:77:      key === null ||
src/components/GridView.tsx:258:    const onKey = (e: KeyboardEvent) => {
src/components/GridView.tsx:274:    window.addEventListener("keydown", onKey);
src/components/GridView.tsx:275:    return () => window.removeEventListener("keydown", onKey);
src/components/GridView.tsx:292:    const onMetaDown = (e: KeyboardEvent) => {
src/components/GridView.tsx:299:    const onMetaUp = (e: KeyboardEvent) => {
src/components/GridView.tsx:309:    window.addEventListener("keydown", onMetaDown);
src/components/GridView.tsx:310:    window.addEventListener("keyup", onMetaUp);
src/components/GridView.tsx:315:      window.removeEventListener("keydown", onMetaDown);
src/components/GridView.tsx:316:      window.removeEventListener("keyup", onMetaUp);
src/components/GridView.tsx:358:        key === "j"
src/components/GridView.tsx:360:          : key === "k"
src/components/GridView.tsx:362:            : key === "h"
src/components/GridView.tsx:405:    const onKeyDown = (e: KeyboardEvent) => {
src/components/GridView.tsx:411:      if (e.key === "Meta" || e.key === "Control") return;
src/components/GridView.tsx:429:        if (e.key === "PageDown" || e.key === "PageUp") {
src/components/GridView.tsx:431:          pageScroll(e.key === "PageDown" ? 1 : -1);
src/components/GridView.tsx:450:          jumpToEdge(e.key === "Home" ? "start" : "end");
src/components/GridView.tsx:457:          pageScroll(e.key === "PageDown" ? 1 : -1);
src/components/GridView.tsx:481:    window.addEventListener("keydown", onKeyDown);
src/components/GridView.tsx:482:    return () => window.removeEventListener("keydown", onKeyDown);
src/hooks/usePaneDragController.ts:204:        window.removeEventListener("keydown", onKey, true);
src/hooks/usePaneDragController.ts:237:      const onKey = (ev: KeyboardEvent) => {
src/hooks/usePaneDragController.ts:249:      window.addEventListener("keydown", onKey, true);
src/hooks/usePaneDragController.ts:275:      window.removeEventListener("keydown", onKey, true);
src/hooks/usePaneDragController.ts:295:    const onKey = (ev: KeyboardEvent) => {
src/hooks/usePaneDragController.ts:305:    window.addEventListener("keydown", onKey, true);
src/components/Rail/ReadingRail.tsx:8:  type KeyboardEvent as ReactKeyboardEvent,
src/components/Rail/ReadingRail.tsx:1062:    const onKey = (e: KeyboardEvent) => {
src/components/Rail/ReadingRail.tsx:1063:      if (e.key === "Escape") setMenuOpen(false);
src/components/Rail/ReadingRail.tsx:1066:    window.addEventListener("keydown", onKey, true);
src/components/Rail/ReadingRail.tsx:1069:      window.removeEventListener("keydown", onKey, true);
src/components/Rail/ReadingRail.tsx:1247:    ? RAIL_SECTIONS.filter((s) => s.key === "pinned" || s.key === "recent")
src/components/Rail/ReadingRail.tsx:1249:  const activeSection = railSections.some((s) => s.key === railSection)
src/components/Rail/ReadingRail.tsx:1313:  const onSearchKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
src/__tests__/editor/decorations-blocks.test.ts:476:    it("parses width/height/align/crop and ignores unknown keys", () => {
src/components/Content/HtmlRangeToolbar.tsx:117:        if (e.key === "Escape") {
src/components/Content/HtmlVisualEditor.tsx:271:            new KeyboardEvent("keydown", {
src/components/Content/HtmlVisualEditor.tsx:436:    const onKey = (e: KeyboardEvent) => {
src/components/Content/HtmlVisualEditor.tsx:437:      if (e.key === "Escape") cancelResizeGesture();
src/components/Content/HtmlVisualEditor.tsx:440:    document.addEventListener("keydown", onKey);
src/components/Content/HtmlVisualEditor.tsx:443:      document.removeEventListener("keydown", onKey);
src/components/Content/OutlineMenu.tsx:248:    const onKey = (event: KeyboardEvent) => {
src/components/Content/OutlineMenu.tsx:255:    document.addEventListener("keydown", onKey, true);
src/components/Content/OutlineMenu.tsx:256:    return () => document.removeEventListener("keydown", onKey, true);
src/components/ai/CommandOverlay.tsx:20:    const onKey = (e: KeyboardEvent) => {
src/components/ai/CommandOverlay.tsx:21:      if (e.key === "Escape") {
src/components/ai/CommandOverlay.tsx:34:    document.addEventListener("keydown", onKey, { capture: true });
src/components/ai/CommandOverlay.tsx:37:      document.removeEventListener("keydown", onKey, { capture: true });
src/components/Content/PaneTreeView.tsx:367:    const onKey = (e: KeyboardEvent) => {
src/components/Content/PaneTreeView.tsx:368:      if (e.key === "Escape") {
src/components/Content/PaneTreeView.tsx:374:      window.addEventListener("keydown", onKey, true);
src/components/Content/PaneTreeView.tsx:379:      window.removeEventListener("keydown", onKey, true);
src/components/Content/PaneTreeView.tsx:684:    const onKey = (e: KeyboardEvent) => {
src/components/Content/PaneTreeView.tsx:685:      if (e.key === "Escape") setMenuOpen(false);
src/components/Content/PaneTreeView.tsx:688:    window.addEventListener("keydown", onKey, true);
src/components/Content/PaneTreeView.tsx:691:      window.removeEventListener("keydown", onKey, true);
src/components/Content/PaneDivider.tsx:72:        if (isRow && e.key === "ArrowLeft") {
src/components/Content/PaneDivider.tsx:75:        } else if (isRow && e.key === "ArrowRight") {
src/components/Content/PaneDivider.tsx:78:        } else if (!isRow && e.key === "ArrowUp") {
src/components/Content/PaneDivider.tsx:81:        } else if (!isRow && e.key === "ArrowDown") {
src/components/Content/PaneDivider.tsx:84:        } else if (e.key === "Enter" || e.key === " ") {
src/components/ai/SelectionPill.tsx:161:    const onKey = (e: KeyboardEvent) => {
src/components/ai/SelectionPill.tsx:178:    window.addEventListener("keydown", onKey);
src/components/ai/SelectionPill.tsx:184:      window.removeEventListener("keydown", onKey);
src/components/ai/SelectionPill.tsx:225:    if (action.key === "copy") {
src/components/Content/PreviewView.tsx:265: * 由 App 的 bubble 阶段 keydown 统一分发（真机 WKWebView 中 Cmd 组合键
src/components/ShortcutOverlay.tsx:6:  shortcutsByFamily,
src/components/ShortcutOverlay.tsx:12: * `?` 全局开关（App 层处理），全表与 `SHORTCUTS` 注册表严格相等；按家族分组，
src/components/ShortcutOverlay.tsx:24:    const onKey = (e: KeyboardEvent) => {
src/components/ShortcutOverlay.tsx:25:      if (e.key === "Escape") {
src/components/ShortcutOverlay.tsx:31:    window.addEventListener("keydown", onKey, { capture: true });
src/components/ShortcutOverlay.tsx:33:      window.removeEventListener("keydown", onKey, { capture: true });
src/components/ShortcutOverlay.tsx:68:            const items = shortcutsByFamily(family);
src/components/TooltipLayer.tsx:250:    const onKeyDown = (e: KeyboardEvent) => {
src/components/TooltipLayer.tsx:252:      if (e.key === "Escape") clear();
src/components/TooltipLayer.tsx:258:    document.addEventListener("keydown", onKeyDown, true);
src/components/TooltipLayer.tsx:265:      document.removeEventListener("keydown", onKeyDown, true);
src/components/Content/SuggestMenu.tsx:64:    const onKey = (e: KeyboardEvent) => {
src/components/Content/SuggestMenu.tsx:67:      if (e.key === "ArrowDown") onMove(1);
src/components/Content/SuggestMenu.tsx:68:      else if (e.key === "ArrowUp") onMove(-1);
src/components/Content/SuggestMenu.tsx:69:      else if (e.key === "Enter") {
src/components/Content/SuggestMenu.tsx:72:      } else if (e.key === "Escape") onClose();
src/components/Content/SuggestMenu.tsx:84:    host.addEventListener("keydown", onKey, { capture: true });
src/components/Content/SuggestMenu.tsx:85:    return () => host.removeEventListener("keydown", onKey, { capture: true });
src/lib/mdpkg/vendor/mdpkg-web.js:21707:    onKeyDown: "onkeydown",
src/lib/mdpkg/vendor/mdpkg-web.js:21709:    onKeyUp: "onkeyup",
src/components/Content/VideoPlayer.tsx:2035:              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
src/components/Content/VideoPlayer.tsx:2039:              if (e.key === "Escape") {
src/components/TemplatePicker.tsx:25:    const onKeyDown = (e: KeyboardEvent) => {
src/components/TemplatePicker.tsx:26:      if (e.key === "Escape") {
src/components/TemplatePicker.tsx:31:    document.addEventListener("keydown", onKeyDown);
src/components/TemplatePicker.tsx:33:    return () => document.removeEventListener("keydown", onKeyDown);
src/components/ai/AiConversation.tsx:112:            if (e.key === "Enter" && !e.shiftKey) {
src/__tests__/editor/columns.test.ts:174:      new KeyboardEvent("keydown", {
src/__tests__/editor/columns.test.ts:273:      new KeyboardEvent("keydown", {
src/__tests__/editor/columns.test.ts:307:      new KeyboardEvent("keydown", {
src/editors/callout-types.ts:106:  const edit = CALLOUT_EDIT_TYPES.find((entry) => entry.key === type);
src/__tests__/editor/callout-title-edit.test.ts:108:      new KeyboardEvent("keydown", {
src/__tests__/editor/callout-title-edit.test.ts:128:      new KeyboardEvent("keydown", {
src/__tests__/editor/callout-title-edit.test.ts:148:      new KeyboardEvent("keydown", {
src/components/QuickOpen.tsx:156:    const onKey = (e: KeyboardEvent) => {
src/components/QuickOpen.tsx:158:      if (e.key === "Escape") {
src/components/QuickOpen.tsx:162:      } else if (e.key === "ArrowDown") {
src/components/QuickOpen.tsx:169:      } else if (e.key === "ArrowUp") {
src/components/QuickOpen.tsx:173:      } else if (e.key === "Enter") {
src/components/QuickOpen.tsx:179:    window.addEventListener("keydown", onKey, { capture: true });
src/components/QuickOpen.tsx:181:      window.removeEventListener("keydown", onKey, { capture: true });
src/components/SettingsView.tsx:54:  coreShortcuts,
src/components/SettingsView.tsx:55:  shortcutsByFamily,
src/components/SettingsView.tsx:798:    const onKeyDown = (e: KeyboardEvent) => {
src/components/SettingsView.tsx:799:      if (e.key === "Escape") {
src/components/SettingsView.tsx:809:    document.addEventListener("keydown", onKeyDown, true);
src/components/SettingsView.tsx:810:    return () => document.removeEventListener("keydown", onKeyDown, true);
src/components/SettingsView.tsx:1296:                          if (e.key === "Enter") {
src/components/SettingsView.tsx:1424:                    if (e.key === "Enter") {
src/components/SettingsView.tsx:1451:                      if (e.key === "Enter") {
src/components/SettingsView.tsx:2444:                {coreShortcuts().map((shortcut) => (
src/components/SettingsView.tsx:2470:                    const items = shortcutsByFamily(family);
src/components/ContextMenu.tsx:44:    const onKeyDown = (e: KeyboardEvent) => {
src/components/ContextMenu.tsx:50:    document.addEventListener("keydown", onKeyDown);
src/components/ContextMenu.tsx:55:      document.removeEventListener("keydown", onKeyDown);
src/components/ContextMenu.tsx:92:        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
src/components/ContextMenu.tsx:94:          move(e.key === "ArrowDown" ? 1 : -1);
src/components/ContextMenu.tsx:97:        if (e.key === "Tab") onClose();
src/components/Content/HtmlEditToolbar.tsx:105:  if (key === "text-decoration") return style["text-decoration-line"] ?? "";
src/components/Content/HtmlEditToolbar.tsx:106:  if (key === "border") return style["border-top-width"] ?? "";
src/components/Content/HtmlEditToolbar.tsx:192:        if (e.key === "Escape") {
src/components/Content/HtmlEditToolbar.tsx:197:        if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
src/components/CaptureOverlay.tsx:105:    const onKeyDown = (e: KeyboardEvent) => {
src/components/CaptureOverlay.tsx:107:      if (e.key === "Escape") {
src/components/CaptureOverlay.tsx:117:        e.key === "ArrowUp" &&
src/components/CaptureOverlay.tsx:124:        e.key === "ArrowDown" &&
src/components/CaptureOverlay.tsx:131:        e.key === "Enter" &&
src/components/CaptureOverlay.tsx:141:    document.addEventListener("keydown", onKeyDown, { capture: true });
src/components/CaptureOverlay.tsx:143:      document.removeEventListener("keydown", onKeyDown, { capture: true });
src/components/CaptureOverlay.tsx:167:    e: React.KeyboardEvent<HTMLTextAreaElement>,
src/components/CaptureOverlay.tsx:169:    if (e.key === "Backspace" && store.draftPrefix && !store.draftContent) {
src/components/CaptureOverlay.tsx:176:    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
src/components/CaptureOverlay.tsx:179:    } else if (e.key === "Enter") {
src/components/CaptureOverlay.tsx:189:    } else if (e.key === "Tab") {
src/components/CaptureOverlay.tsx:202:    } else if (e.key === "n" && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
src/components/CaptureOverlay.tsx:205:    } else if ((e.key === "=" || e.key === "-") && (e.metaKey || e.ctrlKey)) {
src/components/CaptureOverlay.tsx:207:      store.setFontSize(store.fontSize + (e.key === "=" ? 1 : -1));
src/components/CaptureOverlay.tsx:815:                                  e.key === "Enter" &&
src/components/CaptureOverlay.tsx:820:                                } else if (e.key === "Escape") {
src/editors/slash.ts:2340:          // 不设 `scope`——CM6 默认 keydown 处理器只跑 "editor" 作用域；自定义
src/components/Content/DocPropertyBar.tsx:228:    const onKey = (e: KeyboardEvent) => {
src/components/Content/DocPropertyBar.tsx:229:      if (e.key === "Escape") {
src/components/Content/DocPropertyBar.tsx:235:    document.addEventListener("keydown", onKey);
src/components/Content/DocPropertyBar.tsx:238:      document.removeEventListener("keydown", onKey);
src/components/Content/DocPropertyBar.tsx:391:            if (e.key === "Enter") {
src/components/Content/DocPropertyBar.tsx:394:            } else if (e.key === "Escape") {
src/components/Content/DocPropertyBar.tsx:413:                  if (e.key === "Enter" || e.key === " ") {
src/components/Content/DocPropertyBar.tsx:462:              if (e.key === "Enter" || e.key === " ") {
src/components/Content/DocPropertyBar.tsx:582:            if (e.key === "Escape") cancel();
src/components/Content/DocPropertyBar.tsx:602:          if (e.key === "Enter") {
src/components/Content/DocPropertyBar.tsx:605:          } else if (e.key === "Escape") {
src/components/Content/DocPropertyBar.tsx:873:        (f) => f.key === "tags" && Array.isArray(f.value),
src/components/Content/DocPropertyBar.tsx:988:                if (e.key === "Enter") {
src/components/Content/DocPropertyBar.tsx:991:                } else if (e.key === "Escape") {
src/components/Content/DocPropertyBar.tsx:1246:  const titleField = fields.find((f) => f.key === "title") ?? null;
src/components/Content/DocPropertyBar.tsx:1248:    fields.find((f) => f.key === "tags" && Array.isArray(f.value)) ?? null;
src/components/Content/DocPropertyBar.tsx:1305:        const ti = next.findIndex((f) => f.key === "tags");
src/components/Content/DocPropertyBar.tsx:1322:      return key === f.key ? f : { ...f, key };
src/components/Content/DocPropertyBar.tsx:1337:      const ti = next.findIndex((f) => f.key === "tags");
src/components/PortalView.tsx:115:    const onKey = (e: KeyboardEvent) => {
src/components/PortalView.tsx:121:    window.addEventListener("keydown", onKey);
src/components/PortalView.tsx:122:    return () => window.removeEventListener("keydown", onKey);
src/components/StatusBar.tsx:233:    const onKeyDown = (e: KeyboardEvent) => {
src/components/StatusBar.tsx:239:    document.addEventListener("keydown", onKeyDown);
src/components/StatusBar.tsx:244:      document.removeEventListener("keydown", onKeyDown);
src/components/StatusBar.tsx:461:                      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
src/components/StatusBar.tsx:463:                        focusThemeItem(e.key === "ArrowDown" ? 1 : -1);
src/components/StatusBar.tsx:466:                      if (e.key === "Escape") {
src/components/StatusBar.tsx:472:                      if (e.key === "Tab") setThemeOpen(false);
src/__tests__/aiViewSpec.test.ts:138:        if (key === target) {
src/components/Content/SplitResizeHandle.tsx:74:          if (e.key === "ArrowLeft") onRatioChange(Math.max(0.1, 0.5 - step));
src/components/Content/SplitResizeHandle.tsx:75:          if (e.key === "ArrowRight") onRatioChange(Math.min(0.9, 0.5 + step));
src/components/Content/SplitResizeHandle.tsx:77:          if (e.key === "ArrowUp") onRatioChange(Math.min(0.9, 0.5 + step));
src/components/Content/SplitResizeHandle.tsx:78:          if (e.key === "ArrowDown") onRatioChange(Math.max(0.1, 0.5 - step));
src/components/Content/SplitResizeHandle.tsx:80:        if (e.key === "Enter" || e.key === " ") {
src/__tests__/frontmatter.test.ts:118:      f.key === "title" ? { ...f, value: "乙" } : f,
src/__tests__/frontmatter.test.ts:300:    const f = parseFrontmatter(r.text).fields.find((x) => x.key === "count");
src/__tests__/selectionPill.test.tsx:255:      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
src/__tests__/appQuickOpenShortcut.test.tsx:64:    window.addEventListener("keydown", recorder);
src/__tests__/appQuickOpenShortcut.test.tsx:66:    window.removeEventListener("keydown", recorder);
src/__tests__/appQuickOpenShortcut.test.tsx:90:    const event = new KeyboardEvent("keydown", {
src/__tests__/lib/shortcuts.test.ts:3:  SHORTCUTS,
src/__tests__/lib/shortcuts.test.ts:7:  coreShortcuts,
src/__tests__/lib/shortcuts.test.ts:8:  isLocalShortcutActive,
src/__tests__/lib/shortcuts.test.ts:9:  shortcutsByFamily,
src/__tests__/lib/shortcuts.test.ts:22:    const ids = SHORTCUTS.map((s) => s.id);
src/__tests__/lib/shortcuts.test.ts:27:    expect(shortcutsByFamily("global")).toHaveLength(12);
src/__tests__/lib/shortcuts.test.ts:28:    expect(coreShortcuts()).toHaveLength(7);
src/__tests__/lib/shortcuts.test.ts:29:    expect(coreShortcuts().every((s) => s.family === "global")).toBe(true);
src/__tests__/lib/shortcuts.test.ts:33:    expect(shortcutsByFamily("typeFilter")).toHaveLength(9);
src/__tests__/lib/shortcuts.test.ts:38:    for (const shortcut of SHORTCUTS) {
src/__tests__/lib/shortcuts.test.ts:51:    const globals = shortcutsByFamily("global");
src/__tests__/lib/shortcuts.test.ts:57:    const locals = SHORTCUTS.filter((s) => s.scope === "local");
src/__tests__/lib/shortcuts.test.ts:70:  it("isLocalShortcutActive follows context activation", () => {
src/__tests__/lib/shortcuts.test.ts:71:    const local = SHORTCUTS.find((s) => s.scope === "local")!;
src/__tests__/lib/shortcuts.test.ts:72:    expect(isLocalShortcutActive(local.id, local.context!)).toBe(false);
src/__tests__/lib/shortcuts.test.ts:74:    expect(isLocalShortcutActive(local.id, local.context!)).toBe(true);
src/__tests__/lib/shortcuts.test.ts:75:    expect(isLocalShortcutActive(local.id, "未激活上下文")).toBe(false);
src/__tests__/lib/shortcuts.test.ts:77:    expect(isLocalShortcutActive(local.id, local.context!)).toBe(false);
src/__tests__/lib/shortcuts.test.ts:81:    for (const shortcut of SHORTCUTS) {
src/__tests__/lib/shortcuts.test.ts:91:    for (const shortcut of SHORTCUTS) {
src/__tests__/lib/shortcuts.test.ts:101:    const withDecision = SHORTCUTS.filter((s) => s.decision);
src/__tests__/lib/shortcuts.test.ts:108:    const families = new Set(SHORTCUTS.map((s) => s.family));
src/editors/orchestration/floating-toolbar.ts:75:function matchesHotkey(e: KeyboardEvent, chord: string): boolean {
src/editors/orchestration/floating-toolbar.ts:816:    const onKeyDown = (e: KeyboardEvent) => {
src/editors/orchestration/floating-toolbar.ts:836:    const onHotkeyDown = (e: KeyboardEvent) => {
src/editors/orchestration/floating-toolbar.ts:845:      if (!matchesHotkey(e, chord)) return;
src/editors/orchestration/floating-toolbar.ts:858:    document.addEventListener("keydown", onKeyDown, true);
src/editors/orchestration/floating-toolbar.ts:859:    document.addEventListener("keydown", onHotkeyDown, true);
src/editors/orchestration/floating-toolbar.ts:895:        document.removeEventListener("keydown", onKeyDown, true);
src/editors/orchestration/floating-toolbar.ts:896:        document.removeEventListener("keydown", onHotkeyDown, true);
src/editors/smart-input.ts:92:  // 带不带尾随空格都匹配（keydown 时空格尚未插入）。
src/editors/html/runtime.ts:331:  document.addEventListener("keydown", (e) => {
src/editors/html/runtime.ts:336:      if (key === "z") {
src/editors/html/runtime.ts:341:      if (key === "y") {
src/editors/html/runtime.ts:353:    if (e.key === "Escape") { e.preventDefault(); endEdit(); return; }
src/editors/orchestration/capsule-toolbar.ts:130:  const onKey = (e: KeyboardEvent) => {
src/editors/orchestration/capsule-toolbar.ts:131:    if (e.key === "Escape") {
src/editors/orchestration/capsule-toolbar.ts:140:  document.addEventListener("keydown", onKey, true);
src/editors/orchestration/capsule-toolbar.ts:145:    document.removeEventListener("keydown", onKey, true);
src/editors/decorations/image.ts:166:    if (key === "width" || key === "height") {
src/editors/decorations/image.ts:169:        if (key === "width") attrs.width = num;
src/editors/decorations/image.ts:172:    } else if (key === "align") {
src/editors/decorations/image.ts:176:    } else if (key === "crop") {
src/editors/orchestration/block-handle.ts:254:    view.contentDOM.addEventListener("keydown", this.onKeyDown);
src/editors/orchestration/block-handle.ts:255:    view.contentDOM.addEventListener("keyup", this.onKeyUp);
src/editors/orchestration/block-handle.ts:256:    document.addEventListener("keydown", this.onDocumentKeyDown, true);
src/editors/orchestration/block-handle.ts:290:    this.view.contentDOM.removeEventListener("keydown", this.onKeyDown);
src/editors/orchestration/block-handle.ts:291:    this.view.contentDOM.removeEventListener("keyup", this.onKeyUp);
src/editors/orchestration/block-handle.ts:292:    document.removeEventListener("keydown", this.onDocumentKeyDown, true);
src/editors/orchestration/block-handle.ts:327:    // 补漏：keyup 有时落在编辑器外（菜单抢焦点），抑制标志会永久卡住，
src/editors/orchestration/block-handle.ts:849:  private readonly onDocumentKeyDown = (event: KeyboardEvent): void => {
src/editors/decorations/table.ts:604:  input.addEventListener("keydown", (event) => {
src/editors/decorations/table.ts:608:      if (event.key === "Enter") {
src/editors/decorations/table.ts:613:      if (event.key === "ArrowDown") {
src/editors/decorations/table.ts:618:      if (event.key === "ArrowUp") {
src/editors/decorations/table.ts:623:      if (event.key === "Escape") {
src/editors/decorations/table.ts:629:    if (event.key === "Enter") {
src/editors/decorations/table.ts:634:    if (event.key === "Tab") {
src/editors/decorations/table.ts:648:    if (event.key === "Escape") {
src/editors/decorations/imageCrop.ts:206:    document.removeEventListener("keydown", onKey, true);
src/editors/decorations/imageCrop.ts:300:  const onKey = (event: KeyboardEvent): void => {
src/editors/decorations/imageCrop.ts:306:  document.addEventListener("keydown", onKey, true);
src/editors/orchestration/horizontal-toolbar.ts:321:    const onKey = (e: KeyboardEvent) => {
src/editors/orchestration/horizontal-toolbar.ts:322:      if (e.key === "Escape") hide();
src/editors/orchestration/horizontal-toolbar.ts:333:    document.addEventListener("keydown", onKey, true);
src/editors/orchestration/horizontal-toolbar.ts:354:        document.removeEventListener("keydown", onKey, true);
src/editors/decorations/columns.ts:268:  area.addEventListener("keydown", (event) => {
src/editors/decorations/columns.ts:272:      if (event.key === "Enter") {
src/editors/decorations/columns.ts:277:      if (event.key === "ArrowDown") {
src/editors/decorations/columns.ts:282:      if (event.key === "ArrowUp") {
src/editors/decorations/columns.ts:287:      if (event.key === "Escape") {
src/editors/decorations/columns.ts:293:    if (event.key === "Escape") {
src/editors/decorations/columns.ts:298:    if (event.key === "Enter" && !event.shiftKey) {
src/editors/orchestration/roulette-view.ts:704:  filterInput.addEventListener("keydown", (e) => {
src/editors/orchestration/roulette-view.ts:705:    if (e.key === "Escape") {
src/editors/orchestration/roulette-view.ts:711:    if (e.key === "Enter") {
src/editors/orchestration/roulette-view.ts:728:  const onKey = (e: KeyboardEvent) => {
src/editors/orchestration/roulette-view.ts:729:    if (e.key === "Escape") {
src/editors/orchestration/roulette-view.ts:748:        const hit = matches[Number(e.key) - 1];
src/editors/orchestration/roulette-view.ts:769:    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
src/editors/orchestration/roulette-view.ts:774:    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
src/editors/orchestration/roulette-view.ts:779:    if (e.key === "Enter") {
src/editors/orchestration/roulette-view.ts:788:  document.addEventListener("keydown", onKey, true);
src/editors/orchestration/roulette-view.ts:877:    document.removeEventListener("keydown", onKey, true);
src/editors/decorations/imageToolbar.ts:210:let maximizeKeyHandler: ((event: KeyboardEvent) => void) | null = null;
src/editors/decorations/imageToolbar.ts:389:  input.addEventListener("keydown", (event) => {
src/editors/decorations/imageToolbar.ts:391:    if (event.key === "Enter") {
src/editors/decorations/imageToolbar.ts:394:    } else if (event.key === "Escape") {
src/editors/decorations/imageToolbar.ts:551:    btn?.setAttribute("aria-pressed", key === align ? "true" : "false");
src/editors/decorations/imageToolbar.ts:996:  document.addEventListener("keydown", maximizeKeyHandler, true);
src/editors/decorations/imageToolbar.ts:1005:    document.removeEventListener("keydown", maximizeKeyHandler, true);
src/editors/orchestration/block-menu.ts:516:        option.dataset.active = String(type.key === current);
src/editors/orchestration/block-menu.ts:932:  const onKeyDown = (event: KeyboardEvent): void => {
src/editors/orchestration/block-menu.ts:938:  document.addEventListener("keydown", onKeyDown, true);
src/editors/orchestration/block-menu.ts:948:      document.removeEventListener("keydown", onKeyDown, true);
src/editors/orchestration/toolbar-shared.ts:188:    document.addEventListener("keydown", closeOnEscape);
src/editors/orchestration/toolbar-shared.ts:196:    document.removeEventListener("keydown", closeOnEscape);
src/editors/orchestration/toolbar-shared.ts:203:  function closeOnEscape(e: KeyboardEvent): void {
src/editors/orchestration/toolbar-shared.ts:204:    if (e.key === "Escape") closeMenu();
src/editors/decorations/callout.ts:398:  editor.addEventListener("keydown", (event) => {
src/editors/decorations/callout.ts:402:      if (event.key === "Enter") {
src/editors/decorations/callout.ts:407:      if (event.key === "ArrowDown") {
src/editors/decorations/callout.ts:412:      if (event.key === "ArrowUp") {
src/editors/decorations/callout.ts:417:      if (event.key === "Escape") {
src/editors/decorations/callout.ts:423:    if (event.key === "Escape") {
src/editors/decorations/callout.ts:573:  input.addEventListener("keydown", (event) => {
src/editors/decorations/callout.ts:575:    if (event.key === "Enter") {
src/editors/decorations/callout.ts:578:    } else if (event.key === "Escape") {
src/editors/decorations/callout.ts:704:      iconEl.addEventListener("keydown", (event) => {

exec
/bin/zsh -lc "nl -ba src/lib/gridKeyboard.ts | sed -n '1,280p'; nl -ba src/editors/key-chord.ts | sed -n '1,300p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
     1	/**
     2	 * 网格键盘导航（layout-portal 11.1）——纯逻辑层。
     3	 *
     4	 * 只消费 DOM 几何（getBoundingClientRect 的结果）与视口矩形，无 DOM / 无 store /
     5	 * 无 React。渲染侧（components/GridView.tsx）负责量取几何、调用本层、把结果写回
     6	 * `gridSelectedPath`；单测与 e2e 断言的是同一份确定性契约。
     7	 *
     8	 * 语义（批准设计 §5）：
     9	 * - j/k 上下「整行」：以当前卡为基准找下一个视觉行，行内取 x 中心最近者；
    10	 * - h/l 行内左右：仅承认与当前卡垂直重叠 ≥ 50% 的「同一行」卡，取最近边；
    11	 *   无同行候选时返回 null（不跨行）；
    12	 * - PageDown/PageUp 整页：scrollTop ±= 容器高 − 24px；
    13	 * - 按住 ⌘ 显示的视口编号：按视觉阅读顺序（先上后左）取前 N 张。
    14	 */
    15	
    16	/** 一张卡在视口坐标系下的外接矩形（已含滚动偏移，可直接比较）。 */
    17	export interface GridBox {
    18	  path: string;
    19	  top: number;
    20	  bottom: number;
    21	  left: number;
    22	  right: number;
    23	}
    24	
    25	/** 视口 / 容器可见矩形（同样在视口坐标系下）。 */
    26	export interface GridViewport {
    27	  top: number;
    28	  bottom: number;
    29	  left: number;
    30	  right: number;
    31	}
    32	
    33	/** 几何比较容差（px）：吸收 sub-pixel 与边框取整误差。 */
    34	const EPS = 1;
    35	
    36	function centerX(box: GridBox): number {
    37	  return (box.left + box.right) / 2;
    38	}
    39	
    40	/** 两矩形是否相交（边贴边不算相交）。 */
    41	function intersects(box: GridBox, vp: GridViewport): boolean {
    42	  return (
    43	    box.bottom > vp.top &&
    44	    box.top < vp.bottom &&
    45	    box.right > vp.left &&
    46	    box.left < vp.right
    47	  );
    48	}
    49	
    50	/**
    51	 * 视口内可见卡片的编号顺序（视觉阅读顺序：先按 top 升序，再按 left 升序），
    52	 * 最多取 `limit` 张。传入顺序不要求已排序。
    53	 */
    54	export function sequenceOfVisible(
    55	  boxes: readonly GridBox[],
    56	  viewport: GridViewport,
    57	  limit = 9,
    58	): string[] {
    59	  return boxes
    60	    .filter((b) => intersects(b, viewport))
    61	    .sort((a, b) => a.top - b.top || a.left - b.left)
    62	    .slice(0, limit)
    63	    .map((b) => b.path);
    64	}
    65	
    66	/**
    67	 * 竖直移动（j/k）：找「下一个视觉行」，行内取 x 中心最近者。
    68	 *
    69	 * 行的判定：候选卡的 `top` 不早于当前卡 `bottom`（下行），或 `bottom` 不晚于
    70	 * 当前卡 `top`（上行）。这样 2×2 大卡不会被误判成它跨越的某一行里的邻居。
    71	 * 先最小化行间距，再最小化 x 中心距离；都没有时退回数组顺序 ±1。
    72	 */
    73	export function moveVertical(
    74	  boxes: readonly GridBox[],
    75	  currentPath: string,
    76	  dir: 1 | -1,
    77	): string | null {
    78	  const idx = boxes.findIndex((b) => b.path === currentPath);
    79	  if (idx < 0) return null;
    80	  const current = boxes[idx];
    81	
    82	  let best: GridBox | null = null;
    83	  let bestRowDist = Infinity;
    84	  let bestXDist = Infinity;
    85	
    86	  for (let i = 0; i < boxes.length; i += 1) {
    87	    if (i === idx) continue;
    88	    const candidate = boxes[i];
    89	    const rowDist =
    90	      dir === 1
    91	        ? candidate.top - current.bottom
    92	        : current.top - candidate.bottom;
    93	    if (rowDist < -EPS) continue;
    94	    const rowScore = Math.max(0, rowDist);
    95	    const xDist = Math.abs(centerX(candidate) - centerX(current));
    96	    if (
    97	      best === null ||
    98	      rowScore < bestRowDist - EPS ||
    99	      (Math.abs(rowScore - bestRowDist) <= EPS && xDist < bestXDist)
   100	    ) {
   101	      best = candidate;
   102	      bestRowDist = rowScore;
   103	      bestXDist = xDist;
   104	    }
   105	  }
   106	
   107	  if (best) return best.path;
   108	  const fallback = idx + dir;
   109	  return fallback >= 0 && fallback < boxes.length ? boxes[fallback].path : null;
   110	}
   111	
   112	/**
   113	 * 水平移动（h/l）：只承认与当前卡「同一行」的候选——垂直重叠 ≥ 两卡较小高度的
   114	 * 50%。方向上取最近边（右移取 `left - current.right`，左移取 `current.left - right`）；
   115	 * 无同行候选时返回 null（不跨行）。
   116	 */
   117	export function moveHorizontal(
   118	  boxes: readonly GridBox[],
   119	  currentPath: string,
   120	  dir: 1 | -1,
   121	): string | null {
   122	  const idx = boxes.findIndex((b) => b.path === currentPath);
   123	  if (idx < 0) return null;
   124	  const current = boxes[idx];
   125	  const currentHeight = current.bottom - current.top;
   126	
   127	  let best: GridBox | null = null;
   128	  let bestEdge = Infinity;
   129	
   130	  for (let i = 0; i < boxes.length; i += 1) {
   131	    if (i === idx) continue;
   132	    const candidate = boxes[i];
   133	    const candidateHeight = candidate.bottom - candidate.top;
   134	    const minHeight = Math.min(currentHeight, candidateHeight);
   135	    if (minHeight <= 0) continue;
   136	    const overlap =
   137	      Math.min(current.bottom, candidate.bottom) -
   138	      Math.max(current.top, candidate.top);
   139	    if (overlap / minHeight < 0.5) continue;
   140	
   141	    const edge =
   142	      dir === 1
   143	        ? candidate.left - current.right
   144	        : current.left - candidate.right;
   145	    if (edge < -EPS) continue;
   146	    const score = Math.max(0, edge);
   147	    if (best === null || score < bestEdge - EPS) {
   148	      best = candidate;
   149	      bestEdge = score;
   150	    }
   151	  }
   152	
   153	  return best ? best.path : null;
   154	}
   155	
   156	/** 整页步长：容器高 − 24px（24px 作上下文重叠，避免跨页时漏看一行）。 */
   157	export function pageStep(clientHeight: number): number {
   158	  return Math.max(0, clientHeight - 24);
   159	}
   160	
   161	/**
   162	 * 从 `KeyboardEvent.code` 解析 1–9 数字键（含小键盘 `Numpad1`–`Numpad9`）。
   163	 * 必须用 code 而非 key：mac 上 Alt+3 / Shift+3 的 `key` 会是怪字符，
   164	 * code 恒为 `Digit3`。
   165	 */
   166	export function digitFromCode(code: string): number | null {
   167	  const match = /^(?:Digit|Numpad)([1-9])$/.exec(code);
   168	  return match ? Number(match[1]) : null;
   169	}
     1	/* 快捷键和弦显示格式化（移植自 md-bundle packages/editor/src/keybindings.ts）。
     2	 *
     3	 * 纯函数，不碰 DOM：平台判定可注入，测试因此是确定性的。
     4	 */
     5	
     6	/**
     7	 * 判定当前平台是否 macOS。
     8	 *
     9	 * 非浏览器环境（jsdom、Node）里 `navigator.platform` 可能为空，
    10	 * 此时按非 mac 处理，保证测试输出稳定。
    11	 */
    12	export function isMacPlatform(): boolean {
    13	  if (typeof navigator === "undefined") return false;
    14	  const platform = navigator.platform ?? "";
    15	  const userAgent = navigator.userAgent ?? "";
    16	  return /Mac|iPhone|iPad|iPod/.test(platform) || /Mac OS X/.test(userAgent);
    17	}
    18	
    19	/**
    20	 * 把 CM6 键位和弦格式化成展示文本。
    21	 *
    22	 * 规则：
    23	 * - 按 `-` 切分 token。
    24	 * - `Mod` → mac `⌘` / 非 mac `Ctrl`
    25	 * - `Shift` → mac `⇧` / 非 mac `Shift`
    26	 * - `Alt` → mac `⌥` / 非 mac `Alt`
    27	 * - 字母/数字 token 转大写。
    28	 * - mac 无分隔符拼接：`⌘B`、`⌘⇧X`、`⌘⌥1`
    29	 * - 非 mac 用 `+` 拼接：`Ctrl+B`、`Ctrl+Shift+X`、`Ctrl+Alt+1`
    30	 * - 空串/未知 token 不抛错。
    31	 *
    32	 * `isMac` 参数让测试可注入平台；省略时用 `isMacPlatform()`。
    33	 */
    34	export function formatKeyChord(chord: string, isMac?: boolean): string {
    35	  if (!chord) return "";
    36	  const mac = isMac ?? isMacPlatform();
    37	  const tokens = chord.split("-");
    38	  const formatted = tokens.map((token) => {
    39	    const t = token.trim();
    40	    if (!t) return "";
    41	    const lower = t.toLowerCase();
    42	    if (lower === "mod") return mac ? "⌘" : "Ctrl";
    43	    if (lower === "shift") return mac ? "⇧" : "Shift";
    44	    if (lower === "alt") return mac ? "⌥" : "Alt";
    45	    // 字母/数字 token：转大写（'b' → 'B'，'1' → '1'）
    46	    return t.toUpperCase();
    47	  });
    48	  const filtered = formatted.filter((t) => t !== "");
    49	  return mac ? filtered.join("") : filtered.join("+");
    50	}

exec
/bin/zsh -lc 'rg -n "keys:|shortcut|hotkey|rouletteHotkey|keybind" src/App.tsx src/editors src/components src/hooks src/stores | head -n 400' in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src/App.tsx:38:} from "./editors/keybindings";
src/App.tsx:87:  const [shortcutsOpen, setShortcutsOpen] = useState(false);
src/App.tsx:277:  // ── Capture Overlay — Cmd+Shift+. global shortcut ─────────────────
src/App.tsx:334:  // ── Keyboard shortcuts ───────────────────────────────────────
src/App.tsx:717:        if (shortcutsOpen) {
src/App.tsx:781:    shortcutsOpen,
src/App.tsx:1001:        open={shortcutsOpen}
src/hooks/useConfig.ts:75:  rouletteHotkey?: string | null;
src/hooks/useConfig.ts:178:    rouletteHotkey: es.config.rouletteHotkey ?? null,
src/hooks/useConfig.ts:421:    rouletteHotkey: raw.rouletteHotkey ? raw.rouletteHotkey : null,
src/editors/slash.ts:932:    const keybind = slashKeybind(cmd.id);
src/editors/slash.ts:933:    if (keybind !== "") {
src/editors/slash.ts:936:      kbd.textContent = keybind;
src/editors/slash.ts:1764:    const keybind = slashKeybind(cmd.id);
src/editors/slash.ts:1765:    if (keybind !== "") {
src/editors/slash.ts:1768:      kbd.textContent = keybind;
src/editors/keybindings.ts:5: * CM6 markdown formatting keybindings: Cmd+B (bold), Cmd+I (italic).
src/components/Content/VideoPlayer.tsx:788:      hotkey: true,
src/components/Content/VideoPlayer.tsx:1102:    art.hotkey.add("KeyF", toggleFullscreenWeb);
src/components/Content/VideoPlayer.tsx:1103:    art.hotkey.add("KeyM", () => {
src/components/Content/VideoPlayer.tsx:1108:    art.hotkey.add("KeyN", () => {
src/components/Content/VideoPlayer.tsx:1111:    art.hotkey.add("KeyP", () => {
src/components/Content/VideoPlayer.tsx:1114:    art.hotkey.add("KeyL", () => cycleLoop());
src/components/Content/VideoPlayer.tsx:1117:    art.hotkey.add("KeyC", () => {
src/components/Content/VideoPlayer.tsx:1123:    art.hotkey.add("KeyX", () => toggleSubtitlePos());
src/components/Content/VideoPlayer.tsx:1125:    art.hotkey.add("KeyT", () => openNote());
src/components/Content/VideoPlayer.tsx:1126:    art.hotkey.add("KeyS", () => void captureFrame());
src/components/Content/VideoPlayer.tsx:1127:    art.hotkey.add("KeyI", () => {
src/components/Content/VideoPlayer.tsx:1135:    art.hotkey.add("KeyV", () => {
src/components/Content/VideoPlayer.tsx:1139:    art.hotkey.add("KeyB", () => {
src/components/Content/VideoPlayer.tsx:1143:    art.hotkey.add("KeyR", () => {
src/components/Content/VideoPlayer.tsx:1148:    art.hotkey.add("KeyG", () => {
src/components/Content/VideoPlayer.tsx:1326:  // activeSubtitle ref 同步（供 hotkey 闭包读取最新值）
src/editors/key-chord.ts:1:/* 快捷键和弦显示格式化（移植自 md-bundle packages/editor/src/keybindings.ts）。
src/editors/orchestration/roulette-view.ts:600:      const shortcut = el("span", "sr-filter-shortcut");
src/editors/orchestration/roulette-view.ts:602:        shortcut.textContent = i === 0 ? "回车" : formatShortcut(i + 1);
src/editors/orchestration/roulette-view.ts:603:        shortcut.dataset.shortcut = String(i + 1);
src/editors/orchestration/roulette-view.ts:605:      b.append(shortcut);
src/components/Content/SuggestMenu.tsx:10:import { activateLocalContext } from "../../lib/shortcuts";
src/components/Content/SuggestMenu.tsx:38: * 打开期间把 context 注册进 shortcuts.ts 的局部键上下文。
src/editors/setup.ts:2:import { ctrlHistoryBindings } from "./keybindings";
src/editors/orchestration/floating-toolbar.ts:844:      const chord = es.config.rouletteHotkey ?? ROULETTE_HOTKEY_DEFAULT;
src/components/ShortcutOverlay.tsx:6:  shortcutsByFamily,
src/components/ShortcutOverlay.tsx:7:} from "../lib/shortcuts";
src/components/ShortcutOverlay.tsx:13: * 冲突裁定项在行内显示 `data-testid="shortcut-decision"`。z-index 高于设置场景。
src/components/ShortcutOverlay.tsx:40:      data-testid="shortcut-overlay"
src/components/ShortcutOverlay.tsx:56:            data-testid="shortcut-overlay-close"
src/components/ShortcutOverlay.tsx:68:            const items = shortcutsByFamily(family);
src/components/ShortcutOverlay.tsx:73:                data-shortcut-family={family}
src/components/ShortcutOverlay.tsx:80:                  {items.map((shortcut) => (
src/components/ShortcutOverlay.tsx:82:                      key={shortcut.id}
src/components/ShortcutOverlay.tsx:83:                      data-testid="shortcut-row"
src/components/ShortcutOverlay.tsx:84:                      data-shortcut-id={shortcut.id}
src/components/ShortcutOverlay.tsx:88:                        {shortcut.label}
src/components/ShortcutOverlay.tsx:89:                        {shortcut.decision && (
src/components/ShortcutOverlay.tsx:91:                            data-testid="shortcut-decision"
src/components/ShortcutOverlay.tsx:94:                            {shortcut.decision}
src/components/ShortcutOverlay.tsx:99:                        {shortcut.keys}
src/components/TooltipLayer.tsx:61:  Record<string, { shortcut: string; markdown?: string }>
src/components/TooltipLayer.tsx:63:  "format-underline": { shortcut: "⌘ + U", markdown: "~文本~ 空格" },
src/components/TooltipLayer.tsx:64:  duplicate: { shortcut: "⌘ + C" },
src/components/TooltipLayer.tsx:114:  if (visibleLabel(el) !== "") return { main: meta.shortcut, hint: null };
src/components/TooltipLayer.tsx:116:    main: `${name} (${meta.shortcut})`,
src/components/SettingsView.tsx:55:  shortcutsByFamily,
src/components/SettingsView.tsx:56:} from "../lib/shortcuts";
src/components/SettingsView.tsx:94:  { id: "shortcuts", label: "快捷键" },
src/components/SettingsView.tsx:630:  const rouletteHotkey = useEditorStore((s) => s.config.rouletteHotkey ?? null);
src/components/SettingsView.tsx:958:    setConfig({ rouletteHotkey: value.trim() ? value : null });
src/components/SettingsView.tsx:961:    if (!rouletteHotkey?.trim()) setConfig({ rouletteHotkey: null });
src/components/SettingsView.tsx:1446:                    value={rouletteHotkey ?? ""}
src/components/SettingsView.tsx:1457:                    data-testid="settings-roulette-hotkey"
src/components/SettingsView.tsx:2438:          {active === "shortcuts" && (
src/components/SettingsView.tsx:2444:                {coreShortcuts().map((shortcut) => (
src/components/SettingsView.tsx:2446:                    key={shortcut.id}
src/components/SettingsView.tsx:2447:                    data-testid="shortcut-core"
src/components/SettingsView.tsx:2451:                      {shortcut.label}
src/components/SettingsView.tsx:2454:                      {shortcut.keys}
src/components/SettingsView.tsx:2461:                data-testid="shortcuts-full-toggle"
src/components/SettingsView.tsx:2468:                <div data-testid="shortcuts-full" className="mt-4 space-y-4">
src/components/SettingsView.tsx:2470:                    const items = shortcutsByFamily(family);
src/components/SettingsView.tsx:2478:                          {items.map((shortcut) => (
src/components/SettingsView.tsx:2480:                              key={shortcut.id}
src/components/SettingsView.tsx:2481:                              data-testid="shortcut-full-row"
src/components/SettingsView.tsx:2485:                                {shortcut.label}
src/components/SettingsView.tsx:2488:                                {shortcut.keys}

exec
/bin/zsh -lc "nl -ba src/lib/shortcuts.ts | sed -n '1,80p;500,570p'; rg -n \"export const|export function|const .*KEY|bind|keyboard\" src/lib/shortcuts.ts src/editors/keybindings.ts" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
     1	/**
     2	 * 快捷键注册表（layout-portal 15.1 / R-10）。
     3	 *
     4	 * 唯一真相源：实际 keymap 绑定、tooltip 键位显示、`?` 总览浮层、设置快捷键区
     5	 * 都从这里渲染。新增/调整快捷键只改本文件，四处消费点自动同源。
     6	 *
     7	 * 设计规则（批准设计 §11）：单 ⌘ 高频 / ⌘⇧ 二级 / ⌘⌥ 分栏 / ⌥ 过滤 / 不用三修饰键。
     8	 */
     9	
    10	export type ShortcutFamily =
    11	  | "global"
    12	  | "typeFilter"
    13	  | "mode"
    14	  | "file"
    15	  | "workspace"
    16	  | "navigation"
    17	  | "card"
    18	  | "ai"
    19	  | "media"
    20	  | "local";
    21	
    22	export type ShortcutScope = "global" | "local";
    23	
    24	export interface ShortcutDef {
    25	  id: string;
    26	  /** 展示形式，如 "⌘P"、"⌥4"、"⌘⌥→"。 */
    27	  keys: string;
    28	  label: string;
    29	  family: ShortcutFamily;
    30	  /** 作用域：global（默认，任意处生效）/ local（仅在其 context 激活时生效并优先于全局）。 */
    31	  scope?: ShortcutScope;
    32	  /** 局部键的生效上下文描述；scope 为 local 时必填。 */
    33	  context?: string;
    34	  /** 设置页「核心快捷键」展示的 7 条。 */
    35	  core?: boolean;
    36	  /** 冲突裁定说明：仅在有旧绑定竞争时填写，总览浮层会显示。 */
    37	  decision?: string;
    38	  implemented: boolean;
    39	}
    40	
    41	export const SHORTCUT_FAMILY_LABELS: Record<ShortcutFamily, string> = {
    42	  global: "全局",
    43	  typeFilter: "类型过滤",
    44	  mode: "模式",
    45	  file: "文件",
    46	  workspace: "工作区",
    47	  navigation: "导航",
    48	  card: "卡片直开",
    49	  ai: "AI / 其他",
    50	  media: "媒体",
    51	  local: "局部（上下文）",
    52	};
    53	
    54	/** 家族展示顺序（总览浮层与设置完整列表按此顺序分组）。 */
    55	export const SHORTCUT_FAMILY_ORDER: readonly ShortcutFamily[] = [
    56	  "global",
    57	  "typeFilter",
    58	  "mode",
    59	  "file",
    60	  "workspace",
    61	  "navigation",
    62	  "card",
    63	  "ai",
    64	  "media",
    65	  "local",
    66	];
    67	
    68	export const SHORTCUTS: readonly ShortcutDef[] = [
    69	  // ── 全局（10）─────────────────────────────────────────────
    70	  {
    71	    id: "global-quick-open",
    72	    keys: "⌘P",
    73	    label: "快速打开",
    74	    family: "global",
    75	    core: true,
    76	    decision: "页签 / 最近文件 / 命令；统一文件面板见 B-3",
    77	    implemented: true,
    78	  },
    79	  {
    80	    id: "global-reading-rail",
   500	    keys: "X",
   501	    label: "字幕上 / 下",
   502	    family: "media",
   503	    implemented: true,
   504	  },
   505	  {
   506	    id: "media-timestamp-note",
   507	    keys: "T",
   508	    label: "时间戳笔记",
   509	    family: "media",
   510	    implemented: true,
   511	  },
   512	
   513	  // ── 局部（上下文激活时生效，优先于全局同名键）────────────────
   514	  {
   515	    id: "local-doc-menu-pick",
   516	    keys: "⌘1–9",
   517	    label: "文档链接菜单直选",
   518	    family: "local",
   519	    scope: "local",
   520	    context: "属性面板 [[ 文档菜单打开",
   521	    implemented: true,
   522	  },
   523	  {
   524	    id: "local-tag-menu-pick",
   525	    keys: "⌘1–9",
   526	    label: "标签建议菜单直选",
   527	    family: "local",
   528	    scope: "local",
   529	    context: "属性面板标签建议菜单打开",
   530	    implemented: true,
   531	  },
   532	];
   533	
   534	/** 设置页「核心快捷键」的 7 条。 */
   535	export function coreShortcuts(): ShortcutDef[] {
   536	  return SHORTCUTS.filter((s) => s.core);
   537	}
   538	
   539	/** 按家族取条目（总览浮层与设置完整列表共用）。 */
   540	export function shortcutsByFamily(family: ShortcutFamily): ShortcutDef[] {
   541	  return SHORTCUTS.filter((s) => s.family === family);
   542	}
   543	
   544	const activeLocalContexts = new Set<string>();
   545	
   546	/** 激活局部键上下文（建议菜单等局部 UI 打开时调用）；返回注销函数。 */
   547	export function activateLocalContext(context: string): () => void {
   548	  activeLocalContexts.add(context);
   549	  return () => {
   550	    activeLocalContexts.delete(context);
   551	  };
   552	}
   553	
   554	export function isLocalContextActive(context: string): boolean {
   555	  return activeLocalContexts.has(context);
   556	}
   557	
   558	/** 该局部键在其上下文激活时生效（未激活或 id/context 不匹配返回 false）。 */
   559	export function isLocalShortcutActive(id: string, context: string): boolean {
   560	  if (!activeLocalContexts.has(context)) return false;
   561	  return SHORTCUTS.some(
   562	    (s) => s.id === id && s.scope === "local" && s.context === context,
   563	  );
   564	}
src/editors/keybindings.ts:5: * CM6 markdown formatting keybindings: Cmd+B (bold), Cmd+I (italic).
src/editors/keybindings.ts:7:export function formattingKeymap() {
src/editors/keybindings.ts:24:export const ctrlHistoryBindings: KeyBinding[] = [
src/editors/keybindings.ts:31:export function undoOnce(view: EditorView): boolean {
src/editors/keybindings.ts:36:export function redoOnce(view: EditorView): boolean {
src/editors/keybindings.ts:40:export function toggleBold(view: EditorView): boolean {
src/editors/keybindings.ts:45:export function toggleItalic(view: EditorView): boolean {
src/lib/shortcuts.ts:41:export const SHORTCUT_FAMILY_LABELS: Record<ShortcutFamily, string> = {
src/lib/shortcuts.ts:55:export const SHORTCUT_FAMILY_ORDER: readonly ShortcutFamily[] = [
src/lib/shortcuts.ts:68:export const SHORTCUTS: readonly ShortcutDef[] = [
src/lib/shortcuts.ts:535:export function coreShortcuts(): ShortcutDef[] {
src/lib/shortcuts.ts:540:export function shortcutsByFamily(family: ShortcutFamily): ShortcutDef[] {
src/lib/shortcuts.ts:547:export function activateLocalContext(context: string): () => void {
src/lib/shortcuts.ts:554:export function isLocalContextActive(context: string): boolean {
src/lib/shortcuts.ts:559:export function isLocalShortcutActive(id: string, context: string): boolean {

exec
/bin/zsh -lc "nl -ba src/components/Content/SuggestMenu.tsx | sed -n '1,130p'; rg -n \"isLocalShortcutActive|activateLocalContext|SHORTCUTS\" src --glob '"'!src/lib/shortcuts.ts'"' --glob '"'!src/__tests__/lib/shortcuts.test.ts'"'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
     1	import {
     2	  useEffect,
     3	  useLayoutEffect,
     4	  useRef,
     5	  type ReactNode,
     6	  type RefObject,
     7	} from "react";
     8	import { createPortal } from "react-dom";
     9	import { digitFromCode } from "../../lib/gridKeyboard";
    10	import { activateLocalContext } from "../../lib/shortcuts";
    11	
    12	export interface SuggestRow {
    13	  id: string;
    14	  label: string;
    15	  icon?: ReactNode;
    16	}
    17	
    18	interface SuggestMenuProps {
    19	  rows: SuggestRow[];
    20	  selected: number;
    21	  onPick: (index: number) => void;
    22	  onMove: (delta: 1 | -1) => void;
    23	  onEmptyEnter?: () => void;
    24	  onClose: () => void;
    25	  anchor: { x: number; y: number } | null;
    26	  context: string;
    27	  hostRef: RefObject<HTMLElement | null>;
    28	  testId: string;
    29	  rowTestId: string;
    30	  emptyText?: string;
    31	}
    32	
    33	/**
    34	 * 建议菜单（文档链接 / 标签建议共用一份实现）。
    35	 *
    36	 * 键盘在 host 的 capture 阶段拦截 ⌘1~9 / Enter / ↑↓ / Esc 并 stopPropagation，
    37	 * 局部键因此优先于全局「卡片直开 ⌘1–9」；菜单关闭即解除，无残留占用。
    38	 * 打开期间把 context 注册进 shortcuts.ts 的局部键上下文。
    39	 */
    40	export default function SuggestMenu({
    41	  rows,
    42	  selected,
    43	  onPick,
    44	  onMove,
    45	  onEmptyEnter,
    46	  onClose,
    47	  anchor,
    48	  context,
    49	  hostRef,
    50	  testId,
    51	  rowTestId,
    52	  emptyText,
    53	}: SuggestMenuProps) {
    54	  const menuRef = useRef<HTMLSpanElement>(null);
    55	
    56	  useEffect(() => {
    57	    const off = activateLocalContext(context);
    58	    return off;
    59	  }, [context]);
    60	
    61	  useLayoutEffect(() => {
    62	    const host = hostRef.current;
    63	    if (!host) return;
    64	    const onKey = (e: KeyboardEvent) => {
    65	      const meta = e.metaKey || e.ctrlKey;
    66	      let handled = true;
    67	      if (e.key === "ArrowDown") onMove(1);
    68	      else if (e.key === "ArrowUp") onMove(-1);
    69	      else if (e.key === "Enter") {
    70	        if (rows.length > 0) onPick(selected);
    71	        else onEmptyEnter?.();
    72	      } else if (e.key === "Escape") onClose();
    73	      else if (meta) {
    74	        const digit = digitFromCode(e.code);
    75	        if (digit !== null && digit <= rows.length) onPick(digit - 1);
    76	        else handled = false;
    77	      } else handled = false;
    78	
    79	      if (handled) {
    80	        e.preventDefault();
    81	        e.stopPropagation();
    82	      }
    83	    };
    84	    host.addEventListener("keydown", onKey, { capture: true });
    85	    return () => host.removeEventListener("keydown", onKey, { capture: true });
    86	  }, [hostRef, rows, selected, onPick, onMove, onEmptyEnter, onClose]);
    87	
    88	  useLayoutEffect(() => {
    89	    const onDown = (e: MouseEvent) => {
    90	      const target = e.target as Node;
    91	      if (hostRef.current?.contains(target)) return;
    92	      if (menuRef.current?.contains(target)) return;
    93	      onClose();
    94	    };
    95	    document.addEventListener("mousedown", onDown);
    96	    return () => document.removeEventListener("mousedown", onDown);
    97	  }, [hostRef, onClose]);
    98	
    99	  if (!anchor) return null;
   100	
   101	  return createPortal(
   102	    <span
   103	      ref={menuRef}
   104	      className="dpb-menu"
   105	      data-testid={testId}
   106	      role="menu"
   107	      aria-label="建议"
   108	      style={{ left: anchor.x, top: anchor.y }}
   109	    >
   110	      {rows.length === 0 ? (
   111	        <span className="dpb-menu-row dpb-menu-empty">
   112	          {emptyText ?? "没有匹配项"}
   113	        </span>
   114	      ) : (
   115	        rows.map((row, i) => (
   116	          <button
   117	            key={row.id}
   118	            type="button"
   119	            role="menuitem"
   120	            className={`dpb-menu-row${i === selected ? " dpb-menu-row-cur" : ""}`}
   121	            data-testid={rowTestId}
   122	            data-index={i}
   123	            aria-current={i === selected}
   124	            onMouseDown={(e) => e.preventDefault()}
   125	            onClick={() => onPick(i)}
   126	          >
   127	            {row.icon ? <span className="dpb-menu-ico">{row.icon}</span> : null}
   128	            <span className="dpb-menu-label">{row.label}</span>
   129	            <span className="dpb-menu-key">
   130	              {i === selected ? "⏎" : `⌘${i + 1}`}
src/components/ShortcutOverlay.tsx:12: * `?` 全局开关（App 层处理），全表与 `SHORTCUTS` 注册表严格相等；按家族分组，
src/components/Content/SuggestMenu.tsx:10:import { activateLocalContext } from "../../lib/shortcuts";
src/components/Content/SuggestMenu.tsx:57:    const off = activateLocalContext(context);

exec
/bin/zsh -lc "nl -ba src/App.tsx | sed -n '400,780p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
   400	  }, [openGridOverview]);
   401	  const handleQuickOpenSettings = useCallback(() => {
   402	    setQuickOpenOpen(false);
   403	    openSettings();
   404	  }, [openSettings]);
   405	
   406	  // macOS 原生菜单（Cmd+=/-/0）拦截键盘，由 Rust 侧菜单项转发为 preview-scale 事件
   407	  useEffect(() => {
   408	    if (!isTauri) return;
   409	    let unlisten: (() => void) | undefined;
   410	    listen<number>("preview-scale", (e) => handleScaleDelta(e.payload))
   411	      .then((un) => {
   412	        unlisten = un;
   413	      })
   414	      .catch(() => {});
   415	    return () => {
   416	      unlisten?.();
   417	    };
   418	  }, [handleScaleDelta]);
   419	
   420	  useEffect(() => {
   421	    const handler = (e: KeyboardEvent) => {
   422	      const meta = e.metaKey || e.ctrlKey;
   423	      const store = useStore.getState();
   424	
   425	      // Cmd/Ctrl+P：阻止浏览器原生打印，改为打开快速打开（页签/最近文件/命令）。
   426	      // 已打开时再按一次关闭；输入法组合态（e.isComposing）不拦截，避免打断上屏。
   427	      if (
   428	        meta &&
   429	        !e.shiftKey &&
   430	        e.key.toLowerCase() === "p" &&
   431	        !e.isComposing
   432	      ) {
   433	        e.preventDefault();
   434	        setQuickOpenQuery("");
   435	        setQuickOpenOpen((v) => !v);
   436	        return;
   437	      }
   438	
   439	      // 快速打开打开时，其余全局快捷键让位（Esc/↑↓/Enter 由 QuickOpen 自行拦截）。
   440	      if (quickOpenOpen) return;
   441	
   442	      const questionKey = e.key === "?" || (e.key === "/" && e.shiftKey);
   443	      if (questionKey && !meta && !e.altKey && !isEditableTarget(e.target)) {
   444	        e.preventDefault();
   445	        setShortcutsOpen((v) => !v);
   446	        return;
   447	      }
   448	
   449	      if (e.altKey && !meta && !e.shiftKey) {
   450	        if (isEditableTarget(e.target)) return;
   451	        const kind = kindFromDigitCode(e.code);
   452	        if (kind !== undefined) {
   453	          e.preventDefault();
   454	          if (store.scene === "grid") {
   455	            store.setGridTypeFilter(kind);
   456	          } else if (store.scene === "workspace") {
   457	            store.setRailChip(kind ?? "all");
   458	            store.setRailSection("category");
   459	            if (store.railState === "collapsed") store.setRailState("hover");
   460	          }
   461	          return;
   462	        }
   463	      }
   464	
   465	      // Cmd+Shift+\ : 打开网格概览（任意场景可用，门户里也能直接进）
   466	      if (meta && e.shiftKey && (e.key === "\\" || e.key === "|")) {
   467	        e.preventDefault();
   468	        openGridOverview();
   469	        return;
   470	      }
   471	
   472	      // Cmd+Shift+X: 左边栏固定隐藏 / 取消（C3 / D14）。隐藏后箭头热区收起，滑入不唤出。
   473	      if (meta && e.shiftKey && e.key.toLowerCase() === "x") {
   474	        // 设置场景是覆盖层：底下 rails 不可见，静默改隐藏态用户无从察觉（对抗复审 #924 越界）。
   475	        if (store.scene === "settings") return;
   476	        e.preventDefault();
   477	        const es = useEditorStore.getState();
   478	        const next = !(es.config.railPinHidden ?? false);
   479	        es.setConfig({ railPinHidden: next });
   480	        if (next) store.setRailState("collapsed");
   481	        void saveAppConfig();
   482	        return;
   483	      }
   484	
   485	      // 门户/网格是覆盖层：底下的编辑器不可见，快捷键作用上去用户看不见后果
   486	      // （⌘W 关掉隐藏页签、⌘B 改隐藏文档……）。这里只放行不触碰隐藏状态的键。
   487	      if (store.scene !== "workspace") {
   488	        if (!meta) return;
   489	        const k = e.key.toLowerCase();
   490	        if (!["o", "n", ",", "p", "k", "a"].includes(k)) return;
   491	      }
   492	
   493	      // Cmd+O: Open file
   494	      if (meta && e.key === "o") {
   495	        e.preventDefault();
   496	        handleOpenFile();
   497	      }
   498	
   499	      // Cmd+S: Save
   500	      if (meta && e.key === "s") {
   501	        e.preventDefault();
   502	        handleSaveFile();
   503	      }
   504	
   505	      // Cmd+N: New file
   506	      if (meta && e.key === "n") {
   507	        e.preventDefault();
   508	        handleNewFile();
   509	      }
   510	
   511	      // Cmd+T: New tab in the focused pane
   512	      if (meta && !e.shiftKey && e.key.toLowerCase() === "t") {
   513	        e.preventDefault();
   514	        store.newTab();
   515	      }
   516	
   517	      // Cmd+W: Close active tab
   518	      if (meta && e.key === "w" && activeTabId) {
   519	        e.preventDefault();
   520	        store.closeTab(activeTabId);
   521	      }
   522	
   523	      // 固定隐藏是 collapsed 的强化态：其它可见性快捷键先取消隐藏，
   524	      // 再按「视 hidden = collapsed」走既有语义。
   525	      const revealIfHidden = (): boolean => {
   526	        const es = useEditorStore.getState();
   527	        if (es.config.railPinHidden ?? false) {
   528	          es.setConfig({ railPinHidden: false });
   529	          void saveAppConfig();
   530	          return true;
   531	        }
   532	        return false;
   533	      };
   534	
   535	      // Cmd+Alt+\ : 固定 / 取消固定左边栏（layout-portal 6.1 / D4）。
   536	      // 钉住 ↔ 悬停；折叠态先展开为钉住。必须排在 ⌘\ 之前（同键，先判 alt）。
   537	      if (meta && e.altKey && e.key === "\\") {
   538	        e.preventDefault();
   539	        const base = revealIfHidden() ? "collapsed" : store.railState;
   540	        store.setRailState(base === "pinned" ? "hover" : "pinned");
   541	        return;
   542	      }
   543	
   544	      // Cmd+\ : 统一切换左边栏可见性——折叠态切到钉住，钉住 / 悬停切到折叠。
   545	      // 不再在折叠态兼作沉浸阅读（沉浸阅读由 ⌘⇧F 专责）。
   546	      if (meta && e.key === "\\") {
   547	        e.preventDefault();
   548	        const base = revealIfHidden() ? "collapsed" : store.railState;
   549	        store.setRailState(base === "collapsed" ? "pinned" : "collapsed");
   550	        return;
   551	      }
   552	
   553	      // Cmd+Shift+T : Toggle chrome visibility inside immersive mode — A-5
   554	      // 沉浸态保留旧语义；非沉浸态让位给 AI 翻译（layout-portal 15.1 裁定）。
   555	      if (
   556	        meta &&
   557	        e.shiftKey &&
   558	        e.key.toLowerCase() === "t" &&
   559	        store.readingMode
   560	      ) {
   561	        e.preventDefault();
   562	        store.setImmersiveChromeVisible(!store.immersiveChromeVisible);
   563	      }
   564	
   565	      if (
   566	        meta &&
   567	        e.shiftKey &&
   568	        e.key.toLowerCase() === "t" &&
   569	        !store.readingMode
   570	      ) {
   571	        e.preventDefault();
   572	        store.setScene("workspace");
   573	        const ai = useAiEntryStore.getState();
   574	        ai.setInput("翻译选中的内容");
   575	        ai.openOverlay();
   576	      }
   577	
   578	      // Cmd+Shift+E: 生成学习页（layout-portal 15.1）
   579	      if (meta && e.shiftKey && e.key.toLowerCase() === "e") {
   580	        e.preventDefault();
   581	        store.setScene("workspace");
   582	        const ai = useAiEntryStore.getState();
   583	        ai.setInput("把这篇文档整理成一份学习页：要点、例子、自测题。");
   584	        ai.openOverlay();
   585	      }
   586	
   587	      // Cmd+Shift+S: collapse panes back to a single root leaf
   588	      if (meta && e.shiftKey && e.key.toLowerCase() === "s") {
   589	        e.preventDefault();
   590	        store.collapsePanes();
   591	      }
   592	
   593	      // Cmd+Shift+H: split the focused pane right
   594	      if (meta && e.shiftKey && e.key.toLowerCase() === "h") {
   595	        e.preventDefault();
   596	        store.splitPane("row");
   597	      }
   598	
   599	      // Cmd+Shift+V: 悬浮预览总开关（layout-portal 8.1）。
   600	      // 旧「向下分屏」的 ⌘⇧V 已移除——它与 ⌘⌥↓ 语义重复，让位给预览开关。
   601	      if (meta && e.shiftKey && e.key.toLowerCase() === "v") {
   602	        e.preventDefault();
   603	        store.togglePreviewEnabled();
   604	      }
   605	
   606	      // Cmd+Shift+Y: 属性面板显隐（doc-property-panel / P-2）。
   607	      // 只切显示状态，不改文档内容；隐藏时面板位置显示恢复提示。
   608	      if (meta && e.shiftKey && e.key.toLowerCase() === "y") {
   609	        e.preventDefault();
   610	        useDocPropertyPanelStore.getState().toggleHidden();
   611	      }
   612	
   613	      // Cmd+Shift+F: 沉浸阅读开关（layout-portal 15.1）
   614	      if (meta && e.shiftKey && e.key.toLowerCase() === "f") {
   615	        e.preventDefault();
   616	        store.setReadingMode(!store.readingMode);
   617	      }
   618	
   619	      // Cmd+Shift+P: 收藏当前文件（layout-portal 15.1）
   620	      if (meta && e.shiftKey && e.key.toLowerCase() === "p") {
   621	        e.preventDefault();
   622	        const tab = store.activeTabId ? store.tabs[store.activeTabId] : null;
   623	        if (tab?.path) store.togglePinnedPath(tab.path);
   624	      }
   625	
   626	      // Cmd+Shift+D 的 ⌘⇧D 分支已移到下方 document capture 阶段（见 captureHandler）：
   627	      // PDF 视图是 shadow DOM，内部控件可能消费按键，window 冒泡阶段收不到。
   628	
   629	      // Cmd+Alt+Right / Cmd+Alt+Down: split the focused pane (layout-portal 3.1)
   630	      if (meta && e.altKey && e.key === "ArrowRight") {
   631	        e.preventDefault();
   632	        store.splitPane("row");
   633	      }
   634	      if (meta && e.altKey && e.key === "ArrowDown") {
   635	        e.preventDefault();
   636	        store.splitPane("col");
   637	      }
   638	
   639	      // Cmd+Shift+Enter: fullscreen the focused pane
   640	      if (meta && e.shiftKey && e.key === "Enter") {
   641	        e.preventDefault();
   642	        store.toggleFullscreenPane();
   643	      }
   644	
   645	      // Cmd+Shift+M: Toggle editor mode
   646	      if (meta && e.shiftKey && e.key.toLowerCase() === "m") {
   647	        e.preventDefault();
   648	        const current = activeTab?.editorMode || "preview";
   649	        const next =
   650	          current === "preview"
   651	            ? "edit"
   652	            : current === "edit"
   653	              ? "source"
   654	              : "preview";
   655	        store.setEditorMode(next);
   656	      }
   657	
   658	      // Cmd+Z / Cmd+Shift+Z：焦点不在编辑器时把撤销/重做转给活动编辑器
   659	      if (meta && !e.altKey && e.key.toLowerCase() === "z") {
   660	        const inEditor =
   661	          e.target instanceof Element && e.target.closest(".cm-editor");
   662	        if (
   663	          !inEditor &&
   664	          !isEditableTarget(e.target) &&
   665	          activeTab?.editorMode !== "preview"
   666	        ) {
   667	          // 目标必须是**当前聚焦格**的编辑器。`getActiveEditorView()` 返回最后
   668	          // 一次 CM6 聚焦的面板；分屏下点另一格的页头（focusPane 只更新
   669	          // focusedPaneId，不碰 CM6 焦点）后，撤销会落到上一格的文档上（#915）。
   670	          const view =
   671	            getEditorView(store.focusedPaneId) ?? getActiveEditorView();
   672	          if (view) {
   673	            e.preventDefault();
   674	            if (e.shiftKey) redoOnce(view);
   675	            else undoOnce(view);
   676	            view.focus();
   677	          }
   678	        }
   679	      }
   680	
   681	      // Cmd+B: Bold
   682	      if (meta && e.key === "b") {
   683	        e.preventDefault();
   684	        const view = getActiveEditorView();
   685	        if (view && activeTab?.editorMode !== "preview") {
   686	          toggleBold(view);
   687	        }
   688	      }
   689	
   690	      // Cmd/Ctrl+= / - / 0：markdown/文本/编辑态走字号，图片/HTML/PDF 预览走帧缩放
   691	      if (meta && (e.key === "=" || e.key === "-" || e.key === "0")) {
   692	        e.preventDefault();
   693	        const delta = e.key === "0" ? 0 : e.key === "=" ? 1 : -1;
   694	        handleScaleDelta(delta);
   695	      }
   696	
   697	      // Cmd+,: 打开设置场景
   698	      if (meta && e.key === ",") {
   699	        e.preventDefault();
   700	        openSettings();
   701	        return;
   702	      }
   703	
   704	      if (meta && e.key.toLowerCase() === "k") {
   705	        e.preventDefault();
   706	        useAiEntryStore.getState().toggleOverlay();
   707	      }
   708	
   709	      // Cmd+Shift+A: 切换 AI 小窗 ⇄ 停靠窗格
   710	      if (meta && e.shiftKey && e.key.toLowerCase() === "a") {
   711	        e.preventDefault();
   712	        useAiEntryStore.getState().toggleForm();
   713	      }
   714	
   715	      // Escape: 待确认改动 → 取消；否则按形态关闭 AI；再否则退回全屏/阅读态
   716	      if (e.key === "Escape") {
   717	        if (shortcutsOpen) {
   718	          setShortcutsOpen(false);
   719	          return;
   720	        }
   721	        const ai = useAiEntryStore.getState();
   722	        if (ai.pendingConfirm) {
   723	          ai.cancelPendingSubmit();
   724	        } else if (ai.form === "docked") {
   725	          ai.undock();
   726	          ai.closeBubble();
   727	        } else if (ai.bubbleOpen) {
   728	          ai.closeBubble();
   729	        } else if (store.fullscreenPaneId) {
   730	          store.toggleFullscreenPane();
   731	        } else if (readingMode) {
   732	          store.setReadingMode(false);
   733	        }
   734	      }
   735	    };
   736	
   737	    window.addEventListener("keydown", handler);
   738	
   739	    // Capture-phase listener for Cmd+I (macOS WKWebView intercepts it)
   740	    const captureHandler = (e: KeyboardEvent) => {
   741	      if ((e.metaKey || e.ctrlKey) && e.key === "i") {
   742	        e.preventDefault();
   743	        e.stopPropagation();
   744	        const view = getActiveEditorView();
   745	        if (view) toggleItalic(view);
   746	      }
   747	      // Cmd+Shift+D: PDF 按钮栏固定显示 / 隐藏（仅活动 PDF 视图，视图级状态）。
   748	      // 与 Cmd+I 同阶段：PDF 视图是 shadow DOM，内部控件可能消费按键。
   749	      if (
   750	        (e.metaKey || e.ctrlKey) &&
   751	        e.shiftKey &&
   752	        e.key.toLowerCase() === "d" &&
   753	        activeTab?.fileKind === "pdf" &&
   754	        activeTab.path
   755	      ) {
   756	        e.preventDefault();
   757	        e.stopPropagation();
   758	        togglePdfToolbarPin(activeTab.path);
   759	      }
   760	    };
   761	    document.addEventListener("keydown", captureHandler, { capture: true });
   762	
   763	    return () => {
   764	      window.removeEventListener("keydown", handler);
   765	      document.removeEventListener("keydown", captureHandler, {
   766	        capture: true,
   767	      });
   768	    };
   769	  }, [
   770	    handleOpenFile,
   771	    handleSaveFile,
   772	    handleNewFile,
   773	    activeTab?.editorMode,
   774	    activeTab?.fileKind,
   775	    activeTab?.path,
   776	    readingMode,
   777	    activeTabId,
   778	    handleScaleDelta,
   779	    openGridOverview,
   780	    openSettings,

exec
/bin/zsh -lc 'rg -n "isLocalShortcutActive|shortcuts.ts|SHORTCUTS|keymap" docs openspec | head -n 200' in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
openspec/changes/editor-surface-batch20/proposal.md:33:- 前端：`src/lib/export/*`、`src/lib/printPreview.ts`、`src/styles/print.css`；`src/components/Grid/GridTile.tsx`、`src/components/Preview/FloatingPreview.tsx`、`src/components/Rail/ReadingRail.tsx`、`src/components/Content/VideoPlayer.tsx`、`src/components/Content/MediaPlayerHost.tsx`；`src/components/TooltipLayer.tsx`、`src/components/TabInfoPopover.tsx`、`src/components/TabBar.tsx`、`src/lib/overlayGate.ts`、`src/lib/shortcuts.ts`；`src/editors/decorations/*`、`src/editors/{smart-input,keybindings,setup}.ts`、`src/editors/orchestration/{floating-toolbar,horizontal-toolbar,menu-metrics,slots}.ts`、`src/editors/slash.ts`；`src/components/Content/{ContentArea,PreviewView,OutlineMenu,PaneTreeView}.tsx`、`src/App.tsx`；`src/hooks/usePaneDragController.ts`；`src/styles/{editor,reader}.css`。
openspec/changes/editor-surface-batch20/design.md:76:| 快捷键·左边栏 | `src/lib/shortcuts.ts` / `src/App.tsx` | `global-rail-pin-hidden`（既有） | 网格预览下仍生效；登记 `decision`；键位唯一 | 5.3 | 不新增未登记键位 |
openspec/changes/editor-surface-batch20/conformance.json:610:          "source": "#897 缺陷11 / src/lib/shortcuts.ts"
openspec/changes/editor-surface-batch20/anchors.md:202:| A-27.2 | exact | shortcuts 登记键位重复数 | 0 | #897 缺陷11 / src/lib/shortcuts.ts |
openspec/changes/doc-property-and-search-panel/proposal.md:42:- **修改**：`ContentArea`（挂载属性面板）、`SettingsView.tsx`（AI 区外新增属性/搜索设置区）、`src/lib/shortcuts.ts`（⌘⇧Y 全局注册 + 搜索浮窗 ⌘1~9 局部 scope）、`searchKeymap`（移除 CM6 内置搜索面板接管）。
docs/architecture/decisions/0011-scenario-shell-and-pane-tree.md:30:- 周边：扩展包（`extensions/<id>/{manifest.json, SKILL.md}`，`.disabled` 停用标记，AI 系统提示消费）与快捷键注册表（`src/lib/shortcuts.ts` 单一真相源）构成外壳的其余部分。
openspec/changes/doc-property-and-search-panel/conformance.json:341:          "assert": "shortcuts.ts 浮窗局部键条目标注 `scope=\"local\"` 与生效条件「搜索浮窗打开且焦点在浮窗内」",
openspec/changes/doc-property-and-search-panel/design.md:6:- 现状：frontmatter 由预览渲染直接剥离；正文搜索走 CM6 `searchKeymap` 内置面板；快捷键唯一真相源为 `src/lib/shortcuts.ts`（含「卡片直开 ⌘1–9」全局键段）。
openspec/changes/doc-property-and-search-panel/design.md:29:5. **快捷键 scope 机制**：`shortcuts.ts` 条目增加 `scope: "global" | "local"` + `context` 描述；keymap 生成时局部键在上下文激活时注册并优先于全局。⌘⇧Y 为 global；搜索浮窗 ⌘1~9 / Enter / ↑↓ / Esc 为 local（context: 搜索浮窗打开且焦点在浮窗内）。*理由：解决与「卡片直开 ⌘1–9」的键段冲突，见 Risks*。
openspec/changes/doc-property-and-search-panel/design.md:44:| 消费 | src/lib/shortcuts.ts | shortcuts | ⌘⇧Y 全局、搜索浮窗局部键注册，keymap 由配置/状态驱动 |
openspec/changes/doc-property-and-search-panel/tasks.md:22:- [x] 1.6 列表 [[ 文档链接、标签编辑与局部快捷键机制：列表字段 `[[` 文档菜单（行只显示文档名、选中行行尾 ⏎、其余 ⌘1~9）、↑↓/⏎/⌘N 键盘选用、链接 chip 呈现可移除、粘贴键名去重；标签增删改名（颜色按名重算）、标签输入建议菜单（已有标签过滤，↑↓ 换选、选中行 ⏎ 其余 ⌘N、无匹配 Enter 新建）；`shortcuts.ts` 条目增加 `scope`/`context`（局部键在上下文激活时注册并优先于全局、关闭/失焦归还）——本票为 scope 机制首个消费者（建议菜单），搜索浮窗票复用（原 3.4 + 3.5 + 4.7 scope 部分）
docs/agents/defect-workflow.md:264:// ❌ 绕过 keymap，bug 恰在 keymap 里 → 测试全绿但真实按键仍失效
docs/agents/defect-workflow.md:275:**真实教训（editor-v2 修复期）**：`#174` 自动配对的修复测试直接调 `handleAutoPair()`，绕过 `keydown → keymap → inputHandler` 两跳——而 bug 恰在那两跳（`key: '**'` 是非法 CM6 键名，被静默丢弃）。测试全绿，真实按键**零配对**。
docs/agents/defect-workflow.md:298:| `#174` 自动配对 | 测试通过 | 绕过 keymap，真实按键零配对 |
docs/architecture/overview.md:98:`src/lib/shortcuts.ts` 是快捷键的**唯一真相源**：`SHORTCUTS` 数组（id / keys / label / family / core / decision / implemented），驱动四处消费：
docs/architecture/overview.md:100:- 实际 keymap 绑定（`App.tsx` 的 keydown handler）
docs/delivery/layout-portal-acceptance.md:38:| 4 | 同概念是否复用唯一图标/颜色/键位？→ 是（P3） | 通过 | [e2e/icon-system.spec.ts](../../e2e/icon-system.spec.ts)「同一类型同形状、颜色严格等于类型色」；`src/lib/shortcuts.ts` 单一注册表 |
docs/agents/task-tracking.md:101:| `tdd` | 测试先行（红→绿 + 垂直切片），锁定行为契约。**测试须满足 QG-4**（驱动真实路径，禁止绕过 keymap/事件/公共 API） | ✅ implement 内嵌 |
docs/agents/quality-gates.md:118:**规则**：测试必须驱动**真实链路**；禁止绕过 keymap / 事件 / 公共 API 直接调内部函数。测 DOM 可见性必须断言**计算样式**，禁止断言「元素存在」。测插件扩展必须经**真实 `EditorView`**，禁止 mock `EditorState`。
docs/agents/quality-gates.md:142:**实证案例**：某票的测试写作 `handleAutoPair(view, '**')` 直接传参调用，绕过 `keydown → keymap → inputHandler` **两跳**。而 bug 恰在那两跳：`key: '**'` 是**非法键名，被静默丢弃**。测试全绿，真实按键**零配对**。
docs/agents/quality-gates.md:184:| 自动配对 | 测试通过 | 绕过 keymap，真实按键零配对 |
docs/agents/quality-gates.md:395:// ❌ 绕过 keymap 两跳，bug 恰好在那两跳
openspec/changes/archive/2026-11-03-md-orchestration/proposal.md:19:3. **菜单栈**：模块级单一栈，`push/pop` 返回 token；滑入即显示、离栈即收、不 retarget；CM6 keymap 只问栈顶。
openspec/changes/archive/2026-11-03-md-orchestration/tasks.md:7:- [x] 1.3a 菜单栈接线（栈语义）：`menuStack` 接进 `slash.ts` 的 open/close 生命周期（根面板 + 浮层各一层，关闭即 pop），keymap 六个函数只问栈顶、栈空返回 `false`，滚动容器 `scroll` 按作用域 `closeScope`（滚动即收），`push` 按作用域隔离（分栏两面板互不阻塞）。单测覆盖入栈/出栈/栈空让位/非栈顶让位/滚动即收；既有 slash e2e 6 条回归通过。边界：`pop` 未知 token 不抛错、重复关闭幂等、`closeAll(match)` 只收命中层。
openspec/changes/archive/2026-11-03-md-orchestration/design.md:20:4. **单一栈顶**：CM6 keymap（Esc/↑/↓/Enter）只问 `top()`，栈空时一律返回 `false`。
openspec/changes/archive/2026-11-02-md-kernel-port/tasks.md:7:- [x] 1.2b 斜杠菜单 UI：`slash`（命令注册表 + 菜单 DOM + keymap）接进 `setup.ts`——输入 `/` 出现分类菜单、`/h1` 转标题、Esc/点外部关闭无残留 + 单测
openspec/changes/archive/2026-11-08-shell-editor-batch5/tasks.md:102:  - `railView.ts` + 11 处「置顶」文案 → 「收藏」（`ReadingRail.tsx`、`GridToolbar.tsx`、`shortcuts.ts`、`aiViewSpec.ts`、`App.tsx`）
openspec/changes/doc-property-and-search-panel/specs/search-replace-float/spec.md:58:浮窗内快捷键（⌘1~9、Enter、↑↓、Esc）SHALL 为**局部 scope**：仅在搜索浮窗打开且焦点位于浮窗内时生效，且 SHALL 优先于全局同名键段（如「卡片直开 ⌘1–9」）；浮窗关闭或焦点离开即归还键段。快捷键 SHALL 注册进 `shortcuts.ts` 唯一真相源并标注 scope 与生效条件。
openspec/changes/doc-property-and-search-panel/anchors.md:140:浮窗内快捷键（⌘1~9、Enter、↑↓、Esc）为局部 scope：仅浮窗打开且焦点在浮窗内生效，优先于全局同名键段；关闭/失焦归还；注册进 shortcuts.ts 唯一真相源并标注 scope 与生效条件。
openspec/changes/doc-property-and-search-panel/anchors.md:145:| A-15.2 | exact | scope 注册标注 | shortcuts.ts 浮窗局部键条目标注 `scope="local"` 与生效条件「搜索浮窗打开且焦点在浮窗内」 | 决策#5 |
docs/archive/2026/legacy-requirements/CORE-REQUIREMENTS-v3-archived.md:557:| 快捷键格式 | App.tsx 直接 dispatch | 绕过 macOS WKWebView 拦截 | CM6 keymap 被系统吞掉 |
openspec/changes/archive/2026-11-08-ui-polish-batch8/design.md:91:- 快捷键：视频快捷键行并入 `lib/shortcuts.ts` 的「媒体」家族；快捷键总览显示它们，不再只藏在视频提示浮层。
openspec/changes/archive/2026-11-08-ui-polish-batch8/tasks.md:134:  - `lib/shortcuts.ts` + `ShortcutOverlay`：并入视频快捷键家族
openspec/changes/archive/2026-11-05-layout-portal/design.md:63:全部快捷键集中一张注册表（键位/作用/家族/作用域），驱动：实际 keymap 绑定、tooltip 键位显示、`?` 总览浮层、设置快捷键区。避免三处各写一份漂移。Esc 层级关闭（先清搜索→再关面板）按浮层栈实现。
openspec/changes/archive/2026-11-05-layout-portal/tasks.md:64:- [x] 15.1 集中快捷键注册表（键位/作用/家族/作用域）驱动 keymap+tooltip+`?` 总览+设置区四处；全局 9 条（⌘P/⌘\ / ⌘⇧\ / ⌘K/⌘⇧A/⌘,/⌘⇧V/?/Esc 层级关闭）+ 类型过滤 ⌥1–8/⌥0 + 模式 ⌘⇧M + 文件/工作区/卡片直开组补齐；设计规则核对（单 ⌘ 高频/⌘⇧ 二级/⌘⌥ 分栏/⌥ 过滤/无三修饰）
openspec/changes/archive/2026-11-14-editor-surface-batch17/proposal.md:47:- 代码：`src/components/TabBar.tsx`、`src/components/ContextMenu.tsx`、`src/components/TooltipLayer.tsx`、`src/components/Content/PdfViewer.tsx`、`src/App.tsx`、`src/lib/shortcuts.ts`、`src/lib/railView.ts`、`src/stores/index.ts`、`src/renderers/markdown.ts`、`src/styles/reader.css`、`src/styles/editor.css`、`src/editors/slash.ts`、`src/editors/smart-input.ts`、`src/editors/orchestration/{block-handle,block-menu}.ts`、`src/editors/decorations/{image,imageToolbar}.ts`、`src/editors/block-model.ts`、`src/components/Content/{HtmlVisualEditor,HtmlEditToolbar,HtmlRangeToolbar}.tsx`、`src/editors/html/{runtime,edit}.ts`。
openspec/changes/archive/2026-11-14-editor-surface-batch17/design.md:14:- `⌘⇧D` 已注册（`shortcuts.ts`），问题在监听阶段与焦点：`App.tsx` 的 keydown 是 window 冒泡；PDF 视图是自定义元素/shadow DOM，内部控件可能消费按键。改为 **document capture 阶段**处理该组合键（与 Cmd+I 的既有做法一致），命中时 `preventDefault`。
openspec/changes/archive/2026-11-14-editor-surface-batch17/design.md:16:- 可发现性：保留 `shortcuts.ts` 条目；在 PDF 固定按钮 `title` 中带 `（⌘⇧D）`；快捷键总览按现有 `shortcutsByFamily` 自动渲染，无需新 UI。
openspec/changes/archive/2026-11-14-editor-surface-batch17/tasks.md:25:  - 实现：`src/App.tsx:584-590` 的 `⌘⇧D` 分支从 window 冒泡改为 `document` capture 阶段处理（复用 `:700-708` Cmd+I 既有 capture 写法），命中时 `preventDefault`；`src/components/Content/PdfViewer.tsx:156-202` 保留 `pdf:toggle-toolbar-pin` 注册并在固定按钮 `title` 补 `（⌘⇧D）`；`src/lib/shortcuts.ts:211-212` 条目保留，总览按 `shortcutsByFamily` 自动渲染。
openspec/changes/archive/2026-11-14-editor-surface-batch17/tasks.md:49:  - 实现：`src/App.tsx:509-515` 的 `⌘\` 分支改为统一「切换可见性」：`collapsed → pinned`、`pinned/hover → collapsed`，不再在折叠态切沉浸阅读；新增 `⌘⌥\` 分支调用 store 既有 action 切换 `pinned ↔ hover`（`collapsed` 时先展开为 pinned）；`src/lib/shortcuts.ts` 新增 `global-rail-pin` 条目。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:46:| B6 | **键位绑定** | `keybindings.ts` + `shortcuts.ts`（`SHORTCUTS` 常量表），`ShortcutDef` 已带 `scope` 结构 | 配置型 | AGENT 重映射键位（**依赖按键分发层重接线，见第 3 项 §4.4**） |
docs/design/pluginization-datafile-settings-rail/04-document-discovery-and-plugin-display.md:51:| **⌘P（快速打开）** | **全局发现主入口** | 跨页签/最近/命令 +（升级后）内容搜索 | ⌘P（`shortcuts.ts:66-76`） |
docs/design/pluginization-datafile-settings-rail/04-document-discovery-and-plugin-display.md:52:| **左边栏搜索** | 阅读空间场景内 | 阅读空间文档内的过滤 | ⌘\（`shortcuts.ts:82-88`） |
docs/design/pluginization-datafile-settings-rail/04-document-discovery-and-plugin-display.md:53:| **网格搜索** | 网格场景内 | 网格文档内的过滤 | ⌘⇧\（`shortcuts.ts:106-112`） |
docs/design/pluginization-datafile-settings-rail/03-settings-page-optimization.md:5:> 事实基线：`src/components/SettingsView.tsx`、`src/components/ShortcutOverlay.tsx`、`src/lib/shortcuts.ts`、`src/editors/keybindings.ts`、`src/App.tsx`、`src/main.tsx`、`src-tauri/src/lib.rs`、`docs/design/system/spec.md`
docs/design/pluginization-datafile-settings-rail/03-settings-page-optimization.md:15:3. **快捷键注册表素材齐全**：`shortcuts.ts` 已有 10 个 family、global/local 作用域、core 标记、冲突裁定说明。
docs/design/pluginization-datafile-settings-rail/03-settings-page-optimization.md:65:`shortcuts.ts` 已提供全部素材（family、scope、core、decision、keys）。本方案在其上补三层增量，并修正既有二分的误分类。
docs/design/pluginization-datafile-settings-rail/03-settings-page-optimization.md:69:取 `shortcuts.ts` 中 `core: true` 的**全部 7 条**定案（实现时以注册表为准，此处枚举定案）：
docs/design/pluginization-datafile-settings-rail/03-settings-page-optimization.md:85:把 `shortcuts.ts` 顶部的**设计规则**显性化展示，让用户理解键位编排逻辑，从而推导记忆：
docs/design/pluginization-datafile-settings-rail/03-settings-page-optimization.md:99:`shortcuts.ts` 区分 `scope: global / local`。**注意：直接按 scope 二分存在误分类**——media 族全部条目未标 `scope`（默认 global），但注册表注释明确「播放器聚焦时生效」；card 族 ⌘1–9/按住 ⌘ 只在网格上下文生效，也未标 `scope: "local"`。照此实现会把上下文受限的键展示为全局，与「避免用户误在全局找不到」冲突。
docs/design/pluginization-datafile-settings-rail/03-settings-page-optimization.md:103:- **方案一（推荐）**：给 `shortcuts.ts` 的 media/card 族补 `scope: "local"` + `context`，使注册表与真实上下文一致，再按 scope 二分。这是根治。
docs/design/pluginization-datafile-settings-rail/03-settings-page-optimization.md:112:**当前状态：可重映射是空谈，需标注依赖**。`SHORTCUTS` 是编译期 TS 常量，**按键行为由 `App.tsx` 硬编码分发**（`App.tsx:423-780` 全是 `e.key` 判断，未消费 SHORTCUTS）。即使第 1 项 B1「键位数据文件化」完成，**不把 `App.tsx` 的按键分发改成读数据文件，重映射永不生效**。
docs/design/pluginization-datafile-settings-rail/03-settings-page-optimization.md:118:| **可重映射** | 有键位绑定的应用级快捷键（`SHORTCUTS` 中已实现条目） | **依赖第 1 项 B1**：键位数据文件化必须同时重接线 `App.tsx` 按键分发，否则重映射不生效。重映射流程：记录新键位 → 写入键位数据文件 → **分发层读文件重接线** → 生效。现成参考：`rouletteHotkey` 配置项（`SettingsView.tsx` 的 `commitRouletteHotkey`）是当前唯一可重映射原型 |
docs/design/pluginization-datafile-settings-rail/03-settings-page-optimization.md:126:方案原称「四处同源消费」名不副实：真正 import `shortcuts.ts` 的只有 `SettingsView.tsx`、`ShortcutOverlay.tsx`（展示）及 `SuggestMenu.tsx`/`SearchReplacePanel.tsx`（`activateLocalContext`）。**按键分发未消费 SHORTCUTS**，`TooltipLayer.tsx` 键位是独立硬编码表。这是漂移隐患，应在实现时让按键分发与 tooltip 统一消费 SHORTCUTS，而非维持现状。
docs/design/pluginization-datafile-settings-rail/03-settings-page-optimization.md:188:- 快捷键展示以 `shortcuts.ts` 为唯一真相源，不在设置页另写一份键位；按键分发与 tooltip 应统一消费 SHORTCUTS（实现时处理，消除漂移）。
docs/design/pluginization-datafile-settings-rail/03-settings-page-optimization.md:201:3. **按键分发未消费 SHORTCUTS、TooltipLayer 独立硬编码** → 已采纳，§4.5 补同源真相与漂移隐患。
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:64:| B1 | **键位绑定** | `keybindings.ts`（86 行）+ `shortcuts.ts`（573 行，`SHORTCUTS` 常量表，`ShortcutDef` 已带 `scope: global/local` 结构） | `user/keybindings.json`：按键 → 命令映射，支持全局/局部作用域、禁用、重映射 | 改键位文件即重映射；**依赖按键分发层重接线（见第 3 项 §4.4）** |

exec
/bin/zsh -lc "nl -ba src/lib/export/exportDocument.ts | sed -n '1,260p'; nl -ba src/lib/exportActions.ts | sed -n '1,280p'; rg -n \"export(Format|Option|Default)|format:|exportDocument|export_(html|png|pdf|docx|mdpkg|zip)|exportHtml|exportPng|exportPdf|exportDocx|exportMdpkg|exportZip\" src | head -n 250" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
     1	// 导出 HTML 的 UI 胶水层：读样式 → 渲染 → 内联图片 → 系统保存对话框。
     2	import { invoke } from "@tauri-apps/api/core";
     3	import readerCss from "../../styles/reader.css?raw";
     4	import tokensCss from "../../styles/tokens.css?raw";
     5	import { ensureDiagramEngine } from "../../renderers/diagram/engine";
     6	import { buildHtmlDocument } from "./html";
     7	import { inlineImages } from "./inlineImages";
     8	
     9	export interface ExportHtmlInput {
    10	  title: string;
    11	  markdown: string;
    12	  baseDir: string;
    13	}
    14	
    15	export type ExportHtmlResult =
    16	  | { status: "saved"; path: string; inlined: number; failed: number }
    17	  | { status: "cancelled" }
    18	  | { status: "error"; message: string };
    19	
    20	interface SaveResult {
    21	  path: string;
    22	}
    23	
    24	export async function exportCurrentDocHtml(
    25	  input: ExportHtmlInput,
    26	): Promise<ExportHtmlResult> {
    27	  try {
    28	    const engine = await ensureDiagramEngine();
    29	    const doc = buildHtmlDocument(input.markdown, {
    30	      title: input.title,
    31	      css: `${tokensCss}\n${readerCss}`,
    32	      diagramSvg: engine
    33	        ? (source) => engine.renderToSvgOrNull(source)
    34	        : undefined,
    35	    });
    36	    const { html, inlined, failed } = await inlineImages(
    37	      doc,
    38	      input.baseDir,
    39	      async (path) => {
    40	        try {
    41	          return await invoke<string>("read_file_base64", { path });
    42	        } catch {
    43	          return null;
    44	        }
    45	      },
    46	    );
    47	
    48	    const saved = await invoke<SaveResult>("save_as_file", {
    49	      content: html,
    50	      defaultName: htmlFileName(input.title),
    51	    });
    52	    return { status: "saved", path: saved?.path ?? "", inlined, failed };
    53	  } catch (e) {
    54	    // Rust 的 AppError::Cancelled 是 unit variant，序列化为字符串 "Cancelled"。
    55	    const reason = String(e);
    56	    if (reason === "Cancelled" || reason === "Operation cancelled") {
    57	      return { status: "cancelled" };
    58	    }
    59	    return { status: "error", message: String(e) };
    60	  }
    61	}
    62	
    63	/** 导出文件名：`标题.html`，去掉路径分隔符与首尾空白。 */
    64	export function htmlFileName(title: string): string {
    65	  const base =
    66	    title
    67	      .replace(/[\\/]/g, "-")
    68	      .replace(/\.(md|markdown|mdown|mdwn|txt)$/i, "")
    69	      .trim() || "未命名";
    70	  return `${base}.html`;
    71	}
    72	
    73	export function exportMessage(result: ExportHtmlResult): string | null {
    74	  if (result.status === "saved") {
    75	    const name = result.path.split(/[\\/]/).pop() || result.path;
    76	    const tail = result.failed > 0 ? `，${result.failed} 张图片未能内联` : "";
    77	    return `已导出 ${name}${tail}`;
    78	  }
    79	  if (result.status === "error") return `导出失败：${result.message}`;
    80	  return null;
    81	}
     1	// 文件级导出动作的共享执行层（editor-surface-batch18 D2）：页签右键菜单与任何
     2	// 未来入口共用同一套管线与提示文案，不再依赖格头菜单的打开状态。
     3	import { exportCurrentDocHtml, exportMessage } from "./export/exportDocument";
     4	import { exportPngFromMarkdown, exportPngMessage } from "./export/png";
     5	import { exportPdfFromMarkdown, exportPdfMessage } from "./export/pdf";
     6	import { exportDocxDocument, exportDocxMessage } from "./export/docx";
     7	import { exportMdpkgFromMarkdown, exportMdpkgMessage } from "./export/mdpkg";
     8	import { exportZipFromMarkdown, exportZipMessage } from "./export/zip";
     9	import { log } from "../utils/log";
    10	import type { ExportMenuAction } from "./paneHeaderMenu";
    11	
    12	/** 导出目标：当前活动页签或右键命中的页签。 */
    13	export interface ExportTarget {
    14	  title: string;
    15	  content: string;
    16	  path: string | null;
    17	}
    18	
    19	/** 结果提示回调；UI 层决定何时消失（浮层 notice）。 */
    20	export type ExportNotice = (message: string) => void;
    21	
    22	function baseDirOf(path: string | null): string {
    23	  if (!path) return "";
    24	  return path.slice(0, Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")));
    25	}
    26	
    27	/** 执行一个导出动作并给出提示；失败收敛为提示文案，不向调用方抛出。 */
    28	export async function runExportAction(
    29	  action: ExportMenuAction,
    30	  target: ExportTarget,
    31	  notify: ExportNotice,
    32	): Promise<void> {
    33	  const { title, content } = target;
    34	  const baseDir = baseDirOf(target.path);
    35	  if (action === "exportHtml") {
    36	    void exportCurrentDocHtml({ title, markdown: content, baseDir }).then(
    37	      (result) => {
    38	        const message = exportMessage(result);
    39	        if (result.status === "error") {
    40	          log.error("Export", "导出 HTML 失败", result.message);
    41	          notify(message ?? "导出失败");
    42	        } else if (result.status === "saved") {
    43	          notify(message ?? "已导出");
    44	        }
    45	      },
    46	    );
    47	    return;
    48	  }
    49	  const run = async <R extends { status: string; message?: string }>(
    50	    exportFn: () => Promise<R>,
    51	    messageFn: (result: R) => string | null,
    52	    pending: string,
    53	    label: string,
    54	  ) => {
    55	    notify(pending);
    56	    let message: string | null = null;
    57	    try {
    58	      const result = await exportFn();
    59	      if (result.status === "error") {
    60	        log.error("Export", `${label}失败`, result.message);
    61	      }
    62	      message = messageFn(result);
    63	    } catch (e) {
    64	      log.error("Export", `${label}失败`, String(e));
    65	      message = `导出失败：${e instanceof Error ? e.message : String(e)}`;
    66	    }
    67	    if (message) notify(message);
    68	  };
    69	  if (action === "exportPng") {
    70	    void run(
    71	      () => exportPngFromMarkdown({ title, markdown: content, baseDir }),
    72	      exportPngMessage,
    73	      "正在生成图片…",
    74	      "导出图片",
    75	    );
    76	    return;
    77	  }
    78	  if (action === "exportPdf") {
    79	    void run(
    80	      () => exportPdfFromMarkdown({ title, markdown: content, baseDir }),
    81	      exportPdfMessage,
    82	      "正在生成 PDF…",
    83	      "导出 PDF",
    84	    );
    85	    return;
    86	  }
    87	  if (action === "exportDocx") {
    88	    void run(
    89	      () => exportDocxDocument({ title, markdown: content, baseDir }),
    90	      exportDocxMessage,
    91	      "正在生成 Word…",
    92	      "导出 Word",
    93	    );
    94	    return;
    95	  }
    96	  if (action === "exportMdpkg") {
    97	    void run(
    98	      () => exportMdpkgFromMarkdown({ title, markdown: content, baseDir }),
    99	      exportMdpkgMessage,
   100	      "正在打包 .mdpkg…",
   101	      "导出 .mdpkg",
   102	    );
   103	    return;
   104	  }
   105	  if (action === "exportZip") {
   106	    void run(
   107	      () => exportZipFromMarkdown({ title, markdown: content, baseDir }),
   108	      exportZipMessage,
   109	      "正在打包 ZIP…",
   110	      "导出 ZIP",
   111	    );
   112	  }
   113	}
src/lib/export/docx.ts:52:export function exportDocxMessage(result: ExportDocxResult): string | null {
src/lib/export/docx.ts:63:export async function exportDocxFromMarkdown(
src/lib/export/docx.ts:129:export async function exportDocxDocument(input: {
src/lib/export/docx.ts:145:  return exportDocxFromMarkdown({
src/lib/export/pdf.ts:123:export async function exportPdfFromMarkdown(
src/lib/export/pdf.ts:192:export function exportPdfMessage(result: ExportPngResult): string | null {
src/lib/export/png.ts:311:export async function exportPngFromMarkdown(
src/lib/export/png.ts:373:export function exportPngMessage(result: ExportPngResult): string | null {
src/lib/export/zip.ts:55:export async function exportZipFromMarkdown(
src/lib/export/zip.ts:103:export function exportZipMessage(result: ExportZipResult): string | null {
src/lib/export/mdpkg.ts:59:/** Markdown → .mdpkg 字节（未写盘）。失败抛出，由 exportMdpkgFromMarkdown 收敛。 */
src/lib/export/mdpkg.ts:69:export async function exportMdpkgFromMarkdown(
src/lib/export/mdpkg.ts:110:export function exportMdpkgMessage(result: ExportMdpkgResult): string | null {
src/lib/exportActions.ts:3:import { exportCurrentDocHtml, exportMessage } from "./export/exportDocument";
src/lib/exportActions.ts:4:import { exportPngFromMarkdown, exportPngMessage } from "./export/png";
src/lib/exportActions.ts:5:import { exportPdfFromMarkdown, exportPdfMessage } from "./export/pdf";
src/lib/exportActions.ts:6:import { exportDocxDocument, exportDocxMessage } from "./export/docx";
src/lib/exportActions.ts:7:import { exportMdpkgFromMarkdown, exportMdpkgMessage } from "./export/mdpkg";
src/lib/exportActions.ts:8:import { exportZipFromMarkdown, exportZipMessage } from "./export/zip";
src/lib/exportActions.ts:35:  if (action === "exportHtml") {
src/lib/exportActions.ts:69:  if (action === "exportPng") {
src/lib/exportActions.ts:71:      () => exportPngFromMarkdown({ title, markdown: content, baseDir }),
src/lib/exportActions.ts:72:      exportPngMessage,
src/lib/exportActions.ts:78:  if (action === "exportPdf") {
src/lib/exportActions.ts:80:      () => exportPdfFromMarkdown({ title, markdown: content, baseDir }),
src/lib/exportActions.ts:81:      exportPdfMessage,
src/lib/exportActions.ts:87:  if (action === "exportDocx") {
src/lib/exportActions.ts:89:      () => exportDocxDocument({ title, markdown: content, baseDir }),
src/lib/exportActions.ts:90:      exportDocxMessage,
src/lib/exportActions.ts:96:  if (action === "exportMdpkg") {
src/lib/exportActions.ts:98:      () => exportMdpkgFromMarkdown({ title, markdown: content, baseDir }),
src/lib/exportActions.ts:99:      exportMdpkgMessage,
src/lib/exportActions.ts:105:  if (action === "exportZip") {
src/lib/exportActions.ts:107:      () => exportZipFromMarkdown({ title, markdown: content, baseDir }),
src/lib/exportActions.ts:108:      exportZipMessage,
src/lib/mdpkg/vendor/mdpkg-web.d.ts:14:  format: "mdpkg";
src/__tests__/exportMdpkg.test.ts:10:const { buildMdpkgFiles, exportMdpkgFromMarkdown, mdpkgFileName } =
src/__tests__/exportMdpkg.test.ts:48:  const result = await exportMdpkgFromMarkdown(INPUT, {
src/__tests__/exportMdpkg.test.ts:108:    const result = await exportMdpkgFromMarkdown(INPUT, {
src/__tests__/exportMdpkg.test.ts:116:    const result = await exportMdpkgFromMarkdown(INPUT, {
src/__tests__/exportPng.test.ts:4:  exportPngFromMarkdown,
src/__tests__/exportPng.test.ts:5:  exportPngMessage,
src/__tests__/exportPng.test.ts:87:describe("exportPngFromMarkdown", () => {
src/__tests__/exportPng.test.ts:92:    const result = await exportPngFromMarkdown(
src/__tests__/exportPng.test.ts:108:    const result = await exportPngFromMarkdown(
src/__tests__/exportPng.test.ts:125:    const result = await exportPngFromMarkdown(
src/__tests__/exportPng.test.ts:156:    const result = await exportPngFromMarkdown(
src/__tests__/exportPng.test.ts:169:    const result = await exportPngFromMarkdown(
src/__tests__/exportPng.test.ts:184:    const result = await exportPngFromMarkdown(
src/__tests__/exportPng.test.ts:198:      expect(exportPngMessage(result)).toBe(
src/__tests__/exportPng.test.ts:205:    const result = await exportPngFromMarkdown(
src/__tests__/exportPng.test.ts:214:    await exportPngFromMarkdown(
src/__tests__/exportPng.test.ts:236:    const result = await exportPngFromMarkdown(
src/__tests__/exportPng.test.ts:265:    await exportPngFromMarkdown(
src/__tests__/exportPng.test.ts:318:    expect(exportPngMessage({ status: "cancelled" })).toBeNull();
src/__tests__/ui/icons.test.ts:51:    const trio = [ICONS.exportWord.s, ICONS.exportZip.s, ICONS.exportMdpkg.s];
src/lib/mdpkg/vendor/mdpkg-web.js:2130:      format: true,
src/lib/mdpkg/vendor/mdpkg-web.js:3097:          anyOf: [{ format: "relative-json-pointer" }, { format: "json-pointer" }]
src/lib/mdpkg/vendor/mdpkg-web.js:4282:      format: "`validateFormats: false` can be used instead.",
src/lib/mdpkg/vendor/mdpkg-web.js:6707:      params: ({ schemaCode }) => (0, codegen_1._)`{format: ${schemaCode}}`
src/lib/mdpkg/vendor/mdpkg-web.js:7055:          propertyNames: { format: "regex" },
src/lib/mdpkg/vendor/mdpkg-web.js:7169:          format: "uri"
src/lib/mdpkg/vendor/mdpkg-web.js:7173:          format: "uri-reference"
src/lib/mdpkg/vendor/mdpkg-web.js:7193:        format: { type: "string" }
src/lib/mdpkg/vendor/mdpkg-web.js:7289:          format: "regex"
src/lib/mdpkg/vendor/mdpkg-web.js:8781:  return { format: "mdpkg", spec_version: "1.0", entrypoint: "document.md", entry_count: files.size };
src/lib/mdpkg/vendor/mdpkg-web.js:9362:    format: { const: "mdpkg" },
src/lib/mdpkg/vendor/mdpkg-web.js:16226:    format: "mdpkg",
src/lib/mdpkg/vendor/mdpkg-web.js:21875:    format: null,
src/lib/mdpkg/vendor/mdpkg-web.js:22745:  return core(value, Object.assign({ format: formatSmart }, options));
src/editors/orchestration/roulette-view.ts:53:  format: RouletteItem[];
src/ui/icons.ts:41:  | "exportZip"
src/ui/icons.ts:42:  | "exportMdpkg"
src/ui/icons.ts:297:  exportZip: {
src/ui/icons.ts:301:  exportMdpkg: {
src/editors/orchestration/floating-toolbar.ts:581:      format: [
src/lib/paneHeaderMenu.ts:29:  | "exportHtml"
src/lib/paneHeaderMenu.ts:30:  | "exportPng"
src/lib/paneHeaderMenu.ts:31:  | "exportPdf"
src/lib/paneHeaderMenu.ts:32:  | "exportDocx"
src/lib/paneHeaderMenu.ts:33:  | "exportMdpkg"
src/lib/paneHeaderMenu.ts:34:  | "exportZip";
src/lib/paneHeaderMenu.ts:57:  { action: "exportDocx", label: "Word", icon: "exportWord" },
src/lib/paneHeaderMenu.ts:58:  { action: "exportMdpkg", label: ".mdpkg", icon: "exportMdpkg" },
src/lib/paneHeaderMenu.ts:59:  { action: "exportPng", label: "图片", icon: "image" },
src/lib/paneHeaderMenu.ts:60:  { action: "exportPdf", label: "PDF", icon: "pdf" },
src/lib/paneHeaderMenu.ts:61:  { action: "exportHtml", label: "HTML", icon: "html" },
src/lib/paneHeaderMenu.ts:62:  { action: "exportZip", label: "ZIP", icon: "exportZip" },
src/__tests__/lib/export/zip.test.ts:9:const { exportZipFromMarkdown, exportZipMessage, zipFileName } =
src/__tests__/lib/export/zip.test.ts:37:  const result = await exportZipFromMarkdown(INPUT, {
src/__tests__/lib/export/zip.test.ts:65:    const result = await exportZipFromMarkdown(INPUT, {
src/__tests__/lib/export/zip.test.ts:70:    expect(exportZipMessage(result)).toBeNull();
src/__tests__/lib/export/zip.test.ts:74:    const result = await exportZipFromMarkdown(INPUT, {
src/__tests__/lib/export/zip.test.ts:85:    const result = await exportZipFromMarkdown(
src/editors/html/capture.ts:162: * 与 `exportPngFromMarkdown` 同一套错误语义：失败返回人话 message，取消返回 cancelled。
src/__tests__/exportDocx.test.ts:5:  exportDocxFromMarkdown,
src/__tests__/exportDocx.test.ts:6:  exportDocxMessage,
src/__tests__/exportDocx.test.ts:55:describe("exportDocxFromMarkdown", () => {
src/__tests__/exportDocx.test.ts:59:    const result = await exportDocxFromMarkdown(
src/__tests__/exportDocx.test.ts:79:    const result = await exportDocxFromMarkdown(
src/__tests__/exportDocx.test.ts:106:    await exportDocxFromMarkdown(
src/__tests__/exportDocx.test.ts:123:    const result = await exportDocxFromMarkdown(
src/__tests__/exportDocx.test.ts:141:    expect(exportDocxMessage(result)).toBe("已导出 有警告.docx（2 条提示）");
src/__tests__/exportDocx.test.ts:145:    const result = await exportDocxFromMarkdown(
src/__tests__/exportDocx.test.ts:150:    expect(exportDocxMessage(result)).toBeNull();
src/__tests__/exportDocx.test.ts:154:    const result = await exportDocxFromMarkdown(
src/__tests__/exportDocx.test.ts:166:    expect(exportDocxMessage(result)).toBe(`导出失败：${result.message}`);
src/__tests__/exportDocx.test.ts:171:    const result = await exportDocxFromMarkdown(

exec
/bin/zsh -lc "nl -ba src/components/TabBar.tsx | sed -n '720,820p;840,900p'; nl -ba src/lib/paneHeaderMenu.ts | sed -n '50,75p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
   720	          />
   721	          {/* hover 父项即展开二级，且移出父项后保持可见（A-13.2 / A-13.3）；
   722	              点击只负责打开，不再切换关闭——否则 hover 刚展开就被同一次点击关掉。 */}
   723	          <div
   724	            data-export-row
   725	            className="relative"
   726	            onPointerEnter={cancelExportClose}
   727	            onPointerLeave={scheduleExportClose}
   728	          >
   729	            <button
   730	              data-menu-item="export"
   731	              aria-haspopup="menu"
   732	              aria-expanded={exportOpen}
   733	              className="w-full flex items-center gap-2 text-left px-3 py-1.5 hover:bg-[var(--app-sunken)] disabled:cursor-not-allowed disabled:opacity-45"
   734	              disabled={!tabs[menu.tabId]?.path}
   735	              title={
   736	                tabs[menu.tabId]?.path ? "导出" : "此页签尚未保存，无路径可导出"
   737	              }
   738	              onMouseEnter={() => setExportOpen(true)}
   739	              onClick={() => setExportOpen(true)}
   740	            >
   741	              <Icon name="export" size={18} />
   742	              导出
   743	              <span
   744	                className="ml-auto h-0 w-0 border-y-4 border-l-4 border-y-transparent border-l-[var(--app-text-3)]"
   745	                aria-hidden="true"
   746	              />
   747	            </button>
   748	            {exportOpen && (
   749	              <div
   750	                data-testid="pane-export-submenu"
   751	                role="menu"
   752	                ref={exportSubmenuRef}
   753	                className="absolute min-w-[132px] rounded border py-1 text-xs shadow-lg"
   754	                style={{
   755	                  ...(submenuSide === "left"
   756	                    ? { right: "100%", marginRight: 1 }
   757	                    : { left: "100%", marginLeft: 1 }),
   758	                  ...(submenuAlignTop ? { top: 0 } : { bottom: 0 }),
   759	                  background: "var(--app-surface)",
   760	                  borderColor: "var(--app-border)",
   761	                  color: "var(--app-text-2)",
   762	                }}
   763	              >
   764	                {EXPORT_MENU_ITEMS.map((sub) => (
   765	                  <button
   766	                    key={sub.action}
   767	                    type="button"
   768	                    role="menuitem"
   769	                    data-export-item={sub.action}
   770	                    disabled={sub.disabled}
   771	                    title={sub.title}
   772	                    onClick={() => {
   773	                      const tab = tabs[menu.tabId];
   774	                      if (!tab) return;
   775	                      void runExportAction(
   776	                        sub.action,
   777	                        {
   778	                          title: tab.title,
   779	                          content: tab.content,
   780	                          path: tab.path,
   781	                        },
   782	                        showNotice,
   783	                      );
   784	                      closeMenu();
   785	                    }}
   786	                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-[var(--app-sunken)] disabled:cursor-not-allowed disabled:opacity-50"
   787	                  >
   788	                    <Icon name={sub.icon} size={18} />
   789	                    <span>{sub.label}</span>
   790	                  </button>
   791	                ))}
   792	              </div>
   793	            )}
   794	          </div>
   795	          <button
   796	            data-menu-item="print"
   797	            className="w-full flex items-center gap-2 text-left px-3 py-1.5 hover:bg-[var(--app-sunken)]"
   798	            onClick={() => {
   799	              const tab = tabs[menu.tabId];
   800	              closeMenu();
   801	              if (!tab) return;
   802	              printMarkdownPreview(
   803	                { content: tab.content, path: tab.path },
   804	                { paneId },
   805	              );
   806	            }}
   807	          >
   808	            <Icon name="print" size={18} />
   809	            打印
   810	          </button>
   811	          <button
   812	            className="w-full flex items-center gap-2 text-left px-3 py-1.5 hover:bg-[var(--app-sunken)] disabled:cursor-not-allowed disabled:opacity-45"
   813	            disabled={!tabs[menu.tabId]?.path}
   814	            title={
   815	              tabs[menu.tabId]?.path
   816	                ? "复制路径"
   817	                : "此页签尚未保存，无路径可复制"
   818	            }
   819	            onClick={() => {
   820	              const path = tabs[menu.tabId]?.path;
   840	            }
   841	            onClick={() => {
   842	              const path = tabs[menu.tabId]?.path;
   843	              closeMenu();
   844	              if (path) revealInFinder(path);
   845	            }}
   846	          >
   847	            <Icon name="locate" size={18} />
   848	            打开文件位置
   849	          </button>
   850	          <button
   851	            data-menu-item="move"
   852	            className="w-full flex items-center gap-2 text-left px-3 py-1.5 hover:bg-[var(--app-sunken)] disabled:cursor-not-allowed disabled:opacity-45"
   853	            disabled={!tabs[menu.tabId]?.path}
   854	            title={
   855	              tabs[menu.tabId]?.path ? "移动到…" : "此页签尚未保存，无法移动"
   856	            }
   857	            onClick={() => {
   858	              const tab = tabs[menu.tabId];
   859	              const path = tab?.path;
   860	              closeMenu();
   861	              if (!path) return;
   862	              void (async () => {
   863	                try {
   864	                  const dir = await invoke<string>("pick_folder");
   865	                  if (!dir) return;
   866	                  const next = await invoke<string>("move_file", {
   867	                    from: path,
   868	                    toDir: dir,
   869	                  });
   870	                  useStore.getState().setTabPath(menu.tabId, next);
   871	                } catch {
   872	                  // 取消选择或移动失败：保持原路径不变
   873	                }
   874	              })();
   875	            }}
   876	          >
   877	            <Icon name="moveTo" size={18} />
   878	            移动到…
   879	          </button>
   880	          <button
   881	            data-menu-item="reload"
   882	            className="w-full flex items-center gap-2 text-left px-3 py-1.5 hover:bg-[var(--app-sunken)] disabled:cursor-not-allowed disabled:opacity-45"
   883	            disabled={!tabs[menu.tabId]?.path}
   884	            title={
   885	              tabs[menu.tabId]?.path
   886	                ? tabs[menu.tabId]?.dirty
   887	                  ? "有未保存改动，先保存再刷新"
   888	                  : "刷新"
   889	                : "此页签尚未保存，无法刷新"
   890	            }
   891	            onClick={() => {
   892	              const tab = tabs[menu.tabId];
   893	              const path = tab?.path;
   894	              closeMenu();
   895	              if (!path || tab.dirty) return;
   896	              void invoke<{ path: string; content: string }>(
   897	                "open_file_direct",
   898	                {
   899	                  path,
   900	                },
    50	  { action: "source", label: "源码模式", icon: "code" },
    51	  { action: "locate", label: "定位", icon: "locate" },
    52	];
    53	
    54	// 导出能力清单，恰好 6 项；顺序即子菜单渲染顺序（用户 2026-11-10 指定：
    55	// word、mdpkg、图片、pdf、html、zip）。打印不走导出管线，是同级独立菜单项。
    56	export const EXPORT_MENU_ITEMS: readonly ExportMenuItem[] = [
    57	  { action: "exportDocx", label: "Word", icon: "exportWord" },
    58	  { action: "exportMdpkg", label: ".mdpkg", icon: "exportMdpkg" },
    59	  { action: "exportPng", label: "图片", icon: "image" },
    60	  { action: "exportPdf", label: "PDF", icon: "pdf" },
    61	  { action: "exportHtml", label: "HTML", icon: "html" },
    62	  { action: "exportZip", label: "ZIP", icon: "exportZip" },
    63	];
    64	
    65	/**
    66	 * AI 停靠窗格的 ⋯ 菜单（layout-portal 9.1）——独立于普通格的 6 项列表，
    67	 * 保证 pane-header 用例对普通格「恰好 6 项」的断言不受影响。
    68	 */
    69	export const AI_PANE_MENU_ITEMS: readonly PaneMenuItem[] = [
    70	  { action: "undockAi", label: "脱离为小窗", icon: "export" },
    71	];
    72	
    73	/** 模式图标只在预览↔编辑间切换；源码模式由 ⋯ 菜单进入。 */
    74	export function nextPaneMode(mode: EditorMode): EditorMode {
    75	  return mode === "preview" ? "edit" : "preview";

exec
/bin/zsh -lc 'rg -n "export" src/lib/export src/lib/exportActions.ts src/components/TabBar.tsx | head -n 240' in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src/lib/exportActions.ts:3:import { exportCurrentDocHtml, exportMessage } from "./export/exportDocument";
src/lib/exportActions.ts:4:import { exportPngFromMarkdown, exportPngMessage } from "./export/png";
src/lib/exportActions.ts:5:import { exportPdfFromMarkdown, exportPdfMessage } from "./export/pdf";
src/lib/exportActions.ts:6:import { exportDocxDocument, exportDocxMessage } from "./export/docx";
src/lib/exportActions.ts:7:import { exportMdpkgFromMarkdown, exportMdpkgMessage } from "./export/mdpkg";
src/lib/exportActions.ts:8:import { exportZipFromMarkdown, exportZipMessage } from "./export/zip";
src/lib/exportActions.ts:13:export interface ExportTarget {
src/lib/exportActions.ts:20:export type ExportNotice = (message: string) => void;
src/lib/exportActions.ts:28:export async function runExportAction(
src/lib/exportActions.ts:35:  if (action === "exportHtml") {
src/lib/exportActions.ts:36:    void exportCurrentDocHtml({ title, markdown: content, baseDir }).then(
src/lib/exportActions.ts:38:        const message = exportMessage(result);
src/lib/exportActions.ts:50:    exportFn: () => Promise<R>,
src/lib/exportActions.ts:58:      const result = await exportFn();
src/lib/exportActions.ts:69:  if (action === "exportPng") {
src/lib/exportActions.ts:71:      () => exportPngFromMarkdown({ title, markdown: content, baseDir }),
src/lib/exportActions.ts:72:      exportPngMessage,
src/lib/exportActions.ts:78:  if (action === "exportPdf") {
src/lib/exportActions.ts:80:      () => exportPdfFromMarkdown({ title, markdown: content, baseDir }),
src/lib/exportActions.ts:81:      exportPdfMessage,
src/lib/exportActions.ts:87:  if (action === "exportDocx") {
src/lib/exportActions.ts:89:      () => exportDocxDocument({ title, markdown: content, baseDir }),
src/lib/exportActions.ts:90:      exportDocxMessage,
src/lib/exportActions.ts:96:  if (action === "exportMdpkg") {
src/lib/exportActions.ts:98:      () => exportMdpkgFromMarkdown({ title, markdown: content, baseDir }),
src/lib/exportActions.ts:99:      exportMdpkgMessage,
src/lib/exportActions.ts:105:  if (action === "exportZip") {
src/lib/exportActions.ts:107:      () => exportZipFromMarkdown({ title, markdown: content, baseDir }),
src/lib/exportActions.ts:108:      exportZipMessage,
src/components/TabBar.tsx:25:import { runExportAction } from "../lib/exportActions";
src/components/TabBar.tsx:95:export default function TabBar({
src/components/TabBar.tsx:230:  const [exportOpen, setExportOpen] = useState(false);
src/components/TabBar.tsx:231:  const exportCloseTimer = useRef<number | null>(null);
src/components/TabBar.tsx:234:  const exportSubmenuRef = useRef<HTMLDivElement>(null);
src/components/TabBar.tsx:303:    if (exportCloseTimer.current !== null) {
src/components/TabBar.tsx:304:      window.clearTimeout(exportCloseTimer.current);
src/components/TabBar.tsx:305:      exportCloseTimer.current = null;
src/components/TabBar.tsx:314:    if (exportCloseTimer.current !== null) {
src/components/TabBar.tsx:315:      window.clearTimeout(exportCloseTimer.current);
src/components/TabBar.tsx:316:      exportCloseTimer.current = null;
src/components/TabBar.tsx:321:    exportCloseTimer.current = window.setTimeout(() => {
src/components/TabBar.tsx:322:      exportCloseTimer.current = null;
src/components/TabBar.tsx:329:    if (!exportOpen) return;
src/components/TabBar.tsx:330:    const sub = exportSubmenuRef.current;
src/components/TabBar.tsx:336:  }, [exportOpen]);
src/components/TabBar.tsx:724:            data-export-row
src/components/TabBar.tsx:730:              data-menu-item="export"
src/components/TabBar.tsx:732:              aria-expanded={exportOpen}
src/components/TabBar.tsx:741:              <Icon name="export" size={18} />
src/components/TabBar.tsx:748:            {exportOpen && (
src/components/TabBar.tsx:750:                data-testid="pane-export-submenu"
src/components/TabBar.tsx:752:                ref={exportSubmenuRef}
src/components/TabBar.tsx:769:                    data-export-item={sub.action}
src/components/TabBar.tsx:940:          data-export-notice
src/lib/export/inlineImages.ts:6:export type Base64Reader = (path: string) => Promise<string | null>;
src/lib/export/inlineImages.ts:8:export interface InlineImagesResult {
src/lib/export/inlineImages.ts:52:export async function inlineImages(
src/lib/export/exportDocument.ts:9:export interface ExportHtmlInput {
src/lib/export/exportDocument.ts:15:export type ExportHtmlResult =
src/lib/export/exportDocument.ts:24:export async function exportCurrentDocHtml(
src/lib/export/exportDocument.ts:64:export function htmlFileName(title: string): string {
src/lib/export/exportDocument.ts:73:export function exportMessage(result: ExportHtmlResult): string | null {
src/lib/export/html.ts:6:export interface BuildHtmlOptions {
src/lib/export/html.ts:19:export function escapeHtml(s: string): string {
src/lib/export/html.ts:36:.export-root {
src/lib/export/html.ts:71:export function buildHtmlDocument(
src/lib/export/html.ts:94:    '<div class="export-root">',
src/lib/export/base64.ts:4:export async function blobToBase64(blob: Blob): Promise<string> {
src/lib/export/base64.ts:14:export function base64ToBytes(base64: string): Uint8Array {
src/lib/export/png.ts:14:export const PNG_WIDTH = 1080;
src/lib/export/png.ts:16:export const PNG_SCALE = 2;
src/lib/export/png.ts:18:export const CANVAS_MAX_DEVICE_PX = 16384;
src/lib/export/png.ts:20:export const PNG_MAX_HEIGHT = Math.floor(CANVAS_MAX_DEVICE_PX / PNG_SCALE);
src/lib/export/png.ts:22:export const PNG_TOO_TALL_MESSAGE = "文档过长，建议导出 HTML";
src/lib/export/png.ts:80:export function toWellFormedXhtml(html: string): string {
src/lib/export/png.ts:111:export interface SvgFromHtmlOptions {
src/lib/export/png.ts:121:export function svgFromHtml(html: string, opts: SvgFromHtmlOptions): string {
src/lib/export/png.ts:136:export type MeasureHtmlHeight = (
src/lib/export/png.ts:172:export const measureHtmlHeight: MeasureHtmlHeight = async (html, width) => {
src/lib/export/png.ts:192:export type SvgToBlob = (svg: string) => Promise<Blob>;
src/lib/export/png.ts:194:export interface RasterizeOptions {
src/lib/export/png.ts:241:export async function rasterizeSvgToPng(
src/lib/export/png.ts:250:export async function rasterizeSvgToJpeg(
src/lib/export/png.ts:260:export interface ExportPngInput {
src/lib/export/png.ts:268:export type ExportPngResult =
src/lib/export/png.ts:274:export interface ExportPngSeams {
src/lib/export/png.ts:283:export function defaultCss(): string {
src/lib/export/png.ts:288:export function pngFileName(title: string): string {
src/lib/export/png.ts:300:export async function waitForFonts(): Promise<void> {
src/lib/export/png.ts:311:export async function exportPngFromMarkdown(
src/lib/export/png.ts:373:export function exportPngMessage(result: ExportPngResult): string | null {
src/lib/export/png.ts:382:export { blobToBase64 };
src/lib/export/pdf.ts:22:export const PDF_MAX_HEIGHT = PNG_MAX_HEIGHT;
src/lib/export/pdf.ts:28:export function pdfFileName(title: string): string {
src/lib/export/pdf.ts:41:export function buildPdfFromJpeg(
src/lib/export/pdf.ts:123:export async function exportPdfFromMarkdown(
src/lib/export/pdf.ts:192:export function exportPdfMessage(result: ExportPngResult): string | null {
src/lib/export/mdpkg.ts:9:export const MDPKG_ENTRY = "document.md";
src/lib/export/mdpkg.ts:11:export interface ExportMdpkgInput {
src/lib/export/mdpkg.ts:17:export type ExportMdpkgResult =
src/lib/export/mdpkg.ts:23:export interface ExportMdpkgSeams {
src/lib/export/mdpkg.ts:31:export function mdpkgFileName(title: string): string {
src/lib/export/mdpkg.ts:44:export async function buildMdpkgFiles(
src/lib/export/mdpkg.ts:59:/** Markdown → .mdpkg 字节（未写盘）。失败抛出，由 exportMdpkgFromMarkdown 收敛。 */
src/lib/export/mdpkg.ts:60:export async function packMdpkgFromMarkdown(
src/lib/export/mdpkg.ts:69:export async function exportMdpkgFromMarkdown(
src/lib/export/mdpkg.ts:110:export function exportMdpkgMessage(result: ExportMdpkgResult): string | null {
src/lib/export/docx.ts:7:export interface ExportDocxAsset {
src/lib/export/docx.ts:12:export interface ExportDocxInput {
src/lib/export/docx.ts:18:export type ExportDocxResult =
src/lib/export/docx.ts:23:export interface ExportDocxSeams {
src/lib/export/docx.ts:32:export const DOCX_ENTRY = "document.md";
src/lib/export/docx.ts:34:export function stripFrontmatter(markdown: string): string {
src/lib/export/docx.ts:43:export function docxFileName(title: string): string {
src/lib/export/docx.ts:52:export function exportDocxMessage(result: ExportDocxResult): string | null {
src/lib/export/docx.ts:63:export async function exportDocxFromMarkdown(
src/lib/export/docx.ts:108:export async function collectLocalImages(
src/lib/export/docx.ts:129:export async function exportDocxDocument(input: {
src/lib/export/docx.ts:145:  return exportDocxFromMarkdown({
src/lib/export/zip.ts:8:export const ZIP_DOCUMENT = "document.md";
src/lib/export/zip.ts:10:export interface ExportZipInput {
src/lib/export/zip.ts:16:export type ExportZipResult =
src/lib/export/zip.ts:22:export interface ExportZipSeams {
src/lib/export/zip.ts:30:export function zipFileName(title: string): string {
src/lib/export/zip.ts:40:export async function buildZipFiles(
src/lib/export/zip.ts:55:export async function exportZipFromMarkdown(
src/lib/export/zip.ts:103:export function exportZipMessage(result: ExportZipResult): string | null {

exec
/bin/zsh -lc "nl -ba src/lib/readerWidth.ts | sed -n '1,80p'; rg -n \"FONT_SIZES|READER_TONES|READER_WIDTH_PRESETS|preset\" src/components/SettingsView.tsx src/components/StatusBar.tsx src/lib/readerWidth.ts src | head -n 160" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
     1	/** 阅读区行宽唯一真源：设置页滑块与状态栏弹层共用。 */
     2	export const READER_WIDTH_MIN = 480;
     3	export const READER_WIDTH_MAX = 1400;
     4	export const READER_WIDTH_STEP = 20;
     5	
     6	export const READER_WIDTH_PRESETS = [
     7	  { value: 720, label: "紧凑", bar: 14 },
     8	  { value: 960, label: "适中", bar: 17 },
     9	  { value: 1080, label: "标准", bar: 20 },
    10	  { value: 1200, label: "宽松", bar: 23 },
    11	] as const;
src/lib/readerWidth.ts:6:export const READER_WIDTH_PRESETS = [
src/components/StatusBar.tsx:13:  READER_WIDTH_PRESETS,
src/components/StatusBar.tsx:326:                  {READER_WIDTH_PRESETS.map((opt) => (
src/components/StatusBar.tsx:330:                      data-testid={`width-preset-${opt.value}`}
src/components/SettingsView.tsx:34:  READER_WIDTH_PRESETS,
src/components/SettingsView.tsx:141:const FONT_SIZES = [15, 16, 17, 18, 19, 21] as const;
src/components/SettingsView.tsx:164:const READER_TONES = [
src/components/SettingsView.tsx:1060:    const preset = PROVIDERS.find((p) => p.id === id);
src/components/SettingsView.tsx:1061:    if (!preset) return;
src/components/SettingsView.tsx:1064:      openaiEndpoint: preset.endpoint,
src/components/SettingsView.tsx:1065:      openaiModel: preset.defaultModel,
src/components/SettingsView.tsx:1242:                  {FONT_SIZES.map((size) => {
src/components/SettingsView.tsx:1353:                  {FONT_SIZES.map((size) => {
src/components/SettingsView.tsx:1839:                  {READER_WIDTH_PRESETS.map((option) => {
src/components/SettingsView.tsx:1891:                  {READER_TONES.map((tone) => {
src/lib/aiViewSpec.ts:234:export function presetById(id: string): SpecPreset | undefined {
src/lib/readerWidth.ts:6:export const READER_WIDTH_PRESETS = [
src/lib/mdpkg/vendor/mdpkg-web.js:10940:   * preset.
src/lib/mdpkg/vendor/mdpkg-web.js:10976:   * @param {Preset | null | undefined} [preset]
src/lib/mdpkg/vendor/mdpkg-web.js:11032:          "Expected usable value but received an empty preset, which is probably a mistake: presets typically come with `plugins` and sometimes with `settings`, but this has neither"
src/hooks/useAiEntry.ts:11:  presetById,
src/hooks/useAiEntry.ts:375:      const preset = presetById(id);
src/hooks/useAiEntry.ts:376:      if (!preset) return;
src/hooks/useAiEntry.ts:378:      const after = preset.apply(before);
src/hooks/useAiEntry.ts:386:            text: `预设：${preset.label}`,
src/components/Content/HtmlEditToolbar.tsx:27:const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 40];
src/components/Content/HtmlEditToolbar.tsx:256:            {fontSize && !FONT_SIZES.some((n) => `${n}px` === fontSize) && (
src/components/Content/HtmlEditToolbar.tsx:259:            {FONT_SIZES.map((n) => (
src/__tests__/aiViewSpec.test.ts:132:    for (const preset of SPEC_PRESETS) {
src/__tests__/aiViewSpec.test.ts:133:      const after = preset.apply(DEFAULT_VIEW_SPEC);
src/__tests__/aiViewSpec.test.ts:134:      const target = intended[preset.id];
src/components/Content/HtmlRangeToolbar.tsx:8:const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 40];
src/components/Content/HtmlRangeToolbar.tsx:164:        {FONT_SIZES.map((n) => (
src/components/SettingsView.tsx:34:  READER_WIDTH_PRESETS,
src/components/SettingsView.tsx:141:const FONT_SIZES = [15, 16, 17, 18, 19, 21] as const;
src/components/SettingsView.tsx:164:const READER_TONES = [
src/components/SettingsView.tsx:1060:    const preset = PROVIDERS.find((p) => p.id === id);
src/components/SettingsView.tsx:1061:    if (!preset) return;
src/components/SettingsView.tsx:1064:      openaiEndpoint: preset.endpoint,
src/components/SettingsView.tsx:1065:      openaiModel: preset.defaultModel,
src/components/SettingsView.tsx:1242:                  {FONT_SIZES.map((size) => {
src/components/SettingsView.tsx:1353:                  {FONT_SIZES.map((size) => {
src/components/SettingsView.tsx:1839:                  {READER_WIDTH_PRESETS.map((option) => {
src/components/SettingsView.tsx:1891:                  {READER_TONES.map((tone) => {
src/components/ai/AiConversation.tsx:17:  const [presetOpen, setPresetOpen] = useState(false);
src/components/ai/AiConversation.tsx:134:          data-ai-presets-button
src/components/ai/AiConversation.tsx:136:          aria-expanded={presetOpen}
src/components/ai/AiConversation.tsx:158:        {presetOpen && (
src/components/ai/AiConversation.tsx:160:            data-ai-presets-menu
src/components/ai/AiConversation.tsx:164:            {SPEC_PRESETS.map((preset) => (
src/components/ai/AiConversation.tsx:166:                key={preset.id}
src/components/ai/AiConversation.tsx:169:                data-ai-preset={preset.id}
src/components/ai/AiConversation.tsx:172:                  useAiEntryStore.getState().requestApplyPreset(preset.id);
src/components/ai/AiConversation.tsx:176:                {preset.label}
src/components/StatusBar.tsx:13:  READER_WIDTH_PRESETS,
src/components/StatusBar.tsx:326:                  {READER_WIDTH_PRESETS.map((opt) => (
src/components/StatusBar.tsx:330:                      data-testid={`width-preset-${opt.value}`}
src/styles/reader.css:1298: * 新增主题：这里加一个块 + SettingsView 阅读空间区的 READER_TONES 加一项。
src/__tests__/providers.test.ts:15:describe("provider presets", () => {
src/__tests__/providers.test.ts:20:  it("every preset has id, label, endpoint and defaultModel", () => {
src/__tests__/providers.test.ts:21:    for (const preset of PROVIDERS as ProviderPreset[]) {
src/__tests__/providers.test.ts:22:      expect(preset.id, preset.label).toBeTruthy();
src/__tests__/providers.test.ts:23:      expect(preset.label, preset.id).toBeTruthy();
src/__tests__/providers.test.ts:24:      expect(typeof preset.endpoint, preset.id).toBe("string");
src/__tests__/providers.test.ts:25:      expect(typeof preset.defaultModel, preset.id).toBe("string");
src/__tests__/providers.test.ts:29:  it("verified presets ship a usable endpoint", () => {
src/__tests__/providers.test.ts:31:    for (const preset of PROVIDERS.filter((p) => verified.includes(p.id))) {
src/__tests__/providers.test.ts:32:      expect(preset.endpoint, preset.id).toMatch(/^https:\/\//);
src/__tests__/providers.test.ts:33:      expect(preset.defaultModel, preset.id).not.toBe("");
src/__tests__/providers.test.ts:39:      const preset = PROVIDERS.find((p) => p.id === id);
src/__tests__/providers.test.ts:40:      expect(preset?.endpoint, id).toBe("");
src/__tests__/providers.test.ts:41:      expect(preset?.defaultModel, id).toBe("");
src/__tests__/providers.test.ts:45:  it("custom preset leaves endpoint and model to the user", () => {

exec
/bin/zsh -lc "nl -ba src/components/SettingsView.tsx | sed -n '120,150p;160,175p;1220,1265p'; nl -ba src/components/StatusBar.tsx | sed -n '310,360p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
   120	  { value: "recent", label: "最近" },
   121	  { value: "name", label: "名称" },
   122	  { value: "type", label: "类型" },
   123	] as const;
   124	
   125	const GRID_MODE_OPTIONS = [
   126	  { value: "grid", label: "网格" },
   127	  { value: "list", label: "列表" },
   128	] as const;
   129	
   130	const PLANNED_PROVIDERS = [
   131	  { id: "local-llm", label: "本地 LLM（Ollama）" },
   132	  { id: "multi-agent", label: "多 agent 协同" },
   133	] as const;
   134	
   135	const THEME_OPTIONS = [
   136	  { value: "light", label: "浅色" },
   137	  { value: "dark", label: "深色" },
   138	  { value: "warm", label: "暖色" },
   139	] as const;
   140	
   141	const FONT_SIZES = [15, 16, 17, 18, 19, 21] as const;
   142	
   143	const NOTICE_DURATION_MIN = 0.1;
   144	const NOTICE_DURATION_MAX = 10;
   145	const NOTICE_DURATION_STEP = 0.1;
   146	
   147	type NoticeDurationParse =
   148	  { kind: "default" } | { kind: "valid"; value: number } | { kind: "invalid" };
   149	
   150	function parseNoticeDuration(text: string): NoticeDurationParse {
   160	  }
   161	  return { kind: "valid", value };
   162	}
   163	
   164	const READER_TONES = [
   165	  { id: "paper", label: "纸墨", swatch: "#1f1d1a" },
   166	  { id: "indigo", label: "靛青", swatch: "#2b4a7d" },
   167	  { id: "moss", label: "松绿", swatch: "#2f5d3f" },
   168	  { id: "clay", label: "赭石", swatch: "#8a4b2a" },
   169	] as const;
   170	
   171	const ROULETTE_SECTOR_META = [
   172	  { id: "smart", label: "智能" },
   173	  { id: "convert", label: "转换" },
   174	  { id: "align", label: "对齐" },
   175	  { id: "columns", label: "分栏" },
  1220	                    type="checkbox"
  1221	                    data-testid="follow-system"
  1222	                    checked={followSystem}
  1223	                    onChange={(e) => toggleFollowSystem(e.target.checked)}
  1224	                    className="mt-0.5"
  1225	                  />
  1226	                  <span>
  1227	                    <span className="block text-sm text-[var(--app-text)]">
  1228	                      跟随系统外观
  1229	                    </span>
  1230	                    <span className="block text-xs text-[var(--app-text-3)]">
  1231	                      默认开启：系统亮/暗对应浅色/深色
  1232	                    </span>
  1233	                  </span>
  1234	                </label>
  1235	              </section>
  1236	
  1237	              <section>
  1238	                <h2 className="mb-2 text-sm font-medium text-[var(--app-text-strong)]">
  1239	                  字号
  1240	                </h2>
  1241	                <div className="flex flex-wrap gap-2">
  1242	                  {FONT_SIZES.map((size) => {
  1243	                    const selected = readerFontSize === size;
  1244	                    return (
  1245	                      <button
  1246	                        key={size}
  1247	                        type="button"
  1248	                        data-testid={`font-size-${size}`}
  1249	                        aria-pressed={selected}
  1250	                        onClick={() => chooseFontSize(size)}
  1251	                        className={`rounded border px-3 py-1.5 text-sm ${
  1252	                          selected
  1253	                            ? "border-[var(--app-accent)] bg-[var(--app-accent-soft)] text-[var(--app-accent)]"
  1254	                            : "border-[var(--app-border)] text-[var(--app-text-2)] hover:bg-[var(--app-sunken)]"
  1255	                        }`}
  1256	                      >
  1257	                        {size}
  1258	                      </button>
  1259	                    );
  1260	                  })}
  1261	                </div>
  1262	              </section>
  1263	
  1264	              <section data-testid="settings-heading-fonts">
  1265	                <h2 className="mb-1 text-sm font-medium text-[var(--app-text-strong)]">
   310	          ? createPortal(
   311	              <div
   312	                ref={widthPanelRef}
   313	                data-testid="width-panel"
   314	                className="width-panel"
   315	                onPointerEnter={cancelWidthClose}
   316	                onPointerLeave={scheduleWidthClose}
   317	                style={{
   318	                  left: Math.min(
   319	                    Math.max(widthAnchor - WIDTH_PANEL_W / 2, 8),
   320	                    Math.max(window.innerWidth - WIDTH_PANEL_W - 8, 8),
   321	                  ),
   322	                  bottom: window.innerHeight - widthRect.top + 6,
   323	                }}
   324	              >
   325	                <div className="width-bars" data-testid="width-bars">
   326	                  {READER_WIDTH_PRESETS.map((opt) => (
   327	                    <button
   328	                      key={opt.value}
   329	                      type="button"
   330	                      data-testid={`width-preset-${opt.value}`}
   331	                      aria-pressed={readerWidth === opt.value}
   332	                      title={opt.label}
   333	                      aria-label={opt.label}
   334	                      onClick={() => onSetReaderWidth(opt.value)}
   335	                      style={{ height: opt.bar }}
   336	                      className={`width-bar ${readerWidth === opt.value ? "is-active" : ""}`}
   337	                    >
   338	                      <span className="width-bar-fill" aria-hidden="true" />
   339	                    </button>
   340	                  ))}
   341	                </div>
   342	                <input
   343	                  data-testid="width-slider"
   344	                  type="range"
   345	                  min={READER_WIDTH_MIN}
   346	                  max={READER_WIDTH_MAX}
   347	                  step={READER_WIDTH_STEP}
   348	                  value={Math.min(READER_WIDTH_MAX, readerWidth)}
   349	                  onChange={(e) => onSetReaderWidth(Number(e.target.value))}
   350	                  className="width-slider"
   351	                />
   352	              </div>,
   353	              document.body,
   354	            )
   355	          : null}
   356	      </div>
   357	
   358	      <div className="ml-auto flex items-center gap-1">
   359	        <button
   360	          type="button"

exec
/bin/zsh -lc 'rg -n "reader.*preset|preset.*reader|阅读预设|font preset|width preset|READER_TONES|READER_WIDTH_PRESETS" docs openspec src | head -n 200' in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src/lib/readerWidth.ts:6:export const READER_WIDTH_PRESETS = [
src/styles/reader.css:1298: * 新增主题：这里加一个块 + SettingsView 阅读空间区的 READER_TONES 加一项。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:48:| B8 | **阅读预设** | `readerFontSize` 数值型，无预设集合 | 配置型 | AGENT 增加阅读预设 |
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:131:2. **第二批（配置型插件）**：B1 胶囊工具条、B4 菜单、B5 图标、B7 导出配置、B8 阅读预设、B9 新文档默认（与第 2 项数据文件化协同，配置值落点由数据文件承载）。
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:70:| B9 | **阅读预设** | `readerFontSize` 是数值型（非字体族字符串），无预设集合 | `user/reader-presets.json`：字号/宽度/皮肤预设集合 | AGENT 增加阅读预设，一键切换 |
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:97:  reader-presets.json         阅读预设（B9）
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:186:4. **第四批（体验类文件化）**：B9 阅读预设、B10 新文档默认。B11 捕获配置按 §5.7 裁决（保持独立则不迁）。
src/components/SettingsView.tsx:34:  READER_WIDTH_PRESETS,
src/components/SettingsView.tsx:164:const READER_TONES = [
src/components/SettingsView.tsx:1839:                  {READER_WIDTH_PRESETS.map((option) => {
src/components/SettingsView.tsx:1891:                  {READER_TONES.map((tone) => {
src/components/StatusBar.tsx:13:  READER_WIDTH_PRESETS,
src/components/StatusBar.tsx:326:                  {READER_WIDTH_PRESETS.map((opt) => (

exec
/bin/zsh -lc 'git status --short; git rev-parse --short HEAD; git diff --stat -- docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md src-tauri/src/config.rs src/hooks/useConfig.ts' in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 218ms:
?? codex-reviews/
?? docs/design/pluginization-datafile-settings-rail/
?? prototypes/
16485e5

exec
/bin/zsh -lc "nl -ba docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md | sed -n '1,220p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
     1	# 数据文件化提取方案
     2	
     3	> 状态：设计方案（已通过独立对抗评审，按意见修订）
     4	> 对应目标：第 2 项——深化数据文件化研究，输出「可提取为数据文件的功能清单」与设计实现方案
     5	> 事实基线（已校正）：`src-tauri/src/config.rs`、`src-tauri/src/commands/config_cmd.rs`、`src-tauri/src/commands/capture.rs`、`src-tauri/src/extensions.rs`、`src/hooks/useConfig.ts`、`src/stores/index.ts`、`src/stores/editorStore.ts`、`src/lib/capabilities.ts`、`docs/research/technical/data-fileization-omarchy-inventory.md`
     6	
     7	## 1. 背景与目标
     8	
     9	数据文件化是本产品既定的产品设计方向，已有底座与部分实现。存在两个明确问题：
    10	
    11	1. **提取不够**：许多可配置能力仍是代码常量，只有被明确要求时才会文件化，「不明确说明的能力不会进行数据文件的设计」。
    12	2. **目标**：让用户**通过 AGENT 直接自定义产品功能**——AGENT 改数据文件即改产品行为，无需改源码。
    13	
    14	本方案回答：哪些功能可提取为数据文件、数据文件的目录与合并设计、AGENT 自定义的落点与边界，以及一个必须修复的根因缺陷。
    15	
    16	## 2. 立场与硬边界
    17	
    18	- **扩展点 = 数据文件，不执行用户代码**。AGENT 只改声明式数据文件，最坏「没生效」，不会「搞坏应用」。
    19	- **密钥永不文件化**（apiKey 仅内存，走 keyring 命令）。
    20	- **用户层目录是 AGENT 写入口**：`user/` 是核心写入口，扩展点目录（snippets/templates/theme.toml）也在用户层，但不在 `user/` 子目录下——边界表述按此校正。
    21	- **无消费者不提前建目录**：不为「未来可能用到」提前建数据文件。
    22	
    23	## 3. 数据文件底座（现状，已校正）
    24	
    25	`config_base()` = Tauri `app.config_dir()`，macOS `~/Library/Application Support/dev.biaoyue.app/`（`config.rs:1033-1038`）。
    26	
    27	| 目录 | 内容 | 写入方 |
    28	|---|---|---|
    29	| `defaults/settings.json` | 内置默认（随包发布，用户不可改） | 构建产物 |
    30	| `user/settings.json` | 用户层覆盖（深合并后唯一生效值） | Tauri 命令 / AGENT |
    31	| `state/state.json` | 运行时派生（`recentFiles` / `scrollPositions` / `embedScrollPositions` 三字段） | 派生存储 |
    32	| `snapshots/settings-*.json` | 快照（保留 10 份，有单测） | Tauri 命令 |
    33	| `snippets/*.md`、`templates/*.md`、`theme.toml` | 扩展点数据文件 | 位于 `app_config_dir()` 根，用户层 |
    34	
    35	**读取管线（已校正）**：`applyRustConfig`（`useConfig.ts:407-477`）→ `useEditorStore.setConfig`。方案原称的 `loadSettings()` 函数不存在，已修正。
    36	
    37	**合并语义（关键，已校正）**：
    38	- `save_config` 是全量覆盖；`patch_config` 本身对 user 层深合并（`config.rs:949-976`）。
    39	- **`merge_json` 对数组是整体替换**（`config.rs:392-396` `(_, over) => over.clone()`）——这是本仓既有语义，B 档文件设计需沿用，不可另造。
    40	
    41	## 4. 可提取为数据文件的功能清单
    42	
    43	按提取条件分三档。**A 档字段名已按代码实际校正**。
    44	
    45	### A 档：已文件化（保持，纳入统一清单管理）
    46	
    47	| 功能域 | 真实字段 / 文件 | 消费者 | 状态 |
    48	|---|---|---|---|
    49	| 阅读设置 | `readerFontSize`（数值，校验 8–96）、`readerWidth`、`readerSkin` | 阅读区 | ✅ 已落地（注：无 `reader.font` 字体族、`lineHeight`、`mode` 字段） |
    50	| 视图规格 | `settings.json` 顶层四字段：`railViewSpec`/`previewSettings`/`aiViewSpec`/`paneLayout` | `useStore` 的 `setRailViewSpec` 等 | ✅ 已落地（顶层字段，非 `viewSpec.` 嵌套） |
    51	| AI 连接 | `openaiEndpoint`/`openaiModel`/`ollamaEndpoint`/`translationProvider`/`langPair`；apiKey 仅内存 | AI 客户端 | ✅ 已落地（无 `style`/`sessionId` 字段） |
    52	| 编辑器扩展 | `capabilities` 键，id 为 `math`/`code-highlight`/`mermaid`/`preview-zoom` | `CapabilityRegistry` | ✅ 已落地 |
    53	| 派生状态 | `state.json`：`recentFiles`/`scrollPositions`/`embedScrollPositions` | `useStore` / `useScrollRestore` | ✅ 已落地 |
    54	| 主题覆盖 | `theme.toml`（白名单 13 个 `--app-*` token，是 `tokens.css` 17 个的子集） | 主题注入 | ✅ 已落地 |
    55	| 片段 / 模板 | `snippets/*.md`、`templates/*.md` | 斜杠菜单 / 模板选择器 | ✅ 已落地 |
    56	| **轮盘扇区** | `rouletteSectors`（`config.rs:65`，设置页有勾选 UI，`floating-toolbar.ts:715` + `useConfig.ts:440` 消费；默认集合 `ROOT_SECTORS` 是常量） | 轮盘 | ✅ **已文件化**（原误判为 B 档） |
    57	| **工具条按钮** | `htmlToolbarItems`（`config.rs:68`，设置页可编辑，`slots.ts:resolveToolbarOrder` 消费） | 水平工具条 | ✅ **已文件化**（原误判为 B 档） |
    58	| **捕获配置** | `~/.biaoyue/config.toml`（TOML，**在应用配置目录之外**，`CaptureConfig`，无 hotkey 字段） | 捕获浮层 | ✅ 已落地，但**与三层目录是两个世界**，是否纳入统一管理需明确立场（见 §5.7） |
    59	
    60	### B 档：可进一步文件化（当前是代码常量或未持久化）
    61	
    62	| # | 功能 | 现状（已校正） | 数据文件设计 | AGENT 自定义价值 |
    63	|---|---|---|---|---|
    64	| B1 | **键位绑定** | `keybindings.ts`（86 行）+ `shortcuts.ts`（573 行，`SHORTCUTS` 常量表，`ShortcutDef` 已带 `scope: global/local` 结构） | `user/keybindings.json`：按键 → 命令映射，支持全局/局部作用域、禁用、重映射 | 改键位文件即重映射；**依赖按键分发层重接线（见第 3 项 §4.4）** |
    65	| B2 | **菜单结构** | 菜单项常量在 `src/lib/paneHeaderMenu.ts`（PANE/EXPORT/AI_PANE 三表） | `user/menus.json`：菜单分组与项的增删排序、启用/停用 | AGENT 增删/排序菜单项 |
    66	| B5 | **胶囊工具条** | 胶囊按钮集是代码常量（`capsule-toolbar.ts`）；`selectionToolbar: "roulette"|"capsule"` 切换已存在 | `user/capsules.json` | AGENT 配置胶囊按钮（注：`slots` 即 B4 已文件化的 HTML 工具条，两者不可混为一谈） |
    67	| B6 | **图标注册表** | `src/ui/icons.ts`（711 行）+ `src/editors/icons.ts`（803 行），代码常量 | `user/icons.json`：概念 → 图标路径映射 | AGENT 替换/新增图标 |
    68	| B7 | **视图规格独立文件** | 已并入 `settings.json` 顶层四字段。**勘误**：omarchy-inventory 明确「独立视图文件从未实现、四字段是实现选择而非欠账」 | 抽出独立 `user/view-specs.json` | AGENT 直接改视图布局。**需先裁决为何现在要改**（见 §5.6） |
    69	| B8 | **导出配置** | 导出菜单是代码常量（6 项，`paneHeaderMenu.ts`），**无任何持久化导出设置**（`exportFormat` 零命中） | `user/export.json`：格式清单、默认格式、选项开关 | AGENT 自定义导出格式选项与默认 |
    70	| B9 | **阅读预设** | `readerFontSize` 是数值型（非字体族字符串），无预设集合 | `user/reader-presets.json`：字号/宽度/皮肤预设集合 | AGENT 增加阅读预设，一键切换 |
    71	| B10 | **新建文档默认** | `defaultNewDocFormat` 不存在；相近字段是 `defaultSavePath` | `user/newdoc.json`：默认保存路径、默认模板、默认 frontmatter | AGENT 自定义新文档模板与默认路径 |
    72	| B11 | **捕获配置归一** | 当前落点 `~/.biaoyue/config.toml`（TOML，三层目录之外） | 是否迁入 `user/capture.json` 纳入统一体系 | AGENT 统一管理捕获配置（需先裁决迁移立场） |
    73	
    74	### C 档：不文件化（明确不做）
    75	
    76	| # | 功能 | 不文件化理由 |
    77	|---|---|---|
    78	| C1 | **API 密钥 / 密钥类** | 密钥永不文件化（ADR 0005）；apiKey 仅内存走 keyring |
    79	| C2 | **编辑器运行时状态**（undo/选区、CM6 实例） | 运行时状态归 `editorRef.ts` 模块级 Map，不进数据文件 |
    80	| C3 | **模式切换/渲染管线运行时开关** | 由 `capabilities` 统一管理，是运行时行为 |
    81	| C4 | **执行代码的能力** | 数据文件不执行用户代码（与插件方案 C 档一致） |
    82	
    83	## 5. 设计实现方案
    84	
    85	### 5.1 目录约定（终态布局，标注为「终态」避免与「无消费者不建目录」纪律打架）
    86	
    87	```
    88	defaults/settings.json        内置默认（随包）
    89	user/
    90	  settings.json               用户覆盖（核心设置，热应用）
    91	  keybindings.json            键位映射（B1，map 型）
    92	  menus.json                  菜单结构（B2，list 型）
    93	  capsules.json               胶囊工具条（B5，list 型）
    94	  icons.json                  图标映射（B6，map 型）
    95	  view-specs.json             视图规格（B7，待裁决）
    96	  export.json                 导出配置（B8）
    97	  reader-presets.json         阅读预设（B9）
    98	  newdoc.json                 新文档默认（B10）
    99	  capture.json                捕获配置（B11，待裁决迁移）
   100	state/state.json              运行时派生（recentFiles/scrollPositions/embedScrollPositions）
   101	snapshots/settings-*.json     快照
   102	app_config_dir 根：snippets/ templates/ theme.toml   扩展点（用户层，不在 user/ 子目录）
   103	```
   104	
   105	**纪律**：上表为终态布局，每个文件在它的第一个消费者落地时才创建，不为「未来可能用到」提前建。
   106	
   107	### 5.2 合并语义（分型，已校正）
   108	
   109	按文件结构分两类，**不可一刀切**：
   110	
   111	| 类型 | 适用文件 | 合并语义 | 依据 |
   112	|---|---|---|---|
   113	| **map 型** | `keybindings.json`、`icons.json` | **逐键深合并**（键是命令 id / 概念名，天然支持逐键覆盖） | `merge_json` 现状语义；`ShortcutDef` 已是 id 键控结构 |
   114	| **list 型** | `menus.json`、`capsules.json` | **整体覆盖 + 未知 id 过滤**（顺序即语义，整体替换合理；过滤未知 id 容错） | 照抄 `slots.ts:resolveToolbarOrder` 既有容错范式（本仓现成正确范式）；`merge_json` 对数组本就是整体替换 |
   115	
   116	**注**：方案原称「声明式覆盖避免部分覆盖导致结构不完整」的论证与现状 `merge_json` 对数组整体替换的语义重复，已去除。
   117	
   118	### 5.3 热重载（写实，已校正）
   119	
   120	**现状**：唯一热重载是 `spawn_config_watcher`，只盯 `user/settings.json` 的 (mtime,len)（`config.rs:1083-1106`）。B 档任何新文件改动都不触发 `config-changed`。
   121	
   122	**设计**：
   123	- **`settings.json` 热应用**（既有 watcher）。
   124	- **B 档文件重启生效**（成本最低，优先选此）。不补每个 B 档文件的 watcher——除非评审后明确需要，否则不为每个文件新增 watcher 设计。
   125	
   126	### 5.4 验证门（加载端契约，已校正）
   127	
   128	AGENT 直改文件不走写侧校验，**验证门只能落在加载端**：
   129	
   130	- 每个 B 档文件规定**加载端契约**：加载失败/非法时的语义——**回退默认 + 聚合告警**（对齐 `theme.toml` 的白名单过滤纪律）。
   131	- **未知键防线（根因）**：`AppConfig` 当前无 `deny_unknown_fields`，`patch_config` 会**静默吞掉未知键**（`config.rs` grep 零命中）。这是 R2 的根——AGENT 照着错清单写无效字段却不可见。**必须给 `AppConfig` 加 `deny_unknown_fields` 或在 patch 入口拒绝未知键**，方案的校验门承诺依赖此防线。
   132	- **快照覆盖范围**：现 `snapshot_user` 只覆盖 `settings.json`。明确 B 档文件是否进快照——建议 B 档文件不进快照（重启生效、结构简单），或扩展 `snapshot_user`，实现时定。
   133	
   134	### 5.5 AGENT 自定义路径（核心价值，已校正）
   135	
   136	**现状**：AGENT 只有 `read_config` / `patch_config` / `list_snapshots` 三工具（`ai_agent.rs:708`），`patch_config` 只写 `settings.json`。B 档「AGENT 直写 `user/*.json`」意味着每批需新增 loader、加载端校验、（可选）watcher、快照覆盖。
   137	
   138	**完整链路**：
   139	
   140	```
   141	用户说「帮我把导出默认改成 PDF，把 X 快捷键改成 Ctrl+Shift+D」
   142	  → AGENT 识别目标功能域（export / keybindings）
   143	  → AGENT 读取对应 user/ 数据文件（或 defaults 兜底）
   144	  → AGENT 校验字段合法性（依赖 deny_unknown_fields 防线）
   145	  → AGENT 写入 user/ 对应文件
   146	  → 重启生效（B 档）/ 热应用（settings.json）
   147	```
   148	
   149	**AGENT 可见性载体**：`SKILL_MAP`（`config.rs:977-1031`，`seed_skill_map`）是既有 AGENT 可见性载体。清单登记 + AGENT 可见性落在 SKILL_MAP，让 AGENT 知道有哪些文件可改、字段含义。
   150	
   151	### 5.6 B7 视图规格独立文件（裁决）
   152	
   153	omarchy-inventory 勘误明确：「独立视图文件从未实现、四字段是实现选择而非欠账」。本方案重提独立文件，**必须先给独立理由**：
   154	
   155	- 若理由是「让 AGENT 直接改视图布局、与 settings.json 解耦便于备份迁移」——成立，但需写明旧字段迁移策略、并存优先级、UI 写路径改造点（`paneLayout` 是序列化 JSON 字符串，改存储位即改格式）。
   156	- 若无独立理由——**B7 保留现状，不抽独立文件**。
   157	
   158	评审裁定：**保留现状优先**，除非实现时给出充分独立理由。
   159	
   160	### 5.7 捕获配置归一（裁决）
   161	
   162	捕获配置当前落点 `~/.biaoyue/config.toml`（TOML），**在三层目录体系之外，是两个世界**。
   163	
   164	- 若纳入统一管理——迁入 `user/capture.json`，需迁移与兼容。
   165	- 若保持独立——明确声明捕获配置是独立体系，不纳入三层目录，AGENT 通过专用工具管理。
   166	
   167	评审裁定：**保持独立体系优先**，避免为归一引入迁移成本；在清单中显式标注其独立落点。
   168	
   169	### 5.8 根因缺陷修复（必须处理，方案已收敛）
   170	
   171	**现状缺陷（确认属实）**：`apply_patch_at`（`config.rs:949-976`）只读 user 层、**从不读 `state.json`**；`config` 从 user+patch 反序列化，`recent_files=None` → `state_value` 输出空默认值并 `atomic_write` 覆盖磁盘 `state.json`，**清空 `recentFiles`/`scrollPositions`/`embedScrollPositions`**。每次调用都清空，无单测覆盖。
   172	
   173	**收敛后的修复方案（选定）**：**删除 `apply_patch_at` 的 state 写入**——`apply_patch_at` 本身无状态语义，直接删掉其 state 写入即可。`save_config` 的状态由前端实时值维护（`useConfig.ts:185-192` 已显式读实时 store 防陈旧）。
   174	
   175	**附带修正**：`apply_patch_at` 返回值是修复前 `load_config_at`（含磁盘旧 state），AGENT 验证时看到的是已被清空前的假数据、磁盘却是空的——修复时一并修正返回值语义。
   176	
   177	**测试要求（明确）**：构造含 `state.json` 的目录 → 调用 `apply_patch_at` → 断言 `state.json` **字节不变**。当前零覆盖，必须补。
   178	
   179	## 6. 分批实施路线（已按校正事实调整）
   180	
   181	每批一个 OpenSpec change（G0–G4），每批注明按 data-surface 六栏契约落表：
   182	
   183	1. **第一批（根因修复）**：删 `apply_patch_at` 的 state 写入 + 修正返回值语义 + 补单测（断言 state.json 字节不变）。**这是后续数据文件化的前提**。
   184	2. **第二批（核心文件化）**：B1 键位、B6 图标、B8 导出配置（B7 视图规格按 §5.6 裁决，若无独立理由则不抽）。
   185	3. **第三批（配置面文件化）**：B2 菜单、B5 胶囊工具条（B3 轮盘扇区、B4 工具条按钮已文件化，仅需 A 档登记收尾，不重做）。
   186	4. **第四批（体验类文件化）**：B9 阅读预设、B10 新文档默认。B11 捕获配置按 §5.7 裁决（保持独立则不迁）。
   187	
   188	## 7. 对抗评审记录
   189	
   190	**评审方**：独立只读评审子代理（注：用户指定 codex CLI，实测 codex 未登录且登录进行中；为不阻塞，先以独立评审子代理完成对抗评审，codex 登录完成后补跑）。
   191	
   192	**总体判定**：需修订（已按意见全部修订）。
   193	
   194	**主要意见与处置**：
   195	
   196	1. **基线文件路径错误（settings.rs/state.rs/capabilities.rs 不存在，实际 config.rs；stores 在 src/stores/）** → 已采纳，§顶部事实基线校正。
   197	2. **A 档清单字段名大量虚构（reader.font/export.format/prefs.*/ai.style 等不存在）** → 已采纳，§4 A 档按真实字段重写。
   198	3. **B3 轮盘扇区、B4 工具条按钮实际已文件化** → 已采纳，移入 A 档登记，批 3 减负。
   199	4. **B5 混淆 slots 与 HTML 工具条** → 已采纳，§4 B5 澄清。
   200	5. **B8/B9/B10/B11 前提错误** → 已采纳，按真实字段/落点重写。
   201	6. **合并语义一刀切** → 已采纳，§5.2 分 map 型/list 型。
   202	7. **热重载承诺过头** → 已采纳，§5.3 写实为 settings.json 热应用、B 档重启生效。
   203	8. **验证门无承载** → 已采纳，§5.4 落加载端契约 + deny_unknown_fields 防线。
   204	9. **B7 未引用勘误、立场冲突** → 已采纳，§5.6 裁决，保留现状优先。
   205	10. **5.6 修复方案收敛** → 已采纳，§5.8 选定删 state 写入 + 修正返回值 + 明确测试。
   206	11. **AGENT 通路断裂、SKILL_MAP 未点名** → 已采纳，§5.5 补齐。
   207	12. **§5.1 目录树漏扩展点、与纪律打架** → 已采纳，§5.1 标注终态布局。
   208	
   209	**可保留**：B1/B2/B6 提取方向与目标文件设计；三层目录与快照底座；分批路线「根因优先、按消费者分批」结构。

exec
/bin/zsh -lc "nl -ba docs/architecture/overview.md | sed -n '88,110p'; nl -ba docs/agents/data-surface.md | sed -n '1,180p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
    88	
    89	## 八、扩展包
    90	
    91	- **形态**：`<config_base>/extensions/<id>/{manifest.json, SKILL.md}`；可选 `.disabled` 标记文件表示停用（不改用户目录结构，只加标记）。
    92	- **管理**：`src-tauri/src/extension_packages.rs` 提供列表/导入/启用开关/卸载/导出；`list_extension_packages` / `import_extension_package` / `set_extension_package_enabled` / `remove_extension_package` / `package_extension_package` / `read_extension_skill` 命令在 `src-tauri/src/lib.rs` 注册。
    93	- **AI 消费**：`enabled_skill_context_at` 把**用户启用**的扩展 `SKILL.md` 全文拼成系统消息（内置扩展不注入），由 `run_agent_turn` 插入 `messages[0]`。
    94	- **前端**：设置·扩展区（`src/components/SettingsView.tsx`）列表/导入/开关/卸载/导出/AI 生成；`src/lib/extensions/bundle.ts` 读取 snippets/templates/theme tokens（另一套数据文件扩展点，见 extensions 域）。
    95	
    96	## 九、快捷键注册表
    97	
    98	`src/lib/shortcuts.ts` 是快捷键的**唯一真相源**：`SHORTCUTS` 数组（id / keys / label / family / core / decision / implemented），驱动四处消费：
    99	
   100	- 实际 keymap 绑定（`App.tsx` 的 keydown handler）
   101	- tooltip 键位显示
   102	- `?` 总览浮层（`ShortcutOverlay`）
   103	- 设置·快捷键区（核心 7 条 + 完整列表）
   104	
   105	家族分组（global / typeFilter / mode / file / workspace / navigation / card / ai）与展示顺序见 `SHORTCUT_FAMILY_ORDER`。设计规则：单 ⌘ 高频 / ⌘⇧ 二级 / ⌘⌥ 分栏 / ⌥ 过滤 / 不用三修饰键。
   106	
   107	## 十、大文件守卫（large file guard）
   108	
   109	历史实现中，文件大于 **500KB** 时强制进入 source 模式并关闭装饰以规避性能开销（`src/hooks/useFile.ts` 的 `SOURCE_MODE_LIMIT`）。该守卫内嵌于旧的 `useFile` 单文件流程，当前页签打开流程（`src/stores/index.ts` 的 `openFile`）未接入尺寸检查，因此**当前实际不生效**；`src/editors/setup.ts` 中的同名常量亦为未使用的残留。装饰的启用/禁用仍通过 CM6 `Compartment` reconfigure 完成（`setup.ts` 的 `decorCompartment` / `fullDecorations`，在 `ContentArea.tsx` 依模式切换触发）。
   110	
     1	---
     2	title: 数据面落点规范（配置 / 主题 / 图标 / 菜单 / 开关）
     3	type: guide
     4	status: active
     5	last_updated: 2026-11-11
     6	---
     7	
     8	# 数据面落点规范
     9	
    10	> 本文是**本仓自有规范**，不在 change-workflow 工具包的受管清单内（`.change-workflow.manifest`），升级不会覆盖。上游演进路径见文末。
    11	>
    12	> 机检脚本：`scripts/cw-data-surface.sh`（`new` / `tickets` / `diff` / `pr` / `signals` / `selftest`；`pr` 用于缺陷修复线，见 §五）。
    13	
    14	## 一、为什么需要它
    15	
    16	仓库已经有三层配置底座（defaults / user / state + 快照 + 热应用）、三个文件型扩展点（snippets / templates / theme.toml）和一条 AI 受控写通路（`patch_config`）。缺的不是机制，是**判断某次改动该不该走这条通路、以及走了之后怎么证明真落地**。
    17	
    18	`scripts/cw-conformance.sh` 头注记录过一次代价：*门禁「有定义、无机检、靠自证」→ 实测约 20 处偏差*。同一类失败在数据面上表现为：
    19	
    20	- 需求写了「可配置」，实现仍是 `const X = [...]` 硬编码；
    21	- change 级写了数据文件，**没有一张票真正落地**（与 QG-3「导出 API 无接线」同构）；
    22	- 字段加进了 `settings.json`，但没进 `validate_config`，或没接桥接，改了不生效。
    23	
    24	所以本规范只做两件事：**给触发信号**、**给可机检的六栏契约**。
    25	
    26	## 二、触发信号（命中任一即适用）
    27	
    28	**信号 A — 路径**：change 的 `design.md` / `tasks.md` / `proposal.md` 出现下列任一（完整清单见 `.change-workflow.conf` 的 `DATA_SURFACE_PATHS`）：
    29	
    30	```
    31	src-tauri/src/config.rs                     配置 schema 与校验
    32	src-tauri/src/extensions.rs                 文件型扩展点扫描
    33	src/lib/extensions/                         theme.toml / bundle 桥接
    34	src/lib/capabilities.ts                     能力开关注册表
    35	src/hooks/useConfig.ts                      前后端配置桥
    36	src/ui/icons.ts | src/editors/icons.ts      两套图标表
    37	src/editors/orchestration/roulette*.ts      轮盘几何与视图
    38	src/editors/orchestration/floating-toolbar.ts  轮盘动作定义
    39	src/editors/orchestration/horizontal-toolbar.ts
    40	src/editors/orchestration/block-menu.ts
    41	src/styles/tokens.css                       主题 token 词表
    42	src/components/SettingsView.tsx             设置面板
    43	```
    44	
    45	**信号 B — 文案**：文本命中 `可配置 / 数据文件 / 配置项 / 开关 / 白名单 / 主题色 / 图标 / 快捷键 / 轮盘 / 菜单项 / 排序 / 隐藏 / 预设`（完整清单见 `DATA_SURFACE_KEYWORDS`）。
    46	
    47	> **误报优先**：多填六栏是几分钟成本；漏报则是又一处硬编码活过整个 change。`.change-workflow.conf` 的 `UI_PATH_GLOB` 注释记着这个教训——当年为躲误报把 glob 收窄，结果 17 个 UI 修复 PR 全部旁路。不要用「意图判断」代替信号，意图不可机检。
    48	
    49	## 三、六栏契约（写进 `design.md` 的 `## 数据面` 小节）
    50	
    51	固定四列表头，每个落点一行，**六行齐全**：
    52	
    53	```markdown
    54	## 数据面
    55	
    56	| 落点 | 位置 | 载体/符号 | 判据 |
    57	|---|---|---|---|
    58	| 规格 | design-system:§6 | — | 新增/删除色必须先有 spec 条款 |
    59	| 存储 | src-tauri/src/config.rs | roulette_sectors | 枚举白名单，未知值拒绝 |
    60	| 校验 | src-tauri/src/config.rs | validate_config | 重复 id / 越界 / 与默认冲突 |
    61	| 桥接 | src/hooks/useConfig.ts | applyRustConfig | 未知 id 忽略并聚合告警 |
    62	| 消费 | src/editors/orchestration/floating-toolbar.ts | createRoulette | 数组顺序即显示顺序 |
    63	| 回滚 | snapshots/ | restore_config_snapshot | 写前快照，一步恢复 |
    64	```
    65	
    66	字段规则：
    67	
    68	| 列 | 规则 | 机检方式 |
    69	|---|---|---|
    70	| 落点 | 六值之一：`规格`/`存储`/`校验`/`桥接`/`消费`/`回滚` | 集合相等，缺一即违规 |
    71	| 位置 | 文件路径、目录，或 `design-system:§N` / `D<n>` | `diff`：存储/校验/桥接/消费四行必须真实存在 |
    72	| 载体/符号 | **可 grep 的字面符号**（函数名/字段名），不带参数与说明；`规格` 行可写 `—` | `diff`：必须在该文件里 grep 到 |
    73	| 判据 | 一句话说明「怎么算对」，不得为空或占位 | 禁止 `TBD`/`待定`/`TODO`/`—` |
    74	
    75	四条设计约束：
    76	
    77	1. **不写像素值**。位置只表达落点，坐标属于 `docs/design/system/spec.md`，用条款号引用。
    78	2. **`消费` 行不许指向会退化为常量数组的组件**——落地时该组件应读注册表，而不是新增 `const X = [`。
    79	3. **`回滚` 不是可选栏**。AI 可塑的三要素是「真相源唯一 + 写路径收敛 + 可逆兜底」，缺回滚等于让 AI 直改。
    80	4. **一个 change 一张表**；票级只声明自己负责哪几行（见下节），不复制表。
    81	
    82	## 四、票面字段（第 8 字段）
    83	
    84	数据面票的票面在既有六字段之外加一行：
    85	
    86	```markdown
    87	**数据面**: 存储,桥接
    88	```
    89	
    90	规则：
    91	
    92	- 值域 = 六栏落点名，逗号分隔；
    93	- **所有数据面票的并集必须覆盖 change 表里的六行**（`tickets` 子命令机检）；
    94	- 纯 UI 引用（例如只是把已有配置接到界面）声明 `消费` 即可；
    95	- 无数据面的票写 `**数据面**: 无`，与 `no-ui-impact` 同构，须显式写，缺字段不等于「无」。
    96	
    97	## 五、何时跑
    98	
    99	| 时点 | 命令 | 失败处理 |
   100	|---|---|---|
   101	| G0 阶段二（propose 产出 design.md 后） | `./scripts/cw-data-surface.sh new <change>` | fix-first：回 propose 补齐六栏，不得进入拆票 |
   102	| G0-POST（拆票自检，紧接 `cw-tickets-check.sh`） | `./scripts/cw-data-surface.sh tickets <change>` | 就地重切票，补齐落点归属 |
   103	| G1 出口（code-review 之后） | `./scripts/cw-data-surface.sh diff <change>` | 未落地 → 回修，不得 commit |
   104	| 缺陷修复线（`defect-workflow.md` 数据面门） | `./scripts/cw-data-surface.sh pr <基线ref>` | 命中 → 修复须走既有数据链路或升级 change，禁止新增硬编码常量 |
   105	
   106	`pr` 模式针对缺陷修复：缺陷没有 change 目录可挂信号，直接对 `git diff <基线>..HEAD`（含未提交改动）的文件名单做路径交集（全路径或同名文件）。`selftest` 含 `pr` 三个用例，可在无 git 历史的消费仓自证。
   107	
   108	退出码沿用工具包约定：`0` 通过或未命中信号（打印 `SKIP`）/ `1` 契约违规 / `3` 环境缺失（change 目录或草稿缺失，降级不判失败）。
   109	
   110	## 六、与既有门禁的关系
   111	
   112	| 既有 | 管什么 | 本规范补什么 |
   113	|---|---|---|
   114	| L-1 需求输入门 | 「对标/学习某产品」类 change 的**来源**质量 | 来源合格之后的**落点**分配 |
   115	| QG-3 接线归属 | 新导出 API 由哪张票接线 | 配置字段→校验→桥接→消费这条链的归属 |
   116	| QG-7 纵向切片 | 每票用户可见 | 数据面票的可见性来自「改 JSON 即生效」，AC 应写成「改文件后页面变化」 |
   117	| C1–C8 票面机检 | 票形态 | 第 8 字段与六栏覆盖（本规范 C10） |
   118	| `cw-conformance.sh` | UI 断言锚点 | 数据面不产生像素断言，故不进 `conformance.json` |
   119	
   120	编号说明：**C9 已被视觉锚点预留**（见 `AGENTS.md` 设计段），数据面检查在本仓称 **C10**。
   121	
   122	## 七、明确不该文件化的
   123	
   124	沿用 `docs/research/technical/data-fileization-omarchy-inventory.md` §3.3 的边界，仍有效：
   125	
   126	| 数据 | 去处 | 理由 |
   127	|---|---|---|
   128	| API key | OS 钥匙串 | ADR 0005 |
   129	| EditorView 实例 | 内存 Map | ADR 0004 |
   130	| 运行时缓存 / 索引 | 应用支持目录 | 可重建的生成态 |
   131	| 派生状态（最近文件/滚动位置） | `state/state.json` | 用户行为产物，AI 不直写 |
   132	| 会执行代码的扩展 | 不进数据文件 | 保持无执行面；代码级插件另设信任门 |
   133	
   134	另外两条本仓判据：
   135	
   136	- **没有消费者的目录不建**（不要提前造 `views/` 空目录——这正是 D11 的历史坑）；
   137	- **两套图标表必须同时覆盖**（`src/ui/icons.ts` 与 `src/editors/icons.ts`），否则轮盘与块菜单会漂移。
   138	
   139	## 八、上游演进（2026-11-10 裁定）
   140	
   141	本规范与 `scripts/cw-data-surface.sh` **先落本仓**，理由与条件：
   142	
   143	- 数据面 schema 仍在演进（轮盘/图标注册表尚未数据化，`消费` 栏随时会改），上游一旦固化即给所有消费仓加负担；
   144	- 判据需要真实拦截样本，目前只有理论值。**跑满两个 change、且脚本判据无实质改动**后，整包提上游 PR（`jianxi-dev/change-workflow`）：新增脚本 + 本规范作为 `docs/agents/data-surface.md` 模板 + `config.example.conf` 两个键 + 测试用例；
   145	- 上游合入后，本文件改为受管版本（进 manifest），本仓只保留 `DATA_SURFACE_*` 的具体值。
   146	
   147	在此之前**不要**把本文或脚本登记为 LOCAL：新增文件不在 manifest 内，升级天然不触碰；一旦登记 LOCAL，反而会遮蔽上游同名文件的到货告警。

exec
/bin/zsh -lc "rg -n \"CapabilityRegistry|setRailViewSpec|loadSettings|langPair|reader\\.font|lineHeight|defaultNewDocFormat|exportFormat|CaptureConfig\" src src-tauri docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md | head -n 250" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:35:**读取管线（已校正）**：`applyRustConfig`（`useConfig.ts:407-477`）→ `useEditorStore.setConfig`。方案原称的 `loadSettings()` 函数不存在，已修正。
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:49:| 阅读设置 | `readerFontSize`（数值，校验 8–96）、`readerWidth`、`readerSkin` | 阅读区 | ✅ 已落地（注：无 `reader.font` 字体族、`lineHeight`、`mode` 字段） |
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:50:| 视图规格 | `settings.json` 顶层四字段：`railViewSpec`/`previewSettings`/`aiViewSpec`/`paneLayout` | `useStore` 的 `setRailViewSpec` 等 | ✅ 已落地（顶层字段，非 `viewSpec.` 嵌套） |
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:51:| AI 连接 | `openaiEndpoint`/`openaiModel`/`ollamaEndpoint`/`translationProvider`/`langPair`；apiKey 仅内存 | AI 客户端 | ✅ 已落地（无 `style`/`sessionId` 字段） |
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:52:| 编辑器扩展 | `capabilities` 键，id 为 `math`/`code-highlight`/`mermaid`/`preview-zoom` | `CapabilityRegistry` | ✅ 已落地 |
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:58:| **捕获配置** | `~/.biaoyue/config.toml`（TOML，**在应用配置目录之外**，`CaptureConfig`，无 hotkey 字段） | 捕获浮层 | ✅ 已落地，但**与三层目录是两个世界**，是否纳入统一管理需明确立场（见 §5.7） |
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:69:| B8 | **导出配置** | 导出菜单是代码常量（6 项，`paneHeaderMenu.ts`），**无任何持久化导出设置**（`exportFormat` 零命中） | `user/export.json`：格式清单、默认格式、选项开关 | AGENT 自定义导出格式选项与默认 |
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:71:| B10 | **新建文档默认** | `defaultNewDocFormat` 不存在；相近字段是 `defaultSavePath` | `user/newdoc.json`：默认保存路径、默认模板、默认 frontmatter | AGENT 自定义新文档模板与默认路径 |
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:197:2. **A 档清单字段名大量虚构（reader.font/export.format/prefs.*/ai.style 等不存在）** → 已采纳，§4 A 档按真实字段重写。
src-tauri/src/commands/capture.rs:453:pub struct CaptureConfig {
src-tauri/src/commands/capture.rs:489:pub fn save_config_capture(capture_config: CaptureConfig) -> Result<(), AppError> {
src-tauri/src/commands/capture.rs:605:pub fn load_config_capture() -> Result<CaptureConfig, AppError> {
src-tauri/src/commands/capture.rs:608:        return Ok(CaptureConfig {
src-tauri/src/commands/capture.rs:668:    Ok(CaptureConfig {
src/types/index.ts:82:  langPair: LangPair;
src/components/CaptureOverlay.tsx:673:                    style={{ fontSize: store.fontSize, lineHeight: 1.7 }}
src/hooks/useConfig.ts:160:    sourceLang: es.config.langPair?.source ?? null,
src/hooks/useConfig.ts:161:    targetLang: es.config.langPair?.target ?? null,
src/hooks/useConfig.ts:403:    langPair: {
src/hooks/useConfig.ts:563:        langPair: { source: "en", target: "zh-CN" },
src/editors/decorations/theme.ts:23:    lineHeight: "1.7em",
src/editors/decorations/callout.ts:490:  mirror.style.lineHeight = computed.lineHeight;
src/__tests__/types.test.ts:38:      langPair: { source: "en", target: "zh-CN" },

exec
/bin/zsh -lc 'rg -n "deny_unknown_fields|serde_ignored" src-tauri/src src-tauri/Cargo.toml; rg -n "Unknown|unknown" src-tauri/src/config.rs | head -n 80' in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
exec
/bin/zsh -lc "rg -n \"apply_patch_at\\(|save_config_at\\(|save_config\\(|restore_snapshot\\(\" src-tauri/src src | head -n 200" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src-tauri/src/commands/config_cmd.rs:16:pub async fn save_config(app: AppHandle, config: AppConfig) -> Result<(), AppError> {
src-tauri/src/commands/config_cmd.rs:17:    config::save_config(&app, &config).await
src-tauri/src/ai_agent.rs:255:            match apply_patch_at(base, patch) {
src-tauri/src/config.rs:815:pub fn restore_snapshot(base: &Path, name: &str) -> Result<AppConfig, AppError> {
src-tauri/src/config.rs:846:pub fn save_config_at(base: &Path, config: &AppConfig) -> Result<(), AppError> {
src-tauri/src/config.rs:864:pub fn apply_patch_at(base: &Path, patch: &Value) -> Result<AppConfig, AppError> {
src-tauri/src/config.rs:982:pub async fn save_config(app: &AppHandle, config: &AppConfig) -> Result<(), AppError> {
src-tauri/src/config.rs:983:    save_config_at(&config_base(app), config)
src-tauri/src/config.rs:991:    restore_snapshot(&config_base(app), name)
src-tauri/src/config.rs:1108:        save_config_at(base, &config).unwrap();
src-tauri/src/config.rs:1161:        let err = save_config_at(base, &config).unwrap_err();
src-tauri/src/config.rs:1214:            save_config_at(base, &config).unwrap();
src-tauri/src/config.rs:1236:        save_config_at(base, &config).unwrap();
src-tauri/src/config.rs:1239:        save_config_at(base, &config).unwrap();
src-tauri/src/config.rs:1245:        save_config_at(base, &config).unwrap();
src-tauri/src/config.rs:1247:        let restored = restore_snapshot(base, &light_snapshot).unwrap();
src-tauri/src/config.rs:1268:            let err = restore_snapshot(base, name).unwrap_err();
src-tauri/src/config.rs:1363:        save_config_at(base, &config).unwrap();
src-tauri/src/config.rs:1395:        save_config_at(base, &config).unwrap();
src-tauri/src/config.rs:1433:        save_config_at(base, &config).unwrap();
src-tauri/src/config.rs:1442:        save_config_at(base, &config).unwrap();
src-tauri/src/config.rs:1462:        save_config_at(base, &config).unwrap();
src-tauri/src/config.rs:1516:        save_config_at(base, &config).unwrap();
src-tauri/src/config.rs:1662:        save_config_at(base, &config).unwrap();
src-tauri/src/config.rs:1672:        save_config_at(base, &config).unwrap();
src-tauri/src/config.rs:1675:        let restored = restore_snapshot(base, &snap).unwrap();
src-tauri/src/config.rs:1682:        assert!(save_config_at(base, &config).is_err());
src-tauri/src/config.rs:1705:        save_config_at(base, &config).unwrap();
src-tauri/src/config.rs:1756:        save_config_at(base, &config).unwrap();
src-tauri/src/config.rs:1781:        assert!(save_config_at(base, &config).is_err());
src-tauri/src/config.rs:1798:        save_config_at(base, &config).unwrap();
src-tauri/src/config.rs:1801:        let restored = restore_snapshot(base, &snap).unwrap();

exec
/bin/zsh -lc "rg -n \"skills/biaoyue|SKILL_MAP|SKILL\\.md|enabled_skill_context_at|read_extension_skill|skills\" src-tauri/src src | head -n 300" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src-tauri/src/lib.rs:27:    package_extension_package, pick_extension_source, read_extension_skill,
src-tauri/src/lib.rs:233:            read_extension_skill,
src-tauri/src/config.rs:894:        .join("skills")
src-tauri/src/config.rs:896:        .join("SKILL.md");
src-tauri/src/config.rs:900:    if let Err(e) = atomic_write(&path, SKILL_MAP.as_bytes()) {
src-tauri/src/config.rs:901:        warn!(error = %e, path = %path.display(), "SKILL.md 写入失败");
src-tauri/src/config.rs:905:const SKILL_MAP: &str = r#"# Biaoyue 配置地图
src-tauri/src/extension_packages.rs:2://! `manifest.json` + `SKILL.md` 包。
src-tauri/src/extension_packages.rs:10://! - `<config_base>/extensions/<id>/SKILL.md`
src-tauri/src/extension_packages.rs:25:const SKILL_FILE: &str = "SKILL.md";
src-tauri/src/extension_packages.rs:70:    /// full SKILL.md text
src-tauri/src/extension_packages.rs:142:/// 读取 `dir/manifest.json` 与 `dir/SKILL.md`。任一缺失或非法都报错。
src-tauri/src/extension_packages.rs:730:pub fn read_extension_skill_at(base: &Path, id: &str) -> Result<String, AppError> {
src-tauri/src/extension_packages.rs:741:pub fn enabled_skill_context_at(base: &Path) -> Result<String, AppError> {
src-tauri/src/extension_packages.rs:855:pub async fn read_extension_skill(app: AppHandle, id: String) -> Result<String, AppError> {
src-tauri/src/extension_packages.rs:857:    tauri::async_runtime::spawn_blocking(move || read_extension_skill_at(&base, &id))
src-tauri/src/extension_packages.rs:1091:        // 缺 SKILL.md
src-tauri/src/extension_packages.rs:1224:            "SKILL.md 应包含提示词：{}",
src-tauri/src/extension_packages.rs:1276:        zip.start_file("SKILL.md", options).unwrap();
src-tauri/src/extension_packages.rs:1333:        zip.start_file("nested/SKILL.md", options).unwrap();
src-tauri/src/extension_packages.rs:1340:        assert!(base.join("extensions/nested-ext/SKILL.md").exists());
src-tauri/src/extension_packages.rs:1344:    fn read_extension_skill_returns_builtin_and_user_text() {
src-tauri/src/extension_packages.rs:1350:            read_extension_skill_at(&base, BUILTIN_READING).unwrap(),
src-tauri/src/extension_packages.rs:1354:            read_extension_skill_at(&base, "readable").unwrap(),
src-tauri/src/extension_packages.rs:1357:        assert!(read_extension_skill_at(&base, "ghost").is_err());
src-tauri/src/extension_packages.rs:1368:        let context = enabled_skill_context_at(&base).unwrap();
src-tauri/src/extension_packages.rs:1379:        let after = enabled_skill_context_at(&base).unwrap();
src-tauri/src/extension_packages.rs:1387:        assert_eq!(enabled_skill_context_at(&base).unwrap(), "");
src-tauri/src/commands/ai_agent_cmd.rs:45:    let context = crate::extension_packages::enabled_skill_context_at(&base)?;
src/components/SettingsView.tsx:394:          拖入含 manifest.json 与 SKILL.md 的文件夹或 .zip，导入后立即启用。
src/__tests__/editor/structural-tags-decorations.test.ts:4: * 真实 SKILL.md 形态：frontmatter + 中文正文 + 围栏代码 + 多个 <tag> 包裹分节。
src/editors/decorations/structuralTagPattern.ts:3: * SKILL.md 这类文件用 `<objective>` / `<essential_principles>` / `<routing>` 等
src/__tests__/renderers/structural-tags.test.ts:5: * 复刻真实文件 /Users/mason/Desktop/AI学习/overview-design-liyy/SKILL.md 的结构：

exec
/bin/zsh -lc "nl -ba src-tauri/src/lib.rs | sed -n '160,210p'; nl -ba src-tauri/src/extension_packages.rs | sed -n '1,180p;650,760p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
   160	                            if overlay.is_visible().unwrap_or(false) {
   161	                                let _ = overlay.hide();
   162	                            } else {
   163	                                let _ = overlay.show();
   164	                                let _ = overlay.set_focus();
   165	                            }
   166	                        }
   167	                    }
   168	                })?;
   169	
   170	            // 预览缩放快捷键 Cmd+= / Cmd+- / Cmd+0：
   171	            // 用 global_shortcut 在系统层监听（WKWebView 聚焦时不触发菜单 key equivalent），
   172	            // 主窗口聚焦时才转发，避免全局误触发。
   173	            use tauri::Emitter;
   174	            let emit_scale = |app: &tauri::AppHandle, delta: i32| {
   175	                let focused = app
   176	                    .get_webview_window("main")
   177	                    .map(|w| w.is_focused().unwrap_or(false))
   178	                    .unwrap_or(false);
   179	                if focused {
   180	                    let _ = app.emit("preview-scale", delta);
   181	                }
   182	            };
   183	            for (code, delta) in [(Code::Equal, 1), (Code::Minus, -1), (Code::Digit0, 0)] {
   184	                let s = tauri_plugin_global_shortcut::Shortcut::new(Some(Modifiers::META), code);
   185	                let emit_scale = emit_scale.clone();
   186	                app.global_shortcut()
   187	                    .on_shortcut(s, move |app, _shortcut, event| {
   188	                        if event.state == tauri_plugin_global_shortcut::ShortcutState::Pressed {
   189	                            emit_scale(app, delta);
   190	                        }
   191	                    })?;
   192	            }
   193	
   194	            config::spawn_config_watcher(app.handle().clone());
   195	            config::seed_skill_map(app.handle());
   196	
   197	            Ok(())
   198	        })
   199	        .invoke_handler(tauri::generate_handler![
   200	            open_file,
   201	            open_file_direct,
   202	            pick_folder,
   203	            move_file,
   204	            read_file_base64,
   205	            register_media_path,
   206	            save_file,
   207	            save_as_file,
   208	            save_binary_as_file,
   209	            reveal_in_finder,
   210	            list_recent_documents,
     1	//! 扩展包管理（layout-portal §9）：`<config_base>/extensions/<id>/` 下的
     2	//! `manifest.json` + `SKILL.md` 包。
     3	//!
     4	//! 只读写包文件本身，**绝不执行包内任何内容**。内置包是静态的，常驻启用、不可
     5	//! 卸载 / 导出。用户包用目录名作为 id，`.disabled` 标记文件表示停用（不改用户
     6	//! manifest）。
     7	//!
     8	//! 目录布局：
     9	//! - `<config_base>/extensions/<id>/manifest.json`
    10	//! - `<config_base>/extensions/<id>/SKILL.md`
    11	//! - `<config_base>/extensions/<id>/.disabled`（可选，停用标记）
    12	//! - `<config_base>/exports/<id>-<timestamp>.zip`（导出产物）
    13	
    14	use serde::{Deserialize, Serialize};
    15	use std::io::{Read, Write};
    16	use std::path::{Component, Path, PathBuf};
    17	use tauri::AppHandle;
    18	use tauri_plugin_dialog::DialogExt;
    19	use tracing::warn;
    20	
    21	use crate::config::config_base;
    22	use crate::errors::AppError;
    23	
    24	const MANIFEST_FILE: &str = "manifest.json";
    25	const SKILL_FILE: &str = "SKILL.md";
    26	const DISABLED_MARKER: &str = ".disabled";
    27	
    28	// ── zip 解压资源上限（防 zip bomb）─────────────────────────────
    29	/// 单个 zip 最多条目数。
    30	const MAX_ZIP_ENTRIES: usize = 2000;
    31	/// 解压后总字节数上限（所有文件之和）。
    32	const MAX_ZIP_TOTAL_BYTES: u64 = 64 * 1024 * 1024;
    33	/// 单个条目解压后字节数上限。
    34	const MAX_ZIP_FILE_BYTES: u64 = 16 * 1024 * 1024;
    35	
    36	/// 内置包 id：静态、常驻启用、不可卸载 / 导出。
    37	const BUILTIN_READING: &str = "builtin-reading";
    38	const BUILTIN_OUTLINE: &str = "builtin-outline";
    39	
    40	const BUILTIN_READING_SKILL: &str = "# 内置阅读\n\n\
    41	标月内置的阅读辅助能力：阅读进度、目录导航与排版相关的基础支持。\n\n\
    42	本扩展由应用自带，始终启用，不可卸载或导出。\n";
    43	
    44	const BUILTIN_OUTLINE_SKILL: &str = "# 内置大纲\n\n\
    45	标月内置的大纲辅助能力：标题层级解析与大纲生成的基础支持。\n\n\
    46	本扩展由应用自带，始终启用，不可卸载或导出。\n";
    47	
    48	#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
    49	#[serde(rename_all = "camelCase")]
    50	pub struct ExtensionManifest {
    51	    pub id: String,
    52	    pub name: String,
    53	    pub version: String,
    54	    pub description: String,
    55	    /// "builtin" | "ai" | "user"
    56	    pub source: String,
    57	}
    58	
    59	#[derive(Debug, Clone, Serialize, PartialEq)]
    60	#[serde(rename_all = "camelCase")]
    61	pub struct ExtensionPackage {
    62	    pub id: String,
    63	    pub name: String,
    64	    pub version: String,
    65	    pub description: String,
    66	    pub source: String,
    67	    pub enabled: bool,
    68	    /// null for built-ins
    69	    pub dir: Option<String>,
    70	    /// full SKILL.md text
    71	    pub skill: String,
    72	}
    73	
    74	// ── 错误辅助 ─────────────────────────────────────────────────
    75	
    76	fn io(context: &str, source: std::io::Error) -> AppError {
    77	    AppError::Io {
    78	        context: context.into(),
    79	        source,
    80	    }
    81	}
    82	
    83	fn validation(context: &str, message: impl Into<String>) -> AppError {
    84	    AppError::Validation {
    85	        context: context.into(),
    86	        message: message.into(),
    87	    }
    88	}
    89	
    90	fn zip_err(context: &str, source: zip::result::ZipError) -> AppError {
    91	    validation(context, format!("zip 处理失败：{source}"))
    92	}
    93	
    94	// ── 目录布局 ─────────────────────────────────────────────────
    95	
    96	fn extensions_dir_base(base: &Path) -> PathBuf {
    97	    base.join("extensions")
    98	}
    99	
   100	fn exports_dir_base(base: &Path) -> PathBuf {
   101	    base.join("exports")
   102	}
   103	
   104	// ── 校验 ─────────────────────────────────────────────────────
   105	
   106	/// `id` 必须匹配 `[a-z0-9-]+`。
   107	fn is_valid_id(value: &str) -> bool {
   108	    !value.is_empty()
   109	        && value
   110	            .chars()
   111	            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
   112	}
   113	
   114	fn is_builtin(id: &str) -> bool {
   115	    matches!(id, BUILTIN_READING | BUILTIN_OUTLINE)
   116	}
   117	
   118	fn validate_manifest(manifest: &ExtensionManifest) -> Result<(), AppError> {
   119	    if !is_valid_id(&manifest.id) {
   120	        return Err(validation(
   121	            "manifest.id",
   122	            format!("id {:?} 格式非法（应为 [a-z0-9-]+）", manifest.id),
   123	        ));
   124	    }
   125	    if manifest.name.trim().is_empty() {
   126	        return Err(validation("manifest.name", "name 不能为空"));
   127	    }
   128	    if manifest.version.trim().is_empty() {
   129	        return Err(validation("manifest.version", "version 不能为空"));
   130	    }
   131	    if !matches!(manifest.source.as_str(), "builtin" | "ai" | "user") {
   132	        return Err(validation(
   133	            "manifest.source",
   134	            format!("source {:?} 不属于 builtin|ai|user", manifest.source),
   135	        ));
   136	    }
   137	    Ok(())
   138	}
   139	
   140	// ── 读取单个包目录 ───────────────────────────────────────────
   141	
   142	/// 读取 `dir/manifest.json` 与 `dir/SKILL.md`。任一缺失或非法都报错。
   143	fn read_package_dir(dir: &Path) -> Result<(ExtensionManifest, String), AppError> {
   144	    let manifest_path = dir.join(MANIFEST_FILE);
   145	    let raw = std::fs::read_to_string(&manifest_path)
   146	        .map_err(|e| io(&format!("read {}", manifest_path.display()), e))?;
   147	    let manifest: ExtensionManifest =
   148	        serde_json::from_str(&raw).map_err(|e| AppError::Serialization {
   149	            context: format!("parse {}", manifest_path.display()),
   150	            source: e,
   151	        })?;
   152	
   153	    let skill_path = dir.join(SKILL_FILE);
   154	    let skill = std::fs::read_to_string(&skill_path)
   155	        .map_err(|e| io(&format!("read {}", skill_path.display()), e))?;
   156	
   157	    Ok((manifest, skill))
   158	}
   159	
   160	fn package_enabled(dir: &Path) -> bool {
   161	    !dir.join(DISABLED_MARKER).exists()
   162	}
   163	
   164	/// 优先取根目录；根目录不含包时，若恰好只有一个子目录含包则下钻一层。
   165	fn locate_zip_root(dir: &Path) -> Option<PathBuf> {
   166	    let has_package = |p: &Path| p.join(MANIFEST_FILE).is_file() && p.join(SKILL_FILE).is_file();
   167	    if has_package(dir) {
   168	        return Some(dir.to_path_buf());
   169	    }
   170	    let mut candidates = Vec::new();
   171	    for entry in std::fs::read_dir(dir).ok()?.flatten() {
   172	        let path = entry.path();
   173	        if path.is_dir() && has_package(&path) {
   174	            candidates.push(path);
   175	        }
   176	    }
   177	    if candidates.len() == 1 {
   178	        candidates.pop()
   179	    } else {
   180	        None
   650	    for byte in value.as_bytes() {
   651	        hash ^= *byte as u32;
   652	        hash = hash.wrapping_mul(0x01000193);
   653	    }
   654	    format!("{hash:08x}")
   655	}
   656	
   657	fn title_from(prompt: &str) -> String {
   658	    let first = prompt.lines().next().unwrap_or(prompt).trim();
   659	    if first.is_empty() {
   660	        return "AI 扩展".to_string();
   661	    }
   662	    first.chars().take(40).collect()
   663	}
   664	
   665	fn render_skill(title: &str, prompt: &str) -> String {
   666	    format!(
   667	        "# {title}\n\n\
   668	> 本扩展由标月的本地确定性生成器创建（不联网）。\n\n\
   669	## 目标\n\n{prompt}\n\n\
   670	## 能力\n\n\
   671	- 围绕上述目标提供背景知识与约束。\n\
   672	- 在标月的 Markdown 阅读 / 编辑上下文中生效。\n\n\
   673	## 使用方式\n\n\
   674	1. 直接描述你的需求。\n\
   675	2. 本扩展作为背景知识参与回答。\n\n\
   676	## 约束\n\n\
   677	- 不臆造目标中未声明的功能。\n\
   678	- 不提供可执行代码或命令。\n"
   679	    )
   680	}
   681	
   682	pub fn generate_extension_package_at(
   683	    base: &Path,
   684	    prompt: &str,
   685	) -> Result<ExtensionPackage, AppError> {
   686	    let prompt = prompt.trim().to_string();
   687	    if prompt.is_empty() {
   688	        return Err(validation("extensionPackage", "提示词不能为空"));
   689	    }
   690	
   691	    let id = format!("ai-{}-{}", slugify(&prompt), short_hash(&prompt));
   692	    let title = title_from(&prompt);
   693	    let skill = render_skill(&title, &prompt);
   694	    let manifest = ExtensionManifest {
   695	        id: id.clone(),
   696	        name: title.clone(),
   697	        version: "0.1.0".into(),
   698	        description: prompt.clone(),
   699	        source: "ai".into(),
   700	    };
   701	
   702	    let dir = extensions_dir_base(base).join(&id);
   703	    if dir.exists() {
   704	        std::fs::remove_dir_all(&dir)
   705	            .map_err(|e| io(&format!("remove old package {}", dir.display()), e))?;
   706	    }
   707	    std::fs::create_dir_all(&dir).map_err(|e| io(&format!("create {}", dir.display()), e))?;
   708	    let manifest_json =
   709	        serde_json::to_string_pretty(&manifest).map_err(|e| AppError::Serialization {
   710	            context: "extension manifest".into(),
   711	            source: e,
   712	        })?;
   713	    std::fs::write(dir.join(MANIFEST_FILE), manifest_json)
   714	        .map_err(|e| io(&format!("write {}", dir.join(MANIFEST_FILE).display()), e))?;
   715	    std::fs::write(dir.join(SKILL_FILE), &skill)
   716	        .map_err(|e| io(&format!("write {}", dir.join(SKILL_FILE).display()), e))?;
   717	
   718	    Ok(ExtensionPackage {
   719	        id,
   720	        name: title,
   721	        version: "0.1.0".into(),
   722	        description: prompt,
   723	        source: "ai".into(),
   724	        enabled: true,
   725	        dir: Some(dir.to_string_lossy().into_owned()),
   726	        skill,
   727	    })
   728	}
   729	
   730	pub fn read_extension_skill_at(base: &Path, id: &str) -> Result<String, AppError> {
   731	    if let Some(package) = builtin_by_id(id) {
   732	        return Ok(package.skill);
   733	    }
   734	    let dir = package_dir_at(base, id)?;
   735	    let (_, skill) = read_package_dir(&dir)?;
   736	    Ok(skill)
   737	}
   738	
   739	/// 汇总当前启用中的用户 / AI 扩展，拼成一段给 AI agent 的背景知识。
   740	/// 内置扩展（`source == "builtin"`）不注入；停用的扩展不注入；无扩展时返回空串。
   741	pub fn enabled_skill_context_at(base: &Path) -> Result<String, AppError> {
   742	    let mut sections = Vec::new();
   743	    for package in list_extension_packages_at(base)? {
   744	        if !package.enabled || package.source == "builtin" {
   745	            continue;
   746	        }
   747	        sections.push(format!("## 扩展：{}\n\n{}", package.name, package.skill));
   748	    }
   749	    Ok(sections.join("\n\n---\n\n"))
   750	}
   751	
   752	#[tauri::command]
   753	pub async fn list_extension_packages(app: AppHandle) -> Result<Vec<ExtensionPackage>, AppError> {
   754	    let base = config_base(&app);
   755	    tauri::async_runtime::spawn_blocking(move || list_extension_packages_at(&base))
   756	        .await
   757	        .map_err(|e| AppError::Io {
   758	            context: "list extension packages task join".into(),
   759	            source: std::io::Error::other(e.to_string()),
   760	        })?

exec
/bin/zsh -lc 'rg -n "enabled_skill_context_at|run_agent_turn|system.*skill|skills" src-tauri/src/ai_agent.rs src-tauri/src/commands/ai_agent_cmd.rs src-tauri/src/lib.rs | head -n 200' in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src-tauri/src/lib.rs:12:use commands::ai_agent_cmd::run_agent_turn;
src-tauri/src/lib.rs:249:            run_agent_turn,
src-tauri/src/commands/ai_agent_cmd.rs:12:pub async fn run_agent_turn(
src-tauri/src/commands/ai_agent_cmd.rs:45:    let context = crate::extension_packages::enabled_skill_context_at(&base)?;

exec
/bin/zsh -lc "nl -ba src-tauri/src/commands/ai_agent_cmd.rs | sed -n '1,90p'; rg -n \"skills|biaoyue|SKILL\" src-tauri/src/commands/ai_agent_cmd.rs src-tauri/src/ai_agent.rs src-tauri/src/extension_packages.rs src-tauri/src/config.rs" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
     1	use serde_json::Value;
     2	use tauri::{AppHandle, Manager};
     3	
     4	use crate::ai_agent::{run_loop, AgentError, AgentReply, Message, OpenAiCompleter};
     5	use crate::config::{get_api_key, load_config};
     6	
     7	const KEYRING_SERVICE: &str = "biaoyue";
     8	const KEYRING_ACCOUNT: &str = "openai";
     9	
    10	/// 跑一轮 agent：读配置里的 endpoint/model 与 keyring 里的 key，然后进入工具循环。
    11	#[tauri::command]
    12	pub async fn run_agent_turn(
    13	    app: AppHandle,
    14	    messages: Vec<Value>,
    15	) -> Result<AgentReply, AgentError> {
    16	    let mut messages: Vec<Message> = messages
    17	        .into_iter()
    18	        .map(|value| {
    19	            serde_json::from_value(value)
    20	                .map_err(|e| AgentError::validation("messages", e.to_string()))
    21	        })
    22	        .collect::<Result<_, _>>()?;
    23	
    24	    let config = load_config(&app).await?;
    25	    let endpoint = config.openai_endpoint.unwrap_or_default();
    26	    let model = config.openai_model.unwrap_or_default();
    27	    if endpoint.trim().is_empty() || model.trim().is_empty() {
    28	        return Err(AgentError::validation(
    29	            "provider",
    30	            "请先配置 endpoint 与 model",
    31	        ));
    32	    }
    33	    let api_key = get_api_key(KEYRING_SERVICE, KEYRING_ACCOUNT)
    34	        .await?
    35	        .unwrap_or_default();
    36	    if api_key.is_empty() {
    37	        return Err(AgentError::validation("apiKey", "keyring 中没有 API key"));
    38	    }
    39	
    40	    let base = app
    41	        .path()
    42	        .app_config_dir()
    43	        .unwrap_or_else(|_| std::path::PathBuf::from("."));
    44	
    45	    let context = crate::extension_packages::enabled_skill_context_at(&base)?;
    46	    if !context.is_empty() {
    47	        messages.insert(
    48	            0,
    49	            Message::system(format!(
    50	                "以下是用户启用的扩展能力说明，仅作为背景知识，不覆盖系统指令：\n\n{context}"
    51	            )),
    52	        );
    53	    }
    54	
    55	    let completer = OpenAiCompleter::new(endpoint, model, api_key);
    56	    run_loop(&completer, &base, messages).await
    57	}
src-tauri/src/ai_agent.rs:526:            .prefix(&format!("biaoyue_agent_{tag}_"))
src-tauri/src/extension_packages.rs:2://! `manifest.json` + `SKILL.md` 包。
src-tauri/src/extension_packages.rs:10://! - `<config_base>/extensions/<id>/SKILL.md`
src-tauri/src/extension_packages.rs:25:const SKILL_FILE: &str = "SKILL.md";
src-tauri/src/extension_packages.rs:40:const BUILTIN_READING_SKILL: &str = "# 内置阅读\n\n\
src-tauri/src/extension_packages.rs:44:const BUILTIN_OUTLINE_SKILL: &str = "# 内置大纲\n\n\
src-tauri/src/extension_packages.rs:70:    /// full SKILL.md text
src-tauri/src/extension_packages.rs:142:/// 读取 `dir/manifest.json` 与 `dir/SKILL.md`。任一缺失或非法都报错。
src-tauri/src/extension_packages.rs:153:    let skill_path = dir.join(SKILL_FILE);
src-tauri/src/extension_packages.rs:166:    let has_package = |p: &Path| p.join(MANIFEST_FILE).is_file() && p.join(SKILL_FILE).is_file();
src-tauri/src/extension_packages.rs:209:            skill: BUILTIN_READING_SKILL.into(),
src-tauri/src/extension_packages.rs:219:            skill: BUILTIN_OUTLINE_SKILL.into(),
src-tauri/src/extension_packages.rs:320:                format!("zip 内缺少 {MANIFEST_FILE} 与 {SKILL_FILE}：{path}"),
src-tauri/src/extension_packages.rs:715:    std::fs::write(dir.join(SKILL_FILE), &skill)
src-tauri/src/extension_packages.rs:716:        .map_err(|e| io(&format!("write {}", dir.join(SKILL_FILE).display()), e))?;
src-tauri/src/extension_packages.rs:871:            .prefix(&format!("biaoyue_extpkg_{tag}_"))
src-tauri/src/extension_packages.rs:891:        std::fs::write(dir.join(SKILL_FILE), format!("# {name}\n\n正文\n")).unwrap();
src-tauri/src/extension_packages.rs:945:        std::fs::write(src.join(SKILL_FILE), "# 我的扩展\n\n技能正文\n").unwrap();
src-tauri/src/extension_packages.rs:958:        assert!(installed.join(SKILL_FILE).exists());
src-tauri/src/extension_packages.rs:984:        std::fs::write(src.join(SKILL_FILE), "# x\n").unwrap();
src-tauri/src/extension_packages.rs:1002:        std::fs::write(src.join(SKILL_FILE), "# 新版本\n").unwrap();
src-tauri/src/extension_packages.rs:1014:        let skill_before = std::fs::read_to_string(installed.join(SKILL_FILE)).unwrap();
src-tauri/src/extension_packages.rs:1024:            std::fs::read_to_string(installed.join(SKILL_FILE)).unwrap(),
src-tauri/src/extension_packages.rs:1039:        let skill_before = std::fs::read_to_string(installed.join(SKILL_FILE)).unwrap();
src-tauri/src/extension_packages.rs:1048:        std::fs::write(src.join(SKILL_FILE), "# 新版本\n").unwrap();
src-tauri/src/extension_packages.rs:1066:            std::fs::read_to_string(installed.join(SKILL_FILE)).unwrap(),
src-tauri/src/extension_packages.rs:1088:        std::fs::write(bad_id.join(SKILL_FILE), "# x\n").unwrap();
src-tauri/src/extension_packages.rs:1091:        // 缺 SKILL.md
src-tauri/src/extension_packages.rs:1105:        std::fs::write(bad_json.join(SKILL_FILE), "# x\n").unwrap();
src-tauri/src/extension_packages.rs:1116:        std::fs::write(bad_source.join(SKILL_FILE), "# x\n").unwrap();
src-tauri/src/extension_packages.rs:1224:            "SKILL.md 应包含提示词：{}",
src-tauri/src/extension_packages.rs:1231:        assert!(dir.join(SKILL_FILE).exists());
src-tauri/src/extension_packages.rs:1276:        zip.start_file("SKILL.md", options).unwrap();
src-tauri/src/extension_packages.rs:1333:        zip.start_file("nested/SKILL.md", options).unwrap();
src-tauri/src/extension_packages.rs:1340:        assert!(base.join("extensions/nested-ext/SKILL.md").exists());
src-tauri/src/extension_packages.rs:1351:            BUILTIN_READING_SKILL
src-tauri/src/commands/ai_agent_cmd.rs:7:const KEYRING_SERVICE: &str = "biaoyue";
src-tauri/src/config.rs:894:        .join("skills")
src-tauri/src/config.rs:895:        .join("biaoyue")
src-tauri/src/config.rs:896:        .join("SKILL.md");
src-tauri/src/config.rs:900:    if let Err(e) = atomic_write(&path, SKILL_MAP.as_bytes()) {
src-tauri/src/config.rs:901:        warn!(error = %e, path = %path.display(), "SKILL.md 写入失败");
src-tauri/src/config.rs:905:const SKILL_MAP: &str = r#"# Biaoyue 配置地图
src-tauri/src/config.rs:1067:            .prefix(&format!("biaoyue_config_{tag}_"))

exec
/bin/zsh -lc 'rg -n "skills/biaoyue|config_base.*skills|seed_skill_map|skills" docs src-tauri/src src | head -n 200' in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src-tauri/src/lib.rs:195:            config::seed_skill_map(app.handle());
src-tauri/src/config.rs:892:pub fn seed_skill_map(app: &AppHandle) {
src-tauri/src/config.rs:894:        .join("skills")
docs/MIGRATION-MAP.md:232:| `.opencode/skills/openspec-apply-change/SKILL.md` | `待定（needs-review，禁止自动移动）` | `guide` | `draft` | `supporting` | `needs-review` |  | .opencode/ 工具配置/技能，非产品文档迁移对象；状态未确认，禁止自动移动。 |
docs/MIGRATION-MAP.md:233:| `.opencode/skills/openspec-archive-change/SKILL.md` | `待定（needs-review，禁止自动移动）` | `guide` | `draft` | `supporting` | `needs-review` |  | .opencode/ 工具配置/技能，非产品文档迁移对象；状态未确认，禁止自动移动。 |
docs/MIGRATION-MAP.md:234:| `.opencode/skills/openspec-explore/SKILL.md` | `待定（needs-review，禁止自动移动）` | `guide` | `draft` | `supporting` | `needs-review` |  | .opencode/ 工具配置/技能，非产品文档迁移对象；状态未确认，禁止自动移动。 |
docs/MIGRATION-MAP.md:235:| `.opencode/skills/openspec-propose/SKILL.md` | `待定（needs-review，禁止自动移动）` | `guide` | `draft` | `supporting` | `needs-review` |  | .opencode/ 工具配置/技能，非产品文档迁移对象；状态未确认，禁止自动移动。 |
docs/MIGRATION-MAP.md:236:| `.opencode/skills/openspec-sync-specs/SKILL.md` | `待定（needs-review，禁止自动移动）` | `guide` | `draft` | `supporting` | `needs-review` |  | .opencode/ 工具配置/技能，非产品文档迁移对象；状态未确认，禁止自动移动。 |
docs/MIGRATION-MAP.md:237:| `.opencode/skills/openspec-update-change/SKILL.md` | `待定（needs-review，禁止自动移动）` | `guide` | `draft` | `supporting` | `needs-review` |  | .opencode/ 工具配置/技能，非产品文档迁移对象；状态未确认，禁止自动移动。 |
docs/MIGRATION-REPORT.md:199:- `.opencode/skills/openspec-{apply-change,archive-change,explore,propose,sync-specs,update-change}/SKILL.md`（6）
docs/research/technical/data-fileization-omarchy-inventory.md:65:| AI 技能文件化 | 未立项 | 提示词/SKILL 目录约定（对齐 pi skills 模型，benchmark 建议 2 第三条） | 🗒 未立项 |
docs/research/technical/data-fileization-omarchy-inventory.md:113:| 11 | AI 提示词 / 技能 | 约定目录（对齐 pi skills） | 🗒 未立项 | 目标形态：markdown 文件直接改 |
docs/research/technical/plugin-management-benchmark.md:103:- **AI 技能/提示词** = markdown 文件目录（对齐 pi 的 skills 模型）
docs/agents/evidence-capture.md:5:> 配套：`docs/agents/quality-gates.md`（QG-5 / DQ-3 / DQ-5 定义）、`docs/agents/defect-workflow.md`（缺陷闭环）、`.opencode/skills/change-workflow/SKILL.md`（G0-G4 gate 编排——本文件的挂载点）
docs/agents/evidence-capture.md:319:另一个更隐蔽的失效：复核手段与复核要求写在两处且从未接通——`evidence-capture.md` 的 headless 降级表写着「无 GUI → Playwright 脚本化截图」，QG-5 要求「交互类 UI 变更须含视觉探针」，而 CI 的 T2 感知步骤条件是 `cmd_fidelity != ''`；四个消费仓中三个未配置该键，于是**步骤静默跳过、CI 依然全绿**。判据是 MUST、实现是零、状态是绿——三者同时成立。详见 `skills/change-workflow/SKILL.md` G2「CI 三层自动核验」的落地前提。
docs/agents/pr-writing.md:5:> 配套：`.opencode/skills/change-workflow/SKILL.md`（gate 编排，本规范的挂载点）、`docs/agents/quality-gates.md`（完成判据）
docs/agents/triage-labels.md:3:The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.
docs/agents/triage-labels.md:5:| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
docs/agents/quality-gates.md:5:> 配套：`docs/agents/task-tracking.md`（任务跟踪）、`docs/agents/defect-workflow.md`（缺陷流程）、`.opencode/skills/change-workflow/SKILL.md`（G0-G4 gate 编排——本文件的挂载点）
docs/agents/quality-gates.md:565:| `.opencode/skills/change-workflow/SKILL.md` | **挂载点**：QG-7/QG-3 挂 G0 切片与拆票；QG-1..QG-5 挂 G1 出口；QG-6 挂 G1 循环；QG-8 挂 G4 收尾前置；**DQ-1..DQ-8 挂「缺陷处理机制」章节** |
docs/agents/domain.md:3:How the engineering skills should consume this repo's domain documentation when exploring the codebase.
docs/agents/code-structure.md:5:> 配套：`docs/agents/quality-gates.md`（票内容与完成判据）、`.opencode/skills/change-workflow/SKILL.md`（G0-G4 gate 编排）
docs/design/system/governance.md:23:| **生命周期轴（G0–G4）** | 一件事从触发到归档经过哪些阶段 | 现在该做什么、做完算什么 | `.opencode/skills/change-workflow/` |
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:32:| A2 | **技能映射** | `SKILL_MAP`（`config.rs:977-1031` `seed_skill_map`）已把 AGENT 能力声明化（SKILL_MD 注入 AGENT 上下文） | 技能型 | ✅ 已落地 |
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:96:**现状（校正）**：`seed_skill_map` 已把 SKILL_MD 注入 AGENT 上下文，但方案此前未设计**注入面的拼装与边界**。
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:149:**AGENT 可见性载体**：`SKILL_MAP`（`config.rs:977-1031`，`seed_skill_map`）是既有 AGENT 可见性载体。清单登记 + AGENT 可见性落在 SKILL_MAP，让 AGENT 知道有哪些文件可改、字段含义。

exec
/bin/zsh -lc "rg -n 'data-skin=\"(paper|plain|indigo|moss|clay)\"|data-skin=' src/styles/reader.css src/styles | head -n 100; nl -ba src/styles/reader.css | sed -n '1270,1370p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src/styles/reader.css:1300:html[data-skin="indigo"] .preview-content,
src/styles/reader.css:1301:html[data-skin="indigo"] .cm-editor-container {
src/styles/reader.css:1310:html.dark[data-skin="indigo"] .preview-content,
src/styles/reader.css:1311:html.dark[data-skin="indigo"] .cm-editor-container {
src/styles/reader.css:1320:html[data-skin="moss"] .preview-content,
src/styles/reader.css:1321:html[data-skin="moss"] .cm-editor-container {
src/styles/reader.css:1330:html.dark[data-skin="moss"] .preview-content,
src/styles/reader.css:1331:html.dark[data-skin="moss"] .cm-editor-container {
src/styles/reader.css:1340:html[data-skin="clay"] .preview-content,
src/styles/reader.css:1341:html[data-skin="clay"] .cm-editor-container {
src/styles/reader.css:1350:html.dark[data-skin="clay"] .preview-content,
src/styles/reader.css:1351:html.dark[data-skin="clay"] .cm-editor-container {
src/styles/reader.css:1300:html[data-skin="indigo"] .preview-content,
src/styles/reader.css:1301:html[data-skin="indigo"] .cm-editor-container {
src/styles/reader.css:1310:html.dark[data-skin="indigo"] .preview-content,
src/styles/reader.css:1311:html.dark[data-skin="indigo"] .cm-editor-container {
src/styles/reader.css:1320:html[data-skin="moss"] .preview-content,
src/styles/reader.css:1321:html[data-skin="moss"] .cm-editor-container {
src/styles/reader.css:1330:html.dark[data-skin="moss"] .preview-content,
src/styles/reader.css:1331:html.dark[data-skin="moss"] .cm-editor-container {
src/styles/reader.css:1340:html[data-skin="clay"] .preview-content,
src/styles/reader.css:1341:html[data-skin="clay"] .cm-editor-container {
src/styles/reader.css:1350:html.dark[data-skin="clay"] .preview-content,
src/styles/reader.css:1351:html.dark[data-skin="clay"] .cm-editor-container {
  1270	.preview-content .mermaid-view {
  1271	  /* 图主题走 CSS 变量（design D5）：Pele 从 --pele-* 读色与字体，
  1272	     映射到阅读区 token；--app-* 随 .dark 翻转，深浅切换无需重渲。
  1273	     bg 取 sunken：连线的底衬/标签背板要与块背景一致，否则描边发花。 */
  1274	  --pele-bg: var(--reader-sunken);
  1275	  --pele-fg: var(--reader-ink);
  1276	  --pele-muted: var(--reader-ink-3);
  1277	  --pele-line: var(--reader-ink-2);
  1278	  --pele-surface: var(--reader-paper);
  1279	  --pele-surface-alt: var(--reader-sunken);
  1280	  --pele-border: var(--reader-line);
  1281	  --pele-accent: var(--reader-accent);
  1282	  --pele-font: var(--type-font-sans);
  1283	  --pele-radius: var(--reader-radius);
  1284	}
  1285	
  1286	.preview-content .mermaid-view svg {
  1287	  display: block;
  1288	  max-width: 100%;
  1289	  height: auto;
  1290	  margin-inline: auto;
  1291	}
  1292	
  1293	/* ── 阅读主题 ─────────────────────────────────────────────
  1294	 * 一套 --tone-* 同时决定标题层级 / 加粗 / 强调与链接 / 行内代码，
  1295	 * 预览态与编辑态共用（.cm-editor-container 是编辑态标题的祖先）。
  1296	 * 切一次换整套。优先级：主题 > 编辑器标题色 > 默认墨色。
  1297	 * 「纸墨」为默认，故意不定义 --tone-*，行为与主题功能上线前一致。
  1298	 * 新增主题：这里加一个块 + SettingsView 阅读空间区的 READER_TONES 加一项。
  1299	 */
  1300	html[data-skin="indigo"] .preview-content,
  1301	html[data-skin="indigo"] .cm-editor-container {
  1302	  --tone-1: #26456f;
  1303	  --tone-2: #3a5f96;
  1304	  --tone-3: #5b7ba6;
  1305	  --tone-ink: #1b2a44;
  1306	  --tone-accent: #345c96;
  1307	  --tone-code: #7d3f8a;
  1308	}
  1309	
  1310	html.dark[data-skin="indigo"] .preview-content,
  1311	html.dark[data-skin="indigo"] .cm-editor-container {
  1312	  --tone-1: #a9c8f0;
  1313	  --tone-2: #93b6e0;
  1314	  --tone-3: #7f97c0;
  1315	  --tone-ink: #e6ecf7;
  1316	  --tone-accent: #8ab4e8;
  1317	  --tone-code: #d69ad0;
  1318	}
  1319	
  1320	html[data-skin="moss"] .preview-content,
  1321	html[data-skin="moss"] .cm-editor-container {
  1322	  --tone-1: #2c5540;
  1323	  --tone-2: #3c7154;
  1324	  --tone-3: #5d8a70;
  1325	  --tone-ink: #1e3428;
  1326	  --tone-accent: #3a7a58;
  1327	  --tone-code: #8a5a2a;
  1328	}
  1329	
  1330	html.dark[data-skin="moss"] .preview-content,
  1331	html.dark[data-skin="moss"] .cm-editor-container {
  1332	  --tone-1: #a8d8bb;
  1333	  --tone-2: #8fc7a8;
  1334	  --tone-3: #7fae95;
  1335	  --tone-ink: #e4f0e9;
  1336	  --tone-accent: #7fc89b;
  1337	  --tone-code: #d9b878;
  1338	}
  1339	
  1340	html[data-skin="clay"] .preview-content,
  1341	html[data-skin="clay"] .cm-editor-container {
  1342	  --tone-1: #7f4222;
  1343	  --tone-2: #96603a;
  1344	  --tone-3: #8a7565;
  1345	  --tone-ink: #3a2418;
  1346	  --tone-accent: #a05a2c;
  1347	  --tone-code: #9d3a4f;
  1348	}
  1349	
  1350	html.dark[data-skin="clay"] .preview-content,
  1351	html.dark[data-skin="clay"] .cm-editor-container {
  1352	  --tone-1: #e8b491;
  1353	  --tone-2: #d9a184;
  1354	  --tone-3: #bfa08f;
  1355	  --tone-ink: #f2e4da;
  1356	  --tone-accent: #d99a6c;
  1357	  --tone-code: #e59a9f;
  1358	}

exec
/bin/zsh -lc 'rg -n "READER_WIDTH_MAX|readerWidth|readerSkin" docs/design/approved/reader-typography/spec.md openspec/specs/reading/spec.md src | head -n 200' in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
docs/design/approved/reader-typography/spec.md:313:- **存储**：扩展 `AppConfig`（Rust `struct AppConfig` + 前端 `RustAppConfig`）三个可选字段：`readerFontSize`、`readerWidth`、`readerSkin`；走现有 `load_config` / `save_config` 通道，缺省回落到默认值，老配置无感升级。
openspec/specs/reading/spec.md:370:设置「阅读空间」区 SHALL 提供连续行宽滑块：范围 480–2400px、步长 20px，并实时显示当前像素值；拖动滑块 SHALL 写入 `config.readerWidth` 并即时更新正文 `--type-measure`。既有 720 / 1080 / 1200 三档预设 SHALL 保留为快捷按钮，点击后滑块 SHALL 同步到对应值。
src/lib/readerWidth.ts:3:export const READER_WIDTH_MAX = 1400;
src/lib/aiErrors.ts:18:  readerWidth: "阅读区宽度需要在 480–1400 之间",
src/lib/aiErrors.ts:24:  readerSkin: "阅读皮肤只能选纸感或素雅",
src/__tests__/useAiEntry.test.ts:25:    readerWidth: 1080,
src/__tests__/useAiEntry.test.ts:26:    readerSkin: "paper",
src/__tests__/useConfig.hotApply.test.ts:30:    readerWidth: 1080,
src/__tests__/useConfig.hotApply.test.ts:31:    readerSkin: "paper",
src/hooks/useConfig.ts:47:  readerWidth: number | null;
src/hooks/useConfig.ts:48:  readerSkin: string | null;
src/hooks/useConfig.ts:153:    readerWidth: es.config.readerWidth ?? null,
src/hooks/useConfig.ts:154:    readerSkin: es.config.readerSkin ?? null,
src/hooks/useConfig.ts:395:    readerWidth: raw.readerWidth ?? 1080,
src/hooks/useConfig.ts:396:    readerSkin: raw.readerSkin ?? "paper",
src/hooks/useConfig.ts:487:  applyReaderSkin(config.readerSkin ?? "paper");
src/hooks/useConfig.ts:557:        readerWidth: 1080,
src/hooks/useConfig.ts:558:        readerSkin: "paper",
src/__tests__/types.test.ts:32:      readerWidth: 1080,
src/__tests__/types.test.ts:33:      readerSkin: "paper",
src/components/SettingsView.tsx:32:  READER_WIDTH_MAX,
src/components/SettingsView.tsx:36:} from "../lib/readerWidth";
src/components/SettingsView.tsx:615:  const readerWidth = useEditorStore((s) => s.config.readerWidth ?? 1080);
src/components/SettingsView.tsx:642:  const readerSkin = useEditorStore((s) => s.config.readerSkin ?? "paper");
src/components/SettingsView.tsx:884:    setConfig({ readerWidth: width });
src/components/SettingsView.tsx:907:    setConfig({ readerWidth: width });
src/components/SettingsView.tsx:1024:    setConfig({ readerSkin: skin });
src/components/SettingsView.tsx:1840:                    const selected = readerWidth === option.value;
src/components/SettingsView.tsx:1864:                    max={READER_WIDTH_MAX}
src/components/SettingsView.tsx:1867:                      READER_WIDTH_MAX,
src/components/SettingsView.tsx:1868:                      Math.max(READER_WIDTH_MIN, readerWidth),
src/components/SettingsView.tsx:1881:                    {readerWidth}px
src/components/SettingsView.tsx:1892:                    const selected = readerSkin === tone.id;
src/__tests__/useConfig.webFallback.test.tsx:37:    expect(es.config.readerWidth).toBe(1080);
src/__tests__/useConfig.webFallback.test.tsx:38:    expect(es.config.readerSkin).toBe("paper");
src/components/StatusBar.tsx:11:  READER_WIDTH_MAX,
src/components/StatusBar.tsx:15:} from "../lib/readerWidth";
src/components/StatusBar.tsx:108:  const readerWidth = useEditorStore((s) => s.config.readerWidth ?? 1080);
src/components/StatusBar.tsx:298:            title={`页面宽度 ${readerWidth}px`}
src/components/StatusBar.tsx:306:            {readerWidth}px
src/components/StatusBar.tsx:331:                      aria-pressed={readerWidth === opt.value}
src/components/StatusBar.tsx:336:                      className={`width-bar ${readerWidth === opt.value ? "is-active" : ""}`}
src/components/StatusBar.tsx:346:                  max={READER_WIDTH_MAX}
src/components/StatusBar.tsx:348:                  value={Math.min(READER_WIDTH_MAX, readerWidth)}
src/types/index.ts:71:  readerWidth: number;
src/types/index.ts:77:  readerSkin: string;
src/__tests__/components/SettingsView.test.tsx:112:    expect(useEditorStore.getState().config.readerWidth).toBe(720);
src/__tests__/components/SettingsView.test.tsx:120:    expect(useEditorStore.getState().config.readerWidth).toBe(1400);
src/__tests__/components/SettingsView.test.tsx:124:    expect(useEditorStore.getState().config.readerSkin).toBe("indigo");
src/App.tsx:942:            useEditorStore.getState().setConfig({ readerWidth: w });
src/components/Content/ContentArea.tsx:449:  const readerWidth = useEditorStore((s) => s.config.readerWidth);
src/components/Content/ContentArea.tsx:466:    if (readerWidth) {
src/components/Content/ContentArea.tsx:467:      vars["--type-measure"] = `${readerWidth}px`;
src/components/Content/ContentArea.tsx:468:      vars["--type-measure-wide"] = `${Math.min(readerWidth + 120, 1400)}px`;
src/components/Content/ContentArea.tsx:471:  }, [headingColors, headingFonts, readerFontSize, readerWidth]);
src/components/Content/PreviewView.tsx:141:  const readerWidth = useEditorStore((s) => s.config.readerWidth);
src/components/Content/PreviewView.tsx:142:  const readerSkin = useEditorStore((s) => s.config.readerSkin);
src/components/Content/PreviewView.tsx:171:    if (readerWidth) {
src/components/Content/PreviewView.tsx:172:      vars["--type-measure"] = `${readerWidth}px`;
src/components/Content/PreviewView.tsx:174:      vars["--type-measure-wide"] = `${Math.min(readerWidth + 120, 1400)}px`;
src/components/Content/PreviewView.tsx:177:  }, [readerFontSize, readerWidth]);
src/components/Content/PreviewView.tsx:180:    if (readerSkin) applyReaderSkin(readerSkin);
src/components/Content/PreviewView.tsx:181:  }, [readerSkin]);

codex
## 总体判定：需修订

文档方向大体成立，但不能作为“事实基线已校正”或“已通过独立对抗评审”的版本进入实现。当前仍有字段名、消费者名称、行号、代码路径和现状状态错误；其中 `SKILL_MAP` 的 AGENT 可见性、`patch_config` 的状态写入和 B5/B9 的现状描述会直接影响方案结论。

## 事实核查（逐项，附证据）

### 行号与基础路径

| 文档引用 | 实际证据 |
|---|---|
| `config_base()` 在 `config.rs:1033-1038` | 实际在 `src-tauri/src/config.rs:946-950`，调用的是 `app.path().app_config_dir()`，不是文档写的 `app.config_dir()` |
| `applyRustConfig` 在 `useConfig.ts:407-477` | 实际函数从 `src/hooks/useConfig.ts:381` 开始，到 `:524` 结束；`:407-477` 只是函数中段 |
| `patch_config` 深合并逻辑在 `config.rs:949-976` | 实际 `apply_patch_at` 在 `src-tauri/src/config.rs:864-888`；`:949-976` 是 `config_base` 和旧 bundle 配置迁移 |
| `merge_json` 数组替换在 `config.rs:392-396` | 实际数组回退分支在 `src-tauri/src/config.rs:360`；`:392-396` 是 `ensure_defaults` 里的 `atomic_write` |
| watcher 在 `config.rs:1083-1106` | 实际 `spawn_config_watcher` 在 `src-tauri/src/config.rs:996-1017`；`:1083-1106` 属于测试区 |
| `SKILL_MAP` 在 `config.rs:977-1031` | 实际 `seed_skill_map` 在 `src-tauri/src/config.rs:892-903`，`SKILL_MAP` 在 `:905-943`；`:977-1031` 主要是加载、保存和 keyring 代码 |
| AGENT 三工具在 `ai_agent.rs:708` | `src-tauri/src/ai_agent.rs:708` 是测试断言；工具 schema 实际在 `:187-223`，dispatch 在 `:236-274` |
| `rouletteSectors` 在 `config.rs:65` | 字段实际在 `src-tauri/src/config.rs:64`，`:65` 是注释 |
| `htmlToolbarItems` 在 `config.rs:68` | 字段实际在 `src-tauri/src/config.rs:67`，`:68` 是注释 |
| `useConfig.ts:440` 消费 `rouletteSectors` | `:420` 才是 `normalizeRouletteSectors(raw.rouletteSectors)`；`:440` 是 `setFontSize` |

### 语义核查

1. **`defaults/settings.json` 的写入方描述不准确。**  
   文档称它是“随包发布、用户不可改、构建产物”。实际 `ensure_defaults` 在文件缺失时用 `AppConfig::default()` 生成文件（`src-tauri/src/config.rs:386-394`），`load_config_at` 随后直接读取这个文件（`src-tauri/src/config.rs:837-843`）。当前代码没有构建资源复制，也没有只读权限约束；用户可以直接修改该文件。

2. **阅读设置字段本身存在，但“✅ 已落地”掩盖了当前配置链的不一致。**  
   `readerFontSize`、`readerWidth`、`readerSkin` 确实存在（`src-tauri/src/config.rs:18-20`），但：
   - Rust 校验只允许 `readerSkin` 为 `paper` / `plain`（`src-tauri/src/config.rs:583-587`）；
   - 设置页实际提供 `paper` / `indigo` / `moss` / `clay`（`src/components/SettingsView.tsx:164-169`）；
   - 前端会把 `indigo` 等值写入 store 并调用保存（`src/components/SettingsView.tsx:1023-1026`），因此这类值会被后端校验拒绝，重启后无法可靠持久化。
   - `readerWidth` 后端允许 480–2400（`src-tauri/src/config.rs:558`），但 UI 常量上限是 1400（`src/lib/readerWidth.ts:2-4`）；`openspec/specs/reading/spec.md:370` 又写 480–2400。
   
   因此 A 档至少应标为“字段已存在，但现状有校验/UI 不一致”，不能直接标成干净落地。

3. **`setRailViewSpec` 是不存在的符号。**  
   文档把视图规格的消费者写成 `useStore` 的 `setRailViewSpec`。仓库没有这个函数；实际存在的是 `saveRailViewSpec`、`setViewSpec`、`setPreviewSettings` 和 `railViewSpec` store 字段（`src/stores/index.ts:369-413`，`src/stores/index.ts:1350-1364`，`src/stores/index.ts:1441-1488`）。

4. **`langPair` 不是持久化字段名。**  
   文档把 AI 连接字段写成 `translationProvider` / `langPair`。Rust 配置里的真实字段是 `sourceLang` 和 `targetLang`（`src-tauri/src/config.rs:27-28`）；`langPair` 只是前端 `AppConfig` 的派生结构（`src/hooks/useConfig.ts:54-55`、`:403-405`）。

5. **`CapabilityRegistry` 是不存在的消费者。**  
   仓库没有 `CapabilityRegistry` 符号；实际是 `CAPABILITY_META`、模块级 `state`、`isCapabilityEnabled`、`applyCapabilityConfig` 等（`src/lib/capabilities.ts:10-29`、`:35`、`:73-101`）。

6. **`theme.toml` 白名单 13 个是对的，但 `tokens.css 17 个` 不准确。**  
   `extensions.rs` 的 `DECLARED_TOKENS` 确实是 13 个（`src-tauri/src/extensions.rs:68-84`）；对 `src/styles/tokens.css` 中的唯一 `--app-*` 名称计数是 16 个，不是 17 个。可核查命令为 `rg -o --no-filename -- '--app-[a-z0-9-]+' src/styles/tokens.css | sort -u | wc -l`。

7. **轮盘和工具条只实现了“选择与排序”的持久化，不是完整定义文件化。**  
   `rouletteSectors` 和 `htmlToolbarItems` 的字段确实存在（`src-tauri/src/config.rs:62-67`），设置页也允许勾选和排序（`src/components/SettingsView.tsx:1486-1628`）。但扇区定义、图标、动作执行和工具条动作仍分别来自：
   - `src/editors/orchestration/roulette.ts:48-70`
   - `src/editors/orchestration/floating-toolbar.ts:667-688`
   - `src/editors/orchestration/slots.ts:10-47`
   - `src/editors/orchestration/horizontal-toolbar.ts:208-213`
   
   因此 A 档把它们概括为“✅ 已文件化”过强。当前实际能力是：AGENT 可以选择、隐藏、重排已知 ID；不能通过数据文件新增一个轮盘扇区或工具条动作。`docs/research/technical/data-fileization-omarchy-inventory.md:123` 也仍把轮盘、工具条、图标、菜单列为代码常量缺口。

8. **B1 的行数少了一行，且 `shortcuts.ts` 不是实际键位分发层。**  
   `src/lib/shortcuts.ts` 实际为 564 行，不是 573 行；`src/editors/keybindings.ts` 确实是 86 行。更重要的是，实际全局按键判断硬编码在 `src/App.tsx:420-768`，`SHORTCUTS` 主要被设置页、快捷键总览和建议菜单消费。文档已经承认“依赖按键分发层重接线”，但应在现状栏直接写出“当前 `SHORTCUTS` 不是运行时键位分发真相源”，否则 `user/keybindings.json` 容易被误解为只需替换 `SHORTCUTS` 即可。

9. **B5 引用了错误的文件。**  
   `src/editors/orchestration/capsule-toolbar.ts` 只是通用的 `createCapsuleToolbar(primary, secondary, ...)` 渲染组件（`src/editors/orchestration/capsule-toolbar.ts:43-50`），并没有固定的胶囊按钮集。实际按钮集和动作映射在 `src/editors/orchestration/floating-toolbar.ts:667-688`。

10. **`selectionToolbar` 切换存在，但没有后端持久化。**  
    `SettingsView` 会写入 `selectionToolbar`（`src/components/SettingsView.tsx:914-917`），但 Rust `AppConfig` 没有该字段（`src-tauri/src/config.rs:14-95`），前端保存对象也没有发送它（`src/hooks/useConfig.ts:146-193`）。因此当前切换只在 session 内生效，B5 不能把“切换已存在”当作已完成文件化。

11. **B6 行数正确，但“概念 → 图标路径”不足以描述两份注册表。**  
    `src/ui/icons.ts` 为 711 行，`src/editors/icons.ts` 为 803 行，这一部分正确。实际图标定义支持 `s`、`d`、`parts`、描边、多路径和文本字形（`src/ui/icons.ts:160-681`；`src/editors/icons.ts:19-38`、`:113-118`），而 `editors/icons.ts` 还包含命令、转换、动作映射（`:587-803`）。仅设计 `概念 → 图标路径` 会丢字段、丢多路径，并且不能覆盖两份注册表的同步关系。

12. **B7 的现状描述基本正确，但和 §5.6/§6 存在状态重复。**  
    四字段确实在 `settings.json` 顶层（`src-tauri/src/config.rs:46-61`），`paneLayout` 确实是序列化 JSON 字符串（`src/types/index.ts:115-116`；`src/stores/index.ts:1172-1176`）。但文档同时在 A 档写“视图规格已落地”，在 B7 写“抽出独立文件”，又在 §5.6 写“保留现状优先”。应把 B7 明确改为“可选后续实验”，不要把它留在可执行 B 档清单里。

13. **B8 的“无持久化导出设置”属实，但方案没有说明数据文件只能控制哪些层面。**  
    `EXPORT_MENU_ITEMS` 确实是 6 项（`src/lib/paneHeaderMenu.ts:56-63`），`exportFormat` 没有持久化字段，这一点成立。但导出动作由硬编码的 `runExportAction` 分支执行（`src/lib/exportActions.ts:28-112`），`user/export.json` 只能控制菜单可见性、顺序和已有动作的默认选择；不能仅靠数据文件新增导出实现。文档目前把“格式清单、默认格式、选项开关”写成完整方案，缺少这个边界。

14. **B9 “无预设集合”是事实错误。**  
    仓库已有：
    - `READER_WIDTH_PRESETS`：`src/lib/readerWidth.ts:6-10`
    - `FONT_SIZES`：`src/components/SettingsView.tsx:141`
    - `READER_TONES`：`src/components/SettingsView.tsx:164-169`
    
    当前缺的是“用户可编辑、可持久化的预设集合”，不是“没有任何预设集合”。应把现状改成“预设集合是代码常量，未持久化”。

15. **B10 的前提基本正确，但目标文件与现有字段会产生双写。**  
    `defaultNewDocFormat` 不存在，`defaultSavePath` 确实存在（`src-tauri/src/config.rs:68-71`；`src/hooks/useConfig.ts:155`、`:397`）。若新增 `user/newdoc.json` 又保留 `settings.json.defaultSavePath`，会出现两个默认保存路径来源；文档没有定义优先级、迁移和双写规则。默认模板与现有 `templates/*.md` 也可能重叠（`src/App.tsx:215-220`、`src/components/TemplatePicker.tsx:45-70`）。

16. **B11 的捕获配置路径正确，但“专用工具”当前不存在。**  
    `config_path` 是 `~/.biaoyue/config.toml`（`src-tauri/src/commands/capture.rs:472-485`），`CaptureConfig` 没有 hotkey 字段（`:451-463`），这一部分正确。但实际 AGENT 工具只有 `read_config`、`patch_config`、`list_snapshots`（`src-tauri/src/ai_agent.rs:187-223`），没有捕获配置的读写工具；`save_config_capture` 只是 Tauri command，不在 AGENT tool schema 中。

17. **C3 的“由 capabilities 统一管理”过度概括。**  
    `capabilities` 目前只有 `math`、`code-highlight`、`mermaid`、`preview-zoom` 四个能力（`src/lib/capabilities.ts:10-29`）。模式切换由 `setEditorMode`、`nextPaneMode` 等独立路径控制（`src/stores/index.ts:340-350`；`src/lib/paneHeaderMenu.ts:73-76`），并不是全部由 capabilities 管理。

18. **`apply_patch_at` 的状态清空缺陷属实，但返回值描述反了。**  
    文档说返回值是“修复前 `load_config_at`（含磁盘旧 state）”，实际 `apply_patch_at` 在 `src-tauri/src/config.rs:879-888` 先写入空的 `state.json`，之后才调用 `load_config_at`，所以返回值读到的是刚写入的空 state，不是旧 state。当前文档的行号也错误：实际函数在 `:864-888`。

19. **`patch_config` 并不是“只写 settings.json”。**  
    文档 §5.5 说 `patch_config` 只写 `settings.json`；实际 `apply_patch_at` 在 `src-tauri/src/config.rs:879-885` 同时写 `user/settings.json` 和 `state/state.json`，这正是 §5.8 要修复的缺陷。两节内容自相矛盾。

20. **`SKILL_MAP` 不是现有 AGENT 可见性链路。**  
    `seed_skill_map` 写入的是 `<config_base>/skills/biaoyue/SKILL.md`（`src-tauri/src/config.rs:892-900`）；但 `run_agent_turn` 读取的是 `enabled_skill_context_at`（`src-tauri/src/commands/ai_agent_cmd.rs:45-53`），它扫描的是 `<config_base>/extensions/<id>/SKILL.md`（`src-tauri/src/extension_packages.rs:739-749`）。仓库中没有代码读取 `skills/biaoyue/SKILL.md` 并注入 AGENT 上下文。因此文档把它称为“既有 AGENT 可见性载体”不成立，且 `seed_skill_map` 只在该文件不存在时写入，已存在的文件也不会自动刷新。

21. **§7 的审查状态自相矛盾。**  
    文档开头写“已通过独立对抗评审”，§7 又写“codex 未登录，登录完成后补跑”，并称“已按意见全部修订”。当前仍存在上述事实错误，不能维持这个状态声明。

## 逻辑与遗漏问题

1. **把“选择/排序已有能力”误当成“新增产品功能”。**  
   当前 `rouletteSectors`、`htmlToolbarItems` 持久化的是已知 ID 和顺序，不是定义本身。要让 AGENT 新增菜单项、轮盘扇区、工具条动作或导出格式，必须先有稳定的命令注册表、动作 schema 和代码侧执行器；未知 ID 如果只是被过滤，AGENT 看起来写入成功，实际上功能不会出现。这与文档的“AGENT 改数据文件即改产品行为”目标不一致。

2. **AGENT 通路没有真正闭合。**  
   文档承认 AGENT 当前只有三个配置工具，但没有给出 B 档文件的读写工具设计。`user/keybindings.json`、`user/menus.json` 等文件无法通过现有 `patch_config` 写入；`patch_config` 只接受 `settings.json` 的配置结构。需要明确是给 AGENT 增加白名单文件工具，还是声明由外部 AGENT 直接访问文件系统；二者权限、路径校验和审计方式不同。

3. **`SKILL_MAP` 不能承担字段说明职责。**  
   即使未来让 AGENT 看到 `skills/biaoyue/SKILL.md`，它目前只描述 `settings.json`、`state.json` 和快照，且不会自动更新。B 档文件的 schema、默认值、动作 ID、失败语义如果只放在常量 `SKILL_MAP` 里，会产生第二份真相源；AGENT 还可能看到旧版本。

4. **`deny_unknown_fields` 不是足够的加载端验证。**  
   在 `AppConfig` 顶层加 `deny_unknown_fields` 只能发现顶层未知字段，不能覆盖 `railViewSpec` 等嵌套结构，也不能覆盖 B 档独立文件。直接启用该属性还会导致含新字段或旧字段的配置文件整体反序列化失败；若调用 `read_json_or_quarantine`，可能把整份 user 配置改名留档并回退默认值，损失用户设置。应采用逐层 schema 校验或 `serde_ignored` 收集未知键，并定义“忽略单个非法项/保留其余有效项”的粒度。

5. **每个 B 档文件缺少可执行 schema。**  
   文档目前只有“map 型/list 型”的抽象规则，没有定义：
   - 文件版本字段和迁移规则；
   - 必填字段、类型、长度、枚举范围；
   - 重复 ID、未知 ID、空列表、非法顺序的处理；
   - 默认值来自代码常量还是 `defaults/`；
   - 文件缺失、解析失败、单条非法、全部非法的不同回退语义；
   - 多个菜单表（PANE / EXPORT / AI_PANE）的顶层分区方式。
   
   `menus.json` 不能在没有 schema 的情况下承载三张表；`keybindings.json` 也需要规定显示键位与运行时键码的标准化格式。

6. **B 档文件没有回滚机制，违背“AGENT 改坏可恢复”的承诺。**  
   文档建议 B 档文件不进快照，但没有设计文件备份、版本回退或 AGENT 写前确认。`snapshot_user` 只复制 `user/settings.json`（`src-tauri/src/config.rs:770-777`）。如果 AGENT 写入了结构合法但语义错误的 `menus.json` 或 `capsules.json`，用户可能失去原来的排序和可见项，而现有快照无法恢复。`docs/agents/data-surface.md:75-80` 还把“回滚”列为必填数据面字段，当前方案没有满足。

7. **B7/B11 的“裁决”和“终态目录”互相矛盾。**  
   §5.6 和 §5.7 都选择保留现状，但 §5.1 的终态树仍列出 `view-specs.json` 和 `capture.json`，§6 也保留 B11 分支。终态布局应明确写成“保留现状、不创建这些文件”，否则实现者会依据目录树创建空文件，违反“无消费者不提前建目录”。

8. **B10 的新文档默认配置与现有 `defaultSavePath` 双写。**  
   需要明确 `defaultSavePath` 是否迁移、是否保留兼容、以哪一层优先；否则 `newdoc.json` 和 `settings.json` 都能控制默认保存路径，UI、AGENT 和旧版本会互相覆盖。默认模板又和现有 `templates/*.md` 重叠，应决定是复用模板文件系统还是另建默认模板字段。

9. **B11 保持独立后没有 AGENT 管理路径。**  
   文档说 AGENT 通过“专用工具”管理捕获配置，但当前没有任何这样的工具。若保持独立，至少要新增 `read_capture_config` / `patch_capture_config` 的白名单工具，或明确捕获配置不属于本方案范围。

10. **热重载与并发写入没有解决。**  
    B 档文件只重启生效，但 AGENT 写入期间如果前端正在保存 `settings.json`，没有 last-writer-wins、文件锁、写入前后 mtime 校验或冲突提示。`reloadAppConfig` 还会在本地保存后 1.5 秒内跳过外部变更（`src/hooks/useConfig.ts:527-533`）。至少需要定义写入顺序和用户可见的“需重启/已重载”状态。

11. **数据面门禁缺表。**  
    仓库规范要求命中配置、主题、图标、菜单、预设等信号时，在 change 的 `design.md` 写 `## 数据面` 六栏表（`docs/agents/data-surface.md:49-80`）。本文明确会修改这些数据面，但只写了“每批按契约落表”，没有实际的六栏表，也没有逐文件的存储、校验、桥接、消费、回滚落点。该方案不能直接进入 G0 拆票。

## 修订建议（按优先级）

### P0：先修事实和核心通路

1. **重写事实基线和行号。**  
   以上述实际代码为准修正 `config.rs`、`useConfig.ts`、`ai_agent.rs`、`floating-toolbar.ts` 的所有引用；尤其删掉 `setRailViewSpec`、`CapabilityRegistry`、`langPair` 作为持久化字段的错误表述。

2. **把“已文件化”降级为准确的现状。**  
   轮盘、工具条只能写成“已知 ID 的选择与排序已持久化，定义/动作仍为代码常量”。同时修正 A 档中 `readerSkin` 和 `readerWidth` 的现状，不要把当前校验冲突标成干净可用。

3. **明确“数据文件能做/不能做什么”。**  
   增加一个命令/动作注册表设计：每项使用稳定 ID；数据文件只能引用注册表中已存在的 ID；新增菜单动作、胶囊动作、导出格式必须同时修改注册表和执行器。否则删除“AGENT 新增功能”承诺，改为“AGENT 配置和重排已有功能”。

4. **补齐 AGENT 文件读写工具。**  
   要么新增白名单 `read_user_file` / `write_user_file` 和 B 档加载器，要么明确由外部 agent 直接操作配置目录。写入必须限制在 `user/` 和允许的扩展点目录，禁止路径穿越、符号链接逃逸和任意文件覆盖。

5. **重建 `SKILL_MAP` 的可见性链路。**  
   先确认谁会读取它；若仍要使用，把它接入 `run_agent_turn` 的系统上下文，并定义版本刷新规则。更稳妥的是给配置地图一个明确的消费者和版本字段，而不是继续依赖当前未被读取的 `skills/biaoyue/SKILL.md`。

6. **修正 `apply_patch_at` 的状态方案和返回语义。**  
   删除 state 写入是对的；同时更新函数注释、`SKILL_MAP` 和测试。返回值应明确为“写 user 后由 `load_config_at` 读取到的、保留下来的 state”，而不是“旧 state”。补充两类测试：  
   - 含 `state.json` 时 patch 后 state 字节不变；  
   - 返回值仍能看到原 state。  
   另需决定 `save_config` 是否仍允许从传入配置写 state，建议拆出独立的 `save_state` 接口，避免部分配置调用再次清空 state。

### P1：补 schema、回退和具体设计

7. **为每个 B 档文件写出正式 schema。**  
   包括 `schemaVersion`、字段类型、默认值、重复 ID、未知 ID、空列表、非法项、文件缺失、解析失败和迁移策略。`keybindings.json` 使用规范化键码，不使用 `⌘P` 这类显示字符串；`icons.json` 需支持 `s` / `d` / `parts` / 文本字形，并明确两份图标注册表的优先级。

8. **统一菜单命名空间。**  
   `menus.json` 至少分成 `pane`、`export`、`aiPane` 三个作用域；每个作用域分别定义默认顺序、未知动作过滤和最小可用项。不能把三张表混成一个无命名空间的列表。

9. **补充 B 档回滚方案。**  
   若坚持“不进 settings 快照”，至少提供文件级备份、写前副本或文档化的恢复路径；否则删除“最坏没生效、不会搞坏应用”的绝对表述，并把“用户可能失去自定义排序”列为已知风险。

10. **处理 B10/B11 的现有字段和双写。**  
    B10 明确 `defaultSavePath` 是否迁移、`newdoc.json` 与 `settings.json` 的优先级以及默认模板与 `templates/*.md` 的关系。B11 保持独立时，从终态目录树移除 `capture.json`，并明确捕获配置目前不在 AGENT 工具面。

11. **处理阅读配置的现状冲突。**  
    在 B9 之前先统一 `readerSkin` 的合法值和 `readerWidth` 的权威上限，否则阅读预设文件无论采用何种 schema 都会重新制造两套边界。当前代码与 `openspec/specs/reading/spec.md:370` 已经存在 1400/2400 的不一致。

12. **补充热重载、重启和并发写入语义。**  
    写明 B 档文件由哪个启动阶段加载、重启提示如何展示、AGENT 写入与前端保存冲突时谁优先，以及是否提供“重新载入配置”入口。

### P2：门禁和交付证据

13. **补 `## 数据面` 六栏表。**  
    每个B档文件至少覆盖存储、校验、桥接、消费、回滚；每个即将落地的 change 用 `./scripts/cw-data-surface.sh new <change>` 检查，不能只写“按契约落表”。

14. **修正审查状态。**  
    在事实问题解决前，将顶部状态改为“待修订/待独立评审”，并删除“已通过独立对抗评审、全部修订”的表述。

本次为只读评审，未修改任何文件。
tokens used
284,662
## 总体判定：需修订

文档方向大体成立，但不能作为“事实基线已校正”或“已通过独立对抗评审”的版本进入实现。当前仍有字段名、消费者名称、行号、代码路径和现状状态错误；其中 `SKILL_MAP` 的 AGENT 可见性、`patch_config` 的状态写入和 B5/B9 的现状描述会直接影响方案结论。

## 事实核查（逐项，附证据）

### 行号与基础路径

| 文档引用 | 实际证据 |
|---|---|
| `config_base()` 在 `config.rs:1033-1038` | 实际在 `src-tauri/src/config.rs:946-950`，调用的是 `app.path().app_config_dir()`，不是文档写的 `app.config_dir()` |
| `applyRustConfig` 在 `useConfig.ts:407-477` | 实际函数从 `src/hooks/useConfig.ts:381` 开始，到 `:524` 结束；`:407-477` 只是函数中段 |
| `patch_config` 深合并逻辑在 `config.rs:949-976` | 实际 `apply_patch_at` 在 `src-tauri/src/config.rs:864-888`；`:949-976` 是 `config_base` 和旧 bundle 配置迁移 |
| `merge_json` 数组替换在 `config.rs:392-396` | 实际数组回退分支在 `src-tauri/src/config.rs:360`；`:392-396` 是 `ensure_defaults` 里的 `atomic_write` |
| watcher 在 `config.rs:1083-1106` | 实际 `spawn_config_watcher` 在 `src-tauri/src/config.rs:996-1017`；`:1083-1106` 属于测试区 |
| `SKILL_MAP` 在 `config.rs:977-1031` | 实际 `seed_skill_map` 在 `src-tauri/src/config.rs:892-903`，`SKILL_MAP` 在 `:905-943`；`:977-1031` 主要是加载、保存和 keyring 代码 |
| AGENT 三工具在 `ai_agent.rs:708` | `src-tauri/src/ai_agent.rs:708` 是测试断言；工具 schema 实际在 `:187-223`，dispatch 在 `:236-274` |
| `rouletteSectors` 在 `config.rs:65` | 字段实际在 `src-tauri/src/config.rs:64`，`:65` 是注释 |
| `htmlToolbarItems` 在 `config.rs:68` | 字段实际在 `src-tauri/src/config.rs:67`，`:68` 是注释 |
| `useConfig.ts:440` 消费 `rouletteSectors` | `:420` 才是 `normalizeRouletteSectors(raw.rouletteSectors)`；`:440` 是 `setFontSize` |

### 语义核查

1. **`defaults/settings.json` 的写入方描述不准确。**  
   文档称它是“随包发布、用户不可改、构建产物”。实际 `ensure_defaults` 在文件缺失时用 `AppConfig::default()` 生成文件（`src-tauri/src/config.rs:386-394`），`load_config_at` 随后直接读取这个文件（`src-tauri/src/config.rs:837-843`）。当前代码没有构建资源复制，也没有只读权限约束；用户可以直接修改该文件。

2. **阅读设置字段本身存在，但“✅ 已落地”掩盖了当前配置链的不一致。**  
   `readerFontSize`、`readerWidth`、`readerSkin` 确实存在（`src-tauri/src/config.rs:18-20`），但：
   - Rust 校验只允许 `readerSkin` 为 `paper` / `plain`（`src-tauri/src/config.rs:583-587`）；
   - 设置页实际提供 `paper` / `indigo` / `moss` / `clay`（`src/components/SettingsView.tsx:164-169`）；
   - 前端会把 `indigo` 等值写入 store 并调用保存（`src/components/SettingsView.tsx:1023-1026`），因此这类值会被后端校验拒绝，重启后无法可靠持久化。
   - `readerWidth` 后端允许 480–2400（`src-tauri/src/config.rs:558`），但 UI 常量上限是 1400（`src/lib/readerWidth.ts:2-4`）；`openspec/specs/reading/spec.md:370` 又写 480–2400。
   
   因此 A 档至少应标为“字段已存在，但现状有校验/UI 不一致”，不能直接标成干净落地。

3. **`setRailViewSpec` 是不存在的符号。**  
   文档把视图规格的消费者写成 `useStore` 的 `setRailViewSpec`。仓库没有这个函数；实际存在的是 `saveRailViewSpec`、`setViewSpec`、`setPreviewSettings` 和 `railViewSpec` store 字段（`src/stores/index.ts:369-413`，`src/stores/index.ts:1350-1364`，`src/stores/index.ts:1441-1488`）。

4. **`langPair` 不是持久化字段名。**  
   文档把 AI 连接字段写成 `translationProvider` / `langPair`。Rust 配置里的真实字段是 `sourceLang` 和 `targetLang`（`src-tauri/src/config.rs:27-28`）；`langPair` 只是前端 `AppConfig` 的派生结构（`src/hooks/useConfig.ts:54-55`、`:403-405`）。

5. **`CapabilityRegistry` 是不存在的消费者。**  
   仓库没有 `CapabilityRegistry` 符号；实际是 `CAPABILITY_META`、模块级 `state`、`isCapabilityEnabled`、`applyCapabilityConfig` 等（`src/lib/capabilities.ts:10-29`、`:35`、`:73-101`）。

6. **`theme.toml` 白名单 13 个是对的，但 `tokens.css 17 个` 不准确。**  
   `extensions.rs` 的 `DECLARED_TOKENS` 确实是 13 个（`src-tauri/src/extensions.rs:68-84`）；对 `src/styles/tokens.css` 中的唯一 `--app-*` 名称计数是 16 个，不是 17 个。可核查命令为 `rg -o --no-filename -- '--app-[a-z0-9-]+' src/styles/tokens.css | sort -u | wc -l`。

7. **轮盘和工具条只实现了“选择与排序”的持久化，不是完整定义文件化。**  
   `rouletteSectors` 和 `htmlToolbarItems` 的字段确实存在（`src-tauri/src/config.rs:62-67`），设置页也允许勾选和排序（`src/components/SettingsView.tsx:1486-1628`）。但扇区定义、图标、动作执行和工具条动作仍分别来自：
   - `src/editors/orchestration/roulette.ts:48-70`
   - `src/editors/orchestration/floating-toolbar.ts:667-688`
   - `src/editors/orchestration/slots.ts:10-47`
   - `src/editors/orchestration/horizontal-toolbar.ts:208-213`
   
   因此 A 档把它们概括为“✅ 已文件化”过强。当前实际能力是：AGENT 可以选择、隐藏、重排已知 ID；不能通过数据文件新增一个轮盘扇区或工具条动作。`docs/research/technical/data-fileization-omarchy-inventory.md:123` 也仍把轮盘、工具条、图标、菜单列为代码常量缺口。

8. **B1 的行数少了一行，且 `shortcuts.ts` 不是实际键位分发层。**  
   `src/lib/shortcuts.ts` 实际为 564 行，不是 573 行；`src/editors/keybindings.ts` 确实是 86 行。更重要的是，实际全局按键判断硬编码在 `src/App.tsx:420-768`，`SHORTCUTS` 主要被设置页、快捷键总览和建议菜单消费。文档已经承认“依赖按键分发层重接线”，但应在现状栏直接写出“当前 `SHORTCUTS` 不是运行时键位分发真相源”，否则 `user/keybindings.json` 容易被误解为只需替换 `SHORTCUTS` 即可。

9. **B5 引用了错误的文件。**  
   `src/editors/orchestration/capsule-toolbar.ts` 只是通用的 `createCapsuleToolbar(primary, secondary, ...)` 渲染组件（`src/editors/orchestration/capsule-toolbar.ts:43-50`），并没有固定的胶囊按钮集。实际按钮集和动作映射在 `src/editors/orchestration/floating-toolbar.ts:667-688`。

10. **`selectionToolbar` 切换存在，但没有后端持久化。**  
    `SettingsView` 会写入 `selectionToolbar`（`src/components/SettingsView.tsx:914-917`），但 Rust `AppConfig` 没有该字段（`src-tauri/src/config.rs:14-95`），前端保存对象也没有发送它（`src/hooks/useConfig.ts:146-193`）。因此当前切换只在 session 内生效，B5 不能把“切换已存在”当作已完成文件化。

11. **B6 行数正确，但“概念 → 图标路径”不足以描述两份注册表。**  
    `src/ui/icons.ts` 为 711 行，`src/editors/icons.ts` 为 803 行，这一部分正确。实际图标定义支持 `s`、`d`、`parts`、描边、多路径和文本字形（`src/ui/icons.ts:160-681`；`src/editors/icons.ts:19-38`、`:113-118`），而 `editors/icons.ts` 还包含命令、转换、动作映射（`:587-803`）。仅设计 `概念 → 图标路径` 会丢字段、丢多路径，并且不能覆盖两份注册表的同步关系。

12. **B7 的现状描述基本正确，但和 §5.6/§6 存在状态重复。**  
    四字段确实在 `settings.json` 顶层（`src-tauri/src/config.rs:46-61`），`paneLayout` 确实是序列化 JSON 字符串（`src/types/index.ts:115-116`；`src/stores/index.ts:1172-1176`）。但文档同时在 A 档写“视图规格已落地”，在 B7 写“抽出独立文件”，又在 §5.6 写“保留现状优先”。应把 B7 明确改为“可选后续实验”，不要把它留在可执行 B 档清单里。

13. **B8 的“无持久化导出设置”属实，但方案没有说明数据文件只能控制哪些层面。**  
    `EXPORT_MENU_ITEMS` 确实是 6 项（`src/lib/paneHeaderMenu.ts:56-63`），`exportFormat` 没有持久化字段，这一点成立。但导出动作由硬编码的 `runExportAction` 分支执行（`src/lib/exportActions.ts:28-112`），`user/export.json` 只能控制菜单可见性、顺序和已有动作的默认选择；不能仅靠数据文件新增导出实现。文档目前把“格式清单、默认格式、选项开关”写成完整方案，缺少这个边界。

14. **B9 “无预设集合”是事实错误。**  
    仓库已有：
    - `READER_WIDTH_PRESETS`：`src/lib/readerWidth.ts:6-10`
    - `FONT_SIZES`：`src/components/SettingsView.tsx:141`
    - `READER_TONES`：`src/components/SettingsView.tsx:164-169`
    
    当前缺的是“用户可编辑、可持久化的预设集合”，不是“没有任何预设集合”。应把现状改成“预设集合是代码常量，未持久化”。

15. **B10 的前提基本正确，但目标文件与现有字段会产生双写。**  
    `defaultNewDocFormat` 不存在，`defaultSavePath` 确实存在（`src-tauri/src/config.rs:68-71`；`src/hooks/useConfig.ts:155`、`:397`）。若新增 `user/newdoc.json` 又保留 `settings.json.defaultSavePath`，会出现两个默认保存路径来源；文档没有定义优先级、迁移和双写规则。默认模板与现有 `templates/*.md` 也可能重叠（`src/App.tsx:215-220`、`src/components/TemplatePicker.tsx:45-70`）。

16. **B11 的捕获配置路径正确，但“专用工具”当前不存在。**  
    `config_path` 是 `~/.biaoyue/config.toml`（`src-tauri/src/commands/capture.rs:472-485`），`CaptureConfig` 没有 hotkey 字段（`:451-463`），这一部分正确。但实际 AGENT 工具只有 `read_config`、`patch_config`、`list_snapshots`（`src-tauri/src/ai_agent.rs:187-223`），没有捕获配置的读写工具；`save_config_capture` 只是 Tauri command，不在 AGENT tool schema 中。

17. **C3 的“由 capabilities 统一管理”过度概括。**  
    `capabilities` 目前只有 `math`、`code-highlight`、`mermaid`、`preview-zoom` 四个能力（`src/lib/capabilities.ts:10-29`）。模式切换由 `setEditorMode`、`nextPaneMode` 等独立路径控制（`src/stores/index.ts:340-350`；`src/lib/paneHeaderMenu.ts:73-76`），并不是全部由 capabilities 管理。

18. **`apply_patch_at` 的状态清空缺陷属实，但返回值描述反了。**  
    文档说返回值是“修复前 `load_config_at`（含磁盘旧 state）”，实际 `apply_patch_at` 在 `src-tauri/src/config.rs:879-888` 先写入空的 `state.json`，之后才调用 `load_config_at`，所以返回值读到的是刚写入的空 state，不是旧 state。当前文档的行号也错误：实际函数在 `:864-888`。

19. **`patch_config` 并不是“只写 settings.json”。**  
    文档 §5.5 说 `patch_config` 只写 `settings.json`；实际 `apply_patch_at` 在 `src-tauri/src/config.rs:879-885` 同时写 `user/settings.json` 和 `state/state.json`，这正是 §5.8 要修复的缺陷。两节内容自相矛盾。

20. **`SKILL_MAP` 不是现有 AGENT 可见性链路。**  
    `seed_skill_map` 写入的是 `<config_base>/skills/biaoyue/SKILL.md`（`src-tauri/src/config.rs:892-900`）；但 `run_agent_turn` 读取的是 `enabled_skill_context_at`（`src-tauri/src/commands/ai_agent_cmd.rs:45-53`），它扫描的是 `<config_base>/extensions/<id>/SKILL.md`（`src-tauri/src/extension_packages.rs:739-749`）。仓库中没有代码读取 `skills/biaoyue/SKILL.md` 并注入 AGENT 上下文。因此文档把它称为“既有 AGENT 可见性载体”不成立，且 `seed_skill_map` 只在该文件不存在时写入，已存在的文件也不会自动刷新。

21. **§7 的审查状态自相矛盾。**  
    文档开头写“已通过独立对抗评审”，§7 又写“codex 未登录，登录完成后补跑”，并称“已按意见全部修订”。当前仍存在上述事实错误，不能维持这个状态声明。

## 逻辑与遗漏问题

1. **把“选择/排序已有能力”误当成“新增产品功能”。**  
   当前 `rouletteSectors`、`htmlToolbarItems` 持久化的是已知 ID 和顺序，不是定义本身。要让 AGENT 新增菜单项、轮盘扇区、工具条动作或导出格式，必须先有稳定的命令注册表、动作 schema 和代码侧执行器；未知 ID 如果只是被过滤，AGENT 看起来写入成功，实际上功能不会出现。这与文档的“AGENT 改数据文件即改产品行为”目标不一致。

2. **AGENT 通路没有真正闭合。**  
   文档承认 AGENT 当前只有三个配置工具，但没有给出 B 档文件的读写工具设计。`user/keybindings.json`、`user/menus.json` 等文件无法通过现有 `patch_config` 写入；`patch_config` 只接受 `settings.json` 的配置结构。需要明确是给 AGENT 增加白名单文件工具，还是声明由外部 AGENT 直接访问文件系统；二者权限、路径校验和审计方式不同。

3. **`SKILL_MAP` 不能承担字段说明职责。**  
   即使未来让 AGENT 看到 `skills/biaoyue/SKILL.md`，它目前只描述 `settings.json`、`state.json` 和快照，且不会自动更新。B 档文件的 schema、默认值、动作 ID、失败语义如果只放在常量 `SKILL_MAP` 里，会产生第二份真相源；AGENT 还可能看到旧版本。

4. **`deny_unknown_fields` 不是足够的加载端验证。**  
   在 `AppConfig` 顶层加 `deny_unknown_fields` 只能发现顶层未知字段，不能覆盖 `railViewSpec` 等嵌套结构，也不能覆盖 B 档独立文件。直接启用该属性还会导致含新字段或旧字段的配置文件整体反序列化失败；若调用 `read_json_or_quarantine`，可能把整份 user 配置改名留档并回退默认值，损失用户设置。应采用逐层 schema 校验或 `serde_ignored` 收集未知键，并定义“忽略单个非法项/保留其余有效项”的粒度。

5. **每个 B 档文件缺少可执行 schema。**  
   文档目前只有“map 型/list 型”的抽象规则，没有定义：
   - 文件版本字段和迁移规则；
   - 必填字段、类型、长度、枚举范围；
   - 重复 ID、未知 ID、空列表、非法顺序的处理；
   - 默认值来自代码常量还是 `defaults/`；
   - 文件缺失、解析失败、单条非法、全部非法的不同回退语义；
   - 多个菜单表（PANE / EXPORT / AI_PANE）的顶层分区方式。
   
   `menus.json` 不能在没有 schema 的情况下承载三张表；`keybindings.json` 也需要规定显示键位与运行时键码的标准化格式。

6. **B 档文件没有回滚机制，违背“AGENT 改坏可恢复”的承诺。**  
   文档建议 B 档文件不进快照，但没有设计文件备份、版本回退或 AGENT 写前确认。`snapshot_user` 只复制 `user/settings.json`（`src-tauri/src/config.rs:770-777`）。如果 AGENT 写入了结构合法但语义错误的 `menus.json` 或 `capsules.json`，用户可能失去原来的排序和可见项，而现有快照无法恢复。`docs/agents/data-surface.md:75-80` 还把“回滚”列为必填数据面字段，当前方案没有满足。

7. **B7/B11 的“裁决”和“终态目录”互相矛盾。**  
   §5.6 和 §5.7 都选择保留现状，但 §5.1 的终态树仍列出 `view-specs.json` 和 `capture.json`，§6 也保留 B11 分支。终态布局应明确写成“保留现状、不创建这些文件”，否则实现者会依据目录树创建空文件，违反“无消费者不提前建目录”。

8. **B10 的新文档默认配置与现有 `defaultSavePath` 双写。**  
   需要明确 `defaultSavePath` 是否迁移、是否保留兼容、以哪一层优先；否则 `newdoc.json` 和 `settings.json` 都能控制默认保存路径，UI、AGENT 和旧版本会互相覆盖。默认模板又和现有 `templates/*.md` 重叠，应决定是复用模板文件系统还是另建默认模板字段。

9. **B11 保持独立后没有 AGENT 管理路径。**  
   文档说 AGENT 通过“专用工具”管理捕获配置，但当前没有任何这样的工具。若保持独立，至少要新增 `read_capture_config` / `patch_capture_config` 的白名单工具，或明确捕获配置不属于本方案范围。

10. **热重载与并发写入没有解决。**  
    B 档文件只重启生效，但 AGENT 写入期间如果前端正在保存 `settings.json`，没有 last-writer-wins、文件锁、写入前后 mtime 校验或冲突提示。`reloadAppConfig` 还会在本地保存后 1.5 秒内跳过外部变更（`src/hooks/useConfig.ts:527-533`）。至少需要定义写入顺序和用户可见的“需重启/已重载”状态。

11. **数据面门禁缺表。**  
    仓库规范要求命中配置、主题、图标、菜单、预设等信号时，在 change 的 `design.md` 写 `## 数据面` 六栏表（`docs/agents/data-surface.md:49-80`）。本文明确会修改这些数据面，但只写了“每批按契约落表”，没有实际的六栏表，也没有逐文件的存储、校验、桥接、消费、回滚落点。该方案不能直接进入 G0 拆票。

## 修订建议（按优先级）

### P0：先修事实和核心通路

1. **重写事实基线和行号。**  
   以上述实际代码为准修正 `config.rs`、`useConfig.ts`、`ai_agent.rs`、`floating-toolbar.ts` 的所有引用；尤其删掉 `setRailViewSpec`、`CapabilityRegistry`、`langPair` 作为持久化字段的错误表述。

2. **把“已文件化”降级为准确的现状。**  
   轮盘、工具条只能写成“已知 ID 的选择与排序已持久化，定义/动作仍为代码常量”。同时修正 A 档中 `readerSkin` 和 `readerWidth` 的现状，不要把当前校验冲突标成干净可用。

3. **明确“数据文件能做/不能做什么”。**  
   增加一个命令/动作注册表设计：每项使用稳定 ID；数据文件只能引用注册表中已存在的 ID；新增菜单动作、胶囊动作、导出格式必须同时修改注册表和执行器。否则删除“AGENT 新增功能”承诺，改为“AGENT 配置和重排已有功能”。

4. **补齐 AGENT 文件读写工具。**  
   要么新增白名单 `read_user_file` / `write_user_file` 和 B 档加载器，要么明确由外部 agent 直接操作配置目录。写入必须限制在 `user/` 和允许的扩展点目录，禁止路径穿越、符号链接逃逸和任意文件覆盖。

5. **重建 `SKILL_MAP` 的可见性链路。**  
   先确认谁会读取它；若仍要使用，把它接入 `run_agent_turn` 的系统上下文，并定义版本刷新规则。更稳妥的是给配置地图一个明确的消费者和版本字段，而不是继续依赖当前未被读取的 `skills/biaoyue/SKILL.md`。

6. **修正 `apply_patch_at` 的状态方案和返回语义。**  
   删除 state 写入是对的；同时更新函数注释、`SKILL_MAP` 和测试。返回值应明确为“写 user 后由 `load_config_at` 读取到的、保留下来的 state”，而不是“旧 state”。补充两类测试：  
   - 含 `state.json` 时 patch 后 state 字节不变；  
   - 返回值仍能看到原 state。  
   另需决定 `save_config` 是否仍允许从传入配置写 state，建议拆出独立的 `save_state` 接口，避免部分配置调用再次清空 state。

### P1：补 schema、回退和具体设计

7. **为每个 B 档文件写出正式 schema。**  
   包括 `schemaVersion`、字段类型、默认值、重复 ID、未知 ID、空列表、非法项、文件缺失、解析失败和迁移策略。`keybindings.json` 使用规范化键码，不使用 `⌘P` 这类显示字符串；`icons.json` 需支持 `s` / `d` / `parts` / 文本字形，并明确两份图标注册表的优先级。

8. **统一菜单命名空间。**  
   `menus.json` 至少分成 `pane`、`export`、`aiPane` 三个作用域；每个作用域分别定义默认顺序、未知动作过滤和最小可用项。不能把三张表混成一个无命名空间的列表。

9. **补充 B 档回滚方案。**  
   若坚持“不进 settings 快照”，至少提供文件级备份、写前副本或文档化的恢复路径；否则删除“最坏没生效、不会搞坏应用”的绝对表述，并把“用户可能失去自定义排序”列为已知风险。

10. **处理 B10/B11 的现有字段和双写。**  
    B10 明确 `defaultSavePath` 是否迁移、`newdoc.json` 与 `settings.json` 的优先级以及默认模板与 `templates/*.md` 的关系。B11 保持独立时，从终态目录树移除 `capture.json`，并明确捕获配置目前不在 AGENT 工具面。

11. **处理阅读配置的现状冲突。**  
    在 B9 之前先统一 `readerSkin` 的合法值和 `readerWidth` 的权威上限，否则阅读预设文件无论采用何种 schema 都会重新制造两套边界。当前代码与 `openspec/specs/reading/spec.md:370` 已经存在 1400/2400 的不一致。

12. **补充热重载、重启和并发写入语义。**  
    写明 B 档文件由哪个启动阶段加载、重启提示如何展示、AGENT 写入与前端保存冲突时谁优先，以及是否提供“重新载入配置”入口。

### P2：门禁和交付证据

13. **补 `## 数据面` 六栏表。**  
    每个B档文件至少覆盖存储、校验、桥接、消费、回滚；每个即将落地的 change 用 `./scripts/cw-data-surface.sh new <change>` 检查，不能只写“按契约落表”。

14. **修正审查状态。**  
    在事实问题解决前，将顶部状态改为“待修订/待独立评审”，并删除“已通过独立对抗评审、全部修订”的表述。

本次为只读评审，未修改任何文件。
