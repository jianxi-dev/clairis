# Tasks — table-editing-polish（MD 编辑态表格与斜杠菜单交互改进）

> 切片原则：1 task = 1 用户可见交付物。Blocked by 只记「输出即输入」的真实依赖；同文件不同区域靠 rebase 消化。
> QG-2：每条都新增/扩展 e2e；QG-5：每条附原始输出与 `state-coverage.json`（ui-surface）。
> QG-6：6 票 ≥ 6，集成 checkpoint 在 4 票完成后执行一次（合并到集成分支 → 构建 → 浏览器打开 → 记录用户能看到什么）。

## 1. 单元格手柄统一与定位

依赖：无

- [x] 1.1 单元格手柄统一图标、垂直居中、表头无手柄、圆角调小
  - 粒度：用户可见交付物
  - 实现：`table.ts` `buildCell`/`applyCellHandleState` 统一为一种表格图标（不再按空/非空切换 Add/DataSheet）；手柄改纵向居中（top:50% + translateY(-50%)）、横向贴单元格左边框线外侧；`th` 不渲染手柄；`editor.css` 手柄 `border-radius` 3px、新增/调整的 `cm-*` 类同步 manifest。
  - 验收：打开页面悬停非表头单元格，手柄显示统一图标且纵向中心与单元格中心差 ≤2px、圆角 3px；悬停表头无手柄；空单元格插入路径走 "/" 菜单（1.2/1.3 票承接）；取消悬停后无残留。
  - e2e：`e2e/table-decorations.spec.ts`（扩展：A-1.1..A-1.5）
  - 接线归属：不新增对外导出，无需接线。
  - 数据面：无

## 2. 行列插入圆点重做

依赖：无

- [x] 2.1 上/左外缘圆点 + 悬停变 + + 点击气泡插入/删除
  - 粒度：用户可见交付物
  - 实现：`table.ts` `renderBoundaries`/`wireBoundaryReveal` 重做形态——列圆点坐上边框外（相邻列中点 x，含尾列追加点）、行圆点坐左边框外（相邻行中点 y，含尾行追加点）；默认小圆点、悬停变现行"+"热点；点击展开现行插入/删除气泡；插入/删除 splice 逻辑不动；滑入显示/滑出隐藏；`editor.css` 同步。
  - 验收：打开页面滑入表格，上边框外与左边框外出现圆点且都在表格矩形之外；悬停圆点变"+"；点击列间圆点插入列（列数 +1）、点击气泡删除行（行数 -1）；滑出后圆点隐藏；取消操作后源码除目标处外逐字节不变。
  - e2e：`e2e/table-decorations.spec.ts`（扩展：A-2.1..A-2.5）
  - 接线归属：不新增对外导出，无需接线。
  - 数据面：无

## 3. 斜杠菜单内容输入上下文（核心）

依赖：无

- [x] 3.1 context 触发接口 + 单元格 "/" 全链路修复 + 定位夹取修正 + 死代码清理
  - 粒度：用户交付物
  - 实现：`slash.ts` 新增 `context` 触发形态（`{anchorRect, querySink, insertRange, focusHost}`）：打开菜单不抢焦点、过滤词由控件 input 事件驱动、选中后按 `insertRange` 写回控件文本、Esc 关闭并回滚查询文本；`applyPlacement` 夹取 bounds 统一为 `.cm-editor`∩视口；`table.ts` 单元格 "/" 改走 context 形态（"/" 保留在输入框作查询锚点，替代现行「删字符」），插入落点单元格内；删除死代码 `endOfTableBlock`/`slashMenuRequest`/`openSlashMenuAt` 并修正错误注释。
  - 验收：打开页面在单元格输入 "/"，菜单在单元格近旁（≤8px）打开、焦点保持在输入框、文档表外新增 "/" 数为 0；继续输入过滤词菜单跟随过滤；Esc 关闭后单元格无 "/" 残留；贴近视口底部打开菜单完整可见；普通正文 "/" 行为不回归（doc 触发不变）。
  - e2e：`e2e/table-decorations.spec.ts`（扩展：A-3.1..A-3.4、A-5.1、A-5.4）
  - 接线归属：`slash.ts` 导出 context 触发入口，由本票在 `table.ts` 单元格路径内接线完成。
  - 数据面：无

## 4. 分栏内容区接入

依赖：3.1（复用 context 触发接口）

- [x] 4.1 分栏内容区 "/" 菜单 + "+" 新增手柄
  - 粒度：用户可见交付物
  - 实现：`columns.ts` textarea 接入 context 触发（"/" 菜单 + 插入落点在分栏文本对应位置）；内容区左缘外侧显示"+"手柄（与单元格手柄同款形态/圆角），点击以 anchor 上下文打开同一菜单；`editor.css` 同步。
  - 验收：打开页面在分栏内容区输入 "/"，统一菜单打开且焦点在 textarea、选中后内容插入到分栏文本；悬停内容区出现 + 手柄、点击打开同一菜单；Esc 无残留、源码其余字节不变。
  - e2e：`e2e/columns-editor.spec.ts`（扩展：A-4.1、A-4.2、A-4.5）
  - 接线归属：本票在 `columns.ts` 内接线（消费 3.1 导出的 context 入口）。
  - 数据面：无

## 5. 高亮块内容区接入

依赖：3.1（复用 context 触发接口）

- [x] 5.1 高亮块内容区统一菜单 + "+" 新增手柄
  - 粒度：用户可见交付物
  - 实现：`callout.ts` 正文 textarea 接入 context 触发；`callout-insert.ts` 的 `CALLOUT_SNIPPETS` 片段改写为注册表命令并入统一菜单、独立菜单容器退役；内容区左缘外侧显示"+"手柄；`editor.css` 同步。
  - 验收：打开页面在高亮块内容区输入 "/"，统一菜单打开（独立片段菜单节点数为 0）、片段命令在列；选中后插入到内容区光标处；悬停出现 + 手柄；Esc 无残留、源码其余字节不变。
  - e2e：`e2e/callout-editor.spec.ts`（扩展：A-4.3、A-4.4、A-4.6）
  - 接线归属：本票在 `callout.ts` 内接线（消费 3.1 导出的 context 入口）。
  - 数据面：无

## 6. 上下文命令安全集

依赖：3.1（消费 context 形态）

- [x] 6.1 SlashCommand context 标注与按上下文过滤
  - 粒度：用户可见交付物
  - 实现：`slash.ts` 命令注册表增加 `context` 标注（`doc`/`cell`/`container`，缺省 `doc`）；过滤规则：cell = 行内 + 用户片段（排除块级命令）、container = 行内 + 片段 + 表格/代码块/高亮块等容器内合法块命令、doc 不变；用户片段（`snippetToCommand`）标注可入 cell/container。
  - 验收：打开页面在单元格内打开菜单，不含表格/分栏/代码围栏等块级命令；分栏/高亮块内菜单含「表格」命令；用 mock 注入片段后单元格菜单含片段且选中插入到单元格内（确定性断言）；普通正文菜单集不回归。
  - e2e：`e2e/table-decorations.spec.ts`（扩展：A-5.2、A-5.3 + 片段插入断言）
  - 接线归属：本票在 `slash.ts` 过滤逻辑内完成，无外部接线。
  - 数据面：无
