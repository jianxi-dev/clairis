# Tasks

## 1. 补丁写边界与 state 保护（根因修复）

- [ ] 1.1 Rust 侧补丁边界加固：`apply_patch_at` 重写（删除 state 写入；写盘内容改为合并后的 user 层 JSON；返回 `load_config_at` 真实有效配置）+ `validate_patch_keys`（allowlist 从 `AppConfig::default()` 序列化键集派生、嵌套递归、state 专属键拒绝）；`cargo test` 新增集成测试六条（state 字节不变 / 未知顶层键 / 嵌套未知键 / state 键拒绝 / 只写 diff / 旧配置兼容加载）并更新 `patch_config` 工具既有测试。**用户可见结果**：AI 补丁后「最近文件/阅读位置」保留、写错键名得到明确报错。**数据面**: 存储,校验

## 2. html-toolbar 数据面（默认源 + 加载 + 事件 + 消费接线）

- [ ] 2.1 数据面样板全链：新增 `src-tauri/src/resources/html-toolbar.default.json`（默认唯一来源）与 `surfaces.rs`（面注册/物化 defaults 层/合并过滤/聚合告警）；`load_surfaces` 命令与 `surfaces-changed(id)` 事件（watcher 500ms 指纹去抖扩展到面文件）；前端 `src/lib/dataSurfaces/loader.ts` + `store.ts`（按面缓存、事件只重载对应面、不复用 `applyRustConfig` 全量重放）；删除 `slots.ts` 的 `HTML_TOOLBAR_ITEMS`/`HTML_TOOLBAR_DEFAULT_ORDER` 常量，`horizontal-toolbar.ts` 改消费面加载器（有效集合顺序即渲染顺序，无常量兜底）；契约测试（loader 三态归一化 + 默认文件↔TS 类型对账）+ e2e（mock 桥：覆盖顺序 A→B 驱动渲染顺序）+ 既有工具条/设置页测试回归。**用户可见结果**：改面文件后工具条即时更新；默认顺序不变。**接线归属**：`load_surfaces`/`surfaces-changed` 由本票接进 `App.tsx` 启动加载与 store 订阅。**数据面**: 存储,桥接,消费

## 3. AI 数据面两工具与配置地图增补

- [ ] 3.1 agent 通路扩展：`tool_schemas` 扩到五工具（新增 `read_data_surface` / `patch_data_surface`，schema 含 id 枚举与补丁形状）；`dispatch_tool` 实现两工具（面白名单：未登记 id 结构化错误；`patch_data_surface` 复用 1.1 写边界校验 + 既有快照 + 原子写，只写用户覆盖、不触碰 defaults 物化文件）；`SKILL.md` 模板增补两工具说明与 html-toolbar 面（路径/字段/示例），保持「存在不覆盖」语义；Rust 测试（读面三段返回 / 改面生效可回滚 / 未登记 id 拒绝 / 默认文件不被修改）。**用户可见结果**：对 AI 说「工具条只留粗体和斜体」→ 工具条变化且可回滚。**Blocked by**: 2.1（面注册先行）。**数据面**: 校验
