# 四项研究设计交付清单

**目标**：在独立 worktree（`clairis-wt-design-plan`，基于主仓创建，过程不污染主工作区）中完成四项研究与设计，产出设计方案文档与高保真原型，交付物经审查。

**状态**：四项方案全部完成，经独立对抗评审并据意见修订；原型高保真可离线打开；重新委派的独立审计核验 8 条验证合约全部 PASS。

## 交付物清单

| # | 交付物 | 路径 |
|---|---|---|
| 1 | 插件能力提取方案 | `docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md` |
| 2 | 数据文件化方案 | `docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md` |
| 3 | 设置页优化方案 | `docs/design/pluginization-datafile-settings-rail/03-settings-page-optimization.md` |
| 4 | 文档发现与插件展示方案 | `docs/design/pluginization-datafile-settings-rail/04-document-discovery-and-plugin-display.md` |
| 5 | 设置页浮窗原型 | `docs/design/explorations/pluginization-datafile-settings-rail/03-settings-page-optimization.html` |
| 6 | 文档发现原型 | `docs/design/explorations/pluginization-datafile-settings-rail/04-document-discovery-and-plugin-display.html` |
| 7 | codex 对抗评审纪要（4 份） | `docs/design/pluginization-datafile-settings-rail/codex-reviews/`（01-plugin.md、02-datafile.md、03-settings.md、04-discovery.md） |
| 8 | 交付清单 | `docs/design/pluginization-datafile-settings-rail/DELIVERY.md` |

## 方案要点

1. **插件能力提取**：三类插件形态定义（内置/扩展/skill），逐条能力清单覆盖编辑器、捕获、导出、阅读空间、搜索等全部能力域（A5 + B11 + C5），含现状、插件形态、AGENT 自定义价值；分批落地路线与安全基线。
2. **数据文件化**：三档功能清单（A5/B9/C3），逐项含数据文件形态、AGENT 可改通路、生效与校验；密钥永不文件化（ADR 0005）；含捕获配置等根因修复。
3. **设置页优化**：独立浮窗布局与分类（引用第 1、2 项结论），快捷键体系四要素（核心高频、规则技巧、全局/局部区分、可自定义项）。
4. **文档发现与插件展示**：新查找操作方案（搜索提升为发现主入口等三变体对比），插件展示方式设计（按类型分操作入口）。

## 验证合约（独立审计全部 PASS）

1. 独立 worktree 就位，主工作区未被本任务污染。
2. 交付物齐全（6 文件 + 清单 + 评审纪要），路径如上。
3. 插件清单完备，覆盖编辑器、捕获、导出、阅读空间、搜索等（含交付后审计修复 B10/B11）。
4. 数据文件清单完备，含数据文件形态与 AGENT 可改通路，密钥纪律明确。
5. 设置方案完备，浮窗布局分类引用第 1、2 项，快捷键四要素齐备。
6. 文档查找方案完备，含新操作方案与插件展示设计，改进点明确。
7. 评审记录归档，四份方案各含对抗评审记录章节，纪要归档于 codex-reviews/。
8. 原型可用，离线单文件 HTML，结构完整，交互冒烟无控制台错误。

## 方案完备性

逐条清单、快捷键四要素、查找方案与插件展示均已覆盖（详见各方案文档）。**插件清单（01）覆盖编辑器、捕获、导出、阅读空间、搜索等全部能力域**——交付后审计指出捕获与搜索此前缺项，已补登 B10 快速捕获浮层、B11 搜索。
