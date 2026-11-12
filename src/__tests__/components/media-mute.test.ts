import { beforeEach, describe, expect, it } from "vitest";
import {
  clearMediaMuted,
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

const EP1 = "/videos/ep1.mp4";
const EP2 = "/videos/ep2.mp3";

beforeEach(() => {
  clearMediaMuted(EP1);
  clearMediaMuted(EP2);
  localStorage.clear();
});

describe("媒体静音状态（按文件隔离）", () => {
  it("默认未静音，切换与订阅只影响对应文件", () => {
    const seen: Array<[string, boolean]> = [];
    const unsubscribe = subscribeMediaMute((key, m) => seen.push([key, m]));
    expect(isMediaMuted(EP1)).toBe(false);
    toggleMediaMuted(EP1);
    expect(isMediaMuted(EP1)).toBe(true);
    expect(isMediaMuted(EP2)).toBe(false);
    setMediaMuted(EP1, false);
    unsubscribe();
    setMediaMuted(EP1, true);
    expect(seen).toEqual([
      [EP1, true],
      [EP1, false],
    ]);
  });

  it("清理后恢复未静音", () => {
    setMediaMuted(EP1, true);
    clearMediaMuted(EP1);
    expect(isMediaMuted(EP1)).toBe(false);
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
