## MODIFIED Requirements

### Requirement: 状态栏（含主页入口 / 自动布局入口 / 宽度面板 / 主题面板）

应用外壳 SHALL 在窗口底部常驻一条状态栏。状态栏右侧 SHALL 依次排放 主页 / 自动布局 / 网格概览 / AI / 主题切换 / 沉浸入口 六个图标。状态栏高度 SHALL 紧凑（默认字号下计算高度不超过 26px）。双击状态栏空白处 SHALL 切换显隐；隐藏态 SHALL 在指针滑入窗口底部热区 0.5 秒内显现，指针移出后 SHALL 立即隐藏。

主题入口 SHALL 同时支持两种交互：**指针悬停 SHALL 打开主题选择面板**（亮色 / 暗色 / 暖色 / 跟随系统）；**单击图标 SHALL 循环切换主题**，顺序为 跟随系统 → 亮色 → 暗色 → 暖色 → 跟随系统。主题图标 SHALL NOT 渲染下拉三角、chevron 或任何附加指示图形——入口只由一个图标构成。主题选择面板中的「亮色」图标 SHALL 为 6 条等角光线（相邻夹角 60°）+ 中心圆；「暖色」图标 SHALL 使用更少的光线，两者 SHALL 可辨。

自动布局入口的图标 SHALL 为魔法棒（斜向棒身 + 三处星芒），SHALL NOT 使用四宫格矩形；按钮的可访问名 SHALL 仍为「自动布局」。

状态栏上的页面宽度数字 SHALL 可点击打开宽度调整面板：上行三个可点击的斜面柱代表三档（紧凑 720 / 标准 960 / 宽松 1200），三柱 SHALL 水平居中、并排相接（柱间无间隙）、单柱宽 22px、高度由左至右递增 14 / 18 / 22px；下行一条滑块，滑块最大值为 1400px，滑块宽度 SHALL 大于三柱总宽。面板宽度 SHALL 收至 200px，并 SHALL 按窗口宽度夹取在可视区内。面板 SHALL 支持外部 `pointerdown` 与 `Esc` 关闭。

主页入口 SHALL 回到程序启动时的页面。自动布局入口的按钮 SHALL 紧邻主页图标右侧，其行为见 `navigation` 的「一键自动布局栏目」。

#### Scenario: 状态栏常驻且含六图标

- **WHEN** 应用处于任何非沉浸状态
- **THEN** 窗口底部 SHALL 显示状态栏，其右侧 SHALL 含 主页 / 自动布局 / 网格概览 / AI / 主题 / 沉浸 六个图标

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

### Requirement: G-7 图标语义与全屏可用性

全站图标 SHALL 使用同一 24×24 线性语言，分栏图标 SHALL 用左右/上下矩形面积差表达方向，钉住与全屏 SHALL 用轻量轮廓而非重填充。单格与多格工作区 SHALL 均显示可用的全屏入口：单格点击全屏 SHALL 让该格铺满工作区（隐藏其余 chrome），再次点击或 Esc SHALL 退出。全屏按钮 SHALL 默认隐藏（计算 `opacity` 为 0 且不接收指针事件），指针滑入所属栏目（`:hover` / `:focus-within`）时 SHALL 显示；全屏中的格头全屏按钮 SHALL 恒显示退出形态（`collapse`），`aria-pressed` SHALL 为真，`title`/`aria-label` SHALL 为「退出全屏」；退出后 SHALL 恢复进入形态（`expand`）并回到默认隐藏规则。

#### Scenario: 全屏按钮默认隐藏、悬停显示

- **WHEN** 指针不在某栏目内
- **THEN** 该栏全屏按钮的计算 `opacity` SHALL 为 0 且 `pointer-events` SHALL 为 none
- **AND WHEN** 指针移入该栏目
- **THEN** 全屏按钮的计算 `opacity` SHALL 为 1，可点击

#### Scenario: 全屏态退出入口常显

- **WHEN** 某栏目处于全屏态且指针不在其中
- **THEN** 该栏的退出全屏按钮 SHALL 仍可见（`opacity` 为 1）

#### Scenario: 单格显示全屏

- **WHEN** 工作区只有一个 pane
- **THEN** 该 pane 头部 SHALL 渲染全屏按钮（`data-testid="pane-fullscreen"`），且可点击

#### Scenario: 多格全屏生效
- **WHEN** 工作区有至少两个 pane，用户点击当前 pane 的全屏按钮
- **THEN** 当前 pane SHALL 进入全屏态，再次点击 SHALL 退出

#### Scenario: 全屏中显示退出图标
- **WHEN** 某 pane 处于全屏态
- **THEN** 该 pane 头部按钮的 `data-icon` SHALL 为 `collapse`
- **AND** `aria-pressed` SHALL 为 `true`
- **AND** `title`/`aria-label` SHALL 为「退出全屏」

#### Scenario: 退出后恢复进入图标
- **WHEN** 用户在全屏态再次点击同一按钮
- **THEN** 该按钮 `data-icon` SHALL 恢复为 `expand`
- **AND** `aria-pressed` SHALL 为 `false`

