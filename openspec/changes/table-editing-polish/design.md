# Design: table-editing-polish（MD 编辑态表格与斜杠菜单交互改进）

## 1. 现状勘察（代码实读，2026-11-13）

调查记录：spec issue #738 Further Notes；两轮代码实读（table.ts 1605 行、slash.ts ~2000 行、columns.ts、callout.ts、callout-insert.ts、editor.css）。

| 观测项 | 实测值 | 结论 |
|---|---|---|
| 单元格手柄 CSS | `top:2px; left:2px; 16×16; border-radius:var(--app-radius)=6px` | 钉左上角、圆角过大 |
| 手柄图标 | 空=AddOutlined、非空=DataSheetOutlined | 两套图标并存 |
| 表头手柄 | `.cm-table th:hover .cm-table-cell-handle` 与 td 同规则 | 表头也出手柄 |
| 单元格菜单 | `openInsertMenu` anchor 触发只列 `inline:true`，现仅图片/媒体引用 2 项 | 菜单近乎空 + 被裁剪 |
| 菜单裁剪 | 菜单 absolute 挂 `view.dom`；夹取 bounds 用 `view.dom`，注释却说该用 `.cm-editor` | 基准不一致 → 显示不全 |
| 单元格 "/" | input 事件仅「末尾 /」触发，删字符后开菜单，随后 `view.focus()` 抢焦点、input teardown | 后续按键落 CM6 文档 → 累积多个 "/" |
| "/" 累积 | `insertSlashChar` 菜单已开→关闭并默认插入；词首判定失败→继续默认插入 | 4 个 "/" 的机制 |
| 插入落点 | slash 触发用 `[slashPos, head]` 文档位置；anchor 触发才用 `cell.from` 零宽 | 表外插入 = 文档级路径误触发 |
| 分栏 | `columns.ts` textarea 无任何 "/" 接线 | 完全缺失 |
| 高亮块 | 正文 textarea 挂独立 `CALLOUT_SNIPPETS` 菜单；标题 input 无菜单 | 不走统一注册表 |
| 死代码 | `endOfTableBlock`、`slashMenuRequest`、`openSlashMenuAt` 无调用方 | 清理 |
| 边界热点 | 圆点为全角"＋"文本、`border-radius:50%`，热点在边界内侧 inset 8px，气泡含插入/删除 | 形态与用户预期不符 |

## 2. 决策

- **D1 单元格手柄**：统一一种图标（表格图标 DataSheet，与块手柄同款），不再按空/非空切换；纵向居中（`top:50%; translateY(-50%)`）、横向贴单元格左边框线外侧（负偏移至手柄整体位于边框线外，实现值 -19px）；`th` 不渲染手柄（`buildCell` 按是否表头跳过）；圆角 `3px`（单点视觉裁决，落 `docs/design/system/decisions.md` 台账）。空单元格插入路径由统一 "/" 菜单承担（由 3.1/6.1 落地）。
- **D2 行/列插入圆点**：替换现行「边界内侧热点」形态——列点坐落上边框**外**（`top` 为负，x=相邻两列中点；含首列前与尾列后追加点，共 n+1），行点坐落左边框**外**（`left` 为负，y=相邻两行中点；含表头分隔线与尾行下追加点，共 rows+1）。默认形态小圆点（8px、`border-radius:50%`、背景边框色）；悬停圆点变为现行 "+" 图标热点（16px 白字 accent 底，即 hotspot-active 形态）；**悬停圆点即展开现行气泡**（插入/删除两键，#483 保活语义保留）——用户原文「点击进行插入行和删除行操作」的「点击」落在气泡键上；圆点按压本身只隔离不插入。离指针最近的 2px 边界线保留点亮作为插入位置反馈（继承 #385a/#432 交互，圆点显隐与线显隐解耦）。插入/删除语义沿用现有 splice 逻辑不动。滑入表格即显示全部圆点（替代现行「最近边界点亮」的圆点显隐），滑出隐藏。
- **D3 菜单定位与裁剪**：上下文触发（cell/container）菜单定位一律用**触发控件的 `getBoundingClientRect()`**（整块 widget 的文档坐标会返回块盒，必然错位）；`applyPlacement` 夹取 bounds 统一改为 `.cm-editor` 矩形与视口的交集（与注释对齐）；`placeMenu` 翻转/夹取逻辑不变。
- **D4 斜杠菜单内容输入上下文**：新增统一触发形态 `context`——携带 `{anchorRect, querySink, insertRange, focusHost}`：原生控件（单元格 input、分栏 textarea、高亮块 textarea）触发时构造该上下文打开**同一**菜单组件与注册表。过滤词来自控件文本（"/" 保留在控件内作为查询锚点，替代现行「删字符开菜单」）；控件 input 事件驱动 `applyQuery`；选中后以 `insertRange`（控件内 "/" 起点到光标）替换写入控件文本；Esc 关闭并回滚查询文本；焦点全程留在控件（**删除现行 `view.focus()` 抢焦点**）。CM6 文档级触发（普通正文）行为不变。
- **D5 上下文命令安全集**：命令安全集由 `SlashCommand.inline` 承载（不新增 `context` 字段）：`inline === true` 即「可安全落入单元格」。过滤规则：`doc` 上下文 = 现行命令集不变；`cell` = `inline` 命令（图片/媒体引用）+ 单行用户片段，**排除**块级命令（表格/分栏/代码块等在管道表内不合法）；`container` = 全量命令（行内 + 片段 + 表格/代码块/高亮块等可安全落入容器语法的块命令）。`snippetToCommand` 按 `!body.includes("\n")` 自动标注单行片段为 `inline`（多行片段只出现在文档级/容器级菜单）；单元格菜单改传 `getSlashCommands()`，由 `openInsertMenu` 的 anchor 过滤与单元格 input 的 inline 过滤共同收敛。菜单项图标沿用注册表，不新增图标。e2e 的确定性插入断言用 tauri mock 既有 `list_extensions` 片段注入接缝。
- **D6 高亮块统一菜单**：callout 正文 textarea 改接统一上下文菜单（D4/D5）；`CALLOUT_SNIPPETS` 高亮片段改写为注册表命令（kind=snippet）保留能力；`callout-insert.ts` 独立菜单退役（复用统一菜单的定位/过滤/关闭）；标题 input 不加菜单（无块插入语义，见 Out of Scope）。
- **D7 容器新增手柄**：分栏内容区与高亮块内容区各显示一个小"+"手柄（贴内容区左缘外侧、纵向居中，与单元格手柄同款形态/圆角），点击以 anchor 上下文打开同一菜单。悬停内容区才显示，滑出隐藏。
- **D8 死代码与注释修正**：删除 `endOfTableBlock`、`slashMenuRequest`、`openSlashMenuAt`；删除 `slash.ts` 中「夹取用 .cm-editor」与实现不符的陈旧注释（由 D3 落实后注释变正确）；`smart-input.ts` 中宣称全角斜杠/顿号归一的错误注释修正为实际行为（只归一全角逗号）。
- **D9 源码无损与往返**：容器内插入写回沿用既有路径（单元格 `flushDirtyTables` 单事务、分栏/高亮块既有 commit 路径）；插入后除目标位置外逐字节不变；分栏 fence 内插表格、callout blockquote 内插表格的往返解析由 e2e 验证。

## 数据面

| 落点 | 位置 | 载体/符号 | 判据 |
|---|---|---|---|
| 规格 | design-system:§2 | — | 菜单项图标 20px；本 change 不新增图标，沿用既有注册表 |
| 存储 | src/editors/icons.ts | ICON_REGISTRY | 不新增图标条目；如实现中需新图标必须先注册再使用 |
| 校验 | src/editors/icons.ts | hasIcon | 上下文菜单命令每项图标名必须通过 hasIcon；单测逐项断言 |
| 桥接 | src/editors/icons.ts | renderIcon | 统一输出 20px 与 `data-icon`，未知名回退可见默认图标 |
| 消费 | src/editors/slash.ts | getSlashCommands | 上下文命令集按 inline 过滤（D5：cell=inline，container=全量），数组顺序即显示顺序 |
| 回滚 | git | revert <PR> | 纯代码改动、无新数据文件；回退后手柄与菜单回到上一条款状态 |

## 3. 风险

- 原生控件内菜单的焦点管理复杂：Esc/外部 pointerdown/滚动三条关闭路径都必须保留焦点在控件，e2e 逐条覆盖。
- 容器内块命令插入的解析合法性：分栏/高亮块内插表格需往返无损，e2e 验证；不合法的组合（单元格内块命令）由 D5 白名单挡住。
- 表头去手柄后表头只剩 "/" 菜单一条插入路径（表头以文本为主，可接受）。
- 新增/调整 `cm-*` 类名必须同步 `src/styles/`，否则 CSS manifest 门禁失败。
- 圆点常显可能视觉嘈杂：滑入显示/滑出隐藏，且圆点默认态弱化（小、边框色），悬停才增强。
