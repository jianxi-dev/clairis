## ADDED Requirements

### Requirement: E-20 HTML 可视化编辑：拖拽移动节点

`.html` 可视化编辑态 SHALL 支持用户按住元素拖到另一个元素的位置，松手后该元素（含其子树）在文档中换到目标元素之前或之后。位移小于阈值（4px）时 SHALL 按点击处理，SHALL NOT 触发移动。

拖拽过程 SHALL 显示插入位置指示；落点为目标元素自身或其子孙时 SHALL 拒绝移动并保持文档不变。移动结果 SHALL 折算回 `content`，保存产物 SHALL NOT 残留编辑期属性或锚点。

#### Scenario: 把后一段拖到前一段之前

- **WHEN** 用户按住第二个 `<p>` 拖到第一个 `<p>` 的上半部并松手
- **THEN** 渲染结果里第二段 SHALL 排在前面，`content` 中两段顺序 SHALL 同步调换，且父容器与兄弟结构不受影响

#### Scenario: 微小位移仍算点击

- **WHEN** 用户在元素上按下并只移动 3px 就松手
- **THEN** 文档 SHALL 保持不变，选中状态 SHALL 按点击处理

#### Scenario: 拒绝把自己拖进自己的子树

- **WHEN** 用户把一个容器元素拖到它自己的子元素上松手
- **THEN** `content` SHALL 保持不变，文档结构 SHALL NOT 出现节点丢失

### Requirement: E-21 HTML 可视化编辑：区域截图

`.html` 可视化编辑态 SHALL 提供截图入口：用户进入截图模式后在页面上拖出矩形区域，应用 SHALL 把该区域渲染为 PNG 并保存到用户选择的位置。

截图 SHALL 复用应用的 PNG 栅格化管线（SVG `foreignObject` → canvas）。截图 SHALL 保留文档的内联 `<style>` 与相对路径图片；**外链样式表与 `@import` SHALL NOT 被保证包含**（SVG 作为图片加载时不请求外部资源）。文档 `body` 的关键计算样式（边距、背景、字体）SHALL 反映在截图里。

截图 SHALL NOT 修改文档 `content`；内容为空或区域无效时 SHALL NOT 产出文件。

#### Scenario: 截取一块区域得到 PNG

- **WHEN** 用户在截图模式下框选页面上的一段标题与正文
- **THEN** SHALL 产出 PNG 文件，且文件的像素尺寸与所选区域一致（按 2 倍栅格）

#### Scenario: 截图不污染文档

- **WHEN** 用户截图后保存文档
- **THEN** 写回的文件 SHALL NOT 含截图选框、`data-cm-*` 属性或注入运行时的脚本/样式

#### Scenario: 空区域不产出文件

- **WHEN** 用户拖出的区域宽度或高度为 0
- **THEN** SHALL NOT 写出文件，SHALL 提示区域无效
