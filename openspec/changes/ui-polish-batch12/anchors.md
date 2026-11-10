# 验收锚点 — ui-polish-batch12

锚点来源：用户 2026-11-10 口述 9 条需求（`docs/requirements/ui-polish-batch12/input-package.md`）；设计裁决 `docs/design/system/decisions.md`；生命周期规则 `docs/design/approved/popup-lifecycle/spec.md`。

## R-1 视频暂停起播与多路并行

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | exact | 打开视频 500ms 后 video.paused | "true" | 用户需求 1 |
| A-1.2 | exact | 两格同时播放时 muted | "false, false" | 用户需求 1 |
| A-1.3 | state-machine | 重启恢复后仍为暂停 | "暂停 → 恢复布局 → 仍暂停" | 用户需求 1 |

## R-2 转换手柄二级菜单常驻

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | state-machine | 指针移出 600ms 后二级面板可见 | "可见 → 移出 600ms → 仍可见" | 用户需求 2 |
| A-2.2 | exact | Esc 后二级面板节点数 | "0" | popup-lifecycle R3 |

## R-3 行内字色与背景色叠加

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-3.1 | exact | 编辑态字色绿色计算值 | "#2f8f46" | editor.css .cm-color-green |
| A-3.2 | exact | 编辑态背景紫色计算值 | "rgba(163, 113, 247, 0.25)" | editor.css .cm-bg-purple |
| A-3.3 | exact | 嵌套后编辑区出现的 span 源码文本数 | "0" | 用户需求 3 |
| A-3.4 | exact | 清除格式后源码含 mdb-color-/mdb-bg- 的计数 | "0" | 用户需求 3 |

## R-4 页面宽度四档与悬停弹窗

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-4.1 | exact | 宽度档位色块数量 | "4" | 用户需求 4 |
| A-4.2 | exact | 四档色块高度（px） | "14, 17, 20, 23" | 用户需求 4 |
| A-4.3 | exact | 选中/未选中填充不透明度 | "1 / <=0.45" | 用户需求 4 |
| A-4.4 | state-machine | 移出控件 300ms 后按钮与弹窗 | "可见 → 移出 300ms → 均不可见" | popup-lifecycle R1 |

## R-5 页签右键菜单与移动文件

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-5.1 | exact | 栏目「更多」菜单项数量 | "8" | paneHeaderMenu 9 项减 copyPath |
| A-5.2 | exact | 页签右键分隔线下方项文案 | "复制路径, 移动到…" | 用户需求 5 |
| A-5.3 | exact | 复制路径后剪贴板内容 | "/Users/test/a.md" | 用户需求 5 |
| A-5.4 | state-machine | 移动到目标目录后原目录 | "存在 → 移动 → 不存在" | 用户需求 5 |

## R-6 新建文件默认保存路径

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-6.1 | exact | 保存对话框初始目录 | "/Users/test/Docs" | 用户需求 6 |
| A-6.2 | state-machine | 设置默认路径后重启仍生效 | "设置 → 重启 → 仍为 /Users/test/Docs" | 用户需求 6 |
| A-6.3 | exact | 未落盘页签 Cmd+S 触发保存对话框次数 | "1" | 既有缺陷修复 |

## R-7 胶囊形悬停提示

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-7.1 | exact | 提示元素计算 border-radius | "999px" | design system §5 --radius-full |
| A-7.2 | exact | 轮盘「转换」扇区提示文案 | "转换" | 用户需求 7 |
| A-7.3 | exact | 页面残留原生 title 提示元素数 | "0" | 用户需求 7 |

## R-8 阅读空间 HTML 卡片缩略图

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-8.1 | exact | 最近列表 HTML 卡片数量（用例构造） | "6" | 用户需求 8 |
| A-8.2 | exact | 每张 HTML 卡片缩略图可见数 | "6" | 用户需求 8 |
| A-8.3 | exact | 卡片内 iframe 节点数 | "0" | reading spec A-14 |

## R-9 沉浸态浮层

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-9.1 | exact | 沉浸态 PDF 顶栏 1.5s 无交互后 opacity | "0" | 用户需求 9 |
| A-9.2 | state-machine | 页签条展开前后正文高度 | "高度 h → 浮出 → 仍为 h" | 用户需求 9 |
| A-9.3 | exact | 沉浸态页签条计算 position | "absolute" | 用户需求 9 |
