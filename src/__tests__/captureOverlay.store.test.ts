import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  useCaptureOverlayStore,
  migrateLegacyCaptureFallback,
} from "../stores/captureOverlay";

// Override the global setup.ts mock so we can control invoke per-test.
const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

describe("captureOverlay store — batch submission", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(null);
    localStorage.clear();
    useCaptureOverlayStore.setState({
      status: "closed",
      draftContent: "",
      draftPrefix: "",
      history: [],
      displayLimit: 5,
      collapsed: true,
      selectedIndex: -1,
      undo: null,
      savedAckId: null,
      editingId: null,
      editBuffer: "",
    });
  });

  describe("handleCmdEnter", () => {
    it("returns null and does not invoke when draft is empty", async () => {
      useCaptureOverlayStore.setState({ draftContent: "", draftPrefix: "" });
      const result = await useCaptureOverlayStore.getState().handleCmdEnter();
      expect(result).toBeNull();
      expect(invokeMock).not.toHaveBeenCalled();
    });

    it("returns null when an undo is pending", async () => {
      useCaptureOverlayStore.setState({
        draftContent: "hello",
        draftPrefix: "",
        undo: { entryId: "x", deadline: Date.now() + 1000 },
      });
      const result = await useCaptureOverlayStore.getState().handleCmdEnter();
      expect(result).toBeNull();
      expect(invokeMock).not.toHaveBeenCalled();
    });

    it("submits a batch via append_inbox_batch and clears the draft", async () => {
      useCaptureOverlayStore.setState({
        draftContent: ".problem\n\nnote",
        draftPrefix: "",
      });
      const result = await useCaptureOverlayStore.getState().handleCmdEnter();

      expect(invokeMock).toHaveBeenCalledTimes(1);
      const [cmd, args] = invokeMock.mock.calls[0];
      expect(cmd).toBe("append_inbox_batch");
      expect(args.entries).toHaveLength(2);
      expect(args.entries[0]).toMatchObject({
        prefix: ".",
        content: "problem",
      });
      expect(args.entries[1]).toMatchObject({ prefix: "", content: "note" });

      const state = useCaptureOverlayStore.getState();
      expect(state.draftContent).toBe("");
      expect(state.draftPrefix).toBe("");
      expect(state.history).toHaveLength(2);
      expect(state.savedAckId).toBe(result);
    });

    it("falls back to per-entry append_inbox when the batch call fails", async () => {
      invokeMock
        .mockRejectedValueOnce(new Error("batch failed"))
        .mockResolvedValue(null);
      useCaptureOverlayStore.setState({
        draftContent: "a\n\nb",
        draftPrefix: "",
      });
      await useCaptureOverlayStore.getState().handleCmdEnter();

      const calls = invokeMock.mock.calls;
      expect(calls[0][0]).toBe("append_inbox_batch");
      expect(calls[1][0]).toBe("append_inbox");
      expect(calls[2][0]).toBe("append_inbox");
      expect(useCaptureOverlayStore.getState().history).toHaveLength(2);
    });

    it("writes to localStorage fallback when both batch and per-entry fail", async () => {
      invokeMock.mockRejectedValue(new Error("ipc down"));
      useCaptureOverlayStore.setState({
        draftContent: "a\n\nb",
        draftPrefix: "",
      });
      await useCaptureOverlayStore.getState().handleCmdEnter();

      const fallback = JSON.parse(
        localStorage.getItem("biaoyue_capture_fallback") || "[]",
      );
      expect(fallback).toHaveLength(2);
      expect(useCaptureOverlayStore.getState().history).toHaveLength(2);
    });
  });

  describe("handleCmdN", () => {
    it("submits when draft has content", async () => {
      useCaptureOverlayStore.setState({
        draftContent: "hello",
        draftPrefix: "",
      });
      await useCaptureOverlayStore.getState().handleCmdN();
      expect(invokeMock).toHaveBeenCalledWith(
        "append_inbox_batch",
        expect.anything(),
      );
    });

    it("clears content without submitting when draft is blank", async () => {
      useCaptureOverlayStore.setState({ draftContent: "   ", draftPrefix: "" });
      await useCaptureOverlayStore.getState().handleCmdN();
      expect(invokeMock).not.toHaveBeenCalled();
      expect(useCaptureOverlayStore.getState().draftContent).toBe("");
    });
  });

  describe("setDraftContent prefix detection", () => {
    it("consumes the prefix char and enters sticky prefix when cursor is at position 1", () => {
      useCaptureOverlayStore.getState().setDraftContent(".problem", 1);
      const state = useCaptureOverlayStore.getState();
      expect(state.draftPrefix).toBe(".");
      expect(state.draftContent).toBe("problem");
    });

    it("keeps sticky prefix while typing content", () => {
      const store = useCaptureOverlayStore.getState();
      store.setDraftContent(".problem", 1);
      useCaptureOverlayStore.getState().setDraftContent("problem", 7);
      const state = useCaptureOverlayStore.getState();
      expect(state.draftPrefix).toBe(".");
      expect(state.draftContent).toBe("problem");
    });

    it("clears prefix on empty input", () => {
      useCaptureOverlayStore.getState().setDraftContent(".", 1);
      useCaptureOverlayStore.getState().setDraftContent("", 0);
      const state = useCaptureOverlayStore.getState();
      expect(state.draftPrefix).toBe("");
      expect(state.draftContent).toBe("");
    });

    it("has no prefix for normal content", () => {
      useCaptureOverlayStore.getState().setDraftContent("hello", 5);
      expect(useCaptureOverlayStore.getState().draftPrefix).toBe("");
    });
  });

  describe("legacy localStorage key migration", () => {
    it("copies the legacy fallback key to the new key when the new key is absent", () => {
      localStorage.clear();
      localStorage.setItem("clairis_capture_fallback", '[{"id":"old"}]');

      migrateLegacyCaptureFallback();

      expect(localStorage.getItem("biaoyue_capture_fallback")).toBe(
        '[{"id":"old"}]',
      );
    });

    it("does not overwrite an existing new key", () => {
      localStorage.clear();
      localStorage.setItem("clairis_capture_fallback", '[{"id":"old"}]');
      localStorage.setItem("biaoyue_capture_fallback", '[{"id":"new"}]');

      migrateLegacyCaptureFallback();

      expect(localStorage.getItem("biaoyue_capture_fallback")).toBe(
        '[{"id":"new"}]',
      );
    });
  });
});
