# editing（delta）— ui-polish-batch15

## ADDED Requirements

### Requirement: 轮盘召唤与动作搜索

编辑态 SHALL NOT 在选中文字时自动弹出轮盘；轮盘 SHALL 只由显式入口（开关快捷键 / 圆心等）召唤。轮盘 SHALL 提供动作搜索：按一/二级动作名称过滤，只展示匹配动作及其可执行子动作，SHALL NOT 展示层级名称、SHALL NOT 重复；结果最多 9 行，超出 SHALL 可滚动，首行 SHALL 默认选中。每行右侧 SHALL 显示快捷键（首行回车，其后 cmd/ctrl+2~9），滚动时快捷键列 SHALL NOT 跟着横向移动。

#### Scenario: 搜索与快捷键列
- **WHEN** 用户选中文字，或打开轮盘搜索并输入「一级」
- **THEN** 选中文字后轮盘节点数为 0；搜索结果行数 ≤9、首行选中、无层级名；滚动后快捷键列横向坐标不变（A-2.1、A-3.1–A-3.5）

### Requirement: 音视频静音与音频收尾

音视频的静音状态 SHALL 按文件（页签）独立控制，SHALL NOT 共用全局状态。音频静音 SHALL 立即暂停并静音，SHALL NOT 保留可听见的声音残留；播放列表 SHALL 自动识别文档同级目录下的音频文件。

#### Scenario: 独立静音与收尾
- **WHEN** 文档含两个音视频页签，用户静音第一个
- **THEN** 第二个 muted 仍为 false；第一个在 100ms 时已不处于播放态、无声音残留；同目录 3 个音频时列表项数为 3（A-6.1–A-7.2）

### Requirement: 轮盘历史与颜色二级

轮盘历史分组 SHALL 在复制与前进之间提供剪切。颜色二级面板的透明项 SHALL 以棋盘格或描边呈现，字色/底色标签 SHALL 保持可读。

#### Scenario: 剪切位置与透明项
- **WHEN** 用户打开轮盘历史分组与颜色二级面板
- **THEN** 剪切按钮索引为 2；透明项有棋盘格或描边；关闭后无残留节点（A-10.1–A-10.2）

## MODIFIED Requirements

### Requirement: 块对齐

MD 编辑态 SHALL 支持块级对齐：左/中/右（至少），并 SHALL 复用与块颜色一致的作者语法（如 Pandoc fenced div 风格 `::: {.align-center}`），SHALL NOT 仅在 UI 显示而不改变文档。对齐 SHALL 作用于整块。编辑态 SHALL 隐藏对齐围栏标记，源码态 SHALL 保留；预览态 SHALL 仍按对齐渲染。

#### Scenario: 应用居中对齐

- **WHEN** 用户对某段落应用居中对齐
- **THEN** 文档源码 SHALL 出现对应的对齐标记，预览态该段落 SHALL 居中

#### Scenario: 取消对齐

- **WHEN** 用户对已居中段落再次应用居中
- **THEN** 对齐标记 SHALL 被移除，段落回到默认对齐

#### Scenario: 居中对齐后编辑态不露标记
- **WHEN** 用户对段落应用居中
- **THEN** 编辑态可见文本不含 `:::`；源码态仍含 `:::`；取消后编辑态无残留（A-5.1–A-5.2）
