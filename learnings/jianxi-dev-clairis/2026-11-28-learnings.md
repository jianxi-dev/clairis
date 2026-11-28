## 2026-11-28 晨验（ui-quality-gate-v1）

- **跨多次合并后验收 UI 前必须重启 `npm run tauri dev`**：HMR 在多轮合并后漂移，旧模块会让「图片放大层 Esc 不退」「⌘⇧U 一次退两层」看起来像产品缺陷；重启后同一路径复验全部通过。判据：症状只在真机出现、headless 复现不出时，先重启再判定。
- 真机 Esc 探针写法：`window` 捕获 + `document` 捕获各挂一个 logger（记录 `key` / `defaultPrevented` / `document.querySelector('[data-testid="img-maximize"]')` 是否存在），可区分「事件没到页面」「监听没跑」「跑了但又被重开」三种。
- 组件自带 Esc 监听时必须自己实现分层：`CommandOverlay`（⌘K）原先在捕获阶段无条件关窗，越过确认卡（#1686，已修）。
