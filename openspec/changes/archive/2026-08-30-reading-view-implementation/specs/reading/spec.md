## MODIFIED Requirements

### Requirement: A-9 阅读进度与位置恢复

阅读模式下 SHALL 常驻一条"墨线"进度指示：位于滚动区域右边缘（距右边距 3px）、宽 2px、高度覆盖整个文档滚动区域；已读部分（上）为 rgba(0,0,0,0.14)、未读部分（下）为 rgba(0,0,0,0.04)，以自然明暗过渡为分界，无额外标记。墨线 SHALL 在滚动时实时更新（requestAnimationFrame，约 16ms 节流），不 hover 展开、无章节节点、无剩余时间/字数面板；沉浸态与编辑态 SHALL 不显示墨线。位置恢复 SHALL 基于 tabs store 的 `tabs[].scrollPos` + `contentHeight` 运行时字段，跨会话持久化 SHALL 存放于现有 `config.json` 的 `scrollPositions` 映射（key 为文件路径，不新建 JSON 文件）：滚动停止 200ms debounce 写入，切换/关闭 tab 与关闭窗口时立即写入；恢复时高度未变按像素跳转、高度变化按百分比恢复、无记录跳顶部。

#### Scenario: 墨线随滚动更新

- **WHEN** 用户在阅读模式下滚动文档
- **THEN** 右边缘墨线 SHALL 实时反映已读/未读比例（上深下浅），快速滚动 SHALL 不卡顿

#### Scenario: 沉浸态与编辑态隐藏墨线

- **WHEN** 用户进入沉浸态或切换到编辑态
- **THEN** 墨线 SHALL 不显示
- **AND** 沉浸态按 Esc 浮出工具栏后（退出沉浸）墨线 SHALL 重新显示

#### Scenario: 关闭再打开恢复位置

- **WHEN** 用户关闭一篇已读到中部的文档后重新打开，且文档未被修改
- **THEN** 滚动位置 SHALL 恢复到关闭前的 `scrollPos`（像素级）

#### Scenario: 文档高度变化按百分比恢复

- **WHEN** 用户在文档增加段落后重新打开
- **THEN** 应用 SHALL 按 `scrollPos / 旧内容高度` 的百分比恢复位置（文档未大改时误差 < 5%）

#### Scenario: 无历史记录跳顶部

- **WHEN** 用户打开一篇没有保存过滚动位置的新文档
- **THEN** 视图 SHALL 定位到顶部

#### Scenario: 分栏墨线归属

- **WHEN** 用户处于"编辑 + 预览"左右分栏
- **THEN** 仅预览 pane SHALL 显示墨线，编辑区无墨线；上下双栏时两个 pane 各自显示自己的墨线