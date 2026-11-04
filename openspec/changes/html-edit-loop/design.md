# Design: HTML 编辑闭环（H1）

## D1 预览必须是 iframe，不是 innerHTML

`.html` 文件里的 `<style>`、`<script>` 一旦塞进主文档，会污染整个应用（样式串味、脚本拿到宿主权限）。iframe `srcdoc` + `sandbox` 是唯一能把"用户 HTML"隔开的简单手段。仓库已有 `FramePreview`（`filePath`/`fileKind` 那条路径），复用它而不是新写。

## D2 相对资源

预览里 `./style.css`、`img/a.png` 按 iframe 的 base 解析，默认落到应用 origin → 404。两条路：

- 注入 `<base href="asset://localhost/<文档目录>/">`（简单，但 CSP 与 Windows 路径要试）
- 把 src 重写为 `convertFileSrc(绝对路径)`（`renderers/html.ts` 已有重写逻辑，扩展它）

优先第二条：复用已有代码，不依赖 base 在 WebView 里的行为差异。与 #157 的图片解析同源。

## D3 模式切换不 remount

AGENTS.md 硬约束、E-6 也写了。HTML 的编辑器与 markdown 共用同一个 `EditorView`（`display` 切换），只是扩展集按 `fileKind` 不同。

## D4 编辑 → 预览同步

编辑态改动已通过 `updateListener` 写回 store；预览从 `tab.content` 读。所以只要预览在切回来时按最新 content 重建 `srcdoc` 即可，不需要额外通道。

## Verification

- e2e：打开 `.html` → 预览出现 iframe 且渲染的是用户样式；切编辑 → 改一行 → 切预览 → 改动可见
- e2e：相对路径图片/CSS 在预览里可加载（用 mock 的 convertFileSrc 断言 src）
- 单测：路径重写函数
