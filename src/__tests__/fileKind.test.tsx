import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { useStore, isMediaKind } from "../stores/index";
import PreviewView from "../components/Content/PreviewView";
import { mediaPlayer } from "../components/Content/mediaPlayerState";

describe("detectFileKind（经 openFile 验证）", () => {
  beforeEach(() => {
    useStore.getState().reset();
  });

  const kindOf = (path: string): string => {
    useStore.getState().openFile(path, "content");
    const { tabs, activeTabId } = useStore.getState();
    return activeTabId ? tabs[activeTabId].fileKind : "";
  };

  it("文档类归类", () => {
    expect(kindOf("/a.md")).toBe("markdown");
    expect(kindOf("/a.markdown")).toBe("markdown");
    expect(kindOf("/a.html")).toBe("html");
    expect(kindOf("/a.htm")).toBe("html");
  });

  it("代码类归类", () => {
    expect(kindOf("/a.css")).toBe("css");
    expect(kindOf("/a.py")).toBe("python");
    expect(kindOf("/a.json")).toBe("json");
    expect(kindOf("/a.js")).toBe("javascript");
    expect(kindOf("/a.ts")).toBe("javascript");
    expect(kindOf("/a.tsx")).toBe("javascript");
    expect(kindOf("/a.yaml")).toBe("yaml");
    expect(kindOf("/a.yml")).toBe("yaml");
    expect(kindOf("/a.csv")).toBe("csv");
  });

  it("媒体类归类", () => {
    expect(kindOf("/a.png")).toBe("image");
    expect(kindOf("/a.JPG")).toBe("image");
    expect(kindOf("/a.svg")).toBe("image");
    expect(kindOf("/a.gif")).toBe("image");
    expect(kindOf("/a.mp4")).toBe("video");
    expect(kindOf("/a.MOV")).toBe("video");
    expect(kindOf("/a.mp3")).toBe("audio");
    expect(kindOf("/a.flac")).toBe("audio");
    expect(kindOf("/a.wav")).toBe("audio");
    expect(kindOf("/a.pdf")).toBe("pdf");
    expect(kindOf("/a.heif")).toBe("image");
    expect(kindOf("/a.heic")).toBe("image");
    expect(kindOf("/a.sh")).toBe("text");
  });

  it("未知与无扩展名归 text", () => {
    expect(kindOf("/a.txt")).toBe("text");
    expect(kindOf("/a.unknown")).toBe("text");
    expect(kindOf("/a")).toBe("text");
  });
});

describe("默认打开模式", () => {
  beforeEach(() => {
    useStore.getState().reset();
  });

  it("代码类默认编辑模式", () => {
    for (const path of [
      "/a.py",
      "/a.json",
      "/a.js",
      "/a.ts",
      "/a.yaml",
      "/a.css",
      "/a.csv",
      "/a.sh",
      "/a.zsh",
    ]) {
      useStore.getState().openFile(path, "x");
      const { tabs, activeTabId } = useStore.getState();
      expect(activeTabId ? tabs[activeTabId].editorMode : "").toBe("edit");
    }
  });

  it("媒体类默认预览模式", () => {
    for (const path of ["/a.png", "/a.mp4", "/a.pdf"]) {
      useStore.getState().openFile(path, "");
      const { tabs, activeTabId } = useStore.getState();
      expect(activeTabId ? tabs[activeTabId].editorMode : "").toBe("preview");
    }
  });

  it("阅读类保持预览模式", () => {
    for (const path of ["/a.md", "/a.html", "/a.txt"]) {
      useStore.getState().openFile(path, "x");
      const { tabs, activeTabId } = useStore.getState();
      expect(activeTabId ? tabs[activeTabId].editorMode : "").toBe("preview");
    }
  });
});

describe("isMediaKind", () => {
  it("媒体类型为 true", () => {
    expect(isMediaKind("image")).toBe(true);
    expect(isMediaKind("video")).toBe(true);
    expect(isMediaKind("audio")).toBe(true);
    expect(isMediaKind("pdf")).toBe(true);
  });

  it("文本/代码类为 false", () => {
    expect(isMediaKind("markdown")).toBe(false);
    expect(isMediaKind("html")).toBe(false);
    expect(isMediaKind("css")).toBe(false);
    expect(isMediaKind("python")).toBe(false);
    expect(isMediaKind("text")).toBe(false);
  });
});

describe("媒体 tab 模式拦截", () => {
  beforeEach(() => {
    useStore.getState().reset();
  });

  it("媒体 tab 调 setEditorMode 不生效", () => {
    useStore.getState().openFile("/a.png", "");
    const { activeTabId, tabs } = useStore.getState();
    expect(tabs[activeTabId!].editorMode).toBe("preview");
    useStore.getState().setEditorMode("edit");
    expect(useStore.getState().tabs[activeTabId!].editorMode).toBe("preview");
  });

  it("文本 tab 调 setEditorMode 正常生效", () => {
    useStore.getState().openFile("/a.md", "# hi");
    const { activeTabId } = useStore.getState();
    useStore.getState().setEditorMode("edit");
    expect(useStore.getState().tabs[activeTabId!].editorMode).toBe("edit");
  });
});

describe("PreviewView 媒体渲染", () => {
  it("image 渲染 img 且 src 为 asset URL", () => {
    const { container } = render(
      <PreviewView content="" fileKind="image" filePath="/tmp/pic.png" />,
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe("asset://localhost/%2Ftmp%2Fpic.png");
  });

  it("video 预览注册到常驻播放器（media:// URL），渲染占位区域", () => {
    const { container, unmount } = render(
      <PreviewView content="" fileKind="video" filePath="/tmp/clip.mp4" />,
    );
    // 视频/音频预览由 MediaPlayerHost 全尺寸覆盖：PreviewView 只渲染占位
    expect(container.querySelector("[data-media-preview]")).not.toBeNull();
    // 常驻播放器状态已注册当前媒体源
    const state = mediaPlayer.getState();
    expect(state.source?.filePath).toBe("/tmp/clip.mp4");
    expect(state.source?.fileKind).toBe("video");
    expect(state.source?.url).toBe("media://localhost/tmp/clip.mp4");
    expect(state.visible).toBe(true);
    // 卸载（切走 tab）→ minimize：播放器保留，移出视口（无迷你条）
    unmount();
    expect(mediaPlayer.getState().visible).toBe(false);
    expect(mediaPlayer.getState().source?.filePath).toBe("/tmp/clip.mp4");
    // 清理状态，避免影响其他测试
    mediaPlayer.stop();
  });

  it("audio 预览注册到常驻播放器（media:// URL + audio 类型）", () => {
    const { container, unmount } = render(
      <PreviewView content="" fileKind="audio" filePath="/tmp/song.mp3" />,
    );
    expect(container.querySelector("[data-media-preview]")).not.toBeNull();
    const state = mediaPlayer.getState();
    expect(state.source?.filePath).toBe("/tmp/song.mp3");
    expect(state.source?.fileKind).toBe("audio");
    expect(state.source?.url).toBe("media://localhost/tmp/song.mp3");
    unmount();
    mediaPlayer.stop();
  });

  it("pdf 渲染 PdfViewer（加载态，非 iframe）", () => {
    const { container } = render(
      <PreviewView content="" fileKind="pdf" filePath="/tmp/doc.pdf" />,
    );
    // T4 起 pdf 分支走 PdfViewer（EmbedPDF 查看器），不再渲染 iframe；
    // 同步断言时字节读取未完成，处于加载态
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.textContent).toContain("正在加载 PDF…");
  });

  it("媒体无路径显示占位", () => {
    const { container } = render(
      <PreviewView content="" fileKind="image" filePath={null} />,
    );
    expect(container.textContent).toContain("无法预览");
  });

  it("csv 走等宽文本视图", () => {
    const { container } = render(
      <PreviewView content="a,b\n1,2" fileKind="csv" filePath={null} />,
    );
    const pre = container.querySelector("pre");
    expect(pre).not.toBeNull();
    expect(pre?.textContent).toContain("a,b");
  });
});
describe("默认打开模式（C-1 源码/预览分流）", () => {
  beforeEach(() => {
    useStore.getState().reset();
  });

  const modeOf = (path: string): string => {
    useStore.getState().openFile(path, "x");
    const { tabs, activeTabId } = useStore.getState();
    return activeTabId ? tabs[activeTabId].editorMode : "";
  };

  it("代码类默认编辑模式", () => {
    for (const path of [
      "/a.py",
      "/a.json",
      "/a.js",
      "/a.ts",
      "/a.yaml",
      "/a.css",
      "/a.csv",
      "/a.sh",
      "/a.zsh",
    ]) {
      expect(modeOf(path)).toBe("edit");
    }
  });

  it("媒体类默认预览模式", () => {
    for (const path of ["/a.png", "/a.mp4", "/a.pdf"]) {
      expect(modeOf(path)).toBe("preview");
    }
  });

  it("阅读类保持预览模式", () => {
    for (const path of ["/a.md", "/a.html", "/a.txt"]) {
      expect(modeOf(path)).toBe("preview");
    }
  });
});

describe("PreviewView 阅读体验", () => {
  it("markdown 容器居中且注入标题配色变量", () => {
    const { container } = render(
      <PreviewView
        content="# 标题\n正文"
        fileKind="markdown"
        filePath={null}
      />,
    );
    const md = container.querySelector(".preview-content");
    expect(md).not.toBeNull();
    const styleAttr = (md as HTMLElement).getAttribute("style") ?? "";
    expect(styleAttr).toContain("--heading-h1: #d73a49");
  });

  it("headingColors 注入 CSS 变量", () => {
    const { container } = render(
      <PreviewView
        content="# 标题\n正文"
        fileKind="markdown"
        filePath={null}
      />,
    );
    const md = container.querySelector(".preview-content") as HTMLElement;
    // 默认 headingColors（editorStore initialState）应注入 --heading-h1
    expect(md.style.getPropertyValue("--heading-h1")).toBeTruthy();
  });
});

describe("ImagePreview 宽度与缩放", () => {
  it("图片默认宽度 1180px（适配阅读宽度）", () => {
    const { container } = render(
      <PreviewView content="" fileKind="image" filePath="/tmp/a.png" />,
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    const width = (img as HTMLElement).style.width;
    expect(width).toContain("1180");
  });

  it("Ctrl+滚轮放大图片宽度", async () => {
    const { container } = render(
      <PreviewView content="" fileKind="image" filePath="/tmp/a.png" />,
    );
    const img = container.querySelector("img") as HTMLElement;
    const before = parseFloat(img.style.width);
    const wheel = new WheelEvent("wheel", {
      ctrlKey: true,
      deltaY: -100,
      bubbles: true,
      cancelable: true,
    });
    img.dispatchEvent(wheel);
    await waitFor(() => {
      const after = parseFloat(img.style.width);
      expect(after).toBeGreaterThan(before);
    });
  });
});

describe("文档预览捏合缩放（markdown/文本/pdf 统一 zoom 容器）", () => {
  it("markdown 预览外层有 zoom 容器且默认 1", () => {
    const { container } = render(
      <PreviewView
        content="# 标题\n正文"
        fileKind="markdown"
        filePath={null}
      />,
    );
    const zoomed = container.querySelector("[style*='zoom']");
    expect(zoomed).not.toBeNull();
    const s = (zoomed as HTMLElement).style;
    expect(s.zoom || s.getPropertyValue("zoom")).toBe("1");
  });

  it("Ctrl+滚轮缩放 markdown 预览", async () => {
    const { container } = render(
      <PreviewView
        content="# 标题\n正文"
        fileKind="markdown"
        filePath={null}
      />,
    );
    const outer = container.firstElementChild as HTMLElement;
    const wheel = new WheelEvent("wheel", {
      ctrlKey: true,
      deltaY: -100,
      bubbles: true,
      cancelable: true,
    });
    outer.dispatchEvent(wheel);
    await waitFor(() => {
      const zoomed = container.querySelector("[style*='zoom']") as HTMLElement;
      const z = parseFloat(
        zoomed.style.zoom || zoomed.style.getPropertyValue("zoom"),
      );
      expect(z).toBeGreaterThan(1);
    });
  });

  it("csv 文本预览同样支持缩放容器", () => {
    const { container } = render(
      <PreviewView content="a,b\n1,2" fileKind="csv" filePath={null} />,
    );
    const zoomed = container.querySelector("[style*='zoom']");
    expect(zoomed).not.toBeNull();
  });
});

describe("HTML/PDF 视口缩放（Cmd+=/-/0）", () => {
  it("HTML 预览渲染在缩放容器内，初始 100%", () => {
    const { container } = render(
      <PreviewView
        content="<p>hi</p>"
        fileKind="html"
        filePath="/tmp/a.html"
      />,
    );
    // ScaledFrameView 的缩放层
    const scaleWrap = container.querySelector("[style*='width']");
    expect(scaleWrap).not.toBeNull();
  });

  it("同一组件实例从 markdown 切换到 html 不白屏（hooks 顺序稳定）", () => {
    const { container, rerender } = render(
      <PreviewView
        content="# hello"
        fileKind="markdown"
        filePath="/tmp/a.md"
      />,
    );
    expect(container.querySelector("iframe")).toBeNull();
    rerender(
      <PreviewView
        content="<p>hi</p>"
        fileKind="html"
        filePath="/tmp/a.html"
      />,
    );
    expect(container.querySelector("iframe")).not.toBeNull();
    rerender(
      <PreviewView content="%PDF-1.4" fileKind="pdf" filePath="/tmp/a.pdf" />,
    );
    // T4 起 pdf 分支走 PdfViewer（无 iframe），同步断言时处于加载态
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.textContent).toContain("正在加载 PDF…");
    rerender(
      <PreviewView content="# back" fileKind="markdown" filePath="/tmp/a.md" />,
    );
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("Cmd+= 放大 HTML 预览（iframe zoom 增大）", async () => {
    const { container } = render(
      <PreviewView
        content="<p>hi</p>"
        fileKind="html"
        filePath="/tmp/a.html"
      />,
    );
    const iframe = container.querySelector("iframe") as HTMLElement;
    // zoom=1 时不写 zoom 样式（#258）
    expect(iframe.style.zoom || iframe.style.getPropertyValue("zoom")).toBe("");

    window.dispatchEvent(new CustomEvent("preview-scale", { detail: 1 }));
    await waitFor(() => {
      const z = parseFloat(
        iframe.style.zoom || iframe.style.getPropertyValue("zoom"),
      );
      expect(z).toBeGreaterThan(1);
    });
  });
});

describe("图片键盘缩放（Cmd+=）", () => {
  it("Cmd+= 放大图片", async () => {
    const { container } = render(
      <PreviewView content="" fileKind="image" filePath="/tmp/a.png" />,
    );
    const img = container.querySelector("img") as HTMLElement;
    const before = parseFloat(img.style.width);

    window.dispatchEvent(new CustomEvent("preview-scale", { detail: 1 }));
    await waitFor(() => {
      expect(parseFloat(img.style.width)).toBeGreaterThan(before);
    });
  });
});

// 清理常驻播放器状态，避免媒体预览测试间泄漏
afterEach(() => {
  mediaPlayer.stop();
});
