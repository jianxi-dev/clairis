## Context

`pane-presets-v1` 落地的 `paneMode` 只驱动顶栏 `.app-chrome` 与状态栏 `.app-status-bar`（`src/styles/editor.css:1794-1845` 的 `html[data-pane-mode="hardcore"]` 规则块、`src/App.tsx:1143-1210` 的渲染闸门）。界面上还有三块常驻 chrome 未被三档语义支配：

- 阅读轨（`src/components/Rail/ReadingRail.tsx`，根类 `.rail-root`）：三态 `collapsed | hover | pinned`，由 `railState` 与 `railPinHidden` 决定，左缘悬停经 `onEnter` / `onLeave` 在 `collapsed` 与 `hover` 间迁移（`ReadingRail.tsx:1084-1102`）。
- 栏目头动作按钮（`.pane-actions`，`src/styles/editor.css:1639-1655`）：默认 `opacity: 0`，仅 `:hover` / `:has(:focus-visible)` / `[data-open="true"]` 时显现。
- 悬停预览（`FloatingPreviewList` + `previewSettings`）：`previewSettings.enabled` / `railHover` 开关下由指针 hover 触发（`ReadingRail.tsx:1128-1196`），另有 `Cmd+Shift+V` 钉住预览开关（`src/App.tsx:743-748`）。

结果是硬核档「chrome 常隐」只对顶栏与状态栏成立：阅读轨仍能被左缘悬停唤出、栏目头按钮仍随 hover 浮现、悬停预览仍被指针触发。本 change 把三档语义扩展到这三块，并显式排除交互触发的浮层。

## Goals / Non-Goals

- Goals：`paneMode` 三档覆盖全部常驻 chrome（顶栏、状态栏、阅读轨、栏目头按钮、悬停预览）；hardcore 下 `Cmd+Shift+U` 一并临时显现；瞬态浮层不被隐藏；`readingMode` 优先；只呈现不写穿。
- Non-Goals：不改 `paneScale`（CF-8）；不改既有顶栏 / 状态栏行为；不改 `readingMode` 既有显隐；不新增配置键或数据面；不改 `Cmd+Shift+V` 钉住预览语义；不动交互触发浮层（选区胶囊、AI 气泡、撤销条、捕获浮层、命令面板、快捷键帮助、右键菜单）。

## Decisions

### D1 阅读轨：会话内呈现态覆盖，退出恢复

`simple` 与 `hardcore` 需要覆盖用户既有的 `railState`（`simple` 强制可见、`hardcore` 强制隐藏），但 `railState` 是持久化状态，写穿会篡改用户偏好。做法：进入 `simple` / `hardcore` 时记住当前 `railState`，用一个会话内呈现态（presentational override）驱动阅读轨显隐；切回 `standard` 或退出该档时恢复原值。不写 `railState`、不写 `railPinHidden`。落点为 `ReadingRail.tsx` 或一个薄的呈现态包装组件，`App.tsx` 持有 override 状态。

### D2 栏目头按钮：CSS 按 `data-pane-mode` 显隐

`.pane-actions` 的显隐由 `src/styles/editor.css` 按根节点 `data-pane-mode` 属性接管：`simple` 恒显（`opacity: 1`）；`standard` 保持现状（hover / focus / 菜单打开时显现）；`hardcore` 默认 `opacity: 0`，仅在 `data-pane-revealed="true"`（临时显现期）显现。不改用 JS 逐按钮控制，避免与既有 hover / focus / `data-open` 规则打架。

### D3 悬停预览：不做档位门控（用户 2026-11-27 裁定）

用户明确「悬停预览在硬核下保留」。三档均不改变悬停预览行为，始终受用户预览开关（`Cmd+Shift+V` / 预览设置）约束；本 change 不触碰预览触发路径。

### D4 hardcore 临时显现：`Cmd+Shift+U` 一并扩到阅读轨与栏目头按钮

既有 `Cmd+Shift+U` 只临时显现顶栏与状态栏（`data-pane-revealed`）。本 change 把同一属性作为唯一闸门：阅读轨在 `hardcore` 隐藏态下，`data-pane-revealed="true"` 时按 `hover` 态显现；栏目头按钮在 `data-pane-revealed="true"` 时 `opacity: 1`。3 秒空闲或 Esc 收起的既有语义不变，收起后三块一并回到隐藏。

### D5 瞬态浮层显式排除

选区胶囊、AI 气泡、撤销条、捕获浮层、命令面板、快捷键帮助、右键菜单等由交互 / 快捷键触发的浮层 SHALL NOT 被 `paneMode` 隐藏。它们不是「常驻 chrome」，而是动作的结果，隐藏会让操作无反馈。规格与锚点显式记录该排除，避免实现期被「一刀切隐藏」误伤。

### D6 不写穿、不新增配置键

`paneMode` 仍只驱动根节点 `data-pane-mode`（桥接 `src/hooks/useConfig.ts` 的 `applyPaneMode` 不变）。阅读轨的档内覆盖是会话内呈现态，不落盘；预览设置、`statusBarHidden`、`railPinHidden`、`immersiveChromeVisible` 均不写回。回滚沿用既有 `snapshots/` + `restore_config_snapshot`，无新增持久状态。

## 数据面

| 落点 | 位置 | 载体/符号 | 判据 |
|---|---|---|---|
| 规格 | design-system:§7.7 | — | 判据 = 本变更 anchors 逐条断言 |
| 存储 | src-tauri/src/config.rs | pane_mode | 既有键，无新字段 |
| 校验 | src-tauri/src/config.rs | validate_config | 既有三值枚举，不变 |
| 桥接 | src/hooks/useConfig.ts | applyPaneMode | 既有根节点属性，不变 |
| 消费 | src/App.tsx | ReadingRail / pane-actions / preview gate | 三档读同一属性 |
| 回滚 | snapshots/ | restore_config_snapshot | 既有写前快照一步恢复，无新增持久状态 |

票面第 8 字段（数据面）：1.1=`存储,校验,桥接,消费,回滚`。

## Risks / Trade-offs

- **阅读轨状态恢复**：`simple` / `hardcore` 下若用户在档内手动改 `railState`（如按 `Cmd+\`），恢复时可能覆盖该次手动操作。缓解：override 只在切入时读一次、切回 `standard` 时恢复，档内手动操作以用户最后一次为准（恢复值取档内最后一次已知 `railState`）。
- **悬停预览门控的边界**：`hardcore` 下若用户用 `Cmd+Shift+V` 主动打开预览，随后指针 hover 其它行不应重锚 / 重开；门控须落在计时器启动处而非预览组件内，避免误伤钉住预览。
- **hardcore 可发现性**：`Cmd+Shift+U` 临时显现已有一条 1px 顶部提示线（既有），扩到阅读轨后提示线仍只指示顶栏区域；阅读轨的临时显现靠左缘面板自身可见，不再加额外提示（避免像素值膨胀）。

## Open Questions

无。范围以用户反馈「不只是顶栏与状态栏两个，其他的显隐应该也有哇」与上述 Non-Goals 为准；既有 `paneScale`（CF-8）不在本轮。

### D7 关爱界面覆盖扩展（zoom 白名单）

`paneScale` 的容器级 `zoom` 白名单从「顶栏 / 状态栏 / 设置场景」扩到：阅读轨 `.rail-root`（含浮层形态）、状态栏浮窗菜单、大纲菜单、文档属性面板、tooltip 提示层、右键菜单、AI 气泡、撤销条、QuickOpen、命令面板、快捷键帮助。实施票内按此清单逐面对齐并补代表性 e2e 断言；正文 / 预览 / 编辑器内容不进白名单。已登记既有缺陷：页签右键菜单错位且与页签信息窗同显（用户截图，`~/Downloads/页签文件信息窗和右键菜单问题.png`）——缩放浮层前先修该定位缺陷，避免在坏定位上叠加缩放。
