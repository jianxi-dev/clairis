# 设计 — ui-quality-gate-v1

来源：spec issue #1646；需求四要素 `docs/requirements/ui-quality-gate-v1/requirements.md`；交付方案 `docs/delivery/plans/malleability-delivery-plan.md` §1 Q0/Q1/Q4。

## Context

2026-11-27 在本 worktree 实测三处缺口：

1. **裸色值无门禁**：`src/components` + `src/editors`（`*.ts`/`*.tsx`/`*.css`，排除 `__tests__`）去注释后真实裸色值 **127** 处（旧口径逐行扫描 426 行命中，其中 317 条是注释里的 issue 号 `#564` 等，A 项已剔除）。任何新增 UI 都能绕过 token 直接写死颜色，改主题时这些点不会跟随。
2. **token 表无镜像、无对账**：`src/styles/tokens.css` 共 **99 处声明 / 55 个唯一变量名**（`:root` 57 条含 2 个重复名，`.dark` 21 条部分覆盖，`.warm` 21 条部分覆盖；55 个唯一名全部在 `:root` 声明）。没有类型化常量表，也没有任何机制保证 `var(--x)` 有定义。
3. **暗色实底文字对比度不合格**：暗色主题 `#ffffff` on `--app-accent`（`#818cf8`）= **2.98:1**，低于非文本 3:1，更低于正文 4.5:1。消费该组合的规则为 `.dpb-bool-on`、`.dpb-dt-cell-sel`、`.dpb-switch.dpb-switch-on`（均在 `src/styles/doc-property.css`）。其余已测语义对全部通过（亮 16.58 / 14.12 / 6.57 / 3.03 / 5.70；暗 15.95 / 13.25 / 8.05 / 4.24 / 7.19；暖 13.96 / 10.67 / 5.50 / 3.06 / 5.07）。

同时，`docs/design/system/spec.md` §8「明确不做」现写「不机检 §7 判据」，与本 change 要新增的 §7.8 对比度机检冲突。§8 需 supersede 为「不机检 §7.3 审美判据；§7.8 对比度由 `check-tokens` C 项机检」。

## Goals / Non-Goals

**Goals**

- Q0：token 门禁——`tokens.ts` 与 `tokens.css` 双向对账；组件层裸色值只减不增；语义色对比度机检；接入 `verify.sh` 3c、pre-commit（只跑 A）、CI verify job（全量 A/B/C）。
- Q1：四条交互条款——`interaction.md` 定义 + 正反例 + 守护指针；`spec.md` §8 supersede。
- Q4：交付验收模板——三件证据（明暗 × 1280/400 截图对、可复现步骤、计算样式断言），接入 PR 模板与 G3 交付对账。

**Non-Goals**（与 requirements.md 的 Scope 一致）

- 不迁移存量 127 处裸色值、18 处 1px 横线、3 处 `window.prompt`（进基线只减不增；迁移随 Q2 基件与后续专项）。
- 不做 Q2 四基件 / `/showcase`、Q3 图标纪检、Q5 px 专项。
- 不引入运行时校验、不动 Rust、不新增依赖。
- 不改 `spec.md` §7.3 的人工审美七问（它仍是人工判据）。

## Decisions

### D1 token 表与双向对账

**做法**：新增 `src/styles/tokens.ts`，键集 = `tokens.css` 的 **55 个唯一变量名**，外加新增的 `--app-accent-fill` 与 `--app-on-accent`，共 **57** 键。`scripts/check-tokens.mjs` 的 B 检查做三件事：① `tokens.ts` 键集与 `tokens.css` 唯一名集合相等（差集为 0）；② 每个主题块（`.dark` / `.warm`）声明的键都存在于键集（部分覆盖不要求补全）；③ `src` 内每个 `var(--x)` 都有定义。

**为什么**：按唯一名而非 99 声明数对账，因为重复声明是主题覆盖语义（`.dark` 覆盖 `--app-accent` 是设计意图，不是错误）。若按 99 条声明对账，主题覆盖会被误报为「键集不等」。键集语义才能区分「新增/删除 token」与「主题覆盖」。

**怎么验**：`node scripts/check-tokens.mjs` 退 0；删除一个 token 定义退 1；在 `tokens.ts` 加一个 `tokens.css` 没有的键退 1；在组件写 `var(--not-exist)` 退 1。

### D2 裸色值基线与只减不增

**做法**：扫描范围 `src/components/**`、`src/editors/**` 的 `ts`/`tsx`/`css`；`tokens.css` / `tokens.ts` / `scripts/**` 豁免。先做注释剥离预遍（块注释 `/* */` 与 JSX `{/* */}` 全删；行注释仅当 `//` 在行首或前接空白时删，字符串里的 `https://` 不受影响），再匹配 `#rgb`/`#rrggbb`/`#rrggbbaa`、`rgb()`/`rgba()`，并剔除纯十进制 issue 引用（`#564`、`#1700` 等 `^#[0-9]{3,4}$`）。命中后与基线比对：不在基线内 → 退 1。去注释后存量 **127** 处进 `scripts/token-baseline.json`（实测口径：按 `(file, value, 去空白整行)` 多重集计数，sum(count) = **127**，唯一键 **102**；上下文取自剥离后的行），逐条记 `file` + 值 + 上下文 + 次数 + 原因。基线只减不增（删除代码时同步删条目）。

**为什么**：一次性迁移存量不现实，且会与 B2–B7 的功能改动混在一起。基线把「存量冻结、增量禁止」拆开，门禁立刻生效而不阻塞本 change。

**怎么验**：故意在组件写 `#ff0000` → 退 1；注释里写 `// 修复 #1700 与 #920` → 退 0（issue 号不当色值）；基线文件 sum(count) = 127 / 唯一键 102；删除一条基线条目后该色值仍命中 → 退 0（只减不增语义）。

### D3 对比度口径

**做法**：ink-1 = `--app-text-strong` ≥ **7**；ink-2 = `--app-text-2` ≥ **4.5**；`--app-text-3` ≥ **3**（次要/大字）；accent 实底文字 ≥ **4.5**；危险色 ≥ **4.5**。**status 四组首期不启用**（错误色无独立 token，spec §6 已登记为缺口；等错误色 token 化后再开）。

**为什么**：只对已存在的语义对断言，避免为尚未 token 化的 status 组凭空造值。阈值取 WCAG AA 正文 4.5 / 大字 3 / 增强 7 三档，与 spec §7.8 一致。

**怎么验**：调低任一语义对 → 退 1 并列出对与数值；把 `--app-text-strong` 改成 `#000` → 退 1 并打印比值。

### D4 暗色实底文字修复

**做法**：新增 `--app-accent-fill`（light `#5c5fee` / dark `#818cf8` / warm `#0071e3`）与 `--app-on-accent`（light `#ffffff` / dark `#16181c` / warm `#ffffff`）。`.dpb-bool-on`、`.dpb-dt-cell-sel`、`.dpb-switch.dpb-switch-on` 三处实底的 `background` / `border-color` 改 `var(--app-accent-fill)`，`color` 改 `var(--app-on-accent)`。实测比值：亮 `#ffffff` on `#5c5fee` = **4.85:1**，暗 `#16181c` on `#818cf8` = **5.96:1**，暖 `#ffffff` on `#0071e3` = **4.70:1**，三主题均 ≥4.5。**阈值不放松**。

**为什么**：`--app-accent` 是品牌交互信号（focus ring / 选中指示，design-codex D7 定案，约 80 处引用含已批准设计稿），不因对比度改动；`--app-accent-fill` 专用于 accent 作实底时的填充，两者解耦后品牌色与可读性各守其位。这条让 Q0 产生一处真实可见改动（暗色下开关/日期选中格文字由白转深），作为「门禁能产出可见结果」的证据，而不是只加脚本不改代码。

**怎么验**：暗色主题开关选中态计算 `color` 严格等于 `var(--app-on-accent)`、`background` 严格等于 `var(--app-accent-fill)`；e2e 断言该文字与 `--app-accent-fill` 底对比度 ≥ 4.5（实测值打印到 stdout）。

### D5 交互条款与守护

**做法**：`interaction.md` 四条——零横线（分隔用间距/背景；例外仅菜单分组线与表格边框，且用 `--app-border`）；反馈三档（静默 / 轻提示 toast / 需确认 dialog；SHALL NOT 使用 `window.alert|confirm|prompt`）；禁用而非隐藏（条件不满足时控件保留并 `disabled` + 原因提示）；Esc 只退场（只关闭最上层，SHALL NOT 触发保存/删除）。每条含定义、正反例、守护指针。守护：新增 1px `border-top/bottom` 进基线（**18** 条存量，只减不增）；grep 覆盖 `window.alert|confirm|prompt`（**3** 处 prompt 进基线，迁移留 Q2 dialog 之后）；三条「禁用而非隐藏」e2e（无选区导出 / AI 未配置 / 只读文档），首跑红则本票内最小修复、绿则锁行为；Esc 逐层退出 e2e，按 App 级现有顺序逐层断言（快捷键帮助 → AI 待确认 → AI 窗口 → 临时显现 → 全屏 → 阅读态），文档内容不变。

**为什么**：条款不写守护就是口号。横线与原生对话框用基线冻结存量、禁止增量；禁用而非隐藏与 Esc 用 e2e 锁行为，因为它们涉及运行时状态机，扫描测不出。

**怎么验**：`interaction.md` 恰好四条且每条含守护指针；`window.alert/confirm/prompt` 新增命中数为 0；e2e 新增 ≥4 条且绿。

### D6 交付模板与接线

**做法**：三件证据——① 明/暗 × 1280/400 截图对，标关键态；② 关键路径 e2e 或逐步手工清单；③ 计算样式断言（字号/色值/尺寸来自 token，非肉眼）。接入 `.github/pull_request_template.md`（新增两项勾选）与 G3「交付对账」（缺证据即退回）。

**为什么**：UI 交付以「编译通过」结案，用户实测才发现偏差。三件证据把「可核对」变成 PR 前置条件，而不是评审口头要求。

**怎么验**：模板存在且三件证据各有填写示例与判据；PR 模板含两项勾选；抽查最近两个 UI PR，缺任一件证据时按模板判为退回。

## 切片口径（QG-7）

本 change 是品质地基，交付物是门禁/条款而非应用功能，故三票粒度申报 `integrate-verify`。Q0 附带一处可见对比度修复，作为「门禁能产出可见结果」的证据。不把存量迁移塞进本 change，避免 3 天票膨胀成 10 天。每张票贯穿「定义 → 接线 → 守护」，做完有可核验的门禁产物。

## 判定面

| 能力 | 消费面 | 状态 | 判据 |
|---|---|---|---|
| token 门禁 | 开发者本地提交 / CI verify / PR 审查 | 新增违规 / 命中存量基线 / 删除定义 / 对比度跌破 | 新增必红；基线只减不增；比值列出对与数值 |
| 交互条款 | interaction.md 读者 / e2e 套件 / code-review | 新增横线 / 原生对话框 / 控件隐藏 / Esc 越权 | 条款逐条可引用；守护红则修 |
| 交付模板 | PR 模板 / G3 交付对账 | 证据齐全 / 缺截图 / 缺步骤 / 缺计算样式断言 | 缺证据退回 |

## 数据面

| 落点 | 位置 | 载体/符号 | 判据 |
|---|---|---|---|
| 规格 | design-system:§6;§7.8 | — | 阈值只在 spec 定义；新增 token 先有条款 |
| 存储 | src/styles/tokens.css | --app-accent-fill / --app-on-accent | 99 声明归并为 57 唯一名；tokens.ts 键集相等 |
| 校验 | scripts/check-tokens.mjs | checkContrast | A/B/C 三项各自可退 1；基线只减不增 |
| 桥接 | scripts/verify.sh | check-tokens.mjs | 3c 段全量跑；pre-commit 只跑 A（<1s）；CI verify job 全量 A/B/C |
| 消费 | src/styles/doc-property.css | --app-accent-fill / --app-on-accent | 三处实底改引用填充 token；三主题实底文字 ≥4.5 |
| 回滚 | scripts/token-baseline.json | tokenBaseline | 基线随代码回退；无运行时状态 |

## Risks

- **基线录入量大**：127 处由脚本生成，不手抄；生成后人工抽查 10 条。
- **阈值过严**：只对已存在的语义对断言，status 四组暂缓；若误报集中在某个语义对，先核对该对是否真是正文级。
- **暗色 accent 改动引发视觉回归**：三处截图对（明/暗 × 1280/400）+ review；`--app-accent` 品牌色不变，仅实底填充/文字色走新 token，不动布局。
- **`.vite` 共享缓存的假崩**：e2e 首跑前先删 `node_modules/.vite` 再跑。
