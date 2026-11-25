import { describe, it, expect } from "vitest";
import { Text } from "@codemirror/state";
import {
  CALLOUT_MARK_ITEM,
  blockConvertChanges,
  calloutMenuItems,
} from "../../editors/orchestration/block-convert";

describe("转换菜单「高亮」落点", () => {
  it("声明 calloutKind=highlight", () => {
    expect(CALLOUT_MARK_ITEM.calloutKind).toBe("highlight");
    expect(calloutMenuItems()[0]).toBe(CALLOUT_MARK_ITEM);
  });

  it("转换写入 [!HIGHLIGHT] 而不是 [!NOTE]", () => {
    const doc = Text.of(["正文段落"]);
    const changes = blockConvertChanges(doc, { from: 0, to: 4 }, "callout", {
      calloutKind: CALLOUT_MARK_ITEM.calloutKind,
    });
    expect(changes).toHaveLength(1);
    expect(changes[0].insert).toContain("[!HIGHLIGHT]");
    expect(changes[0].insert).not.toContain("[!NOTE]");
  });

  it("缺 calloutKind 时仍回落 NOTE（对照）", () => {
    const doc = Text.of(["正文段落"]);
    const changes = blockConvertChanges(doc, { from: 0, to: 4 }, "callout");
    expect(changes[0].insert).toContain("[!NOTE]");
  });
});
