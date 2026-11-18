## Why

文档属性面板（`src/components/Content/DocPropertyBar.tsx`）的三处行为与用户预期不符，对应 spec issue #1127：

1. **选择模型错位**。现有「全选 / 反选」按钮以「全部可选字段都选中」为切换条件（`allSelectableSelected`），用户选中任意一个字段时按钮仍是「全选」，要全部勾满才变「反选」。且可选中单位只覆盖字段行，标签行不可选中，值文本节点也混在选中范围内。用户要的选择单位是**字段名称与标签**，值不参与选中。
2. **托管日期没有展示位**。`src/lib/frontmatter.ts` 的 `isManagedDateKey` 已把 `created` / `updated` 标为托管只读键，面板内也已做行级只读（锁图标、禁改名、禁删除、禁类型菜单），但这两个日期没有独立的只读展示区：A 模式底部 footer 只有字段计数，B 模式备注行也只放计数，创建 / 修改日期不出现在任何位置。
3. **形态无切换入口、无自动规则**。属性区有 A 一行条与 B 精排双列两种形态（`useDocPropertyPanelStore.variant`），但用户在界面上没有任何切换入口，`setVariant` 也没有被任何按钮调用；同时窄窗下不会自动切胶囊，用户会被挤成一列。

## What Changes

- **选择模型**：可选中单位改为「字段名称」与「标签」两类节点，值文本不参与选中。0 个选中时按钮显示「全选」，≥1 个选中时显示「反选」；「反选」= 反转当前选择集（已选取消、未选选上）。
- **托管日期**：用 `isManagedDateKey` 把 `created` / `updated` 从可编辑字段列表排除，以只读形式展示在 **A 模式底部 footer 左侧**（与「N 个字段」同行）与 **B 模式备注行右侧**，带锁图标、无输入框；值取自 frontmatter，保存时由既有逻辑维护，不新引入文件系统时间读取。
- **形态切换**：属性区标题栏右侧按钮区新增 AB 模式切换图标（与模板 / 折叠 / 设置同组），点击切换列表 / 胶囊形态；切换写入**全局偏好** `docPropertyVariant` 并持久化；窄窗（宽度 < 720px）默认使用胶囊形态，用户手动切换后以用户选择为准。

## Capabilities

### New Capabilities

- 无新增能力域。三项变更全部落在既有域 `doc-property-panel` 内。

### Modified Capabilities

- `doc-property-panel`：
  - P-4 字段行操作与选择模式（MODIFIED）：选择模型改为「字段名称 + 标签」，按钮二态切换条件改为选中数，反选为反转选择集；
  - 新增 Requirement「托管日期只读展示」：`created` / `updated` 排除出可编辑列表，A footer 左侧与 B 备注行右侧只读展示；
  - P-2 显示样式两态与显隐配置（MODIFIED）：形态切换写入全局偏好 `docPropertyVariant` 并持久化，窄窗自动胶囊；
  - 新增 Requirement「AB 形态切换入口与窄窗自适应」。

## Impact

- 前端：`src/components/Content/DocPropertyBar.tsx`（选择模型、托管日期渲染、AB 切换按钮与窄窗自动形态）、`src/lib/frontmatter.ts`（`isManagedDateKey` 过滤可编辑列表的辅助接线）。
- 状态：`src/stores/docPropertyPanel.ts`（全局偏好 `docPropertyVariant`，持久化接线）。
- 样式：`src/styles/`（footer 日期、AB 图标、窄窗形态）。
- 设计系统：`docs/design/system/spec.md` §2.3 追加 AB 切换图标条目（新增图标概念先补条款再注册），§7 追加属性面板密度条款（footer 日期与 AB 图标档位）；`docs/design/system/decisions.md` 追加单点裁决行。
- 测试：`e2e/` 扩展选择模型、托管日期、形态切换与窄窗自适应断言。
- 数据面：本 change 新增全局偏好 `docPropertyVariant`，属可配置面，按 `docs/agents/data-surface.md` 在 design.md 出六栏表。
- 后端：无改动（无 Rust 变更、无新增 Tauri 命令）。
