# Design: HTML 预览资源解析补齐 + 复杂 CSS 样式渲染支持

## Context

HTML 预览走 iframe srcdoc + sandbox（reading A-3），`rewriteHtmlPaths` 把相对路径重写为 `asset://localhost` 绝对 URL；当前 CSP：

```
default-src 'self' 'unsafe-inline'; img-src 'self' data: asset:; style-src 'self' 'unsafe-inline' asset:; frame-src 'self' asset:; script-src 'none'
```

复杂 CSS 渲染的现状缺口：
- `srcset` 属性（逗号分隔候选 + 描述符）未重写 → 响应式图片加载失败
- CSS `@import "path"`（无 `url()` 包裹）未重写（内联 style 中）
- `font-src`/`media-src` 未声明 → 回退 `default-src 'self'` → `@font-face` 本地字体（asset://）与 `<video>/<audio>` 被 CSP 拦截
- `iframe src` 虽被 `src=` 正则覆盖，但此前 CSP 无 `frame-src` 许可 → 内嵌资源被拦（现已补）

约束：规格为行为真相源；vitest 只收 `src/__tests__/`；Tauri mock E2E 环境无 `convertFileSrc`（重写在 mock 下静默退化为原路径，E2E 只测可测行为如样式生效）。

## Goals / Non-Goals

**Goals**
1. `srcset`（img/source）相对路径重写；CSS `@import "..."` 重写。
2. CSP 补齐 `font-src`/`media-src`/`frame-src`，本地字体、音视频、内嵌页面在预览中可加载；禁脚本性质不变。
3. 复杂 CSS 样式（flex/grid/动画/变量/calc/伪元素/媒体查询/自定义字体）在预览中正常渲染，用 E2E 断言 + 手动走查锁定。
4. 单测 + E2E 覆盖，`verify.sh` 相关步骤全绿（排除既有失败）。

**Non-Goals**
- 不做 `.css` 文件类型查看支持（用户澄清：CSS 支持 = 打开 HTML 时内嵌复杂样式正常显示）。
- 不引入外部 CSS 的 JS 改写管线（浏览器请求前 URL 规范化 + asset 协议已覆盖相对引用）。
- 不做 `.scss/.less` 预处理器支持（无编译能力）。
- 不为 HTML 预览引入 JS 执行（规格 A-3 硬性禁脚本）。

## Decisions

### D1 srcset 重写：候选拆分后逐项 resolvePath，逗号+描述符重组

**决策**：在 `rewriteHtmlPaths` 的 `(src|href|poster)="..."` 正则之外，新增 `srcset="..."` 处理：按 `,` 拆候选 → 每候选按首个空白拆 URL 与描述符（`1x`/`2x`/`100w` 等）→ URL 走现有 `resolvePath`（绝对/data:/#/asset: 跳过）→ 重组 `url 描述符` 并 `, ` 连接。抽纯函数 `rewriteSrcsetAttr(value: string, resolve: (url: string) => string): string` 导出，vitest 注入可控 resolve 直接测拆分/重组逻辑（Tauri mock 环境无 `convertFileSrc`，不能依赖真实重写结果）。

**理由**：正则不能直接套 `resolvePath`（srcset 是复合值）；纯函数化让核心逻辑脱离 Tauri 环境可测。

### D2 CSS `@import "..."`：补正则，不碰 `@import url(...)`

**决策**：在 inline `<style>` 处理中，除现有 `url(...)` 正则外，追加 `@import\s+["']([^"']+)["']` 重写。`@import url(...)` 形式已被 url() 规则覆盖，无需重复。

**外部 `<link>` CSS**：保持原样（重写为 asset URL 即可）。浏览器对引用的资源 URL 在请求前按 URL 标准折叠 `..` 等相对段（如 `asset://localhost/<dir>/css/main.css` 内的 `url(../img/bg.png)` 先规范化为 `asset://localhost/<dir>/img/bg.png` 再请求），asset 协议按规范化路径映射文件系统——相对引用天然成立，无需也不能在 JS 层改写已加载的 CSS 文件。

### D3 CSP 许可矩阵补齐，禁脚本不变

**决策**：HtmlPreview 的 CSP 调整为：

```
default-src 'self' 'unsafe-inline'; img-src 'self' data: asset:; style-src 'self' 'unsafe-inline' asset:; font-src 'self' asset: data:; media-src 'self' asset:; frame-src 'self' asset:; script-src 'none'
```

- `font-src`：`@font-face` 本地字体（asset:）与 data URI 内嵌字体放行
- `media-src`：`<video>/<audio>` 本地文件放行
- `frame-src`：内嵌 iframe 子页面放行；子文档继承宿主 CSP（CSP3），`script-src 'none'` 延续，禁脚本方向单向收窄
- 其余资源（样式/图片）既有许可不变；`default-src 'self'` 继续兜底未显式声明类目

**风险**：CSP 放行面扩大（font/media/frame）→ 均为静态资源类目，无脚本能力；iframe 子文档受宿主 CSP 与父 iframe sandbox 双重约束，风险受控。

### D4 复杂 CSS 渲染验收：渲染引擎能力 + E2E 锁定

**决策**：flex/grid/动画/变量/calc/伪元素/媒体查询等为 WebView 渲染引擎原生能力，srcdoc 内无需任何配置即可渲染；真正可能失效的是资源加载（已被 D3 解决）。验收方式：
- E2E：打开含 `<style>`（grid 布局 + 自定义字体名 + 背景色 + 变量 + 动画）的 HTML，断言 iframe 内 computed style 生效
- 手动走查（真实 Tauri）：`@font-face` 本地字体、`<video>`、外部 CSS 相对引用

## Risks / Trade-offs

- **[srcset 中 URL 含逗号/空格（罕见）]** → 拆分按"候选 = 逗号+空白"启发式；data URI（可含逗号）在拆分前整体跳过；残余畸形候选由"resolve 失败返回原值"兜底，最坏保持原样不崩。
- **[CSP 放行面扩大带来非预期加载]** → 均为静态资源（font/media/frame），无脚本执行面；禁脚本为硬约束（script-src 'none' + sandbox 无 allow-scripts）。
- **[外部 CSS `..` 折叠依赖浏览器/协议行为]** → 手动走查项验证；若个别版本行为差异，回退方案为将外部 CSS fetch 内联（connect-src 补 asset:），属后续 change。
- **[mock E2E 无法断言 asset 重写真实结果]** → 单测注入 resolve 覆盖逻辑；真实路径进手动走查清单。

## Migration Plan

1. 无数据迁移；无配置字段变化。
2. 顺序：渲染层（html.ts + HtmlPreview CSP）→ 单测 → E2E → 验证。
3. 回滚：分支级回滚即可。

## Open Questions

- 无（范围已由用户澄清锁定）。
