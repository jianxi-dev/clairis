export interface ProviderPreset {
  id: string;
  label: string;
  endpoint: string;
  defaultModel: string;
  docsUrl?: string;
}

export const PROVIDERS: ProviderPreset[] = [
  {
    id: "deepseek",
    label: "DeepSeek",
    endpoint: "https://api.deepseek.com",
    defaultModel: "deepseek-chat",
    docsUrl: "https://platform.deepseek.com/api-docs",
  },
  {
    id: "qwen",
    label: "通义千问",
    endpoint: "https://dashscope.aliyuncs.com/compatible-mode",
    defaultModel: "qwen-plus",
    docsUrl:
      "https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope",
  },
  {
    id: "kimi",
    label: "Kimi",
    endpoint: "https://api.moonshot.cn",
    defaultModel: "moonshot-v1-8k",
    docsUrl: "https://platform.moonshot.cn/docs",
  },
  {
    id: "glm",
    label: "智谱 GLM",
    endpoint: "https://open.bigmodel.cn/api/paas/v4",
    defaultModel: "glm-4-flash",
    docsUrl: "https://open.bigmodel.cn/dev/api",
  },
  {
    id: "workbuddy",
    label: "WorkBuddy",
    endpoint: "",
    defaultModel: "",
    docsUrl: "https://www.codebuddy.cn/docs",
  },
  {
    id: "opencode",
    label: "OpenCode",
    endpoint: "https://opencode.ai/zen",
    defaultModel: "opencode/grok-code",
    docsUrl: "https://opencode.ai/docs/zen",
  },
  {
    id: "pi",
    label: "Pi",
    endpoint: "",
    defaultModel: "",
    docsUrl: "https://docs.pi.ai",
  },
  {
    id: "custom",
    label: "自定义",
    endpoint: "",
    defaultModel: "",
    docsUrl: "https://platform.openai.com/docs/api-reference/chat",
  },
];
