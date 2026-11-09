---
title: "选区轮盘 · 开发交接"
type: design
status: accepted
last_updated: 2026-11-09
for: 实现会话（另一 session）
---

# 选区轮盘 · 开发交接

> 设计已定案（维护者九轮评审），**不要重新讨论方案**。本文件只回答「读什么、改哪里、别踩哪些坑」。

## 1. 先读这三份，按顺序

| 序 | 文件 | 读它为了 |
|---|---|---|
| 1 | `docs/design/approved/selection-roulette/README.md` | **唯一设计真相源**：三层结构、扇形几何、交互口径、九轮评审结论、已知坑 |
| 2 | `docs/design/system/spec.md` | 视觉数值（图标 14px、字号 11/12/13、圆角 4/8、语义色、`--app-shadow`） |
| 3 | `openspec/specs/editing/spec.md` | 现有编辑域规格，你要往里加 delta |

补充：`CONTEXT.md`（词汇）、`docs/architecture/overview.md`（架构现状）、`AGENTS.md`（仓库硬约束）。

## 2. 要做的事，一句话

把编辑态选中文字后出现的**横向 12 项工具条**（`src/editors/orchestration/floating-toolbar.ts`），
换成**以鼠标落点为圆心**的径向轮盘：根环 8 扇区 → 点击展开就近扇形（二层）→ 分组项在**二层外环**
以被点击区块为中心展开（三层）；同时补齐 md-bundle 有而 clairis 没有的动作，并新增四个能力。

动作全集与顺序见设计 §2.3 / §4.2 / §4.4；三个易错点先记住：

- 根环 8 项：智能 / 转换 / 对齐 / 分栏 / 历史 / 清格 / 格式 / 颜色。
- 「转换」二层**动态**（按光标所在块类型），顺序：代码块 · 表格 · 标题 › · 列表 › · 高亮 › · 引用 · 分割线。
- 「格式」二层顺序：链接 · 下划线 · 斜体 · 加粗 · 行内代码 · 删除线。
- 「颜色」是两圈**窄色条**（内 90–106 文字色带平切 A、外 111–127 背景色），**没有浮层色板、没有色卡**。
- 「对齐」只有 左 / 中 / 右 / 增加缩进 / 减少缩进（**没有「清除对齐」**）。

## 3. 实现面（改哪里）

| 文件 | 动作 |
|---|---|
| `src/editors/orchestration/floating-toolbar.ts` | **重写**为轮盘（现 431 行，横向 flex 工具条） |
| `src/editors/orchestration/roulette.ts`（新增） | 纯几何：极坐标、扇段 path、层半径、指针→角度换算（无 DOM 副作用，好测） |
| `src/editors/orchestration/toolbar-shared.ts` | 复用 `toggleWrap` / `toggleRangeSpan` / `blockAt` / `alignBlock` / `deleteBlock` / `wirePopup`；按需加 `indentBlock`、`unwrapFamily` |
| `src/editors/orchestration/color-palette.ts` | 复用色值；色条渲染在本模块内 |
| `src/editors/setup.ts:24,54` | 挂载点不变（`floatingToolbar()` 仍作为 extension 返回） |
| `src/styles/editor.css`（`.cm-floating-toolbar` 段，约 2145 行起） | 换成轮盘样式；**每个新 `cm-*` 类必须在这里有规则**，否则 `scripts/css-manifest-check.sh` 失败（pre-commit 会跑） |
| `e2e/floating-toolbar.spec.ts` | **改写**：现有断言绑死 12 个 `.cm-toolbar-btn` 与 `data-action`，与新结构不兼容 |
| `src/__tests__/editor/`（新增 `roulette.test.ts`） | 几何纯函数单测（角度、扇段 path、层级不透明度、命中判定） |

## 4. 硬约束（违反会被 pre-commit / CI 拦）

1. **先走 OpenSpec 闭环**：新增需求 → `/opsx-propose` 建 `openspec/changes/selection-roulette/`（proposal + design + tasks，**中文**）；
   实现 → 勾任务；完成后归档并更新 `docs/delivery/requirements-status.md`。**禁止**绕过 change 直接改主规格。
2. **中文优先**：issue/commit/PR/文档/UI 文案中文；英文只用于标识符、命令、外部引用。
3. **CSS manifest**：`src/editors/` 下声明的 `cm-*` 类必须在 `src/styles/` 有规则（`bash scripts/css-manifest-check.sh`）。
4. **测试位置**：vitest 只收集 `src/__tests__/**/*.test.{ts,tsx}`；写在源码旁不会执行。
5. **模式切换不 remount**：preview/edit/source 用 CSS display 切换，不要重建 EditorView。
6. **交付前**：`bash scripts/verify.sh`（tsc → eslint → vitest → CSS manifest → cargo check → 两套 Playwright）全绿才算完。
7. **视觉数值**：新数值不散写，定案后落 `docs/design/system/decisions.md` 一行（append-only，四列：部件/决定/出处/日期）；票面第七字段写 `**视觉锚点**: design-system:§2.1;§4;§5;§6` + `ledger:选区轮盘`。
8. **API key** 只走 OS keyring —— 本功能不涉及，别顺手改。

## 5. 五个坑（原型里真踩过，照做）

1. **不能在 `mouseup` 当场弹轮盘**：双击选词时轮盘会盖在第二次点击的落点上，第二次点击把选区打散。
   做法：按下鼠标即取消待开计时；`selectionchange` 在按住期间不排期；**松手后 ~90ms** 在落点出现。
2. **不要给圆心加死区**：加了「指针离开 24px 才生效」会把「选完直接点圆心取格式」吃掉，格式刷看起来失效。
3. **筛选输入框不能在输入过程中重建**：每键重渲染会打断中文输入法组合过程，表现为「打字没反应」。
   做法：筛选是独立面板，输入只重画结果行。
4. **清除颜色/格式时不要 `parent.normalize()`**：文本节点被合并会把刚设好的 Range 指向已移除节点而塌陷。
   做法：只解包「与选区相交」的 span，文本不搬家。
5. **历史快照必须在变更之后提交**：写在变更前会让撤销/重做拿到同一份。

## 6. 验收锚点（写进 tasks，逐条可测）

| id | 断言 | 建议测试 |
|---|---|---|
| A-1 | 圆心 = 鼠标落点；贴近视口边缘时整轮夹取不越界 | e2e 截图 + 坐标断言 |
| A-2 | 二层不绕整圈：N 项 × 15°，居中于父扇区；项少更短 | 单测（角度） |
| A-3 | 三层在 126–152 外环，以被点击区块为中心，隔线与二层共线 | 单测（边界角相等） |
| A-4 | 颜色两圈：内 90–106（9 段，平切 A）、外 111–127（16 段），无浮层 | 单测 + e2e |
| A-5 | 全部动作可达且写入源码正确（`**`、`` ` ``、`[..](url)`、`<u>`、`~~`、`<span class="mdb-color-*">`、`:::` 围栏） | 单测（转换/围栏） + e2e |
| A-6 | 格式刷跨选区幂等；无死区（选完直接点圆心可用） | e2e |
| A-7 | 清格去掉粗体/颜色/行内代码，**保留链接** | 单测 |
| A-8 | 后退/前进与 `Mod-z`/`Mod-Shift-z` 共用同一份历史 | e2e |
| A-9 | 拖选期间无轮盘；松手后出现在落点 | e2e |
| A-10 | 三主题（亮/暗/暖）对比度；展开后根环与二层 70%、三层满 | e2e 截图 |

## 7. 原型（可交互，随设计入库）

`docs/design/approved/selection-roulette/prototype.html`——单文件、零依赖，双击即可在浏览器打开
（`.lavish/selection-roulette.html` 是同一份的评审现场版，在 gitignore 内，不要引用它）：

- 左侧是真编辑区，右侧实时显示**源码层**结果——可以直接看到每个动作应该写进 Markdown 的字符串。
- 已跑通：选中出环、点击展开、三层外环、颜色双圈、筛选面板、格式刷、后退/前进、三主题。
- **它是设计参照，不是代码模板**：里面是 DOM + HTML 的原型实现，真实实现要在 CodeMirror 6 的
  `ViewPlugin` 里用 `view.coordsAtPos()` 定位、`view.dispatch()` 改文档。

## 7.5 已裁决：edit 态停用「选区胶囊」

`openspec/specs/editing/spec.md` 的 **E-18 正文选区胶囊** 现在规定编辑态也要显示胶囊（改写 / 翻译 / 润色），
实现是 `src/components/ai/SelectionPill.tsx` + `src/lib/selectionPillMode.ts`，与 `floating-toolbar.ts` 并存
——也就是说编辑态选中文字会看到两套浮层。

**维护者已裁决（2026-11-09）：按推荐方案执行。**

- **编辑态停用胶囊**：AI 三动作由选区轮盘的「智能」扇区承载。
- **阅读态保留胶囊**（复制 / 解释 / 翻译），行为不变。
- **E-18 用 delta 改写**（不要直接改主规格），建议措辞：

  > E-18 正文选区胶囊：阅读态选中正文 SHALL 显示胶囊工具条（复制 / 解释 / 翻译）。
  > 编辑态的 AI 三动作（改写 / 翻译 / 润色）SHALL 由选区轮盘承载，编辑态 SHALL NOT 再显示胶囊。
  > 场景「编辑态选区」改为：**WHEN** 用户在编辑态选中一段正文 **THEN** 出现选区轮盘且**不出现**胶囊。

- 落地位置：`detectSelectionPillMode` 对 `"edit"` 返回 `null`（或 `App.tsx` 在 edit 态不渲染 `SelectionPill`），
  阅读态分支不动。
- 受影响文件 / 测试：`src/App.tsx`、`src/components/ai/SelectionPill.tsx`、`src/lib/selectionPillMode.ts`、
  `src/__tests__/selectionPill.test.tsx`、`src/__tests__/selectionPillMode.test.ts`、`e2e/selection-pill.spec.ts`
  （edit 态断言反转：轮盘在、胶囊不在）。
- 别顺手删掉 `SelectionPill` 组件本身——阅读态还在用。

## 8. 不在范围

- 字号控件（评审决议 D2：移出，字号是全局阅读设置）。
- 「清除对齐」（评审移除）。
- 悬停展开（已改点击展开）。
- 三层继续往下嵌套（最多两层展开）。
- 右侧栏「怎么试 / 评审结论 / 状态」是原型的评审辅助 UI，**不进产品**。

## 9. 交付物

1. `openspec/changes/selection-roulette/{proposal,design,tasks}.md` + `specs/editing/spec.md` delta（中文），
   delta 必须包含 **E-18 改写**（编辑态停用胶囊、阅读态保留）与新增的轮盘需求。
2. 代码：轮盘扩展 + 几何纯函数 + 样式；`floating-toolbar.ts` 旧实现与 `e2e/floating-toolbar.spec.ts` 不留双轨。
3. 测试：`src/__tests__/editor/roulette.test.ts`（几何/规格）+ e2e 改写（交互）；
   `selectionPill` 的 edit 态断言反转（轮盘在、胶囊不在），阅读态断言不动。
4. `docs/design/system/decisions.md` 追加「选区轮盘」半径/色带行。
5. `bash scripts/verify.sh` 全绿。
