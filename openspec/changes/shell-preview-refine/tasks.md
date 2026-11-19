# 任务 — shell-preview-refine

> 切片原则（QG-7）：每张票做完用户能在界面上看到变化；1 任务 = 1 票 = 1 PR。
> **Blocked by 语义**：硬边，未解除不得开工。本 change 四票分属状态栏、页签表面、预览渲染、设置面，文件无重叠，均可并行起头。

## 依赖与阻塞总览

- 1.1 无阻塞。
- 2.1 无阻塞（页签表面独立于状态栏）。
- 3.1 无阻塞（预览渲染独立）。
- 4.1 无阻塞（设置面板独立；Rust 命令为本票自带，不依赖他票）。

## 1. 状态栏默认隐藏 + 底边热区滑入滑出（A-1.1–A-1.4）

- [ ] 1.1 [change=shell-preview-refine/1.1] 状态栏默认隐藏，底边热区滑入滑出，钉住开关语义不变
  - 状态栏初始状态 SHALL 为隐藏（不占位、不渲染）；用户显式钉住后 SHALL 常显，取消钉住后 SHALL 恢复默认隐藏
  - 指针进入窗口底部 8px 热区 SHALL 使状态栏临时滑入显现；指针移出热区 SHALL 滑出隐藏
  - 隐藏态临时显现的状态栏 SHALL 以 `position: fixed` 悬浮层覆盖内容，SHALL NOT 改变正文容器高度，滑入滑出 SHALL NOT 引起正文位移
  - 沉浸态行为不受影响：沉浸态下状态栏自动隐藏、热区仍可临时唤出的既有逻辑保持不变
  - e2e：启动默认状态下状态栏可见性为隐藏；进入底边热区后可见、移出后隐藏；钉住后常显、取消钉住后隐藏；临时显现时计算 `position` = fixed 且正文高度不变
  - **真机清单（DQ-9）**：状态栏滑入滑出属布局与交互类，headless 绿单独不构成关闭——`npm run tauri dev` 手动滑入滑出底边热区 3 次，核对滑入无正文跳动、移出即隐藏、钉住常显
  - QG-3 接线：本票改 `src/App.tsx` 状态栏状态初值与底边热区判定、`src/components/StatusBar.tsx` 悬浮层挂载，无新增导出 API
  - **数据面**: 无
  - **验收锚点**: A-1.1、A-1.2、A-1.3、A-1.4

## 2. 禅模式文案 + 页签间距压缩 + 信息窗收窄 + 复制图标移位弱化（A-2.1–A-2.8）

- [ ] 2.1 [change=shell-preview-refine/2.1] 禅模式文案统一，页签间距压缩、信息窗收窄、复制图标移到文件名后并弱化
  - 禅模式入口三处文案（`title` / `aria-label` / 图标 label）SHALL 统一为「禅模式」，`title` SHALL 为「禅模式（⌘⇧F）」，`aria-keyshortcuts` 与 ⌘⇧F 快捷键行为 SHALL 不变
  - 相邻页签间距 SHALL 从 32px 压缩至 24px（容差 ±2px）
  - 页签名信息窗宽度 SHALL 取 token `--tab-info-width`，其值 SHALL 更新为 256px（视口不足按 `100vw - 16px` 钳制不变）
  - 复制路径与复制文件两个图标 SHALL 移到文件名节点之后，颜色 SHALL 使用 `--app-text-3` 弱化档
  - e2e：禅模式入口 `title` =「禅模式（⌘⇧F）」、`aria-label` =「禅模式」；相邻页签计算 `column-gap` = 24px；信息窗计算宽度 = `--tab-info-width` 当前值（256px）；文件名节点之后存在两个复制图标按钮且计算颜色 = `--app-text-3`
  - **真机清单（DQ-9）**：布局测量类，headless 绿单独不构成关闭——`npm run tauri dev` 悬停长文件名页签，核对信息窗宽度观感、复制图标位置与弱化色、禅模式入口文案
  - QG-3 接线：本票改 `src/components/StatusBar.tsx` 与 `src/ui/icons.ts` 文案、`src/components/TabBar.tsx` 页签间距、`src/components/TabInfoPopover.tsx` 复制图标位置与颜色、`src/styles/tokens.css` `--tab-info-width` 与 `docs/design/system/spec.md` §7.4 条款，无新增导出 API
  - **数据面**: 规格,存储,回滚
  - **验收锚点**: A-2.1、A-2.2、A-2.3、A-2.4、A-2.5、A-2.6、A-2.7、A-2.8

## 3. 脚本类文件整文件预览接入高亮（A-3.x）

- [ ] 3.1 [change=shell-preview-refine/3.1] 整文件预览按扩展名查 LANGUAGES 表渲染语法颜色，未知扩展名回退纯文本
  - `.js` / `.ts` / `.py` 等命中 LANGUAGES 表的扩展名，其整文件预览 SHALL 渲染语法颜色（`.tok-*` 节点数 ≥1）
  - 未命中 LANGUAGES 表的扩展名 SHALL 回退纯文本渲染，SHALL NOT 渲染语法颜色
  - 高亮渲染 SHALL 复用 `src/renderers/highlight.ts` 的 LANGUAGES 表与 `highlightCodeBlock`，SHALL NOT 新写高亮器
  - e2e：预览态打开 `.js` / `.ts` / `.py` 文件各一，`.tok-*` 节点数 ≥1；预览态打开未知扩展名文件，`.tok-*` 节点数 = 0
  - **真机清单（DQ-9）**：预览渲染属布局测量类，headless 绿单独不构成关闭——`npm run tauri dev` 打开一个 `.js` 文件核对预览态语法颜色与编辑态观感一致
  - QG-3 接线：本票改 `src/components/Content/PreviewView.tsx` 整文件预览分支，复用既有 `highlightCodeBlock` 导出，无新导出 API
  - **数据面**: 无
  - **验收锚点**: A-3.1、A-3.2、A-3.3、A-3.4

## 4. 标题字体可选择（A-4.x）

- [ ] 4.1 [change=shell-preview-refine/4.1] 本机字体枚举填充标题字体候选，选择写入 H1–H6，枚举失败降级手输
  - 新增 Rust 命令 `list_fonts`，SHALL 返回本机已安装字体族列表；命令 SHALL 在 `invoke_handler` 注册并附单测
  - 设置面板加载时 SHALL 调用 `list_fonts` 填充标题字体 `datalist` 候选，候选 SHALL 非空且来自枚举结果，SHALL NOT 是写死常量数组
  - 用户从候选中选择字体 SHALL 写入对应 H1–H6 的 `heading_fonts` 配置并持久化；枚举失败时 SHALL 降级为可手输并显示提示
  - e2e：设置面板标题字体候选节点数 ≥1；选择候选后配置持久化；mock 枚举失败时输入框可手输且提示可见
  - **真机清单（DQ-9）**：字体枚举属系统能力，headless 绿单独不构成关闭——`npm run tauri dev` 打开设置核对本机字体候选、选择后标题渲染、手动输入路径
  - QG-3 接线：本票新增 Tauri 命令并在 `invoke_handler` 注册（桥接），前端经设置面板消费（消费位置见 design.md 数据面「桥接」「消费」两行），自票接线，无跨票依赖
  - **数据面**: 校验,桥接,消费
  - **验收锚点**: A-4.1、A-4.2、A-4.3、A-4.4

## Open Questions

- 无。五项需求与方案均已由 #1134 明确；视觉数值唯一来源为 `docs/design/system/spec.md`。
