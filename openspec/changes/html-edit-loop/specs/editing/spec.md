## ADDED Requirements

### Requirement: E-15 HTML 编辑闭环

`.html` 文件的预览 SHALL 在隔离的 iframe 中渲染（`srcdoc` + `sandbox`），SHALL NOT 把用户 HTML 直接注入应用主文档。预览中的相对路径资源（样式表、图片）SHALL 解析到**文档所在目录**并可加载。预览/编辑/源码三模式切换 SHALL NOT remount `EditorView`；编辑态的改动 SHALL 在切回预览时可见。

#### Scenario: 预览隔离渲染

- **WHEN** 用户打开一个带 `<style>` 与 `<script>` 的 `.html` 文件并切到预览
- **THEN** 内容 SHALL 在 iframe 内渲染，应用自身的样式与脚本 SHALL NOT 受影响

#### Scenario: 相对资源可加载

- **WHEN** HTML 里引用 `./style.css` 或 `img/a.png`，且文件与文档同目录
- **THEN** 预览 SHALL 能加载到这两个资源（src 解析到文档目录，而非应用 origin）

#### Scenario: 编辑后切回预览可见

- **WHEN** 用户在编辑态改动一行内容并切回预览
- **THEN** 预览 SHALL 反映该改动，且文档内容不因切换而丢失
