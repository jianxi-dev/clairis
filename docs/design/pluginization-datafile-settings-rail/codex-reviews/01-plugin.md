Reading additional input from stdin...
2026-11-16T22:49:02.841615Z ERROR codex_skills_extension::loader::host: skills scan reached its traversal limit (root: file:///Users/mason/.agents/skills)
OpenAI Codex v0.167.2
--------
workdir: /Users/mason/ToHighs/clairis-wt-design-plan
model: deepseek-flash
provider: custom
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR]
reasoning effort: none
reasoning summaries: none
session id: 01a1e68c-b04e-7d12-ace8-3078540eb327
--------
user
你是严格的独立对抗式评审专家。只做只读评审，绝对不要修改任何文件。
请对设计方案文档做对抗式评审，路径：docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md
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
我将逐条抽取文档中的路径、符号、字段与行号断言，再用仓库源码核对，并检查论证链与边界条件；全程只读。
exec
/bin/zsh -c 'nl -ba docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md' in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
     1	# 插件化能力提取方案
     2	
     3	> 状态：设计方案（已通过独立对抗评审，按意见修订）
     4	> 对应目标：第 1 项——盘点本仓可提取为插件的能力清单与提取方案
     5	> 事实基线：`src-tauri/src/extensions.rs`、`src/lib/capabilities.ts`、`src/ui/settings/SettingsView.tsx`、`src-tauri/src/commands/ai_agent.rs`、`docs/research/technical/data-fileization-omarchy-inventory.md`、`docs/agents/data-surface.md`
     6	
     7	## 1. 背景与目标
     8	
     9	本仓能力按 AGENTS.md 两个目标取向可提取为插件：① **独立控制、开发升级**——能力独立打包、独立加载、独立升级；② **能力复用与用户自定义**——用户可按需启用/停用、自定义扩展。
    10	
    11	本方案回答：哪些能力可提取为插件、插件的形态与边界、加载/生命周期/权限设计，以及分批提取路线。
    12	
    13	## 2. 插件形态定义（三类，互斥）
    14	
    15	| 形态 | 结构 | 加载方式 | 适用 |
    16	|---|---|---|---|
    17	| **配置型插件** | 声明式数据（JSON/TOML/Markdown） | 加载时读入、映射到配置字段 | 纯数据可配置的能力 |
    18	| **注册型插件** | 注册数据（manifest + JSON） | 加载时解析注册表 | 结构可增删、需校验的能力 |
    19	| **技能型插件** | SKILL.md 驱动的 AGENT 能力包 | 注入 AGENT 上下文 | AI 能力 |
    20	
    21	**术语统一**：目录名与文档统一用 **plugin**（不复用既有「extension」术语，避免混淆）。插件目录定为 `data/plugins/`（独立于 `user/`，用户层）。
    22	
    23	## 3. 可提取为插件的能力清单
    24	
    25	按提取条件分三档。**A 档现状描述已校正**。
    26	
    27	### A 档：已具备插件化形态（保持，统一纳入插件体系管理）
    28	
    29	| # | 能力 | 现状（已校正） | 插件形态 | 状态 |
    30	|---|---|---|---|---|
    31	| A1 | **扩展包** | 已文件化的扩展目录（含 manifest）。**注意**：manifest 字段名在文档/示例/代码间不一致，加载管线是同步一次性加载、无热重载 | 注册型 | ✅ 已存在，需收尾（见 P1） |
    32	| A2 | **技能映射** | `SKILL_MAP`（`config.rs:977-1031` `seed_skill_map`）已把 AGENT 能力声明化（SKILL_MD 注入 AGENT 上下文） | 技能型 | ✅ 已落地 |
    33	| A3 | **主题覆盖** | `theme.toml` 白名单覆盖，**仅颜色 token，无装饰主题切换**。无 `themeProvider` 结构、无历史逻辑 | 配置型 | ✅ 已落地，扩展面有限（见 A3 边界） |
    34	| A4 | **编辑器扩展** | **现状描述修正**：`capabilities` 键已是声明式开关，**消费方不止 AI 上下文**——`SettingsView.tsx` 直接消费（`set`/`toggle` 扩展项，可见性与开关同态），**AI 工具则完全由 SKILL.md 驱动**，无 settings 入口。入口并非「散落在设置深处」，而是按能力类型分两处：编辑器扩展在设置页可见开关，AI 能力在 SKILL 注入面 | 注册型 | ✅ 已落地，**消费方分两类，需在清单中显式区分** |
    35	| A5 | **片段 / 模板** | `snippets/*.md`、`templates/*.md` 已文件化，斜杠菜单/模板选择器消费 | 配置型 | ✅ 已落地 |
    36	
    37	### B 档：可进一步插件化（当前是代码常量或未充分声明）
    38	
    39	| # | 能力 | 现状（已校正） | 插件形态 | AGENT 自定义价值 |
    40	|---|---|---|---|---|
    41	| B1 | **胶囊工具条** | 胶囊按钮集是代码常量；`selectionToolbar: "roulette"|"capsule"` 切换已存在 | 配置型 | AGENT 配置胶囊按钮集 |
    42	| B2 | **轮盘扇区** | `rouletteSectors` **已文件化在 `settings.json`**（`config.rs:65`），设置页有勾选 UI。默认集合 `ROOT_SECTORS` 是常量 | 配置型 | AGENT 自定义扇区（默认集合可插件化） |
    43	| B3 | **工具条按钮** | `htmlToolbarItems` **已文件化在 `settings.json`**（`config.rs:68`），设置页可编辑 | 配置型 | AGENT 自定义工具条按钮（已落地，仅需统一纳入插件体系） |
    44	| B4 | **菜单结构** | 菜单项常量在 `src/lib/paneHeaderMenu.ts`（PANE/EXPORT/AI_PANE 三表） | 配置型 | AGENT 增删/排序菜单项 |
    45	| B5 | **图标注册表** | `src/ui/icons.ts` + `src/editors/icons.ts`，代码常量 | 配置型 | AGENT 替换/新增图标 |
    46	| B6 | **键位绑定** | `keybindings.ts` + `shortcuts.ts`（`SHORTCUTS` 常量表），`ShortcutDef` 已带 `scope` 结构 | 配置型 | AGENT 重映射键位（**依赖按键分发层重接线，见第 3 项 §4.4**） |
    47	| B7 | **导出配置** | 导出菜单代码常量，无持久化导出设置 | 配置型 | AGENT 自定义导出格式 |
    48	| B8 | **阅读预设** | `readerFontSize` 数值型，无预设集合 | 配置型 | AGENT 增加阅读预设 |
    49	| B9 | **新建文档默认** | `defaultNewDocFormat` 不存在，相近 `defaultSavePath` | 配置型 | AGENT 自定义新文档模板 |
    50	
    51	**注**：B2/B3 实际已文件化，本档列出是为「统一纳入插件体系管理」的收尾，非新做。
    52	
    53	### C 档：不插件化（明确不做）
    54	
    55	| # | 能力 | 不插件化理由 |
    56	|---|---|---|
    57	| C1 | **API 密钥 / 密钥类** | 密钥永不文件化（ADR 0005），不进入插件体系 |
    58	| C2 | **编辑器运行时状态**（undo/选区、CM6 实例） | 运行时状态归 `editorRef.ts`，不插件化 |
    59	| C3 | **模式切换/渲染管线运行时开关** | 由 `capabilities` 统一管理，运行时行为 |
    60	| C4 | **执行用户代码的能力** | 插件不执行用户代码（配置型/注册型/技能型均不引入执行） |
    61	| C5 | **与数据文件化重复的能力** | **配置载体证据补全**：A3/A4/A5 等已由数据文件化承载，插件化重复时以数据文件为单一落点，避免双写。插件体系管「打包/加载/升级」维度，数据文件管「配置值」维度，两者在 A 档能力上是**正交维度**而非重复（见 §5.3） |
    62	
    63	## 4. 设计实现方案
    64	
    65	### 4.1 插件目录结构
    66	
    67	```
    68	data/plugins/                     插件根（用户层，独立于 user/）
    69	  <plugin-id>/
    70	    manifest.json                 插件声明（字段名统一，见 §4.2）
    71	    <data files>                  配置型/注册型插件的数据
    72	    SKILL.md                      技能型插件的能力声明
    73	```
    74	
    75	### 4.2 manifest 字段统一（修正 P1）
    76	
    77	**现状**：manifest 字段名在文档/示例/代码间不一致（`id`/`name`/`version` 等字段各文档写法不同）。
    78	
    79	**设计**：统一 manifest 字段为：
    80	- `id`（插件唯一标识）、`name`（显示名）、`version`、`type`（config/registry/skill）、`description`
    81	- 注册型插件增补 `permissions`（声明所需权限，如 `filesystem`）
    82	
    83	**权限声明（修正 P1 遗漏）**：扩展包内 JSON 当前**缺 `filesystem` 权限声明**（需在 `env.toml` 声明）。manifest 的 `permissions` 字段补上，加载时校验声明的权限是否在白名单内。
    84	
    85	### 4.3 加载管线（修正 P1/P2）
    86	
    87	**现状（校正）**：`extensions.rs` 是**同步一次性加载**，无热重载。方案原称的「加载期巡检、容错、热加载」与实际不符。
    88	
    89	**设计**：
    90	- **加载**：启动时同步扫描 `data/plugins/`，逐插件读 manifest、校验权限、解析数据 → 映射到配置/注册表/AGENT 上下文。
    91	- **生命周期裁定（修正 P2）**：**以「重启生效」为主**，不承诺热加载。热加载需先建 watcher 基础设施（与第 2 项 §5.3 一致，`settings.json` 已有 watcher，但 `data/plugins/` 无）。**裁定**：插件改动重启生效，热加载列为后续，不在本批实现。
    92	- **容错**：单个插件解析失败 → 跳过 + 告警，不影响其他插件与主应用（加载期巡检保留）。
    93	
    94	### 4.4 SKILL.md 注入面（补充 P3 遗漏）
    95	
    96	**现状（校正）**：`seed_skill_map` 已把 SKILL_MD 注入 AGENT 上下文，但方案此前未设计**注入面的拼装与边界**。
    97	
    98	**设计**：
    99	- **注入拼装**：AGENT 上下文构建时，聚合所有已启用技能型插件的 SKILL.md 内容（+ 内置 SKILL_MAP），拼装为 AGENT 的能力声明。
   100	- **边界**：注入内容仅声明「AGENT 可做什么」，不引入可执行代码（技能型插件仍走 AGENT 调用，不直接执行用户代码）。
   101	- **可见性**：与第 2 项 §5.5 的 SKILL_MAP 载体统一——插件体系管「哪些插件贡献 SKILL.md」，数据文件体系管「字段配置」，两者在技能型插件上协同。
   102	
   103	### 4.5 配置载体与插件的维度划分（澄清 C5）
   104	
   105	**裁定**：插件体系与数据文件化是**正交维度**，不重复：
   106	- **数据文件化**管「配置值」——字段值存哪、怎么合并、怎么热应用。
   107	- **插件化**管「打包/加载/升级」——能力如何独立打包、独立加载、独立升级、权限声明。
   108	
   109	A 档能力（A3 主题、A4 扩展、A5 片段模板）两者都涉及：数据文件是其**配置值载体**，插件是其**打包加载载体**。**单一落点原则**：某能力若已由数据文件化承载配置值，插件化不再重复建配置落点，只补打包/加载维度。避免双写。
   110	
   111	### 4.6 slash 命令通路（补充 P3 遗漏）
   112	
   113	**现状**：slash 命令是**独立于扩展包的另一条数据文件化通路**，方案此前未单列。
   114	
   115	**设计**：slash 命令单独建 `data/plugins/<id>/commands/` 或 `user/commands.json`，与扩展包/技能型插件并列。在清单中显式标注其独立通路，避免与技能型插件混为一谈。实现时定具体落点。
   116	
   117	### 4.7 风险评估（补充 P3 遗漏）
   118	
   119	**风险**：AGENT 生成插件无校验——AGENT 可生成任意插件写入 `data/plugins/`，若无校验可能引入无效/恶意插件。
   120	
   121	**设计**：
   122	- **加载期校验**：manifest 字段校验 + 权限白名单校验（§4.2/§4.3）。
   123	- **只读扩展面**：插件数据只读消费，不执行用户代码（C4 排除），最坏「没生效」不会「搞坏应用」。
   124	- **告警**：加载失败插件跳过 + 聚合告警，用户可见。
   125	
   126	## 5. 分批实施路线
   127	
   128	每批一个 OpenSpec change（G0–G4），每批注明按 data-surface 六栏契约落表：
   129	
   130	1. **第一批（收尾既有插件形态）**：A1 扩展包 manifest 字段统一 + 权限声明补全；A2/A4 消费方分两类显式区分；B2/B3 统一纳入插件体系登记。
   131	2. **第二批（配置型插件）**：B1 胶囊工具条、B4 菜单、B5 图标、B7 导出配置、B8 阅读预设、B9 新文档默认（与第 2 项数据文件化协同，配置值落点由数据文件承载）。
   132	3. **第三批（技能型与 slash 命令）**：A2 SKILL 注入面拼装细化；B6 键位绑定插件化（依赖第 3 项按键分发层重接线）；slash 命令独立通路落点。
   133	4. **第四批（生命周期与热加载评估）**：插件热加载评估（watcher 基础设施），若成本可接受则补，否则维持重启生效。
   134	
   135	## 6. 对抗评审记录
   136	
   137	**评审方**：独立只读评审子代理（注：用户指定 codex CLI，实测 codex 未登录且登录进行中；为不阻塞，先以独立评审子代理完成对抗评审，codex 登录完成后补跑）。
   138	
   139	**总体判定**：需修订（已按意见全部修订）。
   140	
   141	**主要意见与处置**：
   142	
   143	1. **P0 A4 现状断言错误（硬伤）**：方案称扩展包「消费端仅到 AI 上下文、入口散落在设置深处」，实际 SettingsView 直接消费 capabilities，AI 工具由 SKILL.md 驱动 → 已采纳，§3 A4 现状描述按「消费方分两类（设置页开关 + SKILL 注入面）」校正。
   144	2. **P1 引用参数不准**：manifest 字段名不一致；扩展包 JSON 缺 filesystem 权限声明；THEME_EXTRA 清单与实际白名单不符；三段式 split 与 extensions.rs 实际不符 → 已采纳，§4.2 统一字段、§4.2 补权限声明、§4.3 加载管线按同步加载校正、A3 边界补「无主题切换结构」。
   145	3. **P2 生命周期不自洽**：扩展包同步加载无热重载；「重启生效」与「热加载」并存未裁定；插件模板 skill 无注册表登记；目录名/落点未定 → 已采纳，§4.3 裁定重启生效为主、热加载列后续；§2 术语统一 plugin；§4.1 目录落 `data/plugins/`。
   146	4. **P3 遗漏**：capabilities 消费方清单不全；slash 命令独立通路未单列；无风险评估；C5 排除理由缺配置载体证据；A3 用户能力边界未明确 → 已采纳，§4.4 SKILL 注入面、§4.6 slash 命令通路、§4.7 风险评估、§3 C5 配置载体证据、§3 A3 边界。
   147	
   148	**可保留**：三类插件形态定义、A 档定性（除 A4 描述）、C1/C5 排除结论、分批路线结构。
   149	
   150	**未检查**：patch_config 是否在他处存在；SKILL.md 注入拼装细节（已在 §4.4 设计，实现时需对齐真实拼装点）。

exec
/bin/zsh -c "git status --short && rg --files docs/design/pluginization-datafile-settings-rail src src-tauri | sed -n '1,240p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 108ms:
?? codex-reviews/
?? docs/design/pluginization-datafile-settings-rail/
?? prototypes/
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md
docs/design/pluginization-datafile-settings-rail/03-settings-page-optimization.md
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md
docs/design/pluginization-datafile-settings-rail/04-document-discovery-and-plugin-display.md
src-tauri/Cargo.lock
src-tauri/capabilities/default.json
src-tauri/tauri.conf.json
src-tauri/Cargo.toml
src-tauri/src/extensions.rs
src-tauri/samples/1-markdown-demo.md
src-tauri/samples/2-html-demo.html
src-tauri/samples/0-welcome.md
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
src/lib/assetSrc.ts
src/lib/finder.ts
src/lib/aiErrors.ts
src/lib/pdfThumb.ts
src/lib/frontmatter.ts
src-tauri/icons/128x128@2x.png
src-tauri/icons/32x32.png
src-tauri/icons/128x128.png
src-tauri/gen/schemas/desktop-schema.json
src-tauri/icons/icon.png
src-tauri/gen/schemas/macOS-schema.json
src-tauri/gen/schemas/acl-manifests.json
src-tauri/gen/schemas/capabilities.json
src-tauri/build.rs
src/lib/railCards.ts
src/lib/headingFonts.ts
src/lib/paneDrop.ts
src/lib/printPreview.ts
src/lib/aiViewSpec.ts
src/lib/exportActions.ts
src/lib/fileInfo.ts
src/lib/overlayGate.ts
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
src/hooks/useTranslation.ts
src/hooks/fileDrag.ts
src/hooks/useDragResize.ts
src/hooks/usePaneDragController.ts
src/hooks/useConfig.ts
src/hooks/useFile.ts
src/hooks/useAiEntry.ts
src/vite-env.d.ts
src/lib/mdpkg/vendor/mdpkg-web.d.ts
src/lib/mdpkg/vendor/mdpkg-web.js
src/lib/mdpkg/index.ts
src/components/Grid/GridToolbar.tsx
src/components/Grid/GridTile.tsx
src/components/ErrorBoundary.tsx
src/components/TabBar.tsx
src/components/GridView.tsx
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
src/components/SettingsView.tsx
src/components/PortalView.tsx
src/components/Icon.tsx
src/components/Preview/FloatingPreview.tsx
src/styles/print.css
src/styles/player.css
src/styles/tokens.css
src/styles/doc-property.css
src/styles/reader.css
src/styles/editor.css
src/components/Rail/ReadingRail.tsx
src/components/BiaoyueIcon.tsx
src/__tests__/railView.test.ts
src/__tests__/useAiEntry.test.ts
src/__tests__/capabilitiesGating.test.ts
src/utils/pdfSource.ts
src/utils/log.ts
src/utils/tauri.ts
src/utils/scrollPosition.ts
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
src/stores/docPropertyPanel.ts
src/stores/index.ts
src/stores/editorStore.ts
src/stores/captureOverlay.ts
src/__tests__/editor/blockModel.test.ts
src/components/Content/HtmlVisualEditor.tsx
src/__tests__/editor/roulette.test.ts
src/editors/editorRef.ts
src/__tests__/editor/decorations-blocks.test.ts
src/__tests__/editor/callout-insert.test.ts
src/__tests__/editor/testEditor.ts
src/__tests__/editor/blockAlignment.test.ts
src/__tests__/editor/blockActions.test.ts
src/__tests__/editor/callout-title-edit.test.ts
src/__tests__/editor/slash.test.ts
src/__tests__/editor/blockConvert.test.ts
src/__tests__/editor/menuStackScope.test.ts
src/editors/callout-types.ts
src/__tests__/editor/structural-tags-decorations.test.ts
src/editors/slash.ts
src/__tests__/editor/block-handle.test.ts
src/editors/keybindings.ts
src/__tests__/editor/slashFilter.test.ts
src/__tests__/editor/block-dom.test.ts
src/__tests__/editor/menuStackWiring.test.ts
src/__tests__/editor/calloutTypes.test.ts
src/__tests__/editor/roulette-commands.test.ts
src/__tests__/editor/placementResolve.test.ts
src/__tests__/editor/blockColor.test.ts
src/__tests__/editor/smartInput.test.ts
src/__tests__/editor/table-cell-selection.test.ts
src/editors/icons.ts
src/__tests__/editor/roulette-filter.test.ts
src/__tests__/editor/icons.test.ts
src/__tests__/editor/table-decorations.test.ts
src/components/Content/PaneTreeView.tsx
src/__tests__/editor/align-fence-decorations.test.ts
src/components/Content/VideoPlayer.tsx
src/__tests__/editor/colorPalette.test.ts
src/components/Content/PdfViewer.tsx
src/__tests__/editor/orchestration.test.ts
src/components/Content/DocPropertyBar.tsx
src/__tests__/editor/decorations.test.ts
src/components/Content/HtmlPreview.tsx
src/__tests__/editor/callout-decorations.test.ts
src/components/Content/ContentArea.tsx
src/__tests__/editor/spanPair.test.ts
src/components/Content/mediaIndex.ts
src/__tests__/editor/callout-emoji-picker.test.ts
src/components/Content/PreviewView.tsx
src/__tests__/editor/user-extensions.test.ts
src/__tests__/editor/columns.test.ts
src/components/Content/SuggestMenu.tsx
src/components/Content/mediaPlayerState.ts
src/__tests__/previewAnchor.test.ts
src/components/Content/ContentSplitView.tsx
src/__tests__/renderers.markdown.test.ts
src/components/Content/MediaPlayerHost.tsx
src/components/Content/mediaMute.ts
src/__tests__/htmlRewrite.test.ts
src/components/Content/SplitResizeHandle.tsx
src/__tests__/captureOverlay.chunk.test.ts
src/components/Content/HtmlEditToolbar.tsx
src/__tests__/aiForms.test.ts
src/components/Content/ReadingProgressInk.tsx
src/__tests__/hostvis.test.tsx
src/components/Content/HtmlRangeToolbar.tsx
src/__tests__/markdownRender.test.ts
src/components/Content/OutlineMenu.tsx
src/__tests__/tabswitch.test.tsx
src/components/Content/pdfToolbarPin.ts
src/__tests__/railCards.test.ts
src/components/Content/PaneDivider.tsx
src/__tests__/scrollPosition.test.ts
src/__tests__/webModeFallback.test.tsx
src/components/ShortcutOverlay.tsx
src/components/TooltipLayer.tsx
src/__tests__/selectionPill.test.tsx
src/__tests__/gridView.test.ts
src/__tests__/paneAutoLayout.test.ts
src/__tests__/types.test.ts
src/__tests__/selectionPillMode.test.ts
src/__tests__/editorStore.test.ts
src/__tests__/headingFonts.test.ts
src/__tests__/assetUrl.test.ts
src/__tests__/config/roulette-sectors.test.ts
src/__tests__/config/propertyBar.test.ts
src/__tests__/config/toolbar-slots.test.ts
src/__tests__/exportMdpkg.test.ts
src/__tests__/useConfig.webFallback.test.tsx
src/__tests__/exportHtml.test.ts
src/__tests__/quickOpen.test.tsx
src/__tests__/mdpkg.test.ts
src/__tests__/store.test.ts
src/__tests__/fileKind.test.tsx
src/__tests__/readingStore.test.ts
src/__tests__/lib/quickOpen.test.ts
src/editors/orchestration/menu-stack.ts
src/__tests__/renderers/diagramEngine.test.ts
src/editors/orchestration/toolbar-shared.ts
src/editors/orchestration/color-palette.ts
src/editors/orchestration/slots.ts
src/editors/orchestration/anchor.ts
src/editors/orchestration/block-color.ts
src/editors/orchestration/block-handle.ts
src/editors/orchestration/horizontal-toolbar.ts
src/editors/orchestration/roulette-view.ts
src/editors/orchestration/block-alignment.ts

codex
文档已读取。接下来重点核实 A1/A2/A3/A4、B1–B9 的现状断言，以及目录、权限、加载和 SKILL 注入的实际实现。
exec
/bin/zsh -c "nl -ba src-tauri/src/config.rs | sed -n '1,125p;930,1065p'
nl -ba src-tauri/src/extensions.rs | sed -n '1,280p'
nl -ba src-tauri/src/extension_packages.rs | sed -n '1,320p'" in /Users/mason/ToHighs/clairis-wt-design-plan
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
   121	    pub y: f64,
   122	}
   123	
   124	/// AI 视图改写规格：布局 / 密度 / 卡片高度 / 区块颜色 / 图标标签 / 预览开关 /
   125	/// 面板宽窄 / 网格排布与分组 / 未读 / 主题分组 / 置顶段缩放。
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
   131	    let text = raw.strip_prefix('\u{feff}').unwrap_or(raw);
   132	
   133	    // 首行必须是 `---`。
   134	    let first_line = match text.find('\n') {
   135	        Some(i) => &text[..i],
   136	        None => text,
   137	    };
   138	    if first_line.trim_end_matches('\r') != "---" {
   139	        warnings.push(format!("{rel}: 缺少 frontmatter（未以 --- 开头）"));
   140	        return None;
   141	    }
   142	    let mut cursor = text.find('\n').map(|i| i + 1).unwrap_or(text.len());
   143	
   144	    // 收集 frontmatter 行直到闭合 `---`。
   145	    let mut fm_lines: Vec<&str> = Vec::new();
   146	    let mut closed = false;
   147	    while cursor < text.len() {
   148	        let (line, next) = match text[cursor..].find('\n') {
   149	            Some(i) => (&text[cursor..cursor + i], cursor + i + 1),
   150	            None => (&text[cursor..], text.len()),
   151	        };
   152	        if line.trim_end_matches('\r') == "---" {
   153	            cursor = next;
   154	            closed = true;
   155	            break;
   156	        }
   157	        fm_lines.push(line);
   158	        cursor = next;
   159	    }
   160	    if !closed {
   161	        warnings.push(format!("{rel}: frontmatter 未闭合"));
   162	        return None;
   163	    }
   164	
   165	    // 扁平 YAML 子集：`key: value` 或 `key: [a, b]`。
   166	    let mut map: BTreeMap<String, FrontValue> = BTreeMap::new();
   167	    for line in fm_lines {
   168	        let line = line.trim_end_matches('\r');
   169	        let Some((key, value)) = line.split_once(':') else {
   170	            warnings.push(format!("{rel}: 无法解析 frontmatter 行 {line:?}"));
   171	            return None;
   172	        };
   173	        let key = key.trim();
   174	        let value = value.trim();
   175	        let parsed = if value.starts_with('[') && value.ends_with(']') {
   176	            let inner = &value[1..value.len() - 1];
   177	            FrontValue::List(
   178	                inner
   179	                    .split(',')
   180	                    .map(|s| unquote(s.trim()))
   181	                    .filter(|s| !s.is_empty())
   182	                    .collect(),
   183	            )
   184	        } else {
   185	            FrontValue::Scalar(unquote(value))
   186	        };
   187	        map.insert(key.to_string(), parsed);
   188	    }
   189	
   190	    // 正文：闭合 `---` 之后，去掉紧跟的一个空行，其余字节原样保留。
   191	    let mut body = text[cursor..].to_string();
   192	    if body.starts_with("\r\n") {
   193	        body.drain(0..2);
   194	    } else if body.starts_with('\n') {
   195	        body.remove(0);
   196	    }
   197	
   198	    let id = match map.get("id") {
   199	        Some(FrontValue::Scalar(s)) if is_valid_id(s) => s.clone(),
   200	        Some(FrontValue::Scalar(s)) => {
   201	            warnings.push(format!("{rel}: id {s:?} 格式非法（应为 [a-z0-9-]+）"));
   202	            return None;
   203	        }
   204	        _ => {
   205	            warnings.push(format!("{rel}: 缺少 id"));
   206	            return None;
   207	        }
   208	    };
   209	
   210	    let label = match map.get("label") {
   211	        Some(FrontValue::Scalar(s)) if !s.is_empty() => s.clone(),
   212	        _ => id.clone(),
   213	    };
   214	
   215	    let keywords = match map.get("keywords") {
   216	        Some(FrontValue::List(list)) => list.clone(),
   217	        Some(FrontValue::Scalar(s)) if !s.is_empty() => vec![s.clone()],
   218	        _ => Vec::new(),
   219	    };
   220	
   221	    let icon = match map.get("icon") {
   222	        Some(FrontValue::Scalar(s)) if !s.is_empty() => Some(s.clone()),
   223	        _ => None,
   224	    };
   225	
   226	    Some(Snippet {
   227	        id,
   228	        label,
   229	        keywords,
   230	        icon,
   231	        body,
   232	        path: path.to_string_lossy().into_owned(),
   233	    })
   234	}
   235	
   236	/// 扫描 `<dir>/snippets/*.md`。目录不存在返回空；读取失败记 warning。
   237	fn scan_snippets(dir: &Path, warnings: &mut Vec<String>) -> Vec<Snippet> {
   238	    let dir = dir.join("snippets");
   239	    let entries = match std::fs::read_dir(&dir) {
   240	        Ok(entries) => entries,
   241	        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Vec::new(),
   242	        Err(e) => {
   243	            warnings.push(format!("snippets: 无法读取目录（{e}）"));
   244	            return Vec::new();
   245	        }
   246	    };
   247	
   248	    let mut snippets = Vec::new();
   249	    for entry in entries.flatten() {
   250	        let path = entry.path();
   251	        if !path.is_file() {
   252	            continue;
   253	        }
   254	        let name = entry.file_name().to_string_lossy().into_owned();
   255	        if !name.ends_with(".md") {
   256	            continue;
   257	        }
   258	        let rel = format!("snippets/{name}");
   259	        let Ok(raw) = std::fs::read_to_string(&path) else {
   260	            warnings.push(format!("{rel}: 读取失败"));
   261	            continue;
   262	        };
   263	        if let Some(snippet) = parse_snippet(&raw, &rel, &path, warnings) {
   264	            snippets.push(snippet);
   265	        }
   266	    }
   267	    snippets.sort_by(|a, b| a.id.cmp(&b.id));
   268	    snippets
   269	}
   270	
   271	/// 扫描 `<dir>/templates/*.md`。文件名（去扩展名）即模板名；重名后读覆盖先读。
   272	fn scan_templates(dir: &Path, warnings: &mut Vec<String>) -> Vec<Template> {
   273	    let dir = dir.join("templates");
   274	    let entries = match std::fs::read_dir(&dir) {
   275	        Ok(entries) => entries,
   276	        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Vec::new(),
   277	        Err(e) => {
   278	            warnings.push(format!("templates: 无法读取目录（{e}）"));
   279	            return Vec::new();
   280	        }
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
   181	    }
   182	}
   183	
   184	fn to_package(manifest: ExtensionManifest, dir: &Path, skill: String) -> ExtensionPackage {
   185	    ExtensionPackage {
   186	        id: manifest.id,
   187	        name: manifest.name,
   188	        version: manifest.version,
   189	        description: manifest.description,
   190	        source: manifest.source,
   191	        enabled: package_enabled(dir),
   192	        dir: Some(dir.to_string_lossy().into_owned()),
   193	        skill,
   194	    }
   195	}
   196	
   197	// ── 内置包 ───────────────────────────────────────────────────
   198	
   199	fn builtin_packages() -> Vec<ExtensionPackage> {
   200	    vec![
   201	        ExtensionPackage {
   202	            id: BUILTIN_READING.into(),
   203	            name: "内置阅读".into(),
   204	            version: "0.1.0".into(),
   205	            description: "标月内置的阅读辅助能力（进度、目录、排版）。".into(),
   206	            source: "builtin".into(),
   207	            enabled: true,
   208	            dir: None,
   209	            skill: BUILTIN_READING_SKILL.into(),
   210	        },
   211	        ExtensionPackage {
   212	            id: BUILTIN_OUTLINE.into(),
   213	            name: "内置大纲".into(),
   214	            version: "0.1.0".into(),
   215	            description: "标月内置的大纲辅助能力（标题解析、大纲生成）。".into(),
   216	            source: "builtin".into(),
   217	            enabled: true,
   218	            dir: None,
   219	            skill: BUILTIN_OUTLINE_SKILL.into(),
   220	        },
   221	    ]
   222	}
   223	
   224	fn builtin_by_id(id: &str) -> Option<ExtensionPackage> {
   225	    builtin_packages().into_iter().find(|p| p.id == id)
   226	}
   227	
   228	// ── 命令实现（核心逻辑按 base 目录拆分，便于单测）─────────────
   229	
   230	/// 列出内置包 + 用户包（按 id 升序）。目录缺失只返回内置包；单个包非法只告警跳过。
   231	pub fn list_extension_packages_at(base: &Path) -> Result<Vec<ExtensionPackage>, AppError> {
   232	    let mut packages = builtin_packages();
   233	    let dir = extensions_dir_base(base);
   234	
   235	    let entries = match std::fs::read_dir(&dir) {
   236	        Ok(entries) => entries,
   237	        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(packages),
   238	        Err(e) => return Err(io("list extension packages", e)),
   239	    };
   240	
   241	    let mut user_packages = Vec::new();
   242	    for entry in entries.flatten() {
   243	        let path = entry.path();
   244	        if !path.is_dir() {
   245	            continue;
   246	        }
   247	        let id = entry.file_name().to_string_lossy().into_owned();
   248	        if !is_valid_id(&id) {
   249	            warn!(dir = %id, "扩展目录名非法，已跳过");
   250	            continue;
   251	        }
   252	        if is_builtin(&id) {
   253	            warn!(dir = %id, "内置扩展 id 不可被用户目录占用，已跳过");
   254	            continue;
   255	        }
   256	        match read_package_dir(&path) {
   257	            Ok((manifest, skill)) => {
   258	                if manifest.id != id {
   259	                    warn!(
   260	                        dir = %id,
   261	                        manifest_id = %manifest.id,
   262	                        "扩展目录名与 manifest.id 不一致，已跳过"
   263	                    );
   264	                    continue;
   265	                }
   266	                user_packages.push(to_package(manifest, &path, skill));
   267	            }
   268	            Err(e) => {
   269	                warn!(dir = %id, error = %e, "扩展包无法解析，已跳过");
   270	            }
   271	        }
   272	    }
   273	    user_packages.sort_by(|a, b| a.id.cmp(&b.id));
   274	    packages.extend(user_packages);
   275	    Ok(packages)
   276	}
   277	
   278	struct ResolvedSource {
   279	    manifest: ExtensionManifest,
   280	    skill: String,
   281	    dir: PathBuf,
   282	    /// 必须活到复制完成，否则 zip 解压目录会被提前删除。
   283	    _temp: Option<tempfile::TempDir>,
   284	}
   285	
   286	fn resolve_import_source(path: &str) -> Result<ResolvedSource, AppError> {
   287	    let src = PathBuf::from(path);
   288	    let meta = std::fs::metadata(&src).map_err(|e| io(&format!("import source {path}"), e))?;
   289	
   290	    if meta.is_dir() {
   291	        let (manifest, skill) = read_package_dir(&src)?;
   292	        validate_manifest(&manifest)?;
   293	        return Ok(ResolvedSource {
   294	            manifest,
   295	            skill,
   296	            dir: src,
   297	            _temp: None,
   298	        });
   299	    }
   300	
   301	    if meta.is_file() {
   302	        let is_zip = src
   303	            .extension()
   304	            .and_then(|e| e.to_str())
   305	            .map(|e| e.eq_ignore_ascii_case("zip"))
   306	            .unwrap_or(false);
   307	        if !is_zip {
   308	            return Err(validation(
   309	                "import",
   310	                format!("不支持的导入源类型：{path}（应为文件夹或 .zip）"),
   311	            ));
   312	        }
   313	        let temp = tempfile::tempdir().map_err(|e| io("create temp dir", e))?;
   314	        let temp_path = temp.path().to_path_buf();
   315	        extract_zip(&src, &temp_path)?;
   316	        // Finder「压缩」等工具会生成 `folder/manifest.json` 的嵌套 zip，这里下钻一层。
   317	        let root = locate_zip_root(&temp_path).ok_or_else(|| {
   318	            validation(
   319	                "import",
   320	                format!("zip 内缺少 {MANIFEST_FILE} 与 {SKILL_FILE}：{path}"),

exec
/bin/zsh -c "nl -ba src/lib/capabilities.ts | sed -n '1,260p'
nl -ba src/components/SettingsView.tsx | sed -n '1,360p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
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
     1	import {
     2	  useCallback,
     3	  useEffect,
     4	  useMemo,
     5	  useRef,
     6	  useState,
     7	  type ChangeEvent,
     8	} from "react";
     9	import { invoke } from "@tauri-apps/api/core";
    10	import {
    11	  listCapabilities,
    12	  setCapabilityEnabled,
    13	  type CapabilityId,
    14	} from "../lib/capabilities";
    15	import type { PreviewSettings } from "../lib/previewAnchor";
    16	import {
    17	  applyPropertyBarConfig,
    18	  applyReaderSkin,
    19	  applyTheme,
    20	  reloadAppConfig,
    21	  saveAppConfig,
    22	} from "../hooks/useConfig";
    23	import type {
    24	  PropertyBarConfig,
    25	  PropertyBarDefaultMode,
    26	  PropertyBarDisplayStyle,
    27	} from "../types";
    28	import { useEditorStore } from "../stores/editorStore";
    29	import { HTML_TOOLBAR_ITEMS } from "../editors/orchestration/slots";
    30	import { ROULETTE_HOTKEY_DEFAULT } from "../editors/orchestration/roulette";
    31	import {
    32	  READER_WIDTH_MAX,
    33	  READER_WIDTH_MIN,
    34	  READER_WIDTH_PRESETS,
    35	  READER_WIDTH_STEP,
    36	} from "../lib/readerWidth";
    37	import {
    38	  HEADING_FONT_STACK,
    39	  HEADING_LEVELS,
    40	  ensureHeadingFonts,
    41	  headingFontInputValue,
    42	  parseHeadingFontInput,
    43	  type HeadingLevel,
    44	} from "../lib/headingFonts";
    45	import { useStore } from "../stores/index";
    46	import { PROVIDERS } from "../lib/providers";
    47	import { formatSnapshotTime } from "../hooks/useAiEntry";
    48	import { isTauriEnv } from "../utils/tauri";
    49	import Icon from "./Icon";
    50	import { ICONS, ICON_NAMES } from "../ui/icons";
    51	import {
    52	  SHORTCUT_FAMILY_LABELS,
    53	  SHORTCUT_FAMILY_ORDER,
    54	  coreShortcuts,
    55	  shortcutsByFamily,
    56	} from "../lib/shortcuts";
    57	import pkg from "../../package.json";
    58	
    59	interface SettingsViewProps {
    60	  onClose: () => void;
    61	}
    62	
    63	interface ExtensionPackage {
    64	  id: string;
    65	  name: string;
    66	  version: string;
    67	  description: string;
    68	  source: "builtin" | "ai" | "user";
    69	  enabled: boolean;
    70	  dir: string | null;
    71	  skill: string;
    72	}
    73	
    74	interface SystemFontsResponse {
    75	  families: string[];
    76	  enumerated: boolean;
    77	}
    78	
    79	const SOURCE_LABELS: Record<ExtensionPackage["source"], string> = {
    80	  builtin: "内置",
    81	  ai: "AI 生成",
    82	  user: "用户导入",
    83	};
    84	
    85	const SECTIONS = [
    86	  { id: "appearance", label: "外观" },
    87	  { id: "editor", label: "编辑器" },
    88	  { id: "files", label: "文件" },
    89	  { id: "reading", label: "阅读空间" },
    90	  { id: "grid", label: "网格概览" },
    91	  { id: "preview", label: "悬浮预览" },
    92	  { id: "ai", label: "AI 服务" },
    93	  { id: "extensions", label: "扩展" },
    94	  { id: "shortcuts", label: "快捷键" },
    95	  { id: "data", label: "数据与备份" },
    96	  { id: "about", label: "关于" },
    97	] as const;
    98	
    99	type SectionId = (typeof SECTIONS)[number]["id"];
   100	
   101	const RAIL_LAYOUT_OPTIONS = [
   102	  { value: "stacked", label: "堆叠" },
   103	  { value: "tabs", label: "标签页" },
   104	] as const;
   105	
   106	const RAIL_DENSITY_OPTIONS = [
   107	  { value: "compact", label: "紧凑" },
   108	  { value: "comfortable", label: "舒适" },
   109	  { value: "card", label: "卡片" },
   110	] as const;
   111	
   112	const GRID_GROUP_OPTIONS = [
   113	  { value: "time", label: "时间" },
   114	  { value: "type", label: "类型" },
   115	  { value: "theme", label: "主题" },
   116	  { value: "none", label: "不分组" },
   117	] as const;
   118	
   119	const GRID_SORT_OPTIONS = [
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
   181	
   182	const GRID_MODES = [
   183	  { value: "hover", label: "悬停" },
   184	  { value: "click", label: "点击" },
   185	  { value: "off", label: "关闭" },
   186	] as const;
   187	
   188	const PROPERTY_BAR_STYLE_OPTIONS = [
   189	  { value: "list", label: "A 一行条" },
   190	  { value: "dual", label: "B 精排双列" },
   191	] as const;
   192	
   193	const PROPERTY_BAR_DEFAULT_OPTIONS = [
   194	  { value: "show", label: "展开" },
   195	  { value: "collapse", label: "折叠" },
   196	  { value: "hide", label: "隐藏" },
   197	] as const;
   198	
   199	const PROPERTY_BAR_NEW_DOC_OPTIONS = [
   200	  { value: "show", label: "显示" },
   201	  { value: "hide", label: "隐藏" },
   202	] as const;
   203	
   204	function ExtensionsSection({
   205	  tauriEnv,
   206	  dropActive,
   207	  setDropActive,
   208	}: {
   209	  tauriEnv: boolean;
   210	  dropActive: boolean;
   211	  setDropActive: (next: boolean) => void;
   212	}) {
   213	  const [packages, setPackages] = useState<ExtensionPackage[]>([]);
   214	  const [loading, setLoading] = useState(tauriEnv);
   215	  const [notice, setNotice] = useState("");
   216	  const [previewId, setPreviewId] = useState<string | null>(null);
   217	  const [aiPrompt, setAiPrompt] = useState("");
   218	  const [aiBusy, setAiBusy] = useState(false);
   219	  const aiRunRef = useRef(0);
   220	
   221	  const refresh = useCallback(async () => {
   222	    if (!tauriEnv) return;
   223	    try {
   224	      const list = await invoke<ExtensionPackage[]>("list_extension_packages");
   225	      setPackages(Array.isArray(list) ? list : []);
   226	    } catch {
   227	      setPackages([]);
   228	    } finally {
   229	      setLoading(false);
   230	    }
   231	  }, [tauriEnv]);
   232	
   233	  useEffect(() => {
   234	    if (!tauriEnv) return;
   235	    let cancelled = false;
   236	    invoke<ExtensionPackage[]>("list_extension_packages")
   237	      .then((list) => {
   238	        if (!cancelled) setPackages(Array.isArray(list) ? list : []);
   239	      })
   240	      .catch(() => {
   241	        if (!cancelled) setPackages([]);
   242	      })
   243	      .finally(() => {
   244	        if (!cancelled) setLoading(false);
   245	      });
   246	    return () => {
   247	      cancelled = true;
   248	    };
   249	  }, [tauriEnv]);
   250	
   251	  const importPath = useCallback(
   252	    async (target: string) => {
   253	      if (!tauriEnv) return;
   254	      try {
   255	        await invoke<ExtensionPackage>("import_extension_package", {
   256	          path: target,
   257	        });
   258	        await refresh();
   259	        setNotice(`已导入扩展：${target}`);
   260	      } catch {
   261	        setNotice("导入失败，请重试。");
   262	      }
   263	    },
   264	    [tauriEnv, refresh],
   265	  );
   266	
   267	  const importFrom = async (kind: "folder" | "zip") => {
   268	    if (!tauriEnv) return;
   269	    try {
   270	      const picked = await invoke<string | null>("pick_extension_source", {
   271	        kind,
   272	      });
   273	      if (!picked) return;
   274	      await importPath(picked);
   275	    } catch {
   276	      setNotice("导入失败，请重试。");
   277	    }
   278	  };
   279	
   280	  // Tauri webview 拖放：进入/悬停显示浮层，松开导入首个路径，离开或 Esc 收起。
   281	  useEffect(() => {
   282	    if (!tauriEnv) return;
   283	    let unlisten: (() => void) | null = null;
   284	    let disposed = false;
   285	    (async () => {
   286	      try {
   287	        const { getCurrentWebview } = await import("@tauri-apps/api/webview");
   288	        if (disposed) return;
   289	        unlisten = await getCurrentWebview().onDragDropEvent((event) => {
   290	          const type = event.payload.type;
   291	          if (type === "enter" || type === "over") {
   292	            setDropActive(true);
   293	            return;
   294	          }
   295	          if (type === "leave") {
   296	            setDropActive(false);
   297	            return;
   298	          }
   299	          if (type !== "drop") return;
   300	          setDropActive(false);
   301	          const path = event.payload.paths[0];
   302	          if (path) void importPath(path);
   303	        });
   304	      } catch {
   305	        /* 浏览器预览无 webview 拖放事件 */
   306	      }
   307	    })();
   308	    return () => {
   309	      disposed = true;
   310	      unlisten?.();
   311	    };
   312	  }, [tauriEnv, importPath, setDropActive]);
   313	
   314	  const togglePackage = async (pkg: ExtensionPackage, enabled: boolean) => {
   315	    try {
   316	      await invoke("set_extension_package_enabled", {
   317	        id: pkg.id,
   318	        enabled,
   319	      });
   320	      await refresh();
   321	    } catch {
   322	      /* 开关失败时保留原状态 */
   323	    }
   324	  };
   325	
   326	  const removePackage = async (id: string) => {
   327	    try {
   328	      await invoke("remove_extension_package", { id });
   329	      await refresh();
   330	      setNotice("已卸载扩展。");
   331	    } catch {
   332	      setNotice("卸载失败，请重试。");
   333	    }
   334	  };
   335	
   336	  const exportPackage = async (id: string) => {
   337	    try {
   338	      const out = await invoke<string>("package_extension_package", { id });
   339	      setNotice(`已导出：${out}`);
   340	    } catch {
   341	      setNotice("导出失败，请重试。");
   342	    }
   343	  };
   344	
   345	  const openDir = async (dir: string | null) => {
   346	    if (!dir) return;
   347	    try {
   348	      await invoke("reveal_in_finder", { path: dir });
   349	    } catch {
   350	      /* 打开文件夹失败静默 */
   351	    }
   352	  };
   353	
   354	  const generateAi = async () => {
   355	    const prompt = aiPrompt.trim();
   356	    if (!prompt || aiBusy) return;
   357	    const run = aiRunRef.current + 1;
   358	    aiRunRef.current = run;
   359	    setAiBusy(true);
   360	    try {

exec
/bin/zsh -c "rg -n --hidden --glob '"'!node_modules'"' --glob '"'!target'"' --glob '"'!dist'"' 'SKILL_MAP|seed_skill_map|SKILL_MD|theme\\.toml|THEME_EXTRA|extension|manifest|env\\.toml|filesystem|rouletteSectors|htmlToolbarItems|selectionToolbar|ROOT_SECTORS|readerFontSize|defaultNewDocFormat|defaultSavePath|SHORTCUTS|ShortcutDef|htmlToolbar|reader.*preset|font.*preset' src src-tauri docs .opencode 2>/dev/null" in /Users/mason/ToHighs/clairis-wt-design-plan
 exited 2 in 0ms:
src-tauri/src/extensions.rs:86:/// 把 `theme.toml` 里的键规范化成 `--app-<name>`。
src-tauri/src/extensions.rs:314:/// 读取 `<dir>/theme.toml` 的 `[tokens]` 表，白名单校验键与值。
src-tauri/src/extensions.rs:316:    let path = dir.join("theme.toml");
src-tauri/src/extensions.rs:325:                warnings: vec![format!("theme.toml: 读取失败（{e}）")],
src-tauri/src/extensions.rs:354:        Ok(_) => warnings.push("theme.toml: 顶层不是表".into()),
src-tauri/src/extensions.rs:355:        Err(e) => warnings.push(format!("theme.toml: 解析失败（{e}）")),
src-tauri/src/extensions.rs:359:        warnings.push(format!("theme.toml: 忽略 {invalid} 个非法 token"));
src-tauri/src/extensions.rs:366:pub fn scan_extensions(config_dir: &Path) -> ExtensionsSnapshot {
src-tauri/src/extensions.rs:408:        let snapshot = scan_extensions(base);
src-tauri/src/extensions.rs:430:        let snapshot = scan_extensions(base);
src-tauri/src/extensions.rs:448:        let snapshot = scan_extensions(base);
src-tauri/src/extensions.rs:474:        let snapshot = scan_extensions(base);
src-tauri/src/extensions.rs:491:        let snapshot = scan_extensions(base);
src-tauri/src/extensions.rs:506:            "theme.toml",
src-tauri/src/extensions.rs:510:        let snapshot = scan_extensions(base);
src-tauri/src/extensions.rs:541:            "theme.toml",
src-tauri/src/extensions.rs:545:        let snapshot = scan_extensions(base);
src-tauri/src/extensions.rs:577:            "theme.toml",
src-tauri/src/extensions.rs:581:        let snapshot = scan_extensions(base);
src-tauri/src/extensions.rs:600:            "theme.toml",
src-tauri/src/extensions.rs:604:        let snapshot = scan_extensions(base);
src-tauri/src/extensions.rs:630:        let snapshot = scan_extensions(base);
src-tauri/src/extensions.rs:642:        let snapshot = scan_extensions(base);
src-tauri/src/extensions.rs:654:        let snapshot = scan_extensions(base);
src-tauri/src/extensions.rs:670:        let snapshot = scan_extensions(base);
src-tauri/src/extensions.rs:685:        let snapshot = scan_extensions(base);
src/lib/aiErrors.ts:17:  readerFontSize: "阅读字号需要在 8–96 之间",
docs/MIGRATION-REPORT.md:23:| 基线 source 总数（任务 1 baseline-manifest） | **173** |
docs/MIGRATION-REPORT.md:37:1. **任务 1 基线清单** `.omo/evidence/ulw/clairis-doc-governance/task-1/baseline-manifest.json`（`files` 数组 173 条，每条含 `path/group/sha256/size/action`）。
docs/MIGRATION-REPORT.md:182:> 注：`index.html.artifact.json` 在 MIGRATION-MAP 记为第 174 行的 exclude（生成物），但**不在**任务 1 baseline-manifest 的 173 条 source 之内，故不计入本账目分母。
docs/MIGRATION-REPORT.md:254:| 1 基线清单 | baseline-manifest.json（173）、backup-manifest.json（121，hash 全匹配）、exclusion-ledger.json | `task-1/` |
src-tauri/src/commands/file.rs:46:fn extension_of(path: &Path) -> Option<String> {
src-tauri/src/commands/file.rs:47:    path.extension()
src-tauri/src/commands/file.rs:53:pub fn is_binary_extension(path: &Path) -> bool {
src-tauri/src/commands/file.rs:55:        extension_of(path),
src-tauri/src/commands/file.rs:63:        extension_of(path),
src-tauri/src/commands/file.rs:143:        let content = if is_binary_extension(&path_buf) {
src-tauri/src/commands/file.rs:184:        let content = if is_binary_extension(&read_path) {
src-tauri/src/commands/file.rs:252:        .and_then(|name| Path::new(name).extension())
src-tauri/src/commands/file.rs:333:        .extension()
src-tauri/src/commands/file.rs:404:        .extension()
src-tauri/src/commands/file.rs:452:    fn binary_extensions_classified() {
src-tauri/src/commands/file.rs:475:                is_binary_extension(Path::new(name)),
src-tauri/src/commands/file.rs:508:    fn doc_extensions_are_not_binary() {
src-tauri/src/commands/file.rs:512:            assert!(!is_binary_extension(p), "doc ext {ext} must not be binary");
src-tauri/src/commands/file.rs:622:        .extension()
src-tauri/src/commands/file.rs:696:        .extension()
src-tauri/src/commands/recent.rs:7:use crate::commands::file::{is_binary_extension, is_supported_document};
src-tauri/src/commands/recent.rs:20:    is_supported_document(path) || is_binary_extension(path)
src-tauri/src/commands/recent.rs:25:        path.extension()
src-tauri/src/commands/recent.rs:185:            let excerpt = if is_binary_extension(&item.path) {
src-tauri/src/commands/recent.rs:296:    fn only_supported_extensions_and_skips_hidden_and_heavy_dirs() {
docs/delivery/requirements-status.md:183:| L-8 | 扩展拖入即用/导出/AI 生成 | ✅ | [e2e/extensions-manage.spec.ts](../../e2e/extensions-manage.spec.ts) |
docs/delivery/requirements-status.md:246:### extensions（3，2026-11-03 新增）
docs/delivery/requirements-status.md:250:| X-1 | 数据文件扩展点（snippets / templates） | ✅ | change `extension-points`（归档 2026-11-03）；`src-tauri/src/extensions.rs`、`src/lib/extensions/` |
docs/delivery/requirements-status.md:251:| X-2 | 主题 token 覆盖（`theme.toml` 白名单） | ✅ | 同上；`src/lib/extensions/theme-tokens.ts` |
src-tauri/src/commands/directory.rs:295:    /// For subtitle entries: the media file (without extension) this subtitle belongs to.
src-tauri/src/commands/directory.rs:306:        .extension()
src-tauri/src/commands/directory.rs:370:            .extension()
src/lib/export/zip.ts:2:// （include 展开、无 manifest.json、附 README.md）。不新增依赖。
src-tauri/src/commands/config_cmd.rs:6:use crate::extensions::ExtensionsSnapshot;
src-tauri/src/commands/config_cmd.rs:56:/// Scan user extension directories (snippets / templates / theme.toml).
src-tauri/src/commands/config_cmd.rs:58:pub fn list_extensions(app: AppHandle) -> Result<ExtensionsSnapshot, String> {
src-tauri/src/commands/config_cmd.rs:59:    Ok(crate::extensions::scan_extensions(&config::config_base(
src/lib/export/mdpkg.ts:65:  const manifest = buildManifest(files);
src/lib/export/mdpkg.ts:66:  return packPackage(files, manifest);
src-tauri/src/commands/ai_agent_cmd.rs:45:    let context = crate::extension_packages::enabled_skill_context_at(&base)?;
src/lib/shortcuts.ts:24:export interface ShortcutDef {
src/lib/shortcuts.ts:68:export const SHORTCUTS: readonly ShortcutDef[] = [
src/lib/shortcuts.ts:535:export function coreShortcuts(): ShortcutDef[] {
src/lib/shortcuts.ts:536:  return SHORTCUTS.filter((s) => s.core);
src/lib/shortcuts.ts:540:export function shortcutsByFamily(family: ShortcutFamily): ShortcutDef[] {
src/lib/shortcuts.ts:541:  return SHORTCUTS.filter((s) => s.family === family);
src/lib/shortcuts.ts:561:  return SHORTCUTS.some(
docs/delivery/layout-portal-acceptance.md:25:| 8 | 扩展：拖入即用、导出、AI 生成 | 通过 | [e2e/extensions-manage.spec.ts](../../e2e/extensions-manage.spec.ts)（导入/开关/卸载/导出/AI 生成/取消） |
docs/delivery/layout-portal-acceptance.md:41:| 7 | 该项调整无需改源码？→ 是（P4） | 通过 | 视图规格持久化于 Rust 配置字段（`railViewSpec` / `previewSettings` / `aiViewSpec`）；扩展包 `extensions/<id>/` |
src-tauri/src/extension_packages.rs:1://! 扩展包管理（layout-portal §9）：`<config_base>/extensions/<id>/` 下的
src-tauri/src/extension_packages.rs:2://! `manifest.json` + `SKILL.md` 包。
src-tauri/src/extension_packages.rs:6://! manifest）。
src-tauri/src/extension_packages.rs:9://! - `<config_base>/extensions/<id>/manifest.json`
src-tauri/src/extension_packages.rs:10://! - `<config_base>/extensions/<id>/SKILL.md`
src-tauri/src/extension_packages.rs:11://! - `<config_base>/extensions/<id>/.disabled`（可选，停用标记）
src-tauri/src/extension_packages.rs:24:const MANIFEST_FILE: &str = "manifest.json";
src-tauri/src/extension_packages.rs:96:fn extensions_dir_base(base: &Path) -> PathBuf {
src-tauri/src/extension_packages.rs:97:    base.join("extensions")
src-tauri/src/extension_packages.rs:118:fn validate_manifest(manifest: &ExtensionManifest) -> Result<(), AppError> {
src-tauri/src/extension_packages.rs:119:    if !is_valid_id(&manifest.id) {
src-tauri/src/extension_packages.rs:121:            "manifest.id",
src-tauri/src/extension_packages.rs:122:            format!("id {:?} 格式非法（应为 [a-z0-9-]+）", manifest.id),
src-tauri/src/extension_packages.rs:125:    if manifest.name.trim().is_empty() {
src-tauri/src/extension_packages.rs:126:        return Err(validation("manifest.name", "name 不能为空"));
src-tauri/src/extension_packages.rs:128:    if manifest.version.trim().is_empty() {
src-tauri/src/extension_packages.rs:129:        return Err(validation("manifest.version", "version 不能为空"));
src-tauri/src/extension_packages.rs:131:    if !matches!(manifest.source.as_str(), "builtin" | "ai" | "user") {
src-tauri/src/extension_packages.rs:133:            "manifest.source",
src-tauri/src/extension_packages.rs:134:            format!("source {:?} 不属于 builtin|ai|user", manifest.source),
src-tauri/src/extension_packages.rs:142:/// 读取 `dir/manifest.json` 与 `dir/SKILL.md`。任一缺失或非法都报错。
src-tauri/src/extension_packages.rs:144:    let manifest_path = dir.join(MANIFEST_FILE);
src-tauri/src/extension_packages.rs:145:    let raw = std::fs::read_to_string(&manifest_path)
src-tauri/src/extension_packages.rs:146:        .map_err(|e| io(&format!("read {}", manifest_path.display()), e))?;
src-tauri/src/extension_packages.rs:147:    let manifest: ExtensionManifest =
src-tauri/src/extension_packages.rs:149:            context: format!("parse {}", manifest_path.display()),
src-tauri/src/extension_packages.rs:157:    Ok((manifest, skill))
src-tauri/src/extension_packages.rs:184:fn to_package(manifest: ExtensionManifest, dir: &Path, skill: String) -> ExtensionPackage {
src-tauri/src/extension_packages.rs:186:        id: manifest.id,
src-tauri/src/extension_packages.rs:187:        name: manifest.name,
src-tauri/src/extension_packages.rs:188:        version: manifest.version,
src-tauri/src/extension_packages.rs:189:        description: manifest.description,
src-tauri/src/extension_packages.rs:190:        source: manifest.source,
src-tauri/src/extension_packages.rs:231:pub fn list_extension_packages_at(base: &Path) -> Result<Vec<ExtensionPackage>, AppError> {
src-tauri/src/extension_packages.rs:233:    let dir = extensions_dir_base(base);
src-tauri/src/extension_packages.rs:238:        Err(e) => return Err(io("list extension packages", e)),
src-tauri/src/extension_packages.rs:257:            Ok((manifest, skill)) => {
src-tauri/src/extension_packages.rs:258:                if manifest.id != id {
src-tauri/src/extension_packages.rs:261:                        manifest_id = %manifest.id,
src-tauri/src/extension_packages.rs:262:                        "扩展目录名与 manifest.id 不一致，已跳过"
src-tauri/src/extension_packages.rs:266:                user_packages.push(to_package(manifest, &path, skill));
src-tauri/src/extension_packages.rs:279:    manifest: ExtensionManifest,
src-tauri/src/extension_packages.rs:291:        let (manifest, skill) = read_package_dir(&src)?;
src-tauri/src/extension_packages.rs:292:        validate_manifest(&manifest)?;
src-tauri/src/extension_packages.rs:294:            manifest,
src-tauri/src/extension_packages.rs:303:            .extension()
src-tauri/src/extension_packages.rs:316:        // Finder「压缩」等工具会生成 `folder/manifest.json` 的嵌套 zip，这里下钻一层。
src-tauri/src/extension_packages.rs:323:        let (manifest, skill) = read_package_dir(&root)?;
src-tauri/src/extension_packages.rs:324:        validate_manifest(&manifest)?;
src-tauri/src/extension_packages.rs:326:            manifest,
src-tauri/src/extension_packages.rs:368:/// 先复制到 `<extensions>/.tmp-<id>-<hash>` 暂存目录，成功后才移除旧目标并
src-tauri/src/extension_packages.rs:371:pub fn import_extension_package_at(base: &Path, path: &str) -> Result<ExtensionPackage, AppError> {
src-tauri/src/extension_packages.rs:373:        manifest,
src-tauri/src/extension_packages.rs:379:    if is_builtin(&manifest.id) {
src-tauri/src/extension_packages.rs:382:            format!("内置扩展 id {} 不可导入", manifest.id),
src-tauri/src/extension_packages.rs:386:    let extensions = extensions_dir_base(base);
src-tauri/src/extension_packages.rs:387:    std::fs::create_dir_all(&extensions)
src-tauri/src/extension_packages.rs:388:        .map_err(|e| io(&format!("create {}", extensions.display()), e))?;
src-tauri/src/extension_packages.rs:389:    let staging = extensions.join(format!(".tmp-{}-{}", manifest.id, short_hash(path)));
src-tauri/src/extension_packages.rs:400:    let target = extensions.join(&manifest.id);
src-tauri/src/extension_packages.rs:414:        id: manifest.id,
src-tauri/src/extension_packages.rs:415:        name: manifest.name,
src-tauri/src/extension_packages.rs:416:        version: manifest.version,
src-tauri/src/extension_packages.rs:417:        description: manifest.description,
src-tauri/src/extension_packages.rs:418:        source: manifest.source,
src-tauri/src/extension_packages.rs:523:            "extensionPackage",
src-tauri/src/extension_packages.rs:527:    let dir = extensions_dir_base(base).join(id);
src-tauri/src/extension_packages.rs:529:        return Err(validation("extensionPackage", format!("扩展不存在：{id}")));
src-tauri/src/extension_packages.rs:534:pub fn set_extension_package_enabled_at(
src-tauri/src/extension_packages.rs:541:            "extensionPackage",
src-tauri/src/extension_packages.rs:558:pub fn remove_extension_package_at(base: &Path, id: &str) -> Result<(), AppError> {
src-tauri/src/extension_packages.rs:560:        return Err(validation("extensionPackage", "内置扩展不可卸载"));
src-tauri/src/extension_packages.rs:608:pub fn package_extension_package_at(base: &Path, id: &str) -> Result<String, AppError> {
src-tauri/src/extension_packages.rs:610:        return Err(validation("extensionPackage", "内置扩展不可导出"));
src-tauri/src/extension_packages.rs:682:pub fn generate_extension_package_at(
src-tauri/src/extension_packages.rs:688:        return Err(validation("extensionPackage", "提示词不能为空"));
src-tauri/src/extension_packages.rs:694:    let manifest = ExtensionManifest {
src-tauri/src/extension_packages.rs:702:    let dir = extensions_dir_base(base).join(&id);
src-tauri/src/extension_packages.rs:708:    let manifest_json =
src-tauri/src/extension_packages.rs:709:        serde_json::to_string_pretty(&manifest).map_err(|e| AppError::Serialization {
src-tauri/src/extension_packages.rs:710:            context: "extension manifest".into(),
src-tauri/src/extension_packages.rs:713:    std::fs::write(dir.join(MANIFEST_FILE), manifest_json)
src-tauri/src/extension_packages.rs:730:pub fn read_extension_skill_at(base: &Path, id: &str) -> Result<String, AppError> {
src-tauri/src/extension_packages.rs:743:    for package in list_extension_packages_at(base)? {
src-tauri/src/extension_packages.rs:753:pub async fn list_extension_packages(app: AppHandle) -> Result<Vec<ExtensionPackage>, AppError> {
src-tauri/src/extension_packages.rs:755:    tauri::async_runtime::spawn_blocking(move || list_extension_packages_at(&base))
src-tauri/src/extension_packages.rs:758:            context: "list extension packages task join".into(),
src-tauri/src/extension_packages.rs:764:pub async fn import_extension_package(
src-tauri/src/extension_packages.rs:769:    tauri::async_runtime::spawn_blocking(move || import_extension_package_at(&base, &path))
src-tauri/src/extension_packages.rs:772:            context: "import extension package task join".into(),
src-tauri/src/extension_packages.rs:778:pub async fn set_extension_package_enabled(
src-tauri/src/extension_packages.rs:785:        set_extension_package_enabled_at(&base, &id, enabled)
src-tauri/src/extension_packages.rs:789:        context: "set extension package enabled task join".into(),
src-tauri/src/extension_packages.rs:795:pub async fn remove_extension_package(app: AppHandle, id: String) -> Result<(), AppError> {
src-tauri/src/extension_packages.rs:797:    tauri::async_runtime::spawn_blocking(move || remove_extension_package_at(&base, &id))
src-tauri/src/extension_packages.rs:800:            context: "remove extension package task join".into(),
src-tauri/src/extension_packages.rs:806:pub async fn package_extension_package(app: AppHandle, id: String) -> Result<String, AppError> {
src-tauri/src/extension_packages.rs:808:    tauri::async_runtime::spawn_blocking(move || package_extension_package_at(&base, &id))
src-tauri/src/extension_packages.rs:811:            context: "package extension package task join".into(),
src-tauri/src/extension_packages.rs:817:pub async fn pick_extension_source(
src-tauri/src/extension_packages.rs:830:                "pick_extension_source",
src-tauri/src/extension_packages.rs:841:pub async fn generate_extension_package(
src-tauri/src/extension_packages.rs:846:    tauri::async_runtime::spawn_blocking(move || generate_extension_package_at(&base, &prompt))
src-tauri/src/extension_packages.rs:849:            context: "generate extension package task join".into(),
src-tauri/src/extension_packages.rs:855:pub async fn read_extension_skill(app: AppHandle, id: String) -> Result<String, AppError> {
src-tauri/src/extension_packages.rs:857:    tauri::async_runtime::spawn_blocking(move || read_extension_skill_at(&base, &id))
src-tauri/src/extension_packages.rs:860:            context: "read extension skill task join".into(),
src-tauri/src/extension_packages.rs:877:        let dir = base.join("extensions").join(id);
src-tauri/src/extension_packages.rs:879:        let manifest = serde_json::json!({
src-tauri/src/extension_packages.rs:888:            serde_json::to_string_pretty(&manifest).unwrap(),
src-tauri/src/extension_packages.rs:901:        std::fs::write(base.join("extensions/ai-two").join(DISABLED_MARKER), b"").unwrap();
src-tauri/src/extension_packages.rs:903:        let packages = list_extension_packages_at(&base).unwrap();
src-tauri/src/extension_packages.rs:926:    fn list_without_extensions_dir_returns_only_builtins() {
src-tauri/src/extension_packages.rs:929:        let packages = list_extension_packages_at(&base).unwrap();
src-tauri/src/extension_packages.rs:935:    fn import_folder_copies_manifest_and_skill_and_enables() {
src-tauri/src/extension_packages.rs:947:        let package = import_extension_package_at(&base, src.to_str().unwrap()).unwrap();
src-tauri/src/extension_packages.rs:956:        let installed = base.join("extensions/my-ext");
src-tauri/src/extension_packages.rs:968:        let packages = list_extension_packages_at(&base).unwrap();
src-tauri/src/extension_packages.rs:986:        assert!(import_extension_package_at(&base, src.to_str().unwrap()).is_err());
src-tauri/src/extension_packages.rs:1004:        let package = import_extension_package_at(&base, src.to_str().unwrap()).unwrap();
src-tauri/src/extension_packages.rs:1015:        let manifest_before = std::fs::read_to_string(installed.join(MANIFEST_FILE)).unwrap();
src-tauri/src/extension_packages.rs:1018:            import_extension_package_at(&base, installed.to_str().unwrap()).expect("自导入应成功");
src-tauri/src/extension_packages.rs:1029:            manifest_before
src-tauri/src/extension_packages.rs:1038:        let manifest_before = std::fs::read_to_string(installed.join(MANIFEST_FILE)).unwrap();
src-tauri/src/extension_packages.rs:1056:        let err = import_extension_package_at(&base, src.to_str().unwrap())
src-tauri/src/extension_packages.rs:1063:            manifest_before
src-tauri/src/extension_packages.rs:1076:    fn import_rejects_invalid_manifest_and_missing_skill() {
src-tauri/src/extension_packages.rs:1089:        assert!(import_extension_package_at(&base, bad_id.to_str().unwrap()).is_err());
src-tauri/src/extension_packages.rs:1099:        assert!(import_extension_package_at(&base, no_skill.to_str().unwrap()).is_err());
src-tauri/src/extension_packages.rs:1101:        // manifest 不是 JSON
src-tauri/src/extension_packages.rs:1106:        assert!(import_extension_package_at(&base, bad_json.to_str().unwrap()).is_err());
src-tauri/src/extension_packages.rs:1117:        assert!(import_extension_package_at(&base, bad_source.to_str().unwrap()).is_err());
src-tauri/src/extension_packages.rs:1126:        set_extension_package_enabled_at(&base, "toggle-me", false).unwrap();
src-tauri/src/extension_packages.rs:1128:            .join("extensions/toggle-me")
src-tauri/src/extension_packages.rs:1131:        let packages = list_extension_packages_at(&base).unwrap();
src-tauri/src/extension_packages.rs:1140:        set_extension_package_enabled_at(&base, "toggle-me", true).unwrap();
src-tauri/src/extension_packages.rs:1142:            .join("extensions/toggle-me")
src-tauri/src/extension_packages.rs:1145:        let packages = list_extension_packages_at(&base).unwrap();
src-tauri/src/extension_packages.rs:1159:        assert!(set_extension_package_enabled_at(&base, BUILTIN_READING, false).is_err());
src-tauri/src/extension_packages.rs:1160:        assert!(remove_extension_package_at(&base, BUILTIN_OUTLINE).is_err());
src-tauri/src/extension_packages.rs:1161:        assert!(package_extension_package_at(&base, BUILTIN_READING).is_err());
src-tauri/src/extension_packages.rs:1162:        assert!(set_extension_package_enabled_at(&base, "ghost", true).is_err());
src-tauri/src/extension_packages.rs:1163:        assert!(remove_extension_package_at(&base, "ghost").is_err());
src-tauri/src/extension_packages.rs:1171:        assert!(base.join("extensions/gone").is_dir());
src-tauri/src/extension_packages.rs:1173:        remove_extension_package_at(&base, "gone").unwrap();
src-tauri/src/extension_packages.rs:1174:        assert!(!base.join("extensions/gone").exists());
src-tauri/src/extension_packages.rs:1183:        let zip_path = package_extension_package_at(&base, "rt").unwrap();
src-tauri/src/extension_packages.rs:1188:        let package = import_extension_package_at(&base, &zip_path).unwrap();
src-tauri/src/extension_packages.rs:1203:        set_extension_package_enabled_at(&base, "rt2", false).unwrap();
src-tauri/src/extension_packages.rs:1205:        let zip_path = package_extension_package_at(&base, "rt2").unwrap();
src-tauri/src/extension_packages.rs:1206:        let package = import_extension_package_at(&base, &zip_path).unwrap();
src-tauri/src/extension_packages.rs:1215:        let package = generate_extension_package_at(&base, "帮我每周总结阅读笔记").unwrap();
src-tauri/src/extension_packages.rs:1235:        let again = generate_extension_package_at(&base, "帮我每周总结阅读笔记").unwrap();
src-tauri/src/extension_packages.rs:1243:        assert!(generate_extension_package_at(&base, "   ").is_err());
src-tauri/src/extension_packages.rs:1261:        let err = import_extension_package_at(&base, malicious.to_str().unwrap())
src-tauri/src/extension_packages.rs:1268:    fn zip_import_rejects_missing_manifest() {
src-tauri/src/extension_packages.rs:1269:        let dir = temp_base("zip-nomanifest");
src-tauri/src/extension_packages.rs:1280:        assert!(import_extension_package_at(&base, zip_path.to_str().unwrap()).is_err());
src-tauri/src/extension_packages.rs:1298:        let err = import_extension_package_at(&base, zip_path.to_str().unwrap())
src-tauri/src/extension_packages.rs:1330:        zip.start_file("nested/manifest.json", options).unwrap();
src-tauri/src/extension_packages.rs:1331:        let manifest = r#"{"id":"nested-ext","name":"嵌套扩展","version":"0.1.0","description":"d","source":"user"}"#;
src-tauri/src/extension_packages.rs:1332:        zip.write_all(manifest.as_bytes()).unwrap();
src-tauri/src/extension_packages.rs:1337:        let package = import_extension_package_at(&base, zip_path.to_str().unwrap()).unwrap();
src-tauri/src/extension_packages.rs:1340:        assert!(base.join("extensions/nested-ext/SKILL.md").exists());
src-tauri/src/extension_packages.rs:1344:    fn read_extension_skill_returns_builtin_and_user_text() {
src-tauri/src/extension_packages.rs:1350:            read_extension_skill_at(&base, BUILTIN_READING).unwrap(),
src-tauri/src/extension_packages.rs:1354:            read_extension_skill_at(&base, "readable").unwrap(),
src-tauri/src/extension_packages.rs:1357:        assert!(read_extension_skill_at(&base, "ghost").is_err());
src-tauri/src/extension_packages.rs:1366:        set_extension_package_enabled_at(&base, "ctx-off", false).unwrap();
src-tauri/src/extension_packages.rs:1378:        set_extension_package_enabled_at(&base, "ctx-off", true).unwrap();
src-tauri/src/extension_packages.rs:1394:        assert!(set_extension_package_enabled_at(&base, "absent", true).is_err());
src-tauri/src/extension_packages.rs:1395:        assert!(!base.join("extensions/absent").exists());
src-tauri/src/config.rs:380:            let _ = std::fs::rename(path, path.with_extension("json.bak"));
src-tauri/src/config.rs:557:    check_range("readerFontSize", config.reader_font_size, 8.0, 96.0)?;
src-tauri/src/config.rs:664:                context: "rouletteSectors".into(),
src-tauri/src/config.rs:672:                    context: "rouletteSectors".into(),
src-tauri/src/config.rs:678:                    context: "rouletteSectors".into(),
src-tauri/src/config.rs:729:                context: "htmlToolbarItems".into(),
src-tauri/src/config.rs:737:                    context: "htmlToolbarItems".into(),
src-tauri/src/config.rs:743:                    context: "htmlToolbarItems".into(),
src-tauri/src/config.rs:892:pub fn seed_skill_map(app: &AppHandle) {
src-tauri/src/config.rs:900:    if let Err(e) = atomic_write(&path, SKILL_MAP.as_bytes()) {
src-tauri/src/config.rs:905:const SKILL_MAP: &str = r#"# Biaoyue 配置地图
src-tauri/src/config.rs:927:| `readerFontSize` | 8–96 |
src-tauri/src/media_protocol.rs:37:    match path.extension().and_then(|e| e.to_str()) {
src-tauri/src/media_protocol.rs:231:        p.set_extension("mp4");
src-tauri/src/lib.rs:5:mod extension_packages;
src-tauri/src/lib.rs:6:mod extensions;
src-tauri/src/lib.rs:14:    delete_api_key, get_api_key, list_config_snapshots, list_extensions, list_system_fonts,
src-tauri/src/lib.rs:25:use extension_packages::{
src-tauri/src/lib.rs:26:    generate_extension_package, import_extension_package, list_extension_packages,
src-tauri/src/lib.rs:27:    package_extension_package, pick_extension_source, read_extension_skill,
src-tauri/src/lib.rs:28:    remove_extension_package, set_extension_package_enabled,
src-tauri/src/lib.rs:195:            config::seed_skill_map(app.handle());
src-tauri/src/lib.rs:225:            list_extensions,
src-tauri/src/lib.rs:226:            list_extension_packages,
src-tauri/src/lib.rs:227:            import_extension_package,
src-tauri/src/lib.rs:228:            set_extension_package_enabled,
src-tauri/src/lib.rs:229:            remove_extension_package,
src-tauri/src/lib.rs:230:            package_extension_package,
src-tauri/src/lib.rs:231:            pick_extension_source,
src-tauri/src/lib.rs:232:            generate_extension_package,
src-tauri/src/lib.rs:233:            read_extension_skill,
docs/MIGRATION-MAP.md:6:> - 数据来源（只读）：`.omo/evidence/ulw/clairis-doc-governance/task-1/baseline-manifest.json`（173 条目）与 `exclusion-ledger.json`。
docs/architecture/decisions/0011-scenario-shell-and-pane-tree.md:30:- 周边：扩展包（`extensions/<id>/{manifest.json, SKILL.md}`，`.disabled` 停用标记，AI 系统提示消费）与快捷键注册表（`src/lib/shortcuts.ts` 单一真相源）构成外壳的其余部分。
src/renderers/html.ts:188:  // Already absolute (starts with /) — treat as relative to filesystem root
src/renderers/markdown.ts:90:  extensions: [mathBlockExtension, mathInlineExtension],
src/renderers/math.ts:5:/** 公式渲染结果暂存区。marked 的 extension 是全局注册的，拿不到局部上下文；
src-tauri/gen/schemas/macOS-schema.json:40:      "description": "A grouping and boundary mechanism developers can use to isolate access to the IPC layer.\n\nIt controls application windows' and webviews' fine grained access to the Tauri core, application, or plugin commands. If a webview or its window is not matching any capability then it has no access to the IPC layer at all.\n\nThis can be done to create groups of windows, based on their required system access, which can reduce impact of frontend vulnerabilities in less privileged windows. Windows can be added to a capability by exact name (e.g. `main-window`) or glob patterns like `*` or `admin-*`. A Window can have none, one, or multiple associated capabilities.\n\n## Example\n\n```json { \"identifier\": \"main-user-files-write\", \"description\": \"This capability allows the `main` window on macOS and Windows access to `filesystem` write related commands and `dialog` commands to enable programmatic access to files selected by the user.\", \"windows\": [ \"main\" ], \"permissions\": [ \"core:default\", \"dialog:open\", { \"identifier\": \"fs:allow-write-text-file\", \"allow\": [{ \"path\": \"$HOME/test.txt\" }] }, ], \"platforms\": [\"macOS\",\"windows\"] } ```",
src-tauri/gen/schemas/macOS-schema.json:52:          "description": "Description of what the capability is intended to allow on associated windows.\n\nIt should contain a description of what the grouped permissions should allow.\n\n## Example\n\nThis capability allows the `main` window access to `filesystem` write related commands and `dialog` commands to enable programmatic access to files selected by the user.",
src-tauri/gen/schemas/desktop-schema.json:40:      "description": "A grouping and boundary mechanism developers can use to isolate access to the IPC layer.\n\nIt controls application windows' and webviews' fine grained access to the Tauri core, application, or plugin commands. If a webview or its window is not matching any capability then it has no access to the IPC layer at all.\n\nThis can be done to create groups of windows, based on their required system access, which can reduce impact of frontend vulnerabilities in less privileged windows. Windows can be added to a capability by exact name (e.g. `main-window`) or glob patterns like `*` or `admin-*`. A Window can have none, one, or multiple associated capabilities.\n\n## Example\n\n```json { \"identifier\": \"main-user-files-write\", \"description\": \"This capability allows the `main` window on macOS and Windows access to `filesystem` write related commands and `dialog` commands to enable programmatic access to files selected by the user.\", \"windows\": [ \"main\" ], \"permissions\": [ \"core:default\", \"dialog:open\", { \"identifier\": \"fs:allow-write-text-file\", \"allow\": [{ \"path\": \"$HOME/test.txt\" }] }, ], \"platforms\": [\"macOS\",\"windows\"] } ```",
src-tauri/gen/schemas/desktop-schema.json:52:          "description": "Description of what the capability is intended to allow on associated windows.\n\nIt should contain a description of what the grouped permissions should allow.\n\n## Example\n\nThis capability allows the `main` window access to `filesystem` write related commands and `dialog` commands to enable programmatic access to files selected by the user.",
src/App.tsx:44:import { loadExtensionBundle } from "./lib/extensions/bundle";
src/App.tsx:45:import type { ExtensionBundle } from "./lib/extensions/bundle";
src/App.tsx:49:} from "./lib/extensions/templates";
src/App.tsx:50:import type { Template } from "./lib/extensions/templates";
src/App.tsx:51:import { applyThemeTokens } from "./lib/extensions/theme-tokens";
src/App.tsx:190:          defaultDir: useEditorStore.getState().config.defaultSavePath ?? null,
src/App.tsx:358:      // 编辑态与阅读态共用一个字号：readerFontSize 驱动 --type-font-size，
src/App.tsx:365:      editorStore.setConfig({ readerFontSize: applied });
src/hooks/useConfig.ts:46:  readerFontSize: number | null;
src/hooks/useConfig.ts:49:  defaultSavePath?: string | null;
src/hooks/useConfig.ts:74:  rouletteSectors?: string[] | null;
src/hooks/useConfig.ts:79:  htmlToolbarItems?: string[] | null;
src/hooks/useConfig.ts:152:    readerFontSize: es.config.readerFontSize ?? null,
src/hooks/useConfig.ts:155:    defaultSavePath: es.config.defaultSavePath ?? null,
src/hooks/useConfig.ts:177:    rouletteSectors: es.config.rouletteSectors ?? null,
src/hooks/useConfig.ts:182:    htmlToolbarItems: es.config.htmlToolbarItems ?? null,
src/hooks/useConfig.ts:394:    readerFontSize: raw.readerFontSize ?? 17,
src/hooks/useConfig.ts:397:    defaultSavePath: raw.defaultSavePath ?? null,
src/hooks/useConfig.ts:420:    rouletteSectors: normalizeRouletteSectors(raw.rouletteSectors),
src/hooks/useConfig.ts:433:    htmlToolbarItems: normalizeHtmlToolbarItems(raw.htmlToolbarItems),
src/hooks/useConfig.ts:556:        readerFontSize: 17,
src/lib/mdpkg/vendor/mdpkg-web.d.ts:12:/** manifest v1.0，封闭 schema（additionalProperties: false）。 */
src/lib/mdpkg/vendor/mdpkg-web.d.ts:18:  extensions?: {
src/lib/mdpkg/vendor/mdpkg-web.d.ts:22:  extensions_required?: string[];
src/lib/mdpkg/vendor/mdpkg-web.d.ts:40:  manifest: Manifest | null;
src/lib/mdpkg/vendor/mdpkg-web.d.ts:47:  /** 包内没有 manifest.json。 */
src/lib/mdpkg/vendor/mdpkg-web.d.ts:77:  /** 是否输出符号（默认 true；manifest.extensions.symbols === "off" 时强制关闭）。 */
src/lib/mdpkg/vendor/mdpkg-web.d.ts:97:/** Zip 导出（buildZipExport 别名）：包 → 标准 zip 交付物（include 展开、无 manifest.json、附 README.md） */
src/lib/extensions/bundle.ts:1:/* 扩展 bundle：一次 `list_extensions` 调用拿回 templates + theme tokens + warnings。
src/lib/extensions/bundle.ts:3: * 与 `src/editors/user-extensions.ts` 的 `loadUserExtensions` 并存（后者把
src/lib/extensions/bundle.ts:6: * （`list_extensions` 在纯浏览器/老版本里不存在）。
src/lib/extensions/bundle.ts:10:import type { UserSnippet } from "../../editors/user-extensions";
src/lib/extensions/bundle.ts:11:import { extractSnippets } from "../../editors/user-extensions";
src/lib/extensions/bundle.ts:19:/** 一次 `list_extensions` 调用解析出的三类扩展数据（snippets 供斜杠菜单）。 */
src/lib/extensions/bundle.ts:40:/** 从 `list_extensions` 返回值里取模板；形状不对返回空列表。 */
src/lib/extensions/bundle.ts:75:/** 把 `list_extensions` 返回值映射成 bundle；形状不对的字段各自降级。 */
src/lib/extensions/bundle.ts:85: * 调一次 `list_extensions` 并解析成 bundle。
src/lib/extensions/bundle.ts:92:    const result = await invokeFn("list_extensions");
src/lib/extensions/bundle.ts:100: * 调一次 `list_extensions`，解析 snippets / templates / theme tokens 三类。
src/lib/extensions/bundle.ts:107:    const result = await invokeFn("list_extensions");
src/lib/extensions/theme-tokens.ts:3: * `theme.toml` 的 `[tokens]` 经 IPC 传到前端后**再校验一遍**（不信任 IPC 输入）：
src/lib/extensions/theme-tokens.ts:38: * 把 `theme.toml` 里的键规范化成 `--app-<name>`。
src/__tests__/useAiEntry.test.ts:24:    readerFontSize: 17,
src/lib/extensions/templates.ts:3: * `list_extensions` 返回的 `templates[]` 元素形状；正文里的占位符仅两个：
src/lib/mdpkg/index.ts:8://   4. 打包：manifest 必须满足封闭 schema，额外字段直接拒绝并报出字段名。
src/lib/mdpkg/index.ts:23:/** manifest v1.0 允许的顶层字段（封闭 schema，见 vendor 内 manifest-1.0.json）。 */
src/lib/mdpkg/index.ts:29:  "extensions",
src/lib/mdpkg/index.ts:30:  "extensions_required",
src/lib/mdpkg/index.ts:68:/** 打包 .mdpkg：files 为包内文件（不含 manifest.json），manifest 须满足封闭 schema。 */
src/lib/mdpkg/index.ts:71:  manifest: Manifest,
src/lib/mdpkg/index.ts:73:  if (manifest === null || typeof manifest !== "object") {
src/lib/mdpkg/index.ts:74:    throw new Error("manifest 必须是对象");
src/lib/mdpkg/index.ts:76:  const extra = Object.keys(manifest).filter(
src/lib/mdpkg/index.ts:80:    throw new Error(`manifest 含 schema 之外的字段: ${extra.join(", ")}`);
src/lib/mdpkg/index.ts:82:  return packMdpkg(files, manifest);
src/types/index.ts:69:  readerFontSize: number;
src/types/index.ts:73:  defaultSavePath?: string | null;
src/types/index.ts:75:  selectionToolbar?: "roulette" | "capsule";
src/types/index.ts:104:  rouletteSectors?: string[] | null;
src/types/index.ts:114:  htmlToolbarItems?: string[] | null;
src/__tests__/editor/blockModel.test.ts:17:  return EditorState.create({ doc, extensions: [markdown()] });
src/__tests__/editor/blockModel.test.ts:186:    // Table is a GFM extension — without the Table extension enabled,
docs/architecture/overview.md:91:- **形态**：`<config_base>/extensions/<id>/{manifest.json, SKILL.md}`；可选 `.disabled` 标记文件表示停用（不改用户目录结构，只加标记）。
docs/architecture/overview.md:92:- **管理**：`src-tauri/src/extension_packages.rs` 提供列表/导入/启用开关/卸载/导出；`list_extension_packages` / `import_extension_package` / `set_extension_package_enabled` / `remove_extension_package` / `package_extension_package` / `read_extension_skill` 命令在 `src-tauri/src/lib.rs` 注册。
docs/architecture/overview.md:94:- **前端**：设置·扩展区（`src/components/SettingsView.tsx`）列表/导入/开关/卸载/导出/AI 生成；`src/lib/extensions/bundle.ts` 读取 snippets/templates/theme tokens（另一套数据文件扩展点，见 extensions 域）。
docs/architecture/overview.md:98:`src/lib/shortcuts.ts` 是快捷键的**唯一真相源**：`SHORTCUTS` 数组（id / keys / label / family / core / decision / implemented），驱动四处消费：
docs/design/approved/selection-roulette/HANDOFF.md:45:| `src/editors/setup.ts:24,54` | 挂载点不变（`floatingToolbar()` 仍作为 extension 返回） |
docs/design/approved/selection-roulette/HANDOFF.md:46:| `src/styles/editor.css`（`.cm-floating-toolbar` 段，约 2145 行起） | 换成轮盘样式；**每个新 `cm-*` 类必须在这里有规则**，否则 `scripts/css-manifest-check.sh` 失败（pre-commit 会跑） |
docs/design/approved/selection-roulette/HANDOFF.md:55:3. **CSS manifest**：`src/editors/` 下声明的 `cm-*` 类必须在 `src/styles/` 有规则（`bash scripts/css-manifest-check.sh`）。
docs/design/approved/selection-roulette/HANDOFF.md:58:6. **交付前**：`bash scripts/verify.sh`（tsc → eslint → vitest → CSS manifest → cargo check → 两套 Playwright）全绿才算完。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:5:> 事实基线：`src-tauri/src/extensions.rs`、`src/lib/capabilities.ts`、`src/ui/settings/SettingsView.tsx`、`src-tauri/src/commands/ai_agent.rs`、`docs/research/technical/data-fileization-omarchy-inventory.md`、`docs/agents/data-surface.md`
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:18:| **注册型插件** | 注册数据（manifest + JSON） | 加载时解析注册表 | 结构可增删、需校验的能力 |
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:21:**术语统一**：目录名与文档统一用 **plugin**（不复用既有「extension」术语，避免混淆）。插件目录定为 `data/plugins/`（独立于 `user/`，用户层）。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:31:| A1 | **扩展包** | 已文件化的扩展目录（含 manifest）。**注意**：manifest 字段名在文档/示例/代码间不一致，加载管线是同步一次性加载、无热重载 | 注册型 | ✅ 已存在，需收尾（见 P1） |
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:32:| A2 | **技能映射** | `SKILL_MAP`（`config.rs:977-1031` `seed_skill_map`）已把 AGENT 能力声明化（SKILL_MD 注入 AGENT 上下文） | 技能型 | ✅ 已落地 |
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:33:| A3 | **主题覆盖** | `theme.toml` 白名单覆盖，**仅颜色 token，无装饰主题切换**。无 `themeProvider` 结构、无历史逻辑 | 配置型 | ✅ 已落地，扩展面有限（见 A3 边界） |
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:41:| B1 | **胶囊工具条** | 胶囊按钮集是代码常量；`selectionToolbar: "roulette"|"capsule"` 切换已存在 | 配置型 | AGENT 配置胶囊按钮集 |
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:42:| B2 | **轮盘扇区** | `rouletteSectors` **已文件化在 `settings.json`**（`config.rs:65`），设置页有勾选 UI。默认集合 `ROOT_SECTORS` 是常量 | 配置型 | AGENT 自定义扇区（默认集合可插件化） |
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:43:| B3 | **工具条按钮** | `htmlToolbarItems` **已文件化在 `settings.json`**（`config.rs:68`），设置页可编辑 | 配置型 | AGENT 自定义工具条按钮（已落地，仅需统一纳入插件体系） |
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:46:| B6 | **键位绑定** | `keybindings.ts` + `shortcuts.ts`（`SHORTCUTS` 常量表），`ShortcutDef` 已带 `scope` 结构 | 配置型 | AGENT 重映射键位（**依赖按键分发层重接线，见第 3 项 §4.4**） |
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:48:| B8 | **阅读预设** | `readerFontSize` 数值型，无预设集合 | 配置型 | AGENT 增加阅读预设 |
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:49:| B9 | **新建文档默认** | `defaultNewDocFormat` 不存在，相近 `defaultSavePath` | 配置型 | AGENT 自定义新文档模板 |
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:70:    manifest.json                 插件声明（字段名统一，见 §4.2）
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:75:### 4.2 manifest 字段统一（修正 P1）
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:77:**现状**：manifest 字段名在文档/示例/代码间不一致（`id`/`name`/`version` 等字段各文档写法不同）。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:79:**设计**：统一 manifest 字段为：
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:81:- 注册型插件增补 `permissions`（声明所需权限，如 `filesystem`）
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:83:**权限声明（修正 P1 遗漏）**：扩展包内 JSON 当前**缺 `filesystem` 权限声明**（需在 `env.toml` 声明）。manifest 的 `permissions` 字段补上，加载时校验声明的权限是否在白名单内。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:87:**现状（校正）**：`extensions.rs` 是**同步一次性加载**，无热重载。方案原称的「加载期巡检、容错、热加载」与实际不符。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:90:- **加载**：启动时同步扫描 `data/plugins/`，逐插件读 manifest、校验权限、解析数据 → 映射到配置/注册表/AGENT 上下文。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:96:**现状（校正）**：`seed_skill_map` 已把 SKILL_MD 注入 AGENT 上下文，但方案此前未设计**注入面的拼装与边界**。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:99:- **注入拼装**：AGENT 上下文构建时，聚合所有已启用技能型插件的 SKILL.md 内容（+ 内置 SKILL_MAP），拼装为 AGENT 的能力声明。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:101:- **可见性**：与第 2 项 §5.5 的 SKILL_MAP 载体统一——插件体系管「哪些插件贡献 SKILL.md」，数据文件体系管「字段配置」，两者在技能型插件上协同。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:122:- **加载期校验**：manifest 字段校验 + 权限白名单校验（§4.2/§4.3）。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:130:1. **第一批（收尾既有插件形态）**：A1 扩展包 manifest 字段统一 + 权限声明补全；A2/A4 消费方分两类显式区分；B2/B3 统一纳入插件体系登记。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:144:2. **P1 引用参数不准**：manifest 字段名不一致；扩展包 JSON 缺 filesystem 权限声明；THEME_EXTRA 清单与实际白名单不符；三段式 split 与 extensions.rs 实际不符 → 已采纳，§4.2 统一字段、§4.2 补权限声明、§4.3 加载管线按同步加载校正、A3 边界补「无主题切换结构」。
src/__tests__/editor/roulette.test.ts:16:  ROOT_SECTORS,
src/__tests__/editor/roulette.test.ts:44:    expect(ROOT_SECTORS).toHaveLength(8);
src/__tests__/editor/roulette.test.ts:45:    expect(ROOT_SECTORS.map((s) => s.angle)).toEqual([
src/__tests__/editor/roulette.test.ts:48:    expect(ROOT_SECTORS[0].id).toBe("smart");
src/__tests__/editor/roulette.test.ts:49:    expect(ROOT_SECTORS[7].id).toBe("color");
src/__tests__/exportMdpkg.test.ts:73:    expect(ok.manifest?.format).toBe("mdpkg");
src/__tests__/exportMdpkg.test.ts:74:    expect(ok.manifest?.spec_version.startsWith("1.")).toBe(true);
src/__tests__/exportMdpkg.test.ts:100:    expect(ok.manifest?.resources.map((r) => r.path).sort()).toEqual([
src/__tests__/exportMdpkg.test.ts:104:    expect(Object.keys(ok.manifest ?? {})).not.toContain("generator");
src/__tests__/editor/decorations-blocks.test.ts:98:        extensions: [markdown(), editorDecorations(options)],
src/__tests__/editor/decorations-blocks.test.ts:388:    it("renders a video player for a video extension", () => {
src/__tests__/editor/decorations-blocks.test.ts:426:    it("renders a file link card for a non-image, non-video extension", () => {
src/__tests__/editor/decorations-blocks.test.ts:450:    it("classifies media by extension, mirroring the preview renderer", () => {
src/__tests__/editor/decorations-blocks.test.ts:457:      expect(classifyMedia("no-extension")).toBe("image");
src/editors/slash.ts:427:// 用户片段命令（来自 `list_extensions`）。宿主在编辑器创建后加载一次并注册；
src/__tests__/editor/callout-insert.test.ts:73:        extensions: [markdown(), editorDecorations()],
src/__tests__/useConfig.webFallback.test.tsx:36:    expect(es.config.readerFontSize).toBe(17);
docs/research/technical/data-fileization-omarchy-inventory.md:12:> **依据**：`docs/research/technical/plugin-management-benchmark.md`（Omarchy「扩展点 = 数据文件」对标）、已归档 change `2026-11-01-text-config-layer` 与 `2026-11-03-extension-points` 的 design.md、已归档 change `layout-portal`（[#170](https://github.com/jianxi-dev/clairis/issues/170)）的 design.md D11、ADR 0004/0005。
docs/research/technical/data-fileization-omarchy-inventory.md:14:> **勘误（2026-11-10）**：本文 11-04 版有三处与代码不符，已就地更正——①`user/views/{rail,grid,preview}.json` **从未实现**：`layout-portal` D11 未按独立文件落地，视图规格实际合并进 `user/settings.json` 的 `railViewSpec` / `previewSettings` / `aiViewSpec` / `paneLayout` 四字段（现状见 `docs/architecture/overview.md` §7；`grep -rn "user/views" src-tauri/src` 零命中）；②扩展管理面已落地（`src-tauri/src/extension_packages.rs`，[#184](https://github.com/jianxi-dev/clairis/issues/184) 已关闭）；③扩展点根目录是 `app_config_dir()`——macOS `~/Library/Application Support/dev.biaoyue.app/`、Linux `~/.config/dev.biaoyue.app/`，文中 `~/.config/clairis/` 为旧标识符写法。数据面现行判据已升级为 `docs/agents/data-surface.md`（六栏落点 + 机检），本文 §3.2 保留为历史推理。
docs/research/technical/data-fileization-omarchy-inventory.md:20:Omarchy 的核心借鉴是：**扩展点 = 数据文件，不执行用户代码**（benchmark 建议 2 → extension-points change 前提 D6）；加上**所有权三分**目录约定（benchmark 建议 4）。落地分两批：
docs/research/technical/data-fileization-omarchy-inventory.md:41:### 1.2 扩展点 = 数据文件（extension-points，2026-11-03 归档，已实现）
docs/research/technical/data-fileization-omarchy-inventory.md:49:| theme tokens（主题覆盖） | `app_config_dir()/theme.toml` | `[tokens]` + 仅颜色值 | 白名单：只接受已声明 `--app-*` 键；未知键忽略并聚合告警；删文件即恢复默认 |
docs/research/technical/data-fileization-omarchy-inventory.md:62:| 扩展点 P0 | `2026-11-03-extension-points`（[#76](https://github.com/jianxi-dev/clairis/issues/76)/[#78](https://github.com/jianxi-dev/clairis/issues/78)） | snippets / templates / theme.toml / 能力开关 | ✅ 已归档（4/4 票，票未关需收尾） |
docs/research/technical/data-fileization-omarchy-inventory.md:64:| 扩展管理面 | `layout-portal` [#184](https://github.com/jianxi-dev/clairis/issues/184)（已关闭） | 文件夹式扩展（manifest.json + SKILL.md）、拖入即启用、AI 生成、导出 | ✅ 已落地（`src-tauri/src/extension_packages.rs`） |
docs/research/technical/data-fileization-omarchy-inventory.md:107:| 5 | 主题 token 覆盖 | `app_config_dir()/theme.toml` | ✅ 已落地 | 直接写文件（白名单容错） |
docs/research/technical/data-fileization-omarchy-inventory.md:112:| 10 | 扩展包（manifest.json + SKILL.md） | `app_config_dir()/extensions/<id>/` | ✅ 已落地 | AI 一句话生成新扩展（默认启用）+ 直接编辑 SKILL.md |
docs/research/technical/data-fileization-omarchy-inventory.md:122:- **实现骨架已经就位**：三层目录（defaults / user / 运行时）+ 原子写 + 快照回滚 + 热应用轮询，是 Omarchy「扩展点 = 数据文件」在本仓库的落地底座；snippets/templates/theme.toml 三个扩展点已可用（「放一个文件就生效」）。
src/__tests__/useConfig.hotApply.test.ts:29:    readerFontSize: 17,
src/editors/decorations/theme.ts:5: * （可被 CSS manifest 检查），这里只补两条 CSS 表达不了的东西：
src/editors/decorations/theme.ts:12: * （可被 CSS manifest 检查）；本文件只保留 CSS 表达不了的两条 baseTheme。
src/__tests__/mdpkg.test.ts:1:// mdpkg 读写层：任何硬错误都必须收敛成 { error }，绝不抛出；打包往返一致、manifest 封闭。
src/__tests__/mdpkg.test.ts:74:    const manifest = buildManifest(files);
src/__tests__/mdpkg.test.ts:75:    const packed = packPackage(files, manifest);
src/__tests__/mdpkg.test.ts:86:    expect(result.manifest?.resources.map((r) => r.path)).toEqual([
src/__tests__/mdpkg.test.ts:91:  it("manifest 含 schema 之外的字段时打包失败并报出字段名", () => {
src/__tests__/mdpkg.test.ts:93:    const manifest = {
src/__tests__/mdpkg.test.ts:97:    expect(() => packPackage(files, manifest)).toThrow(/signature/);
docs/research/technical/plugin-management-benchmark.md:25:**插件形态**：就是一个导出 `apply(ctx)` 的 TypeScript 模块（函数/对象/Service 类三种形式）。**没有传统 manifest 文件**——本地插件通过 `cordis.yml` patch（覆盖层）注册绝对路径，`pnpm dsh web --patch ./cordis.yml` 加载。
docs/research/technical/plugin-management-benchmark.md:31:- **形态**：TS/JS 模块（`jiti` 免编译加载），单文件 / 目录（`index.ts`）/ npm 包（`package.json` 里 `pi.extensions` 字段）三种。
docs/research/technical/plugin-management-benchmark.md:32:- **两级位置**：全局 `~/.pi/agent/extensions/`，项目级 `.pi/extensions/`（**需项目信任后才加载**）。另有 `settings.json` 的 `packages` 数组支持 `npm:` / `git:` / `builtin:` 协议分发。
docs/research/technical/plugin-management-benchmark.md:40:- **社区插件**：每个插件是 vault 内 `.obsidian/plugins/<id>/` 目录（`manifest.json` + `main.js` + 可选 `styles.css` + `data.json` 存设置）。
docs/research/technical/plugin-management-benchmark.md:41:  - manifest：`id/name/author/version/minAppVersion/description`（封闭 schema）。
docs/research/technical/plugin-management-benchmark.md:63:| 插件形态 | `apply(ctx)` TS 模块 | TS/JS 模块（文件/目录/npm 包） | manifest+main.js 目录包 | 数据文件（jsonc/toml/目录约定） |
docs/research/technical/plugin-management-benchmark.md:83:- **无面向用户的插件系统**。代码中 `plugin/extension` 全部是编辑器内部实现（CM6 extensions、slash 菜单、marked math extension）。
docs/research/technical/plugin-management-benchmark.md:84:- **最接近"插件"的既有机制**是 mdpkg（Markdown 打包格式）：`manifest.extensions.symbols`（`off|core|extended`）与 `extensions_required`（封闭 schema，不支持项报错 E702）——这是**文档级**的能力声明，不是应用级插件。
docs/research/technical/plugin-management-benchmark.md:109:- 形态：TS 模块 + `manifest.json`（封闭 schema：`id/name/version/minAppVersion`），目录 `~/.clairis/plugins/<id>/`；生命周期 `onload()/onunload()`，注册项统一 tracked、卸载自动清理（学 Cordis 的 effect 追踪思想，不必引框架）。
docs/research/technical/plugin-management-benchmark.md:128:| P1 | manifest + onload/onunload + 信任门，支持本地目录安装 | Pi 形态 + Obsidian 安全 |
docs/design/pluginization-datafile-settings-rail/03-settings-page-optimization.md:112:**当前状态：可重映射是空谈，需标注依赖**。`SHORTCUTS` 是编译期 TS 常量，**按键行为由 `App.tsx` 硬编码分发**（`App.tsx:423-780` 全是 `e.key` 判断，未消费 SHORTCUTS）。即使第 1 项 B1「键位数据文件化」完成，**不把 `App.tsx` 的按键分发改成读数据文件，重映射永不生效**。
docs/design/pluginization-datafile-settings-rail/03-settings-page-optimization.md:118:| **可重映射** | 有键位绑定的应用级快捷键（`SHORTCUTS` 中已实现条目） | **依赖第 1 项 B1**：键位数据文件化必须同时重接线 `App.tsx` 按键分发，否则重映射不生效。重映射流程：记录新键位 → 写入键位数据文件 → **分发层读文件重接线** → 生效。现成参考：`rouletteHotkey` 配置项（`SettingsView.tsx` 的 `commitRouletteHotkey`）是当前唯一可重映射原型 |
docs/design/pluginization-datafile-settings-rail/03-settings-page-optimization.md:126:方案原称「四处同源消费」名不副实：真正 import `shortcuts.ts` 的只有 `SettingsView.tsx`、`ShortcutOverlay.tsx`（展示）及 `SuggestMenu.tsx`/`SearchReplacePanel.tsx`（`activateLocalContext`）。**按键分发未消费 SHORTCUTS**，`TooltipLayer.tsx` 键位是独立硬编码表。这是漂移隐患，应在实现时让按键分发与 tooltip 统一消费 SHORTCUTS，而非维持现状。
docs/design/pluginization-datafile-settings-rail/03-settings-page-optimization.md:188:- 快捷键展示以 `shortcuts.ts` 为唯一真相源，不在设置页另写一份键位；按键分发与 tooltip 应统一消费 SHORTCUTS（实现时处理，消除漂移）。
docs/design/pluginization-datafile-settings-rail/03-settings-page-optimization.md:201:3. **按键分发未消费 SHORTCUTS、TooltipLayer 独立硬编码** → 已采纳，§4.5 补同源真相与漂移隐患。
docs/research/technical/workbuddy-html-visual-editing-逆向报告.md:208:- **CSS manifest 检查**：新增 `cm-*` decoration class 必须在 `src/styles/` 有对应 CSS 规则；
src/__tests__/editor/testEditor.ts:24:  const extensions = [
src/__tests__/editor/testEditor.ts:33:    state: EditorState.create({ doc, extensions }),
src/__tests__/editors/setup.test.ts:13:    it("returns an array of extensions", () => {
src/__tests__/editors/setup.test.ts:20:    it("returns an array of extensions", () => {
src/__tests__/editors/setup.test.ts:26:    it("includes basic setup and markdown language extensions", () => {
src/__tests__/editors/setup.test.ts:28:      // Should include extensions for basic editing and markdown
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:5:> 事实基线（已校正）：`src-tauri/src/config.rs`、`src-tauri/src/commands/config_cmd.rs`、`src-tauri/src/commands/capture.rs`、`src-tauri/src/extensions.rs`、`src/hooks/useConfig.ts`、`src/stores/index.ts`、`src/stores/editorStore.ts`、`src/lib/capabilities.ts`、`docs/research/technical/data-fileization-omarchy-inventory.md`
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:20:- **用户层目录是 AGENT 写入口**：`user/` 是核心写入口，扩展点目录（snippets/templates/theme.toml）也在用户层，但不在 `user/` 子目录下——边界表述按此校正。
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:33:| `snippets/*.md`、`templates/*.md`、`theme.toml` | 扩展点数据文件 | 位于 `app_config_dir()` 根，用户层 |
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:49:| 阅读设置 | `readerFontSize`（数值，校验 8–96）、`readerWidth`、`readerSkin` | 阅读区 | ✅ 已落地（注：无 `reader.font` 字体族、`lineHeight`、`mode` 字段） |
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:54:| 主题覆盖 | `theme.toml`（白名单 13 个 `--app-*` token，是 `tokens.css` 17 个的子集） | 主题注入 | ✅ 已落地 |
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:56:| **轮盘扇区** | `rouletteSectors`（`config.rs:65`，设置页有勾选 UI，`floating-toolbar.ts:715` + `useConfig.ts:440` 消费；默认集合 `ROOT_SECTORS` 是常量） | 轮盘 | ✅ **已文件化**（原误判为 B 档） |
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:57:| **工具条按钮** | `htmlToolbarItems`（`config.rs:68`，设置页可编辑，`slots.ts:resolveToolbarOrder` 消费） | 水平工具条 | ✅ **已文件化**（原误判为 B 档） |
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:64:| B1 | **键位绑定** | `keybindings.ts`（86 行）+ `shortcuts.ts`（573 行，`SHORTCUTS` 常量表，`ShortcutDef` 已带 `scope: global/local` 结构） | `user/keybindings.json`：按键 → 命令映射，支持全局/局部作用域、禁用、重映射 | 改键位文件即重映射；**依赖按键分发层重接线（见第 3 项 §4.4）** |
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:66:| B5 | **胶囊工具条** | 胶囊按钮集是代码常量（`capsule-toolbar.ts`）；`selectionToolbar: "roulette"|"capsule"` 切换已存在 | `user/capsules.json` | AGENT 配置胶囊按钮（注：`slots` 即 B4 已文件化的 HTML 工具条，两者不可混为一谈） |
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:70:| B9 | **阅读预设** | `readerFontSize` 是数值型（非字体族字符串），无预设集合 | `user/reader-presets.json`：字号/宽度/皮肤预设集合 | AGENT 增加阅读预设，一键切换 |
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:71:| B10 | **新建文档默认** | `defaultNewDocFormat` 不存在；相近字段是 `defaultSavePath` | `user/newdoc.json`：默认保存路径、默认模板、默认 frontmatter | AGENT 自定义新文档模板与默认路径 |
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:97:  reader-presets.json         阅读预设（B9）
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:102:app_config_dir 根：snippets/ templates/ theme.toml   扩展点（用户层，不在 user/ 子目录）
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:113:| **map 型** | `keybindings.json`、`icons.json` | **逐键深合并**（键是命令 id / 概念名，天然支持逐键覆盖） | `merge_json` 现状语义；`ShortcutDef` 已是 id 键控结构 |
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:130:- 每个 B 档文件规定**加载端契约**：加载失败/非法时的语义——**回退默认 + 聚合告警**（对齐 `theme.toml` 的白名单过滤纪律）。
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:149:**AGENT 可见性载体**：`SKILL_MAP`（`config.rs:977-1031`，`seed_skill_map`）是既有 AGENT 可见性载体。清单登记 + AGENT 可见性落在 SKILL_MAP，让 AGENT 知道有哪些文件可改、字段含义。
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:206:11. **AGENT 通路断裂、SKILL_MAP 未点名** → 已采纳，§5.5 补齐。
src/editors/decorations/index.ts:328:    compositionGuard.extension,
src/editors/decorations/index.ts:329:    tableFlush.extension,
src/__tests__/editor/callout-title-edit.test.ts:63:        extensions: [markdown(), editorDecorations()],
docs/archive/2026/legacy-docs/QUALITY-STANDARDS.md:193:     ╱   CSS Manifest           ╲   css-manifest-check.sh
docs/archive/2026/legacy-docs/QUALITY-STANDARDS.md:200:| CSS 完整性 | `css-manifest-check.sh` | — | 9 TS 声明 ↔ CSS 定义 |
docs/archive/2026/legacy-docs/QUALITY-STANDARDS.md:236:bash scripts/css-manifest-check.sh   # CSS 清单对照
docs/archive/2026/legacy-docs/QUALITY-STANDARDS.md:269:[ ] CSS 完整性: css-manifest-check.sh PASS
src/__tests__/types.test.ts:31:      readerFontSize: 17,
src/__tests__/editors/decorations/fold.test.ts:15:    extensions: [markdown(), editorDecorations()],
docs/design/approved/layout-portal/spec.md:208:- **形态**：文件夹（`manifest.json` + `SKILL.md`），可打包传播
docs/archive/2026/legacy-docs/ARCHITECTURE.md:213:使用 CM6 `Compartment` 控制 decoration extensions 的启用/禁用:
src/__tests__/editors/decorations/composition.test.ts:10:    it("returns an extension-compatible result shape", () => {
src/__tests__/editors/decorations/composition.test.ts:11:      // The filter should be usable as an EditorState extension
docs/design/pluginization-datafile-settings-rail/04-document-discovery-and-plugin-display.md:111:**「第 1 项会提取出较多插件」不成立**：01 号文档 A 档用户可见插件仅 4 项（片段/模板/theme.toml/SKILL.md 包），B 档目前还是代码常量、需另立批次文件化。展示策略不建立在「插件很多」的夸大前提上。
docs/archive/2026/legacy-docs/DEVEX-REVIEW.md:41:| `scripts/css-manifest-check.sh` | 自动化 CSS class ↔ 定义对照 |
docs/archive/2026/legacy-docs/DEVEX-REVIEW.md:86:  bash scripts/css-manifest-check.sh
docs/archive/2026/legacy-docs/DEVEX-REVIEW.md:100:     ╱   CSS Manifest           ╲   css-manifest-check.sh
docs/archive/2026/legacy-docs/DEVEX-REVIEW.md:208:| P0-1 | **安装 husky + 配置 pre-commit** | 0.5h | `husky init → pre-commit: npx lint-staged && bash scripts/css-manifest-check.sh` |
src/components/Preview/FloatingPreview.tsx:262:        extensions: [
src/__tests__/editor/structural-tags-decorations.test.ts:83:        extensions: [markdown(), editorDecorations()],
docs/archive/2026/legacy-requirements/渐晰Markdown 阅读编辑器 会话移交文档.md:46:│   ├── extensions/
docs/design/approved/reader-typography/spec.md:281:- **集成**：自写 marked extension（block + inline 各一个，约 40 行），在 tokenizer 阶段吃掉公式原文，**避免 markdown 把 `_`、`^`、`\\` 当转义处理**。
docs/design/approved/reader-typography/spec.md:313:- **存储**：扩展 `AppConfig`（Rust `struct AppConfig` + 前端 `RustAppConfig`）三个可选字段：`readerFontSize`、`readerWidth`、`readerSkin`；走现有 `load_config` / `save_config` 通道，缺省回落到默认值，老配置无感升级。
docs/design/approved/reader-typography/spec.md:326:| 4 | 新增 `src/renderers/math.ts` | KaTeX marked extension + 占位符 + sanitize 后回填 | `katex` |
src/components/TemplatePicker.tsx:3:import type { Template } from "../lib/extensions/templates";
docs/agents/evidence-capture.md:110:**产出**：`evidence.mp4`（带标注烧录）+ `report.md`（测试摘要）+ `manifest.json`（环境元数据）。
docs/agents/evidence-capture.md:212:约定不变：骨架只负责「产生截图 + 断言 + 写 state-coverage.json」，判据（≥4 态、PNG 不入库、manifest 入库）以本节为准。参考实现会随消费仓演进，**以消费仓当时的实现为准**，本附录不追踪其版本。
docs/agents/evidence-capture.md:504:# 证据 manifest（ui-surface 票；≥4 态）
docs/design/system/governance.md:280:`ai-agent`、`ai-entry`、`app-identity`、`application-shell`、`brand-narrative`、`capture`、`configuration`、`diagram-rendering`、`docs-governance`、`editing`、`export`、`extensions`、`file-management`、`mdpkg`、`navigation`、`pr-automation`、`reading`。
docs/agents/incident-uncommitted-work-loss.md:211:.recovery/<timestamp>/manifest.txt
docs/agents/incident-uncommitted-work-loss.md:278:- 给恢复工具增加 `--dry-run`、`--target`、`--manifest` 和冲突报告能力。
docs/agents/incident-uncommitted-work-loss.md:284:- 在每个 wave 结束时自动生成：源码 patch、文件 manifest、测试结果、snapshot 标识。
docs/agents/incident-uncommitted-work-loss.md:285:- 将工作区状态、计划状态、Git 状态和 Agent 会话 ID 写入一份恢复 manifest。
src/__tests__/editor/roulette-commands.test.ts:67:      state: EditorState.create({ doc: "x", extensions: [floatingToolbar()] }),
docs/agents/data-surface.md:10:> 本文是**本仓自有规范**，不在 change-workflow 工具包的受管清单内（`.change-workflow.manifest`），升级不会覆盖。上游演进路径见文末。
docs/agents/data-surface.md:16:仓库已经有三层配置底座（defaults / user / state + 快照 + 热应用）、三个文件型扩展点（snippets / templates / theme.toml）和一条 AI 受控写通路（`patch_config`）。缺的不是机制，是**判断某次改动该不该走这条通路、以及走了之后怎么证明真落地**。
docs/agents/data-surface.md:32:src-tauri/src/extensions.rs                 文件型扩展点扫描
docs/agents/data-surface.md:33:src/lib/extensions/                         theme.toml / bundle 桥接
docs/agents/data-surface.md:145:- 上游合入后，本文件改为受管版本（进 manifest），本仓只保留 `DATA_SURFACE_*` 的具体值。
docs/agents/data-surface.md:147:在此之前**不要**把本文或脚本登记为 LOCAL：新增文件不在 manifest 内，升级天然不触碰；一旦登记 LOCAL，反而会遮蔽上游同名文件的到货告警。
docs/agents/quality-gates.md:537:   | 证据 manifest（ui-surface 票） | 零产物（如消费仓 #327–#336）/ 散文冒充证据 |
src/components/Content/PdfViewer.tsx:462:          stamp: { defaultLibrary: false, manifests: [] },
src/editors/decorations/image.ts:53:function extensionOf(path: string): string {
src/editors/decorations/image.ts:66:  const ext = extensionOf(path);
src/editors/setup.ts:104:/** Common base extensions shared by all file kinds */
src/editors/setup.ts:151: * Create editor extensions based on file kind.
src/editors/setup.ts:173:      return base; // Plain text, no language extension
src/components/Content/ContentArea.tsx:56:import { loadUserExtensions } from "../../editors/user-extensions";
src/components/Content/ContentArea.tsx:448:  const readerFontSize = useEditorStore((s) => s.config.readerFontSize);
src/components/Content/ContentArea.tsx:465:    if (readerFontSize) vars["--type-font-size"] = `${readerFontSize}px`;
src/components/Content/ContentArea.tsx:471:  }, [headingColors, headingFonts, readerFontSize, readerWidth]);
src/components/Content/ContentArea.tsx:567:      extensions: [
src/components/Content/ContentArea.tsx:609:    // 纯内置命令（`list_extensions` 在纯浏览器/老版本里不存在）。
src/editors/decorations/fileEmbed.ts:71:function extensionOf(path: string): string {
src/editors/decorations/fileEmbed.ts:92:    const ext = extensionOf(clean);
src/editors/decorations/fileEmbed.ts:103:  const ext = extensionOf(clean);
src/editors/user-extensions.ts:3: * Rust 侧 `list_extensions` 返回的 `ExtensionsSnapshot` 里，`snippets` 是
src/editors/user-extensions.ts:7: * 模板与主题 token 的前端接入见 `src/lib/extensions/`（bundle / templates /
src/editors/user-extensions.ts:11: * 不抛错、不打 error 级日志（`list_extensions` 在纯浏览器/老版本里不存在）。
src/editors/user-extensions.ts:16:/** 用户片段的原始形状（`list_extensions` 的 `snippets[]` 元素）。 */
src/editors/user-extensions.ts:87:/** 从 `list_extensions` 返回值里取 snippets；形状不对返回空列表。 */
src/editors/user-extensions.ts:101: * 调 `list_extensions` 并把 `snippets` 映射成斜杠命令。
src/editors/user-extensions.ts:109:    const result = await invokeFn("list_extensions");
src/components/Content/PreviewView.tsx:140:  const readerFontSize = useEditorStore((s) => s.config.readerFontSize);
src/components/Content/PreviewView.tsx:170:    if (readerFontSize) vars["--type-font-size"] = `${readerFontSize}px`;
src/components/Content/PreviewView.tsx:177:  }, [readerFontSize, readerWidth]);
src/editors/decorations/math.ts:9: * widget 不加 `cm-*` class：CSS manifest 门禁要求每个 cm-* class 在
src/editors/orchestration/roulette.ts:65:export const ROOT_SECTORS: readonly RootSector[] = [
src/editors/orchestration/floating-toolbar.ts:37:  ROOT_SECTORS,
src/editors/orchestration/floating-toolbar.ts:691:      const mode = useEditorStore.getState().config.selectionToolbar;
src/editors/orchestration/floating-toolbar.ts:715:      const configured = useEditorStore.getState().config.rouletteSectors;
src/editors/orchestration/floating-toolbar.ts:718:        ROOT_SECTORS.some((sector) => sector.id === id),
src/editors/orchestration/floating-toolbar.ts:776:        if (useEditorStore.getState().config.selectionToolbar !== "capsule") {
src/__tests__/editor/smartInput.test.ts:514:describe("smartInput extension", () => {
src/__tests__/editor/smartInput.test.ts:515:  it("returns an array of extensions", () => {
src/__tests__/editor/smartInput.test.ts:585:        extensions: [markdown(), smartInput(), history()],
src/components/ShortcutOverlay.tsx:12: * `?` 全局开关（App 层处理），全表与 `SHORTCUTS` 注册表严格相等；按家族分组，
src/editors/orchestration/roulette-view.ts:20:  ROOT_SECTORS,
src/editors/orchestration/roulette-view.ts:190:  const visibleSectors = options.sectors ?? ROOT_SECTORS.map((s) => s.id);
src/editors/orchestration/roulette-view.ts:252:  const sectorOf = (id: SectorId) => ROOT_SECTORS.find((s) => s.id === id)!;
src/editors/orchestration/horizontal-toolbar.ts:209:        useEditorStore.getState().config.htmlToolbarItems,
src/components/SettingsView.tsx:93:  { id: "extensions", label: "扩展" },
src/components/SettingsView.tsx:224:      const list = await invoke<ExtensionPackage[]>("list_extension_packages");
src/components/SettingsView.tsx:236:    invoke<ExtensionPackage[]>("list_extension_packages")
src/components/SettingsView.tsx:255:        await invoke<ExtensionPackage>("import_extension_package", {
src/components/SettingsView.tsx:270:      const picked = await invoke<string | null>("pick_extension_source", {
src/components/SettingsView.tsx:316:      await invoke("set_extension_package_enabled", {
src/components/SettingsView.tsx:328:      await invoke("remove_extension_package", { id });
src/components/SettingsView.tsx:338:      const out = await invoke<string>("package_extension_package", { id });
src/components/SettingsView.tsx:362:        "generate_extension_package",
src/components/SettingsView.tsx:367:          await invoke("remove_extension_package", { id: generated.id });
src/components/SettingsView.tsx:394:          拖入含 manifest.json 与 SKILL.md 的文件夹或 .zip，导入后立即启用。
src/components/SettingsView.tsx:399:            data-testid="extensions-disabled-note"
src/components/SettingsView.tsx:406:              data-testid="extensions-dropzone"
src/components/SettingsView.tsx:415:                  data-testid="extensions-import-folder"
src/components/SettingsView.tsx:423:                  data-testid="extensions-import-zip"
src/components/SettingsView.tsx:433:                data-testid="extensions-drop-overlay"
src/components/SettingsView.tsx:452:            data-testid="extensions-empty"
src/components/SettingsView.tsx:463:                  data-testid="extension-row"
src/components/SettingsView.tsx:464:                  data-extension-id={pkg.id}
src/components/SettingsView.tsx:474:                          data-testid="extension-source"
src/components/SettingsView.tsx:489:                        data-testid="extension-toggle"
src/components/SettingsView.tsx:502:                      data-testid="extension-open"
src/components/SettingsView.tsx:511:                      data-testid="extension-export"
src/components/SettingsView.tsx:520:                      data-testid="extension-preview"
src/components/SettingsView.tsx:530:                      data-testid="extension-remove"
src/components/SettingsView.tsx:540:                      data-testid="extension-skill"
src/components/SettingsView.tsx:553:            data-testid="extension-notice"
src/components/SettingsView.tsx:568:            data-testid="ai-extension-prompt"
src/components/SettingsView.tsx:576:            data-testid="ai-extension-generate"
src/components/SettingsView.tsx:586:              data-testid="ai-extension-cancel"
src/components/SettingsView.tsx:596:            data-testid="ai-extension-generating"
src/components/SettingsView.tsx:614:  const readerFontSize = useEditorStore((s) => s.config.readerFontSize ?? 17);
src/components/SettingsView.tsx:616:  const selectionToolbar = useEditorStore(
src/components/SettingsView.tsx:617:    (s) => s.config.selectionToolbar ?? "roulette",
src/components/SettingsView.tsx:627:  const rouletteSectors = useEditorStore(
src/components/SettingsView.tsx:628:    (s) => s.config.rouletteSectors ?? null,
src/components/SettingsView.tsx:639:  const htmlToolbarItems = useEditorStore(
src/components/SettingsView.tsx:640:    (s) => s.config.htmlToolbarItems ?? null,
src/components/SettingsView.tsx:643:  const defaultSavePath = useEditorStore(
src/components/SettingsView.tsx:644:    (s) => s.config.defaultSavePath ?? null,
src/components/SettingsView.tsx:831:    setConfig({ readerFontSize: size });
src/components/SettingsView.tsx:892:      setConfig({ defaultSavePath: dir });
src/components/SettingsView.tsx:900:    setConfig({ defaultSavePath: null });
src/components/SettingsView.tsx:915:    setConfig({ selectionToolbar: mode });
src/components/SettingsView.tsx:966:    rouletteSectors ?? ROULETTE_SECTOR_META.map((m) => m.id);
src/components/SettingsView.tsx:968:    setConfig({ rouletteSectors: next.length > 0 ? next : null });
src/components/SettingsView.tsx:989:    setConfig({ rouletteSectors: null });
src/components/SettingsView.tsx:994:    htmlToolbarItems ?? HTML_TOOLBAR_ITEMS.map((item) => item.id);
src/components/SettingsView.tsx:996:    setConfig({ htmlToolbarItems: next.length > 0 ? next : null });
src/components/SettingsView.tsx:1019:    setConfig({ htmlToolbarItems: null });
src/components/SettingsView.tsx:1243:                    const selected = readerFontSize === size;
src/components/SettingsView.tsx:1393:                      aria-pressed={selectionToolbar === option.value}
src/components/SettingsView.tsx:1396:                        selectionToolbar === option.value
src/components/SettingsView.tsx:2254:                  title={defaultSavePath ?? ""}
src/components/SettingsView.tsx:2256:                  {defaultSavePath || "未设置（使用系统默认位置）"}
src/components/SettingsView.tsx:2271:                    disabled={!defaultSavePath}
src/components/SettingsView.tsx:2379:          {active === "extensions" && (
src/__tests__/editor/table-cell-selection.test.ts:77:        extensions: [markdown(), editorDecorations()],
src/__tests__/lib/export/zip.test.ts:1:// 导出 ZIP：document.md 原文 + 本地图片资源，md-bundle toZip 语义（无 manifest.json、附 README.md）。
src/__tests__/lib/export/zip.test.ts:51:  it("合法 ZIP：document.md 原文、README.md、无 manifest.json、本地图片进包", async () => {
src/__tests__/lib/export/zip.test.ts:58:    expect(names).not.toContain("manifest.json");
src/__tests__/lib/theme-tokens.test.ts:7:} from "../../lib/extensions/theme-tokens";
src/editors/orchestration/block-handle.ts:889:  // 样式内联：新增 `cm-*` 类会触发 CSS manifest 门禁，本票不改名也不改 CSS。
src/__tests__/components/SettingsView.test.tsx:128:  it("外观区保留阅读字号入口，点击写入 readerFontSize", () => {
src/__tests__/components/SettingsView.test.tsx:133:    expect(useEditorStore.getState().config.readerFontSize).toBe(19);
src/__tests__/components/SettingsView.test.tsx:161:      expect(screen.getByTestId("extensions-disabled-note")).toBeTruthy();
src/__tests__/components/SettingsView.test.tsx:163:        screen.getByTestId("extensions-disabled-note").textContent,
src/__tests__/lib/templates.test.ts:6:} from "../../lib/extensions/templates";
src/__tests__/lib/templates.test.ts:7:import { loadExtensionSnapshot } from "../../lib/extensions/bundle";
src/__tests__/lib/templates.test.ts:115:        throw new Error("list_extensions unavailable");
src/__tests__/editor/callout-decorations.test.ts:58:        extensions: [markdown(), editorDecorations()],
src/lib/mdpkg/vendor/mdpkg-web.js:3091:      description: "Meta-schema for $data reference (JSON AnySchema extension proposal)",
src/lib/mdpkg/vendor/mdpkg-web.js:6997:      $comment: "This meta-schema also defines keywords that have appeared in previous drafts in order to prevent incompatible extensions as they remain in common use.",
src/lib/mdpkg/vendor/mdpkg-web.js:8662:  // 缺少 manifest.json
src/lib/mdpkg/vendor/mdpkg-web.js:8674:  // manifest 不符合 Schema
src/lib/mdpkg/vendor/mdpkg-web.js:8716:  // extensions_required 含不支持项
src/lib/mdpkg/vendor/mdpkg-web.js:8783:function pack(files, manifest) {
src/lib/mdpkg/vendor/mdpkg-web.js:8785:  const manifestBytes = strToU8(JSON.stringify(manifest ?? minimalManifest(all3), null, 2) + "\n");
src/lib/mdpkg/vendor/mdpkg-web.js:8786:  all3.set("manifest.json", manifestBytes);
src/lib/mdpkg/vendor/mdpkg-web.js:8790:  const sorted = ["manifest.json", ...order2.filter((p2) => p2 !== "manifest.json")];
src/lib/mdpkg/vendor/mdpkg-web.js:9334:// src/manifest.ts
src/lib/mdpkg/vendor/mdpkg-web.js:9353:// ../../spec/schema/manifest-1.0.json
src/lib/mdpkg/vendor/mdpkg-web.js:9354:var manifest_1_0_default = {
src/lib/mdpkg/vendor/mdpkg-web.js:9356:  $id: "https://mdpkg.spec/schema/manifest-1.0.json",
src/lib/mdpkg/vendor/mdpkg-web.js:9357:  title: "mdpkg manifest v1.0",
src/lib/mdpkg/vendor/mdpkg-web.js:9366:    extensions: {
src/lib/mdpkg/vendor/mdpkg-web.js:9374:    extensions_required: {
src/lib/mdpkg/vendor/mdpkg-web.js:11204:// node_modules/micromark-util-combine-extensions/index.js
src/lib/mdpkg/vendor/mdpkg-web.js:11206:function combineExtensions(extensions) {
src/lib/mdpkg/vendor/mdpkg-web.js:11209:  while (++index2 < extensions.length) {
src/lib/mdpkg/vendor/mdpkg-web.js:11210:    syntaxExtension(all3, extensions[index2]);
src/lib/mdpkg/vendor/mdpkg-web.js:11214:function syntaxExtension(all3, extension2) {
src/lib/mdpkg/vendor/mdpkg-web.js:11216:  for (hook in extension2) {
src/lib/mdpkg/vendor/mdpkg-web.js:11219:    const right = extension2[hook];
src/lib/mdpkg/vendor/mdpkg-web.js:12899:    // `micromark-extension-footnote` to `micromark-extension-gfm-footnote`,
src/lib/mdpkg/vendor/mdpkg-web.js:14950:            // To do: add more extension tests.
src/lib/mdpkg/vendor/mdpkg-web.js:15110:    combineExtensions([constructs_exports, ...settings.extensions || []])
src/lib/mdpkg/vendor/mdpkg-web.js:15885:function configure(combined, extensions) {
src/lib/mdpkg/vendor/mdpkg-web.js:15887:  while (++index2 < extensions.length) {
src/lib/mdpkg/vendor/mdpkg-web.js:15888:    const value = extensions[index2];
src/lib/mdpkg/vendor/mdpkg-web.js:15892:      extension(combined, value);
src/lib/mdpkg/vendor/mdpkg-web.js:15896:function extension(combined, extension2) {
src/lib/mdpkg/vendor/mdpkg-web.js:15898:  for (key2 in extension2) {
src/lib/mdpkg/vendor/mdpkg-web.js:15899:    if (own2.call(extension2, key2)) {
src/lib/mdpkg/vendor/mdpkg-web.js:15902:          const right = extension2[key2];
src/lib/mdpkg/vendor/mdpkg-web.js:15909:          const right = extension2[key2];
src/lib/mdpkg/vendor/mdpkg-web.js:15917:          const right = extension2[key2];
src/lib/mdpkg/vendor/mdpkg-web.js:15955:      extensions: self2.data("micromarkExtensions") || [],
src/lib/mdpkg/vendor/mdpkg-web.js:16164:// src/manifest.ts
src/lib/mdpkg/vendor/mdpkg-web.js:16231:    extensions: prev?.extensions,
src/lib/mdpkg/vendor/mdpkg-web.js:16232:    extensions_required: prev?.extensions_required,
src/lib/mdpkg/vendor/mdpkg-web.js:16239:  if (!validator) validator = ajv.compile(manifest_1_0_default);
src/lib/mdpkg/vendor/mdpkg-web.js:16312:  return { orphans: [...present].filter((p2) => !referenced.has(p2) && p2 !== "manifest.json") };
src/lib/mdpkg/vendor/mdpkg-web.js:16315:function assertSupported(manifest) {
src/lib/mdpkg/vendor/mdpkg-web.js:16316:  const major = String(manifest.spec_version).split(".")[0];
src/lib/mdpkg/vendor/mdpkg-web.js:16317:  if (major !== "1") throw new MdeError(E.E701, `spec_version \u4E3B\u7248\u672C\u4E0D\u652F\u6301: ${manifest.spec_version}\uFF08\u672C\u5B9E\u73B0\u652F\u6301 1.x\uFF09`);
src/lib/mdpkg/vendor/mdpkg-web.js:16318:  for (const r of manifest.extensions_required ?? []) {
src/lib/mdpkg/vendor/mdpkg-web.js:16319:    if (!SUPPORTED_REQUIRED.has(r)) throw new MdeError(E.E702, `extensions_required \u542B\u4E0D\u652F\u6301\u9879: ${r}`);
src/lib/mdpkg/vendor/mdpkg-web.js:16325:  const raw2 = files.get("manifest.json");
src/lib/mdpkg/vendor/mdpkg-web.js:16326:  if (!raw2) return { ok: false, errors: [`[${E.E102}] \u7F3A\u5C11 manifest.json`], warnings, externalCount: 0 };
src/lib/mdpkg/vendor/mdpkg-web.js:16327:  let manifest;
src/lib/mdpkg/vendor/mdpkg-web.js:16329:    manifest = JSON.parse(new TextDecoder().decode(raw2));
src/lib/mdpkg/vendor/mdpkg-web.js:16331:    return { ok: false, errors: [`[${E.E302}] manifest.json \u4E0D\u662F\u5408\u6CD5 JSON: ${e.message}`], warnings, externalCount: 0 };
src/lib/mdpkg/vendor/mdpkg-web.js:16334:    assertSupported(manifest);
src/lib/mdpkg/vendor/mdpkg-web.js:16338:  if (!getValidator()(manifest)) {
src/lib/mdpkg/vendor/mdpkg-web.js:16341:  const actual = new Map([...files.keys()].filter((p2) => p2 !== "manifest.json").map((p2) => [normalizePath(p2), files.get(p2)]));
src/lib/mdpkg/vendor/mdpkg-web.js:16342:  const listed = new Map((manifest.resources ?? []).map((r) => [r.path, r]));
src/lib/mdpkg/vendor/mdpkg-web.js:16348:    if (r.size !== data.length) errors.push(`[${E.E402}] size \u4E0D\u7B26: ${p2}\uFF08manifest ${r.size} / \u5B9E\u9645 ${data.length}\uFF09`);
src/lib/mdpkg/vendor/mdpkg-web.js:16351:  const entry = manifest.entrypoint ?? DEFAULT_ENTRYPOINT;
src/lib/mdpkg/vendor/mdpkg-web.js:18123:    extensions: [
src/lib/mdpkg/vendor/mdpkg-web.js:18133:// node_modules/micromark-extension-gfm-autolink-literal/lib/syntax.js
src/lib/mdpkg/vendor/mdpkg-web.js:18475:// node_modules/micromark-extension-gfm-footnote/lib/syntax.js
src/lib/mdpkg/vendor/mdpkg-web.js:18750:// node_modules/micromark-extension-gfm-strikethrough/lib/syntax.js
src/lib/mdpkg/vendor/mdpkg-web.js:18844:// node_modules/micromark-extension-gfm-table/lib/edit-map.js
src/lib/mdpkg/vendor/mdpkg-web.js:18923:// node_modules/micromark-extension-gfm-table/lib/infer.js
src/lib/mdpkg/vendor/mdpkg-web.js:18950:// node_modules/micromark-extension-gfm-table/lib/syntax.js
src/lib/mdpkg/vendor/mdpkg-web.js:19336:// node_modules/micromark-extension-gfm-task-list-item/lib/syntax.js
src/lib/mdpkg/vendor/mdpkg-web.js:19410:// node_modules/micromark-extension-gfm/index.js
src/lib/mdpkg/vendor/mdpkg-web.js:21339:    manifest: null,
src/lib/mdpkg/vendor/mdpkg-web.js:23296:  const manifestRaw = files.get("manifest.json");
src/lib/mdpkg/vendor/mdpkg-web.js:23297:  let manifest;
src/lib/mdpkg/vendor/mdpkg-web.js:23299:    manifest = manifestRaw ? JSON.parse(new TextDecoder().decode(manifestRaw)) : {};
src/lib/mdpkg/vendor/mdpkg-web.js:23301:    throw new MdeError(E.E302, `manifest.json \u4E0D\u662F\u5408\u6CD5 JSON: ${e.message}`);
src/lib/mdpkg/vendor/mdpkg-web.js:23303:  const hasManifest = manifestRaw !== void 0;
src/lib/mdpkg/vendor/mdpkg-web.js:23304:  const entry = hasManifest && manifest.entrypoint ? manifest.entrypoint : inferEntrypoint(files);
src/lib/mdpkg/vendor/mdpkg-web.js:23306:  if (hasManifest) assertSupported(manifest);
src/lib/mdpkg/vendor/mdpkg-web.js:23311:  const totalBytes = [...files.entries()].reduce((n, [p2, d]) => p2 === "manifest.json" ? n : n + d.length, 0);
src/lib/mdpkg/vendor/mdpkg-web.js:23322:  const includeEnabled = opts.include ?? !(manifest.extensions?.include === false);
src/lib/mdpkg/vendor/mdpkg-web.js:23326:  const html7 = unified().use(remarkParse).use(remarkGfm).use(symbolsPlugin, { enabled: opts.symbols !== false && manifest.extensions?.symbols !== "off" }).use(cjkSpacingPlugin, { enabled: opts.cjkSpacing !== false }).use(remarkRehype).use(rehypeSanitize).use(assetsPlugin, files, mode === "inline", entryDir).use(rehypeStringify).processSync(guardEscapes(expanded)).toString();
src/lib/mdpkg/vendor/mdpkg-web.js:23366:  const manifestRaw = files.get("manifest.json");
src/lib/mdpkg/vendor/mdpkg-web.js:23367:  let manifest;
src/lib/mdpkg/vendor/mdpkg-web.js:23369:    manifest = manifestRaw ? JSON.parse(new TextDecoder().decode(manifestRaw)) : {};
src/lib/mdpkg/vendor/mdpkg-web.js:23371:    throw new MdeError(E.E302, `manifest.json \u4E0D\u662F\u5408\u6CD5 JSON: ${e.message}`);
src/lib/mdpkg/vendor/mdpkg-web.js:23373:  const hasManifest = manifestRaw !== void 0;
src/lib/mdpkg/vendor/mdpkg-web.js:23374:  const entry = hasManifest && manifest.entrypoint ? manifest.entrypoint : inferEntrypoint(files);
src/lib/mdpkg/vendor/mdpkg-web.js:23378:  const includeEnabled = opts.include ?? !(manifest.extensions?.include === false);
src/lib/mdpkg/vendor/mdpkg-web.js:24218:  const manifestRaw = files.get("manifest.json");
src/lib/mdpkg/vendor/mdpkg-web.js:24219:  let manifest;
src/lib/mdpkg/vendor/mdpkg-web.js:24221:    manifest = manifestRaw ? JSON.parse(new TextDecoder().decode(manifestRaw)) : {};
src/lib/mdpkg/vendor/mdpkg-web.js:24223:    throw new MdeError(E.E302, `manifest.json \u4E0D\u662F\u5408\u6CD5 JSON: ${e.message}`);
src/lib/mdpkg/vendor/mdpkg-web.js:24225:  const hasManifest = manifestRaw !== void 0;
src/lib/mdpkg/vendor/mdpkg-web.js:24226:  const entry = hasManifest && manifest.entrypoint ? manifest.entrypoint : inferEntrypoint(files);
src/lib/mdpkg/vendor/mdpkg-web.js:24228:  if (hasManifest) assertSupported(manifest);
src/lib/mdpkg/vendor/mdpkg-web.js:24234:  let expanded = manifest.extensions?.include === false ? raw2 : expand(files, entry).text;
src/lib/mdpkg/vendor/mdpkg-web.js:24244:    symbols: opts.symbols !== false && manifest.extensions?.symbols !== "off",
src/lib/mdpkg/vendor/mdpkg-web.js:24287:  const manifestRaw = pkg.get("manifest.json");
src/lib/mdpkg/vendor/mdpkg-web.js:24289:  if (manifestRaw !== void 0) {
src/lib/mdpkg/vendor/mdpkg-web.js:24290:    let manifest;
src/lib/mdpkg/vendor/mdpkg-web.js:24292:      manifest = JSON.parse(new TextDecoder().decode(manifestRaw));
src/lib/mdpkg/vendor/mdpkg-web.js:24294:      throw new MdeError(E.E302, `manifest.json \u4E0D\u662F\u5408\u6CD5 JSON: ${e.message}`);
src/lib/mdpkg/vendor/mdpkg-web.js:24296:    entry = manifest.entrypoint ?? inferEntrypoint(pkg);
src/lib/mdpkg/vendor/mdpkg-web.js:24303:    if (p2 === "manifest.json" || p2 === entry) continue;
src/lib/mdpkg/vendor/mdpkg-web.js:24320:  let manifest = null;
src/lib/mdpkg/vendor/mdpkg-web.js:24321:  const manifestRaw = files.get("manifest.json");
src/lib/mdpkg/vendor/mdpkg-web.js:24322:  if (manifestRaw) {
src/lib/mdpkg/vendor/mdpkg-web.js:24324:      manifest = JSON.parse(new TextDecoder().decode(manifestRaw));
src/lib/mdpkg/vendor/mdpkg-web.js:24326:      manifest = null;
src/lib/mdpkg/vendor/mdpkg-web.js:24329:  const unverified = manifestRaw === void 0;
src/lib/mdpkg/vendor/mdpkg-web.js:24331:  const hasManifest = manifestRaw !== void 0;
src/lib/mdpkg/vendor/mdpkg-web.js:24332:  const resolvedEntry = hasManifest && manifest?.entrypoint ? manifest.entrypoint : (() => {
src/lib/mdpkg/vendor/mdpkg-web.js:24344:      manifest,
src/lib/mdpkg/vendor/mdpkg-web.js:24355:      manifest,
src/lib/mdpkg/vendor/mdpkg-web.js:24379:  const manifestRaw = files.get("manifest.json");
src/lib/mdpkg/vendor/mdpkg-web.js:24380:  let manifest = null;
src/lib/mdpkg/vendor/mdpkg-web.js:24381:  if (manifestRaw) {
src/lib/mdpkg/vendor/mdpkg-web.js:24383:      manifest = JSON.parse(new TextDecoder().decode(manifestRaw));
src/lib/mdpkg/vendor/mdpkg-web.js:24385:      manifest = null;
src/lib/mdpkg/vendor/mdpkg-web.js:24388:  const hasManifest = manifestRaw !== void 0;
src/lib/mdpkg/vendor/mdpkg-web.js:24389:  const entry = hasManifest && manifest?.entrypoint ? manifest.entrypoint : inferEntrypoint(files);
src/lib/mdpkg/vendor/mdpkg-web.js:24400:  const raw2 = files.get("manifest.json");
src/lib/mdpkg/vendor/mdpkg-web.js:24411:  work.delete("manifest.json");
src/lib/mdpkg/vendor/mdpkg-web.js:24412:  const manifest = buildManifest(work, prev);
src/lib/mdpkg/vendor/mdpkg-web.js:24413:  const entry = manifest.entrypoint ?? inferEntrypoint(work);
src/lib/mdpkg/vendor/mdpkg-web.js:24415:  return pack(work, manifest);
src/__tests__/editor/decorations.test.ts:61:        extensions: [markdown(), editorDecorations()],
src/__tests__/editor/columns.test.ts:78:        extensions: [markdown(), editorDecorations()],
src/__tests__/editor/columns.test.ts:218:        extensions: [markdown(), editorDecorations(), slashKeymap()],
src/__tests__/lib/shortcuts.test.ts:3:  SHORTCUTS,
src/__tests__/lib/shortcuts.test.ts:22:    const ids = SHORTCUTS.map((s) => s.id);
src/__tests__/lib/shortcuts.test.ts:38:    for (const shortcut of SHORTCUTS) {
src/__tests__/lib/shortcuts.test.ts:57:    const locals = SHORTCUTS.filter((s) => s.scope === "local");
src/__tests__/lib/shortcuts.test.ts:71:    const local = SHORTCUTS.find((s) => s.scope === "local")!;
src/__tests__/lib/shortcuts.test.ts:81:    for (const shortcut of SHORTCUTS) {
src/__tests__/lib/shortcuts.test.ts:91:    for (const shortcut of SHORTCUTS) {
src/__tests__/lib/shortcuts.test.ts:101:    const withDecision = SHORTCUTS.filter((s) => s.decision);
src/__tests__/lib/shortcuts.test.ts:108:    const families = new Set(SHORTCUTS.map((s) => s.family));
src/__tests__/editor/callout-emoji-picker.test.ts:54:        extensions: [markdown(), editorDecorations()],
src/__tests__/editor/user-extensions.test.ts:7:} from "../../editors/user-extensions";
src/__tests__/editor/user-extensions.test.ts:92:        throw new Error("list_extensions unavailable");
docs/design/explorations/reader-typography/README.md:271:- **集成**：自写 marked extension（block + inline 各一个，约 40 行），在 tokenizer 阶段吃掉公式原文，**避免 markdown 把 `_`、`^`、`\\` 当转义处理**。
docs/design/explorations/reader-typography/README.md:303:- **存储**：扩展 `AppConfig`（Rust `struct AppConfig` + 前端 `RustAppConfig`）三个可选字段：`readerFontSize`、`readerWidth`、`readerSkin`；走现有 `load_config` / `save_config` 通道，缺省回落到默认值，老配置无感升级。
docs/design/explorations/reader-typography/README.md:316:| 4 | 新增 `src/renderers/math.ts` | KaTeX marked extension + 占位符 + sanitize 后回填 | `katex` |
docs/design/explorations/reader-typography/阅读视图六项反馈修复计划.md:78:- `npx tsc --noEmit`、`npx vitest run src/__tests__/markdownRender.test.ts`、CSS manifest 检查。
src/__tests__/editor/align-fence-decorations.test.ts:65:        extensions: [markdown(), editorDecorations()],
docs/design/explorations/design-governance/proposal.md:63:- 新增 stylelint 规则（或 CI 脚本，同 CSS manifest 检查的样式）：`src/` 新增代码中禁止新的硬编码尺寸/颜色字面量，必须走 `var(--*)`（白名单豁免机制）。
docs/design/explorations/design-governance/proposal.md:99:- 复用已有机制而非新造：CSS manifest 检查的机检模式、change-workflow 的 ui-surface 标签与 T1/T2 骨架、defect-workflow 的票务体系——本方案全部是**在既有骨架上补设计维度**，不引入新流程。

exec
/bin/zsh -c "nl -ba src/lib/paneHeaderMenu.ts | sed -n '1,300p'
nl -ba src/lib/shortcuts.ts | sed -n '1,320p'
nl -ba src/editors/keybindings.ts | sed -n '1,320p'
nl -ba src/ui/icons.ts 2>/dev/null || true
nl -ba src/editors/icons.ts | sed -n '1,260p'" in /Users/mason/ToHighs/clairis-wt-design-plan
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
   121	  | "edit"
   122	  | "globe"
   123	  | "bulb"
   124	  | "info"
   125	  | "danger"
   126	  | "indent"
   127	  | "outdent"
   128	  | "columns1"
   129	  | "columns2"
   130	  | "columns3"
   131	  | "columns4"
   132	  | "columns5"
   133	  | "divider";
   134	
   135	export interface IconPart {
   136	  d?: string;
   137	  s?: string;
   138	  /** stroke-dasharray 值，如 "2 2"。 */
   139	  dash?: string;
   140	}
   141	
   142	export interface IconDef {
   143	  /**
   144	   * 实心子路径的 `d`。多个子路径要合并在这一条里（用 `M` 分隔）——
   145	   * 分成多个 <path> 各自填充的话，内部字形会被同色填充盖掉，图标退化成色块。
   146	   */
   147	  d?: string;
   148	  /**
   149	   * 描边子路径的 `d`。`Icon` 组件对本字段渲染 `fill="none" stroke="currentColor"`。
   150	   * `d` 与 `s` 至少存在其一。
   151	   */
   152	  s?: string;
   153	  dash?: string;
   154	  /** 存在时覆盖 `d`/`s`，用于「实线格 + 虚线格」这类多段图标。 */
   155	  parts?: IconPart[];
   156	  /** 图标抽屉里显示的中文名 */
   157	  label: string;
   158	}
   159	
   160	export const ICONS: Record<IconName, IconDef> = {
   161	  markdown: {
   162	    label: "Markdown",
   163	    s: "M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z M8.5 16.5V10L12 14.2L15.5 10V16.5",
   164	  },
   165	  html: {
   166	    label: "HTML",
   167	    s: "M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z M10 12l-2 2.5L10 17 M14 12l2 2.5L14 17 M13 11l-2 7",
   168	  },
   169	  text: {
   170	    label: "文本",
   171	    s: "M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z M9.5 12h5 M9.5 15h5 M9.5 18h3",
   172	  },
   173	  pdf: {
   174	    label: "PDF",
   175	    s: "M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z M9.5 17V11h2.6a2 2 0 010 4H9.5",
   176	  },
   177	  video: {
   178	    label: "视频",
   179	    s: "M3.5 6h17v12h-17z M10 9.5l5 2.5-5 2.5z",
   180	  },
   181	  image: {
   182	    label: "图片",
   183	    s: "M3.5 5h17v14h-17z M8 10.2a1.4 1.4 0 110-2.8 1.4 1.4 0 010 2.8z M5 17.5l4.5-5 3 3.2 2-2.2 4.5 4",
   184	  },
   185	  code: {
   186	    label: "代码",
   187	    s: "M9 8l-5 4 5 4 M15 8l5 4-5 4",
   188	  },
   189	  audio: {
   190	    label: "音频",
   191	    s: "M10 18V7l7-2v11 M10 18a2 2 0 11-4 0 2 2 0 014 0z M17 16a2 2 0 11-4 0 2 2 0 014 0z",
   192	  },
   193	  folder: {
   194	    label: "文件夹",
   195	    s: "M3.5 7h6l2 2h9v10h-17z",
   196	  },
   197	  /** 「移动到」：文件夹 + 向右箭头。不同概念不复用图标——不得复用 folder/locate 的 path。 */
   198	  moveTo: {
   199	    label: "移动到",
   200	    parts: [
   201	      { s: "M3.5 7h5l1.8 1.8h4.2v9.2h-11z" },
   202	      { s: "M16.5 12h4 M18.6 9.4l2.6 2.6-2.6 2.6" },
   203	    ],
   204	  },
   205	  clock: {
   206	    label: "时钟",
   207	    s: "M12 4a8 8 0 1 1 0 16 8 8 0 1 1 0-16 M12 7.5V12l3 2",
   208	  },
   209	  file: {
   210	    label: "文件",
   211	    s: "M6 3h8l4 4v14H6z M14 3v4h4",
   212	  },
   213	  close: {
   214	    label: "关闭",
   215	    s: "M6.5 6.5l11 11 M17.5 6.5l-11 11",
   216	  },
   217	  closeOthers: {
   218	    label: "关闭其他",
   219	    parts: [{ s: "M4 4l6 6M10 4l-6 6" }, { s: "M14 7h6" }, { s: "M14 13h6" }],
   220	  },
   221	  search: {
   222	    label: "搜索",
   223	    s: "M10.5 4a6.5 6.5 0 100 13 6.5 6.5 0 000-13z M15.5 15.5L21 21",
   224	  },
   225	  sun: {
   226	    label: "浅色",
   227	    s: "M12 8a4 4 0 100 8 4 4 0 000-8z M12 2.5v2 M12 19.5v2 M2.5 12h2 M19.5 12h2",
   228	  },
   229	  sunBright: {
   230	    label: "亮色",
   231	    s: "M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z M12 2.5v3 M20.23 7.25l-1.9 1.1 M20.23 16.75l-1.9 -1.1 M12 21.5v-3 M3.77 16.75l1.9 -1.1 M3.77 7.25l1.9 1.1",
   232	  },
   233	  sunWarm: {
   234	    label: "暖色",
   235	    s: "M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z M12 2.5v2.2 M12 19.3v2.2 M2.5 12h2.2 M19.3 12h2.2",
   236	  },
   237	  moon: {
   238	    label: "深色",
   239	    s: "M13.5 3a9 9 0 107.5 12.9A7.2 7.2 0 0113.5 3z",
   240	  },
   241	  monitor: {
   242	    label: "跟随系统",
   243	    s: "M4 5h16v11H4z M9.5 18.5h5",
   244	  },
   245	  pin: {
   246	    label: "钉住",
   247	    s: "M9 4h6 M12 4v1.4 M9.4 6.4h5.2l1.2 3.4H8.2L9.4 6.4z M8.4 9.8h7.2 M12 9.8v6.2",
   248	  },
   249	  pinOff: {
   250	    label: "取消钉住",
   251	    s: "M9 4h6 M12 4v1.4 M9.4 6.4h5.2l1.2 3.4H8.2L9.4 6.4z M8.4 9.8h7.2 M12 9.8v6.2 M7.4 16.6L16.6 7.4",
   252	  },
   253	  grid: {
   254	    label: "网格概览",
   255	    s: "M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z",
   256	  },
   257	  check: {
   258	    label: "完成",
   259	    s: "M5 12.5l4.5 4.5L19 7.5",
   260	  },
   261	  warning: {
   262	    label: "警告",
   263	    s: "M12 3.5l9.5 16H2.5z M12 9.5v4.5 M11.4 16.6h1.2",
   264	  },
   265	  settings: {
   266	    label: "设置",
   267	    s: "M18.6 10.1L20.3 10A0.6 0.6 0 0 1 21 10.6L21 13.4A0.6 0.6 0 0 1 20.3 14L18.6 13.9A0.6 0.6 0 0 0 18 14.2L17.4 15.3A0.6 0.6 0 0 0 17.5 16L18.8 17.2A0.6 0.6 0 0 1 18.7 18.1L16.5 19.9A0.6 0.6 0 0 1 15.6 19.8L14.6 18.3A0.6 0.6 0 0 0 14 18L12.8 18.3A0.6 0.6 0 0 0 12.4 18.8L12.1 20.6A0.6 0.6 0 0 1 11.4 21.1L8.6 20.4A0.6 0.6 0 0 1 8.2 19.7L8.7 18A0.6 0.6 0 0 0 8.5 17.3L7.6 16.6A0.6 0.6 0 0 0 6.9 16.5L5.4 17.4A0.6 0.6 0 0 1 4.5 17.2L3.3 14.6A0.6 0.6 0 0 1 3.6 13.8L5.3 13.2A0.6 0.6 0 0 0 5.7 12.6L5.7 11.4A0.6 0.6 0 0 0 5.3 10.8L3.6 10.2A0.6 0.6 0 0 1 3.3 9.4L4.5 6.8A0.6 0.6 0 0 1 5.4 6.6L6.9 7.5A0.6 0.6 0 0 0 7.6 7.4L8.5 6.7A0.6 0.6 0 0 0 8.7 6L8.2 4.3A0.6 0.6 0 0 1 8.6 3.6L11.4 2.9A0.6 0.6 0 0 1 12.1 3.4L12.4 5.2A0.6 0.6 0 0 0 12.8 5.7L14 6A0.6 0.6 0 0 0 14.6 5.7L15.6 4.2A0.6 0.6 0 0 1 16.5 4.1L18.7 5.9A0.6 0.6 0 0 1 18.8 6.8L17.5 8A0.6 0.6 0 0 0 17.4 8.7L18 9.8A0.6 0.6 0 0 0 18.6 10.1Z M12 8.8a3.2 3.2 0 1 0 0 6.4a3.2 3.2 0 1 0 0 -6.4z",
   268	  },
   269	  expand: {
   270	    label: "全屏格",
   271	    s: "M4 9V4h5 M15 4h5v5 M4 15v5h5 M15 20h5v-5",
   272	  },
   273	  collapse: {
   274	    label: "退出全屏",
   275	    s: "M4 9h5V4 M20 9h-5V4 M4 15h5v5 M20 15h-5v5",
   276	  },
   277	  more: {
   278	    label: "更多",
   279	    d: "M5 11h2.4v2.4H5z M10.8 11h2.4v2.4h-2.4z M16.6 11h2.4v2.4h-2.4z",
   280	  },
   281	  eye: {
   282	    label: "预览",
   283	    s: "M2.5 12c2.2-3.4 5.6-5.4 9.5-5.4s7.3 2 9.5 5.4c-2.2 3.4-5.6 5.4-9.5 5.4s-7.3-2-9.5-5.4z M12 9.4a2.6 2.6 0 100 5.2 2.6 2.6 0 000-5.2z",
   284	  },
   285	  pencil: {
   286	    label: "编辑",
   287	    s: "M4 20h4l10.4-10.4-4-4L4 16z M14.4 5.6l1.5-1.5a1 1 0 011.4 0l2.6 2.6a1 1 0 010 1.4l-1.5 1.5z",
   288	  },
   289	  export: {
   290	    label: "导出",
   291	    s: "M12 15V3 M8 7l4-4 4 4 M4 14v6h16v-6",
   292	  },
   293	  exportWord: {
   294	    label: "Word 导出",
   295	    s: "M6 3h8l4 4v14H6z M14 3v4h4 M8.5 9.5l1.6 6.5 1.9-4.3 1.9 4.3 1.6-6.5",
   296	  },
   297	  exportZip: {
   298	    label: "ZIP 导出",
   299	    s: "M4 5h16v14H4z M12 5v14 M10.6 8h2.8 M10.6 11h2.8 M10.6 14h2.8",
   300	  },
   301	  exportMdpkg: {
   302	    label: ".mdpkg 导出",
   303	    s: "M12 3l8 4.5v9L12 21l-8-4.5v-9z M4 7.5l8 4.5 8-4.5 M12 12v9",
   304	  },
   305	  print: {
   306	    label: "打印",
   307	    s: "M6 9V2h12v7 M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2 M6 14h12v8H6z",
   308	  },
   309	  share: {
   310	    label: "分享",
   311	    s: "M6 12a2 2 0 100-4 2 2 0 000 4z M18 6a2 2 0 100-4 2 2 0 000 4z M18 22a2 2 0 100-4 2 2 0 000 4z M8 10l8-3 M8 14l8 3",
   312	  },
   313	  splitRight: {
   314	    label: "向右分栏",
   315	    parts: [
   316	      { s: "M4 5h6.5v14H4z" },
   317	      { s: "M13.5 5h6.5v14h-6.5z", dash: "2 2" },
   318	    ],
   319	  },
   320	  splitDown: {
   321	    label: "向下分栏",
   322	    parts: [{ s: "M5 4h14v6.5H5z" }, { s: "M5 13.5h14v6.5H5z", dash: "2 2" }],
   323	  },
   324	  refresh: {
   325	    label: "刷新",
   326	    s: "M20 12a8 8 0 10-2.3 5.6 M20 6v6h-6",
   327	  },
   328	  locate: {
   329	    label: "定位",
   330	    s: "M12 6.8a5.2 5.2 0 100 10.4 5.2 5.2 0 000-10.4z M12 9.6a2.4 2.4 0 100 4.8 2.4 2.4 0 000-4.8z M12 2v3 M12 19v3 M2 12h3 M19 12h3",
   331	  },
   332	  copyPath: {
   333	    label: "复制",
   334	    s: "M5 8h10v12H5z M9 5h10v11",
   335	  },
   336	  chevronDown: {
   337	    label: "展开",
   338	    s: "M6 9l6 6 6-6",
   339	  },
   340	  chevronRight: {
   341	    label: "展开栏",
   342	    s: "M9 7l6 5-6 5",
   343	  },
   344	  chevronLeft: {
   345	    label: "收起栏",
   346	    s: "M15 7l-6 5 6 5",
   347	  },
   348	  sparkle: {
   349	    label: "AI",
   350	    d: "M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9z M18.6 2.6l.7 2.2 2.2.7-2.2.7-.7 2.2-.7-2.2-2.2-.7 2.2-.7z M5.6 14.6l.6 1.9 1.9.6-1.9.6-.6 1.9-.6-1.9L3.1 17.1l1.9-.6z",
   351	  },
   352	  immersive: {
   353	    label: "沉浸",
   354	    s: "M7.2 17.8a7.5 7.5 0 119.6 0",
   355	  },
   356	  play: {
   357	    label: "播放",
   358	    d: "M8.5 5.2v13.6L19 12z",
   359	  },
   360	  pause: {
   361	    label: "暂停",
   362	    d: "M7.4 5h3.2v14H7.4z M13.4 5h3.2v14h-3.2z",
   363	  },
   364	  prev: {
   365	    label: "上一首",
   366	    parts: [{ s: "M7 5v14" }, { d: "M18 5.4v13.2L9.6 12z" }],
   367	  },
   368	  next: {
   369	    label: "下一首",
   370	    parts: [{ s: "M17 5v14" }, { d: "M6 5.4v13.2L14.4 12z" }],
   371	  },
   372	  volume: {
   373	    label: "音量",
   374	    s: "M4 9.5h3.5L12 5.8v12.4L7.5 14.5H4z M15.5 9.2a4 4 0 010 5.6 M18.2 6.6a7.5 7.5 0 010 10.8",
   375	  },
   376	  volumeMute: {
   377	    label: "静音",
   378	    s: "M4 9.5h3.5L12 5.8v12.4L7.5 14.5H4z M5.8 7.2l5.4 9.6",
   379	  },
   380	  playlist: {
   381	    label: "播放列表",
   382	    s: "M4 6h10 M4 11h10 M4 16h7 M15 13.5l5.5 3-5.5 3z",
   383	  },
   384	  loopNone: {
   385	    label: "不循环",
   386	    s: "M5.5 10.5a5.5 5.5 0 0111-2.9 M18.5 13.5a5.5 5.5 0 01-11 2.9 M14 7.6h2.5V5.1 M10 16.4H7.5v2.5",
   387	  },
   388	  loopSingle: {
   389	    label: "单曲循环",
   390	    s: "M5.5 10.5a5.5 5.5 0 0111-2.9 M18.5 13.5a5.5 5.5 0 01-11 2.9 M14 7.6h2.5V5.1 M10 16.4H7.5v2.5 M11.5 10v4.5 M10.4 11.2l1.1-1.1",
   391	  },
   392	  loopPlaylist: {
   393	    label: "列表循环",
   394	    s: "M5.5 10.5a5.5 5.5 0 0111-2.9 M18.5 13.5a5.5 5.5 0 01-11 2.9 M14 7.6h2.5V5.1 M10 16.4H7.5v2.5 M10.5 10v4.5 M10.5 10l3.2 4.5 M13.7 10v4.5",
   395	  },
   396	  subtitle: {
   397	    label: "字幕",
   398	    s: "M4 5h16v9H9.5L6 17.5V14H4z M8 8.5h8 M8 11.5h5",
   399	  },
   400	  timestampNote: {
   401	    label: "时间戳笔记",
   402	    s: "M4 20.5l4.5-1.1L19 8.9a2.1 2.1 0 0 0-3-3L5.5 16.4 4 20.5z M14.5 7.5l2.9 2.9 M13 21h8",
   403	  },
   404	  keyboardHints: {
   405	    label: "快捷键",
   406	    s: "M4.5 6h15A1.5 1.5 0 0121 7.5v9a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 16.5v-9A1.5 1.5 0 014.5 6z M6.5 9h1 M10 9h1 M13.5 9h1 M17 9h1 M6.5 12h1 M17 12h1 M9 12h6 M8 15h8",
   407	  },
   408	  pip: {
   409	    label: "画中画",
   410	    s: "M3 5.5h18v13H3z M12.5 12.5h6v4h-6z",
   411	  },
   412	  fullscreen: {
   413	    label: "全屏",
   414	    s: "M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5",
   415	  },
   416	  layoutAuto: {
   417	    label: "自动布局",
   418	    parts: [
   419	      { s: "M4.5 19.5L14.2 9.8" },
   420	      { s: "M15 4l0.8 2.7 2.7 0.8-2.7 0.8L15 11l-0.8-2.7-2.7-0.8 2.7-0.8z" },
   421	      { s: "M20 12l0.5 1.6 1.6 0.5-1.6 0.5-0.5 1.6-0.5-1.6-1.6-0.5 1.6-0.5z" },
   422	      { s: "M8 3l0.5 1.6 1.6 0.5-1.6 0.5L8 7.2l-0.5-1.6L5.9 5.1l1.6-0.5z" },
   423	    ],
   424	  },
   425	  droplet: {
   426	    label: "墨滴",
   427	    parts: [
   428	      {
   429	        s: "M12 3.5c3.2 3.9 5.5 7.2 5.5 9.9a5.5 5.5 0 1 1-11 0c0-2.7 2.3-6 5.5-9.9z",
   430	      },
   431	    ],
   432	  },
   433	  tune: {
   434	    label: "画面",
   435	    parts: [
   436	      { s: "M4 7h9M17 7h3M4 17h3M11 17h9" },
   437	      { s: "M15 7a2 2 0 1 0 0.01 0zM9 17a2 2 0 1 0 0.01 0z" },
   438	    ],
   439	  },
   440	  rotate: {
   441	    label: "旋转画面",
   442	    parts: [{ s: "M4 12a8 8 0 1 1 2.4 5.7" }, { s: "M3 8v4h4" }],
   443	  },
   444	  zoomIn: {
   445	    label: "放大画面",
   446	    parts: [
   447	      { s: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z" },
   448	      { s: "M16 16l5 5M11 8v6M8 11h6" },
   449	    ],
   450	  },
   451	  zoomOut: {
   452	    label: "缩小画面",
   453	    parts: [
   454	      { s: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z" },
   455	      { s: "M16 16l5 5M8 11h6" },
   456	    ],
   457	  },
   458	  camera: {
   459	    label: "截取当前画面",
   460	    parts: [
   461	      {
   462	        s: "M3 8.5A1.5 1.5 0 0 1 4.5 7h3l1.5-2h6l1.5 2h3A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z",
   463	      },
   464	      { s: "M12 10.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" },
   465	    ],
   466	  },
   467	  speed: {
   468	    label: "倍速",
   469	    s: "M4.5 18a8 8 0 1115 0 M12 14l3.6-5.6 M12 14h.01",
   470	  },
   471	  width: {
   472	    label: "宽度",
   473	    s: "M4 12h16 M4 12l3.5-3.5 M4 12l3.5 3.5 M20 12l-3.5-3.5 M20 12l-3.5 3.5",
   474	  },
   475	  heart: {
   476	    label: "收藏",
   477	    s: "M12 19.5s-6.8-4.3-6.8-9.2A3.6 3.6 0 0112 8a3.6 3.6 0 016.8 2.3c0 4.9-6.8 9.2-6.8 9.2z",
   478	  },
   479	  heartFilled: {
   480	    label: "已收藏",
   481	    d: "M12 20.2s-7.4-4.6-7.4-9.8A3.9 3.9 0 0112 7.6a3.9 3.9 0 017.4 2.8c0 5.2-7.4 9.8-7.4 9.8z",
   482	  },
   483	  home: {
   484	    label: "首页",
   485	    s: "M4 11l8-7 8 7 M6 10v9h12v-9 M10 19v-5h4v5",
   486	  },
   487	  convert: {
   488	    label: "转换",
   489	    s: "M4.6 5h8.8A1.6 1.6 0 0 1 15 6.6v5.8a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 12.4V6.6A1.6 1.6 0 0 1 4.6 5z M17 9.5h4 M21 9.5l-2-2 M21 9.5l-2 2 M3 18h9",
   490	  },
   491	  align: {
   492	    label: "对齐",
   493	    s: "M4 6h16 M6.5 10h11 M4 14h16 M8.5 18h7",
   494	  },
   495	  bold: {
   496	    label: "加粗",
   497	    s: "M7 5h5.4a3.4 3.4 0 0 1 0 6.8H7z M7 11.8h6.2a3.6 3.6 0 0 1 0 7.2H7z",
   498	  },
   499	  italic: {
   500	    label: "斜体",
   501	    s: "M10 5h7 M7 19h7 M14.5 5 9.5 19",
   502	  },
   503	  underline: {
   504	    label: "下划线",
   505	    s: "M7 5v6a5 5 0 0 0 10 0V5 M5.5 20h13",
   506	  },
   507	  strike: {
   508	    label: "删除线",
   509	    s: "M6 9.2c0-2.2 2.4-3.7 6-3.7s6 1.5 6 3.7 M6 14.8c0 2.2 2.4 3.7 6 3.7s6-1.5 6-3.7 M4 12h16",
   510	  },
   511	  link: {
   512	    label: "链接",
   513	    s: "M10 14a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1 M14 10a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1",
   514	  },
   515	  h1: {
   516	    label: "一级标题",
   517	    s: "M4 6v12 M12 6v12 M4 12h8 M17 9.5 19.5 8v10",
   518	  },
   519	  h2: {
   520	    label: "二级标题",
   521	    s: "M4 6v12 M12 6v12 M4 12h8 M16.4 10a2.3 2.3 0 0 1 4 1.5c0 2.6-4 3.2-4 6.5H21",
   522	  },
   523	  h3: {
   524	    label: "三级标题",
   525	    s: "M4 6v12 M12 6v12 M4 12h8 M16.4 9h4l-2.4 3.2a3 3 0 1 1-1.6 5",
   526	  },
   527	  h4: {
   528	    label: "四级标题",
   529	    s: "M4 6v12 M12 6v12 M4 12h8 M16.6 8v5.2h3 M19.6 8v8",
   530	  },
   531	  h5: {
   532	    label: "五级标题",
   533	    s: "M4 6v12 M12 6v12 M4 12h8 M16.4 8h4l-.6 3.4h-2.2a2.2 2.2 0 1 0 2.2 2.2",
   534	  },
   535	  h6: {
   536	    label: "六级标题",
   537	    s: "M4 6v12 M12 6v12 M4 12h8 M19.8 8.4a2.2 2.2 0 0 0-2.2 2.2v3.2a2.2 2.2 0 0 0 4.4 0v-1a2.2 2.2 0 0 0-4.4 0",
   538	  },
   539	  bullet: {
   540	    label: "无序列表",
   541	    s: "M9 7h11 M9 12h11 M9 17h11 M4.6 7a1.1 1.1 0 1 0 0-.01 M4.6 12a1.1 1.1 0 1 0 0-.01 M4.6 17a1.1 1.1 0 1 0 0-.01",
   542	  },
   543	  ordered: {
   544	    label: "有序列表",
   545	    s: "M9 7h11 M9 12h11 M9 17h11 M4 5.5 5.4 4.8V8 M3.6 11.4a1.4 1.4 0 0 1 2.6.6c0 1.3-2.6 1.8-2.6 3.2h2.7",
   546	  },
   547	  todo: {
   548	    label: "待办",
   549	    s: "M4.9 4.5h4.2A1.4 1.4 0 0 1 10.5 5.9v4.2a1.4 1.4 0 0 1-1.4 1.4H4.9a1.4 1.4 0 0 1-1.4-1.4V5.9A1.4 1.4 0 0 1 4.9 4.5z M5 7.4 6.2 8.6 8.2 5.8 M12.5 7.5h8 M12.5 15h8 M3.5 15h6",
   550	  },
   551	  quote: {
   552	    label: "引用",
   553	    s: "M5 5v14 M10 7h9 M10 12h9 M10 17h6",
   554	  },
   555	  blockcode: {
   556	    label: "代码块",
   557	    s: "M4.6 4.5h14.8A1.6 1.6 0 0 1 21 6.1v11.8a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 17.9V6.1A1.6 1.6 0 0 1 4.6 4.5z M8.5 9.5 6.5 12l2 2.5 M15.5 9.5 17.5 12l-2 2.5",
   558	  },
   559	  callout: {
   560	    label: "高亮",
   561	    s: "M4.6 5h14.8A1.6 1.6 0 0 1 21 6.6v10.8a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 17.4V6.6A1.6 1.6 0 0 1 4.6 5z M7 12h4 M14 12h3",
   562	  },
   563	  table: {
   564	    label: "表格",
   565	    s: "M4.6 5h14.8A1.6 1.6 0 0 1 21 6.6v10.8a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 17.4V6.6A1.6 1.6 0 0 1 4.6 5z M3 10h18 M9.5 10v9 M15 10v9",
   566	  },
   567	  undo: {
   568	    label: "后退",
   569	    s: "M4.5 9.5h9a4.5 4.5 0 0 1 0 9H9 M8 5.5 4.5 9.5 8 13.5",
   570	  },
   571	  redo: {
   572	    label: "前进",
   573	    s: "M19.5 9.5h-9a4.5 4.5 0 0 0 0 9H15 M16 5.5 19.5 9.5 16 13.5",
   574	  },
   575	  copy: {
   576	    label: "复制选区",
   577	    s: "M10.5 8.5h7A2 2 0 0 1 19.5 10.5v7a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z M15.5 8.5v-2a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2",
   578	  },
   579	  trash: {
   580	    label: "删除",
   581	    s: "M4.5 7h15 M9 7V5.2A1.2 1.2 0 0 1 10.2 4h3.6A1.2 1.2 0 0 1 15 5.2V7 M6.5 7l.8 12.2A1.4 1.4 0 0 0 8.7 20.5h6.6a1.4 1.4 0 0 0 1.4-1.3L17.5 7",
   582	  },
   583	  scissors: {
   584	    label: "剪切",
   585	    s: "M6 9a3 3 0 1 0 0-6 3 3 0 1 0 0 6z M8.12 8.12 12 12 M20 4 8.12 15.88 M6 21a3 3 0 1 0 0-6 3 3 0 1 0 0 6z M14.8 14.8 20 20",
   586	  },
   587	  brush: {
   588	    label: "格式刷",
   589	    s: "M15.5 4.5 10 10l4 4 5.5-5.5a2.8 2.8 0 0 0-4-4z M10 10c-2 0-3.4 1.4-3.4 3.4 0 1.6-1 2.4-2.6 3 2.6 1.6 6.6 1.4 8-1.4",
   590	  },
   591	  alignLeft: {
   592	    label: "左对齐",
   593	    s: "M4 6h16 M4 12h10 M4 18h13",
   594	  },
   595	  alignCenter: {
   596	    label: "居中",
   597	    s: "M4 6h16 M7 12h10 M5.5 18h13",
   598	  },
   599	  alignRight: {
   600	    label: "右对齐",
   601	    s: "M4 6h16 M10 12h10 M7 18h13",
   602	  },
   603	  edit: {
   604	    label: "改写",
   605	    s: "M15.5 4.5 19.5 8.5 8 20l-4.5.5L4 16z",
   606	  },
   607	  globe: {
   608	    label: "翻译",
   609	    s: "M12 3.6a8.4 8.4 0 1 0 0 16.8 8.4 8.4 0 0 0 0-16.8z M3.8 12h16.4 M12 3.6c2.6 2.4 4 5.4 4 8.4s-1.4 6-4 8.4c-2.6-2.4-4-5.4-4-8.4s1.4-6 4-8.4z",
   610	  },
   611	  bulb: {
   612	    label: "提示",
   613	    s: "M9.2 17h5.6 M10 20h4 M12 3.5a5.6 5.6 0 0 1 3 10.3V17H9v-3.2A5.6 5.6 0 0 1 12 3.5z",
   614	  },
   615	  info: {
   616	    label: "信息",
   617	    s: "M12 3.6a8.4 8.4 0 1 0 0 16.8 8.4 8.4 0 0 0 0-16.8z M12 11v5 M12 8.2v.01",
   618	  },
   619	  danger: {
   620	    label: "危险",
   621	    s: "M12 3.6a8.4 8.4 0 1 0 0 16.8 8.4 8.4 0 0 0 0-16.8z M9.4 9.4l5.2 5.2 M14.6 9.4l-5.2 5.2",
   622	  },
   623	  indent: {
   624	    label: "增加缩进",
   625	    s: "M4 6h16 M4 18h16 M9 12h11 M4 9l3 3-3 3",
   626	  },
   627	  outdent: {
   628	    label: "减少缩进",
   629	    s: "M4 6h16 M4 18h16 M9 12h11 M7 9l-3 3 3 3",
   630	  },
   631	  divider: {
   632	    label: "分割线",
   633	    s: "M4 12h16",
   634	  },
   635	  columns1: {
   636	    label: "1 栏",
   637	    s: "M3.5 5.5h17.0v13.0h-17.0z",
   638	  },
   639	  columns2: {
   640	    label: "2 栏",
   641	    s: "M3.5 5.5h17.0v13.0h-17.0z M12.00 5.5V18.5",
   642	  },
   643	  columns3: {
   644	    label: "3 栏",
   645	    s: "M3.5 5.5h17.0v13.0h-17.0z M9.17 5.5V18.5 M14.83 5.5V18.5",
   646	  },
   647	  columns4: {
   648	    label: "4 栏",
   649	    s: "M3.5 5.5h17.0v13.0h-17.0z M7.75 5.5V18.5 M12.00 5.5V18.5 M16.25 5.5V18.5",
   650	  },
   651	  columns5: {
   652	    label: "5 栏",
   653	    s: "M3.5 5.5h17.0v13.0h-17.0z M6.90 5.5V18.5 M10.30 5.5V18.5 M13.70 5.5V18.5 M17.10 5.5V18.5",
   654	  },
   655	  abstract: {
   656	    label: "摘要",
   657	    s: "M8 5h8v2H8z M6 5h12v14H6z M9 10h6 M9 13h6 M9 16h4",
   658	  },
   659	  success: {
   660	    label: "成功",
   661	    s: "M12 3.6a8.4 8.4 0 1 0 0 16.8 8.4 8.4 0 0 0 0-16.8z M8.4 12.2l2.4 2.4 4.6-4.8",
   662	  },
   663	  question: {
   664	    label: "问题",
   665	    s: "M12 3.6a8.4 8.4 0 1 0 0 16.8 8.4 8.4 0 0 0 0-16.8z M9.6 9.2a2.5 2.5 0 0 1 4.8.8c0 1.7-2.4 2-2.4 3.6 M12 16.8v.01",
   666	  },
   667	  failure: {
   668	    label: "失败",
   669	    s: "M5 5h14v14H5z M9 9l6 6 M15 9l-6 6",
   670	  },
   671	  bug: {
   672	    label: "Bug",
   673	    s: "M9 6a3 3 0 0 1 6 0 M7 9h10v6a5 5 0 0 1-10 0z M3.5 10h3.5 M17 10h3.5 M3.5 15h3.5 M17 15h3.5 M8 6l-1.5-2 M16 6l1.5-2",
   674	  },
   675	  example: {
   676	    label: "示例",
   677	    s: "M6 4h9l4 4v12H6z M15 4v4h4 M9 12h7 M9 15h5",
   678	  },
   679	};
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
   131	      "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm0 2v14h14V5z",
   132	    ],
   133	  },
   134	
   135	  // Blockquote — quotation mark.
   136	  FormatQuoteOutlined: {
   137	    kind: "paths",
   138	    paths: [
   139	      "M7.5 11a2.5 2.5 0 0 1 2.5 2.5V17a2.5 2.5 0 0 1-2.5 2.5H4A1.5 1.5 0 0 1 2.5 18V11A6.5 6.5 0 0 1 9 4.5v3A3.5 3.5 0 0 0 5.5 11zm10 0a2.5 2.5 0 0 1 2.5 2.5V17a2.5 2.5 0 0 1-2.5 2.5H14A1.5 1.5 0 0 1 12.5 18V11A6.5 6.5 0 0 1 19 4.5v3A3.5 3.5 0 0 0 15.5 11z",
   140	    ],
   141	  },
   142	
   143	  // Code — </>
   144	  ColumnsOutlined: {
   145	    kind: "paths",
   146	    paths: ["M3.5 4.5h5v15h-5z M10.5 4.5h3v15h-3z M15.5 4.5h5v15h-5z"],
   147	  },
   148	  columns1: {
   149	    kind: "paths",
   150	    stroke: true,
   151	    paths: [columnStrokePath("columns1")],
   152	  },
   153	  columns2: {
   154	    kind: "paths",
   155	    stroke: true,
   156	    paths: [columnStrokePath("columns2")],
   157	  },
   158	  columns3: {
   159	    kind: "paths",
   160	    stroke: true,
   161	    paths: [columnStrokePath("columns3")],
   162	  },
   163	  columns4: {
   164	    kind: "paths",
   165	    stroke: true,
   166	    paths: [columnStrokePath("columns4")],
   167	  },
   168	  columns5: {
   169	    kind: "paths",
   170	    stroke: true,
   171	    paths: [columnStrokePath("columns5")],
   172	  },
   173	  TableGridOutlined: {
   174	    kind: "paths",
   175	    paths: [
   176	      "M3.5 4.5h4.6v4H3.5z M9.7 4.5h4.6v4H9.7z M15.9 4.5h4.6v4h-4.6z",
   177	      "M3.5 10h4.6v4H3.5z M9.7 10h4.6v4H9.7z M15.9 10h4.6v4h-4.6z",
   178	      "M3.5 15.5h4.6v4H3.5z M9.7 15.5h4.6v4H9.7z M15.9 15.5h4.6v4h-4.6z",
   179	    ],
   180	  },
   181	  KanbanOutlined: {
   182	    kind: "paths",
   183	    paths: [
   184	      "M4 19.5V13h3.6v6.5z M10.2 19.5V8h3.6v11.5z M16.4 19.5V4.5h3.6v15z",
   185	      "M3 19.5h18",
   186	    ],
   187	  },
   188	  CssOutlined: {
   189	    kind: "paths",
   190	    paths: ["M9.4 4L7 20 M17 4l-2.4 16 M4.4 9h15.4 M3.6 15h15.4"],
   191	  },
   192	  FlowOutlined: {
   193	    kind: "paths",
   194	    paths: ["M12 3l4.2 4.2L12 11.4 7.8 7.2z M12 11.4v4.2 M9 15.6h6v4.8H9z"],
   195	  },
   196	  BrowserOutlined: {
   197	    kind: "paths",
   198	    paths: [
   199	      "M3 4.5h18v2H3z M3 8h2v11.5H3z M19 8h2v11.5h-2z M3 17.5h18v2H3z",
   200	      "M10.5 10.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z M12.5 13v2l1.8 1",
   201	    ],
   202	  },
   203	  MediaFileOutlined: {
   204	    kind: "paths",
   205	    paths: ["M4 6h11v12H4z M15 10l5-3v10l-5-3z"],
   206	  },
   207	  VideoOutlined: {
   208	    kind: "paths",
   209	    paths: ["M4 6h11v12H4z M15 10l5-3v10l-5-3z"],
   210	  },
   211	  AudioOutlined: {
   212	    kind: "paths",
   213	    paths: [
   214	      "M4 9h4l5-4v14l-5-4H4z",
   215	      "M16 9.5a4 4 0 010 5",
   216	      "M18.5 7a8 8 0 010 10",
   217	    ],
   218	  },
   219	  ScissorsOutlined: {
   220	    kind: "paths",
   221	    paths: [
   222	      "M3.4 4.2l9.2 9.2-1.7 1.7L1.7 5.9z",
   223	      "M20.6 4.2l-9.2 9.2 1.7 1.7 9.2-9.2z",
   224	      "M6 20a2.2 2.2 0 100-4.4A2.2 2.2 0 006 20z",
   225	      "M18 20a2.2 2.2 0 100-4.4A2.2 2.2 0 0018 20z",
   226	    ],
   227	  },
   228	  CodeOutlined: {
   229	    kind: "paths",
   230	    paths: [
   231	      "M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6zm5.2-9.2L19.2 12l-4.6 4.6L16 18l6-6-6-6z",
   232	    ],
   233	  },
   234	  CodeOffOutlined: {
   235	    kind: "paths",
   236	    paths: [
   237	      "M9.2 6.4L4.6 11l4.6 4.6L8 17l-6-6 6-6zm5.6 11.2L19.4 13l-4.6-4.6L16 7l6 6-6 6z",
   238	    ],
   239	  },
   240	
   241	  // List — three horizontal lines with bullet markers.
   242	  ListOutlined: {
   243	    kind: "paths",
   244	    paths: [
   245	      "M4 6h2v2H4V6zm4 0h12v2H8V6zM4 11h2v2H4v-2zm4 0h12v2H8v-2zM4 16h2v2H4v-2zm4 0h12v2H8v-2z",
   246	    ],
   247	  },
   248	
   249	  // Table — grid.
   250	  TableChartOutlined: {
   251	    kind: "paths",
   252	    paths: [
   253	      "M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm1 2v4h6V5zm0 6v4h6v-4zm0 6v4h6v-4zm8-12v4h6V5zm0 6v4h6v-4zm0 6v4h6v-4z",
   254	    ],
   255	  },
   256	
   257	  // Horizontal rule / thematic break.
   258	  HorizontalRuleOutlined: { kind: "paths", paths: ["M3 11h18v2H3z"] },
   259	
   260	  // Image.

exec
/bin/zsh -c "rg -n --hidden --glob '"'!node_modules'"' --glob '"'!target'"' --glob '"'!dist'"' 'snippets|templates|TemplatePicker|slash|commands\\.json|user/commands|data/' src src-tauri docs/design/pluginization-datafile-settings-rail docs/agents docs/research/technical/data-fileization-omarchy-inventory.md 2>/dev/null" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
docs/research/technical/data-fileization-omarchy-inventory.md:47:| snippets（斜杠命令） | `app_config_dir()/snippets/*.md` | frontmatter `id/label/keywords/icon` + 正文即插入文本 | 目录扫描 → 注入斜杠菜单；插入走 `insertCommandTextAt` 单事务可撤销 |
docs/research/technical/data-fileization-omarchy-inventory.md:48:| templates（新建页模板） | `app_config_dir()/templates/*.md` | 文件名即模板名；占位符仅 `{{date}}`/`{{title}}` | 新建页选择后写入；未知占位符原样保留不吞内容 |
docs/research/technical/data-fileization-omarchy-inventory.md:62:| 扩展点 P0 | `2026-11-03-extension-points`（[#76](https://github.com/jianxi-dev/clairis/issues/76)/[#78](https://github.com/jianxi-dev/clairis/issues/78)） | snippets / templates / theme.toml / 能力开关 | ✅ 已归档（4/4 票，票未关需收尾） |
docs/research/technical/data-fileization-omarchy-inventory.md:105:| 3 | 斜杠 snippets | `app_config_dir()/snippets/*.md` | ✅ 已落地 | **直接写文件**，扫描即生效 |
docs/research/technical/data-fileization-omarchy-inventory.md:106:| 4 | 新建页 templates | `app_config_dir()/templates/*.md` | ✅ 已落地 | 直接写文件 |
docs/research/technical/data-fileization-omarchy-inventory.md:122:- **实现骨架已经就位**：三层目录（defaults / user / 运行时）+ 原子写 + 快照回滚 + 热应用轮询，是 Omarchy「扩展点 = 数据文件」在本仓库的落地底座；snippets/templates/theme.toml 三个扩展点已可用（「放一个文件就生效」）。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:21:**术语统一**：目录名与文档统一用 **plugin**（不复用既有「extension」术语，避免混淆）。插件目录定为 `data/plugins/`（独立于 `user/`，用户层）。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:35:| A5 | **片段 / 模板** | `snippets/*.md`、`templates/*.md` 已文件化，斜杠菜单/模板选择器消费 | 配置型 | ✅ 已落地 |
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:68:data/plugins/                     插件根（用户层，独立于 user/）
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:90:- **加载**：启动时同步扫描 `data/plugins/`，逐插件读 manifest、校验权限、解析数据 → 映射到配置/注册表/AGENT 上下文。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:91:- **生命周期裁定（修正 P2）**：**以「重启生效」为主**，不承诺热加载。热加载需先建 watcher 基础设施（与第 2 项 §5.3 一致，`settings.json` 已有 watcher，但 `data/plugins/` 无）。**裁定**：插件改动重启生效，热加载列为后续，不在本批实现。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:111:### 4.6 slash 命令通路（补充 P3 遗漏）
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:113:**现状**：slash 命令是**独立于扩展包的另一条数据文件化通路**，方案此前未单列。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:115:**设计**：slash 命令单独建 `data/plugins/<id>/commands/` 或 `user/commands.json`，与扩展包/技能型插件并列。在清单中显式标注其独立通路，避免与技能型插件混为一谈。实现时定具体落点。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:119:**风险**：AGENT 生成插件无校验——AGENT 可生成任意插件写入 `data/plugins/`，若无校验可能引入无效/恶意插件。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:132:3. **第三批（技能型与 slash 命令）**：A2 SKILL 注入面拼装细化；B6 键位绑定插件化（依赖第 3 项按键分发层重接线）；slash 命令独立通路落点。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:145:3. **P2 生命周期不自洽**：扩展包同步加载无热重载；「重启生效」与「热加载」并存未裁定；插件模板 skill 无注册表登记；目录名/落点未定 → 已采纳，§4.3 裁定重启生效为主、热加载列后续；§2 术语统一 plugin；§4.1 目录落 `data/plugins/`。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:146:4. **P3 遗漏**：capabilities 消费方清单不全；slash 命令独立通路未单列；无风险评估；C5 排除理由缺配置载体证据；A3 用户能力边界未明确 → 已采纳，§4.4 SKILL 注入面、§4.6 slash 命令通路、§4.7 风险评估、§3 C5 配置载体证据、§3 A3 边界。
src-tauri/src/extensions.rs:1://! 用户扩展点（design §D1–D4）：snippets / templates / theme tokens。
src-tauri/src/extensions.rs:35:    pub snippets: Vec<Snippet>,
src-tauri/src/extensions.rs:36:    pub templates: Vec<Template>,
src-tauri/src/extensions.rs:236:/// 扫描 `<dir>/snippets/*.md`。目录不存在返回空；读取失败记 warning。
src-tauri/src/extensions.rs:237:fn scan_snippets(dir: &Path, warnings: &mut Vec<String>) -> Vec<Snippet> {
src-tauri/src/extensions.rs:238:    let dir = dir.join("snippets");
src-tauri/src/extensions.rs:243:            warnings.push(format!("snippets: 无法读取目录（{e}）"));
src-tauri/src/extensions.rs:248:    let mut snippets = Vec::new();
src-tauri/src/extensions.rs:258:        let rel = format!("snippets/{name}");
src-tauri/src/extensions.rs:264:            snippets.push(snippet);
src-tauri/src/extensions.rs:267:    snippets.sort_by(|a, b| a.id.cmp(&b.id));
src-tauri/src/extensions.rs:268:    snippets
src-tauri/src/extensions.rs:271:/// 扫描 `<dir>/templates/*.md`。文件名（去扩展名）即模板名；重名后读覆盖先读。
src-tauri/src/extensions.rs:272:fn scan_templates(dir: &Path, warnings: &mut Vec<String>) -> Vec<Template> {
src-tauri/src/extensions.rs:273:    let dir = dir.join("templates");
src-tauri/src/extensions.rs:278:            warnings.push(format!("templates: 无法读取目录（{e}）"));
src-tauri/src/extensions.rs:283:    let mut templates: BTreeMap<String, Template> = BTreeMap::new();
src-tauri/src/extensions.rs:293:        let rel = format!("templates/{name}");
src-tauri/src/extensions.rs:302:        templates.insert(
src-tauri/src/extensions.rs:311:    templates.into_values().collect()
src-tauri/src/extensions.rs:368:    let snippets = scan_snippets(config_dir, &mut warnings);
src-tauri/src/extensions.rs:369:    let templates = scan_templates(config_dir, &mut warnings);
src-tauri/src/extensions.rs:373:        snippets,
src-tauri/src/extensions.rs:374:        templates,
src-tauri/src/extensions.rs:403:            "snippets/weekly.md",
src-tauri/src/extensions.rs:406:        write_file(base, "templates/日记.md", "# {{title}}\n{{date}}\n");
src-tauri/src/extensions.rs:411:        assert_eq!(snapshot.snippets.len(), 1);
src-tauri/src/extensions.rs:412:        let snippet = &snapshot.snippets[0];
src-tauri/src/extensions.rs:419:        assert_eq!(snapshot.templates.len(), 1);
src-tauri/src/extensions.rs:420:        assert_eq!(snapshot.templates[0].name, "日记");
src-tauri/src/extensions.rs:421:        assert_eq!(snapshot.templates[0].body, "# {{title}}\n{{date}}\n");
src-tauri/src/extensions.rs:428:        write_file(base, "snippets/bad.md", "---\nlabel: 无 id\n---\n正文\n");
src-tauri/src/extensions.rs:432:        assert!(snapshot.snippets.is_empty());
src-tauri/src/extensions.rs:435:            snapshot.warnings[0].contains("snippets/bad.md")
src-tauri/src/extensions.rs:446:        write_file(base, "snippets/bad.md", "---\nid: Bad_ID\n---\n正文\n");
src-tauri/src/extensions.rs:450:        assert!(snapshot.snippets.is_empty());
src-tauri/src/extensions.rs:464:        write_file(base, "snippets/a.md", "id: no-frontmatter\n---\n正文\n");
src-tauri/src/extensions.rs:466:        write_file(base, "snippets/b.md", "---\nid: unclosed\n正文\n");
src-tauri/src/extensions.rs:470:            "snippets/c.md",
src-tauri/src/extensions.rs:476:        assert!(snapshot.snippets.is_empty());
src-tauri/src/extensions.rs:493:        assert!(snapshot.snippets.is_empty());
src-tauri/src/extensions.rs:494:        assert!(snapshot.templates.is_empty());
src-tauri/src/extensions.rs:628:        write_file(base, "snippets/cn.md", &format!("---\nid: cn\n---\n{body}"));
src-tauri/src/extensions.rs:632:        assert_eq!(snapshot.snippets.len(), 1);
src-tauri/src/extensions.rs:633:        assert_eq!(snapshot.snippets[0].body, body);
src-tauri/src/extensions.rs:640:        write_file(base, "snippets/a.md", "---\nid: a\n---\n\n\n正文\n");
src-tauri/src/extensions.rs:645:        assert_eq!(snapshot.snippets[0].body, "\n正文\n");
src-tauri/src/extensions.rs:652:        write_file(base, "snippets/a.md", "---\nid: plain\n---\n正文\n");
src-tauri/src/extensions.rs:656:        assert_eq!(snapshot.snippets[0].label, "plain");
src-tauri/src/extensions.rs:657:        assert!(snapshot.snippets[0].keywords.is_empty());
src-tauri/src/extensions.rs:658:        assert!(snapshot.snippets[0].icon.is_none());
src-tauri/src/extensions.rs:667:        write_file(base, "templates/a.md", "A\n");
src-tauri/src/extensions.rs:668:        write_file(base, "templates/b.md", "B\n");
src-tauri/src/extensions.rs:672:        assert_eq!(snapshot.templates.len(), 2);
src-tauri/src/extensions.rs:673:        let names: Vec<_> = snapshot.templates.iter().map(|t| t.name.clone()).collect();
src-tauri/src/extensions.rs:682:        write_file(base, "snippets/readme.txt", "---\nid: x\n---\n正文\n");
src-tauri/src/extensions.rs:683:        write_file(base, "templates/notes.txt", "正文\n");
src-tauri/src/extensions.rs:687:        assert!(snapshot.snippets.is_empty());
src-tauri/src/extensions.rs:688:        assert!(snapshot.templates.is_empty());
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:20:- **用户层目录是 AGENT 写入口**：`user/` 是核心写入口，扩展点目录（snippets/templates/theme.toml）也在用户层，但不在 `user/` 子目录下——边界表述按此校正。
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:33:| `snippets/*.md`、`templates/*.md`、`theme.toml` | 扩展点数据文件 | 位于 `app_config_dir()` 根，用户层 |
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:55:| 片段 / 模板 | `snippets/*.md`、`templates/*.md` | 斜杠菜单 / 模板选择器 | ✅ 已落地 |
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:102:app_config_dir 根：snippets/ templates/ theme.toml   扩展点（用户层，不在 user/ 子目录）
src/lib/export/docx.ts:107:/** 收集 markdown 里引用的本地图片（远程/data/绝对路径跳过），读不到的直接略过。 */
docs/agents/data-surface.md:16:仓库已经有三层配置底座（defaults / user / state + 快照 + 热应用）、三个文件型扩展点（snippets / templates / theme.toml）和一条 AI 受控写通路（`patch_config`）。缺的不是机制，是**判断某次改动该不该走这条通路、以及走了之后怎么证明真落地**。
src-tauri/src/media_protocol.rs:57:    // percent-decode, restore leading slash
src-tauri/src/commands/config_cmd.rs:56:/// Scan user extension directories (snippets / templates / theme.toml).
src/lib/export/png.ts:104:      (_m, tag: string, attrs: string, slash: string) =>
src/lib/export/png.ts:105:        `<${tag}${fixBareAttrs(attrs)}${slash}>`,
src/lib/mediaUrl.ts:11: * 外部链接（http/https/data/已有协议）原样返回——用户自己写的远程图片不该被改写。
src/lib/mediaUrl.ts:95:  const slash = docPath.lastIndexOf("/");
src/lib/mediaUrl.ts:96:  if (slash <= 0) return null;
src/lib/mediaUrl.ts:97:  const segments = [...docPath.slice(0, slash).split("/"), ...clean.split("/")];
src/App.tsx:11:import TemplatePicker from "./components/TemplatePicker";
src/App.tsx:49:} from "./lib/extensions/templates";
src/App.tsx:50:import type { Template } from "./lib/extensions/templates";
src/App.tsx:85:  const [templates, setTemplates] = useState<Template[]>([]);
src/App.tsx:215:    if (templates.length > 0) {
src/App.tsx:220:  }, [templates]);
src/App.tsx:226:      setTemplates(bundle.templates);
src/App.tsx:992:      {pickerOpen && templates.length > 0 && (
src/App.tsx:993:        <TemplatePicker
src/App.tsx:994:          templates={templates}
src/editors/slash-filter.ts:1:/* 斜杠菜单过滤（移植自 md-bundle packages/editor/src/slash-filter.ts）。
src/editors/smart-input.ts:17:import { isSlashMenuOpen, openSlashMenuAtSlash } from "./slash";
src/editors/smart-input.ts:32:/** 组合守卫读取口径：WeakSet 与 CM6 自身状态取交集（同 slash.ts，#915）。 */
src/editors/smart-input.ts:642: * 不委托 slash.ts 的 `insertSlashChar`：它的组合守卫是模块级状态（#915），
src/editors/user-extensions.ts:1:/* 用户片段（snippets）接入斜杠菜单。
src/editors/user-extensions.ts:3: * Rust 侧 `list_extensions` 返回的 `ExtensionsSnapshot` 里，`snippets` 是
src/editors/user-extensions.ts:7: * 模板与主题 token 的前端接入见 `src/lib/extensions/`（bundle / templates /
src/editors/user-extensions.ts:8: * theme-tokens），本模块只管 snippets。
src/editors/user-extensions.ts:14:import type { SlashCommand } from "./slash";
src/editors/user-extensions.ts:16:/** 用户片段的原始形状（`list_extensions` 的 `snippets[]` 元素）。 */
src/editors/user-extensions.ts:87:/** 从 `list_extensions` 返回值里取 snippets；形状不对返回空列表。 */
src/editors/user-extensions.ts:90:  const snippets = result.snippets;
src/editors/user-extensions.ts:91:  if (!Array.isArray(snippets)) return [];
src/editors/user-extensions.ts:93:  for (const entry of snippets) {
src/editors/user-extensions.ts:101: * 调 `list_extensions` 并把 `snippets` 映射成斜杠命令。
src/editors/slash.ts:1:/* 斜杠命令菜单（移植自 md-bundle packages/editor/src/slash.ts）。
src/editors/slash.ts:9: *   `[slashPos + 1, head]` 推导过滤词，所以过滤不会和「文档变更即关闭」打架，
src/editors/slash.ts:12: * - `slashKeymap()` 返回 `Prec.high(...)`，所以它的 Enter/Arrow/Escape/`/`
src/editors/slash.ts:33:import { TABLE_SIZE_QUERY, filterSlashCommands } from "./slash-filter";
src/editors/slash.ts:78:   * 的过滤词）还在。`applyCommand` 自己替换 `[slashPos, head]`，所以返回的
src/editors/slash.ts:184:function slashKeybind(id: string): string {
src/editors/slash.ts:394:  if (!cmd) throw new Error(`unknown slash command: ${id}`);
src/editors/slash.ts:485:/** `slash`：用户输入 `/`，菜单拥有 `[slashPos, head]`，取消时必须删掉这段。
src/editors/slash.ts:495:type SlashMenuTrigger = "slash" | "anchor" | "below" | "context" | "cell";
src/editors/slash.ts:521:  slashPos: number;
src/editors/slash.ts:589:/** 取消挂起的锚点关闭计时（块菜单面板指针回移时清掉 slash 侧计时器，D1）。 */
src/editors/slash.ts:604:      if (state && state.open && state.trigger !== "slash") closeMenu(view);
src/editors/slash.ts:673:  if (state.trigger !== "slash") {
src/editors/slash.ts:679:  const { slashPos } = state;
src/editors/slash.ts:680:  // 关闭前读触发符：closeMenu 之后状态就没了，而越界的 slashPos（文档被整体
src/editors/slash.ts:682:  const hasTrigger = view.state.doc.sliceString(slashPos, slashPos + 1) === "/";
src/editors/slash.ts:683:  const to = Math.min(slashPos + 1 + state.query.length, view.state.doc.length);
src/editors/slash.ts:687:    changes: { from: slashPos, to },
src/editors/slash.ts:688:    selection: { anchor: slashPos },
src/editors/slash.ts:826:      row.className = "mdb-slash-item";
src/editors/slash.ts:834:        icon.className = "mdb-slash-item-icon";
src/editors/slash.ts:845:      text.className = "mdb-slash-item-label";
src/editors/slash.ts:852:        hint.className = "mdb-slash-item-hint";
src/editors/slash.ts:891:  grid.className = "mdb-slash-grid-menu";
src/editors/slash.ts:901:      header.className = "mdb-slash-group";
src/editors/slash.ts:908:    cell.className = "mdb-slash-item";
src/editors/slash.ts:916:      icon.className = "mdb-slash-item-icon";
src/editors/slash.ts:928:    label.className = "mdb-slash-item-label";
src/editors/slash.ts:932:    const keybind = slashKeybind(cmd.id);
src/editors/slash.ts:935:      kbd.className = "mdb-slash-item-kbd";
src/editors/slash.ts:944:      hint.className = "mdb-slash-item-hint";
src/editors/slash.ts:979:    empty.className = "mdb-slash-empty";
src/editors/slash.ts:1067:  // 标题与 N×M 读数。两类浮层共用 .mdb-slash-grid-head / -title / -label，
src/editors/slash.ts:1071:  head.className = "mdb-slash-grid-head";
src/editors/slash.ts:1075:  title.className = "mdb-slash-grid-title";
src/editors/slash.ts:1079:  label.className = "mdb-slash-grid-label";
src/editors/slash.ts:1089:  wrap.className = "mdb-slash-grid";
src/editors/slash.ts:1131:      cell.className = "mdb-slash-grid-cell";
src/editors/slash.ts:1160:      ?.closest(".mdb-slash-grid-cell") as HTMLElement | null;
src/editors/slash.ts:1187:  slashPos: number,
src/editors/slash.ts:1189:  trigger: SlashMenuTrigger = "slash",
src/editors/slash.ts:1201:  menu.className = "mdb-slash-menu";
src/editors/slash.ts:1202:  menu.dataset.testid = "slash-menu";
src/editors/slash.ts:1221:    slashPos,
src/editors/slash.ts:1248:    id: `slash:${trigger}:${slashPos}`,
src/editors/slash.ts:1262:  } else positionMenu(view, menu, slashPos, trigger);
src/editors/slash.ts:1435:  slashPos: number,
src/editors/slash.ts:1447:      isAnchoredTrigger(trigger) ? slashPos : slashPos + 1,
src/editors/slash.ts:1496:  const trigger = state?.trigger ?? "slash";
src/editors/slash.ts:1534:    const from = state ? state.slashPos : head - 1;
src/editors/slash.ts:1540:      if (trigger === "slash") removeSlashTrigger(view, from, query);
src/editors/slash.ts:1545:    // （替换 `[slashPos, head]`）是基于光标的。
src/editors/slash.ts:1549:        if (trigger === "slash") removeSlashTrigger(view, from, query);
src/editors/slash.ts:1562:      // 斜杠：替换 `[slashPos, head]`——`/` 加上已输入的过滤词。
src/editors/slash.ts:1569:    if (trigger === "slash") dismissMenu(view);
src/editors/slash.ts:1577:  const from = state ? state.slashPos : head - 1;
src/editors/slash.ts:1683:    flyout.className = "mdb-slash-flyout";
src/editors/slash.ts:1698:      id: `slash-flyout:${state.slashPos}`,
src/editors/slash.ts:1742:    row.className = "mdb-slash-flyout-item";
src/editors/slash.ts:1749:    icon.className = "mdb-slash-flyout-icon";
src/editors/slash.ts:1760:    label.className = "mdb-slash-flyout-label";
src/editors/slash.ts:1764:    const keybind = slashKeybind(cmd.id);
src/editors/slash.ts:1767:      kbd.className = "mdb-slash-flyout-kbd";
src/editors/slash.ts:1773:    hint.className = "mdb-slash-flyout-hint";
src/editors/slash.ts:1797:    ".mdb-slash-flyout-item",
src/editors/slash.ts:1859:const slashComposingViews = new WeakSet<EditorView>();
src/editors/slash.ts:1865:  if (!slashComposingViews.has(view)) return false;
src/editors/slash.ts:1867:    slashComposingViews.delete(view);
src/editors/slash.ts:1924: * 在文档中已存在的 `/`（位于 `slashPos`）处打开菜单，不插入字符。
src/editors/slash.ts:1925: * 与 `openSlashMenuAtCursor` 的差别是 slashPos 为斜杠本身的下标，
src/editors/slash.ts:1930:  slashPos: number,
src/editors/slash.ts:1933:  openMenu(view, slashPos, commands ?? getSlashCommands());
src/editors/slash.ts:1937:export function slashMenuSelectNext(view: EditorView): boolean {
src/editors/slash.ts:1955:export function slashMenuSelectPrev(view: EditorView): boolean {
src/editors/slash.ts:1980:  const from = state.slashPos;
src/editors/slash.ts:1986:    // 上下文触发（#742 评审）：网格命令也必须走宿主写回。context 的 slashPos
src/editors/slash.ts:2013:export function slashMenuApply(view: EditorView): boolean {
src/editors/slash.ts:2042:export function slashMenuSubmenuEnter(view: EditorView): boolean {
src/editors/slash.ts:2068:export function slashMenuSubmenuBack(view: EditorView): boolean {
src/editors/slash.ts:2092:export function slashMenuClose(view: EditorView): boolean {
src/editors/slash.ts:2109: * 读取 `/` 之后输入的过滤词：`slashPos + 1` 到光标之间的字符。文档不再像
src/editors/slash.ts:2118:  if (head < state.slashPos + 1) return null;
src/editors/slash.ts:2119:  const text = editorState.doc.sliceString(state.slashPos, head);
src/editors/slash.ts:2145:    editorState.selection.main.head === state.slashPos + 1 + state.query.length
src/editors/slash.ts:2165:    positionMenu(view, state.dom, state.slashPos, state.trigger);
src/editors/slash.ts:2204:    if (state.trigger !== "slash") {
src/editors/slash.ts:2235: * 跟踪斜杠菜单的 IME 组合状态。写入 slashComposing，让 insertSlashChar 在
src/editors/slash.ts:2240:const slashCompositionGuard = ViewPlugin.define((view) => {
src/editors/slash.ts:2245:      slashComposingViews.add(view);
src/editors/slash.ts:2250:    slashComposingViews.delete(view);
src/editors/slash.ts:2314:    if (state.trigger !== "slash") {
src/editors/slash.ts:2332:export function slashKeymap(
src/editors/slash.ts:2345:        { key: "ArrowDown", run: (view) => slashMenuSelectNext(view) },
src/editors/slash.ts:2346:        { key: "ArrowUp", run: (view) => slashMenuSelectPrev(view) },
src/editors/slash.ts:2347:        { key: "ArrowRight", run: (view) => slashMenuSubmenuEnter(view) },
src/editors/slash.ts:2348:        { key: "ArrowLeft", run: (view) => slashMenuSubmenuBack(view) },
src/editors/slash.ts:2349:        { key: "Enter", run: (view) => slashMenuApply(view) },
src/editors/slash.ts:2350:        { key: "Escape", run: (view) => slashMenuClose(view) },
src/editors/slash.ts:2356:    slashCompositionGuard,
src/lib/extensions/bundle.ts:1:/* 扩展 bundle：一次 `list_extensions` 调用拿回 templates + theme tokens + warnings。
src/lib/extensions/bundle.ts:4: * snippets 映射成斜杠命令）；本模块负责新建页模板与主题 token。
src/lib/extensions/bundle.ts:9:import type { Template } from "./templates";
src/lib/extensions/bundle.ts:14:  templates: Template[];
src/lib/extensions/bundle.ts:19:/** 一次 `list_extensions` 调用解析出的三类扩展数据（snippets 供斜杠菜单）。 */
src/lib/extensions/bundle.ts:21:  snippets: UserSnippet[];
src/lib/extensions/bundle.ts:22:  templates: Template[];
src/lib/extensions/bundle.ts:43:  const templates = result.templates;
src/lib/extensions/bundle.ts:44:  if (!Array.isArray(templates)) return [];
src/lib/extensions/bundle.ts:46:  for (const entry of templates) {
src/lib/extensions/bundle.ts:78:    templates: extractTemplates(result),
src/lib/extensions/bundle.ts:95:    return { templates: [], themeTokens: {}, warnings: [] };
src/lib/extensions/bundle.ts:100: * 调一次 `list_extensions`，解析 snippets / templates / theme tokens 三类。
src/lib/extensions/bundle.ts:110:      snippets: extractSnippets(result),
src/lib/extensions/bundle.ts:111:      templates: bundle.templates,
src/lib/extensions/bundle.ts:115:    return { snippets: [], templates: [], themeTokens: {} };
src/editors/decorations/fileEmbed.ts:115:  const slash = clean.lastIndexOf("/");
src/editors/decorations/fileEmbed.ts:116:  const name = slash >= 0 ? clean.slice(slash + 1) : clean;
src/lib/extensions/templates.ts:3: * `list_extensions` 返回的 `templates[]` 元素形状；正文里的占位符仅两个：
src/editors/decorations/columns.ts:20:  slashMenuApply,
src/editors/decorations/columns.ts:21:  slashMenuClose,
src/editors/decorations/columns.ts:22:  slashMenuSelectNext,
src/editors/decorations/columns.ts:23:  slashMenuSelectPrev,
src/editors/decorations/columns.ts:26:} from "../slash";
src/editors/decorations/columns.ts:99:  mode: "slash" | "handle" | null;
src/editors/decorations/columns.ts:100:  slashPos: number;
src/editors/decorations/columns.ts:109:function slashAnchor(area: HTMLTextAreaElement): number {
src/editors/decorations/columns.ts:118: * `slashMode` 为 true 时是查询模式：`/` 保留在 textarea 内作查询锚点，选中替换
src/editors/decorations/columns.ts:119: * `[slashPos - 1, caret]`，取消回滚 `/query`。为 false 时是「+」手柄的非查询
src/editors/decorations/columns.ts:127:  slashMode: boolean,
src/editors/decorations/columns.ts:131:  entry.mode = slashMode ? "slash" : "handle";
src/editors/decorations/columns.ts:132:  entry.slashPos = slashMode ? slashAnchor(area) : -1;
src/editors/decorations/columns.ts:213:    slashPos: -1,
src/editors/decorations/columns.ts:216:      entry.slashPos = -1;
src/editors/decorations/columns.ts:220:      if (entry.mode === "slash" && entry.slashPos >= 0 && area.isConnected) {
src/editors/decorations/columns.ts:222:          entry.slashPos,
src/editors/decorations/columns.ts:226:          area.value.slice(0, entry.slashPos - 1) + area.value.slice(end);
src/editors/decorations/columns.ts:227:        area.setSelectionRange(entry.slashPos - 1, entry.slashPos - 1);
src/editors/decorations/columns.ts:236:      if (entry.mode === "slash" && entry.slashPos >= 0) {
src/editors/decorations/columns.ts:238:          entry.slashPos,
src/editors/decorations/columns.ts:242:          area.value.slice(0, entry.slashPos - 1) +
src/editors/decorations/columns.ts:245:        const caret = entry.slashPos - 1 + text.length;
src/editors/decorations/columns.ts:274:        slashMenuApply(view);
src/editors/decorations/columns.ts:279:        slashMenuSelectNext(view);
src/editors/decorations/columns.ts:284:        slashMenuSelectPrev(view);
src/editors/decorations/columns.ts:289:        slashMenuClose(view);
src/editors/decorations/columns.ts:306:    if (entry.mode !== null && isSlashMenuOpen(view)) slashMenuClose(view);
src/editors/decorations/columns.ts:313:    if (entry.mode === "slash") {
src/editors/decorations/columns.ts:315:      if (entry.slashPos < 0 || area.value[entry.slashPos - 1] !== "/") {
src/editors/decorations/columns.ts:321:      if (caret < entry.slashPos) {
src/editors/decorations/columns.ts:325:      updateSlashMenuQuery(view, area.value.slice(entry.slashPos, caret));
src/editors/decorations/columns.ts:531:        slashMenuClose(view);
src/editors/decorations/columns.ts:544:      const menu = view.dom.querySelector<HTMLElement>(".mdb-slash-menu");
src/editors/decorations/callout.ts:34:  slashMenuApply,
src/editors/decorations/callout.ts:35:  slashMenuClose,
src/editors/decorations/callout.ts:36:  slashMenuSelectNext,
src/editors/decorations/callout.ts:37:  slashMenuSelectPrev,
src/editors/decorations/callout.ts:40:} from "../slash";
src/editors/decorations/callout.ts:157:  const snippets = getCalloutSlashCommands().filter(
src/editors/decorations/callout.ts:160:  return [...global, ...snippets];
src/editors/decorations/callout.ts:165:  mode: "slash" | "handle" | null;
src/editors/decorations/callout.ts:166:  slashPos: number;
src/editors/decorations/callout.ts:176:function slashAnchor(area: HTMLTextAreaElement): number {
src/editors/decorations/callout.ts:185: * 与分栏（#742）同构：`slashMode` 为 true 时是查询模式（`/` 保留在 textarea 内
src/editors/decorations/callout.ts:186: * 作查询锚点，选中替换 `[slashPos - 1, caret]`，取消回滚 `/query`）；为 false 时是
src/editors/decorations/callout.ts:194:  slashMode: boolean,
src/editors/decorations/callout.ts:198:  entry.mode = slashMode ? "slash" : "handle";
src/editors/decorations/callout.ts:199:  entry.slashPos = slashMode ? slashAnchor(area) : -1;
src/editors/decorations/callout.ts:295:    slashPos: -1,
src/editors/decorations/callout.ts:298:      entry.slashPos = -1;
src/editors/decorations/callout.ts:302:      if (entry.mode === "slash" && entry.slashPos >= 0 && editor.isConnected) {
src/editors/decorations/callout.ts:304:          entry.slashPos,
src/editors/decorations/callout.ts:308:          editor.value.slice(0, entry.slashPos - 1) + editor.value.slice(end);
src/editors/decorations/callout.ts:309:        editor.setSelectionRange(entry.slashPos - 1, entry.slashPos - 1);
src/editors/decorations/callout.ts:320:      if (entry.mode === "slash" && entry.slashPos >= 0) {
src/editors/decorations/callout.ts:322:          entry.slashPos,
src/editors/decorations/callout.ts:326:          editor.value.slice(0, entry.slashPos - 1) +
src/editors/decorations/callout.ts:329:        const next = entry.slashPos - 1 + text.length;
src/editors/decorations/callout.ts:367:    if (entry.mode === "slash") {
src/editors/decorations/callout.ts:372:      if (entry.slashPos < 0 || editor.value[entry.slashPos - 1] !== "/") {
src/editors/decorations/callout.ts:378:      if (at < entry.slashPos) {
src/editors/decorations/callout.ts:382:      updateSlashMenuQuery(view, editor.value.slice(entry.slashPos, at));
src/editors/decorations/callout.ts:404:        slashMenuApply(view);
src/editors/decorations/callout.ts:409:        slashMenuSelectNext(view);
src/editors/decorations/callout.ts:414:        slashMenuSelectPrev(view);
src/editors/decorations/callout.ts:419:        slashMenuClose(view);
src/editors/decorations/callout.ts:432:    if (entry.mode !== null && isSlashMenuOpen(view)) slashMenuClose(view);
src/editors/setup.ts:31:import { slashKeymap } from "./slash";
src/editors/setup.ts:167:        slashKeymap(),
src/styles/editor.css:1676:/* ── 斜杠命令菜单（mdb-slash-*，移植自 md-bundle） ──────────
src/styles/editor.css:1677: * 定位（left/top/max-height）由 slash.ts 在运行时按光标/单元格坐标写入，
src/styles/editor.css:1679:.mdb-slash-menu,
src/styles/editor.css:1680:.mdb-slash-flyout {
src/styles/editor.css:1695:.mdb-slash-flyout {
src/styles/editor.css:1700:.mdb-slash-grid-menu {
src/styles/editor.css:1707:.mdb-slash-group {
src/styles/editor.css:1718:.mdb-slash-item {
src/styles/editor.css:1733:.mdb-slash-item:hover {
src/styles/editor.css:1737:.mdb-slash-item[data-selected="true"] {
src/styles/editor.css:1742:.mdb-slash-item-icon,
src/styles/editor.css:1743:.mdb-slash-flyout-icon {
src/styles/editor.css:1753:.mdb-slash-item-icon[data-glyph="emoji"],
src/styles/editor.css:1754:.mdb-slash-flyout-icon[data-glyph="emoji"] {
src/styles/editor.css:1758:.mdb-slash-item-label {
src/styles/editor.css:1766:.mdb-slash-item-kbd,
src/styles/editor.css:1767:.mdb-slash-flyout-kbd {
src/styles/editor.css:1775:.mdb-slash-flyout-kbd {
src/styles/editor.css:1780:.mdb-slash-item-hint,
src/styles/editor.css:1781:.mdb-slash-flyout-hint {
src/styles/editor.css:1787:.mdb-slash-flyout-hint {
src/styles/editor.css:1792:.mdb-slash-flyout-item {
src/styles/editor.css:1800:.mdb-slash-flyout-item:hover {
src/styles/editor.css:1804:.mdb-slash-flyout-item[data-selected="true"] {
src/styles/editor.css:1809:.mdb-slash-empty {
src/styles/editor.css:1817:.mdb-slash-grid-head {
src/styles/editor.css:1823:.mdb-slash-grid-head[data-kind="columns"] {
src/styles/editor.css:1830:.mdb-slash-grid-title {
src/styles/editor.css:1835:.mdb-slash-grid-head[data-kind="columns"] .mdb-slash-grid-title {
src/styles/editor.css:1839:.mdb-slash-grid-label {
src/styles/editor.css:1845:.mdb-slash-grid-head[data-kind="columns"] .mdb-slash-grid-label {
src/styles/editor.css:1851:.mdb-slash-grid {
src/styles/editor.css:1857:.mdb-slash-grid-cell {
src/styles/editor.css:1866:.mdb-slash-grid-cell[data-on="true"] {
src/styles/editor.css:1872:.mdb-slash-grid[data-kind="columns"] {
src/styles/editor.css:1876:.mdb-slash-grid[data-kind="columns"] .mdb-slash-grid-cell {
src/styles/editor.css:1882: * 面板宽 176 / 行高 36 由 slash.ts 用 menu-metrics 常量在运行时写入。 */
src/styles/editor.css:1928:.cm-add-list .mdb-slash-item {
src/editors/decorations/callout-insert.ts:9:import type { SlashCommand } from "../slash";
src/__tests__/editor/callout-insert.test.ts:21:  slashMenuApply,
src/__tests__/editor/callout-insert.test.ts:22:  slashMenuClose,
src/__tests__/editor/callout-insert.test.ts:24:} from "../../editors/slash";
src/__tests__/editor/callout-insert.test.ts:48:describe("callout editor slash context (#743)", () => {
src/__tests__/editor/callout-insert.test.ts:115:    expect(view.dom.querySelectorAll(".mdb-slash-menu")).toHaveLength(1);
src/__tests__/editor/callout-insert.test.ts:126:    expect(slashMenuApply(view)).toBe(true);
src/__tests__/editor/callout-insert.test.ts:142:    expect(slashMenuClose(view)).toBe(true);
src/__tests__/editor/callout-insert.test.ts:153:    expect(slashMenuApply(view)).toBe(true);
src/__tests__/editor/callout-insert.test.ts:172:    expect(view.dom.querySelectorAll(".mdb-slash-menu")).toHaveLength(1);
src/__tests__/editor/callout-insert.test.ts:175:    expect(slashMenuClose(view)).toBe(true);
src/__tests__/editor/callout-insert.test.ts:186:    expect(view.dom.querySelectorAll(".mdb-slash-menu")).toHaveLength(1);
src/editors/decorations/table.ts:31:  slashMenuApply,
src/editors/decorations/table.ts:32:  slashMenuClose,
src/editors/decorations/table.ts:33:  slashMenuSelectNext,
src/editors/decorations/table.ts:34:  slashMenuSelectPrev,
src/editors/decorations/table.ts:38:} from "../slash";
src/editors/decorations/table.ts:500:    if (contextQueryStart >= 0 && isSlashMenuOpen(view)) slashMenuClose(view);
src/editors/decorations/table.ts:610:        slashMenuApply(view);
src/editors/decorations/table.ts:615:        slashMenuSelectNext(view);
src/editors/decorations/table.ts:620:        slashMenuSelectPrev(view);
src/editors/decorations/table.ts:625:        slashMenuClose(view);
src/editors/decorations/table.ts:1058:      // `.cm-table-cell-handle` 是接线/外部点击守卫（`slash.ts`）；`.mdb-table-cell-handle`
src/editors/decorations/table.ts:1223:        if (target?.closest?.(".mdb-slash-menu")) return;
src/__tests__/editor/testEditor.ts:5:import { slashKeymap, type SlashCommand } from "../../editors/slash";
src/__tests__/editor/testEditor.ts:15: * 真实消费者在 `slashKeymap()` 之前挂了 `basicSetup`（含 `defaultKeymap`）；
src/__tests__/editor/testEditor.ts:29:      : [slashKeymap(options.commands ? { commands: options.commands } : {})]),
src/lib/mdpkg/vendor/mdpkg-web.js:1188:    var snippets = {};
src/lib/mdpkg/vendor/mdpkg-web.js:1192:        code: snippets[f.code] || (snippets[f.code] = new code_1._Code(f.code))
src/lib/mdpkg/vendor/mdpkg-web.js:4062:        parsed.error = "URI authority must not contain a literal backslash.";
src/lib/mdpkg/vendor/mdpkg-web.js:4071:            parsed.error = parsed.error || "URI authority must not contain a literal backslash.";
src/lib/mdpkg/vendor/mdpkg-web.js:13405:      const slash = code4 === 47;
src/lib/mdpkg/vendor/mdpkg-web.js:13407:      if (!slash && !closingTag && htmlRawNames.includes(name)) {
src/lib/mdpkg/vendor/mdpkg-web.js:13413:        if (slash) {
src/lib/mdpkg/vendor/mdpkg-web.js:16641:  return (match.index === 0 || unicodeWhitespace(code4) || unicodePunctuation(code4)) && // If it’s an email, the previous character should not be a slash.
src/lib/mdpkg/vendor/mdpkg-web.js:20950:  const slash = url.indexOf("/");
src/lib/mdpkg/vendor/mdpkg-web.js:20952:  slash > -1 && colon > slash || questionMark > -1 && colon > questionMark || numberSign > -1 && colon > numberSign) {
src/lib/mdpkg/vendor/mdpkg-web.js:22348:  "Oslash",
src/lib/mdpkg/vendor/mdpkg-web.js:22404:  "oslash",
src/lib/mdpkg/vendor/mdpkg-web.js:22489:  Oslash: "\xD8",
src/lib/mdpkg/vendor/mdpkg-web.js:22521:  oslash: "\xF8",
src/components/TemplatePicker.tsx:3:import type { Template } from "../lib/extensions/templates";
src/components/TemplatePicker.tsx:5:interface TemplatePickerProps {
src/components/TemplatePicker.tsx:6:  templates: Template[];
src/components/TemplatePicker.tsx:16:export default function TemplatePicker({
src/components/TemplatePicker.tsx:17:  templates,
src/components/TemplatePicker.tsx:21:}: TemplatePickerProps) {
src/components/TemplatePicker.tsx:55:          {templates.map((template) => (
src/editors/orchestration/block-handle.ts:34:} from "../slash";
src/editors/orchestration/block-handle.ts:601:            .querySelector<HTMLElement>(".mdb-slash-menu")
src/editors/orchestration/block-handle.ts:961:    // 把光标放到空行起点，菜单随即在该处打开（slash.ts 用光标定位）。
src/editors/orchestration/block-menu.ts:15:} from "../slash";
src/editors/orchestration/block-menu.ts:104:const SECONDARY_PANEL_SEL = "[data-block-flyout], .mdb-slash-menu";
src/editors/orchestration/block-menu.ts:366:  // 指针回移到父面板时，slash 侧的锚点关闭计时器也要一并清掉（D1）：否则从
src/editors/orchestration/block-menu.ts:879:      const slashMenu = view.dom.querySelector<HTMLElement>(".mdb-slash-menu");
src/editors/orchestration/block-menu.ts:880:      if (slashMenu) {
src/editors/orchestration/block-menu.ts:881:        slashMenu.addEventListener("pointerenter", () =>
src/editors/orchestration/block-menu.ts:888:        slashMenu.addEventListener("pointerleave", (event) => {
src/__tests__/lib/templates.test.ts:6:} from "../../lib/extensions/templates";
src/__tests__/lib/templates.test.ts:81:      path: "/Users/test/.config/clairis/templates/日记.md",
src/__tests__/lib/templates.test.ts:83:    expect(template.path).toContain("templates");
src/__tests__/lib/templates.test.ts:88:  it("一次调用解析 templates 与 theme tokens", async () => {
src/__tests__/lib/templates.test.ts:90:      snippets: [],
src/__tests__/lib/templates.test.ts:91:      templates: [{ name: "日记", body: "# {{title}}", path: "/x/日记.md" }],
src/__tests__/lib/templates.test.ts:95:    expect(snapshot.templates).toEqual([
src/__tests__/lib/templates.test.ts:104:        snippets: [],
src/__tests__/lib/templates.test.ts:105:        templates: [],
src/__tests__/lib/templates.test.ts:109:    ).resolves.toMatchObject({ templates: [] });
src/__tests__/lib/templates.test.ts:117:    ).resolves.toEqual({ snippets: [], templates: [], themeTokens: {} });
src/__tests__/lib/templates.test.ts:122:      snippets: [],
src/__tests__/lib/templates.test.ts:123:      templates: [],
src/__tests__/editor/slash.test.ts:11:  slashKeymap,
src/__tests__/editor/slash.test.ts:12:  slashMenuApply,
src/__tests__/editor/slash.test.ts:14:  slashMenuClose,
src/__tests__/editor/slash.test.ts:15:  slashMenuSelectNext,
src/__tests__/editor/slash.test.ts:16:  slashMenuSelectPrev,
src/__tests__/editor/slash.test.ts:17:  slashMenuSubmenuBack,
src/__tests__/editor/slash.test.ts:18:  slashMenuSubmenuEnter,
src/__tests__/editor/slash.test.ts:22:} from "../../editors/slash";
src/__tests__/editor/slash.test.ts:23:import { filterSlashCommands } from "../../editors/slash-filter";
src/__tests__/editor/slash.test.ts:47:describe("slash commands", () => {
src/__tests__/editor/slash.test.ts:55:    // 走真实消费者接缝：markdown + 智能输入 + slashKeymap()。
src/__tests__/editor/slash.test.ts:92:  it('typing "/" inserts the slash and opens the icon-grid menu', () => {
src/__tests__/editor/slash.test.ts:96:    expect(view.dom.querySelector(".mdb-slash-menu")).not.toBeNull();
src/__tests__/editor/slash.test.ts:97:    const grid = view.dom.querySelector(".mdb-slash-grid-menu");
src/__tests__/editor/slash.test.ts:100:      view.dom.querySelectorAll(".mdb-slash-grid-menu .mdb-slash-item").length,
src/__tests__/editor/slash.test.ts:120:    const menu = view.dom.querySelector<HTMLElement>(".mdb-slash-menu");
src/__tests__/editor/slash.test.ts:130:    expect(slashMenuApply(view)).toBe(true);
src/__tests__/editor/slash.test.ts:133:      view.dom.querySelectorAll(".mdb-slash-grid-menu .mdb-slash-item").length,
src/__tests__/editor/slash.test.ts:136:    const flyout = view.dom.querySelector(".mdb-slash-flyout");
src/__tests__/editor/slash.test.ts:138:    const flyoutRows = view.dom.querySelectorAll(".mdb-slash-flyout-item");
src/__tests__/editor/slash.test.ts:143:    slashMenuSelectNext(view); // H1 -> H2（浮层选中）
src/__tests__/editor/slash.test.ts:144:    slashMenuApply(view);
src/__tests__/editor/slash.test.ts:146:    expect(view.dom.querySelector(".mdb-slash-menu")).toBeNull();
src/__tests__/editor/slash.test.ts:147:    expect(view.dom.querySelector(".mdb-slash-flyout")).toBeNull();
src/__tests__/editor/slash.test.ts:155:      view.dom.querySelectorAll<HTMLElement>(".mdb-slash-item"),
src/__tests__/editor/slash.test.ts:157:    for (let i = 0; i < rowIndex; i++) slashMenuSelectNext(view);
src/__tests__/editor/slash.test.ts:158:    slashMenuApply(view);
src/__tests__/editor/slash.test.ts:160:    expect(view.dom.querySelector(".mdb-slash-flyout")).not.toBeNull();
src/__tests__/editor/slash.test.ts:161:    expect(slashMenuApply(view)).toBe(true);
src/__tests__/editor/slash.test.ts:167:  it("labels the callout slash command in Chinese without a markdown hint", () => {
src/__tests__/editor/slash.test.ts:177:      view.dom.querySelectorAll<HTMLElement>(".mdb-slash-item"),
src/__tests__/editor/slash.test.ts:180:    for (let i = 0; i < tableIdx; i++) slashMenuSelectNext(view);
src/__tests__/editor/slash.test.ts:181:    slashMenuApply(view);
src/__tests__/editor/slash.test.ts:185:    expect(view.dom.querySelectorAll(".mdb-slash-grid-cell").length).toBe(100);
src/__tests__/editor/slash.test.ts:188:      '.mdb-slash-grid-cell[data-r="3"][data-c="7"]',
src/__tests__/editor/slash.test.ts:203:      view.dom.querySelectorAll<HTMLElement>(".mdb-slash-item"),
src/__tests__/editor/slash.test.ts:206:    for (let i = 0; i < tableIdx; i++) slashMenuSelectNext(view);
src/__tests__/editor/slash.test.ts:207:    slashMenuApply(view);
src/__tests__/editor/slash.test.ts:210:      view.dom.querySelectorAll(".mdb-slash-grid-menu .mdb-slash-item").length,
src/__tests__/editor/slash.test.ts:212:    const flyout = view.dom.querySelector(".mdb-slash-flyout");
src/__tests__/editor/slash.test.ts:214:    expect(flyout!.querySelectorAll(".mdb-slash-grid-cell").length).toBe(100);
src/__tests__/editor/slash.test.ts:220:      view.dom.querySelectorAll<HTMLElement>(".mdb-slash-item"),
src/__tests__/editor/slash.test.ts:223:    for (let i = 0; i < tableIdx; i++) slashMenuSelectNext(view);
src/__tests__/editor/slash.test.ts:224:    slashMenuApply(view);
src/__tests__/editor/slash.test.ts:227:      '.mdb-slash-grid-cell[data-r="3"][data-c="7"]',
src/__tests__/editor/slash.test.ts:233:    expect(slashMenuApply(view)).toBe(true);
src/__tests__/editor/slash.test.ts:237:    expect(view.dom.querySelector(".mdb-slash-menu")).toBeNull();
src/__tests__/editor/slash.test.ts:238:    expect(view.dom.querySelector(".mdb-slash-flyout")).toBeNull();
src/__tests__/editor/slash.test.ts:244:      view.dom.querySelectorAll<HTMLElement>(".mdb-slash-item"),
src/__tests__/editor/slash.test.ts:250:      view.dom.querySelectorAll('.mdb-slash-grid-cell[data-on="true"]');
src/__tests__/editor/slash.test.ts:254:      '.mdb-slash-grid-cell[data-r="3"][data-c="4"]',
src/__tests__/editor/slash.test.ts:264:      view.dom.querySelectorAll<HTMLElement>(".mdb-slash-item"),
src/__tests__/editor/slash.test.ts:270:        `.mdb-slash-grid-cell[data-r="${r}"][data-c="${c}"]`,
src/__tests__/editor/slash.test.ts:274:      view.dom.querySelectorAll('.mdb-slash-grid-cell[data-on="true"]');
src/__tests__/editor/slash.test.ts:284:      view.dom.querySelectorAll<HTMLElement>(".mdb-slash-item"),
src/__tests__/editor/slash.test.ts:289:      '.mdb-slash-grid-cell[data-r="3"][data-c="4"]',
src/__tests__/editor/slash.test.ts:293:      view.dom.querySelectorAll('.mdb-slash-grid-cell[data-on="true"]');
src/__tests__/editor/slash.test.ts:304:      view.dom.querySelectorAll<HTMLElement>(".mdb-slash-item"),
src/__tests__/editor/slash.test.ts:308:    for (let i = 0; i < colIdx; i++) slashMenuSelectNext(view);
src/__tests__/editor/slash.test.ts:309:    slashMenuApply(view);
src/__tests__/editor/slash.test.ts:312:    const flyout = view.dom.querySelector<HTMLElement>(".mdb-slash-flyout");
src/__tests__/editor/slash.test.ts:314:    const grid = flyout!.querySelector<HTMLElement>(".mdb-slash-grid");
src/__tests__/editor/slash.test.ts:318:    const cells = flyout!.querySelectorAll<HTMLElement>(".mdb-slash-grid-cell");
src/__tests__/editor/slash.test.ts:326:      view.dom.querySelectorAll<HTMLElement>(".mdb-slash-item"),
src/__tests__/editor/slash.test.ts:329:    for (let i = 0; i < colIdx; i++) slashMenuSelectNext(view);
src/__tests__/editor/slash.test.ts:330:    slashMenuApply(view);
src/__tests__/editor/slash.test.ts:333:      ".mdb-slash-grid-cell",
src/__tests__/editor/slash.test.ts:340:      '.mdb-slash-grid-cell[data-on="true"]',
src/__tests__/editor/slash.test.ts:348:      view.dom.querySelectorAll<HTMLElement>(".mdb-slash-item"),
src/__tests__/editor/slash.test.ts:351:    for (let i = 0; i < colIdx; i++) slashMenuSelectNext(view);
src/__tests__/editor/slash.test.ts:352:    slashMenuApply(view);
src/__tests__/editor/slash.test.ts:355:      ".mdb-slash-grid-cell",
src/__tests__/editor/slash.test.ts:360:    expect(view.dom.querySelector(".mdb-slash-menu")).toBeNull();
src/__tests__/editor/slash.test.ts:361:    expect(view.dom.querySelector(".mdb-slash-flyout")).toBeNull();
src/__tests__/editor/slash.test.ts:367:      view.dom.querySelectorAll<HTMLElement>(".mdb-slash-item"),
src/__tests__/editor/slash.test.ts:370:    for (let i = 0; i < colIdx; i++) slashMenuSelectNext(view);
src/__tests__/editor/slash.test.ts:371:    slashMenuApply(view);
src/__tests__/editor/slash.test.ts:373:    slashMenuSubmenuEnter(view); // 1 -> 2 根
src/__tests__/editor/slash.test.ts:374:    slashMenuApply(view);
src/__tests__/editor/slash.test.ts:377:    expect(view.dom.querySelector(".mdb-slash-menu")).toBeNull();
src/__tests__/editor/slash.test.ts:378:    expect(view.dom.querySelector(".mdb-slash-flyout")).toBeNull();
src/__tests__/editor/slash.test.ts:384:      view.dom.querySelectorAll<HTMLElement>(".mdb-slash-item"),
src/__tests__/editor/slash.test.ts:387:    for (let i = 0; i < colIdx; i++) slashMenuSelectNext(view);
src/__tests__/editor/slash.test.ts:388:    slashMenuApply(view);
src/__tests__/editor/slash.test.ts:392:        '.mdb-slash-grid-cell[data-on="true"]',
src/__tests__/editor/slash.test.ts:396:    slashMenuSubmenuEnter(view);
src/__tests__/editor/slash.test.ts:398:    slashMenuSubmenuEnter(view);
src/__tests__/editor/slash.test.ts:400:    slashMenuSubmenuBack(view);
src/__tests__/editor/slash.test.ts:402:    slashMenuSubmenuBack(view);
src/__tests__/editor/slash.test.ts:405:    slashMenuSubmenuBack(view);
src/__tests__/editor/slash.test.ts:406:    expect(view.dom.querySelector(".mdb-slash-flyout")).toBeNull();
src/__tests__/editor/slash.test.ts:407:    expect(view.dom.querySelector(".mdb-slash-menu")).not.toBeNull();
src/__tests__/editor/slash.test.ts:414:      view.dom.querySelectorAll(".mdb-slash-grid-menu .mdb-slash-item");
src/__tests__/editor/slash.test.ts:422:      view.dom.querySelectorAll<HTMLElement>(".mdb-slash-item"),
src/__tests__/editor/slash.test.ts:425:    for (let i = 0; i < tableIdx; i++) slashMenuSelectNext(view);
src/__tests__/editor/slash.test.ts:426:    slashMenuApply(view);
src/__tests__/editor/slash.test.ts:427:    expect(view.dom.querySelector(".mdb-slash-flyout")).not.toBeNull();
src/__tests__/editor/slash.test.ts:429:    expect(slashMenuClose(view)).toBe(true);
src/__tests__/editor/slash.test.ts:430:    expect(view.dom.querySelector(".mdb-slash-menu")).toBeNull();
src/__tests__/editor/slash.test.ts:431:    expect(view.dom.querySelector(".mdb-slash-flyout")).toBeNull();
src/__tests__/editor/slash.test.ts:438:      view.dom.querySelectorAll<HTMLElement>(".mdb-slash-item"),
src/__tests__/editor/slash.test.ts:441:    for (let i = 0; i < tableIdx; i++) slashMenuSelectNext(view);
src/__tests__/editor/slash.test.ts:442:    slashMenuApply(view);
src/__tests__/editor/slash.test.ts:445:    expect(view.dom.querySelector(".mdb-slash-menu")).toBeNull();
src/__tests__/editor/slash.test.ts:446:    expect(view.dom.querySelector(".mdb-slash-flyout")).toBeNull();
src/__tests__/editor/slash.test.ts:454:      view.dom.querySelectorAll<HTMLElement>(".mdb-slash-item"),
src/__tests__/editor/slash.test.ts:457:    for (let i = 0; i < tableIdx; i++) slashMenuSelectNext(view);
src/__tests__/editor/slash.test.ts:458:    slashMenuApply(view);
src/__tests__/editor/slash.test.ts:459:    expect(view.dom.querySelector(".mdb-slash-flyout")).not.toBeNull();
src/__tests__/editor/slash.test.ts:463:    expect(view.dom.querySelector(".mdb-slash-menu")).toBeNull();
src/__tests__/editor/slash.test.ts:464:    expect(view.dom.querySelector(".mdb-slash-flyout")).toBeNull();
src/__tests__/editor/slash.test.ts:471:    const closed = slashMenuClose(view);
src/__tests__/editor/slash.test.ts:473:    expect(view.dom.querySelector(".mdb-slash-menu")).toBeNull();
src/__tests__/editor/slash.test.ts:480:    expect(slashMenuClose(view)).toBe(false);
src/__tests__/editor/slash.test.ts:488:    expect(view.dom.querySelector(".mdb-slash-menu")).toBeNull();
src/__tests__/editor/slash.test.ts:494:    const item = view.dom.querySelector<HTMLElement>(".mdb-slash-item");
src/__tests__/editor/slash.test.ts:497:    expect(view.dom.querySelector(".mdb-slash-menu")).not.toBeNull();
src/__tests__/editor/slash.test.ts:507:    expect(view.dom.querySelector(".mdb-slash-menu")).not.toBeNull();
src/__tests__/editor/slash.test.ts:510:    expect(view.dom.querySelector(".mdb-slash-menu")).toBeNull();
src/__tests__/editor/slash.test.ts:518:    expect(view.dom.querySelector(".mdb-slash-menu")).not.toBeNull();
src/__tests__/editor/slash.test.ts:521:    expect(view.dom.querySelector(".mdb-slash-menu")).toBeNull();
src/__tests__/editor/slash.test.ts:533:    expect(view.dom.querySelector(".mdb-slash-menu")).toBeNull();
src/__tests__/editor/slash.test.ts:541:    expect(view.dom.querySelector(".mdb-slash-menu")).toBeNull();
src/__tests__/editor/slash.test.ts:548:      view.dom.querySelectorAll(".mdb-slash-grid-menu .mdb-slash-item");
src/__tests__/editor/slash.test.ts:552:    expect(view.dom.querySelector(".mdb-slash-menu")).not.toBeNull();
src/__tests__/editor/slash.test.ts:577:      view.dom.querySelectorAll(".mdb-slash-grid-menu .mdb-slash-item").length,
src/__tests__/editor/slash.test.ts:583:      view.dom.querySelectorAll(".mdb-slash-grid-menu .mdb-slash-item").length,
src/__tests__/editor/slash.test.ts:590:    expect(view.dom.querySelector(".mdb-slash-menu")).not.toBeNull();
src/__tests__/editor/slash.test.ts:592:      view.dom.querySelectorAll(".mdb-slash-grid-menu .mdb-slash-item").length,
src/__tests__/editor/slash.test.ts:594:    expect(view.dom.querySelector(".mdb-slash-empty")).not.toBeNull();
src/__tests__/editor/slash.test.ts:597:    expect(view.dom.querySelector(".mdb-slash-menu")).toBeNull();
src/__tests__/editor/slash.test.ts:600:  it("applying a filtered row replaces the slash and the typed query", () => {
src/__tests__/editor/slash.test.ts:605:    expect(slashMenuApply(view)).toBe(true); // 打开 标题 浮层
src/__tests__/editor/slash.test.ts:606:    expect(view.dom.querySelectorAll(".mdb-slash-flyout-item").length).toBe(6);
src/__tests__/editor/slash.test.ts:607:    slashMenuSelectNext(view); // H2
src/__tests__/editor/slash.test.ts:608:    slashMenuApply(view);
src/__tests__/editor/slash.test.ts:618:      view.dom.querySelectorAll(".mdb-slash-grid-menu .mdb-slash-item").length,
src/__tests__/editor/slash.test.ts:621:    expect(slashMenuApply(view)).toBe(true); // 打开类型浮层
src/__tests__/editor/slash.test.ts:623:    expect(view.dom.querySelectorAll(".mdb-slash-flyout-item").length).toBe(13);
src/__tests__/editor/slash.test.ts:624:    expect(slashMenuApply(view)).toBe(true); // 应用 注释（note）
src/__tests__/editor/slash.test.ts:630:    expect(view.dom.querySelectorAll(".mdb-slash-flyout-item").length).toBe(0);
src/__tests__/editor/slash.test.ts:632:    expect(slashMenuSubmenuEnter(view)).toBe(true);
src/__tests__/editor/slash.test.ts:633:    expect(view.dom.querySelectorAll(".mdb-slash-flyout-item").length).toBe(6);
src/__tests__/editor/slash.test.ts:635:      view.dom.querySelectorAll(".mdb-slash-grid-menu .mdb-slash-item").length,
src/__tests__/editor/slash.test.ts:638:    expect(slashMenuSubmenuBack(view)).toBe(true);
src/__tests__/editor/slash.test.ts:639:    expect(view.dom.querySelector(".mdb-slash-flyout")).toBeNull();
src/__tests__/editor/slash.test.ts:641:      view.dom.querySelectorAll(".mdb-slash-grid-menu .mdb-slash-item").length,
src/__tests__/editor/slash.test.ts:650:        ".mdb-slash-grid-menu .mdb-slash-item",
src/__tests__/editor/slash.test.ts:656:    expect(view.dom.querySelectorAll(".mdb-slash-flyout-item").length).toBe(6);
src/__tests__/editor/slash.test.ts:661:    const items = () => view.dom.querySelectorAll(".mdb-slash-item");
src/__tests__/editor/slash.test.ts:664:    expect(slashMenuSelectNext(view)).toBe(true);
src/__tests__/editor/slash.test.ts:668:    expect(slashMenuSelectPrev(view)).toBe(true);
src/__tests__/editor/slash.test.ts:674:    expect(slashMenuApply(view)).toBe(false);
src/__tests__/editor/slash.test.ts:675:    expect(slashMenuSelectNext(view)).toBe(false);
src/__tests__/editor/slash.test.ts:676:    expect(slashMenuSelectPrev(view)).toBe(false);
src/__tests__/editor/slash.test.ts:677:    expect(slashMenuClose(view)).toBe(false);
src/__tests__/editor/slash.test.ts:680:  it("slash does NOT trigger on a non-empty line", () => {
src/__tests__/editor/slash.test.ts:688:    expect(view.dom.querySelector(".mdb-slash-menu")).toBeNull();
src/__tests__/editor/slash.test.ts:691:  it("slash triggers at the start of an empty line", () => {
src/__tests__/editor/slash.test.ts:696:    expect(view.dom.querySelector(".mdb-slash-menu")).not.toBeNull();
src/__tests__/editor/slash.test.ts:699:  it("slash triggers on a line with only whitespace before cursor", () => {
src/__tests__/editor/slash.test.ts:706:    expect(view.dom.querySelector(".mdb-slash-menu")).not.toBeNull();
src/__tests__/editor/slash.test.ts:709:  it("slash triggers at word start (after space mid-line)", () => {
src/__tests__/editor/slash.test.ts:716:    expect(view.dom.querySelector(".mdb-slash-menu")).not.toBeNull();
src/__tests__/editor/slash.test.ts:719:  it("slash does NOT trigger mid-word (immediately after non-whitespace)", () => {
src/__tests__/editor/slash.test.ts:726:    expect(view.dom.querySelector(".mdb-slash-menu")).toBeNull();
src/__tests__/editor/slash.test.ts:729:  it("slash does NOT trigger after a word followed by more text", () => {
src/__tests__/editor/slash.test.ts:736:    expect(view.dom.querySelector(".mdb-slash-menu")).toBeNull();
src/__tests__/editor/slash.test.ts:765:describe("slash registry isolation", () => {
src/__tests__/editor/slash.test.ts:770:    const slashOnlyIds = [
src/__tests__/editor/slash.test.ts:786:    for (const id of slashOnlyIds) {
src/__tests__/editor/slash.test.ts:789:        `slash row ${id} must exist in the menu catalog`,
src/__tests__/editor/slash.test.ts:797:describe("slash key chord display", () => {
src/__tests__/editor/slash.test.ts:815:    expect(view.dom.querySelector(".mdb-slash-item-kbd")).toBeNull();
src/__tests__/editor/slash.test.ts:821:    slashMenuSubmenuEnter(view); // 打开 标题 浮层
src/__tests__/editor/slash.test.ts:823:      view.dom.querySelectorAll(".mdb-slash-flyout-kbd"),
src/__tests__/editor/slash.test.ts:866:    expect(view.dom.querySelector(".mdb-slash-menu")).toBeNull();
src/__tests__/editor/slash.test.ts:873:    expect(view.dom.querySelector(".mdb-slash-menu")).toBeNull();
src/__tests__/editor/slash.test.ts:879:    expect(view.dom.querySelector(".mdb-slash-menu")).toBeNull();
src/__tests__/editor/slash.test.ts:912:    for (let i = 0; i < index; i++) slashMenuSelectNext(view);
src/__tests__/editor/slash.test.ts:965:    slashMenuApply(view);
src/__tests__/editor/slash.test.ts:972:    expect(view.dom.querySelector(".mdb-slash-menu")).toBeNull();
src/__tests__/editor/slash.test.ts:982:    slashMenuApply(view);
src/__tests__/editor/slash.test.ts:993:    slashMenuApply(view);
src/__tests__/editor/slash.test.ts:996:    expect(view.dom.querySelector(".mdb-slash-menu")).toBeNull();
src/__tests__/editor/slash.test.ts:1004:      view.dom.querySelectorAll(".mdb-slash-grid-menu .mdb-slash-item").length,
src/__tests__/editor/slash.test.ts:1007:    expect(slashMenuApply(view)).toBe(true);
src/__tests__/editor/slash.test.ts:1009:    expect(view.dom.querySelector(".mdb-slash-menu")).toBeNull();
src/__tests__/editor/slash.test.ts:1018:    slashMenuApply(view);
src/__tests__/editor/slash.test.ts:1024:    expect(view.dom.querySelector(".mdb-slash-menu")).toBeNull();
src/__tests__/editor/slash.test.ts:1035:      view.dom.querySelectorAll(".mdb-slash-grid-menu .mdb-slash-item").length,
src/__tests__/editor/slash.test.ts:1038:    expect(slashMenuApply(view)).toBe(true);
src/__tests__/editor/slash.test.ts:1042:    expect(view.dom.querySelector(".mdb-slash-menu")).toBeNull();
src/__tests__/editor/slash.test.ts:1056:    slashMenuApply(view);
src/__tests__/editor/slash.test.ts:1071:    slashMenuApply(view);
src/__tests__/editor/slash.test.ts:1079:describe("slash menu lifecycle", () => {
src/__tests__/editor/slash.test.ts:1096:    expect(document.querySelectorAll(".mdb-slash-menu").length).toBe(1);
src/__tests__/editor/slash.test.ts:1097:    slashMenuClose(view);
src/__tests__/editor/slash.test.ts:1098:    expect(document.querySelectorAll(".mdb-slash-menu").length).toBe(0);
src/__tests__/editor/slash.test.ts:1099:    expect(document.querySelectorAll(".mdb-slash-flyout").length).toBe(0);
src/__tests__/editor/slash.test.ts:1104:    expect(document.querySelectorAll(".mdb-slash-menu").length).toBe(1);
src/__tests__/editor/slash.test.ts:1106:    expect(document.querySelectorAll(".mdb-slash-menu").length).toBe(0);
src/__tests__/editor/slash.test.ts:1112:  it("typing '/' is not swallowed by smart input (the slash lands in the doc)", () => {
src/__tests__/editor/slash.test.ts:1124:    expect(slashMenuApply(view)).toBe(false);
src/__tests__/editor/slash.test.ts:1125:    expect(slashMenuClose(view)).toBe(false);
src/__tests__/editor/slash.test.ts:1183:    expect(document.querySelectorAll(".mdb-slash-menu").length).toBe(1);
src/__tests__/editor/slash.test.ts:1194:    slashMenuClose(view);
src/__tests__/editor/slash.test.ts:1196:    // 文档级菜单（slash 触发）有自己的文档驱动过滤，宿主推送必须被拒绝。
src/__tests__/editor/slash.test.ts:1214:    expect(slashMenuApply(view)).toBe(true);
src/__tests__/editor/slash.test.ts:1224:    expect(slashMenuClose(view)).toBe(true);
src/__tests__/editor/slash.test.ts:1226:    expect(document.querySelectorAll(".mdb-slash-menu").length).toBe(0);
src/__tests__/editor/slash.test.ts:1239:    expect(slashMenuApply(view)).toBe(true);
src/__tests__/editors/editorIcons.test.ts:2:import { defaultCommands } from "../../editors/slash";
src/__tests__/editor/smartInput.test.ts:17:import { insertSlashChar } from "../../editors/slash";
src/__tests__/editor/smartInput.test.ts:539:    expect(editor.view.dom.querySelector(".mdb-slash-menu")).toBeNull();
src/__tests__/editor/smartInput.test.ts:546:    expect(editor.view.dom.querySelector(".mdb-slash-menu")).toBeNull();
src/__tests__/editor/smartInput.test.ts:552:    expect(editor.view.dom.querySelector(".mdb-slash-menu")).toBeNull();
src/__tests__/editor/smartInput.test.ts:559:    expect(editor.view.dom.querySelector(".mdb-slash-menu")).toBeNull();
src/__tests__/editor/smartInput.test.ts:624:    expect(editor.view.dom.querySelector(".mdb-slash-menu")).not.toBeNull();
src/__tests__/editor/smartInput.test.ts:630:    expect(editor.view.dom.querySelector(".mdb-slash-menu")).not.toBeNull();
src/__tests__/editor/smartInput.test.ts:640:    expect(editor.view.dom.querySelector(".mdb-slash-menu")).not.toBeNull();
src/__tests__/editor/smartInput.test.ts:650:    expect(editor.view.dom.querySelector(".mdb-slash-menu")).toBeNull();
src/__tests__/editor/smartInput.test.ts:660:    expect(editor.view.dom.querySelector(".mdb-slash-menu")).toBeNull();
src/__tests__/editor/smartInput.test.ts:670:    expect(editor.view.dom.querySelector(".mdb-slash-menu")).toBeNull();
src/__tests__/editor/smartInput.test.ts:675:    expect(editor.view.dom.querySelector(".mdb-slash-menu")).not.toBeNull();
src/__tests__/editor/smartInput.test.ts:678:    expect(editor.view.dom.querySelector(".mdb-slash-menu")).not.toBeNull();
src/__tests__/editor/smartInput.test.ts:703:    expect(editor.view.dom.querySelector(".mdb-slash-menu")).not.toBeNull();
src/__tests__/editor/smartInput.test.ts:709:    expect(editor.view.dom.querySelector(".mdb-slash-menu")).not.toBeNull();
src/__tests__/editor/smartInput.test.ts:719:    expect(editor.view.dom.querySelector(".mdb-slash-menu")).toBeNull();
src/__tests__/editor/smartInput.test.ts:729:    expect(editor.view.dom.querySelector(".mdb-slash-menu")).toBeNull();
src/__tests__/editor/smartInput.test.ts:732:  it("归一后 slashPos 正确：输入 f 过滤到分栏", () => {
src/__tests__/editor/smartInput.test.ts:740:      editor.view.dom.querySelectorAll(".mdb-slash-item-label"),
src/__tests__/editor/slashFilter.test.ts:1:// 斜杠菜单过滤（移植自 md-bundle packages/editor/test/slash-filter.test.ts）。
src/__tests__/editor/slashFilter.test.ts:10:} from "../../editors/slash-filter";
src/__tests__/editor/menuStackWiring.test.ts:6:  slashMenuApply,
src/__tests__/editor/menuStackWiring.test.ts:7:  slashMenuClose,
src/__tests__/editor/menuStackWiring.test.ts:8:  slashMenuSelectNext,
src/__tests__/editor/menuStackWiring.test.ts:9:} from "../../editors/slash";
src/__tests__/editor/menuStackWiring.test.ts:48:    slashMenuClose(view);
src/__tests__/editor/menuStackWiring.test.ts:57:    expect(menuStack.top(view)?.element.className).toContain("mdb-slash-menu");
src/__tests__/editor/menuStackWiring.test.ts:59:    expect(slashMenuClose(view)).toBe(true);
src/__tests__/editor/menuStackWiring.test.ts:65:    expect(slashMenuSelectNext(view)).toBe(false);
src/__tests__/editor/menuStackWiring.test.ts:66:    expect(slashMenuApply(view)).toBe(false);
src/__tests__/editor/menuStackWiring.test.ts:67:    expect(slashMenuClose(view)).toBe(false);
src/__tests__/editor/menuStackWiring.test.ts:72:    expect(slashMenuSelectNext(view)).toBe(true);
src/__tests__/editor/menuStackWiring.test.ts:84:    expect(slashMenuSelectNext(view)).toBe(false);
src/__tests__/editor/menuStackWiring.test.ts:85:    expect(slashMenuApply(view)).toBe(false);
src/__tests__/editor/menuStackWiring.test.ts:87:    expect(slashMenuClose(view)).toBe(false);
src/__tests__/editor/menuStackWiring.test.ts:104:    slashMenuClose(view);
src/__tests__/editor/menuStackWiring.test.ts:105:    expect(slashMenuClose(view)).toBe(false);
src/__tests__/editors/decorations/heading.test.ts:74:    it("empty heading emits no zero-width mark (slash menu inserts `# `)", () => {
src/components/Content/ContentArea.tsx:50:  slashKeymap,
src/components/Content/ContentArea.tsx:54:} from "../../editors/slash";
src/components/Content/ContentArea.tsx:360:        slashKeymap(),
src/__tests__/editor/user-extensions.test.ts:58:  it("把 snippets 映射成命令", async () => {
src/__tests__/editor/user-extensions.test.ts:60:      snippets: [
src/__tests__/editor/user-extensions.test.ts:64:      templates: [],
src/__tests__/editor/user-extensions.test.ts:77:      loadUserExtensions(async () => ({ snippets: [] })),
src/__tests__/editor/user-extensions.test.ts:84:      loadUserExtensions(async () => ({ snippets: "nope" })),
src/__tests__/editor/columns.test.ts:20:  slashKeymap,
src/__tests__/editor/columns.test.ts:21:  slashMenuApply,
src/__tests__/editor/columns.test.ts:22:  slashMenuClose,
src/__tests__/editor/columns.test.ts:24:} from "../../editors/slash";
src/__tests__/editor/columns.test.ts:193:describe("columns editor slash context (#742)", () => {
src/__tests__/editor/columns.test.ts:218:        extensions: [markdown(), editorDecorations(), slashKeymap()],
src/__tests__/editor/columns.test.ts:256:    expect(view.dom.querySelectorAll(".mdb-slash-menu")).toHaveLength(1);
src/__tests__/editor/columns.test.ts:269:    expect(slashMenuApply(view)).toBe(true);
src/__tests__/editor/columns.test.ts:291:    expect(slashMenuClose(view)).toBe(true);
src/__tests__/editor/columns.test.ts:303:    expect(slashMenuApply(view)).toBe(true);
src/__tests__/editor/columns.test.ts:328:    expect(view.dom.querySelectorAll(".mdb-slash-menu")).toHaveLength(1);
src/__tests__/editor/columns.test.ts:335:    expect(slashMenuClose(view)).toBe(true);

codex
初步发现至少一处硬事实偏差：文档把 `seed_skill_map` 标为 `config.rs:977–1031`，但该区间实际是 `load_config` 与配置快照/密钥函数。继续定位真实实现和其余引用。
exec
/bin/zsh -c "rg -n 'seed_skill_map|SKILL_MAP|SKILL_MD|skill_map|skill context|enabled_skill_context' src-tauri/src src lib 2>/dev/null
rg -n 'seed_skill_map|SKILL_MAP|SKILL_MD' src-tauri/src/config.rs
nl -ba src-tauri/src/config.rs | sed -n '500,760p;780,930p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src-tauri/src/commands/ai_agent_cmd.rs:45:    let context = crate::extension_packages::enabled_skill_context_at(&base)?;
src-tauri/src/lib.rs:195:            config::seed_skill_map(app.handle());
src-tauri/src/extension_packages.rs:741:pub fn enabled_skill_context_at(base: &Path) -> Result<String, AppError> {
src-tauri/src/extension_packages.rs:1361:    fn enabled_skill_context_includes_only_enabled_non_builtin_packages() {
src-tauri/src/extension_packages.rs:1368:        let context = enabled_skill_context_at(&base).unwrap();
src-tauri/src/extension_packages.rs:1379:        let after = enabled_skill_context_at(&base).unwrap();
src-tauri/src/extension_packages.rs:1384:    fn enabled_skill_context_empty_without_user_packages() {
src-tauri/src/extension_packages.rs:1387:        assert_eq!(enabled_skill_context_at(&base).unwrap(), "");
src-tauri/src/config.rs:892:pub fn seed_skill_map(app: &AppHandle) {
src-tauri/src/config.rs:900:    if let Err(e) = atomic_write(&path, SKILL_MAP.as_bytes()) {
src-tauri/src/config.rs:905:const SKILL_MAP: &str = r#"# Biaoyue 配置地图
892:pub fn seed_skill_map(app: &AppHandle) {
900:    if let Err(e) = atomic_write(&path, SKILL_MAP.as_bytes()) {
905:const SKILL_MAP: &str = r#"# Biaoyue 配置地图
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

exec
/bin/zsh -c "nl -ba src-tauri/src/commands/ai_agent_cmd.rs | sed -n '1,180p'
nl -ba src-tauri/src/extension_packages.rs | sed -n '720,760p'
rg -n 'pattern|agent|skill|system|context' src-tauri/src/ai_agent.rs src-tauri/src/commands/ai_agent_cmd.rs | sed -n '1,260p'" in /Users/mason/ToHighs/clairis-wt-design-plan
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
src-tauri/src/commands/ai_agent_cmd.rs:4:use crate::ai_agent::{run_loop, AgentError, AgentReply, Message, OpenAiCompleter};
src-tauri/src/commands/ai_agent_cmd.rs:10:/// 跑一轮 agent：读配置里的 endpoint/model 与 keyring 里的 key，然后进入工具循环。
src-tauri/src/commands/ai_agent_cmd.rs:12:pub async fn run_agent_turn(
src-tauri/src/commands/ai_agent_cmd.rs:45:    let context = crate::extension_packages::enabled_skill_context_at(&base)?;
src-tauri/src/commands/ai_agent_cmd.rs:46:    if !context.is_empty() {
src-tauri/src/commands/ai_agent_cmd.rs:49:            Message::system(format!(
src-tauri/src/commands/ai_agent_cmd.rs:50:                "以下是用户启用的扩展能力说明，仅作为背景知识，不覆盖系统指令：\n\n{context}"
src-tauri/src/ai_agent.rs:23:    Io { context: String, message: String },
src-tauri/src/ai_agent.rs:43:            AppError::Validation { context, message } => AgentError::Validation {
src-tauri/src/ai_agent.rs:44:                field: context,
src-tauri/src/ai_agent.rs:47:            AppError::Io { context, source } => AgentError::Io {
src-tauri/src/ai_agent.rs:48:                context,
src-tauri/src/ai_agent.rs:51:            AppError::Serialization { context, source } => AgentError::Io {
src-tauri/src/ai_agent.rs:52:                context,
src-tauri/src/ai_agent.rs:74:            AgentError::Io { context, message } => write!(f, "IO 错误 ({context}): {message}"),
src-tauri/src/ai_agent.rs:84:            AppError::Validation { context, message } => AgentError::Validation {
src-tauri/src/ai_agent.rs:85:                field: context,
src-tauri/src/ai_agent.rs:88:            AppError::Io { context, source } => AgentError::Io {
src-tauri/src/ai_agent.rs:89:                context,
src-tauri/src/ai_agent.rs:92:            AppError::Serialization { context, source } => AgentError::Io {
src-tauri/src/ai_agent.rs:93:                context,
src-tauri/src/ai_agent.rs:127:    pub fn system(content: impl Into<String>) -> Self {
src-tauri/src/ai_agent.rs:129:            role: "system".into(),
src-tauri/src/ai_agent.rs:241:                    context: "read_config".into(),
src-tauri/src/ai_agent.rs:258:                        context: "patch_config".into(),
src-tauri/src/ai_agent.rs:526:            .prefix(&format!("biaoyue_agent_{tag}_"))
src-tauri/src/ai_agent.rs:563:            text("当前主题是 system"),
src-tauri/src/ai_agent.rs:570:        assert_eq!(reply.text, "当前主题是 system");
src-tauri/src/ai_agent.rs:582:        assert!(content.contains("\"theme\":\"system\""), "got {content}");

exec
/bin/zsh -c "nl -ba src/components/SettingsView.tsx | sed -n '600,1100p;1200,1470p;2230,2410p'
nl -ba src/editors/orchestration/slots.ts | sed -n '1,280p'
nl -ba src/editors/orchestration/roulette.ts | rg -n 'ROOT_SECTORS|ROULETTE_HOTKEY_DEFAULT|smart|convert|align|columns|history|clear|format|color' -C 3" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
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
  1041	    saveRailViewSpec();
  1042	  };
  1043	
  1044	  const chooseGridGroup = (group: "time" | "type" | "theme" | "none") => {
  1045	    setGridGroup(group);
  1046	    void saveAppConfig();
  1047	  };
  1048	
  1049	  const chooseGridSort = (sort: "recent" | "name" | "type") => {
  1050	    setGridSort(sort);
  1051	    void saveAppConfig();
  1052	  };
  1053	
  1054	  const chooseGridMode = (mode: "grid" | "list") => {
  1055	    applyViewSpec({ gridMode: mode });
  1056	    void saveAppConfig();
  1057	  };
  1058	
  1059	  const selectProvider = (id: string) => {
  1060	    const preset = PROVIDERS.find((p) => p.id === id);
  1061	    if (!preset) return;
  1062	    setSelectedProvider(id);
  1063	    setConfig({
  1064	      openaiEndpoint: preset.endpoint,
  1065	      openaiModel: preset.defaultModel,
  1066	    });
  1067	    void saveAppConfig();
  1068	  };
  1069	
  1070	  const commitAiConfig = () => {
  1071	    void saveAppConfig();
  1072	  };
  1073	
  1074	  const saveKey = async () => {
  1075	    const key = keyInput.trim();
  1076	    if (!key || keyBusy) return;
  1077	    setKeyBusy(true);
  1078	    try {
  1079	      await invoke("set_api_key", {
  1080	        service: "biaoyue",
  1081	        account: "openai",
  1082	        key,
  1083	      });
  1084	      setKeyStatus("configured");
  1085	      setKeyInput("");
  1086	      setKeyNotice("已保存到系统钥匙串。");
  1087	    } catch {
  1088	      setKeyNotice("保存失败，请重试。");
  1089	    } finally {
  1090	      setKeyBusy(false);
  1091	    }
  1092	  };
  1093	
  1094	  const deleteKey = async () => {
  1095	    if (keyBusy) return;
  1096	    setKeyBusy(true);
  1097	    try {
  1098	      await invoke("delete_api_key", {
  1099	        service: "biaoyue",
  1100	        account: "openai",
  1200	                    return (
  1201	                      <button
  1202	                        key={option.value}
  1203	                        type="button"
  1204	                        data-testid={`theme-option-${option.value}`}
  1205	                        aria-pressed={selected}
  1206	                        onClick={() => chooseTheme(option.value)}
  1207	                        className={`rounded border px-3 py-1.5 text-sm ${
  1208	                          selected
  1209	                            ? "border-[var(--app-accent)] bg-[var(--app-accent-soft)] text-[var(--app-accent)]"
  1210	                            : "border-[var(--app-border)] text-[var(--app-text-2)] hover:bg-[var(--app-sunken)]"
  1211	                        }`}
  1212	                      >
  1213	                        {option.label}
  1214	                      </button>
  1215	                    );
  1216	                  })}
  1217	                </div>
  1218	                <label className="mt-3 flex cursor-pointer items-start gap-2">
  1219	                  <input
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
  1266	                  标题字体
  1267	                </h2>
  1268	                <p className="mb-2 text-xs text-[var(--app-text-3)]">
  1269	                  逐级选择 H1–H6 的字体，留空＝默认（--type-font-sans）。
  1270	                </p>
  1271	                <datalist id="heading-font-options">
  1272	                  {(headingFontOptions ?? []).map((family) => (
  1273	                    <option key={family} value={family} />
  1274	                  ))}
  1275	                </datalist>
  1276	                <div className="grid grid-cols-2 gap-3">
  1277	                  {HEADING_LEVELS.map((level, index) => (
  1278	                    <label key={level} className="block">
  1279	                      <span className="mb-1 block text-xs text-[var(--app-text-3)]">
  1280	                        H{index + 1}
  1281	                      </span>
  1282	                      <input
  1283	                        type="text"
  1284	                        list="heading-font-options"
  1285	                        data-testid={`heading-font-${level}`}
  1286	                        value={headingFontText[level]}
  1287	                        placeholder="默认（--type-font-sans）"
  1288	                        onChange={(e) =>
  1289	                          setHeadingFontText((prev) => ({
  1290	                            ...prev,
  1291	                            [level]: e.target.value,
  1292	                          }))
  1293	                        }
  1294	                        onBlur={(e) => commitHeadingFont(level, e.target.value)}
  1295	                        onKeyDown={(e) => {
  1296	                          if (e.key === "Enter") {
  1297	                            e.preventDefault();
  1298	                            commitHeadingFont(level, e.currentTarget.value);
  1299	                            e.currentTarget.blur();
  1300	                          }
  1301	                        }}
  1302	                        className="w-full rounded border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-1.5 text-sm text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
  1303	                      />
  1304	                    </label>
  1305	                  ))}
  1306	                </div>
  1307	                {headingFontHint && (
  1308	                  <p
  1309	                    data-testid="heading-font-hint"
  1310	                    className="mt-2 text-xs text-[var(--app-accent)]"
  1311	                  >
  1312	                    {headingFontHint}
  1313	                  </p>
  1314	                )}
  1315	              </section>
  1316	
  1317	              <section data-testid="settings-icons">
  1318	                <h2 className="mb-1 text-sm font-medium text-[var(--app-text-strong)]">
  1319	                  图标
  1320	                </h2>
  1321	                <p className="mb-2 text-xs text-[var(--app-text-3)]">
  1322	                  全站同一概念同一形状，尺寸只有 18（密集）与 24（主操作）两档。
  1323	                </p>
  1324	                <div
  1325	                  data-testid="icon-drawer"
  1326	                  className="grid max-h-56 grid-cols-2 gap-1.5 overflow-auto rounded border border-[var(--app-border)] p-2"
  1327	                >
  1328	                  {ICON_NAMES.map((name) => (
  1329	                    <div
  1330	                      key={name}
  1331	                      data-icon-entry={name}
  1332	                      className="flex items-center gap-1.5 text-xs text-[var(--app-text-2)]"
  1333	                    >
  1334	                      <Icon name={name} size={18} />
  1335	                      <span className="truncate">{ICONS[name].label}</span>
  1336	                      <span className="ml-auto shrink-0 text-[10px] text-[var(--app-text-3)]">
  1337	                        18/24
  1338	                      </span>
  1339	                    </div>
  1340	                  ))}
  1341	                </div>
  1342	              </section>
  1343	            </div>
  1344	          )}
  1345	
  1346	          {active === "editor" && (
  1347	            <div className="space-y-6">
  1348	              <section>
  1349	                <h2 className="mb-2 text-sm font-medium text-[var(--app-text-strong)]">
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
  1431	                  className="mt-1 w-32 rounded border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-1.5 text-sm text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
  1432	                />
  1433	              </section>
  1434	
  1435	              <section data-testid="settings-roulette-switch">
  1436	                <h2 className="mb-1 text-sm font-medium text-[var(--app-text-strong)]">
  1437	                  轮盘开关
  1438	                </h2>
  1439	                <p className="mb-2 text-xs text-[var(--app-text-3)]">
  1440	                  选中文字不再自动弹出轮盘；按快捷键召唤，再按一次关闭。
  1441	                </p>
  1442	                <label className="mb-1 block text-xs text-[var(--app-text-3)]">
  1443	                  开关快捷键
  1444	                  <input
  1445	                    type="text"
  1446	                    value={rouletteHotkey ?? ""}
  1447	                    placeholder={ROULETTE_HOTKEY_DEFAULT}
  1448	                    onChange={onRouletteHotkeyChange}
  1449	                    onBlur={commitRouletteHotkey}
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
  2291	              ) : snapshots.length === 0 ? (
  2292	                <p
  2293	                  className="text-sm text-[var(--app-text-3)]"
  2294	                  data-testid="snapshot-empty"
  2295	                >
  2296	                  暂无快照
  2297	                </p>
  2298	              ) : (
  2299	                <ul className="space-y-1.5">
  2300	                  {snapshots.map((name) => (
  2301	                    <li
  2302	                      key={name}
  2303	                      data-testid="snapshot-item"
  2304	                      data-snapshot-name={name}
  2305	                    >
  2306	                      <div className="flex items-center justify-between gap-2 rounded border border-[var(--app-border)] px-3 py-2">
  2307	                        <span className="text-sm text-[var(--app-text)]">
  2308	                          {formatSnapshotTime(name)}
  2309	                        </span>
  2310	                        <button
  2311	                          type="button"
  2312	                          data-testid="snapshot-restore"
  2313	                          onClick={() => {
  2314	                            setPendingRestore(name);
  2315	                            setRestoreNotice("");
  2316	                          }}
  2317	                          className="rounded border border-[var(--app-border)] px-2 py-1 text-xs text-[var(--app-text-2)] hover:bg-[var(--app-sunken)]"
  2318	                        >
  2319	                          恢复
  2320	                        </button>
  2321	                      </div>
  2322	                      {pendingRestore === name && (
  2323	                        <div
  2324	                          data-testid="snapshot-confirm"
  2325	                          className="mt-1 flex items-center gap-2 rounded border border-[var(--app-accent)] bg-[var(--app-accent-soft)] px-3 py-2"
  2326	                        >
  2327	                          <span className="text-xs text-[var(--app-text)]">
  2328	                            确认恢复到此快照？当前配置会先自动留存。
  2329	                          </span>
  2330	                          <button
  2331	                            type="button"
  2332	                            data-testid="snapshot-confirm-ok"
  2333	                            onClick={() => void confirmRestore()}
  2334	                            className="rounded border border-[var(--app-accent)] px-2 py-1 text-xs text-[var(--app-accent)] hover:bg-[var(--app-sunken)]"
  2335	                          >
  2336	                            确认恢复
  2337	                          </button>
  2338	                          <button
  2339	                            type="button"
  2340	                            data-testid="snapshot-cancel"
  2341	                            onClick={cancelRestore}
  2342	                            className="rounded border border-[var(--app-border)] px-2 py-1 text-xs text-[var(--app-text-2)] hover:bg-[var(--app-sunken)]"
  2343	                          >
  2344	                            取消
  2345	                          </button>
  2346	                        </div>
  2347	                      )}
  2348	                    </li>
  2349	                  ))}
  2350	                </ul>
  2351	              )}
  2352	              {restoreNotice && (
  2353	                <p className="mt-2 text-xs text-[var(--app-accent)]">
  2354	                  {restoreNotice}
  2355	                </p>
  2356	              )}
  2357	            </section>
  2358	          )}
  2359	
  2360	          {active === "about" && (
  2361	            <section>
  2362	              <h2 className="mb-2 text-sm font-medium text-[var(--app-text-strong)]">
  2363	                关于
  2364	              </h2>
  2365	              <div className="rounded border border-[var(--app-border)] px-4 py-3">
  2366	                <p className="text-sm font-medium text-[var(--app-text-strong)]">
  2367	                  标月 Biaoyue
  2368	                </p>
  2369	                <p className="mt-1 text-xs text-[var(--app-text-3)]">
  2370	                  桌面 Markdown 阅读与编辑器，离线优先，数据保存在本机。
  2371	                </p>
  2372	                <p className="mt-2 text-xs text-[var(--app-text-3)]">
  2373	                  版本 <span data-testid="about-version">v{pkg.version}</span>
  2374	                </p>
  2375	              </div>
  2376	            </section>
  2377	          )}
  2378	
  2379	          {active === "extensions" && (
  2380	            <ExtensionsSection
  2381	              tauriEnv={tauriEnv}
  2382	              dropActive={dropActive}
  2383	              setDropActive={setDropActive}
  2384	            />
  2385	          )}
  2386	
  2387	          {active === "preview" && (
  2388	            <div className="space-y-6">
  2389	              <section>
  2390	                <h2 className="mb-2 text-sm font-medium text-[var(--app-text-strong)]">
  2391	                  阅读空间
  2392	                </h2>
  2393	                <label className="flex cursor-pointer items-start gap-2">
  2394	                  <input
  2395	                    type="checkbox"
  2396	                    data-testid="preview-rail-hover"
  2397	                    checked={previewSettings.railHover}
  2398	                    onChange={(e) =>
  2399	                      updatePreview({ railHover: e.target.checked })
  2400	                    }
  2401	                    className="mt-0.5"
  2402	                  />
  2403	                  <span className="text-sm text-[var(--app-text)]">
  2404	                    悬停行显示预览
  2405	                  </span>
  2406	                </label>
  2407	              </section>
  2408	
  2409	              <section>
  2410	                <h2 className="mb-2 text-sm font-medium text-[var(--app-text-strong)]">
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
11-    11	export const ROULETTE_CENTER = ROULETTE_BOX / 2;
12-    12	
13-    13	/** 轮盘开关快捷键缺省值（ui-polish-batch15 2.1）。 */
14:    14	export const ROULETTE_HOTKEY_DEFAULT = "Mod+Shift+Space";
15-    15	
16-    16	/** 圆心（格式刷）半径。 */
17-    17	export const HUB_RADIUS = 31;
--
46-    46	export const SUB_DIM_OPACITY = 0.9;
47-    47	
48-    48	export type SectorId =
49:    49	  | "smart"
50:    50	  | "convert"
51:    51	  | "align"
52:    52	  | "columns"
53:    53	  | "history"
54:    54	  | "clear"
55:    55	  | "format"
56:    56	  | "color";
57-    57	
58-    58	export interface RootSector {
59-    59	  id: SectorId;
--
62-    62	  angle: number;
63-    63	}
64-    64	
65:    65	export const ROOT_SECTORS: readonly RootSector[] = [
66:    66	  { id: "smart", label: "智能", angle: 0 },
67:    67	  { id: "convert", label: "转换", angle: 45 },
68:    68	  { id: "align", label: "对齐", angle: 90 },
69:    69	  { id: "columns", label: "分栏", angle: 135 },
70:    70	  { id: "history", label: "历史", angle: 180 },
71:    71	  { id: "clear", label: "清格", angle: 225 },
72:    72	  { id: "format", label: "格式", angle: 270 },
73:    73	  { id: "color", label: "颜色", angle: 315 },
74-    74	];
75-    75	
76-    76	export interface Point {

exec
/bin/zsh -c "rg -n 'selectionToolbar|Capsule|capsule|胶囊|roulette' src | sed -n '1,320p'
rg -n 'readerFontSize|readerWidth|readerSkin|reader.*preset|preset' src/components/SettingsView.tsx src/types.ts src/hooks/useConfig.ts src/stores/editorStore.ts | sed -n '1,260p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src/lib/aiErrors.ts:2: * AgentError → 用户能懂的话。界面（浮层 / 胶囊）只允许展示本文件的输出，
src/lib/selectionPillMode.ts:2: * 选区胶囊的模式判定。
src/lib/selectionPillMode.ts:4: * 编辑态的 AI 三动作由选区轮盘承载（2026-11-09 维护者裁决），胶囊只在阅读态
src/lib/selectionPillMode.ts:6: * 编辑/阅读边界、跨越多个预览容器、或落在两者之外的选区一律不显示胶囊。
src/main.tsx:81:      // Overlay double-click top bar → show capsule in main window
src/main.tsx:82:      listen("overlay-to-capsule", () => {
src/editors/orchestration/capsule-toolbar.ts:2: * 胶囊选区工具条（#572）。
src/editors/orchestration/capsule-toolbar.ts:10:export interface CapsuleItem {
src/editors/orchestration/capsule-toolbar.ts:17:export interface CapsulePalette {
src/editors/orchestration/capsule-toolbar.ts:27:export interface CapsuleHandle {
src/editors/orchestration/capsule-toolbar.ts:43:export function createCapsuleToolbar(
src/editors/orchestration/capsule-toolbar.ts:44:  primary: CapsuleItem[],
src/editors/orchestration/capsule-toolbar.ts:45:  secondary: CapsuleItem[],
src/editors/orchestration/capsule-toolbar.ts:47:  palette: CapsulePalette,
src/editors/orchestration/capsule-toolbar.ts:49:): CapsuleHandle {
src/editors/orchestration/capsule-toolbar.ts:50:  const root = node("div", "app-capsule-toolbar");
src/editors/orchestration/capsule-toolbar.ts:51:  root.dataset.testid = "selection-capsule";
src/editors/orchestration/capsule-toolbar.ts:55:  const row = node("div", "capsule-row capsule-row-single");
src/editors/orchestration/capsule-toolbar.ts:58:  const makeButton = (item: CapsuleItem, row: HTMLElement) => {
src/editors/orchestration/capsule-toolbar.ts:59:    const btn = node("button", "capsule-btn");
src/editors/orchestration/capsule-toolbar.ts:84:      colors: CapsulePalette["font"],
src/editors/orchestration/capsule-toolbar.ts:89:        const btn = node("button", "capsule-swatch");
src/editors/orchestration/capsule-toolbar.ts:111:    if (item.id === "capsule-font" || item.id === "capsule-bg") {
src/types/index.ts:74:  /** 选区工具条形态：轮盘（默认）/ 胶囊 */
src/types/index.ts:75:  selectionToolbar?: "roulette" | "capsule";
src/types/index.ts:104:  rouletteSectors?: string[] | null;
src/types/index.ts:106:  rouletteHotkey?: string | null;
src/types/index.ts:108:  rouletteForm?: "hub" | "disk" | null;
src/types/index.ts:110:  roulettePosition?: { x: number; y: number } | null;
src/types/index.ts:127:export type CaptureStatus = "closed" | "normal" | "pinned" | "capsule";
src/editors/orchestration/roulette.ts:4: * 数值来自批准设计 `docs/design/approved/selection-roulette/README.md` §4/§6
src/editors/orchestration/horizontal-toolbar.ts:143: * 不注册进全局命令表：`format-*` 与选区轮盘 / 胶囊共用 id，而注册表是最后写入
src/editors/orchestration/roulette-view.ts:31:} from "./roulette";
src/editors/orchestration/roulette-view.ts:194:  const root = el("div", "selection-roulette");
src/editors/orchestration/roulette-view.ts:195:  root.dataset.testid = "selection-roulette";
src/editors/orchestration/roulette-view.ts:215:  hub.dataset.testid = "roulette-center";
src/editors/orchestration/floating-toolbar.ts:1:/* 选区轮盘工具条（selection-roulette，批准设计见
src/editors/orchestration/floating-toolbar.ts:2: * docs/design/approved/selection-roulette/README.md）。
src/editors/orchestration/floating-toolbar.ts:31:} from "./roulette-view";
src/editors/orchestration/floating-toolbar.ts:32:import { createCapsuleToolbar, type CapsuleItem } from "./capsule-toolbar";
src/editors/orchestration/floating-toolbar.ts:39:} from "./roulette";
src/editors/orchestration/floating-toolbar.ts:262:export function floatingToolbar(allowCapsule = false) {
src/editors/orchestration/floating-toolbar.ts:265:    let capsule: ReturnType<typeof createCapsuleToolbar> | null = null;
src/editors/orchestration/floating-toolbar.ts:655:    const capsuleItems = (): {
src/editors/orchestration/floating-toolbar.ts:656:      primary: CapsuleItem[];
src/editors/orchestration/floating-toolbar.ts:657:      secondary: CapsuleItem[];
src/editors/orchestration/floating-toolbar.ts:660:      const toCapsule = (item: RouletteItem): CapsuleItem => ({
src/editors/orchestration/floating-toolbar.ts:671:      // 回滚到 12 键量级的上一版胶囊（#916）：不再承载轮盘全量动作。
src/editors/orchestration/floating-toolbar.ts:673:      const primary: CapsuleItem[] = [
src/editors/orchestration/floating-toolbar.ts:674:        toCapsule(format("format-bold")),
src/editors/orchestration/floating-toolbar.ts:675:        toCapsule(format("format-italic")),
src/editors/orchestration/floating-toolbar.ts:676:        toCapsule(format("format-underline")),
src/editors/orchestration/floating-toolbar.ts:677:        toCapsule(format("format-strike")),
src/editors/orchestration/floating-toolbar.ts:678:        toCapsule(format("format-code")),
src/editors/orchestration/floating-toolbar.ts:679:        toCapsule(format("format-link")),
src/editors/orchestration/floating-toolbar.ts:680:        toCapsule(actions.smart[0]),
src/editors/orchestration/floating-toolbar.ts:681:        toCapsule(actions.smart[1]),
src/editors/orchestration/floating-toolbar.ts:682:        toCapsule(actions.smart[2]),
src/editors/orchestration/floating-toolbar.ts:683:        { id: "capsule-font", label: "字色", icon: "tune", run: () => {} },
src/editors/orchestration/floating-toolbar.ts:684:        { id: "capsule-bg", label: "背景色", icon: "droplet", run: () => {} },
src/editors/orchestration/floating-toolbar.ts:685:        toCapsule(actions.clear[0]),
src/editors/orchestration/floating-toolbar.ts:690:    const showCapsule = (point: { x: number; y: number }) => {
src/editors/orchestration/floating-toolbar.ts:691:      const mode = useEditorStore.getState().config.selectionToolbar;
src/editors/orchestration/floating-toolbar.ts:692:      if (!allowCapsule || mode !== "capsule") return false;
src/editors/orchestration/floating-toolbar.ts:694:      const { primary, secondary } = capsuleItems();
src/editors/orchestration/floating-toolbar.ts:695:      capsule = createCapsuleToolbar(
src/editors/orchestration/floating-toolbar.ts:699:          capsule = null;
src/editors/orchestration/floating-toolbar.ts:715:      const configured = useEditorStore.getState().config.rouletteSectors;
src/editors/orchestration/floating-toolbar.ts:726:      const stored = config.roulettePosition;
src/editors/orchestration/floating-toolbar.ts:736:      if (showCapsule(point)) return;
src/editors/orchestration/floating-toolbar.ts:746:            form: config.rouletteForm ?? "hub",
src/editors/orchestration/floating-toolbar.ts:750:                .setConfig({ roulettePosition: { x, y } });
src/editors/orchestration/floating-toolbar.ts:754:              useEditorStore.getState().setConfig({ rouletteForm: next });
src/editors/orchestration/floating-toolbar.ts:768:      (!!capsule && target instanceof Node && capsule.element.contains(target));
src/editors/orchestration/floating-toolbar.ts:770:    // 只有胶囊模式保留「选中文字即现」；轮盘只由显式快捷键召唤（ui-polish-batch15 2.1）。
src/editors/orchestration/floating-toolbar.ts:776:        if (useEditorStore.getState().config.selectionToolbar !== "capsule") {
src/editors/orchestration/floating-toolbar.ts:787:      if (capsule) {
src/editors/orchestration/floating-toolbar.ts:788:        capsule.destroy();
src/editors/orchestration/floating-toolbar.ts:789:        capsule = null;
src/editors/orchestration/floating-toolbar.ts:844:      const chord = es.config.rouletteHotkey ?? ROULETTE_HOTKEY_DEFAULT;
src/editors/orchestration/floating-toolbar.ts:848:      if (handle || capsule) {
src/editors/orchestration/floating-toolbar.ts:881:        } else if (handle || capsule) {
src/editors/orchestration/floating-toolbar.ts:885:            !capsule?.element.matches(":hover")
src/styles/editor.css:1510:/* 页签胶囊高度略降；页签条保留原高，胶囊上下留缝不压边线。 */
src/styles/editor.css:1511:.tab-capsule {
src/styles/editor.css:1629:@keyframes capsuleIn {
src/styles/editor.css:1639:.capsule-enter {
src/styles/editor.css:1640:  animation: capsuleIn 0.18s cubic-bezier(0.2, 0.8, 0.2, 1);
src/styles/editor.css:1668:  .capsule-enter {
src/styles/editor.css:3397:/* ── 选区轮盘（selection-roulette）────────────────────────── */
src/styles/editor.css:3398:.selection-roulette {
src/styles/editor.css:3413:.selection-roulette.is-open {
src/styles/editor.css:3419:.selection-roulette.form-hub .sr-root-layer,
src/styles/editor.css:3420:.selection-roulette.form-hub .sr-labels {
src/styles/editor.css:3450:.selection-roulette.sub-open .sr-sec.sr-sector {
src/styles/editor.css:3455:.selection-roulette.third-open .sr-sec.sr-sector,
src/styles/editor.css:3456:.selection-roulette.third-open .sr-labels {
src/styles/editor.css:3460:.selection-roulette.filtering .sr-sec.sr-sector {
src/styles/editor.css:3584:/* ── 胶囊选区工具条（#572）────────────────────────────── */
src/styles/editor.css:3585:.app-capsule-toolbar {
src/styles/editor.css:3595:.app-capsule-toolbar.is-open {
src/styles/editor.css:3600:.capsule-rows {
src/styles/editor.css:3611:.capsule-row {
src/styles/editor.css:3618:.capsule-row-single {
src/styles/editor.css:3629:.capsule-row-secondary {
src/styles/editor.css:3633:.capsule-btn {
src/styles/editor.css:3646:.capsule-btn:hover {
src/styles/editor.css:3651:.capsule-swatch {
src/styles/editor.css:3659:.capsule-swatch.is-default {
src/styles/editor.css:3817:/* ── 全局胶囊提示（ui-polish-batch12 9.1）───────────────────────── */
src/styles/editor.css:3832:  /* 箭头尾跨在胶囊边上（R-26），不能裁切；文本截断交给 __text。 */
src/lib/overlayGate.ts:4: * 悬停胶囊由 TooltipLayer 事件委托驱动，弹窗（右键菜单、栏目菜单、状态栏
src/stores/captureOverlay.ts:147:  capsuleX: number;
src/stores/captureOverlay.ts:148:  capsuleY: number;
src/stores/captureOverlay.ts:186:  setCapsulePosition: (x: number, y: number) => void;
src/stores/captureOverlay.ts:187:  clampCapsulePosition: () => void;
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
src/stores/captureOverlay.ts:594:    setCapsulePosition: (x: number, y: number) =>
src/stores/captureOverlay.ts:595:      set({ capsuleX: x, capsuleY: y }),
src/stores/captureOverlay.ts:597:    clampCapsulePosition: () => {
src/stores/captureOverlay.ts:602:      const { capsuleX, capsuleY } = get();
src/stores/captureOverlay.ts:603:      const newX = Math.max(padding, Math.min(capsuleX, maxX));
src/stores/captureOverlay.ts:604:      const newY = Math.max(padding, Math.min(capsuleY, maxY));
src/stores/captureOverlay.ts:605:      set({ capsuleX: newX, capsuleY: newY });
src/stores/captureOverlay.ts:606:      // Persist capsule position
src/stores/captureOverlay.ts:609:          captureConfig: { capsuleX: newX, capsuleY: newY },
src/styles/doc-property.css:4: * 不自造色值；布局尺寸（5 列网格 / 胶囊间距）来自批准设计 P-10。
src/styles/doc-property.css:64:/* ── 标签胶囊 ───────────────────────────────────────────── */
src/styles/doc-property.css:194:/* 自动托管日期的只读锁定标记（A 胶囊内 / B 行尾占位） */
src/styles/doc-property.css:253:/* 手柄绝对定位在胶囊左外侧、不占布局；悬停才显示（编辑态才渲染） */
src/components/CaptureOverlay.tsx:77:  const isCapsule = !IS_OVERLAY_WINDOW && store.status === "capsule";
src/components/CaptureOverlay.tsx:104:    if (!isVisible || isCapsule) return;
src/components/CaptureOverlay.tsx:144:  }, [isVisible, isCapsule, store]);
src/components/CaptureOverlay.tsx:268:      // Tell main window to show capsule, then hide overlay
src/components/CaptureOverlay.tsx:271:          emit("overlay-to-capsule");
src/components/CaptureOverlay.tsx:396:  const handleCapsuleClick = () => {
src/components/CaptureOverlay.tsx:413:  const onCapsuleMouseDown = (e: React.MouseEvent) => {
src/components/CaptureOverlay.tsx:419:      x: e.clientX - (store.capsuleX || window.innerWidth - 24 - 44),
src/components/CaptureOverlay.tsx:420:      y: e.clientY - (store.capsuleY || window.innerHeight - 24 - 44),
src/components/CaptureOverlay.tsx:427:      store.setCapsulePosition(
src/components/CaptureOverlay.tsx:436:        store.clampCapsulePosition();
src/components/CaptureOverlay.tsx:447:  if (isCapsule) {
src/components/CaptureOverlay.tsx:449:      store.capsuleX === 0 ? window.innerWidth - 24 - 44 : store.capsuleX;
src/components/CaptureOverlay.tsx:451:      store.capsuleY === 0 ? window.innerHeight - 24 - 44 : store.capsuleY;
src/components/CaptureOverlay.tsx:453:      store.capsuleX === 0 && store.capsuleY === 0
src/components/CaptureOverlay.tsx:465:            onClick={handleCapsuleClick}
src/components/CaptureOverlay.tsx:466:            onMouseDown={onCapsuleMouseDown}
src/components/TabInfoPopover.tsx:58: * 外壳为胶囊卡片，复用全局 `--tip-shell-radius`。
src/components/TooltipLayer.tsx:21:/** 用与自绘胶囊同一外壳的隐藏探针量出真实尺寸，供方位判断与锚点夹取。 */
src/components/TooltipLayer.tsx:150: * 全局胶囊提示（ui-polish-batch12 9.1；batch20 C1 收敛）。
src/components/TooltipLayer.tsx:152: * 事件委托捕获既有 `title` 属性：悬停满配置时长后显示自绘胶囊，并把原生
src/components/TooltipLayer.tsx:155: * 都被接管，原生矩形无处出现；弹层打开期间只摘 title、不补胶囊。
src/components/TooltipLayer.tsx:169:    // 只藏胶囊、保留 title 摘除状态：弹层打开期间不放行原生 title。
src/components/TooltipLayer.tsx:205:      // 弹层打开期间只摘原生 title、不补胶囊（提示与浮层重复）。
src/components/TooltipLayer.tsx:241:      // 胶囊保持显示，不做二次摘除。
src/components/TooltipLayer.tsx:251:      // Esc 会先移除悬停元素（轮盘 / 菜单），绕开 pointerout 留下孤儿胶囊（#819）。
src/components/TabBar.tsx:539:                    ? "tab-capsule rounded-full bg-[var(--app-accent-soft)] font-medium text-[var(--app-text-strong)]"
src/components/SettingsView.tsx:30:import { ROULETTE_HOTKEY_DEFAULT } from "../editors/orchestration/roulette";
src/components/SettingsView.tsx:616:  const selectionToolbar = useEditorStore(
src/components/SettingsView.tsx:617:    (s) => s.config.selectionToolbar ?? "roulette",
src/components/SettingsView.tsx:627:  const rouletteSectors = useEditorStore(
src/components/SettingsView.tsx:628:    (s) => s.config.rouletteSectors ?? null,
src/components/SettingsView.tsx:630:  const rouletteHotkey = useEditorStore((s) => s.config.rouletteHotkey ?? null);
src/components/SettingsView.tsx:631:  const rouletteForm = useEditorStore((s) => s.config.rouletteForm ?? "hub");
src/components/SettingsView.tsx:914:  const chooseSelectionToolbar = (mode: "roulette" | "capsule") => {
src/components/SettingsView.tsx:915:    setConfig({ selectionToolbar: mode });
src/components/SettingsView.tsx:935:    setConfig({ rouletteForm: form });
src/components/SettingsView.tsx:958:    setConfig({ rouletteHotkey: value.trim() ? value : null });
src/components/SettingsView.tsx:961:    if (!rouletteHotkey?.trim()) setConfig({ rouletteHotkey: null });
src/components/SettingsView.tsx:966:    rouletteSectors ?? ROULETTE_SECTOR_META.map((m) => m.id);
src/components/SettingsView.tsx:968:    setConfig({ rouletteSectors: next.length > 0 ? next : null });
src/components/SettingsView.tsx:989:    setConfig({ rouletteSectors: null });
src/components/SettingsView.tsx:1380:                  选中文字后出现的工具条形态。胶囊把高频动作放在靠近指针的一行。
src/components/SettingsView.tsx:1385:                      { value: "roulette", label: "轮盘" },
src/components/SettingsView.tsx:1386:                      { value: "capsule", label: "胶囊" },
src/components/SettingsView.tsx:1393:                      aria-pressed={selectionToolbar === option.value}
src/components/SettingsView.tsx:1396:                        selectionToolbar === option.value
src/components/SettingsView.tsx:1435:              <section data-testid="settings-roulette-switch">
src/components/SettingsView.tsx:1446:                    value={rouletteHotkey ?? ""}
src/components/SettingsView.tsx:1457:                    data-testid="settings-roulette-hotkey"
src/components/SettingsView.tsx:1471:                      data-testid={`settings-roulette-form-${option.value}`}
src/components/SettingsView.tsx:1472:                      aria-pressed={rouletteForm === option.value}
src/components/SettingsView.tsx:1475:                        rouletteForm === option.value
src/components/SettingsView.tsx:1486:              <section data-testid="settings-roulette-sectors">
src/components/SettingsView.tsx:1508:                        data-testid={`roulette-sector-row-${id}`}
src/components/SettingsView.tsx:1516:                          data-testid={`roulette-sector-toggle-${id}`}
src/components/SettingsView.tsx:1528:                              data-testid={`roulette-sector-up-${id}`}
src/components/SettingsView.tsx:1537:                              data-testid={`roulette-sector-down-${id}`}
src/components/SettingsView.tsx:1551:                  data-testid="roulette-sector-reset"
src/__tests__/editor/roulette.test.ts:28:} from "../../editors/orchestration/roulette";
src/__tests__/editor/roulette.test.ts:30:describe("roulette 几何常量", () => {
src/components/ai/SelectionPill.tsx:107:      // 兜底：选区落在编辑器 DOM 内时，胶囊一律不渲染（AI 三动作归轮盘）。
src/components/Content/DocPropertyBar.tsx:1066:/** 标签单元格：预览态只读胶囊，编辑态可增删改名。 */
src/__tests__/selectionPill.test.tsx:82:  if (!pill) throw new Error("选区胶囊未渲染");
src/__tests__/selectionPill.test.tsx:100:  if (!pill) throw new Error("选区胶囊未渲染");
src/__tests__/selectionPill.test.tsx:135:  it("选区落在预览渲染区时出现胶囊，动作恰好 复制/解释/翻译 三个", () => {
src/__tests__/selectionPill.test.tsx:149:  it("点复制把选区文本写进剪贴板并关闭胶囊", async () => {
src/__tests__/selectionPill.test.tsx:196:  it("编辑区选区不再渲染胶囊，由选区轮盘接管", () => {
src/__tests__/selectionPill.test.tsx:214:  it("选区跨越编辑区与预览区时不显示胶囊", () => {
src/__tests__/selectionPill.test.tsx:231:  it("选区收缩后胶囊消失", () => {
src/__tests__/selectionPill.test.tsx:245:  it("按 Escape 后胶囊消失", () => {
src/__tests__/selectionPillMode.test.ts:56:  it("returns null in the editor: AI actions live in the roulette", () => {
src/__tests__/components/TooltipLayer.test.tsx:87:  it("菜单触发按钮接管 title：出现自绘胶囊且原生 title 被摘除", () => {
src/__tests__/editor/roulette-filter.test.ts:5:} from "../../editors/orchestration/roulette-view";
src/hooks/useConfig.ts:74:  rouletteSectors?: string[] | null;
src/hooks/useConfig.ts:75:  rouletteHotkey?: string | null;
src/hooks/useConfig.ts:76:  rouletteForm?: string | null;
src/hooks/useConfig.ts:77:  roulettePosition?: { x: number; y: number } | null;
src/hooks/useConfig.ts:177:    rouletteSectors: es.config.rouletteSectors ?? null,
src/hooks/useConfig.ts:178:    rouletteHotkey: es.config.rouletteHotkey ?? null,
src/hooks/useConfig.ts:179:    rouletteForm: es.config.rouletteForm ?? null,
src/hooks/useConfig.ts:180:    roulettePosition: es.config.roulettePosition ?? null,
src/hooks/useConfig.ts:372: * 悬停胶囊与页签信息窗共用同一回退值（单一来源）。
src/hooks/useConfig.ts:420:    rouletteSectors: normalizeRouletteSectors(raw.rouletteSectors),
src/hooks/useConfig.ts:421:    rouletteHotkey: raw.rouletteHotkey ? raw.rouletteHotkey : null,
src/hooks/useConfig.ts:422:    rouletteForm:
src/hooks/useConfig.ts:423:      raw.rouletteForm === "hub" || raw.rouletteForm === "disk"
src/hooks/useConfig.ts:424:        ? raw.rouletteForm
src/hooks/useConfig.ts:426:    roulettePosition:
src/hooks/useConfig.ts:427:      raw.roulettePosition &&
src/hooks/useConfig.ts:428:      Number.isFinite(raw.roulettePosition.x) &&
src/hooks/useConfig.ts:429:      Number.isFinite(raw.roulettePosition.y)
src/hooks/useConfig.ts:430:        ? { x: raw.roulettePosition.x, y: raw.roulettePosition.y }
rg: src/types.ts: No such file or directory (os error 2)
src/hooks/useConfig.ts:46:  readerFontSize: number | null;
src/hooks/useConfig.ts:47:  readerWidth: number | null;
src/hooks/useConfig.ts:48:  readerSkin: string | null;
src/hooks/useConfig.ts:152:    readerFontSize: es.config.readerFontSize ?? null,
src/hooks/useConfig.ts:153:    readerWidth: es.config.readerWidth ?? null,
src/hooks/useConfig.ts:154:    readerSkin: es.config.readerSkin ?? null,
src/hooks/useConfig.ts:394:    readerFontSize: raw.readerFontSize ?? 17,
src/hooks/useConfig.ts:395:    readerWidth: raw.readerWidth ?? 1080,
src/hooks/useConfig.ts:396:    readerSkin: raw.readerSkin ?? "paper",
src/hooks/useConfig.ts:487:  applyReaderSkin(config.readerSkin ?? "paper");
src/hooks/useConfig.ts:556:        readerFontSize: 17,
src/hooks/useConfig.ts:557:        readerWidth: 1080,
src/hooks/useConfig.ts:558:        readerSkin: "paper",
src/components/SettingsView.tsx:36:} from "../lib/readerWidth";
src/components/SettingsView.tsx:614:  const readerFontSize = useEditorStore((s) => s.config.readerFontSize ?? 17);
src/components/SettingsView.tsx:615:  const readerWidth = useEditorStore((s) => s.config.readerWidth ?? 1080);
src/components/SettingsView.tsx:642:  const readerSkin = useEditorStore((s) => s.config.readerSkin ?? "paper");
src/components/SettingsView.tsx:831:    setConfig({ readerFontSize: size });
src/components/SettingsView.tsx:884:    setConfig({ readerWidth: width });
src/components/SettingsView.tsx:907:    setConfig({ readerWidth: width });
src/components/SettingsView.tsx:1024:    setConfig({ readerSkin: skin });
src/components/SettingsView.tsx:1060:    const preset = PROVIDERS.find((p) => p.id === id);
src/components/SettingsView.tsx:1061:    if (!preset) return;
src/components/SettingsView.tsx:1064:      openaiEndpoint: preset.endpoint,
src/components/SettingsView.tsx:1065:      openaiModel: preset.defaultModel,
src/components/SettingsView.tsx:1243:                    const selected = readerFontSize === size;
src/components/SettingsView.tsx:1840:                    const selected = readerWidth === option.value;
src/components/SettingsView.tsx:1868:                      Math.max(READER_WIDTH_MIN, readerWidth),
src/components/SettingsView.tsx:1881:                    {readerWidth}px
src/components/SettingsView.tsx:1892:                    const selected = readerSkin === tone.id;

exec
/bin/zsh -c "nl -ba docs/agents/data-surface.md | sed -n '1,260p'
rg -n '0005|API key|keyring|密钥' docs/architecture/decisions docs -g '*.md' | sed -n '1,220p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
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
docs/architecture/decisions/0005-api-key-os-keyring.md:2:title: API key 只存 OS keyring
docs/architecture/decisions/0005-api-key-os-keyring.md:8:# ADR 0005 — API key 只存 OS keyring
docs/architecture/decisions/0005-api-key-os-keyring.md:15:翻译等功能需要第三方 API key。配置文件（`app_config.json`）是明文磁盘文件，可能被备份、同步或误提交，把密钥写入其中会造成泄漏风险。
docs/architecture/decisions/0005-api-key-os-keyring.md:19:API key **只存操作系统钥匙串（OS keyring）**，经由 Rust 命令 `get_api_key` / `set_api_key` / `delete_api_key` 读写，**不写入任何配置文件**。实现见 `src-tauri/src/commands/config_cmd.rs`。
docs/architecture/decisions/0005-api-key-os-keyring.md:23:- 密钥不落明文配置，降低泄漏面；日志同样不记录 API key。
docs/architecture/decisions/0005-api-key-os-keyring.md:24:- 密钥可用性依赖 OS keyring 后端，跨平台需各自适配。
docs/architecture/decisions/0005-api-key-os-keyring.md:25:- 前端获取密钥必须经命令通道，不能从配置对象直接读取。
docs/MIGRATION-REPORT.md:96:| 当前架构 | `docs/architecture/overview.md` + `docs/architecture/decisions/`（ADR 0001–0005） | `docs/ARCHITECTURE.md` 标 needs-review，被 overview/ADR 取代；入口不再指向它 |
docs/MIGRATION-REPORT.md:261:| 8 架构现状+ADR | `docs/architecture/overview.md`、`decisions/0001–0005`、`CONTEXT.md` | `task-8/architecture.txt` |
docs/architecture/decisions/README.md:28:| 0005 | API key 只存 OS keyring | accepted |
docs/delivery/requirements-status.md:290:| S-10 | OpenAI 翻译路径不可用 + key 未走 keyring | 🗒 | P1 |
docs/product/vision.md:71:4. 不为云端免费服务做（本地优先，API key 用户自持）。
docs/delivery/roadmap.md:24:| **1 · 地基** | 改名（标月 / Biaoyue）→ 配置三层 + 原子写 + 快照回滚 + 热应用 → agent 循环（三工具 + provider 预设 + keyring + SKILL.md）→ AI 入口 V1（⌘K 浮层 + 选区动作 + 确认卡三档 + 撤销/快照 UI） | 一句「换深色主题，字号 18」热应用且可撤销；非法值被拒；换模型仍生效 |
docs/architecture/decisions/0008-ai-entry-phasing-voice.md:21:- **供应商**：单一 OpenAI 兼容通道 + provider 预设（DeepSeek / 通义 / Kimi / GLM / WorkBuddy(codebuddy) / OpenCode / Pi / 自定义），API key 只存 OS keyring（ADR 0005）；本地 LLM 与多 agent 标「规划中」。
docs/product/users.md:34:- 内置 provider 预设（DeepSeek / 通义 / Kimi / GLM / 自定义等），用户配一个 API key 即可用 AI；key 只存 OS keyring。
docs/agents/evidence-capture.md:432:2. **不录密钥/令牌/客户数据**：录制前检查屏幕，确保无敏感信息。含敏感画面的流程标 `untested` 并说明原因。
docs/agents/data-surface.md:128:| API key | OS 钥匙串 | ADR 0005 |
docs/CORE-REQUIREMENTS-clairis.md:397:| 灵感同步（P2） | E2E 加密上传 | ✅ 加密态 | 用户指定云服务 | 用户持有密钥 |
docs/product/principles.md:46:4. 不为**云端免费服务**做（本地优先，API key 用户自持）。
docs/MIGRATION-MAP.md:114:| `docs/ARCHITECTURE.md` | `docs/archive/2026/legacy-docs/ARCHITECTURE.md` | `architecture` | `archived` | `historical` | `archive` |  | 归档至 legacy-docs（被 docs/architecture/overview.md + ADR 0001-0005 取代，仍用旧名 MDWRT）。 |
docs/architecture/decisions/0005-api-key-os-keyring.md:2:title: API key 只存 OS keyring
docs/architecture/decisions/0005-api-key-os-keyring.md:8:# ADR 0005 — API key 只存 OS keyring
docs/architecture/decisions/0005-api-key-os-keyring.md:15:翻译等功能需要第三方 API key。配置文件（`app_config.json`）是明文磁盘文件，可能被备份、同步或误提交，把密钥写入其中会造成泄漏风险。
docs/architecture/decisions/0005-api-key-os-keyring.md:19:API key **只存操作系统钥匙串（OS keyring）**，经由 Rust 命令 `get_api_key` / `set_api_key` / `delete_api_key` 读写，**不写入任何配置文件**。实现见 `src-tauri/src/commands/config_cmd.rs`。
docs/architecture/decisions/0005-api-key-os-keyring.md:23:- 密钥不落明文配置，降低泄漏面；日志同样不记录 API key。
docs/architecture/decisions/0005-api-key-os-keyring.md:24:- 密钥可用性依赖 OS keyring 后端，跨平台需各自适配。
docs/architecture/decisions/0005-api-key-os-keyring.md:25:- 前端获取密钥必须经命令通道，不能从配置对象直接读取。
docs/design/system/governance.md:77:4. 不为云端免费服务做（本地优先，API key 用户自持）。
docs/design/system/governance.md:264:| 0005 | API key 只存 OS keyring | accepted |
docs/architecture/decisions/README.md:28:| 0005 | API key 只存 OS keyring | accepted |
docs/architecture/decisions/0008-ai-entry-phasing-voice.md:21:- **供应商**：单一 OpenAI 兼容通道 + provider 预设（DeepSeek / 通义 / Kimi / GLM / WorkBuddy(codebuddy) / OpenCode / Pi / 自定义），API key 只存 OS keyring（ADR 0005）；本地 LLM 与多 agent 标「规划中」。
docs/archive/2026/legacy-docs/MVP-渐明-v1.md:288:| API Key 存储 | OS keyring（无 Core Data Storage） |
docs/design/approved/selection-roulette/HANDOFF.md:60:8. **API key** 只走 OS keyring —— 本功能不涉及，别顺手改。
docs/requirements/ui-polish-batch12/spec-issue-body.md:56:- **新建文件默认路径**：配置新增默认保存路径字段，缺省 `null` 表示沿用当前行为（首次保存时选择路径，见既有 C-4 场景）；设置页提供读写入口。持久化走既有配置存储，不进 API key ring。
docs/architecture/overview.md:126:## 十二、API 密钥存储
docs/architecture/overview.md:128:API key 只存 OS 钥匙串，经由 `get_api_key` / `set_api_key` / `delete_api_key` 命令读写，**不写入配置文件**（决策依据见 [ADR 0005](./decisions/0005-api-key-os-keyring.md)）。实现见 `src-tauri/src/commands/config_cmd.rs`。
docs/architecture/overview.md:138:- [ADR 0005](./decisions/0005-api-key-os-keyring.md) — API key 只存 OS keyring
docs/archive/2026/legacy-requirements/CORE-REQUIREMENTS-v3-archived.md:242:> **当前状态:** Rust 流式翻译后端已在 Phase 0 完成 (Ollama + OpenAI 端点，流式输出，keyring 存储 API Key)。
docs/archive/2026/legacy-requirements/CORE-REQUIREMENTS-v3-archived.md:345:| API Key 存储 | OS keyring (keyring crate)，不落盘明文 |
docs/archive/2026/legacy-requirements/CORE-REQUIREMENTS-v3-archived.md:374:| API Key 存储 | OS keyring (keyring crate) | 安全，不落盘明文 |
docs/archive/2026/legacy-requirements/CORE-REQUIREMENTS-v3-archived.md:444:│  │  ├ Config + keyring                               │  │
docs/archive/2026/legacy-requirements/CORE-REQUIREMENTS-v3-archived.md:551:| 翻译云端 | OpenAI API (keyring) | 高质量、兼容多模型 | 自己维护翻译引擎不现实 |
docs/archive/2026/legacy-requirements/CORE-REQUIREMENTS-v4-archived.md:328:| API Key 存储 | keyring | 安全，不落盘明文 |
docs/archive/2026/legacy-docs/EXECUTION-PLAN.md:127:| 0.5.3 | API Key 管理 (keyring CRUD) | §五 | ✅ | get/set/delete_api_key |
docs/archive/2026/legacy-docs/ARCHITECTURE.md:47:│  │  config: load/save + keyring CRUD                      │  │
docs/archive/2026/legacy-docs/ARCHITECTURE.md:273:| `get_api_key` | keyring 读取 | — |
docs/archive/2026/legacy-docs/ARCHITECTURE.md:274:| `set_api_key` | keyring 写入 | — |
docs/archive/2026/legacy-docs/ARCHITECTURE.md:275:| `delete_api_key` | keyring 删除 | — |
docs/archive/2026/legacy-docs/ARCHITECTURE.md:431:| P0-4 | Rust 后端补全 (directory/config/keyring/stop_translation) | 无 | 2天 |
docs/archive/2026/legacy-docs/ARCHITECTURE.md:451:| API Key | OS keyring |
docs/archive/2026/legacy-requirements/渐晰Markdown 阅读编辑器 会话移交文档.md:58:│   ├── config.rs                         # AppConfig + keyring CRUD
docs/archive/2026/legacy-requirements/渐晰Markdown 阅读编辑器 会话移交文档.md:102:- `get_api_key` / `set_api_key` / `delete_api_key` — keyring CRUD 未注册为命令
docs/archive/2026/legacy-requirements/渐晰Markdown 阅读编辑器 会话移交文档.md:108:2. **API Key keyring** — `get_api_key`/`set_api_key`/`delete_api_key` 需要注册 commands 并在前端调用
docs/archive/2026/legacy-requirements/渐晰Markdown 阅读编辑器 会话移交文档.md:151:- **API Key**: OS keyring (keyring crate), 不存 config.json
docs/archive/2026/legacy-requirements/渐晰Markdown 阅读编辑器 会话移交文档.md:161:1. **补 Rust 命令注册** — 把 config/keyring/size_limits 注册到 lib.rs
docs/archive/2026/legacy-requirements/CORE-REQUIREMENTS-V4-2-archived.md:328:| API Key 存储 | keyring | 安全，不落盘明文 |
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:57:| C1 | **API 密钥 / 密钥类** | 密钥永不文件化（ADR 0005），不进入插件体系 |
docs/archive/2026/legacy-requirements/CORE-REQUIREMENTS-渐明-archived.md:502:| **灵感同步（P2）** | 端到端加密后上传 | **是**（加密态） | 用户指定云服务 | 用户持有密钥 |
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:19:- **密钥永不文件化**（apiKey 仅内存，走 keyring 命令）。
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:78:| C1 | **API 密钥 / 密钥类** | 密钥永不文件化（ADR 0005）；apiKey 仅内存走 keyring |
docs/research/technical/data-fileization-omarchy-inventory.md:12:> **依据**：`docs/research/technical/plugin-management-benchmark.md`（Omarchy「扩展点 = 数据文件」对标）、已归档 change `2026-11-01-text-config-layer` 与 `2026-11-03-extension-points` 的 design.md、已归档 change `layout-portal`（[#170](https://github.com/jianxi-dev/clairis/issues/170)）的 design.md D11、ADR 0004/0005。
docs/research/technical/data-fileization-omarchy-inventory.md:92:| API key | OS 钥匙串（`get/set/delete_api_key`） | ADR 0005：密钥永不落盘进配置文件 |
docs/research/technical/data-fileization-omarchy-inventory.md:115:| 13 | API key | OS 钥匙串 | ✅ 已落地 | **永不文件化**（ADR 0005） |
docs/research/technical/data-fileization-omarchy-inventory.md:125:- **范围纪律**：密钥永不文件化；执行代码不进数据扩展点；没有消费者的数据文件不提前建目录。

exec
/bin/zsh -c "nl -ba src-tauri/src/extensions.rs | sed -n '271,390p'
nl -ba src/lib/extensions/theme-tokens.ts | sed -n '1,240p'
nl -ba src/lib/extensions/bundle.ts | sed -n '1,240p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
   271	/// 扫描 `<dir>/templates/*.md`。文件名（去扩展名）即模板名；重名后读覆盖先读。
   272	fn scan_templates(dir: &Path, warnings: &mut Vec<String>) -> Vec<Template> {
   273	    let dir = dir.join("templates");
   274	    let entries = match std::fs::read_dir(&dir) {
   275	        Ok(entries) => entries,
   276	        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Vec::new(),
   277	        Err(e) => {
   278	            warnings.push(format!("templates: 无法读取目录（{e}）"));
   279	            return Vec::new();
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
   376	        warnings,
   377	    }
   378	}
   379	
   380	#[cfg(test)]
   381	mod tests {
   382	    use super::*;
   383	
   384	    fn temp_dir(tag: &str) -> tempfile::TempDir {
   385	        tempfile::Builder::new()
   386	            .prefix(&format!("biaoyue_ext_{tag}_"))
   387	            .tempdir()
   388	            .expect("create temp dir")
   389	    }
   390	
     1	/* 主题 token 覆盖（design §D4）。
     2	 *
     3	 * `theme.toml` 的 `[tokens]` 经 IPC 传到前端后**再校验一遍**（不信任 IPC 输入）：
     4	 * 键只接受 `src/styles/tokens.css` 已声明的 `--app-*` 名，且裸名与带前缀两种写法
     5	 * 等价（`accent` 与 `--app-accent` 都指向 `--app-accent`）；值只能是
     6	 * `#rgb` / `#rrggbb` / `rgb()` / `rgba()` / `hsl()` / 具名色。非法项丢弃；
     7	 * 全部非法时 `buildTokenStyle` 返回 `null`。
     8	 *
     9	 * 应用方式：在 `document.head` 维护**单个** `<style id="user-theme-tokens">`，
    10	 * 内容形如 `:root{--app-x:...;}`，只作用于 `:root`，绝不修改任何 CSS 文件。
    11	 */
    12	
    13	/** `tokens.css` 已声明的 token 名（不含 `--app-` 前缀）。新增 token 时同步此处。 */
    14	const DECLARED_TOKENS: ReadonlySet<string> = new Set([
    15	  "accent",
    16	  "accent-soft",
    17	  "bg",
    18	  "surface",
    19	  "sunken",
    20	  "text",
    21	  "text-strong",
    22	  "text-2",
    23	  "text-3",
    24	  "border",
    25	  "border-strong",
    26	  "radius",
    27	  "shadow",
    28	]);
    29	
    30	const NAME_RE = /^[a-z0-9-]+$/;
    31	const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
    32	/** 函数式颜色：`rgb(...)` / `rgba(...)` / `hsl(...)`，内部不含括号/分号，杜绝注入。 */
    33	const FUNC_RE = /^(?:rgb|rgba|hsl)\([0-9a-zA-Z.,%/+ -]*\)$/;
    34	/** 具名色（`red` / `rebeccapurple`）；只有字母，无法注入声明或 `url()`。 */
    35	const NAMED_RE = /^[a-zA-Z]+$/;
    36	
    37	/**
    38	 * 把 `theme.toml` 里的键规范化成 `--app-<name>`。
    39	 * 未声明或形状非法的键返回 `null`（调用方丢弃并计入告警）。
    40	 */
    41	export function normalizeTokenKey(key: string): string | null {
    42	  const name = key.startsWith("--app-") ? key.slice("--app-".length) : key;
    43	  if (!NAME_RE.test(name)) return null;
    44	  if (!DECLARED_TOKENS.has(name)) return null;
    45	  return `--app-${name}`;
    46	}
    47	
    48	/** 值白名单：`#rgb`/`#rrggbb`/`rgb()`/`rgba()`/`hsl()`/具名色；其它（含 `url()`）拒绝。 */
    49	function isValidColorValue(value: string): boolean {
    50	  const trimmed = value.trim();
    51	  if (trimmed === "") return false;
    52	  return (
    53	    HEX_RE.test(trimmed) || FUNC_RE.test(trimmed) || NAMED_RE.test(trimmed)
    54	  );
    55	}
    56	
    57	export interface TokenStyleResult {
    58	  /** `:root{...}` 文本；没有任何合法项时为 `null`。 */
    59	  css: string | null;
    60	  /** 被丢弃的键（未声明 / 值非法），用于聚合一条告警。 */
    61	  rejected: string[];
    62	}
    63	
    64	/**
    65	 * 把 token 表编译成 `:root{...}` 样式文本，同时返回被丢弃的键。
    66	 * 同一个 token 的两种写法重复出现时，后出现的覆盖先出现的。
    67	 */
    68	export function compileTokenStyle(
    69	  tokens: Record<string, string>,
    70	): TokenStyleResult {
    71	  const declarations = new Map<string, string>();
    72	  const rejected: string[] = [];
    73	
    74	  for (const [rawKey, value] of Object.entries(tokens)) {
    75	    const key = normalizeTokenKey(rawKey);
    76	    if (
    77	      key === null ||
    78	      typeof value !== "string" ||
    79	      !isValidColorValue(value)
    80	    ) {
    81	      rejected.push(rawKey);
    82	      continue;
    83	    }
    84	    declarations.set(key, value.trim());
    85	  }
    86	
    87	  if (declarations.size === 0) return { css: null, rejected };
    88	  const body = [...declarations].map(([key, value]) => `${key}:${value};`);
    89	  return { css: `:root{${body.join("")}}`, rejected };
    90	}
    91	
    92	/**
    93	 * 把 token 表编译成一段 `:root{...}` 样式文本。
    94	 * 非法键/值静默丢弃；没有任何合法项时返回 `null`。
    95	 */
    96	export function buildTokenStyle(tokens: Record<string, string>): string | null {
    97	  return compileTokenStyle(tokens).css;
    98	}
    99	
   100	/**
   101	 * 应用 token 覆盖：在 `document.head` 维护单个 `<style id="user-theme-tokens">`。
   102	 * `tokens` 全部非法（`buildTokenStyle` 返回 `null`）时移除该元素。
   103	 */
   104	export function applyThemeTokens(tokens: Record<string, string>): void {
   105	  const style = buildTokenStyle(tokens);
   106	  const existing = document.head.querySelector<HTMLStyleElement>(
   107	    "style#user-theme-tokens",
   108	  );
   109	
   110	  if (style === null) {
   111	    existing?.remove();
   112	    return;
   113	  }
   114	
   115	  if (existing) {
   116	    existing.textContent = style;
   117	    return;
   118	  }
   119	
   120	  const el = document.createElement("style");
   121	  el.id = "user-theme-tokens";
   122	  el.setAttribute("data-theme-tokens", "");
   123	  el.textContent = style;
   124	  document.head.appendChild(el);
   125	}
   126	
   127	export const applyUserThemeTokens = applyThemeTokens;
     1	/* 扩展 bundle：一次 `list_extensions` 调用拿回 templates + theme tokens + warnings。
     2	 *
     3	 * 与 `src/editors/user-extensions.ts` 的 `loadUserExtensions` 并存（后者把
     4	 * snippets 映射成斜杠命令）；本模块负责新建页模板与主题 token。
     5	 * 任何调用异常或返回形状不对都静默返回空 bundle，不抛错
     6	 * （`list_extensions` 在纯浏览器/老版本里不存在）。
     7	 */
     8	
     9	import type { Template } from "./templates";
    10	import type { UserSnippet } from "../../editors/user-extensions";
    11	import { extractSnippets } from "../../editors/user-extensions";
    12	
    13	export interface ExtensionBundle {
    14	  templates: Template[];
    15	  themeTokens: Record<string, string>;
    16	  warnings: string[];
    17	}
    18	
    19	/** 一次 `list_extensions` 调用解析出的三类扩展数据（snippets 供斜杠菜单）。 */
    20	export interface ExtensionSnapshot {
    21	  snippets: UserSnippet[];
    22	  templates: Template[];
    23	  themeTokens: Record<string, string>;
    24	}
    25	
    26	function isRecord(value: unknown): value is Record<string, unknown> {
    27	  return typeof value === "object" && value !== null && !Array.isArray(value);
    28	}
    29	
    30	/** 宽松解析单个 template；缺 `name`/`body` 或类型不对返回 null。 */
    31	function toTemplate(raw: unknown): Template | null {
    32	  if (!isRecord(raw)) return null;
    33	  const { name, body, path } = raw;
    34	  if (typeof name !== "string" || name === "") return null;
    35	  if (typeof body !== "string") return null;
    36	  if (typeof path !== "string") return null;
    37	  return { name, body, path };
    38	}
    39	
    40	/** 从 `list_extensions` 返回值里取模板；形状不对返回空列表。 */
    41	function extractTemplates(result: unknown): Template[] {
    42	  if (!isRecord(result)) return [];
    43	  const templates = result.templates;
    44	  if (!Array.isArray(templates)) return [];
    45	  const out: Template[] = [];
    46	  for (const entry of templates) {
    47	    const template = toTemplate(entry);
    48	    if (template !== null) out.push(template);
    49	  }
    50	  return out;
    51	}
    52	
    53	/** 从 `theme.tokens` 取字符串键值对；形状不对返回空对象。 */
    54	function extractTokens(result: unknown): Record<string, string> {
    55	  if (!isRecord(result)) return {};
    56	  const theme = result.theme;
    57	  if (!isRecord(theme)) return {};
    58	  const tokens = theme.tokens;
    59	  if (!isRecord(tokens)) return {};
    60	  const out: Record<string, string> = {};
    61	  for (const [key, value] of Object.entries(tokens)) {
    62	    if (typeof value === "string") out[key] = value;
    63	  }
    64	  return out;
    65	}
    66	
    67	/** 从顶层 `warnings` 取字符串数组；形状不对返回空列表。 */
    68	function extractWarnings(result: unknown): string[] {
    69	  if (!isRecord(result)) return [];
    70	  const warnings = result.warnings;
    71	  if (!Array.isArray(warnings)) return [];
    72	  return warnings.filter((w): w is string => typeof w === "string");
    73	}
    74	
    75	/** 把 `list_extensions` 返回值映射成 bundle；形状不对的字段各自降级。 */
    76	function toBundle(result: unknown): ExtensionBundle {
    77	  return {
    78	    templates: extractTemplates(result),
    79	    themeTokens: extractTokens(result),
    80	    warnings: extractWarnings(result),
    81	  };
    82	}
    83	
    84	/**
    85	 * 调一次 `list_extensions` 并解析成 bundle。
    86	 * 异常（命令不存在/后端报错）与返回形状不对都静默返回空 bundle。
    87	 */
    88	export async function loadExtensionBundle(
    89	  invokeFn: (cmd: string) => Promise<unknown>,
    90	): Promise<ExtensionBundle> {
    91	  try {
    92	    const result = await invokeFn("list_extensions");
    93	    return toBundle(result);
    94	  } catch {
    95	    return { templates: [], themeTokens: {}, warnings: [] };
    96	  }
    97	}
    98	
    99	/**
   100	 * 调一次 `list_extensions`，解析 snippets / templates / theme tokens 三类。
   101	 * 异常与形状不对都静默返回全空快照。
   102	 */
   103	export async function loadExtensionSnapshot(
   104	  invokeFn: (cmd: string) => Promise<unknown>,
   105	): Promise<ExtensionSnapshot> {
   106	  try {
   107	    const result = await invokeFn("list_extensions");
   108	    const bundle = toBundle(result);
   109	    return {
   110	      snippets: extractSnippets(result),
   111	      templates: bundle.templates,
   112	      themeTokens: bundle.themeTokens,
   113	    };
   114	  } catch {
   115	    return { snippets: [], templates: [], themeTokens: {} };
   116	  }
   117	}

exec
/bin/zsh -c "rg -n 'THEME_EXTRA|themeProvider|theme.*provider|decoration.*theme|decorative|theme.*toggle' src src-tauri docs/design/system docs/research/technical/data-fileization-omarchy-inventory.md 2>/dev/null | sed -n '1,260p'
rg -n -- '--app-(accent|bg|surface|sunken|text|border|radius|shadow)' src/styles/tokens.css | sed -n '1,200p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src-tauri/gen/schemas/desktop-schema.json:1254:          "description": "Default permissions for the plugin.\n#### This default permission set includes:\n\n- `allow-get-all-windows`\n- `allow-scale-factor`\n- `allow-inner-position`\n- `allow-outer-position`\n- `allow-inner-size`\n- `allow-outer-size`\n- `allow-is-fullscreen`\n- `allow-is-minimized`\n- `allow-is-maximized`\n- `allow-is-focused`\n- `allow-is-decorated`\n- `allow-is-resizable`\n- `allow-is-maximizable`\n- `allow-is-minimizable`\n- `allow-is-closable`\n- `allow-is-visible`\n- `allow-is-enabled`\n- `allow-title`\n- `allow-current-monitor`\n- `allow-primary-monitor`\n- `allow-monitor-from-point`\n- `allow-available-monitors`\n- `allow-cursor-position`\n- `allow-theme`\n- `allow-is-always-on-top`\n- `allow-activity-name`\n- `allow-scene-identifier`\n- `allow-internal-toggle-maximize`",
src-tauri/gen/schemas/desktop-schema.json:1257:          "markdownDescription": "Default permissions for the plugin.\n#### This default permission set includes:\n\n- `allow-get-all-windows`\n- `allow-scale-factor`\n- `allow-inner-position`\n- `allow-outer-position`\n- `allow-inner-size`\n- `allow-outer-size`\n- `allow-is-fullscreen`\n- `allow-is-minimized`\n- `allow-is-maximized`\n- `allow-is-focused`\n- `allow-is-decorated`\n- `allow-is-resizable`\n- `allow-is-maximizable`\n- `allow-is-minimizable`\n- `allow-is-closable`\n- `allow-is-visible`\n- `allow-is-enabled`\n- `allow-title`\n- `allow-current-monitor`\n- `allow-primary-monitor`\n- `allow-monitor-from-point`\n- `allow-available-monitors`\n- `allow-cursor-position`\n- `allow-theme`\n- `allow-is-always-on-top`\n- `allow-activity-name`\n- `allow-scene-identifier`\n- `allow-internal-toggle-maximize`"
src-tauri/gen/schemas/macOS-schema.json:1254:          "description": "Default permissions for the plugin.\n#### This default permission set includes:\n\n- `allow-get-all-windows`\n- `allow-scale-factor`\n- `allow-inner-position`\n- `allow-outer-position`\n- `allow-inner-size`\n- `allow-outer-size`\n- `allow-is-fullscreen`\n- `allow-is-minimized`\n- `allow-is-maximized`\n- `allow-is-focused`\n- `allow-is-decorated`\n- `allow-is-resizable`\n- `allow-is-maximizable`\n- `allow-is-minimizable`\n- `allow-is-closable`\n- `allow-is-visible`\n- `allow-is-enabled`\n- `allow-title`\n- `allow-current-monitor`\n- `allow-primary-monitor`\n- `allow-monitor-from-point`\n- `allow-available-monitors`\n- `allow-cursor-position`\n- `allow-theme`\n- `allow-is-always-on-top`\n- `allow-activity-name`\n- `allow-scene-identifier`\n- `allow-internal-toggle-maximize`",
src-tauri/gen/schemas/macOS-schema.json:1257:          "markdownDescription": "Default permissions for the plugin.\n#### This default permission set includes:\n\n- `allow-get-all-windows`\n- `allow-scale-factor`\n- `allow-inner-position`\n- `allow-outer-position`\n- `allow-inner-size`\n- `allow-outer-size`\n- `allow-is-fullscreen`\n- `allow-is-minimized`\n- `allow-is-maximized`\n- `allow-is-focused`\n- `allow-is-decorated`\n- `allow-is-resizable`\n- `allow-is-maximizable`\n- `allow-is-minimizable`\n- `allow-is-closable`\n- `allow-is-visible`\n- `allow-is-enabled`\n- `allow-title`\n- `allow-current-monitor`\n- `allow-primary-monitor`\n- `allow-monitor-from-point`\n- `allow-available-monitors`\n- `allow-cursor-position`\n- `allow-theme`\n- `allow-is-always-on-top`\n- `allow-activity-name`\n- `allow-scene-identifier`\n- `allow-internal-toggle-maximize`"
src-tauri/gen/schemas/acl-manifests.json:1:{"core":{"default_permission":{"identifier":"default","description":"Default core plugins set.","permissions":["core:path:default","core:event:default","core:window:default","core:webview:default","core:app:default","core:image:default","core:resources:default","core:menu:default","core:tray:default"]},"permissions":{},"permission_sets":{},"global_scope_schema":null},"core:app":{"default_permission":{"identifier":"default","description":"Default permissions for the plugin.","permissions":["allow-version","allow-name","allow-tauri-version","allow-identifier","allow-bundle-type","allow-register-listener","allow-remove-listener","allow-supports-multiple-windows"]},"permissions":{"allow-app-hide":{"identifier":"allow-app-hide","description":"Enables the app_hide command without any pre-configured scope.","commands":{"allow":["app_hide"],"deny":[]}},"allow-app-show":{"identifier":"allow-app-show","description":"Enables the app_show command without any pre-configured scope.","commands":{"allow":["app_show"],"deny":[]}},"allow-bundle-type":{"identifier":"allow-bundle-type","description":"Enables the bundle_type command without any pre-configured scope.","commands":{"allow":["bundle_type"],"deny":[]}},"allow-default-window-icon":{"identifier":"allow-default-window-icon","description":"Enables the default_window_icon command without any pre-configured scope.","commands":{"allow":["default_window_icon"],"deny":[]}},"allow-fetch-data-store-identifiers":{"identifier":"allow-fetch-data-store-identifiers","description":"Enables the fetch_data_store_identifiers command without any pre-configured scope.","commands":{"allow":["fetch_data_store_identifiers"],"deny":[]}},"allow-identifier":{"identifier":"allow-identifier","description":"Enables the identifier command without any pre-configured scope.","commands":{"allow":["identifier"],"deny":[]}},"allow-name":{"identifier":"allow-name","description":"Enables the name command without any pre-configured scope.","commands":{"allow":["name"],"deny":[]}},"allow-register-listener":{"identifier":"allow-register-listener","description":"Enables the register_listener command without any pre-configured scope.","commands":{"allow":["register_listener"],"deny":[]}},"allow-remove-data-store":{"identifier":"allow-remove-data-store","description":"Enables the remove_data_store command without any pre-configured scope.","commands":{"allow":["remove_data_store"],"deny":[]}},"allow-remove-listener":{"identifier":"allow-remove-listener","description":"Enables the remove_listener command without any pre-configured scope.","commands":{"allow":["remove_listener"],"deny":[]}},"allow-set-app-theme":{"identifier":"allow-set-app-theme","description":"Enables the set_app_theme command without any pre-configured scope.","commands":{"allow":["set_app_theme"],"deny":[]}},"allow-set-dock-visibility":{"identifier":"allow-set-dock-visibility","description":"Enables the set_dock_visibility command without any pre-configured scope.","commands":{"allow":["set_dock_visibility"],"deny":[]}},"allow-supports-multiple-windows":{"identifier":"allow-supports-multiple-windows","description":"Enables the supports_multiple_windows command without any pre-configured scope.","commands":{"allow":["supports_multiple_windows"],"deny":[]}},"allow-tauri-version":{"identifier":"allow-tauri-version","description":"Enables the tauri_version command without any pre-configured scope.","commands":{"allow":["tauri_version"],"deny":[]}},"allow-version":{"identifier":"allow-version","description":"Enables the version command without any pre-configured scope.","commands":{"allow":["version"],"deny":[]}},"deny-app-hide":{"identifier":"deny-app-hide","description":"Denies the app_hide command without any pre-configured scope.","commands":{"allow":[],"deny":["app_hide"]}},"deny-app-show":{"identifier":"deny-app-show","description":"Denies the app_show command without any pre-configured scope.","commands":{"allow":[],"deny":["app_show"]}},"deny-bundle-type":{"identifier":"deny-bundle-type","description":"Denies the bundle_type command without any pre-configured scope.","commands":{"allow":[],"deny":["bundle_type"]}},"deny-default-window-icon":{"identifier":"deny-default-window-icon","description":"Denies the default_window_icon command without any pre-configured scope.","commands":{"allow":[],"deny":["default_window_icon"]}},"deny-fetch-data-store-identifiers":{"identifier":"deny-fetch-data-store-identifiers","description":"Denies the fetch_data_store_identifiers command without any pre-configured scope.","commands":{"allow":[],"deny":["fetch_data_store_identifiers"]}},"deny-identifier":{"identifier":"deny-identifier","description":"Denies the identifier command without any pre-configured scope.","commands":{"allow":[],"deny":["identifier"]}},"deny-name":{"identifier":"deny-name","description":"Denies the name command without any pre-configured scope.","commands":{"allow":[],"deny":["name"]}},"deny-register-listener":{"identifier":"deny-register-listener","description":"Denies the register_listener command without any pre-configured scope.","commands":{"allow":[],"deny":["register_listener"]}},"deny-remove-data-store":{"identifier":"deny-remove-data-store","description":"Denies the remove_data_store command without any pre-configured scope.","commands":{"allow":[],"deny":["remove_data_store"]}},"deny-remove-listener":{"identifier":"deny-remove-listener","description":"Denies the remove_listener command without any pre-configured scope.","commands":{"allow":[],"deny":["remove_listener"]}},"deny-set-app-theme":{"identifier":"deny-set-app-theme","description":"Denies the set_app_theme command without any pre-configured scope.","commands":{"allow":[],"deny":["set_app_theme"]}},"deny-set-dock-visibility":{"identifier":"deny-set-dock-visibility","description":"Denies the set_dock_visibility command without any pre-configured scope.","commands":{"allow":[],"deny":["set_dock_visibility"]}},"deny-supports-multiple-windows":{"identifier":"deny-supports-multiple-windows","description":"Denies the supports_multiple_windows command without any pre-configured scope.","commands":{"allow":[],"deny":["supports_multiple_windows"]}},"deny-tauri-version":{"identifier":"deny-tauri-version","description":"Denies the tauri_version command without any pre-configured scope.","commands":{"allow":[],"deny":["tauri_version"]}},"deny-version":{"identifier":"deny-version","description":"Denies the version command without any pre-configured scope.","commands":{"allow":[],"deny":["version"]}}},"permission_sets":{},"global_scope_schema":null},"core:event":{"default_permission":{"identifier":"default","description":"Default permissions for the plugin, which enables all commands.","permissions":["allow-listen","allow-unlisten","allow-emit","allow-emit-to"]},"permissions":{"allow-emit":{"identifier":"allow-emit","description":"Enables the emit command without any pre-configured scope.","commands":{"allow":["emit"],"deny":[]}},"allow-emit-to":{"identifier":"allow-emit-to","description":"Enables the emit_to command without any pre-configured scope.","commands":{"allow":["emit_to"],"deny":[]}},"allow-listen":{"identifier":"allow-listen","description":"Enables the listen command without any pre-configured scope.","commands":{"allow":["listen"],"deny":[]}},"allow-unlisten":{"identifier":"allow-unlisten","description":"Enables the unlisten command without any pre-configured scope.","commands":{"allow":["unlisten"],"deny":[]}},"deny-emit":{"identifier":"deny-emit","description":"Denies the emit command without any pre-configured scope.","commands":{"allow":[],"deny":["emit"]}},"deny-emit-to":{"identifier":"deny-emit-to","description":"Denies the emit_to command without any pre-configured scope.","commands":{"allow":[],"deny":["emit_to"]}},"deny-listen":{"identifier":"deny-listen","description":"Denies the listen command without any pre-configured scope.","commands":{"allow":[],"deny":["listen"]}},"deny-unlisten":{"identifier":"deny-unlisten","description":"Denies the unlisten command without any pre-configured scope.","commands":{"allow":[],"deny":["unlisten"]}}},"permission_sets":{},"global_scope_schema":null},"core:image":{"default_permission":{"identifier":"default","description":"Default permissions for the plugin, which enables all commands.","permissions":["allow-new","allow-from-bytes","allow-from-path","allow-rgba","allow-size"]},"permissions":{"allow-from-bytes":{"identifier":"allow-from-bytes","description":"Enables the from_bytes command without any pre-configured scope.","commands":{"allow":["from_bytes"],"deny":[]}},"allow-from-path":{"identifier":"allow-from-path","description":"Enables the from_path command without any pre-configured scope.","commands":{"allow":["from_path"],"deny":[]}},"allow-new":{"identifier":"allow-new","description":"Enables the new command without any pre-configured scope.","commands":{"allow":["new"],"deny":[]}},"allow-rgba":{"identifier":"allow-rgba","description":"Enables the rgba command without any pre-configured scope.","commands":{"allow":["rgba"],"deny":[]}},"allow-size":{"identifier":"allow-size","description":"Enables the size command without any pre-configured scope.","commands":{"allow":["size"],"deny":[]}},"deny-from-bytes":{"identifier":"deny-from-bytes","description":"Denies the from_bytes command without any pre-configured scope.","commands":{"allow":[],"deny":["from_bytes"]}},"deny-from-path":{"identifier":"deny-from-path","description":"Denies the from_path command without any pre-configured scope.","commands":{"allow":[],"deny":["from_path"]}},"deny-new":{"identifier":"deny-new","description":"Denies the new command without any pre-configured scope.","commands":{"allow":[],"deny":["new"]}},"deny-rgba":{"identifier":"deny-rgba","description":"Denies the rgba command without any pre-configured scope.","commands":{"allow":[],"deny":["rgba"]}},"deny-size":{"identifier":"deny-size","description":"Denies the size command without any pre-configured scope.","commands":{"allow":[],"deny":["size"]}}},"permission_sets":{},"global_scope_schema":null},"core:menu":{"default_permission":{"identifier":"default","description":"Default permissions for the plugin, which enables all commands.","permissions":["allow-new","allow-append","allow-prepend","allow-insert","allow-remove","allow-remove-at","allow-items","allow-get","allow-popup","allow-create-default","allow-set-as-app-menu","allow-set-as-window-menu","allow-text","allow-set-text","allow-is-enabled","allow-set-enabled","allow-set-accelerator","allow-set-as-windows-menu-for-nsapp","allow-set-as-help-menu-for-nsapp","allow-is-checked","allow-set-checked","allow-set-icon"]},"permissions":{"allow-append":{"identifier":"allow-append","description":"Enables the append command without any pre-configured scope.","commands":{"allow":["append"],"deny":[]}},"allow-create-default":{"identifier":"allow-create-default","description":"Enables the create_default command without any pre-configured scope.","commands":{"allow":["create_default"],"deny":[]}},"allow-get":{"identifier":"allow-get","description":"Enables the get command without any pre-configured scope.","commands":{"allow":["get"],"deny":[]}},"allow-insert":{"identifier":"allow-insert","description":"Enables the insert command without any pre-configured scope.","commands":{"allow":["insert"],"deny":[]}},"allow-is-checked":{"identifier":"allow-is-checked","description":"Enables the is_checked command without any pre-configured scope.","commands":{"allow":["is_checked"],"deny":[]}},"allow-is-enabled":{"identifier":"allow-is-enabled","description":"Enables the is_enabled command without any pre-configured scope.","commands":{"allow":["is_enabled"],"deny":[]}},"allow-items":{"identifier":"allow-items","description":"Enables the items command without any pre-configured scope.","commands":{"allow":["items"],"deny":[]}},"allow-new":{"identifier":"allow-new","description":"Enables the new command without any pre-configured scope.","commands":{"allow":["new"],"deny":[]}},"allow-popup":{"identifier":"allow-popup","description":"Enables the popup command without any pre-configured scope.","commands":{"allow":["popup"],"deny":[]}},"allow-prepend":{"identifier":"allow-prepend","description":"Enables the prepend command without any pre-configured scope.","commands":{"allow":["prepend"],"deny":[]}},"allow-remove":{"identifier":"allow-remove","description":"Enables the remove command without any pre-configured scope.","commands":{"allow":["remove"],"deny":[]}},"allow-remove-at":{"identifier":"allow-remove-at","description":"Enables the remove_at command without any pre-configured scope.","commands":{"allow":["remove_at"],"deny":[]}},"allow-set-accelerator":{"identifier":"allow-set-accelerator","description":"Enables the set_accelerator command without any pre-configured scope.","commands":{"allow":["set_accelerator"],"deny":[]}},"allow-set-as-app-menu":{"identifier":"allow-set-as-app-menu","description":"Enables the set_as_app_menu command without any pre-configured scope.","commands":{"allow":["set_as_app_menu"],"deny":[]}},"allow-set-as-help-menu-for-nsapp":{"identifier":"allow-set-as-help-menu-for-nsapp","description":"Enables the set_as_help_menu_for_nsapp command without any pre-configured scope.","commands":{"allow":["set_as_help_menu_for_nsapp"],"deny":[]}},"allow-set-as-window-menu":{"identifier":"allow-set-as-window-menu","description":"Enables the set_as_window_menu command without any pre-configured scope.","commands":{"allow":["set_as_window_menu"],"deny":[]}},"allow-set-as-windows-menu-for-nsapp":{"identifier":"allow-set-as-windows-menu-for-nsapp","description":"Enables the set_as_windows_menu_for_nsapp command without any pre-configured scope.","commands":{"allow":["set_as_windows_menu_for_nsapp"],"deny":[]}},"allow-set-checked":{"identifier":"allow-set-checked","description":"Enables the set_checked command without any pre-configured scope.","commands":{"allow":["set_checked"],"deny":[]}},"allow-set-enabled":{"identifier":"allow-set-enabled","description":"Enables the set_enabled command without any pre-configured scope.","commands":{"allow":["set_enabled"],"deny":[]}},"allow-set-icon":{"identifier":"allow-set-icon","description":"Enables the set_icon command without any pre-configured scope.","commands":{"allow":["set_icon"],"deny":[]}},"allow-set-text":{"identifier":"allow-set-text","description":"Enables the set_text command without any pre-configured scope.","commands":{"allow":["set_text"],"deny":[]}},"allow-text":{"identifier":"allow-text","description":"Enables the text command without any pre-configured scope.","commands":{"allow":["text"],"deny":[]}},"deny-append":{"identifier":"deny-append","description":"Denies the append command without any pre-configured scope.","commands":{"allow":[],"deny":["append"]}},"deny-create-default":{"identifier":"deny-create-default","description":"Denies the create_default command without any pre-configured scope.","commands":{"allow":[],"deny":["create_default"]}},"deny-get":{"identifier":"deny-get","description":"Denies the get command without any pre-configured scope.","commands":{"allow":[],"deny":["get"]}},"deny-insert":{"identifier":"deny-insert","description":"Denies the insert command without any pre-configured scope.","commands":{"allow":[],"deny":["insert"]}},"deny-is-checked":{"identifier":"deny-is-checked","description":"Denies the is_checked command without any pre-configured scope.","commands":{"allow":[],"deny":["is_checked"]}},"deny-is-enabled":{"identifier":"deny-is-enabled","description":"Denies the is_enabled command without any pre-configured scope.","commands":{"allow":[],"deny":["is_enabled"]}},"deny-items":{"identifier":"deny-items","description":"Denies the items command without any pre-configured scope.","commands":{"allow":[],"deny":["items"]}},"deny-new":{"identifier":"deny-new","description":"Denies the new command without any pre-configured scope.","commands":{"allow":[],"deny":["new"]}},"deny-popup":{"identifier":"deny-popup","description":"Denies the popup command without any pre-configured scope.","commands":{"allow":[],"deny":["popup"]}},"deny-prepend":{"identifier":"deny-prepend","description":"Denies the prepend command without any pre-configured scope.","commands":{"allow":[],"deny":["prepend"]}},"deny-remove":{"identifier":"deny-remove","description":"Denies the remove command without any pre-configured scope.","commands":{"allow":[],"deny":["remove"]}},"deny-remove-at":{"identifier":"deny-remove-at","description":"Denies the remove_at command without any pre-configured scope.","commands":{"allow":[],"deny":["remove_at"]}},"deny-set-accelerator":{"identifier":"deny-set-accelerator","description":"Denies the set_accelerator command without any pre-configured scope.","commands":{"allow":[],"deny":["set_accelerator"]}},"deny-set-as-app-menu":{"identifier":"deny-set-as-app-menu","description":"Denies the set_as_app_menu command without any pre-configured scope.","commands":{"allow":[],"deny":["set_as_app_menu"]}},"deny-set-as-help-menu-for-nsapp":{"identifier":"deny-set-as-help-menu-for-nsapp","description":"Denies the set_as_help_menu_for_nsapp command without any pre-configured scope.","commands":{"allow":[],"deny":["set_as_help_menu_for_nsapp"]}},"deny-set-as-window-menu":{"identifier":"deny-set-as-window-menu","description":"Denies the set_as_window_menu command without any pre-configured scope.","commands":{"allow":[],"deny":["set_as_window_menu"]}},"deny-set-as-windows-menu-for-nsapp":{"identifier":"deny-set-as-windows-menu-for-nsapp","description":"Denies the set_as_windows_menu_for_nsapp command without any pre-configured scope.","commands":{"allow":[],"deny":["set_as_windows_menu_for_nsapp"]}},"deny-set-checked":{"identifier":"deny-set-checked","description":"Denies the set_checked command without any pre-configured scope.","commands":{"allow":[],"deny":["set_checked"]}},"deny-set-enabled":{"identifier":"deny-set-enabled","description":"Denies the set_enabled command without any pre-configured scope.","commands":{"allow":[],"deny":["set_enabled"]}},"deny-set-icon":{"identifier":"deny-set-icon","description":"Denies the set_icon command without any pre-configured scope.","commands":{"allow":[],"deny":["set_icon"]}},"deny-set-text":{"identifier":"deny-set-text","description":"Denies the set_text command without any pre-configured scope.","commands":{"allow":[],"deny":["set_text"]}},"deny-text":{"identifier":"deny-text","description":"Denies the text command without any pre-configured scope.","commands":{"allow":[],"deny":["text"]}}},"permission_sets":{},"global_scope_schema":null},"core:path":{"default_permission":{"identifier":"default","description":"Default permissions for the plugin, which enables all commands.","permissions":["allow-resolve-directory","allow-resolve","allow-normalize","allow-join","allow-dirname","allow-extname","allow-basename","allow-is-absolute"]},"permissions":{"allow-basename":{"identifier":"allow-basename","description":"Enables the basename command without any pre-configured scope.","commands":{"allow":["basename"],"deny":[]}},"allow-dirname":{"identifier":"allow-dirname","description":"Enables the dirname command without any pre-configured scope.","commands":{"allow":["dirname"],"deny":[]}},"allow-extname":{"identifier":"allow-extname","description":"Enables the extname command without any pre-configured scope.","commands":{"allow":["extname"],"deny":[]}},"allow-is-absolute":{"identifier":"allow-is-absolute","description":"Enables the is_absolute command without any pre-configured scope.","commands":{"allow":["is_absolute"],"deny":[]}},"allow-join":{"identifier":"allow-join","description":"Enables the join command without any pre-configured scope.","commands":{"allow":["join"],"deny":[]}},"allow-normalize":{"identifier":"allow-normalize","description":"Enables the normalize command without any pre-configured scope.","commands":{"allow":["normalize"],"deny":[]}},"allow-resolve":{"identifier":"allow-resolve","description":"Enables the resolve command without any pre-configured scope.","commands":{"allow":["resolve"],"deny":[]}},"allow-resolve-directory":{"identifier":"allow-resolve-directory","description":"Enables the resolve_directory command without any pre-configured scope.","commands":{"allow":["resolve_directory"],"deny":[]}},"deny-basename":{"identifier":"deny-basename","description":"Denies the basename command without any pre-configured scope.","commands":{"allow":[],"deny":["basename"]}},"deny-dirname":{"identifier":"deny-dirname","description":"Denies the dirname command without any pre-configured scope.","commands":{"allow":[],"deny":["dirname"]}},"deny-extname":{"identifier":"deny-extname","description":"Denies the extname command without any pre-configured scope.","commands":{"allow":[],"deny":["extname"]}},"deny-is-absolute":{"identifier":"deny-is-absolute","description":"Denies the is_absolute command without any pre-configured scope.","commands":{"allow":[],"deny":["is_absolute"]}},"deny-join":{"identifier":"deny-join","description":"Denies the join command without any pre-configured scope.","commands":{"allow":[],"deny":["join"]}},"deny-normalize":{"identifier":"deny-normalize","description":"Denies the normalize command without any pre-configured scope.","commands":{"allow":[],"deny":["normalize"]}},"deny-resolve":{"identifier":"deny-resolve","description":"Denies the resolve command without any pre-configured scope.","commands":{"allow":[],"deny":["resolve"]}},"deny-resolve-directory":{"identifier":"deny-resolve-directory","description":"Denies the resolve_directory command without any pre-configured scope.","commands":{"allow":[],"deny":["resolve_directory"]}}},"permission_sets":{},"global_scope_schema":null},"core:resources":{"default_permission":{"identifier":"default","description":"Default permissions for the plugin, which enables all commands.","permissions":["allow-close"]},"permissions":{"allow-close":{"identifier":"allow-close","description":"Enables the close command without any pre-configured scope.","commands":{"allow":["close"],"deny":[]}},"deny-close":{"identifier":"deny-close","description":"Denies the close command without any pre-configured scope.","commands":{"allow":[],"deny":["close"]}}},"permission_sets":{},"global_scope_schema":null},"core:tray":{"default_permission":{"identifier":"default","description":"Default permissions for the plugin, which enables all commands.","permissions":["allow-new","allow-get-by-id","allow-remove-by-id","allow-set-icon","allow-set-menu","allow-set-tooltip","allow-set-title","allow-set-visible","allow-set-temp-dir-path","allow-set-icon-as-template","allow-set-icon-with-as-template","allow-set-show-menu-on-left-click"]},"permissions":{"allow-get-by-id":{"identifier":"allow-get-by-id","description":"Enables the get_by_id command without any pre-configured scope.","commands":{"allow":["get_by_id"],"deny":[]}},"allow-new":{"identifier":"allow-new","description":"Enables the new command without any pre-configured scope.","commands":{"allow":["new"],"deny":[]}},"allow-remove-by-id":{"identifier":"allow-remove-by-id","description":"Enables the remove_by_id command without any pre-configured scope.","commands":{"allow":["remove_by_id"],"deny":[]}},"allow-set-icon":{"identifier":"allow-set-icon","description":"Enables the set_icon command without any pre-configured scope.","commands":{"allow":["set_icon"],"deny":[]}},"allow-set-icon-as-template":{"identifier":"allow-set-icon-as-template","description":"Enables the set_icon_as_template command without any pre-configured scope.","commands":{"allow":["set_icon_as_template"],"deny":[]}},"allow-set-icon-with-as-template":{"identifier":"allow-set-icon-with-as-template","description":"Enables the set_icon_with_as_template command without any pre-configured scope.","commands":{"allow":["set_icon_with_as_template"],"deny":[]}},"allow-set-menu":{"identifier":"allow-set-menu","description":"Enables the set_menu command without any pre-configured scope.","commands":{"allow":["set_menu"],"deny":[]}},"allow-set-show-menu-on-left-click":{"identifier":"allow-set-show-menu-on-left-click","description":"Enables the set_show_menu_on_left_click command without any pre-configured scope.","commands":{"allow":["set_show_menu_on_left_click"],"deny":[]}},"allow-set-temp-dir-path":{"identifier":"allow-set-temp-dir-path","description":"Enables the set_temp_dir_path command without any pre-configured scope.","commands":{"allow":["set_temp_dir_path"],"deny":[]}},"allow-set-title":{"identifier":"allow-set-title","description":"Enables the set_title command without any pre-configured scope.","commands":{"allow":["set_title"],"deny":[]}},"allow-set-tooltip":{"identifier":"allow-set-tooltip","description":"Enables the set_tooltip command without any pre-configured scope.","commands":{"allow":["set_tooltip"],"deny":[]}},"allow-set-visible":{"identifier":"allow-set-visible","description":"Enables the set_visible command without any pre-configured scope.","commands":{"allow":["set_visible"],"deny":[]}},"deny-get-by-id":{"identifier":"deny-get-by-id","description":"Denies the get_by_id command without any pre-configured scope.","commands":{"allow":[],"deny":["get_by_id"]}},"deny-new":{"identifier":"deny-new","description":"Denies the new command without any pre-configured scope.","commands":{"allow":[],"deny":["new"]}},"deny-remove-by-id":{"identifier":"deny-remove-by-id","description":"Denies the remove_by_id command without any pre-configured scope.","commands":{"allow":[],"deny":["remove_by_id"]}},"deny-set-icon":{"identifier":"deny-set-icon","description":"Denies the set_icon command without any pre-configured scope.","commands":{"allow":[],"deny":["set_icon"]}},"deny-set-icon-as-template":{"identifier":"deny-set-icon-as-template","description":"Denies the set_icon_as_template command without any pre-configured scope.","commands":{"allow":[],"deny":["set_icon_as_template"]}},"deny-set-icon-with-as-template":{"identifier":"deny-set-icon-with-as-template","description":"Denies the set_icon_with_as_template command without any pre-configured scope.","commands":{"allow":[],"deny":["set_icon_with_as_template"]}},"deny-set-menu":{"identifier":"deny-set-menu","description":"Denies the set_menu command without any pre-configured scope.","commands":{"allow":[],"deny":["set_menu"]}},"deny-set-show-menu-on-left-click":{"identifier":"deny-set-show-menu-on-left-click","description":"Denies the set_show_menu_on_left_click command without any pre-configured scope.","commands":{"allow":[],"deny":["set_show_menu_on_left_click"]}},"deny-set-temp-dir-path":{"identifier":"deny-set-temp-dir-path","description":"Denies the set_temp_dir_path command without any pre-configured scope.","commands":{"allow":[],"deny":["set_temp_dir_path"]}},"deny-set-title":{"identifier":"deny-set-title","description":"Denies the set_title command without any pre-configured scope.","commands":{"allow":[],"deny":["set_title"]}},"deny-set-tooltip":{"identifier":"deny-set-tooltip","description":"Denies the set_tooltip command without any pre-configured scope.","commands":{"allow":[],"deny":["set_tooltip"]}},"deny-set-visible":{"identifier":"deny-set-visible","description":"Denies the set_visible command without any pre-configured scope.","commands":{"allow":[],"deny":["set_visible"]}}},"permission_sets":{},"global_scope_schema":null},"core:webview":{"default_permission":{"identifier":"default","description":"Default permissions for the plugin.","permissions":["allow-get-all-webviews","allow-webview-position","allow-webview-size","allow-internal-toggle-devtools"]},"permissions":{"allow-clear-all-browsing-data":{"identifier":"allow-clear-all-browsing-data","description":"Enables the clear_all_browsing_data command without any pre-configured scope.","commands":{"allow":["clear_all_browsing_data"],"deny":[]}},"allow-create-webview":{"identifier":"allow-create-webview","description":"Enables the create_webview command without any pre-configured scope.","commands":{"allow":["create_webview"],"deny":[]}},"allow-create-webview-window":{"identifier":"allow-create-webview-window","description":"Enables the create_webview_window command without any pre-configured scope.","commands":{"allow":["create_webview_window"],"deny":[]}},"allow-get-all-webviews":{"identifier":"allow-get-all-webviews","description":"Enables the get_all_webviews command without any pre-configured scope.","commands":{"allow":["get_all_webviews"],"deny":[]}},"allow-internal-toggle-devtools":{"identifier":"allow-internal-toggle-devtools","description":"Enables the internal_toggle_devtools command without any pre-configured scope.","commands":{"allow":["internal_toggle_devtools"],"deny":[]}},"allow-print":{"identifier":"allow-print","description":"Enables the print command without any pre-configured scope.","commands":{"allow":["print"],"deny":[]}},"allow-reparent":{"identifier":"allow-reparent","description":"Enables the reparent command without any pre-configured scope.","commands":{"allow":["reparent"],"deny":[]}},"allow-set-webview-auto-resize":{"identifier":"allow-set-webview-auto-resize","description":"Enables the set_webview_auto_resize command without any pre-configured scope.","commands":{"allow":["set_webview_auto_resize"],"deny":[]}},"allow-set-webview-background-color":{"identifier":"allow-set-webview-background-color","description":"Enables the set_webview_background_color command without any pre-configured scope.","commands":{"allow":["set_webview_background_color"],"deny":[]}},"allow-set-webview-focus":{"identifier":"allow-set-webview-focus","description":"Enables the set_webview_focus command without any pre-configured scope.","commands":{"allow":["set_webview_focus"],"deny":[]}},"allow-set-webview-position":{"identifier":"allow-set-webview-position","description":"Enables the set_webview_position command without any pre-configured scope.","commands":{"allow":["set_webview_position"],"deny":[]}},"allow-set-webview-size":{"identifier":"allow-set-webview-size","description":"Enables the set_webview_size command without any pre-configured scope.","commands":{"allow":["set_webview_size"],"deny":[]}},"allow-set-webview-zoom":{"identifier":"allow-set-webview-zoom","description":"Enables the set_webview_zoom command without any pre-configured scope.","commands":{"allow":["set_webview_zoom"],"deny":[]}},"allow-webview-close":{"identifier":"allow-webview-close","description":"Enables the webview_close command without any pre-configured scope.","commands":{"allow":["webview_close"],"deny":[]}},"allow-webview-hide":{"identifier":"allow-webview-hide","description":"Enables the webview_hide command without any pre-configured scope.","commands":{"allow":["webview_hide"],"deny":[]}},"allow-webview-position":{"identifier":"allow-webview-position","description":"Enables the webview_position command without any pre-configured scope.","commands":{"allow":["webview_position"],"deny":[]}},"allow-webview-show":{"identifier":"allow-webview-show","description":"Enables the webview_show command without any pre-configured scope.","commands":{"allow":["webview_show"],"deny":[]}},"allow-webview-size":{"identifier":"allow-webview-size","description":"Enables the webview_size command without any pre-configured scope.","commands":{"allow":["webview_size"],"deny":[]}},"deny-clear-all-browsing-data":{"identifier":"deny-clear-all-browsing-data","description":"Denies the clear_all_browsing_data command without any pre-configured scope.","commands":{"allow":[],"deny":["clear_all_browsing_data"]}},"deny-create-webview":{"identifier":"deny-create-webview","description":"Denies the create_webview command without any pre-configured scope.","commands":{"allow":[],"deny":["create_webview"]}},"deny-create-webview-window":{"identifier":"deny-create-webview-window","description":"Denies the create_webview_window command without any pre-configured scope.","commands":{"allow":[],"deny":["create_webview_window"]}},"deny-get-all-webviews":{"identifier":"deny-get-all-webviews","description":"Denies the get_all_webviews command without any pre-configured scope.","commands":{"allow":[],"deny":["get_all_webviews"]}},"deny-internal-toggle-devtools":{"identifier":"deny-internal-toggle-devtools","description":"Denies the internal_toggle_devtools command without any pre-configured scope.","commands":{"allow":[],"deny":["internal_toggle_devtools"]}},"deny-print":{"identifier":"deny-print","description":"Denies the print command without any pre-configured scope.","commands":{"allow":[],"deny":["print"]}},"deny-reparent":{"identifier":"deny-reparent","description":"Denies the reparent command without any pre-configured scope.","commands":{"allow":[],"deny":["reparent"]}},"deny-set-webview-auto-resize":{"identifier":"deny-set-webview-auto-resize","description":"Denies the set_webview_auto_resize command without any pre-configured scope.","commands":{"allow":[],"deny":["set_webview_auto_resize"]}},"deny-set-webview-background-color":{"identifier":"deny-set-webview-background-color","description":"Denies the set_webview_background_color command without any pre-configured scope.","commands":{"allow":[],"deny":["set_webview_background_color"]}},"deny-set-webview-focus":{"identifier":"deny-set-webview-focus","description":"Denies the set_webview_focus command without any pre-configured scope.","commands":{"allow":[],"deny":["set_webview_focus"]}},"deny-set-webview-position":{"identifier":"deny-set-webview-position","description":"Denies the set_webview_position command without any pre-configured scope.","commands":{"allow":[],"deny":["set_webview_position"]}},"deny-set-webview-size":{"identifier":"deny-set-webview-size","description":"Denies the set_webview_size command without any pre-configured scope.","commands":{"allow":[],"deny":["set_webview_size"]}},"deny-set-webview-zoom":{"identifier":"deny-set-webview-zoom","description":"Denies the set_webview_zoom command without any pre-configured scope.","commands":{"allow":[],"deny":["set_webview_zoom"]}},"deny-webview-close":{"identifier":"deny-webview-close","description":"Denies the webview_close command without any pre-configured scope.","commands":{"allow":[],"deny":["webview_close"]}},"deny-webview-hide":{"identifier":"deny-webview-hide","description":"Denies the webview_hide command without any pre-configured scope.","commands":{"allow":[],"deny":["webview_hide"]}},"deny-webview-position":{"identifier":"deny-webview-position","description":"Denies the webview_position command without any pre-configured scope.","commands":{"allow":[],"deny":["webview_position"]}},"deny-webview-show":{"identifier":"deny-webview-show","description":"Denies the webview_show command without any pre-configured scope.","commands":{"allow":[],"deny":["webview_show"]}},"deny-webview-size":{"identifier":"deny-webview-size","description":"Denies the webview_size command without any pre-configured scope.","commands":{"allow":[],"deny":["webview_size"]}}},"permission_sets":{},"global_scope_schema":null},"core:window":{"default_permission":{"identifier":"default","description":"Default permissions for the plugin.","permissions":["allow-get-all-windows","allow-scale-factor","allow-inner-position","allow-outer-position","allow-inner-size","allow-outer-size","allow-is-fullscreen","allow-is-minimized","allow-is-maximized","allow-is-focused","allow-is-decorated","allow-is-resizable","allow-is-maximizable","allow-is-minimizable","allow-is-closable","allow-is-visible","allow-is-enabled","allow-title","allow-current-monitor","allow-primary-monitor","allow-monitor-from-point","allow-available-monitors","allow-cursor-position","allow-theme","allow-is-always-on-top","allow-activity-name","allow-scene-identifier","allow-internal-toggle-maximize"]},"permissions":{"allow-activity-name":{"identifier":"allow-activity-name","description":"Enables the activity_name command without any pre-configured scope.","commands":{"allow":["activity_name"],"deny":[]}},"allow-available-monitors":{"identifier":"allow-available-monitors","description":"Enables the available_monitors command without any pre-configured scope.","commands":{"allow":["available_monitors"],"deny":[]}},"allow-center":{"identifier":"allow-center","description":"Enables the center command without any pre-configured scope.","commands":{"allow":["center"],"deny":[]}},"allow-close":{"identifier":"allow-close","description":"Enables the close command without any pre-configured scope.","commands":{"allow":["close"],"deny":[]}},"allow-create":{"identifier":"allow-create","description":"Enables the create command without any pre-configured scope.","commands":{"allow":["create"],"deny":[]}},"allow-current-monitor":{"identifier":"allow-current-monitor","description":"Enables the current_monitor command without any pre-configured scope.","commands":{"allow":["current_monitor"],"deny":[]}},"allow-cursor-position":{"identifier":"allow-cursor-position","description":"Enables the cursor_position command without any pre-configured scope.","commands":{"allow":["cursor_position"],"deny":[]}},"allow-destroy":{"identifier":"allow-destroy","description":"Enables the destroy command without any pre-configured scope.","commands":{"allow":["destroy"],"deny":[]}},"allow-get-all-windows":{"identifier":"allow-get-all-windows","description":"Enables the get_all_windows command without any pre-configured scope.","commands":{"allow":["get_all_windows"],"deny":[]}},"allow-hide":{"identifier":"allow-hide","description":"Enables the hide command without any pre-configured scope.","commands":{"allow":["hide"],"deny":[]}},"allow-inner-position":{"identifier":"allow-inner-position","description":"Enables the inner_position command without any pre-configured scope.","commands":{"allow":["inner_position"],"deny":[]}},"allow-inner-size":{"identifier":"allow-inner-size","description":"Enables the inner_size command without any pre-configured scope.","commands":{"allow":["inner_size"],"deny":[]}},"allow-internal-toggle-maximize":{"identifier":"allow-internal-toggle-maximize","description":"Enables the internal_toggle_maximize command without any pre-configured scope.","commands":{"allow":["internal_toggle_maximize"],"deny":[]}},"allow-is-always-on-top":{"identifier":"allow-is-always-on-top","description":"Enables the is_always_on_top command without any pre-configured scope.","commands":{"allow":["is_always_on_top"],"deny":[]}},"allow-is-closable":{"identifier":"allow-is-closable","description":"Enables the is_closable command without any pre-configured scope.","commands":{"allow":["is_closable"],"deny":[]}},"allow-is-decorated":{"identifier":"allow-is-decorated","description":"Enables the is_decorated command without any pre-configured scope.","commands":{"allow":["is_decorated"],"deny":[]}},"allow-is-enabled":{"identifier":"allow-is-enabled","description":"Enables the is_enabled command without any pre-configured scope.","commands":{"allow":["is_enabled"],"deny":[]}},"allow-is-focused":{"identifier":"allow-is-focused","description":"Enables the is_focused command without any pre-configured scope.","commands":{"allow":["is_focused"],"deny":[]}},"allow-is-fullscreen":{"identifier":"allow-is-fullscreen","description":"Enables the is_fullscreen command without any pre-configured scope.","commands":{"allow":["is_fullscreen"],"deny":[]}},"allow-is-maximizable":{"identifier":"allow-is-maximizable","description":"Enables the is_maximizable command without any pre-configured scope.","commands":{"allow":["is_maximizable"],"deny":[]}},"allow-is-maximized":{"identifier":"allow-is-maximized","description":"Enables the is_maximized command without any pre-configured scope.","commands":{"allow":["is_maximized"],"deny":[]}},"allow-is-minimizable":{"identifier":"allow-is-minimizable","description":"Enables the is_minimizable command without any pre-configured scope.","commands":{"allow":["is_minimizable"],"deny":[]}},"allow-is-minimized":{"identifier":"allow-is-minimized","description":"Enables the is_minimized command without any pre-configured scope.","commands":{"allow":["is_minimized"],"deny":[]}},"allow-is-resizable":{"identifier":"allow-is-resizable","description":"Enables the is_resizable command without any pre-configured scope.","commands":{"allow":["is_resizable"],"deny":[]}},"allow-is-visible":{"identifier":"allow-is-visible","description":"Enables the is_visible command without any pre-configured scope.","commands":{"allow":["is_visible"],"deny":[]}},"allow-maximize":{"identifier":"allow-maximize","description":"Enables the maximize command without any pre-configured scope.","commands":{"allow":["maximize"],"deny":[]}},"allow-minimize":{"identifier":"allow-minimize","description":"Enables the minimize command without any pre-configured scope.","commands":{"allow":["minimize"],"deny":[]}},"allow-monitor-from-point":{"identifier":"allow-monitor-from-point","description":"Enables the monitor_from_point command without any pre-configured scope.","commands":{"allow":["monitor_from_point"],"deny":[]}},"allow-outer-position":{"identifier":"allow-outer-position","description":"Enables the outer_position command without any pre-configured scope.","commands":{"allow":["outer_position"],"deny":[]}},"allow-outer-size":{"identifier":"allow-outer-size","description":"Enables the outer_size command without any pre-configured scope.","commands":{"allow":["outer_size"],"deny":[]}},"allow-primary-monitor":{"identifier":"allow-primary-monitor","description":"Enables the primary_monitor command without any pre-configured scope.","commands":{"allow":["primary_monitor"],"deny":[]}},"allow-request-user-attention":{"identifier":"allow-request-user-attention","description":"Enables the request_user_attention command without any pre-configured scope.","commands":{"allow":["request_user_attention"],"deny":[]}},"allow-scale-factor":{"identifier":"allow-scale-factor","description":"Enables the scale_factor command without any pre-configured scope.","commands":{"allow":["scale_factor"],"deny":[]}},"allow-scene-identifier":{"identifier":"allow-scene-identifier","description":"Enables the scene_identifier command without any pre-configured scope.","commands":{"allow":["scene_identifier"],"deny":[]}},"allow-set-always-on-bottom":{"identifier":"allow-set-always-on-bottom","description":"Enables the set_always_on_bottom command without any pre-configured scope.","commands":{"allow":["set_always_on_bottom"],"deny":[]}},"allow-set-always-on-top":{"identifier":"allow-set-always-on-top","description":"Enables the set_always_on_top command without any pre-configured scope.","commands":{"allow":["set_always_on_top"],"deny":[]}},"allow-set-background-color":{"identifier":"allow-set-background-color","description":"Enables the set_background_color command without any pre-configured scope.","commands":{"allow":["set_background_color"],"deny":[]}},"allow-set-badge-count":{"identifier":"allow-set-badge-count","description":"Enables the set_badge_count command without any pre-configured scope.","commands":{"allow":["set_badge_count"],"deny":[]}},"allow-set-badge-label":{"identifier":"allow-set-badge-label","description":"Enables the set_badge_label command without any pre-configured scope.","commands":{"allow":["set_badge_label"],"deny":[]}},"allow-set-closable":{"identifier":"allow-set-closable","description":"Enables the set_closable command without any pre-configured scope.","commands":{"allow":["set_closable"],"deny":[]}},"allow-set-content-protected":{"identifier":"allow-set-content-protected","description":"Enables the set_content_protected command without any pre-configured scope.","commands":{"allow":["set_content_protected"],"deny":[]}},"allow-set-cursor-grab":{"identifier":"allow-set-cursor-grab","description":"Enables the set_cursor_grab command without any pre-configured scope.","commands":{"allow":["set_cursor_grab"],"deny":[]}},"allow-set-cursor-icon":{"identifier":"allow-set-cursor-icon","description":"Enables the set_cursor_icon command without any pre-configured scope.","commands":{"allow":["set_cursor_icon"],"deny":[]}},"allow-set-cursor-position":{"identifier":"allow-set-cursor-position","description":"Enables the set_cursor_position command without any pre-configured scope.","commands":{"allow":["set_cursor_position"],"deny":[]}},"allow-set-cursor-visible":{"identifier":"allow-set-cursor-visible","description":"Enables the set_cursor_visible command without any pre-configured scope.","commands":{"allow":["set_cursor_visible"],"deny":[]}},"allow-set-decorations":{"identifier":"allow-set-decorations","description":"Enables the set_decorations command without any pre-configured scope.","commands":{"allow":["set_decorations"],"deny":[]}},"allow-set-effects":{"identifier":"allow-set-effects","description":"Enables the set_effects command without any pre-configured scope.","commands":{"allow":["set_effects"],"deny":[]}},"allow-set-enabled":{"identifier":"allow-set-enabled","description":"Enables the set_enabled command without any pre-configured scope.","commands":{"allow":["set_enabled"],"deny":[]}},"allow-set-focus":{"identifier":"allow-set-focus","description":"Enables the set_focus command without any pre-configured scope.","commands":{"allow":["set_focus"],"deny":[]}},"allow-set-focusable":{"identifier":"allow-set-focusable","description":"Enables the set_focusable command without any pre-configured scope.","commands":{"allow":["set_focusable"],"deny":[]}},"allow-set-fullscreen":{"identifier":"allow-set-fullscreen","description":"Enables the set_fullscreen command without any pre-configured scope.","commands":{"allow":["set_fullscreen"],"deny":[]}},"allow-set-icon":{"identifier":"allow-set-icon","description":"Enables the set_icon command without any pre-configured scope.","commands":{"allow":["set_icon"],"deny":[]}},"allow-set-ignore-cursor-events":{"identifier":"allow-set-ignore-cursor-events","description":"Enables the set_ignore_cursor_events command without any pre-configured scope.","commands":{"allow":["set_ignore_cursor_events"],"deny":[]}},"allow-set-max-size":{"identifier":"allow-set-max-size","description":"Enables the set_max_size command without any pre-configured scope.","commands":{"allow":["set_max_size"],"deny":[]}},"allow-set-maximizable":{"identifier":"allow-set-maximizable","description":"Enables the set_maximizable command without any pre-configured scope.","commands":{"allow":["set_maximizable"],"deny":[]}},"allow-set-min-size":{"identifier":"allow-set-min-size","description":"Enables the set_min_size command without any pre-configured scope.","commands":{"allow":["set_min_size"],"deny":[]}},"allow-set-minimizable":{"identifier":"allow-set-minimizable","description":"Enables the set_minimizable command without any pre-configured scope.","commands":{"allow":["set_minimizable"],"deny":[]}},"allow-set-overlay-icon":{"identifier":"allow-set-overlay-icon","description":"Enables the set_overlay_icon command without any pre-configured scope.","commands":{"allow":["set_overlay_icon"],"deny":[]}},"allow-set-position":{"identifier":"allow-set-position","description":"Enables the set_position command without any pre-configured scope.","commands":{"allow":["set_position"],"deny":[]}},"allow-set-progress-bar":{"identifier":"allow-set-progress-bar","description":"Enables the set_progress_bar command without any pre-configured scope.","commands":{"allow":["set_progress_bar"],"deny":[]}},"allow-set-resizable":{"identifier":"allow-set-resizable","description":"Enables the set_resizable command without any pre-configured scope.","commands":{"allow":["set_resizable"],"deny":[]}},"allow-set-shadow":{"identifier":"allow-set-shadow","description":"Enables the set_shadow command without any pre-configured scope.","commands":{"allow":["set_shadow"],"deny":[]}},"allow-set-simple-fullscreen":{"identifier":"allow-set-simple-fullscreen","description":"Enables the set_simple_fullscreen command without any pre-configured scope.","commands":{"allow":["set_simple_fullscreen"],"deny":[]}},"allow-set-size":{"identifier":"allow-set-size","description":"Enables the set_size command without any pre-configured scope.","commands":{"allow":["set_size"],"deny":[]}},"allow-set-size-constraints":{"identifier":"allow-set-size-constraints","description":"Enables the set_size_constraints command without any pre-configured scope.","commands":{"allow":["set_size_constraints"],"deny":[]}},"allow-set-skip-taskbar":{"identifier":"allow-set-skip-taskbar","description":"Enables the set_skip_taskbar command without any pre-configured scope.","commands":{"allow":["set_skip_taskbar"],"deny":[]}},"allow-set-theme":{"identifier":"allow-set-theme","description":"Enables the set_theme command without any pre-configured scope.","commands":{"allow":["set_theme"],"deny":[]}},"allow-set-title":{"identifier":"allow-set-title","description":"Enables the set_title command without any pre-configured scope.","commands":{"allow":["set_title"],"deny":[]}},"allow-set-title-bar-style":{"identifier":"allow-set-title-bar-style","description":"Enables the set_title_bar_style command without any pre-configured scope.","commands":{"allow":["set_title_bar_style"],"deny":[]}},"allow-set-visible-on-all-workspaces":{"identifier":"allow-set-visible-on-all-workspaces","description":"Enables the set_visible_on_all_workspaces command without any pre-configured scope.","commands":{"allow":["set_visible_on_all_workspaces"],"deny":[]}},"allow-show":{"identifier":"allow-show","description":"Enables the show command without any pre-configured scope.","commands":{"allow":["show"],"deny":[]}},"allow-start-dragging":{"identifier":"allow-start-dragging","description":"Enables the start_dragging command without any pre-configured scope.","commands":{"allow":["start_dragging"],"deny":[]}},"allow-start-resize-dragging":{"identifier":"allow-start-resize-dragging","description":"Enables the start_resize_dragging command without any pre-configured scope.","commands":{"allow":["start_resize_dragging"],"deny":[]}},"allow-theme":{"identifier":"allow-theme","description":"Enables the theme command without any pre-configured scope.","commands":{"allow":["theme"],"deny":[]}},"allow-title":{"identifier":"allow-title","description":"Enables the title command without any pre-configured scope.","commands":{"allow":["title"],"deny":[]}},"allow-toggle-maximize":{"identifier":"allow-toggle-maximize","description":"Enables the toggle_maximize command without any pre-configured scope.","commands":{"allow":["toggle_maximize"],"deny":[]}},"allow-unmaximize":{"identifier":"allow-unmaximize","description":"Enables the unmaximize command without any pre-configured scope.","commands":{"allow":["unmaximize"],"deny":[]}},"allow-unminimize":{"identifier":"allow-unminimize","description":"Enables the unminimize command without any pre-configured scope.","commands":{"allow":["unminimize"],"deny":[]}},"deny-activity-name":{"identifier":"deny-activity-name","description":"Denies the activity_name command without any pre-configured scope.","commands":{"allow":[],"deny":["activity_name"]}},"deny-available-monitors":{"identifier":"deny-available-monitors","description":"Denies the available_monitors command without any pre-configured scope.","commands":{"allow":[],"deny":["available_monitors"]}},"deny-center":{"identifier":"deny-center","description":"Denies the center command without any pre-configured scope.","commands":{"allow":[],"deny":["center"]}},"deny-close":{"identifier":"deny-close","description":"Denies the close command without any pre-configured scope.","commands":{"allow":[],"deny":["close"]}},"deny-create":{"identifier":"deny-create","description":"Denies the create command without any pre-configured scope.","commands":{"allow":[],"deny":["create"]}},"deny-current-monitor":{"identifier":"deny-current-monitor","description":"Denies the current_monitor command without any pre-configured scope.","commands":{"allow":[],"deny":["current_monitor"]}},"deny-cursor-position":{"identifier":"deny-cursor-position","description":"Denies the cursor_position command without any pre-configured scope.","commands":{"allow":[],"deny":["cursor_position"]}},"deny-destroy":{"identifier":"deny-destroy","description":"Denies the destroy command without any pre-configured scope.","commands":{"allow":[],"deny":["destroy"]}},"deny-get-all-windows":{"identifier":"deny-get-all-windows","description":"Denies the get_all_windows command without any pre-configured scope.","commands":{"allow":[],"deny":["get_all_windows"]}},"deny-hide":{"identifier":"deny-hide","description":"Denies the hide command without any pre-configured scope.","commands":{"allow":[],"deny":["hide"]}},"deny-inner-position":{"identifier":"deny-inner-position","description":"Denies the inner_position command without any pre-configured scope.","commands":{"allow":[],"deny":["inner_position"]}},"deny-inner-size":{"identifier":"deny-inner-size","description":"Denies the inner_size command without any pre-configured scope.","commands":{"allow":[],"deny":["inner_size"]}},"deny-internal-toggle-maximize":{"identifier":"deny-internal-toggle-maximize","description":"Denies the internal_toggle_maximize command without any pre-configured scope.","commands":{"allow":[],"deny":["internal_toggle_maximize"]}},"deny-is-always-on-top":{"identifier":"deny-is-always-on-top","description":"Denies the is_always_on_top command without any pre-configured scope.","commands":{"allow":[],"deny":["is_always_on_top"]}},"deny-is-closable":{"identifier":"deny-is-closable","description":"Denies the is_closable command without any pre-configured scope.","commands":{"allow":[],"deny":["is_closable"]}},"deny-is-decorated":{"identifier":"deny-is-decorated","description":"Denies the is_decorated command without any pre-configured scope.","commands":{"allow":[],"deny":["is_decorated"]}},"deny-is-enabled":{"identifier":"deny-is-enabled","description":"Denies the is_enabled command without any pre-configured scope.","commands":{"allow":[],"deny":["is_enabled"]}},"deny-is-focused":{"identifier":"deny-is-focused","description":"Denies the is_focused command without any pre-configured scope.","commands":{"allow":[],"deny":["is_focused"]}},"deny-is-fullscreen":{"identifier":"deny-is-fullscreen","description":"Denies the is_fullscreen command without any pre-configured scope.","commands":{"allow":[],"deny":["is_fullscreen"]}},"deny-is-maximizable":{"identifier":"deny-is-maximizable","description":"Denies the is_maximizable command without any pre-configured scope.","commands":{"allow":[],"deny":["is_maximizable"]}},"deny-is-maximized":{"identifier":"deny-is-maximized","description":"Denies the is_maximized command without any pre-configured scope.","commands":{"allow":[],"deny":["is_maximized"]}},"deny-is-minimizable":{"identifier":"deny-is-minimizable","description":"Denies the is_minimizable command without any pre-configured scope.","commands":{"allow":[],"deny":["is_minimizable"]}},"deny-is-minimized":{"identifier":"deny-is-minimized","description":"Denies the is_minimized command without any pre-configured scope.","commands":{"allow":[],"deny":["is_minimized"]}},"deny-is-resizable":{"identifier":"deny-is-resizable","description":"Denies the is_resizable command without any pre-configured scope.","commands":{"allow":[],"deny":["is_resizable"]}},"deny-is-visible":{"identifier":"deny-is-visible","description":"Denies the is_visible command without any pre-configured scope.","commands":{"allow":[],"deny":["is_visible"]}},"deny-maximize":{"identifier":"deny-maximize","description":"Denies the maximize command without any pre-configured scope.","commands":{"allow":[],"deny":["maximize"]}},"deny-minimize":{"identifier":"deny-minimize","description":"Denies the minimize command without any pre-configured scope.","commands":{"allow":[],"deny":["minimize"]}},"deny-monitor-from-point":{"identifier":"deny-monitor-from-point","description":"Denies the monitor_from_point command without any pre-configured scope.","commands":{"allow":[],"deny":["monitor_from_point"]}},"deny-outer-position":{"identifier":"deny-outer-position","description":"Denies the outer_position command without any pre-configured scope.","commands":{"allow":[],"deny":["outer_position"]}},"deny-outer-size":{"identifier":"deny-outer-size","description":"Denies the outer_size command without any pre-configured scope.","commands":{"allow":[],"deny":["outer_size"]}},"deny-primary-monitor":{"identifier":"deny-primary-monitor","description":"Denies the primary_monitor command without any pre-configured scope.","commands":{"allow":[],"deny":["primary_monitor"]}},"deny-request-user-attention":{"identifier":"deny-request-user-attention","description":"Denies the request_user_attention command without any pre-configured scope.","commands":{"allow":[],"deny":["request_user_attention"]}},"deny-scale-factor":{"identifier":"deny-scale-factor","description":"Denies the scale_factor command without any pre-configured scope.","commands":{"allow":[],"deny":["scale_factor"]}},"deny-scene-identifier":{"identifier":"deny-scene-identifier","description":"Denies the scene_identifier command without any pre-configured scope.","commands":{"allow":[],"deny":["scene_identifier"]}},"deny-set-always-on-bottom":{"identifier":"deny-set-always-on-bottom","description":"Denies the set_always_on_bottom command without any pre-configured scope.","commands":{"allow":[],"deny":["set_always_on_bottom"]}},"deny-set-always-on-top":{"identifier":"deny-set-always-on-top","description":"Denies the set_always_on_top command without any pre-configured scope.","commands":{"allow":[],"deny":["set_always_on_top"]}},"deny-set-background-color":{"identifier":"deny-set-background-color","description":"Denies the set_background_color command without any pre-configured scope.","commands":{"allow":[],"deny":["set_background_color"]}},"deny-set-badge-count":{"identifier":"deny-set-badge-count","description":"Denies the set_badge_count command without any pre-configured scope.","commands":{"allow":[],"deny":["set_badge_count"]}},"deny-set-badge-label":{"identifier":"deny-set-badge-label","description":"Denies the set_badge_label command without any pre-configured scope.","commands":{"allow":[],"deny":["set_badge_label"]}},"deny-set-closable":{"identifier":"deny-set-closable","description":"Denies the set_closable command without any pre-configured scope.","commands":{"allow":[],"deny":["set_closable"]}},"deny-set-content-protected":{"identifier":"deny-set-content-protected","description":"Denies the set_content_protected command without any pre-configured scope.","commands":{"allow":[],"deny":["set_content_protected"]}},"deny-set-cursor-grab":{"identifier":"deny-set-cursor-grab","description":"Denies the set_cursor_grab command without any pre-configured scope.","commands":{"allow":[],"deny":["set_cursor_grab"]}},"deny-set-cursor-icon":{"identifier":"deny-set-cursor-icon","description":"Denies the set_cursor_icon command without any pre-configured scope.","commands":{"allow":[],"deny":["set_cursor_icon"]}},"deny-set-cursor-position":{"identifier":"deny-set-cursor-position","description":"Denies the set_cursor_position command without any pre-configured scope.","commands":{"allow":[],"deny":["set_cursor_position"]}},"deny-set-cursor-visible":{"identifier":"deny-set-cursor-visible","description":"Denies the set_cursor_visible command without any pre-configured scope.","commands":{"allow":[],"deny":["set_cursor_visible"]}},"deny-set-decorations":{"identifier":"deny-set-decorations","description":"Denies the set_decorations command without any pre-configured scope.","commands":{"allow":[],"deny":["set_decorations"]}},"deny-set-effects":{"identifier":"deny-set-effects","description":"Denies the set_effects command without any pre-configured scope.","commands":{"allow":[],"deny":["set_effects"]}},"deny-set-enabled":{"identifier":"deny-set-enabled","description":"Denies the set_enabled command without any pre-configured scope.","commands":{"allow":[],"deny":["set_enabled"]}},"deny-set-focus":{"identifier":"deny-set-focus","description":"Denies the set_focus command without any pre-configured scope.","commands":{"allow":[],"deny":["set_focus"]}},"deny-set-focusable":{"identifier":"deny-set-focusable","description":"Denies the set_focusable command without any pre-configured scope.","commands":{"allow":[],"deny":["set_focusable"]}},"deny-set-fullscreen":{"identifier":"deny-set-fullscreen","description":"Denies the set_fullscreen command without any pre-configured scope.","commands":{"allow":[],"deny":["set_fullscreen"]}},"deny-set-icon":{"identifier":"deny-set-icon","description":"Denies the set_icon command without any pre-configured scope.","commands":{"allow":[],"deny":["set_icon"]}},"deny-set-ignore-cursor-events":{"identifier":"deny-set-ignore-cursor-events","description":"Denies the set_ignore_cursor_events command without any pre-configured scope.","commands":{"allow":[],"deny":["set_ignore_cursor_events"]}},"deny-set-max-size":{"identifier":"deny-set-max-size","description":"Denies the set_max_size command without any pre-configured scope.","commands":{"allow":[],"deny":["set_max_size"]}},"deny-set-maximizable":{"identifier":"deny-set-maximizable","description":"Denies the set_maximizable command without any pre-configured scope.","commands":{"allow":[],"deny":["set_maximizable"]}},"deny-set-min-size":{"identifier":"deny-set-min-size","description":"Denies the set_min_size command without any pre-configured scope.","commands":{"allow":[],"deny":["set_min_size"]}},"deny-set-minimizable":{"identifier":"deny-set-minimizable","description":"Denies the set_minimizable command without any pre-configured scope.","commands":{"allow":[],"deny":["set_minimizable"]}},"deny-set-overlay-icon":{"identifier":"deny-set-overlay-icon","description":"Denies the set_overlay_icon command without any pre-configured scope.","commands":{"allow":[],"deny":["set_overlay_icon"]}},"deny-set-position":{"identifier":"deny-set-position","description":"Denies the set_position command without any pre-configured scope.","commands":{"allow":[],"deny":["set_position"]}},"deny-set-progress-bar":{"identifier":"deny-set-progress-bar","description":"Denies the set_progress_bar command without any pre-configured scope.","commands":{"allow":[],"deny":["set_progress_bar"]}},"deny-set-resizable":{"identifier":"deny-set-resizable","description":"Denies the set_resizable command without any pre-configured scope.","commands":{"allow":[],"deny":["set_resizable"]}},"deny-set-shadow":{"identifier":"deny-set-shadow","description":"Denies the set_shadow command without any pre-configured scope.","commands":{"allow":[],"deny":["set_shadow"]}},"deny-set-simple-fullscreen":{"identifier":"deny-set-simple-fullscreen","description":"Denies the set_simple_fullscreen command without any pre-configured scope.","commands":{"allow":[],"deny":["set_simple_fullscreen"]}},"deny-set-size":{"identifier":"deny-set-size","description":"Denies the set_size command without any pre-configured scope.","commands":{"allow":[],"deny":["set_size"]}},"deny-set-size-constraints":{"identifier":"deny-set-size-constraints","description":"Denies the set_size_constraints command without any pre-configured scope.","commands":{"allow":[],"deny":["set_size_constraints"]}},"deny-set-skip-taskbar":{"identifier":"deny-set-skip-taskbar","description":"Denies the set_skip_taskbar command without any pre-configured scope.","commands":{"allow":[],"deny":["set_skip_taskbar"]}},"deny-set-theme":{"identifier":"deny-set-theme","description":"Denies the set_theme command without any pre-configured scope.","commands":{"allow":[],"deny":["set_theme"]}},"deny-set-title":{"identifier":"deny-set-title","description":"Denies the set_title command without any pre-configured scope.","commands":{"allow":[],"deny":["set_title"]}},"deny-set-title-bar-style":{"identifier":"deny-set-title-bar-style","description":"Denies the set_title_bar_style command without any pre-configured scope.","commands":{"allow":[],"deny":["set_title_bar_style"]}},"deny-set-visible-on-all-workspaces":{"identifier":"deny-set-visible-on-all-workspaces","description":"Denies the set_visible_on_all_workspaces command without any pre-configured scope.","commands":{"allow":[],"deny":["set_visible_on_all_workspaces"]}},"deny-show":{"identifier":"deny-show","description":"Denies the show command without any pre-configured scope.","commands":{"allow":[],"deny":["show"]}},"deny-start-dragging":{"identifier":"deny-start-dragging","description":"Denies the start_dragging command without any pre-configured scope.","commands":{"allow":[],"deny":["start_dragging"]}},"deny-start-resize-dragging":{"identifier":"deny-start-resize-dragging","description":"Denies the start_resize_dragging command without any pre-configured scope.","commands":{"allow":[],"deny":["start_resize_dragging"]}},"deny-theme":{"identifier":"deny-theme","description":"Denies the theme command without any pre-configured scope.","commands":{"allow":[],"deny":["theme"]}},"deny-title":{"identifier":"deny-title","description":"Denies the title command without any pre-configured scope.","commands":{"allow":[],"deny":["title"]}},"deny-toggle-maximize":{"identifier":"deny-toggle-maximize","description":"Denies the toggle_maximize command without any pre-configured scope.","commands":{"allow":[],"deny":["toggle_maximize"]}},"deny-unmaximize":{"identifier":"deny-unmaximize","description":"Denies the unmaximize command without any pre-configured scope.","commands":{"allow":[],"deny":["unmaximize"]}},"deny-unminimize":{"identifier":"deny-unminimize","description":"Denies the unminimize command without any pre-configured scope.","commands":{"allow":[],"deny":["unminimize"]}}},"permission_sets":{},"global_scope_schema":null},"dialog":{"default_permission":{"identifier":"default","description":"This permission set configures the types of dialogs\navailable from the dialog plugin.\n\n#### Granted Permissions\n\nAll dialog types are enabled.\n\n\n","permissions":["allow-message","allow-save","allow-open"]},"permissions":{"allow-ask":{"identifier":"allow-ask","description":"Enables the ask command without any pre-configured scope. (**DEPRECATED**: This is now an alias to `allow-message` and will be removed in v3)","commands":{"allow":["message"],"deny":[]}},"allow-confirm":{"identifier":"allow-confirm","description":"Enables the confirm command without any pre-configured scope. (**DEPRECATED**: This is now an alias to `allow-message` and will be removed in v3)","commands":{"allow":["message"],"deny":[]}},"allow-message":{"identifier":"allow-message","description":"Enables the message command without any pre-configured scope.","commands":{"allow":["message"],"deny":[]}},"allow-open":{"identifier":"allow-open","description":"Enables the open command without any pre-configured scope.","commands":{"allow":["open"],"deny":[]}},"allow-save":{"identifier":"allow-save","description":"Enables the save command without any pre-configured scope.","commands":{"allow":["save"],"deny":[]}},"deny-ask":{"identifier":"deny-ask","description":"Denies the ask command without any pre-configured scope. (**DEPRECATED**: This is now an alias to `deny-message` and will be removed in v3)","commands":{"allow":[],"deny":["message"]}},"deny-confirm":{"identifier":"deny-confirm","description":"Denies the confirm command without any pre-configured scope. (**DEPRECATED**: This is now an alias to `deny-message` and will be removed in v3)","commands":{"allow":[],"deny":["message"]}},"deny-message":{"identifier":"deny-message","description":"Denies the message command without any pre-configured scope.","commands":{"allow":[],"deny":["message"]}},"deny-open":{"identifier":"deny-open","description":"Denies the open command without any pre-configured scope.","commands":{"allow":[],"deny":["open"]}},"deny-save":{"identifier":"deny-save","description":"Denies the save command without any pre-configured scope.","commands":{"allow":[],"deny":["save"]}}},"permission_sets":{},"global_scope_schema":null},"global-shortcut":{"default_permission":{"identifier":"default","description":"No features are enabled by default, as we believe\nthe shortcuts can be inherently dangerous and it is\napplication specific if specific shortcuts should be\nregistered or unregistered.\n","permissions":[]},"permissions":{"allow-is-registered":{"identifier":"allow-is-registered","description":"Enables the is_registered command without any pre-configured scope.","commands":{"allow":["is_registered"],"deny":[]}},"allow-register":{"identifier":"allow-register","description":"Enables the register command without any pre-configured scope.","commands":{"allow":["register"],"deny":[]}},"allow-register-all":{"identifier":"allow-register-all","description":"Enables the register_all command without any pre-configured scope.","commands":{"allow":["register_all"],"deny":[]}},"allow-unregister":{"identifier":"allow-unregister","description":"Enables the unregister command without any pre-configured scope.","commands":{"allow":["unregister"],"deny":[]}},"allow-unregister-all":{"identifier":"allow-unregister-all","description":"Enables the unregister_all command without any pre-configured scope.","commands":{"allow":["unregister_all"],"deny":[]}},"deny-is-registered":{"identifier":"deny-is-registered","description":"Denies the is_registered command without any pre-configured scope.","commands":{"allow":[],"deny":["is_registered"]}},"deny-register":{"identifier":"deny-register","description":"Denies the register command without any pre-configured scope.","commands":{"allow":[],"deny":["register"]}},"deny-register-all":{"identifier":"deny-register-all","description":"Denies the register_all command without any pre-configured scope.","commands":{"allow":[],"deny":["register_all"]}},"deny-unregister":{"identifier":"deny-unregister","description":"Denies the unregister command without any pre-configured scope.","commands":{"allow":[],"deny":["unregister"]}},"deny-unregister-all":{"identifier":"deny-unregister-all","description":"Denies the unregister_all command without any pre-configured scope.","commands":{"allow":[],"deny":["unregister_all"]}}},"permission_sets":{},"global_scope_schema":null}}
src/editors/decorations/theme.ts:1:/* 活源码装饰主题（精简自 md-bundle packages/editor/src/decorations/theme.ts）。
src/styles/editor.css:189:/* ── 活源码装饰两态（移植自 md-bundle decorations/theme.ts） ──────────
8: * 而非抢眼。想统一时把 --reader-accent 指回 var(--app-accent) 即可。
21:  --app-accent: #6366f1;
22:  --app-accent-soft: rgba(99, 102, 241, 0.1);
24:  --app-bg: #f7f7f6;
25:  --app-surface: #fbfaf8;
26:  --app-sunken: #f4f2ec;
27:  --app-chrome-bg: var(--app-surface);
29:  --app-text: #24262b;
30:  --app-text-strong: #16181c;
31:  --app-text-2: #55595f;
32:  --app-text-3: #8b8f96;
38:  --app-border: #e7e3db;
39:  --app-border-strong: #d8d3c8;
41:  --app-radius: 6px;
47:     取值 6px 延续视频块既有圆角（预览 --reader-radius / 编辑 --app-radius 均为 6px）。 */
51:  --app-shadow:
56:  --app-accent: #818cf8;
57:  --app-accent-soft: rgba(129, 140, 248, 0.14);
59:  --app-bg: #131316;
60:  --app-surface: #1a1b1e;
61:  --app-sunken: #22242a;
62:  --app-chrome-bg: var(--app-surface);
64:  --app-text: #d8dade;
65:  --app-text-strong: #eceef1;
66:  --app-text-2: #a7abb3;
67:  --app-text-3: #75797f;
73:  --app-border: #2e3138;
74:  --app-border-strong: #3d4149;
79:  --app-accent: #0071e3;
80:  --app-accent-soft: rgba(0, 113, 227, 0.08);
82:  --app-bg: #f2e9da;
83:  --app-surface: #fbf4e8;
84:  --app-sunken: #efe3d0;
85:  --app-chrome-bg: var(--app-surface);
87:  --app-text: #3b3024;
88:  --app-text-strong: #241c12;
89:  --app-text-2: #6b5a45;
90:  --app-text-3: #96826a;
96:  --app-border: #e0d2bc;
97:  --app-border-strong: #cdbca1;
106:  background-color: var(--app-surface) !important;
111:  background-color: var(--app-sunken) !important;
115:  background-color: var(--app-border) !important;
120:  background-color: var(--app-text) !important;
131:    var(--app-surface) 94%,
139:  color: var(--app-text) !important;
145:  color: var(--app-text-2) !important;
152:  border-color: var(--app-border) !important;
160:  background-color: var(--app-sunken) !important;
165:  background-color: var(--app-surface) !important;
169:  background-color: var(--app-sunken) !important;
174:  color: var(--app-text) !important;
179:  color: var(--app-text-2) !important;
183:  border-color: var(--app-border) !important;
188:  background-color: var(--app-sunken) !important;

exec
/bin/zsh -c "nl -ba src-tauri/src/lib.rs | sed -n '150,230p'
nl -ba src-tauri/src/extension_packages.rs | sed -n '360,460p;500,575p;670,730p'
nl -ba src/lib/capabilities.ts | sed -n '1,130p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
   150	            use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers};
   151	            let handle = app.handle().clone();
   152	            let shortcut = tauri_plugin_global_shortcut::Shortcut::new(
   153	                Some(Modifiers::META | Modifiers::SHIFT),
   154	                Code::Period,
   155	            );
   156	            app.global_shortcut()
   157	                .on_shortcut(shortcut, move |_app, _shortcut, event| {
   158	                    if event.state == tauri_plugin_global_shortcut::ShortcutState::Pressed {
   159	                        if let Some(overlay) = handle.get_webview_window("overlay") {
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
   211	            search_documents,
   212	            import_media_file,
   213	            import_media_bytes,
   214	            translate_text,
   215	            stop_translation,
   216	            read_directory,
   217	            get_file_info,
   218	            flatten_files,
   219	            list_media_in_dir,
   220	            load_config,
   221	            save_config,
   222	            list_config_snapshots,
   223	            restore_config_snapshot,
   224	            list_system_fonts,
   225	            list_extensions,
   226	            list_extension_packages,
   227	            import_extension_package,
   228	            set_extension_package_enabled,
   229	            remove_extension_package,
   230	            package_extension_package,
   360	        }
   361	    }
   362	    Ok(())
   363	}
   364	
   365	/// 导入文件夹或 zip；id 已存在则整体替换。默认启用（源里若带 `.disabled`
   366	/// 标记则原样保留，保证导出 → 再导入的严格相等）。
   367	///
   368	/// 先复制到 `<extensions>/.tmp-<id>-<hash>` 暂存目录，成功后才移除旧目标并
   369	/// 原子 rename。复制 / 校验失败时暂存目录被删除，已安装的旧包保持不变；源目录
   370	/// 就是目标目录（自导入）时，暂存副本先读完整旧目录，因此不会丢数据。
   371	pub fn import_extension_package_at(base: &Path, path: &str) -> Result<ExtensionPackage, AppError> {
   372	    let ResolvedSource {
   373	        manifest,
   374	        skill,
   375	        dir,
   376	        _temp,
   377	    } = resolve_import_source(path)?;
   378	
   379	    if is_builtin(&manifest.id) {
   380	        return Err(validation(
   381	            "import",
   382	            format!("内置扩展 id {} 不可导入", manifest.id),
   383	        ));
   384	    }
   385	
   386	    let extensions = extensions_dir_base(base);
   387	    std::fs::create_dir_all(&extensions)
   388	        .map_err(|e| io(&format!("create {}", extensions.display()), e))?;
   389	    let staging = extensions.join(format!(".tmp-{}-{}", manifest.id, short_hash(path)));
   390	    if staging.exists() {
   391	        let _ = std::fs::remove_dir_all(&staging);
   392	    }
   393	
   394	    let copy_result = copy_dir(&dir, &staging);
   395	    if let Err(e) = copy_result {
   396	        let _ = std::fs::remove_dir_all(&staging);
   397	        return Err(e);
   398	    }
   399	
   400	    let target = extensions.join(&manifest.id);
   401	    if target.exists() {
   402	        std::fs::remove_dir_all(&target)
   403	            .map_err(|e| io(&format!("remove old package {}", target.display()), e))?;
   404	    }
   405	    std::fs::rename(&staging, &target).map_err(|e| {
   406	        io(
   407	            &format!("rename {} → {}", staging.display(), target.display()),
   408	            e,
   409	        )
   410	    })?;
   411	    drop(_temp);
   412	
   413	    Ok(ExtensionPackage {
   414	        id: manifest.id,
   415	        name: manifest.name,
   416	        version: manifest.version,
   417	        description: manifest.description,
   418	        source: manifest.source,
   419	        enabled: package_enabled(&target),
   420	        dir: Some(target.to_string_lossy().into_owned()),
   421	        skill,
   422	    })
   423	}
   424	
   425	/// 安全拼接 zip 条目名：拒绝绝对路径与 `..` 穿越。
   426	fn safe_join(base: &Path, entry_name: &str) -> Option<PathBuf> {
   427	    let rel = Path::new(entry_name);
   428	    if rel.is_absolute() {
   429	        return None;
   430	    }
   431	    let mut out = base.to_path_buf();
   432	    for comp in rel.components() {
   433	        match comp {
   434	            Component::Normal(part) => out.push(part),
   435	            Component::CurDir => {}
   436	            _ => return None,
   437	        }
   438	    }
   439	    if !out.starts_with(base) {
   440	        return None;
   441	    }
   442	    Some(out)
   443	}
   444	
   445	/// 解压 zip 到 dest。拒绝绝对路径、`..` 穿越与符号链接条目；
   446	/// 并强制条目数 / 单文件 / 总字节数上限，防 zip bomb。
   447	fn extract_zip(zip_path: &Path, dest: &Path) -> Result<(), AppError> {
   448	    let file = std::fs::File::open(zip_path)
   449	        .map_err(|e| io(&format!("open {}", zip_path.display()), e))?;
   450	    let mut archive = zip::ZipArchive::new(file).map_err(|e| zip_err("open zip", e))?;
   451	
   452	    let entry_count = archive.len();
   453	    if entry_count > MAX_ZIP_ENTRIES {
   454	        return Err(validation(
   455	            "zip",
   456	            format!("zip 条目数 {entry_count} 超过上限 {MAX_ZIP_ENTRIES}",),
   457	        ));
   458	    }
   459	
   460	    let mut total_bytes: u64 = 0;
   500	        if let Some(parent) = out_path.parent() {
   501	            std::fs::create_dir_all(parent)
   502	                .map_err(|e| io(&format!("create {}", parent.display()), e))?;
   503	        }
   504	        let mut out = std::fs::File::create(&out_path)
   505	            .map_err(|e| io(&format!("create {}", out_path.display()), e))?;
   506	        let room = MAX_ZIP_FILE_BYTES.min(MAX_ZIP_TOTAL_BYTES - total_bytes);
   507	        let copied = std::io::copy(&mut entry.by_ref().take(room + 1), &mut out)
   508	            .map_err(|e| io(&format!("extract {raw_name}"), e))?;
   509	        if copied > room {
   510	            return Err(validation(
   511	                "zip",
   512	                format!("zip 条目 {raw_name} 实际解压 {copied} 字节，超过单文件 / 总量上限"),
   513	            ));
   514	        }
   515	        total_bytes += copied;
   516	    }
   517	    Ok(())
   518	}
   519	
   520	fn package_dir_at(base: &Path, id: &str) -> Result<PathBuf, AppError> {
   521	    if !is_valid_id(id) {
   522	        return Err(validation(
   523	            "extensionPackage",
   524	            format!("非法的扩展 id：{id}"),
   525	        ));
   526	    }
   527	    let dir = extensions_dir_base(base).join(id);
   528	    if !dir.is_dir() {
   529	        return Err(validation("extensionPackage", format!("扩展不存在：{id}")));
   530	    }
   531	    Ok(dir)
   532	}
   533	
   534	pub fn set_extension_package_enabled_at(
   535	    base: &Path,
   536	    id: &str,
   537	    enabled: bool,
   538	) -> Result<(), AppError> {
   539	    if is_builtin(id) {
   540	        return Err(validation(
   541	            "extensionPackage",
   542	            "内置扩展始终启用，不可修改启用状态",
   543	        ));
   544	    }
   545	    let dir = package_dir_at(base, id)?;
   546	    let marker = dir.join(DISABLED_MARKER);
   547	    if enabled {
   548	        if marker.exists() {
   549	            std::fs::remove_file(&marker)
   550	                .map_err(|e| io(&format!("remove {}", marker.display()), e))?;
   551	        }
   552	    } else {
   553	        std::fs::write(&marker, b"").map_err(|e| io(&format!("write {}", marker.display()), e))?;
   554	    }
   555	    Ok(())
   556	}
   557	
   558	pub fn remove_extension_package_at(base: &Path, id: &str) -> Result<(), AppError> {
   559	    if is_builtin(id) {
   560	        return Err(validation("extensionPackage", "内置扩展不可卸载"));
   561	    }
   562	    let dir = package_dir_at(base, id)?;
   563	    std::fs::remove_dir_all(&dir).map_err(|e| io(&format!("remove {}", dir.display()), e))?;
   564	    Ok(())
   565	}
   566	
   567	fn add_dir_entries<W: Write + std::io::Seek>(
   568	    zip: &mut zip::ZipWriter<W>,
   569	    base: &Path,
   570	    dir: &Path,
   571	    options: zip::write::SimpleFileOptions,
   572	) -> Result<(), AppError> {
   573	    let entries = std::fs::read_dir(dir).map_err(|e| io(&format!("read {}", dir.display()), e))?;
   574	    for entry in entries {
   575	        let entry = entry.map_err(|e| io("read dir entry", e))?;
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
/bin/zsh -c "rg -n 'list_extensions|loadUserExtensions|loadExtensionSnapshot|snippets' src/App.tsx src/components/Content src/editors/user-extensions.ts src/lib/extensions -C 3 | sed -n '1,260p'
nl -ba src/App.tsx | sed -n '190,245p;970,1010p'
nl -ba src/hooks/useConfig.ts | sed -n '130,200p;380,500p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src/editors/user-extensions.ts:1:/* 用户片段（snippets）接入斜杠菜单。
src/editors/user-extensions.ts-2- *
src/editors/user-extensions.ts:3: * Rust 侧 `list_extensions` 返回的 `ExtensionsSnapshot` 里，`snippets` 是
src/editors/user-extensions.ts-4- * `{ id, label, keywords, icon?, body, path }`（serde 默认 snake_case）。
src/editors/user-extensions.ts-5- * 本模块把它映射成 `SlashCommand`，让同一套过滤/渲染/单事务插入逻辑复用。
src/editors/user-extensions.ts-6- *
src/editors/user-extensions.ts-7- * 模板与主题 token 的前端接入见 `src/lib/extensions/`（bundle / templates /
src/editors/user-extensions.ts:8: * theme-tokens），本模块只管 snippets。
src/editors/user-extensions.ts-9- *
src/editors/user-extensions.ts-10- * 任何调用异常或返回形状不对都返回空列表——菜单退回纯内置命令，
src/editors/user-extensions.ts:11: * 不抛错、不打 error 级日志（`list_extensions` 在纯浏览器/老版本里不存在）。
src/editors/user-extensions.ts-12- */
src/editors/user-extensions.ts-13-
src/editors/user-extensions.ts-14-import type { SlashCommand } from "./slash";
src/editors/user-extensions.ts-15-
src/editors/user-extensions.ts:16:/** 用户片段的原始形状（`list_extensions` 的 `snippets[]` 元素）。 */
src/editors/user-extensions.ts-17-export interface UserSnippet {
src/editors/user-extensions.ts-18-  id: string;
src/editors/user-extensions.ts-19-  label: string;
--
src/editors/user-extensions.ts-84-  };
src/editors/user-extensions.ts-85-}
src/editors/user-extensions.ts-86-
src/editors/user-extensions.ts:87:/** 从 `list_extensions` 返回值里取 snippets；形状不对返回空列表。 */
src/editors/user-extensions.ts-88-export function extractSnippets(result: unknown): UserSnippet[] {
src/editors/user-extensions.ts-89-  if (!isRecord(result)) return [];
src/editors/user-extensions.ts:90:  const snippets = result.snippets;
src/editors/user-extensions.ts:91:  if (!Array.isArray(snippets)) return [];
src/editors/user-extensions.ts-92-  const out: UserSnippet[] = [];
src/editors/user-extensions.ts:93:  for (const entry of snippets) {
src/editors/user-extensions.ts-94-    const snippet = toSnippet(entry);
src/editors/user-extensions.ts-95-    if (snippet !== null) out.push(snippet);
src/editors/user-extensions.ts-96-  }
--
src/editors/user-extensions.ts-98-}
src/editors/user-extensions.ts-99-
src/editors/user-extensions.ts-100-/**
src/editors/user-extensions.ts:101: * 调 `list_extensions` 并把 `snippets` 映射成斜杠命令。
src/editors/user-extensions.ts-102- *
src/editors/user-extensions.ts-103- * 异常（命令不存在/后端报错）与返回形状不对都静默返回 `[]`。
src/editors/user-extensions.ts-104- */
src/editors/user-extensions.ts:105:export async function loadUserExtensions(
src/editors/user-extensions.ts-106-  invokeFn: (cmd: string) => Promise<unknown>,
src/editors/user-extensions.ts-107-): Promise<SlashCommand[]> {
src/editors/user-extensions.ts-108-  try {
src/editors/user-extensions.ts:109:    const result = await invokeFn("list_extensions");
src/editors/user-extensions.ts-110-    return extractSnippets(result).map(snippetToCommand);
src/editors/user-extensions.ts-111-  } catch {
src/editors/user-extensions.ts-112-    return [];
--
src/lib/extensions/bundle.ts:1:/* 扩展 bundle：一次 `list_extensions` 调用拿回 templates + theme tokens + warnings。
src/lib/extensions/bundle.ts-2- *
src/lib/extensions/bundle.ts:3: * 与 `src/editors/user-extensions.ts` 的 `loadUserExtensions` 并存（后者把
src/lib/extensions/bundle.ts:4: * snippets 映射成斜杠命令）；本模块负责新建页模板与主题 token。
src/lib/extensions/bundle.ts-5- * 任何调用异常或返回形状不对都静默返回空 bundle，不抛错
src/lib/extensions/bundle.ts:6: * （`list_extensions` 在纯浏览器/老版本里不存在）。
src/lib/extensions/bundle.ts-7- */
src/lib/extensions/bundle.ts-8-
src/lib/extensions/bundle.ts-9-import type { Template } from "./templates";
--
src/lib/extensions/bundle.ts-16-  warnings: string[];
src/lib/extensions/bundle.ts-17-}
src/lib/extensions/bundle.ts-18-
src/lib/extensions/bundle.ts:19:/** 一次 `list_extensions` 调用解析出的三类扩展数据（snippets 供斜杠菜单）。 */
src/lib/extensions/bundle.ts-20-export interface ExtensionSnapshot {
src/lib/extensions/bundle.ts:21:  snippets: UserSnippet[];
src/lib/extensions/bundle.ts-22-  templates: Template[];
src/lib/extensions/bundle.ts-23-  themeTokens: Record<string, string>;
src/lib/extensions/bundle.ts-24-}
--
src/lib/extensions/bundle.ts-37-  return { name, body, path };
src/lib/extensions/bundle.ts-38-}
src/lib/extensions/bundle.ts-39-
src/lib/extensions/bundle.ts:40:/** 从 `list_extensions` 返回值里取模板；形状不对返回空列表。 */
src/lib/extensions/bundle.ts-41-function extractTemplates(result: unknown): Template[] {
src/lib/extensions/bundle.ts-42-  if (!isRecord(result)) return [];
src/lib/extensions/bundle.ts-43-  const templates = result.templates;
--
src/lib/extensions/bundle.ts-72-  return warnings.filter((w): w is string => typeof w === "string");
src/lib/extensions/bundle.ts-73-}
src/lib/extensions/bundle.ts-74-
src/lib/extensions/bundle.ts:75:/** 把 `list_extensions` 返回值映射成 bundle；形状不对的字段各自降级。 */
src/lib/extensions/bundle.ts-76-function toBundle(result: unknown): ExtensionBundle {
src/lib/extensions/bundle.ts-77-  return {
src/lib/extensions/bundle.ts-78-    templates: extractTemplates(result),
--
src/lib/extensions/bundle.ts-82-}
src/lib/extensions/bundle.ts-83-
src/lib/extensions/bundle.ts-84-/**
src/lib/extensions/bundle.ts:85: * 调一次 `list_extensions` 并解析成 bundle。
src/lib/extensions/bundle.ts-86- * 异常（命令不存在/后端报错）与返回形状不对都静默返回空 bundle。
src/lib/extensions/bundle.ts-87- */
src/lib/extensions/bundle.ts-88-export async function loadExtensionBundle(
src/lib/extensions/bundle.ts-89-  invokeFn: (cmd: string) => Promise<unknown>,
src/lib/extensions/bundle.ts-90-): Promise<ExtensionBundle> {
src/lib/extensions/bundle.ts-91-  try {
src/lib/extensions/bundle.ts:92:    const result = await invokeFn("list_extensions");
src/lib/extensions/bundle.ts-93-    return toBundle(result);
src/lib/extensions/bundle.ts-94-  } catch {
src/lib/extensions/bundle.ts-95-    return { templates: [], themeTokens: {}, warnings: [] };
--
src/lib/extensions/bundle.ts-97-}
src/lib/extensions/bundle.ts-98-
src/lib/extensions/bundle.ts-99-/**
src/lib/extensions/bundle.ts:100: * 调一次 `list_extensions`，解析 snippets / templates / theme tokens 三类。
src/lib/extensions/bundle.ts-101- * 异常与形状不对都静默返回全空快照。
src/lib/extensions/bundle.ts-102- */
src/lib/extensions/bundle.ts:103:export async function loadExtensionSnapshot(
src/lib/extensions/bundle.ts-104-  invokeFn: (cmd: string) => Promise<unknown>,
src/lib/extensions/bundle.ts-105-): Promise<ExtensionSnapshot> {
src/lib/extensions/bundle.ts-106-  try {
src/lib/extensions/bundle.ts:107:    const result = await invokeFn("list_extensions");
src/lib/extensions/bundle.ts-108-    const bundle = toBundle(result);
src/lib/extensions/bundle.ts-109-    return {
src/lib/extensions/bundle.ts:110:      snippets: extractSnippets(result),
src/lib/extensions/bundle.ts-111-      templates: bundle.templates,
src/lib/extensions/bundle.ts-112-      themeTokens: bundle.themeTokens,
src/lib/extensions/bundle.ts-113-    };
src/lib/extensions/bundle.ts-114-  } catch {
src/lib/extensions/bundle.ts:115:    return { snippets: [], templates: [], themeTokens: {} };
src/lib/extensions/bundle.ts-116-  }
src/lib/extensions/bundle.ts-117-}
--
src/lib/extensions/templates.ts-1-/* 新建页模板（design §D3）。
src/lib/extensions/templates.ts-2- *
src/lib/extensions/templates.ts:3: * `list_extensions` 返回的 `templates[]` 元素形状；正文里的占位符仅两个：
src/lib/extensions/templates.ts-4- * `{{date}}` → `YYYY-MM-DD`，`{{title}}` → 新页签名（无路径时即「未命名」）。
src/lib/extensions/templates.ts-5- * 未知占位符原样保留，替换一次性完成（插入值里的 `{{...}}` 不会被二次替换）。
src/lib/extensions/templates.ts-6- */
--
src/components/Content/ContentArea.tsx-53-  markdownDestination,
src/components/Content/ContentArea.tsx-54-} from "../../editors/slash";
src/components/Content/ContentArea.tsx-55-import { isTauriEnv } from "../../utils/tauri";
src/components/Content/ContentArea.tsx:56:import { loadUserExtensions } from "../../editors/user-extensions";
src/components/Content/ContentArea.tsx-57-import HtmlVisualEditor from "./HtmlVisualEditor";
src/components/Content/ContentArea.tsx-58-import { horizontalToolbar } from "../../editors/orchestration/horizontal-toolbar";
src/components/Content/ContentArea.tsx-59-import { floatingToolbar } from "../../editors/orchestration/floating-toolbar";
--
src/components/Content/ContentArea.tsx-606-    );
src/components/Content/ContentArea.tsx-607-
src/components/Content/ContentArea.tsx-608-    // 用户片段：编辑器创建后加载一次并注册进斜杠菜单。加载失败静默——菜单退回
src/components/Content/ContentArea.tsx:609:    // 纯内置命令（`list_extensions` 在纯浏览器/老版本里不存在）。
src/components/Content/ContentArea.tsx:610:    void loadUserExtensions(invoke).then((commands) => {
src/components/Content/ContentArea.tsx-611-      setUserSlashCommands(commands);
src/components/Content/ContentArea.tsx-612-    });
src/components/Content/ContentArea.tsx-613-
   190	          defaultDir: useEditorStore.getState().config.defaultSavePath ?? null,
   191	        });
   192	        if (saved?.path) {
   193	          useStore.getState().setTabPath(activeTab.id, saved.path);
   194	          useStore.getState().markClean();
   195	        }
   196	        return;
   197	      }
   198	      await invoke("save_file", {
   199	        path: activeTab.path,
   200	        content: activeTab.content,
   201	      });
   202	      useStore.getState().markClean();
   203	    } catch (e) {
   204	      log.error("App", "Failed to save file", e);
   205	    }
   206	  }, [
   207	    activeTab?.path,
   208	    activeTab?.content,
   209	    activeTab?.fileKind,
   210	    activeTab?.id,
   211	    activeTab?.title,
   212	  ]);
   213	
   214	  const handleNewFile = useCallback(() => {
   215	    if (templates.length > 0) {
   216	      setPickerOpen(true);
   217	      return;
   218	    }
   219	    useStore.getState().newTab();
   220	  }, [templates]);
   221	
   222	  // 启动时读一次扩展 bundle：模板供新建页选择，theme token 覆盖内置变量。
   223	  // 加载失败静默（空 bundle → 无模板选择器、无 token 覆盖）。
   224	  useEffect(() => {
   225	    void loadExtensionBundle(invoke).then((bundle: ExtensionBundle) => {
   226	      setTemplates(bundle.templates);
   227	      applyThemeTokens(bundle.themeTokens);
   228	    });
   229	  }, []);
   230	
   231	  // 原生顶栏跟随主题：system 传 null 交回系统（Tauri 语义），非 Tauri 环境跳过。
   232	  useEffect(() => {
   233	    if (!isTauri) return;
   234	    let cancelled = false;
   235	    import("@tauri-apps/api/window")
   236	      .then(({ getCurrentWindow }) => {
   237	        if (cancelled) return;
   238	        const native = theme === "dark" ? "dark" : "light";
   239	        return getCurrentWindow()
   240	          .setTheme(theme === "system" ? null : native)
   241	          .catch(() => {});
   242	      })
   243	      .catch(() => {});
   244	    return () => {
   245	      cancelled = true;
   970	              useAiEntryStore.getState().openOverlay();
   971	            }}
   972	            onStudyPage={() => {
   973	              useStore.getState().setScene("workspace");
   974	              useAiEntryStore
   975	                .getState()
   976	                .setInput("把这篇文档整理成一份学习页：要点、例子、自测题。");
   977	              useAiEntryStore.getState().openOverlay();
   978	            }}
   979	          />
   980	        </div>
   981	      )}
   982	      {scene === "grid" && (
   983	        <div className="fixed inset-0 z-40 bg-[var(--app-surface)]">
   984	          <GridView onOpenPath={handleOpenPath} />
   985	        </div>
   986	      )}
   987	      {scene === "settings" && (
   988	        <div className="fixed inset-0 z-50">
   989	          <SettingsView onClose={closeSettings} />
   990	        </div>
   991	      )}
   992	      {pickerOpen && templates.length > 0 && (
   993	        <TemplatePicker
   994	          templates={templates}
   995	          onSelect={handleTemplateSelect}
   996	          onBlank={handleBlankSelect}
   997	          onClose={() => setPickerOpen(false)}
   998	        />
   999	      )}
  1000	      <ShortcutOverlay
  1001	        open={shortcutsOpen}
  1002	        onClose={() => setShortcutsOpen(false)}
  1003	      />
  1004	      <QuickOpen
  1005	        open={quickOpenOpen}
  1006	        query={quickOpenQuery}
  1007	        onQueryChange={setQuickOpenQuery}
  1008	        onClose={handleQuickOpenClose}
  1009	        onOpenTab={handleQuickOpenTab}
  1010	        onOpenPath={handleQuickOpenPath}
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

exec
/bin/zsh -c "rg -n 'manifest\\.json|\"source\"|source:|permissions|filesystem|env\\.toml|extension' docs openspec e2e src-tauri -g '*.md' -g '*.json' -g '*.toml' -g '*.ts' -g '*.tsx' | sed -n '1,420p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
docs/MIGRATION-REPORT.md:37:1. **任务 1 基线清单** `.omo/evidence/ulw/clairis-doc-governance/task-1/baseline-manifest.json`（`files` 数组 173 条，每条含 `path/group/sha256/size/action`）。
docs/MIGRATION-REPORT.md:254:| 1 基线清单 | baseline-manifest.json（173）、backup-manifest.json（121，hash 全匹配）、exclusion-ledger.json | `task-1/` |
docs/MIGRATION-REPORT.md:275:`{"source","group","baseline_sha256","disposition","target","note", ...}`）。本报告各节即该账目的人类可读汇总，二者口径一致、账目平衡。
src-tauri/gen/schemas/desktop-schema.json:40:      "description": "A grouping and boundary mechanism developers can use to isolate access to the IPC layer.\n\nIt controls application windows' and webviews' fine grained access to the Tauri core, application, or plugin commands. If a webview or its window is not matching any capability then it has no access to the IPC layer at all.\n\nThis can be done to create groups of windows, based on their required system access, which can reduce impact of frontend vulnerabilities in less privileged windows. Windows can be added to a capability by exact name (e.g. `main-window`) or glob patterns like `*` or `admin-*`. A Window can have none, one, or multiple associated capabilities.\n\n## Example\n\n```json { \"identifier\": \"main-user-files-write\", \"description\": \"This capability allows the `main` window on macOS and Windows access to `filesystem` write related commands and `dialog` commands to enable programmatic access to files selected by the user.\", \"windows\": [ \"main\" ], \"permissions\": [ \"core:default\", \"dialog:open\", { \"identifier\": \"fs:allow-write-text-file\", \"allow\": [{ \"path\": \"$HOME/test.txt\" }] }, ], \"platforms\": [\"macOS\",\"windows\"] } ```",
src-tauri/gen/schemas/desktop-schema.json:44:        "permissions"
src-tauri/gen/schemas/desktop-schema.json:52:          "description": "Description of what the capability is intended to allow on associated windows.\n\nIt should contain a description of what the grouped permissions should allow.\n\n## Example\n\nThis capability allows the `main` window access to `filesystem` write related commands and `dialog` commands to enable programmatic access to files selected by the user.",
src-tauri/gen/schemas/desktop-schema.json:57:          "description": "Configure remote URLs that can use the capability permissions.\n\nThis setting is optional and defaults to not being set, as our default use case is that the content is served from our local application.\n\n:::caution Make sure you understand the security implications of providing remote sources with local system access. :::\n\n## Example\n\n```json { \"urls\": [\"https://*.mydomain.dev\"] } ```",
src-tauri/gen/schemas/desktop-schema.json:86:        "permissions": {
src-tauri/gen/schemas/desktop-schema.json:87:          "description": "List of permissions attached to this capability.\n\nMust include the plugin name as prefix in the form of `${plugin-name}:${permission-name}`. For commands directly implemented in the application itself only `${permission-name}` is required.\n\n## Example\n\n```json [ \"core:default\", \"shell:allow-open\", \"dialog:open\", { \"identifier\": \"fs:allow-write-text-file\", \"allow\": [{ \"path\": \"$HOME/test.txt\" }] } ] ```",
src-tauri/gen/schemas/desktop-schema.json:186:          "description": "Default permissions for the plugin.\n#### This default permission set includes:\n\n- `allow-version`\n- `allow-name`\n- `allow-tauri-version`\n- `allow-identifier`\n- `allow-bundle-type`\n- `allow-register-listener`\n- `allow-remove-listener`\n- `allow-supports-multiple-windows`",
src-tauri/gen/schemas/desktop-schema.json:189:          "markdownDescription": "Default permissions for the plugin.\n#### This default permission set includes:\n\n- `allow-version`\n- `allow-name`\n- `allow-tauri-version`\n- `allow-identifier`\n- `allow-bundle-type`\n- `allow-register-listener`\n- `allow-remove-listener`\n- `allow-supports-multiple-windows`"
src-tauri/gen/schemas/desktop-schema.json:372:          "description": "Default permissions for the plugin, which enables all commands.\n#### This default permission set includes:\n\n- `allow-listen`\n- `allow-unlisten`\n- `allow-emit`\n- `allow-emit-to`",
src-tauri/gen/schemas/desktop-schema.json:375:          "markdownDescription": "Default permissions for the plugin, which enables all commands.\n#### This default permission set includes:\n\n- `allow-listen`\n- `allow-unlisten`\n- `allow-emit`\n- `allow-emit-to`"
src-tauri/gen/schemas/desktop-schema.json:426:          "description": "Default permissions for the plugin, which enables all commands.\n#### This default permission set includes:\n\n- `allow-new`\n- `allow-from-bytes`\n- `allow-from-path`\n- `allow-rgba`\n- `allow-size`",
src-tauri/gen/schemas/desktop-schema.json:429:          "markdownDescription": "Default permissions for the plugin, which enables all commands.\n#### This default permission set includes:\n\n- `allow-new`\n- `allow-from-bytes`\n- `allow-from-path`\n- `allow-rgba`\n- `allow-size`"
src-tauri/gen/schemas/desktop-schema.json:492:          "description": "Default permissions for the plugin, which enables all commands.\n#### This default permission set includes:\n\n- `allow-new`\n- `allow-append`\n- `allow-prepend`\n- `allow-insert`\n- `allow-remove`\n- `allow-remove-at`\n- `allow-items`\n- `allow-get`\n- `allow-popup`\n- `allow-create-default`\n- `allow-set-as-app-menu`\n- `allow-set-as-window-menu`\n- `allow-text`\n- `allow-set-text`\n- `allow-is-enabled`\n- `allow-set-enabled`\n- `allow-set-accelerator`\n- `allow-set-as-windows-menu-for-nsapp`\n- `allow-set-as-help-menu-for-nsapp`\n- `allow-is-checked`\n- `allow-set-checked`\n- `allow-set-icon`",
src-tauri/gen/schemas/desktop-schema.json:495:          "markdownDescription": "Default permissions for the plugin, which enables all commands.\n#### This default permission set includes:\n\n- `allow-new`\n- `allow-append`\n- `allow-prepend`\n- `allow-insert`\n- `allow-remove`\n- `allow-remove-at`\n- `allow-items`\n- `allow-get`\n- `allow-popup`\n- `allow-create-default`\n- `allow-set-as-app-menu`\n- `allow-set-as-window-menu`\n- `allow-text`\n- `allow-set-text`\n- `allow-is-enabled`\n- `allow-set-enabled`\n- `allow-set-accelerator`\n- `allow-set-as-windows-menu-for-nsapp`\n- `allow-set-as-help-menu-for-nsapp`\n- `allow-is-checked`\n- `allow-set-checked`\n- `allow-set-icon`"
src-tauri/gen/schemas/desktop-schema.json:762:          "description": "Default permissions for the plugin, which enables all commands.\n#### This default permission set includes:\n\n- `allow-resolve-directory`\n- `allow-resolve`\n- `allow-normalize`\n- `allow-join`\n- `allow-dirname`\n- `allow-extname`\n- `allow-basename`\n- `allow-is-absolute`",
src-tauri/gen/schemas/desktop-schema.json:765:          "markdownDescription": "Default permissions for the plugin, which enables all commands.\n#### This default permission set includes:\n\n- `allow-resolve-directory`\n- `allow-resolve`\n- `allow-normalize`\n- `allow-join`\n- `allow-dirname`\n- `allow-extname`\n- `allow-basename`\n- `allow-is-absolute`"
src-tauri/gen/schemas/desktop-schema.json:864:          "description": "Default permissions for the plugin, which enables all commands.\n#### This default permission set includes:\n\n- `allow-close`",
src-tauri/gen/schemas/desktop-schema.json:867:          "markdownDescription": "Default permissions for the plugin, which enables all commands.\n#### This default permission set includes:\n\n- `allow-close`"
src-tauri/gen/schemas/desktop-schema.json:882:          "description": "Default permissions for the plugin, which enables all commands.\n#### This default permission set includes:\n\n- `allow-new`\n- `allow-get-by-id`\n- `allow-remove-by-id`\n- `allow-set-icon`\n- `allow-set-menu`\n- `allow-set-tooltip`\n- `allow-set-title`\n- `allow-set-visible`\n- `allow-set-temp-dir-path`\n- `allow-set-icon-as-template`\n- `allow-set-icon-with-as-template`\n- `allow-set-show-menu-on-left-click`",
src-tauri/gen/schemas/desktop-schema.json:885:          "markdownDescription": "Default permissions for the plugin, which enables all commands.\n#### This default permission set includes:\n\n- `allow-new`\n- `allow-get-by-id`\n- `allow-remove-by-id`\n- `allow-set-icon`\n- `allow-set-menu`\n- `allow-set-tooltip`\n- `allow-set-title`\n- `allow-set-visible`\n- `allow-set-temp-dir-path`\n- `allow-set-icon-as-template`\n- `allow-set-icon-with-as-template`\n- `allow-set-show-menu-on-left-click`"
src-tauri/gen/schemas/desktop-schema.json:1032:          "description": "Default permissions for the plugin.\n#### This default permission set includes:\n\n- `allow-get-all-webviews`\n- `allow-webview-position`\n- `allow-webview-size`\n- `allow-internal-toggle-devtools`",
src-tauri/gen/schemas/desktop-schema.json:1035:          "markdownDescription": "Default permissions for the plugin.\n#### This default permission set includes:\n\n- `allow-get-all-webviews`\n- `allow-webview-position`\n- `allow-webview-size`\n- `allow-internal-toggle-devtools`"
src-tauri/gen/schemas/desktop-schema.json:1254:          "description": "Default permissions for the plugin.\n#### This default permission set includes:\n\n- `allow-get-all-windows`\n- `allow-scale-factor`\n- `allow-inner-position`\n- `allow-outer-position`\n- `allow-inner-size`\n- `allow-outer-size`\n- `allow-is-fullscreen`\n- `allow-is-minimized`\n- `allow-is-maximized`\n- `allow-is-focused`\n- `allow-is-decorated`\n- `allow-is-resizable`\n- `allow-is-maximizable`\n- `allow-is-minimizable`\n- `allow-is-closable`\n- `allow-is-visible`\n- `allow-is-enabled`\n- `allow-title`\n- `allow-current-monitor`\n- `allow-primary-monitor`\n- `allow-monitor-from-point`\n- `allow-available-monitors`\n- `allow-cursor-position`\n- `allow-theme`\n- `allow-is-always-on-top`\n- `allow-activity-name`\n- `allow-scene-identifier`\n- `allow-internal-toggle-maximize`",
src-tauri/gen/schemas/desktop-schema.json:1257:          "markdownDescription": "Default permissions for the plugin.\n#### This default permission set includes:\n\n- `allow-get-all-windows`\n- `allow-scale-factor`\n- `allow-inner-position`\n- `allow-outer-position`\n- `allow-inner-size`\n- `allow-outer-size`\n- `allow-is-fullscreen`\n- `allow-is-minimized`\n- `allow-is-maximized`\n- `allow-is-focused`\n- `allow-is-decorated`\n- `allow-is-resizable`\n- `allow-is-maximizable`\n- `allow-is-minimizable`\n- `allow-is-closable`\n- `allow-is-visible`\n- `allow-is-enabled`\n- `allow-title`\n- `allow-current-monitor`\n- `allow-primary-monitor`\n- `allow-monitor-from-point`\n- `allow-available-monitors`\n- `allow-cursor-position`\n- `allow-theme`\n- `allow-is-always-on-top`\n- `allow-activity-name`\n- `allow-scene-identifier`\n- `allow-internal-toggle-maximize`"
src-tauri/capabilities/default.json:5:  "permissions": [
src-tauri/gen/schemas/acl-manifests.json:1:{"core":{"default_permission":{"identifier":"default","description":"Default core plugins set.","permissions":["core:path:default","core:event:default","core:window:default","core:webview:default","core:app:default","core:image:default","core:resources:default","core:menu:default","core:tray:default"]},"permissions":{},"permission_sets":{},"global_scope_schema":null},"core:app":{"default_permission":{"identifier":"default","description":"Default permissions for the plugin.","permissions":["allow-version","allow-name","allow-tauri-version","allow-identifier","allow-bundle-type","allow-register-listener","allow-remove-listener","allow-supports-multiple-windows"]},"permissions":{"allow-app-hide":{"identifier":"allow-app-hide","description":"Enables the app_hide command without any pre-configured scope.","commands":{"allow":["app_hide"],"deny":[]}},"allow-app-show":{"identifier":"allow-app-show","description":"Enables the app_show command without any pre-configured scope.","commands":{"allow":["app_show"],"deny":[]}},"allow-bundle-type":{"identifier":"allow-bundle-type","description":"Enables the bundle_type command without any pre-configured scope.","commands":{"allow":["bundle_type"],"deny":[]}},"allow-default-window-icon":{"identifier":"allow-default-window-icon","description":"Enables the default_window_icon command without any pre-configured scope.","commands":{"allow":["default_window_icon"],"deny":[]}},"allow-fetch-data-store-identifiers":{"identifier":"allow-fetch-data-store-identifiers","description":"Enables the fetch_data_store_identifiers command without any pre-configured scope.","commands":{"allow":["fetch_data_store_identifiers"],"deny":[]}},"allow-identifier":{"identifier":"allow-identifier","description":"Enables the identifier command without any pre-configured scope.","commands":{"allow":["identifier"],"deny":[]}},"allow-name":{"identifier":"allow-name","description":"Enables the name command without any pre-configured scope.","commands":{"allow":["name"],"deny":[]}},"allow-register-listener":{"identifier":"allow-register-listener","description":"Enables the register_listener command without any pre-configured scope.","commands":{"allow":["register_listener"],"deny":[]}},"allow-remove-data-store":{"identifier":"allow-remove-data-store","description":"Enables the remove_data_store command without any pre-configured scope.","commands":{"allow":["remove_data_store"],"deny":[]}},"allow-remove-listener":{"identifier":"allow-remove-listener","description":"Enables the remove_listener command without any pre-configured scope.","commands":{"allow":["remove_listener"],"deny":[]}},"allow-set-app-theme":{"identifier":"allow-set-app-theme","description":"Enables the set_app_theme command without any pre-configured scope.","commands":{"allow":["set_app_theme"],"deny":[]}},"allow-set-dock-visibility":{"identifier":"allow-set-dock-visibility","description":"Enables the set_dock_visibility command without any pre-configured scope.","commands":{"allow":["set_dock_visibility"],"deny":[]}},"allow-supports-multiple-windows":{"identifier":"allow-supports-multiple-windows","description":"Enables the supports_multiple_windows command without any pre-configured scope.","commands":{"allow":["supports_multiple_windows"],"deny":[]}},"allow-tauri-version":{"identifier":"allow-tauri-version","description":"Enables the tauri_version command without any pre-configured scope.","commands":{"allow":["tauri_version"],"deny":[]}},"allow-version":{"identifier":"allow-version","description":"Enables the version command without any pre-configured scope.","commands":{"allow":["version"],"deny":[]}},"deny-app-hide":{"identifier":"deny-app-hide","description":"Denies the app_hide command without any pre-configured scope.","commands":{"allow":[],"deny":["app_hide"]}},"deny-app-show":{"identifier":"deny-app-show","description":"Denies the app_show command without any pre-configured scope.","commands":{"allow":[],"deny":["app_show"]}},"deny-bundle-type":{"identifier":"deny-bundle-type","description":"Denies the bundle_type command without any pre-configured scope.","commands":{"allow":[],"deny":["bundle_type"]}},"deny-default-window-icon":{"identifier":"deny-default-window-icon","description":"Denies the default_window_icon command without any pre-configured scope.","commands":{"allow":[],"deny":["default_window_icon"]}},"deny-fetch-data-store-identifiers":{"identifier":"deny-fetch-data-store-identifiers","description":"Denies the fetch_data_store_identifiers command without any pre-configured scope.","commands":{"allow":[],"deny":["fetch_data_store_identifiers"]}},"deny-identifier":{"identifier":"deny-identifier","description":"Denies the identifier command without any pre-configured scope.","commands":{"allow":[],"deny":["identifier"]}},"deny-name":{"identifier":"deny-name","description":"Denies the name command without any pre-configured scope.","commands":{"allow":[],"deny":["name"]}},"deny-register-listener":{"identifier":"deny-register-listener","description":"Denies the register_listener command without any pre-configured scope.","commands":{"allow":[],"deny":["register_listener"]}},"deny-remove-data-store":{"identifier":"deny-remove-data-store","description":"Denies the remove_data_store command without any pre-configured scope.","commands":{"allow":[],"deny":["remove_data_store"]}},"deny-remove-listener":{"identifier":"deny-remove-listener","description":"Denies the remove_listener command without any pre-configured scope.","commands":{"allow":[],"deny":["remove_listener"]}},"deny-set-app-theme":{"identifier":"deny-set-app-theme","description":"Denies the set_app_theme command without any pre-configured scope.","commands":{"allow":[],"deny":["set_app_theme"]}},"deny-set-dock-visibility":{"identifier":"deny-set-dock-visibility","description":"Denies the set_dock_visibility command without any pre-configured scope.","commands":{"allow":[],"deny":["set_dock_visibility"]}},"deny-supports-multiple-windows":{"identifier":"deny-supports-multiple-windows","description":"Denies the supports_multiple_windows command without any pre-configured scope.","commands":{"allow":[],"deny":["supports_multiple_windows"]}},"deny-tauri-version":{"identifier":"deny-tauri-version","description":"Denies the tauri_version command without any pre-configured scope.","commands":{"allow":[],"deny":["tauri_version"]}},"deny-version":{"identifier":"deny-version","description":"Denies the version command without any pre-configured scope.","commands":{"allow":[],"deny":["version"]}}},"permission_sets":{},"global_scope_schema":null},"core:event":{"default_permission":{"identifier":"default","description":"Default permissions for the plugin, which enables all commands.","permissions":["allow-listen","allow-unlisten","allow-emit","allow-emit-to"]},"permissions":{"allow-emit":{"identifier":"allow-emit","description":"Enables the emit command without any pre-configured scope.","commands":{"allow":["emit"],"deny":[]}},"allow-emit-to":{"identifier":"allow-emit-to","description":"Enables the emit_to command without any pre-configured scope.","commands":{"allow":["emit_to"],"deny":[]}},"allow-listen":{"identifier":"allow-listen","description":"Enables the listen command without any pre-configured scope.","commands":{"allow":["listen"],"deny":[]}},"allow-unlisten":{"identifier":"allow-unlisten","description":"Enables the unlisten command without any pre-configured scope.","commands":{"allow":["unlisten"],"deny":[]}},"deny-emit":{"identifier":"deny-emit","description":"Denies the emit command without any pre-configured scope.","commands":{"allow":[],"deny":["emit"]}},"deny-emit-to":{"identifier":"deny-emit-to","description":"Denies the emit_to command without any pre-configured scope.","commands":{"allow":[],"deny":["emit_to"]}},"deny-listen":{"identifier":"deny-listen","description":"Denies the listen command without any pre-configured scope.","commands":{"allow":[],"deny":["listen"]}},"deny-unlisten":{"identifier":"deny-unlisten","description":"Denies the unlisten command without any pre-configured scope.","commands":{"allow":[],"deny":["unlisten"]}}},"permission_sets":{},"global_scope_schema":null},"core:image":{"default_permission":{"identifier":"default","description":"Default permissions for the plugin, which enables all commands.","permissions":["allow-new","allow-from-bytes","allow-from-path","allow-rgba","allow-size"]},"permissions":{"allow-from-bytes":{"identifier":"allow-from-bytes","description":"Enables the from_bytes command without any pre-configured scope.","commands":{"allow":["from_bytes"],"deny":[]}},"allow-from-path":{"identifier":"allow-from-path","description":"Enables the from_path command without any pre-configured scope.","commands":{"allow":["from_path"],"deny":[]}},"allow-new":{"identifier":"allow-new","description":"Enables the new command without any pre-configured scope.","commands":{"allow":["new"],"deny":[]}},"allow-rgba":{"identifier":"allow-rgba","description":"Enables the rgba command without any pre-configured scope.","commands":{"allow":["rgba"],"deny":[]}},"allow-size":{"identifier":"allow-size","description":"Enables the size command without any pre-configured scope.","commands":{"allow":["size"],"deny":[]}},"deny-from-bytes":{"identifier":"deny-from-bytes","description":"Denies the from_bytes command without any pre-configured scope.","commands":{"allow":[],"deny":["from_bytes"]}},"deny-from-path":{"identifier":"deny-from-path","description":"Denies the from_path command without any pre-configured scope.","commands":{"allow":[],"deny":["from_path"]}},"deny-new":{"identifier":"deny-new","description":"Denies the new command without any pre-configured scope.","commands":{"allow":[],"deny":["new"]}},"deny-rgba":{"identifier":"deny-rgba","description":"Denies the rgba command without any pre-configured scope.","commands":{"allow":[],"deny":["rgba"]}},"deny-size":{"identifier":"deny-size","description":"Denies the size command without any pre-configured scope.","commands":{"allow":[],"deny":["size"]}}},"permission_sets":{},"global_scope_schema":null},"core:menu":{"default_permission":{"identifier":"default","description":"Default permissions for the plugin, which enables all commands.","permissions":["allow-new","allow-append","allow-prepend","allow-insert","allow-remove","allow-remove-at","allow-items","allow-get","allow-popup","allow-create-default","allow-set-as-app-menu","allow-set-as-window-menu","allow-text","allow-set-text","allow-is-enabled","allow-set-enabled","allow-set-accelerator","allow-set-as-windows-menu-for-nsapp","allow-set-as-help-menu-for-nsapp","allow-is-checked","allow-set-checked","allow-set-icon"]},"permissions":{"allow-append":{"identifier":"allow-append","description":"Enables the append command without any pre-configured scope.","commands":{"allow":["append"],"deny":[]}},"allow-create-default":{"identifier":"allow-create-default","description":"Enables the create_default command without any pre-configured scope.","commands":{"allow":["create_default"],"deny":[]}},"allow-get":{"identifier":"allow-get","description":"Enables the get command without any pre-configured scope.","commands":{"allow":["get"],"deny":[]}},"allow-insert":{"identifier":"allow-insert","description":"Enables the insert command without any pre-configured scope.","commands":{"allow":["insert"],"deny":[]}},"allow-is-checked":{"identifier":"allow-is-checked","description":"Enables the is_checked command without any pre-configured scope.","commands":{"allow":["is_checked"],"deny":[]}},"allow-is-enabled":{"identifier":"allow-is-enabled","description":"Enables the is_enabled command without any pre-configured scope.","commands":{"allow":["is_enabled"],"deny":[]}},"allow-items":{"identifier":"allow-items","description":"Enables the items command without any pre-configured scope.","commands":{"allow":["items"],"deny":[]}},"allow-new":{"identifier":"allow-new","description":"Enables the new command without any pre-configured scope.","commands":{"allow":["new"],"deny":[]}},"allow-popup":{"identifier":"allow-popup","description":"Enables the popup command without any pre-configured scope.","commands":{"allow":["popup"],"deny":[]}},"allow-prepend":{"identifier":"allow-prepend","description":"Enables the prepend command without any pre-configured scope.","commands":{"allow":["prepend"],"deny":[]}},"allow-remove":{"identifier":"allow-remove","description":"Enables the remove command without any pre-configured scope.","commands":{"allow":["remove"],"deny":[]}},"allow-remove-at":{"identifier":"allow-remove-at","description":"Enables the remove_at command without any pre-configured scope.","commands":{"allow":["remove_at"],"deny":[]}},"allow-set-accelerator":{"identifier":"allow-set-accelerator","description":"Enables the set_accelerator command without any pre-configured scope.","commands":{"allow":["set_accelerator"],"deny":[]}},"allow-set-as-app-menu":{"identifier":"allow-set-as-app-menu","description":"Enables the set_as_app_menu command without any pre-configured scope.","commands":{"allow":["set_as_app_menu"],"deny":[]}},"allow-set-as-help-menu-for-nsapp":{"identifier":"allow-set-as-help-menu-for-nsapp","description":"Enables the set_as_help_menu_for_nsapp command without any pre-configured scope.","commands":{"allow":["set_as_help_menu_for_nsapp"],"deny":[]}},"allow-set-as-window-menu":{"identifier":"allow-set-as-window-menu","description":"Enables the set_as_window_menu command without any pre-configured scope.","commands":{"allow":["set_as_window_menu"],"deny":[]}},"allow-set-as-windows-menu-for-nsapp":{"identifier":"allow-set-as-windows-menu-for-nsapp","description":"Enables the set_as_windows_menu_for_nsapp command without any pre-configured scope.","commands":{"allow":["set_as_windows_menu_for_nsapp"],"deny":[]}},"allow-set-checked":{"identifier":"allow-set-checked","description":"Enables the set_checked command without any pre-configured scope.","commands":{"allow":["set_checked"],"deny":[]}},"allow-set-enabled":{"identifier":"allow-set-enabled","description":"Enables the set_enabled command without any pre-configured scope.","commands":{"allow":["set_enabled"],"deny":[]}},"allow-set-icon":{"identifier":"allow-set-icon","description":"Enables the set_icon command without any pre-configured scope.","commands":{"allow":["set_icon"],"deny":[]}},"allow-set-text":{"identifier":"allow-set-text","description":"Enables the set_text command without any pre-configured scope.","commands":{"allow":["set_text"],"deny":[]}},"allow-text":{"identifier":"allow-text","description":"Enables the text command without any pre-configured scope.","commands":{"allow":["text"],"deny":[]}},"deny-append":{"identifier":"deny-append","description":"Denies the append command without any pre-configured scope.","commands":{"allow":[],"deny":["append"]}},"deny-create-default":{"identifier":"deny-create-default","description":"Denies the create_default command without any pre-configured scope.","commands":{"allow":[],"deny":["create_default"]}},"deny-get":{"identifier":"deny-get","description":"Denies the get command without any pre-configured scope.","commands":{"allow":[],"deny":["get"]}},"deny-insert":{"identifier":"deny-insert","description":"Denies the insert command without any pre-configured scope.","commands":{"allow":[],"deny":["insert"]}},"deny-is-checked":{"identifier":"deny-is-checked","description":"Denies the is_checked command without any pre-configured scope.","commands":{"allow":[],"deny":["is_checked"]}},"deny-is-enabled":{"identifier":"deny-is-enabled","description":"Denies the is_enabled command without any pre-configured scope.","commands":{"allow":[],"deny":["is_enabled"]}},"deny-items":{"identifier":"deny-items","description":"Denies the items command without any pre-configured scope.","commands":{"allow":[],"deny":["items"]}},"deny-new":{"identifier":"deny-new","description":"Denies the new command without any pre-configured scope.","commands":{"allow":[],"deny":["new"]}},"deny-popup":{"identifier":"deny-popup","description":"Denies the popup command without any pre-configured scope.","commands":{"allow":[],"deny":["popup"]}},"deny-prepend":{"identifier":"deny-prepend","description":"Denies the prepend command without any pre-configured scope.","commands":{"allow":[],"deny":["prepend"]}},"deny-remove":{"identifier":"deny-remove","description":"Denies the remove command without any pre-configured scope.","commands":{"allow":[],"deny":["remove"]}},"deny-remove-at":{"identifier":"deny-remove-at","description":"Denies the remove_at command without any pre-configured scope.","commands":{"allow":[],"deny":["remove_at"]}},"deny-set-accelerator":{"identifier":"deny-set-accelerator","description":"Denies the set_accelerator command without any pre-configured scope.","commands":{"allow":[],"deny":["set_accelerator"]}},"deny-set-as-app-menu":{"identifier":"deny-set-as-app-menu","description":"Denies the set_as_app_menu command without any pre-configured scope.","commands":{"allow":[],"deny":["set_as_app_menu"]}},"deny-set-as-help-menu-for-nsapp":{"identifier":"deny-set-as-help-menu-for-nsapp","description":"Denies the set_as_help_menu_for_nsapp command without any pre-configured scope.","commands":{"allow":[],"deny":["set_as_help_menu_for_nsapp"]}},"deny-set-as-window-menu":{"identifier":"deny-set-as-window-menu","description":"Denies the set_as_window_menu command without any pre-configured scope.","commands":{"allow":[],"deny":["set_as_window_menu"]}},"deny-set-as-windows-menu-for-nsapp":{"identifier":"deny-set-as-windows-menu-for-nsapp","description":"Denies the set_as_windows_menu_for_nsapp command without any pre-configured scope.","commands":{"allow":[],"deny":["set_as_windows_menu_for_nsapp"]}},"deny-set-checked":{"identifier":"deny-set-checked","description":"Denies the set_checked command without any pre-configured scope.","commands":{"allow":[],"deny":["set_checked"]}},"deny-set-enabled":{"identifier":"deny-set-enabled","description":"Denies the set_enabled command without any pre-configured scope.","commands":{"allow":[],"deny":["set_enabled"]}},"deny-set-icon":{"identifier":"deny-set-icon","description":"Denies the set_icon command without any pre-configured scope.","commands":{"allow":[],"deny":["set_icon"]}},"deny-set-text":{"identifier":"deny-set-text","description":"Denies the set_text command without any pre-configured scope.","commands":{"allow":[],"deny":["set_text"]}},"deny-text":{"identifier":"deny-text","description":"Denies the text command without any pre-configured scope.","commands":{"allow":[],"deny":["text"]}}},"permission_sets":{},"global_scope_schema":null},"core:path":{"default_permission":{"identifier":"default","description":"Default permissions for the plugin, which enables all commands.","permissions":["allow-resolve-directory","allow-resolve","allow-normalize","allow-join","allow-dirname","allow-extname","allow-basename","allow-is-absolute"]},"permissions":{"allow-basename":{"identifier":"allow-basename","description":"Enables the basename command without any pre-configured scope.","commands":{"allow":["basename"],"deny":[]}},"allow-dirname":{"identifier":"allow-dirname","description":"Enables the dirname command without any pre-configured scope.","commands":{"allow":["dirname"],"deny":[]}},"allow-extname":{"identifier":"allow-extname","description":"Enables the extname command without any pre-configured scope.","commands":{"allow":["extname"],"deny":[]}},"allow-is-absolute":{"identifier":"allow-is-absolute","description":"Enables the is_absolute command without any pre-configured scope.","commands":{"allow":["is_absolute"],"deny":[]}},"allow-join":{"identifier":"allow-join","description":"Enables the join command without any pre-configured scope.","commands":{"allow":["join"],"deny":[]}},"allow-normalize":{"identifier":"allow-normalize","description":"Enables the normalize command without any pre-configured scope.","commands":{"allow":["normalize"],"deny":[]}},"allow-resolve":{"identifier":"allow-resolve","description":"Enables the resolve command without any pre-configured scope.","commands":{"allow":["resolve"],"deny":[]}},"allow-resolve-directory":{"identifier":"allow-resolve-directory","description":"Enables the resolve_directory command without any pre-configured scope.","commands":{"allow":["resolve_directory"],"deny":[]}},"deny-basename":{"identifier":"deny-basename","description":"Denies the basename command without any pre-configured scope.","commands":{"allow":[],"deny":["basename"]}},"deny-dirname":{"identifier":"deny-dirname","description":"Denies the dirname command without any pre-configured scope.","commands":{"allow":[],"deny":["dirname"]}},"deny-extname":{"identifier":"deny-extname","description":"Denies the extname command without any pre-configured scope.","commands":{"allow":[],"deny":["extname"]}},"deny-is-absolute":{"identifier":"deny-is-absolute","description":"Denies the is_absolute command without any pre-configured scope.","commands":{"allow":[],"deny":["is_absolute"]}},"deny-join":{"identifier":"deny-join","description":"Denies the join command without any pre-configured scope.","commands":{"allow":[],"deny":["join"]}},"deny-normalize":{"identifier":"deny-normalize","description":"Denies the normalize command without any pre-configured scope.","commands":{"allow":[],"deny":["normalize"]}},"deny-resolve":{"identifier":"deny-resolve","description":"Denies the resolve command without any pre-configured scope.","commands":{"allow":[],"deny":["resolve"]}},"deny-resolve-directory":{"identifier":"deny-resolve-directory","description":"Denies the resolve_directory command without any pre-configured scope.","commands":{"allow":[],"deny":["resolve_directory"]}}},"permission_sets":{},"global_scope_schema":null},"core:resources":{"default_permission":{"identifier":"default","description":"Default permissions for the plugin, which enables all commands.","permissions":["allow-close"]},"permissions":{"allow-close":{"identifier":"allow-close","description":"Enables the close command without any pre-configured scope.","commands":{"allow":["close"],"deny":[]}},"deny-close":{"identifier":"deny-close","description":"Denies the close command without any pre-configured scope.","commands":{"allow":[],"deny":["close"]}}},"permission_sets":{},"global_scope_schema":null},"core:tray":{"default_permission":{"identifier":"default","description":"Default permissions for the plugin, which enables all commands.","permissions":["allow-new","allow-get-by-id","allow-remove-by-id","allow-set-icon","allow-set-menu","allow-set-tooltip","allow-set-title","allow-set-visible","allow-set-temp-dir-path","allow-set-icon-as-template","allow-set-icon-with-as-template","allow-set-show-menu-on-left-click"]},"permissions":{"allow-get-by-id":{"identifier":"allow-get-by-id","description":"Enables the get_by_id command without any pre-configured scope.","commands":{"allow":["get_by_id"],"deny":[]}},"allow-new":{"identifier":"allow-new","description":"Enables the new command without any pre-configured scope.","commands":{"allow":["new"],"deny":[]}},"allow-remove-by-id":{"identifier":"allow-remove-by-id","description":"Enables the remove_by_id command without any pre-configured scope.","commands":{"allow":["remove_by_id"],"deny":[]}},"allow-set-icon":{"identifier":"allow-set-icon","description":"Enables the set_icon command without any pre-configured scope.","commands":{"allow":["set_icon"],"deny":[]}},"allow-set-icon-as-template":{"identifier":"allow-set-icon-as-template","description":"Enables the set_icon_as_template command without any pre-configured scope.","commands":{"allow":["set_icon_as_template"],"deny":[]}},"allow-set-icon-with-as-template":{"identifier":"allow-set-icon-with-as-template","description":"Enables the set_icon_with_as_template command without any pre-configured scope.","commands":{"allow":["set_icon_with_as_template"],"deny":[]}},"allow-set-menu":{"identifier":"allow-set-menu","description":"Enables the set_menu command without any pre-configured scope.","commands":{"allow":["set_menu"],"deny":[]}},"allow-set-show-menu-on-left-click":{"identifier":"allow-set-show-menu-on-left-click","description":"Enables the set_show_menu_on_left_click command without any pre-configured scope.","commands":{"allow":["set_show_menu_on_left_click"],"deny":[]}},"allow-set-temp-dir-path":{"identifier":"allow-set-temp-dir-path","description":"Enables the set_temp_dir_path command without any pre-configured scope.","commands":{"allow":["set_temp_dir_path"],"deny":[]}},"allow-set-title":{"identifier":"allow-set-title","description":"Enables the set_title command without any pre-configured scope.","commands":{"allow":["set_title"],"deny":[]}},"allow-set-tooltip":{"identifier":"allow-set-tooltip","description":"Enables the set_tooltip command without any pre-configured scope.","commands":{"allow":["set_tooltip"],"deny":[]}},"allow-set-visible":{"identifier":"allow-set-visible","description":"Enables the set_visible command without any pre-configured scope.","commands":{"allow":["set_visible"],"deny":[]}},"deny-get-by-id":{"identifier":"deny-get-by-id","description":"Denies the get_by_id command without any pre-configured scope.","commands":{"allow":[],"deny":["get_by_id"]}},"deny-new":{"identifier":"deny-new","description":"Denies the new command without any pre-configured scope.","commands":{"allow":[],"deny":["new"]}},"deny-remove-by-id":{"identifier":"deny-remove-by-id","description":"Denies the remove_by_id command without any pre-configured scope.","commands":{"allow":[],"deny":["remove_by_id"]}},"deny-set-icon":{"identifier":"deny-set-icon","description":"Denies the set_icon command without any pre-configured scope.","commands":{"allow":[],"deny":["set_icon"]}},"deny-set-icon-as-template":{"identifier":"deny-set-icon-as-template","description":"Denies the set_icon_as_template command without any pre-configured scope.","commands":{"allow":[],"deny":["set_icon_as_template"]}},"deny-set-icon-with-as-template":{"identifier":"deny-set-icon-with-as-template","description":"Denies the set_icon_with_as_template command without any pre-configured scope.","commands":{"allow":[],"deny":["set_icon_with_as_template"]}},"deny-set-menu":{"identifier":"deny-set-menu","description":"Denies the set_menu command without any pre-configured scope.","commands":{"allow":[],"deny":["set_menu"]}},"deny-set-show-menu-on-left-click":{"identifier":"deny-set-show-menu-on-left-click","description":"Denies the set_show_menu_on_left_click command without any pre-configured scope.","commands":{"allow":[],"deny":["set_show_menu_on_left_click"]}},"deny-set-temp-dir-path":{"identifier":"deny-set-temp-dir-path","description":"Denies the set_temp_dir_path command without any pre-configured scope.","commands":{"allow":[],"deny":["set_temp_dir_path"]}},"deny-set-title":{"identifier":"deny-set-title","description":"Denies the set_title command without any pre-configured scope.","commands":{"allow":[],"deny":["set_title"]}},"deny-set-tooltip":{"identifier":"deny-set-tooltip","description":"Denies the set_tooltip command without any pre-configured scope.","commands":{"allow":[],"deny":["set_tooltip"]}},"deny-set-visible":{"identifier":"deny-set-visible","description":"Denies the set_visible command without any pre-configured scope.","commands":{"allow":[],"deny":["set_visible"]}}},"permission_sets":{},"global_scope_schema":null},"core:webview":{"default_permission":{"identifier":"default","description":"Default permissions for the plugin.","permissions":["allow-get-all-webviews","allow-webview-position","allow-webview-size","allow-internal-toggle-devtools"]},"permissions":{"allow-clear-all-browsing-data":{"identifier":"allow-clear-all-browsing-data","description":"Enables the clear_all_browsing_data command without any pre-configured scope.","commands":{"allow":["clear_all_browsing_data"],"deny":[]}},"allow-create-webview":{"identifier":"allow-create-webview","description":"Enables the create_webview command without any pre-configured scope.","commands":{"allow":["create_webview"],"deny":[]}},"allow-create-webview-window":{"identifier":"allow-create-webview-window","description":"Enables the create_webview_window command without any pre-configured scope.","commands":{"allow":["create_webview_window"],"deny":[]}},"allow-get-all-webviews":{"identifier":"allow-get-all-webviews","description":"Enables the get_all_webviews command without any pre-configured scope.","commands":{"allow":["get_all_webviews"],"deny":[]}},"allow-internal-toggle-devtools":{"identifier":"allow-internal-toggle-devtools","description":"Enables the internal_toggle_devtools command without any pre-configured scope.","commands":{"allow":["internal_toggle_devtools"],"deny":[]}},"allow-print":{"identifier":"allow-print","description":"Enables the print command without any pre-configured scope.","commands":{"allow":["print"],"deny":[]}},"allow-reparent":{"identifier":"allow-reparent","description":"Enables the reparent command without any pre-configured scope.","commands":{"allow":["reparent"],"deny":[]}},"allow-set-webview-auto-resize":{"identifier":"allow-set-webview-auto-resize","description":"Enables the set_webview_auto_resize command without any pre-configured scope.","commands":{"allow":["set_webview_auto_resize"],"deny":[]}},"allow-set-webview-background-color":{"identifier":"allow-set-webview-background-color","description":"Enables the set_webview_background_color command without any pre-configured scope.","commands":{"allow":["set_webview_background_color"],"deny":[]}},"allow-set-webview-focus":{"identifier":"allow-set-webview-focus","description":"Enables the set_webview_focus command without any pre-configured scope.","commands":{"allow":["set_webview_focus"],"deny":[]}},"allow-set-webview-position":{"identifier":"allow-set-webview-position","description":"Enables the set_webview_position command without any pre-configured scope.","commands":{"allow":["set_webview_position"],"deny":[]}},"allow-set-webview-size":{"identifier":"allow-set-webview-size","description":"Enables the set_webview_size command without any pre-configured scope.","commands":{"allow":["set_webview_size"],"deny":[]}},"allow-set-webview-zoom":{"identifier":"allow-set-webview-zoom","description":"Enables the set_webview_zoom command without any pre-configured scope.","commands":{"allow":["set_webview_zoom"],"deny":[]}},"allow-webview-close":{"identifier":"allow-webview-close","description":"Enables the webview_close command without any pre-configured scope.","commands":{"allow":["webview_close"],"deny":[]}},"allow-webview-hide":{"identifier":"allow-webview-hide","description":"Enables the webview_hide command without any pre-configured scope.","commands":{"allow":["webview_hide"],"deny":[]}},"allow-webview-position":{"identifier":"allow-webview-position","description":"Enables the webview_position command without any pre-configured scope.","commands":{"allow":["webview_position"],"deny":[]}},"allow-webview-show":{"identifier":"allow-webview-show","description":"Enables the webview_show command without any pre-configured scope.","commands":{"allow":["webview_show"],"deny":[]}},"allow-webview-size":{"identifier":"allow-webview-size","description":"Enables the webview_size command without any pre-configured scope.","commands":{"allow":["webview_size"],"deny":[]}},"deny-clear-all-browsing-data":{"identifier":"deny-clear-all-browsing-data","description":"Denies the clear_all_browsing_data command without any pre-configured scope.","commands":{"allow":[],"deny":["clear_all_browsing_data"]}},"deny-create-webview":{"identifier":"deny-create-webview","description":"Denies the create_webview command without any pre-configured scope.","commands":{"allow":[],"deny":["create_webview"]}},"deny-create-webview-window":{"identifier":"deny-create-webview-window","description":"Denies the create_webview_window command without any pre-configured scope.","commands":{"allow":[],"deny":["create_webview_window"]}},"deny-get-all-webviews":{"identifier":"deny-get-all-webviews","description":"Denies the get_all_webviews command without any pre-configured scope.","commands":{"allow":[],"deny":["get_all_webviews"]}},"deny-internal-toggle-devtools":{"identifier":"deny-internal-toggle-devtools","description":"Denies the internal_toggle_devtools command without any pre-configured scope.","commands":{"allow":[],"deny":["internal_toggle_devtools"]}},"deny-print":{"identifier":"deny-print","description":"Denies the print command without any pre-configured scope.","commands":{"allow":[],"deny":["print"]}},"deny-reparent":{"identifier":"deny-reparent","description":"Denies the reparent command without any pre-configured scope.","commands":{"allow":[],"deny":["reparent"]}},"deny-set-webview-auto-resize":{"identifier":"deny-set-webview-auto-resize","description":"Denies the set_webview_auto_resize command without any pre-configured scope.","commands":{"allow":[],"deny":["set_webview_auto_resize"]}},"deny-set-webview-background-color":{"identifier":"deny-set-webview-background-color","description":"Denies the set_webview_background_color command without any pre-configured scope.","commands":{"allow":[],"deny":["set_webview_background_color"]}},"deny-set-webview-focus":{"identifier":"deny-set-webview-focus","description":"Denies the set_webview_focus command without any pre-configured scope.","commands":{"allow":[],"deny":["set_webview_focus"]}},"deny-set-webview-position":{"identifier":"deny-set-webview-position","description":"Denies the set_webview_position command without any pre-configured scope.","commands":{"allow":[],"deny":["set_webview_position"]}},"deny-set-webview-size":{"identifier":"deny-set-webview-size","description":"Denies the set_webview_size command without any pre-configured scope.","commands":{"allow":[],"deny":["set_webview_size"]}},"deny-set-webview-zoom":{"identifier":"deny-set-webview-zoom","description":"Denies the set_webview_zoom command without any pre-configured scope.","commands":{"allow":[],"deny":["set_webview_zoom"]}},"deny-webview-close":{"identifier":"deny-webview-close","description":"Denies the webview_close command without any pre-configured scope.","commands":{"allow":[],"deny":["webview_close"]}},"deny-webview-hide":{"identifier":"deny-webview-hide","description":"Denies the webview_hide command without any pre-configured scope.","commands":{"allow":[],"deny":["webview_hide"]}},"deny-webview-position":{"identifier":"deny-webview-position","description":"Denies the webview_position command without any pre-configured scope.","commands":{"allow":[],"deny":["webview_position"]}},"deny-webview-show":{"identifier":"deny-webview-show","description":"Denies the webview_show command without any pre-configured scope.","commands":{"allow":[],"deny":["webview_show"]}},"deny-webview-size":{"identifier":"deny-webview-size","description":"Denies the webview_size command without any pre-configured scope.","commands":{"allow":[],"deny":["webview_size"]}}},"permission_sets":{},"global_scope_schema":null},"core:window":{"default_permission":{"identifier":"default","description":"Default permissions for the plugin.","permissions":["allow-get-all-windows","allow-scale-factor","allow-inner-position","allow-outer-position","allow-inner-size","allow-outer-size","allow-is-fullscreen","allow-is-minimized","allow-is-maximized","allow-is-focused","allow-is-decorated","allow-is-resizable","allow-is-maximizable","allow-is-minimizable","allow-is-closable","allow-is-visible","allow-is-enabled","allow-title","allow-current-monitor","allow-primary-monitor","allow-monitor-from-point","allow-available-monitors","allow-cursor-position","allow-theme","allow-is-always-on-top","allow-activity-name","allow-scene-identifier","allow-internal-toggle-maximize"]},"permissions":{"allow-activity-name":{"identifier":"allow-activity-name","description":"Enables the activity_name command without any pre-configured scope.","commands":{"allow":["activity_name"],"deny":[]}},"allow-available-monitors":{"identifier":"allow-available-monitors","description":"Enables the available_monitors command without any pre-configured scope.","commands":{"allow":["available_monitors"],"deny":[]}},"allow-center":{"identifier":"allow-center","description":"Enables the center command without any pre-configured scope.","commands":{"allow":["center"],"deny":[]}},"allow-close":{"identifier":"allow-close","description":"Enables the close command without any pre-configured scope.","commands":{"allow":["close"],"deny":[]}},"allow-create":{"identifier":"allow-create","description":"Enables the create command without any pre-configured scope.","commands":{"allow":["create"],"deny":[]}},"allow-current-monitor":{"identifier":"allow-current-monitor","description":"Enables the current_monitor command without any pre-configured scope.","commands":{"allow":["current_monitor"],"deny":[]}},"allow-cursor-position":{"identifier":"allow-cursor-position","description":"Enables the cursor_position command without any pre-configured scope.","commands":{"allow":["cursor_position"],"deny":[]}},"allow-destroy":{"identifier":"allow-destroy","description":"Enables the destroy command without any pre-configured scope.","commands":{"allow":["destroy"],"deny":[]}},"allow-get-all-windows":{"identifier":"allow-get-all-windows","description":"Enables the get_all_windows command without any pre-configured scope.","commands":{"allow":["get_all_windows"],"deny":[]}},"allow-hide":{"identifier":"allow-hide","description":"Enables the hide command without any pre-configured scope.","commands":{"allow":["hide"],"deny":[]}},"allow-inner-position":{"identifier":"allow-inner-position","description":"Enables the inner_position command without any pre-configured scope.","commands":{"allow":["inner_position"],"deny":[]}},"allow-inner-size":{"identifier":"allow-inner-size","description":"Enables the inner_size command without any pre-configured scope.","commands":{"allow":["inner_size"],"deny":[]}},"allow-internal-toggle-maximize":{"identifier":"allow-internal-toggle-maximize","description":"Enables the internal_toggle_maximize command without any pre-configured scope.","commands":{"allow":["internal_toggle_maximize"],"deny":[]}},"allow-is-always-on-top":{"identifier":"allow-is-always-on-top","description":"Enables the is_always_on_top command without any pre-configured scope.","commands":{"allow":["is_always_on_top"],"deny":[]}},"allow-is-closable":{"identifier":"allow-is-closable","description":"Enables the is_closable command without any pre-configured scope.","commands":{"allow":["is_closable"],"deny":[]}},"allow-is-decorated":{"identifier":"allow-is-decorated","description":"Enables the is_decorated command without any pre-configured scope.","commands":{"allow":["is_decorated"],"deny":[]}},"allow-is-enabled":{"identifier":"allow-is-enabled","description":"Enables the is_enabled command without any pre-configured scope.","commands":{"allow":["is_enabled"],"deny":[]}},"allow-is-focused":{"identifier":"allow-is-focused","description":"Enables the is_focused command without any pre-configured scope.","commands":{"allow":["is_focused"],"deny":[]}},"allow-is-fullscreen":{"identifier":"allow-is-fullscreen","description":"Enables the is_fullscreen command without any pre-configured scope.","commands":{"allow":["is_fullscreen"],"deny":[]}},"allow-is-maximizable":{"identifier":"allow-is-maximizable","description":"Enables the is_maximizable command without any pre-configured scope.","commands":{"allow":["is_maximizable"],"deny":[]}},"allow-is-maximized":{"identifier":"allow-is-maximized","description":"Enables the is_maximized command without any pre-configured scope.","commands":{"allow":["is_maximized"],"deny":[]}},"allow-is-minimizable":{"identifier":"allow-is-minimizable","description":"Enables the is_minimizable command without any pre-configured scope.","commands":{"allow":["is_minimizable"],"deny":[]}},"allow-is-minimized":{"identifier":"allow-is-minimized","description":"Enables the is_minimized command without any pre-configured scope.","commands":{"allow":["is_minimized"],"deny":[]}},"allow-is-resizable":{"identifier":"allow-is-resizable","description":"Enables the is_resizable command without any pre-configured scope.","commands":{"allow":["is_resizable"],"deny":[]}},"allow-is-visible":{"identifier":"allow-is-visible","description":"Enables the is_visible command without any pre-configured scope.","commands":{"allow":["is_visible"],"deny":[]}},"allow-maximize":{"identifier":"allow-maximize","description":"Enables the maximize command without any pre-configured scope.","commands":{"allow":["maximize"],"deny":[]}},"allow-minimize":{"identifier":"allow-minimize","description":"Enables the minimize command without any pre-configured scope.","commands":{"allow":["minimize"],"deny":[]}},"allow-monitor-from-point":{"identifier":"allow-monitor-from-point","description":"Enables the monitor_from_point command without any pre-configured scope.","commands":{"allow":["monitor_from_point"],"deny":[]}},"allow-outer-position":{"identifier":"allow-outer-position","description":"Enables the outer_position command without any pre-configured scope.","commands":{"allow":["outer_position"],"deny":[]}},"allow-outer-size":{"identifier":"allow-outer-size","description":"Enables the outer_size command without any pre-configured scope.","commands":{"allow":["outer_size"],"deny":[]}},"allow-primary-monitor":{"identifier":"allow-primary-monitor","description":"Enables the primary_monitor command without any pre-configured scope.","commands":{"allow":["primary_monitor"],"deny":[]}},"allow-request-user-attention":{"identifier":"allow-request-user-attention","description":"Enables the request_user_attention command without any pre-configured scope.","commands":{"allow":["request_user_attention"],"deny":[]}},"allow-scale-factor":{"identifier":"allow-scale-factor","description":"Enables the scale_factor command without any pre-configured scope.","commands":{"allow":["scale_factor"],"deny":[]}},"allow-scene-identifier":{"identifier":"allow-scene-identifier","description":"Enables the scene_identifier command without any pre-configured scope.","commands":{"allow":["scene_identifier"],"deny":[]}},"allow-set-always-on-bottom":{"identifier":"allow-set-always-on-bottom","description":"Enables the set_always_on_bottom command without any pre-configured scope.","commands":{"allow":["set_always_on_bottom"],"deny":[]}},"allow-set-always-on-top":{"identifier":"allow-set-always-on-top","description":"Enables the set_always_on_top command without any pre-configured scope.","commands":{"allow":["set_always_on_top"],"deny":[]}},"allow-set-background-color":{"identifier":"allow-set-background-color","description":"Enables the set_background_color command without any pre-configured scope.","commands":{"allow":["set_background_color"],"deny":[]}},"allow-set-badge-count":{"identifier":"allow-set-badge-count","description":"Enables the set_badge_count command without any pre-configured scope.","commands":{"allow":["set_badge_count"],"deny":[]}},"allow-set-badge-label":{"identifier":"allow-set-badge-label","description":"Enables the set_badge_label command without any pre-configured scope.","commands":{"allow":["set_badge_label"],"deny":[]}},"allow-set-closable":{"identifier":"allow-set-closable","description":"Enables the set_closable command without any pre-configured scope.","commands":{"allow":["set_closable"],"deny":[]}},"allow-set-content-protected":{"identifier":"allow-set-content-protected","description":"Enables the set_content_protected command without any pre-configured scope.","commands":{"allow":["set_content_protected"],"deny":[]}},"allow-set-cursor-grab":{"identifier":"allow-set-cursor-grab","description":"Enables the set_cursor_grab command without any pre-configured scope.","commands":{"allow":["set_cursor_grab"],"deny":[]}},"allow-set-cursor-icon":{"identifier":"allow-set-cursor-icon","description":"Enables the set_cursor_icon command without any pre-configured scope.","commands":{"allow":["set_cursor_icon"],"deny":[]}},"allow-set-cursor-position":{"identifier":"allow-set-cursor-position","description":"Enables the set_cursor_position command without any pre-configured scope.","commands":{"allow":["set_cursor_position"],"deny":[]}},"allow-set-cursor-visible":{"identifier":"allow-set-cursor-visible","description":"Enables the set_cursor_visible command without any pre-configured scope.","commands":{"allow":["set_cursor_visible"],"deny":[]}},"allow-set-decorations":{"identifier":"allow-set-decorations","description":"Enables the set_decorations command without any pre-configured scope.","commands":{"allow":["set_decorations"],"deny":[]}},"allow-set-effects":{"identifier":"allow-set-effects","description":"Enables the set_effects command without any pre-configured scope.","commands":{"allow":["set_effects"],"deny":[]}},"allow-set-enabled":{"identifier":"allow-set-enabled","description":"Enables the set_enabled command without any pre-configured scope.","commands":{"allow":["set_enabled"],"deny":[]}},"allow-set-focus":{"identifier":"allow-set-focus","description":"Enables the set_focus command without any pre-configured scope.","commands":{"allow":["set_focus"],"deny":[]}},"allow-set-focusable":{"identifier":"allow-set-focusable","description":"Enables the set_focusable command without any pre-configured scope.","commands":{"allow":["set_focusable"],"deny":[]}},"allow-set-fullscreen":{"identifier":"allow-set-fullscreen","description":"Enables the set_fullscreen command without any pre-configured scope.","commands":{"allow":["set_fullscreen"],"deny":[]}},"allow-set-icon":{"identifier":"allow-set-icon","description":"Enables the set_icon command without any pre-configured scope.","commands":{"allow":["set_icon"],"deny":[]}},"allow-set-ignore-cursor-events":{"identifier":"allow-set-ignore-cursor-events","description":"Enables the set_ignore_cursor_events command without any pre-configured scope.","commands":{"allow":["set_ignore_cursor_events"],"deny":[]}},"allow-set-max-size":{"identifier":"allow-set-max-size","description":"Enables the set_max_size command without any pre-configured scope.","commands":{"allow":["set_max_size"],"deny":[]}},"allow-set-maximizable":{"identifier":"allow-set-maximizable","description":"Enables the set_maximizable command without any pre-configured scope.","commands":{"allow":["set_maximizable"],"deny":[]}},"allow-set-min-size":{"identifier":"allow-set-min-size","description":"Enables the set_min_size command without any pre-configured scope.","commands":{"allow":["set_min_size"],"deny":[]}},"allow-set-minimizable":{"identifier":"allow-set-minimizable","description":"Enables the set_minimizable command without any pre-configured scope.","commands":{"allow":["set_minimizable"],"deny":[]}},"allow-set-overlay-icon":{"identifier":"allow-set-overlay-icon","description":"Enables the set_overlay_icon command without any pre-configured scope.","commands":{"allow":["set_overlay_icon"],"deny":[]}},"allow-set-position":{"identifier":"allow-set-position","description":"Enables the set_position command without any pre-configured scope.","commands":{"allow":["set_position"],"deny":[]}},"allow-set-progress-bar":{"identifier":"allow-set-progress-bar","description":"Enables the set_progress_bar command without any pre-configured scope.","commands":{"allow":["set_progress_bar"],"deny":[]}},"allow-set-resizable":{"identifier":"allow-set-resizable","description":"Enables the set_resizable command without any pre-configured scope.","commands":{"allow":["set_resizable"],"deny":[]}},"allow-set-shadow":{"identifier":"allow-set-shadow","description":"Enables the set_shadow command without any pre-configured scope.","commands":{"allow":["set_shadow"],"deny":[]}},"allow-set-simple-fullscreen":{"identifier":"allow-set-simple-fullscreen","description":"Enables the set_simple_fullscreen command without any pre-configured scope.","commands":{"allow":["set_simple_fullscreen"],"deny":[]}},"allow-set-size":{"identifier":"allow-set-size","description":"Enables the set_size command without any pre-configured scope.","commands":{"allow":["set_size"],"deny":[]}},"allow-set-size-constraints":{"identifier":"allow-set-size-constraints","description":"Enables the set_size_constraints command without any pre-configured scope.","commands":{"allow":["set_size_constraints"],"deny":[]}},"allow-set-skip-taskbar":{"identifier":"allow-set-skip-taskbar","description":"Enables the set_skip_taskbar command without any pre-configured scope.","commands":{"allow":["set_skip_taskbar"],"deny":[]}},"allow-set-theme":{"identifier":"allow-set-theme","description":"Enables the set_theme command without any pre-configured scope.","commands":{"allow":["set_theme"],"deny":[]}},"allow-set-title":{"identifier":"allow-set-title","description":"Enables the set_title command without any pre-configured scope.","commands":{"allow":["set_title"],"deny":[]}},"allow-set-title-bar-style":{"identifier":"allow-set-title-bar-style","description":"Enables the set_title_bar_style command without any pre-configured scope.","commands":{"allow":["set_title_bar_style"],"deny":[]}},"allow-set-visible-on-all-workspaces":{"identifier":"allow-set-visible-on-all-workspaces","description":"Enables the set_visible_on_all_workspaces command without any pre-configured scope.","commands":{"allow":["set_visible_on_all_workspaces"],"deny":[]}},"allow-show":{"identifier":"allow-show","description":"Enables the show command without any pre-configured scope.","commands":{"allow":["show"],"deny":[]}},"allow-start-dragging":{"identifier":"allow-start-dragging","description":"Enables the start_dragging command without any pre-configured scope.","commands":{"allow":["start_dragging"],"deny":[]}},"allow-start-resize-dragging":{"identifier":"allow-start-resize-dragging","description":"Enables the start_resize_dragging command without any pre-configured scope.","commands":{"allow":["start_resize_dragging"],"deny":[]}},"allow-theme":{"identifier":"allow-theme","description":"Enables the theme command without any pre-configured scope.","commands":{"allow":["theme"],"deny":[]}},"allow-title":{"identifier":"allow-title","description":"Enables the title command without any pre-configured scope.","commands":{"allow":["title"],"deny":[]}},"allow-toggle-maximize":{"identifier":"allow-toggle-maximize","description":"Enables the toggle_maximize command without any pre-configured scope.","commands":{"allow":["toggle_maximize"],"deny":[]}},"allow-unmaximize":{"identifier":"allow-unmaximize","description":"Enables the unmaximize command without any pre-configured scope.","commands":{"allow":["unmaximize"],"deny":[]}},"allow-unminimize":{"identifier":"allow-unminimize","description":"Enables the unminimize command without any pre-configured scope.","commands":{"allow":["unminimize"],"deny":[]}},"deny-activity-name":{"identifier":"deny-activity-name","description":"Denies the activity_name command without any pre-configured scope.","commands":{"allow":[],"deny":["activity_name"]}},"deny-available-monitors":{"identifier":"deny-available-monitors","description":"Denies the available_monitors command without any pre-configured scope.","commands":{"allow":[],"deny":["available_monitors"]}},"deny-center":{"identifier":"deny-center","description":"Denies the center command without any pre-configured scope.","commands":{"allow":[],"deny":["center"]}},"deny-close":{"identifier":"deny-close","description":"Denies the close command without any pre-configured scope.","commands":{"allow":[],"deny":["close"]}},"deny-create":{"identifier":"deny-create","description":"Denies the create command without any pre-configured scope.","commands":{"allow":[],"deny":["create"]}},"deny-current-monitor":{"identifier":"deny-current-monitor","description":"Denies the current_monitor command without any pre-configured scope.","commands":{"allow":[],"deny":["current_monitor"]}},"deny-cursor-position":{"identifier":"deny-cursor-position","description":"Denies the cursor_position command without any pre-configured scope.","commands":{"allow":[],"deny":["cursor_position"]}},"deny-destroy":{"identifier":"deny-destroy","description":"Denies the destroy command without any pre-configured scope.","commands":{"allow":[],"deny":["destroy"]}},"deny-get-all-windows":{"identifier":"deny-get-all-windows","description":"Denies the get_all_windows command without any pre-configured scope.","commands":{"allow":[],"deny":["get_all_windows"]}},"deny-hide":{"identifier":"deny-hide","description":"Denies the hide command without any pre-configured scope.","commands":{"allow":[],"deny":["hide"]}},"deny-inner-position":{"identifier":"deny-inner-position","description":"Denies the inner_position command without any pre-configured scope.","commands":{"allow":[],"deny":["inner_position"]}},"deny-inner-size":{"identifier":"deny-inner-size","description":"Denies the inner_size command without any pre-configured scope.","commands":{"allow":[],"deny":["inner_size"]}},"deny-internal-toggle-maximize":{"identifier":"deny-internal-toggle-maximize","description":"Denies the internal_toggle_maximize command without any pre-configured scope.","commands":{"allow":[],"deny":["internal_toggle_maximize"]}},"deny-is-always-on-top":{"identifier":"deny-is-always-on-top","description":"Denies the is_always_on_top command without any pre-configured scope.","commands":{"allow":[],"deny":["is_always_on_top"]}},"deny-is-closable":{"identifier":"deny-is-closable","description":"Denies the is_closable command without any pre-configured scope.","commands":{"allow":[],"deny":["is_closable"]}},"deny-is-decorated":{"identifier":"deny-is-decorated","description":"Denies the is_decorated command without any pre-configured scope.","commands":{"allow":[],"deny":["is_decorated"]}},"deny-is-enabled":{"identifier":"deny-is-enabled","description":"Denies the is_enabled command without any pre-configured scope.","commands":{"allow":[],"deny":["is_enabled"]}},"deny-is-focused":{"identifier":"deny-is-focused","description":"Denies the is_focused command without any pre-configured scope.","commands":{"allow":[],"deny":["is_focused"]}},"deny-is-fullscreen":{"identifier":"deny-is-fullscreen","description":"Denies the is_fullscreen command without any pre-configured scope.","commands":{"allow":[],"deny":["is_fullscreen"]}},"deny-is-maximizable":{"identifier":"deny-is-maximizable","description":"Denies the is_maximizable command without any pre-configured scope.","commands":{"allow":[],"deny":["is_maximizable"]}},"deny-is-maximized":{"identifier":"deny-is-maximized","description":"Denies the is_maximized command without any pre-configured scope.","commands":{"allow":[],"deny":["is_maximized"]}},"deny-is-minimizable":{"identifier":"deny-is-minimizable","description":"Denies the is_minimizable command without any pre-configured scope.","commands":{"allow":[],"deny":["is_minimizable"]}},"deny-is-minimized":{"identifier":"deny-is-minimized","description":"Denies the is_minimized command without any pre-configured scope.","commands":{"allow":[],"deny":["is_minimized"]}},"deny-is-resizable":{"identifier":"deny-is-resizable","description":"Denies the is_resizable command without any pre-configured scope.","commands":{"allow":[],"deny":["is_resizable"]}},"deny-is-visible":{"identifier":"deny-is-visible","description":"Denies the is_visible command without any pre-configured scope.","commands":{"allow":[],"deny":["is_visible"]}},"deny-maximize":{"identifier":"deny-maximize","description":"Denies the maximize command without any pre-configured scope.","commands":{"allow":[],"deny":["maximize"]}},"deny-minimize":{"identifier":"deny-minimize","description":"Denies the minimize command without any pre-configured scope.","commands":{"allow":[],"deny":["minimize"]}},"deny-monitor-from-point":{"identifier":"deny-monitor-from-point","description":"Denies the monitor_from_point command without any pre-configured scope.","commands":{"allow":[],"deny":["monitor_from_point"]}},"deny-outer-position":{"identifier":"deny-outer-position","description":"Denies the outer_position command without any pre-configured scope.","commands":{"allow":[],"deny":["outer_position"]}},"deny-outer-size":{"identifier":"deny-outer-size","description":"Denies the outer_size command without any pre-configured scope.","commands":{"allow":[],"deny":["outer_size"]}},"deny-primary-monitor":{"identifier":"deny-primary-monitor","description":"Denies the primary_monitor command without any pre-configured scope.","commands":{"allow":[],"deny":["primary_monitor"]}},"deny-request-user-attention":{"identifier":"deny-request-user-attention","description":"Denies the request_user_attention command without any pre-configured scope.","commands":{"allow":[],"deny":["request_user_attention"]}},"deny-scale-factor":{"identifier":"deny-scale-factor","description":"Denies the scale_factor command without any pre-configured scope.","commands":{"allow":[],"deny":["scale_factor"]}},"deny-scene-identifier":{"identifier":"deny-scene-identifier","description":"Denies the scene_identifier command without any pre-configured scope.","commands":{"allow":[],"deny":["scene_identifier"]}},"deny-set-always-on-bottom":{"identifier":"deny-set-always-on-bottom","description":"Denies the set_always_on_bottom command without any pre-configured scope.","commands":{"allow":[],"deny":["set_always_on_bottom"]}},"deny-set-always-on-top":{"identifier":"deny-set-always-on-top","description":"Denies the set_always_on_top command without any pre-configured scope.","commands":{"allow":[],"deny":["set_always_on_top"]}},"deny-set-background-color":{"identifier":"deny-set-background-color","description":"Denies the set_background_color command without any pre-configured scope.","commands":{"allow":[],"deny":["set_background_color"]}},"deny-set-badge-count":{"identifier":"deny-set-badge-count","description":"Denies the set_badge_count command without any pre-configured scope.","commands":{"allow":[],"deny":["set_badge_count"]}},"deny-set-badge-label":{"identifier":"deny-set-badge-label","description":"Denies the set_badge_label command without any pre-configured scope.","commands":{"allow":[],"deny":["set_badge_label"]}},"deny-set-closable":{"identifier":"deny-set-closable","description":"Denies the set_closable command without any pre-configured scope.","commands":{"allow":[],"deny":["set_closable"]}},"deny-set-content-protected":{"identifier":"deny-set-content-protected","description":"Denies the set_content_protected command without any pre-configured scope.","commands":{"allow":[],"deny":["set_content_protected"]}},"deny-set-cursor-grab":{"identifier":"deny-set-cursor-grab","description":"Denies the set_cursor_grab command without any pre-configured scope.","commands":{"allow":[],"deny":["set_cursor_grab"]}},"deny-set-cursor-icon":{"identifier":"deny-set-cursor-icon","description":"Denies the set_cursor_icon command without any pre-configured scope.","commands":{"allow":[],"deny":["set_cursor_icon"]}},"deny-set-cursor-position":{"identifier":"deny-set-cursor-position","description":"Denies the set_cursor_position command without any pre-configured scope.","commands":{"allow":[],"deny":["set_cursor_position"]}},"deny-set-cursor-visible":{"identifier":"deny-set-cursor-visible","description":"Denies the set_cursor_visible command without any pre-configured scope.","commands":{"allow":[],"deny":["set_cursor_visible"]}},"deny-set-decorations":{"identifier":"deny-set-decorations","description":"Denies the set_decorations command without any pre-configured scope.","commands":{"allow":[],"deny":["set_decorations"]}},"deny-set-effects":{"identifier":"deny-set-effects","description":"Denies the set_effects command without any pre-configured scope.","commands":{"allow":[],"deny":["set_effects"]}},"deny-set-enabled":{"identifier":"deny-set-enabled","description":"Denies the set_enabled command without any pre-configured scope.","commands":{"allow":[],"deny":["set_enabled"]}},"deny-set-focus":{"identifier":"deny-set-focus","description":"Denies the set_focus command without any pre-configured scope.","commands":{"allow":[],"deny":["set_focus"]}},"deny-set-focusable":{"identifier":"deny-set-focusable","description":"Denies the set_focusable command without any pre-configured scope.","commands":{"allow":[],"deny":["set_focusable"]}},"deny-set-fullscreen":{"identifier":"deny-set-fullscreen","description":"Denies the set_fullscreen command without any pre-configured scope.","commands":{"allow":[],"deny":["set_fullscreen"]}},"deny-set-icon":{"identifier":"deny-set-icon","description":"Denies the set_icon command without any pre-configured scope.","commands":{"allow":[],"deny":["set_icon"]}},"deny-set-ignore-cursor-events":{"identifier":"deny-set-ignore-cursor-events","description":"Denies the set_ignore_cursor_events command without any pre-configured scope.","commands":{"allow":[],"deny":["set_ignore_cursor_events"]}},"deny-set-max-size":{"identifier":"deny-set-max-size","description":"Denies the set_max_size command without any pre-configured scope.","commands":{"allow":[],"deny":["set_max_size"]}},"deny-set-maximizable":{"identifier":"deny-set-maximizable","description":"Denies the set_maximizable command without any pre-configured scope.","commands":{"allow":[],"deny":["set_maximizable"]}},"deny-set-min-size":{"identifier":"deny-set-min-size","description":"Denies the set_min_size command without any pre-configured scope.","commands":{"allow":[],"deny":["set_min_size"]}},"deny-set-minimizable":{"identifier":"deny-set-minimizable","description":"Denies the set_minimizable command without any pre-configured scope.","commands":{"allow":[],"deny":["set_minimizable"]}},"deny-set-overlay-icon":{"identifier":"deny-set-overlay-icon","description":"Denies the set_overlay_icon command without any pre-configured scope.","commands":{"allow":[],"deny":["set_overlay_icon"]}},"deny-set-position":{"identifier":"deny-set-position","description":"Denies the set_position command without any pre-configured scope.","commands":{"allow":[],"deny":["set_position"]}},"deny-set-progress-bar":{"identifier":"deny-set-progress-bar","description":"Denies the set_progress_bar command without any pre-configured scope.","commands":{"allow":[],"deny":["set_progress_bar"]}},"deny-set-resizable":{"identifier":"deny-set-resizable","description":"Denies the set_resizable command without any pre-configured scope.","commands":{"allow":[],"deny":["set_resizable"]}},"deny-set-shadow":{"identifier":"deny-set-shadow","description":"Denies the set_shadow command without any pre-configured scope.","commands":{"allow":[],"deny":["set_shadow"]}},"deny-set-simple-fullscreen":{"identifier":"deny-set-simple-fullscreen","description":"Denies the set_simple_fullscreen command without any pre-configured scope.","commands":{"allow":[],"deny":["set_simple_fullscreen"]}},"deny-set-size":{"identifier":"deny-set-size","description":"Denies the set_size command without any pre-configured scope.","commands":{"allow":[],"deny":["set_size"]}},"deny-set-size-constraints":{"identifier":"deny-set-size-constraints","description":"Denies the set_size_constraints command without any pre-configured scope.","commands":{"allow":[],"deny":["set_size_constraints"]}},"deny-set-skip-taskbar":{"identifier":"deny-set-skip-taskbar","description":"Denies the set_skip_taskbar command without any pre-configured scope.","commands":{"allow":[],"deny":["set_skip_taskbar"]}},"deny-set-theme":{"identifier":"deny-set-theme","description":"Denies the set_theme command without any pre-configured scope.","commands":{"allow":[],"deny":["set_theme"]}},"deny-set-title":{"identifier":"deny-set-title","description":"Denies the set_title command without any pre-configured scope.","commands":{"allow":[],"deny":["set_title"]}},"deny-set-title-bar-style":{"identifier":"deny-set-title-bar-style","description":"Denies the set_title_bar_style command without any pre-configured scope.","commands":{"allow":[],"deny":["set_title_bar_style"]}},"deny-set-visible-on-all-workspaces":{"identifier":"deny-set-visible-on-all-workspaces","description":"Denies the set_visible_on_all_workspaces command without any pre-configured scope.","commands":{"allow":[],"deny":["set_visible_on_all_workspaces"]}},"deny-show":{"identifier":"deny-show","description":"Denies the show command without any pre-configured scope.","commands":{"allow":[],"deny":["show"]}},"deny-start-dragging":{"identifier":"deny-start-dragging","description":"Denies the start_dragging command without any pre-configured scope.","commands":{"allow":[],"deny":["start_dragging"]}},"deny-start-resize-dragging":{"identifier":"deny-start-resize-dragging","description":"Denies the start_resize_dragging command without any pre-configured scope.","commands":{"allow":[],"deny":["start_resize_dragging"]}},"deny-theme":{"identifier":"deny-theme","description":"Denies the theme command without any pre-configured scope.","commands":{"allow":[],"deny":["theme"]}},"deny-title":{"identifier":"deny-title","description":"Denies the title command without any pre-configured scope.","commands":{"allow":[],"deny":["title"]}},"deny-toggle-maximize":{"identifier":"deny-toggle-maximize","description":"Denies the toggle_maximize command without any pre-configured scope.","commands":{"allow":[],"deny":["toggle_maximize"]}},"deny-unmaximize":{"identifier":"deny-unmaximize","description":"Denies the unmaximize command without any pre-configured scope.","commands":{"allow":[],"deny":["unmaximize"]}},"deny-unminimize":{"identifier":"deny-unminimize","description":"Denies the unminimize command without any pre-configured scope.","commands":{"allow":[],"deny":["unminimize"]}}},"permission_sets":{},"global_scope_schema":null},"dialog":{"default_permission":{"identifier":"default","description":"This permission set configures the types of dialogs\navailable from the dialog plugin.\n\n#### Granted Permissions\n\nAll dialog types are enabled.\n\n\n","permissions":["allow-message","allow-save","allow-open"]},"permissions":{"allow-ask":{"identifier":"allow-ask","description":"Enables the ask command without any pre-configured scope. (**DEPRECATED**: This is now an alias to `allow-message` and will be removed in v3)","commands":{"allow":["message"],"deny":[]}},"allow-confirm":{"identifier":"allow-confirm","description":"Enables the confirm command without any pre-configured scope. (**DEPRECATED**: This is now an alias to `allow-message` and will be removed in v3)","commands":{"allow":["message"],"deny":[]}},"allow-message":{"identifier":"allow-message","description":"Enables the message command without any pre-configured scope.","commands":{"allow":["message"],"deny":[]}},"allow-open":{"identifier":"allow-open","description":"Enables the open command without any pre-configured scope.","commands":{"allow":["open"],"deny":[]}},"allow-save":{"identifier":"allow-save","description":"Enables the save command without any pre-configured scope.","commands":{"allow":["save"],"deny":[]}},"deny-ask":{"identifier":"deny-ask","description":"Denies the ask command without any pre-configured scope. (**DEPRECATED**: This is now an alias to `deny-message` and will be removed in v3)","commands":{"allow":[],"deny":["message"]}},"deny-confirm":{"identifier":"deny-confirm","description":"Denies the confirm command without any pre-configured scope. (**DEPRECATED**: This is now an alias to `deny-message` and will be removed in v3)","commands":{"allow":[],"deny":["message"]}},"deny-message":{"identifier":"deny-message","description":"Denies the message command without any pre-configured scope.","commands":{"allow":[],"deny":["message"]}},"deny-open":{"identifier":"deny-open","description":"Denies the open command without any pre-configured scope.","commands":{"allow":[],"deny":["open"]}},"deny-save":{"identifier":"deny-save","description":"Denies the save command without any pre-configured scope.","commands":{"allow":[],"deny":["save"]}}},"permission_sets":{},"global_scope_schema":null},"global-shortcut":{"default_permission":{"identifier":"default","description":"No features are enabled by default, as we believe\nthe shortcuts can be inherently dangerous and it is\napplication specific if specific shortcuts should be\nregistered or unregistered.\n","permissions":[]},"permissions":{"allow-is-registered":{"identifier":"allow-is-registered","description":"Enables the is_registered command without any pre-configured scope.","commands":{"allow":["is_registered"],"deny":[]}},"allow-register":{"identifier":"allow-register","description":"Enables the register command without any pre-configured scope.","commands":{"allow":["register"],"deny":[]}},"allow-register-all":{"identifier":"allow-register-all","description":"Enables the register_all command without any pre-configured scope.","commands":{"allow":["register_all"],"deny":[]}},"allow-unregister":{"identifier":"allow-unregister","description":"Enables the unregister command without any pre-configured scope.","commands":{"allow":["unregister"],"deny":[]}},"allow-unregister-all":{"identifier":"allow-unregister-all","description":"Enables the unregister_all command without any pre-configured scope.","commands":{"allow":["unregister_all"],"deny":[]}},"deny-is-registered":{"identifier":"deny-is-registered","description":"Denies the is_registered command without any pre-configured scope.","commands":{"allow":[],"deny":["is_registered"]}},"deny-register":{"identifier":"deny-register","description":"Denies the register command without any pre-configured scope.","commands":{"allow":[],"deny":["register"]}},"deny-register-all":{"identifier":"deny-register-all","description":"Denies the register_all command without any pre-configured scope.","commands":{"allow":[],"deny":["register_all"]}},"deny-unregister":{"identifier":"deny-unregister","description":"Denies the unregister command without any pre-configured scope.","commands":{"allow":[],"deny":["unregister"]}},"deny-unregister-all":{"identifier":"deny-unregister-all","description":"Denies the unregister_all command without any pre-configured scope.","commands":{"allow":[],"deny":["unregister_all"]}}},"permission_sets":{},"global_scope_schema":null}}
docs/delivery/requirements-status.md:183:| L-8 | 扩展拖入即用/导出/AI 生成 | ✅ | [e2e/extensions-manage.spec.ts](../../e2e/extensions-manage.spec.ts) |
docs/delivery/requirements-status.md:246:### extensions（3，2026-11-03 新增）
docs/delivery/requirements-status.md:250:| X-1 | 数据文件扩展点（snippets / templates） | ✅ | change `extension-points`（归档 2026-11-03）；`src-tauri/src/extensions.rs`、`src/lib/extensions/` |
docs/delivery/requirements-status.md:251:| X-2 | 主题 token 覆盖（`theme.toml` 白名单） | ✅ | 同上；`src/lib/extensions/theme-tokens.ts` |
src-tauri/gen/schemas/macOS-schema.json:40:      "description": "A grouping and boundary mechanism developers can use to isolate access to the IPC layer.\n\nIt controls application windows' and webviews' fine grained access to the Tauri core, application, or plugin commands. If a webview or its window is not matching any capability then it has no access to the IPC layer at all.\n\nThis can be done to create groups of windows, based on their required system access, which can reduce impact of frontend vulnerabilities in less privileged windows. Windows can be added to a capability by exact name (e.g. `main-window`) or glob patterns like `*` or `admin-*`. A Window can have none, one, or multiple associated capabilities.\n\n## Example\n\n```json { \"identifier\": \"main-user-files-write\", \"description\": \"This capability allows the `main` window on macOS and Windows access to `filesystem` write related commands and `dialog` commands to enable programmatic access to files selected by the user.\", \"windows\": [ \"main\" ], \"permissions\": [ \"core:default\", \"dialog:open\", { \"identifier\": \"fs:allow-write-text-file\", \"allow\": [{ \"path\": \"$HOME/test.txt\" }] }, ], \"platforms\": [\"macOS\",\"windows\"] } ```",
src-tauri/gen/schemas/macOS-schema.json:44:        "permissions"
src-tauri/gen/schemas/macOS-schema.json:52:          "description": "Description of what the capability is intended to allow on associated windows.\n\nIt should contain a description of what the grouped permissions should allow.\n\n## Example\n\nThis capability allows the `main` window access to `filesystem` write related commands and `dialog` commands to enable programmatic access to files selected by the user.",
src-tauri/gen/schemas/macOS-schema.json:57:          "description": "Configure remote URLs that can use the capability permissions.\n\nThis setting is optional and defaults to not being set, as our default use case is that the content is served from our local application.\n\n:::caution Make sure you understand the security implications of providing remote sources with local system access. :::\n\n## Example\n\n```json { \"urls\": [\"https://*.mydomain.dev\"] } ```",
src-tauri/gen/schemas/macOS-schema.json:86:        "permissions": {
src-tauri/gen/schemas/macOS-schema.json:87:          "description": "List of permissions attached to this capability.\n\nMust include the plugin name as prefix in the form of `${plugin-name}:${permission-name}`. For commands directly implemented in the application itself only `${permission-name}` is required.\n\n## Example\n\n```json [ \"core:default\", \"shell:allow-open\", \"dialog:open\", { \"identifier\": \"fs:allow-write-text-file\", \"allow\": [{ \"path\": \"$HOME/test.txt\" }] } ] ```",
src-tauri/gen/schemas/macOS-schema.json:186:          "description": "Default permissions for the plugin.\n#### This default permission set includes:\n\n- `allow-version`\n- `allow-name`\n- `allow-tauri-version`\n- `allow-identifier`\n- `allow-bundle-type`\n- `allow-register-listener`\n- `allow-remove-listener`\n- `allow-supports-multiple-windows`",
src-tauri/gen/schemas/macOS-schema.json:189:          "markdownDescription": "Default permissions for the plugin.\n#### This default permission set includes:\n\n- `allow-version`\n- `allow-name`\n- `allow-tauri-version`\n- `allow-identifier`\n- `allow-bundle-type`\n- `allow-register-listener`\n- `allow-remove-listener`\n- `allow-supports-multiple-windows`"
src-tauri/gen/schemas/macOS-schema.json:372:          "description": "Default permissions for the plugin, which enables all commands.\n#### This default permission set includes:\n\n- `allow-listen`\n- `allow-unlisten`\n- `allow-emit`\n- `allow-emit-to`",
src-tauri/gen/schemas/macOS-schema.json:375:          "markdownDescription": "Default permissions for the plugin, which enables all commands.\n#### This default permission set includes:\n\n- `allow-listen`\n- `allow-unlisten`\n- `allow-emit`\n- `allow-emit-to`"
src-tauri/gen/schemas/macOS-schema.json:426:          "description": "Default permissions for the plugin, which enables all commands.\n#### This default permission set includes:\n\n- `allow-new`\n- `allow-from-bytes`\n- `allow-from-path`\n- `allow-rgba`\n- `allow-size`",
src-tauri/gen/schemas/macOS-schema.json:429:          "markdownDescription": "Default permissions for the plugin, which enables all commands.\n#### This default permission set includes:\n\n- `allow-new`\n- `allow-from-bytes`\n- `allow-from-path`\n- `allow-rgba`\n- `allow-size`"
src-tauri/gen/schemas/macOS-schema.json:492:          "description": "Default permissions for the plugin, which enables all commands.\n#### This default permission set includes:\n\n- `allow-new`\n- `allow-append`\n- `allow-prepend`\n- `allow-insert`\n- `allow-remove`\n- `allow-remove-at`\n- `allow-items`\n- `allow-get`\n- `allow-popup`\n- `allow-create-default`\n- `allow-set-as-app-menu`\n- `allow-set-as-window-menu`\n- `allow-text`\n- `allow-set-text`\n- `allow-is-enabled`\n- `allow-set-enabled`\n- `allow-set-accelerator`\n- `allow-set-as-windows-menu-for-nsapp`\n- `allow-set-as-help-menu-for-nsapp`\n- `allow-is-checked`\n- `allow-set-checked`\n- `allow-set-icon`",
src-tauri/gen/schemas/macOS-schema.json:495:          "markdownDescription": "Default permissions for the plugin, which enables all commands.\n#### This default permission set includes:\n\n- `allow-new`\n- `allow-append`\n- `allow-prepend`\n- `allow-insert`\n- `allow-remove`\n- `allow-remove-at`\n- `allow-items`\n- `allow-get`\n- `allow-popup`\n- `allow-create-default`\n- `allow-set-as-app-menu`\n- `allow-set-as-window-menu`\n- `allow-text`\n- `allow-set-text`\n- `allow-is-enabled`\n- `allow-set-enabled`\n- `allow-set-accelerator`\n- `allow-set-as-windows-menu-for-nsapp`\n- `allow-set-as-help-menu-for-nsapp`\n- `allow-is-checked`\n- `allow-set-checked`\n- `allow-set-icon`"
src-tauri/gen/schemas/macOS-schema.json:762:          "description": "Default permissions for the plugin, which enables all commands.\n#### This default permission set includes:\n\n- `allow-resolve-directory`\n- `allow-resolve`\n- `allow-normalize`\n- `allow-join`\n- `allow-dirname`\n- `allow-extname`\n- `allow-basename`\n- `allow-is-absolute`",
src-tauri/gen/schemas/macOS-schema.json:765:          "markdownDescription": "Default permissions for the plugin, which enables all commands.\n#### This default permission set includes:\n\n- `allow-resolve-directory`\n- `allow-resolve`\n- `allow-normalize`\n- `allow-join`\n- `allow-dirname`\n- `allow-extname`\n- `allow-basename`\n- `allow-is-absolute`"
src-tauri/gen/schemas/macOS-schema.json:864:          "description": "Default permissions for the plugin, which enables all commands.\n#### This default permission set includes:\n\n- `allow-close`",
src-tauri/gen/schemas/macOS-schema.json:867:          "markdownDescription": "Default permissions for the plugin, which enables all commands.\n#### This default permission set includes:\n\n- `allow-close`"
src-tauri/gen/schemas/macOS-schema.json:882:          "description": "Default permissions for the plugin, which enables all commands.\n#### This default permission set includes:\n\n- `allow-new`\n- `allow-get-by-id`\n- `allow-remove-by-id`\n- `allow-set-icon`\n- `allow-set-menu`\n- `allow-set-tooltip`\n- `allow-set-title`\n- `allow-set-visible`\n- `allow-set-temp-dir-path`\n- `allow-set-icon-as-template`\n- `allow-set-icon-with-as-template`\n- `allow-set-show-menu-on-left-click`",
src-tauri/gen/schemas/macOS-schema.json:885:          "markdownDescription": "Default permissions for the plugin, which enables all commands.\n#### This default permission set includes:\n\n- `allow-new`\n- `allow-get-by-id`\n- `allow-remove-by-id`\n- `allow-set-icon`\n- `allow-set-menu`\n- `allow-set-tooltip`\n- `allow-set-title`\n- `allow-set-visible`\n- `allow-set-temp-dir-path`\n- `allow-set-icon-as-template`\n- `allow-set-icon-with-as-template`\n- `allow-set-show-menu-on-left-click`"
src-tauri/gen/schemas/macOS-schema.json:1032:          "description": "Default permissions for the plugin.\n#### This default permission set includes:\n\n- `allow-get-all-webviews`\n- `allow-webview-position`\n- `allow-webview-size`\n- `allow-internal-toggle-devtools`",
src-tauri/gen/schemas/macOS-schema.json:1035:          "markdownDescription": "Default permissions for the plugin.\n#### This default permission set includes:\n\n- `allow-get-all-webviews`\n- `allow-webview-position`\n- `allow-webview-size`\n- `allow-internal-toggle-devtools`"
src-tauri/gen/schemas/macOS-schema.json:1254:          "description": "Default permissions for the plugin.\n#### This default permission set includes:\n\n- `allow-get-all-windows`\n- `allow-scale-factor`\n- `allow-inner-position`\n- `allow-outer-position`\n- `allow-inner-size`\n- `allow-outer-size`\n- `allow-is-fullscreen`\n- `allow-is-minimized`\n- `allow-is-maximized`\n- `allow-is-focused`\n- `allow-is-decorated`\n- `allow-is-resizable`\n- `allow-is-maximizable`\n- `allow-is-minimizable`\n- `allow-is-closable`\n- `allow-is-visible`\n- `allow-is-enabled`\n- `allow-title`\n- `allow-current-monitor`\n- `allow-primary-monitor`\n- `allow-monitor-from-point`\n- `allow-available-monitors`\n- `allow-cursor-position`\n- `allow-theme`\n- `allow-is-always-on-top`\n- `allow-activity-name`\n- `allow-scene-identifier`\n- `allow-internal-toggle-maximize`",
src-tauri/gen/schemas/macOS-schema.json:1257:          "markdownDescription": "Default permissions for the plugin.\n#### This default permission set includes:\n\n- `allow-get-all-windows`\n- `allow-scale-factor`\n- `allow-inner-position`\n- `allow-outer-position`\n- `allow-inner-size`\n- `allow-outer-size`\n- `allow-is-fullscreen`\n- `allow-is-minimized`\n- `allow-is-maximized`\n- `allow-is-focused`\n- `allow-is-decorated`\n- `allow-is-resizable`\n- `allow-is-maximizable`\n- `allow-is-minimizable`\n- `allow-is-closable`\n- `allow-is-visible`\n- `allow-is-enabled`\n- `allow-title`\n- `allow-current-monitor`\n- `allow-primary-monitor`\n- `allow-monitor-from-point`\n- `allow-available-monitors`\n- `allow-cursor-position`\n- `allow-theme`\n- `allow-is-always-on-top`\n- `allow-activity-name`\n- `allow-scene-identifier`\n- `allow-internal-toggle-maximize`"
src-tauri/gen/schemas/capabilities.json:1:{"default":{"identifier":"default","description":"Capability for all windows","local":true,"windows":["main","overlay"],"permissions":["core:default","dialog:default","dialog:allow-open","dialog:allow-save","core:event:default","core:event:allow-emit","core:event:allow-listen","core:window:default","core:window:allow-show","core:window:allow-hide","core:window:allow-set-focus","core:window:allow-is-visible","core:window:allow-set-always-on-top","core:window:allow-is-fullscreen","core:window:allow-set-fullscreen","core:window:allow-start-dragging","core:webview:default","core:webview:allow-print"]}}
e2e/markdown-structural-tags.spec.ts:86:  await page.locator('[data-menu-item="source"]').click();
openspec/changes/editor-surface-batch20/conformance.json:13:          "source": "#897 缺陷1 / 一手证据 Biaoyue2.pdf"
openspec/changes/editor-surface-batch20/conformance.json:20:          "source": "一手证据 formula-mermaid.md"
openspec/changes/editor-surface-batch20/conformance.json:27:          "source": "一手证据 formula-mermaid.md"
openspec/changes/editor-surface-batch20/conformance.json:34:          "source": "design D1"
openspec/changes/editor-surface-batch20/conformance.json:47:          "source": "#897 缺陷2 / design D2"
openspec/changes/editor-surface-batch20/conformance.json:54:          "source": "#897 缺陷2 / design D2"
openspec/changes/editor-surface-batch20/conformance.json:67:          "source": "#897 缺陷2 / design D2"
openspec/changes/editor-surface-batch20/conformance.json:80:          "source": "#897 缺陷3 / design D2"
openspec/changes/editor-surface-batch20/conformance.json:87:          "source": "#897 缺陷3 / design D2"
openspec/changes/editor-surface-batch20/conformance.json:100:          "source": "#897 缺陷6 / file-management C-6"
openspec/changes/editor-surface-batch20/conformance.json:107:          "source": "#897 缺陷6 / design D2"
openspec/changes/editor-surface-batch20/conformance.json:114:          "source": "#897 缺陷6 / design D2"
openspec/changes/editor-surface-batch20/conformance.json:127:          "source": "#897 缺陷5 / design D2"
openspec/changes/editor-surface-batch20/conformance.json:134:          "source": "#897 缺陷5 / design D2"
openspec/changes/editor-surface-batch20/conformance.json:141:          "source": "#897 缺陷5 / design D2"
openspec/changes/editor-surface-batch20/conformance.json:154:          "source": "#897 缺陷12 / design D2"
openspec/changes/editor-surface-batch20/conformance.json:161:          "source": "#897 缺陷12 / design D2"
openspec/changes/editor-surface-batch20/conformance.json:174:          "source": "#897 优化3 / design D2"
openspec/changes/editor-surface-batch20/conformance.json:181:          "source": "#897 优化3 / design D2"
openspec/changes/editor-surface-batch20/conformance.json:194:          "source": "#897 优化4 / design D2"
openspec/changes/editor-surface-batch20/conformance.json:207:          "source": "#897 优化5 / design D2"
openspec/changes/editor-surface-batch20/conformance.json:214:          "source": "#897 优化5 / design D2"
openspec/changes/editor-surface-batch20/conformance.json:221:          "source": "#897 优化5 / design D2"
openspec/changes/editor-surface-batch20/conformance.json:234:          "source": "#897 缺陷4 / editing E-22"
openspec/changes/editor-surface-batch20/conformance.json:241:          "source": "#897 缺陷4 / editing E-22"
openspec/changes/editor-surface-batch20/conformance.json:248:          "source": "#897 缺陷4 / configuration"
openspec/changes/editor-surface-batch20/conformance.json:255:          "source": "#897 缺陷4 / application-shell"
openspec/changes/editor-surface-batch20/conformance.json:268:          "source": "#897 优化2 / design D3"
openspec/changes/editor-surface-batch20/conformance.json:275:          "source": "#897 优化2 / 设计系统 §3"
openspec/changes/editor-surface-batch20/conformance.json:288:          "source": "#897 缺陷7 / navigation 页签右键菜单文件动作"
openspec/changes/editor-surface-batch20/conformance.json:295:          "source": "#897 缺陷7 / editing E-22"
openspec/changes/editor-surface-batch20/conformance.json:308:          "source": "#897 优化8 / 设计系统 §2.3"
openspec/changes/editor-surface-batch20/conformance.json:315:          "source": "#897 优化8 / src/__tests__/ui/icons.test.ts"
openspec/changes/editor-surface-batch20/conformance.json:328:          "source": "#897 优化10 / design D3"
openspec/changes/editor-surface-batch20/conformance.json:335:          "source": "设计决案 #497 / design D3"
openspec/changes/editor-surface-batch20/conformance.json:342:          "source": "E-11 / design D3"
openspec/changes/editor-surface-batch20/conformance.json:355:          "source": "#897 缺陷8 / editing E-8"
openspec/changes/editor-surface-batch20/conformance.json:362:          "source": "#897 缺陷8 / editing E-8"
openspec/changes/editor-surface-batch20/conformance.json:375:          "source": "#897 缺陷9 / editing 标题折叠"
openspec/changes/editor-surface-batch20/conformance.json:382:          "source": "#897 缺陷9 / editing 标题折叠"
openspec/changes/editor-surface-batch20/conformance.json:395:          "source": "#897 缺陷14 / editing E-36"
openspec/changes/editor-surface-batch20/conformance.json:402:          "source": "editing E-36"
openspec/changes/editor-surface-batch20/conformance.json:409:          "source": "#897 缺陷14 / editing 撤销与重做快捷键"
openspec/changes/editor-surface-batch20/conformance.json:422:          "source": "#897 缺陷14 / editing 编辑态工具条归属"
openspec/changes/editor-surface-batch20/conformance.json:429:          "source": "#897 缺陷14 / design D4"
openspec/changes/editor-surface-batch20/conformance.json:442:          "source": "#897 优化6 / design D4"
openspec/changes/editor-surface-batch20/conformance.json:449:          "source": "#897 优化6 / design D4"
openspec/changes/editor-surface-batch20/conformance.json:462:          "source": "#897 优化7 / design D4"
openspec/changes/editor-surface-batch20/conformance.json:469:          "source": "#897 优化7 / design D4"
openspec/changes/editor-surface-batch20/conformance.json:482:          "source": "#897 优化11 / design D4"
openspec/changes/editor-surface-batch20/conformance.json:489:          "source": "#897 优化11 / design D4"
openspec/changes/editor-surface-batch20/conformance.json:496:          "source": "#897 优化11 / design D4"
openspec/changes/editor-surface-batch20/conformance.json:509:          "source": "#897 优化13 / editing 文本与脚本文件行号"
openspec/changes/editor-surface-batch20/conformance.json:516:          "source": "#897 优化13 / design D4"
openspec/changes/editor-surface-batch20/conformance.json:523:          "source": "#897 优化13 / design D4"
openspec/changes/editor-surface-batch20/conformance.json:536:          "source": "#897 优化14 / editing 编辑态工具条归属"
openspec/changes/editor-surface-batch20/conformance.json:543:          "source": "#897 优化14 / editing 编辑态工具条归属"
openspec/changes/editor-surface-batch20/conformance.json:556:          "source": "#897 缺陷10 / design D5"
openspec/changes/editor-surface-batch20/conformance.json:563:          "source": "#897 缺陷10 / design D5"
openspec/changes/editor-surface-batch20/conformance.json:570:          "source": "#897 缺陷10 / design D5"
openspec/changes/editor-surface-batch20/conformance.json:583:          "source": "#897 缺陷13 / application-shell"
openspec/changes/editor-surface-batch20/conformance.json:590:          "source": "#897 缺陷13 / design D5"
openspec/changes/editor-surface-batch20/conformance.json:603:          "source": "#897 缺陷11 / navigation 左边栏展开与固定快捷键"
openspec/changes/editor-surface-batch20/conformance.json:610:          "source": "#897 缺陷11 / src/lib/shortcuts.ts"
openspec/changes/editor-surface-batch20/conformance.json:623:          "source": "#897 优化9 / design D5"
openspec/changes/editor-surface-batch20/conformance.json:630:          "source": "#897 优化9 / editing E-10"
openspec/changes/editor-surface-batch20/conformance.json:637:          "source": "#897 优化9 / design D5"
openspec/changes/editor-surface-batch20/conformance.json:650:          "source": "#897 优化12 / configuration 标题字体逐级配置"
openspec/changes/editor-surface-batch20/conformance.json:657:          "source": "#897 优化12 / design D6"
docs/delivery/layout-portal-acceptance.md:25:| 8 | 扩展：拖入即用、导出、AI 生成 | 通过 | [e2e/extensions-manage.spec.ts](../../e2e/extensions-manage.spec.ts)（导入/开关/卸载/导出/AI 生成/取消） |
docs/delivery/layout-portal-acceptance.md:41:| 7 | 该项调整无需改源码？→ 是（P4） | 通过 | 视图规格持久化于 Rust 配置字段（`railViewSpec` / `previewSettings` / `aiViewSpec`）；扩展包 `extensions/<id>/` |
docs/MIGRATION-MAP.md:6:> - 数据来源（只读）：`.omo/evidence/ulw/clairis-doc-governance/task-1/baseline-manifest.json`（173 条目）与 `exclusion-ledger.json`。
docs/architecture/decisions/0011-scenario-shell-and-pane-tree.md:30:- 周边：扩展包（`extensions/<id>/{manifest.json, SKILL.md}`，`.disabled` 停用标记，AI 系统提示消费）与快捷键注册表（`src/lib/shortcuts.ts` 单一真相源）构成外壳的其余部分。
e2e/columns-editor.spec.ts:191:  // 片段注入必须在应用加载前（编辑器创建时读取 list_extensions）。
e2e/columns-editor.spec.ts:194:      window as unknown as { __biaoyue_extensions__?: unknown }
e2e/columns-editor.spec.ts:195:    ).__biaoyue_extensions__ = {
e2e/floating-preview-multi.spec.ts:30:          source: "tab",
e2e/slash-menu-snippets.spec.ts:13:      window as unknown as { __biaoyue_extensions__?: unknown }
e2e/slash-menu-snippets.spec.ts:14:    ).__biaoyue_extensions__ = {
e2e/align-fence-edit.spec.ts:112:  await setMode(page, "source");
e2e/html-visual-text.spec.ts:146:      .setEditorMode("source");
docs/architecture/overview.md:91:- **形态**：`<config_base>/extensions/<id>/{manifest.json, SKILL.md}`；可选 `.disabled` 标记文件表示停用（不改用户目录结构，只加标记）。
docs/architecture/overview.md:92:- **管理**：`src-tauri/src/extension_packages.rs` 提供列表/导入/启用开关/卸载/导出；`list_extension_packages` / `import_extension_package` / `set_extension_package_enabled` / `remove_extension_package` / `package_extension_package` / `read_extension_skill` 命令在 `src-tauri/src/lib.rs` 注册。
docs/architecture/overview.md:94:- **前端**：设置·扩展区（`src/components/SettingsView.tsx`）列表/导入/开关/卸载/导出/AI 生成；`src/lib/extensions/bundle.ts` 读取 snippets/templates/theme tokens（另一套数据文件扩展点，见 extensions 域）。
e2e/extensions-template.spec.ts:17:async function gotoWithExtensions(page: Page, extensions: Extensions | null) {
e2e/extensions-template.spec.ts:18:  if (extensions !== null) {
e2e/extensions-template.spec.ts:20:      (window as unknown as Record<string, unknown>).__biaoyue_extensions__ =
e2e/extensions-template.spec.ts:22:    }, extensions);
e2e/shortcuts.spec.ts:398:  await expect.poll(() => editorMode(page)).toBe("source");
e2e/html-source-roulette.spec.ts:20:    win.__biaoyue_store__.getState().setEditorMode("source");
e2e/floating-preview-media.spec.ts:57:        source: "rail",
e2e/table-decorations.spec.ts:213:  // 片段注入必须在应用加载前（编辑器创建时读取 list_extensions）。
e2e/table-decorations.spec.ts:216:      window as unknown as { __biaoyue_extensions__?: unknown }
e2e/table-decorations.spec.ts:217:    ).__biaoyue_extensions__ = {
e2e/table-decorations.spec.ts:278:      window as unknown as { __biaoyue_extensions__?: unknown }
e2e/table-decorations.spec.ts:279:    ).__biaoyue_extensions__ = {
e2e/table-decorations.spec.ts:698:function headerCellCount(source: string): number {
e2e/table-decorations.spec.ts:704:function bodyRowCount(source: string): number {
e2e/floating-preview.spec.ts:162:              source: "rail" | "grid";
e2e/floating-preview.spec.ts:179:        source: "rail",
e2e/html-edit-loop.spec.ts:141:      .setEditorMode("source");
e2e/html-edit-loop.spec.ts:159:      .setEditorMode("source");
e2e/html-visual-edit.spec.ts:18:async function openHtml(page: Page, mode: "edit" | "source" | "preview") {
e2e/html-visual-edit.spec.ts:81:  await openHtml(page, "source");
e2e/html-visual-edit.spec.ts:104:      .setEditorMode("source");
e2e/floating-toolbar.spec.ts:335:    store.getState().setEditorMode("source");
e2e/video-multi-preview.spec.ts:24:        source: "tab",
e2e/floating-preview-edit.spec.ts:25:          source: "tab",
e2e/floating-preview-edit.spec.ts:103:          source: "tab",
e2e/extensions-theme.spec.ts:11:    (window as unknown as Record<string, unknown>).__biaoyue_extensions__ = {
e2e/extensions-manage.spec.ts:47:    task: "184-extensions",
e2e/extensions-manage.spec.ts:68:  await page.locator('[data-settings-nav="extensions"]').click();
e2e/extensions-manage.spec.ts:69:  await expect(page.locator('[data-testid="extension-row"]')).toHaveCount(2);
e2e/extensions-manage.spec.ts:76:  source: string;
e2e/extensions-manage.spec.ts:86:        __biaoyue_extension_packages__: MockExtensionPackage[];
e2e/extensions-manage.spec.ts:88:    ).__biaoyue_extension_packages__;
e2e/extensions-manage.spec.ts:103:  const rows = page.locator('[data-testid="extension-row"]');
e2e/extensions-manage.spec.ts:105:  const badges = page.locator('[data-testid="extension-source"]');
e2e/extensions-manage.spec.ts:111:    page.locator('[data-testid="extension-toggle"]').first(),
e2e/extensions-manage.spec.ts:114:    page.locator('[data-testid="extension-remove"]').first(),
e2e/extensions-manage.spec.ts:118:  await page.locator('[data-testid="extensions-import-folder"]').click();
e2e/extensions-manage.spec.ts:121:    '[data-testid="extension-row"][data-extension-id="demo"]',
e2e/extensions-manage.spec.ts:125:    userRow.locator('[data-testid="extension-source"]'),
e2e/extensions-manage.spec.ts:128:    userRow.locator('[data-testid="extension-toggle"]'),
e2e/extensions-manage.spec.ts:132:  await userRow.locator('[data-testid="extension-toggle"]').click();
e2e/extensions-manage.spec.ts:135:    userRow.locator('[data-testid="extension-toggle"]'),
e2e/extensions-manage.spec.ts:137:  await userRow.locator('[data-testid="extension-toggle"]').click();
e2e/extensions-manage.spec.ts:140:    userRow.locator('[data-testid="extension-toggle"]'),
e2e/extensions-manage.spec.ts:144:  await userRow.locator('[data-testid="extension-export"]').click();
e2e/extensions-manage.spec.ts:145:  await expect(page.locator('[data-testid="extension-notice"]')).toContainText(
e2e/extensions-manage.spec.ts:146:    "/tmp/extensions-export/",
e2e/extensions-manage.spec.ts:150:  await userRow.locator('[data-testid="extension-preview"]').click();
e2e/extensions-manage.spec.ts:152:    userRow.locator('[data-testid="extension-skill"]'),
e2e/extensions-manage.spec.ts:156:  await userRow.locator('[data-testid="extension-remove"]').click();
e2e/extensions-manage.spec.ts:159:    page.locator('[data-testid="extension-row"][data-extension-id="demo"]'),
e2e/extensions-manage.spec.ts:163:  await page.locator('[data-testid="extensions-import-folder"]').click();
e2e/extensions-manage.spec.ts:166:    page.locator('[data-testid="extension-row"][data-extension-id="demo"]'),
e2e/extensions-manage.spec.ts:177:  const rows = page.locator('[data-testid="extension-row"]');
e2e/extensions-manage.spec.ts:179:  await page.locator('[data-testid="ai-extension-prompt"]').fill(prompt);
e2e/extensions-manage.spec.ts:180:  await page.locator('[data-testid="ai-extension-generate"]').click();
e2e/extensions-manage.spec.ts:182:    page.locator('[data-testid="ai-extension-generating"]'),
e2e/extensions-manage.spec.ts:185:    page.locator('[data-testid="ai-extension-cancel"]'),
e2e/extensions-manage.spec.ts:190:    page.locator('[data-testid="ai-extension-generating"]'),
e2e/extensions-manage.spec.ts:193:  const aiRow = page.locator('[data-testid="extension-row"]', {
e2e/extensions-manage.spec.ts:194:    has: page.locator('[data-testid="extension-source"]', {
e2e/extensions-manage.spec.ts:199:  await expect(aiRow.locator('[data-testid="extension-toggle"]')).toBeChecked();
e2e/extensions-manage.spec.ts:202:  await aiRow.locator('[data-testid="extension-preview"]').click();
e2e/extensions-manage.spec.ts:203:  await expect(aiRow.locator('[data-testid="extension-skill"]')).toContainText(
e2e/extensions-manage.spec.ts:209:    .locator('[data-testid="ai-extension-prompt"]')
e2e/extensions-manage.spec.ts:211:  await page.locator('[data-testid="ai-extension-generate"]').click();
e2e/extensions-manage.spec.ts:213:    page.locator('[data-testid="ai-extension-generating"]'),
e2e/extensions-manage.spec.ts:215:  await page.locator('[data-testid="ai-extension-cancel"]').click();
e2e/extensions-manage.spec.ts:217:    page.locator('[data-testid="ai-extension-generating"]'),
e2e/extensions-manage.spec.ts:227:              __biaoyue_extension_packages__: Array<{ id: string }>;
e2e/extensions-manage.spec.ts:229:          ).__biaoyue_extension_packages__.filter(
e2e/doc-property-panel.spec.ts:80:async function setMode(page: Page, mode: "preview" | "edit" | "source") {
e2e/doc-property-panel.spec.ts:90:      .setEditorMode(m as "preview" | "edit" | "source");
e2e/doc-property-panel.spec.ts:145:  await setMode(page, "source");
e2e/doc-property-panel.spec.ts:168:  await setMode(page, "source");
e2e/doc-property-panel.spec.ts:460:  await setMode(page, "source");
e2e/doc-property-panel.spec.ts:494:  await setMode(page, "source");
e2e/doc-property-panel.spec.ts:529:  await setMode(page, "source");
e2e/doc-property-panel.spec.ts:620:  await setMode(page, "source");
e2e/doc-property-panel.spec.ts:691:  await setMode(page, "source");
e2e/doc-property-panel.spec.ts:793:  await setMode(page, "source");
e2e/doc-property-panel.spec.ts:903:source: 网络
e2e/doc-property-panel.spec.ts:968:    "source",
e2e/doc-property-panel.spec.ts:985:    "source",
e2e/doc-property-panel.spec.ts:1004:    "source",
e2e/doc-property-panel.spec.ts:1014:  for (const key of ["category", "author", "source"]) {
e2e/doc-property-panel.spec.ts:1039:    "source",
e2e/doc-property-panel.spec.ts:1056:  expect(await rowKeys(page, "B")).toEqual(["title", "source", "note"]);
e2e/doc-property-panel.spec.ts:1062:    "source",
e2e/doc-property-panel.spec.ts:1071:    "source",
e2e/doc-property-panel.spec.ts:1079:  await setMode(page, "source");
e2e/doc-property-panel.spec.ts:1134:  await a.locator('[data-key="source"] [data-testid="dpb-type"]').click();
e2e/doc-property-panel.spec.ts:1135:  await expect(a.locator('[data-key="source"].dpb-row-selected')).toHaveCount(
e2e/doc-property-panel.spec.ts:1195:    "source",
docs/agents/evidence-capture.md:110:**产出**：`evidence.mp4`（带标注烧录）+ `report.md`（测试摘要）+ `manifest.json`（环境元数据）。
openspec/specs/navigation/spec.md:311:扩展 SHALL 为文件夹形态（manifest.json + SKILL.md）可打包传播；导入 SHALL 支持拖入文件夹/.zip 或点击选择并即启用（无安装步骤）；管理列表 SHALL 含名称/来源徽章（内置|AI 生成）/启用开关/打开文件夹/卸载；SHALL 支持导出/分享自定义扩展打包；AI 生成 SHALL 为输入一句话→生成中→新扩展卡（默认启用）+ SKILL.md 预览。扩展目录扫描与列表命令 SHALL 消费既有扩展点基建，不重复实现。
openspec/specs/navigation/spec.md:315:- **WHEN** 用户把含 manifest.json 与 SKILL.md 的文件夹拖入设置·扩展区
docs/agents/data-surface.md:32:src-tauri/src/extensions.rs                 文件型扩展点扫描
docs/agents/data-surface.md:33:src/lib/extensions/                         theme.toml / bundle 桥接
openspec/changes/doc-property-and-search-panel/conformance.json:13:          "source": "prototype#面板三模式"
openspec/changes/doc-property-and-search-panel/conformance.json:20:          "source": "baseline/panel-a-edit.png"
openspec/changes/doc-property-and-search-panel/conformance.json:33:          "source": "prototype#A/B两态"
openspec/changes/doc-property-and-search-panel/conformance.json:40:          "source": "决策#建议C"
openspec/changes/doc-property-and-search-panel/conformance.json:47:          "source": "baseline/panel-b-edit.png"
openspec/changes/doc-property-and-search-panel/conformance.json:60:          "source": "prototype#千分位"
openspec/changes/doc-property-and-search-panel/conformance.json:67:          "source": "prototype#类型菜单"
openspec/changes/doc-property-and-search-panel/conformance.json:74:          "source": "prototype#[[菜单"
openspec/changes/doc-property-and-search-panel/conformance.json:87:          "source": "prototype#选择模式"
openspec/changes/doc-property-and-search-panel/conformance.json:94:          "source": "prototype#行操作"
openspec/changes/doc-property-and-search-panel/conformance.json:101:          "source": "prototype#拖拽排序"
openspec/changes/doc-property-and-search-panel/conformance.json:114:          "source": "prototype#彩色胶囊"
openspec/changes/doc-property-and-search-panel/conformance.json:121:          "source": "prototype#标签建议"
openspec/changes/doc-property-and-search-panel/conformance.json:134:          "source": "决策#第十二轮属1"
openspec/changes/doc-property-and-search-panel/conformance.json:141:          "source": "prototype#别称表"
openspec/changes/doc-property-and-search-panel/conformance.json:148:          "source": "prototype#托管日期"
openspec/changes/doc-property-and-search-panel/conformance.json:161:          "source": "prototype#新建默认"
openspec/changes/doc-property-and-search-panel/conformance.json:168:          "source": "prototype#模板套用"
openspec/changes/doc-property-and-search-panel/conformance.json:181:          "source": "prototype#收编"
openspec/changes/doc-property-and-search-panel/conformance.json:194:          "source": "prototype#自由键"
openspec/changes/doc-property-and-search-panel/conformance.json:201:          "source": "prototype#单事务"
openspec/changes/doc-property-and-search-panel/conformance.json:214:          "source": "baseline/panel-a-edit.png"
openspec/changes/doc-property-and-search-panel/conformance.json:221:          "source": "baseline/panel-b-preview.png"
openspec/changes/doc-property-and-search-panel/conformance.json:234:          "source": "prototype#浮窗壳V2"
openspec/changes/doc-property-and-search-panel/conformance.json:241:          "source": "prototype#拖拽缩放"
openspec/changes/doc-property-and-search-panel/conformance.json:248:          "source": "baseline/search-default.png"
openspec/changes/doc-property-and-search-panel/conformance.json:261:          "source": "prototype#结果列表"
openspec/changes/doc-property-and-search-panel/conformance.json:274:          "source": "prototype#双行结果"
openspec/changes/doc-property-and-search-panel/conformance.json:281:          "source": "prototype#行尾快捷键"
openspec/changes/doc-property-and-search-panel/conformance.json:288:          "source": "prototype#9行视口"
openspec/changes/doc-property-and-search-panel/conformance.json:301:          "source": "prototype#替换diff"
openspec/changes/doc-property-and-search-panel/conformance.json:308:          "source": "决策#第二轮搜1"
openspec/changes/doc-property-and-search-panel/conformance.json:315:          "source": "prototype#悬停卡"
openspec/changes/doc-property-and-search-panel/conformance.json:322:          "source": "baseline/search-replace.png"
openspec/changes/doc-property-and-search-panel/conformance.json:335:          "source": "决策#5"
openspec/changes/doc-property-and-search-panel/conformance.json:342:          "source": "决策#5"
openspec/specs/extensions/spec.md:1:# extensions — 数据文件扩展点当前规格
openspec/specs/extensions/spec.md:11:- `openspec/changes/extension-points/design.md`（D1–D6）
openspec/specs/extensions/spec.md:13:- Rust 侧实现：`src-tauri/src/extensions.rs`；前端：`src/lib/extensions/`、`src/editors/user-extensions.ts`
openspec/changes/archive/2026-11-13-editor-surface-batch16/conformance.json:13:          "source": "#695 第 6 项 / design D5"
openspec/changes/archive/2026-11-13-editor-surface-batch16/conformance.json:20:          "source": "#695 第 7 项 / design D5"
openspec/changes/archive/2026-11-13-editor-surface-batch16/conformance.json:27:          "source": "#695 第 7 项 / design D5"
openspec/changes/archive/2026-11-13-editor-surface-batch16/conformance.json:40:          "source": "#695 第 8 项 / design D7"
openspec/changes/archive/2026-11-13-editor-surface-batch16/conformance.json:47:          "source": "#695 第 8 项 / design D8"
openspec/changes/archive/2026-11-13-editor-surface-batch16/conformance.json:54:          "source": "#695 第 8 项 / design D7"
openspec/changes/archive/2026-11-13-editor-surface-batch16/conformance.json:67:          "source": "#695 第 1 项 / design D1"
openspec/changes/archive/2026-11-13-editor-surface-batch16/conformance.json:74:          "source": "#695 第 2 项 / design D2"
openspec/changes/archive/2026-11-13-editor-surface-batch16/conformance.json:81:          "source": "#695 第 3 项 / design D3"
openspec/changes/archive/2026-11-13-editor-surface-batch16/conformance.json:94:          "source": "#695 第 10 项 / design D10"
openspec/changes/archive/2026-11-13-editor-surface-batch16/conformance.json:101:          "source": "#695 第 10 项 / design D10"
openspec/changes/archive/2026-11-13-editor-surface-batch16/conformance.json:108:          "source": "#695 第 11 项 / design D11"
openspec/changes/archive/2026-11-13-editor-surface-batch16/conformance.json:115:          "source": "#695 第 11 项 / design D11"
openspec/changes/archive/2026-11-13-editor-surface-batch16/conformance.json:128:          "source": "#695 图片段第 1 项 / design D13"
openspec/changes/archive/2026-11-13-editor-surface-batch16/conformance.json:135:          "source": "#695 图片段第 1 项 / design D13"
openspec/changes/archive/2026-11-13-editor-surface-batch16/conformance.json:142:          "source": "#695 图片段第 1 项 / design D13"
openspec/changes/archive/2026-11-13-editor-surface-batch16/conformance.json:155:          "source": "#695 图片段第 2 项 / design D14"
openspec/changes/archive/2026-11-13-editor-surface-batch16/conformance.json:162:          "source": "#695 图片段第 2 项 / design D14"
openspec/changes/archive/2026-11-13-editor-surface-batch16/conformance.json:169:          "source": "#695 图片段第 4 项 / design D14"
openspec/changes/archive/2026-11-13-editor-surface-batch16/conformance.json:176:          "source": "#695 图片段第 5 项 / design D14"
openspec/changes/archive/2026-11-13-editor-surface-batch16/conformance.json:183:          "source": "#695 图片段第 6 项 / design D14"
openspec/changes/archive/2026-11-13-editor-surface-batch16/conformance.json:196:          "source": "#695 图片段第 7 项 / design D15"
openspec/changes/archive/2026-11-13-editor-surface-batch16/conformance.json:203:          "source": "#695 图片段第 7 项 / design D15"
openspec/changes/archive/2026-11-13-editor-surface-batch16/conformance.json:210:          "source": "#695 图片段第 11 项 / design D15"
openspec/changes/archive/2026-11-13-editor-surface-batch16/conformance.json:223:          "source": "#695 图片段第 8 项 / design D16"
openspec/changes/archive/2026-11-13-editor-surface-batch16/conformance.json:230:          "source": "#695 图片段第 8 项 / design D16"
openspec/changes/archive/2026-11-13-editor-surface-batch16/conformance.json:237:          "source": "#695 图片段第 8 项 / design D16"
openspec/changes/archive/2026-11-13-editor-surface-batch16/conformance.json:244:          "source": "#695 图片段第 8 项 / design D16"
openspec/changes/archive/2026-11-13-editor-surface-batch16/conformance.json:257:          "source": "#695 第 12 项 / design D19"
openspec/changes/archive/2026-11-13-editor-surface-batch16/conformance.json:264:          "source": "#695 图片段第 10 项 / design D18"
openspec/changes/archive/2026-11-13-editor-surface-batch16/conformance.json:271:          "source": "#695 图片段第 10 项 / design D18"
openspec/changes/archive/2026-11-13-editor-surface-batch16/conformance.json:284:          "source": "#695 第 6 项 / design D5"
openspec/changes/archive/2026-11-13-editor-surface-batch16/conformance.json:291:          "source": "#695 第 9 项 / design D6"
openspec/changes/archive/2026-11-13-editor-surface-batch16/conformance.json:304:          "source": "#695 图片段第 9 项 / design D17"
openspec/changes/archive/2026-11-13-editor-surface-batch16/conformance.json:311:          "source": "#695 图片段第 9 项 / design D17"
openspec/changes/archive/2026-11-13-editor-surface-batch16/conformance.json:324:          "source": "#695 第 13 项 / design D12"
openspec/changes/archive/2026-11-13-editor-surface-batch16/conformance.json:331:          "source": "#695 第 13 项 / design D12"
openspec/changes/archive/2026-11-13-editor-surface-batch16/conformance.json:338:          "source": "#695 第 13 项 / design D12"
openspec/changes/archive/2026-11-13-editor-surface-batch16/conformance.json:345:          "source": "#695 第 13 项 / design D12"
openspec/changes/archive/2026-11-13-editor-surface-batch16/conformance.json:358:          "source": "实测 2026-11-13 / #518 AC / design Context"
openspec/changes/archive/2026-11-13-editor-surface-batch16/conformance.json:365:          "source": "#518 AC / design Context"
openspec/changes/archive/2026-11-13-editor-surface-batch16/conformance.json:372:          "source": "实测 2026-11-13（基线 1/5 失败）"
openspec/changes/archive/2026-11-10-roulette-callout-types/conformance.json:13:          "source": "CALLOUT_EDIT_TYPES"
openspec/changes/archive/2026-11-10-roulette-callout-types/conformance.json:20:          "source": "CALLOUT_EDIT_TYPES"
openspec/changes/archive/2026-11-10-roulette-callout-types/conformance.json:27:          "source": "CALLOUT_EDIT_TYPES"
openspec/changes/archive/2026-11-10-roulette-callout-types/conformance.json:34:          "source": "用户反馈"
openspec/changes/archive/2026-11-10-roulette-callout-types/conformance.json:47:          "source": "用户反馈"
openspec/changes/archive/2026-11-08-shell-media-batch7/conformance.json:13:          "source": "spec 状态栏"
openspec/changes/archive/2026-11-08-shell-media-batch7/conformance.json:20:          "source": "spec 状态栏"
openspec/changes/archive/2026-11-08-shell-media-batch7/conformance.json:27:          "source": "spec 状态栏"
openspec/changes/archive/2026-11-08-shell-media-batch7/conformance.json:34:          "source": "spec 状态栏"
openspec/changes/archive/2026-11-08-shell-media-batch7/conformance.json:41:          "source": "design D-1"
openspec/changes/archive/2026-11-08-shell-media-batch7/conformance.json:54:          "source": "design D-3"
openspec/changes/archive/2026-11-08-shell-media-batch7/conformance.json:61:          "source": "spec 状态栏 / design D-3"
openspec/changes/archive/2026-11-08-shell-media-batch7/conformance.json:68:          "source": "design D-1"
openspec/changes/archive/2026-11-08-shell-media-batch7/conformance.json:75:          "source": "design D-3"
openspec/changes/archive/2026-11-08-shell-media-batch7/conformance.json:88:          "source": "spec「关闭其他」图标可辨"
openspec/changes/archive/2026-11-08-shell-media-batch7/conformance.json:95:          "source": "spec「关闭其他」图标可辨"
openspec/changes/archive/2026-11-08-shell-media-batch7/conformance.json:102:          "source": "spec「关闭其他」图标可辨"
openspec/changes/archive/2026-11-08-shell-media-batch7/conformance.json:115:          "source": "spec C-6"
openspec/changes/archive/2026-11-08-shell-media-batch7/conformance.json:122:          "source": "spec C-6"
openspec/changes/archive/2026-11-08-shell-media-batch7/conformance.json:129:          "source": "spec C-6"
openspec/changes/archive/2026-11-08-shell-media-batch7/conformance.json:136:          "source": "spec C-6"
openspec/changes/archive/2026-11-08-shell-media-batch7/conformance.json:143:          "source": "spec C-6"
openspec/changes/archive/2026-11-08-shell-media-batch7/conformance.json:150:          "source": "spec C-6"
openspec/changes/archive/2026-11-08-shell-media-batch7/conformance.json:157:          "source": "spec C-6"
openspec/changes/archive/2026-11-08-shell-media-batch7/conformance.json:164:          "source": "design D-8"
openspec/changes/archive/2026-11-08-shell-media-batch7/conformance.json:177:          "source": "spec G-10"
openspec/changes/archive/2026-11-08-shell-media-batch7/conformance.json:184:          "source": "spec G-10"
openspec/changes/archive/2026-11-08-shell-media-batch7/conformance.json:191:          "source": "spec G-10"
openspec/changes/archive/2026-11-08-shell-media-batch7/conformance.json:198:          "source": "spec G-10"
openspec/changes/archive/2026-11-08-shell-media-batch7/conformance.json:205:          "source": "spec G-10"
openspec/changes/archive/2026-11-08-shell-media-batch7/conformance.json:212:          "source": "design D-9"
openspec/changes/archive/2026-11-08-shell-media-batch7/conformance.json:225:          "source": "spec chrome 前景色"
openspec/changes/archive/2026-11-08-shell-media-batch7/conformance.json:232:          "source": "spec chrome 前景色"
openspec/changes/archive/2026-11-08-shell-media-batch7/conformance.json:239:          "source": "spec chrome 前景色"
openspec/changes/archive/2026-11-08-shell-media-batch7/conformance.json:246:          "source": "spec chrome 前景色"
openspec/changes/archive/2026-11-08-shell-media-batch7/conformance.json:259:          "source": "spec A-13"
openspec/changes/archive/2026-11-08-shell-media-batch7/conformance.json:266:          "source": "spec A-13"
openspec/changes/archive/2026-11-08-shell-media-batch7/conformance.json:273:          "source": "spec A-13"
openspec/changes/archive/2026-11-08-shell-media-batch7/conformance.json:280:          "source": "spec A-13"
openspec/changes/archive/2026-11-08-shell-media-batch7/conformance.json:287:          "source": "spec A-13"
openspec/changes/archive/2026-11-08-shell-media-batch7/conformance.json:300:          "source": "spec 一键自动布局"
openspec/changes/archive/2026-11-08-shell-media-batch7/conformance.json:307:          "source": "spec 一键自动布局"
openspec/changes/archive/2026-11-08-shell-media-batch7/conformance.json:314:          "source": "spec 一键自动布局"
openspec/changes/archive/2026-11-08-shell-media-batch7/conformance.json:321:          "source": "spec 一键自动布局"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:13:          "source": "#833 A1 / design D1"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:20:          "source": "#833 A1 / design D1"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:27:          "source": "#833 A1 / design D1"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:40:          "source": "#833 A2 / design D2"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:47:          "source": "#833 A2 / design D2"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:60:          "source": "一手观察：复现文档 / design D1"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:67:          "source": "#833 A3 / design D1"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:74:          "source": "一手观察：复现文档 / design D1"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:87:          "source": "#833 A4 / design D3"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:94:          "source": "#833 A4 / design D3（DEFAULT＝移除）"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:101:          "source": "#833 A4 / design D3"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:108:          "source": "#833 A4 / design D3"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:121:          "source": "#833 A5 / design D3"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:128:          "source": "#833 A5 / design D3"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:135:          "source": "#833 A5 / design D3"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:148:          "source": "#833 A6 / design D4"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:155:          "source": "#833 A6 / design D4"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:168:          "source": "#833 A7 / design D5"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:175:          "source": "#833 A7 / design D5"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:182:          "source": "#833 A7 / design D5"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:189:          "source": "#833 A7 / design D5"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:202:          "source": "#833 A8 / 截图：单元格转换手柄 / design D1"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:209:          "source": "#833 A8 / design D1"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:222:          "source": "截图：单元格转换手柄1-任务 / design D6"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:229:          "source": "截图：单元格新增手柄 / design D6"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:236:          "source": "#833 A9 / design D6"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:243:          "source": "截图：单元格转换手柄1-任务 / design D6"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:256:          "source": "#833 B1 / design D7"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:263:          "source": "#833 B1 / design D7"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:270:          "source": "#833 B1 / design D7"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:277:          "source": "#833 B1 / design D7"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:290:          "source": "#833 B3 / design D7"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:297:          "source": "#833 B3 / design D7"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:310:          "source": "#833 B2 / design D8"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:317:          "source": "#833 B2 / design D8"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:330:          "source": "#833 B4 / design D9"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:337:          "source": "#833 B4 / design D9"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:344:          "source": "#833 B4 / design D9"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:357:          "source": "截图：文件信息 / design D9"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:364:          "source": "截图：文件信息 / design D9"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:371:          "source": "截图：文件信息 / design D9"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:384:          "source": "#833 B6 / design D11"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:391:          "source": "#833 B6 / design D11"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:404:          "source": "#833 B5 / design D10"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:411:          "source": "#833 B5 / design D10"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:418:          "source": "#833 B5 / design D10"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:431:          "source": "#833 B5 / design D10"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:438:          "source": "#833 B5 / design D10"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:451:          "source": "#833 B5 / design D10"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:458:          "source": "#833 B5 / design D10"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:465:          "source": "#833 B5 / design D10"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:478:          "source": "#833 C1 / design D12"
openspec/changes/archive/2026-11-15-editor-surface-batch19/conformance.json:485:          "source": "#833 C1 / design D12"

exec
/bin/zsh -c "nl -ba src-tauri/src/extension_packages.rs | sed -n '860,940p;1070,1125p;1340,1395p'
rg -n 'types =|type =|kind =|type:' docs/design docs/research docs/requirements openspec | rg 'plugin|extension|manifest|扩展' | sed -n '1,240p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
   860	            context: "read extension skill task join".into(),
   861	            source: std::io::Error::other(e.to_string()),
   862	        })?
   863	}
   864	
   865	#[cfg(test)]
   866	mod tests {
   867	    use super::*;
   868	
   869	    fn temp_base(tag: &str) -> tempfile::TempDir {
   870	        tempfile::Builder::new()
   871	            .prefix(&format!("biaoyue_extpkg_{tag}_"))
   872	            .tempdir()
   873	            .expect("create temp dir")
   874	    }
   875	
   876	    fn write_package(base: &Path, id: &str, source: &str, name: &str) -> PathBuf {
   877	        let dir = base.join("extensions").join(id);
   878	        std::fs::create_dir_all(&dir).unwrap();
   879	        let manifest = serde_json::json!({
   880	            "id": id,
   881	            "name": name,
   882	            "version": "1.2.3",
   883	            "description": format!("{name} 的描述"),
   884	            "source": source,
   885	        });
   886	        std::fs::write(
   887	            dir.join(MANIFEST_FILE),
   888	            serde_json::to_string_pretty(&manifest).unwrap(),
   889	        )
   890	        .unwrap();
   891	        std::fs::write(dir.join(SKILL_FILE), format!("# {name}\n\n正文\n")).unwrap();
   892	        dir
   893	    }
   894	
   895	    #[test]
   896	    fn list_returns_builtins_and_user_packages_with_disabled_flag() {
   897	        let dir = temp_base("list");
   898	        let base = dir.path().to_path_buf();
   899	        write_package(&base, "user-one", "user", "用户扩展一");
   900	        write_package(&base, "ai-two", "ai", "AI 扩展二");
   901	        std::fs::write(base.join("extensions/ai-two").join(DISABLED_MARKER), b"").unwrap();
   902	
   903	        let packages = list_extension_packages_at(&base).unwrap();
   904	
   905	        let ids: Vec<&str> = packages.iter().map(|p| p.id.as_str()).collect();
   906	        assert_eq!(ids[0], BUILTIN_READING);
   907	        assert_eq!(ids[1], BUILTIN_OUTLINE);
   908	        assert!(ids.contains(&"user-one"));
   909	        assert!(ids.contains(&"ai-two"));
   910	
   911	        let builtin = &packages[0];
   912	        assert_eq!(builtin.source, "builtin");
   913	        assert!(builtin.enabled);
   914	        assert!(builtin.dir.is_none());
   915	
   916	        let user = packages.iter().find(|p| p.id == "user-one").unwrap();
   917	        assert!(user.enabled);
   918	        assert!(user.dir.as_deref().unwrap().ends_with("user-one"));
   919	        assert_eq!(user.skill, "# 用户扩展一\n\n正文\n");
   920	
   921	        let ai = packages.iter().find(|p| p.id == "ai-two").unwrap();
   922	        assert!(!ai.enabled, ".disabled 标记应反映为停用");
   923	    }
   924	
   925	    #[test]
   926	    fn list_without_extensions_dir_returns_only_builtins() {
   927	        let dir = temp_base("empty");
   928	        let base = dir.path().to_path_buf();
   929	        let packages = list_extension_packages_at(&base).unwrap();
   930	        assert_eq!(packages.len(), 2);
   931	        assert!(packages.iter().all(|p| p.source == "builtin"));
   932	    }
   933	
   934	    #[test]
   935	    fn import_folder_copies_manifest_and_skill_and_enables() {
   936	        let dir = temp_base("import");
   937	        let base = dir.path().to_path_buf();
   938	        let src = base.join("incoming");
   939	        std::fs::create_dir_all(&src).unwrap();
   940	        std::fs::write(
  1070	            !installed.join("link.txt").exists(),
  1071	            "符号链接不应出现在旧包目录"
  1072	        );
  1073	    }
  1074	
  1075	    #[test]
  1076	    fn import_rejects_invalid_manifest_and_missing_skill() {
  1077	        let dir = temp_base("invalid");
  1078	        let base = dir.path().to_path_buf();
  1079	
  1080	        // 非法 id
  1081	        let bad_id = base.join("bad-id");
  1082	        std::fs::create_dir_all(&bad_id).unwrap();
  1083	        std::fs::write(
  1084	            bad_id.join(MANIFEST_FILE),
  1085	            r#"{"id":"Bad_ID","name":"x","version":"1.0.0","description":"d","source":"user"}"#,
  1086	        )
  1087	        .unwrap();
  1088	        std::fs::write(bad_id.join(SKILL_FILE), "# x\n").unwrap();
  1089	        assert!(import_extension_package_at(&base, bad_id.to_str().unwrap()).is_err());
  1090	
  1091	        // 缺 SKILL.md
  1092	        let no_skill = base.join("no-skill");
  1093	        std::fs::create_dir_all(&no_skill).unwrap();
  1094	        std::fs::write(
  1095	            no_skill.join(MANIFEST_FILE),
  1096	            r#"{"id":"no-skill","name":"x","version":"1.0.0","description":"d","source":"user"}"#,
  1097	        )
  1098	        .unwrap();
  1099	        assert!(import_extension_package_at(&base, no_skill.to_str().unwrap()).is_err());
  1100	
  1101	        // manifest 不是 JSON
  1102	        let bad_json = base.join("bad-json");
  1103	        std::fs::create_dir_all(&bad_json).unwrap();
  1104	        std::fs::write(bad_json.join(MANIFEST_FILE), "not json").unwrap();
  1105	        std::fs::write(bad_json.join(SKILL_FILE), "# x\n").unwrap();
  1106	        assert!(import_extension_package_at(&base, bad_json.to_str().unwrap()).is_err());
  1107	
  1108	        // 非法 source
  1109	        let bad_source = base.join("bad-source");
  1110	        std::fs::create_dir_all(&bad_source).unwrap();
  1111	        std::fs::write(
  1112	            bad_source.join(MANIFEST_FILE),
  1113	            r#"{"id":"bad-source","name":"x","version":"1.0.0","description":"d","source":"whatever"}"#,
  1114	        )
  1115	        .unwrap();
  1116	        std::fs::write(bad_source.join(SKILL_FILE), "# x\n").unwrap();
  1117	        assert!(import_extension_package_at(&base, bad_source.to_str().unwrap()).is_err());
  1118	    }
  1119	
  1120	    #[test]
  1121	    fn toggle_writes_and_removes_disabled_marker() {
  1122	        let dir = temp_base("toggle");
  1123	        let base = dir.path().to_path_buf();
  1124	        write_package(&base, "toggle-me", "user", "开关扩展");
  1125	
  1340	        assert!(base.join("extensions/nested-ext/SKILL.md").exists());
  1341	    }
  1342	
  1343	    #[test]
  1344	    fn read_extension_skill_returns_builtin_and_user_text() {
  1345	        let dir = temp_base("read");
  1346	        let base = dir.path().to_path_buf();
  1347	        write_package(&base, "readable", "user", "可读扩展");
  1348	
  1349	        assert_eq!(
  1350	            read_extension_skill_at(&base, BUILTIN_READING).unwrap(),
  1351	            BUILTIN_READING_SKILL
  1352	        );
  1353	        assert_eq!(
  1354	            read_extension_skill_at(&base, "readable").unwrap(),
  1355	            "# 可读扩展\n\n正文\n"
  1356	        );
  1357	        assert!(read_extension_skill_at(&base, "ghost").is_err());
  1358	    }
  1359	
  1360	    #[test]
  1361	    fn enabled_skill_context_includes_only_enabled_non_builtin_packages() {
  1362	        let dir = temp_base("skill-context");
  1363	        let base = dir.path().to_path_buf();
  1364	        write_package(&base, "ctx-on", "user", "启用扩展");
  1365	        write_package(&base, "ctx-off", "ai", "停用扩展");
  1366	        set_extension_package_enabled_at(&base, "ctx-off", false).unwrap();
  1367	
  1368	        let context = enabled_skill_context_at(&base).unwrap();
  1369	
  1370	        assert!(context.contains("## 扩展：启用扩展"), "got {context}");
  1371	        assert!(context.contains("# 启用扩展"), "got {context}");
  1372	        assert!(!context.contains("停用扩展"), "停用扩展不应注入：{context}");
  1373	        assert!(
  1374	            !context.contains(BUILTIN_READING) && !context.contains("内置阅读"),
  1375	            "内置扩展不应注入：{context}"
  1376	        );
  1377	
  1378	        set_extension_package_enabled_at(&base, "ctx-off", true).unwrap();
  1379	        let after = enabled_skill_context_at(&base).unwrap();
  1380	        assert!(after.contains("停用扩展"), "重新启用后应注入：{after}");
  1381	    }
  1382	
  1383	    #[test]
  1384	    fn enabled_skill_context_empty_without_user_packages() {
  1385	        let dir = temp_base("skill-context-empty");
  1386	        let base = dir.path().to_path_buf();
  1387	        assert_eq!(enabled_skill_context_at(&base).unwrap(), "");
  1388	    }
  1389	
  1390	    #[test]
  1391	    fn set_enabled_on_missing_package_is_an_error_not_a_created_dir() {
  1392	        let dir = temp_base("no-create");
  1393	        let base = dir.path().to_path_buf();
  1394	        assert!(set_extension_package_enabled_at(&base, "absent", true).is_err());
  1395	        assert!(!base.join("extensions/absent").exists());
docs/research/technical/plugin-management-benchmark.md:3:type: research

exec
/bin/zsh -c "rg -n 'type ExtensionManifest|source:|manifest|env\\.toml|permissions|filesystem' docs/research/technical/plugin-management-benchmark.md docs/research/technical/data-fileization-omarchy-inventory.md docs/design/approved/layout-portal -g '*.md' | sed -n '1,320p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
docs/research/technical/data-fileization-omarchy-inventory.md:64:| 扩展管理面 | `layout-portal` [#184](https://github.com/jianxi-dev/clairis/issues/184)（已关闭） | 文件夹式扩展（manifest.json + SKILL.md）、拖入即启用、AI 生成、导出 | ✅ 已落地（`src-tauri/src/extension_packages.rs`） |
docs/research/technical/data-fileization-omarchy-inventory.md:112:| 10 | 扩展包（manifest.json + SKILL.md） | `app_config_dir()/extensions/<id>/` | ✅ 已落地 | AI 一句话生成新扩展（默认启用）+ 直接编辑 SKILL.md |
docs/research/technical/plugin-management-benchmark.md:25:**插件形态**：就是一个导出 `apply(ctx)` 的 TypeScript 模块（函数/对象/Service 类三种形式）。**没有传统 manifest 文件**——本地插件通过 `cordis.yml` patch（覆盖层）注册绝对路径，`pnpm dsh web --patch ./cordis.yml` 加载。
docs/research/technical/plugin-management-benchmark.md:40:- **社区插件**：每个插件是 vault 内 `.obsidian/plugins/<id>/` 目录（`manifest.json` + `main.js` + 可选 `styles.css` + `data.json` 存设置）。
docs/research/technical/plugin-management-benchmark.md:41:  - manifest：`id/name/author/version/minAppVersion/description`（封闭 schema）。
docs/research/technical/plugin-management-benchmark.md:63:| 插件形态 | `apply(ctx)` TS 模块 | TS/JS 模块（文件/目录/npm 包） | manifest+main.js 目录包 | 数据文件（jsonc/toml/目录约定） |
docs/research/technical/plugin-management-benchmark.md:84:- **最接近"插件"的既有机制**是 mdpkg（Markdown 打包格式）：`manifest.extensions.symbols`（`off|core|extended`）与 `extensions_required`（封闭 schema，不支持项报错 E702）——这是**文档级**的能力声明，不是应用级插件。
docs/research/technical/plugin-management-benchmark.md:109:- 形态：TS 模块 + `manifest.json`（封闭 schema：`id/name/version/minAppVersion`），目录 `~/.clairis/plugins/<id>/`；生命周期 `onload()/onunload()`，注册项统一 tracked、卸载自动清理（学 Cordis 的 effect 追踪思想，不必引框架）。
docs/research/technical/plugin-management-benchmark.md:128:| P1 | manifest + onload/onunload + 信任门，支持本地目录安装 | Pi 形态 + Obsidian 安全 |
docs/design/approved/layout-portal/spec.md:208:- **形态**：文件夹（`manifest.json` + `SKILL.md`），可打包传播

exec
/bin/zsh -c "find . -path './node_modules' -prune -o -path './.git' -prune -o \\( -name 'env.toml' -o -name 'manifest.json' \\) -print | sed -n '1,200p'
rg -n 'filesystem' . --hidden --glob '"'!node_modules/**'"' --glob '"'!.git/**'"' --glob '"'!target/**'"' --glob '"'!src-tauri/gen/**'"' | sed -n '1,240p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
./scripts/fixtures/docs-governance/valid/archive-placement/manifest.json
./scripts/fixtures/docs-governance/valid/frontmatter/manifest.json
./scripts/fixtures/docs-governance/valid/legacy-paths/manifest.json
./scripts/fixtures/docs-governance/valid/inventory/manifest.json
./scripts/fixtures/docs-governance/valid/relative-links/manifest.json
./scripts/fixtures/docs-governance/valid/canonical-uniqueness/manifest.json
./scripts/fixtures/docs-governance/qa/malformed-frontmatter/manifest.json
./scripts/fixtures/docs-governance/qa/misleading-broken-link/manifest.json
./scripts/fixtures/docs-governance/invalid/archive-placement/manifest.json
./scripts/fixtures/docs-governance/invalid/frontmatter/manifest.json
./scripts/fixtures/docs-governance/invalid/legacy-paths/manifest.json
./scripts/fixtures/docs-governance/invalid/inventory/manifest.json
./scripts/fixtures/docs-governance/invalid/relative-links/manifest.json
./scripts/fixtures/docs-governance/invalid/canonical-uniqueness/manifest.json
./src/renderers/html.ts:188:  // Already absolute (starts with /) — treat as relative to filesystem root
./codex-reviews/01-plugin.md:120:    81	- 注册型插件增补 `permissions`（声明所需权限，如 `filesystem`）
./codex-reviews/01-plugin.md:122:    83	**权限声明（修正 P1 遗漏）**：扩展包内 JSON 当前**缺 `filesystem` 权限声明**（需在 `env.toml` 声明）。manifest 的 `permissions` 字段补上，加载时校验声明的权限是否在白名单内。
./codex-reviews/01-plugin.md:183:   144	2. **P1 引用参数不准**：manifest 字段名不一致；扩展包 JSON 缺 filesystem 权限声明；THEME_EXTRA 清单与实际白名单不符；三段式 split 与 extensions.rs 实际不符 → 已采纳，§4.2 统一字段、§4.2 补权限声明、§4.3 加载管线按同步加载校正、A3 边界补「无主题切换结构」。
./codex-reviews/01-plugin.md:1783:/bin/zsh -c "rg -n --hidden --glob '"'!node_modules'"' --glob '"'!target'"' --glob '"'!dist'"' 'SKILL_MAP|seed_skill_map|SKILL_MD|theme\\.toml|THEME_EXTRA|extension|manifest|env\\.toml|filesystem|rouletteSectors|htmlToolbarItems|selectionToolbar|ROOT_SECTORS|readerFontSize|defaultNewDocFormat|defaultSavePath|SHORTCUTS|ShortcutDef|htmlToolbar|reader.*preset|font.*preset' src src-tauri docs .opencode 2>/dev/null" in /Users/mason/ToHighs/clairis-wt-design-plan
./codex-reviews/01-plugin.md:2066:src/renderers/html.ts:188:  // Already absolute (starts with /) — treat as relative to filesystem root
./codex-reviews/01-plugin.md:2069:src-tauri/gen/schemas/macOS-schema.json:40:      "description": "A grouping and boundary mechanism developers can use to isolate access to the IPC layer.\n\nIt controls application windows' and webviews' fine grained access to the Tauri core, application, or plugin commands. If a webview or its window is not matching any capability then it has no access to the IPC layer at all.\n\nThis can be done to create groups of windows, based on their required system access, which can reduce impact of frontend vulnerabilities in less privileged windows. Windows can be added to a capability by exact name (e.g. `main-window`) or glob patterns like `*` or `admin-*`. A Window can have none, one, or multiple associated capabilities.\n\n## Example\n\n```json { \"identifier\": \"main-user-files-write\", \"description\": \"This capability allows the `main` window on macOS and Windows access to `filesystem` write related commands and `dialog` commands to enable programmatic access to files selected by the user.\", \"windows\": [ \"main\" ], \"permissions\": [ \"core:default\", \"dialog:open\", { \"identifier\": \"fs:allow-write-text-file\", \"allow\": [{ \"path\": \"$HOME/test.txt\" }] }, ], \"platforms\": [\"macOS\",\"windows\"] } ```",
./codex-reviews/01-plugin.md:2070:src-tauri/gen/schemas/macOS-schema.json:52:          "description": "Description of what the capability is intended to allow on associated windows.\n\nIt should contain a description of what the grouped permissions should allow.\n\n## Example\n\nThis capability allows the `main` window access to `filesystem` write related commands and `dialog` commands to enable programmatic access to files selected by the user.",
./codex-reviews/01-plugin.md:2071:src-tauri/gen/schemas/desktop-schema.json:40:      "description": "A grouping and boundary mechanism developers can use to isolate access to the IPC layer.\n\nIt controls application windows' and webviews' fine grained access to the Tauri core, application, or plugin commands. If a webview or its window is not matching any capability then it has no access to the IPC layer at all.\n\nThis can be done to create groups of windows, based on their required system access, which can reduce impact of frontend vulnerabilities in less privileged windows. Windows can be added to a capability by exact name (e.g. `main-window`) or glob patterns like `*` or `admin-*`. A Window can have none, one, or multiple associated capabilities.\n\n## Example\n\n```json { \"identifier\": \"main-user-files-write\", \"description\": \"This capability allows the `main` window on macOS and Windows access to `filesystem` write related commands and `dialog` commands to enable programmatic access to files selected by the user.\", \"windows\": [ \"main\" ], \"permissions\": [ \"core:default\", \"dialog:open\", { \"identifier\": \"fs:allow-write-text-file\", \"allow\": [{ \"path\": \"$HOME/test.txt\" }] }, ], \"platforms\": [\"macOS\",\"windows\"] } ```",
./codex-reviews/01-plugin.md:2072:src-tauri/gen/schemas/desktop-schema.json:52:          "description": "Description of what the capability is intended to allow on associated windows.\n\nIt should contain a description of what the grouped permissions should allow.\n\n## Example\n\nThis capability allows the `main` window access to `filesystem` write related commands and `dialog` commands to enable programmatic access to files selected by the user.",
./codex-reviews/01-plugin.md:2159:docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:81:- 注册型插件增补 `permissions`（声明所需权限，如 `filesystem`）
./codex-reviews/01-plugin.md:2160:docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:83:**权限声明（修正 P1 遗漏）**：扩展包内 JSON 当前**缺 `filesystem` 权限声明**（需在 `env.toml` 声明）。manifest 的 `permissions` 字段补上，加载时校验声明的权限是否在白名单内。
./codex-reviews/01-plugin.md:2168:docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:144:2. **P1 引用参数不准**：manifest 字段名不一致；扩展包 JSON 缺 filesystem 权限声明；THEME_EXTRA 清单与实际白名单不符；三段式 split 与 extensions.rs 实际不符 → 已采纳，§4.2 统一字段、§4.2 补权限声明、§4.3 加载管线按同步加载校正、A3 边界补「无主题切换结构」。
./codex-reviews/01-plugin.md:8101:/bin/zsh -c "rg -n 'manifest\\.json|\"source\"|source:|permissions|filesystem|env\\.toml|extension' docs openspec e2e src-tauri -g '*.md' -g '*.json' -g '*.toml' -g '*.ts' -g '*.tsx' | sed -n '1,420p'" in /Users/mason/ToHighs/clairis-wt-design-plan
./codex-reviews/01-plugin.md:8106:src-tauri/gen/schemas/desktop-schema.json:40:      "description": "A grouping and boundary mechanism developers can use to isolate access to the IPC layer.\n\nIt controls application windows' and webviews' fine grained access to the Tauri core, application, or plugin commands. If a webview or its window is not matching any capability then it has no access to the IPC layer at all.\n\nThis can be done to create groups of windows, based on their required system access, which can reduce impact of frontend vulnerabilities in less privileged windows. Windows can be added to a capability by exact name (e.g. `main-window`) or glob patterns like `*` or `admin-*`. A Window can have none, one, or multiple associated capabilities.\n\n## Example\n\n```json { \"identifier\": \"main-user-files-write\", \"description\": \"This capability allows the `main` window on macOS and Windows access to `filesystem` write related commands and `dialog` commands to enable programmatic access to files selected by the user.\", \"windows\": [ \"main\" ], \"permissions\": [ \"core:default\", \"dialog:open\", { \"identifier\": \"fs:allow-write-text-file\", \"allow\": [{ \"path\": \"$HOME/test.txt\" }] }, ], \"platforms\": [\"macOS\",\"windows\"] } ```",
./codex-reviews/01-plugin.md:8108:src-tauri/gen/schemas/desktop-schema.json:52:          "description": "Description of what the capability is intended to allow on associated windows.\n\nIt should contain a description of what the grouped permissions should allow.\n\n## Example\n\nThis capability allows the `main` window access to `filesystem` write related commands and `dialog` commands to enable programmatic access to files selected by the user.",
./codex-reviews/01-plugin.md:8136:src-tauri/gen/schemas/macOS-schema.json:40:      "description": "A grouping and boundary mechanism developers can use to isolate access to the IPC layer.\n\nIt controls application windows' and webviews' fine grained access to the Tauri core, application, or plugin commands. If a webview or its window is not matching any capability then it has no access to the IPC layer at all.\n\nThis can be done to create groups of windows, based on their required system access, which can reduce impact of frontend vulnerabilities in less privileged windows. Windows can be added to a capability by exact name (e.g. `main-window`) or glob patterns like `*` or `admin-*`. A Window can have none, one, or multiple associated capabilities.\n\n## Example\n\n```json { \"identifier\": \"main-user-files-write\", \"description\": \"This capability allows the `main` window on macOS and Windows access to `filesystem` write related commands and `dialog` commands to enable programmatic access to files selected by the user.\", \"windows\": [ \"main\" ], \"permissions\": [ \"core:default\", \"dialog:open\", { \"identifier\": \"fs:allow-write-text-file\", \"allow\": [{ \"path\": \"$HOME/test.txt\" }] }, ], \"platforms\": [\"macOS\",\"windows\"] } ```",
./codex-reviews/01-plugin.md:8138:src-tauri/gen/schemas/macOS-schema.json:52:          "description": "Description of what the capability is intended to allow on associated windows.\n\nIt should contain a description of what the grouped permissions should allow.\n\n## Example\n\nThis capability allows the `main` window access to `filesystem` write related commands and `dialog` commands to enable programmatic access to files selected by the user.",
./codex-reviews/01-plugin.md:8724:/bin/zsh -c "rg -n 'type ExtensionManifest|source:|manifest|env\\.toml|permissions|filesystem' docs/research/technical/plugin-management-benchmark.md docs/research/technical/data-fileization-omarchy-inventory.md docs/design/approved/layout-portal -g '*.md' | sed -n '1,320p'" in /Users/mason/ToHighs/clairis-wt-design-plan
./docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:81:- 注册型插件增补 `permissions`（声明所需权限，如 `filesystem`）
./docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:83:**权限声明（修正 P1 遗漏）**：扩展包内 JSON 当前**缺 `filesystem` 权限声明**（需在 `env.toml` 声明）。manifest 的 `permissions` 字段补上，加载时校验声明的权限是否在白名单内。
./docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:144:2. **P1 引用参数不准**：manifest 字段名不一致；扩展包 JSON 缺 filesystem 权限声明；THEME_EXTRA 清单与实际白名单不符；三段式 split 与 extensions.rs 实际不符 → 已采纳，§4.2 统一字段、§4.2 补权限声明、§4.3 加载管线按同步加载校正、A3 边界补「无主题切换结构」。

exec
/bin/zsh -c "rg -n 'toggleCapability|capabilities\\.map|capability-' src/components/SettingsView.tsx -C 5
rg -n 'subscribeCapability|isCapabilityEnabled|applyCapabilityConfig|capabilities' src -g '*.ts' -g '*.tsx' | sed -n '1,260p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
857-    }));
858-    setHeadingFontHint("");
859-    void saveAppConfig();
860-  };
861-
862:  const toggleCapability = (id: CapabilityId, enabled: boolean) => {
863-    setCapabilityEnabled(id, enabled);
864-    setCapabilities(listCapabilities());
865-    void saveAppConfig();
866-  };
867-
--
1633-                </h2>
1634-                <p className="mb-3 text-xs text-[var(--app-text-3)]">
1635-                  能力默认全开；关闭后只是不再渲染，文档内容不受影响。
1636-                </p>
1637-                <ul className="space-y-2">
1638:                  {capabilities.map((capability) => (
1639-                    <li key={capability.id}>
1640-                      <label className="flex cursor-pointer items-start gap-2">
1641-                        <input
1642-                          type="checkbox"
1643:                          data-testid={`capability-${capability.id}`}
1644-                          checked={capability.enabled}
1645-                          onChange={(e) =>
1646:                            toggleCapability(capability.id, e.target.checked)
1647-                          }
1648-                          className="mt-0.5"
1649-                        />
1650-                        <span>
1651-                          <span className="block text-sm text-[var(--app-text)]">
src/types/index.ts:100:  capabilities?: Record<string, boolean>;
src/lib/capabilities.ts:39:export function isCapabilityEnabled(id: CapabilityId): boolean {
src/lib/capabilities.ts:61:export function subscribeCapability(listener: Listener): () => void {
src/lib/capabilities.ts:76:    enabled: isCapabilityEnabled(meta.id),
src/lib/capabilities.ts:84:    if (!isCapabilityEnabled(id)) out[id] = false;
src/lib/capabilities.ts:93:export function applyCapabilityConfig(
src/renderers/math.ts:3:import { isCapabilityEnabled } from "../lib/capabilities";
src/renderers/math.ts:43:    if (!isCapabilityEnabled("math")) return undefined;
src/renderers/math.ts:62:    if (!isCapabilityEnabled("math")) return undefined;
src/__tests__/capabilitiesGating.test.ts:6:} from "../lib/capabilities";
src/renderers/diagram/engine.ts:11:  isCapabilityEnabled,
src/renderers/diagram/engine.ts:12:  subscribeCapability,
src/renderers/diagram/engine.ts:13:} from "../../lib/capabilities";
src/renderers/diagram/engine.ts:74:  if (!isCapabilityEnabled("mermaid")) return;
src/renderers/diagram/engine.ts:82:  if (!isCapabilityEnabled("mermaid")) return;
src/renderers/diagram/engine.ts:113:  if (!isCapabilityEnabled("mermaid")) return;
src/renderers/diagram/engine.ts:119:  if (!isCapabilityEnabled("mermaid")) return;
src/renderers/diagram/engine.ts:140:subscribeCapability((id, enabled) => {
src/hooks/useConfig.ts:18:  applyCapabilityConfig,
src/hooks/useConfig.ts:20:} from "../lib/capabilities";
src/hooks/useConfig.ts:73:  capabilities?: Record<string, boolean> | null;
src/hooks/useConfig.ts:176:    capabilities: serializeCapabilities(),
src/hooks/useConfig.ts:419:    capabilities: raw.capabilities ?? {},
src/hooks/useConfig.ts:488:  applyCapabilityConfig(raw.capabilities);
src/components/SettingsView.tsx:14:} from "../lib/capabilities";
src/components/SettingsView.tsx:610:  const [capabilities, setCapabilities] = useState(listCapabilities);
src/components/SettingsView.tsx:1638:                  {capabilities.map((capability) => (
src/__tests__/renderers/diagramEngine.test.ts:2:import { resetCapabilities } from "../../lib/capabilities";
src/components/Content/PreviewView.tsx:7:  isCapabilityEnabled,
src/components/Content/PreviewView.tsx:8:  subscribeCapability,
src/components/Content/PreviewView.tsx:9:} from "../../lib/capabilities";
src/components/Content/PreviewView.tsx:54:    if (!isCapabilityEnabled("preview-zoom")) return;
src/components/Content/PreviewView.tsx:76:      if (!isCapabilityEnabled("preview-zoom")) return;
src/components/Content/PreviewView.tsx:147:    () => subscribeCapability(() => setCapabilityEpoch((n) => n + 1)),
src/components/Content/PreviewView.tsx:303:    if (!isCapabilityEnabled("preview-zoom")) return;
src/__tests__/components/SettingsView.test.tsx:6:import { resetCapabilities } from "../../lib/capabilities";
src/editors/decorations/math.ts:25:import { isCapabilityEnabled } from "../../lib/capabilities";
src/editors/decorations/math.ts:175:  if (!isCapabilityEnabled("math")) return [];
src/__tests__/lib/capabilities.test.ts:4:  applyCapabilityConfig,
src/__tests__/lib/capabilities.test.ts:7:  isCapabilityEnabled,
src/__tests__/lib/capabilities.test.ts:12:  subscribeCapability,
src/__tests__/lib/capabilities.test.ts:13:} from "../../lib/capabilities";
src/__tests__/lib/capabilities.test.ts:22:      expect(isCapabilityEnabled(meta.id)).toBe(true);
src/__tests__/lib/capabilities.test.ts:35:    expect(isCapabilityEnabled("mermaid")).toBe(false);
src/__tests__/lib/capabilities.test.ts:37:    expect(isCapabilityEnabled("mermaid")).toBe(true);
src/__tests__/lib/capabilities.test.ts:42:    subscribeCapability(listener);
src/__tests__/lib/capabilities.test.ts:54:    subscribeCapability(listener);
src/__tests__/lib/capabilities.test.ts:66:    subscribeCapability(listener);
src/__tests__/lib/capabilities.test.ts:67:    subscribeCapability(listener);
src/__tests__/lib/capabilities.test.ts:76:    const unsubscribe = subscribeCapability(listener);
src/__tests__/lib/capabilities.test.ts:86:    subscribeCapability(() => calls.push("a"));
src/__tests__/lib/capabilities.test.ts:87:    subscribeCapability(() => calls.push("b"));
src/__tests__/lib/capabilities.test.ts:104:    applyCapabilityConfig({ math: false, "not-a-capability": false });
src/__tests__/lib/capabilities.test.ts:106:    expect(isCapabilityEnabled("math")).toBe(false);
src/__tests__/lib/capabilities.test.ts:107:    expect(isCapabilityEnabled("mermaid")).toBe(true);
src/__tests__/lib/capabilities.test.ts:112:    applyCapabilityConfig({ math: false });
src/__tests__/lib/capabilities.test.ts:113:    subscribeCapability(listener);
src/__tests__/lib/capabilities.test.ts:115:    applyCapabilityConfig({ math: false });
src/__tests__/lib/capabilities.test.ts:116:    applyCapabilityConfig({ math: false });
src/__tests__/lib/capabilities.test.ts:123:    applyCapabilityConfig({ math: true });
src/__tests__/lib/capabilities.test.ts:125:    expect(isCapabilityEnabled("math")).toBe(true);
src/__tests__/lib/capabilities.test.ts:130:    applyCapabilityConfig(null);
src/__tests__/lib/capabilities.test.ts:131:    applyCapabilityConfig(undefined);
src/__tests__/lib/capabilities.test.ts:133:    expect(isCapabilityEnabled("math")).toBe(false);
src/__tests__/lib/capabilities.test.ts:140:    subscribeCapability(listener);
src/__tests__/lib/capabilities.test.ts:146:    expect(isCapabilityEnabled("math")).toBe(true);

exec
/bin/zsh -c "rg -n 'PANE_MENU_ITEMS|EXPORT_MENU_ITEMS|AI_PANE_MENU_ITEMS|PANE_MENU|EXPORT_MENU|AI_PANE' src -g '*.ts' -g '*.tsx' | sed -n '1,260p'
rg -n 'export.*config|exportSettings|export.*preset|export.*设置|导出设置' src src-tauri docs -g '*.ts' -g '*.tsx' -g '*.rs' -g '*.md' | sed -n '1,240p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src/lib/paneHeaderMenu.ts:45:export const PANE_MENU_ITEMS: readonly PaneMenuItem[] = [
src/lib/paneHeaderMenu.ts:56:export const EXPORT_MENU_ITEMS: readonly ExportMenuItem[] = [
src/lib/paneHeaderMenu.ts:69:export const AI_PANE_MENU_ITEMS: readonly PaneMenuItem[] = [
src/stores/index.ts:75:export const AI_PANE_ID = "ai";
src/stores/index.ts:1510:    if (findLeaf(state.paneRoot, AI_PANE_ID)) return AI_PANE_ID;
src/stores/index.ts:1513:      id: AI_PANE_ID,
src/stores/index.ts:1533:    return AI_PANE_ID;
src/stores/index.ts:1538:    if (!findLeaf(state.paneRoot, AI_PANE_ID)) return;
src/stores/index.ts:1539:    const sibling = siblingLeafId(state.paneRoot, AI_PANE_ID);
src/stores/index.ts:1540:    const { root, removed } = removeLeaf(state.paneRoot, AI_PANE_ID);
src/stores/index.ts:1543:      state.focusedPaneId === AI_PANE_ID
src/stores/index.ts:1551:        state.fullscreenPaneId === AI_PANE_ID ? null : state.fullscreenPaneId,
src/components/TabBar.tsx:27:import { EXPORT_MENU_ITEMS } from "../lib/paneHeaderMenu";
src/components/TabBar.tsx:764:                {EXPORT_MENU_ITEMS.map((sub) => (
src/__tests__/aiForms.test.ts:18:import { useStore, AI_PANE_ID } from "../stores/index";
src/__tests__/aiForms.test.ts:67:    expect(findLeaf(useStore.getState().paneRoot, AI_PANE_ID)?.kind).toBe("ai");
src/__tests__/aiForms.test.ts:73:    expect(findLeaf(useStore.getState().paneRoot, AI_PANE_ID)).toBeNull();
src/__tests__/aiForms.test.ts:83:    expect(aiLeaves[0].id).toBe(AI_PANE_ID);
src/__tests__/aiForms.test.ts:88:    expect(findLeaf(useStore.getState().paneRoot, AI_PANE_ID)).not.toBeNull();
src/__tests__/aiForms.test.ts:89:    useStore.getState().closePane(AI_PANE_ID);
src/__tests__/aiForms.test.ts:90:    expect(findLeaf(useStore.getState().paneRoot, AI_PANE_ID)).toBeNull();
src/components/Content/PaneTreeView.tsx:29:  AI_PANE_MENU_ITEMS,
src/components/Content/PaneTreeView.tsx:30:  PANE_MENU_ITEMS,
src/components/Content/PaneTreeView.tsx:623:                {PANE_MENU_ITEMS.map((item) => (
src/components/Content/PaneTreeView.tsx:731:              {AI_PANE_MENU_ITEMS.map((item) => (
src/__tests__/paneHeader.test.tsx:4:  EXPORT_MENU_ITEMS,
src/__tests__/paneHeader.test.tsx:5:  PANE_MENU_ITEMS,
src/__tests__/paneHeader.test.tsx:51:    expect(PANE_MENU_ITEMS.map((i) => i.label)).toEqual([
src/__tests__/paneHeader.test.tsx:62:    for (const item of PANE_MENU_ITEMS) {
src/__tests__/paneHeader.test.tsx:65:    const labels = PANE_MENU_ITEMS.map((i) => i.label);
src/__tests__/paneHeader.test.tsx:70:    expect(PANE_MENU_ITEMS.map((i) => i.icon)).not.toContain("expand");
src/__tests__/paneHeader.test.tsx:76:    expect(EXPORT_MENU_ITEMS.map((i) => i.label)).toEqual([
src/__tests__/paneHeader.test.tsx:87:    expect(EXPORT_MENU_ITEMS.map((i) => i.action)).not.toContain("print");
src/lib/aiViewSpec.ts:234:export function presetById(id: string): SpecPreset | undefined {
src/hooks/useConfig.ts:202:export function applyPropertyBarConfig(config: PropertyBarConfig): void {
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:47:| B7 | **导出配置** | 导出菜单代码常量，无持久化导出设置 | 配置型 | AGENT 自定义导出格式 |
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:69:| B8 | **导出配置** | 导出菜单是代码常量（6 项，`paneHeaderMenu.ts`），**无任何持久化导出设置**（`exportFormat` 零命中） | `user/export.json`：格式清单、默认格式、选项开关 | AGENT 自定义导出格式选项与默认 |

exec
/bin/zsh -c "rg -n 'scope' src/lib/shortcuts.ts | sed -n '1,120p'
rg -n 'scope:' src/lib/shortcuts.ts | wc -l
rg -n 'SHORTCUTS|shortcutsByFamily|coreShortcuts' src -g '*.ts' -g '*.tsx' | sed -n '1,180p'
rg -n 'e\\.key|keydown|keyup|global-shortcut|shortcut' src/App.tsx src/main.tsx src/hooks src/lib src/editors -g '*.ts' -g '*.tsx' | sed -n '1,320p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
31:  scope?: ShortcutScope;
32:  /** 局部键的生效上下文描述；scope 为 local 时必填。 */
519:    scope: "local",
528:    scope: "local",
562:    (s) => s.id === id && s.scope === "local" && s.context === context,
       2
src/lib/shortcuts.ts:68:export const SHORTCUTS: readonly ShortcutDef[] = [
src/lib/shortcuts.ts:535:export function coreShortcuts(): ShortcutDef[] {
src/lib/shortcuts.ts:536:  return SHORTCUTS.filter((s) => s.core);
src/lib/shortcuts.ts:540:export function shortcutsByFamily(family: ShortcutFamily): ShortcutDef[] {
src/lib/shortcuts.ts:541:  return SHORTCUTS.filter((s) => s.family === family);
src/lib/shortcuts.ts:561:  return SHORTCUTS.some(
src/components/SettingsView.tsx:54:  coreShortcuts,
src/components/SettingsView.tsx:55:  shortcutsByFamily,
src/components/SettingsView.tsx:2444:                {coreShortcuts().map((shortcut) => (
src/components/SettingsView.tsx:2470:                    const items = shortcutsByFamily(family);
src/components/ShortcutOverlay.tsx:6:  shortcutsByFamily,
src/components/ShortcutOverlay.tsx:12: * `?` 全局开关（App 层处理），全表与 `SHORTCUTS` 注册表严格相等；按家族分组，
src/components/ShortcutOverlay.tsx:68:            const items = shortcutsByFamily(family);
src/__tests__/lib/shortcuts.test.ts:3:  SHORTCUTS,
src/__tests__/lib/shortcuts.test.ts:7:  coreShortcuts,
src/__tests__/lib/shortcuts.test.ts:9:  shortcutsByFamily,
src/__tests__/lib/shortcuts.test.ts:22:    const ids = SHORTCUTS.map((s) => s.id);
src/__tests__/lib/shortcuts.test.ts:27:    expect(shortcutsByFamily("global")).toHaveLength(12);
src/__tests__/lib/shortcuts.test.ts:28:    expect(coreShortcuts()).toHaveLength(7);
src/__tests__/lib/shortcuts.test.ts:29:    expect(coreShortcuts().every((s) => s.family === "global")).toBe(true);
src/__tests__/lib/shortcuts.test.ts:33:    expect(shortcutsByFamily("typeFilter")).toHaveLength(9);
src/__tests__/lib/shortcuts.test.ts:38:    for (const shortcut of SHORTCUTS) {
src/__tests__/lib/shortcuts.test.ts:51:    const globals = shortcutsByFamily("global");
src/__tests__/lib/shortcuts.test.ts:57:    const locals = SHORTCUTS.filter((s) => s.scope === "local");
src/__tests__/lib/shortcuts.test.ts:71:    const local = SHORTCUTS.find((s) => s.scope === "local")!;
src/__tests__/lib/shortcuts.test.ts:81:    for (const shortcut of SHORTCUTS) {
src/__tests__/lib/shortcuts.test.ts:91:    for (const shortcut of SHORTCUTS) {
src/__tests__/lib/shortcuts.test.ts:101:    const withDecision = SHORTCUTS.filter((s) => s.decision);
src/__tests__/lib/shortcuts.test.ts:108:    const families = new Set(SHORTCUTS.map((s) => s.family));
src/App.tsx:87:  const [shortcutsOpen, setShortcutsOpen] = useState(false);
src/App.tsx:277:  // ── Capture Overlay — Cmd+Shift+. global shortcut ─────────────────
src/App.tsx:288:      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === ".") {
src/App.tsx:295:    document.addEventListener("keydown", capturePeriodHandler, {
src/App.tsx:300:      document.removeEventListener("keydown", capturePeriodHandler, {
src/App.tsx:334:  // ── Keyboard shortcuts ───────────────────────────────────────
src/App.tsx:430:        e.key.toLowerCase() === "p" &&
src/App.tsx:442:      const questionKey = e.key === "?" || (e.key === "/" && e.shiftKey);
src/App.tsx:466:      if (meta && e.shiftKey && (e.key === "\\" || e.key === "|")) {
src/App.tsx:473:      if (meta && e.shiftKey && e.key.toLowerCase() === "x") {
src/App.tsx:489:        const k = e.key.toLowerCase();
src/App.tsx:494:      if (meta && e.key === "o") {
src/App.tsx:500:      if (meta && e.key === "s") {
src/App.tsx:506:      if (meta && e.key === "n") {
src/App.tsx:512:      if (meta && !e.shiftKey && e.key.toLowerCase() === "t") {
src/App.tsx:518:      if (meta && e.key === "w" && activeTabId) {
src/App.tsx:537:      if (meta && e.altKey && e.key === "\\") {
src/App.tsx:546:      if (meta && e.key === "\\") {
src/App.tsx:558:        e.key.toLowerCase() === "t" &&
src/App.tsx:568:        e.key.toLowerCase() === "t" &&
src/App.tsx:579:      if (meta && e.shiftKey && e.key.toLowerCase() === "e") {
src/App.tsx:588:      if (meta && e.shiftKey && e.key.toLowerCase() === "s") {
src/App.tsx:594:      if (meta && e.shiftKey && e.key.toLowerCase() === "h") {
src/App.tsx:601:      if (meta && e.shiftKey && e.key.toLowerCase() === "v") {
src/App.tsx:608:      if (meta && e.shiftKey && e.key.toLowerCase() === "y") {
src/App.tsx:614:      if (meta && e.shiftKey && e.key.toLowerCase() === "f") {
src/App.tsx:620:      if (meta && e.shiftKey && e.key.toLowerCase() === "p") {
src/App.tsx:630:      if (meta && e.altKey && e.key === "ArrowRight") {
src/App.tsx:634:      if (meta && e.altKey && e.key === "ArrowDown") {
src/App.tsx:640:      if (meta && e.shiftKey && e.key === "Enter") {
src/App.tsx:646:      if (meta && e.shiftKey && e.key.toLowerCase() === "m") {
src/App.tsx:659:      if (meta && !e.altKey && e.key.toLowerCase() === "z") {
src/App.tsx:682:      if (meta && e.key === "b") {
src/App.tsx:691:      if (meta && (e.key === "=" || e.key === "-" || e.key === "0")) {
src/App.tsx:693:        const delta = e.key === "0" ? 0 : e.key === "=" ? 1 : -1;
src/App.tsx:698:      if (meta && e.key === ",") {
src/App.tsx:704:      if (meta && e.key.toLowerCase() === "k") {
src/App.tsx:710:      if (meta && e.shiftKey && e.key.toLowerCase() === "a") {
src/App.tsx:716:      if (e.key === "Escape") {
src/App.tsx:717:        if (shortcutsOpen) {
src/App.tsx:737:    window.addEventListener("keydown", handler);
src/App.tsx:741:      if ((e.metaKey || e.ctrlKey) && e.key === "i") {
src/App.tsx:752:        e.key.toLowerCase() === "d" &&
src/App.tsx:761:    document.addEventListener("keydown", captureHandler, { capture: true });
src/App.tsx:764:      window.removeEventListener("keydown", handler);
src/App.tsx:765:      document.removeEventListener("keydown", captureHandler, {
src/App.tsx:781:    shortcutsOpen,
src/App.tsx:1001:        open={shortcutsOpen}
src/editors/slash.ts:2340:          // 不设 `scope`——CM6 默认 keydown 处理器只跑 "editor" 作用域；自定义
src/hooks/usePaneDragController.ts:204:        window.removeEventListener("keydown", onKey, true);
src/hooks/usePaneDragController.ts:249:      window.addEventListener("keydown", onKey, true);
src/hooks/usePaneDragController.ts:275:      window.removeEventListener("keydown", onKey, true);
src/hooks/usePaneDragController.ts:305:    window.addEventListener("keydown", onKey, true);
src/editors/smart-input.ts:92:  // 带不带尾随空格都匹配（keydown 时空格尚未插入）。
src/editors/orchestration/toolbar-shared.ts:188:    document.addEventListener("keydown", closeOnEscape);
src/editors/orchestration/toolbar-shared.ts:196:    document.removeEventListener("keydown", closeOnEscape);
src/editors/orchestration/toolbar-shared.ts:204:    if (e.key === "Escape") closeMenu();
src/editors/orchestration/block-handle.ts:254:    view.contentDOM.addEventListener("keydown", this.onKeyDown);
src/editors/orchestration/block-handle.ts:255:    view.contentDOM.addEventListener("keyup", this.onKeyUp);
src/editors/orchestration/block-handle.ts:256:    document.addEventListener("keydown", this.onDocumentKeyDown, true);
src/editors/orchestration/block-handle.ts:290:    this.view.contentDOM.removeEventListener("keydown", this.onKeyDown);
src/editors/orchestration/block-handle.ts:291:    this.view.contentDOM.removeEventListener("keyup", this.onKeyUp);
src/editors/orchestration/block-handle.ts:292:    document.removeEventListener("keydown", this.onDocumentKeyDown, true);
src/editors/orchestration/block-handle.ts:327:    // 补漏：keyup 有时落在编辑器外（菜单抢焦点），抑制标志会永久卡住，
src/lib/shortcuts.ts:152:    id: "global-shortcuts",
src/lib/shortcuts.ts:540:export function shortcutsByFamily(family: ShortcutFamily): ShortcutDef[] {
src/editors/orchestration/block-menu.ts:515:        option.dataset.typeKey = type.key;
src/editors/orchestration/block-menu.ts:516:        option.dataset.active = String(type.key === current);
src/editors/orchestration/block-menu.ts:528:          const next = changeCalloutType(rest, type.key);
src/editors/orchestration/block-menu.ts:938:  document.addEventListener("keydown", onKeyDown, true);
src/editors/orchestration/block-menu.ts:948:      document.removeEventListener("keydown", onKeyDown, true);
src/editors/orchestration/horizontal-toolbar.ts:322:      if (e.key === "Escape") hide();
src/editors/orchestration/horizontal-toolbar.ts:333:    document.addEventListener("keydown", onKey, true);
src/editors/orchestration/horizontal-toolbar.ts:354:        document.removeEventListener("keydown", onKey, true);
src/editors/orchestration/roulette-view.ts:600:      const shortcut = el("span", "sr-filter-shortcut");
src/editors/orchestration/roulette-view.ts:602:        shortcut.textContent = i === 0 ? "回车" : formatShortcut(i + 1);
src/editors/orchestration/roulette-view.ts:603:        shortcut.dataset.shortcut = String(i + 1);
src/editors/orchestration/roulette-view.ts:605:      b.append(shortcut);
src/editors/orchestration/roulette-view.ts:704:  filterInput.addEventListener("keydown", (e) => {
src/editors/orchestration/roulette-view.ts:705:    if (e.key === "Escape") {
src/editors/orchestration/roulette-view.ts:711:    if (e.key === "Enter") {
src/editors/orchestration/roulette-view.ts:729:    if (e.key === "Escape") {
src/editors/orchestration/roulette-view.ts:739:    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
src/editors/orchestration/roulette-view.ts:747:      if ((e.metaKey || e.ctrlKey) && /^[2-9]$/.test(e.key)) {
src/editors/orchestration/roulette-view.ts:748:        const hit = matches[Number(e.key) - 1];
src/editors/orchestration/roulette-view.ts:761:    if (e.key >= "1" && e.key <= "8") {
src/editors/orchestration/roulette-view.ts:762:      const id = visibleSectors[Number(e.key) - 1];
src/editors/orchestration/roulette-view.ts:769:    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
src/editors/orchestration/roulette-view.ts:774:    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
src/editors/orchestration/roulette-view.ts:779:    if (e.key === "Enter") {
src/editors/orchestration/roulette-view.ts:788:  document.addEventListener("keydown", onKey, true);
src/editors/orchestration/roulette-view.ts:877:    document.removeEventListener("keydown", onKey, true);
src/editors/orchestration/capsule-toolbar.ts:131:    if (e.key === "Escape") {
src/editors/orchestration/capsule-toolbar.ts:140:  document.addEventListener("keydown", onKey, true);
src/editors/orchestration/capsule-toolbar.ts:145:    document.removeEventListener("keydown", onKey, true);
src/editors/orchestration/floating-toolbar.ts:84:    e.key.toLowerCase() === parsed.key
src/editors/orchestration/floating-toolbar.ts:111:  kind: type.key,
src/editors/orchestration/floating-toolbar.ts:113:  icon: CALLOUT_ICONS[type.key] ?? "callout",
src/editors/orchestration/floating-toolbar.ts:858:    document.addEventListener("keydown", onKeyDown, true);
src/editors/orchestration/floating-toolbar.ts:859:    document.addEventListener("keydown", onHotkeyDown, true);
src/editors/orchestration/floating-toolbar.ts:895:        document.removeEventListener("keydown", onKeyDown, true);
src/editors/orchestration/floating-toolbar.ts:896:        document.removeEventListener("keydown", onHotkeyDown, true);
src/editors/decorations/imageCrop.ts:206:    document.removeEventListener("keydown", onKey, true);
src/editors/decorations/imageCrop.ts:306:  document.addEventListener("keydown", onKey, true);
src/editors/decorations/table.ts:604:  input.addEventListener("keydown", (event) => {
src/editors/decorations/callout.ts:398:  editor.addEventListener("keydown", (event) => {
src/editors/decorations/callout.ts:573:  input.addEventListener("keydown", (event) => {
src/editors/decorations/callout.ts:704:      iconEl.addEventListener("keydown", (event) => {
src/editors/decorations/imageToolbar.ts:389:  input.addEventListener("keydown", (event) => {
src/editors/decorations/imageToolbar.ts:996:  document.addEventListener("keydown", maximizeKeyHandler, true);
src/editors/decorations/imageToolbar.ts:1005:    document.removeEventListener("keydown", maximizeKeyHandler, true);
src/editors/decorations/columns.ts:268:  area.addEventListener("keydown", (event) => {
src/editors/html/runtime.ts:331:  document.addEventListener("keydown", (e) => {
src/editors/html/runtime.ts:335:      const key = e.key.toLowerCase();
src/editors/html/runtime.ts:347:    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
src/editors/html/runtime.ts:353:    if (e.key === "Escape") { e.preventDefault(); endEdit(); return; }
src/editors/html/runtime.ts:354:    if (e.key !== "Enter") return;

exec
/bin/zsh -c "rg -n 'new file|new-doc|defaultNewDoc|default.*format|file format|Markdown|newTab\\(' src src-tauri -g '*.ts' -g '*.tsx' -g '*.rs' | sed -n '1,300p'
rg -n 'FONT_SIZES|READER_WIDTH_PRESETS|READER_TONES|preset' src/components/SettingsView.tsx src/lib/readerWidth.ts -C 4 | sed -n '1,260p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src/types/index.ts:192:export type RawMarkdown = string;
src/__tests__/capabilitiesGating.test.ts:7:import { renderMarkdown } from "../renderers/markdown";
src/__tests__/capabilitiesGating.test.ts:18:    expect(renderMarkdown(doc)).toContain("katex");
src/__tests__/capabilitiesGating.test.ts:23:    const html = renderMarkdown(doc);
src/__tests__/capabilitiesGating.test.ts:30:    expect(renderMarkdown(doc)).not.toContain("katex");
src/__tests__/capabilitiesGating.test.ts:32:    expect(renderMarkdown(doc)).toContain("katex");
src/__tests__/capabilitiesGating.test.ts:40:    expect(renderMarkdown(doc)).toContain("tok-");
src/__tests__/capabilitiesGating.test.ts:45:    const html = renderMarkdown(doc);
src/lib/railCards.ts:116: * 去掉 Markdown 语法标记，只留可读文字（卡片摘要展示用）。
src/lib/railCards.ts:118: * 与 `plainTextOf` 平行：HTML 在 `excerptOf` 里已去标签，Markdown 的语法
src/lib/railCards.ts:122:export function stripMarkdownOf(text: string): string {
src/lib/railCards.ts:321:/** 从摘要里取首图地址（Markdown 语法优先，其次裸 `<img src>`）。 */
src/lib/exportActions.ts:4:import { exportPngFromMarkdown, exportPngMessage } from "./export/png";
src/lib/exportActions.ts:5:import { exportPdfFromMarkdown, exportPdfMessage } from "./export/pdf";
src/lib/exportActions.ts:7:import { exportMdpkgFromMarkdown, exportMdpkgMessage } from "./export/mdpkg";
src/lib/exportActions.ts:8:import { exportZipFromMarkdown, exportZipMessage } from "./export/zip";
src/lib/exportActions.ts:71:      () => exportPngFromMarkdown({ title, markdown: content, baseDir }),
src/lib/exportActions.ts:80:      () => exportPdfFromMarkdown({ title, markdown: content, baseDir }),
src/lib/exportActions.ts:98:      () => exportMdpkgFromMarkdown({ title, markdown: content, baseDir }),
src/lib/exportActions.ts:107:      () => exportZipFromMarkdown({ title, markdown: content, baseDir }),
src/lib/export/docx.ts:63:export async function exportDocxFromMarkdown(
src/lib/export/docx.ts:145:  return exportDocxFromMarkdown({
src/lib/mdpkg/vendor/mdpkg-web.d.ts:84: * Markdown 文件集合 → `.docx`（OOXML ZIP）字节。
src/renderers/index.ts:2:import { renderMarkdown } from "./markdown";
src/renderers/index.ts:5:export { renderMarkdown, takeDarkVars } from "./markdown";
src/renderers/index.ts:18:      return renderMarkdown(content);
src/lib/printPreview.ts:3: * 从页签的 Markdown 源文构造一份**独立**打印视图：同一 `renderMarkdown` 管线、
src/lib/printPreview.ts:11:import { renderMarkdown } from "../renderers/markdown";
src/lib/printPreview.ts:28:  /** Markdown 源文。 */
src/lib/printPreview.ts:80: * 把 target 的 Markdown 以预览排版输出到纸张。
src/lib/printPreview.ts:84:export function printMarkdownPreview(
src/lib/printPreview.ts:103:    html = renderMarkdown(target.content, {
src/lib/mdpkg/index.ts:85:// 透出：读取入口 Markdown 原文（include 未展开），预览源码用；入口缺失时抛 MdeError。
src/lib/export/html.ts:1:// 导出 HTML：把 Markdown 渲染成单文件、离线可看的 HTML 文档。
src/lib/export/html.ts:4:import { renderMarkdown } from "../../renderers/markdown";
src/lib/export/html.ts:47:/** renderMarkdown 对 mermaid 块输出的确切 markup（见 renderers/markdown.ts）。 */
src/lib/export/html.ts:50:/** 还原 renderMarkdown 对图源码做的 HTML 转义；&amp; 必须最后替换，避免二次还原。 */
src/lib/export/html.ts:75:  const rendered = renderMarkdown(markdown);
src/lib/railView.ts:9:import { stripMarkdownOf } from "./railCards";
src/lib/railView.ts:96:  markdown: "Markdown",
src/lib/railView.ts:194:    // 高亮区间按「展示文本」算：Markdown 卡片渲染时会剥掉语法，若这里按原文算，
src/lib/railView.ts:198:        ? stripMarkdownOf(hit.excerpt)
src-tauri/src/commands/search.rs:101:/// 取第一个 H1：Markdown 的首个 `# ` 行；HTML 的首个 `<h1>` 内容（去标签）。
src-tauri/src/extension_packages.rs:672:- 在标月的 Markdown 阅读 / 编辑上下文中生效。\n\n\
src/lib/export/pdf.ts:123:export async function exportPdfFromMarkdown(
src/lib/shortcuts.ts:171:    label: "Markdown",
src/renderers/markdown.ts:369: * 两个面板的文档目录不同，但同一时刻只有一个 `renderMarkdown` 在跑（同步）。
src/renderers/markdown.ts:373:export interface RenderMarkdownOptions {
src/renderers/markdown.ts:446:export function renderMarkdown(
src/renderers/markdown.ts:448:  options: RenderMarkdownOptions = {},
src/lib/export/mdpkg.ts:41: * 组装包内文件：入口 Markdown 逐字保留（含 frontmatter），资产按原引用路径写入。
src/lib/export/mdpkg.ts:59:/** Markdown → .mdpkg 字节（未写盘）。失败抛出，由 exportMdpkgFromMarkdown 收敛。 */
src/lib/export/mdpkg.ts:60:export async function packMdpkgFromMarkdown(
src/lib/export/mdpkg.ts:69:export async function exportMdpkgFromMarkdown(
src/lib/export/mdpkg.ts:92:    const bytes = await packMdpkgFromMarkdown(input, readBase64);
src/lib/export/zip.ts:55:export async function exportZipFromMarkdown(
src/lib/export/png.ts:258:// ── UI 胶水：Markdown → 保存 ────────────────────────────────
src/lib/export/png.ts:308: * Markdown → PNG 长图 → 主进程写盘。
src/lib/export/png.ts:311:export async function exportPngFromMarkdown(
src/App.tsx:219:    useStore.getState().newTab();
src/App.tsx:273:    useStore.getState().newTab();
src/App.tsx:514:        store.newTab();
src/__tests__/editor/smartInput.test.ts:7:  handleMarkdownShortcut,
src/__tests__/editor/smartInput.test.ts:43:    expect(handleMarkdownShortcut(editor.view)).toBe(true);
src/__tests__/editor/smartInput.test.ts:50:    expect(handleMarkdownShortcut(editor.view)).toBe(true);
src/__tests__/editor/smartInput.test.ts:57:    expect(handleMarkdownShortcut(editor.view)).toBe(true);
src/__tests__/editor/smartInput.test.ts:63:    expect(handleMarkdownShortcut(editor.view)).toBe(false);
src/__tests__/editor/smartInput.test.ts:69:    expect(handleMarkdownShortcut(editor.view)).toBe(true);
src/__tests__/editor/smartInput.test.ts:75:    expect(handleMarkdownShortcut(editor.view)).toBe(true);
src/__tests__/editor/smartInput.test.ts:81:    expect(handleMarkdownShortcut(editor.view)).toBe(false);
src/__tests__/editor/smartInput.test.ts:86:    expect(handleMarkdownShortcut(editor.view)).toBe(true);
src/__tests__/editor/smartInput.test.ts:93:    expect(handleMarkdownShortcut(editor.view)).toBe(true);
src/__tests__/editor/smartInput.test.ts:100:    expect(handleMarkdownShortcut(editor.view)).toBe(true);
src/__tests__/editor/smartInput.test.ts:107:    expect(handleMarkdownShortcut(editor.view)).toBe(true);
src/__tests__/editor/smartInput.test.ts:121:    handleMarkdownShortcut(editor.view);
src/__tests__/editor/smartInput.test.ts:458:    handleMarkdownShortcut(editor.view);
src/__tests__/editor/smartInput.test.ts:469:    handleMarkdownShortcut(editor.view);
src/__tests__/renderers.markdown.test.ts:2:import { renderMarkdown } from "../renderers/markdown";
src/__tests__/renderers.markdown.test.ts:4:describe("renderMarkdown — GFM 任务列表 & sanitize", () => {
src/__tests__/renderers.markdown.test.ts:6:    const html = renderMarkdown("- [x] 已完成事项");
src/__tests__/renderers.markdown.test.ts:15:    const html = renderMarkdown("- [ ] 待办事项");
src/__tests__/renderers.markdown.test.ts:23:    const html = renderMarkdown(
src/__tests__/renderers.markdown.test.ts:33:    const html = renderMarkdown("<script>alert(1)</script>safe");
src/ui/icons.ts:162:    label: "Markdown",
src/__tests__/paneTreeStore.test.ts:183:    useStore.getState().newTab(); // path=null
src/__tests__/railCards.test.ts:293:  it("首图解析：Markdown 优先，其次裸 img；远程 URL 不联网", () => {
src/__tests__/editor/table-decorations.test.ts:281:    const withBgAndMarkdown = '<span class="mdb-bg-blue">**bold**</span>';
src/__tests__/editor/table-decorations.test.ts:282:    expect(renderCellText(withBgAndMarkdown)).toBe("<strong>bold</strong>");
src/__tests__/lib/export/zip.test.ts:9:const { exportZipFromMarkdown, exportZipMessage, zipFileName } =
src/__tests__/lib/export/zip.test.ts:37:  const result = await exportZipFromMarkdown(INPUT, {
src/__tests__/lib/export/zip.test.ts:65:    const result = await exportZipFromMarkdown(INPUT, {
src/__tests__/lib/export/zip.test.ts:74:    const result = await exportZipFromMarkdown(INPUT, {
src/__tests__/lib/export/zip.test.ts:85:    const result = await exportZipFromMarkdown(
src/__tests__/markdownRender.test.ts:2:import { renderMarkdown, takeDarkVars } from "../renderers/markdown";
src/__tests__/markdownRender.test.ts:4:describe("renderMarkdown 代码块", () => {
src/__tests__/markdownRender.test.ts:6:    const html = renderMarkdown("```js\nconst a = 1;\n```");
src/__tests__/markdownRender.test.ts:14:    const html = renderMarkdown("```\nplain text\n```");
src/__tests__/markdownRender.test.ts:21:    const html = renderMarkdown("```brainfuck\n+++\n```");
src/__tests__/markdownRender.test.ts:27:    const html = renderMarkdown("```js\n<script>alert(1)</script>\n```");
src/__tests__/markdownRender.test.ts:35:    const py = renderMarkdown("```python\ndef f():\n    return 1\n```");
src/__tests__/markdownRender.test.ts:37:    const css = renderMarkdown("```css\n.a { color: red }\n```");
src/__tests__/markdownRender.test.ts:42:describe("renderMarkdown Callout", () => {
src/__tests__/markdownRender.test.ts:44:    const html = renderMarkdown("> [!NOTE] 小提示\n> 正文内容");
src/__tests__/markdownRender.test.ts:52:    const html = renderMarkdown("> [!TL;DR] 太长不看\n> 内容");
src/__tests__/markdownRender.test.ts:59:    const html = renderMarkdown("> [! TL] 要点\n> 内容");
src/__tests__/markdownRender.test.ts:66:    const html = renderMarkdown("> [!NOTE ] 尾部空格\n> 内容");
src/__tests__/markdownRender.test.ts:73:    const html = renderMarkdown("> [!TIP]\n> 正文内容");
src/__tests__/markdownRender.test.ts:79:    const html = renderMarkdown("> [!WARNING]- 折叠标题\n> 内容");
src/__tests__/markdownRender.test.ts:86:    const html = renderMarkdown("> 只是一句引用");
src/__tests__/markdownRender.test.ts:92:describe("renderMarkdown 公式", () => {
src/__tests__/markdownRender.test.ts:94:    const html = renderMarkdown("质能方程 $E=mc^2$ 成立");
src/__tests__/markdownRender.test.ts:100:    const html = renderMarkdown("$$\nE=mc^2\n$$");
src/__tests__/markdownRender.test.ts:106:    const html = renderMarkdown("价格是 $100 元");
src/__tests__/markdownRender.test.ts:111:    const html = renderMarkdown("$\\frac{1}{$");
src/__tests__/markdownRender.test.ts:116:describe("renderMarkdown 排版细节", () => {
src/__tests__/markdownRender.test.ts:118:    const spaced = renderMarkdown("中文abc混合");
src/__tests__/markdownRender.test.ts:121:    const inCode = renderMarkdown("`中文abc`");
src/__tests__/markdownRender.test.ts:128:    const html = renderMarkdown('![替代文本](/a.png "图注")');
src/__tests__/markdownRender.test.ts:134:    const html = renderMarkdown("| a | b |\n| --- | --- |\n| 1 | 2 |");
src/__tests__/markdownRender.test.ts:140:    const html = renderMarkdown("[链接](https://example.com)");
src/__tests__/markdownRender.test.ts:145:    const html = renderMarkdown("```js\nlet a\n```\n\n| a |\n| - |\n| 1 |");
src/__tests__/markdownRender.test.ts:151:describe("renderMarkdown 图片属性块", () => {
src/__tests__/markdownRender.test.ts:153:    const html = renderMarkdown(
src/__tests__/markdownRender.test.ts:164:    const html = renderMarkdown("![pic](/a.png)<!--w=635-->");
src/__tests__/markdownRender.test.ts:171:    const html = renderMarkdown("![pic](assets/image%20(1).png){width=300}");
src/__tests__/markdownRender.test.ts:178:    const html = renderMarkdown("```\n![pic](/a.png){width=300}\n```");
src/__tests__/markdownRender.test.ts:184:describe("renderMarkdown 安全", () => {
src/__tests__/markdownRender.test.ts:186:    const html = renderMarkdown(
src/__tests__/markdownRender.test.ts:194:    const html = renderMarkdown('<div style="color: red">红字</div>');
src/__tests__/markdownRender.test.ts:201:    const html = renderMarkdown(
src/__tests__/markdownRender.test.ts:209:    const html = renderMarkdown("- [x] 已完成\n- [ ] 未完成");
src/__tests__/markdownRender.test.ts:215:    const html = renderMarkdown('```html\n<img src=x onerror="alert(1)">\n```');
src/__tests__/markdownRender.test.ts:222:describe("renderMarkdown Callout 正文不重复", () => {
src/__tests__/markdownRender.test.ts:224:    const html = renderMarkdown("> [!NOTE] 小标题\n> 正文内容");
src/__tests__/markdownRender.test.ts:230:    const html = renderMarkdown("> [!TIP] 标题\n>\n> 第一段\n>\n> 第二段");
src/__tests__/markdownRender.test.ts:236:describe("renderMarkdown Mermaid", () => {
src/__tests__/markdownRender.test.ts:238:    const html = renderMarkdown("```mermaid\ngraph TD\nA-->B\n```");
src/__tests__/markdownRender.test.ts:245:    const html = renderMarkdown("```mermaid\ngraph TD\n```");
src/__tests__/markdownRender.test.ts:251:describe("renderMarkdown 内嵌 HTML 深色适配", () => {
src/__tests__/markdownRender.test.ts:253:    renderMarkdown('<div style="background-color:#ffffff">块</div>');
src/__tests__/markdownRender.test.ts:261:    renderMarkdown('<span style="color:#222222">字</span>');
src/__tests__/markdownRender.test.ts:263:    renderMarkdown('<div style="background-color:#1a1a1a">深底</div>');
src/__tests__/markdownRender.test.ts:269:    renderMarkdown(
src/__tests__/markdownRender.test.ts:276:    renderMarkdown(
src/__tests__/markdownRender.test.ts:285:describe("renderMarkdown YAML frontmatter", () => {
src/__tests__/markdownRender.test.ts:287:    const html = renderMarkdown("---\ntags:\n  - 笔记\n---\n# 标题\n\n正文");
src/__tests__/markdownRender.test.ts:295:    const html = renderMarkdown("\uFEFF---\ntags:\n  - 笔记\n---\n# 标题");
src/__tests__/markdownRender.test.ts:301:    const html = renderMarkdown("# 标题\n\n---\n\n正文");
src/__tests__/markdownRender.test.ts:307:describe("renderMarkdown 块级 HTML 闭合", () => {
src/__tests__/markdownRender.test.ts:309:    const html = renderMarkdown(
src/__tests__/markdownRender.test.ts:326:    const html = renderMarkdown(md);
src/__tests__/markdownRender.test.ts:340:    const html = renderMarkdown(md);
src/__tests__/markdownRender.test.ts:346:    const html = renderMarkdown("<div>\n内容\n\n## 标题");
src/__tests__/markdownRender.test.ts:352:describe("renderMarkdown 块对齐围栏 div", () => {
src/__tests__/markdownRender.test.ts:354:    const html = renderMarkdown("::: {.align-center}\n正文\n:::");
src/__tests__/markdownRender.test.ts:361:    expect(renderMarkdown("::: {.align-left}\n正文\n:::")).toContain(
src/__tests__/markdownRender.test.ts:364:    expect(renderMarkdown("::: {.align-right}\n正文\n:::")).toContain(
src/__tests__/markdownRender.test.ts:370:    const html = renderMarkdown("::: {.align-center}\n## 标题\n:::");
src/__tests__/markdownRender.test.ts:376:    const html = renderMarkdown("::: {.align-center}\n正文");
src/__tests__/markdownRender.test.ts:382:describe("renderMarkdown 预览分栏围栏 div", () => {
src/__tests__/markdownRender.test.ts:384:    const html = renderMarkdown("::: {.col-2}\n## 左\n\n## 右\n:::");
src/__tests__/markdownRender.test.ts:392:    const html = renderMarkdown("::: {cols=3}\n左\n\n右\n\n中\n:::");
src/__tests__/markdownRender.test.ts:398:    const html = renderMarkdown("::: {.col-2}\n正文");
src/__tests__/exportPng.test.ts:4:  exportPngFromMarkdown,
src/__tests__/exportPng.test.ts:87:describe("exportPngFromMarkdown", () => {
src/__tests__/exportPng.test.ts:92:    const result = await exportPngFromMarkdown(
src/__tests__/exportPng.test.ts:108:    const result = await exportPngFromMarkdown(
src/__tests__/exportPng.test.ts:125:    const result = await exportPngFromMarkdown(
src/__tests__/exportPng.test.ts:156:    const result = await exportPngFromMarkdown(
src/__tests__/exportPng.test.ts:169:    const result = await exportPngFromMarkdown(
src/__tests__/exportPng.test.ts:184:    const result = await exportPngFromMarkdown(
src/__tests__/exportPng.test.ts:205:    const result = await exportPngFromMarkdown(
src/__tests__/exportPng.test.ts:214:    await exportPngFromMarkdown(
src/__tests__/exportPng.test.ts:236:    const result = await exportPngFromMarkdown(
src/__tests__/exportPng.test.ts:265:    await exportPngFromMarkdown(
src/__tests__/readingStore.test.ts:32:    useStore.getState().newTab();
src/__tests__/renderers/structural-tags.test.ts:2:import { renderMarkdown } from "../../renderers/markdown";
src/__tests__/renderers/structural-tags.test.ts:40:describe("renderMarkdown 未知结构标签", () => {
src/__tests__/renderers/structural-tags.test.ts:42:    const html = renderMarkdown(STRUCTURAL_DOC);
src/__tests__/renderers/structural-tags.test.ts:50:    const html = renderMarkdown(STRUCTURAL_DOC);
src/__tests__/renderers/structural-tags.test.ts:58:    const html = renderMarkdown(
src/__tests__/renderers/structural-tags.test.ts:68:    const html = renderMarkdown("<objective>\n内容\n</objective>\n\n后续");
src/__tests__/renderers/structural-tags.test.ts:75:    const html = renderMarkdown(
src/__tests__/renderers/structural-tags.test.ts:84:    const html = renderMarkdown(
src/editors/callout-types.ts:20:  /** Markdown `[!KEY]` token（小写，与渲染端别名一致）。 */
src/__tests__/exportMdpkg.test.ts:10:const { buildMdpkgFiles, exportMdpkgFromMarkdown, mdpkgFileName } =
src/__tests__/exportMdpkg.test.ts:48:  const result = await exportMdpkgFromMarkdown(INPUT, {
src/__tests__/exportMdpkg.test.ts:62:  it("往返：入口 Markdown 逐字一致，本地图片在包内", async () => {
src/__tests__/exportMdpkg.test.ts:108:    const result = await exportMdpkgFromMarkdown(INPUT, {
src/__tests__/exportMdpkg.test.ts:116:    const result = await exportMdpkgFromMarkdown(INPUT, {
src/__tests__/exportDocx.test.ts:5:  exportDocxFromMarkdown,
src/__tests__/exportDocx.test.ts:55:describe("exportDocxFromMarkdown", () => {
src/__tests__/exportDocx.test.ts:59:    const result = await exportDocxFromMarkdown(
src/__tests__/exportDocx.test.ts:79:    const result = await exportDocxFromMarkdown(
src/__tests__/exportDocx.test.ts:106:    await exportDocxFromMarkdown(
src/__tests__/exportDocx.test.ts:123:    const result = await exportDocxFromMarkdown(
src/__tests__/exportDocx.test.ts:145:    const result = await exportDocxFromMarkdown(
src/__tests__/exportDocx.test.ts:154:    const result = await exportDocxFromMarkdown(
src/__tests__/exportDocx.test.ts:171:    const result = await exportDocxFromMarkdown(
src/__tests__/gridView.test.ts:150:    expect(groups.map((g) => g.label)).toEqual(["Markdown", "HTML"]);
src/editors/decorations/cell-text.ts:8: * 为什么本文件自带 URL 策略而不调用 `renderMarkdown`
src/editors/decorations/cell-text.ts:10: * 单元格需要**仅行内**渲染：块级 `renderMarkdown` 会把输出包进 `<p>` /
src/editors/decorations/callout-emoji.ts:7: * 持久化：Markdown 没有放 callout emoji 的属性位，改写源码标题会破坏用户内容，
src/components/TabBar.tsx:26:import { printMarkdownPreview } from "../lib/printPreview";
src/components/TabBar.tsx:802:              printMarkdownPreview(
src/editors/decorations/fileEmbed.ts:6: * - md：读文件内容，复用预览渲染管线 `renderMarkdown` 渲染成排版 HTML。
src/editors/decorations/fileEmbed.ts:35:import { renderMarkdown } from "../../renderers/markdown";
src/editors/decorations/fileEmbed.ts:383:function renderMarkdownBody(
src/editors/decorations/fileEmbed.ts:389:    appendFallback(body, "无法读取内嵌 Markdown：文档未保存或路径无法解析");
src/editors/decorations/fileEmbed.ts:394:  loading.textContent = "正在加载内嵌 Markdown…";
src/editors/decorations/fileEmbed.ts:399:    loading.textContent = "无法读取内嵌 Markdown：需在 Tauri 桌面环境中运行";
src/editors/decorations/fileEmbed.ts:409:      host.innerHTML = renderMarkdown(res.content, {
src/editors/decorations/fileEmbed.ts:418:      loading.textContent = "无法读取内嵌 Markdown";
src/editors/decorations/fileEmbed.ts:591:      renderMarkdownBody(body, this._resolution?.filePath ?? null, onReady);
src/editors/smart-input.ts:3: * 1. Markdown 快捷转换：`# ` → H1、`- ` → 列表、`1. ` → 有序列表等。
src/editors/smart-input.ts:42:// --- Markdown 快捷转换 -------------------------------------------------------
src/editors/smart-input.ts:44:/** 处理 Markdown 快捷转换。命中并应用返回 true。 */
src/editors/smart-input.ts:45:export function handleMarkdownShortcut(view: EditorView): boolean {
src/editors/smart-input.ts:688:    run: (view) => handleMarkdownShortcut(view),
src/editors/setup.ts:74: * Markdown 编辑态不要加回 `lineNumbers()` / `foldGutter()` / `highlightActiveLine()`：
src/editors/setup.ts:75: * 它的「当前块」由装饰层的 `cm-block-active` 表达，不是行号（E-8）。非 Markdown
src/editors/setup.ts:77: * 条件装回行号（#858 / design D15），Markdown 永不装。
src/editors/decorations/table.ts:241:function buildTableMarkdown(header: string[], rows: string[][]): string {
src/editors/decorations/table.ts:815:        insert: buildTableMarkdown(header, rows),
src/editors/decorations/callout.ts:3: * 解析 Markdown 引用块式高亮块语法（`> [!TYPE][+-] 标题` + 后续 `> ` 行），
src/editors/decorations/callout.ts:92:/** 用源码块 + 暂存编辑重建高亮块的 Markdown。 */
src/editors/decorations/callout.ts:93:function buildCalloutMarkdown(
src/editors/decorations/callout.ts:120:    const insert = buildCalloutMarkdown(block, draft);
src/editors/decorations/callout.ts:437:  // （buildCalloutMarkdown 对空内容不产出行）。
src/components/Content/PaneTreeView.tsx:469:          store.newTab();
src/editors/orchestration/block-handle.ts:121: * - 移动后块与块之间用单个空行相接（Markdown 文档约定），其余内容逐字保留。
src/editors/decorations/theme.ts:4: * 看起来像渲染后的 Markdown 的是这个主题。外观规则落在 `src/styles/editor.css`
src/editors/html/capture.ts:162: * 与 `exportPngFromMarkdown` 同一套错误语义：失败返回人话 message，取消返回 cancelled。
src/components/Preview/FloatingPreview.tsx:24:import { buildAssetUrl, renderMarkdown, renderText } from "../../renderers";
src/components/Preview/FloatingPreview.tsx:637:        ? renderMarkdown(content, {
src/editors/decorations/structuralTagPattern.ts:108: * 前导空白最多 3 个是 Markdown 的缩进码块边界：4 空格缩进的行是代码内容，
src/components/Content/ContentArea.tsx:129:  isMarkdownEdit: () => boolean;
src/components/Content/ContentArea.tsx:145:  if (!ctx.isMarkdownEdit()) return false;
src/components/Content/ContentArea.tsx:342: * 仅纯文本 / 脚本（代码）文件的**编辑态**装行号；Markdown 编辑态遵守 E-8
src/components/Content/ContentArea.tsx:589:              isMarkdownEdit: () =>
src/components/Content/PreviewView.tsx:3:import { renderMarkdown, renderMermaid, takeDarkVars } from "../../renderers";
src/components/Content/PreviewView.tsx:192:        return renderMarkdown(content, {
src/components/Rail/ReadingRail.tsx:61:  stripMarkdownOf,
src/components/Rail/ReadingRail.tsx:589:    kind === "markdown" ? stripMarkdownOf(rawExcerpt) : rawExcerpt;
src/components/TooltipLayer.tsx:117:    hint: meta.markdown ? `Markdown: ${meta.markdown}` : null,
src/components/PortalView.tsx:14:  { kind: "markdown", label: "Markdown" },
src/components/SettingsView.tsx:1779:                            data-testid={`property-bar-new-doc-${option.value}`}
src/components/SettingsView.tsx:2370:                  桌面 Markdown 阅读与编辑器，离线优先，数据保存在本机。
src/lib/readerWidth.ts-2-export const READER_WIDTH_MIN = 480;
src/lib/readerWidth.ts-3-export const READER_WIDTH_MAX = 1400;
src/lib/readerWidth.ts-4-export const READER_WIDTH_STEP = 20;
src/lib/readerWidth.ts-5-
src/lib/readerWidth.ts:6:export const READER_WIDTH_PRESETS = [
src/lib/readerWidth.ts-7-  { value: 720, label: "紧凑", bar: 14 },
src/lib/readerWidth.ts-8-  { value: 960, label: "适中", bar: 17 },
src/lib/readerWidth.ts-9-  { value: 1080, label: "标准", bar: 20 },
src/lib/readerWidth.ts-10-  { value: 1200, label: "宽松", bar: 23 },
--
src/components/SettingsView.tsx-30-import { ROULETTE_HOTKEY_DEFAULT } from "../editors/orchestration/roulette";
src/components/SettingsView.tsx-31-import {
src/components/SettingsView.tsx-32-  READER_WIDTH_MAX,
src/components/SettingsView.tsx-33-  READER_WIDTH_MIN,
src/components/SettingsView.tsx:34:  READER_WIDTH_PRESETS,
src/components/SettingsView.tsx-35-  READER_WIDTH_STEP,
src/components/SettingsView.tsx-36-} from "../lib/readerWidth";
src/components/SettingsView.tsx-37-import {
src/components/SettingsView.tsx-38-  HEADING_FONT_STACK,
--
src/components/SettingsView.tsx-137-  { value: "dark", label: "深色" },
src/components/SettingsView.tsx-138-  { value: "warm", label: "暖色" },
src/components/SettingsView.tsx-139-] as const;
src/components/SettingsView.tsx-140-
src/components/SettingsView.tsx:141:const FONT_SIZES = [15, 16, 17, 18, 19, 21] as const;
src/components/SettingsView.tsx-142-
src/components/SettingsView.tsx-143-const NOTICE_DURATION_MIN = 0.1;
src/components/SettingsView.tsx-144-const NOTICE_DURATION_MAX = 10;
src/components/SettingsView.tsx-145-const NOTICE_DURATION_STEP = 0.1;
--
src/components/SettingsView.tsx-160-  }
src/components/SettingsView.tsx-161-  return { kind: "valid", value };
src/components/SettingsView.tsx-162-}
src/components/SettingsView.tsx-163-
src/components/SettingsView.tsx:164:const READER_TONES = [
src/components/SettingsView.tsx-165-  { id: "paper", label: "纸墨", swatch: "#1f1d1a" },
src/components/SettingsView.tsx-166-  { id: "indigo", label: "靛青", swatch: "#2b4a7d" },
src/components/SettingsView.tsx-167-  { id: "moss", label: "松绿", swatch: "#2f5d3f" },
src/components/SettingsView.tsx-168-  { id: "clay", label: "赭石", swatch: "#8a4b2a" },
--
src/components/SettingsView.tsx-1056-    void saveAppConfig();
src/components/SettingsView.tsx-1057-  };
src/components/SettingsView.tsx-1058-
src/components/SettingsView.tsx-1059-  const selectProvider = (id: string) => {
src/components/SettingsView.tsx:1060:    const preset = PROVIDERS.find((p) => p.id === id);
src/components/SettingsView.tsx:1061:    if (!preset) return;
src/components/SettingsView.tsx-1062-    setSelectedProvider(id);
src/components/SettingsView.tsx-1063-    setConfig({
src/components/SettingsView.tsx:1064:      openaiEndpoint: preset.endpoint,
src/components/SettingsView.tsx:1065:      openaiModel: preset.defaultModel,
src/components/SettingsView.tsx-1066-    });
src/components/SettingsView.tsx-1067-    void saveAppConfig();
src/components/SettingsView.tsx-1068-  };
src/components/SettingsView.tsx-1069-
--
src/components/SettingsView.tsx-1238-                <h2 className="mb-2 text-sm font-medium text-[var(--app-text-strong)]">
src/components/SettingsView.tsx-1239-                  字号
src/components/SettingsView.tsx-1240-                </h2>
src/components/SettingsView.tsx-1241-                <div className="flex flex-wrap gap-2">
src/components/SettingsView.tsx:1242:                  {FONT_SIZES.map((size) => {
src/components/SettingsView.tsx-1243-                    const selected = readerFontSize === size;
src/components/SettingsView.tsx-1244-                    return (
src/components/SettingsView.tsx-1245-                      <button
src/components/SettingsView.tsx-1246-                        key={size}
--
src/components/SettingsView.tsx-1349-                <h2 className="mb-2 text-sm font-medium text-[var(--app-text-strong)]">
src/components/SettingsView.tsx-1350-                  编辑器字号
src/components/SettingsView.tsx-1351-                </h2>
src/components/SettingsView.tsx-1352-                <div className="flex flex-wrap gap-2">
src/components/SettingsView.tsx:1353:                  {FONT_SIZES.map((size) => {
src/components/SettingsView.tsx-1354-                    const selected = fontSize === size;
src/components/SettingsView.tsx-1355-                    return (
src/components/SettingsView.tsx-1356-                      <button
src/components/SettingsView.tsx-1357-                        key={size}
--
src/components/SettingsView.tsx-1835-                <h2 className="mb-2 text-sm font-medium text-[var(--app-text-strong)]">
src/components/SettingsView.tsx-1836-                  行宽
src/components/SettingsView.tsx-1837-                </h2>
src/components/SettingsView.tsx-1838-                <div className="flex flex-wrap gap-2">
src/components/SettingsView.tsx:1839:                  {READER_WIDTH_PRESETS.map((option) => {
src/components/SettingsView.tsx-1840-                    const selected = readerWidth === option.value;
src/components/SettingsView.tsx-1841-                    return (
src/components/SettingsView.tsx-1842-                      <button
src/components/SettingsView.tsx-1843-                        key={option.value}
--
src/components/SettingsView.tsx-1887-                <h2 className="mb-2 text-sm font-medium text-[var(--app-text-strong)]">
src/components/SettingsView.tsx-1888-                  配色
src/components/SettingsView.tsx-1889-                </h2>
src/components/SettingsView.tsx-1890-                <div className="flex flex-wrap gap-2">
src/components/SettingsView.tsx:1891:                  {READER_TONES.map((tone) => {
src/components/SettingsView.tsx-1892-                    const selected = readerSkin === tone.id;
src/components/SettingsView.tsx-1893-                    return (
src/components/SettingsView.tsx-1894-                      <button
src/components/SettingsView.tsx-1895-                        key={tone.id}

codex
已核实更多事实偏差：B8 的“无预设集合”不成立，设置页确有 `FONT_SIZES` 预设；A2 把“配置地图写入”误认成了“技能注入”。仍在检查目录语义、权限模型和分批路线是否自洽。
exec
/bin/zsh -c "rg -n 'ContextMenu|menu|MenuItem|\\.map\\(' src/components/TabBar.tsx src/components/ContextMenu.tsx src/components/StatusBar.tsx src/components/Rail/ReadingRail.tsx src/components/Content/OutlineMenu.tsx | sed -n '1,360p'
nl -ba src/components/TabBar.tsx | sed -n '700,840p'
nl -ba src/components/ContextMenu.tsx | sed -n '1,220p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src/components/StatusBar.tsx:195:        '[role="menuitemradio"]',
src/components/StatusBar.tsx:326:                  {READER_WIDTH_PRESETS.map((opt) => (
src/components/StatusBar.tsx:421:            aria-haspopup="menu"
src/components/StatusBar.tsx:444:                  data-testid="theme-menu"
src/components/StatusBar.tsx:445:                  className="theme-menu-wrap"
src/components/StatusBar.tsx:457:                    className="theme-menu"
src/components/StatusBar.tsx:458:                    role="menu"
src/components/StatusBar.tsx:475:                    {THEME_OPTIONS.map((opt) => (
src/components/StatusBar.tsx:479:                        role="menuitemradio"
src/components/StatusBar.tsx:486:                        className={`theme-menu-item ${theme === opt.value ? "is-active" : ""}`}
src/components/Content/OutlineMenu.tsx:75:  const menuRef = useRef<HTMLDivElement>(null);
src/components/Content/OutlineMenu.tsx:234:      const ids = drag.order.map(outlineHeadingId);
src/components/Content/OutlineMenu.tsx:263:      if (menuRef.current?.contains(target)) return;
src/components/Content/OutlineMenu.tsx:318:          ref={menuRef}
src/components/Content/OutlineMenu.tsx:321:          data-testid="outline-menu"
src/components/Content/OutlineMenu.tsx:322:          role="menu"
src/components/Content/OutlineMenu.tsx:333:              {shownHeadings.map((heading, index) => (
src/components/Content/OutlineMenu.tsx:343:                    role="menuitem"
src/components/ContextMenu.tsx:7:export interface ContextMenuItem {
src/components/ContextMenu.tsx:14:interface ContextMenuProps {
src/components/ContextMenu.tsx:17:  items: ContextMenuItem[];
src/components/ContextMenu.tsx:25:export default function ContextMenu({
src/components/ContextMenu.tsx:31:}: ContextMenuProps) {
src/components/ContextMenu.tsx:63:      ?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')
src/components/ContextMenu.tsx:70:        '[role="menuitem"]:not(:disabled)',
src/components/ContextMenu.tsx:87:      data-testid={testId ?? "context-menu"}
src/components/ContextMenu.tsx:88:      role="menu"
src/components/ContextMenu.tsx:89:      className="context-menu"
src/components/ContextMenu.tsx:100:      {items.map((item) => (
src/components/ContextMenu.tsx:104:          role="menuitem"
src/components/ContextMenu.tsx:110:          className="context-menu-item"
src/components/Rail/ReadingRail.tsx:254:        {[6, 12, 18, 10, 16, 8, 14].map((h, i) => (
src/components/Rail/ReadingRail.tsx:491:      {segments.map((seg, i) =>
src/components/Rail/ReadingRail.tsx:700:            {excerptSegments.map((seg, i) =>
src/components/Rail/ReadingRail.tsx:744:      {chips.map((chip) => (
src/components/Rail/ReadingRail.tsx:828:  const [menuOpen, setMenuOpen] = useState(false);
src/components/Rail/ReadingRail.tsx:837:  const [menuFlip, setMenuFlip] = useState(false);
src/components/Rail/ReadingRail.tsx:847:  const menuRef = useRef<HTMLDivElement>(null);
src/components/Rail/ReadingRail.tsx:848:  const menuHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
src/components/Rail/ReadingRail.tsx:850:    if (menuHoverTimer.current) clearTimeout(menuHoverTimer.current);
src/components/Rail/ReadingRail.tsx:851:    menuHoverTimer.current = setTimeout(() => {
src/components/Rail/ReadingRail.tsx:857:    if (menuHoverTimer.current) clearTimeout(menuHoverTimer.current);
src/components/Rail/ReadingRail.tsx:858:    menuHoverTimer.current = setTimeout(() => setMenuOpen(false), 240);
src/components/Rail/ReadingRail.tsx:1046:    if (!menuOpen) return;
src/components/Rail/ReadingRail.tsx:1047:    const anchor = menuRef.current;
src/components/Rail/ReadingRail.tsx:1048:    const menuEl = anchor?.querySelector<HTMLElement>(
src/components/Rail/ReadingRail.tsx:1049:      '[data-testid="rail-menu"]',
src/components/Rail/ReadingRail.tsx:1051:    if (!anchor || !menuEl) return;
src/components/Rail/ReadingRail.tsx:1052:    setMenuFlip(anchor.getBoundingClientRect().right - menuEl.offsetWidth < 0);
src/components/Rail/ReadingRail.tsx:1053:  }, [menuOpen, railWidth]);
src/components/Rail/ReadingRail.tsx:1056:    if (!menuOpen) return;
src/components/Rail/ReadingRail.tsx:1058:      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
src/components/Rail/ReadingRail.tsx:1071:  }, [menuOpen]);
src/components/Rail/ReadingRail.tsx:1289:          matches.map((m) => (
src/components/Rail/ReadingRail.tsx:1328:      {(["stacked", "tabs"] as RailLayout[]).map((layout, index) => (
src/components/Rail/ReadingRail.tsx:1349:        ref={menuRef}
src/components/Rail/ReadingRail.tsx:1358:          aria-haspopup="menu"
src/components/Rail/ReadingRail.tsx:1359:          aria-expanded={menuOpen}
src/components/Rail/ReadingRail.tsx:1361:            const next = !menuOpen;
src/components/Rail/ReadingRail.tsx:1369:        {menuOpen && (
src/components/Rail/ReadingRail.tsx:1371:            data-testid="rail-menu"
src/components/Rail/ReadingRail.tsx:1372:            role="menu"
src/components/Rail/ReadingRail.tsx:1374:              ...(menuFlip
src/components/Rail/ReadingRail.tsx:1385:            {(["stacked", "tabs"] as RailLayout[]).map((layout) => (
src/components/Rail/ReadingRail.tsx:1389:                role="menuitemradio"
src/components/Rail/ReadingRail.tsx:1406:            {(["compact", "comfortable", "card"] as RailDensity[]).map((d) => (
src/components/Rail/ReadingRail.tsx:1410:                role="menuitemradio"
src/components/Rail/ReadingRail.tsx:1451:              snapshots.slice(-5).map((name) => (
src/components/Rail/ReadingRail.tsx:1565:          {RAIL_SEARCH_TIMES.map((t) => (
src/components/Rail/ReadingRail.tsx:1591:          searchMatches.map((m) => {
src/components/Rail/ReadingRail.tsx:1625:        {railSections.map((section) => (
src/components/Rail/ReadingRail.tsx:1639:          {railSections.map((section) => (
src/components/TabBar.tsx:229:  const [menu, setMenu] = useState<CtxMenu | null>(null);
src/components/TabBar.tsx:232:  const [submenuSide, setSubmenuSide] = useState<"left" | "right">("left");
src/components/TabBar.tsx:233:  const [submenuAlignTop, setSubmenuAlignTop] = useState(true);
src/components/TabBar.tsx:234:  const exportSubmenuRef = useRef<HTMLDivElement>(null);
src/components/TabBar.tsx:292:  const handleContextMenu = useCallback(
src/components/TabBar.tsx:330:    const sub = exportSubmenuRef.current;
src/components/TabBar.tsx:334:    setSubmenuSide(rect.left < margin ? "right" : "left");
src/components/TabBar.tsx:335:    setSubmenuAlignTop(rect.bottom <= window.innerHeight - margin);
src/components/TabBar.tsx:339:    if (!menu) return;
src/components/TabBar.tsx:342:  }, [menu]);
src/components/TabBar.tsx:345:  // 内部判定用菜单自身的 data-tab-menu 标记，而不是 .fixed.z-50 类名——
src/components/TabBar.tsx:348:    if (!menu) return;
src/components/TabBar.tsx:350:      target instanceof Element && target.closest("[data-tab-menu]") !== null;
src/components/TabBar.tsx:364:    // 右键 contextmenu 打开菜单时，那次的 pointerdown 已先于本 effect 触发，
src/components/TabBar.tsx:379:  }, [menu]);
src/components/TabBar.tsx:468:        {tabIds.map((id, index) => {
src/components/TabBar.tsx:530:                onContextMenu={(e) => handleContextMenu(e, id)}
src/components/TabBar.tsx:642:      {/* Context menu */}
src/components/TabBar.tsx:643:      {menu && (
src/components/TabBar.tsx:645:          data-tab-menu
src/components/TabBar.tsx:648:            left: menu.x,
src/components/TabBar.tsx:649:            top: menu.y,
src/components/TabBar.tsx:657:            disabled={!tabs[menu.tabId]?.path}
src/components/TabBar.tsx:659:              tabs[menu.tabId]?.path
src/components/TabBar.tsx:664:              const tab = tabs[menu.tabId];
src/components/TabBar.tsx:667:                `[data-tab-id="${menu.tabId}"]`,
src/components/TabBar.tsx:700:              useStore.getState().splitPaneWithTab("row", menu.tabId);
src/components/TabBar.tsx:710:              useStore.getState().splitPaneWithTab("col", menu.tabId);
src/components/TabBar.tsx:730:              data-menu-item="export"
src/components/TabBar.tsx:731:              aria-haspopup="menu"
src/components/TabBar.tsx:734:              disabled={!tabs[menu.tabId]?.path}
src/components/TabBar.tsx:736:                tabs[menu.tabId]?.path ? "导出" : "此页签尚未保存，无路径可导出"
src/components/TabBar.tsx:750:                data-testid="pane-export-submenu"
src/components/TabBar.tsx:751:                role="menu"
src/components/TabBar.tsx:752:                ref={exportSubmenuRef}
src/components/TabBar.tsx:755:                  ...(submenuSide === "left"
src/components/TabBar.tsx:758:                  ...(submenuAlignTop ? { top: 0 } : { bottom: 0 }),
src/components/TabBar.tsx:764:                {EXPORT_MENU_ITEMS.map((sub) => (
src/components/TabBar.tsx:768:                    role="menuitem"
src/components/TabBar.tsx:773:                      const tab = tabs[menu.tabId];
src/components/TabBar.tsx:796:            data-menu-item="print"
src/components/TabBar.tsx:799:              const tab = tabs[menu.tabId];
src/components/TabBar.tsx:813:            disabled={!tabs[menu.tabId]?.path}
src/components/TabBar.tsx:815:              tabs[menu.tabId]?.path
src/components/TabBar.tsx:820:              const path = tabs[menu.tabId]?.path;
src/components/TabBar.tsx:833:            data-menu-item="reveal"
src/components/TabBar.tsx:835:            disabled={!tabs[menu.tabId]?.path}
src/components/TabBar.tsx:837:              tabs[menu.tabId]?.path
src/components/TabBar.tsx:842:              const path = tabs[menu.tabId]?.path;
src/components/TabBar.tsx:851:            data-menu-item="move"
src/components/TabBar.tsx:853:            disabled={!tabs[menu.tabId]?.path}
src/components/TabBar.tsx:855:              tabs[menu.tabId]?.path ? "移动到…" : "此页签尚未保存，无法移动"
src/components/TabBar.tsx:858:              const tab = tabs[menu.tabId];
src/components/TabBar.tsx:870:                  useStore.getState().setTabPath(menu.tabId, next);
src/components/TabBar.tsx:881:            data-menu-item="reload"
src/components/TabBar.tsx:883:            disabled={!tabs[menu.tabId]?.path}
src/components/TabBar.tsx:885:              tabs[menu.tabId]?.path
src/components/TabBar.tsx:886:                ? tabs[menu.tabId]?.dirty
src/components/TabBar.tsx:892:              const tab = tabs[menu.tabId];
src/components/TabBar.tsx:905:                    .refreshTabContent(menu.tabId, result.content);
src/components/TabBar.tsx:916:              onCloseTab(menu.tabId);
src/components/TabBar.tsx:926:              const ids = Object.keys(tabs).filter((id) => id !== menu.tabId);
   700	              useStore.getState().splitPaneWithTab("row", menu.tabId);
   701	              closeMenu();
   702	            }}
   703	          >
   704	            <Icon name="splitRight" size={18} />
   705	            向右分栏
   706	          </button>
   707	          <button
   708	            className="w-full flex items-center gap-2 text-left px-3 py-1.5 hover:bg-[var(--app-sunken)]"
   709	            onClick={() => {
   710	              useStore.getState().splitPaneWithTab("col", menu.tabId);
   711	              closeMenu();
   712	            }}
   713	          >
   714	            <Icon name="splitDown" size={18} />
   715	            向下分栏
   716	          </button>
   717	          <div
   718	            className="h-px my-1"
   719	            style={{ background: "var(--app-border)" }}
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
   821	              if (!path) {
   822	                closeMenu();
   823	                return;
   824	              }
   825	              void navigator.clipboard.writeText(path).catch(() => undefined);
   826	              closeMenu();
   827	            }}
   828	          >
   829	            <Icon name="copyPath" size={18} />
   830	            复制路径
   831	          </button>
   832	          <button
   833	            data-menu-item="reveal"
   834	            className="w-full flex items-center gap-2 text-left px-3 py-1.5 hover:bg-[var(--app-sunken)] disabled:cursor-not-allowed disabled:opacity-45"
   835	            disabled={!tabs[menu.tabId]?.path}
   836	            title={
   837	              tabs[menu.tabId]?.path
   838	                ? "打开文件位置"
   839	                : "此页签尚未保存，无路径可定位"
   840	            }
     1	import { useCallback, useEffect, useRef } from "react";
     2	import { createPortal } from "react-dom";
     3	import Icon from "./Icon";
     4	import type { IconName } from "../ui/icons";
     5	import { popOverlay, pushOverlay } from "../lib/overlayGate";
     6	
     7	export interface ContextMenuItem {
     8	  label: string;
     9	  icon: IconName;
    10	  disabled?: boolean;
    11	  onSelect: () => void;
    12	}
    13	
    14	interface ContextMenuProps {
    15	  x: number;
    16	  y: number;
    17	  items: ContextMenuItem[];
    18	  onClose: () => void;
    19	  testId?: string;
    20	}
    21	
    22	const MENU_W = 180;
    23	const ITEM_H = 30;
    24	
    25	export default function ContextMenu({
    26	  x,
    27	  y,
    28	  items,
    29	  onClose,
    30	  testId,
    31	}: ContextMenuProps) {
    32	  const ref = useRef<HTMLDivElement | null>(null);
    33	
    34	  useEffect(() => {
    35	    pushOverlay();
    36	    return () => popOverlay();
    37	  }, []);
    38	
    39	  useEffect(() => {
    40	    const onPointerDown = (e: PointerEvent) => {
    41	      if (ref.current?.contains(e.target as Node)) return;
    42	      onClose();
    43	    };
    44	    const onKeyDown = (e: KeyboardEvent) => {
    45	      if (e.key !== "Escape") return;
    46	      e.stopPropagation();
    47	      onClose();
    48	    };
    49	    document.addEventListener("pointerdown", onPointerDown, true);
    50	    document.addEventListener("keydown", onKeyDown);
    51	    window.addEventListener("scroll", onClose, true);
    52	    window.addEventListener("resize", onClose);
    53	    return () => {
    54	      document.removeEventListener("pointerdown", onPointerDown, true);
    55	      document.removeEventListener("keydown", onKeyDown);
    56	      window.removeEventListener("scroll", onClose, true);
    57	      window.removeEventListener("resize", onClose);
    58	    };
    59	  }, [onClose]);
    60	
    61	  useEffect(() => {
    62	    ref.current
    63	      ?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')
    64	      ?.focus();
    65	  }, []);
    66	
    67	  const move = useCallback((dir: 1 | -1) => {
    68	    const list = Array.from(
    69	      ref.current?.querySelectorAll<HTMLButtonElement>(
    70	        '[role="menuitem"]:not(:disabled)',
    71	      ) ?? [],
    72	    );
    73	    if (list.length === 0) return;
    74	    const i = list.findIndex((el) => el === document.activeElement);
    75	    list[(i + dir + list.length) % list.length].focus();
    76	  }, []);
    77	
    78	  const left = Math.min(x, Math.max(window.innerWidth - MENU_W - 8, 8));
    79	  const top = Math.min(
    80	    y,
    81	    Math.max(window.innerHeight - items.length * ITEM_H - 16, 8),
    82	  );
    83	
    84	  return createPortal(
    85	    <div
    86	      ref={ref}
    87	      data-testid={testId ?? "context-menu"}
    88	      role="menu"
    89	      className="context-menu"
    90	      style={{ left, top, width: MENU_W }}
    91	      onKeyDown={(e) => {
    92	        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    93	          e.preventDefault();
    94	          move(e.key === "ArrowDown" ? 1 : -1);
    95	          return;
    96	        }
    97	        if (e.key === "Tab") onClose();
    98	      }}
    99	    >
   100	      {items.map((item) => (
   101	        <button
   102	          key={item.label}
   103	          type="button"
   104	          role="menuitem"
   105	          disabled={item.disabled}
   106	          onClick={() => {
   107	            onClose();
   108	            item.onSelect();
   109	          }}
   110	          className="context-menu-item"
   111	        >
   112	          <Icon name={item.icon} size={18} />
   113	          <span>{item.label}</span>
   114	        </button>
   115	      ))}
   116	    </div>,
   117	    document.body,
   118	  );
   119	}

exec
/bin/zsh -c "nl -ba docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md | sed -n '1,180p'
nl -ba docs/design/pluginization-datafile-settings-rail/03-settings-page-optimization.md | sed -n '1,220p'
nl -ba docs/design/pluginization-datafile-settings-rail/04-document-discovery-and-plugin-display.md | sed -n '1,220p'" in /Users/mason/ToHighs/clairis-wt-design-plan
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
     1	# 设置页面优化方案
     2	
     3	> 状态：设计方案（已通过独立对抗评审，按意见修订）
     4	> 对应目标：第 3 项——设置页重新规划设计，含快捷键体系，改为独立浮窗，出逼真原型
     5	> 事实基线：`src/components/SettingsView.tsx`、`src/components/ShortcutOverlay.tsx`、`src/lib/shortcuts.ts`、`src/editors/keybindings.ts`、`src/App.tsx`、`src/main.tsx`、`src-tauri/src/lib.rs`、`docs/design/system/spec.md`
     6	
     7	## 1. 背景与现状
     8	
     9	当前设置页 `SettingsView.tsx` 为**左侧导航 + 右侧内容**布局，实际已有 **11 个分类**：外观、编辑器、文件、阅读空间、网格概览、悬浮预览、AI 服务、扩展、快捷键、数据与备份、关于。
    10	
    11	**现状澄清（修正此前的误判）**：
    12	
    13	1. **快捷键已有基础展示，不是空白**。设置页已渲染 `coreShortcuts()` 为「核心快捷键」列表（`SettingsView.tsx:2621-2636`），并提供「查看完整列表」按 `SHORTCUT_FAMILY_ORDER` 十族分组展开（`SettingsView.tsx:2638-2687`）；另有 `ShortcutOverlay.tsx` 用 `?` 键展示全表。**核心区 + 完整列表两层已实现**。
    14	2. **「临时架子」的判断成立，但指的是分类编排与形态**：分类虽多，但与第 1 项（插件）、第 2 项（数据文件）无呼应，快捷键缺规则卡与全局/局部二分，整体形态仍是页面内嵌而非独立浮窗。
    15	3. **快捷键注册表素材齐全**：`shortcuts.ts` 已有 10 个 family、global/local 作用域、core 标记、冲突裁定说明。
    16	
    17	**本方案的增量（而非从零搭建）**：补规则卡、全局/局部二分、可重映射入口、独立浮窗形态、分类与第 1/2 项呼应。
    18	
    19	## 2. 设计目标
    20	
    21	1. **快速记住和使用快捷键**：在已有核心+完整列表之上，补规则记忆法、全局/局部清晰区分、可改范围明确。
    22	2. **独立浮窗**：设置成为独立浮窗，不阻塞主窗口，可拖动/折叠/置顶，位置记忆。
    23	3. **布局分类覆盖全部能力域**：分类参考第 1 项（插件）与第 2 项（数据文件），与既有 11 分类平滑衔接。
    24	
    25	## 3. 布局分类设计
    26	
    27	### 3.1 现状 11 分类 → 新分类映射
    28	
    29	先交代既有分类的归宿，避免迁移成本被隐藏：
    30	
    31	| 现状分类 | 去向 | 说明 |
    32	|---|---|---|
    33	| 外观 | **视图** | 主题、界面样式归入视图 |
    34	| 编辑器 | **编辑器**（保留） | 字号、选区工具条、轮盘、HTML 工具条、属性栏、模板 |
    35	| 文件 | **通用** | 文件相关偏好 |
    36	| 阅读空间 | **阅读** | 阅读相关设置 |
    37	| 网格概览 | **视图** | 网格概览配置归入视图 |
    38	| 悬浮预览 | **视图** | 悬浮预览归入视图 |
    39	| AI 服务 | **AI**（保留） | 模型、提供方、连接、风格、会话 |
    40	| 扩展 | **插件** | 「扩展」升级为「插件」分类，对接第 1 项 |
    41	| 快捷键 | **快捷键**（保留，重做体系） | 见第 4 节 |
    42	| 数据与备份 | **数据文件** | 升级为「数据文件」分类，对接第 2 项（快照保留） |
    43	| 关于 | **关于**（保留） | 版本、快捷键总览入口 |
    44	
    45	### 3.2 新分类导航
    46	
    47	设置浮窗左侧分类导航，右侧内容。分类按「能力域 + 可配置面」组织，与第 1、2 项清单呼应：
    48	
    49	| 分类 | 内容 | 来源 |
    50	|---|---|---|
    51	| **快捷键** | 核心高频、完整列表、规则技巧、全局/局部、可重映射 | 第 3 项本方案 |
    52	| **插件** | 插件清单、启停、卸载、查看数据文件 | 第 1 项 A/B 档插件（原「扩展」升级） |
    53	| **数据文件** | 可配置数据文件清单、字段说明、AGENT 写入说明、快照 | 第 2 项功能清单（原「数据与备份」升级） |
    54	| **编辑器** | 字号、选区工具条、轮盘、HTML 工具条、属性栏、模板 | 现状「编辑器」保留 |
    55	| **阅读** | 字体、字号、行高、主题、版式、阅读模式 | 现状「阅读空间」+ `reader` |
    56	| **视图** | 视图规格、分栏、工具条、网格概览、悬浮预览、外观 | 现状「外观/网格概览/悬浮预览」合并 + 第 1 项 B2–B5 |
    57	| **AI** | 模型、提供方、连接、风格、会话 | 现状「AI 服务」保留 |
    58	| **通用** | 文件偏好、默认新建格式、自动保存、捕获浮层 | 现状「文件」+ 第 1/2 项规划能力 |
    59	| **关于** | 版本、快捷键总览入口 | 现状「关于」保留 |
    60	
    61	**分类原则**：每个分类对应一个能力域或可配置面，与第 1、2 项清单一一呼应。注意「通用」中的默认新建格式、自动保存、捕获浮层是第 1/2 项的规划能力，**非当前已实现**，原型按规划呈现。
    62	
    63	## 4. 快捷键体系设计（核心增量）
    64	
    65	`shortcuts.ts` 已提供全部素材（family、scope、core、decision、keys）。本方案在其上补三层增量，并修正既有二分的误分类。
    66	
    67	### 4.1 核心高频快捷键（最上层）
    68	
    69	取 `shortcuts.ts` 中 `core: true` 的**全部 7 条**定案（实现时以注册表为准，此处枚举定案）：
    70	
    71	- **⌘P** 快速打开
    72	- **⌘\** 阅读空间
    73	- **⌘⇧\** 网格概览
    74	- **⌘K** AI 快捷浮层
    75	- **⌘⇧A**（core，具体功能见注册表）
    76	- **⌘,** 设置
    77	- **?** 快捷键总览
    78	
    79	**说明**：`?`（总览）与 `⌘,`（设置）列入核心是注册表既有裁定；若从「最该记住的少数几条」角度认为二者偏入口性质，可在原型阶段提出调整建议，但**以注册表现状为准**，不擅自改动。
    80	
    81	**展示要求**：每条显示「键位 + 功能名 + 一句话用途」，键位用等宽键位样式（见 4.6 规范缺口处理），核心区视觉最突出。
    82	
    83	### 4.2 快捷键规则技巧说明（帮助记忆，而非死记）
    84	
    85	把 `shortcuts.ts` 顶部的**设计规则**显性化展示，让用户理解键位编排逻辑，从而推导记忆：
    86	
    87	| 规则 | 说明 | 示例 |
    88	|---|---|---|
    89	| **单 ⌘ 高频** | 最常用的动作用单个 ⌘ | ⌘P、⌘\ |
    90	| **⌘⇧ 二级** | 次级动作用 ⌘⇧ | ⌘⇧\（网格）、⌘⇧X |
    91	| **⌘⌥ 分栏/空间** | 涉及空间布局的用 ⌘⌥ | ⌘⌥\（固定左边栏） |
    92	| **⌥ 过滤** | 过滤类用 ⌥ | ⌥+类型 |
    93	| **不用三修饰键** | 避免三修饰键，降低记忆与冲突 | — |
    94	
    95	**展示位置**：核心区下方，用「规则卡」形式，每条规则一行，附一个示例键位。此层为全案最有增量价值的部分。
    96	
    97	### 4.3 全局与局部快捷键的区分（修正误分类）
    98	
    99	`shortcuts.ts` 区分 `scope: global / local`。**注意：直接按 scope 二分存在误分类**——media 族全部条目未标 `scope`（默认 global），但注册表注释明确「播放器聚焦时生效」；card 族 ⌘1–9/按住 ⌘ 只在网格上下文生效，也未标 `scope: "local"`。照此实现会把上下文受限的键展示为全局，与「避免用户误在全局找不到」冲突。
   100	
   101	**处理方案（二选一，实现时定）**：
   102	
   103	- **方案一（推荐）**：给 `shortcuts.ts` 的 media/card 族补 `scope: "local"` + `context`，使注册表与真实上下文一致，再按 scope 二分。这是根治。
   104	- **方案二（保守）**：注册表暂不改，方案显式声明按 scope 二分的局限，改用「按 family 分组 + context 标注」的替代分组规则，对 media/card 单独说明上下文。
   105	
   106	**全局区枚举（补全）**：全局族应包含全部 10 族中标记为 global 的条目，即全局、**类型过滤（typeFilter）**、**模式（mode）**、文件、工作区、导航、卡片、AI、媒体、局部——按 family 分组展示，不漏 typeFilter 与 mode。
   107	
   108	**局部区展示**：`scope: local` 的条目，每条标注真实 `context`（如属性面板菜单、搜索浮窗），不使用虚构的「编辑器内」「阅读模式下」。
   109	
   110	### 4.4 可重新调整的快捷键（明确可改范围 + 依赖约束）
   111	
   112	**当前状态：可重映射是空谈，需标注依赖**。`SHORTCUTS` 是编译期 TS 常量，**按键行为由 `App.tsx` 硬编码分发**（`App.tsx:423-780` 全是 `e.key` 判断，未消费 SHORTCUTS）。即使第 1 项 B1「键位数据文件化」完成，**不把 `App.tsx` 的按键分发改成读数据文件，重映射永不生效**。
   113	
   114	**设计（标注依赖）**：
   115	
   116	| 类别 | 范围 | 说明 |
   117	|---|---|---|
   118	| **可重映射** | 有键位绑定的应用级快捷键（`SHORTCUTS` 中已实现条目） | **依赖第 1 项 B1**：键位数据文件化必须同时重接线 `App.tsx` 按键分发，否则重映射不生效。重映射流程：记录新键位 → 写入键位数据文件 → **分发层读文件重接线** → 生效。现成参考：`rouletteHotkey` 配置项（`SettingsView.tsx` 的 `commitRouletteHotkey`）是当前唯一可重映射原型 |
   119	| **编辑器内可改** | 编辑器内格式键位（加粗/斜体等 CM6 键位，`keybindings.ts`） | 依赖键位数据文件化纳入可改范围 |
   120	| **不可改** | 编辑器核心、渲染管线等运行时键位 | 不向用户开放，避免破坏核心行为 |
   121	
   122	**展示要求**：可重映射区块提供「修改」入口，但**当前阶段标注「依赖键位文件化，暂未开放」**，避免用户点进去无效。`decision` 冲突裁定字段：`ShortcutOverlay` 已行内展示，设置页完整列表应补齐展示。
   123	
   124	### 4.5 同源消费的真相
   125	
   126	方案原称「四处同源消费」名不副实：真正 import `shortcuts.ts` 的只有 `SettingsView.tsx`、`ShortcutOverlay.tsx`（展示）及 `SuggestMenu.tsx`/`SearchReplacePanel.tsx`（`activateLocalContext`）。**按键分发未消费 SHORTCUTS**，`TooltipLayer.tsx` 键位是独立硬编码表。这是漂移隐患，应在实现时让按键分发与 tooltip 统一消费 SHORTCUTS，而非维持现状。
   127	
   128	### 4.6 键位样式规范缺口
   129	
   130	方案原称「键位用设计系统规定的等宽键位样式」，但 **`spec.md` 全文无 kbd/键位样式条款**，当前 `SettingsView.tsx:2631` 用的是临时 `kbd` class。按 AGENTS.md 视觉锚点规矩，这是**规范缺口**：应先在 `spec.md` 补 kbd/键位条款再写码，或降级措辞为「沿用现有 kbd 样式、条款待补」。原型阶段按后者处理，标注条款待补。
   131	
   132	## 5. 独立浮窗设计方案
   133	
   134	### 5.1 形态
   135	
   136	设置从「页面内嵌」改为**独立浮窗**，形态特征：
   137	
   138	- **独立窗口**：不依附于主窗口内容区，可自由拖动。
   139	- **不阻塞**：浮窗打开时主窗口可继续操作（阅读、编辑不中断）。
   140	- **可折叠/置顶/关闭**：折叠为标题栏条，置顶常驻，关闭后记忆位置。
   141	- **位置记忆**：窗口位置、尺寸、折叠状态持久化（见 5.4）。
   142	
   143	### 5.2 内部布局
   144	
   145	浮窗内部沿用「左侧分类导航 + 右侧内容」，适配浮窗尺寸：左侧分类导航窄且固定，右侧内容随浮窗缩放，长内容内部滚动。
   146	
   147	### 5.3 与主窗口的关系 + 跨窗口同步（关键机制）
   148	
   149	现 `SettingsView` 写配置后同树内立即 `applyTheme/saveAppConfig` 生效（`App.tsx:1002` 场景切换挂载）。拆成第二窗口后，**配置变更必须经 Tauri 事件回主窗口重应用**——否则浮窗改了设置，主窗口不响应。
   150	
   151	**跨窗口同步机制（必须设计）**：
   152	
   153	- 浮窗写配置 → 经 Tauri IPC 广播配置变更事件 → 主窗口监听事件 → 重新应用主题/设置。
   154	- **先例**：`src/main.tsx:49-63` 已监听 `open-file-in-main`，`src-tauri/src/lib.rs:85-99` 已建 overlay 窗口。浮窗复用 overlay 窗口机制，扩展事件同步。
   155	- `?` 键当前打开应用内 `ShortcutOverlay`，与设置浮窗是两个东西，入口需区分叙述，不合并。
   156	
   157	### 5.4 缩放与位置持久化
   158	
   159	**缩放抉择（必须定）**：现有 overlay 窗口 `decorations(false)`，只有固定 `inner_size/min_inner_size`（`lib.rs:96-97`），无原生缩放手柄。二选一：
   160	
   161	- **自定义 resize 把手**：浮窗内自绘拖拽把手调整尺寸（不依赖原生装饰）。
   162	- **原生装饰**：改 `decorations(true)`，用系统原生缩放（牺牲无边框外观）。
   163	
   164	原型阶段按「自定义 resize 把手」呈现，实现时定。
   165	
   166	**位置持久化落点**：Zustand store 不持久化，窗口位置/尺寸/折叠状态必须写入配置文件字段（`state` 或独立窗口状态文件），恢复时经 Tauri 窗口位置 API 还原。
   167	
   168	### 5.5 入口
   169	
   170	- 主窗口「设置」按钮 → 打开设置浮窗。
   171	- `?` 键 → 打开应用内 `ShortcutOverlay`（快捷键总览，非设置浮窗）。
   172	
   173	## 6. 视觉锚点
   174	
   175	原型视觉遵循设计系统条款：
   176	
   177	- 间距：§3 间距刻度
   178	- 字号：§4 字号阶梯
   179	- 圆角与阴影：§5（`--radius-4` 控件、`--radius-8` 浮层、`--app-shadow`）
   180	- 语义色：§6（`--app-accent`、`--app-surface`、`--app-border` 等）
   181	- 图标：§2 图标系统
   182	- **键位样式**：规范缺口，暂沿用现有 kbd 样式，条款待补（见 4.6）
   183	
   184	## 7. 边界
   185	
   186	- 不改编辑器核心、渲染管线的快捷键行为。
   187	- 浮窗不引入新的窗口管理器能力，复用 overlay 窗口机制 + IPC 事件同步。
   188	- 快捷键展示以 `shortcuts.ts` 为唯一真相源，不在设置页另写一份键位；按键分发与 tooltip 应统一消费 SHORTCUTS（实现时处理，消除漂移）。
   189	- 「置顶常驻」与「不抢焦点」的优先级待裁定，原型阶段按「不抢焦点优先」呈现。
   190	
   191	## 8. 对抗评审记录
   192	
   193	**评审方**：独立只读评审子代理（注：用户指定 codex CLI，实测 codex 未登录且登录进行中；为不阻塞，先以独立评审子代理完成对抗评审，codex 登录完成后补跑）。
   194	
   195	**总体判定**：需修订（已按意见修订，见上文各节修正标记）。
   196	
   197	**主要意见与处置**：
   198	
   199	1. **现状「3 个 Tab」错误，实为 11 分类** → 已采纳，§1 重写、§3.1 补映射表。
   200	2. **快捷键已有核心+完整列表展示，非空白** → 已采纳，方案改为「增量」表述。
   201	3. **按键分发未消费 SHORTCUTS、TooltipLayer 独立硬编码** → 已采纳，§4.5 补同源真相与漂移隐患。
   202	4. **core 实为 7 条** → 已采纳，§4.1 枚举全部 7 条。
   203	5. **scope 二分误分类 media/card、全局族漏 typeFilter/mode** → 已采纳，§4.3 修正并给两种处理方案。
   204	6. **可重映射缺分发层重接线，当前空谈** → 已采纳，§4.4 标注依赖 + 硬约束 + rouletteHotkey 参考。
   205	7. **浮窗缺跨窗口同步、缩放、位置持久化** → 已采纳，§5.3/5.4 补齐机制与抉择。
   206	8. **分类映射缺失** → 已采纳，§3.1 补全。
   207	9. **键位样式无 spec 条款（规范缺口）** → 已采纳，§4.6 标注，原型按降级处理。
   208	10. **「通用」类标注现状 prefs 为虚构** → 已采纳，§3.2 标注为规划能力。
   209	
   210	**可保留**：4.2 规则卡内容与形式；四层结构方向；独立浮窗目标方向；§6 视觉锚点（除键位样式假锚）。
     1	# 文档发现与插件展示方案
     2	
     3	> 状态：设计方案（已通过独立对抗评审，按意见修订）
     4	> 对应目标：第 4 项——重做文档发现操作方案（便捷直观、有设计感）+ 插件展示策略
     5	> 事实基线（已校正）：`src-tauri/src/config.rs`、`src-tauri/src/commands/recent.rs`、`src-tauri/src/commands/search.rs`、`src/lib/railView.ts`、`src/components/Rail/ReadingRail.tsx`、`src/components/Grid/GridToolbar.tsx`、`src/lib/gridView.ts`、`src/components/Grid/GridTile.tsx`、`src/stores/index.ts`、`src/components/PortalView.tsx`、`src/components/QuickOpen.tsx`、`src/lib/quickOpen.ts`、`src/App.tsx`、`docs/research/technical/plugin-management-benchmark.md`
     6	
     7	## 1. 背景与目标
     8	
     9	当前文档发现靠阅读空间左边栏和网格概览，用户反馈「找不到想看的文档」。目标是重做文档发现操作方案，做到**便捷直观、有设计感**，并确定插件如何展示在窗口（或不单独展示、怎么操作。
    10	
    11	## 2. 诊断（已按事实重写）
    12	
    13	### 2.1 现状盘点：能力已存在，问题在入口分工
    14	
    15	**左边栏已具备四段结构 + 全文搜索**（方案原诊断「左边栏以文件名/时间为主轴、记得内容时没有路径」与事实不符）：
    16	
    17	- `RAIL_SECTIONS = [now, pinned, recent, category]`（`railView.ts:55-71`）——「现在（正在阅读）/收藏/最近/分类」四段已存在。
    18	- **内置本机全文搜索**（`ReadingRail.tsx:972-998`）：去抖 300ms 后 `invoke("search_documents")`，已落地搜索框、命中数、时间过滤、清空全套 UI。
    19	
    20	**网格概览已有搜索/排序/分组/过滤**（方案原称「有设计感但定位弱」无证据，且低估了网格能力）：
    21	
    22	- 搜索框（`GridToolbar.tsx:194-209`）、排序（最近/名称/类型，`gridView.ts:14-25`）、分组（时间/类型/主题/不分组，`:27-32`）、类型过滤、仅看收藏（`stores/index.ts:447-451`）。
    23	- 卡片含缩略图 + 真摘要（`GridTile.tsx:162-165,309-314`）。
    24	- **注**：网格的「主题」分组是**按父目录**（`gridView.ts:121` 注释「theme = 父目录」），不是标签。
    25	
    26	**门户是默认落地场景**（方案原遗漏）：
    27	
    28	- 初始 `scene: "portal"`（`stores/index.ts:445`），`App.tsx:977` 渲染 `PortalView`（继续阅读 hero + 最近富卡 + 8 类磁贴 + 快速动作），门户底部自带「⌘P 搜索全部」提示（`PortalView.tsx:348`）。**门户才是用户打开应用的第一发现面**。
    29	
    30	**⌘P 已存在但能力有限**（方案原称「已有需强化」被低估）：
    31	
    32	- `QuickOpen.tsx` + `quickOpen.ts` 已存在，但过滤**仅 title+path 大小写不敏感子串匹配**（`quickOpen.ts:8-9,36,47-65`），条目仅三类：页签 / 最近文件 / 两个命令（网格、设置）（`QuickOpen.tsx:32-38`）。**无内容搜索、无标签搜索、无收藏分组**。
    33	- `search_documents` 扫描的是**整个 home 目录**（`search.rs:240,261-272`，跳过 heavy dir）。
    34	
    35	### 2.2 真实问题
    36	
    37	诊断修正为：
    38	
    39	1. **⌘P 仅做标题子串过滤，不能按内容直达**——真正的差距在这里，而非左边栏路径缺失。
    40	2. **发现入口层级与分工未定义**——门户 / 左边栏搜索 / 网格搜索 / ⌘P / 编辑器内搜索（⌘F，`App.tsx:614`）**五处并存**，各入口范围与结果是否一致、谁主谁辅，零讨论。这是「发现路径单一」诊断自己制造的新混乱。
    41	
    42	**用户反馈引用**：仓库内可查的近期反馈是 issue #897（视觉缺陷：网格缩略图取帧、卡片重叠、表格边距），**非「找不到文档」**。本方案将「找不到文档」降级为**待验证假设**，与 #897 这类视觉反馈区分开。
    43	
    44	## 3. 发现入口分工（新增，必补）
    45	
    46	定义五处入口的边界，避免变体 A 制造入口冗余：
    47	
    48	| 入口 | 作用域 | 定位 | 键位 |
    49	|---|---|---|---|
    50	| **门户** | 全局发现 | 默认落地场景，继续阅读 + 快速动作 + ⌘P 提示 | 无（默认场景） |
    51	| **⌘P（快速打开）** | **全局发现主入口** | 跨页签/最近/命令 +（升级后）内容搜索 | ⌘P（`shortcuts.ts:66-76`） |
    52	| **左边栏搜索** | 阅读空间场景内 | 阅读空间文档内的过滤 | ⌘\（`shortcuts.ts:82-88`） |
    53	| **网格搜索** | 网格场景内 | 网格文档内的过滤 | ⌘⇧\（`shortcuts.ts:106-112`） |
    54	| **⌘F** | 文档内定位 | 当前文档内的文本定位 | ⌘F（`App.tsx:614`） |
    55	
    56	**分工原则**：⌘P = 全局发现主入口；⌘F = 文档内定位；左边栏/网格搜索 = 对应场景内的过滤。各入口结果范围需一致或明确标注，不重叠混淆。
    57	
    58	## 4. 文档发现操作方案（变体）
    59	
    60	### 变体 A：搜索提升为发现主入口（推荐，但增量需重新定义）
    61	
    62	**增量澄清（已校正）**：方案原称的「双轨侧栏（收藏+最近）」**已是现状**（`RAIL_SECTIONS` 已含 pinned/recent），**不是新增**。变体 A 的真正变更只有：
    63	
    64	1. **⌘P 接入内容搜索**：从同步子串过滤（title+path）改为**异步全文检索**（复用 `search_documents`）+ 多分组面板（页签/最近/收藏/命中文档）。
    65	2. **收藏分组**：⌘P 面板内增加收藏分组入口。
    66	3. **键位/入口层级调整**：按 §3 分工明确 ⌘P 为主入口。
    67	
    68	**搜索范围决策（必补，原方案缺失）**：
    69	
    70	- `search_documents` 默认扫整个 home，若 ⌘P 直接接，**每键触发全盘扫描**，且可能命中阅读空间之外的文件（语义不符）。
    71	- **建议**：⌘P 内容搜索**限定范围**——限定为「最近库 + 阅读空间内的文档」，而非全盘 home。理由：① 发现目标是阅读空间文档，全盘命中语义不符；② 避免每键全扫的性能问题。
    72	- **异步加载态**：⌘P 从同步变异步，需设计加载态（去抖沿用 300ms 先例 + `spawn_blocking`，左边栏搜索已有先例）。
    73	
    74	**成本修正**：⌘P 内容搜索是**功能重构而非强化**（同步子串 → 异步全文 + 多分组面板），实现成本高于原方案判断。
    75	
    76	### 变体 B：空间地图 + 标签分簇（备选，成本高）
    77	
    78	**数据基础修正（原方案误判）**：变体 B 的「frontmatter 标签」数据基础**当前不存在**——`RecentFile` 只有 path/title/openedAt/excerpt（`src/types/index.ts:178-184`），**无标签模型、无标签索引**，frontmatter 解析是通用 YAML、无 tags 字段约定。网格现有「主题」分组是按父目录，不是标签。
    79	
    80	**变体 B 需补齐的成本清单**：
    81	
    82	1. **标签数据模型**：在 `RecentFile` 或扫描层新增标签字段（无现存字段）。
    83	2. **标签抽取管线**：从 frontmatter 抽取 tags 并建索引。
    84	3. **可缩放空间地图 + 时间轴叠加**：全新交互组件；且网格当前是整屏场景覆盖层（`App.tsx:997-999`），改造是**新建场景**而非升级网格。
    85	4. **与网格 theme 分组的重合度**：评估「按目录分簇」与网格现有 theme 分组是否重复建设。
    86	
    87	**决策**：变体 B 成本被系统性低估，保留为备选。**上马判据**：当标签数据模型与抽取管线落地后，再评估地图组件的投入产出；否则不上马。
    88	
    89	### 变体 C：智能推荐 / 语义检索（备选，保留）
    90	
    91	**现状修正**：变体 C 的前提是「文件无结构化元数据、纯文本检索」，但**左边栏已有全文搜索、网格已有分组**，语义检索的增量价值需重新论证——除非引入向量检索或阅读行为学习，否则与已有全文搜索重叠。
    92	
    93	**定位**：保留为备选，自评冷启动与算法投入成本高。
    94	
    95	### 变体对比（修订后）
    96	
    97	| 维度 | 变体 A（搜索主入口） | 变体 B（空间地图+标签） | 变体 C（语义推荐） |
    98	|---|---|---|---|
    99	| 新颖度 | ⌘P 内容搜索是真增量（其余是已有） | 高（地图是全新组件） | 中（依赖算法） |
   100	| 成本 | 中高（⌘P 重构+范围限定+异步态） | 高（标签模型+管线+地图组件） | 高（冷启动+算法） |
   101	| 数据基础 | 已有（`search_documents`） | **缺失**（需建标签模型） | 部分（全文搜索已有，语义需补） |
   102	| 便捷直观 | 高（键盘直达） | 中（空间交互需学习） | 中 |
   103	| 设计感 | 中高 | 高 | 中 |
   104	
   105	**推荐**：**变体 A 为主**，但需先落地 §3 入口分工与搜索范围限定；变体 B 在标签数据基础补齐后再评估。
   106	
   107	## 5. 插件展示策略（已按术语校正）
   108	
   109	### 5.1 前提校正
   110	
   111	**「第 1 项会提取出较多插件」不成立**：01 号文档 A 档用户可见插件仅 4 项（片段/模板/theme.toml/SKILL.md 包），B 档目前还是代码常量、需另立批次文件化。展示策略不建立在「插件很多」的夸大前提上。
   112	
   113	### 5.2 展示方向（保留，对齐 benchmark 与产品信条）
   114	
   115	**不常驻主窗口 + 能力就近 + 设置集中管理**——与 `plugin-management-benchmark.md`（第三、四节「插件管理入口放设置深处，无常驻 UI，零弹窗」「大而全的插件管理 UI 与信条冲突」）及产品信条一致，方向保留。
   116	
   117	### 5.3 操作入口（已按生命周期定义校正）
   118	
   119	**「启停/卸载」是数据包型插件（A4，`.disabled` 标记）专属的生命周期**；数据文件型插件（A1–A3）是「删文件即卸载」，无启停概念（01 号文档 §5.1 已写明）。操作入口按插件类型分：
   120	
   121	| 插件类型 | 操作入口 | 操作 |
   122	|---|---|---|
   123	| 数据包型（A4） | 设置内插件分类 | 启停 / 卸载（`.disabled` 标记） |
   124	| 数据文件型（A1–A3） | 设置内插件分类（清单查看） | **删文件即卸载**；设置内提供清单查看入口 |
   125	
   126	### 5.4 可发现性（补充，原方案未回答）
   127	
   128	原方案只解决「操作」不解决「发现」。**可发现性处理**：设置内插件分类的清单即发现入口（用户可在设置中浏览有哪些插件能力）；或对齐数据文件目录约定，用户通过目录结构感知能力。不新增常驻 UI，避免与「零弹窗、无常驻」信条冲突。
   129	
   130	## 6. 原型设计方向
   131	
   132	原型需覆盖：
   133	
   134	1. **变体 A 的 ⌘P 升级面板**：内容搜索 + 多分组（页签/最近/收藏/命中）+ 加载态。
   135	2. **§3 入口分工的视觉呈现**：门户 / 左边栏 / 网格 / ⌘P / ⌘F 的边界示意。
   136	3. **门户纳入对比**：原型对比建议改为「变体 A 与门户改造」或说明门户去留（原方案只并排 A/B，漏了最高曝光面门户）。
   137	4. **插件展示**：设置内插件分类清单（数据包型启停 + 数据文件型清单查看）。
   138	
   139	## 7. 边界（保留）
   140	
   141	- **不动编辑器核心**：CM6 编辑器 undo/选区/编辑状态不变（AGENTS.md 硬约束）。
   142	- **不新建窗口机制**：文档发现在现有窗口内完成，不新建独立窗口。
   143	- **搜索范围限定**：⌘P 内容搜索限定阅读空间/最近库，不扫全盘 home（见变体 A）。
   144	
   145	## 8. 对抗评审记录
   146	
   147	**评审方**：独立只读评审子代理（注：用户指定 codex CLI，实测 codex 未登录且登录进行中；为不阻塞，先以独立评审子代理完成对抗评审，codex 登录完成后补跑）。
   148	
   149	**总体判定**：需修订（已按意见全部修订）。
   150	
   151	**主要意见与处置**：
   152	
   153	1. **事实基线错误（state.rs 不存在）**：`recentFiles/scrollPositions` 实际在 `config.rs`（字段 `:37-41`、序列化 `:434-453`、落盘 `:998`）+ `commands/recent.rs` → 已采纳，§顶部事实基线校正。
   154	2. **诊断失实**：左边栏已有四段+全文搜索、网格已有搜索/排序/分组、门户被遗漏 → 已采纳，§2 诊断重写，§3 补门户与五入口分工。
   155	3. **⌘P 被低估**：内容搜索是重构非强化，搜索范围与异步方案缺失 → 已采纳，变体 A 重新定义增量 + 搜索范围限定 + 异步加载态。
   156	4. **变体 B 数据基础不存在**：无标签模型/索引 → 已采纳，变体 B 补成本清单 + 上马判据。
   157	5. **插件章术语矛盾**：「较多插件」不成立；「启停/卸载」应限定数据包型 → 已采纳，§5 前提校正 + 操作入口按类型分。
   158	6. **用户反馈无出处**：#897 是视觉缺陷 → 已采纳，§2 降级为待验证假设。
   159	7. **搜索入口重叠未处理**：五处并存 → 已采纳，§3 新增入口分工。
   160	
   161	**可保留**：「搜索提升为发现主入口」方向；变体 C 备选定位；§4.1 插件「不常驻主窗口、能力就近、设置集中管理」方向；§6 边界。
   162	
   163	**需重新论证**：「变体 A 为主方案」的结论——需在诊断与成本修正后重新评估，已据实重新定义增量。

exec
/bin/zsh -c "rg -n 'config_base|app_config_dir|data/|user/|defaults/|state/' src-tauri/src/config.rs src-tauri/src/extension_packages.rs src-tauri/src/extensions.rs src/hooks/useConfig.ts docs/agents/data-surface.md | sed -n '1,320p'
rg -n 'fn user_path|fn defaults_path|fn state_path|fn ensure_defaults|fn effective_config' src-tauri/src/config.rs -C 3" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
docs/agents/data-surface.md:131:| 派生状态（最近文件/滚动位置） | `state/state.json` | 用户行为产物，AI 不直写 |
src-tauri/src/config.rs:457:    info!(from = %legacy.display(), "旧配置已拆分为 user/state 两层");
src-tauri/src/config.rs:893:    let path = config_base(app)
src-tauri/src/config.rs:911:| defaults | `defaults/settings.json` | 代码默认值，首次运行生成 |
src-tauri/src/config.rs:912:| user | `user/settings.json` | 用户设置，`patch_config` 写这里 |
src-tauri/src/config.rs:913:| state | `state/state.json` | 派生状态（recentFiles / scrollPositions / embedScrollPositions），不归 patch 管 |
src-tauri/src/config.rs:942:- 不要手改 `state/state.json`；它由应用维护。
src-tauri/src/config.rs:946:pub fn config_base(app: &AppHandle) -> PathBuf {
src-tauri/src/config.rs:948:        .app_config_dir()
src-tauri/src/config.rs:976:    let base = config_base(app);
src-tauri/src/config.rs:983:    save_config_at(&config_base(app), config)
src-tauri/src/config.rs:987:    list_snapshots(&config_base(app))
src-tauri/src/config.rs:991:    restore_snapshot(&config_base(app), name)
src-tauri/src/config.rs:994:/// 轮询 `user/settings.json` 的 (mtime, len)，变化时发 `config-changed`。
src-tauri/src/config.rs:997:    let path = user_path(&config_base(&app));
src-tauri/src/extension_packages.rs:1://! 扩展包管理（layout-portal §9）：`<config_base>/extensions/<id>/` 下的
src-tauri/src/extension_packages.rs:9://! - `<config_base>/extensions/<id>/manifest.json`
src-tauri/src/extension_packages.rs:10://! - `<config_base>/extensions/<id>/SKILL.md`
src-tauri/src/extension_packages.rs:11://! - `<config_base>/extensions/<id>/.disabled`（可选，停用标记）
src-tauri/src/extension_packages.rs:12://! - `<config_base>/exports/<id>-<timestamp>.zip`（导出产物）
src-tauri/src/extension_packages.rs:21:use crate::config::config_base;
src-tauri/src/extension_packages.rs:754:    let base = config_base(&app);
src-tauri/src/extension_packages.rs:768:    let base = config_base(&app);
src-tauri/src/extension_packages.rs:783:    let base = config_base(&app);
src-tauri/src/extension_packages.rs:796:    let base = config_base(&app);
src-tauri/src/extension_packages.rs:807:    let base = config_base(&app);
src-tauri/src/extension_packages.rs:845:    let base = config_base(&app);
src-tauri/src/extension_packages.rs:856:    let base = config_base(&app);
271-const SNAPSHOT_PREFIX: &str = "settings-";
272-const SNAPSHOT_LIMIT: usize = 10;
273-
274:fn defaults_path(base: &Path) -> PathBuf {
275-    base.join("defaults").join(DEFAULTS_FILE)
276-}
277-
278:fn user_path(base: &Path) -> PathBuf {
279-    base.join("user").join(USER_FILE)
280-}
281-
282:fn state_path(base: &Path) -> PathBuf {
283-    base.join("state").join(STATE_FILE)
284-}
285-
--
383-    }
384-}
385-
386:fn ensure_defaults(base: &Path) -> Result<(), AppError> {
387-    let path = defaults_path(base);
388-    if path.exists() {
389-        return Ok(());
--
420-    }))
421-}
422-
423:fn effective_config(
424-    defaults: Value,
425-    user: Option<Value>,
426-    state: Option<Value>,

exec
/bin/zsh -c "nl -ba docs/research/technical/data-fileization-omarchy-inventory.md | sed -n '1,160p'
nl -ba docs/research/technical/plugin-management-benchmark.md | sed -n '80,145p'
nl -ba docs/design/approved/layout-portal/spec.md | sed -n '185,235p'" in /Users/mason/ToHighs/clairis-wt-design-plan
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
    80	
    81	## 三、Clairis 现状与定位
    82	
    83	- **无面向用户的插件系统**。代码中 `plugin/extension` 全部是编辑器内部实现（CM6 extensions、slash 菜单、marked math extension）。
    84	- **最接近"插件"的既有机制**是 mdpkg（Markdown 打包格式）：`manifest.extensions.symbols`（`off|core|extended`）与 `extensions_required`（封闭 schema，不支持项报错 E702）——这是**文档级**的能力声明，不是应用级插件。
    85	- 产品信条（`docs/product/principles.md`）："用最少干扰达成用户所愿"、键盘优先 ≥80%、无边栏零弹窗。**大而全的插件管理 UI 与信条冲突**。
    86	- Omarchy 映射报告（ticket #21）已给出关键判断：**"扩展点 = 数据文件，先做约定式数据，再做插件 API"**（启示 8）+ 所有权三分（启示 3）。
    87	
    88	## 四、对 Clairis 的设计建议
    89	
    90	按 Omarchy 支柱模型组织：**omakase 默认 + 约定式扩展 + agent 可重塑**，三个来源各取所长：
    91	
    92	### 建议 1：双轨制取 Obsidian，默认体验取 Omarchy（omakase）
    93	
    94	- **内置能力 = 核心插件化**：把 Clairis 内置功能（数学渲染、代码高亮、拖拽上传…）按"核心插件"组织——统一可开关、统一生命周期，但**默认全开、藏进设置深处**（不学 Obsidian 的长开关列表，学 Omarchy 的"默认值即产品"）。
    95	- **这一步不需要插件 API**，只是内部架构收敛：每个核心能力实现 `enable()/disable()` 幂等接口。它为未来社区插件铺路（同一个生命周期约定），又立刻改善内部代码组织。
    96	
    97	### 建议 2：扩展点先做数据文件，不做代码 API（Omarchy 原则 8）
    98	
    99	第一优先级扩展点全部声明式：
   100	
   101	- **主题/排版** = 语义 token 文件（对齐 mdpkg 的 symbols 分级思路与 Omarchy 的 token 管线）
   102	- **slash 命令片段 / 快速捕获模板** = `~/.clairis/snippets/`、`~/.clairis/templates/` 目录约定
   103	- **AI 技能/提示词** = markdown 文件目录（对齐 pi 的 skills 模型）
   104	
   105	数据文件天然满足：无执行风险、可 git、可被 agent 直接读写生成、卸载即删文件（时间可组合性退化版）。
   106	
   107	### 建议 3：若做代码级插件，取 Pi 形态 + Obsidian 安全门
   108	
   109	- 形态：TS 模块 + `manifest.json`（封闭 schema：`id/name/version/minAppVersion`），目录 `~/.clairis/plugins/<id>/`；生命周期 `onload()/onunload()`，注册项统一 tracked、卸载自动清理（学 Cordis 的 effect 追踪思想，不必引框架）。
   110	- 安全：**默认关闭第三方插件**（Restricted Mode 等价物）+ 目录级信任确认；远期分发再考虑审核，现阶段不做市场。
   111	- 与 Clairis 信条的衔接：插件管理入口放设置深处，无常驻 UI，零弹窗。
   112	
   113	### 建议 4：升级永不毁用户数据 = 结构性目录三分
   114	
   115	采纳 Omarchy 启示 3：
   116	
   117	```
   118	<app resources>/        内置默认（升级可整体覆盖）
   119	~/.config/clairis/      用户覆盖层（升级永不碰；snippets/templates/plugins 皆在此）
   120	~/Library/Application Support/clairis/  运行时生成态（缓存/索引）
   121	```
   122	
   123	### 分阶段路线
   124	
   125	| 阶段 | 内容 | 对标 |
   126	|---|---|---|
   127	| P0（无 API） | 核心能力插件化（统一 enable/disable）+ 数据文件扩展点（snippets/templates/主题 token）| Omarchy |
   128	| P1 | manifest + onload/onunload + 信任门，支持本地目录安装 | Pi 形态 + Obsidian 安全 |
   129	| P2 | 分发（git/npm 协议）、社区目录、自动扫描 | Obsidian / Pi packages |
   130	
   131	**一句话结论**：Clairis 不需要"插件市场"式的管理界面，需要的是**Omarchy 式的数据文件扩展点 + Obsidian 式的双轨与安全门 + Cordis 式的卸载回滚纪律**——先让"放一个文件到某个目录"成为唯一的插件形态，等真实需求出现再上代码级 API。
   185	| 快捷浮层 | `⌘K` 单发指令（非模态底部） |
   186	| 选区动作 | 选中正文 → 浮动胶囊（AI 改写 / 翻译 / 润色）→ 前后 diff → 应用 |
   187	| 确认卡 | **人话描述**（禁技术语言）；三档密度：每次必弹 / **本会话总是后静默（默认）** / 不弹只靠撤销 |
   188	| 可逆 | 撤销条（3s 淡出、hover 重现）+ 快照（最近 10 份） |
   189	| 视图改写 | 可改：布局/密度/卡片高度/区块颜色/图标内外显隐/预览开关/面板宽窄；预设 6 条：按主题分组 / 只留置顶和最近 / 置顶段放大 / 网格改列表 / 网格按类型分组 / 加未读筛选 |
   190	| 语音 | 第二输入源；每个输入面挂麦克风；正文三件套（状态栏连续听写 / `⌘⇧Space` PTT / 选区替换）；草稿=浅灰斜体 decoration（不落盘），停止=普通事务（可撤销）；ASR 引擎留待定 |
   191	
   192	---
   193	
   194	## 8. 设置
   195	
   196	左导航 10 区：**外观** · 编辑器 · 阅读空间 · 网格概览 · 悬浮预览 · AI 服务 · 扩展 · 快捷键 · 数据与备份 · 关于
   197	
   198	- 外观：主题（浅/深/暖）· 字号 · **跟随系统外观（默认开；含 omarchy 主题联动说明）**
   199	- 悬浮预览：阅读空间悬停开关 · 网格预览模式（悬停/点击/关闭）
   200	- AI 服务：DeepSeek / 通义 / Kimi / GLM / **WorkBuddy(codebuddy)** / **OpenCode** / **Pi** / 自定义；本地 LLM 与多 agent 标「规划中」；key 存 keychain
   201	- 快捷键：核心 7 条 + 「查看完整列表」
   202	- 扩展：见 §9
   203	
   204	---
   205	
   206	## 9. 扩展
   207	
   208	- **形态**：文件夹（`manifest.json` + `SKILL.md`），可打包传播
   209	- **导入**：拖入文件夹 / .zip 或点击选择 → **即启用**（无安装步骤）
   210	- **管理**：列表（名称 / 来源徽章 内置|AI 生成 / 启用开关 / 打开文件夹 / 卸载）
   211	- **导出/分享**：把自定义扩展打包
   212	- **AI 生成**：输入「说出你要的功能」→ 生成中 → 新扩展卡（默认启用）+ SKILL.md 预览
   213	
   214	---
   215	
   216	## 10. 图标体系
   217	
   218	- **源**：universe-icon（24×24 viewBox、`fill="currentColor"`、18（密集）/24（主操作）px）
   219	- **哲学**：一概念一图标；同概念全产品同图标；不混风格；**禁 emoji**
   220	- **标签三级**（设置）：自动（主入口图标+文字，重复处仅图标）/ 始终显示文字 / 仅图标
   221	- **类型色（8 类）**：Markdown `#6366f1` · HTML `#f59e0b` · 文本 `#64748b` · PDF `#ef4444` · 视频 `#a855f7` · 图片 `#10b981` · 代码 `#06b6d4` · 音频 `#ec4899`
   222	- **图标抽屉**：设置内可查看全部在用图标（名称/尺寸/已有-新绘）
   223	
   224	---
   225	
   226	## 11. 快捷键（定稿表）
   227	
   228	**全局**
   229	| 键 | 行为 |
   230	|---|---|
   231	| `⌘P` | 统一检索（文件 + AI 指令） |
   232	| `⌘\` | 阅读空间展开/收起 |
   233	| `⌘⇧\` | 网格概览 |
   234	| `⌘K` | AI 快捷浮层 |
   235	| `⌘⇧A` | AI 小窗（⇄ 停靠窗格） |

exec
/bin/zsh -c "nl -ba src-tauri/src/ai_agent.rs | sed -n '100,185p;200,330p;330,470p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
   100	        }
   101	    }
   102	}
   103	
   104	// ── 消息与补全 ──────────────────────────────────────────────
   105	
   106	#[derive(Debug, Clone, Serialize, Deserialize)]
   107	pub struct Message {
   108	    pub role: String,
   109	    #[serde(skip_serializing_if = "Option::is_none")]
   110	    pub content: Option<String>,
   111	    #[serde(skip_serializing_if = "Option::is_none")]
   112	    pub tool_calls: Option<Vec<ToolCall>>,
   113	    #[serde(skip_serializing_if = "Option::is_none")]
   114	    pub tool_call_id: Option<String>,
   115	}
   116	
   117	impl Message {
   118	    pub fn user(content: impl Into<String>) -> Self {
   119	        Self {
   120	            role: "user".into(),
   121	            content: Some(content.into()),
   122	            tool_calls: None,
   123	            tool_call_id: None,
   124	        }
   125	    }
   126	
   127	    pub fn system(content: impl Into<String>) -> Self {
   128	        Self {
   129	            role: "system".into(),
   130	            content: Some(content.into()),
   131	            tool_calls: None,
   132	            tool_call_id: None,
   133	        }
   134	    }
   135	
   136	    pub fn assistant(content: Option<String>, tool_calls: Vec<ToolCall>) -> Self {
   137	        Self {
   138	            role: "assistant".into(),
   139	            content,
   140	            tool_calls: if tool_calls.is_empty() {
   141	                None
   142	            } else {
   143	                Some(tool_calls)
   144	            },
   145	            tool_call_id: None,
   146	        }
   147	    }
   148	
   149	    pub fn tool_result(tool_call_id: impl Into<String>, content: impl Into<String>) -> Self {
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
   291	    run_loop_with_limit(completer, base, messages, MAX_TURNS).await
   292	}
   293	
   294	pub async fn run_loop_with_limit(
   295	    completer: &dyn Completer,
   296	    base: &Path,
   297	    mut messages: Vec<Message>,
   298	    max_turns: usize,
   299	) -> Result<AgentReply, AgentError> {
   300	    let tools = tool_schemas();
   301	    let mut executed: Vec<String> = Vec::new();
   302	    let mut last_error: Option<(String, usize)> = None;
   303	
   304	    for turn in 0..max_turns {
   305	        let response = completer
   306	            .complete(CompletionRequest {
   307	                messages: messages.clone(),
   308	                tools: tools.clone(),
   309	            })
   310	            .await?;
   311	
   312	        if response.tool_calls.is_empty() {
   313	            return Ok(AgentReply {
   314	                text: response.content.unwrap_or_default(),
   315	                turns: turn + 1,
   316	                tool_calls: executed,
   317	            });
   318	        }
   319	
   320	        messages.push(Message::assistant(
   321	            response.content,
   322	            response.tool_calls.clone(),
   323	        ));
   324	
   325	        for call in &response.tool_calls {
   326	            let result = dispatch_tool(base, &call.name, &call.arguments)?;
   327	            executed.push(call.name.clone());
   328	
   329	            let failed = result.contains("\"ok\":false");
   330	            if failed {
   330	            if failed {
   331	                let count = match &last_error {
   332	                    Some((prev, n)) if prev == &result => n + 1,
   333	                    _ => 1,
   334	                };
   335	                if count >= MAX_REPEATED_TOOL_ERRORS {
   336	                    return Err(AgentError::tool(
   337	                        call.name.clone(),
   338	                        format!("连续 {count} 次相同错误，终止: {result}"),
   339	                    ));
   340	                }
   341	                last_error = Some((result.clone(), count));
   342	            } else {
   343	                last_error = None;
   344	            }
   345	
   346	            messages.push(Message::tool_result(call.id.clone(), result));
   347	        }
   348	    }
   349	
   350	    Err(AgentError::TurnLimit { turns: max_turns })
   351	}
   352	
   353	// ── 真实 provider ───────────────────────────────────────────
   354	
   355	pub struct OpenAiCompleter {
   356	    client: reqwest::Client,
   357	    endpoint: String,
   358	    model: String,
   359	    api_key: String,
   360	}
   361	
   362	impl OpenAiCompleter {
   363	    pub fn new(
   364	        endpoint: impl Into<String>,
   365	        model: impl Into<String>,
   366	        api_key: impl Into<String>,
   367	    ) -> Self {
   368	        Self {
   369	            client: reqwest::Client::new(),
   370	            endpoint: endpoint.into(),
   371	            model: model.into(),
   372	            api_key: api_key.into(),
   373	        }
   374	    }
   375	}
   376	
   377	/// 把 provider 的 base endpoint 拼成 chat completions URL。
   378	/// base 已带版本段（`/v1`、`/v4`…）时只补 `/chat/completions`，否则补 `/v1/chat/completions`。
   379	pub fn completions_url(endpoint: &str) -> String {
   380	    let base = endpoint.trim_end_matches('/');
   381	    let has_version = base.rsplit('/').next().is_some_and(|seg| {
   382	        seg.len() >= 2 && seg.starts_with('v') && seg[1..].chars().all(|c| c.is_ascii_digit())
   383	    });
   384	    if has_version {
   385	        format!("{base}/chat/completions")
   386	    } else {
   387	        format!("{base}/v1/chat/completions")
   388	    }
   389	}
   390	
   391	fn parse_tool_call(raw: &Value) -> Option<ToolCall> {
   392	    let function = raw.get("function")?;
   393	    let name = function.get("name")?.as_str()?.to_string();
   394	    let id = raw
   395	        .get("id")
   396	        .and_then(|v| v.as_str())
   397	        .map(str::to_string)
   398	        .unwrap_or_else(|| format!("call_{name}"));
   399	    let arguments = match function.get("arguments") {
   400	        Some(Value::String(s)) if !s.trim().is_empty() => {
   401	            serde_json::from_str(s).unwrap_or(Value::Null)
   402	        }
   403	        Some(value) => value.clone(),
   404	        None => Value::Null,
   405	    };
   406	    Some(ToolCall {
   407	        id,
   408	        name,
   409	        arguments,
   410	    })
   411	}
   412	
   413	impl Completer for OpenAiCompleter {
   414	    fn complete<'a>(&'a self, req: CompletionRequest) -> CompletionFuture<'a> {
   415	        Box::pin(async move {
   416	            let url = completions_url(&self.endpoint);
   417	            let body = json!({
   418	                "model": self.model,
   419	                "stream": false,
   420	                "messages": req.messages,
   421	                "tools": req.tools,
   422	                "tool_choice": "auto",
   423	            });
   424	
   425	            let response = self
   426	                .client
   427	                .post(&url)
   428	                .header("Authorization", format!("Bearer {}", self.api_key))
   429	                .json(&body)
   430	                .send()
   431	                .await
   432	                .map_err(|e| AgentError::Provider {
   433	                    status: 0,
   434	                    body: e.to_string(),
   435	                })?;
   436	
   437	            let status = response.status().as_u16();
   438	            let text = response.text().await.map_err(|e| AgentError::Provider {
   439	                status,
   440	                body: e.to_string(),
   441	            })?;
   442	            if !(200..300).contains(&status) {
   443	                return Err(AgentError::Provider { status, body: text });
   444	            }
   445	
   446	            let parsed: Value = serde_json::from_str(&text).map_err(|e| AgentError::Provider {
   447	                status,
   448	                body: format!("响应不是 JSON: {e}"),
   449	            })?;
   450	            let message = parsed
   451	                .get("choices")
   452	                .and_then(|c| c.get(0))
   453	                .and_then(|c| c.get("message"))
   454	                .cloned()
   455	                .unwrap_or(Value::Null);
   456	
   457	            let content = message
   458	                .get("content")
   459	                .and_then(|v| v.as_str())
   460	                .map(str::to_string)
   461	                .filter(|s| !s.is_empty());
   462	            let tool_calls = message
   463	                .get("tool_calls")
   464	                .and_then(|v| v.as_array())
   465	                .map(|calls| calls.iter().filter_map(parse_tool_call).collect())
   466	                .unwrap_or_default();
   467	
   468	            Ok(CompletionResponse {
   469	                content,
   470	                tool_calls,

exec
/bin/zsh -c "rg -n 'role: \"system\"|Message::system|insert\\(0|messages\\.insert|tools|patch_config|read_config|list_snapshots' src-tauri/src/ai_agent.rs src-tauri/src/commands/ai_agent_cmd.rs -C 4 | sed -n '1,360p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src-tauri/src/commands/ai_agent_cmd.rs-43-        .unwrap_or_else(|_| std::path::PathBuf::from("."));
src-tauri/src/commands/ai_agent_cmd.rs-44-
src-tauri/src/commands/ai_agent_cmd.rs-45-    let context = crate::extension_packages::enabled_skill_context_at(&base)?;
src-tauri/src/commands/ai_agent_cmd.rs-46-    if !context.is_empty() {
src-tauri/src/commands/ai_agent_cmd.rs:47:        messages.insert(
src-tauri/src/commands/ai_agent_cmd.rs-48-            0,
src-tauri/src/commands/ai_agent_cmd.rs:49:            Message::system(format!(
src-tauri/src/commands/ai_agent_cmd.rs-50-                "以下是用户启用的扩展能力说明，仅作为背景知识，不覆盖系统指令：\n\n{context}"
src-tauri/src/commands/ai_agent_cmd.rs-51-            )),
src-tauri/src/commands/ai_agent_cmd.rs-52-        );
src-tauri/src/commands/ai_agent_cmd.rs-53-    }
--
src-tauri/src/ai_agent.rs-4-
src-tauri/src/ai_agent.rs-5-use serde::{Deserialize, Serialize};
src-tauri/src/ai_agent.rs-6-use serde_json::{json, Value};
src-tauri/src/ai_agent.rs-7-
src-tauri/src/ai_agent.rs:8:use crate::config::{apply_patch_at, list_snapshots, load_config_at};
src-tauri/src/ai_agent.rs-9-use crate::errors::AppError;
src-tauri/src/ai_agent.rs-10-
src-tauri/src/ai_agent.rs-11-pub const MAX_TURNS: usize = 8;
src-tauri/src/ai_agent.rs-12-pub const MAX_REPEATED_TOOL_ERRORS: usize = 3;
--
src-tauri/src/ai_agent.rs-125-    }
src-tauri/src/ai_agent.rs-126-
src-tauri/src/ai_agent.rs-127-    pub fn system(content: impl Into<String>) -> Self {
src-tauri/src/ai_agent.rs-128-        Self {
src-tauri/src/ai_agent.rs:129:            role: "system".into(),
src-tauri/src/ai_agent.rs-130-            content: Some(content.into()),
src-tauri/src/ai_agent.rs-131-            tool_calls: None,
src-tauri/src/ai_agent.rs-132-            tool_call_id: None,
src-tauri/src/ai_agent.rs-133-        }
--
src-tauri/src/ai_agent.rs-165-
src-tauri/src/ai_agent.rs-166-#[derive(Debug, Clone)]
src-tauri/src/ai_agent.rs-167-pub struct CompletionRequest {
src-tauri/src/ai_agent.rs-168-    pub messages: Vec<Message>,
src-tauri/src/ai_agent.rs:169:    pub tools: Vec<Value>,
src-tauri/src/ai_agent.rs-170-}
src-tauri/src/ai_agent.rs-171-
src-tauri/src/ai_agent.rs-172-#[derive(Debug, Clone, Default)]
src-tauri/src/ai_agent.rs-173-pub struct CompletionResponse {
--
src-tauri/src/ai_agent.rs-188-    vec![
src-tauri/src/ai_agent.rs-189-        json!({
src-tauri/src/ai_agent.rs-190-            "type": "function",
src-tauri/src/ai_agent.rs-191-            "function": {
src-tauri/src/ai_agent.rs:192:                "name": "read_config",
src-tauri/src/ai_agent.rs-193-                "description": "读取当前生效的应用配置（defaults + user + state 合并后的结果）。",
src-tauri/src/ai_agent.rs-194-                "parameters": { "type": "object", "properties": {}, "additionalProperties": false }
src-tauri/src/ai_agent.rs-195-            }
src-tauri/src/ai_agent.rs-196-        }),
src-tauri/src/ai_agent.rs-197-        json!({
src-tauri/src/ai_agent.rs-198-            "type": "function",
src-tauri/src/ai_agent.rs-199-            "function": {
src-tauri/src/ai_agent.rs:200:                "name": "patch_config",
src-tauri/src/ai_agent.rs-201-                "description": "把 JSON 合并补丁写入 user 层配置。写入前会校验并生成快照，非法值不会落盘。",
src-tauri/src/ai_agent.rs-202-                "parameters": {
src-tauri/src/ai_agent.rs-203-                    "type": "object",
src-tauri/src/ai_agent.rs-204-                    "properties": {
--
src-tauri/src/ai_agent.rs-214-        }),
src-tauri/src/ai_agent.rs-215-        json!({
src-tauri/src/ai_agent.rs-216-            "type": "function",
src-tauri/src/ai_agent.rs-217-            "function": {
src-tauri/src/ai_agent.rs:218:                "name": "list_snapshots",
src-tauri/src/ai_agent.rs-219-                "description": "列出配置快照文件名，按时间升序（最旧在前）。",
src-tauri/src/ai_agent.rs-220-                "parameters": { "type": "object", "properties": {}, "additionalProperties": false }
src-tauri/src/ai_agent.rs-221-            }
src-tauri/src/ai_agent.rs-222-        }),
--
src-tauri/src/ai_agent.rs-234-/// 执行一个工具调用。任何失败都转成结构化 JSON 字符串（`{ok:false,error}`），
src-tauri/src/ai_agent.rs-235-/// 由循环回灌给模型；只有 `AgentError` 之外的意外才向上冒泡。
src-tauri/src/ai_agent.rs-236-pub fn dispatch_tool(base: &Path, name: &str, args: &Value) -> Result<String, AgentError> {
src-tauri/src/ai_agent.rs-237-    match name {
src-tauri/src/ai_agent.rs:238:        "read_config" => match load_config_at(base) {
src-tauri/src/ai_agent.rs-239-            Ok(config) => {
src-tauri/src/ai_agent.rs-240-                let value = serde_json::to_value(&config).map_err(|e| AgentError::Io {
src-tauri/src/ai_agent.rs:241:                    context: "read_config".into(),
src-tauri/src/ai_agent.rs-242-                    message: e.to_string(),
src-tauri/src/ai_agent.rs-243-                })?;
src-tauri/src/ai_agent.rs-244-                Ok(tool_ok(value))
src-tauri/src/ai_agent.rs-245-            }
src-tauri/src/ai_agent.rs-246-            Err(e) => Ok(tool_err(&AgentError::from_app(name, e))),
src-tauri/src/ai_agent.rs-247-        },
src-tauri/src/ai_agent.rs:248:        "patch_config" => {
src-tauri/src/ai_agent.rs-249-            let Some(patch) = args.get("patch") else {
src-tauri/src/ai_agent.rs-250-                return Ok(tool_err(&AgentError::validation(
src-tauri/src/ai_agent.rs-251-                    "patch",
src-tauri/src/ai_agent.rs-252-                    "缺少 patch 参数",
--
src-tauri/src/ai_agent.rs-254-            };
src-tauri/src/ai_agent.rs-255-            match apply_patch_at(base, patch) {
src-tauri/src/ai_agent.rs-256-                Ok(config) => {
src-tauri/src/ai_agent.rs-257-                    let value = serde_json::to_value(&config).map_err(|e| AgentError::Io {
src-tauri/src/ai_agent.rs:258:                        context: "patch_config".into(),
src-tauri/src/ai_agent.rs-259-                        message: e.to_string(),
src-tauri/src/ai_agent.rs-260-                    })?;
src-tauri/src/ai_agent.rs-261-                    Ok(tool_ok(value))
src-tauri/src/ai_agent.rs-262-                }
src-tauri/src/ai_agent.rs-263-                Err(e) => Ok(tool_err(&AgentError::from_app(name, e))),
src-tauri/src/ai_agent.rs-264-            }
src-tauri/src/ai_agent.rs-265-        }
src-tauri/src/ai_agent.rs:266:        "list_snapshots" => match list_snapshots(base) {
src-tauri/src/ai_agent.rs-267-            Ok(names) => Ok(tool_ok(json!(names))),
src-tauri/src/ai_agent.rs-268-            Err(e) => Ok(tool_err(&AgentError::from_app(name, e))),
src-tauri/src/ai_agent.rs-269-        },
src-tauri/src/ai_agent.rs-270-        other => Ok(tool_err(&AgentError::tool(
--
src-tauri/src/ai_agent.rs-296-    base: &Path,
src-tauri/src/ai_agent.rs-297-    mut messages: Vec<Message>,
src-tauri/src/ai_agent.rs-298-    max_turns: usize,
src-tauri/src/ai_agent.rs-299-) -> Result<AgentReply, AgentError> {
src-tauri/src/ai_agent.rs:300:    let tools = tool_schemas();
src-tauri/src/ai_agent.rs-301-    let mut executed: Vec<String> = Vec::new();
src-tauri/src/ai_agent.rs-302-    let mut last_error: Option<(String, usize)> = None;
src-tauri/src/ai_agent.rs-303-
src-tauri/src/ai_agent.rs-304-    for turn in 0..max_turns {
src-tauri/src/ai_agent.rs-305-        let response = completer
src-tauri/src/ai_agent.rs-306-            .complete(CompletionRequest {
src-tauri/src/ai_agent.rs-307-                messages: messages.clone(),
src-tauri/src/ai_agent.rs:308:                tools: tools.clone(),
src-tauri/src/ai_agent.rs-309-            })
src-tauri/src/ai_agent.rs-310-            .await?;
src-tauri/src/ai_agent.rs-311-
src-tauri/src/ai_agent.rs-312-        if response.tool_calls.is_empty() {
--
src-tauri/src/ai_agent.rs-417-            let body = json!({
src-tauri/src/ai_agent.rs-418-                "model": self.model,
src-tauri/src/ai_agent.rs-419-                "stream": false,
src-tauri/src/ai_agent.rs-420-                "messages": req.messages,
src-tauri/src/ai_agent.rs:421:                "tools": req.tools,
src-tauri/src/ai_agent.rs-422-                "tool_choice": "auto",
src-tauri/src/ai_agent.rs-423-            });
src-tauri/src/ai_agent.rs-424-
src-tauri/src/ai_agent.rs-425-            let response = self
--
src-tauri/src/ai_agent.rs-558-    async fn two_turn_loop_runs_tool_then_returns_text() {
src-tauri/src/ai_agent.rs-559-        let dir = temp_base("two_turn");
src-tauri/src/ai_agent.rs-560-        let base = dir.path();
src-tauri/src/ai_agent.rs-561-        let completer = ScriptedCompleter::new(vec![
src-tauri/src/ai_agent.rs:562:            tool_call("c1", "read_config", json!({})),
src-tauri/src/ai_agent.rs-563-            text("当前主题是 system"),
src-tauri/src/ai_agent.rs-564-        ]);
src-tauri/src/ai_agent.rs-565-
src-tauri/src/ai_agent.rs-566-        let reply = run_loop(&completer, base, vec![Message::user("配置是什么？")])
--
src-tauri/src/ai_agent.rs-568-            .unwrap();
src-tauri/src/ai_agent.rs-569-
src-tauri/src/ai_agent.rs-570-        assert_eq!(reply.text, "当前主题是 system");
src-tauri/src/ai_agent.rs-571-        assert_eq!(reply.turns, 2);
src-tauri/src/ai_agent.rs:572:        assert_eq!(reply.tool_calls, vec!["read_config".to_string()]);
src-tauri/src/ai_agent.rs-573-
src-tauri/src/ai_agent.rs-574-        let messages = completer.last_messages();
src-tauri/src/ai_agent.rs-575-        let tool_msg = messages
src-tauri/src/ai_agent.rs-576-            .iter()
--
src-tauri/src/ai_agent.rs-586-    async fn loop_stops_at_turn_limit() {
src-tauri/src/ai_agent.rs-587-        let dir = temp_base("limit");
src-tauri/src/ai_agent.rs-588-        let base = dir.path();
src-tauri/src/ai_agent.rs-589-        let responses = (0..MAX_TURNS)
src-tauri/src/ai_agent.rs:590:            .map(|i| tool_call(&format!("c{i}"), "list_snapshots", json!({})))
src-tauri/src/ai_agent.rs-591-            .collect();
src-tauri/src/ai_agent.rs-592-        let completer = ScriptedCompleter::new(responses);
src-tauri/src/ai_agent.rs-593-
src-tauri/src/ai_agent.rs-594-        let err = run_loop(&completer, base, vec![Message::user("循环")])
--
src-tauri/src/ai_agent.rs-612-
src-tauri/src/ai_agent.rs-613-        let completer = ScriptedCompleter::new(vec![
src-tauri/src/ai_agent.rs-614-            tool_call(
src-tauri/src/ai_agent.rs-615-                "c1",
src-tauri/src/ai_agent.rs:616:                "patch_config",
src-tauri/src/ai_agent.rs-617-                json!({ "patch": { "fontSize": 200 } }),
src-tauri/src/ai_agent.rs-618-            ),
src-tauri/src/ai_agent.rs-619-            text("改不了"),
src-tauri/src/ai_agent.rs-620-        ]);
--
src-tauri/src/ai_agent.rs-643-
src-tauri/src/ai_agent.rs-644-        let completer = ScriptedCompleter::new(vec![
src-tauri/src/ai_agent.rs-645-            tool_call(
src-tauri/src/ai_agent.rs-646-                "c1",
src-tauri/src/ai_agent.rs:647:                "patch_config",
src-tauri/src/ai_agent.rs-648-                json!({ "patch": { "theme": "dark" } }),
src-tauri/src/ai_agent.rs-649-            ),
src-tauri/src/ai_agent.rs:650:            tool_call("c2", "list_snapshots", json!({})),
src-tauri/src/ai_agent.rs-651-            text("已改为深色"),
src-tauri/src/ai_agent.rs-652-        ]);
src-tauri/src/ai_agent.rs-653-        let reply = run_loop(&completer, base, vec![Message::user("切深色")])
src-tauri/src/ai_agent.rs-654-            .await
--
src-tauri/src/ai_agent.rs-657-        assert_eq!(reply.text, "已改为深色");
src-tauri/src/ai_agent.rs-658-        assert!(read_user(base).contains("\"dark\""), "{}", read_user(base));
src-tauri/src/ai_agent.rs-659-        assert_eq!(load_config_at(base).unwrap().theme.as_deref(), Some("dark"));
src-tauri/src/ai_agent.rs-660-
src-tauri/src/ai_agent.rs:661:        let snapshots = list_snapshots(base).unwrap();
src-tauri/src/ai_agent.rs-662-        assert_eq!(snapshots.len(), 1, "写入前应产生一份快照: {snapshots:?}");
src-tauri/src/ai_agent.rs-663-        let snapshot = std::fs::read_to_string(base.join("snapshots").join(&snapshots[0])).unwrap();
src-tauri/src/ai_agent.rs-664-        assert!(snapshot.contains("\"light\""), "快照应是旧值: {snapshot}");
src-tauri/src/ai_agent.rs-665-
--
src-tauri/src/ai_agent.rs-673-        assert!(tool_msgs[1].contains(&snapshots[0]), "got {}", tool_msgs[1]);
src-tauri/src/ai_agent.rs-674-    }
src-tauri/src/ai_agent.rs-675-
src-tauri/src/ai_agent.rs-676-    #[test]
src-tauri/src/ai_agent.rs:677:    fn read_config_matches_effective_config() {
src-tauri/src/ai_agent.rs-678-        let dir = temp_base("read");
src-tauri/src/ai_agent.rs-679-        let base = dir.path();
src-tauri/src/ai_agent.rs-680-        std::fs::create_dir_all(user_path(base).parent().unwrap()).unwrap();
src-tauri/src/ai_agent.rs-681-        std::fs::write(user_path(base), r#"{"theme":"warm","fontSize":19.0}"#).unwrap();
src-tauri/src/ai_agent.rs-682-
src-tauri/src/ai_agent.rs:683:        let raw = dispatch_tool(base, "read_config", &json!({})).unwrap();
src-tauri/src/ai_agent.rs-684-        let parsed: Value = serde_json::from_str(&raw).unwrap();
src-tauri/src/ai_agent.rs-685-        let expected = serde_json::to_value(load_config_at(base).unwrap()).unwrap();
src-tauri/src/ai_agent.rs-686-
src-tauri/src/ai_agent.rs-687-        assert_eq!(parsed["ok"], json!(true));
--
src-tauri/src/ai_agent.rs-699-        assert_eq!(parsed["error"]["kind"], json!("tool"));
src-tauri/src/ai_agent.rs-700-    }
src-tauri/src/ai_agent.rs-701-
src-tauri/src/ai_agent.rs-702-    #[test]
src-tauri/src/ai_agent.rs:703:    fn tool_schemas_cover_three_tools() {
src-tauri/src/ai_agent.rs-704-        let names: Vec<String> = tool_schemas()
src-tauri/src/ai_agent.rs-705-            .iter()
src-tauri/src/ai_agent.rs-706-            .map(|s| s["function"]["name"].as_str().unwrap().to_string())
src-tauri/src/ai_agent.rs-707-            .collect();
src-tauri/src/ai_agent.rs:708:        assert_eq!(names, vec!["read_config", "patch_config", "list_snapshots"]);
src-tauri/src/ai_agent.rs-709-    }
src-tauri/src/ai_agent.rs-710-
src-tauri/src/ai_agent.rs-711-    #[tokio::test]
src-tauri/src/ai_agent.rs-712-    async fn openai_completer_uses_configured_endpoint_and_bearer() {
--
src-tauri/src/ai_agent.rs-740-        let completer = OpenAiCompleter::new(format!("http://{addr}"), "test-model", "sk-test");
src-tauri/src/ai_agent.rs-741-        let response = completer
src-tauri/src/ai_agent.rs-742-            .complete(CompletionRequest {
src-tauri/src/ai_agent.rs-743-                messages: vec![Message::user("hi")],
src-tauri/src/ai_agent.rs:744:                tools: vec![],
src-tauri/src/ai_agent.rs-745-            })
src-tauri/src/ai_agent.rs-746-            .await
src-tauri/src/ai_agent.rs-747-            .unwrap();
src-tauri/src/ai_agent.rs-748-        server.join().unwrap();

exec
/bin/zsh -c "rg -n 'maximum|size|limit|MAX_|read_to_string|metadata' src-tauri/src/extension_packages.rs | sed -n '1,220p'
rg -n 'SKILL|skill' docs/design/approved/layout-portal -g '*.md' | sed -n '1,200p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
30:const MAX_ZIP_ENTRIES: usize = 2000;
32:const MAX_ZIP_TOTAL_BYTES: u64 = 64 * 1024 * 1024;
34:const MAX_ZIP_FILE_BYTES: u64 = 16 * 1024 * 1024;
145:    let raw = std::fs::read_to_string(&manifest_path)
154:    let skill = std::fs::read_to_string(&skill_path)
288:    let meta = std::fs::metadata(&src).map_err(|e| io(&format!("import source {path}"), e))?;
453:    if entry_count > MAX_ZIP_ENTRIES {
456:            format!("zip 条目数 {entry_count} 超过上限 {MAX_ZIP_ENTRIES}",),
483:        let declared = entry.size();
484:        if declared > MAX_ZIP_FILE_BYTES {
488:                    "zip 条目 {raw_name} 声明大小 {declared} 超过单文件上限 {MAX_ZIP_FILE_BYTES}",
493:        if new_total > MAX_ZIP_TOTAL_BYTES {
496:                format!("zip 解压总字节 {new_total} 超过上限 {MAX_ZIP_TOTAL_BYTES}"),
506:        let room = MAX_ZIP_FILE_BYTES.min(MAX_ZIP_TOTAL_BYTES - total_bytes);
1014:        let skill_before = std::fs::read_to_string(installed.join(SKILL_FILE)).unwrap();
1015:        let manifest_before = std::fs::read_to_string(installed.join(MANIFEST_FILE)).unwrap();
1024:            std::fs::read_to_string(installed.join(SKILL_FILE)).unwrap(),
1028:            std::fs::read_to_string(installed.join(MANIFEST_FILE)).unwrap(),
1038:        let manifest_before = std::fs::read_to_string(installed.join(MANIFEST_FILE)).unwrap();
1039:        let skill_before = std::fs::read_to_string(installed.join(SKILL_FILE)).unwrap();
1062:            std::fs::read_to_string(installed.join(MANIFEST_FILE)).unwrap(),
1066:            std::fs::read_to_string(installed.join(SKILL_FILE)).unwrap(),
1284:    fn zip_entry_count_over_limit_is_rejected() {
1292:        for i in 0..(MAX_ZIP_ENTRIES + 1) {
1304:    fn zip_file_size_over_limit_is_rejected() {
1313:        zip.write_all(&vec![0u8; (MAX_ZIP_FILE_BYTES + 1) as usize])
docs/design/approved/layout-portal/spec.md:208:- **形态**：文件夹（`manifest.json` + `SKILL.md`），可打包传播
docs/design/approved/layout-portal/spec.md:212:- **AI 生成**：输入「说出你要的功能」→ 生成中 → 新扩展卡（默认启用）+ SKILL.md 预览

exec
/bin/zsh -c "git log -1 --format='%H%n%ad%n%s' --date=iso-strict -- docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md 2>/dev/null || true
stat -f '%Sm %N' -t '%Y-%m-%dT%H:%M:%S%z' docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
2026-11-17T06:38:27+0800 docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md

exec
/bin/zsh -c "nl -ba src/editors/editorRef.ts | sed -n '1,180p'
rg -n 'editorMode|setEditorMode|mode.*preview|mode.*edit|mode.*source' src/stores src/components src/App.tsx -g '*.ts' -g '*.tsx' | sed -n '1,180p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
     1	import type { EditorView } from "@codemirror/view";
     2	
     3	/**
     4	 * Map of panel ID → EditorView instance.
     5	 * Panel "main" is the primary panel. Split panels get their own IDs.
     6	 */
     7	const editorViews = new Map<string, EditorView>();
     8	let lastActivePanel: string | null = null;
     9	
    10	/** Map of panel ID → preview scroll container (used for scroll position capture) */
    11	const panelScrollEls = new Map<string, HTMLElement>();
    12	
    13	export function setPanelScrollEl(panelId: string, el: HTMLElement | null) {
    14	  if (el) {
    15	    panelScrollEls.set(panelId, el);
    16	  } else {
    17	    panelScrollEls.delete(panelId);
    18	  }
    19	}
    20	
    21	export function getPanelScrollEl(panelId: string): HTMLElement | null {
    22	  return panelScrollEls.get(panelId) || null;
    23	}
    24	
    25	export function setEditorView(panelId: string, view: EditorView | null) {
    26	  if (view) {
    27	    editorViews.set(panelId, view);
    28	  } else {
    29	    editorViews.delete(panelId);
    30	  }
    31	}
    32	
    33	export function getEditorView(panelId: string): EditorView | null {
    34	  return editorViews.get(panelId) || null;
    35	}
    36	
    37	/** Get the most recently focused editor. */
    38	export function getActiveEditorView(): EditorView | null {
    39	  if (lastActivePanel) {
    40	    const v = editorViews.get(lastActivePanel);
    41	    if (v) return v;
    42	  }
    43	  // Fallback to main panel
    44	  return editorViews.get("main") || null;
    45	}
    46	
    47	export function setActivePanel(panelId: string) {
    48	  lastActivePanel = panelId;
    49	}
    50	
    51	/** Legacy alias for backward compatibility. */
    52	export function setActiveEditorView(view: EditorView | null) {
    53	  if (view) {
    54	    editorViews.set("main", view);
    55	  } else {
    56	    editorViews.delete("main");
    57	  }
    58	}
src/App.tsx:349:        tab?.editorMode === "preview" &&
src/App.tsx:648:        const current = activeTab?.editorMode || "preview";
src/App.tsx:655:        store.setEditorMode(next);
src/App.tsx:665:          activeTab?.editorMode !== "preview"
src/App.tsx:685:        if (view && activeTab?.editorMode !== "preview") {
src/App.tsx:773:    activeTab?.editorMode,
src/stores/docPropertyPanel.ts:43:      if (mode !== "preview" && mode !== "edit") return;
src/stores/index.ts:296:  setEditorMode: (mode: EditorMode) => void;
src/stores/index.ts:493:            editorMode: existing.editorMode,
src/stores/index.ts:541:      editorMode: defaultEditorMode,
src/stores/index.ts:555:        editorMode: defaultEditorMode,
src/stores/index.ts:592:        editorMode: tab ? tab.editorMode : leaf.editorMode,
src/stores/index.ts:707:  setEditorMode: (mode: EditorMode) => {
src/stores/index.ts:719:        ? updateLeaf(state.paneRoot, leaf.id, { editorMode: mode })
src/stores/index.ts:725:        [activeTabId]: { ...tab, editorMode: mode },
src/stores/index.ts:815:      editorMode: "edit",
src/stores/index.ts:827:        editorMode: "edit",
src/stores/index.ts:1123:      ? { ...state.tabs, [activeTab.id]: { ...activeTab, editorMode: mode } }
src/stores/index.ts:1126:      paneRoot: updateLeaf(state.paneRoot, leafId, { editorMode: mode }),
src/stores/index.ts:1154:      editorMode: activeTab ? activeTab.editorMode : "preview",
src/stores/index.ts:1220:    const editorMode: EditorMode =
src/stores/index.ts:1221:      existing?.editorMode ??
src/stores/index.ts:1232:          editorMode,
src/stores/index.ts:1275:      editorMode,
src/stores/index.ts:1516:      editorMode: "preview",
src/stores/editorStore.ts:20:  editorMode: EditorMode;
src/stores/editorStore.ts:50:  setEditorMode: (mode: EditorMode) => void;
src/stores/editorStore.ts:75:  editorMode: "preview" as EditorMode,
src/stores/editorStore.ts:105:  setEditorMode: (mode) => set({ editorMode: mode }),
src/components/Content/PaneTreeView.tsx:200:              editorMode={node.editorMode}
src/components/Content/PaneTreeView.tsx:233:                editorMode={node.editorMode}
src/components/Content/PaneTreeView.tsx:291:  editorMode,
src/components/Content/PaneTreeView.tsx:300:  editorMode: EditorMode;
src/components/Content/PaneTreeView.tsx:537:            data-mode={editorMode}
src/components/Content/PaneTreeView.tsx:539:              editorMode === "preview"
src/components/Content/PaneTreeView.tsx:543:            aria-label={editorMode === "preview" ? "切换到编辑" : "切换到预览"}
src/components/Content/PaneTreeView.tsx:544:            onClick={() => setMode(nextPaneMode(editorMode))}
src/components/Content/PaneTreeView.tsx:548:              name={editorMode === "preview" ? "eye" : "pencil"}
src/components/Content/PaneTreeView.tsx:765:  editorMode,
src/components/Content/PaneTreeView.tsx:769:  editorMode: EditorMode;
src/components/Content/PaneTreeView.tsx:777:      modeOverride={editorMode}
src/components/ai/SelectionPill.tsx:13:      mode: "edit";
src/components/ai/SelectionPill.tsx:20:  | { mode: "preview"; text: string; x: number; y: number };
src/components/ai/SelectionPill.tsx:138:      if (mode === "preview") {
src/components/ai/SelectionPill.tsx:195:    if (!pill || pill.mode !== "edit" || busyRef.current) return;
src/components/ai/SelectionPill.tsx:223:    if (!pill || pill.mode !== "preview") return;
src/components/ai/SelectionPill.tsx:265:    pill && pill.mode === "edit"
src/components/ai/SelectionPill.tsx:279:      {pill && pill.mode === "preview" && !busy && !diff && (
src/components/Content/DocPropertyBar.tsx:1136:    if (mode !== "preview" && mode !== "edit") return;
src/components/Content/DocPropertyBar.tsx:1145:  }, [mode, previewDefault, editDefault, propertyBar, applyModeDefault]);
src/components/Content/DocPropertyBar.tsx:1250:  const editable = mode === "edit";
src/components/Content/ContentArea.tsx:321:  if (mode === "source") return [floatingToolbar()];
src/components/Content/ContentArea.tsx:322:  if (mode === "edit") {
src/components/Content/ContentArea.tsx:347:  if (mode !== "edit" || !LINE_NUMBER_KINDS.includes(kind)) return [];
src/components/Content/ContentArea.tsx:401:  const editorMode = isMediaKind(tab?.fileKind ?? "text")
src/components/Content/ContentArea.tsx:403:    : modeOverride || (activeTab?.editorMode ?? "preview");
src/components/Content/ContentArea.tsx:441:  currentModeRef.current = editorMode;
src/components/Content/ContentArea.tsx:506:    if (editorMode !== "preview" || !tab?.path) return;
src/components/Content/ContentArea.tsx:519:  }, [tab?.id, tab?.path, editorMode]);
src/components/Content/ContentArea.tsx:556:  }, [tab?.id, tab?.path, editorMode]);
src/components/Content/ContentArea.tsx:571:        lineNumbersCompartment.of(lineNumbersForMode(editorMode, initialKind)),
src/components/Content/ContentArea.tsx:572:        decorCompartment.of(decorationsForMode(editorMode, initialKind)),
src/components/Content/ContentArea.tsx:629:  const htmlVisual = tab?.fileKind === "html" && editorMode === "edit";
src/components/Content/ContentArea.tsx:630:  const cmVisible = !!tab && editorMode !== "preview" && !htmlVisual;
src/components/Content/ContentArea.tsx:690:  }, [editorMode, cmVisible]);
src/components/Content/ContentArea.tsx:698:          decorationsForMode(editorMode, tab.fileKind),
src/components/Content/ContentArea.tsx:703:          lineNumbersForMode(editorMode, tab.fileKind),
src/components/Content/ContentArea.tsx:707:  }, [editorMode, tab?.fileKind, editorViewState]);
src/components/Content/ContentArea.tsx:727:            display: editorMode === "source" ? "none" : "block",
src/components/Content/ContentArea.tsx:732:            mode={editorMode}
src/components/Content/ContentArea.tsx:766:        {editorMode === "preview" && tab && (
src/components/Content/ContentArea.tsx:773:        {editorMode === "preview" && tab && !readingMode && (
src/components/Content/ContentArea.tsx:779:          mode={editorMode}
src/components/Content/ContentSplitView.tsx:170:            editorMode={activeTab?.editorMode || "preview"}
src/components/Content/ContentSplitView.tsx:172:            onChange={(m) => useStore.getState().setEditorMode(m)}
src/components/Content/ContentSplitView.tsx:180:              modeOverride={activeTab?.editorMode}
src/components/Content/ContentSplitView.tsx:207:            editorMode={splitEditorMode}
src/components/Content/ContentSplitView.tsx:226:  editorMode,
src/components/Content/ContentSplitView.tsx:230:  editorMode: EditorMode;
src/components/Content/ContentSplitView.tsx:239:        active={editorMode === "preview"}
src/components/Content/ContentSplitView.tsx:244:        active={editorMode === "edit"}
src/components/Content/ContentSplitView.tsx:249:        active={editorMode === "source"}
src/components/Content/OutlineMenu.tsx:124:    if (mode !== "preview" || !container) {
src/components/Content/OutlineMenu.tsx:133:    () => (mode === "preview" ? domHeadings : extractHeadings(documentText)),
src/components/Content/OutlineMenu.tsx:152:    if (mode === "preview") {
src/components/Content/OutlineMenu.tsx:172:      if (mode === "preview") {

exec
/bin/zsh -c "nl -ba src/lib/readerWidth.ts | sed -n '1,80p'
nl -ba src/components/SettingsView.tsx | sed -n '1234,1275p;1830,1860p'
nl -ba src-tauri/src/config.rs | sed -n '58,75p'" in /Users/mason/ToHighs/clairis-wt-design-plan
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
  1266	                  标题字体
  1267	                </h2>
  1268	                <p className="mb-2 text-xs text-[var(--app-text-3)]">
  1269	                  逐级选择 H1–H6 的字体，留空＝默认（--type-font-sans）。
  1270	                </p>
  1271	                <datalist id="heading-font-options">
  1272	                  {(headingFontOptions ?? []).map((family) => (
  1273	                    <option key={family} value={family} />
  1274	                  ))}
  1275	                </datalist>
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

exec
/bin/zsh -c "nl -ba src-tauri/src/extension_packages.rs | sed -n '1,30p;94,160p;230,276p;738,752p'
nl -ba src-tauri/src/config.rs | sed -n '888,945p'
nl -ba src-tauri/src/lib.rs | sed -n '190,232p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
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
   230	/// 列出内置包 + 用户包（按 id 升序）。目录缺失只返回内置包；单个包非法只告警跳过。
   231	pub fn list_extension_packages_at(base: &Path) -> Result<Vec<ExtensionPackage>, AppError> {
   232	    let mut packages = builtin_packages();
   233	    let dir = extensions_dir_base(base);
   234	
   235	    let entries = match std::fs::read_dir(&dir) {
   236	        Ok(entries) => entries,
   237	        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(packages),
   238	        Err(e) => return Err(io("list extension packages", e)),
   239	    };
   240	
   241	    let mut user_packages = Vec::new();
   242	    for entry in entries.flatten() {
   243	        let path = entry.path();
   244	        if !path.is_dir() {
   245	            continue;
   246	        }
   247	        let id = entry.file_name().to_string_lossy().into_owned();
   248	        if !is_valid_id(&id) {
   249	            warn!(dir = %id, "扩展目录名非法，已跳过");
   250	            continue;
   251	        }
   252	        if is_builtin(&id) {
   253	            warn!(dir = %id, "内置扩展 id 不可被用户目录占用，已跳过");
   254	            continue;
   255	        }
   256	        match read_package_dir(&path) {
   257	            Ok((manifest, skill)) => {
   258	                if manifest.id != id {
   259	                    warn!(
   260	                        dir = %id,
   261	                        manifest_id = %manifest.id,
   262	                        "扩展目录名与 manifest.id 不一致，已跳过"
   263	                    );
   264	                    continue;
   265	                }
   266	                user_packages.push(to_package(manifest, &path, skill));
   267	            }
   268	            Err(e) => {
   269	                warn!(dir = %id, error = %e, "扩展包无法解析，已跳过");
   270	            }
   271	        }
   272	    }
   273	    user_packages.sort_by(|a, b| a.id.cmp(&b.id));
   274	    packages.extend(user_packages);
   275	    Ok(packages)
   276	}
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
   211	            search_documents,
   212	            import_media_file,
   213	            import_media_bytes,
   214	            translate_text,
   215	            stop_translation,
   216	            read_directory,
   217	            get_file_info,
   218	            flatten_files,
   219	            list_media_in_dir,
   220	            load_config,
   221	            save_config,
   222	            list_config_snapshots,
   223	            restore_config_snapshot,
   224	            list_system_fonts,
   225	            list_extensions,
   226	            list_extension_packages,
   227	            import_extension_package,
   228	            set_extension_package_enabled,
   229	            remove_extension_package,
   230	            package_extension_package,
   231	            pick_extension_source,
   232	            generate_extension_package,

exec
/bin/zsh -c "rg -n '"'^## 数据面|''^'"\\| 规格 \\||"'^'"\\| 存储 \\|' docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md || true
rg -n 'data/plugins|plugins/' . --hidden --glob '"'!node_modules/**'"' --glob '"'!.git/**'"' --glob '"'!target/**'"' --glob '"'!codex-reviews/**'"' | sed -n '1,160p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
./docs/research/technical/plugin-management-benchmark.md:40:- **社区插件**：每个插件是 vault 内 `.obsidian/plugins/<id>/` 目录（`manifest.json` + `main.js` + 可选 `styles.css` + `data.json` 存设置）。
./docs/research/technical/plugin-management-benchmark.md:64:| 真相源 | cordis.yml patch 覆盖层 | 目录发现 + settings.json | `.obsidian/plugins/` + 官方目录 | 约定路径数据文件 |
./docs/research/technical/plugin-management-benchmark.md:109:- 形态：TS 模块 + `manifest.json`（封闭 schema：`id/name/version/minAppVersion`），目录 `~/.clairis/plugins/<id>/`；生命周期 `onload()/onunload()`，注册项统一 tracked、卸载自动清理（学 Cordis 的 effect 追踪思想，不必引框架）。
./docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:21:**术语统一**：目录名与文档统一用 **plugin**（不复用既有「extension」术语，避免混淆）。插件目录定为 `data/plugins/`（独立于 `user/`，用户层）。
./docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:68:data/plugins/                     插件根（用户层，独立于 user/）
./docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:90:- **加载**：启动时同步扫描 `data/plugins/`，逐插件读 manifest、校验权限、解析数据 → 映射到配置/注册表/AGENT 上下文。
./docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:91:- **生命周期裁定（修正 P2）**：**以「重启生效」为主**，不承诺热加载。热加载需先建 watcher 基础设施（与第 2 项 §5.3 一致，`settings.json` 已有 watcher，但 `data/plugins/` 无）。**裁定**：插件改动重启生效，热加载列为后续，不在本批实现。
./docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:115:**设计**：slash 命令单独建 `data/plugins/<id>/commands/` 或 `user/commands.json`，与扩展包/技能型插件并列。在清单中显式标注其独立通路，避免与技能型插件混为一谈。实现时定具体落点。
./docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:119:**风险**：AGENT 生成插件无校验——AGENT 可生成任意插件写入 `data/plugins/`，若无校验可能引入无效/恶意插件。
./docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:145:3. **P2 生命周期不自洽**：扩展包同步加载无热重载；「重启生效」与「热加载」并存未裁定；插件模板 skill 无注册表登记；目录名/落点未定 → 已采纳，§4.3 裁定重启生效为主、热加载列后续；§2 术语统一 plugin；§4.1 目录落 `data/plugins/`。

exec
/bin/zsh -c "nl -ba src-tauri/capabilities/default.json | sed -n '1,160p'
rg -n 'permissions|capabilit' src-tauri/src/extension_packages.rs src-tauri/src/extensions.rs src-tauri/capabilities/default.json" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
     1	{
     2	  "identifier": "default",
     3	  "description": "Capability for all windows",
     4	  "windows": ["main", "overlay"],
     5	  "permissions": [
     6	    "core:default",
     7	    "dialog:default",
     8	    "dialog:allow-open",
     9	    "dialog:allow-save",
    10	    "core:event:default",
    11	    "core:event:allow-emit",
    12	    "core:event:allow-listen",
    13	    "core:window:default",
    14	    "core:window:allow-show",
    15	    "core:window:allow-hide",
    16	    "core:window:allow-set-focus",
    17	    "core:window:allow-is-visible",
    18	    "core:window:allow-set-always-on-top",
    19	    "core:window:allow-is-fullscreen",
    20	    "core:window:allow-set-fullscreen",
    21	    "core:window:allow-start-dragging",
    22	    "core:webview:default",
    23	    "core:webview:allow-print"
    24	  ]
    25	}
src-tauri/capabilities/default.json:5:  "permissions": [

exec
/bin/zsh -c "rg -n 'ROULETTE_SECTOR_META|const ALLOWED|ROOT_SECTORS|HTML_TOOLBAR_ITEMS|const ALLOWED' src/components/SettingsView.tsx src-tauri/src/config.rs src/editors/orchestration/roulette.ts src/editors/orchestration/slots.ts -C 2" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src/editors/orchestration/roulette.ts-63-}
src/editors/orchestration/roulette.ts-64-
src/editors/orchestration/roulette.ts:65:export const ROOT_SECTORS: readonly RootSector[] = [
src/editors/orchestration/roulette.ts-66-  { id: "smart", label: "智能", angle: 0 },
src/editors/orchestration/roulette.ts-67-  { id: "convert", label: "转换", angle: 45 },
--
src/editors/orchestration/slots.ts-8-}
src/editors/orchestration/slots.ts-9-
src/editors/orchestration/slots.ts:10:export const HTML_TOOLBAR_ITEMS: readonly ToolbarSlotItem[] = [
src/editors/orchestration/slots.ts-11-  { id: "ai-rewrite", label: "改写", icon: "edit", group: "ai" },
src/editors/orchestration/slots.ts-12-  { id: "ai-translate", label: "翻译", icon: "globe", group: "ai" },
--
src/editors/orchestration/slots.ts-29-
src/editors/orchestration/slots.ts-30-export const HTML_TOOLBAR_DEFAULT_ORDER: readonly string[] =
src/editors/orchestration/slots.ts:31:  HTML_TOOLBAR_ITEMS.map((item) => item.id);
src/editors/orchestration/slots.ts-32-
src/editors/orchestration/slots.ts-33-const KNOWN_IDS = new Set(HTML_TOOLBAR_DEFAULT_ORDER);
--
src-tauri/src/config.rs-657-    }
src-tauri/src/config.rs-658-    if let Some(sectors) = &config.roulette_sectors {
src-tauri/src/config.rs:659:        const ALLOWED: [&str; 8] = [
src-tauri/src/config.rs-660-            "smart", "convert", "align", "columns", "history", "clear", "format", "color",
src-tauri/src/config.rs-661-        ];
--
src-tauri/src/config.rs-711-    }
src-tauri/src/config.rs-712-    if let Some(items) = &config.html_toolbar_items {
src-tauri/src/config.rs:713:        const ALLOWED: [&str; 12] = [
src-tauri/src/config.rs-714-            "ai-rewrite",
src-tauri/src/config.rs-715-            "ai-translate",
--
src/components/SettingsView.tsx-27-} from "../types";
src/components/SettingsView.tsx-28-import { useEditorStore } from "../stores/editorStore";
src/components/SettingsView.tsx:29:import { HTML_TOOLBAR_ITEMS } from "../editors/orchestration/slots";
src/components/SettingsView.tsx-30-import { ROULETTE_HOTKEY_DEFAULT } from "../editors/orchestration/roulette";
src/components/SettingsView.tsx-31-import {
--
src/components/SettingsView.tsx-169-] as const;
src/components/SettingsView.tsx-170-
src/components/SettingsView.tsx:171:const ROULETTE_SECTOR_META = [
src/components/SettingsView.tsx-172-  { id: "smart", label: "智能" },
src/components/SettingsView.tsx-173-  { id: "convert", label: "转换" },
--
src/components/SettingsView.tsx-964-
src/components/SettingsView.tsx-965-  const activeSectors: string[] =
src/components/SettingsView.tsx:966:    rouletteSectors ?? ROULETTE_SECTOR_META.map((m) => m.id);
src/components/SettingsView.tsx-967-  const saveSectors = (next: string[]) => {
src/components/SettingsView.tsx-968-    setConfig({ rouletteSectors: next.length > 0 ? next : null });
--
src/components/SettingsView.tsx-992-
src/components/SettingsView.tsx-993-  const activeToolbarItems: string[] =
src/components/SettingsView.tsx:994:    htmlToolbarItems ?? HTML_TOOLBAR_ITEMS.map((item) => item.id);
src/components/SettingsView.tsx-995-  const saveToolbarItems = (next: string[]) => {
src/components/SettingsView.tsx-996-    setConfig({ htmlToolbarItems: next.length > 0 ? next : null });
--
src/components/SettingsView.tsx-1494-                  {[
src/components/SettingsView.tsx-1495-                    ...activeSectors,
src/components/SettingsView.tsx:1496:                    ...ROULETTE_SECTOR_META.map((m) => m.id).filter(
src/components/SettingsView.tsx-1497-                      (id) => !activeSectors.includes(id),
src/components/SettingsView.tsx-1498-                    ),
src/components/SettingsView.tsx-1499-                  ].map((id) => {
src/components/SettingsView.tsx-1500-                    const label =
src/components/SettingsView.tsx:1501:                      ROULETTE_SECTOR_META.find((m) => m.id === id)?.label ??
src/components/SettingsView.tsx-1502-                      id;
src/components/SettingsView.tsx-1503-                    const included = activeSectors.includes(id);
--
src/components/SettingsView.tsx-1566-                  {[
src/components/SettingsView.tsx-1567-                    ...activeToolbarItems,
src/components/SettingsView.tsx:1568:                    ...HTML_TOOLBAR_ITEMS.map((item) => item.id).filter(
src/components/SettingsView.tsx-1569-                      (id) => !activeToolbarItems.includes(id),
src/components/SettingsView.tsx-1570-                    ),
src/components/SettingsView.tsx-1571-                  ].map((id) => {
src/components/SettingsView.tsx-1572-                    const label =
src/components/SettingsView.tsx:1573:                      HTML_TOOLBAR_ITEMS.find((item) => item.id === id)
src/components/SettingsView.tsx-1574-                        ?.label ?? id;
src/components/SettingsView.tsx-1575-                    const included = activeToolbarItems.includes(id);

exec
/bin/zsh -c "rg -n 'runExportAction|ExportMenuAction|exportHtml|exportPng|exportPdf|exportDocx|exportMdpkg|exportZip' src/lib/exportActions.ts src/components/TabBar.tsx src/lib/paneHeaderMenu.ts | sed -n '1,220p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src/lib/exportActions.ts:4:import { exportPngFromMarkdown, exportPngMessage } from "./export/png";
src/lib/exportActions.ts:5:import { exportPdfFromMarkdown, exportPdfMessage } from "./export/pdf";
src/lib/exportActions.ts:6:import { exportDocxDocument, exportDocxMessage } from "./export/docx";
src/lib/exportActions.ts:7:import { exportMdpkgFromMarkdown, exportMdpkgMessage } from "./export/mdpkg";
src/lib/exportActions.ts:8:import { exportZipFromMarkdown, exportZipMessage } from "./export/zip";
src/lib/exportActions.ts:10:import type { ExportMenuAction } from "./paneHeaderMenu";
src/lib/exportActions.ts:28:export async function runExportAction(
src/lib/exportActions.ts:29:  action: ExportMenuAction,
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
src/components/TabBar.tsx:25:import { runExportAction } from "../lib/exportActions";
src/components/TabBar.tsx:775:                      void runExportAction(
src/lib/paneHeaderMenu.ts:28:export type ExportMenuAction =
src/lib/paneHeaderMenu.ts:29:  | "exportHtml"
src/lib/paneHeaderMenu.ts:30:  | "exportPng"
src/lib/paneHeaderMenu.ts:31:  | "exportPdf"
src/lib/paneHeaderMenu.ts:32:  | "exportDocx"
src/lib/paneHeaderMenu.ts:33:  | "exportMdpkg"
src/lib/paneHeaderMenu.ts:34:  | "exportZip";
src/lib/paneHeaderMenu.ts:37:  action: ExportMenuAction;
src/lib/paneHeaderMenu.ts:57:  { action: "exportDocx", label: "Word", icon: "exportWord" },
src/lib/paneHeaderMenu.ts:58:  { action: "exportMdpkg", label: ".mdpkg", icon: "exportMdpkg" },
src/lib/paneHeaderMenu.ts:59:  { action: "exportPng", label: "图片", icon: "image" },
src/lib/paneHeaderMenu.ts:60:  { action: "exportPdf", label: "PDF", icon: "pdf" },
src/lib/paneHeaderMenu.ts:61:  { action: "exportHtml", label: "HTML", icon: "html" },
src/lib/paneHeaderMenu.ts:62:  { action: "exportZip", label: "ZIP", icon: "exportZip" },

exec
/bin/zsh -c "rg -n 'data-surface|插件|plugin|菜单|图标|快捷键|轮盘|开关|预设|配置' docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md | wc -l
rg -n '"'^## 数据面'"' docs/design/pluginization-datafile-settings-rail/*.md || true" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
      67

exec
/bin/zsh -c "rg -n 'themeProvider|decorationTheme|decor.*theme|theme.*provider' src src-tauri docs/design/system 2>/dev/null | sed -n '1,180p'
rg -n 'data-theme|editor.*theme|cm-decor' src/editors/decorations/theme.ts src/styles/editor.css | sed -n '1,160p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src-tauri/gen/schemas/desktop-schema.json:1254:          "description": "Default permissions for the plugin.\n#### This default permission set includes:\n\n- `allow-get-all-windows`\n- `allow-scale-factor`\n- `allow-inner-position`\n- `allow-outer-position`\n- `allow-inner-size`\n- `allow-outer-size`\n- `allow-is-fullscreen`\n- `allow-is-minimized`\n- `allow-is-maximized`\n- `allow-is-focused`\n- `allow-is-decorated`\n- `allow-is-resizable`\n- `allow-is-maximizable`\n- `allow-is-minimizable`\n- `allow-is-closable`\n- `allow-is-visible`\n- `allow-is-enabled`\n- `allow-title`\n- `allow-current-monitor`\n- `allow-primary-monitor`\n- `allow-monitor-from-point`\n- `allow-available-monitors`\n- `allow-cursor-position`\n- `allow-theme`\n- `allow-is-always-on-top`\n- `allow-activity-name`\n- `allow-scene-identifier`\n- `allow-internal-toggle-maximize`",
src-tauri/gen/schemas/desktop-schema.json:1257:          "markdownDescription": "Default permissions for the plugin.\n#### This default permission set includes:\n\n- `allow-get-all-windows`\n- `allow-scale-factor`\n- `allow-inner-position`\n- `allow-outer-position`\n- `allow-inner-size`\n- `allow-outer-size`\n- `allow-is-fullscreen`\n- `allow-is-minimized`\n- `allow-is-maximized`\n- `allow-is-focused`\n- `allow-is-decorated`\n- `allow-is-resizable`\n- `allow-is-maximizable`\n- `allow-is-minimizable`\n- `allow-is-closable`\n- `allow-is-visible`\n- `allow-is-enabled`\n- `allow-title`\n- `allow-current-monitor`\n- `allow-primary-monitor`\n- `allow-monitor-from-point`\n- `allow-available-monitors`\n- `allow-cursor-position`\n- `allow-theme`\n- `allow-is-always-on-top`\n- `allow-activity-name`\n- `allow-scene-identifier`\n- `allow-internal-toggle-maximize`"
src-tauri/gen/schemas/macOS-schema.json:1254:          "description": "Default permissions for the plugin.\n#### This default permission set includes:\n\n- `allow-get-all-windows`\n- `allow-scale-factor`\n- `allow-inner-position`\n- `allow-outer-position`\n- `allow-inner-size`\n- `allow-outer-size`\n- `allow-is-fullscreen`\n- `allow-is-minimized`\n- `allow-is-maximized`\n- `allow-is-focused`\n- `allow-is-decorated`\n- `allow-is-resizable`\n- `allow-is-maximizable`\n- `allow-is-minimizable`\n- `allow-is-closable`\n- `allow-is-visible`\n- `allow-is-enabled`\n- `allow-title`\n- `allow-current-monitor`\n- `allow-primary-monitor`\n- `allow-monitor-from-point`\n- `allow-available-monitors`\n- `allow-cursor-position`\n- `allow-theme`\n- `allow-is-always-on-top`\n- `allow-activity-name`\n- `allow-scene-identifier`\n- `allow-internal-toggle-maximize`",
src-tauri/gen/schemas/macOS-schema.json:1257:          "markdownDescription": "Default permissions for the plugin.\n#### This default permission set includes:\n\n- `allow-get-all-windows`\n- `allow-scale-factor`\n- `allow-inner-position`\n- `allow-outer-position`\n- `allow-inner-size`\n- `allow-outer-size`\n- `allow-is-fullscreen`\n- `allow-is-minimized`\n- `allow-is-maximized`\n- `allow-is-focused`\n- `allow-is-decorated`\n- `allow-is-resizable`\n- `allow-is-maximizable`\n- `allow-is-minimizable`\n- `allow-is-closable`\n- `allow-is-visible`\n- `allow-is-enabled`\n- `allow-title`\n- `allow-current-monitor`\n- `allow-primary-monitor`\n- `allow-monitor-from-point`\n- `allow-available-monitors`\n- `allow-cursor-position`\n- `allow-theme`\n- `allow-is-always-on-top`\n- `allow-activity-name`\n- `allow-scene-identifier`\n- `allow-internal-toggle-maximize`"
src/editors/decorations/theme.ts:1:/* 活源码装饰主题（精简自 md-bundle packages/editor/src/decorations/theme.ts）。
src-tauri/gen/schemas/acl-manifests.json:1:{"core":{"default_permission":{"identifier":"default","description":"Default core plugins set.","permissions":["core:path:default","core:event:default","core:window:default","core:webview:default","core:app:default","core:image:default","core:resources:default","core:menu:default","core:tray:default"]},"permissions":{},"permission_sets":{},"global_scope_schema":null},"core:app":{"default_permission":{"identifier":"default","description":"Default permissions for the plugin.","permissions":["allow-version","allow-name","allow-tauri-version","allow-identifier","allow-bundle-type","allow-register-listener","allow-remove-listener","allow-supports-multiple-windows"]},"permissions":{"allow-app-hide":{"identifier":"allow-app-hide","description":"Enables the app_hide command without any pre-configured scope.","commands":{"allow":["app_hide"],"deny":[]}},"allow-app-show":{"identifier":"allow-app-show","description":"Enables the app_show command without any pre-configured scope.","commands":{"allow":["app_show"],"deny":[]}},"allow-bundle-type":{"identifier":"allow-bundle-type","description":"Enables the bundle_type command without any pre-configured scope.","commands":{"allow":["bundle_type"],"deny":[]}},"allow-default-window-icon":{"identifier":"allow-default-window-icon","description":"Enables the default_window_icon command without any pre-configured scope.","commands":{"allow":["default_window_icon"],"deny":[]}},"allow-fetch-data-store-identifiers":{"identifier":"allow-fetch-data-store-identifiers","description":"Enables the fetch_data_store_identifiers command without any pre-configured scope.","commands":{"allow":["fetch_data_store_identifiers"],"deny":[]}},"allow-identifier":{"identifier":"allow-identifier","description":"Enables the identifier command without any pre-configured scope.","commands":{"allow":["identifier"],"deny":[]}},"allow-name":{"identifier":"allow-name","description":"Enables the name command without any pre-configured scope.","commands":{"allow":["name"],"deny":[]}},"allow-register-listener":{"identifier":"allow-register-listener","description":"Enables the register_listener command without any pre-configured scope.","commands":{"allow":["register_listener"],"deny":[]}},"allow-remove-data-store":{"identifier":"allow-remove-data-store","description":"Enables the remove_data_store command without any pre-configured scope.","commands":{"allow":["remove_data_store"],"deny":[]}},"allow-remove-listener":{"identifier":"allow-remove-listener","description":"Enables the remove_listener command without any pre-configured scope.","commands":{"allow":["remove_listener"],"deny":[]}},"allow-set-app-theme":{"identifier":"allow-set-app-theme","description":"Enables the set_app_theme command without any pre-configured scope.","commands":{"allow":["set_app_theme"],"deny":[]}},"allow-set-dock-visibility":{"identifier":"allow-set-dock-visibility","description":"Enables the set_dock_visibility command without any pre-configured scope.","commands":{"allow":["set_dock_visibility"],"deny":[]}},"allow-supports-multiple-windows":{"identifier":"allow-supports-multiple-windows","description":"Enables the supports_multiple_windows command without any pre-configured scope.","commands":{"allow":["supports_multiple_windows"],"deny":[]}},"allow-tauri-version":{"identifier":"allow-tauri-version","description":"Enables the tauri_version command without any pre-configured scope.","commands":{"allow":["tauri_version"],"deny":[]}},"allow-version":{"identifier":"allow-version","description":"Enables the version command without any pre-configured scope.","commands":{"allow":["version"],"deny":[]}},"deny-app-hide":{"identifier":"deny-app-hide","description":"Denies the app_hide command without any pre-configured scope.","commands":{"allow":[],"deny":["app_hide"]}},"deny-app-show":{"identifier":"deny-app-show","description":"Denies the app_show command without any pre-configured scope.","commands":{"allow":[],"deny":["app_show"]}},"deny-bundle-type":{"identifier":"deny-bundle-type","description":"Denies the bundle_type command without any pre-configured scope.","commands":{"allow":[],"deny":["bundle_type"]}},"deny-default-window-icon":{"identifier":"deny-default-window-icon","description":"Denies the default_window_icon command without any pre-configured scope.","commands":{"allow":[],"deny":["default_window_icon"]}},"deny-fetch-data-store-identifiers":{"identifier":"deny-fetch-data-store-identifiers","description":"Denies the fetch_data_store_identifiers command without any pre-configured scope.","commands":{"allow":[],"deny":["fetch_data_store_identifiers"]}},"deny-identifier":{"identifier":"deny-identifier","description":"Denies the identifier command without any pre-configured scope.","commands":{"allow":[],"deny":["identifier"]}},"deny-name":{"identifier":"deny-name","description":"Denies the name command without any pre-configured scope.","commands":{"allow":[],"deny":["name"]}},"deny-register-listener":{"identifier":"deny-register-listener","description":"Denies the register_listener command without any pre-configured scope.","commands":{"allow":[],"deny":["register_listener"]}},"deny-remove-data-store":{"identifier":"deny-remove-data-store","description":"Denies the remove_data_store command without any pre-configured scope.","commands":{"allow":[],"deny":["remove_data_store"]}},"deny-remove-listener":{"identifier":"deny-remove-listener","description":"Denies the remove_listener command without any pre-configured scope.","commands":{"allow":[],"deny":["remove_listener"]}},"deny-set-app-theme":{"identifier":"deny-set-app-theme","description":"Denies the set_app_theme command without any pre-configured scope.","commands":{"allow":[],"deny":["set_app_theme"]}},"deny-set-dock-visibility":{"identifier":"deny-set-dock-visibility","description":"Denies the set_dock_visibility command without any pre-configured scope.","commands":{"allow":[],"deny":["set_dock_visibility"]}},"deny-supports-multiple-windows":{"identifier":"deny-supports-multiple-windows","description":"Denies the supports_multiple_windows command without any pre-configured scope.","commands":{"allow":[],"deny":["supports_multiple_windows"]}},"deny-tauri-version":{"identifier":"deny-tauri-version","description":"Denies the tauri_version command without any pre-configured scope.","commands":{"allow":[],"deny":["tauri_version"]}},"deny-version":{"identifier":"deny-version","description":"Denies the version command without any pre-configured scope.","commands":{"allow":[],"deny":["version"]}}},"permission_sets":{},"global_scope_schema":null},"core:event":{"default_permission":{"identifier":"default","description":"Default permissions for the plugin, which enables all commands.","permissions":["allow-listen","allow-unlisten","allow-emit","allow-emit-to"]},"permissions":{"allow-emit":{"identifier":"allow-emit","description":"Enables the emit command without any pre-configured scope.","commands":{"allow":["emit"],"deny":[]}},"allow-emit-to":{"identifier":"allow-emit-to","description":"Enables the emit_to command without any pre-configured scope.","commands":{"allow":["emit_to"],"deny":[]}},"allow-listen":{"identifier":"allow-listen","description":"Enables the listen command without any pre-configured scope.","commands":{"allow":["listen"],"deny":[]}},"allow-unlisten":{"identifier":"allow-unlisten","description":"Enables the unlisten command without any pre-configured scope.","commands":{"allow":["unlisten"],"deny":[]}},"deny-emit":{"identifier":"deny-emit","description":"Denies the emit command without any pre-configured scope.","commands":{"allow":[],"deny":["emit"]}},"deny-emit-to":{"identifier":"deny-emit-to","description":"Denies the emit_to command without any pre-configured scope.","commands":{"allow":[],"deny":["emit_to"]}},"deny-listen":{"identifier":"deny-listen","description":"Denies the listen command without any pre-configured scope.","commands":{"allow":[],"deny":["listen"]}},"deny-unlisten":{"identifier":"deny-unlisten","description":"Denies the unlisten command without any pre-configured scope.","commands":{"allow":[],"deny":["unlisten"]}}},"permission_sets":{},"global_scope_schema":null},"core:image":{"default_permission":{"identifier":"default","description":"Default permissions for the plugin, which enables all commands.","permissions":["allow-new","allow-from-bytes","allow-from-path","allow-rgba","allow-size"]},"permissions":{"allow-from-bytes":{"identifier":"allow-from-bytes","description":"Enables the from_bytes command without any pre-configured scope.","commands":{"allow":["from_bytes"],"deny":[]}},"allow-from-path":{"identifier":"allow-from-path","description":"Enables the from_path command without any pre-configured scope.","commands":{"allow":["from_path"],"deny":[]}},"allow-new":{"identifier":"allow-new","description":"Enables the new command without any pre-configured scope.","commands":{"allow":["new"],"deny":[]}},"allow-rgba":{"identifier":"allow-rgba","description":"Enables the rgba command without any pre-configured scope.","commands":{"allow":["rgba"],"deny":[]}},"allow-size":{"identifier":"allow-size","description":"Enables the size command without any pre-configured scope.","commands":{"allow":["size"],"deny":[]}},"deny-from-bytes":{"identifier":"deny-from-bytes","description":"Denies the from_bytes command without any pre-configured scope.","commands":{"allow":[],"deny":["from_bytes"]}},"deny-from-path":{"identifier":"deny-from-path","description":"Denies the from_path command without any pre-configured scope.","commands":{"allow":[],"deny":["from_path"]}},"deny-new":{"identifier":"deny-new","description":"Denies the new command without any pre-configured scope.","commands":{"allow":[],"deny":["new"]}},"deny-rgba":{"identifier":"deny-rgba","description":"Denies the rgba command without any pre-configured scope.","commands":{"allow":[],"deny":["rgba"]}},"deny-size":{"identifier":"deny-size","description":"Denies the size command without any pre-configured scope.","commands":{"allow":[],"deny":["size"]}}},"permission_sets":{},"global_scope_schema":null},"core:menu":{"default_permission":{"identifier":"default","description":"Default permissions for the plugin, which enables all commands.","permissions":["allow-new","allow-append","allow-prepend","allow-insert","allow-remove","allow-remove-at","allow-items","allow-get","allow-popup","allow-create-default","allow-set-as-app-menu","allow-set-as-window-menu","allow-text","allow-set-text","allow-is-enabled","allow-set-enabled","allow-set-accelerator","allow-set-as-windows-menu-for-nsapp","allow-set-as-help-menu-for-nsapp","allow-is-checked","allow-set-checked","allow-set-icon"]},"permissions":{"allow-append":{"identifier":"allow-append","description":"Enables the append command without any pre-configured scope.","commands":{"allow":["append"],"deny":[]}},"allow-create-default":{"identifier":"allow-create-default","description":"Enables the create_default command without any pre-configured scope.","commands":{"allow":["create_default"],"deny":[]}},"allow-get":{"identifier":"allow-get","description":"Enables the get command without any pre-configured scope.","commands":{"allow":["get"],"deny":[]}},"allow-insert":{"identifier":"allow-insert","description":"Enables the insert command without any pre-configured scope.","commands":{"allow":["insert"],"deny":[]}},"allow-is-checked":{"identifier":"allow-is-checked","description":"Enables the is_checked command without any pre-configured scope.","commands":{"allow":["is_checked"],"deny":[]}},"allow-is-enabled":{"identifier":"allow-is-enabled","description":"Enables the is_enabled command without any pre-configured scope.","commands":{"allow":["is_enabled"],"deny":[]}},"allow-items":{"identifier":"allow-items","description":"Enables the items command without any pre-configured scope.","commands":{"allow":["items"],"deny":[]}},"allow-new":{"identifier":"allow-new","description":"Enables the new command without any pre-configured scope.","commands":{"allow":["new"],"deny":[]}},"allow-popup":{"identifier":"allow-popup","description":"Enables the popup command without any pre-configured scope.","commands":{"allow":["popup"],"deny":[]}},"allow-prepend":{"identifier":"allow-prepend","description":"Enables the prepend command without any pre-configured scope.","commands":{"allow":["prepend"],"deny":[]}},"allow-remove":{"identifier":"allow-remove","description":"Enables the remove command without any pre-configured scope.","commands":{"allow":["remove"],"deny":[]}},"allow-remove-at":{"identifier":"allow-remove-at","description":"Enables the remove_at command without any pre-configured scope.","commands":{"allow":["remove_at"],"deny":[]}},"allow-set-accelerator":{"identifier":"allow-set-accelerator","description":"Enables the set_accelerator command without any pre-configured scope.","commands":{"allow":["set_accelerator"],"deny":[]}},"allow-set-as-app-menu":{"identifier":"allow-set-as-app-menu","description":"Enables the set_as_app_menu command without any pre-configured scope.","commands":{"allow":["set_as_app_menu"],"deny":[]}},"allow-set-as-help-menu-for-nsapp":{"identifier":"allow-set-as-help-menu-for-nsapp","description":"Enables the set_as_help_menu_for_nsapp command without any pre-configured scope.","commands":{"allow":["set_as_help_menu_for_nsapp"],"deny":[]}},"allow-set-as-window-menu":{"identifier":"allow-set-as-window-menu","description":"Enables the set_as_window_menu command without any pre-configured scope.","commands":{"allow":["set_as_window_menu"],"deny":[]}},"allow-set-as-windows-menu-for-nsapp":{"identifier":"allow-set-as-windows-menu-for-nsapp","description":"Enables the set_as_windows_menu_for_nsapp command without any pre-configured scope.","commands":{"allow":["set_as_windows_menu_for_nsapp"],"deny":[]}},"allow-set-checked":{"identifier":"allow-set-checked","description":"Enables the set_checked command without any pre-configured scope.","commands":{"allow":["set_checked"],"deny":[]}},"allow-set-enabled":{"identifier":"allow-set-enabled","description":"Enables the set_enabled command without any pre-configured scope.","commands":{"allow":["set_enabled"],"deny":[]}},"allow-set-icon":{"identifier":"allow-set-icon","description":"Enables the set_icon command without any pre-configured scope.","commands":{"allow":["set_icon"],"deny":[]}},"allow-set-text":{"identifier":"allow-set-text","description":"Enables the set_text command without any pre-configured scope.","commands":{"allow":["set_text"],"deny":[]}},"allow-text":{"identifier":"allow-text","description":"Enables the text command without any pre-configured scope.","commands":{"allow":["text"],"deny":[]}},"deny-append":{"identifier":"deny-append","description":"Denies the append command without any pre-configured scope.","commands":{"allow":[],"deny":["append"]}},"deny-create-default":{"identifier":"deny-create-default","description":"Denies the create_default command without any pre-configured scope.","commands":{"allow":[],"deny":["create_default"]}},"deny-get":{"identifier":"deny-get","description":"Denies the get command without any pre-configured scope.","commands":{"allow":[],"deny":["get"]}},"deny-insert":{"identifier":"deny-insert","description":"Denies the insert command without any pre-configured scope.","commands":{"allow":[],"deny":["insert"]}},"deny-is-checked":{"identifier":"deny-is-checked","description":"Denies the is_checked command without any pre-configured scope.","commands":{"allow":[],"deny":["is_checked"]}},"deny-is-enabled":{"identifier":"deny-is-enabled","description":"Denies the is_enabled command without any pre-configured scope.","commands":{"allow":[],"deny":["is_enabled"]}},"deny-items":{"identifier":"deny-items","description":"Denies the items command without any pre-configured scope.","commands":{"allow":[],"deny":["items"]}},"deny-new":{"identifier":"deny-new","description":"Denies the new command without any pre-configured scope.","commands":{"allow":[],"deny":["new"]}},"deny-popup":{"identifier":"deny-popup","description":"Denies the popup command without any pre-configured scope.","commands":{"allow":[],"deny":["popup"]}},"deny-prepend":{"identifier":"deny-prepend","description":"Denies the prepend command without any pre-configured scope.","commands":{"allow":[],"deny":["prepend"]}},"deny-remove":{"identifier":"deny-remove","description":"Denies the remove command without any pre-configured scope.","commands":{"allow":[],"deny":["remove"]}},"deny-remove-at":{"identifier":"deny-remove-at","description":"Denies the remove_at command without any pre-configured scope.","commands":{"allow":[],"deny":["remove_at"]}},"deny-set-accelerator":{"identifier":"deny-set-accelerator","description":"Denies the set_accelerator command without any pre-configured scope.","commands":{"allow":[],"deny":["set_accelerator"]}},"deny-set-as-app-menu":{"identifier":"deny-set-as-app-menu","description":"Denies the set_as_app_menu command without any pre-configured scope.","commands":{"allow":[],"deny":["set_as_app_menu"]}},"deny-set-as-help-menu-for-nsapp":{"identifier":"deny-set-as-help-menu-for-nsapp","description":"Denies the set_as_help_menu_for_nsapp command without any pre-configured scope.","commands":{"allow":[],"deny":["set_as_help_menu_for_nsapp"]}},"deny-set-as-window-menu":{"identifier":"deny-set-as-window-menu","description":"Denies the set_as_window_menu command without any pre-configured scope.","commands":{"allow":[],"deny":["set_as_window_menu"]}},"deny-set-as-windows-menu-for-nsapp":{"identifier":"deny-set-as-windows-menu-for-nsapp","description":"Denies the set_as_windows_menu_for_nsapp command without any pre-configured scope.","commands":{"allow":[],"deny":["set_as_windows_menu_for_nsapp"]}},"deny-set-checked":{"identifier":"deny-set-checked","description":"Denies the set_checked command without any pre-configured scope.","commands":{"allow":[],"deny":["set_checked"]}},"deny-set-enabled":{"identifier":"deny-set-enabled","description":"Denies the set_enabled command without any pre-configured scope.","commands":{"allow":[],"deny":["set_enabled"]}},"deny-set-icon":{"identifier":"deny-set-icon","description":"Denies the set_icon command without any pre-configured scope.","commands":{"allow":[],"deny":["set_icon"]}},"deny-set-text":{"identifier":"deny-set-text","description":"Denies the set_text command without any pre-configured scope.","commands":{"allow":[],"deny":["set_text"]}},"deny-text":{"identifier":"deny-text","description":"Denies the text command without any pre-configured scope.","commands":{"allow":[],"deny":["text"]}}},"permission_sets":{},"global_scope_schema":null},"core:path":{"default_permission":{"identifier":"default","description":"Default permissions for the plugin, which enables all commands.","permissions":["allow-resolve-directory","allow-resolve","allow-normalize","allow-join","allow-dirname","allow-extname","allow-basename","allow-is-absolute"]},"permissions":{"allow-basename":{"identifier":"allow-basename","description":"Enables the basename command without any pre-configured scope.","commands":{"allow":["basename"],"deny":[]}},"allow-dirname":{"identifier":"allow-dirname","description":"Enables the dirname command without any pre-configured scope.","commands":{"allow":["dirname"],"deny":[]}},"allow-extname":{"identifier":"allow-extname","description":"Enables the extname command without any pre-configured scope.","commands":{"allow":["extname"],"deny":[]}},"allow-is-absolute":{"identifier":"allow-is-absolute","description":"Enables the is_absolute command without any pre-configured scope.","commands":{"allow":["is_absolute"],"deny":[]}},"allow-join":{"identifier":"allow-join","description":"Enables the join command without any pre-configured scope.","commands":{"allow":["join"],"deny":[]}},"allow-normalize":{"identifier":"allow-normalize","description":"Enables the normalize command without any pre-configured scope.","commands":{"allow":["normalize"],"deny":[]}},"allow-resolve":{"identifier":"allow-resolve","description":"Enables the resolve command without any pre-configured scope.","commands":{"allow":["resolve"],"deny":[]}},"allow-resolve-directory":{"identifier":"allow-resolve-directory","description":"Enables the resolve_directory command without any pre-configured scope.","commands":{"allow":["resolve_directory"],"deny":[]}},"deny-basename":{"identifier":"deny-basename","description":"Denies the basename command without any pre-configured scope.","commands":{"allow":[],"deny":["basename"]}},"deny-dirname":{"identifier":"deny-dirname","description":"Denies the dirname command without any pre-configured scope.","commands":{"allow":[],"deny":["dirname"]}},"deny-extname":{"identifier":"deny-extname","description":"Denies the extname command without any pre-configured scope.","commands":{"allow":[],"deny":["extname"]}},"deny-is-absolute":{"identifier":"deny-is-absolute","description":"Denies the is_absolute command without any pre-configured scope.","commands":{"allow":[],"deny":["is_absolute"]}},"deny-join":{"identifier":"deny-join","description":"Denies the join command without any pre-configured scope.","commands":{"allow":[],"deny":["join"]}},"deny-normalize":{"identifier":"deny-normalize","description":"Denies the normalize command without any pre-configured scope.","commands":{"allow":[],"deny":["normalize"]}},"deny-resolve":{"identifier":"deny-resolve","description":"Denies the resolve command without any pre-configured scope.","commands":{"allow":[],"deny":["resolve"]}},"deny-resolve-directory":{"identifier":"deny-resolve-directory","description":"Denies the resolve_directory command without any pre-configured scope.","commands":{"allow":[],"deny":["resolve_directory"]}}},"permission_sets":{},"global_scope_schema":null},"core:resources":{"default_permission":{"identifier":"default","description":"Default permissions for the plugin, which enables all commands.","permissions":["allow-close"]},"permissions":{"allow-close":{"identifier":"allow-close","description":"Enables the close command without any pre-configured scope.","commands":{"allow":["close"],"deny":[]}},"deny-close":{"identifier":"deny-close","description":"Denies the close command without any pre-configured scope.","commands":{"allow":[],"deny":["close"]}}},"permission_sets":{},"global_scope_schema":null},"core:tray":{"default_permission":{"identifier":"default","description":"Default permissions for the plugin, which enables all commands.","permissions":["allow-new","allow-get-by-id","allow-remove-by-id","allow-set-icon","allow-set-menu","allow-set-tooltip","allow-set-title","allow-set-visible","allow-set-temp-dir-path","allow-set-icon-as-template","allow-set-icon-with-as-template","allow-set-show-menu-on-left-click"]},"permissions":{"allow-get-by-id":{"identifier":"allow-get-by-id","description":"Enables the get_by_id command without any pre-configured scope.","commands":{"allow":["get_by_id"],"deny":[]}},"allow-new":{"identifier":"allow-new","description":"Enables the new command without any pre-configured scope.","commands":{"allow":["new"],"deny":[]}},"allow-remove-by-id":{"identifier":"allow-remove-by-id","description":"Enables the remove_by_id command without any pre-configured scope.","commands":{"allow":["remove_by_id"],"deny":[]}},"allow-set-icon":{"identifier":"allow-set-icon","description":"Enables the set_icon command without any pre-configured scope.","commands":{"allow":["set_icon"],"deny":[]}},"allow-set-icon-as-template":{"identifier":"allow-set-icon-as-template","description":"Enables the set_icon_as_template command without any pre-configured scope.","commands":{"allow":["set_icon_as_template"],"deny":[]}},"allow-set-icon-with-as-template":{"identifier":"allow-set-icon-with-as-template","description":"Enables the set_icon_with_as_template command without any pre-configured scope.","commands":{"allow":["set_icon_with_as_template"],"deny":[]}},"allow-set-menu":{"identifier":"allow-set-menu","description":"Enables the set_menu command without any pre-configured scope.","commands":{"allow":["set_menu"],"deny":[]}},"allow-set-show-menu-on-left-click":{"identifier":"allow-set-show-menu-on-left-click","description":"Enables the set_show_menu_on_left_click command without any pre-configured scope.","commands":{"allow":["set_show_menu_on_left_click"],"deny":[]}},"allow-set-temp-dir-path":{"identifier":"allow-set-temp-dir-path","description":"Enables the set_temp_dir_path command without any pre-configured scope.","commands":{"allow":["set_temp_dir_path"],"deny":[]}},"allow-set-title":{"identifier":"allow-set-title","description":"Enables the set_title command without any pre-configured scope.","commands":{"allow":["set_title"],"deny":[]}},"allow-set-tooltip":{"identifier":"allow-set-tooltip","description":"Enables the set_tooltip command without any pre-configured scope.","commands":{"allow":["set_tooltip"],"deny":[]}},"allow-set-visible":{"identifier":"allow-set-visible","description":"Enables the set_visible command without any pre-configured scope.","commands":{"allow":["set_visible"],"deny":[]}},"deny-get-by-id":{"identifier":"deny-get-by-id","description":"Denies the get_by_id command without any pre-configured scope.","commands":{"allow":[],"deny":["get_by_id"]}},"deny-new":{"identifier":"deny-new","description":"Denies the new command without any pre-configured scope.","commands":{"allow":[],"deny":["new"]}},"deny-remove-by-id":{"identifier":"deny-remove-by-id","description":"Denies the remove_by_id command without any pre-configured scope.","commands":{"allow":[],"deny":["remove_by_id"]}},"deny-set-icon":{"identifier":"deny-set-icon","description":"Denies the set_icon command without any pre-configured scope.","commands":{"allow":[],"deny":["set_icon"]}},"deny-set-icon-as-template":{"identifier":"deny-set-icon-as-template","description":"Denies the set_icon_as_template command without any pre-configured scope.","commands":{"allow":[],"deny":["set_icon_as_template"]}},"deny-set-icon-with-as-template":{"identifier":"deny-set-icon-with-as-template","description":"Denies the set_icon_with_as_template command without any pre-configured scope.","commands":{"allow":[],"deny":["set_icon_with_as_template"]}},"deny-set-menu":{"identifier":"deny-set-menu","description":"Denies the set_menu command without any pre-configured scope.","commands":{"allow":[],"deny":["set_menu"]}},"deny-set-show-menu-on-left-click":{"identifier":"deny-set-show-menu-on-left-click","description":"Denies the set_show_menu_on_left_click command without any pre-configured scope.","commands":{"allow":[],"deny":["set_show_menu_on_left_click"]}},"deny-set-temp-dir-path":{"identifier":"deny-set-temp-dir-path","description":"Denies the set_temp_dir_path command without any pre-configured scope.","commands":{"allow":[],"deny":["set_temp_dir_path"]}},"deny-set-title":{"identifier":"deny-set-title","description":"Denies the set_title command without any pre-configured scope.","commands":{"allow":[],"deny":["set_title"]}},"deny-set-tooltip":{"identifier":"deny-set-tooltip","description":"Denies the set_tooltip command without any pre-configured scope.","commands":{"allow":[],"deny":["set_tooltip"]}},"deny-set-visible":{"identifier":"deny-set-visible","description":"Denies the set_visible command without any pre-configured scope.","commands":{"allow":[],"deny":["set_visible"]}}},"permission_sets":{},"global_scope_schema":null},"core:webview":{"default_permission":{"identifier":"default","description":"Default permissions for the plugin.","permissions":["allow-get-all-webviews","allow-webview-position","allow-webview-size","allow-internal-toggle-devtools"]},"permissions":{"allow-clear-all-browsing-data":{"identifier":"allow-clear-all-browsing-data","description":"Enables the clear_all_browsing_data command without any pre-configured scope.","commands":{"allow":["clear_all_browsing_data"],"deny":[]}},"allow-create-webview":{"identifier":"allow-create-webview","description":"Enables the create_webview command without any pre-configured scope.","commands":{"allow":["create_webview"],"deny":[]}},"allow-create-webview-window":{"identifier":"allow-create-webview-window","description":"Enables the create_webview_window command without any pre-configured scope.","commands":{"allow":["create_webview_window"],"deny":[]}},"allow-get-all-webviews":{"identifier":"allow-get-all-webviews","description":"Enables the get_all_webviews command without any pre-configured scope.","commands":{"allow":["get_all_webviews"],"deny":[]}},"allow-internal-toggle-devtools":{"identifier":"allow-internal-toggle-devtools","description":"Enables the internal_toggle_devtools command without any pre-configured scope.","commands":{"allow":["internal_toggle_devtools"],"deny":[]}},"allow-print":{"identifier":"allow-print","description":"Enables the print command without any pre-configured scope.","commands":{"allow":["print"],"deny":[]}},"allow-reparent":{"identifier":"allow-reparent","description":"Enables the reparent command without any pre-configured scope.","commands":{"allow":["reparent"],"deny":[]}},"allow-set-webview-auto-resize":{"identifier":"allow-set-webview-auto-resize","description":"Enables the set_webview_auto_resize command without any pre-configured scope.","commands":{"allow":["set_webview_auto_resize"],"deny":[]}},"allow-set-webview-background-color":{"identifier":"allow-set-webview-background-color","description":"Enables the set_webview_background_color command without any pre-configured scope.","commands":{"allow":["set_webview_background_color"],"deny":[]}},"allow-set-webview-focus":{"identifier":"allow-set-webview-focus","description":"Enables the set_webview_focus command without any pre-configured scope.","commands":{"allow":["set_webview_focus"],"deny":[]}},"allow-set-webview-position":{"identifier":"allow-set-webview-position","description":"Enables the set_webview_position command without any pre-configured scope.","commands":{"allow":["set_webview_position"],"deny":[]}},"allow-set-webview-size":{"identifier":"allow-set-webview-size","description":"Enables the set_webview_size command without any pre-configured scope.","commands":{"allow":["set_webview_size"],"deny":[]}},"allow-set-webview-zoom":{"identifier":"allow-set-webview-zoom","description":"Enables the set_webview_zoom command without any pre-configured scope.","commands":{"allow":["set_webview_zoom"],"deny":[]}},"allow-webview-close":{"identifier":"allow-webview-close","description":"Enables the webview_close command without any pre-configured scope.","commands":{"allow":["webview_close"],"deny":[]}},"allow-webview-hide":{"identifier":"allow-webview-hide","description":"Enables the webview_hide command without any pre-configured scope.","commands":{"allow":["webview_hide"],"deny":[]}},"allow-webview-position":{"identifier":"allow-webview-position","description":"Enables the webview_position command without any pre-configured scope.","commands":{"allow":["webview_position"],"deny":[]}},"allow-webview-show":{"identifier":"allow-webview-show","description":"Enables the webview_show command without any pre-configured scope.","commands":{"allow":["webview_show"],"deny":[]}},"allow-webview-size":{"identifier":"allow-webview-size","description":"Enables the webview_size command without any pre-configured scope.","commands":{"allow":["webview_size"],"deny":[]}},"deny-clear-all-browsing-data":{"identifier":"deny-clear-all-browsing-data","description":"Denies the clear_all_browsing_data command without any pre-configured scope.","commands":{"allow":[],"deny":["clear_all_browsing_data"]}},"deny-create-webview":{"identifier":"deny-create-webview","description":"Denies the create_webview command without any pre-configured scope.","commands":{"allow":[],"deny":["create_webview"]}},"deny-create-webview-window":{"identifier":"deny-create-webview-window","description":"Denies the create_webview_window command without any pre-configured scope.","commands":{"allow":[],"deny":["create_webview_window"]}},"deny-get-all-webviews":{"identifier":"deny-get-all-webviews","description":"Denies the get_all_webviews command without any pre-configured scope.","commands":{"allow":[],"deny":["get_all_webviews"]}},"deny-internal-toggle-devtools":{"identifier":"deny-internal-toggle-devtools","description":"Denies the internal_toggle_devtools command without any pre-configured scope.","commands":{"allow":[],"deny":["internal_toggle_devtools"]}},"deny-print":{"identifier":"deny-print","description":"Denies the print command without any pre-configured scope.","commands":{"allow":[],"deny":["print"]}},"deny-reparent":{"identifier":"deny-reparent","description":"Denies the reparent command without any pre-configured scope.","commands":{"allow":[],"deny":["reparent"]}},"deny-set-webview-auto-resize":{"identifier":"deny-set-webview-auto-resize","description":"Denies the set_webview_auto_resize command without any pre-configured scope.","commands":{"allow":[],"deny":["set_webview_auto_resize"]}},"deny-set-webview-background-color":{"identifier":"deny-set-webview-background-color","description":"Denies the set_webview_background_color command without any pre-configured scope.","commands":{"allow":[],"deny":["set_webview_background_color"]}},"deny-set-webview-focus":{"identifier":"deny-set-webview-focus","description":"Denies the set_webview_focus command without any pre-configured scope.","commands":{"allow":[],"deny":["set_webview_focus"]}},"deny-set-webview-position":{"identifier":"deny-set-webview-position","description":"Denies the set_webview_position command without any pre-configured scope.","commands":{"allow":[],"deny":["set_webview_position"]}},"deny-set-webview-size":{"identifier":"deny-set-webview-size","description":"Denies the set_webview_size command without any pre-configured scope.","commands":{"allow":[],"deny":["set_webview_size"]}},"deny-set-webview-zoom":{"identifier":"deny-set-webview-zoom","description":"Denies the set_webview_zoom command without any pre-configured scope.","commands":{"allow":[],"deny":["set_webview_zoom"]}},"deny-webview-close":{"identifier":"deny-webview-close","description":"Denies the webview_close command without any pre-configured scope.","commands":{"allow":[],"deny":["webview_close"]}},"deny-webview-hide":{"identifier":"deny-webview-hide","description":"Denies the webview_hide command without any pre-configured scope.","commands":{"allow":[],"deny":["webview_hide"]}},"deny-webview-position":{"identifier":"deny-webview-position","description":"Denies the webview_position command without any pre-configured scope.","commands":{"allow":[],"deny":["webview_position"]}},"deny-webview-show":{"identifier":"deny-webview-show","description":"Denies the webview_show command without any pre-configured scope.","commands":{"allow":[],"deny":["webview_show"]}},"deny-webview-size":{"identifier":"deny-webview-size","description":"Denies the webview_size command without any pre-configured scope.","commands":{"allow":[],"deny":["webview_size"]}}},"permission_sets":{},"global_scope_schema":null},"core:window":{"default_permission":{"identifier":"default","description":"Default permissions for the plugin.","permissions":["allow-get-all-windows","allow-scale-factor","allow-inner-position","allow-outer-position","allow-inner-size","allow-outer-size","allow-is-fullscreen","allow-is-minimized","allow-is-maximized","allow-is-focused","allow-is-decorated","allow-is-resizable","allow-is-maximizable","allow-is-minimizable","allow-is-closable","allow-is-visible","allow-is-enabled","allow-title","allow-current-monitor","allow-primary-monitor","allow-monitor-from-point","allow-available-monitors","allow-cursor-position","allow-theme","allow-is-always-on-top","allow-activity-name","allow-scene-identifier","allow-internal-toggle-maximize"]},"permissions":{"allow-activity-name":{"identifier":"allow-activity-name","description":"Enables the activity_name command without any pre-configured scope.","commands":{"allow":["activity_name"],"deny":[]}},"allow-available-monitors":{"identifier":"allow-available-monitors","description":"Enables the available_monitors command without any pre-configured scope.","commands":{"allow":["available_monitors"],"deny":[]}},"allow-center":{"identifier":"allow-center","description":"Enables the center command without any pre-configured scope.","commands":{"allow":["center"],"deny":[]}},"allow-close":{"identifier":"allow-close","description":"Enables the close command without any pre-configured scope.","commands":{"allow":["close"],"deny":[]}},"allow-create":{"identifier":"allow-create","description":"Enables the create command without any pre-configured scope.","commands":{"allow":["create"],"deny":[]}},"allow-current-monitor":{"identifier":"allow-current-monitor","description":"Enables the current_monitor command without any pre-configured scope.","commands":{"allow":["current_monitor"],"deny":[]}},"allow-cursor-position":{"identifier":"allow-cursor-position","description":"Enables the cursor_position command without any pre-configured scope.","commands":{"allow":["cursor_position"],"deny":[]}},"allow-destroy":{"identifier":"allow-destroy","description":"Enables the destroy command without any pre-configured scope.","commands":{"allow":["destroy"],"deny":[]}},"allow-get-all-windows":{"identifier":"allow-get-all-windows","description":"Enables the get_all_windows command without any pre-configured scope.","commands":{"allow":["get_all_windows"],"deny":[]}},"allow-hide":{"identifier":"allow-hide","description":"Enables the hide command without any pre-configured scope.","commands":{"allow":["hide"],"deny":[]}},"allow-inner-position":{"identifier":"allow-inner-position","description":"Enables the inner_position command without any pre-configured scope.","commands":{"allow":["inner_position"],"deny":[]}},"allow-inner-size":{"identifier":"allow-inner-size","description":"Enables the inner_size command without any pre-configured scope.","commands":{"allow":["inner_size"],"deny":[]}},"allow-internal-toggle-maximize":{"identifier":"allow-internal-toggle-maximize","description":"Enables the internal_toggle_maximize command without any pre-configured scope.","commands":{"allow":["internal_toggle_maximize"],"deny":[]}},"allow-is-always-on-top":{"identifier":"allow-is-always-on-top","description":"Enables the is_always_on_top command without any pre-configured scope.","commands":{"allow":["is_always_on_top"],"deny":[]}},"allow-is-closable":{"identifier":"allow-is-closable","description":"Enables the is_closable command without any pre-configured scope.","commands":{"allow":["is_closable"],"deny":[]}},"allow-is-decorated":{"identifier":"allow-is-decorated","description":"Enables the is_decorated command without any pre-configured scope.","commands":{"allow":["is_decorated"],"deny":[]}},"allow-is-enabled":{"identifier":"allow-is-enabled","description":"Enables the is_enabled command without any pre-configured scope.","commands":{"allow":["is_enabled"],"deny":[]}},"allow-is-focused":{"identifier":"allow-is-focused","description":"Enables the is_focused command without any pre-configured scope.","commands":{"allow":["is_focused"],"deny":[]}},"allow-is-fullscreen":{"identifier":"allow-is-fullscreen","description":"Enables the is_fullscreen command without any pre-configured scope.","commands":{"allow":["is_fullscreen"],"deny":[]}},"allow-is-maximizable":{"identifier":"allow-is-maximizable","description":"Enables the is_maximizable command without any pre-configured scope.","commands":{"allow":["is_maximizable"],"deny":[]}},"allow-is-maximized":{"identifier":"allow-is-maximized","description":"Enables the is_maximized command without any pre-configured scope.","commands":{"allow":["is_maximized"],"deny":[]}},"allow-is-minimizable":{"identifier":"allow-is-minimizable","description":"Enables the is_minimizable command without any pre-configured scope.","commands":{"allow":["is_minimizable"],"deny":[]}},"allow-is-minimized":{"identifier":"allow-is-minimized","description":"Enables the is_minimized command without any pre-configured scope.","commands":{"allow":["is_minimized"],"deny":[]}},"allow-is-resizable":{"identifier":"allow-is-resizable","description":"Enables the is_resizable command without any pre-configured scope.","commands":{"allow":["is_resizable"],"deny":[]}},"allow-is-visible":{"identifier":"allow-is-visible","description":"Enables the is_visible command without any pre-configured scope.","commands":{"allow":["is_visible"],"deny":[]}},"allow-maximize":{"identifier":"allow-maximize","description":"Enables the maximize command without any pre-configured scope.","commands":{"allow":["maximize"],"deny":[]}},"allow-minimize":{"identifier":"allow-minimize","description":"Enables the minimize command without any pre-configured scope.","commands":{"allow":["minimize"],"deny":[]}},"allow-monitor-from-point":{"identifier":"allow-monitor-from-point","description":"Enables the monitor_from_point command without any pre-configured scope.","commands":{"allow":["monitor_from_point"],"deny":[]}},"allow-outer-position":{"identifier":"allow-outer-position","description":"Enables the outer_position command without any pre-configured scope.","commands":{"allow":["outer_position"],"deny":[]}},"allow-outer-size":{"identifier":"allow-outer-size","description":"Enables the outer_size command without any pre-configured scope.","commands":{"allow":["outer_size"],"deny":[]}},"allow-primary-monitor":{"identifier":"allow-primary-monitor","description":"Enables the primary_monitor command without any pre-configured scope.","commands":{"allow":["primary_monitor"],"deny":[]}},"allow-request-user-attention":{"identifier":"allow-request-user-attention","description":"Enables the request_user_attention command without any pre-configured scope.","commands":{"allow":["request_user_attention"],"deny":[]}},"allow-scale-factor":{"identifier":"allow-scale-factor","description":"Enables the scale_factor command without any pre-configured scope.","commands":{"allow":["scale_factor"],"deny":[]}},"allow-scene-identifier":{"identifier":"allow-scene-identifier","description":"Enables the scene_identifier command without any pre-configured scope.","commands":{"allow":["scene_identifier"],"deny":[]}},"allow-set-always-on-bottom":{"identifier":"allow-set-always-on-bottom","description":"Enables the set_always_on_bottom command without any pre-configured scope.","commands":{"allow":["set_always_on_bottom"],"deny":[]}},"allow-set-always-on-top":{"identifier":"allow-set-always-on-top","description":"Enables the set_always_on_top command without any pre-configured scope.","commands":{"allow":["set_always_on_top"],"deny":[]}},"allow-set-background-color":{"identifier":"allow-set-background-color","description":"Enables the set_background_color command without any pre-configured scope.","commands":{"allow":["set_background_color"],"deny":[]}},"allow-set-badge-count":{"identifier":"allow-set-badge-count","description":"Enables the set_badge_count command without any pre-configured scope.","commands":{"allow":["set_badge_count"],"deny":[]}},"allow-set-badge-label":{"identifier":"allow-set-badge-label","description":"Enables the set_badge_label command without any pre-configured scope.","commands":{"allow":["set_badge_label"],"deny":[]}},"allow-set-closable":{"identifier":"allow-set-closable","description":"Enables the set_closable command without any pre-configured scope.","commands":{"allow":["set_closable"],"deny":[]}},"allow-set-content-protected":{"identifier":"allow-set-content-protected","description":"Enables the set_content_protected command without any pre-configured scope.","commands":{"allow":["set_content_protected"],"deny":[]}},"allow-set-cursor-grab":{"identifier":"allow-set-cursor-grab","description":"Enables the set_cursor_grab command without any pre-configured scope.","commands":{"allow":["set_cursor_grab"],"deny":[]}},"allow-set-cursor-icon":{"identifier":"allow-set-cursor-icon","description":"Enables the set_cursor_icon command without any pre-configured scope.","commands":{"allow":["set_cursor_icon"],"deny":[]}},"allow-set-cursor-position":{"identifier":"allow-set-cursor-position","description":"Enables the set_cursor_position command without any pre-configured scope.","commands":{"allow":["set_cursor_position"],"deny":[]}},"allow-set-cursor-visible":{"identifier":"allow-set-cursor-visible","description":"Enables the set_cursor_visible command without any pre-configured scope.","commands":{"allow":["set_cursor_visible"],"deny":[]}},"allow-set-decorations":{"identifier":"allow-set-decorations","description":"Enables the set_decorations command without any pre-configured scope.","commands":{"allow":["set_decorations"],"deny":[]}},"allow-set-effects":{"identifier":"allow-set-effects","description":"Enables the set_effects command without any pre-configured scope.","commands":{"allow":["set_effects"],"deny":[]}},"allow-set-enabled":{"identifier":"allow-set-enabled","description":"Enables the set_enabled command without any pre-configured scope.","commands":{"allow":["set_enabled"],"deny":[]}},"allow-set-focus":{"identifier":"allow-set-focus","description":"Enables the set_focus command without any pre-configured scope.","commands":{"allow":["set_focus"],"deny":[]}},"allow-set-focusable":{"identifier":"allow-set-focusable","description":"Enables the set_focusable command without any pre-configured scope.","commands":{"allow":["set_focusable"],"deny":[]}},"allow-set-fullscreen":{"identifier":"allow-set-fullscreen","description":"Enables the set_fullscreen command without any pre-configured scope.","commands":{"allow":["set_fullscreen"],"deny":[]}},"allow-set-icon":{"identifier":"allow-set-icon","description":"Enables the set_icon command without any pre-configured scope.","commands":{"allow":["set_icon"],"deny":[]}},"allow-set-ignore-cursor-events":{"identifier":"allow-set-ignore-cursor-events","description":"Enables the set_ignore_cursor_events command without any pre-configured scope.","commands":{"allow":["set_ignore_cursor_events"],"deny":[]}},"allow-set-max-size":{"identifier":"allow-set-max-size","description":"Enables the set_max_size command without any pre-configured scope.","commands":{"allow":["set_max_size"],"deny":[]}},"allow-set-maximizable":{"identifier":"allow-set-maximizable","description":"Enables the set_maximizable command without any pre-configured scope.","commands":{"allow":["set_maximizable"],"deny":[]}},"allow-set-min-size":{"identifier":"allow-set-min-size","description":"Enables the set_min_size command without any pre-configured scope.","commands":{"allow":["set_min_size"],"deny":[]}},"allow-set-minimizable":{"identifier":"allow-set-minimizable","description":"Enables the set_minimizable command without any pre-configured scope.","commands":{"allow":["set_minimizable"],"deny":[]}},"allow-set-overlay-icon":{"identifier":"allow-set-overlay-icon","description":"Enables the set_overlay_icon command without any pre-configured scope.","commands":{"allow":["set_overlay_icon"],"deny":[]}},"allow-set-position":{"identifier":"allow-set-position","description":"Enables the set_position command without any pre-configured scope.","commands":{"allow":["set_position"],"deny":[]}},"allow-set-progress-bar":{"identifier":"allow-set-progress-bar","description":"Enables the set_progress_bar command without any pre-configured scope.","commands":{"allow":["set_progress_bar"],"deny":[]}},"allow-set-resizable":{"identifier":"allow-set-resizable","description":"Enables the set_resizable command without any pre-configured scope.","commands":{"allow":["set_resizable"],"deny":[]}},"allow-set-shadow":{"identifier":"allow-set-shadow","description":"Enables the set_shadow command without any pre-configured scope.","commands":{"allow":["set_shadow"],"deny":[]}},"allow-set-simple-fullscreen":{"identifier":"allow-set-simple-fullscreen","description":"Enables the set_simple_fullscreen command without any pre-configured scope.","commands":{"allow":["set_simple_fullscreen"],"deny":[]}},"allow-set-size":{"identifier":"allow-set-size","description":"Enables the set_size command without any pre-configured scope.","commands":{"allow":["set_size"],"deny":[]}},"allow-set-size-constraints":{"identifier":"allow-set-size-constraints","description":"Enables the set_size_constraints command without any pre-configured scope.","commands":{"allow":["set_size_constraints"],"deny":[]}},"allow-set-skip-taskbar":{"identifier":"allow-set-skip-taskbar","description":"Enables the set_skip_taskbar command without any pre-configured scope.","commands":{"allow":["set_skip_taskbar"],"deny":[]}},"allow-set-theme":{"identifier":"allow-set-theme","description":"Enables the set_theme command without any pre-configured scope.","commands":{"allow":["set_theme"],"deny":[]}},"allow-set-title":{"identifier":"allow-set-title","description":"Enables the set_title command without any pre-configured scope.","commands":{"allow":["set_title"],"deny":[]}},"allow-set-title-bar-style":{"identifier":"allow-set-title-bar-style","description":"Enables the set_title_bar_style command without any pre-configured scope.","commands":{"allow":["set_title_bar_style"],"deny":[]}},"allow-set-visible-on-all-workspaces":{"identifier":"allow-set-visible-on-all-workspaces","description":"Enables the set_visible_on_all_workspaces command without any pre-configured scope.","commands":{"allow":["set_visible_on_all_workspaces"],"deny":[]}},"allow-show":{"identifier":"allow-show","description":"Enables the show command without any pre-configured scope.","commands":{"allow":["show"],"deny":[]}},"allow-start-dragging":{"identifier":"allow-start-dragging","description":"Enables the start_dragging command without any pre-configured scope.","commands":{"allow":["start_dragging"],"deny":[]}},"allow-start-resize-dragging":{"identifier":"allow-start-resize-dragging","description":"Enables the start_resize_dragging command without any pre-configured scope.","commands":{"allow":["start_resize_dragging"],"deny":[]}},"allow-theme":{"identifier":"allow-theme","description":"Enables the theme command without any pre-configured scope.","commands":{"allow":["theme"],"deny":[]}},"allow-title":{"identifier":"allow-title","description":"Enables the title command without any pre-configured scope.","commands":{"allow":["title"],"deny":[]}},"allow-toggle-maximize":{"identifier":"allow-toggle-maximize","description":"Enables the toggle_maximize command without any pre-configured scope.","commands":{"allow":["toggle_maximize"],"deny":[]}},"allow-unmaximize":{"identifier":"allow-unmaximize","description":"Enables the unmaximize command without any pre-configured scope.","commands":{"allow":["unmaximize"],"deny":[]}},"allow-unminimize":{"identifier":"allow-unminimize","description":"Enables the unminimize command without any pre-configured scope.","commands":{"allow":["unminimize"],"deny":[]}},"deny-activity-name":{"identifier":"deny-activity-name","description":"Denies the activity_name command without any pre-configured scope.","commands":{"allow":[],"deny":["activity_name"]}},"deny-available-monitors":{"identifier":"deny-available-monitors","description":"Denies the available_monitors command without any pre-configured scope.","commands":{"allow":[],"deny":["available_monitors"]}},"deny-center":{"identifier":"deny-center","description":"Denies the center command without any pre-configured scope.","commands":{"allow":[],"deny":["center"]}},"deny-close":{"identifier":"deny-close","description":"Denies the close command without any pre-configured scope.","commands":{"allow":[],"deny":["close"]}},"deny-create":{"identifier":"deny-create","description":"Denies the create command without any pre-configured scope.","commands":{"allow":[],"deny":["create"]}},"deny-current-monitor":{"identifier":"deny-current-monitor","description":"Denies the current_monitor command without any pre-configured scope.","commands":{"allow":[],"deny":["current_monitor"]}},"deny-cursor-position":{"identifier":"deny-cursor-position","description":"Denies the cursor_position command without any pre-configured scope.","commands":{"allow":[],"deny":["cursor_position"]}},"deny-destroy":{"identifier":"deny-destroy","description":"Denies the destroy command without any pre-configured scope.","commands":{"allow":[],"deny":["destroy"]}},"deny-get-all-windows":{"identifier":"deny-get-all-windows","description":"Denies the get_all_windows command without any pre-configured scope.","commands":{"allow":[],"deny":["get_all_windows"]}},"deny-hide":{"identifier":"deny-hide","description":"Denies the hide command without any pre-configured scope.","commands":{"allow":[],"deny":["hide"]}},"deny-inner-position":{"identifier":"deny-inner-position","description":"Denies the inner_position command without any pre-configured scope.","commands":{"allow":[],"deny":["inner_position"]}},"deny-inner-size":{"identifier":"deny-inner-size","description":"Denies the inner_size command without any pre-configured scope.","commands":{"allow":[],"deny":["inner_size"]}},"deny-internal-toggle-maximize":{"identifier":"deny-internal-toggle-maximize","description":"Denies the internal_toggle_maximize command without any pre-configured scope.","commands":{"allow":[],"deny":["internal_toggle_maximize"]}},"deny-is-always-on-top":{"identifier":"deny-is-always-on-top","description":"Denies the is_always_on_top command without any pre-configured scope.","commands":{"allow":[],"deny":["is_always_on_top"]}},"deny-is-closable":{"identifier":"deny-is-closable","description":"Denies the is_closable command without any pre-configured scope.","commands":{"allow":[],"deny":["is_closable"]}},"deny-is-decorated":{"identifier":"deny-is-decorated","description":"Denies the is_decorated command without any pre-configured scope.","commands":{"allow":[],"deny":["is_decorated"]}},"deny-is-enabled":{"identifier":"deny-is-enabled","description":"Denies the is_enabled command without any pre-configured scope.","commands":{"allow":[],"deny":["is_enabled"]}},"deny-is-focused":{"identifier":"deny-is-focused","description":"Denies the is_focused command without any pre-configured scope.","commands":{"allow":[],"deny":["is_focused"]}},"deny-is-fullscreen":{"identifier":"deny-is-fullscreen","description":"Denies the is_fullscreen command without any pre-configured scope.","commands":{"allow":[],"deny":["is_fullscreen"]}},"deny-is-maximizable":{"identifier":"deny-is-maximizable","description":"Denies the is_maximizable command without any pre-configured scope.","commands":{"allow":[],"deny":["is_maximizable"]}},"deny-is-maximized":{"identifier":"deny-is-maximized","description":"Denies the is_maximized command without any pre-configured scope.","commands":{"allow":[],"deny":["is_maximized"]}},"deny-is-minimizable":{"identifier":"deny-is-minimizable","description":"Denies the is_minimizable command without any pre-configured scope.","commands":{"allow":[],"deny":["is_minimizable"]}},"deny-is-minimized":{"identifier":"deny-is-minimized","description":"Denies the is_minimized command without any pre-configured scope.","commands":{"allow":[],"deny":["is_minimized"]}},"deny-is-resizable":{"identifier":"deny-is-resizable","description":"Denies the is_resizable command without any pre-configured scope.","commands":{"allow":[],"deny":["is_resizable"]}},"deny-is-visible":{"identifier":"deny-is-visible","description":"Denies the is_visible command without any pre-configured scope.","commands":{"allow":[],"deny":["is_visible"]}},"deny-maximize":{"identifier":"deny-maximize","description":"Denies the maximize command without any pre-configured scope.","commands":{"allow":[],"deny":["maximize"]}},"deny-minimize":{"identifier":"deny-minimize","description":"Denies the minimize command without any pre-configured scope.","commands":{"allow":[],"deny":["minimize"]}},"deny-monitor-from-point":{"identifier":"deny-monitor-from-point","description":"Denies the monitor_from_point command without any pre-configured scope.","commands":{"allow":[],"deny":["monitor_from_point"]}},"deny-outer-position":{"identifier":"deny-outer-position","description":"Denies the outer_position command without any pre-configured scope.","commands":{"allow":[],"deny":["outer_position"]}},"deny-outer-size":{"identifier":"deny-outer-size","description":"Denies the outer_size command without any pre-configured scope.","commands":{"allow":[],"deny":["outer_size"]}},"deny-primary-monitor":{"identifier":"deny-primary-monitor","description":"Denies the primary_monitor command without any pre-configured scope.","commands":{"allow":[],"deny":["primary_monitor"]}},"deny-request-user-attention":{"identifier":"deny-request-user-attention","description":"Denies the request_user_attention command without any pre-configured scope.","commands":{"allow":[],"deny":["request_user_attention"]}},"deny-scale-factor":{"identifier":"deny-scale-factor","description":"Denies the scale_factor command without any pre-configured scope.","commands":{"allow":[],"deny":["scale_factor"]}},"deny-scene-identifier":{"identifier":"deny-scene-identifier","description":"Denies the scene_identifier command without any pre-configured scope.","commands":{"allow":[],"deny":["scene_identifier"]}},"deny-set-always-on-bottom":{"identifier":"deny-set-always-on-bottom","description":"Denies the set_always_on_bottom command without any pre-configured scope.","commands":{"allow":[],"deny":["set_always_on_bottom"]}},"deny-set-always-on-top":{"identifier":"deny-set-always-on-top","description":"Denies the set_always_on_top command without any pre-configured scope.","commands":{"allow":[],"deny":["set_always_on_top"]}},"deny-set-background-color":{"identifier":"deny-set-background-color","description":"Denies the set_background_color command without any pre-configured scope.","commands":{"allow":[],"deny":["set_background_color"]}},"deny-set-badge-count":{"identifier":"deny-set-badge-count","description":"Denies the set_badge_count command without any pre-configured scope.","commands":{"allow":[],"deny":["set_badge_count"]}},"deny-set-badge-label":{"identifier":"deny-set-badge-label","description":"Denies the set_badge_label command without any pre-configured scope.","commands":{"allow":[],"deny":["set_badge_label"]}},"deny-set-closable":{"identifier":"deny-set-closable","description":"Denies the set_closable command without any pre-configured scope.","commands":{"allow":[],"deny":["set_closable"]}},"deny-set-content-protected":{"identifier":"deny-set-content-protected","description":"Denies the set_content_protected command without any pre-configured scope.","commands":{"allow":[],"deny":["set_content_protected"]}},"deny-set-cursor-grab":{"identifier":"deny-set-cursor-grab","description":"Denies the set_cursor_grab command without any pre-configured scope.","commands":{"allow":[],"deny":["set_cursor_grab"]}},"deny-set-cursor-icon":{"identifier":"deny-set-cursor-icon","description":"Denies the set_cursor_icon command without any pre-configured scope.","commands":{"allow":[],"deny":["set_cursor_icon"]}},"deny-set-cursor-position":{"identifier":"deny-set-cursor-position","description":"Denies the set_cursor_position command without any pre-configured scope.","commands":{"allow":[],"deny":["set_cursor_position"]}},"deny-set-cursor-visible":{"identifier":"deny-set-cursor-visible","description":"Denies the set_cursor_visible command without any pre-configured scope.","commands":{"allow":[],"deny":["set_cursor_visible"]}},"deny-set-decorations":{"identifier":"deny-set-decorations","description":"Denies the set_decorations command without any pre-configured scope.","commands":{"allow":[],"deny":["set_decorations"]}},"deny-set-effects":{"identifier":"deny-set-effects","description":"Denies the set_effects command without any pre-configured scope.","commands":{"allow":[],"deny":["set_effects"]}},"deny-set-enabled":{"identifier":"deny-set-enabled","description":"Denies the set_enabled command without any pre-configured scope.","commands":{"allow":[],"deny":["set_enabled"]}},"deny-set-focus":{"identifier":"deny-set-focus","description":"Denies the set_focus command without any pre-configured scope.","commands":{"allow":[],"deny":["set_focus"]}},"deny-set-focusable":{"identifier":"deny-set-focusable","description":"Denies the set_focusable command without any pre-configured scope.","commands":{"allow":[],"deny":["set_focusable"]}},"deny-set-fullscreen":{"identifier":"deny-set-fullscreen","description":"Denies the set_fullscreen command without any pre-configured scope.","commands":{"allow":[],"deny":["set_fullscreen"]}},"deny-set-icon":{"identifier":"deny-set-icon","description":"Denies the set_icon command without any pre-configured scope.","commands":{"allow":[],"deny":["set_icon"]}},"deny-set-ignore-cursor-events":{"identifier":"deny-set-ignore-cursor-events","description":"Denies the set_ignore_cursor_events command without any pre-configured scope.","commands":{"allow":[],"deny":["set_ignore_cursor_events"]}},"deny-set-max-size":{"identifier":"deny-set-max-size","description":"Denies the set_max_size command without any pre-configured scope.","commands":{"allow":[],"deny":["set_max_size"]}},"deny-set-maximizable":{"identifier":"deny-set-maximizable","description":"Denies the set_maximizable command without any pre-configured scope.","commands":{"allow":[],"deny":["set_maximizable"]}},"deny-set-min-size":{"identifier":"deny-set-min-size","description":"Denies the set_min_size command without any pre-configured scope.","commands":{"allow":[],"deny":["set_min_size"]}},"deny-set-minimizable":{"identifier":"deny-set-minimizable","description":"Denies the set_minimizable command without any pre-configured scope.","commands":{"allow":[],"deny":["set_minimizable"]}},"deny-set-overlay-icon":{"identifier":"deny-set-overlay-icon","description":"Denies the set_overlay_icon command without any pre-configured scope.","commands":{"allow":[],"deny":["set_overlay_icon"]}},"deny-set-position":{"identifier":"deny-set-position","description":"Denies the set_position command without any pre-configured scope.","commands":{"allow":[],"deny":["set_position"]}},"deny-set-progress-bar":{"identifier":"deny-set-progress-bar","description":"Denies the set_progress_bar command without any pre-configured scope.","commands":{"allow":[],"deny":["set_progress_bar"]}},"deny-set-resizable":{"identifier":"deny-set-resizable","description":"Denies the set_resizable command without any pre-configured scope.","commands":{"allow":[],"deny":["set_resizable"]}},"deny-set-shadow":{"identifier":"deny-set-shadow","description":"Denies the set_shadow command without any pre-configured scope.","commands":{"allow":[],"deny":["set_shadow"]}},"deny-set-simple-fullscreen":{"identifier":"deny-set-simple-fullscreen","description":"Denies the set_simple_fullscreen command without any pre-configured scope.","commands":{"allow":[],"deny":["set_simple_fullscreen"]}},"deny-set-size":{"identifier":"deny-set-size","description":"Denies the set_size command without any pre-configured scope.","commands":{"allow":[],"deny":["set_size"]}},"deny-set-size-constraints":{"identifier":"deny-set-size-constraints","description":"Denies the set_size_constraints command without any pre-configured scope.","commands":{"allow":[],"deny":["set_size_constraints"]}},"deny-set-skip-taskbar":{"identifier":"deny-set-skip-taskbar","description":"Denies the set_skip_taskbar command without any pre-configured scope.","commands":{"allow":[],"deny":["set_skip_taskbar"]}},"deny-set-theme":{"identifier":"deny-set-theme","description":"Denies the set_theme command without any pre-configured scope.","commands":{"allow":[],"deny":["set_theme"]}},"deny-set-title":{"identifier":"deny-set-title","description":"Denies the set_title command without any pre-configured scope.","commands":{"allow":[],"deny":["set_title"]}},"deny-set-title-bar-style":{"identifier":"deny-set-title-bar-style","description":"Denies the set_title_bar_style command without any pre-configured scope.","commands":{"allow":[],"deny":["set_title_bar_style"]}},"deny-set-visible-on-all-workspaces":{"identifier":"deny-set-visible-on-all-workspaces","description":"Denies the set_visible_on_all_workspaces command without any pre-configured scope.","commands":{"allow":[],"deny":["set_visible_on_all_workspaces"]}},"deny-show":{"identifier":"deny-show","description":"Denies the show command without any pre-configured scope.","commands":{"allow":[],"deny":["show"]}},"deny-start-dragging":{"identifier":"deny-start-dragging","description":"Denies the start_dragging command without any pre-configured scope.","commands":{"allow":[],"deny":["start_dragging"]}},"deny-start-resize-dragging":{"identifier":"deny-start-resize-dragging","description":"Denies the start_resize_dragging command without any pre-configured scope.","commands":{"allow":[],"deny":["start_resize_dragging"]}},"deny-theme":{"identifier":"deny-theme","description":"Denies the theme command without any pre-configured scope.","commands":{"allow":[],"deny":["theme"]}},"deny-title":{"identifier":"deny-title","description":"Denies the title command without any pre-configured scope.","commands":{"allow":[],"deny":["title"]}},"deny-toggle-maximize":{"identifier":"deny-toggle-maximize","description":"Denies the toggle_maximize command without any pre-configured scope.","commands":{"allow":[],"deny":["toggle_maximize"]}},"deny-unmaximize":{"identifier":"deny-unmaximize","description":"Denies the unmaximize command without any pre-configured scope.","commands":{"allow":[],"deny":["unmaximize"]}},"deny-unminimize":{"identifier":"deny-unminimize","description":"Denies the unminimize command without any pre-configured scope.","commands":{"allow":[],"deny":["unminimize"]}}},"permission_sets":{},"global_scope_schema":null},"dialog":{"default_permission":{"identifier":"default","description":"This permission set configures the types of dialogs\navailable from the dialog plugin.\n\n#### Granted Permissions\n\nAll dialog types are enabled.\n\n\n","permissions":["allow-message","allow-save","allow-open"]},"permissions":{"allow-ask":{"identifier":"allow-ask","description":"Enables the ask command without any pre-configured scope. (**DEPRECATED**: This is now an alias to `allow-message` and will be removed in v3)","commands":{"allow":["message"],"deny":[]}},"allow-confirm":{"identifier":"allow-confirm","description":"Enables the confirm command without any pre-configured scope. (**DEPRECATED**: This is now an alias to `allow-message` and will be removed in v3)","commands":{"allow":["message"],"deny":[]}},"allow-message":{"identifier":"allow-message","description":"Enables the message command without any pre-configured scope.","commands":{"allow":["message"],"deny":[]}},"allow-open":{"identifier":"allow-open","description":"Enables the open command without any pre-configured scope.","commands":{"allow":["open"],"deny":[]}},"allow-save":{"identifier":"allow-save","description":"Enables the save command without any pre-configured scope.","commands":{"allow":["save"],"deny":[]}},"deny-ask":{"identifier":"deny-ask","description":"Denies the ask command without any pre-configured scope. (**DEPRECATED**: This is now an alias to `deny-message` and will be removed in v3)","commands":{"allow":[],"deny":["message"]}},"deny-confirm":{"identifier":"deny-confirm","description":"Denies the confirm command without any pre-configured scope. (**DEPRECATED**: This is now an alias to `deny-message` and will be removed in v3)","commands":{"allow":[],"deny":["message"]}},"deny-message":{"identifier":"deny-message","description":"Denies the message command without any pre-configured scope.","commands":{"allow":[],"deny":["message"]}},"deny-open":{"identifier":"deny-open","description":"Denies the open command without any pre-configured scope.","commands":{"allow":[],"deny":["open"]}},"deny-save":{"identifier":"deny-save","description":"Denies the save command without any pre-configured scope.","commands":{"allow":[],"deny":["save"]}}},"permission_sets":{},"global_scope_schema":null},"global-shortcut":{"default_permission":{"identifier":"default","description":"No features are enabled by default, as we believe\nthe shortcuts can be inherently dangerous and it is\napplication specific if specific shortcuts should be\nregistered or unregistered.\n","permissions":[]},"permissions":{"allow-is-registered":{"identifier":"allow-is-registered","description":"Enables the is_registered command without any pre-configured scope.","commands":{"allow":["is_registered"],"deny":[]}},"allow-register":{"identifier":"allow-register","description":"Enables the register command without any pre-configured scope.","commands":{"allow":["register"],"deny":[]}},"allow-register-all":{"identifier":"allow-register-all","description":"Enables the register_all command without any pre-configured scope.","commands":{"allow":["register_all"],"deny":[]}},"allow-unregister":{"identifier":"allow-unregister","description":"Enables the unregister command without any pre-configured scope.","commands":{"allow":["unregister"],"deny":[]}},"allow-unregister-all":{"identifier":"allow-unregister-all","description":"Enables the unregister_all command without any pre-configured scope.","commands":{"allow":["unregister_all"],"deny":[]}},"deny-is-registered":{"identifier":"deny-is-registered","description":"Denies the is_registered command without any pre-configured scope.","commands":{"allow":[],"deny":["is_registered"]}},"deny-register":{"identifier":"deny-register","description":"Denies the register command without any pre-configured scope.","commands":{"allow":[],"deny":["register"]}},"deny-register-all":{"identifier":"deny-register-all","description":"Denies the register_all command without any pre-configured scope.","commands":{"allow":[],"deny":["register_all"]}},"deny-unregister":{"identifier":"deny-unregister","description":"Denies the unregister command without any pre-configured scope.","commands":{"allow":[],"deny":["unregister"]}},"deny-unregister-all":{"identifier":"deny-unregister-all","description":"Denies the unregister_all command without any pre-configured scope.","commands":{"allow":[],"deny":["unregister_all"]}}},"permission_sets":{},"global_scope_schema":null}}
src/styles/editor.css:189:/* ── 活源码装饰两态（移植自 md-bundle decorations/theme.ts） ──────────
src/editors/decorations/theme.ts:1:/* 活源码装饰主题（精简自 md-bundle packages/editor/src/decorations/theme.ts）。

exec
/bin/zsh -c "rg -n 'defaultNewDocFormat|exportFormat|env\\.toml|permissions' src src-tauri --glob '"'!src-tauri/gen/**'"' 2>/dev/null | sed -n '1,180p'
rg -n 'manifest.*source|source.*builtin|source.*ai|source.*user' src-tauri/src/extension_packages.rs src/components/SettingsView.tsx | sed -n '1,160p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src-tauri/capabilities/default.json:5:  "permissions": [
src-tauri/src/extension_packages.rs:131:    if !matches!(manifest.source.as_str(), "builtin" | "ai" | "user") {
src-tauri/src/extension_packages.rs:133:            "manifest.source",
src-tauri/src/extension_packages.rs:134:            format!("source {:?} 不属于 builtin|ai|user", manifest.source),
src-tauri/src/extension_packages.rs:190:        source: manifest.source,
src-tauri/src/extension_packages.rs:206:            source: "builtin".into(),
src-tauri/src/extension_packages.rs:216:            source: "builtin".into(),
src-tauri/src/extension_packages.rs:418:        source: manifest.source,
src-tauri/src/extension_packages.rs:699:        source: "ai".into(),
src-tauri/src/extension_packages.rs:723:        source: "ai".into(),
src-tauri/src/extension_packages.rs:740:/// 内置扩展（`source == "builtin"`）不注入；停用的扩展不注入；无扩展时返回空串。
src-tauri/src/extension_packages.rs:744:        if !package.enabled || package.source == "builtin" {
src-tauri/src/extension_packages.rs:912:        assert_eq!(builtin.source, "builtin");
src-tauri/src/extension_packages.rs:931:        assert!(packages.iter().all(|p| p.source == "builtin"));
src-tauri/src/extension_packages.rs:942:            r#"{"id":"my-ext","name":"我的扩展","version":"0.1.0","description":"d","source":"user"}"#,
src-tauri/src/extension_packages.rs:952:        assert_eq!(package.source, "user");
src-tauri/src/extension_packages.rs:980:                r#"{{"id":"{BUILTIN_READING}","name":"x","version":"0.1.0","description":"d","source":"user"}}"#
src-tauri/src/extension_packages.rs:999:            r#"{"id":"dup","name":"新版本","version":"2.0.0","description":"d","source":"user"}"#,
src-tauri/src/extension_packages.rs:1045:            r#"{"id":"keep-me","name":"新版本","version":"2.0.0","description":"d","source":"user"}"#,
src-tauri/src/extension_packages.rs:1085:            r#"{"id":"Bad_ID","name":"x","version":"1.0.0","description":"d","source":"user"}"#,
src-tauri/src/extension_packages.rs:1096:            r#"{"id":"no-skill","name":"x","version":"1.0.0","description":"d","source":"user"}"#,
src-tauri/src/extension_packages.rs:1193:        assert_eq!(package.source, "user");
src-tauri/src/extension_packages.rs:1219:        assert_eq!(package.source, "ai");
src-tauri/src/extension_packages.rs:1331:        let manifest = r#"{"id":"nested-ext","name":"嵌套扩展","version":"0.1.0","description":"d","source":"user"}"#;
src/components/SettingsView.tsx:68:  source: "builtin" | "ai" | "user";
src/components/SettingsView.tsx:459:              const isBuiltin = pkg.source === "builtin";

codex
## 总体判定：需修订

当前稿不能作为 OpenSpec 拆票基线。存在多处硬事实错误、插件分类自相矛盾，以及权限、生命周期、安全模型缺失。尤其是 A2、A4、C3、B8 的现状描述与本仓库代码不符。

## 事实核查（逐项，附证据）

1. **“已通过独立对抗评审”不成立。**  
   文档开头称“已通过独立对抗评审”，但 [01-plugin-capability-extraction.md:139](/Users/mason/ToHighs/clairis-wt-design-plan/docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:139) 的评审记录明确写“总体判定：需修订（已按意见全部修订）”。不应以“通过”状态标记。

2. **A1 的“同步一次性加载”不成立。**  
   当前启动流程只启动配置 watcher 和写入 `SKILL.md`，没有启动时扫描扩展包：[lib.rs:194-195](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/lib.rs:194)。扩展包实际是在打开设置页时调用 `list_extension_packages`，或在每轮 AI 对话时调用 `enabled_skill_context_at`：[SettingsView.tsx:233-249](/Users/mason/ToHighs/clairis-wt-design-plan/src/components/SettingsView.tsx:233)、[ai_agent_cmd.rs:45-51](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/commands/ai_agent_cmd.rs:45)。底层扫描函数虽同步，Tauri 命令通过 `spawn_blocking` 调用，不是“启动时一次性加载”。SKILL.md 修改甚至会在下一次 AI 对话时重新读取，并非全部“重启生效”。

3. **A2 是硬伤，引用的行号和机制均错误。**  
   文档称 `SKILL_MAP` 位于 `config.rs:977-1031`，实际该区间是 `load_config`、保存、快照和 keyring 逻辑。真实的 `seed_skill_map` 在 [config.rs:892-903](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/config.rs:892)，`SKILL_MAP` 在 [config.rs:905-943](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/config.rs:905)。  
   更关键的是，`SKILL_MAP` 只是一份写入 `skills/biaoyue/SKILL.md` 的配置说明，代码中没有任何读取并注入 AI 的调用。实际注入的是 `extension_packages::enabled_skill_context_at`：[extension_packages.rs:741-749](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/extension_packages.rs:741)。因此“A2 已把 AGENT 能力声明化并已落地”不成立。

4. **A3 的“仅颜色 token”表述不准确。**  
   Rust 和前端白名单均包含 `radius`、`shadow`：[extensions.rs:70-84](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/extensions.rs:70)、[theme-tokens.ts:14-28](/Users/mason/ToHighs/clairis-wt-design-plan/src/lib/extensions/theme-tokens.ts:14)。但所有值又统一经过颜色校验：[extensions.rs:103-125](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/extensions.rs:103)、[extensions.rs:346-349](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/extensions.rs:346)。  
   所以“用户实际能改颜色值”基本成立，但“白名单仅颜色 token”不成立；当前白名单与值校验还存在潜在漂移。“无 `themeProvider`、无装饰主题切换”则可确认。

5. **A4 一半错误。**  
   `SettingsView` 直接消费并切换 capabilities，这部分成立：[SettingsView.tsx:862-866](/Users/mason/ToHighs/clairis-wt-design-plan/src/components/SettingsView.tsx:862)、[SettingsView.tsx:1638-1647](/Users/mason/ToHighs/clairis-wt-design-plan/src/components/SettingsView.tsx:1638)。  
   但“AI 工具完全由 SKILL.md 驱动”错误。AI 工具由固定代码 schema 定义，始终只有 `read_config`、`patch_config`、`list_snapshots`：[ai_agent.rs:188-223](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/ai_agent.rs:188)、[ai_agent.rs:236-274](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/ai_agent.rs:236)。SKILL.md 只是作为背景文本注入，不注册、不启停、不限制工具。

6. **A5 成立。**  
   snippets/templates 由 `extensions.rs` 扫描：[extensions.rs:236-311](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/extensions.rs:236)。App 启动加载模板和主题 token，[App.tsx:222-228](/Users/mason/ToHighs/clairis-wt-design-plan/src/App.tsx:222)；snippets 注入斜杠菜单，[ContentArea.tsx:608-612](/Users/mason/ToHighs/clairis-wt-design-plan/src/components/Content/ContentArea.tsx:608)；模板选择器存在，[App.tsx:992-998](/Users/mason/ToHighs/clairis-wt-design-plan/src/App.tsx:992)。

7. **B1 基本成立。**  
   `selectionToolbar: "roulette" | "capsule"` 存在，[types/index.ts:74-75](/Users/mason/ToHighs/clairis-wt-design-plan/src/types/index.ts:74)，设置页可切换，[SettingsView.tsx:1382-1404](/Users/mason/ToHighs/clairis-wt-design-plan/src/components/SettingsView.tsx:1382)。胶囊按钮集确实是硬编码，[floating-toolbar.ts:655-685](/Users/mason/ToHighs/clairis-wt-design-plan/src/editors/orchestration/floating-toolbar.ts:655)。

8. **B2/B3 行号错误，且“可自定义”被夸大。**  
   `roulette_sectors` 实际在 [config.rs:64](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/config.rs:64)，文档写的 `config.rs:65` 是注释；`html_toolbar_items` 实际在 [config.rs:67](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/config.rs:67)，文档写的 `:68` 同样是注释。  
   当前配置文件只能选择、排序已有 ID，不能新增扇区或工具条动作。轮盘 ID 分散在 `ROOT_SECTORS`、`SettingsView.ROULETTE_SECTOR_META` 和 Rust `ALLOWED` 三处：[roulette.ts:65-74](/Users/mason/ToHighs/clairis-wt-design-plan/src/editors/orchestration/roulette.ts:65)、[SettingsView.tsx:171-180](/Users/mason/ToHighs/clairis-wt-design-plan/src/components/SettingsView.tsx:171)、[config.rs:658-681](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/config.rs:658)。工具条同样存在 `HTML_TOOLBAR_ITEMS` 与 Rust `ALLOWED` 两份注册表：[slots.ts:10-33](/Users/mason/ToHighs/clairis-wt-design-plan/src/editors/orchestration/slots.ts:10)、[config.rs:712-748](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/config.rs:712)。这也不符合“单一落点”。

9. **B4 只描述了三张格头菜单表，不能代表整个菜单结构。**  
   `PANE_MENU_ITEMS`、`EXPORT_MENU_ITEMS`、`AI_PANE_MENU_ITEMS` 确实存在：[paneHeaderMenu.ts:45-71](/Users/mason/ToHighs/clairis-wt-design-plan/src/lib/paneHeaderMenu.ts:45)。但页签右键菜单大量项目直接内联在 `TabBar.tsx`，[TabBar.tsx:642-930](/Users/mason/ToHighs/clairis-wt-design-plan/src/components/TabBar.tsx:642)，状态栏和阅读空间也有独立菜单。若 B4 指“格头菜单”，应缩窄名称；若指“菜单结构”，清单不完整。

10. **B5、B6 的代码常量判断成立。**  
    `src/ui/icons.ts` 和 `src/editors/icons.ts` 都是静态注册表；`SHORTCUTS`、`ShortcutDef`、可选 `scope` 也与文档一致：[shortcuts.ts:22-39](/Users/mason/ToHighs/clairis-wt-design-plan/src/lib/shortcuts.ts:22)、[shortcuts.ts:68](/Users/mason/ToHighs/clairis-wt-design-plan/src/lib/shortcuts.ts:68)。但这两者目前都不是可由数据文件扩展的注册机制。

11. **B7 基本成立。**  
    `EXPORT_MENU_ITEMS` 是代码常量，[paneHeaderMenu.ts:56-63](/Users/mason/ToHighs/clairis-wt-design-plan/src/lib/paneHeaderMenu.ts:56)，导出动作通过固定 `ExportMenuAction` 分发，[exportActions.ts:28-110](/Users/mason/ToHighs/clairis-wt-design-plan/src/lib/exportActions.ts:28)。未发现持久化导出设置。

12. **B8 错误：“无预设集合”不成立。**  
    阅读字号已有固定预设 `FONT_SIZES = [15, 16, 17, 18, 19, 21]`，[SettingsView.tsx:141](/Users/mason/ToHighs/clairis-wt-design-plan/src/components/SettingsView.tsx:141)，阅读字号 UI 直接消费：[SettingsView.tsx:1242-1260](/Users/mason/ToHighs/clairis-wt-design-plan/src/components/SettingsView.tsx:1242)。行宽还有四个命名预设，[readerWidth.ts:6-11](/Users/mason/ToHighs/clairis-wt-design-plan/src/lib/readerWidth.ts:6)。正确表述应为“已有代码内固定预设，需数据化”，而不是“无预设集合”。

13. **B9 部分成立，但重复计算。**  
    `defaultNewDocFormat` 确实不存在，`defaultSavePath` 存在：[config.rs:68-71](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/config.rs:68)。但默认保存目录已有完整设置和消费路径，[SettingsView.tsx:643-645](/Users/mason/ToHighs/clairis-wt-design-plan/src/components/SettingsView.tsx:643)。新文档模板则已由 A5 的 templates 覆盖。B9 不是一张独立能力，应在明确“默认模板选择/默认 frontmatter”增量后再保留。

14. **C3 错误。**  
    `capabilities` 只包含 `math`、`code-highlight`、`mermaid`、`preview-zoom`，不管理 preview/edit/source 模式切换：[capabilities.ts:10-29](/Users/mason/ToHighs/clairis-wt-design-plan/src/lib/capabilities.ts:10)。模式由页签或面板的 `editorMode` 和 `setEditorMode` 管理，[stores/index.ts:707-725](/Users/mason/ToHighs/clairis-wt-design-plan/src/stores/index.ts:707)。因此“模式切换/渲染管线运行时开关由 capabilities 统一管理”是虚构结论。

15. **`env.toml` 是虚构落点。**  
    当前扩展加载器只读取 `manifest.json` 和 `SKILL.md`：[extension_packages.rs:142-157](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/extension_packages.rs:142)。仓库中没有 `env.toml`，也没有解析 `permissions` 的代码。Tauri capability 配置是另一套窗口级 ACL，[default.json:1-24](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/capabilities/default.json:1)，不能自动绑定到插件 manifest。

16. **当前 manifest 实际字段与提案不兼容。**  
    当前结构是 `id/name/version/description/source`，[extension_packages.rs:48-57](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/extension_packages.rs:48)。提案改为 `type` 且删掉 `source`，但 `source` 目前参与“内置/AI/用户”标签和是否注入 AI 的判断：[extension_packages.rs:740-745](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/extension_packages.rs:740)、[SettingsView.tsx:79-83](/Users/mason/ToHighs/clairis-wt-design-plan/src/components/SettingsView.tsx:79)。没有迁移方案会直接破坏现有包。

17. **目录提案与现状脱节。**  
    当前扩展包位于 `<config_base>/extensions/<id>/`：[extension_packages.rs:1-12](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/extension_packages.rs:1)、[:96-102](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/extension_packages.rs:96)。提案写 `data/plugins/`，但仓库没有该目录语义，也未说明它相对于 `config_base` 的位置、迁移和兼容策略。

18. **4.4 与真实注入行为不一致。**  
    当前 `enabled_skill_context_at` 明确排除 builtin，[extension_packages.rs:739-746](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/extension_packages.rs:739)，而文档称聚合“所有已启用技能型插件 + 内置 SKILL_MAP”。当前也没有任何代码读取 `SKILL_MAP`。这部分描述不能作为实现依据。

## 逻辑与遗漏问题（编号）

1. **插件分类不互斥。**  
   文档定义三类互斥，但 A1 的现有扩展包本质上是 `manifest + SKILL.md`，同时具有注册包和技能贡献；A4 的 `CAPABILITY_META` 又是代码内运行时注册表，不符合“manifest + JSON”的注册型定义。应按“包类型”与“贡献点”拆成两个维度，例如一个包可贡献 `skill`、`theme-tokens`、`snippets`、`menu` 等，而不是强行塞入单一 `type`。

2. **大量“已插件化”实际上只是“已配置化”。**  
   A3、A4、A5、B2、B3 主要是数据文件或设置字段，没有独立包身份、manifest、启用状态、版本兼容、来源或升级语义。把它们统称为插件，会造成“配置值”和“打包加载单元”混淆，也使“独立升级”目标没有实现对象。

3. **现有扩展包并不支持提案中的三种形态。**  
   当前 `read_package_dir` 强制每个包同时具备 `manifest.json` 和 `SKILL.md`。纯配置型包、纯注册型包目前都会被判为缺 SKILL。若不先重构加载器，4.1 目录结构无法实现。

4. **生命周期裁定过度统一。**  
   不同贡献点的读取时机不同：snippets/templates/theme 在 App 或编辑器加载时读取，扩展包列表在设置页读取，SKILL 在每轮 AI 调用时读取。不能用一个“重启生效”覆盖全部。应分别定义启动、页面打开、下一次调用、重启四种生效时点。

5. **权限模型没有可执行语义。**  
   即使增加 `permissions: ["filesystem"]`，当前插件也没有执行环境可供隔离；文件访问是宿主加载器完成的。只校验声明不能阻止读取或写入。应改为宿主侧的数据访问矩阵，例如“仅读取自身包目录”“不得读取用户文档”“仅贡献允许的 token 和动作 ID”。Tauri ACL 不应冒充插件 ACL。

6. **菜单、图标、工具条、导出只设计了“配置”，没有设计“命令绑定”。**  
   数据文件只能提供现有 action ID 的启停和排序。新增菜单项、导出格式、图标概念若没有命令 allowlist、冲突规则和渲染器注册，就会变成无效配置。需要显式定义 ID 白名单、未知 ID 告警、重复 ID 覆盖规则。

7. **AGENT 写通路缺失。**  
   当前 AI 只有 `read_config`、`patch_config`、`list_snapshots` 三个工具，无法写 `data/plugins/`、`user/commands.json` 或其他新数据文件。文档的“AGENT 自定义”大量依赖尚不存在的写通路，却没有列入实施批次。4.7 所说“AGENT 可生成任意插件”也与现状不符：当前生成器只构造固定模板包，不执行真实模型生成。

8. **安全结论“最坏没生效”错误。**  
   用户/AI 扩展的 SKILL 内容被作为 `system` 消息插入：[ai_agent_cmd.rs:47-51](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/commands/ai_agent_cmd.rs:47)，而 AI 又拥有可修改配置的 `patch_config` 工具。恶意 SKILL 可以通过提示注入诱导配置修改，不只是“没生效”。缺少不可信内容隔离、工具授权、确认策略、体积与 token 上限。

9. **错误告警没有实际承载面。**  
   扩展包单包失败目前只写 tracing warn，[extension_packages.rs:256-270](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/extension_packages.rs:256)，`list_extension_packages` 只返回包数组，不返回 warnings；设置页无法展示具体失败原因。snippets/templates 的 warnings 也未被 App 展示。§4.7 声称“用户可见聚合告警”，但缺少返回结构和 UI 落点。

10. **“单一落点”与目录设计冲突。**  
   一方面说数据文件是唯一配置落点，另一方面又计划把能力打包到 `data/plugins/`，同时 A3/A5 仍在 config 根目录，B2/B3 又在 `user/settings.json`。必须明确“插件包、贡献数据、有效配置、运行时状态”各自唯一归属。

11. **缺少 data-surface 六栏表。**  
   文档命中配置、主题、图标、菜单、快捷键、轮盘、开关等明确信号，但全文没有 `## 数据面` 六栏表。按仓库约束，在进入拆票前必须补规格、存储、校验、桥接、消费、回滚六行。

12. **升级与回滚只写了目标，没有实现设计。**  
   现有导入替换流程删除旧目录后再 rename，[extension_packages.rs:400-410](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/extension_packages.rs:400)。如果 rename 失败，旧版本可能已经丢失。提案承诺“独立升级”，却未定义兼容性、失败回滚、降级和 schema migration。

13. **批次划分存在重复建设和范围混杂。**  
   B9 部分重复 A5 与现有 `defaultSavePath`；第一批同时修改 manifest、权限、capabilities 分类和 settings 字段，缺少可独立验收的纵向切片。每批应在实现前明确用户可见结果、数据落点和回滚方式。

## 修订建议（按优先级）

1. **P0：先重写事实基线和总体状态。**  
   修正 A2 的 `SKILL_MAP` 机制、A4 的 AI 工具说明、C3 的模式管理、B8 的预设判断及所有错误行号；在文档与实际代码一致前，状态改回“需修订”。

2. **P0：重构插件模型为“包 + 贡献点”。**  
   建议 manifest 至少包含 `schemaVersion/id/name/version/description/source/contributes/permissions`，一个包可以贡献多个 `skill/menu/theme/snippets/...`。不要继续使用互斥单值 `type` 承载所有语义，也不要删除现有 `source` 字段。

3. **P0：定义 manifest v2 迁移。**  
   明确旧字段保留、缺失 `source` 的兼容策略、未知字段处理、旧 `<config_base>/extensions/` 与新目录双读迁移窗口。优先保留现有 `extensions/` 物理目录，或在迁移期同时扫描两者；不要直接引入含义不明的 `data/plugins/`。

4. **P0：删除虚构权限，改为宿主可执行的访问矩阵。**  
   删除 `env.toml` 说法。逐贡献点定义允许读取的文件、允许贡献的 ID、是否允许触发命令、是否允许进入 AI 上下文。权限校验必须在宿主加载器执行，并与 Tauri ACL 明确区分。

5. **P0：补齐 SKILL 安全设计。**  
   将用户 SKILL 视为不可信内容，不允许无约束地改变工具权限；规定最大文件体积、聚合 token 预算、重复/冲突处理、提示注入边界。涉及 `patch_config` 等写工具时要求插件级授权或用户确认。

6. **P1：为每个能力建立单一注册表。**  
   先把轮盘的 `ROOT_SECTORS`、设置页元数据和 Rust allowlist 收口；工具条亦同。随后再允许数据文件选择、排序或扩展这些 ID。菜单、图标、导出必须使用同一套 allowlist 和冲突规则。

7. **P1：重新界定 B7、B8、B9。**  
   B8 改为“固定预设集合代码化，迁入数据文件”；B9 仅保留真正增量，例如“默认模板选择、默认 frontmatter”，并将 `defaultSavePath`、已有 templates 明确标为已落地。B7 应给独立文件迁移理由，否则保留 `settings.json`。

8. **P1：拆分生命周期与错误契约。**  
   对每个贡献点分别定义“启动读取、打开时读取、每轮读取、需重启”；统一返回 `PluginLoadReport` 或等价结构，包含成功项、跳过项、原因和聚合告警。设置页必须能显示失败包及原因。

9. **P1：补数据面六栏表和票级覆盖。**  
   在进入 OpenSpec change 前新增完整 `## 数据面` 表，覆盖规格、存储、校验、桥接、消费、回滚；随后运行 `cw-data-surface.sh new/tickets/diff`。

10. **P1：增加可执行验收。**  
    至少覆盖：semantic-invalid manifest、目录名与 id 冲突、内置 id 冲突、未知 contribution point、未知 action ID、重复 ID、超大 SKILL、恶意提示、损坏包不影响其他包、旧 manifest 迁移、升级失败保留旧版本。

11. **P2：重排批次。**  
    建议顺序为：manifest/加载器兼容与安全基线 → 统一现有注册表 → 配置型贡献点 → 技能/slash 写通路 → 热加载评估。当前“第一批”范围过宽，无法独立验收。
tokens used
254,925
## 总体判定：需修订

当前稿不能作为 OpenSpec 拆票基线。存在多处硬事实错误、插件分类自相矛盾，以及权限、生命周期、安全模型缺失。尤其是 A2、A4、C3、B8 的现状描述与本仓库代码不符。

## 事实核查（逐项，附证据）

1. **“已通过独立对抗评审”不成立。**  
   文档开头称“已通过独立对抗评审”，但 [01-plugin-capability-extraction.md:139](/Users/mason/ToHighs/clairis-wt-design-plan/docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:139) 的评审记录明确写“总体判定：需修订（已按意见全部修订）”。不应以“通过”状态标记。

2. **A1 的“同步一次性加载”不成立。**  
   当前启动流程只启动配置 watcher 和写入 `SKILL.md`，没有启动时扫描扩展包：[lib.rs:194-195](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/lib.rs:194)。扩展包实际是在打开设置页时调用 `list_extension_packages`，或在每轮 AI 对话时调用 `enabled_skill_context_at`：[SettingsView.tsx:233-249](/Users/mason/ToHighs/clairis-wt-design-plan/src/components/SettingsView.tsx:233)、[ai_agent_cmd.rs:45-51](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/commands/ai_agent_cmd.rs:45)。底层扫描函数虽同步，Tauri 命令通过 `spawn_blocking` 调用，不是“启动时一次性加载”。SKILL.md 修改甚至会在下一次 AI 对话时重新读取，并非全部“重启生效”。

3. **A2 是硬伤，引用的行号和机制均错误。**  
   文档称 `SKILL_MAP` 位于 `config.rs:977-1031`，实际该区间是 `load_config`、保存、快照和 keyring 逻辑。真实的 `seed_skill_map` 在 [config.rs:892-903](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/config.rs:892)，`SKILL_MAP` 在 [config.rs:905-943](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/config.rs:905)。  
   更关键的是，`SKILL_MAP` 只是一份写入 `skills/biaoyue/SKILL.md` 的配置说明，代码中没有任何读取并注入 AI 的调用。实际注入的是 `extension_packages::enabled_skill_context_at`：[extension_packages.rs:741-749](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/extension_packages.rs:741)。因此“A2 已把 AGENT 能力声明化并已落地”不成立。

4. **A3 的“仅颜色 token”表述不准确。**  
   Rust 和前端白名单均包含 `radius`、`shadow`：[extensions.rs:70-84](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/extensions.rs:70)、[theme-tokens.ts:14-28](/Users/mason/ToHighs/clairis-wt-design-plan/src/lib/extensions/theme-tokens.ts:14)。但所有值又统一经过颜色校验：[extensions.rs:103-125](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/extensions.rs:103)、[extensions.rs:346-349](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/extensions.rs:346)。  
   所以“用户实际能改颜色值”基本成立，但“白名单仅颜色 token”不成立；当前白名单与值校验还存在潜在漂移。“无 `themeProvider`、无装饰主题切换”则可确认。

5. **A4 一半错误。**  
   `SettingsView` 直接消费并切换 capabilities，这部分成立：[SettingsView.tsx:862-866](/Users/mason/ToHighs/clairis-wt-design-plan/src/components/SettingsView.tsx:862)、[SettingsView.tsx:1638-1647](/Users/mason/ToHighs/clairis-wt-design-plan/src/components/SettingsView.tsx:1638)。  
   但“AI 工具完全由 SKILL.md 驱动”错误。AI 工具由固定代码 schema 定义，始终只有 `read_config`、`patch_config`、`list_snapshots`：[ai_agent.rs:188-223](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/ai_agent.rs:188)、[ai_agent.rs:236-274](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/ai_agent.rs:236)。SKILL.md 只是作为背景文本注入，不注册、不启停、不限制工具。

6. **A5 成立。**  
   snippets/templates 由 `extensions.rs` 扫描：[extensions.rs:236-311](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/extensions.rs:236)。App 启动加载模板和主题 token，[App.tsx:222-228](/Users/mason/ToHighs/clairis-wt-design-plan/src/App.tsx:222)；snippets 注入斜杠菜单，[ContentArea.tsx:608-612](/Users/mason/ToHighs/clairis-wt-design-plan/src/components/Content/ContentArea.tsx:608)；模板选择器存在，[App.tsx:992-998](/Users/mason/ToHighs/clairis-wt-design-plan/src/App.tsx:992)。

7. **B1 基本成立。**  
   `selectionToolbar: "roulette" | "capsule"` 存在，[types/index.ts:74-75](/Users/mason/ToHighs/clairis-wt-design-plan/src/types/index.ts:74)，设置页可切换，[SettingsView.tsx:1382-1404](/Users/mason/ToHighs/clairis-wt-design-plan/src/components/SettingsView.tsx:1382)。胶囊按钮集确实是硬编码，[floating-toolbar.ts:655-685](/Users/mason/ToHighs/clairis-wt-design-plan/src/editors/orchestration/floating-toolbar.ts:655)。

8. **B2/B3 行号错误，且“可自定义”被夸大。**  
   `roulette_sectors` 实际在 [config.rs:64](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/config.rs:64)，文档写的 `config.rs:65` 是注释；`html_toolbar_items` 实际在 [config.rs:67](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/config.rs:67)，文档写的 `:68` 同样是注释。  
   当前配置文件只能选择、排序已有 ID，不能新增扇区或工具条动作。轮盘 ID 分散在 `ROOT_SECTORS`、`SettingsView.ROULETTE_SECTOR_META` 和 Rust `ALLOWED` 三处：[roulette.ts:65-74](/Users/mason/ToHighs/clairis-wt-design-plan/src/editors/orchestration/roulette.ts:65)、[SettingsView.tsx:171-180](/Users/mason/ToHighs/clairis-wt-design-plan/src/components/SettingsView.tsx:171)、[config.rs:658-681](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/config.rs:658)。工具条同样存在 `HTML_TOOLBAR_ITEMS` 与 Rust `ALLOWED` 两份注册表：[slots.ts:10-33](/Users/mason/ToHighs/clairis-wt-design-plan/src/editors/orchestration/slots.ts:10)、[config.rs:712-748](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/config.rs:712)。这也不符合“单一落点”。

9. **B4 只描述了三张格头菜单表，不能代表整个菜单结构。**  
   `PANE_MENU_ITEMS`、`EXPORT_MENU_ITEMS`、`AI_PANE_MENU_ITEMS` 确实存在：[paneHeaderMenu.ts:45-71](/Users/mason/ToHighs/clairis-wt-design-plan/src/lib/paneHeaderMenu.ts:45)。但页签右键菜单大量项目直接内联在 `TabBar.tsx`，[TabBar.tsx:642-930](/Users/mason/ToHighs/clairis-wt-design-plan/src/components/TabBar.tsx:642)，状态栏和阅读空间也有独立菜单。若 B4 指“格头菜单”，应缩窄名称；若指“菜单结构”，清单不完整。

10. **B5、B6 的代码常量判断成立。**  
    `src/ui/icons.ts` 和 `src/editors/icons.ts` 都是静态注册表；`SHORTCUTS`、`ShortcutDef`、可选 `scope` 也与文档一致：[shortcuts.ts:22-39](/Users/mason/ToHighs/clairis-wt-design-plan/src/lib/shortcuts.ts:22)、[shortcuts.ts:68](/Users/mason/ToHighs/clairis-wt-design-plan/src/lib/shortcuts.ts:68)。但这两者目前都不是可由数据文件扩展的注册机制。

11. **B7 基本成立。**  
    `EXPORT_MENU_ITEMS` 是代码常量，[paneHeaderMenu.ts:56-63](/Users/mason/ToHighs/clairis-wt-design-plan/src/lib/paneHeaderMenu.ts:56)，导出动作通过固定 `ExportMenuAction` 分发，[exportActions.ts:28-110](/Users/mason/ToHighs/clairis-wt-design-plan/src/lib/exportActions.ts:28)。未发现持久化导出设置。

12. **B8 错误：“无预设集合”不成立。**  
    阅读字号已有固定预设 `FONT_SIZES = [15, 16, 17, 18, 19, 21]`，[SettingsView.tsx:141](/Users/mason/ToHighs/clairis-wt-design-plan/src/components/SettingsView.tsx:141)，阅读字号 UI 直接消费：[SettingsView.tsx:1242-1260](/Users/mason/ToHighs/clairis-wt-design-plan/src/components/SettingsView.tsx:1242)。行宽还有四个命名预设，[readerWidth.ts:6-11](/Users/mason/ToHighs/clairis-wt-design-plan/src/lib/readerWidth.ts:6)。正确表述应为“已有代码内固定预设，需数据化”，而不是“无预设集合”。

13. **B9 部分成立，但重复计算。**  
    `defaultNewDocFormat` 确实不存在，`defaultSavePath` 存在：[config.rs:68-71](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/config.rs:68)。但默认保存目录已有完整设置和消费路径，[SettingsView.tsx:643-645](/Users/mason/ToHighs/clairis-wt-design-plan/src/components/SettingsView.tsx:643)。新文档模板则已由 A5 的 templates 覆盖。B9 不是一张独立能力，应在明确“默认模板选择/默认 frontmatter”增量后再保留。

14. **C3 错误。**  
    `capabilities` 只包含 `math`、`code-highlight`、`mermaid`、`preview-zoom`，不管理 preview/edit/source 模式切换：[capabilities.ts:10-29](/Users/mason/ToHighs/clairis-wt-design-plan/src/lib/capabilities.ts:10)。模式由页签或面板的 `editorMode` 和 `setEditorMode` 管理，[stores/index.ts:707-725](/Users/mason/ToHighs/clairis-wt-design-plan/src/stores/index.ts:707)。因此“模式切换/渲染管线运行时开关由 capabilities 统一管理”是虚构结论。

15. **`env.toml` 是虚构落点。**  
    当前扩展加载器只读取 `manifest.json` 和 `SKILL.md`：[extension_packages.rs:142-157](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/extension_packages.rs:142)。仓库中没有 `env.toml`，也没有解析 `permissions` 的代码。Tauri capability 配置是另一套窗口级 ACL，[default.json:1-24](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/capabilities/default.json:1)，不能自动绑定到插件 manifest。

16. **当前 manifest 实际字段与提案不兼容。**  
    当前结构是 `id/name/version/description/source`，[extension_packages.rs:48-57](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/extension_packages.rs:48)。提案改为 `type` 且删掉 `source`，但 `source` 目前参与“内置/AI/用户”标签和是否注入 AI 的判断：[extension_packages.rs:740-745](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/extension_packages.rs:740)、[SettingsView.tsx:79-83](/Users/mason/ToHighs/clairis-wt-design-plan/src/components/SettingsView.tsx:79)。没有迁移方案会直接破坏现有包。

17. **目录提案与现状脱节。**  
    当前扩展包位于 `<config_base>/extensions/<id>/`：[extension_packages.rs:1-12](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/extension_packages.rs:1)、[:96-102](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/extension_packages.rs:96)。提案写 `data/plugins/`，但仓库没有该目录语义，也未说明它相对于 `config_base` 的位置、迁移和兼容策略。

18. **4.4 与真实注入行为不一致。**  
    当前 `enabled_skill_context_at` 明确排除 builtin，[extension_packages.rs:739-746](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/extension_packages.rs:739)，而文档称聚合“所有已启用技能型插件 + 内置 SKILL_MAP”。当前也没有任何代码读取 `SKILL_MAP`。这部分描述不能作为实现依据。

## 逻辑与遗漏问题（编号）

1. **插件分类不互斥。**  
   文档定义三类互斥，但 A1 的现有扩展包本质上是 `manifest + SKILL.md`，同时具有注册包和技能贡献；A4 的 `CAPABILITY_META` 又是代码内运行时注册表，不符合“manifest + JSON”的注册型定义。应按“包类型”与“贡献点”拆成两个维度，例如一个包可贡献 `skill`、`theme-tokens`、`snippets`、`menu` 等，而不是强行塞入单一 `type`。

2. **大量“已插件化”实际上只是“已配置化”。**  
   A3、A4、A5、B2、B3 主要是数据文件或设置字段，没有独立包身份、manifest、启用状态、版本兼容、来源或升级语义。把它们统称为插件，会造成“配置值”和“打包加载单元”混淆，也使“独立升级”目标没有实现对象。

3. **现有扩展包并不支持提案中的三种形态。**  
   当前 `read_package_dir` 强制每个包同时具备 `manifest.json` 和 `SKILL.md`。纯配置型包、纯注册型包目前都会被判为缺 SKILL。若不先重构加载器，4.1 目录结构无法实现。

4. **生命周期裁定过度统一。**  
   不同贡献点的读取时机不同：snippets/templates/theme 在 App 或编辑器加载时读取，扩展包列表在设置页读取，SKILL 在每轮 AI 调用时读取。不能用一个“重启生效”覆盖全部。应分别定义启动、页面打开、下一次调用、重启四种生效时点。

5. **权限模型没有可执行语义。**  
   即使增加 `permissions: ["filesystem"]`，当前插件也没有执行环境可供隔离；文件访问是宿主加载器完成的。只校验声明不能阻止读取或写入。应改为宿主侧的数据访问矩阵，例如“仅读取自身包目录”“不得读取用户文档”“仅贡献允许的 token 和动作 ID”。Tauri ACL 不应冒充插件 ACL。

6. **菜单、图标、工具条、导出只设计了“配置”，没有设计“命令绑定”。**  
   数据文件只能提供现有 action ID 的启停和排序。新增菜单项、导出格式、图标概念若没有命令 allowlist、冲突规则和渲染器注册，就会变成无效配置。需要显式定义 ID 白名单、未知 ID 告警、重复 ID 覆盖规则。

7. **AGENT 写通路缺失。**  
   当前 AI 只有 `read_config`、`patch_config`、`list_snapshots` 三个工具，无法写 `data/plugins/`、`user/commands.json` 或其他新数据文件。文档的“AGENT 自定义”大量依赖尚不存在的写通路，却没有列入实施批次。4.7 所说“AGENT 可生成任意插件”也与现状不符：当前生成器只构造固定模板包，不执行真实模型生成。

8. **安全结论“最坏没生效”错误。**  
   用户/AI 扩展的 SKILL 内容被作为 `system` 消息插入：[ai_agent_cmd.rs:47-51](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/commands/ai_agent_cmd.rs:47)，而 AI 又拥有可修改配置的 `patch_config` 工具。恶意 SKILL 可以通过提示注入诱导配置修改，不只是“没生效”。缺少不可信内容隔离、工具授权、确认策略、体积与 token 上限。

9. **错误告警没有实际承载面。**  
   扩展包单包失败目前只写 tracing warn，[extension_packages.rs:256-270](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/extension_packages.rs:256)，`list_extension_packages` 只返回包数组，不返回 warnings；设置页无法展示具体失败原因。snippets/templates 的 warnings 也未被 App 展示。§4.7 声称“用户可见聚合告警”，但缺少返回结构和 UI 落点。

10. **“单一落点”与目录设计冲突。**  
   一方面说数据文件是唯一配置落点，另一方面又计划把能力打包到 `data/plugins/`，同时 A3/A5 仍在 config 根目录，B2/B3 又在 `user/settings.json`。必须明确“插件包、贡献数据、有效配置、运行时状态”各自唯一归属。

11. **缺少 data-surface 六栏表。**  
   文档命中配置、主题、图标、菜单、快捷键、轮盘、开关等明确信号，但全文没有 `## 数据面` 六栏表。按仓库约束，在进入拆票前必须补规格、存储、校验、桥接、消费、回滚六行。

12. **升级与回滚只写了目标，没有实现设计。**  
   现有导入替换流程删除旧目录后再 rename，[extension_packages.rs:400-410](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/extension_packages.rs:400)。如果 rename 失败，旧版本可能已经丢失。提案承诺“独立升级”，却未定义兼容性、失败回滚、降级和 schema migration。

13. **批次划分存在重复建设和范围混杂。**  
   B9 部分重复 A5 与现有 `defaultSavePath`；第一批同时修改 manifest、权限、capabilities 分类和 settings 字段，缺少可独立验收的纵向切片。每批应在实现前明确用户可见结果、数据落点和回滚方式。

## 修订建议（按优先级）

1. **P0：先重写事实基线和总体状态。**  
   修正 A2 的 `SKILL_MAP` 机制、A4 的 AI 工具说明、C3 的模式管理、B8 的预设判断及所有错误行号；在文档与实际代码一致前，状态改回“需修订”。

2. **P0：重构插件模型为“包 + 贡献点”。**  
   建议 manifest 至少包含 `schemaVersion/id/name/version/description/source/contributes/permissions`，一个包可以贡献多个 `skill/menu/theme/snippets/...`。不要继续使用互斥单值 `type` 承载所有语义，也不要删除现有 `source` 字段。

3. **P0：定义 manifest v2 迁移。**  
   明确旧字段保留、缺失 `source` 的兼容策略、未知字段处理、旧 `<config_base>/extensions/` 与新目录双读迁移窗口。优先保留现有 `extensions/` 物理目录，或在迁移期同时扫描两者；不要直接引入含义不明的 `data/plugins/`。

4. **P0：删除虚构权限，改为宿主可执行的访问矩阵。**  
   删除 `env.toml` 说法。逐贡献点定义允许读取的文件、允许贡献的 ID、是否允许触发命令、是否允许进入 AI 上下文。权限校验必须在宿主加载器执行，并与 Tauri ACL 明确区分。

5. **P0：补齐 SKILL 安全设计。**  
   将用户 SKILL 视为不可信内容，不允许无约束地改变工具权限；规定最大文件体积、聚合 token 预算、重复/冲突处理、提示注入边界。涉及 `patch_config` 等写工具时要求插件级授权或用户确认。

6. **P1：为每个能力建立单一注册表。**  
   先把轮盘的 `ROOT_SECTORS`、设置页元数据和 Rust allowlist 收口；工具条亦同。随后再允许数据文件选择、排序或扩展这些 ID。菜单、图标、导出必须使用同一套 allowlist 和冲突规则。

7. **P1：重新界定 B7、B8、B9。**  
   B8 改为“固定预设集合代码化，迁入数据文件”；B9 仅保留真正增量，例如“默认模板选择、默认 frontmatter”，并将 `defaultSavePath`、已有 templates 明确标为已落地。B7 应给独立文件迁移理由，否则保留 `settings.json`。

8. **P1：拆分生命周期与错误契约。**  
   对每个贡献点分别定义“启动读取、打开时读取、每轮读取、需重启”；统一返回 `PluginLoadReport` 或等价结构，包含成功项、跳过项、原因和聚合告警。设置页必须能显示失败包及原因。

9. **P1：补数据面六栏表和票级覆盖。**  
   在进入 OpenSpec change 前新增完整 `## 数据面` 表，覆盖规格、存储、校验、桥接、消费、回滚；随后运行 `cw-data-surface.sh new/tickets/diff`。

10. **P1：增加可执行验收。**  
    至少覆盖：semantic-invalid manifest、目录名与 id 冲突、内置 id 冲突、未知 contribution point、未知 action ID、重复 ID、超大 SKILL、恶意提示、损坏包不影响其他包、旧 manifest 迁移、升级失败保留旧版本。

11. **P2：重排批次。**  
    建议顺序为：manifest/加载器兼容与安全基线 → 统一现有注册表 → 配置型贡献点 → 技能/slash 写通路 → 热加载评估。当前“第一批”范围过宽，无法独立验收。

## 交付后审计补充（合约 3 覆盖缺口修复）

独立审计核验指出本评审当时的方案 §3 能力清单**未覆盖「捕获」与「搜索」两个能力域**（全文无命中，且未在 C 档给出排除理由）。此为本评审未覆盖的能力域，非评审意见疏漏。

**修复**：在方案 §3 B 档补登 **B10 快速捕获浮层**（`stores/captureOverlay.ts`，注册型，AGENT 可自定义捕获入口/浮层行为/捕获后处理）与 **B11 搜索**（`src/lib/searchScan.ts` + `QuickOpen`，配置型，AGENT 可自定义搜索源/过滤策略/排序）。二者判为可提取，非排除项，C 档无需登记排除理由。同步更新 DELIVERY.md 覆盖表述。
