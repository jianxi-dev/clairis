# Proposal: HTML 可视化编辑（H2）

## Why

`.html` 文件现在只有源码编辑 + 预览（E-4 / E-15 已交付）。用户要改标题字号、换张图、挪一段落，仍得读 HTML——这正是 WorkBuddy（腾讯，Electron）用「可视化编辑引擎」解决的问题：点选元素、双击改文字、拖拽调样式，保存仍写回**纯 HTML**，产物可被浏览器直接打开。

逆向报告 `docs/research/technical/workbuddy-html-visual-editing-逆向报告.md` 已恢复，其 §5 建议的两步里，**方案 A（CM6 source + preview）本仓库已完成**：

- `@codemirror/lang-html` 见于 `package.json`，`ContentArea.tsx` 的 `case "html"` 已接；
- 预览侧由 change `html-edit-loop` 补齐（iframe srcdoc / 相对资源 / 编辑后可见，E-15）。

所以本 change 的范围就是报告里的**方案 B：可视化编辑**。它是 XL，必须切片交付，不能一把梭。

## What Changes

1. **节点模型与锚点**：打开 `.html` 时解析成节点树，每个元素带稳定 id；可编辑区域内元素写 `data-cm-node-id` 属性，文本节点靠 `<!--cmid:xxx-->` 注释锚点定位。解析在 Worker 里跑，不阻塞输入。
2. **运行时**：编辑态 iframe 用 `srcdoc` 渲染当前内容并注入交互运行时；预览态保持 H1 的 `script-src 'none'`，两套 CSP 分开。
3. **交互**：hover 高亮、点选、双击进文本编辑（`contenteditable`）、Enter 拆块；事件经 `postMessage` 桥上报主侧，主侧持有唯一真相（content 字符串）。
4. **保存**：取 iframe 当前 DOM 全量快照 → 清洗编辑痕迹 → 写回文件。**不做 diff patch，也不做首次打开时的 id 回写**（见 design D5）。
5. **双态**：`.html` 的「编辑」模式＝可视化编辑器；「源码」模式仍是 CM6（`html()`），两者共享同一份 content。

## Capabilities

### New Requirements

- **E-16 HTML 可视化编辑**：点选/改文本/改属性--保存为干净 HTML，且不破坏源码模式的编辑状态。

### Modified Requirements

- **E-15**（预览隔离）：新增「编辑态与预览态 CSP 分离」的约束——编辑态必须允许注入运行时脚本，预览态仍然禁脚本。

## Impact

- 前端：`src/components/Content/`（新增可视化编辑器组件与模式装配）、`src/editors/html/`（新目录：解析、锚点、桥、清洗）、Worker（解析）。
- Rust：可能新增 `write_text_file` 的受控写入（现有保存命令若可复用则不动）。
- 规格：`openspec/specs/editing/spec.md` 增 E-16，改 E-15。
- 不触碰：CM6 三模式不 remount 的机制（可视化编辑器是独立面板，不进 CM6 的 module 级 EditorView Map）。

## Non-goals

- 不做 AI 生成页面、不做区域截图引用（WorkBuddy 那部分依赖它自己的 AI 链路）。
- 不做「首次打开静默改写用户文件」的 pnid 回写。
- 不引入 127.0.0.1 静态资源服务（Tauri `asset://` 已覆盖，见 E-15）。
