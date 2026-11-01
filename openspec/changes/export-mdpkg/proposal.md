# Proposal: 导出 .mdpkg（A2d）

## Why

A1 已有 `.mdpkg` 打包能力，A2b 已有二进制写盘。把「当前文档 + 本地图片」打成 `.mdpkg`，就能得到一个可再次导入、可跨设备带走的单文件包。

## What Changes

- `src/lib/export/mdpkg.ts`：`exportMdpkgFromMarkdown({ title, markdown, assets, prevManifest? })` → 组装 `document.md` + 资产 → A1 `packPackage` → base64 → `save_binary_as_file`。
- 页签右键菜单新增「导出 .mdpkg…」。
- v1 不内嵌独立 viewer/renderer（包由标月自己打开）；这是有意的范围决定，记录在 design。

## Capabilities

### New Capabilities

<!-- 无 -->

### Modified Capabilities

- `export`：新增 EX-6 .mdpkg 导出（ZIP 签名、manifest 合法、重开一致）。

## Impact

- 代码：`src/lib/export/mdpkg.ts`、`src/components/TabBar.tsx`。
- 风险：低。打包在 A1 的 vendor，写盘在 A2b。
