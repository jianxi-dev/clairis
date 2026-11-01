# Tasks: MD 内核移植

> 1 change = 1 issue = 1 PR；内部按三批交付，每批独立验收。

- [ ] 1.1 批 1：基础装饰（heading/list/boldItalic/code/quote）+ block-model + keybindings + commands，装配改为按扩展组合；迁入对应单测并补红线 5 断言
- [ ] 1.2 批 2：块级装饰（table/columns/callout/image/hr/link/mermaid/cell-*/theme）+ 单测 + CSS 落位
- [ ] 1.3 批 3：插入入口与智能输入（slash/slash-filter/smart-input/icons/callout-types/color-palette）+ 单测
- [ ] 1.4 全量验收：949 单测绿 + `verify.sh` 全绿 + 三批块型手动走查 + 红线 1/5 证据
