# Code Review — #218（reading-surface-refine 5.1）

- 审查者：Atlas（写者 = Sisyphus-Junior/LongCat-2.5，跨模型验证分离）
- 基于 HEAD：`3cdae54` + 工作区改动（分支 feat/reading-surface-refine-5.1，G2 前 rebase 至 origin/main=461b086）
- 验证原始输出：tsc exit 0；eslint 0 errors（39 既有 warnings）；vitest 98 files/1276 tests 全过；e2e settings-reading 4/4（本会话亲跑）；tauri 套 47 passed（子代理跑）；css-manifest 88/159 无缺失
- 视觉探针（cw-vision describe，编排者亲跑）：设置面板行宽三档/配色四项呈现、宽松+赭石选中态确认、窄窗无横向溢出；describe 对正文右上角按钮的「可能是设置」判断被 DOM 枚举证伪——该按钮为窗格「更多操作」菜单（既有控件），阅读区 DOM 无任何设置入口（.reader-settings=0、[aria-label=阅读设置]=0）

## Standards 轴

| 检查项 | 结论 |
| --- | --- |
| 移除完整性 | ✓ ReaderSettingsPopover.tsx 整文件删除（-141）+ PreviewView import/用法移除 + reader.css 死样式 -118 行（.reader-settings*/.reader-pill*/.reader-range/.reader-swatch 连根清），无死代码残留 |
| 能力迁移 | ✓ 字号保留在外观区（font-size-*，既有）；行宽三档 720/1080/1200（紧凑/标准/宽松）+ 配色四项 paper/indigo/moss/clay（纸墨/靛青/松绿/赭石）新增于阅读空间区；写 config.readerWidth/readerSkin + saveAppConfig 既有通道；配色切换即时 applyReaderSkin |
| 自适应 | ✓ 根容器 min-h-0 overflow-hidden；导航 min-h-0 overflow-y-auto（独立滚动）；内容区 min-h-0 flex-1 overflow-y-auto |
| 反模式扫描 | ✓ 无 as any/@ts-ignore/console.log/TODO/死样式 |
| token 体系 | ✓ 按钮态全用 --app-* token（accent/border/text-2/sunken），无硬编码灰阶 |
| 范围纪律 | ✓ diff 限于 PreviewView/SettingsView/reader.css + 测试 + e2e；未触碰 #215-#217 域；无新增依赖 |

## Spec 轴（逐条对照票面 AC）

| AC | 实现 | 证据 |
| --- | --- | --- |
| 正文设置浮层 0 | 组件/入口/样式三处移除 | vitest「浮层 0」用例 + e2e「正文右上角不再有阅读设置入口」+ 探针态 01 + DOM 枚举（右上仅窗格控件与大纲） |
| 行宽/配色在设置 | reader-width-720/1080/1200 + reader-tone-paper/indigo/moss/clay | e2e「可改并持久化生效」（count 3/4 + localStorage 断言）+ 探针态 02/03 |
| 配色即时生效 | applyReaderSkin → html[data-skin] | e2e data-skin=indigo 断言 + 探针态 03（clay） |
| 字号保留 | 外观区既有 font-size-* 未动 | e2e/tauri/reader-typography.spec.ts 迁移后 4 用例走设置链路（tauri 套 47 passed） |
| 窄窗设置可滚动 | min-h-0 + 独立 overflow | e2e 500×700 强制溢出滚到底 + 探针态 04（无横向溢出） |
| 布局/密度/卡片高度在设置 | 既有控件验证未动 | vitest/既有用例覆盖 |

## 结构审查（risk-medium pre-landing）

- SQL：无 — 不适用
- LLM 信任边界：无新增注入面 — 不适用
- 条件副作用：chooseReaderSkin 即时应用皮肤 + 持久化，Esc 关设置后阅读态继承 data-skin（e2e 断言）— 通过
- scope drift：无（e2e/tauri/reader-typography.spec.ts 的 4 处迁移是被移除组件的既有用例跟随，属票内责任）— 通过

## 测试真实链路复核（QG-4）

e2e 走真实键盘（Meta+,）/点击/持久化读取/计算样式；窄窗用例强制内容溢出后断言可滚动到底（非元素存在）；视觉探针由状态断言驱动截图。✓

## 未决项

无（0 未决）。

留痕：e2e 默认套另有 17 条既有失败（shortest-path 3 + ui-fidelity 14，#216 域块手柄几何），已在干净 origin/main 复现，非本票引入，由 #216 域/维护者跟进。
