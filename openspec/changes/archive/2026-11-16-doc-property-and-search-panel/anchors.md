# 验收锚点 — doc-property-and-search-panel

> 机读层唯一解析面。人读层 = `specs/doc-property-panel/spec.md`（P-1～P-10）、`specs/search-replace-float/spec.md`（S-1～S-5）。
> R-1～R-10 对应 P-1～P-10，R-11～R-15 对应 S-1～S-5。来源记法：`prototype#<态/交互>`（原型 `docs/design/explorations/frontmatter-search/prototype.html`）、`baseline/<文件>.png`（G0 锁定基准截图）、`决策#<n>`（design.md Decisions / PLAN.md 轮次裁定）。

## R-1 P-1 面板落位与三模式

编辑器/预览页签内容区顶部渲染文档属性面板，源码模式不渲染；预览只读、编辑默认展开可折叠；三模式 CSS display 切换不 remount。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | state-machine | 三模式往返 | 打开含 frontmatter 文档依次切换到 预览→编辑→源码：面板分别变为只读渲染/展开可折叠/不渲染，切回后面板数据与选中状态无残留丢失 | prototype#面板三模式 |
| A-1.2 | perceptual | 面板位于内容区顶部正文上方 | 打开含 frontmatter 文档，正文上方出现带字段行与标签的属性面板（B 态字段行 5 列网格 16/30/92/1fr/18px 对齐） | baseline/panel-a-edit.png |

## R-2 P-2 显示样式两态与显隐配置

A 一行条 / B 精排双列两态可配，两态共享字段顺序与操作引擎；预览/编辑分别可设展开折叠隐藏；⌘⇧Y 一键显隐。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | exact | 样式切换即时生效 | 设置把样式从 A 切换到 B：面板立即变为 B 双列形态，字段内容与顺序不变 | prototype#A/B两态 |
| A-2.2 | exact | ⌘⇧Y 显隐 | 按 ⌘⇧Y 面板隐藏并显示恢复提示，再按恢复；不修改文档内容 | 决策#建议C |
| A-2.3 | perceptual | B 态 5 列网格 | B 态每行 5 列网格对齐：手柄 16px / 类型 30px / 名称 92px / 值 1fr / 删除 18px | baseline/panel-b-edit.png |

## R-3 P-3 字段类型系统与智能编辑

八类类型（文本/数字/日期/日期时间/下拉/复选/布尔/列表-[[]]文档链接）；类型选择器 = 纯图标 + 图标文字菜单；值编辑器按类型智能渲染；非法输入还原并提示。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-3.1 | exact | 数字千分位仅显示层 | 值 1234567 显示 `1,234,567`，编辑器与 YAML 源码保持 `1234567` | prototype#千分位 |
| A-3.2 | state-machine | 类型切换编辑器随变 | 字段类型从文本切换到日期：编辑器变为日期选择器，源码写回 YAML 日期字面量 | prototype#类型菜单 |
| A-3.3 | exact | [[ 文档链接 | 列表字段输入 `[[` 弹文档菜单，行只显示文档名；选中文档后值列表新增 1 个「[[文档名]]」chip 且可移除（1 chip = 1 条链接） | prototype#[[菜单 |

## R-4 P-4 字段行操作与选择模式

行手柄点击选中/拖动排序（5px 阈值、落点指示线）、整块移动；图标操作条 ⧉✂⤵↑↓🗑×；全选不含标题位；选择模式行内一切点击 = 选中/取消。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-4.1 | state-machine | 选择模式统一行为 | 选中集非空 → 行内一切点击（值/选项/类型图标/删除键）变为选中/取消且不进编辑；单击行外空白清空选中 | prototype#选择模式 |
| A-4.2 | exact | 粘贴键名去重 | 复制 2 行粘贴到已有同名键处，粘贴行键名追加序号（如 `author-2`） | prototype#行操作 |
| A-4.3 | state-machine | 整块移动 | 选中临近 3 行拖动任一行手柄，3 行整块迁移到落点、行内相对顺序不变 | prototype#拖拽排序 |

## R-5 P-5 标签彩色胶囊与建议输入

彩色胶囊按标签名稳定哈希配色（同名同色、增删不漂移、不可手工改色）；建议菜单 ↑↓ 换选、选中行 ⏎ 其余 ⌘N、无匹配 Enter 新建；菜单内 ⌘1~9 优先于全局键段。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-5.1 | exact | 稳定哈希配色 | 删除标签列表中间的 1 个标签，其余标签色值严格等于原色（哈希按名不按位） | prototype#彩色胶囊 |
| A-5.2 | state-machine | 建议菜单键盘选用 | 输入关键字弹已有标签建议菜单：↑↓ 换选，选中行行尾显示 "⏎" 其余显示 "⌘1~⌘9"，⏎ 选用，无匹配 Enter 新建 | prototype#标签建议 |

## R-6 P-6 字段名编辑与别称识别

字段名就地改名（改 YAML 键、重名拦截、显示 = 输入原样）；别称表仅类型识别不改名；创建/修改日期自动托管只读键名锁定。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-6.1 | exact | 输入原样显示 | 字段改名为 priority 后面板显示 "priority"，YAML 键同步为 "priority"（显示不含归一化改写） | 决策#第十二轮属1 |
| A-6.2 | exact | 外部键类型识别 | 打开含 `createdate: 2026-11-14` 的文件自动识别为日期类型（日历图标），显示名保持 `createdate` 原样 | prototype#别称表 |
| A-6.3 | state-machine | 托管日期只读 | created/updated 不可编辑/改名/删除；保存正文后 updated 刷新为当日日期（格式 "YYYY-MM-DD"，如 "2026-11-15"） | prototype#托管日期 |

## R-7 P-7 新建默认与属性模板

新建默认仅标题占位 + 自动托管创建/修改日期；属性模板应用级配置，套用只合并缺失键不覆盖，单事务可撤销。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-7.1 | state-machine | 新建默认集 | 新建文档 frontmatter 默认仅含 3 键：title（占位「未命名」）+ created + updated | prototype#新建默认 |
| A-7.2 | state-machine | 模板合并缺失键 | 文档已有 `status: 已定稿` 套用含 `category`/`status: 草稿` 的模板 → 仅新增 `category`，整次套用一次撤销 | prototype#模板套用 |

## R-8 P-8 外部未识别字段收编

未命中别称且无法推断类型的键以「?」类型显示、值原样保留；点类型图标选类型即收编，转换失败保留原文并提示。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-8.1 | state-machine | ? 收编 | 未识别键 `priority: 高` 点「?」图标选「下拉」→ 转下拉类型可编辑，原值 `高` 保留为当前选中项 | prototype#收编 |

## R-9 P-9 frontmatter 写回与数据无损

面板编辑经解析→状态→序列化单事务写回 `--- ... ---` 块（CM6 事务可撤销）；自由键不丢；无 frontmatter 文档空态引导、首次添加字段自动建块。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-9.1 | exact | 自由键不丢 | frontmatter 含自由键 `custom-note: x`，编辑其他字段保存后源码中该键严格等于 "custom-note: x" | prototype#自由键 |
| A-9.2 | state-machine | 撤销面板编辑 | 修改字段值后 Ctrl+Z：源码回到修改前状态，面板随源码重新解析 | prototype#单事务 |

## R-10 P-10 A/B 视觉锚点

A 一行条 / B 精排双列布局数值：字段行 5 列网格（16/30/92/1fr/18px）、A 胶囊列间距 16px、行手柄悬停显示于胶囊左外侧、字段值两行截断 + title 全文、B 预览态静态类型图标对齐、底部统计全部字段数。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-10.1 | perceptual | A 一行条形态 | A 态胶囊行 16px 列间距，行手柄悬停显示于胶囊左外侧不占布局 | baseline/panel-a-edit.png |
| A-10.2 | perceptual | B 预览态列位 | B 预览态每行仍 5 列网格、类型图标为静态、值列左缘对齐 | baseline/panel-b-preview.png |

## R-11 S-1 浮窗形态与默认位置

⌘F 当前编辑器窗格内弹出自研浮窗（替换 CM6 内置面板），宽 min(600px, calc(100% - 48px)) 高 460 默认居中，系统浮层范式；默认位置左/中/右可配；可拖拽移动、右下角缩放，拖后位置会话内优先。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-11.1 | exact | 浮窗默认尺寸与位置 | ⌘F 浮窗宽度 `min(600px, calc(100% - 48px))`、高 460、默认居中 | prototype#浮窗壳V2 |
| A-11.2 | state-machine | 位置设置与拖拽记忆 | 默认位置设为右侧 → ⌘F 停靠右侧；拖到新位置关闭再开回到拖后位置；改设置回到默认档（左/中/右） | prototype#拖拽缩放 |
| A-11.3 | perceptual | 浮窗壳系统范式 | surface 底、border 描边、8px 圆角、系统投影 | baseline/search-default.png |

## R-12 S-2 扫描规则

默认不分大小写子串匹配（无大小写/整词开关），扫描当前文件全部块，结果含位置与命中文本；纯前端即时扫描。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-12.1 | exact | 不分大小写命中 | 文档含「属性面板」搜「属性」所有片段均命中并高亮（序位形如 1/7） | prototype#结果列表 |

## R-13 S-3 结果列表与行尾快捷键

双行结果（定位 `L行号 · 块标题` + 序位 `1/7`、两行上下文高亮截断）；命中分布条；视口默认 9 行；行尾固定快捷键 ⌘1~⌘9、选中行 ⏎；↑↓ 换选、Enter 定位、⌘N 直达、点击定位。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-13.1 | exact | 双行结果与序位 | 结果行第一行 `L行号 · 块标题` + 序位 `1/7`（不用「第/处」），第二行约两行上下文高亮截断 | prototype#双行结果 |
| A-13.2 | state-machine | 行尾快捷键跟随 | ↓ 两次后第 3 行显示 ⏎、第 1/2 行显示 ⌘1/⌘2；Enter 在编辑器选中第 3 处并滚动到可视区 | prototype#行尾快捷键 |
| A-13.3 | exact | 9 行视口滚动不变 | 21 处命中滚动查看第 10 行起，前 9 行 ⌘1~⌘9 显示不变 | prototype#9行视口 |

## R-14 S-4 替换与 diff 预览

替换模式 ⇄ 切换；行内「原词 → 新词」diff；替换 CM6 单事务可撤销；逐个替换自动跳下一处；全部替换一次事务并计数；悬停全文预览卡仅替换模式。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-14.1 | state-machine | 替换后自动跳下一处 | 逐个替换当前命中 → 自动前进到下一处（末尾停在末尾），整个操作一次撤销 | prototype#替换diff |
| A-14.2 | exact | 行内 diff 预览 | 替换模式每条结果行内含「原词 → 新词」diff 标记（原词删除线 → 新词强调色） | 决策#第二轮搜1 |
| A-14.3 | state-machine | 悬停预览仅替换模式 | 替换模式悬停结果行 → 弹全文预览卡；普通搜索 → 不弹卡 | prototype#悬停卡 |
| A-14.4 | perceptual | 替换态浮窗壳 | 替换输入行（替换词输入 + 逐个替换/全部替换 2 按钮）与结果列表同屏呈现 | baseline/search-replace.png |

## R-15 S-5 局部快捷键优先级

浮窗内快捷键（⌘1~9、Enter、↑↓、Esc）为局部 scope：仅浮窗打开且焦点在浮窗内生效，优先于全局同名键段；关闭/失焦归还；注册进 shortcuts.ts 唯一真相源并标注 scope 与生效条件。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-15.1 | state-machine | 局部抢占与归还 | 浮窗打开按 ⌘2 直达第 2 结果；关闭浮窗再按 ⌘2 恢复全局「卡片直开」 | 决策#5 |
| A-15.2 | exact | scope 注册标注 | shortcuts.ts 浮窗局部键条目标注 `scope="local"` 与生效条件「搜索浮窗打开且焦点在浮窗内」 | 决策#5 |
