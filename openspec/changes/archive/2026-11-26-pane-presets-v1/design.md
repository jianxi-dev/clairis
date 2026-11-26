## Context

应用外壳已有两套 chrome 可见性机制：主窗口状态栏默认隐藏 + 底部 16px 热区（`status-hotzone`，`src/App.tsx:106` 起），沉浸模式（`readingMode`）下顶栏收拢为 0 高 + 每栏 16px 顶部热区（`PaneTreeView.tsx:172` 的 `data-immersive-peek`）。缺的是「熟练模式」这一档：不要热区、只要快捷键唤出；以及「关爱界面」这一档：整体放大 chrome 而不放大正文。两者都应是**配置枚举**，由 Rust 配置层校验、前端桥接为根节点属性、CSS 消费。

## Goals / Non-Goals

- Goals：`paneMode` 三档（simple/standard/hardcore）与 `paneScale` 三档（small/medium/large）；设置页各一行三档单选；`readingMode` 优先；只切类名/属性，不重建 EditorView。
- Non-Goals：侧栏与交互触发的浮层（轮盘、工具条、菜单、popover）不缩放；浮动菜单/浮窗不在本轮（后续票）；空间/主题模板计划；AI 面工具；新数据面与 JSON 覆盖文件。

## Decisions

### D1 两个配置枚举，不是两个数据面

Codex 评审纠正：`paneMode` / `paneScale` 是**闭集枚举**，没有「用户可编辑的集合形状」，也不需要 AI 逐项改写。做成数据面会引入无消费者的默认文件、覆盖合并、面级快照与 AI 工具，纯属机制空转。故落点为 `AppConfig` 的两个 `Option<String>` 字段 + `validate_config` 白名单。

### D2 默认值 `standard` / `medium`

`paneMode` 默认 `standard`：与现状等价（顶栏常显、状态栏默认隐藏并由底部热区唤出），升级无感。`paneScale` 默认 `medium`（倍率 1.0）：不改变任何现有尺寸。两者缺省（`None`）时由默认值填充，老配置无需迁移。

### D3 只呈现，不写穿

`paneMode` 不写回 `statusBarHidden`、不写回侧栏基态、不写回 `immersiveChromeVisible`。它只驱动应用根节点的 `data-pane-mode` 属性，CSS 按属性决定 chrome 的显隐与热区。因此不需要快照语义之外的新回滚机制，沿用既有 `snapshots/` + `restore_config_snapshot` 即可。

### D4 hardcore 临时显现：`Cmd+Shift+U` + 3 秒/Esc + 1px 提示线

hardcore 下无热区，`Cmd+Shift+U` 切换临时显现；显现后 3 秒无操作自动收起，Esc 立即收起。顶部保留一条 1px 提示线（取既有边框 token），让「有 chrome 但藏着」可被发现。选 `U` 是因为 `Cmd+Shift+T` 在非沉浸态已被 AI 翻译占用（既有缺陷，见 Risks）。

### D5 缩放走容器级 `zoom`，作用域显式列举

`paneScale` 映射为根节点 `data-pane-scale`，CSS 只对**显式列举**的 chrome 容器施加 `zoom`：顶栏 `.app-chrome`、状态栏 `.app-status-bar`、设置场景容器。正文/预览/编辑器**不缩放**（`zoom` 不继承到这些容器）。`zoom` 同时缩放文字、图标与命中区，不需要逐项改 padding。派生像素值不写新字面量，只写倍率。

### D6 优先级 `readingMode` > `paneMode`

沉浸模式（`readingMode`）的既有行为不变：进入沉浸后仍按沉浸规则收拢/唤出，`paneMode` 不覆盖它。即 `readingMode` 为真时，`paneMode` 的三档状态机让位，退出沉浸后恢复。

### D7 不重建 EditorView，热应用走既有配置监听

切换只改类名/属性，沿用 preview/edit/source 的 CSS display 切换约定，保留 CM6 undo/选区/编辑状态。配置变更走既有 `config-changed` 事件（`useConfig.ts` 的 `scheduleExternalReload`），1 秒内生效，不重启应用。

## 数据面

| 落点 | 位置 | 载体/符号 | 判据 |
|---|---|---|---|
| 规格 | design-system:§4.1 / design-system:§7.7 | — | 判据 = 本变更 anchors 逐条断言 |
| 存储 | src-tauri/src/config.rs | pane_mode / pane_scale | Option 字段，缺省由默认值填充 |
| 校验 | src-tauri/src/config.rs | validate_config | 枚举白名单，未知值拒绝 |
| 桥接 | src/hooks/useConfig.ts | applyRustConfig | 把两键映射为根节点 data-pane-mode / data-pane-scale |
| 消费 | src/App.tsx | chrome 容器类名与快捷键闸门 | 只切类名，不重建 EditorView |
| 回滚 | snapshots/ | restore_config_snapshot | 既有写前快照，一步恢复 |

票面第 8 字段（数据面）：1.1=`存储,校验,桥接,消费,回滚`；1.2=`存储,校验,桥接,消费`。

## Risks / Trade-offs

- **既有缺陷 1（键位）**：`Cmd+Shift+T` 在非沉浸态已绑定 AI 翻译（`src/App.tsx:622-639`），故 hardcore 选用 `Cmd+Shift+U`；若未来翻译改键，需复核本键位。
- **既有缺陷 2（校验白名单不一致）**：`validate_config` 目前只接受 `readerSkin ∈ {paper, plain}`（`config.rs:645`），而阅读预设面允许 `paper|indigo|moss|clay`。这是独立缺陷，需单开缺陷票；在修复前，任何空间模板不得引用阅读预设的皮肤值。
- `zoom` 在 WKWebView 下对 `position: fixed` 子元素的影响未验证：状态栏浮动态（`.app-status-bar--floating`）与设置场景容器需实测；若 fixed 定位异常，回退方案是只缩放到顶栏 + 设置场景，状态栏改用 font-size 档位。
- hardcore 的 1px 提示线可能被误认为渲染瑕疵；靠设计系统条款与锚点固定，不靠口头约定。

## Open Questions

无。范围以本 change 的 `## 输入对账`（issue #1583）与上述 Non-Goals 为准；两条既有缺陷不在本轮修复，另行开票。
