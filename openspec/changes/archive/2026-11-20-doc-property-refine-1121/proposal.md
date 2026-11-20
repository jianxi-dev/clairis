## Why

文档属性面板在真机使用中仍有一批细节不达标，并且存在一个必崩输入：`tags: "#"`（字符串值被别称识别为列表类型）会让整个窗格报「应用错误」。同时，外部 frontmatter 的适配不足——Obsidian 模板里的 `{{date}}` 占位让整块 YAML 解析失败，属性区显示「0 个字段」；mdpkg 文档一半的键显示「? 未识别」。

这些不是新能力缺失，而是既有 requirement（P-3 类型系统、P-4 行结构与操作、P-6 别称识别、P-10 视觉锚点、托管日期只读展示）在真机上的落点不完整：识别层对「值形状与声明类型不一致」没有容错，面板层对 A/B 两态的结构、字号与图标没有收口到同一口径。

## What Changes

- **解析容错**：frontmatter 解析从「整块 YAML 成败决定一切」改为「整块优先、失败逐条兜底」；单条值不可解析时保留原文按文本展示，编辑时走行级写回，不丢其他字段、不改无关字节。
- **识别收敛**：空值默认文本（不再显示「?」）；内置别称补常见外部键（`type`、`source_kind`、`*_via`、`*_at`、`read_date`、`rating`、`book_title`）；非数组值遇到列表类型时归一为单元素列表，不再崩溃。
- **头部与 footer 统一**：A/B 共用同一按钮顺序（添加字段 → 模板 → 全选 → 折叠 → 形态切换）与同一 footer 顺序（计数在左、托管日期在右）；锁图标缩小、日期与计数弱化，计数悬停才高亮。
- **图标**：形态切换图标改为「A 三横杠 / B 三竖杠」（A 为 B 逆时针 90°）；「全选」新增全选图标。
- **字段行**：去掉类型文字；类型图标、字段名、值垂直居中；值输入框填满整行（日期/数字/布尔等特殊格式除外）；字号跟随正文字号（⌘+/- 同步），footer 字号与行高保持小号；删除叉号默认隐藏、悬停显现。
- **选中工具条**：去强调色底与描边，改中性表面；按钮悬停才反馈。
- **折叠条**：默认淡出，鼠标滑入显现、滑出淡出；不引起正文回流。
- **日期**：日期时间显示紧凑（秒为 0 时省略）；日期选择面板加宽、格子加大，标题可点切月/年视图，翻页按钮间距拉开，增加「今天」。
- **日期字段自绘面板**：日期字段改用与日期时间相同的自绘面板（仅日期、无时分，提交 `YYYY-MM-DD`），SHALL NOT 使用原生 date 控件。
- **缺陷修复（Tab 键）**：时间输入框内按 Tab 被编辑器当作缩进写入、属性区误判无 frontmatter；面板内 Tab SHALL 只在面板控件间移动焦点，SHALL NOT 写入正文。
- **改名**：双击页签改名为「只改主名」，扩展名固定不可改；属性面板标题字段不显示扩展名，写回时保留。
- **BREAKING（内部契约）**：P-10「新建字段按钮位次」中「A 模式末位」被废止，A/B 顺序统一；托管日期 footer 的 A 模式「日期在左、计数在右」被废止，统一为「计数在左、日期在右」。存储值 `docPropertyVariant`（A/B）与 `displayStyle`（list/dual）不变。

## Capabilities

### New Capabilities

- 无新增能力域。

### Modified Capabilities

- `doc-property-panel`：P-3 字段类型系统（非数组值容错、日期时间紧凑显示、选择器改版）；P-4 行结构与操作（去类型文字、居中、满行、删除悬停、工具条去色、全选图标）；P-6 字段名编辑与别称识别（别称扩展、空值默认文本、标题不含扩展名）；P-10 A/B 视觉锚点（按钮顺序与 footer 顺序统一、字号跟随正文、图标改形）；「托管日期只读展示」（位置顺序、锁图标与弱化）；新增「frontmatter 解析容错与外部文档适配」requirement。
- `navigation`：页签双击重命名锁定扩展名（输入框只承载文件主名，扩展名以只读后缀呈现、不可编辑，提交接回原扩展名；仅改显示标题与 frontmatter 标题）。

## Impact

- 前端：`src/lib/frontmatter.ts`（解析/识别/格式化/写回）、`src/components/Content/DocPropertyBar.tsx`（头部、footer、字段行、工具条、日期面板、折叠条）、`src/components/Content/useMenuPos.ts`（日期面板传宿主边界）、`src/lib/pathName.ts`（新增，主名/扩展名拆分与拼接）、`src/styles/doc-property.css`（布局、字号、弱化、图标尺寸）、`src/ui/icons.ts`（形态切换图标改形、新增全选图标）、`src/components/TabBar.tsx` 与 `src/stores/index.ts`（页签改名锁扩展名）。
- 设计系统：`docs/design/system/spec.md` §2.3（全选图标、形态切换图标语义）与 §7.2（锁图标尺寸 token）；`docs/design/system/decisions.md` 追加裁决行。
- 测试：`src/__tests__/frontmatter.test.ts`（解析容错、识别、列表容错）、`src/__tests__/components/Content/DocPropertyBar.test.tsx`（布局与按钮顺序）、`e2e/doc-property-panel.spec.ts`（垂直居中、字号同步、删除悬停、折叠条显隐、日期面板、改名）。
- 无新增外部依赖；无 Rust 侧改动；无配置 schema 变更。
