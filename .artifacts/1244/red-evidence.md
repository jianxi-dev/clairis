# #1244 RED 证据：隐藏恢复后属性块未重新挂载

## 复现步骤（真实浏览器，Playwright）

1. 编辑态打开含 frontmatter 的 markdown：属性块以 `.cm-dpb-embed` 嵌入正文流首块。
2. 双击属性块上沿外侧（编辑区顶部内边距，`.cm-content` padding 2.5rem 区域）。
   - 选中 frontmatter 组 → `createFrontmatterHideDecorations` 在
     `src/editors/decorations/frontmatterHide.ts:139` 命中
     `frontmatterTouchesSelection` 返回 null → replace 装饰撤销、widget DOM 销毁、
     源码 `---...---` 揭示。此行为是既有契约（防编辑盲区），非缺陷。
3. 单击同一位置（光标落回块起点 0）→ 选区不再落入块内 → 装饰重建、
   `.cm-dpb-embed` DOM 重新创建。

## 失败输出（修复前）

```
✘ e2e/doc-property-embed.spec.ts › 双击揭示 frontmatter 后单击恢复：属性块重新挂到新宿主（#1244）

Error: expect(locator).toHaveCount(expected) failed
Locator:  locator('.cm-content > .cm-dpb-embed').locator('.dpb-panel')
Expected: 1
Received: 0
Timeout: 5000ms
```

原始日志：`.artifacts/1244/red-raw.log`

## 探针 DOM 证据（`e2e/_probe1244.spec.ts`）

```
GEOM content.y=28  embed.y=68  embed.h=147  panel.y=80
S1(双击后) embedPresent=false  bodyText="---\ntitle: 嵌入测试\ntags:..."
S2(单击后) embedPresent=true  embedConnected=true  embedChildren=0
             panelInEmbed=0
             hosts=[{connected:true, cls:"cm-dpb-embed", children:0, panelInside:0}]
             bodyText="# 正文标题..."
```

即：恢复后 `.cm-dpb-embed` 是**新的、已连接**的 DOM，但**子节点为 0**——React portal
仍渲染进被 CM6 销毁的旧宿主节点（detached），所以源码已隐藏、属性块又不可见，
形成用户报告的「空白间隙」。

## 根因（file:line）

- `src/components/Content/ContentArea.tsx:686-697`：`embedHost` 由 rAF effect 设置，
  依赖 `[embedActive, propPanelCollapsed, tab?.id, editorViewState]`；装饰翻转
  （widget 销毁/重建）时这些依赖都不变 → `embedHost` 停在旧节点。
- `src/components/Content/ContentArea.tsx:892`：`createPortal(renderPropertyBar(), embedHost)`
  把面板渲染进 detached 节点。
- 同类前案：#1226 多格宿主错位（已由「按本格自查」修复），本次是同一
  「stale host」类别在装饰翻转下的复现。
