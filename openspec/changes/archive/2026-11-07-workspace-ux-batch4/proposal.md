# Proposal: 工作区交互第四批修正

## Why

用户在 2026-11-07 一次性反馈 12 项工作区交互问题。代码复现后确认其中多数是确定性缺陷，而非手感偏好：

- `pane` / `branch` id 是模块级自增计数器，重启后与持久化布局里的旧 id 撞车；`setBranchRatio` 会更新所有同 id 分支 → 拖一个分隔线牵连其他并行栏目。
- 同一 id 撞车还会生成重复 leaf id，React key 与 `data-pane-id` 冲突 → 落点命中错误格、关闭页签命中错误格、看起来像「复制栏目」。
- 页签拖拽、格拖拽、悬浮窗拖拽都没有 pointer capture；指针进入正文 iframe 后父窗口收不到 pointermove/pointerup → 轨迹不显示、松手不生效、拖动冻结。
- 页签右键分栏只切页签再建空栏，没有搬文件。
- 沉浸模式只改透明度不改高度；顶部热区仅 2px。
- 预览态下 CodeMirror 仍全文解析 HTML，且 iframe 加载期无任何反馈。

## What Changes

1. **分栏布局与页签拖拽正确性**（反馈 4 / 5 / 7 / 10）
   - id 生成改为跨重启唯一（`crypto.randomUUID` 派生），恢复布局不再与新生 id 撞车
   - `setBranchRatio` 只更新首个匹配分支；分隔线加 `shrink-0` 与 pointer capture
   - 页签拖拽加 pointer capture、4px 插入轨迹、目标格落区环、`pointercancel` 收尾
   - 页签右键「向右/向下分栏」= 新建格 + 搬入当前页签；栏目「更多」分栏保持空栏
   - `dropFileOnPane`：文件已打开时不复制栏目、不留下空源格
2. **页签视觉与沉浸收纳**（反馈 8 / 9 / 11）
   - 未选中页签透明、无胶囊，悬停出胶囊；页签条容器透明；栏目头与顶栏统一底色
   - 沉浸模式顶栏与页签条收拢到高度 0；顶部热区 16px；悬浮页签条回显
3. **阅读表面宽度**（反馈 3 / 6）
   - 左侧栏悬浮与钉住两态都可拖宽并持久化
   - 设置新增 480–2400px 行宽滑块，保留三档预设
4. **卡片与悬浮窗**（反馈 1 / 12）
   - PDF 类型的网格/阅读空间卡片不显示悬停工具条
   - 悬浮窗标题栏与缩放手柄加 pointer capture
5. **HTML 打开性能**（反馈 2）
   - 预览态不同步整篇 HTML 进隐藏编辑器
   - iframe 加载期显示骨架；用 50KB 真实文件测量首屏时间

## Capabilities

### New Requirements

- **G-8** 页签拖拽轨迹与落点反馈
- **G-9** 页签与栏目视觉贴合主题
- **G-10** 沉浸模式顶栏收纳与悬浮回显
- **G-11** 文件卡片工具条按类型收敛
- **G-12** 分栏语义与分隔线独立性
- **A-15** 阅读空间宽度可调
- **A-16** 正文行宽连续可调
- **A-17** HTML 预览首屏不阻塞

### Modified Requirements

无。既有 G-5 / G-6 与新增条目语义兼容（G-6 的「活跃页签胶囊」保持；G-5 的「hover 暗示 + 独立 TabBar」保持）。

## Impact

- 前端：`src/components/TabBar.tsx`、`src/components/Content/{PaneTreeView,PaneDivider,ContentArea,HtmlPreview}.tsx`、`src/components/Preview/FloatingPreview.tsx`、`src/components/Grid/GridTile.tsx`、`src/components/Rail/ReadingRail.tsx`、`src/components/SettingsView.tsx`、`src/App.tsx`、`src/hooks/{useDragResize,usePaneDragController}.ts`、`src/lib/paneTree.ts`、`src/stores/index.ts`、`src/styles/editor.css`
- 规格：`openspec/specs/application-shell/spec.md`（G-8…G-12）、`openspec/specs/reading/spec.md`（A-15…A-17）
- 测试：`src/__tests__/{paneTreeStore,paneDrop,components}`、`e2e/{pane-drag,pane-tree,pane-header,floating-preview,grid-overview,settings-reading}.spec.ts`

## Non-goals

- 不重写递归 pane 树模型，不引入第三方拖拽库。
- 不改 Rust 命令与文件读写路径。
- 不做字符级富文本选区、不做 PDF 内嵌工具栏定制。
- 不改变「每格独立页签条」的信息架构。
- 不改写 HTML 文档自身的 CDN 依赖。
