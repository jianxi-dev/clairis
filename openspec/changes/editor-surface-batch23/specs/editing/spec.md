## MODIFIED Requirements

### Requirement: E-24 图片块编辑

MD 编辑态的图片 SHALL 在被点击后进入选中态：显示选中框与四角圆点，并在图片上方居中显示工具条，按钮顺序 SHALL 为「AI / 裁剪 / 评论 ｜ 左对齐 / 居中对齐 / 右对齐 ｜ 剪切 / 复制 / 删除」（已裁剪图片在此基础上出现「重置图片」）。图片 SHALL 以圆角呈现，圆角取设计系统卡片级数值。双击图片 SHALL 进入最大化查看，Esc、再次双击或点击遮罩 SHALL 退出且不改动文档。

**放大层工具条（quiet 对齐）**：最大化查看层 SHALL 提供自定义 tooltip——指针悬停任一按钮 SHALL 在按钮上方显示深灰气泡文字提示，SHALL NOT 依赖浏览器原生 `title`（WKWebView 不渲染）；tooltip 出现延迟 SHALL ≤ 300ms。放大层 SHALL 提供「缩小」「放大」两个按钮，每次点击 SHALL 以固定步进调整缩放（不超出 0.5–8 倍范围），并在工具条上显示当前缩放百分比。放大层在文档含多张图片时 SHALL 提供「上一张」「下一张」切换：点击 SHALL 按文档顺序切换到相邻图片并保留当前缩放状态重置为该图默认显示；工具条 SHALL 显示「当前序号/总数」索引；键盘左右方向键 SHALL 等效点击上一张/下一张；到边界时对应按钮 SHALL 禁用。

#### Scenario: 放大层 tooltip 悬停提示

- **WHEN** 用户双击图片进入放大层，指针悬停「下载」按钮 300ms 内
- **THEN** 按钮上方 SHALL 出现深灰气泡提示「下载原图」，指针移开 SHALL 消失

#### Scenario: 放大层 ± 缩放与百分比

- **WHEN** 用户进入放大层后点击「放大」两次
- **THEN** 图片 SHALL 逐步放大且工具条百分比 SHALL 同步增大；点击「缩小」SHALL 反向调整

#### Scenario: 放大层多图切换

- **WHEN** 文档含 3 张图片，用户双击第 1 张进入放大层后点击「下一张」
- **THEN** 显示 SHALL 切到第 2 张，索引 SHALL 显示「2/3」；按左方向键 SHALL 回到第 1 张；在第 1 张时「上一张」SHALL 禁用

### Requirement: E-44 图片裁剪坐标系与保存可靠性

进入图片裁剪前 SHALL 等待图片加载完成（`img.complete` 或 load 事件），2s 超时 SHALL 放弃并提示，SHALL NOT 在 `scale <= 0` 时静默失败。框选、拖动与写回 SHALL 使用同一显示坐标系。编辑态已裁剪图片 SHALL 统一用「外盒 `overflow:hidden`（尺寸 = 可见裁剪显示尺寸）+ 内图按整图缩放平移」结构渲染；`width` 属性 SHALL 表示可见裁剪宽度，`scale` SHALL 等于 `width / cropWidth`；无 `width` 时 `scale` SHALL 由整图当前显示宽度与自然宽度之比求得。保存 SHALL 把显示矩形换算为原图像素矩形一次，并 SHALL 同步写回可见 `width/height`（取整），使确认前后显示宽高比严格为 1。保存 SHALL 同时由显式保存按钮与 window 级 `pointerup` 触发，SHALL NOT 依赖裁剪框存活；Esc SHALL 取消且不写回。

**裁剪态交互（quiet 式）**：进入裁剪态 SHALL 显示**整图**（非框内预览），框外区域 SHALL 覆盖压暗蒙层（`rgba(0,0,0,0.3)` 四块暗罩）；裁剪框 SHALL 为 1px 白色虚线框，含 8 个 24px 热区控制点与 2 个移动热区。拖动控制点或裁剪框本体 SHALL 改选区，蒙层 SHALL 随选区实时更新。点击「确定」SHALL 才写回 `crop` 与 `width/height`；SHALL NOT 在拖动过程中写回。**二次进入裁剪** SHALL 显示整图 + 上次裁剪矩形（框内亮、框外蒙层），SHALL NOT 只显示框内预览。

**清理可靠性**：裁剪会话结束时（确认、取消、Esc 或文档变更致重建）裁剪框、角标、边柄短条与蒙层 SHALL 全部同步移除（SHALL NOT 依赖 rAF 推迟），连续多次裁剪后页面 SHALL NOT 残留任何裁剪标识元素。图片已加载完成时点击「裁剪」SHALL 必现裁剪标识线；图片未加载完成 SHALL 显示加载提示而非无声无息。

#### Scenario: 裁剪缩放不跳变

- **WHEN** 用户打开裁剪、拖动裁剪框后保存
- **THEN** 保存前后图片显示宽度的比值 SHALL 严格等于 1，裁剪框矩形与 `crop` 值 SHALL 一一对应

#### Scenario: 确认前后显示一致

- **WHEN** 用户拖动裁剪框后点「确定」
- **THEN** 确认后 `img` 的可见宽高 SHALL 等于确认前裁剪盒的显示宽高（比值 1 ±0.02），显示内容区域 SHALL 与拖拽预览一致；`object-fit` SHALL 为 `none`，内图 SHALL 以 `scale` 缩放并以 `-left*scale / -top*scale` 平移

#### Scenario: 拖回整图移除 crop

- **WHEN** 用户把裁剪框拖回整图范围后确认
- **THEN** 源码 `crop` 属性 SHALL 被移除，图片显示 SHALL 恢复为裁剪前尺寸

#### Scenario: 保存不随裁剪框销毁丢失

- **WHEN** 用户在裁剪过程中触发一次装饰重建（裁剪框被销毁）后再松手
- **THEN** 裁剪结果 SHALL 仍被写回，源码 `crop` 属性 SHALL 等于最终显示矩形换算值；若最终取消则 SHALL NOT 残留裁剪框

#### Scenario: 裁剪态显示整图与蒙层

- **WHEN** 用户进入裁剪态
- **THEN** 页面 SHALL 显示整图（非框内预览），框外区域 SHALL 有压暗蒙层，裁剪框为 1px 白色虚线框；拖动控制点期间 SHALL NOT 写回源码

#### Scenario: 二次进入显示上次矩形

- **WHEN** 用户对同一张图片再次进入裁剪态
- **THEN** 页面 SHALL 显示整图 + 上次裁剪矩形（框内亮、框外蒙层），矩形位置 SHALL 与上次保存的 `crop` 一致

#### Scenario: 多轮裁剪零残留

- **WHEN** 用户对同一文档的图片连续进行 5 次裁剪（每次确认）后检查页面
- **THEN** 页面 SHALL NOT 存在任何裁剪框、角标、边柄短条或蒙层 DOM 节点（计数为 0）

#### Scenario: 已加载图片标识线必现

- **WHEN** 用户点击一张已加载完成图片工具条的「裁剪」按钮
- **THEN** 裁剪标识线（框与角标）SHALL 立即出现；图片未加载完成时 SHALL 显示加载提示，SHALL NOT 无任何反馈

## ADDED Requirements

### Requirement: 图片选中工具条滚动期行为（方案A）

选中图片后工具条 SHALL 锚定该图片；页面滚动期间工具条 SHALL 隐藏（滚动判定含编辑器滚动容器滚动），停止滚动约 50ms 内 SHALL 以图片当前位置一次定位并重新显示；滚动期间 SHALL NOT 逐帧重算位置。滚出视口判定 SHALL 采用 IntersectionObserver，SHALL NOT 依赖逐帧 scroll 事件读取布局。scroll 监听 SHALL 标记 passive 并只挂在编辑器滚动容器上，SHALL NOT 挂 document 捕获。

#### Scenario: 滚动期隐藏停滚复位

- **WHEN** 用户选中一张图片后用滚轮连续滚动页面
- **THEN** 滚动进行中工具条 SHALL 隐藏；停止滚动约 50ms 后工具条 SHALL 在图片当前位置重新显示，与图片相对位置 SHALL 与选中时一致

#### Scenario: 滚动过程无逐帧抖动

- **WHEN** 用户在选中图片状态下连续滚动 2 秒并观察工具条
- **THEN** 滚动期间工具条 SHALL NOT 反复出现/消失/跳动（隐藏为单一状态）
