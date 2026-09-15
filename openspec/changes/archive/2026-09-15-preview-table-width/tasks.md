# Tasks: 预览表格宽度自适应与自动换行

## 1. 核心行为（垂直切片）

- [x] 1.1 预览表格宽度与换行修复：`src/styles/reader.css` 表格改为占满容器宽度（100%）+ 单元格可断行换行（长单词/URL 可断行），保留 `.table-wrap` 兜底滚动、更新旧行为注释；同提交在 `e2e/tauri/reader-typography.spec.ts` 增加断言（长内容表格不横向溢出、单元格发生换行、短内容表格占满宽度）；tdd 先行（断言复现溢出 → 样式转绿）

## 2. 设计文档同步

- [x] 2.1 修订 `docs/design/approved/reader-typography/spec.md` §5.5 表格条目：将"外容器 overflow-x + 横向滚动"权衡反转为"占满内容区宽度 + 内容自动换行 + 极端内容兜底滚动"，与实现及 reading 规格 A-11 保持一致