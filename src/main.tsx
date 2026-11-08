import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/editor.css";
import "katex/dist/katex.min.css";
import "./styles/tokens.css";
import "./styles/reader.css";
import "./styles/player.css";

const rootEl = document.getElementById("root");
if (!rootEl) {
  console.error("[Biaoyue] #root element not found!");
}

// Detect which window we're in via URL param
const urlParams = new URLSearchParams(window.location.search);
const isOverlay = urlParams.get("window") === "overlay";

if (isOverlay) {
  // Overlay window: render only the capture overlay
  console.info(
    "[Biaoyue] Overlay window detected, mounting capture overlay...",
  );
  import("./components/CaptureOverlay").then((mod) => {
    const CaptureOverlay = mod.default;
    ReactDOM.createRoot(rootEl as HTMLElement).render(
      <React.StrictMode>
        <CaptureOverlay />
      </React.StrictMode>,
    );
  });
} else {
  // Main window: render the full app
  console.info("[Biaoyue] main.tsx loaded, mounting React...");
  window.addEventListener("error", (e) => {
    console.error("[Biaoyue] Global error:", e.message, e.filename, e.lineno);
  });
  window.addEventListener("unhandledrejection", (e) => {
    console.error("[Biaoyue] Unhandled promise rejection:", e.reason);
  });

  // Expose main store so capture overlay can call openFile
  import("./stores/index").then((mod) => {
    (window as any).__BIAOYUE_MAIN_STORE__ = mod.useStore;
  });

  // Listen for events from the overlay window
  // Wrapped in .then() + .catch() so browser-only tests don't throw
  import("@tauri-apps/api/event")
    .then(({ listen }) => {
      listen(
        "open-file-in-main",
        async (event: { payload: { dateStr: string } }) => {
          const { dateStr } = event.payload;
          const toLocalDate = (d: Date) =>
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          const date =
            dateStr === "今天"
              ? toLocalDate(new Date())
              : dateStr === "昨天"
                ? toLocalDate(new Date(Date.now() - 86400000))
                : dateStr;
          try {
            const { invoke } = await import("@tauri-apps/api/core");
            const result = await invoke<{ content: string; path: string }>(
              "open_file_direct",
              {
                path: `~/documents/inbox/inbox-${date}.md`,
              },
            );
            const mainStore = (window as any).__BIAOYUE_MAIN_STORE__;
            if (mainStore && mainStore.getState) {
              mainStore.getState().openFile(result.path, result.content);
            }
          } catch (err) {
            console.warn("[Biaoyue] open-file-in-main failed:", err);
          }
        },
      ).catch(() => {});
      // Overlay double-click top bar → show capsule in main window
      listen("overlay-to-capsule", () => {
        import("./stores/captureOverlay").then(({ useCaptureOverlayStore }) => {
          useCaptureOverlayStore.getState().minimize();
        });
      }).catch(() => {});
    })
    .catch(() => {
      // Not in Tauri environment (e.g. browser tests) — skip event listener
    });

  import("./App").then((mod) => {
    const App = mod.default;
    ReactDOM.createRoot(rootEl as HTMLElement).render(
      <React.StrictMode>
        <React.Suspense
          fallback={
            <div className="flex items-center justify-center h-screen text-gray-400">
              Loading...
            </div>
          }
        >
          <App />
        </React.Suspense>
      </React.StrictMode>,
    );
  });
}

console.info("[Biaoyue] React render called.");
