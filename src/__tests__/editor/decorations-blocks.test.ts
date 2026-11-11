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
  parseImageAttributes,
  parseImageWidth,
  scanImageReference,
  serializeImageAttributes,
  writeImageAttributes,
  type ImageResolver,
} from "../../editors/decorations/image";
import { createMermaidDecorations } from "../../editors/decorations/mermaid";
import {
  closeImageMaximize,
  deselectImage,
} from "../../editors/decorations/imageToolbar";

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
    deselectImage();
    closeImageMaximize();
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
      expect(img?.style.clipPath).toBe("inset(0 round 8px)");
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

    it("点击选中图片：data-selected + 4 个角点，工具条 9 按钮", () => {
      view = createEditor("![alt text](photo.png)", {
        resolveImage: stubResolver,
      });
      placeCursor(view.state.doc.length);

      const widget = view.dom.querySelector(".cm-image-widget") as HTMLElement;
      widget.click();

      expect(widget.dataset.selected).toBe("true");
      expect(widget.querySelectorAll(".cm-image-corner")).toHaveLength(4);
      const toolbar = document.querySelector<HTMLElement>(
        '[data-testid="img-toolbar"]',
      );
      expect(toolbar).not.toBeNull();
      expect(toolbar!.querySelectorAll("button")).toHaveLength(9);
    });

    it("工具条动作按 from / path / alt 调用注入回调", () => {
      const calls: string[] = [];
      view = createEditor("![alt text](photo.png)", {
        resolveImage: stubResolver,
        onImageAi: (path, alt) => calls.push(`ai:${path}:${alt}`),
        onImageComment: (from) => calls.push(`comment:${from}`),
        onImageAlign: (from, align) => calls.push(`align:${from}:${align}`),
        onImageCut: (from) => calls.push(`cut:${from}`),
        onImageCopy: (from) => calls.push(`copy:${from}`),
        onImageDelete: (from) => calls.push(`delete:${from}`),
      });
      placeCursor(view.state.doc.length);

      (view.dom.querySelector(".cm-image-widget") as HTMLElement).click();

      const click = (testid: string): void => {
        (
          document.querySelector(`[data-testid="${testid}"]`) as HTMLElement
        ).click();
      };
      click("img-toolbar-ai");
      click("img-toolbar-comment");
      click("img-toolbar-align-left");
      click("img-toolbar-cut");
      click("img-toolbar-copy");
      click("img-toolbar-delete");

      expect(calls).toEqual([
        "ai:photo.png:alt text",
        "comment:0",
        "align:0:left",
        "cut:0",
        "copy:0",
        "delete:0",
      ]);
    });

    it("缺省回调的按钮禁用；裁剪固定显示后续票提示", () => {
      view = createEditor("![alt text](photo.png)", {
        resolveImage: stubResolver,
      });
      placeCursor(view.state.doc.length);

      (view.dom.querySelector(".cm-image-widget") as HTMLElement).click();

      const crop = document.querySelector<HTMLButtonElement>(
        '[data-testid="img-toolbar-crop"]',
      );
      expect(crop?.disabled).toBe(true);
      expect(crop?.title).toBe("裁剪（后续票实现）");
      const copy = document.querySelector<HTMLButtonElement>(
        '[data-testid="img-toolbar-copy"]',
      );
      expect(copy?.disabled).toBe(true);
    });

    it("点击外部取消选中并移除工具条", () => {
      view = createEditor("![alt text](photo.png)", {
        resolveImage: stubResolver,
      });
      placeCursor(view.state.doc.length);

      const widget = view.dom.querySelector(".cm-image-widget") as HTMLElement;
      widget.click();
      expect(widget.dataset.selected).toBe("true");

      document.body.click();

      expect(widget.dataset.selected).toBe("false");
      expect(document.querySelector('[data-testid="img-toolbar"]')).toBeNull();
    });

    it("选中图片被删除后工具条自动移除", async () => {
      view = createEditor("![alt text](photo.png)\n", {
        resolveImage: stubResolver,
      });
      placeCursor(view.state.doc.length);

      (view.dom.querySelector(".cm-image-widget") as HTMLElement).click();
      expect(
        document.querySelector('[data-testid="img-toolbar"]'),
      ).not.toBeNull();

      view.dispatch({ changes: { from: 0, to: view.state.doc.length } });

      await vi.waitFor(() => {
        expect(
          document.querySelector('[data-testid="img-toolbar"]'),
        ).toBeNull();
      });
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

  // --- 图片属性块 ---------------------------------------------------------

  describe("image attribute block", () => {
    it("parses width/height/align/crop and ignores unknown keys", () => {
      expect(
        parseImageAttributes(
          "width=920 height=600 align=left crop=10,20,300,400",
        ),
      ).toEqual({
        width: 920,
        height: 600,
        align: "left",
        crop: [10, 20, 300, 400],
      });
      expect(parseImageAttributes("width=10 unknown=x height=20")).toEqual({
        width: 10,
        height: 20,
        align: null,
        crop: null,
      });
      expect(parseImageAttributes("align=diagonal crop=1,2,3")).toEqual({
        width: null,
        height: null,
        align: null,
        crop: null,
      });
    });

    it("serializes attributes in a stable order", () => {
      expect(
        serializeImageAttributes({
          width: 920,
          height: 600,
          align: "left",
          crop: [10, 20, 300, 400],
        }),
      ).toBe("{width=920 height=600 align=left crop=10,20,300,400}");
      expect(
        serializeImageAttributes({
          width: null,
          height: null,
          align: null,
          crop: null,
        }),
      ).toBe("");
    });

    it("scans a parenthesized path without stopping at the inner paren", () => {
      const md = "![a](assets/image%20(1).png)";
      const ref = scanImageReference(md, 0);
      expect(ref?.path).toBe("assets/image%20(1).png");
      expect(ref?.end).toBe(md.length);
      expect(ref?.attrText).toBeNull();
    });

    it("scans an angle-wrapped path with spaces and parens", () => {
      const ref = scanImageReference("![a](<path with spaces (1).png>)", 0);
      expect(ref?.path).toBe("path with spaces (1).png");
      expect(ref?.title).toBeNull();
    });

    it("scans an attribute block after the closing paren", () => {
      const md = "![a](b.png){width=920 height=600}";
      const ref = scanImageReference(md, 0);
      expect(ref?.end).toBe("![a](b.png)".length);
      expect(ref?.attrText).toBe("width=920 height=600");
      expect(ref?.attrStart).toBe("![a](b.png)".length);
      expect(ref?.attrEnd).toBe(md.length);
    });

    it("scans an optional title before the closing paren", () => {
      const ref = scanImageReference('![a](b.png "title")', 0);
      expect(ref?.path).toBe("b.png");
      expect(ref?.title).toBe("title");
    });

    it("reads a legacy comment width", () => {
      expect(parseImageWidth("![a](b.png)<!--w=635-->", 11)).toBe(635);
      expect(parseImageWidth("![a](b.png)", 11)).toBeNull();
    });

    it("writer replaces a legacy comment with an attribute block", () => {
      view = createEditor("![a](b.png)<!--w=635-->");
      placeCursor(view.state.doc.length);
      const ok = writeImageAttributes(view, 0, {
        width: 700,
        height: null,
        align: null,
        crop: null,
      });
      expect(ok).toBe(true);
      expect(view.state.doc.toString()).toBe("![a](b.png){width=700}");
    });

    it("writer preserves existing height/align/crop", () => {
      view = createEditor("![a](b.png){width=100 height=50 align=left}");
      placeCursor(view.state.doc.length);
      const ok = writeImageAttributes(view, 0, {
        width: 200,
        height: 50,
        align: "left",
        crop: null,
      });
      expect(ok).toBe(true);
      expect(view.state.doc.toString()).toBe(
        "![a](b.png){width=200 height=50 align=left}",
      );
    });

    it("widget hides the attribute block so neither is visible", () => {
      view = createEditor("![a](photo.png){width=920}", {
        resolveImage: stubResolver,
      });
      placeCursor(view.state.doc.length);
      expect(view.dom.querySelector(".cm-image-widget")).not.toBeNull();
      const text = view.dom.querySelector(".cm-content")?.textContent ?? "";
      expect(text).not.toContain("width=920");
      expect(text).not.toContain("{");
    });

    it("widget applies the attribute width to the img", () => {
      view = createEditor("![a](photo.png){width=920}", {
        resolveImage: stubResolver,
      });
      placeCursor(view.state.doc.length);
      const img = view.dom.querySelector(".cm-image-widget img");
      expect(img?.getAttribute("data-width")).toBe("920");
    });

    it("widget keeps a parenthesized path intact", () => {
      const md = "![a](assets/image%20(1).png){width=920}";
      view = createEditor(md, {
        resolveImage: (p) =>
          p === "assets/image%20(1).png" ? "data:image/png;base64,abc" : null,
      });
      placeCursor(view.state.doc.length);
      const img = view.dom.querySelector(".cm-image-widget img");
      expect(img?.getAttribute("src")).toBe("data:image/png;base64,abc");
      expect(img?.getAttribute("data-width")).toBe("920");
      expect(view.state.doc.toString()).toBe(md);
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
