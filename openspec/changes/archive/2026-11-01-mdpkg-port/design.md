# Design: .mdpkg 移植

## D1 原样搬 vendor

`mdpkg-web.js` 逐字节复制，不修改、不重打包。上游更新走重新拷贝。

## D2 封装契约

`openPackage(bytes, opts?) -> OpenResult | { error: string }`：
- 任何异常（非 ZIP / 损坏 / 0 条目 / 渲染失败）都转成 `{ error }`，调用方永远不用 try/catch。
- 技术错误码（MDPKG-E101/103/303/401）翻译为中文提示；未知码剥离前缀后返回，空则给通用提示。

`readEntrySource(bytes)`：返回入口 Markdown 原文（include 未展开）；入口缺失时抛 `MdeError`（源码预览需要区分「没有入口」）。

`packPackage(files, manifest)`（若 vendor 暴露）：打包为 `.mdpkg`；manifest 必须满足封闭 schema（`additionalProperties: false`），不接受额外字段；打包内容不得追加署名或生成器标记。

## D3 目录

```
src/lib/mdpkg/vendor/mdpkg-web.js   # 原样
src/lib/mdpkg/index.ts              # 封装 + 类型导出
```

## D4 测试

搬 `mdpkg.test.ts` 并用仓库内 fixture（若有）或最小构造；覆盖：正常解包、非 ZIP、0 条目、错误码翻译、打包→解包的往返、manifest 额外字段被拒。
