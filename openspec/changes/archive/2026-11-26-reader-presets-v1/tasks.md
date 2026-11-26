# Tasks

## 1. 阅读预设面与设置页应用

- [x] 1.1 阅读预设面全链：`src-tauri/src/resources/reader-presets.default.json`（紧凑 15/960/paper、标准 17/1080/paper、宽屏 19/1280/paper）+ `SurfaceShape::ReaderPreset` 与校验器（字号 8–96、宽度 480–1400 步长 20、皮肤 paper|indigo|moss|clay；非法项过滤并聚合告警）+ 注册表登记；前端 loader 归一化 + store `getReaderPresets()`；设置 → 预览新增「阅读预设」行（`data-testid="reader-preset-<id>"`，点选调用 `setConfig({readerFontSize,readerWidth,readerSkin})` + `saveAppConfig()`）；面级热应用。**用户可见结果**：设置里出现三个预设按钮，点「宽屏」阅读区立刻变宽变大；改 `user/reader-presets.json` 的 label/值 1 秒内反映到按钮与点击效果。**数据面**: 存储,校验,桥接,消费,回滚

## 2. AI 通路与文档

- [x] 2.1 AI 与文档：确认 `read_data_surface` / `patch_data_surface` / `restore_surface_snapshot` 对 `reader-presets` 自动可用（注册表驱动）并补 Rust 用例（读三面 / 改预设定义 / `{"items":null}` 恢复默认且可回滚）；`SKILL_MAP` 增补 reader-presets 行与示例；`docs/agents/data-surface.md` 的面清单补一行。**用户可见结果**：对 AI 说「把宽屏再放宽到 1320」→ 预设值变化，设置里点「宽屏」生效；说「预设恢复默认」→ 回到三套默认。**数据面**: 校验,规格
