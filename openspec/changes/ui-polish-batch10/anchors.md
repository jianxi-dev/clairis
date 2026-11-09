# 验收锚点 — ui-polish-batch10

锚点来源：用户 2026-11-09 第六次走查 12 项、design D-1…D-7、代码复核。

## R-1 工具条归属

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | exact | MD 编辑态未选文字时 `[data-testid="block-toolbar"]` 节点数 | 0 | design |
| A-1.2 | exact | HTML `<p>` 选中时工具条 AI 按钮数 | 1 | design |
| A-1.3 | exact | HTML `<p>` 选中时字号 / B / I / U / S / 链接 / 对齐 / 字色 / 删除控件齐备 | "true" | design |
| A-1.4 | exact | HTML `<section>` 选中时背景色与边框色控件数 | 2 | design |
| A-1.5 | exact | HTML `<section>` 选中时字号控件数 | 0 | design |

## R-2 复开缺陷

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | state-machine | 空行 + 悬停 1s 后 `[data-testid="block-menu"]` 节点数 | 0 | design |
| A-2.2 | exact | 行首输入 `／` 后文档文本 | "／" | design |
| A-2.3 | exact | 行首输入 `、` 后斜杠菜单节点数 | 0 | design |

## R-3 视频多栏

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-3.1 | exact | 两栏分别打开视频后视频元素数 | 2 | design |
| A-3.2 | state-machine | 第二栏打开视频后第一栏 `video.src` 保持不变 | "true" | design |
| A-3.3 | state-machine | 第二栏打开 Markdown 后第一栏视频仍可播放 | "true" | design |

## R-4 视频按钮

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-4.1 | exact | 倍速主控件与档位表盘的 SVG 路径数 | 相同 | design |
| A-4.2 | exact | 全屏与画中画图标描边宽度（px） | 相同 | design |
| A-4.3 | exact | 时间戳笔记与截图图标高度（px） | 相同 | design |
| A-4.4 | exact | 快捷键总览「媒体」家族条目数 | "≥12" | design |

## R-5 打开类型

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-5.1 | exact | Rust 图片过滤器含 heif/heic | "true" | design |
| A-5.2 | exact | Rust 音频过滤器存在 | "true" | design |
| A-5.3 | exact | `.sh` 的 fileType | "code" | design |

## R-6 栏目/页签/左栏

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-6.1 | exact | 栏目菜单含 `refresh` 项 | "true" | design |
| A-6.2 | exact | 页签改名输入框宽度（ch） | 24 | design |
| A-6.3 | exact | 收起态 `rail-edge` 计算 `visibility` | "visible" | design |

## R-7 菜单

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-7.1 | exact | 新建/转换菜单宽度（px） | 176 | design |
| A-7.2 | exact | 插入 CSS 行图标数 | 0 | design |
| A-7.3 | exact | 对齐与缩进行图标数 | 0 | design |
| A-7.4 | exact | 剪切块图标类名 | "ScissorsOutlined" | design |
| A-7.5 | state-machine | 颜色面板指针移出 300ms 后仍存在 | "true" | design |

## R-8 折叠

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-8.1 | state-machine | 召唤区内仅当前行三角 `opacity` 为 1 | "true" | design |
| A-8.2 | exact | 预览态折叠按钮数（有下级的标题数） | "≥1" | design |
| A-8.3 | state-machine | 预览态点击后后续内容隐藏 | "true" | design |

## R-9 表格

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-9.1 | exact | 编辑态单元格 `border-right-width` | "1px" | design |
| A-9.2 | exact | 预览态单元格 `border-right-width` | "1px" | design |
