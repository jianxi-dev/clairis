## Context

当前图表链路面：

- 阅读区：`renderMarkdown` 把 ` ```mermaid ` 输出成 `<div class="mermaid-block wide"><pre class="mermaid">…</pre></div>`；`PreviewView` 挂载后调 `renderMermaid(el)`，后者动态 `import("mermaid")`、`initialize({startOnLoad:false, securityLevel:"strict", theme})`，再对每个块 `await mermaid.render(id, src)` 并把 SVG 塞进 `.mermaid-view`，成功后隐藏 `pre`。深浅色切换靠监听 `documentElement` 的 class 变化重跑整条流程。
- 编辑区：CM6 装饰 `src/editors/decorations/mermaid.ts` 把非活跃块整体替换成 widget，widget 里放 `div.mermaid-block > pre.mermaid`，再通过注入的 `hydrateMermaid` 调同一个 `renderMermaid`。
- 导出：`buildHtmlDocument`（同步）只调 `renderMarkdown`，因此 mermaid 块在 HTML/PNG 产物里是源码文本；PNG 走 `buildHtmlDocument → XHTML → foreignObject → canvas`。
- 版本与体积：`mermaid@11.17.2`；产物里 `mermaid.core` 652KB，另有 architecture 152KB、sequence 116KB、cytoscape 436KB、cynefin 676KB 等按图分块，`dist/assets` 合计约 6MB。

约束：模式切换用 CSS display 不 remount；新增 `cm-*` 装饰类必须同步 CSS manifest；能力开关 id 已持久化在用户配置里；交付前 `scripts/verify.sh` 全绿。

## Goals / Non-Goals

**Goals:**

- 全仓只有一个图表引擎（Pele），删除 mermaid 依赖。
- 引擎就绪后，单次出图是同步的：正文与图不再有"先源码后跳变"的两段式。
- 图颜色/字体跟随 CSS 变量，深浅色切换不重渲。
- 导出的 HTML / PNG 里图以 SVG 内联出现。
- 保持既有用户契约：`.mermaid-view`、`pre.mermaid`、能力开关「图表水合」、错误时保留源码。
- 上游升级只动一个适配文件；有一组固定的代表图做回归。

**Non-Goals:**

- 用户可切换的渲染器 / 双引擎并存。
- 运行时插件系统、用户自行安装或更新引擎。
- ZenUML 与 Mermaid 外部插件兼容。
- 图形化改图、主题编辑器。
- 任何 Rust 侧、配置结构、数据格式变更。

## Decisions

### D1 全量替换，不做双引擎

替代方案是保留 mermaid 作为 fallback、设置里可切回。否决理由：双引擎会让 CSS（两套类名）、错误处理、快照基线、测试面全部翻倍，而收益只有"回退"——回退由版本发布承担更干净。Obsidian 1.15 的同一次替换也是全量：官方日志写明 "Obsidian no longer includes Mermaid"，只保留 `loadMermaid()` 这个**入口名**做兼容壳，没有保留第二套引擎。本仓照抄这个形状：入口名 `renderMermaid` 不变，内部换实现。

### D2 适配层是唯一耦合点

新增 `src/renderers/diagram/`：`engine.ts` 负责能力开关、加载态、错误归一、主题与协议白名单；`pele.ts` 是仓库里唯一 `import "pele"` 的文件。`src/renderers/mermaid.ts` 退化成薄壳，继续导出 `renderMermaid` / `clearMermaid`。

理由：调用点（`PreviewView`、`ContentArea`、两个测试）零改动，升级只审一个文件。替代方案（直接在 `mermaid.ts` 里 import pele）省一个文件，但把"能力开关 + 主题 + 协议"和"引擎 API"揉在一起，升级时无法判断哪部分是本地策略。

### D3 引擎按整包懒加载，不用 `pele/lazy` 的按图分块

`import("pele")` 一次注册全部图类型（730KB raw / 273KB gzip），之后所有图同步出图。`pele/lazy` 可以按图类型 `import()`，体积更小，但每次遇到新图类型都要重新等一次网络/IO——等于把 mermaid 现有的"按需等待"问题原样保留。

选择整包的理由：Tauri 产物从本地磁盘加载，273KB gzip 一次的成本远小于"新图类型首帧等待"；且只有引擎就绪后才承诺同步语义，语义单一。可在空闲时预取，进一步把首图延迟藏到用户阅读之前。

### D4 阅读区 `mount()`、编辑区 `render()`

| 区域 | API | 理由 |
|---|---|---|
| 阅读区 | `mount(view, source, { zoom:false })` | 跟随容器宽度自适应；用 canvas 按真实字体测宽（中文标签不溢出）；挂 `ResizeObserver`，卸载时显式 `destroy()` |
| 编辑区 | `render(source, { maxWidth })` | widget 生命周期没有可靠卸载回滚，`mount()` 会留下观察者；`render()` 是纯函数，widget 重建即回收 |

编辑区放弃"窗口缩放实时重排"，换取无泄漏。若后续确需重排，再给 widget 补 `destroy()` 并统一用 `mount()`，属于增量改动。

### D5 主题走 CSS 变量，删掉重渲监听

在 `.mermaid-view` 作用域把 `--pele-bg/fg/muted/line/surface/border/accent/font/radius` 映射到现有 `--app-*` 与阅读区 token；`--pele-series-1..8` 由强调色派生。变量随 `.dark` 生效，无需重渲。

`PreviewView` 里监听 `documentElement` class 的 `MutationObserver` 随之删除；`clearMermaid` 的能力关闭语义保留。

### D6 协议白名单

`linkSchemes` 用 Pele 默认（`http/https/mailto/tel`），比 mermaid 的 `securityLevel: strict` 更严；`imageSchemes` 追加 `asset`、`media`，否则图内本地图片不显示。替代方案（放开 `file`）否决：等于让一篇外部文档借图读本地文件。

### D7 导出：注入同步渲染器，保持 `buildHtmlDocument` 同步

`buildHtmlDocument` 增加可选注入 `diagramSvg?: (source: string) => string | null`；调用方（`exportDocument`、`png`）先 `await ensureDiagramEngine()`，再传同步函数。理由：`buildHtmlDocument` 被两个异步导出入口和若干单测直接调用，改成 async 会把签名污染扩散到测试与调用链；注入则把异步边界收敛在导出入口一处。

PNG 链路仍走 XHTML 解析，因此内联 SVG 必须是良构 XML——Pele 默认不产出 `foreignObject`（只有接数学 resolver 才会），本次不接数学，风险受控；导出测试会覆盖含中文与 `classDef` 的图。

### D8 能力 id 保持 `mermaid`

开关已持久化在用户配置里（`serializeCapabilities` 只存被关闭的项）。改 id 会导致老配置失效且需要迁移代码，收益为零。label/hint 文案不变。

### D9 升级策略：semver + 契约测试 + 上游巡检，不 vendoring、不做运行时插件

- 依赖 `pele@^1.13.0` + lockfile；升级只改适配层。
- 8 类代表图做快照，升级时审 diff 而不是盲目更新快照。
- 新增脚本查 `npm view pele version`，定时 CI job 有新版时开 issue。
- 不把 Pele 源码搬进本仓：2.5MB 源码 + 自有测试/构建链，三方合并成本高于收益。
- 不做用户可独立更新的插件：`openspec/specs/extensions/spec.md` X-1 明确不执行用户目录代码；应用当前没有 updater；引擎与 DOM/CSS/导出/能力开关强耦合，版本漂移成本高于收益。

## Risks / Trade-offs

- **语法版本差（mermaid 11.17.2 vs Pele 对标 12.1.0）** → 用仓库真实文档 + 8 类代表图回归；出现不兼容先记录为已知差异并保留源码降级，不静默吞。
- **布局不同（节点位置、间距、连线路径）** → 这是 Pele 的设计差异不是缺陷；验收判据是"能读、能导、不崩"，不是"与 mermaid 逐像素一致"。文档与 PR 里写明。
- **中文测宽** → 阅读区用 canvas 测宽（`mount`）；编辑区走 `render()` 的度量表，CJK 按全宽计算，通常准确；用中文标签图做回归，如偏窄再给编辑区接自建 measurer。
- **`ResizeObserver` 生命周期** → 阅读区每次重渲染前先 `destroy()` 旧实例；卸载时清理。编辑区不用 `mount()` 即为规避此项。
- **既有 CSS 冲突** → Pele 的根 `<svg>` 自带 `max-width:100%;height:auto` 内联样式，与 `.mermaid-view svg` 规则同向，不冲突；仍需真机看一次缩放与打印。
- **整包体积** → 首次加载 273KB gzip；换来后续同步出图。若实测首图延迟可感，再加空闲预取，不回退到按图分块。
- **导出 XHTML 良构性** → 只用不产生 `foreignObject` 的渲染路径；PNG 用例覆盖含中文/`classDef`/换行标签的图。
- **快照脆弱** → 快照只固定"含预期文本 + 能出 SVG"，不固定像素；结构大改时人工审阅差异。

## Migration Plan

1. 加 `pele` 依赖与适配层，**暂时保留** mermaid，先用契约测试锁定新引擎行为。
2. 阅读区切到适配层（`mount`），删除重渲监听；跑 `reader-typography` e2e。
3. 编辑区切到适配层（`render`），跑 `block-decorations` e2e 的两态断言。
4. 导出注入同步渲染器，新增"导出 HTML 带图"用例。
5. 移除 `mermaid` 依赖与 `initialize` 残留；确认 `dist/assets` 中 mermaid 分块消失。
6. 全量 `scripts/verify.sh`。

回滚策略：单 PR 单 change，回滚即 revert 该 PR；不存在数据迁移或配置迁移，不需要补偿脚本。

## Open Questions

- `%%{init: ...}%%` 里的 `themeVariables` 在 Pele 下只作为系列色板生效（官方说明），是否需要给用户文档补一句"图配色由应用主题决定"？
- gantt / timeline 的日期与本地化格式差异是否需要单独验收清单？
- 编辑区是否需要窗口缩放实时重排（当前决定不做）——等真实使用反馈再定。
