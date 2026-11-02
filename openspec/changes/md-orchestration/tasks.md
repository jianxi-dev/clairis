# Tasks: MD 编排层重写（E1b）

> 1 change 分 5 批交付，每批一个 PR（refs 本 change 的 issue），最后一批收口再关票。ADR（`design.md`）先行，实现必须服从 D1 到 D5。

- [x] 1.1 ADR 落地与编排骨架（不接 UI）：把 design.md 的 D1 到 D5 落成 `src/editors/orchestration/` 纯逻辑——`anchor.ts`（`AnchorRect` 类型 + `coordsAtPos` 包装）、`menu-stack.ts`（`push` 返回 token、`pop(token)` 幂等、`top()`、`closeAll`、不 retarget）、`placement.ts`（`resolvePlacement` flip/shift 纯函数）、`hover-gate.ts`（300ms 延迟与输入/触摸/拖拽抑制）。本批无用户可见变化，行为由单测锁定；边界：空栈 `top()` 为 `null`、`pop` 未知 token 不抛错、placement 零尺寸容器不产生 NaN、`pointerType ≠ mouse` 与拖拽进行中不 push。
- [ ] 1.2 块手柄：42×26 药丸（块型图标 + 把手）、空行退化「+」、4px 拖拽阈值、整块高亮、松手单事务重排可撤销。用户可见：拖第 2 段到第 1 段前，源码仅两段顺序变化；单测覆盖阈值/事务/撤销，e2e 覆盖拖拽后其余字节不变。边界：拖拽阈值 4px（小于视为点击不重排）、拖到文档首/尾不越界、拖拽中 hover 被 D5 抑制。
- [ ] 1.3 菜单栈接线：滑入即显示、离栈即收、不 retarget、滚动即收、keymap 只问栈顶。用户可见：菜单打开后鼠标移到另一块，锚点不变；e2e 覆盖 Esc/↑/↓/Enter 只作用于栈顶、栈空返回 `false`。边界：滚动即收、栈空时 keymap 返回 `false` 不吞事件、触摸设备无 hover 改由点击打开。
- [ ] 1.4 浮层锚点与色板：`coordsAtPos` 锚点、底部翻转与夹取、字体色 A×9 + 背景色×16 + 恢复默认统一组件。用户可见：近底部打开菜单完整可见；e2e 覆盖矩形不越界、翻转后仍锚定原块。边界：翻转后仍溢出则夹取、裁剪结果不越出容器、色板写入沿用现有 markdown 语法与 HTML 注释。
- [ ] 1.5 全量验收：`verify.sh` 全绿 + 三入口（斜杠/「+」/「在下方添加」）手动走查 + 红线 1/5 证据 + `ui-gap-and-target.md` §2.2/§2.11/§4 逐条对照。
