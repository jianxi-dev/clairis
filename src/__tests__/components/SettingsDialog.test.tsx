import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import SettingsDialog from "../../components/SettingsDialog";
import { isCapabilityEnabled, resetCapabilities } from "../../lib/capabilities";

const saveAppConfig = vi.fn(() => Promise.resolve());
vi.mock("../../hooks/useConfig", () => ({
  saveAppConfig: () => saveAppConfig(),
}));

beforeEach(() => {
  resetCapabilities();
  saveAppConfig.mockClear();
});

afterEach(() => {
  resetCapabilities();
});

function checkbox(id: string): HTMLInputElement {
  return screen.getByTestId(`capability-${id}`) as HTMLInputElement;
}

describe("SettingsDialog", () => {
  it("列出全部能力且默认勾选", () => {
    render(<SettingsDialog onClose={() => {}} />);

    expect(screen.getByTestId("settings-dialog")).toBeTruthy();
    for (const id of ["math", "code-highlight", "mermaid", "preview-zoom"]) {
      expect(checkbox(id).checked).toBe(true);
    }
  });

  it("取消勾选关闭能力并持久化", () => {
    render(<SettingsDialog onClose={() => {}} />);
    const box = checkbox("mermaid");

    fireEvent.click(box);

    expect(isCapabilityEnabled("mermaid")).toBe(false);
    expect(box.checked).toBe(false);
    expect(saveAppConfig).toHaveBeenCalledTimes(1);
  });

  it("再次勾选恢复能力（幂等）", () => {
    render(<SettingsDialog onClose={() => {}} />);
    const box = checkbox("math");

    fireEvent.click(box);
    fireEvent.click(box);

    expect(isCapabilityEnabled("math")).toBe(true);
    expect(box.checked).toBe(true);
    expect(saveAppConfig).toHaveBeenCalledTimes(2);
  });

  it("Esc 关闭对话框", () => {
    const onClose = vi.fn();
    render(<SettingsDialog onClose={onClose} />);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("点关闭按钮回调 onClose", () => {
    const onClose = vi.fn();
    render(<SettingsDialog onClose={onClose} />);

    fireEvent.click(screen.getByLabelText("关闭设置"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
