---
title: WorkBuddy HTML 可视化编辑逆向报告
type: research
source_of_truth: supporting
status: draft
last_updated: 2026-11-04
---

# WorkBuddy HTML 可视化编辑 逆向报告

> **重建说明（2026-11-04）**：本报告原稿于 2026-10-31 生成，未纳入 git 跟踪，后被工作区清理（`git clean` 类操作）抹除；配套证据目录 `workbuddy-html-evidence/`（含 175KB DM 脚本全文）与 `/tmp/wb-asar` 解包目录亦已丢失。现依据 2026-10-31 会话记录中的完整报告正文重建。凡原稿中比会话记录更细的表格（如 Bridge 协议完整方法表），已按会话中提到的方法名重建并标注，细节以原稿为准、本文为功能等价版。

| 项目 | 内容 |
|---|---|
| 逆向对象 | WorkBuddy 5.9.3（腾讯，Electron 应用） |
| 代码载体 | `app.asar`（曾解包至 `/tmp/wb-asar/app`，678MB，现已清除） |
| 逆向方法 | 纯静态分析：解包 asar → 反混淆定位 → 提取常量与函数片段 |
| 原报告日期 | 2026-10-31 |
| 重建日期 | 2026-11-04（依据会话记录） |

---

## §0 背景与方法

WorkBuddy 是腾讯的 Electron 桌面应用（内含 VSCode 内核痕迹，有 `vscode-file` scheme）。本次逆向目标：其 **HTML 文件的可视化编辑功能**——不是 Monaco/CodeMirror 式源码编辑，而是类似网页设计器的"所见即所得"编辑器。

内部代号：**smartpage / ai-page / janus**。

工作过程（2026-10-31 会话）：
1. 解包 `app.asar`（678M）到 `/tmp/wb-asar/app`；
2. 按关键词定位 HTML 编辑相关代码（文件类型路由、编辑器面板、引擎）；
3. 找到核心控制器 `DirectEditingController`；
4. 提取 iframe 内注入的 bridge 脚本（常量 `ka`，175KB，含 html-to-image）与 HTML→模型转换 Worker（常量 `ys`）。

### §0.5 证据文件清单（原稿）

原报告配套证据目录 `docs/research/technical/workbuddy-html-evidence/`，共 6 个文件：
- DM 脚本全文（175KB，`/tmp/wb-dm-script.js` 的固化副本）
- 5 个核心函数片段（htmlToJson / buildEditableSrcDoc / DirectEditingController 关键方法 / serializeDocumentForSave / pnid 回写逻辑）

> ⚠️ 该目录与 `/tmp` 下解包产物均已丢失。本报告结论不依赖证据文件即可成立（结论已完整记录在会话与本文中），但如需逐行核对原 DM 脚本，需重新解包 WorkBuddy 5.9.3 的 `app.asar` 再提取。

---

## §1 结论摘要

**架构一句话**：WorkBuddy 的 HTML 编辑 = 自研「可视化编辑引擎」——HTML 经 htmlparser2 全量解析成 JSON 节点模型（janusData），渲染进 iframe srcdoc 并注入 175KB 交互脚本（DM），编辑事件经 postMessage Bridge 回主侧控制器做模型 mutation，保存时直接取 iframe 当前 DOM 全量快照、清洗后写回文件。

**3 个值得照抄的设计决策**：
1. **保存用全量 snapshot，不用增量 diff patch**——取 iframe DOM 字符串 → 清洗内部标注 → 写文件。比维护 DOM↔模型双向同步的 diff 简单可靠得多。
2. **pnid 回写（write-back）**——首次打开文件时若缺 `data-page-node-id` 标注，把带 id 的版本写回原文件（`skipPublishRefresh`），下次打开编辑器即可秒级对齐节点，无需重新解析匹配。
3. **预览/编辑双态分离**——`editing=false` 时不建模型、不注入 DM 脚本，纯 srcdoc 预览零开销；切换编辑时才做 live upgrade 并保持滚动位置与选中锚点。

---

## §2 完整链路图

```
文件打开 → tab kind='html' → OfficeBrowserHost（编辑开关 editing）
  → HtmlEditorPanel（懒加载）
    → HtmlEditor SDK（核心引擎 index.esm-BK-FPQsh.js）
      ① htmlToJson：HTML → JSON 节点模型 janusData（htmlparser2，跑在 blob Worker 里）
      ② buildEditableSrcDoc：给每个节点注入 data-page-node-id 属性 + <!--pnid:xxx--> 注释锚点
      ③ iframe srcdoc 渲染 + injectSrcDocRuntime
      ④ iframe 加载后注入 DM 脚本（175KB，可视化交互引擎）
      ⑤ postMessage Bridge 双向通信
      ⑥ DirectEditingController：事件 → 模型 mutation → patch 回 iframe
      ⑦ 保存 = callBridge('snapshot') 取 iframe 当前 DOM → 清洗 → writeFile
```

---

## §3 核心机制与模块地图

### 3.1 模块地图（反混淆标识符 → 文件位置）

| 功能 | 标识符 | 位置 |
|---|---|---|
| 文件类型路由 | `sr()`、`case 'html'`（OfficeContentHost switch） | `renderer/assets/bootstrap-KNl9qDj_.js` |
| 预览资源本地服务 | `staticHtml:registerDir` | 主进程侧，见 §4 |
| HtmlEditorPanel 入口 | 懒加载 chunk | `html-editor-C2notMFK.js`（懒加载 + save 注册） |
| HtmlEditor 组件 + 引擎 | — | `index.esm-BK-FPQsh.js` |
| iframe 内编辑脚本（DM） | 常量 `ka` | 内嵌于引擎，175KB（含 html-to-image） |
| HTML→JSON 转换 Worker | 常量 `ys` | htmlparser2 + htmlToJson 的 worker 版 |
| 核心控制器 | `DirectEditingController` | 引擎内 |
| 文件 IO 适配 | `readText` / `writeText` / `writeBinaryFile` | daemon IPC，写入限定 `allowedDirs` |
| 保存调度 | `onRegisterHtmlSave` → `saveOfficeTab` → `pickSavePath` | tab 层 |
| 外部变更订阅 | `subscribeFileChange` | tab/面板层 |

### 3.2 Bridge 协议（postMessage，主侧 ↔ iframe DM 脚本）

> 下表按会话记录中提到的方法名重建；原稿有更完整的方法/事件表，此处为功能等价子集。

**主侧 → iframe（命令）**：

| 方法 | 作用 |
|---|---|
| `callBridge('snapshot')` | 取 iframe 当前 DOM 字符串（保存用） |
| `patchStyle` | 直接打回 iframe DOM 改样式 |
| `patchAttr` | 直接打回 iframe DOM 改属性 |
| `replaceTag` | 替换标签名 |
| `_syncTextNodes(pageNodeId, content)` | 文本节点内容同步（输入防抖 500ms 后） |
| `blockSplit` | Enter 拆块 |

**iframe → 主侧（事件）**：

| 事件 | 作用 |
|---|---|
| `selection` / `hover` | 点选/框选/悬停上报（按 `data-page-node-id` 定位） |
| `textEditBegin` / `textEditInput` / `textEditEnd` | 双击进入文本编辑的完整事件流 |

### 3.3 janusData 模型

```js
// 节点模型：id 为 22 位字符
janusData = {
  [id]: {
    type: 'root' | 'element' | 'text' | 'comment' | 'directive',
    tag, attributes, children, content, computedStyle
  }
}
```

- 加载时**全量解析**（htmlparser2，跑在 blob Worker 里，不阻塞 UI）；
- 编辑时做**增量 mutation**，模型侧记 undo 栈；
- 节点与 DOM 的锚定靠 `data-page-node-id` 属性 + `<!--pnid:xxx-->` 注释锚点双保险。

### 3.4 编辑交互（全部在 iframe 内 DM 脚本实现）

- **hover/点选/框选**：按 `data-page-node-id` 定位，画高亮框，事件经 bridge 上报 `selection`/`hover`。
- **文本编辑**：双击 → 元素临时加 `contenteditable` → `textEditBegin/Input/End` 事件流回主侧；输入防抖 500ms 后 `_syncTextNodes(pageNodeId, content)` 更新模型；Enter 拆块走 `blockSplit`。
- **样式/属性**：`patchStyle`/`patchAttr`/`replaceTag` 直接打回 iframe DOM，模型侧记 undo 栈。
- **拖拽移动节点**、**区域截图**（html-to-image，供 AI 引用）。

### 3.5 保存逻辑（全量快照，非 diff patch）

```js
// 导出：从 iframe 取当前 DOM 字符串
const html = await controller.callBridge('snapshot');
// 清洗：去掉 data-dm-internal 元素、data-dm-ref、contenteditable、
//       编辑期 outline 样式、pnid 注释锚点 → serializeDocumentForSave()
// 写回：fs.writeFile(path, cleanedHtml, { allowedDirs: [path] })
```

清洗函数为 `serializeDocumentForSave()`，目标是"编辑标注痕迹零残留"。

### 3.6 pnid 回写机制

首次打开文件时，若文件缺 `data-page-node-id` 标注：
1. 解析后把带 id 的版本**写回原文件**（`skipPublishRefresh`，跳过后续刷新发布）；
2. 下次打开编辑器即可秒级对齐节点，无需重新做 DOM↔模型匹配。

代价是首次打开多一次写文件；收益是后续每次打开的对齐成本归零。

### 3.7 预览/编辑双态与快捷键

- `editing=false`：不建模型、不注入 DM 脚本，纯 srcdoc 预览；
- `onToggleHtmlEdit` 切换时做 live upgrade，**保持滚动位置和选中锚点**；
- 文件被外部修改 → `subscribeFileChange` 重新加载；
- **Ctrl+S**：组件注册 save 回调到 tab 层（`onRegisterHtmlSave`），`saveOfficeTab` 统一调度，未命名文件走 `pickSavePath`。

---

## §4 预览资源服务方案

**WorkBuddy 的做法**：预览 HTML 里的相对路径图片/CSS 需要一个本地资源服务，主进程开本地端口：

```
staticHtml:registerDir → http://127.0.0.1:<port>/static-html/<token>/<basename>
```

按目录注册、token 防越权，解决 srcdoc iframe 内相对路径资源加载。

**Tauri 对应替代（Clairis 用）**：Tauri 的 `convertFileSrc` + `asset` protocol 可直接替代这套 127.0.0.1 静态服务器——`convertFileSrc(path)` 生成 `asset://` URL，配合 `tauri::protocol::AssetProtocol` 授权即可，无需自建端口服务。注意 iframe srcdoc 内相对路径解析需重写为绝对 asset URL。

---

## §5 迁移实施建议（落到 Clairis）

Clairis 已有 CodeMirror 6 三模式架构（source/preview，CSS display 切换不 remount），HTML 编辑可分层做：

### 方案 A：最小闭环（建议先做）

HTML 文件用 CM6 source 模式（`@codemirror/lang-html` 是 CM6 生态标准包）+ 现有 preview 面板渲染 HTML。

- 工作量小，完全复用现有三模式架构与模式切换机制；
- 不引入 iframe bridge 复杂度；
- 对应 OpenSpec change 按仓库硬约束走 `/opsx-propose` 闭环。

### 方案 B：可视化编辑（WorkBuddy 这套全拆解）

完全照 WorkBuddy 架构移植，四个深模块：

| 模块 | 参照物 | Clairis 实现要点 |
|---|---|---|
| 解析标注 | htmlparser2 + htmlToJson（blob Worker） | Worker 内跑 htmlparser2，生成 janusData 式节点模型 |
| 渲染 | iframe srcdoc + injectSrcDocRuntime | 同 srcdoc；资源用 `convertFileSrc` 替代 127.0.0.1 服务 |
| 交互 | DM 脚本（175KB，可重写为精简版） | 自研交互层：hover/选区/文本编辑/拖拽，事件上报 bridge |
| Bridge + 控制器 | postMessage + DirectEditingController | `snapshot` 保存 + 全量清洗；pnid 回写可照抄 |

Tauri 侧只需提供 `read_text_file`/`write_text_file` + 预览资源服务（`convertFileSrc`）。

### Clairis 仓库硬约束提醒

- **需求变更必须走 OpenSpec 闭环**（`/opsx-propose` → `/opsx-apply` → `/opsx-archive`），禁止绕过 change 直接改主规格；
- **模式切换不 remount**：preview/edit/source 用 CSS display 切换，保留 CM6 undo/选区状态，不得改成条件渲染重建 EditorView；
- **UI 修复必须真机验证**：`npm run tauri dev` + 手动点关键路径，编译/测试通过不等于可用；
- **CSS manifest 检查**：新增 `cm-*` decoration class 必须在 `src/styles/` 有对应 CSS 规则；
- 编辑器实例在 `src/editors/editorRef.ts` 模块级 Map（按 panelId），不进 store。

---

## §6 未验证项（静态分析的边界）

以下结论来自纯静态逆向，未经运行时动态验证：

1. **Bridge 消息时序**：`textEditBegin/Input/End` 的具体触发时机、防抖 500ms 的实现位置、`snapshot` 返回的是序列化字符串还是 DOM——均为代码路径推断。
2. **pnid 回写时机**：`skipPublishRefresh` 的具体触发条件与失败兜底未实测。
3. **DM 脚本内部逻辑**：框选、拖拽、html-to-image 截图的细节仅基于函数名与调用点推断（原 175KB 脚本已丢失，无法逐行复核）。
4. **Worker 通信协议**：blob Worker 与主侧的 postMessage 载荷格式未提取验证。

如需运行时验证：WorkBuddy 5.9.3 仍在使用中，可用 Electron inspector（devtools）动态观察 bridge 消息与 iframe 注入过程。

---

## 附：给执行 agent 的开工指令（原稿遗留）

> 读本报告，按方案 A（CM6 source + preview）走 OpenSpec 闭环（`/opsx-propose`）建立 change 后再实现；可视化编辑（方案 B）立为后续 change。
