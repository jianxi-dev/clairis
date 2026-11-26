## ADDED Requirements

### Requirement: 预览态图片双击查看

预览模式下的图片 SHALL 支持双击进入最大化查看层（与编辑态同一放大层实现：缩放、平移、旋转、下载、多图切换）；Esc、再次双击或点击遮罩 SHALL 退出且不改动文档。预览态图片双击 SHALL NOT 触发预览容器既有的缩放复位行为。

#### Scenario: 预览态双击进入放大层

- **WHEN** 用户在预览模式双击文档中的图片
- **THEN** 放大查看层 SHALL 打开并显示该图（含裁剪呈现），SHALL NOT 改动文档内容

#### Scenario: 预览态双击退出

- **WHEN** 用户在预览态放大层内再次双击或按 Esc
- **THEN** 放大层 SHALL 关闭，预览页面 SHALL 无残留遮罩

#### Scenario: 预览双击不触发容器复位

- **WHEN** 用户在预览模式缩放视图后双击图片再退出放大层
- **THEN** 预览容器自身缩放 SHALL 保持不变，SHALL NOT 被双击复位
