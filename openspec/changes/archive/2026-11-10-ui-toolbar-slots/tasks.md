# Tasks: 横向工具条槽位化（ui-toolbar-slots）

> 切片原则：1 task = 1 用户可见交付物。Blocked by 只记真实文件级冲突（同一文件 = 冲突，本仓 1 issue = 1 PR）。
> QG-2：每条均新增/扩展 e2e，无 `no-ui-impact` 豁免。
> QG-6：2 票 < 6，不设集成 checkpoint。

## 1. 槽位模型与配置驱动（用户可见）

依赖：无

- [x] 1.1 `slots.ts` + `htmlToolbarItems` 字段：槽位数据、命令注册、校验、桥接、消费
  - 粒度：用户可见交付物
  - 实现：`HTML_TOOLBAR_ITEMS`（12 项）与 `resolveToolbarOrder`；`horizontalToolbar` 按解析后的顺序渲染、执行走 `executeCommand`；`AppConfig.html_toolbar_items` + `validate_config` 白名单/长度/去重；`applyRustConfig` 归一化；`saveAppConfig` 回写。
  - 验收：默认工具条 `[data-action]` 数量严格等于 13（12 动作 + 清除格式）；配置去掉 `format-bold` 后为 12 且 `[data-action="format-bold"]` 数量为 0；调整顺序后首个 `[data-action]` 随配置变化。
  - e2e：`e2e/toolbar-slots.spec.ts`（新增）。
  - 接线归属：`horizontal-toolbar.ts` 的 `build()` 装配点。

## 2. 设置面与回滚（用户可见）

依赖：1（同一配置字段与设置区）

- [x] 2.1 设置·编辑器「文字工具条」勾选/排序/恢复默认
  - 粒度：用户可见交付物
  - 实现：12 行复选 + 上移/下移；「恢复默认」写 `null`；保存走 `saveAppConfig`（校验+快照）。
  - 验收：取消勾选「粗体」后工具条 `[data-action]` 为 12；上移一项后顺序立即变化；重启后保持；点「恢复默认」回到 13；空数组保存被拒且 `user/settings.json` 中 `htmlToolbarItems` 不变。
  - e2e：扩展 `e2e/toolbar-slots.spec.ts`（设置面板三态 + 重启）。
  - 接线归属：`SettingsView.tsx` → `saveAppConfig()`。
