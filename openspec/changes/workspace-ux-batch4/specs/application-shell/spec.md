## ADDED Requirements

### Requirement: G-8 页签拖拽轨迹与落点反馈

页签拖拽 SHALL 在指针移动超过 4px 后进入拖拽态，并同时满足：

- 插入位置 SHALL 显示一条宽 4px、贯穿页签条高度的强调色轨迹条；
- 被拖页签 SHALL 降低不透明度至 0.5 并显示强调色虚线描边；
- 指针位于其他格时，该格 SHALL 显示 2px 强调色内描边落区环；
- 指针进入正文 iframe 区域时拖拽 SHALL 继续，松手 SHALL 按落点提交；
- `Escape` 或 `pointercancel` SHALL 取消拖拽，且 SHALL NOT 改变页签顺序或格结构。

#### Scenario: 拖拽轨迹条跟随插入位置

- **WHEN** 用户按住一个页签横向移动超过 4px
- **THEN** 页签条内 SHALL 出现一条 4px 宽的强调色轨迹条，且其位置随指针在页签间的落点移动

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

进入沉浸模式后，顶栏与每格页签条 SHALL 在 300ms 内收拢至高度 0（SHALL NOT 以透明状态继续占位），正文 SHALL 随之上移。指针进入屏幕上缘 16px 热区并停留 400ms 后，应用 SHALL 显示一条悬浮页签条（`position: fixed`，含当前聚焦格的页签与「退出沉浸」入口）；指针离开热区与悬浮条 2s 后 SHALL 收起。

#### Scenario: 顶栏收纳为 0 高

- **WHEN** 用户进入沉浸模式并等待 300ms
- **THEN** 顶栏与页签条的计算高度 SHALL 为 0，正文区域顶部 SHALL 上移到窗口顶部

#### Scenario: 顶部热区唤出悬浮页签条

- **WHEN** 沉浸模式下指针移动到屏幕上缘 16px 内并停留 400ms
- **THEN** SHALL 出现 fixed 悬浮页签条，列出当前格的页签

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
