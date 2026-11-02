# Design: MD 内核移植

## D1 装配模型

现状 `setup.ts` 的 `buildDecorationSet(docText)` 整篇重建。移植后改为按扩展装配：每个装饰器导出 CM6 `Extension`，由 `createEditorExtensions({ blockHandle, menu, ... })` 组合。红线：**不 remount**（模式切换仍用 CSS display）。

## D2 渲染端口

`@md-bundle/editor` 对 `@md-bundle/renderer` 的依赖抽成四个方法的接口（`renderMarkdown` / `readerCssText` / `hydrateLazyFeatures` / `calloutTypeMap`），Clairis 用 `src/renderers/` 注入。

## D3 分批与验收

- 每批：先迁单测（保持用例名），再迁实现，最后补红线 5（显示=源码）断言。
- 每批结束跑 `npm test` + `verify.sh` + 手动 `npm run tauri dev` 走该批块型。
- 红线 1：每批用覆盖块型的样例文档做源码无损往返；红线 5：被操作元素的可见文本严格等于源码值。

## D4 CSS

所有 `cm-*` 类名同步落 `src/styles/`，过 CSS manifest 检查。

## D5 不搬的部分

编排层（block-handle/菜单栈/浮层/色板 UI）与 `ai/`、`command-palette*`、`chapter-*` 不迁；由 E1b/C9 另做。
