import AiConversation from "./AiConversation";

/**
 * AI 停靠窗格正文（layout-portal 9.1）：作为分栏树里的一个 AI leaf 渲染。
 * 头部（标题 / ⋯ / 关闭）由 PaneTreeView 提供，这里只放共用对话正文。
 */
export default function AiDockedPane() {
  return (
    <div
      data-ai-docked
      data-ai-form="docked"
      className="flex h-full min-h-0 flex-col"
    >
      <AiConversation form="docked" />
    </div>
  );
}
