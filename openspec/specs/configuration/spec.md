# configuration Specification

## Purpose
TBD - created by archiving change text-config-layer. Update Purpose after archive.
## Requirements
### Requirement: CF-1 配置三层与合并

配置 SHALL 分为三层：`defaults/settings.json`（只读默认）、`user/settings.json`（用户与 AI 可写）、`state/state.json`（派生状态）。应用加载的**有效配置** SHALL 为 defaults 与 user 的深合并（user 同名键覆盖 defaults），`recentFiles` 与 `scrollPositions` SHALL 只来自 state 层。对外暴露的 `AppConfig` JSON 结构 SHALL 保持不变。

#### Scenario: user 覆盖 defaults

- **WHEN** defaults 的 `theme` 为 `light`，user 的 `theme` 为 `dark`
- **THEN** 有效配置的 `theme` SHALL 为 `dark`

#### Scenario: 派生状态不写进 user 层

- **WHEN** 应用保存一次配置
- **THEN** `user/settings.json` SHALL NOT 含 `recentFiles` 或 `scrollPositions`

### Requirement: CF-2 原子写与失败不变

保存配置 SHALL 先写同目录临时文件再原子 rename 到目标路径。任何一步失败 SHALL 保留写入前的原文件，不得留下截断或半截 JSON。

#### Scenario: 写入失败保留旧文件

- **WHEN** 原子写在中途失败
- **THEN** `user/settings.json` 的内容 SHALL 与写入前逐字节一致

### Requirement: CF-3 快照与回滚

每次成功写入 user 配置前，应用 SHALL 先把当前 `user/settings.json` 复制进 `snapshots/`；快照 SHALL 只保留最近 10 份。应用 SHALL 提供列出快照与恢复快照的能力，恢复前 SHALL 先为当前状态创建一份快照。

#### Scenario: 保留十份

- **WHEN** 连续保存 12 次
- **THEN** `snapshots/` 下的快照 SHALL 恰好为 10 份，且为最新的 10 份

#### Scenario: 恢复前先快照

- **WHEN** 用户恢复到某个历史快照
- **THEN** 恢复前的当前内容 SHALL 作为一份新快照存在，可再次恢复

### Requirement: CF-4 校验失败拒绝写入

保存配置前 SHALL 校验：字号 8–96、阅读宽度 480–2400、侧栏宽度 0–800、分栏比例 0–1、主题属于 `light|dark|warm|system`、皮肤属于 `paper|plain`。任一非法 SHALL 返回校验错误且不写盘。

#### Scenario: 非法字号不落盘

- **WHEN** 提交 `fontSize = 200`
- **THEN** 保存 SHALL 返回校验错误，`user/settings.json` SHALL 保持原内容

### Requirement: CF-5 外部改动热应用

`user/settings.json` 被外部进程修改后，应用 SHALL 在 1 秒内向前端发出一次配置变更事件；前端 SHALL 据此重载配置且不打断当前编辑。

#### Scenario: 外部改主题

- **WHEN** 应用运行中有人把 user 配置的 `theme` 改成 `dark`
- **THEN** 前端 SHALL 在 1 秒内收到 `config-changed` 并对新配置生效

### Requirement: CF-6 阅读设置归属与设置窗自适应

字号、行宽、配色 SHALL 仅在设置场景提供入口，SHALL NOT 在正文右上角常驻浮层。设置场景 SHALL 在窄窗口内可纵向滚动且不越出视口；阅读空间的布局/密度/卡片高度 SHALL 保留在设置中。「沉浸」SHALL 作为阅读模式的唯一用户可见名称。

设置中 SHALL 提供「左边栏固定隐藏」开关，写入 `rail_pin_hidden` 并即时生效；标题逐级字体（H1–H6）的选择入口 SHALL 位于设置场景内。

#### Scenario: 正文无设置浮层
- **WHEN** 用户打开 Markdown 阅读态
- **THEN** 正文右上角 SHALL NOT 显示字号/行宽/配色浮层

#### Scenario: 设置窗自适应
- **WHEN** 应用窗口高度小于设置内容高度
- **THEN** 设置内容区 SHALL 可滚动，底部内容 SHALL 可到达且不越出窗口

#### Scenario: 沉浸命名
- **WHEN** 用户查看顶栏阅读入口
- **THEN** 按钮文案 SHALL 为「沉浸」

#### Scenario: 左边栏固定隐藏开关
- **WHEN** 用户在设置中切换「左边栏固定隐藏」开关
- **THEN** 配置 `rail_pin_hidden` SHALL 写入并持久化，左边栏行为 SHALL 即时变化

#### Scenario: 标题字体设置入口
- **WHEN** 用户打开设置场景
- **THEN** SHALL 存在 H1–H6 逐级字体选择入口

### Requirement: 提示信息显示时长可配置

系统 SHALL 允许配置提示信息的显示时长，单位为秒，取值 0.1–10，允许 1 位小数；配置 SHALL 持久化并在重启后生效；非法值 SHALL 被拒绝并回落到默认值。该配置 SHALL 同时约束悬停提示的显示时机：悬停提示 SHALL 在配置时长到达时出现，未配置时 SHALL 回退 0.4 秒，实际延迟 SHALL 钳制在 100–10000ms。

#### Scenario: 配置并观察提示时长

- **WHEN** 用户在设置中把提示时长改为 1.5 秒并触发一次提示
- **THEN** 配置持久值为 1.5；提示在 1.4–1.7 秒之间消失；取消设置后恢复默认（A-4.1–A-4.2）

#### Scenario: 悬停提示按时长出现

- **WHEN** 用户把提示时长配置为 1.0 秒后悬停触发提示
- **THEN** 1100ms 处 `.app-tip` 节点数 SHALL 为 1；移出指针后为 0；未配置时 400ms 处 `.app-tip` 节点数 SHALL 为 1

### Requirement: 轮盘开关与形态配置

系统 SHALL 提供轮盘开关快捷键与默认形态（圆心 / 整个轮盘）配置；快捷键 SHALL 可开启与关闭，关闭时该快捷键 SHALL NOT 触发轮盘；双击圆心 SHALL 在两种形态间切换并写回配置；轮盘位置 SHALL 可通过鼠标中键拖动并持久化。

#### Scenario: 快捷键与形态
- **WHEN** 用户按配置的开关快捷键，或双击轮盘圆心
- **THEN** 轮盘出现（节点数 1）；默认形态为圆心时只显示圆心；双击后切换为整盘；拖动后位置在重载后保持（A-2.2–A-2.5）

### Requirement: 标题字体逐级配置

系统 SHALL 支持为每一级标题（H1–H6）配置字体，字体从本机已安装字体中选择。配置字段为 `heading_fonts`（按级别键控），SHALL 持久化并在重启后生效。**配置值来源 SHALL 区分「显式配置」与「默认栈」**：某级未被显式配置（含历史遗留的默认栈值）时，设置面板该级输入框 SHALL 显示「默认」占位（placeholder），SHALL NOT 显示整串字体栈；清空输入并提交 SHALL 取消该级显式配置并回落默认；仅当该级被显式设置过才显示字体名。未配置时 SHALL 回落到 md-bundle 预览态字体（`--type-font-sans`）。非法字体值 SHALL 被拒绝并回落到默认值。该配置 SHALL 同时作用于编辑态与预览态的标题面，SHALL NOT 改变正文与代码字体。**候选列表 SHALL 为自绘受控列表**，SHALL NOT 使用浏览器原生 `<datalist>`；候选列表 SHALL 跟随主题 token 渲染，SHALL 支持指针选择、键盘导航（↑/↓ 移动、Enter 选择、Esc 关闭）与点击外部关闭。候选名 SHALL 显示本机字体族的**本地化中文名**（经 `NSFontManager.localizedName(forFamily:face:)` 获取，跟随系统首选语言），排序 SHALL 中文优先（本地化名为 CJK 的字体族排在非 CJK 之前，组内按本地化名排序）。**显示名与存储名 SHALL 分离**：候选与输入框显示本地化名，写盘值为原始字体族名。设置面板 SHALL 在加载时通过原生命令枚举本机已安装字体族并填充候选列表；枚举失败时 SHALL 降级为可手输并给出提示。

#### Scenario: 逐级配置持久化

- **WHEN** 用户为 H1 选择字体 A 并保存设置
- **THEN** 配置 `heading_fonts` SHALL 含 H1 键且值为字体 A 的原始族名，重启后仍生效；输入框显示 A 的本地化名

#### Scenario: 默认回落

> 场景标题沿用旧名以保持条款可追溯；自本 change 起「未配置」包含历史遗留的默认栈值，显示层以「默认」占位表达。

- **WHEN** 用户未配置任何标题字体，或历史配置值等于默认栈
- **THEN** 输入框 SHALL 显示「默认」占位而非整串字体栈；H1–H6 计算 `font-family` SHALL 等于 `--type-font-sans`

#### Scenario: 非法值拒绝

- **WHEN** 配置写入一个系统不可用 / 为空的字体值
- **THEN** 该校验 SHALL 拒绝并回落到默认值

#### Scenario: 本机字体候选列表

> 场景标题沿用旧名以保持条款可追溯；自本 change 起候选列表为自绘受控列表，不再使用浏览器原生 `<datalist>`。

- **WHEN** 用户打开设置场景并加载标题字体设置
- **THEN** 自绘候选列表 SHALL 非空，其内容 SHALL 来自原生枚举命令返回的本机已安装字体族（含本地化名为 CJK 的族），SHALL NOT 是写死的常量数组，SHALL NOT 是浏览器原生 `<datalist>` 弹层

#### Scenario: 枚举失败降级手输

- **WHEN** 原生字体枚举命令返回失败或空数组
- **THEN** 设置面板 SHALL 降级为可手输，SHALL 显示枚举失败提示，手输合法字体值 SHALL 仍可保存并生效

#### Scenario: 默认占位显示

- **WHEN** 某级标题字体从未被显式配置（含历史遗留的默认栈值）
- **THEN** 该级输入框 SHALL 显示「默认」占位，SHALL NOT 显示整串默认字体栈

#### Scenario: 清空回落默认

- **WHEN** 用户清空某级输入框并提交（失焦或回车）
- **THEN** 该级显式配置 SHALL 被取消（写盘值为空 / 缺键），输入框回到「默认」占位，标题渲染 SHALL 回落 `--type-font-sans`

#### Scenario: 值来源区分

- **WHEN** 某级被显式设置为字体 A，另一级从未配置
- **THEN** 被设置的级输入框显示 A 的本地化名，未配置的级显示「默认」占位；两级写盘值 SHALL 可区分（前者为 A 的原始族名，后者为空）

#### Scenario: 自绘候选列表主题与键盘导航

- **WHEN** 用户聚焦某级输入框打开候选列表
- **THEN** 列表面板 SHALL 跟随当前主题 token 渲染（亮 / 暗 / 暖三主题均可读）；↑/↓ SHALL 移动高亮项、Enter SHALL 选中高亮项、Esc SHALL 关闭；点击面板外部 SHALL 关闭；选中后输入框显示该字体本地化名并写盘原始族名

#### Scenario: 候选名本地化与中文优先排序

- **WHEN** 用户在中文系统下打开候选列表
- **THEN** 有本地化名的字体族 SHALL 显示中文本地化名（如「苹方-简」「宋体-简」）；本地化名为 CJK 的字体族 SHALL 排在非 CJK 字体族之前，组内按本地化名排序

