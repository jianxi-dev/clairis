# navigation 能力增量规格

## MODIFIED Requirements

### Requirement: 页签条与格头

每格 SHALL 支持多页签：⌘T 新页签（当前格）、⌘W 关页签（最后一签关格）、拖拽排序；页签 SHALL 为类型色图标 + 标题 + ×。**页签 SHALL 弹性布局**：页签 SHALL NOT 主动伸展填满页签条（SHALL NOT 使用 `flex-grow: 1` 铺满整条）——单页签与短标题页签 SHALL 按内容实际宽度显示；页签宽度 SHALL 以**最大宽度**为上限（取 `--tab-max-width`，与页签信息窗 `--tab-info-width` 同宽）；多页签超出页签条可用宽度时 SHALL 按可用宽度等比收缩（flex 分配），收缩下限为 `min(96px, 页签内容宽)`（**最小宽度保底**仅约束收缩，SHALL NOT 把短标题页签撑到保底宽）；标题在伸缩后的可用宽度内仍 SHALL 以 `text-overflow: ellipsis` 收尾、单行 `white-space: nowrap`，SHALL NOT 换行；仅当页签条可用宽度不足以容纳全部页签的最小宽度保底时，页签条 SHALL 横向滚动，SHALL NOT 压缩到不可读或溢出容器。完整文件名由页签名信息窗承载（权威表述见 application-shell 域「G-6 顶栏职责与页签身份」，两处 SHALL 一致）。相邻页签之间的间距 SHALL 为 **32px**（容差 ±2px）；单个页签内标题右缘到关闭按钮左缘的水平间距 SHALL 不超过 **6px**。双击页签标题 SHALL 进入就地重命名（回车提交、Esc 取消、失焦提交），输入框只承载文件主名，扩展名 SHALL 以只读后缀呈现且 SHALL NOT 可编辑，提交时 SHALL 把原扩展名接回；仅改变显示标题与 frontmatter 标题，SHALL NOT 改变文件路径。格头 SHALL 为页签条，右侧 SHALL 为模式图标（点击=预览↔编辑）、全屏图标、⋯ 菜单；⋯ 菜单 SHALL 恰含 6 项（新建文件/分享/右分/下分/源码模式/定位，均带图标，不含全屏）；导出、刷新、打开文件位置 SHALL NOT 出现在格头 ⋯ 菜单。

拖拽页签期间 SHALL NOT 选中经过的正文文字：拖拽一旦超过阈值，应用 SHALL 进入全局禁选会话，拖拽结束或取消后恢复；拖拽前的既有选区 SHALL NOT 被清空，但拖拽期间 `window.getSelection().toString()` SHALL 保持为空。

页签选中态 SHALL NOT 使用描边、下划线或外框线；选中页签标题 SHALL 使用 `--app-text-strong`（亮色近黑 / 暗色近白），未选中页签文字 SHALL 使用次级色。页签图标 SHALL 分级着色：只有**聚焦栏目的活动页签**图标保留文件类型色；未选中页签与其他栏目的活动页签图标 SHALL 使用 chrome 静息灰。其他栏目的活动页签标题 SHALL 仍使用选中色，以表示该文件处于打开状态。页签容器 SHALL NOT 自绘底边框。栏目处于聚焦态时 SHALL NOT 绘制强调色内描边——聚焦语义由页签与内容表达，拖拽落区环除外。

页签右键菜单 SHALL 恰含 12 项，顺序为：悬浮小窗、向右分栏、向下分栏、添加字段、导出、打印、复制路径、打开文件位置、移动到…、刷新、关闭、关闭其他；每项 SHALL 带图标。**「添加字段」SHALL 打开被右击页签文档的字段调色板并关闭菜单**（无 frontmatter 的文档同样可用；分屏下 SHALL 只打开被右击页签对应文档的面板，权威表述见 doc-property-panel 域「添加字段控件区」）。导出 SHALL 在菜单内就地展开二级项（Word/.mdpkg/图片/PDF/HTML/ZIP），点击 SHALL NOT 关闭菜单后再去格头菜单打开子菜单；打印 SHALL 为导出下方的独立项，SHALL NOT 出现在导出二级项中。点击「悬浮小窗」SHALL 以被右击页签为锚唤出与文件卡片同款的悬浮预览窗，SHALL NOT 新建第二套悬浮窗实现。

页签名鼠标滑入 SHALL 显示下拉信息窗（矩形圆角 8px、宽度取 token `--tab-info-width`，视口不足时按 `100vw - 16px` 钳制）：① 文件名（最大字号，SHALL 换行显示完整名，SHALL NOT 以省略号截断）；② 完整路径，路径每层文件夹可单击在文件管理器中定位该层；③ 最近保存时间；「复制路径」与「复制文件」两个图标动作 SHALL 位于「最近保存时间」行右侧（SHALL NOT 位于文件名节点之后），两图标 SHALL 可区分（复制路径用路径语义图形、复制文件用文件语义图形，SHALL NOT 复用同一图形），颜色 SHALL 使用 `--app-text-3` 弱化档。复制成功 SHALL 以**悬浮 toast** 呈现：toast SHALL 锚定触发按钮、为圆角胶囊、约 2000ms 后自动消失、SHALL NOT 阻挡指针交互；SHALL NOT 以行内文本嵌在路径后。鼠标点按页签条空白处并移动超过阈值 SHALL 拖动窗口；未超阈值 SHALL 视为点击，SHALL NOT 触发窗口拖动。

#### Scenario: 右键菜单含悬浮小窗

- **WHEN** 用户在页签上唤出右键菜单
- **THEN** 菜单 SHALL 渲染 12 项，首项文案为「悬浮小窗」并带图标
- **AND WHEN** 用户点击「悬浮小窗」
- **THEN** SHALL 出现 `floating-preview`，其 `data-preview-path` SHALL 等于该页签的文件路径

#### Scenario: 右键菜单添加字段

- **WHEN** 用户右键某页签并点击「添加字段」
- **THEN** 该页签文档的字段调色板 SHALL 打开、菜单 SHALL 关闭；无 frontmatter 的文档同样可用
