## Why

` ```mermaid ` 图块现在是「正文先出、图后到」：要等 mermaid.js 的 JS 分块下载完、`initialize()` 之后再异步 `render()`；深浅色切换靠 MutationObserver 监听根节点 class 再全量重渲，整块图会闪；导出的 HTML / PNG 里只剩源码没有图；mermaid 全类型产物里 core 单块 652KB、各图类型另算（cytoscape 436KB、cynefin 676KB…），`dist/assets` 合计约 6MB。

Pele（`obsidianmd/pele`，MIT，零运行时依赖，目标语法 Mermaid 12.1.0）在 Obsidian 1.15 已经完成了同一次替换，`render()` 同步、颜色走 CSS 变量、无 DOM 依赖，正好一次解决这四件事。现在换的代价是一层适配器，再拖下去要改的就是阅读区、编辑区、导出三条管线各自的实现。

## What Changes

- 用 Pele 替换 mermaid.js 作为**唯一**图表引擎：同步渲染、无 `initialize()`、无全局主题状态。
- 新增 diagram engine 适配层，是仓库里唯一 `import "pele"` 的模块，负责能力开关、懒加载、错误归一、主题变量、链接/图片协议白名单。
- 阅读区改用 `mount()`（宽度自适应 + canvas 字体测量），编辑区改用 `render()` + `maxWidth`（避免 CM6 widget 观察者泄漏）。
- `.mermaid-view` 下新增 `--pele-*` ← `--app-*` 的主题变量映射；删除为深浅色切换服务的 MutationObserver 重渲。
- 导出 HTML 时把图的 SVG 内联进产物；PNG 长图复用同一管线，因此自动带图。
- 移除 `mermaid` 依赖与相关初始化代码。
- 新增 8 类代表图的渲染契约测试，以及查上游 Pele 版本的脚本 + 定时 CI job。
- **BREAKING**（开发者视角，非用户视角）：`renderMermaid` 内部从异步 mermaid 渲染改为 Pele 渲染；图 SVG 的类名从 mermaid 的类名变为 Pele 的 `.pele-*`。用户可见文案与「图表水合」开关不变。

## Capabilities

### New Capabilities

- `diagram-rendering`: 图表块从 Markdown 源码到 SVG 的渲染契约——同步出图、主题变量、能力开关、错误降级、支持的链接/图片协议、编辑态两态语义。

### Modified Capabilities

- `export`: EX-1「单文件离线产物」新增「图以 SVG 内联」行为——导出 HTML 与 PNG 产物中，mermaid 图块不再是源码文本。

## Impact

- 前端渲染：`src/renderers/mermaid.ts`（入口不变、实现替换）、新增 `src/renderers/diagram/`；
- 消费方：`src/components/Content/PreviewView.tsx`（去掉重渲监听）、`src/components/Content/ContentArea.tsx`（编辑态水合注入）；
- 样式：`src/styles/reader.css`、`src/styles/editor.css`（`--pele-*` 映射）；
- 导出：`src/lib/export/html.ts`（内联 SVG），PNG 链路不改；
- 依赖：移除 `mermaid`，新增 `pele@^1.13.0`；
- 测试：`src/__tests__/` 新增渲染契约用例，`e2e/` 新增导出带图用例；
- 构建产物：`dist/assets` 中 mermaid 相关按图分块消失；
- 无 Rust 侧改动，无配置/数据结构变更。
