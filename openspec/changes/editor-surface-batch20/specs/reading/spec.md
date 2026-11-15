## MODIFIED Requirements

### Requirement: 卡片缩略图高度

阅读空间卡片缩略图 SHALL 保持 4:3 比例并降低高度（宽 64 × 高 48），SHALL NOT 与上方标题/摘要或下方动作行重叠。视频卡片的缩略图 SHALL 显示真实首帧画面，SHALL NOT 只显示类型色底 + 图标；卡片存在进度/时间文字时，标题 SHALL NOT 与其重叠。

#### Scenario: 缩略图不与文字重叠

- **WHEN** 卡片处于最小高度
- **THEN** 缩略图矩形 SHALL NOT 与标题、摘要、底部动作行任一矩形相交

#### Scenario: 视频卡片显示真实首帧

- **WHEN** 阅读空间显示一个视频文件卡片
- **THEN** 其缩略图内 SHALL 存在取帧后的 `<video>`（`currentTime` > 0 或已绘制首帧），SHALL NOT 只有图标占位

#### Scenario: 文本卡片标题不压进度

- **WHEN** 阅读空间显示一个含阅读进度的文本文件卡片
- **THEN** 标题矩形与进度/时间文字矩形的交集面积 SHALL 为 0

### Requirement: A-19 预览图片圆角

预览态图片的四个角 SHALL 为圆角，且其圆角半径 SHALL 与视频块使用的圆角一致（取同一设计系统 token），上下两角半径 SHALL 相同。

#### Scenario: 四角半径一致

- **WHEN** 用户在预览态打开含图片的文档
- **THEN** 图片四个角的计算 `border-radius` SHALL 相同

#### Scenario: 图片圆角与视频一致

- **WHEN** 同一文档同时含图片与视频块
- **THEN** 图片与视频块的计算 `border-radius` SHALL 相等

### Requirement: 嵌入视频显示与播放

Markdown 预览/编辑态与 HTML 预览中嵌入的视频 SHALL 正常显示并可播放；内嵌播放控件的音量与进度滑块 SHALL 可见且可拖动，SHALL NOT 被白色色块覆盖。

嵌入视频在编辑态与预览态的默认宽度 SHALL 为页面宽度的三分之二（约内容区宽的 2/3）。视频右键菜单 SHALL 提供「全屏」，点击后 SHALL 脱离文档页面、以整个计算机屏幕显示；速率控件左侧 SHALL 提供宽度档菜单，含「满页面宽度」与「全屏」两档，编辑态与预览态 SHALL 都支持。

#### Scenario: 两处视频可播放

- **WHEN** 用户打开含视频链接的 Markdown 与 HTML 文档
- **THEN** 两处 `video` 节点数 SHALL 各为 1，`controls` SHALL 为 `true`，播放后 `currentTime` SHALL 大于 0

#### Scenario: 滑块可见

- **WHEN** 用户查看内嵌视频控件
- **THEN** 音量滑块 thumb 的宽度 SHALL 大于 0，且与轨道颜色有可见对比

#### Scenario: 默认宽度为页面三分之二

- **WHEN** 用户在编辑态或预览态查看嵌入视频
- **THEN** 视频显示宽度 SHALL 约为内容区宽度的 2/3（容差 ±5%）

#### Scenario: 宽度档菜单

- **WHEN** 用户点击速率控件左侧的宽度图标
- **THEN** SHALL 弹出含「满页面宽度」与「全屏」两档的菜单，选择后视频宽度 SHALL 相应切换

#### Scenario: 全屏脱离文档

- **WHEN** 用户在视频右键菜单点击「全屏」
- **THEN** 视频 SHALL 脱离当前文档页面、以整个屏幕显示，退出后 SHALL 回到原文档位置

## REMOVED Requirements

### Requirement: 视频打开即自动播放且多路独立

**Reason**: 与 `file-management` C-6「应用 SHALL 以暂停态打开视频文件…程序重启恢复工作区后 SHALL NOT 自动播放」直接冲突。用户 2026-11-15 缺陷 6 确认「重启后自动发声」为缺陷，自动播放语义不成立。

**Migration**: 打开视频统一为暂停态，行为以 `file-management` C-6 为准（含多格独立播放与出声）。
