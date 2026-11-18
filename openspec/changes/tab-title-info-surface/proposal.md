## Why

页签标题在 #1053 里被改成「单行完整显示、去省略号」，代价是页签条间距从 16px 拉到 32px。维护者复看后判定这不是要的形态：单个长文件名会把页签条撑宽、挤掉后面的页签，而真正需要「完整名」的场景是悬停查看、不是常驻占宽。同一处信息窗也缺两个高频动作（复制路径 / 复制文件）；页签条空白的「双击切窗口全屏」（#923）则因与窗口拖拽共用按下事件而经常失效。

此外，主规格已经与实现漂移：`application-shell` 同时保留「页签栏空白双击新建文档」与「双击切窗口全屏（SHALL NOT 新建文档）」两条互斥要求，全屏条款的 Scenario 仍断言 `isMaximized()`；「页签名 SHALL 单行完整显示」在 `application-shell` 与 `navigation` 两处各写一遍；`editing` 要求「一切自绘悬停提示 SHALL 为胶囊、SHALL NOT 出现矩形外壳」并点名页签名信息窗——这条会直接阻断本次信息窗改矩形。

## What Changes

- **页签标题回到固定宽度 + 省略号**：标题容器最大宽度 120px，单行 `nowrap`、超出以 `text-overflow: ellipsis` 收尾；短名按实际长度显示。页签条相邻间距维持 32px 不变（**行为回退，相对 #1053**，非 API 破坏）。
- **页签名信息窗改造**：外壳由胶囊改为矩形圆角 8px（复用设计系统 `--radius-8`）；**宽度固定 320px**（视口不足时按 `100vw - 16px` 钳制，保证 300px 最小窗口不溢出）；文件名允许换行显示完整名；路径行末尾新增两个图标按钮——「复制路径」写入路径文本、「复制文件」把文件本身写入系统剪贴板（非 macOS 平台不渲染该按钮，不做静默降级）。
- **空白双击全屏稳定化**：页签条空白处的双击与窗口拖拽共用按下事件；双击判定窗口内的第二次按下 SHALL NOT 启动窗口拖动，使全屏动作不再被手抖（>4px）夺走。
- **规范对齐**：`application-shell` 删除已被 supersede 的「页签栏空白双击新建文档」；全屏条款 Scenario 断言改 `isFullscreen()`；`navigation` 与 `application-shell` 的页签标题条款统一为固定宽度 + 省略号；`navigation` 的信息窗条款改为 R8 矩形 + 换行 + 复制按钮；`editing` 的「一切自绘提示 SHALL 胶囊」为页签名信息窗开设豁免（其余提示仍保持胶囊）。
- **BREAKING**：无。

## Capabilities

### New Capabilities

- 无新增能力域。

### Modified Capabilities

- `application-shell`：页签标题显示与间距（固定 120px 上限 + 省略号，间距 32px 不变）；删除互斥的「页签栏空白双击新建文档」；「页签空白双击切换窗口全屏」断言改为 `isFullscreen()` 并补双击不被拖窗夺走的约束。
- `navigation`：页签名显示条款与 `application-shell` 对齐（去重复的死条款）；页签名信息窗形态改为矩形圆角 8px、文件名换行、路径行末两个复制动作。
- `editing`：自绘悬停提示外壳规则增加「页签名信息窗」豁免（该处为矩形 8px），其余提示仍为胶囊。

## Impact

- 前端：页签条标题渲染与空白双击判定；页签名信息窗组件与外壳样式。
- 后端：新增一条 Tauri 命令把文件写入系统剪贴板（macOS `NSPasteboard` + 文件 URL；仓库已有 `cocoa` / `objc` 原生调用先例，无新增依赖）。
- 测试：`e2e/tab-selection.spec.ts` 中「无省略号 / 单行全显」断言必须改写（与新行为相反）；`e2e/tab-info-popover.spec.ts` 扩展圆角 / 换行 / 复制按钮断言；`e2e/tab-context-menu.spec.ts` 增加「双击间轻微位移仍全屏」与「超阈值不触发拖窗」对偶用例。
- 设计：`docs/design/system/decisions.md` 追加一条信息窗外壳裁决（R8 矩形）；`spec.md` 无新增刻度，复用既有 `--radius-8`。
- 数据面：本次命中「图标」信号（信息窗新增两个动作图标），`design.md` 按 `docs/agents/data-surface.md` 出六栏表。
- 无新增配置字段、无持久化结构变更、无新增第三方依赖。
