# 验收锚点 — reader-presets-v1

锚点来源：issue #1576（spec + `## 输入对账` 确认）、`docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md` §4 B9 与 §6 第四批、一手实现观察（`src/lib/readerWidth.ts:2-4` 480/1400/20、`src/components/SettingsView.tsx:170` 四皮肤、`useConfig.ts` 的 save 链路）。R-1 对应 spec delta 的 DS-9 与 tasks.md 1.1–2.1。

## R-1 阅读预设面（DS-9）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | exact | 无覆盖时有效集合的项数与取值 | 恰 3 项：紧凑 15/960/paper、标准 17/1080/paper、宽屏 19/1280/paper（逐值相等） | B9 / D4 |
| A-1.2 | state-machine | 点选「宽屏」后三项配置 | readerFontSize=19、readerWidth=1280、readerSkin="paper"，且落盘到 user/settings.json | DS-9 场景 2 |
| A-1.3 | exact | 覆盖把「宽屏」改名并把另一项 fontSize 写成 120 后 | 按钮文案「超宽」；fontSize=120 项被过滤，告警恰 1 条含其 id | DS-9 场景 3 |
| A-1.4 | state-machine | `patch_data_surface {"items": null}` 后 | 覆盖文件被删除、有效集合 = 默认 3 项；restore 可回到重置前 | DS-9 场景 4 |
