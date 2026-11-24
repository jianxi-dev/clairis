## MODIFIED Requirements

### Requirement: E-44 图片裁剪坐标系与保存可靠性

进入图片裁剪前 SHALL 等待图片加载完成（`img.complete` 或 load 事件），2s 超时 SHALL 放弃并提示，SHALL NOT 在 `scale <= 0` 时静默失败。框选、拖动与写回 SHALL 使用同一显示坐标系。编辑态已裁剪图片 SHALL 统一用「外盒 `overflow:hidden`（尺寸 = 可见裁剪显示尺寸）+ 内图按整图缩放平移」结构渲染；`width` 属性 SHALL 表示可见裁剪宽度，`scale` SHALL 等于 `width / cropWidth`；无 `width` 时 `scale` SHALL 由整图当前显示宽度与自然宽度之比求得。保存 SHALL 把显示矩形换算为原图像素矩形一次，并 SHALL 同步写回可见 `width/height`（取整），使确认前后显示宽高比严格为 1。保存 SHALL 同时由显式保存按钮与 window 级 `pointerup` 触发，SHALL NOT 依赖裁剪框存活；Esc SHALL 取消且不写回。

#### Scenario: 裁剪缩放不跳变

- **WHEN** 用户打开裁剪、拖动裁剪框后保存
- **THEN** 保存前后图片显示宽度的比值 SHALL 严格等于 1，裁剪框矩形与 `crop` 值 SHALL 一一对应

#### Scenario: 带 width 的图片确认后区域一致

- **WHEN** 对带 `{width=…}` 的图片拖出左上子区域并确认
- **THEN** 确认后 `img` 的可见宽高 SHALL 等于确认前裁剪盒的显示宽高（比值 1 ±0.02），显示内容区域 SHALL 与拖拽预览一致；`object-fit` SHALL 为 `none`，内图 SHALL 以 `scale` 缩放并以 `-left*scale / -top*scale` 平移

#### Scenario: 拖回整图恢复

- **WHEN** 用户把裁剪框拖回整图范围后确认
- **THEN** 源码 `crop` 属性 SHALL 被移除，图片显示 SHALL 恢复为裁剪前尺寸

#### Scenario: 保存不随裁剪框销毁丢失

- **WHEN** 用户在裁剪过程中触发一次装饰重建（裁剪框被销毁）后再松手
- **THEN** 裁剪结果 SHALL 仍被写回，源码 `crop` 属性 SHALL 等于最终显示矩形换算值；若最终取消则 SHALL NOT 残留裁剪框

### Requirement: E-48 高亮块三色

高亮块（callout）首行 SHALL 支持可选颜色属性 `{bg=<色名> border=<色名> text=<色名>}`，位于折叠标记之后、标题之前。属性顺序 SHALL 无关；未知色名 SHALL 被忽略并回落到该类型色调；未提供颜色的块 SHALL 回落到类型 tone。**标注**（13 个语义类型）SHALL 共享同一颜色编辑能力；**高亮**（纯高亮块）SHALL 使用独立色系：8 个色相（红 / 橙 / 黄 / 绿 / 青 / 蓝 / 紫 / 灰），每个色相提供浅填充与同色系深边框两档，色值取既有 `mdb-bg-*` token，不新增色值。

块族名 SHALL 二分为「高亮」与「标注」两项：**高亮** SHALL 为无左边框、无标题栏、1px 全边框、4px 圆角、强荧光叠底（`color-mix` 约 38%）的纯高亮块；**标注** SHALL 为带 3px 左边框与标题栏的 13 语义类型 callout。斜杠菜单、块菜单「转为」、转换手柄菜单与选区轮盘四处入口 SHALL 只呈现这两项。四个入口选「高亮」SHALL 直落 `> [!highlight]`；选「标注」SHALL 展开 13 个语义类型。`> [!highlight]` 的 markdown 序列化格式 SHALL 与既有 callout 一致。

纯高亮块的工具条 SHALL 水平居中于块盒（中心偏差 ≤ 2px）并使用荧光笔图标；标注块工具条位置与图标 SHALL 保持不变。纯高亮颜色面板 SHALL 使用独立色系，自上而下 SHALL 为：字体颜色（字母 A 色块，右上角「随机」）、边框颜色、填充颜色（浅色行 / 深色行）、恢复默认。「随机」SHALL 在一次事务内同时更换边框与填充、二者 SHALL 属同一色相族、文字色 SHALL 保持不变；「恢复默认」SHALL 清空三色属性。字体色色块 SHALL 使用字母「A」字形（`FormatColorTextOutlined`），SHALL NOT 使用荧光笔字形；标注类型 SHALL 按色相映射到目标类型可用色板。`text` 只作用于标题与正文，SHALL NOT 作用于链接、行内代码与 emoji；标注填充 SHALL 为软色。

转换手柄菜单中「高亮」SHALL 使用荧光笔图标、「标注」SHALL 使用 callout 图标，二者图标 SHALL 不同；「标注」展开的 13 类类型 SHALL 复用新增菜单的同一份图标（emoji）。新增手柄菜单中的标注项标签 SHALL 为「标注」，SHALL NOT 为「高亮」。

#### Scenario: 纯高亮与标注视觉不同

- **WHEN** 打开同时含 `> [!highlight]` 与 `> [!NOTE]` 的文档
- **THEN** 高亮块计算 `border-inline-start-width` SHALL 为 `0px`、`border-top-width` SHALL 为 `1px`、`border-radius` SHALL 为 `4px`、背景色不透明度 SHALL 高于标注；标注块 `border-inline-start-width` SHALL 为 `3px`

#### Scenario: 高亮工具条居中且为荧光笔

- **WHEN** 点击纯高亮块
- **THEN** 工具条水平中心与块盒水平中心偏差 SHALL ≤ 2px，按钮图标 SHALL 为荧光笔

#### Scenario: 随机同时换边框与填充

- **WHEN** 在纯高亮颜色面板点击「随机」
- **THEN** 首行 `bg` 与 `border` SHALL 同时改变且色相相同，`text` SHALL 保持不变；一次 ⌘Z SHALL 同时还原两项

#### Scenario: 恢复默认

- **WHEN** 在纯高亮颜色面板点击「恢复默认」
- **THEN** 首行属性块 SHALL 为空，颜色回落类型 tone

#### Scenario: 字体色恢复字母 A

- **WHEN** 打开块菜单颜色面板的字体色行
- **THEN** 每个色块内 SHALL 渲染字母 A 字形，SHALL NOT 渲染荧光笔字形；色块容器计算 `justify-content` SHALL 为 `center`

#### Scenario: 菜单图标分家与标注类型复用

- **WHEN** 打开块菜单「转为」网格与「标注」浮层
- **THEN** 高亮格与标注格图标 SHALL 不同；标注浮层 13 项的 emoji SHALL 与新增菜单对应项一致

#### Scenario: 新增菜单命名

- **WHEN** 打开新增手柄菜单
- **THEN** 标注项标签 SHALL 为「标注」，菜单中 SHALL NOT 出现标签为「高亮」的标注项

#### Scenario: 类型切换色相映射

- **WHEN** 用户把 NOTE 块的填充改为红色后切换到 TIP
- **THEN** 填充色相 SHALL 仍为红

## ADDED Requirements

### Requirement: E-51 IME 组合稳定性与大文档键入

编辑器装饰集 SHALL 始终与当前文档范围一致。IME 组合期间发生文档变更时，装饰集 SHALL 通过 `tr.changes` 映射后再返回，SHALL NOT 返回按旧文档计算的未映射集合。文档长度 ≥ 50,000 字符时，普通键入（`input.type` 且行数不变）SHALL 走映射快路径，并在最后一次键入后不超过 300ms 内补一次全量重建；结构变更、选区跳转、折叠切换与组合结束 SHALL 立即重建。键入路径 SHALL NOT 抛出异常、SHALL NOT 造成可见内容塌陷或媒体节点消失。

#### Scenario: 组合期不崩溃

- **WHEN** 在含图片 / 视频 / 高亮块的文档正文用 IME 连续输入
- **THEN** 页面 SHALL NOT 出现 `TypeError`/`RangeError`；`scrollHeight` 前后差 SHALL ≤ 5%；图片与视频节点数 SHALL NOT 减少

#### Scenario: 大文档键入不每键全量重建

- **WHEN** 在 ≥50,000 字符文档中连续键入 10 个字符
- **THEN** 每次键入 SHALL 以映射保持装饰有效，全量重建次数 SHALL ≤ 1（延迟补建）
