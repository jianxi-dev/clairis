import { beforeEach, describe, expect, it } from "vitest";
import {
  isMediaMuted,
  setMediaMuted,
  subscribeMediaMute,
  toggleMediaMuted,
} from "../../components/Content/mediaMute";
import {
  mediaDirOf,
  readSavedMediaIndex,
  saveMediaIndex,
} from "../../components/Content/mediaIndex";

beforeEach(() => {
  setMediaMuted(false);
  localStorage.clear();
});

describe("媒体静音状态", () => {
  it("默认未静音，切换与订阅生效", () => {
    const seen: boolean[] = [];
    const unsubscribe = subscribeMediaMute((m) => seen.push(m));
    expect(isMediaMuted()).toBe(false);
    toggleMediaMuted();
    expect(isMediaMuted()).toBe(true);
    setMediaMuted(false);
    unsubscribe();
    setMediaMuted(true);
    expect(seen).toEqual([true, false]);
  });
});

describe("播放列表记忆", () => {
  it("保存后按目录读回当前项", () => {
    saveMediaIndex("/videos/ep2.mp4");
    expect(mediaDirOf("/videos/ep2.mp4")).toBe("/videos");
    expect(readSavedMediaIndex()).toEqual({
      dir: "/videos",
      path: "/videos/ep2.mp4",
    });
  });

  it("坏数据返回 null", () => {
    localStorage.setItem("biaoyue.media.lastIndex", "{bad");
    expect(readSavedMediaIndex()).toBeNull();
  });
});
