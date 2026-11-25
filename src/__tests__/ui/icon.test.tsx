import { describe, expect, it, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import Icon from "../../components/Icon";
import { resetSurfaces, setSurfaces } from "../../lib/dataSurfaces/store";
import type { SurfacePayload } from "../../lib/dataSurfaces/loader";

/**
 * Icon 描边渲染（icon-system-v3-redraw 1.2）。
 *
 * `s` 字段走描边（fill=none + stroke=currentColor + 1.7），
 * `d` 字段保持实心；svg 根永远保留 fill，否则 e2e 的类型色断言会失效。
 */
describe("Icon 描边渲染", () => {
  beforeEach(() => resetSurfaces());

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
    const { container } = render(<Icon name="more" />);
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

  it("尺寸档位 12 / 14 / 18 / 24", () => {
    const { container } = render(<Icon name="close" size={24} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("24");
    expect(svg.getAttribute("height")).toBe("24");
    const small = render(<Icon name="lock" size={12} />).container;
    expect(small.querySelector("svg")!.getAttribute("width")).toBe("12");
  });

  it("parts 多段渲染：实线格 + 虚线格", () => {
    const { container } = render(<Icon name="splitRight" />);
    const paths = container.querySelectorAll("path");
    expect(paths.length).toBe(2);
    expect(paths[0].getAttribute("stroke-dasharray")).toBeNull();
    expect(paths[1].getAttribute("stroke-dasharray")).toBe("2 2");
  });

  it("part 选择器只渲染指定段，缺省仍渲染全部段", () => {
    const { container } = render(<Icon name="docPropertyVariant" part={1} />);
    const paths = container.querySelectorAll("path");
    expect(paths.length).toBe(1);
    expect(paths[0].getAttribute("d")).toBe("M5 5h14 M12 5v14");
    const all = render(<Icon name="docPropertyVariant" />).container;
    expect(all.querySelectorAll("path").length).toBe(2);
  });

  it("面含新增概念键时按面渲染（字形层）", () => {
    const payload: SurfacePayload = {
      id: "icons",
      items: [{ key: "brandNew", label: "新图标", s: "M2 2 L22 22" }],
      warnings: [],
    };
    setSurfaces([payload]);
    const { container } = render(<Icon name="brandNew" />);
    const path = container.querySelector("path")!;
    expect(path.getAttribute("d")).toBe("M2 2 L22 22");
    expect(path.getAttribute("stroke")).toBe("currentColor");
  });

  it("两面都缺该概念键时渲染 null（不崩溃、不渲染空 svg）", () => {
    const { container } = render(<Icon name="notAnywhere" />);
    expect(container.firstChild).toBeNull();
    expect(container.querySelector("svg")).toBeNull();
  });

  it("expand 与 collapse 的 d 不相等", () => {
    const expand = render(<Icon name="expand" />)
      .container.querySelector("path")!
      .getAttribute("d");
    const collapse = render(<Icon name="collapse" />)
      .container.querySelector("path")!
      .getAttribute("d");
    expect(expand).not.toBe(collapse);
  });
});
