#!/usr/bin/env bash
# 并行会话 worktree 自动识别（#1443 收尾；制度化的 learnings 2026-11-16 教训）。
#
# 用法：准备开工一个新会话时，先跑一次：
#   bash scripts/session-worktree.sh --check   # 只报告，不动文件
#   bash scripts/session-worktree.sh           # 主工作区忙 → 创建/复用独立 worktree 并打印 cd 路径与端口
#
# 「主工作区被占用」判定（命中任一即忙）：
#   1) 端口 1420 的 dev server 进程 cwd 指向本仓
#   2) 源码/文档存在 25 分钟内的新改动（排除 node_modules/.git/.artifacts/target）
#
# 忙时行为：取下一个空闲的 ../<repo>-auto-<n>（基于 origin/main 新建，分支 auto/session-<n>），
# symlink 主工作区 node_modules（免重装），并分配一个空闲的 VITE_DEV_PORT（1421 起；
# vite.config.ts 已支持该环境变量）。把脚本打印的 cd / export 两行粘进新会话即可。
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
BASE="$(basename "$ROOT")"
CHECK_ONLY=0
[[ "${1:-}" == "--check" ]] && CHECK_ONLY=1

busy_reason() {
  # 1) dev server 占 1420 且属于本仓
  local pids cwds
  pids=$(lsof -ti tcp:1420 -sTCP:LISTEN 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    while IFS= read -r p; do
      cwds=$(lsof -p "$p" 2>/dev/null | awk '$4=="cwd"{print $NF}')
      if [[ "$cwds" == "$ROOT"* ]]; then echo "dev server(pid $p) 运行于本工作区（端口 1420）"; return 0; fi
    done <<< "$pids"
  fi
  # 2) 25 分钟内的源码/文档改动（并行会话的活指纹）
  local hit
  hit=$(find "$ROOT" -type f -newermt '-25 minutes' \
      -not -path '*/node_modules/*' -not -path '*/.git/*' \
      -not -path '*/.artifacts/*' -not -path '*/target/*' \
      -not -path '*/.opencode/*' -not -path '*/test-results/*' \
      2>/dev/null | head -1 || true)
  if [[ -n "$hit" ]]; then echo "近期改动：${hit#$ROOT/}"; return 0; fi
  return 1
}

free_port() {
  local p
  for p in $(seq 1421 1429); do
    lsof -ti "tcp:$p" -sTCP:LISTEN >/dev/null 2>&1 || { echo "$p"; return 0; }
  done
  echo ""; return 1
}

reason="$(busy_reason || true)"
if [[ -z "$reason" ]]; then
  echo "主工作区空闲：留在 $ROOT 开工即可。"
  exit 0
fi

if [[ "$CHECK_ONLY" == "1" ]]; then
  echo "主工作区忙（${reason}）——新会话应使用独立 worktree。"
  exit 0
fi

i=1
while [[ -e "$ROOT/../${BASE}-auto-${i}" ]]; do i=$((i+1)); done
WT="$ROOT/../${BASE}-auto-${i}"
BRANCH="auto/session-${i}"

git worktree add -b "$BRANCH" "$WT" origin/main
ln -s "$ROOT/node_modules" "$WT/node_modules"
PORT="$(free_port)"
[[ -z "$PORT" ]] && PORT=1429

echo "已创建隔离 worktree（基础 origin/main）："
echo "  cd $WT"
echo "  export VITE_DEV_PORT=$PORT"
echo "在该目录启动新会话；dev server 用 \`npm run dev\`（自动用 \$VITE_DEV_PORT）。"
