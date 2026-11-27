# batch23 真机反馈诊断报告（4 条）

- 工作区：`/Users/mason/ToHighs/clairis-auto-3`，分支 `triage/feedback-1127`（基线 `origin/main` 05926438）
- 方法：读代码 + headless e2e 探针真机复现（真实点击/输入/blur/滚轮/拖拽），原始运行时状态见各条
- 结论：**反馈 3、4 为本批引入的回归，headless 已复现**；反馈 1、2 headless 不可复现，属 WKWebView 特有/时序竞态，给出机制判断与真机可达修复方向
- 未改任何产品代码；诊断探针 spec 已删除

---

## 反馈 3：描述功能整个失效（输入→点外部保存→不显示、按钮不亮）

### 复现步骤（可自动化）
1. 打开 `![示例](IMG)`，点图片选中
2. 点工具条「添加描述」→ 输入「诊断描述」
3. 点编辑器正文空白处（或 body 任意外部）
4. 观察：工具条整体消失、描述行消失、按钮不存在

### 原始运行时状态（headless 复现）
```
SNAP filled:            {"sel":"true","title":"","capDisp":"block","capText":"输入图片描述","inpDisp":"block","inpVal":"诊断描述","btnConn":true,"btnCls":"is-active","tbConn":true}
SNAP after-cm-click:    {"sel":"false","title":"诊断描述","capDisp":null,"capText":null,"inpDisp":null,"inpVal":null,"btnConn":null,"btnCls":null,"tbConn":null}
DOC after: ... "诊断描述")          ← 标题其实已写进文档
```
即：**标题已保存成功，但选中态被清除**（`sel:false`、`tbConn:null`、caption 被移除）。用户看到的就是「描述不显示、按钮不亮」。

### 根因（文件:行号 + 机制）
- `src/editors/decorations/imageToolbar.ts:1513-1522`：全局 `document` 捕获阶段 `click` 监听，target 不在 `.cm-image-widget` / `[data-testid="img-toolbar"]` / `[data-testid="img-maximize"]` 内就 `deselectImage()`。
- 点编辑器正文空白（`cm-content` 空白区）时，target 是 `.cm-line` / `.cm-content`，**不落在三个白名单里** → 触发 `deselectImage()`。
- `deselectImage()`（`imageToolbar.ts:304-316`）立即 `selection=null`、`captionVisible=false`、`removeToolbar()`、`applySelection()`；`applySelection()` 调 `markImageWidgetSelected(el,false)`，后者在 `imageToolbar.ts:364-366` 无条件 `el.querySelectorAll(".cm-image-caption").forEach(c => c.remove())`。
- 于是 caption DOM 被删、工具条被删、按钮 active 态随之消失。**标题已写回文档，但选中态没了**，用户重选图片时 caption 才会按 `data-image-title` 重新出现（DIAG3h 复现：`after-reselect` 时 `capDisp:"none"`，因为 `captionVisible` 在 `selectImage` 里被重置为 false，caption 存在但隐藏）。

### 归因（重要修正：非本批引入，是既有缺陷被本批放大）
- 全局 `document` 捕获 click → `deselectImage()` 的白名单（`imageToolbar.ts:1513-1522`）**是本批之前就存在的既有代码**（`#1400` 引入 `captionVisible` 时已在）。
- `markImageWidgetSelected` 清理 caption（`imageToolbar.ts:364-366`）由 `#680` 引入，也是既有。
- 本批（#1575-#1600）**没有改动**上述两条路径（`git diff 05926438..HEAD` 对 `imageToolbar.ts` 的 caption/deselect 行零改动；`image.ts` 零改动）。
- 但本批 **#1562** 把「工具条隐藏」从逐帧 rect 改为 IntersectionObserver（`imageToolbar.ts:900-924`），并在 `selectImage`/`moveImageSelection` 里新增 `bindViewportObserver()`。IO 回调里 `intersectionRatio === 0` 会 `deselectImage()`——**这为「点外部」新增了一条 deselect 路径**（此前只有全局 click 一条）。真机上 IO 回调时机与 click 叠加，放大了「点外部即丢选中态」的概率。
- 反馈 3 的**直接触发**是「点外部 → deselect」（全局 click 或 IO），而非 blur 本身：headless 实测不点外部时 `after-enter` caption 正常显示。

### 修复方案（1-3 句）
1. 全局 deselect 白名单加入 `.cm-content`（或 `.cm-editor`）内的「非输入区点击」判定：点正文空白不应清图片选中态，只应清工具条定位；或
2. blur 提交后 **不因同一次点击 deselect**：在 caption 输入框 blur 提交期间置一个「刚提交」标志，全局 click 监听在该标志有效时跳过 deselect（与 `toolbarInteraction` 同机制）；或
3. 最小改：`deselectImage()` 不删 caption（把 `markImageWidgetSelected` 的 caption 清理改为「仅非选中态隐藏、不 remove」），保证重选/取消后 caption 仍在。

### 风险
- 方案 1 改动全局选中语义，可能影响「点正文取消图片选中」的既有预期（既有 e2e `imgcaptiontoggle` 依赖点外部后工具条消失）。
- 方案 2 时序窗口要覆盖 blur→click 全链，真机 WKWebView 的 blur/click 顺序与 headless 不同，需真机验证。
- 方案 3 改动 caption 生命周期，需回归 `imgcaptioncollapse` 等既有用例。

---

## 反馈 4：清空描述保存后文字仍在（无法清除）

### 复现步骤（可自动化）
1. 打开 `![示例](IMG "旧描述")`，点图片选中
2. 点「添加描述」→ 清空输入框 → 点外部（blur 保存）
3. 观察：文档仍含 `"旧描述"`，描述行仍显示「旧描述」

### 原始运行时状态（headless 复现，三条路径一致）
```
DOC before: ... "旧描述")
DOC after blur:    ... "旧描述")     ← 未清除
DOC after enter:   ... "旧描述")     ← 未清除
DOC after btn-click: ... "旧描述")   ← 未清除
```
输入框 `inpDisp` 变 `none`（提交收尾执行了），但标题没被移除。

### 根因（文件:行号 + 机制）
- `imageToolbar.ts:446-459` `finish(value)`：
  ```ts
  if (value === "" || value === current) {
    setCaptionText(caption, current);      // ← value==="" 走这里，只回显 current，不写回
  } else {
    actions.onImageSetTitle?.(from, value);
  }
  ```
  **空串被显式跳过**：`value === ""` 时只把 caption 文本设回 `current`（旧标题），不调用 `onImageSetTitle`。
- `hideCaptionInput`（`imageToolbar.ts:503-516`）同样：`if (value !== "" && value !== current) actions.onImageSetTitle?.(...)`，空串不写回。
- 结果：`writeImageTitle(view, from, "")`（`image.ts:543-581`）**从未被调用**，而该函数本支持空串移除标题（`image.ts:555-563`）。文档里 `"旧描述"` 残留，caption 也继续显示旧标题。
- 用户「除非里面有文字内容才能保存」的感受正是此分支：只有非空且与 current 不同才写回。
- **归因**：`finish` 的空串跳过由 `#793` 引入（既有缺陷），非本批；但本批 #1562 的 IO deselect 让「点外部」更容易中断编辑态，使这个既有缺陷更易被触发。

### 修复方案（1-3 句）
1. 把 `finish`/`hideCaptionInput` 的判据从「空串跳过」改为「与 current 相同才跳过」：`if (value === current) {回显} else { onImageSetTitle(from, value) }`，让空串走到 `writeImageTitle(from, "")` 移除标题。
2. 或保留空串跳过，但在 `value === "" && current !== ""` 时显式调 `onImageSetTitle(from, "")`。
3. 同步检查 `writeImageTitle` 空串移除分支（`image.ts:555-563`）的 `start` 回退逻辑，确保移除后文档无多余空格/引号残留。

### 风险
- 低。`writeImageTitle` 空串分支已实现且被 `image.ts` 单测覆盖；改动只放宽调用侧判据。
- 需回归「Esc 取消不写入」（`imgcaptionesc`）：Esc 路径不走 `finish`，不受影响。

---

## 反馈 1：第一次裁剪仍有跳动（headless 测不到）

### 复现步骤
headless 用 `e2e/editors/crop-jump-measure.spec.ts` 两场景（余量/贴底）实测：**余量场景 scrollTop 501→501 零位移、贴底场景 scrollTop 393→373 一次性物理 clamp**，均 ≤1px，与 #1560 结论一致。真机仍报「第一次裁剪还会有跳动，但不会再跳到文档顶部」。

### 根因（机制判断，headless 不可复现部分）
- 已修部分：`#1560` 用 `scroller.style.filter = "blur(0px)"` + rAF 清回替代 1px 滚动回弹，消除确认瞬间的 scrollTop 位移（`imageCrop.ts:597-602`）。headless 确认零位移。
- 真机仍跳的可能来源（按可能性排序）：
  1. **WKWebView 滚动锚定/内容高度塌陷时序**：`#1559` 把 cleanup 同步化后，`frame.remove()` + `sweepCropResidue()` + `restoreWindow()`/`restoreDisplay()` 在同一 tick 内执行，内容高度瞬时塌陷再恢复。WebKit 在「可编辑 DOM 变更后把选区滚进视口」的补偿可能**晚于 rAF 窗口**（`pinScroll` 只覆盖 450ms，`onScrollGuard` 手势窗口只 500ms）。真机日志历史签名（`1686 → 1168`、`sel 788→901`）指向 caret 滚入视口。
  2. **`filter` 重栅格化本身触发布局/滚动微调**：`blur(0px)` 在 WKWebView 上强制 GPU 重栅格化，可能伴随一次滚动位置重算；headless Chromium 无此效应。
  3. **`pinWidgetScroll`（`image.ts:637-650`）只钉 2 帧**：点图片选中时的护栏窗口太短，真机首帧后的 caret 补偿漏网。
  4. **`suppressCaret`（`imageCrop.ts:783-796`）的 `.cm-scroller` 白名单**：裁剪会话内点 `.cm-scroller` 不拦截，CM6 仍可能设选区并滚入视口。

### 修复方案（1-3 句，真机可达性标注）
1. **真机可达**：把 `pinScroll` 的时间窗从 450ms 提到覆盖 WKWebView 的延迟补偿（如 1200ms），并在 `onScrollGuard` 里把「手势窗口」从 500ms 同步放宽；这是纯参数调整，headless 不会更差。
2. **真机可达**：`pinWidgetScroll` 的 2 帧护栏改为与 `pinScroll` 同口径的时间窗，覆盖点图片选中后的延迟 caret 补偿。
3. **需真机验证**：若 1/2 无效，则在确认路径显式 `view.dispatch` 一个空事务前记录 `selection.main.anchor`，确认后恢复选区（避免 CM6 因文档变更重置 caret 触发滚入视口）。

### 风险
- 放宽滚动护栏时间窗可能与用户滚动意图打架（`pinScroll` 已有 wheel/touchstart/keydown 让位，风险可控）。
- 反馈 1 的根因判断基于历史真机日志推断，**未经本次真机复现确认**；建议修复前用 `cropJumpProbe`（`src/utils/cropJumpProbe.ts`）在真机抓一次 `crop-debug.log` 坐实签名。

---

## 反馈 2：放大层「恢复原始尺寸」后缩放经常自动回 100%

### 复现步骤
headless 用 `e2e/image-lightbox.spec.ts` + `maximize-tooltip-zoom.spec.ts` + 自写探针实测：连点 zoom-in 5 次（161%）→ reset → 100%；拖拽平移后 reset → 100%；reset 后立刻滚轮 → 按滚轮方向变化（非自动回 100%）。**headless 未复现「reset 后自动回 100%」**。

### 根因（机制判断 + headless 排除项）
- 已排除：`img-max-reset` 按钮的 click handler（`imageToolbar.ts:1410-1422`）只写 `maximizeTransform = {scale:1,...}` 并 `maximizeApplyTransform()` + `refreshZoomUi()`，无异步覆盖路径；tooltip 的 `pointerdown` 只 `hide()` 气泡，不吞点击。
- 已排除：`overlay` 的 `dblclick`（`imageToolbar.ts:1452-1456`）也复位到 100%，但用户点的是按钮不是背景。
- 真机「经常性自动回 100%」的可能来源：
  1. **双击复位与单击 reset 竞争**：用户点一次 reset 按钮，若前一次点击的 `dblclick` 判定在 WKWebView 上时序不同，可能先触发按钮 click（复位）再触发 overlay dblclick（再复位）——两者都到 100%，表现为「点了没效果/自动回 100%」。但用户描述是「点恢复原始尺寸后经常自动还原」，方向相反（用户想保持放大）。
  2. **滚轮/捏合事件在 reset 后到达**：`maximizeOnWheel`（`imageToolbar.ts:986-991`）在 overlay 上监听，reset 后若有一次残留滚轮事件（WKWebView 滚轮事件常成对/延迟到达），会立即把 scale 拉离 100%。headless 单次滚轮可复现「reset 后滚轮改变 scale」，但用户说的是「自动回 100%」而非「被改变」。
  3. **多图切换 `renderCurrent()`（`imageToolbar.ts:1300-1356`）重置 scale**：若 reset 按钮的点击被识别为「切换到下一张」（多图模式），`renderCurrent` 会把 scale 重置为 1。多图模式下按钮相邻，真机误触可能。
  4. **`maximizeRefreshUi` 钩子被覆盖**：`openImageMaximize` 每次设 `maximizeRefreshUi = refreshZoomUi`（`imageToolbar.ts:1435`）；若浮层未关闭而重复打开，旧闭包的 `refreshZoomUi` 仍引用旧 `scaleLabel`，但 `maximizeTransform` 是模块级同一份，不会自动回 100%。

### 修复方案（1-3 句）
1. **真机可达**：reset 按钮 click 后加一个短窗口（如 300ms）忽略后续 wheel/pinch，避免残留滚轮事件立即覆盖；同时把 overlay 的 `dblclick` 复位改为「仅当 target 是 overlay 背景」时生效，避免按钮双击误触发。
2. **真机可达**：多图模式下确认 reset 按钮的命中区与切换按钮不重叠（检查 `controls` 布局），并在 `renderCurrent` 重置 scale 前判断「是否用户主动 reset」。
3. **需真机验证**：用真机复现并抓 `maximizeTransform` 变化时序（加临时探针），确认是滚轮残留、误触切换还是 dblclick 竞争。

### 风险
- 方案 1 的忽略窗口可能吞掉用户紧接的合法缩放；窗口取 200-300ms 并只在 scale 刚被复位时生效可降低风险。
- 反馈 2 的根因**未经真机复现确认**，headless 证据只排除了按钮/overlay 直接路径。

---

## 汇总

| # | 反馈 | headless 复现 | 根因定位 | 归因 |
|---|------|--------------|---------|------|
| 3 | 描述失效（点外部保存不显示） | ✅ 已复现 | 全局 click deselect + `markImageWidgetSelected` 删 caption | 既有缺陷，本批 #1562 IO 放大触发概率 |
| 4 | 清空保存文字仍在 | ✅ 已复现 | `finish`/`hideCaptionInput` 空串跳过写回 | 既有缺陷（#793），非本批 |
| 1 | 首裁跳动 | ❌ 不可复现 | WKWebView 延迟 caret 补偿 / filter 重栅格化时序 | 待真机确认 |
| 2 | 放大层 reset 后回 100% | ❌ 不可复现 | 残留滚轮 / 多图切换 / dblclick 竞争（推断） | 待真机确认 |

**优先级**：反馈 3、4 有 headless 铁证且改动小、风险低，建议先修；反馈 1、2 需真机探针（`cropJumpProbe` + 放大层临时探针）坐实后再改。

---

## 修复记录（#1602，分支 fix/caption-save-visibility）

**反馈 4（清空无法移除）**：`imageToolbar.ts` `finish()` 与 `hideCaptionInput()` 的写回判据从「空串跳过」改为「与 current 相同才跳过」——空串现在走 `onImageSetTitle(from, "")` → `writeImageTitle` 的空串移除分支。Esc 取消路径不走 `finish`，不受影响。

**反馈 3（点外部保存不显示）**：新增 `captionCommitUntil` 提交窗口（300ms，与既有 `toolbarInteraction` 同机制）。`finish`/`hideCaptionInput` 写回时置窗口；全局 `document` 捕获 click 与 IntersectionObserver deselect 在窗口内豁免，避免同一次「点外部」把刚写回的标题连同选中态一起清掉。

**未采纳方案**：诊断曾建议「`markImageWidgetSelected` 取消选中时隐藏 caption 而非 remove」。实测会破坏既有用例 `e2e/image-crop-session.spec.ts`「带题注图片确认裁剪后：DOM 中不留任何裁剪/选中标识」（caption DOM 残留）与 `e2e/image-block-edit.spec.ts`「描述输入框默认隐藏…」（输入框随 caption 保留而不移除）。且该步对反馈 3 的验收非必需——提交窗口豁免已让「保存瞬间选中态保留、caption 显示」，重选时 `appendCaptionLine` 会按 `data-image-title` 重建。故回退，只保留提交窗口。

**验证**：`npx tsc --noEmit` 0；`npm test` 2265 全绿；新增 `e2e/editors/caption-save-visibility.spec.ts` 3 条（A/B/Esc）全绿；`e2e/image-block-edit.spec.ts` + `e2e/image-crop-session.spec.ts` 43 条中 42 条绿，唯一失败「工具条 9 按钮」为既有过期测试（工具条现为 10 按钮，origin/main 同样 10，属 #1598）。

**关于「本批回归」的核实**：`git diff 05926438..HEAD` 显示本批 5 个 fix/feat commit（#1575/#1587/#1591/#1589/#1594/#1596）**均未改动** caption 的 `finish`/`hideCaptionInput` 空串判据、全局 click deselect 白名单、`markImageWidgetSelected` 的 caption 清理。反馈 3/4 的根因路径是既有代码；本批 #1562 的 IntersectionObserver deselect 是**新增的放大路径**，建议一并纳入修复。
