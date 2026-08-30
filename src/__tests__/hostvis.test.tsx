import { describe, it, expect, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import MediaPlayerHost from "../components/Content/MediaPlayerHost";
import { mediaPlayer } from "../components/Content/mediaPlayerState";

afterEach(() => mediaPlayer.stop());

describe("host 全尺寸层切换", () => {
  it("show → 全尺寸在视口内; minimize → 移出视口（无迷你条）; show 同源 → 恢复", () => {
    act(() =>
      mediaPlayer.show({
        filePath: "/a.mp4",
        url: "media://localhost/a.mp4",
        fileKind: "video",
      }),
    );
    const { container } = render(<MediaPlayerHost />);
    const full = container.firstElementChild as HTMLElement;
    expect(full.style.left).toBe("0px");
    expect(container.textContent).not.toContain("回到播放");
    act(() => mediaPlayer.minimize());
    expect(full.style.left).toBe("-99999px");
    // 无迷你条（回到播放按钮不存在）
    expect(container.textContent).not.toContain("回到播放");
    expect(container.querySelector(".art-video-player")).not.toBeNull();
    act(() =>
      mediaPlayer.show({
        filePath: "/a.mp4",
        url: "media://localhost/a.mp4",
        fileKind: "video",
      }),
    );
    expect(full.style.left).toBe("0px");
    expect(container.textContent).not.toContain("回到播放");
  });
});
