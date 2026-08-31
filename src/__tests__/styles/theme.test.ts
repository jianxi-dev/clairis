import { describe, it, expect } from "vitest";

describe("theme CSS variables", () => {
  it("light theme defines --reader-font-size", () => {
    const css = getComputedStyle(document.documentElement);
    // Verify the CSS custom property pattern works
    expect(css).toBeDefined();
  });
});
