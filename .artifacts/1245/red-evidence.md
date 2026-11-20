# #1245 红证据（修复前）

分支：`fix/1245-managed-date-order` @ `6d0e52a`

## 夹具（新增，含托管日期）

```
---
title: 行操作
category: 草稿
author: 张三
source: 网络
note: 备注
created: 2026-11-17
updated: 2026-11-17
---
```

`fields`（面板行）= `allFields` 去掉 `created`/`updated` = `[title, category, author, source, note]`。
旧夹具 `ROW_DOC` 没有托管日期，所以 `managedKeysPresent=false`，旧用例永远命中不到这段逻辑。

## 单元测试红（`src/__tests__/frontmatter.test.ts`）

新增 `mergeManagedDates` 纯函数用例，修复前该函数不存在：

```
Test Files  1 failed | 1 passed (2)
     Tests  5 failed | 90 passed (95)
TypeError: mergeManagedDates is not a function
```

## E2E 红（`e2e/doc-property-panel.spec.ts -g "#1245" --retries=0`）

3 条新用例全红，症状与工单一致：

1. B 态拖拽：第 4 行 `source` 拖到第 2 行 `category` 下方，落点线出现，松手后顺序**不变**。

```
- Expected  - 1
+ Received  + 1
  Array [
    "title",
    "category",
-   "source",
    "author",
+   "source",
    "note",
  ]
```

2. A 态拖拽：第 4 行 `note` 拖到第 2 行 `author` 下方，顺序**不变**。

```
  Array [
    "category",
    "author",
-   "note",
    "source",
+   "note",
  ]
```

3. 调色板中位插入：`添加字段` → 拖 `date` 到 `author` 行，新字段被**追加到末尾**。

```
  Array [
    "title",
    "category",
-   "new-field",
    "author",
    "source",
    "note",
+   "new-field",
  ]
```

## 根因（复述）

`src/components/Content/DocPropertyBar.tsx:2112` `withManagedDates(editable)` 以
`parsed.fields`（原文顺序）为基准重建输出：按原文键序把 `editable` 里的键重新 push 一遍，
剩余键（含新插入的调色板键）追加到末尾。

- 拖拽后 `editable` 已是新顺序 → 被还原回原文顺序 → 写回文本等于原文 →
  `commitFields` 的 `result.text !== content` 守卫跳过 dispatch → 界面不动。
- 新调色板键不在 `parsed.fields` → 落入末尾追加循环 → 永远最后。

仅当文档含 `created`/`updated`（`managedKeysPresent`）时触发。

完整原始输出：`.artifacts/1245/red-e2e-output.txt`
