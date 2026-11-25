# 规格对齐：块菜单行高 36→32、菜单图标 20→18（#1434 裁决）

## Why

8547e4ce（editor-batch3-lowcost T4「菜单与浮窗统一」，2026-11-23）把 `MENU_ROW_HEIGHT` 从 36 收紧为 32（参考 Quiet 的密度优化），但未走规格修订：`openspec/specs/editing/spec.md` 的 E-7 / E-11 仍写「行高 36px」，e2e 锚点按规格断言 36 → `ui-fidelity` 稳定假红（#1434）。维护者已裁决（#1434，2026-11-25）：**32 为有意收紧**，规格是旧值。

同批需修正的还有同条款里早已过期的图标尺寸：台账 2026-11-22「编辑器图标渲染尺寸」（#1348/#1358）已把菜单图标收敛为 18px（design-system §2.1 常规档；实现 `ICON_SIZE_PX=18`、锚点 `menuIcon:18`、`block-menu`/`menu-floating` 断言 18），但 E-7/E-11 条款仍写「20px」。属同一处规格漂移，一并同步。

## What Changes

- `editing` 域 E-7「编排层交互契约」：块菜单「行高 36px、图标 20px」→「行高 32px、图标 18px」（1 处正文）。
- `editing` 域 E-11「块菜单结构与图标体系」：「菜单项图标 SHALL 为 20px，行高 SHALL 为 36px」→「18px / 32px」；场景 A-8.2「图标渲染尺寸为 20px」→ 18px（3 处）。
- `e2e/fixtures/editor-anchors.ts`：`menu.rowHeight` 36 → 32（实现/兄弟 spec 已是 32，仅锚点漂移）。
- `scripts/anchor-consistency-check.sh` 豁免台账：删除 `menu_row_height` 豁免行（#1434 裁决完成）；CI 步骤切 `--strict`。
- 不改任何运行时行为：实现已是 32px/18px，零代码变更。

## Impact

- 规格：`editing` 域 2 个 requirement 被修订（E-7、E-11），requirement 总数不变。
- 代码：零行为变更；仅 e2e 锚点常量与机检配置。
- 测试：`ui-fidelity`「菜单宽与行高符合 E-7 锚点」由稳定假红转绿；`block-menu` / `menu-floating`（已断言 32）不受影响。
