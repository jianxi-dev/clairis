## MODIFIED Requirements

### Requirement: E-10 编辑器大纲浮层

编辑模式与预览模式 SHALL 在内容区右上角提供大纲入口；入口按钮的右缘 SHALL 与栏目头右侧操作区的右缘对齐（误差 ≤1px）。大纲入口按钮 SHALL 为 28×28 的方形圆角图形：未钉住态 SHALL NOT 绘制边框（计算 `border-width` 为 0），背景透明；钉住态 SHALL 显示 1px 细边框与强调色系背景。悬停 SHALL 展开浮层，点击按钮 SHALL 钉住，Esc 与点击浮层外部 SHALL 收起。浮层未钉住时 SHALL NOT 绘制边框；钉住态 SHALL 绘制 1px 细边框。浮层 SHALL 列出当前页签文档的全部 ATX 标题（`#`–`######`），SHALL 跳过围栏代码块（``` 与 ~~~，含未闭合围栏）内的行，并按层级缩进显示。文档不含任何 ATX 标题时 SHALL NOT 渲染大纲入口。

**层级标识**：每个大纲项 SHALL 持有层级标识节点（`H{n}` 徽标）；标识默认隐藏，仅鼠标悬入的那一项 SHALL 显示其标识，其余项标识 SHALL 保持隐藏。标识颜色 SHALL 取比次级文字色更浅一档的语义色（`docs/design/system/spec.md` §6），SHALL NOT 与标题文字抢眼。**拖动大纲条目时 SHALL 渲染插入位置指示条**（落点指示条，随指针位置实时移动，松手后消失），SHALL NOT 只渲染 ghost / 占位轨迹；松手后正文顺序 SHALL 按新大纲顺序同步（编辑/预览均生效），SHALL NOT 只改显示顺序而正文不动。点击大纲项 SHALL 把内容区滚动到对应标题：编辑/源码模式按文档行号定位并置于视口顶部，预览模式按标题元素滚到容器顶部。切换页签或编辑模式后，浮层 SHALL 只反映当前页签的标题。

#### Scenario: 大纲按钮与栏目操作区右缘对齐

- **WHEN** 测量大纲入口按钮右缘与栏目头「更多操作」按钮右缘
- **THEN** 两者差值 SHALL ≤1px

#### Scenario: 未钉住无边框

- **WHEN** 大纲未钉住
- **THEN** 按钮计算 `border-width` SHALL 为 0px，浮层计算 `border-width` SHALL 为 0px

#### Scenario: 钉住细边框

- **WHEN** 用户点击大纲按钮钉住
- **THEN** 按钮与浮层的计算 `border-width` SHALL 均为 1px

#### Scenario: 列出标题并跳过代码块

- **WHEN** 用户悬停大纲按钮，文档含 `# 第一章` 与一个包含 `# 代码里的井号` 的围栏代码块
- **THEN** 浮层 SHALL 只列出真实标题，不得出现代码块内的行

#### Scenario: 点击跳转

- **WHEN** 用户点击大纲里的第二个标题
- **THEN** 编辑区 SHALL 滚动到该标题行，且该行位于内容区顶部附近

#### Scenario: 同名标题

- **WHEN** 文档含两个文本相同的标题
- **THEN** 点击第二个大纲项 SHALL 跳到第二个标题，不得跳到第一个

#### Scenario: 多页签跟随

- **WHEN** 用户切换到另一篇文档
- **THEN** 大纲 SHALL 只列出新页签的标题

#### Scenario: 按钮形态与钉住底色

- **WHEN** 大纲按钮未钉住 / 已钉住
- **THEN** 未钉住时 SHALL 为透明底的方形圆角图形；钉住时 SHALL 显示背景色

#### Scenario: 钉住显示细边框

- **WHEN** 用户点击钉住大纲浮层
- **THEN** 浮层边框宽度 SHALL 为 1px

#### Scenario: 每项持有层级标识

- **WHEN** 文档含三个连续的同级二级标题
- **THEN** 每个大纲项 SHALL 各持有一个 `H2` 层级标识节点（共 3 个），SHALL NOT 只在首个项渲染

#### Scenario: 标识仅悬停项可见

- **WHEN** 用户未悬入任何大纲项
- **THEN** 可见的层级标识节点数 SHALL 为 0；鼠标悬入某一项后，仅该项标识 SHALL 可见

#### Scenario: 标识颜色更浅

- **WHEN** 用户查看层级标识
- **THEN** 其计算 `color` SHALL 等于 `docs/design/system/spec.md` §6 中比次级文字色更浅一档的语义色解析值，SHALL NOT 等于标题文字色

#### Scenario: 拖动出现插入位置指示条并同步正文

- **WHEN** 用户拖动一个大纲条目到新的层级位置
- **THEN** 拖动期间 SHALL 出现插入位置指示条并随指针移动；松手后指示条消失，正文顺序 SHALL 与新大纲顺序一致（状态往返可验证）
