## MODIFIED Requirements

### Requirement: E-52 纯高亮预览与编辑同形

预览态渲染 `[!highlight]` SHALL 与编辑态同形：四边 1px 细边（计算 `border-inline-start-width: 1px`）、无标题栏（`.callout-title` 节点数为 0）、1px 全边框（`border-top-width: 1px`）、4px 圆角（`border-radius: 4px`）、强叠底（背景走 `--callout-bg`，缺省为荧光笔黄）。预览态 SHALL 输出类型 emoji（默认 `🖍️`；同一会话内改过 emoji 的块 SHALL 显示改后的 emoji）。纯高亮预览 SHALL NOT 渲染「纯高亮」字样。

标注（13 类）预览态标题未填写时 SHALL 只渲染 emoji、SHALL NOT 渲染默认名称（「注释 / 信息 / …」）；标题已填写时 SHALL 渲染所填标题。纯高亮预览 SHALL NOT 渲染任何标题行。

#### Scenario: 预览态纯高亮与编辑态同形

- **WHEN** 打开含 `> [!highlight]\n> 正文` 的文档并切到预览态
- **THEN** 预览 `.callout-mark` 计算 `border-inline-start-width` SHALL 为 `1px`、`border-top-width` SHALL 为 `1px`、`border-radius` SHALL 为 `4px`，`.callout-title` 节点数 SHALL 为 0，文本 SHALL NOT 含「纯高亮」

#### Scenario: 标注空标题不印默认名

- **WHEN** 打开含 `> [!NOTE]\n> 正文` 的文档并切到预览态
- **THEN** 预览 HTML SHALL NOT 含「注释」，`.callout-title` 节点数 SHALL 为 0，emoji SHALL 可见

#### Scenario: 标注有标题仍渲染

- **WHEN** 打开含 `> [!NOTE] 我的标题\n> 正文` 的文档并切到预览态
- **THEN** 预览 `.callout-title` 文本 SHALL 严格等于「我的标题」

#### Scenario: 会话内改 emoji 对预览可见

- **WHEN** 在编辑态把某高亮块的 emoji 改为 🚀，随后切到预览态
- **THEN** 预览对应块 SHALL 显示 🚀；未改过的块 SHALL 显示类型默认 emoji

## ADDED Requirements

### Requirement: E-55 预览块内源行换行保留

预览态纯高亮块与标注块 SHALL 保留块内每个源行的换行：相邻源行 SHALL 渲染为不同行（HTML `<br>` 分隔），SHALL NOT 合并为一行。列表、代码围栏等嵌套结构 SHALL NOT 被插入多余换行。

#### Scenario: 标注多行保留

- **WHEN** 打开 `> [!NOTE] 标题\n> 第一行\n> 第二行` 并切到预览态
- **THEN** 第一行与第二行 SHALL 分属两行（含 `<br>`），SHALL NOT 合并

#### Scenario: 纯高亮多行保留

- **WHEN** 打开 `> [!highlight]\n> A\n> B` 并切到预览态
- **THEN** A 与 B SHALL 分属两行

#### Scenario: 列表不被污染

- **WHEN** 标注正文含 `> - 甲\n> - 乙`
- **THEN** 列表项之间 SHALL NOT 出现 `<br>`（`</li><br>` 不得存在）

### Requirement: E-56 标注颜色面板几何与随机

标注块（13 类）颜色面板 SHALL 按字体色行定宽（计算宽 `246px`），字体行 SHALL 为 1 行 9 格；边框与填充各 16 格 SHALL 在面板内自动换行（各 2 行），SHALL NOT 溢出。面板头行 SHALL 提供「随机」按钮；点击 SHALL 在一次事务内同时把 `bg` 与 `border` 写成同一色名（软色），`text` SHALL 保持不变；面板 SHALL 保持打开；一次撤销 SHALL 同时还原两项。选色与随机后当前值色块 SHALL 原地刷新 `data-active`（SHALL NOT 重建面板）。

#### Scenario: 面板宽度与换行

- **WHEN** 打开标注颜色面板
- **THEN** 面板计算宽 SHALL 为 `246px`，字体行 1 行 9 格，边框/填充各 2 行 16 格

#### Scenario: 随机同色名

- **WHEN** 点击标注面板「随机」
- **THEN** 首行 SHALL 同时出现同名 `bg=` 与 `border=`，`text` 不变，面板仍可见，一次撤销同时还原
