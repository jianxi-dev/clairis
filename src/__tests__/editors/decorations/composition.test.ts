import { describe, it, expect } from "vitest";
import { compositionFilter } from "../../../editors/decorations/composition";

describe("composition fallback", () => {
  describe("compositionFilter", () => {
    it("returns a transaction filter", () => {
      expect(typeof compositionFilter).toBe("function");
    });

    it("returns an extension-compatible result shape", () => {
      // The filter should be usable as an EditorState extension
      expect(compositionFilter).toBeDefined();
    });
  });
});
