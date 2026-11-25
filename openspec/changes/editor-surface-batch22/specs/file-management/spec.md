## MODIFIED Requirements

### Requirement: 导出菜单顺序与 PDF 导出

系统 SHALL 按 word、mdpkg、图片、pdf、html、zip 的顺序渲染导出菜单，并提供 PDF 导出（复用 md-bundle 能力）。

页签右键「导出」子菜单 SHALL 默认向**右**展开；当子菜单右缘触及视口右边界时 SHALL 翻转向左展开，SHALL NOT 被窗口裁切。翻转判据 SHALL 复用既有浮层裁剪逻辑，SHALL NOT 新写一套。

#### Scenario: 菜单顺序与 PDF

- **WHEN** 用户打开导出菜单并点击 PDF
- **THEN** 菜单文本序列与约定一致，PDF 文件生成或给出可读错误（A-10.1–A-10.2）

#### Scenario: 子菜单默认右开

- **WHEN** 用户在页签右键菜单点击「导出」
- **THEN** 子菜单 SHALL 出现在导出项的右侧

#### Scenario: 触右边界翻左

- **WHEN** 用户把窗口收窄到子菜单右侧空间不足后点击「导出」
- **THEN** 子菜单 SHALL 出现在导出项的左侧，完整可见，右缘越出视口像素为 0
