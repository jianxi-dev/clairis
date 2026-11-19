# 设计：标题字体选择体验（默认占位 / 自绘候选列表 / 中文本地化与中文优先）

## Context

- 需求输入：GitHub #1154（spec issue）+ 其评论「对账确认（2026-11-19）：全按 ★ 默认实施」，为最终依据。① 未修改时显示「默认」占位；② 换自绘候选列表；③ 本地化中文名 + 中文优先排序（跟随系统语言）。
- 基准：`openspec/specs/configuration/spec.md`「标题字体逐级配置」现状；同批先例 `openspec/changes/doc-property-restore/`、`search-replace-interaction/`。
- 现状代码（探查实证）：
  - 显示：`src/lib/headingFonts.ts:114-118` `headingFontInputValue` 恒等返回（注释「#926 起默认栈也显式呈现」）；`ensureHeadingFonts`（:100-112）把缺失填 `HEADING_FONT_STACK`；`SettingsView.tsx:748-764` 用 `ensureHeadingFonts` 造 map 与初始文本；`commitHeadingFont`（:943-966）清空解析为 `default` 后写回 `HEADING_FONT_STACK`。
  - 候选：`SettingsView.tsx:1537-1541` 原生 `<datalist id="heading-font-options">` + `input list=`；`src/styles/` 无任何 datalist 规则 → 原生弹层不可样式化（暖色主题白字不可修）。
  - 枚举：`src-tauri/src/fonts.rs:15-50` `availableFontFamilies` + `UTF8String` 原始名 + `BTreeSet` 码点排序（无本地化、无中文优先）；命令 `list_system_fonts`（`commands/config_cmd.rs:28`）返回 `Vec<String>`。
  - 桥：`useConfig.ts:166` save 用 `ensureHeadingFonts` 填默认栈；`:424` load 用 `normalizeHeadingFonts` 填默认栈；`src/types/index.ts:38-44` `HeadingFonts` 六级全 `string`。
  - 渲染：`ContentArea.tsx:472-477` / `PreviewView.tsx:164-169` 把 `headingFonts[level]` 注入 `--heading-*-font`；`editor.css:210-249` / `reader.css:355-398` 用 `var(--heading-h*-font, var(--type-font-sans))` 兜底。
  - 探针证据：`.artifacts/triage-fonts-2026-11-19/evidence.md`——`NSFontManager.localizedName(forFamily:face:)`（API 在 `NSFontManager`，非 `NSFont`）本机 zh-Hans-CN 下 50/254 族返回中文本地化名（`PingFang SC→苹方-简`、`Songti SC→宋体-简`、`FangSong_GB2312→仿宋_GB2312`），204 族原样返回、0 空串；**跟随 AppleLanguages**（en-US 回落英文原名）。
- 硬约束：三模式 CSS display 切换不 remount；新增 / 改动 `cm-*` 类须同步 `src/styles/`（CSS manifest）；数据面契约见下文六行表；delta spec 逐字保留既有场景标题。

## Goals / Non-Goals

**Goals:**

- 未显式配置的标题级别显示「默认」占位，不显示整串栈；清空提交 = 取消显式配置、回落默认；显式配置才显示字体名。
- 候选列表改为自绘受控面板：跟主题 token、可指针选择、可键盘导航（↑/↓ + Enter + Esc）、点击外部关闭，替换原生 `<datalist>`。
- 候选名显示本地化中文名（跟随系统语言），排序中文优先；显示名与存储名分离（写盘原始族名）。
- 渲染结果零回归：未配置仍回落 `--type-font-sans`。

**Non-Goals:**

- 强制中文（不随系统语言）——G0 裁定跟随系统语言。
- 正文 / 代码字体、标题颜色（`heading_colors`）。
- 非 macOS 的字体枚举（仍返回空数组 → 前端降级手输）。
- 候选列表的虚拟滚动 / 搜索高亮等增强（本批只做可用与可读）。

## Decisions

1. **默认占位：把「值等于默认栈」收敛为「未显式配置」**。当前 `ensureHeadingFonts` 与 `headingFontInputValue` 把默认栈当显式值呈现，且 `saveAppConfig` 每次保存都把默认栈写进 user 配置，导致「未配置」不可表示。改为：
   - `headingFonts` 类型由 `HeadingFonts`（六级全 `string`）改为 `Partial<HeadingFonts>`（缺键 / `undefined` = 未配置）；
   - `normalizeHeadingFonts(raw)` 返回部分映射：结构合法**且不等于** `HEADING_FONT_STACK` 的值保留，其余（缺失 / 非法 / 等于默认栈）丢弃（渲染层由 CSS fallback 兜底，与当前渲染结果一致）；
   - 新增 `headingFontInputValue(value)`：值为空或等于默认栈时返回 `""`（输入框显示 placeholder「默认」），否则返回值；
   - `saveAppConfig` 不再 `ensureHeadingFonts` 填默认栈，直接写部分映射（Rust `HeadingFonts` 各级为 `Option<String>`，未配置序列化为 `null`）；`ensureHeadingFonts` 从 save 路径移除（保留或改名由实现决定，避免「补默认栈」语义残留）；
   - `ContentArea` / `PreviewView` 仅在 `headingFonts[level]` 为显式值时注入 `--heading-*-font`；未配置不注入，由 `var(--heading-*-font, var(--type-font-sans))` 回落。
   - 理由：CSS 已有一份默认栈真相源，前端重复填一份既冗余又制造「显式 vs 默认」歧义；让「未配置」成为可表示状态，显示与存储同时干净。替代方案（保留全量 map + 独立 explicit 集合）多一份状态、易漂移，弃。
2. **本地化与排序在 Rust 侧做**。`fonts.rs` 新增 `FontFamily { family: String, localized: String }`：`family` = `availableFontFamilies` 原始名，`localized` = `NSFontManager.shared.localizedName(forFamily:face:nil)`（空则回落 `family`）；`list_system_fonts` 返回 `Vec<FontFamily>`，排序键 = `(非 CJK, localized)`——本地化名为 CJK 的族整体排在非 CJK 之前，组内按 `localized` 字典序。理由：`localizedName` 是 macOS 原生 API（`objc` 桥已在 `fonts.rs` 使用），前端拿不到；枚举与排序一次在 Rust 完成，前端只消费；与现有命令同处，非 macOS 仍返回空数组。替代方案（前端做）无 API 可用，弃。
3. **跟随系统语言，不强制中文**。`localizedName` 读 `AppleLanguages`（探针实证），应用不覆盖语言。理由：与系统其它应用一致；本机用户为中文系统，目标成立；强制中文需在应用内改语言环境，复杂且与 macOS 惯例相悖。
4. **显示名 / 存储名分离**。候选与输入框显示 `localized`；写盘写 `family`（原始族名，CSS `font-family` 解析最可靠）。`commitHeadingFont` 解析输入：输入等于某候选的 `localized` 或 `family` → 写该候选 `family`；手输其它 → 按既有结构校验。`isFontFamilyAllowed(value, fonts: SystemFont[])` 匹配 `family` **或** `localized`（大小写不敏感），使手输中文字体名也能通过。理由：用户看到的就是候选里的名字，存储仍需渲染可靠；两者解耦。
5. **自绘候选列表 = 输入 + 触发 + 面板 + 键盘导航**。新增 `src/components/HeadingFontField.tsx`：封装单级输入框、`chevronDown` 触发按钮、候选面板与高亮态；面板用现有 class 风格（`rounded border bg-[var(--app-surface)]` 等）+ 既有 token（`--app-surface` / `--app-border` / `--app-text` / `--app-text-3` / `--app-accent` / `--app-sunken`），**不新增色值**；图标复用既有 `chevronDown`（`src/ui/icons.ts:347`，§2.3 已注册），不新增图标。面板行为：聚焦 / 输入时打开、↑/↓ 移动高亮、Enter 选中、Esc 关闭、点击外部关闭、选中后面板关闭。理由：原生 `<datalist>` 弹层样式不可控（暖色白字不可修），且 6 级复用、键盘状态内聚。e2e 口径：面板容器 `[data-testid="heading-font-options"]`，项 `[role="option"]` 且带 `data-family`；枚举失败面板不渲染（项数 0）。
6. **枚举命令返回结构扩展**。`list_system_fonts` 返回 `Vec<FontFamily>`（序列化 `{family, localized}`）；前端 `invoke<SystemFont[]>`；e2e mock `e2e/mocks/tauri-mock.js` 默认返回对象数组（含本地化对照，如 `PingFang SC→苹方-简`），`__biaoyue_system_fonts__` 覆盖支持对象数组。理由：增量扩展；mock 同步避免既有 e2e 崩；旧断言 `#heading-font-options option` 全量迁移到自绘选择器。
7. **测试口径**：单测覆盖 `headingFontInputValue`（栈→空、显式值原样）、`normalizeHeadingFonts`（栈值 / 缺失 / 非法丢弃）、`isFontFamilyAllowed`（family 与 localized 双命中）、`FontFamily` CJK 排序键（Rust 单测）；e2e 覆盖「未配置显示默认占位」「清空回落默认」「自绘列表主题计算样式 + 键盘导航选择」「中文优先排序」「枚举失败降级手输」；`bash scripts/verify.sh` 全绿。

## 数据面

| 落点 | 位置 | 载体/符号 | 判据 |
|---|---|---|---|
| 规格 | design-system:§6 | — | 候选列表主题化只用既有语义色 token（`--app-surface` / `--app-border` / `--app-text` / `--app-text-3` / `--app-accent` / `--app-sunken`），不新增色值；下拉触发复用既有 `chevronDown` 图标（§2.3），不新增图标 |
| 存储 | src-tauri/src/config.rs | heading_fonts | 未显式配置的级写盘为 `null` / 缺键（不再写默认栈）；`HeadingFonts` 各级为 `Option<String>` |
| 校验 | src-tauri/src/config.rs | check_heading_fonts | 非法 / 空值拒绝；前端 `isFontFamilyAllowed` 接受 `family` 或 `localized` 命中 |
| 桥接 | src/hooks/useConfig.ts | saveAppConfig | 保存时不再 `ensureHeadingFonts` 填默认栈；`applyRustConfig` 经 `normalizeHeadingFonts` 丢弃栈值 |
| 消费 | src/components/SettingsView.tsx | HeadingFontField | 候选列表读 `list_system_fonts` 返回的 `{family, localized}`；显示本地化名、写盘原始族名 |
| 回滚 | snapshots/ | restore_config_snapshot | 写前快照，误改标题字体配置一步恢复 |

（三道机检时点：G0 阶段二 `./scripts/cw-data-surface.sh new`、G0-POST `tickets`、G1 出口 `diff`。）

## Risks / Trade-offs

- [历史 user 配置 6 级全是默认栈，改后显示「默认」] → 这是预期语义（默认栈本就是回落值）；渲染层不注入变量，CSS fallback 仍是 `--type-font-sans`，视觉零回归。
- [`localized` 在某些系统语言下回落英文原名，中文优先排序退化为普通字典序] → 跟随系统语言是裁定口径；英文系统下用户看到英文原名，仍可手输。
- [写盘 `family` 而显示 `localized`，手输本地化名需解析回族名] → `isFontFamilyAllowed` 双命中 + commit 解析；未命中走既有非法回落提示。
- [自绘面板与原生 datalist 的键盘习惯差异] → 明确 ↑/↓ + Enter + Esc + 点击外部关闭，与系统组合框惯例一致（§7.3 心智模型一致）。
- [e2e 断言口径迁移遗漏] → 全量 grep `#heading-font-options option`（`heading-fonts-853.spec.ts:171/200`、`heading-fonts-1136.spec.ts:146/192`）并改为自绘选择器；枚举失败用例断言项数 0。
- [候选列表 254 项渲染性能] → 本批不做虚拟滚动；254 个节点量级可接受（Non-Goals 已声明）。

## Migration Plan

1. 前端值语义：`Partial<HeadingFonts>` + `headingFontInputValue` 栈→空 + `normalizeHeadingFonts` 丢弃栈值 + `useConfig` save/load 改接 + 渲染层条件注入。
2. 后端枚举：`FontFamily` + `localizedName` 桥 + CJK 排序键 + 命令返回类型。
3. UI：新增 `HeadingFontField` 替换 6 组 input + 共享 `<datalist>`；e2e mock 与断言迁移。
4. 测试与 `verify.sh` 收口。
- 每步可独立合入 main：第 1 步为纯语义修正（渲染零回归），第 2 步为增量结构，第 3 步依赖第 2 步。
- 回滚：按提交粒度回退；user 配置里已有的默认栈值在被读取时丢弃，无需数据迁移脚本。

## Open Questions

- **OQ-1**：`ensureHeadingFonts` 是否保留（改名 `pickDefinedHeadingFonts` 之类）还是直接删除？G0 倾向删除——save 路径不再需要它，留着会诱导后续再填默认栈。
- **OQ-2**：候选面板是否需要在输入时按 `localized` / `family` 过滤？G0 倾向**本批不做**（254 项全量展示 + 键盘导航足够，避免过滤逻辑与「手输合法值」语义打架）。
