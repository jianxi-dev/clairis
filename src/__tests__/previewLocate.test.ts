// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { findPreviewMatchNode } from "../lib/previewLocate";

const mounted: HTMLElement[] = [];

function mount(html: string): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.append(root);
  mounted.push(root);
  return root;
}

afterEach(() => {
  while (mounted.length > 0) mounted.pop()?.remove();
});

describe("findPreviewMatchNode", () => {
  it("同节点多命中：逐个计数，序数落回同一元素", () => {
    const root = mount(
      '<div class="preview-content"><p id="x">命中命中命中</p></div>',
    );
    const p = root.querySelector("#x") as HTMLElement;
    expect(findPreviewMatchNode(root, "命中", 0)).toBe(p);
    expect(findPreviewMatchNode(root, "命中", 1)).toBe(p);
    expect(findPreviewMatchNode(root, "命中", 2)).toBe(p);
  });

  it("跨节点：按文档顺序累计，序数指向对应文本节点的父元素", () => {
    const root = mount(
      '<div class="preview-content"><p id="a">甲命中</p><p id="b">乙命中</p></div>',
    );
    expect(findPreviewMatchNode(root, "命中", 0)).toBe(
      root.querySelector("#a"),
    );
    expect(findPreviewMatchNode(root, "命中", 1)).toBe(
      root.querySelector("#b"),
    );
  });

  it("越界：序数超出实际出现次数返回 null", () => {
    const root = mount('<div class="preview-content"><p>命中</p></div>');
    expect(findPreviewMatchNode(root, "命中", 1)).toBeNull();
    expect(findPreviewMatchNode(root, "命中", 99)).toBeNull();
  });

  it("大小写不敏感，保留原文大小写无关", () => {
    const root = mount('<div class="preview-content"><p>Hello World</p></div>');
    expect(findPreviewMatchNode(root, "hello", 0)).toBe(
      root.querySelector("p"),
    );
  });

  it("空 needle 与负序数直接无解", () => {
    const root = mount('<div class="preview-content"><p>命中</p></div>');
    expect(findPreviewMatchNode(root, "", 0)).toBeNull();
    expect(findPreviewMatchNode(root, "命中", -1)).toBeNull();
  });

  it("无匹配返回 null", () => {
    const root = mount('<div class="preview-content"><p>无关文本</p></div>');
    expect(findPreviewMatchNode(root, "命中", 0)).toBeNull();
  });
});
