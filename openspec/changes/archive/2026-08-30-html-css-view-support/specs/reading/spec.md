## MODIFIED Requirements

### Requirement: A-3 HTML 预览

`.html` 文件 SHALL 以 iframe srcdoc + sandbox 方式在预览模式打开，渲染用户 HTML 内容；脚本执行 SHALL 被禁止。预览内相对路径的本地资源 SHALL 正确加载：`img`/`source` 的 `src` 与 `srcset`、`link` 的 `href`、内联 `<style>` 内 `url(...)` 与 `@import "..."` 的相对路径 SHALL 经 asset 协议解析；`iframe` 内嵌同目录 HTML SHALL 允许加载（CSP `frame-src` 放行 `asset:`），内嵌子文档 SHALL 延续禁脚本约束。复杂 CSS 样式 SHALL 在预览中正常渲染：布局能力（flex/grid）、动画、CSS 变量、`calc`、伪元素、媒体查询 SHALL 生效；`@font-face` 声明的本地字体（asset:）与 data URI 字体、`<video>`/`<audio>` 本地媒体 SHALL 不受 CSP 拦截（`font-src`/`media-src` 放行）。

#### Scenario: HTML 文件沙箱预览

- **WHEN** 用户打开一个 `.html` 文件
- **THEN** 内容 SHALL 通过 iframe（srcdoc + sandbox）渲染，页面内的 script SHALL 不执行

#### Scenario: 相对资源加载

- **WHEN** 用户打开一个引用同目录图片、样式表与子页面的 `.html` 文件（含 `srcset`/`picture` 响应式图片与内嵌 `iframe`）
- **THEN** 上述资源 SHALL 在预览中加载成功：图片可见、样式生效、子页面可显示

#### Scenario: 复杂 CSS 样式渲染

- **WHEN** 用户打开一个包含复杂 CSS 的 `.html` 文件（grid/flex 布局、动画、CSS 变量、`calc`、伪元素、媒体查询、`@font-face`）
- **THEN** 上述样式 SHALL 在预览中完整呈现：布局生效、动画运行、变量与计算值正确、本地字体名称生效

#### Scenario: 本地媒体不受拦截

- **WHEN** 预览中的 HTML 引用同目录音视频文件（`<video>`/`<audio>`）或 `@font-face` 本地字体
- **THEN** 媒体与字体 SHALL 正常加载播放/应用，不被 CSP 拦截

#### Scenario: 内嵌页面延续禁脚本

- **WHEN** 预览中的内嵌 iframe 指向一个包含 `<script>` 的子页面
- **THEN** 该脚本 SHALL 不执行（子文档延续宿主 CSP 的 `script-src 'none'`）
