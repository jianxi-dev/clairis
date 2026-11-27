# Tasks

## 1. 数值参数数据化（P0）

- [ ] 1.1 `care-scale` 面与缩放消费端 var 化：`src-tauri/src/surfaces.rs` 追加 `SurfaceShape::CareScale` 与 `SURFACES` 登记行、`validate_care_scale`（`scale` ∈ [0.8,1.5]、步长 0.05 归整后校验、越界过滤并聚合告警）；新增 `src-tauri/src/resources/care-scale.default.json`（small 0.9 / medium 1.0 / large 1.2，标签 小/中/大）；`src/hooks/useConfig.ts` 的 `applyPaneScale` 改为从面解析选中 id、写 `--pane-scale-factor` 到 `<html>`（缺省/非法 → 1）并设置 `data-pane-scale-active`（factor ≠ 1 时）；`src/styles/editor.css` 的 #1606 zoom 白名单块从硬编码 `zoom: 0.9/1.2` 改为 `zoom: var(--pane-scale-factor, 1)`，**容器清单不变**。**用户可见结果**：默认三档与今天逐像素一致；AI 说「关爱界面放大一点」→ 在 0.8–1.5 内改 nearest 0.05 生效并落盘、可回滚；越界值被拒绝并聚合告警。**数据面**: 存储,校验,桥接,消费,回滚

- [ ] 1.2 `pane-modes` 面与热区/时长/提示线 var 化：`src-tauri/src/surfaces.rs` 追加 `SurfaceShape::PaneMode` 与 `SURFACES` 登记行、`validate_pane_mode`（`hotzonePx` ∈ [12,24]；`revealMs` ∈ [1000,10000] 或 0 仅非 hardcore；`hintLinePx` ∈ [0,2]；越界过滤并聚合告警）；新增 `src-tauri/src/resources/pane-modes.default.json`（simple {16,0,0} / standard {16,0,0} / hardcore {0,3000,1}）；`src/hooks/useConfig.ts` 新增从面读取热区/提示线/reveal 时长并写 `--pane-hotzone-px` / `--pane-hint-px`；`src/styles/editor.css` 的 `.status-hotzone` / 顶部 peek / `.pane-leaf::before` 改读变量；`src/App.tsx` 的 `STATUS_HOTZONE_HEIGHT` 与 3000ms 计时器改读面。**用户可见结果**：默认三档行为与今天一致；AI 说「热区高一点」或「硬核显现久一点」→ 在边界内改值即时生效、可回滚；`readingMode` 优先、`Cmd+Shift+U` 语义、瞬态浮层排除均不变。**数据面**: 存储,校验,桥接,消费,回滚

- [ ] 1.3 AI 通路锁定与文档：确认 `read_data_surface` / `patch_data_surface` / `restore_surface_snapshot` 对两面可用（注册表驱动，无需新工具）；Rust 用例——两面各一次 patch 生效并落盘、`items:null` 恢复默认、`restore_surface_snapshot` 可回滚、越界项拒绝且零写盘；`src-tauri/src/config.rs` 的 `SKILL_MAP` 数据面表增补两行与示例。**用户可见结果**：对 AI 说「关爱界面放大到 1.3」或「硬核显现改成 5 秒」→ 设置立即生效并可回滚；说越界值 → 明确报错且配置不变。**数据面**: 规格
