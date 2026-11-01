# Design: Word 导出

## D1 管线

`stripFrontmatter(markdown)` → files Map（`document.md` = UTF-8 字节；每个资产按 name 写入解码后的字节）→ `toDocx(files, {}, onWarning)` → Blob → base64 → `save_binary_as_file(base64, "<标题>.docx")`。

## D2 契约

- 返回 `{ status: "saved" | "cancelled" | "error", message?, warnings: string[] }`。
- `toDocx` 抛错 → `error`；警告 → `warnings` 并在提示里显示条数（人话）。
- 产物必须是合法 ZIP（`.docx`）：字节以 `PK\x03\x04` 开头。

## D3 不变量

- 不注入署名/生成器标记。
- 不改 vendor；只在 `mdpkg-web.d.ts` 补声明。

## D4 UI

页签右键「导出 Word…」；生成中禁用；成功/失败走既有 3 秒提示。
