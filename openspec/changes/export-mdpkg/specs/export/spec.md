## ADDED Requirements

### Requirement: EX-6 .mdpkg 导出

应用 SHALL 支持把当前文档导出为 `.mdpkg`：产物 SHALL 是合法 ZIP（以 `PK\x03\x04` 开头），含 `document.md` 与本地图片资产，manifest SHALL 满足 `format=mdpkg`、`spec_version` 以 `1.` 开头且字段封闭；用 `.mdpkg` 打开入口 SHALL 得到与源文档逐字一致的 Markdown。

#### Scenario: 往返一致

- **WHEN** 导出一篇含一张本地图片的文档为 `.mdpkg`，再用打开器解包
- **THEN** 入口 Markdown SHALL 与源文档逐字一致，图片资产 SHALL 在包内

#### Scenario: 远程图片不进包

- **WHEN** 文档引用 `https://…` 图片
- **THEN** 打包 SHALL NOT 尝试下载或写入该远程资源
