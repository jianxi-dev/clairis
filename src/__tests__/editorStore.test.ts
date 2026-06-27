import { describe, it, expect, beforeEach } from "vitest";
import { useEditorStore } from "../stores/editorStore";

describe("editorStore", () => {
  // Reset store before each test
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  describe("initial state", () => {
    it("starts with empty content", () => {
      const state = useEditorStore.getState();
      expect(state.content).toBe("");
      expect(state.dirty).toBe(false);
      expect(state.editorMode).toBe("wysiwyg");
      expect(state.fontSize).toBe(16);
      expect(state.filePath).toBeNull();
      expect(state.fileName).toBeNull();
      expect(state.contentVersion).toBe(0);
    });
  });

  describe("setContent", () => {
    it("updates content and sets dirty", () => {
      useEditorStore.getState().setContent("# Hello");
      const state = useEditorStore.getState();
      expect(state.content).toBe("# Hello");
      expect(state.dirty).toBe(true);
    });
  });

  describe("incContentVersion", () => {
    it("increments version counter", () => {
      const v0 = useEditorStore.getState().contentVersion;
      useEditorStore.getState().incContentVersion();
      expect(useEditorStore.getState().contentVersion).toBe(v0 + 1);
    });
  });

  describe("setEditorMode", () => {
    it("switches modes", () => {
      useEditorStore.getState().setEditorMode("source");
      expect(useEditorStore.getState().editorMode).toBe("source");

      useEditorStore.getState().setEditorMode("sourceReadOnly");
      expect(useEditorStore.getState().editorMode).toBe("sourceReadOnly");

      useEditorStore.getState().setEditorMode("wysiwyg");
      expect(useEditorStore.getState().editorMode).toBe("wysiwyg");
    });
  });

  describe("setFontSize", () => {
    it("updates font size", () => {
      useEditorStore.getState().setFontSize(20);
      expect(useEditorStore.getState().fontSize).toBe(20);
    });

    it("accepts edge values", () => {
      useEditorStore.getState().setFontSize(10);
      expect(useEditorStore.getState().fontSize).toBe(10);

      useEditorStore.getState().setFontSize(32);
      expect(useEditorStore.getState().fontSize).toBe(32);
    });
  });

  describe("setFilePath", () => {
    it("sets path and clears dirty", () => {
      useEditorStore.getState().setContent("content");
      useEditorStore.getState().setFilePath("/path/file.md", "file.md");
      const state = useEditorStore.getState();
      expect(state.filePath).toBe("/path/file.md");
      expect(state.fileName).toBe("file.md");
      expect(state.dirty).toBe(false);
    });
  });

  describe("setDirty", () => {
    it("sets dirty flag independently", () => {
      useEditorStore.getState().setDirty(true);
      expect(useEditorStore.getState().dirty).toBe(true);

      useEditorStore.getState().setDirty(false);
      expect(useEditorStore.getState().dirty).toBe(false);
    });
  });

  describe("setHeadingColors", () => {
    it("updates heading colors", () => {
      const colors = { h1: "#ff0000", h2: "#00ff00", h3: "#0000ff", h4: "#fff", h5: "#000", h6: "#ccc" };
      useEditorStore.getState().setHeadingColors(colors);
      expect(useEditorStore.getState().headingColors).toEqual(colors);
    });
  });

  describe("setTranslation", () => {
    it("merges translation state", () => {
      useEditorStore.getState().setTranslation({ loading: true });
      expect(useEditorStore.getState().translation.loading).toBe(true);
      expect(useEditorStore.getState().translation.active).toBe(false);

      useEditorStore.getState().setTranslation({ active: true, text: "hello" });
      expect(useEditorStore.getState().translation.active).toBe(true);
      expect(useEditorStore.getState().translation.text).toBe("hello");
      expect(useEditorStore.getState().translation.loading).toBe(true); // preserved
    });
  });

  describe("reset", () => {
    it("resets to initial state", () => {
      useEditorStore.getState().setContent("test");
      useEditorStore.getState().incContentVersion();
      useEditorStore.getState().reset();

      const state = useEditorStore.getState();
      expect(state.content).toBe("");
      expect(state.contentVersion).toBe(0);
      expect(state.dirty).toBe(false);
    });
  });
});
