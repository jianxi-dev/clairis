# file-management — 文件管理基础当前规格

## Purpose

file-management 域定义标月桌面端的文件管理基础能力：按格式分流打开文件、拖拽打开、自动保存、新建文档，以及统一文件面板中的"全部文件"视图。本规格是 file-management 域可验收功能行为的唯一真相源；条目编号（C-1 至 C-5）与 `docs/MVP-需求跟踪表.md` 模块 C 一一对应。保存写入的原子性与写入保护规格见 editing 域 E-3。

## 设计来源与参考

- 需求基线：`docs/CORE-REQUIREMENTS-clairis.md` §二 阶段矩阵（Phase M：打开文件、拖拽打开、新建文档、自动保存 2s debounce；Phase R：全部文件视图）、§三 快捷键体系（Cmd+O / Cmd+N）；`docs/MVP-需求跟踪表.md` 模块 C（C-1 至 C-5 均标 ✅）
- C-5 批准设计（全部文件视图）：`docs/design/approved/navigation/spec.md` §3.2（经由统一文件面板呈现，面板整体规格见 navigation 域 B-3）
## Requirements
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

### Requirement: C-2 拖拽打开

应用 SHALL 支持将文件拖入窗口、松开即打开，支持的格式范围 SHALL 与 C-1 完全一致（文本类进源码模式、媒体类进预览模式）。

#### Scenario: 拖入窗口即打开

- **WHEN** 用户将一个支持格式的文件从 Finder 拖入标月窗口并松开
- **THEN** 该文件 SHALL 直接打开（无需额外确认），打开模式按 C-1 的格式分流规则确定

### Requirement: C-3 自动保存

编辑停止后 SHALL 经过 2 秒防抖（debounce）自动写入磁盘，无需用户手动触发。

#### Scenario: 停止编辑自动写入

- **WHEN** 用户在文档中输入后停止编辑并保持 2 秒
- **THEN** 应用 SHALL 自动将内容写入磁盘

#### Scenario: 持续编辑不重复写入

- **WHEN** 用户以小于 2 秒的间隔连续输入
- **THEN** 自动保存 SHALL 被防抖延后到停止输入 2 秒后执行

### Requirement: C-4 新建文档

`Cmd+N` SHALL 建立一个空白编辑页，初始内容为空字符串（`""`），不插入任何默认问候语或模板内容；新建文档 SHALL 默认为 Markdown 类型（`.md`），页签 SHALL 显示 Markdown 类型图标（SHALL NOT 显示文本图标）。新建 SHALL 使用户进入工作区栏目页（SHALL NOT 停留在首页/门户场景）。首次保存时 SHALL 由用户选择路径与文件名；若配置中存在默认保存路径，保存对话框的初始目录 SHALL 为该路径，文件名 SHALL 预填页签标题。设置页 SHALL 提供默认保存路径的读取、选择与清除入口，该值 SHALL 持久化并在重启后保持。内置示例文件经由独立释放机制提供（见 application-shell 域 B-4），不进入新建文档流程。

#### Scenario: 新建为纯空白页

- **WHEN** 用户按 `Cmd+N`
- **THEN** 应用 SHALL 打开一个初始内容为空字符串的空白编辑页，不含默认文案

#### Scenario: 默认 Markdown 与图标

- **WHEN** 用户新建一个文件
- **THEN** 页签 SHALL 显示 Markdown 类型图标，该页签 SHALL 为 Markdown 类型

#### Scenario: 新建后进入栏目页

- **WHEN** 用户在首页/门户点击「新建文件」
- **THEN** 应用 SHALL 离开首页进入工作区栏目页并显示该新建页签

#### Scenario: 首次保存选择路径

- **WHEN** 用户对尚未落盘的新建文档首次执行保存
- **THEN** 应用 SHALL 弹出路径与文件名选择，随后才写入磁盘

#### Scenario: 默认保存路径预填

- **WHEN** 设置页已配置默认保存路径 `/Users/test/Docs`，用户对未保存的新建页签按 `Cmd+S`
- **THEN** 保存对话框 SHALL 以 `/Users/test/Docs` 作为初始目录，文件名 SHALL 预填页签标题
- **AND** 确认后文件 SHALL 落在该目录，页签 SHALL 变为已保存

#### Scenario: 默认路径持久化

- **WHEN** 用户设置默认保存路径并重启应用
- **THEN** 设置页 SHALL 仍显示该路径

#### Scenario: 未配置默认路径时行为不变

- **WHEN** 默认保存路径为空，用户首次保存新建文档
- **THEN** 保存对话框 SHALL 按系统默认目录打开，应用 SHALL NOT 报错

### Requirement: C-5 全部文件视图

统一文件面板的"全部"视图 SHALL 列出工作目录下的所有文件，按修改时间（mtime）倒序排列；默认显示 20 条，超出部分 SHALL 折叠为"显示全部 →"入口，点击后展开完整列表。

#### Scenario: mtime 倒序与默认条数

- **WHEN** 用户在统一文件面板进入"全部"视图
- **THEN** 文件 SHALL 按 mtime 倒序排列，默认最多显示 20 条

#### Scenario: 超 20 条折叠

- **WHEN** 工作目录文件数超过 20
- **THEN** 列表 SHALL 截断为 20 条并显示"显示全部 →"；点击后 SHALL 展开全部文件

### Requirement: C-6 视频预览播放器

应用 SHALL 以 `media://` 协议 Range 流式播放本地视频。播放器 SHALL 提供自定义控制条、快捷键、记忆播放位置、网页全屏与倍速播放。多栏场景下，每一格 SHALL 独立持有播放器实例与播放源：任一格打开新媒体 SHALL NOT 替换其他格的源，正在显示的视频 SHALL NOT 变黑或中断；同格切走页签 SHALL 保持播放并移出视口。

应用 SHALL 以暂停态打开视频文件：`autoplay` SHALL 关闭、`autoPlayback` SHALL 关闭；程序重启恢复工作区后 SHALL NOT 自动播放。已有观看进度 MAY 被恢复为起始位置，但 SHALL NOT 因此开始播放。

多个栏目同时显示视频时，每格 SHALL 持有独立的播放器与播放状态，播放/暂停/静音 SHALL 互不影响；多个视频 SHALL 可同时输出声音（SHALL NOT 只允许一路出声，SHALL NOT 自动静音非焦点格）。

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

#### Scenario: 打开视频为暂停态

- **WHEN** 用户打开一个视频文件
- **THEN** 500ms 内 `video.paused` SHALL 为 `true`，且 SHALL NOT 自动发声

#### Scenario: 重启不自动播放

- **WHEN** 应用重启并恢复含视频的布局
- **THEN** 恢复后的视频 SHALL 处于暂停态

#### Scenario: 多格独立控制

- **WHEN** 用户在两个栏目各打开一个视频，并分别点两点各自的播放按钮
- **THEN** 两个 `video` 元素 SHALL 同时为 `paused === false`
- **AND** 两个 `video` 元素的 `muted` SHALL 均为 `false`

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

### Requirement: C-16 页签右键菜单与文件移动

页签右键菜单 SHALL 在既有分隔线下方提供「复制路径」与「移动到…」两项；栏目「更多」菜单 SHALL NOT 再包含「复制路径」。「复制路径」SHALL 把当前文件的绝对路径写入剪贴板；未落盘页签 SHALL 提示无路径可复制。「移动到…」SHALL 打开目录选择，把当前文件移动到所选目录，成功后 SHALL 更新页签的文件路径与资源注册，失败 SHALL 保持原路径并提示错误。目标目录已存在同名文件时 SHALL 追加序号避免覆盖。

#### Scenario: 栏目菜单移除复制路径

- **WHEN** 用户打开任一栏目的「更多」菜单
- **THEN** 菜单项 SHALL NOT 包含「复制路径」

#### Scenario: 页签右键菜单分隔线下方含两项

- **WHEN** 用户右键点击一个已保存文件的页签
- **THEN** 菜单 SHALL 在分隔线下方依次包含「复制路径」与「移动到…」

#### Scenario: 复制路径写入剪贴板

- **WHEN** 用户对 `/Users/test/a.md` 的页签点击「复制路径」
- **THEN** 剪贴板内容 SHALL 严格等于 `/Users/test/a.md`

#### Scenario: 移动到其他文件夹

- **WHEN** 用户对一个文件点击「移动到…」并选择目录 `/Users/test/target`
- **THEN** 文件 SHALL 出现在 `/Users/test/target`，原目录 SHALL 不再有该文件
- **AND** 页签的文件路径 SHALL 更新为新路径

#### Scenario: 同名不覆盖

- **WHEN** 目标目录已有同名文件，用户移动
- **THEN** 应用 SHALL 以追加序号的新文件名落盘，SHALL NOT 覆盖已有文件

#### Scenario: 未落盘页签复制路径

- **WHEN** 用户对尚未保存的页签点击「复制路径」
- **THEN** 应用 SHALL 提示无路径可复制，SHALL NOT 写入空字符串

### Requirement: 栏目菜单定位文案

系统 SHALL 将栏目「更多」菜单中的「打开所在文件夹」更名为「打开文件位置」，其余菜单项与顺序不变。

#### Scenario: 菜单项文本

- **WHEN** 用户打开栏目「更多」菜单
- **THEN** 菜单第四项文本为「打开文件位置」，且仍触发在文件管理器中定位（A-6.1）

