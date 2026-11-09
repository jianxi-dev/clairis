## MODIFIED Requirements

### Requirement: 状态栏（含主页入口 / 自动布局入口 / 宽度面板 / 主题面板）

应用外壳 SHALL 在窗口底部常驻一条状态栏。状态栏右侧 SHALL 依次排放 主页 / 自动布局 / 网格概览 / AI / 主题切换 / 沉浸入口 六个图标。状态栏高度 SHALL 紧凑（默认字号下计算高度不超过 26px）。双击状态栏空白处 SHALL 切换显隐；隐藏态 SHALL 在指针滑入窗口底部热区 0.5 秒内显现。隐藏态或沉浸态下临时显现的状态栏 SHALL 以悬浮层（`position: fixed`）覆盖在内容之上，SHALL NOT 参与流式布局、SHALL NOT 改变正文容器高度；指针移出后 SHALL 立即隐藏，且滑入/滑出 SHALL NOT 引起正文位移。

页面宽度数字 SHALL 可点击打开宽度调整面板：上行三个可点击的斜面柱代表三档（紧凑 720 / 标准 960 / 宽松 1200），三柱 SHALL 水平居中、并排相接（柱间无间隙）、单柱宽 22px、高度由左至右递增 14 / 18 / 22px。每个刻度柱 SHALL 在指针悬停或键盘聚焦时显示 1px 虚线边框，移出或失焦时边框 SHALL 隐藏；边框 SHALL NOT 被斜面裁剪。下行一条滑块，滑块最大值为 1400px，滑块宽度 SHALL 大于三柱总宽。面板宽度 SHALL 为 200px，并 SHALL 按窗口宽度夹取在可视区内。面板 SHALL 支持外部 `pointerdown` 与 `Esc` 关闭。

#### Scenario: 状态栏常驻且含六图标

- **WHEN** 应用处于任何非沉浸状态
- **THEN** 窗口底部 SHALL 显示状态栏，其右侧 SHALL 含 主页 / 自动布局 / 网格概览 / AI / 主题 / 沉浸 六个图标

#### Scenario: 宽度刻度柱 hover 虚线

- **WHEN** 用户把指针移到某一根宽度刻度柱上
- **THEN** 该柱 SHALL 显示 1px 虚线边框，另外两根 SHALL 保持透明边框；移出后该柱边框 SHALL 恢复透明

#### Scenario: 隐藏态状态栏不挤压正文

- **WHEN** 状态栏处于隐藏/沉浸态，用户把指针移入底部热区使状态栏浮现
- **THEN** 状态栏计算 `position` SHALL 为 `fixed`，正文容器高度 SHALL 与浮现前完全一致

#### Scenario: 宽度面板三柱居中相接

- **WHEN** 用户点击状态栏宽度数字打开面板
- **THEN** 三根刻度柱的中心 SHALL 与面板水平中线重合（偏差 ≤1px），柱间 `gap` SHALL 为 0，滑块宽度 SHALL 大于三柱总宽

### Requirement: 栏目头（页签 / 模式 / 全屏 / 更多 / 关闭）

栏目头 SHALL 在右侧提供一组操作图标：预览/编辑切换、全屏、更多操作、关闭栏目。整组图标 SHALL 收在同一个操作容器内；默认 SHALL 隐藏（计算 `opacity` 为 0），指针滑入该容器、栏目获得焦点（`:focus-within`）或任一菜单处于打开态时 SHALL 显示（计算 `opacity` 为 1）。容器 SHALL 保持可被指针命中，以便隐藏态下也能通过滑入唤出整组图标。全屏按钮 SHALL NOT 再单独使用一套显隐门控。

#### Scenario: 栏目图标整组 hover 显隐

- **WHEN** 指针不在栏目头右侧操作区
- **THEN** 该组图标的计算 `opacity` SHALL 为 0

#### Scenario: 滑入后四枚图标一起出现

- **WHEN** 用户把指针移入栏目头右侧操作区
- **THEN** 模式、全屏、更多、关闭四枚图标 SHALL 同时计算 `opacity` 为 1

#### Scenario: 菜单打开时保持可见

- **WHEN** 用户打开「更多操作」菜单
- **THEN** 该组图标 SHALL 保持可见，不得因指针移入菜单而消失
