# Design: PNG 长图导出

## D1 管线

`buildHtmlDocument` → `toWellFormedXhtml`（去 doctype、void 元素自闭合、无值属性补 `=""`）→ `svgFromHtml(width,height)` → data URI → `Image` → canvas 2x → `toBlob('image/png')`。

## D2 尺寸与字体

- 宽度固定 1080（可配置）；高度由离屏 DOM `scrollHeight` 测量。
- 栅格化前 `await document.fonts.ready`，避免 CJK 回退字体。
- 高度上限 20000px；超过则拒绝并提示「文档过长，建议导出 HTML」。

## D3 二进制写盘

新增 Rust 命令 `save_binary_as_file(app, base64: String, default_name: String) -> Result<Option<String>>`：打开保存对话框（PNG 过滤器），把 base64 解码后原子写盘；取消返回 `None`。

## D4 UI

页签右键 →「导出图片…」→ 生成 PNG → 保存；期间禁用入口并显示「正在生成…」；失败给人话提示。

## D5 不变量

无 byline；不引用外部资源；PNG 内容来自与 HTML 同一份渲染结果。
