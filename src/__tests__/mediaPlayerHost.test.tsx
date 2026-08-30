import { describe, it, expect, afterEach, vi } from "vitest";
import { render, act } from "@testing-library/react";
import MediaPlayerHost from "../components/Content/MediaPlayerHost";
import { mediaPlayer } from "../components/Content/mediaPlayerState";

afterEach(() => {
  mediaPlayer.stop();
});

describe("MediaPlayerHost 媒体播放器宿主（无迷你条）", () => {
  it("媒体源注册后挂载全尺寸播放器", () => {
    act(() => {
      mediaPlayer.show({
        filePath: "/tmp/clip.mp4",
        url: "media://localhost/tmp/clip.mp4",
        fileKind: "video",
      });
    });
    const { container } = render(<MediaPlayerHost />);
    expect(container.querySelector(".art-video-player")).not.toBeNull();
    // 无迷你条 UI（MiniBar 的「回到播放」「关闭」按钮均不存在）
    expect(container.textContent).not.toContain("回到播放");
    const miniBarClose = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "关闭",
    );
    expect(miniBarClose).toBeUndefined();
  });

  it("minimize（切走 tab）→ 播放器保持挂载但移出视口，无迷你条", () => {
    act(() => {
      mediaPlayer.show({
        filePath: "/tmp/clip.mp4",
        url: "media://localhost/tmp/clip.mp4",
        fileKind: "video",
      });
    });
    const { container } = render(<MediaPlayerHost />);
    expect(container.querySelector(".art-video-player")).not.toBeNull();
    act(() => {
      mediaPlayer.minimize();
    });
    // 播放器仍挂载（离屏继续播放），无迷你条按钮
    expect(container.querySelector(".art-video-player")).not.toBeNull();
    expect(container.textContent).not.toContain("回到播放");
    const miniBarClose = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "关闭",
    );
    expect(miniBarClose).toBeUndefined();
    // 切回（show 同源）→ 恢复全尺寸
    act(() => {
      mediaPlayer.show({
        filePath: "/tmp/clip.mp4",
        url: "media://localhost/tmp/clip.mp4",
        fileKind: "video",
      });
    });
    const full = container.firstElementChild as HTMLElement;
    expect(full.style.left).toBe("0px");
  });

  it("stop（关闭媒体 tab）→ 播放器卸载", () => {
    act(() => {
      mediaPlayer.show({
        filePath: "/tmp/song.mp3",
        url: "media://localhost/tmp/song.mp3",
        fileKind: "audio",
      });
    });
    const { container } = render(<MediaPlayerHost />);
    expect(container.querySelector(".art-video-player")).not.toBeNull();
    act(() => {
      mediaPlayer.stop();
    });
    expect(container.querySelector(".art-video-player")).toBeNull();
  });

  // 回归：StrictMode double-invoke 场景（开发模式下 effect 执行
  // mount → cleanup → mount），MediaPreviewRegistrar 会 show→minimize→show
  // 同一 source。第二次 show 必须 emit（visible false→true），
  // 否则 MediaPlayerHost 停留在离屏状态，画面不显示。
  it("minimize 后再次 show 同一 source：必须 emit（恢复全尺寸）", () => {
    const fn = vi.fn();
    mediaPlayer.subscribe(fn);

    mediaPlayer.show({
      filePath: "/tmp/clip.mp4",
      url: "media://localhost/tmp/clip.mp4",
      fileKind: "video",
    });
    mediaPlayer.minimize();
    mediaPlayer.show({
      filePath: "/tmp/clip.mp4",
      url: "media://localhost/tmp/clip.mp4",
      fileKind: "video",
    });

    expect(mediaPlayer.getState().visible).toBe(true);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("show(A) → show(B)（不同源）必须 emit", () => {
    const fn = vi.fn();
    mediaPlayer.subscribe(fn);
    mediaPlayer.show({
      filePath: "/a.mp4",
      url: "media://localhost/a.mp4",
      fileKind: "video",
    });
    mediaPlayer.show({
      filePath: "/b.mp4",
      url: "media://localhost/b.mp4",
      fileKind: "video",
    });
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
