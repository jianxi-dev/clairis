## Why

维护者用《中汽系统搭建情况对称1110.md》实测（spec issue #1406）提出 6 组问题，其中 3 组（4 全组、6a/6d 卡片形态）不是「实现没生效」，而是**现行设计本身不满足目标**：

1. **高亮与标注未分家**：`callout-types.ts:38-54` 的 14 类型共用 `CalloutWidget` 与 `.cm-callout` 通用规则（`editor.css:2582-2595`：3px 左边框 + 软底色 + 标题栏）。`highlight` 只是 `tone=yellow` 的第 14 类，用户要的「荧光笔式纯高亮」在代码里不存在——它在界面上与「黄色标注」无法区分。
2. **颜色面板图标是字母 A**：`color-palette.ts:107-116` 对字体色生成 `textContent="A"` 的字符图标，类型切换另占一个图标按钮；既不形象，又把「类型」与「颜色」两个概念并列。
3. **嵌入文件卡不按 quiet 的三种显示方式组织**：现行只有「名称 / 内容」两态 + 宽窄按钮（`fileEmbed.ts:728-731`、`:320-333`），没有卡片 / 预览 / 嵌入三态；头部只有文件名、无描述副标题；工具条含下载。
4. **嵌入 md 不是预览态排版**：`fileEmbed.ts:579-616` 把 `renderMarkdown` 结果塞进带 `.preview-content` 的宿主，但外层 `.cm-embed-body` 与 `.cm-embed-md` 的字号/内边距覆盖（`editor.css:1202-1207`、`:1217-1224`）造成行距与独立预览不一致。
5. **预览态嵌入文件只剩 `?` 占位**：`renderers/markdown.ts:155-171` 的 image renderer 只识别 image/video/audio，pdf/md/html/附件一律输出 `<img>`，本地非图片路径必然裂图。

本批只处理 4 全组与 6a/6d（两组设计变更）；其余 13 项缺陷走缺陷线（见 #1406 关联 bug 票），不在本 change 范围。

## What Changes

- **纯高亮独立成块**：新增 `highlight` 类型的专用渲染分支——无左边框、无标题栏、圆角、荧光笔底色；色板取豆包截图六色相（红 / 橙 / 黄 / 绿 / 蓝 / 紫）。菜单收敛为两项：**高亮**（新建纯高亮块）与 **标注**（现行 callout 及其 13 个语义类型），四个入口（斜杠 / 块菜单「转为」/ 转换手柄菜单 / 选区轮盘）全部指向新语义。
- **颜色面板图标形象化**：字体色 / 边框色 / 填充色 / 高亮色统一改用形象图标（色块 + 荧光笔笔尖），水平居中；删除字母 A；删除独立的类型切换图标（类型只在「标注」子菜单里选）；切换类型时按色相映射到目标类型可用色板。
- **嵌入文件卡 quiet 化**：三态（卡片 / 预览 / 嵌入）+ 工具条（展开全屏、对齐、三态切换；无下载），头部为文件类型图标 + 文件名主标题 + 描述副标题；尺寸拖边框；保留全屏。
- **嵌入 md 保真与预览可渲染**：嵌入区域的字号 / 行高 / 段距 / 标题间距与独立预览态逐项一致；预览态对 md / pdf / html / 附件输出真实卡片或内嵌内容，不再产生裂图占位。
- **BREAKING（内部契约）**：`editing` 的「高亮块三色」（E-48）中「块族名统一为高亮 + 第 14 预设纯高亮」改为「高亮（纯高亮块）/ 标注（13 语义类型）」二分项；嵌入文件卡的「名称 / 内容」两态切换（`data-embed-state`）由三态取代。

## Capabilities

### New Capabilities

- 无新增能力域。

### Modified Capabilities

- `editing`：E-48 高亮块三色（纯高亮独立渲染分支 + 六色色板 + 菜单两项收敛）；E-50 附件卡与音频（嵌入文件卡三态 quiet 化 + 头部 + 拖边框尺寸）；嵌入 md 保真（排版与独立预览一致）；预览态嵌入文件可渲染（消灭裂图占位）。

## Impact

- 前端：`src/editors/callout-types.ts`、`src/editors/decorations/{callout,callout-insert}.ts`、`src/editors/callout-attrs.ts`、`src/editors/orchestration/{callout-color-panel,color-palette,block-menu,floating-toolbar,roulette-view,block-convert}.ts`、`src/editors/slash.ts`、`src/editors/decorations/{fileEmbed,image}.ts`、`src/renderers/markdown.ts`、`src/styles/{editor,reader}.css`。
- 图标：`src/ui/icons.ts` / `src/editors/icons.ts`（荧光笔 / 色块图标；两套必须同时覆盖）。
- 测试：e2e 新增 / 扩展（纯高亮渲染、颜色面板图标、嵌入三态、嵌入 md 保真、预览态嵌入渲染）；既有 `callout-color.spec.ts` / `embed-name-hover-newtab-852.spec.ts` / `file-embed-multiformat.spec.ts` 需同步修订。
- 无新增外部依赖；无数据库迁移；无 Rust 后端改动。
