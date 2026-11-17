import { describe, expect, it } from "vitest";
import {
  previewLineCount,
  renderPreviewLineNumbers,
} from "../lib/previewLineNumbers";

describe("previewLineCount", () => {
  it("空文档算 1 行，与编辑器逻辑行一致", () => {
    expect(previewLineCount("")).toBe(1);
  });

  it("按逻辑行计数，结尾换行不吞掉最后一行", () => {
    expect(previewLineCount("甲\n乙\n丙")).toBe(3);
    expect(previewLineCount("甲\n乙\n丙\n")).toBe(4);
  });
});

describe("renderPreviewLineNumbers", () => {
  it("每个逻辑行一个节点，编号从 1 递增", () => {
    const html = renderPreviewLineNumbers("甲\n乙");
    expect(html.match(/data-preview-line-number/g)?.length).toBe(2);
    expect(html).toContain('data-preview-line-number="1"');
    expect(html).toContain('data-preview-line-number="2"');
  });

  it("空文档仍输出 1 个节点", () => {
    expect(
      renderPreviewLineNumbers("").match(/data-preview-line-number/g)?.length,
    ).toBe(1);
  });
});
