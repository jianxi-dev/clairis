# Tasks: 编辑态交互缺陷修复

## 1. 块菜单摆放与图标

- [x] 1.1 `anchor.ts`：`resolvePlacement` 增加 `align`（below / center-right / right），居中优先、夹取到最近合法位置、按较大一侧限高（#466/#487）。
- [x] 1.2 `block-menu.ts`：横向锚点改用手柄矩形、纵向取 `coordsAtPos` 的指针行，`align="center-right"`。
- [x] 1.3 `icons.ts`：文字字形图标放大到与路径图标等光学尺寸（#484）。

## 2. 手柄稳定性

- [x] 2.1 指针移动解除 hover 门控抑制（keyup 落在编辑器外不再卡死）。
- [x] 2.2 块菜单打开期间不 retarget、不召唤其它手柄。
- [x] 2.3 点击手柄（<4px 位移）直接开菜单。

## 3. 在下方添加

- [x] 3.1 悬停 150ms 打开二级面板，向右展开、父菜单保留（#456/#480）。
- [x] 3.2 `slash.ts`：`trigger="below"` 的锚定面板用 `align="right"` 摆放。
- [x] 3.3 父菜单收起时释放二级面板，避免孤儿面板。

## 4. 围栏代码块免疫

- [x] 4.1 `code.ts` 导出 `fencedCodeRanges`（含未闭合围栏）。
- [x] 4.2 标题 / 列表 / 引用 / 分割线 / 行内强调装饰跳过围栏区间。

## 5. 表格工具条与颜色

- [x] 5.1 存在单元格选区即显示工具条（单击也显示），单选时合并禁用。
- [x] 5.2 背景色 16 格写入 `mdb-bg-*`，恢复默认可清除。
- [x] 5.3 更新 `table-cell-selection` 单测到新契约（工具栏随单击出现）。

## 6. 验证

- [x] 6.1 e2e：block-menu 5 条新增、parity 1 条、table 3 条。
- [x] 6.2 `bash scripts/verify.sh` 全绿（tsc / eslint / vitest 897 / CSS manifest / cargo / Playwright 133 + 51）。
