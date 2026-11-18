# 任务 — document-properties-inline

> 切片原则（QG-7）：每张票做完用户能在界面上看到变化；1 任务 = 1 票 = 1 PR。
> **Blocked by 语义**：硬边，未解除不得开工。两票分两处用户可见面：1.1 选选择模型，2.1 选托管日期 + AB 形态（依赖 1.1 的按钮文案与选中集语义，2.1 的日期与形态在 1.1 选择模型落定后再接，避免同区域叠加改）。

## 依赖与阻塞总览

- 1.1 无阻塞，先落选择模型。
- 2.1 Blocked by 1.1（日期只读区与 AB 切换按钮同改标题栏 / footer 区域，选择模型的按钮文案与选中集语义先定，再接日期与形态，避免同区域叠加改）。

## 1. 选择模型：字段名 + 标签（A-1.x）

- [x] 1.1 [change=document-properties-inline/1.1] 选择模型改为字段名 + 标签，按钮随选中数二态切换，反选反转选择集
  - 用户做完后能：面板里什么都不选时按钮显示「全选」，选中任意一个字段名或标签后按钮立刻变成「反选」；点「反选」把已选的取消、未选的选上；选中高亮落在字段名与标签上，值不被圈进选中。
  - 可选中单位限定为字段名称与标签两类节点，值文本节点不参与选中；标签行纳入可选中集合
  - 按钮文案随选中数二态切换：0 个选中显示「全选」，≥1 个选中显示「反选」，`title` 同步；「反选」为反转当前选择集（已选取消、未选选上），标题位不进入全选
  - 选中高亮落在字段名与标签上，值文本节点 SHALL NOT 被圈入选中范围；标签行反选时同样被反转
  - e2e：选中 1 个字段名即显示「反选」；选中部分后点「反选」选择集变补集；标签行可选中、反选时被取消；值文本节点无选中高亮
  - 涉及文件：`src/components/Content/DocPropertyBar.tsx`、`e2e/`（doc-property 选择断言）
  - 验收点：选中任意一个即「反选」；反选反转选择集；标签参与选择；值不进入选中
  - **ui-surface**: 是
  - QG-3 接线：选择模型为组件内状态逻辑，无新导出 API；`allSelectableSelected` 判据改为可选中节点已选数，本票直接接线，无后续票接力
  - **数据面**: 无
  - **验收锚点**: A-1.1、A-1.2、A-1.3、A-1.4、A-1.5

## 2. 托管日期 + AB 形态（A-2.x）

- [x] 2.1 [change=document-properties-inline/2.1] 托管日期只读展示（A footer 左 / B 备注行右）+ AB 形态切换与窄窗自适应
  - 用户做完后能：列表模式底部 footer 左侧看到「创建 2026-11-17 · 修改 2026-11-17」带锁图标点不动，胶囊模式备注行右侧看到同样两个日期；标题栏右侧点 AB 图标切换列表 / 胶囊，重开应用仍是上次形态；窗口变窄自动用胶囊，手动切过后以用户为准。
  - 用 `isManagedDateKey` 把 `created` / `updated` 从可编辑字段列表排除，不作为字段行渲染，字段计数不含日期
  - 托管日期以只读形式展示：A 一行条模式在底部 footer 左侧（与「N 个字段」同行）、B 精排双列模式在备注行右侧，带锁图标、无输入框，值取自 frontmatter，缺失时不渲染空壳
  - 标题栏右侧按钮区新增 AB 切换图标（与模板 / 折叠 / 设置同组），点击切换 A / B，写入全局偏好 `docPropertyVariant` 并持久化；窄窗（宽度 < 720px）默认胶囊，用户手动切换后以用户选择为准
  - e2e：A 模式 footer 左侧出现两日期且只读（无输入框、不可编辑）；B 模式备注行右侧出现；字段计数不含日期；点 AB 图标切换并持久化（重载保持）；700px 自动胶囊、1200px 回到用户选择
  - 涉及文件：`src/components/Content/DocPropertyBar.tsx`、`src/lib/frontmatter.ts`（`isManagedDateKey` 过滤辅助接线）、`src/stores/docPropertyPanel.ts`（`docPropertyVariant` 偏好持久化）、`src/styles/`（footer 日期、AB 图标、窄窗形态）、`docs/design/system/spec.md`（§2.3 AB 图标、§7 footer / 图标密度）、`docs/design/system/decisions.md`、`e2e/`
  - 验收点：A footer 左 / B 备注行右只读日期；字段计数不含日期；AB 图标切换持久化；窄窗自动胶囊、手动优先
  - **ui-surface**: 是
  - QG-3 接线：`docPropertyVariant` 偏好由本票在 `src/stores/docPropertyPanel.ts` 落存储、`src/hooks/useConfig.ts` 接桥、`DocPropertyBar.tsx` 消费；AB 图标先补 `docs/design/system/spec.md` §2.3 再进 `src/ui/icons.ts` 注册（本票即为接线票，无后续票接力）
  - **数据面**: 规格,存储,校验,桥接,消费,回滚
  - **验收锚点**: A-2.1、A-2.2、A-2.3、A-2.4、A-2.5、A-2.6

## Open Questions

- 无。#1127 已明确选择单位为字段名称（不含值）、标签也要能选、日期位置按设计稿 A 底部 / B 备注行右，D3 经维护者确认（2026-11-18 夜）采用「全局常驻 + 窄窗自动胶囊」。
