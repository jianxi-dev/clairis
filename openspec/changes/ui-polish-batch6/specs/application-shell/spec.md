## MODIFIED Requirements

### Requirement: G-3 单一顶栏（Chrome Bar）

应用外壳 SHALL NOT 渲染品牌顶栏：窗口内容区上方 SHALL NOT 出现一条只承载产品名「标月」的横条。产品级入口（网格概览 / AI / 主题 / 沉浸）SHALL 全部位于底部状态栏右侧，顺序保持 网格概览 / AI / 主题 / 沉浸。首个分栏的页签条 SHALL 直接贴内容区顶缘，其上 SHALL NOT 存在空白带或占位横条。

#### Scenario: 顶部无品牌横条

- **WHEN** 应用处于任何非沉浸状态
- **THEN** 窗口顶部 SHALL NOT 出现只含「标月」品牌文字的横条，首个分栏的页签条 SHALL 直接贴内容区顶缘

#### Scenario: 沉浸入口只留图标

- **WHEN** 审查状态栏右侧的沉浸入口
- **THEN** 该按钮 SHALL 只渲染图标，SHALL NOT 含「沉浸」文字；其可访问名（`aria-label` / `title`）SHALL 仍说明「沉浸阅读」

#### Scenario: 顶栏不再含主题区图标

- **WHEN** 审查顶栏 DOM
- **THEN** 顶栏 SHALL NOT 含 `data-testid="grid-entry"` / `data-ai-entry` / 主题切换 / `data-testid="immersive-entry"` 四个入口

### Requirement: 状态栏

应用外壳 SHALL 在窗口底部常驻一条状态栏。状态栏右侧 SHALL 依次排放 主页 / 网格概览 / AI / 主题切换 / 沉浸入口 五个图标，点击行为与图标语义 SHALL 不变。状态栏 SHALL NOT 因沉浸模式而隐藏其图标（沉浸收纳仅作用于页签条）。状态栏高度 SHALL 紧凑（默认字号下计算高度不超过 26px）。双击状态栏空白处 SHALL 切换显隐；隐藏态 SHALL 在指针滑入窗口底部热区 0.5 秒内显现，指针移出后 SHALL 立即隐藏。状态栏上的页面宽度数字 SHALL 可点击打开宽度调整面板：上行三个可点击的斜面柱状代表三档（高度递增），下行一条滑块，滑块长度 SHALL 大于上行按钮组总宽，且三档位置 SHALL 与滑块三挡对齐；正文宽度最大值为 1400px。面板 SHALL 以指针 x 为中位出现，并 SHALL 按窗口宽度夹取在可视区内。主题按钮 SHALL NOT 渲染下拉三角指示，指针悬停 SHALL 弹出主题选择面板（亮色 / 暗色 / 暖色 / 跟随系统），后续新增主题 SHALL 只需向该面板追加一项。主页入口 SHALL 回到程序启动时的页面。

#### Scenario: 状态栏常驻且含五图标

- **WHEN** 应用处于任何非沉浸状态
- **THEN** 窗口底部 SHALL 显示状态栏，其右侧 SHALL 含 主页 / 网格概览 / AI / 主题 / 沉浸 五个图标

#### Scenario: 沉浸入口仍在状态栏可用

- **WHEN** 用户点击状态栏右侧的沉浸图标
- **THEN** 应用 SHALL 进入沉浸模式（等价于原顶栏沉浸入口）

#### Scenario: 双击隐藏与悬停显现

- **WHEN** 用户双击状态栏空白处后再把指针滑到窗口底部并停留 0.5 秒
- **THEN** 双击后状态栏 SHALL 隐藏；指针停留 0.5 秒内状态栏 SHALL 重新显现，指针移出后 SHALL 再次隐藏

#### Scenario: 状态栏高度紧凑

- **WHEN** 测量默认字号下的状态栏
- **THEN** 其计算高度 SHALL 不超过 26px

#### Scenario: 页面宽度面板

- **WHEN** 用户点击状态栏上的页面宽度数字
- **THEN** SHALL 出现两行宽度面板：上行三个斜面柱状、下行一条滑块；滑块长度 SHALL 大于按钮组总宽；选择任一档后正文宽度与状态栏宽度数字 SHALL 同步更新

#### Scenario: 面板跟随指针

- **WHEN** 用户在状态栏不同横向位置点击宽度数字
- **THEN** 面板水平中位 SHALL 跟随指针，且完整落在窗口可视区内

#### Scenario: 宽度上限 1400

- **WHEN** 用户把宽度滑块拖到最右
- **THEN** 正文宽度 SHALL 为 1400px，不出现更大值

#### Scenario: 主题弹窗选择

- **WHEN** 用户把指针移到主题按钮上
- **THEN** SHALL 弹出含 亮色 / 暗色 / 暖色 / 跟随系统 四项的主题面板；点击「暗色」后根节点 SHALL 切换为深色且面板关闭

#### Scenario: 主页回到启动页

- **WHEN** 用户点击状态栏的主页图标
- **THEN** 应用 SHALL 回到程序启动时显示的页面

## 待裁定与跨域冲突记录（非规范性）

