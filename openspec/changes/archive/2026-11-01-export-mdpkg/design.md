# Design: .mdpkg 导出

## D1 管线

`collectLocalImages`（复用 A2c）→ files Map：`document.md`（UTF-8，保留 frontmatter） + 每个资产原始字节 → `packPackage(files, manifest)`（A1）→ base64 → `save_binary_as_file(base64, "<标题>.mdpkg")`。

manifest 由 `buildManifest` 依据 files 生成（A1 已导出）；v1 不传 `prevManifest`（新包）。

## D2 范围决定

v1 **不**内嵌 `renderer/renderer.js` 与 `viewer.html`：包由标月自己打开（v1 用户场景是自用/跨设备）。代价：包不能在浏览器里双击打开。后续若需要「任何浏览器可看」，再单独加 standalone viewer（届时体积与字体内联要一并决策）。

## D3 契约

- 产物以 `PK\x03\x04` 开头；manifest 满足封闭 schema；`document.md` 内容与源文档逐字一致。
- 取消保存 → `cancelled`；打包/写盘失败 → `error`，不抛。

## D4 测试

- 打包→A1 `openPackage` 往返：入口 md 逐字一致；manifest `format=mdpkg`、`spec_version` 以 `1.` 开头。
- 本地图片进包、远程图片不进。
- 无署名/生成器标记。
