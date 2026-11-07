## ADDED Requirements

### Requirement: A-15 阅读空间宽度可调

阅读空间（左侧栏）SHALL 在「钉住」与「悬浮」两种可见状态下都提供 4px 宽的垂直拖拽手柄；宽度 SHALL 钳制在 200–360px；松手后宽度 SHALL 持久化到视图配置，并在下次启动时恢复。折叠态 SHALL 仅保留 12px 边缘触发条，不渲染拖拽手柄。

#### Scenario: 悬浮态可拖宽

- **WHEN** 阅读空间处于悬浮（未钉住）状态，用户拖动其右缘手柄
- **THEN** 阅读空间宽度 SHALL 随指针变化，且 SHALL 保持在 200–360px

#### Scenario: 宽度持久化

- **WHEN** 用户把宽度拖到 300px 后重启应用
- **THEN** 阅读空间宽度 SHALL 恢复为 300px

### Requirement: A-16 正文行宽连续可调

设置「阅读空间」区 SHALL 提供连续行宽滑块：范围 480–2400px、步长 20px，并实时显示当前像素值；拖动滑块 SHALL 写入 `config.readerWidth` 并即时更新正文 `--type-measure`。既有 720 / 1080 / 1200 三档预设 SHALL 保留为快捷按钮，点击后滑块 SHALL 同步到对应值。

#### Scenario: 滑块改变正文行宽

- **WHEN** 用户在设置中把行宽滑块从 1080 拖到 1400
- **THEN** 正文容器的 `--type-measure` SHALL 为 `1400px`，且设置中显示的当前值 SHALL 为 1400

#### Scenario: 预设与滑块同步

- **WHEN** 用户点击「宽松」预设
- **THEN** 滑块值 SHALL 变为 1200，正文行宽 SHALL 随之更新

### Requirement: A-17 HTML 预览首屏不阻塞

打开 `.html` 文件且处于预览模式时，应用 SHALL NOT 将完整文档同步进隐藏的代码编辑器用于语法解析；编辑器内容 SHALL 在首次切换到编辑或源码模式时再同步。iframe 加载期间 SHALL 显示骨架占位，加载完成后 SHALL 移除。

#### Scenario: 预览态不同步编辑器

- **WHEN** 用户打开一个 50KB HTML 文件并停留在预览模式
- **THEN** 隐藏的 CodeMirror 文档长度 SHALL 为 0，预览 iframe SHALL 正常渲染

#### Scenario: 切到源码时再同步

- **WHEN** 用户在预览态打开同一文件后切换到源码模式
- **THEN** CodeMirror 文档 SHALL 等于文件完整内容

#### Scenario: 加载骨架

- **WHEN** HTML 预览 iframe 尚未触发 `load`
- **THEN** 预览区 SHALL 显示骨架占位；`load` 后骨架 SHALL 消失
