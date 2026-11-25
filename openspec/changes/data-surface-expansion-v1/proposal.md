## Why

P0（`data-surface-contract-v1`）只证明了 html-toolbar 一个面的完整闭环。今天要再加一个可配置面，仍必须同时改四处：Rust 的 `SurfaceId` 枚举、`surfaces()` / `default_file_name()` / `user_override()` 三处登记、前端 loader 的面清单——新增面等于一次代码改动，AI 与维护者都无法只靠数据文件完成（`src-tauri/src/surfaces.rs:29` 注释自述「P1 再抽象」）。

与此同时，三类用户每天都在看的界面结构仍是前端代码常量：菜单（格头 ⋯ / AI 窗格 ⋯ / 导出子菜单 / 页签右键 / 预览右键 / AI 浮窗）、UI 图标（`src/ui/icons.ts`）、胶囊工具条（`src/editors/orchestration/capsule-toolbar.ts`）。结果是「改一个菜单文案、换一个图标、调一次胶囊按钮」都要改源码发版。用户明确要求以「面」为单位推进：新增能力应当是新增数据面，而不是新增散点代码（issue #1496）。

## What Changes

- **面注册表**：把「面」从代码分支变成登记数据。面 = `{id, 默认文件名, 项形状(shape), 校验器}`；Rust 端由清单驱动加载/物化/合并，删除「枚举 + 三处 match」样板；前端 loader 的已知面清单同样由该数据派生。新增面不再复制样板代码。
- **三个面整体落地**（每个面都走完整闭环：默认文件 → 用户覆盖 → 面级热应用 → AI 读写 → 回滚）：
  - **菜单面** `user/menus.json`：覆盖格头 ⋯、AI 窗格 ⋯、导出子菜单、页签右键、预览右键、AI 浮窗六处；项可增删、排序、启停、**改名**。
  - **图标面** `user/icons.json`：覆盖 UI 图标集合；可换路径、**改名称（label）**、新增概念键。
  - **胶囊面** `user/capsules.json`：胶囊按钮集可增删、排序、**改名**。
- **`surface:new` 脚手架**：一条命令生成面的默认 JSON、登记项与六栏表模板，AI 新增面不再手抄。
- **AI 工具白名单扩展**：`read_data_surface` / `patch_data_surface` 的面白名单从 1 个扩到 4 个（html-toolbar + 三新面）；写入仍走「校验 → 快照 → 原子写」。
- **消费端接线**：菜单消费端统一读菜单面；`Icon` 组件按概念键查图标面（label 来自面数据，缺失回落默认）；`createCapsuleToolbar` 读胶囊面。
- 既有 `htmlToolbarItems` 语义、设置页 UI、菜单/图标/胶囊的既有行为不变（默认值来源变化，行为语义不变）。

## Capabilities

### New Capabilities

- `data-surfaces`: 数据面的默认源、加载、变更事件与 AI 读写工具的行为契约。本变更把 P0 的单面样板抽象为注册表，并登记 `menus` / `icons` / `capsules` 三个新面（html-toolbar 既有语义不变）。

### Modified Capabilities

- `ai-agent`: AI-5 数据面读写工具的面白名单从 `html-toolbar` 扩到四面；`patch_data_surface` 的补丁形状按面 shape 分派（html-toolbar 仍为 `{"items":[...]}`，新面按各自形状）。

## Impact

- 代码：`src-tauri/src/surfaces.rs`（注册表抽象 + 三面登记 + 形状校验）、`src-tauri/src/ai_agent.rs`（面白名单与 patch 分派）、`src-tauri/src/lib.rs`（`load_surfaces` 返回四面）、`src/lib/dataSurfaces/loader.ts`（形状归一化）、`src/lib/dataSurfaces/store.ts`（按面缓存）、`src/lib/paneHeaderMenu.ts`（常量删除，改消费面）、`src/components/Content/PaneTreeView.tsx` / `TabBar.tsx` / `PreviewView.tsx`（菜单消费端）、`src/ui/icons.ts` 与 `src/components/Icon.tsx`（图标面消费）、`src/editors/orchestration/floating-toolbar.ts` 与 `capsule-toolbar.ts`（胶囊面消费）、`src-tauri/src/config.rs`（SKILL_MAP 增补）。
- 数据：`resources/{menus,icons,capsules}.default.json`（新增默认源文件，物化到 `defaults/surfaces/`）；`user/menus.json` / `user/icons.json` / `user/capsules.json`（用户覆盖）。
- AI 通路：`read_data_surface` / `patch_data_surface` 面白名单 1→4；SKILL.md 配置地图增补三面。
- 测试：Rust 集成测试（注册表驱动四面的物化/合并/过滤/回落 + 新增面无需改 match 的回归断言）；前端契约测试（三面 loader 归一化）；e2e（mock 桥：改面文件 → 界面变化）。
- 兼容：`htmlToolbarItems` 既有字段与设置页行为不变；默认值来源变化对用户不可见（顺序与文案不变）。
- 来源：issue #1496（spec）+ `docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md` §4/§6 + `01-plugin-capability-extraction.md` §5。
