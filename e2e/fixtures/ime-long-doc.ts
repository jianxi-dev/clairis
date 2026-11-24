/**
 * IME 稳定性夹具（#1437）：正文里放两个加载失败的图片 widget + 一个标注块，
 * 组合输入发生在文末。图片加载失败是崩溃现场的稳定结构特征：widget 在视口内
 * 且装饰范围必须随组合文本映射，否则视图 tile 树会错位。
 */
export function imeDoc(): string {
  return [
    "---",
    "title: 输入稳定性夹具",
    "tags:",
    "  - 测试",
    "---",
    "",
    "开头段落，用于确认组合输入前后内容仍在。",
    "",
    "![示意图](assets/missing-a.png){width=600}",
    "",
    "![视频帧](<assets/missing-b.mp4>){width=600}",
    "",
    "> [!WARNING]{bg=darkred border=green text=yellow}",
    "> 标注正文，含 `行内代码` 与 **粗体**。",
    "",
    "1. 第一项",
    "2. 第二项",
    "   - [ ] 子项一",
    "",
    "结尾段落。",
  ].join("\n");
}
