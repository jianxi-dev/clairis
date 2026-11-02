# Design: 编辑态 = 预览态

> 本文件是显示契约 ADR。实现必须服从 D1–D5；偏离先改本文再改代码。

## D1 排版变量单一来源

**决定**：纸宽、行宽、字号、行高、标题色、阅读强调色全部来自 CSS 变量；编辑态与预览态由同一份 store 值注入。

- `--type-font-size` / `--type-measure` / `--type-measure-wide`：`config.readerFontSize` / `config.readerWidth`。
- `--heading-h1..h6`：`headingColors`。
- `--reader-accent` / `--reader-accent-soft`：`--tone-accent` 回落，与 `reader.css` 同值。

`ContentArea` 把变量写在 `.cm-editor-container` 上，`PreviewView` 写在 `.preview-content` 上；两个容器读同一组命名。

**理由**：两处各写一套数值必然漂移（上一轮就是编辑态写死 17px + 硬编码 hex）。

**失败后果**：用户改字号/行宽/标题色后只有一个模式变化，同貌契约当场失效。

## D2 基础扩展集显式声明

**决定**：编辑器基础能力用显式扩展集（折行 / 选区 / 历史 / 缩进 / 括号匹配 / 键位 / 查找），不装 `basicSetup`。

**理由**：`basicSetup` 带行号槽、折叠箭头、活动行高亮、自动补全，把文档编辑器渲染成代码面板。

**失败后果**：纸面出现 42px gutter 与折叠 chevron，正文左边缘与预览错开 42px。

## D3 高亮器只负责 token

**决定**：用 `classHighlighter`（输出 `.tok-*`，与预览的代码高亮共用一套 CSS），不用 `defaultHighlightStyle`。

**理由**：`defaultHighlightStyle` 给 `tags.heading` 输出 `text-decoration: underline; font-weight: bold`，是标题出现「红色下划线」的根因，且与 `.cm-heading` 的排版冲突。

**失败后果**：标题被同时染色、加粗、加下划线；改字号/字重都压不住高亮器的内联类。

## D4 块级行装饰的组合规则

**决定**：同一行可能命中多个块级装饰，必须有明确的抑制与合并规则：

1. **高亮块抑制引用**：`> [!TYPE]` 起始的块，其所有 `>` 行不生成引用装饰（否则卡片外套一层引用底）。
2. **引用按块成卡**：连续 `>` 行视为一个引用块，只有首行给上内边距与上圆角、末行给下内边距与下圆角，中间行只保留左右内边距。
3. **围栏标记行折叠**：非活跃代码块的开栏行与闭栏行高度归零（语言标签改为绝对定位），卡片内不再出现空白行。

**理由**：行级装饰没有容器概念，逐行加 padding 会把「一张卡片」变成「每行一张小卡片」。

**失败后果**：多行引用行距翻倍、高亮块双层背景、代码块上下各多一行空白——三者都是用户已经指出的「混乱」。

## D5 嵌套列表的缩进模型

**决定**：列表行允许行首缩进（2 或 4 空格），缩进计入装饰：标记（`- ` / `1. ` / `[ ]`）隐藏，行按深度获得额外 `padding-inline-start`（`cm-list-depth-1..3`）。

**理由**：当前正则要求标记紧贴行首，缩进行落回「普通行」，于是源码的 `- ` 原样显示且没有缩进——预览里是带项目符号的嵌套项。

**失败后果**：嵌套列表在编辑态变成一坨带 `-` 的纯文本。

## Verification

- `e2e/editor-display-parity.spec.ts`：纸面/字体/字号/标题色与预览逐项相等；无 gutter；标题无 `text-decoration`；多行引用高度接近预览；代码块卡内无空行；嵌套列表有深度类。
- 复杂交互（hover → 块菜单 → 斜杠 → 表格工具条）录屏留证。
- `bash scripts/verify.sh` 全绿。
