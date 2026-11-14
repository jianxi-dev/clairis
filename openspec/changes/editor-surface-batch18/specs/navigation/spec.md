## MODIFIED Requirements

### Requirement: 页签条与格头

每格 SHALL 支持多页签：⌘T 新页签（当前格）、⌘W 关页签（最后一签关格）、拖拽排序；页签 SHALL 为类型色图标 + 标题 + ×。双击页签标题 SHALL 进入就地重命名（回车提交、Esc 取消、失焦提交），仅改变显示标题，SHALL NOT 改变文件路径。格头 SHALL 为页签条，右侧 SHALL 为模式图标（点击=预览↔编辑）、全屏图标、⋯ 菜单；⋯ 菜单 SHALL 恰含 6 项（新建文件/分享/右分/下分/源码模式/定位，均带图标，不含全屏）；导出、刷新、打开文件位置 SHALL NOT 出现在格头 ⋯ 菜单。

拖拽页签期间 SHALL NOT 选中经过的正文文字：拖拽一旦超过阈值，应用 SHALL 进入全局禁选会话，拖拽结束或取消后恢复；拖拽前的既有选区 SHALL NOT 被清空，但拖拽期间 `window.getSelection().toString()` SHALL 保持为空。

页签选中态 SHALL NOT 使用描边、下划线或外框线；选中页签标题 SHALL 使用 `--app-text-strong`（亮色近黑 / 暗色近白），未选中页签文字 SHALL 使用次级色。页签图标 SHALL 分级着色：只有**聚焦栏目的活动页签**图标保留文件类型色；未选中页签与其他栏目的活动页签图标 SHALL 使用 chrome 静息灰。其他栏目的活动页签标题 SHALL 仍使用选中色，以表示该文件处于打开状态。页签容器 SHALL NOT 自绘底边框。栏目处于聚焦态时 SHALL NOT 绘制强调色内描边——聚焦语义由页签与内容表达，拖拽落区环除外。

页签右键菜单 SHALL 恰含 11 项，顺序为：悬浮小窗、向右分栏、向下分栏、导出、打印、复制路径、打开文件位置、移动到…、刷新、关闭、关闭其他；每项 SHALL 带图标。导出 SHALL 在菜单内就地展开二级项（Word/.mdpkg/图片/PDF/HTML/ZIP），点击 SHALL NOT 关闭菜单后再去格头菜单打开子菜单；打印 SHALL 为导出下方的独立项，SHALL NOT 出现在导出二级项中。点击「悬浮小窗」SHALL 以被右击页签为锚唤出与文件卡片同款的悬浮预览窗，SHALL NOT 新建第二套悬浮窗实现。

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

### Requirement: 图标体系

全站图标 SHALL 使用静态 path 表（24×24 viewBox、`fill="currentColor"`、18px 密集/24px 主操作），SHALL NOT 引入图标库（含 universe-icon）、sprite、mask-CSS 或任何构建步骤。图标语言 SHALL 以描边为主（1.7、圆头圆角），实心仅用于播放/暂停、省略号（更多）、AI 星芒三处例外。SHALL 一概念一图标、同概念全产品同图标、不混风格、禁 emoji。可逆动作 SHALL 成对出现（全屏/退出、播放/暂停、音量/静音、钉住/取消钉住、循环三态），由成对 `IconName` 承载、调用点按下一个动作选择，SHALL NOT 给 `Icon` 组件加 state prop；钉住的调用点 SHALL 在钉住态渲染 `pinOff`、未钉住态渲染 `pin`。pin 与 pinOff 的图形 SHALL 收细：图钉帽下的梯形 SHALL 相对钉帽下移、取消钉住的斜杠 SHALL 只覆盖图钉本体，SHALL NOT 用横贯整格的斜杠。编辑器插入菜单的同族图标 SHALL 两两可辨：分栏图标 SHALL 按 1/2/3/4/5 栏画出真实分割比例，表格 SHALL 为封口网格，数据看板、插入 HTML、插入 CSS、流程图、视频、文件、内嵌网页 SHALL 各自成图，SHALL NOT 出现两组完全相同的 path；剪切块图标 SHALL 为直观的剪切语义图形。导出族 SHALL 为不同格式提供各自可辨的图标（Word / ZIP / .mdpkg），SHALL NOT 复用文件/文件夹/通用 markdown 图标。视频「字幕」与「快捷键说明」SHALL 为可区分的两个图形（字幕=对话气泡形、快捷键说明=键位格形）。播放器自绘控件图标的渲染尺寸 SHALL 与原生控件一致（统一视觉尺寸），SHALL NOT 出现全屏/画中画明显大于其它控件的现象。图标 SHALL 支持随主题着色（浅/深/暖），暖色主题下强调色调用点 SHALL 解析为暖色 `--app-accent`。主题选择器中「亮色」与「暖色」SHALL 使用可区分的图形（以光线线条数表达亮度差异，亮色多于暖色），SHALL NOT 复用同一形状。类型色 SHALL 固定 8 类：Markdown #6366f1、HTML #f59e0b、文本 #64748b、PDF #ef4444、视频 #a855f7、图片 #10b981、代码 #06b6d4、音频 #ec4899。标签 SHALL 三级可设置（自动：主入口图标+文字、重复处仅图标/始终显示文字/仅图标）。设置内 SHALL 提供图标抽屉查看全部在用图标（名称/尺寸/已有-新绘）。

#### Scenario: 类型色一致性

- **WHEN** 同一 HTML 文件出现在门户磁贴、页签、阅读空间卡片与网格 tile
- **THEN** 四处类型图标 SHALL 使用同一 HTML 橙 #f59e0b 且形状一致

#### Scenario: 禁 emoji

- **WHEN** 审查全站图标渲染
- **THEN** SHALL 无任何 emoji 字符

#### Scenario: 描边与实心分工

- **WHEN** 审查图标抽屉中任一经描边渲染的图标
- **THEN** 该图标的 `<path>` SHALL 为 `fill="none"` 且带 `stroke="currentColor"`（线宽 1.7）
- **AND** 播放/暂停、更多、AI 星芒 SHALL 保持实心填充

#### Scenario: 可逆动作成对

- **WHEN** 打开任一可逆动作的两种状态（全屏中与未全屏、已钉住与未钉住、静音与未静音、播放与暂停）
- **THEN** 两种状态 SHALL 各对应一个独立 `IconName`，且形状为同一构图的反向/补全形态

#### Scenario: 钉住后切换为取消钉住

- **WHEN** 用户点击任一钉住按钮（悬浮预览/阅读空间条目/阅读空间栏/快速捕获）使其进入钉住态
- **THEN** 该按钮 SHALL 渲染 `pinOff` 图标；取消钉住后 SHALL 恢复 `pin`

#### Scenario: 导出族各自成图

- **WHEN** 打开文件右键菜单的导出子菜单
- **THEN** Word / ZIP / .mdpkg 三项 SHALL 各渲染一个彼此可辨的专用图标

#### Scenario: 字幕与快捷键说明可区分

- **WHEN** 视频播放器同时渲染「字幕」与「快捷键说明」入口
- **THEN** 二者的图标形状 SHALL 不同且各自可辨

#### Scenario: 播放器控件尺寸统一

- **WHEN** 测量视频播放器自绘控件的图标渲染尺寸
- **THEN** 全屏、画中画与其它控件 SHALL 为同一视觉尺寸

#### Scenario: 不引入图标库

- **WHEN** 审查打包产物与 `src/ui/icons.ts`
- **THEN** 图标 SHALL 全部来自静态 path 表，SHALL NOT 存在图标库依赖或运行时生成

#### Scenario: 亮色与暖色图标不同

- **WHEN** 打开主题选择面板
- **THEN** 「亮色」与「暖色」两项的图标 path SHALL 不同，亮色图标的光线线条数 SHALL 多于暖色

#### Scenario: 编辑器图标不重复

- **WHEN** 收集编辑器插入菜单中 分栏(1–5) / 表格 / 数据看板 / 插入 HTML / 插入 CSS / 流程图 / 视频 / 文件 / 内嵌网页 / 剪切块 的图标 path
- **THEN** 任意两项的 path 字符串 SHALL 互不相同，表格图标 SHALL 为外框闭合的网格

#### Scenario: 图钉斜杠不横贯整格

- **WHEN** 渲染 `pinOff`
- **THEN** 其斜杠 SHALL 只覆盖图钉本体范围，SHALL NOT 从 viewBox 一角拉到对角

### Requirement: 页签右键菜单文件动作

页签右键菜单 SHALL 提供导出、打开文件位置、刷新三项，并按以下顺序排列：导出位于「复制路径」之前，打开文件位置位于「复制路径」之后，刷新位于「关闭」之前。导出 SHALL 展开全部导出二级项并直接执行，SHALL NOT 跳转格头菜单；打印 SHALL 作为导出下方的独立菜单项出现，且 SHALL NOT 出现在导出二级项中。

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

