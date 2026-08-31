// Regression: ISSUE-002 — web 模式（无 __TAURI_INTERNALS__）打开 html/pdf/image 时
// convertFileSrc 同步抛错击穿渲染树导致整页白屏。
// Found by /qa on 2026-08-30
// Report: .gstack/qa-reports/qa-report-{domain}-{date}.md
import { describe, it, expect, afterEach } from "vitest";
import { render } from "@testing-library/react";
import HtmlPreview from "../components/Content/HtmlPreview";
import PreviewView from "../components/Content/PreviewView";

const INTERNALS_KEY = "__TAURI_INTERNALS__" as keyof Window & string;

function withoutTauriInternals(): void {
  delete (window as unknown as Record<string, unknown>)[INTERNALS_KEY];
}

afterEach(() => {
  // 恢复 setup.ts 声明的模拟环境标志，避免污染其他用例
  Object.defineProperty(window, INTERNALS_KEY, {
    writable: true,
    configurable: true,
    value: {},
  });
});

describe("非 Tauri 环境（浏览器 dev / 无 mock e2e）不崩溃", () => {
  it("HtmlPreview 带 filePath 回退 srcdoc 且注入禁脚本 CSP", () => {
    withoutTauriInternals();
    const { container } = render(
      <HtmlPreview content="<p>hi</p>" filePath="/tmp/a.html" />,
    );
    const iframe = container.querySelector("iframe");
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute("src")).toBeNull();
    expect(iframe?.getAttribute("srcdoc")).toContain("script-src 'none'");
    expect(iframe?.getAttribute("srcdoc")).toContain("<p>hi</p>");
  });

  it("PreviewView 图片分支显示提示而非崩溃", () => {
    withoutTauriInternals();
    const { container } = render(
      <PreviewView content="" fileKind="image" filePath="/tmp/pic.png" />,
    );
    expect(container.textContent).toContain("无法预览图片");
    expect(container.querySelector("img")).toBeNull();
  });

  it("PreviewView PDF 分支显示提示而非崩溃", () => {
    withoutTauriInternals();
    const { container } = render(
      <PreviewView content="" fileKind="pdf" filePath="/tmp/doc.pdf" />,
    );
    expect(container.textContent).toContain("无法预览 PDF");
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("Tauri 环境（有 __TAURI_INTERNALS__）仍走 asset 直载分支", () => {
    const { container } = render(
      <HtmlPreview content="<p>x</p>" filePath="/tmp/a.html" />,
    );
    const iframe = container.querySelector("iframe");
    // buildAssetUrl 保留目录结构：前导 %2F + 段编码，斜杠保留
    expect(iframe?.getAttribute("src")).toBe("asset://localhost/%2Ftmp/a.html");
    expect(iframe?.getAttribute("srcdoc")).toBeNull();
  });
});
