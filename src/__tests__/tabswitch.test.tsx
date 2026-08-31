import { describe, it, expect, afterEach } from "vitest";
import { render } from "@testing-library/react";
import PreviewView from "../components/Content/PreviewView";
import { mediaPlayer } from "../components/Content/mediaPlayerState";

afterEach(() => mediaPlayer.stop());

describe("tab 切换媒体状态（无迷你条）", () => {
  it("video 预览 → 卸载（切走 tab）→ minimize：播放器保留，移出视口", () => {
    const r = render(
      <PreviewView content="" fileKind="video" filePath="/a.mp4" />,
    );
    expect(mediaPlayer.getState().visible).toBe(true);
    r.unmount();
    expect(mediaPlayer.getState().visible).toBe(false);
    expect(mediaPlayer.getState().source?.filePath).toBe("/a.mp4");
  });

  it("video 预览 → 切到 text（同组件 props 变化）→ minimize", () => {
    const r = render(
      <PreviewView content="" fileKind="video" filePath="/a.mp4" />,
    );
    expect(mediaPlayer.getState().visible).toBe(true);
    // 模拟 ContentArea 中 tab 从 video 切到 text：同位置重渲染不同 fileKind
    r.rerender(
      <PreviewView content="text" fileKind="text" filePath="/a.txt" />,
    );
    expect(mediaPlayer.getState().visible).toBe(false);
    expect(mediaPlayer.getState().source?.filePath).toBe("/a.mp4");
  });
});
