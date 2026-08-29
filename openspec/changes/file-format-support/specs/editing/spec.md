## MODIFIED Requirements

### Requirement: E-2 源码模式语法高亮

除 `.html` 外，代码类文件（`.css` / `.py` / `.json` / `.js` / `.mjs` / `.cjs` / `.jsx` / `.ts` / `.tsx` / `.yaml` / `.yml`）SHALL 在编辑/源码模式使用对应 CodeMirror 语言扩展提供语法高亮：CSS（`css()`）、Python（`python()`）、JSON（`json()`）、JavaScript/TypeScript（`javascript({ typescript: true })`）、YAML（`yaml()`）。非代码文本类（`.txt` / `.csv` 等）SHALL 以无高亮等宽视图呈现，不强制语言高亮。

#### Scenario: Python 文件高亮

- **WHEN** 用户打开 `.py` 文件并处于编辑/源码模式
- **THEN** 代码 SHALL 由 `python()` 语言扩展渲染，关键字/字符串/注释高亮可见

#### Scenario: JS/TS 统一高亮

- **WHEN** 用户打开 `.js` 或 `.ts` 文件并处于编辑/源码模式
- **THEN** 代码 SHALL 由 `javascript({ typescript: true })` 语言扩展渲染，两类文件 SHALL 高亮一致

#### Scenario: 普通文本不高亮

- **WHEN** 用户打开 `.txt` / `.csv` 文件
- **THEN** 编辑区 SHALL 呈现等宽纯文本（无语言高亮标记）
