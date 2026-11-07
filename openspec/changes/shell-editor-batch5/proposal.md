# Proposal: 桌面外壳与编辑器批量修复（第五批）

## Why

用户 2026-11-08 一次走查报出 26 项问题，横跨沉浸模式与页签、PDF 预览、图标体系、Markdown 编辑、阅读空间卡片与状态栏、视频预览、HTML 编辑态，以及一批既有测试失败。逐项核对后确认多数是确定性缺陷（拖拽无反馈、悬浮条只在聚焦格、编辑态空白、撤销丢数据、页签名不更新），少数是需求补全（状态栏、选区工具条、标题折叠）。散落热修会继续漂移，收成一个 change 按"表面"垂直切片交付，每片配 e2e 探针。

## What Changes

1. **沉浸模式与页签**（反馈 1/2/3/9/10/17）
   - 悬浮页签条跟随指针所在格（非仅 `focusedPaneId`）；补齐 `paneId`/`onReorderTabs`/`onMoveToPane` 使跨格拖拽可用；拖拽期间抑制热区隐藏
   - 消除悬浮条上方 16px 透明带（热区与条重叠，保留命中高度）
   - 聚焦空分栏时给兜底文案，不再"有条无名字"
   - 页签拖拽加 `position: fixed` 跟手 ghost（portal 到 body，`pointer-events:none`）
   - 左边栏隐藏识别边改无色；页签名胶囊高度下调不压边线
   - 单格恢复全屏入口（**改 G-7**：原"单格 SHALL NOT 显示全屏按钮"作废）
   - 双击页签名就地改名（回车确认 / Esc 取消）
2. **PDF 预览**（反馈 5/6）
   - 去掉放大/缩小工具条按钮（`disabledCategories` 加 `zoom-in`/`zoom-out`），改双指捏合缩放（经 `onReady` 桥接 gesture 到 zoom 插件）
   - 卡片占位图换真首页缩略图（**需评估渲染路径**，见开放问题）
   - 滚动时浮现的页码/翻页工具条移入顶部按钮区并停止随滚动浮现（`disableOverlay("page-controls")` + 并入 `main-toolbar`）
3. **图标体系补漏**（反馈 7/15）
   - 新增 `exportWord`/`exportZip`/`exportMdpkg` 专形图标；重绘 `subtitle`（气泡形）与 `keyboardHints`（键位格）以区分
   - 播放器自绘控件图标尺寸与原生控件统一
   - 补主题暖色图标接线；沉浸入口由文字改 `immersive` 图标
   - 四处 pin 按钮改为 `name={pinned ? "pinOff" : "pin"}`
4. **Markdown 编辑**（反馈 18/19/20/21/23/24/25/26）
   - 全角斜杠/顿号输入后自动转 ASCII 斜杠并触发斜杠命令
   - 块手柄滑入即自动显示菜单
   - 大纲按钮方形圆角 + 钉住底色（默认透明）
   - 标题与有下级关系的上级前加可折叠三角
   - 选区浮动工具条从 md-bundle 迁移，图标复用 Clairis `icons.ts`
   - 手柄颜色/缩进/对齐复用 md-bundle 观感与能力（对齐目前缺失）
   - 文档多步前进/后退恢复：内容同步不再进历史、不跨页签；HTML 可视化编辑补快照历史
   - 选区范围调整 vs 整块调整；工具条按 workbuddy 收敛集合
5. **阅读空间卡片与外壳**（反馈 11/13/14/16/22）
   - 卡片动作移左下角，顺序 打开/右分栏/下分栏/收藏/路径；右上角显示阅读进度（仅百分比，悬停"已读"）与时间
   - "置顶"全量更名"收藏"
   - 悬停右侧 1/2 的预览窗宽度收窄到卡片缩略图宽度；底部按钮高度区悬停重显三按钮
   - 新增状态栏；取消顶栏主题区，4 图标按原顺序移入状态栏右侧
   - 新建文件默认 .md 且页签显示 md 图标；首页新建后进入栏目页
6. **视频**（反馈 8）：切换视频文件后页签文件名同步更新
7. **HTML 编辑态**（反馈 4）：修复某些 HTML 文件编辑态空白/异常（预览正常）
8. **既有失败**（反馈 12）：修复导出二级菜单在 mock 下重渲染导致 element detached，恢复 5 个 tauri-mock 用例 + ai-forms 快照面板 + clairis-bug2 导出 ZIP

## Capabilities

### New Capabilities

（无。新增行为均落在既有 capability 的 requirement 内。）

### Modified Capabilities

- `application-shell`：G-7 单格全屏可用性（改：单格 SHALL 显示并可用全屏入口）、G-8 页签拖拽轨迹（加跟手 ghost）、G-10 沉浸收纳与悬浮回显（改：跟随指针格 + 空格兜底 + 无露白）、G-3 单一顶栏（收缩：主题区图标移入状态栏）、新增状态栏
- `navigation`：图标体系（新增 export 族/区分 subtitle↔keyboardHints/暖色/沉浸/pinOff）、阅读空间密度与卡片规格（动作位与顺序、进度与时间位、更名收藏）、悬浮预览窗（宽度收窄 + 底部按钮区重显）、页签条与格头（双击改名）
- `editing`：E-13 全角标点归一（改：转 ASCII 斜杠并触发菜单）、E-17 手柄召唤与滑入菜单（改：滑入即显）、E-10 大纲浮层（改：方形圆角 + 钉住底色）、E-11 块菜单结构（改：颜色观感、缩进图标、对齐）、E-16 HTML 可视化编辑（改：编辑态显示修复）、新增 标题折叠、新增 前进后退恢复、新增 选区工具条
- `reading`：新增 PDF 预览行为（缩放/捏合/页码条位置/卡片缩略图）
- `file-management`：C-4 新建文档（改：默认 .md + 进入栏目页）、C-6 视频预览播放器（改：切文件后页签名同步）

## Impact

- 前端：`src/components/**`（TabBar / ImmersivePeekBar / PaneTreeView / Toolbar / Rail / FloatingPreview / VideoPlayer / Content / Grid）、`src/editors/**`（slash / smart-input / orchestration / decorations / html）、`src/ui/icons.ts`、`src/lib/**`（paneDrop / railCards / railView / previewAnchor / paneHeaderMenu）、`src/stores/index.ts`、`src/App.tsx`、`src/styles/**`
- 依赖：`@embedpdf/react-pdf-viewer`（用其 `onReady`/registry 能力，无版本变更）；PDF 缩略图可能新增 Rust 侧渲染依赖（评估后定）
- 规格：`application-shell` / `navigation` / `editing` / `reading` / `file-management` 主规格将同步 delta
- 测试：新增/扩展 e2e（沉浸/页签/PDF/图标/编辑器/卡片/状态栏/视频/HTML）+ 受影响既有用例同步更新
- 无 BREAKING（对外命令与序列化形状不变）
