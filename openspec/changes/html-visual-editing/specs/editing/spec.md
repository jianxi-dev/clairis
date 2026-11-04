## ADDED Requirements

### Requirement: E-16 HTML 可视化编辑

`.html` 文件的编辑态 SHALL 提供可视化编辑：用户可在渲染结果上点选元素、双击修改文本，改动 SHALL 反映到文档内容。保存 SHALL 写回**干净 HTML**——不得残留 `data-cm-*` 属性、`<!--cmid:-->` 注释锚点、`contenteditable` 或注入的运行时脚本/样式。

可视化编辑器 SHALL NOT 在打开文件时改写磁盘内容（除用户主动保存）。源码模式（CM6 `html()`）与可视化模式 SHALL 读写同一份 `content`，且切到源码模式时 CM6 的 `EditorView` SHALL NOT remount。

#### Scenario: 点选元素并修改文本

- **WHEN** 用户在可视化编辑态双击一段文字并输入新内容
- **THEN** 文档 `content` SHALL 反映该改动，切到预览 SHALL 看到同一处改动

#### Scenario: 保存零残留

- **WHEN** 用户在可视化编辑态改动内容后保存
- **THEN** 写回的文件 SHALL NOT 含 `data-cm-` 前缀、`cmid` 注释、`contenteditable` 或注入运行时的 `<script>`/`<style>`

#### Scenario: 打开文件不产生副作用

- **WHEN** 用户打开一个从未被本应用编辑过的 `.html` 文件，只看不改
- **THEN** 该文件的字节与 mtime SHALL 保持不变

#### Scenario: 源码模式状态不丢

- **WHEN** 用户在源码模式有未撤销的编辑与选区，切到可视化模式再切回源码
- **THEN** CM6 的 `EditorView` SHALL 是同一次挂载（undo 栈与选区保留）

## MODIFIED Requirements

### Requirement: E-15 HTML 编辑闭环

`.html` 文件的预览 SHALL 在隔离的 iframe 中渲染（`srcdoc` + `sandbox`），SHALL NOT 把用户 HTML 直接注入应用主文档。预览中的相对路径资源（样式表、图片）SHALL 解析到**文档所在目录**并可加载。预览/编辑/源码三模式切换 SHALL NOT remount `EditorView`；编辑态的改动 SHALL 在切回预览时可见。

预览态与可视化编辑态 SHALL 使用**各自独立**的内容安全策略：预览态 SHALL NOT 执行脚本；编辑态 SHALL 仅允许本应用注入的运行时执行，用户文件内的脚本仍 SHALL NOT 执行。

#### Scenario: 预览隔离渲染

- **WHEN** 用户打开一个带 `<style>` 与 `<script>` 的 `.html` 文件并切到预览
- **THEN** 内容 SHALL 在 iframe 内渲染，应用自身的样式与脚本 SHALL NOT 受影响

#### Scenario: 相对资源可加载

- **WHEN** HTML 里引用 `./style.css` 或 `img/a.png`，且文件与文档同目录
- **THEN** 预览 SHALL 能加载到这两个资源（src 解析到文档目录，而非应用 origin）

#### Scenario: 编辑后切回预览可见

- **WHEN** 用户在编辑态改动一行内容并切回预览
- **THEN** 预览 SHALL 反映该改动，且文档内容不因切换而丢失

#### Scenario: 两态脚本策略分离

- **WHEN** 用户在预览态与可视化编辑态之间切换
- **THEN** 预览态 SHALL NOT 执行任何脚本；编辑态 SHALL 只执行本应用注入的运行时，用户文件里的 `<script>` SHALL NOT 执行
