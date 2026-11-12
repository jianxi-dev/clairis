# #668 块对齐围栏标记在编辑态隐藏 — 验证记录

日期：2026-11-12（本地时间）

## 交付验收锚点（spec #660 / tasks 5.1，delta: editing 块对齐标记不在编辑态外泄）

| 锚点 | 断言 | 结果 |
|---|---|---|
| A-5.1a | 应用居中后编辑态可见文本不含 `:::` | PASS（e2e visibleLines 与无围栏 DOC_LINES 逐项相等；单测 `.cm-line` DOM 断言） |
| A-5.1b | 源码态仍含 `::: {.align-center}` | PASS（e2e + cw-vision 复核源码态渲染） |
| A-5.1c | 预览仍居中 | PASS（e2e `.preview-content .layout-align-center` = 1） |
| A-5.2 | 取消对齐后编辑态无残留标记与空行 | PASS（e2e：再点同一对齐 → 源码逐字节回到原文 + 可见行结构复原） |

## 实现要点

- 新模块 `src/editors/decorations/alignFence.ts`：逐行状态机配对，`Decoration.replace` 隐藏起始行（文本+行尾换行）与结束行（前导换行+文本），空块合并为单段。
- 正则与预览渲染器 `markdown.ts` 的 `ALIGN_DIV_OPEN_RE` / `ALIGN_DIV_CLOSE_RE` **逐字符一致**，避免「编辑态藏了、预览没渲染」的错配。
- 保守策略：缺结束行 / 多余结束行不隐藏；围栏代码块内 `:::` 跳过（复用 `findFencedRanges` + `isInsideRange`）。
- 源码态不装装饰（`decorationsForMode` 在 source 只返回 floatingToolbar），因此源码态天然保留。

## 回归（亲测）

- `npx vitest run`：124 文件 / 1531 用例（+5 条新单测：整行隐藏/多组/代码块排除/半截不隐藏/光标可落点）
- `npx playwright test e2e/align-fence-edit.spec.ts e2e/block-alignment`：3 passed
- `npx playwright test e2e/callout-columns e2e/decorations e2e/block-menu`：56 passed / 2 skipped（列围栏同用 `:::`，无相互干扰）
- `npx tsc --noEmit` / css-manifest / eslint（0 error）通过
- Rust 未改动（数据面：无）
