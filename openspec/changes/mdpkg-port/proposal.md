# Proposal: 移植 .mdpkg 打包/解包（A1）

## Why

导出能力（A2）与「打开别人给的 .mdpkg」都需要 `.mdpkg` 的读写层。md-bundle 的 `@md-bundle/app-kit` 已经把这层做实：vendored ESM bundle（来自 `jianxi-dev/mdpkg`）+ 一层把硬错误收敛为确定性结果的封装 + 测试。重写没有收益，直接搬。

## What Changes

- 把 `mdpkg-web.js` vendor bundle 原样搬进 `src/lib/mdpkg/vendor/`。
- 搬 `openPackage` 封装（解包 → 校验 → 渲染；任何硬错误返回 `{ error }`，不抛）与 `readEntrySource`。
- 若 vendor 暴露打包函数，一并封装 `packPackage`（生成 `.mdpkg`，manifest 字段封闭，不注入署名）。
- 搬并适配测试到 `src/__tests__/`。

## Capabilities

### New Capabilities

- `mdpkg`：解包零抛错、错误码中文化、manifest 字段封闭、打包不注入署名。

### Modified Capabilities

<!-- 无 -->

## Impact

- 代码：`src/lib/mdpkg/`（vendor + 封装）；不改现有 UI。
- 接线：A1 是 expand 角色，导出由 A2（导出 HTML/PNG/.mdpkg）消费；打开 `.mdpkg` 的文件类型接线在 A2/A3 之后单独接。
- 风险：低。纯库移植 + 测试；vendor 原样，不改 manifest schema。
