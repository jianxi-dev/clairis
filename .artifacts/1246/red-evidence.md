# #1246 修复前证据（红）

## 结论

A 态（胶囊换行网格）拖拽落点指示是一条**整宽水平线**（`width=1078`、`height=2`），
不区分左/右插入间隙，且横线视觉压在目标行胶囊上。`data-orientation` 属性不存在。

## 复现

- 文档：`ROW_DOC`（title + category/author/source/note），A 态、编辑态。
- 动作：拖动 `category` 胶囊手柄到 `source` 胶囊右下（`source.x + 0.75w`, `source.y + 0.75h`）。
- 落点 gap index 由 `computeDropIndex` 按 clientX 算得（#1229 语义），但指示条只画横线。

## 实测几何（修复前）

```
indicator: { orientation: null, x: 61, y: 173.25, width: 1078, height: 2 }
source:    { x: 345.39, y: 172.25, width: 121.73, height: 25.58 }   // 右缘 467.12
note:      { x: 483.13, y: 172.25, width: 109.58, height: 25.58 }  // 左缘 483.13
```

- 横线覆盖整行宽（1078px），把 `source` 与 `note` 之间的真实间隙 `[467.12, 483.13]` 完全盖住。
- 用户无法判断将插到 `source` 左侧还是 `note` 左侧。
- 截图：`.artifacts/1246/red-horizontal-line.png`。

## 新增断言的红跑结果（修复前代码）

```
npx playwright test e2e/doc-property-panel.spec.ts -g "#1246" --retries=0
→ 3 failed
  1) A 态右下：Expected data-orientation "v", Received ""
  2) A 态行首：Expected data-orientation "v", Received ""
  3) B 态横线：Expected data-orientation "h", Received ""
```

失败点均为 `data-orientation` 缺失（元素为 `<span class="dpb-drop-line" data-testid="dpb-drop-line">`），
即修复前无方向语义。完整原始输出：`.artifacts/1246/red-e2e-output.txt`。

修复后：同一组用例 3 passed；A 态竖条几何（x 落在相邻胶囊之间 / 行首贴左缘、高 = 行高）与
B 态整宽横线均断言通过，`computeDropIndex` 语义与 #1229 三处顺序断言不变。
