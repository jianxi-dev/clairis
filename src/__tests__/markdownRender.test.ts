import { describe, it, expect } from "vitest";
import { renderMarkdown, takeDarkVars } from "../renderers/markdown";

describe("renderMarkdown 代码块", () => {
  it("有语言标注时输出语法高亮与语言标签", () => {
    const html = renderMarkdown("```js\nconst a = 1;\n```");
    expect(html).toContain("code-block");
    expect(html).toContain("tok-keyword");
    expect(html).toContain("code-lang");
    expect(html).toContain("code-copy");
  });

  it("无语言标注时回退为朴素代码块", () => {
    const html = renderMarkdown("```\nplain text\n```");
    expect(html).toContain("code-block");
    expect(html).not.toContain("tok-");
    expect(html).not.toContain("code-lang");
  });

  it("不支持的语言回退为朴素代码块", () => {
    const html = renderMarkdown("```brainfuck\n+++\n```");
    expect(html).toContain("code-block");
    expect(html).not.toContain("tok-");
  });

  it("代码块内的标签被转义，不产生脚本", () => {
    const html = renderMarkdown("```js\n<script>alert(1)</script>\n```");
    expect(html).not.toContain("<script>");
    // 高亮会把标签拆成多个 span，只验证尖括号已被转义
    expect(html).toContain("&lt;");
    expect(html).toContain("&gt;");
  });

  it("多语言高亮互不串味", () => {
    const py = renderMarkdown("```python\ndef f():\n    return 1\n```");
    expect(py).toContain("tok-keyword");
    const css = renderMarkdown("```css\n.a { color: red }\n```");
    expect(css).toContain("tok-");
  });
});

describe("renderMarkdown Callout", () => {
  it("NOTE 提示转换为带类型的 callout", () => {
    const html = renderMarkdown("> [!NOTE] 小提示\n> 正文内容");
    expect(html).toContain('data-callout="note"');
    expect(html).toContain("小提示");
    expect(html).toContain("正文内容");
    expect(html).not.toContain("<blockquote");
  });

  it("自定义类型名（含符号）识别为 callout", () => {
    const html = renderMarkdown("> [!TL;DR] 太长不看\n> 内容");
    expect(html).toContain('data-callout="tl;dr"');
    expect(html).toContain("太长不看");
    expect(html).not.toContain("<blockquote");
  });

  it("[! 后带空格的类型名识别为 callout", () => {
    const html = renderMarkdown("> [! TL] 要点\n> 内容");
    expect(html).toContain('data-callout="tl"');
    expect(html).toContain("要点");
    expect(html).not.toContain("<blockquote");
  });

  it("] 前带尾部空格的类型名识别为 callout", () => {
    const html = renderMarkdown("> [!NOTE ] 尾部空格\n> 内容");
    expect(html).toContain('data-callout="note"');
    expect(html).toContain("尾部空格");
    expect(html).not.toContain("<blockquote");
  });

  it("未写标题时用类型默认名", () => {
    const html = renderMarkdown("> [!TIP]\n> 正文内容");
    expect(html).toContain('data-callout="tip"');
    expect(html).toContain("提示");
  });

  it("带减号后缀时渲染为可折叠的 details", () => {
    const html = renderMarkdown("> [!WARNING]- 折叠标题\n> 内容");
    expect(html).toContain("<details");
    expect(html).toContain("<summary");
    expect(html).toContain("折叠标题");
  });

  it("普通引用保持 blockquote", () => {
    const html = renderMarkdown("> 只是一句引用");
    expect(html).toContain("<blockquote");
    expect(html).not.toContain("callout");
  });
});

describe("renderMarkdown 公式", () => {
  it("行内公式渲染为 katex", () => {
    const html = renderMarkdown("质能方程 $E=mc^2$ 成立");
    expect(html).toContain("katex");
    expect(html).not.toContain("data-math");
  });

  it("块级公式渲染为独立块", () => {
    const html = renderMarkdown("$$\nE=mc^2\n$$");
    expect(html).toContain("katex-block");
    expect(html).toContain("katex-display");
  });

  it("货币写法不被当成公式", () => {
    const html = renderMarkdown("价格是 $100 元");
    expect(html).not.toContain("katex");
  });

  it("公式语法错误时回退为错误提示而非抛异常", () => {
    const html = renderMarkdown("$\\frac{1}{$");
    expect(html).toContain("katex");
  });
});

describe("renderMarkdown 排版细节", () => {
  it("中西文之间插入间距，代码内不插", () => {
    const spaced = renderMarkdown("中文abc混合");
    expect(spaced).toContain("cjk-pad");

    const inCode = renderMarkdown("`中文abc`");
    const codeStart = inCode.indexOf("<code>");
    const codeEnd = inCode.indexOf("</code>");
    expect(inCode.slice(codeStart, codeEnd)).not.toContain("cjk-pad");
  });

  it("图片带 title 时输出 figure 与 figcaption", () => {
    const html = renderMarkdown('![替代文本](/a.png "图注")');
    expect(html).toContain("<figure");
    expect(html).toContain("<figcaption>图注</figcaption>");
  });

  it("表格包在横向滚动容器里", () => {
    const html = renderMarkdown("| a | b |\n| --- | --- |\n| 1 | 2 |");
    expect(html).toContain("table-wrap");
    expect(html).toContain("<table>");
  });

  it("链接补上 target=_blank", () => {
    const html = renderMarkdown("[链接](https://example.com)");
    expect(html).toContain('target="_blank"');
  });

  it("宽元素带 wide 类以走宽通道", () => {
    const html = renderMarkdown("```js\nlet a\n```\n\n| a |\n| - |\n| 1 |");
    expect(html).toContain('class="code-block wide"');
    expect(html).toContain('class="table-wrap wide"');
  });
});

describe("renderMarkdown 安全", () => {
  it("剥离脚本标签与事件属性", () => {
    const html = renderMarkdown(
      '<div onclick="alert(1)">x</div><script>alert(2)</script>',
    );
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("<script");
  });

  it("保留内嵌 HTML 的结构与 style 属性（fixed 外逃由 contain 兜住）", () => {
    const html = renderMarkdown('<div style="color: red">红字</div>');
    expect(html).toContain("<div");
    expect(html).toContain("style");
    expect(html).toContain("红字");
  });

  it("禁止 iframe 与 form", () => {
    const html = renderMarkdown(
      '<iframe src="https://evil.test"></iframe><form><input></form>',
    );
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("<form");
  });

  it("任务列表 checkbox 保留，其余 input 被剥离属性", () => {
    const html = renderMarkdown("- [x] 已完成\n- [ ] 未完成");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("checked");
  });

  it("高亮后的代码块不会产出真实标签或事件属性", () => {
    const html = renderMarkdown('```html\n<img src=x onerror="alert(1)">\n```');
    // 高亮只把 onerror 当作属性名文本输出，不产生真实标签 / 事件处理器
    expect(html).not.toContain("<img");
    expect(html).not.toContain("onerror=");
  });
});

describe("renderMarkdown Callout 正文不重复", () => {
  it("标题与正文各出现一次（blockquote 内有空白文本节点时也不重复）", () => {
    const html = renderMarkdown("> [!NOTE] 小标题\n> 正文内容");
    expect(html.match(/小标题/g)?.length).toBe(1);
    expect(html.match(/正文内容/g)?.length).toBe(1);
  });

  it("多段落 callout 的后续段落只出现一次", () => {
    const html = renderMarkdown("> [!TIP] 标题\n>\n> 第一段\n>\n> 第二段");
    expect(html.match(/第一段/g)?.length).toBe(1);
    expect(html.match(/第二段/g)?.length).toBe(1);
  });
});

describe("renderMarkdown Mermaid", () => {
  it("mermaid 代码块输出渲染容器，源码保留在 pre 里", () => {
    const html = renderMarkdown("```mermaid\ngraph TD\nA-->B\n```");
    expect(html).toContain('class="mermaid-block wide"');
    expect(html).toContain('class="mermaid"');
    expect(html).toContain("A--&gt;B");
  });

  it("mermaid 不带语言标签与复制按钮", () => {
    const html = renderMarkdown("```mermaid\ngraph TD\n```");
    expect(html).not.toContain("code-lang");
    expect(html).not.toContain("code-copy");
  });
});

describe("renderMarkdown 内嵌 HTML 深色适配", () => {
  it("浅色内联底色换成带兜底的变量，并产出深色取值", () => {
    renderMarkdown('<div style="background-color:#ffffff">块</div>');
    const vars = takeDarkVars();
    expect(Object.keys(vars)).toEqual(["dc-1"]);
    expect(vars["dc-1"]).toMatch(/^#[0-9a-f]{6}$/);
    expect(vars["dc-1"]).not.toBe("#ffffff");
  });

  it("深色内联文字色提亮，且已经是深色底的不动", () => {
    renderMarkdown('<span style="color:#222222">字</span>');
    const light = takeDarkVars()["dc-1"];
    renderMarkdown('<div style="background-color:#1a1a1a">深底</div>');
    expect(Object.keys(takeDarkVars())).toHaveLength(0);
    expect(light).toBeTruthy();
  });
});

describe("renderMarkdown YAML frontmatter", () => {
  it("文档开头的 frontmatter 不参与渲染（Obsidian 阅读视图默认隐藏）", () => {
    const html = renderMarkdown("---\ntags:\n  - 笔记\n---\n# 标题\n\n正文");
    expect(html).not.toContain("tags:");
    expect(html).not.toContain("笔记");
    expect(html).toContain("<h1>标题</h1>");
    expect(html).toContain("正文");
  });

  it("带 BOM 前缀的 frontmatter 同样剥离", () => {
    const html = renderMarkdown("\uFEFF---\ntags:\n  - 笔记\n---\n# 标题");
    expect(html).not.toContain("tags:");
    expect(html).toContain("<h1>标题</h1>");
  });

  it("非 frontmatter 的 --- 水平线仍正常渲染", () => {
    const html = renderMarkdown("# 标题\n\n---\n\n正文");
    expect(html).toContain("<hr");
    expect(html).toContain("<h1>标题</h1>");
  });
});

describe("renderMarkdown 块级 HTML 闭合", () => {
  it("</div> 闭合后紧跟的 markdown 不被吞进 HTML 块", () => {
    const html = renderMarkdown(
      '<div style="color:red">\n  <div>卡片</div>\n</div>\n\n### 后续标题',
    );
    expect(html).toContain("<h3>后续标题</h3>");
    expect(html).toContain("卡片");
  });

  it("嵌套 div 深度匹配，HTML 卡片与其后 markdown 互不干扰", () => {
    const md =
      '<div style="margin:20px 0;">\n' +
      '  <div style="padding:20px;">\n' +
      "    <div>❓ 问题一</div>\n" +
      "    <div>✅ 回答一</div>\n" +
      "  </div>\n" +
      "</div>\n\n" +
      "## 📞 Q&A\n\n" +
      "正文段落";
    const html = renderMarkdown(md);
    expect(html).toContain("❓ 问题一");
    expect(html).toContain("<h2>📞 Q&amp;A</h2>");
    expect(html).toContain("<p>正文段落</p>");
    expect(html).not.toContain("&lt;div");
  });

  it("块内自闭合标签不影响深度计数", () => {
    const md =
      '<div style="margin:20px 0;">\n' +
      '  <div class="a"/>\n' +
      "  <div>内容</div>\n" +
      "</div>\n\n" +
      "## 后续标题";
    const html = renderMarkdown(md);
    expect(html).toContain("<h2>后续标题</h2>");
    expect(html).toContain("内容");
  });

  it("未闭合的 HTML 块按空行兜底结束（保持原有行为）", () => {
    const html = renderMarkdown("<div>\n内容\n\n## 标题");
    expect(html).toContain("<div>");
    expect(html).toContain("<h2>标题</h2>");
  });
});
