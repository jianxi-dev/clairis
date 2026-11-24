## MODIFIED Requirements

### Requirement: E-48 高亮块三色

高亮块（callout）首行 SHALL 支持可选颜色属性 `{bg=<色名> border=<色名> text=<色名>}`，位于折叠标记之后、标题之前。属性顺序 SHALL 无关；未知色名 SHALL 被忽略并回落到该类型色调；未提供颜色的块 SHALL 回落到类型 tone。**标注**（13 个语义类型）SHALL 共享同一颜色编辑能力；**高亮**（纯高亮块）SHALL 只接受红 / 橙 / 黄 / 绿 / 蓝 / 紫六色相，色值取既有色板（`mdb-bg-*` / `mdb-color-*`），不新增色值。

块族名 SHALL 二分为「高亮」与「标注」两项：**高亮**为无左边框、无标题栏、圆角、荧光笔叠底的纯高亮块；**标注**为现行带左边框 / 标题栏的 13 语义类型 callout。斜杠菜单、块菜单「转为」、转换手柄菜单与选区轮盘四处入口 SHALL 只呈现这两项，SHALL NOT 出现第三项。四个入口选「高亮」SHALL 直落 `> [!highlight]`；选「标注」SHALL 展开 13 个语义类型。`> [!highlight]` 的 markdown 序列化格式 SHALL 与既有 callout 一致，SHALL NOT 引入新语法；旧文档的 13 类语义 callout 全部归入「标注」，行为不变。

颜色面板的字体色 / 边框色 / 填充色 / 高亮色 SHALL 统一使用形象图标（色块 + 荧光笔笔尖）并水平居中，SHALL NOT 使用字母「A」字形；高亮块工具条 SHALL NOT 再显示独立的类型切换图标（类型只在「标注」子菜单里选）。切换标注类型时 SHALL 按色相映射到目标类型可用色板，SHALL NOT 残留不适用颜色。`text` 只作用于标题与正文，SHALL NOT 作用于链接、行内代码与 emoji；填充 SHALL 为软色。

#### Scenario: 纯高亮无边框无标题栏

- **WHEN** 通过斜杠菜单选择「高亮」插入块
- **THEN** 块计算 `border-inline-start-width` SHALL 为 `0px`，块内 `.cm-callout-header` 节点数 SHALL 为 0，`border-radius` SHALL 为 `8px`，页面 SHALL NOT 出现字符级 `==text==` 高亮渲染

#### Scenario: 菜单两项收敛

- **WHEN** 用户打开斜杠菜单「常用」段、块菜单「转为」网格、转换手柄「高亮」组或选区轮盘「转换 → 高亮」三层
- **THEN** 四处 SHALL 只出现「高亮」与「标注」两项，SHALL NOT 出现第三项；选「标注」SHALL 展开 13 个语义类型

#### Scenario: 颜色面板无字母 A

- **WHEN** 用户打开颜色面板的字体色 / 边框色 / 填充色任一行
- **THEN** 色块内文本为 `A` 的节点数 SHALL 为 0，图标 SHALL 为色块 + 荧光笔，色块容器计算 `justify-content` SHALL 为 `center`

#### Scenario: 类型切换色相映射

- **WHEN** 用户把 NOTE 块的填充改为红色后切换到 TIP
- **THEN** 填充色相 SHALL 仍为红（按色相映射到目标类型可用色板），SHALL NOT 回落为默认色

#### Scenario: 旧语法保持不变

- **WHEN** 打开含 `> [!NOTE] 标题` 的文档
- **THEN** 渲染结果 SHALL 与本要求引入前字符差异数为 0，不出现属性块，颜色仍为类型 tone，块归入「标注」

#### Scenario: 三色属性渲染

- **WHEN** 打开含 `> [!NOTE]{bg=green border=red text=gray} 标题` 的文档
- **THEN** 卡片计算样式的背景 SHALL 为 green 的软色（`color-mix` ~10%），边框与文字色 SHALL 分别等于 red / gray 调色板 token，属性顺序改变后结果不变

#### Scenario: 类型转换保留属性与一步撤销

- **WHEN** 把 `{bg=green border=red text=gray}` 的 NOTE 块类型改为 TIP，随后按一次 ⌘Z
- **THEN** 属性块与折叠标记 SHALL 原样保留，撤销 SHALL 只回退最后一次改色，改色前状态完全还原

#### Scenario: 纯高亮预设

- **WHEN** 通过斜杠菜单选择「高亮」
- **THEN** 插入块 SHALL 为 `> [!highlight]`，无左右边框与标题栏、底色为荧光笔半透明黄；页面 SHALL NOT 出现字符级 `==text==` 高亮渲染

### Requirement: E-50 附件卡与音频

非图片媒体文件引用 SHALL 渲染为附件卡，含类型图标、文件名与非空大小文本；点击附件卡 SHALL 用系统默认程序打开。音频引用 SHALL 渲染为 `<audio controls>`。pdf / md / html / web SHALL 保持内嵌 `fileEmbed`；其中 md 附件 SHALL 默认展开，宽度与正文同宽，高度随内容自适应且上限 600px，超出部分 SHALL 内部滚动并于底缘渐隐提示截断。md / docx 附件 SHALL 提供样式调整面板（对齐 + 宽度）；docx 附件 SHALL 提供显示位置（对齐）调整。附件引用行首出现前导空格时 SHALL NOT 使整块退化为源码。本要求 SHALL NOT 引入把附件复制进库的行为。

内嵌文件卡 SHALL 提供三种显示方式：**卡片**（只显示头部：文件类型图标 + 文件名主标题 + 描述副标题）、**预览**（头部 + 限高内容）、**嵌入**（全尺寸内嵌）。工具条 SHALL 只含展开全屏、对齐（左 / 中 / 右）与三态切换，SHALL NOT 含下载、SHALL NOT 含宽窄 +/- 按钮；尺寸调整 SHALL 唯一由拖边框完成，写回 `{width=… height=…}` 属性语法。

嵌入 md 的排版 SHALL 与独立预览态逐项一致：字号取 `--type-font-size`（17px）、行高取 `--type-line`（1.78）、段距与标题间距取同一 `.preview-content` 规则；嵌入宿主 SHALL NOT 覆盖这些排版值。预览态对 md / pdf / html / 附件引用 SHALL 渲染真实内嵌内容或附件卡，SHALL NOT 输出 `naturalWidth === 0` 的 `<img>` 裂图占位。

#### Scenario: 内嵌文件卡三态

- **WHEN** 用户选中嵌入文件卡并点击工具条的「卡片」/「预览」/「嵌入」
- **THEN** 三种状态 SHALL 各自可见；「卡片」态 `.cm-embed-body` 计算 `display` SHALL 为 `none`，头部显示文件名与描述副标题；「预览」态 body 可见且高度 ≤ 上限；「嵌入」态 body 全尺寸显示

#### Scenario: 工具条无下载无宽窄

- **WHEN** 用户选中嵌入文件卡并打开工具条
- **THEN** 工具条按钮数 SHALL 为 7（展开全屏 + 左 / 中 / 右 + 卡片 / 预览 / 嵌入），含「下载」字样的按钮数 SHALL 为 0，含 +/- 的按钮数 SHALL 为 0

#### Scenario: 头部图标与描述

- **WHEN** 嵌入文件卡处于「卡片」态
- **THEN** 头部 SHALL 含文件类型图标节点、文件名主标题节点与描述副标题节点（有描述时），主标题文本 SHALL 严格等于文件名

#### Scenario: 拖边框写回尺寸

- **WHEN** 用户拖动嵌入文件卡边框超过 3px
- **THEN** 文档属性 `{width=…}` 或 `{height=…}` SHALL 随之变化

#### Scenario: 嵌入 md 排版保真

- **WHEN** 同一段落分别显示在嵌入 md 与独立预览态
- **THEN** 两者的计算 `font-size` SHALL 相等（17px）、`line-height` SHALL 相等（1.78）、段距 SHALL 相等

#### Scenario: 预览态嵌入可渲染

- **WHEN** 预览态打开含 md / pdf / html / 附件引用的文档
- **THEN** 嵌入区 `naturalWidth === 0` 的 `<img>` 节点数 SHALL 为 0，嵌入内容或附件卡节点数 SHALL ≥ 1

#### Scenario: 附件卡渲染与打开

- **WHEN** 打开含非图片文件引用的文档，并点击该附件卡
- **THEN** 正文 SHALL 出现一张附件卡（节点数为 1），图标按扩展名映射，大小文本非空；系统打开调用数 SHALL 为 1

#### Scenario: 音频内嵌播放

- **WHEN** 打开含音频引用的文档
- **THEN** 正文 SHALL 出现 `<audio>` 节点（节点数为 1）且不含「文件不存在」占位，点击控件可播放

#### Scenario: 内嵌文件不受影响

- **WHEN** 打开含 pdf / md / html / 网页引用的文档
- **THEN** 这些引用 SHALL 保持内嵌渲染，SHALL NOT 退化为附件卡；文档同目录内 SHALL NOT 新增附件副本

#### Scenario: md 附件默认展开与尺寸上限

- **WHEN** 打开含 md 附件引用的文档
- **THEN** md 附件 SHALL 默认展开，宽度 SHALL 与正文文本块同宽；高度 SHALL 随内容自适应且不超过 600px，超出部分 SHALL 可内部滚动，底缘 SHALL 有渐隐提示

#### Scenario: md 与 docx 样式调整面板

- **WHEN** 用户选中 md 或 docx 附件并打开样式调整面板
- **THEN** 面板 SHALL 提供对齐（左 / 中 / 右）与三态切换；宽度调整 SHALL 只由拖边框完成，面板 SHALL NOT 含 +/- 按钮

#### Scenario: docx 显示位置调整

- **WHEN** 用户选中 docx 附件并调整显示位置
- **THEN** 附件对齐 SHALL 随之变化，写回 `align` 属性并在预览态保持一致

#### Scenario: 前导空格不退化

- **WHEN** 用户在附件引用行首添加前导空格
- **THEN** 该引用 SHALL 保持内嵌 / 卡片渲染，SHALL NOT 退化为源码文本
