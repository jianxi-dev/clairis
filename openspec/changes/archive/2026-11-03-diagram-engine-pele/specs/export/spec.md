## MODIFIED Requirements

### Requirement: EX-1 单文件离线产物

导出的 HTML SHALL 是单文件：样式内联、不引用 CDN 或外部脚本；可读到的相对路径图片 SHALL 内联为 data URL；读不到的图片 SHALL 保留原引用并在结果中报告数量；文档中的 mermaid 图块 SHALL 以 `<svg>` 内联进产物，SHALL NOT 只保留源码文本。

#### Scenario: 无外部依赖

- **WHEN** 导出任意 Markdown 文档
- **THEN** 产物 SHALL NOT 含指向 http(s) 的 `<script src>` 或 `<link rel=stylesheet>`；断网打开 SHALL 仍有排版样式

#### Scenario: 图片内联

- **WHEN** 文档引用同目录图片且文件可读
- **THEN** 产物中的 `img src` SHALL 为 `data:image/...;base64,...`

#### Scenario: 图以 SVG 内联

- **WHEN** 文档包含合法 mermaid 图块并导出 HTML 或 PNG
- **THEN** 产物中该图块位置 SHALL 出现内联 `<svg>`，SHALL NOT 只出现 ` ```mermaid ` 源码文本；产物打开时不依赖任何脚本即可显示该图
