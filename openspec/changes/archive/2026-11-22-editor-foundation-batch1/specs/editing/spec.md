## ADDED Requirements

### Requirement: E-40 编辑器内容同步与输入吞吐

编辑器与页签内容之间的同步 SHALL 按「写入者归属 + 修订号」协议执行，杜绝旧快照全文覆盖用户刚敲的字。内容快照 SHALL 经节流写入 store，键入时 SHALL NOT 每键全量写；所有以 store 快照为准的出口 SHALL 先从 live 编辑器取全文再落盘。

每个页签 SHALL 持有 `contentRevision`（单调递增）与 `lastWriter`（面板 id 或 `"external"`）；每个 EditorView SHALL 记录 `lastAppliedRevision`。写入者自身回声（`lastWriter === 本面板`）SHALL 被跳过；其余变化 SHALL 按公共前后缀裁剪为最小 diff 应用，事务附 `annotations: [Transaction.addToHistory.of(false), isolateHistory.of("before")]`，应用前 SHALL 校验 view 归属且位置 clamp 到文档范围。整篇灌入 SHALL 仅发生在页签首次装载或可见性首次置真。

store 内容快照 SHALL 采用 300ms 防抖 + 2000ms 截止；`dirty` SHALL 在首次键入时立即置位。保存、另存为、导出（PDF/HTML/PNG/docx/mdpkg）、打印、切页签、进入预览、组件卸载、窗口关闭与外部回灌前，SHALL 强制 flush，flush SHALL 从 live `EditorView.state.doc` 取全文写 store。

#### Scenario: 双面板同页签镜像一致

- **WHEN** 同一页签在两个面板同时可见，面板 A 连续输入 5 次
- **THEN** 面板 B 的文本 SHALL 与面板 A 相同（差异字符数为 0），且不出现互相覆盖导致的分叉

#### Scenario: 外部回灌后一次撤销不清空正文

- **WHEN** 外部内容回灌到当前页签后，用户按一次撤销
- **THEN** 正文 SHALL NOT 被清空（文档长度 ≥ 1），回灌事务 SHALL NOT 进入撤销历史，撤销 SHALL 只回退用户真实编辑步

#### Scenario: 键入快照节流

- **WHEN** 用户在 200ms 内连续键入 10 次
- **THEN** store 内容快照的更新次数 SHALL ≤ 2，且首次键入后 `dirty` SHALL 为 true

#### Scenario: 保存前 flush 与节流截止收敛

- **WHEN** 用户键入后在 50ms 内触发保存
- **THEN** 落盘内容与编辑器全文 SHALL 差异字符数为 0，保存 SHALL 读取 flush 后的 live 全文而非过期快照
- **AND** 键入后等待超过 2100ms，store 内容快照与编辑器全文 SHALL 差异字符数为 0

### Requirement: E-41 撤销历史边界与键位语义

编辑器的撤销历史 SHALL 遵循三原则：用户可感知变更 SHALL 带 `userEvent`；程序回灌 SHALL NOT 进入历史但 SHALL 以 `isolateHistory` 切断与相邻分组的连接；结构命令 SHALL 每意图一个独立 undo 步。键位 SHALL 恢复 CodeMirror `defaultKeymap` 的缩进语义，SHALL NOT 将 `Mod-[`/`Mod-]` 误绑为撤销/重做。

结构命令（标题升降、列表缩进、智能回车、智能退格、块转换）SHALL 通过结构事务助手 `structureTransaction` 执行，事务 SHALL 附加 `userEvent: "app.structure"` 与 `isolateHistory.of("full")`。撤销/重做主键位 `Mod-Z`/`Ctrl-Z` SHALL 保持由 `historyKeymap` 与历史绑定承载，不受键位纠偏影响。

#### Scenario: 结构命令一次意图一次撤销

- **WHEN** 用户对一段文本执行一次标题降级，随后按一次 ⌘Z
- **THEN** 文档 SHALL 与操作前字符差异数为 0，标题降级 SHALL 作为单一 undo 步完全还原

#### Scenario: 连续结构命令只回退最后一次

- **WHEN** 用户连续执行两次结构命令，随后按一次 ⌘Z
- **THEN** SHALL 仅回退最后一次结构命令，回退字符数 SHALL 等于第二次 change 的长度，第一次结构命令 SHALL 保持不变

#### Scenario: Mod-[ 恢复减少缩进语义

- **WHEN** 用户在有序列表上按 `Mod-[`
- **THEN** 该行缩进 SHALL 减少一级（减少的缩进级数为 1），列表内容 SHALL NOT 回退，键位表 SHALL NOT 存在 `Mod-[` 绑定 undo 的条目

#### Scenario: 撤销主键位不受纠偏影响

- **WHEN** 用户按 `Mod-Z`/`Ctrl-Z` 执行撤销与重做
- **THEN** 撤销与重做 SHALL 正常生效，其键位绑定 SHALL 由历史键位承载，不受 `Mod-[`/`Mod-]` 移除影响
