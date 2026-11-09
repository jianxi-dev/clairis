## ADDED Requirements

### Requirement: 视频控件修正（第十一批）

视频快捷键、播放列表与字幕面板 SHALL NOT 显示右上角关闭按钮。倍速菜单宽度 SHALL 为原宽度的三分之二；倍速档位图标在悬停时 SHALL 保持与刻度弧相同颜色。旋转按钮每次点击 SHALL 让画面逆时针旋转 90°。

#### Scenario: 面板无关闭按钮

- **WHEN** 用户打开快捷键、播放列表或字幕面板
- **THEN** 面板内关闭按钮数量 SHALL 为 0

#### Scenario: 倍速图标不高亮

- **WHEN** 用户把指针停在某个倍速档位上
- **THEN** 档位图标颜色 SHALL 与刻度弧一致，SHALL NOT 变为强调色

#### Scenario: 逆时针旋转

- **WHEN** 用户点击旋转按钮一次
- **THEN** 画面 SHALL 逆时针旋转 90°
