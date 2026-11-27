# #1603 二轮（真机取证后）证据纪要

真机证据：中汽系统搭建情况对称1110.md.crop-debug.log（2026-11-27 13:12）+ 两张截图

## 签名 → 根因 → 修复
| 签名 | 根因 | 修复 |
|---|---|---|
| JUMP 1293→909 / 1796→1423（向上 ~380px，紧跟 pointerdown:cm-line） | 裁剪态 suppressCaret 白名单放行 .cm-scroller → 光标落位 caret 揭示滚动 | 白名单移除 .cm-scroller（模态会话点框外=确认路径） |
| 截图整套裁剪 UI 残影（DOM 计数 0） | WKWebView GPU 合成层未刷新；scroller filter 不足以清子层缓存 | 子层 filter 先行 + 恢复 1px 回弹 + scroller filter（三重） |
| 「重置图片」ExpandOutlined 与全屏撞形 | 四角外扩=全屏观感 + 与 fileEmbed 展开同图标 | 新增 UndoOutlined（撤销箭头） |
| 「+ 调整后回 100%」守卫未挡 | 写入者静态不可见 | DEV 探针 [maximize-probe] 记录调用栈 + 守卫容差 ±0.001 |

## 验证
- tsc 0；vitest 2265 全过；e2e 15 passed（1 flaky=CDP wheel 抖动，3 次重跑全绿，DQ-4 机制解释：非确定性损坏）

## 真机待验
1. 裁剪态点框外不再上跳（log 签名应消失）
2. 裁剪后蒙层/框残影是否消失（组合拳）
3. 「+ 调整后回 100%」复现时看 dev console `[maximize-probe]` 调用栈 → 定位写入者后精准修
4. UndoOutlined 观感
