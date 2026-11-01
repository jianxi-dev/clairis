# Proposal: MD 编辑内核移植（E1a）

## Why

Clairis 现在只有 5 个装饰器（标题/列表/加粗斜体/引用/代码），要支持表格、分栏、高亮块、图片、链接、分割线与插入入口，继续在现有「整篇重建」结构上叠加会撞墙。md-bundle 的 `@md-bundle/editor` 同构（CM6 装饰式活源码），且已通过移植门槛红线 1–5。移植内核层、编排层在 E1b 重写。

## What Changes

分三批迁移，每批独立可验证：

- **批 1（基础装饰 + 块模型 + 键位）**：`decorations/{heading,list,boldItalic,code,quote}`、`block-model`、`keybindings`、`commands` + 对应单测；替换 Clairis 现有 `buildDecorationSet` 的整篇重建为按扩展装配。
- **批 2（块级装饰）**：`table` / `columns` / `callout` / `image` / `hr` / `link` / `mermaid` / `cell-*` / `callout-emoji` / `theme` + 单测。
- **批 3（插入入口与智能输入）**：`slash` / `slash-filter` / `smart-input` / `icons` / `callout-types` / `color-palette` + 单测；CSS 类名同步落 `src/styles/`。

编排层（block-handle/菜单栈/浮层/色板 UI）不在本 change，归 E1b。

## Capabilities

### New Capabilities

<!-- 无 -->

### Modified Capabilities

- `editing`：扩展 E-5，补齐内核层能力（块级装饰、插入入口、智能输入），并明确红线 1（源码无损）与红线 5（显示=源码）为验收前提。

## Impact

- 代码：`src/editors/decorations/*`、`src/editors/{block-model,slash,smart-input,commands,icons}.ts`、`src/editors/setup.ts` 装配方式。
- 测试：md-bundle 的 949 条单测迁入 `src/__tests__/editor/`（Clairis 只收该目录）；每批补红线 5 断言。
- 风险：高（编辑器内核）。按批迁移，任何一批红线不达标即停。
- 已知缺口登记：表格列宽拖动（产品暂缓）、#470（未复现）、单元格内块级插入（GFM 单行）、图片缩放 e2e（移植后补）、视觉基线仅 darwin。
