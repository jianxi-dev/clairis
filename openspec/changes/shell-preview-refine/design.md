# Design: shell-preview-refine

## Context

Issue #1134 汇总了外壳与预览面的五处体验问题。当前现状（经源码核实）：

- `src/App.tsx:97` `statusBarHidden` 初值 `false`（默认显示），已有 `statusBarPeek` 机制（底边热区 0.5s 显现），但默认就是显示的，用户希望默认隐藏。
- `src/components/StatusBar.tsx:504` `aria-label="沉浸阅读"`、`:511` `title="沉浸阅读（⌘⇧F）"`；`src/ui/icons.ts:364` `label: "沉浸"`。三处文案需统一为「禅模式」。
- `src/styles/tokens.css:54` `--tab-info-width: 320px`；`src/components/TabBar.tsx:478` 页签条 `gap-8`（32px）；`src/components/TabInfoPopover.tsx:210-240` 复制图标位于路径行末尾。
- `src/renderers/highlight.ts:18` LANGUAGES 表含 js/mjs/cjs/ts/py 等，但 `src/components/Content/PreviewView.tsx:186` 的整文件预览分支调用 `renderTextContent`，未接入高亮器。
- `src/components/SettingsView.tsx:769` `headingFontOptions` 存在但枚举门控未生效（`headingFontsEnumerated` 逻辑未接 Rust 命令）。

约束：视觉数值只在 `docs/design/system/spec.md` 定义一次；delta 场景标题逐字保留主规格已有场景。

## Goals / Non-Goals

**Goals**

- 状态栏默认隐藏，底边 8px 热区滑入滑出，钉住开关语义不变。
- 禅模式文案三处统一，快捷键保留。
- 页签间距压缩一档、信息窗收窄约 1/5、复制图标移到文件名后并弱化。
- 脚本预览接入既有高亮渲染器，未知扩展名回退纯文本。
- 标题字体从本机枚举中选，枚举失败降级手输。

**Non-Goals**

- 不改状态栏内部入口结构与顺序。
- 不改页签拖拽、分栏、沉浸态 chrome 折叠规则。
- 不统一高亮主题配色与编辑态配色（只要求预览态接入同一渲染器）。
- 不做字体回退栈规则与 `--type-font-sans` 定义。
- 不纳入「复制文件不生效」修复（#1112 已修复）。

## Decisions

### D1 状态栏默认隐藏 + 底边热区滑入滑出

- `statusBarHidden` 初值从 `false` 改为 `true`（默认隐藏）。保留现有 `statusBarPeek` 机制，热区为窗口底边 8px（取自设计系统间距刻度 §3 `--space-8`）。指针进入热区后临时显现，移出后隐藏。
- 已有钉住开关（双击显隐）语义不变：钉住时状态栏常显，不随热区逻辑改变。
- 沉浸态行为不受影响：沉浸态下状态栏自动隐藏的逻辑保持不变，热区仍可临时唤出。
- 备选：增加独立「默认隐藏」开关（增加配置面，用户已明确默认隐藏，不需要额外开关）。弃用。

### D2 禅模式文案统一

- 三处文案统一改为「禅模式」：`StatusBar.tsx` 的 `aria-label` 与 `title`、`icons.ts` 的 `label`。
- `title` 改为「禅模式（⌘⇧F）」，`aria-label` 改为「禅模式」，图标 `label` 改为「禅模式」。
- `aria-keyshortcuts` 与 ⌘⇧F 快捷键保留不变。
- 备选：只改 `title` 不改 `aria-label`（可访问性不一致）。弃用。

### D3 页签收紧：间距、信息窗宽度、复制图标

- **间距**：页签条 `gap` 从 32px 压缩至 24px（取自间距刻度 §3 `--space-24`）。主规格 `application-shell` G-6 与 `navigation`「页签条与格头」同步更新为 24px。
- **信息窗宽度**：`--tab-info-width` 从 320px 收窄约 1/5 至 256px。在 `docs/design/system/spec.md` §7.4 新增条款登记 `--tab-info-width`（256px）。`TabInfoPopover.tsx` 注释与 `editor.css` 同步更新。
- **复制图标**：从路径行末尾移到文件名节点之后，颜色降至 `--app-text-3`（设计系统 §6 语义色弱化档）。两个复制图标（复制路径 / 复制文件）均移动并统一颜色。
- 备选（间距）：16px（太紧凑，影响可读性）；20px（非刻度值，违反间距刻度规则）。均弃用。
- 备选（信息窗宽度）：300px（非整数刻度，且收窄幅度不够）；280px（收窄幅度不够）。均弃用。

### D4 脚本预览接入高亮

- `PreviewView.tsx` 的整文件预览分支（`renderTextContent` 调用处）改为：先按文件扩展名查 `highlight.ts` 的 LANGUAGES 表，命中则调用 `highlightCodeBlock` 渲染带语法颜色的输出；未命中则回退纯文本渲染。
- 不新写高亮器，完全复用 `highlight.ts` 的 LANGUAGES 表与 `highlightCodeBlock` 函数。
- 主规格 `reading`「文本与脚本预览语法」的「语法颜色」场景已存在，本次 delta 保留场景标题，补充整文件预览分支的明确表述。

### D5 标题字体枚举

- 新增 Rust 命令 `list_fonts`：枚举本机已安装字体族，返回字符串数组。在 `src-tauri/src/commands/` 新增 `font.rs`，在 `lib.rs` 的 `invoke_handler` 注册。
- `SettingsView.tsx` 设置面板加载时调用该命令，将结果填入 `headingFontOptions`，供 `datalist` 使用。
- 枚举失败（命令返回错误或空数组）时降级为可手输，显示提示「字体枚举失败，请手动输入」。
- 已有 `headingFontOptions` 状态与 `datalist` 渲染逻辑保留，仅替换数据来源。
- 备选：前端直接用 CSS `font-family` 枚举（浏览器不提供本机字体列表 API，不可行）。弃用。

## Risks / Trade-offs

- [状态栏默认隐藏可能让新用户找不到入口] → 底边热区 8px 滑入可发现，且钉住开关保留，双击可恢复常显。
- [页签间距从 32px 压缩至 24px 可能让长文件名页签更拥挤] → 120px 标题上限已配合省略号，信息窗承载完整名；24px 仍满足可读性。
- [信息窗从 320px 收窄至 256px 可能让长路径换行更多] → 文件名换行已支持，路径每层可点击定位，不影响功能。
- [复制图标移到文件名后可能与关闭图标距离过近] → 颜色降至弱化档，视觉层级清晰，不抢注意力。
- [字体枚举命令在不同平台返回差异] → 枚举失败降级手输，不阻塞设置功能。

## Migration Plan

1. 状态栏默认隐藏 + 热区逻辑（`App.tsx`、`StatusBar.tsx`）。
2. 禅模式文案三处统一（`StatusBar.tsx`、`icons.ts`）。
3. 页签间距、信息窗宽度、复制图标位置与颜色（`TabBar.tsx`、`TabInfoPopover.tsx`、`editor.css`、`tokens.css`、design-system spec）。
4. 脚本预览高亮（`PreviewView.tsx`）。
5. 字体枚举命令与设置面板接入（`font.rs`、`lib.rs`、`SettingsView.tsx`）。
6. 回滚：每票独立可回滚；`--tab-info-width` 与间距更新同批回退。

## Open Questions

- 无。用户已在 #1134 明确五项需求与方案。

## 数据面

| 落点 | 位置 | 载体/符号 | 判据 |
|---|---|---|---|
| 规格 | design-system:§7.4 | --tab-info-width | 在 §7.4 新增 `--tab-info-width` 条款，值 256px，旧值 320px 不再使用 |
| 存储 | src/styles/tokens.css | --tab-info-width | token 定义唯一，值为 256px，组件与 e2e 均按变量名取值 |
| 校验 | src-tauri/src/commands/font.rs | list_fonts | 返回非空字符串数组；枚举失败时返回明确错误 |
| 桥接 | src-tauri/src/lib.rs | list_fonts | 命令注册进 `invoke_handler`，前端 `invoke` 名称与注册名一致 |
| 消费 | src/components/SettingsView.tsx | headingFontOptions | 设置面板加载时调用 `list_fonts` 填充 `datalist`；枚举失败降级手输 |
| 回滚 | docs/design/system/spec.md §7.4 | --tab-info-width | 条款与 token 值同批回退，二者不得只退其一 |
