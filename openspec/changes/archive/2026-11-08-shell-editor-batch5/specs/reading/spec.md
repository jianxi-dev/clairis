## ADDED Requirements

### Requirement: PDF 预览缩放

PDF 预览 SHALL 移除放大 / 缩小工具条按钮（SHALL NOT 在顶栏渲染独立的 +/− 缩放按钮），缩放 SHALL 由触控板双指捏合（或等价的缩放输入）驱动。缩放百分比输入 / 菜单 SHALL 保留可用。

#### Scenario: 无放大缩小按钮

- **WHEN** 用户打开一个 PDF
- **THEN** PDF 顶栏 SHALL NOT 出现独立的放大/缩小按钮

#### Scenario: 双指捏合缩放

- **WHEN** 用户在 PDF 上做双指捏合手势
- **THEN** PDF 缩放 SHALL 随之变化

### Requirement: PDF 页码工具条位置

PDF 的页码 / 翻页控件 SHALL 位于顶部按钮区，SHALL NOT 在滚动时于底部浮现页码工具条。

#### Scenario: 滚动不浮现底栏

- **WHEN** 用户滚动 PDF
- **THEN** SHALL NOT 在底部浮现页码/翻页工具条

#### Scenario: 顶部可翻页

- **WHEN** 用户需要翻页
- **THEN** 页码 / 上一页 / 下一页控件 SHALL 位于顶部按钮区可用

### Requirement: PDF 卡片缩略图

阅读空间与网格的 PDF 文件卡片 SHALL 显示真实的首页缩略图，SHALL NOT 只显示确定性的占位矩形（无内容的类型色块 + 线条）。

#### Scenario: PDF 卡片显示首页缩略图

- **WHEN** 用户查看一张 PDF 文件的卡片
- **THEN** 缩略图区域 SHALL 显示该 PDF 首页的真实图像
