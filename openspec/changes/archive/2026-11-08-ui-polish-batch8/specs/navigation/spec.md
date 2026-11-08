## MODIFIED Requirements

### Requirement: 工作区 pane 递归树

工作区 SHALL 以 pane 递归树组织分栏：`node = { id, dir: 'row'|'col', ratio, children }`、`leaf = { id, tabs, activeTabId }`。用户 SHALL 可对聚焦 leaf 右分（⌘⌥→）与下分（⌘⌥↓），新 leaf SHALL 获得焦点；关闭最后一页签 SHALL 删除该 leaf 且兄弟扩展，根 leaf SHALL 不显示关闭按钮。栏目 SHALL NOT 设最小宽高——分隔条 SHALL 可把任一栏拖到 0，比例 SHALL 仅钳制在 `[0,1]`；拖到 0 后双击分隔条 SHALL 复位为 0.5。分隔条 SHALL 双向拖拽；⌘⇧↵ 或格头按钮 SHALL 全屏当前格（隐藏其他格与分隔条，再按或 Esc 恢复）；布局树（结构/比例/页签/活动页签/焦点）SHALL 持久化并重启恢复。

#### Scenario: 栏目可拖到 0

- **WHEN** 用户把某两栏之间的分隔条拖到容器边缘
- **THEN** 该侧栏目的计算宽或高 SHALL 允许为 0，应用 SHALL NOT 因 240px 下限回弹

#### Scenario: 分裂与最小尺寸

- **WHEN** 用户对聚焦格按 ⌘⌥→ 后拖动分隔条至小于 240px
- **THEN** 新格出现并获得焦点，分隔条拖动 SHALL 被 240px 下限钳制

#### Scenario: 布局持久化

- **WHEN** 用户分裂出多格、调整比例后重启应用
- **THEN** 布局树 SHALL 按重启前结构、比例、页签与活动页签恢复

### Requirement: 页签条与格头

每格 SHALL 支持多页签：⌘T 新页签（当前格）、⌘W 关页签（最后一签关格）、拖拽排序；页签 SHALL 为类型色图标 + 标题 + ×。双击页签标题 SHALL 进入就地重命名（回车提交、Esc 取消、失焦提交），仅改变显示标题，SHALL NOT 改变文件路径。格头 SHALL 为页签条，右侧 SHALL 为模式图标（点击=预览↔编辑）、全屏图标、⋯ 菜单；⋯ 菜单 SHALL 恰含 7 项（导出/分享/右分/下分/源码模式/定位/复制路径，均带图标，不含全屏）。

拖拽页签期间 SHALL NOT 选中经过的正文文字：拖拽一旦超过阈值，应用 SHALL 进入全局禁选会话，拖拽结束或取消后恢复；拖拽前的既有选区 SHALL NOT 被清空，但拖拽期间 `window.getSelection().toString()` SHALL 保持为空。

页签选中态 SHALL NOT 使用描边、下划线或外框线；选中页签标题 SHALL 使用 `--app-text-strong`（亮色近黑 / 暗色近白），未选中页签文字 SHALL 使用次级色。页签图标 SHALL 分级着色：只有**聚焦栏目的活动页签**图标保留文件类型色；未选中页签与其他栏目的活动页签图标 SHALL 使用 chrome 静息灰。其他栏目的活动页签标题 SHALL 仍使用选中色，以表示该文件处于打开状态。页签容器 SHALL NOT 自绘底边框。栏目处于聚焦态时 SHALL NOT 绘制强调色内描边——聚焦语义由页签与内容表达，拖拽落区环除外。

页签右键菜单 SHALL 恰含 5 项，顺序为：悬浮小窗、向右分栏、向下分栏、关闭、关闭其他；每项 SHALL 带图标。点击「悬浮小窗」SHALL 以被右击页签为锚唤出与文件卡片同款的悬浮预览窗，SHALL NOT 新建第二套悬浮窗实现。

#### Scenario: 拖拽页签不选中正文

- **WHEN** 用户按住页签拖到另一栏，指针经过正文段落
- **THEN** `window.getSelection().toString()` 的长度 SHALL 为 0

#### Scenario: 选中页签标题为强文字色

- **WHEN** 某页签处于选中态
- **THEN** 该页签的计算 `outline-width` SHALL 为 0px，标题颜色 SHALL 等于 `--app-text-strong`，且 SHALL NOT 绘制下划线或外框线

#### Scenario: 页签图标分级

- **WHEN** 工作区分两栏，分别有活动页签
- **THEN** 聚焦栏活动页签图标 SHALL 为文件类型色（Markdown 为 `#6366f1`），非聚焦栏活动页签图标 SHALL 等于 `--app-chrome-rest`，两者标题 SHALL 均为选中色

#### Scenario: 栏目聚焦不画蓝框

- **WHEN** 某栏目获得焦点且未处于页签拖拽落区
- **THEN** 该栏目 `box-shadow` 中 SHALL NOT 含 1.5px 强调色内描边

#### Scenario: 右键菜单含悬浮小窗

- **WHEN** 用户在页签上唤出右键菜单
- **THEN** 菜单 SHALL 渲染 5 项，首项文案为「悬浮小窗」并带图标
- **AND WHEN** 用户点击「悬浮小窗」
- **THEN** SHALL 出现 `floating-preview`，其 `data-preview-path` SHALL 等于该页签的文件路径

#### Scenario: 页签生命周期

- **WHEN** 用户在一格内按 ⌘T 两次再按 ⌘W 至最后一签关闭
- **THEN** 该格经历 1→2→3→2→1→0 个页签，最后一签关闭时格被删除且兄弟扩展

#### Scenario: ⋯ 菜单项

- **WHEN** 用户点开格头 ⋯ 菜单
- **THEN** 菜单 SHALL 渲染恰好 7 项且每项带图标，不出现全屏项

#### Scenario: 双击改名

- **WHEN** 用户双击某页签的标题文字并输入新名称后回车
- **THEN** 该页签标题 SHALL 更新为新名称，文件路径 SHALL 不变

#### Scenario: Esc 取消改名

- **WHEN** 用户双击进入改名后按 Esc
- **THEN** 页签标题 SHALL 保持原值

#### Scenario: 选中页签无描边

- **WHEN** 某页签处于选中态
- **THEN** 该页签的计算 `outline-width` SHALL 为 0px，且 SHALL NOT 绘制下划线或外框线；其文字颜色 SHALL 与未选中页签不同（未选中为次级色）

#### Scenario: 页签区无重复底边

- **WHEN** 审查页签容器与所在栏目的底边
- **THEN** 页签容器的 `border-bottom-width` SHALL 为 0px，底边 SHALL 只由栏目容器绘制一次

#### Scenario: 右键菜单每项带图标

- **WHEN** 用户在页签上唤出右键菜单
- **THEN** 菜单中每个可点击项 SHALL 各含一个图标节点

### Requirement: 阅读空间密度与卡片规格

密度 SHALL 三档：紧凑 32px（类型图标+标题 1 行+时间）、舒适 56px（+第二行父路径·时间+收藏标）、卡片 112px（默认；cardHeight 可调 88–160）。卡片 SHALL 含：左侧彩色类型图标 18px+粗体标题（1–2 行）、真内容摘要 2 行（无缩略图时通栏）、右侧 4:3 缩略图 64×48、类型 chip、meta（任务进度或阅读进度+日期+可点路径文字，路径点击 SHALL 在 Finder 中显示，无 folder 图标）。卡片布局 SHALL 为：动作按钮组位于卡片**左下角**，按钮顺序 SHALL 依次为 打开、右分栏、下分栏、收藏、路径；卡片**右上角** SHALL 显示阅读进度（仅百分比数字，指针滑入显示「已读」字样）与时间。hover 动作 SHALL 为纯图标，动作图标渲染尺寸 SHALL 为 14px。收藏动作 SHALL 使用爱心图形（收藏态实心、未收藏态空心）。路径按钮 SHALL 与同行其它按钮使用相同的悬停反馈：悬停只改变文字颜色（至 chrome 悬停色）并显示完整路径，SHALL NOT 绘制悬停底色或背景块。底部动作行 SHALL 贴近卡片底边；卡片处于最小高度时，缩略图、阅读进度与底部动作行 SHALL NOT 相互重叠。

#### Scenario: 路径悬停无底色

- **WHEN** 指针悬停在阅读空间卡片底部的路径按钮上
- **THEN** 按钮的计算 `background-color` alpha 通道 SHALL 为 0，文字颜色 SHALL 变为 chrome 悬停色，`title` SHALL 为完整路径

#### Scenario: 卡片密度默认

- **WHEN** 用户首次打开阅读空间
- **THEN** 密度 SHALL 为卡片（112px）、布局 SHALL 为堆叠

#### Scenario: 缩略图比例

- **WHEN** 有首图的 MD 文件渲染为卡片
- **THEN** 缩略图 SHALL 为 64×48（4:3），位于卡片右侧

#### Scenario: 动作在左下且顺序固定

- **WHEN** 用户悬停一张非 PDF 卡片
- **THEN** 动作按钮组 SHALL 位于卡片左下角，按 打开 / 右分栏 / 下分栏 / 收藏 / 路径 顺序排列

#### Scenario: 进度与时间在右上

- **WHEN** 卡片有阅读记录与修改时间
- **THEN** 右上角 SHALL 显示仅百分比数字的阅读进度与时间；指针滑入进度 SHALL 显示「已读」字样

#### Scenario: 收藏用爱心图标

- **WHEN** 查看卡片底部动作行的收藏项
- **THEN** 该图标 SHALL 为爱心形状，收藏态为实心、未收藏态为空心

#### Scenario: 路径可交互并显示完整路径

- **WHEN** 用户把指针移到卡片底部动作行的路径项上
- **THEN** 该项 SHALL 出现与同行其它按钮相同的悬停底色变化，且 `title` SHALL 为完整路径

#### Scenario: 最小高度不重叠

- **WHEN** 卡片处于最小高度
- **THEN** 缩略图、阅读进度与底部动作行的矩形 SHALL 两两不相交

### Requirement: 悬浮预览窗（缩略图宽度模型）

应用 SHALL 提供悬浮预览窗渲染真文档内容且内部滚动；最小 260×200，SHALL 支持四边+四角拖拽缩放与贴边翻转。锚定 SHALL 为：阅读空间 x 恒定=栏右缘+12、y 跟随悬停行；网格贴卡片右缘+12、y 贴卡顶。阅读空间悬停唤出的预览窗宽度 SHALL 为「上一版基准宽 + 一个缩略图宽度」。

底部动作区 SHALL 仅在指针位于动作行（或窗口底缘触发带）时显示：进入即显示，移出 150ms 内隐藏。动作按钮 SHALL 采用与阅读空间卡片相同的悬停反馈——静息 chrome 灰、悬停 chrome 亮色、无悬停底色、图标 14px。动作行 SHALL 依次含 打开 / 分栏→ / 分栏↓ / 路径 四个按钮，其中路径按钮 SHALL 显示 `folder` 图标与父目录名、`title` 为完整路径、点击 SHALL 在 Finder 中显示；动作行 SHALL 在起点增加一个按钮位（24px 左内距），使第一个按钮后移。开关 SHALL 双轨独立：阅读空间悬停（默认开，250ms 延时）、网格（悬停/点击（默认）/关闭）；⌘⇧V SHALL 切换悬浮预览开关。

#### Scenario: 动作行随指针进入与离开切换

- **WHEN** 用户把指针移入悬浮预览窗底部动作区
- **THEN** 动作行 SHALL 显示，且含 1 个路径按钮
- **AND WHEN** 指针移出动作区 150ms
- **THEN** 动作行节点数 SHALL 为 0

#### Scenario: 动作按钮与卡片同款

- **WHEN** 指针悬停在一个动作按钮上
- **THEN** 该按钮计算 `background-color` 的 alpha 通道 SHALL 为 0，文字颜色 SHALL 变为 chrome 悬停色

#### Scenario: 动作行整体右移一个按钮位

- **WHEN** 测量动作行的左内距
- **THEN** SHALL 为 24px

#### Scenario: 阅读空间锚定

- **WHEN** 用户在钉住态阅读空间从第 3 行卡片悬停到第 8 行
- **THEN** 悬浮窗 x SHALL 保持栏右缘+12 不变，y SHALL 跟随到第 8 行

#### Scenario: 缩略图宽度触发

- **WHEN** 用户把指针移入卡片缩略图区域
- **THEN** 悬浮预览窗 SHALL 出现，其宽度 SHALL 等于上一版基准宽加一个缩略图宽度

#### Scenario: 缩略图左侧不唤出

- **WHEN** 用户把指针停在卡片缩略图左侧的标题与摘要区域
- **THEN** 悬浮预览窗 SHALL NOT 出现

#### Scenario: 底部按钮区悬停重显按钮

- **WHEN** 用户把指针移入悬浮窗底部按钮高度区域
- **THEN** 打开/分栏→/分栏↓ 三按钮 SHALL 显示

#### Scenario: PDF 卡片同样有底部动作行

- **WHEN** 用户在 PDF 文件的卡片上唤出悬浮预览窗并把指针移入底部按钮高度区域
- **THEN** 打开 / 分栏→ / 分栏↓ 三按钮 SHALL 显示，且其渲染尺寸 SHALL 与卡片内同款按钮一致

#### Scenario: 拖动保持

- **WHEN** 用户拖动悬浮窗到新位置后关闭再重新触发预览
- **THEN** 关闭前位置 SHALL 不保留（重开回默认锚定），关闭前拖动过程 SHALL 无跳动

### Requirement: AI 两形态

AI SHALL 有全产品唯一入口：状态栏星芒图标。小窗形态 SHALL 为 285×260、默认右下角距边 16px、标题栏可拖动、四边四角可缩放、× 可关闭；「停靠到右侧」SHALL 将其嵌入分栏树（默认右侧 28% 宽，可拖宽/关闭/再分），⋯ 菜单 SHALL 提供「脱离为小窗」；两形态 SHALL 共享同一对话历史。⌘⇧A SHALL 切换 AI 小窗（⇄ 停靠窗格）。AI 改动 SHALL 有确认卡 + 撤销条（3s 淡出、hover 重现）+ 快照（最近 10 份）。

AI 停靠栏 SHALL NOT 接收文件页签：停靠态下无论是卡片双击、卡片「打开」按钮、`Ctrl+O` 还是拖拽打开文件，页签 SHALL 落到普通内容栏——优先当前聚焦的普通栏，其次最近聚焦的普通栏，最后首个普通栏；打开后 SHALL 立即可见，SHALL NOT 出现「已打开但界面不显示」。打开文件 SHALL NOT 改变 AI 栏的页签数量与对话状态。

#### Scenario: 停靠态卡片打开文件

- **WHEN** AI 已停靠到右栏且焦点在 AI 栏，用户双击一张 md 卡片
- **THEN** 该文件 SHALL 在工作区普通栏中打开并显示内容，AI 栏页签数变化 SHALL 为 0

#### Scenario: 停靠态 Ctrl+O

- **WHEN** AI 已停靠到右栏，用户按 `Ctrl+O` 并选择一个文件
- **THEN** 文件 SHALL 打开在普通内容栏，SHALL NOT 落入 AI 栏

#### Scenario: 停靠与脱离

- **WHEN** 用户在小窗头部点击「停靠到右侧」，再从停靠窗格 ⋯ 选择「脱离为小窗」
- **THEN** AI SHALL 先成为右侧分栏窗格（约 28% 宽），脱离后回到小窗形态，对话历史 SHALL 保持连续

#### Scenario: 确认卡与撤销

- **WHEN** AI 执行一次视图改写（默认档）
- **THEN** 首次 SHALL 弹人话确认卡，本会话后续同类操作 SHALL 静默执行且出现撤销条（3s 淡出），撤销后视图 SHALL 完整还原

