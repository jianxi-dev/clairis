import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { floatingToolbar } from "../../editors/orchestration/floating-toolbar";
import {
  clearCommands,
  executeCommand,
  hasCommand,
  listCommandIds,
  registerCommand,
} from "../../editors/orchestration/commands";

let view: EditorView;

beforeEach(() => {
  clearCommands();
  view = new EditorView({ state: EditorState.create({ doc: "hello" }) });
});

afterEach(() => {
  view.destroy();
  clearCommands();
});

describe("命令注册表", () => {
  it("注册后 hasCommand 为真且 executeCommand 返回 true", () => {
    let calls = 0;
    registerCommand("demo", () => {
      calls += 1;
    });
    expect(hasCommand("demo")).toBe(true);
    expect(executeCommand("demo", { view })).toBe(true);
    expect(calls).toBe(1);
  });

  it("未注册的 id 返回 false 且不抛错", () => {
    expect(hasCommand("missing")).toBe(false);
    expect(executeCommand("missing", { view })).toBe(false);
  });

  it("重复注册覆盖旧实现", () => {
    let which = "";
    registerCommand("dup", () => {
      which = "first";
    });
    registerCommand("dup", () => {
      which = "second";
    });
    executeCommand("dup", { view });
    expect(which).toBe("second");
    expect(listCommandIds().filter((id) => id === "dup")).toHaveLength(1);
  });

  it("命令拿到调用点传入的 view", () => {
    let seen: EditorView | null = null;
    registerCommand("ctx", ({ view: v }) => {
      seen = v;
    });
    executeCommand("ctx", { view });
    expect(seen).toBe(view);
  });
});

describe("内置命令装配", () => {
  it("格式扇区六项在扩展装配时注册", () => {
    const mounted = new EditorView({
      state: EditorState.create({ doc: "x", extensions: [floatingToolbar()] }),
    });
    try {
      for (const id of [
        "format-link",
        "format-underline",
        "format-italic",
        "format-bold",
        "format-code",
        "format-strike",
      ]) {
        expect(hasCommand(id)).toBe(true);
      }
    } finally {
      mounted.destroy();
    }
  });
});
