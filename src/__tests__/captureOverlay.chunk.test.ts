import { describe, it, expect } from "vitest";
import { chunkDraft } from "../stores/captureOverlay";

const fixedNow = () => new Date("2026-08-02T10:00:00.000Z");

describe("chunkDraft", () => {
  describe("empty / blank input", () => {
    it("returns [] for empty string", () => {
      expect(chunkDraft("", "", fixedNow)).toEqual([]);
    });

    it("returns [] for blank lines only", () => {
      expect(chunkDraft("\n\n", "", fixedNow)).toEqual([]);
    });
  });

  describe("plain note (no prefix)", () => {
    it("creates a single note entry with empty prefix", () => {
      const entries = chunkDraft("hello world", "", fixedNow);
      expect(entries).toHaveLength(1);
      expect(entries[0].prefix).toBe("");
      expect(entries[0].content).toBe("hello world");
      expect(entries[0].capturedAt).toBe("2026-08-02T10:00:00.000Z");
    });

    it("splits blank-line-separated lines into separate note entries", () => {
      const entries = chunkDraft("a\n\nb", "", fixedNow);
      expect(entries).toHaveLength(2);
      expect(entries[0].content).toBe("a");
      expect(entries[1].content).toBe("b");
    });
  });

  describe("prefix detection", () => {
    it("detects '.' prefix and strips it", () => {
      const entries = chunkDraft(".problem", "", fixedNow);
      expect(entries[0].prefix).toBe(".");
      expect(entries[0].content).toBe("problem");
    });

    it("detects '-' prefix", () => {
      const entries = chunkDraft("-todo", "", fixedNow);
      expect(entries[0].prefix).toBe("-");
      expect(entries[0].content).toBe("todo");
    });

    it("detects '!' prefix", () => {
      const entries = chunkDraft("!idea", "", fixedNow);
      expect(entries[0].prefix).toBe("!");
      expect(entries[0].content).toBe("idea");
    });

    it("detects '?' prefix", () => {
      const entries = chunkDraft("?wonder", "", fixedNow);
      expect(entries[0].prefix).toBe("?");
      expect(entries[0].content).toBe("wonder");
    });

    it("maps full-width IME punctuation to ASCII prefix", () => {
      expect(chunkDraft("。问题", "", fixedNow)[0].prefix).toBe(".");
      expect(chunkDraft("．问题", "", fixedNow)[0].prefix).toBe(".");
      expect(chunkDraft("—任务", "", fixedNow)[0].prefix).toBe("-");
      expect(chunkDraft("–任务", "", fixedNow)[0].prefix).toBe("-");
      expect(chunkDraft("！想法", "", fixedNow)[0].prefix).toBe("!");
      expect(chunkDraft("？疑问", "", fixedNow)[0].prefix).toBe("?");
    });
  });

  describe("non-prefix characters are not misdetected", () => {
    it("does not treat a leading digit '1' as a prefix", () => {
      const entries = chunkDraft("1. 列表项", "", fixedNow);
      expect(entries).toHaveLength(1);
      expect(entries[0].prefix).toBe("");
      expect(entries[0].content).toBe("1. 列表项");
    });

    it("does not treat '#' as a prefix", () => {
      const entries = chunkDraft("# 标题", "", fixedNow);
      expect(entries).toHaveLength(1);
      expect(entries[0].prefix).toBe("");
      expect(entries[0].content).toBe("# 标题");
    });
  });

  describe("continuation lines", () => {
    it("appends non-prefixed lines to the current block", () => {
      const entries = chunkDraft(".problem\nsecond line", "", fixedNow);
      expect(entries).toHaveLength(1);
      expect(entries[0].prefix).toBe(".");
      expect(entries[0].content).toBe("problem\nsecond line");
    });

    it("empty line ends the current block", () => {
      const entries = chunkDraft(".problem\n\nnote", "", fixedNow);
      expect(entries).toHaveLength(2);
      expect(entries[0].prefix).toBe(".");
      expect(entries[0].content).toBe("problem");
      expect(entries[1].prefix).toBe("");
      expect(entries[1].content).toBe("note");
    });
  });

  describe("sticky prefix", () => {
    it("applies stickyPrefix to the first non-prefixed line", () => {
      const entries = chunkDraft("a\nb", "-", fixedNow);
      expect(entries).toHaveLength(1);
      expect(entries[0].prefix).toBe("-");
      expect(entries[0].content).toBe("a\nb");
    });

    it("empty line clears sticky prefix for subsequent blocks", () => {
      const entries = chunkDraft("a\n\nb", "-", fixedNow);
      expect(entries).toHaveLength(2);
      expect(entries[0].prefix).toBe("-");
      expect(entries[0].content).toBe("a");
      expect(entries[1].prefix).toBe("");
      expect(entries[1].content).toBe("b");
    });
  });

  describe("mixed prefixes", () => {
    it("pushes the current block before starting a new prefixed block", () => {
      const entries = chunkDraft(".a\n- b", "", fixedNow);
      expect(entries).toHaveLength(2);
      expect(entries[0].prefix).toBe(".");
      expect(entries[0].content).toBe("a");
      expect(entries[1].prefix).toBe("-");
      expect(entries[1].content).toBe(" b");
    });
  });

  describe("capturedAt uniqueness", () => {
    it("increments capturedAt by 1ms per entry", () => {
      const entries = chunkDraft("a\n\nb\n\nc", "", fixedNow);
      expect(entries).toHaveLength(3);
      expect(entries[0].capturedAt).toBe("2026-08-02T10:00:00.000Z");
      expect(entries[1].capturedAt).toBe("2026-08-02T10:00:00.001Z");
      expect(entries[2].capturedAt).toBe("2026-08-02T10:00:00.002Z");
    });
  });

  describe("id uniqueness", () => {
    it("produces unique ids across entries", () => {
      const entries = chunkDraft("a\n\nb\n\nc", "", fixedNow);
      const ids = entries.map((e) => e.id);
      expect(new Set(ids).size).toBe(3);
    });
  });
});
