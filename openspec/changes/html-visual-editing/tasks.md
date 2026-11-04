# Tasks: HTML 可视化编辑（H2）

> 切片顺序见 design D8。每条独立可验收；前一条没绿不开下一条。

## 1. 模型 / 锚点 / 清洗（纯函数，无 UI）

- [ ] 1.1 `src/editors/html/model.ts`：`parseHtml(content) → { nodes, tree }`，节点带可复现 id（DOM 路径哈希 + 序号）
- [ ] 1.2 `annotate(nodes) → html`：元素写 `data-cm-node-id`，文本节点插 `<!--cmid:xxx-->`
- [ ] 1.3 `cleanSnapshot(html) → html`：剥 `data-cm-*`、`cmid` 注释、`contenteditable`、注入运行时
- [ ] 1.4 单测：id 对同一 content 可复现；`cleanSnapshot` 后 `cm-`/`cmid` 零残留；解析→标注→清洗 → 原始字节不变（幂等）

## 2. 编辑态 iframe（无交互）

- [ ] 2.1 `src/components/Content/HtmlVisualEditor.tsx`：srcdoc + 独立 CSP（允许注入运行时、仍禁用户脚本）
- [ ] 2.2 `ContentArea` 模式装配：`.html` 的「编辑」挂可视化编辑器，「源码」保持 CM6；两者共享同一 `content`
- [ ] 2.3 切到源码时 CM6 `EditorView` 不 remount（沿用 `display`），补一条 e2e 断言

## 3. 点选与高亮

- [ ] 3.1 桥：`SELECTION` / `HOVER` 事件（带 `v`/`nodeId`），主侧收口在 `src/editors/html/bridge.ts`
- [ ] 3.2 高亮框渲染；新增 `cm-*` 类**同步加 `src/styles/` 规则**（CSS manifest gate）
- [ ] 3.3 e2e：hover 出框、移开出框、点选切换选中

## 4. 文本编辑

- [ ] 4.1 双击进 `contenteditable`，`TEXT_EDIT_BEGIN/INPUT/END` 上报
- [ ] 4.2 输入防抖后以主侧 `content` 为真相回写（design D2），提交时重建受影响节点
- [ ] 4.3 Enter 拆块
- [ ] 4.4 e2e：双击改字 → `content` 变化 → 切回预览可见

## 5. 保存闭环

- [ ] 5.1 `snapshot` → `cleanSnapshot` → 写回文件（复用现有保存命令）
- [ ] 5.2 e2e：保存后文件内搜不到 `cm-`/`cmid`；再打开内容与保存前一致
- [ ] 5.3 `bash scripts/verify.sh` 全绿

## 6. 文档

- [ ] 6.1 `docs/architecture/overview.md` 补可视化编辑面板的位置
- [ ] 6.2 ADR：D2（content 为唯一真相）、D5（不做 pnid 回写）各记一条，因为它们是与逆向报告相反的决定
