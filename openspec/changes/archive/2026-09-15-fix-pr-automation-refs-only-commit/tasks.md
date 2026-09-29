## 1. 修复 commit message 关键字

- [ ] 1.1 修改 `scripts/pr-automation.sh` 第 211 行：将硬编码 `fixes #$ISSUE` 改为根据 `REFS_ONLY` 动态选择 `refs #$ISSUE` 或 `fixes #$ISSUE`

## 2. 验证

- [ ] 2.1 运行 `bash scripts/verify.sh` 确认全绿
- [ ] 2.2 手动验证 `--refs-only` 模式下 commit message 使用 `refs #N`
