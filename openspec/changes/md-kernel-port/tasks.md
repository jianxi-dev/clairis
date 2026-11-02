# Tasks: MD 内核移植

> 1 change 分 4 批交付，每批一个 PR（`refs` 本 change 的 issue），最后一批收口再关票。

- [x] 1.1 用户可见切片：智能输入（`smart-input`）——空行输入 `- ` `1. ` `> ` `# ` 自动转换；智能回车/退格与自动配对；迁入对应单测 + 红线 5（显示=源码）断言
- [x] 1.2a 斜杠菜单依赖：`block-model` + `icons` + `slash-filter` + `callout-types` + `cell-text.sanitizeCellText` + 单测（expand，不接 UI）
- [x] 1.2b 斜杠菜单 UI：`slash`（命令注册表 + 菜单 DOM + keymap）接进 `setup.ts`——输入 `/` 出现分类菜单、`/h1` 转标题、Esc/点外部关闭无残留 + 单测
- [x] 1.3 装配模型 + 基础装饰升级：按扩展装配替换整篇重建，加 IME 组合期跳过与指针冻结守卫；heading/list/boldItalic/code/quote 迁入 md-bundle 版本（语义揭示：光标所在块显示结构标记、其余块隐藏）+ 单测
- [x] 1.4a 块级装饰（简型）：`hr` + `link` + `image` + `mermaid` + 测试 + `cm-*` CSS（红线 5 逐块型断言）
- [x] 1.4b 块级装饰（表格）：`table` + `cell-text` 全量 + `cell-selection` + `cell-toolbar` + 测试 + CSS
- [x] 1.4c 块级装饰（容器）：`callout` + `callout-emoji` + `callout-insert` + `columns` + `theme` 全量 + 测试 + CSS
- [ ] 1.5 全量验收：949 单测绿 + `verify.sh` 全绿 + 三批块型手动走查 + 红线 1/5 证据
