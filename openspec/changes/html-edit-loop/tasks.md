# Tasks: HTML 编辑闭环（H1）

## 1. 预览

- [ ] 1.1 `.html` 走 `FramePreview`（iframe sandbox），不再按纯文本渲染
- [ ] 1.2 相对路径资源重写为 `convertFileSrc`（复用 `renderers/html.ts`），补单测
- [ ] 1.3 预览按当前 `tab.content` 重建 srcdoc（编辑后切回来能看到改动）

## 2. 编辑

- [ ] 2.1 确认三模式切换不 remount（现有 `display` 方案），补一条 e2e 断言
- [ ] 2.2 编辑态与预览共用同一份 content（保存写回字节不变）

## 3. 验证

- [ ] 3.1 e2e `html-edit-loop.spec.ts`：预览渲染 / 改一行同步 / 相对图片可加载
- [ ] 3.2 `bash scripts/verify.sh` 全绿
