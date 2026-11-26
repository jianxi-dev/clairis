# Tasks

## 1. 窗格预设（P0）

- [ ] 1.1 `paneMode` 三档：`src-tauri/src/config.rs` 新增 `pane_mode: Option<String>` 与 `validate_config` 白名单（`simple|standard|hardcore`，缺省 `standard`）；`src/hooks/useConfig.ts` 的 `applyRustConfig` 把该键映射为应用根节点 `data-pane-mode`；`src/styles/editor.css` 按属性实现三档——simple 常显、standard 保持现状（顶栏常显、状态栏默认隐藏并经底部 16px 热区唤出）、hardcore 无热区并由 `Cmd+Shift+U` 临时显现（3 秒空闲或 Esc 收起）且保留 1px 顶部提示线；`src/App.tsx` 加快捷键闸门（`readingMode` 优先，不重建 EditorView）；设置页新增一行三档单选（`data-testid="pane-mode-<id>"`）。**用户可见结果**：设置里选「熟练」后 chrome 不再被热区唤出，按 `Cmd+Shift+U` 才临时出现，3 秒后自动收起、Esc 立即收起；选「简洁」后 chrome 常显。**数据面**: 存储,校验,桥接,消费,回滚

- [ ] 1.2 `paneScale` 三档：`src-tauri/src/config.rs` 新增 `pane_scale: Option<String>` 与 `validate_config` 白名单（`small|medium|large`，缺省 `medium`）；`src/hooks/useConfig.ts` 的 `applyRustConfig` 把该键映射为应用根节点 `data-pane-scale`；`src/styles/editor.css` 只对显式列举的 chrome 容器（顶栏 `.app-chrome`、状态栏 `.app-status-bar`、设置场景容器）施加容器级 `zoom`（0.9 / 1.0 / 1.2），正文/预览/编辑器不缩放；设置页新增一行三档单选（`data-testid="pane-scale-<id>"`）。**用户可见结果**：设置里选「大」后顶栏、状态栏与设置面板整体放大（文字、图标、命中区同比），正文排版尺寸不变；选「小」反之。**数据面**: 存储,校验,桥接,消费
