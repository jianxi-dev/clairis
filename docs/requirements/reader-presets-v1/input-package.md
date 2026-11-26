# 需求输入包 — reader-presets-v1

## 来源可追溯

issue #1576（spec + `## 输入对账`）；设计稿 `docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md` §4 B9、§6 第四批；用户 2026-11-26「按建议」确认。

## 空白显式化

- 无 `open-question`：默认套数/取值由对账表 ★ 默认给出并经确认。
- 未定义：预设「当前选中」高亮（明确 Non-Goal）。

## 一手证据

- 宽度边界与步长：`src/lib/readerWidth.ts:2-4`（480 / 1400 / 20）。
- 皮肤四值：`src/components/SettingsView.tsx:170`（paper/indigo/moss/clay）。
- 应用落盘链路：`src/hooks/useConfig.ts` 的 `saveAppConfig`（P1 已修保存环）。

## 冲突显式

- 与 design 02 §4 B9 无冲突；B9 未规定默认套数与数值，本 change 取三套（见对账 #1）。
- 皮肤不进默认差异（三套均 paper）——避免预设一上手就改观感，记为 D4 理由。

## 验收锚点

见 `openspec/changes/reader-presets-v1/anchors.md`：A-1.1…A-1.4（exact / state-machine）。

## 默认裁决

- 越界值：过滤整条预设并聚合告警（非钳制）。
- 不做选中态。
