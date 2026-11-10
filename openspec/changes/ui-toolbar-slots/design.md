# Design: 横向工具条槽位化（ui-toolbar-slots）

## 1. 现状与失败模式

| 事实 | 位置 | 后果 |
|---|---|---|
| 工具条按钮分三组硬编码数组 | `src/editors/orchestration/horizontal-toolbar.ts:139,167,208` | 顺序与可见性不可配置 |
| 按钮执行直接调闭包 | 同文件 `toolButton` | 与轮盘的注册表路径分裂，无法复用 |
| 颜色下拉与「清除格式」内联在 `build()` | 同文件 `build()` | 槽位边界不清，容易把非动作控件也塞进配置 |
| 无对应配置字段与校验 | `src-tauri/src/config.rs:14,397` | 外部写入无校验、无回滚语义 |

失败模式：把 `BarAction[]` 直接序列化——`run` 是闭包，JSON 无法表达；必须先把执行体搬到命令注册表，槽位只存 id。

## 2. 决策

### D1 槽位模型只表达「顺序 + 显隐」

新增 `slots.ts`：

```ts
export interface ToolbarSlotItem {
  id: string;
  label: string;
  icon: IconName;
  group: "ai" | "format" | "align";
}
export const HTML_TOOLBAR_ITEMS: readonly ToolbarSlotItem[];
export const HTML_TOOLBAR_DEFAULT_ORDER: readonly string[];
export function resolveToolbarOrder(configured: string[] | null | undefined): string[];
```

- 槽位只放「动作按钮」；颜色下拉与「清除格式」是复合控件，保持固定位（文档在 slots.ts 头注说明）。
- `resolveToolbarOrder`：未知 id 丢弃、重复去重、空/缺省回落默认顺序；与 `normalizeRouletteSectors` 同语义。

### D2 命令注册表复用

- 每个槽位项在 `horizontalToolbar()` 装配时注册为命令（`toolbar-<id>` 命名空间可省略，直接复用 `format-*` / `ai-*` / `align-*`）。
- 按钮只持 `commandId`；执行 `executeCommand(id, { view })`，未注册则不渲染。
- 与轮盘共用同一注册表，避免两套执行路径。

### D3 配置与校验

```rust
#[serde(default, skip_serializing_if = "Option::is_none")]
pub html_toolbar_items: Option<Vec<String>>,
```

- 合法 id = 12 项槽位 id；长度 1..=12；无重复；非法整体拒绝。
- 前端 `applyRustConfig` 归一化：未知丢弃 + 聚合告警；空数组回落 `null`。

### D4 设置面与回滚

- 设置·编辑器「文字工具条」：12 行复选 + 上下移动 + 恢复默认（写 `null`）。
- 与轮盘扇区设置同构；写入走 `saveAppConfig`（校验 + 快照）。
- 回滚兜底：快照 10 份；恢复默认为 `null`，继承未来默认顺序。

### D5 不做

- 块菜单、状态栏、页签菜单的槽位化（另立 change）。
- 颜色下拉的色板可配置（属 `theme.toml` / 色板数据化，另立）。
- 工具条几何与视觉（本 change 只动集合与顺序）。

## 数据面

| 落点 | 位置 | 载体/符号 | 判据 |
|---|---|---|---|
| 规格 | design-system:§2 | — | 图标尺寸只允许 14/18/24，工具条图标保持 14 |
| 存储 | src-tauri/src/config.rs | html_toolbar_items | 可空；缺省回落 12 项默认顺序 |
| 校验 | src-tauri/src/config.rs | validate_config | 每项 ∈ 12 个 id；长度 1..=12；无重复 |
| 桥接 | src/hooks/useConfig.ts | applyRustConfig | 未知 id 丢弃并聚合告警；空数组回落默认 |
| 消费 | src/editors/orchestration/horizontal-toolbar.ts | horizontalToolbar | 数组顺序即按钮显示顺序 |
| 回滚 | snapshots/ | restore_config_snapshot | 写前快照 10 份；恢复默认写 null |

## 3. 风险

- **槽位与复合控件边界**：颜色下拉若被误纳入槽位，配置将无法表达其内部结构；D1 明确排除。
- **两处工具条形态**：HTML 源码态与横条形态共用 `horizontalToolbar()`，配置对两者同时生效；e2e 需覆盖至少一种真实渲染。
- **双轨残留**：`BarAction` 保留为构建期中间结构，但 `run` 只由注册表提供，避免出现第三条执行路径。
