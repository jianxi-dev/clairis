import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import TooltipLayer from "../../components/TooltipLayer";
import { useEditorStore } from "../../stores/editorStore";

const DELAY_MS = 400;

function makeButton(attrs: Record<string, string>): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.textContent = "btn";
  for (const [key, value] of Object.entries(attrs))
    btn.setAttribute(key, value);
  document.body.appendChild(btn);
  return btn;
}

function hover(el: Element): void {
  fireEvent.pointerOver(el, { clientX: 120, clientY: 140, bubbles: true });
}

function tipText(): string | null {
  return document.querySelector(".app-tip")?.textContent ?? null;
}

describe("TooltipLayer 悬停提示规则", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useEditorStore.getState().setConfig({ noticeDuration: null });
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("普通 title 未配置时满 400ms 才出现，399ms 仍不出现", () => {
    render(<TooltipLayer />);
    const btn = makeButton({ title: "普通提示" });
    hover(btn);

    act(() => {
      vi.advanceTimersByTime(DELAY_MS - 1);
    });
    expect(tipText()).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(tipText()).toBe("普通提示");
  });

  it("配置 1.0 秒时满 1000ms 才出现", () => {
    useEditorStore.getState().setConfig({ noticeDuration: 1.0 });
    render(<TooltipLayer />);
    const btn = makeButton({ title: "普通提示" });
    hover(btn);

    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(tipText()).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(tipText()).toBe("普通提示");
  });

  it("配置低于 100ms 被钳制到 100ms", () => {
    useEditorStore.getState().setConfig({ noticeDuration: 0.05 });
    render(<TooltipLayer />);
    const btn = makeButton({ title: "普通提示" });
    hover(btn);

    act(() => {
      vi.advanceTimersByTime(99);
    });
    expect(tipText()).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(tipText()).toBe("普通提示");
  });

  it("菜单触发按钮不显示提示", () => {
    render(<TooltipLayer />);
    const btn = makeButton({ title: "更多操作", "aria-haspopup": "menu" });
    hover(btn);

    act(() => {
      vi.advanceTimersByTime(DELAY_MS);
    });
    expect(tipText()).toBeNull();
    expect(btn.getAttribute("title")).toBe("更多操作");
  });

  it("aria-expanded 与显式 data-no-tip 同样抑制提示", () => {
    render(<TooltipLayer />);
    const expanded = makeButton({
      title: "大纲",
      "aria-expanded": "false",
    });
    const optedOut = makeButton({ title: "页面宽度", "data-no-tip": "" });

    hover(expanded);
    act(() => {
      vi.advanceTimersByTime(DELAY_MS);
    });
    expect(tipText()).toBeNull();

    hover(optedOut);
    act(() => {
      vi.advanceTimersByTime(DELAY_MS);
    });
    expect(tipText()).toBeNull();
  });

  it("指针离开会在延迟到达前取消提示", () => {
    render(<TooltipLayer />);
    const btn = makeButton({ title: "普通提示" });
    hover(btn);
    fireEvent.pointerOut(btn, { relatedTarget: document.body, bubbles: true });

    act(() => {
      vi.advanceTimersByTime(DELAY_MS);
    });
    expect(tipText()).toBeNull();
  });
});
