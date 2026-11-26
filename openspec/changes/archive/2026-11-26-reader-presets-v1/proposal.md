## Why

阅读排版只有三个独立旋钮（字号/正文宽度/阅读皮肤），每次切换都要逐项拨；AI 也只能逐个改字段，无法把「一套阅读状态」保存与复用。设计稿第四批把「阅读预设」列为体验类文件化项（B9），本轮按用户「按建议」确认立项（issue #1576）。

## What Changes

- 新增第五个数据面 `reader-presets`：默认三套预设（紧凑 15px/960/纸墨、标准 17px/1080/纸墨、宽屏 19px/1280/纸墨），`user/reader-presets.json` 可改可增。
- 设置 → 预览 → 新增「阅读预设」一行：点选即应用三项配置并落盘。
- 新形状 `ReaderPreset { id, label, fontSize, width, skin }`，list 型整体替换；越界值过滤并聚合告警。
- AI 三个工具自动可用（注册表驱动），`SKILL_MAP` 增补一行。

## Capabilities

### New Capabilities

- `data-surfaces`：新增 DS-9 阅读预设面（默认源、覆盖合并、校验、消费端、热应用）。

### Modified Capabilities

（无）

## Impact

- 代码：`src-tauri/src/surfaces.rs`（形状 + 校验 + 登记）、`resources/reader-presets.default.json`、`src/lib/dataSurfaces/{loader,store}.ts`、`src/components/SettingsView.tsx`（预设行）、`src-tauri/src/config.rs`（SKILL_MAP 一行）。
- 数据：`defaults/surfaces/reader-presets.json`（物化）、`user/reader-presets.json`（覆盖）。
- 测试：Rust 面级用例、前端契约（应用预设）、e2e（点选生效 + 改名生效）。
- 兼容：既有阅读三项配置与设置项行为不变。
