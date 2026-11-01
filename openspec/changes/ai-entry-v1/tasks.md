# Tasks: AI 入口 V1

> 本 change 只有一个交付任务（1 change = 1 issue = 1 PR）。

- [ ] 1.1 ⌘K 浮层 + 选区动作 + 撤销条 + 快照面板 + 确认密度：让用户能用一句话改配置、能对选区做改写/翻译/润色，并且任何改动都能一键退回

  执行步骤：

  1. `src/components/ai/CommandOverlay.tsx`：⌘K 浮层（打开/关闭/点外部/Esc/空态/提交中/错误态）。
  2. `src/hooks/useAiEntry.ts`：提交 → 快照头记录 → `run_agent_turn` → 改动摘要 + 撤销条状态。
  3. 撤销条：3 秒淡出、hover 重现、恢复上一份快照。
  4. 选区胶囊 + diff + 应用/取消。
  5. 快照面板：列表 + 恢复。
  6. `aiConfirmDensity` 配置项（Rust + 类型 + 设置读写）。
  7. 错误人话映射；禁 emoji。
  8. 测试：e2e（打开/关闭/外部点击/空态/撤销恢复）+ vitest（快照指向）。
  9. 验证：`verify.sh` + `npm run tauri dev` 手动走一遍。
