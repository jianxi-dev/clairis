import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import Icon from "../../components/Icon";

/**
 * Icon 描边渲染（icon-system-v3-redraw 1.2）。
 *
 * `s` 字段走描边（fill=none + stroke=currentColor + 1.7），
 * `d` 字段保持实心；svg 根永远保留 fill，否则 e2e 的类型色断言会失效。
 */
describe("Icon 描边渲染", () => {
  it("s 字段渲染 fill=none + stroke=currentColor + stroke-width=1.7", () => {
    const { container } = render(<Icon name="close" />);
    const paths = container.querySelectorAll("path");
    expect(paths.length).toBe(1);
    expect(paths[0].getAttribute("fill")).toBe("none");
    expect(paths[0].getAttribute("stroke")).toBe("currentColor");
    expect(paths[0].getAttribute("stroke-width")).toBe("1.7");
    expect(paths[0].getAttribute("stroke-linecap")).toBe("round");
    expect(paths[0].getAttribute("stroke-linejoin")).toBe("round");
  });

  it("纯实心图标不写 fill=none，svg 根保留 fill", () => {
    const { container } = render(<Icon name="markdown" />);
    const svg = container.querySelector("svg")!;
    const paths = container.querySelectorAll("path");
    expect(paths.length).toBe(1);
    expect(paths[0].getAttribute("fill")).toBeNull();
    expect(svg.getAttribute("fill")).toBe("currentColor");
  });

  it("color 同时转发到 stroke 与 svg 根 fill", () => {
    const { container } = render(<Icon name="close" color="rgb(1, 2, 3)" />);
    expect(container.querySelector("svg")!.getAttribute("fill")).toBe(
      "rgb(1, 2, 3)",
    );
    expect(container.querySelector("path")!.getAttribute("stroke")).toBe(
      "rgb(1, 2, 3)",
    );
  });

  it("尺寸只允许 18 / 24 两档", () => {
    const { container } = render(<Icon name="close" size={24} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("24");
    expect(svg.getAttribute("height")).toBe("24");
  });
});
