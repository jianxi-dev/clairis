## ADDED Requirements

### Requirement: PDF 悬浮预览隐藏缩放条

PDF 悬浮预览 SHALL 与阅读空间卡片缩略图一致，隐藏 embedpdf 自带的放大 / 缩小工具条按钮；预览仍 SHALL 可滚动与翻页。

#### Scenario: 悬浮预览无缩放按钮

- **WHEN** 用户悬停一张 PDF 卡片唤出悬浮预览
- **THEN** 预览内 SHALL NOT 出现 `data-epdf-i="zoom-toolbar"` 的缩放按钮

### Requirement: 卡片缩略图高度

阅读空间卡片缩略图 SHALL 保持 4:3 比例并降低高度（宽 64 × 高 48），SHALL NOT 与上方标题/摘要或下方动作行重叠。

#### Scenario: 缩略图不与文字重叠

- **WHEN** 卡片处于最小高度
- **THEN** 缩略图矩形 SHALL NOT 与标题、摘要、底部动作行任一矩形相交
