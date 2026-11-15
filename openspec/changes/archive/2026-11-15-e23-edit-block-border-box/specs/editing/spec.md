## MODIFIED Requirements

### Requirement: E-23 块宽度统一

预览态引用块的文字列宽度 SHALL 与正文段落相同。编辑态引用块与围栏代码块的边框盒（border box）宽度 SHALL 与普通正文行的行盒相同，且三者左右边界 SHALL 与正文文本块对齐；因内边距与边框，其文字列宽度相应收窄，SHALL NOT 要求与正文文字列等宽。宽度补偿 SHALL 通过调整块自身最大宽度实现，SHALL NOT 改动 `.cm-line` 的基础 1080px 行宽。

#### Scenario: 预览引用块与段落等宽

- **WHEN** 用户打开一份含引用块与段落的文档并进入预览态
- **THEN** 引用块文字列的宽度与相邻段落文字列宽度差 SHALL 为 0px

#### Scenario: 编辑态引用块与正文等宽

- **WHEN** 用户在同一文档进入编辑态
- **THEN** `.cm-line.cm-quote` 的边框盒左右边界 x 与普通 `.cm-line` 边框盒左右边界 x 差 SHALL 为 0px

#### Scenario: 编辑态代码块与正文等宽

- **WHEN** 文档含围栏代码块且光标不在块内
- **THEN** `.cm-line.cm-fenced-code` 的边框盒左右边界 x 与普通 `.cm-line` 边框盒左右边界 x 差 SHALL 为 0px
