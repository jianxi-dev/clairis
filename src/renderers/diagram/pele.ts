/** Pele 引擎适配层：仓库里唯一 `import "pele"` 的文件（design D2）。
 *
 * 本模块只被 engine.ts 动态 import——静态 import 会把整包 pele 拉进主 chunk，
 * 破坏 design D3 的懒加载（Vite 会给出 "dynamically imported but also statically
 * imported" 告警）。
 *
 * 职责只有三件：
 * 1. 构造渲染选项——主题走 `--pele-*` CSS 变量（reader.css 映射，不在 JS 传色值）、
 *    关闭缩放、协议白名单（linkSchemes 用 Pele 默认 http/https/mailto/tel，D6；
 *    imageSchemes 在默认 http/https 之上追加 asset/media 两个应用内协议）、
 *    容器宽度由 `mount()` 自行经 `room()` + ResizeObserver 适配，不传固定 maxWidth。
 * 2. 按元素保管 mount() 句柄：同元素重挂、清理前先 destroy()，避免 ResizeObserver 残留。
 * 3. 错误归一（spec D-4）：PeleError 直接用其 message，未知错误给兜底文案。
 * 能力开关、懒加载与批量渲染在 engine.ts。
 */
import { mount, render, PeleError } from "pele";
import type { Mounted } from "pele";

export { PeleError };
export type { Mounted };

/** 图内图片允许的协议：Pele 默认 http/https，追加应用内 asset/media（design D6）。 */
const IMAGE_SCHEMES = ["http", "https", "asset", "media"];

/** mount() 句柄注册表：键为 `.mermaid-view` 容器，destroy 过的不再保留。 */
const handles = new WeakMap<HTMLElement, Mounted>();

/**
 * 把 source 挂到 element 上。同元素重挂前先销毁旧实例；text 无法绘制时
 * 不抛出，错误会由 Pele 画进容器（见 Mounted.error）。
 */
export function mountDiagram(element: HTMLElement, source: string): Mounted {
  handles.get(element)?.destroy();
  const handle = mount(element, source, {
    zoom: false,
    imageSchemes: IMAGE_SCHEMES,
  });
  handles.set(element, handle);
  return handle;
}

/** 停止观察并解除挂载；图已画出的内容保留在容器里由调用方处置。 */
export function unmountDiagram(element: HTMLElement): void {
  handles.get(element)?.destroy();
  handles.delete(element);
}

/**
 * 编辑态静态渲染（design D4）：CM6 widget 生命周期没有可靠的卸载钩子，
 * `mount()` 会留下 ResizeObserver 残留，改走纯函数 `render()`——widget
 * 重建即回收，无观察者。协议白名单与 mount() 同源；linkSchemes 用 Pele
 * 默认（http/https/mailto/tel）。失败直接抛 PeleError，由调用方归一展示。
 */
export function renderToString(source: string): string {
  return render(source, { imageSchemes: IMAGE_SCHEMES }).svg;
}

/** 把渲染错误归一成可展示文本；不把原始对象抛到 UI 层（spec D-4）。 */
export function describeDiagramError(error: unknown): string {
  if (error instanceof PeleError) return error.message;
  return String(error ?? "图表渲染失败");
}

/**
 * 导出用同步出图：返回完整 `<svg>`，无法绘制时返回 null（降级保留源码，不抛）。
 * 与 `renderToString` 同名会与编辑态语义冲突（#152），故单独命名。
 * 导出链路要在同一调用栈内拿字符串，故走 render() 而非需要 DOM 的 mount()。
 */
export function renderToSvgOrNull(source: string): string | null {
  try {
    const result = render(source, { imageSchemes: IMAGE_SCHEMES });
    return result.svg || null;
  } catch {
    return null;
  }
}
