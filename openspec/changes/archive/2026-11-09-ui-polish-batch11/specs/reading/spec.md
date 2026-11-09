## ADDED Requirements

### Requirement: 页面宽度控件与 PDF 主题（第十一批）

状态栏页面宽度控件 SHALL 默认不可见，指针进入其区域时 SHALL 淡入，离开后 SHALL 淡出；控件 SHALL NOT 绘制虚线边框；三个宽度挡位 SHALL 使用强调色并保持可辨识。

PDF 查看器的文件选项、大纲/书签面板、页数、缩放菜单与按钮栏下边线 SHALL 使用应用主题 token，亮/暗/暖三主题下 SHALL 跟随主题变化。

#### Scenario: 页面宽度滑入显示

- **WHEN** 指针进入状态栏页面宽度区域
- **THEN** 控件计算 `opacity` SHALL 在 150ms 内变为 1；移出后 200ms 内回到 0

#### Scenario: PDF 跟随主题

- **WHEN** 用户在亮/暗/暖主题间切换并打开 PDF
- **THEN** 按钮栏下边线与面板文字颜色 SHALL 随主题变化，SHALL NOT 保持固定色值
