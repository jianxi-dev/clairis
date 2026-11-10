# Tasks: 轮盘可配置化（ui-command-registry）

> 切片原则：1 task = 1 用户可见交付物（prefactor 以 expand 角色单列）。Blocked by 只记真实文件级冲突（同一文件 = 冲突，本仓 1 issue = 1 PR）。
> QG-2：每条均新增/扩展 e2e，无 `no-ui-impact` 豁免。
> QG-6：3 票 < 6，不设集成 checkpoint。

## 1. 命令注册表（expand）

依赖：无

- [ ] 1.1 新增 `commands.ts` 并把轮盘动作执行切到 `commandId`
  - 粒度：expand
  - 实现：`registerCommand` / `executeCommand` / `hasCommand`；`floating-toolbar.ts` 装配时注册内置命令；`RouletteItem` 增加 `commandId`，执行优先级 `run` > `commandId` > 不渲染可点项。
  - 验收：点击轮盘「加粗」后编辑态源码出现 `**`；`hasCommand("bold")` 为真；`commandId` 未注册且无 `run` 的项不可点击且不出现在筛选结果。
  - e2e：`e2e/roulette-command-registry.spec.ts`（新增）。
  - 接线归属：`floating-toolbar.ts` 的 `actions` 装配处（本票内完成，无跨票接线）。

## 2. 轮盘扇区数据面（用户可见）

依赖：1（同一 `floating-toolbar.ts` 装配点）

- [ ] 2.1 `rouletteSectors` 字段：Rust schema + 校验 + 桥接 + 消费
  - 粒度：用户可见交付物
  - 实现：`AppConfig.roulette_sectors`（可空）；`validate_config` 白名单/长度/去重；`useConfig.applyRustConfig` 未知 id 忽略；`createRoulette` 接 `options.sectors`。
  - 验收：手改 `user/settings.json` 去掉 `columns` 并重载 → 轮盘 7 扇区且无分栏扇区；调换两项顺序 → 扇区按新顺序排列；写入未知 id → 仍为默认 8 项且界面无报错。
  - e2e：`e2e/roulette-sectors.spec.ts`（新增，覆盖上述三态）。
  - 接线归属：`floating-toolbar.ts` 的 `createRoulette(...)` 调用点。

## 3. 设置面与回滚（用户可见）

依赖：2（同一设置区与配置字段）

- [ ] 3.1 设置·编辑器「轮盘扇区」勾选/排序/恢复默认
  - 粒度：用户可见交付物
  - 实现：8 行复选 + 上移/下移；「恢复默认」写 `null`；保存走 `saveAppConfig`（校验+快照）。
  - 验收：取消勾选「分栏」→ 轮盘立即 7 扇区；上移一项 → 顺序立即变化；重启应用后保持；点「恢复默认」→ 回到 8 项默认顺序；写入空数组被拒且 `user/settings.json` 内容不变。
  - e2e：扩展 `e2e/roulette-sectors.spec.ts`（设置面板三态）。
  - 接线归属：`SettingsView.tsx` → `saveAppConfig()`。
