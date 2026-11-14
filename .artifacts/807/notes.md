# #807 打印按 Markdown 预览态输出 — 交付记录

## 结论

页签右键「打印」不再直接 `window.print()`，改为挂载一份独立的 Markdown 预览打印视图：

- 同一 `renderMarkdown` 管线（图片宽高/对齐/裁剪、媒体解析、callout、mermaid `<pre>`）；
- mermaid 经既有 `renderAll` 绘制成 SVG 并 await 完成后才调用一次 `window.print()`；
- 屏幕外可布局挂载（`position:absolute; left:-10000px; width:794px; visibility:hidden; pointer-events:none`），
  不用 `display:none`（mermaid 文本测量需要真实盒子）；
- 打印媒体下应用根 `display:none`（由 `documentElement[data-biaoyue-printing]` 门控），
  打印视图回到正常流、白底黑字、复用 `.preview-content` 阅读排版；
- `afterprint` + 兜底超时清理（幂等），移除视图、清标记、还原所属格 `.content-scroll` 的 scrollTop；
- mermaid 失败保留可读源码块（引擎既有行为），渲染整体失败退化为 `<pre>` 源码块并记日志，均不阻断打印。

## 变更文件

| 文件 | 作用 |
| --- | --- |
| `src/lib/printPreview.ts`（新增，102 纯 LOC） | `printMarkdownPreview(target, opts)`：挂载 → 绘制 → 打印 → 清理 |
| `src/styles/print.css` | 打印视图屏幕外/打印态规则；`html/body/#root` 放开高度与溢出；应用根按标记隐藏 |
| `src/components/TabBar.tsx` | `data-menu-item="print"` 点击接线（取 `tabs[menu.tabId]`，传 `paneId`） |
| `e2e/print.spec.ts` | 新增 5 条 #807 用例（快照桩记录调用瞬间 DOM） |

未触碰导出行为、`PaneTreeView`、`paneHeaderMenu.ts`、`reader.css`、`markdown.ts` 渲染语义。

## 验收命令与原始输出

### `npx tsc --noEmit`

```
TSC_EXIT=0
```

### `npx eslint src/`（改动文件单独复跑）

```
ESLINT_CHANGED_EXIT=0
```

全量 `npx eslint src/`：`✖ 82 problems (0 errors, 82 warnings)` —— 警告全部来自既有文件
（react-hooks / 未使用变量），本次改动文件 0 警告 0 错误。

### `npm test`

```
 Test Files  124 passed (124)
      Tests  1573 passed (1573)
   Duration  14.03s
```

### `npx playwright test e2e/print.spec.ts e2e/menu-migration.spec.ts`

```
Running 16 tests using 2 workers
  16 passed (18.8s)
```

覆盖：原有 6 条 print.spec 断言全部保留并通过；新增 5 条 #807 用例；
menu-migration 5 条（含打印项点击计数）通过。

## 证据（`.artifacts/807/`）

`state-coverage.json` 记录 5 个状态（均由 `scripts/cw-evidence.sh record-state` 写入）：

| state | 截图 | 断言 |
| --- | --- | --- |
| print-view-mounted | `print-view-mounted.png` | mermaid 已绘成 SVG，纸上为预览排版 |
| print-media-on | `print-media-on.png` | 应用根 display:none，打印视图可见且静态定位 |
| edit-mode-print | `edit-mode-print.png` | 编辑态触发仍输出预览排版，模式保持 edit |
| cleaned-up | `cleaned-up.png` | 打印视图无残留、标记清除、滚动位置还原 |
| invalid-mermaid | `invalid-mermaid.png` | 坏图保留可读源码块，打印照常调用 |

截图经 `page.emulateMedia({ media: "print" })` 采集（QG-5 允许的打印介质截图）。

## 假设与限制

1. **适用范围**：打印视图按任务约定对目标页签内容走 Markdown 预览管线。对 html / pdf /
   图片 / 视频 / 音频类页签，内容不会走各自预览器（pdf/图片/音视频打印为空或源码），
   本变更不改变这些类型的原有行为，也不新增分支处理。
2. **应用根隐藏的门控**：`@media print` 下隐藏 `.app-root` 的规则以
   `html[data-biaoyue-printing]` 为条件。这样浏览器直接 Ctrl+P（未挂打印视图）仍沿用旧版式，
   既有 print e2e 断言与元素截图路径不受影响；菜单打印路径始终置标记，满足「应用外壳不出纸」。
3. **兜底清理时长 3000ms**：计时从 `window.print()` 返回后起算。Chrome 打印期间阻塞，
   返回时 `afterprint` 已触发，不会提前摘掉出纸中的视图；Firefox / 测试桩由该计时器收场。
4. **`paneId` 来源**：TabBar 传入所在格 id，模块据此经 `getPanelScrollEl` 还原滚动；
   未传 `paneId` 的遗留调用点（ContentSplitView，当前未被任何路由引用）不做滚动还原。
5. **证据截图时机**：打印视图挂载后 ~3s 内完成截图；清理后状态另行断言（poll 至节点数 0）。
6. **`.artifacts/806/pane-menu-open.png`**：运行 menu-migration.spec.ts 时该测试重写了这张
   既有追踪截图（二进制字节变化），非本次代码改动引入，未提交。
7. **未做真实 Tauri 窗口验证**：按任务给定的验收清单执行（tsc / eslint / vitest / Playwright），
   未启动 `npm run tauri dev`；打印链路在 Playwright Chromium 真实渲染环境中验证。

## 关键实现位置

- 打印视图生命周期：`src/lib/printPreview.ts`（`PRINT_ROOT_ID`、`CLEANUP_SAFETY_MS`）
- 媒体查询规则：`src/styles/print.css` 顶部 `#biaoyue-print-root` 与 `@media print` 内同名复位
- 入口接线：`src/components/TabBar.tsx` `[data-menu-item="print"]`
