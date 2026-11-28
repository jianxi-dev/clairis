import { describe, expect, it, vi, afterEach } from "vitest";
import { render, cleanup, fireEvent, act } from "@testing-library/react";
import { Menu, type MenuItem } from "../../ui/primitives/Menu";

const ITEMS: MenuItem[] = [
  { id: "new", label: "新建文档", shortcut: "⌘N", run: vi.fn() },
  { id: "duplicate", label: "复制", shortcut: "⌘D", run: vi.fn() },
  { id: "delete", label: "删除（不可用）", disabled: true, run: vi.fn() },
];

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

function renderMenu(overrides: Partial<Parameters<typeof Menu>[0]> = {}) {
  const onClose = vi.fn();
  render(
    <Menu
      anchor={{ x: 200, y: 200 }}
      items={ITEMS}
      onClose={onClose}
      testId="test-menu"
      {...overrides}
    />,
  );
  return { onClose };
}

describe("Menu 基件", () => {
  it("经 PortalScope 挂进 [data-portal-root]，渲染 label 与 shortcut", () => {
    renderMenu();
    const root = document.querySelector("[data-portal-root]");
    expect(root).not.toBeNull();
    const scope = root!.querySelector("[data-portal-scope]");
    expect(scope!.getAttribute("data-portal-scope")).toBe("test-menu");
    const menu = scope!.querySelector('[role="menu"]');
    expect(menu).not.toBeNull();
    expect(menu!.textContent).toContain("新建文档");
    expect(menu!.textContent).toContain("⌘N");
    expect(menu!.textContent).toContain("复制");
  });

  it("禁用项带 disabled 且点击不触发 run", () => {
    renderMenu();
    const disabled = document.querySelector(
      '[role="menuitem"][disabled]',
    ) as HTMLButtonElement;
    expect(disabled).not.toBeNull();
    expect(disabled.textContent).toContain("删除");
    fireEvent.click(disabled);
    expect(ITEMS[2].run).not.toHaveBeenCalled();
  });

  it("点击可用项：先关后跑 run", () => {
    const { onClose } = renderMenu();
    const item = document.querySelector(
      '[role="menuitem"]:not([disabled])',
    ) as HTMLButtonElement;
    fireEvent.click(item);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(ITEMS[0].run).toHaveBeenCalledTimes(1);
  });

  it("Esc 关闭", () => {
    const { onClose } = renderMenu();
    const menu = document.querySelector('[role="menu"]') as HTMLElement;
    fireEvent.keyDown(menu, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("点外部（pointerdown）关闭", () => {
    const { onClose } = renderMenu();
    act(() => {
      document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ArrowDown 移动焦点到下一项", () => {
    renderMenu();
    const items = Array.from(
      document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'),
    );
    act(() => {
      items[0].focus();
    });
    const menu = document.querySelector('[role="menu"]') as HTMLElement;
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[1]);
  });

  it("Enter 激活当前焦点项", () => {
    renderMenu();
    const items = Array.from(
      document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'),
    );
    act(() => {
      items[1].focus();
    });
    const menu = document.querySelector('[role="menu"]') as HTMLElement;
    fireEvent.keyDown(menu, { key: "Enter" });
    expect(ITEMS[1].run).toHaveBeenCalledTimes(1);
  });

  it("首个可用项挂载即获焦", () => {
    renderMenu();
    const items = document.querySelectorAll<HTMLButtonElement>(
      '[role="menuitem"]',
    );
    expect(document.activeElement).toBe(items[0]);
  });
});
