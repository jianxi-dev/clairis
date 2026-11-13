## ADDED Requirements

### Requirement: E-23 块宽度统一

预览态引用块的文字列宽度 SHALL 与正文段落相同；编辑态引用块与围栏代码块的文字列宽度 SHALL 与普通正文行相同。宽度补偿 SHALL 通过调整块自身最大宽度实现，SHALL NOT 改动 `.cm-line` 的基础 1080px 行宽。

#### Scenario: 预览引用块与段落等宽

- **WHEN** 用户打开一份含引用块与段落的文档并进入预览态
- **THEN** 引用块文字列的宽度与相邻段落文字列宽度差 SHALL 为 0px

#### Scenario: 编辑态引用块与正文等宽

- **WHEN** 用户在同一文档进入编辑态
- **THEN** `.cm-line.cm-quote` 的文字列宽度与普通 `.cm-line` 文字列宽度差 SHALL 为 0px

#### Scenario: 编辑态代码块与正文等宽

- **WHEN** 文档含围栏代码块且光标不在块内
- **THEN** `.cm-line.cm-fenced-code` 的文字列宽度与普通 `.cm-line` 文字列宽度差 SHALL 为 0px

### Requirement: E-24 编辑态公式与代码高亮

编辑态 SHALL 显示行内公式与块级公式的排版结果，光标进入公式块时 SHALL 显示源码。编辑态围栏代码块 SHALL 按围栏语言做语法高亮，SHALL 复用预览态的语言别名表。

#### Scenario: 非活跃公式出排版

- **WHEN** 用户打开含 `$E=mc^2$` 与 `$$\\int_0^1 x dx$$` 的文档且光标不在公式内
- **THEN** 编辑态 `.katex` 节点数 SHALL 为 2

#### Scenario: 进入公式块显示源码

- **WHEN** 用户把光标移入块级公式
- **THEN** 该块 SHALL 显示 `$$` 源码，其它公式 SHALL 仍为排版态

#### Scenario: 围栏代码有 token

- **WHEN** 文档含 ` ```js ` 围栏且光标在块外
- **THEN** 围栏内 `.tok-keyword` 节点数 SHALL 大于 0

### Requirement: E-25 转换手柄菜单稳定与拖块

转换手柄菜单 SHALL 在指针从父菜单移入子菜单再移回父菜单时保持打开。图片块与表格块的转换菜单 SHALL 以指针所在手柄为纵向锚点，菜单垂直中心与手柄中心偏差 SHALL 不超过 2px。按住转换手柄拖动时 SHALL 显示落点插入指示，松手后块 SHALL 移动到目标位置。

#### Scenario: 回移不关闭

- **WHEN** 用户悬停「在下方添加」展开子菜单，再把指针上移回父菜单并停留 300ms
- **THEN** 转换菜单节点数 SHALL 等于 1

#### Scenario: 图片菜单跟随手柄

- **WHEN** 用户打开图片块的转换菜单
- **THEN** 菜单垂直中心与手柄中心偏差 SHALL 不超过 2px

#### Scenario: 拖块有落点指示

- **WHEN** 用户按住第 3 段手柄拖到第 1 段上方
- **THEN** 拖拽期间插入指示线节点数 SHALL 等于 1，松手后该段落顺序 SHALL 变化且源位置不再含该段落

### Requirement: E-26 插入菜单表格与分栏

插入菜单的表格选择器 SHALL 在指针滑入任意格时选中「左上第一格到指针格」的完整矩形，滑动过程 SHALL 不重建网格。分栏入口 SHALL 渲染 5 个横向等宽单元，指针自左向右滑入即选中，单击 SHALL 插入对应栏数。

#### Scenario: 滑入选中矩形

- **WHEN** 用户把指针滑到表格网格第 3 行第 4 列
- **THEN** 处于选中态的格子数 SHALL 为 12

#### Scenario: 回滑收缩矩形

- **WHEN** 用户从第 3 行第 4 列直接滑回第 1 行第 1 列
- **THEN** 处于选中态的格子数 SHALL 为 1

#### Scenario: 分栏横向选择

- **WHEN** 用户展开分栏菜单并把指针从左滑到第 4 个单元
- **THEN** 横向单元数 SHALL 为 5，高亮单元数 SHALL 为 1 且为第 4 个

#### Scenario: 单击插入分栏

- **WHEN** 用户单击第 4 个分栏单元
- **THEN** 文档 SHALL 插入 `::: {.col-4}` 围栏，浮层 SHALL 关闭且无残留

### Requirement: E-27 图片描述行

图片工具条的描述入口 SHALL 在图片下方展开可编辑输入框，SHALL NOT 插入引用块。提交后描述 SHALL 写入图片属性并在重新打开文档时回显；已有描述时再次点击 SHALL 进入编辑并回填原值。描述入口图标 SHALL 为「文本+笔」。

#### Scenario: 描述入口展开输入

- **WHEN** 用户选中图片并点击描述入口
- **THEN** 图片下方 SHALL 出现输入框，文档 SHALL NOT 新增 `> 评论：` 行

#### Scenario: 提交后回显

- **WHEN** 用户输入「示意图」并提交，随后重新打开该文档
- **THEN** 图片属性 SHALL 含「示意图」，描述行 SHALL 显示该文字

#### Scenario: 已有描述可再编辑

- **WHEN** 用户对已有描述的图片再次点击描述入口
- **THEN** 输入框 SHALL 出现且值为「示意图」

### Requirement: E-28 图片裁剪正确性

裁剪写回 SHALL 清除图片尾部所有旧宽度注释（含 `-->` 与 `—>` 变体），SHALL NOT 在正文留下字面注释。裁剪 SHALL 支持八个控制点，每点 SHALL 显示裁剪标识与对应方向光标。拖动左/上边界时裁剪框的变化方向 SHALL 与指针方向一致。裁剪浮层内拖动矩形本体 SHALL 平移整个裁剪区域，再次保存 SHALL 使用新矩形。

#### Scenario: 不再泄漏旧注释

- **WHEN** 用户对带 `<!--w=811—>` 尾注的图片裁剪并保存
- **THEN** 编辑态可见文本 SHALL NOT 含 `<!--w=`，图片下方空白高度 SHALL 不超过 8px

#### Scenario: 左上方向正确

- **WHEN** 用户拖动裁剪框左上角向右下移动
- **THEN** 裁剪宽度 SHALL 变小，方向与指针一致

#### Scenario: 控制点有裁剪语义

- **WHEN** 用户打开裁剪浮层
- **THEN** 至少 6 个控制点的计算 `cursor` SHALL 为 `nwse-resize` / `nesw-resize` / `ew-resize` / `ns-resize` 之一，且每点显示裁剪角标

#### Scenario: 二次裁剪按新矩形保存

- **WHEN** 用户再次打开裁剪、拖动矩形本体后保存
- **THEN** 文档中的 crop 值 SHALL 等于新矩形，图片可见区域 SHALL 随之变化

### Requirement: E-29 图片对齐与缩放锚点

编辑态图片 SHALL 按对齐属性渲染，新插入图片默认居中；工具条 SHALL 以激活态标示当前对齐。选中图片后拖动角部锚点 SHALL 调整尺寸，SHALL NOT 进入裁剪。

#### Scenario: 默认居中

- **WHEN** 用户新插入一张图片
- **THEN** 容器 `text-align` SHALL 为 `center`，工具条居中按钮 `aria-pressed` SHALL 为 `true`

#### Scenario: 对齐态切换

- **WHEN** 用户把图片改为左对齐
- **THEN** 仅左对齐按钮 `aria-pressed` SHALL 为 `true`

#### Scenario: 已裁剪图拖锚点缩放

- **WHEN** 用户选中已裁剪图片并拖动角部锚点
- **THEN** 裁剪浮层节点数 SHALL 为 0，图片宽高 SHALL 变化

### Requirement: E-30 图片预览浮层

双击图片打开的预览浮层 SHALL 支持滚轮缩放到 1–8 倍、放大后拖动平移、双指捏合、90° 步进旋转、下载与恢复原始尺寸。

#### Scenario: 滚轮放大

- **WHEN** 用户在预览浮层内向上滚动滚轮
- **THEN** 图片 `scale` SHALL 大于 1

#### Scenario: 放大后平移

- **WHEN** 用户在放大状态下拖动图片
- **THEN** 平移量 SHALL 变化且不超出图片边界

#### Scenario: 旋转与复位

- **WHEN** 用户点一次旋转，再点恢复原始尺寸
- **THEN** 旋转后角度 SHALL 为 90°，复位后 `scale` SHALL 为 1

#### Scenario: 下载与关闭

- **WHEN** 用户点下载，再按 Esc
- **THEN** 下载 SHALL 触发 1 次，浮层 SHALL 关闭且无残留节点

### Requirement: E-31 块菜单与任务图标

编辑态任务列表的复选框 SHALL 为方框内打勾样式，圆角 SHALL 为 3px。图片块的转换菜单 SHALL 依序显示「对齐与缩进、剪切、复制、删除」，移除上移/下移。

#### Scenario: 任务复选框是方框

- **WHEN** 用户打开含任务列表的文档
- **THEN** `.cm-task-checkbox` 的 `border-radius` SHALL 为 3px，未选中态 SHALL 显示方框

#### Scenario: 图片菜单顺序

- **WHEN** 用户打开图片块的转换菜单
- **THEN** 菜单文本顺序 SHALL 为 对齐与缩进、剪切、复制、删除，SHALL NOT 含上移/下移
