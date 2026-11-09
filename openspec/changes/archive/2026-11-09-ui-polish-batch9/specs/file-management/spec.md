## MODIFIED Requirements

### Requirement: C-6 视频预览播放器

视频预览 SHALL 使用 ArtPlayer 渲染，控制条高度 SHALL 为 38px。右侧控制按钮 SHALL 统一为 38×38 命中盒、图标盒子 24×24、图标绘制尺寸 22px，并 SHALL 水平与垂直居中；原生控件与自绘控件的图标 SHALL 呈现一致的视觉尺寸。

倍速、画面、播放列表、字幕、快捷键五个控件 SHALL 各有一个二级菜单。二级菜单 SHALL 在指针滑入控件时显示、滑出控件或菜单后 180ms 内隐藏；点击仍 SHALL 可切换。二级菜单的水平中心默认 SHALL 与触发时的鼠标 x 对齐，仅在触及播放器左右边界时 SHALL 被钳制在可视区内。网页全屏态下二级菜单 SHALL 与普通态一致可用。

进度条悬停缩略图 SHALL 对应当前正在播放的媒体：切换播放列表集数后，后续悬停抽出 SHALL 来自新媒体的帧。缩略图抽取失败时 SHALL 只显示时间提示，不阻塞播放。

截图 SHALL 写入剪贴板；截图结果提示（成功或失败）SHALL 显示在截图按钮正上方，SHALL NOT 使用播放器顶部通知。快捷键说明浮层宽度 SHALL 为 168px（较原 250px 缩窄约 1/3）。倍速菜单每档 SHALL 显示指针表盘：1.0× 指针指 12 点位，低于 1.0× 偏左、高于 1.0× 偏右，角度随倍速单调变化。

#### Scenario: 全屏态二级菜单可用

- **WHEN** 播放器处于网页全屏，用户把指针移入倍速控件
- **THEN** 倍速二级菜单 SHALL 出现，SHALL NOT 显示「全屏下不可用」或空菜单

#### Scenario: 二级菜单 hover 显隐

- **WHEN** 用户把指针移入画面控件再移出
- **THEN** 画面菜单 SHALL 出现，移出 180ms 后 SHALL 关闭

#### Scenario: 菜单以鼠标为中心

- **WHEN** 用户在播放器中部把指针移入字幕控件
- **THEN** 菜单水平中心与鼠标 x 的差值 SHALL ≤2px（未触及边界时）

#### Scenario: 缩略图随集刷新

- **WHEN** 用户切换到播放列表中的下一个视频，再悬停进度条
- **THEN** 缩略图画布 SHALL 来自新视频的对应时间点，不得仍是首个视频的画面

#### Scenario: 截图提示位于按钮上方

- **WHEN** 截图完成
- **THEN** 提示节点的底边 SHALL 位于截图按钮顶边之上（差值 ≥4px）

#### Scenario: 倍速表盘指针角度

- **WHEN** 打开倍速菜单
- **THEN** 每档 SHALL 有一个 `data-rate-dial` 表盘；1.0× 的 `data-angle` SHALL 为 0，0.5× SHALL 小于 0，2.0× SHALL 大于 0

#### Scenario: 快捷键与画面图标可辨认

- **WHEN** 用户查看右侧控制条
- **THEN** 快捷键图标 SHALL 含圆角键盘外框与空格键；画面图标 SHALL 为图片框构图，SHALL NOT 为三条滑杆
