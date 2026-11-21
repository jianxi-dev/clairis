## Why

文档属性面板上一批（`doc-property-refine-1121`）已归档，但维护者验收又留下 9 项细节：纯字符串值仍显示「? 未识别」、截断值在 A 态看不到全文、值字重偏粗、B 态标签列固定 92px 截断长字段名、标签叉号/形态切换/折叠按钮常驻干扰、折叠态仍淡显 0.35、footer 偏高且预览计数不是胶囊、无 frontmatter 时的空态引导与「添加字段」入口分散、日期/日期时间面板底部提示文案常驻占位。

这些都不是新能力，而是既有 requirement（P-3 类型系统、P-4 行操作、P-5 标签、P-9 写回与空态、P-10 A/B 视觉锚点、添加字段控件区）在真机上的落点不完整或口径漂移。本 change 只做这 8 项收敛，不重做已完成的 O2（日期选择器密度）与 O6（锁图标 12px）。

## What Changes

- **B1a 纯字符串默认文本**：`inferFrontmatterType` 对非空纯字符串返回 `text`（不再 `unknown`）；`unknown` 只保留给无法推断的非字符串值。空串仍为 `text`。
- **B1b 截断值暴露全文**：值被两行截断或胶囊宽度截断时，A/B 两态都以 `title` 属性暴露完整文本；去掉「长度 > 24 才给 title」的启发式。
- **B3 值排版**：字段值去粗体（`.dpb-v` 的 `font-weight: 550` 移除），字号维持 1em 随正文；面板标题字号固定不动。
- **O1 B 标签列自适应**：B 行网格去掉固定 92px 标签列，改 `minmax(0, max-content)` + 上限 token；值列让位；列间不渲染竖向分隔线。A 胶囊同一优先级（字段名在 cap 内完整、值让位换行）。
- **O3 控件悬停显隐**：标签删除叉号、L/T 形态切换按钮、折叠按钮默认 `opacity: 0`，所在行/胶囊/工具条 `:hover`、`:focus-within`、`:focus-visible` 时显现；行拖拽手柄与行尾删除叉号维持既有悬停显隐。
- **O4 折叠全透明**：折叠态默认 `opacity: 0`（token `--dpb-collapsed-opacity` 0.35 → 0），悬停/聚焦恢复 1；只改透明度，不改布局高度。
- **O5 footer 收敛**：footer 垂直内距收窄（取 §3 间距刻度）；预览态字段计数渲染为左对齐胶囊，编辑态保持纯文本；A/B 托管日期仍右对齐。
- **O7 空态与添加入口**：移除「暂无 frontmatter 属性」空态引导；在页签右键菜单新增「添加字段」命令，打开该页签文档既有的字段调色板（菜单随即关闭）。
- **O8 日期选择器底部提示显隐**：`.dpb-dt-foot` 内的 `.dpb-dt-hint`（`Esc 取消 · Enter 保存 · 点击外部保存`）默认隐藏（`opacity: 0`），指针进入整条 footer 行或 footer 获得键盘焦点时显现；只改透明度、不改变 footer/面板高度。**日期与日期时间两个选择器共用同一 footer，一并生效**；既有 Esc / Enter / 点击外部保存行为不变。
- **BREAKING（规格语义）**：P-9「无 frontmatter 的文档显示空态引导」条款废止；P-8 的「?」收编态收窄到非字符串不可推断值。存储值 `docPropertyVariant`（A/B）与 `displayStyle`（list/dual）不变。

## Capabilities

### New Capabilities

- 无新增能力域。

### Modified Capabilities

- `doc-property-panel`：P-3（纯字符串默认 `text`）、P-8（`unknown` 收窄，收编场景改为对象值）、P-9（去空态引导）、P-10（截断全文、值字重与字号、B 标签列自适应、footer 与预览计数胶囊）、添加字段控件区（页签右键菜单入口）；新增「控件悬停显隐与折叠淡出」requirement（O3/O4）。

## Impact

- 前端：`src/lib/frontmatter.ts`（`inferFrontmatterType`）、`src/components/Content/DocPropertyBar.tsx`（值 title、工具条显隐、footer、空态、调色板触发、日期面板底部提示显隐）、`src/components/TabBar.tsx`（页签右键菜单项）、`src/stores/docPropertyPanel.ts`（调色板请求状态与 action）、`src/styles/doc-property.css` 与 `src/styles/tokens.css`（列宽/字重/显隐/透明度/内距）。
- 设计系统：`docs/design/system/spec.md` §7.2 需新增 `--dpb-label-max-width`、把 `--dpb-collapsed-opacity` 改为 0；§3 间距刻度被 footer 内距引用（不新增值）。
- 测试：`src/__tests__/frontmatter.test.ts`（推断用例由 `unknown` 改 `text`）、`src/__tests__/components/Content/DocPropertyBar.test.tsx`（列宽/字重/显隐）、`e2e/doc-property-panel.spec.ts`（92px 列宽断言、空态用例、footer 几何、悬停显隐、页签菜单）。
- 无新增外部依赖；无 Rust 侧改动；无配置 schema 变更。
