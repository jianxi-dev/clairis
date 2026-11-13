# 验收锚点 — editor-surface-batch17

锚点来源：用户 2026-11-13 提交 12 条编辑表面反馈（spec issue #754）；design.md D1–D14。

## R-1 页签右键菜单关闭协议

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | exact | 外点后 `[data-tab-menu]` 节点数 | 0 | #754 第 1 条 / design D1 |
| A-1.2 | exact | Esc 后 `[data-tab-menu]` 节点数 | 0 | #754 第 1 条 / design D1 |
| A-1.3 | state-machine | 失焦→回页再点后菜单残留节点数 | 0 | #754 第 1 条 / design D1 |

## R-2 PDF 按钮栏快捷键在视图内生效

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | state-machine | ⌘⇧D 后宿主 class 含 `pdf-chrome-pinned-hidden` | "true" | #754 第 2 条 / design D2 |
| A-2.2 | state-machine | 再按 ⌘⇧D 后宿主 class 含 `pdf-chrome-pinned-hidden` | "false" | #754 第 2 条 / design D2 |
| A-2.3 | exact | 总览 `mode-pdf-toolbar-pin` 行数 | 1 | #754 第 2 条 / design D2 |

## R-3 悬停提示按配置时长显示

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-3.1 | exact | 未配置回退延迟（ms） | 400 | #754 第 3 条 / design D3 |
| A-3.2 | exact | 配置 1.0 秒时 1100ms 处 `.app-tip` 节点数 | 1 | #754 第 3 条 / design D3 |
| A-3.3 | exact | 移出后 `.app-tip` 节点数 | 0 | #754 第 3 条 / design D3 |

## R-4 左边栏展开与固定快捷键

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-4.1 | state-machine | ⌘\ 后 `railState` | "pinned" | #754 第 4 条 / design D4 |
| A-4.2 | state-machine | 再按 ⌘\ 后 `railState` | "collapsed" | #754 第 4 条 / design D4 |
| A-4.3 | state-machine | ⌘⌥\ 后 `railPinned` | "true" | #754 第 4 条 / design D4 |

## R-5 预览分栏渲染

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-5.1 | exact | `.preview-content .layout-col-2` 节点数 | 1 | #754 第 5 条 / design D5 |
| A-5.2 | exact | 可见文本含 `:::` 次数 | 0 | #754 第 5 条 / design D5 |
| A-5.3 | exact | 两栏子项 x 差（px） | > 0 | #754 第 5 条 / design D5 |

## R-6 插入 CSS 图标

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-6.1 | exact | `[data-cmd="insert-css"] svg[data-icon="CssOutlined"]` 节点数 | 1 | #754 第 6 条 / design D6 |
| A-6.2 | exact | 该 svg `getBoundingClientRect().width` 下限 | 0 | #754 第 6 条 / design D6 |
| A-6.3 | exact | 关闭菜单后该 svg 节点数 | 0 | #754 第 6 条 / design D6 |

## R-7 HTML 区块尺寸拖拽稳定

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-7.1 | exact | e 边拖 100px 后宽度增量（px） | 100±2 | #754 第 7 条 / design D7 |
| A-7.2 | exact | w 边拖 60px 后 guide `left` 增量（px） | -60±2 | #754 第 7 条 / design D7 |
| A-7.3 | state-machine | pointercancel 后 guide 节点数；恢复尺寸后 `style.width` | 0；"" | #754 第 7 条 / design D7 |

## R-8 HTML 工具条当前值与图标化

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-8.1 | exact | 背景色控件数 / 字体族控件数 | 1 / 1 | #754 第 8 条 / design D8 |
| A-8.2 | exact | 字号 select `value` | "16px" | #754 第 8 条 / design D8 |
| A-8.3 | exact | 截图按钮数 / 文字标签按钮数 | 0 / 0 | #754 第 8 条 / design D8 |

## R-9 HTML 划选文字不出现拖拽幽灵

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-9.1 | exact | 划选 10 字符后 ghost 节点数 | 0 | #754 第 9 条 / design D9 |
| A-9.2 | exact | 划选后文档长度变化（字符数） | 0 | #754 第 9 条 / design D9 |

## R-10 HTML 对齐改下拉与两端对齐

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-10.1 | exact | 对齐 select 数 | 1 | #754 第 10 条 / design D8 |
| A-10.2 | exact | 对齐选项数 | 4 | #754 第 10 条 / design D8 |
| A-10.3 | exact | 选两端后计算 `text-align` | "justify" | #754 第 10 条 / design D8 |

## R-11 图片宽度注释 / 对齐按下态 / 双击预览裁剪

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-11.1 | exact | 跨行注释裁剪后可见文本含 `<!--w=` 次数 | 0 | #754 第 11 条 / design D10 |
| A-11.2 | exact | 对齐按钮 `aria-pressed` | "true" | #754 第 11 条 / design D10 |
| A-11.3 | exact | 双击预览 `img` 的 `object-position` | 等于裁剪偏移（无偏移样例为 "0px 0px"） | #754 第 11 条 / design D10 |

## R-12 图片工具条图标 / 插入图片 / 剪切图标 / 描述

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-12.1 | exact | 工具条 svg 数 | 9 | #754 第 12 条 / design D10 |
| A-12.2 | exact | 插入图片 `naturalWidth` 下限 | 0 | #754 第 12 条 / design D10 |
| A-12.3 | state-machine | 描述输入框默认 `display`；点「添加描述」后 | "none"；非 "none" | #754 第 12 条 / design D10 |

## R-13 转换菜单完整显示与窗口适配

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-13.1 | exact | 默认视口可见行数等于总行数 | "true" | #754 第 13 条 / design D11 |
| A-13.2 | exact | 320px 高视口菜单 `bottom` 上限 | 视口高 - 8 | #754 第 13 条 / design D11 |

## R-14 分栏插入改 5 竖条 hover 选区

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-14.1 | exact | 柱数 | 5 | #754 第 14 条 / design D12 |
| A-14.2 | exact | 滑到第 3 根选中数 | 3 | #754 第 14 条 / design D12 |
| A-14.3 | exact | 单元 `textContent` | "" | #754 第 14 条 / design D12 |

## R-15 视频块布局

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-15.1 | exact | `video.controls` | "true" | #754 第 15 条 / design D13 |
| A-15.2 | exact | 容器宽 / 行宽 | 0.667±0.02 | #754 第 15 条 / design D13 |
| A-15.3 | exact | 块手柄 `data-icon` | "VideoOutlined" | #754 第 15 条 / design D13 |

## R-16 斜杠菜单回显与逗号触发

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-16.1 | exact | 行首输入 `,h1` 后菜单节点数 | 1 | #754 第 16 条 / design D14 |
| A-16.2 | exact | 源码 | "/h1" | #754 第 16 条 / design D14 |
| A-16.3 | exact | `/h1` 删到 `/` 后列表行数 | 17 | #754 第 16 条 / design D14 |
