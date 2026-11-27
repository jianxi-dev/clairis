# Tasks

## 1. 常驻 chrome 三档覆盖（P0）

- [ ] 1.1 `paneMode` 扩到全部常驻 chrome：`src/App.tsx` 把 `Cmd+Shift+U` 临时显现闸门（`data-pane-revealed`）扩到阅读轨与栏目头按钮；悬停预览不做档位门控（用户裁定硬核保留）；`src/components/Rail/ReadingRail.tsx`（或一个薄的呈现态包装组件）承载 `simple` / `hardcore` 的会话内阅读轨覆盖（进入记住 `railState`、切回 `standard` 恢复，不写 `railState` / `railPinHidden`）；`src/styles/editor.css` 按 `data-pane-mode` 实现 `.pane-actions` 三档（simple 恒显 / standard 现状 / hardcore 仅临时显现期显现）与 `.rail-root` 的 hardcore 隐藏 + 临时显现；`src/components/SettingsView.tsx` 更新「熟练模式」说明文案（覆盖阅读轨、栏目头按钮、悬停预览，并说明瞬态浮层不受影响）。**用户可见结果**：选「简洁」后顶栏、状态栏、阅读轨、栏目头按钮全部恒显，悬停预览仍受预览开关控制；选「常规」后一切与今天一致；选「硬核」后顶栏、状态栏、阅读轨、栏目头按钮全部隐藏且左缘悬停不再唤出阅读轨、指针 hover 不再唤出栏目头按钮，悬停预览仍按预览开关照常触发，按 `Cmd+Shift+U` 三者一并临时显现、3 秒无操作或 Esc 一并收起，而选区胶囊、AI 气泡、撤销条、捕获浮层、命令面板、快捷键帮助、右键菜单仍按既有动作 / 快捷键出现；切回「常规」后阅读轨回到用户原来的状态。**数据面**: 存储,校验,桥接,消费,回滚

- [ ] 1.2 关爱界面覆盖扩展：`src/styles/editor.css` 的 `data-pane-scale` zoom 白名单从「顶栏 / 状态栏 / 设置场景」扩到阅读轨 `.rail-root`（含浮层）、状态栏浮窗菜单、大纲菜单、文档属性面板、tooltip 提示层、右键菜单、AI 气泡、撤销条、QuickOpen、命令面板、快捷键帮助（实施时按 design 附录清单逐面对齐，先修页签右键菜单定位缺陷再叠加缩放）；e2e 补代表性断言（阅读轨 / 大纲 / 文档属性面板 large=1.2，正文与预览不变）；`src/components/SettingsView.tsx`「关爱界面」说明文案同步。**用户可见结果**：选「大」后左侧阅读轨、大纲、文档属性面板、各类浮窗菜单的文字与图标同步放大，正文排版不变；选「小」反之。**数据面**: 校验,桥接,消费

- [ ] 1.3 AI 通路锁定：确认并补测 `patch_config` 对 `paneMode` / `paneScale` 的调整（可写键集派生自 `AppConfig`，两键已在白名单；`validate_config` 枚举校验与写前快照沿用既有链）：Rust 用例——patch 两键各一次生效并落盘、`restore_config_snapshot` 可回滚、未知值拒绝且零写盘；`SKILL_MAP` 可改键表已含两行，补一行示例。**用户可见结果**：对 AI 说「切到硬核」或「界面放大一档」→ 设置立即生效并可回滚；说错值 → 明确报错且配置不变。**数据面**: 校验,规格
