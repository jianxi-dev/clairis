# Proposal: 选区轮盘工具条（Selection Roulette）

## Why

编辑态选中文字后出现的横向 12 项工具条有两个结构性问题：项数再增就压住正文一整行，且每次找项都要从左到右重扫一遍。批准设计 `docs/design/approved/selection-roulette/README.md`（2026-11-08 五轮评审通过）把它改为以鼠标落点为圆心的径向轮盘：根环 8 扇区，子级只在父扇区方向就近展开，颜色为双圈，历史与剪贴板进入轮盘。

用户 2026-11-09 追加：轮盘 SHALL 同时覆盖 **markdown 编辑态**与 **HTML 编辑态**的文字选择工具条，不留横向双轨。

## What Changes

1. **轮盘几何与渲染**（`editors/orchestration/roulette.ts` + CSS）
   - 根环 8 扇区（智能 / 转换 / 对齐 / 分栏 / 历史 / 清格 / 格式 / 颜色），14px 图标 + 11px 两字标签
   - 圆心 = 鼠标落点，24px 死区，420×420 包围盒夹进视口
   - 二级/三级只放图标，每格 15°，环带 92–122px，就近展开不绕整圈；三级原位替换、圆心变返回
   - 颜色双圈：内圈文字色 9 格（着色字母 A）、外圈背景色 16 格
2. **命令补齐**
   - 行内代码、分栏 1–5（各画栏数图标）、转换三层（段落/标题/列表/高亮/引用/代码块/表格/分割线）、复制、背景色与恢复默认、缩进/减少缩进、清除格式
3. **四个新功能**
   - 格式刷（圆心，跨选区幂等，计数角标）、清除格式（保留链接）、后退/前进（与 `Mod-z` / `Mod-Shift-z` 共用 CodeMirror 历史）
4. **HTML 编辑态轮盘**
   - HTML 可视化编辑态的元素工具条（E-19）改用同一轮盘几何与交互；扇区承载 HTML 专属动作（替换标签 / 样式 / 属性 / 删除 / 截图），不另造第二套几何
5. **单轨切换**
   - 删除 `.cm-floating-toolbar` 横向实现的渲染路径；`e2e/floating-toolbar.spec.ts` 同步改写为轮盘断言，不留双轨

## Capabilities

### New Capabilities

（无。全部落入 `editing`。）

### Modified Capabilities

- `editing`：选区浮动工具条（改：横向条 → 径向轮盘，8 根扇区 + 就近扇形 + 双圈颜色 + 格式刷/清除格式/后退/前进）、E-19 HTML 可视化编辑工具条（改：几何改用轮盘）

## Impact

- 代码：新增 `src/editors/orchestration/roulette.ts`（几何/命中/层级状态）与 `roulette.css`（或并入 `editor.css`）；改写 `floating-toolbar.ts` 的渲染入口；`HtmlVisualEditor.tsx` / `HtmlEditToolbar.tsx` 接入；`editors/orchestration/block-*` 的命令实现复用
- 测试：`e2e/floating-toolbar.spec.ts` 改写；新增 `e2e/selection-roulette.spec.ts`（几何、扇区、三级、颜色双圈、格式刷、清除格式、历史）与 `e2e/html-roulette.spec.ts`
- 风险：工具条是编辑主链路，需逐项回归格式写入与撤销；无数据迁移，回滚为 revert
