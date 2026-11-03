## 1. 阅读区换装（垂直切片：读者能看到图）

- [ ] 1.1 新增 diagram engine 适配层并把阅读区切到 Pele：新增 `src/renderers/diagram/`（`engine.ts` 负责能力开关、引擎懒加载、错误归一、主题与协议白名单；`pele.ts` 是唯一 import `pele` 的文件），`src/renderers/mermaid.ts` 保留 `renderMermaid`/`clearMermaid` 入口并改为调用适配层；阅读区用 `mount()`（宽度自适应、canvas 测宽、`zoom:false`、卸载 `destroy()`）；在 `reader.css` 为 `.mermaid-view` 增加 `--pele-*` → `--app-*` 映射；删除 `PreviewView` 里监听根节点 class 的重渲；新增 8 类代表图契约测试（flowchart 含 `classDef`/`style`、sequence、class、state、er、gantt、pie、中文标签）。
  - 接线归属：`PreviewView` 的 `renderMermaid(el)` 调用点不变，适配层在其内部完成替换。
  - 验收：打开含图的 md，图与正文同帧出现；切换深色后图换色且不重新插入 `<svg>`；关闭「图表水合」后源码可见、重新开启不重复出图；非法语法只影响该块。

## 2. 编辑态换装（垂直切片：编辑者能看到图）

- [ ] 2.1 编辑态改用同步 `render()`：更新 `src/editors/decorations/mermaid.ts` 注入的水合钩子走适配层的同步路径，按 `maxWidth` 传入容器宽度；非活跃块出图、活跃块显示原始围栏；反复进出同一块不叠加 `<svg>`、不残留观察者；在 `editor.css` 为 `.mermaid-view` 增加同样的 `--pele-*` 映射。
  - 接线归属：`ContentArea` 的 `hydrateMermaid` 注入点保持签名，适配层在其内部实现。
  - 验收：编辑态非活跃 mermaid 块显示图；光标进入后显示 ` ```mermaid ` 围栏可编辑；反复进入/离开后块内只有一个图表容器。

## 3. 导出带图（垂直切片：用户导出的文件里能看到图）

- [ ] 3.1 导出链路内联 SVG：`buildHtmlDocument` 增加可选注入 `diagramSvg?: (source: string) => string | null`（保持同步签名）；`exportDocument` 与 `png` 两个入口先 `await ensureDiagramEngine()` 再传入同步渲染函数；新增导出 HTML 与 PNG 带图的测试（含中文与 `classDef` 的图）；确认 PNG 链路 XHTML 良构。
  - 接线归属：`src/lib/export/exportDocument.ts`、`src/lib/export/png.ts` 两个调用点。
  - 验收：导出的 HTML 在图块位置出现内联 `<svg>`，断网、禁用脚本打开仍能看到图；导出的 PNG 长图里出现该图。

## 4. 依赖收口与升级通道（垂直切片：产物与升级路径可见）

- [ ] 4.1 移除 `mermaid` 依赖并建立上游巡检：删除 `package.json` 里的 `mermaid` 与相关 `initialize` 残留，重新构建确认 `dist/assets` 中 mermaid 相关按图分块全部消失；新增查上游版本脚本（`npm view pele version`）与定时 CI job，有新版时开 issue；`docs/architecture/overview.md` 把图表渲染器描述更新为 Pele。
  - 验收：`npm ls mermaid` 为空、构建产物无 mermaid 分块；巡检脚本能输出本地与上游版本；架构文档不再写 mermaid.js 为渲染器。
