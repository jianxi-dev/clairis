## Why

熟练用户缺少「chrome 常隐 + 快捷键唤出」的极简模式，关爱场景（长辈/低视力）缺少整体放大界面的手段；两者都只能靠用户逐项拨设置或直接改配置文件。Codex 评审纠正了最初方案：这两项是**纯配置枚举**（`paneMode` / `paneScale`），不是两个新数据面——它们没有用户可编辑的集合形状、没有 AI 写通路需求，走数据面只会增加无消费者的机制。本轮按用户确认的范围立项（本批 spec issue）。

## What Changes

- 新增两个配置枚举：`paneMode`（`simple | standard | hardcore`，默认 `standard`）与 `paneScale`（`small | medium | large`，默认 `medium`）。
- `paneMode` 只驱动应用根节点的 `data-pane-mode` 属性：simple 常显；standard 保持现状（顶栏常显、状态栏默认隐藏并由底部 16px 热区唤出）；hardcore 无热区，`Cmd+Shift+U` 临时显现，3 秒空闲或 Esc 收起，并保留 1px 顶部提示线。
- `paneScale` 只驱动 `data-pane-scale` 属性，对显式列出的 chrome 容器（顶栏、状态栏、设置场景）施加容器级 `zoom`（0.9 / 1.0 / 1.2），不作用于正文/预览/编辑器。
- 设置页新增两行三档单选（`data-testid="pane-mode-<id>"` / `data-testid="pane-scale-<id>"`）。
- 不新增数据面、不新增 JSON 覆盖文件、不新增 AI 面工具；空间/主题模板计划不在本轮。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `application-shell`：新增 G-13 Chrome 显隐三档（熟练模式）——simple/standard/hardcore 的可见性状态机、热区口径、`Cmd+Shift+U` 临时显现与 1px 提示线、`readingMode` 优先且不重建 EditorView。
- `configuration`：新增 CF-8 窗格预设配置（`paneMode` / `paneScale`）——枚举白名单校验、缺省填充、热应用不重启、缩放不触及正文。

## Impact

- 代码：`src-tauri/src/config.rs`（两个 Option 字段 + `validate_config` 白名单）、`src/hooks/useConfig.ts`（`applyRustConfig` 映射为根节点 `data-pane-mode` / `data-pane-scale`）、`src/App.tsx`（chrome 容器类名与快捷键闸门）、`src/styles/editor.css`（三档样式与 `zoom` 作用域）、`src/components/SettingsView.tsx`（两行设置）。
- 设计系统：`docs/design/system/spec.md` 新增 §4.1 与 §7.7；`docs/design/system/decisions.md` 追加两行。
- 测试：Rust 校验用例、前端契约（属性映射与设置项）、e2e（三档切换、热区、快捷键、缩放作用域）。
- 兼容：既有 `statusBarHidden` / 侧栏基态不被写穿；`readingMode` 行为不变；正文排版不变。
