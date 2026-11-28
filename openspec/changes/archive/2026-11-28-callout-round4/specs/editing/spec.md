## MODIFIED Requirements

### Requirement: E-48 高亮块三色

高亮块（callout）首行 SHALL 支持可选颜色属性 `{bg=<色名> border=<色名> text=<色名>}`，位于折叠标记之后、标题之前。属性顺序 SHALL 无关；未知色名 SHALL 被忽略并回落到该类型色调；未提供颜色的块 SHALL 回落到类型 tone。**标注**（13 个语义类型）SHALL 共享既有颜色编辑能力（9 格字体色 + 15 格背景色）；**高亮**（纯高亮块）SHALL 使用**独立 24 格色板**：字体 8 格 / 边框 8 格 / 填充 2×8 格（深档 8 + 中档 8），色值取豆包像素核准表（见下），SHALL NOT 复用 `mdb-bg-*` 文字背景板。旧色名（darkred / brown / olive / darkgreen / navy / indigo / slate / yellow / green / blue…）SHALL 在 `parseCalloutAttrs` 保留兼容映射，旧文档不失效。

**高亮 24 格色板（豆包像素核准，唯一真相源）**：

- 字体 8 格：默认 #ebebeb / 高对比：浅色主题 #111111 / 深色主题 #ffffff（`--hl-font-contrast`） / 红 #fa7873 / 橙 #f5a54a / 黄 #fcd456 / 绿 #6dd162 / 蓝 #71a0ff / 紫 #a472fc。
- 边框 8 格：无（斜线）#2d2d2d / 灰 #434343 / 红 #9e3836 / 橙 #bd7017 / 黄 #c7b302 / 绿 #339428 / 蓝 #2951a3 / 紫 #6532bd。
- 填充深档 8 格：无（斜线）#303031 / 深灰 #2b2b2b / 暗红 #4a1d1b / 暗橙 #57330a / 暗黄 #5c5514 / 暗绿 #1f471b / 暗蓝 #192a4c / 暗紫 #361d61。
- 填充中档 8 格：灰 #363636 / 灰 #3c3c3c / 红 #6b2827 / 橙 #845117 / 黄 #877b10 / 绿 #296b22 / 蓝 #213e78 / 紫 #4d2691。

块族名 SHALL 二分为「高亮」与「标注」两项：**高亮** SHALL 为无左边框、无标题栏、1px 全边框、4px 圆角、强叠底的纯高亮块；**标注** SHALL 为带 3px 左边框与标题栏的 13 语义类型 callout。斜杠菜单、块菜单「转为」、转换手柄菜单与选区轮盘四处入口 SHALL 只呈现这两项。四个入口选「高亮」SHALL 直落 `> [!highlight]`；选「标注」SHALL 展开 13 个语义类型。`> [!highlight]` 的 markdown 序列化格式 SHALL 与既有 callout 一致。

**高亮颜色面板** SHALL 使用独立 24 格色板，自上而下 SHALL 为：字体颜色（8 格，字母 A 色块，行尾「随机」）、边框颜色（8 格）、填充颜色深档（8 格）、填充颜色中档（8 格）、恢复默认。**每行 SHALL 严格 8 格且 `flex-wrap: nowrap`，SHALL NOT 换行**；色块计算尺寸 SHALL 为 `width: 22px` / `height: 20px`，行内 `gap` SHALL 为 `4px`，面板宽度 SHALL 保持 `216px`。当前值对应的色块 SHALL 带 `data-active` 选中态；选色或「随机」执行后，`data-active` SHALL 在原地面板内即时刷新到新值（SHALL NOT 重建面板、SHALL NOT 关闭面板）。**随机** SHALL 在一次事务内同时更换边框、填充与文字色；边框与填充 SHALL 属同一色相族；填充 SHALL 在所选色相的深档与中档之间各半随机。文字色 SHALL 从「默认文字 + 彩色字体色板」中排除当前值后选取：默认文字为继承主题前景的候选（`name` 为空，选中即删除 `text` 属性）；候选为「色相不同于填充且与填充对比度 ≥3」的颜色并按对比度加权随机（≥4.5 权重 3、否则 1），同色相候选 SHALL 仅在无更好候选时参与；均不可行时 SHALL 保持当前文字色；一次 ⌘Z SHALL 同时还原三项。**恢复默认** SHALL 清空三色属性。字体色色块 SHALL 使用字母「A」字形（`FormatColorTextOutlined`），SHALL NOT 使用荧光笔字形；块菜单「颜色」行图标 SHALL 同为 `FormatColorTextOutlined`（A 字形），SHALL NOT 使用 `FontcolorOutlined`。`text` 只作用于标题与正文，SHALL NOT 作用于链接、行内代码与 emoji；标注填充 SHALL 为软色。

**工具条（supersede 旧条款）**：纯高亮块与标注块的工具条 SHALL 均水平居中于块盒（中心偏差 ≤ 2px），两条工具条的颜色入口图标 SHALL 共用 `PaletteOutlined`（调色板图形）。旧条款「纯高亮块的工具条 SHALL 使用荧光笔图标；标注块工具条位置与图标 SHALL 保持不变」SHALL NOT 生效。块菜单「颜色」行 SHALL 保持 `FormatColorTextOutlined`（A 字形）。

**面板触发与关闭**：块上方居中调色板图标 SHALL 在**鼠标滑入（pointerenter）时即展开**面板，SHALL NOT 要求先点击一次。面板 SHALL 只由 ① 点击面板外部 ② 按 Esc 关闭；「随机」「选色」「恢复默认」执行后 SHALL NOT 关闭面板。

**空态高度**：空 `> [!highlight]` 块 SHALL NOT 塌陷成细条；单行内容高度 SHALL 约 3.2em（≈52px @16px），空块 `min-height` SHALL ≥ 44px 且点击空态 SHALL 落入内部输入区（textarea）而非卡片容器。空块 SHALL 保留左侧 emoji、SHALL NOT 显示类型名标题栏、SHALL 有 1px 全边框 + 圆角 + 填充。

转换手柄菜单中「高亮」SHALL 使用荧光笔图标、「标注」SHALL 使用 callout 图标，二者图标 SHALL 不同；「标注」展开的 13 类类型 SHALL 复用新增菜单的同一份图标（emoji）。新增手柄菜单中的标注项标签 SHALL 为「标注」，SHALL NOT 为「高亮」。

#### Scenario: 纯高亮无边框无标题栏

- **WHEN** 通过斜杠菜单选择「高亮」插入块
- **THEN** 块计算 `border-inline-start-width` SHALL 为 `0px`，块内 `.cm-callout-header` 节点数 SHALL 为 0，`border-top-width` SHALL 为 `1px`，`border-radius` SHALL 为 `4px`，页面 SHALL NOT 出现字符级 `==text==` 高亮渲染

#### Scenario: 菜单两项收敛

- **WHEN** 用户打开斜杠菜单「常用」段、块菜单「转为」网格、转换手柄「高亮」组或选区轮盘「转换 → 高亮」三层
- **THEN** 四处 SHALL 只出现「高亮」与「标注」两项，SHALL NOT 出现第三项；选「标注」SHALL 展开 13 个语义类型

#### Scenario: 旧语法保持不变

- **WHEN** 打开含 `> [!NOTE] 标题` 的文档
- **THEN** 渲染结果 SHALL 与本要求引入前字符差异数为 0，不出现属性块，仍归入「标注」

#### Scenario: 三色属性渲染

- **WHEN** 打开含 `> [!NOTE]{bg=green border=red text=gray} 标题` 的文档
- **THEN** 卡片背景 SHALL 为 green 的软色（`color-mix` ~10%），边框与文字色 SHALL 分别等于 red / gray 调色板 token，属性顺序改变后结果不变

#### Scenario: 类型转换保留属性与一步撤销

- **WHEN** 把 `{bg=green border=red text=gray}` 的 NOTE 块类型改为 TIP，随后按一次 ⌘Z
- **THEN** 属性块与折叠标记 SHALL 原样保留，撤销 SHALL 只回退最后一次操作，改色前状态完全还原

#### Scenario: 纯高亮预设

- **WHEN** 通过斜杠菜单选择「高亮」
- **THEN** 插入块 SHALL 为 `> [!highlight]`，无左边框与标题栏、1px 全边框、底色为荧光笔半透明黄；页面 SHALL NOT 出现字符级 `==text==` 高亮渲染

#### Scenario: 纯高亮与标注视觉不同

- **WHEN** 打开同时含 `> [!highlight]` 与 `> [!NOTE]` 的文档
- **THEN** 高亮块计算 `border-inline-start-width` SHALL 为 `0px`、`border-top-width` SHALL 为 `1px`、`border-radius` SHALL 为 `4px`、背景色不透明度 SHALL 高于标注；标注块 `border-inline-start-width` SHALL 为 `3px`

#### Scenario: 高亮工具条居中且为荧光笔

- **WHEN** 分别点击纯高亮块与标注块
- **THEN** 两条工具条水平中心与各自块盒水平中心偏差 SHALL ≤ 2px，两条工具条的颜色入口 `svg` 的 `data-icon` SHALL 均为 `PaletteOutlined`

#### Scenario: 24 格色板数量与排布

- **WHEN** 用户打开纯高亮颜色面板
- **THEN** 面板 SHALL 含 4 行色板，各行色块数 SHALL 依次为 8 / 8 / 8 / 8；每行计算 `flex-wrap` SHALL 为 `nowrap`，行内色块右缘 SHALL NOT 换行到第二行；色块色值 SHALL 等于本要求色板表

#### Scenario: 色块尺寸与间距

- **WHEN** 用户打开纯高亮颜色面板
- **THEN** 色块计算 `width` SHALL 为 `22px`、`height` SHALL 为 `20px`，行计算 `gap` SHALL 为 `4px`，面板计算 `width` SHALL 为 `216px`

#### Scenario: 当前值选中态

- **WHEN** 块首行含 `{bg=red border=red}` 时用户打开纯高亮颜色面板
- **THEN** 填充中档「红」与边框「红」两个色块 SHALL 带 `data-active` 选中态，其余色块 SHALL NOT

#### Scenario: 选色后选中态即时刷新

- **WHEN** 用户在纯高亮颜色面板点击另一个填充色块
- **THEN** 新值色块 `data-active` SHALL 变为 `true`、旧值色块 SHALL 变为 `false`，面板 SHALL 保持可见（SHALL NOT 重建、SHALL NOT 关闭）

#### Scenario: 随机同时换边框与填充

- **WHEN** 在纯高亮颜色面板点击「随机」
- **THEN** 首行 `bg`、`border` 与 `text` 三项同时变化，`text` 的文字名与原值不同且与填充对比度 ≥3，一次撤销三项还原；面板 SHALL 保持打开；刷新后 `bg` 与 `border` 对应色块 `data-active` SHALL 同时更新

#### Scenario: 选色与恢复默认不关闭

- **WHEN** 在纯高亮颜色面板点击一个色块，或点击「恢复默认」
- **THEN** 块颜色 SHALL 更新 / 三色属性清空，面板 SHALL 保持打开；按 Esc 或点击面板外部后 SHALL 关闭

#### Scenario: hover 即展开

- **WHEN** 用户把指针滑入纯高亮块上方居中的调色板图标（不点击）
- **THEN** 颜色面板 SHALL 展开；点击面板外部或按 Esc 后 SHALL 关闭

#### Scenario: 恢复默认

- **WHEN** 在纯高亮颜色面板点击「恢复默认」
- **THEN** 首行属性块 SHALL 为空，颜色回落类型 tone

#### Scenario: 字体色恢复字母 A

- **WHEN** 打开块菜单颜色面板的字体色行
- **THEN** 每个色块内 SHALL 渲染字母 A 字形，SHALL NOT 渲染荧光笔字形；色块容器计算 `justify-content` SHALL 为 `center`

#### Scenario: 颜色行图标为 A 字形

- **WHEN** 用户打开块菜单并查看「颜色」行
- **THEN** 该行图标 SHALL 为 `FormatColorTextOutlined`（A 字形），SHALL NOT 为 `FontcolorOutlined`

#### Scenario: 菜单图标分家与标注类型复用

- **WHEN** 打开块菜单「转为」网格与「标注」浮层
- **THEN** 高亮格与标注格图标 SHALL 不同；标注浮层 13 项的 emoji SHALL 与新增菜单对应项一致

#### Scenario: 新增菜单命名

- **WHEN** 打开新增手柄菜单
- **THEN** 标注项标签 SHALL 为「标注」，菜单中 SHALL NOT 出现标签为「高亮」的标注项

#### Scenario: 类型切换色相映射

- **WHEN** 用户把 NOTE 块的填充改为红色后切换到 TIP
- **THEN** 填充色相 SHALL 仍为红

#### Scenario: 转换菜单高亮直落 highlight

- **WHEN** 用户在转换手柄菜单点击「高亮」
- **THEN** 块首行 SHALL 变为 `> [!highlight]`，SHALL NOT 变为 `> [!NOTE]`

#### Scenario: 空高亮块不塌陷

- **WHEN** 用户插入一个空的 `> [!highlight]` 块
- **THEN** 块计算高度 SHALL ≥ 44px（单行内容时约 3.2em），SHALL NOT 呈现为一条细横线；点击块内空区 SHALL 落入内部输入区，块左侧 SHALL 显示 emoji，SHALL NOT 显示类型名标题栏

#### Scenario: 旧色名兼容

- **WHEN** 打开含 `> [!highlight]{bg=darkred border=brown}` 的旧文档
- **THEN** 块 SHALL 渲染出颜色（darkred → 暗红填充、brown → 暗橙填充），SHALL NOT 丢色

### Requirement: E-56 标注颜色面板几何与随机

标注块（13 类）颜色面板 SHALL 按字体色行定宽（计算宽 `246px`），字体行 SHALL 为 1 行 9 格；边框与填充各 16 格 SHALL 在面板内自动换行（各 2 行），SHALL NOT 溢出。面板头行 SHALL 提供「随机」按钮；点击 SHALL 在一次事务内同时写同名 `bg`/`border`，并按 10% 叠底后的实际底色、以与 E-48 相同的分级规则更换文字色（候选含「默认文字」，排除当前文字色，≥3 为下限）；均不可行时保持当前文字色；面板 SHALL 保持打开；一次撤销 SHALL 同时还原三项。选色与随机后当前值色块 SHALL 原地刷新 `data-active`（SHALL NOT 重建面板）。

#### Scenario: 面板宽度与换行

- **WHEN** 打开标注颜色面板
- **THEN** 面板计算宽 SHALL 为 `246px`，字体行 1 行 9 格，边框/填充各 2 行 16 格

#### Scenario: 随机同色名

- **WHEN** 点击标注面板「随机」
- **THEN** 首行 SHALL 同时出现同名 `bg=` 与 `border=`，`text` SHALL 按 10% 叠底后的实际底色、以与 E-48 相同的分级规则更换（候选含「默认文字」，排除当前文字色，≥3 为下限），均不可行时保持当前文字色，面板仍可见，一次撤销同时还原三项

## ADDED Requirements

### Requirement: E-59 相邻 callout 预览逐块渲染

源码中相邻的 `> [!TYPE]` 行（块与块之间没有空行）SHALL 在预览按块边界渲染为多张独立卡片；SHALL NOT 把后续 `[!TYPE]` 标记当正文并入上一张卡片。代码围栏（``` / ~~~）内的 `[!` 文本 SHALL NOT 触发拆分。非法类型行 SHALL 保持普通引用块，且不占卡片序号。

#### Scenario: 相邻三块

- **WHEN** 文档含三个相邻 callout 头且块间无空行
- **THEN** 预览渲染三张卡片，第二、三张的标记文本 SHALL NOT 出现在前一张正文中

#### Scenario: 围栏内不拆分

- **WHEN** 代码围栏内出现 `> [!TIP]` 文本
- **THEN** 该行 SHALL 保持代码内容，不新增卡片

### Requirement: E-60 callout emoji 持久化

编辑态选择的头部 emoji SHALL 写入首行属性块 `emoji=<字符>`；重开文档、预览与导出 SHALL 读取该属性并显示所选 emoji。改色与「恢复默认」SHALL 保留 `emoji` 键；恢复类型默认 emoji SHALL 删除该键。属性解析 SHALL 接受同一行的多个属性组并以后者覆盖（兼容历史脏数据），写回 SHALL 收敛为一个属性块。

#### Scenario: 重开仍生效

- **WHEN** 高亮块选择 emoji 后保存并重新打开同一内容
- **THEN** 编辑态头部与预览头部 SHALL 仍显示所选 emoji

#### Scenario: 改色不丢 emoji

- **WHEN** 带 `emoji=` 的块执行随机改色
- **THEN** 首行 SHALL 保留原 `emoji` 值
