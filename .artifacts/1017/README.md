# #1017 属性面板溢出文档页边界 —— 复现与修复报告

日期：2026-11-17 ｜ 分支：`fix/dpb-overflow` ｜ 结论：**已复现，已修复**

## 1. 复现结论

用户反馈的「属性部分超出文档页面边界、铺满全窗口」属实，根因是**两处无溢出约束**：

1. **面板本体（A 一行条）**：标题 `.dpb-a-title` 与胶囊键名 `.dpb-k` 没有溢出约束。超长无空格内容（长标题 / 长键名）会画出面板边框，横向铺满整个窗口。
2. **菜单浮层**：`.dpb-menu`（`position: fixed`）只按按钮左缘定位，不夹视口右缘。标签/文档建议菜单在输入框靠近右缘时越出视口。

B 精排双列的值列 / 标签列本就带 `minmax(0,1fr)` + `overflow:hidden`，不复现。

## 2. 复现矩阵（修复前）

量测口径：`panelScrollWidth > panelClientWidth` 视为面板内容溢出；浮层 `boundingBox.right > 视口宽` 视为越出视口。

### 2.1 面板本体（A 态）

| 形态 | 窗宽 | 面板 scroll/client | 溢出元素 |
|---|---|---|---|
| 长标题（220×A） | 1280 | 2622 / 1246 | `.dpb-a-title` |
| 长标题 | 900 | 2622 / 866 | `.dpb-a-title` |
| 长标题 | 640 | 2622 / 606 | `.dpb-a-title` |
| 长标题 | 400 | 2622 / 366 | `.dpb-a-title` |
| 长键名（60×k） | 400 | 395 / 366 | `.dpb-k` / `.dpb-chip` |
| 长键+长值 | 400 | 389 / 366 | `.dpb-k` / `.dpb-chip` |

B 态全部窗宽：`panelScrollWidth == panelClientWidth`，无溢出。

### 2.2 菜单浮层

| 浮层 | 态 | 窗宽 | 右缘 | 视口 | 判定 |
|---|---|---|---|---|---|
| 标签建议 | A | 900 | 1000.23 | 900 | 越出视口 |
| 标签建议 | B | 400 | 436.23 | 400 | 越出视口 |
| 模板状态文案 | B | 400 | 440.89 | 400 | 越出面板（被 `.dpb-b` 裁剪） |

类型菜单 / 模板菜单在 1280/900/640/400 均未越界。

## 3. 根因链

- A 态标题：`.dpb-a-title` 仅 `min-width:0`，无 `overflow/text-overflow/white-space`。flex 行内元素盒被压缩，但文字照常画出 → 覆盖整个窗口。
- A 态胶囊键名：`.dpb-k` 同样无约束；`.dpb-chip` 无 `min-width:0`，长键把胶囊内容顶出。
- 浮层：`.dpb-menu` 定位 `left = max(8, 锚点.left)`，无右缘夹取；宽度是 `fixed + auto`（随 `left` 收缩），既会越界又会让定位计算振荡。
- 模板状态：`.dpb-tpl-status` `white-space:nowrap`，B 态工具条 `margin-left:auto` 靠右，超长时顶出面板。

## 4. 修复（最小 diff）

`src/styles/doc-property.css`
- `.dpb-a-title` / `.dpb-k`：补 `overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0`（对齐 B 态 `.dpb-b-label` 的既有做法）。
- `.dpb-chip`：补 `min-width:0`。
- `.dpb-type-wrap`：`flex:0 0 auto`，避免类型图标被压到 3px。
- `.dpb-menu`：`width:max-content; max-width:calc(100vw - 16px)`，使宽度与 `left` 解耦。
- `.dpb-b-head` / `.dpb-b-tools`：`flex-wrap:wrap`，窄窗允许换行。

`src/components/Content/useMenuPos.ts`（新增）
- 渲染后测量浮层尺寸，把右缘/下缘夹进视口（沿用 `TabInfoPopover` 先例），依赖 `[anchor]`。

`src/components/Content/DocPropertyBar.tsx` / `SuggestMenu.tsx`
- 类型菜单 / 模板菜单 / 建议菜单改用 `useMenuPos` 定位。

## 5. 修复后复查

- 面板本体：全形态 × A/B × 1280/900/640/400，`panelContentOverflow = 0`，溢出元素数 `0`。
- 浮层：标签建议 A-900 右缘 892 ≤ 900；B-400 右缘 392 ≤ 400；模板状态 B-400 右缘 248 ≤ 400。
- 证据：`before/` 与 `after/` 截图对 + 三份数值矩阵（`probe-body-matrix.json` / `probe-menu-matrix.json` / `probe-suggest-matrix.json`）。

## 6. 验证输出

- `npx tsc --noEmit` → exit 0
- `npm test` → 138 文件 / 1773 用例全绿
- `npx playwright test e2e/doc-property-panel.spec.ts` → 59 passed
- `npx playwright test e2e/dpb-overflow-probe.spec.ts` → 3 passed（回归探针）

## 7. 假设与边界

- 用户未注明 A/B 态与字段形态；本票以「长标题 / 长键名 / 长键+长值」复现同一溢出类别，未逐字还原用户文档。
- 长模板名无法经 e2e mock 桥注入（模板为应用级配置），以「套用模板后的状态文案」近似长模板名场景。
- 未测分屏（PaneTreeView）场景；窄窗 400px 已覆盖等效的宿主变窄条件。
