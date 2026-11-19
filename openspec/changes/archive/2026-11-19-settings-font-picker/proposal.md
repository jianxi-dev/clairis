# 变更提案：标题字体选择体验（默认占位 / 自绘候选列表 / 中文本地化与中文优先）

## Why

设置面板的「标题字体」逐级输入框当前恒显示整串默认字体栈：`headingFonts.ts` 的 `headingFontInputValue` 恒等返回，`ensureHeadingFonts` 又把缺失值填成 `HEADING_FONT_STACK`，用户根本没设置过也看到一长串；清空提交还会把默认栈写回配置（`SettingsView.tsx` 的 `commitHeadingFont`）。候选来自浏览器原生 `<datalist>`（`SettingsView.tsx:1537-1541`），弹层样式不可控（暖色主题下白字无法修）；候选名是英文原始族名、按码点排序（`fonts.rs` 的 `BTreeSet`），中文用户找不到「苹方-简 / 宋体-简」。维护者 2026-11-19 第三轮验收对账确认（GitHub #1154 评论「全按 ★ 默认实施」）：① 未修改时显示「默认」占位；② 换自绘候选列表；③ 加本地化中文名 + 中文优先排序（跟随系统语言）。

## What Changes

- **默认占位语义（值来源区分）**：区分「显式配置」与「默认栈」。某级未显式配置（含历史遗留的默认栈值）时，输入框 SHALL 显示「默认」占位（placeholder），不显示整串栈；清空并提交 = 取消该级显式配置、回落默认；仅显式设置过才显示字体名。渲染层未配置时仍回落 `--type-font-sans`（既有 CSS fallback 不变）。
- **自绘候选列表替换原生 datalist**：候选列表改为受控自绘面板，跟随主题 token 渲染（复用既有语义色，不新增色值），支持指针选择、键盘导航（↑/↓ 移动、Enter 选择、Esc 关闭）与点击外部关闭；候选结构从 `string[]` 变为 `{ family, localized }[]`。e2e 选择器口径同步（原 `#heading-font-options option` 依赖失效）。
- **本地化中文名 + 中文优先排序**：`fonts.rs` 经 `NSFontManager.localizedName(forFamily:face:)` 取本地化中文名（跟随系统首选语言），命令返回结构扩展为 `{ family, localized }`；排序中文优先（本地化名为 CJK 的族排前，组内按本地化名排序）。显示名与存储名分离：候选与输入框显示本地化名，写盘仍为原始族名。
- **规格修订**：`configuration`「标题字体逐级配置」MODIFIED（默认占位与值来源区分、自绘候选列表、本地化与排序、显示名/存储名分离）；既有场景标题逐字保留，新增可验收场景。

## Capabilities

### New Capabilities

（无——三项均为既有能力 `configuration` 的需求修订。）

### Modified Capabilities

- `configuration`：「标题字体逐级配置」MODIFIED：默认占位与值来源区分、自绘候选列表（主题 token + 键盘导航）、候选名本地化中文名 + 中文优先排序、显示名 / 存储名分离。其余 CF-1～CF-6、提示时长、轮盘等要求不改。

## Impact

- **前端**：`src/lib/headingFonts.ts`（`headingFontInputValue` 栈→空、`normalizeHeadingFonts` 丢弃栈值并返回部分映射、`isFontFamilyAllowed` 接受 family / localized、新增显示名↔族名解析）；`src/types/index.ts`（`headingFonts` 改 `Partial<HeadingFonts>`，新增 `SystemFont` 类型）；`src/hooks/useConfig.ts`（save / load 不再用 `ensureHeadingFonts` 填默认栈）；`src/components/SettingsView.tsx`（清空提交 = 取消配置、显示本地化名、挂自绘列表面板）；新增 `src/components/HeadingFontField.tsx`（输入 + 触发 + 候选列表 + 键盘导航）；`src/components/Content/ContentArea.tsx`、`src/components/Content/PreviewView.tsx`（仅显式值注入 `--heading-*-font`）；`src/styles/`（候选列表样式，复用既有 token）。
- **后端**：`src-tauri/src/fonts.rs`（`FontFamily` 结构、`localizedName` 桥、CJK 排序键）、`src-tauri/src/commands/config_cmd.rs`（返回类型）、`src-tauri/src/config.rs`（`heading_fonts` 存储语义：未配置存 `null`）。
- **数据面**：命中 `src/components/SettingsView.tsx`、`src/hooks/useConfig.ts`、`src-tauri/src/config.rs` 路径信号（强）→ design.md 必含「## 数据面」六行表，跑 `./scripts/cw-data-surface.sh new settings-font-picker`。
- **测试**：单测（占位语义、栈值丢弃、family / localized 解析、CJK 排序键）；e2e（默认占位、自绘列表主题与键盘导航、中文优先排序、枚举失败降级、原 datalist 断言迁移）；`bash scripts/verify.sh` 全绿。
- **不在范围**：强制中文（不随系统语言，G0 裁定跟随系统语言）；正文 / 代码字体；标题颜色（`heading_colors`）；非 macOS 的字体枚举（仍降级手输）。
