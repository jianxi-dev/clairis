# 验收锚点 — editor-highlight-crop-ime

锚点来源：spec issue #1437 五项缺陷 + 一手截图 `豆包高亮颜色截图.png` / `裁剪拖动保存前截图.png` / `裁剪拖动保存后截图.png` + 代码实读（`callout.ts` / `image.ts` / `decorations/index.ts`）；design.md D1–D4。

## R-1 纯高亮视觉与颜色面板

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | exact | 纯高亮块计算 `border-inline-start-width`（px） | 0 | #1437 反馈2 / design D1 |
| A-1.2 | exact | 纯高亮块计算 `border-top-width`（px） | 1 | #1437 反馈2 / design D1 |
| A-1.3 | exact | 纯高亮块计算 `border-radius`（px） | 4 | #1437 反馈2 / design D1 |
| A-1.4 | exact | 点击纯高亮块后工具条中心与块盒中心水平偏差（px） | 2 | #1437 反馈2 / 豆包高亮颜色截图.png |
| A-1.5 | state-machine | 点击「随机」→ 首行同时出现 bg 与 border，且 text 不变 | 点击→写入 | #1437 反馈2 / 豆包高亮颜色截图.png |
| A-1.6 | state-machine | 点击「恢复默认」→ 首行属性块为空 | 点击→清空 | #1437 反馈2 / design D1 |
| A-1.7 | exact | 字体色色块内字母 A 字形节点数（荧光笔节点数） | 1 | #1437 反馈2 / 豆包高亮颜色截图.png |

## R-2 菜单图标与命名

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | exact | 块菜单「转为」网格中高亮格与标注格 `data-icon` 去重后数量 | 2 | #1437 反馈3 / design D2 |
| A-2.2 | exact | 标注浮层 13 项 emoji 与新增菜单对应项一致的数量 | 13 | #1437 反馈3 / design D2 |
| A-2.3 | exact | 新增手柄菜单中标签为「标注」的项数（标签为「高亮」的标注项数） | 1 | #1437 反馈4 / design D2 |

## R-3 图片裁剪显示同构

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-3.1 | exact | 确认前后可见宽度比值 | 1 | #1437 反馈1 / 裁剪拖动保存前截图.png / 裁剪拖动保存后截图.png |
| A-3.2 | exact | 已裁剪图片 `img` 计算 `object-fit` | none | #1437 反馈1 / design D3 |
| A-3.3 | state-machine | 拖回整图确认 → `crop` 属性移除 | 确认→移除 | #1437 反馈1 / design D3 |

## R-4 IME 稳定与大文档键入

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-4.1 | exact | IME 连续输入后 `pageerror` 中 `TypeError` 条数 | 0 | #1437 反馈5 / 本地复现 |
| A-4.2 | exact | IME 输入前后 `.cm-scroller` `scrollHeight` 比值 | 1 | #1437 反馈5 / 本地复现 |
| A-4.3 | exact | 大文档连续键入 10 字期间全量装饰重建次数上限 | 1 | #1437 反馈5 / design D4 |
