# 设计 — editor-surface-batch22

来源：重启的 #1053（页签）与 #1055（搜索浮窗）用户反馈；参考 `openspec/changes/archive/2026-11-18-editor-surface-batch21` 制品与主规格。需求四要素以两条 issue 正文为唯一真相源，不再另行访谈。

## Context

本 change 是对 batch21 两项交付的**修正**，不引入新机制：

- 页签：batch21 用 `break-words line-clamp-2` 取代 `truncate`，但 `-webkit-line-clamp` 达上限仍渲染视觉省略号、且允许换行；本次改为单行完整显示 + 横向滚动，并把间距加宽一个指针（16 → 32px）。
- 搜索浮窗：batch21 把选中行徽标从 `⏎` 改为文本「回车」；本次改回**图形**（键帽式回车图标），并补上「鼠标悬停 = ↑↓ 选择」这一等价交互。

第一原则：**沿用既有机制、只补差异**——页签继续使用既有 TabBar 与页签条布局；徽标继续经既有图标注册表渲染，不内联一次性 SVG。

## Goals / Non-Goals

**Goals:** 页签标题单行完整显示（无省略号 / 截断 / clamp / 换行）且页签条可横向滚动，间距 32px；搜索选中 / 悬停行徽标为键帽式回车图标，悬停更新 `activeIndex`。

**Non-Goals:** 不改搜索 / 替换的匹配语义与扫描范围；不改 9 行上限、快捷键列常驻、状态栏显隐与贴底；不修「定位一次后 ↑↓ 失效」这一独立缺陷（见 Open Questions）；不重做页签拖拽 / 改名。

## Decisions

### D1 页签单行全显 + 间距 32px（#1053）

- **单行完整显示**：页签标题 SHALL NOT 使用 `text-overflow: ellipsis`、SHALL NOT 截断、SHALL NOT 使用 `-webkit-line-clamp`（含 `line-clamp` 系列）、SHALL NOT 换行（`white-space: nowrap`）。根因是 `-webkit-line-clamp` 达行数上限时会渲染视觉省略号——仅移除 `truncate` 不够，必须同时禁掉 clamp 与换行。
- **横向滚动**：页签总宽超过页签条可用宽度时，页签条 SHALL 横向滚动，SHALL NOT 压缩页签到不可读或溢出容器。
- **间距**：相邻页签间距 16px → **32px**（容差 ±2px）。32px 不在设计系统间距刻度（`--space-16` 与 `--space-24` 之间）内，属用户明示值，按「确需刻度外值时说明理由」豁免。
- **规格落点**：页签标题 / 间距的 canonical 条款在 `navigation` 的「页签条与格头」；本 change 同时修改 `application-shell` 的「G-6 顶栏职责与页签身份」，使外壳侧持有同一口径，避免两域冲突。
- 设计依据：#1053 用户反馈；code obs `src/components/TabBar.tsx`（`truncate` / `line-clamp-2` / `gap-1`）；`docs/design/system/spec.md` §3 间距刻度。

### D2 搜索徽标回车图标 + 悬停更新 activeIndex（#1055）

- **徽标图形**：选中（当前命中）行行尾 SHALL 渲染**键帽式回车图标**——24×24 viewBox、等效笔画 1.7、圆头圆角、`currentColor`、14px 密集档（行尾内联）；图形为圆角键帽（2px 圆角）内含返回箭头（水平线 + 向下折角箭头）。SHALL NOT 渲染裸文本「回车」。图标经仓库图标注册表（`src/ui/icons.ts` 的 `ICONS` / `iconSvg`，`src/editors/icons.ts` 同步）渲染，SHALL NOT 组件内联一次性 SVG 或引入图标库。
- **可访问性**：徽标可访问名 SHALL 为「回车」（`aria-label` / `title`），使读屏与 e2e 都能定位。
- **悬停选择**：指针悬停结果行 SHALL 把 `activeIndex` 更新到该行（与 ↑↓ 同一选择态），徽标在该行显示；移出后保持既有高亮语义。既有 ↑↓ 移动 `activeIndex`、Enter 打开当前高亮结果、`⌘/Ctrl+N` 直达、点击定位、9 行上限与 sticky 快捷键列保持不变。
- 设计依据：#1055 用户反馈；`docs/design/system/spec.md` §2.1 / §2.2 / §2.3（新概念先补条款与台账再注册）；`search-replace-float` S-3。

## 数据面

> 本 change 命中信号：图标注册表（新增「键帽回车」IconName）+ 关键词「图标 / 快捷键」。按 `docs/agents/data-surface.md` 六栏表登记（落点 | 位置 | 载体/符号 | 判据）。机检 `./scripts/cw-data-surface.sh new editor-surface-batch22`。

| 落点 | 位置 | 载体 / 符号 | 判据 |
|---|---|---|---|
| 规格 | design-system:§2.3 | — | 新「键帽回车」图标概念先补 §2.3 语义分组并在台账追加裁决，再注册 |
| 存储 | src/ui/icons.ts | IconName | 新图标名进入 IconName 联合与 ICONS 表；未注册名拒绝渲染 |
| 校验 | src/ui/icons.ts | iconSvg | 未注册名不回落为 Unicode 字形；渲染必经注册表 |
| 桥接 | src/editors/icons.ts | renderIcon | 编辑器侧经 renderIcon / ICON_REGISTRY 复用同一 path，避免两套漂移 |
| 消费 | src/components/Content/SearchReplacePanel.tsx | iconSvg | 徽标经注册表渲染，组件内无一次性内联 SVG |
| 回滚 | snapshots/ | restore_config_snapshot | 本 change 不写配置字段；误改图标注册可经快照一步回退 |

> 页签单行全显与间距为 CSS-only，不触及配置 / 存储 / 校验 / 桥接；上表由 D2 的图标注册表触发。

## Risks / Trade-offs

- [32px 间距在刻度外] → 用户明示「再加宽一个指针」，按 §3 豁免并在票面说明；如后续设计系统补 `--space-32` 则回改。
- [悬停选择与前次定位的交互] → 悬停只更新 `activeIndex`，不触发定位；「定位一次后 ↑↓ 失效」是另一缺陷，不在本 change 范围（见 Open Questions）。
- [徽标图标尺寸] → 行尾内联取 14px 密集档；若与行高冲突，实现时以行高为准微调，不新增尺寸档。

## Open Questions

1. #1055 用户还报了「定位一次后，上下键就无法再上下移动」——这是独立缺陷（疑似定位后 `activeIndex` / 高亮态未复位），本 change 不修；如需纳入，另开缺陷票。
2. 页签间距 32px 是否需要设计系统补 `--space-32` 刻度条款？——影响 D1 的 token 化，不阻断实现。
