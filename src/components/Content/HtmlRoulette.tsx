import { useEffect, useRef } from "react";
import {
  createRoulette,
  type RouletteActions,
  type RouletteItem,
} from "../../editors/orchestration/roulette-view";
import {
  BACKGROUND_COLORS,
  FONT_COLORS,
} from "../../editors/orchestration/color-palette";
import type { SelectionRect } from "../../editors/html/bridge";

interface HtmlRouletteProps {
  /** 文字选区在主视口中的矩形 */
  anchor: SelectionRect;
  onCommand: (command: string, value?: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClose: () => void;
}

/**
 * HTML 可视化编辑的文字选区轮盘（E-19 同款几何）。
 *
 * 选中的是 iframe 里的文字，不是 CM6 文档：命令通过 `rangeCommand` 回传，
 * 由 iframe 内的 Range/execCommand 作用在同一个选区上。主侧只负责画轮盘
 * 和把块级 `innerHTML` 写回 `content`。
 */
export default function HtmlRoulette({
  anchor,
  onCommand,
  onUndo,
  onRedo,
  onClose,
}: HtmlRouletteProps) {
  const commandRef = useRef(onCommand);
  const undoRef = useRef(onUndo);
  const redoRef = useRef(onRedo);
  const closeRef = useRef(onClose);
  commandRef.current = onCommand;
  undoRef.current = onUndo;
  redoRef.current = onRedo;
  closeRef.current = onClose;

  useEffect(() => {
    const run = (command: string, value?: string) => () =>
      commandRef.current(command, value);
    const actions: RouletteActions = {
      smart: [],
      convert: () => [],
      columns: [],
      align: [
        {
          id: "align-left",
          label: "左对齐",
          icon: "text",
          keepOpen: true,
          run: run("justifyLeft"),
        },
        {
          id: "align-center",
          label: "居中",
          icon: "text",
          keepOpen: true,
          run: run("justifyCenter"),
        },
        {
          id: "align-right",
          label: "右对齐",
          icon: "text",
          keepOpen: true,
          run: run("justifyRight"),
        },
        {
          id: "align-justify",
          label: "两端对齐",
          icon: "text",
          keepOpen: true,
          run: run("justifyFull"),
        },
      ],
      history: [
        {
          id: "history-undo",
          label: "撤销",
          icon: "rotate",
          run: () => undoRef.current(),
        },
        {
          id: "history-redo",
          label: "重做",
          icon: "rotate",
          run: () => redoRef.current(),
        },
      ],
      clear: [
        {
          id: "clear-format",
          label: "清除格式",
          icon: "close",
          run: run("removeFormat"),
        },
      ],
      format: [
        {
          id: "format-bold",
          label: "粗体",
          icon: "text",
          keepOpen: true,
          run: run("bold"),
        },
        {
          id: "format-italic",
          label: "斜体",
          icon: "pencil",
          keepOpen: true,
          run: run("italic"),
        },
        {
          id: "format-underline",
          label: "下划线",
          icon: "text",
          keepOpen: true,
          run: run("underline"),
        },
        {
          id: "format-strike",
          label: "删除线",
          icon: "close",
          keepOpen: true,
          run: run("strikeThrough"),
        },
        {
          id: "format-code",
          label: "行内代码",
          icon: "code",
          keepOpen: true,
          run: run("code"),
        },
        ...["12", "16", "20", "24", "32"].map((size) => ({
          id: `format-size-${size}`,
          label: `字号 ${size}`,
          icon: "tune" as const,
          keepOpen: true,
          run: run("fontSize", `${size}px`),
        })),
      ] satisfies RouletteItem[],
      color: (kind, className) => {
        const swatch =
          (kind === "font" ? FONT_COLORS : BACKGROUND_COLORS).find(
            (c) => c.className === className,
          ) ?? null;
        if (!swatch) return;
        if (!swatch.className) {
          commandRef.current(kind === "font" ? "fontDefault" : "bgDefault");
          return;
        }
        commandRef.current(
          kind === "font" ? "foreColor" : "bgColor",
          swatch.swatch,
        );
      },
      painter: { toggle: () => {}, count: () => 0, active: () => false },
    };

    const handle = createRoulette(actions, () => closeRef.current(), {
      sectors: ["format", "align", "color", "history", "clear"],
    });
    document.body.appendChild(handle.element);
    handle.setCenter(anchor.x + anchor.width / 2, anchor.y + anchor.height / 2);
    return () => handle.destroy();
  }, [anchor.x, anchor.y, anchor.width, anchor.height]);

  return null;
}
