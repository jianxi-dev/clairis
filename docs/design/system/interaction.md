---
title: "标月交互条款"
type: design
status: accepted
last_updated: 2026-11-28
source_of_truth: supporting
---

# 标月交互条款

> 本文件是**交互行为的唯一来源**，与 [spec.md](./spec.md)（视觉数值）分工：spec 定「长什么样」，本文件定「怎么响应」。四条条款各带守护指针，守护红则修。
> 条款来源：`openspec/changes/ui-quality-gate-v1/design.md` D5、`openspec/changes/ui-quality-gate-v1/specs/ui-quality/spec.md` UQ-2、验收锚点 `anchors.md` R-2。

## 1. 零横线

**定义**：UI 分隔用间距或背景色差，不画 1px 横线。例外仅两类：菜单分组线与表格边框，且颜色取 `--app-border`。

**正例**：页签条与正文之间用 `--app-sunken` 背景带分隔；菜单项之间用 `py-1` 间距；卡片之间用 `--space-*` 间距。

**反例**：`border-top: 1px solid var(--app-border)` 用于工具条与内容的分隔；`border-bottom: 1px` 用于列表行分隔（应改背景或间距）。

**守护指针**：`node scripts/check-interaction.mjs --only=hairlines`（存量 19 条进 `scripts/interaction-baseline.json`，只减不增；新增退 1）。

## 2. 反馈三档

**定义**：用户操作反馈分三档——静默（状态自明，无需提示）/ 轻提示（toast，`role="status"`）/ 需确认（dialog，二次确认卡）。SHALL NOT 使用 `window.alert` / `window.confirm` / `window.prompt`。

**正例**：复制成功 → toast「已复制」；删除字段 → 二次确认卡；主题切换 → 静默生效。

**反例**：`window.prompt("链接地址")` 索取 URL；`window.confirm("确定删除？")` 作删除确认；`window.alert("已保存")` 报成功。

**守护指针**：`node scripts/check-interaction.mjs --only=dialogs`（3 处存量 `window.prompt` 进基线，新增零容忍；迁移留 Q2 dialog 之后）。

## 3. 禁用而非隐藏

**定义**：条件不满足时控件 SHALL 保留可见 + `disabled` + 原因提示（`title` 或可见说明）。SHALL NOT 直接隐藏控件——隐藏让用户找不到功能，禁用让用户知道功能存在但暂不可用。

**正例**：页签无路径时，「导出 / 移动 / 复制路径」保留可见且 `disabled`，`title` 写「此页签尚未保存，无路径可用」；AI 输入为空时「发送」按钮保留可见且 `disabled`，`title` 写「先输入要 AI 做什么」。

**反例**：无路径时菜单里直接不渲染「导出」项；未选中时工具条按钮 `display:none`；禁用无 `title`，用户不知道为何点不动。

**守护指针**：`e2e/interaction-guards.spec.ts` 三条用例（无路径导出项 / 无路径定位项 / 空输入 AI 发送按钮）。

## 4. Esc 只退场

**定义**：Esc 只关闭最上层浮层，SHALL NOT 触发保存 / 删除 / 提交。逐层关闭后文档内容不变（无副作用）。

**正例**：快捷键总览开着时按 Esc → 只关总览，设置场景仍在；AI 待确认卡按 Esc → 取消待确认，浮层与文档均不变；全屏按 Esc → 退出全屏，文档内容不变。

**反例**：Esc 关闭浮层时顺带保存草稿；Esc 退出全屏时丢弃未保存改动；Esc 触发删除确认的确认。

**守护指针**：`e2e/interaction-guards.spec.ts` 逐层用例（快捷键帮助 → AI 待确认 → AI 窗口 → 临时显现 → 全屏 → 阅读态，每层只关最上层，全部关闭后编辑器内容严格相等）。

**平台边界**：原生窗口全屏的退出由 macOS 的系统级 Esc 绑定完成，不属于应用层。窗口全屏下按 Esc，应用层 SHALL 仍先关闭最上层浮层，且 SHALL NOT 因窗口退出全屏触发保存 / 删除；用户看到「浮层关闭 + 窗口一起还原」是浮层先关、系统随后退出全屏，不作为本条款的失败判据。该边界不适用于应用内窗格全屏（`fullscreenPaneId`），后者仍由应用层 Esc 关闭。

## 变更方式

| 变更性质 | 方式 |
|---|---|
| 条款措辞 / 守护阈值 | supersede：新建本文件新版，旧版标 `status: superseded` + `superseded_by` |
| 新增条款 | 追加一节 + 守护指针，同步 `openspec/changes/ui-quality-gate-v1` 的 spec delta 与锚点 |
| 守护脚本实现细节 | 直接改 `scripts/check-interaction.mjs`，不改条款 |
