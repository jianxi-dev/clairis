/**
 * 块级装饰（简型）测试：分割线 / 链接 / 图片 / mermaid。
 *
 * 移植自 md-bundle `test/decorations-image.test.ts` 与 `test/media-mermaid.test.ts`
 * 的相关用例，并补上「四种块型 × 活跃/非活跃两态」的逐块型断言（红线 5：
 * 显示 = 源码，装饰只影响视图，文档值永不改变）。
 *
 * jsdom 缺 requestAnimationFrame / ResizeObserver，CM6 两者都用。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Range } from "@codemirror/state";
import { EditorState } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import {
  editorDecorations,
  resetDecorationGuards,
  type EditorDecorationsOptions,
} from "../../editors/decorations";
import { createHrDecorations } from "../../editors/decorations/hr";
import { createLinkDecorations } from "../../editors/decorations/link";
import {
  classifyMedia,
  createImageDecorations,
  parseImageWidth,
  type ImageResolver,
} from "../../editors/decorations/image";
import { createMermaidDecorations } from "../../editors/decorations/mermaid";

function installPolyfills(): void {
  if (typeof globalThis.requestAnimationFrame !== "function") {
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
      setTimeout(
        () => cb(performance.now()),
        16,
      )) as unknown as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = ((id: number) =>
      clearTimeout(id)) as unknown as typeof cancelAnimationFrame;
  }
  if (typeof globalThis.ResizeObserver !== "function") {
    globalThis.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver;
  }
}

interface WidgetLike {
  eq(other: unknown): boolean;
  toDOM(): HTMLElement;
  ignoreEvent(event?: Event): boolean;
}

function widgetOf(deco: Range<Decoration>): WidgetLike {
  return deco.value.spec.widget;
}

/** 已知图片返回 dataUrl，其余返回 null。 */
const stubResolver: ImageResolver = (path: string) =>
  path === "photo.png" ? "data:image/png;base64,abc123" : null;

describe("block decorations", () => {
  let parent: HTMLElement;
  let view: EditorView;

  beforeEach(() => {
    installPolyfills();
    resetDecorationGuards();
    parent = document.createElement("div");
    document.body.appendChild(parent);
  });

  afterEach(() => {
    view?.destroy();
    parent?.remove();
    resetDecorationGuards();
  });

  function createEditor(
    doc: string,
    options?: EditorDecorationsOptions,
  ): EditorView {
    return new EditorView({
      parent,
      state: EditorState.create({
        doc,
        extensions: [markdown(), editorDecorations(options)],
      }),
    });
  }

  function placeCursor(pos: number): void {
    view.dispatch({ selection: { anchor: pos } });
    view.requestMeasure();
  }

  // --- 分割线 -------------------------------------------------------------

  describe("hr decoration", () => {
    it("styles an inactive thematic break and hides its markers", () => {
      view = createEditor("---\n\nParagraph");
      placeCursor(6);

      expect(view.dom.querySelector(".cm-thematic-break")).not.toBeNull();
      expect(view.dom.querySelector(".cm-content")?.textContent).not.toContain(
        "---",
      );
    });

    it("reveals the raw `---` when the cursor enters the hr line", () => {
      view = createEditor("---\n\nParagraph");
      placeCursor(1);

      expect(view.dom.querySelector(".cm-thematic-break")).toBeNull();
      expect(view.dom.querySelector(".cm-content")?.textContent).toContain(
        "---",
      );
    });

    it("matches `***`, `___`, `----` and spaced forms, but not mixed runs", () => {
      expect(createHrDecorations("***")).toHaveLength(2);
      expect(createHrDecorations("___")).toHaveLength(2);
      expect(createHrDecorations("----")).toHaveLength(2);
      expect(createHrDecorations("- - -")).toHaveLength(2);
      expect(createHrDecorations("-*-")).toHaveLength(0);
      expect(createHrDecorations("--")).toHaveLength(0);
    });

    it("preserves the document value", () => {
      view = createEditor("---\n\nParagraph");
      expect(view.state.doc.toString()).toBe("---\n\nParagraph");
    });
  });

  // --- 链接 ---------------------------------------------------------------

  describe("link decoration", () => {
    it("hides the brackets and URL of an inactive link", () => {
      view = createEditor("[文字](https://example.com)\n\nParagraph");
      placeCursor(35);

      const link = view.dom.querySelector(".cm-link");
      expect(link).not.toBeNull();
      expect(link?.textContent).toBe("文字");
      expect(link?.classList.contains("cm-block-active")).toBe(false);
      const text = view.dom.querySelector(".cm-content")?.textContent ?? "";
      expect(text).not.toContain("https://example.com");
      expect(text).not.toContain("](");
    });

    it("keeps the raw source visible when the cursor enters the link", () => {
      view = createEditor("[文字](https://example.com)");
      placeCursor(1);

      const link = view.dom.querySelector(".cm-link.cm-block-active");
      expect(link).not.toBeNull();
      expect(link?.textContent).toBe("文字");
      const text = view.dom.querySelector(".cm-content")?.textContent ?? "";
      expect(text).toContain("[文字](https://example.com)");
    });

    it("skips links inside fenced code, tables and mermaid blocks", () => {
      expect(createLinkDecorations("```\n[a](b)\n```")).toHaveLength(0);
      expect(createLinkDecorations("| [a](b) |\n| --- |")).toHaveLength(0);
      expect(createLinkDecorations("```mermaid\n[a](b)\n```")).toHaveLength(0);
    });

    it("does not treat an image reference as a link", () => {
      expect(createLinkDecorations("![alt](photo.png)")).toHaveLength(0);
    });

    it("preserves the document value", () => {
      view = createEditor("[文字](https://example.com)");
      expect(view.state.doc.toString()).toBe("[文字](https://example.com)");
    });
  });

  // --- 图片 ---------------------------------------------------------------

  describe("image decoration", () => {
    it("renders an img widget for a resolved image", () => {
      view = createEditor("![alt text](photo.png)", {
        resolveImage: stubResolver,
      });
      placeCursor(view.state.doc.length);

      const widget = view.dom.querySelector(".cm-image-widget");
      expect(widget).not.toBeNull();
      const img = widget?.querySelector("img");
      expect(img?.getAttribute("src")).toBe("data:image/png;base64,abc123");
      expect(img?.getAttribute("alt")).toBe("alt text");
    });

    it("falls back to `[图片: path]` when the resolver returns null", () => {
      view = createEditor("![alt text](unknown.png)", {
        resolveImage: stubResolver,
      });
      placeCursor(view.state.doc.length);

      const widget = view.dom.querySelector(".cm-image-widget");
      expect(widget).not.toBeNull();
      expect(widget?.textContent).toContain("[图片: unknown.png]");
    });

    it("falls back to text when no resolver is injected", () => {
      view = createEditor("![alt text](photo.png)");
      placeCursor(view.state.doc.length);

      expect(view.dom.querySelector(".cm-image-widget")?.textContent).toContain(
        "[图片: photo.png]",
      );
    });

    it("passes the `./`-prefixed path verbatim to the resolver", () => {
      const seen: string[] = [];
      const resolver: ImageResolver = (path) => {
        seen.push(path);
        return path.replace(/^\.\//, "") === "photo.png"
          ? "data:image/png;base64,abc123"
          : null;
      };

      view = createEditor("![dot](./photo.png)", { resolveImage: resolver });
      placeCursor(view.state.doc.length);

      expect(seen).toContain("./photo.png");
      expect(
        view.dom.querySelector(".cm-image-widget img")?.getAttribute("src"),
      ).toBe("data:image/png;base64,abc123");
      expect(view.state.doc.toString()).toBe("![dot](./photo.png)");
    });

    it("rounds the img via clip-path and uses the theme surface, not a dark fill", () => {
      view = createEditor("![alt text](photo.png)", {
        resolveImage: stubResolver,
      });
      placeCursor(view.state.doc.length);

      const widget = view.dom.querySelector(
        ".cm-image-widget",
      ) as HTMLElement | null;
      const img = widget?.querySelector("img") as HTMLElement | null;
      expect(img?.style.clipPath).toBe("inset(0 round 4px)");
      expect(widget?.style.backgroundColor).toBe("var(--app-surface)");
      expect(widget?.style.overflow).toBe("");
      expect(widget?.style.borderRadius).toBe("");
    });

    it("does not create a widget for images inside code fences", () => {
      view = createEditor("```\n![alt text](photo.png)\n```", {
        resolveImage: stubResolver,
      });
      placeCursor(view.state.doc.length);

      expect(view.dom.querySelector(".cm-image-widget")).toBeNull();
    });

    it("does not create a widget for images inside indented code", () => {
      view = createEditor("    ![alt text](photo.png)", {
        resolveImage: stubResolver,
      });
      placeCursor(view.state.doc.length);

      expect(view.dom.querySelector(".cm-image-widget")).toBeNull();
    });

    it("calls onImageReplace / onImageDelete / onImageLocate with the path", () => {
      const calls: string[] = [];
      view = createEditor("![alt text](photo.png)", {
        resolveImage: stubResolver,
        onImageReplace: (p) => calls.push(`replace:${p}`),
        onImageDelete: (p) => calls.push(`delete:${p}`),
        onImageLocate: (p) => calls.push(`locate:${p}`),
      });
      placeCursor(view.state.doc.length);

      (
        view.dom.querySelector(
          '[data-testid="img-hover-replace"]',
        ) as HTMLElement
      ).click();
      (
        view.dom.querySelector(
          '[data-testid="img-hover-delete"]',
        ) as HTMLElement
      ).click();
      (
        view.dom.querySelector(
          '[data-testid="img-hover-locate"]',
        ) as HTMLElement
      ).click();

      expect(calls).toEqual([
        "replace:photo.png",
        "delete:photo.png",
        "locate:photo.png",
      ]);
    });

    it("does not throw when the hover callbacks are not injected", () => {
      view = createEditor("![alt text](photo.png)", {
        resolveImage: stubResolver,
      });
      placeCursor(view.state.doc.length);

      const replaceBtn = view.dom.querySelector(
        '[data-testid="img-hover-replace"]',
      ) as HTMLElement;
      expect(replaceBtn).not.toBeNull();
      expect(() => replaceBtn.click()).not.toThrow();
    });

    it("lets the editor ignore mousedown on toolbar buttons so clicks fire", () => {
      let deleted = false;
      view = createEditor("![alt text](photo.png)", {
        resolveImage: stubResolver,
        onImageDelete: () => {
          deleted = true;
        },
      });
      placeCursor(view.state.doc.length);

      const deleteBtn = view.dom.querySelector(
        '[data-testid="img-hover-delete"]',
      ) as HTMLElement;
      const down = new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
        button: 0,
      });
      deleteBtn.dispatchEvent(down);
      expect(down.defaultPrevented).toBe(false);

      deleteBtn.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true, cancelable: true }),
      );
      deleteBtn.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      expect(deleted).toBe(true);
    });

    it("renders a video player for a video extension", () => {
      const decos = createImageDecorations("![clip](clip.mp4)");
      expect(decos).toHaveLength(1);
      const dom = widgetOf(decos[0]).toDOM();
      expect(dom.classList.contains("cm-media-widget")).toBe(true);
      expect(dom.classList.contains("cm-media-video")).toBe(true);
      const video = dom.querySelector("video");
      expect(video?.hasAttribute("controls")).toBe(true);
      expect(video?.getAttribute("preload")).toBe("metadata");
      expect(video?.getAttribute("src")).toBe("clip.mp4");
    });

    it("renders a file link card for a non-image, non-video extension", () => {
      const dom = widgetOf(
        createImageDecorations("![report](report.pdf)")[0],
      ).toDOM();
      expect(dom.classList.contains("cm-media-file")).toBe(true);
      const link = dom.querySelector("a");
      expect(link?.getAttribute("href")).toBe("report.pdf");
      expect(link?.textContent).toBe("report");
    });

    it("classifies media by extension, mirroring the preview renderer", () => {
      expect(classifyMedia("clip.mp4")).toBe("video");
      expect(classifyMedia("clip.webm")).toBe("video");
      expect(classifyMedia("report.pdf")).toBe("file");
      expect(classifyMedia("archive.zip?v=2")).toBe("file");
      expect(classifyMedia("x.png")).toBe("image");
      expect(classifyMedia("photo.JPEG")).toBe("image");
      expect(classifyMedia("no-extension")).toBe("image");
    });

    it("reads a persisted `<!--w=N-->` width after the image", () => {
      expect(parseImageWidth("![a](b.png)<!--w=320-->", 11)).toBe(320);
      expect(parseImageWidth("![a](b.png)<!--w=1-->", 11)).toBeNull();
      expect(parseImageWidth("![a](b.png)", 11)).toBeNull();
    });

    it("preserves the document value", () => {
      const original = "Some text ![alt](photo.png) more text";
      view = createEditor(original, { resolveImage: stubResolver });
      expect(view.state.doc.toString()).toBe(original);
    });
  });

  // --- mermaid ------------------------------------------------------------

  describe("mermaid decoration", () => {
    const DOC = "```mermaid\ngraph TD;\n```";
    const hydrate = () =>
      vi.fn(async (_root: HTMLElement, _theme: "dark" | "light") => {});

    it("replaces an inactive mermaid block across its whole line range", () => {
      const decos = createMermaidDecorations(DOC, -1, -1, hydrate());
      expect(decos).toHaveLength(1);
      expect(decos[0].from).toBe(0);
      expect(decos[0].to).toBe(DOC.length);
      expect(decos[0].value.spec.block).toBe(true);
    });

    it("emits nothing for the active block (source stays editable)", () => {
      expect(
        createMermaidDecorations(DOC, 0, DOC.length, hydrate()),
      ).toHaveLength(0);
    });

    it("handles tilde fences and ignores non-mermaid or unlabelled fences", () => {
      expect(
        createMermaidDecorations(
          "~~~mermaid\ngraph TD;\n~~~",
          -1,
          -1,
          hydrate(),
        ),
      ).toHaveLength(1);
      expect(
        createMermaidDecorations("```ts\nlet x = 1;\n```", -1, -1, hydrate()),
      ).toHaveLength(0);
      expect(
        createMermaidDecorations("```\nplain\n```", -1, -1, hydrate()),
      ).toHaveLength(0);
    });

    it("emits nothing when no hydrator is injected", () => {
      expect(createMermaidDecorations(DOC, -1, -1)).toHaveLength(0);
    });

    it("hands clicks to the editor so the cursor can enter the block", () => {
      const widget = widgetOf(
        createMermaidDecorations(DOC, -1, -1, hydrate())[0],
      );
      expect(widget.ignoreEvent()).toBe(false);
    });

    it("shows the diagram widget when inactive and reveals the source when active", () => {
      const hydrator = hydrate();
      // 末尾带一段正文：光标落在正文里时围栏块非活跃（出图），
      // 光标进围栏块时活跃（源码可见）。光标本就在块内时不可能「非活跃」。
      const docWithTail = `${DOC}\n\n正文`;
      view = createEditor(docWithTail, { hydrateMermaid: hydrator });
      placeCursor(docWithTail.length - 1);

      expect(view.dom.querySelector(".cm-mermaid-block")).not.toBeNull();
      expect(
        view.dom.querySelector(".cm-content")?.textContent ?? "",
      ).not.toContain("```mermaid");
      expect(hydrator).toHaveBeenCalled();
      const root = hydrator.mock.calls[0]?.[0];
      expect(root).toBeInstanceOf(HTMLElement);
      expect(root?.classList.contains("cm-mermaid-block")).toBe(true);

      placeCursor(1);
      const activeText =
        view.dom.querySelector(".cm-content")?.textContent ?? "";
      expect(activeText).toContain("```mermaid");
      expect(activeText).toContain("graph TD;");
    });

    it("does not label a mermaid fence with the code language widget", () => {
      view = createEditor(DOC, { hydrateMermaid: hydrate() });
      placeCursor(view.state.doc.length);

      expect(view.dom.querySelector(".cm-fenced-code-language")).toBeNull();
    });

    it("survives a hydrator that rejects or throws", () => {
      const rejecting = vi.fn(async () => {
        throw new Error("boom");
      });
      view = createEditor(DOC, { hydrateMermaid: rejecting });
      expect(() => placeCursor(view.state.doc.length)).not.toThrow();

      view.destroy();
      const throwing = (() => {
        throw new Error("sync boom");
      }) as unknown as () => Promise<void>;
      view = createEditor(DOC, { hydrateMermaid: throwing });
      expect(() => placeCursor(view.state.doc.length)).not.toThrow();
    });

    it("preserves the document value", () => {
      view = createEditor(DOC, { hydrateMermaid: hydrate() });
      expect(view.state.doc.toString()).toBe(DOC);
    });
  });

  // --- 逐块型两态矩阵 -----------------------------------------------------

  describe("per-block-type active / inactive matrix", () => {
    const cases: Array<{
      name: string;
      doc: string;
      inactivePos: number;
      activePos: number;
      inactiveQuery: string;
      activeQuery: string;
      activeSelector?: string;
      options?: EditorDecorationsOptions;
    }> = [
      {
        name: "hr",
        doc: "---\n\nParagraph",
        inactivePos: 6,
        activePos: 1,
        inactiveQuery: ".cm-thematic-break",
        activeQuery: ".cm-thematic-break",
      },
      {
        name: "link",
        doc: "[文字](https://example.com)\n\nParagraph",
        inactivePos: 32,
        activePos: 2,
        inactiveQuery: ".cm-link:not(.cm-block-active)",
        activeQuery: ".cm-link",
        activeSelector: ".cm-link.cm-block-active",
      },
      {
        name: "image",
        doc: "![alt](photo.png)\n\nParagraph",
        inactivePos: 24,
        activePos: 2,
        inactiveQuery: ".cm-image-widget",
        activeQuery: ".cm-image-widget",
        activeSelector: ".cm-image-widget",
        options: { resolveImage: stubResolver },
      },
      {
        name: "mermaid",
        doc: "```mermaid\ngraph TD;\n```\n\nParagraph",
        inactivePos: 32,
        activePos: 1,
        inactiveQuery: ".cm-mermaid-block",
        activeQuery: ".cm-mermaid-block",
        options: { hydrateMermaid: async () => {} },
      },
    ];

    for (const c of cases) {
      it(`${c.name}: renders in the inactive state`, () => {
        view = createEditor(c.doc, c.options);
        placeCursor(c.inactivePos);
        expect(view.dom.querySelector(c.inactiveQuery)).not.toBeNull();
        expect(view.state.doc.toString()).toBe(c.doc);
      });

      it(`${c.name}: drops the rendered form in the active state`, () => {
        view = createEditor(c.doc, c.options);
        placeCursor(c.activePos);
        if (c.activeSelector) {
          expect(view.dom.querySelector(c.activeSelector)).not.toBeNull();
        } else {
          expect(view.dom.querySelector(c.activeQuery)).toBeNull();
        }
        expect(view.state.doc.toString()).toBe(c.doc);
      });
    }
  });

  // --- 文档值不变量 -------------------------------------------------------

  describe("document value invariant", () => {
    it("never changes the doc value across all block decoration types", () => {
      const original = [
        "# Heading",
        "",
        "---",
        "",
        "A [link](https://example.com) and ![img](photo.png).",
        "",
        "```mermaid",
        "graph TD;",
        "```",
      ].join("\n");

      view = createEditor(original, {
        resolveImage: stubResolver,
        hydrateMermaid: async () => {},
      });
      expect(view.state.doc.toString()).toBe(original);
    });
  });
});
