# 设计 — editor-surface-batch21

来源：spec issue #1038（15 项 + 阻塞缺陷 #1034）；参考 `docs/design/explorations/frontmatter-search/prototype.html`、batch20 制品与主规格。需求四要素以 #1038 正文为唯一真相源，不再另行访谈。

## Context

本批是三块表面（属性面板 / 文件打开 / 编辑器表面）的体验收敛。第一原则：**沿用既有机制、只补差异**——属性面板继续使用既有九类字段联合与单一事务写回路径；文件打开复用现有分栏/自动布局能力；缺陷按先红后绿修根因。原型已确认「圆角卡片 + 字段胶囊 + 锁定字段」，实现须向原型收敛，而不是另立机制。

## Goals / Non-Goals

**Goals:** 让属性面板的添加字段/字段行/容器/全选/模板类型落到原型与用户预期；让多文件一次成栏；修掉三处缺陷与四处观感；收敛搜索浮窗的外壳/键盘导航/渲染态/行高上限/宽度（故事 19–23）。

**Non-Goals:** 不改 frontmatter 格式与解析语义（唯一例外：#1034 别称优先级）；不重做设置页信息架构；不引入第三方拖拽库；不扩展 batch20 的 #903（MD 编辑态媒体渲染）；第 5、9 条不纳入本轮。搜索组不改搜索/替换的匹配语义与扫描范围，仅收敛浮窗外衣与渲染面。

## Decisions

### D1 属性面板交互重构（#1038 故事 1–10）

- **控件区拖入（故事 1）**：点「添加字段」在面板左侧展开控件区（窄宽时改到工具条区），清单 = 八类类型联合，项复用现有类型图标与文案；拖放落点复用现有行排序的落点计算；落点插入一个对应类型的空字段并进入字段名编辑态；插入必须是一次可撤销的写回。接线归属：新导出由 1.3 落到 `DocPropertyBar.tsx`（面板本体）。
  - 设计依据：prototype §决策「类型选择器 = 字段名前纯图标……八类直选」；#1038 故事 1。
- **字段胶囊（故事 2/3/5/7）**：字段名与值同行；字段名输入框固定单行高度，不随内容撑开；空值不渲染占位横线（现状 `ValueView` ~:498 渲染 em dash `—`）；行尾控件改为叉号（关闭语义）；锁定字段（`created`/`updated`）不渲染删除/改名，并加锁图标。
  - 设计依据：#1038 用户截图（圆角卡片、字段胶囊、锁定字段）；code obs `src/components/Content/DocPropertyBar.tsx` `ValueView` ~:498。
- **面板容器（故事 6）**：面板作为圆角卡片内联在正文顶端，宽度对齐正文测量宽度（`--type-measure` 口径），随窗口收缩；极端窄宽下字段换行而非横向溢出。卡片结构按原型：标题行（标题 + 标签胶囊 + 「+标签」）、操作行（全选/模板/折叠/添加字段）、字段胶囊区、锁定字段区。
  - 设计依据：code obs `ContentArea.tsx:758-774`（现面板内联、流体宽度、无 max-width）；#1038 故事 6 截图。
- **全选二态（故事 8）**：同一按钮在「全选」与「反选」间切换；按钮文案与当前选中集合一致；仍排除标题与标签行；取消选中与外部点击清空保持现状。
  - 设计依据：code obs `handleSelectAll` ~:1585（现幂等无反选）；doc-property-panel P-4。
- **按钮位次（故事 10）**：新建字段按钮在 B 模式位于标题右侧按钮区第一位，A 模式位于按钮区末位；其余按钮相对顺序不变。
  - 设计依据：#1038 故事 10；prototype §「工具按钮带图标」。
- **时间选择器（故事 4，条件票）**：日期字段现用原生 `input[type=date]`（无时间），日期时间用 `datetime-local`。实现前必须按 Open Question 2 确认是「date 补时间」还是「datetime 原生选择器缺陷」，再决定改法；未确认前 1.6 为 gated。
  - 设计依据：code obs `DocPropertyBar.tsx` 值渲染分支；#1038 Open Question 2。
- **模板类型（故事 9，阻塞边）**：模板套用携带类型已具备（`propTemplates.ts:152-157`），本批只补「内置『通用』模板字段类型被别称识别覆盖」缺陷（#1034）：模板定义的类型须优先于别称推断，模板仍只补缺失键、不覆盖已有值。修复前先红后绿，且 1.7 必须先行或同修，否则任何「模板带类型」验收不成立。
  - 设计依据：issue #1034；code obs `src/lib/propTemplates.ts:152-157`。

### D2 文件打开：多文件拖入与魔法布局（#1038 故事 11）

一次 drop 读取全部路径，**全部校验通过才整体打开**（任一不支持则整体不打开）；打开后调用既有分栏/自动布局能力排布为多栏，并播放一次性布局动效；不新增持久化「布局方案」配置项。接线归属：新导出由 2.1 落到 `src/App.tsx`（drop 入口）。

- 设计依据：code obs `src/App.tsx` 现仅取 `paths[0]`；navigation「一键自动布局栏目」的形状规则。

### D3 缺陷（#1038 故事 12–13）

- **MD 编辑态行内代码（故事 12）**：先复现再修；`cm-inline-code` decoration 与 CSS（背景/圆角/等宽）已存在，不得盲目重写；验收断言编辑态计算样式与预览态一致。
  - 设计依据：code obs `src/editors/decorations/*` + `src/styles/editor.css` 已有 `cm-inline-code`；editing E-8。
- **视频串台（故事 13）**：先真实打开两个不同视频路径复现根因（疑为同格播放器源未随打开更新，或媒体宿主缓存）；修复方向不作为结论。验收断言显示的 URL/标题 = 最近打开的那个。
  - 设计依据：#1038 Further Notes「疑似缺陷必须先复现」；file-management C-6 既有「每格独立持有播放源」。

### D4 优化（#1038 故事 14–18）

- **选区工具条（故事 15）**：预览态工具条横向位置由「选区中心」改为「鼠标落点优先、否则选区中心」，做视口左右边界钳制；纵向仍在选区上方。
  - 设计依据：code obs `SelectionPill.tsx`（left = 选区中心、top = rect.top − 44，无光标锚点、无钳制）。
- **大纲（故事 16）**：拖动时渲染轨迹（ghost/占位）；松手后正文按新顺序同步；同级 H 等级徽标只在首个标题前渲染，颜色降为次级文字色。DESIGN DEFAULT：正文同步语义按故事 16「松手后正文跟着新顺序同步」执行；若 Open Question 3 另有裁定，以裁定为准。
  - 设计依据：code obs `OutlineMenu.tsx`（拖动即改显示顺序、无 ghost；每个标题都渲染 `H{n}` 徽标；正文不变）；#1038 Open Question 3。
- **文本预览行号（故事 14）**：在预览渲染层为文本文件生成行号列，复用编辑态的字体、颜色 token 与最小间隔口径（行号与分隔线之间保留非零间隙）；Markdown 预览不引入行号。
  - 设计依据：code obs 纯文本预览渲染 `.code-block wide` + `<pre><code>`（无行号槽）；reading「文本与脚本预览语法」。
- **窗口最小宽（故事 17）**：主窗口最小宽度 600→300，最小高度不变；300 宽度下属性面板、页签条、分栏必须不溢出（窄宽允许堆叠）。
  - 设计依据：code obs `src-tauri/tauri.conf.json:20-21`（minWidth 600 / minHeight 400）；#1038 故事 17。
- **页签（故事 18）**：标题显示不全时不用省略号，改为按可用宽度收缩或换行；页签间距调整到一个指针尺寸（约 16px）。
  - 设计依据：code obs 页签标题 `max-w-44 truncate`（176px 省略号）、页签条 `gap-1 px-1`（4px）。

### D5 搜索浮窗（#1038 故事 19–23）

- **外壳同构 + 状态栏贴底（故事 19）**：浮窗的边框 / 顶栏 / 状态栏 SHALL 复用阅读空间文件卡片悬浮窗（`ReadingRail` 悬浮卡）的同一套视觉与显隐机制（同构，不另写一套状态栏）；状态栏贴住浮窗底边（间距 = 0）由浮窗纵向 flex 列布局保证，SHALL NOT 依赖 fixed 计算，缩放窗口时不得脱离底边；状态栏显隐切换后 SHALL NOT 残留占位。
  - 设计依据：#1038 追加 Implementation Decisions「同构，不另写一套状态栏」；code obs `SearchReplacePanel.tsx` `.search-float-statusbar` / `-hidden`、`src/styles/search-float.css` ~358/371；参照组件 `ReadingRail.tsx` 悬浮卡。Open Question 5 待裁定「以 ReadingRail 悬浮卡为准，按设计系统条款对齐」。
- **键盘选择 + 回车徽标（故事 20）**：↑↓ SHALL 移动高亮项 `activeIndex`；高亮行行尾快捷键徽标 SHALL 显示「回车」（严格等于该文案）；Enter SHALL 打开当前高亮结果；无高亮时保持现有默认行为。现状已有 ArrowUp/ArrowDown 分支，须核对其与高亮态/徽标的一致性，不预设缺陷已修。
  - 设计依据：#1038 追加 Implementation Decisions「上下键移动 activeIndex……高亮行右侧徽标切换为『回车』」；code obs `SearchReplacePanel.tsx` ~:454 ArrowUp/ArrowDown 分支。
- **预览态渲染（故事 21）**：结果行上下文片段与悬浮全文预览 SHALL 走既有预览渲染（Markdown 渲染/高亮），SHALL NOT 显示源码标记（`##`、`---`、围栏 ```）；命中高亮与滚动定位保持可用。
  - 设计依据：#1038 追加 Implementation Decisions「结果内容走既有预览渲染……不渲染源码」；既有 S-3 条款「上下文片段以预览态样式轻量渲染」。
- **9 行上限 + 快捷键列常驻（故事 22）**：结果容器高度上限 = 9 行（按行高计算），超出在容器内滚动；行尾快捷键列 SHALL sticky/fixed 于结果区右侧，滚动时始终可见。
  - 设计依据：#1038 追加 Implementation Decisions「高度上限 = 9 行……快捷键列 sticky/fixed」；code obs `.search-float-results` / `.search-float-hit`。
- **宽度减半（故事 23）**：默认宽度取现状的一半，即由 `min(600px, calc(100% - 48px))` 改为约 `min(300px, calc(100% - 48px))`，窄窗继续按比例收缩；不新增配置项（CSS-only）。若最终必须写入 `searchPanelConfig` 默认值，再按数据面六栏补登记。
  - 设计依据：#1038 追加 Open Question 6「以当前 min(600px…) 为基准理解为约 300px」；code obs `src/styles/search-float.css` `.search-float { width: min(600px, calc(100% - 48px)); }`。
- **数据面（本组）**：无新增落点——宽度为 CSS-only，不触及配置字段 / 存储 / 校验 / 桥接；下列六行表仍由 D1–D4 的图标注册表触发，本组无新增。

## 数据面

> 本批命中信号：图标注册表（新增叉号 / 锁 / 拖拽 ghost 等 IconName）、快捷键无关、配置字段无新增。按 `docs/agents/data-surface.md` 六栏表登记（落点 | 位置 | 载体/符号 | 判据）。机检 `./scripts/cw-data-surface.sh new editor-surface-batch21`。

| 落点 | 位置 | 载体 / 符号 | 判据 |
|---|---|---|---|
| 规格 | design-system:§2.3 | — | 新增「关闭(叉号)/锁定/拖拽 ghost」图标概念先补 spec §2.3 条款再注册 |
| 存储 | src/ui/icons.ts | IconName | 两套图标表同步注册新名；枚举白名单，未知名拒绝渲染 |
| 校验 | src/ui/icons.ts | iconSvg(name) | 未注册名不回落为 Unicode 字形；渲染调用必须命中注册表 |
| 桥接 | src/editors/icons.ts | IconName / iconSvg | 编辑器侧同名符号与 `src/ui/icons.ts` 同步，避免两套漂移 |
| 消费 | src/components/Content/DocPropertyBar.tsx | iconSvg(...) | 行尾删除/锁/拖拽控件均经注册表渲染，组件内无一次性内联 SVG |
| 回滚 | snapshots/ | restore_config_snapshot | 本批不写配置字段；误改图标注册可经快照一步回退，无直改配置面 |

> D5 搜索浮窗（故事 19–23）**无新增数据面落点**：宽度为 CSS-only、状态栏/渲染/行高均为组件与样式改动，不触及配置 / 存储 / 校验 / 桥接。上表六行由 D1 的图标注册表触发，保持不变。

## Risks / Trade-offs

- [1.6 时间选择器语义未定] → gated by Open Question 2；未确认不进实现。
- [1.7 #1034 根因与先红后绿] → 先加失败用例再修；#1034 未完成前不得勾选任何「模板带类型」验收。
- [4.2 大纲正文同步语义未定] → DESIGN DEFAULT 见 D4；Open Question 3 裁定后如不同则回改。
- [300px 是否允许堆叠] → DESIGN DEFAULT 允许分栏堆叠单列；Open Question 4 裁定后如不接受则回改。
- [3.1/3.2 缺陷] → 必须先真机/真路径复现，票面「修复方向」不作为结论。

## Open Questions

1. 第 5、9 条的附图未传（消息里是占位符）——需重新提供，否则无法定义验收；本轮不纳入。
2. 第 2 条「时间选择器不能选择时间」：是 date 类型要补上时间，还是 datetime 类型的原生选择器当前选不了时间（缺陷）？——**gated 1.6**。
3. 第 15 条「大纲位置变化后正文未跟着同步调整」：是拖动后正文顺序也要跟着变，还是仅指点击跳转/滚动定位没对上？——影响 4.2。
4. 第 16 条「缩到 1/2」按 600→300px 理解；300px 宽下允许分栏自动堆叠为单列，是否接受？——影响 4.4。
5. 「阅读空间文件卡片悬浮窗」的顶栏/状态栏以哪个组件为准（ReadingRail 悬浮卡 / 全局 StatusBar）？是逐像素复刻，还是按 `docs/design/system/spec.md` 条款对齐？——影响 5.1。DESIGN DEFAULT：以 ReadingRail 悬浮卡为参照，按设计系统条款对齐。
6. 搜索浮窗宽度「目前的 1/2」按现状 `min(600px, calc(100% - 48px))` 减半为约 300px（窄窗继续按比例收缩）理解，是否接受？——影响 5.5。
