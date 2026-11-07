import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import HtmlPreview from "../../../components/Content/HtmlPreview";
import { rewriteHtmlPaths } from "../../../renderers";

vi.mock("../../../utils/tauri", () => ({
  isTauriEnv: () => true,
}));

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) =>
    `asset://localhost/${encodeURIComponent(path)}`,
}));

vi.mock("../../../renderers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../renderers")>();
  return {
    ...actual,
    rewriteHtmlPaths: vi.fn(actual.rewriteHtmlPaths),
  };
});

describe("HtmlPreview", () => {
  beforeEach(() => {
    vi.mocked(rewriteHtmlPaths).mockClear();
  });

  it("live 分支不调用 rewriteHtmlPaths，且 zoom=1 时不写 zoom 样式", () => {
    const { container } = render(
      <HtmlPreview
        content={"<!DOCTYPE html><body><p>hi</p></body>"}
        filePath="/tmp/a.html"
        live
        zoom={1}
      />,
    );
    const frame = container.querySelector("iframe");
    expect(frame).not.toBeNull();
    expect(rewriteHtmlPaths).not.toHaveBeenCalled();
    expect(frame!.style.zoom).toBe("");
    expect(frame!.getAttribute("src")).toContain("asset://");
  });

  it("非 live 分支仍构建 srcdoc 并调用 rewriteHtmlPaths", () => {
    const { container } = render(
      <HtmlPreview
        content={'<img src="a.png">'}
        filePath="/tmp/a.html"
        zoom={1}
      />,
    );
    const frame = container.querySelector("iframe");
    expect(rewriteHtmlPaths).toHaveBeenCalledTimes(1);
    expect(frame!.getAttribute("srcdoc")).toBeTruthy();
  });

  it("zoom !== 1 时写 zoom 样式", () => {
    const { container } = render(
      <HtmlPreview
        content={"<!DOCTYPE html><body><p>hi</p></body>"}
        filePath="/tmp/a.html"
        live
        zoom={1.5}
      />,
    );
    const frame = container.querySelector("iframe");
    expect(frame!.style.zoom).toBe("1.5");
  });
});
