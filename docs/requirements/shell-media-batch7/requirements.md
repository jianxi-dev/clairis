# requirements — shell-media-batch7

> Spec issue: https://github.com/jianxi-dev/clairis/issues/410
> 生效日期：2026-11-08
> 来源：用户 2026-11-08 第三次真机走查的 8 项反馈（逐条原文见 issue #410「Problem Statement」）。
> 一手证据：代码级根因复核（`StatusBar.tsx` 关闭定时器未取消 + 6px 死区、`FloatingPreview.tsx` `sandbox=""` + `srcDoc`、`VideoPlayer.tsx` 仅 window resize 触发 `autoSize`、`PaneTreeView.tsx` 全屏按钮 `hover:text-accent`）+ 用户提供的失败样本 `/Users/mason/Desktop/AI学习/skill集合/contract-consult/readme-contract-consult.html`（50,985 字节，自包含 + Tailwind CDN + 内联脚本）。

## What（做什么）

在一个 change 内，按用户可见表面修复/补齐 8 组行为：

1. **主题弹层生命周期 + 状态栏主题入口**
   - 指针从按钮移向弹层（含跨过视觉间隙）时弹层 SHALL NOT 自行关闭。
   - 弹层与按钮之间的 6px 间隙 SHALL 由透明桥接覆盖，不再构成关闭窗口。
   - 关闭途径 SHALL 为：选中某项、外部 `pointerdown`、`Esc`、页面滚动、组件卸载。
   - 底部「双击隐藏 → 热区唤出」状态下，指针移向弹层 SHALL NOT 因状态栏卸载而丢失弹层。
   - 单击状态栏主题图标 SHALL 循环切换主题（`system → light → dark → warm → system`）；悬停仍打开面板；面板项点击仍直接设定。
   - 补齐 `aria-haspopup` / `aria-expanded` / `role="menu"` / `role="menuitem"`。
   - 宽度调整面板 SHALL 具备外部点击与 `Esc` 关闭。
   - **沉淀规则**：产出「悬停浮层生命周期」设计规则文档，并在 UI 状态矩阵新增「弹层」状态列。

2. **图片右键菜单**
   - 在预览区右键图片 SHALL 弹出应用自绘菜单，且渲染路径 SHALL NOT 先等待任何 IPC / 文件读取。
   - 菜单项：打开所在文件夹 / 另存为… / 复制文件路径 / 关闭预览。
   - 该元素上的 WebKit 原生右键菜单 SHALL 被抑制。
   - 关闭途径：选一项、外部点击、`Esc`、滚动、切换文件。

3. **页签右键菜单「关闭其他」图标**
   - 图标 SHALL 只含一个实心 ×，SHALL NOT 含虚线描边，18px 下不与「关闭」图标混淆。

4. **视频播放器**
   - 播放键左右 SHALL 各有一个「上一集 / 下一集」按钮；点击切换同目录媒体项。
   - SHALL 提供「截取当前画面」：把当前帧存为 PNG（系统另存为，默认名 `<视频名>-<分:秒>.png`）。
   - SHALL 提供旋转（90° 步进）与画面缩放（1×–4×，双指捏合 + 按钮），缩放后 SHALL 可拖拽平移。
   - SHALL 提供画面亮度调整（50%–150%）。
   - 播放器容器尺寸变化（拖分隔线、格全屏、窗口缩放）后 SHALL 自动重新适配画面，SHALL NOT 需要切一次网页全屏才恢复。
   - 控制条按钮间距 SHALL 比现状更紧。
   - 按钮顺序：截图按钮在网页全屏按钮之前，画中画按钮在网页全屏按钮之后。
   - 音频文件 SHALL NOT 显示旋转 / 缩放 / 亮度 / 截图控件。

5. **沉浸模式**
   - 进入沉浸后状态栏 SHALL 自动隐藏；指针进入窗口底部热区 500ms SHALL 临时显现（可用其退出沉浸）。
   - 进入沉浸后左侧阅读空间 SHALL 自动隐藏；若阅读空间处于钉住态 SHALL 保持可见。
   - 沉浸态页签条 SHALL 按栏独立：指针进入某栏顶部热区时显示**该栏自己的**页签条（贴合该栏宽度与位置），移出 400ms 收起；拖拽页签期间不收起。SHALL NOT 再使用一条全局悬浮页签条。
   - 退出沉浸后，状态栏与阅读空间 SHALL 回到进入前的可见状态，无需手动恢复。

6. **chrome 图标颜色统一**
   - 状态栏右侧图标（AI 除外）、顶部未选中页签名、栏目右侧按钮、阅读空间卡片底部按钮行与路径文字 SHALL 共用同一对前景色 token：默认暗、悬停亮。
   - AI 入口图标 SHALL 保持 accent 常亮。
   - 栏目内全屏按钮悬停 SHALL 与其他同类按钮一致，SHALL NOT 变蓝。
   - 上述表面 SHALL NOT 继续使用 `opacity-60` / `opacity-70` / `text-gray-400` 等零散实现。

7. **阅读空间悬浮窗**
   - 图片 SHALL 按内容区宽度适配、高度自适应，允许纵向滚动（与主预览一致）；SHALL NOT 被压成适应高度的一条。
   - HTML SHALL 以本地资源地址直载并允许脚本，SHALL NOT 使用 `srcDoc` 且禁脚本的路径；自包含 HTML 的样式与脚本 SHALL 正常执行。
   - 二进制 / HTML 类型 SHALL NOT 先整份读入前端再渲染。

8. **一键布局栏目**
   - 状态栏主页图标之后 SHALL 新增一个「自动布局」按钮。
   - 点击后按当前栏数与各栏选中页签的文件类型自动排布；媒体栏（图片/视频/PDF）优先获得更大面积。
   - 布局结果 SHALL 保留全部页签、页签顺序、每栏 `activeTabId`、`editorMode` 与焦点栏。

## Why（为什么）

- 第 1 项是同类缺陷第三次复发（`#328` 子菜单被卸载、`#374` 颜色二级被父级关闭、本次主题弹层），只修个例必然第四次复发；按 DQ-7 必须产出规则层修订。
- 其余各项是长期使用后的手感损耗：菜单迟滞、图标认不出、视频不能用、沉浸收不干净、同一语义六种颜色、悬浮窗看不了长图与真实网页、多栏只能手拖。散落热修会互相踩同一批文件（状态栏、栏头、播放器、悬浮窗各自被多处改动），所以按表面收成一个 change，每片配真实渲染的 e2e 探针。

## Scope

- 前端代码：`src/components/StatusBar.tsx`、`src/components/TabBar.tsx`、`src/components/Content/PaneTreeView.tsx`、`src/components/Content/VideoPlayer.tsx`、`src/components/Content/PreviewView.tsx`、`src/components/Preview/FloatingPreview.tsx`、`src/components/Rail/ReadingRail.tsx`、`src/components/ImmersivePeekBar.tsx`、`src/App.tsx`、`src/ui/icons.ts`、`src/styles/tokens.css`、`src/styles/editor.css`、`src/lib/*`（新增自动布局纯逻辑）。
- 规格：`application-shell`、`navigation`、`reading`、`file-management` 四个 capability 的 delta。
- 设计文档：新增「悬停浮层生命周期」规则文档；`docs/agents/ui-test-matrix.md` 增加「弹层」状态列。
- 测试：`e2e/` 新增/扩展主题弹层、图片右键菜单、页签菜单图标、视频控件与自适应、沉浸模式、颜色一致性、悬浮窗媒体、自动布局用例；`src/__tests__/` 覆盖自动布局纯函数与主题循环次序。

## Non-goals

- 不新增主题种类，不改现有色彩值。
- 不重做视频播放列表/循环/字幕/时间戳笔记（第五、六批已交付）。
- 不改网页全屏策略（仍不使用 macOS 原生全屏）。
- 不改阅读空间数据来源、排序、密度。
- 不做图片编辑（裁剪/滤镜），只做悬浮窗适配。
- 不改 PDF 渲染管线。
- 不引入新图标库或构建步骤。
- 不做多窗口布局同步。

## L-1 需求输入门自检（五条契约）

| 契约 | 状态 | 证据 |
|---|---|---|
| 来源可追溯 | ✅ | 用户 2026-11-08 第三次走查 8 条原文 → spec issue #410；每条可回指具体反馈序号与代码位置 |
| 空白显式化 | ✅ | 唯一未定项「截图保存到哪里」已显式裁定为系统另存为对话框（默认名带时间码），不阻断任何条目；无其他 `open-question` |
| 一手证据 | ✅ | 代码复核（`StatusBar.tsx` 关闭定时器与 6px 死区、`FloatingPreview.tsx` `sandbox=""`+`srcDoc`、`VideoPlayer.tsx` 仅 window resize 触发重排、`PaneTreeView.tsx` 全屏按钮 accent hover）；用户提供失败样本 HTML 已实测大小 50,985 字节并确认依赖外链脚本 |
| 冲突显式 | ✅ | 与 A-5「沉浸不做状态快照」的张力：本 change 用**派生可见性**（不写回用户偏好）实现「退出即恢复」，不引入快照；与 G-10「单条全局悬浮页签条」冲突，明确以「每栏独立页签条」修订该 requirement 并记录理由 |
| 验收锚点 | ✅ | 具体值齐备：关闭容忍 250ms、热区 16px/400ms、底部显现 500ms、缩放 1×–4×、亮度 50%–150%、媒体栏 ≥60% 宽、2×2 均分 ±2px；落 `anchors.md` 并由 `cw-conformance.sh` 生成机读层 |
