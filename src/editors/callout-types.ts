/* 高亮块（callout）类型表（移植自 md-bundle packages/editor/src/callout-types.ts，
 * issue #361 / change editor-fidelity-2 task 2.6）。
 *
 * 为什么与渲染端分开
 * ------------------
 * 渲染端的类型表是「渲染」真相源：它保留全部解析别名（`hint`/`caution`/
 * `summary`/`check`/`error`/`help`/…），保证旧文档仍能渲染。部分别名故意
 * 共用一个标签（`tip`/`hint` 都是「提示」，`caution`/`attention` 都是「注意」），
 * 渲染无碍，但会让编辑器类型浮层出现重复项（U-02）。
 *
 * `CALLOUT_EDIT_TYPES` 是「编辑」展示集：十三个类型、标签唯一，对齐
 * design.md D7 / conformance R-CALLOUT-01。类型浮层按它渲染，装饰层用
 * `resolveCalloutType` 解析块类型（先查本表，再查渲染别名表，以便编辑器
 * 不展示的别名仍能上色）。本文件不改动渲染端，所以菜单里的八个高亮块
 * 子项与预览渲染不受影响。
 */

/** 一个编辑端高亮块类型：唯一标签 + 头部 emoji + 色调 token。 */
export interface CalloutEditType {
  /** Markdown `[!KEY]` token（小写，与渲染端别名一致）。 */
  readonly key: string;
  /** 唯一展示标签——浮层的去重契约（R-CALLOUT-01）。 */
  readonly label: string;
  /** 头部 emoji，显示在高亮块卡片与类型浮层上。 */
  readonly emoji: string;
  /** 色调类名后缀（`cm-callout-tone-${tone}`，定义在装饰主题里）。 */
  readonly tone: string;
  /** 可选的按类型背景覆盖；预留（颜色由 tone token 决定）。 */
  readonly bg?: string;
}

/**
 * 十三个编辑类型，按 R-CALLOUT-01 的标签顺序：
 * 注释 信息 摘要 待办 提示 成功 问题 警告 失败 危险 Bug 示例 引用。
 *
 * 顺序有意义：类型浮层自上而下按此顺序渲染。
 */
export const CALLOUT_EDIT_TYPES: readonly CalloutEditType[] = [
  { key: "note", label: "注释", emoji: "📝", tone: "blue" },
  { key: "info", label: "信息", emoji: "ℹ️", tone: "blue" },
  { key: "abstract", label: "摘要", emoji: "📋", tone: "purple" },
  { key: "todo", label: "待办", emoji: "☑️", tone: "blue" },
  { key: "tip", label: "提示", emoji: "💡", tone: "green" },
  { key: "success", label: "成功", emoji: "✅", tone: "green" },
  { key: "question", label: "问题", emoji: "❓", tone: "teal" },
  { key: "warning", label: "警告", emoji: "⚠️", tone: "orange" },
  { key: "failure", label: "失败", emoji: "✖️", tone: "red" },
  { key: "danger", label: "危险", emoji: "🚨", tone: "red" },
  { key: "bug", label: "Bug", emoji: "🐛", tone: "red" },
  { key: "example", label: "示例", emoji: "📝", tone: "gray" },
  { key: "quote", label: "引用", emoji: "💬", tone: "muted" },
];

/** 解析后的展示信息，来源不限编辑集或渲染别名表。 */
export interface ResolvedCalloutType {
  readonly label: string;
  readonly tone: string;
  /** 头部 emoji（渲染别名表里叫 `icon`）。 */
  readonly icon: string;
}

/**
 * 渲染端解析别名表（对应 md-bundle renderer 的 `CALLOUT_TYPE_MAP`）。
 *
 * 移植时内联于此：Clairis 尚未建立渲染端注入点（design.md D2 的
 * `calloutTypeMap` 接口），而这里只需要「键 → 标签/色调/图标」的只读数据，
 * 不引入 md-bundle 包依赖。键集合与渲染端保持一致，新增别名时同步此处。
 */
const CALLOUT_RENDER_ALIASES: Readonly<
  Record<
    string,
    { readonly label: string; readonly tone: string; readonly icon: string }
  >
> = {
  note: { label: "注释", tone: "blue", icon: "📝" },
  info: { label: "信息", tone: "blue", icon: "ℹ️" },
  abstract: { label: "摘要", tone: "purple", icon: "📋" },
  summary: { label: "总结", tone: "purple", icon: "📋" },
  tip: { label: "提示", tone: "green", icon: "💡" },
  hint: { label: "提示", tone: "green", icon: "💡" },
  important: { label: "重要", tone: "purple", icon: "⭐" },
  success: { label: "成功", tone: "green", icon: "✅" },
  check: { label: "完成", tone: "green", icon: "✅" },
  warning: { label: "警告", tone: "orange", icon: "⚠️" },
  caution: { label: "注意", tone: "orange", icon: "⚠️" },
  attention: { label: "注意", tone: "orange", icon: "⚠️" },
  danger: { label: "危险", tone: "red", icon: "🚨" },
  error: { label: "错误", tone: "red", icon: "❌" },
  failure: { label: "失败", tone: "red", icon: "✖️" },
  bug: { label: "问题", tone: "red", icon: "🐛" },
  question: { label: "疑问", tone: "teal", icon: "❓" },
  help: { label: "帮助", tone: "teal", icon: "💬" },
  faq: { label: "问答", tone: "teal", icon: "💬" },
  example: { label: "示例", tone: "gray", icon: "📝" },
  quote: { label: "引用", tone: "muted", icon: "💬" },
  cite: { label: "引述", tone: "muted", icon: "📖" },
};

/**
 * 把高亮块类型键解析成展示信息。编辑集优先（所以编辑器里 `bug` 读作
 * 「Bug」、`question` 读作「问题」）；编辑集没有的键回落到渲染别名表，
 * 保证每个解析别名仍能渲染。两边都不认识时返回 null（非法的 `[!FOO]`
 * 保持普通引用块）。
 */
export function resolveCalloutType(type: string): ResolvedCalloutType | null {
  const edit = CALLOUT_EDIT_TYPES.find((entry) => entry.key === type);
  if (edit) return { label: edit.label, tone: edit.tone, icon: edit.emoji };
  const renderer = CALLOUT_RENDER_ALIASES[type];
  if (renderer)
    return { label: renderer.label, tone: renderer.tone, icon: renderer.icon };
  return null;
}

/** 取色器里的一个 emoji 选项；`name` 同时作为搜索键。 */
export interface CalloutEmojiChoice {
  readonly emoji: string;
  readonly name: string;
}

/**
 * 头部取色器的精选 emoji 网格——刻意做小、随仓库内置：产品禁止新增依赖，
 * 所以不能引入 emoji-mart（R-CALLOUT-02 里的「emoji-mart」是实现备注，
 * 不是依赖契约）。`name` 中英混排，可选搜索框按任一种都能过滤。
 */
export const CALLOUT_EMOJI_CHOICES: readonly CalloutEmojiChoice[] = [
  { emoji: "📝", name: "备注 笔记 记录 memo note" },
  { emoji: "ℹ️", name: "信息 info" },
  { emoji: "💡", name: "提示 灯泡 想法 idea tip" },
  { emoji: "✅", name: "成功 完成 对勾 done success" },
  { emoji: "❓", name: "问题 疑问 question" },
  { emoji: "⚠️", name: "警告 注意 warning" },
  { emoji: "🚨", name: "危险 警报 danger" },
  { emoji: "✖️", name: "失败 错误 叉 failure" },
  { emoji: "🐛", name: "虫子 缺陷 bug" },
  { emoji: "📋", name: "摘要 剪贴板 abstract" },
  { emoji: "⭐", name: "星标 重要 star" },
  { emoji: "🎉", name: "庆祝 派对 默认 party" },
  { emoji: "🔥", name: "火焰 热门 fire" },
  { emoji: "👍", name: "赞 好的 thumbs up" },
  { emoji: "🙌", name: "举手 欢呼" },
  { emoji: "🚀", name: "火箭 发布 rocket" },
  { emoji: "📌", name: "图钉 钉住 pin" },
  { emoji: "🎯", name: "目标 靶心 target" },
  { emoji: "💬", name: "对话 引用 quote" },
  { emoji: "📖", name: "书 引述 cite" },
  { emoji: "📎", name: "回形针 附件" },
  { emoji: "🧠", name: "大脑 想法 思考 brain" },
  { emoji: "🌟", name: "闪星 发光 star" },
  { emoji: "😄", name: "笑脸 开心 smile" },
];
