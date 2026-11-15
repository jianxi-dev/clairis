## MODIFIED Requirements

### Requirement: 页签条与格头

每格 SHALL 支持多页签：⌘T 新页签（当前格）、⌘W 关页签（最后一签关格）、拖拽排序；页签 SHALL 为类型色图标 + 标题 + ×。双击页签标题 SHALL 进入就地重命名（回车提交、Esc 取消、失焦提交），仅改变显示标题，SHALL NOT 改变文件路径。格头 SHALL 为页签条，右侧 SHALL 为模式图标（点击=预览↔编辑）、全屏图标、⋯ 菜单；⋯ 菜单 SHALL 恰含 6 项（新建文件/分享/右分/下分/源码模式/定位，均带图标，不含全屏）；导出、刷新、打开文件位置 SHALL NOT 出现在格头 ⋯ 菜单。

拖拽页签期间 SHALL NOT 选中经过的正文文字：拖拽一旦超过阈值，应用 SHALL 进入全局禁选会话，拖拽结束或取消后恢复；拖拽前的既有选区 SHALL NOT 被清空，但拖拽期间 `window.getSelection().toString()` SHALL 保持为空。

页签选中态 SHALL NOT 使用描边、下划线或外框线；选中页签标题 SHALL 使用 `--app-text-strong`（亮色近黑 / 暗色近白），未选中页签文字 SHALL 使用次级色。页签图标 SHALL 分级着色：只有**聚焦栏目的活动页签**图标保留文件类型色；未选中页签与其他栏目的活动页签图标 SHALL 使用 chrome 静息灰。其他栏目的活动页签标题 SHALL 仍使用选中色，以表示该文件处于打开状态。页签容器 SHALL NOT 自绘底边框。栏目处于聚焦态时 SHALL NOT 绘制强调色内描边——聚焦语义由页签与内容表达，拖拽落区环除外。

页签右键菜单 SHALL 恰含 11 项，顺序为：悬浮小窗、向右分栏、向下分栏、导出、打印、复制路径、打开文件位置、移动到…、刷新、关闭、关闭其他；每项 SHALL 带图标。导出 SHALL 在菜单内就地展开二级项（Word/.mdpkg/图片/PDF/HTML/ZIP），点击 SHALL NOT 关闭菜单后再去格头菜单打开子菜单；打印 SHALL 为导出下方的独立项，SHALL NOT 出现在导出二级项中。点击「悬浮小窗」SHALL 以被右击页签为锚唤出与文件卡片同款的悬浮预览窗，SHALL NOT 新建第二套悬浮窗实现。

页签名鼠标滑入 SHALL 显示下拉信息窗（胶囊卡片）：① 文件名（最大字号）；② 完整路径，路径每层文件夹可单击在文件管理器中定位该层；③ 最近保存时间。鼠标点按页签条空白处并移动超过阈值 SHALL 拖动窗口；未超阈值 SHALL 视为点击，SHALL NOT 触发窗口拖动。

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

#### Scenario: 页签空白处拖动窗口

- **WHEN** 用户在页签条空白处按下并移动超过阈值
- **THEN** 窗口位置 SHALL 变化；在页签或按钮区域按下 SHALL NOT 触发窗口拖动

### Requirement: 页签右键菜单文件动作

页签右键菜单 SHALL 提供导出、打开文件位置、刷新三项，并按以下顺序排列：导出位于「复制路径」之前，打开文件位置位于「复制路径」之后，刷新位于「关闭」之前。导出 SHALL 展开全部导出二级项并直接执行，SHALL NOT 跳转格头菜单；打印 SHALL 作为导出下方的独立菜单项出现，且 SHALL NOT 出现在导出二级项中。「导出」二级项 SHALL 在鼠标滑入时自动展开（无需点击），指针移出父项后 SHALL 保持可见。「移动到」图标 SHALL 与「打开文件位置」图标不同。

#### Scenario: 菜单项顺序

- **WHEN** 用户右键任一文件页签
- **THEN** 菜单项索引 SHALL 满足 `idx(导出) < idx(复制路径) < idx(打开文件位置)` 且 `idx(刷新) < idx(关闭)`，三项各出现严格等于 1 次

#### Scenario: 取消菜单无残留

- **WHEN** 用户打开右键菜单后按 Esc 或点击外部
- **THEN** 菜单节点数 SHALL 严格等于 0

#### Scenario: 导出就地展开

- **WHEN** 用户右键文件页签并点击「导出」
- **THEN** 同一菜单 SHALL 就地出现导出二级项，右键菜单 SHALL NOT 关闭后跳到格头菜单

#### Scenario: 打印入口独立

- **WHEN** 用户右键文件页签并查看菜单
- **THEN** 「打印」SHALL 位于「导出」正下方且二者为同级项；打开导出二级项后其中 SHALL NOT 含「打印」

#### Scenario: 导出 hover 展开二级

- **WHEN** 用户把指针滑入「导出」行
- **THEN** 导出二级项 SHALL 自动出现；指针移出父项后二级项 SHALL 仍可见

#### Scenario: 移动到图标不重复

- **WHEN** 用户打开页签右键菜单
- **THEN** 「移动到」与「打开文件位置」的图标 path SHALL 不同

### Requirement: 左边栏展开与固定快捷键

`⌘\` SHALL 始终切换左边栏可见性：折叠态切到钉住，钉住 / 悬停态切到折叠；折叠态按 `⌘\` SHALL NOT 进入沉浸阅读。`⌘⌥\` SHALL 切换固定：钉住 ↔ 悬停；折叠态按 `⌘⌥\` 时 SHALL 先展开为钉住。pin 按钮与边缘热区行为保持不变。

系统 SHALL 提供「固定隐藏」态与快捷键：进入固定隐藏后左边栏箭头区域 SHALL 彻底消失，鼠标滑入触发区 SHALL NOT 显示左边栏；取消固定隐藏后箭头区域 SHALL 恢复，鼠标滑入触发区 SHALL 自动显示。设置中 SHALL 提供对应开关（`rail_pin_hidden`）。

#### Scenario: ⌘\ 展开与收起

- **WHEN** 左边栏处于折叠态时用户按 `⌘\`
- **THEN** `railState` SHALL 为 `pinned`；再按一次 `⌘\` 后 `railState` SHALL 为 `collapsed`

#### Scenario: ⌘⌥\ 固定切换

- **WHEN** 左边栏处于钉住态时用户按 `⌘⌥\`
- **THEN** `railPinned` SHALL 为 `true`；再按一次后 `railPinned` SHALL 为 `false`

#### Scenario: 固定隐藏彻底的箭头消失

- **WHEN** 用户进入左边栏固定隐藏态
- **THEN** 左侧箭头区域节点数 SHALL 为 0，鼠标滑入触发区 SHALL NOT 显示左边栏

#### Scenario: 取消固定隐藏恢复

- **WHEN** 用户取消固定隐藏
- **THEN** 箭头区域 SHALL 恢复，鼠标滑入触发区 SHALL 自动显示左边栏；设置开关写入 `rail_pin_hidden`
