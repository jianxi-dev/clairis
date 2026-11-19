# file-management 能力增量规格

## MODIFIED Requirements

### Requirement: C-6 视频预览播放器

应用 SHALL 以 `media://` 协议 Range 流式播放本地视频。播放器 SHALL 提供自定义控制条、快捷键、记忆播放位置、网页全屏与倍速播放。多栏场景下，每一格 SHALL 独立持有播放器实例与播放源：任一格打开新媒体 SHALL NOT 替换其他格的源，正在显示的视频 SHALL NOT 变黑或中断；同格切走页签 SHALL 保持播放并移出视口。

**同一格内打开不同的视频 SHALL 更新为该视频**：当前格显示的视频 URL 与标题 SHALL 等于最近一次打开的那个视频，SHALL NOT 停留在先前视频（修复「打开不同视频总是同一个」的串台缺陷）。切换视频后控制条时间戳、字幕与记忆位置 SHALL 按新视频重置。

应用 SHALL 以暂停态打开视频文件：`autoplay` SHALL 关闭、`autoPlayback` SHALL 关闭；程序重启恢复工作区后 SHALL NOT 自动播放。已有观看进度 MAY 被恢复为起始位置，但 SHALL NOT 因此开始播放。任一打开/恢复路径 SHALL NOT 触发播放，点击播放后 SHALL 仅存在一路声音（SHALL NOT 出现双音轨）。**打开完成后 SHALL 显示视频首帧画面，SHALL NOT 显示加载页或加载指示（loading spinner）**：元数据就绪后 SHALL 定位到首帧并暂停呈现（SHALL NOT 调用播放）；重启恢复路径同样 SHALL NOT 自动播放（与 batch20 task 2.4 约束共存）。**画中画 SHALL 为单文档单例**：同一文档同一时刻 SHALL 只存在一个画中画窗口；对另一个视频发起画中画 SHALL 替换当前窗口（先退出旧元素再进入新元素）；SHALL NOT 声称支持多画中画并存。

多个栏目同时显示视频时，每格 SHALL 持有独立的播放器与播放状态，播放/暂停/静音 SHALL 互不影响；多个视频 SHALL 可同时输出声音（SHALL NOT 只允许一路出声，SHALL NOT 自动静音非焦点格）。

字幕 SHALL 按「同文件名」收敛：字幕面板与快捷键 SHALL 只列出与当前视频 `file_stem` 相同的字幕文件；打开视频 SHALL 自动加载其同名字幕。

播放器窗口 SHALL 自动适配其所在格的内容区尺寸；格尺寸变化（含分栏比例变化至 90%）后 SHALL 重新适配并保持宽高比。进度条悬停缩略图 SHALL 稳定浮在进度条的上侧（锚定进度条实际位置），SHALL NOT 因播放器高度/控制条显隐而漂移。

控制条 SHALL 采用控制高度 38px、图标盒 24px、自绘图标 22px；右侧按钮 SHALL 统一 38×38 命中盒。倍速主控件与二级每档 SHALL 使用同一表盘几何，仅指针角度不同。全屏按钮 SHALL 使用与画中画相同线宽、相同尺寸的自绘图标。时间戳笔记图标 SHALL 与截图图标等高；播放列表图标底部 SHALL 与画面图标底部对齐。

二级菜单 SHALL 在 hover 时显示、移出 180ms 后隐藏，网页全屏态可用。截图 SHALL 写入剪贴板并在按钮上方提示。快捷键 SHALL 覆盖截图、画中画、画面、播放列表、循环、倍速、旋转、字幕、时间戳笔记、快捷键说明，并出现在总览「媒体」家族。

#### Scenario: 第二栏打开视频不影响第一栏

- **WHEN** 第一栏正在播放视频 A，用户在第二栏打开视频 B
- **THEN** 第一栏视频 A SHALL 继续播放且画面不变黑，第二栏视频 B SHALL 正常播放

#### Scenario: 同格切换视频更新源

- **WHEN** 用户在某格打开视频 A 后再打开视频 B
- **THEN** 该格显示的 `video.src` 与标题 SHALL 等于视频 B，SHALL NOT 仍为视频 A

#### Scenario: 两个不同视频源不相等

- **WHEN** 先后打开路径不同的两个视频
- **THEN** 两次渲染的 `<video>` `src` SHALL 不相等

#### Scenario: 第二栏打开其他格式不影响视频

- **WHEN** 第一栏正在播放视频，用户在第二栏打开 Markdown 文件
- **THEN** 第一栏视频 SHALL 继续播放

#### Scenario: 倍速表盘同形

- **WHEN** 打开倍速菜单
- **THEN** 主控件与每个档位 SHALL 使用同一表盘轮廓，1.0× 的 `data-angle` SHALL 为 0

#### Scenario: 全屏图标与画中画同线宽

- **WHEN** 测量全屏与画中画图标
- **THEN** 两者渲染尺寸 SHALL 均为 22×22，描边宽度 SHALL 相同

#### Scenario: 快捷按钮补齐

- **WHEN** 用户打开快捷键说明
- **THEN** 截图、画中画、画面、播放列表、循环、倍速、旋转、字幕、时间戳笔记 SHALL 均有对应快捷键条目

#### Scenario: 截图入剪贴板

- **WHEN** 用户点击「截取当前画面」
- **THEN** 剪贴板 SHALL 收到 PNG，提示 SHALL 出现在按钮上方

#### Scenario: 打开视频为暂停态

- **WHEN** 用户打开一个视频文件
- **THEN** 500ms 内 `video.paused` SHALL 为 `true`，且 SHALL NOT 自动发声

#### Scenario: 打开后显示首帧画面

- **WHEN** 用户打开一个视频文件并等待元数据就绪
- **THEN** 播放器 SHALL 呈现视频首帧画面（`video.currentTime` > 0 或已绘制首帧），SHALL NOT 显示加载页或加载指示；`video.paused` SHALL 为 `true`

#### Scenario: 重启不自动播放

- **WHEN** 应用重启并恢复含视频的布局
- **THEN** 恢复后的视频 SHALL 处于暂停态，SHALL NOT 自动发声，且 SHALL 显示首帧画面

#### Scenario: 单文档单画中画切换即替换

- **WHEN** 视频 A 已在画中画中，用户再对视频 B 发起画中画
- **THEN** 画中画窗口 SHALL 替换为视频 B（先退出 A 再进入 B），同一时刻 SHALL 只存在一个画中画窗口

#### Scenario: 多格独立控制

- **WHEN** 用户在两个栏目各打开一个视频，并分别点两点各自的播放按钮
- **THEN** 两个 `video` 元素 SHALL 同时为 `paused === false`

#### Scenario: 字幕只显示同名字幕

- **WHEN** 用户打开 `a.mp4`，其目录另有 `a.srt` 与 `b.srt`
- **THEN** 字幕候选 SHALL 只含 `a.srt`，且打开时 SHALL 自动加载 `a.srt`

#### Scenario: 进度缩略图在进度条上侧

- **WHEN** 用户把指针移到进度条上唤出缩略图
- **THEN** 缩略图浮层上缘 SHALL 位于进度条上缘之上（top < 进度条 top）

#### Scenario: 格尺寸变化后重新适配

- **WHEN** 用户在分栏中把比例拖到 90%
- **THEN** 播放器渲染尺寸 SHALL 随之适配格内容区并保持宽高比

### Requirement: 视频窄宽降级与手势

系统 SHALL 在播放器宽度收窄时先压缩按钮间距、到极限再按比例缩小图标，保证全部按钮可见。**触控板双指上下滑动 SHALL 调节亮度（画面左半）与音量（画面右半）**：实现 SHALL 监听无修饰键的 `wheel` 事件（触控板派发 `wheel` 而非 `touch`）；`Ctrl` / `Cmd + wheel` 的缩放语义 SHALL 保留；触屏 `touch` 通道 SHALL 保留。

#### Scenario: 收窄、手势与多画中画

> 场景标题沿用旧名以保持条款可追溯；自本 change 起画中画语义移入 C-6（单文档单例，切换即替换），本条款只保留宽度收窄与手势。

- **WHEN** 用户把播放器收窄到阈值，或执行双指上下滑动
- **THEN** 按钮溢出数为 0 且图标尺寸下降；亮度/音量分别变化

#### Scenario: 触控板双指滑动调亮度音量

- **WHEN** 用户在播放器画面左半 / 右半用触控板双指上下滑动（无修饰键）
- **THEN** 左半 SHALL 改变亮度、右半 SHALL 改变音量

#### Scenario: Ctrl 加滚轮缩放保留

- **WHEN** 用户按住 `Ctrl` / `Cmd` 在播放器上滚动滚轮
- **THEN** 缩放 SHALL 随之变化，SHALL NOT 触发亮度 / 音量调节
