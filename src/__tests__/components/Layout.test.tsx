import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import Layout from "../../components/Layout";

const noop = () => {};

describe("Layout", () => {
  it("renders left + center panels (right hidden by default)", () => {
    const { container } = render(
      <Layout
        leftSidebar={<div>L</div>}
        center={<div>C</div>}
        rightSidebar={<div>R</div>}
        onLeftWidthChange={noop}
        onRightWidthChange={noop}
      />,
    );

    expect(container.textContent).toContain("L");
    expect(container.textContent).toContain("C");
    expect(container.textContent).not.toContain("R"); // right hidden
  });

  it("renders left sidebar with fixed width style", () => {
    const { container } = render(
      <Layout
        leftSidebar={<div>L</div>}
        center={<div>C</div>}
        rightSidebar={null}
        onLeftWidthChange={noop}
        onRightWidthChange={noop}
      />,
    );

    // Left sidebar div should have explicit width
    const widthDivs = Array.from(container.querySelectorAll("div")).filter((d) =>
      d.style.width?.includes("px"),
    );
    expect(widthDivs.length).toBeGreaterThanOrEqual(1);
  });

  it("renders resize handle between panels", () => {
    const { container } = render(
      <Layout
        leftSidebar={<div>L</div>}
        center={<div>C</div>}
        rightSidebar={null}
        onLeftWidthChange={noop}
        onRightWidthChange={noop}
      />,
    );

    // Should have cursor-col-resize class on handle
    expect(container.querySelector(".cursor-col-resize")).toBeTruthy();
  });

  // Visual width verification requires E2E: npx playwright test
});
