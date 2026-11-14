# #806 文件动作迁移到页签右键菜单 — 实施记录

## 关键决策

1. **「10 项」的计数契约**：顶层可点项 = `[data-tab-menu] > button`，恰好 10；「导出」按钮与其就地子菜单包在 `div[data-export-row]` 容器内（与格头菜单同构），因此不占直接子按钮位。「打印」是紧随其后的直接子按钮。顺序断言用并集选择器 `[data-tab-menu] > button, [data-tab-menu] > [data-export-row]`（11 行），`idx(打印) === idx(导出) + 1`。既有 e2e 依赖的 `nth(4)=复制路径`、`nth(6)=移动到…` 因导出行改为容器而天然保持不变。
2. **子菜单复用 `data-testid="pane-export-submenu"`**：不新造 testid，沿用打印样式表 `.pane-export-submenu` 的语义，其他 e2e 只需换入口。子菜单点击展开（AC 明确「点击导出后」），再次点击收起。
3. **共享执行层 `src/lib/exportActions.ts`**：`runExportAction(action, target, notify)` 从 PaneTreeView 原样搬出（HTML 走 `.then`，其余走 await + pending 文案），提示文案与失败兜底逐字保留；日志 origin 由 `PaneHeader` 改为 `Export`。TabBar 传入 `tabs[menu.tabId]`（右键命中页签），PaneTreeView 不再执行导出。
4. **TabBar 自带 notice 浮层**（`data-export-notice`）：迁出格头后无人承载 showNotice，按 PaneHeader 同款实现补齐，保持「提示可见」行为。
5. **子菜单定位**：默认向左展开（`right:100%`）；`useLayoutEffect` 量测后左缘 < 8px 翻右侧、下缘越界改底对齐。Esc / 外点 / 滚动 / 失焦关闭协议沿用 #772，子菜单随菜单一起消失。
6. **格头菜单删三项后**：PANE_MENU_ITEMS 恰 6 项；runMenu 同步删 `refresh`/`openFolder` 分支；导出子菜单整套 hover/定时器机制移除（无保留价值）。

## 顺带修复的既有缺陷

- `e2e/mocks/tauri-mock.js`：`save_as_file` 有两条分支，前面一条（写 `__lastSaveAs`）提前 return，后面记录 `__biaoyue_saved_files__` 的分支永远不可达——`e2e/tauri/export-html.spec.ts` 因此必然失败（与本次改动无关）。已把记录逻辑并入前分支并删除死分支，`__lastSaveAs` 行为不变。

## 未修（与本票无关的既有失败）

- `e2e/tauri/reading-view.spec.ts`「沉浸态顶栏高度收拢为 0」：实测 -1（header 不存在），属阅读模式/沉浸态链路。
- `e2e/tauri/file-kinds.spec.ts`「视频 media:// 直连」：ArtPlayer/video 挂载断言失败，属媒体预览链路。
- 两者均在本次改动范围（菜单/导出）之外，CI 也不跑 E2E；单独记录待对应票处理。

## 假设

- 打印仅 `window.print()` 一次（票 2.1 会替换为预览态打印视图）。
- 导出按钮在无路径时禁用（沿用旧行为），子菜单各项沿用 `EXPORT_MENU_ITEMS` 自带的 disabled/title。
