## MODIFIED Requirements

### Requirement: G-12 页面宽度四档与悬停弹窗

状态栏页面宽度控件 SHALL 提供 4 个档位：720 / 960 / 1080 / 1200（px）。控制器 SHALL 以 4 个色块表达档位，色块高度 SHALL 按档位递增（14 / 17 / 20 / 23 px），当前档位与其它档位 SHALL 有明显对比：选中色块填充不透明度 SHALL 为 1，未选中色块填充不透明度 SHALL ≤ 0.45。

宽度弹窗的进度条颜色 SHALL 与当前选中色块颜色一致，其余 3 档 SHALL 使用与选中色同色相的相近色；色值 SHALL 取设计系统语义色，SHALL NOT 新增色板。

指针进入宽度控件（按钮与弹窗的并集）SHALL 同时显示按钮与弹窗；指针离开该并集 200ms 后 SHALL 同时隐藏按钮与弹窗。按钮与弹窗之间的间隙 SHALL 由容器内边距桥接。`Esc` 与外部 `pointerdown` SHALL 关闭弹窗。设置页的宽度预设 SHALL 与状态栏一致（同为 4 档），默认值 SHALL 为 1080。

#### Scenario: 悬停同时显示按钮与弹窗

- **WHEN** 用户把指针移入状态栏页面宽度控件区域
- **THEN** 宽度按钮与档位弹窗 SHALL 同时可见
- **AND** 移出该区域 300ms 后两者 SHALL 都不可见

#### Scenario: 四档与高度递增

- **WHEN** 用户打开宽度弹窗
- **THEN** SHALL 恰有 4 个色块，其高度依次为 14 / 17 / 20 / 23 px

#### Scenario: 选中与未选中对比明显

- **WHEN** 当前档位为 1080
- **THEN** 该档色块填充的计算 `opacity` SHALL 为 1
- **AND** 其它三个色块填充的计算 `opacity` SHALL ≤ 0.45

#### Scenario: 悬停打开后可点击设档

- **WHEN** 用户悬停宽度控件使弹窗出现，并点击 1200 档色块
- **THEN** 正文最大宽度 SHALL 变为 1200px，且该档色块变为选中态

#### Scenario: 进度条与选中块同色

- **WHEN** 当前档位为 1080
- **THEN** 进度条计算色 SHALL 与该档色块计算色相等，其余 3 档 SHALL 为同色相相近色

### Requirement: G-12 分栏语义与分隔线独立性

- 拖动分隔线 SHALL 只改变该分支两侧的尺寸；树中其他分支的 `ratio` SHALL 保持不变。
- 页签右键「向右分栏」/「向下分栏」SHALL 新建一格并把该页签移入新格，新格 SHALL 获得焦点；原格 SHALL 不再保留该页签。
- 栏目「更多」菜单中的「右分」/「下分」SHALL 继续创建空分栏。
- 拖动页签跨格移动后，页签总数 SHALL 不变；文件已打开时拖入某格 SHALL NOT 复制文件，源格变空且非根时 SHALL 塌缩。
- 关闭页签或关闭格 SHALL 在任意栏数下生效；关闭后剩余分隔线 SHALL 仍可拖拽。
- 分栏之间的间隔线 SHALL 可见（最小 1px，取设计系统分隔线 token）；点击进入分栏栏目 SHALL 聚焦已有内容，SHALL NOT 重复显示同一段文字；栏目左上角无意义的小方框 SHALL 移除；栏目前 `+` 鼠标滑入 SHALL 保持可见并显示选择菜单。

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

#### Scenario: 间隔线可见

- **WHEN** 工作区含两个以上分栏
- **THEN** 分栏间隔线的计算 `width` SHALL ≥1px

#### Scenario: 进入分栏不重复显示

- **WHEN** 用户点击进入一个已有文字的分栏栏目
- **THEN** 栏目内容 SHALL 聚焦已有文字，重复文本节点数 SHALL 为 0

#### Scenario: 移除栏目左上角小方框

- **WHEN** 用户审查分栏栏目左上角
- **THEN** 无意义的小方框节点数 SHALL 为 0

#### Scenario: 栏目前加号滑入显示菜单

- **WHEN** 用户把指针滑入栏目前的 `+`
- **THEN** `+` SHALL 保持可见且选择菜单节点数 SHALL 为 1
