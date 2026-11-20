# Tasks

## 1. 文档属性域

- [ ] 1.1 **折叠态嵌入 + 多窗格宿主修复**（含缺陷：分栏不渲染）
  - embedActive 放宽至折叠态；折叠条经同一 replace widget 呈现；移除 fmh-summary 折叠分支；编辑态固定宿主仅无 frontmatter
  - 删除模块级宿主交接，ContentArea 按本窗格 editor DOM 自查宿主；双窗格 e2e 两格各渲染 1
  - 验收：折叠条随正文滚动、正文无虚线标签、⌘⇧Y 恢复 YAML、分栏两格都显示

- [ ] 1.2 **块下间距 + 预览列对齐**（含缺陷：预览不同轴）
  - margin 提供间距（SHALL NOT 依赖空行）；预览块 padding-inline 与正文列同源
  - 验收：块与标题间距 ≈ 1 行高；删空行不影响；预览卡与段落同轴

- [ ] 1.3 **L/T 图标换形**
  - icons.ts `docPropertyVariant` 图形重绘（三不等长横线 / 双竖栏矩形）+ decisions.md 台账一行
  - 验收：两态图形可区分、切换功能不变

- [ ] 1.4 **拖拽插入位置修复**（缺陷：中位拖入插到末尾）
  - 根因定位（插入索引换算 / A 网格落点）后修；e2e 断言中位插入后行序

## 2. 视频与页签域

- [ ] 2.1 **视频控制条按上下文显隐**
  - VideoPlayer `embedded` prop；fullscreen/width 两按钮仅嵌入时注册；独立页签移除两图标（快捷键不变）
  - batch20 delta C-6 增补（协同修订，不归档）；video-controls 用例改嵌入上下文断言
  - 验收：独立播放无两图标、嵌入播放保留

- [ ] 2.2 **页签最大宽度**
  - `--tab-max-width` token（= --tab-info-width）+ §7.5 条款；TabBar 不伸展 + 保底 min(96, max-content)；#1180 冲突断言更新
  - 验收：单页签不顶满、短名实际宽、多页签等比收缩保留、尾部空白拖窗不变

- [ ] 2.3 **标题字段同步修复**（缺陷）
  - 根因排查（renameTab 触达路径 / title 键识别）后修；e2e：重命名页签 → 面板 title 同步

## 3. 收口

- [ ] 3.1 **回归与归档**
  - verify.sh 全绿；validate --strict；归档 change、主规格同步、requirements-status 登记行
