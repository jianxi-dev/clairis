## MODIFIED Requirements

### Requirement: G-6 顶栏职责与页签身份

页签标题 SHALL 在双击后进入行内改名；输入框宽度 SHALL 为原宽度的 1.5 倍（`24ch`），回车提交、Esc 取消，路径 SHALL 不变。

**页签标题显示与间距**：单个页签标题 SHALL 有固定最大显示宽度 **120px**（容差 ±2px）——短于该宽度时 SHALL 按实际文本长度显示，超过时 SHALL 以 `text-overflow: ellipsis` 收尾、单行 `white-space: nowrap`，SHALL NOT 换行，SHALL NOT 使用 `-webkit-line-clamp`。完整文件名 SHALL 在页签名信息窗内换行可读（见 navigation 域「页签条与格头」）。页签总宽超过页签条可用宽度时，页签条 SHALL 横向滚动，SHALL NOT 压缩页签到不可读或溢出容器。相邻页签之间的间距 SHALL 为 **32px**（容差 ±2px）；单个页签内标题右缘到关闭按钮左缘的水平间距 SHALL 不超过 **6px**。

#### Scenario: 改名输入框加长

- **WHEN** 用户双击页签标题
- **THEN** 输入框计算宽度 SHALL 约为 24ch，且不小于原 16ch 的 1.5 倍

#### Scenario: 页签标题单行完整显示

> 场景标题沿用旧名以保持条款可追溯；自本 change 起「完整」由信息窗承载，页签本身在 120px 上限内以省略号收尾。

- **WHEN** 某页签标题的自然宽度超过 120px
- **THEN** 该页签标题容器的计算 `max-width` SHALL 为 120px（容差 ±2px），`text-overflow` SHALL 为 `ellipsis`，`white-space` SHALL 为 `nowrap`，`-webkit-line-clamp` SHALL 为 `none`，且标题 SHALL NOT 换行

#### Scenario: 短标题按实际长度显示

- **WHEN** 某页签标题的自然宽度小于 120px
- **THEN** 该页签标题容器的渲染宽度 SHALL 等于文本实际宽度，SHALL NOT 被拉伸到 120px

#### Scenario: 页签条横向滚动

- **WHEN** 页签总宽超过页签条可用宽度
- **THEN** 页签条 SHALL 可横向滚动，SHALL NOT 压缩到不可读或溢出容器

#### Scenario: 页签间距 32px

> 场景标题沿用旧名以保持条款可追溯；相邻页签间距保持 32px 不变，本 change 压缩的是单个页签内标题与关闭按钮之间的间距。

- **WHEN** 测量相邻两个页签的间距
- **THEN** 其间距 SHALL 为 32px（容差 ±2px）

### Requirement: 状态栏（含主页入口 / 自动布局入口 / 宽度面板 / 主题面板）

应用外壳 SHALL 在窗口底部保留一条状态栏。状态栏右侧 SHALL 依次排放 主页 / 自动布局 / 网格概览 / AI / 主题切换 / 禅模式入口 六个图标。状态栏高度 SHALL 紧凑（默认字号下计算高度不超过 26px）。**状态栏默认 SHALL 处于隐藏态**；用户显式钉住后 SHALL 常显，显式取消钉住后 SHALL 恢复默认隐藏。隐藏态 SHALL 在指针进入窗口底部 8px 热区时临时显现，指针移出后 SHALL 立即隐藏。

隐藏态或沉浸态下临时显现的状态栏 SHALL 以悬浮层（`position: fixed`）覆盖在内容之上，SHALL NOT 参与流式布局、SHALL NOT 改变正文容器高度；滑入与滑出 SHALL NOT 引起正文位移。

主题入口 SHALL 同时支持两种交互：**指针悬停 SHALL 打开主题选择面板**（亮色 / 暗色 / 暖色 / 跟随系统）；**单击图标 SHALL 循环切换主题**，顺序为 跟随系统 → 亮色 → 暗色 → 暖色 → 跟随系统。主题图标 SHALL NOT 渲染下拉三角、chevron 或任何附加指示图形——入口只由一个图标构成。主题选择面板中的「亮色」图标 SHALL 为 6 条等角光线（相邻夹角 60°）+ 中心圆；「暖色」图标 SHALL 使用更少的光线，两者 SHALL 可辨。

自动布局入口的图标 SHALL 为魔法棒（斜向棒身 + 三处星芒），SHALL NOT 使用四宫格矩形；按钮的可访问名 SHALL 仍为「自动布局」。

状态栏上的页面宽度数字 SHALL 可点击打开宽度调整面板：上行三个可点击的斜面柱代表三档（紧凑 720 / 标准 960 / 宽松 1200），三柱 SHALL 水平居中、并排相接（柱间无间隙）、单柱宽 22px、高度由左至右递增 14 / 18 / 22px。每个刻度柱 SHALL 在指针悬停或键盘聚焦时显示 1px 虚线边框，移出或失焦时隐藏；边框 SHALL NOT 被斜面裁剪。下行一条滑块，滑块最大值为 1400px，滑块宽度 SHALL 大于三柱总宽。面板宽度 SHALL 为 200px，并 SHALL 按窗口宽度夹取在可视区内。面板 SHALL 支持外部 `pointerdown` 与 `Esc` 关闭。

主页入口 SHALL 回到程序启动时的页面。自动布局入口的按钮 SHALL 紧邻主页图标右侧，其行为见 `navigation` 的「一键自动布局栏目」。

**禅模式入口**：状态栏最右侧的沉浸入口 SHALL 以「禅模式」为显示名：按钮 `title` SHALL 为「禅模式（⌘⇧F）」，`aria-label` SHALL 为「禅模式」，图标 label SHALL 为「禅模式」；`aria-keyshortcuts` 与快捷键 ⌘⇧F SHALL 保持不变。

#### Scenario: 状态栏常驻且含六图标

> 场景标题沿用旧名以保持条款可追溯；自本 change 起「常驻」的默认形态为隐藏态，六图标仅在钉住或底边热区唤出时可见。

- **WHEN** 应用处于任何非沉浸状态且用户未钉住状态栏、指针未进入底边热区
- **THEN** 窗口底部 SHALL NOT 显示状态栏

- **AND WHEN** 用户进入底边热区或显式钉住状态栏
- **THEN** 窗口底部 SHALL 显示状态栏，其右侧 SHALL 含 主页 / 自动布局 / 网格概览 / AI / 主题 / 禅模式 六个图标

#### Scenario: 主题入口不含下拉三角

- **WHEN** 用户查看状态栏主题入口
- **THEN** 入口按钮内 SHALL 只有 1 个图标节点，SHALL NOT 出现三角或 chevron 图形

#### Scenario: 亮色图标六条等距光线

- **WHEN** 用户查看主题选择面板中的「亮色」图标
- **THEN** 该图标 SHALL 有 6 条从圆心向外的光线，相邻光线夹角 SHALL 为 60°（±2°）

#### Scenario: 自动布局图标为魔法棒

- **WHEN** 用户查看状态栏自动布局入口
- **THEN** 图标 SHALL 为斜向棒身加星芒，SHALL NOT 出现四宫格矩形

#### Scenario: 宽度面板三柱居中相接

- **WHEN** 用户点击状态栏宽度数字打开面板
- **THEN** 三根刻度柱的中心 SHALL 与面板水平中线重合（偏差 ≤1px），柱间 `gap` SHALL 为 0，滑块宽度 SHALL 大于三柱总宽

#### Scenario: 宽度刻度柱 hover 虚线

- **WHEN** 用户把指针移到某一根宽度刻度柱上
- **THEN** 该柱 SHALL 显示 1px 虚线边框，另外两根 SHALL 保持透明边框；移出后该柱边框 SHALL 恢复透明

#### Scenario: 隐藏态状态栏不挤压正文

- **WHEN** 状态栏处于隐藏/沉浸态，用户把指针移入底部热区使状态栏浮现
- **THEN** 状态栏计算 `position` SHALL 为 `fixed`，正文容器高度 SHALL 与浮现前完全一致

#### Scenario: 指针横越间隙时主题面板不消失

- **WHEN** 用户把指针移到主题按钮上待面板出现，再用 500ms 从按钮缓慢移动到面板内某一项上
- **THEN** 面板 SHALL 全程可见，指针停在该项上 500ms 后 SHALL 仍可见，点击该项 SHALL 设置对应主题并关闭面板

#### Scenario: 单击图标循环切换主题

- **WHEN** 用户连续单击状态栏主题图标四次（初始为跟随系统）
- **THEN** 主题 SHALL 依次变为 亮色 → 暗色 → 暖色 → 跟随系统

#### Scenario: 面板打开时单击图标

- **WHEN** 主题面板已打开，用户单击主题图标
- **THEN** 主题 SHALL 循环到下一项，面板 SHALL 保持打开且高亮新的当前项

#### Scenario: 外部点击与 Esc 关闭

- **WHEN** 主题面板打开时用户点击面板外部，或在面板打开时按 `Esc`
- **THEN** 面板 SHALL 关闭

#### Scenario: 隐藏态下主题面板可用

- **WHEN** 用户双击隐藏状态栏后把指针移到底部热区使其临时显现，再移向主题面板
- **THEN** 主题面板 SHALL 不因状态栏卸载而消失，指针进入面板后 SHALL 可正常选择

#### Scenario: 宽度面板可关闭

- **WHEN** 宽度调整面板打开时用户点击面板外部或按 `Esc`
- **THEN** 面板 SHALL 关闭

#### Scenario: 主题入口可访问性

- **WHEN** 审查主题触发器的可访问性属性
- **THEN** 触发器 SHALL 含 `aria-haspopup` 与 `aria-expanded`，面板 SHALL 为 `role="menu"`，项 SHALL 为 `role="menuitemradio"` 且带 `aria-checked`

#### Scenario: 主页回到启动页

- **WHEN** 用户点击状态栏的主页图标
- **THEN** 应用 SHALL 回到程序启动时显示的页面

#### Scenario: 底边热区滑入滑出

- **WHEN** 状态栏处于默认隐藏态，用户把指针移入窗口底部 8px 热区
- **THEN** 状态栏 SHALL 临时显现；指针移出热区后 SHALL 隐藏

- **AND WHEN** 用户显式钉住状态栏
- **THEN** 状态栏 SHALL 常显且不受热区逻辑影响

#### Scenario: 禅模式入口文案

- **WHEN** 用户查看状态栏禅模式入口
- **THEN** 按钮 `title` SHALL 为「禅模式（⌘⇧F）」，`aria-label` SHALL 为「禅模式」，图标 label SHALL 为「禅模式」，`aria-keyshortcuts` SHALL 含 ⌘⇧F

- **AND WHEN** 用户按下 ⌘⇧F
- **THEN** 应用 SHALL 切换禅模式，快捷键行为 SHALL 与改动前一致
