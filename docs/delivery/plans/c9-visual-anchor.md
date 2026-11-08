---
title: "C9 视觉锚点机检 · 实现方案"
type: delivery
status: draft
last_updated: 2026-11-08
source_of_truth: supporting
---

# C9 视觉锚点机检 · 实现方案（交接稿）

状态：待实施（在**工具包仓库**内作为一个独立 change：`c9-visual-anchor`）
归属：`docs-governance` 域，DG-4 的机检落地
交接对象：cw 工具包（`jianxi-dev/change-workflow`）维护者。本文只描述**怎么实现**，判据来源是 `openspec/specs/docs-governance/spec.md` DG-4。

## 0. 实施归属（先读这段）

**C9 的机检代码 SHALL 在工具包仓库实现，不在消费仓直接改。**

依据（已在 2026-11-08 核实）：

| 事实 | 证据 |
|---|---|
| 工具包仓库含脚本源文件 | `~/.cache/change-workflow/scripts/cw-tickets-check.sh` 存在；消费仓脚本头注写明「由工具包安装到消费仓 `scripts/`」 |
| 升级会覆盖消费仓副本 | `scripts/cw-update.sh` → 缓存副本 `update.sh`；`.change-workflow.conf` 记录 `TOOLKIT_VERSION` / `EFFECTIVE_DATE` |
| 票面规范同为工具包安装 | `docs/agents/task-tracking.md`、`quality-gates.md`、`defect-workflow.md` 均在 `~/.cache/change-workflow/docs/agents/` |
| 上游已有 e2e 挂点 | `~/.cache/change-workflow/test/install-update-e2e.sh` 已引用 `cw-tickets-check` |

因此分两仓交付：

| 内容 | 落点 | 发布方式 |
|---|---|---|
| `scripts/cw-tickets-check.sh` 的 C9 实现 + 夹具 + `--help` | 工具包仓库 | 版本号 + `CHANGELOG.md` 条目 → 消费仓 `./scripts/cw-update.sh` |
| `docs/agents/task-tracking.md` 票面模板加 `**视觉锚点**` | 工具包仓库 | 同上（随版本下发） |
| `docs/agents/quality-gates.md`（如有 C 系列编号） | 工具包仓库 | 同上 |
| 根 `AGENTS.md` 触发条件措辞（§1） | **消费仓本地** | 本仓文档提交；工具包在 CHANGELOG 里写明「消费者需同步该句」 |
| `openspec` change（记录 DG-4 机检落地） | 消费仓 | 工具包版本升级后，本仓补 change 并归档 |

**下文所有 `scripts/…`、`docs/agents/…` 路径默认指工具包仓库内路径**；只有明确标注「消费仓」的是本仓。实现完成后，消费仓的动作只有两步：升级工具包、补一条 DG-4 机检的 change 记录。

---

## 0. 一句话

在 `scripts/cw-tickets-check.sh` 增加 **C9**：对每张**未声明 `no-ui-impact`** 的票，要求票面 `**视觉锚点**:` 字段存在、语法合法、且引用的条款/台账行**真实存在**；失败即拒票（退出码 1）。

---

## 1. 必须先修的一个前提（否则 C9 永不触发）

`AGENTS.md`「设计」一节现在写的是：

> 票面须有 `**视觉锚点**:` 字段……（触发语：带 `ui-surface` 标签且未声明 `no-ui-impact`）

**`ui-surface` 是 PR 级标签**（`.change-workflow.conf` 的 `LABEL_UI_SURFACE`，用于 diff 判定），票面通常不带。照此实现，C9 对所有票都会跳过 = 规则死掉。

**修正**：触发条件与 QG-1 / QG-2 / C4 / C6 保持同一语义——**票面标签不含 `no-ui-impact`** 即视为用户可见票，必须有视觉锚点。`ui-surface` 只作为 PR 级兜底（若票面恰好带，也触发）。

本 change 必须同时把 `AGENTS.md` 那句话改成：

> 票面须有 `**视觉锚点**:`……（触发条件：标签不含 `no-ui-impact`；与 QG-1 的用户可见票定义一致）

---

## 2. 数据契约

### 2.1 字段位置

`docs/agents/task-tracking.md` §3 票面模板中，放在 `**验收锚点**` 之后：

```
**验收锚点**: A-<n>.<m>（conformance.json；本次验收断言）
**视觉锚点**: design-system:§2.1; ledger:pinOff 斜杠（规范依据）
```

**两个锚点不是一回事**，文档里必须写清：
- `验收锚点` = 本次变更自己的断言（`conformance.json` 的 `A-<n>.<m>`），随 change 归档失效；
- `视觉锚点` = 长期规范依据（spec 条款 / 台账行），跨 change 有效。

### 2.2 语法

```
视觉锚点 := TOKEN ( ";" TOKEN )*
TOKEN     := "design-system:§" NUM | "ledger:" PART
NUM       := 数字("."数字)*        例：2 / 2.1 / 3.4.2
PART      := 非空中文/字母串，不含 ";" ":" 
```

- 分隔符同时接受全角 `；` 与半角 `;`（执行时统一转半角）。
- 至少 1 个 token；空串 = 违规。
- **禁止** token 内出现像素/颜色字面量：`\d+px`、`#[0-9a-fA-F]{3,8}`。
- **禁止**把验收锚点写进来：`A-1.2` 形态直接拒（防止两个锚点混用）。

正例：

```
design-system:§2.1
design-system:§3; design-system:§5
ledger:状态栏主题按钮
design-system:§6; ledger:markdown 图标
```

反例（各自对应一条错误）：

```
18px                              → 语法非法
design-system:§2.1 用 18px         → 含像素值
#ef4444                           → 含颜色值
A-1.2                             → 误用验收锚点
design-system:§9.9                → 条款不存在
ledger:不存在的部件                → 台账行不存在
（空）                             → 缺字段
```

---

## 3. 实现位置与改法

文件：`scripts/cw-tickets-check.sh`（bash 3.2 兼容；python3 已是声明依赖，可用于表格解析）。

### 3.1 解析层（必改，3 处）

1. 数组声明（约 227 行）加 `D_ANCHOR=()`；
2. 每票初始化（约 233 行）加 `PD_ANCHOR=""`；
3. 字段状态机（约 244–280 行）加一个分支：

```bash
      \*\*视觉锚点\*\*:*)
        rest="$(trim "${line#*\*\*视觉锚点\*\*:}")"
        if [[ -n "$rest" ]]; then PD_ANCHOR="$rest"; cur=""; else cur="ANCHOR"; fi ;;
```

并在块行累加处（`WHAT)` / `AC)` 同款，**沿用脚本的字面换行写法，不要用 `$'\n'`**）加：

```bash
          ANCHOR) PD_ANCHOR="${PD_ANCHOR}${line}
" ;;
```

4. 每票收尾（约 324 行）加 `D_ANCHOR+=("$PD_ANCHOR")`。

> 注意：脚本头注写「正文七字段」，C2 实际只查 6 个 body 字段（Parent / What to build / Acceptance criteria / Blocked by / 接线归属 / 标签；验收锚点与粒度由 conformance 与 C8 管）。**加完视觉锚点是第 7 个 body 字段**，头注与文档口径要统一，别再造一个「七/八字段」的歧义。

### 3.2 检查函数（新增）

```bash
# ---- C9 视觉锚点 -------------------------------------------------------------
# 触发：D_LABELS 不含 no-ui-impact（用户可见票；与 QG-1 同语义）。含 ui-surface 也触发。
# 判据：字段存在 / 语法合法 / 无像素颜色字面量 / 引用的条款与台账行存在。
# 豁免：CW_C9_MODE=warn 时只告警不计违规（灰度一轮后默认 enforce）。
check_c9() {
  echo "==> C9 视觉锚点"
  local viol=0 i anchor tok rest num part spec docs_ok
  spec="$REPO_ROOT/docs/design/system/spec.md"
  ledger="$REPO_ROOT/docs/design/system/decisions.md"
  for i in "${!DRAFT_FILES[@]}"; do
    [[ "${D_LABELS[$i]}" == *"no-ui-impact"* ]] && continue

    anchor="$(trim "${D_ANCHOR[$i]}")"
    if [[ -z "$anchor" ]]; then
      c9_violation "${D_NUM[$i]}" "缺少视觉锚点（须写 design-system:§N 或 ledger:<部件>）"
      viol=$((viol + 1)); continue
    fi

    # 全角分号归一
    anchor="$(printf '%s' "$anchor" | tr '；' ';')"
    local oldifs="$IFS"
    IFS=';'
    for tok in $anchor; do
      tok="$(trim "$tok")"
      [[ -z "$tok" ]] && continue

      # 字面量禁令
      if [[ "$tok" =~ [0-9]+px ]] || [[ "$tok" =~ #[0-9a-fA-F]{3,8} ]]; then
        c9_violation "${D_NUM[$i]}" "锚点含像素/颜色字面量：${tok}（数值只在 spec 定义）"
        viol=$((viol + 1)); continue
      fi
      if [[ "$tok" =~ ^A-[0-9]+\.[0-9]+$ ]]; then
        c9_violation "${D_NUM[$i]}" "误用验收锚点 ${tok}（视觉锚点应指规范条款或台账行）"
        viol=$((viol + 1)); continue
      fi

      case "$tok" in
        design-system:§*)
          num="${tok#design-system:§}"
          if ! printf '%s' "$num" | grep -Eq '^[0-9]+(\.[0-9]+)*$'; then
            c9_violation "${D_NUM[$i]}" "条款号格式非法：${tok}"
            viol=$((viol + 1)); continue
          fi
          if [[ ! -f "$spec" ]]; then
            c9_violation "${D_NUM[$i]}" "设计系统规格缺失：docs/design/system/spec.md"
            viol=$((viol + 1)); continue
          fi
          # 命中 `## 2. ` 或 `### 2.1 `
          if ! grep -Eq "^#{2,3}[[:space:]]+$(printf '%s' "$num" | sed 's/\./\\./g')([.][[:space:]]|[[:space:]])" "$spec"; then
            c9_violation "${D_NUM[$i]}" "条款不存在：${tok}"
            viol=$((viol + 1))
          fi
          ;;
        ledger:*)
          part="${tok#ledger:}"
          if [[ -z "$part" ]]; then
            c9_violation "${D_NUM[$i]}" "台账部件名为空：${tok}"
            viol=$((viol + 1)); continue
          fi
          if [[ ! -f "$ledger" ]]; then
            c9_violation "${D_NUM[$i]}" "决案台账缺失：docs/design/system/decisions.md"
            viol=$((viol + 1)); continue
          fi
          # 第一列 trim 后精确匹配
          if ! awk -F'|' -v p="$part" '
                NF>1 { s=$2; gsub(/^[ \t]+|[ \t]+$/,"",s); if (s==p) { f=1; exit } }
                END { exit(f?0:1) }' "$ledger"; then
            c9_violation "${D_NUM[$i]}" "台账部件不存在：${tok}"
            viol=$((viol + 1))
          fi
          ;;
        *)
          c9_violation "${D_NUM[$i]}" "锚点语法非法：${tok}（只允许 design-system:§N 与 ledger:<部件>）"
          viol=$((viol + 1))
          ;;
      esac
    done
    IFS="$oldifs"
  done
  if [[ $viol -eq 0 ]]; then
    echo "  ✅ 视觉锚点齐全且可解析"
  else
    echo "  ❌ ${viol} 项违规" >&2
  fi
}
```

辅助函数：

```bash
c9_violation() {  # $1=票号 $2=消息
  # PR-1 默认 warn（只告警不计违规）；PR-2 把默认值改为 enforce 并删掉本注释
  if [[ "${CW_C9_MODE:-warn}" == "warn" ]]; then
    echo "  ⚠️  [C9] $1 $2" >&2
  else
    add_violation "- [C9] $1 $2"
  fi
}
```

### 3.3 调度与汇总（2 处）

- 入口 `else` 分支：`check_c8` 之后加 `check_c9`；
- 成功输出改为 `✅ 拆票自检全部通过（C1-C9）`；
- 头注 2 的映射表加一行 `C9 视觉锚点 ← DG-4 设计系统唯一数值来源`；
- `LIVE` 分支本阶段**不改**（见 §6）。

---

## 4. 验收（DoD）

上游交付必须同时满足：

1. **自测用例全绿**（新增 `--self-test c9`，见 §5）：至少 10 例，覆盖 §2.2 全部正反例。
2. **真实拒票**：手工造一张缺锚点的 ui 票，`CW_C9_MODE=enforce ./scripts/cw-tickets-check.sh --change <x> --drafts <dir>` 退 1，stderr 出现 `[C9]` + 票号。
3. **真实放行**：补上 `design-system:§2.1; ledger:pinOff 斜杠` 后同一命令（仍 `enforce`）退 0。
4. **不误伤**：带 `no-ui-impact` 的纯文档/基建票无锚点，`CW_C9_MODE=enforce` 下仍退 0。
5. **不改契约**：退出码仍为 0/1；`--help` 更新用法说明。
6. **文档同步**（缺一不可）：
   - `docs/agents/task-tracking.md` §3 模板加 `**视觉锚点**`（放在 `**验收锚点**` 后）；
   - `AGENTS.md` 触发条件改为「标签不含 `no-ui-impact`」（§1）；
   - `docs/agents/quality-gates.md` 若有 C 系列条目则同步编号（无则不动）。
7. **无新增依赖**：bash 3.2 + 现有 python3/awk/grep/sed 即可。

---

## 5. 自测夹具（当前脚本没有 tickets-check 夹具，需新建）

建议 `scripts/fixtures/tickets-check/c9/`，每个用例一个 `.md` 票面 + 一个期望结果文件；`--self-test c9` 用 `mktemp -d` 拷贝后逐例断言**退出码 + 消息关键词**（不要断言完整文案，避免文案改动即碎）。

| # | 票面 | 期望 |
|---|---|---|
| 1 | 三分支锚点 `design-system:§2.1; ledger:pinOff 斜杠` | 放行 |
| 2 | 缺字段 | 拒：`缺少视觉锚点` |
| 3 | `18px` | 拒：`语法非法` |
| 4 | `design-system:§2.1 用 18px` | 拒：`字面量` |
| 5 | `#ef4444` | 拒：`字面量` |
| 6 | `A-1.2` | 拒：`误用验收锚点` |
| 7 | `design-system:§9.9` | 拒：`条款不存在` |
| 8 | `ledger:不存在的部件` | 拒：`台账部件不存在` |
| 9 | 全角分号 `design-system:§3；ledger:缩略图 rail` | 放行 |
| 10 | 标签含 `no-ui-impact`、无锚点 | 放行 |

另加 2 例回归：`CW_C9_MODE=warn` 时用例 2 退 0 且 stderr 有 `⚠️`；`decisions.md` 被临时改名时退 1（fail-closed，不是跳过）。

---

## 6. 灰度与推进顺序

1. **PR-1（本 change）**：解析 + C9 + 自测 + 文档同步，默认 `CW_C9_MODE=warn`。
2. **一个 change 周期**：观察 warn 日志，统计误报（目标 0）。
3. **PR-2**：默认切 `enforce`；同时在 `quality-gates.md` 登记 C9 的「捕获统计」行。
4. **PR-3（可选）**：`--live` 模式接 C9。现状 `--live` 只跑 C1，且已发布的 issue 无 draft 数组，需：
   - 抽公共函数 `parse_ticket_body <body> <out_prefix>`，draft 与 live 共用；
   - `gh issue list --state open --search "[change=<name>/" --json number,title,body,labels --limit 200`；
   - 对每个 issue 跑 C9（标签来自 `labels[].name`）。
   不做这一步，C9 只挡草稿；已发布票仍可绕过——上线 PR-1 时必须写明这个边界。

---

## 7. 非目标（不要做）

- 不判断「值是否正确/好看」——那需要视觉判据，机器不做。
- 不扫代码里的硬编码（那属于将来的颜色 lint / token 迁移）。
- 不把 `design-system:§N` 展开成具体数值（展开就产生第二份数值副本）。
- 不在 C2 里合并本检查：C2 是无条件六字段，C9 是条件式（`no-ui-impact` 豁免），混在一起会让豁免逻辑污染 C2。

---

## 8. 风险与对策

| 风险 | 后果 | 对策 |
|---|---|---|
| 仍按 `ui-surface` 触发 | 规则永不生效（DQ-1 前科） | §1 的 AGENTS 修正是本 change 的前置项，代码注释里写明触发条件来源 |
| spec 章节重编号 | 既有锚点全部失效 | spec §9 已规定刻度级修订走 supersede 且条款号不复用；C9 fail-closed 并给出「条款不存在」 |
| 台账部件名相似（「pinOff」与「pinOff 斜杠」） | 误匹配 / 漏匹配 | 第一列**精确匹配**（trim 后）；需要别名时在台账新增行，不做模糊匹配 |
| 中文对照/全角标点 | 语法合法但被拒 | 全角分号归一；PART 允许中文；正则只用 `[[:space:]]` 与字面量 |
| 灰度期被当噪音忽略 | warn 日志无人看 | PR-1 描述里写明观察指标（warn 条数、误报数），一轮后必须切 enforce |
| live 未接 | 已发布票绕过 | PR-1 文档写明；PR-3 排期 |

---

## 9. 交付清单（上游自查）

- [ ] `scripts/cw-tickets-check.sh`：解析层 4 处 + `check_c9` + `c9_violation` + 调度 + 头注 + `C1-C9` 汇总
- [ ] `scripts/fixtures/tickets-check/c9/` 12 例 + `--self-test c9`
- [ ] `docs/agents/task-tracking.md` 模板加字段（并统一「字段数」口径）
- [ ] `AGENTS.md` 触发条件修正（§1）
- [ ] `docs/agents/quality-gates.md` 编号同步（如有 C 系列）
- [ ] PR 描述写清：默认 warn、观察指标、live 未接的边界
- [ ] `bash -n scripts/cw-tickets-check.sh` 通过；在 macOS 自带 bash 3.2 下跑一遍（不要只在 bash 5 里测）
