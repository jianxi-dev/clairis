## MODIFIED Requirements

### Requirement: A-13 悬浮预览的离开关闭与媒体渲染

悬浮预览窗 SHALL 在指针离开窗口且未钉住、未拖动、未缩放时自动关闭；SHALL 在指针仍位于阅读空间触发条目上时保持打开。

预览 SHALL 对图片、视频、音频渲染真实媒体元素并支持播放。图片 SHALL 按预览内容区宽度适配：当图片原始宽度大于内容区宽度时，其渲染宽度 SHALL 等于内容区宽度，高度按比例自适应；当原始宽度小于内容区宽度时 SHALL 保持原始宽度，SHALL NOT 放大。内容区 SHALL 可纵向滚动，长图 SHALL NOT 被压缩到适应高度。该行为 SHALL 与主预览区的图片行为一致。

HTML SHALL 以本地资源地址直接载入沙箱 iframe，并 SHALL 允许脚本执行与同源访问；SHALL NOT 使用内联文档字符串（`srcDoc`）承载整份文件，SHALL NOT 禁用脚本。HTML 中引用的外链样式与脚本 SHALL 按浏览器默认策略执行；SHALL NOT 显示源码文本。对于已保存的 HTML、图片、视频、音频、PDF 文件，预览 SHALL NOT 先经 IPC 读取完整内容再渲染；仅 Markdown、纯文本与代码类 SHALL 读取文本内容。

#### Scenario: 离开关闭

- **WHEN** 悬浮预览未钉住，指针移出预览窗且不在触发条目上
- **THEN** 预览窗 SHALL 自动关闭

#### Scenario: 媒体真实渲染

- **WHEN** 用户预览图片、视频或音频文件
- **THEN** 预览窗 SHALL 渲染 `img` / `video` / `audio` 元素而非纯文字占位

#### Scenario: 长图按宽适配并可滚动

- **WHEN** 用户在悬浮窗中预览一张高度远大于窗口高度的图片
- **THEN** 图片渲染宽度 SHALL 等于预览内容区宽度，内容区的 `scrollHeight` SHALL 大于其 `clientHeight`，用户可向下滚动查看其余部分

#### Scenario: 小图不被放大

- **WHEN** 用户在悬浮窗中预览一张宽度小于内容区的图片
- **THEN** 图片渲染宽度 SHALL 等于其原始宽度，SHALL NOT 被拉伸到内容区宽度

#### Scenario: HTML 允许脚本

- **WHEN** 用户在悬浮窗中预览一个依赖内联脚本与外链样式构建布局的自包含 HTML 文件
- **THEN** iframe SHALL 以本地资源地址载入（无 `srcDoc`），沙箱 SHALL 允许脚本，页面 SHALL 按自身样式与脚本正常布局

#### Scenario: 不预读二进制内容

- **WHEN** 用户预览一张图片或一个 HTML 文件
- **THEN** 预览 SHALL NOT 先通过 IPC 读取完整文件内容；图片与 HTML SHALL 由渲染器直接加载
