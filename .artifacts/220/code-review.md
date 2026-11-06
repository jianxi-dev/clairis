# Code Review — #220（reading-surface-refine 6.2）

- 审查者：Atlas（写者 = Sisyphus-Junior/LongCat-2.5，跨模型验证分离）
- 基于 HEAD：origin/main = c04fe6a + 工作区改动（分支 feat/reading-surface-refine-6.2）
- 验证原始输出：tsc exit 0；eslint 0 errors（39 既有 warnings）；vitest 101 files/1312 tests 全过；cargo test 116 passed / 0 failed（含 search 7 条 tempfile 单测）；e2e reading-rail 7/7（本会话亲跑）；QG-5 探针四态截图全过；cw-vision describe 复核：时间筛选 3→1 条准确（只剩「更早」的旧档.md）、计数同步、无破损、无命中空态有提示

## Standards 轴

| 检查项 | 结论 |
| --- | --- |
| Rust 逻辑逐行复核 | ✓ scan（深度≤2、隐藏/重型目录排除、5000 文件上限）、frontmatter title、H1（md/# 与 html/<h1>）、按字符大小写不敏感匹配（char_eq_ci 逐 char 小写比较，CJK/多字节安全）、片段截取（半径 60 + … 标注）逐行读过，无逻辑错误 |
| 资源限额 | ✓ 单文件只读前 64KB（不整读大文件）；limit 默认 30 上限 100（clamp）；MAX_SCAN_FILES 防全盘卡 UI |
| serde 一致性 | ✓ SearchHit #[serde(rename_all="camelCase")]，TS SearchHit 接口字段逐一对齐（path/title/openedAt/excerpt/matchedIn） |
| 复用而非重复 | ✓ SCAN_DIRS/is_heavy_dir/is_html/strip_html_tags/to_iso8601 从 recent.rs 改 pub(crate) 复用（行为零变化，仅可见性）；e2e mock 沿用 __biaoyue_*__ 注入范式 |
| 反模式扫描 | ✓ 无 unwrap 滥用（metadata/read_dir 全部容错跳过）、无 as any/@ts-ignore/console.log/TODO |
| token 体系 | ✓ rail-search-* 全部 Tailwind + --app/token 类；rail-hit 复用既有 CSS（未新增 cm-* 类，manifest 88/159 通过） |
| 范围纪律 | ✓ diff 限于 commands/search.rs（新）+ recent.rs 可见性 + 注册 + 前端搜索链路文件；未触碰 #215-#219 域；无新增依赖；未做倒排索引/常驻扫描（票面克制要求） |

## Spec 轴（逐条对照票面 AC）

| AC | 实现 | 证据 |
| --- | --- | --- |
| 文件名/title/H1/正文匹配 | match 顺序 filename → frontmatter title → H1 → 正文（matchedIn 标记来源） | cargo 7 单测（tempfile 目录）+ e2e 用例 5 |
| 限量返回 | DEFAULT_LIMIT 30 / MAX 100 / 扫描上限 5000 | cargo 单测断言 limit |
| 阅读空间搜索接本机结果 | rail-query 去抖 300ms → invoke search_documents → rail-search-results 独立块（不污染既有段/持久化） | vitest mock invoke 真实链路 160 行 + 探针态 01 |
| 正文命中并高亮 | RailRow excerptRanges → <mark> 高亮命中词 | e2e「正文命中高亮」+ 探针态 01（mark 含关键词） |
| 类型筛选 | rail-search-chip-*（复用 fileTypeChips 泛化） | e2e「类型筛选生效」+ 探针态 02 |
| 时间筛选 | timeBucketOf（今天/本周/更早，openedAt 本地日界分桶）+ rail-search-time | e2e「时间筛选生效」+ 探针态 03（3→1 条，describe 复核一致） |
| 无命中空态 | rail-search-empty（检索中…/无命中双态文案） | e2e + 探针态 04（截图抓在防抖瞬间显示「检索中…」，终态「无命中」已代码核验 + e2e 断言） |

## 结构审查（risk-medium pre-landing）

- SQL：无 — 不适用
- LLM 信任边界：无新增注入面（excerpt 渲染走既有 RailRow 文本/高亮管线，非 dangerouslySetInnerHTML）— 通过
- 条件副作用：搜索块仅在 railSearchOpen && query 时渲染；去抖 timer 成对清理；invoke 失败容错 — 通过
- scope drift：recent.rs 仅可见性改动（pub(crate)），零行为变化 — 通过

## 测试真实链路复核（QG-4）

vitest 用 mock invoke 驱动真实组件链路（输入→去抖→invoke→渲染→筛选→高亮），断言 DOM 内容与计数；cargo tempfile 真实目录扫描断言；e2e 真实浏览器全链路。✓

## 未决项

无（0 未决）。

留痕：全量 e2e 有 17 条既有失败（ui-fidelity 14 + shortest-path 3，#216 域块手柄几何），干净 origin/main 复跑同样失败，非本票引入。
