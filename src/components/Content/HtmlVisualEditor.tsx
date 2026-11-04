import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditorStore } from "../../stores/editorStore";
import {
  commandForSelection,
  parseBridgeMessage,
} from "../../editors/html/bridge";
import { applyBlockSplit, applyTextEdit } from "../../editors/html/edit";
import { buildEditableDoc } from "../../editors/html/runtime";

interface HtmlVisualEditorProps {
  content: string;
  filePath?: string | null;
  /**
   * 编辑器的改动交回主侧；`content` 是唯一真相（design D2）。
   *
   * 接收 updater 而不是成品字符串：同一 tick 内会连发 textEditInput /
   * textEditEnd / splitBlock 三条消息，若各自拿渲染期的 `content` 去算，
   * 后到的那条会把先到的覆盖掉（打字内容直接丢）。
   */
  onContentChange?: (updater: (prev: string) => string) => void;
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
  // 编辑期间冻结文档：否则每敲一个字都重建 iframe，光标与编辑态一起丢。
  //
  // 用 ref 而不是 state 做判定：content 走的是外部 store，订阅回调可能在
  // setState 提交之前就触发重渲染；那时若读的是 state，会看到 editing=false
  // 而重建文档——表现为"打着字，iframe 突然刷新，回车没人接"（实测偶发）。
  const editingRef = useRef(false);
  const frozenRef = useRef<string | null>(null);
  // 只用来在进入/离开编辑时触发一次重算
  const [docTick, setDocTick] = useState(0);

  const srcDoc = useMemo(() => {
    if (editingRef.current && frozenRef.current) return frozenRef.current;
    const doc = buildEditableDoc(content, { filePath, fontSize });
    if (!editingRef.current) frozenRef.current = doc;
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
    changeRef.current?.(updater);
  }, []);

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
          break;
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
        default:
          break;
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // 选中变化 → 下发命令让 iframe 自己挪框。文档重建后也重发一次。
  useEffect(() => {
    frameRef.current?.contentWindow?.postMessage(
      commandForSelection(selected),
      "*",
    );
  }, [selected, srcDoc]);

  return (
    <iframe
      ref={frameRef}
      // sandbox 不给 allow-same-origin：编辑态文档与主应用跨源隔离，
      // 用户 HTML 里的脚本即便绕开 CSP 也碰不到主窗口
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      title="HTML 可视化编辑"
      style={{
        width: "100%",
        height: "100%",
        border: "none",
        background: "#fff",
      }}
    />
  );
}
