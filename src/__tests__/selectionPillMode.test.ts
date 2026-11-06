// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { detectSelectionPillMode } from "../lib/selectionPillMode";

function makeFixture() {
  const editor = document.createElement("div");
  editor.className = "cm-content";
  const editorText = document.createTextNode("editor body");
  editor.appendChild(editorText);

  const preview = document.createElement("div");
  preview.className = "preview-content";
  const previewText = document.createTextNode("preview body");
  preview.appendChild(previewText);

  const otherPreview = document.createElement("div");
  otherPreview.className = "preview-content";
  const otherText = document.createTextNode("second preview");
  otherPreview.appendChild(otherText);

  const outside = document.createElement("div");
  const outsideText = document.createTextNode("outside");
  outside.appendChild(outsideText);

  document.body.replaceChildren(editor, preview, otherPreview, outside);

  return {
    editor,
    editorText,
    preview,
    previewText,
    otherPreview,
    otherText,
    outside,
    outsideText,
  };
}

function select(
  anchorNode: Node,
  anchorOffset: number,
  focusNode: Node,
  focusOffset: number,
): Selection | null {
  const s = window.getSelection();
  if (!s) return null;
  s.setBaseAndExtent(anchorNode, anchorOffset, focusNode, focusOffset);
  return s;
}

describe("detectSelectionPillMode", () => {
  beforeEach(() => {
    window.getSelection()?.removeAllRanges();
  });

  it("returns editor when both endpoints are inside the editor DOM", () => {
    const f = makeFixture();
    const s = select(f.editorText, 0, f.editorText, 5);
    expect(detectSelectionPillMode(s, f.editor, [f.preview])).toBe("edit");
  });

  it("returns preview when both endpoints are inside one preview root", () => {
    const f = makeFixture();
    const s = select(f.previewText, 0, f.previewText, 5);
    expect(detectSelectionPillMode(s, f.editor, [f.preview])).toBe("preview");
  });

  it("returns null for a collapsed selection", () => {
    const f = makeFixture();
    const s = select(f.previewText, 3, f.previewText, 3);
    expect(detectSelectionPillMode(s, f.editor, [f.preview])).toBeNull();
  });

  it("returns null when the selection spans editor and preview", () => {
    const f = makeFixture();
    const s = select(f.editorText, 0, f.previewText, 5);
    expect(detectSelectionPillMode(s, f.editor, [f.preview])).toBeNull();
  });

  it("returns null when the selection spans two preview roots", () => {
    const f = makeFixture();
    const s = select(f.previewText, 0, f.otherText, 5);
    expect(
      detectSelectionPillMode(s, f.editor, [f.preview, f.otherPreview]),
    ).toBeNull();
  });

  it("returns null when the selection is outside both surfaces", () => {
    const f = makeFixture();
    const s = select(f.outsideText, 0, f.outsideText, 4);
    expect(detectSelectionPillMode(s, f.editor, [f.preview])).toBeNull();
  });

  it("returns null when there is no selection", () => {
    const f = makeFixture();
    expect(detectSelectionPillMode(null, f.editor, [f.preview])).toBeNull();
  });

  it("returns null when editorDom is missing and the selection is not in a preview", () => {
    const f = makeFixture();
    const s = select(f.editorText, 0, f.editorText, 4);
    expect(detectSelectionPillMode(s, null, [f.preview])).toBeNull();
  });
});
