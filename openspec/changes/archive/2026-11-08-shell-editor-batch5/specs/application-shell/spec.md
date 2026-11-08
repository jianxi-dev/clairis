## MODIFIED Requirements

### Requirement: G-3 单一顶栏（Chrome Bar）

应用外壳 SHALL 以单一顶栏（Chrome Bar，高度 40px，常驻显示）承载原工具栏职责；独立的 Toolbar 组件 SHALL 取消，不再需要 hover 触发的工具栏淡入。顶栏 SHALL NOT 再承载主题切换、网格概览、AI、沉浸入口四个图标——这些图标 SHALL 移入底部状态栏右侧，顺序保持 网格概览 / AI / 主题 / 沉浸。顶栏 SHALL 只保留品牌与窗口级职责。

#### Scenario: 顶栏常驻

- **WHEN** 应用处于任何非沉浸状态
- **THEN** 顶部 SHALL 显示 40px 的单一 Chrome Bar，不存在第二个独立工具栏

#### Scenario: 顶栏不再含主题区图标

- **WHEN** 审查顶栏 DOM
- **THEN** 顶栏 SHALL NOT 含 `data-testid="grid-entry"` / `data-ai-entry` / 主题切换 / `data-testid="immersive-entry"` 四个入口

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

## ADDED Requirements

### Requirement: 状态栏

应用外壳 SHALL 在窗口底部常驻一条状态栏。状态栏右侧 SHALL 依次排放 网格概览 / AI / 主题切换 / 沉浸入口 四个图标（顺序与移入前顶栏一致），点击行为与图标语义 SHALL 不变。状态栏 SHALL NOT 因沉浸模式而隐藏其图标（沉浸收纳仅作用于顶栏与页签条）。

#### Scenario: 状态栏常驻且含四图标

- **WHEN** 应用处于任何非沉浸状态
- **THEN** 窗口底部 SHALL 显示状态栏，其右侧 SHALL 含 网格概览 / AI / 主题 / 沉浸 四个图标

#### Scenario: 沉浸入口仍在状态栏可用

- **WHEN** 用户点击状态栏右侧的沉浸图标
- **THEN** 应用 SHALL 进入沉浸模式（等价于原顶栏沉浸入口）
