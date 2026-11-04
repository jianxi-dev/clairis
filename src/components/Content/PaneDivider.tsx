import { useState, type RefObject } from "react";
import { useDragResize } from "../../hooks/useDragResize";
import { clampRatio, type PaneBranch } from "../../lib/paneTree";
import { useStore } from "../../stores";

interface PaneDividerProps {
  branch: PaneBranch;
  containerRef: RefObject<HTMLDivElement | null>;
}

/** 两格之间的可拖拽分隔条（双向拖拽，比例经 240px 钳制，双击复位 0.5）。 */
export default function PaneDivider({
  branch,
  containerRef,
}: PaneDividerProps) {
  const [dragging, setDragging] = useState(false);
  const isRow = branch.dir === "row";

  const sizeOf = (): number => {
    const container = containerRef.current;
    if (!container) return 0;
    const rect = container.getBoundingClientRect();
    return isRow ? rect.width : rect.height;
  };

  const drag = useDragResize({
    onDrag: (e) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const raw = isRow
        ? (e.clientX - rect.left) / rect.width
        : (e.clientY - rect.top) / rect.height;
      useStore
        .getState()
        .setPaneRatio(
          branch.id,
          clampRatio(raw, isRow ? rect.width : rect.height),
        );
    },
    onEnd: () => setDragging(false),
  });

  const adjust = (delta: number) => {
    useStore
      .getState()
      .setPaneRatio(branch.id, clampRatio(branch.ratio + delta, sizeOf()));
  };

  return (
    <div
      data-testid="pane-divider"
      data-pane-divider={branch.id}
      role="separator"
      aria-orientation={isRow ? "vertical" : "horizontal"}
      aria-valuenow={Math.round(branch.ratio * 100)}
      tabIndex={0}
      onMouseDown={() => {
        setDragging(true);
        drag.startDrag(isRow ? "col-resize" : "row-resize");
      }}
      onDoubleClick={() => useStore.getState().setPaneRatio(branch.id, 0.5)}
      onKeyDown={(e) => {
        if (isRow && e.key === "ArrowLeft") {
          e.preventDefault();
          adjust(-0.05);
        } else if (isRow && e.key === "ArrowRight") {
          e.preventDefault();
          adjust(0.05);
        } else if (!isRow && e.key === "ArrowUp") {
          e.preventDefault();
          adjust(-0.05);
        } else if (!isRow && e.key === "ArrowDown") {
          e.preventDefault();
          adjust(0.05);
        } else if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          useStore.getState().setPaneRatio(branch.id, 0.5);
        }
      }}
      className={`pane-divider ${isRow ? "pane-divider-h" : "pane-divider-v"} ${
        dragging ? "dragging" : ""
      }`}
    />
  );
}
