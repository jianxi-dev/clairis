# #1232 红证据（H1：别称标题键 `标题:` 不同步）

## 结论

`renameTab`（src/stores/index.ts:695）用裸键 `f.key === "title"` 定位标题字段，
`DocPropertyBar` 的标题位（src/components/Content/DocPropertyBar.tsx:2077）同样裸键匹配。
内置别称表 `ALIAS.title = ["标题"]`（src/lib/frontmatter.ts:186）只用于「类型识别」，
不改写键名，因此文档用 `标题:` 时：

- `renameTab` 找不到标题字段 → `needDoc=false` → 只改页签名，**不回写文档**；
- 面板标题位找不到 → 显示「（无标题）」，`标题` 仅作为普通字段行。

## 红用例（单元，先红后绿）

`src/__tests__/store.test.ts` 新增：

```ts
it("页签重命名回写别称标题键（标题）", () => {
  useStore.getState().openFile("/z.md", "---\n标题: 旧名\n---\n");
  const id = Object.keys(useStore.getState().tabs)[0];
  useStore.getState().renameTab(id, "新名");
  const tab = useStore.getState().tabs[id];
  expect(tab.title).toBe("新名");
  expect(tab.content).toContain("新名");
});
```

## 失败输出（修复前）

```
 FAIL  src/__tests__/store.test.ts > 新建默认与标题联动（P-7） > 页签重命名回写别称标题键（标题）
AssertionError: expected '---\n标题: 旧名\n---\n' to contain '新名'

- Expected
+ Received

- 新名
+ ---
+ 标题: 旧名
+ ---

 ❯ src/__tests__/store.test.ts:343:25
Tests  1 failed | 28 passed (29)
```

## 红用例（e2e `e2e/doc-property-panel.spec.ts`）

`doc-property-panel.spec.ts` 新增「双击页签重命名 → 别称标题键（标题）同步（#1232）」。
把三处源码修复（frontmatter.ts / stores/index.ts / DocPropertyBar.tsx）`git stash` 后运行：

```
 ❯ e2e/doc-property-panel.spec.ts:2657 › 双击页签重命名 → 别称标题键（标题）同步（#1232）
Locator: locator('[data-testid="dpb-a"]').locator('[data-testid="dpb-title"]')
Expected: "原中文名"
Error: element(s) not found
 2665 |   await expect(a.locator('[data-testid="dpb-title"]')).toHaveText("原中文名");
 1 failed
```

即修复前面板根本没有标题位（`标题:` 只是普通字段行），重命名更无从同步。

## 对照：裸键 `title:` 路径（已绿，非本票缺陷）

同一用例把 `标题:` 换成 `title:` 即通过；预览/编辑/源码、A/B 两态、新建/打开、
分屏、脏编辑器均同步。故本票根因锁定为「别称标题键未识别」（H1），
而非「store 写未达编辑器」（Brief 的 Suspect A 已被证伪）。
