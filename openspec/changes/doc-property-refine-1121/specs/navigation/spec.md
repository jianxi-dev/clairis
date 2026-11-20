## MODIFIED Requirements

### Requirement: 页签条与格头

每格 SHALL 支持多页签：⌘T 新页签（当前格）、⌘W 关页签（最后一签关格）、拖拽排序；页签 SHALL 为类型色图标 + 标题 + ×。**页签 SHALL 弹性布局**：页签 SHALL NOT 主动伸展填满页签条（SHALL NOT 使用 `flex-grow: 1` 铺满整条）——单页签与短标题页签 SHALL 按内容实际宽度显示；页签宽度 SHALL 以**最大宽度**为上限（取 `--tab-max-width`，与页签信息窗 `--tab-info-width` 同宽）；多页签超出页签条可用宽度时 SHALL 按可用宽度等比收缩（flex 分配），收缩下限为 `min(96px, 页签内容宽)`（**最小宽度保底**仅约束收缩，SHALL NOT 把短标题页签撑到保底宽）；标题在伸缩后的可用宽度内仍 SHALL 以 `text-overflow: ellipsis` 收尾、单行 `white-space: nowrap`，SHALL NOT 换行；仅当页签条可用宽度不足以容纳全部页签的最小宽度保底时，页签条 SHALL 横向滚动，SHALL NOT 压缩到不可读或溢出容器。完整文件名由页签名信息窗承载（权威表述见 application-shell 域「G-6 顶栏职责与页签身份」，两处 SHALL 一致）。相邻页签之间的间距 SHALL 为 **32px**（容差 ±2px）；单个页签内标题右缘到关闭按钮左缘的水平间距 SHALL 不超过 **6px**。双击页签标题 SHALL 进入就地重命名（回车提交、Esc 取消、失焦提交），输入框只承载文件主名，扩展名 SHALL 以只读后缀呈现且 SHALL NOT 可编辑，提交时 SHALL 把原扩展名接回；仅改变显示标题与 frontmatter 标题，SHALL NOT 改变文件路径。格头 SHALL 为页签条，右侧 SHALL 为模式图标（点击=预览↔编辑）、全屏图标、⋯ 菜单；⋯ 菜单 SHALL 恰含 6 项（新建文件/分享/右分/下分/源码模式/定位，均带图标，不含全屏）；导出、刷新、打开文件位置 SHALL NOT 出现在格头 ⋯ 菜单。

拖拽页签期间 SHALL NOT 选中经过的正文文字：拖拽一旦超过阈值，应用 SHALL 进入全局禁选会话，拖拽结束或取消后恢复；拖拽前的既有选区 SHALL NOT 被清空，但拖拽期间 `window.getSelection().toString()` SHALL 保持为空。

页签选中态 SHALL NOT 使用描边、下划线或外框线；选中页签标题 SHALL 使用 `--app-text-strong`（亮色近黑 / 暗色近白），未选中页签文字 SHALL 使用次级色。页签图标 SHALL 分级着色：只有**聚焦栏目的活动页签**图标保留文件类型色；未选中页签与其他栏目的活动页签图标 SHALL 使用 chrome 静息灰。其他栏目的活动页签标题 SHALL 仍使用选中色，以表示该文件处于打开状态。页签容器 SHALL NOT 自绘底边框。栏目处于聚焦态时 SHALL NOT 绘制强调色内描边——聚焦语义由页签与内容表达，拖拽落区环除外。

页签右键菜单 SHALL 恰含 11 项，顺序为：悬浮小窗、向右分栏、向下分栏、导出、打印、复制路径、打开文件位置、移动到…、刷新、关闭、关闭其他；每项 SHALL 带图标。导出 SHALL 在菜单内就地展开二级项（Word/.mdpkg/图片/PDF/HTML/ZIP），点击 SHALL NOT 关闭菜单后再去格头菜单打开子菜单；打印 SHALL 为导出下方的独立项，SHALL NOT 出现在导出二级项中。点击「悬浮小窗」SHALL 以被右击页签为锚唤出与文件卡片同款的悬浮预览窗，SHALL NOT 新建第二套悬浮窗实现。

页签名鼠标滑入 SHALL 显示下拉信息窗（矩形圆角 8px、宽度取 token `--tab-info-width`，视口不足时按 `100vw - 16px` 钳制）：① 文件名（最大字号，SHALL 换行显示完整名，SHALL NOT 以省略号截断）；② 完整路径，路径每层文件夹可单击在文件管理器中定位该层；③ 最近保存时间；「复制路径」与「复制文件」两个图标动作 SHALL 位于「最近保存时间」行右侧（SHALL NOT 位于文件名节点之后），两图标 SHALL 可区分（复制路径用路径语义图形、复制文件用文件语义图形，SHALL NOT 复用同一图形），颜色 SHALL 使用 `--app-text-3` 弱化档。复制成功 SHALL 以**悬浮 toast** 呈现：toast SHALL 锚定触发按钮、为圆角胶囊、约 2000ms 后自动消失、SHALL NOT 阻挡指针交互；SHALL NOT 以行内文本嵌在路径后。鼠标点按页签条空白处并移动超过阈值 SHALL 拖动窗口；未超阈值 SHALL 视为点击，SHALL NOT 触发窗口拖动。

#### Scenario: 页签名无省略号

> 场景标题沿用旧名；自本 change 起页签改为弹性等比伸缩，不再有固定 120px 上限；标题在伸缩后的可用宽度内仍以省略号收尾，完整名由信息窗承载。

- **WHEN** 页签标题文本宽度超过其所在页签分配到的宽度
- **THEN** 该页签标题容器的 `text-overflow` SHALL 为 `ellipsis`，`white-space` SHALL 为 `nowrap`，`-webkit-line-clamp` SHALL 为 `none`，且标题 SHALL NOT 换行

#### Scenario: 页签间距为指针尺寸

- **WHEN** 测量相邻两个页签的间距
- **THEN** 其间距 SHALL 为 32px（容差 ±2px）

#### Scenario: 长页签可滚动

> 场景标题沿用旧名；自本 change 起仅当可用宽度不足以容纳全部页签的最小宽度保底时才横向滚动。

- **WHEN** 页签条可用宽度不足以容纳全部页签的最小宽度保底
- **THEN** 页签条 SHALL 可横向滚动，页签宽度 SHALL 保持其最小宽度保底，SHALL NOT 压缩到不可读或溢出容器

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
- **THEN** 菜单 SHALL 渲染 11 项，首项文案为「悬浮小窗」并带图标
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

#### Scenario: 页签名信息窗

- **WHEN** 用户把指针悬停在页签名上
- **THEN** SHALL 出现含文件名、完整路径与最近保存时间的下拉信息窗；点击路径某层 SHALL 在文件管理器中定位该层

#### Scenario: 信息窗为 8px 圆角矩形且文件名换行

- **WHEN** 页签名信息窗展开
- **THEN** 其计算 `border-radius` SHALL 为 8px（容差 ±1px）；文件名行的 `white-space` SHALL NOT 为 `nowrap`，超长文件名 SHALL 换行显示且 SHALL NOT 溢出信息窗

#### Scenario: 信息窗复制路径与复制文件

> 场景标题沿用旧名；自本 change 起两复制图标移到「最近保存时间」行右侧、图形可区分，成功提示改为悬浮 toast。

- **WHEN** 页签名信息窗展开
- **THEN** 「最近保存时间」行右侧 SHALL 存在「复制路径」与「复制文件」两个图标按钮，两按钮图形 SHALL 不同且可区分（复制路径 ≠ 复制文件），其颜色 SHALL 等于 `--app-text-3`；点击「复制路径」后剪贴板文本 SHALL 等于该页签文件的绝对路径；点击「复制文件」后系统剪贴板 SHALL 含该文件的文件引用（macOS 可在访达粘贴出该文件）；复制成功后 SHALL 出现锚定触发按钮的悬浮 toast（圆角胶囊），约 2000ms 后自动消失

#### Scenario: 页签空白处拖动窗口

- **WHEN** 用户在页签条空白处按下并移动超过阈值
- **THEN** 窗口位置 SHALL 变化；在页签或按钮区域按下 SHALL NOT 触发窗口拖动

#### Scenario: 信息窗宽度取 token

- **WHEN** 页签名信息窗展开
- **THEN** 其计算宽度 SHALL 等于 `--tab-info-width` 的当前值，SHALL NOT 使用硬编码像素值

#### Scenario: 窗格变窄时页签等比收缩

- **WHEN** 用户在多页签栏目内收窄窗格（或窗口）使页签条可用宽度变小
- **THEN** 各页签宽度 SHALL 按可用宽度同比缩小（收缩比例一致），相邻页签间距 SHALL 保持 32px，页签之间 SHALL NOT 互相覆盖，页签条 SHALL NOT 溢出容器；标题在收缩后的宽度内以省略号收尾

#### Scenario: 复制成功悬浮提示

- **WHEN** 用户点击「复制路径」或「复制文件」成功
- **THEN** SHALL 出现锚定该按钮的悬浮 toast，其为圆角胶囊、约 2000ms 后自动消失、SHALL NOT 阻挡指针交互；信息窗内 SHALL NOT 出现行内成功文本

#### Scenario: 短页签按实际宽度显示

- **WHEN** 页签标题内容宽小于收缩保底（如两字符文件名）
- **THEN** 页签 SHALL 按内容实际宽度显示，SHALL NOT 被撑到 96px 保底宽

#### Scenario: 单页签不顶满页签条

- **WHEN** 页签条内只有一个页签
- **THEN** 页签 SHALL 以其内容宽度（不超过 `--tab-max-width`）显示，页签条剩余空间 SHALL 保持为空白拖窗区，SHALL NOT 被页签铺满

#### Scenario: 扩展名不可编辑

- **WHEN** 用户双击页签标题进入就地重命名输入态
- **THEN** 输入框 SHALL 只承载文件主名，扩展名 SHALL 以只读后缀呈现且 SHALL NOT 可编辑；提交后页签标题 SHALL 仍以原扩展名（`.md` / `.markdown` / `.txt`）结尾，文件路径 SHALL 不变
