## MODIFIED Requirements

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

### Requirement: C-6 视频预览播放器

应用 SHALL 以暂停态打开视频文件：`autoplay` SHALL 关闭、`autoPlayback` SHALL 关闭；程序重启恢复工作区后 SHALL NOT 自动播放。已有观看进度 MAY 被恢复为起始位置，但 SHALL NOT 因此开始播放。

多个栏目同时显示视频时，每格 SHALL 持有独立的播放器与播放状态，播放/暂停/静音 SHALL 互不影响；多个视频 SHALL 可同时输出声音（SHALL NOT 只允许一路出声，SHALL NOT 自动静音非焦点格）。既有约束继续有效：第二栏打开视频或其它格式 SHALL NOT 影响第一栏正在显示的视频。

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

#### Scenario: 第二栏不影响第一栏

- **WHEN** 第一栏正在播放视频，用户在第二栏打开另一个视频
- **THEN** 第一栏的视频源与播放状态 SHALL 不变

## ADDED Requirements

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
