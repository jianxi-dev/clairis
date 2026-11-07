# Design: HTML 可视化编辑工具条（H3）

逆向报告是第 6 层 research，不参与裁定；E-16 的 D1–D8 仍然有效，本文件只补工具条相关的裁定。凡与报告不同的地方都写明理由。

## D1 工具条画在主文档，不画进 iframe

报告 §3.4 把工具条归到 iframe 内的交互层（175KB DM 脚本的一部分）。那个选择是为它自己的架构服务的：WorkBuddy 的 iframe 内有完整 UI 框架。

本仓库不同：`HtmlVisualEditor` 已经有宿主应用（React + 应用主题 token + 输入控件），而 iframe 里是**用户文档的上下文**——用户的 `p { text-align: center }`、`* { box-sizing }`、甚至 `input { display: none }` 都会污染画在里面的工具条。要让工具条在任意用户文档里长得一样，必须 `all: initial` 一类的对抗性重置，成本高于收益。

裁定：工具条是**主文档里的 React 组件**，用 `position: fixed` 浮在容器上。iframe 只额外上报一条几何信息（见 D2）。

## D2 定位靠 iframe 上报 rect，不靠主侧测量

主侧跨源拿不到 iframe 内部的布局（`contentDocument` 恒为 `null`）。而高亮框已经由运行时在 iframe 内画好（E-16 切片 3），它每次 `place()` 都知道精确矩形。

裁定：`place()` 顺手把矩形（相对 iframe 视口，含滚动量，直接用 `getBoundingClientRect()` 的视口坐标）以 `selectionRect` 消息上报。主侧加上 iframe 自身的 `getBoundingClientRect()` 偏移换算成视口坐标。

这条同时解决了滚动与重排：`place()` 本来就挂了 `scroll`（捕获）与 `resize`，工具条跟着框走，不需要另开一套监听。

## D3 改动仍折算回 content，不发 patch 命令回 DOM

报告 §3.4 的 `patchStyle` / `patchAttr` / `replaceTag` 是「打回 iframe DOM + 模型记 undo」。E-16 的 D2 已经裁定 content 是唯一真相、DOM 是投影，为工具条破例会重新引入「DOM 与文本两份真相」这一类 bug。

裁定：工具条操作走 `src/editors/html/edit.ts` 的三个纯函数，产出新的 `content`；iframe 因 `content` 变化重建，改动自然生效。代价是每次改动重建一次 iframe（样式/标签操作是低频动作，可接受）；收益是与改字共用同一条链路，保存前无需再做对齐。

## D4 值域收窄到档位，不收任意文本

`patchStyle` 在报告里是自由键值对。工具条如果照抄，就要接受用户输入 `background: url(javascript:...)` 这类值，还要处理 CSS 语法错误。

裁定：工具条只提供**固定档位**——
- 标签：`p / h1 / h2 / h3 / div / section / blockquote / li / span`
- 字号：固定的几档 `px` 值
- 文字颜色：`input[type=color]`（值必然是 `#rrggbb`）
- 对齐：`left / center / right`
- `class` / `id`：自由文本，但只走 `setAttribute`（序列化自动转义），不拼 HTML

这样校验边界收敛在组件里，纯函数不必做 CSS 解析。

## D5 清空即删除属性，不写空值

`class` 输成空串时，若写成 `class=""`，用户文件里会凭空多出一堆空属性。裁定：空串与 `null` 在 `applyAttrPatch` / `applyStylePatch` 里都表示「移除该属性 / 该样式项」，删干净的产物才符合 E-16 的「零残留」精神。
