## ADDED Requirements

### Requirement: EX-5 Word 导出

应用 SHALL 支持把当前文档导出为 `.docx`：产物 SHALL 是合法 OOXML ZIP（以 `PK\x03\x04` 开头）；YAML frontmatter SHALL NOT 进入正文；上游非致命警告 SHALL 汇总提示；产物 SHALL NOT 含署名。

#### Scenario: 正常导出

- **WHEN** 用户对含 frontmatter 与一张图片的文档选择「导出 Word…」
- **THEN** SHALL 产出 `.docx`，正文不含 frontmatter，图片随文档内联

#### Scenario: 取消

- **WHEN** 用户在保存对话框中取消
- **THEN** SHALL 不报错，也不写文件
