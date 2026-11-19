# 设计：页签等比伸缩与信息窗复制动作 / 悬浮提示（五.2 / 五.3）

## Context

- 需求输入：GitHub #1155（spec issue）+ 其评论「对账确认（2026-11-19）：全按 ★ 默认实施」，为最终依据。五.2 ★A 弹性等比伸缩（flex-grow + 动态 maxWidth + min-width 保底）；五.3 ★A 两图标移到「最近保存」行右侧 + 换区分度高的图标 + shot-toast 范式悬浮提示。
- 基准：`openspec/specs/navigation/spec.md`「页签条与格头」（L103-217）；`openspec/specs/application-shell/spec.md`「G-6 顶栏职责与页签身份」（L93-127，明文「两处 SHALL 一致」）；先例 `openspec/changes/archive/2026-11-18-tab-title-info-surface/`（同一页签标题口径在 application-shell / navigation 两处同改）。
- 现状代码（探查实证）：
  - 页签：`src/components/TabBar.tsx:478` 页签条 `flex min-h-[26px] w-full items-center gap-8 shrink-0 select-none overflow-x-auto px-1`；`:553` 页签 `group flex min-w-0 shrink-0 items-center gap-1.5 px-2.5 py-1 ...`；`:597` 标题 `style={{ maxWidth: "var(--tab-title-max-width)" }}` + `min-w-0 overflow-hidden text-ellipsis whitespace-nowrap`；token `--tab-title-max-width: 120px`（`src/styles/tokens.css:52`，台账 `docs/design/system/decisions.md:81`）。父层 `PaneTreeView.tsx:516` `flex-1 min-w-0 overflow-hidden` 裁切。
  - 信息窗：`src/components/TabInfoPopover.tsx:170-204` 复制图标在文件名行（`tab-info__copy` 内 `copyPath` / `copy`）；成功提示 = 路径行内 `tab-info__notice` 文本 1400ms（:92-96、:244-252）；三行结构 name / path / time（:206-258）；外壳 `.tab-info`（`src/styles/editor.css:1548-1571`）。
  - toast 范式：`src/components/Content/VideoPlayer.tsx:2003-2023` `data-testid="shot-toast"` —— `position: absolute` + `left` / `bottom` + `transform: translateX(-50%)` + `borderRadius: 999` + `background: rgba(0,0,0,0.82)` + `color: #fff` + `pointerEvents: none`；触发 / 消失逻辑见 :250-254、:541-560。
  - 图标：`src/ui/icons.ts:343` `copyPath`（两个圆角方块，label「复制」）、`:593` `copy`（两个叠放方块带折角，label「复制选区」）；`copyPath` 亦用于 `PreviewView.tsx:572`、`TabBar.tsx:853`（上下文菜单「复制路径」）、`src/lib/paneHeaderMenu.ts:18`。
- 硬约束：三模式 CSS display 切换不 remount；新增 / 改动 `cm-*` 类须同步 `src/styles/`（CSS manifest）；视觉数值只引用 `docs/design/system/spec.md` 条款 / token 名，不复制像素值；delta 逐字保留既有场景标题（archive abort 防线）。

## Goals / Non-Goals

**Goals:**

- 页签按可用宽度等比伸缩，设最小宽度保底；窗格变窄时多页签同比缩小、无覆盖、无溢出；保底不足时才横向滚动。
- 信息窗两复制图标移到「最近保存时间」行右侧、图形可区分；成功提示改悬浮 toast（锚定触发按钮、圆角胶囊、约 2000ms 自动消失、不阻挡指针）。
- navigation 与 application-shell 两处页签标题口径一致（弹性伸缩），消除「两处 SHALL 一致」的违约。

**Non-Goals:**

- 页签右键菜单的动作与文案（保持；仅其「复制路径」图标随 `copyPath` 概念更新）。
- 页签名信息窗宽度 `--tab-info-width`、三行结构、路径层点击定位、文件名换行。
- 页签拖拽排序、双击改名、页签生命周期、格头菜单、模式切换。
- 新增配置字段（本 change 不落盘任何用户配置，仅新增一个设计 token）。

## Decisions

1. **页签弹性模型：`flex: 1 1 auto` + `min-width` 保底 + 移除固定 `max-width`**。页签条（`TabBar.tsx:478`）去掉 `shrink-0`、改 `min-w-0`（允许在页头内收缩）；页签（`:553`）去掉 `shrink-0`，改 `flex-1 min-w-0`（`flex: 1 1 0%`）+ `min-width: var(--tab-min-width)`；标题（`:597`）移除 `style={{ maxWidth: "var(--tab-title-max-width)" }}`，保留 `min-w-0 overflow-hidden text-ellipsis whitespace-nowrap`，其可用宽度由页签的 flex 分配决定。理由：`flex: 1 1 0%` 让所有页签等基线分配剩余空间，变窄时同步收缩、变宽时同步伸展，直接满足「多个页签名块同比例变化」；`min-width` 保底防止收缩到不可读，保底被击穿时由 `overflow-x-auto` 接管为横向滚动。替代方案（`flex: 1 1 auto`，按内容基线分配）会让短页签与长页签宽度差保持不变，视觉上「靠左页签仍无变化」的观感较弱，弃。
2. **最小宽度保底 = 新 token `--tab-min-width`**。在 `docs/design/system/spec.md` 新增 §7.5 定义该 token（与 §7.4 `--tab-info-width` 同区），并在 `src/styles/tokens.css` 新增 `--tab-min-width`；`--tab-title-max-width` 退役（`tokens.css` 删除，台账 append 一行取代 `:81` 的 120px 行）。G0 建议值 **96px**（容纳 18px 类型图标 + 6px 内距 + 最短标题 + 6px 内距 + 关闭钮 + 左右内距），最终以页签伸缩对比稿（ui-feedback 四要素）裁定；值变动走 spec §7.5 supersede。理由：视觉数值唯一来源是设计系统；保底是组件宽度，按 §7.4 先例 token 化。
3. **信息窗复制按钮移到「最近保存时间」行右侧**。把 `TabInfoPopover.tsx` 的 `tab-info__copy` 区块从文件名行（`tab-info__name` 行）移到时间行（`tab-info__time` 行）末尾，保留 `data-testid="tab-copy-path"` / `"tab-copy-file"` 与 `--app-text-3` 弱化色。理由：用户明确「都放在最近保存时间行的右侧」（★A 位置要求）；时间行当前只有图标 + 文本，右侧留白充足。
4. **复制图标：`copyPath` 改路径语义图形 + 新增 `copyFile` 文件语义图形**。`copyPath` 图形由「两个圆角方块」改为「斜杠 `/` + 文件夹」（路径语义），新增 `copyFile` = 「文档 + 向右上箭头」（文件引用语义）；两者图形可区分。`copy`（「复制选区」）保持不动（编辑器工具条 / 选区轮盘 / 文档属性共用，语义不同）。`copyPath` 的既有用法（上下文菜单「复制路径」、预览菜单）随概念更新，维持「一个概念一个图标」。先补 `docs/design/system/spec.md` §2.3 动作组（`copyPath` 描述更新、新增 `copyFile`）与 `docs/design/system/decisions.md` 台账（图形几何），再改 `src/ui/icons.ts`。理由：现有两图标（两个重叠方块）区分度不足是用户痛点；斜杠 + 文件夹 / 文档 + 箭头在 14px 密集档下仍可辨。
5. **成功提示改悬浮 toast（移植 shot-toast 范式）**。`TabInfoPopover` 移除 `tab-info__notice` 行内文本，改为 toast state（文本 + 触发按钮锚点）；toast 渲染为圆角胶囊（`borderRadius: 999`）、深色底（`rgba(0,0,0,0.82)`）、白字、`pointerEvents: none`、锚定触发按钮（`transform: translateX(-50%)` 居中于按钮）、约 2000ms 后自动消失。理由：与 VideoPlayer 截图提示同一范式（用户明示「参照视频截图提示效果」）；行内文本会被路径行挤出 / 忽略，toast 更醒目且不占布局。
6. **delta 口径：navigation 与 application-shell 两处同步**。navigation「页签条与格头」与 application-shell「G-6 顶栏职责与页签身份」的页签标题条款一起改为弹性伸缩口径（后者是权威表述，且 navigation 明文「两处 SHALL 一致」）。既有场景标题逐字保留；反向修订项（「页签名无省略号」「长页签可滚动」「信息窗复制路径与复制文件」、application-shell「页签标题单行完整显示」「短标题按实际长度显示」「页签条横向滚动」）正文前加 `>` 可追溯注记；新增「窗格变窄时页签等比收缩」「复制成功悬浮提示」场景。
7. **测试口径**：e2e 改造——`e2e/tab-selection.spec.ts:57` 间距断言保持；`:96` 「长页签名单行省略号、短页签名按实际长度」改为「长标题省略号 + 短标题随伸缩拉伸」；`:160` 「多个长页签时页签条可横向滚动」改为「保底被击穿后才滚动」；新增「窗格变窄时多页签等比收缩、无覆盖、无溢出」。`e2e/tab-info-popover.spec.ts:130-149` 复制按钮位置改到时间行、成功提示断言改 toast；`:233-283` 「复制图标在文件名之后」改为「在时间行右侧 + 图形可区分」；新增 toast 出现 / 自动消失断言。`bash scripts/verify.sh` 全绿。
8. **数据面判定**：本 change 触及 `src/ui/icons.ts`（图标注册表）与 `src/styles/tokens.css`（主题 token 词表），命中 `docs/agents/data-surface.md` §二路径信号 → 必须填六栏表。结论：**无配置字段落盘**（页签伸缩为组件内布局、复制动作为既有剪贴板命令），但图标概念与 token 属可配置面，按下表落点。

## 数据面

| 落点 | 位置 | 载体/符号 | 判据 |
|---|---|---|---|
| 规格 | design-system:§2.3、§7.5 | — | §2.3 动作组更新 `copyPath` 图形语义并新增 `copyFile`；§7.5 定义页签最小宽度保底 token `--tab-min-width`；缺条款不得改图标 / token |
| 存储 | src-tauri/src/config.rs | AppConfig | 本 change 不触及 config.rs（无新增配置键）；页签伸缩与复制动作为组件内布局 / 交互，不落盘 |
| 校验 | src/hooks/useConfig.ts | applyRustConfig | 本 change 不触及；无配置热应用改动，复制走既有剪贴板命令 |
| 桥接 | src/hooks/useConfig.ts | applyRustConfig | 本 change 不触及；无配置桥改动 |
| 消费 | src/ui/icons.ts | ICONS | 复制路径 / 复制文件图形经 `ICONS` 表注册；`TabInfoPopover` 消费，`TabBar` 消费 `--tab-min-width` |
| 回滚 | git revert 本 change 各票 commit | —（无配置写入路径） | 无数据写入；回退 = revert commit，无缺省回落路径引入 |

（三道机检时点：G0 阶段二 `./scripts/cw-data-surface.sh new`、G0-POST `tickets`、G1 出口 `diff`。）

## Risks / Trade-offs

- [页签等宽（`flex: 1 1 0%`）让短标题页签被拉伸] → 这是「等比伸缩」的预期结果；标题仍单行省略号，短标题显示更宽松。若观感不佳，退路是 `flex: 1 1 auto`（按内容基线），在实现评审时二选一。
- [`copyPath` 图形重定义的爆炸半径] → 上下文菜单 / 预览菜单的「复制路径」图标同步变化；这是同一概念，符合「一个概念一个图标」，但需在票面写明并截图确认。
- [toast 锚定位置在信息窗翻转（下方放不下翻到上方）时需跟随] → toast 锚点取触发按钮 rect，随信息窗定位一起计算；e2e 覆盖翻转态。
- [保底宽度值 96px 为 G0 建议] → 最终以页签伸缩对比稿裁定；值变动走 spec §7.5 supersede，不影响交互结构。
- [e2e 旧断言反向] → `tab-selection.spec.ts:96/:160`、`tab-info-popover.spec.ts:130-149/:233-283` 同步改写，避免旧断言与新规格冲突导致 CI 红。
- [navigation 与 application-shell 两处口径] → 本 change 同时改两处 delta；若只改一处会违反「两处 SHALL 一致」，G4 同步前需确认两处主规格一致。

## Migration Plan

1. 设计系统：`docs/design/system/spec.md` §2.3 / §7.5 + `decisions.md` 台账（先补条款，再动图标 / token）。
2. 页签弹性：`tokens.css` 新增 `--tab-min-width`、删 `--tab-title-max-width`；`TabBar.tsx` 页签条 / 页签 / 标题类改弹性；`editor.css` 同步。
3. 信息窗：`TabInfoPopover.tsx` 复制按钮移到时间行、换图标、toast；`editor.css` 同步。
4. 测试与 `verify.sh` 收口。
- 每步可独立合入 main（无用户配置 / 存储结构变更）。
- 回滚：按提交粒度 revert；无配置 / 快照回滚需求。

## Open Questions

- **OQ-1**：页签弹性用 `flex: 1 1 0%`（等宽）还是 `flex: 1 1 auto`（按内容基线）？G0 倾向 `flex: 1 1 0%`（等比伸缩观感最强），实现评审时以对比稿裁定。
- **OQ-2**：`--tab-min-width` 取值（G0 建议 96px）待页签伸缩对比稿确认；若调整，走 spec §7.5 supersede。
