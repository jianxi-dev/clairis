# 软著资料准备工具集（scripts/softcopyright）

为 Clairis（渐晰）申请软件著作权登记准备申请材料的工具目录。定位：**从 M 级开发期就开始的资料积累体系**，申请时机为 Phase R（V1.0 稳定版发布）之后，详见 [`docs/delivery/roadmap.md`](../../docs/delivery/roadmap.md) 与资料台账 [`docs/delivery/softcopyright/ledger.md`](../../docs/delivery/softcopyright/ledger.md)。

> 本目录仅含工具骨架与配置（任务 1）。统计、截图、PDF 生成逻辑由后续任务补充。

## 目录结构

```
scripts/softcopyright/
├── config.json          # 全局配置（唯一配置源，各工具共享）
├── README.md            # 本文件
├── screens-config.json  # 截图场景配置（任务 2 生成，路径由 config.scenesFile 指定）
└── out/                 # 生成物输出目录（永不入库，已加入 .gitignore）
```

## 配置文件 config.json 字段说明

JSON 不支持注释，字段含义集中说明于此。键名与类型是工具契约，改动须同步更新本表。

| 字段 | 类型 | 含义 |
|---|---|---|
| `softwareName` | string | 软件全称（申请材料页眉/说明书中展示），当前为占位值，申请前定稿 |
| `softwareShortName` | string | 软件简称（截图覆盖层等场景使用），占位值 |
| `version` | string | 登记版本号，占位 `V1.0`，对齐 Phase R |
| `ownerName` | string | 申请人姓名。**申请前填写**——留空字符串占位，绝不写入真实姓名（防误提交） |
| `sourceRoots` | string[] | 自有代码根目录（仅统计/打包自有代码，排除第三方框架） |
| `includeExts` | string[] | 参与行数统计与源代码文档的扩展名白名单 |
| `excludeGlobs` | string[] | 排除 glob（测试文件等，避免测试代码混入源代码文档） |
| `entryFiles` | string[] | 源代码文档首页起排的入口文件，排序优先级最高 |
| `coreFiles` | string[] | 可选核心文件 glob 列表，默认空数组；排序优先级 `entryFiles` > `coreFiles` > 其余字典序 |
| `linesPerPage` | number | 源代码文档每页行数（2026 规范：每页 ≥50 行，去空行） |
| `minLinesForPartial` | number | 有效行数低于该值输出全量文档，否则输出前 `frontPages`/后 `backPages` 页 |
| `frontPages` | number | 前 N 页（默认 30） |
| `backPages` | number | 后 N 页（默认 30） |
| `screenshotsDir` | string | 测试截图存档目录（可入库，作为证据链） |
| `scenesFile` | string | 截图场景配置文件路径（由 capture-screens 工具读取） |

## 常用命令

| 命令 | 说明 |
|---|---|
| `node scripts/softcopyright/count-lines.mjs` | 统计有效代码行数（任务 3 提供） |
| `node scripts/softcopyright/capture-screens.mjs` | 按场景采集测试截图（任务 2 提供，复用 e2e tauri-mock 桥） |
| `node scripts/softcopyright/build-source-doc.mjs` | 生成源代码文档 PDF（任务 5 提供，申请前使用） |

> `out/` 目录（PDF 等生成物）永不入库；截图等证据链材料入库至 `docs/delivery/softcopyright/screenshots/`。
