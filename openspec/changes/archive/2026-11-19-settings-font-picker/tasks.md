# 任务清单：标题字体选择体验（默认占位 / 自绘候选列表 / 中文本地化与中文优先）

> 规格：`specs/configuration/spec.md`（「标题字体逐级配置」MODIFIED）。设计：`design.md`（决策 D1～D7 + 数据面六行表）。需求输入：GitHub #1154 评论「对账确认（2026-11-19）：全按 ★ 默认实施」。
>
> **切片说明（QG-7）**：每票贯穿数据 / 交互 / 样式 → UI → 测试全层，做完用户能在页面上看到或感受到东西；按语义风险倒序排布（值语义 > 数据契约 > UI 交互）。
>
> **测试归属（QG-2/QG-4）**：单测与 Playwright e2e 随各票交付（票面 AC 列明）。
>
> **数据面机检三连**：G0 阶段二 `./scripts/cw-data-surface.sh new` → G0-POST `tickets` → G1 出口 `diff`。1.1 认领 存储/桥接/回滚，1.2 认领 校验，1.3 认领 规格/消费。
>
> **归档**：G4 收口后按 change-workflow 归档；子票 Parent = spec issue #1154。

## 1. 垂直切片

- [x] 1.1 **默认占位语义与值来源区分**：`src/types/index.ts` 的 `headingFonts` 改 `Partial<HeadingFonts>`；`src/lib/headingFonts.ts` 的 `headingFontInputValue` 在值为空或等于 `HEADING_FONT_STACK` 时返回 `""`（输入框显示 placeholder「默认」），`normalizeHeadingFonts` 返回部分映射（结构合法且不等于默认栈的值保留，缺失 / 非法 / 默认栈值丢弃），移除 `ensureHeadingFonts` 的默认栈填充语义；`src/hooks/useConfig.ts` 的 `saveAppConfig` 不再填默认栈、`applyRustConfig` 走新归一化；`src/components/Content/ContentArea.tsx` 与 `src/components/Content/PreviewView.tsx` 仅在显式值时注入 `--heading-*-font`；`src/components/SettingsView.tsx` 的 `commitHeadingFont` 清空 = 取消该级显式配置（写 `undefined` / 删键），placeholder 改「默认」。AC：`npm run tauri dev` 打开设置 → 未配置的级别输入框显示「默认」占位而非整串栈；清空某级并提交后该级配置消失、显示「默认」、标题 `font-family` 回落 `--type-font-sans`；显式设置某级后显示字体名并持久化（重启仍在）；历史遗留「6 级全默认栈」的配置加载后显示「默认」且渲染不变；单测覆盖栈→空 / 栈值丢弃 / 部分映射；e2e 覆盖占位与清空。锚点：场景「默认回落」「默认占位显示」「清空回落默认」「值来源区分」。Blocked by：None。接线归属：无新增导出（改既有内部语义）。标签：ready-for-agent、ui-surface。粒度：用户可见交付物。**视觉锚点**: design-system:§6。**数据面**: 存储,桥接,回滚

- [x] 1.2 **Rust 本地化枚举与中文优先排序**：`src-tauri/src/fonts.rs` 新增 `FontFamily { family, localized }`，`family` 取 `availableFontFamilies` 原始名，`localized` 经 `NSFontManager.shared.localizedName(forFamily:face:nil)` 获取（空则回落 `family`），排序键 = `(非 CJK, localized)`（本地化名为 CJK 的族整体排前、组内按 `localized` 字典序）；`list_system_fonts` 返回 `Vec<FontFamily>`；`src-tauri/src/commands/config_cmd.rs` 返回类型同步；`src/types/index.ts` 新增 `SystemFont` 类型；`src/lib/headingFonts.ts` 的 `isFontFamilyAllowed` 改接受 `SystemFont[]` 并按 `family` 或 `localized` 双命中（供 1.3 使用）；`e2e/mocks/tauri-mock.js` 默认返回对象数组（含本地化对照，如 `PingFang SC→苹方-简`），`__biaoyue_system_fonts__` 覆盖支持对象数组。AC：macOS 命令返回含 `localized` 的列表，中文族排在前、组内按 `localized` 排序；非 macOS 返回空数组（不报错）；Rust 单测覆盖排序键与去重；前端类型与 mock 对象数组可被消费。锚点：场景「候选名本地化与中文优先排序」「本机字体候选列表」。Blocked by：None。接线归属：本票导出 `FontFamily` / `SystemFont`，接线位置 = `SettingsView.tsx` 候选渲染（由 1.3 接）。标签：ready-for-agent。粒度：用户可见交付物（候选名与排序经 1.3 可见）。**视觉锚点**: 无（数据 / 桥接票，不新增可见 UI）。**数据面**: 校验

- [x] 1.3 **自绘候选列表替换原生 datalist**：新增 `src/components/HeadingFontField.tsx`（单级输入框 + `chevronDown` 触发按钮 + 候选面板 + 高亮态 + 键盘导航 + 点击外部关闭）；面板复用既有语义色 token（`--app-surface` / `--app-border` / `--app-text` / `--app-text-3` / `--app-accent` / `--app-sunken`）与既有 `chevronDown` 图标，不新增色值 / 图标；`SettingsView.tsx` 用 6 个 `HeadingFontField` 替换现有 6 组 input + 共享 `<datalist>`；候选文本显示 `localized`，选中写盘 `family`（1.2 的解析口径）；输入时按 `localized` / `family` 过滤为可选项（不做则全量展示，见 OQ-2）；e2e 选择器从 `#heading-font-options option` 迁移到 `[data-testid="heading-font-options"] [role="option"]`（`heading-fonts-853.spec.ts:171/200`、`heading-fonts-1136.spec.ts:146/192`），枚举失败用例断言项数 0。AC：聚焦输入框打开候选面板；候选可见、文本为本地化名、顺序中文优先；面板计算样式随主题（亮 / 暗 / 暖三主题均可读，暖色下不再白字）；↑/↓ 移动高亮、Enter 选中并写盘 `family`、Esc 关闭、点击外部关闭；枚举失败面板不渲染且显示降级提示、手输仍可保存；`bash scripts/verify.sh` 全绿、CSS manifest 通过。锚点：场景「本机字体候选列表」「自绘候选列表主题与键盘导航」「候选名本地化与中文优先排序」。Blocked by：1.2。接线归属：本票导出 `HeadingFontField`，接线位置 = `SettingsView.tsx` 标题字体 section（本票内接）。标签：ready-for-agent、ui-surface。粒度：用户可见交付物。**视觉锚点**: design-system:§6。**数据面**: 规格,消费

- [x] 1.4 **集成验收与交付**：`npm run tauri dev` 手动走查全量关键路径（未配置占位 / 清空回落 / 候选选择 / 键盘导航 / 中文排序 / 枚举失败降级），按仓库 UI 约定用功能说明性语言记录；`bash scripts/verify.sh` 全绿（tsc → eslint → vitest → CSS manifest → cargo check → 两套 Playwright）；数据面机检 `diff` 收口；更新 `docs/delivery/requirements-status.md`；G4 归档。锚点：「标题字体逐级配置」全量场景。Blocked by：1.1、1.2、1.3。接线归属：不适用（收口票）。标签：ready-for-agent、ui-surface。粒度：integrate-verify。**视觉锚点**: 无（收口票，不新增可见 UI）。**数据面**: 无

## 2. 来源映射

| 任务 | 来源 | 规格触点 |
|---|---|---|
| 1.1 | #1154 三.1 ① 对账确认 | 「默认回落」/「默认占位显示」/「清空回落默认」/「值来源区分」 |
| 1.2 | #1154 三.1 ③ 对账确认 + 探针 evidence.md | 「候选名本地化与中文优先排序」/「本机字体候选列表」 |
| 1.3 | #1154 三.1 ② 对账确认 | 「本机字体候选列表」/「自绘候选列表主题与键盘导航」 |
| 1.4 | 上述三票收口 | 「标题字体逐级配置」全量 |
