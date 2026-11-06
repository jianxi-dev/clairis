# G1 代码评审 — #213 外壳、主题与页签身份

评审对象：`git diff c7a61f8`（分支 `feat/reading-surface-refine-1.1` 工作区，未提交）。
两轴独立：Standards（仓库规范 + Fowler 坏味道基线）与 Spec（issue #212 / 票 #213 / 锚点 A-1.1..A-1.4）。

## Standards

**Hard violation（已修）**
1. QG-4 断言强度 — `e2e/icon-system.spec.ts:88-95`。改写后的渲染用例最强断言只有可见性/存在（`toBeVisible` / `toHaveCount`），低于 QG-4 对渲染类变更要求的第 3 级（文本相等）。
   → 修复：`await expect(tabTitle).toHaveText("note.md")`，命中文本相等。

**Judgement calls（已修/已裁定）**
2. Duplicated Code — `src/App.tsx:347-349` 与 `699-703` 重复「打开网格概览」三连调用。
   → 修复：抽出 `openGridOverview`（`useCallback`），键盘 ⌘⇧\ 与顶栏入口共用。
3. Mysterious Name — `PaneTreeView.tsx:434` 用 `showClose` 控制全屏按钮。
   → 修复：prop 改名 `showClose` → `showPaneControls`，语义覆盖「关闭 + 全屏」两个格头控件。
4. Speculative Generality — `PaneTreeView.tsx:438` 的 `data-active` 无任何 CSS/断言消费。
   → 修复：删除，只保留 `aria-pressed`。
5. 测试健壮性 — 10 个 e2e helper 点击 `[data-testid="pane-mode"]` 进编辑态，依赖默认 preview。
   → 修复：先读 `data-mode`，非 `edit` 才点击（保持真实 UI 路径，确定性进入编辑态）。
6. `iconLabel` 全局设置 UI 移除后字段仍在配置/视图规格管线。
   → 裁定接受：该字段仍被视图规格（`aiViewSpec` / `useConfig`）消费，属 CONTEXT.md D6 可塑层；设置 UI 移除是票 #213「页签始终显示图标+名称」的直接推论。保留字段兼容，不删。

**未发现**：Feature Envy、Data Clumps、Primitive Obsession、Repeated Switches、Message Chains、Middle Man、Refused Bequest、Divergent Change、Shotgun Surgery。

## Spec

-  verdict: PASS（无阻塞项）
- (a) 缺失/部分需求：无。
  - A-1.1 顶栏文件名 0：`Toolbar.tsx` 只渲染品牌「标月」+ 网格/AI/主题/沉浸，无文件名字符串。
  - A-1.2 每个页签标题可见 1：`TabBar.tsx` 无条件渲染 `<span className="max-w-44 truncate">{tab.title}</span>`，不再受 `iconLabel` 开关控制。
  - A-1.3 主题覆盖：`tailwind.config.js` 加 `darkMode: "class"`；`useConfig.applyTheme` 在 `<html>` 切换 `dark`/`warm`；`tokens.css` 的 `--app-bg/surface/sunken/border` 三态同步。
  - A-1.4 单格全屏 0 / 多格可切换：`PaneTreeView.tsx` 用 `showPaneControls={!rootIsLeaf}` 控制全屏按钮；点击先 `focusPane(leafId)` 再 `toggleFullscreenPane()`。
  - 票 #213 验收「页签标题不含空态残留」：标题始终渲染，无空态占位。
- (b) 范围蔓延：无。新增 `grid` 图标是顶栏网格入口所需；`aria-pressed` 是无障碍补强；10 个 e2e 的「编辑」入口从顶栏按钮改为格头 `[data-testid="pane-mode"]`，是移除顶栏模式按钮的必要连带修改；`e2e/tauri/smart-input.spec.ts` 同因。
- (c) 实现疑似错误：无阻塞。判断项：多格时每个格头都出现全屏按钮（2 格 = 2 个），锚点 A-1.4 写「多格 1 个」；实现满足「多格时点击生效」，且与任务书「多格：聚焦该格再切换」一致，故判为可接受，不改。
