## ADDED Requirements

### Requirement: E-48 高亮块三色

高亮块（callout）首行 SHALL 支持可选颜色属性 `{bg=<色名> border=<色名> text=<色名>}`，位于折叠标记之后、标题之前。属性顺序 SHALL 无关；未知色名 SHALL 被忽略并回落到该类型色调；未提供颜色的块 SHALL 回落到类型 tone。全部 13 个语义类型 SHALL 共享同一颜色编辑能力。颜色面板 SHALL 提供字体颜色（默认 + 8）、边框颜色（无 + 15）、填充颜色（无 + 15）三行与「恢复默认」，点击已选颜色 SHALL 清除该项。一次改色 SHALL 为一步撤销。块族名 SHALL 统一为「高亮」，并新增第 14 预设「纯高亮」。`text` 只作用于标题与正文，SHALL NOT 作用于链接、行内代码与 emoji；填充 SHALL 为软色。

#### Scenario: 旧语法保持不变

- **WHEN** 打开含 `> [!NOTE] 标题` 的文档
- **THEN** 渲染结果 SHALL 与本要求引入前字符差异数为 0，不出现属性块，颜色仍为类型 tone

#### Scenario: 三色属性渲染

- **WHEN** 打开含 `> [!NOTE]{bg=green border=red text=gray} 标题` 的文档
- **THEN** 卡片计算样式的背景 SHALL 为 green 的软色（`color-mix` ~10%），边框与文字色 SHALL 分别等于 red / gray 调色板 token，属性顺序改变后结果不变

#### Scenario: 类型转换保留属性与一步撤销

- **WHEN** 把 `{bg=green border=red text=gray}` 的 NOTE 块类型改为 TIP，随后按一次 ⌘Z
- **THEN** 属性块与折叠标记 SHALL 原样保留，撤销 SHALL 只回退最后一次改色，改色前状态完全还原

#### Scenario: 纯高亮预设

- **WHEN** 通过斜杠菜单选择「纯高亮」
- **THEN** 预设标签 SHALL 严格等于「纯高亮」，默认颜色为黄底黄边，且页面 SHALL NOT 出现字符级 `==text==` 高亮渲染

### Requirement: E-49 公式编辑体验

点击公式 SHALL 打开锚定在下方的源码浮层，并实时渲染 KaTeX 预览；Esc 或点击外部 SHALL 提交且正文无定界符残留。键入闭合的 `$…$` SHALL 立即渲染。display 判定 SHALL 在 tex 含换行、含 `\tag` 或以 `\begin{equation|align|gather|split|alignat|CD}` 开头时为块级；`\begin{align*}` SHALL NOT 视为块级。空公式 SHALL 显示「添加 LaTeX 公式」占位；渲染失败 SHALL 显示「无效公式」与警告图标，且无渲染残渣。

#### Scenario: 点击打开源码浮层

- **WHEN** 点击正文中的公式
- **THEN** 公式下方 SHALL 出现源码浮层（节点数为 1），输入过程中预览实时更新；按 Esc 或点击外部后浮层关闭、源码保留、正文不含残留 `$` 定界符

#### Scenario: display 判定

- **WHEN** 公式 tex 含换行，或以 `\begin{align}` / `\begin{equation}` 开头
- **THEN** 该公式 SHALL 按块级渲染；tex 为 `\begin{align*}` 时 SHALL NOT 带块级外框

#### Scenario: 空与无效占位

- **WHEN** 公式源码为空，或 KaTeX 渲染失败
- **THEN** 分别 SHALL 显示「添加 LaTeX 公式」与「无效公式」（占位文本数为 1），且页面不含 `.katex-error` 或半渲染残渣

### Requirement: E-50 附件卡与音频

非图片媒体文件引用 SHALL 渲染为附件卡，含类型图标、文件名与非空大小文本；点击附件卡 SHALL 用系统默认程序打开。音频引用 SHALL 渲染为 `<audio controls>`。pdf / md / html / web SHALL 保持内嵌 `fileEmbed`。本要求 SHALL NOT 引入把附件复制进库的行为。

#### Scenario: 附件卡渲染与打开

- **WHEN** 打开含非图片文件引用的文档，并点击该附件卡
- **THEN** 正文 SHALL 出现一张附件卡（节点数为 1），图标按扩展名映射，大小文本非空；系统打开调用数 SHALL 为 1

#### Scenario: 音频内嵌播放

- **WHEN** 打开含音频引用的文档
- **THEN** 正文 SHALL 出现 `<audio>` 节点（节点数为 1）且不含「文件不存在」占位，点击控件可播放

#### Scenario: 内嵌文件不受影响

- **WHEN** 打开含 pdf / md / html / 网页引用的文档
- **THEN** 这些引用 SHALL 保持内嵌渲染，SHALL NOT 退化为附件卡；文档同目录内 SHALL NOT 新增附件副本
