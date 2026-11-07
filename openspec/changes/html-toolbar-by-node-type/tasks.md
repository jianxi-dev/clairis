# Tasks: 工具条按节点类型分化（H5）

## 1. 模型层

- [x] 1.1 `src/editors/html/edit.ts`：`TEXT_TAGS` / `BLOCK_TAGS` / `nodeKindOf(tag)`（未知归 text）/ `toggleDecoration`（下划线与删除线共享 `text-decoration`）/ `applyNodeRemove`（拒绝 html/body）
- [x] 1.2 单测：分类判定、decoration token 合并、删除含子树、拒绝 html/body、删除后无编辑期痕迹

## 2. 工具条两套控件

- [x] 2.1 `HtmlEditToolbar`：文本块给 字号 / B / I / U / S / 链接（仅 `<a>`）/ 对齐 / 文字颜色
- [x] 2.2 `HtmlEditToolbar`：区块给 对齐 / 背景色 / 边框
- [x] 2.3 两者共有：标签、class、id、截图、删除、关闭；分组间加分隔线
- [x] 2.4 `styles`: `.html-edit-toolbar__sep`；工具条根节点加 `data-cm-node-kind`

## 3. 写入正确性（D2 / D3）

- [x] 3.1 `onPatchStyle` 改为 `(current) => patch`，上层在最新 content 上求值
- [x] 3.2 `readStyle` 处理简写 → 子属性回退（`text-decoration` → `text-decoration-line`，`border` → `border-top-width`）

## 4. 验收

- [x] 4.1 单测全绿（`src/__tests__/editors/` 共 1369 例通过）
- [x] 4.2 e2e `e2e/html-edit-toolbar-kinds.spec.ts` 6 例：两套控件互斥、粗体开关、下划线+删除线共存、边框真画出来、删除元素、容器不带粗体
- [x] 4.3 既有 HTML 相关 e2e 无回归（22 例全绿）
- [x] 4.4 `npx tsc --noEmit` + `npx eslint src/`

## 5. 收尾

- [x] 5.1 delta 规格（新增 E-22、修改 E-19）
- [ ] 5.2 归档时执行：`openspec archive` 合并进主规格 + 台账登记 E-22
