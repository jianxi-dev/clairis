# Tasks: 轮盘标注类型全集

## 1. 类型集与规格同步

依赖：无

- [x] 1.1 轮盘高亮层扩展为 13 类并同步主规格
  - 复用 `CALLOUT_EDIT_TYPES` 渲染 13 类；新增 abstract/success/question/failure/bug/example 六个图标。
  - 悬停/激活改实色混合，扇区不再发虚。
  - 扩展 `e2e/floating-toolbar.spec.ts`：三层 13 项、顺序与类型表一致、选「成功」写 `> [!success]`。
  - 验收：三层 13 项；选任一类型写入对应 `> [!key]`；滑入扇区保持实色。
  - 实现与证据：#530 / PR #531，`.artifacts/530/state-coverage.json`。
