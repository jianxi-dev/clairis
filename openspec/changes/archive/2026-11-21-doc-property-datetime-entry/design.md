# 设计 — doc-property-datetime-entry

来源：维护者确认的日期/日期时间字段操作模型。既有规格：`openspec/specs/doc-property-panel/spec.md` 的 P-3 / 托管日期只读展示；视觉数值唯一来源 `docs/design/system/spec.md` §7.6（`--dpb-cal-*`）。上一轮 `doc-property-acceptance` 的 O2 只定了面板密度与时分步进几何，本 change 只补齐值区录入模型，不改密度。

## Context

- 值区现状（已核对源码）：
  - `src/components/Content/DocPropertyBar.tsx` 的 `ValueView`（:561）在未编辑态渲染只读文本，`onClick` / Enter / Space 调 `onStartEdit`。
  - `DatetimeEditor`（:774）在编辑态渲染两段：静态 `<span class="dpb-dt-trigger">`（:1010）与 `.dpb-dt-panel` popover（:1019）。值区没有可编辑文本控件，无法直接键入或粘贴。
  - `start`（:863）打开面板；`finish`（:810）是唯一提交/取消出口，`doneRef` 已能防一次提交；`pickDay`（:906）只写 `datePart` 与 `touched`，日期与日期时间都不提交。
  - 外层节点在未编辑/编辑两个分支都是同一个 `<span class="dpb-value-slot" ref={slotRef}>`（:967 / :979），可作为双击检测的稳定挂载点。
  - 面板内 Tab 由 `moveDtFocus(panelRef.current, …)`（:670 / :1006）在 panel 内部回绕，值区控件不属于 panel 的停靠点集合。
- 校验现状：`src/lib/frontmatter.ts` 的 `validateFieldValue`（:440）对 date 只接受 `YYYY-MM-DD`、对 datetime 接受 `T`/空格与可选秒，但空串会被判非法，`YYYY/MM/DD` 也会被拒。
- 同仓已有 `doc-property-acceptance-2` 归档，格式与 delta 写法以其为参照。

## Goals / Non-Goals

**Goals:**

- 日期与日期时间字段在编辑态可直接键入/粘贴，保存时归一化到规范存储形。
- 日期字段单击日格立即写回并关闭；日期时间仍由 Enter / 外部点击提交。
- 双击值区打开面板并定位到时分输入（日期时间）或日历日格（日期）。
- 空输入合法并写回空值；非法输入回退原值并提示。
- 托管日期保持只读，不出现新的编辑入口。

**Non-Goals:**

- 不改面板宽度与 §7.6 的 `--dpb-cal-*` 密度。
- 不动时分步进：O2 的 32px 间距与 WebKit 56px 组保持原样。
- 不新建第二个 picker，不引入原生 `date` / `time` 控件。
- 不改形态切换、footer、A/B 布局、字段类型推断、持久化键或任何用户可设置项。
- 不改托管日期的展示值与 footer 位置。

## Decisions

### D1 值区机制：同一编辑器内把静态触发器换成可编辑文本控件

- 未编辑态保持 `ValueView`：只读文本，点击 / Enter / Space 调 `start()`。
- 编辑态仍用同一个 `DatetimeEditor`、同一个 popover；只把 `.dpb-dt-trigger` 的 `<span>` 换成 `<input class="dpb-input dpb-dt-input">`，绑定 `draft`。按钮与月历结构不变。
- 新控件复用 `.dpb-dt-trigger` 现有的字号、内距、边框、圆角与 `flex` 约束（只变元素类型，不改盒模型尺寸）；不新增像素值。
- `moveDtFocus` 只查询 panel 内部，值区输入不在其停靠点集合内，因此既有「Tab 在月历与时分之间移动、不写入正文」的语义不变；在输入框上按 Tab 会进入 panel 的第一个/最后一个停靠点（由既有 `moveDtFocus` 回退分支决定），不会逃逸到正文。
- 不建第二个 picker；不引入任何原生日期/时间控件。

### D2 单击 / 双击 / 键入共存

- 双击检测挂在**稳定的外层** `.dpb-value-slot` 的 `onPointerDown`，而不是依赖浏览器 `dblclick`：第一次点击会把 `ValueView` 换成 input，DOM 节点已变，原生 `dblclick` 在该场景不可靠。
- 判定：记录上一次 pointerdown 的时间与坐标；同一值区 ≤300ms 且位移 ≤6px 视为双击；目标落在 `.dpb-dt-panel` 内时不计入双击。
- `idle`：单击（pointerdown）→ `start()` 打开面板。
- `open`：双击的第二次 pointerdown → `focusPicker()`：
  - 日期时间：聚焦 `[data-testid="dpb-time-hour"]`；
  - 日期：聚焦当前选中日格；无选中时聚焦当月第一个可聚焦日格。
- 双击只做「打开 + 聚焦」，不调用 `finish`，因此不会保存。
- 值区 input 在面板打开时始终可聚焦、可编辑；键入不要求先双击，也不需要关闭面板。
- 键盘可访问性保留：`ValueView` 的 Enter / Space 仍打开面板（不做键盘版双击）。

### D3 草稿同步与一次性提交

- **单一文本真相**是 `draft: string`（初值 `rawForEdit(field)`，空值为 `""`）。
- picker 的 `datePart` / `timePart` 由 `splitDatetime(draft)` 派生，用于月历高亮与时分显示；picker 的选择反向组合并 `setDraft`，保证「输入什么就看到什么」。
- `touched` 在任意键入或 picker 操作时置 true。
- 唯一出口 `finish("commit" | "cancel")`：
  - Enter、外部 pointerdown、失焦 → `touched ? "commit" : "cancel"`；
  - Esc → `"cancel"`。
- `doneRef` 在 `finish` 首行置位并早退，确保 blur、外部 pointerdown、Enter 三条路径只提交/取消一次。
- commit：`validateFieldValue(type, draft)`；成功 → `onCommit` 一次并关闭；失败 → 关闭、不写回、保留原值、以既有 `dpb-error` 显示中文 reason。
- cancel：关闭、丢弃草稿、不写回。
- picker 内普通操作（日期时间的日格、时分、月/年切换）只改草稿，不提交。

### D4 日期日格即时提交与双触发防护

- 仅 `dateOnly` 的日格选择走「选即提交」：
  1. 把 picked 日期写入同步快照（`latest` ref），避免 React 状态更新尚未落地时读到旧值；
  2. 调 `finish("commit")`；
  3. `finish` 首行的 `doneRef` 立即阻止随后可能发生的 blur / 外部 pointerdown 二次提交。
- 日格与「今天」都在 `wrapRef` 容器内：文档级 pointerdown 处理器对容器内目标早退；容器 blur 的 `relatedTarget` 在容器内也早退。两道早退 + `doneRef` 共同保证只提交一次。
- 日期时间字段的日格保持只写草稿（`touched=true`），不提交。
- 空日期字段点日格属于显式选择，提交所选日期；这与「空输入保存为空」不冲突——后者指用户在值区清空后提交。
- 日期模式下「今天」与日格同路径（选择即提交并关闭），因为它同样是一次显式日期选择；日期时间模式下「今天」只填日期与当前时分、保持面板打开。

### D5 归一化与空值

归一化与校验放在 `src/lib/frontmatter.ts`，由 `validateFieldValue` 统一出口，picker 与直接输入共用；`coerceFrontmatterValue` 自动继承。

- **date**：trim 后接受 `YYYY-MM-DD` 或 `YYYY/MM/DD`；校验真实公历日期；输出 `YYYY-MM-DD`。
- **datetime**：trim 后日期部分同 date；分隔符接受 `T` 或空格；必须有 `HH:mm`；秒 `:ss` 可选；输出 `YYYY-MM-DDTHH:mm`，秒非 `00` 时保留 `:ss`，`:00` 丢弃；只给日期时按 `T00:00` 归一。
- **空值**：date / datetime 的 trim 后空串返回 `{ ok: true, value: "" }`，写回空值；不补「今天」，不渲染 `—`。number / boolean 的空串仍按既有规则拒绝，不扩大空值容忍面。
- **非法**：其它格式返回 `{ ok:false, reason }`；date 沿用「日期格式应为 YYYY-MM-DD」，datetime 沿用「日期时间格式不正确」。调用方关闭面板、保留原值并提示，不写回。
- 归一化只影响提交后的存储形；`formatFrontmatterValue` 的展示规则不变。

### D6 托管日期只读

- `FieldValue` 现有的 `effectiveEditable = editable && !isManagedDateKey(field.key)`（:1787）保持不变：托管键不会进入 `DatetimeEditor`，因此不会出现新的输入、粘贴或双击编辑入口。
- footer 的只读展示与锁语义不动（既有 requirement）。
- 以 e2e 断言托管日期区域没有 textbox、双击不产生 `dpb-datetime-editor`，防止未来把值区控件误接到托管键。

### D7 不改布局（锁定非目标）

- `--dpb-cal-width` / `--dpb-cal-cell` / `--dpb-cal-nav` / `--dpb-cal-gap` 不变；`.dpb-dt-step` 的 56px 组与 O2 的时分间距不变。
- 面板宽度、footer、形态切换、A/B 布局不变。
- 值区元素类型变化只允许沿用既有盒模型；若实现必须新增 class，只做等价样式，不引入像素值，也不改 `docs/design/system/spec.md`。

## 状态机

| 当前态 | 事件 | 结果 |
|---|---|---|
| idle | 单击值区 | `start()`：面板打开，input 获焦，`draft` 为当前值 |
| idle | 双击值区的第一次点击 | 同上（打开） |
| open | 双击的第二次 pointerdown（同区 ≤300ms/≤6px） | `focusPicker()`：日期时间→时分输入；日期→日格；不提交 |
| open | 键入 / 粘贴 | `draft` 更新，`touched=true`，面板保持 |
| open | 点日格（datetime） | `draft` 更新，`touched=true`，面板保持 |
| open | 点日格 / 「今天」（date） | 一次提交并关闭 |
| open | 点时分步进 / 月年切换 | `draft` 或视图更新，不提交 |
| open | Enter / 失焦 / 点外部 | `touched ? commit : cancel`，只执行一次 |
| open | Esc | cancel：关闭、丢弃草稿、原值不变 |
| open | commit 校验失败 | 关闭、不写回、保留原值、显示错误 |
| open | commit 校验成功（含空值） | 写回一次并关闭 |

## 数据面

无。本 change 不新增任何用户可设置项、持久化字段或注册表条目；不触及配置 schema、前后端桥接、样式 token 词表或工具栏动作表。日期/日期时间沿用既有字段类型、既有面板与既有形态持久键，仅调整值区的编辑与提交行为。机检：`./scripts/cw-data-surface.sh new doc-property-datetime-entry` → `SKIP`（未命中路径/关键词信号）。

## 风险 / Trade-offs

- **双击检测**：依赖 pointerdown 时间/坐标而非原生 `dblclick`，因为第一次点击会替换 DOM；阈值（300ms / 6px）是交互常量，不属视觉刻度，不写入设计系统。→ 组件测试直接构造两次 pointerdown，锁定行为。
- **重复提交**：blur + 外部 pointerdown + Enter 可能同时触发；`doneRef` 是既有机制，本次在「日期日格即时提交」路径上先写同步快照再调用，避免读到旧草稿。→ 单测断言 dispatch 恰好一次。
- **Tab 回归**：值区 input 加入 DOM 后若被误纳入 panel 停靠点，会改变既有 Tab 顺序。→ `moveDtFocus` 仍只查 panel；补一条「输入框上 Tab 仍进入 panel、正文首字符不变」的断言。
- **容错放宽**：`YYYY/MM/DD` 由拒绝改为接受，会让类型切换的转换成功率变高；这是已确认的粘贴容错，不是推断规则变更。→ 单测锁定归一化结果，`inferFrontmatterType` 不动。
- **日期日格语义变化**：既有「面板内操作不提前提交」不再覆盖日期日格；该场景在 delta 中收窄到日期时间。→ 同步改任务与 e2e，避免旧断言把新行为当回归。
- **空值写回**：`writeFrontmatter` 会把 `""` 序列化为空字符串值，YAML 仍是合法键值；不删键、不写 `null`。→ e2e 核对源码为 `key: ""`。

## 测试策略

- 纯函数单测：date/datetime 归一化（`/`、空格、`T`、可选秒）、空值合法、非法 reason 不变。
- 组件测试：编辑态存在可编辑文本控件（非原生 date/time）；日期日格单击 dispatch 恰好一次且编辑器关闭；Enter 直接输入提交；Esc 回退；双击后焦点在时分输入 / 日格。
- e2e：直接键入与粘贴归一化；日期日格单击关闭；日期时间日格不提交；双击聚焦；空值写回空字符串；非法回退并显示错误；托管日期无输入且双击无编辑器。
- 既有测试改动详见 `tasks.md` 每票的「变更的既有测试」。
