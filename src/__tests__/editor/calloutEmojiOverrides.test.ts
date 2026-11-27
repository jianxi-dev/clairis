import { describe, expect, it } from "vitest";
import {
  getCalloutEmojiSnapshot,
  setCalloutEmojiSnapshot,
} from "../../editors/callout-emoji-overrides";

describe("callout-emoji-overrides 会话快照", () => {
  it("同签名命中，返回发布的快照", () => {
    const doc = "> [!highlight]\n> 正文";
    setCalloutEmojiSnapshot(doc, ["🎉", undefined]);
    expect(getCalloutEmojiSnapshot(doc)).toEqual(["🎉", undefined]);
  });

  it("换文档（签名不匹配）返回空数组", () => {
    const doc = "> [!highlight]\n> 正文";
    setCalloutEmojiSnapshot(doc, ["🎉"]);
    expect(getCalloutEmojiSnapshot("> [!NOTE]\n> 另一份")).toEqual([]);
  });

  it("未发布过（无快照）返回空数组", () => {
    // 模块级快照已被同文件前面的用例写入；这里只验证「无匹配签名」的语义，
    // 不依赖模块初始为空（用例顺序不应影响断言）。
    expect(getCalloutEmojiSnapshot("从未发布过的文档内容")).toEqual([]);
  });

  it("同长度不同内容签名不同", () => {
    const a = "abcd";
    const b = "abce";
    setCalloutEmojiSnapshot(a, ["🎉"]);
    expect(getCalloutEmojiSnapshot(b)).toEqual([]);
  });
});
