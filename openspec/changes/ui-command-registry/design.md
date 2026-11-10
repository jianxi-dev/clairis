# Design: 轮盘可配置化（ui-command-registry）

## 1. 现状与失败模式

| 事实 | 位置 | 后果 |
|---|---|---|
| 根扇区是数组字面量，`SectorId` 是 8 项封闭联合 | `src/editors/orchestration/roulette.ts:45,62` | 增删扇区必须改类型 + 改数组 + 发版 |
| 扇区 → 动作的绑定是 `switch` | `roulette-view.ts:150` | 新扇区没有动作可挂 |
| 动作项 `run` 是捕获 `EditorView` 的闭包 | `roulette-view.ts:31`、`floating-toolbar.ts:305` | JSON 无法表达动作，注册表无法外置 |
| `options.sectors` 已支持隐藏/重排，但无调用方 | `roulette-view.ts:96`、`floating-toolbar.ts:628` | 扩展点断头 |
| `AppConfig` 无扇区字段，`validate_config` 无对应白名单 | `src-tauri/src/config.rs:14,397` | 外部写入无校验、无回滚语义 |

失败模式：直接给 `ROOT_SECTORS` 加字段并读文件，会在「闭包无法序列化」处停住；先做 UI 数据文件、后做命令层，等于把不可执行的数据写进磁盘。

## 2. 决策

### D1 命令注册表先行（expand）

新增 `commands.ts`：

```ts
export interface CommandContext { view: EditorView }
export type CommandFn = (ctx: CommandContext) => void
registerCommand(id: string, fn: CommandFn): void
executeCommand(id: string, ctx: CommandContext): boolean
hasCommand(id: string): boolean
```

- 内置命令在 `floating-toolbar.ts` 装配时注册，id 采用既有 item id（如 `bold`、`align-left`）。
- `RouletteItem` 增加可选 `commandId`；执行优先级：`run` > `commandId` > 无动作（不渲染为可点项）。这是 expand 阶段的双轨，contract 阶段（后续 change）删除 `run`。
- 注册表不持有 `EditorView`：上下文由调用点传入，避免全局可变单例。

### D2 扇区集合由配置驱动

`AppConfig` 新增：

```rust
#[serde(default, skip_serializing_if = "Option::is_none")]
pub roulette_sectors: Option<Vec<String>>,
```

- `null`/缺失 = 内置默认 `ROOT_SECTORS` 顺序（8 项）。
- 非空数组 = 用户顺序；未知 id 忽略；重复 id 去重保留首个；空数组视为非法（拒绝写入），避免「全部隐藏后无法恢复」。
- 消费点：`floating-toolbar.ts` 调 `createRoulette(actions, onClose, { sectors })`，`visibleSectors` 已存在，无需改几何。

### D3 校验与归一化

- Rust：`validate_config` 校验每项 ∈ `ROOT_SECTORS` 的 8 个 id、长度 1..=8、无重复。
- 前端：`applyRustConfig` 对未知 id 丢弃并 `console.warn` 聚合一条，不抛错（白名单容错原则：最坏结果是没生效）。
- 非法整体拒绝：`save_config` / `patch_config` 走既有「校验 → 快照 → 原子写」链路，失败不落盘。

### D4 设置面与回滚

- 设置·编辑器新增「轮盘扇区」区：8 行复选 + 上移/下移 + 「恢复默认」。
- 恢复默认写 `null`（不是写回 8 项数组），让未来默认值变更能自动继承。
- 回滚兜底：写前快照 10 份（既有）；AI 改写走 `patch_config` 确认卡。

### D5 不做

- 不做扇区图标/标签的自定义（属 `icons.json`，需放宽 `IconName` 封闭联合，另立 change）。
- 不做工具条槽位（本 change 只证明链路；复制动作待本 change 合并后评估）。
- 不做 `run` 删除（contract 阶段单独一条，避免一次改两层）。

## 数据面

| 落点 | 位置 | 载体/符号 | 判据 |
|---|---|---|---|
| 规格 | design-system:§2 | — | 图标尺寸只允许 14/18/24，扇区图标不改 |
| 存储 | src-tauri/src/config.rs | roulette_sectors | 可空；缺省回落内置 8 项顺序 |
| 校验 | src-tauri/src/config.rs | validate_config | 每项 ∈ 8 个 id；长度 1..=8；无重复 |
| 桥接 | src/hooks/useConfig.ts | applyRustConfig | 未知 id 丢弃并聚合告警；空数组回落默认 |
| 消费 | src/editors/orchestration/floating-toolbar.ts | createRoulette | 数组顺序即扇区显示顺序 |
| 回滚 | snapshots/ | restore_config_snapshot | 写前快照 10 份，一步恢复；恢复默认为 null |

## 3. 风险

- **与后续 batch14 的轮盘改动冲突**：本 change 只动扇区集合与命令 id，不动几何/视觉；batch14 的轮盘视觉项排在其后合并。
- **双轨期不一致**：`run` 与 `commandId` 同时存在时以 `run` 优先，需在代码注释外以测试锁定「注册表命中」路径，避免新项只写 `commandId` 却因旧分支不可执行。
- **配置写坏**：空数组与未知 id 是两类最容易出现的坏输入，已分别用「拒绝」与「忽略」处理。
