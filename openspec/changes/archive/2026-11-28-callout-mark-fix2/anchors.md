# 验收锚点 — callout-mark-fix2

锚点来源：用户 2026-11-28 反馈（左侧边框缺失、emoji 裁切、预览 emoji 不跟随、预览多行合并、标注色板过宽无随机），PR #1679 修复。R-1 对应 E-52 修订；R-2 对应 E-55；R-3 对应 E-56。

## R-1 四边 1px

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | exact | 预览态纯高亮四边 1px 细边 | 预览 `.callout-mark` 计算 `border-inline-start-width: 1px`、`border-top-width: 1px` | PR #1679 / 截图 |
| A-1.2 | exact | 预览态纯高亮无标题栏 | `.callout-title` 节点数 = 0，文本不含「纯高亮」 | PR #1679 / 截图 |

## R-2 预览换行

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | exact | 标注多行保留 | `> [!NOTE] 标题\n> 第一行\n> 第二行` 预览第一行与第二行分属两行（含 `<br>`） | PR #1679 / 截图 |
| A-2.2 | exact | 纯高亮多行保留 | `> [!highlight]\n> A\n> B` 预览 A 与 B 分属两行 | PR #1679 / 截图 |
| A-2.3 | exact | 列表不被污染 | `> - 甲\n> - 乙` 列表项之间无 `<br>`（`</li><br>` 不存在） | PR #1679 / 截图 |

## R-3 标注面板

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-3.1 | exact | 面板宽度与换行 | 面板计算宽 `246px`，字体行 1 行 9 格，边框/填充各 2 行 16 格 | PR #1679 / 截图 |
| A-3.2 | state-machine | 随机同色名 | 点击「随机」后首行同时出现同名 `bg=` 与 `border=`，`text` 不变，面板仍可见，一次撤销同时还原 | PR #1679 / 截图 |
