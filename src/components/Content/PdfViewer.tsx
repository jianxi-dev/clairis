import { useCallback, useEffect, useRef, useState } from "react";
import { PDFViewer } from "@embedpdf/react-pdf-viewer";
import type {
  CommandsPlugin,
  DocumentManagerPlugin,
  EmbedPdfContainer,
  PluginRegistry,
  ToolbarSchema,
  UIPlugin,
  ZoomCapability,
  ZoomPlugin,
} from "@embedpdf/snippet";
import { loadPdfBytes } from "../../utils/pdfSource";
import { isTauriEnv } from "../../utils/tauri";
import { useStore } from "../../stores";

interface PdfViewerProps {
  filePath: string;
}

/**
 * 裁剪未启用功能（范围外 UI）：snippet 默认装配全部 28 插件，
 * 不显式禁用则批注/导出/全屏/签名/表单/图章/附件/截图等 UI 全部暴露。
 * 类别名经源码实证（各 schema item 的 categories 数组），见
 * .omo/evidence/pdf-viewer-upgrade/f4-fix-evidence/01-categories-inventory.txt。
 *
 * 禁用：
 * - annotation      全部批注层级（批注/形状模式、批注工具栏、评论、批注图章/签名等）
 * - panel-comment   工具栏「评论」按钮
 * - redaction       遮蔽模式与遮蔽面板
 * - form            表单模式与表单工具
 * - insert          插入模式（签名/图章/图片/附件插入，无顶层 signature/stamp/attachment 类别）
 * - document-export 文件菜单「导出」
 * - document-fullscreen 页面设置/文件菜单「全屏」
 * - document-capture 文件菜单「截图」
 * - capture         截图工具
 * - document-protect 文件菜单「安全/保护」
 * - spread          双页/跨页视图
 *
 * 保留：search / thumbnail / outline / zoom / pan / scroll / rotate /
 * print / selection / bookmark / history（均不在禁用列表内）。
 *
 * zoom-in / zoom-out：缩放工具栏内「放大」「缩小」两个独立按钮的命令类别。
 * 禁用后命令被标记为 disabled（经实证：类别只置灰、不移除按钮，因为这两个
 * 按钮是 zoom-toolbar 自定义组件内部硬编码的 command-button，不是 schema item，
 * 没有 data-epdf-cat 可供类别 CSS 命中）。因此再于 onReady 用 commands 插件的
 * registerCommand 把 visible 覆盖为 false，让按钮真正不渲染。
 * 注意不能禁用 "zoom"——那会连缩放输入框/菜单一起隐藏。
 */
const DISABLED_CATEGORIES = [
  "annotation",
  "panel-comment",
  "redaction",
  "form",
  "insert",
  "document-export",
  "document-fullscreen",
  "document-capture",
  "capture",
  "document-protect",
  "spread",
  "zoom-in",
  "zoom-out",
];

/**
 * 最小补充（disabledCategories / schema 无法覆盖）：
 * 1. 打印弹窗的「包含批注」复选框是 snippet 打印组件内硬编码 JSX
 *    （非 schema item，不受类别裁剪影响）。用一条仅命中该复选框的 CSS
 *    （其 span 类名 `text-fg-secondary text-sm font-medium` 在整份 bundle 中唯一）
 *    注入 shadow root 隐藏。来源实证见
 *    .omo/evidence/pdf-viewer-upgrade/f4-fix-evidence/03-print-modal-css.txt。
 * 2. 顶栏 page-controls 组件（上一页/页码/下一页）默认由滚动活动驱动透明度
 *    （4 秒无滚动即 opacity-0），放进工具栏后强制常驻。
 * 3. EmbedPDF 在 :host 生成 --ep-* 主题变量（默认跟随系统），这里用应用语义色
 *    覆盖，使 PDF UI 跟随亮/暗/暖；再对文件菜单、大纲面板、面板按钮、页码、
 *    缩放菜单、按钮栏底边做定向兜底。
 */
function injectPdfUiCss(container: EmbedPdfContainer): void {
  const shadow = container.shadowRoot;
  if (!shadow) return;
  if (shadow.querySelector("style[data-biaoyue-pdf-ui]")) return;
  const style = document.createElement("style");
  style.setAttribute("data-biaoyue-pdf-ui", "");
  style.textContent = [
    "label:has(> span.text-fg-secondary.text-sm.font-medium){display:none !important}",
    '[data-epdf-i="pdf-page-nav"]>div>div{opacity:1 !important;border:0 !important;background:transparent !important;box-shadow:none !important}',
    ":host{background:var(--app-bg) !important}",
    ".bg-bg-app{background:var(--app-bg) !important}",
    ".bg-bg-surface{background:var(--app-surface) !important}",
    ":host{--ep-background-app:var(--app-bg) !important;--ep-background-surface:var(--app-surface) !important;--ep-background-surface-alt:var(--app-sunken) !important;--ep-background-elevated:var(--app-surface) !important;--ep-background-input:var(--app-surface) !important;--ep-foreground-primary:var(--app-text) !important;--ep-foreground-secondary:var(--app-text-2) !important;--ep-foreground-muted:var(--app-text-2) !important;--ep-foreground-disabled:var(--app-text-2) !important;--ep-foreground-on-accent:var(--app-surface) !important;--ep-border-default:var(--app-border) !important;--ep-border-subtle:var(--app-border) !important;--ep-border-strong:var(--app-border-strong) !important;--ep-accent-primary:var(--app-accent) !important;--ep-accent-primary-hover:var(--app-accent) !important;--ep-accent-primary-active:var(--app-accent) !important;--ep-accent-primary-light:var(--app-accent-soft) !important;--ep-accent-primary-foreground:var(--app-surface) !important;--ep-interactive-hover:var(--app-accent-soft) !important;--ep-interactive-active:var(--app-accent-soft) !important;--ep-interactive-selected:var(--app-accent-soft) !important;--ep-interactive-focus:var(--app-accent) !important;--ep-interactive-focus-ring:var(--app-accent) !important;--ep-scrollbar-track:var(--app-sunken) !important;--ep-scrollbar-thumb:var(--app-border) !important;--ep-scrollbar-thumb-hover:var(--app-border-strong) !important}",
    '[data-epdf-i="document-menu"],[data-epdf-i="zoom-menu"]{background:var(--app-surface) !important;border-color:var(--app-border) !important;color:var(--app-text) !important}',
    '[data-sidebar-id="outline-panel"]{background:var(--app-surface) !important;border-color:var(--app-border) !important;color:var(--app-text) !important}',
    '[data-sidebar-id="outline-panel"] [role="tab"]{color:var(--app-text-2) !important;border-color:var(--app-border) !important}',
    '[data-sidebar-id="outline-panel"] [role="tab"][aria-selected="true"]{background:var(--app-accent) !important;border-color:var(--app-accent) !important;color:var(--app-surface) !important}',
    '[data-epdf-i="page-controls"] input{background:var(--app-surface) !important;border-color:var(--app-border) !important;color:var(--app-text) !important}',
    '[data-epdf-i="page-controls"] span{color:var(--app-text-2) !important}',
    '[data-epdf-i="main-toolbar"]{background:var(--app-surface) !important;border-bottom-color:var(--app-border) !important}',
    '[data-epdf-i="main-toolbar"]{transition:opacity .25s ease,transform .25s ease !important}',
    '[data-epdf-i="main-toolbar"]{opacity:calc(1 - var(--pdf-chrome-idle, 0)) !important;transform:translateY(calc(var(--pdf-chrome-idle, 0) * -100%)) !important}',
    ":host(.pdf-chrome-idle) *{pointer-events:none !important}",
  ].join("\n");
  shadow.appendChild(style);
}

type PdfLoadState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; buffer: ArrayBuffer };

/** 顶栏 page-controls 组件的 schema item id（与 injectPdfUiCss 的选择器对应） */
const PAGE_NAV_ITEM_ID = "pdf-page-nav";

/**
 *  registry 就绪后的 UI 配置：
 * 1. 禁用底部 page-controls 浮层（滚动不再弹出）。
 * 2. 把 page-controls 组件（上一页/页码/下一页）挂进 main-toolbar 的 center-group。
 * 3. 覆盖 zoom:in / zoom:out 命令的 visible，移除缩放工具栏内的两个独立按钮。
 * 返回一个清理函数（取消文档激活订阅）。
 */
function configurePdfUi(registry: PluginRegistry): () => void {
  const ui = registry.getPlugin<UIPlugin>("ui")?.provides();
  const docManager = registry
    .getPlugin<DocumentManagerPlugin>("document-manager")
    ?.provides();
  const commands = registry.getPlugin<CommandsPlugin>("commands")?.provides();
  if (!ui || !docManager) return () => {};

  // 底部 page-controls 浮层：对每个文档禁用（文档可能晚于 registry 就绪才激活）
  const disablePageControls = (documentId: string): void => {
    try {
      ui.disableOverlay("page-controls", documentId);
    } catch {
      // 文档尚未激活时忽略，后续 onActiveDocumentChanged 会补上
    }
  };
  const activeId = docManager.getActiveDocumentId();
  if (activeId) disablePageControls(activeId);
  const unsubscribe = docManager.onActiveDocumentChanged(
    ({ currentDocumentId }) => {
      if (currentDocumentId) disablePageControls(currentDocumentId);
    },
  );

  // 顶栏加入 page-controls（上一页/页码/下一页），插在缩放工具栏之后
  const schema = ui.getSchema();
  const mainToolbar = schema.toolbars["main-toolbar"];
  if (mainToolbar) {
    const items = mainToolbar.items.map((item) => {
      if (item.type !== "group" || item.id !== "center-group") return item;
      const centerItems = [...item.items];
      const zoomIdx = centerItems.findIndex((i) => i.id === "zoom-toolbar");
      if (zoomIdx >= 0) {
        centerItems.splice(zoomIdx + 1, 0, {
          type: "custom",
          id: PAGE_NAV_ITEM_ID,
          componentId: "page-controls",
          categories: ["page", "navigation"],
        });
      }
      return { ...item, items: centerItems };
    });
    const merged: ToolbarSchema = { ...mainToolbar, items };
    ui.mergeSchema({ toolbars: { "main-toolbar": merged } });
  }

  // 缩放工具栏内的「放大」「缩小」按钮：类别只置灰，覆盖 visible 让其不渲染
  if (commands) {
    const zoomButtons = [
      { id: "zoom:in", label: "放大", icon: "zoomIn", category: "zoom-in" },
      { id: "zoom:out", label: "缩小", icon: "zoomOut", category: "zoom-out" },
    ] as const;
    for (const btn of zoomButtons) {
      commands.registerCommand({
        id: btn.id,
        label: btn.label,
        icon: btn.icon,
        categories: ["zoom", btn.category],
        visible: () => false,
        action: () => {},
      });
    }
  }

  return unsubscribe;
}

/**
 * 触摸板双指捏合缩放（WebKit gesture 事件）。监听挂在 document 捕获阶段，
 * 使 shadow DOM 内的手势也能被父文档捕获；用容器包含判断过滤多实例。
 * 缩放的绝对倍率 = 手势开始时的当前倍率 × gesturechange.scale。
 */
function usePdfPinchZoom(
  registry: PluginRegistry | null,
  containerRef: React.RefObject<HTMLDivElement | null>,
  active: boolean,
) {
  useEffect(() => {
    if (!active || !registry) return;
    if (typeof document === "undefined") return;
    const el = containerRef.current;
    if (!el) return;

    let startZoom = 1;
    const isInside = (target: EventTarget | null): boolean => {
      const node = target instanceof Element ? target : null;
      return !!node && (el.contains(node) || node === el);
    };
    const getZoom = (): ZoomCapability | null => {
      try {
        return registry.getPlugin<ZoomPlugin>("zoom")?.provides() ?? null;
      } catch {
        return null;
      }
    };
    const onStart = (e: Event) => {
      if (!isInside(e.target)) return;
      const zoom = getZoom();
      if (!zoom) return;
      try {
        startZoom = zoom.getState().currentZoomLevel;
      } catch {
        startZoom = 1;
      }
    };
    const onChange = (e: Event) => {
      if (!isInside(e.target)) return;
      const scale = (e as unknown as { scale?: number }).scale;
      if (!scale) return;
      const zoom = getZoom();
      if (!zoom) return;
      try {
        zoom.requestZoom(startZoom * scale);
      } catch {
        // 文档未激活时忽略
      }
    };
    document.addEventListener("gesturestart", onStart, true);
    document.addEventListener("gesturechange", onChange, true);
    return () => {
      document.removeEventListener("gesturestart", onStart, true);
      document.removeEventListener("gesturechange", onChange, true);
    };
  }, [registry, containerRef, active]);
}

/**
 * PDF 预览组件：读取本地 PDF 字节后交给 EmbedPDF v2 查看器渲染。
 * 状态机：loading → ready（渲染 PDFViewer）/ error（展示错误信息）。
 * 配置为离线自托管（wasm 本地、禁用 CDN 图章/字体、主线程模式）。
 */
export default function PdfViewer({ filePath }: PdfViewerProps) {
  // 非 Tauri 环境同步短路为错误态：loadPdfBytes 的降级是异步的，
  // 浏览器 dev / jsdom 下首帧会闪「正在加载 PDF…」再变错误态。
  // 文案与 loadPdfBytes 的降级文案保持一致。
  const [state, setState] = useState<PdfLoadState>(() =>
    isTauriEnv()
      ? { status: "loading" }
      : { status: "error", error: "无法预览 PDF：需在 Tauri 桌面环境中运行" },
  );
  const [registry, setRegistry] = useState<PluginRegistry | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isTauriEnv()) return; // 非 Tauri 已在初始 state 短路为错误态
    let cancelled = false;

    loadPdfBytes(filePath)
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          const { bytes } = result;
          // 安全提取：bytes 可能是共享底层 ArrayBuffer 的视图，
          // 用 slice 截取自身区间，避免越界引用（atob 产物必为普通 ArrayBuffer）
          const buffer = bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength,
          ) as ArrayBuffer;
          setState({ status: "ready", buffer });
        } else {
          setState({ status: "error", error: result.error });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setState({ status: "error", error: msg });
      });

    return () => {
      cancelled = true;
      // 卸载或 filePath 变化时释放已持有的 ArrayBuffer 引用，避免大文件内存滞留
      setState((prev) =>
        prev.status === "ready" ? { status: "loading" } : prev,
      );
    };
  }, [filePath]);

  const handleInit = useCallback((container: EmbedPdfContainer) => {
    injectPdfUiCss(container);
  }, []);

  const handleReady = useCallback((r: PluginRegistry) => {
    setRegistry(r);
  }, []);

  // registry 就绪后配置 UI（浮层 / 顶栏页码 / 缩放按钮）
  useEffect(() => {
    if (!registry) return;
    return configurePdfUi(registry);
  }, [registry]);

  usePdfPinchZoom(registry, containerRef, state.status === "ready");

  // 沉浸态 PDF 顶栏自动收起（ui-polish-batch12 7.1）：1.2s 无指针交互加
  // pdf-chrome-idle，容器内任何指针活动解除；transform/opacity 收起，
  // 不改变内容布局。
  const readingMode = useStore((s) => s.readingMode);
  useEffect(() => {
    const el = containerRef.current;
    if (!readingMode || state.status !== "ready" || !el) {
      el?.classList.remove("pdf-chrome-idle");
      return;
    }
    let timer: number | null = null;
    const arm = () => {
      if (timer !== null) window.clearTimeout(timer);
      el.classList.remove("pdf-chrome-idle");
      timer = window.setTimeout(() => {
        timer = null;
        el.classList.add("pdf-chrome-idle");
      }, 1200);
    };
    arm();
    el.addEventListener("pointermove", arm);
    el.addEventListener("pointerdown", arm);
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      el.classList.remove("pdf-chrome-idle");
      el.removeEventListener("pointermove", arm);
      el.removeEventListener("pointerdown", arm);
    };
  }, [readingMode, state.status]);

  if (state.status === "loading") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "#666",
        }}
      >
        正在加载 PDF…
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div style={{ padding: "24px", textAlign: "center", color: "#666" }}>
        <p>无法预览 PDF</p>
        <p style={{ fontSize: 12, marginTop: 8 }}>{state.error}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        background: "var(--app-bg)",
      }}
    >
      <PDFViewer
        config={{
          wasmUrl: "/pdfium.wasm",
          worker: false,
          fontFallback: null,
          fonts: { ui: null, signature: null },
          stamp: { defaultLibrary: false, manifests: [] },
          i18n: { defaultLocale: "zh-CN" },
          disabledCategories: DISABLED_CATEGORIES,
          documentManager: {
            initialDocuments: [
              { buffer: state.buffer, name: fileNameFromPath(filePath) },
            ],
          },
        }}
        onInit={handleInit}
        onReady={handleReady}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}

function fileNameFromPath(path: string): string {
  const idx = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return idx >= 0 ? path.slice(idx + 1) : path;
}
