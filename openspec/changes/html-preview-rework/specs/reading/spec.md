## MODIFIED Requirements

### Requirement: A-3 HTML 预览

`.html` 文件 SHALL 以 iframe 方式在预览模式打开，iframe SHALL 通过 asset 协议加载真实本地文件（`asset://localhost/<path>`）；无文件路径时 SHALL 回退为 srcdoc 渲染。脚本 SHALL 默认允许执行（内联脚本与外部 CDN 脚本均可运行），iframe 与主窗口跨源隔离（脚本 SHALL 无法访问父页面 DOM、应用状态与 Tauri 命令）。预览内相对路径资源（图片、CSS、字体、内嵌页面，含 `..` 引用）SHALL 由 asset 协议按文件相对路径加载。目录锚点链接（`#id`）SHALL 在 iframe 内正常导航不崩溃。复杂 CSS（布局、动画、变量、`@font-face`、媒体查询、Tailwind 等运行时生成样式）SHALL 正常渲染。

#### Scenario: HTML 文件 iframe 预览

- **WHEN** 用户打开一个 `.html` 文件
- **THEN** 内容 SHALL 通过 iframe（asset:// 直载）渲染

#### Scenario: 脚本默认允许

- **WHEN** 预览的 HTML 含内联脚本或外部 CDN 脚本（如 Tailwind Play CDN、内联 CSS 变量注入）
- **THEN** 脚本 SHALL 执行，依赖脚本的样式/组件（callout、调色板、Tailwind class）SHALL 正常显示

#### Scenario: 脚本跨源隔离

- **WHEN** 预览 HTML 的脚本尝试访问父窗口
- **THEN** 跨源限制 SHALL 阻止访问（脚本无法读取父页面 DOM、状态或调用 Tauri 命令）

#### Scenario: 相对资源加载

- **WHEN** 预览 HTML 引用同目录或上级目录（`..`）的图片、CSS、字体
- **THEN** 资源 SHALL 按相对路径经 asset 协议加载成功

#### Scenario: 目录锚点导航

- **WHEN** 用户点击预览内目录链接（`<a href="#id">`）
- **THEN** iframe SHALL 滚动到对应锚点，不崩溃不白屏

#### Scenario: 复杂 CSS 渲染

- **WHEN** 预览 HTML 含复杂 CSS（布局/动画/变量/`@font-face`/媒体查询/运行时生成样式）
- **THEN** 样式 SHALL 完整呈现

### Requirement: A-6 全局字号缩放（部分）

预览阅读宽度 SHALL 默认为 880px（`min(880px, 可用宽度 - 48px)`），标题 SHALL 应用用户配置的标题配色（`headingColors`，经 CSS 变量注入，明暗主题均生效）。

#### Scenario: 阅读宽度

- **WHEN** 用户打开 markdown 预览
- **THEN** 正文容器 SHALL 以 880px 为上限居中显示，窗口窄于 928px 时自适应留 24px 边距

#### Scenario: 标题配色

- **WHEN** 预览渲染 markdown 标题
- **THEN** h1-h6 SHALL 应用 `headingColors` 配置的颜色
