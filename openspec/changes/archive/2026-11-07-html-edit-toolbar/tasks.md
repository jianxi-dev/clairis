# Tasks: HTML 可视化编辑工具条（H3）

切片顺序见 design D1–D5。每条编号项 = 一张票 = 一个可验收交付单元（做完能在页面上看到东西）。

## 1. 纯函数（无 UI、无 iframe）

- [x] 1.1 `src/editors/html/edit.ts` 增三个折算函数
  - `applyTagReplace(content, nodeId, tag)`：白名单标签才换，换后保留属性与子树，并返回新 `nodeId`（id 是 `tag:index`，换了标签就变）
  - `applyStylePatch(content, nodeId, styles)`：合并进 `style`，`null`/空串删该项
  - `applyAttrPatch(content, nodeId, attrs)`：`setAttribute` / 空值删属性
  - 三者产物都过 `cleanSnapshot`，不留 `data-cm-*` / `cmid` / `contenteditable`
  - 单测覆盖：白名单外标签原样返回、空值删除、样式合并保留既有项、换标签后新 id 的序号正确

## 2. 选区几何上报

- [x] 2.1 `bridge.ts` 增 `selectionRect` 消息（`nodeId` + 视口坐标矩形）并在 `parseBridgeMessage` 收口
- [x] 2.2 `runtime.ts` 的 `place()` 上报矩形（滚动 / resize / 重建后都发）
- [x] 2.3 单测：矩形消息解析通过、字段类型不对丢弃

## 3. 工具条

- [x] 3.1 `src/components/Content/HtmlEditToolbar.tsx`：标签 / 字号 / 颜色 / 对齐 / class / id 六个控件
  - 定位：选中框上方 8px，贴顶时翻到下方并夹在可视区内
  - Esc 关闭、`key={nodeId}` 重挂载避免草稿串到别的元素
- [x] 3.2 `src/styles/editor.css` 增 `.html-edit-toolbar` 一族样式（用应用 token）
- [x] 3.3 `HtmlVisualEditor` 接线：选中态 + 矩形 → 工具条；回调用 `commit` 走 content
  - 换标签后同步 `selected` 与选框的 `nodeId`，否则工具条会在新矩形到达前闪掉

## 4. 验收

- [x] 4.1 单测全绿（`npx vitest run src/__tests__/editors/`，150 例）
- [x] 4.2 e2e `e2e/html-edit-toolbar.spec.ts`：换标签 / 改字号 / 改对齐 / 加 class 后渲染可见、`content` 无编辑期痕迹、点空白关闭
- [x] 4.3 `npx tsc --noEmit` + `npx eslint src/` + CSS manifest 检查

## 5. 收尾

- [x] 5.1 本 change 的 delta 规格（`specs/editing/spec.md`：新增 E-19、修改 E-16）
- [x] 5.2 架构：`docs/architecture/overview.md` 补工具条位置与上报机制
- [ ] 5.3 归档时执行：`openspec archive` 合并 E-19 进主规格 + `docs/delivery/requirements-status.md` 登记（按仓库约束，合并前不标已完成）
