## Why

batch19 已合并的票 #839 按 A6（用户原话「宽度对齐文本块」）把编辑态代码块 / 引用块的**边框盒**对齐到正文行盒；因此这类块的**文字列**必然比正文窄（差内边距与边框）。但主规格 `openspec/specs/editing/spec.md` 的 `### Requirement: E-23 块宽度统一` 仍写「编辑态引用块与围栏代码块的文字列宽度 SHALL 与普通正文行相同」，其两个编辑态 Scenario 也断言「文字列宽度差 = 0px」，与已落地实现和已通过的 e2e（`e2e/edit-block-borders-839.spec.ts`）矛盾。本次仅修正该 requirement 的口径，消除规格与实现的不一致。

注意：主规格有两个同号 `E-23`（:982 为「HTML 可视化编辑：选中块尺寸拖拽」，:1274 为「块宽度统一」）。本 change 只改「块宽度统一」这条，编号保持不变。

## What Changes

- E-23「块宽度统一」：预览态口径不变（预览引用块文字列仍与正文段落等宽）；编辑态口径由「文字列等宽」改为「边框盒与正文行盒等宽、左右边界对齐」，并明确文字列允许因内边距与边框收窄。
- 两个编辑态 Scenario 由「文字列宽度差 = 0px」改为「边框盒左右边界 x 差 = 0px」（`.cm-line.cm-quote` / `.cm-line.cm-fenced-code` vs 普通 `.cm-line`）。
- 不改 `:982` 的 E-23（HTML 尺寸拖拽），不改其它 requirement。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `editing`：E-23 块宽度统一（编辑态口径修正为边框盒对齐）。

## Impact

- 纯规格文档 change：无 `src/`、`src-tauri/`、`e2e/` 改动，无依赖变更。
- 归档时整体替换主规格 `openspec/specs/editing/spec.md` 的 E-23「块宽度统一」requirement。
