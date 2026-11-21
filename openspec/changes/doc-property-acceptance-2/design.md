# 设计 — doc-property-acceptance-2

来源：维护者对 `doc-property-refine-1121` 的验收反馈（8 项）。既有规格：`openspec/specs/doc-property-panel/spec.md` 的 P-3 / P-4 / P-5 / P-8 / P-9 / P-10 / 添加字段控件区；视觉数值唯一来源 `docs/design/system/spec.md` §3 §5 §7.2。

## Context

- 面板仍是单组件 `src/components/Content/DocPropertyBar.tsx`（A/B 两分支），A/B 行分别走 `.dpb-a-meta` 胶囊流与 `.dpb-b-row` 五列网格。
- 现状缺陷定位（已核对源码）：
  - `inferFrontmatterType` 对非日期字符串返回 `unknown`，`toFields` 因此把 `priority: 高` 显示成「?」。
  - `ValueView` 的 `title` 只在**非编辑态且 `display.length > 24`** 时给全文；A 胶囊按宽度截断时不给。
  - `.dpb-v { font-weight: 550 }`；A 值经 `.dpb-chip`（`font-size: 1em`）继承面板根字号，B 值经 `.dpb-b-value`（`1em`）→ `.dpb-b-row`（`--dpb-field-font-size: 1em`）继承同一面板根字号，**A/B 计算字号实际相等**，不存在「A 值更大」的独立规则。
  - `.dpb-b-row { grid-template-columns: 16px auto 92px minmax(0,1fr) 18px }` 把标签列钉死 92px；CSS 中没有任何 `border-left/right`，列间本无竖线。
  - `.dpb-tag-x` 常驻；`.dpb-variant-toggle` / `.dpb-collapse` 常驻。
  - `.dpb-panel.dpb-collapsed { opacity: var(--dpb-collapsed-opacity, 0.35) }`。
  - `.dpb-b-foot { padding: 7px 0 1px }`、`.dpb-a-foot { margin-top: 8px; padding-top: 7px }`；`.dpb-count` 无样式。
  - `!parsed.present` 分支渲染 `.dpb-empty`（含「首次添加字段时自动创建」文案与添加按钮）；页签右键菜单在 `src/components/TabBar.tsx`，与面板无通信。

## Goals / Non-Goals

**Goals:**

- 8 项验收逐条可机检（计算样式 / DOM 属性 / 单测断言）。
- 不新增用户可配置项；形态存储值 `docPropertyVariant`（A/B）与 `displayStyle`（list/dual）不变。
- 视觉数值只落 `docs/design/system/spec.md`，组件引 token。

**Non-Goals:**

- **O2 不在范围**：日期选择器密度（`--dpb-cal-*`）已在上一批完成，本 change 不动。
- **O6 不在范围**：footer 锁图标 12px（`--dpb-lock-size`）已达标，本 change 不动。
- 不改面板整体宽度（`--type-measure`）、不改日期选择器、不改 A/B 按钮顺序与 footer 左右次序（计数左、日期右）。
- 不重做 `doc-property-refine-1121` 已归档的任何条目。

## Decisions

### D1（B1a）纯字符串推断为 text

`inferFrontmatterType` 的字符串分支改为：命中 `DATE_RE` → `date`；命中 `DATETIME_RE` → `datetime`；**其余一律 `text`**。`unknown` 只由「非 string / number / boolean / array 的值」产生（如 YAML 映射）。`toFields` 的 `empty ? "text" : inferFrontmatterType(value)` 保持不变（空串仍 `text`）。

- 影响既有单测：`frontmatter.test.ts` 三处 `unknown` 断言（`custom-note`、`priority`、缺省配置下的 `customdate`）改为 `text`；测试名「值可推断 + 纯文本未知」改为「值可推断 + 纯文本默认 text」。
- 收编入口不消失：用户仍可在类型菜单把 `text` 改成 `select` / `multiselect` 等；P-8 的「?」只留给对象值。

### D2（B1b）截断值暴露全文

`ValueView` 去掉 `long = display.length > 24` 启发式：**`field.display` 非空时 `title` 恒等于 `field.display`**（A/B 共用同一 `ValueView`，天然一致）；空值不设 `title`。编辑态 `title` 由「点击编辑值」改为全文（点击编辑能力由 `role="button"` + `tabIndex` + `cursor: text` 承担）。

- 判据：值超两行截断时 `[data-testid="dpb-value"]` 的 `title` === 完整 `display`；A 胶囊按宽度截断时同样成立。

### D3（B3）值字重与字号

- `.dpb-v` 删除 `font-weight: 550`（回落继承常规字重）；不改 `.dpb-b-value` 的 `font-size: 1em`。
- 不动 `.dpb-a-title`（面板标题 17px 固定）。A/B 值字号已经同为面板根字号的 1em，无需新增规则。
- 判据：值计算 `font-weight` ∈ {400, normal}；同一行字段名与值计算字号相等。

### D4（O1）B 标签列自适应、值列让位、无竖线

- `.dpb-b-row` 网格改为：
  ```css
  grid-template-columns: 16px auto minmax(0, max-content) minmax(0, 1fr) 18px;
  ```
  第三段（标签列）随内容增长到 `max-content`，第四段（值列）`minmax(0,1fr)` 让位。
- 标签列上限走新 token `--dpb-label-max-width`（§7.2 新增，取值 `16em`），落在 `.dpb-b-label { max-width: var(--dpb-label-max-width, 16em) }`；`max-content` 贡献被该 `max-width` 收口，长名在 cap 内完整、超 cap 才省略号。
- A 胶囊同一优先级：`.dpb-k { max-width: var(--dpb-label-max-width, 16em) }`（保留 `overflow:hidden; text-overflow:ellipsis`），值 `.dpb-v { min-width: 0 }`；胶囊在 `.dpb-a-meta`（`flex-wrap: wrap`）中让位换行。
- 列间不渲染竖向分隔线：`.dpb-b-row` 与五个单元格 `border-left/right` 一律 none（现状本就没有，本条为显式锁定）。
- 判据：长名文档与短名文档的 `gridTemplateColumns[2]` 计算值不同且随内容变化（不再是固定 92px）；cap 内字段名 `scrollWidth <= clientWidth`；行与单元格计算 `border-left-width`/`border-right-width` 为 0px。

### D5（O3）控件悬停显隐

- `.dpb-tag-x`：默认 `opacity: 0`；`.dpb-tag:hover .dpb-tag-x`、`.dpb-tag:focus-within .dpb-tag-x`、`.dpb-tag-x:focus-visible` → `opacity: 1`。
- `.dpb-variant-toggle` 与 `.dpb-collapse`：默认 `opacity: 0`；所在工具条 `.dpb-a-tools:hover` / `.dpb-b-tools:hover` / `:focus-within` → 1，且按钮自身 `:focus-visible` → 1。
- 行拖拽手柄与行尾删除叉号**不改**（已是 hover/focus 显隐，占位宽度不变），仅回归核对。
- 折叠按钮只在职辑态渲染（`collapseButton = editable ? … : null`，P-1）；预览态工具条只有 L/T 形态切换按钮，按同一规则显隐。
- 判据：未悬停时上述控件计算 `opacity` 为 0；悬停父容器或聚焦时为 1；`toBeVisible` 不受影响（opacity 不改变 Playwright 可见性）。

### D6（O4）折叠全透明

- `--dpb-collapsed-opacity` 取值 0.35 → **0**：先改 `docs/design/system/spec.md` §7.2 表格，再改 `src/styles/tokens.css`，CSS 仍写 `opacity: var(--dpb-collapsed-opacity, 0)`。
- `.dpb-panel.dpb-collapsed:hover / :focus-within { opacity: 1 }` 保持；只改透明度，不加 `display`/`height` 规则。
- 判据：折叠态计算 `opacity` 为 0，悬停/聚焦为 1；折叠切换不引入额外布局位移。

### D7（O5）footer 收敛与预览计数胶囊

- footer 垂直内距取 §3 刻度：`.dpb-b-foot { padding: var(--space-4) 0 var(--space-2) }`（现状 `7px 0 1px`）；`.dpb-a-foot { margin-top: var(--space-4); padding-top: var(--space-4) }`（现状 `margin-top: 8px; padding-top: 7px`）。
- 预览态（`mode !== "edit"`）`.dpb-count` 渲染为左对齐胶囊：`border: 1px solid var(--app-border); border-radius: var(--radius-full); padding: 1px 8px;`（圆角/描边取 §5 `--radius-full`、§6 `--app-border`）；编辑态保持纯文本（无描边）。
- A/B 托管日期仍在右（`.dpb-dates { margin-left: auto }` 不变）。
- 判据：B footer 计算 `padding-top` ≤ 4px、A footer `margin-top` ≤ 4px；预览态计数 `border-top-width` > 0 且 `border-radius` ≥ 高度一半，编辑态为 0；计数仍在日期左侧。

### D8（O7）去空态引导 + 页签右键「添加字段」

- 删除 `!parsed.present` 分支的 `.dpb-empty` 渲染（含文案与添加按钮）；无 frontmatter 时面板不渲染空态卡片。同步删除 `.dpb-empty` / `.dpb-empty-add` CSS。首次添加字段仍自动建 frontmatter 块（`insertField` 现有逻辑不变）。
- 调色板触发从「组件内按钮」提升为「跨组件请求」：
  - `src/stores/docPropertyPanel.ts` 新增会话态 `paletteRequest: { docKey: string; nonce: number } | null` 与 `requestPalette(docKey)` / `consumePaletteRequest()`；**不落盘**（不进 `docPropertyVariant` 等持久键）。
  - `src/components/TabBar.tsx` 页签右键菜单（`data-tab-menu`）新增「添加字段」项：`onClick` 调 `requestPalette(menu.tabId)` 后 `closeMenu()`（沿用既有关闭协议：外点 / Esc / 失焦 / 滚动）。
  - `DocPropertyBar` 订阅 `paletteRequest`：`request.docKey === docKey` 时，以本面板内 `[data-testid="dpb-add-field"]` 的 rect 为锚点 `setPaletteOpen(true)`，随后 `consumePaletteRequest()`。仅 `editable`（`mode === "edit"`）且面板未隐藏时响应；否则忽略。
  - 分屏下按 `docKey` 匹配，只有该页签文档的面板打开调色板。
- 判据：右键页签出现「添加字段」项；点击后菜单关闭且该页签文档的 `[data-testid="dpb-field-palette"]` 出现；Esc / 外点关闭调色板；无 frontmatter 文档 `[data-testid="dpb-empty"]` 计数为 0。

### D9 规格修订（实现前置）

- `docs/design/system/spec.md` §7.2：新增 `--dpb-label-max-width: 16em`；`--dpb-collapsed-opacity` 改 0。`src/styles/tokens.css` 同步。
- `openspec/specs/doc-property-panel/spec.md` 由本 change 的 delta 表达（P-3 / P-8 / P-9 / P-10 / 添加字段控件区 + 新增「控件悬停显隐与折叠淡出」）；主规格在合并后经 `/opsx-sync` 同步，本 change 期间不得直改主规格。

### D10（O8）日期选择器底部提示默认隐藏、悬停/聚焦显示

- `.dpb-dt-foot` 内的 `.dpb-dt-hint` 默认 `opacity: 0`；`.dpb-dt-foot:hover .dpb-dt-hint`、`.dpb-dt-foot:focus-within .dpb-dt-hint`、`.dpb-dt-hint:focus-visible` → `opacity: 1`。
- **触发面是整条 footer 行**（含「今天」按钮所在的 `.dpb-dt-foot`），不是 hint 文字本身：指针进入 footer 任意位置即显现，移出即隐藏；footer 内任意元素获焦（`:focus-within`）也显现。
- **只改透明度**：hint 在 `.dpb-dt-foot`（`flex; justify-content: space-between`）中本就占位，显隐不改 `height`/`padding`/布局，footer 与面板高度不变（无回流）。
- **日期与日期时间一致**：两者共用 `DatetimeEditor` 的同一 `.dpb-dt-foot`（date-only 只是不渲染时分行），规则天然覆盖两个选择器。
- **键盘行为不变**：Esc 取消 / Enter 保存 / 点击外部保存沿用既有 `finish` 链路；本次只加显隐。
- **不新增 token**：直接 `opacity: 0` + `transition: opacity .12s`（与 `.dpb-row-x` 同款字面过渡）。若后续要收敛，才按规范补 §7.2 与 decisions 台账，不在本票写死数值到任务。
- 判据：未悬停/未聚焦时 `.dpb-dt-hint` 计算 `opacity` 为 0；指针进入 `.dpb-dt-foot` 或 footer `:focus-within` 时为 1；footer 高度在显隐前后不变。

## 数据面

触发信号：信号 B（文案命中 `DATA_SURFACE_KEYWORDS` 的「图标」——本 change 涉及 L/T 形态图标与标签叉号的显隐）与信号 A 的消费落点（`DocPropertyBar.tsx` 消费 `src/ui/icons` 注册表与 `--dpb-*` token）。机检：`./scripts/cw-data-surface.sh new doc-property-acceptance-2` → 六栏齐全（退 0）。

**O8 复核**：日期面板底部提示显隐只改 `opacity` 与过渡，不新增配置字段/主题/图标/菜单/轮盘/开关，也不新增 token——**无新触发信号，上表六栏保持不变**。

| 落点 | 位置 | 载体/符号 | 判据 |
|---|---|---|---|
| 规格 | design-system:§7.2;design-system:§3;design-system:§5 | — | 列宽上限与折叠透明度先补 spec 条款与 token；footer 内距与胶囊圆角引用既有刻度，不自造数值 |
| 存储 | src/stores/docPropertyPanel.ts | docPropertyVariant | 形态/折叠/显隐持久键不变；调色板请求为会话态，不落盘 |
| 校验 | src/lib/frontmatter.ts | inferFrontmatterType | 纯字符串与空串都归 text，unknown 仅留给非字符串不可推断值 |
| 桥接 | src/hooks/useConfig.ts | applyRustConfig | 无新增配置字段；形态偏好沿用既有桥接与热应用 |
| 消费 | src/components/Content/DocPropertyBar.tsx | DocPropertyBar | 列宽/显隐/透明度/计数胶囊由本组件消费 token，不新增常量数组或内联一次性 SVG |
| 回滚 | src-tauri/src/config.rs | snapshot_user | 无配置写路径变更，沿用写前快照与 restore_config_snapshot 回滚 |

## 风险 / Trade-offs

- **B1a 语义外溢**：纯字符串不再「?」，P-8 的收编场景需从 `priority: 高` 改为对象值；已登记的三处单测断言同步改。→ 单测与 e2e 双改，e2e 增加「纯字符串显示 Aa 而非 ?」。
- **O1 列宽回归**：`minmax(0, max-content)` 在超长字段名下由 `max-width` 收口；既有 e2e 断言 `tracks[2] ≈ 92` 必须改为「随内容变化」。→ 该断言改写为长短名对比。
- **O3 可见性**：opacity 0 在 Playwright 仍算 visible，既有 `toBeVisible` 断言不受影响；但既有 e2e 直接点击 `.dpb-variant-toggle` / `.dpb-collapse` 仍可用（opacity 不拦截指针）。→ 新增「计算 opacity」断言而非可见性断言。
- **O4 折叠不可见**：折叠态全透明后，用户可能「找不到」折叠条；靠 hover 显现（既有交互）。→ 保留 `:hover`/`:focus-within` 恢复 1，不改高度。
- **O7 跨组件状态**：`paletteRequest` 必须按 `docKey` 匹配并在消费后清除，否则分屏下会误开或常驻。→ 单测覆盖「请求只被匹配面板消费一次」。
- **既有 e2e 空态用例**：`无 frontmatter：空态引导文案` 需删除/改写为「不渲染空态 + 页签菜单可添加字段」。
- **O8 提示常驻**：hint 默认透明后，用户可能读不到键盘提示；靠 footer 悬停/聚焦显现。→ 保留占位不删元素（屏幕阅读器仍可读），只改透明度。

## 测试策略

- 纯函数优先：`inferFrontmatterType` / `parseFrontmatter` 用单测锁定（B1a）。
- 计算样式断言：列宽（gridTemplateColumns）、字重、opacity、padding、border-radius 走 e2e `getComputedStyle`，不断言「元素存在」。
- e2e 只验证「页面看得见」：截断 title 全文、悬停显隐、折叠透明度 0→1、footer 几何、页签菜单 → 调色板、日期面板底部提示悬停显现（日期与日期时间各一次）。
- 不新增截图基线；沿用 `cw-evidence.sh record-state` 记录 展开/折叠/悬停/预览四态。
