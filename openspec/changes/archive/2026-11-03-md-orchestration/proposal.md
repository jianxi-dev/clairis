# Proposal: MD 编排层重写（E1b）

## Why

E1a 已把内核层迁完：装饰装配、块级装饰（表格/分栏/高亮块/图片/链接/分割线/mermaid）、斜杠菜单、智能输入、图标与 callout SSOT 都在 main 上。但**编排层仍然缺位**：

- 没有块手柄：无法拖拽整块、无法在块前插入，空行也没有「+」入口。
- 斜杠菜单只能从光标处打开，没有统一菜单栈：同一时刻可能叠出两个浮层，且没有「滑入即显示 / 离栈即收 / 不 retarget」的归属规则。
- 浮层直接按元素位置摆放，没有锚点矩形来源与裁剪边界约定，靠近视口边缘会被截断。
- 色板（文字/底色）没有统一实现。
- hover 没有门控：键盘操作时也弹出，触控/远距离移动会误触。

md-bundle 的编排层与豆包行为强耦合、依赖 app 层，不适合逐行搬运。E1b 是**重写**：先写 ADR 定交互契约，再按契约实现。

## What Changes

1. **ADR 先行**（`design.md`）：点击委托、菜单栈归属、锚点矩形来源、面板裁剪边界、hover 门控五条契约。
2. **块手柄**：42×26 药丸，块型图标 + 拖拽把手；空行退化为「+」；hover 显现、拖拽时整块高亮、松手重排。
3. **菜单栈**：模块级单一栈，`push/pop` 返回 token；滑入即显示、离栈即收、不 retarget；CM6 keymap 只问栈顶。
4. **浮层**：统一 `AnchorRect`（由 `coordsAtPos` 计算）+ 视口/容器裁剪与翻转。
5. **色板**：文字色与单元格底色统一取色组件，写入沿用现有 markdown 语法与 HTML 注释。
6. **hover 门控**：鼠标进入延迟 300ms；键盘操作、触摸、拖拽中隐藏。

## Capabilities

### New Capabilities

<!-- 无 -->

### Modified Capabilities

- `editing`：新增 E-7 编排层交互契约（块手柄、菜单栈、锚点与裁剪、hover 门控）。

## Impact

- 代码：新增 `src/editors/orchestration/`（block-handle / menu-stack / anchor / hover-gate / color-palette），接线 `src/components/Content/ContentArea.tsx` 与 `src/styles/editor.css`。
- 测试：新增编排层单测（栈语义、锚点裁剪、hover 门控）与浏览器 e2e（拖拽重排、菜单不 retarget、浮层翻转、「+」插入）。
- 风险：中高（交互层，易回归）。按批交付，每批一个 PR；ADR 先行可避免返工。
- 不搬：md-bundle 的 `ai/`、`command-palette*`、`chapter-*`（归 C9 等后续 change）。
