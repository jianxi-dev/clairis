# #1602 QG-5 证据纪要

验证基于分支 `fix/caption-save-visibility`（源基线 origin/main 05926438）

## 自动化验证
| 命令 | 结果 |
|---|---|
| `npx tsc --noEmit` | 0 |
| `npm test` | 182 files / 2265 tests 全过 |
| `npx playwright test caption-save-visibility + image-block-edit + image-crop-session` | 43 passed / 1 failed |

唯一失败：`image-block-edit.spec.ts › 工具条 9 按钮` —— 既有过期测试（工具条现为 10 按钮，origin/main 同样），属 #1598，与本次无关。

## 运行时证据（复现路径的自动化）

新增 `e2e/editors/caption-save-visibility.spec.ts` 三条用例**即为 A/B/Esc 三态的运行时断言**：
- **A** 输入「诊断描述」→ 点外部保存 → 文档含 `"诊断描述"` → 重选图片描述行显示该文字
- **B** 清空 → 点外部保存 → 文档**移除** `"旧描述"` → 重选后描述行回占位「输入图片描述」
- **Esc** 取消 → 文档不含写入内容（既有行为不变）

## 截图覆盖说明（诚实声明）

- `state-1-input.png`：描述输入态真实截图
- 态 2-4（saved/cleared/esc）：单帧截图未采集——编排者两轮探针因时序与正式测试不一致而失败；**这三态由正式 e2e 三条用例的运行时断言承载**（screenshot 字段指向 spec 文件内对应用例），e2e 通过即为证据。

## 修复要点
- B：`finish()`/`hideCaptionInput()` 写回判据「空串跳过」→「与 current 相同才跳过」（空串走 `writeImageTitle(from,"")` 移除分支）
- A：`captionCommitUntil` 300ms 提交窗口；全局 click 与 IO deselect 在窗口内豁免（保存那次点击不再误清选中态）
- 未采纳诊断的「deselect 不删 caption」方案：实测破坏既有 crop-session/image-block-edit 两条用例，且对 A 非必需（重选时按 data-image-title 重建）——已回退，依据记入诊断报告
