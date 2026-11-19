# 设计：搜索替换交互修补（一.1 / 一.3 + 新增①②）

## Context

- 需求输入：GitHub #1153（spec issue）+ 其评论「对账确认（2026-11-19）」，为最终依据。一.1 ★A 普通搜索态也弹全文预览（放开 `replaceMode` gate）；一.3 ★A 预览态显示替换按钮但灰置禁用；新增①移除替换模式每行 inline diff；新增②结果行交替背景色（斑马纹）。
- 基准：`openspec/specs/search-replace-float/spec.md`（S-3/S-4 现状）；`openspec/changes/archive/2026-11-18-search-replace-refine/`（上一版 S-3/S-4 形态）。
- 现状代码（探查实证）：
  - 悬停预览 gate：`SearchReplacePanel.tsx:459` `if (!replaceMode || !canReplace || !container) return;`；`canReplace = mode !== "preview"`（:408）。e2e `search-float.spec.ts:764` 断言「普通搜索不弹」。
  - 替换按钮：`SearchReplacePanel.tsx:849` `{canReplace && (...)}` 渲染 ⇄（预览态整颗不渲染）；替换行 `:864` `{canReplace && replaceMode && (...)}`。
  - inline diff：结果行内 `[data-testid="search-float-diff"]`（`del`/`ins`）+ `.search-float-diff*` CSS（`search-float.css:395-412` 附近）；e2e `:687` 断言原词删除线 / 新词强调色。
  - 结果行样式：`.search-float-hit` 透明底，`:hover` 用 `--app-sunken`，`.search-float-hit-cur` 用 `--app-accent-soft`（`search-float.css:183-205`）；结果容器 `.search-float-results` 透明，浮窗壳 `--app-surface`。
- 硬约束：三模式 CSS display 切换不 remount；不改 `src-tauri/`；delta 逐字保留既有场景标题（archive abort 防线）；视觉数值只引用 `docs/design/system/spec.md` 条款，不复制像素值。

## Goals / Non-Goals

**Goals:**

- 普通搜索态（编辑 / 源码态）悬停结果行即弹全文预览卡，与替换模式一致。
- 预览态输入行 ⇄ 按钮可见但灰置禁用，`title` 说明「预览态不可替换」。
- 替换模式结果行不再渲染「原词 → 新词」inline diff。
- 结果区相邻两行背景色不同（隔行交替），底色取设计系统既有 surface / sunken 语义色。

**Non-Goals:**

- 预览态悬停预览（`canReplace` 仍为 gate，预览态不弹卡）——用户未提，避免范围扩大。
- S-3 的「指针悬停更新 activeIndex」语义、S-6 状态栏、替换事务 / 计数 / 自动跳下一处等既有能力。
- 新增色 token / 改 `tokens.css`（本 change 不改 `src/` 之外的设计 token 文件；斑马纹复用既有语义色）。

## Decisions

1. **悬停预览 gate：只移除 `!replaceMode`，保留 `!canReplace`**。`onHitMouseEnter` 的判断改为 `if (!canReplace || !container) return;`。理由：用户诉求是「普通搜索态也弹」，普通搜索态位于编辑 / 源码态（`canReplace` 为真）；预览态 `canReplace=false` 的既有行为不动，避免把「只读预览卡」语义扩大到预览态。替代方案（连 `!canReplace` 一并移除，预览态也弹卡）未获用户要求，且预览态选择态 / 定位链路不同，弃。
2. **预览态 ⇄ 按钮：始终渲染 + 禁用态**。把 `SearchReplacePanel.tsx:849` 的 `{canReplace && (...)}` 改为无条件渲染该按钮，追加 `disabled={!canReplace}`；`title` 在 `!canReplace` 时为「预览态不可替换」，否则维持「切换替换」；`aria-pressed` / `onClick` 语义不变（禁用态点击不触发）。替换行仍由 `canReplace && replaceMode` 把关。CSS 追加 `.search-float-replace-toggle:disabled` 灰置（`opacity` / `color` 取既有语义色，不新增 token）。理由：满足「可见但禁用 + title 说明」，同时保留 `canReplace` 作为替换能力总闸。
3. **斑马纹：复用既有 surface / sunken，奇数行 surface、偶数行 sunken**。CSS 在 `.search-float-hit` 基规则之后、`:hover` / `-cur` 之前插入 `.search-float-hit:nth-child(odd/even)` 背景规则，靠源码顺序让悬停 / 选中覆盖交替底色（避免提高选择器权重压过 hover）。理由：满足「相邻两行背景色不同」，零新 token、零 `tokens.css` 改动；两色均为 `docs/design/system/spec.md` §6 既有语义色。替代方案（新增 `--app-row-stripe` token）需同步改 `src/styles/tokens.css` 与 §6 三主题誊写，超出「不改 src」边界且无必要，弃。
4. **inline diff：只删展示层，不动替换逻辑**。移除结果行内 `[data-testid="search-float-diff"]` 的 `del`/`ins` 渲染与 `.search-float-diff*` CSS；保留 `buildReplaceChanges` / `applyReplaceChanges` / `replaceOne` / `replaceAll`（替换事务、自动跳下一处、计数均不变）。理由：用户只要求「不再显示 diff 信息」，替换能力本身保留。
5. **delta 口径**：S-4 移除 inline diff 条款、把「悬停全文预览仅替换模式」断言反向修订为「两种模式均弹」、新增「预览态替换按钮灰置禁用」场景；S-3 新增「结果行交替背景色（斑马纹）」场景，并把「悬浮全文预览为渲染态」的 WHEN 去掉「替换模式下」限定（与 gate 放开一致）。所有既有场景标题逐字保留，反向修订项加 `>` 可追溯注记。
6. **测试口径**：e2e 改造四点——`:687` 反向为「替换模式结果行无 diff 元素」、`:764` 改为「普通搜索态与替换模式悬停均弹卡」、`:800` 反向为「预览态 ⇄ 可见且 `disabled` + title 为「预览态不可替换」」、新增「结果行相邻背景色不同（断言计算背景色）」；`bash scripts/verify.sh` 全绿。
7. **数据面判定**：本 change 触及搜索结果行 / 替换按钮 / 悬停预览，均为交互与样式，**无可配置面变更**（无配置字段 / 主题 / 图标表 / 菜单 / 轮盘 / 能力开关）。G0 `./scripts/cw-data-surface.sh new search-replace-interaction` 命中关键词信号（触发源即本条否定式枚举的「图标 / 轮盘 / 开关」字样），按「误报优先」契约在「## 数据面」填六栏，逐栏写明真实落点与「不改」判据，结论零落点；原始输出见 G0 记录。

## 数据面

信号命中「快捷键 / 图标 / 轮盘 / 开关」关键词（决策 7 的否定式枚举触发），按 `docs/agents/data-surface.md` §三填六栏。结论：**无可配置面变更**——四处修正均为交互与样式，不新增配置字段 / 主题 token / 图标注册 / 菜单 / 轮盘 / 能力开关；下表逐栏写明真实落点与「不改」判据：

| 落点 | 位置 | 载体/符号 | 判据 |
|---|---|---|---|
| 规格 | design-system:§6 | — | 斑马纹交替底色取 `--app-surface` / `--app-sunken` 既有语义色；新增 / 删除色必须先有 spec §6 条款 |
| 存储 | src-tauri/src/config.rs | AppConfig | 本 change 不触及 config.rs（无新增键）；四处修正均为组件内瞬态状态与样式，不落盘 |
| 校验 | src/lib/shortcuts.ts | activateLocalContext | 本 change 不触及；⌘1~9 / Enter / ↑↓ / Esc 均为 S-5 既有注册项，不新增 / 不移除 |
| 桥接 | src/hooks/useConfig.ts | applyRustConfig | 本 change 不触及；无配置热应用改动，浮窗设置沿用既有字段 |
| 消费 | src/components/Content/SearchReplacePanel.tsx | SearchReplacePanel | 结果行 / ⇄ 按钮 / 悬停预览均为组件内常量与样式，不读 AppConfig、不建新数据文件 |
| 回滚 | git revert 本 change 各票 commit 即整体回退 | —（无数据写入路径） | 四处修正零数据写入；回退 = revert commit，无缺省回落路径引入 |

## Risks / Trade-offs

- [移除 inline diff 后用户失去替换前的视觉预览] → 用户已确认「不再显示」；替换事务仍可撤销，风险低。
- [斑马纹与悬停 / 选中底色叠加] → 靠 CSS 源码顺序让 `:hover` / `-cur` 后置覆盖；e2e 断言悬停行背景为 `--app-sunken`、当前命中行为 `--app-accent-soft`。
- [预览态 ⇄ 禁用态可访问性] → 用原生 `disabled` + `title`，不自绘伪禁用（避免键盘焦点陷阱）。
- [e2e 既有断言反向] → `:687` / `:764` / `:800` 同步改写，避免旧断言与新规格冲突导致 CI 红。
- [预览态 ⇄ 可见 vs S-1「预览态不出现替换」场景] → S-1 该场景的「替换操作」指替换输入框与替换动作；灰置禁用的 ⇄ 切换入口不构成替换操作，S-4 delta 已明文「⇄ 可见但呈灰置禁用态」。本 change 不改 S-1；若验收判定两场景冲突，再补 S-1 delta。

## Migration Plan

1. 悬停 gate：`onHitMouseEnter` 条件调整（行为修正）。
2. 预览态 ⇄：条件渲染改始终渲染 + 禁用态 + title。
3. inline diff：删渲染 + CSS。
4. 斑马纹：CSS `nth-child` 规则。
5. e2e 改造 + `verify.sh` 收口。
- 每步可独立合入 main（无数据 / 存储结构变更）。
- 回滚：按提交粒度回退；无配置 / 快照回滚需求。

## Open Questions

- **OQ-1**：预览态是否也应弹悬停全文预览卡（即连 `canReplace` 一并放开）？G0 倾向**不放**（用户只提普通搜索态，且预览态选择态语义不同）；实现时若用户再提，另开 change。
- **OQ-2**：斑马纹两档是否够区分（surface 与 sunken 明度差在亮色主题下较小）？G0 倾向先按既有两档落地，e2e 断言「相邻背景色不同」；若真机观感不足，再评估新增语义 token（需另走设计系统变更）。
