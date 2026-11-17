# 变更提案：文档属性面板 5 项验收修订

## Why

文档属性面板（`doc-property-panel`）上线后，维护者 2026-11-17 验收给出 5 条一手反馈（GitHub #1019 / #1021 / #1022 / #1023 / #1024）：面板可见时编辑态正文仍重复渲染 frontmatter 源码块、布尔字段值内混入「开/关」文字、工具条自造 Unicode 图标与仓库图标体系不统一、模板缺类型设置 UI 且内置模板不可编辑、别称映射表（`propAliasMap`）应用配置未建立。前四条是**用户裁定覆盖原型**的显示/交互修订，第五条是归档 change `doc-property-and-search-panel` **决策 8 的计划项缺口**（`propTemplates` 已落地、`propAliasMap` 未交付）。本 change 把这 5 条一次性收口，全部走 OpenSpec 闭环。

## What Changes

**#1019 面板可见时编辑态正文隐藏 frontmatter 源码块**
- 面板可见（未隐藏）时，编辑态正文顶部用 CM6 decoration 隐藏 `--- ... ---` 源码块，消除与面板的内容重复。
- 折叠态 / `⌘⇧Y` 隐藏态的行为在 design 定稿（建议：折叠露出一行摘要、隐藏露出源码块）。
- 源码态行为不变（YAML 完整可编）；光标/选区/undo 不因隐藏装饰错位。

**#1021 布尔字段值内仅状态图形**
- 值列去掉「开/关」文字，仅保留状态图形（◉/○）；文案移至 `title` 提示，编辑态 `aria-label`/`role=switch` 语义保留。
- 用户裁定覆盖原型 `bool-toggle`（原型的「◉ 开/○ 关」不再成立）。

**#1022 工具条/行内操作图标统一复用仓库图标注册表**
- 选中行工具条 ⧉✂⤵↑↓🗑× 与类型图标字符混排（Aa/123/◉/▾/☑/?/☰ + 自绘 12px SVG）改经 `src/ui/icons` 注册表（`iconSvg`）消费。
- 注册表缺失图标（copy/cut/paste/arrowUp/arrowDown/trash/close 等）按 `design-system:§2` 先补 spec 条款再新增（24×24 viewBox、1.7px 描边、三档尺寸）。

**#1023 模板字段类型设置 UI + 内置模板可编辑**
- 模板编辑从裸文本语法（`键名:类型` textarea）改为字段列表 UI：每行 键名输入 + 类型选择器（复用面板八类类型菜单形态）+ 可选预设值。
- 内置模板放开编辑：用户改动落为对内置定义的**覆盖层**，提供「恢复默认」入口还原内置定义。

**#1024 `AppConfig.propAliasMap` 映射表落地**
- 按决策 8 补 `AppConfig.propAliasMap`（键名→类型映射）：Rust `validate_config` 白名单校验 + 三层合并 + `useConfig` 桥接热应用 + 设置区映射表管理 UI。
- 硬编码 `ALIAS`/`CANON_TYPE` 转为**内置默认可重置集合**，`resolveAlias` 先查应用配置再查内置默认；P-6 语义不变（只赋类型不改名）。

## Capabilities

### New Capabilities

（无——5 项均为既有能力 `doc-property-panel` 的需求修订。）

### Modified Capabilities

- `doc-property-panel`：P-1（面板可见时正文隐藏 frontmatter 源码块 + 折叠/隐藏态行为）、P-3（布尔值显示：值内仅图形 + title 提示）、P-4（工具条图标经图标注册表统一）、P-7（模板字段类型 UI + 内置模板可编辑覆盖层）、P-6（别称映射表升级为 `propAliasMap` 应用配置）。其中 P-2/P-8/P-9/P-10 不改。

## Impact

- **前端**：`src/components/Content/DocPropertyBar.tsx`（OpsBar 图标、ValueView/ValueEditor 布尔分支、TypeIcon）；`src/components/SettingsView.tsx`（属性模板区 + 新增映射表区）；`src/lib/frontmatter.ts`（ALIAS/CANON_TYPE 转默认集、resolveAlias 查配置优先）；新增 decoration 模块（编辑态隐藏 frontmatter 块）接入 `src/editors/decorations/index.ts`；CSS（新 decoration class 须同步 `src/styles/`）。
- **后端 / 配置面（数据面）**：`src-tauri/src/config.rs` 新增 `prop_alias_map` 字段 + `validate_config` 白名单；`src/hooks/useConfig.ts` 桥接热应用；命中 `docs/agents/data-surface.md` 信号，design.md 必含六栏表并跑机检三连。
- **设计系统**：`docs/design/system/spec.md` §2 需补 copy/cut/paste-up/down/trash/close 等图标条款（若注册表确无可用概念）。
- **测试**：单测（resolveAlias 配置优先、模板类型 UI 行为）+ Playwright e2e（值内无文字/悬停提示、工具条图标同源、frontmatter 隐藏与 undo 回归）；`verify.sh` 全绿交付。
- **风险**：CM6 隐藏 frontmatter 装饰若处理不当会吞掉光标/选区或破坏 undo 栈——用 `Decoration.replace` 范围精确限定在前言块且源码态不启用；详见 design.md Risks。
