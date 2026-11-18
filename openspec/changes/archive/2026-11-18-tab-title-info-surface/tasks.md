# 任务 — tab-title-info-surface

> 切片原则（QG-7）：每张票做完用户能在界面上看到变化；1 任务 = 1 票 = 1 PR。
> **Blocked by 语义**：硬边，未解除不得开工。本 change 三票都改页签条表面，前两票共享 `TabBar.tsx` / `TabInfoPopover.tsx`，故串行起头、随后并行。

## 依赖与阻塞总览

- 1.1 无阻塞。
- 2.1 Blocked by 1.1（同改信息窗组件与其样式，先落形态再接动作，避免同文件冲突）。
- 3.1 Blocked by 1.1（同改 `TabBar.tsx`：1.1 改标题渲染，3.1 改空白按下判定）。
- 2.1 与 3.1 文件不重叠，可并行。

## 1. 页签标题固定宽度 + 信息窗形态（A-1.x / A-2.x）

- [x] 1.1 [change=tab-title-info-surface/1.1] 页签标题固定 120px + 省略号；信息窗改 8px 圆角矩形并让文件名换行
  - 页签标题容器 SHALL 有固定最大显示宽度 120px；短于该宽度按实际长度显示，超过以省略号收尾，单行不换行
  - 页签条相邻间距 SHALL 保持 32px，本次 SHALL NOT 改动
  - 页签名信息窗外壳 SHALL 为 8px 圆角矩形，宽度 SHALL 固定 320px（视口不足时按 `100vw - 16px` 钳制）；文件名 SHALL 换行显示完整名，SHALL NOT 溢出信息窗
  - e2e：超长标题计算 `max-width` = 120px、`text-overflow` = ellipsis、`white-space` = nowrap；短标题容器宽度等于文本宽度；`column-gap` = 32px；信息窗计算 `border-radius` = 8px、计算宽度 = 320px、文件名行 `white-space` ≠ nowrap、`scrollWidth ≤ clientWidth`
  - **真机清单（DQ-9）**：布局测量类，headless 绿单独不构成关闭——`npm run tauri dev` 打开长短文件名各一，核对标题截断位置与信息窗换行观感
  - QG-3 接线：本票改页签条标题渲染与信息窗组件/样式，无新导出 API
  - **数据面**: 规格,存储,回滚
  - **验收锚点**: A-1.1、A-1.2、A-1.3、A-1.4、A-2.1、A-2.2、A-2.3、A-2.4

## 2. 信息窗复制路径 / 复制文件（A-3.x）

- [x] 2.1 [change=tab-title-info-surface/2.1] 路径行末尾加两个复制动作，复制文件走系统剪贴板
  - 路径行末尾 SHALL 存在「复制路径」「复制文件」两个图标按钮
  - 点击「复制路径」SHALL 把该页签文件的绝对路径写入剪贴板
  - 点击「复制文件」SHALL 把文件本身写入系统剪贴板（macOS 访达可粘贴出文件）；路径不存在时 SHALL 报错且 SHALL NOT 写入剪贴板
  - 非 macOS 平台 SHALL NOT 渲染「复制文件」按钮
  - e2e：两个复制按钮节点数 = 2；点击「复制路径」后剪贴板文本等于路径；点击「复制文件」触发对应命令调用；非 macOS 分支以 mock 平台判定隐藏按钮
  - **真机清单（DQ-9）**：系统剪贴板原生能力，headless 绿单独不构成关闭——`npm run tauri dev` 点「复制文件」后到访达按 ⌘V，确认落出该文件
  - QG-3 接线：本票新增 Tauri 命令并在 `invoke_handler` 注册，前端桥接层统一出口，由信息窗按钮消费（接线位置见 design.md 数据面「桥接」「消费」两行）
  - **数据面**: 校验,桥接,消费
  - **验收锚点**: A-3.1、A-3.2、A-3.3

## 3. 空白双击全屏稳定化 + 规范收口（A-4.x）

- [x] 3.1 [change=tab-title-info-surface/3.1] 双击与窗口拖拽互斥，全屏不再被手抖夺走
  - 页签条空白的双击判定窗口内，第二记按下 SHALL NOT 启动窗口拖动
  - 位移超过 4px 时 SHALL 仍按现有拖拽语义拖窗，且 SHALL NOT 切换全屏
  - 主规格 SHALL 只保留一条「双击页签空白」定义：删除「页签栏空白双击新建文档」，全屏条款断言改为 `isFullscreen()`
  - e2e：双击（两记位移 ≤4px）后全屏切换一次且 `startDragging` 调用数 = 0；位移 >4px 后松开不切换全屏；主规格 grep「页签栏空白双击新建文档」条数 = 0、全屏条款内 `isMaximized()` 条数 = 0
  - **真机清单（DQ-9）**：交互类，headless 绿单独不构成关闭——`npm run tauri dev` 连续双击空白进出全屏 5 次，确认无误吞
  - QG-3 接线：本票改页签条空白按下判定与规格文本，无新导出 API
  - **数据面**: 无
  - **验收锚点**: A-4.1、A-4.2、A-4.3、A-4.4、A-4.5

## Open Questions

- 无。三项用户裁决已在提议阶段落定（复制文件 = 文件本身；超长标题 = 省略号；宽度 = 120px 且间距不动）。
