# Design: 产品文档重定位

## D1 权威层级不变

`active change delta > openspec/specs > ADR/architecture > approved design > product direction > research`。本次只改第 4/5 层（approved design、product direction），不动 specs 与 ADR 的既有条目；新增 ADR 走第 3 层。

## D2 逐文件口径（规格包 §八）

| 文件 | 改法 |
|---|---|
| `docs/product/vision.md` | 重写：定位一句话 + 三支柱 + 不做什么 |
| `docs/product/principles.md` | 标题改 **Doctrine**；序言 + D1–D10 表 + 「不为谁做」五条 |
| `docs/product/scope.md` | §2.2 换成「可折叠阅读空间」；新增「内容生成 / HTML 编辑」边界节 |
| `docs/product/users.md` | 保留人群描述，补零门槛 |
| `docs/delivery/roadmap.md` | 四阶段表替换旧里程碑 |
| `CONTEXT.md` | 追加术语行，不删既有术语 |

## D3 新 ADR

四个 ADR 均按 `docs/architecture/decisions/README.md` 的既有格式写（编号顺延、状态 accepted、决策/背景/后果）。内容来源：规格包 §三/§四/§五 与 #29/#30/#27/#31 决议。

## D4 布局规格入 approved

把 `.omo/wayfinder/layout-portal-spec.md` v1.0 正文落到 `docs/design/approved/layout-portal/spec.md`，补 frontmatter（type: design、status: approved、source_of_truth: canonical），保留原章节编号与 12 条验收。

## D5 冲突处理

旧文档与新定位冲突处（如「无侧栏」）以新裁定为准并删除旧表述，不保留「曾经如此」的双口径；历史记录由 `docs/archive/` 与 ADR 承担。

## D6 不做

不改 `openspec/specs/` 的功能行为、不改代码、不重命名历史文件、不新增教程类文档。
