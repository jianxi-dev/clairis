# Tasks: HTML 可视化编辑（H2）

切片顺序见 design D8。**每条编号项 = 一张票 = 一个可验收交付单元**（QG-7：做完能在页面上看到东西）；
缩进 bullet 是同一张票内的检查点，不单独拆票——单独拿出来都看不到东西。

集成 checkpoint（QG-6，票数 6）：票 2.1 完成后跑一次浏览器记录用户可见变化，票 3.1 完成后再跑一次；记录落在对应票上。

## 1. 模型层（纯函数）

- [x] 1.1 `src/editors/html/model.ts`：`listNodes`（tag:index 可复现）/ `annotate`（属性+注释双轨，raw-text 跳过）/ `cleanSnapshot`（剥编辑痕迹）
  - `cleanSnapshot` 幂等；`data-cm-*`、`cmid`、`contenteditable` 零残留
  - 单测覆盖 raw-text 回归（style/script 内不出现 cmid）

## 2. 编辑态 iframe 通道

- [x] 2.1 `HtmlVisualEditor` + `buildEditableDoc`：srcdoc + `script-src 'nonce-…'`；`ContentArea` 接线，`.html` 编辑态挂可视化、源码态 CM6 `display` 不重建
  - 用户文件自带脚本不执行，注入运行时执行
  - e2e 断言 `.cm-content` 节点身份跨模式不变

## 3. 点选与高亮

- [ ] 3.1 `bridge.ts` 收口桥消息 + 高亮框渲染（`src/styles/` 同步）
  - 点选换框、点空白清除

## 4. 文本编辑

- [ ] 4.1 双击进 `contenteditable`，`textEditBegin/Input/End` 上报；以 `content` 为唯一真相回写；Enter 拆块

## 5. 保存闭环

- [ ] 5.1 `snapshot` → `cleanSnapshot` → 写回；打开不产生副作用
  - 保存后文件内搜不到 `cm-`/`cmid`（e2e 断言）
  - 再打开内容与保存前一致（幂等）
  - `bash scripts/verify.sh` 全绿

## 6. 文档与 ADR

- [ ] 6.1 overview 补面板位置 + 两条 ADR（D2/D5）+ 台账 E-16
