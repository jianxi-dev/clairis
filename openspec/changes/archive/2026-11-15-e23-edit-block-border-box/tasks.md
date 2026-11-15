# 任务 — e23-edit-block-border-box

> 纯规格文档 change：修正 E-23 块宽度统一与已落地实现矛盾的口径。

- [x] 1.1 改写 E-23「块宽度统一」主规格口径
  - 预览态引用块文字列宽度仍与正文段落相同
  - 编辑态引用块 / 围栏代码块改为边框盒与正文行盒等宽、左右边界对齐，文字列允许收窄
  - 两个编辑态 Scenario 改为边框盒左右边界 x 差 = 0px
  - **数据面**: 无（纯规格，无配置字段 / 主题 / 图标 / 菜单 / 轮盘 / 开关改动）

- [ ] 2.1 `openspec validate e23-edit-block-border-box --strict` 通过
- [ ] 2.2 `openspec archive e23-edit-block-border-box -y` 归档并替换主规格
- [ ] 2.3 `openspec validate --all --strict` 全绿
- [ ] 3.1 提交 docs PR（关联 issue）
