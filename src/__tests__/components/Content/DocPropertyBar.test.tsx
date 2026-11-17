import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import DocPropertyBar from "../../../components/Content/DocPropertyBar";
import { useDocPropertyPanelStore } from "../../../stores/docPropertyPanel";

const DOC = `---
title: 属性面板
created: 2026-11-14
updated: 2026-11-15T10:30:00
note: 备注
---

# 正文
`;

function resetPanel(): void {
  const s = useDocPropertyPanelStore.getState();
  s.setVariant("A");
  s.setHidden(false);
  s.setCollapsed(false);
}

describe("DocPropertyBar 托管日期键只读（P-6）", () => {
  afterEach(() => {
    cleanup();
    resetPanel();
  });

  it("B 编辑态：created / updated 值不进编辑、类型菜单不弹出", () => {
    useDocPropertyPanelStore.getState().setVariant("B");
    const { container } = render(<DocPropertyBar content={DOC} mode="edit" />);

    for (const key of ["created", "updated"]) {
      const row = container.querySelector(`[data-key="${key}"]`);
      expect(row).not.toBeNull();

      const value = row!.querySelector('[data-testid="dpb-value"]');
      expect(value?.getAttribute("role")).toBeNull();
      fireEvent.click(value!);
      expect(row!.querySelector('[data-testid="dpb-input"]')).toBeNull();

      expect(row!.querySelector('[data-testid="dpb-type"]')).toBeNull();
      fireEvent.click(row!.querySelector(".dpb-b-type")!);
      expect(
        document.querySelector('[data-testid="dpb-type-menu"]'),
      ).toBeNull();
    }
  });

  it("B 编辑态：自由键仍可编辑、类型菜单可弹出（守卫不误伤）", () => {
    useDocPropertyPanelStore.getState().setVariant("B");
    const { container } = render(<DocPropertyBar content={DOC} mode="edit" />);

    const row = container.querySelector('[data-key="note"]');
    expect(row).not.toBeNull();
    fireEvent.click(row!.querySelector('[data-testid="dpb-value"]')!);
    expect(row!.querySelector('[data-testid="dpb-input"]')).not.toBeNull();

    fireEvent.click(row!.querySelector('[data-testid="dpb-type"]')!);
    expect(
      document.querySelector('[data-testid="dpb-type-menu"]'),
    ).not.toBeNull();
  });
});
