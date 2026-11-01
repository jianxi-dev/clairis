# mdpkg Specification

## Purpose
TBD - created by archiving change mdpkg-port. Update Purpose after archive.
## Requirements
### Requirement: M-1 解包零抛错

`openPackage(bytes)` SHALL 永远返回结果对象，不抛出：成功返回 `OpenResult`；非 ZIP、损坏、0 条目或渲染失败 SHALL 返回 `{ error }`，错误文案为中文。

#### Scenario: 非 ZIP 输入

- **WHEN** 传入一段不是 ZIP 的字节
- **THEN** 返回 `{ error: "不是有效的 .mdpkg 文件" }` 这类中文提示，不抛异常

#### Scenario: 技术错误码翻译

- **WHEN** vendor 返回含 `MDPKG-E103` 的错误
- **THEN** 返回文案 SHALL 为「文件格式不正确，无法打开此文件」，SHALL NOT 暴露错误码

### Requirement: M-2 入口源码可读

`readEntrySource(bytes)` SHALL 返回入口 Markdown 原文（include 未展开）；入口缺失时 SHALL 抛出可识别的 `MdeError`。

#### Scenario: 读取入口

- **WHEN** 打开一个含入口 `index.md` 的包
- **THEN** SHALL 返回该 Markdown 的原始文本，正文与包内文件逐字一致

### Requirement: M-3 打包与 manifest 封闭

`packPackage` SHALL 产出可被 `openPackage` 重新打开的 `.mdpkg`；manifest SHALL 遵守封闭 schema（不接受额外字段）；打包内容 SHALL NOT 注入署名、生成器标记或时间戳。

#### Scenario: 往返一致

- **WHEN** 用一组文件与合法 manifest 打包后再解包
- **THEN** 文件内容 SHALL 与打包前逐字一致，manifest 字段 SHALL 不变

#### Scenario: 额外字段被拒

- **WHEN** manifest 含 schema 之外的字段
- **THEN** 打包 SHALL 失败并给出字段名，SHALL NOT 静默丢弃或写入

