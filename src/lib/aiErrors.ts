/**
 * AgentError → 用户能懂的话。界面（浮层 / 胶囊）只允许展示本文件的输出，
 * 不得出现字段名、JSON、错误码或工具名（spec AE-5）。
 */
export interface AgentErrorLike {
  kind?: string;
  field?: string;
  message?: string;
  status?: number;
  body?: string;
  turns?: number;
  name?: string;
}

const FIELD_HINTS: Record<string, string> = {
  fontSize: "字号需要在 8–96 之间",
  readerFontSize: "阅读字号需要在 8–96 之间",
  readerWidth: "阅读区宽度需要在 480–1400 之间",
  sidebarLeftWidth: "左侧栏宽度需要在 0–800 之间",
  sidebarRightWidth: "右侧栏宽度需要在 0–800 之间",
  horizontalSplitRatio: "左右分栏比例需要在 0–1 之间",
  verticalSplitRatio: "上下分栏比例需要在 0–1 之间",
  theme: "主题只能是浅色、深色、暖色或跟随系统",
  readerSkin: "阅读皮肤只能选纸感或素雅",
  aiConfirmDensity: "确认密度只能是每次确认、本会话静默或不提醒",
  snapshot: "这份历史记录已经不在了，刷新后再试",
  messages: "这条指令没能发出去，请重试",
  patch: "这次改动没有被接受，请换个说法再试",
  provider: "还没有配置 AI 服务，先到设置里填好服务地址和模型",
  apiKey: "还没有配置 AI 密钥，先到设置里填好再试",
};

export function humanizeAgentError(err: unknown): string {
  const e = (err ?? {}) as AgentErrorLike;
  switch (e.kind) {
    case "validation": {
      const hint = e.field ? FIELD_HINTS[e.field] : undefined;
      return hint ?? "这项设置不合法，换个说法再试一次";
    }
    case "provider":
      return "连接不上 AI 服务，检查服务设置";
    case "turnLimit":
      return "这次改动太绕，已停下，请拆小一点";
    case "tool":
      return "执行时出了点问题，请重试";
    case "io":
      return "读写设置失败，请重试";
    default:
      return "出了点问题，请重试";
  }
}
