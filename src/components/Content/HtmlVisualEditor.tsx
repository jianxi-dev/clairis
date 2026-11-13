import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditorStore } from "../../stores/editorStore";
import {
  commandForCaptureMode,
  commandForRange,
  commandForSelection,
  parseBridgeMessage,
  type CaptureRegionMessage,
  type SelectionRect,
} from "../../editors/html/bridge";
import {
  applyBlockSplit,
  applyNodeMove,
  applyNodeRemove,
  applyInnerHtml,
  applyLink,
  applyStylePatch,
  applyTextEdit,
  describeNode,
  textOfNode,
} from "../../editors/html/edit";
import { captureRegionToPng } from "../../editors/html/capture";
import { buildEditableDoc } from "../../editors/html/runtime";
import {
  createUndoStack,
  recordEdit,
  undo,
  redo,
  type UndoStack,
} from "../../editors/html/undoStack";
import HtmlEditToolbar from "./HtmlEditToolbar";
import HtmlRangeToolbar from "./HtmlRangeToolbar";

interface ResizeGesture {
  edge: "e" | "s" | "se" | "w";
  pointerId: number;
  startX: number;
  startY: number;
  startW: number;
  startH: number;
  startLeft: number;
  startTop: number;
  left: number;
  top: number;
  w: number;
  h: number;
}

interface HtmlVisualEditorProps {
  content: string;
  filePath?: string | null;
  /**
   * 编辑器的改动交回主侧；`content` 是唯一真相（design D2）。
   *
   * 接收 updater 而不是成品字符串：同一 tick 内会连发 textEditInput /
   * textEditEnd / splitBlock 三条消息，若各自拿渲染期的 `content` 去算，
   * 后到的那条会把先到的覆盖掉（打字内容直接丢）。
   *
   * 返回应用后的内容：文档级撤销栈要按「改动前 → 改动后」配对，而同一 tick
   * 内 `contentRef` 可能还没跟上（#321）。
   */
  onContentChange?: (updater: (prev: string) => string) => string;
}

/**
 * HTML 可视化编辑面板（E-16 / H2）。
 *
 * 与 `HtmlPreview` 是**两条通道**（design D1）：预览禁一切脚本，这里只放行
 * 带 nonce 的注入运行时。
 *
 * 高亮框与文本编辑都在 iframe 内部完成（跨源，主文档碰不到它的布局）；
 * 主侧只做两件事：判定"选中的是哪个节点"，以及把改动折算回 `content`。
 */
export default function HtmlVisualEditor({
  content,
  filePath,
  onContentChange,
}: HtmlVisualEditorProps) {
  const fontSize = useEditorStore((s) => s.fontSize);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  // 选中元素的矩形（主视口坐标）+ 它属于哪个节点。带 nodeId 是为了丢掉
  // 「切选中时迟到的旧矩形」——否则工具条会先跳到上一个元素的位置。
  const [box, setBox] = useState<{
    nodeId: string;
    anchor: SelectionRect;
  } | null>(null);
  const [resizing, setResizing] = useState<ResizeGesture | null>(null);
  // 手势的真值：React 状态更新异步，连续 pointermove 读状态会丢帧。
  const resizingRef = useRef<ResizeGesture | null>(null);
  // 编辑期间冻结文档：否则每敲一个字都重建 iframe，光标与编辑态一起丢。
  //
  // 用 ref 而不是 state 做判定：content 走的是外部 store，订阅回调可能在
  // setState 提交之前就触发重渲染；那时若读的是 state，会看到 editing=false
  // 而重建文档——表现为"打着字，iframe 突然刷新，回车没人接"（实测偶发）。
  const editingRef = useRef(false);
  // 文字选区期间冻结 iframe：格式化会改 content，重建会把选区连同轮盘一起丢掉。
  const textSelectingRef = useRef(false);
  const rangeDirtyRef = useRef(false);
  const frozenRef = useRef<string | null>(null);
  // 文档级撤销栈（#321）：iframe 里没有可用的撤销栈，每次提交都在这里留一份
  // 「改动前」的快照；Ctrl/Cmd+Z 由运行时转发成 undoRequest 后按快照回退。
  const undoStackRef = useRef<UndoStack>(createUndoStack());
  // 只用来在进入/离开编辑时触发一次重算
  const [docTick, setDocTick] = useState(0);
  // 截图模式 + 结果提示（截图是异步的，且不进 content，不接受控字段）
  const [capturing, setCapturing] = useState(false);
  // 文字选区（HTML 文字轮盘）。矩形是主视口坐标，text 只用于判空。
  const [textSel, setTextSel] = useState<{
    anchor: SelectionRect;
    text: string;
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 消息监听的 effect 依赖是空数组，读不到最新 props——用 ref 带走。
  // 在 effect 里写而不是渲染期写：渲染期写 ref 与并发渲染打架。
  const contentRef = useRef(content);
  const pathRef = useRef(filePath);
  useEffect(() => {
    contentRef.current = content;
    pathRef.current = filePath;
  });

  const srcDoc = useMemo(() => {
    if ((editingRef.current || textSelectingRef.current) && frozenRef.current) {
      return frozenRef.current;
    }
    const doc = buildEditableDoc(content, { filePath, fontSize });
    if (!editingRef.current && !textSelectingRef.current)
      frozenRef.current = doc;
    return doc;
  }, [content, filePath, fontSize, docTick]);

  // 订阅必须稳定：onContentChange 是调用方每次渲染新建的箭头函数，若把它写进
  // effect 依赖，监听见会在每次按键后解绑-重绑；Enter 连发的三条消息正好可能落进
  // 那个空窗，表现为「偶发丢字」（这个 flake 是真的，不是运气）。
  const changeRef = useRef(onContentChange);
  useEffect(() => {
    changeRef.current = onContentChange;
  }, [onContentChange]);

  const commit = useCallback((updater: (prev: string) => string) => {
    const prev = contentRef.current;
    const next = changeRef.current?.(updater) ?? updater(prev);
    if (next !== prev) {
      undoStackRef.current = recordEdit(undoStackRef.current, prev);
    }
    contentRef.current = next;
  }, []);

  /** 恢复某份文档快照：同时退出编辑冻结，让 iframe 按恢复后的内容重建。 */
  const restore = useCallback((next: string) => {
    editingRef.current = false;
    frozenRef.current = null;
    setDocTick((n) => n + 1);
    contentRef.current = next;
    changeRef.current?.(() => next);
  }, []);

  const handleUndo = useCallback(() => {
    const result = undo(undoStackRef.current, contentRef.current);
    if (result.content === null) return;
    undoStackRef.current = result.stack;
    restore(result.content);
  }, [restore]);

  const handleRedo = useCallback(() => {
    const result = redo(undoStackRef.current, contentRef.current);
    if (result.content === null) return;
    undoStackRef.current = result.stack;
    restore(result.content);
  }, [restore]);

  const send = useCallback((payload: unknown) => {
    frameRef.current?.contentWindow?.postMessage(payload, "*");
  }, []);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 3000);
  }, []);

  /** 截图：iframe 只给区域，渲染与落盘都在主侧（沿用导出 PNG 的管线）。 */
  const handleCapture = useCallback(
    async (msg: CaptureRegionMessage) => {
      setCapturing(false);
      send(commandForCaptureMode(false));
      const result = await captureRegionToPng({
        content: contentRef.current,
        filePath: pathRef.current,
        region: msg.region,
        viewportWidth: msg.viewportWidth,
        bodyStyle: msg.bodyStyle,
      });
      if (result.status === "error") {
        showNotice(`截图失败：${result.message}`);
      } else if (result.status === "saved") {
        showNotice("已保存截图");
      }
    },
    [send, showNotice],
  );

  // 收上报：只认自己这一帧发来的，载荷交给 bridge 解析（版本位/形状不对就丢）
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const frame = frameRef.current;
      if (!frame || e.source !== frame.contentWindow) return;
      const msg = parseBridgeMessage(e.data);
      if (!msg) return;
      switch (msg.type) {
        case "selection":
          setSelected(msg.nodeId);
          if (!msg.nodeId) setBox(null);
          break;
        case "textSelection": {
          if (!msg.rect) {
            if (textSelectingRef.current || rangeDirtyRef.current) {
              textSelectingRef.current = false;
              rangeDirtyRef.current = false;
              setDocTick((n) => n + 1);
            }
            setTextSel(null);
            break;
          }
          const frame = frameRef.current?.getBoundingClientRect();
          textSelectingRef.current = true;
          setSelected(null);
          setBox(null);
          setTextSel({
            anchor: {
              x: (frame?.left ?? 0) + msg.rect.x,
              y: (frame?.top ?? 0) + msg.rect.y,
              width: msg.rect.width,
              height: msg.rect.height,
            },
            text: msg.text,
          });
          break;
        }
        case "rangeHtml":
          rangeDirtyRef.current = true;
          commit((prev) => applyInnerHtml(prev, msg.nodeId, msg.html));
          break;
        case "selectionRect": {
          // iframe 报的是它自己的视口坐标，换算到主视口放这里（事件回调里读
          // ref 是安全的；渲染期读 ref 会与 React 的并发渲染打架）。
          const frame = frameRef.current?.getBoundingClientRect();
          setBox({
            nodeId: msg.nodeId,
            anchor: {
              x: (frame?.left ?? 0) + msg.rect.x,
              y: (frame?.top ?? 0) + msg.rect.y,
              width: msg.rect.width,
              height: msg.rect.height,
            },
          });
          break;
        }
        case "saveRequest":
          // 转成主窗口的快捷键事件，复用 App 里那一份保存逻辑，而不是另写一条
          window.dispatchEvent(
            new KeyboardEvent("keydown", {
              key: "s",
              metaKey: true,
              bubbles: true,
            }),
          );
          break;
        case "undoRequest":
          handleUndo();
          break;
        case "redoRequest":
          handleRedo();
          break;
        case "textEditBegin":
          editingRef.current = true;
          setDocTick((n) => n + 1);
          break;
        case "textEditEnd":
          // 先解冻再提交：让 iframe 按新内容重建一次
          editingRef.current = false;
          frozenRef.current = null;
          setDocTick((n) => n + 1);
          break;
        case "textEditInput":
          commit((prev) => applyTextEdit(prev, msg.nodeId, msg.text));
          break;
        case "splitBlock":
          editingRef.current = false;
          frozenRef.current = null;
          setDocTick((n) => n + 1);
          commit((prev) =>
            applyBlockSplit(prev, msg.nodeId, msg.before, msg.after),
          );
          break;
        case "moveNode":
          // 拖拽后同标签元素的序号全变，旧选中已失效（design D7）
          setSelected(null);
          setBox(null);
          commit((prev) =>
            applyNodeMove(prev, msg.nodeId, msg.targetId, msg.position),
          );
          break;
        case "captureRegion":
          void handleCapture(msg);
          break;
        default:
          break;
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [commit, handleCapture, handleUndo, handleRedo]);

  // 选中变化 → 下发命令让 iframe 自己挪框。文档重建后也重发一次。
  useEffect(() => {
    frameRef.current?.contentWindow?.postMessage(
      commandForSelection(selected),
      "*",
    );
  }, [selected, srcDoc]);

  // 工具条的显示真值来自 content（design D3），不是 iframe 上报的属性
  const info = useMemo(
    () => (selected ? describeNode(content, selected) : null),
    [content, selected],
  );

  const beginResize = (
    edge: ResizeGesture["edge"],
    e: React.PointerEvent,
  ): void => {
    if (!box) return;
    e.preventDefault();
    e.stopPropagation();
    // 捕获指针：拖拽期间 pointermove/up 全部回到手柄，不再依赖 window
    // 事件穿过 iframe——指针移出 iframe 时 window 收不到，拖拽就断在半路。
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // 某些环境不支持指针捕获：监听仍挂在元素上。
    }
    const gesture: ResizeGesture = {
      edge,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startW: box.anchor.width,
      startH: box.anchor.height,
      startLeft: box.anchor.x,
      startTop: box.anchor.y,
      left: box.anchor.x,
      top: box.anchor.y,
      w: box.anchor.width,
      h: box.anchor.height,
    };
    resizingRef.current = gesture;
    setResizing(gesture);
  };

  const moveResize = (e: React.PointerEvent): void => {
    const prev = resizingRef.current;
    if (!prev || e.pointerId !== prev.pointerId) return;
    e.preventDefault();
    const dx = e.clientX - prev.startX;
    const dy = e.clientY - prev.startY;
    const nextW = Math.max(
      24,
      prev.edge === "w" ? prev.startW - dx : prev.startW + dx,
    );
    const nextH = Math.max(24, prev.startH + dy);
    const next: ResizeGesture = {
      ...prev,
      w:
        prev.edge === "e" || prev.edge === "se" || prev.edge === "w"
          ? nextW
          : prev.w,
      h: prev.edge === "s" || prev.edge === "se" ? nextH : prev.h,
      // 西侧手柄：宽度减多少，left 就右移多少，右边缘保持不动。
      left:
        prev.edge === "w" ? prev.startLeft + (prev.startW - nextW) : prev.left,
    };
    resizingRef.current = next;
    setResizing(next);
  };

  const endResize = (e: React.PointerEvent): void => {
    const prev = resizingRef.current;
    if (!prev || e.pointerId !== prev.pointerId) return;
    resizingRef.current = null;
    setResizing(null);
    if (!selected) return;
    const { w, h, left, top } = prev;
    commit((content) =>
      applyStylePatch(content, selected, {
        width: `${Math.round(w)}px`,
        height: `${Math.round(h)}px`,
        // padding/border 不再叠加到宽高上，避免「越拖越大」。
        "box-sizing": "border-box",
      }),
    );
    setBox((b) =>
      b && b.nodeId === selected
        ? {
            ...b,
            anchor: { ...b.anchor, x: left, y: top, width: w, height: h },
          }
        : b,
    );
  };

  const cancelResizeGesture = useCallback((): void => {
    if (!resizingRef.current) return;
    resizingRef.current = null;
    setResizing(null);
    setBox(null);
    setSelected(null);
  }, []);

  const cancelResize = (): void => {
    if (!resizingRef.current) return;
    cancelResizeGesture();
  };

  useEffect(() => {
    const onBlur = () => cancelResizeGesture();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelResizeGesture();
    };
    window.addEventListener("blur", onBlur);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("keydown", onKey);
    };
  }, [cancelResizeGesture]);

  return (
    <>
      <iframe
        ref={frameRef}
        // sandbox 不给 allow-same-origin：编辑态文档与主应用跨源隔离，
        // 用户 HTML 里的脚本即便绕开 CSP 也碰不到主窗口
        sandbox="allow-scripts"
        srcDoc={srcDoc}
        title="HTML 可视化编辑"
        // 编辑面不是按钮：悬停提示会摘掉 title，既吵又让 a11y 名字失效。
        data-no-tip
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          background: "var(--app-surface)",
        }}
      />
      {selected && box?.nodeId === selected && !editingRef.current && (
        <div
          data-testid="html-resize-guides"
          style={{
            position: "fixed",
            left: resizing?.left ?? box.anchor.x,
            top: resizing?.top ?? box.anchor.y,
            width: resizing?.w ?? box.anchor.width,
            height: resizing?.h ?? box.anchor.height,
            border: "1px dashed var(--app-accent)",
            pointerEvents: "none",
            zIndex: 40,
          }}
        >
          {(["e", "s", "se", "w"] as const).map((edge) => {
            const style: React.CSSProperties =
              edge === "e"
                ? { right: -4, top: "50%", marginTop: -4, cursor: "ew-resize" }
                : edge === "s"
                  ? {
                      bottom: -4,
                      left: "50%",
                      marginLeft: -4,
                      cursor: "ns-resize",
                    }
                  : edge === "se"
                    ? { right: -4, bottom: -4, cursor: "nwse-resize" }
                    : {
                        left: -4,
                        top: "50%",
                        marginTop: -4,
                        cursor: "ew-resize",
                      };
            return (
              <span
                key={edge}
                data-testid={`html-resize-${edge}`}
                onPointerDown={(e) => beginResize(edge, e)}
                onPointerMove={moveResize}
                onPointerUp={endResize}
                onPointerCancel={cancelResize}
                onLostPointerCapture={cancelResize}
                style={{
                  position: "absolute",
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: "var(--app-accent)",
                  pointerEvents: "auto",
                  ...style,
                }}
              />
            );
          })}
        </div>
      )}
      {textSel && (
        <HtmlRangeToolbar
          anchor={textSel.anchor}
          text={textSel.text}
          onCommand={(command, value) => send(commandForRange(command, value))}
          onClose={() => {
            textSelectingRef.current = false;
            if (rangeDirtyRef.current) {
              rangeDirtyRef.current = false;
              setDocTick((n) => n + 1);
            }
            setTextSel(null);
          }}
        />
      )}
      {!textSel && selected && box?.nodeId === selected && info && (
        <HtmlEditToolbar
          key={selected}
          nodeId={selected}
          info={info}
          anchor={box.anchor}
          aiText={textOfNode(contentRef.current, selected)}
          onPatchStyle={(patch) =>
            commit((prev) => {
              // 基于**最新 content** 求样式：连点两个开关时，第二次若用渲染期
              // 的旧样式算，会把第一次的结果覆盖掉。
              const current = describeNode(prev, selected)?.style ?? {};
              return applyStylePatch(prev, selected, patch(current));
            })
          }
          onLink={(href) => commit((prev) => applyLink(prev, selected, href))}
          onRemove={() => {
            commit((prev) => applyNodeRemove(prev, selected));
            setSelected(null);
            setBox(null);
          }}
          onResetSize={() => {
            if (!selected) return;
            commit((prev) =>
              applyStylePatch(prev, selected, {
                width: null,
                height: null,
                "box-sizing": null,
              }),
            );
            setBox(null);
          }}
          onClose={() => setSelected(null)}
        />
      )}
      {capturing && <div className="html-capture-hint">拖出要截图的区域</div>}
      {notice && <div className="html-edit-notice">{notice}</div>}
    </>
  );
}
