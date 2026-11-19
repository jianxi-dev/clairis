# Proposal: shell-preview-refine

## Why

Issue [#1134](https://github.com/jianxi-dev/clairis/issues/1134) 指出外壳与预览面有五处体验问题，影响日常阅读与编辑的视觉舒适度：

1. **状态栏默认常显**，占用正文底边一行可视面积；用户希望默认隐藏，鼠标滑入底边时临时显隐。
2. **沉浸阅读提示文案**叫「沉浸阅读」，用户希望改叫「禅模式」，快捷键 ⌘⇧F 保持不变。
3. **页签**文件名与关闭图标之间空隙偏大；页签信息窗宽度偏宽；两个复制图标位置与颜色需要调整。
4. **脚本类文件预览态没有语法着色**，与编辑态不一致（`.js` / `.ts` / `.py` 等整文件预览显示为无颜色文本）。
5. **设置里的标题字体（H1–H6）**只能手输，用户希望从本机已安装字体里选。

## What Changes

- **状态栏默认隐藏**：初始状态改为不可见；指针进入窗口底边 8px 热区后临时显现，移出后隐藏。已有的双击显隐与钉住开关语义不变。沉浸态行为不受影响。
- **禅模式文案统一**：状态栏沉浸入口的 `title`、`aria-label`、图标 label 三处统一改为「禅模式」，`aria-keyshortcuts` 与 ⌘⇧F 快捷键保留。
- **页签收紧**：相邻页签间距从 32px 压缩一档至 24px；页签名信息窗宽度从 320px 收窄约 1/5 至 256px（token `--tab-info-width` 更新）；复制图标移到文件名节点之后，颜色降至弱化档 `--app-text-3`。
- **脚本预览高亮**：整文件预览分支接入既有高亮渲染器 `src/renderers/highlight.ts` 的 LANGUAGES 表，按扩展名查表；查不到语言的扩展名继续回退纯文本。不新写高亮器。
- **标题字体枚举**：新增 Rust 命令枚举本机已安装字体族，设置面板加载时填充 `datalist` 候选；选择即写入对应 H1–H6 字体；枚举失败时降级为可手输并给出提示。

## Capabilities

- **application-shell**：状态栏默认隐藏与底边热区滑入滑出机制。
- **navigation**：页签间距压缩、信息窗宽度收窄、复制图标位置与颜色调整。
- **reading**：脚本类文件整文件预览接入语法高亮。
- **configuration**：标题字体从本机字体枚举中选择。

## Impact

- **受影响源码**：`src/App.tsx`、`src/components/StatusBar.tsx`、`src/ui/icons.ts`、`src/components/TabBar.tsx`、`src/components/TabInfoPopover.tsx`、`src/styles/editor.css`、`src/styles/tokens.css`、`src/components/Content/PreviewView.tsx`、`src/components/SettingsView.tsx`、`src-tauri/src/commands/`（新增字体枚举命令）、`src-tauri/src/lib.rs`（注册命令）。
- **设计系统**：`docs/design/system/spec.md` 新增 `--tab-info-width` 条款（256px），旧值 320px 不再使用。
- **测试**：e2e 断言更新（状态栏可见性、页签间距、信息窗宽度、复制图标位置/颜色、预览高亮、字体候选）；新增 Rust 命令单测。
- **不在范围**：状态栏内部入口增删与顺序；页签拖拽与分栏；高亮主题配色统一；字体回退栈规则；「复制文件不生效」修复（已在 #1112 → PR #1113 完成）。
