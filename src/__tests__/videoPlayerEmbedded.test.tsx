import { describe, it, expect, afterEach } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import VideoPlayer from "../components/Content/VideoPlayer";

afterEach(() => cleanup());

const baseProps = {
  filePath: "/tmp/clip.mp4",
  url: "media://localhost/tmp/clip.mp4",
  fileKind: "video" as const,
};

async function renderPlayer(embedded?: boolean) {
  const view = render(<VideoPlayer {...baseProps} embedded={embedded} />);
  await waitFor(() => {
    expect(view.container.querySelector(".art-video-player")).not.toBeNull();
  });
  return view;
}

describe("VideoPlayer embedded 上下文控件显隐（#1230）", () => {
  it("默认（未传 embedded）不注册宽度与全屏控件", async () => {
    const { container } = await renderPlayer();
    expect(container.querySelector("[data-name='width']")).toBeNull();
    expect(container.querySelector("[data-name='fullscreen']")).toBeNull();
  });

  it("embedded=false 显式传入同样不注册", async () => {
    const { container } = await renderPlayer(false);
    expect(container.querySelector("[data-name='width']")).toBeNull();
    expect(container.querySelector("[data-name='fullscreen']")).toBeNull();
  });

  it("embedded=true 注册宽度与全屏控件", async () => {
    const { container } = await renderPlayer(true);
    expect(container.querySelector("[data-name='width']")).not.toBeNull();
    expect(container.querySelector("[data-name='fullscreen']")).not.toBeNull();
  });

  it("embedded=true 宽度档菜单恰好两档", async () => {
    const { container } = await renderPlayer(true);
    fireEvent.click(container.querySelector("[data-name='width']")!);
    const items = container.querySelectorAll(".width-menu-item");
    expect(items).toHaveLength(2);
    expect(Array.from(items).map((el) => el.textContent)).toEqual([
      "满页面宽度",
      "全屏",
    ]);
  });

  it("embedded=true 右键画面菜单含「全屏」项", async () => {
    const { container } = await renderPlayer(true);
    const player = container.querySelector(".art-video-player")!;
    fireEvent.contextMenu(player);
    const menu = await waitFor(() => {
      const el = document.querySelector(".art-contextmenus");
      expect(el).not.toBeNull();
      return el;
    });
    expect(menu?.textContent).toContain("全屏");
  });
});
