## MODIFIED Requirements

### Requirement: C-2 拖拽打开

应用 SHALL 支持将文件拖入窗口、松开即打开，支持的格式范围 SHALL 与 C-1 完全一致（文本类进源码模式、媒体类进预览模式）。**一次拖入多个文件时 SHALL 全部打开**：SHALL 读取本次 drop 的全部路径并校验，**全部通过才整体打开**（任一不支持则整体不打开、不产生半开状态）。打开后 SHALL 调用既有分栏 / 自动布局能力把新文件排布为多栏，并播放**一次性**布局动效；动效结束后相关节点 SHALL 移除，不残留、不重复播放。SHALL NOT 新增持久化「布局方案」配置项。

#### Scenario: 拖入窗口即打开

- **WHEN** 用户将一个支持格式的文件从 Finder 拖入标月窗口并松开
- **THEN** 该文件 SHALL 直接打开（无需额外确认），打开模式按 C-1 的格式分流规则确定

#### Scenario: 多文件全部打开

- **WHEN** 用户一次拖入 3 个支持格式的文件
- **THEN** 3 个文件 SHALL 全部成为页签/栏目，布局 SHALL 按既有自动布局规则排成多栏

#### Scenario: 全部校验通过才打开

- **WHEN** 本次 drop 含一个不支持格式的文件
- **THEN** SHALL NOT 打开其中任何文件，页面 SHALL 保持 drop 前状态

#### Scenario: 一次性布局动效

- **WHEN** 多文件拖入完成自动布局
- **THEN** 布局动效类 SHALL 出现且仅出现一次，动效结束后该节点数 SHALL 为 0

### Requirement: C-6 视频预览播放器

应用 SHALL 以 `media://` 协议 Range 流式播放本地视频。播放器 SHALL 提供自定义控制条、快捷键、记忆播放位置、网页全屏与倍速播放。多栏场景下，每一格 SHALL 独立持有播放器实例与播放源：任一格打开新媒体 SHALL NOT 替换其他格的源，正在显示的视频 SHALL NOT 变黑或中断；同格切走页签 SHALL 保持播放并移出视口。

**同一格内打开不同的视频 SHALL 更新为该视频**：当前格显示的视频 URL 与标题 SHALL 等于最近一次打开的那个视频，SHALL NOT 停留在先前视频（修复「打开不同视频总是同一个」的串台缺陷）。切换视频后控制条时间戳、字幕与记忆位置 SHALL 按新视频重置。

应用 SHALL 以暂停态打开视频文件：`autoplay` SHALL 关闭、`autoPlayback` SHALL 关闭；程序重启恢复工作区后 SHALL NOT 自动播放。已有观看进度 MAY 被恢复为起始位置，但 SHALL NOT 因此开始播放。任一打开/恢复路径 SHALL NOT 触发播放，点击播放后 SHALL 仅存在一路声音（SHALL NOT 出现双音轨）。

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

#### Scenario: 重启不自动播放

- **WHEN** 应用重启并恢复含视频的布局
- **THEN** 恢复后的视频 SHALL 处于暂停态，SHALL NOT 自动发声

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
