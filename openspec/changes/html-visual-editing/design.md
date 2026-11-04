# Design: HTML 可视化编辑（H2）

逆向报告是**第 6 层 research**，不参与裁定；以下 D1–D7 才是本 change 的裁定依据。凡与报告不同的地方都写明理由。

## D1 编辑态与预览态是两条渲染通道，不是同一条加开关

报告 §3.7 的做法是 `editing=false` 时纯 srcdoc、`true` 时才注入运行时。E-15 刚把预览锁成 `script-src 'none'`（防半成品脚本干扰），而可视化编辑**必须**执行注入的运行时——两者不能共用一套 CSP。

裁定：`HtmlPreview`（预览，禁脚本）与新的 `HtmlVisualEditor`（编辑，只允许注入运行时）是两个组件，各自组装 CSP，互不降级。切模式时**卸载一个、挂载另一个**，不试图让同一个 iframe 在两种安全姿态间漂移。

## D2 唯一真相是 content 字符串，模型是缓存

报告 §3.3 的 janusData 是「HTML → 节点模型 → 编辑事件 mutation 模型 → patch 回 iframe」。三处状态（模型、iframe DOM、主侧文本）互为副本，同步 bug 是这类编辑器的经典死法。

裁定：
- **主侧 `content` 是唯一真相**（与现有 tab 模型一致，撤销/保存/对比都只认它）。
- 节点模型是 `content` 的**派生缓存**，带 `sourceHash`；一旦 `content` 变化且哈希不匹配，模型与 iframe 一起重建，不做增量对齐。
- iframe DOM 是渲染产物，**不反向驱动模型**：编辑事件只上报「哪个节点上的什么动作」，主侧改 `content`，再让 iframe 重新渲染受影响的那一处（或在编辑期先本地改 DOM、提交时以主侧为准）。

这条比报告更保守：报告让模型当真相、DOM 当投影；这里让文本当真相，牺牲一点局部性能换掉整类同步 bug。

## D3 锚点格式：属性 + 注释双轨，但 id 只在内存里稳定

报告用 22 位 id + `data-page-node-id` + `<!--pnid:xxx-->` 双保险。双轨本身合理（元素能带属性、纯文本不能），照抄。

但 id 的**生命周期**改成内存内：`data-cm-node-id` 只在编辑期存在，**不写回文件**。理由见 D5。

id 生成：DOM 路径哈希 + 序号（`h1:0`、`p:2` 这类），对同一份 content 稳定可复现——这样重建模型后锚点仍能对上，不依赖持久化 id。

## D4 桥协议：命令窄、事件宽，全部带 `nodeId`

照报告 §3.2 的形态，但收敛到最小可用集：

主侧 → iframe：`render(nodeIds?)`、`focus(nodeId)`、`snapshot`。
iframe → 主侧：`selection`、`hover`、`textEditBegin`、`textEditInput`、`textEditEnd`、`splitBlock`。

每条消息带 `{ v: 1, nodeId }`。`v` 版本位是必须的——iframe 里跑的是**用户文件所在文档的上下文**，将来 UI 一升级，旧 srcdoc 里的运行时就会和主侧对不上；没有版本位就只能靠猜。

## D5 不做 pnid 回写：静默改写用户文件不可接受

报告 §3.6 的 pnid 回写（首次打开若缺 id 就把带 id 的版本写回原文件）是**性能优化换数据安全**：用户只是打开一个文件看看，结果文件被改了、mtime 变了、Git 工作区脏了。在 Git 管理的笔记库里这尤其刺眼，而且与我们「保存写回字节不变」这条 E-15 验收直接冲突。

裁定：**不写回**。锚点靠 D3 的可复现 id 每次重建，代价是每次打开多一次解析（Worker 里，可接受）。若将来真的需要跨会话稳定 id，应当作为单独的、用户可见且可撤销的动作提出，而不是打开文件的副作用。

## D6 保存走全量快照 + 清洗，清洗是纯函数且必须可测

报告 §3.5 的 `serializeDocumentForSave()` 照抄思路：从 iframe 取 `document.documentElement.outerHTML`，去掉：

- `data-cm-node-id` / `data-cm-internal` 属性与元素
- `<!--cmid:xxx-->` 注释锚点
- 编辑期注入的 `contenteditable`、outline 内联样式
- 注入的 `<style>`/`<script>` 运行时

清洗写成**纯函数**（`src/editors/html/model.ts` 的 `cleanSnapshot`）

### D6 增补：编辑会拍平行内标记（已观察，接受）

`applyTextEdit` 用整段文本覆盖被编辑块（`el.innerHTML = escapeText(text)`），所以块内的 `<strong>`/`<span>`/链接/`<br>` 在第一次提交时会被拍平——这是「以文本为真相」的直接代价，不是 bug。同理：`li` 内含嵌套 `<ul>` 时子列表会被毁，doctype 会被归一化成 `<!DOCTYPE html>`，用户自写的 `data-cm-*`/`spellcheck`/`cmid:` 注释会被清洗掉（后者与 E-16「保存零残留」一致）。

如果要保住行内结构，正确做法是**只同步最小文本 diff**（记录 caret 所在的文本节点而非整块），而不是在整块覆盖上加补丁。留到有真实需求时按那个方向做。

清洗写成**纯函数** `cleanSnapshot(html) → html`，独立单测：喂「被编辑污染的 DOM 串」，断言产物里**一个 `cm-` 前缀都不剩**。这条是整个特性最容易出脏数据的口子，必须有测试兜。

## D7 源码模式与可视化模式共享 content，两者不 remount 对方

仓库硬约束「模式切换不 remount」约束的是 **CM6 的 `EditorView`**（`editorRef.ts` 的模块级 Map）。可视化编辑器不是 CM6 面板，切换时它本来就会挂载/卸载。

裁定：
- `.html` 的「编辑」= 可视化编辑器，「源码」= CM6（`html()`）；
- 两者读写的都是同一个 tab 的 `content`；
- 从可视化切到源码时，CM6 的 `EditorView` **保持存活**（沿用 `display` 方案），只是被 `display:none` 藏起来——这样源码侧的 undo 栈和选区不丢；
- 从源码切到可视化时，取当前 `content` 重建模型。

## D8 切片顺序（每条都要能独立验收）

1. **模型 + 锚点 + 清洗**（纯函数层，无 UI）：`parseHtml → nodes`、`annotate(nodes) → html`、`cleanSnapshot(html)`，全单测。
2. **编辑态 iframe 渲染**：注入运行时，内容与预览一致，CSP 分离，无交互。
3. **点选与高亮**：hover/selection 事件上报，高亮框渲染（新增 `cm-*` 类**必须同时加 CSS**，否则 CSS manifest 检查红）。
4. **文本编辑**：双击进 `contenteditable`、输入同步、Enter 拆块。
5. **保存闭环**：`snapshot` → 清洗 → 写回 → 再打开内容稳定（幂等）。

前 1 条做完就能验收，后面每条都建立在前一条之上，任何一条卡住都不影响已交付部分。

## Verification

- 单测：清洗纯函数的「零残留」断言、锚点 id 对同一 content 可复现、幂等（再打开→保存→字节不变）。
- e2e：编辑态 iframe 存在且含运行时；点选后高亮出现；双击改字后 `content` 变化；保存后文件里搜不到 `cm-`。
- `bash scripts/verify.sh` 全绿；CSS manifest 覆盖新增 decoration 类。
