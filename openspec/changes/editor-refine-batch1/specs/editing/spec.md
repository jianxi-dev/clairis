## ADDED Requirements

### Requirement: 菜单快捷键列与圆角统一

块菜单、浮条、轮盘与文件名右键菜单的每一行 SHALL 在右侧显示该动作的可见快捷键区（kbd 样式）；无快捷键的动作该行右侧 SHALL 留白，SHALL NOT 只依赖悬停 `title` 呈现快捷键。全部菜单与浮窗容器圆角 SHALL 取菜单圆角 token，行圆角 SHALL 取行 token；文件名右键菜单 SHALL 接入同一 token，SHALL NOT 保留旧的小圆角字面量。

#### Scenario: 菜单行显示可见快捷键区

- **WHEN** 用户打开块菜单、浮条、轮盘或文件名右键菜单
- **THEN** 每个动作行右侧 SHALL 出现 kbd 样式的快捷键显示区；无快捷键的动作行右侧 SHALL 留白，SHALL NOT 出现占位文字

#### Scenario: 文件名右键菜单圆角与其它菜单一致

- **WHEN** 用户右键文件名打开右键菜单并读取菜单容器与行
- **THEN** 容器计算圆角 SHALL 等于菜单圆角 token，行计算圆角 SHALL 等于行圆角 token，且与块菜单容器圆角一致

#### Scenario: 悬停 title 与可见列并存

- **WHEN** 用户悬停一个既有悬停 `title` 的动作行
- **THEN** 可见快捷键区 SHALL 仍存在，悬停提示 SHALL NOT 取代可见列

### Requirement: 高亮块调色入口与高亮类型行

点击高亮块 SHALL 在其上方浮条出现颜色图标；点击该图标 SHALL 展开填充 / 边框 / 文字三色面板与「恢复默认」，并复用批次 3 已交付的三色面板与「一次改色一步撤销」。标注类子菜单（浮条 / 轮盘的高亮转换组）顶部 SHALL 新增「高亮类型」单行，展开既有类型预设（含「纯高亮」），选择即转换。

#### Scenario: 点击高亮块出现颜色入口

- **WHEN** 用户点击一个高亮块
- **THEN** 其上方浮条 SHALL 出现颜色图标；点击该图标 SHALL 展开三色面板，面板含填充 / 边框 / 文字三行与「恢复默认」

#### Scenario: 改色为一步撤销

- **WHEN** 用户在颜色面板中改动高亮块的填充色
- **THEN** 块计算样式随之变化，且按一次撤销 SHALL 只回退本次改色

#### Scenario: 高亮类型行位于顶部且含纯高亮

- **WHEN** 用户展开标注类子菜单
- **THEN** 「高亮类型」单行 SHALL 位于顶部，展开项 SHALL 含「纯高亮」，选择某类型后块类型 SHALL 转换

### Requirement: 豆包式行手柄层级联动转换

文本行块（段落 / 列表项 / 待办 / 标题 / 引用）的手柄 SHALL 按可视文本行显示，每行一个并随该行滚动跟随。上级行手柄触发转换时 SHALL 联同其下级子树一起转换；末级行手柄只转换当前行；联动转换时子级 SHALL 按自身层级的编号规则排号。有序 / 无序列表转高亮 SHALL 在列表外套高亮格式、列表行保持原标记。表格 / 代码块等非文本行块 SHALL NOT 产生行手柄。

#### Scenario: 每行一个手柄并跟行走

- **WHEN** 用户把指针移入一个多行文本行块
- **THEN** 该块每个可视文本行 SHALL 出现一个手柄，手柄垂直位置 SHALL 随所在行行盒移动

#### Scenario: 上级联动下级一起转换

- **WHEN** 用户对一个两层无序列表的上级行触发「转为有序」
- **THEN** 上级与下级 SHALL 一起转为有序；1 级与 2 级都显示有序编号，且 2 级按 2 级编号规则排号

#### Scenario: 末级行只转当前行

- **WHEN** 用户对一个无子级的末级行触发转换
- **THEN** 只有当前行转换，其兄弟行与上级行 SHALL 不变

#### Scenario: 列表转高亮保留列表格式

- **WHEN** 用户对一个有序或无序列表触发「转为高亮」
- **THEN** 列表体外层 SHALL 套上高亮格式，列表行 SHALL 保持原标记与结构

#### Scenario: 非文本行块不产生行手柄

- **WHEN** 用户把指针移入表格或代码块
- **THEN** 不产生行级手柄，仍按块显示手柄

### Requirement: 图片编辑 Quiet 对标

图片编辑态 SHALL 与 Quiet 对标：进入编辑时编辑图标 SHALL 呈选中态；编辑态图片 SHALL 保持原渲染尺寸，SHALL NOT 自动缩小；裁剪角标 SHALL 加大至明显可点；裁剪拖动柄 SHALL 使用裁剪样式图标；进入裁剪态 SHALL 常驻，单次拖动 SHALL NOT 弹回选中态；裁剪区下方 SHALL NOT 显示多余「保存」文字，保存 SHALL 走工具条既有入口；描述区 SHALL 默认隐藏、仅由工具条按钮控制显隐，裁剪态 SHALL 强制隐藏；含图片的文档中每张图片 SHALL 稳定出现手柄。

#### Scenario: 编辑图标选中态

- **WHEN** 用户进入图片编辑态
- **THEN** 编辑按钮 SHALL 呈选中态，且与未选中态有可测色差

#### Scenario: 编辑态图片不缩小

- **WHEN** 用户选中一张图片进入编辑态
- **THEN** 图片渲染宽度 SHALL 等于进入编辑前的宽度，SHALL NOT 自动缩小

#### Scenario: 裁剪角标加大与拖动柄图标

- **WHEN** 用户打开裁剪态
- **THEN** 角标尺寸 SHALL 大于既有默认值且命中区明显；拖动柄 SHALL 使用裁剪样式图标

#### Scenario: 裁剪态常驻

- **WHEN** 用户进入裁剪态后拖动裁剪边界一次
- **THEN** 裁剪态 SHALL 保持，SHALL NOT 弹回普通选中态

#### Scenario: 裁剪区下方无保存文字

- **WHEN** 用户进入裁剪态
- **THEN** 裁剪区下方 SHALL NOT 出现「保存」文字按钮；保存入口 SHALL 位于工具条

#### Scenario: 描述区默认隐藏与裁剪态强制隐藏

- **WHEN** 用户选中图片且不点击描述按钮，随后进入裁剪态
- **THEN** 描述区默认 SHALL 隐藏；点击工具条描述按钮 SHALL 切换显隐；裁剪态下描述区 SHALL 强制隐藏

#### Scenario: 图片手柄不缺失

- **WHEN** 用户打开含多张图片的文档并逐张把指针移到图片左侧召唤区
- **THEN** 每张图片 SHALL 出现手柄，SHALL NOT 出现偶发缺失

## MODIFIED Requirements

### Requirement: E-42 块手柄增量对账与块型图标

编辑态块手柄 SHALL 按「顶层块序号 + 块类型」键做增量对账：纯内容变更（键不变）SHALL 只重算几何、不重建手柄 DOM；插入/删除/类型变化 SHALL 只重建受影响块及其后的手柄。文本行块（段落 / 列表项 / 待办 / 标题 / 引用）SHALL 按可视文本行显示手柄，每行一个并随该行滚动跟随；非文本行块（表格 / 代码块 / mermaid / html 块）SHALL 保留块级手柄。手柄位置 SHALL 以对应行（行手柄）或块首行（块手柄）渲染元素的行盒为准，SHALL NOT 以多层 `coordsAtPos` 兜底作为主路径；块不在视口内时 SHALL NOT 渲染手柄。

每个块型 SHALL 映射到唯一的手柄图标：既有 `blockHandleIcon` / `BLOCK_ICON_NAME` 已按 heading 级别取 H1–H6、按有序 / 无序取**可区分**的有序编号图标与无序图标（有序 SHALL NOT 退化为无序图标）、按图片首行扩展名取 Video/Audio/Image；附件块 SHALL 按引用扩展名映射为附件类图标，SHALL NOT 沿用图片图标；本批 SHALL 为 `htmlBlock` 与 `yamlFrontMatter` 补齐明确条目，使其不再回退默认拖拽图标。表格与高亮块的手柄 SHALL 位于块左侧垂直居中，SHALL NOT 落在左上角。文档末尾 SHALL 提供不落盘的「+」入口，点击插入空段落并聚焦；该入口 SHALL NOT 写入文档、SHALL NOT 进入撤销历史。

#### Scenario: 输入后手柄贴住对应行且不重建

- **WHEN** 用户在一个多行文本行块中连续输入若干字符
- **THEN** 行手柄矩形上沿与该所在行行盒上沿的垂直偏差 SHALL ≤ 1px，且手柄根节点的 DOM 标识在输入前后保持不变

#### Scenario: 块型变化只重建受影响手柄

- **WHEN** 用户把一个段落转换为标题，再插入一个新段落
- **THEN** 仅该段落与受影响之后的节点被替换，其余手柄节点复用；文档中不被影响的块手柄数 SHALL 严格等于转换前减去受影响的数量

#### Scenario: 文末「+」插入段落

- **WHEN** 用户在文档最末块之后点击「+」入口
- **THEN** SHALL 新增一个空段落且光标落入其中，文档末尾严格等于「原末尾内容 + 一个空段」；按一次撤销后该空段消失

#### Scenario: 有序列表手柄图标可区分

- **WHEN** 用户把指针移到有序列表块与无序列表块的左侧召唤区
- **THEN** 两者的手柄 `data-icon` SHALL 分别为有序编号图标与无序图标，且严格不相等

#### Scenario: 附件手柄图标按扩展名

- **WHEN** 用户把指针移到附件块的左侧召唤区
- **THEN** 手柄图标 SHALL 按引用扩展名映射为附件类图标，SHALL NOT 等于图片图标

#### Scenario: 表格与高亮块手柄垂直居中

- **WHEN** 用户把指针移到表格块或高亮块的左侧召唤区
- **THEN** 手柄垂直中心与块渲染矩形垂直中心偏差 SHALL ≤ 2px，SHALL NOT 落在块左上角

### Requirement: E-50 附件卡与音频

非图片媒体文件引用 SHALL 渲染为附件卡，含类型图标、文件名与非空大小文本；点击附件卡 SHALL 用系统默认程序打开。音频引用 SHALL 渲染为 `<audio controls>`。pdf / md / html / web SHALL 保持内嵌 `fileEmbed`；其中 md 附件 SHALL 默认展开，宽度与正文同宽，高度随内容自适应且上限 600px，超出部分 SHALL 内部滚动并于底缘渐隐提示截断。md / docx 附件 SHALL 提供样式调整面板（对齐 + 宽度）；docx 附件 SHALL 提供显示位置（对齐）调整。附件引用行首出现前导空格时 SHALL NOT 使整块退化为源码。本要求 SHALL NOT 引入把附件复制进库的行为。

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
- **THEN** 面板 SHALL 提供对齐与宽度调整，调整后附件呈现随之变化

#### Scenario: docx 显示位置调整

- **WHEN** 用户选中 docx 附件并调整显示位置
- **THEN** 附件对齐 SHALL 随之变化

#### Scenario: 前导空格不退化

- **WHEN** 用户在附件引用行首添加前导空格
- **THEN** 该引用 SHALL 保持内嵌 / 卡片渲染，SHALL NOT 退化为源码文本
