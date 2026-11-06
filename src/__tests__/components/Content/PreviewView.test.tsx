import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import PreviewView from "../../../components/Content/PreviewView";

describe("PreviewView", () => {
  it("renders without crashing", () => {
    const { container } = render(<PreviewView content="" />);
    expect(container).toBeDefined();
  });

  it("renders markdown as HTML", () => {
    const { container } = render(<PreviewView content="# Hello" />);
    expect(container.innerHTML).toContain("<h1");
    expect(container.textContent).toContain("Hello");
  });

  it("renders paragraphs", () => {
    const { container } = render(<PreviewView content="hello world" />);
    expect(container.innerHTML).toContain("hello world");
  });

  it("renders code blocks", () => {
    const { container } = render(<PreviewView content="`code`" />);
    expect(container.innerHTML).toContain("code");
  });

  it("blocks script tags via DOMPurify", () => {
    const { container } = render(
      <PreviewView content='<script>alert("xss")</script>' />,
    );
    expect(container.innerHTML).not.toContain("<script");
  });

  it("blocks onclick attributes", () => {
    const { container } = render(
      <PreviewView content='<div onclick="alert(1)">click</div>' />,
    );
    expect(container.innerHTML).not.toContain("onclick");
  });

  it("renders links with target attribute", () => {
    const { container } = render(
      <PreviewView content="[link](https://example.com)" />,
    );
    const links = container.querySelectorAll("a");
    expect(links.length).toBeGreaterThan(0);
    links.forEach((link) => {
      expect(link.getAttribute("target")).toBe("_blank");
    });
  });

  it("has preview-view class", () => {
    const { container } = render(<PreviewView content="hello" />);
    expect(container.querySelector(".preview-view")).toBeDefined();
  });

  it("正文右上角不再渲染阅读设置浮层", () => {
    const { container } = render(<PreviewView content="# 标题" />);
    expect(container.querySelector(".reader-settings")).toBeNull();
    expect(container.querySelector('[aria-label="阅读设置"]')).toBeNull();
  });
});
