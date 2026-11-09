# Proposal: 选区轮盘工具条重制（selection-roulette v2）

## Why

批准设计 `docs/design/approved/selection-roulette/README.md` 在 2026-11-09 经历了第七至第九轮修订：三层改画在二层外环、删除圆心死区、展开后一二层降到 70%、转换与格式顺序重排。现有实现（`src/editors/orchestration/roulette.ts` / `roulette-view.ts`）仍按前五轮口径：

- 根环半径 150px、扇区是 46px 圆钮，而批准稿是 **30–86px 的扇形**；
- 三级用「原位替换第二层」，而批准稿是 **126–152px 外环、二层保留在 70%**；
- 保留 24px 圆心死区，而批准稿已明确删除；
- 标题只有 H1–H4（缺 H5/H6），高亮只有 4 类（缺「注意」），转换与格式顺序、图标均与批准稿不符。

用户 2026-11-10 真机复核追加四条：

1. 严格按原型参数，原型标注不全的地方由实现**补齐全部标注类型**（H1–H6、五类高亮）。
2. HTML 不适合轮盘：HTML 源码编辑态去除轮盘，改用横条；可视化编辑态保持横条。
3. HTML 可视化拖拽只拖动虚框、虚框还跳来跳去，需改成元素跟随、落点稳定。
4. 选中文字时可通过横条按钮调整文字状态（HTML 两个编辑态都保留文字格式能力）。

维护者已裁决（2026-11-09，见 `HANDOFF.md` §7.5）：编辑态停用选区胶囊，AI 三动作归轮盘；阅读态保留胶囊。E-18 走 delta 改写。

## What Changes

1. **轮盘几何重写（SVG 扇形）**
   - 根环 30–86px，8 个 45° 扇区（缝隙 0.35°），图标 14px + 11px 两字标签落在半径 60px；
   - 二层 92–122px、三层 126–152px，每格固定 15°、只放图标，项少不摊开；
   - 颜色双圈：内圈 90–106px（文字色 9 段、平切字母 A）、外圈 111–127px（背景色 16 段）；
   - 展开下级后根环与二层不透明度 0.7，三层满值。
2. **交互与时序**
   - 圆心 = 鼠标落点（键盘选区取末端 client rect），420×420 包围盒夹进视口；
   - 按住拖选期间不出现，松手 90ms 后出现；删除 24px 圆心死区；
   - 只有点击根扇区才展开、再点同一扇区收回；离开整只轮盘 400ms 收回下级；
   - `Esc` 逐层后退；数字键 1–8 直达扇区；滚轮/方向键移动高亮、`Enter` 执行；
   - `Ctrl+F` / `⌘F` 打开独立筛选面板，输入过程中不重建输入框。
3. **命令与标注补齐**
   - 转换二层动态：段落 7 项（代码块 / 表格 / 标题 › / 列表 › / 高亮 › / 引用 / 分割线），光标已在标题时多「正文」；
   - 标题三层 H1–H6；列表三层 无序/有序/待办；高亮三层 **提示 / 信息 / 注意 / 警告 / 危险**，落 `> [!tip|info|note|warning|danger]`；
   - 格式二层顺序：链接 / 下划线 / 斜体 / 加粗 / 行内代码 / 删除线；
   - 对齐 5 项（左/中/右 + 增/减缩进）使用语义图标；分栏 1–5 各画栏数图标；历史 4 项（后退/前进/复制/删除）。
4. **HTML 编辑态分工**
   - HTML 源码编辑态（CM6）使用横向文字工具条，不再出现轮盘；横条可调整粗体/斜体/下划线/删除线/链接/字色等状态；
   - HTML 可视化编辑态保持现有横向工具条，不引入轮盘。
5. **HTML 可视化拖拽修复**
   - 拖拽越过 4px 后显示跟随指针的元素幽灵，原元素降透明度；
   - 落点指示带滞回，不再在相邻元素间来回跳；拒绝拖进自身子树。
6. **E-18 改写**
   - 编辑态不再渲染选区胶囊，AI 三动作由轮盘「智能」扇区承载；阅读态胶囊行为不变。

## Capabilities

### New Capabilities

（无。全部落入 `editing`。）

### Modified Capabilities

- `editing`：E-18 正文选区胶囊（编辑态停用、阅读态保留）、选区浮动工具条（几何/时序/命令全面对齐批准稿）、E-19 HTML 可视化编辑工具条（源码编辑态改横条、可视化态保持横条）、E-20 HTML 拖拽（跟随幽灵与稳定落点）。

## Impact

- 代码：`src/editors/orchestration/roulette.ts`、`roulette-view.ts`、`floating-toolbar.ts`、`src/styles/editor.css`、`src/editors/html/runtime.ts`、`src/editors/setup.ts`、`src/components/Content/ContentArea.tsx`、`src/lib/selectionPillMode.ts`
- 测试：新增 `src/__tests__/editor/roulette.test.ts`；改写 `e2e/floating-toolbar.spec.ts`、`e2e/html-source-roulette.spec.ts`、`e2e/html-text-roulette.spec.ts`、`e2e/html-edit-drag-capture.spec.ts`；`src/__tests__/selectionPillMode.test.ts` 与 `e2e/selection-pill.spec.ts` 的编辑态断言反转
- 风险：工具条是编辑主链路，需逐项回归格式写入、撤销与三主题；无数据迁移，回滚为 revert
