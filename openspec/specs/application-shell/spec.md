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

### Requirement: G-3 单一顶栏（Chrome Bar）

应用外壳 SHALL 以单一顶栏（Chrome Bar，高度 40px，常驻显示）承载原工具栏职责；独立的 Toolbar 组件 SHALL 取消，不再需要 hover 触发的工具栏淡入。顶栏 SHALL NOT 再承载主题切换、网格概览、AI、沉浸入口四个图标——这些图标 SHALL 移入底部状态栏右侧，顺序保持 网格概览 / AI / 主题 / 沉浸。顶栏 SHALL 只保留品牌与窗口级职责。

#### Scenario: 顶栏常驻

- **WHEN** 应用处于任何非沉浸状态
- **THEN** 顶部 SHALL 显示 40px 的单一 Chrome Bar，不存在第二个独立工具栏

#### Scenario: 顶栏不再含主题区图标

- **WHEN** 审查顶栏 DOM
- **THEN** 顶栏 SHALL NOT 含 `data-testid="grid-entry"` / `data-ai-entry` / 主题切换 / `data-testid="immersive-entry"` 四个入口

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

应用外壳 SHALL 以顶栏承载产品级入口（网格概览、AI、主题、沉浸），SHALL NOT 在顶栏显示当前文件名或预览/编辑/源码切换；文件身份 SHALL 仅由每个分栏的页签条表达，且页签 SHALL 始终同时显示类型图标与文件名。活跃页签 SHALL 以胶囊高亮表达，而非下划线。浅色/深色/暖色切换 SHALL 通过根节点 class 驱动全站语义 token 与 `dark:` 组件样式，整窗一致变化。

#### Scenario: 顶栏不再重复文件身份
- **WHEN** 用户打开任意文档并进入工作区
- **THEN** 顶栏 SHALL 只显示标月品牌、网格、AI、主题与沉浸入口，SHALL NOT 显示文件名或预览/编辑/源码按钮

#### Scenario: 页签始终带名称
- **WHEN** 分栏内存在一个或多个页签
- **THEN** 每个页签 SHALL 同时渲染类型图标与文件名，活跃页签 SHALL 为胶囊高亮

#### Scenario: 主题切换覆盖整窗
- **WHEN** 用户从浅色切换到深色
- **THEN** 根节点 SHALL 切换 `dark` class，顶栏、面板、卡片、弹层与正文背景 SHALL 同时使用深色语义 token

### Requirement: G-7 图标语义与全屏可用性

全站图标 SHALL 使用同一 24×24 线性语言，分栏图标 SHALL 用左右/上下矩形面积差表达方向，钉住与全屏 SHALL 用轻量轮廓而非重填充。单格与多格工作区 SHALL 均显示可用的全屏入口：单格点击全屏 SHALL 让该格铺满工作区（隐藏其余 chrome），再次点击或 Esc SHALL 退出。全屏中的格头全屏按钮 SHALL 渲染退出形态（`collapse`），`aria-pressed` SHALL 为真，`title`/`aria-label` SHALL 为「退出全屏」；退出后 SHALL 恢复进入形态（`expand`）。

> 2026-11-08 修订：原「单格 SHALL NOT 显示无效的全屏按钮」作废——单格全屏（聚焦阅读）是有效用例，按钮应可用而非隐藏。

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

### Requirement: G-10 沉浸模式顶栏收纳与悬浮回显

进入沉浸模式后，顶栏与每格页签条 SHALL 在 300ms 内收拢至高度 0（SHALL NOT 以透明状态继续占位），正文 SHALL 随之上移。指针进入屏幕上缘 16px 热区并停留 400ms 后，应用 SHALL 显示一条悬浮页签条（`position: fixed`），列出**指针当前所在格**的页签与「退出沉浸」入口——指针不在任何格上时回退到聚焦格。悬浮条 SHALL NOT 在其上方额外占据一条透明带（热区 SHALL 与悬浮条重叠，透出的是悬浮条自身而非正文空白）。指针离开热区与悬浮条 2s 后 SHALL 收起；拖拽页签期间 SHALL 抑制该收起，保证拖拽不中断。

#### Scenario: 顶栏收纳为 0 高

- **WHEN** 用户进入沉浸模式并等待 300ms
- **THEN** 顶栏与页签条的计算高度 SHALL 为 0，正文区域顶部 SHALL 上移到窗口顶部

#### Scenario: 顶部热区唤出悬浮页签条

- **WHEN** 沉浸模式下指针移动到屏幕上缘 16px 内并停留 400ms
- **THEN** SHALL 出现 fixed 悬浮页签条，列出当前格的页签

#### Scenario: 悬浮条跟随指针所在格

- **WHEN** 沉浸模式下工作区有两格，指针从第一格移入第二格后唤出悬浮条
- **THEN** 悬浮条列出的页签 SHALL 为第二格的页签

#### Scenario: 空格有兜底文案

- **WHEN** 悬浮条对应的格没有任何页签
- **THEN** 悬浮条 SHALL 显示可读兜底文案（如「空分栏」），SHALL NOT 只显示退出按钮而无任何标识

#### Scenario: 悬浮条上方无空白带

- **WHEN** 沉浸模式下唤出悬浮页签条
- **THEN** 悬浮条紧邻屏幕上缘，其与屏幕顶部之间 SHALL NOT 存在可见的透明空行

#### Scenario: 悬浮条可切换页签

- **WHEN** 用户在悬浮页签条上点击另一个页签
- **THEN** 当前格 SHALL 切换到该页签，且沉浸状态 SHALL 保持

#### Scenario: 离开后收起

- **WHEN** 指针离开热区与悬浮条超过 2s
- **THEN** 悬浮条 SHALL 消失

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

### Requirement: 状态栏

应用外壳 SHALL 在窗口底部常驻一条状态栏。状态栏右侧 SHALL 依次排放 网格概览 / AI / 主题切换 / 沉浸入口 四个图标（顺序与移入前顶栏一致），点击行为与图标语义 SHALL 不变。状态栏 SHALL NOT 因沉浸模式而隐藏其图标（沉浸收纳仅作用于顶栏与页签条）。

#### Scenario: 状态栏常驻且含四图标

- **WHEN** 应用处于任何非沉浸状态
- **THEN** 窗口底部 SHALL 显示状态栏，其右侧 SHALL 含 网格概览 / AI / 主题 / 沉浸 四个图标

#### Scenario: 沉浸入口仍在状态栏可用

- **WHEN** 用户点击状态栏右侧的沉浸图标
- **THEN** 应用 SHALL 进入沉浸模式（等价于原顶栏沉浸入口）

## 待裁定与跨域冲突记录（非规范性）

以下为来源层面的已登记冲突，仅如实记录，不在本规格内裁定（裁定由后续 change/治理任务处理）：

- **Cmd+\ 键位冲突**：G-1 要求移除旧的"切换左侧栏"快捷键 `Cmd+\`；reading 域 A-5 将 `Cmd+\` 指定为沉浸阅读开关（来源：`docs/design/approved/immersive-reading/spec.md` v2）。两文件对同一键位的处置需在实现层统一（移除旧语义后即可由 A-5 占用），此处保留两边原意。
- **G-4 缺失**：`docs/MVP-需求跟踪表.md` 模块 G 仅登记 G-1 / G-2 / G-3 / G-5，无 G-4 行；G-4 的状态待跟踪表补齐后裁定。
