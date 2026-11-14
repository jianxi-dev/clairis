# 验收锚点 — editor-surface-batch18

锚点来源：用户 2026-11-14 反馈（spec issue #805）；design.md D1–D6。

## R-1 格头菜单只留格级动作

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | exact | 格头 ⋯ 菜单项数 | 6 | #805 第 1 条 / design D1 |
| A-1.2 | exact | 格头菜单中「导出」出现次数 | 0 | #805 第 1 条 / design D1 |
| A-1.3 | exact | 格头菜单中「刷新」「打开文件位置」出现次数 | 0 | #805 第 1 条 / design D1 |

## R-2 文件动作在页签右键菜单内的顺序与承载

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | exact | idx(导出) < idx(复制路径) | "true" | #805 第 1 条 / design D1 |
| A-2.2 | exact | idx(打开文件位置) > idx(复制路径) | "true" | #805 第 1 条 / design D1 |
| A-2.3 | exact | idx(刷新) < idx(关闭) | "true" | #805 第 1 条 / design D1 |
| A-2.4 | exact | 页签右键菜单项数 | 11 | #805 第 1 条 / design D1 |
| A-2.5 | exact | 右键菜单导出子菜单项数 | 6 | #805 第 1 条 / design D2 |
| A-2.6 | exact | 导出子菜单中 print 项数 | 0 | #805 第 2 条 / design D3 |
| A-2.7 | exact | idx(打印) - idx(导出) | 1 | #805 第 2 条 / design D3 |

## R-3 导出族图标在右键子菜单可辨

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-3.1 | exact | Word / ZIP / .mdpkg 三项图标 `d` 去重数 | 3 | #805 第 1 条 / design D2 |

## R-4 打印按预览态输出

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-4.1 | exact | 点击打印后 `window.print` 调用次数 | 1 | #805 第 2 条 / design D3 |
| A-4.2 | exact | 打印视图中 `.cm-line` 节点数 | 0 | #805 第 2 条 / design D3 |
| A-4.3 | exact | 含 mermaid 文档的打印视图中 `svg` 节点数 | 1 | #805 第 2 条 / design D3 |
| A-4.4 | exact | 打印媒体下应用外壳根节点计算 display | "none" | #805 第 2 条 / design D4 |
| A-4.5 | exact | 打印结束后打印视图节点数 | 0 | #805 第 2 条 / design D3 |
| A-4.6 | exact | 打印前后滚动容器 scrollTop 差值 | 0 | #805 第 2 条 / design D3 |

## R-5 含图片文档可滚动回顶部

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-5.1 | exact | 滚轮回顶后滚动容器 scrollTop | 0 | #805 第 3 条 / design D5 |
| A-5.2 | state-machine | 回顶后首块相对容器可见 | "true" | #805 第 3 条 / design D5 |
| A-5.3 | exact | crop 图渲染宽度 ≤ 内容容器宽度 | "true" | #805 第 3 条 / design D5 |
| A-5.4 | state-machine | 图片加载完成后仍可回到 scrollTop 0 | "true" | #805 第 3 条 / design D5 |
