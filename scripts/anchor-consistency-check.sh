#!/usr/bin/env bash
# 规格 / 实现 / 测试锚点 三方一致性机检（#1442，oracle-gap 策略 P0）。
#
# 背景：#1434（菜单行高 规格36/实现32/锚点36）暴露「真值三方分叉且红灯无人路由」。
# 本脚本把「同一几何在三处必须同值」变成机器判定：
#   - 任一方模式缺失 → 该项差异（spec-missing / impl-diverge / test-diverge）
#   - 差异项若在 anchor-allowlist.tsv 登记豁免（带 issue 号）→ WARN 继续
#   - 差异项未豁免 → FAIL
# 用法：
#   scripts/anchor-consistency-check.sh            # 非严格：差异仅豁免项时 exit 0
#   scripts/anchor-consistency-check.sh --strict   # 任何未豁免差异 exit 1（CI 用）
# 新增核对项：在 CHECKS 段照格式加一行即可；豁免必须写 issue 号与到期理由。
set -uo pipefail
STRICT=0
[[ "${1:-}" == "--strict" ]] && STRICT=1
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT" || exit 1

SPEC_EDITING="openspec/specs/editing/spec.md"
SPEC_DESIGN="docs/design/system/spec.md"
IMPL_MENU="src/editors/orchestration/menu-metrics.ts"
IMPL_ICONS="src/editors/icons.ts"
IMPL_CSS="src/styles/editor.css"
TEST_ANCHORS="e2e/fixtures/editor-anchors.ts"
ALLOWLIST="scripts/anchor-allowlist.tsv"

pass=0; warn=0; fail=0

# check <名称> <期望值> <spec文件> <spec grep -E> <impl文件> <impl grep -E> <test文件> <test grep -E>
check() {
  local name="$1" want="$2" sf="$3" sp="$4" imf="$5" ip="$6" tf="$7" tp="$8"
  local s=0 i=0 t=0
  grep -qE "$sp" "$sf" 2>/dev/null && s=1
  grep -qE "$ip" "$imf" 2>/dev/null && i=1
  grep -qE "$tp" "$tf" 2>/dev/null && t=1
  if [[ $s -eq 1 && $i -eq 1 && $t -eq 1 ]]; then
    echo "  PASS  $name (=$want)"
    pass=$((pass+1)); return 0
  fi
  local detail=""
  [[ $s -eq 0 ]] && detail+=" spec-missing($sf)"
  [[ $i -eq 0 ]] && detail+=" impl-diverge($imf)"
  [[ $t -eq 0 ]] && detail+=" test-diverge($tf)"
  # 豁免判定
  if [[ -f "$ALLOWLIST" ]] && awk -v n="$name" '$1==n{found=1} END{exit !found}' "$ALLOWLIST"; then
    local ref; ref=$(awk -v n="$name" '$1==n{print $2; exit}' "$ALLOWLIST")
    echo "  WARN  $name 分叉已豁免（issue ${ref}）:$detail"
    warn=$((warn+1)); return 0
  fi
  echo "  FAIL  $name 期望 $want:$detail"
  fail=$((fail+1))
}

echo "== 规格/实现/锚点 三方一致性（#1442）=="

# --- 菜单几何（E-7 / menu-metrics / editor-anchors）---
check "menu_width"      "176"    "$SPEC_EDITING" "176px 宽"                       "$IMPL_MENU" "MENU_WIDTH = 176"          "$TEST_ANCHORS" "width: 176"
check "menu_row_height" "32"     "$SPEC_EDITING" "行高 32px"                      "$IMPL_MENU" "MENU_ROW_HEIGHT = 32"      "$TEST_ANCHORS" "rowHeight: 32"
check "menu_icon_size"  "18"     "$SPEC_DESIGN"  "14 / 18 / 24 三档"              "$IMPL_ICONS" 'ICON_SIZE_PX = "18px"'    "$TEST_ANCHORS" "menuIcon: 18"
check "handle_pill"     "42x26"  "$SPEC_EDITING" "42×26 药丸"                     "$IMPL_CSS"  "width: 42px;"              "$TEST_ANCHORS" "handle: \{ width: 42, height: 26 \}"

echo "== 结果: PASS=$pass WARN=$warn FAIL=$fail =="
if [[ $fail -gt 0 ]]; then
  echo "存在未豁免的三方分叉。裁决路径：改实现则同步规格与锚点；改规格则走 openspec supersede 并同步两侧。"
  exit 1
fi
if [[ $STRICT -eq 1 && $warn -gt 0 ]]; then
  echo "--strict：豁免项视为失败，请裁决后清除豁免。"
  exit 1
fi
exit 0
