## MODIFIED Requirements

### Requirement: 状态栏（含主页入口 / 自动布局入口 / 宽度面板 / 主题面板）

应用外壳 SHALL 在窗口底部常驻一条状态栏。状态栏右侧 SHALL 依次排放 主页 / 自动布局 / 网格概览 / AI / 主题切换 / 沉浸入口 六个图标。状态栏高度 SHALL 紧凑（默认字号下计算高度不超过 26px）。双击状态栏空白处 SHALL 切换显隐；隐藏态 SHALL 在指针滑入窗口底部热区 0.5 秒内显现，指针移出后 SHALL 立即隐藏。

主题入口 SHALL 同时支持两种交互：**指针悬停 SHALL 打开主题选择面板**（亮色 / 暗色 / 暖色 / 跟随系统，后续新增主题只需追加一项）；**单击图标 SHALL 循环切换主题**，顺序为 跟随系统 → 亮色 → 暗色 → 暖色 → 跟随系统。面板项点击 SHALL 直接设为该项并关闭面板。面板打开期间单击图标 SHALL 同样循环，面板 SHALL 保持打开并高亮新的当前项。

主题面板 SHALL 在指针从按钮移向面板的过程中保持打开：指针进入面板或其桥接区 SHALL 取消已排期的关闭；按钮与面板之间的视觉间隙 SHALL 由透明桥接覆盖，SHALL NOT 构成关闭窗口。面板 SHALL 在以下情形关闭：选中一项、外部 `pointerdown`、`Esc`、页面滚动、组件卸载。状态栏处于「双击隐藏后的临时显现」态时，指针移向主题面板 SHALL NOT 因状态栏卸载而丢失面板。

主题触发器 SHALL 带 `aria-haspopup` 与 `aria-expanded`；面板 SHALL 为 `role="menu"`，每项 SHALL 为 `role="menuitemradio"` 并以 `aria-checked` 表达当前主题。

状态栏上的页面宽度数字 SHALL 可点击打开宽度调整面板：上行三个可点击的斜面柱状代表三档（高度递增），下行一条滑块，滑块长度 SHALL 大于上行按钮组总宽，且三档位置 SHALL 与滑块三挡对齐；正文宽度最大值为 1400px。面板 SHALL 以指针 x 为中位出现，并 SHALL 按窗口宽度夹取在可视区内。宽度面板 SHALL 同样支持外部 `pointerdown` 与 `Esc` 关闭。

主页入口 SHALL 回到程序启动时的页面。自动布局入口的按钮 SHALL 紧邻主页图标右侧，其行为见 `navigation` 的「一键自动布局栏目」。

#### Scenario: 状态栏常驻且含六图标

- **WHEN** 应用处于任何非沉浸状态
- **THEN** 窗口底部 SHALL 显示状态栏，其右侧 SHALL 含 主页 / 自动布局 / 网格概览 / AI / 主题 / 沉浸 六个图标

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

### Requirement: G-10 沉浸模式的 chrome 收纳与按栏页签条

进入沉浸模式后，每格页签条 SHALL 在 300ms 内收拢至高度 0（SHALL NOT 以透明状态继续占位），正文 SHALL 随之上移。状态栏 SHALL 自动隐藏（不占位）；指针进入窗口底部热区并停留 500ms 后，状态栏 SHALL 临时显现，指针移出后 SHALL 再次隐藏。左侧阅读空间 SHALL 自动隐藏；若阅读空间处于钉住态，SHALL 保持可见。上述可见性 SHALL 由沉浸状态派生，SHALL NOT 写回用户的双击隐藏偏好或阅读空间状态；退出沉浸后 SHALL 自动恢复进入前的可见性。

沉浸态页签条 SHALL 按栏独立：指针进入某栏内容区顶缘 16px 热区后，应用 SHALL 展开**该栏自己的**页签条，其宽度与横向位置 SHALL 贴合该栏；指针离开该栏页签条 400ms 后 SHALL 收起。同时 SHALL 至多一栏处于展开态——指针进入新栏时旧栏 SHALL 立即收起。拖拽页签期间 SHALL 抑制收起，保证拖拽不中断。应用 SHALL NOT 再使用一条横跨窗口的全局悬浮页签条。

#### Scenario: 顶栏收纳为 0 高

- **WHEN** 用户进入沉浸模式并等待 300ms
- **THEN** 各格页签条的计算高度 SHALL 为 0，正文区域顶部 SHALL 上移到窗口顶部

#### Scenario: 状态栏自动隐藏并可临时唤出

- **WHEN** 用户进入沉浸模式，随后把指针移到窗口底部停留 500ms
- **THEN** 状态栏进入时 SHALL 不可见；指针停留 500ms 后 SHALL 临时显现，移出后 SHALL 再次隐藏

#### Scenario: 阅读空间未钉住时自动隐藏

- **WHEN** 阅读空间处于折叠或悬停态时用户进入沉浸模式
- **THEN** 阅读空间 SHALL 不可见（不占位）

#### Scenario: 阅读空间钉住时保持可见

- **WHEN** 阅读空间处于钉住态时用户进入沉浸模式
- **THEN** 阅读空间 SHALL 保持可见且宽度不变

#### Scenario: 每栏独立显示页签条

- **WHEN** 沉浸模式下有左右两栏，用户把指针移入左栏顶部热区再移入右栏顶部热区
- **THEN** 指针在左栏时 SHALL 只显示左栏的页签条且贴合左栏宽度；移入右栏后左栏页签条 SHALL 收起、只显示右栏的页签条

#### Scenario: 空格有兜底文案

- **WHEN** 展开的页签条对应的栏没有任何页签
- **THEN** 该栏页签条 SHALL 显示可读兜底文案（如「空分栏」）

#### Scenario: 页签条可切换页签

- **WHEN** 用户在沉浸态展开的某栏页签条上点击另一个页签
- **THEN** 该栏 SHALL 切换到该页签，且沉浸状态 SHALL 保持

#### Scenario: 离开后收起

- **WHEN** 指针离开某栏页签条超过 400ms
- **THEN** 该栏页签条 SHALL 收起；拖拽页签期间 SHALL NOT 收起

#### Scenario: 退出沉浸恢复原状

- **WHEN** 用户在状态栏原本可见、阅读空间原本钉住的状态下进入沉浸，再按 `Esc` 退出
- **THEN** 状态栏 SHALL 恢复可见，阅读空间 SHALL 仍为钉住态
