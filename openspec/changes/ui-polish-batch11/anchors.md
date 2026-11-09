# 验收锚点 — ui-polish-batch11

锚点来源：用户 2026-11-10 走查清单、`design.md` R-D1…R-D6、现有 e2e。

## R-1 视频菜单

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | exact | 快捷键/播放列表/字幕三面板关闭按钮总数 | 0 | 清单 1 |
| A-1.2 | exact | 倍速菜单宽度（px） | 88 | 清单 1 |
| A-1.3 | state-machine | 倍速档位悬停时图标颜色与弧相同 | "true" | 清单 1 |
| A-1.4 | exact | 每次点击旋转的角度变化（度） | -90 | 清单 6 |

## R-2 页面宽度与 PDF

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | state-machine | 页面宽度按钮默认 opacity | 0 | 清单 2 |
| A-2.2 | state-machine | 指针移入后 150ms 内 opacity | 1 | 清单 2 |
| A-2.3 | exact | 宽度柱体虚线边框宽度（px） | 0 | 清单 2 |
| A-2.4 | state-machine | PDF 按钮栏底边线颜色等于主题 `--app-border` | "true" | 清单 3 |

## R-3 栏目菜单

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-3.1 | state-machine | 外部修改后点击刷新，正文包含新文本 | "true" | 清单 4 |
| A-3.2 | exact | 更多菜单「打开所在文件夹」条目数 | 1 | 清单 5 |
| A-3.3 | state-machine | 指针移入导出子菜单后仍可见 | "true" | 清单 7 |

## R-4 编辑器

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-4.1 | exact | 折叠三角与标题文字间距上限（px） | 2 | 清单 8 |
| A-4.2 | state-machine | 颜色/缩进二级面板左缘在父行右缘之右 | "true" | 清单 9 |
| A-4.3 | exact | 「对齐与缩进」入口图标数 | 1 | 清单 10 |
| A-4.4 | exact | 斜杠「插入 CSS」图标数 | 1 | 清单 10 |
