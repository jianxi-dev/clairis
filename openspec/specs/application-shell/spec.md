# application-shell — 界面外壳与空状态当前规格

## Purpose

application-shell 域定义标月桌面端的整体界面布局决策与空状态体验：无边栏外壳（移除左侧栏、无右侧边栏、单一顶栏）、可选正文分栏，以及空状态的分块叠加、内置示例文件释放与空状态设计规则。本规格是 application-shell 域可验收功能行为的唯一真相源；条目编号（G-1 至 G-5 界面布局、B-2 / B-4 / B-5 空状态）与 `docs/MVP-需求跟踪表.md` 模块 G / B 一一对应。

## 设计来源与参考

- G-1 至 G-5 批准设计：`docs/design/approved/shell-ui/spec.md`（无侧栏外壳与 Chrome Bar 决策）
- B-2 / B-4 / B-5 批准设计：`docs/design/approved/empty-state/spec.md`（空状态分块、示例文件释放与标记机制）；示例文件内容见 `src-tauri/samples/`
- 需求基线：`docs/CORE-REQUIREMENTS-clairis.md` §四 UI 架构 4.1（空状态与导航入口、内置示例文件）、4.5（文档模式分栏规则）；`docs/MVP-需求跟踪表.md` 模块 G / B（均标 ✅）
- 启动面板/欢迎页（B-1）与统一文件面板（B-3）归属 navigation 域
## Requirements
### Requirement: G-1 移除左侧栏逻辑

应用外壳 SHALL 移除左侧栏：Toolbar 中的左栏按钮 SHALL 被移除，用于切换左侧栏的旧 `Cmd+\` 快捷键 SHALL 被移除，布局参数 `leftSidebar` SHALL 传 null。导航职责由统一文件面板（Cmd+P，见 navigation 域 B-3）承担。

#### Scenario: 左侧栏入口不存在

- **WHEN** 用户查看应用外壳界面
- **THEN** Toolbar SHALL 不出现左栏切换按钮，左侧 SHALL 不渲染侧栏区域（leftSidebar = null）

### Requirement: G-2 无右侧边栏

应用外壳 SHALL 不渲染右侧边栏（无边栏哲学：收回原右侧边栏设计）；导航由 `Cmd+P` 统一文件面板承担，不另设右侧导航栏。

#### Scenario: 右侧边栏不存在

- **WHEN** 用户查看应用外壳界面
- **THEN** 右侧 SHALL 不渲染任何边栏/导航占位区域

### Requirement: G-5 正文分栏（可选）

应用 SHALL 支持可选的正文分栏：`Cmd+Option+→` / `Cmd+Option+↓` 触发左右/上下分栏，亦可将页签拖拽到窗格边缘生成分栏；分栏分隔线 SHALL 在 hover 时给出可视暗示；每个窗格 SHALL 拥有独立的 TabBar。

#### Scenario: 快捷键分栏

- **WHEN** 用户按 `Cmd+Option+→`
- **THEN** 正文 SHALL 生成左右分栏，且每个窗格有独立 TabBar

#### Scenario: 拖拽页签分栏

- **WHEN** 用户把页签拖拽到当前窗格边缘
- **THEN** 分隔线 SHALL 在 hover 时显示落位暗示，松开后 SHALL 按暗示方向生成分栏

### Requirement: B-2 空状态继续区分块

存在近期文件记录（RecentFile）后，空状态 SHALL 在欢迎页下方按数据分块叠加两个区域：「上次停在这」（RecentFile[0] + scrollPos + 最近编辑位置 → 最近 heading 与内容片段，提供"继续阅读"；scrollPos=0 时退化为"继续打开"）与「最近保存」（`list_files` 按 mtime 倒序取 5 个 `.md`/`.html` 文件，以横向滚动 chips 呈现）。分块 SHALL 按数据可用性显示（非 if/else 二选一）：首次安装仅显示欢迎页；有 RecentFile 时显示继续区 + 最近保存；仅有文件夹文件时显示欢迎页 + 最近保存；`list_files` 失败时对应 section 静默隐藏、不报错。最近保存 chip SHALL 以三层递减视觉呈现（文件名 → 内容首行 → 时间），chips 末尾的"+N 更多"SHALL 作为按钮跳转 Cmd+P。

#### Scenario: 继续上次与最近保存叠加

- **WHEN** 用户关闭全部文档且存在 RecentFile[0]（scrollPos > 0）
- **THEN** 空状态 SHALL 在欢迎页下方显示「上次停在这」卡片（含最近 heading/片段与"继续阅读"）和「最近保存」chips（5 个，横向滚动）

#### Scenario: 按数据分块降级

- **WHEN** 无 RecentFile 但工作目录存在文件
- **THEN** 空状态 SHALL 仅显示欢迎页 + 最近保存区；当 `list_files` 调用失败时最近保存区 SHALL 静默隐藏而不报错

#### Scenario: scrollPos=0 退化

- **WHEN** RecentFile[0] 的 scrollPos 为 0
- **THEN** 继续区 SHALL 退化为"继续打开"（不带位置恢复语义）

### Requirement: B-4 内置示例文件释放

应用 SHALL 在首次需要时将三个内置示例文件释放到 `~/Documents/Jianxi/`（大写 J 英文目录，失败时 fallback 到 `app_data_dir()/samples`）：`0-welcome.md`（欢迎页：定位 + 格式清单 + 快捷键 + 安全感 + CTA）、`1-markdown-demo.md`（GFM 全套示例）、`2-html-demo.html`（HTML + 内联 CSS 示例）。释放 SHALL 由 `.sample-bundle.json` marker 机制管理（记录每个文件的 sha256），防止重复释放并支持版本升级；示例内容 SHALL 经 Rust `include_str!` 在编译时嵌入，由 `ensure_sample_files()` 命令执行释放。

#### Scenario: 首次释放三个示例文件

- **WHEN** 应用首次运行且目标目录不存在 marker
- **THEN** `0-welcome.md`、`1-markdown-demo.md`、`2-html-demo.html` SHALL 被释放到 `~/Documents/Jianxi/`

#### Scenario: marker 防重复释放

- **WHEN** 已有 `.sample-bundle.json` 且对应文件 sha256 未变
- **THEN** `ensure_sample_files()` SHALL 不重复写入这些文件；marker 版本升级时 SHALL 按 sha256 差异更新

#### Scenario: 目标目录不可写降级

- **WHEN** `~/Documents/Jianxi/` 路径创建失败
- **THEN** 示例文件 SHALL 降级释放到 `app_data_dir()/samples`

### Requirement: B-5 空状态设计规则

空状态体验 SHALL 遵守四条规则：(1) 空白但不空旷——无文档打开时中央渲染 `0-welcome.md`；(2) 一键可达——主 CTA 位于首屏；(3) 历史是灵魂——「最近保存」chips 固定展示最近 5 个文件；(4) 快捷键提示——快捷键说明内嵌于欢迎页而非独立教程。

#### Scenario: 四条规则同时满足

- **WHEN** 新用户首次打开应用
- **THEN** 首屏 SHALL 渲染 `0-welcome.md`（空白但不空旷），主 CTA SHALL 在首屏可达，欢迎页内 SHALL 内嵌快捷键提示；存在历史时最近保存 chips SHALL 展示 5 个

### Requirement: G-6 顶栏职责与页签身份

页签标题 SHALL 在双击后进入行内改名；输入框宽度 SHALL 为原宽度的 1.5 倍（`24ch`），回车提交、Esc 取消，路径 SHALL 不变。

#### Scenario: 改名输入框加长

- **WHEN** 用户双击页签标题
- **THEN** 输入框计算宽度 SHALL 约为 24ch，且不小于原 16ch 的 1.5 倍

### Requirement: G-7 图标语义与全屏可用性

栏目「更多操作」菜单 SHALL 含「刷新」项，点击后 SHALL 从磁盘重新读取当前页签文件并更新内容；未保存修改 SHALL 以磁盘内容覆盖。视频/媒体页签显示时，左侧阅读空间的展开按钮 SHALL 保持可见且可点击，层级 SHALL 高于媒体宿主。

#### Scenario: 刷新当前文件

- **WHEN** 用户修改磁盘上的当前文件后在栏目菜单点「刷新」
- **THEN** 页签内容 SHALL 变为磁盘最新内容

#### Scenario: 视频打开时左栏仍可展开

- **WHEN** 最左侧栏目正在显示视频且阅读空间处于收起态
- **THEN** `rail-edge` 按钮 SHALL 可见，点击后阅读空间 SHALL 展开

### Requirement: G-8 页签拖拽轨迹与落点反馈

页签拖拽 SHALL 在指针移动超过 4px 后进入拖拽态，并同时满足：

- 插入位置 SHALL 显示一条宽 4px、贯穿页签条高度的强调色轨迹条；
- 被拖页签 SHALL 降低不透明度至 0.5 并显示强调色虚线描边；
- 页签条 SHALL 渲染一个跟随指针的半透明 ghost（`position: fixed`，`pointer-events: none`，经由 portal 挂到 `document.body` 以免被 `overflow: hidden` 裁剪），ghost 的可见内容 SHALL 为被拖页签的标题与类型图标；
- 指针位于其他格时，该格 SHALL 显示 2px 强调色内描边落区环；
- 指针进入正文 iframe 区域时拖拽 SHALL 继续，松手 SHALL 按落点提交；
- `Escape` 或 `pointercancel` SHALL 取消拖拽，且 SHALL NOT 改变页签顺序或格结构；
- 拖拽结束时 SHALL 移除 ghost。

#### Scenario: 拖拽轨迹条跟随插入位置

- **WHEN** 用户按住一个页签横向移动超过 4px
- **THEN** 页签条内 SHALL 出现一条 4px 宽的强调色轨迹条，且其位置随指针在页签间的落点移动

#### Scenario: ghost 跟随指针

- **WHEN** 用户拖动一个页签并移动指针
- **THEN** SHALL 存在一个固定在指针处的 ghost 元素，其文本含被拖页签标题；松手后 SHALL 消失

#### Scenario: 跨格拖拽出现落区环

- **WHEN** 用户把页签拖到另一个格的正文上方
- **THEN** 目标格 SHALL 出现 2px 强调色内描边（`data-tab-drop="true"`），源页签 SHALL 保持 0.5 不透明度与虚线描边

#### Scenario: 指针经过 iframe 后松手仍生效

- **WHEN** 用户把页签拖过 HTML/PDF 正文 iframe 后在目标格松手
- **THEN** 页签 SHALL 移动到目标格，页签总数 SHALL 不变

#### Scenario: Escape 取消

- **WHEN** 拖拽过程中按下 Escape
- **THEN** 页签 SHALL 回到原位，格数量与顺序 SHALL 保持不变

### Requirement: G-9 页签与栏目视觉贴合主题

未选中页签 SHALL 使用透明背景、SHALL NOT 绘制胶囊外形，文字 SHALL 使用 `--app-text-2`；仅当鼠标悬停时才 SHALL 出现胶囊底（`--app-sunken` + 圆角）。选中页签 SHALL 保持 `--app-accent-soft` 胶囊底与 `--app-accent` 文字。页签条容器背景 SHALL 为透明；顶栏、栏目头与页签条 SHALL 使用同一底色（`--app-bg`），SHALL NOT 出现左浅右深的色块分界。

#### Scenario: 未选中页签与背景同色

- **WHEN** 一个格内有多个页签且都没有悬停
- **THEN** 未选中页签的计算背景色 SHALL 为透明，且 SHALL NOT 具有胶囊圆角类

#### Scenario: 悬停才出胶囊

- **WHEN** 指针移入一个未选中页签
- **THEN** 该页签 SHALL 获得胶囊圆角与 `--app-sunken` 背景；移出后 SHALL 恢复透明

#### Scenario: 顶栏与栏目头同色

- **WHEN** 工作区同时渲染顶栏与至少一个栏目头
- **THEN** 两者的计算背景色 SHALL 相同，页签条容器 SHALL 为透明

### Requirement: G-11 文件卡片工具条按类型收敛

网格概览与阅读空间的文件卡片：当文件类型为 PDF 时，卡片 SHALL NOT 渲染悬停工具条（打开 / 向右分屏 / 向下分屏）；其他类型 SHALL 保持悬停显示三个动作。点击卡片本体打开文件的交互 SHALL 不受影响。悬浮预览窗不在本要求范围内。

#### Scenario: PDF 卡片无工具条

- **WHEN** 用户把鼠标移入一个 PDF 文件卡片
- **THEN** 卡片内工具条按钮数量 SHALL 为 0

#### Scenario: 非 PDF 卡片工具条不变

- **WHEN** 用户把鼠标移入一个 Markdown 文件卡片
- **THEN** 卡片内工具条按钮数量 SHALL 为 3（打开 / 向右分屏 / 向下分屏）

### Requirement: G-12 分栏语义与分隔线独立性

- 拖动分隔线 SHALL 只改变该分支两侧的尺寸；树中其他分支的 `ratio` SHALL 保持不变。
- 页签右键「向右分栏」/「向下分栏」SHALL 新建一格并把该页签移入新格，新格 SHALL 获得焦点；原格 SHALL 不再保留该页签。
- 栏目「更多」菜单中的「右分」/「下分」SHALL 继续创建空分栏。
- 拖动页签跨格移动后，页签总数 SHALL 不变；文件已打开时拖入某格 SHALL NOT 复制文件，源格变空且非根时 SHALL 塌缩。
- 关闭页签或关闭格 SHALL 在任意栏数下生效；关闭后剩余分隔线 SHALL 仍可拖拽。

#### Scenario: 分隔线独立调整

- **WHEN** 工作区有三个以上格，用户拖动其中一条分隔线
- **THEN** 只有该分隔线两侧的两格尺寸变化，其他并行格尺寸 SHALL 保持不变

#### Scenario: 右键分栏搬运文件

- **WHEN** 用户在一个已打开 `a.md` 的页签上右键选择「向右分栏」
- **THEN** 工作区 SHALL 增加一个格，且 `a.md` SHALL 出现在新格中；原格 SHALL 不再包含 `a.md`

#### Scenario: 更多菜单保持空分栏

- **WHEN** 用户点击栏目头「更多」菜单里的「右分」
- **THEN** 工作区 SHALL 增加一个空分栏，原页签 SHALL 留在原格

#### Scenario: 跨格拖拽不复制栏目

- **WHEN** 用户把一个页签从格 A 拖到格 B
- **THEN** 格数量 SHALL 不变，页签只出现在格 B

#### Scenario: 关闭后布局仍可操作

- **WHEN** 用户关闭一个页签或一个格
- **THEN** 剩余布局 SHALL 正常渲染，分隔线 SHALL 仍可拖动

### Requirement: G-3 无品牌顶栏（内容贴顶）

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

### Requirement: 状态栏（含主页入口 / 自动布局入口 / 宽度面板 / 主题面板）

应用外壳 SHALL 在窗口底部常驻一条状态栏。状态栏右侧 SHALL 依次排放 主页 / 自动布局 / 网格概览 / AI / 主题切换 / 沉浸入口 六个图标。状态栏高度 SHALL 紧凑（默认字号下计算高度不超过 26px）。双击状态栏空白处 SHALL 切换显隐；隐藏态 SHALL 在指针滑入窗口底部热区 0.5 秒内显现，指针移出后 SHALL 立即隐藏。

隐藏态或沉浸态下临时显现的状态栏 SHALL 以悬浮层（`position: fixed`）覆盖在内容之上，SHALL NOT 参与流式布局、SHALL NOT 改变正文容器高度；滑入与滑出 SHALL NOT 引起正文位移。

主题入口 SHALL 同时支持两种交互：**指针悬停 SHALL 打开主题选择面板**（亮色 / 暗色 / 暖色 / 跟随系统）；**单击图标 SHALL 循环切换主题**，顺序为 跟随系统 → 亮色 → 暗色 → 暖色 → 跟随系统。主题图标 SHALL NOT 渲染下拉三角、chevron 或任何附加指示图形——入口只由一个图标构成。主题选择面板中的「亮色」图标 SHALL 为 6 条等角光线（相邻夹角 60°）+ 中心圆；「暖色」图标 SHALL 使用更少的光线，两者 SHALL 可辨。

自动布局入口的图标 SHALL 为魔法棒（斜向棒身 + 三处星芒），SHALL NOT 使用四宫格矩形；按钮的可访问名 SHALL 仍为「自动布局」。

状态栏上的页面宽度数字 SHALL 可点击打开宽度调整面板：上行三个可点击的斜面柱代表三档（紧凑 720 / 标准 960 / 宽松 1200），三柱 SHALL 水平居中、并排相接（柱间无间隙）、单柱宽 22px、高度由左至右递增 14 / 18 / 22px。每个刻度柱 SHALL 在指针悬停或键盘聚焦时显示 1px 虚线边框，移出或失焦时隐藏；边框 SHALL NOT 被斜面裁剪。下行一条滑块，滑块最大值为 1400px，滑块宽度 SHALL 大于三柱总宽。面板宽度 SHALL 为 200px，并 SHALL 按窗口宽度夹取在可视区内。面板 SHALL 支持外部 `pointerdown` 与 `Esc` 关闭。

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

## 待裁定与跨域冲突记录（非规范性）

以下为来源层面的已登记冲突，仅如实记录，不在本规格内裁定（裁定由后续 change/治理任务处理）：

- **Cmd+\ 键位冲突**：G-1 要求移除旧的"切换左侧栏"快捷键 `Cmd+\`；reading 域 A-5 将 `Cmd+\` 指定为沉浸阅读开关（来源：`docs/design/approved/immersive-reading/spec.md` v2）。两文件对同一键位的处置需在实现层统一（移除旧语义后即可由 A-5 占用），此处保留两边原意。
- **G-4 缺失**：`docs/MVP-需求跟踪表.md` 模块 G 仅登记 G-1 / G-2 / G-3 / G-5，无 G-4 行；G-4 的状态待跟踪表补齐后裁定。
