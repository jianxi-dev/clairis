# Tasks: .mdpkg 移植

> 本 change 只有一个交付任务（1 change = 1 issue = 1 PR）。

- [x] 1.1 搬 vendor + 封装 + 测试：`.mdpkg` 能解包且错误不抛、入口源码可读、打包往返一致且 manifest 字段封闭

  执行步骤：

  1. 复制 `md-bundle/packages/app-kit/vendor/mdpkg-web.js` 到 `src/lib/mdpkg/vendor/`。
  2. 写 `src/lib/mdpkg/index.ts`：`openPackage` / `readEntrySource` / `packPackage`（vendor 有则暴露）+ 类型 + 错误码中文化。
  3. 搬测试到 `src/__tests__/mdpkg.test.ts`，补打包往返与 manifest 额外字段被拒。
  4. 验证：`npx vitest run src/__tests__/mdpkg.test.ts`、`npx tsc --noEmit`、`npx eslint src/lib/mdpkg`。
