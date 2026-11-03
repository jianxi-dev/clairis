# Tasks: 编辑态 = 预览态

## 1. 显示契约与纸面（已完成于 1bea570）

- [x] 1.1 基础扩展集显式化：撤掉 `basicSetup`，保留折行/选区/历史/缩进/括号匹配/键位/查找；行号槽与折叠箭头不再出现。
- [x] 1.2 纸面同貌：`.cm-content` 复用 `.preview-content` 的纸宽、内边距、底色、投影；正文走 `--type-measure` 窄栏，宽内容满纸宽。
- [x] 1.3 变量同源：`ContentArea` 注入 `--heading-*` / `--type-*`，与 `PreviewView` 同值。
- [x] 1.4 块级配方对齐：标题配色、引用、行内代码、链接、任务复选框、列表符号改走 `reader.css` 同一配方。

## 2. 修复高亮器与装饰层冲突

- [x] 2.1 `setup.ts` 换 `classHighlighter`：标题不再被加下划线/加粗。
- [x] 2.2 回归断言：`.cm-h1/.cm-h2` 的计算 `text-decoration-line` 为 `none`。

## 3. 修复块级组合（D4）

- [x] 3.1 `quote.ts`：`> [!TYPE]` 块的所有行不生成引用装饰（高亮块不再套引用底）。
- [x] 3.2 `editor.css`：连续引用行只有首/末行给纵向内边距与圆角，中间行只留左右内边距。
- [x] 3.3 `code.ts` + `editor.css`：非活跃围栏的开栏/闭栏行高度归零，语言标签绝对定位；代码卡片内不再出现空白行。

## 4. 修复嵌套列表（D5）

- [x] 4.1 `list.ts`：`classifyListLine` 允许行首缩进，返回 `indent`（深度 0–3）。
- [x] 4.2 装饰层隐藏「缩进 + 标记」，行按深度加 `cm-list-depth-N`；CSS 给对应 `padding-inline-start`。
- [x] 4.3 回归断言：`  - 子项` 在编辑态有项目符号、无裸露 `-`、左边缘比父项更靠右。

## 5. 验证与收尾

- [x] 5.1 扩展 `e2e/editor-display-parity.spec.ts` 覆盖 2.2 / 3.1–3.3 / 4.3。
- [x] 5.2 浏览器实操 + 录屏：hover 手柄 → 块菜单 → 斜杠插入 → 表格工具条。
- [x] 5.3 `npx tsc --noEmit` → `npx vitest run` → 两套 Playwright → `bash scripts/verify.sh`。
- [x] 5.4 归档 change，更新 `docs/delivery/requirements-status.md`。
