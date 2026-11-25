# Tasks

## 1. 面注册表抽象（prefactor）

- [x] 1.1 **prefactor（唯一允许的前置抽象）**：`src-tauri/src/surfaces.rs` 重写为登记表驱动——`SurfaceSpec { id, default_file, shape, validator }` + `SURFACES: &[SurfaceSpec]`，`load_all` / `default_file_name` / `user_override` / `embedded_defaults` 全部由 spec 分派，删除 `SurfaceId` 枚举与三处 match；前端 `src/lib/dataSurfaces/loader.ts` 的已知面清单 `SUPPORTED_SURFACES` 由同一份登记数据派生，新增对账测试（Rust 表 ↔ TS 清单 id 集合逐值一致）；html-toolbar 既有语义与 12 项默认顺序不变（回归断言）。**用户可见结果**：本票为纯抽象，用户可见结果由 T2–T4 承载；本票自身以「新增一个面无需改 match」的回归断言自证。**数据面**: 存储,校验

## 2. 菜单面（六处接线）

- [x] 2.1 菜单面全链：新增 `src-tauri/src/resources/menus.default.json`（默认唯一来源，含六处消费端分组）与 `user/menus.json` 用户覆盖；形状 `menu-item`（id/label/icon/action/enabled/order）与校验器（缺字段/类型错/未知 action 过滤 + 聚合告警）；删除 `src/lib/paneHeaderMenu.ts` 的 `PANE_MENU_ITEMS`/`EXPORT_MENU_ITEMS`/`AI_PANE_MENU_ITEMS` 常量与 `src/components/TabBar.tsx` / `PreviewView.tsx` / `PaneTreeView.tsx` / `AiConversation.tsx` 的硬编码项，六处消费端统一读菜单面（按 `group` 过滤）；面级热应用（`surfaces-changed("menus")` 只重载菜单面）；契约测试（改名/排序/启停生效、空覆盖回落、坏项过滤告警）+ e2e（mock 桥：改 `menus.json` → 格头菜单文案与顺序变化可见）。**用户可见结果**：改 `user/menus.json` 后格头 ⋯、AI 窗格 ⋯、导出子菜单、页签右键、预览右键、AI 浮窗预设菜单即时变化；默认顺序与文案不变。**数据面**: 存储,桥接,消费

## 3. 图标面（仅 UI 图标）

- [x] 3.1 图标面全链：新增 `src-tauri/src/resources/icons.default.json`（默认唯一来源，内容 = `src/ui/icons.ts` 的 `ICONS` 全量）与 `user/icons.json` 用户覆盖；形状 `icon`（概念键/label/d?/s?/dash?/parts?）与校验器（缺 path 组字段拒绝 + 聚合告警）；`src/components/Icon.tsx` 按概念键查图标面（label 与 path 组来自面数据，缺失回落 `ICONS` 默认）；面级热应用；契约测试（改名/换路径/新增概念键生效、坏定义回落）+ e2e（mock 桥：改 `icons.json` 的 label/路径 → 图标与名称变化可见）。**用户可见结果**：改 `user/icons.json` 后界面图标形状与显示名称即时变化；默认图标不变。**数据面**: 消费

## 4. 胶囊面

- [x] 4.1 胶囊面全链：新增 `src-tauri/src/resources/capsules.default.json`（默认唯一来源，内容 = `capsuleItems()` 现有 12 项）与 `user/capsules.json` 用户覆盖；形状 `capsule`（id/label/icon/order）与校验器；`src/editors/orchestration/floating-toolbar.ts` 的 `capsuleItems()` 改读胶囊面（`run` 由代码侧按 id 分派）；面级热应用；契约测试（按钮集增删/排序/改名生效、空覆盖回落）+ e2e（mock 桥：改 `capsules.json` → 选区工具条按钮集变化可见）。**用户可见结果**：改 `user/capsules.json` 后选中文本时出现的胶囊工具条按钮即时变化；默认 12 项不变。**数据面**: 消费

## 5. `surface:new` 脚手架 + 文档

- [x] 5.1 脚手架与可见交付：新增 `scripts/surface-new.sh <id> --shape <shape>` 生成「默认 JSON 模板（`resources/<id>.default.json`）+ 登记项骨架（`SURFACES` 表一行）+ 数据面六栏表模板（写进 design.md 的 `## 数据面`）」；`docs/agents/data-surface.md` 增补「新增面步骤」小节（登记 → 默认文件 → 校验器 → 消费端 → 六栏表）；用脚手架跑通一个演示面（如 `user/menus.json` 的模板生成）作为可见交付。**用户可见结果**：AI/维护者跑一条命令即得到新面的全部骨架文件，新增面不再手抄样板；文档可查。**数据面**: 规格

## 6. AI 工具白名单扩展与 SKILL 地图更新

- [x] 6.1 AI 通路扩展：`src-tauri/src/ai_agent.rs` 的 `parse_surface_id` 白名单从 `html-toolbar` 扩到四面；`patch_data_surface` 的补丁形状按面 shape 分派（html-toolbar/menus/capsules 为 `{"items":[...]}` 整体替换，icons 为 `{"items":[...]}` 逐键合并）；写入仍走「校验 → 快照 → 原子写」，只写 user 覆盖；`src-tauri/src/config.rs` 的 `SKILL_MAP` 增补三面（路径/字段/示例）；Rust 测试（读三面三段返回 / 改三面生效可回滚 / 未登记 id 拒绝 / 默认文件不被修改）。**用户可见结果**：对 AI 说「把格头菜单只留三项」「把某图标换个名字」「胶囊只留三个按钮」→ 界面变化且可回滚。**数据面**: 校验
