## ADDED Requirements

### Requirement: 预览分栏渲染

预览态 SHALL 把 `::: {.col-N}`（兼容 `cols=N`）围栏渲染为 N 栏布局（N=1..6），输出 `.layout-col-N` 容器，栏数与顺序 SHALL 与编辑态一致。不支持的属性和不含 `col` 的 `:::` 围栏 SHALL 保持原样，SHALL NOT 吞掉内容。窄视口下多栏 SHALL 折叠为单列。

#### Scenario: 分栏渲染为多栏

- **WHEN** 用户打开含 `::: {.col-2}` … `:::` 的文档并进入预览态
- **THEN** `.preview-content .layout-col-2` 节点数 SHALL 为 1，可见文本含 `:::` 次数 SHALL 为 0，两栏子项的水平坐标差 SHALL 大于 0

#### Scenario: 无 col 围栏保持原样

- **WHEN** 文档含 `::: {.align-left}` 或普通 `:::` 围栏
- **THEN** 预览态 SHALL 按既有规则处理，SHALL NOT 生成 `.layout-col-*` 容器

## MODIFIED Requirements

### Requirement: PDF 按钮栏固定显隐

PDF 顶部按钮栏 SHALL 支持固定显示与固定隐藏两种状态，并 SHALL 提供对应快捷键；该状态 SHALL 只影响当前 PDF 视图，SHALL NOT 改写文档。快捷键 SHALL 在 PDF 视图内部（shadow DOM 焦点）也生效，SHALL 在 document capture 阶段处理并 `preventDefault`；快捷键条目 SHALL 在快捷键总览中可见。

#### Scenario: 固定隐藏与快捷键恢复

- **WHEN** 用户对 PDF 执行固定隐藏，再按快捷键
- **THEN** 按钮栏计算 display 为 none，快捷键切换后可见；切换文档后恢复默认且无残留（A-8.1–A-8.2）

#### Scenario: 视图内部快捷键生效

- **WHEN** 用户把焦点放进 PDF 视图的 shadow DOM 控件后按 `⌘⇧D`
- **THEN** 宿主 class 含 `pdf-chrome-pinned-hidden`；再按一次后不含；快捷键总览中 `mode-pdf-toolbar-pin` 行数 SHALL 为 1

### Requirement: 嵌入视频显示与播放

Markdown 预览/编辑态与 HTML 预览中嵌入的视频 SHALL 正常显示并可播放；内嵌播放控件的音量与进度滑块 SHALL 可见且可拖动，SHALL NOT 被白色色块覆盖。

#### Scenario: 两处视频可播放

- **WHEN** 用户打开含视频链接的 Markdown 与 HTML 文档
- **THEN** 两处 `video` 节点数 SHALL 各为 1，`controls` SHALL 为 `true`，播放后 `currentTime` SHALL 大于 0

#### Scenario: 滑块可见

- **WHEN** 用户查看内嵌视频控件
- **THEN** 音量滑块 thumb 的宽度 SHALL 大于 0，且与轨道颜色有可见对比
