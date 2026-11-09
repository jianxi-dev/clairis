## MODIFIED Requirements

### Requirement: C-1 打开文件

⌘O / 点击打开文件 SHALL 弹出系统文件选择器，过滤器 SHALL 至少包含：文档（含 `md`、`html`、`txt`、`sh`、`bash`、`zsh`、`py`、`json`、`css` 等文本/脚本）、图片（含 `png`、`jpg`、`heif`、`heic`、`svg`、`webp`、`avif`）、视频、音频（含 `mp3`、`wav`、`m4a`、`flac`、`ogg`、`aac`）、PDF。选中的脚本 SHALL 以源码打开；HEIF/HEIC SHALL 进入图片预览；音频 SHALL 进入音频播放器。

#### Scenario: 打开脚本文件

- **WHEN** 用户通过 ⌘O 选择一个 `.sh` 文件
- **THEN** SHALL 以源码模式打开该文件，内容可见可编辑

#### Scenario: 打开 HEIF 图片

- **WHEN** 用户通过 ⌘O 选择一个 `.heif` 文件
- **THEN** SHALL 进入图片预览，不得按文本读取

#### Scenario: 打开音频

- **WHEN** 用户通过 ⌘O 选择一个 `.mp3` 文件
- **THEN** SHALL 进入音频预览播放器

### Requirement: C-6 视频预览播放器

应用 SHALL 以 `media://` 协议 Range 流式播放本地视频。播放器 SHALL 提供自定义控制条、快捷键、记忆播放位置、网页全屏与倍速播放。多栏场景下，每一格 SHALL 独立持有播放器实例与播放源：任一格打开新媒体 SHALL NOT 替换其他格的源，正在显示的视频 SHALL NOT 变黑或中断；同格切走页签 SHALL 保持播放并移出视口。

控制条 SHALL 采用控制高度 38px、图标盒 24px、自绘图标 22px；右侧按钮 SHALL 统一 38×38 命中盒。倍速主控件与二级每档 SHALL 使用同一表盘几何，仅指针角度不同。全屏按钮 SHALL 使用与画中画相同线宽、相同尺寸的自绘图标。时间戳笔记图标 SHALL 与截图图标等高；播放列表图标底部 SHALL 与画面图标底部对齐。

二级菜单 SHALL 在 hover 时显示、移出 180ms 后隐藏，网页全屏态可用。进度条悬停缩略图 SHALL 对应当前媒体。截图 SHALL 写入剪贴板并在按钮上方提示。快捷键 SHALL 覆盖截图、画中画、画面、播放列表、循环、倍速、旋转、字幕、时间戳笔记、快捷键说明，并出现在总览「媒体」家族。

#### Scenario: 第二栏打开视频不影响第一栏

- **WHEN** 第一栏正在播放视频 A，用户在第二栏打开视频 B
- **THEN** 第一栏视频 A SHALL 继续播放且画面不变黑，第二栏视频 B SHALL 正常播放

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
