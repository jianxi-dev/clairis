import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../../renderers/markdown";

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

describe("预览：相邻 callout 不合并", () => {
  it("同一引用块内连续的 [!TYPE] 行各成一张卡片", () => {
    const md = [
      "> [!INFO]{bg=yellow border=yellow}",
      "> 1. 甲",
      "> [!highlight]{bg=red border=red text=contrast}",
      "> 乙一",
      "> 乙二",
      "> [!TIP]{bg=green border=green} 丙",
      "> 丙正文",
      "> [!highlight]{emoji=🖍 bg=darkred border=red}",
      "> 丁",
    ].join("\n");
    const doc = parse(renderMarkdown(md));
    const cards = doc.querySelectorAll(".callout");
    expect(cards).toHaveLength(4);
    expect(
      Array.from(cards).map((card) => card.getAttribute("data-callout")),
    ).toEqual(["info", "highlight", "tip", "highlight"]);
    expect(cards[0]?.textContent).toContain("甲");
    expect(cards[1]?.textContent).toContain("乙一");
    expect(cards[1]?.textContent).toContain("乙二");
    expect(cards[2]?.textContent).toContain("丙正文");
    // 标记文本不能再作为正文漏进上一张卡片
    expect(cards[0]?.textContent).not.toContain("[!highlight]");
    // 首行属性里的 emoji 在预览也生效
    expect(
      cards[3]?.querySelector(".callout-mark-icon")?.textContent,
    ).toBe("🖍");
  });

  it("非法类型不占位、不影响后续块拆分", () => {
    const md = [
      "> [!FOO] 非法",
      "> 普通文本",
      "> [!note] 标注",
      "> 内容",
    ].join("\n");
    const doc = parse(renderMarkdown(md));
    expect(doc.querySelectorAll(".callout")).toHaveLength(1);
    expect(doc.querySelector(".callout")?.getAttribute("data-callout")).toBe(
      "note",
    );
  });
});
