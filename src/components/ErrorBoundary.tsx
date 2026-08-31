import { Component, type ReactNode, type ErrorInfo } from "react";
import { log } from "../utils/log";

interface Props {
  children: ReactNode;
  panelId?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    log.error("ErrorBoundary", "Caught error", { error: error.message, componentStack: info.componentStack });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, fontFamily: "monospace" }}>
          <h2 style={{ color: "red" }}>应用错误{this.props.panelId ? ` (${this.props.panelId})` : ""}</h2>
          <pre style={{ whiteSpace: "pre-wrap", background: "#f5f5f5", padding: 12, borderRadius: 4 }}>
            {this.state.error?.message}
          </pre>
          <p style={{ color: "#666", fontSize: 12 }}>
            如果这是 Tauri 相关错误，请在 Tauri 桌面环境中运行（`npm run tauri dev`）。
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
