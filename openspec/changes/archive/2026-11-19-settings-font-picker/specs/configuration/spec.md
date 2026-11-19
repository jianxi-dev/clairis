## MODIFIED Requirements

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
