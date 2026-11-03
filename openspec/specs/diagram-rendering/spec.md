# diagram-rendering Specification

## Purpose
TBD - created by archiving change diagram-engine-pele. Update Purpose after archive.
## Requirements
### Requirement: D-1 图表同步出图

引擎就绪后，单个 ` ```mermaid ` 块的渲染 SHALL 在一次同步调用内完成并产出 `<svg>`，SHALL NOT 让读者先看到源码块再跳变成图。同一份文档里的多个图块 SHALL 使用同一个已就绪引擎实例，SHALL NOT 为每个块重复加载。

#### Scenario: 引擎就绪后同步出图

- **WHEN** 图表引擎已加载，文档包含一个合法 mermaid 块
- **THEN** 调用渲染入口后，同一调用栈内 `.mermaid-view` SHALL 已包含 `<svg>`，且源码块 SHALL 被隐藏

#### Scenario: 多个图块共用引擎

- **WHEN** 同一文档包含三个 mermaid 块
- **THEN** 三个块 SHALL 都产出 `<svg>`，引擎模块 SHALL 只被加载一次

### Requirement: D-2 主题跟随 CSS 变量

图 SHALL 从 CSS 变量读取背景、文字、线条、强调色、字体与圆角，SHALL NOT 由脚本写入固定色值。深浅色切换 SHALL 仅靠变量生效，SHALL NOT 触发重新渲染。

#### Scenario: 切换深色不重渲

- **WHEN** 用户把根节点切到深色主题
- **THEN** 图中的颜色 SHALL 变为深色对应的值，图的 `<svg>` 节点 SHALL NOT 被替换或重新插入

#### Scenario: 主题 token 覆盖生效

- **WHEN** 用户通过主题配置覆盖强调色
- **THEN** 图中的强调色元素 SHALL 跟随新值，无需重新打开文档

### Requirement: D-3 能力开关语义

关闭「图表水合」SHALL 移除已渲染的 `<svg>` 并让源码块可见；重新开启 SHALL 恢复出图。开关切换 SHALL 幂等：重复同一状态 SHALL NOT 产生重复 DOM 或重复监听。关闭能力 SHALL NOT 删除文档内容或源码文本。

#### Scenario: 关闭后显示源码

- **WHEN** 用户关闭「图表水合」
- **THEN** 文档中不再有图表 `<svg>`，源码块 SHALL 可见且内容与原文一致

#### Scenario: 重新开启不重复挂载

- **WHEN** 用户关闭后再开启「图表水合」
- **THEN** 每个图块 SHALL 只有一个图表容器，SHALL NOT 出现重复 `<svg>`

### Requirement: D-4 错误降级

图表源码无法解析或渲染失败时，系统 SHALL 保留源码块可见并给出错误提示，SHALL NOT 移除该块、SHALL NOT 阻断同文档其它图块的渲染，SHALL NOT 抛到 UI 层导致整页失败。

#### Scenario: 语法错误保留源码

- **WHEN** 一个 mermaid 块包含非法语法，同文档另一个块合法
- **THEN** 非法块 SHALL 显示源码与错误提示，合法块 SHALL 正常出图

### Requirement: D-5 链接与图片协议白名单

图中的链接 SHALL 只允许 `http`、`https`、`mailto`、`tel` 与相对地址；图中图片 SHALL 额外允许 `asset`、`media` 两个应用内协议。其它协议（含 `javascript`、`file`、`data`）SHALL 被丢弃，且 SHALL NOT 让整个图渲染失败。

#### Scenario: 本地图片可显示

- **WHEN** 图节点引用 `asset:` 或 `media:` 协议的图片
- **THEN** 该图片 SHALL 出现在图中，SHALL NOT 被剥成空 `src`

#### Scenario: 危险协议被丢弃

- **WHEN** 图节点链接指向 `javascript:` 或 `file:` 地址
- **THEN** 该地址 SHALL NOT 出现在产出的 SVG 中，图其余部分 SHALL 正常渲染

### Requirement: D-6 编辑态两态与无残留

编辑态中，非活跃 mermaid 块 SHALL 显示渲染后的图；光标进入该块时 SHALL 显示原始围栏源码并可编辑。块被移出视口、被剪切或页签切换后，系统 SHALL NOT 残留观察者或重复 DOM。

#### Scenario: 进入块显示源码

- **WHEN** 用户把光标移入一个 mermaid 块
- **THEN** 该块 SHALL 显示 ` ```mermaid ` 原始围栏，其它非活跃块 SHALL 仍显示图

#### Scenario: 反复切换不叠加

- **WHEN** 用户在同一文档内反复进入、离开同一 mermaid 块
- **THEN** 块内图表容器 SHALL 始终只有一个，SHALL NOT 出现叠加的 `<svg>`

### Requirement: D-7 中文标签不溢出

图节点的标签宽度 SHALL 按实际字体测量；含中文的标签 SHALL NOT 溢出节点边框或与相邻元素重叠。

#### Scenario: 中文标签排版

- **WHEN** 文档包含一个节点标签为中文的流程图
- **THEN** 标签文本 SHALL 位于节点边框内，SHALL NOT 出现横向溢出

