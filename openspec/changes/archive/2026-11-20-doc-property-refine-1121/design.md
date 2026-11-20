# 设计 — doc-property-refine-1121

来源：spec issue #1254（用户 2026-11-21 反馈 14 项优化 + 1 个 P1 崩溃，附 3 张截图）。既有规格：`openspec/specs/doc-property-panel/spec.md` 的 P-3 / P-4 / P-6 / P-10 / 托管日期只读展示。

## 目标与约束

- 不新增用户可配置项；形态存储值仍为 `docPropertyVariant` 的 `A`/`B`，`displayStyle` 仍为 `list`/`dual`。
- 面板仍由 `src/components/Content/DocPropertyBar.tsx` 单组件承载（A/B 两分支），不拆组件树、不改挂载方式（P-1 三模式不变）。
- 视觉数值只落在 `docs/design/system/spec.md`；本 change 新增/修订的 token 与图标条款先补 spec、再出一行 `decisions.md` 台账，然后才允许写进 CSS / 图标表。

## 决策

### D1 解析容错：整块优先、逐条兜底

`parseFrontmatter` 仍先尝试 `YAML.parse(inner)`；失败或结果非对象时，走新增的 `parseLooseEntries(inner)`：

- 按行扫描顶层键（行首非空白、非 `#`、含 `:`），把该键到下一个顶层键之间的行归为一组；
- 每组用 `YAML.parse(该组原文)` 单独求值；失败则把冒号后的原文 `trim()` 后按字符串保留（去掉成对引号），类型按 `text`；
- 键序即源文件顺序；空值（`key:` 后无内容）解析为 `null`。

写回：

- 能整块解析的文档继续走 `writeFrontmatter` / `writeFrontmatterOrdered` / `renameFrontmatterField` 的 AST 路径（现状不变）；
- 整块不可解析的文档走新增的 `writeLooseFrontmatter(doc, parsed, fields)`：逐行重建 `inner`，未改动键的原始行（含注释、缩进、模板占位）原样保留，只替换目标键的值行/块；新增键追加在末尾。`setFrontmatterField`、结构写回、改名在检测到 `parsed.yamlValid === false` 时统一改走该函数。

`ParsedFrontmatter` 增加 `yamlValid: boolean`（整块是否可被 YAML 解析），供上述分支判定；对可解析文档该字段为 `true`，行为与现状字节一致。

### D2 识别收敛：空值默认文本、别称扩展

- `toFields` 中：`value === null || value === undefined || value === ""` 且别称未命中时，类型取 `text`（不再 `unknown`）；`unknown` 只保留给「有值但无法推断」。
- 内置别称表扩充（只赋类型、不改键名）：
  - `type` → select，`source_kind` → select
  - `captured_via` → text，`ingested_via` → text
  - `captured_at` → datetime，`ingested_at` → datetime
  - `read_date` → date，`rating` → number，`book_title` → text
- 扩充后仍满足「别称类型 ⊆ 八类」；用户配置 `propAliasMap` 的优先级与 `normalizePropAliasMap` 校验不变。

### D3 列表类型对非数组值容错

- `formatFrontmatterValue` 的 `array` 分支：`const items = Array.isArray(value) ? value : [value]`。
- 新增导出 `toListValue(value: unknown): string[]`：`Array.isArray` → 逐项 `String`；`null/undefined/""` → `[]`；其他标量 → `[String(value)]`。
- 标签行识别（现为 `key === "tags" && Array.isArray(value)`）改为 `key === "tags"`，值经 `toListValue` 归一；标签编辑器与列表编辑器的入参统一走该函数。
- 首次编辑该字段时按列表写回（`["#"]`），字符串形态随后消失；未编辑时保留原文（避免打开即改写文档）。

### D4 头部与 footer 统一

- 右侧按钮顺序两态一致：**添加字段 → 模板 → 全选 → 折叠 → 形态切换 → 模板状态**。B 现顺序即目标顺序，A 调整 `dpb-a-tools` 子节点次序。
- footer 两态一致：**计数在左、托管日期在右**，共用一个渲染片段；A 现为「日期左、计数右」且整块仅在存在日期时渲染，改为「恒渲染、计数始终可见，日期存在才追加」。
- 计数左缘与**字段类型图标左缘**对齐：A 胶囊内图标即行首，按面板内边距对齐；B 行首是 16px 手柄列 + 6px 间距，footer 计数补同样的左偏移（22px），**不与手柄对齐**。
- 按钮与图标统一放进 22×22 的居中按钮盒（`inline-flex; align-items:center; justify-content:center`），消除形态切换图标的基线偏移。
- **supersede**：P-10「新建字段按钮位次」（A 末位）与「托管日期只读展示」（A 日期在左）两处旧条款。

### D5 图标改形与新增

- `docPropertyVariant`：改为字形语义——part 0（A/L）= **L 形**：左侧竖笔 + 底横向右伸出；part 1（B/T）= **T 形**：顶横左右各伸出一段 + 居中竖笔。仍按当前形态只绘制对应单形态（`part` 选择器），label、title/aria-label、存储值不变。
- 新增 `selectAll`：方形复选框 + 勾（与 `check` 的纯勾区分），24×24 viewBox、描边 1.7、密集档 14px。
- 两处均先补 `docs/design/system/spec.md` §2.3 条款（概念表 + 图形规范），再在 `decisions.md` 追加一行裁决。

### D6 字段行：去类型文字、居中、满行、字号跟随

- 删除行内 `.dpb-type-label` 节点（`TypeSelector` 的 `showLabel` 不再由行传入；类型菜单仍保留图标+文字）。
- B 行网格删除类型文字后收窄第二列；A 胶囊保持单行 flex。
- 类型图标 / 字段名 / 值统一 `align-items: center`；A 胶囊移除 `vertical-align: -2px` 这类基线微调，改由容器居中。
- 值编辑器：`text` / `textarea` / `array` / `tags` 类 `width:100%; max-width:none; flex:1 1 auto`；`date` / `datetime` / `number` / `boolean` 保留内在宽度。
- 字号：面板根 `font-size: var(--dpb-field-font-size)`，token 值 `1em`（编辑态继承 `--editor-font-size`、预览态 `--type-font-size`）；字段名、值、改名输入、值输入一律 `font-size: 1em`。footer 保持 11px；**面板标题固定 17px，不跟随正文字号（用户裁定）**。
- 行高：`.dpb-b-row` `min-height: var(--dpb-row-min-height)`，token 值 `2em`；`.dpb-chip` 内边距按间距刻度收紧。字号变化时行高按 `em` 同比变化。

### D7 视觉弱化、工具条与局部交互

- footer 元信息（日期、计数）颜色沿用 `--app-text-3`，整体 `opacity: var(--dpb-meta-opacity)`（0.72）；footer `:hover` / `:focus-within` 恢复 `1`。计数与日期不可交互。
- 锁图标尺寸单独 token `--dpb-lock-size`（12px）；`--dpb-icon-size` 仅保留给形态切换图标。
- 操作工具条：背景 `--app-surface`、描边 `--app-border`、文字 `--app-text-2`；按钮 hover 用 `--app-accent-soft`。删除类悬停仍用错误色。
- 行删除按钮：默认 `opacity: 0`，行 `:hover` / `:focus-within` / 行选中时 `opacity: 1`；占位宽度不变（18px），不引起行宽跳动。
- 折叠条：折叠态面板内容 `opacity: var(--dpb-collapsed-opacity)`（0.35），容器 `:hover` / `:focus-within` → `1`；保留固定最小高度，**不用 `display:none`**，避免正文回流。
- 「全选」按钮前置 `selectAll` 图标，文案二态不变。

### D8 日期时间降密与选择器改版

- 显示格式：保持 `YYYY-MM-DD HH:mm`（用户澄清 #7 指的是窗口，不是文本格式）；展示层去掉 `Z`/毫秒，秒非 `00` 时保留 `:ss`。YAML 原值不改写。
- **日期字段也改用同一自绘面板（仅日期，无时分）**，不再使用原生 `<input type="date">`；与日期时间共用月历、年月切换与键盘语义，`date` 提交 `YYYY-MM-DD`。
- 选择器布局（同一 popover，不拆双控件）：
  - 面板宽度取 `--dpb-cal-width`（300px）；月历格 `--dpb-cal-cell`（32px）、间距 `--dpb-cal-gap`（8px）；翻页按钮 `--dpb-cal-nav`（28px），与标题间距 ≥ 8px。
  - 标题拆为「年」「月」两个可点按钮：点「月」进入月网格（12 格），点「年」进入年列表（12 年一页，带上一页/下一页）；选月/选年后回到日网格。
  - 日网格 7×6 固定高度，避免切月时面板跳动。
  - 新增「今天」按钮：回到今日并保持当前时分。
  - 时分步进保留，输入框加宽到 44px，步进按钮 28×28。
  - 打开定位沿用 `useMenuPos`，并传入宿主边界（`boundsOf` 指向属性块宿主），避免嵌入窄宿主时溢出。
- 键盘语义不变：Tab 在月历/时分间移动，Enter 提交，Esc 取消；面板内操作不提前提交。

### D9 改名锁扩展名

- 新增 `src/lib/pathName.ts`：`splitStemExt(name)`（最后一个 `.` 为界，点开头/无点视为无扩展名）与 `joinStemExt(stem, ext)`。
- 页签双击改名：输入框只承载主名；扩展名以只读后缀呈现（输入框右侧静态文本）。提交时 `joinStemExt(input, ext)` 得到完整标题；Esc 不变。
- 属性面板标题字段：显示时剥掉与页签一致的文档扩展名（`.md` / `.markdown` / `.txt`），提交时保持不变（写回 frontmatter 的仍是用户输入的标题本体）；页签同步用「标题 + 原扩展名」。若标题本身不带扩展名，行为与现状一致。
- 新建文档另存为：`App.tsx` 预填名不再无条件拼 `.md`，先剥扩展名再拼，消除 `x.md.md`。

### D11 面板内 Tab 键不得写入正文（新缺陷）

现象：光标在日期时间的时/分输入框内按 Tab，属性区变成「暂无 frontmatter 属性」，正文露出原始 YAML。

根因假设：面板内 `keydown` 未阻止冒泡，CM6 的 Tab keybinding 把 Tab 当缩进写入编辑器；若插入点在文首，`---` 不再位于文首，`FRONTMATTER_RE` 失配 → 面板判定「无 frontmatter」。验证方式：在 `DocPropertyBar` 单测中聚焦时分输入框派发 Tab，断言 `defaultPrevented` 为 false（浏览器应移动焦点）或焦点在面板内移动，且 `setFrontmatterField` 未被调用、文档文本不变；e2e 在真实编辑器上按 Tab 后断言正文仍以 `---` 开头且面板未消失。

修复：面板容器对 `keydown` 的 Tab 做显式处理——在面板内维护可聚焦元素顺序（日期格 → 时 → 分 → 面板外），`e.preventDefault()` 后把焦点移到下一个，并 `stopPropagation()`，禁止事件到达 CM keymap；其余按键（Enter/Esc）保持现状。

### D10 标题字段与文件名边界（不扩大语义）

属性面板的标题是文档标题，不是磁盘文件名；本 change 只做「显示/提交时不带扩展名」与「页签改名锁定扩展名」两件事，不把 frontmatter `title` 强绑定为文件基名，也不引入磁盘重命名。

## 数据面

| 落点 | 位置 | 载体/符号 | 判据 |
|---|---|---|---|
| 规格 | design-system:§2.3;design-system:§7.2;design-system:§7.6 | — | 新增图标与面板密度数值必须先有 spec 条款，再进 decisions.md 台账 |
| 存储 | src/stores/docPropertyPanel.ts | docPropertyVariant | 形态存储值仍仅 A/B，不新增持久键；旧值升级后仍生效 |
| 校验 | src/lib/frontmatter.ts | normalizePropAliasMap | 新增内置别称类型必须落在八类枚举内，未知类型拒绝并告警 |
| 桥接 | src/hooks/useConfig.ts | config | 别称映射沿用既有配置桥接与热应用，不新增配置字段 |
| 消费 | src/components/Content/DocPropertyBar.tsx | DocPropertyBar | 图标从 `src/ui/icons.ts` 注册表取用，footer/行不新增常量数组或内联一次性 SVG |
| 回滚 | src-tauri/src/config.rs | snapshot_user | 无配置写路径变更；沿用写前快照与 restore_config_snapshot 回滚 |

## 风险

- **解析容错回归**：合法 YAML 文档的往返与写回必须与现状字节一致——以既有 `frontmatter.test.ts` 全部用例为回归基线，新增 `yamlValid` 分支不得改变可解析文档的路径。
- **行级写回丢注释**：`writeLooseFrontmatter` 只替换目标键的连续行块，其余行逐字节保留；用「编辑一个键、断言其余字节不变」的单测锁定。
- **字号 token 影响面**：`.dpb-input` 等若直接继承 1em，宿主里其他输入框样式可能受影响——只改 `dpb-*` 作用域内的选择器，不碰全局 `input`。
- **日期面板越界**：`boundsOf` 传入后需同时验证宽窗与窄窗；e2e 覆盖 300px 宿主。
- **改名归一化**：`splitStemExt` 对 `.env`、`a.b.md`、无点名的行为必须单测固定，避免把点开头文件误拆。

## 测试策略

- 单测优先级高于 e2e：解析/识别/写回/路径拆分是纯函数，直接覆盖输入输出。
- e2e 只验证「页面上看得见」的四类事实：垂直居中（包围盒中心差 ≤1px）、footer DOM 顺序、字号同步（计算样式）、删除按钮与折叠条的 opacity 变化；日期面板验证视图切换与键盘。
- 不新增截图基线；沿用 `cw-evidence.sh record-state` 记录展开/折叠/窄窗/日期面板四态。
