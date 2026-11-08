# Tasks: 选区轮盘工具条

> 批准设计：`docs/design/approved/selection-roulette/README.md` §9 建议拆 3 票；本 change 增第 4 票覆盖 HTML 编辑态（用户 2026-11-09 追加）。
> 依赖：第 4 票依赖第 1 票（几何）；第 2、3 票与第 1 票同文件交集，按序开工。
> 跨 change 依赖：本 change 在 `ui-polish-batch8` 的 8.1（HTML 工具条归属）之后开工。

## 1. 轮盘几何与渲染

依赖：无（跨 change：ui-polish-batch8 8.1）

- [x] 1.1 根环 8 扇区、就近扇形、三级原位替换、颜色双圈可交互

  实现要点：
  - 新增 `src/editors/orchestration/roulette.ts`（纯几何/层级/驻留状态机）与 `roulette-view.ts`（portal 渲染）
  - 根环 8 扇区，14px 图标 + 11px 两字标签；圆心=鼠标落点，24px 死区，420×420 夹取
  - 二级/三级每格 15°、环带 92–122px、纯图标 + `title`；三级原位替换、圆心返回
  - 颜色双圈：内 9 文字色（着色 A）/ 外 16 背景色，扇面 16%→34% 淡染
  - 选区稳定 90ms 后出现；离开 240ms 收回；换扇区 300ms/90ms 驻留
  - CSS 只用 `--app-*` / `--type-*` token，三主题可读
  - 测试：新增 `e2e/selection-roulette.spec.ts`——8 扇区、圆心坐标、越界夹取、扇形跨度 ≤136°、三级返回、双圈格数 9/16

## 2. 命令补齐

依赖：1.1

- [x] 2.1 行内代码 / 分栏 / 转换三层 / 复制 / 背景色 / 缩进 / 分割线

  实现要点：
  - 行内代码 `` ` ``、链接、分栏 `::: {.col-N}`、缩进 `::: {.indent-N}`（0–4）、分割线
  - 转换第二层按块类型生成（`convertOptionsFor`）；标题 H1–H6、列表无序/有序/待办、高亮 5 类落 `> [!kind]`
  - 复制（clipboard 失败回退 execCommand）、背景色 15 色 + 恢复默认
  - 删除范围外的 `字号`（已移出工具条）
  - 测试：扩展 `e2e/selection-roulette.spec.ts`——每类写入源码断言（`::: {.col-3}`、`> [!warning]`、`` `code` ``、`# `）

## 3. 四个新功能

依赖：1.1、2.1

- [x] 3.1 格式刷 / 清除格式 / 后退 / 前进

  实现要点：
  - 格式刷：取行内包装 → 新选区自动套用（幂等）+ 计数角标；刷完仍展开；Esc/圆心退出
  - 清除格式：只解包与选区相交节点，保留链接，一次 dispatch；禁止 `parent.normalize()`
  - 后退/前进：CM `undo`/`redo`，与快捷键共用历史；快照在变更后提交
  - 测试：扩展 `e2e/selection-roulette.spec.ts`——格式刷跨两段计数 +1、清格保留 `[text](url)`、`Mod-z` 与后退同一历史

## 4. HTML 编辑态轮盘

依赖：1.1（跨 change：ui-polish-batch8 8.1）

- [x] 4.1 HTML 可视化编辑态工具条改为轮盘

  实现要点：
  - 选中元素后以元素矩形中心为圆心打开同一 `roulette-view`；动作集为 HTML 专属（替换标签 / 样式 / 属性 / 删除 / 截图 / 关闭）
  - 动作继续走 `applyTagReplace` / `applyStylePatch` / `applyAttrPatch` / `applyNodeRemove`
  - 删除 `.html-edit-toolbar` 横向渲染路径；`e2e/html-edit-toolbar*.spec.ts` 改写为轮盘断言
  - 测试：`e2e/html-roulette.spec.ts`——选中元素出轮盘、换标签后 content 同步、工具条不再有横向节点
