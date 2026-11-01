# Proposal: 导出 Word（.docx）（A2c）

## Why

A2b 已经落了主进程二进制写盘。`.mdpkg` 的 vendor 里自带 `toDocx`（OOXML 写入、图片内联、结构保真），只需要一层薄封装 + 菜单入口，就能把当前文档导出为 Word。

## What Changes

- 新增 `src/lib/export/docx.ts`：剥离 YAML frontmatter → 组装 files Map（`document.md` + 资产原始字节）→ `toDocx` → Blob → base64 → `save_binary_as_file`。
- 页签右键菜单新增「导出 Word…」。
- 非致命警告（SVG 降级、图片头解析失败）汇总进提示，不静默吞掉。
- 包内文件不注入署名。

## Capabilities

### New Capabilities

<!-- 无 -->

### Modified Capabilities

- `export`：新增 EX-5 Word 导出（字节有效性、frontmatter 剥离、警告可见）。

## Impact

- 代码：`src/lib/export/docx.ts`、`src/components/TabBar.tsx`、`src/lib/mdpkg/vendor/mdpkg-web.d.ts`（补 `toDocx` 声明）。
- 风险：低。字节生成在 vendor；写盘复用 A2b。
