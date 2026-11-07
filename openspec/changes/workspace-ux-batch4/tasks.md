# Tasks: 工作区交互第四批修正

> 垂直切片：每条任务都能单独交付并在页面上看到结果。
> 依赖：1.1 → 2.1；3.1 → 4.1；5.1 独立。（同文件交集决定串行，不是功能依赖。）

## 1. 分栏布局与页签拖拽正确性（反馈 4 / 5 / 7 / 10）

- [ ] 1.1 分栏 id 唯一、分隔线独立、页签拖拽有轨迹、右键分栏搬文件、跨格拖拽不复制栏目

  实现要点：
  - `paneTree.ts` / `stores/index.ts`：`branch` / `pane` id 改为跨重启唯一（`crypto.randomUUID` 派生）；`setBranchRatio` 只更新首个匹配分支
  - `useDragResize.ts`：RAF 合并为「一帧一次、只取最新事件」；`PaneDivider` 加 `shrink-0` 与 pointer capture
  - `TabBar.tsx`：pointerdown `setPointerCapture`；4px 插入轨迹、被拖页签虚线描边、目标格 `data-tab-drop` 落区环；`pointercancel` 收尾
  - `stores/index.ts` + `TabBar.tsx`：新增 `splitPaneWithTab(dir, tabId)`；页面右键分栏搬入当前页签；栏目「更多」保持空栏
  - `stores/index.ts`：`dropFileOnPane` 文件已在目标格时只聚焦切签；源格变空且非根时塌缩
  - 测试：`src/__tests__/paneTree.test.ts`、`paneTreeStore.test.ts`；`e2e/pane-drag.spec.ts` 扩展

## 2. 页签视觉与沉浸收纳（反馈 8 / 9 / 11）

- [ ] 2.1 未选中页签透明无胶囊、悬停才出胶囊、页签条透明、顶栏同色、沉浸收纳与悬浮条

  实现要点：
  - `TabBar.tsx`：未选中 `bg-transparent` 无圆角；`:hover` 才胶囊；选中保持 accent-soft；去竖线；容器透明
  - `Toolbar.tsx` / `PaneTreeView.tsx`：顶栏与栏目头统一透明底
  - `App.tsx` + 新增 `ImmersivePeekBar.tsx`：沉浸态流内 `.app-chrome` 高度收拢 0（300ms）；热区 16px；悬停 400ms 显示 fixed 悬浮页签条（当前格页签 + 退出沉浸），离开 2s 收起
  - `styles/editor.css`：`.immersive .app-chrome` 改 `max-height:0 + opacity:0 + overflow:hidden + border-bottom-width:0`；`.immersive-peek-zone` 16px
  - 测试：新增 `e2e/immersive-peek.spec.ts`；页签态断言在 `e2e/ui-batch2.spec.ts` 或新 spec

## 3. 阅读表面宽度（反馈 3 / 6）

- [ ] 3.1 左侧栏悬浮态可拖宽、设置新增 480–2400 行宽滑块

  实现要点：
  - `ReadingRail.tsx`：拖拽手柄在 `pinned` 与 `hover` 两态都渲染，共用 `railPinnedWidth` 与 200–360 钳制，松手持久化
  - `SettingsView.tsx`：阅读空间区新增 `input[type=range]`（480–2400，step 20）+ 当前 px；三档预设保留并同步
  - 测试：`e2e/settings-reading.spec.ts`、`e2e/reading-rail.spec.ts` 扩展

## 4. 卡片与悬浮窗（反馈 1 / 12）

- [ ] 4.1 PDF 卡片不显示悬停工具条、悬浮窗拖动不被 iframe 吞事件

  实现要点：
  - `GridTile.tsx`：`kind === "pdf"` 不渲染 `data-tile-actions`
  - `ReadingRail.tsx`：卡片密度 `kind === "pdf"` 不渲染 `rail-card-actions`
  - `FloatingPreview.tsx`：标题栏与四个缩放手柄 pointerdown `setPointerCapture`，pointerup 释放；标题栏 `select-none` + `touch-action:none`
  - 测试：`e2e/grid-overview.spec.ts`、`rail-cards.spec.ts`、`e2e/floating-preview.spec.ts` 扩展

## 5. HTML 打开性能（反馈 2）

- [ ] 5.1 预览态不同步整篇 HTML 进隐藏编辑器、加载期骨架、50KB 实测

  实现要点：
  - `ContentArea.tsx`：内容同步与语言解析推迟到 `cmVisible` 为真；预览态保持空 doc
  - `HtmlPreview.tsx`：iframe 加载期骨架（Tailwind 类，不新增 `cm-*`），`onLoad` 移除
  - 测量：用 49.8KB `readme-contract-consult.html` 记录打开到正文可见的 `performance.now()`
  - 测试：`src/__tests__/components/Content/HtmlPreview.test.tsx` 扩展

## 6. 收尾

- 6.1 归档与台账

  五张子票全部合并后：`/opsx-sync` → `validate --strict` → `archive` → `docs/delivery/requirements-status.md` 登记 G-8…G-12 / A-15…A-17。
