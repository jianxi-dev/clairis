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

## 7. 数据面

本方案触及大量配置字段与派生态字段，按仓库落点契约登记如下。

| 触发信号 | 字段 | 落点 | 默认值 | 消费者 | 可配置性 |
|---|---|---|---|---|---|
| 主题 / 编辑器 / 阅读 / AI 等配置 | settings.json 各键 | `user/settings.json` | `defaults/settings.json` | `config.rs`、`useConfig.ts`、各设置页 | 用户 / AGENT 可改 |
| 快捷键映射 | keybindings 映射表 | `user/keybindings.json` | 内置默认键位 | 快捷键注册表、设置页、tooltip | 用户可重映射 |
| 图标 / 工具条 / 轮盘配置 | `icons.json` / `htmlToolbarItems` / `rouletteSectors` | `user/*.json` 或 `settings.json` | 内置默认 | 渲染层、设置页 | 用户 / AGENT 可改 |
| 最近文件 / 滚动位置 | `recentFiles` / `scrollPositions` | `state/state.json` | 空（派生态） | 左边栏、网格、阅读恢复 | 派生态，建议只读，不开放用户改 |
| 配置快照 | `settings-*.json` | `snapshots/` | 无 | 回滚 | 系统生成，用户可查看 / 回滚 |

## 8. 对抗评审记录

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
