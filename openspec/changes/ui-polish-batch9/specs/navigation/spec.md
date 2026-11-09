## MODIFIED Requirements

### Requirement: 悬浮预览窗

悬浮预览窗 SHALL 以 `createPortal` 渲染到 `document.body`，不卸载任何 pane 或 EditorView。窗口 SHALL 可拖动、八向缩放、贴边翻转锚定边。取消钉住后，阅读空间来源的预览 SHALL 在指针离开窗口与阅读空间 180ms 后关闭。

钉住操作 SHALL 把当前窗口封存为独立实例；此后打开新的预览 SHALL 创建/替换未钉住的当前窗口，SHALL NOT 替换任何已钉住的窗口。应用 SHALL 同时渲染全部已钉住窗口与当前窗口（按 id 去重）。每个窗口 SHALL 能独立移动、缩放、关闭与取消钉住；关闭任一窗口 SHALL 只移除该实例。

#### Scenario: 钉住后打开多个悬浮窗

- **WHEN** 用户打开悬浮窗并钉住，随后再从页签/卡片打开另一个预览并再次钉住
- **THEN** 页面上 SHALL 同时存在 2 个悬浮预览窗，且两个窗口的路径各自保留

#### Scenario: 关闭其中一个不影响其余

- **WHEN** 存在 2 个已钉住悬浮窗，用户关闭其中一个
- **THEN** 剩余窗口数量 SHALL 为 1，且其 `data-preview-path` SHALL 等于未被关闭窗口的路径

#### Scenario: 取消钉住只影响当前窗口

- **WHEN** 存在多个已钉住窗口，用户对其中一个取消钉住
- **THEN** 其余窗口 SHALL 保持钉住态，窗口数量 SHALL 不变

#### Scenario: 阅读空间悬停仍只保留一个临时窗

- **WHEN** 用户未钉住任何窗口，在阅读空间连续悬停两行不同文件
- **THEN** 页面上 SHALL 只有 1 个未钉住的悬浮窗，其路径 SHALL 为最后悬停的文件
