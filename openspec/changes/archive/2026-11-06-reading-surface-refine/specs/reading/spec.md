## ADDED Requirements

### Requirement: R-4 悬浮预览的离开关闭与媒体渲染

悬浮预览窗 SHALL 在指针离开窗口且未钉住、未拖动、未缩放时自动关闭；SHALL 在指针仍位于阅读空间触发条目上时保持打开。预览 SHALL 对图片、视频、音频渲染真实媒体元素并支持播放；HTML SHALL 以沙箱 iframe 渲染，SHALL NOT 显示源码文本。

#### Scenario: 离开关闭
- **WHEN** 悬浮预览未钉住，指针移出预览窗且不在触发条目上
- **THEN** 预览窗 SHALL 自动关闭

#### Scenario: 媒体真实渲染
- **WHEN** 用户预览图片、视频或音频文件
- **THEN** 预览窗 SHALL 渲染 `img` / `video` / `audio` 元素而非纯文字占位

### Requirement: R-5 HTML 摘要文本化

阅读空间与门户中的 HTML 文件摘要 SHALL 显示去标签后的正文文字，SHALL NOT 显示 HTML 源码；缩略图 SHALL 显示中性占位图，不伪造 HTML 页面缩略图。

#### Scenario: HTML 摘要去标签
- **WHEN** 某 HTML 文件进入最近列表
- **THEN** 其摘要 SHALL 不包含 `<tag>` 形式的源码文本
